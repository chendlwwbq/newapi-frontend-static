export default function ConsoleLoading() {
  return (
    <div className="min-h-screen w-full bg-background" role="status" aria-busy="true">
      <aside className="fixed inset-y-0 left-0 hidden w-[224px] flex-col border-r border-border bg-background px-[15px] pt-6 pb-4 min-[901px]:flex">
        <div className="mb-6 px-3">
          <div className="h-7 w-28 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="h-[38px] w-full animate-pulse rounded-[7px] bg-muted/70" />
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col min-[901px]:ml-[224px]">
        <header className="flex h-[63px] items-center justify-between border-b border-border px-8">
          <div className="h-5 w-44 animate-pulse rounded-md bg-muted" />
          <div className="flex items-center gap-3.5">
            <div className="h-8 w-20 animate-pulse rounded-lg bg-muted/70" />
            <div className="size-7 animate-pulse rounded-full bg-muted" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[90rem] px-8 py-6">
          <div className="mb-[27px] space-y-2">
            <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded-md bg-muted/70" />
          </div>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-[118px] animate-pulse rounded-2xl border border-border bg-card p-5" />
            ))}
          </div>
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-11 w-full animate-pulse rounded-xl bg-muted/60" />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
