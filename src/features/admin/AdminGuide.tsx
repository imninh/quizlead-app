import { useEffect, useRef } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { CharacterImage } from '../../components/CharacterImage'
import { Doodle } from '../../components/Doodle'
import { HandNote } from '../../components/HandNote'

type Step = { title: string; body: string; where: string; tone: string; rotate: string }

// Mỗi bước là một nhãn dán: số to kiểu poster + tên nút đúng như trên giao diện.
const STEPS: Step[] = [
  {
    title: 'Tạo quiz',
    where: 'Quiz → + Tạo quiz mới',
    body: 'Tự nhập 5 câu, hoặc gõ chủ đề rồi bấm “Gợi ý AI” (khoảng 15 giây). AI chỉ gợi ý: đọc lại, sửa nếu cần rồi bấm Lưu.',
    tone: 'bg-sun',
    rotate: '-1.2deg',
  },
  {
    title: 'Đặt làm đang chạy',
    where: 'Quiz → Đặt làm đang chạy',
    body: 'Quiz này sẽ hiện ở trang chủ: ai mở web là bấm “Bắt đầu chơi” được ngay.',
    tone: 'bg-mint',
    rotate: '0.8deg',
  },
  {
    title: 'Xuất bản & gửi link',
    where: 'Quiz → Xuất bản → Copy link chơi',
    body: 'Đưa quiz lên máy chủ, có link /q/… chơi được trên mọi máy và điểm lên bảng xếp hạng chung. Cần passcode.',
    tone: 'bg-sky',
    rotate: '-0.6deg',
  },
  {
    title: 'Cho AI chạy lại',
    where: 'Quiz → Cho AI chạy lại',
    body: 'Sau khi sửa câu hỏi, cho đối thủ “Trùm” chơi lại để người chơi có đối thủ đua cùng bộ câu mới.',
    tone: 'bg-bubble',
    rotate: '1deg',
  },
  {
    title: 'Xem khách hàng',
    where: 'Khách hàng',
    body: 'Danh sách người chơi đã để lại tên và số điện thoại: tìm kiếm, lọc theo quiz, bấm “Xuất CSV” để tải về.',
    tone: 'bg-white',
    rotate: '-0.9deg',
  },
  {
    title: 'Passcode để làm gì?',
    where: 'Cài đặt → Passcode',
    body: 'Passcode: 88888888. Chìa khoá chủ fanpage cho 2 việc chạm vào máy chủ chung: Xuất bản quiz và xoá dòng trên bảng xếp hạng chung. Sai 5 lần sẽ khoá 15 phút.',
    tone: 'bg-[color-mix(in_srgb,var(--color-cobalt)_14%,var(--color-paper))]',
    rotate: '0.5deg',
  },
]

export function AdminGuideButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover-lift inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-[18px_14px_20px_12px] border-2 border-ink bg-sky px-3 py-2 font-semibold shadow-sticker transition focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
    >
      <HelpCircle aria-hidden size={20} strokeWidth={2.5} />
      <span className="sr-only sm:not-sr-only">Hướng dẫn</span>
    </button>
  )
}

export function AdminGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal()
      else dialog.setAttribute('open', '')
      closeRef.current?.focus()
    } else {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close()
      dialog.removeAttribute('open')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="admin-guide-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="m-auto w-[min(100%-2rem,46rem)] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-ink/55"
    >
      {open ? (
        <div className="guide-pop relative max-h-[88dvh] overflow-y-auto rounded-[22px_26px_20px_28px] border-2 border-ink bg-paper shadow-[6px_6px_0_var(--color-ink)]">
          <header className="relative overflow-hidden border-b-2 border-ink bg-sun px-5 pb-4 pt-5 sm:pr-40">
            <h2 id="admin-guide-title" className="flex items-center gap-2 font-display text-4xl leading-[1.06] tracking-wide sm:text-5xl">
              <Doodle kind="star" size={28} color="var(--color-ink)" />
              Hướng dẫn nhanh
            </h2>
            <p className="mt-1 max-w-md text-sm">6 bước để có minigame chạy trên fanpage và thu khách hàng.</p>
            <div className="pointer-events-none absolute bottom-0 right-16 top-2 hidden sm:block">
              <CharacterImage name="mi-point-up" width={96} height={144} sizes="96px" className="h-full w-auto object-contain object-bottom" />
            </div>
            <button
              ref={closeRef}
              type="button"
              aria-label="Đóng hướng dẫn"
              onClick={onClose}
              className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-white shadow-sticker transition hover:-translate-y-0.5"
            >
              <X aria-hidden size={20} strokeWidth={2.75} />
            </button>
          </header>

          <ol className="grid gap-4 p-5 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className={`guide-step relative rounded-[16px_20px_14px_22px] border-2 border-ink p-4 pl-14 shadow-sticker ${step.tone}`}
                style={{ transform: `rotate(${step.rotate})`, animationDelay: `${80 + index * 60}ms` }}
              >
                <span
                  aria-hidden
                  className="absolute -left-3 -top-3 inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-ink font-display text-2xl text-sun"
                >
                  {index + 1}
                </span>
                <h3 className="font-display text-2xl leading-[1.06] tracking-wide">{step.title}</h3>
                <p className="mt-0.5 inline-block rounded-md bg-white/80 px-1.5 font-hand text-base">{step.where}</p>
                <p className="mt-1.5 text-sm leading-snug">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-center">
            <HandNote rotate="-2deg" className="self-start">
              Lưu ý!
            </HandNote>
            <p className="text-sm">
              Quiz và danh sách khách hàng lưu <strong>trong trình duyệt này</strong>. Mở tab ẩn danh hay máy khác sẽ không thấy.
              Muốn người khác chơi, hãy <strong>Xuất bản</strong> rồi gửi link.
            </p>
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
