# AlgoPredict

Educational Nifty 50 price prediction and paper-trading platform. Orders use virtual funds only; the backend never places real trades. Frontend and ML service are separate project components.

## Local development

1. Install Docker Desktop and Python 3.11.
2. Copy `.env.example` to `.env`; replace the JWT secret and set Google/Upstox credentials when using those integrations.
3. Start backend and replica-set MongoDB: `docker compose up --build`.
4. API: `http://localhost:8000`; OpenAPI docs: `/docs`; health: `/health`.

For running the Python backend directly, activate `backend/.venv`, install `backend/requirements.txt`, set `MONGO_URI=mongodb://localhost:27017/?replicaSet=rs0`, then from `backend/` run `uvicorn app.main:app --host 0.0.0.0 --port 8000`. Set `FEED_MODE=replay`, `ML_MOCK=true`, and `ENVIRONMENT=development` for offline development.

## Environment variables

| Variable | Purpose |
|---|---|
| `MONGO_URI`, `DB_NAME`, `MONGO_PORT` | Replica-set MongoDB connection, database, and host-mapped Compose port (default `27018`) |
| `JWT_SECRET`, `JWT_EXPIRE_MINUTES` | Signed session cookie configuration |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google OAuth credentials and callback |
| `FRONTEND_URL` | CORS origin and post-login redirect |
| `UPSTOX_API_KEY`, `UPSTOX_API_SECRET`, `UPSTOX_REDIRECT_URI`, `ADMIN_EMAILS` | Server-owned Upstox OAuth and admin access |
| `ML_SERVICE_URL`, `ML_API_KEY`, `ML_MOCK` | ML service configuration and development mock toggle |
| `FEED_MODE` | `live` or offline synthetic `replay` feed |
| `SIDEWAYS_THRESHOLD_PCT`, `STARTING_BALANCE`, `SQUAREOFF_TIME` | Prediction and paper-account settings |
| `COOKIE_SECURE`, `COOKIE_SAMESITE` | Browser cookie flags; use secure HTTPS settings in production |
| `ENVIRONMENT`, `SMOKE_TEST_MODE`, `REPLAY_FORCE_MARKET_OPEN` | Production ignores replay forcing. Market hours are only forced for a replay feed when both smoke mode and the explicit replay-force flag are true, and only outside production. Replay mode by itself never opens the market. |

## Upstox authorization

Sign in through Google with an email listed in `ADMIN_EMAILS`, then open `GET /admin/upstox/login` and complete Upstox OAuth. The callback stores the token server-side; users never receive it. Upstox access tokens expire daily, so an administrator must authorize again each trading day when required. Market history and Feed V3 use the server token. Verify the instrument keys in `backend/app/data/nifty50.json` against the current Upstox instrument file after index reviews.

## Tests

From `backend/`, run `.venv\\Scripts\\python.exe -m pytest` on Windows (or `.venv/bin/python -m pytest` on Unix). The unit suite has no network dependency. Integration tests are marked `integration` and skipped unless `TEST_MONGO_URI` points to a replica-set MongoDB; run them with `python -m pytest -m integration` after starting Compose and setting `TEST_MONGO_URI=mongodb://localhost:27018/?replicaSet=rs0&directConnection=true` on Windows host (the direct connection avoids discovering the Compose-only hostname).

The repeatable HTTP/WebSocket smoke check is `backend/scripts/smoke_test.py`. It uses a generated test JWT and a seeded local Mongo user, not an authentication bypass. Copy `.env.example` to `.env`, set `ENVIRONMENT=development`, `FEED_MODE=replay`, `ML_MOCK=true`, `SMOKE_TEST_MODE=true`, and `REPLAY_FORCE_MARKET_OPEN=true`, run `docker compose up --build -d`, then run `backend/.venv/Scripts/python.exe backend/scripts/smoke_test.py` from the project root. Set both smoke flags to `false` after the check. Replay mode alone never changes market hours. **Never enable either override in production**; production ignores replay forcing regardless of flag values.

## Docker Compose and Mongo transactions

Compose starts MongoDB as a single-node replica set (`rs0`) so transaction integration tests can exercise transaction rollback. Mongo maps to host port `27018` by default to avoid clashing with an existing local MongoDB; override with `MONGO_PORT`. The volume persists local data. Set `MONGO_URI` with `replicaSet=rs0` for backend and test clients.

## Render deployment

Build from `backend/` using the provided Dockerfile. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set a managed MongoDB Atlas replica-set URI, strong JWT secret, OAuth credentials and redirect URIs, `COOKIE_SECURE=true`, and `COOKIE_SAMESITE=none`. Deploy a single Uvicorn worker because the feed and caches are in process. Do not set `SMOKE_TEST_MODE=true` or `REPLAY_FORCE_MARKET_OPEN=true` in production. `FEED_MODE=replay` only selects the synthetic feed; it does not alter the NSE calendar or market clock.

## Market calendar

`backend/app/data/holidays.json` drives Indian market-day checks. **Verify against the NSE holiday calendar** at the start of each year; dates may change.

## Paper position reversal policy

Paper orders cannot implicitly reverse a position. An opposite-side order larger than the open quantity is rejected; close the existing position first, then open the reverse side in a separate order.

## Frontend

_Frontend implementation is maintained separately._

## ML service

The ML service is deployed separately as a Hugging Face Space. Create a Space with the **Docker** SDK and choose public or private visibility. In Space **Settings → Variables and secrets**, add `ML_API_KEY` as a required secret and `HF_TOKEN` only if Hugging Face Hub access is needed. Never store these secrets in Git.

The Docker image and Space README metadata are in `ml-service/`. From Windows, use a separate clone of the Space repo and copy only the service payload before pushing:

```powershell
hf auth login
$hfUser = "YOUR_HF_USERNAME"
$spaceName = "algopredict-ml"
$source = (Resolve-Path .\ml-service).Path
$spacePath = Join-Path $env:TEMP "algopredict-ml-space"
git clone "https://huggingface.co/spaces/$hfUser/$spaceName" $spacePath
robocopy "$source\app" "$spacePath\app" /E /XD __pycache__
robocopy "$source\examples" "$spacePath\examples" /E
Copy-Item "$source\Dockerfile","$source\.dockerignore","$source\.gitignore","$source\requirements-docker.txt","$source\README.md" $spacePath -Force
Set-Location $spacePath
git add -A
git commit -m "Deploy AlgoPredict ML service"
git push origin main
```

`hf auth login` stores a Hugging Face write token in the local credential helper; do not put it in the remote URL or commit it. For the curl checks, use the Space URL `https://<HF_USERNAME>-<SPACE_NAME>.hf.space`, send `X-API-Key` for `/predict`, and expect 401 without it. The ready-made request bodies are in `ml-service/examples/predict_5m.json`, `predict_10m.json`, and `predict_30m.json`; detailed curl commands, local image build instructions, and expected startup/sleep behavior are in [ml-service/README.md](ml-service/README.md).

```powershell
$baseUrl = "https://YOUR_HF_USERNAME-algopredict-ml.hf.space"
curl.exe -sS "$baseUrl/health"
curl.exe -sS -X POST "$baseUrl/predict" -H "Content-Type: application/json" -H "X-API-Key: $env:ML_API_KEY" --data-binary "@ml-service/examples/predict_5m.json"
```

The local image reached `/health` in 17.3 seconds and completed its first prediction 27.6 seconds after container start. Hugging Face free hardware sleeps after inactivity, so wake-up adds variable latency; check the linked ML service README for deployment details.
