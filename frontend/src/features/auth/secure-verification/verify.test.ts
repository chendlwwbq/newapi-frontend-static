import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SecurityProof, VerificationOperation } from './types'

const { call, passwordPayload, assertion } = vi.hoisted(() => ({ call: vi.fn(), passwordPayload: vi.fn(), assertion: vi.fn() }))
vi.mock('@/lib/api/client', () => ({ api: call, ApiError: class extends Error {} }))
vi.mock('@/lib/auth/password', () => ({ passwordPayload }))
vi.mock('../passkey/assertion', () => ({ requestPasskeyAssertion: assertion, rememberPasskeyRPID: vi.fn() }))
vi.mock('../lib/oauth-popup', () => ({ openOAuthPopup: vi.fn() }))
import { validateSecurityProof, verifySecurityOperation } from './verify'

const operation: VerificationOperation = { scope: '2fa.setup' }
const proof: SecurityProof = { proof_token: 'one-use-proof', method: 'password', scope: '2fa.setup', expires_at: 2_000_000_000 }

describe('security approval boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Date, 'now').mockReturnValue(1_900_000_000_000)
  })
  it.each([
    { ...proof, proof_token: '' },
    { ...proof, scope: '2fa.disable' },
    { ...proof, method: 'session' },
    { ...proof, expires_at: 1_900_000_000 },
    { ...proof, expires_at: Number.NaN },
  ])('rejects missing, wrong-scope, downgraded and expired approvals', (invalid) => {
    expect(() => validateSecurityProof(invalid as SecurityProof, operation, 'password')).toThrow('Verification proof was not returned')
  })
  it('uses the native encrypted password fields without sending plaintext', async () => {
    passwordPayload.mockResolvedValue({ password_encrypted: 'ciphertext', encryption_key_id: 'key-id' })
    call.mockResolvedValue(proof)
    await verifySecurityOperation({ method: 'password', password: 'secret' }, operation, true, new AbortController().signal, vi.fn())
    expect(call).toHaveBeenCalledOnce()
    expect(call.mock.calls[0][1].body).toEqual({
      scope: '2fa.setup',
      method: 'password',
      password_encrypted: 'ciphertext',
      encryption_key_id: 'key-id',
    })
  })
  it('never retries a rejected approval', async () => {
    call.mockRejectedValue(new Error('Invalid verification code'))
    await expect(verifySecurityOperation({ method: '2fa', code: '123456' }, operation, false, new AbortController().signal, vi.fn())).rejects.toThrow(
      'Invalid verification code'
    )
    expect(call).toHaveBeenCalledOnce()
  })
  it('does not submit after cancellation while encrypting', async () => {
    const controller = new AbortController()
    passwordPayload.mockImplementation(async () => {
      controller.abort()
      return { password_encrypted: 'ciphertext' }
    })
    await expect(verifySecurityOperation({ method: 'password', password: 'secret' }, operation, true, controller.signal, vi.fn())).rejects.toThrow()
    expect(call).not.toHaveBeenCalled()
  })
  it('binds protected actions to their exact context', async () => {
    const action: VerificationOperation = { scope: 'admin.user.manage', context: { user_id: 2, action: 'disable' } }
    call.mockResolvedValue({ ...proof, method: '2fa', scope: action.scope })
    await verifySecurityOperation({ method: '2fa', code: ' 123456 ' }, action, false, new AbortController().signal, vi.fn())
    expect(call.mock.calls[0][1].body).toEqual({ ...action, method: '2fa', code: '123456' })
  })
})
