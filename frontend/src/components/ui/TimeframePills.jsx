const defaultOptions = ["1D", "1W", "1M", "1Y", "ALL"];

export function TimeframePills({ value, onChange, options = defaultOptions, label = "Chart timeframe", className = "" }) {
  return (
    <div className={`inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/55 p-1 ${className}`} role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={value === option}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${value === option ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-white hover:text-slate-900"}`}
          onClick={() => onChange?.(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function Tabs(props) {
  return <TimeframePills {...props} />;
}
