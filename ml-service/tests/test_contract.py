from datetime import datetime,timedelta,timezone
import math
import pytest
from fastapi.testclient import TestClient
from fastapi.encoders import jsonable_encoder
from app.main import create_app
from app.schemas import PredictRequest

def candles(count=12,minutes=5):
    start=datetime(2026,1,5,9,15,tzinfo=timezone.utc)
    return [{"t":start+timedelta(minutes=minutes*i),"o":100+i,"h":102+i,"l":99+i,"c":101+i,"v":10+i} for i in range(count)]

def test_request_validates_horizon_count_spacing_order_and_values():
    req=PredictRequest(symbol="RELIANCE",horizon=5,candles=candles())
    assert req.horizon==5
    with pytest.raises(ValueError,match="horizon must"):
        PredictRequest(symbol="RELIANCE",horizon=7,candles=candles())
    with pytest.raises(ValueError,match="at least"):
        PredictRequest(symbol="RELIANCE",horizon=5,candles=candles(2))
    bad=candles();bad[2]["t"]=bad[1]["t"]
    with pytest.raises(ValueError,match="strictly increasing"):
        PredictRequest(symbol="RELIANCE",horizon=5,candles=bad)
    bad=candles();bad[5]["t"]+=timedelta(minutes=1)
    with pytest.raises(ValueError,match="spacing"):
        PredictRequest(symbol="RELIANCE",horizon=5,candles=bad)
    bad=candles();bad[0]["o"]=float("nan")
    with pytest.raises(ValueError,match="finite"):
        PredictRequest(symbol="RELIANCE",horizon=5,candles=bad)
    bad=candles();bad[0]["c"]=-2
    with pytest.raises(ValueError,match="positive"):
        PredictRequest(symbol="RELIANCE",horizon=5,candles=bad)

def test_horizon_30_accepts_30m_candles():
    assert PredictRequest(symbol="TCS",horizon=30,candles=candles(12,30)).horizon==30

def test_candle_spacing_allows_overnight_and_weekend_session_gap():
    from zoneinfo import ZoneInfo
    ist=ZoneInfo("Asia/Kolkata")
    monday=datetime(2026,1,5,9,15,tzinfo=ist)
    friday=datetime(2026,1,2,15,25,tzinfo=ist)
    history=[{"t":friday+timedelta(minutes=5*i),"o":100+i,"h":102+i,"l":99+i,"c":101+i,"v":10+i} for i in range(1)]
    history.extend({"t":monday+timedelta(minutes=5*i),"o":110+i,"h":112+i,"l":109+i,"c":111+i,"v":20+i} for i in range(11))
    request=PredictRequest(symbol="RELIANCE",horizon=5,candles=history)
    assert request.candles[0].t.date()<request.candles[-1].t.date()

def test_auth_and_predict_contract():
    from app.config import settings
    old=settings.ml_api_key;settings.ml_api_key="test-secret"
    try:
        app=create_app()
        with TestClient(app) as client:
            body={"symbol":"RELIANCE","horizon":5,"candles":candles()}
            payload=jsonable_encoder(body)
            assert client.post("/predict",json=payload).status_code==401
            assert client.post("/predict",json=payload,headers={"X-API-Key":"wrong"}).status_code==401
            response=client.post("/predict",json=payload,headers={"X-API-Key":"test-secret"})
            assert response.status_code==200,response.text
            assert set(response.json())=={"direction","probability","confidence","model","horizon","forecast_close","latency_ms"}
            assert response.json()["model"]=="kronos"
            assert client.post("/predict",json={**payload,"horizon":99},headers={"X-API-Key":"test-secret"}).status_code==422
    finally:settings.ml_api_key=old

def test_health_contract_and_model_unavailable_503():
    app=create_app()
    from app.config import settings
    old=(settings.ml_api_key,settings.model_mock);settings.ml_api_key="test-secret";settings.model_mock=False
    try:
        with TestClient(app) as client:
            health=client.get("/health").json()
            assert health=={"status":"degraded","models":{"kronos":False,"lpatchtst":False},"device":"cpu"}
            response=client.post("/predict",json=jsonable_encoder({"symbol":"RELIANCE","horizon":5,"candles":candles()}),headers={"X-API-Key":"test-secret"})
            assert response.status_code==503 and "unavailable" in response.json()["detail"]
    finally:settings.ml_api_key,settings.model_mock=old
