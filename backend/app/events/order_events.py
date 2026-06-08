import re
import uuid

from app.matching.matcher import ProductMatcher
from app.models.schemas import (
    OrderEventType,
    RecognitionRow,
    SmartOrderEvent,
    StructuredItem,
)


HINDI_NUMBERS = {
    "ek": 1,
    "one": 1,
    "do": 2,
    "two": 2,
    "teen": 3,
    "tin": 3,
    "three": 3,
    "char": 4,
    "chaar": 4,
    "four": 4,
    "paanch": 5,
    "panch": 5,
    "five": 5,
    "che": 6,
    "chhe": 6,
    "six": 6,
    "saat": 7,
    "seven": 7,
    "aath": 8,
    "eight": 8,
    "nau": 9,
    "nine": 9,
    "das": 10,
    "dus": 10,
    "ten": 10,
    "gyarah": 11,
    "eleven": 11,
    "barah": 12,
    "bara": 12,
    "twelve": 12,
    "pandrah": 15,
    "pandara": 15,
    "fifteen": 15,
    "bees": 20,
    "bis": 20,
    "twenty": 20,
    "tees": 30,
    "thirty": 30,
    "chalis": 40,
    "forty": 40,
    "pachas": 50,
    "fifty": 50,
    "sau": 100,
    "hundred": 100,
}

NOISE_PATTERNS = [
    r"\bhello\b",
    r"\bhaan\b",
    r"\bkaise\b",
    r"\bpayment\b",
    r"\bupi\b",
    r"\baccount\b",
    r"\bbhej\b",
    r"\bkal\b",
    r"\bdelivery\b",
    r"\baddress\b",
    r"\bbill\b",
    r"\bdiscount\b",
    r"\btotal\b",
    r"\bmrp\b",
    r"\bgst\b",
    r"\bhsn\b",
]

REMOVE_WORDS = {"hata", "remove", "delete", "cancel", "nikal"}
INCREASE_WORDS = {"aur", "add", "plus", "more", "increase", "badha"}
DECREASE_WORDS = {"kam", "minus", "less", "decrease", "reduce"}
UPDATE_WORDS = {"nahi", "nahin", "not", "instead", "change", "correct", "correction"}


def _normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _replace_number_words(value: str) -> str:
    words = []
    for word in re.split(r"(\W+)", value):
        number = HINDI_NUMBERS.get(word.lower())
        words.append(str(number) if number is not None else word)
    return "".join(words)


def _normalize_voice_errors(value: str) -> str:
    normalized = value
    normalized = re.sub(
        r"\b(?:calcevent|kelcevent|calci\s*vent|calcy\s*went|kelsey\s*went|galc\s*vent|kelsi\s*vent|klc-?\s*vent)\b",
        "CALCIVENT",
        normalized,
        flags=re.IGNORECASE,
    )
    normalized = re.sub(
        r"\bCALCIVENT\s+K\s*24\b",
        "CALCIVENT K2 FORTE 4",
        normalized,
        flags=re.IGNORECASE,
    )
    normalized = re.sub(
        r"\bCALCIVENT\s+K2\s*4D\b",
        "CALCIVENT K2 FORTE 4",
        normalized,
        flags=re.IGNORECASE,
    )
    normalized = re.sub(
        r"\bCALCIVENT\s+K-?2-?4\b",
        "CALCIVENT K2 FORTE 4",
        normalized,
        flags=re.IGNORECASE,
    )
    return normalized


def _compact_key(value: str) -> str:
    return "".join(character for character in value.lower() if character.isalnum())


