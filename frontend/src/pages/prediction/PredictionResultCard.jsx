import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Badge, EmptyState, ErrorState, ExperimentalBadge, GlassCard, Skeleton } from "../../components/ui";
import { formatIstDateTime, formatMoney, formatPercent } from "../dashboard/utils";
import { formatCountdown, getPredictionReveal } from "./utils";
import PredictionTradePanel from "./PredictionTradePanel";

const directionContent = {
  UP: { label: "Up", Icon: ArrowUpRight, tone: "text-emerald-700 bg-emerald-50" },
  DOWN: { label: "Down", Icon: ArrowDownRight, tone: "text-red-600 bg-red-50" },
  SIDEWAYS: { label: "Sideways", Icon: Minus, tone: "text-slate-700 bg-slate-100" },
};

function ProbabilityShares({ probabilities }) {
  const shares = ["UP", "SIDEWAYS", "DOWN"].map((direction) => ({ direction, value: Math.max(0, Math.min(1, Number(probabilities[direction]) || 0)) }));
  return <div className="mt-4" aria-label="Model class probabilities">
    <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={shares.map(({ direction, value }) => `${direction} ${formatPercent(value)}`).join(", ")}>
      {shares.map(({ direction, value }) => <span key={direction} style={{ width: `${value * 100}%` }} className={direction === "UP" ? "bg-emerald-500" : direction === "DOWN" ? "bg-red-400" : "bg-slate-400"} />)}
    </div>
    <div className="mt-2 grid grid-cols-3 gap-2">{shares.map(({ direction, value }) => <div key={direction}><p className="text-[10px] text-slate-400">{direction}</p><p className="text-xs font-semibold text-slate-700">{formatPercent(value)}</p></div>)}</div>
  </div>;
}

function useCountdown(resolveAt, pending) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!pending) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pending, resolveAt]);
  return formatCountdown(resolveAt, now);
}

export default function PredictionResultCard({ prediction, loading, error, onRetry, readOnly = false, allowTrade = false, currentPrice, marketOpen, onOrderPlaced }) {
  const pending = prediction?.status === "pending";
  const reveal = getPredictionReveal(prediction);
  const countdown = useCountdown(prediction?.resolve_at, pending);

  if (loading) return <GlassCard className="p-5 sm:p-6"><Skeleton className="h-7 w-56" /><Skeleton className="mt-4 h-24 w-full" /><Skeleton className="mt-3 h-5 w-40" /></GlassCard>;
  if (error) return <GlassCard className="p-5 sm:p-6"><ErrorState title="Prediction detail unavailable" description="We couldn't load this prediction. Your history remains unchanged." onRetry={onRetry} /></GlassCard>;
  if (!prediction) return <GlassCard className="p-4 sm:p-6"><EmptyState title="No estimate selected" description="Choose a stock and horizon above, then request an experimental model estimate." /></GlassCard>;

  const { label, Icon, tone } = directionContent[prediction.direction] ?? directionContent.SIDEWAYS;
  return <GlassCard className="p-5 sm:p-6" aria-label="Prediction result">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">{readOnly ? "Prediction detail" : "Model estimate"}</p><h2 className="mt-1 text-lg font-semibold text-slate-900">{prediction.symbol} · {prediction.horizon} minute horizon</h2></div><div className="flex items-center gap-2"><ExperimentalBadge />{pending && <Badge kind="neutral">Pending</Badge>}</div></div>
    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className={`flex items-center gap-3 rounded-2xl p-4 ${tone}`}><span className="grid h-11 w-11 place-items-center rounded-full bg-white/75"><Icon size={23} aria-hidden="true" /></span><div><p className="text-xs font-medium opacity-75">Predicted direction</p><p className="text-3xl font-semibold tracking-tight">{label}</p></div></div>
      <div className="sm:text-right"><p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Top class probability</p><p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{formatPercent(prediction.probability)}</p><p className="mt-1 text-xs text-slate-500">Confidence: <span className="font-semibold capitalize text-slate-700">{prediction.confidence}</span></p></div>
    </div>
    {prediction.probabilities ? <ProbabilityShares probabilities={prediction.probabilities} /> : <p className="mt-4 text-xs text-slate-500">Probability shown is the model's top-class estimate. Class shares are unavailable for this response.</p>}
    <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200/70 bg-white/45 p-3 sm:grid-cols-4">
      <div><p className="text-[10px] text-slate-400">Model</p><p className="mt-1 text-xs font-semibold capitalize text-slate-700">{prediction.model || "Model unavailable"}</p></div>
      <div><p className="text-[10px] text-slate-400">Entry price</p><p className="mt-1 text-xs font-semibold text-slate-700">{formatMoney(prediction.entry_price)}</p></div>
      <div><p className="text-[10px] text-slate-400">Forecast close</p><p className="mt-1 text-xs font-semibold text-slate-700">{formatMoney(prediction.forecast_close)}</p></div>
      <div><p className="text-[10px] text-slate-400">Made at (IST)</p><p className="mt-1 text-xs font-semibold text-slate-700">{formatIstDateTime(prediction.made_at)}</p></div>
    </div>
    <p className="mt-3 text-xs text-slate-500">Model estimate, not advice. Experimental output can be wrong.</p>
    {pending && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5" role="status"><span className="text-xs font-medium text-amber-900">Outcome pending. No actual price direction is shown.</span><span className="font-mono text-sm font-semibold tabular-nums text-amber-900">{countdown}</span></div>}
    {reveal && <div className="prediction-reveal mt-4 rounded-2xl border border-slate-200 bg-white/70 p-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resolved outcome</p><p className="mt-1 text-base font-semibold text-slate-900">Predicted {label} · Actual {directionContent[reveal.actualDirection]?.label ?? reveal.actualDirection}</p></div><Badge kind={reveal.correct ? "positive" : "negative"}>{reveal.correct ? "Correct" : "Wrong"}</Badge></div>
      {Number.isFinite(Number(reveal.actualReturnPct)) && <p className="mt-2 text-sm text-slate-700">Actual return: <span className={`font-semibold ${Number(reveal.actualReturnPct) >= 0 ? "text-emerald-700" : "text-red-600"}`}>{Number(reveal.actualReturnPct) >= 0 ? "+" : ""}{Number(reveal.actualReturnPct).toFixed(3)}%</span></p>}
      <p className="mt-2 text-xs leading-5 text-slate-600">An “always sideways” guess would have been {reveal.baselineCorrect ? "right" : "wrong"} here.</p>
    </div>}
    {allowTrade && pending && !readOnly && <PredictionTradePanel prediction={prediction} currentPrice={currentPrice} marketOpen={marketOpen} onPlaced={onOrderPlaced} />}
    {pending && readOnly && <p className="mt-4 text-xs text-slate-500">Read-only history detail. The prediction outcome is still pending.</p>}
  </GlassCard>;
}
