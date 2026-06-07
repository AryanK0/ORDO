import { Download, PackageCheck, Percent, ScrollText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatDate } from '../lib/utils'
import { StatCard } from '../components/orders/StatCard'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'

export function Dashboard() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats })
  const orders = useQuery({ queryKey: ['orders'], queryFn: api.orders })

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-red-300">Operations overview</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white md:text-4xl">
          Pharmaceutical order intelligence
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
          Monitor handwritten order processing, product recognition quality, and
          workbook generation activity from one operational surface.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ScrollText}
          label="Orders Processed"
          value={String(stats.data?.ordersProcessed ?? 0)}
          detail="Last 25 orders retained locally"
        />
        <StatCard
          icon={PackageCheck}
          label="Products Recognized"
          value={String(stats.data?.productsRecognized ?? 0)}
          detail="Matched against the catalog cache"
        />
        <StatCard
          icon={Percent}
          label="Average Confidence"
          value={`${stats.data?.averageConfidence ?? 0}%`}
          detail="Across current recognition rows"
        />
        <StatCard
          icon={Download}
          label="Recent Downloads"
          value={String(stats.data?.recentDownloads ?? 0)}
          detail="Updated and ordered workbooks"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] p-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Recent orders</h2>
            <p className="text-sm text-zinc-500">The latest processed order files.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-zinc-600">
              <tr className="border-b border-white/[0.08]">
                <th className="px-5 py-3">File Name</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Products</th>
                <th className="px-5 py-3">Confidence</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(orders.data ?? []).slice(0, 25).map((order) => (
                <tr key={order.id} className="border-b border-white/[0.06]">
                  <td className="px-5 py-4 font-medium text-zinc-100">{order.fileName}</td>
                  <td className="px-5 py-4 text-zinc-500">{formatDate(order.createdAt)}</td>
                  <td className="px-5 py-4 text-zinc-300">{order.productCount}</td>
                  <td className="px-5 py-4">
                    <Badge confidence={order.averageConfidence}>{order.averageConfidence}%</Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button className="h-8 px-3" variant="ghost">
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
              {!orders.isLoading && !orders.data?.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-zinc-500">
                    No orders processed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
