import { QUESTION_TIME_MS, MAX_POINTS_PER_QUESTION } from './constants.ts'

export function computePoints(isCorrect: boolean, elapsedMs: number): number {
  if (!isCorrect) return 0
  const clamped = Math.max(0, Math.min(QUESTION_TIME_MS, elapsedMs))
  const raw = MAX_POINTS_PER_QUESTION * (1 - clamped / (2 * QUESTION_TIME_MS))
  return Math.round(raw)
}

export function summarizeAttempt(answers: { isCorrect: boolean; points: number; elapsedMs: number }[]): {
  totalScore: number
  correctCount: number
  totalTimeMs: number
} {
  let totalScore = 0
  let correctCount = 0
  let totalTimeMs = 0
  for (const a of answers) {
    totalScore += a.points
    if (a.isCorrect) correctCount += 1
    totalTimeMs += a.elapsedMs
  }
  return { totalScore, correctCount, totalTimeMs }
}
