import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.routers import (
    admin_auth,
    admin_catalog,
    admin_notifications,
    admin_orders,
    delivery,
    orders,
    public_catalog,
)
from app.services import notifications

# Show the shop's own log lines (emails sent/failed) next to uvicorn's.
logging.getLogger("mordjane").setLevel(logging.INFO)
if not logging.getLogger("mordjane").handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    logging.getLogger("mordjane").addHandler(_handler)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    # Give emails that are still being sent a moment to finish before the process exits.
    await notifications.drain(timeout=10)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Mordjane Store API", version="0.1.0", lifespan=lifespan)

    # The Next.js app proxies /api and /media, so CORS only matters for direct dev access.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    api = APIRouter(prefix="/api")
    for module in (
        public_catalog,
        orders,
        admin_auth,
        admin_catalog,
        admin_orders,
        admin_notifications,
    ):
        api.include_router(module.router)
    api.include_router(delivery.public)
    api.include_router(delivery.admin)
    api.include_router(delivery.admin_delegations)

    @api.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @api.get("/config", tags=["meta"])
    async def public_config() -> dict[str, str]:
        return {"currency": settings.currency}

    app.include_router(api)

    settings.media_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")
    return app


app = create_app()
