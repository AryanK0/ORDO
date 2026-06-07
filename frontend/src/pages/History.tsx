import { Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatDate } from '../lib/utils'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'

export function History() {
  const [search, setSearch] = useState('')
  const orders = useQuery({ queryKey: ['orders'], queryFn: api.orders })

  const filteredOrders = useMemo(() => {
    return (orders.data ?? []).filter((order) =>
      order.fileName.toLowerCase().includes(search.toLowerCase()),
    )
  }, [orders.data, search])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-red-300">Order history</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">
            Last 25 processed orders
          </h1>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={15} />
          <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders" />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase text-zinc-600">
              <tr className="border-b border-white/[0.08]">
                <th className="px-5 py-3">Order Name</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Number of Products</th>
                <th className="px-5 py-3">Confidence</th>
                <th className="px-5 py-3">Updated Workbook</th>
                <th className="px-5 py-3">Ordered Workbook</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className="border-b border-white/[0.06]">
                  <td className="px-5 py-4 font-medium text-zinc-100">{order.fileName}</td>
                  <td className="px-5 py-4 text-zinc-500">{formatDate(order.createdAt)}</td>
                  <td className="px-5 py-4 text-zinc-300">{order.productCount}</td>
                  <td className="px-5 py-4">
                    <Badge confidence={order.averageConfidence}>{order.averageConfidence}%</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <Button className="h-8 px-3" disabled={!order.updatedWorkbookName}>
                      <Download size={14} />
                      Download
                    </Button>
                  </td>
                  <td className="px-5 py-4">
                    <Button className="h-8 px-3" disabled={!order.orderedWorkbookName}>
                      <Download size={14} />
                      Download
                    </Button>
                  </td>
                </tr>
              ))}
              {!orders.isLoading && !filteredOrders.length && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-zinc-500">
                    No matching orders found.
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
