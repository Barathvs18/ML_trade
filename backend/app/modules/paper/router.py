from fastapi import APIRouter,Depends,Query
from app.core.deps import get_current_user
from app.core.errors import AppError
from app.db import get_db
from app.modules.market.service import stock
from app.modules.paper.engine import order
from app.modules.paper.service import wallet,positions
router=APIRouter(prefix="/paper",tags=["paper"])
@router.post("/orders")
async def place(body:dict,user=Depends(get_current_user)):
    symbol=str(body.get("symbol","")).upper()
    if not stock(symbol):raise AppError(422,"invalid_symbol","Invalid stock")
    return await order(user["user_id"],symbol,body.get("side"),int(body.get("qty",0)),body.get("stop_loss"),body.get("target"),body.get("prediction_id"))
@router.get("/wallet")
async def get_wallet(user=Depends(get_current_user)):return await wallet(user["user_id"])
@router.get("/positions")
async def get_positions(user=Depends(get_current_user)):
    rows=await positions(user["user_id"]);return {"positions":rows,"unrealized_total":sum(p["unrealized_pnl"] for p in rows)}
@router.post("/positions/{symbol}/close")
async def close(symbol:str,user=Depends(get_current_user)):
    p=await get_db().positions.find_one({"user_id":user["user_id"],"symbol":symbol.upper()})
    if not p:raise AppError(404,"not_found","Position not found")
    return await order(user["user_id"],symbol.upper(),"SELL" if p["side"]=="LONG" else "BUY",p["qty"])
@router.get("/trades")
async def trades(limit:int=Query(50,ge=1,le=200),user=Depends(get_current_user)):
    return [r async for r in get_db().trades.find({"user_id":user["user_id"]}).sort("ts",-1).limit(limit)]
@router.post("/reset")
async def reset(user=Depends(get_current_user)):
    db=get_db();await db.positions.delete_many({"user_id":user["user_id"]});await db.wallets.update_one({"user_id":user["user_id"]},{"$set":{"balance":100000,"blocked_margin":0,"realized_pnl":0}});return {"ok":True}
