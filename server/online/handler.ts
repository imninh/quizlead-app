import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  AttemptSchema,
  CharacterSchema,
  OpponentKindSchema,
  QuizSchema,
  RaceResultSchema,
  type Quiz,
} from '../../src/domain/schemas.ts'
import { computePoints } from '../../src/domain/scoring.ts'
import { raceResult as compareRace } from '../../src/domain/race.ts'
import { getNameError, getPhoneError, normalizeName, normalizePhone } from '../../src/domain/validation.ts'
import { SEED_QUIZ } from '../../src/domain/seed.ts'
import { getOnlineConfig, type OnlineConfig, type OnlineStore } from './store.ts'
import { createAttemptToken, maskPhone, phoneKey, safeEqual, verifyAttemptToken } from './crypto.ts'

const MAX_BODY_BYTES = 8192
const PUBLISH_MAX_BODY_BYTES = 32768
const TOKEN_TTL_SECONDS = 15 * 60
const DEFAULT_RATE_LIMIT = 30

const StoredQuizSchema = z.object({ version: z.number(), quiz: QuizSchema })

const EntrySchema = z.object({
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

export type OnlineEntry = z.infer<typeof EntrySchema>

const StartSchema = z.object({ quizId: z.string().min(1).max(120) })

const ScoreInputSchema = z.object({
  attemptToken: z.string().min(10),
  name: z.string(),
  character: CharacterSchema,
  phone: z.string(),
  answers: z
    .array(
      z.object({
        selectedIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.null()]),
        elapsedMs: z.number(),
      }),
    )
    .length(5),
  opponent: z
    .object({
      kind: OpponentKindSchema,
      model: z.string().optional(),
      totalScore: z.number(),
      totalTimeMs: z.number(),
    })
    .optional(),
})

export type OnlineDeps = {
  env: Record<string, string | undefined>
  now: () => number
  ip?: string
  store?: OnlineStore
}

export type OnlineResult = {
  status: number
  body: unknown
  headers?: Record<string, string>
  logOutcome?: string
}

function fail(status: number, code: string, message: string, headers?: Record<string, string>): OnlineResult {
  return { status, body: { ok: false, code, message }, headers }
}

function boardKey(quizId: string, version: number): string {
  return `ql:board:${quizId}:${version}`
}

function entryKey(entryId: string): string {
  return `ql:entry:${entryId}`
}

function quizKey(quizId: string): string {
  return `ql:quiz:${quizId}`
}

function quizVersionKey(quizId: string, version: number): string {
  return `ql:quiz:${quizId}:${version}`
}

function phoneKeyFor(secret: string, quizId: string, version: number, phone: string): string {
  return `ql:phone:${quizId}:${version}:${phoneKey(secret, quizId, phone)}`
}

function compositeScore(totalScore: number, totalTimeMs: number): number {
  return totalScore * 1_000_000_000 - totalTimeMs
}

async function readBody(request: Request, maxBytes = MAX_BODY_BYTES): Promise<unknown | null> {
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('TOO_LARGE')
  return JSON.parse(text)
}

async function resolveLatestQuiz(
  store: OnlineStore,
  quizId: string,
): Promise<{ version: number; quiz: Quiz } | null> {
  const raw = await store.get(quizKey(quizId))
  if (raw) {
    const parsed = StoredQuizSchema.safeParse(JSON.parse(raw))
    if (parsed.success) return parsed.data
  }
  if (quizId === SEED_QUIZ.id) return { version: 1, quiz: SEED_QUIZ }
  return null
}

async function resolveVersion(
  store: OnlineStore,
  quizId: string,
  version: number,
): Promise<Quiz | null> {
  const raw = await store.get(quizVersionKey(quizId, version))
  if (raw) {
    const parsed = QuizSchema.safeParse(JSON.parse(raw))
    if (parsed.success) return parsed.data
  }
  if (quizId === SEED_QUIZ.id && version === 1) return SEED_QUIZ
  return null
}

