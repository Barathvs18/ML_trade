import api from "./client";

/** @typedef {{user:{id:string,email:string,name:string|null},wallet_balance:number,equity:number,total_pnl:number,win_rate:number,trade_count:number,open_positions_count:number,last_predictions:Array<object>,last_trades:Array<object>,market:object}} DashboardSummary */
/** @typedef {{ts:string,equity:number,realized_pnl:number,unrealized_pnl:number}} EquitySnapshot */

/** @returns {Promise<DashboardSummary>} */
export async function getDashboardSummary() { return (await api.get("/dashboard/summary")).data; }

/** @param {"1d"|"1w"|"1m"} range @returns {Promise<EquitySnapshot[]>} */
export async function getEquityCurve(range = "1d") {
  return (await api.get("/dashboard/equity-curve", { params: { range } })).data;
}
