import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { GlassCard } from "./GlassCard";

export function Modal({ open, onClose, title, children, labelledBy = "stockzo-dialog-title" }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    dialogRef.current?.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <GlassCard ref={dialogRef} as="section" role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="w-full max-w-lg p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={labelledBy} className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </div>
        {children}
      </GlassCard>
    </div>
  );
}
