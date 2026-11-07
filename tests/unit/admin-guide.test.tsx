// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { preloadAdminRoutes, renderApp, resetStorage } from './test-utils'

describe('admin guide', () => {
  beforeAll(preloadAdminRoutes)
  beforeEach(() => {
    resetStorage()
  })

  it('opens a step-by-step guide that explains publishing, passcode and local storage, then closes', async () => {
    const user = userEvent.setup()
    renderApp('/admin')
    await user.click(screen.getByRole('button', { name: 'Hướng dẫn' }))

    const title = await screen.findByRole('heading', { name: 'Hướng dẫn nhanh' })
    const dialog = title.closest('dialog') as HTMLElement
    expect(dialog).toHaveAttribute('open')
    const steps = within(dialog).getAllByRole('listitem')
    expect(steps).toHaveLength(6)
    expect(within(dialog).getByText('Xuất bản & gửi link')).toBeInTheDocument()
    expect(within(dialog).getByText('Passcode để làm gì?')).toBeInTheDocument()
    expect(within(dialog).getByText(/trong trình duyệt này/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Đóng hướng dẫn' }))
    expect(dialog).not.toHaveAttribute('open')
  })

  it('is available on every admin tab', async () => {
    renderApp('/admin/leads')
    expect(await screen.findByRole('button', { name: 'Hướng dẫn' })).toBeInTheDocument()
  })
})
