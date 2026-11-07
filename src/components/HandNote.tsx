import type { ReactNode } from 'react'

export function HandNote({
  children,
  rotate = '-3deg',
  className = '',
}: {
  children: ReactNode
  rotate?: string
  className?: string
}) {
  return (
    <span
      className={`inline-block font-hand text-lg leading-tight bg-sun border-2 border-ink rounded-[14px_18px_12px_20px] shadow-sticker px-3 py-1 ${className}`}
      style={{ transform: `rotate(${rotate})` }}
    >
      {children}
    </span>
  )
}
