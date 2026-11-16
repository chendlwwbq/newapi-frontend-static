import { describe, expect, it } from 'vitest'
import { runMetadataBatch } from './metadata-batch'
import { parsePrefillImport, planPrefillImport, portablePrefill } from './prefill-transfer'

describe('metadata batch partial results', () => {
  it('retains successful writes when another record fails and only retries failed records', async () => {
    const written: number[] = []
    const first = await runMetadataBatch(
      [1, 2, 3],
      async (id) => {
        if (id === 2) throw new Error('rejected')
        written.push(id)
      },
      new AbortController().signal
    )
    expect(written.sort()).toEqual([1, 3])
    expect(first.find((result) => result.item === 2)?.error).toBe('rejected')
    await runMetadataBatch(
      first.filter((result) => result.error).map((result) => result.item),
      async (id) => {
        written.push(id)
      },
      new AbortController().signal
    )
    expect(written).toEqual([1, 3, 2])
  })
  it('does not start new writes after leaving an aborted operation', async () => {
    const controller = new AbortController()
    controller.abort()
    let count = 0
    expect(
      await runMetadataBatch(
        [1, 2],
        async () => {
          count++
        },
        controller.signal
      )
    ).toEqual([])
    expect(count).toBe(0)
  })
})
describe('portable prefill import', () => {
  it('round trips all three native item types without database ids or timestamps', () => {
    const groups = [
      { id: 4, name: 'Models', type: 'model' as const, items: ['a', 'b'], created_time: 123 },
      { id: 5, name: 'Tags', type: 'tag' as const, items: ['one'] },
      { id: 6, name: 'Endpoints', type: 'endpoint' as const, items: { chat: { path: '/v1/chat/completions', method: 'POST' } } },
    ]
    const portable = groups.map(portablePrefill)
    expect(parsePrefillImport(JSON.stringify({ version: 1, groups: portable }))).toEqual(portable)
    expect(JSON.stringify(portable)).not.toContain('created_time')
    expect(portable[0]).not.toHaveProperty('id')
  })
  it('normalizes string arrays and legacy text while retaining endpoint JSON', () => {
    expect(
      parsePrefillImport(
        JSON.stringify([
          { name: ' Models ', type: 'model', items: ' a, b\na' },
          { name: 'Endpoints', type: 'endpoint', items: '{"chat":"/v1/chat/completions"}' },
        ])
      )
    ).toEqual([
      { name: 'Models', type: 'model', items: ['a', 'b'] },
      { name: 'Endpoints', type: 'endpoint', items: { chat: '/v1/chat/completions' } },
    ])
  })
  it.each([
    { version: 2, groups: [] },
    [
      { name: 'same', type: 'model', items: [] },
      { name: 'same', type: 'tag', items: [] },
    ],
    [{ name: 'invalid', type: 'script', items: [] }],
    [{ name: 'invalid', type: 'model', items: [3] }],
    [{ name: 'invalid', type: 'endpoint', items: null }],
  ])('rejects invalid bundles before any mutation: %j', (value) => {
    expect(() => parsePrefillImport(JSON.stringify(value))).toThrow()
  })
  it('defaults to skipping existing names and requires explicit replacement intent', () => {
    const existing = [{ id: 9, name: 'Existing', type: 'model' as const, items: ['old'] }],
      groups = [
        { name: 'Existing', type: 'model' as const, items: ['new'] },
        { name: 'New', type: 'tag' as const, items: ['tag'] },
      ]
    expect(planPrefillImport(groups, existing, false).map((entry) => entry.action)).toEqual(['skip', 'create'])
    const replaced = planPrefillImport(groups, existing, true)
    expect(replaced.map((entry) => entry.action)).toEqual(['update', 'create'])
    expect(replaced[0].existing?.id).toBe(9)
  })
})
