// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RepoProvider } from '../../src/hooks/useRepo'
import { ToastProvider } from '../../src/components/Toast'
import { AdminChunkBoundary } from '../../src/components/AdminChunkBoundary'
import { Celebration } from '../../src/components/Celebration'
import { CountUp } from '../../src/components/CountUp'
import { SceneWipe } from '../../src/components/SceneWipe'
import PlayPage from '../../src/features/play/PlayPage'
import { createStorageRepo } from '../../src/services/storage'
import { SEED_QUIZ } from '../../src/domain/seed'
import { seedPlaySession } from './test-utils'

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

function ThrowingAdmin(): never {
  throw new Error('Failed to fetch dynamically imported module')
}

describe('motion', () => {
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
    vi.restoreAllMocks()
  })

  it('reduced motion disables confetti', () => {
    const { container, rerender } = render(<Celebration active reduced />)
    expect(container.querySelector('[data-celebration]')).toHaveAttribute('data-celebration', 'off')
    rerender(<Celebration active reduced={false} />)
    expect(container.querySelector('[data-celebration]')).toHaveAttribute('data-celebration', 'on')
  })

  it('count up ends exactly at total score', () => {
    vi.useFakeTimers()
    try {
      render(<CountUp value={4250} duration={60} />)
      act(() => { vi.advanceTimersByTime(200) })
      expect(screen.getAllByText('4.250').length).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('answer cards are disabled until reveal ends', async () => {
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

    const buttons = document.querySelectorAll<HTMLButtonElement>('button[data-color]')
    expect(buttons.length).toBe(4)
    buttons.forEach((button) => expect(button).toBeDisabled())

    act(() => { vi.advanceTimersByTime(800) })
    buttons.forEach((button) => expect(button).toBeEnabled())
  })

  it('score is announced once for screen readers', () => {
    const { container } = render(<CountUp value={4250} reducedMotion />)
    const live = container.querySelectorAll('[aria-live="polite"]')
    expect(live).toHaveLength(1)
    expect(live[0]).toHaveTextContent('4.250')
    const visible = container.querySelector('[aria-hidden="true"]')
    expect(visible).toHaveTextContent('4.250')
  })

  it('scene wipe is removed after it finishes', () => {
    vi.useFakeTimers()
    try {
      const { container } = render(<SceneWipe sceneKey={0} />)
      expect(container.querySelector('[data-scene-wipe]')).not.toBeNull()
      act(() => { vi.advanceTimersByTime(800) })
      expect(container.querySelector('[data-scene-wipe]')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('admin chunk load failure shows reload prompt', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <AdminChunkBoundary>
        <ThrowingAdmin />
      </AdminChunkBoundary>,
    )
    expect(screen.getByText(/Phiên bản mới đã có/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tải lại' })).toBeInTheDocument()
  })
})
