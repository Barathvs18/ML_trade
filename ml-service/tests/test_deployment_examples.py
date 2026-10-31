import json
from pathlib import Path

from app.schemas import PredictRequest

EXAMPLES = Path(__file__).resolve().parents[1] / "examples"


def test_documented_example_requests_validate():
    five = json.loads((EXAMPLES / "predict_5m.json").read_text(encoding="utf-8"))
    ten = json.loads((EXAMPLES / "predict_10m.json").read_text(encoding="utf-8"))
    thirty = json.loads((EXAMPLES / "predict_30m.json").read_text(encoding="utf-8"))
    assert PredictRequest.model_validate(five).horizon == 5
    assert PredictRequest.model_validate(ten).horizon == 10
    assert PredictRequest.model_validate(thirty).horizon == 30
