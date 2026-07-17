"use client"

import { Fragment, useState } from "react"
import { GOALANA_PROGRAM_ID, TXORACLE_PROGRAM_ID } from "@workspace/goalana-sdk"
import { Card, CardHeader, CardContent } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@workspace/ui/components/table"
import { formatSol, formatTs, useInspectorData } from "@/hooks/use-inspector-data"
import { FullAddressRow } from "@/components/inspector/full-address-row"
import { AddressLink } from "@/components/inspector/address-link"
import { StatusBadge } from "@/components/inspector/status-badge"
import { MarketDetailRow } from "@/components/inspector/market-detail-row"

export default function InspectorPage() {
  const { data, loading, refreshError } = useInspectorData()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(marketPda: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(marketPda)) {
        next.delete(marketPda)
      } else {
        next.add(marketPda)
      }
      return next
    })
  }

  return (
    <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-2 border-b border-border pb-6">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Protocol Inspector
            </span>
            <Badge
              variant="outline"
              className="border-border bg-input/20 text-[9px] text-muted-foreground uppercase"
            >
              Devnet
            </Badge>
          </div>
          <h1 className="font-heading text-2xl tracking-widest text-foreground uppercase md:text-3xl">
            Goalana On-Chain Explorer
          </h1>
          <p className="max-w-2xl font-mono text-[11px] leading-relaxed text-muted-foreground">
            Every account Goalana touches, read live from the same PDAs and
            program calls the rest of the app uses — nothing here writes to
            the chain. Config, program IDs, TxLINE&apos;s daily scores root,
            and every Market account with its predicate, pools, vault and
            lifecycle transactions.
          </p>
          {refreshError && (
            <span className="font-mono text-[10px] tracking-widest text-destructive uppercase">
              [ {refreshError} ]
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-40 w-full rounded-sm" />
              ))}
            </div>
            <Skeleton className="h-96 w-full rounded-sm" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="rounded-sm">
                <CardHeader className="border-b border-border p-4">
                  <span className="font-heading text-[11px] tracking-widest text-foreground uppercase">
                    Programs
                  </span>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 p-4">
                  <FullAddressRow
                    label="Goalana Program ID"
                    address={GOALANA_PROGRAM_ID.toBase58()}
                  />
                  <FullAddressRow
                    label="TxLINE Oracle Program ID"
                    address={TXORACLE_PROGRAM_ID.toBase58()}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-sm">
                <CardHeader className="flex flex-row items-center justify-between border-b border-border p-4">
                  <span className="font-heading text-[11px] tracking-widest text-foreground uppercase">
                    Protocol Config
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] ${
                      data?.config
                        ? "border-primary/20 bg-primary/5 text-primary"
                        : "border-destructive/20 bg-destructive/5 text-destructive"
                    }`}
                  >
                    {data?.config ? "Initialized" : "Not Found"}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 p-4">
                  <FullAddressRow
                    label="Config PDA"
                    address={data?.configPda ?? "…"}
                    sublabel='seeds: ["config"]'
                  />
                  {data?.config && (
                    <>
                      <FullAddressRow
                        label="Authority"
                        address={data.config.authority}
                      />
                      <FullAddressRow
                        label="Market Authority"
                        address={data.config.marketAuthority}
                      />
                      <FullAddressRow
                        label="Settlement Authority"
                        address={data.config.settlementAuthority}
                        sublabel="reserved — settle_market is permissionless"
                      />
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-sm md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between border-b border-border p-4">
                  <span className="font-heading text-[11px] tracking-widest text-foreground uppercase">
                    Daily Scores Root — Today
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] ${
                      data?.dailyRootPublished
                        ? "border-primary/20 bg-primary/5 text-primary"
                        : "border-border bg-input/20 text-muted-foreground"
                    }`}
                  >
                    {data?.dailyRootPublished
                      ? "Published"
                      : "Not Yet Published"}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 p-4">
                  <FullAddressRow
                    label="Daily Scores Roots PDA"
                    address={data?.dailyRootPda ?? "…"}
                    sublabel={
                      data ? `epoch day ${data.dailyRootEpochDay}` : undefined
                    }
                  />
                  {data?.dailyRootPublished && data.dailyRootOwner && (
                    <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                      <span className="tracking-widest uppercase">Owner</span>
                      <AddressLink address={data.dailyRootOwner} />
                    </div>
                  )}
                  <span className="font-mono text-[9px] leading-relaxed text-muted-foreground">
                    Owned and laid out by TxLINE&apos;s oracle program —
                    Goalana&apos;s settlement CPIs into it as an opaque
                    account and never deserializes it, so &quot;freshness&quot;
                    here is existence: this PDA appears once TxLINE anchors
                    today&apos;s Merkle root.
                  </span>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-sm tracking-widest text-foreground uppercase">
                  Markets ({data?.markets.length ?? 0})
                </h2>
                <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                  source: program.account.market.all()
                </span>
              </div>

              {!data || data.markets.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-sm border border-dashed border-border bg-card px-6 py-12 text-center">
                  <span className="font-heading text-sm tracking-widest text-foreground uppercase">
                    No markets found
                  </span>
                  <p className="max-w-sm font-mono text-[11px] text-muted-foreground">
                    No Market accounts exist yet under this program ID.
                  </p>
                </div>
              ) : (
                <div className="rounded-sm border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Market</TableHead>
                        <TableHead>Predicate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Yes Pool</TableHead>
                        <TableHead className="text-right">No Pool</TableHead>
                        <TableHead className="text-right">Vault</TableHead>
                        <TableHead>Locks At</TableHead>
                        <TableHead>Settle After</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.markets.map((market) => {
                        const isOpen = expanded.has(market.marketPda)
                        return (
                          <Fragment key={market.marketPda}>
                            <TableRow
                              className="cursor-pointer"
                              onClick={() => toggle(market.marketPda)}
                            >
                              <TableCell className="max-w-[200px] truncate font-sans text-foreground">
                                {market.meta?.question ??
                                  `Fixture ${market.fixtureId}`}
                              </TableCell>
                              <TableCell className="font-mono text-[10px] text-muted-foreground">
                                {market.predicateLabel}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={market.status} />
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums">
                                {formatSol(market.totalYes)}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums">
                                {formatSol(market.totalNo)}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums">
                                {formatSol(market.vaultLamports)}
                              </TableCell>
                              <TableCell className="font-mono text-[10px] whitespace-nowrap">
                                {formatTs(market.locksAt)}
                              </TableCell>
                              <TableCell className="font-mono text-[10px] whitespace-nowrap">
                                {formatTs(market.settleAfter)}
                              </TableCell>
                              <TableCell className="font-mono text-[10px] text-muted-foreground">
                                {isOpen ? "−" : "+"}
                              </TableCell>
                            </TableRow>
                            {isOpen && <MarketDetailRow market={market} />}
                          </Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
