import Link from "next/link";
import { ArrowLeft, LockKeyhole, Printer, ShieldCheck } from "lucide-react";

export default function PrintPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-12 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl sm:p-10">
        <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
          <Printer size={28} aria-hidden="true" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Arkout PrintPod</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Online printing is temporarily unavailable</h1>
        <p className="mt-4 leading-7 text-slate-300">
          We’re restoring the secure print checkout so document uploads, payment confirmation, and print submission are connected safely.
        </p>

        <div role="status" className="mt-6 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-5">
          <div className="flex items-center gap-2 font-semibold text-amber-100">
            <LockKeyhole size={18} aria-hidden="true" />
            Please don’t upload documents or attempt payment here yet.
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            No payment or print job has been started by this page. We’ll reopen the flow after the server verifies payment and authorizes the print job.
          </p>
        </div>

        <div className="mt-6 flex items-start gap-3 text-sm leading-6 text-slate-400">
          <ShieldCheck size={19} className="mt-0.5 shrink-0 text-cyan-300" aria-hidden="true" />
          Your documents and payment details are not collected by this temporary page.
        </div>

        <Link
          href="/"
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-slate-200"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Back to Arkout
        </Link>
      </section>
    </main>
  );
}
