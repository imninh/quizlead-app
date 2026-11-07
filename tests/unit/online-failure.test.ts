import { describe, expect, it } from 'vitest'
import { onlineFailureFor } from '../../src/services/onlineClient'

describe('onlineFailureFor', () => {
  it('explains the anti-cheat rejection and hides retry', () => {
    const failure = onlineFailureFor('SUSPICIOUS')
    expect(failure.message).toContain('nhanh bất thường')
    expect(failure.canRetry).toBe(false)
  })

  it('does not offer retry for an expired or used attempt', () => {
    expect(onlineFailureFor('INVALID_TOKEN').canRetry).toBe(false)
    expect(onlineFailureFor('TOKEN_USED').canRetry).toBe(false)
  })

  it('offers retry for network and server errors', () => {
    expect(onlineFailureFor('NETWORK').canRetry).toBe(true)
    expect(onlineFailureFor('UPSTREAM').canRetry).toBe(true)
    expect(onlineFailureFor('RATE_LIMIT').canRetry).toBe(true)
  })
})
