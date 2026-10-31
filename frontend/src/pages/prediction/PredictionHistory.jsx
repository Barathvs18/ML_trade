import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownWideNarrow, ArrowRight } from "lucide-react";
import { getPredictions } from "../../api/predictions";
import { queryKeys } from "../../api/queryKeys";
import { Badge, EmptyState, ErrorState, GlassCard, Skeleton } from "../../components/ui";
import { formatIstDateTime, formatPercent } from "../dashboard/utils";
import { getHistoryPage } from "./utils";

const pageSize = 10;

function rowStatus(prediction) {
  if (prediction.status === "pending") return <Badge kind="neutral">Pending</Badge>;
  if (prediction.correct === true) return <Badge kind="positive">Correct</Badge>;
  if (prediction.correct === false) return <Badge kind="negative">Wrong</Badge>;
  return <Badge kind="neutral">Resolved</Badge>;
}

export default function PredictionHistory({ onSelect, selectedId }) {
  const [symbol, setSymbol] = useState("");
  const [horizon, setHorizon] = useState("");
  const [status, setStatus] = useState("");
  const [cursors, setCursors] = useState([0]);
  const filters = { symbol: symbol.trim().toUpperCase() || undefined, horizon: horizon ? Number(horizon) : undefined, status: status || undefined, limit: 100 };
  const query = useQuery({ queryKey: queryKeys.predictions(filters), queryFn: () => getPredictions(filters), staleTime: 10_000, retry: 1 });
  const rows = Array.isArray(query.data) ? query.data : [];
  const pages = cursors.map((cursor) => getHistoryPage(rows, cursor, pageSize));
  const visible = pages.flatMap((page) => page.rows);
  const nextCursor = pages.at(-1)?.nextCursor;
  const updateFilter = (setter) => (event) => { setter(event.target.value); setCursors([0]); };

  return <GlassCard className="p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">Your activity</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Prediction history</h2></div><Badge kind="neutral"><ArrowDownWideNarrow size={13} /> Most recent first</Badge></div>
    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
      <label className="text-[11px] font-medium text-slate-500">Symbol<input value={symbol} onChange={updateFilter(setSymbol)} placeholder="All Nifty 50" aria-label="Filter predictions by symbol" className="mt-1 block h-10 w-full rounded-xl border border-slate-200 bg-white/75 px-3 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" /></label>
      <label className="text-[11px] font-medium text-slate-500">Horizon<select value={horizon} onChange={updateFilter(setHorizon)} aria-label="Filter predictions by horizon" className="mt-1 block h-10 w-full rounded-xl border border-slate-200 bg-white/75 px-3 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"><option value="">All horizons</option><option value="5">5 min</option><option value="10">10 min</option><option value="30">30 min</option></select></label>
      <label className="text-[11px] font-medium text-slate-500">Status<select value={status} onChange={updateFilter(setStatus)} aria-label="Filter predictions by status" className="mt-1 block h-10 w-full rounded-xl border border-slate-200 bg-white/75 px-3 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"><option value="">All statuses</option><option value="pending">Pending</option><option value="resolved">Resolved</option></select></label>
    </div>
    {query.isLoading && <div className="mt-4 space-y-2">{[1, 2, 3].map((row) => <Skeleton key={row} className="h-12 w-full" />)}</div>}
    {query.isError && <ErrorState title="History unavailable" description="Prediction history could not be loaded." onRetry={() => query.refetch()} className="!py-8" />}
    {query.isSuccess && rows.length === 0 && <EmptyState title="No matching predictions" description="Predictions you make will appear here. Try changing the filters." className="!py-8" />}
    {query.isSuccess && rows.length > 0 && <>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-left text-xs">
          <thead><tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400"><th className="px-3 py-3 font-semibold">Symbol</th><th className="px-3 py-3 font-semibold">Horizon</th><th className="px-3 py-3 font-semibold">Direction</th><th className="px-3 py-3 font-semibold">Probability</th><th className="px-3 py-3 font-semibold">Made at (IST)</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Correct</th></tr></thead>
          <tbody>{visible.map((prediction) => <tr key={prediction._id} onClick={() => onSelect(prediction)} className={`cursor-pointer border-b border-slate-100/80 transition-colors hover:bg-emerald-50/45 ${prediction._id === selectedId ? "bg-emerald-50/55" : ""}`}>
            <td className="px-3 py-3"><button type="button" aria-label={`Open ${prediction.symbol} ${prediction.horizon} minute prediction`} onClick={(event) => { event.stopPropagation(); onSelect(prediction); }} className="font-semibold text-slate-800 hover:text-emerald-700">{prediction.symbol}<ArrowRight className="ml-1 inline" size={12} /></button></td>
            <td className="px-3 py-3 text-slate-600">{prediction.horizon} min</td>
            <td className="px-3 py-3 font-medium text-slate-700">{prediction.direction}</td>
            <td className="px-3 py-3 text-slate-600">{formatPercent(prediction.probability)}</td>
            <td className="px-3 py-3 text-slate-500">{formatIstDateTime(prediction.made_at)}</td>
            <td className="px-3 py-3">{rowStatus(prediction)}</td>
            <td className="px-3 py-3 text-slate-500">{prediction.status === "pending" ? "—" : prediction.correct === true ? "Yes" : prediction.correct === false ? "No" : "—"}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] text-slate-500">Showing {visible.length} of {rows.length} loaded predictions. The backend list currently returns at most 100 per request.</p>{nextCursor !== null && <button type="button" onClick={() => setCursors((previous) => [...previous, nextCursor])} className="rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300">Load more</button>}</div>
    </>}
  </GlassCard>;
}
