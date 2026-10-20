"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, CheckCircle2, CreditCard, FileText, LockKeyhole,
  Printer, ShieldCheck, SlidersHorizontal, UploadCloud,
} from "lucide-react";

export default function PrintPreviewPage() {
  const [mode, setMode] = useState<"bw" | "color">("bw");
  const [sides, setSides] = useState<"single" | "double">("single");
  const [copies, setCopies] = useState(1);
  const [fileName, setFileName] = useState("Project-notes.pdf");

  const estimatedTotal = useMemo(() => {
    const perPage = mode === "color" ? 7 : 1.5;
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(6 * copies * perPage);
  }, [mode, copies]);

  return (
    <main className="arkout-preview-page">
      <div className="arkout-preview-glow preview-glow-one" />
      <div className="arkout-preview-glow preview-glow-two" />
      <header className="preview-topbar">
        <Link href="/" className="preview-brand"><Image src="/arkout-logo.png" width={34} height={34} alt="" /><span>arkout</span></Link>
        <span className="preview-badge"><span /> Interactive preview · No live session</span>
      </header>

      <section className="preview-heading">
        <p className="admin-kicker">ARKOUT PRINTPOD</p>
        <h1>Your print, <span>your way.</span></h1>
        <p>Explore the print interface safely. This demo stays in your browser—it doesn't connect to a kiosk, upload files, create an order, open Razorpay, or send a print job.</p>
      </section>

      <div className="preview-layout">
        <section className="preview-workspace">
          <div className="preview-step-heading"><span className="preview-step-number">01</span><div><h2>Your document</h2><p>Choose a file to simulate the upload step.</p></div></div>
          <label className="preview-dropzone">
            <span className="preview-drop-icon"><UploadCloud size={27} /></span>
            <strong>{fileName || "Choose a document"}</strong>
            <span>PDF, JPG or PNG · browser-only demo</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => setFileName(event.target.files?.[0]?.name || "")} />
          </label>
          <div className="preview-document-row"><FileText size={19} /><div><strong>{fileName || "No document selected"}</strong><span>Preview example · 6 pages</span></div><span className="preview-doc-check"><CheckCircle2 size={17} /></span></div>

          <div className="preview-separator" />
          <div className="preview-step-heading"><span className="preview-step-number">02</span><div><h2>Print settings</h2><p>Try the options. The total is illustrative.</p></div></div>

          <div className="preview-option-group">
            <span className="preview-field-label">Colour mode</span>
            <div className="preview-segment-control">
              <button className={mode === "bw" ? "is-selected" : ""} onClick={() => setMode("bw")}><span className="preview-swatch swatch-bw" />Black & white</button>
              <button className={mode === "color" ? "is-selected" : ""} onClick={() => setMode("color")}><span className="preview-swatch swatch-color" />Colour</button>
            </div>
          </div>

          <div className="preview-settings-grid">
            <label><span className="preview-field-label">Sides</span><select value={sides} onChange={(event) => setSides(event.target.value as "single" | "double")}><option value="single">Single-sided</option><option value="double">Double-sided</option></select></label>
            <label><span className="preview-field-label">Copies</span><select value={copies} onChange={(event) => setCopies(Number(event.target.value))}>{[1,2,3,4,5].map((count) => <option value={count} key={count}>{count} {count === 1 ? "copy" : "copies"}</option>)}</select></label>
          </div>

          <div className="preview-summary">
            <div className="preview-summary-row"><span>Document pages</span><strong>6</strong></div>
            <div className="preview-summary-row"><span>Copies</span><strong>{copies}</strong></div>
            <div className="preview-summary-row"><span>Colour</span><strong>{mode === "bw" ? "Black & white" : "Colour"}</strong></div>
            <div className="preview-summary-row"><span>Sides</span><strong>{sides === "single" ? "Single-sided" : "Double-sided"}</strong></div>
            <div className="preview-total-row"><div><span>Illustrative total</span><strong>{estimatedTotal}</strong></div><span>Demo only</span></div>
          </div>

          <button className="preview-disabled-pay" disabled><LockKeyhole size={17} /> Payment disabled in preview</button>
          <p className="preview-safe-note"><ShieldCheck size={16} /> No session, payment, backend request, or print job will be started.</p>
        </section>

        <aside className="preview-side-panel">
          <div className="preview-printer-visual">
            <div className="preview-printer-orb" />
            <div className="preview-printer"><div className="preview-printer-top" /><div className="preview-printer-slot" /><div className="preview-printer-paper"><span /><span /><span /></div><div className="preview-printer-light" /></div>
            <div className="preview-printer-label"><span className="preview-live-dot" /> PrintPod experience</div>
          </div>
          <div className="preview-side-card"><span className="preview-side-icon"><SlidersHorizontal size={19} /></span><div><strong>Choices before checkout</strong><p>Review the options and estimated total before moving ahead.</p></div></div>
          <div className="preview-side-card"><span className="preview-side-icon"><CreditCard size={19} /></span><div><strong>Secure payment step</strong><p>The live flow uses the configured gateway only after a valid kiosk session is established.</p></div></div>
          <div className="preview-side-card"><span className="preview-side-icon"><Printer size={19} /></span><div><strong>Print after verification</strong><p>Production submissions remain server-verified. This preview never reaches the printer.</p></div></div>
          <Link href="/print" className="preview-back-link"><ArrowLeft size={16} /> Go to PIN entry <ArrowRight size={15} /></Link>
        </aside>
      </div>

      <footer className="admin-footer"><span>© {new Date().getFullYear()} Arkout Techworks Pvt. Ltd.</span><span><ShieldCheck size={13} /> Safe interactive preview</span></footer>
    </main>
  );
}
