import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./auth/useAuth";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import { LoadingCard } from "./components/ui/Skeleton";
import { DashboardPage, LoginPage, NotFoundPage, PaperTradingPage, PredictionPage, SimpleInfoPage } from "./pages";
import LandingPage from "./pages/LandingPage";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function LoginRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <main className="mx-auto min-h-[62vh] max-w-7xl px-5 py-16 sm:px-8"><LoadingCard lines={3} className="mx-auto max-w-md p-8" /></main>;
  if (user) return <Navigate to={location.state?.from?.pathname || "/dashboard"} replace />;
  return <LoginPage />;
}

function AppRoutes() {
  const location = useLocation();
  return <>
    <Navbar />
    <Routes>
      <Route path="/" element={<LandingPage />} />
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
