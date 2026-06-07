import json
from pathlib import Path


class AliasStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.aliases: dict[str, str] = {}

    def load(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self.path.exists():
            self.aliases = json.loads(self.path.read_text(encoding="utf-8"))
        else:
            self.save()

    def save(self) -> None:
        self.path.write_text(json.dumps(self.aliases, indent=2), encoding="utf-8")

    def learn(self, raw_text: str, product_name: str) -> None:
        key = raw_text.strip().lower()
        if key and self.aliases.get(key) != product_name:
            self.aliases[key] = product_name
            self.save()
