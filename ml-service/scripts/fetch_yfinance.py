"""Download recent ^NSEI intraday candles as generic t,o,h,l,c,v CSV files."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pandas as pd


def _column_name(value: object) -> str:
    parts = value if isinstance(value, tuple) else (value,)
    aliases = {"open": "o", "high": "h", "low": "l", "close": "c", "volume": "v"}
    for part in parts:
        normalized = str(part).strip().lower()
        if normalized in aliases:
            return aliases[normalized]
    return ""


def normalize_history(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        raise ValueError("Yahoo Finance returned no candles")
    names = [_column_name(column) for column in frame.columns]
    selected: dict[str, pd.Series] = {}
    for name, column in zip(names, frame.columns):
        if name:
            selected[name] = frame[column]
    missing = set("ohlcv") - selected.keys()
    if missing:
        raise ValueError(f"Yahoo Finance response is missing columns: {', '.join(sorted(missing))}")
    result = pd.DataFrame({key: selected[key] for key in "ohlcv"}, index=frame.index)
    index = pd.DatetimeIndex(result.index)
    if index.tz is None:
        index = index.tz_localize("Asia/Kolkata")
    else:
        index = index.tz_convert("Asia/Kolkata")
    result.insert(0, "t", index.strftime("%Y-%m-%dT%H:%M:%S%z"))
    result = result.reset_index(drop=True)
    result["v"] = result["v"].fillna(0)
    return result[["t", "o", "h", "l", "c", "v"]].dropna(subset=["o", "h", "l", "c"])


def resample_5m_to_backend_30m(candles: pd.DataFrame) -> pd.DataFrame:
    """Aggregate 5m candles into 30m bars starting at 09:15, including 15:15."""
    buckets: dict[tuple[object, int], list[tuple[object, dict]]] = {}
    for row in candles.to_dict(orient="records"):
        timestamp = pd.Timestamp(row["t"])
        if timestamp.tzinfo is None:
            timestamp = timestamp.tz_localize("Asia/Kolkata")
        else:
            timestamp = timestamp.tz_convert("Asia/Kolkata")
        offset = timestamp.hour * 60 + timestamp.minute - (9 * 60 + 15)
        if offset < 0 or offset >= 6 * 60 + 15:
            continue
        bar_index = offset // 30
        buckets.setdefault((timestamp.date(), bar_index), []).append((timestamp, row))

    result = []
    for (session_date, bar_index), values in sorted(buckets.items()):
        values.sort(key=lambda item: item[0])
        start = pd.Timestamp(session_date).tz_localize("Asia/Kolkata") + pd.Timedelta(minutes=9 * 60 + 15 + 30 * bar_index)
        ohlc = [item[1] for item in values]
        result.append({
            "t": start.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "o": float(ohlc[0]["o"]),
            "h": float(max(item["h"] for item in ohlc)),
            "l": float(min(item["l"] for item in ohlc)),
            "c": float(ohlc[-1]["c"]),
            "v": float(sum(item["v"] for item in ohlc)),
        })
    return pd.DataFrame(result, columns=["t", "o", "h", "l", "c", "v"])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--period", default="60d", help="Yahoo intraday lookback; 5-minute history is generally limited to about 60 days")
    args = parser.parse_args()

    try:
        import yfinance as yf
    except ImportError as exc:
        raise SystemExit("Install requirements.txt first (yfinance is required).") from exc

    args.output_dir.mkdir(parents=True, exist_ok=True)
    # Keep yfinance's SQLite timezone/cookie cache inside this project so the
    # downloader works in restricted containers and does not depend on a user profile.
    yf.set_tz_cache_location(str(args.output_dir / ".yfinance-cache"))
    frame = yf.download(
        "^NSEI",
        period=args.period,
        interval="5m",
        auto_adjust=False,
        actions=False,
        progress=False,
        threads=False,
    )
    if frame.empty:
        raise SystemExit("Yahoo Finance returned no 5-minute ^NSEI candles.")
    candles_5m = normalize_history(frame)
    path_5m = args.output_dir / "nsei_5m.csv"
    candles_5m.to_csv(path_5m, index=False)
    print(f"5m: wrote {len(candles_5m)} candles to {path_5m}")

    # Yahoo's 30m labels are offset from this backend's 09:15 session grid.
    # Aggregate the 5m source instead so 30m timestamps match production inputs.
    candles_30m = resample_5m_to_backend_30m(candles_5m)
    path_30m = args.output_dir / "nsei_30m.csv"
    candles_30m.to_csv(path_30m, index=False)
    print(f"30m: wrote {len(candles_30m)} backend-aligned candles from 5m data to {path_30m}")
    print("Yahoo Finance intraday history is limited; 5-minute data is generally available for about 60 days.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
