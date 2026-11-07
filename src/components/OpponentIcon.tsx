import type { OpponentKind } from '../domain/schemas'

export function OpponentIcon({ kind, size = 28 }: { kind: OpponentKind; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 48 48',
    'aria-hidden': true,
    focusable: false,
  }
  if (kind === 'ai') {
    return (
      <svg {...common}>
        <path
          d="M13 16 10 6l6 4 8-6 8 6 6-4-3 10"
          fill="#FFD23F"
          stroke="#1C1B22"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <rect x="10" y="16" width="28" height="23" rx="7" fill="#FF6B6B" stroke="#1C1B22" strokeWidth="3" />
        <path d="M16 25l6 3M32 25l-6 3" stroke="#1C1B22" strokeWidth="3" strokeLinecap="round" />
        <path d="M18 33l3-2 3 2 3-2 3 2" fill="none" stroke="#1C1B22" strokeWidth="3" strokeLinecap="round" />
        <path d="M24 16V9" stroke="#1C1B22" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'rabbit') {
    return (
      <svg {...common}>
        <ellipse cx="18" cy="15" rx="5" ry="11" fill="#FF8FC7" stroke="#1C1B22" strokeWidth="3" />
        <ellipse cx="31" cy="15" rx="5" ry="11" fill="#FF8FC7" stroke="#1C1B22" strokeWidth="3" />
        <circle cx="24" cy="30" r="12" fill="#FF8FC7" stroke="#1C1B22" strokeWidth="3" />
        <circle cx="20" cy="28" r="2" fill="#1C1B22" />
        <circle cx="28" cy="28" r="2" fill="#1C1B22" />
      </svg>
    )
  }
  if (kind === 'turtle') {
    return (
      <svg {...common}>
        <circle cx="24" cy="27" r="14" fill="#5ED39A" stroke="#1C1B22" strokeWidth="3" />
        <path d="M14 27h20M24 13v28M17 17l14 20M31 17 17 37" stroke="#1C1B22" strokeWidth="2" />
        <circle cx="38" cy="24" r="5" fill="#FFD23F" stroke="#1C1B22" strokeWidth="3" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="24" cy="25" r="13" fill="#FFD23F" stroke="#1C1B22" strokeWidth="3" />
      <circle cx="13" cy="12" r="5" fill="#FFD23F" stroke="#1C1B22" strokeWidth="3" />
      <circle cx="35" cy="12" r="5" fill="#FFD23F" stroke="#1C1B22" strokeWidth="3" />
      <circle cx="19" cy="24" r="2.5" fill="#1C1B22" />
      <circle cx="29" cy="24" r="2.5" fill="#1C1B22" />
      <path d="M18 32h12" stroke="#1C1B22" strokeWidth="3" strokeLinecap="round" />
      <circle cx="15" cy="17" r="2" fill="#1C1B22" opacity="0.55" />
      <circle cx="33" cy="17" r="2" fill="#1C1B22" opacity="0.55" />
    </svg>
  )
}
