import { ChevronDown, ChevronRight, Plus, Search, Trash2 } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import type { Product, RecognitionRow } from '../../types'
import { average, cn } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ProductCombobox } from './ProductCombobox'

interface RecognitionTableProps {
  rows: RecognitionRow[]
  onRowsChange: (rows: RecognitionRow[]) => void
}

type SortMode = 'manual' | 'confidence' | 'quantity'

export function RecognitionTable({ rows, onRowsChange }: RecognitionTableProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'review'>('all')
  const [expanded, setExpanded] = useState<string[]>([])
  const [sort, setSort] = useState<SortMode>('manual')

  const visibleRows = useMemo(() => {
    return rows
      .filter((row) => {
        const text = `${row.ocrText} ${row.matchedProduct?.name ?? ''}`.toLowerCase()
        const matchesSearch = text.includes(search.toLowerCase())
        const matchesFilter = filter === 'all' || row.confidence < 95
        return matchesSearch && matchesFilter
      })
      .toSorted((a, b) => {
        if (sort === 'confidence') return b.confidence - a.confidence
        if (sort === 'quantity') return b.quantity - a.quantity
        return rows.indexOf(a) - rows.indexOf(b)
      })
  }, [filter, rows, search, sort])

  function patchRow(rowId: string, patch: Partial<RecognitionRow>) {
    onRowsChange(rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)))
  }

  function addRow() {
    setFilter('all')
    setSort('manual')
    onRowsChange([
      {
        id: crypto.randomUUID(),
        ocrText: '',
        matchedProduct: null,
        quantity: 1,
        confidence: 0,
        suggestions: [],
      },
      ...rows,
    ])
  }

  function setProduct(rowId: string, product: Product) {
    patchRow(rowId, { matchedProduct: product, confidence: 100 })
  }

  return (
    <div className="rounded-lg border border-white/[0.08] bg-black/30 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-3 border-b border-white/[0.08] p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Recognition results</h3>
          <p className="text-sm text-zinc-500">
            {rows.length} rows · {average(rows.map((row) => row.confidence))}% average confidence
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={15} />
            <Input
              className="w-full pl-9 sm:w-64"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search rows"
            />
          </div>
          <select
            className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-zinc-200 outline-none"
            value={filter}
            onChange={(event) => setFilter(event.target.value as 'all' | 'review')}
          >
            <option value="all">All rows</option>
            <option value="review">Needs review</option>
          </select>
          <select
            className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-zinc-200 outline-none"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
          >
            <option value="manual">Manual order</option>
            <option value="confidence">Sort by confidence</option>
            <option value="quantity">Sort by quantity</option>
          </select>
          <Button onClick={addRow}>
            <Plus size={16} />
            Add row
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="text-xs uppercase text-zinc-600">
            <tr className="border-b border-white/[0.08]">
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3">OCR Text</th>
              <th className="px-4 py-3">Matched Product</th>
              <th className="px-4 py-3">Quantity</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const isExpanded = expanded.includes(row.id)
              return (
                <Fragment key={row.id}>
                  <tr className="border-b border-white/[0.06] align-top">
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        className="text-zinc-500 hover:text-white"
                        onClick={() =>
                          setExpanded((current) =>
                            current.includes(row.id)
                              ? current.filter((id) => id !== row.id)
                              : [...current, row.id],
                          )
                        }
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <Input
                        value={row.ocrText}
                        onChange={(event) => patchRow(row.id, { ocrText: event.target.value })}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <ProductCombobox value={row.matchedProduct} onChange={(product) => setProduct(row.id, product)} />
                    </td>
                    <td className="px-4 py-4">
                      <Input
                        className="w-24"
                        min={1}
                        type="number"
                        value={row.quantity}
                        onChange={(event) => patchRow(row.id, { quantity: Number(event.target.value) })}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <Badge confidence={row.confidence}>{Math.round(row.confidence)}%</Badge>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button
                        className="h-9 w-9 p-0"
                        variant="danger"
                        onClick={() => onRowsChange(rows.filter((item) => item.id !== row.id))}
                        aria-label="Delete row"
                      >
                        <Trash2 size={15} />
                      </Button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-white/[0.06] bg-white/[0.025]">
                      <td />
                      <td colSpan={5} className="px-4 py-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          {row.suggestions.slice(0, 3).map((suggestion, index) => (
                            <button
                              type="button"
                              key={`${row.id}-${suggestion.product.id}`}
                              onClick={() => setProduct(row.id, suggestion.product)}
                              className={cn(
                                'rounded-md border border-white/10 bg-black/25 p-3 text-left transition hover:border-red-500/40',
                                index === 0 && 'border-red-500/25',
                              )}
                            >
                              <p className="text-xs text-zinc-500">
                                {index === 0 ? 'Best Match' : 'Alternative Match'}
                              </p>
                              <p className="mt-1 truncate font-medium text-zinc-100">{suggestion.product.name}</p>
                              <p className="mt-1 text-xs text-zinc-600">
                                {Math.round(suggestion.score)}% · {suggestion.reason}
                              </p>
                            </button>
                          ))}
                          {!row.suggestions.length && (
                            <p className="text-sm text-zinc-500">No alternate suggestions available.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end border-t border-white/[0.08] p-4">
        <Button onClick={addRow}>
          <Plus size={16} />
          Add row
        </Button>
      </div>
    </div>
  )
}
