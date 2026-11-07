import { QUESTION_TIME_MS, REVEAL_MS, FEEDBACK_MS, QUESTIONS_PER_QUIZ } from './constants.js'
import { computePoints } from './scoring.js'
import type { Quiz, AnswerRecord } from './schemas.js'
import type { RaceOpponent } from './race.js'

export type GameStatus = 'idle' | 'question' | 'feedback' | 'finished'

export type GameState = {
  status: GameStatus
  quiz: Quiz | null
  questionIndex: number
  deadline: number | null
  revealUntil: number | null
  feedbackUntil: number | null
  answers: AnswerRecord[]
  attemptId: string | null
  opponent: RaceOpponent | null
}

export type GameAction =
  | { type: 'START'; quiz: Quiz; now: number; attemptId?: string; opponent?: RaceOpponent | null }
  | { type: 'ANSWER'; index: number; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'NEXT'; now: number }
  | { type: 'RESET' }

export function createInitialState(): GameState {
  return {
    status: 'idle',
    quiz: null,
    questionIndex: 0,
    deadline: null,
    revealUntil: null,
    feedbackUntil: null,
    answers: [],
    attemptId: null,
    opponent: null,
  }
}

function makeAnswer(quiz: Quiz, qi: number, selectedIndex: 0 | 1 | 2 | 3 | null, elapsedMs: number): AnswerRecord {
  const q = quiz.questions[qi]!
  const isCorrect = selectedIndex !== null && selectedIndex === q.correctIndex
  const points = computePoints(isCorrect, elapsedMs)
  return {
    questionId: q.id,
    selectedIndex,
    elapsedMs,
    isCorrect,
    points,
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'RESET':
      return createInitialState()
    case 'START': {
      const revealUntil = action.now + REVEAL_MS
      return {
        status: 'question',
        quiz: action.quiz,
        questionIndex: 0,
        deadline: revealUntil + QUESTION_TIME_MS,
        revealUntil,
        feedbackUntil: null,
        answers: [],
        attemptId: action.attemptId ?? null,
        opponent: action.opponent ?? null,
      }
    }
    case 'ANSWER': {
      if (state.status !== 'question' || !state.quiz) return state
      if (state.revealUntil !== null && action.now < state.revealUntil) return state
      const qi = state.questionIndex
      if (state.answers.length > qi) return state
      const deadline = state.deadline ?? action.now
      if (action.now >= deadline) {
        const answer = makeAnswer(state.quiz, qi, null, QUESTION_TIME_MS)
        return {
          ...state,
          status: 'feedback',
          answers: [...state.answers, answer],
          feedbackUntil: action.now + FEEDBACK_MS,
        }
      }
      const startAt = deadline - QUESTION_TIME_MS
      const elapsed = Math.max(0, Math.min(QUESTION_TIME_MS, action.now - startAt))
      const idx = action.index as 0 | 1 | 2 | 3
      if (idx < 0 || idx > 3) return state
      const answer = makeAnswer(state.quiz, qi, idx, elapsed)
      return {
        ...state,
        status: 'feedback',
        answers: [...state.answers, answer],
        feedbackUntil: action.now + FEEDBACK_MS,
      }
    }
    case 'NEXT': {
      if (state.status !== 'feedback' || !state.quiz) return state
      const qi = state.questionIndex
      if (qi >= QUESTIONS_PER_QUIZ - 1) {
        return { ...state, status: 'finished', feedbackUntil: null, deadline: null }
      }
      return {
        ...state,
        status: 'question',
        questionIndex: qi + 1,
        deadline: action.now + REVEAL_MS + QUESTION_TIME_MS,
        revealUntil: action.now + REVEAL_MS,
        feedbackUntil: null,
      }
    }
    case 'TICK': {
      if (!state.quiz) return state
      if (state.status === 'question') {
        const deadline = state.deadline ?? action.now
        if (action.now < deadline) return state
        // hết giờ
        const qi = state.questionIndex
        if (state.answers.length <= qi) {
          const answer = makeAnswer(state.quiz, qi, null, QUESTION_TIME_MS)
          return {
            ...state,
            status: 'feedback',
            answers: [...state.answers, answer],
            feedbackUntil: action.now + FEEDBACK_MS,
          }
        }
        return state
      }
      if (state.status === 'feedback') {
        const fu = state.feedbackUntil ?? action.now
        if (action.now < fu) return state
        // auto next
        const qi = state.questionIndex
        if (qi >= QUESTIONS_PER_QUIZ - 1) {
          return { ...state, status: 'finished', feedbackUntil: null, deadline: null }
        }
        return {
          ...state,
          status: 'question',
          questionIndex: qi + 1,
          deadline: action.now + REVEAL_MS + QUESTION_TIME_MS,
          revealUntil: action.now + REVEAL_MS,
          feedbackUntil: null,
        }
      }
      return state
    }
    default:
      return state
  }
}

export function remainingMs(state: GameState, now: number): number {
  if (state.status === 'question' && state.deadline !== null) {
    return Math.max(0, state.deadline - now)
  }
  if (state.status === 'feedback' && state.feedbackUntil !== null) {
    return Math.max(0, state.feedbackUntil - now)
  }
  return 0
}
