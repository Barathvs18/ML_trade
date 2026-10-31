import asyncio, json, logging
from pathlib import Path
from datetime import datetime, timezone
from app.modules.market.replay_feed import run_replay
from app.modules.market.price_cache import price_cache
from app.modules.market.candle_builder import candle_builder
from app.config import settings
logger=logging.getLogger(__name__)

def load_instruments():
    path=Path(__file__).resolve().parents[2]/"data"/"nifty50.json"
    return json.loads(path.read_text(encoding="utf8"))

async def feed_loop(stop: asyncio.Event, symbols: list[str] | None=None):
    if settings.feed_mode.lower()=="replay":
        await run_replay(symbols or [x["symbol"] for x in load_instruments()],stop);return
    instruments=[x for x in load_instruments() if symbols is None or x["symbol"] in symbols]
    delay=1
    while not stop.is_set():
        try:
            from app.modules.market.upstox_client import connect_feed
            async for tick in connect_feed(instruments):
                when=datetime.fromtimestamp(tick["ts"]/1000,tz=timezone.utc) if tick["ts"] else datetime.now(timezone.utc)
                row=price_cache.update(tick["symbol"],tick["ltp"],tick["volume"],when)
                await candle_builder.on_tick(tick["symbol"],row["ltp"],row["volume"],row["ts"])
                if stop.is_set():return
            delay=1
        except asyncio.CancelledError: raise
        except Exception: logger.exception("Upstox feed disconnected; retrying")
        try: await asyncio.wait_for(stop.wait(),timeout=delay)
        except asyncio.TimeoutError: pass
        delay=min(delay*2,60)
