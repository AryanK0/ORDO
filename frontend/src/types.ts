export type ConfidenceBand = 'high' | 'medium' | 'low'

export interface Product {
  id: string
  name: string
  pack: string
  rate: number
  gst: number
  company: string
  workbookRow: number
}

export interface MatchSuggestion {
  product: Product
  score: number
  reason: string
}

export interface RecognitionRow {
  id: string
  ocrText: string
  matchedProduct: Product | null
  quantity: number
  confidence: number
  suggestions: MatchSuggestion[]
}

export interface ProcessedOrder {
  id: string
  fileName: string
  createdAt: string
  productCount: number
  averageConfidence: number
  rows: RecognitionRow[]
  updatedWorkbookName?: string
  orderedWorkbookName?: string
}

export interface DashboardStats {
  ordersProcessed: number
  productsRecognized: number
  averageConfidence: number
  recentDownloads: number
}

export interface SettingsSummary {
  productCount: number
  aliasCount: number
  aiModel: string
  ocrEngine: string
  catalogSource: string
}

export interface GeneratedOutput {
  fileName: string
  timestamp: string
  downloadUrl: string
}
