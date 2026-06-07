import json
from pathlib import Path

from app.models.schemas import ProcessedOrder


class OrderRepository:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.orders: list[ProcessedOrder] = []

    def load(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self.path.exists():
            self.orders = [
                ProcessedOrder.model_validate(item)
                for item in json.loads(self.path.read_text(encoding="utf-8"))
            ]
        else:
            self.save()

    def save(self) -> None:
        self.path.write_text(
            json.dumps([order.model_dump(mode="json") for order in self.orders], indent=2),
            encoding="utf-8",
        )

    def all(self) -> list[ProcessedOrder]:
        return sorted(self.orders, key=lambda order: order.createdAt, reverse=True)[:25]

    def get(self, order_id: str) -> ProcessedOrder:
        for order in self.orders:
            if order.id == order_id:
                return order
        raise KeyError(order_id)

    def upsert(self, order: ProcessedOrder) -> None:
        self.orders = [existing for existing in self.orders if existing.id != order.id]
        self.orders.insert(0, order)
        self.orders = self.orders[:25]
        self.save()
