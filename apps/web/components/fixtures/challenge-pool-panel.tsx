"use client"

// ─── Challenge Pool proposal panel (final-features.md #1) ────────────────────
// Lets any connected wallet propose a fixed-stake N-vs-N pool on a validated
// stat (goals / corners / cards). Submitting creates a PENDING request; the
// house approves it out-of-band (signs the same authority-gated create_market),
// at which point it appears as a live Challenge Pool market card. This panel
// also lists the fixture's existing requests so proposers can see review state.

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { useNow } from "@/hooks/use-now"
import axiosInstance from "@/lib/axios-instance"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Plus } from "lucide-react"

const STAT_OPTIONS = [
  { value: "GOALS", label: "Total goals" },
  { value: "CORNERS", label: "Total corners" },
  { value: "CARDS", label: "Total yellow cards" },
] as const

const FORMAT_OPTIONS = [
  { slots: 1, label: "1v1" },
  { slots: 2, label: "2v2" },
  { slots: 4, label: "4v4" },
] as const

type ChallengeRequest = {
  id: string
  question: string
  requesterWallet: string
  fixedStakeLamports: string
  slotsPerSide: number
  status: string
  marketPda: string | null
  reviewNote: string | null
}

const LAMPORTS_PER_SOL = 1_000_000_000

function shortWallet(w: string) {
  return `${w.slice(0, 4)}…${w.slice(-4)}`
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "text-amber-500",
  APPROVED: "text-lime-500",
  REJECTED: "text-red-500",
}

export function ChallengePoolPanel({
  fixtureId,
  startTime,
  isFinal,
}: {
  fixtureId: string | number | bigint
  startTime: string | number
  isFinal: boolean
}) {
  const { publicKey } = useWallet()
  const { setVisible } = useWalletModal()

  // Client-only clock (null on first render) keeps this render pure + SSR-safe.
  const now = useNow(30_000)
  const matchStarted = isFinal || (now !== null && Number(startTime) <= now)

  const [open, setOpen] = useState(false)
  const [stat, setStat] =
    useState<(typeof STAT_OPTIONS)[number]["value"]>("CORNERS")
  const [threshold, setThreshold] = useState("9")
  const [slotsPerSide, setSlotsPerSide] = useState(1)
  const [stakeSol, setStakeSol] = useState("0.1")
  const [submitting, setSubmitting] = useState(false)

  const [requests, setRequests] = useState<ChallengeRequest[]>([])
  const [loading, setLoading] = useState(true)

  async function loadRequests() {
    try {
      const { data } = await axiosInstance.get(
        `/market-requests?fixtureId=${fixtureId}`
      )
      setRequests(data?.requests ?? [])
    } catch {
      // Non-fatal — the propose form still works if the list can't load.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Fetch-on-mount: setState only fires after the await resolves, not
    // synchronously in the effect body (matches the repo's polling components).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId])

  async function handleSubmit() {
    if (!publicKey) {
      setVisible(true)
      return
    }

    const parsedThreshold = Number(threshold)
    const parsedStake = Number(stakeSol)
    if (!Number.isInteger(parsedThreshold) || parsedThreshold < 0) {
      toast.error("Threshold must be a whole number (e.g. 9 ⇒ over 9.5)")
      return
    }
    if (!Number.isFinite(parsedStake) || parsedStake <= 0) {
      toast.error("Enter a valid fixed stake in SOL")
      return
    }

    setSubmitting(true)
    const toastId = toast.loading("Submitting challenge pool request…")
    try {
      await axiosInstance.post("/market-requests", {
        fixtureId: String(fixtureId),
        requesterWallet: publicKey.toBase58(),
        stat,
        threshold: parsedThreshold,
        fixedStakeSol: parsedStake,
        slotsPerSide,
      })
      toast.success("Challenge pool requested", {
        id: toastId,
        description: "The house will review it before it goes live on-chain.",
      })
      setOpen(false)
      await loadRequests()
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Request failed"
      toast.error("Could not submit", { id: toastId, description: message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="rounded-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border p-5">
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-base tracking-wide">
            Challenge Pools
          </h3>
          <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
            Design your own fixed-stake, N-vs-N bet on a real match statistic.
            Everyone stakes the same amount; winners split the pool. The house
            co-signs the exact same on-chain{" "}
            <span className="text-foreground">create_market</span> the protocol
            uses — it never decides the outcome, cryptography does.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              disabled={matchStarted}
              className="shrink-0 gap-1.5 font-heading text-[11px] tracking-widest uppercase"
            >
              <Plus className="size-3.5" />
              Create Pool
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Propose a Challenge Pool</DialogTitle>
              <DialogDescription>
                Design your own fixed-stake, {slotsPerSide}v{slotsPerSide} bet
                on a real match statistic.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] text-muted-foreground uppercase">
                  Statistic
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {STAT_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      variant={stat === opt.value ? "default" : "outline"}
                      onClick={() => setStat(opt.value)}
                      className="h-auto rounded-sm py-2 font-mono text-[11px]"
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] text-muted-foreground uppercase">
                    Over line (whole number)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="font-mono"
                  />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {threshold ? `Settles YES if total > ${threshold}.5` : ""}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] text-muted-foreground uppercase">
                    Fixed stake (SOL)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stakeSol}
                    onChange={(e) => setStakeSol(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] text-muted-foreground uppercase">
                  Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {FORMAT_OPTIONS.map((opt) => (
                    <Button
                      key={opt.slots}
                      variant={
                        slotsPerSide === opt.slots ? "default" : "outline"
                      }
                      onClick={() => setSlotsPerSide(opt.slots)}
                      className="h-auto rounded-sm py-2 font-mono text-[11px]"
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="font-heading tracking-widest uppercase"
              >
                {submitting ? (
                  <Spinner className="size-3.5" />
                ) : publicKey ? (
                  "Request Pool"
                ) : (
                  "Connect Wallet"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-5">
        {matchStarted && (
          <p className="font-mono text-[11px] text-muted-foreground">
            This match has kicked off — new pools can only be proposed before
            kickoff.
          </p>
        )}

        {/* Existing requests for this fixture */}
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Community requests
          </span>
          {loading ? (
            <Spinner className="size-3.5" />
          ) : requests.length === 0 ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              No pools proposed yet — be the first.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-sm border border-border p-2.5"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-[11px] text-foreground">
                      {r.question}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {r.slotsPerSide}v{r.slotsPerSide} ·{" "}
                      {Number(r.fixedStakeLamports) / LAMPORTS_PER_SOL} SOL · by{" "}
                      {shortWallet(r.requesterWallet)}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-[10px] font-bold uppercase ${
                      STATUS_STYLES[r.status] ?? "text-muted-foreground"
                    }`}
                  >
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
