import { z } from 'zod'
import { AiQuizRequestSchema, AiQuizResponseSchema, QuestionSchema, AiGhostSchema, type AiGhost, type AiQuizRequest, type Question, type Quiz } from '../domain/schemas'
import { createId } from '../domain/id'
import { MSG } from '../domain/messages'
import { pickQuestions } from './mock/quizBank'

export type AiErrorCode =
  | 'INVALID_INPUT'
  | 'INAPPROPRIATE'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'BAD_OUTPUT'
  | 'RATE_LIMIT'
  | 'DAILY_LIMIT'
  | 'UPSTREAM'
  | 'CONFIG'

export type AiResult =
  | { ok: true; questions: Question[]; mode: 'real' | 'mock'; model?: string }
  | { ok: false; code: AiErrorCode; message: string; retryAfter?: number }

export interface AiProvider {
  generateQuiz(req: AiQuizRequest, signal?: AbortSignal): Promise<AiResult>
}

const INAPPROPRIATE = ['bạo lực', 'cờ bạc', '18+', 'chính trị', 'sex', 'ma túy']

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function isInappropriate(topic: string): boolean {
  const n = normalize(topic)
  return INAPPROPRIATE.some((w) => n.includes(normalize(w)))
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(resolve, ms)
    if (signal) {
      signal.addEventListener('abort', () => {
        globalThis.clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      })
    }
  })
}

export class MockProvider implements AiProvider {
  async generateQuiz(req: AiQuizRequest, signal?: AbortSignal): Promise<AiResult> {
    try {
      await delay(1200, signal)
    } catch {
      return { ok: false, code: 'NETWORK', message: 'Đã huỷ yêu cầu.' }
    }
    if (isInappropriate(req.topic)) {
      return { ok: false, code: 'INAPPROPRIATE', message: MSG.aiInappropriate }
    }
    const questions = pickQuestions(req.topic)
    const parsed = AiQuizResponseSchema.safeParse({ questions })
    if (!parsed.success || !('questions' in parsed.data)) {
      return { ok: false, code: 'BAD_OUTPUT', message: 'Dữ liệu mẫu không hợp lệ.' }
    }
    return {
      ok: true,
      questions: parsed.data.questions.map((q) => ({ ...q, id: createId() })),
      mode: 'mock',
    }
  }
}

const HttpSuccessSchema = z.object({
  ok: z.literal(true),
  questions: z.array(QuestionSchema).length(5),
  model: z.string().min(1),
  usage: z
    .object({ prompt_tokens: z.number(), completion_tokens: z.number() })
    .optional(),
})

const HttpErrorSchema = z.object({
  ok: z.literal(false),
  code: z.string().optional(),
  message: z.string().optional(),
})

const ERROR_MESSAGES: Record<AiErrorCode, string> = {
  INVALID_INPUT: 'Dữ liệu yêu cầu không hợp lệ.',
  INAPPROPRIATE: MSG.aiInappropriate,
  TIMEOUT: 'AI phản hồi quá lâu. Thử lại sau.',
  NETWORK: 'Lỗi mạng.',
  BAD_OUTPUT: 'Kết quả AI không hợp lệ.',
  RATE_LIMIT: 'Bạn đã gửi quá nhiều yêu cầu. Thử lại sau.',
  DAILY_LIMIT: MSG.aiDailyLimit,
  UPSTREAM: 'AI đang bận. Thử lại sau.',
  CONFIG: 'AI chưa được cấu hình.',
}

function mapHttpError(status: number, data: unknown, retryAfter?: number): { code: AiErrorCode; message: string; retryAfter?: number } {
  const parsed = HttpErrorSchema.safeParse(data)
  const serverCode = parsed.success ? parsed.data.code : undefined
  let code: AiErrorCode
  if (status === 422) code = 'INAPPROPRIATE'
  else if (status === 429) code = serverCode === 'DAILY_LIMIT' ? 'DAILY_LIMIT' : 'RATE_LIMIT'
  else if (status === 504) code = 'TIMEOUT'
  else if (status === 400 || status === 413) code = 'INVALID_INPUT'
  else if (status === 500 && serverCode === 'CONFIG') code = 'CONFIG'
  else if (status >= 500) code = 'UPSTREAM'
  else code = 'BAD_OUTPUT'
  return { code, message: ERROR_MESSAGES[code], retryAfter }
}

