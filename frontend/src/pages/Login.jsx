import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { Button, GlassCard, PaperModeBadge } from "../components/ui";

export default function LoginPage() {
  const { login } = useAuth();
  return <main className="mx-auto flex min-h-[62vh] max-w-7xl items-center justify-center px-5 py-12 sm:px-8">
    <GlassCard className="entrance w-full max-w-md p-7 sm:p-9">
      <Link to="/" className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-slate-800"><ArrowLeft size={14} aria-hidden="true" />Back to Stockzo</Link>
      <div className="mt-7"><PaperModeBadge /></div>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">Welcome to Stockzo</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Sign in to explore Nifty 50 markets and practice with virtual money.</p>
      <Button size="lg" className="mt-7 w-full" onClick={() => { void login(); }}>{import.meta.env.VITE_USE_MOCK === "true" ? "Continue with demo account" : <><span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-full bg-white text-[13px] font-bold text-blue-600">G</span>Continue with Google</>}</Button>
      <div className="mt-5 flex items-start gap-2 rounded-xl border border-slate-200/80 bg-white/50 p-3.5 text-xs leading-5 text-slate-500"><LockKeyhole size={14} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" /><p>Virtual money only. Educational platform.{import.meta.env.VITE_USE_MOCK === "true" ? " Demo mode uses a fake in-memory account." : " Your session is protected by a secure, httpOnly cookie."}</p></div>
    </GlassCard>
  </main>;
}
