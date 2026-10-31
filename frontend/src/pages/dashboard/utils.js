export function formatMoney(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value));
}

export function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

export function istDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatIstDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

export function todayPnl(trades = [], positions = [], now = new Date()) {
  const today = istDateKey(now);
  if (trades.length >= 200) return null;
  const realized = trades.filter((trade) => istDateKey(trade.ts ?? trade.made_at) === today).reduce((total, trade) => total + Number(trade.realized_pnl || 0), 0);
  const unrealized = positions.filter((position) => istDateKey(position.opened_at) === today).reduce((total, position) => total + Number(position.unrealized_pnl || 0), 0);
  return realized + unrealized;
}

export function candlesForChart(rows = []) {
  return rows.map((row) => ({
    time: row.time ?? row.t ?? row.start,
    open: Number(row.open ?? row.o),
    high: Number(row.high ?? row.h),
    low: Number(row.low ?? row.l),
    close: Number(row.close ?? row.c),
    volume: Number(row.volume ?? row.v ?? 0),
  })).filter((row) => row.time && [row.open, row.high, row.low, row.close].every(Number.isFinite));
}

export function dayChangeFromCandles(candles = []) {
  if (!candles.length) return null;
  const last = candles.at(-1);
  const key = istDateKey(typeof last.time === "number" ? last.time * 1000 : last.time);
  const session = candles.filter((candle) => istDateKey(typeof candle.time === "number" ? candle.time * 1000 : candle.time) === key);
  const open = Number(session[0]?.open);
  const close = Number(last.close);
  return open > 0 ? ((close - open) / open) * 100 : null;
}
