from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "ORDO"
    api_prefix: str = "/api"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-latest"
    whisper_model: str = "tiny"
    master_workbook_path: Path = BACKEND_DIR / "data" / "master.xlsx"
    data_dir: Path = BACKEND_DIR / "data"
    cors_origins: str = "*"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def downloads_dir(self) -> Path:
        return self.data_dir / "downloads"

    @property
    def products_path(self) -> Path:
        return self.data_dir / "products.json"

    @property
    def aliases_path(self) -> Path:
        return self.data_dir / "aliases.json"

    @property
    def orders_path(self) -> Path:
        return self.data_dir / "orders.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
