export type SortedEntry = { member: string; score: number }

export interface OnlineStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
  zadd(key: string, score: number, member: string): Promise<void>
  zrem(key: string, member: string): Promise<void>
  ztop(key: string, count: number): Promise<SortedEntry[]>
  zrank(key: string, member: string): Promise<number | null>
  incr(key: string, ttlSeconds: number): Promise<number>
}

type MemoryValue = { value: string; expiresAt: number | null }

export class MemoryStore implements OnlineStore {
  private values = new Map<string, MemoryValue>()
  private sets = new Map<string, Map<string, number>>()

  async get(key: string): Promise<string | null> {
    const item = this.values.get(key)
    if (!item) return null
    if (item.expiresAt !== null && item.expiresAt <= Date.now()) {
      this.values.delete(key)
      return null
    }
    return item.value
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.values.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    })
  }

  async del(key: string): Promise<void> {
    this.values.delete(key)
    this.sets.delete(key)
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    let set = this.sets.get(key)
    if (!set) {
      set = new Map()
      this.sets.set(key, set)
    }
    set.set(member, score)
  }

  async zrem(key: string, member: string): Promise<void> {
    this.sets.get(key)?.delete(member)
  }

  async ztop(key: string, count: number): Promise<SortedEntry[]> {
    const set = this.sets.get(key)
    if (!set) return []
    return [...set.entries()]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
  }

  async zrank(key: string, member: string): Promise<number | null> {
    const top = await this.ztop(key, Number.MAX_SAFE_INTEGER)
    const index = top.findIndex((entry) => entry.member === member)
    return index === -1 ? null : index
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const current = Number.parseInt((await this.get(key)) ?? '0', 10)
    const next = (Number.isFinite(current) ? current : 0) + 1
    const existing = this.values.get(key)
    const expiresAt = existing?.expiresAt ?? Date.now() + ttlSeconds * 1000
    this.values.set(key, { value: String(next), expiresAt })
    return next
  }
}

export class UpstashStore implements OnlineStore {
  private readonly url: string
  private readonly token: string

  constructor(url: string, token: string) {
    this.url = url.replace(/\/+$/, '')
    this.token = token
  }

  private async command<T>(args: Array<string | number>): Promise<T> {
    const response = await globalThis.fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    })
    if (!response.ok) throw new Error('UPSTASH_HTTP_ERROR')
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object' || !('result' in payload)) throw new Error('UPSTASH_BAD_RESPONSE')
    return (payload as { result: T }).result
  }

  async get(key: string): Promise<string | null> {
    const result = await this.command<string | null>(['GET', key])
    return result ?? null
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) await this.command(['SET', key, value, 'EX', ttlSeconds])
    else await this.command(['SET', key, value])
  }

  async del(key: string): Promise<void> {
    await this.command(['DEL', key])
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.command(['ZADD', key, score, member])
  }

  async zrem(key: string, member: string): Promise<void> {
    await this.command(['ZREM', key, member])
  }

  async ztop(key: string, count: number): Promise<SortedEntry[]> {
    const result = await this.command<Array<string | number>>(['ZREVRANGE', key, 0, count - 1, 'WITHSCORES'])
    const entries: SortedEntry[] = []
    for (let index = 0; index < result.length; index += 2) {
      entries.push({ member: String(result[index]), score: Number(result[index + 1]) })
    }
    return entries
  }

  async zrank(key: string, member: string): Promise<number | null> {
    const result = await this.command<number | null>(['ZREVRANK', key, member])
    return result === null ? null : Number(result)
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const value = Number(await this.command<number>(['INCR', key]))
    // Chỉ đặt TTL ở lần đếm đầu: các request sau tiết kiệm 1 lệnh HTTP.
    if (value === 1) await this.command(['EXPIRE', key, ttlSeconds])
    return value
  }
}

let devMemoryStore: MemoryStore | null = null
let warnedProductionMemory = false

export function getDevMemoryStore(): MemoryStore {
  if (!devMemoryStore) devMemoryStore = new MemoryStore()
  return devMemoryStore
}

export type OnlineConfig = {
  online: boolean
  store: OnlineStore | null
  secret: string
  passcode: string
  reason?: string
}

export function getOnlineConfig(
  env: Record<string, string | undefined>,
  storeOverride?: OnlineStore,
): OnlineConfig {
  const secret = env.ONLINE_SECRET?.trim() ?? ''
  const passcode = env.ADMIN_PASSCODE?.trim() ?? ''
  const url = env.UPSTASH_REDIS_REST_URL?.trim() || env.KV_REST_API_URL?.trim()
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim() || env.KV_REST_API_TOKEN?.trim()
  const production = env.VERCEL_ENV === 'production'
  const requestedMemory = env.ONLINE_DEV_MEMORY === '1'
  if (requestedMemory && production && !warnedProductionMemory) {
    warnedProductionMemory = true
    console.warn('ONLINE_DEV_MEMORY bị bỏ qua ở production; dùng Upstash hoặc chạy offline.')
  }
  const devMemory = requestedMemory && !production

  const store = storeOverride ?? (devMemory ? getDevMemoryStore() : url && token ? new UpstashStore(url, token) : null)

  if (!store) return { online: false, store: null, secret, passcode, reason: 'NO_STORE' }
  if (secret.length < 32) return { online: false, store: null, secret, passcode, reason: 'SHORT_SECRET' }
  if (passcode.length < 8) return { online: false, store: null, secret, passcode, reason: 'SHORT_PASSCODE' }
  return { online: true, store, secret, passcode }
}
