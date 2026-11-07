import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleGhostRun, handleGhostRunRequest, type GhostRunDeps } from '../../server/ghostRun'
import { resetRateLimit } from '../../server/generateQuiz'
import { MemoryStore } from '../../server/online/store'
import { SEED_QUIZ } from '../../src/domain/seed'

const API_KEY = 'test-key-not-real'

function answerResponse(answer = 'A', model = 'ghost/model') {
  return new Response(
    JSON.stringify({
      model,
      choices: [{ message: { content: JSON.stringify({ answer }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 2 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

function input() {
  return {
    questions: SEED_QUIZ.questions.map((question) => ({
      text: question.text,
      options: question.options,
      correctIndex: question.correctIndex,
    })),
  }
}

function shortInput() {
  return {
    questions: Array.from({ length: 5 }, (_, index) => ({
      text: `Hỏi ${index}?`,
      options: ['A', 'B', 'C', 'D'] as [string, string, string, string],
    })),
  }
}

function makeDeps(overrides: Partial<GhostRunDeps> = {}): GhostRunDeps {
  return {
    fetch: vi.fn(async () => answerResponse()) as unknown as GhostRunDeps['fetch'],
    env: {
      AI_API_KEY: API_KEY,
      AI_BASE_URL: 'https://openrouter.ai/api/v1',
      AI_GHOST_MODEL: 'ghost/model',
      AI_RATE_LIMIT_PER_MIN: '10',
      APP_URL: 'http://localhost:5173',
    },
    now: () => 0,
    ip: '203.0.113.10',
    ...overrides,
  }
}

function requestBody(fetchMock: GhostRunDeps['fetch'], index = 0): Record<string, unknown> {
  const call = (fetchMock as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls[index]
  expect(call).toBeDefined()
  return JSON.parse(String(call![1].body)) as Record<string, unknown>
}

describe('ghost run server', () => {
  beforeEach(() => {
    resetRateLimit()
  })

  it('sends each question without correct answer', async () => {
    const fetchMock = vi.fn(async () => answerResponse()) as unknown as GhostRunDeps['fetch']
    const result = await handleGhostRun(input(), makeDeps({ fetch: fetchMock }))

    expect(result.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(5)
    for (let index = 0; index < 5; index++) {
      const body = requestBody(fetchMock, index)
      const messages = body.messages as Array<{ content: string }>
      const user = messages[1]!.content
      expect(user).toContain(SEED_QUIZ.questions[index]!.text)
      expect(user).not.toContain('correctIndex')
      expect(JSON.stringify(body)).not.toContain('correctIndex')
      expect(JSON.stringify(body)).not.toContain('"correct"')
    }
  })

  it('measures elapsed per question and clamps to 1500..30000', async () => {
    const fetchMock = vi.fn(async () => answerResponse()) as unknown as GhostRunDeps['fetch']
    const result = await handleGhostRun(shortInput(), makeDeps({ fetch: fetchMock, now: () => 0 }))

    expect(result.status).toBe(200)
    if (result.body.ok) {
      expect(result.body.answers).toHaveLength(5)
      for (const answer of result.body.answers) {
        expect(answer.selectedIndex).toBe(0)
        expect(answer.elapsedMs).toBe(1500)
      }
    }
  })

  it('bad model output becomes null answer', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'not json' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as GhostRunDeps['fetch']
    const result = await handleGhostRun(input(), makeDeps({ fetch: fetchMock }))

    expect(result.status).toBe(200)
    if (result.body.ok) expect(result.body.answers.every((answer) => answer.selectedIndex === null)).toBe(true)
  })

  it('slow question times out as null without failing the run', async () => {
    const fetchMock = vi.fn(
      () => new Promise<Response>(() => {}),
    ) as unknown as GhostRunDeps['fetch']
    const result = await handleGhostRun(input(), makeDeps({ fetch: fetchMock, questionTimeoutMs: 10 }))

    expect(result.status).toBe(200)
    if (result.body.ok) {
      expect(result.body.answers).toHaveLength(5)
      expect(result.body.answers.every((answer) => answer.selectedIndex === null)).toBe(true)
      expect(result.body.answers.every((answer) => answer.elapsedMs === 30000)).toBe(true)
    }
  })

  it('uses AI_GHOST_MODEL and disables reasoning', async () => {
    const fetchMock = vi.fn(async () => answerResponse('B', 'ghost/actual')) as unknown as GhostRunDeps['fetch']
    const deps = makeDeps({ fetch: fetchMock })
    deps.env.AI_GHOST_MODEL = 'ghost/configured'
    const result = await handleGhostRun(input(), deps)

    expect(result.status).toBe(200)
    expect(result.body.ok && result.body.model).toBe('ghost/actual')
    const call = (fetchMock as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls[0]!
    const body = requestBody(fetchMock)
    const headers = call[1].headers as Record<string, string>
    expect(body.model).toBe('ghost/configured')
    expect(body.reasoning).toEqual({ enabled: false })
    expect(body.thinking).toBeUndefined()
    expect(headers['HTTP-Referer']).toBe('http://localhost:5173')
    expect(headers['X-Title']).toBe('QuizLead')
    if (result.body.ok) expect(result.body.answers.every((answer) => answer.selectedIndex === 1)).toBe(true)
  })

  it('rate limit applies', async () => {
    const deps = makeDeps({ env: { ...makeDeps().env, AI_RATE_LIMIT_PER_MIN: '2' } })
    for (let index = 0; index < 2; index++) {
      const result = await handleGhostRun(input(), deps)
      expect(result.status).toBe(200)
    }
    const blocked = await handleGhostRun(input(), deps)
    expect(blocked.status).toBe(429)
    expect(blocked.body.ok).toBe(false)
    if (!blocked.body.ok) expect(blocked.body.code).toBe('RATE_LIMIT')
  })

  it('accepts a maximum length vietnamese quiz up to 16KB', async () => {
    const fetchMock = vi.fn(async () => answerResponse()) as unknown as GhostRunDeps['fetch']
    const longText = 'ạ'.repeat(300)
    const longOption = 'ệ'.repeat(150)
    const body = {
      questions: Array.from({ length: 5 }, () => ({
        text: longText,
        options: [longOption, longOption, longOption, longOption],
      })),
    }
    const response = await handleGhostRunRequest(
      new Request('http://localhost/api/ghost-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      makeDeps({ fetch: fetchMock }),
    )
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('ghost run respects shared daily cap', async () => {
    const store = new MemoryStore()
    const fetchMock = vi.fn(async () => answerResponse()) as unknown as GhostRunDeps['fetch']
    const deps = makeDeps({
      fetch: fetchMock,
      store,
      env: {
        ...makeDeps().env,
        ONLINE_SECRET: 'a'.repeat(32),
        ADMIN_PASSCODE: 'passcode1',
        AI_GHOST_DAILY_LIMIT: '1',
        AI_GHOST_RATE_LIMIT_PER_MIN: '10',
      },
    })

    expect((await handleGhostRun(input(), deps)).status).toBe(200)
    const blocked = await handleGhostRun(input(), deps)
    expect(blocked.status).toBe(429)
    if (!blocked.body.ok) expect(blocked.body.code).toBe('DAILY_LIMIT')
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })
})
