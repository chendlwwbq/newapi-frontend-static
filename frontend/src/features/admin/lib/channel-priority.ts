export type ChannelPriorityItem = { id: number; priority: number | null }
export type ChannelPriorityChange = { id: number; previous: number | null; priority: number | null }
export type ChannelPriorityOrder = { revision: string; items: ChannelPriorityItem[]; changes: ChannelPriorityChange[] }
export type ChannelPriorityMove = { revision: string; id: number; target_id: number; position: 'before' | 'after' | 'same'; preview: boolean }

export function channelPriorityUndo(order: ChannelPriorityOrder) {
  return {
    revision: order.revision,
    restore: order.changes.map((change) => ({ id: change.id, previous: change.priority, priority: change.previous })),
  }
}
