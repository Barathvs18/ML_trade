import { Inbox } from "lucide-react";

export function EmptyState({ icon: Icon = Inbox, title = "Nothing here yet", description, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-10 text-center ${className}`}>
      <span className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon size={20} aria-hidden="true" /></span>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
