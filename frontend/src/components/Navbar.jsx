import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, LogOut, Menu, TrendingUp, X } from "lucide-react";
import { isMockMode } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { Badge, Button, PaperModeBadge } from "./ui";

function Brand({ onClick }) {
  return (
    <Link to="/" onClick={onClick} aria-label="Stockzo home" className="flex shrink-0 items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-[14px] bg-slate-900 text-white shadow-sm">
        <TrendingUp size={19} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="text-[1.2rem] font-bold tracking-[-0.05em] text-slate-900">
        stockzo<span className="text-emerald-500">.</span>
      </span>
    </Link>
  );
}

export default function Navbar() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const signIn = () => { void login(); };
  const closeMenu = () => setMobileOpen(false);
  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // AuthProvider clears local auth state even if the server is unavailable.
    } finally {
      setMobileOpen(false);
      navigate("/", { replace: true });
    }
  };

  const navLinks = [
    { label: "Markets", href: "/#markets" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Predictions", href: "/prediction" },
    { label: "Paper Trading", href: "/paper-trading" },
    { label: "About", href: "/#how-it-works" },
  ];

  const isActive = (href) =>
    href.startsWith("/#")
      ? location.pathname === "/" && location.hash === href.slice(1)
      : location.pathname === href;

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
      <nav aria-label="Main navigation" className="glass-card mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-5">

        {/* Brand */}
        <Brand onClick={closeMenu} />

        {/* Desktop nav links */}
        <div className="hidden items-center gap-1 xl:flex">
          {navLinks.map((item) =>
            item.href.startsWith("/") && !item.href.startsWith("/#") ? (
              <Link
                key={item.label}
                to={item.href}
                className={`rounded-full px-3 py-2 text-[13px] font-medium transition ${
                  isActive(item.href) ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
                }`}
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                className={`rounded-full px-3 py-2 text-[13px] font-medium transition ${
                  isActive(item.href) ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
                }`}
              >
                {item.label}
              </a>
            )
          )}
        </div>

        {/* Right side */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {isMockMode && <span className="hidden sm:inline-flex"><Badge kind="neutral">Mock data</Badge></span>}

          {!user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="ghost" onClick={signIn} className="!px-3">Log in</Button>
              <Button size="sm" onClick={signIn}>Get Started <ArrowUpRight size={15} aria-hidden="true" /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Paper mode badge */}
              <span className="hidden sm:inline-flex"><PaperModeBadge /></span>

              {/* Avatar + name pill */}
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 py-1 pl-1 pr-3">
                {user.picture ? (
                  <img src={user.picture} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">
                    {(user.name || user.email || "S").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden max-w-28 truncate text-xs font-medium text-slate-700 md:inline">
                  {user.name || user.email}
                </span>
              </div>

              {/* Log out button — desktop only */}
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Log out"
                className="hidden sm:flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 hover:border-red-300 active:bg-red-200"
              >
                <LogOut size={13} aria-hidden="true" />
                Log out
              </button>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-2 xl:hidden">
          {isMockMode && <Badge kind="neutral">Mock data</Badge>}
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            className="grid h-10 w-10 place-items-center rounded-full text-slate-700 hover:bg-white/80"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="glass-card mx-auto mt-2 max-w-7xl space-y-2 p-4 xl:hidden">
          {isMockMode && <div className="mb-2"><Badge kind="neutral">Mock data</Badge></div>}

          {navLinks.map((item) =>
            item.href.startsWith("/") && !item.href.startsWith("/#") ? (
              <Link
                key={item.label}
                to={item.href}
                onClick={closeMenu}
                className={`block rounded-xl px-3 py-3 text-sm font-medium ${
                  isActive(item.href) ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-white/80"
                }`}
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                onClick={closeMenu}
                className={`block rounded-xl px-3 py-3 text-sm font-medium ${
                  isActive(item.href) ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-white/80"
                }`}
              >
                {item.label}
              </a>
            )
          )}

          <div className="border-t border-slate-200/70 pt-3">
            {!user ? (
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={signIn}>Log in</Button>
                <Button className="flex-1" onClick={signIn}>Get Started</Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 hover:border-red-300 active:bg-red-200"
              >
                <LogOut size={15} aria-hidden="true" />
                Log out
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
