"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CheckCircle2, Clock3, Film, Image as ImageIcon, RefreshCw, ShieldCheck, XCircle } from "lucide-react";

type Ad = { pathname: string; url: string; size: number; uploadedAt: string; contentType: string };
const isVideo = (ad: Ad) => ad.contentType.startsWith("video/") || /\.(mp4|m4v|mov|webm)$/i.test(ad.pathname);
const sizeLabel = (size: number) => size >= 1024 * 1024 ? (size / 1024 / 1024).toFixed(1) + " MB" : Math.max(1, Math.round(size / 1024)) + " KB";

export default function AdminAdsApprovalPage() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [ads, setAds] = useState<Ad[]>([]);
  const [busyPath, setBusyPath] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const authResponse = await fetch("/api/admin/auth", { cache: "no-store" });
      const auth = await authResponse.json();
      setAuthenticated(Boolean(auth.authenticated));
      if (!auth.authenticated) { setAds([]); return; }
      const response = await fetch("/api/admin/ads", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load ad approvals.");
      setAds(Array.isArray(data.ads) ? data.ads : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load ad approvals.");
    } finally { setReady(true); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function decide(ad: Ad, action: "approve" | "reject") {
    const label = action === "approve" ? "approve and publish" : "reject and delete";
    if (!window.confirm("Are you sure you want to " + label + " this advertisement?")) return;
    setBusyPath(ad.pathname); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, pathname: ad.pathname }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update advertisement.");
      setNotice(action === "approve" ? "Advertisement approved and published to the kiosk playlist." : "Advertisement rejected and deleted.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally { setBusyPath(""); }
  }

  return <main className="min-h-screen bg-[#070a12] px-4 py-8 text-slate-100 sm:px-8">
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16}/> Back to Admin</Link>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-cyan-300"><ShieldCheck size={15}/> Arkout · Advertisement review</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Approve kiosk ads</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Every submission stays hidden from kiosk screens until an admin approves it. Rejected media is deleted.</p>
        </div>
        <button onClick={() => void load()} disabled={!ready || Boolean(busyPath)} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm hover:bg-white/5 disabled:opacity-50"><RefreshCw size={16}/> Refresh queue</button>
      </header>

      {error && <div role="alert" className="mb-5 rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
      {notice && <div role="status" className="mb-5 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-200">{notice}</div>}

      {!ready ? <p className="py-16 text-center text-slate-400">Loading approval queue…</p> :
      !authenticated ? <section className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6"><h2 className="text-xl font-semibold">Admin sign-in required</h2><p className="mt-2 text-sm text-slate-400">Sign in to the main admin panel first.</p><Link href="/admin" className="mt-4 inline-flex rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black">Open admin login</Link></section> :
      ads.length === 0 ? <section className="rounded-2xl border border-white/10 bg-white/[.03] p-12 text-center"><CheckCircle2 className="mx-auto text-emerald-300" size={32}/><h2 className="mt-4 text-xl font-semibold">No ads awaiting approval</h2><p className="mt-2 text-sm text-slate-400">New submissions from /adv will appear here.</p></section> :
      <><div className="mb-5 flex items-center gap-2 text-sm text-amber-200"><Clock3 size={16}/>{ads.length} advertisement{ads.length === 1 ? "" : "s"} awaiting review</div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{ads.map(ad => <article key={ad.pathname} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.035]">
        <div className="relative flex aspect-[9/12] items-center justify-center bg-black">
          {isVideo(ad) ? <video src={ad.url} controls playsInline className="h-full w-full object-contain"/> : <Image src={ad.url} alt="Advertisement awaiting approval" fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" unoptimized className="object-contain"/>}
          <span className="absolute left-3 top-3 rounded-full border border-amber-200/20 bg-black/75 px-3 py-1 text-xs text-amber-200">{isVideo(ad) ? <Film size={12} className="mr-1 inline"/> : <ImageIcon size={12} className="mr-1 inline"/>} Pending</span>
        </div>
        <div className="p-4">
          <p className="break-all text-xs text-slate-300">{ad.pathname.split("/").pop()}</p>
          <p className="mt-2 text-xs text-slate-500">{sizeLabel(ad.size)} · {new Date(ad.uploadedAt).toLocaleString()}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button disabled={Boolean(busyPath)} onClick={() => void decide(ad, "approve")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-300 px-3 py-2.5 text-sm font-semibold text-emerald-950 disabled:opacity-50">{busyPath === ad.pathname ? "Working…" : <><CheckCircle2 size={15}/> Approve</>}</button>
            <button disabled={Boolean(busyPath)} onClick={() => void decide(ad, "reject")} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300/25 bg-red-300/5 px-3 py-2.5 text-sm font-semibold text-red-200 disabled:opacity-50"><XCircle size={15}/> Reject</button>
          </div>
        </div>
      </article>)}</div></>}
    </div>
  </main>;
}
