from app.modules.market.MarketDataFeedV3_pb2 import FeedResponse, Feed, LTPC, FullFeed, MarketFullFeed
from app.modules.market.upstox_client import candle_request, parse_feed_message

def test_candle_paths_and_parameters():
    url, params = candle_request("minutes", 5, "NSE_EQ|INE002A01018", to_date="2026-10-31", from_date="2026-10-01")
    assert url == "https://api.upstox.com/v3/historical-candle/NSE_EQ%7CINE002A01018/minutes/5/2026-10-31/2026-10-01"
    assert params == {}
    url, _ = candle_request("minutes", 30, "NSE_EQ|INE002A01018", intraday=True)
    assert url.endswith("/v3/historical-candle/intraday/NSE_EQ%7CINE002A01018/minutes/30")

def test_candle_path_rejects_invalid_units_and_missing_to_date():
    import pytest
    with pytest.raises(ValueError): candle_request("seconds", 5, "x", to_date="2026-10-31")
    with pytest.raises(ValueError): candle_request("minutes", 5, "x")

def test_historical_candle_http_request_is_v3(monkeypatch):
    import asyncio
    import app.modules.market.token_store as token_store
    import app.modules.market.upstox_client as client_module
    calls=[]
    class Response:
        def raise_for_status(self): pass
        def json(self): return {"data":{"candles":[["2026-10-30T09:15:00+05:30",1,2,.5,1.5,10,0]]}}
    class Client:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self,*args): pass
        async def get(self,url,**kwargs): calls.append((url,kwargs));return Response()
    async def token(): return "fake-token"
    monkeypatch.setattr(token_store,"load_token",token)
    monkeypatch.setattr(client_module.httpx,"AsyncClient",Client)
    rows=asyncio.run(client_module.fetch_historical_candles("NSE_EQ|INE002A01018","5m","2026-10-01","2026-10-31"))
    assert len(rows)==1
    assert calls[0][0].startswith("https://api.upstox.com/v3/historical-candle/")
    assert calls[0][1]["headers"]["Authorization"]=="Bearer fake-token"

def test_parse_ltp_feed_sample_bytes():
    response=FeedResponse(currentTs=1_798_000_000_000)
    response.feeds["NSE_EQ|INE002A01018"].ltpc.CopyFrom(LTPC(ltp=1234.5,ltt=1_798_000_000_001,ltq=25))
    ticks=parse_feed_message(response.SerializeToString(),{"NSE_EQ|INE002A01018":"RELIANCE"})
    assert ticks == [{"symbol":"RELIANCE","ltp":1234.5,"ts":1_798_000_000_001,"volume":25}]

def test_parse_full_feed_ltp_and_cumulative_volume_sample_bytes():
    response=FeedResponse(currentTs=1_798_000_000_000)
    feed=response.feeds["NSE_EQ|INE002A01018"]
    feed.fullFeed.marketFF.CopyFrom(MarketFullFeed(ltpc=LTPC(ltp=2500.0,ltt=1_798_000_000_001),vtt=987654))
    ticks=parse_feed_message(response.SerializeToString(),{"NSE_EQ|INE002A01018":"RELIANCE"})
    assert ticks[0]["ltp"]==2500.0 and ticks[0]["volume"]==987654
