import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPredictionStats } from "../../api/predictions";
import { queryKeys } from "../../api/queryKeys";
import { Button, EmptyState, ErrorState, ExperimentalBadge, GlassCard, Skeleton } from "../../components/ui";
import { formatPercent } from "./utils";
import { baselineLabel, hasResolvedPredictions } from "./scorecardModel";

export default function ScorecardCard() {
  const query = useQuery({ queryKey: queryKeys.predictionStats, queryFn: getPredictionStats, staleTime: 60_000, retry: 1 });
  return <GlassCard className="h-full p-5 sm:p-6">
    <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">Experimental model scorecard</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Accuracy vs baseline</h2></div><ExperimentalBadge /></div>
    {query.isLoading && <div className="mt-5 space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>}
    {query.isError && <ErrorState title="Scorecard unavailable" description="Prediction statistics could not be loaded." onRetry={() => query.refetch()} className="!px-2 !py-6" />}
    {query.data && !hasResolvedPredictions(query.data) && <EmptyState title="No resolved predictions yet" description="Try an experimental estimate to start a personal comparison." action={<Button as={Link} to="/prediction" size="sm">Try a prediction</Button>} className="!px-1 !py-6" />}
    {query.data && hasResolvedPredictions(query.data) && <div className="mt-4 divide-y divide-slate-200/70">{[5, 10, 30].map((horizon) => {
      const item = query.data[String(horizon)] ?? { count: 0, accuracy: 0, baseline_accuracy: 0, beats_baseline: false };
      return <div key={horizon} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
        <div><p className="text-sm font-semibold text-slate-800">{horizon} min</p><p className="text-[11px] text-slate-500">{item.count} resolved predictions</p></div>
        {item.count > 0 ? <div className="text-right"><p className="text-sm font-semibold text-slate-800">{formatPercent(item.accuracy)} <span className="text-[10px] font-normal text-slate-400">vs</span> {formatPercent(item.baseline_accuracy)}</p><p className={`text-[10px] ${item.beats_baseline ? "text-emerald-700" : "text-slate-500"}`}>{baselineLabel(item.beats_baseline)}</p></div> : <span className="text-xs text-slate-400">No resolved predictions</span>}
      </div>;
    })}</div>}
    <p className="mt-3 text-[11px] leading-5 text-slate-500">Small samples: treat as experimental. Results are personal historical comparisons, not a promise of future performance.</p>
  </GlassCard>;
}
