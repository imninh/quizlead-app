import type { ReactNode } from 'react'
import { StickerCard } from './StickerCard'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <StickerCard className={className}>{children}</StickerCard>
}
