"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, CircleSlash, Clock3, FileText,
  FlaskConical, Printer, ShieldCheck, WifiOff, Wrench,
} from "lucide-react";

type CustomerStage = "documents" | "review" | "order" | "payment" | "paid" | "cancelled" | "review-needed";
type PrinterFault = "healthy" | "jam" | "offline" | "pi-offline";

const sampleDocuments = [
  { name: "Lecture-notes.pdf", pages: 8 },
  { name: "Assignment.pdf", pages: 3 },
];

export default function PrintFlowPreviewPage() {
  const [stage, setStage] = useState<CustomerStage>("documents");
  const [fault, setFault] = useState<PrinterFault>("healthy");
  const [manualMaintenance, setManualMaintenance] = useState(false);
  const [showFailureScenarios, setShowFailureScenarios] = useState(true);
  const [color, setColor] = useState<"bw" | "color">("bw");
  const [copies, setCopies] = useState(1);
  const [notice, setNotice] = useState("This sandbox uses fake documents, simulated payment states and simulated printer health.");
  const [eventLog, setEventLog] = useState<string[]>(["Preview opened — no API request made."]);

  const pages = sampleDocuments.reduce((sum, item) => sum + item.pages, 0);
  const totalPages = pages * copies;
  const unitPrice = color === "bw" ? 1.5 : 7;
  const amount = totalPages * unitPrice;
  const maintenance = manualMaintenance || fault !== "healthy";

  function record(event: string) {
    setEventLog((current) => [new Date().toLocaleTimeString(), event].map((value, index) => index === 0 ? value + " · " + event : value).slice(0, 5));
  }

  function simulateCustomerAction(next: CustomerStage, message: string) {
    setStage(next);
    setNotice(message);
    record(message);
  }

  function simulateFault(next: PrinterFault) {
    setFault(next);
    const message = next === "healthy"
      ? "Printer health simulation recovered. Automatic maintenance clears only when its owner is automatic and healthy checks pass."
      : next === "jam"
        ? "SIMULATED: Paper jam detected. Stop accepting new orders and notify admin."
        : next === "offline"
          ? "SIMULATED: Printer/CUPS unreachable. New orders must fail closed; retain in-flight jobs for reconciliation."
          : "SIMULATED: Raspberry Pi/monitoring connection lost. The page cannot receive new telemetry; queued jobs must not be blindly resubmitted.";
    setNotice(message);
    record(message);
  }

  return (
    <main className="min-h-screen bg-[#090a0d] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link href="/print" className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white"><ArrowLeft size={16} /> Back to print page</Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-[11px] font-bold tracking-wide text-amber-200"><FlaskConical size={14} /> INTERACTIVE SANDBOX · NO LIVE ACTIONS</span>
        </div>
        <header className="mb-8">
          <p className="font-mono text-[10px] font-semibold tracking-[.24em] text-[#bdcbff]">ARKOUT / RELIABILITY PREVIEW</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Customer flow meets real-world failures.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60">Walk through cancellation, abandoned checkout, paper jam, printer outage and Raspberry Pi outage states. Everything on this route is local simulation: no files are uploaded, no API is called, no payment is opened and no printer is touched.</p>
        </header>

        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-indigo-300/20 bg-indigo-300/[.06] p-4 text-sm leading-6 text-indigo-100/90">
          <ShieldCheck size={19} className="mt-0.5 shrink-0 text-indigo-200" />
          <p><strong>Safety invariant:</strong> before checkout starts, the customer can cancel. Once payment may have started, the UI preserves the same order for status reconciliation and must not silently cancel it, create a new order, or print again.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[.04] p-5 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-[#bdcbff]">Terminal 02 · Demo PIN 020123</p>
                <h2 className="mt-2 text-2xl font-semibold">Secure printing</h2>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[.04]"><Printer size={23} /></div>
            </div>

            <ol className="mt-6 grid grid-cols-4 gap-2 text-[10px] sm:text-xs">
              {(["Documents", "Review", "Order", "Payment"] as const).map((label, index) => {
                const stepIndex = stage === "documents" ? 0 : stage === "review" ? 1 : stage === "order" ? 2 : 3;
                const active = !["cancelled", "review-needed"].includes(stage) && stepIndex >= index;
                return <li key={label} className={"rounded-xl border px-2 py-3 text-center " + (active ? "border-[#bdcbff]/30 bg-[#bdcbff]/10 text-white" : "border-white/10 text-white/35")}>{String(index + 1).padStart(2, "0")} · {label}</li>;
              })}
            </ol>

            {stage === "documents" && (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2 font-semibold"><FileText size={17} className="text-[#bdcbff]" /> Sample documents (simulated)</div>
                  {sampleDocuments.map((doc) => <div key={doc.name} className="flex justify-between gap-4 border-t border-white/5 py-3 text-sm"><span className="break-all text-white/80">{doc.name}</span><span className="shrink-0 text-white/45">{doc.pages} pages</span></div>)}
                  <p className="text-xs text-white/40">Sample only — nothing is uploaded or read from your device.</p>
                </div>
                <button onClick={() => simulateCustomerAction("review", "Sample document manifest accepted. Review settings before creating any order.")} className="w-full rounded-xl bg-[#f0f1f5] px-4 py-3 font-semibold text-[#0b0c10] hover:bg-white">Continue to review</button>
              </div>
            )}

            {stage === "review" && (
              <div className="mt-6 space-y-5">
                <h3 className="text-lg font-semibold">Review your print settings</h3>
                <label className="block text-sm text-white/65">Color
                  <select value={color} onChange={(e) => setColor(e.target.value as "bw" | "color")} className="mt-2 w-full rounded-xl border border-white/15 bg-[#11141b] p-3 text-white"><option value="bw">Black & white · ₹1.50/page</option><option value="color">Color · ₹7/page</option></select>
                </label>
                <label className="block text-sm text-white/65">Copies
                  <select value={copies} onChange={(e) => setCopies(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-white/15 bg-[#11141b] p-3 text-white">{[1,2,3].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                </label>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex justify-between text-sm text-white/55"><span>Pages per copy</span><span>{pages}</span></div><div className="mt-2 flex justify-between text-sm text-white/55"><span>Total pages</span><span>{totalPages}</span></div><div className="mt-3 flex justify-between border-t border-white/10 pt-3"><span className="text-sm">Estimated total</span><strong className="text-2xl">₹{amount.toFixed(2)}</strong></div><p className="mt-2 text-xs text-white/40">Demo estimate only; a real backend must calculate and validate price.</p></div>
                <div className="grid gap-3 sm:grid-cols-2"><button onClick={() => simulateCustomerAction("documents", "Returned to document selection. No order was created.")} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/5">Back to documents</button><button onClick={() => simulateCustomerAction("order", "Simulated unpaid order created. It can be cancelled until checkout begins.")} className="rounded-xl bg-[#f0f1f5] px-4 py-3 text-sm font-semibold text-[#0b0c10] hover:bg-white">Create demo order</button></div>
              </div>
            )}

            {stage === "order" && (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[.06] p-4"><p className="text-xs font-bold uppercase tracking-[.15em] text-emerald-200">Unpaid · Demo order ARK-DEMO-001</p><p className="mt-2 text-3xl font-semibold">₹{amount.toFixed(2)}</p><p className="mt-2 text-sm leading-6 text-white/55">Checkout has not started. Cancel is available. A real backend must atomically serialize cancellation against checkout-start.</p></div>
                <button onClick={() => simulateCustomerAction("cancelled", "Demo order cancelled before payment. Session/documents would be released after server confirmation.")} className="w-full rounded-xl border border-rose-300/30 px-4 py-3 font-semibold text-rose-200 hover:bg-rose-300/10">Cancel order before payment</button>
                <button onClick={() => simulateCustomerAction("payment", "Demo checkout handoff started. Cancellation is now locked until the backend reconciles payment status.")} className="w-full rounded-xl bg-[#bdcbff] px-4 py-3 font-semibold text-[#10131b] hover:bg-white">Simulate opening payment</button>
                <button onClick={() => simulateCustomerAction("review", "Returned to settings. This demo does not call a backend.")} className="w-full text-sm text-white/45 hover:text-white">Go back to settings</button>
              </div>
            )}

            {stage === "payment" && (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[.06] p-4"><div className="flex items-center gap-2 font-semibold text-amber-100"><Clock3 size={18} /> Payment may be in progress</div><p className="mt-3 text-sm leading-6 text-white/65">The user can close the tab or return from a UPI app without the browser receiving a callback. Never assume that means no money was collected.</p></div>
                <button onClick={() => simulateCustomerAction("review-needed", "Payment state is ambiguous. Preserve the same order and request status reconciliation; do not cancel or create a second order.")} className="w-full rounded-xl border border-amber-300/25 px-4 py-3 font-semibold text-amber-100 hover:bg-amber-300/10">Simulate lost payment callback</button>
                <button onClick={() => simulateCustomerAction("paid", "Demo payment was confirmed by the simulated server. In production, only server-side verification can trigger print submission.")} className="w-full rounded-xl bg-emerald-200 px-4 py-3 font-semibold text-[#07140f] hover:bg-white">Simulate confirmed payment</button>
                <p className="text-xs text-white/45">Cancel and new-payment actions are intentionally not offered in this state.</p>
              </div>
            )}

            {stage === "paid" && (
              <div className="mt-6 space-y-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/[.06] p-5"><CheckCircle2 size={34} className="text-emerald-200" /><h3 className="text-xl font-semibold">Payment confirmed (demo)</h3><p className="text-sm leading-6 text-white/65">The order is retained until the backend records a terminal print outcome. If the Pi or printer fails now, reconcile the job state; never blindly reprint.</p><button onClick={() => simulateCustomerAction("review-needed", "Simulated print outcome is ambiguous. Preserve the order and send it to support review.")} className="w-full rounded-xl border border-amber-300/25 px-4 py-3 text-sm font-semibold text-amber-100">Simulate Pi/printer failure after payment</button><button onClick={() => { setStage("documents"); setFault("healthy"); setManualMaintenance(false); setNotice("Demo reset. No real order or print job existed."); setEventLog(["Demo reset — no API request made."]); }} className="w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold hover:bg-white/5">Reset demo</button></div>
            )}

            {stage === "cancelled" && (
              <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-black/20 p-5"><CheckCircle2 size={34} className="text-emerald-200" /><h3 className="text-xl font-semibold">Demo order cancelled</h3><p className="text-sm leading-6 text-white/65">In production, show cancellation success only after the backend confirms the order is safely cancelled. If the request times out, keep the order and offer a status check rather than guessing.</p><button onClick={() => simulateCustomerAction("documents", "Start a new demo session. The production flow requires a fresh PIN after successful cancellation.")} className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-[#10131b]">Start again</button></div>
            )}

            {stage === "review-needed" && (
              <div className="mt-6 space-y-4 rounded-2xl border border-rose-300/20 bg-rose-300/[.05] p-5"><AlertTriangle size={34} className="text-rose-200" /><h3 className="text-xl font-semibold">Status needs reconciliation</h3><p className="text-sm leading-6 text-white/65">Do not pay again, cancel the order, or submit another print. Restore the same order reference and ask the backend to reconcile Razorpay/CUPS states.</p><button onClick={() => simulateCustomerAction("payment", "Returned to payment-status simulation for the same order; no new order was created.")} className="w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold hover:bg-white/5">Re-check same order (demo)</button></div>
            )}

            {notice && <p role="status" className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-white/65">{notice}</p>}
            <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5"><button onClick={() => simulateCustomerAction("documents", "Demo reset. No live data changed.")} className="text-xs text-white/45 hover:text-white">Reset customer flow</button><button onClick={() => setShowFailureScenarios((show) => !show)} className="ml-auto text-xs text-[#bdcbff]">{showFailureScenarios ? "Hide" : "Show"} failure scenarios</button></div>
          </section>

          <aside className="space-y-6">
            {showFailureScenarios && (
              <section className="rounded-3xl border border-white/10 bg-white/[.04] p-5 sm:p-7">
                <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-300/10 text-amber-100"><Wrench size={20} /></div><div><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-100">Fault injection</p><h2 className="mt-1 text-xl font-semibold">Simulate device health</h2></div></div>
                <p className="mt-3 text-sm leading-6 text-white/55">These controls change only local demo state. They do not contact CUPS, the Pi, the real maintenance API or the admin alert channels.</p>
                <div className="mt-4 grid gap-2">
                  <button onClick={() => simulateFault("healthy")} className="rounded-xl border border-white/15 px-4 py-3 text-left text-sm hover:bg-white/5">Healthy / recovered</button>
                  <button onClick={() => simulateFault("jam")} className="flex items-center gap-3 rounded-xl border border-rose-300/20 px-4 py-3 text-left text-sm text-rose-100 hover:bg-rose-300/[.06]"><AlertTriangle size={17} /> Paper jam / media error</button>
                  <button onClick={() => simulateFault("offline")} className="flex items-center gap-3 rounded-xl border border-rose-300/20 px-4 py-3 text-left text-sm text-rose-100 hover:bg-rose-300/[.06]"><Printer size={17} /> Printer or CUPS unreachable</button>
                  <button onClick={() => simulateFault("pi-offline")} className="flex items-center gap-3 rounded-xl border border-rose-300/20 px-4 py-3 text-left text-sm text-rose-100 hover:bg-rose-300/[.06]"><WifiOff size={17} /> Raspberry Pi / network down</button>
                </div>
                <label className="mt-5 flex items-start gap-3 rounded-xl border border-white/10 p-3 text-sm"><input type="checkbox" checked={manualMaintenance} onChange={(e) => setManualMaintenance(e.target.checked)} className="mt-1 accent-indigo-300" /><span><strong>Manual maintenance enabled</strong><span className="mt-1 block text-xs leading-5 text-white/45">Automatic recovery must never silently override a human admin decision.</span></span></label>
                <div className={"mt-4 rounded-2xl border p-4 " + (maintenance ? "border-rose-300/25 bg-rose-300/[.06]" : "border-emerald-300/20 bg-emerald-300/[.05]")}>
                  <div className="flex items-center gap-2 font-semibold">{maintenance ? <CircleSlash size={17} className="text-rose-200" /> : <CheckCircle2 size={17} className="text-emerald-200" />}{maintenance ? "Maintenance: ENABLED (simulation)" : "Maintenance: disabled (simulation)"}</div>
                  <p className="mt-2 text-sm leading-6 text-white/60">{maintenance ? "Production policy: reject new upload/order/checkout/print requests; preserve orders with uncertain payment or printing state." : "Production policy: reopen only after sustained health checks and only if maintenance was automatically enabled."}</p>
                </div>
                <div className="mt-4 rounded-xl border border-white/10 p-4"><p className="text-xs font-bold uppercase tracking-[.15em] text-white/50">Admin notification (simulation)</p><p className="mt-2 text-sm leading-6">{fault === "healthy" ? "No active printer incident." : fault === "jam" ? "⚠️ Paper jam detected — maintenance is required. Check printer before recovery." : fault === "offline" ? "⚠️ Printer/CUPS unreachable — new orders blocked, existing jobs retained for review." : "⚠️ Raspberry Pi/monitoring is offline — no live alert can leave the Pi until connectivity returns."}</p></div>
              </section>
            )}

            <section className="rounded-3xl border border-white/10 bg-white/[.04] p-5 sm:p-7">
              <h2 className="text-lg font-semibold">Local event log</h2>
              <p className="mt-1 text-xs text-white/40">Browser-only demo events; not persisted or sent to an administrator.</p>
              <ul className="mt-4 space-y-3">{eventLog.map((event, index) => <li key={index} className="flex gap-3 text-xs leading-5 text-white/55"><Clock3 size={14} className="mt-0.5 shrink-0 text-[#bdcbff]" />{event}</li>)}</ul>
              <div className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-white/40"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Real end-to-end tests require an isolated Raspberry Pi staging backend, Razorpay test mode, test DB and mocked print driver.</div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
