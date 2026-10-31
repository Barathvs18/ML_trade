import { CircleCheck, CircleAlert, Info, X } from "lucide-react";

const styles = {
  success: { Icon: CircleCheck, color: "text-emerald-700" },
  error: { Icon: CircleAlert, color: "text-red-700" },
  info: { Icon: Info, color: "text-slate-700" },
};

export function Toast({ title, message, kind = "info", onClose, className = "" }) {
  const { Icon, color } = styles[kind] ?? styles.info;
  return (
    <div className={`glass-card flex max-w-sm items-start gap-3 p-4 ${className}`} role={kind === "error" ? "alert" : "status"} aria-live={kind === "error" ? "assertive" : "polite"}>
      <Icon size={18} className={`mt-0.5 shrink-0 ${color}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-semibold text-slate-900">{title}</p>}
        <p className="text-sm leading-5 text-slate-600">{message}</p>
      </div>
      {onClose && <button type="button" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} aria-label="Dismiss notification"><X size={16} /></button>}
    </div>
  );
}
