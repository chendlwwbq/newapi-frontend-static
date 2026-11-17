'use client'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <main className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="space-y-2">
            <p className="font-mono text-xs text-muted-foreground">status = 500</p>
            <h1 className="text-xl font-semibold">Application Error</h1>
            <p className="text-sm text-muted-foreground">{error.message || 'An unexpected application error occurred.'}</p>
            {error.digest && <code className="block rounded-lg bg-muted px-3 py-1.5 font-mono text-xs">{error.digest}</code>}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Retry
            </button>
            <a
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium"
            >
              Return home
            </a>
          </div>
        </main>
      </body>
    </html>
  )
}
