"""IST job scheduler and guarded job functions."""
from __future__ import annotations
import asyncio, logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from app.config import settings
from app.core.timeutils import is_market_open, is_trading_day, now_ist

logger=logging.getLogger(__name__)
IST=ZoneInfo("Asia/Kolkata")
backfill_state={"status":"pending","symbols_done":0,"symbols_total":50,"error":None}

async def safe_job(name, function, *, market_hours=False, trading_day=True):
    now=now_ist()
    if trading_day and not is_trading_day(now):
        logger.info("Skipping %s on non-trading day",name);return
    if market_hours and not is_market_open(now):
        logger.info("Skipping %s outside market hours",name);return
    try: await function()
    except Exception: logger.exception("Scheduled job failed: %s",name)

async def token_check():
    from app.modules.market.token_store import load_token
    from app.main import health_state
    try: health_state["upstox_token_ok"]=bool(await load_token())
    except Exception:
        health_state["upstox_token_ok"]=False
        logger.exception("LOUD: Upstox token check failed")
    if not health_state["upstox_token_ok"]: logger.error("LOUD: Upstox access token is missing or expired")

async def resolve_predictions():
    from app.modules.predictions.resolver import resolve_pending
    await resolve_pending()

async def snapshot_equity():
    from app.db import get_db
    from app.modules.market.price_cache import price_cache
    db=get_db(); now=datetime.now(IST).astimezone(ZoneInfo("UTC"))
    async for wallet in db.wallets.find({}):
        unreal=0.0
        async for position in db.positions.find({"user_id":wallet["user_id"]}):
            quote=price_cache.get(position["symbol"])
            if quote:
                direction=1 if position["side"]=="LONG" else -1
                unreal+=(quote["ltp"]-position["avg_price"])*position["qty"]*direction
        await db.equity_snapshots.update_one({"user_id":wallet["user_id"],"ts":now},{"$set":{"user_id":wallet["user_id"],"ts":now,"equity":wallet["balance"]+unreal,"realized_pnl":wallet.get("realized_pnl",0),"unrealized_pnl":unreal}},upsert=True)

async def square_off():
    from app.modules.paper.squareoff import square_off_all
    await square_off_all()

async def position_exit_check():
    from app.modules.paper.engine import evaluate_exits
    await evaluate_exits()

def build_scheduler() -> AsyncIOScheduler:
    scheduler=AsyncIOScheduler(timezone=IST)
    scheduler.add_job(safe_job,CronTrigger(day_of_week="mon-fri",hour=8,minute=45,timezone=IST),args=("token_check",token_check),id="upstox-token-check",coalesce=True,misfire_grace_time=3600)
    scheduler.add_job(safe_job,IntervalTrigger(minutes=1,timezone=IST),args=("prediction_resolver",resolve_predictions),kwargs={"trading_day":False},id="prediction-resolver",coalesce=True,max_instances=1)
    scheduler.add_job(safe_job,IntervalTrigger(minutes=5,timezone=IST),args=("equity_snapshot",snapshot_equity),kwargs={"market_hours":True},id="equity-snapshot",coalesce=True,max_instances=1)
    hour,minute=(int(part) for part in settings.squareoff_time.split(":"))
    scheduler.add_job(safe_job,CronTrigger(day_of_week="mon-fri",hour=hour,minute=minute,timezone=IST),args=("squareoff",square_off),id="paper-squareoff",coalesce=True,misfire_grace_time=300)
    scheduler.add_job(safe_job,IntervalTrigger(seconds=2,timezone=IST),args=("position-exits",position_exit_check),kwargs={"market_hours":True},id="paper-position-exits",coalesce=True,max_instances=1)
    return scheduler

async def backfill_candles():
    from app.modules.market.feed import load_instruments
    from app.modules.market.candle_builder import candle_builder
    from app.modules.market.upstox_client import fetch_historical_candles
    from app.modules.market.token_store import load_token
    instruments=load_instruments();backfill_state.update(status="running",symbols_total=len(instruments),symbols_done=0,error=None)
    if settings.feed_mode.lower()=="replay":
        from app.modules.market.price_cache import price_cache
        from app.modules.market.replay_feed import seed_replay_history
        await seed_replay_history(instruments,candle_builder,price_cache)
        backfill_state.update(status="complete",symbols_done=len(instruments));return
    if not await load_token():
        logger.error("Skipping candle backfill: Upstox token is missing or expired")
        backfill_state.update(status="skipped",error="Upstox token missing");return
    semaphore=asyncio.Semaphore(5)
    today=now_ist().date(); from_date=(today-timedelta(days=14)).isoformat(); to_date=today.isoformat()
    async def get_bars(inst, interval):
        for attempt in range(5):
            try:
                async with semaphore:
                    bars=await fetch_historical_candles(inst["instrument_key"],interval,from_date,to_date)
                return bars
            except Exception as exc:
                status=getattr(getattr(exc,"response",None),"status_code",None)
                if status==429 and attempt<4:
                    await asyncio.sleep(min(2**attempt,16));continue
                raise
    async def one(inst):
        try:
            for interval in ("5m","30m"):
                bars=await get_bars(inst,interval)
                parsed=[]
                for row in bars[-200:]:
                    from datetime import datetime as dt
                    stamp=dt.fromisoformat(row[0])
                    parsed.append({"start":stamp,"o":row[1],"h":row[2],"l":row[3],"c":row[4],"v":row[5]})
                await candle_builder.seed(inst["symbol"],interval,parsed)
        except Exception:
            logger.exception("Backfill failed for %s",inst["symbol"])
        finally: backfill_state["symbols_done"]+=1
    await asyncio.gather(*(one(inst) for inst in instruments))
    backfill_state["status"]="complete"

async def guarded_backfill():
    try: await backfill_candles()
    except asyncio.CancelledError: raise
    except Exception as exc:
        logger.exception("Startup market candle backfill failed")
        backfill_state.update(status="failed",error=str(exc))
