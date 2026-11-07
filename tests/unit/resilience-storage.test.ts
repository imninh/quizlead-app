// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createStorageRepo } from '../../src/services/storage'
import { SEED_QUIZ } from '../../src/domain/seed'
import type { Lead } from '../../src/domain/schemas'

class FakeStorage {
  private data = new Map<string, string>()
  failOnKey: string | null = null
  get length() { return this.data.size }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null }
  setItem(k: string, v: string) {
    if (this.failOnKey === k) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' })
    this.data.set(k, v)
  }
  removeItem(k: string) { this.data.delete(k) }
  clear() { this.data.clear() }
  keys() { return [...this.data.keys()] }
}

function validLead(): Lead {
  return {
    id: 'lead-1',
    quizId: SEED_QUIZ.id,
    attemptId: 'attempt-1',
    name: 'Nguyễn Văn A',
    phone: '0912345678',
    consent: true,
    totalScore: 1000,
    correctCount: 3,
    totalTimeMs: 12000,
    createdAt: 500,
  }
}

describe('storage resilience', () => {
  let storage: FakeStorage
  beforeEach(() => { storage = new FakeStorage() })

  it('corrupt leads are backed up and reported as a recovery notice', () => {
    storage.setItem('quizlead:v1:leads', 'abc')
    const repo = createStorageRepo(storage, () => 1000)
    const r = repo.getLeads()

    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toEqual([])
    expect(storage.keys().some((key) => key.startsWith('quizlead:v1:backup:leads:'))).toBe(true)
    expect(repo.getRecoveryNotices().some((notice) => notice.key === 'quizlead:v1:leads')).toBe(true)
    expect(repo.getRecoveryNotices()[0]!.label).toBe('Danh sách khách hàng')
  })

  it('corrupt settings are backed up and reported as a recovery notice', () => {
    storage.setItem('quizlead:v1:settings', '{bad')
    const repo = createStorageRepo(storage, () => 2000)
    const r = repo.getSettings()

    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.fanpageName).toBe('FPT Polytechnic')
    expect(storage.keys().some((key) => key.startsWith('quizlead:v1:backup:settings:'))).toBe(true)
    expect(repo.getRecoveryNotices().some((notice) => notice.key === 'quizlead:v1:settings')).toBe(true)
  })

  it('recovery notices list every corrupted key once', () => {
    storage.setItem('quizlead:v1:leads', 'abc')
    storage.setItem('quizlead:v1:settings', 'def')
    const repo = createStorageRepo(storage, () => 3000)

    repo.getLeads()
    repo.getLeads()
    repo.getSettings()
    repo.getSettings()

    const notices = repo.getRecoveryNotices()
    expect(notices).toHaveLength(2)
    expect(new Set(notices.map((notice) => notice.key)).size).toBe(2)
    expect(notices.map((notice) => notice.key).sort()).toEqual([
      'quizlead:v1:leads',
      'quizlead:v1:settings',
    ])
  })

  it('listBackups returns key, time and size for each backup', () => {
    storage.setItem('quizlead:v1:leads', 'not-json')
    const repo = createStorageRepo(storage, () => 5000)
    repo.getLeads()

    const backups = repo.listBackups()
    expect(backups).toHaveLength(1)
    expect(backups[0]!.key).toContain('backup:leads:')
    expect(backups[0]!.at).toBe(5000)
    expect(backups[0]!.bytes).toBe('not-json'.length * 2)
    expect(backups[0]!.label).toBe('Danh sách khách hàng')
  })

  it('deleteBackup removes only that backup', () => {
    let clock = 1000
    const repo = createStorageRepo(storage, () => clock)
    storage.setItem('quizlead:v1:leads', 'bad-leads')
    repo.getLeads()
    clock = 2000
    storage.setItem('quizlead:v1:settings', 'bad-settings')
    repo.getSettings()

    const before = repo.listBackups()
    expect(before).toHaveLength(2)
    const target = before.find((backup) => backup.name === 'leads')!
    const keep = before.find((backup) => backup.name === 'settings')!

    const result = repo.deleteBackup(target.key)
    expect(result.ok).toBe(true)
    const after = repo.listBackups()
    expect(after).toHaveLength(1)
    expect(after[0]!.key).toBe(keep.key)
    expect(repo.deleteBackup('quizlead:v1:leads').ok).toBe(false)
  })

  it('storage usage counts only quizlead keys', () => {
    storage.setItem('other:key', 'x'.repeat(100))
    storage.setItem('quizlead:v1:leads', '12345')
    storage.setItem('quizlead:v1:settings', 'abc')
    const repo = createStorageRepo(storage, () => 1000)

    const usage = repo.getStorageUsage()
    expect(usage.keys).toBe(2)
    expect(usage.bytes).toBe((5 + 3) * 2)
  })

  it('restoreSeedQuiz adds a sample quiz without touching leads', () => {
    const repo = createStorageRepo(storage, () => 1000)
    storage.setItem('quizlead:v1:leads', JSON.stringify([validLead()]))

    const result = repo.restoreSeedQuiz()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.id).not.toBe(SEED_QUIZ.id)
      expect(result.data.questions).toHaveLength(5)
    }
    const quizzes = repo.getQuizzes()
    expect(quizzes.ok && quizzes.data).toHaveLength(1)
    const leads = repo.getLeads()
    expect(leads.ok && leads.data).toHaveLength(1)
    expect(leads.ok && leads.data[0]!.name).toBe('Nguyễn Văn A')
  })

  it('restoreSeedQuiz sets it active when no active quiz exists', () => {
    const repo = createStorageRepo(storage, () => 1000)

    const result = repo.restoreSeedQuiz()
    expect(result.ok).toBe(true)
    const active = repo.getActiveQuizId()
    expect(active.ok && active.data).toBe(result.ok ? result.data.id : null)
  })

  it('saveLead on quota exceeded returns QUOTA_EXCEEDED and keeps existing leads', () => {
    storage.setItem('quizlead:v1:leads', JSON.stringify([validLead()]))
    storage.failOnKey = 'quizlead:v1:leads'
    const repo = createStorageRepo(storage, () => 1000)

    const result = repo.saveLead({ ...validLead(), id: 'lead-2', phone: '0987654321' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('QUOTA_EXCEEDED')
    expect(JSON.parse(storage.getItem('quizlead:v1:leads')!)).toHaveLength(1)
  })
})
