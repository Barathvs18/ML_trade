import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.modules.market.price_cache import price_cache
from app.modules.market.candle_builder import candle_builder
from app.core.security import decode_access_token
from app.db import get_db

router=APIRouter()

@router.websocket("/ws/prices")
async def prices_ws(ws: WebSocket):
    token=ws.cookies.get("access_token"); payload=decode_access_token(token) if token else None
    user=await get_db().users.find_one({"user_id":payload.get("sub")}) if payload else None
    if not user: await ws.close(code=4401); return
    await ws.accept(); queue=asyncio.Queue(); candle_builder.subscribe(queue); symbols=set()
    async def sender():
        while True:
            event=await queue.get()
            if event.get("symbol") in symbols: await ws.send_json(event)
    task=asyncio.create_task(sender())
    try:
        while True:
            msg=await ws.receive_json(); symbols=set(msg.get("subscribe",[]))
            for symbol in symbols:
                tick=price_cache.get(symbol)
                if tick: await ws.send_json({"type":"tick","symbol":symbol,"ltp":tick["ltp"],"ts":tick["ts"].isoformat()})
    except WebSocketDisconnect: pass
    finally: task.cancel(); candle_builder.unsubscribe(queue)
