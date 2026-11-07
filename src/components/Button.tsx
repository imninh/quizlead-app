import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react'
import { BrushStroke } from './BrushStroke'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  children: ReactNode
}

const variantClass: Record<Variant, string> = {
  primary: 'bg-sun text-ink font-semibold shadow-sticker border-2 border-ink relative',
  secondary: 'bg-white text-ink border-2 border-ink shadow-sticker',
  ghost: 'bg-transparent text-ink underline border-2 border-transparent',
  danger: 'bg-alert text-white font-semibold border-2 border-ink shadow-sticker',
}

export function Button({ variant = 'primary', className = '', children, ...rest }: ButtonProps) {
  const reduced = useReducedMotion()
  // motion.button dùng onAnimationStart/onDrag... kiểu khác HTML button; các props thường vẫn giữ nguyên.
  const motionProps = rest as unknown as HTMLMotionProps<'button'>
  return (
    <motion.button
      whileTap={reduced ? undefined : { scale: 0.97 }}
      className={`hover-lift inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[16px_20px_14px_22px] px-4 py-3 transition focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-cobalt ${variantClass[variant]} ${className}`}
      {...motionProps}
    >
      {variant === 'primary' ? <BrushStroke color="var(--color-paper)" className="inset-x-3 bottom-1 h-3 opacity-70" /> : null}
      <span className="relative">{children}</span>
    </motion.button>
  )
}
