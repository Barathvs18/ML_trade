export default function HelpHint({ text, label = "Explain this term" }) {
  return <button type="button" title={text} aria-label={`${label}: ${text}`} className="ml-1 inline-grid h-5 w-5 place-items-center rounded-full border border-slate-300 bg-white/70 align-middle text-[11px] font-bold text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">?</button>;
}
