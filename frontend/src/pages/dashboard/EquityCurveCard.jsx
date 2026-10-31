import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEquityCurve } from "../../api/dashboard";
import { queryKeys } from "../../api/queryKeys";
import { AreaChart } from "../../components/charts";
import { EmptyState, ErrorState, GlassCard, Skeleton, TimeframePills } from "../../components/ui";
import { formatMoney } from "./utils";

const ranges = ["1d", "1w", "1m"];

export default function EquityCurveCard() {
  const [range, setRange] = useState("1d");
  const query = useQuery({ queryKey: queryKeys.equityCurve(range), queryFn: () => getEquityCurve(range), staleTime: 60_000, retry: 1 });
  const points = Array.isArray(query.data) ? query.data : [];
  const latestEquity = Number(points.at(-1)?.equity);
  return <GlassCard className="p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">Portfolio history</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Equity curve</h2>{Number.isFinite(latestEquity) && <p className="mt-1 text-sm text-slate-500">Latest snapshot {formatMoney(latestEquity)}</p>}</div><TimeframePills value={range} onChange={setRange} options={ranges} label="Equity curve range" /></div>
    {query.isLoading && <Skeleton className="mt-5 h-[250px] w-full" />}
    {query.isError && <ErrorState title="Equity curve unavailable" description="Portfolio snapshots could not be loaded." onRetry={() => query.refetch()} className="!py-8" />}
    {query.isSuccess && points.length === 0 && <EmptyState title="No equity snapshots yet" description="Your paper account's equity history will appear after snapshot data is available." className="!py-8" />}
    {query.isSuccess && points.length > 0 && <AreaChart data={points} height={250} className="mt-4" />}
  </GlassCard>;
}
