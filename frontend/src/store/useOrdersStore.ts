import { create } from 'zustand'
import type { ProcessedOrder, RecognitionRow } from '../types'

interface OrdersState {
  activeOrder: ProcessedOrder | null
  previewUrl: string | null
  history: RecognitionRow[][]
  historyIndex: number
  setActiveOrder: (order: ProcessedOrder | null) => void
  setPreviewUrl: (url: string | null) => void
  updateRows: (rows: RecognitionRow[]) => void
  undo: () => void
  redo: () => void
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  activeOrder: null,
  previewUrl: null,
  history: [],
  historyIndex: -1,
  setActiveOrder: (order) => set({ 
    activeOrder: order,
    history: order ? [order.rows] : [],
    historyIndex: order ? 0 : -1,
  }),
  setPreviewUrl: (url) => set({ previewUrl: url }),
  updateRows: (rows) => {
    const { history, historyIndex, activeOrder } = get()
    if (!activeOrder) return

    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(rows)

    set({
      activeOrder: { ...activeOrder, rows },
      history: newHistory,
      historyIndex: newHistory.length - 1,
    })
  },
  undo: () => {
    const { history, historyIndex, activeOrder } = get()
    if (!activeOrder || historyIndex <= 0) return
    const newIndex = historyIndex - 1
    set({
      activeOrder: { ...activeOrder, rows: history[newIndex] },
      historyIndex: newIndex,
    })
  },
  redo: () => {
    const { history, historyIndex, activeOrder } = get()
    if (!activeOrder || historyIndex >= history.length - 1) return
    const newIndex = historyIndex + 1
    set({
      activeOrder: { ...activeOrder, rows: history[newIndex] },
      historyIndex: newIndex,
    })
  },
}))
