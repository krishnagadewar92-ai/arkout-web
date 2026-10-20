"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
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
      <main className="arkout-print-router">
        <div className="print-router-card">
          <div className="print-router-brand"><Image src="/arkout-logo.png" alt="" width={34} height={34} /><span>arkout</span></div>
          <p className="print-router-eyebrow">ARKOUT PRINTPOD</p>
          <h1>Connecting you to your kiosk.</h1>
          <p>Checking your print session. This only takes a moment.</p>
        </div>
      </main>
    );
  }

  // Preserve Terminal 01's four-digit route and existing api.arkout.in contract.
  if (/^\d{4}$/.test(routePin)) {
    return <Terminal01LegacyPrintPage />;
  }

  // Route six-digit 02xxxx PINs only to the secure Terminal 02 backend.
  if (/^02\d{4}$/.test(routePin)) {
    return <Terminal02SecurePrintPage pin={routePin} />;
  }

  if (routePin) {
    return (
      <main className="arkout-print-router">
        <section className="print-router-card">
          <div className="print-router-brand"><Image src="/arkout-logo.png" alt="" width={34} height={34} /><span>arkout</span></div>
          <p className="print-router-eyebrow">CHECK YOUR KIOSK CODE</p>
          <h1>That PIN doesn't look right.</h1>
          <p>Scan the QR code on your kiosk, or return to Arkout and enter the PIN shown on the terminal.</p>
          <Link href="/" className="print-router-back"><ArrowLeft size={17} aria-hidden="true" /> Back to Arkout</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="arkout-print-router">
      <section className="print-router-card">
        <div className="print-router-brand"><Image src="/arkout-logo.png" alt="" width={34} height={34} /><span>arkout</span></div>
        <p className="print-router-eyebrow">ARKOUT PRINTPOD</p>
        <h1>Printing, made a little simpler.</h1>
        <p>Enter the code shown on your kiosk. If you're at Terminal 02, scanning its QR code is recommended.</p>
        <form onSubmit={continueWithPin}>
          <label className="print-router-field" htmlFor="terminal-pin">
            Kiosk PIN
            <input
              id="terminal-pin"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={manualPin}
              onChange={(event) => {
                setManualPin(event.target.value.replace(/\D/g, "").slice(0, 6));
                setPinError("");
              }}
              placeholder="4 or 6 digits"
              aria-describedby={pinError ? "pin-error" : undefined}
            />
          </label>
          {pinError && <p id="pin-error" className="print-router-error" role="alert">{pinError}</p>}
          <button type="submit" className="print-router-button">Continue to kiosk <ArrowRight size={17} aria-hidden="true" /></button>
        </form>
        <div className="print-router-note"><ShieldCheck size={17} aria-hidden="true" /><span>Each PIN is routed only to its corresponding terminal API.</span></div>
        <Link href="/" className="print-router-back"><ArrowLeft size={17} aria-hidden="true" /> Back to Arkout</Link>
      </section>
    </main>
  );
}
