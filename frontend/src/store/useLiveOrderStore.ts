import { create } from 'zustand'
import type { RecognitionRow, SmartOrderEvent } from '../types'

interface LiveOrderState {
  sessionId: string | null
  transcript: string
  currentProducts: RecognitionRow[]
  confidenceScores: number[]
  suggestions: string[]
  events: SmartOrderEvent[]
  isListening: boolean
  setSession: (sessionId: string | null) => void
  setListening: (isListening: boolean) => void
  applyLiveState: (payload: {
    transcript: string
    rows: RecognitionRow[]
    events: SmartOrderEvent[]
  }) => void
  reset: () => void
}

export const useLiveOrderStore = create<LiveOrderState>((set) => ({
  sessionId: null,
  transcript: '',
  currentProducts: [],
  confidenceScores: [],
  suggestions: [],
  events: [],
  isListening: false,
  setSession: (sessionId) => set({ sessionId }),
  setListening: (isListening) => set({ isListening }),
  applyLiveState: ({ transcript, rows, events }) =>
    set({
      transcript,
      currentProducts: rows,
      confidenceScores: rows.map((row) => row.confidence),
      suggestions: rows.flatMap((row) => row.suggestions.map((item) => item.product.name)),
      events,
    }),
  reset: () =>
    set({
      sessionId: null,
      transcript: '',
      currentProducts: [],
      confidenceScores: [],
      suggestions: [],
      events: [],
      isListening: false,
    }),
}))
