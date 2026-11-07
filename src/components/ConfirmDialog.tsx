/* oxlint-disable-file react/set-state-in-effect, react-hooks/exhaustive-deps, react/purity */
import { useEffect, useRef, useState, type ReactNode } from 'react'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  requireText?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  danger = false,
  requireText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const [typed, setTyped] = useState('')

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement | null
      if (typeof dialog.showModal === 'function' && !dialog.open) {
        dialog.showModal()
      } else {
        dialog.setAttribute('open', '')
      }
      cancelRef.current?.focus()
      // oxlint-disable-next-line react/set-state-in-effect
      setTyped('')
    } else {
      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close()
      }
      dialog.removeAttribute('open')
      previousFocus.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  const canConfirm = requireText ? typed === requireText : true

  return (
    <dialog ref={dialogRef} className="rounded-2xl p-0 backdrop:bg-black/40">
      <div className="p-5 space-y-3 max-w-md">
        <h2 className="font-display text-2xl">{title}</h2>
        <p className="text-sm">{message}</p>
        {requireText ? (
          <input
            aria-label={`Gõ ${requireText} để xác nhận`}
            className="w-full border-2 border-ink rounded-xl px-3 py-2"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={`Gõ ${requireText} để xác nhận`}
          />
        ) : null}
        <div className="flex gap-3 justify-end">
          <button ref={cancelRef} className="px-4 py-2 rounded-xl border-2 border-ink" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`px-4 py-2 rounded-xl ${danger ? 'bg-alert text-white' : 'bg-sun text-ink'} font-semibold`}
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="inline-block text-xs px-2 py-1 rounded-full border border-ink/20 bg-white">{children}</span>
}
