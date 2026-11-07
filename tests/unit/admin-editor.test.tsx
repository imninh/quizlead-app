// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { screen, within, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { preloadAdminRoutes, renderApp, resetStorage } from './test-utils'

function realQuestions() {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `real-${i}`,
    text: `Câu hỏi AI thật ${i + 1}?`,
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    explanation: 'Giải thích.',
  }))
}

describe('quiz editor', () => {
  beforeAll(preloadAdminRoutes)
  beforeEach(() => {
    resetStorage()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('renders new quiz page without crashing', async () => {
    renderApp('/admin/quiz/new')
    expect(await screen.findByRole('heading', { name: 'Tạo quiz' })).toBeInTheDocument()
    expect(screen.getByText('AI gợi ý câu hỏi')).toBeInTheDocument()
    expect(screen.queryByText('Có lỗi xảy ra')).not.toBeInTheDocument()
  })

  it('short title shows error', async () => {
    const user = userEvent.setup()
    renderApp('/admin/quiz/new')
    await user.type(screen.getByLabelText('Tiêu đề'), 'ab')
    await user.tab()
    expect(screen.getByText('Tiêu đề phải từ 3 đến 100 ký tự')).toBeInTheDocument()
  })

  it('duplicate options show error on the right field', async () => {
    const user = userEvent.setup()
    renderApp('/admin/quiz/new')
    await user.type(screen.getAllByLabelText('Câu hỏi')[0]!, 'Câu hỏi hợp lệ?')
    await user.type(screen.getAllByPlaceholderText('Đáp án A')[0]!, 'Giống nhau')
    await user.type(screen.getAllByPlaceholderText('Đáp án B')[0]!, 'Giống nhau')
    await user.type(screen.getAllByPlaceholderText('Đáp án C')[0]!, 'Khác một')
    await user.type(screen.getAllByPlaceholderText('Đáp án D')[0]!, 'Khác hai')
    expect(screen.getByText('Đáp án không được trùng nhau')).toBeInTheDocument()
  })

  it('fill sample then save adds quiz to list', async () => {
    const user = userEvent.setup()
    renderApp('/admin/quiz/new')
    await user.click(screen.getByRole('button', { name: 'Điền mẫu' }))
    await user.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByRole('heading', { name: 'Quiz' })).toBeInTheDocument()
    expect(screen.getByText('Quiz mẫu')).toBeInTheDocument()
  })

  it('AI mock fills 5 questions and shows mock label', async () => {
    const user = userEvent.setup()
    renderApp('/admin/quiz/new')
    await user.type(screen.getByLabelText('Chủ đề'), 'ẩm thực')
    await user.click(screen.getByRole('button', { name: 'Gợi ý AI' }))
    expect(await screen.findByDisplayValue('Phở là món ăn truyền thống của nước nào?', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getAllByText('AI gợi ý, hãy kiểm tra lại')).toHaveLength(5)
    expect(screen.getAllByText('Bản demo vòng loại - Dữ liệu mô phỏng AI').length).toBeGreaterThan(0)
  })

  it('AI inappropriate topic keeps form unchanged', async () => {
    const user = userEvent.setup()
    renderApp('/admin/quiz/new')
    await user.type(screen.getByLabelText('Tiêu đề'), 'Quiz giữ nguyên')
    await user.type(screen.getByLabelText('Chủ đề'), 'bạo lực')
    await user.click(screen.getByRole('button', { name: 'Gợi ý AI' }))
    expect(await screen.findByText('Chủ đề không phù hợp hoặc không phải chủ đề kiến thức. Hãy nhập một chủ đề như Ẩm thực Việt Nam', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByLabelText('Tiêu đề')).toHaveValue('Quiz giữ nguyên')
    expect(screen.getAllByLabelText('Câu hỏi')[0]).toHaveValue('')
  })

  it('cancel AI request keeps form unchanged', async () => {
    const user = userEvent.setup()
    renderApp('/admin/quiz/new')
    await user.type(screen.getByLabelText('Chủ đề'), 'ẩm thực')
    await user.click(screen.getByRole('button', { name: 'Gợi ý AI' }))
    await user.click(await screen.findByRole('button', { name: 'Huỷ' }))
    await new Promise((resolve) => setTimeout(resolve, 1400))
    expect(screen.queryByText('AI gợi ý, hãy kiểm tra lại')).not.toBeInTheDocument()
    expect(screen.getAllByLabelText('Câu hỏi')[0]).toHaveValue('')
  })

  it('leaving with unsaved changes asks confirmation', async () => {
    const user = userEvent.setup()
    renderApp('/admin/quiz/new')
    await user.type(screen.getByLabelText('Tiêu đề'), 'Quiz chưa lưu')
    await user.click(screen.getByRole('link', { name: 'Người chơi' }))
    expect(await screen.findByText('Rời trang?')).toBeInTheDocument()
  })

  it('real AI success shows model badge', async () => {
    vi.stubEnv('VITE_AI_MODE', 'real')
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          questions: realQuestions(),
          model: 'deepseek/deepseek-v4.1-flash',
          usage: { prompt_tokens: 100, completion_tokens: 200 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderApp('/admin/quiz/new')
    await user.type(screen.getByLabelText('Chủ đề'), 'Ẩm thực Việt Nam')
    await user.click(screen.getByRole('button', { name: 'Gợi ý AI' }))

    expect(await screen.findByText('Tạo bởi AI · deepseek/deepseek-v4.1-flash')).toBeInTheDocument()
    expect(screen.getAllByText('AI gợi ý, hãy kiểm tra lại')).toHaveLength(5)
    expect(fetchMock).toHaveBeenCalledWith('/api/generate-quiz', expect.objectContaining({ method: 'POST' }))
  })

  it('real AI failure offers mock button and does not auto switch', async () => {
    vi.stubEnv('VITE_AI_MODE', 'real')
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, code: 'UPSTREAM' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderApp('/admin/quiz/new')
    await user.type(screen.getByLabelText('Chủ đề'), 'Ẩm thực Việt Nam')
    await user.click(screen.getByRole('button', { name: 'Gợi ý AI' }))

    expect(await screen.findByText('AI đang bận. Thử lại sau.')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Câu hỏi')[0]).toHaveValue('')
    expect(screen.queryByText('Bản demo vòng loại - Dữ liệu mô phỏng AI')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dùng bộ câu hỏi mẫu (Mock)' }))
    expect(await screen.findByDisplayValue('Phở là món ăn truyền thống của nước nào?', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getAllByText('Bản demo vòng loại - Dữ liệu mô phỏng AI').length).toBeGreaterThan(0)
  })

  it('daily limit error still offers mock questions', async () => {
    vi.stubEnv('VITE_AI_MODE', 'real')
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, code: 'DAILY_LIMIT' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderApp('/admin/quiz/new')
    await user.type(screen.getByLabelText('Chủ đề'), 'Ẩm thực Việt Nam')
    await user.click(screen.getByRole('button', { name: 'Gợi ý AI' }))

    expect(await screen.findByText('AI đã dùng hết lượt hôm nay. Bạn vẫn có thể dùng bộ câu hỏi mẫu.')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Câu hỏi')[0]).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Dùng bộ câu hỏi mẫu (Mock)' }))
    expect(await screen.findByDisplayValue('Phở là món ăn truyền thống của nước nào?', {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it('title error is hidden until field is touched', async () => {
    const user = userEvent.setup()
    renderApp('/admin/quiz/new')
    expect(screen.queryByText('Tiêu đề phải từ 3 đến 100 ký tự')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Tiêu đề'), 'ab')
    expect(screen.queryByText('Tiêu đề phải từ 3 đến 100 ký tự')).not.toBeInTheDocument()
    await user.tab()
    expect(screen.getByText('Tiêu đề phải từ 3 đến 100 ký tự')).toBeInTheDocument()
  })

  it('offline disables AI button and offers mock', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    try {
      const user = userEvent.setup()
      renderApp('/admin/quiz/new')
      expect(screen.getByRole('button', { name: 'Gợi ý AI' })).toBeDisabled()
      expect(screen.getByText('Bạn đang offline. Vẫn có thể nhập tay hoặc dùng bộ câu hỏi mẫu (Mock)')).toBeInTheDocument()

      await user.type(screen.getByLabelText('Chủ đề'), 'ẩm thực')
      await user.click(screen.getByRole('button', { name: 'Dùng bộ câu hỏi mẫu (Mock)' }))
      expect(
        await screen.findByDisplayValue('Phở là món ăn truyền thống của nước nào?', {}, { timeout: 4000 }),
      ).toBeInTheDocument()
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    }
  })

  it('cancel during AI request returns to idle without error', async () => {
    const user = userEvent.setup()
    renderApp('/admin/quiz/new')
    await user.type(screen.getByLabelText('Chủ đề'), 'ẩm thực')
    await user.click(screen.getByRole('button', { name: 'Gợi ý AI' }))
    await user.click(await screen.findByRole('button', { name: 'Huỷ' }))
    await new Promise((resolve) => setTimeout(resolve, 1400))

    expect(screen.getByRole('button', { name: 'Gợi ý AI' })).toBeEnabled()
    expect(screen.queryByText(/Đã huỷ yêu cầu/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Lỗi mạng/)).not.toBeInTheDocument()
    expect(screen.queryByText('AI gợi ý, hãy kiểm tra lại')).not.toBeInTheDocument()
  })

  it('AI error shows retry and mock buttons', async () => {
    vi.stubEnv('VITE_AI_MODE', 'real')
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, code: 'UPSTREAM' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderApp('/admin/quiz/new')
    await user.type(screen.getByLabelText('Chủ đề'), 'Ẩm thực Việt Nam')
    await user.click(screen.getByRole('button', { name: 'Gợi ý AI' }))

    expect(await screen.findByText('AI đang bận. Thử lại sau.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Dùng bộ câu hỏi mẫu (Mock)' })).toBeInTheDocument()
  })

  it('rate limit retry button counts down from Retry-After', async () => {
    vi.useFakeTimers()
    try {
      vi.stubEnv('VITE_AI_MODE', 'real')
      const fetchMock = vi.fn(async () =>
        new Response(JSON.stringify({ ok: false, code: 'RATE_LIMIT' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '4' },
        }),
      )
      vi.stubGlobal('fetch', fetchMock)
      renderApp('/admin/quiz/new')
      fireEvent.change(screen.getByLabelText('Chủ đề'), { target: { value: 'Ẩm thực Việt Nam' } })
      fireEvent.click(screen.getByRole('button', { name: 'Gợi ý AI' }))
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })

      const first = screen.getAllByRole('button', { name: 'Thử lại sau 4s' })
      expect(first.length).toBeGreaterThan(0)
      first.forEach((button) => expect(button).toBeDisabled())
      act(() => { vi.advanceTimersByTime(1000) })
      const second = screen.getAllByRole('button', { name: 'Thử lại sau 3s' })
      expect(second.length).toBeGreaterThan(0)
      second.forEach((button) => expect(button).toBeDisabled())
    } finally {
      vi.useRealTimers()
    }
  })

  it('applying AI result over typed questions asks for confirmation', async () => {
    const user = userEvent.setup()
    renderApp('/admin/quiz/new')
    await user.type(screen.getAllByLabelText('Câu hỏi')[0]!, 'Câu hỏi tôi đã nhập?')
    await user.type(screen.getByLabelText('Chủ đề'), 'ẩm thực')
    await user.click(screen.getByRole('button', { name: 'Gợi ý AI' }))

    const dialog = await screen.findByRole('dialog', {}, { timeout: 4000 })
    expect(within(dialog).getByText('Thay 5 câu hiện tại bằng câu hỏi AI gợi ý?')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Câu hỏi')[0]).toHaveValue('Câu hỏi tôi đã nhập?')

    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận' }))
    expect(
      await screen.findByDisplayValue('Phở là món ăn truyền thống của nước nào?', {}, { timeout: 4000 }),
    ).toBeInTheDocument()
  })
})
