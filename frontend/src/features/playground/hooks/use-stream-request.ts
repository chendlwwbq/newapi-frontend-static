'use client'
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
import { useCallback, useEffect, useRef, useState } from 'react'
import { SSE } from 'sse.js'

import { freshAuthHeaders } from '@/lib/auth/session'

import { API_ENDPOINTS, ERROR_MESSAGES } from '../constants'
import {
  getStreamReadyStateError,
  isStreamClosedReadyState,
  isStreamDoneMessage,
  parseStreamErrorDetails,
  parseStreamMessageUpdates,
} from '../lib/streaming/stream-utils'
import type { ChatCompletionRequest, ChatCompletionResponse } from '../types'

interface StreamEventSource {
  readyState?: number
  addEventListener: (type: string, listener: (event: Event & { data?: string; readyState?: number }) => void) => void
  close: () => void
  stream: () => void
}

interface StreamRequestCallbacks {
  onUpdate: (type: 'reasoning' | 'content', chunk: string) => void
  onComplete: () => void
  onError: (error: string, errorCode?: string) => void
}

interface StreamRequestControllerRuntime {
  getHeaders: () => Promise<Record<string, string>>
  createSource: (payload: ChatCompletionRequest, headers: Record<string, string>) => StreamEventSource
  setStreaming: (streaming: boolean) => void
  requestCompletion?: (payload: ChatCompletionRequest, headers: Record<string, string>, signal: AbortSignal) => Promise<ChatCompletionResponse>
}

export function createStreamRequestController(runtime: StreamRequestControllerRuntime) {
  let source: StreamEventSource | null = null
  let generation = 0
  let completion: AbortController | null = null

  const closeActiveSource = (target: StreamEventSource) => {
    target.close()
    if (source === target) {
      source = null
      runtime.setStreaming(false)
    }
  }

  const send = async (payload: ChatCompletionRequest, callbacks: StreamRequestCallbacks) => {
    const requestGeneration = generation + 1
    generation = requestGeneration
    const previousSource = source
    source = null
    previousSource?.close()
    completion?.abort()
    completion = null
    runtime.setStreaming(false)

    let headers: Record<string, string>
    try {
      headers = await runtime.getHeaders()
    } catch (error: unknown) {
      if (generation !== requestGeneration) return
      callbacks.onError(error instanceof Error ? error.message : ERROR_MESSAGES.STREAM_START_ERROR)
      return
    }
    if (generation !== requestGeneration) return

    if (!payload.stream) {
      const controller = new AbortController()
      completion = controller
      runtime.setStreaming(true)
      try {
        if (!runtime.requestCompletion) throw new Error(ERROR_MESSAGES.API_REQUEST_ERROR)
        const result = await runtime.requestCompletion(payload, headers, controller.signal)
        if (generation !== requestGeneration) return
        const message = result.choices?.[0]?.message
        if (!message) throw new Error(ERROR_MESSAGES.PARSE_ERROR)
        const reasoning = message.reasoning_content || message.reasoning
        if (reasoning) callbacks.onUpdate('reasoning', reasoning)
        if (message.content) callbacks.onUpdate('content', message.content)
        callbacks.onComplete()
      } catch (error) {
        if (generation === requestGeneration) callbacks.onError(error instanceof Error ? error.message : ERROR_MESSAGES.API_REQUEST_ERROR)
      } finally {
        if (generation === requestGeneration) {
          completion = null
          runtime.setStreaming(false)
        }
      }
      return
    }

    let nextSource: StreamEventSource
    try {
      nextSource = runtime.createSource(payload, headers)
    } catch {
      callbacks.onError(ERROR_MESSAGES.STREAM_START_ERROR)
      return
    }
    source = nextSource
    runtime.setStreaming(true)
    let completed = false

    const isCurrent = () => generation === requestGeneration && source === nextSource

    const handleError = (errorMessage: string, errorCode?: string) => {
      if (!isCurrent() || completed) return
      completed = true
      callbacks.onError(errorMessage, errorCode)
      closeActiveSource(nextSource)
    }

    nextSource.addEventListener('message', (event) => {
      if (!isCurrent() || completed) return
      const data = event.data ?? ''
      if (isStreamDoneMessage(data)) {
        completed = true
        closeActiveSource(nextSource)
        callbacks.onComplete()
        return
      }

      try {
        const updates = parseStreamMessageUpdates(data)

        for (const update of updates) {
          callbacks.onUpdate(update.type, update.chunk)
        }
      } catch (error) {
        handleError(error instanceof SyntaxError ? ERROR_MESSAGES.PARSE_ERROR : (error as Error).message)
      }
    })

    nextSource.addEventListener('error', (event) => {
      if (!isCurrent() || completed) return
      if (!isStreamClosedReadyState(nextSource.readyState)) {
        const { errorCode, errorMessage } = parseStreamErrorDetails(event.data)
        handleError(errorMessage, errorCode)
      }
    })

    nextSource.addEventListener('readystatechange', (event) => {
      if (!isCurrent() || completed) return
      const errorMessage = getStreamReadyStateError(event.readyState, nextSource)

      if (errorMessage) {
        handleError(errorMessage)
      } else if (isStreamClosedReadyState(event.readyState)) {
        handleError(ERROR_MESSAGES.CONNECTION_CLOSED)
      }
    })

    try {
      if (!isCurrent()) return
      nextSource.stream()
    } catch {
      if (!isCurrent() || completed) return
      handleError(ERROR_MESSAGES.STREAM_START_ERROR)
    }
  }

  const cancel = (notify: boolean) => {
    generation += 1
    const activeSource = source
    source = null
    activeSource?.close()
    completion?.abort()
    completion = null
    if (notify) runtime.setStreaming(false)
  }

  const stop = () => cancel(true)
  const dispose = () => cancel(false)

  return { send, stop, dispose }
}

/**
 * Hook for handling streaming chat completion requests
 */
export function useStreamRequest() {
  const [isStreaming, setIsStreaming] = useState(false)
  const controllerRef = useRef<ReturnType<typeof createStreamRequestController> | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = createStreamRequestController({
      getHeaders: async () => ({ 'Content-Type': 'application/json', ...(await freshAuthHeaders()) }),
      createSource: (payload, headers) =>
        new SSE(API_ENDPOINTS.CHAT_COMPLETIONS, {
          headers,
          method: 'POST',
          payload: JSON.stringify(payload),
        }) as StreamEventSource,
      setStreaming: setIsStreaming,
      requestCompletion: async (payload, headers, signal) => {
        const response = await fetch(API_ENDPOINTS.CHAT_COMPLETIONS, {
          method: 'POST',
          credentials: 'same-origin',
          headers,
          body: JSON.stringify(payload),
          signal,
        })
        const result = await response.json()
        if (!response.ok || result.error) throw new Error(parseStreamErrorDetails(JSON.stringify(result)).errorMessage)
        return result as ChatCompletionResponse
      },
    })
  }

  const sendStreamRequest = useCallback(
    (
      payload: ChatCompletionRequest,
      onUpdate: (type: 'reasoning' | 'content', chunk: string) => void,
      onComplete: () => void,
      onError: (error: string, errorCode?: string) => void
    ) =>
      controllerRef.current?.send(payload, {
        onUpdate,
        onComplete,
        onError,
      }),
    []
  )

  const stopStream = useCallback(() => {
    controllerRef.current?.stop()
  }, [])

  useEffect(
    () => () => {
      controllerRef.current?.dispose()
    },
    []
  )

  return {
    sendStreamRequest,
    stopStream,
    isStreaming,
  }
}
