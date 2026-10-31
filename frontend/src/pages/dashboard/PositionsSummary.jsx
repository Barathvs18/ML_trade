import { Link } from "react-router-dom";
import { ArrowRight, WalletCards } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getPositions } from "../../api/paper";
import { queryKeys } from "../../api/queryKeys";
import { Button, EmptyState, ErrorState, GlassCard, Skeleton } from "../../components/ui";
import { formatMoney } from "./utils";

export default function PositionsSummary() {
  const query = useQuery({ queryKey: queryKeys.positions, queryFn: getPositions, staleTime: 10_000, refetchInterval: 30_000, retry: 1 });
  const positions = query.data?.positions || [];
  const unrealized = Number(query.data?.unrealized_total || 0);
  return <GlassCard className="flex h-full flex-col p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">Portfolio</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Open positions</h2></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><WalletCards size={17} aria-hidden="true" /></span></div>
    {query.isLoading && <div className="mt-4 space-y-3"><Skeleton className="h-8 w-24" /><Skeleton className="h-4 w-40" /></div>}
    {query.isError && <ErrorState title="Positions unavailable" description="Open positions could not be loaded." onRetry={() => query.refetch()} className="!py-6" />}
    {query.isSuccess && positions.length === 0 && <EmptyState title="No open positions" description="Your simulated positions will be summarized here." className="!py-6" />}
    {query.isSuccess && positions.length > 0 && <div className="mt-5"><p className="text-3xl font-semibold tracking-tight text-slate-900">{positions.length}</p><p className="mt-1 text-xs text-slate-500">Open positions</p><p className={`mt-4 text-sm font-semibold ${unrealized >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatMoney(unrealized)} unrealized P&amp;L</p><div className="mt-3 space-y-2">{positions.slice(0, 3).map((position) => <div key={position.symbol} className="flex justify-between text-xs"><span className="font-medium text-slate-700">{position.symbol} · {position.side} × {position.qty}</span><span className="text-slate-500">{formatMoney(position.unrealized_pnl)}</span></div>)}</div></div>}
    <Link to="/paper-trading" className="mt-auto pt-5"><Button variant="secondary" size="sm" className="w-full">View paper trading <ArrowRight size={14} /></Button></Link>
  </GlassCard>;
}
