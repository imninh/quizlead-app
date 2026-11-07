// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RepoProvider } from '../../src/hooks/useRepo'
import { ToastProvider } from '../../src/components/Toast'
import PlayPage from '../../src/features/play/PlayPage'
import { OpponentIntro } from '../../src/features/play/OpponentIntro'
import { buildShareText } from '../../src/domain/share'
import { opponentLabel } from '../../src/domain/raceLabels'
import { raceResultAsset } from '../../src/components/raceAssets'
import { AVAILABLE_ASSETS } from '../../src/assets/manifest.generated'
import { createStorageRepo } from '../../src/services/storage'
import { SEED_QUIZ } from '../../src/domain/seed'
import { MSG } from '../../src/domain/messages'
import type { AiGhost, Attempt, AnswerRecord, RaceResult } from '../../src/domain/schemas'
import {
  preloadAdminRoutes,
  renderApp,
  resetStorage,
  seedPlaySession,
} from './test-utils'

function fakeAnswers(elapsedMs = 1000): AnswerRecord[] {
  return SEED_QUIZ.questions.map((question) => ({
    questionId: question.id,
    selectedIndex: 0,
    elapsedMs,
    isCorrect: false,
    points: 0,
  }))
}

function attemptWithRace(raceResult: RaceResult): Attempt {
  return {
    id: 'race-attempt',
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
    opponent: { kind: 'rabbit', totalScore: 4000, totalTimeMs: 6000 },
    raceResult,
  }
}

