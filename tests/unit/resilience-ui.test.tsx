// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp, resetStorage, seedPlaySession } from './test-utils'
import { RootErrorBoundary } from '../../src/components/RootErrorBoundary'
import { createStorageRepo } from '../../src/services/storage'
import { SEED_QUIZ } from '../../src/domain/seed'
import { savePendingResult } from '../../src/services/session'
import type { Attempt } from '../../src/domain/schemas'

function ThrowingPage(): never {
  throw new Error('boom')
}

function makeAttempt(id: string, totalScore = 1234): Attempt {
  return {
    id,
    quizId: SEED_QUIZ.id,
    answers: Array.from({ length: 5 }, (_, i) => ({
      questionId: `q${i}`,
      selectedIndex: 0 as const,
      elapsedMs: 1000,
      isCorrect: i === 0,
      points: 100,
    })),
    totalScore,
    correctCount: 1,
    totalTimeMs: 5000,
    finishedAt: 1000,
  }
}

describe('resilience ui', () => {
  beforeEach(() => {
    resetStorage()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('root error boundary renders fallback instead of blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <RootErrorBoundary>
        <ThrowingPage />
      </RootErrorBoundary>,
    )

    expect(screen.getByText('Có lỗi xảy ra')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tải lại' })).toBeInTheDocument()
  })

  it('banner names the corrupted data and can be dismissed', async () => {
    const user = userEvent.setup()
    localStorage.setItem('quizlead:v1:leads', 'abc')
    renderApp('/')

    expect(await screen.findByText(/Danh sách khách hàng bị hỏng, đã tạo bản sao lưu/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Đóng cảnh báo Danh sách khách hàng' }))
    expect(screen.queryByText(/Danh sách khách hàng bị hỏng, đã tạo bản sao lưu/)).not.toBeInTheDocument()
  })

  it('storage event from another tab refreshes home page quiz', async () => {
    renderApp('/')
    expect(screen.getByRole('heading', { name: 'Digital Marketing cơ bản' })).toBeInTheDocument()

    const repo = createStorageRepo()
    const now = Date.now()
    repo.saveQuiz({ ...SEED_QUIZ, id: 'quiz-moi', title: 'Quiz mới', createdAt: now, updatedAt: now })
    repo.setActiveQuizId('quiz-moi')

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'quizlead:v1:activeQuizId', newValue: '"quiz-moi"' }))
    })

    expect(await screen.findByRole('heading', { name: 'Quiz mới' })).toBeInTheDocument()
  })

  it('leaderboard of a deleted quiz shows a friendly message', async () => {
    renderApp('/leaderboard/khong-co')

    expect(await screen.findByText('Quiz này đã bị xoá')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Về trang đầu' })).toBeInTheDocument()
  })

  it('result page still shows score when attempt could not be saved', async () => {
    savePendingResult(makeAttempt('pending-1', 1234))
    renderApp('/result/pending-1')

    expect(await screen.findByText('Chưa lưu được kết quả. Điểm vẫn hiển thị nhưng có thể mất khi tải lại trang.')).toBeInTheDocument()
    expect(screen.getByText('1.234')).toBeInTheDocument()
  })

  it('lead form keeps typed values after quota error', async () => {
    const repo = createStorageRepo()
    repo.saveAttempt(makeAttempt('attempt-quota'))
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function setItem(this: Storage, key: string, value: string) {
      if (key === 'quizlead:v1:leads') throw new DOMException('quota', 'QuotaExceededError')
      return originalSetItem.call(this, key, value)
    }

    try {
      const user = userEvent.setup()
      renderApp('/result/attempt-quota')
      await user.type(screen.getByLabelText(/Họ và tên/i), 'Nguyen Van A')
      await user.type(screen.getByLabelText(/Số điện thoại/i), '0912345678')
      await user.click(screen.getByRole('checkbox'))
      await user.click(screen.getByText('Gửi thông tin'))

      expect(await screen.findByText(/Bộ nhớ trình duyệt đã đầy/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Họ và tên/i)).toHaveValue('Nguyen Van A')
      expect(screen.getByLabelText(/Số điện thoại/i)).toHaveValue('0912345678')
    } finally {
      Storage.prototype.setItem = originalSetItem
    }
  })

  it('copy fallback textarea is selected automatically', async () => {
    const repo = createStorageRepo()
    repo.saveAttempt(makeAttempt('attempt-copy'))
    const user = userEvent.setup()
    const originalClipboard = navigator.clipboard
    const originalExec = document.execCommand
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async () => { throw new Error('blocked') } },
      configurable: true,
    })
    document.execCommand = () => false

    try {
      renderApp('/result/attempt-copy')
      await user.click(screen.getByText('Copy kết quả để đăng Facebook'))
      const textarea = (await screen.findByLabelText('Nội dung cần copy')) as HTMLTextAreaElement

      expect(document.activeElement).toBe(textarea)
      expect(textarea.selectionStart).toBe(0)
      expect(textarea.selectionEnd).toBe(textarea.value.length)
    } finally {
      Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true })
      document.execCommand = originalExec
    }
  })

  it('unknown quiz id on play page shows empty state with home link', async () => {
    renderApp('/play/khong-co')

    expect(await screen.findByText('Không tìm thấy quiz')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Về trang đầu' })).toBeInTheDocument()
  })

  it('unknown attempt id on result page shows empty state with home link', async () => {
    renderApp('/result/khong-co')

    expect(await screen.findByText('Không tìm thấy kết quả.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Về trang đầu' })).toBeInTheDocument()
  })

  it('deleting the quiz in another tab does not interrupt the round', async () => {
    seedPlaySession(SEED_QUIZ)
    renderApp(`/play/${SEED_QUIZ.id}`)
    expect(screen.getByText(/Câu 1\/5/)).toBeInTheDocument()
    const questionText = SEED_QUIZ.questions[0]!.text
    expect(screen.getByText(questionText)).toBeInTheDocument()

    const repo = createStorageRepo()
    repo.deleteQuiz(SEED_QUIZ.id)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'quizlead:v1:quizzes', newValue: '[]' }))
    })

    expect(screen.getByText(/Câu 1\/5/)).toBeInTheDocument()
    expect(screen.getByText(questionText)).toBeInTheDocument()
  })
})
