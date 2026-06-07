import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.excel.workbook import WorkbookGenerator
from app.gemini.client import GeminiValidator
from app.matching.aliases import AliasStore
from app.matching.catalog import ProductCatalog
from app.matching.matcher import ProductMatcher
from app.models.schemas import (
    DashboardStats,
    GeneratedOutput,
    OutputKind,
    OutputRequest,
    ProcessedOrder,
    RecognitionRow,
    RowsUpdate,
    SettingsSummary,
)
from app.ocr.paddle_service import PaddleOCRService
from app.storage.repository import OrderRepository


router = APIRouter()


class Services:
    catalog: ProductCatalog
    aliases: AliasStore
    matcher: ProductMatcher
    ocr: PaddleOCRService
    gemini: GeminiValidator
    orders: OrderRepository
    workbooks: WorkbookGenerator
    uploads_dir: Path
    downloads_dir: Path


services = Services()


def configure_services(
    *,
    catalog: ProductCatalog,
    aliases: AliasStore,
    ocr: PaddleOCRService,
    gemini: GeminiValidator,
    orders: OrderRepository,
    workbooks: WorkbookGenerator,
    uploads_dir: Path,
    downloads_dir: Path,
) -> None:
    services.catalog = catalog
    services.aliases = aliases
    services.matcher = ProductMatcher(catalog, aliases)
    services.ocr = ocr
    services.gemini = gemini
    services.orders = orders
    services.workbooks = workbooks
    services.uploads_dir = uploads_dir
    services.downloads_dir = downloads_dir


def _average(rows: list[RecognitionRow]) -> int:
    if not rows:
        return 0
    return round(sum(row.confidence for row in rows) / len(rows))


def _safe_upload_name(file_name: str) -> str:
    suffix = Path(file_name).suffix.lower()
    return f"{uuid.uuid4().hex}{suffix}"


@router.get("/stats", response_model=DashboardStats)
def stats() -> DashboardStats:
    orders = services.orders.all()
    rows = [row for order in orders for row in order.rows]
    recent_downloads = sum(
        1
        for order in orders
        for value in (order.updatedWorkbookName, order.orderedWorkbookName)
        if value
    )
    return DashboardStats(
        ordersProcessed=len(orders),
        productsRecognized=sum(1 for row in rows if row.matchedProduct),
        averageConfidence=_average(rows),
        recentDownloads=recent_downloads,
    )


@router.get("/orders", response_model=list[ProcessedOrder])
def list_orders() -> list[ProcessedOrder]:
    return services.orders.all()


@router.get("/products")
def products(search: str = "", limit: int = 80):
    return services.catalog.search(search, limit)


@router.get("/settings", response_model=SettingsSummary)
def settings() -> SettingsSummary:
    return SettingsSummary(
        productCount=len(services.catalog.products),
        aliasCount=len(services.aliases.aliases),
        aiModel=services.gemini.model,
        ocrEngine=services.ocr.engine_name,
        catalogSource=services.catalog.source,
    )


@router.post("/orders/process", response_model=ProcessedOrder)
def process_order(files: list[UploadFile] = File(...)) -> ProcessedOrder:
    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required.")

    all_rows: list[RecognitionRow] = []
    display_name = files[0].filename or "order"
    for upload in files:
        upload_name = _safe_upload_name(upload.filename or "order")
        target = services.uploads_dir / upload_name
        with target.open("wb") as file_handle:
            shutil.copyfileobj(upload.file, file_handle)

        lines = services.ocr.extract_text(target, upload.filename)
        if not lines:
            lines = services.gemini.extract_file_lines(target)
        if not lines:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Could not extract order lines from this file. Configure GEMINI_API_KEY "
                    "or install PaddleOCR for unsupported handwritten images."
                ),
            )
        structured_items = services.gemini.structure(lines)
        for item in structured_items:
            product, score, suggestions = services.matcher.best(item.text)
            all_rows.append(
                RecognitionRow(
                    id=str(uuid.uuid4()),
                    ocrText=item.text,
                    matchedProduct=product,
                    quantity=item.quantity,
                    confidence=round(score),
                    suggestions=suggestions,
                )
            )

    order = ProcessedOrder(
        id=str(uuid.uuid4()),
        fileName=display_name,
        createdAt=datetime.now(timezone.utc),
        productCount=sum(1 for row in all_rows if row.matchedProduct),
        averageConfidence=_average(all_rows),
        rows=all_rows,
    )
    services.orders.upsert(order)
    return order


@router.patch("/orders/{order_id}/rows", response_model=ProcessedOrder)
def update_rows(order_id: str, payload: RowsUpdate) -> ProcessedOrder:
    try:
        order = services.orders.get(order_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Order not found.") from exc

    for row in payload.rows:
        if row.matchedProduct and row.confidence >= 100:
            services.aliases.learn(row.ocrText, row.matchedProduct.name)

    updated = order.model_copy(
        update={
            "rows": payload.rows,
            "productCount": sum(1 for row in payload.rows if row.matchedProduct),
            "averageConfidence": _average(payload.rows),
        }
    )
    services.orders.upsert(updated)
    return updated


@router.post("/orders/{order_id}/outputs", response_model=GeneratedOutput)
def generate_output(order_id: str, payload: OutputRequest) -> GeneratedOutput:
    try:
        order = services.orders.get(order_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Order not found.") from exc

    if payload.kind == OutputKind.updated:
        file_name = services.workbooks.generate_updated(order)
        order.updatedWorkbookName = file_name
    else:
        file_name = services.workbooks.generate_items(order)
        order.orderedWorkbookName = file_name
    services.orders.upsert(order)

    return GeneratedOutput(
        fileName=file_name,
        timestamp=datetime.now(timezone.utc),
        downloadUrl=f"/api/downloads/{file_name}",
    )


@router.get("/downloads/{file_name}")
def download(file_name: str) -> FileResponse:
    target = services.downloads_dir / Path(file_name).name
    if not target.exists():
        raise HTTPException(status_code=404, detail="Download not found.")
    return FileResponse(target, filename=target.name)
