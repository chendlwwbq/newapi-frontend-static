export default function AuthLoading() {
  return (
    <div className="auth-stage" role="status" aria-busy="true">
      <div className="grid w-full max-w-[864px] min-h-[664px] grid-cols-1 overflow-hidden rounded-[32px] border border-border bg-card shadow-xl md:grid-cols-[392px_minmax(0,472px)]">
        <div className="hidden flex-col justify-between bg-muted/65 p-9 md:flex">
          <div className="space-y-4">
            <div className="h-10 w-52 animate-pulse rounded-xl bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded-md bg-muted/80" />
          </div>
          <div className="h-44 w-full animate-pulse rounded-2xl bg-muted/80" />
          <div className="space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-muted/80" />
            <div className="h-4 w-36 animate-pulse rounded bg-muted/80" />
          </div>
        </div>
        <div className="flex flex-col justify-center p-6 sm:p-8">
          <div className="mx-auto w-full max-w-[420px] space-y-6">
            <div className="space-y-2">
              <div className="h-8 w-44 animate-pulse rounded-lg bg-muted" />
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
      </div>
    </div>
  )
}
