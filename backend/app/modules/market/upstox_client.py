"""Upstox REST and Market Data Feed V3 adapter."""
from __future__ import annotations
import json
from datetime import date
from urllib.parse import quote, urlencode
import httpx
import websockets
from app.config import settings
from app.modules.market.MarketDataFeedV3_pb2 import FeedResponse

BASE = "https://api.upstox.com/v3"
AUTH_BASE = "https://api.upstox.com/v2"
MAX_SUBSCRIPTIONS = 2000

def get_login_url() -> str:
    return "https://api.upstox.com/v2/login/authorization/dialog?" + urlencode({"response_type":"code","client_id":settings.upstox_api_key,"redirect_uri":settings.upstox_redirect_uri})

async def exchange_code_for_token(code: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        response=await client.post(AUTH_BASE+"/login/authorization/token",data={"code":code,"client_id":settings.upstox_api_key,"client_secret":settings.upstox_api_secret,"redirect_uri":settings.upstox_redirect_uri,"grant_type":"authorization_code"},headers={"Accept":"application/json"})
        response.raise_for_status();return response.json()

def candle_request(unit: str, interval: int, instrument_key: str, *, to_date: str | None=None, from_date: str | None=None, intraday: bool=False) -> tuple[str,dict]:
    if unit not in ({"minutes","hours","days"} if intraday else {"minutes","hours","days","weeks","months"}): raise ValueError("Invalid candle unit")
    if not 1 <= int(interval) <= (300 if unit=="minutes" else 5 if unit=="hours" else 1): raise ValueError("Invalid candle interval")
    key=quote(instrument_key,safe="")
    if intraday: return f"{BASE}/historical-candle/intraday/{key}/{unit}/{interval}",{}
    if not to_date: raise ValueError("to_date is required")
    path=f"{BASE}/historical-candle/{key}/{unit}/{interval}/{to_date}"
    if from_date: path+=f"/{from_date}"
    return path,{}

def _interval(value: str | int) -> tuple[str,int]:
    if isinstance(value,int): return "minutes",value
    aliases={"1m":("minutes",1),"5m":("minutes",5),"10m":("minutes",10),"15m":("minutes",15),"30m":("minutes",30),"1d":("days",1),"day":("days",1)}
    if value not in aliases: raise ValueError(f"Unsupported candle interval: {value}")
    return aliases[value]

async def _fetch_candles(instrument_key, interval, start=None, end=None, intraday=False):
    unit,count=_interval(interval)
    url,params=candle_request(unit,count,instrument_key,to_date=end,intraday=intraday,from_date=start)
    from app.modules.market.token_store import load_token
    token=await load_token()
    if not token: raise RuntimeError("Upstox access token is missing or expired")
    async with httpx.AsyncClient(timeout=20) as client:
        response=await client.get(url,params=params,headers={"Authorization":f"Bearer {token}","Accept":"application/json"})
        response.raise_for_status();return response.json().get("data",{}).get("candles",[])

async def fetch_historical_candles(instrument_key, interval, start, end):
    return await _fetch_candles(instrument_key,interval,start,end)

async def fetch_intraday_candles(instrument_key, interval, start=None, end=None):
    return await _fetch_candles(instrument_key,interval,start,end,True)

def parse_feed_message(payload: bytes, instrument_map: dict[str,str]) -> list[dict]:
    response=FeedResponse();response.ParseFromString(payload)
    ticks=[]
    for key,feed in response.feeds.items():
        if key not in instrument_map: continue
        if feed.HasField("ltpc"):
            ltpc=feed.ltpc; volume=ltpc.ltq
        elif feed.HasField("fullFeed") and feed.fullFeed.WhichOneof("FullFeedUnion")=="marketFF":
            full=feed.fullFeed.marketFF;ltpc=full.ltpc;volume=full.vtt
        elif feed.HasField("firstLevelWithGreeks"):
            ltpc=feed.firstLevelWithGreeks.ltpc;volume=feed.firstLevelWithGreeks.vtt
        else: continue
        ts=ltpc.ltt or response.currentTs
        ticks.append({"symbol":instrument_map[key],"ltp":ltpc.ltp,"ts":ts,"volume":volume})
    return ticks

async def _authorized_feed_url(token: str) -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        response=await client.get(BASE+"/feed/market-data-feed/authorize",headers={"Authorization":f"Bearer {token}","Accept":"application/json"})
        response.raise_for_status();return response.json()["data"]["authorized_redirect_uri"]

async def connect_feed(instrument_keys):
    """Yield parsed tick dictionaries. Consumer reconnects by reopening this generator."""
    from app.modules.market.token_store import load_token
    token=await load_token()
    if not token: raise RuntimeError("Upstox access token is missing or expired")
    mapping={item["instrument_key"]:item["symbol"] for item in instrument_keys} if instrument_keys and isinstance(instrument_keys[0],dict) else {key:key for key in instrument_keys}
    url=await _authorized_feed_url(token)
    async with websockets.connect(url,ping_interval=20,ping_timeout=20,max_size=None) as socket:
        keys=list(mapping)
        for offset in range(0,len(keys),MAX_SUBSCRIPTIONS):
            await socket.send(json.dumps({"guid":f"algopredict-{offset}","method":"sub","data":{"mode":"full","instrumentKeys":keys[offset:offset+MAX_SUBSCRIPTIONS]}}))
        async for payload in socket:
            if isinstance(payload,str): payload=payload.encode()
            for tick in parse_feed_message(payload,mapping): yield tick
