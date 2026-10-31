"""Chronological walk-forward evaluation using the service's Kronos path."""
from __future__ import annotations

import argparse
import csv
import math
import random
import sys
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import torch
import numpy as np

torch.set_num_threads(2)

from app.config import settings
from app.models.kronos_model import KronosModel
from app.router import _compute
from app.schemas import PredictRequest

IST = ZoneInfo("Asia/Kolkata")
CLASSES = ("UP", "DOWN", "SIDEWAYS")
EVALUATION_SEED = 20261031


def anchor_model_cache() -> None:
    cache_path = Path(settings.model_cache_dir)
    if not cache_path.is_absolute():
        settings.model_cache_dir = str((ROOT / cache_path).resolve())


def load_csv(path: Path) -> list[dict]:
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        required = {"t", "o", "h", "l", "c", "v"}
        if not reader.fieldnames or not required.issubset({name.strip().lower() for name in reader.fieldnames}):
            raise ValueError(f"{path} must have CSV columns t,o,h,l,c,v")
        lookup = {name.strip().lower(): name for name in reader.fieldnames}
        candles = []
        for line_number, row in enumerate(reader, start=2):
            timestamp = datetime.fromisoformat(row[lookup["t"]].strip().replace("Z", "+00:00"))
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=IST)
            candles.append({
                "t": timestamp,
                "o": float(row[lookup["o"]]),
                "h": float(row[lookup["h"]]),
                "l": float(row[lookup["l"]]),
                "c": float(row[lookup["c"]]),
                "v": float(row[lookup["v"]]),
            })
    candles.sort(key=lambda candle: candle["t"])
    if any(candles[index]["t"] == candles[index - 1]["t"] for index in range(1, len(candles))):
        raise ValueError(f"{path} contains duplicate timestamps")
    return candles


def history_at(candles: list[dict], index: int, window: int = 200) -> list[dict]:
    """Return only the current and past rows for an evaluation point."""
    if index < 0 or index >= len(candles):
        raise IndexError("evaluation index is outside the candle series")
    return candles[max(0, index - window + 1):index + 1]


def evaluation_indices(length: int, bars_ahead: int, max_points: int | None) -> list[int]:
    first, last = 199, length - bars_ahead - 1
    if last < first:
        return []
    candidates = list(range(first, last + 1))
    if max_points is not None and len(candidates) > max_points:
        # Deterministic, chronological sampling across the full available period.
        candidates = sorted({round(first + i * (last - first) / (max_points - 1)) for i in range(max_points)}) if max_points > 1 else [last]
    return candidates


def class_for_close(entry: float, target: float) -> str:
    change_pct = (target - entry) / entry * 100.0
    threshold = settings.sideways_threshold_pct
    if abs(change_pct) < threshold:
        return "SIDEWAYS"
    return "UP" if change_pct > 0 else "DOWN"


def wilson_interval(correct: int, count: int, z: float = 1.959963984540054) -> tuple[float, float]:
    if count == 0:
        return (float("nan"), float("nan"))
    p = correct / count
    denom = 1 + z * z / count
    center = (p + z * z / (2 * count)) / denom
    margin = z * math.sqrt((p * (1 - p) / count) + z * z / (4 * count * count)) / denom
    return max(0.0, center - margin), min(1.0, center + margin)


def score_predictions(records: list[dict]) -> dict:
    count = len(records)
    actuals = [row["actual_direction"] for row in records]
    predicted = [row["direction"] for row in records]
    correct = sum(a == p for a, p in zip(actuals, predicted))
    majority = max(CLASSES, key=lambda label: (actuals.count(label), label == "SIDEWAYS")) if count else "SIDEWAYS"
    cm = {actual: {prediction: 0 for prediction in CLASSES} for actual in CLASSES}
    class_metrics = {}
    for actual, prediction in zip(actuals, predicted):
        cm[actual][prediction] += 1
    for label in CLASSES:
        tp = cm[label][label]
        predicted_count = sum(cm[actual][label] for actual in CLASSES)
        actual_count = sum(cm[label].values())
        class_metrics[label] = {
            "precision": tp / predicted_count if predicted_count else 0.0,
            "recall": tp / actual_count if actual_count else 0.0,
            "support": actual_count,
        }
    high = [row for row in records if row["probability"] >= 0.6]
    low, high_ci = wilson_interval(correct, count)
    return {
        "count": count,
        "accuracy": correct / count if count else float("nan"),
        "always_sideways": actuals.count("SIDEWAYS") / count if count else float("nan"),
        "always_up": actuals.count("UP") / count if count else float("nan"),
        "majority_class": majority,
        "majority_accuracy": actuals.count(majority) / count if count else float("nan"),
        "lift_best_baseline": (correct / count - max(actuals.count("SIDEWAYS"), actuals.count("UP"), actuals.count(majority)) / count) if count else float("nan"),
        "ci_low": low,
        "ci_high": high_ci,
        "high_count": len(high),
        "high_accuracy": sum(row["direction"] == row["actual_direction"] for row in high) / len(high) if high else float("nan"),
        "classes": class_metrics,
        "confusion": cm,
    }


