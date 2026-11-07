import { describe, expect, it } from 'vitest'
import {
  ghostToAnswers,
  mulberry32,
  opponentAnsweredAt,
  opponentTotals,
  pickOpponent,
  racePosition,
  raceResult,
  seedFromString,
  simulateBot,
} from '../../src/domain/race'
import { computePoints } from '../../src/domain/scoring'
import { AttemptSchema, type AiGhost, type Attempt } from '../../src/domain/schemas'
import { SEED_QUIZ } from '../../src/domain/seed'

describe('race', () => {
  it('same seed gives the same opponent and answers', () => {
    const first = mulberry32(seedFromString('attempt-abc'))
    const second = mulberry32(seedFromString('attempt-abc'))
    const firstKind = pickOpponent(first, true)
    const secondKind = pickOpponent(second, true)
    expect(firstKind).toBe(secondKind)
    expect(simulateBot(firstKind, SEED_QUIZ, first)).toEqual(simulateBot(secondKind, SEED_QUIZ, second))
  })

  it('opponent distribution follows R-101 over 10000 draws', () => {
    const rng = mulberry32(12345)
    const counts: Record<string, number> = { ai: 0, cheetah: 0, rabbit: 0, turtle: 0 }
    for (let index = 0; index < 10000; index++) counts[pickOpponent(rng, true)]! += 1
    expect(counts.ai! / 10000).toBeGreaterThan(0.22)
    expect(counts.ai! / 10000).toBeLessThan(0.28)
    expect(counts.cheetah! / 10000).toBeGreaterThan(0.17)
    expect(counts.cheetah! / 10000).toBeLessThan(0.23)
    expect(counts.rabbit! / 10000).toBeGreaterThan(0.32)
    expect(counts.rabbit! / 10000).toBeLessThan(0.38)
    expect(counts.turtle! / 10000).toBeGreaterThan(0.17)
    expect(counts.turtle! / 10000).toBeLessThan(0.23)
  })

  it('pick opponent gives boss 25 percent when ghost exists', () => {
    const kind = (draw: number) => pickOpponent(() => draw, true)
    expect(kind(0.249)).toBe('ai')
    expect(kind(0.25)).toBe('cheetah')
    expect(kind(0.449)).toBe('cheetah')
    expect(kind(0.45)).toBe('rabbit')
    expect(kind(0.799)).toBe('rabbit')
    expect(kind(0.8)).toBe('turtle')
  })

  it('pick opponent splits bots 20 35 20 without ghost', () => {
    const kind = (draw: number) => pickOpponent(() => draw, false)
    expect(kind(0.266)).toBe('cheetah')
    expect(kind(0.267)).toBe('rabbit')
    expect(kind(0.733)).toBe('rabbit')
    expect(kind(0.734)).toBe('turtle')
  })

  it('without ghost the AI opponent is never picked', () => {
    const rng = mulberry32(99)
    for (let index = 0; index < 10000; index++) {
      expect(pickOpponent(rng, false)).not.toBe('ai')
    }
  })

  it('bot answers respect accuracy and time ranges', () => {
    const config = {
      cheetah: { p: 0.85, min: 3000, max: 8000 },
      rabbit: { p: 0.7, min: 6000, max: 15000 },
      turtle: { p: 0.5, min: 12000, max: 24000 },
    } as const
    for (const kind of ['cheetah', 'rabbit', 'turtle'] as const) {
      const rng = mulberry32(seedFromString(kind))
      let correct = 0
      let total = 0
      for (let round = 0; round < 400; round++) {
        const answers = simulateBot(kind, SEED_QUIZ, rng)
        for (const answer of answers) {
          total += 1
          if (answer.isCorrect) correct += 1
          expect(answer.elapsedMs).toBeGreaterThanOrEqual(config[kind].min)
          expect(answer.elapsedMs).toBeLessThanOrEqual(config[kind].max)
        }
      }
      const ratio = correct / total
      expect(ratio).toBeGreaterThan(config[kind].p - 0.08)
      expect(ratio).toBeLessThan(config[kind].p + 0.08)
    }
  })

  it('bot points use the R-31 formula', () => {
    const rng = mulberry32(seedFromString('points'))
    for (const answer of simulateBot('rabbit', SEED_QUIZ, rng)) {
      expect(answer.points).toBe(computePoints(answer.isCorrect, answer.elapsedMs))
    }
  })

  it('ghost answers are marked correct against correctIndex', () => {
    const ghost: AiGhost = {
      model: 'ghost/model',
      ranAt: 1,
      answers: SEED_QUIZ.questions.map((question) => ({
        selectedIndex: question.correctIndex,
        elapsedMs: 2000,
      })),
    }
    const answers = ghostToAnswers(SEED_QUIZ, ghost)
    expect(answers.every((answer) => answer.isCorrect)).toBe(true)
    expect(answers.every((answer) => answer.points === computePoints(true, answer.elapsedMs))).toBe(true)
  })

  it('null ghost answer counts as timeout with 0 points', () => {
    const ghost: AiGhost = {
      model: 'ghost/model',
      ranAt: 1,
      answers: SEED_QUIZ.questions.map(() => ({ selectedIndex: null, elapsedMs: 30000 })),
    }
    const answers = ghostToAnswers(SEED_QUIZ, ghost)
    expect(answers.every((answer) => answer.selectedIndex === null)).toBe(true)
    expect(answers.every((answer) => answer.isCorrect === false && answer.points === 0)).toBe(true)
  })

  it('race position is cumulative score over 5000', () => {
    expect(racePosition(0)).toBe(0)
    expect(racePosition(2500)).toBe(0.5)
    expect(racePosition(5000)).toBe(1)
    expect(racePosition(6000)).toBe(1)
  })

  it('race result compares score then total time', () => {
    expect(raceResult({ totalScore: 4000, totalTimeMs: 10000 }, { totalScore: 3000, totalTimeMs: 1000 })).toBe('win')
    expect(raceResult({ totalScore: 3000, totalTimeMs: 10000 }, { totalScore: 4000, totalTimeMs: 1000 })).toBe('lose')
    expect(raceResult({ totalScore: 4000, totalTimeMs: 5000 }, { totalScore: 4000, totalTimeMs: 9000 })).toBe('win')
    expect(raceResult({ totalScore: 4000, totalTimeMs: 9000 }, { totalScore: 4000, totalTimeMs: 5000 })).toBe('lose')
    expect(raceResult({ totalScore: 4000, totalTimeMs: 5000 }, { totalScore: 4000, totalTimeMs: 5000 })).toBe('draw')
  })

  it('old attempt without opponent still parses', () => {
    const attempt: Attempt = {
      id: 'a1',
      quizId: SEED_QUIZ.id,
      answers: SEED_QUIZ.questions.map((question) => ({
        questionId: question.id,
        selectedIndex: 0,
        elapsedMs: 1000,
        isCorrect: true,
        points: 1000,
      })),
      totalScore: 5000,
      correctCount: 5,
      totalTimeMs: 5000,
      finishedAt: 1,
    }
    expect(AttemptSchema.safeParse(attempt).success).toBe(true)
  })

  it('ghost elapsed adds human reading time to model latency', () => {
    const ghost: AiGhost = {
      model: 'ghost/model',
      ranAt: 1,
      answers: SEED_QUIZ.questions.map((question) => ({
        selectedIndex: question.correctIndex,
        elapsedMs: 1500,
        modelLatencyMs: 1000,
        readingMs: 5000,
      })),
    }
    const answers = ghostToAnswers(SEED_QUIZ, ghost)
    expect(answers.every((answer) => answer.elapsedMs === 6000)).toBe(true)
    expect(answers[0]!.points).toBe(computePoints(true, 6000))
  })

  it('old ghost without new latency fields is recalculated from reading time', () => {
    const ghost: AiGhost = {
      model: 'ghost/model',
      ranAt: 1,
      answers: SEED_QUIZ.questions.map(() => ({ selectedIndex: 0, elapsedMs: 1500 })),
    }
    const answers = ghostToAnswers(SEED_QUIZ, ghost)
    const readability = SEED_QUIZ.questions[0]!.text.length + SEED_QUIZ.questions[0]!.options.reduce((sum, option) => sum + option.length, 0)
    expect(answers[0]!.elapsedMs).toBe(Math.max(1500, Math.min(30000, readability * 60 + 1500)))
  })

  it('opponent answered label only after elapsed time', () => {
    const answer = {
      questionId: 'q1',
      selectedIndex: 0 as const,
      elapsedMs: 5000,
      isCorrect: true,
      points: 1000,
    }
    expect(opponentAnsweredAt(answer, 4999)).toBe(false)
    expect(opponentAnsweredAt(answer, 5000)).toBe(true)
  })

  it('opponent totals sum only answered questions', () => {
    const rng = mulberry32(seedFromString('totals'))
    const answers = simulateBot('rabbit', SEED_QUIZ, rng)
    const totals = opponentTotals(answers.slice(0, 2))
    expect(totals.totalScore).toBe(answers[0]!.points + answers[1]!.points)
    expect(totals.totalTimeMs).toBe(answers[0]!.elapsedMs + answers[1]!.elapsedMs)
  })
})
