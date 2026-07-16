import { getTeamFlag } from "@/lib/team-flags"
import { cn } from "@workspace/ui/lib/utils"

interface TeamBadgeProps {
  name: string
  className?: string
}

/** Team name with a leading flag emoji when the name maps to a known nation; falls back to plain text otherwise. */
export function TeamBadge({ name, className }: TeamBadgeProps) {
  const flag = getTeamFlag(name)

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      {flag && (
        <span aria-hidden="true" className="shrink-0 leading-none">
          {flag}
        </span>
      )}
      <span className="truncate">{name}</span>
    </span>
  )
}
