import asyncio
from app.cache import PredictionCache
from app.models.direction import expected_return_pct,direction_for_return,summarize_forecasts
from app.router import _compute
from app.schemas import PredictRequest
from tests.test_contract import candles

def test_direction_boundaries_and_probability():
    assert expected_return_pct(101,100)==1
    assert direction_for_return(.049)=="SIDEWAYS"
    assert direction_for_return(.05)=="UP"
    assert direction_for_return(-.05)=="DOWN"
    result=summarize_forecasts([101,102,103,99],100)
    assert result["direction"]=="UP" and result["probability"]==.75
    assert result["confidence"]=="high"

def test_router_selects_kronos_steps_and_lpatchtst():
    class Kronos:
        available=True
        def forecast_paths(self,data,pred_len,samples):self_len.append((pred_len,samples));return [102]*samples
    class Lpatch:
        available=True
        def forecast_close(self,data):lpatch_calls.append(True);return 102
    self_len=[];lpatch_calls=[]
    app=type("App",(),{"state":type("State",(),{"kronos":Kronos(),"lpatchtst":Lpatch()})()})()
    _compute(app,PredictRequest(symbol="RELIANCE",horizon=5,candles=candles()))
    _compute(app,PredictRequest(symbol="RELIANCE",horizon=10,candles=candles()))
    response=_compute(app,PredictRequest(symbol="RELIANCE",horizon=30,candles=candles(12,30)))
    assert self_len==[(1,5),(2,5)] and lpatch_calls==[True]
    assert response["model"]=="lpatchtst" and response["probability"]==.5

def test_cache_single_flight_concurrency():
    async def run():
        cache=PredictionCache(10);counter=0
        async def factory():
            nonlocal counter;counter+=1;await asyncio.sleep(.02);return 4
        answers=await asyncio.gather(*(cache.get_or_compute(("ABC",5,"ts"),factory) for _ in range(40)))
        assert counter==1 and answers==[4]*40
    asyncio.run(run())

def test_cache_distinguishes_bar_timestamp():
    async def run():
        cache=PredictionCache();n=0
        async def factory():
            nonlocal n;n+=1;return n
        assert await cache.get_or_compute(("ABC",5,"a"),factory)==1
        assert await cache.get_or_compute(("ABC",5,"b"),factory)==2
    asyncio.run(run())

def test_cache_and_inference_semaphore_bound_concurrency():
    async def run():
        cache=PredictionCache(10);semaphore=asyncio.Semaphore(2)
        active=0;maximum=0;calls=0
        async def request(key):
            async def compute():
                nonlocal active,maximum,calls
                async with semaphore:
                    calls+=1;active+=1;maximum=max(maximum,active)
                    await asyncio.sleep(.02)
                    active-=1
                    return key
            return await cache.get_or_compute(key,compute)
        keys=[("ABC",5,"same")]*20+[("XYZ",5,str(i)) for i in range(20)]
        answers=await asyncio.gather(*(request(key) for key in keys))
        assert answers==keys
        assert calls==21  # 20 duplicate calls share one inference; distinct keys stay independent.
        assert maximum==2
    asyncio.run(run())
