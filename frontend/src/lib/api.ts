import type {
  DashboardStats,
  GeneratedOutput,
  ProcessedOrder,
  Product,
  RecognitionRow,
  SettingsSummary,
} from '../types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init)
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const api = {
  stats: () => request<DashboardStats>('/api/stats'),
  orders: () => request<ProcessedOrder[]>('/api/orders'),
  settings: () => request<SettingsSummary>('/api/settings'),
  products: (query: string) =>
    request<Product[]>(`/api/products?search=${encodeURIComponent(query)}&limit=80`),
  processOrder: async (files: File[]) => {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    return request<ProcessedOrder>('/api/orders/process', {
      method: 'POST',
      body: formData,
    })
  },
  updateRows: (orderId: string, rows: RecognitionRow[]) =>
    request<ProcessedOrder>(`/api/orders/${orderId}/rows`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    }),
  generateOutput: (orderId: string, kind: 'updated' | 'items') =>
    request<GeneratedOutput>(`/api/orders/${orderId}/outputs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    }),
  downloadUrl: (path: string) => `${API_BASE}${path}`,
}
