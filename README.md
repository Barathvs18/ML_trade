## AlgoPredict
Educational Nifty 50 prediction and paper trading platform. All trades use virtual money.

### Backend setup
Copy `.env.example` to `.env`, set Google OAuth credentials and a strong JWT secret, then run `docker compose up --build`. For local development use `ML_MOCK=true` and `FEED_MODE=replay`. The API is served at `http://localhost:8000`; interactive API docs are at `/docs`.

### Environment
See `.env.example` for MongoDB, OAuth, Upstox, ML, feed, cookie, and trading configuration. Never expose server-side API keys to a browser.

### API overview
Google OAuth: `/auth/google/login`, `/auth/me`, `/auth/logout`. Market: `/market/stocks`, `/market/quote/{symbol}`, `/market/candles/{symbol}`, `/market/status`, authenticated `/ws/prices`. Predictions: `/predictions`, `/predictions/stats`. Paper: `/paper/orders`, `/paper/wallet`, `/paper/positions`, `/paper/trades`. Dashboard: `/dashboard/summary`, `/dashboard/equity-curve`.

### Deployment
Build from `backend/` on Render and start with `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Configure a reachable MongoDB URI and HTTPS cookie settings. Use one process/worker for in-memory feed state.

### Documented implementation limitations
Upstox currently documents Market Data Feed V3 as protobuf over WebSocket and historical candle V3 with a unit and interval. The live feed adapter and complete protobuf decoder are not included yet. The supplied instrument list is incomplete; verify instrument keys against the official instruments file before live use. The V2 candle paths are retained as an adapter placeholder and should be migrated to V3. Replay mode is synthetic and is not market data.

### Frontend
_To be added by project owner._

### ML service
_To be added by project owner._
