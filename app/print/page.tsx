"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Printer, ShieldCheck } from "lucide-react";
import Link from "next/link";
import Terminal01LegacyPrintPage from "./terminal-01-legacy-page";
import Terminal02SecurePrintPage from "./terminal-02-secure-print-page";

export default function PrintRouterPage() {
  const [routePin, setRoutePin] = useState<string | null>(null);
  const [manualPin, setManualPin] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    const queryPin = new URLSearchParams(window.location.search).get("pin");
    setRoutePin(queryPin?.trim() || "");
  }, []);

  function continueWithPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pin = manualPin.trim();
    if (!/^\d{4}$/.test(pin) && !/^02\d{4}$/.test(pin)) {
      setPinError("Enter a 4-digit Terminal 01 PIN or scan the 6-digit Terminal 02 QR code.");
      return;
    }
    window.location.assign("/print?pin=" + encodeURIComponent(pin));
  }

  if (routePin === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-white">
        <p className="text-sm text-slate-300">Loading print route…</p>
      </main>
    );
  }

  // Preview pricing checks always use the safe, network-free Terminal 02 demo.
  // Do not route any Preview PIN to either live terminal API.
  if (process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE === "preview") {
    return <Terminal02SecurePrintPage pin={/^02\d{4}$/.test(routePin) ? routePin : "020000"} />;
  }

  // Preserve Terminal 01's four-digit route and its existing api.arkout.in contract.
  if (/^\d{4}$/.test(routePin)) {
    return <Terminal01LegacyPrintPage />;
  }

  // Route six-digit 02xxxx PINs only to the secure Terminal 02 backend.
  if (/^02\d{4}$/.test(routePin)) {
    return <Terminal02SecurePrintPage pin={routePin} />;
  }

  if (routePin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-12 text-white">
        <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl sm:p-10">
          <h1 className="text-2xl font-bold">Invalid kiosk PIN</h1>
          <p className="mt-3 leading-7 text-slate-300">Scan the QR code shown on the kiosk, or return to Arkout and enter a valid terminal PIN.</p>
          <Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-slate-950"><ArrowLeft size={17} /> Back to Arkout</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-12 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl sm:p-10">
        <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200"><Printer size={28} aria-hidden="true" /></div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Arkout PrintPod</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Start printing</h1>
        <p className="mt-3 leading-7 text-slate-300">Enter the PIN shown on your kiosk. If you're at Terminal 02, scanning its QR code is recommended.</p>
        <form onSubmit={continueWithPin} className="mt-7 space-y-4">
          <label className="block text-sm font-medium text-slate-200" htmlFor="terminal-pin">Kiosk PIN</label>
          <input id="terminal-pin" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={manualPin} onChange={e=>{setManualPin(e.target.value.replace(/\D/g, "").slice(0,6));setPinError("");}} placeholder="4 or 6 digits" className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-4 text-center font-mono text-2xl tracking-[0.25em] outline-none focus:border-cyan-300" />
          {pinError && <p role="alert" className="text-sm text-rose-300">{pinError}</p>}
          <button type="submit" className="w-full rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 hover:bg-slate-200">Continue</button>
        </form>
        <div className="mt-7 flex items-start gap-3 text-xs leading-5 text-slate-500"><ShieldCheck size={17} className="mt-0.5 shrink-0" aria-hidden="true" /> Each PIN is routed only to its corresponding terminal API.</div>
      </section>
    </main>
  );
}
