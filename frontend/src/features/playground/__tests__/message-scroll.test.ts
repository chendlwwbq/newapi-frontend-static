import { describe, expect, it } from 'vitest'
import { followsLatestMessage } from '../lib/message-scroll'

describe('conversation scrolling', () => {
  it('follows new messages when the reader is near the bottom', () => {
    expect(followsLatestMessage(1000, 500, 470)).toBe(true)
  })

  it('leaves the reader in place when they scroll up', () => {
    expect(followsLatestMessage(1000, 500, 400)).toBe(false)
  })
})
