"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole, Printer, ShieldCheck, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import Terminal01LegacyPrintPage from "./terminal-01-legacy-page";
import Terminal02SecurePrintPage from "./terminal-02-secure-print-page";

export default function PrintRouterPage() {
  const [routePin, setRoutePin] = useState<string | null>(null);
  const [manualPin, setManualPin] = useState("");
  const [pinError, setPinError] = useState("");
  const reducedMotion = useReducedMotion();

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
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090a0d] px-5 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(102,139,255,.25),transparent_45%),radial-gradient(ellipse_at_90%_90%,rgba(135,105,255,.19),transparent_45%)]" />
        <p className="relative text-sm text-white/65">Preparing your print session…</p>
      </main>
    );
  }

  if (/^\d{4}$/.test(routePin)) return <Terminal01LegacyPrintPage />;
  if (/^02\d{4}$/.test(routePin)) return <Terminal02SecurePrintPage pin={routePin} />;

  if (routePin) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090a0d] px-5 py-12 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(102,139,255,.24),transparent_45%),radial-gradient(ellipse_at_90%_90%,rgba(135,105,255,.18),transparent_45%)]" />
        <section className="relative w-full max-w-lg rounded-[30px] border border-white/15 bg-[#10131b]/80 p-7 shadow-[0_30px_100px_rgba(0,0,0,.5)] backdrop-blur-2xl sm:p-10">
          <div className="mb-7 grid h-14 w-14 place-items-center rounded-2xl border border-[#bdcbff]/25 bg-[#bdcbff]/10 text-[#bdcbff]"><LockKeyhole size={25} /></div>
          <p className="font-mono text-[10px] font-semibold tracking-[.2em] text-[#bdcbff]">ARKOUT / PRINTPOD</p>
          <h1 className="mt-4 text-3xl font-medium tracking-[-.05em]">This session PIN doesn’t look right.</h1>
          <p className="mt-3 text-sm leading-7 text-white/60">Scan the QR code shown on your kiosk, or return to Arkout and enter a valid terminal PIN.</p>
          <Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#f0f1f5] px-5 py-3 text-sm font-semibold text-[#0b0c10] transition hover:-translate-y-0.5 hover:bg-white"><ArrowLeft size={16} /> Back to Arkout</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#090a0d] px-5 py-12 font-sans text-white selection:bg-[#bdccff] selection:text-[#10131b]">
      <motion.div aria-hidden="true" className="absolute inset-0 -z-30" animate={reducedMotion ? undefined : { scale: [1.02, 1.06, 1.02], y: [0, -5, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}>
        <Image src="/arkout-kiosk-hero.webp" alt="" fill priority sizes="100vw" className="object-cover object-[65%_center] opacity-65" />
      </motion.div>
      <div aria-hidden="true" className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(8,9,13,.98)_0%,rgba(8,9,13,.84)_42%,rgba(8,9,13,.45)_100%),linear-gradient(0deg,#090a0d_0%,rgba(9,10,13,.18)_65%,rgba(9,10,13,.52)_100%)]" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-[.09] [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:78px_78px] [mask-image:linear-gradient(90deg,#000,transparent_95%)]" />

      <header className="absolute left-0 right-0 top-0 z-20 border-b border-white/10 bg-black/[.08] backdrop-blur-sm">
        <div className="mx-auto flex h-[76px] w-[calc(100%-36px)] max-w-[1380px] items-center justify-between sm:w-[calc(100%-64px)]">
          <Link href="/" className="inline-flex items-center gap-3 text-xl font-semibold tracking-[-.075em]" aria-label="Arkout home">
            <Image src="/favicon.ico" alt="Arkout logo" width={34} height={34} unoptimized className="rounded-full" />
            <span>arkout<span className="text-[#a8bbff]">.</span></span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-white/65 transition hover:text-white"><ArrowLeft size={14} /> Back to home</Link>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-[1180px] items-center gap-12 pt-16 lg:grid-cols-[1fr_.82fr] lg:gap-20">
        <motion.section initial={reducedMotion ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : .7 }} className="hidden max-w-xl lg:block">
          <p className="mb-7 flex items-center gap-3 font-mono text-[10px] font-semibold tracking-[.2em] text-[#bdcbff]"><span className="h-px w-8 bg-current" /> CAMPUS PRINTING, REIMAGINED</p>
          <h1 className="text-[clamp(54px,6.5vw,88px)] font-medium leading-[.88] tracking-[-.09em]">Good work<br />shouldn’t wait<br /><span className="text-white/45">in a queue.</span></h1>
          <p className="mt-7 max-w-md text-sm leading-7 text-white/60">A more considered way to print on campus. Connect to your terminal, prepare your documents, and collect your pages.</p>
          <div className="mt-10 flex items-center gap-3 text-xs text-white/45"><ShieldCheck size={16} className="text-[#bdcbff]" /> Secure, terminal-specific sessions</div>
        </motion.section>

        <motion.section initial={reducedMotion ? false : { opacity: 0, y: 24, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: reducedMotion ? 0 : .65, delay: reducedMotion ? 0 : .08 }} className="mx-auto w-full max-w-[510px] rounded-[30px] border border-white/15 bg-[#10131b]/80 p-6 shadow-[0_30px_100px_rgba(0,0,0,.55)] backdrop-blur-2xl sm:p-9">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[#bdcbff]/25 bg-[#bdcbff]/10 text-[#bdcbff]"><Printer size={23} /></div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-[10px] text-white/55"><Sparkles size={12} className="text-[#bdcbff]" /> ARKOUT PRINTPOD</span>
          </div>
          <p className="font-mono text-[9px] font-semibold tracking-[.2em] text-[#bdcbff]">01 / CONNECT TO TERMINAL</p>
          <h2 className="mt-3 text-3xl font-medium tracking-[-.06em] sm:text-[38px]">Start printing.</h2>
          <p className="mt-3 text-sm leading-6 text-white/55">Enter the PIN shown on your kiosk. For Terminal 02, scanning its QR code is the easiest way to connect.</p>

          <form onSubmit={continueWithPin} className="mt-8 space-y-4">
            <label className="block text-xs font-medium text-white/75" htmlFor="terminal-pin">Terminal PIN</label>
            <input id="terminal-pin" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={manualPin} onChange={e => { setManualPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setPinError(""); }} placeholder="Enter 4 or 6 digits" className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-4 text-center font-mono text-2xl tracking-[.28em] text-white outline-none transition placeholder:text-sm placeholder:tracking-normal placeholder:text-white/25 focus:border-[#bdcbff]/70 focus:ring-4 focus:ring-[#bdcbff]/10" />
            {pinError && <p role="alert" className="text-sm text-rose-300">{pinError}</p>}
            <button type="submit" className="group flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-[#f0f1f5] px-5 text-sm font-bold text-[#0b0c10] transition duration-300 hover:-translate-y-0.5 hover:bg-white">Continue to print <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></button>
          </form>

          <div className="mt-7 flex items-start gap-3 border-t border-white/10 pt-5 text-[11px] leading-5 text-white/40"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#bdcbff]" /> Your PIN connects only to its corresponding terminal. Payments and print submission stay within that terminal’s flow.</div>
        </motion.section>
      </div>

      <footer className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t border-white/10 px-5 py-4 font-mono text-[8px] tracking-[.14em] text-white/35 sm:px-8">
        <span>ARKOUT PRINTPOD</span><span className="hidden sm:block">MADE FOR CAMPUS LIFE</span><Link href="/" className="transition hover:text-white/70">ARKOUT.IN ↗</Link>
      </footer>
    </main>
  );
}
