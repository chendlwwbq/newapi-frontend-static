'use client'
import { useEffect, useState } from 'react'
import { initialTaskFilters, readTaskLink, taskLink, type TaskFilters } from './task-filters'

export function useTaskFilters(initialQuery: string, userId: number, admin: boolean) {
  const [page, setPage] = useState(1),
    [size, setSize] = useState(20),
    [scope, setScope] = useState('self')
  const [draft, setDraft] = useState(initialTaskFilters),
    [filter, setFilter] = useState(draft),
    [error, setError] = useState(''),
    [restored, setRestored] = useState<string | null>(null)
  useEffect(() => {
    const link = readTaskLink(initialQuery)
    setDraft(link.filters)
    setFilter(link.filters)
    setPage(link.page)
    setSize(link.size)
    setScope(admin && link.scope === 'all' ? 'all' : 'self')
    setError('')
    setRestored(initialQuery)
  }, [initialQuery, userId, admin])
  useEffect(() => {
    function restore() {
      const link = readTaskLink(window.location.search)
      setDraft(link.filters)
      setFilter(link.filters)
      setPage(link.page)
      setSize(link.size)
      setScope(admin && link.scope === 'all' ? 'all' : 'self')
      setError('')
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [admin])
  function navigate(filters: TaskFilters, nextPage: number, nextSize: number, nextAll: boolean) {
    const query = taskLink(filters, nextPage, nextSize, nextAll)
    window.history.pushState(null, '', `${window.location.pathname}?${query}${window.location.hash}`)
    setDraft(filters)
    setFilter(filters)
    setPage(nextPage)
    setSize(nextSize)
    setScope(nextAll ? 'all' : 'self')
    setError('')
  }
  return { page, size, scope, draft, setDraft, filter, error, setError, restored: restored === initialQuery, navigate }
}
