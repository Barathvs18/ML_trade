from datetime import datetime,timezone
from app.config import settings
from app.db import get_db
from app.core.errors import AppError
from app.core.timeutils import is_market_open
from app.modules.market.price_cache import price_cache
from app.modules.paper.charges import calculate_charges

async def create_wallet(user_id):
    await get_db().wallets.update_one({"user_id":user_id},{"$setOnInsert":{"user_id":user_id,"balance":settings.starting_balance,"blocked_margin":0.0,"realized_pnl":0.0,"created_at":datetime.now(timezone.utc)}},upsert=True)

async def order(user_id,symbol,side,qty,stop_loss=None,target=None,prediction_id=None):
    if not is_market_open():raise AppError(409,"market_closed","Market is closed")
    if qty<1 or side not in ("BUY","SELL"):raise AppError(422,"invalid_order","Invalid order")
    tick=price_cache.get(symbol)
    if not tick:raise AppError(503,"price_unavailable","Price unavailable")
    ltp=tick["ltp"]; fill=ltp*(1+settings.slippage_bps/10000*(1 if side=="BUY" else -1)); amount=qty*fill
    db=get_db(); wallet=await db.wallets.find_one({"user_id":user_id})
    if not wallet:await create_wallet(user_id);wallet=await db.wallets.find_one({"user_id":user_id})
    position=await db.positions.find_one({"user_id":user_id,"symbol":symbol})
    same=(position and ((position["side"]=="LONG" and side=="BUY") or (position["side"]=="SHORT" and side=="SELL")))
    margin=amount if not position or same else max(0,amount-position["avg_price"]*min(qty,position["qty"]))
    if wallet["balance"]<margin:raise AppError(400,"insufficient_balance","Insufficient virtual balance")
    await db.wallets.update_one({"user_id":user_id,"balance":{"$gte":margin}},{"$inc":{"balance":-margin,"blocked_margin":margin}})
    charges=calculate_charges(amount,side); now=datetime.now(timezone.utc)
    if not position or same:
        newqty=qty+(position["qty"] if position else 0); avg=(fill*qty+position["avg_price"]*position["qty"])/newqty if position else fill
        await db.positions.update_one({"user_id":user_id,"symbol":symbol},{"$set":{"side":"LONG" if side=="BUY" else "SHORT","qty":newqty,"avg_price":avg,"opened_at":position["opened_at"] if position else now,"stop_loss":stop_loss,"target":target,"prediction_id":prediction_id}},upsert=True)
        realized=0.0
    else:
        closeqty=min(qty,position["qty"]); realized=(fill-position["avg_price"])*closeqty*(1 if position["side"]=="LONG" else -1)-charges["total"]
        rem=position["qty"]-closeqty
        if rem:await db.positions.update_one({"_id":position["_id"]},{"$set":{"qty":rem}})
        else:await db.positions.delete_one({"_id":position["_id"]})
        await db.wallets.update_one({"user_id":user_id},{"$inc":{"balance":amount+realized,"blocked_margin":-position["avg_price"]*closeqty,"realized_pnl":realized}})
    trade={"user_id":user_id,"symbol":symbol,"side":side,"qty":qty,"price":fill,"charges":charges,"realized_pnl":realized,"ts":now,"prediction_id":prediction_id}
    await db.trades.insert_one(trade);return trade
