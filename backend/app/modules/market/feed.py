import asyncio, logging
from app.modules.market.replay_feed import run_replay
from app.config import settings
logger=logging.getLogger(__name__)

async def feed_loop(stop: asyncio.Event, symbols: list[str]):
    if settings.feed_mode.lower()=="replay":
        await run_replay(symbols,stop)
        return
    delay=1
    while not stop.is_set():
        try:
            from app.modules.market.token_store import load_token
            if not await load_token(): raise RuntimeError("Upstox token unavailable")
            raise RuntimeError("Live feed adapter requires Upstox Market Data Feed V3 protobuf implementation")
        except Exception:
            logger.exception("Market feed disconnected")
            await asyncio.sleep(delay); delay=min(delay*2,60)
