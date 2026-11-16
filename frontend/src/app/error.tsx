'use client'
import Link from 'next/link'
import { ErrorState } from '@/components/shared/states'

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-border/60 bg-card/75 p-8 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
        <ErrorState error={error} retry={reset} />
        <div className="flex justify-center">
          <Link className="pill-button" href="/">
            Return home
          </Link>
        </div>
      </div>
    </main>
  )
}
