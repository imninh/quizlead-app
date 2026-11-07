import { z } from 'zod'
import {
  CharacterSchema,
  OpponentKindSchema,
  QuizSchema,
  RaceResultSchema,
  type Attempt,
  type Quiz,
} from '../domain/schemas'

const TIMEOUT_MS = 8000

export class OnlineError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const OnlineEntrySchema = z.object({
  entryId: z.string(),
  quizId: z.string(),
  version: z.number(),
  name: z.string(),
  character: CharacterSchema,
  phoneMasked: z.string(),
  totalScore: z.number(),
  totalTimeMs: z.number(),
  correctCount: z.number(),
  createdAt: z.number(),
  opponent: z
    .object({
      kind: OpponentKindSchema,
      model: z.string().optional(),
      totalScore: z.number(),
      totalTimeMs: z.number(),
    })
    .optional(),
  raceResult: RaceResultSchema.optional(),
})

export type OnlineEntry = z.infer<typeof OnlineEntrySchema>

const HealthSchema = z.object({ online: z.boolean() })
const PublishSchema = z.object({ ok: z.literal(true), id: z.string(), version: z.number(), url: z.string() })
const QuizResponseSchema = z.object({ ok: z.literal(true), version: z.number(), quiz: QuizSchema })
const StartSchema = z.object({ ok: z.literal(true), attemptToken: z.string(), version: z.number() })
const ScoreSchema = z.object({
  ok: z.literal(true),
  rank: z.number().nullable(),
  entry: OnlineEntrySchema,
  improved: z.boolean(),
})
const LeaderboardSchema = z.object({
  ok: z.literal(true),
  version: z.number(),
  entries: z.array(OnlineEntrySchema),
})
const OkSchema = z.object({ ok: z.literal(true) })

let healthCache: Promise<boolean> | null = null

async function requestJson(path: string, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await globalThis.fetch(path, { ...init, signal: controller.signal })
    const data: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const code =
        data && typeof data === 'object' && 'code' in data && typeof data.code === 'string'
          ? data.code
          : 'HTTP_ERROR'
      const message =
        data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
          ? data.message
          : 'Không gọi được máy chủ.'
      throw new OnlineError(code, message)
    }
    return data
  } catch (error) {
    if (error instanceof OnlineError) throw error
    throw new OnlineError('NETWORK', 'Không kết nối được máy chủ.')
  } finally {
    globalThis.clearTimeout(timer)
  }
}

export function resetOnlineCache(): void {
  healthCache = null
}

export function getOnlineHealth(): Promise<boolean> {
  if (!healthCache) {
    healthCache = requestJson('/api/health')
      .then((data) => HealthSchema.parse(data).online)
      .catch(() => false)
  }
  return healthCache
}

export async function publishQuiz(quiz: Quiz, passcode: string) {
  const data = await requestJson('/api/quizzes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-passcode': passcode },
    body: JSON.stringify(quiz),
  })
  return PublishSchema.parse(data)
}

export async function checkAdminPasscode(passcode: string): Promise<boolean> {
  try {
    const data = await requestJson('/api/admin/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-passcode': passcode },
      body: '{}',
    })
    return OkSchema.safeParse(data).success
  } catch {
    return false
  }
}

export async function fetchPublishedQuiz(id: string): Promise<{ version: number; quiz: Quiz }> {
  const data = await requestJson(`/api/quizzes/${encodeURIComponent(id)}`)
  const parsed = QuizResponseSchema.parse(data)
  return { version: parsed.version, quiz: parsed.quiz }
}

export async function startOnlineAttempt(quizId: string): Promise<{ token: string; version: number }> {
  const data = await requestJson('/api/attempts/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quizId }),
  })
  const parsed = StartSchema.parse(data)
  return { token: parsed.attemptToken, version: parsed.version }
}

export function scorePayload(input: {
  token: string
  name: string
  character: string
  phone: string
  answers: Attempt['answers']
  opponent?: { kind: string; model?: string; totalScore: number; totalTimeMs: number } | null
}) {
  return {
    attemptToken: input.token,
    name: input.name,
    character: input.character,
    phone: input.phone,
    answers: input.answers.map((answer) => ({
      selectedIndex: answer.selectedIndex,
      elapsedMs: answer.elapsedMs,
    })),
    opponent: input.opponent ?? undefined,
  }
}

export async function submitOnlineScore(payload: unknown) {
  const data = await requestJson('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return ScoreSchema.parse(data)
}

export async function fetchOnlineLeaderboard(quizId: string): Promise<{ version: number; entries: OnlineEntry[] }> {
  const data = await requestJson(`/api/leaderboard/${encodeURIComponent(quizId)}`)
  const parsed = LeaderboardSchema.parse(data)
  return { version: parsed.version, entries: parsed.entries }
}

export async function deleteOnlineEntry(quizId: string, entryId: string, passcode: string): Promise<void> {
  const data = await requestJson(
    `/api/leaderboard/${encodeURIComponent(quizId)}/${encodeURIComponent(entryId)}`,
    { method: 'DELETE', headers: { 'x-admin-passcode': passcode } },
  )
  OkSchema.parse(data)
}

const ONLINE_ENTRY_KEY = 'quizlead:v1:lastOnlineEntry'
const ONLINE_ENTRY_DATA_KEY = 'quizlead:v1:lastOnlineEntryData'

export function saveOnlineEntry(entry: OnlineEntry): void {
  try {
    sessionStorage.setItem(ONLINE_ENTRY_DATA_KEY, JSON.stringify(entry))
  } catch {
    // ignore
  }
}

export function loadOnlineEntry(quizId?: string): OnlineEntry | null {
  try {
    const raw = sessionStorage.getItem(ONLINE_ENTRY_DATA_KEY)
    if (!raw) return null
    const parsed = OnlineEntrySchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    if (quizId && parsed.data.quizId !== quizId) return null
    return parsed.data
  } catch {
    return null
  }
}

/** Gộp dòng vừa gửi vào bảng (cache 10 giây có thể chưa có), sắp theo R-41. */
export function mergeOnlineEntries(entries: OnlineEntry[], own: OnlineEntry | null): OnlineEntry[] {
  if (!own) return entries
  const merged = entries.filter((entry) => entry.entryId !== own.entryId)
  merged.push(own)
  return merged
    .sort((a, b) => {
      if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore
      if (a.totalTimeMs !== b.totalTimeMs) return a.totalTimeMs - b.totalTimeMs
      return a.createdAt - b.createdAt
    })
    .slice(0, 10)
}

export function saveOnlineEntryId(entryId: string): void {
  try {
    sessionStorage.setItem(ONLINE_ENTRY_KEY, entryId)
  } catch {
    // ignore
  }
}

export function loadOnlineEntryId(): string | null {
  try {
    return sessionStorage.getItem(ONLINE_ENTRY_KEY)
  } catch {
    return null
  }
}
