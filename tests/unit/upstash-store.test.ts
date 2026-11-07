import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpstashStore } from '../../server/online/store'

describe('upstash store', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends REST commands with bearer token', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ result: 'value' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const store = new UpstashStore('https://upstash.example/', 'secret-token')

    expect(await store.get('ql:test')).toBe('value')
    await store.set('ql:test', 'abc', 60)
    await store.incr('ql:count', 60)

    const first = fetchMock.mock.calls[0]!
    expect(first[0]).toBe('https://upstash.example')
    const headers = first[1]!.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer secret-token')
    expect(JSON.parse(String(first[1]!.body))).toEqual(['GET', 'ql:test'])
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]!.body))).toEqual(['SET', 'ql:test', 'abc', 'EX', 60])
  })

  it('incr sets expire only on first hit', async () => {
    let incrCalls = 0
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const command = JSON.parse(String(init!.body)) as unknown[]
      const result = command[0] === 'INCR' ? (incrCalls++ === 0 ? 1 : 2) : 'OK'
      return new Response(JSON.stringify({ result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const store = new UpstashStore('https://upstash.example', 'token')

    expect(await store.incr('ql:count', 60)).toBe(1)
    expect(await store.incr('ql:count', 60)).toBe(2)

    const commands = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]!.body)) as unknown[])
    expect(commands.map((command) => command[0])).toEqual(['INCR', 'EXPIRE', 'INCR'])
    expect(commands[1]).toEqual(['EXPIRE', 'ql:count', 60])
  })

  it('maps sorted set top query results', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ result: ['id-1', 100, 'id-2', 50] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const store = new UpstashStore('https://upstash.example', 'token')

    const entries = await store.ztop('ql:board', 2)
    expect(entries).toEqual([
      { member: 'id-1', score: 100 },
      { member: 'id-2', score: 50 },
    ])
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual([
      'ZREVRANGE',
      'ql:board',
      0,
      1,
      'WITHSCORES',
    ])
  })
})
