"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { upload as uploadBlob } from "@vercel/blob/client";
import { Image as ImageIcon, LogOut, RefreshCw, ShieldCheck, Trash2, Upload } from "lucide-react";

type AdAsset = {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: string;
  contentType: string;
};

const MAX_MEDIA_SIZE = 50 * 1024 * 1024;

type MediaType = { extension: string; contentType: string; video: boolean };

function mediaTypeForFile(file: File): MediaType | null {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const types: Record<string, MediaType> = {
    jpg: { extension: "jpg", contentType: "image/jpeg", video: false },
    jpeg: { extension: "jpg", contentType: "image/jpeg", video: false },
    png: { extension: "png", contentType: "image/png", video: false },
    webp: { extension: "webp", contentType: "image/webp", video: false },
    gif: { extension: "gif", contentType: "image/gif", video: false },
    avif: { extension: "avif", contentType: "image/avif", video: false },
    heic: { extension: "heic", contentType: "image/heic", video: false },
    heif: { extension: "heif", contentType: "image/heif", video: false },
    mp4: { extension: "mp4", contentType: "video/mp4", video: true },
    m4v: { extension: "m4v", contentType: "video/x-m4v", video: true },
    mov: { extension: "mov", contentType: "video/quicktime", video: true },
    webm: { extension: "webm", contentType: "video/webm", video: true },
  };
  return types[extension] || null;
}

function isVideoAsset(ad: AdAsset) {
  return ad.contentType.startsWith("video/") || /\.(mp4|m4v|mov|webm)$/i.test(ad.pathname);
}

function makeUploadId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    return (char === "x" ? random : (random & 0x3 | 0x8)).toString(16);
  });
}

