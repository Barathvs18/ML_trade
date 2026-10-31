import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.cache import PredictionCache
from app.config import settings
from app.models.kronos_model import KronosModel
from app.router import router

logger=logging.getLogger("algopredict.ml")

@asynccontextmanager
async def lifespan(app:FastAPI):
    if not settings.ml_api_key.strip():
        logger.critical("ML_API_KEY is missing; refusing to start without API authentication")
        raise RuntimeError("ML_API_KEY is required before the ML service can start")
    import torch
    torch.set_num_threads(2)
    app.state.semaphore=asyncio.Semaphore(max(1,settings.max_concurrency))
    app.state.cache=PredictionCache(settings.cache_ttl_seconds)
    try:
        app.state.kronos=KronosModel.load()
    except Exception as exc:
        logger.error("Kronos model initialization failed; all horizons are unavailable (%s)",type(exc).__name__)
        app.state.kronos=KronosModel(mock=False,available=False)
    yield

def create_app()->FastAPI:
    application=FastAPI(title="AlgoPredict ML Service",version="1.0.0",lifespan=lifespan)
    application.include_router(router)
    @application.get("/health")
    async def health():
        kronos=getattr(application.state,"kronos",None)
        ready=bool(kronos and kronos.available)
        return {"status":"ok" if ready else "degraded","models":{"kronos":ready},"device":"cpu"}
    return application

app=create_app()
