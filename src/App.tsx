import { useMemo, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useRepo, useRepoVersion } from './hooks/useRepo'
import { ErrorBanner } from './components/ErrorBanner'
import { BootSplash } from './components/BootSplash'
import { Doodle } from './components/Doodle'
import { MSG } from './domain/messages'

export default function App() {
  const repo = useRepo()
  const version = useRepoVersion()
  const location = useLocation()
  const [dismissed, setDismissed] = useState<string[]>([])

  const notices = useMemo(() => {
    // version buộc tính lại khi tab khác ghi localStorage.
    void version
    return repo.getRecoveryNotices().filter((notice) => !dismissed.includes(notice.backupKey))
  }, [repo, version, dismissed])

  const warning = useMemo(() => {
    void version
    if (!repo.persistent) return MSG.storageUnavailable
    return null
  }, [repo, version])

  const settingsResult = repo.getSettings()
  const fanpage = settingsResult.ok ? settingsResult.data.fanpageName : 'QuizLead'
  const wide = location.pathname.startsWith('/admin')
  const posterPage = location.pathname === '/' || location.pathname.startsWith('/result/')
  const frame = wide ? 'max-w-[1536px]' : posterPage ? 'max-w-6xl lg:max-w-[1400px]' : 'max-w-6xl'

  return (
    <div className="min-h-dvh bg-transparent text-ink">
      <BootSplash />
      <header className="sticky top-0 z-30 border-b-2 border-ink/15 bg-paper">
        <div className={`mx-auto flex ${frame} items-center justify-between px-4 py-2`}>
          <Link to="/" className="flex min-h-[44px] items-center gap-2 font-display text-2xl tracking-wide">
            <img src="/logo-mark.png" srcSet="/logo-mark.png 1x, /logo-mark@2x.png 2x" width={34} height={34} alt="" aria-hidden="true" className="size-[34px]" />
            <span className="display-tilt">QuizLead</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden font-medium sm:inline">{fanpage}</span>
            <Link
              to={location.pathname.startsWith('/admin') ? '/' : '/admin'}
              className="inline-flex min-h-[44px] items-center rounded-[14px_18px_12px_20px] border-2 border-ink bg-white/80 px-3 py-1 font-semibold shadow-sticker"
            >
              {location.pathname.startsWith('/admin') ? 'Người chơi' : 'Quản trị'}
            </Link>
          </div>
        </div>
      </header>
      <div className={`mx-auto ${frame} space-y-2 px-4 pt-3`}>
        {notices.map((notice) => (
          <div key={notice.backupKey} role="alert" className="flex items-start gap-3 rounded-[18px_22px_16px_24px] border-2 border-ink bg-alert px-4 py-2 text-white shadow-sticker">
            <Doodle kind="burst" size={24} color="white" className="mt-0.5 shrink-0" />
            <span className="flex-1">{MSG.recoveryBanner(notice.label)}</span>
            <button
              className="shrink-0 underline"
              aria-label={`Đóng cảnh báo ${notice.label}`}
              onClick={() => setDismissed((current) => [...current, notice.backupKey])}
            >
              Đóng
            </button>
          </div>
        ))}
        {warning ? <ErrorBanner message={warning} /> : null}
      </div>
      <main className={`mx-auto ${frame} px-4 py-6 safe-bottom`}>
        <Outlet />
      </main>
    </div>
  )
}