describe('race ui', () => {
  beforeAll(preloadAdminRoutes)

  beforeEach(() => {
    resetStorage()
  })

  it('name and character are required before racing', () => {
    renderApp(`/play/${SEED_QUIZ.id}`)
    fireEvent.click(screen.getByRole('button', { name: MSG.raceStart }))
    expect(screen.getByText('Tên phải từ 2 đến 50 ký tự')).toBeInTheDocument()
    expect(screen.getByText('Chọn nhân vật trước khi vào đua')).toBeInTheDocument()
  })

  it('profile is remembered and prefilled', () => {
    createStorageRepo().saveProfile({ name: 'Lan Nguyễn', character: 'muc' })
    renderApp(`/play/${SEED_QUIZ.id}`)
    expect(screen.getByLabelText(MSG.raceName)).toHaveValue('Lan Nguyễn')
    expect(screen.getByRole('button', { name: 'Mực' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('muc card never shows Mi as fallback', () => {
    renderApp(`/play/${SEED_QUIZ.id}`)
    fireEvent.click(screen.getByRole('button', { name: 'Mực' }))
    const mucVisual = document.querySelector('img[data-asset="muc-run"], [data-race-doodle="muc"]')
    expect(mucVisual).not.toBeNull()
    expect(document.querySelector('img[data-asset="mi-oops"]')).toBeNull()
  })

  it('opponent is not re-drawn after reload', () => {
    vi.useFakeTimers()
    try {
      const first = renderApp(`/play/${SEED_QUIZ.id}`)
      fireEvent.change(screen.getByLabelText(MSG.raceName), { target: { value: 'Lan' } })
      fireEvent.click(screen.getByRole('button', { name: 'Mi' }))
      fireEvent.click(screen.getByRole('button', { name: MSG.raceStart }))
      act(() => { vi.advanceTimersByTime(2000) })
      act(() => { vi.advanceTimersByTime(200) })

      const session = JSON.parse(sessionStorage.getItem('quizlead:v1:session')!)
      const opponent = session.state.opponent
      const label = MSG.opponentLabels[opponent.kind as keyof typeof MSG.opponentLabels]
      first.unmount()

      renderApp(`/play/${SEED_QUIZ.id}`)
      expect(screen.getByLabelText('Đường đua')).toHaveTextContent(label)
      const sessionAfter = JSON.parse(sessionStorage.getItem('quizlead:v1:session')!)
      expect(sessionAfter.state.opponent.kind).toBe(opponent.kind)
    } finally {
      vi.useRealTimers()
    }
  })

  it('opponent answered label appears without revealing correctness', () => {
    vi.useFakeTimers()
    try {
      seedPlaySession(SEED_QUIZ, { kind: 'rabbit', answers: fakeAnswers(1000) })
      render(
        <MemoryRouter initialEntries={[`/play/${SEED_QUIZ.id}`]}>
          <RepoProvider>
            <ToastProvider>
              <Routes>
                <Route path="/play/:quizId" element={<PlayPage />} />
              </Routes>
            </ToastProvider>
          </RepoProvider>
        </MemoryRouter>,
      )
      act(() => { vi.advanceTimersByTime(900) })
      expect(screen.queryByText(MSG.opponentAnswered('Thỏ'))).not.toBeInTheDocument()
      act(() => { vi.advanceTimersByTime(1000) })
      expect(screen.getByText(MSG.opponentAnswered('Thỏ'))).toBeInTheDocument()
      expect(screen.queryByText(/đúng|sai/i)).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('result shows score as the biggest number and race result below', () => {
    const repo = createStorageRepo()
    repo.saveQuiz(SEED_QUIZ)
    repo.saveAttempt(attemptWithRace('win'))
    renderApp('/result/race-attempt')

    expect(screen.getByText('5.000')).toBeInTheDocument()
    expect(screen.getByText(MSG.raceWin)).toBeInTheDocument()
    expect(screen.getByText('Bạn vượt Thỏ 1.000 điểm!')).toBeInTheDocument()
  })

  it('lead form is prefilled with the race name', () => {
    const repo = createStorageRepo()
    repo.saveQuiz(SEED_QUIZ)
    repo.saveProfile({ name: 'Lan Nguyễn', character: 'muc' })
    repo.saveAttempt(attemptWithRace('win'))
    renderApp('/result/race-attempt')
    expect(screen.getByLabelText(/Họ và tên/i)).toHaveValue('Lan Nguyễn')
  })

  it('ai opponent label is Trum without model name', () => {
    const label = opponentLabel('ai', 'qwen/qwen3.5-flash-02-23')
    expect(label).toBe('Trùm')
    expect(label).not.toMatch(/qwen/i)
  })

  it('opponent intro for ai never shows model id', () => {
    render(<OpponentIntro kind="ai" model="qwen/qwen3.5-flash-02-23" onDone={() => {}} />)
    expect(screen.getByText('Trùm')).toBeInTheDocument()
    expect(screen.getByText(MSG.bossHint)).toBeInTheDocument()
    expect(screen.queryByText(/qwen/i)).toBeNull()
    expect(screen.queryByText(/AI thật/i)).toBeNull()
  })

  it('share text says won against Trum', () => {
    const text = buildShareText({
      score: 5000,
      correctCount: 5,
      totalTimeMs: 5000,
      quizTitle: SEED_QUIZ.title,
      fanpageName: 'FPT Polytechnic',
      appUrl: 'https://example.com',
      race: { result: 'win', opponentLabel: opponentLabel('ai', 'qwen/qwen3.5-flash-02-23') },
    })
    expect(text).toContain('🏁 Mình đã thắng Trùm trên đường đua!')
    expect(text).not.toMatch(/qwen/i)
  })

  it('share text includes the race line', () => {
    const text = buildShareText({
      score: 5000,
      correctCount: 5,
      totalTimeMs: 5000,
      quizTitle: SEED_QUIZ.title,
      fanpageName: 'FPT Polytechnic',
      appUrl: 'https://example.com',
      race: { result: 'win', opponentLabel: 'Trùm' },
    })
    expect(text).toContain('🏁 Mình đã thắng Trùm trên đường đua!')
  })

  it('race result asset never points to a missing file', () => {
    for (const character of ['mi', 'bin', 'muc'] as const) {
      for (const outcome of ['win', 'lose', 'draw'] as const) {
        const visual = raceResultAsset(character, outcome)
        if (visual.kind === 'image') {
          expect(AVAILABLE_ASSETS).toContain(visual.name)
        } else {
          expect(visual.character).toBe('muc')
        }
      }
    }
    expect(raceResultAsset('muc', 'win')).toEqual({ kind: 'image', name: 'muc-win' })
  })

  it('result shows muc win image when muc wins', () => {
    const repo = createStorageRepo()
    repo.saveQuiz(SEED_QUIZ)
    repo.saveProfile({ name: 'Mực', character: 'muc' })
    repo.saveAttempt(attemptWithRace('win'))
    renderApp('/result/race-attempt')

    expect(document.querySelector('img[data-asset="muc-win"]')).not.toBeNull()
    expect(document.querySelector('[data-race-doodle="muc"]')).toBeNull()
  })

  it('result shows muc doodle when muc loses', () => {
    const repo = createStorageRepo()
    repo.saveQuiz(SEED_QUIZ)
    repo.saveProfile({ name: 'Mực', character: 'muc' })
    repo.saveAttempt(attemptWithRace('lose'))
    renderApp('/result/race-attempt')

    expect(document.querySelector('[data-race-doodle="muc"]')).not.toBeNull()
    expect(document.querySelector('img[data-asset="muc-lose"]')).toBeNull()
  })

  it('editing questions clears the old ghost', async () => {
    const ghost: AiGhost = {
      model: 'ghost/model',
      ranAt: 1,
      answers: SEED_QUIZ.questions.map(() => ({ selectedIndex: 0, elapsedMs: 2000 })),
    }
    const quiz = { ...SEED_QUIZ, aiGhost: ghost, createdAt: 1, updatedAt: 1 }
    const repo = createStorageRepo()
    repo.saveQuiz(quiz)
    repo.setActiveQuizId(quiz.id)

    const user = userEvent.setup()
    renderApp(`/admin/quiz/${quiz.id}/edit`)
    await screen.findByRole('heading', { name: 'Sửa quiz' })
    const firstQuestion = screen.getAllByLabelText('Câu hỏi')[0]!
    await user.clear(firstQuestion)
    await user.type(firstQuestion, 'Câu hỏi đã bị sửa?')
    await user.click(screen.getByRole('button', { name: 'Lưu' }))
    await screen.findByRole('heading', { name: 'Quiz' })

    const saved = createStorageRepo().getQuiz(quiz.id)
    expect(saved.ok && saved.data.aiGhost).toBeUndefined()
  })
})
