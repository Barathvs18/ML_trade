import api from "./client";

/** @typedef {{user_id:string,balance:number,blocked_margin:number,realized_pnl:number}} Wallet */
/** @typedef {{user_id:string,symbol:string,side:"LONG"|"SHORT",qty:number,avg_price:number,unrealized_pnl:number,opened_at:string}} Position */
/** @typedef {{_id:string,symbol:string,side:"BUY"|"SELL",qty:number,price:number,realized_pnl?:number,ts:string}} Trade */

/** @returns {Promise<Wallet>} */
export async function getPaperWallet() { return (await api.get("/paper/wallet")).data; }

/** @returns {Promise<{positions:Position[],unrealized_total:number}>} */
export async function getPositions() { return (await api.get("/paper/positions")).data; }

/** @param {number} [limit] @returns {Promise<Trade[]>} */
export async function getTrades(limit = 50) { return (await api.get("/paper/trades", { params: { limit } })).data; }

/** @returns {Promise<{realized:number,unrealized:number,total:number,win_rate:number,best_trade:number|null,worst_trade:number|null}>} */
export async function getPaperPnl() { return (await api.get("/paper/pnl")).data; }

/** @param {{symbol:string,side:"BUY"|"SELL",qty:number,stop_loss?:number,target?:number,prediction_id?:string}} order */
export async function placeOrder(order) { return (await api.post("/paper/orders", order)).data; }

/** @param {string} symbol */
export async function closePosition(symbol) { return (await api.post(`/paper/positions/${encodeURIComponent(symbol)}/close`, {})).data; }

/** @returns {Promise<object>} */
export async function resetPaperAccount() { return (await api.post("/paper/reset", {})).data; }
