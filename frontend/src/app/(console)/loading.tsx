export default function ConsoleLoading() {
  return (
    <div className="flex min-h-screen w-full" role="status" aria-busy="true">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card/50 p-4 md:block">
        <div className="mb-6 h-8 w-28 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-2.5">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-9 w-full animate-pulse rounded-xl bg-muted/70" />
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-6">
          <div className="h-5 w-40 animate-pulse rounded-md bg-muted" />
          <div className="flex items-center gap-3">
            <div className="h-9 w-24 animate-pulse rounded-xl bg-muted/70" />
            <div className="size-8 animate-pulse rounded-full bg-muted" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
          <div className="space-y-2">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded-md bg-muted/70" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-2xl border border-border bg-card p-6" />
            ))}
          </div>
          <div className="h-72 w-full animate-pulse rounded-2xl border border-border bg-card" />
        </main>
      </div>
    </div>
  )
}
