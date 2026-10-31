const CHARGES = Object.freeze({ brokerageRate: 0.0003, brokerageCap: 20, sttRate: 0.00025, exchangeRate: 0.0000325, sebiRate: 0.000001, stampRate: 0.00003, gstRate: 0.18, slippageBps: 2 });

export function validatePaperOrder({ side, quantity, entryPrice, stopLoss = "", target = "" }) {
  const qty = Number(quantity);
  const price = Number(entryPrice);
  if (!Number.isInteger(qty) || qty < 1) return "Quantity must be a whole number of at least 1.";
  if (!Number.isFinite(price) || price <= 0) return "A live price is not available yet.";
  if (!['BUY', 'SELL'].includes(side)) return "Choose BUY or SELL.";
  const stop = stopLoss === "" ? null : Number(stopLoss);
  const take = target === "" ? null : Number(target);
  if (stop !== null && (!Number.isFinite(stop) || (side === "BUY" ? stop >= price : stop <= price))) {
    return side === "BUY" ? "A long stop-loss must be below the estimated entry price." : "A short stop-loss must be above the estimated entry price.";
  }
  if (take !== null && (!Number.isFinite(take) || (side === "BUY" ? take <= price : take >= price))) {
    return side === "BUY" ? "A long target must be above the estimated entry price." : "A short target must be below the estimated entry price.";
  }
  return "";
}

export function estimatePaperOrder({ side, quantity, ltp }) {
  const qty = Number(quantity);
  const price = Number(ltp);
  if (!['BUY', 'SELL'].includes(side) || !Number.isInteger(qty) || qty < 1 || !Number.isFinite(price) || price <= 0) return null;
  const slippage = price * CHARGES.slippageBps / 10_000;
  const estimatedPrice = price + (side === "BUY" ? slippage : -slippage);
  const turnover = estimatedPrice * qty;
  const brokerage = Math.min(CHARGES.brokerageCap, turnover * CHARGES.brokerageRate);
  const stt = side === "SELL" ? turnover * CHARGES.sttRate : 0;
  const exchange = turnover * CHARGES.exchangeRate;
  const gst = (brokerage + exchange) * CHARGES.gstRate;
  const sebi = turnover * CHARGES.sebiRate;
  const stampDuty = side === "BUY" ? turnover * CHARGES.stampRate : 0;
  return { estimatedPrice, requiredMargin: turnover, slippageTotal: slippage * qty, charges: { brokerage, stt, exchange, gst, sebi, stamp_duty: stampDuty }, totalCharges: brokerage + stt + exchange + gst + sebi + stampDuty };
}

export function mapPaperOrderError(error) {
  const status = error?.response?.status;
  const detail = error?.response?.data?.error ?? error?.response?.data?.detail?.error;
  const code = detail?.code ?? "";
  const message = detail?.message ?? error?.response?.data?.detail ?? "";
  if (code === "insufficient_balance" || code === "insufficient_margin") return "Not enough available virtual balance for this margin and its charges.";
  if (code === "market_closed" || status === 409) return "The market is closed. Orders can be placed during market hours only.";
  if (code === "quantity_exceeds_position") return "This order is larger than your open position. Close or reduce it first; automatic reversal is disabled.";
  if (code === "position_conflict") return "Close the existing position before opening a position on the opposite side.";
  if (code === "invalid_stop_loss" || code === "invalid_target") return message || "Check that your stop-loss and target are on the correct side of your estimated entry.";
  if (code === "invalid_order" || code === "invalid_symbol" || status === 422) return message || "Check the symbol, side, and quantity, then try again.";
  if (status === 503 || code === "price_unavailable") return "A current or recent price is unavailable. Please try again shortly.";
  if (!error?.response || error?.message === "Network Error") return "Couldn’t reach Stockzo. Check your connection and try again.";
  return message || "The paper order could not be placed. Please try again.";
}

export function isSquareoffSoon(now = new Date(), marketOpen = true) {
  if (!marketOpen) return false;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (["Sat", "Sun"].includes(values.weekday)) return false;
  const minuteOfDay = Number(values.hour) * 60 + Number(values.minute);
  return minuteOfDay >= 14 * 60 + 50 && minuteOfDay <= 15 * 60 + 20;
}

export function isResetConfirmed(value) { return value === "RESET"; }

export function pageTrades(rows, cursor = 0, pageSize = 10) {
  const start = Number(cursor) || 0;
  const items = rows.slice(start, start + pageSize);
  return { items, nextCursor: start + items.length < rows.length ? start + items.length : null };
}

export function paperOrderCharges(trade) {
  const charges = trade?.charges ?? {};
  return [
    ["Brokerage", charges.brokerage], ["STT", charges.stt], ["Exchange", charges.exchange],
    ["GST", charges.gst], ["SEBI fee", charges.sebi], ["Stamp duty", charges.stamp_duty ?? charges.stampDuty],
  ];
}

export function formatReason(reason) {
  return ({ manual: "Manual", stop_loss: "Stop-loss", target: "Target", auto_squareoff: "Auto square-off", startup_recovery: "Recovery" })[reason] ?? "Manual";
}

export function tradesToCsv(trades) {
  const columns = ["ts", "symbol", "side", "qty", "price", "charges_total", "realized_pnl", "reason"];
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [columns.join(","), ...trades.map((trade) => [trade.ts, trade.symbol, trade.side, trade.qty, trade.price, trade.charges?.total, trade.realized_pnl, trade.reason].map(escape).join(","))].join("\r\n");
}
