import asyncio
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace

import pytest
from app.core.errors import AppError
import app.modules.paper.engine as engine
from app.modules.paper.charges import calculate_charges

def test_long_and_short_pnl_include_slippage_and_charges():
    long={"side":"LONG","avg_price":100.0}
    short={"side":"SHORT","avg_price":100.0}
    long_fill=engine._fill_price(101,"SELL");short_fill=engine._fill_price(99,"BUY")
    long_net=engine._position_pnl(long,long_fill,2)-calculate_charges(long_fill*2,"SELL")["total"]
    short_net=engine._position_pnl(short,short_fill,2)-calculate_charges(short_fill*2,"BUY")["total"]
    assert long_fill<101 and long_net>0
    assert short_fill>99 and short_net>0

def test_invalid_stop_and_target_are_rejected():
    with pytest.raises(AppError): engine._validate_brackets("LONG",100,101,None)
    with pytest.raises(AppError): engine._validate_brackets("LONG",100,None,99)
    with pytest.raises(AppError): engine._validate_brackets("SHORT",100,99,None)
    with pytest.raises(AppError): engine._validate_brackets("SHORT",100,None,101)

class AsyncRows:
    def __init__(self,rows): self.rows=rows
    def __aiter__(self): self.iterator=iter(self.rows);return self
    async def __anext__(self):
        try:return next(self.iterator)
        except StopIteration:raise StopAsyncIteration

@pytest.mark.asyncio
async def test_long_and_short_stop_target_each_trigger_once(monkeypatch):
    positions=[{"user_id":"u1","symbol":"AAA","side":"LONG","stop_loss":90,"target":110},
               {"user_id":"u2","symbol":"BBB","side":"SHORT","stop_loss":110,"target":90},
               {"user_id":"u3","symbol":"CCC","side":"LONG","stop_loss":90,"target":110},
               {"user_id":"u4","symbol":"DDD","side":"SHORT","stop_loss":110,"target":90}]
    class Collection:
        def find(self,filt): return AsyncRows([p for p in positions if p["symbol"]==filt["symbol"]])
    monkeypatch.setattr(engine,"get_db",lambda:SimpleNamespace(positions=Collection()))
    monkeypatch.setattr(engine,"is_market_open",lambda:True)
    monkeypatch.setattr(engine.price_cache,"get",lambda symbol:{"AAA":{"ltp":89},"BBB":{"ltp":111},"CCC":{"ltp":111},"DDD":{"ltp":89}}[symbol])
    engine._positions_by_symbol.clear();engine._positions_by_symbol.update({"AAA":{"u1"},"BBB":{"u2"},"CCC":{"u3"},"DDD":{"u4"}})
    calls=[]
    async def close(uid,symbol,reason,force=True):
        calls.append((uid,symbol,reason,force));engine._index_remove(uid,symbol)
    monkeypatch.setattr(engine,"close_position",close)
    await engine.evaluate_exits();await engine.evaluate_exits()
    assert calls==[("u1","AAA","stop_loss",True),("u2","BBB","stop_loss",True),("u3","CCC","target",True),("u4","DDD","target",True)]

@pytest.mark.asyncio
async def test_auto_squareoff_forces_close_when_market_is_closed(monkeypatch):
    from app.modules.paper import squareoff
    monkeypatch.setattr(squareoff,"get_db",lambda:SimpleNamespace(positions=SimpleNamespace(find=lambda _:AsyncRows([{"user_id":"u","symbol":"AAA"}]))))
    calls=[]
    async def close(uid,symbol,reason,force): calls.append((uid,symbol,reason,force))
    monkeypatch.setattr(squareoff,"close_position",close)
    await squareoff.square_off_all()
    assert calls==[("u","AAA","auto_squareoff",True)]

