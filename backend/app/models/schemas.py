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


class ProcessedOrder(BaseModel):
    id: str
    fileName: str
    createdAt: datetime
    productCount: int
    averageConfidence: int
    rows: list[RecognitionRow]
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
