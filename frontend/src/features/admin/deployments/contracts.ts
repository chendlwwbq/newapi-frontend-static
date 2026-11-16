import { isRecord } from '../lib/settings-collections'
import type { ContainerDraft, CreateDraft, DeploymentDetail } from './types'

export function deploymentCostParameters(draft: Pick<CreateDraft, 'hardware' | 'gpus' | 'replicas' | 'duration' | 'locations' | 'currency'>) {
  const [hardware, gpus, replicas, duration] = [draft.hardware, draft.gpus, draft.replicas, draft.duration].map(Number)
  if ([hardware, gpus, replicas, duration, ...draft.locations].some((value) => !Number.isSafeInteger(value) || value < 1) || !draft.locations.length)
    throw new Error('Choose hardware, locations and positive resource quantities')
  return {
    hardware_id: hardware,
    gpus_per_container: gpus,
    replica_count: replicas,
    duration_hours: duration,
    location_ids: [...new Set(draft.locations)],
    currency: draft.currency.trim().toLowerCase() || 'usdc',
    duration_type: 'hour',
    duration_qty: duration,
    hardware_qty: gpus,
  }
}
export function deploymentContainerConfig(draft: ContainerDraft) {
  if (
    !isRecord(draft.env) ||
    !isRecord(draft.secrets) ||
    [...Object.values(draft.env), ...Object.values(draft.secrets)].some((value) => typeof value !== 'string')
  )
    throw new Error('Environment values must be JSON strings')
  if (![draft.entrypoint, draft.args].every((value) => Array.isArray(value) && value.every((item) => typeof item === 'string')))
    throw new Error('Commands and arguments must be JSON arrays of strings')
  const config: Record<string, unknown> = {}
  for (const [key, value] of [
    ['env_variables', draft.env],
    ['secret_env_variables', draft.secrets],
  ] as const)
    if (Object.keys(value).length) config[key] = value
  for (const [key, value] of [
    ['entrypoint', draft.entrypoint],
    ['args', draft.args],
  ] as const)
    if ((value as string[]).length) config[key] = value
  if (draft.port.trim()) {
    const port = Number(draft.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid numeric setting')
    config.traffic_port = port
  }
  return config
}
export function deploymentCreatePayload(draft: CreateDraft) {
  const cost = deploymentCostParameters(draft)
  if (!draft.name.trim() || !draft.image.trim()) throw new Error('Deployment name and image are required')
  return {
    resource_private_name: draft.name.trim(),
    duration_hours: cost.duration_hours,
    hardware_id: cost.hardware_id,
    gpus_per_container: cost.gpus_per_container,
    location_ids: cost.location_ids,
    container_config: { ...deploymentContainerConfig(draft), replica_count: cost.replica_count },
    registry_config: {
      image_url: draft.image.trim(),
      ...(draft.registryUser.trim() ? { registry_username: draft.registryUser.trim() } : {}),
      ...(draft.registrySecret ? { registry_secret: draft.registrySecret } : {}),
    },
  }
}
export function deploymentUpdatePayload(draft: ContainerDraft) {
  const config = deploymentContainerConfig(draft)
  if (draft.image.trim()) config.image_url = draft.image.trim()
  if (draft.registryUser.trim()) config.registry_username = draft.registryUser.trim()
  if (draft.registrySecret) config.registry_secret = draft.registrySecret
  if (draft.command.trim()) config.command = draft.command
  return config
}
export function deploymentExtensionParameters(detail: DeploymentDetail, hours: string) {
  return deploymentCostParameters({
    hardware: String(detail.hardware_id),
    gpus: String(detail.gpus_per_container),
    replicas: String(detail.total_containers),
    locations: detail.locations.map((location) => location.id),
    duration: hours,
    currency: 'usdc',
  })
}
export function deploymentPath(id: string, tail = '') {
  return `/api/deployments/${encodeURIComponent(id)}${tail}`
}
