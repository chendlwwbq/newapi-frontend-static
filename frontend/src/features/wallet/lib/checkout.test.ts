import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { response, submit } = vi.hoisted(() => ({ response: vi.fn(), submit: vi.fn() }))
vi.mock('@/lib/api/client', () => ({ apiResponse: response }))
vi.mock('./payment', () => ({ submitPaymentForm: submit }))
import { availablePaymentMethods, beginCheckout, safeCheckoutUrl, topupEndpoint } from './checkout'
import { normalizeTopupInfo } from './topup-info'
import type { TopupInfo } from '../types'

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllGlobals())
it.each(['javascript:alert(1)', 'data:text/html,bad', '/relative', 'file:///secret'])('rejects non-HTTP or relative checkout target %s', (value) => {
  expect(() => safeCheckoutUrl(value)).toThrow()
})
it('keeps each provider on its native endpoint', () => {
  expect(topupEndpoint('alipay', 'pay')).toBe('/api/user/pay')
  expect(topupEndpoint('stripe', 'amount')).toBe('/api/user/stripe/amount')
  expect(topupEndpoint('waffo:2', 'pay')).toBe('/api/user/waffo/pay')
  expect(topupEndpoint('waffo_pancake', 'pay')).toBe('/api/user/waffo-pancake/pay')
})
describe('configured payment controls', () => {
  const config = {
    payment_compliance_confirmed: false,
    enable_online_topup: true,
    enable_stripe_topup: false,
    pay_methods: [
      { type: 'alipay', name: 'Alipay' },
      { type: 'stripe', name: 'Stripe' },
    ],
  } as TopupInfo
  it('does not offer any method until the backend enables payments', () => {
    expect(availablePaymentMethods(config)).toEqual([])
  })
  it('offers only enabled methods', () => {
    expect(availablePaymentMethods({ ...config, payment_compliance_confirmed: true }).map((item) => item.type)).toEqual(['alipay'])
  })
  it('preserves the server index when an unnamed Waffo method is omitted', () => {
    const info = normalizeTopupInfo({
      ...config,
      payment_compliance_confirmed: true,
      enable_waffo_topup: true,
      waffo_pay_methods: [{ name: '' }, { name: 'Card' }],
      amount_options: [],
      discount: {},
    } as TopupInfo)
    expect(availablePaymentMethods(info).find((method) => method.name === 'Card')?.type).toBe('waffo:1')
  })
})
it('passes exactly the server form fields to Epay', async () => {
  response.mockResolvedValue({ message: 'success', url: 'https://pay.example.test/submit', data: { sign: 'signed', amount: '10' } })
  await beginCheckout('/api/user/pay', { amount: 10 })
  expect(submit).toHaveBeenCalledWith('https://pay.example.test/submit', { sign: 'signed', amount: '10' })
})
it('does not submit a form or navigate on an incomplete payment result', async () => {
  const assign = vi.fn()
  vi.stubGlobal('window', { location: { assign } })
  response.mockResolvedValue({ success: true, data: {} })
  await expect(beginCheckout('/api/user/stripe/pay', {})).rejects.toThrow('Payment request failed')
  expect(submit).not.toHaveBeenCalled()
  expect(assign).not.toHaveBeenCalled()
})