def run_horizon(model: KronosModel, candles: list[dict], horizon: int, max_points: int | None) -> tuple[list[dict], int]:
    bars_ahead = 2 if horizon == 10 else 1
    interval = 30 if horizon == 30 else 5
    indices = evaluation_indices(len(candles), bars_ahead, max_points)
    results = []
    skipped = 0
    app = SimpleNamespace(state=SimpleNamespace(kronos=model))
    for index in indices:
        history = history_at(candles, index)
        try:
            request = PredictRequest(symbol="NSEI", horizon=horizon, candles=history)
            prediction = _compute(app, request)
        except ValueError:
            skipped += 1
            continue
        target = candles[index + bars_ahead]
        actual = class_for_close(candles[index]["c"], target["c"])
        results.append({
            "horizon": horizon,
            "t": candles[index]["t"].isoformat(),
            "target_t": target["t"].isoformat(),
            "entry_close": candles[index]["c"],
            "actual_close": target["c"],
            "forecast_close": prediction["forecast_close"],
            "direction": prediction["direction"],
            "probability": prediction["probability"],
            "p_up": prediction["probabilities"]["UP"],
            "p_down": prediction["probabilities"]["DOWN"],
            "p_sideways": prediction["probabilities"]["SIDEWAYS"],
            "confidence": prediction["confidence"],
            "actual_direction": actual,
            "correct": prediction["direction"] == actual,
        })
    return results, skipped


