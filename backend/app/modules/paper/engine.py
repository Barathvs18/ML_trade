from __future__ import annotations
import asyncio
from contextvars import ContextVar
from functools import wraps
from datetime import datetime, timezone
from app.config import settings
from app.db import get_db as _base_get_db
from app.core.errors import AppError
from app.core.timeutils import is_market_open
from app.modules.market.price_cache import price_cache
from app.modules.paper.charges import calculate_charges

_user_locks: dict[str, asyncio.Lock] = {}
_closing: set[tuple[str,str]] = set()
_positions_by_symbol: dict[str,set[str]] = {}
_session_context: ContextVar[object | None]=ContextVar("paper_mongo_session",default=None)

class _SessionCollection:
    def __init__(self,collection,session):self._collection=collection;self._session=session
    def __getattr__(self,name):
        method=getattr(self._collection,name)
        if not callable(method):return method
        def call(*args,**kwargs):kwargs.setdefault("session",self._session);return method(*args,**kwargs)
        return call

class _SessionDatabase:
    def __init__(self,database,session):self._database=database;self._session=session
    def __getattr__(self,name):
        value=getattr(self._database,name)
        if name=="client":return value
        return _SessionCollection(value,self._session) if hasattr(value,"find_one") else value

def get_db():
    database=_base_get_db();session=_session_context.get()
    return _SessionDatabase(database,session) if session is not None else database

def _transactional(function):
    @wraps(function)
    async def wrapped(*args,**kwargs):
        db=_base_get_db()
        try:session=await db.client.start_session()
        except Exception:return await function(*args,**kwargs)
        async with session:
            token=_session_context.set(session)
            try:
                async with session.start_transaction():return await function(*args,**kwargs)
            except Exception as exc:
                code=getattr(exc,"code",None);message=str(exc).lower()
                unsupported=code in {20,303} or "transaction numbers are only allowed" in message or "transactions are not supported" in message
                if not unsupported:raise
                _session_context.set(None)
                return await function(*args,**kwargs)
            finally:_session_context.reset(token)
    return wrapped

def _lock(user_id: str) -> asyncio.Lock:
    return _user_locks.setdefault(user_id,asyncio.Lock())

def _index_add(user_id: str,symbol: str): _positions_by_symbol.setdefault(symbol,set()).add(user_id)
def _index_remove(user_id: str,symbol: str):
    users=_positions_by_symbol.get(symbol)
    if users:
        users.discard(user_id)
        if not users:_positions_by_symbol.pop(symbol,None)

async def rebuild_position_index():
    _positions_by_symbol.clear()
    async for row in get_db().positions.find({}): _index_add(row["user_id"],row["symbol"])

async def create_wallet(user_id):
    await get_db().wallets.update_one({"user_id":user_id},{"$setOnInsert":{"user_id":user_id,"balance":settings.starting_balance,"blocked_margin":0.0,"realized_pnl":0.0,"version":0,"created_at":datetime.now(timezone.utc)}},upsert=True)

def _fill_price(ltp: float,side: str) -> float:
    direction=1 if side=="BUY" else -1
    return ltp*(1+settings.slippage_bps/10000*direction)

def _position_pnl(position: dict,fill: float,qty: int) -> float:
    sign=1 if position["side"]=="LONG" else -1
    return (fill-position["avg_price"])*qty*sign

def _validate_brackets(side: str,entry: float,stop_loss,target):
    if side=="LONG":
        if stop_loss is not None and stop_loss>=entry: raise AppError(422,"invalid_stop_loss","Long stop-loss must be below entry price")
        if target is not None and target<=entry: raise AppError(422,"invalid_target","Long target must be above entry price")
    else:
        if stop_loss is not None and stop_loss<=entry: raise AppError(422,"invalid_stop_loss","Short stop-loss must be above entry price")
        if target is not None and target>=entry: raise AppError(422,"invalid_target","Short target must be below entry price")

async def _cas_wallet(db,user_id,version,updates):
    result=await db.wallets.update_one({"user_id":user_id,"version":version},{"$inc":{"version":1,**updates}})
    if not result.modified_count: raise AppError(409,"order_conflict","Wallet changed; retry the order")

