import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-white/[0.08] bg-white/[0.05] backdrop-blur-2xl',
        className,
      )}
      {...props}
    />
  )
}
