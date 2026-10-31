import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, GlassCard, Modal } from "../../components/ui";
import { isResetConfirmed } from "./utils";

export default function ResetAccountCard({ onReset, resetting = false, error }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  useEffect(() => { if (!open) setConfirmation(""); }, [open]);
  return <GlassCard className="border-red-200/80 bg-red-50/35 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-100 text-red-800"><AlertTriangle size={19} aria-hidden="true" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-red-800">Danger zone</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Reset paper account</h2><p className="mt-1 max-w-xl text-sm leading-6 text-slate-700">Archive your current trade history and return the wallet to its starting balance.</p></div></div><Button variant="secondary" className="!border-red-300 !text-red-900 hover:!bg-red-50" onClick={() => setOpen(true)}>Reset account</Button></div>
    {error && <p className="mt-3 text-sm text-red-800" role="alert">{error}</p>}
    <Modal open={open} onClose={() => !resetting && setOpen(false)} title="Reset virtual paper account">
      <p className="text-sm leading-6 text-slate-800">This closes all positions, archives your trade history and resets your balance.</p>
      <label className="mt-4 block text-sm font-semibold text-slate-800">Type RESET to confirm<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" aria-label="Type RESET to confirm account reset" className="mt-2 block h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" /></label>
      <p className="mt-2 text-xs leading-5 text-slate-600">Your past simulated fills will be archived. This action cannot be undone from the page.</p>
      <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={resetting} onClick={() => setOpen(false)}>Cancel</Button><Button className="!bg-red-700 hover:!bg-red-800" disabled={!isResetConfirmed(confirmation) || resetting} onClick={async () => { await onReset(); setOpen(false); }}>{resetting ? "Resetting…" : "Confirm reset"}</Button></div>
    </Modal>
  </GlassCard>;
}