@_transactional
async def order(user_id,symbol,side,qty,stop_loss=None,target=None,prediction_id=None):
    """Manual market fill. Opposite-side excess is rejected; positions never reverse implicitly."""
    if not is_market_open(): raise AppError(409,"market_closed","Market is closed")
    if not isinstance(qty,int) or qty<1 or side not in ("BUY","SELL"): raise AppError(422,"invalid_order","Invalid side or quantity")
    async with _lock(user_id):
        tick=price_cache.get(symbol)
        if not tick: raise AppError(503,"price_unavailable","Price unavailable")
        ltp=tick["ltp"];fill=_fill_price(ltp,side);amount=qty*fill;db=get_db()
        await create_wallet(user_id)
        wallet=await db.wallets.find_one({"user_id":user_id})
        pos=await db.positions.find_one({"user_id":user_id,"symbol":symbol})
        close_side=(pos is not None and ((pos["side"]=="LONG" and side=="SELL") or (pos["side"]=="SHORT" and side=="BUY")))
        if close_side and qty>pos["qty"]: raise AppError(422,"quantity_exceeds_position","Order quantity exceeds open position; excess reversal is disabled")
        if close_side:
            await _apply_close_fill(db,wallet,pos,side,qty,fill,"manual",prediction_id)
            return await db.trades.find_one({"user_id":user_id,"symbol":symbol},sort=[("ts",-1)])
        position_side="LONG" if side=="BUY" else "SHORT"
        _validate_brackets(position_side,fill,stop_loss,target)
        charges=calculate_charges(amount,side);margin=amount
        if wallet["balance"]<margin+charges["total"]: raise AppError(400,"insufficient_balance","Insufficient virtual balance for margin and charges")
        version=wallet.get("version",0)
        await _cas_wallet(db,user_id,version,{"balance":-(margin+charges["total"]),"blocked_margin":margin})
        now=datetime.now(timezone.utc)
        if pos:
            pver=pos.get("version",0)
            qty_new=pos["qty"]+qty
            avg=(pos["avg_price"]*pos["qty"]+fill*qty)/qty_new
            result=await db.positions.update_one({"_id":pos["_id"],"version":pver},{"$set":{"qty":qty_new,"avg_price":avg,"stop_loss":stop_loss if stop_loss is not None else pos.get("stop_loss"),"target":target if target is not None else pos.get("target")},"$inc":{"version":1}})
            if not result.modified_count:
                await db.wallets.update_one({"user_id":user_id,"version":version+1},{"$inc":{"balance":margin+charges["total"],"blocked_margin":-margin,"version":1}})
                raise AppError(409,"order_conflict","Position changed; retry the order")
        else:
            try:
                await db.positions.insert_one({"user_id":user_id,"symbol":symbol,"side":position_side,"qty":qty,"avg_price":fill,"opened_at":now,"stop_loss":stop_loss,"target":target,"prediction_id":prediction_id,"version":0})
            except Exception:
                await db.wallets.update_one({"user_id":user_id,"version":version+1},{"$inc":{"balance":margin+charges["total"],"blocked_margin":-margin,"version":1}})
                raise AppError(409,"order_conflict","Position changed; retry the order")
        _index_add(user_id,symbol)
        trade={"user_id":user_id,"symbol":symbol,"side":side,"qty":qty,"price":fill,"charges":charges,"realized_pnl":0.0,"ts":now,"prediction_id":prediction_id,"reason":"manual"}
        await db.trades.insert_one(trade)
        return trade

async def _apply_close_fill(db,wallet,pos,side,qty,fill,reason,prediction_id=None):
    user_id=pos["user_id"];symbol=pos["symbol"];pver=pos.get("version",0);wver=wallet.get("version",0)
    charges=calculate_charges(qty*fill,side);gross=_position_pnl(pos,fill,qty);realized=gross-charges["total"]
    released=pos["avg_price"]*qty
    rem=pos["qty"]-qty
    # Claim the position first. The per-user lock serializes this service instance;
    # version predicates make stale/concurrent writers fail safely.
    if rem:
        result=await db.positions.update_one({"_id":pos["_id"],"version":pver,"qty":{"$gte":qty}},{"$set":{"qty":rem},"$inc":{"version":1}})
    else:
        result=await db.positions.delete_one({"_id":pos["_id"],"version":pver,"qty":{"$gte":qty}})
    if not result.modified_count and not result.deleted_count: raise AppError(409,"position_conflict","Position changed; retry close")
    credited=released+gross-charges["total"]
    try:
        await _cas_wallet(db,user_id,wver,{"balance":credited,"blocked_margin":-released,"realized_pnl":realized})
    except Exception:
        # Restore an optimistic position mutation if the wallet CAS lost a race.
        if rem: await db.positions.update_one({"_id":pos["_id"],"version":pver+1},{"$set":{"qty":pos["qty"]},"$inc":{"version":1}})
        else: await db.positions.insert_one(pos)
        raise
    if not rem: _index_remove(user_id,symbol)
    trade={"user_id":user_id,"symbol":symbol,"side":side,"qty":qty,"price":fill,"charges":charges,"realized_pnl":realized,"ts":datetime.now(timezone.utc),"prediction_id":prediction_id or pos.get("prediction_id"),"reason":reason}
    await db.trades.insert_one(trade)
    return trade

@_transactional
async def close_position(user_id,symbol,reason,force=True):
    key=(user_id,symbol)
    async with _lock(user_id):
        if key in _closing:return None
        _closing.add(key)
        try:
            db=get_db();pos=await db.positions.find_one({"user_id":user_id,"symbol":symbol})
            if not pos:return None
            quote=price_cache.get(symbol)
            if not quote:
                latest=await db.candles.find_one({"symbol":symbol},sort=[("start",-1)])
                if not latest: raise AppError(503,"price_unavailable","No current or last known price available")
                quote={"ltp":latest["c"]}
            if not force and not is_market_open(): raise AppError(409,"market_closed","Market is closed")
            side="SELL" if pos["side"]=="LONG" else "BUY"
            fill=_fill_price(quote["ltp"],side)
            wallet=await db.wallets.find_one({"user_id":user_id})
            if not wallet: raise AppError(409,"wallet_missing","Wallet not found")
            return await _apply_close_fill(db,wallet,pos,side,pos["qty"],fill,reason)
        finally:_closing.discard(key)

async def evaluate_exits():
    """Check indexed symbols against cached LTP and close triggered positions once."""
    if not is_market_open(): return
    db=get_db()
    for symbol,users in list(_positions_by_symbol.items()):
        quote=price_cache.get(symbol)
        if not quote: continue
        async for pos in db.positions.find({"symbol":symbol,"user_id":{"$in":list(users)}}):
            stop=pos.get("stop_loss");target=pos.get("target");price=quote["ltp"]
            if pos["side"]=="LONG": reason="stop_loss" if stop is not None and price<=stop else "target" if target is not None and price>=target else None
            else: reason="stop_loss" if stop is not None and price>=stop else "target" if target is not None and price<=target else None
            if reason:
                try: await close_position(pos["user_id"],symbol,reason,force=True)
                except Exception: pass
