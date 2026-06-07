import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/15',
        className,
      )}
      {...props}
    />
  )
}
