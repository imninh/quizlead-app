import { MSG } from '../domain/messages'

type PosterBackdropProps = {
  /** Chữ khổng lồ phía sau nhân vật, vd "QUIZ!", "WIN!", "GG!". */
  word: string
  align?: 'left' | 'right'
  /** Tắt băng dính khi trang có nội dung sát mép (trang kết quả). */
  showTapes?: boolean
}

/**
 * Lớp nền "poster đường phố" chỉ hiện từ 1024px.
 * Thuần CSS/SVG, không ảnh mới, không blur khối lớn; luôn nằm dưới nội dung.
 */
export function PosterBackdrop({ word, align = 'right', showTapes = true }: PosterBackdropProps) {
  const side = align === 'right' ? 'right-[-1%]' : 'left-[-1%]'
  const wordRotate = align === 'right' ? 'rotate-6' : '-rotate-6'
  const brushSide = align === 'right' ? 'right-[2%]' : 'left-[2%]'

  return (
    <div
      aria-hidden="true"
      data-poster-backdrop=""
      className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden lg:block"
    >
      <div className="poster-grain absolute inset-0" />

      <div className="poster-halftone absolute -left-12 -top-12 h-72 w-72 opacity-40" />
      <div className="poster-halftone absolute -bottom-16 -right-12 h-80 w-80 opacity-30" />

      <span className={`poster-big-word ${wordRotate} absolute top-[14%] ${side} font-display leading-none`}>
        {word}
      </span>

      <svg
        className={`absolute top-[16%] ${brushSide} h-[58%] w-[44%] opacity-80`}
        viewBox="0 0 400 500"
        fill="none"
        preserveAspectRatio="none"
      >
        <path
          d="M42 268c-18-58 17-133 88-164 78-35 171-24 212 31 42 57 23 141-34 198-56 57-145 78-209 45-30-16-48-62-57-110Z"
          fill="var(--color-sun)"
          opacity="0.5"
        />
        <path
          d="M80 371c66 40 176 35 239-16"
          stroke="var(--color-sky)"
          strokeWidth="18"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>

      {showTapes ? (
        <>
          <span className="poster-tape right-[4%] top-[16%] rotate-3 bg-bubble/60" />
          <span className="poster-tape right-[2%] bottom-[28%] -rotate-2 bg-sky/60" />
        </>
      ) : null}
    </div>
  )
}

/** Dải băng chữ chạy ở đáy hero; đứng yên khi người dùng giảm chuyển động. */
/** Một nửa dải: cụm chữ lặp đủ dày để phủ kín khung 1400px. */
function TapeHalf({ text, star }: { text: string; star: string }) {
  return (
    <span className="flex shrink-0 items-center">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="flex shrink-0 items-center gap-6 whitespace-nowrap pr-6">
          <span>{text}</span>
          <span aria-hidden="true">{star}</span>
        </span>
      ))}
    </span>
  )
}

export function PosterMarquee({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const still = reducedMotion ? { animation: 'none' } : undefined
  return (
    <div className="home-marquee pointer-events-none relative z-10 mt-8 hidden h-28 overflow-hidden lg:block" aria-hidden="true">
      {/* Dải đen phía sau, chạy ngược chiều */}
      <div className="absolute inset-x-[-4%] top-1/2 -translate-y-1/2 rotate-[2.5deg]">
        <div
          data-motion={reducedMotion ? 'static' : 'run'}
          className="poster-marquee-track poster-marquee-track--reverse flex w-max border-y-2 border-ink bg-ink py-1.5 font-display text-base tracking-[0.2em] text-sun"
          style={still}
        >
          <TapeHalf text={MSG.marqueeTapeAlt} star="✦" />
          <TapeHalf text={MSG.marqueeTapeAlt} star="✦" />
        </div>
      </div>
      {/* Dải vàng phía trước */}
      <div className="absolute inset-x-[-4%] top-1/2 -translate-y-1/2 -rotate-3">
        <div
          data-poster-marquee=""
          data-motion={reducedMotion ? 'static' : 'run'}
          className="poster-marquee-track flex w-max border-y-[3px] border-ink bg-sun py-2.5 font-display text-2xl tracking-wider text-ink shadow-[0_4px_0_var(--color-ink)]"
          style={still}
        >
          <TapeHalf text={MSG.marqueeTape} star="★" />
          <TapeHalf text={MSG.marqueeTape} star="★" />
        </div>
      </div>
    </div>
  )
}
