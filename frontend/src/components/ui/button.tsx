import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-red-700 to-red-500 text-white shadow-[0_0_24px_rgba(220,38,38,0.24)] hover:from-red-600 hover:to-red-500',
  secondary:
    'border border-white/10 bg-white/[0.06] text-zinc-100 hover:bg-white/[0.09]',
  ghost: 'text-zinc-300 hover:bg-white/[0.06] hover:text-white',
  danger: 'border border-red-500/30 bg-red-950/40 text-red-200 hover:bg-red-900/50',
}

export function Button({ className, variant = 'secondary', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium leading-tight transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
