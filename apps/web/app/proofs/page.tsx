"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, RefreshCw, ShieldCheck } from "lucide-react"
import axiosInstance from "@/lib/axios-instance"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Button } from "@workspace/ui/components/button"
import { TeamBadge } from "@/components/team-badge"
import { marketTypeLabels } from "@/lib/market-groups"
import { explorerAddressUrl } from "@/lib/solana-explorer"
import { TXLINE_ORACLE_PROGRAM_ID } from "@/lib/protocol"
import {
  SettlementProofReceipt,
  type SettlementProof,
} from "@/components/fixtures/settlement-proof-receipt"

interface SettledMarket {
  id: string
  mode: "settled" | "preview"
  marketPda: string | null
  marketType: string | null
  question: string
  settlementTx: string | null
  settledAt: string | null
  oracleTsMs: string | null
  settlementProof: SettlementProof
  fixture: {
    fixtureId: string
    competition: string
    participant1: string
    participant2: string
    participant1IsHome: boolean
    startTime: string
    homeScore: number | null
    awayScore: number | null
  }
}

interface FixtureGroup {
  fixtureId: string
  competition: string
  participant1: string
  participant2: string
  homeScore: number | null
  awayScore: number | null
  markets: SettledMarket[]
}

function groupByFixture(markets: SettledMarket[]): FixtureGroup[] {
  const byFixture = new Map<string, FixtureGroup>()

  for (const market of markets) {
    const f = market.fixture
    let group = byFixture.get(f.fixtureId)
    if (!group) {
      group = {
        fixtureId: f.fixtureId,
        competition: f.competition,
        participant1: f.participant1IsHome ? f.participant1 : f.participant2,
        participant2: f.participant1IsHome ? f.participant2 : f.participant1,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
        markets: [],
      }
      byFixture.set(f.fixtureId, group)
    }
    group.markets.push(market)
  }

  // Most-recently-settled fixture first — the API already orders markets by
  // settledAt desc, so the first market seen per fixture sets its rank.
  return Array.from(byFixture.values())
}

export default function ProofGalleryPage() {
  const [markets, setMarkets] = useState<SettledMarket[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  function fetchSettlements() {
    setError(null)
    setMarkets(null)
    axiosInstance
      .get("/settlements")
      .then((res) => {
        setMarkets(res.data?.data ?? [])
      })
      .catch((err) => {
        console.error(err)
        setError("Could not load settlement proofs. Try again shortly.")
      })
  }

  useEffect(() => {
    fetchSettlements()
  }, [])

  const groups = useMemo(
    () => (markets ? groupByFixture(markets) : []),
    [markets]
  )

  return (
    <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        {/* Page Header */}
        <div className="flex flex-col gap-3 border-b border-border pb-6">
          <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
            <ShieldCheck className="size-3.5 text-primary" />
            No wallet needed
          </span>
          <h1 className="font-heading text-3xl font-black tracking-widest text-foreground uppercase md:text-4xl">
            Settlement Proof Gallery
          </h1>
          <p className="max-w-2xl font-mono text-[11px] leading-relaxed text-muted-foreground">
            Every market below resolved the same way: Goalana&apos;s{" "}
            <span className="text-foreground">settle_market</span> instruction
            made a Cross-Program Invocation into TxLINE&apos;s oracle program
            (
            <a
              href={explorerAddressUrl(TXLINE_ORACLE_PROGRAM_ID)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              validate_stat
            </a>
            ), which re-derives a three-stage Merkle proof on-chain from a
            stat leaf up to an already-anchored daily batch root. Goalana
            never asserts the outcome — the oracle program does, in
            consensus, and it reverts if any hash in the chain is wrong. This
            page is a permanent, public record of that: real closed matches,
            real settlement transactions, real proofs — inspectable without
            connecting a wallet.
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center gap-4 rounded-sm border border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
            <AlertCircle className="size-8 text-destructive/60" />
            <div className="flex flex-col gap-1">
              <span className="font-heading text-sm tracking-widest text-destructive uppercase">
                Feed Unavailable
              </span>
              <p className="max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
                {error}
              </p>
            </div>
            <Button
              onClick={fetchSettlements}
              variant="outline"
              className="mt-1 gap-2 font-heading tracking-widest uppercase"
            >
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* Loading State */}
        {!error && markets === null && (
          <div className="flex flex-col gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="h-16 w-full rounded-sm" />
                <Skeleton className="h-40 w-full rounded-sm" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!error && markets !== null && groups.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-sm border border-dashed border-border bg-card px-6 py-16 text-center">
            <ShieldCheck className="size-8 text-muted-foreground/40" />
            <span className="font-heading text-lg tracking-widest text-foreground uppercase">
              No settled markets yet
            </span>
            <p className="max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
              Once a fixture finishes and Goalana&apos;s permissionless{" "}
              <span className="text-foreground">settle_market</span> call
              lands on-chain, its proof will show up here automatically.
            </p>
          </div>
        )}

        {/* Fixture Groups */}
        {!error && groups.length > 0 && (
          <div className="flex flex-col gap-10">
            {groups.map((group) => (
              <div key={group.fixtureId} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 rounded-sm border border-border bg-card px-4 py-3">
                  <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                    {group.competition}
                  </span>
                  <div className="flex items-center gap-3">
                    <TeamBadge
                      name={group.participant1}
                      className="font-sans text-sm font-bold text-foreground"
                    />
                    {group.homeScore != null && group.awayScore != null && (
                      <span className="shrink-0 font-heading text-lg text-foreground">
                        {group.homeScore} – {group.awayScore}
                      </span>
                    )}
                    <TeamBadge
                      name={group.participant2}
                      className="font-sans text-sm font-bold text-foreground"
                    />
                    <span className="ml-auto font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                      {group.markets.length} settled market
                      {group.markets.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-4 pl-1">
                  {group.markets.map((market) => (
                    <div key={market.id} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2 px-1">
                        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                          {market.mode === "settled"
                            ? (marketTypeLabels[market.marketType ?? ""] ?? market.marketType)
                            : "Live TxLINE proof — no Goalana market settled yet"}
                        </span>
                        <span className="font-mono text-[11px] text-foreground">
                          {market.question}
                        </span>
                      </div>
                      <SettlementProofReceipt
                        proof={market.settlementProof}
                        settlementTx={market.settlementTx}
                        marketPda={market.marketPda ?? undefined}
                        mode={market.mode}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
