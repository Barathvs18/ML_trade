from app.modules.paper.engine import create_wallet, order
from app.db import get_db
from app.modules.market.price_cache import price_cache

async def wallet(user_id):
    await create_wallet(user_id);return await get_db().wallets.find_one({"user_id":user_id})
async def positions(user_id):
    result=[]
    async for p in get_db().positions.find({"user_id":user_id}):
        px=price_cache.get(p["symbol"]); ltp=px["ltp"] if px else p["avg_price"]
        p["unrealized_pnl"]=(ltp-p["avg_price"])*p["qty"]*(1 if p["side"]=="LONG" else -1);p["ltp"]=ltp;result.append(p)
    return result
