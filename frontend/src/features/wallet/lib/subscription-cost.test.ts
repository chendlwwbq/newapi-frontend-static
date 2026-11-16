import { expect, it } from 'vitest'
import { subscriptionBalanceCost } from './subscription-cost'

it('matches decimal ceiling for balance-paid subscriptions', () => {
  expect(subscriptionBalanceCost(0.000246, 500000)).toBe(123)
  expect(subscriptionBalanceCost(0.000247, 500000)).toBe(124)
  expect(subscriptionBalanceCost(0, 500000)).toBe(0)
  expect(subscriptionBalanceCost(1e-7, 500000)).toBe(1)
  expect(subscriptionBalanceCost(1, 0)).toBeNull()
  expect(subscriptionBalanceCost(Number.MAX_VALUE, 500000)).toBeNull()
})
