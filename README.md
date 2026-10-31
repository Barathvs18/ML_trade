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
| `MONGO_URI`, `DB_NAME` | Replica-set MongoDB connection and database |
| `JWT_SECRET`, `JWT_EXPIRE_MINUTES` | Signed session cookie configuration |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google OAuth credentials and callback |
| `FRONTEND_URL` | CORS origin and post-login redirect |
| `UPSTOX_API_KEY`, `UPSTOX_API_SECRET`, `UPSTOX_REDIRECT_URI`, `ADMIN_EMAILS` | Server-owned Upstox OAuth and admin access |
| `ML_SERVICE_URL`, `ML_API_KEY`, `ML_MOCK` | ML service configuration and development mock toggle |
| `FEED_MODE` | `live` or offline synthetic `replay` feed |
| `SIDEWAYS_THRESHOLD_PCT`, `STARTING_BALANCE`, `SQUAREOFF_TIME` | Prediction and paper-account settings |
| `COOKIE_SECURE`, `COOKIE_SAMESITE` | Browser cookie flags; use secure HTTPS settings in production |
| `ENVIRONMENT`, `SMOKE_TEST_MODE` | Runtime environment defaults to production; only explicit development/test replay enables the smoke-only market-hours override |

## Upstox authorization

Sign in through Google with an email listed in `ADMIN_EMAILS`, then open `GET /admin/upstox/login` and complete Upstox OAuth. The callback stores the token server-side; users never receive it. Upstox access tokens expire daily, so an administrator must authorize again each trading day when required. Market history and Feed V3 use the server token. Verify the instrument keys in `backend/app/data/nifty50.json` against the current Upstox instrument file after index reviews.

## Tests

From `backend/`, run `.venv\\Scripts\\python.exe -m pytest` on Windows (or `.venv/bin/python -m pytest` on Unix). The unit suite has no network dependency. Integration tests are marked `integration` and skipped unless `TEST_MONGO_URI` points to a replica-set MongoDB; run them with `python -m pytest -m integration` after starting Compose and setting `TEST_MONGO_URI=mongodb://localhost:27017/?replicaSet=rs0`.

The repeatable HTTP/WebSocket smoke check is `backend/scripts/smoke_test.py`. It uses a generated test JWT and a seeded local Mongo user, not an authentication bypass. Copy `.env.example` to `.env`, set `ENVIRONMENT=development`, `FEED_MODE=replay`, `ML_MOCK=true`, and `SMOKE_TEST_MODE=true`, run `docker compose up --build -d`, then run `backend/.venv/Scripts/python.exe backend/scripts/smoke_test.py` from the project root. Set `SMOKE_TEST_MODE=false` after the check. **Never enable smoke mode in production**; production defaults to `ENVIRONMENT=production`, which disables its market-hours override.

## Docker Compose and Mongo transactions

Compose starts MongoDB as a single-node replica set (`rs0`) so transaction integration tests can exercise transaction rollback. The volume persists local data. Set `MONGO_URI` with `replicaSet=rs0` for backend and test clients.

## Render deployment

Build from `backend/` using the provided Dockerfile. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set a managed MongoDB Atlas replica-set URI, strong JWT secret, OAuth credentials and redirect URIs, `COOKIE_SECURE=true`, and `COOKIE_SAMESITE=none`. Deploy a single Uvicorn worker because the feed and caches are in process. Do not set `SMOKE_TEST_MODE=true` or `ENVIRONMENT` to a non-production value in production.

## Market calendar

`backend/app/data/holidays.json` drives Indian market-day checks. **Verify against the NSE holiday calendar** at the start of each year; dates may change.

## Paper position reversal policy

Paper orders cannot implicitly reverse a position. An opposite-side order larger than the open quantity is rejected; close the existing position first, then open the reverse side in a separate order.

## Frontend

_Frontend implementation is maintained separately._

## ML service

_ML service implementation is maintained separately._
