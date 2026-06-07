from app.events.order_events import OrderEventProcessor
from app.models.schemas import RecognitionRow, SmartOrderEvent


class AudioProcessor:
    def __init__(self, event_processor: OrderEventProcessor) -> None:
        self.event_processor = event_processor

    def transcript_to_rows(self, transcript: str) -> tuple[list[RecognitionRow], list[SmartOrderEvent]]:
        events = self.event_processor.text_to_events(transcript)
        return self.event_processor.events_to_rows(events), events
