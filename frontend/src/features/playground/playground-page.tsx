'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Square, Plus, Trash2, MessageSquare, Paperclip, PanelLeftClose, Pencil, Settings2, Image } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CopyButton } from '@/components/shared/copy-button'
import { ErrorState, LoadingState } from '@/components/shared/states'
const MessageMarkdown = dynamic(() => import('./message-markdown').then((module) => module.MessageMarkdown), {
  ssr: false,
  loading: () => (
    <div className="space-y-2 py-1">
      <div className="h-3.5 w-3/4 animate-pulse rounded-md bg-muted" />
    </div>
  ),
})
import { RegenerateButton } from './regenerate-button'
import { ImageAttachment } from './image-attachment'
import { FaceProcessingTool } from './face-processing'
import { PdfAttachment } from './pdf-attachment'
import { Mascot } from '@/components/motion/mascot'
import { useStreamRequest } from './hooks/use-stream-request'
import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from './constants'
import { PLAYGROUND_PARAMETER_CONTROLS, normalizeParameterNumberValue } from './lib/parameters'
import { requestParameters, savedPlaygroundSettings } from './lib/request-options'
import { imageUrl } from './lib/image-messages'
import { branchEditedMessage, playgroundMessages } from './lib/conversation'
import { playgroundSelection } from './lib/selection'
import { followsLatestMessage } from './lib/message-scroll'
import { readLocalImage } from './lib/local-image'
import { uploadTextAttachment, deleteTextAttachment, messageWithTextAttachments, readPdfAttachment } from './lib/text-attachments'
import {
  clearConversationHistory,
  HistoryConflictError,
  loadConversationHistory,
  saveConversationHistory,
  type HistoryMode,
} from './lib/history-storage'
import { parsePlaygroundBackup, type ChatMessage, type Conversation, type ConversationDraft, type PlaygroundBackup } from './lib/backup'
import type { ChatCompletionRequest, PlaygroundConfig, ParameterEnabled } from './types'

type GroupInfo = { desc: string; ratio: number | string }

export function PlaygroundPage() {
  const auth = useAuth()
  return auth.bundle ? <Playground key={auth.bundle.user.id} userId={auth.bundle.user.id} userGroup={auth.bundle.user.group} /> : <LoadingState />
}

