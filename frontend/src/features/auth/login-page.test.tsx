// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './login-page'
import { api } from '@/lib/api/client'
import { availableOAuthProviders } from './oauth'

const apiMock = vi.mocked(api)
vi.mock('@/lib/api/client', () => ({ api: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('./auth-shell', () => ({ AuthShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
vi.mock('./turnstile', () => ({
  Turnstile: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken('turnstile-token')}>
      Complete verification
    </button>
  ),
}))
vi.mock('./oauth', () => ({ availableOAuthProviders: vi.fn(() => []), createOAuthAuthorization: vi.fn() }))
vi.mock('./passkey/assertion', () => ({ requestPasskeyAssertion: vi.fn(), rememberPasskeyRPID: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ acceptSession: vi.fn() }))
vi.mock('@/lib/auth/password', () => ({ passwordPayload: async (password: string) => ({ password }) }))

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function wrapper(queryClient: QueryClient, children: ReactNode) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('LoginPage submission state', () => {
  let hydrationRoot: Root | undefined

  beforeEach(() => {
    apiMock.mockReset()
    vi.mocked(availableOAuthProviders).mockReturnValue([])
    apiMock.mockResolvedValue({ password_login_enabled: true, turnstile_check: false })
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(async () => {
    cleanup()
    if (hydrationRoot) {
      const root = hydrationRoot
      hydrationRoot = undefined
      await act(async () => root.unmount())
    }
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('hydrates a ready status without retaining the server-disabled submit control', async () => {
    const serverClient = client()
    const container = document.createElement('div')
    container.innerHTML = renderToString(wrapper(serverClient, <LoginPage />))
    document.body.appendChild(container)
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveProperty('disabled', true)

    const browserClient = client()
    browserClient.setQueryData(['status'], { password_login_enabled: true, turnstile_check: false })
    const hydrationErrors: string[] = []
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      const message = args.map(String).join(' ')
      if (message.includes('hydrated')) hydrationErrors.push(message)
    })

    await act(async () => {
      hydrationRoot = hydrateRoot(container, wrapper(browserClient, <LoginPage />))
      await Promise.resolve()
    })

    const submit = screen.getByRole('button', { name: 'Sign in' })
    expect(submit).toHaveProperty('disabled', false)
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'demo' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(screen.getByLabelText('Password').getAttribute('type')).toBe('text')
    expect(submit).toHaveProperty('disabled', false)
    expect(hydrationErrors).toEqual([])

    await serverClient.cancelQueries()
    await browserClient.cancelQueries()
  })

  it('keeps submission gated while status and Turnstile are incomplete', async () => {
    let resolveStatus: (value: unknown) => void = () => {}
    apiMock.mockReturnValue(
      new Promise((resolve) => {
        resolveStatus = resolve
      })
    )
    const queryClient = client()
    render(wrapper(queryClient, <LoginPage />))
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveProperty('disabled', true)

    await act(async () => {
      resolveStatus({ password_login_enabled: true, turnstile_check: true })
      await Promise.resolve()
    })
    expect(await screen.findByRole('button', { name: 'Complete verification' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: 'Complete verification' }))
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveProperty('disabled', false)
    await queryClient.cancelQueries()
  })

  it('rejects an expired verification flow without sending another verification request', () => {
    const queryClient = client()
    render(
      wrapper(
        queryClient,
        <LoginPage
          initialChallenge={{
            flow_token: 'expired-flow',
            expires_at: Math.floor(Date.now() / 1000) - 1,
            require_verification: true,
            methods: [{ method: '2fa', available: true }],
          }}
        />
      )
    )

    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByRole('alert').textContent).toContain('Login flow expired. Please sign in again.')
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', false)
    expect(apiMock).not.toHaveBeenCalledWith('/api/user/login/verify', expect.anything())
  })

  it('forwards custom returnTo to the sign-up link', () => {
    const queryClient = client()
    render(wrapper(queryClient, <LoginPage returnTo="/pricing/gpt-4o/connect?group=vip" />))
    expect(screen.getByRole('link', { name: 'Sign up' }).getAttribute('href')).toBe('/sign-up?redirect=%2Fpricing%2Fgpt-4o%2Fconnect%3Fgroup%3Dvip')
  })

  it('keeps distinct provider names visible when more than three providers share the default icon', async () => {
    vi.mocked(availableOAuthProviders).mockReturnValue(
      ['Company A', 'Company B', 'Company C', 'Company D'].map((name, index) => ({ slug: `company-${index}`, name }))
    )
    render(wrapper(client(), <LoginPage />))
    for (const name of ['Company A', 'Company B', 'Company C', 'Company D']) {
      const button = await screen.findByRole('button', { name })
      expect(button.textContent).toContain(name)
    }
  })
})
