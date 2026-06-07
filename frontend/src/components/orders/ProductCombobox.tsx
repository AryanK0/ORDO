import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'
import type { Product } from '../../types'
import { Input } from '../ui/input'

interface ProductComboboxProps {
  value: Product | null
  onChange: (product: Product) => void
}

export function ProductCombobox({ value, onChange }: ProductComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value?.name ?? '')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const products = useQuery({
    queryKey: ['products', query],
    queryFn: () => api.products(query),
    enabled: open,
  })

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="relative min-w-[240px]" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setQuery(value?.name ?? '')
          setOpen((next) => !next)
        }}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-left text-sm text-zinc-100"
      >
        <span className="truncate">{value?.name ?? 'Select product'}</span>
        <ChevronsUpDown size={15} className="text-zinc-500" />
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-[min(380px,calc(100vw-2rem))] rounded-lg border border-white/10 bg-zinc-950 p-2 shadow-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={15} />
            <Input
              autoFocus
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by product, pack, or division"
            />
          </div>
          <div className="mt-2 max-h-64 overflow-y-auto">
            {(products.data ?? []).map((product) => (
              <button
                type="button"
                key={product.id}
                onClick={() => {
                  onChange(product)
                  setQuery(product.name)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/[0.06]',
                  value?.id === product.id && 'text-white',
                )}
              >
                <Check
                  size={15}
                  className={cn('mt-0.5 text-red-400 opacity-0', value?.id === product.id && 'opacity-100')}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{product.name}</span>
                  <span className="block truncate text-xs text-zinc-600">
                    {product.pack} · {product.company}
                  </span>
                </span>
              </button>
            ))}
            {products.isLoading && (
              <p className="px-3 py-6 text-center text-sm text-zinc-500">Searching catalog...</p>
            )}
            {!products.isLoading && !products.data?.length && (
              <p className="px-3 py-6 text-center text-sm text-zinc-500">
                No catalog product found.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
