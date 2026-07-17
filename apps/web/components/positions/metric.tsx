/** A labelled value in the stake/payout row. */
export function Metric({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={`font-heading text-base tabular-nums ${accent ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  )
}
