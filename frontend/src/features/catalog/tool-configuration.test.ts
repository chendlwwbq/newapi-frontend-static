import { describe, expect, it } from 'vitest'
import { toolConfiguration } from './tool-configuration'

describe('tool connection configuration', () => {
  it('encodes the selected model and gateway as TOML values and references an environment key', () => {
    const result = toolConfiguration('codex', 'https://gateway.test/prefix', 'model/"quoted"\nname')
    expect(result).toContain('model = "model/\\"quoted\\"\\nname"')
    expect(result).toContain('base_url = "https://gateway.test/prefix/v1"')
    expect(result).toContain('env_key = "NEW_API_KEY"')
  })
  it('quotes model identifiers safely for PowerShell and Bash', () => {
    const model = "m'$(touch bad)"
    expect(toolConfiguration('claude', 'https://gateway.test', model, 'powershell')).toContain("$env:ANTHROPIC_MODEL = 'm''$(touch bad)'")
    expect(toolConfiguration('claude', 'https://gateway.test', model, 'bash')).toContain("export ANTHROPIC_MODEL='m'\\''$(touch bad)'")
    expect(toolConfiguration('claude', 'https://gateway.test', model, 'bash')).toContain('ANTHROPIC_AUTH_TOKEN="$NEW_API_KEY"')
  })
})
