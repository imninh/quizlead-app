import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

/**
 * Lưới an toàn cuối cùng: bọc toàn bộ app, kể cả RepoProvider/ToastProvider.
 * Không phụ thuộc repo hay router để không thể tự gây lỗi.
 */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Root error:', error, info)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-paper text-ink flex items-center justify-center px-4">
          <div role="alert" className="max-w-md w-full bg-white border-2 border-ink rounded-2xl p-6 space-y-4 text-center">
            <h1 className="font-display text-3xl">Có lỗi xảy ra</h1>
            <p className="text-sm">Ứng dụng gặp sự cố ngoài dự kiến. Bạn thử tải lại trang nhé.</p>
            <button
              className="bg-sun text-ink font-semibold rounded-xl px-4 py-2 min-h-[44px]"
              onClick={() => window.location.reload()}
            >
              Tải lại
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
