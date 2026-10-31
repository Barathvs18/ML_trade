export function mapPredictionError(error, now = Date.now()) {
  const status = error?.response?.status;
  if (status === 409) return "The market closed before this estimate could be created. Check market hours and try again next session.";
  if (status === 429) {
    const headers = error.response?.headers;
    const retryAfter = headers?.get?.("retry-after") ?? headers?.["retry-after"] ?? headers?.["Retry-After"];
    const seconds = Number(retryAfter);
    const wait = Number.isFinite(seconds) && seconds > 0
      ? `${Math.ceil(seconds)} seconds`
      : Number.isFinite(Date.parse(retryAfter))
        ? `${Math.max(1, Math.ceil((Date.parse(retryAfter) - now) / 1000))} seconds`
        : "about one minute";
    return `Too many requests. Try again in ${wait}.`;
  }
  if (status === 503) return "The prediction service is temporarily unavailable. Your paper account is unchanged; try again shortly.";
  if (!error?.response) return "Could not reach Stockzo. Check your connection and try again.";
  const message = error.response?.data?.error?.message ?? error.response?.data?.detail?.error?.message;
  return message || "We couldn't create this model estimate. Please try again.";
}

export function formatCountdown(resolveAt, now = Date.now()) {
  const remainingSeconds = Math.max(0, Math.ceil((new Date(resolveAt).getTime() - now) / 1000));
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Actual outcome fields are withheld until the server marks the prediction resolved. */
export function getPredictionReveal(prediction) {
  if (prediction?.status !== "resolved" || !prediction.actual_direction) return null;
  return {
    actualDirection: prediction.actual_direction,
    actualReturnPct: prediction.actual_return_pct,
    correct: Boolean(prediction.correct),
    baselineCorrect: Boolean(prediction.baseline_correct),
  };
}

export function validateOrderForm({ side, quantity, entryPrice, stopLoss, target }) {
  if (!side || !["BUY", "SELL"].includes(side)) return "Choose BUY (long) or SELL (short).";
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) return "Quantity must be a whole number of at least 1.";
  const entry = Number(entryPrice);
  if (!Number.isFinite(entry) || entry <= 0) return "A current entry price is not available.";
  const stop = stopLoss === "" || stopLoss == null ? null : Number(stopLoss);
  const takeProfit = target === "" || target == null ? null : Number(target);
  if (stop !== null && (!Number.isFinite(stop) || stop <= 0)) return "Enter a valid stop-loss price.";
  if (takeProfit !== null && (!Number.isFinite(takeProfit) || takeProfit <= 0)) return "Enter a valid target price.";
  const isLong = side === "BUY";
  if (stop !== null && (isLong ? stop >= entry : stop <= entry)) return isLong ? "A long stop-loss must be below entry." : "A short stop-loss must be above entry.";
  if (takeProfit !== null && (isLong ? takeProfit <= entry : takeProfit >= entry)) return isLong ? "A long target must be above entry." : "A short target must be below entry.";
  return "";
}

export function estimateIntradayCharges(turnover, side) {
  const value = Number(turnover);
  if (!Number.isFinite(value) || value <= 0) return { brokerage: 0, stt: 0, exchange: 0, gst: 0, sebi: 0, stamp_duty: 0, total: 0 };
  const brokerage = Math.min(20, value * 0.0003);
  const stt = side === "SELL" ? value * 0.00025 : 0;
  const exchange = value * 0.0000325;
  const gst = (brokerage + exchange) * 0.18;
  const sebi = value * 0.000001;
  const stamp_duty = side === "BUY" ? value * 0.00003 : 0;
  return { brokerage, stt, exchange, gst, sebi, stamp_duty, total: brokerage + stt + exchange + gst + sebi + stamp_duty };
}

/** Pages the rows returned by the current backend list contract using a local offset cursor. */
export function getHistoryPage(rows, cursor = 0, pageSize = 10) {
  const start = Math.max(0, cursor);
  const page = rows.slice(start, start + pageSize);
  const end = start + page.length;
  return { rows: page, nextCursor: end < rows.length ? end : null };
}

export function marketOpenLabel(nextMarketOpen) {
  if (!nextMarketOpen) return "The next market session is not available yet.";
  const date = new Date(nextMarketOpen);
  if (!Number.isFinite(date.getTime())) return "The market is closed. Check again before the next session.";
  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `Market opens ${formatted} IST.`;
}
