import type { AuthBundle, Catalog, CatalogModel } from '@/lib/api/types'

type HomeSession = { phase: 'loading' | 'ready' | 'error'; bundle: AuthBundle | null }

/** Separate cached catalogs across sessions and user groups. */
export function homeCatalogKey(bundle: AuthBundle | null) {
  return ['home-catalog', bundle?.user.id ?? 0, bundle?.user.group ?? '', bundle?.session.sid ?? 'public'] as const
}

/** Only anonymous sessions may fall back to the public server-rendered catalog. */
export function visibleHomeModels(session: HomeSession, initial: Catalog | null, data: Catalog | undefined, failed: boolean): CatalogModel[] {
  if (session.phase === 'error' || failed) return []
  if (session.bundle) return data?.models ?? []
  return data?.models ?? initial?.models ?? []
}
