from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pandas as pd

from app.models.kronos_model import KronosModel, future_bar_timestamps

IST = ZoneInfo("Asia/Kolkata")


def friday_close_candles(count=12):
    end = datetime(2026, 1, 2, 15, 25, tzinfo=IST)
    candles = []
    for index in range(count - 1, -1, -1):
        timestamp = end - timedelta(minutes=5 * index)
        close = 100.0 + index
        candles.append({"t": timestamp, "o": close - 0.5, "h": close + 1, "l": close - 1, "c": close, "v": 10 + index})
    return candles


def test_future_timestamps_roll_over_nse_close_and_skip_weekends():
    got = future_bar_timestamps(datetime(2026, 1, 2, 15, 25, tzinfo=IST), 2)
    assert got == [datetime(2026, 1, 5, 9, 15, tzinfo=IST), datetime(2026, 1, 5, 9, 20, tzinfo=IST)]


def test_adapter_requests_individual_sample_paths_with_amount_and_future_grid():
    class FakePredictor:
        def __init__(self):
            self.calls = []

        def predict(self, **kwargs):
            self.calls.append(kwargs)
            return pd.DataFrame({"close": [130.0 + len(self.calls), 140.0 + len(self.calls)]})

    predictor = FakePredictor()
    model = KronosModel(predictor=predictor, mock=False, available=True)
    paths = model.forecast_paths(friday_close_candles(), pred_len=2, samples=3)

    assert paths == [141.0, 142.0, 143.0]
    assert len(predictor.calls) == 3
    assert all(call["sample_count"] == 1 and call["pred_len"] == 2 for call in predictor.calls)
    first = predictor.calls[0]
    assert first["df"].columns.tolist() == ["open", "high", "low", "close", "volume", "amount"]
    assert first["df"].iloc[-1]["amount"] == first["df"].iloc[-1]["close"] * first["df"].iloc[-1]["volume"]
    assert str(first["x_timestamp"].dt.tz) == "Asia/Kolkata"
    assert first["y_timestamp"].tolist() == future_bar_timestamps(friday_close_candles()[-1]["t"], 2)
    assert first["verbose"] is False


def test_loader_uses_matching_tokenizer_and_model_context(monkeypatch):
    from app.config import settings
    import app.vendor.kronos as vendor

    calls = {}

    class LoadedStub:
        @classmethod
        def from_pretrained(cls, model_id, **kwargs):
            calls[model_id] = kwargs
            return cls()

        def eval(self):
            return self

        def to(self, device):
            return self

    class PredictorStub:
        def __init__(self, model, tokenizer, device, max_context):
            calls["predictor"] = (device, max_context)

    monkeypatch.setattr(vendor, "Kronos", LoadedStub)
    monkeypatch.setattr(vendor, "KronosTokenizer", LoadedStub)
    monkeypatch.setattr(vendor, "KronosPredictor", PredictorStub)
    monkeypatch.setattr(settings, "model_mock", False)
    monkeypatch.setattr(settings, "kronos_model", "NeoQuasar/Kronos-mini")
    monkeypatch.setattr(settings, "kronos_tokenizer", "NeoQuasar/Kronos-Tokenizer-2k")
    loaded = KronosModel.load()

    assert loaded.available and not loaded.mock
    assert calls["predictor"] == ("cpu", 2048)

