from datetime import datetime, timezone

import pytest

import app.modules.dashboard.router as dashboard_router
import app.modules.dashboard.service as dashboard_service
from app.core.timeutils import IST


class AsyncCursor:
    def __init__(self, rows):
        self.rows = list(rows)

    def sort(self, *_args):
        return self

    def limit(self, count):
        self.rows = self.rows[:count]
        return self

    def __aiter__(self):
        self._iterator = iter(self.rows)
        return self

    async def __anext__(self):
        try:
            return next(self._iterator)
        except StopIteration:
            raise StopAsyncIteration


@pytest.mark.asyncio
async def test_dashboard_summary_daily_pnl_uses_ist_day_and_includes_unrealized(monkeypatch):
    current = datetime(2026, 11, 1, 12, 0, tzinfo=IST)
    trades = [
        {"ts": datetime(2026, 10, 31, 18, 29, 59, tzinfo=timezone.utc), "realized_pnl": 100.0},
        {"ts": datetime(2026, 10, 31, 18, 30, 0, tzinfo=timezone.utc), "realized_pnl": 12.5},
        {"ts": datetime(2026, 11, 1, 13, 0, tzinfo=timezone.utc), "realized_pnl": -3.0},
        {"ts": datetime(2026, 11, 1, 18, 30, 0, tzinfo=timezone.utc), "realized_pnl": 99.0},
    ]
    queries = []

    class Trades:
        def find(self, query, _projection=None):
            queries.append(query)
            ts_filter = query.get("ts")
            rows = trades
            if ts_filter:
                rows = [row for row in rows if ts_filter["$gte"] <= row["ts"] < ts_filter["$lt"]]
            return AsyncCursor(rows if ts_filter else [])

        async def count_documents(self, query):
            return 2 if "realized_pnl" in query else 4

    class Collection:
        def find(self, *_args, **_kwargs):
            return AsyncCursor([])

    class Database:
        trades = Trades()
        predictions = Collection()

    database = Database()
    monkeypatch.setattr(dashboard_service, "get_db", lambda: database)
    monkeypatch.setattr(dashboard_router, "get_db", lambda: database)
    monkeypatch.setattr(dashboard_service, "now_ist", lambda: current)

    async def wallet(_user_id):
        return {"balance": 1000.0, "realized_pnl": 50.0}

    async def positions(_user_id):
        return [{"symbol": "RELIANCE", "unrealized_pnl": 26.0}]

    monkeypatch.setattr(dashboard_router, "wallet", wallet)
    monkeypatch.setattr(dashboard_router, "positions", positions)
    monkeypatch.setattr(dashboard_router, "status", lambda: {"market_open": False})

    result = await dashboard_router.summary(user={"user_id": "user-1", "name": "Learner", "email": "learner@example.com"})

    assert result["today_pnl"] == pytest.approx(35.5)
    assert result["today_trades_count"] == 2
    assert queries[0]["ts"] == {
        "$gte": datetime(2026, 10, 31, 18, 30, tzinfo=timezone.utc),
        "$lt": datetime(2026, 11, 1, 18, 30, tzinfo=timezone.utc),
    }
