import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router-dom'
import { CharacterImage } from './CharacterImage'

export function ErrorBoundary() {
  const error = useRouteError()

  useEffect(() => {
    console.error('Route error:', error)
  }, [error])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4 text-ink">
      <div role="alert" className="w-full max-w-md space-y-4 rounded-[20px_26px_18px_24px] border-2 border-ink bg-white p-6 text-center shadow-sticker">
        <CharacterImage name="muc-tangled" className="mx-auto h-32 w-auto" width={220} height={220} sizes="128px" />
        <h1 className="font-display text-3xl">Có lỗi xảy ra</h1>
        <p className="text-sm">Trang này gặp sự cố. Bạn thử tải lại hoặc quay về trang đầu.</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <button className="min-h-[44px] rounded-[14px_18px_12px_20px] border-2 border-ink bg-sun px-4 py-2 font-semibold shadow-sticker" onClick={() => window.location.reload()}>
            Tải lại
          </button>
          <Link className="inline-flex min-h-[44px] items-center justify-center rounded-[14px_18px_12px_20px] border-2 border-ink bg-white px-4 py-2 shadow-sticker" to="/">
            Về trang đầu
          </Link>
        </div>
      </div>
    </div>
  )
}
