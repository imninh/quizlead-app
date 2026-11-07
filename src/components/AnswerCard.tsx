import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Check, X } from 'lucide-react'

export type AnswerState = 'idle' | 'selected' | 'correct' | 'wrong' | 'disabled'

const COLORS = ['sun', 'bubble', 'sky', 'mint'] as const
export type AnswerColor = (typeof COLORS)[number]

const COLOR_CLASS: Record<AnswerColor, string> = {
  sun: 'bg-sun',
  bubble: 'bg-bubble',
  sky: 'bg-sky',
  mint: 'bg-mint',
}

type AnswerCardProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  index: 0 | 1 | 2 | 3
  children: ReactNode
  state?: AnswerState
}

export function AnswerCard({ index, children, state = 'idle', className = '', ...rest }: AnswerCardProps) {
  const color = COLORS[index]
  const isCorrect = state === 'correct'
  const isWrong = state === 'wrong'
  const disabled = state === 'disabled' || rest.disabled

  return (
    <button
      {...rest}
      disabled={disabled}
      data-state={state}
      data-color={color}
      aria-pressed={state === 'selected' ? true : undefined}
      className={`relative min-h-[56px] w-full rounded-[16px_20px_14px_22px] border-2 border-ink ${COLOR_CLASS[color]} px-4 py-3 text-left text-ink shadow-sticker transition-transform focus-visible:outline-4 focus-visible:outline-cobalt disabled:opacity-70 ${
        isCorrect ? 'ring-4 ring-ink' : ''
      } ${isWrong ? 'opacity-70 line-through decoration-2' : ''} ${className}`}
    >
      <span className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-white font-display text-lg leading-none">
          {String.fromCharCode(65 + index)}
        </span>
        <span className="answer-option min-w-0 flex-1 break-words text-base font-medium leading-snug">{children}</span>
        {isCorrect ? <Check className="mt-1 size-5 shrink-0" aria-hidden="true" data-icon="correct" /> : null}
        {isWrong ? <X className="mt-1 size-5 shrink-0" aria-hidden="true" data-icon="wrong" /> : null}
      </span>
      {isCorrect ? <span className="sr-only">Đáp án đúng</span> : null}
      {isWrong ? <span className="sr-only">Đáp án sai</span> : null}
    </button>
  )
}
