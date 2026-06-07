import type { HTMLAttributes } from 'react'
import { confidenceBand, cn } from '../../lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  confidence?: number
}

export function Badge({ className, confidence, ...props }: BadgeProps) {
  const band = confidence === undefined ? undefined : confidenceBand(confidence)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
        band === 'high' && 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
        band === 'medium' && 'border-yellow-400/30 bg-yellow-400/10 text-yellow-200',
        band === 'low' && 'border-red-400/35 bg-red-500/10 text-red-200',
        band === undefined && 'border-white/10 bg-white/[0.06] text-zinc-300',
        className,
      )}
      {...props}
    />
  )
}
