import { useEffect, useState } from 'react'

function format(value: number): string {
  return Math.round(value).toLocaleString('vi-VN')
}

export function CountUp({
  value,
  duration = 1200,
  reducedMotion = false,
  className = '',
}: {
  value: number
  duration?: number
  reducedMotion?: boolean
  className?: string
}) {
  const [display, setDisplay] = useState(reducedMotion ? value : 0)

  useEffect(() => {
    if (reducedMotion) {
      // oxlint-disable-next-line react/set-state-in-effect
      setDisplay(value)
      return
    }
    let frame = 0
    const started = performance.now()
    const tick = (time: number) => {
      const progress = Math.min(1, (time - started) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(value * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
      else setDisplay(value)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration, reducedMotion])

  return (
    <span className={className}>
      <span aria-hidden="true">{format(display)}</span>
      <span className="sr-only" aria-live="polite">Điểm {format(value)}</span>
    </span>
  )
}
