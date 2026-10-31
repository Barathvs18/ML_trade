from datetime import datetime, timezone

class PriceCache:
    def __init__(self): self._prices: dict[str, dict] = {}
    def update(self, symbol: str, ltp: float, volume: float = 0, ts: datetime | None = None) -> dict:
        row = {"ltp": float(ltp), "volume": float(volume), "ts": ts or datetime.now(timezone.utc)}
        self._prices[symbol] = row
        return row
    def get(self, symbol: str) -> dict | None: return self._prices.get(symbol)
    def all(self) -> dict[str, dict]: return self._prices.copy()

price_cache = PriceCache()
