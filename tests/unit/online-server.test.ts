import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleOnline, handleOnlineRequest, __test, type OnlineDeps } from '../../server/online/handler'
import { MemoryStore, getOnlineConfig, type OnlineStore } from '../../server/online/store'
import { createAttemptToken, verifyAttemptToken } from '../../server/online/crypto'
import { computePoints } from '../../src/domain/scoring'
import { SEED_QUIZ } from '../../src/domain/seed'
import type { Attempt } from '../../src/domain/schemas'

const SECRET = 'a'.repeat(32)
const PASSCODE = 'passcode1'

class RecordingStore extends MemoryStore {
  stored: string[] = []
  override async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.stored.push(value)
    await super.set(key, value, ttlSeconds)
  }
}

const env = {
  ONLINE_SECRET: SECRET,
  ADMIN_PASSCODE: PASSCODE,
  ONLINE_RATE_LIMIT_PER_MIN: '100',
}

function makeDeps(store: OnlineStore = new MemoryStore(), overrides: Partial<OnlineDeps> = {}): OnlineDeps {
  return { env, now: () => 1000, ip: '203.0.113.7', store, ...overrides }
}

function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function publish(deps: OnlineDeps, quiz: unknown = SEED_QUIZ, passcode = PASSCODE) {
  return handleOnline(request('POST', '/quizzes', quiz, { 'x-admin-passcode': passcode }), '/quizzes', deps)
}

async function start(deps: OnlineDeps, quizId = SEED_QUIZ.id) {
  return handleOnline(request('POST', '/attempts/start', { quizId }), '/attempts/start', deps)
}

function answersFor(correct: boolean, elapsedMs = 1000) {
  return SEED_QUIZ.questions.map((question) => ({
    selectedIndex: (correct ? question.correctIndex : (question.correctIndex + 1) % 4) as 0 | 1 | 2 | 3,
    elapsedMs,
  }))
}

async function score(
  deps: OnlineDeps,
  input: {
    token: string
    name?: string
    phone?: string
    answers?: ReturnType<typeof answersFor>
    character?: string
    opponent?: { kind: string; totalScore: number; totalTimeMs: number }
  },
) {
  return handleOnline(
    request('POST', '/scores', {
      attemptToken: input.token,
      name: input.name ?? 'Nguyễn Văn A',
      phone: input.phone ?? '0912345678',
      character: input.character ?? 'mi',
      answers: input.answers ?? answersFor(true),
      opponent: input.opponent,
    }),
    '/scores',
    deps,
  )
}

