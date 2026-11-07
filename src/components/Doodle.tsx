export type DoodleKind = 'star' | 'crown' | 'arrow' | 'swirl' | 'smiley' | 'burst'

export function Doodle({
  kind,
  color = 'var(--color-ink)',
  size = 32,
  className = '',
}: {
  kind: DoodleKind
  color?: string
  size?: number
  className?: string
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 48 48',
    fill: 'none',
    stroke: color,
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    className,
    'data-doodle': kind,
  }

  if (kind === 'star') {
    return (
      <svg {...common}>
        <path d="m24 5 5 12 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1 5-12Z" fill={color} stroke="none" />
      </svg>
    )
  }
  if (kind === 'crown') {
    return (
      <svg {...common}>
        <path d="M7 37h34M9 16l7 9 8-14 8 14 7-9-3 19H12L9 16Z" fill={color} stroke={color} />
        <circle cx="24" cy="8" r="2.5" fill={color} stroke="none" />
      </svg>
    )
  }
  if (kind === 'arrow') {
    return (
      <svg {...common}>
        <path d="M5 24c12-2 22 1 31 8M27 10c5 7 8 14 9 22M27 42c4-6 7-11 9-22" />
      </svg>
    )
  }
  if (kind === 'swirl') {
    return (
      <svg {...common}>
        <path d="M9 33c16 2 28-5 27-15-1-8-12-8-13-1-1 9 19 17 20 0" />
      </svg>
    )
  }
  if (kind === 'smiley') {
    return (
      <svg {...common}>
        <circle cx="24" cy="24" r="17" />
        <path d="M16 20h.1M32 20h.1M15 29c5 5 13 5 18 0" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M24 3v9M24 36v9M3 24h9M36 24h9M9 9l6 6M33 33l6 6M39 9l-6 6M15 33l-6 6" />
    </svg>
  )
}
