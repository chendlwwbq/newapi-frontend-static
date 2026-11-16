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
import { describe, expect, test } from 'vitest'

import type { ChatCompletionRequest, ChatCompletionResponse } from '../../types'
import { createStreamRequestController } from '../use-stream-request'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

class FakeStreamSource {
  readyState = 0
  closed = false
  streamed = false
  private listeners = new Map<string, Array<(event: Event & { data?: string; readyState?: number }) => void>>()

  addEventListener(type: string, listener: (event: Event & { data?: string; readyState?: number }) => void) {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  close() {
    this.closed = true
  }

  stream() {
    this.streamed = true
  }

  emit(type: string, data?: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data, readyState: this.readyState } as Event & {
        data?: string
        readyState?: number
      })
    }
  }
}

const payload: ChatCompletionRequest = {
  model: 'test-model',
  messages: [{ role: 'user', content: 'hello' }],
  stream: true,
}

const noopCallbacks = {
  onUpdate: () => undefined,
  onComplete: () => undefined,
  onError: () => undefined,
}

describe('native non-stream completion', () => {
  test('emits reasoning/content and completes once without opening an SSE source', async () => {
    const updates: string[] = [],
      states: boolean[] = []
    let completed = 0
    const controller = createStreamRequestController({
      getHeaders: async () => ({}),
      createSource: () => {
        throw new Error('Unexpected SSE')
      },
      setStreaming: (value) => states.push(value),
      requestCompletion: async () =>
        ({ choices: [{ message: { role: 'assistant', content: 'Answer', reasoning_content: 'Reason' } }] }) as ChatCompletionResponse,
    })
    await controller.send(
      { ...payload, stream: false },
      {
        onUpdate: (type, value) => updates.push(`${type}:${value}`),
        onComplete: () => {
          completed++
        },
        onError: (error) => {
          throw new Error(error)
        },
      }
    )
    expect(updates).toEqual(['reasoning:Reason', 'content:Answer'])
    expect(completed).toBe(1)
    expect(states.at(-1)).toBe(false)
  })
  test('aborts and ignores a late non-stream reply after stop', async () => {
    const pending = deferred<ChatCompletionResponse>()
    let signal: AbortSignal | undefined,
      completed = 0
    const controller = createStreamRequestController({
      getHeaders: async () => ({}),
      createSource: () => new FakeStreamSource(),
      setStreaming: () => undefined,
      requestCompletion: (_payload, _headers, next) => {
        signal = next
        return pending.promise
      },
    })
    const request = controller.send(
      { ...payload, stream: false },
      {
        ...noopCallbacks,
        onComplete: () => {
          completed++
        },
      }
    )
    await Promise.resolve()
    controller.stop()
    pending.resolve({ choices: [{ message: { role: 'assistant', content: 'late' } }] } as ChatCompletionResponse)
    await request
    expect(signal?.aborted).toBe(true)
    expect(completed).toBe(0)
  })
  test('reports a non-stream provider failure without completing', async () => {
    const errors: string[] = []
    let completed = 0
    const controller = createStreamRequestController({
      getHeaders: async () => ({}),
      createSource: () => new FakeStreamSource(),
      setStreaming: () => undefined,
      requestCompletion: async () => {
        throw new Error('Provider unavailable')
      },
    })
    await controller.send(
      { ...payload, stream: false },
      {
        ...noopCallbacks,
        onComplete: () => {
          completed++
        },
        onError: (error) => errors.push(error),
      }
    )
    expect(errors).toEqual(['Provider unavailable'])
    expect(completed).toBe(0)
  })
})

