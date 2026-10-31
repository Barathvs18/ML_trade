const badgeKinds = {
  neutral: "border-slate-200 bg-white/70 text-slate-600",
  positive: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
  negative: "border-red-200 bg-red-50/80 text-red-700",
  paper: "border-emerald-200 bg-emerald-50/90 text-emerald-700",
  experimental: "border-amber-200 bg-amber-50/90 text-amber-800",
};

export function Badge({ kind = "neutral", className = "", children, ...props }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${badgeKinds[kind] ?? badgeKinds.neutral} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}

export function Pill(props) {
  return <Badge {...props} />;
}

export function PaperModeBadge() {
  return <Badge kind="paper"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Paper mode</Badge>;
}

export function ExperimentalBadge() {
  return <Badge kind="experimental">Experimental</Badge>;
}
