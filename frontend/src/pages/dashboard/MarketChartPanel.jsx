import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Search, Wifi, WifiOff } from "lucide-react";
import { getCandles, getQuote, getStocks } from "../../api/market";
import { getPredictions } from "../../api/predictions";
import { queryKeys } from "../../api/queryKeys";
import { useLivePrices } from "../../hooks/useLivePrices";
import { useMarketStatus } from "../../hooks/useMarketStatus";
import { CandleChart } from "../../components/charts";
import { Badge, EmptyState, ErrorState, GlassCard, Skeleton, TimeframePills } from "../../components/ui";
import { candlesForChart, formatMoney, istDateKey } from "./utils";

const intervals = ["5m", "10m", "30m", "1d"];

function predictionMarkers(predictions = []) {
  return predictions.map((prediction) => {
    const time = Math.floor(new Date(prediction.made_at).getTime() / 1000);
    if (!Number.isFinite(time)) return null;
    const pending = prediction.status === "pending";
    const correct = prediction.correct === true;
    return {
      time,
      position: prediction.direction === "UP" ? "belowBar" : "aboveBar",
      color: pending ? "#94a3b8" : correct ? "#10b981" : "#ef4444",
      shape: pending ? "circle" : prediction.direction === "UP" ? "arrowUp" : "arrowDown",
      text: "",
    };
  }).filter(Boolean).sort((a, b) => a.time - b.time);
}

