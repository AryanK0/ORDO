import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.audio.audio_processor import AudioProcessor
from app.events.order_events import OrderEventProcessor
from app.excel.workbook import WorkbookGenerator
from app.gemini.client import GeminiValidator
from app.live.stream_processor import LiveStreamProcessor
from app.matching.aliases import AliasStore
from app.matching.catalog import ProductCatalog
from app.matching.matcher import ProductMatcher
from app.models.schemas import (
    DashboardStats,
    GeneratedOutput,
    LiveSessionRequest,
    LiveSessionResponse,
    LiveTextRequest,
    OrderSource,
    OutputKind,
    OutputRequest,
    ProcessedOrder,
    RecognitionRow,
    RowsUpdate,
    SettingsSummary,
    UploadPageStatus,
)
from app.ocr.paddle_service import PaddleOCRService
from app.speech.whisper_service import WhisperService
from app.storage.repository import OrderRepository


router = APIRouter()

ALLOWED_AUDIO_SUFFIXES = {
    ".aac",
    ".aif",
    ".aiff",
    ".flac",
    ".m4a",
    ".mp3",
    ".oga",
    ".ogg",
    ".opus",
    ".wav",
    ".weba",
    ".webm",
}


class Services:
    catalog: ProductCatalog
    aliases: AliasStore
    matcher: ProductMatcher
    ocr: PaddleOCRService
    gemini: GeminiValidator
    orders: OrderRepository
    workbooks: WorkbookGenerator
    event_processor: OrderEventProcessor
    audio_processor: AudioProcessor
    live_processor: LiveStreamProcessor
    whisper: WhisperService
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
    whisper: WhisperService,
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
    services.event_processor = OrderEventProcessor(services.matcher)
    services.audio_processor = AudioProcessor(services.event_processor)
    services.live_processor = LiveStreamProcessor(services.event_processor)
    services.whisper = whisper
    services.uploads_dir = uploads_dir
    services.downloads_dir = downloads_dir


def _average(rows: list[RecognitionRow]) -> int:
    if not rows:
        return 0
    return round(sum(row.confidence for row in rows) / len(rows))


def _safe_upload_name(file_name: str) -> str:
    suffix = Path(file_name).suffix.lower()
    return f"{uuid.uuid4().hex}{suffix}"


def _save_upload(upload: UploadFile) -> Path:
    upload_name = _safe_upload_name(upload.filename or "order")
    target = services.uploads_dir / upload_name
    with target.open("wb") as file_handle:
        shutil.copyfileobj(upload.file, file_handle)
    return target


def _update_order_stats(order: ProcessedOrder) -> ProcessedOrder:
    order.productCount = sum(1 for row in order.rows if row.matchedProduct)
    order.averageConfidence = _average(order.rows)
    return order


def _rows_score(rows: list[RecognitionRow]) -> tuple[int, int, int]:
    return (
        sum(1 for row in rows if row.matchedProduct),
        _average(rows),
        len(rows),
    )


def _best_audio_rows(target: Path) -> tuple[str, list[RecognitionRow]]:
    best_transcript = ""
    best_rows: list[RecognitionRow] = []
    for transcript in services.whisper.transcribe_candidates(target):
        rows, _ = services.audio_processor.transcript_to_rows(transcript)
        if _rows_score(rows) > _rows_score(best_rows):
            best_transcript = transcript
            best_rows = rows
    if best_transcript:
        return best_transcript, best_rows
    transcript = services.whisper.transcribe(target)
    rows, _ = services.audio_processor.transcript_to_rows(transcript)
    return transcript, rows


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
    pages: list[UploadPageStatus] = []
    display_name = files[0].filename or "order"
    if len(files) > 1:
        display_name = f"{len(files)} uploaded order files"

    for upload in files:
        target = _save_upload(upload)
        page_id = str(uuid.uuid4())
        lines = services.ocr.extract_text(target, upload.filename)
        if not lines:
            lines = services.gemini.extract_file_lines(target)
        if not lines:
            pages.append(
                UploadPageStatus(
                    id=page_id,
                    fileName=upload.filename or "order",
                    status="failed",
                    message="No order lines detected.",
                )
            )
            continue

        structured_items = services.gemini.structure(lines)
        page_rows = services.event_processor.items_to_rows(structured_items)
        all_rows.extend(page_rows)
        pages.append(
            UploadPageStatus(
                id=page_id,
                fileName=upload.filename or "order",
                status="complete",
                lineCount=len(lines),
                rowCount=len(page_rows),
            )
        )

    all_rows = services.event_processor.merge_duplicate_rows(all_rows)
    if not all_rows:
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not extract order lines from these files. Configure GEMINI_API_KEY "
                "or install PaddleOCR for unsupported handwritten images."
            ),
        )

    order = _update_order_stats(
        ProcessedOrder(
            id=str(uuid.uuid4()),
            fileName=display_name,
            createdAt=datetime.now(timezone.utc),
            productCount=0,
            averageConfidence=0,
            rows=all_rows,
            source=OrderSource.handwritten,
            pages=pages,
        )
    )
    services.orders.upsert(order)
    return order


