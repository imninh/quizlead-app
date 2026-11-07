import { describe, it, expect } from 'vitest'
import { leadsToCsv } from '../../src/domain/csv'
import type { Lead } from '../../src/domain/schemas'

describe('csv', () => {
  it('has BOM', () => {
    const csv = leadsToCsv([], new Map())
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })
  it('escapes comma and quote', () => {
    const lead: Lead = {
      id: '1', quizId: 'q', attemptId: 'a', name: 'Doe, "John"', phone: '0900000000',
      consent: true, totalScore: 1, correctCount: 1, totalTimeMs: 1, createdAt: 0,
    }
    const csv = leadsToCsv([lead], new Map([['q', { title: 'Quiz' }]]))
    expect(csv).toContain('"Doe, ""John"""')
  })
  it('prefixes cell starting with tab', () => {
    const lead: Lead = {
      id: '1', quizId: 'q', attemptId: 'a', name: '\t=SUM(A1:A2)', phone: '0900000000',
      consent: true, totalScore: 1, correctCount: 1, totalTimeMs: 1, createdAt: 0,
    }
    const csv = leadsToCsv([lead], new Map([['q', { title: 'Quiz' }]]))
    expect(csv).toContain("'\t=SUM(A1:A2)")
  })
  it('time column in seconds', () => {
    const lead: Lead = {
      id: '1', quizId: 'q', attemptId: 'a', name: 'Nguyen Van A', phone: '0900000000',
      consent: true, totalScore: 1, correctCount: 1, totalTimeMs: 31234, createdAt: 0,
    }
    const csv = leadsToCsv([lead], new Map([['q', { title: 'Quiz' }]]))
    const row = csv.replace('\uFEFF', '').split('\r\n')[1]!.split(',')
    expect(row[5]).toBe('31')
  })
  it('datetime in dd/MM/yyyy HH:mm Vietnam time', () => {
    const lead: Lead = {
      id: '1', quizId: 'q', attemptId: 'a', name: 'Nguyen Van A', phone: '0900000000',
      consent: true, totalScore: 1, correctCount: 1, totalTimeMs: 1,
      createdAt: Date.UTC(2026, 9, 25, 12, 8),
    }
    const csv = leadsToCsv([lead], new Map([['q', { title: 'Quiz' }]]))
    expect(csv).toContain('25/10/2026 19:08')
  })
  it('csv injection prefixed', () => {
    const lead: Lead = {
      id: '1', quizId: 'q', attemptId: 'a', name: '=HYPERLINK("x")', phone: '0900000000',
      consent: true, totalScore: 1, correctCount: 1, totalTimeMs: 1, createdAt: 0,
    }
    const csv = leadsToCsv([lead], new Map([['q', { title: 'Quiz' }]]))
    expect(csv).toContain("'=HYPERLINK")
  })
})