async function readEntry(store: OnlineStore, entryId: string): Promise<OnlineEntry | null> {
  const raw = await store.get(entryKey(entryId))
  if (!raw) return null
  const parsed = EntrySchema.safeParse(JSON.parse(raw))
  return parsed.success ? parsed.data : null
}

async function topEntries(store: OnlineStore, quizId: string, version: number, limit: number): Promise<OnlineEntry[]> {
  const top = await store.ztop(boardKey(quizId, version), 50)
  const entries = (await Promise.all(top.map((item) => readEntry(store, item.member)))).filter(
    (entry): entry is OnlineEntry => !!entry,
  )
  return entries
    .sort((a, b) => {
      if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore
      if (a.totalTimeMs !== b.totalTimeMs) return a.totalTimeMs - b.totalTimeMs
      return a.createdAt - b.createdAt
    })
    .slice(0, limit)
}

async function rateLimited(config: OnlineConfig, deps: OnlineDeps): Promise<boolean> {
  const store = config.store!
  const limit = Number.parseInt(deps.env.ONLINE_RATE_LIMIT_PER_MIN ?? `${DEFAULT_RATE_LIMIT}`, 10) || DEFAULT_RATE_LIMIT
  const now = deps.now()
  const ip = deps.ip?.trim() || 'unknown'
  const key = `ql:rl:${ip}:${Math.floor(now / 60000)}`
  const count = await store.incr(key, 60)
  return count > limit
}

const PASSCODE_FAIL_LIMIT = 5
const PASSCODE_FAIL_TTL_SECONDS = 15 * 60

async function requirePasscode(
  request: Request,
  config: OnlineConfig,
  deps: OnlineDeps,
): Promise<OnlineResult | null> {
  const store = config.store!
  const ip = deps.ip?.trim() || 'unknown'
  const key = `ql:pass-fail:${ip}`
  const failures = Number.parseInt((await store.get(key)) ?? '0', 10) || 0
  if (failures >= PASSCODE_FAIL_LIMIT) {
    return {
      ...fail(429, 'PASSCODE_LOCKED', 'Sai passcode quá nhiều lần. Thử lại sau 15 phút.', {
        'Retry-After': String(PASSCODE_FAIL_TTL_SECONDS),
      }),
      logOutcome: 'PASSCODE_LOCKED',
    }
  }
  const supplied = request.headers.get('x-admin-passcode') ?? ''
  if (safeEqual(supplied, config.passcode)) return null
  await store.incr(key, PASSCODE_FAIL_TTL_SECONDS)
  return fail(401, 'UNAUTHORIZED', 'Passcode không đúng.')
}

async function publish(request: Request, config: OnlineConfig, deps: OnlineDeps): Promise<OnlineResult> {
  const auth = await requirePasscode(request, config, deps)
  if (auth) return auth
  if (await rateLimited(config, deps)) return fail(429, 'RATE_LIMIT', 'Bạn đã gửi quá nhiều yêu cầu.')
  let body: unknown
  try {
    body = await readBody(request, PUBLISH_MAX_BODY_BYTES)
  } catch (error) {
    return error instanceof Error && error.message === 'TOO_LARGE'
      ? fail(413, 'INVALID_INPUT', 'Dữ liệu yêu cầu quá lớn.')
      : fail(400, 'INVALID_INPUT', 'JSON không hợp lệ.')
  }
  const quiz = QuizSchema.safeParse(body)
  if (!quiz.success) return fail(400, 'INVALID_QUIZ', 'Quiz không hợp lệ.')

  const store = config.store!
  const existing = await resolveLatestQuiz(store, quiz.data.id)
  const version = existing ? existing.version + 1 : 1
  await store.set(quizKey(quiz.data.id), JSON.stringify({ version, quiz: quiz.data }))
  await store.set(quizVersionKey(quiz.data.id, version), JSON.stringify(quiz.data))
  return { status: 200, body: { ok: true, id: quiz.data.id, version, url: `/q/${quiz.data.id}` } }
}

