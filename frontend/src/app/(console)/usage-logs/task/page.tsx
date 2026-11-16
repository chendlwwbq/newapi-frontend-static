import { TasksPage } from '@/features/tasks/tasks-page'
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams,
    query = new URLSearchParams()
  for (const [key, value] of Object.entries(params))
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item)
  return <TasksPage initialQuery={query.toString()} />
}
