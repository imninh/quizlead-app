import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  count?: { current: number; max: number }
}

export function TextField({ label, error, count, id, ...rest }: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? `${label}-${generatedId}`
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm font-semibold">{label}</label>
      <input id={inputId} className="w-full rounded-xl border-2 border-ink bg-white px-3 py-2 focus-visible:outline-4 focus-visible:outline-cobalt" {...rest} />
      <div className="flex justify-between text-xs text-ink/60">
        {error ? <span className="text-alert">{error}</span> : <span />}
        {count ? <span>{count.current}/{count.max}</span> : null}
      </div>
    </div>
  )
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  error?: string
  count?: { current: number; max: number }
}

export function TextArea({ label, error, count, id, ...rest }: TextAreaProps) {
  const generatedId = useId()
  const inputId = id ?? `${label}-${generatedId}`
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm font-semibold">{label}</label>
      <textarea id={inputId} className="w-full rounded-xl border-2 border-ink bg-white px-3 py-2 focus-visible:outline-4 focus-visible:outline-cobalt" {...rest} />
      <div className="flex justify-between text-xs text-ink/60">
        {error ? <span className="text-alert">{error}</span> : <span />}
        {count ? <span>{count.current}/{count.max}</span> : null}
      </div>
    </div>
  )
}
