"use client"

import { useEffect, useState } from "react"
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js"
import {
  TXLINE_STAT_LABELS,
  getConfigPda,
  getVaultPda,
  getDailyScoresRootsPda,
} from "@workspace/goalana-sdk"
import axiosInstance from "@/lib/axios-instance"
import { formatDate, formatTimeWithZone } from "@/lib/time"
import { useGoalanaProgram } from "@/hooks/use-goalana-program"
import { decodeStatus, type OnChainMarketStatus } from "@/hooks/use-market-account"

// This page never signs or sends a transaction — it is a read-only view over
// the same PDAs and account fetches the rest of the app already uses
// (useGoalanaProgram, the SDK's PDA helpers, /api/markets). No new protocol
// or DB surface is introduced.
const POLL_INTERVAL_MS = 15_000

export interface DbMarketMeta {
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

export interface InspectorMarket {
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

export interface ProtocolConfigView {
  authority: string
  marketAuthority: string
  settlementAuthority: string
  bump: number
}

export interface InspectorData {
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

export function formatSol(lamports: bigint | number | null | undefined): string {
  if (lamports === null || lamports === undefined) return "…"
  return (Number(lamports) / LAMPORTS_PER_SOL).toFixed(4)
}

export function formatTs(unixSeconds: number | null): string {
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

/** Polls the same PDAs/program calls the rest of the app uses to build a live, read-only protocol snapshot. */
export function useInspectorData() {
  const { program } = useGoalanaProgram()
  const [data, setData] = useState<InspectorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshError, setRefreshError] = useState<string | null>(null)

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

  return { data, loading, refreshError }
}
