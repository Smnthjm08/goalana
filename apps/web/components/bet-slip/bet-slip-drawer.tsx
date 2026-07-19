"use client"

// ─── Bet Slip drawer (final-features.md #2) ──────────────────────────────────
// Floating slip that composes every staged bet into ONE transaction and submits
// it with a SINGLE wallet signature. See bet-slip-context.tsx for why N
// place_bet legs compose safely into one tx.

import { useState } from "react"
import { toast } from "sonner"
import { X, Layers, ChevronDown, ChevronUp } from "lucide-react"
import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js"
import { BN } from "@coral-xyz/anchor"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import {
  getVaultPda,
  getPositionPda,
  getChallengePoolPda,
} from "@workspace/goalana-sdk/pdas"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { explorerTxUrl } from "@/lib/solana-explorer"
import { useGoalanaProgram } from "@/hooks/use-goalana-program"
import {
  useBetSlip,
  MAX_SLIP_LEGS,
} from "@/components/bet-slip/bet-slip-context"

export function BetSlipDrawer() {
  const { items, removeItem, clear, totalLamports } = useBetSlip()
  const { program, provider, connected, publicKey } = useGoalanaProgram()
  const { setVisible } = useWalletModal()
  const [open, setOpen] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [lastSig, setLastSig] = useState<string | null>(null)

  if (items.length === 0) return null

  async function handleSubmit() {
    if (!connected || !publicKey) {
      setVisible(true)
      return
    }

    setSubmitting(true)
    const toastId = toast.loading(
      `Composing ${items.length} bets into one transaction…`
    )

    try {
      // Build one bet instruction per staged market. Challenge-pool legs use the
      // enforced place_challenge_bet (fixed stake + cap checked on-chain); every
      // other leg uses the standard place_bet. All compose into one transaction.
      const instructions = await Promise.all(
        items.map((item) => {
          const marketPubkey = new PublicKey(item.marketPda)
          const [vaultPda] = getVaultPda(marketPubkey)
          const [positionPda] = getPositionPda(marketPubkey, publicKey!)
          const side = item.side === "YES" ? { yes: {} } : { no: {} }

          if (item.fixedStake) {
            return program.methods
              .placeChallengeBet(side)
              .accountsPartial({
                market: marketPubkey,
                challengePool: getChallengePoolPda(marketPubkey)[0],
                vault: vaultPda,
                position: positionPda,
                user: publicKey!,
                systemProgram: SystemProgram.programId,
              })
              .instruction()
          }

          return program.methods
            .placeBet(side, new BN(item.lamports))
            .accountsPartial({
              market: marketPubkey,
              vault: vaultPda,
              position: positionPda,
              user: publicKey!,
              systemProgram: SystemProgram.programId,
            })
            .instruction()
        })
      )

      const tx = new Transaction().add(...instructions)

      // AnchorProvider.sendAndConfirm sets fee payer + blockhash and asks the
      // wallet to sign the whole transaction exactly once.
      const signature = await provider.sendAndConfirm(tx)

      setLastSig(signature)
      toast.success(`Placed ${items.length} bets in one signature`, {
        id: toastId,
        description: `${signature.slice(0, 8)}…${signature.slice(-8)}`,
      })
      clear()
    } catch (err) {
      console.error("bet slip submit failed", err)
      // The slip signs every leg in one atomic transaction — if any
      // challenge-pool leg's side filled up (place_challenge_bet.rs's
      // ChallengePoolSideFull) since it was staged, the WHOLE slip reverts,
      // not just that leg. Say that plainly rather than surfacing the raw
      // AnchorError, since it's a different failure shape than a single bet.
      const rawMessage = err instanceof Error ? err.message : "Transaction failed"
      const sideFull = rawMessage.includes("ChallengePoolSideFull")
      toast.error(sideFull ? "A pool side filled up" : "Bet slip failed", {
        id: toastId,
        description: sideFull
          ? "One of the challenge pools in this slip filled its side after you staged it — the whole slip reverted together. Remove it and resubmit."
          : rawMessage,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 w-[min(92vw,22rem)] overflow-hidden rounded-sm border border-primary/40 bg-card shadow-xl">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 border-b border-border bg-primary/10 px-4 py-2.5 transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex items-center gap-2 font-heading text-sm tracking-wide text-foreground">
          <Layers className="size-4 text-primary" />
          Bet Slip · {items.length}/{MAX_SLIP_LEGS}
        </span>
        {open ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="size-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-3 p-4">
          <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.marketPda}
                className="flex items-center justify-between gap-2 rounded-sm border border-border p-2"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-mono text-[11px] text-foreground">
                    {item.question}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    <span
                      className={item.side === "YES" ? "text-pos" : "text-neg"}
                    >
                      {item.side}
                    </span>{" "}
                    · {(item.lamports / LAMPORTS_PER_SOL).toFixed(3)} SOL
                  </span>
                </div>
                <button
                  onClick={() => removeItem(item.marketPda)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={`Remove ${item.question} from slip`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-border pt-2 font-mono text-[11px]">
            <span className="text-muted-foreground">TOTAL</span>
            <span className="text-foreground">
              {(totalLamports / LAMPORTS_PER_SOL).toFixed(3)} SOL
            </span>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full font-heading tracking-widest uppercase"
          >
            {submitting ? (
              <>
                <Spinner className="size-3.5" />
                Placing…
              </>
            ) : connected ? (
              `Sign once · place ${items.length} bets`
            ) : (
              "Connect wallet"
            )}
          </Button>

          <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <button onClick={clear} className="hover:text-foreground">
              Clear slip
            </button>
            <span>One wallet signature · atomic</span>
          </div>

          {lastSig && (
            <a
              href={explorerTxUrl(lastSig)}
              target="_blank"
              rel="noreferrer"
              className="truncate font-mono text-[10px] text-primary hover:underline"
            >
              Last slip tx: {lastSig.slice(0, 12)}…
            </a>
          )}
        </div>
      )}
    </div>
  )
}
