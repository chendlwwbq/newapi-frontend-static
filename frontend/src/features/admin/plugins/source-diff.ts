import { diffLines } from 'diff'

export interface SourceDiffBlock {
  kind: 'same' | 'added' | 'removed'
  lines: string[]
  beforeLine: number
  afterLine: number
}
export function comparePluginSources(before: string, after: string): SourceDiffBlock[] {
  let beforeLine = 1,
    afterLine = 1
  return diffLines(before, after).map((change) => {
    const lines = change.value.match(/[^\n]*\n|[^\n]+$/g) || []
    let kind: SourceDiffBlock['kind'] = 'same'
    if (change.added) kind = 'added'
    if (change.removed) kind = 'removed'
    const block = { kind, lines, beforeLine, afterLine }
    if (!change.added) beforeLine += lines.length
    if (!change.removed) afterLine += lines.length
    return block
  })
}
