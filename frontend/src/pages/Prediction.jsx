import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Clock3, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { createPrediction, getPrediction } from "../api/predictions";
import { getCandles, getQuote, getStocks } from "../api/market";
import { queryKeys } from "../api/queryKeys";
import { isMockMode } from "../api/client";
import { useLivePrices } from "../hooks/useLivePrices";
import { useMarketStatus } from "../hooks/useMarketStatus";
import { CandleChart } from "../components/charts";
import { Badge, Button, EmptyState, ErrorState, GlassCard, Skeleton } from "../components/ui";
import { candlesForChart, formatMoney } from "./dashboard/utils";
import { mapPredictionError, marketOpenLabel } from "./prediction/utils";
import PredictionHistory from "./prediction/PredictionHistory";
import PredictionResultCard from "./prediction/PredictionResultCard";
import ScorecardStrip from "./prediction/ScorecardStrip";

const horizons = [
  { value: 5, title: "5 minutes", question: "Where will the price be in 5 minutes?", note: "One 5-minute model bar ahead." },
  { value: 10, title: "10 minutes", question: "Where will the price be in 10 minutes?", note: "Two 5-minute model bars ahead." },
  { value: 30, title: "30 minutes", question: "Where will the price be in 30 minutes?", note: "One 30-minute model bar ahead." },
];

function intervalFor(horizon) {
  return horizon === 30 ? "30m" : horizon === 10 ? "10m" : "5m";
}

