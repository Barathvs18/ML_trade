import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./auth/useAuth";
import { googleLoginUrl } from "./api/client";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import { Badge, Button, ExperimentalBadge, GlassCard, PaperModeBadge } from "./components/ui";
import { LoadingCard } from "./components/ui/Skeleton";
import { DashboardPage, LoginPage, NotFoundPage, PaperTradingPage, PredictionPage, SimpleInfoPage } from "./pages";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function LoginRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <main className="mx-auto min-h-[62vh] max-w-7xl px-5 py-16 sm:px-8"><LoadingCard lines={3} className="mx-auto max-w-md p-8" /></main>;
  if (user) return <Navigate to={location.state?.from?.pathname || "/dashboard"} replace />;
  return <LoginPage />;
}

function LandingPreview() {
  const [showInfo, setShowInfo] = useState(false);
  const navigateToLogin = () => window.location.assign(googleLoginUrl());
  return <main className="mx-auto flex min-h-[66vh] max-w-7xl items-center justify-center px-5 py-12 sm:px-8">
    <GlassCard className="entrance w-full max-w-3xl p-7 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3"><PaperModeBadge /><ExperimentalBadge /></div>
      <Badge kind="positive" className="mt-9">A brighter way to learn markets</Badge>
      <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.05em] text-slate-900 sm:text-6xl">Trade. Predict.<br /><span className="text-emerald-500">Grow.</span></h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">A calm, considered space to explore stocks, learn from experimental model estimates, and practice with virtual money.</p>
      <div className="mt-7 flex flex-wrap gap-3"><Button size="lg" onClick={navigateToLogin}>Get started <ArrowRight size={17} aria-hidden="true" /></Button><Button size="lg" variant="secondary" onClick={() => setShowInfo((open) => !open)}>How it works <Sparkles size={16} aria-hidden="true" /></Button></div>
      {showInfo && <p className="mt-4 rounded-xl bg-emerald-50/70 px-4 py-3 text-sm leading-6 text-emerald-900">Explore Nifty 50 stocks, review experimental predictions, and practice trades with simulated funds.</p>}
      <p className="mt-8 text-xs leading-5 text-slate-500">Educational only, not financial advice. All trading is simulated with virtual money.</p>
    </GlassCard>
  </main>;
}

function AppRoutes() {
  const location = useLocation();
  return <>
    <Navbar />
    <Routes>
      <Route path="/" element={<LandingPreview />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/prediction" element={<ProtectedRoute><PredictionPage /></ProtectedRoute>} />
      <Route path="/paper-trading" element={<ProtectedRoute><PaperTradingPage /></ProtectedRoute>} />
      <Route path="/about" element={<SimpleInfoPage title="About Stockzo" />} />
      <Route path="/privacy-policy" element={<SimpleInfoPage title="Privacy Policy" />} />
      <Route path="/terms-and-conditions" element={<SimpleInfoPage title="Terms & Conditions" />} />
      <Route path="/contact" element={<SimpleInfoPage title="Contact" />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    <Footer />
    <span className="sr-only" aria-live="polite">Page {location.pathname}</span>
  </>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter></QueryClientProvider>;
}
