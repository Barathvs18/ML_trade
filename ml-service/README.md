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
| `KRONOS_SAMPLES` | `10` | Independent sampled forecasts used for direction probability. |
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
- Kronos returns the mean of paths when `sample_count > 1`. This service therefore makes `KRONOS_SAMPLES` separate calls with `sample_count=1`. It classifies every sampled final close against the last observed close and the sideways threshold, returns the three class shares in `probabilities`, chooses the class with the highest share (ties resolve to `SIDEWAYS`), sets `probability` to the highest share, and uses the mean sampled close for `forecast_close`. These shares describe agreement among model samples; they are not calibrated probabilities of real-world outcomes.
- LPatchTST was evaluated and rejected: the advertised fine-tuned checkpoint is missing from its repo revision; the available checkpoint expects 23 input features while the builder produces 20; no fitted scaler statistics are published; and its scalar target is based on an up-to-96-bar oracle outcome rather than a one-bar forecast. Horizon 30 therefore uses Kronos with the same sampled-path probability calculation as the other horizons.
- Threshold comparison is strict: absolute expected return below `SIDEWAYS_THRESHOLD_PCT` is `SIDEWAYS`; a return exactly on the threshold is `UP` or `DOWN`.

## Benchmark and walk-forward evaluation

Run the repeatable real-weight benchmark and the CSV walk-forward evaluator from this directory with `MODEL_MOCK=false`. The benchmark sets PyTorch to two CPU threads to approximate the Hugging Face free-tier CPU allocation. `scripts/benchmark.py` tests sample counts 5, 10, and 20 and writes results to `reports/benchmark.txt`. Ten samples is the default because horizon 10 measured 2.338s p95 here; 20 samples measured 4.500s p95. It reports cold process-to-model-load time and RSS; loading from an already populated Hugging Face cache is not a first-ever download measurement.

`scripts/fetch_yfinance.py` downloads `^NSEI` 5-minute intraday candles to `data/` and resamples those rows into backend-aligned 30-minute bars (09:15 through 15:15 starts). Yahoo Finance generally limits 5-minute history to about 60 days. The evaluator accepts generic CSVs with `t,o,h,l,c,v`, evaluates chronologically using up to the previous 200 rows, predicts the next one bar (horizons 5 and 30) or two bars (horizon 10), and never shuffles or trains on evaluation rows. Sampled forecasts use a fixed evaluation seed for repeatable reports. Results and every prediction are written to `reports/evaluation.md` and `reports/predictions.csv`. The majority-class baseline uses actual evaluation labels and is a hindsight frequency reference, not a deployable strategy. This is a small historical diagnostic, not evidence of profitable trading; use a larger, independently sourced Upstox dataset before drawing conclusions.

```powershell
$env:MODEL_MOCK = "false"
.venv\Scripts\python.exe scripts\fetch_yfinance.py
.venv\Scripts\python.exe scripts\benchmark.py
.venv\Scripts\python.exe scripts\evaluate.py --csv-5m data\nsei_5m.csv --csv-30m data\nsei_30m.csv --max-points 30
```

## Vendored Kronos source

The required model implementation is vendored under the upstream MIT license in `app/vendor/kronos/`. It is based on `shiyu-coder/Kronos` commit `67b630e67f6a18c9e9be918d9b4337c960db1e9a`; see `app/vendor/kronos/SOURCE.md`. Model weights are downloaded at runtime and are not part of the repository.
