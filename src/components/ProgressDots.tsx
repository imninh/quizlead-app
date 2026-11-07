export function ProgressDots({ current, total = 5 }: { current: number; total?: number }) {
  const safeCurrent = Math.max(1, Math.min(total, current))
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: total }).map((_, index) => (
          <span
            key={index}
            data-filled={index < safeCurrent}
            className={`size-2.5 rounded-full border border-ink ${index < safeCurrent ? 'bg-cobalt' : 'bg-white'}`}
          />
        ))}
      </div>
      <span className="font-semibold">Câu {safeCurrent}/{total}</span>
    </div>
  )
}
