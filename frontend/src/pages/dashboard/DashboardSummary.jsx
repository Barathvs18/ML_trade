import { Activity, CircleDollarSign, Wallet, TrendingUp } from "lucide-react";
import { Badge, ErrorState, GlassCard, PaperModeBadge, Skeleton } from "../../components/ui";
import { useAuth } from "../../auth/useAuth";
import { useMarketStatus } from "../../hooks/useMarketStatus";
import { formatIstDateTime, formatMoney, formatPercent } from "./utils";

const summaryTiles = [
  { key: "wallet_balance", label: "Wallet balance", icon: Wallet, format: formatMoney },
  { key: "equity", label: "Equity", icon: CircleDollarSign, format: formatMoney },
  { key: "todayPnl", label: "Today's P&L", icon: Activity, format: formatMoney },
  { key: "win_rate", label: "Win rate", icon: TrendingUp, format: formatPercent },
];

export default function DashboardSummary({ summary, todayValue, todayLoading, todayUnavailable, summaryLoading, summaryError, onRetry }) {
  const { user } = useAuth();
  const market = useMarketStatus(Boolean(user));
  const status = market.data;
  return <section aria-label="Account overview" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {market.isLoading ? <Badge kind="neutral">Checking market status</Badge> : market.isError ? <Badge kind="negative">Market status unavailable</Badge> : <Badge kind={status?.market_open ? "positive" : "neutral"}><span className={`h-1.5 w-1.5 rounded-full ${status?.market_open ? "bg-emerald-500" : "bg-slate-400"}`} />{status?.market_open ? "Market open" : "Market closed"}</Badge>}
        {!status?.market_open && status?.next_market_open && <Badge kind="neutral">Next open {formatIstDateTime(status.next_market_open)} IST</Badge>}
        {status && status.upstox_token_ok === false && <Badge kind="negative">Upstox feed offline</Badge>}
      </div>
      <PaperModeBadge />
    </div>
    {summaryError && <GlassCard className="p-2"><ErrorState title="Account summary unavailable" description="We couldn't load your dashboard summary." onRetry={onRetry} className="!py-5" /></GlassCard>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {summaryTiles.map(({ key, label, icon: Icon, format }) => <GlassCard key={key} className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><span className="text-xs font-medium text-slate-500">{label}</span><span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon size={16} aria-hidden="true" /></span></div>
        {summaryLoading || (key === "todayPnl" && todayLoading) ? <Skeleton className="mt-3 h-7 w-32" /> : <p className={`mt-3 text-xl font-semibold tracking-tight ${key === "todayPnl" && Number(todayValue) < 0 ? "text-red-600" : "text-slate-900"}`}>{key === "todayPnl" ? (todayUnavailable ? "Unavailable" : format(todayValue)) : format(summary?.[key])}</p>}
        {key === "todayPnl" && todayUnavailable && <p className="mt-1 text-[10px] text-slate-400">The available trade page is capped at 200 fills.</p>}
      </GlassCard>)}
    </div>
    {summary && <p className="text-right text-[11px] text-slate-400">Signed in as {summary.user?.name || summary.user?.email || "Stockzo learner"}</p>}
  </section>;
}
