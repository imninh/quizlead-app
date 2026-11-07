import { describe, it, expect } from 'vitest'
import { computePoints, summarizeAttempt } from '../../src/domain/scoring'

describe('scoring', () => {
  it('0ms = 1000', () => expect(computePoints(true, 0)).toBe(1000))
  it('15000ms = 750', () => expect(computePoints(true, 15000)).toBe(750))
  it('29999ms ≈ 500', () => expect(computePoints(true, 29999)).toBe(500))
  it('wrong = 0', () => expect(computePoints(false, 0)).toBe(0))
  it('negative clamped', () => expect(computePoints(true, -5)).toBe(1000))
  it('over 30000 clamped', () => expect(computePoints(true, 40000)).toBe(500))
  it('summarizeAttempt', () => {
    const r = summarizeAttempt([
      { isCorrect: true, points: 1000, elapsedMs: 0 },
      { isCorrect: false, points: 0, elapsedMs: 5000 },
    ])
    expect(r.totalScore).toBe(1000)
    expect(r.correctCount).toBe(1)
    expect(r.totalTimeMs).toBe(5000)
  })
})
