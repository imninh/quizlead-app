import { describe, expect, it } from 'vitest'
import { pickQuestions } from '../../src/services/mock/quizBank'
import { AiQuizResponseSchema } from '../../src/domain/schemas'

const topics = ['digital marketing', 'công nghệ', 'ẩm thực', 'kiến thức chung']

describe('quiz bank', () => {
  it('every bank passes AiQuizResponseSchema', () => {
    for (const topic of topics) {
      const result = AiQuizResponseSchema.safeParse({ questions: pickQuestions(topic) })
      expect(result.success).toBe(true)
      if (result.success && 'questions' in result.data) {
        expect(result.data.questions).toHaveLength(5)
      }
    }
  })

  it('correct answers are 5 per position across 20 questions', () => {
    const counts = [0, 0, 0, 0]
    for (const topic of topics) {
      for (const question of pickQuestions(topic)) {
        counts[question.correctIndex] = counts[question.correctIndex]! + 1
      }
    }
    expect(counts).toEqual([5, 5, 5, 5])
  })

  it('hai san does not match tech bank', () => {
    const questions = pickQuestions('hải sản')
    expect(questions.every((question) => !question.id.startsWith('t'))).toBe(true)
  })

  it('thanh pho does not match food bank', () => {
    const questions = pickQuestions('thành phố')
    expect(questions.every((question) => !question.id.startsWith('f'))).toBe(true)
  })
})