export class HttpProvider implements AiProvider {
  private readonly fetchImpl: typeof fetch
  private readonly endpoint: string
  private readonly timeoutMs: number

  constructor(
    fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args),
    endpoint = '/api/generate-quiz',
    // Soạn + tự soát mất ~10–20 giây; chừa dư cho lúc model chậm (máy chủ cắt ở 60 giây).
    timeoutMs = 55000,
  ) {
    this.fetchImpl = fetchImpl
    this.endpoint = endpoint
    this.timeoutMs = timeoutMs
  }

  async generateQuiz(req: AiQuizRequest, signal?: AbortSignal): Promise<AiResult> {
    const controller = new AbortController()
    let timedOut = false
    const timer = globalThis.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, this.timeoutMs)
    const onAbort = () => controller.abort()
    if (signal) signal.addEventListener('abort', onAbort)

    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: controller.signal,
      })
      const data: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        const retryHeader = Number.parseInt(response.headers.get('Retry-After') ?? '', 10)
        const retryAfter = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined
        return { ok: false, ...mapHttpError(response.status, data, retryAfter) }
      }

      const parsed = HttpSuccessSchema.safeParse(data)
      if (!parsed.success) {
        return { ok: false, code: 'BAD_OUTPUT', message: ERROR_MESSAGES.BAD_OUTPUT }
      }

      const check = AiQuizResponseSchema.safeParse({ questions: parsed.data.questions })
      if (!check.success || !('questions' in check.data)) {
        return { ok: false, code: 'BAD_OUTPUT', message: ERROR_MESSAGES.BAD_OUTPUT }
      }

      return {
        ok: true,
        questions: check.data.questions,
        mode: 'real',
        model: parsed.data.model,
      }
    } catch {
      if (timedOut) return { ok: false, code: 'TIMEOUT', message: ERROR_MESSAGES.TIMEOUT }
      if (signal?.aborted) return { ok: false, code: 'NETWORK', message: 'Đã huỷ yêu cầu.' }
      return { ok: false, code: 'NETWORK', message: ERROR_MESSAGES.NETWORK }
    } finally {
      globalThis.clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
    }
  }
}

function createDefaultProvider(): AiProvider {
  return import.meta.env.VITE_AI_MODE === 'mock' ? new MockProvider() : new HttpProvider()
}

export async function generateQuiz(
  req: unknown,
  options?: { provider?: AiProvider; signal?: AbortSignal },
): Promise<AiResult> {
  const parsed = AiQuizRequestSchema.safeParse(req)
  if (!parsed.success) {
    return { ok: false, code: 'INVALID_INPUT', message: 'Dữ liệu yêu cầu không hợp lệ.' }
  }
  const provider = options?.provider ?? createDefaultProvider()
  try {
    const result = await provider.generateQuiz(parsed.data, options?.signal)
    if (result.ok) {
      const check = AiQuizResponseSchema.safeParse({ questions: result.questions })
      if (!check.success) return { ok: false, code: 'BAD_OUTPUT', message: 'Kết quả AI không hợp lệ.' }
    }
    return result
  } catch {
    return { ok: false, code: 'NETWORK', message: 'Lỗi mạng.' }
  }
}

const GhostResponseSchema = z.object({
  ok: z.literal(true),
  model: z.string().min(1),
  ranAt: z.number(),
  answers: AiGhostSchema.shape.answers,
})

/** R-103: server tự chọn đáp án cho 5 câu, không nhận correctIndex. */
export async function runGhost(quiz: Quiz): Promise<AiGhost> {
  const response = await globalThis.fetch('/api/ghost-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questions: quiz.questions.map((question) => ({ text: question.text, options: question.options })),
    }),
  })
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error('GHOST_RUN_FAILED')
  const parsed = GhostResponseSchema.safeParse(data)
  if (!parsed.success) throw new Error('GHOST_RUN_BAD_OUTPUT')
  return { model: parsed.data.model, ranAt: parsed.data.ranAt, answers: parsed.data.answers }
}

