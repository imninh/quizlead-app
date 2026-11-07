import { z } from 'zod'
import { AiQuizRequestSchema, type Question } from '../src/domain/schemas.js'
import { MSG } from '../src/domain/messages.js'
import { checkAiQuota } from './aiQuota.js'
import { getOnlineConfig, type OnlineStore } from './online/store.js'
import { DIFFICULTY_LABELS, REVIEW_SYSTEM_PROMPT, SYSTEM_PROMPT, buildReviewPrompt, buildUserPrompt } from './prompt.js'

// API kiểu OpenAI. Đổi nhà cung cấp chỉ cần đổi AI_BASE_URL + key.
export const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'
export const DEFAULT_MODEL = 'anthropic/claude-haiku-5.5'
const DEFAULT_TIMEOUT_MS = 20000
const REVIEW_TIMEOUT_MS = 25000
const MAX_BODY_BYTES = 2048
const RATE_LIMIT_WINDOW_MS = 60000

export type ProviderKind = 'openrouter' | 'opencode' | 'generic'

/** Nhận diện nhà cung cấp theo hostname để gửi đúng trường riêng. */
export function providerFor(baseUrl: string | undefined): ProviderKind {
  const url = (baseUrl?.trim() || DEFAULT_BASE_URL).toLowerCase()
  if (url.includes('openrouter.ai')) return 'openrouter'
  if (url.includes('opencode.ai')) return 'opencode'
  return 'generic'
}

/** Key chung AI_API_KEY; vẫn đọc tên cũ để .env.local hiện tại chạy ngay. */
export function resolveApiKey(env: Record<string, string | undefined>): string {
  return (
    env.AI_API_KEY?.trim() ||
    env.OPENROUTER_API_KEY?.trim() ||
    env.OPENCODE_API_KEY?.trim() ||
    ''
  )
}

// Best-effort per serverless instance. The hard budget guard is the usage limit of the API key.
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

export function resetRateLimit(): void {
  rateBuckets.clear()
}

export function secureRandom(): number {
  const value = new Uint32Array(1)
  globalThis.crypto.getRandomValues(value)
  return (value[0] ?? 0) / 2 ** 32
}

export type GenerateQuizDeps = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  env: Record<string, string | undefined>
  now: () => number
  random: () => number
  ip: string
  timeoutMs?: number
  store?: OnlineStore
}

export type GenerateErrorCode =
  | 'INVALID_INPUT'
  | 'INAPPROPRIATE'
  | 'RATE_LIMIT'
  | 'DAILY_LIMIT'
  | 'TIMEOUT'
  | 'BAD_OUTPUT'
  | 'UPSTREAM'
  | 'CONFIG'

export type GenerateResult =
  | {
      status: 200
      body: {
        ok: true
        questions: Question[]
        model: string
        usage: { prompt_tokens: number; completion_tokens: number }
      }
      headers?: Record<string, string>
    }
  | {
      status: number
      body: { ok: false; code: GenerateErrorCode; message: string }
      headers?: Record<string, string>
    }

type HttpDeps = Omit<GenerateQuizDeps, 'ip'> & { ip?: string }

const OptionSchema = z.string().trim().min(1).max(150)
const ModelQuestionSchema = z.object({
  text: z.string().trim().min(5).max(300),
  options: z.tuple([OptionSchema, OptionSchema, OptionSchema, OptionSchema]),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(1).max(200),
})
const ModelQuizSchema = z.object({ questions: z.array(ModelQuestionSchema).length(5) })
type ModelQuestion = z.infer<typeof ModelQuestionSchema>
// Gốc luôn là 1 object: nhiều provider không nhận anyOf ở gốc khi bật strict.
// Model trả `error: null` + 5 câu, hoặc `error: "inappropriate_topic"` + mảng rỗng.
const ModelResponseSchema = z.object({
  error: z.string().nullable().optional(),
  questions: z.array(z.unknown()).optional(),
})

const QUESTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    correctIndex: { type: 'integer' },
    explanation: { type: 'string' },
  },
  required: ['text', 'options', 'correctIndex', 'explanation'],
  additionalProperties: false,
} as const

const QUIZ_JSON_SCHEMA = {
  type: 'object',
  properties: {
    error: { type: ['string', 'null'] },
    questions: { type: 'array', items: QUESTION_JSON_SCHEMA },
  },
  required: ['error', 'questions'],
  additionalProperties: false,
} as const

