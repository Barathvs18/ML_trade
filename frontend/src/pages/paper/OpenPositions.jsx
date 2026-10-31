import { useState } from "react";
import { Link } from "react-router-dom";
import { useLivePrices } from "../../hooks/useLivePrices";
import { Badge, Button, EmptyState, GlassCard, Modal } from "../../components/ui";
import { formatIstDateTime, formatMoney } from "../dashboard/utils";
import HelpHint from "./HelpHint";

export default function OpenPositions({ positions = [], loading, error, onRetry, onClose, onPaperExit, closingSymbol }) {
  const [selected, setSelected] = useState(null);
  const symbols = positions.map((position) => position.symbol);
  const { prices } = useLivePrices(symbols, { includePrices: true, throttleMs: 1000, onMessage: (message) => { if (message.type === "paper_exit") onPaperExit?.(message); } });
  const closeSelected = async () => { if (selected) { await onClose(selected.symbol); setSelected(null); } };

  return <GlassCard className="p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Intraday only</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Open positions <HelpHint label="Open positions" text="Positions that are still active in your virtual paper account." /></h2></div><Badge kind="neutral">{positions.length} open</Badge></div>
    {loading && <div className="mt-4 space-y-2" aria-label="Loading open positions"><div className="skeleton h-10 w-full" /><div className="skeleton h-10 w-full" /></div>}
    {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">Open positions could not be loaded. <button className="font-semibold underline" onClick={onRetry}>Retry</button></div>}
    {!loading && !error && positions.length === 0 && <EmptyState title="No open positions" description="Try a simulated order or explore an experimental estimate." action={<Link to="/prediction" className="text-sm font-semibold text-emerald-800 underline">Go to predictions</Link>} className="!py-8" />}
    {!loading && !error && positions.length > 0 && <div className="mt-4 overflow-x-auto">
      <p className="mb-2 text-[11px] text-slate-600 sm:hidden">Swipe horizontally to see all position details.</p>
      <table aria-label="Open paper trading positions" className="w-full min-w-[1060px] border-collapse text-left text-xs">
        <thead><tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500"><th scope="col" className="px-3 py-3">Symbol</th><th scope="col" className="px-3 py-3">Side</th><th scope="col" className="px-3 py-3">Qty</th><th scope="col" className="px-3 py-3">Average</th><th scope="col" className="px-3 py-3">Live price</th><th scope="col" className="px-3 py-3">Unrealized P&amp;L</th><th scope="col" className="px-3 py-3">Stop / Target</th><th scope="col" className="px-3 py-3">Opened (IST)</th><th scope="col" className="px-3 py-3">Estimate</th><th scope="col" className="px-3 py-3">Action</th></tr></thead>
        <tbody>{positions.map((position) => {
          const price = Number(prices[position.symbol]?.ltp ?? position.ltp ?? position.avg_price);
          const sign = position.side === "LONG" ? 1 : -1;
          const pnl = (price - Number(position.avg_price)) * Number(position.qty) * sign;
          const pnlPct = Number(position.avg_price) ? ((price - Number(position.avg_price)) / Number(position.avg_price)) * 100 * sign : 0;
          return <tr key={`${position.user_id}-${position.symbol}`} className="border-b border-slate-100/90 align-middle">
            <td className="px-3 py-3 font-semibold text-slate-900">{position.symbol}</td><td className="px-3 py-3"><Badge kind={position.side === "LONG" ? "positive" : "negative"}>{position.side === "LONG" ? "Long" : "Short"}</Badge></td><td className="px-3 py-3 text-slate-700">{position.qty}</td><td className="px-3 py-3 text-slate-700">{formatMoney(position.avg_price)}</td><td className="px-3 py-3 font-medium text-slate-900">{formatMoney(price)}</td><td className={`px-3 py-3 font-semibold ${pnl >= 0 ? "text-emerald-800" : "text-red-700"}`}>{pnl >= 0 ? "+" : ""}{formatMoney(pnl)} <span className="font-normal">({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)</span></td><td className="px-3 py-3 text-slate-700">{position.stop_loss ? formatMoney(position.stop_loss) : "—"} / {position.target ? formatMoney(position.target) : "—"}</td><td className="px-3 py-3 text-slate-600">{position.opened_at ? formatIstDateTime(position.opened_at) : "—"}</td><td className="px-3 py-3">{position.prediction_id ? <Link className="font-semibold text-emerald-800 underline" to={`/prediction?prediction_id=${encodeURIComponent(position.prediction_id)}`}>View</Link> : <span className="text-slate-500">—</span>}</td><td className="px-3 py-3"><Button size="sm" variant="secondary" aria-label={`Close ${position.symbol} position`} disabled={Boolean(closingSymbol)} onClick={() => setSelected(position)}>{closingSymbol === position.symbol ? "Closing…" : "Close"}</Button></td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
    <p className="mt-3 text-[11px] leading-5 text-slate-600">Unrealized P&amp;L changes with available prices and is not a realized result. <HelpHint label="Unrealized P&L" text="A live estimate on positions still open. It can change until the position is closed." /> Long positions benefit from a price rise; short positions benefit from a price fall. <HelpHint label="Long and short" text="Long means you expect a rise; short means you expect a fall. Both are simulated." /></p>
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Close virtual position">
      <p className="text-sm leading-6 text-slate-700">Close the {selected?.side === "LONG" ? "long" : "short"} {selected?.symbol} position of {selected?.qty} shares at the current available price? Charges and slippage apply.</p>
      <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setSelected(null)}>Keep position</Button><Button onClick={() => void closeSelected()} disabled={Boolean(closingSymbol)}>Confirm close</Button></div>
    </Modal>
  </GlassCard>;
}
