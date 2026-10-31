import asyncio
from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

import app.scheduler as jobs
from app.core.timeutils import IST, is_market_open, next_market_open

def test_scheduler_registers_expected_triggers(monkeypatch):
    monkeypatch.setattr(jobs.settings,"squareoff_time","15:20")
    scheduler=jobs.build_scheduler()
    found={job.id:job for job in scheduler.get_jobs()}
    assert set(found)=={"upstox-token-check","prediction-resolver","equity-snapshot","paper-squareoff","paper-position-exits"}
    assert all(job.func is jobs.safe_job for job in found.values())
    assert isinstance(found["upstox-token-check"].trigger,CronTrigger)
    assert isinstance(found["prediction-resolver"].trigger,IntervalTrigger)
    assert found["prediction-resolver"].trigger.interval.total_seconds()==60
    assert found["equity-snapshot"].trigger.interval.total_seconds()==300
    assert str(found["paper-squareoff"].trigger.fields[5].expressions[0])=="15"
    assert str(found["paper-squareoff"].trigger.fields[6].expressions[0])=="20"
    assert isinstance(found["paper-position-exits"].trigger,IntervalTrigger)
    assert found["paper-position-exits"].trigger.interval.total_seconds()==2

def test_market_open_skips_holiday_and_weekend():
    assert not is_market_open(datetime(2026,1,26,10,0,tzinfo=IST))
    assert not is_market_open(datetime(2026,1,24,10,0,tzinfo=IST))

def test_next_market_open_skips_weekend_and_holiday():
    nxt=next_market_open(datetime(2026,1,23,16,0,tzinfo=IST))
    assert nxt==datetime(2026,1,27,9,15,tzinfo=IST)

def test_scheduled_job_skips_non_trading_day(monkeypatch):
    called=[]
    monkeypatch.setattr(jobs,"now_ist",lambda:datetime(2026,1,26,10,tzinfo=IST))
    monkeypatch.setattr(jobs,"is_trading_day",lambda _:False)
    asyncio.run(jobs.safe_job("test",lambda:called.append(True)))
    assert not called

@pytest.mark.asyncio
async def test_backfill_retries_429_and_seeds_without_duplicates(monkeypatch):
    from app.config import settings
    import app.modules.market.feed as feed
    import app.modules.market.upstox_client as client
    import app.modules.market.token_store as token_store
    rows=[]; calls=0
    class Builder:
        async def seed(self,symbol,interval,bars): rows.append((symbol,interval,bars))
    async def instruments(): pass
    monkeypatch.setattr(settings,"feed_mode","live")
    monkeypatch.setattr(feed,"load_instruments",lambda:[{"symbol":"ABC","instrument_key":"NSE_EQ|ABC"}])
    monkeypatch.setattr(token_store,"load_token",lambda:asyncio.sleep(0,result="token"))
    monkeypatch.setattr(jobs,"asyncio",asyncio)
    monkeypatch.setattr("app.modules.market.candle_builder.candle_builder",Builder())
    async def fetch(key,interval,start,end):
        nonlocal calls
        calls+=1
        if calls==1:
            error=RuntimeError("429");error.response=type("R",(),{"status_code":429})();raise error
        return [["2026-01-26T09:15:00+05:30",10,11,9,10.5,100,0]]
    monkeypatch.setattr(client,"fetch_historical_candles",fetch)
    await jobs.backfill_candles()
    assert calls==3 and len(rows)==2
    assert jobs.backfill_state["status"]=="complete"

@pytest.mark.asyncio
async def test_candle_builder_seed_upserts_without_duplicate_memory_bars(monkeypatch):
    from app.modules.market.candle_builder import CandleBuilder
    import app.db as db_module
    class Collection:
        def __init__(self): self.calls=[]
        async def update_one(self,*args,**kwargs): self.calls.append((args,kwargs))
    class DB: pass
    database=DB();database.candles=Collection()
    monkeypatch.setattr(db_module,"get_db",lambda:database)
    builder=CandleBuilder();stamp=datetime(2026,1,26,9,15,tzinfo=IST)
    bar={"start":stamp,"o":10,"h":11,"l":9,"c":10.5,"v":20}
    await builder.seed("ABC","5m",[bar]);await builder.seed("ABC","5m",[bar])
    assert len(builder.history["ABC"]["5m"])==1
    assert len(database.candles.calls)==2