describe('online server', () => {
  let store: MemoryStore
  let deps: OnlineDeps
  let clock: number

  beforeEach(() => {
    store = new MemoryStore()
    clock = 1_000
    deps = makeDeps(store, { now: () => clock })
  })

  it('health reports offline when config is missing', async () => {
    const result = await handleOnline(request('GET', '/health'), '/health', { env: {}, now: () => 0 })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ online: false })
    const write = await handleOnline(request('POST', '/scores', {}), '/scores', { env: {}, now: () => 0 })
    expect(write.status).toBe(503)
    expect(write.body).toMatchObject({ code: 'OFFLINE_MODE' })
  })

  it('publish requires the admin passcode', async () => {
    const result = await publish(deps, SEED_QUIZ, 'wrong-pass')
    expect(result.status).toBe(401)
    expect(result.body).toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('publish rejects an invalid quiz', async () => {
    const result = await publish(deps, { title: 'x' })
    expect(result.status).toBe(400)
    expect(result.body).toMatchObject({ code: 'INVALID_QUIZ' })
  })

  it('republish increments version and starts a new board', async () => {
    const first = await publish(deps)
    const second = await publish(deps)
    expect(first.body).toMatchObject({ ok: true, version: 2 })
    expect(second.body).toMatchObject({ ok: true, version: 3 })
    expect(await store.ztop(__test.boardKey(SEED_QUIZ.id, 3), 10)).toEqual([])
  })

  it('seed quiz is always available', async () => {
    const result = await handleOnline(request('GET', `/quizzes/${SEED_QUIZ.id}`), `/quizzes/${SEED_QUIZ.id}`, deps)
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ ok: true, version: 1 })
  })

  it('leaderboard get is cacheable for ten seconds', async () => {
    const path = `/leaderboard/${SEED_QUIZ.id}`
    const response = await handleOnlineRequest(request('GET', path), path, deps)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=10, stale-while-revalidate=30')
  })

  it('quiz get is cacheable for sixty seconds', async () => {
    const path = `/quizzes/${SEED_QUIZ.id}`
    const response = await handleOnlineRequest(request('GET', path), path, deps)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=60, stale-while-revalidate=300')
  })

  it('errors and writes are never cached', async () => {
    const missingPath = '/leaderboard/khong-ton-tai'
    const missing = await handleOnlineRequest(request('GET', missingPath), missingPath, deps)
    expect(missing.status).toBe(404)
    expect(missing.headers.get('cache-control')).toBe('no-store')

    const scorePath = '/scores'
    const write = await handleOnlineRequest(request('POST', scorePath, {}), scorePath, deps)
    expect(write.status).toBe(400)
    expect(write.headers.get('cache-control')).toBe('no-store')

    const healthPath = '/health'
    const withPasscode = await handleOnlineRequest(
      request('GET', healthPath, undefined, { 'x-admin-passcode': PASSCODE }),
      healthPath,
      deps,
    )
    expect(withPasscode.headers.get('cache-control')).toBe('no-store')
  })

  it('start returns a signed token that expires in 15 minutes', async () => {
    const result = await start(deps)
    expect(result.status).toBe(200)
    const body = result.body as { ok: true; attemptToken: string }
    const payload = verifyAttemptToken(body.attemptToken, SECRET, clock)
    expect(payload).not.toBeNull()
    expect(payload!.exp - payload!.startedAt).toBe(15 * 60 * 1000)
    expect(payload!.quizId).toBe(SEED_QUIZ.id)
  })

  it('score with tampered token is rejected', async () => {
    const started = await start(deps)
    const token = (started.body as { attemptToken: string }).attemptToken
    clock = 40_000
    const result = await score(deps, { token: `${token}x` })
    expect(result.status).toBe(401)
    expect(result.body).toMatchObject({ code: 'INVALID_TOKEN' })
  })

  it('token can only be used once', async () => {
    const started = await start(deps)
    const token = (started.body as { attemptToken: string }).attemptToken
    clock = 40_000
    const first = await score(deps, { token })
    const second = await score(deps, { token, phone: '0987654321' })
    expect(first.status).toBe(200)
    expect(second.status).toBe(409)
    expect(second.body).toMatchObject({ code: 'TOKEN_USED' })
  })

  it('server rescores answers and ignores client points', async () => {
    const started = await start(deps)
    const token = (started.body as { attemptToken: string }).attemptToken
    clock = 40_000
    const result = await handleOnline(
      request('POST', '/scores', {
        attemptToken: token,
        name: 'Nguyễn Văn A',
        character: 'mi',
        phone: '0912345678',
        answers: answersFor(true, 5000).map((answer) => ({ ...answer, points: 0, isCorrect: false })),
      }),
      '/scores',
      deps,
    )
    expect(result.status).toBe(200)
    if (result.status === 200) {
      const body = result.body as { entry: { totalScore: number; correctCount: number; totalTimeMs: number } }
      expect(body.entry.totalScore).toBe(computePoints(true, 5000) * 5)
      expect(body.entry.correctCount).toBe(5)
      expect(body.entry.totalTimeMs).toBe(25_000)
    }
  })

  it('answer faster than 400 ms is rejected as suspicious', async () => {
    const started = await start(deps)
    const token = (started.body as { attemptToken: string }).attemptToken
    clock = 40_000
    const result = await score(deps, { token, answers: answersFor(true, 399) })
    expect(result.status).toBe(422)
    expect(result.body).toMatchObject({ code: 'SUSPICIOUS' })
  })

  it('total elapsed longer than real time is rejected', async () => {
    const started = await start(deps)
    const token = (started.body as { attemptToken: string }).attemptToken
    clock = 2_000
    const result = await score(deps, { token, answers: answersFor(true, 1000) })
    expect(result.status).toBe(422)
    expect(result.body).toMatchObject({ code: 'SUSPICIOUS' })
  })

  it('same phone keeps only the best score', async () => {
    const started = await start(deps)
    const token = (started.body as { attemptToken: string }).attemptToken
    clock = 40_000
    const best = await score(deps, { token, phone: '0912345678', answers: answersFor(true, 1000) })
    expect(best.status).toBe(200)
    const started2 = await start(deps)
    const token2 = (started2.body as { attemptToken: string }).attemptToken
    clock = 80_000
    const worse = await score(deps, { token: token2, phone: '0912345678', answers: answersFor(false, 1000) })
    expect(worse.status).toBe(200)
    const worseBody = worse.body as { improved: boolean; entry: { totalScore: number } }
    expect(worseBody.improved).toBe(false)
    expect(worseBody.entry.totalScore).toBe(computePoints(true, 1000) * 5)
  })

  it('raw phone is never stored, logged or returned', async () => {
    const recording = new RecordingStore()
    const recordingDeps = makeDeps(recording, { now: () => clock })
    const started = await start(recordingDeps)
    const token = (started.body as { attemptToken: string }).attemptToken
    clock = 40_000
    const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const result = await score(recordingDeps, { token, phone: '0912345678', name: 'Nguyễn Văn A' })
    const serialized = JSON.stringify(result.body)
    expect(serialized).not.toContain('0912345678')
    expect(recording.stored.join('\n')).not.toContain('0912345678')
    expect(logSpy.mock.calls.map((call) => call.join(' ')).join('\n')).not.toContain('0912345678')
    logSpy.mockRestore()
  })

  it('leaderboard sorts by score then time then createdAt', async () => {
    const entries = [
      { name: 'Chậm', phone: '0912345678', elapsed: 8000, at: 100_000 },
      { name: 'Nhanh', phone: '0987654321', elapsed: 1000, at: 200_000 },
      { name: 'Đồng hạng trước', phone: '0905123456', elapsed: 4000, at: 300_000 },
      { name: 'Đồng hạng sau', phone: '0906123456', elapsed: 4000, at: 400_000 },
    ]
    for (const entry of entries) {
      const started = await start(deps)
      const token = (started.body as { attemptToken: string }).attemptToken
      clock = entry.at
      await score(deps, { token, name: entry.name, phone: entry.phone, answers: answersFor(true, entry.elapsed) })
    }
    const board = await handleOnline(request('GET', `/leaderboard/${SEED_QUIZ.id}`), `/leaderboard/${SEED_QUIZ.id}`, deps)
    expect(board.status).toBe(200)
    const body = board.body as { entries: Array<{ name: string }> }
    expect(body.entries.map((entry) => entry.name)).toEqual(['Nhanh', 'Đồng hạng trước', 'Đồng hạng sau', 'Chậm'])
  })

  it('admin can delete an entry with passcode', async () => {
    const started = await start(deps)
    const token = (started.body as { attemptToken: string }).attemptToken
    clock = 40_000
    const submitted = await score(deps, { token })
    const entry = (submitted.body as { entry: { entryId: string } }).entry
    const denied = await handleOnline(
      request('DELETE', `/leaderboard/${SEED_QUIZ.id}/${entry.entryId}`, undefined, { 'x-admin-passcode': 'wrong-pass' }),
      `/leaderboard/${SEED_QUIZ.id}/${entry.entryId}`,
      deps,
    )
    expect(denied.status).toBe(401)
    const deleted = await handleOnline(
      request('DELETE', `/leaderboard/${SEED_QUIZ.id}/${entry.entryId}`, undefined, { 'x-admin-passcode': PASSCODE }),
      `/leaderboard/${SEED_QUIZ.id}/${entry.entryId}`,
      deps,
    )
    expect(deleted.status).toBe(200)
    const board = await handleOnline(request('GET', `/leaderboard/${SEED_QUIZ.id}`), `/leaderboard/${SEED_QUIZ.id}`, deps)
    expect((board.body as { entries: unknown[] }).entries).toHaveLength(0)
  })

  it('write endpoints are rate limited per IP', async () => {
    const limited = makeDeps(store, {
      env: { ...env, ONLINE_RATE_LIMIT_PER_MIN: '1' },
      now: () => clock,
    })
    expect((await publish(limited)).status).toBe(200)
    const blocked = await publish(limited)
    expect(blocked.status).toBe(429)
    expect(blocked.body).toMatchObject({ code: 'RATE_LIMIT' })
  })

  it('six wrong passcodes lock the IP for 15 minutes', async () => {
    for (let index = 0; index < 5; index++) {
      const result = await publish(deps, SEED_QUIZ, 'wrong-pass')
      expect(result.status).toBe(401)
    }
    const sixth = await publish(deps, SEED_QUIZ, 'wrong-pass')
    expect(sixth.status).toBe(429)
    expect(sixth.body).toMatchObject({ code: 'PASSCODE_LOCKED' })
    const correctAfterLock = await publish(deps, SEED_QUIZ, PASSCODE)
    expect(correctAfterLock.status).toBe(429)
  })

  it('admin check is also rate limited for wrong passcodes', async () => {
    for (let index = 0; index < 5; index++) {
      const result = await handleOnline(
        request('POST', '/admin/check', {}, { 'x-admin-passcode': 'wrong-pass' }),
        '/admin/check',
        deps,
      )
      expect(result.status).toBe(401)
    }
    const locked = await handleOnline(
      request('POST', '/admin/check', {}, { 'x-admin-passcode': PASSCODE }),
      '/admin/check',
      deps,
    )
    expect(locked.status).toBe(429)
    expect(locked.body).toMatchObject({ code: 'PASSCODE_LOCKED' })
  })

  it('publish accepts a maximum length vietnamese quiz up to 32KB', async () => {
    const longText = 'ạ'.repeat(300)
    const longOption = 'ệ'.repeat(150)
    const longExplanation = 'ố'.repeat(200)
    const quiz = {
      ...SEED_QUIZ,
      id: 'long-vietnamese-quiz',
      title: 'Quiz tiếng Việt dài tối đa',
      questions: SEED_QUIZ.questions.map((question) => ({
        ...question,
        text: longText,
        options: [longOption, longOption, longOption, longOption] as [string, string, string, string],
        explanation: longExplanation,
      })),
    }
    const result = await publish(deps, quiz)
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ ok: true, id: 'long-vietnamese-quiz' })
  })

  it('non publish endpoints still reject bodies over 8KB', async () => {
    const result = await handleOnline(
      request('POST', '/scores', { pad: 'x'.repeat(9000) }),
      '/scores',
      deps,
    )
    expect(result.status).toBe(413)
    expect(result.body).toMatchObject({ code: 'INVALID_INPUT' })
  })

  it('vercel KV variable names also enable online mode', async () => {
    const result = await handleOnline(request('GET', '/health'), '/health', {
      env: {
        KV_REST_API_URL: 'https://kv.example',
        KV_REST_API_TOKEN: 'kv-token',
        ONLINE_SECRET: SECRET,
        ADMIN_PASSCODE: PASSCODE,
      },
      now: () => 0,
    })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ online: true })
  })

  it('dev memory store is ignored in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const config = getOnlineConfig({
      VERCEL_ENV: 'production',
      ONLINE_DEV_MEMORY: '1',
      ONLINE_SECRET: SECRET,
      ADMIN_PASSCODE: PASSCODE,
    })
    expect(config.online).toBe(false)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('publish returns a playable url', async () => {
    const result = await publish(deps)
    expect(result.body).toMatchObject({ ok: true, id: SEED_QUIZ.id, url: `/q/${SEED_QUIZ.id}` })
  })

  it('createAttemptToken signs the quiz/version snapshot', () => {
    const { token } = createAttemptToken({ quizId: SEED_QUIZ.id, version: 3, now: 1000 }, SECRET)
    const payload = verifyAttemptToken(token, SECRET, 2000)
    expect(payload).toMatchObject({ quizId: SEED_QUIZ.id, version: 3, startedAt: 1000 })
  })

  it('old local attempt without online fields still parses', () => {
    const attempt: Attempt = {
      id: 'a1',
      quizId: SEED_QUIZ.id,
      answers: SEED_QUIZ.questions.map((question) => ({
        questionId: question.id,
        selectedIndex: 0,
        elapsedMs: 1000,
        isCorrect: true,
        points: 1000,
      })),
      totalScore: 5000,
      correctCount: 5,
      totalTimeMs: 5000,
      finishedAt: 1,
    }
    expect(__test.AttemptSchema.safeParse(attempt).success).toBe(true)
  })
})
