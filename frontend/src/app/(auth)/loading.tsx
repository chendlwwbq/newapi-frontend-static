export default function AuthLoading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12" role="status" aria-busy="true">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="space-y-2">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded-md bg-muted/70" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-20 animate-pulse rounded bg-muted/80" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted/80" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  )
}
