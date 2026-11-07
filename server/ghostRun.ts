import { z } from 'zod'
import {
  consumeRateLimit,
  providerFor,
  resolveApiKey,
  DEFAULT_BASE_URL,
} from './generateQuiz.ts'
import { checkAiQuota } from './aiQuota.ts'
import { getOnlineConfig, type OnlineStore } from './online/store.ts'
import { MSG } from '../src/domain/messages.ts'
import { GHOST_SYSTEM_PROMPT, buildGhostPrompt } from './prompt.ts'

const DEFAULT_GHOST_MODEL = 'qwen/qwen3.5-flash-02-23'
const DEFAULT_QUESTION_TIMEOUT_MS = 30000
const MAX_BODY_BYTES = 16384

const QuestionInputSchema = z.object({
  text: z.string().min(1).max(300),
  options: z.tuple([z.string().max(150), z.string().max(150), z.string().max(150), z.string().max(150)]),
})

export const GhostInputSchema = z.object({
  questions: z.array(QuestionInputSchema).length(5),
})

const AnswerSchema = z.object({ answer: z.enum(['A', 'B', 'C', 'D']) })

export type GhostRunDeps = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  env: Record<string, string | undefined>
  now: () => number
  ip?: string
  questionTimeoutMs?: number
  store?: OnlineStore
}

export type GhostAnswer = {
  selectedIndex: 0 | 1 | 2 | 3 | null
  elapsedMs: number
  modelLatencyMs: number
  readingMs: number
}

export type GhostRunResult =
  | {
      status: 200
      body: { ok: true; model: string; ranAt: number; answers: GhostAnswer[] }
    }
  | {
      status: number
      body: { ok: false; code: string; message: string }
      headers?: Record<string, string>
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function clampElapsed(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_QUESTION_TIMEOUT_MS
  return Math.max(1500, Math.min(DEFAULT_QUESTION_TIMEOUT_MS, Math.round(value)))
}

/** R-103 mới: 60ms cho mỗi ký tự câu hỏi + 4 đáp án (thời gian đọc như người). */
export function humanReadingMs(text: string, options: [string, string, string, string]): number {
  return 60 * (text.length + options.reduce((sum, option) => sum + option.length, 0))
}

function contentOf(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return null
  const first = payload.choices[0]
  if (!isRecord(first) || !isRecord(first.message)) return null
  return typeof first.message.content === 'string' ? first.message.content : null
}

function parseAnswer(content: string | null): 0 | 1 | 2 | 3 | null {
  if (!content) return null
  try {
    const parsed = AnswerSchema.safeParse(JSON.parse(content))
    if (!parsed.success) return null
    return (parsed.data.answer.charCodeAt(0) - 65) as 0 | 1 | 2 | 3
  } catch {
    return null
  }
}

function buildHeaders(
  apiKey: string,
  provider: 'openrouter' | 'opencode' | 'generic',
  env: Record<string, string | undefined>,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = env.APP_URL?.trim() || 'http://localhost:5173'
    headers['X-Title'] = 'QuizLead'
  }
  if (provider === 'opencode') headers['x-opencode-session'] = crypto.randomUUID()
  return headers
}

function buildBody(model: string, question: string, options: [string, string, string, string], provider: 'openrouter' | 'opencode' | 'generic') {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: GHOST_SYSTEM_PROMPT },
      { role: 'user', content: buildGhostPrompt(question, options) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'ghost_answer',
        strict: true,
        schema: {
          type: 'object',
          properties: { answer: { type: 'string', enum: ['A', 'B', 'C', 'D'] } },
          required: ['answer'],
          additionalProperties: false,
        },
      },
    },
    max_tokens: 30,
    temperature: 0.7,
  }
  if (provider === 'openrouter') body.reasoning = { enabled: false }
  if (provider === 'opencode') body.thinking = { type: 'disabled' }
  return body
}

