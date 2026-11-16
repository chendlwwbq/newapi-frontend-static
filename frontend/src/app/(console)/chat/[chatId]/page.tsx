import { ChatClients } from '@/features/chat/chat-clients'
export default async function Page({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params
  return <ChatClients selectedId={chatId} />
}
