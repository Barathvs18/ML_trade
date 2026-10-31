import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, ChevronRight, CircleHelp, Compass, GraduationCap, LockKeyhole, ShieldCheck, Sparkles, TrendingUp, WalletCards } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getCandles, getQuote } from "../api/market";
import { getPredictionStats } from "../api/predictions";
import { queryKeys } from "../api/queryKeys";
import { useAuth } from "../auth/useAuth";
import { AreaSparkline, CandleChart } from "../components/charts";
import { Badge, Button, EmptyState, ErrorState, ExperimentalBadge, GlassCard, PaperModeBadge, Skeleton, TimeframePills } from "../components/ui";
import { generateSampleCandles, SAMPLE_STOCKS } from "../lib/sampleData";
import { useMarketStatus } from "../hooks/useMarketStatus";

const sampleRanges = {
  "1D": { count: 75, intervalMinutes: 5 },
  "1W": { count: 65, intervalMinutes: 30 },
  "1M": { count: 260, intervalMinutes: 30 },
  "1Y": { count: 250, intervalMinutes: 390 },
  ALL: { count: 500, intervalMinutes: 390 },
};

function formatRupees(value) {
  if (!Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value));
}

function formatIndex(value) {
  if (!Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(value));
}

function MarketStatusPill() {
  const { user } = useAuth();
  const query = useMarketStatus(Boolean(user));
  if (!user) return <Badge kind="neutral"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" />Sample data</Badge>;
  if (query.isLoading) return <Badge kind="neutral">Checking market status</Badge>;
  if (query.isError) return <Badge kind="neutral"><CircleHelp size={13} />Market status unavailable</Badge>;
  return <Badge kind={query.data?.market_open ? "positive" : "neutral"}><span className={`h-1.5 w-1.5 rounded-full ${query.data?.market_open ? "bg-emerald-500" : "bg-slate-400"}`} />NSE market {query.data?.market_open ? "open" : "closed"}</Badge>;
}

function HeroChart() {
  const [range, setRange] = useState("1D");
  const selected = sampleRanges[range];
  const candles = useMemo(() => generateSampleCandles({ count: selected.count, seed: 7001, startPrice: 24180, intervalMinutes: selected.intervalMinutes }), [selected.count, selected.intervalMinutes]);
  const latest = candles.at(-1);
  return <GlassCard className="hero-chart-card p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3 px-1 pb-2">
      <div><div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-900">NIFTY 50</p><Badge kind="neutral" className="!px-2 !py-0.5">Index preview</Badge></div><p className="mt-1 text-xs text-slate-500">Illustrative market view</p></div>
      <Badge kind="neutral">Sample data</Badge>
    </div>
    <div className="flex flex-wrap items-end justify-between gap-3 px-1 pb-3">
      <div><p className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.8rem]">{formatIndex(latest?.close)}</p><p className="mt-1 text-[11px] text-slate-500">Synthetic index points for interface preview</p></div>
      <TimeframePills value={range} onChange={setRange} className="!gap-0.5" />
    </div>
    <CandleChart candles={candles} height={320} />
  </GlassCard>;
}

function Hero() {
  const { login } = useAuth();
  return <section className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-9 px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:pt-24">
    <div className="entrance min-w-0 max-w-xl">
      <div className="flex flex-wrap items-center gap-2"><PaperModeBadge /><MarketStatusPill /></div>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Learn the market, at your pace</p>
      <h1 className="mt-4 text-[2.25rem] font-semibold leading-[1.04] tracking-[-0.055em] text-slate-900 sm:text-6xl">Smarter Trading.<br /><span className="text-emerald-500">Brighter Tomorrow.</span></h1>
      <p className="mt-5 max-w-lg text-[15px] leading-7 text-slate-600 sm:text-base">Explore Indian markets, learn from experimental model estimates, and practice your decisions with virtual money.</p>
      <div className="mt-7 flex flex-wrap gap-3"><Button size="lg" onClick={() => { void login(); }}>Start Trading Free <ArrowRight size={17} aria-hidden="true" /></Button><a href="#how-it-works" className="button button--secondary button--lg">See how it works <ChevronRight size={17} aria-hidden="true" /></a></div>
      <p className="mt-5 flex items-center gap-2 text-xs text-slate-500"><LockKeyhole size={14} className="text-emerald-700" aria-hidden="true" />Sign in with Google. Practice with simulated funds.</p>
    </div>
    <div className="relative entrance min-w-0 lg:pl-2"><div className="absolute -inset-5 -z-10 rounded-[42px] bg-gradient-to-br from-emerald-100/50 via-transparent to-slate-200/50 blur-2xl" /><HeroChart /></div>
  </section>;
}

