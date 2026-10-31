import { Navigate, useLocation } from "react-router-dom";
import { LoadingCard } from "./ui/Skeleton";
import { useAuth } from "../auth/useAuth";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <main className="mx-auto min-h-[65vh] max-w-7xl px-5 py-16 sm:px-8"><LoadingCard lines={4} className="mx-auto max-w-xl p-8" /></main>;
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}
