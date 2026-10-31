from datetime import datetime,timezone,timedelta
from bson import ObjectId
from app.db import get_db
from app.core.errors import AppError
from app.core.timeutils import is_market_open
from app.modules.market.price_cache import price_cache
from app.modules.market.candle_builder import candle_builder
from app.modules.predictions.cache import cache
from app.modules.predictions.ml_client import predict

async def get_or_create_prediction(user,symbol,horizon):
    if not is_market_open(): raise AppError(409,"market_closed","Predictions are available only while the market is open")
    tick=price_cache.get(symbol)
    if not tick: raise AppError(503,"price_unavailable","Current price is unavailable")
    interval="30m" if horizon==30 else "5m"
    async def build():
        rows=candle_builder.candles(symbol,interval,200)
        data=[{"t":r["start"].isoformat(),"o":r["o"],"h":r["h"],"l":r["l"],"c":r["c"],"v":r["v"]} for r in rows]
        return await predict(symbol,horizon,data)
    model=await cache.get_or_create((symbol,horizon),build)
    now=datetime.now(timezone.utc); minutes=horizon
    resolve=now+timedelta(minutes=minutes)
    pred={"user_id":user["user_id"],"symbol":symbol,"horizon":horizon,"model":model.get("model"),"made_at":now,"entry_price":tick["ltp"],"direction":model["direction"],"probability":model["probability"],"confidence":model["confidence"],"forecast_close":model["forecast_close"],"resolve_at":resolve,"status":"pending"}
    if model.get("probabilities") is not None:
        pred["probabilities"]=model["probabilities"]
    result=await get_db().predictions.insert_one(pred); pred["_id"]=result.inserted_id
    pred["disclaimer"]="Educational only, not financial advice"
    return pred