async function getQuiz(path: string, config: OnlineConfig): Promise<OnlineResult> {
  const quizId = decodeURIComponent(path.slice('/quizzes/'.length))
  if (!quizId) return fail(400, 'INVALID_INPUT', 'Thiếu mã quiz.')
  const resolved = await resolveLatestQuiz(config.store!, quizId)
  if (!resolved) return fail(404, 'NOT_FOUND', 'Quiz chưa được xuất bản.')
  return { status: 200, body: { ok: true, version: resolved.version, quiz: resolved.quiz } }
}

async function start(request: Request, config: OnlineConfig, deps: OnlineDeps): Promise<OnlineResult> {
  if (await rateLimited(config, deps)) return fail(429, 'RATE_LIMIT', 'Bạn đã gửi quá nhiều yêu cầu.')
  let body: unknown
  try {
    body = await readBody(request)
  } catch {
    return fail(400, 'INVALID_INPUT', 'JSON không hợp lệ.')
  }
  const parsed = StartSchema.safeParse(body)
  if (!parsed.success) return fail(400, 'INVALID_INPUT', 'Dữ liệu yêu cầu không hợp lệ.')
  const resolved = await resolveLatestQuiz(config.store!, parsed.data.quizId)
  if (!resolved) return fail(404, 'NOT_FOUND', 'Quiz chưa được xuất bản.')
  const now = deps.now()
  const { token } = createAttemptToken(
    { quizId: parsed.data.quizId, version: resolved.version, now },
    config.secret,
  )
  return { status: 200, body: { ok: true, attemptToken: token, version: resolved.version } }
}

