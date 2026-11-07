/* oxlint-disable-file react/only-export-components */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastState = { message: string; id: number } | null

type ToastContextValue = {
  show: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null)

  const show = useCallback((message: string) => {
    setToast({ message, id: Date.now() })
    window.setTimeout(() => setToast(null), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        {toast ? (
          <div className="bg-ink text-white px-4 py-2 rounded-xl shadow-lg">{toast.message}</div>
        ) : null}
      </div>
    </ToastContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('ToastProvider missing')
  return ctx
}
