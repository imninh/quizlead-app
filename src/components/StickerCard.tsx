import type { ReactNode } from 'react'

type StickerCardProps = {
  children: ReactNode
  className?: string
  tone?: 'paper' | 'white' | 'mint' | 'alert' | 'cobalt' | 'sun' | 'sky' | 'bubble'
}

const toneClass: Record<NonNullable<StickerCardProps['tone']>, string> = {
  paper: 'bg-paper/95',
  white: 'bg-white/95',
  mint: 'bg-mint/20',
  alert: 'bg-alert/10',
  cobalt: 'bg-cobalt/10',
  sun: 'bg-sun/30',
  sky: 'bg-sky/35',
  bubble: 'bg-bubble/35',
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
