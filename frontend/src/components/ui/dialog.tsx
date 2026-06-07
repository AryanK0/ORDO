import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './button'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}

export function Dialog({ open, onOpenChange, title, children }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-zinc-950/95 p-5 text-white shadow-2xl outline-none">
          <div className="mb-4 flex items-center justify-between gap-4">
            <DialogPrimitive.Title className="text-base font-semibold">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button className="h-8 w-8 p-0" variant="ghost" aria-label="Close dialog">
                <X size={16} />
              </Button>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
