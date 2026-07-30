import { dispatchSessionExpired } from './session'

const CSRF_COOKIE = 'csrf-token'
const CSRF_HEADER = 'x-csrf-token'

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]*)`))
  return match ? (match[1] ?? null) : null
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method || (typeof input === 'object' && 'method' in input ? (input as Request).method : undefined) || 'GET').toUpperCase()

  if (!SAFE_METHODS.has(method)) {
    const token = getCsrfToken()
    if (token) {
      init = {
        ...init,
        headers: {
          ...init?.headers,
          [CSRF_HEADER]: token,
        },
      }
    }
  }

  const response = await fetch(input, init)

  if (response.status === 401 && typeof window !== 'undefined') {
    const data = await response.clone().json().catch(() => ({}))
    if (data?.code === 'UNAUTHORIZED') {
      dispatchSessionExpired()
    }
  }

  return response
}