function sanitizeTopic(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex -- cố ý lọc ký tự điều khiển khỏi chủ đề (R-81)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function getMessageContent(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return null
  const first = payload.choices[0]
  if (!isRecord(first) || !isRecord(first.message)) return null
  return typeof first.message.content === 'string' ? first.message.content : null
}

function getUsage(payload: unknown): { prompt_tokens: number; completion_tokens: number } {
  if (!isRecord(payload) || !isRecord(payload.usage)) {
    return { prompt_tokens: 0, completion_tokens: 0 }
  }
  return {
    prompt_tokens: readNumber(payload.usage.prompt_tokens),
    completion_tokens: readNumber(payload.usage.completion_tokens),
  }
}

function parseJsonContent(content: string): unknown {
  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

function issuesToText(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ')
}

function validateQuestions(quiz: z.infer<typeof ModelQuizSchema>): string | null {
  const seenQuestions = new Set<string>()
  for (const question of quiz.questions) {
    const normalizedText = question.text.normalize('NFC').toLowerCase()
    if (seenQuestions.has(normalizedText)) return 'questions: duplicate question'
    seenQuestions.add(normalizedText)

    const seenOptions = new Set<string>()
    for (const option of question.options) {
      const normalizedOption = option.normalize('NFC').toLowerCase()
      if (seenOptions.has(normalizedOption)) return 'options: duplicate option'
      seenOptions.add(normalizedOption)
    }
  }
  return null
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const current = result[i]!
    result[i] = result[j]!
    result[j] = current
  }
  return result
}

function newQuestionId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function shuffleQuestions(questions: z.infer<typeof ModelQuizSchema>['questions'], random: () => number): Question[] {
  return questions.map((question) => {
    const correctText = question.options[question.correctIndex]!
    const options = shuffle([...question.options], random)
    const correctIndex = options.indexOf(correctText)
    if (correctIndex < 0) throw new Error('correct answer missing after shuffle')
    return {
      id: newQuestionId(),
      text: question.text,
      options: options as [string, string, string, string],
      correctIndex: correctIndex as 0 | 1 | 2 | 3,
      explanation: question.explanation,
    }
  })
}

function getRateLimit(env: Record<string, string | undefined>): number {
  const parsed = Number.parseInt(env.AI_RATE_LIMIT_PER_MIN ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10
}

function getModels(env: Record<string, string | undefined>): string[] {
  const primary = env.AI_MODEL?.trim() || DEFAULT_MODEL
  const fallbacks = (env.AI_FALLBACK_MODELS ?? '')
    .split(',')
    .map((model) => model.trim())
    .filter((model) => model.length > 0 && model !== primary)
  return [primary, ...fallbacks]
}

function checkRateLimit(ip: string, limit: number, now: number): { allowed: true } | { allowed: false; retryAfter: number } {
  const current = rateBuckets.get(ip)
  if (!current || now >= current.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true }
  }
  if (current.count >= limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) }
  }
  current.count += 1
  return { allowed: true }
}

/** Dùng chung bucket cho generate-quiz và ghost-run. */
export function consumeRateLimit(
  ip: string,
  env: Record<string, string | undefined>,
  now: number,
): { allowed: true } | { allowed: false; retryAfter: number } {
  return checkRateLimit(ip, getRateLimit(env), now)
}

function failure(status: number, code: GenerateErrorCode, message: string, headers?: Record<string, string>): GenerateResult {
  return { status, body: { ok: false, code, message }, headers }
}

function logRequest(input: {
  model: string
  latencyMs: number
  tokens: number
  outcome: string
  attempt: number
}): void {
  console.info(
    JSON.stringify({
      model: input.model,
      latencyMs: input.latencyMs,
      tokens: input.tokens,
      outcome: input.outcome,
      attempt: input.attempt,
    }),
  )
}

