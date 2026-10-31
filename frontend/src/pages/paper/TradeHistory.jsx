import { useState } from "react";
import { Fragment } from "react";
import { ArrowDownToLine, ChevronDown, ChevronUp } from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, GlassCard, Skeleton } from "../../components/ui";
import { formatIstDateTime, formatMoney } from "../dashboard/utils";
import { formatReason, pageTrades, paperOrderCharges, tradesToCsv } from "./utils";

const PAGE_SIZE = 10;
function exportTrades(trades) {
  const blob = new Blob([tradesToCsv(trades)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = "stockzo-paper-trades.csv"; link.click(); URL.revokeObjectURL(url);
}

export default function TradeHistory({ trades = [], loading, error, onRetry }) {
  const [cursor, setCursor] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const page = pageTrades(trades, cursor, PAGE_SIZE);
  return <GlassCard className="p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Account activity</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Trade history</h2></div><Button variant="secondary" size="sm" disabled={!trades.length} onClick={() => exportTrades(trades)} aria-label="Export loaded trades as CSV"><ArrowDownToLine size={15} />Export CSV</Button></div>
    {loading && <div className="mt-4 space-y-2" aria-label="Loading trade history">{[1, 2, 3].map((index) => <Skeleton key={index} className="h-12 w-full" />)}</div>}
    {error && <ErrorState title="Trade history unavailable" description="Your recent paper trades could not be loaded." onRetry={onRetry} className="!py-8" />}
    {!loading && !error && trades.length === 0 && <EmptyState title="No paper trades yet" description="Your simulated fills will appear here, including their estimated charges." className="!py-8" />}
    {!loading && !error && trades.length > 0 && <>
      <p className="mb-2 mt-4 text-[11px] text-slate-600 sm:hidden">Swipe horizontally to see all trade details.</p>
      <div className="mt-4 overflow-x-auto"><table aria-label="Paper trade history" className="w-full min-w-[900px] border-collapse text-left text-xs"><thead><tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500"><th scope="col" className="px-3 py-3">Time (IST)</th><th scope="col" className="px-3 py-3">Symbol</th><th scope="col" className="px-3 py-3">Side</th><th scope="col" className="px-3 py-3">Qty</th><th scope="col" className="px-3 py-3">Price</th><th scope="col" className="px-3 py-3">Charges</th><th scope="col" className="px-3 py-3">Realized P&amp;L</th><th scope="col" className="px-3 py-3">Reason</th><th scope="col" className="px-3 py-3"><span className="sr-only">Breakdown</span></th></tr></thead>
      <tbody>{page.items.map((trade) => {
        const id = trade._id ?? `${trade.ts}-${trade.symbol}-${trade.side}`;
        const expanded = expandedId === id;
        return <Fragment key={id}>
          <tr key={id} className="border-b border-slate-100/90"><td className="px-3 py-3 text-slate-600">{formatIstDateTime(trade.ts)}</td><td className="px-3 py-3 font-semibold text-slate-900">{trade.symbol}</td><td className="px-3 py-3"><Badge kind={trade.side === "BUY" ? "positive" : "negative"}>{trade.side}</Badge></td><td className="px-3 py-3 text-slate-700">{trade.qty}</td><td className="px-3 py-3 text-slate-700">{formatMoney(trade.price)}</td><td className="px-3 py-3 text-slate-700">{formatMoney(trade.charges?.total ?? 0)}</td><td className={`px-3 py-3 font-semibold ${Number(trade.realized_pnl) >= 0 ? "text-emerald-800" : "text-red-700"}`}>{trade.realized_pnl == null ? "—" : formatMoney(trade.realized_pnl)}</td><td className="px-3 py-3 text-slate-700">{formatReason(trade.reason)}</td><td className="px-3 py-3"><button type="button" aria-label={`${expanded ? "Hide" : "Show"} ${trade.symbol} charges breakdown`} aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : id)} className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button></td></tr>
          {expanded && <tr key={`${id}-details`} className="border-b border-slate-100 bg-slate-50/70"><td colSpan="9" className="px-4 py-3"><div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs text-slate-700 sm:grid-cols-4">{paperOrderCharges(trade).map(([label, value]) => <div key={label} className="flex justify-between gap-2"><span>{label}</span><strong>{formatMoney(value ?? 0)}</strong></div>)}<div className="flex justify-between gap-2"><span>Slippage</span><strong>{trade.slippage != null ? formatMoney(trade.slippage) : "Included in fill price"}</strong></div></div><p className="mt-2 text-[11px] leading-5 text-slate-600">Charge rates are approximate. The backend records slippage in the fill price; it does not return a separate slippage charge.</p></td></tr>}
        </Fragment>;
      })}</tbody></table></div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] text-slate-600">Showing {cursor + 1}–{cursor + page.items.length} of {trades.length} loaded trades (up to 200 recent fills).</p>{page.nextCursor !== null && <Button variant="secondary" size="sm" onClick={() => setCursor(page.nextCursor)}>Load more</Button>}</div>
    </>}
  </GlassCard>;
}
