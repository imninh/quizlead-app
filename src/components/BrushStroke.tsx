export function BrushStroke({
  color = 'var(--color-sun)',
  className = '',
}: {
  color?: string
  className?: string
}) {
  return (
    <svg
      className={`pointer-events-none absolute ${className}`}
      viewBox="0 0 240 32"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 21c28-13 60-16 102-13 41 3 78 10 126 5 9-1 9 7 0 9-50 8-86 6-128 4-41-2-71 1-100 10-9 3-13-11 0-15Z"
        fill={color}
        opacity="0.85"
      />
    </svg>
  )
}
