import asyncio, random
from datetime import datetime, timezone
from app.modules.market.price_cache import price_cache
from app.modules.market.candle_builder import candle_builder

async def run_replay(symbols: list[str], stop: asyncio.Event):
    prices={s:random.uniform(100,3000) for s in symbols}
    while not stop.is_set():
        now=datetime.now(timezone.utc)
        for s in symbols:
            prices[s]=max(1,prices[s]*(1+random.gauss(0,0.0005)))
            tick=price_cache.update(s,prices[s],random.randint(1,100),now)
            await candle_builder.on_tick(s,tick["ltp"],tick["volume"],now)
        await asyncio.sleep(1)
