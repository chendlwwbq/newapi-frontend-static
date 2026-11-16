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
export type SystemInstanceStatus = 'online' | 'stale'

export type SystemInstanceInfo = {
  schema_version?: number
  node?: {
    name?: string
    source?: string
    manually_configured?: boolean
    should_configure_manually?: boolean
    [key: string]: unknown
  }
  role?: {
    is_master?: boolean
    [key: string]: unknown
  }
  runtime?: {
    version?: string
    goos?: string
    goarch?: string
    started_at?: number
    [key: string]: unknown
  }
  host?: {
    hostname?: string
    [key: string]: unknown
  }
  resources?: {
    cpu?: {
      usage_percent?: number
      [key: string]: unknown
    }
    memory?: {
      usage_percent?: number
      [key: string]: unknown
    }
    storage?: {
      total_bytes?: number
      used_bytes?: number
      free_bytes?: number
      used_percent?: number
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

export type SystemInstance = {
  node_name: string
  status: SystemInstanceStatus
  stale_after_seconds: number
  started_at: number
  last_seen_at: number
  info?: SystemInstanceInfo
}

export interface PerformanceStats {
  cache_stats: {
    active_disk_files: number
    current_disk_usage_bytes: number
    active_memory_buffers: number
    current_memory_usage_bytes: number
    disk_cache_hits: number
    memory_cache_hits: number
    disk_cache_max_bytes: number
    disk_cache_threshold_bytes: number
  }
  memory_stats: { alloc: number; total_alloc: number; sys: number; num_gc: number; num_goroutine: number }
  disk_cache_info: { path: string; exists: boolean; file_count: number; total_size: number }
  disk_space_info: { total: number; free: number; used: number; used_percent: number }
  config: {
    disk_cache_enabled: boolean
    monitor_enabled: boolean
    disk_cache_threshold_mb: number
    disk_cache_max_size_mb: number
    disk_cache_path: string
    is_running_in_container: boolean
    monitor_cpu_threshold: number
    monitor_memory_threshold: number
    monitor_disk_threshold: number
  }
}
export interface SystemTask {
  id: number
  task_id: string
  type: string
  status: string
  payload: unknown
  state: unknown
  result: unknown
  error: string
  locked_by: string
  created_at: number
  updated_at: number
}
