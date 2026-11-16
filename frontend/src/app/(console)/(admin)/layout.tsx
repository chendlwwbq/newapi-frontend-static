import { AdminGate } from '@/features/admin/shared'
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>
}