describe('latest-wins stream request coordination', () => {
  test('reports source creation failure so the conversation can leave its generating state', async () => {
    const errors: string[] = [],
      states: boolean[] = []
    const controller = createStreamRequestController({
      getHeaders: async () => ({}),
      createSource: () => {
        throw new Error('Cannot initialize stream')
      },
      setStreaming: (value) => states.push(value),
    })
    await controller.send(payload, { ...noopCallbacks, onError: (error) => errors.push(error) })
    expect(errors).toHaveLength(1)
    expect(states.at(-1)).toBe(false)
  })
  test('finishes once after content and ignores events after DONE', async () => {
    const source = new FakeStreamSource(),
      updates: string[] = []
    let completions = 0
    const controller = createStreamRequestController({ getHeaders: async () => ({}), createSource: () => source, setStreaming: () => undefined })
    await controller.send(payload, {
      onUpdate: (_type, chunk) => updates.push(chunk),
      onComplete: () => {
        completions++
      },
      onError: () => undefined,
    })
    source.emit('message', JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] }))
    source.emit('message', '[DONE]')
    source.emit('message', '[DONE]')
    expect(updates).toEqual(['Hello'])
    expect(completions).toBe(1)
    expect(source.closed).toBe(true)
  })
  test('reports provider errors in a data frame instead of completing an empty reply', async () => {
    const source = new FakeStreamSource(),
      errors: string[] = []
    const controller = createStreamRequestController({ getHeaders: async () => ({}), createSource: () => source, setStreaming: () => undefined })
    await controller.send(payload, { ...noopCallbacks, onError: (error) => errors.push(error) })
    source.emit('message', JSON.stringify({ error: { message: 'Model unavailable' } }))
    expect(errors).toEqual(['Model unavailable'])
    expect(source.closed).toBe(true)
  })
  test('reports a disconnected stream without DONE and releases its active source', async () => {
    const source = new FakeStreamSource(),
      errors: string[] = []
    const controller = createStreamRequestController({ getHeaders: async () => ({}), createSource: () => source, setStreaming: () => undefined })
    await controller.send(payload, { ...noopCallbacks, onError: (error) => errors.push(error) })
    source.readyState = 2
    source.emit('readystatechange')
    expect(errors).toEqual(['Connection closed'])
    expect(source.closed).toBe(true)
  })
  test('only creates a stream for the latest header request', async () => {
    const firstHeaders = deferred<Record<string, string>>()
    const secondHeaders = deferred<Record<string, string>>()
    let headerRequest = 0
    const sources: FakeStreamSource[] = []
    const controller = createStreamRequestController({
      getHeaders: () => {
        headerRequest += 1
        return headerRequest === 1 ? firstHeaders.promise : secondHeaders.promise
      },
      createSource: () => {
        const source = new FakeStreamSource()
        sources.push(source)
        return source
      },
      setStreaming: () => undefined,
    })

    const first = controller.send(payload, noopCallbacks)
    const second = controller.send(payload, noopCallbacks)
    firstHeaders.resolve({ Authorization: 'Bearer stale' })
    await first
    expect(sources.length).toBe(0)

    secondHeaders.resolve({ Authorization: 'Bearer current' })
    await second
    expect(sources.length).toBe(1)
    expect(sources[0]?.streamed).toBe(true)
  })

  test('stop cancels a request that is still waiting for headers', async () => {
    const headers = deferred<Record<string, string>>()
    let sourceCount = 0
    const controller = createStreamRequestController({
      getHeaders: () => headers.promise,
      createSource: () => {
        sourceCount += 1
        return new FakeStreamSource()
      },
      setStreaming: () => undefined,
    })

    const request = controller.send(payload, noopCallbacks)
    controller.stop()
    headers.resolve({ Authorization: 'Bearer ignored' })
    await request

    expect(sourceCount).toBe(0)
  })

  test('dispose cancels a pending header request without a state update', async () => {
    const headers = deferred<Record<string, string>>()
    const streamingStates: boolean[] = []
    let sourceCount = 0
    const controller = createStreamRequestController({
      getHeaders: () => headers.promise,
      createSource: () => {
        sourceCount += 1
        return new FakeStreamSource()
      },
      setStreaming: (streaming) => streamingStates.push(streaming),
    })

    const request = controller.send(payload, noopCallbacks)
    controller.dispose()
    headers.resolve({ Authorization: 'Bearer ignored' })
    await request

    expect(sourceCount).toBe(0)
    expect(streamingStates).toEqual([false])
  })

  test('closes the previous source and ignores all of its later events', async () => {
    const nextHeaders = deferred<Record<string, string>>()
    let headerRequest = 0
    const sources: FakeStreamSource[] = []
    const updates: string[] = []
    const controller = createStreamRequestController({
      getHeaders: () => {
        headerRequest += 1
        if (headerRequest === 1) {
          return Promise.resolve({ Authorization: 'Bearer first' })
        }
        return nextHeaders.promise
      },
      createSource: () => {
        const source = new FakeStreamSource()
        sources.push(source)
        return source
      },
      setStreaming: () => undefined,
    })
    const callbacks = {
      onUpdate: (_type: 'reasoning' | 'content', chunk: string) => updates.push(chunk),
      onComplete: () => undefined,
      onError: () => undefined,
    }

    await controller.send(payload, callbacks)
    const second = controller.send(payload, callbacks)
    expect(sources[0]?.closed).toBe(true)
    sources[0]?.emit('message', JSON.stringify({ choices: [{ delta: { content: 'stale' } }] }))

    nextHeaders.resolve({ Authorization: 'Bearer second' })
    await second
    sources[1]?.emit('message', JSON.stringify({ choices: [{ delta: { content: 'current' } }] }))

    expect(updates).toEqual(['current'])
  })
})
