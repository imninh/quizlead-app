import type { ReactNode } from 'react'

type StickerCardProps = {
  children: ReactNode
  className?: string
  tone?: 'paper' | 'white' | 'mint' | 'alert' | 'cobalt' | 'sun' | 'sky' | 'bubble'
}

// Màu pha sẵn với nền giấy để thẻ đục: không lộ hình nền poster phía sau chữ.
const toneClass: Record<NonNullable<StickerCardProps['tone']>, string> = {
  paper: 'bg-paper/95',
  white: 'bg-white/95',
  mint: 'bg-[color-mix(in_srgb,var(--color-mint)_20%,var(--color-paper))]',
  alert: 'bg-[color-mix(in_srgb,var(--color-alert)_10%,var(--color-paper))]',
  cobalt: 'bg-[color-mix(in_srgb,var(--color-cobalt)_10%,var(--color-paper))]',
  sun: 'bg-[color-mix(in_srgb,var(--color-sun)_30%,var(--color-paper))]',
  sky: 'bg-[color-mix(in_srgb,var(--color-sky)_35%,var(--color-paper))]',
  bubble: 'bg-[color-mix(in_srgb,var(--color-bubble)_35%,var(--color-paper))]',
}

export function StickerCard({ children, className = '', tone = 'white' }: StickerCardProps) {
  return (
    <div
      className={`${toneClass[tone]} rounded-2xl rounded-[18px_22px_16px_24px] border-2 border-ink shadow-sticker p-4 ${className}`}
    >
      {children}
    </div>
  )
}
