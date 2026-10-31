import asyncio, httpx
from app.config import settings
from app.modules.predictions.ml_mock import predict_mock

async def predict(symbol, horizon, candles):
    if settings.ml_mock:
        return predict_mock(horizon)
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response=await client.post(settings.ml_service_url.rstrip("/")+"/predict",json={"symbol":symbol,"horizon":horizon,"candles":candles},headers={"X-API-Key":settings.ml_api_key})
                response.raise_for_status(); data=response.json()
                if data.get("direction") not in {"UP","DOWN","SIDEWAYS"}: raise ValueError("Invalid ML response")
                return data
        except Exception:
            if attempt==2: raise
            await asyncio.sleep(.25*2**attempt)
