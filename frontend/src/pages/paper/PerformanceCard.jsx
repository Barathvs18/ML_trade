import { GlassCard, Skeleton, ErrorState } from "../../components/ui";
import { formatMoney, formatPercent } from "../dashboard/utils";

export default function PerformanceCard({ pnl, trades, loading, error, onRetry }) {
  const charges = trades.reduce((sum, trade) => sum + Number(trade.charges?.total ?? 0), 0);
  const realized = trades.filter((trade) => Number(trade.realized_pnl) !== 0).slice(0, 20).reverse();
  const maxAbs = Math.max(1, ...realized.map((trade) => Math.abs(Number(trade.realized_pnl))));
  return <GlassCard className="p-5 sm:p-6">
    <div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Learning view</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Performance</h2></div>
    {loading && <div className="mt-4 grid grid-cols-2 gap-3">{[1, 2, 3, 4].map((index) => <Skeleton key={index} className="h-16 w-full" />)}</div>}
    {error && <ErrorState title="Performance unavailable" description="Account performance could not be loaded." onRetry={onRetry} className="!py-6" />}
    {!loading && !error && <>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl bg-slate-50/75 p-3"><p className="text-slate-600">Win rate</p><p className="mt-1 text-base font-semibold text-slate-900">{formatPercent(Number(pnl?.win_rate ?? 0), 1)}</p></div>
        <div className="rounded-xl bg-slate-50/75 p-3"><p className="text-slate-600">Total charges paid</p><p className="mt-1 text-base font-semibold text-slate-900">{formatMoney(charges)}</p><span className="text-[10px] text-slate-600">Loaded recent trades</span></div>
        <div className="rounded-xl bg-emerald-50/60 p-3"><p className="text-slate-700">Best realized trade</p><p className="mt-1 text-base font-semibold text-emerald-900">{pnl?.best_trade == null ? "—" : formatMoney(pnl.best_trade)}</p></div>
        <div className="rounded-xl bg-red-50/60 p-3"><p className="text-slate-700">Worst realized trade</p><p className="mt-1 text-base font-semibold text-red-900">{pnl?.worst_trade == null ? "—" : formatMoney(pnl.worst_trade)}</p></div>
      </div>
      <div className="mt-5"><p className="text-xs font-semibold text-slate-700">Last 20 realized trade P&amp;L</p>{realized.length === 0 ? <p className="mt-2 text-xs text-slate-600">No realized trades yet.</p> : <div className="mt-3 flex h-24 items-end gap-1 rounded-xl border border-slate-200/80 bg-white/50 px-3 py-2" role="img" aria-label="Bar chart showing up to 20 recent realized trade P&L values">{realized.map((trade, index) => { const value = Number(trade.realized_pnl); const height = Math.max(5, Math.abs(value) / maxAbs * 75); return <span key={trade._id ?? `${trade.ts}-${index}`} title={`${trade.symbol}: ${formatMoney(value)}`} className={`min-w-1 flex-1 rounded-t-sm ${value >= 0 ? "bg-emerald-500" : "bg-red-500"}`} style={{ height: `${height}px` }} />; })}</div>}</div>
      <p className="mt-3 text-[11px] leading-5 text-slate-600">Performance describes past simulated fills only; it does not predict future results.</p>
    </>}
  </GlassCard>;
}
