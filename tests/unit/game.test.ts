import { describe, it, expect } from 'vitest'
import { gameReducer, createInitialState, remainingMs } from '../../src/domain/game'
import { GameStateSchema } from '../../src/domain/schemas'
import { SEED_QUIZ } from '../../src/domain/seed'

describe('game reducer', () => {
  it('START -> question 1', () => {
    const s = gameReducer(createInitialState(), { type: 'START', quiz: SEED_QUIZ, now: 1000 })
    expect(s.status).toBe('question')
    expect(s.questionIndex).toBe(0)
    expect(s.deadline).toBe(1000 + 700 + 30000)
  })
  it('ANSWER correct -> feedback + points', () => {
    let s = gameReducer(createInitialState(), { type: 'START', quiz: SEED_QUIZ, now: 1000 })
    s = gameReducer(s, { type: 'ANSWER', index: SEED_QUIZ.questions[0]!.correctIndex, now: 1700 })
    expect(s.status).toBe('feedback')
    expect(s.answers.length).toBe(1)
    expect(s.answers[0]!.isCorrect).toBe(true)
    expect(s.answers[0]!.points).toBe(1000)
  })
  it('second ANSWER ignored', () => {
    let s = gameReducer(createInitialState(), { type: 'START', quiz: SEED_QUIZ, now: 1000 })
    s = gameReducer(s, { type: 'ANSWER', index: 0, now: 1700 })
    const before = s.answers.length
    s = gameReducer(s, { type: 'ANSWER', index: 1, now: 1800 })
    expect(s.answers.length).toBe(before)
  })
  it('ANSWER after deadline counts as timeout', () => {
    let s = gameReducer(createInitialState(), { type: 'START', quiz: SEED_QUIZ, now: 1000 })
    s = gameReducer(s, { type: 'ANSWER', index: 0, now: 1000 + 700 + 30000 + 1 })
    expect(s.status).toBe('feedback')
    expect(s.answers[0]!.selectedIndex).toBeNull()
    expect(s.answers[0]!.points).toBe(0)
  })
  it('TICK past deadline -> timeout 0 points', () => {
    let s = gameReducer(createInitialState(), { type: 'START', quiz: SEED_QUIZ, now: 1000 })
    s = gameReducer(s, { type: 'TICK', now: 1000 + 700 + 30000 })
    expect(s.status).toBe('feedback')
    expect(s.answers[0]!.selectedIndex).toBeNull()
    expect(s.answers[0]!.points).toBe(0)
  })
  it('TICK past feedbackUntil -> next question', () => {
    let s = gameReducer(createInitialState(), { type: 'START', quiz: SEED_QUIZ, now: 1000 })
    s = gameReducer(s, { type: 'ANSWER', index: 0, now: 1700 })
    const fu = s.feedbackUntil!
    s = gameReducer(s, { type: 'TICK', now: fu + 1 })
    expect(s.status).toBe('question')
    expect(s.questionIndex).toBe(1)
    expect(s.deadline).toBe(fu + 1 + 700 + 30000)
  })
  it('NEXT during feedback -> next question, deadline now+reveal+30000', () => {
    let s = gameReducer(createInitialState(), { type: 'START', quiz: SEED_QUIZ, now: 1000 })
    s = gameReducer(s, { type: 'ANSWER', index: 0, now: 1700 })
    s = gameReducer(s, { type: 'NEXT', now: 2000 })
    expect(s.status).toBe('question')
    expect(s.questionIndex).toBe(1)
    expect(s.deadline).toBe(2000 + 700 + 30000)
  })
  it('NEXT during question ignored', () => {
    let s = gameReducer(createInitialState(), { type: 'START', quiz: SEED_QUIZ, now: 1000 })
    const before = s.questionIndex
    s = gameReducer(s, { type: 'NEXT', now: 1100 })
    expect(s.questionIndex).toBe(before)
    expect(s.status).toBe('question')
  })
  it('after 5 questions -> finished', () => {
    let s = gameReducer(createInitialState(), { type: 'START', quiz: SEED_QUIZ, now: 1000 })
    for (let i = 0; i < 5; i++) {
      s = gameReducer(s, { type: 'ANSWER', index: 0, now: 1700 + i * 1000 })
      s = gameReducer(s, { type: 'NEXT', now: 1710 + i * 1000 })
    }
    expect(s.status).toBe('finished')
  })
  it('ANSWER when finished ignored', () => {
    let s = gameReducer(createInitialState(), { type: 'START', quiz: SEED_QUIZ, now: 1000 })
    for (let i = 0; i < 5; i++) {
      s = gameReducer(s, { type: 'ANSWER', index: 0, now: 1700 + i * 1000 })
      s = gameReducer(s, { type: 'NEXT', now: 1710 + i * 1000 })
    }
    const before = s.answers.length
    s = gameReducer(s, { type: 'ANSWER', index: 0, now: 9999 })
    expect(s.answers.length).toBe(before)
  })
  it('remainingMs', () => {
    const s = gameReducer(createInitialState(), { type: 'START', quiz: SEED_QUIZ, now: 1000 })
    expect(remainingMs(s, 1000)).toBe(30700)
    expect(remainingMs(s, 2000)).toBe(29700)
  })
})

describe('reveal window', () => {
  it('start sets revealUntil and deadline after reveal', () => {
    const state = gameReducer(createInitialState(), { type: 'START', quiz: SEED_QUIZ, now: 1000 })
    expect(state.revealUntil).toBe(1700)
    expect(state.deadline).toBe(31700)
  })

  it('answer during reveal is ignored', () => {
    let state = gameReducer(createInitialState(), { type: 'START', quiz: SEED_QUIZ, now: 1000 })
    state = gameReducer(state, { type: 'ANSWER', index: 0, now: 1500 })
    expect(state.status).toBe('question')
    expect(state.answers).toHaveLength(0)
  })

  it('points are computed from the end of reveal', () => {
    let state = gameReducer(createInitialState(), { type: 'START', quiz: SEED_QUIZ, now: 1000 })
    state = gameReducer(state, { type: 'ANSWER', index: SEED_QUIZ.questions[0]!.correctIndex, now: 1700 })
    expect(state.status).toBe('feedback')
    expect(state.answers[0]!.points).toBe(1000)
  })

  it('next question also has a reveal window', () => {
    let state = gameReducer(createInitialState(), { type: 'START', quiz: SEED_QUIZ, now: 1000 })
    state = gameReducer(state, { type: 'ANSWER', index: 0, now: 1700 })
    state = gameReducer(state, { type: 'NEXT', now: 2000 })
    expect(state.questionIndex).toBe(1)
    expect(state.revealUntil).toBe(2700)
    expect(state.deadline).toBe(32700)
  })

  it('old session without revealUntil still resumes', () => {
    const parsed = GameStateSchema.safeParse({
      status: 'question',
      quiz: SEED_QUIZ,
      questionIndex: 2,
      deadline: 5000,
      feedbackUntil: null,
      answers: [],
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.revealUntil).toBeNull()
  })
})