@pytest.mark.asyncio
async def test_startup_recovery_closes_previous_day_positions(monkeypatch):
    from app.modules.paper import squareoff
    old=datetime.now(timezone.utc)-timedelta(days=2)
    monkeypatch.setattr(squareoff,"get_db",lambda:SimpleNamespace(positions=SimpleNamespace(find=lambda _:AsyncRows([{"user_id":"u","symbol":"AAA","opened_at":old}]))))
    calls=[]
    async def close(uid,symbol,reason,force):calls.append((uid,symbol,reason,force))
    monkeypatch.setattr(squareoff,"close_position",close)
    await squareoff.recover_previous_day_positions()
    assert calls==[("u","AAA","startup_recovery",True)]

@pytest.mark.asyncio
async def test_concurrent_orders_cannot_double_spend(monkeypatch):
    class Result:
        def __init__(self,modified=0,deleted=0):self.modified_count=modified;self.deleted_count=deleted
    class Wallets:
        def __init__(self):self.row=None
        async def update_one(self,filt,update,upsert=False):
            if self.row is None:
                self.row={"user_id":filt["user_id"],"balance":update["$setOnInsert"]["balance"],"blocked_margin":0,"realized_pnl":0,"version":0};return Result(1)
            if filt.get("version")!=self.row["version"]:return Result()
            for key,val in update.get("$inc",{}).items():self.row[key]=self.row.get(key,0)+val
            return Result(1)
        async def find_one(self,filt):return dict(self.row) if self.row else None
    class Positions:
        def __init__(self):self.row=None
        async def find_one(self,filt):return dict(self.row) if self.row else None
        async def insert_one(self,row):
            if self.row:raise RuntimeError("duplicate position")
            self.row={**row,"_id":"p"}
    class Trades:
        def __init__(self):self.rows=[]
        async def insert_one(self,row):self.rows.append(dict(row))
    db=SimpleNamespace(wallets=Wallets(),positions=Positions(),trades=Trades())
    monkeypatch.setattr(engine,"_base_get_db",lambda:db)
    monkeypatch.setattr(engine,"get_db",lambda:db)
    monkeypatch.setattr(engine,"is_market_open",lambda:True)
    monkeypatch.setattr(engine.settings,"starting_balance",150.0)
    monkeypatch.setattr(engine.price_cache,"get",lambda _: {"ltp":100.0})
    async def place():
        try:return await engine.order("race-user","RACE","BUY",1)
        except AppError as exc:return exc
    results=await asyncio.gather(place(),place())
    assert sum(not isinstance(result,AppError) for result in results)==1
    assert len(db.trades.rows)==1
    assert db.wallets.row["balance"]>=0

@pytest.mark.asyncio
async def test_reset_archives_trade_history_and_resets_wallet(monkeypatch):
    from app.modules.paper import router as paper_router
    class Cursor:
        def __init__(self,rows):self.rows=rows
        def __aiter__(self):self.items=iter(self.rows);return self
        async def __anext__(self):
            try:return next(self.items)
            except StopIteration:raise StopAsyncIteration
    class Trades:
        def __init__(self):self.rows=[{"user_id":"u","symbol":"AAA","side":"BUY","ts":datetime.now(timezone.utc)}];self.archived=[]
        def find(self,filt):return Cursor([x for x in self.rows if x["user_id"]==filt["user_id"]])
        async def insert_many(self,rows):self.archived.extend(rows)
        async def delete_many(self,filt):self.rows=[]
    class Collection:
        async def delete_many(self,filt):pass
        async def update_one(self,*args,**kwargs):pass
    trades=Trades();db=SimpleNamespace(trades=trades,trades_archive=trades,positions=Collection(),wallets=Collection())
    monkeypatch.setattr(paper_router,"get_db",lambda:db)
    result=await paper_router.reset({"user_id":"u"})
    assert result["archived_trades"]==1
    assert trades.rows==[] and len(trades.archived)==1
    assert trades.archived[0]["reset_id"]==result["reset_id"]
