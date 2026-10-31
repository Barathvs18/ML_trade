import { ArrowLeft, ArrowRight, BarChart3, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, ExperimentalBadge, GlassCard, PaperModeBadge } from "../components/ui";

export function ComingSoonPage({ title, description, icon: Icon = BarChart3 }) {
  return <main className="mx-auto min-h-[66vh] max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
    <GlassCard className="entrance mx-auto max-w-3xl p-7 sm:p-11">
      <div className="flex flex-wrap items-center gap-2"><PaperModeBadge /><ExperimentalBadge /></div>
      <span className="mt-10 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon size={26} aria-hidden="true" /></span>
      <p className="mt-7 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">Stockzo learning workspace</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">{description}</p>
      <div className="mt-8 flex flex-wrap gap-3"><Badge kind="neutral"><LockKeyhole size={13} aria-hidden="true" />Private to your account</Badge><span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">Coming in the next step</span></div>
      <p className="mt-5 text-xs leading-5 text-slate-500">Educational only, not financial advice. All trading is simulated with virtual money.</p>
      <Link to="/" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-emerald-700"><ArrowLeft size={15} aria-hidden="true" />Back to Stockzo</Link>
    </GlassCard>
  </main>;
}

export function NotFoundPage() {
  return <main className="mx-auto flex min-h-[65vh] max-w-7xl items-center justify-center px-5 py-12 sm:px-8"><GlassCard className="w-full max-w-xl p-8 text-center sm:p-11"><p className="text-sm font-semibold text-emerald-700">404 · Page not found</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">This page has moved.</h1><p className="mt-3 text-sm leading-6 text-slate-600">Head back to the Stockzo home page to continue exploring.</p><Link to="/" className="button button--primary mt-6">Go home <ArrowRight size={16} aria-hidden="true" /></Link></GlassCard></main>;
}

export function SimpleInfoPage({ title }) {
  const copy = {
    "About Stockzo": { intro: "Stockzo is an educational workspace for exploring Nifty 50 market data, experimental model estimates, and simulated order flows.", detail: "All orders use virtual money. Predictions are model estimates that can be wrong; they are not recommendations or financial advice." },
    Privacy: { intro: "The service stores the Google profile name, email address, and picture provided at sign-in, along with paper-trading activity and prediction requests and results.", detail: "The backend uses an httpOnly session cookie for sign-in. No data retention period is stated here; storage and account controls are handled by the service backend." },
    Terms: { intro: "Stockzo is for education and practice. Market information and model estimates may be delayed, incomplete, or incorrect.", detail: "Paper trades are simulated and never sent to a broker. Nothing on Stockzo is financial advice, a promise of performance, or an instruction to trade." },
    Contact: { intro: "There is no public support email configured for Stockzo at this time.", detail: "For project questions or to report an issue, use the project’s GitHub issue tracker." },
  }[title] ?? { intro: "Stockzo is an educational platform using virtual money only.", detail: "Model estimates are experimental and are not financial advice." };
  return <main className="mx-auto min-h-[55vh] max-w-7xl px-5 py-14 sm:px-8"><GlassCard className="mx-auto max-w-3xl p-8 sm:p-10"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">Stockzo information</p><h1 className="mt-3 text-3xl font-semibold text-slate-900">{title}</h1><p className="mt-4 text-sm leading-6 text-slate-700">{copy.intro}</p><p className="mt-4 text-sm leading-6 text-slate-700">{copy.detail}{title === "Contact" && <> <a className="font-semibold text-emerald-800 underline" href="https://github.com/Barathvs18/ML_trade/issues">Open the project issue tracker</a>.</>}</p><p className="mt-5 text-xs text-slate-600">Educational only, not financial advice. All trading is simulated with virtual money.</p><Link to="/" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">Return home <ArrowRight size={15} aria-hidden="true" /></Link></GlassCard></main>;
}
