import { describe, expect, it } from 'vitest'
import { SEED_QUIZ } from '../../src/domain/seed'

describe('seed', () => {
  it('correct answers are not all in the same position', () => {
    const positions = SEED_QUIZ.questions.map((question) => question.correctIndex)
    expect(new Set(positions).size).toBeGreaterThan(1)
    expect(positions).toEqual([1, 3, 0, 2, 1])
  })
})
