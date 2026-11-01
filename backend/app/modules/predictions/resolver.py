from datetime import datetime, timezone
from app.config import settings
from app.db import get_db
from app.modules.market.price_cache import price_cache

async def resolve_pending(now:datetime|None=None):
    now=now or datetime.now(timezone.utc); cur=get_db().predictions.find({"status":"pending","resolve_at":{"$lte":now}})
    async for pred in cur:
        quote=price_cache.get(pred["symbol"])
        if not quote: continue
        resolved_price=quote.get("ltp")
        if not isinstance(resolved_price,(int,float)) or resolved_price<=0 or not isinstance(pred.get("entry_price"),(int,float)) or pred["entry_price"]<=0: continue
        ret=(resolved_price-pred["entry_price"])/pred["entry_price"]*100
        actual="SIDEWAYS" if abs(ret)<settings.sideways_threshold_pct else ("UP" if ret>0 else "DOWN")
        await get_db().predictions.update_one({"_id":pred["_id"],"user_id":pred["user_id"],"status":"pending","resolve_at":{"$lte":now}},{"$set":{"actual_price":resolved_price,"actual_return_pct":ret,"actual_direction":actual,"correct":pred["direction"]==actual,"baseline_correct":actual=="SIDEWAYS","resolved_at":now,"status":"resolved"}})
