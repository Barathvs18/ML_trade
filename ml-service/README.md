# AlgoPredict ML Service

FastAPI service for Nifty 50 direction forecasts. Contract is `POST /predict` with `X-API-Key`; unauthenticated `GET /health` reports per-model readiness. Use one Uvicorn worker because inference concurrency and TTL cache are in memory.

Set `MODEL_MOCK=true` for deterministic offline contract development. The mock is not a trading signal. LPatchTST currently reports probability `0.5` as a neutral fallback because its single forecast is not a sampled path distribution.

Run from this folder with `.venv\\Scripts\\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8001` and `.venv\\Scripts\\python.exe -m pytest`.
