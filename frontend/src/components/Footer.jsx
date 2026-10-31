import { Github, Instagram, Linkedin, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

function Brand() {
  return <Link to="/" className="inline-flex items-center gap-2" aria-label="Stockzo home"><span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-900 text-white"><TrendingUp size={16} aria-hidden="true" /></span><span className="text-lg font-bold tracking-tight text-slate-900">stockzo<span className="text-emerald-500">.</span></span></Link>;
}

export default function Footer() {
  return <footer className="relative z-10 mt-16 border-t border-slate-200/70 bg-white/35 px-5 pb-8 pt-10 sm:px-8">
    <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.3fr_1fr_1fr]">
      <div><Brand /><p className="mt-3 text-sm text-slate-500">Trade. Predict. Grow.</p><p className="mt-5 max-w-md text-xs leading-5 text-slate-500">Educational only, not financial advice. All trading is simulated with virtual money.</p></div>
      <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Explore</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600"><Link to="/#how-it-works" className="hover:text-emerald-700">About</Link><Link to="/privacy-policy" className="hover:text-emerald-700">Privacy Policy</Link><Link to="/terms-and-conditions" className="hover:text-emerald-700">Terms &amp; Conditions</Link><Link to="/contact" className="hover:text-emerald-700">Contact</Link></div></div>
      <div className="md:justify-self-end"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Follow along</p><div className="mt-3 flex gap-2"><a href="https://github.com" aria-label="GitHub" className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white/70 text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"><Github size={17} /></a><a href="https://www.linkedin.com" aria-label="LinkedIn" className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white/70 text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"><Linkedin size={17} /></a><a href="https://www.instagram.com" aria-label="Instagram" className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white/70 text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"><Instagram size={17} /></a></div></div>
    </div>
    <div className="mx-auto mt-8 max-w-7xl border-t border-slate-200/70 pt-5 text-xs text-slate-400">© {new Date().getFullYear()} Stockzo. Learn markets with virtual money.</div>
  </footer>;
}
