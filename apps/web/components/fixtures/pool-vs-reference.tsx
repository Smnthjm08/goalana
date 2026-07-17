// Divergence worth flagging with a badge, in percentage points — small drift
// between the pool and TxLINE is normal noise, not a signal.
const IMPLIED_PROBABILITY_DIVERGENCE_THRESHOLD = 3

export function PoolVsReference({
  poolYesPct,
  referenceYesPct,
}: {
  poolYesPct: number
  referenceYesPct: number
}) {
  const delta = poolYesPct - referenceYesPct
  const diverges = Math.abs(delta) >= IMPLIED_PROBABILITY_DIVERGENCE_THRESHOLD

  return (
    <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
      <span>
        POOL IMPLIES {poolYesPct.toFixed(1)}% YES · TXLINE{" "}
        {referenceYesPct.toFixed(1)}%
      </span>
      {diverges && (
        <span className={delta > 0 ? "text-lime-400" : "text-rose-500"}>
          {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}pt
        </span>
      )}
    </div>
  )
}