function LivePriceReadout({ symbol, fallbackPrice, baseline }) {
  const { prices, status } = useLivePrices([symbol], { includePrices: true, throttleMs: 1000 });
  const price = Number(prices[symbol]?.ltp ?? fallbackPrice);
  const change = Number.isFinite(price) && baseline > 0 ? ((price - baseline) / baseline) * 100 : null;
  const positive = change === null || change >= 0;
  return <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
    <p className="text-2xl font-semibold tracking-tight text-slate-900">{formatMoney(price)}</p>
    {change !== null && <span className={`inline-flex items-center gap-0.5 pb-1 text-xs font-semibold ${positive ? "text-emerald-700" : "text-red-600"}`}>{positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{change >= 0 ? "+" : ""}{change.toFixed(2)}% day change</span>}
    <span className="mb-1 inline-flex items-center gap-1 text-[10px] text-slate-400">{status === "connected" || status === "mock" ? <Wifi size={12} className="text-emerald-600" /> : <WifiOff size={12} />}{status === "mock" ? "Mock feed" : status === "connected" ? "Live feed" : status === "reconnecting" ? "Reconnecting" : status === "connecting" ? "Connecting" : "Feed idle"}</span>
  </div>;
}

export default function MarketChartPanel({ symbol, onSelectSymbol }) {
  const [interval, setInterval] = useState("5m");
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const chartRef = useRef(null);
  const market = useMarketStatus();
  const candleQuery = useQuery({ queryKey: queryKeys.candles(symbol, interval, 200), queryFn: () => getCandles(symbol, interval, 200), staleTime: 15_000, refetchInterval: market.data?.market_open ? 60_000 : false, retry: 1 });
  const quoteQuery = useQuery({ queryKey: queryKeys.quote(symbol), queryFn: () => getQuote(symbol), staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const predictionsQuery = useQuery({ queryKey: queryKeys.predictions({ symbol, limit: 100 }), queryFn: () => getPredictions({ symbol, limit: 100 }), staleTime: 30_000, retry: 1 });
  const stocksQuery = useQuery({ queryKey: queryKeys.stocks(search.trim()), queryFn: () => getStocks(search.trim()), enabled: pickerOpen, staleTime: 5 * 60_000, retry: 1 });
  const candles = useMemo(() => candlesForChart(candleQuery.data), [candleQuery.data]);
  const markers = useMemo(() => predictionMarkers(predictionsQuery.data), [predictionsQuery.data]);
  const lastDate = candles.length ? istDateKey(typeof candles.at(-1).time === "number" ? candles.at(-1).time * 1000 : candles.at(-1).time) : "";
  const baseline = Number(candles.find((candle) => istDateKey(typeof candle.time === "number" ? candle.time * 1000 : candle.time) === lastDate)?.open ?? 0);
  const onFeedMessage = useCallback((message) => {
    if (message.type === "candle" && message.interval === interval && message.ohlcv) chartRef.current?.updateCandle(message.ohlcv);
    if (message.type === "tick" && (interval === "10m" || interval === "1d")) chartRef.current?.updateLastPrice(message);
  }, [interval]);
  const { status: feedStatus } = useLivePrices([symbol], { onMessage: onFeedMessage, includePrices: false });
  const results = Array.isArray(stocksQuery.data) ? stocksQuery.data.slice(0, 8) : [];

  return <GlassCard className="min-w-0 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="relative min-w-[220px] flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">Market chart</p>
        <label className="mt-2 flex h-11 max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-white/75 px-3 text-slate-400 focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-100">
          <Search size={16} aria-hidden="true" /><input value={pickerOpen ? search : symbol} onFocus={() => { setPickerOpen(true); setSearch(""); }} onChange={(event) => setSearch(event.target.value)} aria-label="Search Nifty 50 symbols" placeholder="Search Nifty 50" className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400" />
        </label>
        {pickerOpen && <div className="absolute left-0 right-0 top-[4.65rem] z-30 max-w-sm overflow-hidden rounded-2xl border border-white/90 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl" role="listbox" aria-label="Nifty 50 symbols">
          {stocksQuery.isLoading && <div className="space-y-2 p-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>}
          {stocksQuery.isError && <ErrorState title="Stocks unavailable" description="Nifty 50 symbols could not be loaded." onRetry={() => stocksQuery.refetch()} className="!px-2 !py-4" />}
          {stocksQuery.isSuccess && results.map((stock) => <button key={stock.symbol} type="button" role="option" aria-selected={stock.symbol === symbol} onClick={() => { onSelectSymbol(stock.symbol); setPickerOpen(false); setSearch(""); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-emerald-50/70"><span><b className="block text-xs text-slate-800">{stock.symbol}</b><span className="text-[11px] text-slate-500">{stock.name}</span></span></button>)}
          {stocksQuery.isSuccess && results.length === 0 && <EmptyState title="No matching stocks" description="Try another Nifty 50 symbol or company name." className="!px-2 !py-4" />}
          <button type="button" onClick={() => setPickerOpen(false)} className="w-full rounded-lg border-t border-slate-100 px-3 py-2 text-left text-[11px] text-slate-500 hover:bg-slate-50">Close list</button>
        </div>}
      </div>
      <TimeframePills value={interval} onChange={setInterval} options={intervals} label="Candlestick interval" />
    </div>

    <div className="mt-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{symbol}</p>{quoteQuery.isLoading ? <Skeleton className="mt-2 h-7 w-36" /> : <LivePriceReadout symbol={symbol} fallbackPrice={quoteQuery.data?.ltp ?? candles.at(-1)?.close} baseline={baseline} />}</div><Badge kind={quoteQuery.data?.market_open ? "positive" : "neutral"}>{quoteQuery.data?.market_open ? "Market quote" : "Last available quote"}</Badge></div>
    {quoteQuery.isError && <ErrorState title="Quote unavailable" description="The chart is available, but the latest quote could not be fetched." onRetry={() => quoteQuery.refetch()} className="!px-2 !py-4" />}
    {market.data?.market_open === false && <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs leading-5 text-amber-900">Market closed, showing the last session's data.{feedStatus === "mock" ? " Mock prices continue as clearly simulated demo data." : ""}</p>}
    {market.isError && <p className="mt-2 text-xs text-slate-500">Market status is temporarily unavailable.</p>}
    <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" />Correct prediction</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-500" />Incorrect prediction</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-slate-400" />Pending prediction</span></div>
    {candleQuery.isLoading && <Skeleton className="mt-4 h-[360px] w-full" />}
    {candleQuery.isError && <ErrorState title="Candles unavailable" description="The selected interval's candles could not be loaded." onRetry={() => candleQuery.refetch()} className="!py-8" />}
    {candleQuery.isSuccess && candles.length === 0 && <EmptyState title="No candles for this interval" description="Try another interval or check again after more market data is available." className="!py-10" />}
    {candleQuery.isSuccess && candles.length > 0 && <CandleChart ref={chartRef} candles={candles} markers={markers} height={360} className="mt-2" />}
    {predictionsQuery.isError && <p className="mt-2 text-[11px] text-slate-500">Prediction markers could not be loaded.</p>}
    {predictionsQuery.isSuccess && predictionsQuery.data.length === 0 && <p className="mt-2 text-[11px] text-slate-400">No predictions for {symbol} yet.</p>}
  </GlassCard>;
}
