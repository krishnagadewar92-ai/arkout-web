"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { Image as ImageIcon, LogOut, RefreshCw, ShieldCheck, Trash2, Upload } from "lucide-react";

type AdAsset = {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: string;
  contentType: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdvertisementPortalPage() {
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [ads, setAds] = useState<AdAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAds = useCallback(async () => {
    const response = await fetch("/api/adv/ads", { cache: "no-store" });
    const data = await response.json();
    if (response.status === 401) {
      setAuthenticated(false);
      setAds([]);
      return;
    }
    if (!response.ok) throw new Error(data.error || "Could not load advertisements.");
    setAds(Array.isArray(data.ads) ? data.ads : []);
  }, []);

  const checkSession = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/adv/auth", { cache: "no-store" });
      const data = await response.json();
      setConfigured(Boolean(data.configured));
      setAuthenticated(Boolean(data.authenticated));
      if (data.configured && data.authenticated) {
        await loadAds();
      }
    } catch {
      setError("Could not check the portal session. Refresh and try again.");
    } finally {
      setReady(true);
    }
  }, [loadAds]);

  useEffect(() => { void checkSession(); }, [checkSession]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/adv/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sign-in failed.");
      setPassword("");
      setAuthenticated(true);
      setMessage("You're signed in.");
      await loadAds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a JPG, PNG, or WebP image first.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/adv/ads", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setFile(null);
      const input = document.getElementById("ad-image") as HTMLInputElement | null;
      if (input) input.value = "";
      setMessage("Advertisement saved. The playlist feed is ready; the live kiosk still needs to be connected to consume it.");
      await loadAds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAd(pathname: string) {
    if (!window.confirm("Delete this advertisement? Kiosk playlist consumers will stop receiving it after refresh.")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/adv/ads?pathname=${encodeURIComponent(pathname)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Delete failed.");
      setMessage("Advertisement deleted.");
      await loadAds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/adv/auth", { method: "DELETE" });
      setAuthenticated(false);
      setAds([]);
      setPassword("");
      setMessage("Signed out.");
      setError("");
    } finally {
      setBusy(false);
    }
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setError("");
  }

  if (!ready) {
    return <main className="flex min-h-screen items-center justify-center bg-[#070b14] text-slate-200">Loading secure marketing portal…</main>;
  }

  return (
    <main className="min-h-screen bg-[#070b14] px-4 py-10 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <a href="/" className="flex items-center gap-3" aria-label="Arkout home">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-400 text-slate-950"><ImageIcon size={22} /></span>
            <span><span className="block text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Arkout</span><span className="text-xl font-semibold">Advertisement Portal</span></span>
          </a>
          {authenticated && <button disabled={busy} onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"><LogOut size={16} /> Sign out</button>}
        </header>

        {!configured ? (
          <section className="mx-auto max-w-2xl rounded-3xl border border-amber-300/20 bg-amber-300/5 p-7 sm:p-10">
            <ShieldCheck className="mb-4 text-amber-300" size={30} />
            <h1 className="text-2xl font-bold">Portal setup required</h1>
            <p className="mt-3 leading-7 text-slate-300">Access is closed until server-side credentials are configured. Add these environment variables to the Vercel project; never put their values in client code or Git:</p>
            <ul className="mt-5 list-disc space-y-2 pl-5 font-mono text-sm text-slate-200">
              <li>ADV_PORTAL_USERNAME</li>
              <li>ADV_PORTAL_PASSWORD</li>
              <li>ADV_SESSION_SECRET (32+ characters)</li>
              <li>BLOB_READ_WRITE_TOKEN (connect a Vercel Blob store)</li>
            </ul>
          </section>
        ) : !authenticated ? (
          <section className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl sm:p-9">
            <div className="mb-7">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Restricted access</p>
              <h1 className="mt-2 text-3xl font-bold">Marketing team sign-in</h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">Authorized users only. Your session is protected by a server-signed, HTTP-only cookie.</p>
            </div>
            <form onSubmit={login} className="space-y-4">
              <label className="block text-sm font-medium">Username<input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={200} className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none focus:border-cyan-300" /></label>
              <label className="block text-sm font-medium">Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={512} className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none focus:border-cyan-300" /></label>
              <button disabled={busy} type="submit" className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-50">{busy ? "Checking…" : "Sign in securely"}</button>
            </form>
          </section>
        ) : (
          <>
            <section className="mb-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Campaign assets</p>
                <h1 className="mt-2 text-3xl font-bold">Manage kiosk advertisements</h1>
                <p className="mt-3 max-w-2xl leading-7 text-slate-400">Upload a display-ready image, review the campaign library, and remove outdated assets. Uploads are stored separately from customer documents.</p>
                <form onSubmit={upload} className="mt-7 space-y-4">
                  <label htmlFor="ad-image" className="block rounded-2xl border border-dashed border-white/20 bg-black/20 p-6 text-sm text-slate-300">
                    <span className="mb-2 flex items-center gap-2 font-semibold text-white"><Upload size={18} /> Choose advertisement image</span>
                    <span className="block text-slate-400">JPG, PNG, or WebP · up to 3 MB</span>
                    <input id="ad-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} className="mt-4 block w-full text-sm" />
                  </label>
                  {file && <p className="text-sm text-cyan-200">Selected: {file.name} ({formatSize(file.size)})</p>}
                  <button disabled={busy || !file} type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Working…" : "Upload advertisement"}</button>
                </form>
              </div>
              <aside className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.04] p-6 sm:p-8">
                <ShieldCheck size={25} className="text-cyan-300" />
                <h2 className="mt-4 text-lg font-bold">Protected by design</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Only authenticated sessions can upload or delete assets. The public playlist is read-only. No printer, payment, maintenance, or revenue controls are exposed here. Kiosk-side playlist polling is a separate integration step.</p>
                <button disabled={busy} onClick={() => void loadAds()} className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"><RefreshCw size={15} /> Refresh library</button>
                <p className="mt-5 break-all text-xs text-slate-500">Playlist feed: <code>/api/adv/playlist</code></p>
              </aside>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Advertisement library <span className="text-sm font-medium text-slate-400">({ads.length})</span></h2></div>
              {ads.length === 0 ? <div className="rounded-2xl border border-white/10 p-8 text-center text-slate-400">No advertisements uploaded yet.</div> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {ads.map((ad) => <article key={ad.pathname} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                  <div className="aspect-video bg-black/30"><img src={ad.url} alt="Advertisement preview" className="h-full w-full object-contain" /></div>
                  <div className="p-4">
                    <p className="break-all text-sm font-semibold">{ad.pathname.split("/").at(-1)}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatSize(ad.size)} · {new Date(ad.uploadedAt).toLocaleString()}</p>
                    <div className="mt-4 flex items-center justify-between gap-3"><a href={ad.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-cyan-300 underline underline-offset-4">Open image</a><button aria-label="Delete advertisement" disabled={busy} onClick={() => void removeAd(ad.pathname)} className="inline-flex items-center gap-2 rounded-lg border border-red-300/20 px-3 py-2 text-sm text-red-200 hover:bg-red-300/10 disabled:opacity-50"><Trash2 size={15} /> Delete</button></div>
                  </div>
                </article>)}
              </div>}
            </section>
          </>
        )}

        {(message || error) && <div aria-live="polite" className={`mt-6 rounded-xl border p-4 text-sm ${error ? "border-red-300/20 bg-red-300/5 text-red-200" : "border-emerald-300/20 bg-emerald-300/5 text-emerald-200"}`}>{error || message}</div>}
        <footer className="mt-12 border-t border-white/10 pt-5 text-xs text-slate-500">Restricted marketing tools · Customer and revenue data are not connected to this portal.</footer>
      </div>
    </main>
  );
}
