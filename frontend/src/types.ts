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

export type OrderSource = 'handwritten' | 'audio' | 'live'

export interface UploadPageStatus {
  id: string
  fileName: string
  status: string
  lineCount: number
  rowCount: number
  message?: string | null
}

export interface ProcessedOrder {
  id: string
  fileName: string
  createdAt: string
  productCount: number
  averageConfidence: number
  rows: RecognitionRow[]
  source: OrderSource
  transcript?: string | null
  pages: UploadPageStatus[]
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

export type SmartOrderEventType =
  | 'ADD_PRODUCT'
  | 'UPDATE_PRODUCT'
  | 'REMOVE_PRODUCT'
  | 'INCREASE_QTY'
  | 'DECREASE_QTY'

export interface SmartOrderEvent {
  event: SmartOrderEventType
  text: string
  quantity: number
  rawText: string
}

export interface LiveSessionResponse {
  sessionId: string
  transcript: string
  order: ProcessedOrder
  events: SmartOrderEvent[]
}
