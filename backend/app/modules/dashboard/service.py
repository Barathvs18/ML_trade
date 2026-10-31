from datetime import datetime, time, timedelta

from app.core.timeutils import IST, UTC, now_ist, to_ist
from app.db import get_db


async def today_trade_activity(user_id: str, current: datetime | None = None) -> dict[str, float | int]:
    """Return realized P&L and fill count for the current IST calendar day."""
    day = to_ist(current).date() if current else now_ist().date()
    start_ist = datetime.combine(day, time.min, tzinfo=IST)
    start_utc = start_ist.astimezone(UTC)
    end_utc = (start_ist + timedelta(days=1)).astimezone(UTC)
    rows = [
        row async for row in get_db().trades.find(
            {"user_id": user_id, "ts": {"$gte": start_utc, "$lt": end_utc}},
            {"realized_pnl": 1},
        )
    ]
    return {
        "realized_today": sum(float(row.get("realized_pnl", 0) or 0) for row in rows),
        "today_trades_count": len(rows),
    }