@router.post("/orders/process-audio", response_model=ProcessedOrder)
def process_audio_order(file: UploadFile = File(...)) -> ProcessedOrder:
    suffix = Path(file.filename or "").suffix.lower()
    content_type = (file.content_type or "").lower()
    if suffix not in ALLOWED_AUDIO_SUFFIXES and not content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Upload an audio file such as ogg, mp3, m4a, wav, aac, opus, webm, or flac.")
    target = _save_upload(file)
    transcript, rows = _best_audio_rows(target)
    if not transcript:
        raise HTTPException(status_code=422, detail=services.whisper.setup_message())
    if not rows:
        raise HTTPException(status_code=422, detail="Transcript did not contain product order lines.")
    order = _update_order_stats(
        ProcessedOrder(
            id=str(uuid.uuid4()),
            fileName=file.filename or "Audio Order",
            createdAt=datetime.now(timezone.utc),
            productCount=0,
            averageConfidence=0,
            rows=rows,
            source=OrderSource.audio,
            transcript=transcript,
        )
    )
    services.orders.upsert(order)
    return order


@router.post("/orders/process-transcript", response_model=ProcessedOrder)
def process_transcript_order(
    transcript: str = Form(...),
    file_name: str = Form("Audio Transcript"),
) -> ProcessedOrder:
    rows, _ = services.audio_processor.transcript_to_rows(transcript)
    if not rows:
        raise HTTPException(status_code=422, detail="Transcript did not contain product order lines.")
    order = _update_order_stats(
        ProcessedOrder(
            id=str(uuid.uuid4()),
            fileName=file_name,
            createdAt=datetime.now(timezone.utc),
            productCount=0,
            averageConfidence=0,
            rows=rows,
            source=OrderSource.audio,
            transcript=transcript,
        )
    )
    services.orders.upsert(order)
    return order


@router.post("/live/sessions", response_model=LiveSessionResponse)
def create_live_session(payload: LiveSessionRequest) -> LiveSessionResponse:
    return services.live_processor.create(payload.fileName)


@router.post("/live/sessions/{session_id}/transcript", response_model=LiveSessionResponse)
def process_live_transcript(session_id: str, payload: LiveTextRequest) -> LiveSessionResponse:
    try:
        response = services.live_processor.apply_text(session_id, payload.text, payload.rows)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Live session not found.") from exc
    services.orders.upsert(response.order)
    return response


@router.post("/live/sessions/{session_id}/chunk", response_model=LiveSessionResponse)
def process_live_audio_chunk(
    session_id: str,
    file: UploadFile = File(...),
    rows_json: str = Form("[]"),
) -> LiveSessionResponse:
    target = _save_upload(file)
    transcript, _ = _best_audio_rows(target)
    if not transcript:
        raise HTTPException(status_code=422, detail=services.whisper.setup_message())
    try:
        rows = [RecognitionRow.model_validate(item) for item in json.loads(rows_json)]
    except Exception:
        rows = []
    try:
        response = services.live_processor.apply_text(session_id, transcript, rows)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Live session not found.") from exc
    services.orders.upsert(response.order)
    return response


@router.post("/live/sessions/{session_id}/stop", response_model=ProcessedOrder)
def stop_live_session(session_id: str) -> ProcessedOrder:
    try:
        order = services.live_processor.get(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Live session not found.") from exc
    services.orders.upsert(order)
    return order


@router.patch("/orders/{order_id}/rows", response_model=ProcessedOrder)
def update_rows(order_id: str, payload: RowsUpdate) -> ProcessedOrder:
    try:
        order = services.orders.get(order_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Order not found.") from exc

    merged_rows = services.event_processor.merge_duplicate_rows(payload.rows)
    for row in merged_rows:
        if row.matchedProduct and row.confidence >= 100:
            services.aliases.learn(row.ocrText, row.matchedProduct.name)

    updated = order.model_copy(update={"rows": merged_rows})
    _update_order_stats(updated)
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