async function prepareMediaFile(source: File): Promise<File> {
  if (!/\.(heic|heif)$/i.test(source.name)) return source;
  try {
    // Convert iPhone HEIC/HEIF photos to JPEG in the uploader's browser so the kiosk
    // does not depend on native HEIC decoder support.
    const bitmap = await createImageBitmap(source);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image conversion is unavailable.");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("JPEG conversion failed.")), "image/jpeg", 0.92);
    });
    const name = source.name.replace(/\.(heic|heif)$/i, ".jpg");
    return new File([blob], name, { type: "image/jpeg", lastModified: source.lastModified });
  } catch {
    throw new Error("This browser could not convert the Apple HEIC/HEIF photo. Export it as JPEG in Photos/Files and upload again.");
  }
}

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
  const [files, setFiles] = useState<File[]>([]);
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
    if (files.length === 0) {
      setError("Choose at least one image or video first.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    let completed = 0;
    try {
      for (const original of files) {
        let mediaFile = await prepareMediaFile(original);
        const media = mediaTypeForFile(mediaFile);
        if (!media) {
          throw new Error("Unsupported format: " + original.name + ". Use JPG, PNG, WebP, GIF, AVIF, HEIC/HEIF, MP4, M4V, MOV, or WebM.");
        }
        if (mediaFile.size > MAX_MEDIA_SIZE) {
          throw new Error(original.name + " is larger than the 50 MB limit.");
        }
        // Keep the storage key random and extension-based; the API independently
        // validates both the user's session and the allowed extension/content type.
        const pathname = "arkout-ads/" + Date.now() + "-" + makeUploadId() + "." + media.extension;
        await uploadBlob(pathname, mediaFile, {
          access: "public",
          handleUploadUrl: "/api/adv/ads",
          contentType: media.contentType,
          multipart: mediaFile.size > 5 * 1024 * 1024,
        });
        completed += 1;
      }
      setFiles([]);
      const input = document.getElementById("ad-files") as HTMLInputElement | null;
      if (input) input.value = "";
      setMessage(completed + (completed === 1 ? " advertisement uploaded." : " advertisements uploaded.") + " The kiosk playlist will rotate through available assets while idle.");
      await loadAds();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Upload failed.";
      setError((completed > 0 ? completed + " file(s) uploaded before the issue. " : "") + detail);
      await loadAds().catch(() => undefined);
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

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files || []);
    setFiles(picked);
    setError("");
    setMessage("");
    const oversized = picked.find((item) => item.size > MAX_MEDIA_SIZE);
    if (oversized) setError(oversized.name + " is over the 50 MB per-file limit.");
    const unsupported = picked.find((item) => !mediaTypeForFile(item));
    if (unsupported) setError(unsupported.name + " has an unsupported format.");
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
                <p className="mt-3 max-w-2xl leading-7 text-slate-400">Upload multiple images and videos, review the campaign library, and remove outdated assets. Uploads are stored separately from customer documents.</p>
                <div role="note" aria-label="Vertical kiosk media requirements" className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/[0.08] p-4 text-sm leading-6 text-amber-100"><strong className="block text-amber-200">Important: the kiosk screen is vertically mounted.</strong> Upload portrait media in a <strong>9:16 ratio</strong> (recommended <strong>1080 × 1920</strong>). The slideshow shows images for about 10 seconds each and plays videos until they finish. Best cross-device choices: JPG/PNG/WebP photos and MP4 video encoded with H.264 + AAC. iPhone HEIC/HEIF photos are converted to JPEG in your browser when supported. MOV files are accepted, but iPhone HEVC/H.265 videos may not play on every kiosk; export those as <strong>Most Compatible / MP4 (H.264)</strong>. Landscape files are fitted without cropping and may show black margins.</div>
                <form onSubmit={upload} className="mt-7 space-y-4">
                  <label htmlFor="ad-files" className="block rounded-2xl border border-dashed border-white/20 bg-black/20 p-6 text-sm text-slate-300">
                    <span className="mb-2 flex items-center gap-2 font-semibold text-white"><Upload size={18} /> Choose images and videos</span>
                    <span className="block text-slate-400">JPG, PNG, WebP, GIF, AVIF, HEIC/HEIF, MP4, M4V, MOV, or WebM · up to 50 MB each</span>
                    <input id="ad-files" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,video/mp4,video/x-m4v,video/quicktime,video/webm,.heic,.heif,.mov,.m4v,.mp4,.webm" onChange={selectFiles} className="mt-4 block w-full text-sm" />
                  </label>
                  {files.length > 0 && <div className="space-y-1 text-sm text-cyan-200"><p>{files.length} file(s) selected</p>{files.map((item) => <p key={item.name + item.lastModified} className="truncate text-cyan-100/80">{item.name} ({formatSize(item.size)})</p>)}</div>}
                  <button disabled={busy || files.length === 0 || Boolean(files.find((item) => item.size > MAX_MEDIA_SIZE || !mediaTypeForFile(item)))} type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Uploading media…" : "Upload selected media"}</button>
                </form>
              </div>
              <aside className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.04] p-6 sm:p-8">
                <ShieldCheck size={25} className="text-cyan-300" />
                <h2 className="mt-4 text-lg font-bold">Protected by design</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Only authenticated sessions can upload or delete assets. Media is stored separately from customer documents. The kiosk playlist is public and read-only; no printer, payment, maintenance, or revenue controls are exposed here.</p>
                <button disabled={busy} onClick={() => void loadAds()} className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"><RefreshCw size={15} /> Refresh library</button>
                <p className="mt-5 break-all text-xs text-slate-500">Playlist feed: <code>/api/adv/playlist</code></p>
              </aside>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Advertisement library <span className="text-sm font-medium text-slate-400">({ads.length})</span></h2></div>
              {ads.length === 0 ? <div className="rounded-2xl border border-white/10 p-8 text-center text-slate-400">No advertisements uploaded yet.</div> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {ads.map((ad) => {
                  const video = isVideoAsset(ad);
                  return <article key={ad.pathname} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                    <div className="mx-auto aspect-[9/16] max-h-[420px] bg-black/40">
                      {video ? <video src={ad.url} controls muted playsInline preload="metadata" className="h-full w-full object-contain" aria-label="Advertisement video preview" /> : <img src={ad.url} alt="Advertisement preview" className="h-full w-full object-contain" />}
                    </div>
                    <div className="p-4">
                      <p className="break-all text-sm font-semibold">{ad.pathname.split("/").at(-1)}</p>
                      <p className="mt-1 text-xs text-slate-400">{video ? "Video" : "Image"} · {formatSize(ad.size)} · {new Date(ad.uploadedAt).toLocaleString()}</p>
                      <div className="mt-4 flex items-center justify-between gap-3"><a href={ad.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-cyan-300 underline underline-offset-4">Open media</a><button aria-label="Delete advertisement" disabled={busy} onClick={() => void removeAd(ad.pathname)} className="inline-flex items-center gap-2 rounded-lg border border-red-300/20 px-3 py-2 text-sm text-red-200 hover:bg-red-300/10 disabled:opacity-50"><Trash2 size={15} /> Delete</button></div>
                    </div>
                  </article>;
                })}
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
