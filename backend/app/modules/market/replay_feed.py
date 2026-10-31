import asyncio, random
from datetime import datetime, timezone, timedelta
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

async def seed_replay_history(instruments, builder, cache):
    """Seed deterministic recent synthetic bars for offline development."""
    now=datetime.now(timezone.utc)
    for inst in instruments:
        price=cache.get(inst["symbol"])
        value=price["ltp"] if price else random.uniform(100,3000)
        for interval,minutes,count in (("5m",5,200),("30m",30,200)):
            rows=[]; step=timedelta(minutes=minutes)
            start=now.replace(second=0,microsecond=0)-step*count
            for index in range(count):
                stamp=start+step*index
                value=max(1,value*(1+random.gauss(0,.0003)))
                rows.append({"start":stamp,"o":value,"h":value*1.001,"l":value*.999,"c":value,"v":random.randint(1,10000)})
            await builder.seed(inst["symbol"],interval,rows)
