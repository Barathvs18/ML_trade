"""Replica-set Mongo tests; opt in with TEST_MONGO_URI and -m integration."""
import asyncio
import os
from uuid import uuid4
from datetime import datetime, timezone

import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError

pytestmark=pytest.mark.integration

@pytest.fixture
async def mongo_database(monkeypatch):
    uri=os.getenv("TEST_MONGO_URI")
    if not uri: pytest.skip("Set TEST_MONGO_URI to a Mongo replica-set URI")
    client=AsyncIOMotorClient(uri,serverSelectionTimeoutMS=3000)
    await client.admin.command("ping")
    name="algopredict_test_"+uuid4().hex
    database=client[name]
    import app.db as app_db
    monkeypatch.setattr(app_db,"database",database)
    monkeypatch.setattr(app_db,"client",client)
    await app_db.create_indexes()
    yield database
    await client.drop_database(name);client.close()

@pytest.mark.asyncio
async def test_real_mongo_concurrent_orders_cannot_double_spend(mongo_database,monkeypatch):
    import app.modules.paper.engine as engine
    from app.modules.market.price_cache import price_cache
    user="integration-race"
    await mongo_database.wallets.insert_one({"user_id":user,"balance":1000.0,"blocked_margin":0.0,"realized_pnl":0.0,"version":0})
    monkeypatch.setattr(engine,"is_market_open",lambda:True)
    monkeypatch.setattr(engine.price_cache,"get",lambda symbol:{"ltp":100.0})
    outcomes=await asyncio.gather(*(engine.order(user,"TEST","BUY",1) for _ in range(20)),return_exceptions=True)
    wallet=await mongo_database.wallets.find_one({"user_id":user})
    position=await mongo_database.positions.find_one({"user_id":user,"symbol":"TEST"})
    assert sum(not isinstance(item,Exception) for item in outcomes)>0
    assert wallet["balance"]>=0 and wallet["blocked_margin"]<=1000
    assert position["qty"]==sum(not isinstance(item,Exception) for item in outcomes)

@pytest.mark.asyncio
async def test_real_mongo_force_close_releases_margin(mongo_database,monkeypatch):
    import app.modules.paper.engine as engine
    user="integration-close"
    await mongo_database.wallets.insert_one({"user_id":user,"balance":900.0,"blocked_margin":100.0,"realized_pnl":0.0,"version":0})
    await mongo_database.positions.insert_one({"user_id":user,"symbol":"CLOSE","side":"LONG","qty":1,"avg_price":100.0,"version":0,"opened_at":datetime.now(timezone.utc)})
    monkeypatch.setattr(engine,"is_market_open",lambda:False)
    monkeypatch.setattr(engine.price_cache,"get",lambda _: {"ltp":110.0})
    result=await engine.close_position(user,"CLOSE","auto_squareoff",force=True)
    assert result["reason"]=="auto_squareoff"
    assert await mongo_database.positions.count_documents({"user_id":user})==0
    wallet=await mongo_database.wallets.find_one({"user_id":user})
    assert wallet["blocked_margin"]==0 and wallet["realized_pnl"]>0

@pytest.mark.asyncio
async def test_replica_transaction_failure_rolls_back_wallet_and_position(mongo_database):
    user="integration-rollback";await mongo_database.wallets.insert_one({"user_id":user,"balance":500.0,"blocked_margin":0.0})
    session=await mongo_database.client.start_session()
    with pytest.raises(RuntimeError):
        async with session:
            async with session.start_transaction():
                await mongo_database.wallets.update_one({"user_id":user},{"$inc":{"balance":-100}},session=session)
                await mongo_database.positions.insert_one({"user_id":user,"symbol":"ROLLBACK","side":"LONG","qty":1},session=session)
                raise RuntimeError("force rollback")
    assert (await mongo_database.wallets.find_one({"user_id":user}))["balance"]==500
    assert await mongo_database.positions.count_documents({"user_id":user,"symbol":"ROLLBACK"})==0

@pytest.mark.asyncio
async def test_reset_archival_is_transactional(mongo_database,monkeypatch):
    from app.modules.paper import router
    user="integration-reset"
    await mongo_database.wallets.insert_one({"user_id":user,"balance":15.0,"blocked_margin":50.0,"realized_pnl":4.0,"version":0})
    await mongo_database.positions.insert_one({"user_id":user,"symbol":"RESET","side":"LONG","qty":1,"avg_price":50})
    await mongo_database.trades.insert_one({"user_id":user,"symbol":"RESET","side":"BUY","qty":1,"price":50,"ts":datetime.now(timezone.utc)})
    monkeypatch.setattr(router,"get_db",lambda:mongo_database)
    result=await router.reset({"user_id":user})
    assert result["archived_trades"]==1
    assert await mongo_database.trades.count_documents({"user_id":user})==0
    archived=await mongo_database.trades_archive.find_one({"user_id":user,"reset_id":result["reset_id"]})
    assert archived and archived["archived_at"]
    wallet=await mongo_database.wallets.find_one({"user_id":user})
    assert wallet["balance"]>15 and wallet["blocked_margin"]==0
    assert await mongo_database.positions.count_documents({"user_id":user})==0

@pytest.mark.asyncio
async def test_unique_indexes_reject_duplicates(mongo_database):
    await mongo_database.users.insert_one({"google_id":"same","email":"one@example.com"})
    with pytest.raises(DuplicateKeyError):await mongo_database.users.insert_one({"google_id":"same","email":"two@example.com"})
    with pytest.raises(DuplicateKeyError):await mongo_database.users.insert_one({"google_id":"other","email":"one@example.com"})
    candle={"symbol":"TEST","interval":"5m","start":datetime(2026,1,1,tzinfo=timezone.utc)}
    await mongo_database.candles.insert_one(candle)
    with pytest.raises(DuplicateKeyError):await mongo_database.candles.insert_one(candle)
    await mongo_database.positions.insert_one({"user_id":"u","symbol":"TEST"})
    with pytest.raises(DuplicateKeyError):await mongo_database.positions.insert_one({"user_id":"u","symbol":"TEST"})
