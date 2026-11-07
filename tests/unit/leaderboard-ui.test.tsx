// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RepoProvider } from '../../src/hooks/useRepo'
import { ToastProvider } from '../../src/components/Toast'
import LeaderboardPage from '../../src/features/leaderboard/LeaderboardPage'
import { createStorageRepo } from '../../src/services/storage'
import { SEED_QUIZ } from '../../src/domain/seed'
import { resetOnlineCache, saveOnlineEntry, type OnlineEntry } from '../../src/services/onlineClient'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('leaderboard ui', () => {
  beforeEach(() => {
    resetOnlineCache()
    localStorage.clear()
    sessionStorage.clear()
    const repo = createStorageRepo()
    repo.saveQuiz(SEED_QUIZ)
    repo.saveLead({
      id: 'lead1',
      quizId: SEED_QUIZ.id,
      attemptId: 'a1',
      name: 'Nguyen Van A',
      phone: '0912345678',
      consent: true,
      totalScore: 100,
      correctCount: 1,
      totalTimeMs: 1000,
      createdAt: Date.now(),
    })
  })

  it('masks phone in DOM', () => {
    render(
      <MemoryRouter initialEntries={[`/leaderboard/${SEED_QUIZ.id}`]}>
        <RepoProvider>
          <ToastProvider>
            <Routes>
              <Route path="/leaderboard/:quizId" element={<LeaderboardPage />} />
            </Routes>
          </ToastProvider>
        </RepoProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('09******78')).toBeInTheDocument()
    expect(screen.queryByText('0912345678')).not.toBeInTheDocument()
  })

  it('own submitted entry appears even if board response is stale', async () => {
    const other: OnlineEntry = {
      entryId: 'other-entry',
      quizId: SEED_QUIZ.id,
      version: 1,
      name: 'Người Khác',
      character: 'bin',
      phoneMasked: '09******11',
      totalScore: 1000,
      totalTimeMs: 10000,
      correctCount: 2,
      createdAt: 1,
    }
    const own: OnlineEntry = {
      entryId: 'own-entry',
      quizId: SEED_QUIZ.id,
      version: 1,
      name: 'Tên Của Tôi',
      character: 'mi',
      phoneMasked: '09******78',
      totalScore: 5000,
      totalTimeMs: 5000,
      correctCount: 5,
      createdAt: 2,
    }
    saveOnlineEntry(own)
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url === '/api/health') return json({ online: true })
      if (url.startsWith('/api/leaderboard/')) return json({ ok: true, version: 1, entries: [other] })
      return json({ ok: false }, 404)
    }))

    render(
      <MemoryRouter initialEntries={[`/leaderboard/${SEED_QUIZ.id}`]}>
        <RepoProvider>
          <ToastProvider>
            <Routes>
              <Route path="/leaderboard/:quizId" element={<LeaderboardPage />} />
            </Routes>
          </ToastProvider>
        </RepoProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Tên Của Tôi')).toBeInTheDocument()
    expect(await screen.findByText('Người Khác')).toBeInTheDocument()
    const rows = screen.getAllByRole('row').map((row) => row.textContent ?? '')
    expect(rows[1]).toContain('Tên Của Tôi')
  })
})