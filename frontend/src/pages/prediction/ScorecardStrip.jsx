import { useQuery } from "@tanstack/react-query";
import { getPredictionStats } from "../../api/predictions";
import { queryKeys } from "../../api/queryKeys";
import { ErrorState, ExperimentalBadge, GlassCard, Skeleton } from "../../components/ui";
import { formatPercent } from "../dashboard/utils";
import { baselineLabel } from "../dashboard/scorecardModel";

export default function ScorecardStrip() {
  const query = useQuery({ queryKey: queryKeys.predictionStats, queryFn: getPredictionStats, staleTime: 60_000, retry: 1 });
  return <GlassCard className="p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">Personal model comparison</p><h2 className="mt-1 text-base font-semibold text-slate-900">Accuracy vs always-sideways baseline</h2></div><ExperimentalBadge /></div>
    {query.isLoading && <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">{[5, 10, 30].map((horizon) => <Skeleton key={horizon} className="h-20 w-full" />)}</div>}
    {query.isError && <ErrorState title="Scorecard unavailable" description="Your resolved prediction comparisons could not be loaded." onRetry={() => query.refetch()} className="!py-5" />}
    {query.data && <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">{[5, 10, 30].map((horizon) => {
      const item = query.data[String(horizon)] ?? { count: 0, accuracy: 0, baseline_accuracy: 0, beats_baseline: false };
      return <div className="rounded-2xl border border-slate-200/70 bg-white/55 p-3" key={horizon}>
        <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{horizon} min</p><span className="text-[10px] text-slate-400">{item.count} resolved</span></div>
        {item.count > 0 ? <><p className="mt-2 text-xs font-semibold text-slate-700">{formatPercent(item.accuracy)} <span className="font-normal text-slate-400">vs</span> {formatPercent(item.baseline_accuracy)}</p><p className={`mt-1 text-[10px] ${item.beats_baseline ? "text-emerald-700" : "text-slate-500"}`}>{baselineLabel(item.beats_baseline)}</p></> : <p className="mt-2 text-xs text-slate-500">No resolved comparisons yet</p>}
      </div>;
    })}</div>}
    <p className="mt-3 text-[11px] text-slate-500">Small samples: treat as experimental. No accuracy or future-performance claim is implied.</p>
  </GlassCard>;
}
