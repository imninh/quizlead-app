import { describe, it, expect } from 'vitest'
import { rankLeads, topLeads, findRank, upsertLeadByPhone } from '../../src/domain/leaderboard'
import type { Lead } from '../../src/domain/schemas'

function makeLead(overrides: Partial<Lead>): Lead {
  return {
    id: 'id',
    quizId: 'q1',
    attemptId: 'a',
    name: 'Name',
    phone: '0900000000',
    consent: true,
    totalScore: 100,
    correctCount: 1,
    totalTimeMs: 1000,
    createdAt: 1,
    ...overrides,
  }
}

describe('leaderboard', () => {
  it('sorts by score desc, time asc, createdAt asc', () => {
    const leads = [
      makeLead({ id: 'a', totalScore: 100, totalTimeMs: 2000, createdAt: 1 }),
      makeLead({ id: 'b', totalScore: 200, totalTimeMs: 1000, createdAt: 2 }),
      makeLead({ id: 'c', totalScore: 100, totalTimeMs: 1000, createdAt: 3 }),
    ]
    const r = rankLeads(leads, 'q1').map((l) => l.id)
    expect(r).toEqual(['b', 'c', 'a'])
  })
  it('filters by quiz', () => {
    const leads = [makeLead({ id: 'a', quizId: 'q1' }), makeLead({ id: 'b', quizId: 'q2' })]
    expect(rankLeads(leads, 'q1').map((l) => l.id)).toEqual(['a'])
  })
  it('top 10 of 15', () => {
    const leads = Array.from({ length: 15 }, (_, i) => makeLead({ id: 'l' + i, totalScore: i, createdAt: i }))
    expect(topLeads(leads, 'q1', 10).length).toBe(10)
  })
  it('findRank 12', () => {
    const leads = Array.from({ length: 15 }, (_, i) => makeLead({ id: 'l' + i, totalScore: i, createdAt: i }))
    expect(findRank(leads, 'q1', 'l3')).toBe(12)
  })
  it('upsert created', () => {
    const res = upsertLeadByPhone([], makeLead({ id: 'n', phone: '0911111111' }))
    expect(res.outcome).toBe('created')
    expect(res.leads.length).toBe(1)
  })
  it('upsert improved', () => {
    const existing = makeLead({ id: 'e', phone: '0911111111', totalScore: 100 })
    const res = upsertLeadByPhone([existing], makeLead({ id: 'n', phone: '0911111111', totalScore: 200 }))
    expect(res.outcome).toBe('improved')
  })
  it('upsert kept_existing', () => {
    const existing = makeLead({ id: 'e', phone: '0911111111', totalScore: 200 })
    const res = upsertLeadByPhone([existing], makeLead({ id: 'n', phone: '0911111111', totalScore: 100 }))
    expect(res.outcome).toBe('kept_existing')
  })
  it('upsert equal kept_existing', () => {
    const existing = makeLead({ id: 'e', phone: '0911111111', totalScore: 200 })
    const res = upsertLeadByPhone([existing], makeLead({ id: 'n', phone: '0911111111', totalScore: 200 }))
    expect(res.outcome).toBe('kept_existing')
  })
  it('same phone different quiz created', () => {
    const existing = makeLead({ id: 'e', quizId: 'q1', phone: '0911111111' })
    const res = upsertLeadByPhone([existing], makeLead({ id: 'n', quizId: 'q2', phone: '0911111111' }))
    expect(res.outcome).toBe('created')
  })
})
