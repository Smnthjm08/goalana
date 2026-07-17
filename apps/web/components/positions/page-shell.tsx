export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="flex flex-col gap-3 border-b border-border pb-4">
          <h1 className="font-heading text-2xl tracking-widest text-primary uppercase">
            My Positions
          </h1>
          <p className="max-w-2xl font-mono text-[11px] leading-relaxed text-muted-foreground">
            Every bet this wallet holds, read straight from its on-chain
            Position accounts — not from Goalana&apos;s database.
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
