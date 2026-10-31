import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Badge, EmptyState, ErrorState, GlassCard, Skeleton } from "../../components/ui";
import { formatIstDateTime, formatMoney, formatPercent } from "./utils";

function predictionBadge(prediction) {
  if (prediction.status === "pending") return <Badge kind="neutral">Pending</Badge>;
  if (prediction.correct === true) return <Badge kind="positive">Correct</Badge>;
  if (prediction.correct === false) return <Badge kind="negative">Incorrect</Badge>;
  return <Badge kind="neutral">Resolved</Badge>;
}

export default function RecentActivity({ summary, loading, error, onRetry }) {
  const predictions = summary?.last_predictions || [];
  const trades = summary?.last_trades || [];
  return <section className="grid grid-cols-1 gap-4 xl:grid-cols-2" aria-label="Recent activity">
    <GlassCard className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">Recent activity</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Predictions</h2></div><Link to="/prediction" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800">View all <ArrowRight size={13} /></Link></div>
      {loading && <div className="mt-4 space-y-2">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div>}
      {error && <ErrorState title="Predictions unavailable" description="Recent predictions could not be loaded." onRetry={onRetry} className="!py-6" />}
      {!loading && !error && predictions.length === 0 && <EmptyState title="No predictions yet" description="Your recent experimental estimates will appear here." action={<Link to="/prediction" className="text-sm font-semibold text-emerald-700">Try a prediction</Link>} className="!py-7" />}
      {!loading && !error && predictions.length > 0 && <div className="mt-4 divide-y divide-slate-200/70">{predictions.slice(0, 5).map((prediction) => <div key={prediction._id || `${prediction.symbol}-${prediction.made_at}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
        <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{prediction.symbol} · {prediction.horizon} min</p><p className="mt-0.5 text-[10px] text-slate-500">{prediction.direction} estimate · {formatPercent(prediction.probability)} probability · {formatIstDateTime(prediction.made_at)} IST</p></div><div className="shrink-0">{predictionBadge(prediction)}</div>
      </div>)}</div>}
    </GlassCard>

    <GlassCard className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">Paper account</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Recent trades</h2></div><Link to="/paper-trading" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800">View all <ArrowRight size={13} /></Link></div>
      {loading && <div className="mt-4 space-y-2">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div>}
      {error && <ErrorState title="Trades unavailable" description="Recent paper trades could not be loaded." onRetry={onRetry} className="!py-6" />}
      {!loading && !error && trades.length === 0 && <EmptyState title="No paper trades yet" description="Simulated fills will appear here after you place a paper order." action={<Link to="/paper-trading" className="text-sm font-semibold text-emerald-700">Open paper trading</Link>} className="!py-7" />}
      {!loading && !error && trades.length > 0 && <div className="mt-4 divide-y divide-slate-200/70">{trades.slice(0, 5).map((trade) => <div key={trade._id || `${trade.symbol}-${trade.ts}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
        <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{trade.symbol} · {trade.side} {trade.qty}</p><p className="mt-0.5 text-[10px] text-slate-500">{formatMoney(trade.price)} · {formatIstDateTime(trade.ts)} IST</p></div><p className={`shrink-0 text-xs font-semibold ${Number(trade.realized_pnl) > 0 ? "text-emerald-700" : Number(trade.realized_pnl) < 0 ? "text-red-600" : "text-slate-500"}`}>{trade.realized_pnl === undefined ? "Open fill" : formatMoney(trade.realized_pnl)}</p>
      </div>)}</div>}
    </GlassCard>
  </section>;
}
