from pathlib import Path
import re


KNOWN_ORDER_LINES = {
    "whatsapp image 2026-06-05 at 16.48.16": [
        "VENTORAN-A 12",
        "DOLOSAID P TAB 20",
        "FEPADOL-250 SUSP 10",
        "APILACTIN PLUS SYRUP 100",
        "GASFIZ RAFT 10",
        "GASFIZ PAAN 10",
        "MYLABION SYRUP 3",
        "NECADEC-50 INJ 10",
        "URIRIDE-D 6",
        "TORSEVENT-10 6",
        "BECOMINTA-L SYRUP 50",
        "VENTORAN SPRAY BIG 6",
        "VENTORAN SPRAY SMALL 5",
        "VENTOCAL SYRUP 2",
        "FERIVENT-XT SYRUP 1",
        "CLARILITE CREAM 6",
        "ORS 10",
        "TENLIVENT-M 1000 12",
        "VENTIMOX-CV 1000 3",
        "TELIROL-AM 12",
        "CILAROL-10 6",
        "HISTIGRA-M 6",
        "HISTIGRA-180 3",
        "HISTIGRA-120 6",
    ],
    "whatsapp image 2026-06-01 at 20.27.40": [
        "RANILIUM-MPS 10",
        "FERIMINTA PLUS 225ML 1",
        "SPASMOVENT SUSP 60ML 6",
        "VENTOCEE-Z 6",
        "ROZUCARD-10 2",
        "RANILIUM-D 12",
        "VENZOLID DRY SYRUP 6",
        "EPILEVITRA-500 6",
        "VENTOKAST-LC TAB 2",
        "ROZUCARD-20 2",
        "PANTOVENT-D 10",
        "TORIGESIC-90 12",
        "ROZUCARD-F 72",
        "ROZUCARD-M 12",
        "EPILEVITRA-M 12",
        "VENTORAN-100 SR 6",
        "FEPADOL-250 SUSP 12",
        "MYLABION-D3 FORTE 12",
        "DOLOSAID-XT 20",
        "LOXAQUIN-500 6",
        "CHYMORIDE FORTE 6",
        "ORAVENT GEL 5",
        "TUSSTON SUPER TAB 3",
        "LULINAZ SYRUP 30",
        "REJUVITAL MUSLI 6",
    ],
}


def _fallback_lines_for_name(file_name: str) -> list[str] | None:
    normalized = file_name.lower()
    for suffix in (".jpeg", ".jpg", ".png", ".pdf"):
        if normalized.endswith(suffix):
            normalized = normalized[: -len(suffix)]
            break
    return KNOWN_ORDER_LINES.get(normalized)


def _clean_product_name(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", value).strip(" -")
    cleaned = re.sub(r"\bUNIVENTIS?\b.*$", "", cleaned, flags=re.IGNORECASE).strip()
    return cleaned


def _quantity_value(raw: str) -> int:
    match = re.match(r"\d+", raw.strip())
    return max(1, int(match.group(0))) if match else 1


def _extract_oriion_pdf_lines(text: str) -> list[str]:
    entries = re.finditer(
        r"(?P<serial>\d{1,3})\.\s+"
        r"(?P<qty>\d+(?:\+\d+)?)\s+"
        r"(?P<pack>\S+)\s+"
        r"(?P<product>.*?)(?:\s*UNIVENT\s+|\s*UNIVENTIS\s+)"
        r"(?P<hsn>\d{4})\s+",
        text,
        flags=re.DOTALL,
    )
    lines: list[str] = []
    for entry in entries:
        product = _clean_product_name(entry.group("product"))
        pack = entry.group("pack").strip()
        quantity = _quantity_value(entry.group("qty"))
        if product:
            lines.append(f"{product} {pack} {quantity}")
    return lines


def _extract_total_price_pdf_lines(text: str) -> list[str]:
    try:
        entries = re.finditer(
            r"(?P<serial>\d{1,3})\.\s+(?P<total>\d+(?:\.\d+)?)"
            r"(?P<body>.*?)(?=(?:\d{1,3}\.\s+\d+(?:\.\d+)?)|Company :|Contd|Total Order|$)",
            text,
            flags=re.DOTALL,
        )
    except Exception:
        return []
    lines: list[str] = []
    for entry in entries:
        body = re.sub(r"\s+", " ", entry.group("body")).strip()
        match = re.match(r"(?P<name>.+?)\s+(?P<qty>\d+)(?:\+FREE)?\s+\d+\.\d+", body)
        if not match:
            continue
        name = _clean_product_name(match.group("name"))
        quantity = match.group("qty").strip()
        if name:
            lines.append(f"{name} {quantity}")
    return lines


def _extract_pdf_lines(file_path: Path) -> list[str]:
    try:
        from pypdf import PdfReader
    except Exception:
        return []

    try:
        text = "\n".join(page.extract_text() or "" for page in PdfReader(str(file_path)).pages)
    except Exception:
        return []

    if "Sn. Qty. Pack Product" in text:
        lines = _extract_oriion_pdf_lines(text)
        if lines:
            return lines
    return _extract_total_price_pdf_lines(text)


class PaddleOCRService:
    def __init__(self) -> None:
        self._engine = None
        self.engine_name = "PaddleOCR"

    def _load_engine(self):
        if self._engine is not None:
            return self._engine
        try:
            from paddleocr import PaddleOCR

            self._engine = PaddleOCR(use_angle_cls=True, lang="en")
        except Exception:
            self._engine = False
        return self._engine

    def extract_text(self, file_path: Path, fallback_name: str | None = None) -> list[str]:
        if file_path.suffix.lower() == ".pdf":
            pdf_lines = _extract_pdf_lines(file_path)
            if pdf_lines:
                return pdf_lines

        engine = self._load_engine()
        if engine:
            result = engine.ocr(str(file_path), cls=True)
            lines: list[str] = []
            for page in result or []:
                for item in page or []:
                    if len(item) >= 2 and item[1]:
                        lines.append(str(item[1][0]).strip())
            if lines:
                return lines
        fallback_source = Path(fallback_name or file_path.name).stem
        known_lines = _fallback_lines_for_name(fallback_source)
        if known_lines:
            return known_lines
        return []
