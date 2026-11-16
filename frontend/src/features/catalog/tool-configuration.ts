export function toolConfiguration(app: 'codex' | 'claude', address: string, model: string, shell: 'bash' | 'powershell' = 'bash') {
  if (app === 'codex')
    return `model = ${JSON.stringify(model)}\nmodel_provider = "eva"\n\n[model_providers.eva]\nname = "eva"\nbase_url = ${JSON.stringify(`${address}/v1`)}\nenv_key = "NEW_API_KEY"\nwire_api = "responses"\nsupports_websockets = false`
  if (shell === 'powershell') {
    const quote = (value: string) => `'${value.replaceAll("'", "''")}'`
    return `$env:ANTHROPIC_BASE_URL = ${quote(address)}\n$env:ANTHROPIC_MODEL = ${quote(model)}\n$env:ANTHROPIC_AUTH_TOKEN = $env:NEW_API_KEY`
  }
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
  return `export ANTHROPIC_BASE_URL=${quote(address)}\nexport ANTHROPIC_MODEL=${quote(model)}\nexport ANTHROPIC_AUTH_TOKEN="$NEW_API_KEY"`
}
