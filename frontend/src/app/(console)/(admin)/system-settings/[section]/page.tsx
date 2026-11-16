import { notFound } from 'next/navigation'
import { SystemSettings } from '@/features/admin/system-settings'
import { settingsSections } from '@/features/admin/settings-schema'
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  if (!Object.hasOwn(settingsSections, section)) notFound()
  return <SystemSettings section={section} />
}
