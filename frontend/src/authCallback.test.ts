import { describe, expect, it } from 'vitest'
import { authCallbackMessage, EXPIRED_RECOVERY_MESSAGE, readAuthCallback } from './authCallback'

describe('password recovery callbacks', () => {
  it('captures recovery before the SDK removes the URL fragment', () => {
    const callback = readAuthCallback('#access_token=private&refresh_token=private&type=recovery')
    expect(callback).toEqual({ recovery: true, error: false })
    expect(authCallbackMessage(callback, true)).toBe('')
    expect(authCallbackMessage(callback, false)).toBe(EXPIRED_RECOVERY_MESSAGE)
  })
  it('reports expired or consumed links even with a previous signed-in session', () => {
    const callback = readAuthCallback('#error=access_denied&error_code=otp_expired&error_description=private')
    expect(authCallbackMessage(callback, true)).toBe(EXPIRED_RECOVERY_MESSAGE)
    expect(authCallbackMessage(callback, false)).toBe(EXPIRED_RECOVERY_MESSAGE)
  })
  it('does not confuse email confirmation or normal navigation with recovery', () => {
    expect(readAuthCallback('#type=signup').recovery).toBe(false)
    expect(authCallbackMessage(readAuthCallback(''), false)).toBe('')
  })
})
