# AlgoPredict ML Service

FastAPI service for Nifty 50 paper-trading forecasts. The backend contract is `POST /predict` with `X-API-Key`; unauthenticated `GET /health` reports model readiness. Run one Uvicorn worker because the inference semaphore and TTL cache are in memory.

## Local setup

Use Python 3.11 and install the CPU PyTorch wheel before the remaining packages:

```powershell
cd ml-service
py -3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Set `ML_API_KEY` to the same value configured for the backend. For offline development, set `MODEL_MOCK=true` and run:

```powershell
$env:ML_API_KEY = "local-dev-key"
$env:MODEL_MOCK = "true"
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Run the test suite with `.venv\Scripts\python.exe -m pytest -q`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `ML_API_KEY` | empty | Required secret shared with the backend; never logged or returned. |
| `DEVICE` | `cpu` | Deployment device. Kronos is explicitly loaded on CPU. |
| `KRONOS_MODEL` | `NeoQuasar/Kronos-small` | Hugging Face model ID (`small`, `base`, or `mini`). |
| `KRONOS_TOKENIZER` | `NeoQuasar/Kronos-Tokenizer-base` | Matching tokenizer ID; mini requires `NeoQuasar/Kronos-Tokenizer-2k`. |
| `KRONOS_SAMPLES` | `5` | Independent sampled forecasts used for direction probability. |
| `HF_TOKEN` | empty | Optional Hugging Face access token. |
| `MODEL_CACHE_DIR` | `.model-cache` | Downloaded model cache; ignored by Git. |
| `MAX_CONCURRENCY` | `1` | Maximum concurrent model inference jobs. |
| `SIDEWAYS_THRESHOLD_PCT` | `0.05` | Direction threshold in percentage points; keep equal to the backend. |
| `MODEL_MOCK` | `true` | Deterministic, offline mock mode. Set `false` to load real Kronos weights. |

For real Kronos forecasts, set `MODEL_MOCK=false`. Startup downloads the selected model and tokenizer once to `MODEL_CACHE_DIR`; without network or usable weights the process still starts, `/health` reports that Kronos is unavailable, and prediction requests return 503. The default small model uses a 512-bar context; mini uses 2048 and requires its matching tokenizer. Requests contain at most 200 candles, and inference truncates to the loaded model's context if that is smaller.

## Forecast behavior

- Horizon 5 uses Kronos on 5-minute candles with a one-bar forecast. Horizon 10 uses the same candles and forecasts two bars ahead, returning the second bar's close. Horizon 30 uses Kronos on 30-minute candles and forecasts one bar ahead.
- The backend's 30-minute candle builder anchors bars at 09:15 IST, yielding starts at 09:15, 09:45, …, 15:15 (13 bar starts). Input timestamps must follow this grid and be exactly spaced within a session. Overnight input gaps are accepted from the backend's final bar start (15:25 for 5m, 15:15 for 30m) to 09:15 on a later date.
- Future timestamps roll past the session close to 09:15 on the next weekday, skipping weekends. There is no NSE holiday calendar in this service, so a weekday holiday immediately after a close can still be selected as a forecast timestamp.
- Kronos returns the mean of paths when `sample_count > 1`. This service therefore makes `KRONOS_SAMPLES` separate calls with `sample_count=1`, uses the mean close as `forecast_close`, and computes probability as the share of sampled paths matching the final direction.
- LPatchTST was evaluated and rejected: the advertised fine-tuned checkpoint is missing from its repo revision; the available checkpoint expects 23 input features while the builder produces 20; no fitted scaler statistics are published; and its scalar target is based on an up-to-96-bar oracle outcome rather than a one-bar forecast. Horizon 30 therefore uses Kronos with the same sampled-path probability calculation as the other horizons.
- Threshold comparison is strict: absolute expected return below `SIDEWAYS_THRESHOLD_PCT` is `SIDEWAYS`; a return exactly on the threshold is `UP` or `DOWN`.

## Vendored Kronos source

The required model implementation is vendored under the upstream MIT license in `app/vendor/kronos/`. It is based on `shiyu-coder/Kronos` commit `67b630e67f6a18c9e9be918d9b4337c960db1e9a`; see `app/vendor/kronos/SOURCE.md`. Model weights are downloaded at runtime and are not part of the repository.
