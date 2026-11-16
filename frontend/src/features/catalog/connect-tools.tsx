'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { CopyButton } from '@/components/shared/copy-button'
import { toolConfiguration } from './tool-configuration'
import { ClientConnection } from '@/features/chat/chat-clients'
import type { Offering } from '@/lib/api/types'

const preset = { id: 'ccswitch', name: 'CC Switch', url: 'ccswitch', type: 'custom-protocol' } as const
export function ConnectTools({
  route,
  model,
  address,
  signedIn,
  returnTo,
}: {
  route: Offering
  model: string
  address: string
  signedIn: boolean
  returnTo: string
}) {
  const { t } = useTranslation()
  const [app, setApp] = useState<'codex' | 'claude' | null>(null)
  const [shell, setShell] = useState<'bash' | 'powershell'>('powershell')
  const protocols = new Set(route.access.flatMap((item) => item.protocols))
  if (!protocols.has('openai-response') && !protocols.has('anthropic')) return null
  const activeApp = (app === 'codex' && protocols.has('openai-response')) || (app === 'claude' && protocols.has('anthropic')) ? app : null
  const modelId = route.invocation_id || model
  return (
    <section className="connect-tools">
      <h2>CC Switch</h2>
      {signedIn ? (
        <div className="action-buttons">
          {protocols.has('openai-response') && (
            <Button type="button" variant="outline" onClick={() => setApp('codex')}>
              Codex CLI
            </Button>
          )}
          {protocols.has('anthropic') && (
            <Button type="button" variant="outline" onClick={() => setApp('claude')}>
              Claude Code
            </Button>
          )}
        </div>
      ) : (
        <Link className="pill-button secondary" href={`/sign-in?redirect=${encodeURIComponent(returnTo)}`}>
          {t('Sign in')}
        </Link>
      )}
      {signedIn && activeApp && (
        <ClientConnection
          key={`${activeApp}:${route.offering_key}:${modelId}:${route.name}`}
          preset={preset}
          address={address}
          initialApp={activeApp}
          initialModel={modelId}
          requiredGroup={route.name}
          onClose={() => setApp(null)}
        />
      )}
      <p className="small-note">{t('Examples are not executed. Set NEW_API_KEY in your environment before running them.')}</p>
      {protocols.has('openai-response') && (
        <details>
          <summary>Codex CLI · {t('Connection settings')}</summary>
          <div className="code-preview">
            <div>
              <span>~/.codex/eva.config.toml</span>
              <CopyButton value={toolConfiguration('codex', address, modelId)} />
            </div>
            <pre>{toolConfiguration('codex', address, modelId)}</pre>
          </div>
          <div className="code-preview">
            <div>
              <span>Codex CLI</span>
              <CopyButton value="codex --profile eva" />
            </div>
            <pre>codex --profile eva</pre>
          </div>
          <Link href="/docs/codex-cli" className="text-link">
            {t('Docs')} ↗
          </Link>
        </details>
      )}
      {protocols.has('anthropic') && (
        <details>
          <summary>Claude Code · {t('Connection settings')}</summary>
          <div className="action-buttons">
            <Button type="button" variant="ghost" aria-pressed={shell === 'powershell'} onClick={() => setShell('powershell')}>
              PowerShell
            </Button>
            <Button type="button" variant="ghost" aria-pressed={shell === 'bash'} onClick={() => setShell('bash')}>
              Bash
            </Button>
          </div>
          <div className="code-preview">
            <div>
              <span>{shell === 'powershell' ? 'PowerShell' : 'Bash'}</span>
              <CopyButton value={toolConfiguration('claude', address, modelId, shell)} />
            </div>
            <pre>{toolConfiguration('claude', address, modelId, shell)}</pre>
          </div>
          <Link href="/docs/claude-code" className="text-link">
            {t('Docs')} ↗
          </Link>
        </details>
      )}
    </section>
  )
}
