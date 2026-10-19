import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

export default function LaunchingSoonPage() {
  return (
    <main className="flex min-h-[75vh] items-center justify-center bg-slate-50 px-6 py-24 text-slate-900">
      <div className="max-w-xl text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 text-white"><Printer size={26} /></div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-blue-700">Arkout PrintPod</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Online printing is coming soon.</h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">We are preparing a safe and reliable online printing experience. Please check back soon.</p>
        <Link href="/" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"><ArrowLeft size={17} /> Back to home</Link>
      </div>
    </main>
  );
}
