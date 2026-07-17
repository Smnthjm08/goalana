"use client"

import { useState } from "react"

export function CopyButton({ value }: { value: string }) {
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
