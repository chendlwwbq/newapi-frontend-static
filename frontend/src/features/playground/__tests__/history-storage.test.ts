// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { clearConversationHistory, HistoryConflictError, loadConversationHistory, saveConversationHistory } from '../lib/history-storage'

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

it('migrates legacy history without deleting it and isolates accounts', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  localStorage.setItem('account:1', JSON.stringify([{ id: 'old' }]))
  const first = await loadConversationHistory<{ id: string }>('account:1')
  expect(first).toEqual({ conversations: [{ id: 'old' }], mode: 'indexeddb', revision: 0 })
  await saveConversationHistory('account:1', [{ id: 'new' }], first.mode, first.revision)
  expect((await loadConversationHistory<{ id: string }>('account:1')).conversations).toEqual([{ id: 'new' }])
  expect((await loadConversationHistory<{ id: string }>('account:2')).conversations).toEqual([])
  expect(JSON.parse(localStorage.getItem('account:1')!)).toEqual([{ id: 'old' }])
})

it('uses local storage when IndexedDB is unavailable', async () => {
  vi.stubGlobal('indexedDB', undefined)
  const state = await loadConversationHistory<{ id: string }>('account:1')
  expect(state.mode).toBe('localStorage')
  await saveConversationHistory('account:1', [{ id: 'fallback' }], state.mode, state.revision)
  expect((await loadConversationHistory<{ id: string }>('account:1')).conversations).toEqual([{ id: 'fallback' }])
})

it('does not overwrite or replace old history if the database cannot be opened', async () => {
  vi.stubGlobal('indexedDB', {
    open: () => {
      throw new Error('blocked')
    },
  })
  localStorage.setItem('account:1', JSON.stringify([{ id: 'old' }]))
  await expect(loadConversationHistory('account:1')).rejects.toThrow('blocked')
  expect(JSON.parse(localStorage.getItem('account:1')!)).toEqual([{ id: 'old' }])
})

it('clears both the current history and its legacy copy for the selected account', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  localStorage.setItem('account:1', JSON.stringify([{ id: 'old' }]))
  localStorage.setItem('account:2', JSON.stringify([{ id: 'other' }]))
  const revision = await saveConversationHistory('account:1', [{ id: 'new' }], 'indexeddb', 0)
  await clearConversationHistory('account:1', 'indexeddb', revision)
  expect((await loadConversationHistory('account:1')).conversations).toEqual([])
  expect(localStorage.getItem('account:1')).toBeNull()
  expect(localStorage.getItem('account:2')).not.toBeNull()
})

it('rejects a stale tab without overwriting another tab’s history', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  const first = await loadConversationHistory('account:1')
  const second = await loadConversationHistory('account:1')
  await saveConversationHistory('account:1', [{ id: 'first' }], first.mode, first.revision)
  await expect(saveConversationHistory('account:1', [{ id: 'second' }], second.mode, second.revision)).rejects.toBeInstanceOf(HistoryConflictError)
  expect((await loadConversationHistory('account:1')).conversations).toEqual([{ id: 'first' }])
  await expect(clearConversationHistory('account:1', second.mode, second.revision)).rejects.toBeInstanceOf(HistoryConflictError)
})

it('reads and upgrades history saved in the previous IndexedDB format', async () => {
  const factory = new IDBFactory()
  vi.stubGlobal('indexedDB', factory)
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open('eva-playground-history', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('conversations')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('conversations', 'readwrite')
    tx.objectStore('conversations').put([{ id: 'previous' }], 'account:1')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  const prior = await loadConversationHistory<{ id: string }>('account:1')
  expect(prior).toEqual({ mode: 'indexeddb', revision: 0, conversations: [{ id: 'previous' }] })
  await saveConversationHistory('account:1', prior.conversations, prior.mode, prior.revision)
  expect((await loadConversationHistory('account:1')).revision).toBe(1)
})
