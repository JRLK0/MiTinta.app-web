export const EXPIRED_RECOVERY_MESSAGE = 'El enlace de recuperación ha caducado o ya se ha utilizado. Introduce tu correo y solicita uno nuevo con «He olvidado mi contraseña».'

export function readAuthCallback(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const recovery = params.get('type') === 'recovery'
  const error = params.has('error') || params.has('error_code')
  return { recovery, error }
}

export function authCallbackMessage(callback: ReturnType<typeof readAuthCallback>, hasSession: boolean) {
  // Never show raw server descriptions or tokens from the URL.
  return callback.error || (callback.recovery && !hasSession) ? EXPIRED_RECOVERY_MESSAGE : ''
}
