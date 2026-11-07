export function MucDoodle({ className = 'h-20 w-20' }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={`${className} object-contain`} aria-hidden="true" focusable="false" data-race-doodle="muc">
      <path d="M22 42 17 15l24 13a36 36 0 0 1 14 0l24-13-5 27a31 31 0 0 1 5 17c0 18-14 29-31 29S17 77 17 59a31 31 0 0 1 5-17Z" fill="#1C1B22" stroke="#1C1B22" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="36" cy="54" r="6" fill="#FFD23F" />
      <circle cx="60" cy="54" r="6" fill="#FFD23F" />
      <circle cx="36" cy="54" r="2.5" fill="#1C1B22" />
      <circle cx="60" cy="54" r="2.5" fill="#1C1B22" />
      <path d="M48 62v5M43 72c3 3 7 3 10 0" fill="none" stroke="#F4EDE0" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 78c8 7 40 7 48 0l-5 7c-10 5-28 5-38 0Z" fill="#5ED39A" stroke="#1C1B22" strokeWidth="3" />
    </svg>
  )
}
