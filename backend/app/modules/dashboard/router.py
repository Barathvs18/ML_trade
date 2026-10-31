from fastapi import APIRouter,Depends
from app.core.deps import get_current_user
from app.db import get_db
from app.modules.paper.service import wallet,positions
from app.modules.market.service import status
router=APIRouter(prefix="/dashboard",tags=["dashboard"])
@router.get("/summary")
async def summary(user=Depends(get_current_user)):
    db=get_db();w=await wallet(user["user_id"]);ps=await positions(user["user_id"])
    trades=[x async for x in db.trades.find({"user_id":user["user_id"]}).sort("ts",-1).limit(5)]
    preds=[x async for x in db.predictions.find({"user_id":user["user_id"]}).sort("made_at",-1).limit(5)]
    count=await db.trades.count_documents({"user_id":user["user_id"]})
    wins=await db.trades.count_documents({"user_id":user["user_id"],"realized_pnl":{"$gt":0}})
    unreal=sum(p["unrealized_pnl"] for p in ps)
    return {"user":{"id":user["user_id"],"name":user.get("name"),"email":user["email"]},"wallet_balance":w["balance"],"equity":w["balance"]+unreal,"total_pnl":w["realized_pnl"]+unreal,"win_rate":wins/count if count else 0,"trade_count":count,"open_positions_count":len(ps),"last_predictions":preds,"last_trades":trades,"market":status()}
@router.get("/equity-curve")
async def equity_curve(range:str="1d",user=Depends(get_current_user)):
    return [x async for x in get_db().equity_snapshots.find({"user_id":user["user_id"]}).sort("ts",1)]
