"use client"

import { useEffect, useState } from "react"
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
import { Spinner } from "@workspace/ui/components/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { OddsMovementChart } from "@/components/fixtures/odds-movement-chart"
import { LiveScoreHeader } from "@/components/fixtures/live-score-header"
import { MatchEventTimeline } from "@/components/fixtures/match-event-timeline"
import { LifecycleStatusStrip } from "@/components/fixtures/lifecycle-status-strip"
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
}
const MARKET_GROUP_ORDER = ["MATCH RESULT", "TOTAL GOALS", "OTHER"]

function groupMarkets(markets: any[]): Array<{ group: string; markets: any[] }> {
  const byGroup = new Map<string, any[]>()

  for (const market of markets) {
    const group = MARKET_GROUPS[market.marketType] ?? "OTHER"
    const bucket = byGroup.get(group) ?? []
    bucket.push(market)
    byGroup.set(group, bucket)
  }

  return MARKET_GROUP_ORDER
    .map((group) => ({ group, markets: byGroup.get(group) ?? [] }))
    .filter((entry) => entry.markets.length > 0)
}

function MarketCard({ market }: { market: any }) {
  const [selected, setSelected] = useState<"YES" | "NO" | null>(null)
  const [amount, setAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [txHistory, setTxHistory] = useState<Array<{ signature: string; label: string; ts: number }>>([])

  function recordTx(label: string, signature: string) {
    setTxHistory((prev) => [{ signature, label, ts: Date.now() }, ...prev].slice(0, 5))
  }

  const { program, connected, publicKey } = useGoalanaProgram()
  const { setVisible } = useWalletModal()
  const { market: onChainMarket, loading: marketLoading, refetch: refetchMarket } = useMarketAccount(market.marketPda)
  const { position, refetch: refetchPosition } = usePositionAccount(market.marketPda)

  // currentYesPct/currentNoPct are the live TxLINE reference probability
  // (server-joined from the current Odds row); fall back to the opening
  // snapshot captured at market creation if a live match isn't available yet.
  const yesPct = Number(market.currentYesPct ?? market.initialYesPct)
  const noPct = Number(market.currentNoPct ?? market.initialNoPct)

  // On-chain status is the source of truth once loaded; the DB's `status`
  // (mirrored at creation time, never updated by lock/settle) is only a
  // fallback while the on-chain read is in flight.
  const status = onChainMarket?.status ?? market.status
  const isOpen = status === "Open"

  const poolYes = onChainMarket ? Number(onChainMarket.totalYes) / LAMPORTS_PER_SOL : null
  const poolNo = onChainMarket ? Number(onChainMarket.totalNo) / LAMPORTS_PER_SOL : null

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
      toast.error(`Market is ${onChainMarket.status.toLowerCase()} — betting is closed`)
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
        .placeBet(selected === "YES" ? { yes: {} } : { no: {} }, new BN(lamports))
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
    position && outcome !== null ? (outcome ? position.yesAmount : position.noAmount) : 0n

  const canClaimWinnings = Boolean(
    position && !position.claimed && isSettled && outcome !== null && winningStake > 0n
  )

  const emptyWinningPool = Boolean(
    onChainMarket &&
      isSettled &&
      outcome !== null &&
      ((outcome && onChainMarket.totalYes === 0n) || (!outcome && onChainMarket.totalNo === 0n))
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

      const methodBuilder = kind === "winnings" ? program.methods.claimWinnings() : program.methods.claimRefund()

      const signature = await methodBuilder
        .accountsPartial({
          market: marketPubkey,
          vault: vaultPda,
          position: positionPda,
          user: publicKey,
        })
        .rpc()

      toast.success(kind === "winnings" ? "Winnings claimed" : "Refund claimed", {
        id: toastId,
        description: `${signature.slice(0, 8)}…${signature.slice(-8)}`,
      })
      recordTx(kind === "winnings" ? "Claimed winnings" : "Claimed refund", signature)

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
    <Card className="flex flex-col rounded-sm hover:border-primary/50 transition-colors">
      <CardHeader className="border-b border-border p-5 bg-card">
        <span className="font-sans font-bold text-lg text-foreground">
          {market.question}
        </span>
        <div className="flex items-center justify-between mt-3">
          <span className="font-mono text-[10px] text-muted-foreground uppercase">
            {marketTypeLabels[market.marketType] || market.marketType.replace(/_/g, ' ')}
          </span>
          <Badge variant="outline" className="text-[10px] text-primary border-primary/20 bg-primary/5">
            {marketLoading ? <Spinner className="size-2.5" /> : "●"} {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-5 flex flex-col gap-4">
        <span className="font-mono text-[10px] text-muted-foreground tracking-widest text-center -mb-1">
          TXLINE REFERENCE — NOT GOALANA&lsquo;S ON-CHAIN POOL PRICE
        </span>
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            disabled={!isOpen}
            onClick={() => setSelected(selected === "YES" ? null : "YES")}
            className={`h-auto flex-row items-center justify-between p-4 rounded-sm transition-colors ${
              selected === "YES"
                ? "bg-lime-400 border-lime-400 text-black hover:bg-lime-500 hover:text-black hover:border-lime-500"
                : "border-border bg-card text-muted-foreground hover:border-lime-400 hover:text-lime-400 group/yes"
            }`}
          >
            <span className={`font-mono text-xs ${selected === "YES" ? "text-black/70" : "text-muted-foreground group-hover/yes:text-lime-400"} transition-colors`}>YES</span>
            <span className={`font-heading text-xl ${selected === "YES" ? "text-black" : "text-foreground group-hover/yes:text-lime-400"} transition-colors`}>{yesPct.toFixed(2)}%</span>
          </Button>
          <Button
            variant="outline"
            disabled={!isOpen}
            onClick={() => setSelected(selected === "NO" ? null : "NO")}
            className={`h-auto flex-row items-center justify-between p-4 rounded-sm transition-colors ${
              selected === "NO"
                ? "bg-rose-600 border-rose-600 text-white hover:bg-rose-700 hover:text-white hover:border-rose-700"
                : "border-border bg-card text-muted-foreground hover:border-rose-600 hover:text-rose-600 group/no"
            }`}
          >
            <span className={`font-mono text-xs ${selected === "NO" ? "text-white/70" : "text-muted-foreground group-hover/no:text-rose-600"} transition-colors`}>NO</span>
            <span className={`font-heading text-xl ${selected === "NO" ? "text-white" : "text-foreground group-hover/no:text-rose-600"} transition-colors`}>{noPct.toFixed(2)}%</span>
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
                className="shrink-0 font-heading uppercase tracking-widest"
              >
                {submitting ? <Spinner className="size-3.5" /> : connected ? "Place Bet" : "Connect"}
              </Button>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              Devnet SOL only. Position is pari-mutuel — payout depends on the final pool split.
            </span>
          </div>
        )}

        {(poolYes !== null || position) && (
          <div className="flex items-center justify-between border-t border-border pt-3 font-mono text-[10px] text-muted-foreground">
            <span>
              POOL — YES {poolYes?.toFixed(3) ?? "…"} / NO {poolNo?.toFixed(3) ?? "…"} SOL
            </span>
            {position && (position.yesAmount > 0n || position.noAmount > 0n) && (
              <span className="text-primary">
                YOUR POSITION — {position.yesAmount > 0n ? `${Number(position.yesAmount) / LAMPORTS_PER_SOL} YES` : ""}
                {position.yesAmount > 0n && position.noAmount > 0n ? " / " : ""}
                {position.noAmount > 0n ? `${Number(position.noAmount) / LAMPORTS_PER_SOL} NO` : ""}
                {position.claimed ? " (CLAIMED)" : ""}
              </span>
            )}
          </div>
        )}

        {isSettled && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-3 font-mono text-[10px] text-muted-foreground">
            <span className="uppercase tracking-widest text-foreground">
              Settlement Proof — Outcome: {outcome === true ? "YES" : outcome === false ? "NO" : "…"}
            </span>
            {market.oracleTsMs && (
              <span>
                Oracle stat timestamp: {new Date(Number(market.oracleTsMs)).toLocaleString()}
                {" — verified on-chain via CPI into TxLINE's oracle program, not Goalana's backend."}
              </span>
            )}
            {market.settlementTx && (
              <a
                href={explorerTxUrl(market.settlementTx)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-primary transition-colors"
              >
                settle_market tx: {market.settlementTx.slice(0, 8)}…{market.settlementTx.slice(-8)} ↗
              </a>
            )}
            <a
              href={explorerAddressUrl(market.marketPda)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary transition-colors"
            >
              View Market account on Solana Explorer ↗
            </a>
          </div>
        )}

        {(canClaimWinnings || canClaimRefund) && (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <Button
              onClick={() => handleClaim(canClaimWinnings ? "winnings" : "refund")}
              disabled={claiming}
              className="font-heading uppercase tracking-widest"
            >
              {claiming ? (
                <Spinner className="size-3.5" />
              ) : canClaimWinnings ? (
                `Claim Winnings${payoutPreview !== null ? ` (${(Number(payoutPreview) / LAMPORTS_PER_SOL).toFixed(4)} SOL)` : ""}`
              ) : (
                "Claim Refund"
              )}
            </Button>
            <span className="font-mono text-[10px] text-muted-foreground text-center">
              {canClaimWinnings
                ? "This market settled in your favor — payout comes from the pari-mutuel pool."
                : "This market has no counter-liquidity or was cancelled — your full stake is refundable."}
            </span>
          </div>
        )}

        {txHistory.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              This session
            </span>
            {txHistory.map((tx) => (
              <a
                key={tx.signature}
                href={explorerTxUrl(tx.signature)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between font-mono text-[10px] text-muted-foreground hover:text-primary transition-colors"
              >
                <span>{tx.label}</span>
                <span className="underline">{tx.signature.slice(0, 6)}…{tx.signature.slice(-6)} ↗</span>
              </a>
            ))}
          </div>
        )}
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
      axiosInstance.get(`/fixtures/${fixtureId}`)
        .then(res => {
          if (cancelled) return
          if (res.data?.data) {
            setFixture(res.data.data)
            setRefreshError(null)
          }
        })
        .catch(err => {
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

  if (loading) {
    return (
      <div className="flex w-full flex-col p-4 md:p-8 lg:p-12 items-center justify-center min-h-[50vh]">
         <span className="font-mono text-sm text-muted-foreground uppercase tracking-wider animate-pulse">
            [ Fetching Fixture Data... ]
         </span>
      </div>
    )
  }

  if (!fixture) {
    return (
      <div className="flex w-full flex-col p-4 md:p-8 lg:p-12 items-center justify-center min-h-[50vh]">
         <span className="font-mono text-sm text-destructive uppercase tracking-wider">
            [ Fixture Not Found ]
         </span>
      </div>
    )
  }

  const tsNum = Number(fixture.startTime)
  const date = new Date(tsNum > 1e11 ? tsNum : tsNum * 1000)

  const marketGroups = groupMarkets(fixture.markets ?? [])

  return (
    <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
      <div className="flex w-full max-w-5xl flex-col gap-8 mx-auto">
        
        {/* Match Header */}
        <div className="flex flex-col w-full mb-2">
          <div className="flex items-center justify-between mb-6">
             <span className="font-mono text-xs md:text-sm text-foreground uppercase tracking-widest">
               {fixture.competition}
             </span>
             <span className="font-mono text-xs md:text-sm text-primary uppercase tracking-widest">
               {fixture.liveScore?.statusId != null
                 ? (fixture.liveScore.periodLabel ?? "LIVE")
                 : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
             </span>
          </div>

          <div className="border-t border-b border-border py-12 flex items-center justify-between w-full relative">
            <div className="flex flex-col flex-1 items-start min-w-0">
              <TeamBadge
                name={fixture.participant1}
                className="font-sans font-black text-3xl md:text-5xl lg:text-6xl text-foreground leading-none gap-3"
              />
            </div>
            
            <div className="absolute left-1/2 -translate-x-1/2">
              <LiveScoreHeader
                liveScore={fixture.liveScore}
                kickoffLabel={date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              />
            </div>

            <div className="flex flex-col flex-1 items-end min-w-0">
              <TeamBadge
                name={fixture.participant2}
                className="font-sans font-black text-3xl md:text-5xl lg:text-6xl text-foreground leading-none text-right gap-3"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-6">
             <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
               FIXTURE / {fixture.fixtureId}
             </span>
             <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
               DATA / TXLINE
             </span>
          </div>
          {refreshError && (
            <div className="mt-2 text-right">
              <span className="font-mono text-[10px] text-destructive uppercase tracking-widest">
                [ {refreshError} ]
              </span>
            </div>
          )}
        </div>

        <LifecycleStatusStrip liveScore={fixture.liveScore} markets={fixture.markets ?? []} />

        {/* Tabs */}
        <Tabs defaultValue="MARKETS" className="w-full">
          <TabsList variant="line" className="w-full justify-start border-b border-border rounded-none h-auto p-0 gap-8">
            <TabsTrigger 
              value="MARKETS"
              className="font-heading uppercase tracking-widest pb-4 pt-0 px-0 text-sm bg-transparent data-[state=active]:bg-transparent text-muted-foreground hover:text-foreground data-[state=active]:text-primary after:bg-primary"
            >
              Markets
            </TabsTrigger>
            <TabsTrigger
              value="ODDS_MOVEMENT"
              className="font-heading uppercase tracking-widest pb-4 pt-0 px-0 text-sm bg-transparent data-[state=active]:bg-transparent text-muted-foreground hover:text-foreground data-[state=active]:text-primary after:bg-primary"
            >
              Odds & Movement
            </TabsTrigger>
            <TabsTrigger
              value="MATCH_EVENTS"
              className="font-heading uppercase tracking-widest pb-4 pt-0 px-0 text-sm bg-transparent data-[state=active]:bg-transparent text-muted-foreground hover:text-foreground data-[state=active]:text-primary after:bg-primary"
            >
              Match Events
            </TabsTrigger>
          </TabsList>

          <TabsContent value="MARKETS" className="mt-8 border-none p-0 outline-none">
            {fixture._count?.markets === 0 ? (
              <div className="border border-border p-8 text-center bg-card rounded-sm">
                <span className="font-mono text-sm text-muted-foreground uppercase tracking-wider">
                  No prediction markets available for this fixture.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {marketGroups.map(({ group, markets }) => (
                  <div key={group} className="flex flex-col gap-4">
                    <h3 className="font-heading text-sm uppercase tracking-widest text-muted-foreground border-b border-border pb-2">
                      {group}
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {markets.map((market: any) => (
                        <MarketCard key={market.id} market={market} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ODDS_MOVEMENT" className="mt-8 border-none p-0 outline-none">
            <OddsMovementChart
              fixtureId={fixture.fixtureId}
              participant1={fixture.participant1}
              participant2={fixture.participant2}
              startTime={fixture.startTime}
            />
          </TabsContent>

          <TabsContent value="MATCH_EVENTS" className="mt-8 border-none p-0 outline-none">
            <MatchEventTimeline
              events={fixture.events ?? []}
              participant1={fixture.participant1}
              participant2={fixture.participant2}
              participant1IsHome={fixture.participant1IsHome}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
