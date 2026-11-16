import { DrawingLogsPage } from '@/features/tasks/drawing-logs-page'
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams,
    query = new URLSearchParams()
  for (const [key, value] of Object.entries(params))
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item)
  return <DrawingLogsPage initialQuery={query.toString()} />
}
