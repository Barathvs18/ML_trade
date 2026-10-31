import json
from pathlib import Path
from datetime import datetime, timezone
from app.db import get_db
from app.modules.market.price_cache import price_cache
from app.modules.market.candle_builder import candle_builder
from app.core.timeutils import is_market_open

DATA=Path(__file__).resolve().parents[2]/"data"
def stocks(): return json.loads((DATA/"nifty50.json").read_text(encoding="utf8"))
def stock(symbol): return next((x for x in stocks() if x["symbol"]==symbol.upper()),None)
def status():
    from app.main import health_state
    from app.core.timeutils import next_market_open
    return {"market_open":is_market_open(),"next_market_open":next_market_open().isoformat(),"upstox_token_ok":health_state["upstox_token_ok"]}
async def candles(symbol,interval,limit):
    rows=candle_builder.candles(symbol,interval,limit)
    if not rows:
        cur=get_db().candles.find({"symbol":symbol,"interval":interval}).sort("start",-1).limit(limit)
        rows=[r async for r in cur]
        rows.reverse()
    return rows[-limit:]
