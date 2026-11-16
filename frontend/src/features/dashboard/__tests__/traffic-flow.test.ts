import { describe, expect, it } from 'vitest'
import { buildTrafficFlow, flowStages, updateFlowColumns, type FlowRow } from '../lib/traffic-flow'

const rows: FlowRow[] = [
  {
    user_id: 1,
    username: 'alice',
    token_id: 7,
    token_name: 'key',
    node_name: 'a',
    use_group: 'default',
    model_name: 'model',
    channel_id: 9,
    channel_name: 'channel',
    quota: 20,
    token_used: 100,
    count: 2,
  },
  {
    user_id: 2,
    username: 'bob',
    token_id: 8,
    token_name: 'key',
    node_name: 'b',
    use_group: 'default',
    model_name: 'model',
    channel_id: 9,
    channel_name: 'channel',
    quota: 10,
    token_used: 30,
    count: 1,
  },
]

describe('traffic flow', () => {
  it('retains filters for visible columns and clears a stale highlighted link when a column is hidden', () => {
    const selection = [
      { kind: 'user' as const, id: 'alice' },
      { kind: 'group' as const, id: 'default' },
    ]
    expect(updateFlowColumns(['user', 'group', 'model'], selection, { link: { source: 'alice', target: 'default' } }, 'group')).toEqual({
      visible: ['user', 'model'],
      selected: [selection[0]],
      active: undefined,
    })
  })
  it('preserves a highlighted node in a remaining column and refuses to hide the last two columns', () => {
    const active = { node: 'alice' }
    const result = updateFlowColumns(['user', 'group', 'model'], [], active, 'group', 'user')
    expect(result.active).toEqual(active)
    expect(updateFlowColumns(result.visible, [], active, 'user', 'user')).toEqual(result)
    expect(updateFlowColumns(['user', 'group', 'model'], [], active, 'user', 'user').active).toBeUndefined()
  })
  it('uses the dimensions returned for each role and aggregates real values', () => {
    expect(flowStages('user')).toEqual(['token', 'group', 'model'])
    expect(flowStages('admin')).toEqual(['user', 'group', 'model', 'channel'])
    expect(flowStages('root')).toEqual(['user', 'node', 'token', 'group', 'model', 'channel'])
    const graph = buildTrafficFlow(rows, 'user', 'tokens')
    expect(graph.columns[0]).toHaveLength(2)
    expect(graph.columns[1][0].value).toBe(130)
    expect(graph.links.filter((link) => link.target === graph.columns[1][0].id).map((link) => link.value)).toEqual([100, 30])
  })

  it('filters whole paths by identity, including duplicate labels', () => {
    const graph = buildTrafficFlow(rows, 'root', 'requests')
    const selected = graph.columns[2][1]
    const filtered = buildTrafficFlow(rows, 'root', 'requests', [selected])
    expect(filtered.columns[0][0].label).toBe('bob')
    expect(filtered.columns[3][0].value).toBe(1)
    expect(filtered.links).toHaveLength(5)
  })

  it('connects visible columns and preserves overflow totals when merged', () => {
    const options = { visible: ['user', 'model'] as const, limit: 1, overflow: 'aggregate' as const }
    const graph = buildTrafficFlow(rows, 'root', 'tokens', undefined, { ...options, visible: [...options.visible] })
    expect(graph.columns).toHaveLength(2)
    expect(graph.columns[0].map((node) => node.value)).toEqual([100, 30])
    expect(graph.columns[1][0].value).toBe(130)
    const other = graph.columns[0].find((node) => node.other)!
    const filtered = buildTrafficFlow(rows, 'root', 'tokens', [other], { ...options, visible: [...options.visible] })
    expect(filtered.columns[1][0].value).toBe(30)
    const hidden = buildTrafficFlow(rows, 'root', 'tokens', undefined, { ...options, visible: [...options.visible], overflow: 'hide' })
    expect(hidden.columns[1][0].value).toBe(100)
  })

  it('combines alternatives within one column and intersects different columns', () => {
    const graph = buildTrafficFlow(rows, 'root', 'requests')
    const bothUsers = graph.columns[0]
    const nodeB = graph.columns[1].find((node) => node.label === 'b')!
    const filtered = buildTrafficFlow(rows, 'root', 'requests', [...bothUsers, nodeB])
    expect(filtered.columns[0].map((node) => node.label)).toEqual(['bob'])
    expect(filtered.columns[3][0].value).toBe(1)
  })

  it('highlights only paths traversing the selected link', () => {
    const full = buildTrafficFlow(rows, 'root', 'tokens')
    const link = full.links.find((item) => item.source === full.columns[0][1].id)!
    const highlighted = buildTrafficFlow(rows, 'root', 'tokens', [], { active: { link } })
    expect(highlighted.columns[0].map((node) => node.label)).toEqual(['bob'])
    expect(highlighted.columns[3][0].value).toBe(30)
  })
})
