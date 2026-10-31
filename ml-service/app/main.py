import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.cache import PredictionCache
from app.config import settings
from app.models.kronos_model import KronosModel
from app.models.lpatchtst_model import LPatchTSTModel
from app.router import router

@asynccontextmanager
async def lifespan(app:FastAPI):
    app.state.semaphore=asyncio.Semaphore(max(1,settings.max_concurrency))
    app.state.cache=PredictionCache(settings.cache_ttl_seconds)
    try:
        app.state.kronos=KronosModel.load() if settings.model_mock else KronosModel(available=False)
    except Exception:app.state.kronos=KronosModel(available=False)
    try:
        app.state.lpatchtst=LPatchTSTModel.load() if settings.model_mock else LPatchTSTModel(available=False)
    except Exception:app.state.lpatchtst=LPatchTSTModel(available=False)
    yield

def create_app()->FastAPI:
    application=FastAPI(title="AlgoPredict ML Service",version="1.0.0",lifespan=lifespan)
    application.include_router(router)
    @application.get("/health")
    async def health():
        kronos=getattr(application.state,"kronos",None);lpatch=getattr(application.state,"lpatchtst",None)
        ready=kronos is not None and kronos.available and lpatch is not None and lpatch.available
        return {"status":"ok" if ready else "degraded","models":{"kronos":bool(kronos and kronos.available),"lpatchtst":bool(lpatch and lpatch.available)},"device":"cpu"}
    return application

app=create_app()
