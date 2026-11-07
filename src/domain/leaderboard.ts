import type { Lead } from './schemas.js'

export function rankLeads(leads: Lead[], quizId: string): Lead[] {
  return leads
    .filter((l) => l.quizId === quizId)
    .slice()
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
      if (a.totalTimeMs !== b.totalTimeMs) return a.totalTimeMs - b.totalTimeMs
      return a.createdAt - b.createdAt
    })
}

export function topLeads(leads: Lead[], quizId: string, n = 10): Lead[] {
  return rankLeads(leads, quizId).slice(0, n)
}

export function findRank(leads: Lead[], quizId: string, leadId: string): number {
  const ranked = rankLeads(leads, quizId)
  const idx = ranked.findIndex((l) => l.id === leadId)
  return idx === -1 ? 0 : idx + 1
}

export function upsertLeadByPhone(
  leads: Lead[],
  newLead: Lead,
): { leads: Lead[]; outcome: 'created' | 'improved' | 'kept_existing' } {
  const existingIdx = leads.findIndex(
    (l) => l.quizId === newLead.quizId && l.phone === newLead.phone,
  )
  if (existingIdx === -1) {
    return { leads: [...leads, newLead], outcome: 'created' }
  }
  const existing = leads[existingIdx]!
  if (newLead.totalScore > existing.totalScore) {
    const copy = leads.slice()
    copy[existingIdx] = newLead
    return { leads: copy, outcome: 'improved' }
  }
  return { leads: leads.slice(), outcome: 'kept_existing' }
}
