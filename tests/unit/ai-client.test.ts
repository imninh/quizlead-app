import { describe, expect, it, vi } from 'vitest'
import type { AiQuizRequest } from '../../src/domain/schemas'
import { HttpProvider } from '../../src/services/aiClient'

const request: AiQuizRequest = { topic: 'Ẩm thực Việt Nam', difficulty: 'medium', language: 'vi' }

function validQuestions() {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `q-${i}`,
    text: `Câu hỏi ${i + 1}?`,
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    explanation: 'Vì A đúng.',
  }))
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('http provider', () => {
  it('maps 422 to INAPPROPRIATE', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: false, code: 'INAPPROPRIATE' }, 422))
    const provider = new HttpProvider(fetchMock)
    const result = await provider.generateQuiz(request)

    expect(result).toMatchObject({ ok: false, code: 'INAPPROPRIATE' })
  })

  it('maps 429 to RATE_LIMIT', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: false, code: 'RATE_LIMIT' }, 429))
    const provider = new HttpProvider(fetchMock)
    const result = await provider.generateQuiz(request)

    expect(result).toMatchObject({ ok: false, code: 'RATE_LIMIT' })
  })

  it('daily limit maps to DAILY_LIMIT with vietnamese message', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: false, code: 'DAILY_LIMIT' }, 429))
    const provider = new HttpProvider(fetchMock)
    const result = await provider.generateQuiz(request)

    expect(result).toMatchObject({
      ok: false,
      code: 'DAILY_LIMIT',
      message: 'AI đã dùng hết lượt hôm nay. Bạn vẫn có thể dùng bộ câu hỏi mẫu.',
    })
  })

  it('network error maps to NETWORK', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const provider = new HttpProvider(fetchMock)
    const result = await provider.generateQuiz(request)

    expect(result).toMatchObject({ ok: false, code: 'NETWORK' })
  })

  it('rejects server response that fails zod', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ ok: true, questions: validQuestions().slice(0, 1), model: 'test/model' }),
    )
    const provider = new HttpProvider(fetchMock)
    const result = await provider.generateQuiz(request)

    expect(result).toMatchObject({ ok: false, code: 'BAD_OUTPUT' })
  })
})