def render_report(metrics: dict[int, dict], source: dict[int, str], skipped: dict[int, int]) -> str:
    lines = [
        "# Walk-forward evaluation",
        "",
        "Chronological evaluation only; each forecast sees at most the preceding 200 candles and is scored against the next 1 bar (horizons 5/30) or 2 bars (horizon 10). No rows are shuffled and no model is trained on this data.",
        "",
        f"Model: `{settings.kronos_model}`; sample paths: {settings.kronos_samples}; sideways threshold: {settings.sideways_threshold_pct}%; evaluation seed: {EVALUATION_SEED}.",
        "The confidence intervals below are 95% Wilson intervals for accuracy. Samples under 30 are explicitly too small to support a conclusion; even larger intraday Yahoo samples remain a rough diagnostic, not evidence of trading profitability.",
        "The majority-class baseline is selected from actual evaluation labels as a hindsight frequency reference, not a deployable strategy.",
        "Skipped points failed service candle validation; source gaps are excluded rather than filled or interpolated.",
        "",
        "| Horizon | Source | N | Accuracy (95% CI) | Always sideways | Always UP | Majority baseline | Lift vs best baseline | High-confidence accuracy (N) | Skipped |",
        "|---:|---|---:|---|---:|---:|---:|---:|---|---:|",
    ]
    for horizon in (5, 10, 30):
        result = metrics[horizon]
        ci = f"[{result['ci_low']:.3f}, {result['ci_high']:.3f}]" if result["count"] else "n/a"
        high_acc = f"{result['high_accuracy']:.3f} ({result['high_count']})" if result["high_count"] else f"n/a (0)"
        lines.append(
            f"| {horizon} | {source[horizon]} | {result['count']} | {result['accuracy']:.3f} {ci} | {result['always_sideways']:.3f} | {result['always_up']:.3f} | {result['majority_class']} {result['majority_accuracy']:.3f} | {result['lift_best_baseline']:+.3f} | {high_acc} | {skipped[horizon]} |"
        )
        if result["count"] <= 30:
            lines.append("")
            lines.append(f"Horizon {horizon}: only {result['count']} scored points; the sample is too small to conclude whether the model differs meaningfully from a baseline.")
        lines.extend(["", f"### Horizon {horizon}", "", "Per-class precision / recall / support:", "", "| Class | Precision | Recall | Support |", "|---|---:|---:|---:|"])
        for label in CLASSES:
            class_result = result["classes"][label]
            lines.append(f"| {label} | {class_result['precision']:.3f} | {class_result['recall']:.3f} | {class_result['support']} |")
        lines.extend(["", "Confusion matrix (actual rows, predicted columns):", "", "| Actual \\ Predicted | UP | DOWN | SIDEWAYS |", "|---|---:|---:|---:|"])
        for actual in CLASSES:
            lines.append("| " + actual + " | " + " | ".join(str(result["confusion"][actual][pred]) for pred in CLASSES) + " |")
        lines.append("")
    baseline_overlaps = []
    for result in metrics.values():
        if result["count"]:
            best = max(result["always_sideways"], result["always_up"], result["majority_accuracy"])
            baseline_overlaps.append(result["ci_low"] <= best <= result["ci_high"])
    if baseline_overlaps and all(baseline_overlaps):
        lines.extend(["For this run, each horizon's 95% accuracy interval includes its best baseline; these results do not support a claim that the model beats a baseline.", ""])
    lines.extend([
        "### Data and limitations",
        "",
        "Input CSVs are generic `t,o,h,l,c,v` candles. Yahoo Finance `^NSEI` intraday history is generally limited to about 60 days for 5-minute bars. NSEI index data is not the same as tradable Nifty 50 constituent prices, and this evaluation does not account for charges, slippage, liquidity, or overlapping forecast dependence.",
        "",
        "Future information leakage check: `tests/test_walk_forward.py::test_prediction_input_at_t_is_invariant_to_future_rows` verifies that evaluation history and the deterministic mock prediction at time t do not change when later rows are appended.",
    ])
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv-5m", type=Path, default=ROOT / "data" / "nsei_5m.csv")
    parser.add_argument("--csv-30m", type=Path, default=ROOT / "data" / "nsei_30m.csv")
    parser.add_argument("--max-points", type=int, default=30, help="maximum chronological evaluation points per horizon; 0 means all")
    parser.add_argument("--report", type=Path, default=ROOT / "reports" / "evaluation.md")
    parser.add_argument("--predictions", type=Path, default=ROOT / "reports" / "predictions.csv")
    args = parser.parse_args()
    if args.max_points < 0:
        parser.error("--max-points must be nonnegative")
    if settings.model_mock:
        raise SystemExit("Evaluation requires real Kronos weights; set MODEL_MOCK=false.")
    missing = [str(path) for path in (args.csv_5m, args.csv_30m) if not path.exists()]
    if missing:
        raise SystemExit("Missing candle CSV(s): " + ", ".join(missing) + ". Run scripts/fetch_yfinance.py first or pass your own CSVs.")

    anchor_model_cache()
    random.seed(EVALUATION_SEED)
    np.random.seed(EVALUATION_SEED)
    torch.manual_seed(EVALUATION_SEED)
    model = KronosModel.load()
    if not model.available:
        raise SystemExit("Kronos weights could not be loaded; evaluation was not run.")
    frame_5 = load_csv(args.csv_5m)
    frame_30 = load_csv(args.csv_30m)
    point_limit = args.max_points or None
    all_records: list[dict] = []
    metrics: dict[int, dict] = {}
    skipped: dict[int, int] = {}
    source = {5: args.csv_5m.name, 10: args.csv_5m.name, 30: args.csv_30m.name}
    for horizon, candles in ((5, frame_5), (10, frame_5), (30, frame_30)):
        records, skipped[horizon] = run_horizon(model, candles, horizon, point_limit)
        all_records.extend(records)
        metrics[horizon] = score_predictions(records)

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.predictions.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(render_report(metrics, source, skipped), encoding="utf-8")
    columns = ["horizon", "t", "target_t", "entry_close", "actual_close", "forecast_close", "direction", "probability", "p_up", "p_down", "p_sideways", "confidence", "actual_direction", "correct"]
    with args.predictions.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(all_records)
    print(args.report.read_text(encoding="utf-8"))
    print(f"Saved {len(all_records)} prediction rows to {args.predictions}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
