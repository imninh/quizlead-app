// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { preloadAdminRoutes, renderApp, resetStorage } from './test-utils'
import { createStorageRepo } from '../../src/services/storage'

describe('settings', () => {
  beforeAll(preloadAdminRoutes)
  beforeEach(() => {
    resetStorage()
  })

  it('rejects non facebook url', async () => {
    const user = userEvent.setup()
    renderApp('/admin/settings')
    const link = await screen.findByLabelText('Link fanpage (tuỳ chọn)')
    await user.clear(link)
    await user.type(link, 'https://example.com')
    await user.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(screen.getByText('Link phải là https:// facebook.com hoặc fb.com')).toBeInTheDocument()
  })

  it('accepts facebook url', async () => {
    const user = userEvent.setup()
    renderApp('/admin/settings')
    const link = await screen.findByLabelText('Link fanpage (tuỳ chọn)')
    await user.clear(link)
    await user.type(link, 'https://facebook.com/fptpoly')
    await user.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByText('Đã lưu cài đặt')).toBeInTheDocument()
    const saved = createStorageRepo().getSettings()
    expect(saved.ok && saved.data.fanpageUrl).toBe('https://facebook.com/fptpoly')
  })
})

describe('admin settings', () => {
  beforeEach(() => {
    resetStorage()
  })

  it('backup list can download and delete a backup', async () => {
    localStorage.setItem('quizlead:v1:backup:leads:1000', '{"broken":true}')
    const createObjectUrl = vi.fn(() => 'blob:test')
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectUrl, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    try {
      const user = userEvent.setup()
      renderApp('/admin/settings')
      expect(await screen.findByText('Danh sách khách hàng')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Tải về (.json)' }))
      expect(createObjectUrl).toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'Xoá' }))
      const dialog = screen.getByText('Xoá bản sao lưu?').closest('dialog')
      expect(dialog).not.toBeNull()
      await user.click(within(dialog as HTMLElement).getByRole('button', { name: 'Xoá' }))

      expect(await screen.findByText('Chưa có bản sao lưu nào.')).toBeInTheDocument()
      expect(localStorage.getItem('quizlead:v1:backup:leads:1000')).toBeNull()
    } finally {
      clickSpy.mockRestore()
    }
  })

  it('restore sample quiz button adds a quiz', async () => {
    const user = userEvent.setup()
    renderApp('/admin/settings')
    const before = createStorageRepo().getQuizzes()
    expect(before.ok && before.data).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Khôi phục quiz mẫu' }))
    expect(await screen.findByText('Đã thêm lại quiz mẫu')).toBeInTheDocument()

    const after = createStorageRepo().getQuizzes()
    expect(after.ok && after.data).toHaveLength(2)
  })
})
