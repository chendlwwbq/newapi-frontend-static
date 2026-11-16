import { KeysPage } from '@/features/tokens/keys-page'

export default async function Page({ searchParams }: { searchParams: Promise<{ create?: string; group?: string }> }) {
  const params = await searchParams
  const create = params.create === '1'
  return <KeysPage key={create ? `create:${params.group || ''}` : 'list'} create={create} group={create ? params.group : undefined} />
}
