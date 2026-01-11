from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers.zones import router as zones_router
from backend.routers.recordsets import router as recordsets_router
from backend.routers.exports import router as exports_router
from backend.routers.config import router as config_router
from backend.settings import settings


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


@app.get("/healthz")
def healthz():
    return {
        "ok": True,
        "named_conf": settings.named_conf,
        "managed_include": settings.managed_include,
        "managed_zone_dir": settings.managed_zone_dir,
    }