function Playground({ userId, userGroup }: { userId: number; userGroup: string }) {
  const { t } = useTranslation()
  const [group, setGroup] = useState(userGroup)
  const [model, setModel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [system, setSystem] = useState('')
  const [groupSelected, setGroupSelected] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState('')
  const [restored, setRestored] = useState(false)
  const [historyError, setHistoryError] = useState(false)
  const [historyConflict, setHistoryConflict] = useState(false)
  const [clearingHistory, setClearingHistory] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [backup, setBackup] = useState<PlaygroundBackup | null>(null)
  const [backupError, setBackupError] = useState(false)
  const [readingBackup, setReadingBackup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [config, setConfig] = useState<PlaygroundConfig>({ ...DEFAULT_CONFIG })
  const [enabled, setEnabled] = useState<ParameterEnabled>({ ...DEFAULT_PARAMETER_ENABLED })
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null)
  const [deletingConversation, setDeletingConversation] = useState<string | null>(null)
  const [imagePanel, setImagePanel] = useState(false)
  const [imageDraft, setImageDraft] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [imageError, setImageError] = useState(false)
  const [readingImage, setReadingImage] = useState(false)
  const [localImageError, setLocalImageError] = useState('')
  const [attachment, setAttachment] = useState<{
    id: string
    name: string
    kind: 'text' | 'pdf'
  } | null>(null)
  const [attachmentBusy, setAttachmentBusy] = useState(false)
  const uploadConfig = useQuery({
    queryKey: ['playground-upload-config', userId],
    queryFn: () => api<{ text_upload_enabled: boolean; max_bytes: number }>('/api/playground/uploads/config'),
  })
  const scroll = useRef<HTMLDivElement>(null)
  const drafts = useRef<Record<string, ConversationDraft>>({})
  const followMessages = useRef(true)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const imageReadVersion = useRef(0)
  const historyMode = useRef<HistoryMode | null>(null)
  const historyRevision = useRef(0)
  const historyConflictRef = useRef(false)
  const skipInitialHistorySave = useRef(true)
  const historyWrites = useRef<Promise<void>>(Promise.resolve())
  const savedGenerationStart = useRef(false)
  const { sendStreamRequest, stopStream } = useStreamRequest()
  const groups = useQuery({
    queryKey: ['playground-groups', userId],
    queryFn: () => api<Record<string, GroupInfo>>('/api/user/self/groups'),
  })
  const availableGroup = groups.error ? '' : playgroundSelection(Object.keys(groups.data || {}), group, groupSelected)
  const models = useQuery({
    queryKey: ['playground-models', userId, availableGroup],
    enabled: !!availableGroup,
    queryFn: ({ signal }) => api<string[]>(`/api/user/models?group=${encodeURIComponent(availableGroup)}`, { signal }),
  })
  const selectedModel = models.error ? '' : playgroundSelection(models.data || [], model, !!model)
  const active = conversations.find((conversation) => conversation.id === activeId)
  const messages = active?.messages || []
  const storageKey = `new-api:playground:${userId}`
  const settingsKey = `new-api:playground-settings:${userId}`
  useEffect(() => {
    let current = true
    try {
      const preferences = savedPlaygroundSettings(localStorage.getItem(settingsKey))
      setConfig(preferences.config)
      setEnabled(preferences.enabled)
      setSystem(preferences.system)
    } catch {
      /* Continue with default settings if device storage is unavailable. */
    }
    void loadConversationHistory<Conversation>(storageKey)
      .then((saved) => {
        if (!current) return
        historyMode.current = saved.mode
        historyRevision.current = saved.revision
        setConversations(saved.conversations)
        setActiveId(saved.conversations[0]?.id || '')
      })
      .catch(() => {
        if (current) setHistoryError(true)
      })
      .finally(() => {
        if (current) setRestored(true)
      })
    return () => {
      current = false
    }
  }, [storageKey, settingsKey])
  useEffect(() => {
    if (!restored || !historyMode.current || clearingHistory) return
    if (skipInitialHistorySave.current) {
      skipInitialHistorySave.current = false
      return
    }
    if (busy && savedGenerationStart.current) return
    savedGenerationStart.current = busy
    const mode = historyMode.current
    const snapshot = busy
      ? conversations.map((conversation) => ({
          ...conversation,
          messages: conversation.messages.map((message) => (message.status === 'streaming' ? { ...message, status: 'stopped' as const } : message)),
        }))
      : conversations
    historyWrites.current = historyWrites.current
      .then(async () => {
        if (historyConflictRef.current) return
        historyRevision.current = await saveConversationHistory(storageKey, snapshot, mode, historyRevision.current)
        setHistoryError(false)
      })
      .catch((error) => {
        if (error instanceof HistoryConflictError) {
          historyConflictRef.current = true
          setHistoryConflict(true)
        } else {
          setHistoryError(true)
          toast.error(t('Conversation history could not be saved on this device.'))
        }
      })
  }, [conversations, restored, storageKey, busy, clearingHistory, t])
  useEffect(() => {
    if (!restored) return
    try {
      localStorage.setItem(settingsKey, JSON.stringify({ config, enabled, system }))
    } catch {
      toast.error(t('Conversation history could not be saved on this device.'))
    }
  }, [config, enabled, system, settingsKey, restored, t])
  useEffect(() => {
    followMessages.current = true
    setShowScrollToBottom(false)
  }, [activeId])
  useEffect(() => {
    const element = scroll.current
    if (element && followMessages.current) element.scrollTop = element.scrollHeight
  }, [messages])
  function changeMessages(id: string, next: (previous: ChatMessage[]) => ChatMessage[]) {
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === id ? { ...conversation, messages: next(conversation.messages), updatedAt: Date.now() } : conversation
      )
    )
  }
  function stop() {
    stopStream()
    setBusy(false)
    changeMessages(activeId, (previous) => previous.map((message) => (message.status === 'streaming' ? { ...message, status: 'stopped' } : message)))
  }
  function switchConversation(id: string) {
    if (id === activeId) return
    drafts.current[activeId] = { text: prompt, images, imageUrl: imageDraft }
    const next = drafts.current[id] || { text: '', images: [], imageUrl: '' }
    imageReadVersion.current++
    setReadingImage(false)
    setLocalImageError('')
    setImageError(false)
    setActiveId(id)
    setPrompt(next.text)
    setImages(next.images)
    setImageDraft(next.imageUrl)
    setImagePanel(!!next.imageUrl)
  }
  function selectConversation(id: string) {
    if (attachment || attachmentBusy) return
    if (id === activeId) return
    if (busy) stop()
    switchConversation(id)
  }
  function newConversation() {
    if (attachment || attachmentBusy) return
    if (busy) stop()
    switchConversation('')
  }
  function clearHistory() {
    if (historyConflictRef.current) return
    if (busy) stop()
    imageReadVersion.current++
    setReadingImage(false)
    setLocalImageError('')
    const mode = historyMode.current
    if (!mode) return
    setClearingHistory(true)
    historyWrites.current = historyWrites.current
      .then(async () => {
        if (historyConflictRef.current) return
        historyRevision.current = await clearConversationHistory(storageKey, mode, historyRevision.current)
        drafts.current = {}
        setConversations([])
        setActiveId('')
        setClearOpen(false)
        setHistoryError(false)
      })
      .catch((error) => {
        if (error instanceof HistoryConflictError) {
          historyConflictRef.current = true
          setHistoryConflict(true)
        } else {
          setHistoryError(true)
          toast.error(t('Conversation history could not be saved on this device.'))
        }
      })
      .finally(() => setClearingHistory(false))
  }
  function exportHistory() {
    try {
      const knownIds = new Set(conversations.map((conversation) => conversation.id))
      const backgroundDrafts = Object.entries(drafts.current)
        .filter(([id, draft]) => id !== activeId && (!id || knownIds.has(id)) && (draft.text || draft.images.length || draft.imageUrl))
        .map(([conversationId, draft]) => ({ conversationId, draft }))
      const data = { version: 1, activeId, conversations, draft: { text: prompt, images, imageUrl: imageDraft }, backgroundDrafts }
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'eva-conversation-backup.json'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t('Conversation history could not be saved on this device.'))
    }
  }
  async function readBackup(file: File) {
    setReadingBackup(true)
    setBackup(null)
    setBackupError(false)
    try {
      setBackup(parsePlaygroundBackup(await file.text()))
    } catch {
      setBackupError(true)
    } finally {
      setReadingBackup(false)
    }
  }
  function importBackup() {
    if (!backup || busy || historyConflict || historyError || !historyMode.current) return
    const hasBackupDraft = !!(backup.draft.text || backup.draft.images.length || backup.draft.imageUrl)
    if (hasBackupDraft && (prompt || images.length || imageDraft)) return
    const imported = [...backup.conversations]
    const addNewDraft = (draft: ConversationDraft) => {
      const id = crypto.randomUUID()
      imported.push({
        id,
        title: t('New conversation'),
        messages: [],
        updatedAt: Date.now(),
      })
      drafts.current[id] = draft
    }
    const existingNewDraft = drafts.current['']
    if (
      !backup.activeId &&
      hasBackupDraft &&
      activeId &&
      existingNewDraft &&
      (existingNewDraft.text || existingNewDraft.images.length || existingNewDraft.imageUrl)
    ) {
      addNewDraft(existingNewDraft)
      delete drafts.current['']
    }
    for (const entry of backup.backgroundDrafts) {
      if (entry.conversationId) drafts.current[entry.conversationId] = entry.draft
      else addNewDraft(entry.draft)
    }
    setConversations((current) => [...imported, ...current])
    if (backup.activeId || hasBackupDraft) switchConversation(backup.activeId)
    if (hasBackupDraft) {
      setPrompt(backup.draft.text)
      setImages(backup.draft.images)
      setImageDraft(backup.draft.imageUrl)
      setImagePanel(!!backup.draft.imageUrl)
    }
    setBackupOpen(false)
    setBackup(null)
  }
  function addImage() {
    const value = imageUrl(imageDraft)
    if (!value) {
      setImageError(true)
      return
    }
    setImages((previous) => [...previous, value])
    setImageDraft('')
    setImageError(false)
  }
  async function addLocalImage(file: File) {
    if (images.filter((value) => value.startsWith('data:image/')).length >= 4) {
      setLocalImageError('You can add up to four local images per message.')
      return
    }
    const version = ++imageReadVersion.current
    setReadingImage(true)
    setLocalImageError('')
    try {
      const data = await readLocalImage(file, historyMode.current === 'indexeddb' ? 10 * 1024 * 1024 : 512 * 1024)
      if (version === imageReadVersion.current) setImages((previous) => [...previous, data])
    } catch {
      if (version === imageReadVersion.current)
        setLocalImageError(
          historyMode.current === 'indexeddb'
            ? 'Choose a JPEG, PNG, WebP or GIF image up to 10 MB.'
            : 'Choose a JPEG, PNG, WebP or GIF image up to 512 KB.'
        )
    } finally {
      if (version === imageReadVersion.current) setReadingImage(false)
    }
  }
  async function selectTextFile(file: File) {
    if (!file.size || file.size > (uploadConfig.data?.max_bytes || 0) || (historyMode.current !== 'indexeddb' && file.size > 512 * 1024)) {
      toast.error(t('Choose a non-empty file within the supported size limit.'))
      return
    }
    setAttachmentBusy(true)
    try {
      const uploaded = await uploadTextAttachment(file)
      setAttachment({
        id: uploaded.id,
        name: file.name,
        kind: file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'text',
      })
    } catch {
      toast.error(t('Attachment upload failed.'))
    } finally {
      setAttachmentBusy(false)
    }
  }
  async function removeTextFile() {
    if (!attachment) return
    setAttachmentBusy(true)
    try {
      await deleteTextAttachment(attachment.id)
      setAttachment(null)
    } catch {
      toast.error(t('Attachment deletion failed.'))
    } finally {
      setAttachmentBusy(false)
    }
  }
  async function generate(history: ChatMessage[], conversationId?: string) {
    if (busy || readingImage || !selectedModel || !availableGroup) return
    followMessages.current = true
    setGroup(availableGroup)
    setGroupSelected(true)
    setModel(selectedModel)
    const id = conversationId || crypto.randomUUID(),
      responseId = crypto.randomUUID()
    const next: ChatMessage[] = [...history, { id: responseId, role: 'assistant', content: '', status: 'streaming' }]
    if (conversationId) changeMessages(id, () => next)
    else {
      setConversations((previous) => [
        {
          id,
          title: history[0]?.content.slice(0, 42) || t('New conversation'),
          messages: next,
          updatedAt: Date.now(),
        },
        ...previous,
      ])
      if (activeId) switchConversation(id)
      else {
        delete drafts.current['']
        setActiveId(id)
      }
    }
    setBusy(true)
    const payload: ChatCompletionRequest = {
      model: selectedModel,
      group: availableGroup,
      ...requestParameters(config, enabled),
      stream: config.stream,
      messages: playgroundMessages(history, system),
    }
    let bufferedContent = ''
    let bufferedReasoning = ''
    let rafId: number | null = null
    const flushBufferedChunks = () => {
      rafId = null
      if (!bufferedContent && !bufferedReasoning) return
      const contentDelta = bufferedContent
      const reasoningDelta = bufferedReasoning
      bufferedContent = ''
      bufferedReasoning = ''
      changeMessages(id, (previous) =>
        previous.map((message) =>
          message.id === responseId
            ? {
                ...message,
                ...(reasoningDelta ? { reasoning: (message.reasoning || '') + reasoningDelta } : {}),
                ...(contentDelta ? { content: message.content + contentDelta } : {}),
              }
            : message
        )
      )
    }
    await sendStreamRequest(
      payload,
      (type, chunk) => {
        if (type === 'reasoning') bufferedReasoning += chunk
        else bufferedContent += chunk
        if (rafId === null) {
          rafId = window.requestAnimationFrame(flushBufferedChunks)
        }
      },
      () => {
        if (rafId !== null) window.cancelAnimationFrame(rafId)
        flushBufferedChunks()
        setBusy(false)
        changeMessages(id, (previous) => previous.map((message) => (message.id === responseId ? { ...message, status: 'complete' } : message)))
      },
      (error) => {
        if (rafId !== null) window.cancelAnimationFrame(rafId)
        flushBufferedChunks()
        setBusy(false)
        changeMessages(id, (previous) => previous.map((message) => (message.id === responseId ? { ...message, status: 'error', error } : message)))
      }
    )
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (
      (!prompt.trim() && !images.length && !attachment) ||
      imageDraft.trim() ||
      busy ||
      readingImage ||
      attachmentBusy ||
      !selectedModel ||
      !availableGroup
    )
      return
    if (!attachment) {
      const next: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: prompt.trim(),
        ...(images.length ? { images } : {}),
      }
      setPrompt('')
      setImages([])
      setImageDraft('')
      setImagePanel(false)
      void generate([...messages, next], active?.id)
      return
    }
    setAttachmentBusy(true)
    let content: string
    let pdf: { name: string; data: string } | undefined
    try {
      if (attachment.kind === 'pdf') {
        pdf = { name: attachment.name, data: await readPdfAttachment(attachment.id) }
        content = prompt.trim()
      } else content = await messageWithTextAttachments(prompt.trim(), [attachment])
    } catch {
      toast.error(t('Attachment could not be read.'))
      setAttachmentBusy(false)
      return
    }
    try {
      await deleteTextAttachment(attachment.id)
    } catch {
      toast.error(t('Attachment deletion failed.'))
    }
    const next: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      ...(pdf ? { pdf } : {}),
      ...(images.length ? { images } : {}),
    }
    setAttachment(null)
    setAttachmentBusy(false)
    setPrompt('')
    setImages([])
    setImageDraft('')
    setImagePanel(false)
    void generate([...messages, next], active?.id)
  }

  return (
    <div className="playground-page">
      <div className="console-page-heading">
        <div>
          <h1>{t('Playground')}</h1>
          <p>{t('Requests use your account balance.')}</p>
        </div>
        <Button variant="outline" disabled={!!attachment || attachmentBusy} onClick={newConversation}>
          <Plus size={14} />
          {t('New conversation')}
        </Button>
      </div>
      <div className={`playground-workspace ${historyOpen ? '' : 'history-collapsed'}`}>
        {historyOpen && (
          <aside className="chat-history">
            <div>
              <span>{t('Conversations')}</span>
              <button className="icon-button" aria-label={t('Hide history')} onClick={() => setHistoryOpen(false)}>
                <PanelLeftClose size={16} />
              </button>
            </div>
            <Button variant="outline" disabled={!!attachment || attachmentBusy} onClick={newConversation}>
              <Plus size={14} />
              {t('New conversation')}
            </Button>
            <nav aria-label={t('Conversations')}>
              {conversations.map((conversation) => (
                <div className="chat-history-item" key={conversation.id}>
                  <button
                    className="chat-history-select"
                    disabled={!!attachment || attachmentBusy}
                    aria-current={conversation.id === activeId ? 'page' : undefined}
                    onClick={() => selectConversation(conversation.id)}
                  >
                    <MessageSquare size={14} />
                    <span>{conversation.title}</span>
                  </button>
                  <button
                    className="icon-button"
                    disabled={busy}
                    aria-label={`${t('Rename')}: ${conversation.title}`}
                    onClick={() => setRenaming({ id: conversation.id, title: conversation.title })}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={busy || !!attachment || attachmentBusy}
                    aria-label={`${t('Delete')}: ${conversation.title}`}
                    onClick={() => setDeletingConversation(conversation.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </nav>
            <div className="history-footer">
              <p>{t('Saved on this device, for this account.')}</p>
              <button className="text-link" disabled={!conversations.length || !!attachment || attachmentBusy} onClick={() => setClearOpen(true)}>
                <Trash2 size={12} />
                {t('Clear history')}
              </button>
            </div>
          </aside>
        )}
        <div className="chat-layout">
          <div className="chat-toolbar">
            {!historyOpen && (
              <button className="icon-button" aria-label={t('Show history')} onClick={() => setHistoryOpen(true)}>
                <MessageSquare size={16} />
              </button>
            )}
            <strong className="chat-conversation-title">{active?.title || t('New conversation')}</strong>
            <FaceProcessingTool />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={
                !restored || busy || readingImage || historyConflict || historyError || !historyMode.current || !!attachment || attachmentBusy
              }
              onClick={() => {
                setBackup(null)
                setBackupError(false)
                setBackupOpen(true)
              }}
            >
              {t('Import')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!restored || !!attachment || attachmentBusy || (!conversations.length && !prompt && !images.length && !imageDraft)}
              onClick={exportHistory}
            >
              {t('Export')}
            </Button>
            <button className="icon-button" aria-label={t('New conversation')} disabled={!!attachment || attachmentBusy} onClick={newConversation}>
              <Plus size={17} />
            </button>
          </div>
          {(groups.error || models.error) && (
            <ErrorState
              error={(groups.error || models.error)!}
              retry={() => {
                if (groups.error) void groups.refetch()
                else void models.refetch()
              }}
            />
          )}
          {historyError && (
            <p className="inline-error" role="alert">
              {t('Conversation history is unavailable or could not be saved on this device.')}
            </p>
          )}
          {historyConflict && (
            <p className="inline-error" role="alert">
              {t('History changed in another tab. Your changes are not saved; copy them before refreshing.')}
            </p>
          )}
          {(historyConflict || historyError) && <p className="small-note">{t('The export contains your conversations, drafts and images.')}</p>}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              className="chat-messages"
              ref={scroll}
              role="log"
              aria-label={t('Conversation')}
              aria-live="off"
              onScroll={(event) => {
                const element = event.currentTarget
                const nearBottom = followsLatestMessage(element.scrollHeight, element.clientHeight, element.scrollTop)
                followMessages.current = nearBottom
                setShowScrollToBottom(!nearBottom && messages.length > 0)
              }}
            >
              {!messages.length && (
                <div className="playground-empty">
                  <Mascot />
                  <h1>{selectedModel ? t('Chat with {{model}}', { model: selectedModel }) : t('What would you like to create?')}</h1>
                  <p>
                    {availableGroup
                      ? `${t('Current group')} · ${availableGroup}`
                      : t('Choose a model and start a conversation with your New API gateway.')}
                  </p>
                  <div>
                    {['Explain a concept', 'Help me write code', 'Brainstorm ideas'].map((label) => (
                      <button key={label} onClick={() => setPrompt(t(label))}>
                        {t(label)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((message, index) => (
                <article
                  className={`chat-message ${message.role}${message.status === 'streaming' ? ' transition-none' : ''}`}
                  data-streaming={message.status === 'streaming' ? 'true' : undefined}
                  key={message.id}
                >
                  <div className="chat-message-label">{t(message.role === 'user' ? 'You' : 'Assistant')}</div>
                  {message.reasoning && (
                    <details className="chat-reasoning">
                      <summary>{t('Reasoning')}</summary>
                      <p>{message.reasoning}</p>
                    </details>
                  )}
                  <div className="chat-message-content">
                    {message.content ? (
                      message.role === 'assistant' ? (
                        <MessageMarkdown content={message.content} />
                      ) : (
                        message.content
                      )
                    ) : message.status === 'streaming' ? (
                      <div className="space-y-2 py-1" role="status" aria-label={t('Generating')}>
                        <div className="h-3.5 w-3/4 animate-pulse rounded-md bg-muted" />
                        <div className="h-3.5 w-5/6 animate-pulse rounded-md bg-muted" />
                        <div className="h-3.5 w-2/3 animate-pulse rounded-md bg-muted" />
                      </div>
                    ) : null}
                  </div>
                  {!!message.images?.length && (
                    <ul className="chat-image-list">
                      {message.images.map((url, imageIndex) => (
                        <li key={`${url}:${imageIndex}`}>
                          <span>
                            {t('Image')} {imageIndex + 1}:{' '}
                          </span>
                          <ImageAttachment source={url} index={imageIndex} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {message.pdf && <PdfAttachment file={message.pdf} />}
                  {message.error && (
                    <p className="chat-error" role="alert">
                      {message.error}
                    </p>
                  )}
                  {message.status === 'stopped' && <span className="small-note">{t('Generation stopped')}</span>}
                  <div className="chat-message-actions">
                    {message.content && <CopyButton value={message.content} />}{' '}
                    {message.role === 'assistant' && !busy && (
                      <RegenerateButton
                        messages={messages}
                        index={index}
                        conversationId={activeId}
                        disabled={!selectedModel || !availableGroup || readingImage}
                        onGenerate={(history, id) => void generate(history, id)}
                      />
                    )}
                    {!busy && (
                      <>
                        <button
                          className="icon-button"
                          aria-label={t('Edit message')}
                          onClick={() => setEditing({ id: message.id, content: message.content })}
                        >
                          <Pencil size={13} />
                        </button>
                        <button className="icon-button" aria-label={t('Delete message')} onClick={() => setDeleting(message.id)}>
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {showScrollToBottom && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="pointer-events-auto rounded-full border border-border/80 bg-background/90 px-3.5 shadow-md backdrop-blur-md hover:bg-background"
                  onClick={() => {
                    followMessages.current = true
                    setShowScrollToBottom(false)
                    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight
                  }}
                >
                  <ArrowDown size={14} className="mr-1" aria-hidden="true" />
                  {t('Back to latest')}
                </Button>
              </div>
            )}
          </div>
          <form className="chat-composer" onSubmit={(event) => void submit(event)}>
            <textarea
              aria-label={t('Message')}
              placeholder={t('Ask anything…')}
              value={prompt}
              disabled={!restored || attachmentBusy}
              onChange={(event) => setPrompt(event.target.value)}
              onPaste={(event) => {
                if (busy || readingImage) return
                const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith('image/'))
                if (!file) return
                if (!event.clipboardData.getData('text/plain')) event.preventDefault()
                void addLocalImage(file)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  if (!busy) event.currentTarget.form?.requestSubmit()
                }
              }}
            />
            {imagePanel && (
              <div className="chat-image-editor">
                <label className="field">
                  <span>
                    {t('Image')} {t('URL')}
                  </span>
                  <input
                    type="text"
                    inputMode="url"
                    value={imageDraft}
                    disabled={busy}
                    onChange={(event) => {
                      setImageDraft(event.target.value)
                      setImageError(false)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                        event.preventDefault()
                        addImage()
                      }
                    }}
                  />
                </label>
                <Button type="button" variant="outline" disabled={busy || !imageDraft.trim()} onClick={addImage}>
                  {t('Add')}
                </Button>
                {imageError && (
                  <p className="inline-error" role="alert">
                    {t('Provide a valid URL starting with http:// or https://')}
                  </p>
                )}
              </div>
            )}
            {!!images.length && (
              <ul className="chat-image-list">
                {images.map((url, index) => (
                  <li key={`${url}:${index}`}>
                    <ImageAttachment source={url} index={index} />
                    <button
                      type="button"
                      className="text-link"
                      disabled={busy}
                      aria-label={`${t('Remove')} ${t('Image')} ${index + 1}`}
                      onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      {t('Remove')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {attachment && (
              <p>
                {attachment.name}{' '}
                <button type="button" className="text-link" disabled={attachmentBusy || busy} onClick={() => void removeTextFile()}>
                  {t('Remove')}
                </button>
              </p>
            )}
            {uploadConfig.error && (
              <div>
                <span>
                  {t('Upload text file')} / {t('Upload PDF')}
                </span>
                <ErrorState
                  error={uploadConfig.error}
                  retry={() => {
                    void uploadConfig.refetch()
                  }}
                />
              </div>
            )}
            {uploadConfig.data?.text_upload_enabled && (
              <p className="small-note">
                {t('PDF input requires a model that supports PDF files.')}{' '}
                {t('PDF token usage may be estimated when the provider does not report usage.')}{' '}
                {t('Attachments are limited to 512 KB when browser storage is limited.')}
              </p>
            )}
            {attachment && (
              <p className="small-note">
                {t('The file contents will be sent to the model and saved in this conversation.')} {t('Unsent attachments expire after 24 hours.')}{' '}
                {t('Send or remove the attachment before switching conversations or exporting.')}
              </p>
            )}
            {localImageError && (
              <p className="inline-error" role="alert">
                {t(localImageError)}
              </p>
            )}
            <p className="chat-composer-note">
              {t('Requests use your account balance.')} {t('Sent local images are stored in this browser and sent to the model provider.')}{' '}
              {t('Unsent drafts stay in this tab until exported.')}
            </p>
            <div className="chat-composer-footer">
              <div className="chat-composer-controls">
                <select
                  className="plain-select"
                  aria-label={t('Group')}
                  value={availableGroup}
                  disabled={busy || attachmentBusy || groups.isPending}
                  onChange={(event) => {
                    setGroup(event.target.value)
                    setGroupSelected(true)
                    setModel('')
                  }}
                >
                  {!availableGroup && (
                    <option value="" disabled>
                      {t(groupSelected ? 'Selected group is unavailable.' : groups.isPending ? 'Loading' : 'No data yet')}
                    </option>
                  )}
                  {Object.entries(groups.data || {}).map(([name, info]) => (
                    <option key={name} value={name}>
                      {name}
                      {info.desc ? ` · ${info.desc}` : ''}
                    </option>
                  ))}
                </select>
                <select
                  className="plain-select chat-model-select"
                  aria-label={t('Model')}
                  value={selectedModel}
                  disabled={busy || attachmentBusy || models.isPending}
                  onChange={(event) => setModel(event.target.value)}
                >
                  {!selectedModel && (
                    <option value="" disabled>
                      {t(model ? 'Model unavailable' : models.isPending ? 'Loading' : 'No models configured')}
                    </option>
                  )}
                  {models.data?.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <button type="button" className="text-link" onClick={() => setSettingsOpen(true)} disabled={busy}>
                  <Settings2 size={14} />
                  {t('Generation settings')}
                </button>
              </div>
              <div className="chat-composer-actions">
                <button
                  className="icon-button"
                  type="button"
                  aria-expanded={imagePanel}
                  aria-label={`${t('Image')} ${t('URL')}`}
                  disabled={busy}
                  onClick={() => setImagePanel((value) => !value)}
                >
                  <Image size={16} />
                </button>
                <details className="chat-attachment-menu">
                  <summary className="icon-button" aria-label={t('Attach file')}>
                    <Paperclip size={16} />
                  </summary>
                  <div>
                    <label>
                      {t('Upload photo')}
                      <input
                        className="sr-only"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        aria-label={t('Upload photo')}
                        disabled={!restored || busy || readingImage}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          event.target.value = ''
                          event.currentTarget.closest('details')?.removeAttribute('open')
                          if (file) void addLocalImage(file)
                        }}
                      />
                    </label>
                    {uploadConfig.data?.text_upload_enabled && (
                      <>
                        <label>
                          {t('Upload text file')}
                          <input
                            className="sr-only"
                            type="file"
                            accept=".txt,.md,.csv,.json,.log,text/plain"
                            disabled={busy || attachmentBusy || !!attachment || !restored}
                            onChange={(event) => {
                              const file = event.target.files?.[0]
                              event.target.value = ''
                              event.currentTarget.closest('details')?.removeAttribute('open')
                              if (file) void selectTextFile(file)
                            }}
                          />
                        </label>
                        <label>
                          {t('Upload PDF')}
                          <input
                            className="sr-only"
                            type="file"
                            accept="application/pdf,.pdf"
                            disabled={busy || attachmentBusy || !!attachment || !restored}
                            onChange={(event) => {
                              const file = event.target.files?.[0]
                              event.target.value = ''
                              event.currentTarget.closest('details')?.removeAttribute('open')
                              if (file) void selectTextFile(file)
                            }}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </details>
                {busy ? (
                  <Button type="button" size="icon" aria-label={t('Stop generating')} onClick={stop}>
                    <Square size={14} />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon"
                    aria-label={t('Send message')}
                    disabled={
                      (!prompt.trim() && !images.length && !attachment) ||
                      !!imageDraft.trim() ||
                      !selectedModel ||
                      !availableGroup ||
                      !restored ||
                      readingImage ||
                      attachmentBusy
                    }
                  >
                    <ArrowUp size={17} />
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="playground-settings-dialog">
            <DialogHeader>
              <DialogTitle>{t('Generation settings')}</DialogTitle>
            </DialogHeader>
            <label className="field">
              <span>{t('System prompt')}</span>
              <textarea rows={4} value={system} onChange={(event) => setSystem(event.target.value)} />
              <small>{t('Instructions sent before your messages')}</small>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={config.stream}
                onChange={(event) => setConfig((previous) => ({ ...previous, stream: event.target.checked }))}
              />
              {t('Stream')}
            </label>
            <div className="playground-parameters">
              {PLAYGROUND_PARAMETER_CONTROLS.map((control) => (
                <div key={control.key}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={enabled[control.key]}
                      onChange={(event) => setEnabled((previous) => ({ ...previous, [control.key]: event.target.checked }))}
                    />
                    {t(control.labelKey)}
                  </label>
                  <label className="field">
                    <input
                      type="number"
                      aria-label={t(control.labelKey)}
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      disabled={!enabled[control.key]}
                      value={config[control.key] ?? ''}
                      onChange={(event) =>
                        setConfig((previous) => ({ ...previous, [control.key]: normalizeParameterNumberValue(control.key, event.target.value) }))
                      }
                    />
                    <small>{t(control.descriptionKey)}</small>
                  </label>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setConfig({ ...DEFAULT_CONFIG })
                  setEnabled({ ...DEFAULT_PARAMETER_ENABLED })
                  setSystem('')
                }}
              >
                {t('Reset')}
              </Button>
              <Button onClick={() => setSettingsOpen(false)}>{t('Done')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={backupOpen}
          onOpenChange={(open) => {
            if (!readingBackup) setBackupOpen(open)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('Import')}</DialogTitle>
            </DialogHeader>
            <p className="small-note">{t('Import adds copies of conversations and keeps existing history.')}</p>
            <label className="field">
              <span>{t('JSON file')}</span>
              <input
                type="file"
                accept=".json,application/json"
                disabled={readingBackup}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void readBackup(file)
                }}
              />
            </label>
            {backup && (
              <p>
                {t('Conversations')}: {backup.conversations.length + backup.backgroundDrafts.filter((entry) => !entry.conversationId).length}
              </p>
            )}
            {backup && !backup.activeId && !!(backup.draft.text || backup.draft.images.length || backup.draft.imageUrl) && (
              <p className="small-note">{t('The backup draft will open in a new conversation.')}</p>
            )}
            {backupError && (
              <p role="alert" className="inline-error">
                {t('Invalid conversation backup.')}
              </p>
            )}
            {backup && (backup.draft.text || backup.draft.images.length || backup.draft.imageUrl) && !!(prompt || images.length || imageDraft) && (
              <p role="alert" className="inline-error">
                {t('Clear the current draft before restoring the backup draft.')}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" disabled={readingBackup} onClick={() => setBackupOpen(false)}>
                {t('Cancel')}
              </Button>
              <Button
                disabled={
                  !backup ||
                  readingBackup ||
                  historyConflict ||
                  historyError ||
                  !!(backup && (backup.draft.text || backup.draft.images.length || backup.draft.imageUrl) && (prompt || images.length || imageDraft))
                }
                onClick={importBackup}
              >
                {t('Import')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('Edit message')}</DialogTitle>
            </DialogHeader>
            <label className="field">
              <span>{t('Message')}</span>
              <textarea
                rows={8}
                value={editing?.content || ''}
                onChange={(event) => setEditing((previous) => (previous ? { ...previous, content: event.target.value } : null))}
              />
            </label>
            {editing && messages.find((message) => message.id === editing.id)?.role === 'user' && (
              <p className="small-note">{t('Sending creates a new conversation and keeps the original history.')}</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>
                {t('Cancel')}
              </Button>
              <Button
                disabled={!editing?.content.trim()}
                onClick={() => {
                  if (!editing) return
                  changeMessages(activeId, (previous) =>
                    previous.map((message) => (message.id === editing.id ? { ...message, content: editing.content } : message))
                  )
                  setEditing(null)
                }}
              >
                {t('Save')}
              </Button>
              {editing && messages.find((message) => message.id === editing.id)?.role === 'user' && (
                <Button
                  disabled={!editing.content.trim() || !selectedModel || !availableGroup || busy || readingImage}
                  onClick={() => {
                    const branch = branchEditedMessage(messages, editing.id, editing.content)
                    if (!branch) return
                    setEditing(null)
                    void generate(branch)
                  }}
                >
                  {t('Send in new conversation')}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={!!deleting}
          onOpenChange={(open) => {
            if (!open) setDeleting(null)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('Delete message')}</DialogTitle>
            </DialogHeader>
            <p>{t('This removes the selected message from this conversation.')}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)}>
                {t('Cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  changeMessages(activeId, (previous) => previous.filter((message) => message.id !== deleting))
                  setDeleting(null)
                }}
              >
                {t('Delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={!!renaming}
          onOpenChange={(open) => {
            if (!open) setRenaming(null)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t('Rename')} · {t('Conversation')}
              </DialogTitle>
            </DialogHeader>
            <label className="field">
              <span>{t('Name')}</span>
              <input
                autoFocus
                maxLength={100}
                value={renaming?.title || ''}
                onChange={(event) => setRenaming((current) => (current ? { ...current, title: event.target.value } : null))}
              />
            </label>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenaming(null)}>
                {t('Cancel')}
              </Button>
              <Button
                disabled={!renaming?.title.trim() || busy}
                onClick={() => {
                  if (!renaming) return
                  setConversations((previous) =>
                    previous.map((conversation) =>
                      conversation.id === renaming.id ? { ...conversation, title: renaming.title.trim(), updatedAt: Date.now() } : conversation
                    )
                  )
                  setRenaming(null)
                }}
              >
                {t('Save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={!!deletingConversation}
          onOpenChange={(open) => {
            if (!open) setDeletingConversation(null)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t('Delete')} · {t('Conversation')}
              </DialogTitle>
            </DialogHeader>
            <p>{conversations.find((conversation) => conversation.id === deletingConversation)?.title}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletingConversation(null)}>
                {t('Cancel')}
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  setConversations((previous) => previous.filter((conversation) => conversation.id !== deletingConversation))
                  if (activeId === deletingConversation) newConversation()
                  if (deletingConversation) delete drafts.current[deletingConversation]
                  setDeletingConversation(null)
                }}
              >
                {t('Delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={clearOpen} onOpenChange={setClearOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('Clear conversation history?')}</DialogTitle>
            </DialogHeader>
            <p>{t('This removes conversations saved for this account on this device.')}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setClearOpen(false)}>
                {t('Cancel')}
              </Button>
              <Button variant="destructive" disabled={clearingHistory || historyConflict || !historyMode.current} onClick={clearHistory}>
                {t('Clear history')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
