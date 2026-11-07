// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ErrorBoundary } from '../../src/components/ErrorBoundary'

function ThrowingPage(): never {
  throw new Error('boom')
}

describe('error boundary', () => {
  it('shows friendly error screen when a page throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = createMemoryRouter(
      [{ path: '/boom', element: <ThrowingPage />, errorElement: <ErrorBoundary /> }],
      { initialEntries: ['/boom'] },
    )
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('Có lỗi xảy ra')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tải lại' })).toBeInTheDocument()
  })
})
