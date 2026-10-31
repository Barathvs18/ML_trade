import api from "./client";

/** @typedef {{symbol:string,name:string,instrument_key:string}} Stock */
/** @typedef {{market_open:boolean,next_market_open:string|null,upstox_token_ok:boolean}} MarketStatus */
/** @typedef {{symbol:string,ltp?:number,ts?:string,volume?:number,market_open:boolean}} Quote */
/** @typedef {{start:string,o:number,h:number,l:number,c:number,v:number}} Candle */

/** @returns {Promise<MarketStatus>} */
export async function getMarketStatus() { return (await api.get("/market/status")).data; }

/** @param {string} [query] @returns {Promise<Stock[]>} */
export async function getStocks(query = "") { return (await api.get("/market/stocks", { params: { q: query } })).data; }

/** @param {string} symbol @returns {Promise<Quote>} */
export async function getQuote(symbol) { return (await api.get(`/market/quote/${encodeURIComponent(symbol)}`)).data; }

/** @param {string} symbol @param {"5m"|"10m"|"30m"|"1d"} interval @param {number} [limit] @returns {Promise<Candle[]>} */
export async function getCandles(symbol, interval = "5m", limit = 100) {
  return (await api.get(`/market/candles/${encodeURIComponent(symbol)}`, { params: { interval, limit } })).data;
}
