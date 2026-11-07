import { Doodle } from './Doodle'

export function ErrorBanner({ message, large = false }: { message: string; large?: boolean }) {
  return (
    <div
      role="alert"
      className={`flex items-center gap-3 rounded-[18px_22px_16px_24px] border-2 border-ink bg-alert text-white shadow-sticker ${
        large ? 'p-5 text-lg' : 'px-4 py-2'
      }`}
    >
      <Doodle kind="burst" size={large ? 40 : 24} color="white" className="shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
    </div>
  )
}
