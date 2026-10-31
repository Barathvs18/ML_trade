import json
from pathlib import Path

DATA = Path(__file__).parents[1] / "app" / "data" / "nifty50.json"

def test_nifty50_has_50_unique_entries():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    assert len(data) == 50
    assert len({item["symbol"] for item in data}) == 50
    assert all(item.get("instrument_key") for item in data)
