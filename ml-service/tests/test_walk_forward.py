from datetime import datetime, timedelta, time as daytime
import math
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from app.models.kronos_model import KronosModel
from app.router import _compute
from app.schemas import PredictRequest
from scripts.evaluate import history_at, render_report, score_predictions, wilson_interval

IST = ZoneInfo("Asia/Kolkata")


def candle_series(count=205):
    day = datetime(2026, 1, 5, 9, 15, tzinfo=IST)
    rows = []
    for index in range(count):
        if day.hour * 60 + day.minute > 15 * 60 + 25:
            next_day = day.date() + timedelta(days=1)
            while next_day.weekday() >= 5:
                next_day += timedelta(days=1)
            day = datetime.combine(next_day, daytime(9, 15), tzinfo=IST)
        close = 100 + index * 0.02
        rows.append({"t": day, "o": close, "h": close + 1, "l": close - 1, "c": close, "v": 10 + index})
        day += timedelta(minutes=5)
    return rows


def test_prediction_input_at_t_is_invariant_to_future_rows():
    rows = candle_series()
    index = 199
    original_history = history_at(rows, index)
    future_mutated = [*rows[:index + 1], *[
        {**row, "o": row["o"] * 100, "h": row["h"] * 100, "l": row["l"] * 100, "c": row["c"] * 100, "v": row["v"] * 100}
        for row in rows[index + 1:]
    ]]
    appended_history = history_at(future_mutated, index)
    assert original_history == appended_history

    model = KronosModel(mock=True)
    app = SimpleNamespace(state=SimpleNamespace(kronos=model))
    first = _compute(app, PredictRequest(symbol="NSEI", horizon=5, candles=original_history))
    second = _compute(app, PredictRequest(symbol="NSEI", horizon=5, candles=appended_history))
    assert first == second


def test_walk_forward_metrics_include_baselines_confusion_and_ci():
    rows = [
        {"direction": "UP", "probability": .8, "actual_direction": "UP"},
        {"direction": "UP", "probability": .4, "actual_direction": "SIDEWAYS"},
        {"direction": "DOWN", "probability": .6, "actual_direction": "DOWN"},
        {"direction": "SIDEWAYS", "probability": .7, "actual_direction": "SIDEWAYS"},
    ]
    from scripts.evaluate import score_predictions
    result = score_predictions(rows)
    assert result["count"] == 4
    assert result["accuracy"] == .75
    assert result["always_sideways"] == .5
    assert result["always_up"] == .25
    assert result["majority_accuracy"] == .5
    assert result["high_count"] == 3
    assert result["confusion"]["SIDEWAYS"]["UP"] == 1
    assert all(math.isnan(value) for value in wilson_interval(0, 0))


def test_report_cautions_when_baseline_is_inside_accuracy_interval():
    records = [
        {"direction": "UP", "probability": .8, "actual_direction": "UP"},
        {"direction": "UP", "probability": .4, "actual_direction": "SIDEWAYS"},
        {"direction": "DOWN", "probability": .6, "actual_direction": "DOWN"},
        {"direction": "SIDEWAYS", "probability": .7, "actual_direction": "SIDEWAYS"},
    ]
    metrics = {horizon: score_predictions(records) for horizon in (5, 10, 30)}
    report = render_report(metrics, {5: "5m.csv", 10: "5m.csv", 30: "30m.csv"}, {5: 0, 10: 0, 30: 0})
    assert "includes its best baseline" in report
    assert "only 4 scored points" in report
