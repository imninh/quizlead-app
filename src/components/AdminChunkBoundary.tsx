import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { failed: boolean }

/**
 * Bắt lỗi tải chunk admin sau khi redeploy. Không để trắng trang.
 */
export class AdminChunkBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Admin chunk error:', error, info)
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="mx-auto max-w-md space-y-4 text-center">
          <div className="rounded-[20px_26px_18px_24px] border-2 border-ink bg-white p-6 shadow-sticker">
            <p className="font-display text-2xl">Phiên bản mới đã có</p>
            <p className="mt-2 text-sm">Trang quản trị vừa được cập nhật. Bấm để tải lại và tiếp tục.</p>
            <button
              className="mt-4 min-h-[44px] rounded-[14px_18px_12px_20px] border-2 border-ink bg-sun px-4 py-2 font-semibold shadow-sticker"
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
