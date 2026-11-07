// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { preloadAdminRoutes, renderApp, resetStorage } from './test-utils'
import { createStorageRepo } from '../../src/services/storage'
import { SEED_QUIZ } from '../../src/domain/seed'

describe('quiz list', () => {
  beforeAll(preloadAdminRoutes)
  beforeEach(() => {
    resetStorage()
  })

  it('deleting active quiz makes another active', async () => {
    const user = userEvent.setup()
    const repo = createStorageRepo()
    repo.saveQuiz({ ...SEED_QUIZ, id: 'q1', title: 'Quiz một', createdAt: 1, updatedAt: 1 })
    repo.saveQuiz({ ...SEED_QUIZ, id: 'q2', title: 'Quiz hai', createdAt: 2, updatedAt: 2 })
    repo.setActiveQuizId('q1')

    renderApp('/admin')
    const firstCard = screen.getByText('Quiz một').closest('div.rounded-2xl')
    expect(firstCard).not.toBeNull()
    await user.click(within(firstCard as HTMLElement).getByRole('button', { name: 'Xoá' }))
    const dialog = screen.getByText('Xoá quiz?').closest('dialog')
    expect(dialog).not.toBeNull()
    await user.click(within(dialog as HTMLElement).getByRole('button', { name: 'Xoá' }))

    expect(await screen.findByText('Đang chạy')).toBeInTheDocument()
    const active = createStorageRepo().getActiveQuizId()
    expect(active.ok && active.data).toBe('q2')
    expect(screen.queryByText('Quiz một')).not.toBeInTheDocument()
  })
})
