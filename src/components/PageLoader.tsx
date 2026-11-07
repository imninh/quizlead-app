import { HandNote } from './HandNote'

export function PageLoader() {
  return (
    <div className="flex min-h-[40dvh] items-center justify-center">
      <HandNote rotate="-2deg">Đang tải…</HandNote>
    </div>
  )
}
