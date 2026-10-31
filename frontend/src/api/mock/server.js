import { generateSampleCandles } from "../../lib/sampleData";
import { MOCK_STOCKS } from "./stocks";
import { getMockPositions, getMockPredictions, getMockPrice, getMockTrades, getMockUser, getMockWallet, logoutMockUser, requireMockUser, resetMockAccount, setMockWallet } from "./state";

const getStocks = (query = "") => {
  const normalized = String(query).trim().toLowerCase();
  return MOCK_STOCKS.filter((stock) => !normalized || stock.symbol.toLowerCase().includes(normalized) || stock.name.toLowerCase().includes(normalized));
};

function istParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function nextOpen(now = new Date()) {
  const parts = istParts(now);
  const weekdays = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  let delta = 0;
  const minuteOfDay = Number(parts.hour) * 60 + Number(parts.minute);
  if (weekdays[parts.weekday] === 6) delta = 2;
  else if (weekdays[parts.weekday] === 7) delta = 1;
  else if (minuteOfDay >= 15 * 60 + 30) delta = weekdays[parts.weekday] === 5 ? 3 : 1;
  const base = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00+05:30`);
  base.setUTCDate(base.getUTCDate() + delta);
  const date = istParts(base);
  return `${date.year}-${date.month}-${date.day}T09:15:00+05:30`;
}

function marketStatus() {
  const parts = istParts();
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(parts.weekday);
  const minuteOfDay = Number(parts.hour) * 60 + Number(parts.minute);
  const marketOpen = weekday && minuteOfDay >= 9 * 60 + 15 && minuteOfDay < 15 * 60 + 30;
  return { market_open: marketOpen, next_market_open: marketOpen ? null : nextOpen(), upstox_token_ok: false };
}

function getCandles(symbol, interval, limit) {
  const minutes = { "5m": 5, "10m": 10, "30m": 30, "1d": 390 }[interval] ?? 5;
  const base = getMockPrice(symbol).ltp;
  return generateSampleCandles({ count: Math.max(1, Math.min(Number(limit) || 100, 200)), seed: [...symbol].reduce((acc, char) => acc + char.charCodeAt(0), 31) + minutes, startPrice: base * 0.997, intervalMinutes: minutes }).map((candle) => ({
    symbol,
    interval,
    start: candle.t,
    o: candle.o,
    h: candle.h,
    l: candle.l,
    c: candle.c,
    v: candle.v,
  }));
}

function resolvedStats() {
  const resolved = getMockPredictions().filter((prediction) => prediction.status === "resolved");
  return Object.fromEntries([5, 10, 30].map((horizon) => {
    const rows = resolved.filter((prediction) => prediction.horizon === horizon);
    const count = rows.length;
    const correct = rows.filter((prediction) => prediction.correct).length;
    const baseline = rows.filter((prediction) => prediction.baseline_correct).length;
    return [String(horizon), { count, accuracy: count ? correct / count : 0, baseline_accuracy: count ? baseline / count : 0, beats_baseline: correct > baseline }];
  }));
}

function dashboardSummary() {
  requireMockUser();
  const positions = getMockPositions();
  const wallet = getMockWallet();
  const unrealized = positions.reduce((sum, position) => {
    const price = getMockPrice(position.symbol).ltp;
    return sum + (position.side === "LONG" ? price - position.avg_price : position.avg_price - price) * position.qty;
  }, 0);
  return {
    user: getMockUser(),
    wallet_balance: wallet.balance,
    equity: wallet.balance + unrealized,
    total_pnl: wallet.realized_pnl + unrealized,
    win_rate: 0,
    trade_count: getMockTrades().length,
    open_positions_count: positions.length,
    last_predictions: [...getMockPredictions()].slice(-5).reverse(),
    last_trades: [...getMockTrades()].slice(-5).reverse(),
    market: marketStatus(),
  };
}

function equityCurve(range = "1d") {
  requireMockUser();
  const count = range === "1w" ? 35 : range === "1m" ? 90 : 24;
  const step = range === "1w" ? 20 * 60 * 1000 : range === "1m" ? 4 * 60 * 60 * 1000 : 5 * 60 * 1000;
  return Array.from({ length: count }, (_, index) => {
    const ts = new Date(Date.now() - (count - index - 1) * step).toISOString();
    const drift = Math.sin(index / 4.3) * 38 + Math.sin(index / 12) * 20;
    return { ts, equity: 100000 + drift, realized_pnl: 0, unrealized_pnl: 0 };
  });
}

function paperPnl() {
  requireMockUser();
  const unrealized = getMockPositions().reduce((sum, position) => {
    const price = getMockPrice(position.symbol).ltp;
    return sum + (position.side === "LONG" ? price - position.avg_price : position.avg_price - price) * position.qty;
  }, 0);
  const realizedRows = getMockTrades().filter((trade) => Number(trade.realized_pnl));
  const values = realizedRows.map((trade) => trade.realized_pnl);
  return { realized: getMockWallet().realized_pnl, unrealized, total: getMockWallet().realized_pnl + unrealized, win_rate: values.length ? values.filter((value) => value > 0).length / values.length : 0, best_trade: values.length ? Math.max(...values) : null, worst_trade: values.length ? Math.min(...values) : null };
}

function createPrediction(payload = {}) {
  requireMockUser();
  const { symbol, horizon } = payload;
  if (!getStocks().some((stock) => stock.symbol === String(symbol).toUpperCase()) || ![5, 10, 30].includes(Number(horizon))) throw new Error("Choose a valid Nifty 50 symbol and horizon.");
  const tick = getMockPrice(symbol);
  const prediction = {
    _id: `mock-pred-${Date.now()}`,
    user_id: "mock-user",
    symbol: String(symbol).toUpperCase(),
    horizon: Number(horizon),
    model: "kronos",
    made_at: new Date().toISOString(),
    entry_price: tick.ltp,
    direction: "SIDEWAYS",
    probability: 0.46,
    confidence: "medium",
    forecast_close: tick.ltp,
    resolve_at: new Date(Date.now() + Number(horizon) * 60_000).toISOString(),
    status: "pending",
    disclaimer: "Educational only, not financial advice",
  };
  getMockPredictions().unshift(prediction);
  return prediction;
}

function createPaperOrder(payload = {}) {
  requireMockUser();
  const symbol = String(payload.symbol || "").toUpperCase();
  const side = String(payload.side || "").toUpperCase();
  const qty = Number(payload.qty);
  if (!getStocks().some((stock) => stock.symbol === symbol) || !["BUY", "SELL"].includes(side) || qty < 1) throw new Error("Invalid mock paper order.");
  const price = getMockPrice(symbol).ltp;
  const positionSide = side === "BUY" ? "LONG" : "SHORT";
  const position = getMockPositions().find((item) => item.symbol === symbol);
  if (!position) getMockPositions().push({ user_id: "mock-user", symbol, side: positionSide, qty, avg_price: price, opened_at: new Date().toISOString(), stop_loss: payload.stop_loss ?? null, target: payload.target ?? null, prediction_id: payload.prediction_id ?? null });
  const trade = { _id: `mock-trade-${Date.now()}`, user_id: "mock-user", symbol, side, qty, price, ts: new Date().toISOString(), realized_pnl: 0, reason: "mock_order", prediction_id: payload.prediction_id ?? null, charges: { total: 0 } };
  getMockTrades().unshift(trade);
  const wallet = getMockWallet();
  setMockWallet({ ...wallet, balance: wallet.balance - qty * price, blocked_margin: wallet.blocked_margin + qty * price });
  return { ok: true, trade, position: getMockPositions().find((item) => item.symbol === symbol) };
}

function getPath(url) {
  const parsed = new URL(url, "http://mock.local");
  return { path: parsed.pathname.replace(/\/$/, "") || "/", search: Object.fromEntries(parsed.searchParams.entries()) };
}

/** @returns {Promise<unknown>} In-memory endpoint response for explicit mock mode only. */
export async function mockRequest(method, url, bodyOrParams) {
  const { path, search } = getPath(url);
  const body = bodyOrParams && !bodyOrParams.params ? bodyOrParams : {};
  const params = bodyOrParams?.params ?? bodyOrParams ?? search;
  if (method === "GET" && path === "/auth/me") {
    if (!getMockUser()) throw Object.assign(new Error("Not signed in"), { response: { status: 401 } });
    return getMockUser();
  }
  if (method === "POST" && path === "/auth/logout") { logoutMockUser(); return null; }
  if (method === "GET" && path === "/market/status") return marketStatus();
  if (method === "GET" && path === "/market/stocks") return getStocks(params.q);
  const quoteMatch = path.match(/^\/market\/quote\/([^/]+)$/);
  if (method === "GET" && quoteMatch) return { symbol: quoteMatch[1].toUpperCase(), ...getMockPrice(quoteMatch[1]), market_open: marketStatus().market_open };
  const candlesMatch = path.match(/^\/market\/candles\/([^/]+)$/);
  if (method === "GET" && candlesMatch) return getCandles(candlesMatch[1].toUpperCase(), params.interval || "5m", params.limit || 100);
  if (method === "GET" && path === "/dashboard/summary") return dashboardSummary();
  if (method === "GET" && path === "/dashboard/equity-curve") return equityCurve(params.range || "1d");
  if (method === "GET" && path === "/predictions/stats") { requireMockUser(); return resolvedStats(); }
  if (method === "GET" && path === "/predictions") {
    requireMockUser();
    return getMockPredictions().filter((row) => (!params.symbol || row.symbol === String(params.symbol).toUpperCase()) && (!params.horizon || row.horizon === Number(params.horizon)) && (!params.status || row.status === params.status)).slice(0, Number(params.limit) || 50);
  }
  if (method === "POST" && path === "/predictions") return createPrediction(body);
  if (method === "GET" && path === "/paper/wallet") { requireMockUser(); return getMockWallet(); }
  if (method === "GET" && path === "/paper/positions") { requireMockUser(); return { positions: getMockPositions(), unrealized_total: paperPnl().unrealized }; }
  if (method === "GET" && path === "/paper/trades") { requireMockUser(); return [...getMockTrades()].slice(0, Number(params.limit) || 50); }
  if (method === "GET" && path === "/paper/pnl") return paperPnl();
  if (method === "POST" && path === "/paper/orders") return createPaperOrder(body);
  const closeMatch = path.match(/^\/paper\/positions\/([^/]+)\/close$/);
  if (method === "POST" && closeMatch) {
    requireMockUser();
    const symbol = closeMatch[1].toUpperCase();
    const index = getMockPositions().findIndex((position) => position.symbol === symbol);
    if (index < 0) throw new Error("No open mock position for this symbol.");
    const position = getMockPositions().splice(index, 1)[0];
    const price = getMockPrice(symbol).ltp;
    const pnl = (position.side === "LONG" ? price - position.avg_price : position.avg_price - price) * position.qty;
    getMockTrades().unshift({ _id: `mock-trade-${Date.now()}`, user_id: "mock-user", symbol, side: position.side === "LONG" ? "SELL" : "BUY", qty: position.qty, price, ts: new Date().toISOString(), realized_pnl: pnl, reason: "manual", charges: { total: 0 } });
    const wallet = getMockWallet();
    setMockWallet({ ...wallet, balance: wallet.balance + position.qty * position.avg_price + pnl, blocked_margin: Math.max(0, wallet.blocked_margin - position.qty * position.avg_price), realized_pnl: wallet.realized_pnl + pnl });
    return { ok: true, realized_pnl: pnl };
  }
  if (method === "POST" && path === "/paper/reset") { requireMockUser(); resetMockAccount(); return { ok: true, reset_id: `mock-reset-${Date.now()}`, archived_trades: 0 }; }
  const error = new Error(`Mock endpoint not implemented: ${method} ${path}`);
  error.response = { status: 404, data: { error: { code: "not_found", message: error.message } } };
  throw error;
}