export async function handleGenerateQuiz(body: unknown, deps: GenerateQuizDeps): Promise<GenerateResult> {
  const startedAt = deps.now()
  let attempt = 0
  let model = ''
  let promptTokens = 0
  let completionTokens = 0

  const finish = (result: GenerateResult): GenerateResult => {
    logRequest({
      model,
      latencyMs: deps.now() - startedAt,
      tokens: promptTokens + completionTokens,
      outcome: result.body.ok ? 'ok' : result.body.code,
      attempt,
    })
    return result
  }

  if (!isRecord(body)) {
    return finish(failure(400, 'INVALID_INPUT', 'Dữ liệu yêu cầu không hợp lệ.'))
  }

  const candidate = { ...body, topic: typeof body.topic === 'string' ? sanitizeTopic(body.topic) : body.topic }
  const parsedInput = AiQuizRequestSchema.safeParse(candidate)
  if (!parsedInput.success) {
    return finish(failure(400, 'INVALID_INPUT', 'Dữ liệu yêu cầu không hợp lệ.'))
  }

  const apiKey = resolveApiKey(deps.env)
  if (!apiKey) {
    model = deps.env.AI_MODEL?.trim() || DEFAULT_MODEL
    return finish(failure(500, 'CONFIG', 'AI chưa được cấu hình.'))
  }

  const ip = deps.ip.trim() || 'unknown'
  const onlineConfig = getOnlineConfig(deps.env, deps.store)
  if (onlineConfig.store) {
    const quota = await checkAiQuota({
      store: onlineConfig.store,
      ip,
      kind: 'generate',
      env: deps.env,
      now: deps.now(),
    })
    if (!quota.allowed) {
      model = deps.env.AI_MODEL?.trim() || DEFAULT_MODEL
      return finish(
        failure(429, quota.code, quota.code === 'DAILY_LIMIT' ? MSG.aiDailyLimit : 'Bạn đã gửi quá nhiều yêu cầu. Thử lại sau.', {
          'Retry-After': String(quota.retryAfter),
        }),
      )
    }
  } else {
    const limit = getRateLimit(deps.env)
    const bucket = checkRateLimit(ip, limit, deps.now())
    if (!bucket.allowed) {
      model = deps.env.AI_MODEL?.trim() || DEFAULT_MODEL
      return finish(
        failure(429, 'RATE_LIMIT', 'Bạn đã gửi quá nhiều yêu cầu. Thử lại sau.', {
          'Retry-After': String(bucket.retryAfter),
        }),
      )
    }
  }

  const models = getModels(deps.env)
  let modelIndex = 0
  model = models[0]!
  const baseUrl = deps.env.AI_BASE_URL?.trim() || DEFAULT_BASE_URL
  const chatUrl = `${baseUrl.replace(/\/+$/, '')}/chat/completions`
  const provider = providerFor(baseUrl)
  // OpenCode Go bắt buộc header này để định tuyến; 1 phiên cho mỗi lượt tạo quiz.
  const sessionId = newQuestionId()
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(parsedInput.data.topic, DIFFICULTY_LABELS[parsedInput.data.difficulty]) },
  ]

  const buildHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
    if (provider === 'opencode') headers['x-opencode-session'] = sessionId
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = deps.env.APP_URL?.trim() || 'http://localhost:5173'
      headers['X-Title'] = 'QuizLead'
    }
    return headers
  }

  const buildBody = (currentModel: string, bodyMessages = messages): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      model: currentModel,
      messages: bodyMessages,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'quiz', strict: true, schema: QUIZ_JSON_SCHEMA },
      },
      max_tokens: 3000,
      // Thấp để câu hỏi kiến thức bám sự thật, ít "sáng tác".
      temperature: 0.3,
    }
    // Tắt suy luận: eval cho thấy suy luận tốn ~1.600 token và làm câu trả lời bị cắt cụt.
    if (provider === 'openrouter') body.reasoning = { enabled: false }
    if (provider === 'opencode') body.thinking = { type: 'disabled' }
    return body
  }

  let lastError = ''

  /**
   * Lượt kiểm duyệt: AI soát lại 5 câu theo danh sách kiểm tra, thay câu sai/mơ hồ.
   * An toàn khi lỗi: hỏng, chậm hay output sai định dạng thì giữ nguyên bản gốc (người tạo vẫn duyệt trước khi lưu).
   */
  const reviewQuestions = async (questions: ModelQuestion[]): Promise<ModelQuestion[]> => {
    if (deps.env.AI_REVIEW?.trim().toLowerCase() === 'off') return questions
    const controller = new AbortController()
    let timer: ReturnType<typeof globalThis.setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = globalThis.setTimeout(() => {
          controller.abort()
          reject(new Error('timeout'))
        }, deps.timeoutMs ?? REVIEW_TIMEOUT_MS)
      })
      const reviewMessages: typeof messages = [
        { role: 'system', content: REVIEW_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildReviewPrompt(parsedInput.data.topic, DIFFICULTY_LABELS[parsedInput.data.difficulty], questions),
        },
      ]
      // Soát cần "nghĩ" để bắt lỗi kiến thức: bật suy luận mức thấp (một số model bắt buộc), nới giới hạn token.
      const reviewBody = buildBody(deps.env.AI_REVIEW_MODEL?.trim() || models[modelIndex]!, reviewMessages)
      reviewBody.max_tokens = 8000
      if (provider === 'openrouter') reviewBody.reasoning = { effort: 'low' }
      const response = await Promise.race([
        deps.fetch(chatUrl, {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify(reviewBody),
          signal: controller.signal,
        }),
        timeout,
      ])
      if (!response.ok) return questions
      const payload: unknown = await response.json()
      const usage = getUsage(payload)
      promptTokens += usage.prompt_tokens
      completionTokens += usage.completion_tokens
      const content = getMessageContent(payload)
      const parsed = ModelResponseSchema.safeParse(content ? parseJsonContent(content) : null)
      if (!parsed.success || parsed.data.error) return questions
      const reviewed = ModelQuizSchema.safeParse({ questions: parsed.data.questions })
      if (!reviewed.success || validateQuestions(reviewed.data)) return questions
      return reviewed.data.questions
    } catch {
      return questions
    } finally {
      if (timer) globalThis.clearTimeout(timer)
    }
  }

  for (attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController()
    const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS
    let timedOut = false
    let timer: ReturnType<typeof globalThis.setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = globalThis.setTimeout(() => {
        timedOut = true
        controller.abort()
        reject(new Error('timeout'))
      }, timeoutMs)
    })
    let response: Response
    try {
      response = await Promise.race([
        deps.fetch(chatUrl, {
          method: 'POST',
          headers: buildHeaders(),
          body: JSON.stringify(buildBody(models[modelIndex]!)),
          signal: controller.signal,
        }),
        timeout,
      ])
    } catch {
      if (timedOut || controller.signal.aborted) {
        return finish(failure(504, 'TIMEOUT', 'AI phản hồi quá lâu. Thử lại sau.'))
      }
      if (modelIndex < models.length - 1) {
        model = models[++modelIndex]!
        attempt--
        continue
      }
      return finish(failure(502, 'UPSTREAM', 'AI đang bận. Thử lại sau.'))
    } finally {
      if (timer) globalThis.clearTimeout(timer)
    }

    if (!response.ok) {
      // Model dự phòng: lỗi phía nhà cung cấp thì thử model kế tiếp (không tính là 1 lần thử output).
      if (modelIndex < models.length - 1) {
        model = models[++modelIndex]!
        attempt--
        continue
      }
      return finish(failure(502, 'UPSTREAM', 'AI đang bận. Thử lại sau.'))
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      return finish(failure(502, 'UPSTREAM', 'AI đang bận. Thử lại sau.'))
    }

    const usage = getUsage(payload)
    promptTokens += usage.prompt_tokens
    completionTokens += usage.completion_tokens
    if (isRecord(payload) && typeof payload.model === 'string' && payload.model.trim()) {
      model = payload.model.trim()
    }

    const content = getMessageContent(payload)
    const parsedJson = content ? parseJsonContent(content) : null
    const parsedOutput = ModelResponseSchema.safeParse(parsedJson)

    if (!parsedOutput.success) {
      lastError = issuesToText(parsedOutput.error)
      if (attempt === 1) {
        messages.push({
          role: 'user',
          content: `Câu trả lời trước không hợp lệ (${lastError}). Hãy trả lại đúng JSON schema, không thêm chữ nào ngoài JSON.`,
        })
        continue
      }
      return finish(failure(502, 'BAD_OUTPUT', 'AI trả về dữ liệu không hợp lệ.'))
    }

    if (parsedOutput.data.error === 'inappropriate_topic') {
      return finish(failure(422, 'INAPPROPRIATE', MSG.aiInappropriate))
    }

    const quiz = ModelQuizSchema.safeParse({ questions: parsedOutput.data.questions })
    if (!quiz.success) {
      lastError = issuesToText(quiz.error)
      if (attempt === 1) {
        messages.push({
          role: 'user',
          content: `Câu trả lời trước không hợp lệ (${lastError}). Hãy trả lại đúng JSON schema, không thêm chữ nào ngoài JSON.`,
        })
        continue
      }
      return finish(failure(502, 'BAD_OUTPUT', 'AI trả về dữ liệu không hợp lệ.'))
    }

    const duplicateError = validateQuestions(quiz.data)
    if (duplicateError) {
      lastError = duplicateError
      if (attempt === 1) {
        messages.push({
          role: 'user',
          content: `Câu trả lời trước không hợp lệ (${lastError}). Hãy trả lại đúng JSON schema, không thêm chữ nào ngoài JSON.`,
        })
        continue
      }
      return finish(failure(502, 'BAD_OUTPUT', 'AI trả về dữ liệu không hợp lệ.'))
    }

    try {
      return finish({
        status: 200,
        body: {
          ok: true,
          questions: shuffleQuestions(await reviewQuestions(quiz.data.questions), deps.random),
          model,
          usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
        },
      })
    } catch {
      return finish(failure(502, 'BAD_OUTPUT', 'AI trả về dữ liệu không hợp lệ.'))
    }
  }

  return finish(failure(502, 'BAD_OUTPUT', 'AI trả về dữ liệu không hợp lệ.'))
}

export async function handleGenerateQuizRequest(request: Request, deps: HttpDeps): Promise<Response> {
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
  const ip = deps.ip ?? forwarded?.split(',')[0]?.trim() ?? 'unknown'
  const result = await handleGenerateQuiz(body, { ...deps, ip })
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...result.headers,
    },
  })
}
