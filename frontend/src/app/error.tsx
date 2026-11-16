'use client'
import { ErrorState } from '@/components/shared/states'

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="page-container">
      <ErrorState error={error} retry={reset} />
    </main>
  )
}
