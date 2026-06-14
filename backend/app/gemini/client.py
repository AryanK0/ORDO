import json
from pathlib import Path
import re

from app.models.schemas import StructuredItem
from app.matching.catalog import ProductCatalog


class GeminiValidator:
    def __init__(self, api_key: str | None, model: str) -> None:
        self.api_key = api_key
        self.model = model

    def structure(self, lines: list[str], catalog: ProductCatalog | None = None) -> list[StructuredItem]:
        cleaned_lines = [line for line in lines if line.strip()]
        if not cleaned_lines:
            return []
        if not self.api_key:
            return [self._parse_line(line) for line in cleaned_lines]
        try:
            import google.generativeai as genai

            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel(self.model)
            
            catalog_prompt = ""
            if catalog and catalog.products:
                catalog_json = json.dumps([
                    {"id": p.id, "name": p.name, "pack": p.pack} 
                    for p in catalog.products
                ])
                catalog_prompt = (
                    "You MUST map each extracted item to a product from the following catalog.\n"
                    "Your JSON output for each item MUST have three keys: `text`, `quantity`, and `catalogId`.\n"
                    "`catalogId` MUST be the ID of the best matching product from the catalog below.\n"
                    "Even if the name is slightly different or contains pack sizes, find the best logical match. Do NOT set `catalogId` to null unless the item is completely unrecognized.\n"
                    f"Catalog:\n{catalog_json}\n\n"
                )

            prompt = (
                "Extract pharmaceutical order items as a JSON array. Each object MUST contain `text`, `quantity`, and `catalogId`. "
                "Ignore HSN, GST, MRP, rate, discount, serial numbers, totals, and addresses. Quantity means ordered quantity only. "
                "Return JSON array only.\n\n"
                + catalog_prompt
                + "\n".join(cleaned_lines)
            )
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    response_mime_type="application/json",
                )
            )
            parsed = self._loads_json(response.text or "[]")
            return [StructuredItem.model_validate(item) for item in parsed]
        except Exception:
            return [self._parse_line(line) for line in cleaned_lines]

    def extract_file_items(self, file_path: Path, catalog: ProductCatalog | None = None) -> list[StructuredItem]:
        if not self.api_key:
            return []
        try:
            import google.generativeai as genai

            genai.configure(api_key=self.api_key)
            uploaded = genai.upload_file(str(file_path))
            model = genai.GenerativeModel(self.model)
            
            catalog_prompt = ""
            if catalog and catalog.products:
                catalog_json = json.dumps([
                    {"id": p.id, "name": p.name, "pack": p.pack} 
                    for p in catalog.products
                ])
                catalog_prompt = (
                    "You MUST map each extracted item to a product from the following catalog.\n"
                    "Your JSON output for each item MUST have three keys: `text`, `quantity`, and `catalogId`.\n"
                    "`catalogId` MUST be the ID of the best matching product from the catalog below.\n"
                    "Even if the name is slightly different or contains pack sizes, find the best logical match. Do NOT set `catalogId` to null unless the item is completely unrecognized.\n"
                    f"Catalog:\n{catalog_json}\n\n"
                )

            response = model.generate_content(
                [
                    uploaded,
                    (
                        "Read this pharmaceutical purchase/order document. Return JSON only as an "
                        "array of objects. Each object MUST contain keys `text`, `quantity`, and `catalogId`. `text` is the product name or "
                        "abbreviation as written. `quantity` is the ordered quantity. Do not use HSN, "
                        "GST, MRP, rate, amount, serial number, pack size, or totals as quantity.\n"
                        "IMPORTANT: If a single physical line contains two distinct items, separate them into two objects.\n\n"
                        + catalog_prompt
                    ),
                ],
                generation_config=genai.types.GenerationConfig(
                    response_mime_type="application/json",
                )
            )
            parsed = self._loads_json(response.text or "[]")
            return [StructuredItem.model_validate(item) for item in parsed if str(item.get("text", "")).strip()]
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
                
        match_start = re.match(rf"^(?:qty\s*|-)?\s*(\d+)\s*(?:x\s*)?(?:{units}(?:\s+{units})*)?\s+(?:of\s+)?", cleaned, re.IGNORECASE)
        if match_start:
            quantity = max(1, int(match_start.group(1)))
            text = cleaned[match_start.end():].strip(" -")
            if text:
                return StructuredItem(text=text, quantity=quantity)

        return StructuredItem(text=cleaned, quantity=1)
