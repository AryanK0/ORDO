import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { Card } from '../ui/card'

interface StatCardProps {
  label: string
  value: string
  detail: string
  icon: LucideIcon
}

export function StatCard({ label, value, detail, icon: Icon }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">{label}</p>
          <motion.p
            className="mt-3 text-3xl font-semibold text-white"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {value}
          </motion.p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-md border border-red-500/20 bg-red-500/10 text-red-300">
          <Icon size={19} />
        </div>
      </div>
      <p className="mt-4 text-sm text-zinc-500">{detail}</p>
    </Card>
  )
}
