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
export interface DeploymentSettings {
  provider: string
  enabled: boolean
  configured: boolean
  can_connect: boolean
}
export interface Deployment {
  id: string
  deployment_name?: string
  container_name?: string
  status: string
  hardware_name?: string
  brand_name?: string
  hardware_quantity?: number
  compute_minutes_remaining?: number
  completed_percent?: number
  created_at: number
}
export interface DeploymentDetail extends Deployment {
  hardware_id: number
  gpus_per_container: number
  total_containers: number
  locations: { id: number; name?: string }[]
  container_config?: { image_url?: string; traffic_port?: number; env_variables?: Record<string, string>; entrypoint?: string[] }
}
export interface Hardware {
  id: number
  name: string
  brand_name?: string
  max_gpus: number
  available: boolean
  available_count?: number
}
export interface Replica {
  location_id: number
  location_name: string
  available_count: number
  max_gpus: number
}
export interface DeploymentContainer {
  container_id: string
  status: string
  hardware: string
  brand_name: string
  uptime_percent: number
  gpus_per_container: number
  public_url: string
  events: { time: number; message: string }[]
  device_id?: string
  created_at?: number
}
export interface DeploymentCost {
  estimated_cost: number
  currency: string
  estimation_valid: boolean
  price_breakdown: { compute_cost: number; total_cost: number; hourly_rate: number; network_cost?: number; storage_cost?: number }
}
export interface ContainerDraft {
  image: string
  port: string
  env: unknown
  secrets: unknown
  entrypoint: unknown
  args: unknown
  registryUser: string
  registrySecret: string
  command: string
}
export interface CreateDraft extends ContainerDraft {
  name: string
  hardware: string
  gpus: string
  replicas: string
  duration: string
  locations: number[]
  currency: string
}
export const blankContainer: ContainerDraft = {
  image: '',
  port: '',
  env: {},
  secrets: {},
  entrypoint: [],
  args: [],
  registryUser: '',
  registrySecret: '',
  command: '',
}
export const blankCreate: CreateDraft = {
  ...blankContainer,
  image: 'ollama/ollama:latest',
  port: '11434',
  name: '',
  hardware: '',
  gpus: '1',
  replicas: '1',
  duration: '1',
  locations: [],
  currency: 'usdc',
}