export async function handleGhostRun(body: unknown, deps: GhostRunDeps): Promise<GhostRunResult> {
  const parsed = GhostInputSchema.safeParse(body)
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: 'INVALID_INPUT', message: 'Dữ liệu câu hỏi không hợp lệ.' } }
  }

  const apiKey = resolveApiKey(deps.env)
  const model = deps.env.AI_GHOST_MODEL?.trim() || DEFAULT_GHOST_MODEL
  if (!apiKey) {
    return { status: 500, body: { ok: false, code: 'CONFIG', message: 'AI chưa được cấu hình.' } }
  }

  const ip = deps.ip?.trim() || 'unknown'
  const onlineConfig = getOnlineConfig(deps.env, deps.store)
  if (onlineConfig.store) {
    const quota = await checkAiQuota({
      store: onlineConfig.store,
      ip,
      kind: 'ghost',
      env: deps.env,
      now: deps.now(),
    })
    if (!quota.allowed) {
      return {
        status: 429,
        body: {
          ok: false,
          code: quota.code,
          message: quota.code === 'DAILY_LIMIT'
            ? MSG.aiDailyLimit
            : 'Bạn đã gửi quá nhiều yêu cầu. Thử lại sau.',
        },
        headers: { 'Retry-After': String(quota.retryAfter) },
      }
    }
  } else {
    const bucket = consumeRateLimit(ip, deps.env, deps.now())
    if (!bucket.allowed) {
      return {
        status: 429,
        body: { ok: false, code: 'RATE_LIMIT', message: 'Bạn đã gửi quá nhiều yêu cầu. Thử lại sau.' },
        headers: { 'Retry-After': String(bucket.retryAfter) },
      }
    }
  }

  const baseUrl = deps.env.AI_BASE_URL?.trim() || DEFAULT_BASE_URL
  const chatUrl = `${baseUrl.replace(/\/+$/, '')}/chat/completions`
  const provider = providerFor(baseUrl)
  const startedAt = deps.now()
  const timeoutMs = deps.questionTimeoutMs ?? DEFAULT_QUESTION_TIMEOUT_MS
  let usedModel = model

  const answers = await Promise.all(
    parsed.data.questions.map(async (question): Promise<GhostAnswer> => {
      const questionStarted = deps.now()
      const controller = new AbortController()
      let timedOut = false
      let timer: ReturnType<typeof globalThis.setTimeout> | undefined
      const timeout = new Promise<never>((_, reject) => {
        timer = globalThis.setTimeout(() => {
          timedOut = true
          controller.abort()
          reject(new Error('timeout'))
        }, timeoutMs)
      })

      try {
        const response = await Promise.race([
          deps.fetch(chatUrl, {
            method: 'POST',
            headers: buildHeaders(apiKey, provider, deps.env),
            body: JSON.stringify(buildBody(model, question.text, question.options, provider)),
            signal: controller.signal,
          }),
          timeout,
        ])
        const modelLatencyMs = deps.now() - questionStarted
        const readingMs = humanReadingMs(question.text, question.options)
        const elapsedMs = clampElapsed(modelLatencyMs + readingMs)
        if (!response.ok) {
          return { selectedIndex: null, elapsedMs, modelLatencyMs, readingMs }
        }
        const payload: unknown = await response.json()
        if (isRecord(payload) && typeof payload.model === 'string' && payload.model.trim()) usedModel = payload.model.trim()
        const selectedIndex = parseAnswer(contentOf(payload))
        return { selectedIndex, elapsedMs, modelLatencyMs, readingMs }
      } catch {
        const modelLatencyMs = timedOut ? DEFAULT_QUESTION_TIMEOUT_MS : deps.now() - questionStarted
        const readingMs = humanReadingMs(question.text, question.options)
        return {
          selectedIndex: null,
          elapsedMs: clampElapsed(modelLatencyMs + readingMs),
          modelLatencyMs,
          readingMs,
        }
      } finally {
        if (timer) globalThis.clearTimeout(timer)
      }
    }),
  )

  console.info(
    JSON.stringify({
      model: usedModel,
      latencyMs: deps.now() - startedAt,
      questions: answers.length,
      outcome: 'ok',
    }),
  )

  return {
    status: 200,
    body: { ok: true, model: usedModel, ranAt: startedAt, answers },
  }
}

export async function handleGhostRunRequest(request: Request, deps: GhostRunDeps): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, code: 'INVALID_INPUT', message: 'Chỉ hỗ trợ phương thức POST.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  const contentLength = Number.parseInt(request.headers.get('content-length') ?? '', 10)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ ok: false, code: 'INVALID_INPUT', message: 'Dữ liệu yêu cầu quá lớn.' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  let text: string
  try {
    text = await request.text()
  } catch {
    return new Response(JSON.stringify({ ok: false, code: 'INVALID_INPUT', message: 'Không đọc được dữ liệu yêu cầu.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ ok: false, code: 'INVALID_INPUT', message: 'Dữ liệu yêu cầu quá lớn.' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return new Response(JSON.stringify({ ok: false, code: 'INVALID_INPUT', message: 'JSON không hợp lệ.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  const forwarded = request.headers.get('x-forwarded-for')
  const result = await handleGhostRun(body, { ...deps, ip: deps.ip ?? forwarded?.split(',')[0]?.trim() ?? 'unknown' })
  const headers = 'headers' in result ? result.headers : undefined
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(headers ?? {}),
    },
  })
}
