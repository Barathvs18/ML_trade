import httpx
from app.config import settings

BASE = "https://api.upstox.com/v2"

def get_login_url() -> str:
    from urllib.parse import urlencode
    return "https://api.upstox.com/v2/login/authorization/dialog?" + urlencode({"response_type":"code","client_id":settings.upstox_api_key,"redirect_uri":settings.upstox_redirect_uri})

async def exchange_code_for_token(code: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r=await client.post("https://api.upstox.com/v2/login/authorization/token",data={"code":code,"client_id":settings.upstox_api_key,"client_secret":settings.upstox_api_secret,"redirect_uri":settings.upstox_redirect_uri,"grant_type":"authorization_code"},headers={"Accept":"application/json"})
        r.raise_for_status(); return r.json()

async def _candles(path, instrument_key, interval, start, end):
    token=await __import__("app.modules.market.token_store",fromlist=["load_token"]).load_token()
    async with httpx.AsyncClient(timeout=20) as client:
        r=await client.get(f"{BASE}/{path}/{instrument_key}/{interval}/{end}/{start}",headers={"Authorization":f"Bearer {token}","Accept":"application/json"})
        r.raise_for_status(); return r.json().get("data",{}).get("candles",[])

async def fetch_historical_candles(instrument_key, interval, start, end): return await _candles("historical-candle",instrument_key,interval,start,end)
async def fetch_intraday_candles(instrument_key, interval, start=None, end=None): return await _candles("historical-candle/intraday",instrument_key,interval,start or "",end or "")

async def connect_feed(instrument_keys):
    raise RuntimeError("Live Upstox feed requires the authorized WebSocket protocol session")
