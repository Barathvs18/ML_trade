import { generateSampleCandles } from "../../lib/sampleData";

let mockUser = null;
const prices = new Map();
const openCandles = new Map();
const trades = [];
const positions = [];
const predictions = [];
let wallet = { user_id: "mock-user", balance: 100000, blocked_margin: 0, realized_pnl: 0, created_at: new Date().toISOString() };

export function getMockUser() { return mockUser; }

export function loginMockUser() {
  mockUser = { id: "mock-user", email: "learner@stockzo.example", name: "Stockzo Learner", picture: null };
  return mockUser;
}

export function logoutMockUser() {
  mockUser = null;
}

export function requireMockUser() {
  if (!mockUser) {
    const error = new Error("Sign in to access this mock endpoint.");
    error.response = { status: 401, data: { error: { code: "unauthorized", message: error.message } } };
    throw error;
  }
  return mockUser;
}

function hashSymbol(symbol) {
  return [...symbol].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 17);
}

export function getMockPrice(symbol) {
  const key = symbol.toUpperCase();
  if (!prices.has(key)) {
    const history = generateSampleCandles({ count: 1, seed: hashSymbol(key), startPrice: 500 + hashSymbol(key) % 4500, intervalMinutes: 5 });
    prices.set(key, { ltp: history.at(-1)?.close ?? 1000, ts: new Date().toISOString(), volume: 100000 + hashSymbol(key) % 800000 });
  }
  return prices.get(key);
}

export function setMockPrice(symbol, tick) {
  prices.set(symbol.toUpperCase(), tick);
}

export function getOpenCandles() { return openCandles; }
export function setOpenCandle(symbol, candle) { openCandles.set(symbol.toUpperCase(), candle); }
export function getMockTrades() { return trades; }
export function getMockPositions() { return positions; }
export function getMockPredictions() { return predictions; }
export function getMockWallet() { return wallet; }
export function setMockWallet(nextWallet) { wallet = nextWallet; }

export function resetMockAccount() {
  trades.length = 0;
  positions.length = 0;
  predictions.length = 0;
  wallet = { user_id: "mock-user", balance: 100000, blocked_margin: 0, realized_pnl: 0, created_at: new Date().toISOString() };
}