function MarketCard({ stock }) {
  const { user } = useAuth();
  const quote = useQuery({ queryKey: queryKeys.quote(stock.symbol), queryFn: () => getQuote(stock.symbol), enabled: Boolean(user), staleTime: 10_000, refetchInterval: 20_000 });
  const candlesQuery = useQuery({ queryKey: queryKeys.candles(stock.symbol, "5m", 48), queryFn: () => getCandles(stock.symbol, "5m", 48), enabled: Boolean(user), staleTime: 30_000 });
  const sampleCandles = useMemo(() => generateSampleCandles({ count: 48, seed: stock.seed, startPrice: stock.startPrice, intervalMinutes: 5 }), [stock.seed, stock.startPrice]);
  const realCandles = Array.isArray(candlesQuery.data) ? candlesQuery.data : [];
  const useRealSeries = Boolean(user && realCandles.length > 1);
  const sparkline = useRealSeries ? realCandles.map((candle) => ({ time: candle.time ?? candle.t ?? candle.start, value: candle.close ?? candle.c })) : sampleCandles.map(({ time, close }) => ({ time, value: close }));
  const price = user ? quote.data?.ltp : sampleCandles.at(-1)?.close;
  const hasQuote = price !== null && price !== undefined && Number.isFinite(Number(price));
  const dataLabel = user && hasQuote ? "Live quote" : user && useRealSeries ? "Live candles" : "Sample data";
  const lineColor = useRealSeries && realCandles.at(-1)?.close < realCandles[0]?.close ? "#ef4444" : "#10b981";
  return <GlassCard hover className="market-card flex h-full flex-col p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{stock.symbol}</p><p className="mt-1 line-clamp-1 text-xs text-slate-500">{stock.name}</p></div><Badge kind="neutral">{dataLabel}</Badge></div>
    <div className="mt-5 flex items-end justify-between gap-2">{user && quote.isLoading ? <Skeleton className="h-7 w-28" /> : <p className="text-xl font-semibold tracking-tight text-slate-900">{user && !hasQuote ? "—" : formatRupees(price)}</p>}{quote.data?.market_open === false && user && <span className="pb-1 text-[10px] text-slate-400">Last available quote</span>}</div>
    {user && quote.isError && <ErrorState title="Quote unavailable" description="The market quote could not be loaded." className="!px-2 !py-3" />}
    <div className="mt-auto pt-3">{user && candlesQuery.isLoading ? <Skeleton className="h-[70px] w-full" /> : <AreaSparkline data={sparkline} color={lineColor} height={70} />}</div>
    {user && candlesQuery.isError && <ErrorState title="Candles unavailable" description="Showing a clearly labeled sample trend instead." className="!px-2 !py-3" />}
    {user && candlesQuery.isSuccess && !useRealSeries && <EmptyState title="No recent candles" description="The sparkline is sample data until market candles are available." className="!px-2 !py-3" />}
    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400"><span>{useRealSeries ? "Recent 5-minute candles" : "Sample trend"}</span><span aria-hidden="true">↗</span></div>
  </GlassCard>;
}

function MarketOverview() {
  const { user } = useAuth();
  return <section id="markets" className="mx-auto max-w-7xl scroll-mt-28 px-5 py-14 sm:px-8 sm:py-20">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">Market overview</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.1rem]">A closer look at the market</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">Follow a few familiar Nifty 50 names. Quotes use live backend data when you are signed in.</p></div>{!user && <Badge kind="neutral">All charts are sample data</Badge>}</div>
    <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3">{SAMPLE_STOCKS.map((stock) => <MarketCard key={stock.symbol} stock={stock} />)}</div>
  </section>;
}

