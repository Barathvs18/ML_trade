import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { placeOrder } from "../../api/paper";
import { queryKeys } from "../../api/queryKeys";
import { Button, ErrorState, Modal } from "../../components/ui";
import { formatMoney } from "../dashboard/utils";
import { estimateIntradayCharges, validateOrderForm } from "./utils";

function tradeErrorMessage(error) {
  const status = error?.response?.status;
  if (status === 409) return "The market closed before the order was accepted. No order was placed.";
  if (status === 400) return "There may not be enough virtual balance for this order, including charges.";
  if (status === 422) return error.response?.data?.error?.message ?? error.response?.data?.detail?.error?.message ?? "Check the order details and price brackets.";
  if (!error?.response) return "Could not reach the paper-trading service. No order was placed.";
  return error.response?.data?.error?.message ?? error.response?.data?.detail?.error?.message ?? "The paper order could not be placed.";
}

export default function PredictionTradePanel({ prediction, currentPrice, marketOpen, onPlaced }) {
  const queryClient = useQueryClient();
  const [side, setSide] = useState(prediction.direction === "UP" ? "BUY" : prediction.direction === "DOWN" ? "SELL" : "");
  const [quantity, setQuantity] = useState("1");
  const [stopLoss, setStopLoss] = useState("");
  const [target, setTarget] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [filledTrade, setFilledTrade] = useState(null);

  useEffect(() => {
    setSide(prediction.direction === "UP" ? "BUY" : prediction.direction === "DOWN" ? "SELL" : "");
    setQuantity("1");
    setStopLoss("");
    setTarget("");
    setFilledTrade(null);
  }, [prediction._id, prediction.direction]);

  const estimatedPrice = Number(currentPrice || prediction.entry_price) * (side === "BUY" ? 1.0002 : side === "SELL" ? 0.9998 : 1);
  const qty = Number(quantity);
  const estimatedMargin = Number.isInteger(qty) && qty > 0 ? qty * estimatedPrice : 0;
  const charges = useMemo(() => estimateIntradayCharges(estimatedMargin, side), [estimatedMargin, side]);
  const validation = validateOrderForm({ side, quantity, entryPrice: estimatedPrice, stopLoss, target });
  const mutation = useMutation({
    mutationFn: placeOrder,
    onSuccess: (result) => {
      const fill = result?.trade ?? result;
      setFilledTrade(fill);
      setConfirmOpen(false);
      onPlaced?.(fill);
      queryClient.invalidateQueries({ queryKey: queryKeys.positions });
      queryClient.invalidateQueries({ queryKey: queryKeys.trades(200) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      queryClient.invalidateQueries({ queryKey: queryKeys.paperPnl });
    },
  });

  const confirmOrder = () => mutation.mutate({
    symbol: prediction.symbol,
    side,
    qty,
    ...(stopLoss ? { stop_loss: Number(stopLoss) } : {}),
    ...(target ? { target: Number(target) } : {}),
    prediction_id: prediction._id,
  });

  return <div className="mt-5 border-t border-slate-200/70 pt-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">Paper trade from this estimate</p><h3 className="mt-1 text-base font-semibold text-slate-900">Place a virtual order</h3></div><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700"><ShieldCheck size={12} /> Virtual money</span></div>
    {prediction.confidence === "low" && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs leading-5 text-amber-900">Low model confidence. Treat this estimate with extra caution.</p>}
    <p className="mt-3 text-xs leading-5 text-slate-600">This order is linked to this prediction and is available only before its outcome is revealed. All fills are simulated.</p>
    {filledTrade ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/55 p-4" role="status">
      <p className="text-sm font-semibold text-emerald-800">Paper order filled</p>
      <p className="mt-1 text-xs text-slate-700">{filledTrade.side} {filledTrade.qty} {prediction.symbol} at {formatMoney(filledTrade.price)}</p>
      <p className="mt-1 text-xs text-slate-600">Charges: {formatMoney(filledTrade.charges?.total ?? 0)} · Virtual funds only.</p>
      <Link className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800" to="/paper-trading">View paper trading <ArrowRight size={13} /></Link>
    </div> : <>
      <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Paper order side">
        {[{ value: "BUY", label: "BUY · Long" }, { value: "SELL", label: "SELL · Short" }].map((option) => <button key={option.value} type="button" aria-pressed={side === option.value} onClick={() => setSide(option.value)} className={`min-h-10 rounded-xl border px-3 text-xs font-semibold transition ${side === option.value ? option.value === "BUY" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-white/60 text-slate-600 hover:bg-white"}`}>{option.label}</button>)}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-[11px] font-medium text-slate-500">Quantity<input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-label="Paper order quantity" className="mt-1 block h-10 w-full rounded-xl border border-slate-200 bg-white/75 px-3 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" /></label>
        <label className="text-[11px] font-medium text-slate-500">Stop-loss (optional)<input type="number" min="0" step="0.01" value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} aria-label="Optional stop-loss price" placeholder="Price" className="mt-1 block h-10 w-full rounded-xl border border-slate-200 bg-white/75 px-3 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" /></label>
        <label className="text-[11px] font-medium text-slate-500">Target (optional)<input type="number" min="0" step="0.01" value={target} onChange={(event) => setTarget(event.target.value)} aria-label="Optional target price" placeholder="Price" className="mt-1 block h-10 w-full rounded-xl border border-slate-200 bg-white/75 px-3 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100" /></label>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-200/70 bg-white/45 p-3 text-xs"><p className="text-slate-500">Estimated margin <b className="ml-1 text-slate-800">{formatMoney(estimatedMargin)}</b></p><p className="text-right text-slate-500">Estimated charges <b className="ml-1 text-slate-800">{formatMoney(charges.total)}</b></p><p className="col-span-2 text-[10px] leading-4 text-slate-400">Estimate uses 2 bps slippage and approximate intraday charges; actual paper fill and configured rates may differ.</p></div>
      {validation && <p className="mt-2 text-xs text-red-700" role="alert">{validation}</p>}
      {!marketOpen && <p className="mt-2 text-xs text-amber-800">Paper orders are disabled while the market is closed.</p>}
      {mutation.isError && <ErrorState title="Order not placed" description={tradeErrorMessage(mutation.error)} className="!py-4" />}
      <Button className="mt-3 w-full" disabled={!marketOpen || Boolean(validation) || mutation.isPending} onClick={() => setConfirmOpen(true)}>{mutation.isPending ? "Placing order…" : "Review paper trade"}</Button>
    </>}
    <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm virtual paper order">
      <p className="text-sm leading-6 text-slate-600">{side} {qty} {prediction.symbol} at an estimated {formatMoney(estimatedPrice)} per share. Estimated margin is {formatMoney(estimatedMargin)} plus {formatMoney(charges.total)} in charges.</p>
      <p className="mt-3 rounded-xl bg-emerald-50/70 p-3 text-xs leading-5 text-emerald-900">Virtual money only. This order is linked to prediction {prediction._id} and is not sent to a broker.</p>
      <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button><Button disabled={mutation.isPending} onClick={confirmOrder}>{mutation.isPending ? "Placing…" : "Confirm paper order"}</Button></div>
    </Modal>
  </div>;
}
