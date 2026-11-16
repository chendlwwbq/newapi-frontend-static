import { describe, it, expect } from 'vitest'
import { blankCreate, blankContainer, type DeploymentDetail } from '../types'
import {
  deploymentCreatePayload,
  deploymentCostParameters,
  deploymentUpdatePayload,
  deploymentExtensionParameters,
  deploymentPath,
} from '../contracts'
const draft = { ...blankCreate, name: '  eva-local-review  ', hardware: '7', locations: [3, 4], gpus: '2', replicas: '3', duration: '4' }
describe('native deployment request contracts', () => {
  it('preserves location and replica selection in cost and create requests', () => {
    expect(deploymentCostParameters(draft)).toEqual({
      hardware_id: 7,
      gpus_per_container: 2,
      replica_count: 3,
      duration_hours: 4,
      location_ids: [3, 4],
      currency: 'usdc',
      duration_type: 'hour',
      duration_qty: 4,
      hardware_qty: 2,
    })
    expect(deploymentCreatePayload(draft)).toEqual({
      resource_private_name: 'eva-local-review',
      duration_hours: 4,
      gpus_per_container: 2,
      hardware_id: 7,
      location_ids: [3, 4],
      container_config: { traffic_port: 11434, replica_count: 3 },
      registry_config: { image_url: 'ollama/ollama:latest' },
    })
  })
  it('preserves spaces inside command arguments and literal environment values', () => {
    const payload = deploymentCreatePayload({
      ...draft,
      entrypoint: ['/bin/sh', '-c'],
      args: ['echo "hello world"', '--literal=a b'],
      env: { EMPTY: '', NUMBER: '0' },
      secrets: { KEY: 'local-placeholder' },
      registrySecret: ' local secret ',
    })
    expect(payload.container_config).toMatchObject({
      entrypoint: ['/bin/sh', '-c'],
      args: ['echo "hello world"', '--literal=a b'],
      env_variables: { EMPTY: '', NUMBER: '0' },
      secret_env_variables: { KEY: 'local-placeholder' },
    })
    expect(payload.registry_config.registry_secret).toBe(' local secret ')
  })
  it.each(['0', '-1', '1.5', 'NaN', '9007199254740992'])('rejects invalid resource quantities %s before creating or estimating', (replicas) => {
    expect(() => deploymentCreatePayload({ ...draft, replicas })).toThrow()
  })
  it('does not silently coerce malformed environment or argument JSON', () => {
    expect(() => deploymentCreatePayload({ ...draft, env: { NUMBER: 0 } })).toThrow('Environment values must be JSON strings')
    expect(() => deploymentCreatePayload({ ...draft, args: 'command with spaces' })).toThrow('Commands and arguments must be JSON arrays of strings')
  })
  it('omits blank optional update fields instead of clearing stored secrets', () => {
    expect(deploymentUpdatePayload(blankContainer)).toEqual({})
    expect(deploymentUpdatePayload({ ...blankContainer, port: '443', command: 'python app.py', secrets: { NEW: 'placeholder' } })).toEqual({
      traffic_port: 443,
      command: 'python app.py',
      secret_env_variables: { NEW: 'placeholder' },
    })
  })
  it.each(['0', '65536', '1.5'])('rejects invalid container ports %s', (port) => {
    expect(() => deploymentUpdatePayload({ ...blankContainer, port })).toThrow('Invalid numeric setting')
  })
  it('derives extension estimates from provider details without inventing missing resources', () => {
    const detail = { hardware_id: 7, gpus_per_container: 2, total_containers: 3, locations: [{ id: 3 }, { id: 4 }] } as DeploymentDetail
    expect(deploymentExtensionParameters(detail, '4')).toEqual(deploymentCostParameters(draft))
    expect(() => deploymentExtensionParameters({ ...detail, locations: [] }, '4')).toThrow()
  })
  it('encodes opaque provider IDs as single path segments', () => {
    expect(deploymentPath('id/with?query', '/name')).toBe('/api/deployments/id%2Fwith%3Fquery/name')
  })
})
