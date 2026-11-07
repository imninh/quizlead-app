import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkAdminPasscode } from '../../src/services/onlineClient'

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })),
  )
}

describe('checkAdminPasscode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports ok when the server accepts the passcode', async () => {
    mockFetch(200, { ok: true })
    await expect(checkAdminPasscode('88888888')).resolves.toMatchObject({ status: 'ok' })
  })

  it('reports wrong only when the server says UNAUTHORIZED', async () => {
    mockFetch(401, { ok: false, code: 'UNAUTHORIZED', message: 'Passcode không đúng.' })
    await expect(checkAdminPasscode('nope')).resolves.toMatchObject({ status: 'wrong' })
  })

  it('reports locked after too many failures', async () => {
    mockFetch(429, { ok: false, code: 'PASSCODE_LOCKED', message: 'x' })
    await expect(checkAdminPasscode('nope')).resolves.toMatchObject({ status: 'locked' })
  })

  it('reports a server error instead of a wrong passcode when the store fails', async () => {
    mockFetch(500, { ok: false, code: 'UPSTREAM', message: 'Không xử lý được yêu cầu online.' })
    const result = await checkAdminPasscode('88888888')
    expect(result.status).toBe('error')
    expect(result.message).not.toContain('không đúng')
  })
})
