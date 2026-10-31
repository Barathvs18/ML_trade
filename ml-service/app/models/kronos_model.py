from dataclasses import dataclass
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo
import math

import pandas as pd

from app.config import settings

IST = ZoneInfo("Asia/Kolkata")
SESSION_OPEN = time(9, 15)
SESSION_CLOSE = time(15, 30)
MODEL_CONFIG = {
    "small": (512, "Kronos-Tokenizer-base"),
    "base": (512, "Kronos-Tokenizer-base"),
    "mini": (2048, "Kronos-Tokenizer-2k"),
}


def future_bar_timestamps(
    last_timestamp: datetime,
    pred_len: int,
    interval_minutes: int = 5,
) -> list[datetime]:
    """Return 5m/30m NSE bar starts, rolling session close and weekends forward."""
    if interval_minutes not in (5, 30):
        raise ValueError("Kronos candles must use a 5- or 30-minute interval")
    if pred_len not in (1, 2) or (interval_minutes == 30 and pred_len != 1):
        raise ValueError("Kronos supports 1/2 bars at 5m and 1 bar at 30m")
    if last_timestamp.tzinfo is None or last_timestamp.utcoffset() is None:
        raise ValueError("bar timestamp must include a timezone")

    current = last_timestamp.astimezone(IST)
    future = []
    for _ in range(pred_len):
        candidate = current + timedelta(minutes=interval_minutes)
        if candidate.time() >= SESSION_CLOSE:
            session_date = candidate.date() + timedelta(days=1)
            while session_date.weekday() >= 5:
                session_date += timedelta(days=1)
            candidate = datetime.combine(session_date, SESSION_OPEN, tzinfo=IST)
        future.append(candidate)
        current = candidate
    return future


@dataclass
class KronosModel:
    predictor: object | None = None
    mock: bool = True
    available: bool = True
    max_context: int = 512

    @classmethod
    def load(cls):
        if settings.model_mock:
            return cls(mock=True, available=True, max_context=512)

        model_key = settings.kronos_model.rsplit("/", 1)[-1].lower()
        variant = next((name for name in MODEL_CONFIG if name in model_key), None)
        if variant is None:
            raise ValueError("KRONOS_MODEL must name a supported small, base, or mini model")
        context, expected_tokenizer = MODEL_CONFIG[variant]
        tokenizer_key = settings.kronos_tokenizer.rsplit("/", 1)[-1]
        if tokenizer_key != expected_tokenizer:
            raise ValueError(f"{settings.kronos_model} requires {expected_tokenizer}")

        from app.vendor.kronos import Kronos, KronosPredictor, KronosTokenizer

        hub_options = {"cache_dir": settings.model_cache_dir}
        if settings.hf_token:
            hub_options["token"] = settings.hf_token

        tokenizer = KronosTokenizer.from_pretrained(
            settings.kronos_tokenizer,
            revision=settings.kronos_tokenizer_revision,
            **hub_options,
        )
        model = Kronos.from_pretrained(
            settings.kronos_model,
            revision=settings.kronos_model_revision,
            **hub_options,
        )
        tokenizer.eval()
        model.eval()
        predictor = KronosPredictor(model, tokenizer, device="cpu", max_context=context)
        return cls(predictor=predictor, mock=False, available=True, max_context=context)

    def forecast_paths(
        self,
        candles: list[dict],
        pred_len: int,
        samples: int,
        interval_minutes: int = 5,
    ) -> list[float]:
        if not candles:
            raise ValueError("Kronos requires at least one candle")
        if interval_minutes not in (5, 30):
            raise ValueError("Kronos candles must use a 5- or 30-minute interval")
        if pred_len not in (1, 2) or (interval_minutes == 30 and pred_len != 1):
            raise ValueError("Kronos supports 1/2 bars at 5m and 1 bar at 30m")
        if samples < 1:
            raise ValueError("Kronos sample count must be positive")

        candles=candles[-max(1,self.max_context):]

        last = float(candles[-1]["c"])
        if self.mock:
            recent = [float(candle["c"]) for candle in candles[-6:]]
            momentum = (recent[-1] - recent[0]) / max(1, len(recent) - 1)
            scale = max(last * 0.00015, abs(momentum) * 0.35)
            return [last + momentum * pred_len + scale * math.sin(i * 1.7) for i in range(samples)]

        if not self.available or self.predictor is None:
            raise RuntimeError("Kronos model is unavailable")

        timestamps = pd.Series(pd.to_datetime([candle["t"] for candle in candles], utc=True))
        timestamps = timestamps.dt.tz_convert(IST)
        frame = pd.DataFrame(
            {
                "open": [float(candle["o"]) for candle in candles],
                "high": [float(candle["h"]) for candle in candles],
                "low": [float(candle["l"]) for candle in candles],
                "close": [float(candle["c"]) for candle in candles],
                "volume": [float(candle["v"]) for candle in candles],
            }
        )
        # Kronos expects OHLCV plus amount; the backend contract has no amount field.
        frame["amount"] = frame["close"] * frame["volume"]
        future = pd.Series(future_bar_timestamps(candles[-1]["t"], pred_len, interval_minutes))

        forecasts = []
        for _ in range(samples):
            # Upstream averages sample_count paths internally. Use one sampled path per
            # call so direction probability is computed from independent close paths.
            prediction = self.predictor.predict(
                df=frame,
                x_timestamp=timestamps,
                y_timestamp=future,
                pred_len=pred_len,
                T=1.0,
                top_p=0.9,
                sample_count=1,
                verbose=False,
            )
            close = float(prediction["close"].iloc[-1])
            if not math.isfinite(close) or close <= 0:
                raise ValueError("Kronos returned an invalid close forecast")
            forecasts.append(close)
        return forecasts
