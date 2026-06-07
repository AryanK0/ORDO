from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import configure_services, router
from app.core.config import get_settings
from app.excel.workbook import WorkbookGenerator
from app.gemini.client import GeminiValidator
from app.matching.aliases import AliasStore
from app.matching.catalog import ProductCatalog
from app.ocr.paddle_service import PaddleOCRService
from app.storage.repository import OrderRepository


def create_app() -> FastAPI:
    settings = get_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    settings.downloads_dir.mkdir(parents=True, exist_ok=True)

    catalog = ProductCatalog(settings.master_workbook_path, settings.products_path)
    aliases = AliasStore(settings.aliases_path)
    orders = OrderRepository(settings.orders_path)
    catalog.load()
    aliases.load()
    orders.load()

    configure_services(
        catalog=catalog,
        aliases=aliases,
        ocr=PaddleOCRService(),
        gemini=GeminiValidator(settings.gemini_api_key, settings.gemini_model),
        orders=orders,
        workbooks=WorkbookGenerator(settings.master_workbook_path, settings.downloads_dir),
        uploads_dir=settings.uploads_dir,
        downloads_dir=settings.downloads_dir,
    )

    app = FastAPI(title="ORDO API", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router, prefix=settings.api_prefix)

    @app.get("/health")
    def health():
        return {"status": "ok", "service": settings.app_name}

    return app


app = create_app()
