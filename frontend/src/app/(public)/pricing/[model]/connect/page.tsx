import { ConnectPage } from '@/features/catalog/connect-page'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ model: string }>
  searchParams: Promise<{ group?: string; catalogKey?: string; offering?: string }>
}) {
  const [{ model }, { group, catalogKey, offering }] = await Promise.all([params, searchParams])
  return <ConnectPage model={model} group={group} catalogKey={catalogKey} offeringKey={offering} />
}
