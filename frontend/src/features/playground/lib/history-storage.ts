export type HistoryMode = 'indexeddb' | 'localStorage'
export class HistoryConflictError extends Error {}

function storedHistory(value: unknown): { revision: number; conversations: unknown[] } | null {
  if (value === undefined) return null
  if (Array.isArray(value)) return { revision: 0, conversations: value }
  if (
    value &&
    typeof value === 'object' &&
    'revision' in value &&
    'conversations' in value &&
    typeof value.revision === 'number' &&
    Number.isSafeInteger(value.revision) &&
    value.revision > 0 &&
    Array.isArray(value.conversations)
  )
    return { revision: value.revision, conversations: value.conversations }
  throw new Error('Invalid conversation history')
}

function openHistoryDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false
    const request = indexedDB.open('eva-playground-history', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('conversations')
    request.onsuccess = () => {
      if (blocked) request.result.close()
      else resolve(request.result)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => {
      blocked = true
      reject(new Error('History database is blocked'))
    }
  })
}

function legacyHistory<T>(key: string): T[] {
  const raw = localStorage.getItem(key)
  const data: unknown = raw ? JSON.parse(raw) : []
  if (!Array.isArray(data)) throw new Error('Invalid conversation history')
  return data as T[]
}

export async function loadConversationHistory<T>(key: string): Promise<{ conversations: T[]; mode: HistoryMode; revision: number }> {
  if (typeof indexedDB === 'undefined') return { conversations: legacyHistory<T>(key), mode: 'localStorage', revision: 0 }
  const db = await openHistoryDatabase()
  try {
    const saved = await new Promise<unknown>((resolve, reject) => {
      const transaction = db.transaction('conversations', 'readonly')
      const request = transaction.objectStore('conversations').get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const record = storedHistory(saved)
    if (!record) return { conversations: legacyHistory<T>(key), mode: 'indexeddb', revision: 0 }
    return { conversations: record.conversations as T[], mode: 'indexeddb', revision: record.revision }
  } finally {
    db.close()
  }
}

export async function saveConversationHistory<T>(key: string, conversations: T[], mode: HistoryMode, revision: number): Promise<number> {
  if (mode === 'localStorage') {
    localStorage.setItem(key, JSON.stringify(conversations))
    return 0
  }
  const db = await openHistoryDatabase()
  try {
    return await new Promise<number>((resolve, reject) => {
      const transaction = db.transaction('conversations', 'readwrite')
      const store = transaction.objectStore('conversations')
      const request = store.get(key)
      let failure: Error | undefined
      request.onsuccess = () => {
        try {
          const current = storedHistory(request.result)
          if ((current?.revision ?? 0) !== revision) {
            failure = new HistoryConflictError('Conversation history changed')
            transaction.abort()
            return
          }
          store.put({ revision: revision + 1, conversations }, key)
        } catch (error) {
          failure = error instanceof Error ? error : new Error('Invalid conversation history')
          transaction.abort()
        }
      }
      transaction.oncomplete = () => resolve(revision + 1)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(failure || transaction.error)
    })
  } finally {
    db.close()
  }
}

export async function clearConversationHistory(key: string, mode: HistoryMode, revision: number): Promise<number> {
  const next = mode === 'indexeddb' ? await saveConversationHistory(key, [], mode, revision) : 0
  localStorage.removeItem(key)
  return next
}