class OrderEventExtractor:
    def filter_lines(self, text: str) -> list[str]:
        lines: list[str] = []
        for raw_line in re.split(r"[\n\r.;]+", text):
            line = _normalize_space(_normalize_voice_errors(_replace_number_words(raw_line.replace("â€“", "-"))))
            if not line:
                continue
            lowered = line.lower()
            has_order_signal = bool(re.search(r"\d", line)) or any(word in lowered for word in REMOVE_WORDS)
            if not has_order_signal:
                continue
            if any(re.search(pattern, lowered) for pattern in NOISE_PATTERNS) and not re.search(r"\d", line):
                continue
            lines.append(line)
        return lines

    def extract_events(self, text: str) -> list[SmartOrderEvent]:
        events: list[SmartOrderEvent] = []
        for line in self.filter_lines(text):
            for part in self._split_compound_line(line):
                event = self._line_to_event(part)
                if event:
                    events.append(event)
        return events

    def _split_compound_line(self, line: str) -> list[str]:
        parts = [
            _normalize_space(part)
            for part in re.split(r"\b(?:aur|and)\b|,", line, flags=re.IGNORECASE)
        ]
        valid_parts = [
            part
            for part in parts
            if re.search(r"\d", part) and re.search(r"[A-Za-z]", part)
        ]
        if valid_parts and len(parts) > 1:
            return valid_parts
        return [line]

    def _line_to_event(self, line: str) -> SmartOrderEvent | None:
        lowered = line.lower()
        numbers = [int(match) for match in re.findall(r"\b\d+\b", line)]
        words = set(re.findall(r"[a-zA-Z]+", lowered))

        event_type = OrderEventType.add_product
        if words & REMOVE_WORDS:
            event_type = OrderEventType.remove_product
        elif words & UPDATE_WORDS and numbers:
            event_type = OrderEventType.update_product
        elif words & INCREASE_WORDS and numbers:
            event_type = OrderEventType.increase_qty
        elif words & DECREASE_WORDS and numbers:
            event_type = OrderEventType.decrease_qty

        if event_type == OrderEventType.remove_product:
            text = re.split(r"\b(?:hata|remove|delete|cancel|nikal)\b", line, flags=re.IGNORECASE)[0]
            text = _normalize_space(re.sub(r"\b\d+\b", "", text).strip(" -"))
            if not text:
                return None
            return SmartOrderEvent(event=event_type, text=text, quantity=1, rawText=line)

        if not numbers:
            return None
        quantity = max(1, numbers[-1])
        text = line[: line.rfind(str(numbers[-1]))]
        text = re.sub(
            r"\b(?:aur|add|plus|more|increase|badha|kam|minus|less|decrease|reduce|"
            r"nahi|nahin|not|instead|change|correct|correction)\b",
            " ",
            text,
            flags=re.IGNORECASE,
        )
        text = _normalize_space(text.strip(" -"))
        if not text:
            return None
        return SmartOrderEvent(event=event_type, text=text, quantity=quantity, rawText=line)


class OrderEventProcessor:
    def __init__(self, matcher: ProductMatcher) -> None:
        self.matcher = matcher
        self.extractor = OrderEventExtractor()

    def items_to_rows(self, items: list[StructuredItem]) -> list[RecognitionRow]:
        rows: list[RecognitionRow] = []
        for item in items:
            product, score, suggestions = self.matcher.best(item.text)
            rows.append(
                RecognitionRow(
                    id=str(uuid.uuid4()),
                    ocrText=item.text,
                    matchedProduct=product,
                    quantity=item.quantity,
                    confidence=round(score),
                    suggestions=suggestions,
                )
            )
        return self.merge_duplicate_rows(rows, strict_text_match=True)

    def text_to_events(self, text: str) -> list[SmartOrderEvent]:
        return self.extractor.extract_events(text)

    def events_to_rows(
        self,
        events: list[SmartOrderEvent],
        existing_rows: list[RecognitionRow] | None = None,
    ) -> list[RecognitionRow]:
        rows = [row.model_copy(deep=True) for row in existing_rows or []]
        for event in events:
            product, score, suggestions = self.matcher.best(event.text)
            key = product.id if product else _compact_key(event.text)
            index = self._find_row_index(rows, key)

            if event.event == OrderEventType.remove_product:
                if index is not None:
                    rows.pop(index)
                continue

            if index is None:
                rows.append(
                    RecognitionRow(
                        id=str(uuid.uuid4()),
                        ocrText=event.rawText,
                        matchedProduct=product,
                        quantity=event.quantity,
                        confidence=round(score),
                        suggestions=suggestions,
                    )
                )
                continue

            row = rows[index]
            if event.event == OrderEventType.increase_qty:
                row.quantity += event.quantity
            elif event.event == OrderEventType.decrease_qty:
                row.quantity = max(1, row.quantity - event.quantity)
            elif event.event == OrderEventType.add_product:
                row.quantity += event.quantity
            else:
                row.quantity = event.quantity
            row.ocrText = f"{row.ocrText}; {event.rawText}" if row.ocrText else event.rawText
            if product:
                row.matchedProduct = product
                row.confidence = max(row.confidence, round(score))
                row.suggestions = suggestions
        return self.merge_duplicate_rows(rows)

    def merge_duplicate_rows(self, rows: list[RecognitionRow], strict_text_match: bool = False) -> list[RecognitionRow]:
        merged: dict[str, RecognitionRow] = {}
        order: list[str] = []
        for row in rows:
            if strict_text_match:
                key = _compact_key(row.ocrText)
            else:
                key = row.matchedProduct.id if row.matchedProduct else _compact_key(row.ocrText)
            if not key:
                key = row.id
            if key not in merged:
                merged[key] = row.model_copy(deep=True)
                order.append(key)
                continue
            existing = merged[key]
            existing.quantity += row.quantity
            existing.confidence = max(existing.confidence, row.confidence)
            existing.ocrText = "; ".join(part for part in [existing.ocrText, row.ocrText] if part)
            if row.suggestions:
                existing.suggestions = row.suggestions
        return [merged[key] for key in order]

    def _find_row_index(self, rows: list[RecognitionRow], key: str) -> int | None:
        for index, row in enumerate(rows):
            row_key = row.matchedProduct.id if row.matchedProduct else _compact_key(row.ocrText)
            if row_key == key:
                return index
        return None
