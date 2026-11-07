// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { preloadAdminRoutes, renderApp, resetStorage } from './test-utils'
import { createStorageRepo } from '../../src/services/storage'
import { SEED_QUIZ } from '../../src/domain/seed'
import { leadsToCsv } from '../../src/domain/csv'

vi.mock('../../src/domain/csv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/domain/csv')>()
  return { ...actual, leadsToCsv: vi.fn(actual.leadsToCsv) }
})

function seedLeads() {
  const repo = createStorageRepo()
  repo.saveQuiz({ ...SEED_QUIZ, id: 'q1', title: 'Quiz một', createdAt: 1, updatedAt: 1 })
  repo.saveLead({
    id: 'l1',
    quizId: 'q1',
    attemptId: 'a1',
    name: 'Nguyễn Văn A',
    phone: '0912345678',
    consent: true,
    totalScore: 100,
    correctCount: 1,
    totalTimeMs: 31234,
    createdAt: Date.UTC(2026, 9, 25, 12, 8),
  })
  repo.saveLead({
    id: 'l2',
    quizId: 'q1',
    attemptId: 'a2',
    name: 'Trần Thị B',
    phone: '0987654321',
    consent: true,
    totalScore: 200,
    correctCount: 2,
    totalTimeMs: 2000,
    createdAt: Date.UTC(2026, 9, 25, 13, 8),
  })
}

describe('leads', () => {
  beforeAll(preloadAdminRoutes)
  beforeEach(() => {
    resetStorage()
    vi.clearAllMocks()
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:test'), configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('search nguyen finds Nguyễn', async () => {
    seedLeads()
    const user = userEvent.setup()
    renderApp('/admin/leads')
    await user.type(screen.getByLabelText('Tìm tên hoặc SĐT'), 'nguyen')
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.queryByText('Trần Thị B')).not.toBeInTheDocument()
  })

  it('search 345 finds phone', async () => {
    seedLeads()
    const user = userEvent.setup()
    renderApp('/admin/leads')
    await user.type(screen.getByLabelText('Tìm tên hoặc SĐT'), '345')
    expect(screen.getByText('0912345678')).toBeInTheDocument()
    expect(screen.queryByText('0987654321')).not.toBeInTheDocument()
  })

  it('export csv uses filtered leads', async () => {
    seedLeads()
    const user = userEvent.setup()
    renderApp('/admin/leads')
    await user.type(screen.getByLabelText('Tìm tên hoặc SĐT'), 'nguyen')
    await user.click(screen.getByRole('button', { name: 'Xuất CSV' }))
    expect(leadsToCsv).toHaveBeenCalledTimes(1)
    const [exported] = vi.mocked(leadsToCsv).mock.calls[0]!
    expect(exported).toHaveLength(1)
    expect(exported[0]!.name).toBe('Nguyễn Văn A')
  })

  it('delete all requires typing XOA', async () => {
    seedLeads()
    const user = userEvent.setup()
    renderApp('/admin/leads')
    await user.click(screen.getByRole('button', { name: 'Xoá tất cả' }))
    const dialog = screen.getByText('Xoá tất cả lead?').closest('dialog')
    expect(dialog).not.toBeNull()
    const confirm = within(dialog as HTMLElement).getByRole('button', { name: 'Xoá tất cả' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog as HTMLElement).getByLabelText('Gõ XOA để xác nhận'), 'XOA')
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    expect(await screen.findByText('Chưa có khách hàng.')).toBeInTheDocument()
  })

  it('deleted quiz leads can still be filtered', async () => {
    seedLeads()
    const repo = createStorageRepo()
    repo.saveLead({
      id: 'l3',
      quizId: 'quiz-da-xoa',
      attemptId: 'a3',
      name: 'Lê Văn C',
      phone: '0900000000',
      consent: true,
      totalScore: 300,
      correctCount: 3,
      totalTimeMs: 3000,
      createdAt: Date.UTC(2026, 9, 25, 14, 8),
    })
    const user = userEvent.setup()
    renderApp('/admin/leads')
    await user.selectOptions(screen.getByLabelText('Lọc theo quiz'), 'quiz-da-xoa')

    expect(screen.getByText('Lê Văn C')).toBeInTheDocument()
    expect(screen.queryByText('Nguyễn Văn A')).not.toBeInTheDocument()
    expect(screen.getAllByText('(quiz đã xoá)').length).toBeGreaterThan(0)
  })
})
