"""Build the Nifty 50 instrument list using official constituent/instrument sources.

The Upstox BOD instruments JSON is public. The constituent symbols are sourced
from NSE Indices' public Nifty 50 page and must be checked after index reviews.
"""
from __future__ import annotations

import gzip
import csv
import io
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "app" / "data" / "nifty50.json"
UPSTOX_URL = "https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz"
CONSTITUENTS_URL = "https://www.niftyindices.com/IndexConstituent/ind_nifty50list.csv"


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "AlgoPredict educational backend"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def main() -> None:
    constituent_rows = download(CONSTITUENTS_URL).decode("utf-8-sig")
    symbols = {}
    for row in csv.DictReader(io.StringIO(constituent_rows)):
        symbols[row["Symbol"].strip().upper()] = row["Company Name"].strip()
    raw = download(UPSTOX_URL)
    instruments = json.loads(gzip.decompress(raw))
    by_symbol = {item.get("trading_symbol", "").upper(): item for item in instruments
                 if item.get("segment") == "NSE_EQ" and item.get("instrument_type") == "EQ"}
    missing = sorted(set(symbols) - by_symbol.keys())
    if missing:
        raise SystemExit(f"Upstox instruments missing current constituents: {', '.join(missing)}")
    result = [{"symbol": symbol, "name": symbols[symbol],
               "instrument_key": by_symbol[symbol]["instrument_key"]}
              for symbol in sorted(symbols)]
    if len(result) != 50:
        raise SystemExit(f"Expected 50 constituents, got {len(result)}")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
