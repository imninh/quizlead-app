import { describe, expect, it } from 'vitest'
import { canPlayOnline } from '../../src/domain/publish'
import { SEED_QUIZ } from '../../src/domain/seed'

describe('canPlayOnline', () => {
  const custom = { ...SEED_QUIZ, id: 'quiz-mon-an', updatedAt: 1000 }

  it('is true for a published quiz not edited since publishing', () => {
    expect(canPlayOnline({ ...custom, publishedVersion: 1, publishedAt: 2000 })).toBe(true)
  })

  it('is false when the quiz was edited after publishing', () => {
    expect(canPlayOnline({ ...custom, updatedAt: 3000, publishedVersion: 1, publishedAt: 2000 })).toBe(false)
  })

  it('is false for an unpublished custom quiz', () => {
    expect(canPlayOnline(custom)).toBe(false)
  })

  it('is true for the untouched seed quiz and false once it is edited', () => {
    expect(canPlayOnline(SEED_QUIZ)).toBe(true)
    expect(canPlayOnline({ ...SEED_QUIZ, updatedAt: 5 })).toBe(false)
  })
})
