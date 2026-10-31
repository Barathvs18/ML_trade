from datetime import datetime, timedelta, time as daytime
from zoneinfo import ZoneInfo

import pandas as pd

from app.schemas import PredictRequest
from scripts.fetch_yfinance import resample_5m_to_backend_30m

IST = ZoneInfo("Asia/Kolkata")


def test_yfinance_resample_matches_backend_30m_session_grid():
    start = datetime(2026, 1, 5, 9, 15, tzinfo=IST)
    rows = []
    for index in range(75):
        stamp = start + timedelta(minutes=5 * index)
        if stamp.hour * 60 + stamp.minute >= 15 * 60 + 30:
            break
        close = 100 + index
        rows.append({"t": stamp.isoformat(), "o": close - 0.5, "h": close + 1, "l": close - 1, "c": close, "v": 10})
    bars = resample_5m_to_backend_30m(pd.DataFrame(rows))
    assert len(bars) == 13
    assert bars.iloc[0]["t"].endswith("09:15:00+0530")
    assert bars.iloc[-1]["t"].endswith("15:15:00+0530")
    assert bars.iloc[0]["o"] == rows[0]["o"]
    assert bars.iloc[0]["c"] == rows[5]["c"]
    assert bars.iloc[0]["v"] == 60
    candles = bars.to_dict(orient="records")
    request = PredictRequest(symbol="NSEI", horizon=30, candles=candles)
    assert request.candles[0].t.hour == 9 and request.candles[0].t.minute == 15
