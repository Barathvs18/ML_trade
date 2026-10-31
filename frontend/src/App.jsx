import { ArrowRight, TrendingUp } from "lucide-react";
import { Badge, Button, GlassCard, PaperModeBadge } from "./components/ui";

export default function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-5 py-12 sm:px-8">
      <GlassCard className="entrance w-full max-w-2xl p-7 sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white"><TrendingUp size={20} aria-hidden="true" /></span>
            <span className="text-xl font-bold tracking-tight text-slate-900">Stockzo</span>
          </div>
          <PaperModeBadge />
        </div>
        <Badge kind="positive" className="mt-10">A brighter way to learn markets</Badge>
        <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.04em] text-slate-900 sm:text-5xl">
          Trade. Predict.<br /><span className="text-emerald-500">Grow.</span>
        </h1>
        <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">A calm, considered space to explore stocks, learn from experimental model estimates, and practice with virtual money.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button>Explore Stockzo <ArrowRight size={16} aria-hidden="true" /></Button>
          <Button variant="secondary">See how it works</Button>
        </div>
        <p className="mt-8 text-xs leading-5 text-slate-500">Educational only, not financial advice. All trading is simulated with virtual money.</p>
      </GlassCard>
    </main>
  );
}