async function submitScore(request: Request, config: OnlineConfig, deps: OnlineDeps): Promise<OnlineResult> {
  if (await rateLimited(config, deps)) return fail(429, 'RATE_LIMIT', 'Bạn đã gửi quá nhiều yêu cầu.')
  let body: unknown
  try {
    body = await readBody(request)
  } catch (error) {
    return error instanceof Error && error.message === 'TOO_LARGE'
      ? fail(413, 'INVALID_INPUT', 'Dữ liệu yêu cầu quá lớn.')
      : fail(400, 'INVALID_INPUT', 'JSON không hợp lệ.')
  }
  const parsed = ScoreInputSchema.safeParse(body)
  if (!parsed.success) return fail(400, 'INVALID_INPUT', 'Dữ liệu điểm không hợp lệ.')

  const now = deps.now()
  const payload = verifyAttemptToken(parsed.data.attemptToken, config.secret, now)
  if (!payload) return fail(401, 'INVALID_TOKEN', 'Phiên chơi không hợp lệ hoặc đã hết hạn.')
  const store = config.store!
  if (await store.get(`ql:token-used:${payload.jti}`)) {
    return fail(409, 'TOKEN_USED', 'Phiên chơi đã được dùng.')
  }

  const quiz = await resolveVersion(store, payload.quizId, payload.version)
  if (!quiz) return fail(404, 'NOT_FOUND', 'Phiên bản quiz không tồn tại.')

  const nameError = getNameError(parsed.data.name)
  const phone = normalizePhone(parsed.data.phone)
  const phoneError = getPhoneError(phone)
  if (nameError) return fail(422, 'INVALID_NAME', nameError)
  if (phoneError) return fail(422, 'INVALID_PHONE', phoneError)

  let totalElapsed = 0
  for (const answer of parsed.data.answers) {
    if (!Number.isFinite(answer.elapsedMs)) return fail(422, 'SUSPICIOUS', 'Thời gian trả lời không hợp lệ.')
    if (answer.selectedIndex === null) {
      if (answer.elapsedMs !== 30000) return fail(422, 'SUSPICIOUS', 'Câu hết giờ phải có 30 giây.')
    } else if (answer.elapsedMs < 400 || answer.elapsedMs > 30000) {
      return fail(422, 'SUSPICIOUS', 'Thời gian trả lời bất thường.')
    }
    totalElapsed += answer.elapsedMs
  }
  if (totalElapsed > now - payload.startedAt) {
    return fail(422, 'SUSPICIOUS', 'Tổng thời gian lớn hơn thời gian thực.')
  }

  const answers = quiz.questions.map((question, index) => {
    const input = parsed.data.answers[index]!
    const isCorrect = input.selectedIndex !== null && input.selectedIndex === question.correctIndex
    return {
      questionId: question.id,
      selectedIndex: input.selectedIndex,
      elapsedMs: input.elapsedMs,
      isCorrect,
      points: computePoints(isCorrect, input.elapsedMs),
    }
  })
  const totalScore = answers.reduce((sum, answer) => sum + answer.points, 0)
  const correctCount = answers.filter((answer) => answer.isCorrect).length
  const totalTimeMs = answers.reduce((sum, answer) => sum + answer.elapsedMs, 0)
  const opponent = parsed.data.opponent
  const recordedRaceResult = opponent
    ? compareRace(
        { totalScore, totalTimeMs },
        { totalScore: opponent.totalScore, totalTimeMs: opponent.totalTimeMs },
      )
    : undefined

  const key = phoneKeyFor(config.secret, payload.quizId, payload.version, phone)
  const existingId = await store.get(key)
  if (existingId) {
    const existing = await readEntry(store, existingId)
    if (existing && totalScore <= existing.totalScore) {
      await store.set(`ql:token-used:${payload.jti}`, '1', TOKEN_TTL_SECONDS)
      const rank = await store.zrank(boardKey(payload.quizId, payload.version), existing.entryId)
      return {
        status: 200,
        body: { ok: true, rank: rank === null ? null : rank + 1, entry: existing, improved: false },
      }
    }
    if (existing) {
      await store.zrem(boardKey(payload.quizId, payload.version), existingId)
      await store.del(entryKey(existingId))
    }
  }

  const entry: OnlineEntry = {
    entryId: randomUUID(),
    quizId: payload.quizId,
    version: payload.version,
    name: normalizeName(parsed.data.name),
    character: parsed.data.character,
    phoneMasked: maskPhone(phone),
    totalScore,
    totalTimeMs,
    correctCount,
    createdAt: now,
    opponent,
    raceResult: recordedRaceResult,
  }
  await store.set(entryKey(entry.entryId), JSON.stringify(entry))
  await store.set(key, entry.entryId)
  await store.zadd(boardKey(payload.quizId, payload.version), compositeScore(totalScore, totalTimeMs), entry.entryId)
  await store.set(`ql:token-used:${payload.jti}`, '1', TOKEN_TTL_SECONDS)
  const rank = await store.zrank(boardKey(payload.quizId, payload.version), entry.entryId)
  return {
    status: 200,
    body: { ok: true, rank: rank === null ? null : rank + 1, entry, improved: true },
  }
}

async function leaderboard(path: string, config: OnlineConfig): Promise<OnlineResult> {
  const quizId = decodeURIComponent(path.slice('/leaderboard/'.length))
  if (!quizId) return fail(400, 'INVALID_INPUT', 'Thiếu mã quiz.')
  const resolved = await resolveLatestQuiz(config.store!, quizId)
  if (!resolved) return fail(404, 'NOT_FOUND', 'Quiz chưa được xuất bản.')
  const entries = await topEntries(config.store!, quizId, resolved.version, 10)
  return { status: 200, body: { ok: true, version: resolved.version, entries } }
}

