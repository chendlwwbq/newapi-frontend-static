import type { Metadata } from 'next'
import { publicModuleApi } from '@/lib/api/server'
import type { Catalog } from '@/lib/api/types'
import { CatalogPage } from '@/features/catalog/catalog-page'
export const metadata: Metadata = { title: '模型广场' }
export default async function Page() {
  const initial = await publicModuleApi<Catalog>('/api/catalog/models?currency=CNY')
  return <CatalogPage initial={initial} />
}
