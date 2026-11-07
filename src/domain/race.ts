import type { AnswerRecord, AiGhost, OpponentKind, Quiz, RaceResult } from './schemas.js'
import { MAX_POINTS_PER_QUESTION } from './constants.js'
import { computePoints } from './scoring.js'

export type RaceOpponent = {
  kind: OpponentKind
  model?: string
  answers: AnswerRecord[]
}

export type RaceScore = {
  totalScore: number
  totalTimeMs: number
}

const BOT_CONFIG: Record<Exclude<OpponentKind, 'ai'>, { p: number; min: number; max: number }> = {
  cheetah: { p: 0.85, min: 3000, max: 8000 },
  rabbit: { p: 0.7, min: 6000, max: 15000 },
  turtle: { p: 0.5, min: 12000, max: 24000 },
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedFromString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** R-101: có bóng ma → Trùm 25%, Báo 20%, Thỏ 35%, Rùa 20; không có → 20:35:20. */
export function pickOpponent(rng: () => number, hasValidGhost: boolean): OpponentKind {
  const draw = rng()
  if (hasValidGhost) {
    if (draw < 0.25) return 'ai'
    if (draw < 0.45) return 'cheetah'
    if (draw < 0.8) return 'rabbit'
    return 'turtle'
  }
  if (draw < 20 / 75) return 'cheetah'
  if (draw < 55 / 75) return 'rabbit'
  return 'turtle'
}

export function simulateBot(kind: OpponentKind, quiz: Quiz, rng: () => number): AnswerRecord[] {
  const botKind = kind === 'ai' ? 'rabbit' : kind
  const config = BOT_CONFIG[botKind]
  return quiz.questions.map((question) => {
    const isCorrect = rng() < config.p
    let selectedIndex: 0 | 1 | 2 | 3
    if (isCorrect) {
      selectedIndex = question.correctIndex
    } else {
      const wrong = [0, 1, 2, 3].filter((index) => index !== question.correctIndex) as Array<0 | 1 | 2 | 3>
      selectedIndex = wrong[Math.floor(rng() * wrong.length)] ?? 0
    }
    const elapsedMs = config.min + Math.floor(rng() * (config.max - config.min + 1))
    return {
      questionId: question.id,
      selectedIndex,
      elapsedMs,
      isCorrect,
      points: computePoints(isCorrect, elapsedMs),
    }
  })
}

export function ghostToAnswers(quiz: Quiz, ghost: AiGhost): AnswerRecord[] {
  return quiz.questions.map((question, index) => {
    const ghostAnswer = ghost.answers[index]!
    const isCorrect = ghostAnswer.selectedIndex !== null && ghostAnswer.selectedIndex === question.correctIndex
    const readableChars = question.text.length + question.options.reduce((sum, option) => sum + option.length, 0)
    const readingMs = ghostAnswer.readingMs ?? readableChars * 60
    const modelLatencyMs = ghostAnswer.modelLatencyMs ?? 1500
    const elapsedMs = Math.max(1500, Math.min(30000, Math.round(modelLatencyMs + readingMs)))
    return {
      questionId: question.id,
      selectedIndex: ghostAnswer.selectedIndex,
      elapsedMs,
      isCorrect,
      points: computePoints(isCorrect, elapsedMs),
    }
  })
}

export function opponentTotals(answers: AnswerRecord[]): RaceScore {
  return {
    totalScore: answers.reduce((sum, answer) => sum + (answer.isCorrect ? answer.points : 0), 0),
    totalTimeMs: answers.reduce((sum, answer) => sum + answer.elapsedMs, 0),
  }
}

/** R-104: vị trí = điểm tích luỹ / 5000 (tối đa 5 câu × 1000). */
export function racePosition(cumulativeScore: number): number {
  return Math.max(0, Math.min(1, cumulativeScore / (MAX_POINTS_PER_QUESTION * 5)))
}

/** R-41/R-105: điểm trước, sau đó tổng thời gian ít hơn thắng. */
export function raceResult(player: RaceScore, opponent: RaceScore): RaceResult {
  if (player.totalScore !== opponent.totalScore) {
    return player.totalScore > opponent.totalScore ? 'win' : 'lose'
  }
  if (player.totalTimeMs !== opponent.totalTimeMs) {
    return player.totalTimeMs < opponent.totalTimeMs ? 'win' : 'lose'
  }
  return 'draw'
}

export function opponentAnsweredAt(answer: AnswerRecord | undefined, elapsedSinceStart: number): boolean {
  return !!answer && elapsedSinceStart >= answer.elapsedMs
}
