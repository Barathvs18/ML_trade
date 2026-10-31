import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Clock3, WalletCards } from "lucide-react";
import { getDashboardSummary } from "../api/dashboard";
import { getQuote, getStocks } from "../api/market";
import { closePosition, getPaperPnl, getPaperWallet, getPositions, getTrades, placeOrder, resetPaperAccount } from "../api/paper";
import { getPrediction } from "../api/predictions";
import { queryKeys } from "../api/queryKeys";
import { useMarketStatus } from "../hooks/useMarketStatus";
import { Badge, ErrorState, Toast } from "../components/ui";
import { formatMoney, formatPercent } from "./dashboard/utils";
import EquityCurveCard from "./dashboard/EquityCurveCard";
import { marketOpenLabel } from "./prediction/utils";
import HelpHint from "./paper/HelpHint";
import LivePnlStats from "./paper/LivePnlStats";
import OpenPositions from "./paper/OpenPositions";
import OrderTicket from "./paper/OrderTicket";
import PerformanceCard from "./paper/PerformanceCard";
import ResetAccountCard from "./paper/ResetAccountCard";
import TradeHistory from "./paper/TradeHistory";
import { isSquareoffSoon, mapPaperOrderError } from "./paper/utils";

function marketReason(market) {
  if (market.isLoading) return "Checking market hours…";
  if (market.isError) return "Market status is unavailable, so orders are disabled.";
  return marketOpenLabel(market.data?.next_market_open);
}

function refreshPaper(client) {
  return Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.wallet }), client.invalidateQueries({ queryKey: queryKeys.positions }),
    client.invalidateQueries({ queryKey: queryKeys.trades(200) }), client.invalidateQueries({ queryKey: queryKeys.paperPnl }),
    client.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
  ]);
}

