import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getDashboardSummary } from "../api/dashboard";
import { getPositions, getTrades } from "../api/paper";
import { queryKeys } from "../api/queryKeys";
import { useAuth } from "../auth/useAuth";
import { ErrorState, GlassCard, Skeleton } from "../components/ui";
import DashboardSummary from "./dashboard/DashboardSummary";
import EquityCurveCard from "./dashboard/EquityCurveCard";
import MarketChartPanel from "./dashboard/MarketChartPanel";
import PositionsSummary from "./dashboard/PositionsSummary";
import RecentActivity from "./dashboard/RecentActivity";
import ScorecardCard from "./dashboard/ScorecardCard";
import WatchlistCard from "./dashboard/WatchlistCard";
import { todayPnl } from "./dashboard/utils";

export default function DashboardPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSymbol, setSelectedSymbol] = useState(searchParams.get("symbol")?.toUpperCase() || "RELIANCE");
  const summaryQuery = useQuery({ queryKey: queryKeys.dashboardSummary, queryFn: getDashboardSummary, staleTime: 15_000, refetchInterval: 30_000, retry: 1 });
  const tradesQuery = useQuery({ queryKey: queryKeys.trades(200), queryFn: () => getTrades(200), staleTime: 10_000, retry: 1 });
  const positionsQuery = useQuery({ queryKey: queryKeys.positions, queryFn: getPositions, staleTime: 10_000, refetchInterval: 30_000, retry: 1 });
  const summary = summaryQuery.data;
  const todayUnavailable = tradesQuery.isError || positionsQuery.isError || (tradesQuery.data?.length ?? 0) >= 200;
  const todayLoading = tradesQuery.isLoading || positionsQuery.isLoading;
  const pnlToday = todayUnavailable ? null : todayPnl(tradesQuery.data, positionsQuery.data?.positions);

  const selectSymbol = (symbol) => {
    setSelectedSymbol(symbol);
    setSearchParams((previous) => { const next = new URLSearchParams(previous); next.set("symbol", symbol); return next; }, { replace: true });
  };

  return <main className="mx-auto min-h-[70vh] max-w-7xl px-5 pb-16 pt-8 sm:px-8 sm:pt-10">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">Stockzo workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{user?.name ? `Welcome, ${user.name.split(" ")[0]}` : "Your dashboard"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Explore market prices, review experimental predictions, and track your simulated paper portfolio.</p></div>{summaryQuery.isError && <GlassCard className="p-1"><ErrorState title="Dashboard data unavailable" description="We couldn't load your account summary." onRetry={() => summaryQuery.refetch()} className="!px-3 !py-3" /></GlassCard>}</div>

    <DashboardSummary summary={summary} todayValue={pnlToday} todayLoading={todayLoading} todayUnavailable={todayUnavailable} summaryLoading={summaryQuery.isLoading} summaryError={false} onRetry={() => summaryQuery.refetch()} />

    <section className="mt-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]" aria-label="Market tools">
      <MarketChartPanel symbol={selectedSymbol} onSelectSymbol={selectSymbol} />
      <div className="grid min-w-0 gap-4"><WatchlistCard selectedSymbol={selectedSymbol} onSelectSymbol={selectSymbol} /><ScorecardCard /></div>
    </section>

    <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]" aria-label="Portfolio overview">
      <EquityCurveCard />
      <PositionsSummary />
    </section>

    <div className="mt-4"><RecentActivity summary={summary} loading={summaryQuery.isLoading} error={summaryQuery.isError} onRetry={() => summaryQuery.refetch()} /></div>
    {summaryQuery.isLoading && <GlassCard className="mt-4 p-5"><div className="space-y-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-72" /></div></GlassCard>}
  </main>;
}
