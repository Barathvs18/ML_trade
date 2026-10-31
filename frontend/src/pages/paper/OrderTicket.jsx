import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLivePrices } from "../../hooks/useLivePrices";
import { Badge, Button, GlassCard, Modal } from "../../components/ui";
import { formatMoney } from "../dashboard/utils";
import { estimatePaperOrder, validatePaperOrder } from "./utils";
import HelpHint from "./HelpHint";

function money(value) { return formatMoney(Number.isFinite(Number(value)) ? Number(value) : 0); }

export default function OrderTicket({ stocks, symbol, symbolValid, onSymbolChange, initialPrice, marketOpen, marketReason, submitting, error, onSubmit, linkedPrediction }) {
  const [side, setSide] = useState("BUY");
  const [quantity, setQuantity] = useState("1");
  const [stopLoss, setStopLoss] = useState("");
  const [target, setTarget] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  useEffect(() => { setStopLoss(""); setTarget(""); }, [symbol]);
  const { prices, status } = useLivePrices([symbol], { includePrices: true, throttleMs: 1000 });
  const ltp = Number(prices[symbol]?.ltp ?? initialPrice);
  const estimate = estimatePaperOrder({ side, quantity, ltp });
  const validation = validatePaperOrder({ side, quantity, entryPrice: estimate?.estimatedPrice, stopLoss, target });
  const canReview = marketOpen && symbolValid && !submitting && !validation && Boolean(estimate);

  const confirmOrder = async () => {
    try {
      await onSubmit({ symbol, side, qty: Number(quantity), stop_loss: stopLoss === "" ? undefined : Number(stopLoss), target: target === "" ? undefined : Number(target), prediction_id: linkedPrediction?._id });
      setConfirmOpen(false);
    } catch { /* The order error remains visible on the ticket. */ }
  };

  return <GlassCard className="p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Order ticket</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Place a simulated order</h2></div><Badge kind="positive">Virtual money</Badge></div>
    {linkedPrediction && <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/65 p-3 text-xs leading-5 text-indigo-950"><p className="font-semibold">Linked model estimate</p><p>{linkedPrediction.symbol} · {linkedPrediction.horizon} min · {linkedPrediction.direction} · {Math.round(linkedPrediction.probability * 100)}% top probability · {linkedPrediction.status}</p><Link to={`/prediction?prediction_id=${encodeURIComponent(linkedPrediction._id)}`} className="mt-1 inline-flex font-semibold text-indigo-800 underline">View estimate</Link></div>}
    <label className="mt-4 block text-xs font-semibold text-slate-700">Nifty 50 stock
      <input list="paper-stock-list" value={symbol} onChange={(event) => onSymbolChange(event.target.value.toUpperCase())} aria-label="Search Nifty 50 stocks for order" placeholder="Search symbol" className="mt-1.5 block h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
      <datalist id="paper-stock-list">{stocks.map((stock) => <option key={stock.symbol} value={stock.symbol}>{stock.name}</option>)}</datalist>
    </label>
    {!symbolValid && <p className="mt-2 text-xs text-amber-900">Choose a symbol from the Nifty 50 list.</p>}
    <div className="mt-3 flex flex-wrap items-end justify-between gap-2 rounded-xl bg-slate-50/75 px-3 py-2.5"><div><span className="text-xs text-slate-600">Latest available price</span><p className="mt-0.5 text-lg font-semibold text-slate-900">{Number.isFinite(ltp) ? money(ltp) : "Loading price…"}</p></div><Badge kind={status === "connected" || status === "mock" ? "positive" : "neutral"}>{status === "mock" ? "Mock feed" : status === "connected" ? "Live feed" : "Feed idle"}</Badge></div>
    <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Order side">
      <button type="button" aria-pressed={side === "BUY"} onClick={() => setSide("BUY")} className={`h-11 rounded-xl border text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 ${side === "BUY" ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white/65 text-slate-700"}`}>BUY <span className="ml-1 text-xs">(Long)</span></button>
      <button type="button" aria-pressed={side === "SELL"} onClick={() => setSide("SELL")} className={`h-11 rounded-xl border text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600 ${side === "SELL" ? "border-red-300 bg-red-50 text-red-900" : "border-slate-200 bg-white/65 text-slate-700"}`}>SELL <span className="ml-1 text-xs">(Short)</span></button>
    </div>
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label className="text-xs font-semibold text-slate-700">Quantity <HelpHint label="Quantity" text="The number of shares in this virtual order." /><input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-label="Order quantity" className="mt-1.5 block h-10 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /></label>
      <label className="text-xs font-semibold text-slate-700">Stop-loss (optional) <HelpHint label="Stop-loss" text="An exit trigger intended to limit a loss. It is not a guaranteed fill price." /><input type="number" min="0" step="0.05" value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} aria-label="Optional stop-loss price" placeholder="Price" className="mt-1.5 block h-10 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /></label>
      <label className="text-xs font-semibold text-slate-700">Target (optional) <HelpHint label="Target" text="An exit trigger at a chosen price. It is not a guaranteed fill price." /><input type="number" min="0" step="0.05" value={target} onChange={(event) => setTarget(event.target.value)} aria-label="Optional target price" placeholder="Price" className="mt-1.5 block h-10 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /></label>
    </div>
    {validation && <p className="mt-2 text-xs font-medium text-red-700" role="alert">{validation}</p>}
    <div className="mt-4 rounded-xl border border-slate-200/80 bg-white/55 p-3.5 text-xs text-slate-700">
      <div className="flex items-center justify-between gap-3"><span>Estimated required margin <HelpHint label="Margin" text="Virtual funds set aside for the open position. The backend may add order charges." /></span><strong>{estimate ? money(estimate.requiredMargin) : "—"}</strong></div>
      <div className="mt-2 flex items-center justify-between gap-3"><span>Estimated charges</span><strong>{estimate ? money(estimate.totalCharges) : "—"}</strong></div>
      <div className="mt-2 flex items-center justify-between gap-3"><span>Estimated slippage (2 bps)</span><strong>{estimate ? money(estimate.slippageTotal) : "—"}</strong></div>
      <p className="mt-2 leading-5 text-slate-600">Approximate charges; actual fills and charges can differ. Slippage is reflected in the estimated fill price.</p>
    </div>
    {!marketOpen && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-950" role="status">{marketReason || "Market is closed. Orders are disabled."}</p>}
    {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-900" role="alert">{error}</p>}
    <Button className="mt-4 w-full" disabled={!canReview} onClick={() => setConfirmOpen(true)}>{submitting ? "Placing order…" : marketOpen ? "Review order" : "Market closed"}</Button>
    <p className="mt-3 text-[11px] leading-5 text-slate-600">All orders are simulated with virtual money. Educational only, not financial advice.</p>
    <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm virtual paper order">
      <p className="text-sm leading-6 text-slate-700">{side} {quantity} {symbol} at an estimated {money(estimate?.estimatedPrice)} per share. Estimated margin {money(estimate?.requiredMargin)} plus charges {money(estimate?.totalCharges)}.</p>
      <p className="mt-3 text-xs leading-5 text-slate-600">This is a simulated market order. The final fill price and charges can differ from this estimate.</p>
      <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirmOpen(false)}>Go back</Button><Button disabled={!canReview} onClick={() => void confirmOrder()}>Confirm virtual order</Button></div>
    </Modal>
  </GlassCard>;
}
