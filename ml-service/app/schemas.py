from datetime import datetime, time as datetime_time
import math
from zoneinfo import ZoneInfo
from typing import Literal
from pydantic import BaseModel,ConfigDict,Field,field_validator,model_validator
from app.config import settings

IST=ZoneInfo("Asia/Kolkata")

class Candle(BaseModel):
    model_config=ConfigDict(extra="forbid")
    t:datetime
    o:float
    h:float
    l:float
    c:float
    v:float=Field(ge=0)

    @field_validator("o","h","l","c","v")
    @classmethod
    def finite(cls,value):
        if not math.isfinite(value):raise ValueError("candle values must be finite (not NaN or infinity)")
        return value

    @field_validator("t")
    @classmethod
    def timezone_required(cls,value):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("candle timestamps must include a timezone")
        return value

    @model_validator(mode="after")
    def valid_ohlc(self):
        if min(self.o,self.h,self.l,self.c)<=0:raise ValueError("prices must be positive")
        if self.h<max(self.o,self.c,self.l) or self.l>min(self.o,self.c,self.h):raise ValueError("inconsistent OHLC values")
        return self

class PredictRequest(BaseModel):
    model_config=ConfigDict(extra="forbid")
    symbol:str=Field(min_length=1,max_length=32,pattern=r"^[A-Za-z0-9&._-]+$")
    horizon:int
    candles:list[Candle]=Field(min_length=1,max_length=200)

    @field_validator("horizon")
    @classmethod
    def allowed_horizon(cls,value):
        if value not in (5,10,30):raise ValueError("horizon must be one of 5, 10, or 30")
        return value

    @model_validator(mode="after")
    def validate_sequence(self):
        interval=30 if self.horizon==30 else 5
        minimum=settings.min_kronos_candles
        if len(self.candles)<minimum:raise ValueError(f"at least {minimum} candles are required for horizon {self.horizon}")
        times=[item.t for item in self.candles]
        if any(b<=a for a,b in zip(times,times[1:])):raise ValueError("candle timestamps must be strictly increasing")
        expected=interval*60
        session_open_minutes=9*60+15
        last_bar_offset=((6*60+15-1)//interval)*interval
        last_bar_minute=session_open_minutes+last_bar_offset
        last_bar_time=datetime_time(last_bar_minute//60,last_bar_minute%60)
        local_times=[value.astimezone(IST) for value in times]
        for local in local_times:
            minute_offset=local.hour*60+local.minute-session_open_minutes
            if minute_offset<0 or minute_offset>last_bar_offset or minute_offset%interval:
                raise ValueError(f"candle timestamps must align to the {interval}-minute NSE session grid starting at 09:15 IST")
        for previous,current,prev_local,current_local in zip(times,times[1:],local_times,local_times[1:]):
            if (current-previous).total_seconds()==expected:
                continue
            # Intraday bars are continuous within a session. A gap is allowed only
            # between the backend's final bar start and the next 09:15 session bar.
            is_session_gap=(
                current_local.date()>prev_local.date()
                and current_local.time().replace(tzinfo=None)==datetime_time(9,15)
                and prev_local.time().replace(tzinfo=None)==last_bar_time
            )
            if not is_session_gap:
                raise ValueError(f"candle spacing must be {interval} minutes within a session; only overnight session gaps are allowed")
        return self

class PredictResponse(BaseModel):
    direction:Literal["UP","DOWN","SIDEWAYS"]
    probability:float=Field(ge=0,le=1)
    confidence:Literal["low","medium","high"]
    model:Literal["kronos"]
    horizon:int
    forecast_close:float
    latency_ms:int=Field(ge=0)
