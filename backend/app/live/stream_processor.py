import uuid
from datetime import datetime, timezone

from app.events.order_events import OrderEventProcessor
from app.models.schemas import (
    LiveSessionResponse,
    OrderSource,
    ProcessedOrder,
    RecognitionRow,
    SmartOrderEvent,
)


class LiveStreamProcessor:
    def __init__(self, event_processor: OrderEventProcessor) -> None:
        self.event_processor = event_processor
        self.sessions: dict[str, ProcessedOrder] = {}
        self.transcripts: dict[str, str] = {}

    def create(self, file_name: str) -> LiveSessionResponse:
        session_id = str(uuid.uuid4())
        order = ProcessedOrder(
            id=session_id,
            fileName=file_name,
            createdAt=datetime.now(timezone.utc),
            productCount=0,
            averageConfidence=0,
            rows=[],
            source=OrderSource.live,
            transcript="",
        )
        self.sessions[session_id] = order
        self.transcripts[session_id] = ""
        return LiveSessionResponse(sessionId=session_id, transcript="", order=order, events=[])

    def apply_text(
        self,
        session_id: str,
        text: str,
        rows: list[RecognitionRow] | None = None,
    ) -> LiveSessionResponse:
        order = self.sessions[session_id]
        transcript = "\n".join(part for part in [self.transcripts.get(session_id, ""), text.strip()] if part)
        events = self.event_processor.text_to_events(text)
        base_rows = rows if rows is not None and rows else order.rows
        order.rows = self.event_processor.events_to_rows(events, base_rows)
        order.transcript = transcript
        order.productCount = sum(1 for row in order.rows if row.matchedProduct)
        order.averageConfidence = self._average(order.rows)
        self.transcripts[session_id] = transcript
        self.sessions[session_id] = order
        return LiveSessionResponse(sessionId=session_id, transcript=transcript, order=order, events=events)

    def get(self, session_id: str) -> ProcessedOrder:
        return self.sessions[session_id]

    def _average(self, rows: list[RecognitionRow]) -> int:
        if not rows:
            return 0
        return round(sum(row.confidence for row in rows) / len(rows))
