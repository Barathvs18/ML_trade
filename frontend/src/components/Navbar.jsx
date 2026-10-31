import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronDown, LogOut, Menu, Search, TrendingUp, X } from "lucide-react";
import { isMockMode } from "../api/client";
import { getStocks } from "../api/market";
import { queryKeys } from "../api/queryKeys";
import { useAuth } from "../auth/useAuth";
import { Badge, Button, PaperModeBadge, Skeleton } from "./ui";

function Brand({ onClick }) {
  return <Link to="/" onClick={onClick} aria-label="Stockzo home" className="flex shrink-0 items-center gap-2.5">
    <span className="grid h-9 w-9 place-items-center rounded-[14px] bg-slate-900 text-white shadow-sm"><TrendingUp size={19} strokeWidth={2.2} aria-hidden="true" /></span>
    <span className="text-[1.2rem] font-bold tracking-[-0.05em] text-slate-900">stockzo<span className="text-emerald-500">.</span></span>
  </Link>;
}

export default function Navbar() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const stockQuery = useQuery({
    queryKey: queryKeys.stocks(search.trim()),
    queryFn: () => getStocks(search.trim()),
    enabled: Boolean(user && search.trim()),
    staleTime: 60_000,
  });
  const stocks = Array.isArray(stockQuery.data) ? stockQuery.data.slice(0, 6) : [];

  const signIn = () => { void login(); };
  const closeMenu = () => setMobileOpen(false);
  const handleLogout = async () => {
    try {
      await logout();
      setProfileOpen(false);
      navigate("/", { replace: true });
    } catch {
      setProfileOpen(false);
      navigate("/", { replace: true });
    }
  };
  const navLinks = [
    { label: "Markets", href: "/#markets" },
    { label: "Predictions", href: "/prediction" },
    { label: "Paper Trading", href: "/paper-trading" },
    { label: "About", href: "/#how-it-works" },
  ];

  return <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
    <nav aria-label="Main navigation" className="glass-card mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <Brand onClick={closeMenu} />
      <div className="hidden items-center gap-5 lg:flex">
        {navLinks.map((item) => item.href.startsWith("/") && !item.href.startsWith("/#")
          ? <Link key={item.label} className="text-[13px] font-medium text-slate-600 transition hover:text-slate-950" to={item.href}>{item.label}</Link>
          : <a key={item.label} className="text-[13px] font-medium text-slate-600 transition hover:text-slate-950" href={item.href}>{item.label}</a>)}
      </div>
      <div className="hidden flex-1 justify-center px-2 xl:flex">
        {user && <div className="relative w-full max-w-[270px]">
          <label className="flex h-10 items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 text-slate-400 focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-100">
            <Search size={16} aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Nifty 50" aria-label="Search Nifty 50 stocks" className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400" />
            {search && <button type="button" aria-label="Clear stock search" className="text-xs text-slate-400 hover:text-slate-700" onClick={() => setSearch("")}>×</button>}
          </label>
          {search && <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl">
            {stockQuery.isLoading && <div className="space-y-2 p-3"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-4/5" /></div>}
            {stockQuery.isError && <p className="px-3 py-3 text-xs text-slate-500">Stocks could not be loaded right now.</p>}
            {!stockQuery.isLoading && !stockQuery.isError && stocks.map((stock) => <Link key={stock.symbol} to={`/dashboard?symbol=${encodeURIComponent(stock.symbol)}`} onClick={() => setSearch("")} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-emerald-50/70">
              <span><span className="block text-xs font-semibold text-slate-800">{stock.symbol}</span><span className="block truncate text-[11px] text-slate-500">{stock.name}</span></span><ArrowUpRight size={14} className="text-slate-400" aria-hidden="true" />
            </Link>)}
            {!stockQuery.isLoading && !stockQuery.isError && stocks.length === 0 && <p className="px-3 py-3 text-xs text-slate-500">No matching Nifty 50 stocks.</p>}
          </div>}
        </div>}
      </div>
      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        {isMockMode && <Badge kind="neutral">Mock data</Badge>}
        {!user ? <>
          <Button variant="ghost" onClick={signIn} className="!px-3">Log in</Button>
          <Button size="sm" onClick={signIn}>Get Started <ArrowUpRight size={15} aria-hidden="true" /></Button>
        </> : <div className="relative flex items-center gap-2">
          <PaperModeBadge />
          <button type="button" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} aria-label="Open account menu" className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 py-1 pl-1 pr-2 text-left hover:border-emerald-300">
            {user.picture ? <img src={user.picture} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">{(user.name || user.email || "S").slice(0, 1).toUpperCase()}</span>}
            <span className="hidden max-w-24 truncate text-xs font-medium text-slate-700 xl:block">{user.name || user.email}</span><ChevronDown size={14} className="text-slate-400" aria-hidden="true" />
          </button>
          {profileOpen && <div className="absolute right-0 top-12 z-50 min-w-48 rounded-2xl border border-white/80 bg-white/95 p-2 shadow-xl backdrop-blur-xl">
            <p className="truncate px-3 py-2 text-xs text-slate-500">{user.email}</p>
            <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"><LogOut size={15} aria-hidden="true" />Log out</button>
          </div>}
        </div>}
      </div>
      <div className="ml-auto flex items-center gap-2 sm:hidden">
        {isMockMode && <Badge kind="neutral">Mock data</Badge>}
        <button type="button" onClick={() => setMobileOpen((open) => !open)} aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileOpen} className="grid h-10 w-10 place-items-center rounded-full text-slate-700 hover:bg-white/80">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </nav>
    {mobileOpen && <div className="glass-card mx-auto mt-2 max-w-7xl space-y-2 p-4 sm:hidden">
      {isMockMode && <div className="mb-2"><Badge kind="neutral">Mock data</Badge></div>}
      {user && <div className="mb-2">
        <label className="flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 text-slate-400"><Search size={16} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Nifty 50" aria-label="Search Nifty 50 stocks" className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none" /></label>
        {search && <div className="mt-1 rounded-xl bg-white p-1">{stocks.map((stock) => <Link key={stock.symbol} to={`/dashboard?symbol=${encodeURIComponent(stock.symbol)}`} onClick={closeMenu} className="block rounded-lg px-3 py-2 text-sm hover:bg-emerald-50"><b>{stock.symbol}</b><span className="ml-2 text-slate-500">{stock.name}</span></Link>)}</div>}
      </div>}
      {navLinks.map((item) => item.href.startsWith("/") && !item.href.startsWith("/#")
        ? <Link key={item.label} to={item.href} onClick={closeMenu} className="block rounded-xl px-3 py-3 text-sm font-medium text-slate-700 hover:bg-white/80">{item.label}</Link>
        : <a key={item.label} href={item.href} onClick={closeMenu} className="block rounded-xl px-3 py-3 text-sm font-medium text-slate-700 hover:bg-white/80">{item.label}</a>)}
      <div className="border-t border-slate-200/70 pt-3">
        {user ? <div className="flex items-center justify-between px-2"><Badge kind="neutral" className="max-w-[65%] truncate">{user.name || user.email}</Badge><Button variant="ghost" size="sm" onClick={handleLogout}><LogOut size={15} />Log out</Button></div> : <div className="flex gap-2"><Button variant="secondary" className="flex-1" onClick={signIn}>Log in</Button><Button className="flex-1" onClick={signIn}>Get Started</Button></div>}
      </div>
    </div>}
  </header>;
}
