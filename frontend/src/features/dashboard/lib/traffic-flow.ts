export type FlowRole = 'user' | 'admin' | 'root'
export type FlowMetric = 'quota' | 'requests' | 'tokens'
export type FlowKind = 'user' | 'node' | 'token' | 'group' | 'model' | 'channel'

export interface FlowRow {
  user_id?: number
  username?: string
  node_name?: string
  token_id?: number
  token_name?: string
  use_group: string
  model_name: string
  channel_id?: number
  channel_name?: string
  count: number
  quota: number
  token_used: number
}

export interface FlowNode {
  id: string
  label: string
  kind: FlowKind
  value: number
  other?: boolean
}
export interface FlowLink {
  source: string
  target: string
  value: number
}
export type FlowSelection = Pick<FlowNode, 'id' | 'kind'>
export type FlowActive = { node?: string; link?: { source: string; target: string } }

const stages: Record<FlowRole, FlowKind[]> = {
  user: ['token', 'group', 'model'],
  admin: ['user', 'group', 'model', 'channel'],
  root: ['user', 'node', 'token', 'group', 'model', 'channel'],
}

export function flowStages(role: FlowRole) {
  return stages[role]
}

export function updateFlowColumns(
  visible: FlowKind[],
  selected: FlowSelection[],
  active: FlowActive | undefined,
  kind: FlowKind,
  activeNodeKind?: FlowKind
) {
  const hiding = visible.includes(kind)
  if (hiding && visible.length <= 2) return { visible, selected, active }
  return {
    visible: hiding ? visible.filter((item) => item !== kind) : [...visible, kind],
    selected: hiding ? selected.filter((item) => item.kind !== kind) : selected,
    active: active?.link || (hiding && activeNodeKind === kind) ? undefined : active,
  }
}

function pathNode(row: FlowRow, kind: FlowKind): Omit<FlowNode, 'value'> {
  let identity: string | number
  let label: string
  switch (kind) {
    case 'user':
      identity = row.user_id || row.username || 'unknown'
      label = row.username || (row.user_id ? `user-${row.user_id}` : 'Unknown')
      break
    case 'node':
      identity = label = row.node_name || 'default-node'
      break
    case 'token':
      identity = row.token_id || row.token_name || 'unknown'
      label = row.token_name || (row.token_id ? `token-${row.token_id}` : 'Unknown')
      break
    case 'group':
      identity = label = row.use_group || 'Unknown'
      break
    case 'model':
      identity = label = row.model_name || 'Unknown'
      break
    case 'channel':
      identity = row.channel_id || row.channel_name || 'unknown'
      label = row.channel_name || (row.channel_id ? `channel-${row.channel_id}` : 'Unknown')
      break
  }
  return { id: JSON.stringify([kind, identity]), kind, label }
}

const otherLabels: Record<FlowKind, string> = {
  user: 'Other users',
  node: 'Other nodes',
  token: 'Other tokens',
  group: 'Other groups',
  model: 'Other models',
  channel: 'Other channels',
}

export function buildTrafficFlow(
  rows: FlowRow[],
  role: FlowRole,
  metric: FlowMetric,
  selected: FlowSelection[] = [],
  options?: {
    visible?: FlowKind[]
    limit?: number
    overflow?: 'aggregate' | 'hide'
    active?: { node?: string; link?: { source: string; target: string } }
  }
) {
  const stages = flowStages(role).filter((kind) => !options?.visible || options.visible.includes(kind))
  const columns = stages.map(() => new Map<string, FlowNode>())
  const totals = stages.map(() => new Map<string, { node: Omit<FlowNode, 'value'>; value: number }>())
  const valueOf = (row: FlowRow) => (metric === 'tokens' ? row.token_used : metric === 'requests' ? row.count : row.quota)
  if (options?.limit)
    for (const row of rows) {
      stages.forEach((kind, index) => {
        const node = pathNode(row, kind),
          current = totals[index].get(node.id)
        if (current) current.value += valueOf(row)
        else totals[index].set(node.id, { node, value: valueOf(row) })
      })
    }
  const top = totals.map(
    (column) =>
      new Set(
        [...column.values()]
          .sort((a, b) => b.value - a.value || a.node.label.localeCompare(b.node.label) || a.node.id.localeCompare(b.node.id))
          .slice(0, options?.limit)
          .map((item) => item.node.id)
      )
  )
  const links = new Map<string, FlowLink>()
  const selectedKinds = new Set(selected.map((item) => item.kind))
  for (const row of rows) {
    let path = stages.map((kind) => pathNode(row, kind))
    if (options?.limit) {
      if (options.overflow === 'hide' && path.some((node, index) => !top[index].has(node.id))) continue
      path = path.map((node, index) =>
        top[index].has(node.id)
          ? node
          : { id: JSON.stringify([node.kind, null, 'other']), label: otherLabels[node.kind], kind: node.kind, other: true }
      )
    }
    if (
      [...selectedKinds].some(
        (kind) => !path.some((node) => node.kind === kind && selected.some((item) => item.kind === kind && item.id === node.id))
      )
    )
      continue
    if (options?.active?.node && !path.some((node) => node.id === options.active?.node)) continue
    if (
      options?.active?.link &&
      !path.some((node, index) => node.id === options.active?.link?.source && path[index + 1]?.id === options.active?.link?.target)
    )
      continue
    const value = valueOf(row)
    path.forEach((node, index) => {
      const current = columns[index].get(node.id)
      if (current) current.value += value
      else columns[index].set(node.id, { ...node, value })
      if (!index) return
      const source = path[index - 1].id
      const key = JSON.stringify([source, node.id])
      const link = links.get(key)
      if (link) link.value += value
      else links.set(key, { source, target: node.id, value })
    })
  }
  return { columns: columns.map((column) => [...column.values()].sort((a, b) => b.value - a.value)), links: [...links.values()] }
}