function HowItWorks() {
  const steps = [
    { icon: Compass, number: "01", title: "Explore stocks", text: "Browse familiar Nifty 50 companies and get to know their market movement." },
    { icon: Sparkles, number: "02", title: "Review estimates", text: "See experimental model estimates and compare them with later outcomes." },
    { icon: WalletCards, number: "03", title: "Practice & learn", text: "Try paper trades with virtual money and reflect on your decisions." },
  ];
  return <section id="how-it-works" className="scroll-mt-28 border-y border-slate-200/60 bg-white/30 px-5 py-16 sm:px-8 sm:py-20">
    <div className="mx-auto max-w-7xl"><div className="mx-auto max-w-xl text-center"><p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">How it works</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.1rem]">A simple place to practice</h2><p className="mt-3 text-sm leading-6 text-slate-600">Build familiarity with a clear, hands-on learning flow.</p></div>
      <div className="relative mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">{steps.map(({ icon: Icon, number, title, text }, index) => <div key={number} className="relative min-w-0"><GlassCard hover className="h-full p-6 sm:p-7"><div className="flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-100 bg-emerald-50/80 text-emerald-700"><Icon size={22} aria-hidden="true" /></span><span className="text-xs font-semibold tracking-[0.12em] text-slate-300">{number}</span></div><h3 className="mt-5 text-lg font-semibold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></GlassCard>{index < steps.length - 1 && <span aria-hidden="true" className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-slate-200 bg-white p-1.5 text-slate-400 md:block"><ArrowRight size={14} /></span>}</div>)}</div>
    </div>
  </section>;
}

