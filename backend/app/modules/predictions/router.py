from fastapi import APIRouter,Depends,Query
from bson import ObjectId
from app.core.deps import get_current_user
from app.core.errors import AppError
from app.core.ratelimit import limiter
from app.db import get_db
from app.modules.market.service import stock
from app.modules.predictions.service import get_or_create_prediction
from app.core.serialization import api_value
router=APIRouter(prefix="/predictions",tags=["predictions"])
@router.post("")
async def create(body:dict,user=Depends(get_current_user)):
    if not limiter.allow("pred:"+user["user_id"],10): raise AppError(429,"rate_limited","Too many prediction requests")
    symbol=str(body.get("symbol","")).upper(); horizon=body.get("horizon")
    if not stock(symbol) or horizon not in (5,10,30): raise AppError(422,"invalid_input","Invalid symbol or horizon")
    return api_value(await get_or_create_prediction(user,symbol,horizon))
@router.get("")
async def listing(status:str|None=None,symbol:str|None=None,horizon:int|None=None,limit:int=Query(50,ge=1,le=100),user=Depends(get_current_user)):
    filt={"user_id":user["user_id"]}
    if status:filt["status"]=status
    if symbol:filt["symbol"]=symbol.upper()
    if horizon:filt["horizon"]=horizon
    return api_value([r async for r in get_db().predictions.find(filt).sort("made_at",-1).limit(limit)])
@router.get("/stats")
async def stats(user=Depends(get_current_user)):
    docs=[x async for x in get_db().predictions.find({"user_id":user["user_id"],"status":"resolved"})]
    return {str(h):{"count":len(a:=[x for x in docs if x["horizon"]==h]),"accuracy":sum(bool(x.get("correct")) for x in a)/len(a) if a else 0,"baseline_accuracy":sum(bool(x.get("baseline_correct")) for x in a)/len(a) if a else 0,"beats_baseline":sum(bool(x.get("correct")) for x in a)>sum(bool(x.get("baseline_correct")) for x in a)} for h in (5,10,30)}
@router.get("/{prediction_id}")
async def one(prediction_id:str,user=Depends(get_current_user)):
    doc=await get_db().predictions.find_one({"_id":ObjectId(prediction_id),"user_id":user["user_id"]})
    if not doc:raise AppError(404,"not_found","Prediction not found")
    if doc["status"]=="pending":doc.pop("actual_direction",None);doc.pop("actual_return_pct",None)
    return api_value(doc)
