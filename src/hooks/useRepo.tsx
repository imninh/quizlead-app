/* oxlint-disable-file react/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createStorageRepo, getSafeStorage } from '../services/storage'
import { STORAGE_PREFIX } from '../domain/constants'

type Repo = ReturnType<typeof createStorageRepo>

type RepoContextValue = {
  repo: Repo
  version: number
  refresh: () => void
}

const RepoContext = createContext<RepoContextValue | null>(null)

export function RepoProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0)
  const repo = useMemo(() => {
    const safe = getSafeStorage()
    const created = createStorageRepo(safe.storage, undefined, safe.persistent)
    created.ensureSeed()
    return created
  }, [])

  // Quét dữ liệu hỏng sau khi mount (tránh tác dụng phụ trong render, đặc biệt với StrictMode).
  useEffect(() => {
    const notices = repo.scanAll()
    // oxlint-disable-next-line react/set-state-in-effect
    if (notices.length > 0) setVersion((value) => value + 1)
  }, [repo])

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(STORAGE_PREFIX)) {
        setVersion((value) => value + 1)
      }
    }
    const changed = () => setVersion((value) => value + 1)
    window.addEventListener('storage', handler)
    window.addEventListener('quizlead:changed', changed)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('quizlead:changed', changed)
    }
  }, [])

  const value = useMemo<RepoContextValue>(
    () => ({ repo, version, refresh: () => setVersion((current) => current + 1) }),
    [repo, version],
  )

  return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useRepo(): Repo {
  const ctx = useContext(RepoContext)
  if (!ctx) throw new Error('RepoProvider missing')
  return ctx.repo
}

/** Tăng mỗi khi tab khác ghi localStorage; dùng làm dependency để đọc lại dữ liệu. */
// oxlint-disable-next-line react/only-export-components
export function useRepoVersion(): number {
  const ctx = useContext(RepoContext)
  if (!ctx) throw new Error('RepoProvider missing')
  return ctx.version
}

// oxlint-disable-next-line react/only-export-components
export function useRepoRefresh(): () => void {
  const ctx = useContext(RepoContext)
  if (!ctx) throw new Error('RepoProvider missing')
  return ctx.refresh
}
