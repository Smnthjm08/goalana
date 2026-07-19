"use client"

import { useState } from "react"
import Link from "next/link"
import { Flame } from "lucide-react"
import { toast } from "sonner"
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { BN } from "@coral-xyz/anchor"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import {
  getVaultPda,
  getPositionPda,
  getChallengePoolPda,
} from "@workspace/goalana-sdk/pdas"
import { explorerTxUrl, explorerAddressUrl } from "@/lib/solana-explorer"
import { marketTypeLabels } from "@/lib/market-groups"
import { getSiteUrl } from "@/lib/site"
import { Card, CardHeader, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { MarketStatusBadge } from "@/components/market-status-badge"
import { ShareActions } from "@/components/share/share-actions"
import {
  SettlementProofReceipt,
  type SettlementProof,
} from "@/components/fixtures/settlement-proof-receipt"
import { MarketLifecycleTimeline } from "@/components/fixtures/market-lifecycle-timeline"
import { MarketLockStatus } from "@/components/fixtures/match-time-status"
import { OddsDelta } from "@/components/fixtures/odds-delta"
import { PoolVsReference } from "@/components/fixtures/pool-vs-reference"
import { useGoalanaProgram } from "@/hooks/use-goalana-program"
import { useMarketAccount } from "@/hooks/use-market-account"
import { usePositionAccount } from "@/hooks/use-position-account"
import { useBetSlip } from "@/components/bet-slip/bet-slip-context"

export function MarketCard({ market }: { market: any }) {
  const [selected, setSelected] = useState<"YES" | "NO" | null>(null)
  const [amount, setAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [txHistory, setTxHistory] = useState<
    Array<{ signature: string; label: string; ts: number }>
  >([])

  function recordTx(label: string, signature: string) {
    setTxHistory((prev) =>
      [{ signature, label, ts: Date.now() }, ...prev].slice(0, 5)
    )
  }

  const { program, connected, publicKey } = useGoalanaProgram()
  const { setVisible } = useWalletModal()
  const { addItem, has: inSlip } = useBetSlip()
  const {
    market: onChainMarket,
    loading: marketLoading,
    refetch: refetchMarket,
  } = useMarketAccount(market.marketPda)
  const { position, refetch: refetchPosition } = usePositionAccount(
    market.marketPda
  )

  // On-chain status is the source of truth once loaded; the DB's `status`
  // (mirrored at creation time, never updated by lock/settle) is only a
  // fallback while the on-chain read is in flight.
  const status = onChainMarket?.status ?? market.status
  const isOpen = status === "Open"

  const poolYes = onChainMarket
    ? Number(onChainMarket.totalYes) / LAMPORTS_PER_SOL
    : null
  const poolNo = onChainMarket
    ? Number(onChainMarket.totalNo) / LAMPORTS_PER_SOL
    : null

  // Parametric prop markets (v2-todo item 18) have no TxLINE reference
  // odds — `initialYesPct` is null. The pool is the only price: show the
  // live pari-mutuel split (50/50 with no stake yet) instead of a TxLINE
  // percentage, and skip the delta-vs-opening-odds display entirely.
  const isUnpriced = market.initialYesPct == null
  const poolTotal = (poolYes ?? 0) + (poolNo ?? 0)
  const poolYesPct = poolTotal > 0 ? ((poolYes ?? 0) / poolTotal) * 100 : 50

  // ─── Challenge Pool (fixed-stake N-vs-N) ────────────────────────────────
  // A user-proposed pool: everyone stakes the SAME amount, N slots per side.
  // The escrow is the same pari-mutuel path — balanced fixed stakes just mean
  // each winner doubles up. `fixedStakeLamports` arrives as a string (BigInt).
  const fixedStakeLamports = market.fixedStakeLamports
    ? Number(market.fixedStakeLamports)
    : null
  const isChallenge = fixedStakeLamports != null && fixedStakeLamports > 0
  const fixedStakeSol = isChallenge
    ? fixedStakeLamports! / LAMPORTS_PER_SOL
    : null
  const slotsPerSide: number | null = isChallenge
    ? (market.slotsPerSide ?? null)
    : null
  // Slot fill = how many fixed stakes are already in each side's pool.
  const yesSlotsFilled =
    isChallenge && fixedStakeLamports
      ? Math.round(Number(onChainMarket?.totalYes ?? 0n) / fixedStakeLamports)
      : 0
  const noSlotsFilled =
    isChallenge && fixedStakeLamports
      ? Math.round(Number(onChainMarket?.totalNo ?? 0n) / fixedStakeLamports)
      : 0

  // currentYesPct/currentNoPct are the live TxLINE reference probability
  // (server-joined from the current Odds row); fall back to the opening
  // snapshot captured at market creation if a live match isn't available yet.
  const yesPct = isUnpriced
    ? poolYesPct
    : Number(market.currentYesPct ?? market.initialYesPct)
  const noPct = isUnpriced
    ? 100 - poolYesPct
    : Number(market.currentNoPct ?? market.initialNoPct)

  async function handlePlaceBet() {
    if (!connected || !publicKey) {
      setVisible(true)
      return
    }

    if (!selected) return

    // Challenge pools ignore the free-text amount — the stake is fixed so
    // every entrant contributes an equal share of the N-vs-N pool.
    const parsedAmount = isChallenge ? fixedStakeSol! : Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid SOL amount")
      return
    }

    if (onChainMarket && onChainMarket.status !== "Open") {
      toast.error(
        `Market is ${onChainMarket.status.toLowerCase()} — betting is closed`
      )
      return
    }

    setSubmitting(true)
    const toastId = toast.loading("Sending transaction to devnet...")

    try {
      const marketPubkey = new PublicKey(market.marketPda)
      const [vaultPda] = getVaultPda(marketPubkey)
      const [positionPda] = getPositionPda(marketPubkey, publicKey)
      const lamports = Math.round(parsedAmount * LAMPORTS_PER_SOL)
      const side = selected === "YES" ? { yes: {} } : { no: {} }

      // Challenge pools go through the enforced instruction: the stake is fixed
      // on-chain (taken from the ChallengePool account, not the client) and the
      // per-side cap is checked in consensus.
      const signature = isChallenge
        ? await program.methods
            .placeChallengeBet(side)
            .accountsPartial({
              market: marketPubkey,
              challengePool: getChallengePoolPda(marketPubkey)[0],
              vault: vaultPda,
              position: positionPda,
              user: publicKey,
              systemProgram: SystemProgram.programId,
            })
            .rpc()
        : await program.methods
            .placeBet(side, new BN(lamports))
            .accountsPartial({
              market: marketPubkey,
              vault: vaultPda,
              position: positionPda,
              user: publicKey,
              systemProgram: SystemProgram.programId,
            })
            .rpc()

      toast.success(`Bet placed: ${parsedAmount} SOL on ${selected}`, {
        id: toastId,
        description: `${signature.slice(0, 8)}…${signature.slice(-8)}`,
      })
      recordTx(`Bet ${parsedAmount} SOL / ${selected}`, signature)

      setAmount("")
      setSelected(null)
      await Promise.all([refetchMarket(), refetchPosition()])
    } catch (err) {
      console.error("place_bet failed", err)
      const message = err instanceof Error ? err.message : "Transaction failed"
      toast.error("Bet failed", { id: toastId, description: message })
    } finally {
      setSubmitting(false)
    }
  }

  function handleAddToSlip() {
    if (!selected) return
    const parsedAmount = isChallenge ? fixedStakeSol! : Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid SOL amount first")
      return
    }
    addItem({
      marketPda: market.marketPda,
      question: market.question,
      side: selected,
      lamports: Math.round(parsedAmount * LAMPORTS_PER_SOL),
      fixedStake: isChallenge,
    })
    toast.success("Added to bet slip", {
      description: "Stake several markets, then sign once.",
    })
    setSelected(null)
    setAmount("")
  }

  // Claimability — mirrors the constraints enforced on-chain by
  // claim_winnings.rs / claim_refund.rs, so the button only appears when the
  // transaction would actually succeed.
  const isSettled = status === "Settled"
  const isCancelled = status === "Cancelled"
  const outcome = onChainMarket?.outcome ?? null

  const winningStake =
    position && outcome !== null
      ? outcome
        ? position.yesAmount
        : position.noAmount
      : 0n

  const canClaimWinnings = Boolean(
    position &&
    !position.claimed &&
    isSettled &&
    outcome !== null &&
    winningStake > 0n
  )

  const emptyWinningPool = Boolean(
    onChainMarket &&
    isSettled &&
    outcome !== null &&
    ((outcome && onChainMarket.totalYes === 0n) ||
      (!outcome && onChainMarket.totalNo === 0n))
  )

  const canClaimRefund = Boolean(
    position &&
    !position.claimed &&
    (position.yesAmount > 0n || position.noAmount > 0n) &&
    (isCancelled || emptyWinningPool)
  )

  const payoutPreview =
    canClaimWinnings && onChainMarket
      ? (winningStake * (onChainMarket.totalYes + onChainMarket.totalNo)) /
        (outcome ? onChainMarket.totalYes : onChainMarket.totalNo)
      : null

  async function handleClaim(kind: "winnings" | "refund") {
    if (!connected || !publicKey) {
      setVisible(true)
      return
    }

    setClaiming(true)
    const toastId = toast.loading(`Claiming ${kind}...`)

    try {
      const marketPubkey = new PublicKey(market.marketPda)
      const [vaultPda] = getVaultPda(marketPubkey)
      const [positionPda] = getPositionPda(marketPubkey, publicKey)

      const methodBuilder =
        kind === "winnings"
          ? program.methods.claimWinnings()
          : program.methods.claimRefund()

      const signature = await methodBuilder
        .accountsPartial({
          market: marketPubkey,
          vault: vaultPda,
          position: positionPda,
          user: publicKey,
        })
        .rpc()

      toast.success(
        kind === "winnings" ? "Winnings claimed" : "Refund claimed",
        {
          id: toastId,
          description: `${signature.slice(0, 8)}…${signature.slice(-8)}`,
        }
      )
      recordTx(
        kind === "winnings" ? "Claimed winnings" : "Claimed refund",
        signature
      )

      await Promise.all([refetchMarket(), refetchPosition()])
    } catch (err) {
      console.error(`claim_${kind} failed`, err)
      const message = err instanceof Error ? err.message : "Transaction failed"
      toast.error("Claim failed", { id: toastId, description: message })
    } finally {
      setClaiming(false)
    }
  }

  return (
    <Card className="flex flex-col rounded-sm transition-colors hover:border-primary/50">
      <CardHeader className="border-b border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/market/${market.marketPda}`}
            className="font-sans text-lg font-bold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
          >
            {market.question}
          </Link>
          <ShareActions
            url={`${getSiteUrl()}/market/${market.marketPda}`}
            title={market.question}
            compact
            className="shrink-0"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              {isChallenge
                ? `Challenge Pool · ${slotsPerSide}v${slotsPerSide}`
                : marketTypeLabels[market.marketType] ||
                  market.marketType.replace(/_/g, " ")}
            </span>
            {isChallenge && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                {fixedStakeSol} SOL · YES {yesSlotsFilled}/{slotsPerSide} · NO{" "}
                {noSlotsFilled}/{slotsPerSide}
              </span>
            )}
            {/* A market is "hot" if it has active liquidity OR if the odds have shifted significantly (> 5%) from opening */}
            {(poolTotal > 0 ||
              (!isUnpriced &&
                Math.abs(yesPct - Number(market.initialYesPct)) >= 5)) && (
              <div className="flex items-center gap-1 rounded bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-bold text-orange-500">
                <Flame className="size-3" />
                HOT
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <MarketLockStatus locksAt={market.locksAt} status={status} />
            <MarketStatusBadge status={status} className="gap-1 text-[10px]" />
            {marketLoading && <Spinner className="size-2.5" />}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-5">
        <span className="-mb-1 text-center font-mono text-[10px] tracking-widest text-muted-foreground">
          {isUnpriced
            ? "UNPRICED — THE POOL SETS THE PRICE"
            : "TXLINE REFERENCE — NOT GOALANA‘S ON-CHAIN POOL PRICE"}
        </span>
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            disabled={!isOpen}
            aria-pressed={selected === "YES"}
            onClick={() => setSelected(selected === "YES" ? null : "YES")}
            className={`h-auto flex-row items-center justify-between rounded-sm p-4 transition-colors ${
              selected === "YES"
                ? "border-pos bg-pos text-pos-foreground! hover:border-pos hover:bg-pos/90 hover:text-pos-foreground!"
                : "group/yes border-pos/20 bg-pos/5 hover:border-pos/50 hover:bg-pos/10"
            }`}
          >
            <div className="flex flex-col items-start gap-1">
              <span
                className={`font-mono text-xs ${selected === "YES" ? "text-pos-foreground/80" : "text-pos/70 group-hover/yes:text-pos"} transition-colors`}
              >
                YES
              </span>
              <span
                className={`font-mono text-[10px] tabular-nums ${selected === "YES" ? "text-pos-foreground/60" : "text-pos/50 group-hover/yes:text-pos/70"} transition-colors`}
              >
                {poolYes?.toFixed(2) ?? "0.00"} SOL
              </span>
            </div>
            <span className="flex flex-col items-end gap-0.5">
              <span
                className={`font-heading text-xl tabular-nums ${selected === "YES" ? "text-pos-foreground!" : "text-pos/90 group-hover/yes:text-pos"} transition-colors`}
              >
                {yesPct.toFixed(2)}%
              </span>
              {!isUnpriced && (
                <OddsDelta
                  current={yesPct}
                  initial={Number(market.initialYesPct)}
                  dimmed={selected === "YES"}
                />
              )}
            </span>
          </Button>
          <Button
            variant="outline"
            disabled={!isOpen}
            aria-pressed={selected === "NO"}
            onClick={() => setSelected(selected === "NO" ? null : "NO")}
            className={`h-auto flex-row items-center justify-between rounded-sm p-4 transition-colors ${
              selected === "NO"
                ? "border-neg bg-neg text-neg-foreground! hover:border-neg hover:bg-neg/90 hover:text-neg-foreground!"
                : "group/no border-neg/20 bg-neg/5 hover:border-neg/50 hover:bg-neg/10"
            }`}
          >
            <div className="flex flex-col items-start gap-1">
              <span
                className={`font-mono text-xs ${selected === "NO" ? "text-neg-foreground/80" : "text-neg/70 group-hover/no:text-neg"} transition-colors`}
              >
                NO
              </span>
              <span
                className={`font-mono text-[10px] tabular-nums ${selected === "NO" ? "text-neg-foreground/60" : "text-neg/50 group-hover/no:text-neg/70"} transition-colors`}
              >
                {poolNo?.toFixed(2) ?? "0.00"} SOL
              </span>
            </div>
            <span className="flex flex-col items-end gap-0.5">
              <span
                className={`font-heading text-xl tabular-nums ${selected === "NO" ? "text-neg-foreground!" : "text-neg/90 group-hover/no:text-neg"} transition-colors`}
              >
                {noPct.toFixed(2)}%
              </span>
              {!isUnpriced && (
                <OddsDelta
                  current={noPct}
                  initial={Number(market.initialNoPct)}
                  dimmed={selected === "NO"}
                />
              )}
            </span>
          </Button>
        </div>

        {selected && isOpen && (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount in SOL"
                value={isChallenge ? String(fixedStakeSol) : amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={submitting || isChallenge}
                readOnly={isChallenge}
                className="font-mono"
              />
              <Button
                onClick={handlePlaceBet}
                disabled={submitting || (!isChallenge && !amount)}
                className="shrink-0 font-heading tracking-widest uppercase"
              >
                {submitting ? (
                  <>
                    <Spinner className="size-3.5" />
                    {isChallenge ? "Joining…" : "Placing…"}
                  </>
                ) : connected ? (
                  isChallenge ? (
                    `Join ${fixedStakeSol} SOL`
                  ) : (
                    "Place Bet"
                  )
                ) : (
                  "Connect"
                )}
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={handleAddToSlip}
              disabled={
                submitting ||
                (!isChallenge && !amount) ||
                inSlip(market.marketPda)
              }
              className="font-heading text-[11px] tracking-widest uppercase"
            >
              {inSlip(market.marketPda) ? "In bet slip" : "+ Add to bet slip"}
            </Button>
            <span className="font-mono text-[10px] text-muted-foreground">
              {isChallenge
                ? `Fixed-stake challenge pool — every entrant stakes exactly ${fixedStakeSol} SOL. Winners split the pool pari-mutuel (a balanced ${slotsPerSide}v${slotsPerSide} doubles each winner's stake).`
                : "Devnet SOL only. Position is pari-mutuel — payout depends on the final pool split."}
            </span>
          </div>
        )}

        {(poolYes !== null || position) && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
            <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>
                POOL — YES {poolYes?.toFixed(3) ?? "…"} / NO{" "}
                {poolNo?.toFixed(3) ?? "…"} SOL
              </span>
              {position &&
                (position.yesAmount > 0n || position.noAmount > 0n) && (
                  <span className="text-primary">
                    YOUR POSITION —{" "}
                    {position.yesAmount > 0n
                      ? `${Number(position.yesAmount) / LAMPORTS_PER_SOL} YES`
                      : ""}
                    {position.yesAmount > 0n && position.noAmount > 0n
                      ? " / "
                      : ""}
                    {position.noAmount > 0n
                      ? `${Number(position.noAmount) / LAMPORTS_PER_SOL} NO`
                      : ""}
                    {position.claimed ? " (CLAIMED)" : ""}
                  </span>
                )}
            </div>
            {/* v2-todo item 20: the pool is Goalana's own price; TxLINE is only
                a reference. Surfacing both — and how far they've drifted apart
                — makes the pari-mutuel mechanism legible instead of implicit. */}
            {!isUnpriced && poolTotal > 0 && (
              <PoolVsReference
                poolYesPct={poolYesPct}
                referenceYesPct={yesPct}
              />
            )}
          </div>
        )}

        {isSettled && market.settlementProof && (
          <SettlementProofReceipt
            proof={market.settlementProof as SettlementProof}
            settlementTx={market.settlementTx}
            marketPda={market.marketPda}
          />
        )}

        {/* Fallback: settled on-chain but the full proof record isn't persisted
            (e.g. a market settled before proof-retention shipped). */}
        {isSettled && !market.settlementProof && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-3 font-mono text-[10px] text-muted-foreground">
            <span className="tracking-widest text-foreground uppercase">
              Settlement Proof — Outcome:{" "}
              {outcome === true ? "YES" : outcome === false ? "NO" : "…"}
            </span>
            {market.oracleTsMs && (
              <span>
                Oracle stat timestamp:{" "}
                {new Date(Number(market.oracleTsMs)).toLocaleString()}
                {
                  " — verified on-chain via CPI into TxLINE's oracle program, not Goalana's backend."
                }
              </span>
            )}
            {market.settlementTx && (
              <a
                href={explorerTxUrl(market.settlementTx)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline transition-colors hover:text-primary"
              >
                settle_market tx: {market.settlementTx.slice(0, 8)}…
                {market.settlementTx.slice(-8)} ↗
              </a>
            )}
            <a
              href={explorerAddressUrl(market.marketPda)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-colors hover:text-primary"
            >
              View Market account on Solana Explorer ↗
            </a>
          </div>
        )}

        {(canClaimWinnings || canClaimRefund) && (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <Button
              onClick={() =>
                handleClaim(canClaimWinnings ? "winnings" : "refund")
              }
              disabled={claiming}
              className="font-heading tracking-widest uppercase"
            >
              {claiming ? (
                <>
                  <Spinner className="size-3.5" />
                  Claiming…
                </>
              ) : canClaimWinnings ? (
                `Claim Winnings${payoutPreview !== null ? ` (${(Number(payoutPreview) / LAMPORTS_PER_SOL).toFixed(4)} SOL)` : ""}`
              ) : (
                "Claim Refund"
              )}
            </Button>
            <span className="text-center font-mono text-[10px] text-muted-foreground">
              {canClaimWinnings
                ? "This market settled in your favor — payout comes from the pari-mutuel pool."
                : "This market has no counter-liquidity or was cancelled — your full stake is refundable."}
            </span>
          </div>
        )}

        <MarketLifecycleTimeline
          creationTx={market.creationTx}
          createdAt={market.createdAt}
          lockTx={market.lockTx}
          lockedAt={market.lockedAt}
          settlementTx={market.settlementTx}
          settledAt={market.settledAt}
          onChainStatus={onChainMarket?.status ?? null}
          sessionTxs={txHistory}
          positionClaimed={position?.claimed}
        />
      </CardContent>
    </Card>
  )
}
