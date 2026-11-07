// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RepoProvider } from '../../src/hooks/useRepo'
import { ToastProvider } from '../../src/components/Toast'
import PlayPage from '../../src/features/play/PlayPage'
import { createStorageRepo } from '../../src/services/storage'
import { SEED_QUIZ } from '../../src/domain/seed'
import { seedPlaySession } from './test-utils'

describe('play flow', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    const repo = createStorageRepo()
    repo.saveQuiz(SEED_QUIZ)
    repo.setActiveQuizId(SEED_QUIZ.id)
    seedPlaySession(SEED_QUIZ)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows timeout after 30s', async () => {
    vi.useFakeTimers()
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
    expect(screen.getByText(/Câu 1\/5/)).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(31000) })
    expect(screen.getByText('Hết giờ!')).toBeInTheDocument()
  })

  it('shows correct feedback and points on right answer', async () => {
    vi.useFakeTimers()
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
    const option = screen.getByText(SEED_QUIZ.questions[0]!.options[SEED_QUIZ.questions[0]!.correctIndex]!)
    act(() => { vi.advanceTimersByTime(800) })
    act(() => { option.click() })
    expect(screen.getByText('Chính xác!')).toBeInTheDocument()
    expect(screen.getByText(/\+998/)).toBeInTheDocument()
  })

  it('auto advances to next question after 4s feedback', async () => {
    vi.useFakeTimers()
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
    const option = screen.getByText(SEED_QUIZ.questions[0]!.options[0]!)
    act(() => { vi.advanceTimersByTime(800) })
    act(() => { option.click() })
    act(() => { vi.advanceTimersByTime(4000) })
    expect(screen.getByText(/Câu 2\/5/)).toBeInTheDocument()
  })

  it('corrupt session storage starts a new round', () => {
    sessionStorage.setItem('quizlead:v1:session', '{bad json')
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
    expect(screen.getByText('Vào đường đua')).toBeInTheDocument()
  })

  it('reload resumes at the saved question', () => {
    vi.useFakeTimers()
    const first = render(
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
    const option = screen.getByText(SEED_QUIZ.questions[0]!.options[0]!)
    act(() => { vi.advanceTimersByTime(800) })
    act(() => { option.click() })
    act(() => { screen.getByText('Câu tiếp theo').click() })
    expect(screen.getByText(/Câu 2\/5/)).toBeInTheDocument()
    first.unmount()

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
    expect(screen.getByText(/Câu 2\/5/)).toBeInTheDocument()
  })

  it('long question and answers render without truncation', () => {
    const longQuestion = ('Câu hỏi dài cần hiển thị trọn vẹn trên màn hình nhỏ: ' + 'nội dung kiểm thử '.repeat(20)).slice(0, 300)
    const longAnswer = ('Đáp án dài cần hiển thị trọn vẹn: ' + 'chữ '.repeat(40)).slice(0, 150).trimEnd()
    const repo = createStorageRepo()
    repo.saveQuiz({
      ...SEED_QUIZ,
      id: 'long-quiz',
      title: 'Quiz câu hỏi dài',
      questions: SEED_QUIZ.questions.map((question, index) =>
        index === 0
          ? { ...question, text: longQuestion, options: [longAnswer, longAnswer.slice(1), longAnswer.slice(2), longAnswer.slice(3)] }
          : question,
      ),
      createdAt: 1,
      updatedAt: 1,
    })
    repo.setActiveQuizId('long-quiz')
    seedPlaySession({
      ...SEED_QUIZ,
      id: 'long-quiz',
      title: 'Quiz câu hỏi dài',
      questions: SEED_QUIZ.questions.map((question, index) =>
        index === 0
          ? { ...question, text: longQuestion, options: [longAnswer, longAnswer.slice(1), longAnswer.slice(2), longAnswer.slice(3)] }
          : question,
      ),
      createdAt: 1,
      updatedAt: 1,
    })

    render(
      <MemoryRouter initialEntries={['/play/long-quiz']}>
        <RepoProvider>
          <ToastProvider>
            <Routes>
              <Route path="/play/:quizId" element={<PlayPage />} />
            </Routes>
          </ToastProvider>
        </RepoProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText(longQuestion)).toBeInTheDocument()
    expect(screen.getByText(longQuestion)).toHaveClass('answer-text')
    expect(screen.getByText(longAnswer)).toHaveClass('break-words')
  })
})