import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { getCandles, getQuote, getStocks } from "../../api/market";
import { queryKeys } from "../../api/queryKeys";
import { AreaSparkline } from "../../components/charts";
import { Badge, Button, EmptyState, ErrorState, GlassCard, Skeleton } from "../../components/ui";
import { useLivePrices } from "../../hooks/useLivePrices";
import { generateSampleCandles } from "../../lib/sampleData";
import { candlesForChart, formatMoney, istDateKey } from "./utils";

const STORAGE_KEY = "stockzo.watchlist.symbols";
const DEFAULT_SYMBOLS = ["RELIANCE", "TCS", "HDFCBANK"];

function readWatchlist() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    return Array.isArray(saved) ? [...new Set(saved.map((symbol) => String(symbol).toUpperCase()))].slice(0, 10) : DEFAULT_SYMBOLS;
  } catch { return DEFAULT_SYMBOLS; }
}

function sampleFor(symbol, startPrice = 1000) {
  const seed = [...symbol].reduce((total, character) => total + character.charCodeAt(0), 17);
  return generateSampleCandles({ count: 36, seed, startPrice, intervalMinutes: 5 }).map((candle) => ({ time: candle.time, value: candle.close }));
}

function WatchlistRow({ symbol, selected, priceTick, onSelect, onRemove }) {
  const quote = useQuery({ queryKey: queryKeys.quote(symbol), queryFn: () => getQuote(symbol), staleTime: 10_000, refetchInterval: 30_000, retry: 1 });
  const candlesQuery = useQuery({ queryKey: queryKeys.candles(symbol, "5m", 36), queryFn: () => getCandles(symbol, "5m", 36), staleTime: 30_000, retry: 1 });
  const candles = useMemo(() => candlesForChart(candlesQuery.data), [candlesQuery.data]);
  const sampleLine = useMemo(() => sampleFor(symbol, Number(quote.data?.ltp) || 1000), [symbol, quote.data?.ltp]);
  const series = candles.length ? candles.map((candle) => ({ time: candle.time, value: candle.close })) : sampleLine;
  const price = Number(priceTick?.ltp ?? quote.data?.ltp);
  const lastDate = candles.length ? istDateKey(typeof candles.at(-1).time === "number" ? candles.at(-1).time * 1000 : candles.at(-1).time) : "";
  const baseline = candles.length ? Number(candles.find((candle) => istDateKey(typeof candle.time === "number" ? candle.time * 1000 : candle.time) === lastDate)?.open) : null;
  const change = Number.isFinite(price) && baseline > 0 ? ((price - baseline) / baseline) * 100 : null;
  const candle = candlesQuery.data?.[0];
  return <div className={`rounded-2xl border p-3 transition ${selected ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200/70 bg-white/45 hover:bg-white/70"}`}>
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onSelect(symbol)} className="min-w-0 flex-1 text-left" aria-label={`Select ${symbol} for the chart`}><span className="block truncate text-xs font-semibold text-slate-800">{symbol}</span><span className="block truncate text-[10px] text-slate-500">{candle?.name || "Nifty 50"}</span></button>
      <button type="button" onClick={() => onRemove(symbol)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${symbol} from watchlist`}><X size={14} /></button>
    </div>
    <div className="mt-2 flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{Number.isFinite(price) ? formatMoney(price) : quote.isLoading ? "Loading…" : "—"}</p>{change !== null && <span className={`text-[10px] font-semibold ${change >= 0 ? "text-emerald-700" : "text-red-600"}`}>{change >= 0 ? "+" : ""}{change.toFixed(2)}%</span>}</div>
    {candlesQuery.isLoading ? <Skeleton className="mt-2 h-12 w-full" /> : <AreaSparkline data={series} color={change !== null && change < 0 ? "#ef4444" : "#10b981"} height={48} className="mt-2" />}
    {candlesQuery.isError && <p className="mt-1 text-[10px] text-slate-500">Candles unavailable; sample trend shown.</p>}
    {!candles.length && candlesQuery.isSuccess && <Badge kind="neutral" className="mt-1 !px-2 !py-0.5">Sample trend</Badge>}
    {quote.isError && <p className="mt-1 text-[10px] text-slate-500">Quote unavailable</p>}
  </div>;
}

export default function WatchlistCard({ selectedSymbol, onSelectSymbol }) {
  const [symbols, setSymbols] = useState(readWatchlist);
  const [search, setSearch] = useState("");
  const stockQuery = useQuery({ queryKey: queryKeys.stocks(search.trim()), queryFn: () => getStocks(search.trim()), enabled: search.trim().length > 0, staleTime: 5 * 60_000, retry: 1 });
  const { prices } = useLivePrices(symbols, { includePrices: true, throttleMs: 1000 });
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols)); } catch { /* Watchlist remains usable for this tab if storage is unavailable. */ }
  }, [symbols]);

  const addSymbol = (symbol) => { setSymbols((previous) => previous.includes(symbol) || previous.length >= 10 ? previous : [...previous, symbol]); setSearch(""); };
  const removeSymbol = (symbol) => setSymbols((previous) => previous.filter((item) => item !== symbol));
  const results = (stockQuery.data || []).filter((stock) => !symbols.includes(stock.symbol)).slice(0, 6);

  return <GlassCard className="p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">Personal list</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Watchlist</h2></div><Badge kind="neutral">Saved on this device</Badge></div>
    <div className="relative mt-4"><div className="flex gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Add a Nifty 50 stock" aria-label="Search symbols to add to watchlist" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white/75 px-3 py-2.5 text-xs outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" /><Button variant="secondary" size="sm" disabled={!results.length} onClick={() => results[0] && addSymbol(results[0].symbol)} aria-label="Add first matching stock"><Plus size={15} />Add</Button></div>
      {search.trim() && <div className="absolute left-0 right-0 top-12 z-20 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
        {stockQuery.isLoading && <div className="space-y-2 p-3"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>}
        {stockQuery.isError && <ErrorState title="Stock search unavailable" description="Try again in a moment." onRetry={() => stockQuery.refetch()} className="!px-2 !py-4" />}
        {stockQuery.isSuccess && results.map((stock) => <button type="button" key={stock.symbol} onClick={() => addSymbol(stock.symbol)} disabled={symbols.length >= 10} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-emerald-50 disabled:opacity-50"><span><b className="text-xs text-slate-800">{stock.symbol}</b><span className="ml-2 text-[11px] text-slate-500">{stock.name}</span></span><Plus size={14} className="text-emerald-700" /></button>)}
        {stockQuery.isSuccess && results.length === 0 && <p className="px-3 py-3 text-xs text-slate-500">No matching stocks to add.</p>}
      </div>}
    </div>
    {symbols.length === 0 && <EmptyState title="Your watchlist is empty" description="Search for a Nifty 50 company to add it here." className="!py-8" />}
    {symbols.length > 0 && <div className="mt-4 space-y-2">{symbols.map((symbol) => <WatchlistRow key={symbol} symbol={symbol} selected={symbol === selectedSymbol} priceTick={prices[symbol]} onSelect={onSelectSymbol} onRemove={removeSymbol} />)}</div>}
    <p className="mt-3 text-[10px] leading-4 text-slate-400">Watchlist symbols are stored locally in this browser; no account credentials are stored here.</p>
  </GlassCard>;
}
