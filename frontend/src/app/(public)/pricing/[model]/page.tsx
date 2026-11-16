import { publicModuleApi } from '@/lib/api/server'
import type { Catalog } from '@/lib/api/types'
import { ModelDetail } from '@/features/catalog/model-detail'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ model: string }>
  searchParams?: Promise<{ catalogKey?: string; group?: string; billing?: string; offering?: string }>
}) {
  const [{ model }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({ catalogKey: undefined, group: undefined, billing: undefined, offering: undefined }),
  ])
  const { catalogKey, group } = query
  const catalog = await publicModuleApi<Catalog>('/api/catalog/models?currency=CNY')
  const selected = catalog?.models.find((m) => (catalogKey ? m.model_key === catalogKey : m.configured_model_id === model))
  return (
    <ModelDetail
      initial={selected}
      modelId={catalogKey || model}
      routeModel={model}
      catalogKey={catalogKey}
      initialGroup={group}
      initialOffering={query.offering}
      initialBilling={query.billing === 'request' || query.billing === 'second' ? query.billing : undefined}
    />
  )
}
