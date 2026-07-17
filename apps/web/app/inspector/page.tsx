"use client"

import { Fragment, useEffect, useState } from "react"
import Link from "next/link"
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js"
import {
  GOALANA_PROGRAM_ID,
  TXORACLE_PROGRAM_ID,
  TXLINE_STAT_LABELS,
  getConfigPda,
  getVaultPda,
  getDailyScoresRootsPda,
} from "@workspace/goalana-sdk"
import axiosInstance from "@/lib/axios-instance"
import { explorerTxUrl, explorerAddressUrl } from "@/lib/solana-explorer"
import { formatDate, formatTimeWithZone } from "@/lib/time"
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
import { useGoalanaProgram } from "@/hooks/use-goalana-program"
import { decodeStatus, type OnChainMarketStatus } from "@/hooks/use-market-account"

// This page never signs or sends a transaction — it is a read-only view over
// the same PDAs and account fetches the rest of the app already uses
// (useGoalanaProgram, the SDK's PDA helpers, /api/markets). No new protocol
// or DB surface is introduced.
const POLL_INTERVAL_MS = 15_000

interface DbMarketMeta {
  marketPda: string
  marketType: string
  question: string
  creationTx: string | null
  lockTx: string | null
  settlementTx: string | null
  fixture: {
    fixtureId: string
    competition: string
    participant1: string
    participant2: string
  }
}

interface InspectorMarket {
  marketPda: string
  vaultPda: string
  createdBy: string
  origin: string
  fixtureId: string
  predicateHash: string
  predicateLabel: string
  status: OnChainMarketStatus
  outcome: boolean | null
  createdAt: number
  locksAt: number
  settleAfter: number
  lockedAt: number | null
  settledAt: number | null
  cancelledAt: number | null
  totalYes: bigint
  totalNo: bigint
  vaultLamports: number | null
  meta: DbMarketMeta | null
}

interface ProtocolConfigView {
  authority: string
  marketAuthority: string
  settlementAuthority: string
  bump: number
}

interface InspectorData {
  configPda: string
  config: ProtocolConfigView | null
  dailyRootPda: string
  dailyRootEpochDay: number
  dailyRootPublished: boolean
  dailyRootOwner: string | null
  dailyRootLamports: number | null
  markets: InspectorMarket[]
}

function statLabel(key: number): string {
  return TXLINE_STAT_LABELS[key] ?? `Stat #${key}`
}

// Mirrors goalana_program's Predicate struct byte-for-byte (see
// packages/goalana-sdk/src/pdas.ts docs): stat A, optional stat B + op,
// threshold, comparison — decoded here into the string a judge can read
// without knowing the on-chain layout.
function formatPredicate(predicate: {
  statAKey: number
  statBKey: number | null
  op: Record<string, unknown> | null
  threshold: number
  comparison: Record<string, unknown>
}): string {
  let expr = statLabel(predicate.statAKey)
  if (predicate.statBKey !== null && predicate.op) {
    const symbol = "add" in predicate.op ? "+" : "−"
    expr = `${expr} ${symbol} ${statLabel(predicate.statBKey)}`
  }
  const cmp =
    "greaterThan" in predicate.comparison
      ? ">"
      : "lessThan" in predicate.comparison
        ? "<"
        : "="
  return `${expr} ${cmp} ${predicate.threshold}`
}

function decodeOrigin(raw: Record<string, unknown>): string {
  const key = Object.keys(raw)[0] ?? "house"
  return key.charAt(0).toUpperCase() + key.slice(1)
}

function formatSol(lamports: bigint | number | null | undefined): string {
  if (lamports === null || lamports === undefined) return "…"
  return (Number(lamports) / LAMPORTS_PER_SOL).toFixed(4)
}

function formatTs(unixSeconds: number | null): string {
  if (unixSeconds === null) return "—"
  const ms = unixSeconds * 1000
  return `${formatDate(ms)} · ${formatTimeWithZone(ms)}`
}

