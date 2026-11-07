// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { createStorageRepo } from '../../src/services/storage'
import { SEED_QUIZ } from '../../src/domain/seed'
import type { Attempt } from '../../src/domain/schemas'

class FakeStorage {
  private data = new Map<string, string>()
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null }
  setItem(k: string, v: string) { this.data.set(k, v) }
  removeItem(k: string) { this.data.delete(k) }
  clear() { this.data.clear() }
  keys() { return [...this.data.keys()] }
}

function makeAttempt(index: number): Attempt {
  return {
    id: `attempt-${index}`,
    quizId: 'quiz',
    answers: Array.from({ length: 5 }, (_, i) => ({
      questionId: `q${i}`,
      selectedIndex: 0 as const,
      elapsedMs: 1000,
      isCorrect: true,
      points: 1000,
    })),
    totalScore: 5000,
    correctCount: 5,
    totalTimeMs: 5000,
    finishedAt: index,
  }
}

describe('storage', () => {
  let storage: FakeStorage
  beforeEach(() => { storage = new FakeStorage() })

  it('ensureSeed creates once', () => {
    const repo = createStorageRepo(storage, () => 1000)
    repo.ensureSeed()
    const r1 = repo.getQuizzes()
    expect(r1.ok).toBe(true)
    if (r1.ok) expect(r1.data.length).toBe(1)
    repo.ensureSeed()
    const r2 = repo.getQuizzes()
    if (r2.ok) expect(r2.data.length).toBe(1)
  })

  it('save and read quiz', () => {
    const repo = createStorageRepo(storage, () => 1000)
    const quiz = { ...SEED_QUIZ, id: 'q2', createdAt: 1, updatedAt: 1 }
    const save = repo.saveQuiz(quiz)
    expect(save.ok).toBe(true)
    const r = repo.getQuiz('q2')
    expect(r.ok).toBe(true)
  })

  it('corrupt json recovers with backup and warning', () => {
    storage.setItem('quizlead:v1:quizzes', '{bad json')
    const repo = createStorageRepo(storage, () => 2000)
    const r = repo.getQuizzes()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data).toEqual([])
      expect(r.warning).toBe('RECOVERED_CORRUPT')
    }
    expect(storage.keys().some((k) => k.includes('backup:quizzes'))).toBe(true)
  })

  it('corrupt data backed up only once after 3 reads', () => {
    storage.setItem('quizlead:v1:quizzes', '{bad json')
    const repo = createStorageRepo(storage, () => 3000)
    repo.getQuizzes()
    repo.getQuizzes()
    repo.getQuizzes()
    const backups = storage.keys().filter((k) => k.includes('backup:quizzes'))
    expect(backups).toHaveLength(1)
  })

  it('does not reseed after all quizzes deleted', () => {
    const repo = createStorageRepo(storage, () => 1000)
    repo.ensureSeed()
    const before = repo.getQuizzes()
    expect(before.ok).toBe(true)
    if (before.ok) {
      for (const quiz of before.data) repo.deleteQuiz(quiz.id)
    }
    repo.ensureSeed()
    const after = repo.getQuizzes()
    expect(after.ok).toBe(true)
    if (after.ok) expect(after.data).toHaveLength(0)
  })

  it('keeps only latest 200 attempts', () => {
    const repo = createStorageRepo(storage, () => 1000)
    for (let i = 0; i < 205; i++) repo.saveAttempt(makeAttempt(i))
    const r = repo.getAttempts()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data).toHaveLength(200)
      expect(r.data[0]!.id).toBe('attempt-5')
      expect(r.data[199]!.id).toBe('attempt-204')
    }
  })

  it('quota exceeded returns code', () => {
    const qstorage = {
      getItem: () => null,
      setItem: () => { throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }) },
      removeItem: () => {},
    }
    const repo = createStorageRepo(qstorage, () => 1)
    const quiz = { ...SEED_QUIZ, id: 'q3', createdAt: 1, updatedAt: 1 }
    const r = repo.saveQuiz(quiz)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('QUOTA_EXCEEDED')
  })

  it('delete active quiz moves active', () => {
    const repo = createStorageRepo(storage, () => 1000)
    const q1 = { ...SEED_QUIZ, id: 'q1', createdAt: 1, updatedAt: 1 }
    const q2 = { ...SEED_QUIZ, id: 'q2', createdAt: 2, updatedAt: 2 }
    repo.saveQuiz(q1)
    repo.saveQuiz(q2)
    repo.setActiveQuizId('q1')
    repo.deleteQuiz('q1')
    const ar = repo.getActiveQuizId()
    expect(ar.ok).toBe(true)
    if (ar.ok) expect(ar.data).toBe('q2')
  })

  it('storage throws SecurityError -> repo runs, persistent false', () => {
    const original = window.localStorage
    Object.defineProperty(window, 'localStorage', {
      get() { throw Object.assign(new Error('sec'), { name: 'SecurityError' }) },
      configurable: true,
    })
    const repo = createStorageRepo(undefined, () => 1)
    expect(repo.persistent).toBe(false)
    const r = repo.getQuizzes()
    expect(r.ok).toBe(true)
    Object.defineProperty(window, 'localStorage', { value: original, configurable: true })
  })
})
