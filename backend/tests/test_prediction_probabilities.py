from types import SimpleNamespace

import pytest
from bson import ObjectId

import app.modules.predictions.ml_client as ml_client
import app.modules.predictions.ml_mock as ml_mock
import app.modules.predictions.router as prediction_router
import app.modules.predictions.service as prediction_service


PROBABILITIES = {"UP": 0.6, "DOWN": 0.25, "SIDEWAYS": 0.15}


def test_mock_ml_includes_class_probabilities():
    prediction = ml_mock.predict_mock(5)
    assert set(prediction["probabilities"]) == {"UP", "DOWN", "SIDEWAYS"}
    assert sum(prediction["probabilities"].values()) == pytest.approx(1.0)
    assert prediction["probabilities"][prediction["direction"]] == pytest.approx(prediction["probability"])


@pytest.mark.asyncio
async def test_ml_client_passes_probabilities_through(monkeypatch):
    payload = {"direction": "UP", "probability": 0.6, "probabilities": PROBABILITIES}
    calls = []

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return payload

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, json, headers):
            calls.append((url, json, headers))
            return Response()

    monkeypatch.setattr(ml_client.settings, "ml_mock", False)
    monkeypatch.setattr(ml_client.httpx, "AsyncClient", lambda **_kwargs: Client())
    response = await ml_client.predict("RELIANCE", 5, [{"t": "2026-01-01T09:15:00+05:30"}])

    assert response["probabilities"] == PROBABILITIES
    assert calls[0][0].endswith("/predict")


@pytest.mark.asyncio
async def test_prediction_service_stores_and_returns_probabilities(monkeypatch):
    inserted = {}

    class Predictions:
        async def insert_one(self, document):
            inserted.update(document)
            return SimpleNamespace(inserted_id=ObjectId())

    class Database:
        predictions = Predictions()

    class Cache:
        async def get_or_create(self, _key, _build):
            return {
                "model": "kronos",
                "direction": "UP",
                "probability": 0.6,
                "probabilities": PROBABILITIES,
                "confidence": "high",
                "forecast_close": 105.0,
            }

    monkeypatch.setattr(prediction_service, "is_market_open", lambda: True)
    monkeypatch.setattr(prediction_service.price_cache, "get", lambda _symbol: {"ltp": 100.0})
    monkeypatch.setattr(prediction_service, "cache", Cache())
    monkeypatch.setattr(prediction_service, "get_db", lambda: Database())

    response = await prediction_service.get_or_create_prediction(
        {"user_id": "user-1"}, "RELIANCE", 5
    )

    assert inserted["probabilities"] == PROBABILITIES
    assert response["probabilities"] == PROBABILITIES


@pytest.mark.asyncio
async def test_prediction_post_and_list_return_optional_probabilities(monkeypatch):
    monkeypatch.setattr(prediction_router.limiter, "allow", lambda *_args: True)

    async def create_prediction(_user, _symbol, _horizon):
        return {"symbol": "RELIANCE", "horizon": 5, "probabilities": PROBABILITIES}

    class Cursor:
        def __init__(self, rows):
            self.rows = rows

        def sort(self, *_args):
            return self

        def limit(self, _limit):
            return self

        def __aiter__(self):
            self._iterator = iter(self.rows)
            return self

        async def __anext__(self):
            try:
                return next(self._iterator)
            except StopIteration:
                raise StopAsyncIteration

    rows = [
        {"_id": ObjectId(), "symbol": "RELIANCE", "probabilities": PROBABILITIES},
        {"_id": ObjectId(), "symbol": "TCS"},  # Existing documents stay valid.
    ]

    class Predictions:
        def find(self, _filter):
            return Cursor(rows)

    class Database:
        predictions = Predictions()

    monkeypatch.setattr(prediction_router, "get_or_create_prediction", create_prediction)
    monkeypatch.setattr(prediction_router, "get_db", lambda: Database())
    user = {"user_id": "user-1"}

    created = await prediction_router.create({"symbol": "RELIANCE", "horizon": 5}, user=user)
    listed = await prediction_router.listing(user=user)

    assert created["probabilities"] == PROBABILITIES
    assert listed[0]["probabilities"] == PROBABILITIES
    assert "probabilities" not in listed[1]
