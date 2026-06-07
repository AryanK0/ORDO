import { create } from 'zustand'
import type { ProcessedOrder, RecognitionRow } from '../types'

interface OrdersState {
  activeOrder: ProcessedOrder | null
  previewUrl: string | null
  setActiveOrder: (order: ProcessedOrder | null) => void
  setPreviewUrl: (url: string | null) => void
  updateRows: (rows: RecognitionRow[]) => void
}

export const useOrdersStore = create<OrdersState>((set) => ({
  activeOrder: null,
  previewUrl: null,
  setActiveOrder: (order) => set({ activeOrder: order }),
  setPreviewUrl: (url) => set({ previewUrl: url }),
  updateRows: (rows) =>
    set((state) => ({
      activeOrder: state.activeOrder ? { ...state.activeOrder, rows } : null,
    })),
}))
