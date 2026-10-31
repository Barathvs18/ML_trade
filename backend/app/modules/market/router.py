from fastapi import APIRouter, HTTPException, Query
from app.modules.market import service
from app.modules.market.price_cache import price_cache
from app.core.serialization import api_value
router=APIRouter(prefix="/market",tags=["market"])
@router.get("/stocks")
async def stocks(q:str=""):
    return [x for x in service.stocks() if q.lower() in x["symbol"].lower() or q.lower() in x["name"].lower()]
@router.get("/quote/{symbol}")
async def quote(symbol:str):
    if not service.stock(symbol): raise HTTPException(404,"Unknown symbol")
    return {"symbol":symbol.upper(),**(price_cache.get(symbol.upper()) or {}),"market_open":service.status()["market_open"]}
@router.get("/candles/{symbol}")
async def get_candles(symbol:str,interval:str="5m",limit:int=Query(100,ge=1,le=200)):
    if not service.stock(symbol): raise HTTPException(404,"Unknown symbol")
    if interval not in {"5m","10m","30m","1d"}: raise HTTPException(422,"Invalid interval")
    return api_value(await service.candles(symbol.upper(),interval,limit))
@router.get("/status")
async def status(): return service.status()
