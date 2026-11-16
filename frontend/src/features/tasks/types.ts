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
export interface TaskLog {
  id: number
  user_id: number
  username?: string
  platform: string // suno, kling, runway, etc.
  task_id: string
  action: string // MUSIC, LYRICS, GENERATE, TEXT_GENERATE, etc.
  channel_id: number
  group: string
  quota: number
  submit_time: number // seconds
  start_time?: number // seconds
  finish_time?: number // seconds
  progress?: string
  progress_message_en?: string
  data?: unknown
  properties?: {
    input?: string
    upstream_model_name?: string
    origin_model_name?: string
  }
  legacy_video_available?: boolean
  // A synchronous result returned inline and never persisted; artifact
  // retrieval is not offered for it.
  result_discarded?: boolean
  fail_reason?: string
  status: string // NOT_START, SUBMITTED, IN_PROGRESS, SUCCESS, FAILURE, QUEUED, UNKNOWN
  admin_info?: {
    request_id?: string
    request_path?: string
    task_plugin?: TaskPluginInfo
  }
  root_info?: {
    task_plugin?: TaskPluginRuntimeInfo
    upstream_task_id?: string
    node_name?: string
  }
  created_at?: number
  updated_at?: number
}

export interface TaskPluginInfo {
  key: string
  name: string
  version?: string
  author?: TaskPluginAuthor
}

export interface TaskPluginAuthor {
  name: string
  url?: string
}

export interface TaskPluginRuntimeInfo {
  key: string
  version: string
  api_version: number
  generation: number
}

export type TaskArtifactType = 'image' | 'video' | 'audio' | 'file'

export interface TaskArtifact {
  key: string
  type: TaskArtifactType
  mime_type?: string
  content_url: string
}

export interface AudioClip {
  clip_id?: string
  id?: string
  title?: string
  tags?: string
  duration?: number
  audio_url?: string
  image_url?: string
  image_large_url?: string
  metadata?: {
    tags?: string
    duration?: number
  }
}

export interface TaskArtifactProjection {
  artifacts: TaskArtifact[]
  legacyContentUrl?: string
  legacyAudioClips?: AudioClip[]
}

export interface TaskArtifactsResponse {
  success: boolean
  message?: string
  code?: string
  data?: {
    artifacts?: unknown
    legacy_content_url?: unknown
    legacy_audio_clips?: unknown
  }
}
