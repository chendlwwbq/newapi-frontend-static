/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

export type SystemRelease = { tag_name: string; prerelease: boolean; body?: string | null; published_at?: string | null }
type Version = { core: bigint[]; stage: number; sequence: bigint; revision: bigint }
const stages: Record<string, number> = { alpha: 0, beta: 1, rc: 2, stable: 3, patch: 4 }

export function parseSystemVersion(value?: string | null): Version | null {
  const match = value?.trim().match(/^v?(\d+(?:\.\d+){2,})(?:-(alpha|beta|rc|patch)(?:\.(\d+))?(?:-i18nfix\.(\d+))?)?(?:\+[\da-zA-Z.-]+)?$/)
  if (!match || (match[4] && match[2] !== 'rc')) return null
  const core = match[1].split('.').map((part) => BigInt(part))
  if (core.every((part) => part === 0n)) return null
  return { core, stage: stages[match[2] || 'stable'], sequence: BigInt(match[3] || '0'), revision: BigInt(match[4] || '0') }
}
export function compareSystemVersions(left?: string | null, right?: string | null): -1 | 0 | 1 | null {
  const a = parseSystemVersion(left),
    b = parseSystemVersion(right)
  if (!a || !b) return null
  for (let index = 0; index < Math.max(a.core.length, b.core.length); index++) {
    const l = a.core[index] ?? 0n,
      r = b.core[index] ?? 0n
    if (l !== r) return l < r ? -1 : 1
  }
  if (a.stage !== b.stage) return a.stage < b.stage ? -1 : 1
  if (a.sequence !== b.sequence) return a.sequence < b.sequence ? -1 : 1
  if (a.revision !== b.revision) return a.revision < b.revision ? -1 : 1
  return 0
}
export function selectLatestRelease(payload: unknown): SystemRelease | null {
  if (!Array.isArray(payload)) throw new Error('Unexpected release payload')
  let latest: SystemRelease | null = null,
    valid = payload.length === 0
  for (const item of payload) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.tag_name !== 'string' ||
      typeof item.draft !== 'boolean' ||
      typeof item.prerelease !== 'boolean'
    )
      continue
    valid = true
    const tag = item.tag_name.trim()
    if (item.draft || !parseSystemVersion(tag)) continue
    if (!latest || compareSystemVersions(tag, latest.tag_name) === 1)
      latest = {
        tag_name: tag,
        prerelease: item.prerelease,
        body: typeof item.body === 'string' ? item.body : null,
        published_at: typeof item.published_at === 'string' ? item.published_at : null,
      }
  }
  if (!valid) throw new Error('Unexpected release payload')
  return latest
}