function PredictionChart({ symbol, horizon, prediction, onBarClosed }) {
  const chartRef = useRef(null);
  const interval = intervalFor(horizon);
  const market = useMarketStatus();
  const candlesQuery = useQuery({ queryKey: queryKeys.candles(symbol, interval, 150), queryFn: () => getCandles(symbol, interval, 150), staleTime: 15_000, refetchInterval: market.data?.market_open ? 60_000 : false, retry: 1 });
  const quoteQuery = useQuery({ queryKey: queryKeys.quote(symbol), queryFn: () => getQuote(symbol), staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const candles = useMemo(() => candlesForChart(candlesQuery.data), [candlesQuery.data]);
  const entryPrice = prediction?.entry_price;
  const forecastClose = prediction?.forecast_close;
  const lines = useMemo(() => Number.isFinite(Number(entryPrice)) && Number.isFinite(Number(forecastClose)) ? [
    { price: entryPrice, color: "#64748b", title: "Entry", lineStyle: 0 },
    { price: forecastClose, color: "#10b981", title: "Forecast", lineStyle: 2 },
  ] : [], [entryPrice, forecastClose]);
  const markers = useMemo(() => {
    if (!prediction?.made_at) return [];
    const time = Math.floor(new Date(prediction.made_at).getTime() / 1000);
    return Number.isFinite(time) ? [{ time, position: "aboveBar", color: "#0f172a", shape: "circle", text: "Prediction" }] : [];
  }, [prediction?.made_at]);
  const price = Number(quoteQuery.data?.ltp ?? candles.at(-1)?.close);

  const onMessage = useCallback((message) => {
    if (message.type === "candle" && message.interval === interval && message.ohlcv) chartRef.current?.updateCandle(message.ohlcv);
    else if (message.type === "tick" && (interval === "10m" || interval === "1d")) chartRef.current?.updateLastPrice(message);
    if (message.type === "candle" && message.closed) onBarClosed?.(message);
  }, [interval, onBarClosed]);
  const { prices, status } = useLivePrices([symbol], { onMessage, includePrices: true, throttleMs: 1000 });
  const livePrice = Number(prices[symbol]?.ltp ?? price);

  return <GlassCard className="p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">Price context</p><h2 className="mt-1 text-lg font-semibold text-slate-900">{symbol} candlestick chart</h2></div><Badge kind={status === "connected" || status === "mock" ? "positive" : "neutral"}>{status === "mock" ? "Mock feed" : status === "connected" ? "Live feed" : status === "reconnecting" ? "Reconnecting" : "Feed idle"}</Badge></div>
    <div className="mt-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-2xl font-semibold tracking-tight text-slate-900">{Number.isFinite(livePrice) ? formatMoney(livePrice) : quoteQuery.isLoading ? "Loading price…" : "Price unavailable"}</p><p className="mt-1 text-xs text-slate-500">Interval {interval} · Volume shown below the candles</p></div><div className="flex flex-wrap gap-3 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1"><i className="h-px w-4 bg-slate-500" />Entry</span><span className="inline-flex items-center gap-1"><i className="w-4 border-t border-dashed border-emerald-600" />Forecast close</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-slate-900" />Prediction time</span></div></div>
    {market.data?.market_open === false && <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">Market closed, showing the most recent available candles.</p>}
    {quoteQuery.isError && <ErrorState title="Quote unavailable" description="The chart can still show the latest candles." onRetry={() => quoteQuery.refetch()} className="!py-3" />}
    {candlesQuery.isLoading && <Skeleton className="mt-4 h-[330px] w-full" />}
    {candlesQuery.isError && <ErrorState title="Candles unavailable" description="We couldn't load this symbol's chart data." onRetry={() => candlesQuery.refetch()} className="!py-8" />}
    {candlesQuery.isSuccess && candles.length === 0 && <EmptyState title="No candle history available" description="Try another Nifty 50 symbol or check again later." className="!py-8" />}
    {candlesQuery.isSuccess && candles.length > 0 && <CandleChart ref={chartRef} candles={candles} markers={markers} priceLines={lines} height={330} className="mt-2" />}
  </GlassCard>;
}

export default function PredictionPage() {
  const queryClient = useQueryClient();
  const market = useMarketStatus();
  const [symbol, setSymbol] = useState("RELIANCE");
  const [symbolSearch, setSymbolSearch] = useState("");
  const [horizon, setHorizon] = useState(5);
  const [latestId, setLatestId] = useState("");
  const [historySelection, setHistorySelection] = useState(null);
  const [tradeReceipt, setTradeReceipt] = useState(null);
  const stockQuery = useQuery({ queryKey: queryKeys.stocks(""), queryFn: () => getStocks(""), staleTime: 5 * 60_000, retry: 1 });
  const stocks = useMemo(() => Array.isArray(stockQuery.data) ? stockQuery.data : [], [stockQuery.data]);
  const validSymbols = useMemo(() => new Set(stocks.map((stockRow) => stockRow.symbol)), [stocks]);
  const requestedSymbol = symbolSearch.trim().toUpperCase() || symbol;
  const symbolValid = validSymbols.has(requestedSymbol);
  const activeId = historySelection?._id || latestId;
  const predictionQuery = useQuery({
    queryKey: queryKeys.predictionDetail(activeId),
    queryFn: () => getPrediction(activeId),
    enabled: Boolean(activeId),
    staleTime: 0,
    refetchInterval: (query) => query.state.data?.status === "pending" ? 2500 : false,
    retry: 1,
  });
  const prediction = predictionQuery.data;
  useEffect(() => {
    if (prediction?.status === "resolved") {
      queryClient.invalidateQueries({ queryKey: ["predictions"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.predictionStats });
    }
  }, [prediction?._id, prediction?.status, queryClient]);
  const chartSymbol = historySelection?.symbol || prediction?.symbol || symbol;
  const chartHorizon = historySelection?.horizon || prediction?.horizon || horizon;
  const mutation = useMutation({
    mutationFn: createPrediction,
    onSuccess: (created) => {
      setHistorySelection(null);
      setLatestId(created._id);
      setTradeReceipt(null);
      queryClient.setQueryData(queryKeys.predictionDetail(created._id), created);
      queryClient.invalidateQueries({ queryKey: ["predictions"] });
    },
  });
  const onBarClosed = useCallback((message) => {
    if (message.symbol === chartSymbol && activeId) queryClient.invalidateQueries({ queryKey: queryKeys.predictionDetail(activeId) });
  }, [activeId, chartSymbol, queryClient]);
  const { prices } = useLivePrices([chartSymbol], { includePrices: true, throttleMs: 1000, onMessage: onBarClosed });

  const marketOpen = market.data?.market_open === true;
  const openReason = market.isLoading
    ? "Checking market hours…"
    : market.isError
      ? "Market status is unavailable, so predictions are disabled."
      : marketOpen
        ? ""
        : marketOpenLabel(market.data?.next_market_open);
  const buttonDisabled = !marketOpen || !symbolValid || mutation.isPending || stockQuery.isLoading;
  const onPredict = () => mutation.mutate({ symbol: requestedSymbol, horizon });
  const selectHistoryPrediction = (row) => {
    setHistorySelection(row);
    queryClient.setQueryData(queryKeys.predictionDetail(row._id), row);
  };
  const clearHistorySelection = () => setHistorySelection(null);
  const livePrice = Number(prices[chartSymbol]?.ltp ?? prediction?.entry_price);
  const allowTrade = Boolean(latestId && !historySelection && prediction?.status === "pending" && Date.now() < new Date(prediction.resolve_at).getTime());
  const mockPrediction = isMockMode && prediction?.mock_accelerated;

  return <main className="mx-auto min-h-[70vh] max-w-7xl px-5 pb-16 pt-8 sm:px-8 sm:pt-10">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">Experimental lab</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Model predictions</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Request a model estimate, then compare it with the resolved market direction. Results are experimental and may be wrong.</p></div><Link to="/dashboard" className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white/70"><ArrowLeft size={14} />Dashboard</Link></div>

    <div className="mb-4"><ScorecardStrip /></div>

    <section className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" aria-label="Prediction controls and results">
      <GlassCard className="p-5 sm:p-6">
        <div className="flex items-center gap-2"><Sparkles size={17} className="text-emerald-700" /><h2 className="text-lg font-semibold text-slate-900">Create an estimate</h2></div>
        <label className="mt-5 block text-xs font-semibold text-slate-600">Nifty 50 symbol
          <input list="prediction-stocks" value={symbolSearch || symbol} onFocus={() => setSymbolSearch("")} onChange={(event) => { const value = event.target.value.toUpperCase(); setSymbolSearch(value); if (validSymbols.has(value)) setSymbol(value); }} onBlur={() => { if (validSymbols.has(symbolSearch.trim().toUpperCase())) setSymbol(symbolSearch.trim().toUpperCase()); setSymbolSearch(""); }} aria-label="Search Nifty 50 stocks" placeholder="Search symbol or company" className="mt-1.5 block h-11 w-full rounded-xl border border-slate-200 bg-white/75 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" />
          <datalist id="prediction-stocks">{stocks.map((stockRow) => <option key={stockRow.symbol} value={stockRow.symbol}>{stockRow.name}</option>)}</datalist>
        </label>
        {stockQuery.isLoading && <Skeleton className="mt-2 h-3 w-40" />}
        {stockQuery.isError && <p className="mt-2 text-xs text-red-700">Stock list unavailable. <button type="button" onClick={() => stockQuery.refetch()} className="font-semibold underline">Retry</button></p>}
        {!symbolValid && !stockQuery.isLoading && <p className="mt-2 text-xs text-amber-800">Choose a symbol from the Nifty 50 list to continue.</p>}

        <fieldset className="mt-5"><legend className="text-xs font-semibold text-slate-600">Prediction horizon</legend><div className="mt-2 grid grid-cols-1 gap-2">
          {horizons.map((option) => <label key={option.value} className={`cursor-pointer rounded-2xl border p-3 transition ${horizon === option.value ? "border-emerald-300 bg-emerald-50/55 shadow-sm" : "border-slate-200/80 bg-white/45 hover:bg-white/70"}`}>
            <input className="sr-only" type="radio" name="prediction-horizon" value={option.value} checked={horizon === option.value} onChange={() => setHorizon(option.value)} />
            <span className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-800">{option.title}</span><span className={`grid h-4 w-4 place-items-center rounded-full border ${horizon === option.value ? "border-emerald-600" : "border-slate-300"}`}>{horizon === option.value && <i className="h-2 w-2 rounded-full bg-emerald-600" />}</span></span>
            <span className="mt-1 block text-xs text-slate-600">{option.question}</span><span className="mt-1 block text-[10px] text-slate-400">{option.note}</span>
          </label>)}
        </div></fieldset>

        {market.data?.mock_market && <p className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs leading-5 text-indigo-900">Mock market is open for flow testing. Quotes, predictions, and fills are simulated; the timer is accelerated.</p>}
        {openReason && <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-xs leading-5 text-amber-900"><Clock3 size={14} className="mt-0.5 shrink-0" />{openReason}</p>}
        <Button className="mt-4 w-full" disabled={buttonDisabled} onClick={onPredict}>{mutation.isPending ? "Requesting estimate…" : "Get prediction"}<ArrowRight size={15} /></Button>
        {mutation.isError && <ErrorState title="Prediction request failed" description={mapPredictionError(mutation.error)} className="!px-2 !py-5" />}
        {predictionQuery.isError && <p className="mt-3 text-xs text-amber-800">Prediction detail is temporarily unavailable; retrying on the next refresh.</p>}
        <p className="mt-3 text-[11px] leading-5 text-slate-500">Educational only, not financial advice. All trading is simulated with virtual money.</p>
      </GlassCard>

      <PredictionResultCard prediction={prediction} loading={predictionQuery.isLoading && !historySelection} error={Boolean(activeId && predictionQuery.isError)} onRetry={() => predictionQuery.refetch()} readOnly={Boolean(historySelection)} allowTrade={allowTrade} currentPrice={livePrice} marketOpen={marketOpen} tradeReceipt={tradeReceipt} onOrderPlaced={(fill) => setTradeReceipt({ ...fill, prediction_id: fill.prediction_id ?? prediction?._id })} />
    </section>

    <div className="mt-4"><PredictionChart symbol={chartSymbol} horizon={chartHorizon} prediction={prediction} onBarClosed={onBarClosed} /></div>
    {historySelection && <div className="mt-3 flex justify-end"><Button variant="ghost" size="sm" onClick={clearHistorySelection}>Return to current estimate</Button></div>}

    <div className="mt-4"><PredictionHistory onSelect={selectHistoryPrediction} selectedId={historySelection?._id} /></div>
    {mockPrediction && <p className="mt-3 text-center text-[10px] text-slate-400">Mock demo countdown runs faster than the selected market horizon to make the complete flow testable.</p>}
    <p className="mt-8 text-center text-xs text-slate-500">Educational only, not financial advice. All trading is simulated with virtual money.</p>
  </main>;
}
