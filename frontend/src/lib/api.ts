import type {
  DashboardStats,
  GeneratedOutput,
  LiveSessionResponse,
  ProcessedOrder,
  Product,
  RecognitionRow,
  SettingsSummary,
} from '../types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000')

async function request<T>(path: string, init?: RequestInit, timeoutMs?: number): Promise<T> {
  const controller = timeoutMs ? new AbortController() : null
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    signal: controller?.signal ?? init?.signal,
  }).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId)
  })
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
  uploadCatalog: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return request<SettingsSummary>('/api/settings/catalog', {
      method: 'POST',
      body: formData,
    })
  },
  processOrder: async (files: File[]) => {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    return request<ProcessedOrder>('/api/orders/process', {
      method: 'POST',
      body: formData,
    })
  },
  processAudio: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return request<ProcessedOrder>('/api/orders/process-audio', {
      method: 'POST',
      body: formData,
    }, 180000)
  },
  processTranscript: async (transcript: string, fileName = 'Audio Transcript') => {
    const formData = new FormData()
    formData.append('transcript', transcript)
    formData.append('file_name', fileName)
    return request<ProcessedOrder>('/api/orders/process-transcript', {
      method: 'POST',
      body: formData,
    })
  },
  createLiveSession: (fileName = 'Live Voice Order') =>
    request<LiveSessionResponse>('/api/live/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName }),
    }),
  sendLiveTranscript: (sessionId: string, text: string, rows: RecognitionRow[]) =>
    request<LiveSessionResponse>(`/api/live/sessions/${sessionId}/transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, rows }),
    }),
  sendLiveChunk: (sessionId: string, file: Blob, rows: RecognitionRow[]) => {
    const formData = new FormData()
    formData.append('file', file, `live-${Date.now()}.webm`)
    formData.append('rows_json', JSON.stringify(rows))
    return request<LiveSessionResponse>(`/api/live/sessions/${sessionId}/chunk`, {
      method: 'POST',
      body: formData,
    })
  },
  stopLiveSession: (sessionId: string) =>
    request<ProcessedOrder>(`/api/live/sessions/${sessionId}/stop`, {
      method: 'POST',
    }),
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
