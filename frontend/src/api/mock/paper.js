import { getMockPositions, getMockTrades, getMockWallet, getMockPrice, setMockWallet } from "./state";

function mockError(status, code, message) {
  const error = new Error(message);
  error.response = { status, data: { error: { code, message }, detail: { error: { code, message } } } };
  throw error;
}

export function mockCharges(turnover, side) {
  const brokerage = Math.min(20, turnover * 0.0003);
  const stt = side === "SELL" ? turnover * 0.00025 : 0;
  const exchange = turnover * 0.0000325;
  const gst = (brokerage + exchange) * 0.18;
  const sebi = turnover * 0.000001;
  const stamp_duty = side === "BUY" ? turnover * 0.00003 : 0;
  return { brokerage, stt, exchange, gst, sebi, stamp_duty, total: brokerage + stt + exchange + gst + sebi + stamp_duty };
}

export function createMockOrder(payload, stocks) {
  const symbol = String(payload.symbol || "").toUpperCase();
  const side = String(payload.side || "").toUpperCase();
  const qty = Number(payload.qty);
  if (!stocks.some((stock) => stock.symbol === symbol) || !["BUY", "SELL"].includes(side) || !Number.isInteger(qty) || qty < 1) mockError(422, "invalid_order", "Choose a valid stock, side, and whole-number quantity.");
  const ltp = Number(getMockPrice(symbol).ltp);
  const price = ltp * (side === "BUY" ? 1.0002 : 0.9998);
  const turnover = qty * price;
  const charges = mockCharges(turnover, side);
  const stop = payload.stop_loss == null || payload.stop_loss === "" ? null : Number(payload.stop_loss);
  const target = payload.target == null || payload.target === "" ? null : Number(payload.target);
  const position = getMockPositions().find((item) => item.symbol === symbol);
  const closeSide = position && ((position.side === "LONG" && side === "SELL") || (position.side === "SHORT" && side === "BUY"));

  if (closeSide) {
    if (qty > position.qty) mockError(422, "quantity_exceeds_position", "Order quantity exceeds open position; excess reversal is disabled.");
    const gross = (price - position.avg_price) * qty * (position.side === "LONG" ? 1 : -1);
    const realized = gross - charges.total;
    const released = position.avg_price * qty;
    position.qty -= qty;
    if (position.qty === 0) getMockPositions().splice(getMockPositions().indexOf(position), 1);
    const wallet = getMockWallet();
    setMockWallet({ ...wallet, balance: wallet.balance + released + gross - charges.total, blocked_margin: Math.max(0, wallet.blocked_margin - released), realized_pnl: wallet.realized_pnl + realized });
    return recordTrade({ symbol, side, qty, price, charges, realized_pnl: realized, reason: "manual", prediction_id: payload.prediction_id ?? position.prediction_id, slippage: Math.abs(price - ltp) * qty });
  }

  const positionSide = side === "BUY" ? "LONG" : "SHORT";
  if (stop !== null && (positionSide === "LONG" ? stop >= price : stop <= price)) mockError(422, "invalid_stop_loss", `${positionSide === "LONG" ? "Long" : "Short"} stop-loss must be on the correct side of entry.`);
  if (target !== null && (positionSide === "LONG" ? target <= price : target >= price)) mockError(422, "invalid_target", `${positionSide === "LONG" ? "Long" : "Short"} target must be on the correct side of entry.`);
  const wallet = getMockWallet();
  if (wallet.balance < turnover + charges.total) mockError(400, "insufficient_balance", "Insufficient virtual balance for margin and charges.");
  if (position && position.side !== positionSide) mockError(422, "position_conflict", "Close the existing mock position before changing sides.");
  if (!position) getMockPositions().push({ user_id: "mock-user", symbol, side: positionSide, qty, avg_price: price, opened_at: new Date().toISOString(), stop_loss: stop, target, prediction_id: payload.prediction_id ?? null });
  else {
    const totalQty = position.qty + qty;
    position.avg_price = (position.avg_price * position.qty + price * qty) / totalQty;
    position.qty = totalQty;
    position.stop_loss = stop ?? position.stop_loss;
    position.target = target ?? position.target;
    position.prediction_id = payload.prediction_id ?? position.prediction_id;
  }
  setMockWallet({ ...wallet, balance: wallet.balance - turnover - charges.total, blocked_margin: wallet.blocked_margin + turnover });
  return recordTrade({ symbol, side, qty, price, charges, realized_pnl: 0, reason: "manual", prediction_id: payload.prediction_id ?? null, slippage: Math.abs(price - ltp) * qty });
}

function recordTrade(trade) {
  const row = { _id: `mock-trade-${Date.now()}-${getMockTrades().length}`, user_id: "mock-user", ...trade, ts: new Date().toISOString() };
  getMockTrades().unshift(row);
  return row;
}

export function closeMockPosition(symbol, reason = "manual") {
  const position = getMockPositions().find((item) => item.symbol === String(symbol).toUpperCase());
  if (!position) return null;
  const ltp = Number(getMockPrice(position.symbol).ltp);
  const side = position.side === "LONG" ? "SELL" : "BUY";
  const price = ltp * (side === "BUY" ? 1.0002 : 0.9998);
  const turnover = position.qty * price;
  const charges = mockCharges(turnover, side);
  const gross = (price - position.avg_price) * position.qty * (position.side === "LONG" ? 1 : -1);
  const realized = gross - charges.total;
  const released = position.avg_price * position.qty;
  getMockPositions().splice(getMockPositions().indexOf(position), 1);
  const wallet = getMockWallet();
  setMockWallet({ ...wallet, balance: wallet.balance + released + gross - charges.total, blocked_margin: Math.max(0, wallet.blocked_margin - released), realized_pnl: wallet.realized_pnl + realized });
  return recordTrade({ symbol: position.symbol, side, qty: position.qty, price, charges, realized_pnl: realized, reason, prediction_id: position.prediction_id ?? null, slippage: Math.abs(price - ltp) * position.qty });
}

export function evaluateMockExits(symbol, price) {
  const position = getMockPositions().find((item) => item.symbol === String(symbol).toUpperCase());
  if (!position) return null;
  const reason = position.side === "LONG"
    ? position.stop_loss != null && price <= position.stop_loss ? "stop_loss" : position.target != null && price >= position.target ? "target" : null
    : position.stop_loss != null && price >= position.stop_loss ? "stop_loss" : position.target != null && price <= position.target ? "target" : null;
  return reason ? closeMockPosition(position.symbol, reason) : null;
}
