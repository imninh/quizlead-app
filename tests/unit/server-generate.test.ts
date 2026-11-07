import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  handleGenerateQuiz,
  handleGenerateQuizRequest,
  providerFor,
  resetRateLimit,
  resolveApiKey,
  type GenerateQuizDeps,
} from '../../server/generateQuiz'
import { SYSTEM_PROMPT } from '../../server/prompt'
import { MemoryStore } from '../../server/online/store'
import { vietnamDay } from '../../server/aiQuota'

const API_KEY = 'test-key-not-real'
const PRIMARY = 'primary/model'
const FALLBACKS = 'fallback/one,fallback/two'

function validQuestions() {
  return Array.from({ length: 5 }, (_, i) => ({
    text: `Câu hỏi kiểm thử số ${i + 1}?`,
    options: [`Đáp án A${i}`, `Đáp án B${i}`, `Đáp án C${i}`, `Đáp án D${i}`],
    correctIndex: i % 4,
    explanation: `Giải thích cho câu ${i + 1}.`,
  }))
}

function okResponse(model = PRIMARY) {
  return new Response(
    JSON.stringify({
      model,
      choices: [{ message: { content: JSON.stringify({ questions: validQuestions() }) } }],
      usage: { prompt_tokens: 100, completion_tokens: 200 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

function contentResponse(content: string, model = PRIMARY) {
  return new Response(
    JSON.stringify({
      model,
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

function makeDeps(overrides: Partial<GenerateQuizDeps> = {}): GenerateQuizDeps {
  return {
    fetch: vi.fn(async () => okResponse()) as unknown as GenerateQuizDeps['fetch'],
    env: {
      OPENCODE_API_KEY: API_KEY,
      AI_MODEL: PRIMARY,
      AI_FALLBACK_MODELS: FALLBACKS,
      APP_URL: 'http://localhost:5173',
      AI_RATE_LIMIT_PER_MIN: '10',
    },
    now: () => 1_000_000,
    random: () => 0.42,
    ip: '203.0.113.10',
    ...overrides,
  }
}

function input(topic = 'Lịch sử Việt Nam', difficulty: 'easy' | 'medium' | 'hard' = 'medium') {
  return { topic, difficulty, language: 'vi' }
}

function requestBody(fetchMock: GenerateQuizDeps['fetch'], index = 0): Record<string, unknown> {
  const call = (fetchMock as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls[index]
  expect(call).toBeDefined()
  return JSON.parse(String(call![1].body)) as Record<string, unknown>
}

describe('generate quiz server', () => {
  beforeEach(() => {
    resetRateLimit()
  })

  it('valid model output returns 5 shuffled questions with consistent correct answer', async () => {
    const fetchMock = vi.fn(async () => okResponse()) as unknown as GenerateQuizDeps['fetch']
    const result = await handleGenerateQuiz(input(), makeDeps({ fetch: fetchMock }))

    expect(result.status).toBe(200)
    if (!result.body.ok) throw new Error('expected success')
    expect(result.body.questions).toHaveLength(5)
    expect(result.body.model).toBe(PRIMARY)

    const original = validQuestions()
    for (let i = 0; i < 5; i++) {
      const originalCorrect = original[i]!.options[original[i]!.correctIndex]
      const question = result.body.questions[i]!
      expect(question.options[question.correctIndex]).toBe(originalCorrect)
      expect([...question.options].sort()).toEqual([...original[i]!.options].sort())
    }
  })

  it('invalid json then valid json retries once and succeeds', async () => {
    let calls = 0
    const fetchMock = vi.fn(async () => {
      calls += 1
      return calls === 1 ? contentResponse('không phải json') : okResponse()
    }) as unknown as GenerateQuizDeps['fetch']
    const result = await handleGenerateQuiz(input(), makeDeps({ fetch: fetchMock }))

    expect(result.status).toBe(200)
    expect(calls).toBe(2)
    const body = requestBody(fetchMock, 1)
    expect((body.messages as Array<{ content: string }>).length).toBe(3)
  })

  it('invalid output twice returns 502 BAD_OUTPUT', async () => {
    const fetchMock = vi.fn(async () => contentResponse('không phải json')) as unknown as GenerateQuizDeps['fetch']
    const result = await handleGenerateQuiz(input(), makeDeps({ fetch: fetchMock }))

    expect(result.status).toBe(502)
    expect(result.body).toMatchObject({ ok: false, code: 'BAD_OUTPUT' })
  })

  it('inappropriate topic returns 422', async () => {
    const fetchMock = vi.fn(async () =>
      contentResponse(JSON.stringify({ error: 'inappropriate_topic' })),
    ) as unknown as GenerateQuizDeps['fetch']
    const result = await handleGenerateQuiz(input('cách chế tạo vũ khí'), makeDeps({ fetch: fetchMock }))

    expect(result.status).toBe(422)
    expect(result.body).toMatchObject({ ok: false, code: 'INAPPROPRIATE' })
  })

  it('upstream timeout returns 504', async () => {
    const fetchMock = vi.fn(
      () => new Promise<Response>(() => {}),
    ) as unknown as GenerateQuizDeps['fetch']
    const result = await handleGenerateQuiz(input(), makeDeps({ fetch: fetchMock, timeoutMs: 10 }))

    expect(result.status).toBe(504)
    expect(result.body).toMatchObject({ ok: false, code: 'TIMEOUT' })
  })

  it('11th request in a minute returns 429 with Retry-After', async () => {
    const fetchMock = vi.fn(async () => okResponse()) as unknown as GenerateQuizDeps['fetch']
    const deps = makeDeps({ fetch: fetchMock })
    for (let i = 0; i < 10; i++) {
      const result = await handleGenerateQuiz(input(), deps)
      expect(result.status).toBe(200)
    }
    const blocked = await handleGenerateQuiz(input(), deps)

    expect(blocked.status).toBe(429)
    expect(blocked.body).toMatchObject({ ok: false, code: 'RATE_LIMIT' })
    expect(blocked.headers?.['Retry-After']).toBe('60')
  })

  it('body larger than 2KB returns 413', async () => {
    const deps = makeDeps()
    const response = await handleGenerateQuizRequest(
      new Request('http://localhost/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input('x'.repeat(3000))),
      }),
      deps,
    )

    expect(response.status).toBe(413)
    expect(deps.fetch).not.toHaveBeenCalled()
  })

  it('missing api key returns 500 CONFIG without leaking details', async () => {
    const deps = makeDeps({ env: { AI_MODEL: PRIMARY, AI_FALLBACK_MODELS: FALLBACKS } })
    const result = await handleGenerateQuiz(input(), deps)

    expect(result.status).toBe(500)
    expect(result.body).toMatchObject({ ok: false, code: 'CONFIG' })
    expect(JSON.stringify(result.body)).not.toContain('Bearer')
    expect(JSON.stringify(result.body)).not.toContain(API_KEY)
    expect(deps.fetch).not.toHaveBeenCalled()
  })

  it('response never contains the api key', async () => {
    const result = await handleGenerateQuiz(input(), makeDeps())
    expect(result.status).toBe(200)
    expect(JSON.stringify(result.body)).not.toContain(API_KEY)
    expect(JSON.stringify(result.body)).not.toContain('Authorization')
  })

  it('topic control characters and angle brackets are stripped before prompt', async () => {
    const fetchMock = vi.fn(async () => okResponse()) as unknown as GenerateQuizDeps['fetch']
    const result = await handleGenerateQuiz(input('<b>Lịch\u0000 sử</b>'), makeDeps({ fetch: fetchMock }))

    expect(result.status).toBe(200)
    const body = requestBody(fetchMock)
    const userMessage = (body.messages as Array<{ role: string; content: string }>)[1]!.content
    expect(userMessage).toContain('<topic>Lịch sử</topic>')
    expect(userMessage).not.toContain('<b>')
    expect(userMessage).not.toContain('\u0000')
  })

  it('request body sends response_format json_schema with thinking disabled', async () => {
    const fetchMock = vi.fn(async () => okResponse()) as unknown as GenerateQuizDeps['fetch']
    const deps = makeDeps({ fetch: fetchMock })
    deps.env.AI_BASE_URL = 'https://opencode.ai/inference/go/openai/v1'
    await handleGenerateQuiz(input(), deps)
    const body = requestBody(fetchMock)

    expect(body.model).toBe(PRIMARY)
    expect(body.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { name: 'quiz', strict: true },
    })
    expect(body.max_tokens).toBe(3000)
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.response_format).toMatchObject({ json_schema: { schema: { type: 'object' } } })
  })

  it('sends opencode session header to the configured base url', async () => {
    const fetchMock = vi.fn(async () => okResponse()) as unknown as GenerateQuizDeps['fetch']
    const deps = makeDeps({ fetch: fetchMock })
    deps.env.AI_BASE_URL = 'https://opencode.ai/inference/go/openai/v1/'
    await handleGenerateQuiz(input(), deps)
    const call = (fetchMock as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls[0]!
    const headers = call[1].headers as Record<string, string>

    expect(call[0]).toBe('https://opencode.ai/inference/go/openai/v1/chat/completions')
    expect(headers['x-opencode-session']).toBeTruthy()
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`)
  })

  it('upstream error on primary model falls back to the next model', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(okResponse('fallback/one')) as unknown as GenerateQuizDeps['fetch']
    const result = await handleGenerateQuiz(input(), makeDeps({ fetch: fetchMock }))

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ ok: true, model: 'fallback/one' })
    expect(requestBody(fetchMock, 0).model).toBe(PRIMARY)
    expect(requestBody(fetchMock, 1).model).toBe('fallback/one')
  })

  it('non POST method returns 405', async () => {
    const deps = makeDeps()
    const response = await handleGenerateQuizRequest(
      new Request('http://localhost/api/generate-quiz', { method: 'GET' }),
      deps,
    )

    expect(response.status).toBe(405)
    expect(deps.fetch).not.toHaveBeenCalled()
  })

  it('system prompt tells model to reject instructions and non-knowledge topics', () => {
    expect(SYSTEM_PROMPT).toContain('CHỦ ĐỀ KIẾN THỨC')
    expect(SYSTEM_PROMPT).toContain('câu lệnh hoặc yêu cầu dành cho AI')
    expect(SYSTEM_PROMPT).toContain('không phải chủ đề kiến thức')
    expect(SYSTEM_PROMPT).toContain('{"error":"inappropriate_topic","questions":[]}')
  })

  it('openrouter base url sends reasoning disabled and referer headers', async () => {
    const fetchMock = vi.fn(async () => okResponse()) as unknown as GenerateQuizDeps['fetch']
    const deps = makeDeps({ fetch: fetchMock })
    deps.env.AI_BASE_URL = 'https://openrouter.ai/api/v1'
    await handleGenerateQuiz(input(), deps)

    const call = (fetchMock as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls[0]!
    const headers = call[1].headers as Record<string, string>
    const body = requestBody(fetchMock)

    expect(call[0]).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(body.reasoning).toEqual({ enabled: false })
    expect(body.thinking).toBeUndefined()
    expect(headers['HTTP-Referer']).toBe('http://localhost:5173')
    expect(headers['X-Title']).toBe('QuizLead')
    expect(headers['x-opencode-session']).toBeUndefined()
  })

  it('opencode base url keeps thinking disabled and session header', async () => {
    const fetchMock = vi.fn(async () => okResponse()) as unknown as GenerateQuizDeps['fetch']
    const deps = makeDeps({ fetch: fetchMock })
    deps.env.AI_BASE_URL = 'https://opencode.ai/inference/go/openai/v1'
    await handleGenerateQuiz(input(), deps)

    const call = (fetchMock as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls[0]!
    const headers = call[1].headers as Record<string, string>
    const body = requestBody(fetchMock)

    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.reasoning).toBeUndefined()
    expect(headers['x-opencode-session']).toBeTruthy()
    expect(headers['HTTP-Referer']).toBeUndefined()
  })

  it('AI_API_KEY takes priority and legacy key names still work', () => {
    expect(resolveApiKey({ AI_API_KEY: 'ai', OPENROUTER_API_KEY: 'or', OPENCODE_API_KEY: 'oc' })).toBe('ai')
    expect(resolveApiKey({ OPENROUTER_API_KEY: 'or', OPENCODE_API_KEY: 'oc' })).toBe('or')
    expect(resolveApiKey({ OPENCODE_API_KEY: 'oc' })).toBe('oc')
    expect(resolveApiKey({})).toBe('')
  })

  it('missing AI_BASE_URL defaults to openrouter', async () => {
    const fetchMock = vi.fn(async () => okResponse()) as unknown as GenerateQuizDeps['fetch']
    const deps = makeDeps({ fetch: fetchMock })
    delete deps.env.AI_BASE_URL
    await handleGenerateQuiz(input(), deps)

    const call = (fetchMock as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls[0]!
    const body = requestBody(fetchMock)

    expect(providerFor(undefined)).toBe('openrouter')
    expect(call[0]).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(body.reasoning).toEqual({ enabled: false })
  })

  it('uses shared quota when upstash is configured', async () => {
    const store = new MemoryStore()
    const fetchMock = vi.fn(async () => okResponse()) as unknown as GenerateQuizDeps['fetch']
    const deps = makeDeps({
      fetch: fetchMock,
      store,
      env: {
        ...makeDeps().env,
        ONLINE_SECRET: 'a'.repeat(32),
        ADMIN_PASSCODE: 'passcode1',
        AI_RATE_LIMIT_PER_MIN: '1',
      },
    })

    expect((await handleGenerateQuiz(input(), deps)).status).toBe(200)
    const blocked = await handleGenerateQuiz(input(), deps)
    expect(blocked.status).toBe(429)
    expect(blocked.body).toMatchObject({ ok: false, code: 'RATE_LIMIT' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('daily limit returns 429 DAILY_LIMIT without calling the model', async () => {
    const store = new MemoryStore()
    const fetchMock = vi.fn(async () => okResponse()) as unknown as GenerateQuizDeps['fetch']
    const deps = makeDeps({
      fetch: fetchMock,
      store,
      env: {
        ...makeDeps().env,
        ONLINE_SECRET: 'a'.repeat(32),
        ADMIN_PASSCODE: 'passcode1',
        AI_DAILY_LIMIT: '1',
        AI_RATE_LIMIT_PER_MIN: '10',
      },
    })

    expect((await handleGenerateQuiz(input(), deps)).status).toBe(200)
    const blocked = await handleGenerateQuiz(input(), deps)
    expect(blocked.status).toBe(429)
    expect(blocked.body).toMatchObject({
      ok: false,
      code: 'DAILY_LIMIT',
      message: 'AI đã dùng hết lượt hôm nay. Bạn vẫn có thể dùng bộ câu hỏi mẫu.',
    })
    expect(blocked.headers?.['Retry-After']).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('quota store error lets the request through', async () => {
    class BrokenStore extends MemoryStore {
      override async incr(): Promise<number> {
        throw new Error('UPSTASH_DOWN')
      }
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = new BrokenStore()
    const fetchMock = vi.fn(async () => okResponse()) as unknown as GenerateQuizDeps['fetch']
    const deps = makeDeps({
      fetch: fetchMock,
      store,
      env: {
        ...makeDeps().env,
        ONLINE_SECRET: 'a'.repeat(32),
        ADMIN_PASSCODE: 'passcode1',
      },
    })

    const result = await handleGenerateQuiz(input(), deps)
    expect(result.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls.map((call) => call.join(' ')).join('\n')).toContain('AI_QUOTA_STORE_ERROR')
    warn.mockRestore()
  })

  it('invalid body does not consume quota', async () => {
    const store = new MemoryStore()
    const deps = makeDeps({
      store,
      env: {
        ...makeDeps().env,
        ONLINE_SECRET: 'a'.repeat(32),
        ADMIN_PASSCODE: 'passcode1',
      },
    })

    const result = await handleGenerateQuiz({ topic: '', difficulty: 'medium', language: 'vi' }, deps)
    expect(result.status).toBe(400)
    expect(deps.fetch).not.toHaveBeenCalled()
    expect(await store.get(`ql:ai:day:generate:${vietnamDay(deps.now())}`)).toBeNull()
  })
})
