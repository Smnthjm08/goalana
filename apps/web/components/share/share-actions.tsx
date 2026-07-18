"use client"

import { useState } from "react"
import { Check, Copy, Share2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

interface ShareActionsProps {
  /** Absolute URL to share — build with getSiteUrl() so it works off-origin too. */
  url: string
  title: string
  text?: string
  className?: string
  /** Compact renders icon-only buttons for embedding inside a card header. */
  compact?: boolean
}

/**
 * Native Web Share API when the browser/OS supports it (mobile, most
 * desktop browsers), falling back to a copy-link affordance everywhere else.
 * Always shows both actions side by side — sharing to an app and copying
 * the raw link are different intents, not one degrading into the other.
 */
export function ShareActions({
  url,
  title,
  text,
  className = "",
  compact = false,
}: ShareActionsProps) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url })
      } catch {
        // AbortError when the user dismisses the native sheet — not an error.
      }
      return
    }
    await handleCopy()
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon-sm" : "sm"}
        onClick={handleShare}
        className="font-heading tracking-widest uppercase"
        aria-label="Share"
      >
        <Share2 />
        {!compact && "Share"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon-sm" : "sm"}
        onClick={handleCopy}
        className="font-heading tracking-widest uppercase"
        aria-label="Copy link"
      >
        {copied ? <Check className="text-primary" /> : <Copy />}
        {!compact && (copied ? "Copied" : "Copy Link")}
      </Button>
    </div>
  )
}
