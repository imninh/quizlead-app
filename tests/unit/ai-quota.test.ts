import { describe, expect, it } from 'vitest'
import { aiQuotaLimits, checkAiQuota, secondsToVietnamMidnight, vietnamDay } from '../../server/aiQuota'
import { MemoryStore } from '../../server/online/store'

// 10:00 sáng giờ Việt Nam ngày 02/01/2026.
const VN_MORNING = Date.UTC(2026, 0, 2, 3, 0, 0)
const IP = '203.0.113.10'

function deps(store: MemoryStore, now = VN_MORNING, env: Record<string, string | undefined> = {}) {
  return { store, ip: IP, kind: 'generate' as const, env, now }
}

describe('ai quota', () => {
  it('per ip limit blocks the sixth generate call in a minute', async () => {
    const store = new MemoryStore()
    for (let index = 0; index < 5; index++) {
      expect(await checkAiQuota(deps(store))).toEqual({ allowed: true })
    }
    const blocked = await checkAiQuota(deps(store))
    expect(blocked).toMatchObject({ allowed: false, code: 'RATE_LIMIT' })
  })

  it('ghost per ip limit is three per minute', async () => {
    const store = new MemoryStore()
    for (let index = 0; index < 3; index++) {
      expect(await checkAiQuota({ ...deps(store), kind: 'ghost' })).toEqual({ allowed: true })
    }
    const blocked = await checkAiQuota({ ...deps(store), kind: 'ghost' })
    expect(blocked).toMatchObject({ allowed: false, code: 'RATE_LIMIT' })
  })

  it('daily cap blocks after the limit and resets at vietnam midnight', async () => {
    const store = new MemoryStore()
    const env = { AI_DAILY_LIMIT: '1' }
    const lateNight = Date.UTC(2026, 0, 2, 16, 30, 0) // 23:30 giờ Việt Nam
    expect(await checkAiQuota(deps(store, lateNight, env))).toEqual({ allowed: true })

    const blocked = await checkAiQuota(deps(store, lateNight, env))
    expect(blocked).toMatchObject({ allowed: false, code: 'DAILY_LIMIT' })
    if (!blocked.allowed) expect(blocked.retryAfter).toBe(1800)

    const justAfterMidnight = Date.UTC(2026, 0, 2, 17, 0, 1) // 00:00:01 ngày 03/01 giờ Việt Nam
    expect(vietnamDay(justAfterMidnight)).toBe('2026-01-03')
    expect(await checkAiQuota(deps(store, justAfterMidnight, env))).toEqual({ allowed: true })
  })

  it('blocked by ip does not consume the daily cap', async () => {
    const store = new MemoryStore()
    const env = { AI_RATE_LIMIT_PER_MIN: '1' }
    expect(await checkAiQuota(deps(store, VN_MORNING, env))).toEqual({ allowed: true })
    expect(await checkAiQuota(deps(store, VN_MORNING, env))).toMatchObject({
      allowed: false,
      code: 'RATE_LIMIT',
    })
    expect(await store.get(`ql:ai:day:generate:${vietnamDay(VN_MORNING)}`)).toBe('1')
  })

  it('env overrides default limits', async () => {
    const env = {
      AI_RATE_LIMIT_PER_MIN: '2',
      AI_DAILY_LIMIT: '10',
      AI_GHOST_RATE_LIMIT_PER_MIN: '1',
      AI_GHOST_DAILY_LIMIT: '7',
    }
    expect(aiQuotaLimits('generate', env)).toEqual({ perMinute: 2, perDay: 10 })
    expect(aiQuotaLimits('ghost', env)).toEqual({ perMinute: 1, perDay: 7 })

    const store = new MemoryStore()
    expect(await checkAiQuota(deps(store, VN_MORNING, env))).toEqual({ allowed: true })
    expect(await checkAiQuota(deps(store, VN_MORNING, env))).toEqual({ allowed: true })
    expect(await checkAiQuota(deps(store, VN_MORNING, env))).toMatchObject({
      allowed: false,
      code: 'RATE_LIMIT',
    })

    const dailyStore = new MemoryStore()
    const dailyEnv = { AI_DAILY_LIMIT: '1', AI_RATE_LIMIT_PER_MIN: '10' }
    expect(await checkAiQuota(deps(dailyStore, VN_MORNING, dailyEnv))).toEqual({ allowed: true })
    expect(await checkAiQuota({ ...deps(dailyStore, VN_MORNING, dailyEnv), ip: '198.51.100.4' })).toMatchObject({
      allowed: false,
      code: 'DAILY_LIMIT',
    })
  })

  it('vietnam midnight helper returns seconds to next day', () => {
    expect(secondsToVietnamMidnight(Date.UTC(2026, 0, 2, 16, 30, 0))).toBe(1800)
  })
})
