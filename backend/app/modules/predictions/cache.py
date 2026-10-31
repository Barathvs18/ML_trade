import asyncio
class PredictionCache:
    def __init__(self): self.values={}; self.locks={}; self.semaphore=asyncio.Semaphore(2)
    async def get_or_create(self,key, factory):
        async with self.locks.setdefault(key,asyncio.Lock()):
            if key in self.values:return self.values[key]
            async with self.semaphore: value=await factory()
            self.values[key]=value;return value
    def invalidate(self,symbol,interval):
        horizon={"5m":5,"10m":10,"30m":30}.get(interval)
        if horizon:self.values.pop((symbol,horizon),None)
cache=PredictionCache()
