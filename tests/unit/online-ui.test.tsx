// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStorageRepo } from '../../src/services/storage'
import { SEED_QUIZ } from '../../src/domain/seed'
import { saveOnlineAttemptToken } from '../../src/services/session'
import { resetOnlineCache, saveOnlineEntryId } from '../../src/services/onlineClient'
import type { Attempt, Lead } from '../../src/domain/schemas'
import { preloadAdminRoutes, renderApp, resetStorage } from './test-utils'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function onlineAttempt(): Attempt {
  return {
    id: 'online-attempt',
    quizId: SEED_QUIZ.id,
    answers: SEED_QUIZ.questions.map((question) => ({
      questionId: question.id,
      selectedIndex: question.correctIndex,
      elapsedMs: 1000,
      isCorrect: true,
      points: 1000,
    })),
    totalScore: 5000,
    correctCount: 5,
    totalTimeMs: 5000,
    finishedAt: 1,
    online: true,
  }
}

function localLead(): Lead {
  return {
    id: 'lead-local',
    quizId: SEED_QUIZ.id,
    attemptId: 'a-local',
    name: 'Nguyễn Văn Local',
    phone: '0912345678',
    consent: true,
    totalScore: 4000,
    correctCount: 4,
    totalTimeMs: 6000,
    createdAt: 1,
  }
}

function onlineEntry() {
  return {
    entryId: 'online-1',
    quizId: SEED_QUIZ.id,
    version: 1,
    name: 'Nguyễn Văn Online',
    character: 'mi',
    phoneMasked: '09******78',
    totalScore: 5000,
    totalTimeMs: 5000,
    correctCount: 5,
    createdAt: 1,
  }
}

describe('online ui', () => {
  beforeAll(preloadAdminRoutes)

  beforeEach(() => {
    resetStorage()
    resetOnlineCache()
    vi.unstubAllGlobals()
  })

  it('lead is saved locally even when score submission fails', async () => {
    const repo = createStorageRepo()
    repo.saveQuiz(SEED_QUIZ)
    repo.saveProfile({ name: 'Nguyễn Văn A', character: 'mi' })
    repo.saveAttempt(onlineAttempt())
    saveOnlineAttemptToken('token')
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ok: false, code: 'UPSTREAM' }, 500)))

    const user = userEvent.setup()
    renderApp('/result/online-attempt')
    await user.type(screen.getByLabelText(/Số điện thoại/i), '0912345678')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Gửi thông tin' }))

    expect(await screen.findByText(/Chưa gửi được lên bảng xếp hạng chung/)).toBeInTheDocument()
    const leads = createStorageRepo().getLeads()
    expect(leads.ok && leads.data).toHaveLength(1)
    expect(leads.ok && leads.data[0]!.name).toBe('Nguyễn Văn A')
  })

  it('failed submission shows retry button', async () => {
    const repo = createStorageRepo()
    repo.saveQuiz(SEED_QUIZ)
    repo.saveProfile({ name: 'Nguyễn Văn A', character: 'mi' })
    repo.saveAttempt(onlineAttempt())
    saveOnlineAttemptToken('token')
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ok: false }, 500)))

    const user = userEvent.setup()
    renderApp('/result/online-attempt')
    await user.type(screen.getByLabelText(/Số điện thoại/i), '0912345678')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Gửi thông tin' }))

    expect(await screen.findByRole('button', { name: 'Gửi lại' })).toBeInTheDocument()
  })

  it('leaderboard shows online and local tabs', async () => {
    const repo = createStorageRepo()
    repo.saveQuiz(SEED_QUIZ)
    saveOnlineEntryId('online-1')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const path = String(url)
        if (path.includes('/api/health')) return jsonResponse({ online: true })
        if (path.includes('/api/leaderboard/')) {
          return jsonResponse({ ok: true, version: 1, entries: [onlineEntry()] })
        }
        return jsonResponse({ ok: false }, 404)
      }),
    )

    renderApp(`/leaderboard/${SEED_QUIZ.id}`)
    expect(await screen.findByRole('tab', { name: 'Toàn bộ người chơi (online)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Trên máy này' })).toBeInTheDocument()
    expect(await screen.findByText('Nguyễn Văn Online')).toBeInTheDocument()
    expect(screen.getByText('09******78')).toBeInTheDocument()
  })

  it('online error falls back to local tab with a notice', async () => {
    const repo = createStorageRepo()
    repo.saveQuiz(SEED_QUIZ)
    repo.saveLead(localLead())
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const path = String(url)
        if (path.includes('/api/health')) return jsonResponse({ online: true })
        return jsonResponse({ ok: false, code: 'UPSTREAM' }, 500)
      }),
    )

    renderApp(`/leaderboard/${SEED_QUIZ.id}`)
    expect(await screen.findByText(/Không tải được bảng chung/)).toBeInTheDocument()
    expect(await screen.findByText('Nguyễn Văn Local')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Trên máy này' })).toHaveAttribute('aria-selected', 'true')
  })

  it('publish button shows version and copyable link', async () => {
    const quiz = { ...SEED_QUIZ, publishedVersion: 3, publishedAt: 1000, updatedAt: 2000 }
    createStorageRepo().saveQuiz(quiz)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        if (String(url).includes('/api/health')) return jsonResponse({ online: true })
        return jsonResponse({ ok: false }, 404)
      }),
    )

    renderApp('/admin')
    expect(await screen.findByText('Đã xuất bản · v3')).toBeInTheDocument()
    expect(await screen.findByText('Có thay đổi chưa xuất bản')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy link chơi' })).toBeInTheDocument()
  })

  it('app works unchanged when online is disabled', async () => {
    const repo = createStorageRepo()
    repo.saveQuiz(SEED_QUIZ)
    repo.saveLead(localLead())
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ online: false })))

    renderApp(`/leaderboard/${SEED_QUIZ.id}`)
    await waitFor(() => expect(screen.getByText('Nguyễn Văn Local')).toBeInTheDocument())
    expect(screen.queryByRole('tab', { name: 'Toàn bộ người chơi (online)' })).not.toBeInTheDocument()
    expect(screen.getByText('Bảng xếp hạng')).toBeInTheDocument()
  })
})
