import json
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
UTC = timezone.utc
HOLIDAYS_FILE = Path(__file__).resolve().parents[1] / "data" / "holidays.json"

def market_holidays() -> set[date]:
    """NSE closure dates; verify against the NSE holiday calendar each year."""
    try:
        data=json.loads(HOLIDAYS_FILE.read_text(encoding="utf-8"))
        return {date.fromisoformat(item) for item in data.get("holidays", [])}
    except (OSError, ValueError, TypeError):
        return set()

def is_trading_day(value: date | datetime) -> bool:
    day=value.date() if isinstance(value,datetime) else value
    return day.weekday()<5 and day not in market_holidays()

def now_ist() -> datetime:
    return datetime.now(IST)

def to_utc(value: datetime) -> datetime:
    return value.astimezone(UTC) if value.tzinfo else value.replace(tzinfo=IST).astimezone(UTC)

def to_ist(value: datetime) -> datetime:
    return value.astimezone(IST) if value.tzinfo else value.replace(tzinfo=UTC).astimezone(IST)

def is_market_open(value: datetime | None = None) -> bool:
    current = to_ist(value) if value else now_ist()
    return is_trading_day(current) and time(9,15) <= current.time() < time(15,30)

def next_market_open(value: datetime | None = None) -> datetime:
    current=to_ist(value) if value else now_ist()
    opening=time(9,15)
    candidate=current.replace(hour=9,minute=15,second=0,microsecond=0)
    if current.time() >= time(15,30): candidate+=timedelta(days=1)
    while not is_trading_day(candidate): candidate+=timedelta(days=1)
    if candidate.date()==current.date() and current.time()<opening: return candidate
    return candidate
