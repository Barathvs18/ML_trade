"""Measure real Kronos inference latency and RSS on two CPU threads."""
from __future__ import annotations

import argparse
import math
import os
import statistics
import sys
import time
from datetime import datetime, time as daytime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

SCRIPT_STARTED = time.perf_counter()
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import psutil
import torch

torch.set_num_threads(2)

from app.config import settings
from app.models.direction import summarize_forecasts
from app.models.kronos_model import KronosModel

IST = ZoneInfo("Asia/Kolkata")


def synthetic_candles(count: int, interval: int) -> list[dict]:
    date = datetime(2026, 1, 5, 9, 15, tzinfo=IST)
    rows: list[dict] = []
    price = 24000.0
    for _ in range(count):
        while date.weekday() >= 5:
            date = (date + timedelta(days=1)).replace(hour=9, minute=15)
        if date.hour * 60 + date.minute >= 15 * 60 + 30:
            date = (date + timedelta(days=1)).replace(hour=9, minute=15)
            continue
        close = price + math.sin(len(rows) / 4) * 3 + math.cos(len(rows) / 13)
        rows.append({"t": date, "o": price, "h": max(price, close) + 2, "l": min(price, close) - 2, "c": close, "v": 1000 + len(rows)})
        price = close
        date += timedelta(minutes=interval)
        if date.hour * 60 + date.minute >= 15 * 60 + 30:
            next_day = date.date() + timedelta(days=1)
            while next_day.weekday() >= 5:
                next_day += timedelta(days=1)
            date = datetime.combine(next_day, daytime(9, 15), tzinfo=IST)
    return rows


def rss_mb() -> float:
    return psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024)


def anchor_model_cache() -> None:
    cache_path = Path(settings.model_cache_dir)
    if not cache_path.is_absolute():
        settings.model_cache_dir = str((ROOT / cache_path).resolve())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repeats", type=int, default=5, help="measured requests for each horizon/sample count")
    parser.add_argument("--output", type=Path, default=ROOT / "reports" / "benchmark.txt")
    args = parser.parse_args()
    if args.repeats < 2:
        parser.error("--repeats must be at least 2 for a useful percentile")
    if settings.model_mock:
        raise SystemExit("Benchmark requires real Kronos weights; set MODEL_MOCK=false.")

    anchor_model_cache()
    load_started = time.perf_counter()
    model = KronosModel.load()
    cold_start = time.perf_counter() - SCRIPT_STARTED
    load_seconds = time.perf_counter() - load_started
    if not model.available:
        raise SystemExit("Kronos weights could not be loaded; benchmark was not run.")
    rss_loaded = rss_mb()
    rows = [
        "AlgoPredict Kronos benchmark (real weights; PyTorch threads=2)",
        f"Model: {settings.kronos_model}; context={model.max_context}; device=cpu",
        f"Cold start (script entry through model load): {cold_start:.3f}s; model load segment: {load_seconds:.3f}s",
        f"RSS after model load: {rss_loaded:.1f} MiB",
        f"Measured requests per case: {args.repeats}; input: 200 deterministic synthetic candles",
        "",
        "| Horizon | Sample paths | p50 (ms) | p95 (ms) | RSS after predictions (MiB) |",
        "|---:|---:|---:|---:|---:|",
    ]
    rss_after = rss_loaded
    for horizon, interval, pred_len in ((5, 5, 1), (10, 5, 2), (30, 30, 1)):
        candles = synthetic_candles(200, interval)
        for samples in (5, 10, 20):
            model.forecast_paths(candles, pred_len, samples, interval_minutes=interval)  # warmup excluded
            durations = []
            for _ in range(args.repeats):
                started = time.perf_counter()
                paths = model.forecast_paths(candles, pred_len, samples, interval_minutes=interval)
                summarize_forecasts(paths, candles[-1]["c"])
                durations.append((time.perf_counter() - started) * 1000)
            rss_after = rss_mb()
            rows.append(
                f"| {horizon} | {samples} | {statistics.median(durations):.1f} | {sorted(durations)[math.ceil(.95 * len(durations)) - 1]:.1f} | {rss_after:.1f} |"
            )
    rows.extend(["", f"RSS after all predictions: {rss_after:.1f} MiB", "Latency includes path voting and is measured after one warmup per case."])
    report = "\n".join(rows) + "\n"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(report, encoding="utf-8")
    print(report, end="")
    print(f"Saved {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