async function loadInspectorData(
  program: ReturnType<typeof useGoalanaProgram>["program"]
): Promise<InspectorData> {
  const connection = program.provider.connection
  const now = Date.now()
  const [configPda] = getConfigPda()
  const [dailyRootPda] = getDailyScoresRootsPda(now)
  const dailyRootEpochDay = Math.floor(now / 86_400_000)

  const [configAccount, marketEntries, dbMarkets, dailyRootInfo] =
    await Promise.all([
      program.account.protocolConfig.fetch(configPda).catch(() => null),
      program.account.market.all(),
      axiosInstance
        .get("/markets")
        .then((res) => (res.data?.data ?? []) as DbMarketMeta[])
        .catch(() => [] as DbMarketMeta[]),
      connection.getAccountInfo(dailyRootPda).catch(() => null),
    ])

  const dbByPda = new Map(dbMarkets.map((m) => [m.marketPda, m]))

  const vaultPdas = marketEntries.map(
    (entry) => getVaultPda(entry.publicKey)[0]
  )
  const vaultInfos = vaultPdas.length
    ? await connection
        .getMultipleAccountsInfo(vaultPdas)
        .catch(() => vaultPdas.map(() => null))
    : []

  const markets: InspectorMarket[] = marketEntries.map((entry, i) => {
    // Anchor decodes the IDL's fixed-shape enums/structs into plain objects
    // ({ open: {} }, { house: {} }, ...) — cast once here rather than at
    // every call site.
    const account = entry.account as unknown as Record<string, any>
    const marketPda = entry.publicKey.toBase58()
    const predicate = account.predicate as {
      statAKey: number
      statBKey: number | null
      op: Record<string, unknown> | null
      threshold: number
      comparison: Record<string, unknown>
    }

    return {
      marketPda,
      vaultPda: vaultPdas[i]!.toBase58(),
      createdBy: (account.createdBy as PublicKey).toBase58(),
      origin: decodeOrigin(account.origin as Record<string, unknown>),
      fixtureId: account.fixtureId.toString(),
      predicateHash: Buffer.from(account.predicateHash as number[]).toString(
        "hex"
      ),
      predicateLabel: formatPredicate(predicate),
      status: decodeStatus(account.status as Record<string, unknown>),
      outcome: (account.outcome as boolean | null) ?? null,
      createdAt: Number(account.createdAt),
      locksAt: Number(account.locksAt),
      settleAfter: Number(account.settleAfter),
      lockedAt: account.lockedAt !== null ? Number(account.lockedAt) : null,
      settledAt: account.settledAt !== null ? Number(account.settledAt) : null,
      cancelledAt:
        account.cancelledAt !== null ? Number(account.cancelledAt) : null,
      totalYes: BigInt(account.totalYes.toString()),
      totalNo: BigInt(account.totalNo.toString()),
      vaultLamports: vaultInfos[i]?.lamports ?? null,
      meta: dbByPda.get(marketPda) ?? null,
    }
  })

  // Actionable markets first (Open, then Locked), then history — matches the
  // ranking convention used on /positions.
  const statusRank: Record<OnChainMarketStatus, number> = {
    Open: 0,
    Locked: 1,
    Settled: 2,
    Cancelled: 3,
  }
  markets.sort((a, b) => {
    if (statusRank[a.status] !== statusRank[b.status]) {
      return statusRank[a.status] - statusRank[b.status]
    }
    return b.locksAt - a.locksAt
  })

  return {
    configPda: configPda.toBase58(),
    config: configAccount
      ? {
          authority: (configAccount.authority as PublicKey).toBase58(),
          marketAuthority: (
            configAccount.marketAuthority as PublicKey
          ).toBase58(),
          settlementAuthority: (
            configAccount.settlementAuthority as PublicKey
          ).toBase58(),
          bump: configAccount.bump as number,
        }
      : null,
    dailyRootPda: dailyRootPda.toBase58(),
    dailyRootEpochDay,
    dailyRootPublished: dailyRootInfo !== null,
    dailyRootOwner: dailyRootInfo?.owner.toBase58() ?? null,
    dailyRootLamports: dailyRootInfo?.lamports ?? null,
    markets,
  }
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      className="shrink-0 font-mono text-[9px] text-muted-foreground uppercase transition-colors hover:text-primary"
      aria-label="Copy to clipboard"
    >
      {copied ? "copied" : "copy"}
    </button>
  )
}

