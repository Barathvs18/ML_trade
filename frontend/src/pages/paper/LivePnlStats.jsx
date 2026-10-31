import { useLivePrices } from "../../hooks/useLivePrices";
import { formatMoney } from "../dashboard/utils";
import HelpHint from "./HelpHint";

function Stat({ label, value, tone = "neutral", help, loading }) {
  const color = tone === "positive" ? "text-emerald-800" : tone === "negative" ? "text-red-700" : "text-slate-900";
  return <div className="rounded-2xl border border-white/75 bg-white/55 p-3.5 shadow-sm sm:p-4"><p className="text-[11px] font-medium text-slate-600">{label}{help && <HelpHint label={label} text={help} />}</p>{loading ? <div className="skeleton mt-2 h-6 w-24" /> : <p className={`mt-1 text-lg font-semibold tracking-tight ${color}`}>{value}</p>}</div>;
}

export default function LivePnlStats({ positions, wallet, realized, fallbackUnrealized, total, loading }) {
  const symbols = positions.map((position) => position.symbol);
  const { prices } = useLivePrices(symbols, { includePrices: true, throttleMs: 1000 });
  const unrealized = positions.length ? positions.reduce((sum, position) => {
    const current = Number(prices[position.symbol]?.ltp ?? position.ltp ?? position.avg_price);
    return sum + (current - Number(position.avg_price)) * Number(position.qty) * (position.side === "LONG" ? 1 : -1);
  }, 0) : Number(fallbackUnrealized ?? 0);
  const equity = Number(wallet?.balance ?? 0) + Number(wallet?.blocked_margin ?? 0) + unrealized;
  const totalPnl = positions.length ? Number(realized ?? 0) + unrealized : Number(total ?? 0);
  return <>
    <Stat label="Equity" loading={loading} value={formatMoney(equity)} />
    <Stat label="Unrealized P&L" tone={unrealized >= 0 ? "positive" : "negative"} loading={loading} value={formatMoney(unrealized)} help="A live estimate for positions that are still open." />
    <Stat label="Total P&L" tone={totalPnl >= 0 ? "positive" : "negative"} loading={loading} value={formatMoney(totalPnl)} />
  </>;
}
