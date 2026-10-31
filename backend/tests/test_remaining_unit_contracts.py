import asyncio
from datetime import datetime, timedelta, timezone
from http.cookies import SimpleCookie
from types import SimpleNamespace

from fastapi.testclient import TestClient
import pytest

from app.core.ratelimit import SlidingWindowLimiter
from app.core.security import set_auth_cookie
from app.modules.predictions.cache import PredictionCache
import app.modules.predictions.resolver as resolver
from app.modules.market.price_cache import price_cache

def test_prediction_cache_shares_concurrent_factory_call():
    async def run():
        cache=PredictionCache();calls=0
        async def factory():
            nonlocal calls;calls+=1;await asyncio.sleep(.02);return {"direction":"UP"}
        results=await asyncio.gather(*(cache.get_or_create(("ABC",5),factory) for _ in range(30)))
        assert calls==1 and all(result==results[0] for result in results)
    asyncio.run(run())

@pytest.mark.parametrize("change,actual",[(1,"UP"),(-1,"DOWN"),(0.02,"SIDEWAYS")])
def test_prediction_resolver_direction_and_sideways_baseline(monkeypatch,change,actual):
    pred={"_id":"p","symbol":"ABC","entry_price":100,"direction":"UP","status":"pending","resolve_at":datetime.now(timezone.utc)-timedelta(seconds=1)}
    class Cursor:
        def __aiter__(self):self.items=iter([pred]);return self
        async def __anext__(self):
            try:return next(self.items)
            except StopIteration:raise StopAsyncIteration
    class Predictions:
        def find(self,_):return Cursor()
        async def update_one(self,filt,update):pred.update(update["$set"])
    monkeypatch.setattr(resolver,"get_db",lambda:SimpleNamespace(predictions=Predictions()))
    monkeypatch.setattr(resolver.price_cache,"get",lambda _: {"ltp":100+change})
    asyncio.run(resolver.resolve_pending())
    assert pred["actual_direction"]==actual
    assert pred["baseline_correct"]==(actual=="SIDEWAYS")

def test_sliding_window_rate_limiter():
    limiter=SlidingWindowLimiter()
    assert limiter.allow("u",2) and limiter.allow("u",2) and not limiter.allow("u",2)

def test_auth_cookie_flags():
    from app.config import settings
    response=__import__("starlette.responses",fromlist=["Response"]).Response()
    old=(settings.cookie_secure,settings.cookie_samesite)
    try:
        settings.cookie_secure=True;settings.cookie_samesite="none"
        set_auth_cookie(response,"test.jwt")
        cookie=SimpleCookie();cookie.load(response.headers["set-cookie"])
        morsel=cookie["access_token"]
        assert morsel["httponly"] and morsel["secure"] and morsel["samesite"].lower()=="none"
    finally:settings.cookie_secure,settings.cookie_samesite=old

def test_api_serializer_converts_mongo_object_ids():
    from bson import ObjectId
    from app.core.serialization import api_value
    ident=ObjectId()
    assert api_value({"_id":ident,"nested":[ident]})=={"_id":str(ident),"nested":[str(ident)]}

def test_health_response_shape(monkeypatch):
    import app.db as db
    from app.main import app
    monkeypatch.setattr(db,"database",None)
    response=TestClient(app).get("/health")
    assert response.status_code==200
    assert {"status","db_ok","upstox_token_ok","feed_connected","ml_reachable","market_open","next_market_open","backfill"}<=response.json().keys()

def test_websocket_rejects_missing_authentication():
    from app.main import app
    from starlette.websockets import WebSocketDisconnect
    with pytest.raises(WebSocketDisconnect) as exc:
        with TestClient(app).websocket_connect("/ws/prices") as socket: socket.receive_json()
    assert exc.value.code==4401

def test_websocket_auth_and_initial_replay_tick(monkeypatch):
    import app.modules.market.ws as ws_module
    from app.main import app
    from app.core.security import create_access_token
    class Users:
        async def find_one(self,_):return {"user_id":"ws-user"}
    monkeypatch.setattr(ws_module,"get_db",lambda:SimpleNamespace(users=Users()))
    price_cache.update("RELIANCE",123.4,10,datetime.now(timezone.utc))
    token=create_access_token("ws-user")
    with TestClient(app).websocket_connect("/ws/prices",cookies={"access_token":token}) as socket:
        socket.send_json({"subscribe":["RELIANCE"]})
        tick=socket.receive_json()
        assert tick["type"]=="tick" and tick["symbol"]=="RELIANCE" and tick["ltp"]==123.4
