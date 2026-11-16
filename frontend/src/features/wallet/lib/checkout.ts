import { apiResponse } from '@/lib/api/client'
import { submitPaymentForm } from './payment'
import type { PaymentMethod, TopupInfo } from '../types'

export function availablePaymentMethods(info: TopupInfo): PaymentMethod[] {
  if (!info.payment_compliance_confirmed) return []
  const methods = info.pay_methods.filter((method) => {
    if (method.type === 'stripe') return info.enable_stripe_topup
    if (method.type === 'creem') return false // Products use their own checkout.
    if (method.type === 'waffo_pancake') return info.enable_waffo_pancake_topup
    if (method.type === 'waffo') return false // Display the server-indexed Waffo methods below.
    return info.enable_online_topup
  })
  return [
    ...methods,
    ...(info.enable_waffo_topup
      ? (info.waffo_pay_methods || []).map((method, index) => ({
          name: method.name,
          type: `waffo:${method.sourceIndex ?? index}`,
          min_topup: info.waffo_min_topup,
        }))
      : []),
  ]
}

export function topupEndpoint(type: string, action: 'amount' | 'pay') {
  const provider = type.startsWith('waffo:') ? 'waffo' : type
  return `/api/user/${provider === 'stripe' || provider === 'waffo' || provider === 'waffo_pancake' ? `${provider.replace('_', '-')}/` : ''}${action}`
}

export function safeCheckoutUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Invalid payment redirect URL')
  return url.href
}

// Payment endpoints use both native response envelopes; retain Epay's top-level
// URL and submit only the fields returned by the server.
export async function beginCheckout(path: string, body: unknown) {
  const response = await apiResponse<Record<string, unknown>>(path, { method: 'POST', body })
  if (response.success !== true && response.message !== 'success') throw new Error('Payment request failed')
  if (response.url) {
    submitPaymentForm(safeCheckoutUrl(response.url), response.data || {})
    return
  }
  const url = response.data?.pay_link || response.data?.checkout_url || response.data?.payment_url
  if (typeof url !== 'string') throw new Error('Payment request failed')
  window.location.assign(safeCheckoutUrl(url))
}
