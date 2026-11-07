import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { HandNote } from './HandNote'

const PRELOAD = ['/assets/mi-hero-jump@2x.webp', '/assets/mi-point-up@2x.webp']

export function BootSplash() {
  const reduced = useReducedMotion()
  const [visible, setVisible] = useState(true)
  const testMode = import.meta.env.MODE === 'test'

  useEffect(() => {
    if (testMode) return
    for (const src of PRELOAD) {
      const image = new Image()
      image.src = src
    }
    const timeout = window.setTimeout(() => setVisible(false), reduced ? 180 : 1400)
    return () => window.clearTimeout(timeout)
  }, [reduced, testMode])

  if (testMode || !visible) return null

  return (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-paper"
    >
      <svg viewBox="0 0 120 120" className="size-28" fill="none" stroke="var(--color-ink)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <motion.path
          d="M60 12 74 45 109 48 82 71 91 105 60 84 29 105 38 71 11 48 46 45Z"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduced ? 0.12 : 1, ease: 'easeInOut' }}
        />
      </svg>
      <HandNote rotate="-2deg">Đang vẽ…</HandNote>
    </motion.div>
  )
}
