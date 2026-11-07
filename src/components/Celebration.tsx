import { useEffect } from 'react'

export function Celebration({ active, reduced }: { active: boolean; reduced: boolean }) {
  useEffect(() => {
    if (!active || reduced) return
    let cancelled = false
    void import('canvas-confetti')
      .then(({ default: confetti }) => {
        if (cancelled) return
        confetti({
          particleCount: 120,
          spread: 72,
          startVelocity: 38,
          origin: { y: 0.62 },
          disableForReducedMotion: true,
        })
      })
      .catch(() => {
        // Không có confetti cũng không được làm hỏng màn chơi.
      })
    return () => {
      cancelled = true
    }
  }, [active, reduced])

  return <span data-celebration={active && !reduced ? 'on' : 'off'} className="sr-only" />
}
