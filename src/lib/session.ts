'use client'

const SESSION_EXPIRED_EVENT = 'session:expired'

export function dispatchSessionExpired() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
}

export function onSessionExpired(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(SESSION_EXPIRED_EVENT, callback)
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, callback)
}
