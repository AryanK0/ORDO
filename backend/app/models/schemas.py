from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class Product(BaseModel):
    id: str
    name: str
    pack: str
    rate: float
    gst: float
    company: str
    workbookRow: int


class MatchSuggestion(BaseModel):
    product: Product
    score: float
    reason: str


class RecognitionRow(BaseModel):
    id: str
    ocrText: str
    matchedProduct: Product | None = None
    quantity: int = Field(default=1, ge=1)
    confidence: float = Field(default=0, ge=0, le=100)
    suggestions: list[MatchSuggestion] = Field(default_factory=list)


class OrderSource(str, Enum):
    handwritten = "handwritten"
    audio = "audio"
    live = "live"


class UploadPageStatus(BaseModel):
    id: str
    fileName: str
    status: str
    lineCount: int = 0
    rowCount: int = 0
    message: str | None = None


class ProcessedOrder(BaseModel):
    id: str
    fileName: str
    createdAt: datetime
    productCount: int
    averageConfidence: int
    rows: list[RecognitionRow]
    source: OrderSource = OrderSource.handwritten
    transcript: str | None = None
    pages: list[UploadPageStatus] = Field(default_factory=list)
    updatedWorkbookName: str | None = None
    orderedWorkbookName: str | None = None


class DashboardStats(BaseModel):
    ordersProcessed: int
    productsRecognized: int
    averageConfidence: int
    recentDownloads: int


class SettingsSummary(BaseModel):
    productCount: int
    aliasCount: int
    aiModel: str
    ocrEngine: str
    catalogSource: str


class OutputKind(str, Enum):
    updated = "updated"
    items = "items"


class OutputRequest(BaseModel):
    kind: OutputKind


class RowsUpdate(BaseModel):
    rows: list[RecognitionRow]


class GeneratedOutput(BaseModel):
    fileName: str
    timestamp: datetime
    downloadUrl: str


class StructuredItem(BaseModel):
    text: str
    quantity: int = Field(default=1, ge=1)
    catalogId: str | None = None


class OrderEventType(str, Enum):
    add_product = "ADD_PRODUCT"
    update_product = "UPDATE_PRODUCT"
    remove_product = "REMOVE_PRODUCT"
    increase_qty = "INCREASE_QTY"
    decrease_qty = "DECREASE_QTY"


class SmartOrderEvent(BaseModel):
    event: OrderEventType
    text: str
    quantity: int = Field(default=1, ge=1)
    rawText: str


class LiveSessionRequest(BaseModel):
    fileName: str = "Live Voice Order"


class LiveTextRequest(BaseModel):
    text: str
    rows: list[RecognitionRow] = Field(default_factory=list)


class LiveSessionResponse(BaseModel):
    sessionId: str
    transcript: str
    order: ProcessedOrder
    events: list[SmartOrderEvent] = Field(default_factory=list)
