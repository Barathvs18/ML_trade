from fastapi import APIRouter,Depends,Query
from app.core.deps import get_current_user
from app.core.errors import AppError
from app.db import get_db
from app.modules.market.service import stock
from app.modules.paper.engine import order, close_position
from app.modules.paper.service import wallet,positions
from app.core.serialization import api_value
router=APIRouter(prefix="/paper",tags=["paper"])
@router.post("/orders")
async def place(body:dict,user=Depends(get_current_user)):
    symbol=str(body.get("symbol","")).upper()
    if not stock(symbol):raise AppError(422,"invalid_symbol","Invalid stock")
    return api_value(await order(user["user_id"],symbol,body.get("side"),int(body.get("qty",0)),body.get("stop_loss"),body.get("target"),body.get("prediction_id")))
@router.get("/wallet")
async def get_wallet(user=Depends(get_current_user)):return api_value(await wallet(user["user_id"]))
@router.get("/positions")
async def get_positions(user=Depends(get_current_user)):
    rows=await positions(user["user_id"]);return api_value({"positions":rows,"unrealized_total":sum(p["unrealized_pnl"] for p in rows)})
@router.post("/positions/{symbol}/close")
async def close(symbol:str,user=Depends(get_current_user)):
    p=await get_db().positions.find_one({"user_id":user["user_id"],"symbol":symbol.upper()})
    if not p:raise AppError(404,"not_found","Position not found")
    return api_value(await close_position(user["user_id"],symbol.upper(),"manual",force=False))
@router.get("/trades")
async def trades(limit:int=Query(50,ge=1,le=200),user=Depends(get_current_user)):
    return api_value([r async for r in get_db().trades.find({"user_id":user["user_id"]}).sort("ts",-1).limit(limit)])
@router.get("/pnl")
async def pnl(user=Depends(get_current_user)):
    from app.modules.paper.service import positions as user_positions
    db=get_db();wallet_row=await wallet(user["user_id"]);open_positions=await user_positions(user["user_id"])
    realized=[]
    async for trade in db.trades.find({"user_id":user["user_id"],"realized_pnl":{"$ne":0}}):realized.append(trade["realized_pnl"])
    unrealized=sum(position["unrealized_pnl"] for position in open_positions)
    return {"realized":wallet_row.get("realized_pnl",0),"unrealized":unrealized,"total":wallet_row.get("realized_pnl",0)+unrealized,"win_rate":sum(value>0 for value in realized)/len(realized) if realized else 0,"best_trade":max(realized) if realized else None,"worst_trade":min(realized) if realized else None}
@router.post("/reset")
async def reset(user=Depends(get_current_user)):
    from datetime import datetime,timezone
    from uuid import uuid4
    from app.config import settings
    from app.modules.paper.engine import _lock,_positions_by_symbol
    user_id=user["user_id"];db=get_db();reset_id=str(uuid4());ts=datetime.now(timezone.utc)
    async with _lock(user_id):
        client=getattr(db,"client",None)
        session=await client.start_session() if client else None
        async def reset_ops(session_arg=None):
            nonlocal trades
            session_kw={"session":session_arg} if session_arg is not None else {}
            trades=[row async for row in db.trades.find({"user_id":user_id},**session_kw)]
            if trades:
                await db.trades_archive.insert_many([{**row,"reset_id":reset_id,"archived_at":ts} for row in trades],**session_kw)
                await db.trades.delete_many({"user_id":user_id},**session_kw)
            await db.positions.delete_many({"user_id":user_id},**session_kw)
            await db.wallets.update_one({"user_id":user_id},{"$set":{"balance":settings.starting_balance,"blocked_margin":0,"realized_pnl":0},"$inc":{"version":1}},upsert=True,**session_kw)
        trades=[]
        if session:
            try:
                async with session:
                    async with session.start_transaction(): await reset_ops(session)
            except Exception as exc:
                code=getattr(exc,"code",None);message=str(exc).lower()
                unsupported=code in {20,303} or "transaction numbers are only allowed" in message or "transactions are not supported" in message
                if not unsupported: raise
                await reset_ops()
        else: await reset_ops()
        for symbol in list(_positions_by_symbol):
            _positions_by_symbol[symbol].discard(user_id)
            if not _positions_by_symbol[symbol]:_positions_by_symbol.pop(symbol,None)
    return {"ok":True,"reset_id":reset_id,"archived_trades":len(trades)}
