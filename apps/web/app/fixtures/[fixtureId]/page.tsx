"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { BN } from "@coral-xyz/anchor"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { getVaultPda, getPositionPda } from "@workspace/goalana-sdk/pdas"
import axiosInstance from "@/lib/axios-instance"
import { explorerTxUrl, explorerAddressUrl } from "@/lib/solana-explorer"
import { Card, CardHeader, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { OddsMovementChart } from "@/components/fixtures/odds-movement-chart"
import { LiveScoreHeader } from "@/components/fixtures/live-score-header"
import { MatchEventTimeline } from "@/components/fixtures/match-event-timeline"
import { LifecycleStatusStrip } from "@/components/fixtures/lifecycle-status-strip"
import {
  SettlementProofReceipt,
  type SettlementProof,
} from "@/components/fixtures/settlement-proof-receipt"
import { SettlementProofPanel } from "@/components/fixtures/settlement-proof-panel"
import {
  ProofIntegrityPanel,
  type ProofIntegrityArtifact,
} from "@/components/fixtures/proof-integrity-panel"
import { MarketLifecycleTimeline } from "@/components/fixtures/market-lifecycle-timeline"
import {
  MatchTimeStatus,
  MarketLockStatus,
} from "@/components/fixtures/match-time-status"
import { OddsDelta } from "@/components/fixtures/odds-delta"
import { TeamBadge } from "@/components/team-badge"
import { useGoalanaProgram } from "@/hooks/use-goalana-program"
import { useMarketAccount } from "@/hooks/use-market-account"
import { usePositionAccount } from "@/hooks/use-position-account"

const marketTypeLabels: Record<string, string> = {
  FULL_TIME_HOME_WIN: "MATCH RESULT / FULL TIME",
  FULL_TIME_DRAW: "MATCH RESULT / FULL TIME",
  FULL_TIME_AWAY_WIN: "MATCH RESULT / FULL TIME",
  FULL_TIME_OVER_1_5: "TOTAL GOALS / FULL TIME",
  FULL_TIME_OVER_2_5: "TOTAL GOALS / FULL TIME",
  FULL_TIME_OVER_3_5: "TOTAL GOALS / FULL TIME",
  TOTAL_CORNERS_OVER_9_5: "PARAMETRIC PROP / FULL TIME",
  TOTAL_CARDS_OVER_3_5: "PARAMETRIC PROP / FULL TIME",
}

// Section grouping for the Markets tab — keeps the six supported markets
// organized as MATCH RESULT / TOTAL GOALS instead of one flat, unlabeled grid.
const MARKET_GROUPS: Record<string, string> = {
  FULL_TIME_HOME_WIN: "MATCH RESULT",
  FULL_TIME_DRAW: "MATCH RESULT",
  FULL_TIME_AWAY_WIN: "MATCH RESULT",
  FULL_TIME_OVER_1_5: "TOTAL GOALS",
  FULL_TIME_OVER_2_5: "TOTAL GOALS",
  FULL_TIME_OVER_3_5: "TOTAL GOALS",
  TOTAL_CORNERS_OVER_9_5: "PARAMETRIC PROPS",
  TOTAL_CARDS_OVER_3_5: "PARAMETRIC PROPS",
}
const MARKET_GROUP_ORDER = ["MATCH RESULT", "TOTAL GOALS", "PARAMETRIC PROPS", "OTHER"]

function groupMarkets(
  markets: any[]
): Array<{ group: string; markets: any[] }> {
  const byGroup = new Map<string, any[]>()

  for (const market of markets) {
    const group = MARKET_GROUPS[market.marketType] ?? "OTHER"
    const bucket = byGroup.get(group) ?? []
    bucket.push(market)
    byGroup.set(group, bucket)
  }

  return MARKET_GROUP_ORDER.map((group) => ({
    group,
    markets: byGroup.get(group) ?? [],
  })).filter((entry) => entry.markets.length > 0)
}

function MarketCard({ market }: { market: any }) {
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

  // currentYesPct/currentNoPct are the live TxLINE reference probability
  // (server-joined from the current Odds row); fall back to the opening
  // snapshot captured at market creation if a live match isn't available yet.
  const yesPct = isUnpriced ? poolYesPct : Number(market.currentYesPct ?? market.initialYesPct)
  const noPct = isUnpriced ? 100 - poolYesPct : Number(market.currentNoPct ?? market.initialNoPct)

  async function handlePlaceBet() {
    if (!connected || !publicKey) {
      setVisible(true)
      return
    }

    if (!selected) return

    const parsedAmount = Number(amount)
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

      const signature = await program.methods
        .placeBet(
          selected === "YES" ? { yes: {} } : { no: {} },
          new BN(lamports)
        )
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
        <span className="font-sans text-lg font-bold text-foreground">
          {market.question}
        </span>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] text-muted-foreground uppercase">
            {marketTypeLabels[market.marketType] ||
              market.marketType.replace(/_/g, " ")}
          </span>
          <div className="flex items-center gap-3">
            <MarketLockStatus locksAt={market.locksAt} status={status} />
            <Badge
              variant="outline"
              className="border-primary/20 bg-primary/5 text-[10px] text-primary"
            >
              {marketLoading ? <Spinner className="size-2.5" /> : "●"} {status}
            </Badge>
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
            onClick={() => setSelected(selected === "YES" ? null : "YES")}
            className={`h-auto flex-row items-center justify-between rounded-sm p-4 transition-colors ${
              selected === "YES"
                ? "border-lime-400 bg-lime-400 text-black hover:border-lime-500 hover:bg-lime-500 hover:text-black"
                : "group/yes border-border bg-card text-muted-foreground hover:border-lime-400 hover:text-lime-400"
            }`}
          >
            <span
              className={`font-mono text-xs ${selected === "YES" ? "text-black/70" : "text-muted-foreground group-hover/yes:text-lime-400"} transition-colors`}
            >
              YES
            </span>
            <span className="flex flex-col items-end gap-0.5">
              <span
                className={`font-heading text-xl ${selected === "YES" ? "text-black" : "text-foreground group-hover/yes:text-lime-400"} transition-colors`}
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
            onClick={() => setSelected(selected === "NO" ? null : "NO")}
            className={`h-auto flex-row items-center justify-between rounded-sm p-4 transition-colors ${
              selected === "NO"
                ? "border-rose-600 bg-rose-600 text-white hover:border-rose-700 hover:bg-rose-700 hover:text-white"
                : "group/no border-border bg-card text-muted-foreground hover:border-rose-600 hover:text-rose-600"
            }`}
          >
            <span
              className={`font-mono text-xs ${selected === "NO" ? "text-white/70" : "text-muted-foreground group-hover/no:text-rose-600"} transition-colors`}
            >
              NO
            </span>
            <span className="flex flex-col items-end gap-0.5">
              <span
                className={`font-heading text-xl ${selected === "NO" ? "text-white" : "text-foreground group-hover/no:text-rose-600"} transition-colors`}
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={submitting}
                className="font-mono"
              />
              <Button
                onClick={handlePlaceBet}
                disabled={submitting || !amount}
                className="shrink-0 font-heading tracking-widest uppercase"
              >
                {submitting ? (
                  <Spinner className="size-3.5" />
                ) : connected ? (
                  "Place Bet"
                ) : (
                  "Connect"
                )}
              </Button>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              Devnet SOL only. Position is pari-mutuel — payout depends on the
              final pool split.
            </span>
          </div>
        )}

        {(poolYes !== null || position) && (
          <div className="flex items-center justify-between border-t border-border pt-3 font-mono text-[10px] text-muted-foreground">
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
                <Spinner className="size-3.5" />
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

// Lightweight polling for live TxLINE reference odds — reuses the existing
// fixture endpoint rather than adding a new SSE/WS layer. The odds-history
// chart data has its own identical polling loop inside OddsMovementChart.
const FIXTURE_POLL_INTERVAL_MS = 8_000

export default function FixtureDetailPage() {
  const { fixtureId } = useParams()

  const [fixture, setFixture] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  useEffect(() => {
    if (!fixtureId) return

    let cancelled = false

    const fetchFixture = () =>
      axiosInstance
        .get(`/fixtures/${fixtureId}`)
        .then((res) => {
          if (cancelled) return
          if (res.data?.data) {
            setFixture(res.data.data)
            setRefreshError(null)
          }
        })
        .catch((err) => {
          if (cancelled) return
          console.error("Error fetching fixture:", err)
          // Keep whatever is already rendered — a transient poll failure
          // must not blank out the market cards.
          setRefreshError("Live update failed — showing last known data")
        })

    fetchFixture().finally(() => {
      if (!cancelled) setLoading(false)
    })

    const intervalId = setInterval(() => {
      void fetchFixture()
    }, FIXTURE_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [fixtureId])

  // Skeletons mirror the real layout (header band → strip → tab row → market
  // grid) so the page doesn't reflow when the data lands.
  if (loading) {
    return (
      <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <Skeleton className="h-48 w-full rounded-sm" />
          <Skeleton className="h-12 w-full rounded-sm" />
          <Skeleton className="h-10 w-full rounded-sm" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-sm" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!fixture) {
    return (
      <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 rounded-sm border border-dashed border-border bg-card px-6 py-16 text-center">
          <span className="font-heading text-lg tracking-widest text-foreground uppercase">
            Fixture not found
          </span>
          <p className="max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
            This fixture isn&apos;t in Goalana&apos;s tracked set. It may have
            been removed from the TxLINE feed.
          </p>
          <Button
            asChild
            className="mt-1 font-heading tracking-widest uppercase"
          >
            <Link href="/">Browse Markets</Link>
          </Button>
        </div>
      </div>
    )
  }

  const tsNum = Number(fixture.startTime)
  const date = new Date(tsNum > 1e11 ? tsNum : tsNum * 1000)

  const marketGroups = groupMarkets(fixture.markets ?? [])

  // Recorded once per fixture by scripts/record-proof-integrity.ts; absent on
  // fixtures where it was never run, so the tab is conditional.
  const proofIntegrity: ProofIntegrityArtifact | null =
    (fixture.proofIntegrity as ProofIntegrityArtifact | undefined) ?? null

  return (
    <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        {/* Match Header */}
        <div className="mb-2 flex w-full flex-col">
          <div className="mb-6 flex items-start justify-between gap-4">
            <span className="font-mono text-xs tracking-widest text-foreground uppercase md:text-sm">
              {fixture.competition}
            </span>
            <MatchTimeStatus
              startTime={fixture.startTime}
              liveScore={fixture.liveScore}
              variant="detail"
            />
          </div>

          <div className="relative flex w-full items-center justify-between border-t border-b border-border py-12">
            <div className="flex min-w-0 flex-1 flex-col items-start">
              <TeamBadge
                name={fixture.participant1}
                className="gap-3 font-sans text-3xl leading-none font-black text-foreground md:text-5xl lg:text-6xl"
              />
            </div>

            <div className="absolute left-1/2 -translate-x-1/2">
              <LiveScoreHeader
                liveScore={fixture.liveScore}
                startTime={fixture.startTime}
                kickoffLabel={date.toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-end">
              <TeamBadge
                name={fixture.participant2}
                className="gap-3 text-right font-sans text-3xl leading-none font-black text-foreground md:text-5xl lg:text-6xl"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              FIXTURE / {fixture.fixtureId}
            </span>
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              DATA / TXLINE
            </span>
          </div>
          {refreshError && (
            <div className="mt-2 text-right">
              <span className="font-mono text-[10px] tracking-widest text-destructive uppercase">
                [ {refreshError} ]
              </span>
            </div>
          )}
        </div>

        <LifecycleStatusStrip
          liveScore={fixture.liveScore}
          markets={fixture.markets ?? []}
        />

        {/* Tabs */}
        <Tabs defaultValue="MARKETS" className="w-full">
          <TabsList
            variant="line"
            className="h-auto w-full justify-start gap-8 rounded-none border-b border-border p-0"
          >
            <TabsTrigger
              value="MARKETS"
              className="bg-transparent px-0 pt-0 pb-4 font-heading text-sm tracking-widest text-muted-foreground uppercase after:bg-primary hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-primary"
            >
              Markets
            </TabsTrigger>
            <TabsTrigger
              value="ODDS_MOVEMENT"
              className="bg-transparent px-0 pt-0 pb-4 font-heading text-sm tracking-widest text-muted-foreground uppercase after:bg-primary hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-primary"
            >
              Odds & Movement
            </TabsTrigger>
            <TabsTrigger
              value="MATCH_EVENTS"
              className="bg-transparent px-0 pt-0 pb-4 font-heading text-sm tracking-widest text-muted-foreground uppercase after:bg-primary hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-primary"
            >
              Match Events
            </TabsTrigger>
            <TabsTrigger
              value="SETTLEMENT_PROOF"
              className="bg-transparent px-0 pt-0 pb-4 font-heading text-sm tracking-widest text-muted-foreground uppercase after:bg-primary hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-primary"
            >
              Settlement Proof
            </TabsTrigger>
            {proofIntegrity && (
              <TabsTrigger
                value="PROOF_INTEGRITY"
                className="bg-transparent px-0 pt-0 pb-4 font-heading text-sm tracking-widest text-muted-foreground uppercase after:bg-primary hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-primary"
              >
                Proof Integrity
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent
            value="MARKETS"
            className="mt-8 border-none p-0 outline-none"
          >
            {marketGroups.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-border bg-card px-6 py-16 text-center">
                <span className="font-heading text-lg tracking-widest text-foreground uppercase">
                  No markets yet
                </span>
                <p className="max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
                  Goalana opens markets only once TxLINE prices this fixture.
                  They appear here automatically — nothing to do.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {marketGroups.map(({ group, markets }) => (
                  <div key={group} className="flex flex-col gap-4">
                    <h3 className="border-b border-border pb-2 font-heading text-sm tracking-widest text-muted-foreground uppercase">
                      {group}
                    </h3>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      {markets.map((market: any) => (
                        <MarketCard key={market.id} market={market} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="ODDS_MOVEMENT"
            className="mt-8 border-none p-0 outline-none"
          >
            <OddsMovementChart
              fixtureId={fixture.fixtureId}
              participant1={fixture.participant1}
              participant2={fixture.participant2}
              startTime={fixture.startTime}
            />
          </TabsContent>

          <TabsContent
            value="MATCH_EVENTS"
            className="mt-8 border-none p-0 outline-none"
          >
            <MatchEventTimeline
              events={fixture.events ?? []}
              participant1={fixture.participant1}
              participant2={fixture.participant2}
              participant1IsHome={fixture.participant1IsHome}
            />
          </TabsContent>

          <TabsContent
            value="SETTLEMENT_PROOF"
            className="mt-8 border-none p-0 outline-none"
          >
            <SettlementProofPanel
              fixtureId={fixture.fixtureId}
              isFinal={Boolean(fixture.liveScore?.isFinal)}
            />
          </TabsContent>

          {proofIntegrity && (
            <TabsContent
              value="PROOF_INTEGRITY"
              className="mt-8 border-none p-0 outline-none"
            >
              <ProofIntegrityPanel artifact={proofIntegrity} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
