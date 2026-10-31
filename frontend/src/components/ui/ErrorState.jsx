import { TriangleAlert } from "lucide-react";

export function ErrorState({ title = "Something went wrong", description = "Please try again in a moment.", onRetry, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-10 text-center ${className}`} role="alert">
      <span className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-red-50 text-red-600"><TriangleAlert size={20} aria-hidden="true" /></span>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
      {onRetry && <button type="button" onClick={onRetry} className="mt-4 rounded-full px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">Try again</button>}
    </div>
  );
}
