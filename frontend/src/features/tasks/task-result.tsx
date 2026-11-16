'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/auth/session'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { parseTaskArtifactsResponse } from './lib/task-artifacts'
import type { TaskArtifactsResponse, TaskLog } from './types'

function TaskMedia({ type, url, label }: { type: 'image' | 'video' | 'audio'; url: string; label: string }) {
  const [failed, setFailed] = useState(false),
    [revision, setRevision] = useState(0)
  if (failed)
    return (
      <ErrorState
        error={new Error('Media preview failed. Please try again.')}
        retry={() => {
          setFailed(false)
          setRevision((value) => value + 1)
        }}
      />
    )
  if (type === 'image')
    return <img key={revision} src={url} alt={label} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  if (type === 'video') return <video key={revision} src={url} aria-label={label} controls preload="metadata" onError={() => setFailed(true)} />
  return <audio key={revision} src={url} aria-label={label} controls preload="none" onError={() => setFailed(true)} />
}

function safeAudioUrl(value: string | undefined) {
  if (!value) return ''
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? value : ''
  } catch {
    return ''
  }
}

export function TaskResult({ task }: { task: TaskLog }) {
  const { t } = useTranslation(),
    auth = useAuth()
  const query = useQuery({
    queryKey: ['task-artifacts', auth.bundle?.user.id, task.task_id],
    staleTime: 0,
    gcTime: 0,
    enabled: task.status === 'SUCCESS' && !task.result_discarded,
    queryFn: async () => {
      const data = await api<NonNullable<TaskArtifactsResponse['data']>>(`/api/task/${encodeURIComponent(task.task_id)}/artifacts`)
      return parseTaskArtifactsResponse({ success: true, data })
    },
  })
  if (task.status !== 'SUCCESS') return null
  if (task.result_discarded)
    return (
      <EmptyState
        title={t('Result was returned directly')}
        description={t('This synchronous result was not stored and cannot be downloaded again.')}
      />
    )
  if (query.isPending) return <LoadingState />
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />
  const { artifacts, legacyContentUrl, legacyAudioClips } = query.data
  const audioClips = (legacyAudioClips || []).filter((clip) => safeAudioUrl(clip.audio_url))
  return (
    <div className="task-artifacts">
      {artifacts.map((artifact) => (
        <div className="task-artifact" key={artifact.key}>
          {artifact.type !== 'file' && <TaskMedia type={artifact.type} url={artifact.content_url} label={artifact.key} />}
          <a href={artifact.content_url} download={artifact.key} target="_blank" rel="noreferrer" className="text-link">
            <Download size={14} />
            {artifact.key}
          </a>
        </div>
      ))}
      {legacyContentUrl && (
        <div className="task-artifact">
          <TaskMedia type="video" url={legacyContentUrl} label={t('Video')} />
          <a href={legacyContentUrl} target="_blank" rel="noreferrer" className="text-link">
            <Download size={14} />
            {t('Download')}
          </a>
        </div>
      )}
      {audioClips.map((clip, index) => {
        const url = safeAudioUrl(clip.audio_url),
          label = clip.title || t('Audio')
        return (
          <div className="task-artifact" key={clip.id || clip.clip_id || index}>
            <strong>{label}</strong>
            <TaskMedia type="audio" url={url} label={label} />
            <a href={url} target="_blank" rel="noreferrer" className="text-link">
              <Download size={14} />
              {t('Download')}
            </a>
          </div>
        )
      })}
      {!artifacts.length && !legacyContentUrl && !audioClips.length && <EmptyState title={t('No stored artifacts')} />}
    </div>
  )
}
