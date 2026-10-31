from app.db import get_db
from app.modules.paper.engine import order
from app.modules.market.price_cache import price_cache

async def square_off_all():
    async for p in get_db().positions.find({}):
        if price_cache.get(p["symbol"]):
            try: await order(p["user_id"],p["symbol"],"SELL" if p["side"]=="LONG" else "BUY",p["qty"])
            except Exception: continue
