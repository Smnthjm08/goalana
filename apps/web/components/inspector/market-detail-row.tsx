import Link from "next/link"
import { TableCell, TableRow } from "@workspace/ui/components/table"
import { formatSol, formatTs, type InspectorMarket } from "@/hooks/use-inspector-data"
import { FullAddressRow } from "@/components/inspector/full-address-row"
import { AddressLink } from "@/components/inspector/address-link"
import { TxLink } from "@/components/inspector/tx-link"

export function MarketDetailRow({ market }: { market: InspectorMarket }) {
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