function Scorecard() {
  const { user } = useAuth();
  const stats = useQuery({ queryKey: queryKeys.predictionStats, queryFn: getPredictionStats, enabled: Boolean(user), staleTime: 60_000 });
  return <GlassCard className="h-full p-5 sm:p-6">
    <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">Personal scorecard</p><h3 className="mt-1 text-lg font-semibold text-slate-900">Model estimate vs baseline</h3></div><ExperimentalBadge /></div>
    {!user && <p className="mt-5 rounded-xl bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-600">Model accuracy vs baseline: shown after you log in.</p>}
    {user && stats.isLoading && <div className="mt-5 space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>}
    {user && stats.isError && <ErrorState title="Scorecard unavailable" description="Your prediction statistics could not be loaded." className="!px-2 !py-5" />}
    {user && stats.data && [5, 10, 30].every((horizon) => Number(stats.data[String(horizon)]?.count || 0) === 0) && <EmptyState title="No resolved predictions yet" description="Place an experimental prediction to start building your personal scorecard." action={<Link to="/prediction" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">Try a prediction</Link>} className="!px-2 !py-5" />}
    {user && stats.data && [5, 10, 30].some((horizon) => Number(stats.data[String(horizon)]?.count || 0) > 0) && <div className="mt-4 divide-y divide-slate-200/70">{[5, 10, 30].map((horizon) => {
      const item = stats.data[String(horizon)];
      const count = Number(item?.count || 0);
      return <div key={horizon} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold text-slate-800">{horizon} min horizon</p><p className="mt-0.5 text-[11px] text-slate-500">{count ? `${count} resolved predictions` : "No resolved predictions yet"}</p></div>{count ? <div className="text-right"><p className="text-sm font-semibold text-slate-800">{(Number(item.accuracy) * 100).toFixed(1)}% <span className="text-[10px] font-normal text-slate-400">vs</span> {(Number(item.baseline_accuracy) * 100).toFixed(1)}%</p><p className={`mt-0.5 text-[10px] ${item.beats_baseline ? "text-emerald-700" : "text-slate-400"}`}>{item.beats_baseline ? "Above baseline in this sample" : "Not above baseline in this sample"}</p></div> : <span className="text-xs text-slate-400">—</span>}</div>;
    })}</div>}
    <p className="mt-3 text-[11px] leading-5 text-slate-500">Results describe your resolved predictions and are not a guarantee of future performance.</p>
  </GlassCard>;
}

function PredictionPreview() {
  const navigate = useNavigate();
  const candles = useMemo(() => generateSampleCandles({ count: 75, seed: 445, startPrice: 2450, intervalMinutes: 5 }), []);
  const markers = useMemo(() => {
    if (candles.length < 6) return [];
    return [
      { time: candles.at(-18).time, position: "belowBar", color: "#10b981", shape: "arrowUp", text: "UP sample" },
      { time: candles.at(-9).time, position: "aboveBar", color: "#ef4444", shape: "arrowDown", text: "DOWN sample" },
    ];
  }, [candles]);
  return <section id="predictions" className="mx-auto max-w-7xl scroll-mt-28 px-5 py-16 sm:px-8 sm:py-24">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">Predictions</p><h2 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-[2.1rem]">See What the Model Thinks,<br className="hidden sm:block" /> Then Check It.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Explore experimental estimates, then compare them with resolved outcomes over time.</p></div><ExperimentalBadge /></div>
    <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-[0.78fr_1.45fr_0.95fr]">
      <GlassCard className="flex flex-col items-start p-5 sm:p-6"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Sparkles size={21} aria-hidden="true" /></span><h3 className="mt-5 text-lg font-semibold text-slate-900">Try a model estimate</h3><p className="mt-2 text-sm leading-6 text-slate-600">Choose a Nifty 50 stock and a time horizon to see an experimental estimate.</p><Button className="mt-6" onClick={() => navigate("/prediction")}>Try Prediction <ArrowRight size={15} aria-hidden="true" /></Button><p className="mt-4 text-[11px] leading-5 text-slate-500">Educational only, not financial advice.</p></GlassCard>
      <GlassCard className="min-w-0 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2 px-1"><div><h3 className="text-sm font-semibold text-slate-900">Illustrative prediction view</h3><p className="mt-1 text-[11px] text-slate-500">Example markers on synthetic candles</p></div><Badge kind="neutral">Sample data</Badge></div><CandleChart candles={candles} markers={markers} height={280} className="mt-2" /><div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-2 pt-1 text-[11px] text-slate-500"><span className="inline-flex items-center gap-1.5"><ArrowUpRight size={14} className="text-emerald-600" />Example UP estimate</span><span className="inline-flex items-center gap-1.5"><ArrowDownRight size={14} className="text-red-500" />Example DOWN estimate</span></div><p className="px-2 pt-3 text-[11px] leading-5 text-slate-500">Markers are illustrative only. Educational only, not financial advice.</p></GlassCard>
      <Scorecard />
    </div>
  </section>;
}

function WhyChoose() {
  const items = [
    { icon: ShieldCheck, title: "Trusted & secure", body: "Google sign-in and a private session, with no real-money trading." },
    { icon: BarChart3, title: "Explore analytics", body: "Review price movement and compare estimates with observed outcomes." },
    { icon: GraduationCap, title: "Learn by practice", body: "Use a paper portfolio to understand the mechanics of a trade." },
    { icon: TrendingUp, title: "Easy to explore", body: "A clear workspace designed to make market data more approachable." },
  ];
  return <section className="border-y border-slate-200/60 bg-white/30 px-5 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-7xl"><div className="max-w-xl"><p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">Why Stockzo</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.1rem]">A thoughtful way to learn</h2><p className="mt-3 text-sm leading-6 text-slate-600">Explore market concepts with a practice-first experience.</p></div><div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{items.map(({ icon: Icon, title, body }) => <GlassCard key={title} hover className="p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon size={19} aria-hidden="true" /></span><h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-600">{body}</p></GlassCard>)}</div></div></section>;
}

function FinalCta() {
  const { login } = useAuth();
  return <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20"><div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-emerald-600 via-emerald-700 to-slate-900 px-6 py-10 text-white shadow-[0_22px_60px_rgba(15,23,42,0.16)] sm:px-10 sm:py-12"><div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10 bg-white/5" aria-hidden="true" /><div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">A little practice goes a long way</p><h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Start Your Trading Journey Today.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/90">Learn market basics in a simulated environment with virtual money.</p></div><Button variant="secondary" size="lg" onClick={() => { void login(); }} className="!border-white/25 !bg-white !text-slate-900 hover:!bg-emerald-50">Get Started Free <ArrowRight size={16} aria-hidden="true" /></Button></div></div></section>;
}

export default function LandingPage() {
  return <main><Hero /><MarketOverview /><HowItWorks /><PredictionPreview /><WhyChoose /><FinalCta /></main>;
}
