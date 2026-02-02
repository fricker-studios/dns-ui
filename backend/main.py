import logging

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers.zones import router as zones_router
from backend.routers.recordsets import router as recordsets_router
from backend.routers.exports import router as exports_router
from backend.routers.config import router as config_router
from backend.settings import settings

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s",
)
logger = logging.getLogger(__name__)

# Initialize Sentry
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        profiles_sample_rate=settings.sentry_profiles_sample_rate,
        enable_tracing=True,
    )
    logger.info(f"Sentry initialized for environment: {settings.sentry_environment}")
else:
    logger.warning("Sentry DSN not configured, error tracking disabled")

app = FastAPI(title="BIND File-Backed DNS API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(zones_router)
app.include_router(recordsets_router)
app.include_router(exports_router)
app.include_router(config_router)


@app.on_event("startup")
async def startup_event():
    logger.info("DNS API starting up")
    logger.info(f"Log level: {settings.log_level}")
    logger.info(f"Named conf: {settings.named_conf}")
    logger.info(f"Managed zone dir: {settings.managed_zone_dir}")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("DNS API shutting down")


@app.get("/healthz")
def healthz():
    logger.debug("Health check requested")
    return {
        "ok": True,
        "named_conf": settings.named_conf,
        "managed_include": settings.managed_include,
        "managed_zone_dir": settings.managed_zone_dir,
    }
