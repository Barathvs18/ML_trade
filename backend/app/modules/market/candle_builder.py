from collections import defaultdict, deque
from datetime import datetime, timedelta
from app.core.timeutils import to_ist, to_utc

class CandleBuilder:
    def __init__(self):
        self.history = defaultdict(lambda: defaultdict(lambda: deque(maxlen=200)))
        self.current = {}
        self.subscribers = set()

    def subscribe(self, queue): self.subscribers.add(queue)
    def unsubscribe(self, queue): self.subscribers.discard(queue)

    @staticmethod
    def bucket(ts: datetime, minutes: int) -> datetime:
        local = to_ist(ts)
        mins = (local.hour * 60 + local.minute - 9 * 60 - 15) // minutes
        start = local.replace(hour=9, minute=15, second=0, microsecond=0) + timedelta(minutes=mins * minutes)
        return start

    async def on_tick(self, symbol: str, ltp: float, volume: float, ts: datetime):
        local = to_ist(ts)
        for interval, minutes in (("5m", 5), ("30m", 30)):
            start = self.bucket(local, minutes)
            key = (symbol, interval)
            bar = self.current.get(key)
            if bar and bar["start"] != start:
                closed = {**bar, "start": to_utc(bar["start"])}
                self.history[symbol][interval].append(closed)
                from app.db import get_db
                await get_db().candles.update_one({"symbol":symbol,"interval":interval,"start":closed["start"]}, {"$set":closed}, upsert=True)
                await self._emit({"type":"candle","symbol":symbol,"interval":interval,"ohlcv":closed,"closed":True})
            if not bar or bar["start"] != start:
                self.current[key] = {"start":start,"o":ltp,"h":ltp,"l":ltp,"c":ltp,"v":volume}
            else:
                bar.update(h=max(bar["h"],ltp),l=min(bar["l"],ltp),c=ltp,v=bar["v"]+volume)
            await self._emit({"type":"candle","symbol":symbol,"interval":interval,"ohlcv":self.current[key],"closed":False})

    async def _emit(self, event):
        for queue in tuple(self.subscribers): await queue.put(event)

    def candles(self, symbol, interval, limit=200):
        rows=list(self.history[symbol][interval])
        if interval == "10m":
            five=list(self.history[symbol]["5m"])
            rows=[]
            for i in range(0,len(five)-1,2):
                a,b=five[i:i+2]
                rows.append({"start":a["start"],"o":a["o"],"h":max(a["h"],b["h"]),"l":min(a["l"],b["l"]),"c":b["c"],"v":a["v"]+b["v"]})
        return rows[-limit:]

candle_builder = CandleBuilder()
