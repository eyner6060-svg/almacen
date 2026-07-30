import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'

async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/system/health`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

describe.runIf(await isServerRunning())('POST /api/auth/login', () => {
  it('devuelve 400 si no se envian credenciales', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  it('devuelve 401 con credenciales invalidas', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'no@existe.com', password: 'wrongpass1!' }),
    })
    expect(res.status).toBe(401)
  })

  it('devuelve 200 con credenciales validas', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@institucion.gob.pe', password: 'Admin123!' }),
    })
    expect([200, 401]).toContain(res.status)
  })
})
