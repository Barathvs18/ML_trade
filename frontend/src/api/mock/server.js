import { generateSampleCandles } from "../../lib/sampleData";
import { MOCK_STOCKS } from "./stocks";
import { getMockPositions, getMockPredictions, getMockPrice, getMockTrades, getMockUser, getMockWallet, logoutMockUser, requireMockUser, resetMockAccount, setMockWallet } from "./state";

let mockPredictionSequence = 0;
const MOCK_RESOLUTION_SECONDS = 12;

const getStocks = (query = "") => {
  const normalized = String(query).trim().toLowerCase();
  return MOCK_STOCKS.filter((stock) => !normalized || stock.symbol.toLowerCase().includes(normalized) || stock.name.toLowerCase().includes(normalized));
};

function marketStatus() {
  return { market_open: true, next_market_open: null, upstox_token_ok: false, mock_market: true };
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
  getMockPredictions().forEach(resolveMockPrediction);
  const resolved = getMockPredictions().filter((prediction) => prediction.status === "resolved");
  return Object.fromEntries([5, 10, 30].map((horizon) => {
    const rows = resolved.filter((prediction) => prediction.horizon === horizon);
    const count = rows.length;
    const correct = rows.filter((prediction) => prediction.correct).length;
    const baseline = rows.filter((prediction) => prediction.baseline_correct).length;
    return [String(horizon), { count, accuracy: count ? correct / count : 0, baseline_accuracy: count ? baseline / count : 0, beats_baseline: correct > baseline }];
  }));
}

function resolveMockPrediction(prediction) {
  if (prediction.status !== "pending" || Date.now() < new Date(prediction.resolve_at).getTime()) return prediction;
  const tick = getMockPrice(prediction.symbol);
  const actualReturn = (tick.ltp - prediction.entry_price) / prediction.entry_price * 100;
  const actualDirection = Math.abs(actualReturn) < 0.05 ? "SIDEWAYS" : actualReturn > 0 ? "UP" : "DOWN";
  Object.assign(prediction, {
    status: "resolved",
    actual_direction: actualDirection,
    actual_return_pct: actualReturn,
    correct: prediction.direction === actualDirection,
    baseline_correct: actualDirection === "SIDEWAYS",
    resolved_at: new Date().toISOString(),
  });
  return prediction;
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
  const normalizedSymbol = String(symbol).toUpperCase();
  const tick = getMockPrice(normalizedSymbol);
  const directions = ["UP", "DOWN", "SIDEWAYS"];
  const direction = directions[mockPredictionSequence++ % directions.length];
  const probability = 0.58;
  const probabilities = direction === "UP"
    ? { UP: probability, DOWN: 0.27, SIDEWAYS: 0.15 }
    : direction === "DOWN"
      ? { UP: 0.27, DOWN: probability, SIDEWAYS: 0.15 }
      : { UP: 0.27, DOWN: 0.15, SIDEWAYS: probability };
  const forecastMove = direction === "UP" ? 0.0015 : direction === "DOWN" ? -0.0015 : 0;
  const madeAt = Date.now();
  const prediction = {
    _id: `mock-pred-${madeAt}-${mockPredictionSequence}`,
    user_id: "mock-user",
    symbol: normalizedSymbol,
    horizon: Number(horizon),
    model: "kronos",
    made_at: new Date(madeAt).toISOString(),
    entry_price: tick.ltp,
    direction,
    probability,
    probabilities,
    confidence: "medium",
    forecast_close: tick.ltp * (1 + forecastMove),
    resolve_at: new Date(madeAt + MOCK_RESOLUTION_SECONDS * 1000).toISOString(),
    status: "pending",
    disclaimer: "Educational only, not financial advice",
    mock_accelerated: true,
  };
  getMockPredictions().unshift(prediction);
  return prediction;
}

function createPaperOrder(payload = {}) {
  requireMockUser();
  const symbol = String(payload.symbol || "").toUpperCase();
  const side = String(payload.side || "").toUpperCase();
  const qty = Number(payload.qty);
  const fail = (status, code, message) => {
    const error = new Error(message);
    error.response = { status, data: { error: { code, message }, detail: { error: { code, message } } } };
    throw error;
  };
  if (!getStocks().some((stock) => stock.symbol === symbol) || !["BUY", "SELL"].includes(side) || !Number.isInteger(qty) || qty < 1) fail(422, "invalid_order", "Choose a valid stock, side, and whole-number quantity.");
  const ltp = getMockPrice(symbol).ltp;
  const price = ltp * (side === "BUY" ? 1.0002 : 0.9998);
  const positionSide = side === "BUY" ? "LONG" : "SHORT";
  const stop = payload.stop_loss == null || payload.stop_loss === "" ? null : Number(payload.stop_loss);
  const target = payload.target == null || payload.target === "" ? null : Number(payload.target);
  if (stop !== null && (positionSide === "LONG" ? stop >= price : stop <= price)) fail(422, "invalid_stop_loss", `${positionSide === "LONG" ? "Long" : "Short"} stop-loss is on the wrong side of entry.`);
  if (target !== null && (positionSide === "LONG" ? target <= price : target >= price)) fail(422, "invalid_target", `${positionSide === "LONG" ? "Long" : "Short"} target is on the wrong side of entry.`);
  const turnover = qty * price;
  const charges = {
    brokerage: Math.min(20, turnover * 0.0003),
    stt: side === "SELL" ? turnover * 0.00025 : 0,
    exchange: turnover * 0.0000325,
    sebi: turnover * 0.000001,
    stamp_duty: side === "BUY" ? turnover * 0.00003 : 0,
  };
  charges.gst = (charges.brokerage + charges.exchange) * 0.18;
  charges.total = Object.values(charges).reduce((sum, value) => sum + value, 0);
  const wallet = getMockWallet();
  if (wallet.balance < turnover + charges.total) fail(400, "insufficient_balance", "Insufficient virtual balance for estimated margin and charges.");
  const position = getMockPositions().find((item) => item.symbol === symbol);
  if (position && position.side !== positionSide) fail(422, "position_conflict", "Close the existing mock position before changing sides.");
  if (!position) getMockPositions().push({ user_id: "mock-user", symbol, side: positionSide, qty, avg_price: price, opened_at: new Date().toISOString(), stop_loss: stop, target, prediction_id: payload.prediction_id ?? null });
  else {
    const totalQty = position.qty + qty;
    position.avg_price = (position.avg_price * position.qty + price * qty) / totalQty;
    position.qty = totalQty;
    position.stop_loss = stop ?? position.stop_loss;
    position.target = target ?? position.target;
  }
  const trade = { _id: `mock-trade-${Date.now()}-${getMockTrades().length}`, user_id: "mock-user", symbol, side, qty, price, ts: new Date().toISOString(), realized_pnl: 0, reason: "manual", prediction_id: payload.prediction_id ?? null, charges };
  getMockTrades().unshift(trade);
  setMockWallet({ ...wallet, balance: wallet.balance - turnover - charges.total, blocked_margin: wallet.blocked_margin + turnover });
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
  const predictionMatch = path.match(/^\/predictions\/([^/]+)$/);
  if (method === "GET" && predictionMatch) {
    requireMockUser();
    const prediction = getMockPredictions().find((row) => row._id === decodeURIComponent(predictionMatch[1]));
    if (!prediction) throw Object.assign(new Error("Prediction not found"), { response: { status: 404, data: { error: { code: "not_found", message: "Prediction not found" } } } });
    return resolveMockPrediction(prediction);
  }
  if (method === "GET" && path === "/predictions") {
    requireMockUser();
    getMockPredictions().forEach(resolveMockPrediction);
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
