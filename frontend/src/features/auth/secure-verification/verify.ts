'use client'
import { api } from '@/lib/api/client'
import { passwordPayload } from '@/lib/auth/password'
import { AuthOperationError } from '@/lib/secure-verification'
import { requestPasskeyAssertion, rememberPasskeyRPID, type PasskeyDomains } from '../passkey/assertion'
import { openOAuthPopup } from '../lib/oauth-popup'
import { createOAuthAuthorization } from '../oauth'
import type { SystemStatus } from '../types'
import type { SecurityProof, VerificationInput, VerificationOperation } from './types'

export function validateSecurityProof(proof: SecurityProof, operation: VerificationOperation, method: VerificationInput['method']) {
  if (
    !proof?.proof_token ||
    proof.scope !== operation.scope ||
    proof.method !== method ||
    !Number.isFinite(proof.expires_at) ||
    proof.expires_at * 1000 <= Date.now()
  )
    throw new AuthOperationError('Verification proof was not returned')
  return proof
}

export async function verifySecurityOperation(
  input: VerificationInput,
  operation: VerificationOperation,
  encryption: boolean,
  signal: AbortSignal,
  onDomains: (domains: PasskeyDomains) => void
): Promise<SecurityProof> {
  let proof: SecurityProof
  if (input.method === 'passkey') {
    const assertion = await requestPasskeyAssertion(
      (rpID) => api('/api/user/passkey/verify/begin', { method: 'POST', signal, body: { ...operation, ...(rpID ? { rp_id: rpID } : {}) } }),
      signal,
      { rpID: input.rpID, onDomains }
    )
    proof = await api('/api/user/passkey/verify/finish', {
      method: 'POST',
      signal,
      body: { flow_token: assertion.flowToken, credential: assertion.assertion },
    })
    signal.throwIfAborted()
    validateSecurityProof(proof, operation, input.method)
    rememberPasskeyRPID(assertion.rpID)
  } else if (input.method === 'oauth') {
    const exchange = await openOAuthPopup({
      provider: input.provider,
      intent: 'verify',
      signal,
      prepare: async (popupSignal) => {
        const status = await api<SystemStatus>('/api/status', { anonymous: true, signal: popupSignal })
        return createOAuthAuthorization(input.provider, 'verify', status, popupSignal, operation)
      },
    })
    try {
      const callback = exchange.callback
      proof = await api(
        `/api/oauth/${encodeURIComponent(input.provider)}?${new URLSearchParams({ state: callback.state, ...(callback.code ? { code: callback.code } : {}), ...(callback.error ? { error: callback.error } : {}), ...(callback.errorDescription ? { error_description: callback.errorDescription } : {}) })}`,
        { signal: exchange.signal }
      )
      exchange.signal.throwIfAborted()
      validateSecurityProof(proof, operation, input.method)
      exchange.finish({ success: true })
    } catch (error) {
      exchange.finish({ success: false, message: (error as Error).message })
      throw error
    }
  } else {
    const fields =
      input.method === 'password'
        ? encryption
          ? await passwordPayload(input.password)
          : { password: input.password }
        : input.method === '2fa'
          ? { code: input.code.trim() }
          : {}
    signal.throwIfAborted()
    proof = await api('/api/verify', { method: 'POST', signal, body: { ...operation, method: input.method, ...fields } })
  }
  signal.throwIfAborted()
  return validateSecurityProof(proof, operation, input.method)
}