async function deleteEntry(path: string, request: Request, config: OnlineConfig, deps: OnlineDeps): Promise<OnlineResult> {
  const auth = await requirePasscode(request, config, deps)
  if (auth) return auth
  if (await rateLimited(config, deps)) return fail(429, 'RATE_LIMIT', 'Bạn đã gửi quá nhiều yêu cầu.')
  const rest = path.slice('/leaderboard/'.length)
  const slash = rest.lastIndexOf('/')
  if (slash <= 0) return fail(400, 'INVALID_INPUT', 'Thiếu entry.')
  const quizId = decodeURIComponent(rest.slice(0, slash))
  const entryId = decodeURIComponent(rest.slice(slash + 1))
  const resolved = await resolveLatestQuiz(config.store!, quizId)
  if (!resolved) return fail(404, 'NOT_FOUND', 'Quiz chưa được xuất bản.')
  await config.store!.zrem(boardKey(quizId, resolved.version), entryId)
  await config.store!.del(entryKey(entryId))
  return { status: 200, body: { ok: true } }
}

function offline(): OnlineResult {
  return fail(503, 'OFFLINE_MODE', 'Tính năng online chưa được bật.')
}

export async function handleOnline(
  request: Request,
  path: string,
  deps: OnlineDeps,
): Promise<OnlineResult> {
  const started = deps.now()
  const config = getOnlineConfig(deps.env, deps.store)
  const endpoint = path.split('/')[1] ?? path
  const finish = (result: OnlineResult): OnlineResult => {
    console.info(
      JSON.stringify({
        endpoint,
        outcome: result.logOutcome ?? result.status,
        latencyMs: deps.now() - started,
        online: config.online,
      }),
    )
    return result
  }

  try {
    if (path === '/health') {
      return finish({ status: 200, body: { online: config.online } })
    }
    if (!config.online) return finish(offline())

    if (path === '/admin/check' && request.method === 'POST') {
      const auth = await requirePasscode(request, config, deps)
      if (auth) return finish(auth)
      return finish({ status: 200, body: { ok: true } })
    }
    if (path === '/quizzes' && request.method === 'POST') {
      return finish(await publish(request, config, deps))
    }
    if (path.startsWith('/quizzes/') && request.method === 'GET') {
      return finish(await getQuiz(path, config))
    }
    if (path === '/attempts/start' && request.method === 'POST') {
      return finish(await start(request, config, deps))
    }
    if (path === '/scores' && request.method === 'POST') {
      return finish(await submitScore(request, config, deps))
    }
    if (path.startsWith('/leaderboard/') && request.method === 'GET') {
      return finish(await leaderboard(path, config))
    }
    if (path.startsWith('/leaderboard/') && request.method === 'DELETE') {
      return finish(await deleteEntry(path, request, config, deps))
    }
    return finish(fail(404, 'NOT_FOUND', 'Không tìm thấy API.'))
  } catch {
    return finish(fail(500, 'UPSTREAM', 'Không xử lý được yêu cầu online.'))
  }
}

function cacheControlFor(request: Request, path: string, status: number): string {
  if (request.method !== 'GET' || status !== 200) return 'no-store'
  if (request.headers.get('x-admin-passcode')) return 'no-store'
  if (path === '/health') return 'public, s-maxage=30, stale-while-revalidate=60'
  if (path.startsWith('/quizzes/')) return 'public, s-maxage=60, stale-while-revalidate=300'
  if (path.startsWith('/leaderboard/')) return 'public, s-maxage=10, stale-while-revalidate=30'
  return 'no-store'
}

export async function handleOnlineRequest(
  request: Request,
  path: string,
  deps: OnlineDeps,
): Promise<Response> {
  const result = await handleOnline(request, path, deps)
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControlFor(request, path, result.status),
      ...(result.headers ?? {}),
    },
  })
}

export const __test = {
  boardKey,
  entryKey,
  phoneKeyFor,
  compositeScore,
  topEntries,
  EntrySchema,
  StoredQuizSchema,
  AttemptSchema,
}