/** Full address/PDA display for the protocol-overview cards — never truncated, always linked + copyable. */
function FullAddressRow({
  label,
  address,
  sublabel,
}: {
  label: string
  address: string
  sublabel?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          {label}
        </span>
        {sublabel && (
          <span className="font-mono text-[9px] text-muted-foreground/60">
            {sublabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <a
          href={explorerAddressUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground underline decoration-border underline-offset-2 transition-colors hover:text-primary"
        >
          {address}
        </a>
        <CopyButton value={address} />
      </div>
    </div>
  )
}

/** Compact truncated address for dense table cells — still linked + copyable. */
function AddressLink({ address }: { address: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
      <a
        href={explorerAddressUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        title={address}
        className="underline decoration-border underline-offset-2 transition-colors hover:text-primary"
      >
        {address.slice(0, 4)}…{address.slice(-4)} ↗
      </a>
      <CopyButton value={address} />
    </span>
  )
}

function TxLink({
  label,
  signature,
}: {
  label: string
  signature: string | null | undefined
}) {
  if (!signature) {
    return (
      <span className="font-mono text-[10px] text-muted-foreground/50">
        {label}: —
      </span>
    )
  }
  return (
    <a
      href={explorerTxUrl(signature)}
      target="_blank"
      rel="noopener noreferrer"
      className="block truncate font-mono text-[10px] text-muted-foreground underline decoration-border underline-offset-2 transition-colors hover:text-primary"
    >
      {label}: {signature.slice(0, 8)}…{signature.slice(-8)} ↗
    </a>
  )
}

const STATUS_STYLES: Record<OnChainMarketStatus, string> = {
  Open: "border-primary/20 bg-primary/5 text-primary",
  Locked: "border-amber-500/20 bg-amber-500/5 text-amber-500",
  Settled: "border-border bg-input/20 text-foreground",
  Cancelled: "border-destructive/20 bg-destructive/5 text-destructive",
}

function StatusBadge({ status }: { status: OnChainMarketStatus }) {
  return (
    <Badge variant="outline" className={`text-[9px] ${STATUS_STYLES[status]}`}>
      {status}
    </Badge>
  )
}

function MarketDetailRow({ market }: { market: InspectorMarket }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={9} className="bg-card/50 p-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <FullAddressRow
            label="Market PDA"
            address={market.marketPda}
            sublabel={`seeds: market, ${market.fixtureId}, predicate_hash`}
          />
          <FullAddressRow
            label="Vault PDA"
            address={market.vaultPda}
            sublabel={`balance ${formatSol(market.vaultLamports)} SOL`}
          />
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Created By ({market.origin})
            </span>
            <AddressLink address={market.createdBy} />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Predicate Hash
            </span>
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {market.predicateHash}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Outcome
            </span>
            <span className="font-mono text-[11px] text-foreground">
              {market.outcome === null
                ? "Undecided"
                : market.outcome
                  ? "YES"
                  : "NO"}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Created At
            </span>
            <span className="font-mono text-[11px] text-foreground">
              {formatTs(market.createdAt)}
            </span>
          </div>

          {market.meta?.fixture && (
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Fixture
              </span>
              <Link
                href={`/fixtures/${market.meta.fixture.fixtureId}`}
                className="w-fit font-mono text-[11px] text-foreground underline decoration-border underline-offset-2 transition-colors hover:text-primary"
              >
                {market.meta.fixture.participant1} vs{" "}
                {market.meta.fixture.participant2} ↗
              </Link>
            </div>
          )}

          <div className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-3">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Lifecycle Transactions
            </span>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              <TxLink label="Create" signature={market.meta?.creationTx} />
              <TxLink label="Lock" signature={market.meta?.lockTx} />
              <TxLink
                label="Settle"
                signature={market.meta?.settlementTx}
              />
            </div>
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function InspectorPage() {
  const { program } = useGoalanaProgram()
  const [data, setData] = useState<InspectorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    const fetchAll = () =>
      loadInspectorData(program)
        .then((next) => {
          if (cancelled) return
          setData(next)
          setRefreshError(null)
        })
        .catch((err) => {
          if (cancelled) return
          console.error("Inspector: failed to load protocol state", err)
          setRefreshError("Live refresh failed — showing last known state")
        })

    fetchAll().finally(() => {
      if (!cancelled) setLoading(false)
    })

    const intervalId = setInterval(() => void fetchAll(), POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [program])

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
