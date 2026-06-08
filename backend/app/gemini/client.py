import json
from pathlib import Path
import re

from app.models.schemas import StructuredItem


class GeminiValidator:
    def __init__(self, api_key: str | None, model: str) -> None:
        self.api_key = api_key
        self.model = model

    def structure(self, lines: list[str]) -> list[StructuredItem]:
        cleaned_lines = [line for line in lines if line.strip()]
        if not cleaned_lines:
            return []
        if not self.api_key:
            return [self._parse_line(line) for line in cleaned_lines]
        try:
            import google.generativeai as genai

            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel(self.model)
            prompt = (
                "Extract pharmaceutical order items as a JSON array. Each item must "
                "contain text and quantity. Ignore HSN, GST, MRP, rate, discount, "
                "serial numbers, totals, and addresses. Quantity means ordered quantity only. "
                "Return JSON only.\n\n"
                + "\n".join(cleaned_lines)
            )
            response = model.generate_content(prompt)
            parsed = self._loads_json(response.text or "[]")
            return [StructuredItem.model_validate(item) for item in parsed]
        except Exception:
            return [self._parse_line(line) for line in cleaned_lines]

    def extract_file_lines(self, file_path: Path) -> list[str]:
        if not self.api_key:
            return []
        try:
            import google.generativeai as genai

            genai.configure(api_key=self.api_key)
            uploaded = genai.upload_file(str(file_path))
            model = genai.GenerativeModel(self.model)
            response = model.generate_content(
                [
                    uploaded,
                    (
                        "Read this pharmaceutical purchase/order document. Return JSON only as an "
                        "array of objects with keys text and quantity. text is the product name or "
                        "abbreviation as written. quantity is the ordered quantity. Do not use HSN, "
                        "GST, MRP, rate, amount, serial number, pack size, or totals as quantity."
                    ),
                ]
            )
            parsed = self._loads_json(response.text or "[]")
            items = [StructuredItem.model_validate(item) for item in parsed]
            return [f"{item.text} {item.quantity}" for item in items if item.text.strip()]
        except Exception:
            return []

    def _loads_json(self, text: str):
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
            cleaned = re.sub(r"```$", "", cleaned).strip()
        return json.loads(cleaned)

    def _parse_line(self, line: str) -> StructuredItem:
        cleaned = re.sub(r"\s+", " ", line.replace("–", "-")).strip(" -")
        units = r"(?:nos?|pcs?|pice|pie|pic|pc|btls?|strips?|tabs?|box|boc|bkx|beg|bags?|cse|case|caps?|ont|gm|ml|pack|pkts?)"
        match = re.search(rf"(?:-| x | qty )?\s*(\d+)\s*(?:{units}(?:\s+{units})*)?\s*$", cleaned, re.IGNORECASE)
        if match:
            quantity = max(1, int(match.group(1)))
            text = cleaned[: match.start()].strip(" -")
            if text:
                return StructuredItem(text=text, quantity=quantity)
        return StructuredItem(text=cleaned, quantity=1)
