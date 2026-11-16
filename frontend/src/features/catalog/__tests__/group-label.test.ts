import { readFile } from 'node:fs/promises'
import { createInstance } from 'i18next'
import { expect, it } from 'vitest'
import { catalogGroupLabel } from '../group-label'

it.each([
  ['en', 'Special price', 'Stable'],
  ['zh', '特价版', '稳定版'],
  ['zh-TW', '特價版', '穩定版'],
  ['fr', 'Tarif spécial', 'Stable'],
  ['ja', '特価版', '安定版'],
  ['ru', 'Спецтариф', 'Стабильный'],
  ['vi', 'Giá ưu đãi', 'Ổn định'],
])('localizes the two video groups in %s and preserves other configured group names', async (language, special, stable) => {
  const resource = JSON.parse(await readFile(new URL(`../../../../public/locales/${language}.json`, import.meta.url), 'utf8'))
  const i18n = createInstance()
  await i18n.init({ lng: language, resources: { [language]: resource } })
  expect(catalogGroupLabel('video-special', i18n.t)).toBe(special)
  expect(catalogGroupLabel('video-stable', i18n.t)).toBe(stable)
  expect(catalogGroupLabel('vip', i18n.t)).toBe('vip')
  expect(catalogGroupLabel('custom-stable', i18n.t)).toBe('custom-stable')
  expect(catalogGroupLabel('xlsx-g-123', i18n.t, '  Supplier route  ')).toBe('Supplier route')
  expect(catalogGroupLabel('xlsx-g-123', i18n.t, '')).toBe('xlsx-g-123')
  expect(catalogGroupLabel('dddai-claude-kiro', i18n.t, '  Reference route · Claude  ')).toBe('Reference route · Claude')
  expect(catalogGroupLabel('video-special', i18n.t, 'unrelated description')).toBe(special)
})
