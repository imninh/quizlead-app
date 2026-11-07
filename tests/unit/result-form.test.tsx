// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RepoProvider } from '../../src/hooks/useRepo'
import { ToastProvider } from '../../src/components/Toast'
import ResultPage from '../../src/features/result/ResultPage'
import { createStorageRepo } from '../../src/services/storage'
import type { Attempt } from '../../src/domain/schemas'
import { SEED_QUIZ } from '../../src/domain/seed'

function seedAttempt() {
  const repo = createStorageRepo()
  repo.saveQuiz(SEED_QUIZ)
  const attempt: Attempt = {
    id: 'attempt1',
    quizId: SEED_QUIZ.id,
    answers: Array.from({ length: 5 }, (_, i) => ({ questionId: `q${i}`, selectedIndex: 0, elapsedMs: 1000, isCorrect: true, points: 100 })),
    totalScore: 100,
    correctCount: 1,
    totalTimeMs: 1000,
    finishedAt: Date.now(),
  }
  repo.saveAttempt(attempt)
  return { repo, attempt }
}

describe('result form', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    seedAttempt()
  })
  afterEach(() => {})

  it('shows validation errors on empty submit', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/result/attempt1']}>
        <RepoProvider>
          <ToastProvider>
            <Routes>
              <Route path="/result/:attemptId" element={<ResultPage />} />
            </Routes>
          </ToastProvider>
        </RepoProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getByText('Gửi thông tin'))
    expect(screen.getByText('Tên phải từ 2 đến 50 ký tự')).toBeInTheDocument()
    expect(screen.getByText('Số điện thoại không hợp lệ')).toBeInTheDocument()
  })

  it('rejects invalid phone prefix', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/result/attempt1']}>
        <RepoProvider>
          <ToastProvider>
            <Routes>
              <Route path="/result/:attemptId" element={<ResultPage />} />
            </Routes>
          </ToastProvider>
        </RepoProvider>
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText(/Họ và tên/i), 'Nguyen Van A')
    await user.type(screen.getByLabelText(/Số điện thoại/i), '0212345678')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByText('Gửi thông tin'))
    expect(screen.getByText('Số điện thoại không hợp lệ')).toBeInTheDocument()
  })

  it('does not submit when consent unchecked', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/result/attempt1']}>
        <RepoProvider>
          <ToastProvider>
            <Routes>
              <Route path="/result/:attemptId" element={<ResultPage />} />
            </Routes>
          </ToastProvider>
        </RepoProvider>
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText(/Họ và tên/i), 'Nguyen Van A')
    await user.type(screen.getByLabelText(/Số điện thoại/i), '0912345678')
    await user.click(screen.getByText('Gửi thông tin'))
    expect(screen.queryByText(/Đã ghi nhận/)).not.toBeInTheDocument()
  })

  it('saves lead when form valid', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/result/attempt1']}>
        <RepoProvider>
          <ToastProvider>
            <Routes>
              <Route path="/result/:attemptId" element={<ResultPage />} />
            </Routes>
          </ToastProvider>
        </RepoProvider>
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText(/Họ và tên/i), 'Nguyen Van A')
    await user.type(screen.getByLabelText(/Số điện thoại/i), '0912345678')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByText('Gửi thông tin'))
    expect(screen.getByText(/Bạn đã gửi thông tin nhận quà/)).toBeInTheDocument()
  })

  it('result page keeps score as the largest number', () => {
    render(
      <MemoryRouter initialEntries={['/result/attempt1']}>
        <RepoProvider>
          <ToastProvider>
            <Routes>
              <Route path="/result/:attemptId" element={<ResultPage />} />
            </Routes>
          </ToastProvider>
        </RepoProvider>
      </MemoryRouter>,
    )
    const scoreText = screen.getByText('100')
    expect(scoreText.parentElement?.className).toContain('font-display')
    expect(scoreText.parentElement?.className).toContain('text-[clamp(3.8rem')
  })

  it('shows already submitted when lead exists for attempt', async () => {
    const repo = createStorageRepo()
    repo.saveLead({
      id: 'lead1',
      quizId: SEED_QUIZ.id,
      attemptId: 'attempt1',
      name: 'Nguyen Van A',
      phone: '0912345678',
      consent: true,
      totalScore: 100,
      correctCount: 1,
      totalTimeMs: 1000,
      createdAt: Date.now(),
    })
    render(
      <MemoryRouter initialEntries={['/result/attempt1']}>
        <RepoProvider>
          <ToastProvider>
            <Routes>
              <Route path="/result/:attemptId" element={<ResultPage />} />
            </Routes>
          </ToastProvider>
        </RepoProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText(/Bạn đã gửi thông tin nhận quà/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Họ và tên/i)).not.toBeInTheDocument()
  })

  it('opens facebook share fallback dialog when clipboard fails', async () => {
    const user = userEvent.setup()
    const orig = navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('no') } }, configurable: true })
    // also force execCommand false
    document.execCommand = () => false
    render(
      <MemoryRouter initialEntries={['/result/attempt1']}>
        <RepoProvider>
          <ToastProvider>
            <Routes>
              <Route path="/result/:attemptId" element={<ResultPage />} />
            </Routes>
          </ToastProvider>
        </RepoProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getByText('Copy kết quả để đăng Facebook'))
    expect(screen.getByText(/Không copy được tự động/)).toBeInTheDocument()
    Object.defineProperty(navigator, 'clipboard', { value: orig, configurable: true })
  })

  it('has open facebook link', () => {
    render(
      <MemoryRouter initialEntries={['/result/attempt1']}>
        <RepoProvider>
          <ToastProvider>
            <Routes>
              <Route path="/result/:attemptId" element={<ResultPage />} />
            </Routes>
          </ToastProvider>
        </RepoProvider>
      </MemoryRouter>,
    )
    const link = screen.getByText('Mở Facebook').closest('a')
    expect(link?.getAttribute('href')).toContain('sharer.php?u=')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })
})