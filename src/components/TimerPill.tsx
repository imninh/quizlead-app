import { motion, useReducedMotion } from 'motion/react'

export function TimerPill({ seconds, total = 30 }: { seconds: number; total?: number }) {
  const reduced = useReducedMotion()
  const safeSeconds = Math.max(0, Math.min(total, seconds))
  const danger = safeSeconds <= 5
  const percent = Math.max(0, Math.min(100, (safeSeconds / total) * 100))
  return (
    <motion.div
      key={safeSeconds}
      role="timer"
      aria-label={`Còn ${safeSeconds} giây`}
      data-danger={danger}
      animate={danger && !reduced ? { x: [0, -2, 2, 0] } : { x: 0 }}
      transition={{ duration: 0.24 }}
      className={`inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white px-3 py-1 shadow-sticker ${
        danger ? 'text-alert' : 'text-ink'
      }`}
    >
      <span aria-hidden="true">⏱</span>
      <span className="font-display text-xl leading-none">{safeSeconds}s</span>
      <span className="h-2 w-16 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
        <span className={`block h-full rounded-full ${danger ? 'bg-alert' : 'bg-cobalt'}`} style={{ width: `${percent}%` }} />
      </span>
    </motion.div>
  )
}
