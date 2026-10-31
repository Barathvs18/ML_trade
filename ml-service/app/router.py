import asyncio
import time
from fastapi import APIRouter,Depends,HTTPException,Request
from app.auth import require_api_key
from app.cache import PredictionCache
from app.config import settings
from app.models.direction import summarize_forecasts
from app.schemas import PredictRequest,PredictResponse

router=APIRouter()

def _compute(app,request:PredictRequest)->dict:
    if request.horizon in (5,10):
        model=app.state.kronos
        if not model or not model.available:raise RuntimeError("Kronos model is unavailable")
        paths=model.forecast_paths([c.model_dump() for c in request.candles],1 if request.horizon==5 else 2,settings.kronos_samples)
        result=summarize_forecasts(paths,request.candles[-1].c)
        result["model"]="kronos"
    else:
        model=app.state.lpatchtst
        if not model or not model.available:raise RuntimeError("LPatchTST model is unavailable")
        forecast=model.forecast_close([c.model_dump() for c in request.candles])
        result=summarize_forecasts([forecast],request.candles[-1].c)
        # LPatchTST's single forecast has no path distribution; direction.py applies a neutral 0.5 fallback.
        result["confidence"]="medium";result["model"]="lpatchtst"
    result["horizon"]=request.horizon
    return result

@router.post("/predict",response_model=PredictResponse,dependencies=[Depends(require_api_key)])
async def predict(request:PredictRequest,raw_request:Request):
    app=raw_request.app
    if request.horizon in (5,10):available=getattr(app.state,"kronos",None) and app.state.kronos.available
    else:available=getattr(app.state,"lpatchtst",None) and app.state.lpatchtst.available
    if not available:raise HTTPException(503,detail=f"Model for horizon {request.horizon} is unavailable")
    key=(request.symbol.upper(),request.horizon,request.candles[-1].t.isoformat())
    cache:PredictionCache=app.state.cache
    started=time.perf_counter()
    async def compute():
        async with app.state.semaphore:
            loop=asyncio.get_running_loop()
            return await loop.run_in_executor(None,_compute,app,request)
    try:result=await cache.get_or_compute(key,compute)
    except Exception as exc:raise HTTPException(503,detail=f"Model inference failed: {type(exc).__name__}") from exc
    return {**result,"latency_ms":max(0,int((time.perf_counter()-started)*1000))}
