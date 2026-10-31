from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
UTC = timezone.utc

def now_ist() -> datetime:
    return datetime.now(IST)

def to_utc(value: datetime) -> datetime:
    return value.astimezone(UTC) if value.tzinfo else value.replace(tzinfo=IST).astimezone(UTC)

def to_ist(value: datetime) -> datetime:
    return value.astimezone(IST) if value.tzinfo else value.replace(tzinfo=UTC).astimezone(IST)

def is_market_open(value: datetime | None = None) -> bool:
    current = to_ist(value) if value else now_ist()
    return current.weekday() < 5 and time(9,15) <= current.time() < time(15,30)