export default function PaperTradingPage() {
  const client = useQueryClient();
  const [searchParams] = useSearchParams();
  const predictionId = searchParams.get("prediction_id") || "";
  const [symbol, setSymbol] = useState("RELIANCE");
  const [clock, setClock] = useState(() => Date.now());
  const [notice, setNotice] = useState(null);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30_000); return () => clearInterval(timer); }, []);

  const walletQuery = useQuery({ queryKey: queryKeys.wallet, queryFn: getPaperWallet, staleTime: 5_000, refetchInterval: 15_000, retry: 1 });
  const positionsQuery = useQuery({ queryKey: queryKeys.positions, queryFn: getPositions, staleTime: 5_000, refetchInterval: 15_000, retry: 1 });
  const tradesQuery = useQuery({ queryKey: queryKeys.trades(200), queryFn: () => getTrades(200), staleTime: 10_000, retry: 1 });
  const pnlQuery = useQuery({ queryKey: queryKeys.paperPnl, queryFn: getPaperPnl, staleTime: 5_000, refetchInterval: 15_000, retry: 1 });
  const dashboardQuery = useQuery({ queryKey: queryKeys.dashboardSummary, queryFn: getDashboardSummary, staleTime: 15_000, retry: 1 });
  const stocksQuery = useQuery({ queryKey: queryKeys.stocks(""), queryFn: () => getStocks(""), staleTime: 5 * 60_000, retry: 1 });
  const quoteQuery = useQuery({ queryKey: queryKeys.quote(symbol), queryFn: () => getQuote(symbol), staleTime: 5_000, refetchInterval: 15_000, retry: 1 });
  const market = useMarketStatus();
  const linkedPredictionQuery = useQuery({ queryKey: queryKeys.predictionDetail(predictionId), queryFn: () => getPrediction(predictionId), enabled: Boolean(predictionId), staleTime: 5_000, refetchInterval: (query) => query.state.data?.status === "pending" ? 3_000 : false, retry: 1 });
  const linkedPrediction = linkedPredictionQuery.data;
  useEffect(() => { if (linkedPrediction?.symbol) setSymbol(linkedPrediction.symbol); }, [linkedPrediction?.symbol]);

  const positions = positionsQuery.data?.positions ?? [];
  const trades = tradesQuery.data ?? [];
  const stocks = useMemo(() => stocksQuery.data ?? [], [stocksQuery.data]);
  const isOpen = market.data?.market_open === true && !market.isError;
  const reason = marketReason(market);
  const linkedExpired = Boolean(predictionId && (!linkedPrediction || linkedPrediction.status !== "pending" || Date.now() >= new Date(linkedPrediction.resolve_at).getTime()));
  const linkedProblem = predictionId && linkedPredictionQuery.isError ? "The linked estimate could not be loaded. Reload it before placing a linked order." : linkedExpired ? "This estimate has resolved or its outcome is unavailable. Linked orders are only available while it is pending." : "";
  const stockIsValid = useMemo(() => stocks.some((stock) => stock.symbol === symbol), [stocks, symbol]);
  const marketOpenReason = !isOpen ? reason : linkedProblem;

  const orderMutation = useMutation({ mutationFn: placeOrder, onSuccess: async (response) => {
    const fill = response?.trade ?? response;
    await refreshPaper(client);
    setNotice({ kind: "success", title: "Virtual order filled", message: `${fill?.side ?? "Order"} ${fill?.qty ?? ""} ${fill?.symbol ?? symbol} at ${formatMoney(fill?.price)}. Charges: ${formatMoney(fill?.charges?.total ?? 0)}.` });
  } });
  const closeMutation = useMutation({ mutationFn: closePosition, onSuccess: async (response, closedSymbol) => {
    await refreshPaper(client);
    const trade = response?.trade ?? response;
    setNotice({ kind: "success", title: "Position closed", message: `${closedSymbol} closed. Realized P&L: ${formatMoney(trade?.realized_pnl ?? response?.realized_pnl ?? 0)}.` });
  }, onError: (error) => setNotice({ kind: "error", title: "Position could not be closed", message: mapPaperOrderError(error) }) });
  const resetMutation = useMutation({ mutationFn: resetPaperAccount, onSuccess: async (result) => {
    await Promise.all([refreshPaper(client), client.invalidateQueries({ queryKey: ["paper"] })]);
    setNotice({ kind: "success", title: "Paper account reset", message: `Balance restored. ${result?.archived_trades ?? 0} trades archived.` });
  }, onError: (error) => setNotice({ kind: "error", title: "Account reset failed", message: mapPaperOrderError(error) }) });

  const wallet = walletQuery.data;
  const pnl = pnlQuery.data;
  const unrealized = Number(pnl?.unrealized ?? positionsQuery.data?.unrealized_total ?? 0);
  const realized = Number(pnl?.realized ?? wallet?.realized_pnl ?? 0);
  const total = Number(pnl?.total ?? realized + unrealized);
  const showSquareoff = isSquareoffSoon(new Date(clock), isOpen);
  const headerError = walletQuery.isError || pnlQuery.isError;

  return <main className="mx-auto min-h-[70vh] max-w-7xl px-5 pb-16 pt-8 sm:px-8 sm:pt-10">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-800">Simulated portfolio</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Paper trading</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">Practice order decisions with virtual funds and review how simulated fills affect your account.</p></div><div className="flex flex-wrap items-center gap-2"><Badge kind="positive"><WalletCards size={14} />Paper mode: virtual money</Badge><Badge kind={isOpen ? "positive" : "neutral"}>{market.isLoading ? "Checking market…" : isOpen ? "Market open" : "Market closed"}</Badge>{!isOpen && market.data?.next_market_open && <span className="text-xs text-slate-600">{marketOpenLabel(market.data.next_market_open)}</span>}</div></div>

    {market.isError && <ErrorState title="Market hours unavailable" description="Order entry stays disabled until market status can be checked." onRetry={() => market.refetch()} className="mb-4 !py-4" />}
    {showSquareoff && <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950" role="status"><Clock3 size={17} className="mt-0.5 shrink-0" /><span>Open positions close automatically at 3:20 PM. <HelpHint label="Square-off" text="Intraday positions are automatically closed at the configured square-off time." /></span></div>}
    {headerError && <ErrorState title="Account summary unavailable" description="Wallet or P&L data could not be loaded." onRetry={() => { walletQuery.refetch(); pnlQuery.refetch(); }} className="mb-4 !py-4" />}

    <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7" aria-label="Paper account summary">
      <div className="rounded-2xl border border-white/75 bg-white/55 p-3.5 shadow-sm sm:p-4"><p className="text-[11px] font-medium text-slate-600">Wallet balance<HelpHint label="Wallet balance" text="Available virtual balance after margin and charges." /></p>{walletQuery.isLoading ? <div className="skeleton mt-2 h-6 w-24" /> : <p className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{formatMoney(wallet?.balance)}</p>}</div>
      <div className="rounded-2xl border border-white/75 bg-white/55 p-3.5 shadow-sm sm:p-4"><p className="text-[11px] font-medium text-slate-600">Blocked margin<HelpHint label="Blocked margin" text="Virtual funds set aside for open positions." /></p>{walletQuery.isLoading ? <div className="skeleton mt-2 h-6 w-24" /> : <p className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{formatMoney(wallet?.blocked_margin)}</p>}</div>
      <LivePnlStats positions={positions} wallet={wallet} realized={realized} fallbackUnrealized={unrealized} total={total} loading={walletQuery.isLoading || pnlQuery.isLoading || positionsQuery.isLoading} />
      <div className="rounded-2xl border border-white/75 bg-white/55 p-3.5 shadow-sm sm:p-4"><p className="text-[11px] font-medium text-slate-600">Realized P&amp;L<HelpHint label="Realized P&L" text="P&L booked when a simulated position is reduced or closed." /></p>{pnlQuery.isLoading ? <div className="skeleton mt-2 h-6 w-24" /> : <p className={`mt-1 text-lg font-semibold tracking-tight ${realized >= 0 ? "text-emerald-800" : "text-red-700"}`}>{formatMoney(realized)}</p>}</div>
      <div className="rounded-2xl border border-white/75 bg-white/55 p-3.5 shadow-sm sm:p-4"><p className="text-[11px] font-medium text-slate-600">Win rate / trades</p>{pnlQuery.isLoading || dashboardQuery.isLoading ? <div className="skeleton mt-2 h-6 w-24" /> : <p className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{formatPercent(Number(pnl?.win_rate ?? 0), 1)} · {dashboardQuery.data?.trade_count ?? trades.length}</p>}</div>
    </section>

    <section className="mt-5 grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" aria-label="Paper order entry and open positions">
      <OrderTicket stocks={stocks} symbol={symbol} symbolValid={stockIsValid} onSymbolChange={setSymbol} initialPrice={quoteQuery.data?.ltp} marketOpen={isOpen && !linkedProblem} marketReason={marketOpenReason} submitting={orderMutation.isPending} error={orderMutation.error ? mapPaperOrderError(orderMutation.error) : ""} onSubmit={(order) => orderMutation.mutateAsync(order)} linkedPrediction={linkedPrediction} />
      <OpenPositions positions={positions} loading={positionsQuery.isLoading} error={positionsQuery.isError} onRetry={() => positionsQuery.refetch()} onClose={(closedSymbol) => closeMutation.mutateAsync(closedSymbol)} onPaperExit={() => refreshPaper(client)} closingSymbol={closeMutation.isPending ? closeMutation.variables : ""} />
    </section>

    <section className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(330px,0.8fr)]" aria-label="Paper trading history and performance">
      <TradeHistory trades={trades} loading={tradesQuery.isLoading} error={tradesQuery.isError} onRetry={() => tradesQuery.refetch()} />
      <PerformanceCard pnl={pnl} trades={trades} loading={pnlQuery.isLoading || tradesQuery.isLoading} error={pnlQuery.isError || tradesQuery.isError} onRetry={() => { pnlQuery.refetch(); tradesQuery.refetch(); }} />
    </section>

    <div className="mt-4"><EquityCurveCard /></div>
    <div className="mt-4"><ResetAccountCard onReset={() => resetMutation.mutateAsync()} resetting={resetMutation.isPending} error={resetMutation.error ? mapPaperOrderError(resetMutation.error) : ""} /></div>
    {notice && <div className="fixed bottom-4 right-4 z-50"><Toast kind={notice.kind} title={notice.title} message={notice.message} onClose={() => setNotice(null)} /></div>}
    <p className="mt-8 text-center text-xs text-slate-600">Educational only, not financial advice. All trading is simulated with virtual money.</p>
    <p className="mt-2 text-center text-[11px] leading-5 text-slate-600">Charges are estimates based on approximate Indian intraday equity rates. Verify rates independently.</p>
  </main>;
}
