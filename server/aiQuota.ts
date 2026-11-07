import type { OnlineStore } from './online/store.ts'

export type AiQuotaKind = 'generate' | 'ghost'

export type AiQuotaResult =
  | { allowed: true }
  | { allowed: false; code: 'RATE_LIMIT' | 'DAILY_LIMIT'; retryAfter: number }

type AiQuotaInput = {
  store: OnlineStore
  ip: string
  kind: AiQuotaKind
  env: Record<string, string | undefined>
  now: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function aiQuotaLimits(kind: AiQuotaKind, env: Record<string, string | undefined>) {
  if (kind === 'ghost') {
    return {
      perMinute: positiveInt(env.AI_GHOST_RATE_LIMIT_PER_MIN, 3),
      perDay: positiveInt(env.AI_GHOST_DAILY_LIMIT, 100),
    }
  }
  return {
    perMinute: positiveInt(env.AI_RATE_LIMIT_PER_MIN, 5),
    perDay: positiveInt(env.AI_DAILY_LIMIT, 150),
  }
}

/** Ngày theo giờ Việt Nam (UTC+7), dạng YYYY-MM-DD. */
export function vietnamDay(now: number): string {
  return new Date(now + VIETNAM_OFFSET_MS).toISOString().slice(0, 10)
}

/** Số giây tới 00:00 giờ Việt Nam kế tiếp. */
export function secondsToVietnamMidnight(now: number): number {
  const shifted = now + VIETNAM_OFFSET_MS
  const nextMidnight = (Math.floor(shifted / DAY_MS) + 1) * DAY_MS
  return Math.max(1, Math.ceil((nextMidnight - shifted) / 1000))
}

function rateKey(kind: AiQuotaKind, ip: string, now: number): string {
  return `ql:ai:rl:${kind}:${ip}:${Math.floor(now / 60000)}`
}

function dayKey(kind: AiQuotaKind, now: number): string {
  return `ql:ai:day:${kind}:${vietnamDay(now)}`
}

function storeError(kind: AiQuotaKind): void {
  // Không log IP / nội dung; chỉ báo kho đếm đang lỗi để không chặn người thật.
  console.warn(JSON.stringify({ outcome: 'AI_QUOTA_STORE_ERROR', kind }))
}

/**
 * Kiểm giới hạn AI dùng chung mọi instance (Upstash).
 * - IP trước, trần ngày sau: request bị chặn theo IP không tốn lượt ngày.
 * - Kho đếm lỗi → cho qua (fail open) để không chặn người thật.
 */
export async function checkAiQuota(input: AiQuotaInput): Promise<AiQuotaResult> {
  const { store, ip, kind, env, now } = input
  const limits = aiQuotaLimits(kind, env)
  const key = rateKey(kind, ip, now)

  let minuteCount: number
  try {
    minuteCount = await store.incr(key, 60)
  } catch {
    storeError(kind)
    return { allowed: true }
  }
  if (minuteCount > limits.perMinute) {
    return { allowed: false, code: 'RATE_LIMIT', retryAfter: 60 }
  }

  let dayCount: number
  try {
    dayCount = await store.incr(dayKey(kind, now), 2 * 24 * 60 * 60)
  } catch {
    storeError(kind)
    return { allowed: true }
  }
  if (dayCount > limits.perDay) {
    return { allowed: false, code: 'DAILY_LIMIT', retryAfter: secondsToVietnamMidnight(now) }
  }

  return { allowed: true }
}
