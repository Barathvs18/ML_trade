import asyncio
import time

class PredictionCache:
    def __init__(self,ttl_seconds:int=240,max_entries:int=2048):
        self.ttl_seconds=ttl_seconds;self.max_entries=max_entries;self.values={};self.locks={};self._guard=asyncio.Lock()

    async def get_or_compute(self,key,factory):
        async with self._guard:lock=self.locks.setdefault(key,asyncio.Lock())
        async with lock:
            now=time.monotonic();entry=self.values.get(key)
            if entry and entry[0]>now:return entry[1]
            value=await factory()
            if len(self.values)>=self.max_entries:
                oldest=min(self.values,key=lambda item:self.values[item][0]);self.values.pop(oldest,None)
            self.values[key]=(now+self.ttl_seconds,value)
            return value

    async def clear(self):
        async with self._guard:self.values.clear();self.locks.clear()
