# Stockzo frontend

Stockzo is an educational Nifty 50 exploration and paper-trading interface. The frontend uses React 18, Vite, Tailwind CSS, React Router, TanStack Query, Axios, and TradingView Lightweight Charts.

## Run locally

Requirements: Node.js 20 or newer and npm.

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set `VITE_API_URL` in `.env.local` to the backend origin. The local default is `http://localhost:8000`. Start the backend separately and configure its `FRONTEND_URL` and CORS origin to match the Vite URL (normally `http://localhost:5173`). Google sign-in also requires valid Google OAuth configuration in the backend.

To run the UI without a backend, set `VITE_USE_MOCK=true` in `.env.local` and restart Vite. This enables seeded in-memory market/account endpoints, a one-second mock price/candle feed, and a fake demo account from the login button. The default `false` value uses the real backend and Google OAuth.

```powershell
npm run lint
npm run build
npm run test -- --run
npm run preview
```

`npm run preview` serves the production build locally. The API URL is a public frontend setting, not a secret. Auth uses the backend's httpOnly session cookie; the frontend does not store access tokens.

## Routes

- `/` — Stockzo landing page. Synthetic chart data is labeled “Sample data”; when signed in, market quotes and prediction statistics are fetched from the backend.
- `/login` — Google OAuth handoff.
- `/dashboard` — protected market and paper-account overview with a chart, watchlist, experimental scorecard, equity curve, recent activity, and open-position summary.
- `/prediction`, `/paper-trading` — protected placeholders for the next frontend steps.
- `/privacy-policy`, `/terms-and-conditions`, `/contact` — informational placeholders.

The frontend is educational only, not financial advice. All trading is simulated with virtual money.

## Dashboard checks

The dashboard uses the backend routes for market status, stocks, quotes, candles, prediction stats and history, paper positions/trades, and dashboard summary/equity snapshots. In `VITE_USE_MOCK=true` mode these calls use the in-memory mock API and one-second synthetic price feed, so the dashboard can be previewed without backend credentials. Mock data is labeled in the navbar.

Run the component tests with `npm run test -- --run`. They cover the shared WebSocket hook's reconnect/cleanup, scorecard baseline labels, and dashboard loading, error, empty, and unavailable-summary states.

## Deploy to Vercel

1. Import the project repository in Vercel.
2. Set **Root Directory** to `frontend/` and choose **Vite** as the framework preset.
3. Keep the build command as `npm run build` and output directory as `dist`.
4. Add `VITE_API_URL` as an environment variable for each Vercel environment, pointing to the publicly reachable backend origin (for example `https://api.example.com`, without an API path).
5. Deploy, then set the backend's `FRONTEND_URL` and allowed CORS origin to the deployed frontend URL. In production, the backend session cookie must use `Secure` and `SameSite=None` so credentialed API requests work cross-origin.

`vercel.json` rewrites application routes to `index.html` so direct visits and refreshes on protected pages are served by the client router.
