"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";

import Image from "next/image";
import { ArrowUpRight, Film, Image as ImageIcon, LockKeyhole, LogOut, Monitor, RefreshCw, ShieldCheck, Sparkles, Trash2, Upload } from "lucide-react";

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
        const mediaFile = await prepareMediaFile(original);
        const media = mediaTypeForFile(mediaFile);
        if (!media) {
          throw new Error("Unsupported format: " + original.name + ". Use JPG, PNG, WebP, GIF, AVIF, HEIC/HEIF, MP4, M4V, MOV, or WebM.");
        }
        if (mediaFile.size > MAX_MEDIA_SIZE) {
          throw new Error(original.name + " is larger than the 50 MB limit.");
        }
        // Get a short-lived, single-use Pi upload ticket through our authenticated server route.
        const ticketResponse = await fetch("/api/adv/ads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create-upload-ticket",
            maxBytes: mediaFile.size,
          }),
        });
        const ticketData = await ticketResponse.json();
        if (
          !ticketResponse.ok ||
          typeof ticketData.ticket !== "string" ||
          typeof ticketData.uploadUrl !== "string"
        ) {
          throw new Error(ticketData.error || "Could not prepare Pi upload.");
        }

        const formData = new FormData();
        formData.append("file", mediaFile, mediaFile.name);
        formData.append("title", original.name.replace(/\\.[^.]+$/, "").slice(0, 80));

        // The permanent Pi token never enters the browser; only the expiring ticket does.
        const uploadResponse = await fetch(ticketData.uploadUrl, {
          method: "POST",
          headers: { Authorization: "Bearer " + ticketData.ticket },
          body: formData,
        });
        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok) {
          throw new Error(uploadResult.error || "Pi upload failed.");
        }
        completed += 1;
      }
      setFiles([]);
      const input = document.getElementById("ad-files") as HTMLInputElement | null;
      if (input) input.value = "";
      setMessage(completed + (completed === 1 ? " advertisement submitted." : " advertisements submitted.") + " They stay hidden from kiosk playback until an admin approves them in /admin/ads.");
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
    return (
      <main className="relative isolate grid min-h-screen place-items-center overflow-hidden bg-[#05070b] text-slate-200">
        <CinematicBackdrop />
        <div className="relative z-10 flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-slate-300 shadow-2xl backdrop-blur-xl">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#a9c0ff]" />
          Loading secure creative workspace…
        </div>
      </main>
    );
  }

  return (
    <main id="top" className="relative isolate min-h-screen overflow-hidden bg-[#05070b] text-[#edf0f7] selection:bg-[#c2d2ff] selection:text-[#09101c]">
      <CinematicBackdrop />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-px bg-gradient-to-r from-transparent via-[#9cb8ff]/70 to-transparent" />
      <div className="relative z-10 mx-auto w-full max-w-[1480px] px-4 pb-10 sm:px-6 lg:px-10">
        <header className="flex min-h-[84px] items-center justify-between gap-4 border-b border-white/[0.09]">
          <a href="/" className="group flex items-center gap-3" aria-label="Arkout home">
            <span className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-white/15 bg-white shadow-[0_0_35px_rgba(113,149,231,.15)]">
              <Image src="/favicon.ico" alt="Arkout logo" fill sizes="44px" unoptimized className="object-cover" />
            </span>
            <span>
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-white">Arkout <span className="text-[#9eb8ff]">/</span> Studio</span>
              <span className="mt-1 block text-[11px] text-slate-500">Advertisement operations</span>
            </span>
          </a>
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 sm:flex">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/45" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
              <span className="text-[10px] font-medium tracking-[0.08em] text-slate-400">{authenticated ? "PRIVATE WORKSPACE" : "SECURE ACCESS"}</span>
            </div>
            {authenticated && <button disabled={busy} onClick={() => void logout()} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 text-xs font-semibold text-slate-200 transition hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-50"><LogOut size={15} /> Sign out</button>}
          </div>
        </header>

        {!configured ? (
          <section className="grid min-h-[calc(100svh-165px)] items-center gap-10 py-12 lg:grid-cols-[1.1fr_.9fr] lg:gap-16 lg:py-16">
            <div>
              <p className="mb-6 flex items-center gap-3 font-mono text-[9px] font-semibold tracking-[0.2em] text-[#a8bdff]"><span className="h-px w-8 bg-[#a8bdff]" />CREATIVE OPERATIONS / SETUP</p>
              <h1 className="max-w-[740px] text-[clamp(48px,7.8vw,94px)] font-medium leading-[0.9] tracking-[-0.085em] text-white">Make every<br />screen a <span className="font-normal text-[#9ca6bb]">canvas.</span></h1>
              <p className="mt-7 max-w-[515px] text-sm leading-7 text-slate-400 sm:text-base">A private workspace for the images and films that appear on Arkout kiosk screens. Access stays closed until the portal credentials and media storage are configured.</p>
              <div className="mt-9 grid max-w-[570px] gap-3 sm:grid-cols-3">
                {[["01","Private access"],["02","Media validation"],["03","Kiosk playlist"]].map(([n,label]) => <div key={n} className="border-t border-white/15 pt-3"><span className="font-mono text-[9px] text-[#8fa8ea]">{n}</span><p className="mt-2 text-xs text-slate-300">{label}</p></div>)}
              </div>
            </div>
            <section className="relative overflow-hidden rounded-[28px] border border-amber-200/20 bg-[#0c1018]/85 p-6 shadow-[0_30px_100px_rgba(0,0,0,.35)] backdrop-blur-2xl sm:p-9">
              <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-amber-200/[0.04] blur-3xl" />
              <div className="relative">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-amber-200/20 bg-amber-100/[0.06] text-amber-200"><ShieldCheck size={23} /></span>
                <p className="mt-6 font-mono text-[9px] font-semibold tracking-[0.18em] text-amber-200/80">ACTION REQUIRED</p>
                <h2 className="mt-2 text-2xl font-medium tracking-[-0.045em] text-white">Studio setup required</h2>
                <p className="mt-3 text-sm leading-7 text-slate-400">The portal is securely unavailable until these server-side environment variables are added in Vercel. Never place their values in client code or Git.</p>
                <div className="mt-6 space-y-2">
                  {["ADV_PORTAL_USERNAME","ADV_PORTAL_PASSWORD","ADV_SESSION_SECRET (32+ characters)","ARKOUT_ADS_API_TOKEN","ARKOUT_ADS_API_BASE_URL (optional)"].map((name) => <div key={name} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-3 font-mono text-[10px] text-slate-300 sm:text-xs"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-200/70" />{name}</div>)}
                </div>
                <p className="mt-5 text-[11px] leading-5 text-slate-500">Once configured, this page will switch to the authenticated campaign workspace.</p>
              </div>
            </section>
          </section>
        ) : !authenticated ? (
          <section className="grid min-h-[calc(100svh-165px)] items-center gap-10 py-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:py-16">
            <div>
              <p className="mb-6 flex items-center gap-3 font-mono text-[9px] font-semibold tracking-[0.2em] text-[#a8bdff]"><span className="h-px w-8 bg-[#a8bdff]" />ARKOUT CREATIVE STUDIO / 01</p>
              <h1 className="max-w-[750px] text-[clamp(48px,7.8vw,96px)] font-medium leading-[0.9] tracking-[-0.085em] text-white">Campaigns<br />in <span className="font-normal text-[#9ca6bb]">motion.</span></h1>
              <p className="mt-7 max-w-[490px] text-sm leading-7 text-slate-400 sm:text-base">A considered home for the visuals on your kiosk screens. Upload campaign artwork, manage the media library, and keep every asset organized in one private workspace.</p>
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-[#a8bdff]" /> Protected sign-in</span>
                <span className="inline-flex items-center gap-2"><ImageIcon size={15} className="text-[#a8bdff]" /> Image & video assets</span>
                <span className="inline-flex items-center gap-2"><Monitor size={15} className="text-[#a8bdff]" /> Portrait kiosk format</span>
              </div>
              <div className="relative mt-12 hidden max-w-[510px] border-t border-white/10 pt-5 md:block">
                <p className="font-mono text-[8px] tracking-[0.16em] text-slate-500">DESIGNED FOR THE SCREEN, BUILT FOR THE MOMENT</p>
                <div className="mt-4 flex items-center gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.035] text-[#a8bdff]"><Sparkles size={20} /></div>
                  <p className="max-w-sm text-xs leading-6 text-slate-400">Keep the visual experience calm, high-contrast, and suited to a vertically mounted kiosk display.</p>
                </div>
              </div>
            </div>
            <section className="relative mx-auto w-full max-w-[470px] overflow-hidden rounded-[30px] border border-white/[0.12] bg-[#0b0e15]/85 p-6 shadow-[0_32px_110px_rgba(0,0,0,.5)] backdrop-blur-2xl sm:p-9">
              <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#6384df]/[0.12] blur-3xl" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#afc3ff]/55 to-transparent" />
              <div className="relative">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#a8bdff]/20 bg-[#7897ea]/[0.09] text-[#c3d1ff]"><ShieldCheck size={22} /></span>
                <p className="mt-7 font-mono text-[9px] font-semibold tracking-[0.19em] text-[#a8bdff]">PRIVATE OPERATIONS</p>
                <h2 className="mt-2 text-3xl font-medium tracking-[-0.06em] text-white">Welcome back.</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">Sign in with your authorized marketing credentials to manage kiosk media.</p>
                <form onSubmit={login} className="mt-7 space-y-4">
                  <label className="block text-xs font-medium text-slate-300">Username
                    <input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={200} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#06080d]/80 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#a8bdff]/60 focus:ring-2 focus:ring-[#a8bdff]/10" placeholder="Your studio username" />
                  </label>
                  <label className="block text-xs font-medium text-slate-300">Password
                    <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={512} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#06080d]/80 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#a8bdff]/60 focus:ring-2 focus:ring-[#a8bdff]/10" placeholder="Your password" />
                  </label>
                  <button disabled={busy} type="submit" className="group mt-2 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#e8ecf5] px-4 text-sm font-semibold text-[#0a0d14] transition duration-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Authenticating…" : "Enter creative studio"} <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></button>
                </form>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-4 text-[10px] text-slate-500"><span className="inline-flex items-center gap-2"><LockKeyhole size={13} /> HTTP-only session</span><span>Authorized users only</span></div>
              </div>
            </section>
          </section>
        ) : (
          <>
            <section className="relative grid gap-7 pb-10 pt-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)] lg:items-end lg:pt-14">
              <div>
                <p className="mb-5 flex items-center gap-3 font-mono text-[9px] font-semibold tracking-[0.2em] text-[#a8bdff]"><span className="h-px w-8 bg-[#a8bdff]" />CREATIVE OPERATIONS / 01</p>
                <h1 className="text-[clamp(42px,6.2vw,76px)] font-medium leading-[0.92] tracking-[-0.08em] text-white">Make every<br /><span className="font-normal text-[#9ca6bb]">impression count.</span></h1>
                <p className="mt-5 max-w-[580px] text-sm leading-7 text-slate-400">Upload, review and maintain the image and video assets that feed the kiosk&apos;s idle-time slideshow.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="rounded-2xl border border-white/[0.1] bg-white/[0.035] p-4 backdrop-blur-xl sm:p-5"><p className="font-mono text-[8px] tracking-[0.15em] text-slate-500">LIBRARY ASSETS</p><p className="mt-3 text-3xl font-light tracking-[-0.06em] text-white">{ads.length.toString().padStart(2,"0")}</p><p className="mt-1 text-[10px] text-slate-500">Uploaded media</p></div>
                <div className="rounded-2xl border border-white/[0.1] bg-white/[0.035] p-4 backdrop-blur-xl sm:p-5"><p className="font-mono text-[8px] tracking-[0.15em] text-slate-500">DISPLAY FORMAT</p><p className="mt-3 text-3xl font-light tracking-[-0.06em] text-white">9:16</p><p className="mt-1 text-[10px] text-slate-500">Portrait · 1080 × 1920</p></div>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
              <div className="relative overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#0c1018]/85 p-5 shadow-[0_24px_80px_rgba(0,0,0,.23)] backdrop-blur-2xl sm:p-8">
                <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-[#6889e7]/[0.06] blur-3xl" />
                <div className="relative">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><p className="font-mono text-[9px] font-semibold tracking-[0.17em] text-[#a8bdff]">CAMPAIGN ASSETS</p><h2 className="mt-2 text-2xl font-medium tracking-[-0.05em] text-white sm:text-3xl">Upload creative</h2><p className="mt-2 max-w-xl text-xs leading-6 text-slate-400 sm:text-sm">Add images and video for the idle-time kiosk playlist. Media stays separate from customer documents.</p></div>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#b9caff]"><Upload size={19} /></span>
                  </div>
                  <div role="note" aria-label="Vertical kiosk media requirements" className="mt-6 rounded-2xl border border-[#a9beff]/15 bg-[#9bb4ff]/[0.045] p-4 text-xs leading-6 text-slate-300 sm:p-5">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-[#d6e0ff]"><Monitor size={15} /> Portrait display / 9:16</div>
                    Recommended <strong>1080 × 1920</strong>. Images appear for about 10 seconds; videos play until they finish. Best cross-device formats are JPG/PNG/WebP and MP4 (H.264 + AAC). HEIC/HEIF photos are converted in your browser when supported. MOV is accepted, but HEVC/H.265 may not play on every kiosk. Landscape media is fitted without cropping and may show black margins.
                  </div>
                  <form onSubmit={upload} className="mt-6 space-y-4">
                    <label htmlFor="ad-files" className="group block cursor-pointer rounded-2xl border border-dashed border-white/[0.18] bg-[#05070b]/65 p-5 transition duration-200 hover:border-[#a8bdff]/45 hover:bg-[#0b101a]/85 sm:p-7">
                      <span className="flex flex-wrap items-center gap-4">
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#b9caff] transition group-hover:border-[#a8bdff]/30 group-hover:bg-[#a8bdff]/[0.08]"><Upload size={20} /></span>
                        <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold text-white">Choose images or videos</strong><span className="mt-1 block text-xs leading-5 text-slate-500">JPG, PNG, WebP, GIF, AVIF, HEIC/HEIF, MP4, M4V, MOV or WebM · up to 50 MB each</span></span>
                        <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/15 px-3 text-[10px] font-semibold text-slate-200">Browse files <ArrowUpRight size={14} /></span>
                      </span>
                      <input id="ad-files" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,video/mp4,video/x-m4v,video/quicktime,video/webm,.heic,.heif,.mov,.m4v,.mp4,.webm" onChange={selectFiles} className="mt-5 block w-full cursor-pointer text-xs text-slate-400 file:mr-3 file:rounded-full file:border-0 file:bg-[#e9edf7] file:px-4 file:py-2.5 file:text-xs file:font-semibold file:text-[#111622] hover:file:bg-white" />
                    </label>

                    {files.length > 0 && <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4"><div className="mb-3 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-white">{files.length} file(s) selected</span><span className="text-slate-500">Review before uploading</span></div><div className="space-y-2">{files.map((item) => <div key={item.name + item.lastModified} className="flex min-w-0 items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#a8bdff]/[0.08] text-[#b8caff]">{item.type.startsWith("video/") ? <Film size={15} /> : <ImageIcon size={15} />}</span><span className="min-w-0 flex-1 truncate text-xs text-slate-300">{item.name}</span><span className="shrink-0 text-[10px] text-slate-500">{formatSize(item.size)}</span></div>)}</div></div>}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
                      <span className="text-[10px] text-slate-500">Uploads use a private authenticated session.</span>
                      <button disabled={busy || files.length === 0 || Boolean(files.find((item) => item.size > MAX_MEDIA_SIZE || !mediaTypeForFile(item)))} type="submit" className="group inline-flex min-h-11 items-center justify-center gap-3 rounded-full bg-[#e8ecf5] px-5 text-xs font-semibold text-[#0a0d14] transition duration-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Uploading media…" : "Upload selected media"} <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></button>
                    </div>
                  </form>
                </div>
              </div>

              <aside className="relative overflow-hidden rounded-[28px] border border-white/[0.11] bg-[#0b0e15]/85 p-5 shadow-[0_24px_80px_rgba(0,0,0,.22)] backdrop-blur-2xl sm:p-7">
                <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#6889e7]/[0.08] blur-3xl" />
                <div className="relative flex items-center justify-between gap-3"><div><p className="font-mono text-[9px] font-semibold tracking-[0.17em] text-[#a8bdff]">SCREEN PREVIEW</p><h2 className="mt-2 text-xl font-medium tracking-[-0.04em] text-white">Portrait by design.</h2></div><span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.05] px-3 py-1.5 text-[9px] text-emerald-200">9:16 FORMAT</span></div>
                <div className="relative mx-auto mt-6 w-full max-w-[250px]">
                  <div className="absolute inset-x-5 bottom-0 top-8 rounded-[40px] bg-[#7897ea]/[0.12] blur-2xl" />
                  <div className="relative aspect-[9/16] overflow-hidden rounded-[24px] border border-white/15 bg-[#07090d] p-2 shadow-[0_25px_70px_rgba(0,0,0,.55)]">
                    <div className="relative flex h-full flex-col overflow-hidden rounded-[17px] border border-white/[0.07] bg-[radial-gradient(ellipse_at_55%_38%,rgba(63,100,179,.3),transparent_56%),linear-gradient(145deg,#0c111e,#050609)] p-4">
                      <div className="flex items-center justify-between font-mono text-[6px] tracking-[0.15em] text-slate-500"><span>ARKOUT / MEDIA</span><span className="flex gap-1"><i className="h-1 w-1 rounded-full bg-white/20" /><i className="h-1 w-1 rounded-full bg-white/20" /><i className="h-1 w-1 rounded-full bg-[#adc1ff]" /></span></div>
                      <div className="my-auto">
                        <div className="relative mx-auto h-20 w-20 rounded-full border border-[#9eb8ff]/25 bg-[#9eb8ff]/[0.04] shadow-[0_0_35px_rgba(116,148,226,.12)]"><div className="absolute inset-3 rounded-full border border-white/10" /><div className="absolute inset-0 grid place-items-center text-[#bdcdff]"><Sparkles size={24} /></div></div>
                        <p className="mt-5 text-center text-[10px] font-medium tracking-[0.08em] text-white">Your campaign here</p>
                        <p className="mt-2 text-center text-[7px] leading-4 text-slate-500">Portrait content · Fit without crop</p>
                      </div>
                      <div className="border-t border-white/[0.09] pt-3"><div className="h-1 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full w-2/3 rounded-full bg-[#a8bdff]/70" /></div><p className="mt-2 font-mono text-[6px] tracking-[0.14em] text-slate-600">IDLE-TIME PLAYLIST</p></div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 border-t border-white/[0.08] pt-4">
                  <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-[#b8caff]"><ShieldCheck size={16} /></span><div><p className="text-xs font-semibold text-slate-200">Private media workspace</p><p className="mt-1 text-[10px] text-slate-500">No printer, payment or revenue controls</p></div></div>
                  <button disabled={busy} onClick={() => void loadAds()} className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[0.05] disabled:opacity-50"><RefreshCw size={14} /> Refresh library</button>
                  <p className="mt-3 break-all text-[10px] text-slate-600">Playlist feed · <code className="text-slate-400">/api/adv/playlist</code></p>
                </div>
              </aside>
            </section>

            <section id="library" className="pt-12">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.1] pb-5">
                <div><p className="font-mono text-[9px] font-semibold tracking-[0.18em] text-[#a8bdff]">ASSET MANAGEMENT / 02</p><h2 className="mt-2 text-2xl font-medium tracking-[-0.05em] text-white sm:text-3xl">Advertisement library <span className="ml-2 align-middle font-mono text-xs text-slate-500">[{ads.length.toString().padStart(2,"0")}]</span></h2><p className="mt-2 text-xs leading-6 text-slate-500">Review the stored creative and remove assets that are no longer needed.</p></div>
                <button disabled={busy} onClick={() => void loadAds()} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.07] disabled:opacity-50"><RefreshCw size={14} /> Refresh assets</button>
              </div>
              {ads.length === 0 ? (
                <div className="relative overflow-hidden rounded-[26px] border border-dashed border-white/[0.14] bg-white/[0.02] px-5 py-14 text-center sm:py-20">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(100,130,202,.08),transparent_55%)]" />
                  <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#a8bdff]"><ImageIcon size={23} /></div>
                  <h3 className="relative mt-5 text-lg font-medium text-white">Your next campaign starts here.</h3>
                  <p className="relative mx-auto mt-2 max-w-md text-xs leading-6 text-slate-500">Upload a creative file to begin building the idle-time playlist. Images and video will appear here after upload.</p>
                  <a href="#top" className="relative mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#bdcbff] hover:text-white">Back to upload <ArrowUpRight size={14} /></a>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {ads.map((ad) => {
                    const video = isVideoAsset(ad);
                    return <article key={ad.pathname} className="group overflow-hidden rounded-[22px] border border-white/[0.11] bg-[#0b0e14]/80 shadow-[0_12px_45px_rgba(0,0,0,.16)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/20">
                      <div className="relative mx-auto aspect-[9/16] max-h-[420px] overflow-hidden bg-[#050609]">
                        {video ? <video src={ad.url} controls muted playsInline preload="metadata" className="h-full w-full object-contain" aria-label="Advertisement video preview" /> : <img src={ad.url} alt="Advertisement preview" className="h-full w-full object-contain" />}
                        <div className="pointer-events-none absolute inset-0 border border-white/[0.04]" />
                      </div>
                      <div className="p-4">
                        <div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#a8bdff]">{video ? <Film size={15} /> : <ImageIcon size={15} />}</span><div className="min-w-0 flex-1"><p className="break-all text-xs font-semibold leading-5 text-white">{ad.pathname.split("/").at(-1)}</p><p className="mt-1 text-[10px] text-slate-500">{video ? "Video" : "Image"} · {formatSize(ad.size)}</p></div></div>
                        <p className="mt-3 text-[10px] text-slate-600">{new Date(ad.uploadedAt).toLocaleString()}</p>
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3"><a href={ad.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#bdcbff] transition hover:text-white">Open media <ArrowUpRight size={13} /></a><button aria-label="Delete advertisement" disabled={busy} onClick={() => void removeAd(ad.pathname)} className="inline-flex items-center gap-1.5 rounded-full border border-red-200/15 px-3 py-2 text-[10px] font-semibold text-red-200/80 transition hover:border-red-200/30 hover:bg-red-300/[0.07] disabled:opacity-50"><Trash2 size={13} /> Delete</button></div>
                      </div>
                    </article>;
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {(message || error) && <div aria-live="polite" className={"mt-7 rounded-2xl border p-4 text-sm shadow-xl backdrop-blur-xl " + (error ? "border-red-300/25 bg-red-300/[0.07] text-red-100" : "border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-100")}>{error || message}</div>}
        <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-5 text-[10px] text-slate-600">
          <span>ARKOUT / CREATIVE OPERATIONS</span>
          <span>Protected workspace · Customer and revenue data remain separate</span>
        </footer>
      </div>
    </main>
  );
}

function CinematicBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#05070b]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_63%_31%,rgba(62,93,143,.17),transparent_42%),radial-gradient(ellipse_at_14%_78%,rgba(43,62,104,.14),transparent_39%),linear-gradient(125deg,#050609_0%,#070a11_54%,#030407_100%)]" />
      <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(165,190,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(165,190,255,.12)_1px,transparent_1px)] [background-size:70px_70px] [mask-image:linear-gradient(90deg,transparent_0%,#000_30%,#000_74%,transparent_100%)]" />
      <div className="absolute right-[-17%] top-[2%] h-[72vh] w-[64vw] rounded-full bg-[#335b9f]/[0.08] blur-[120px]" />
      <svg viewBox="0 0 1000 820" className="absolute right-[-10%] top-[2%] h-[90vh] min-h-[560px] w-[min(85vw,1050px)] opacity-40 [mask-image:linear-gradient(90deg,transparent_0%,#000_24%,#000_85%,transparent_100%)]" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <defs>
          <linearGradient id="adv-wire" x1="220" y1="100" x2="790" y2="670" gradientUnits="userSpaceOnUse"><stop stopColor="#7899dc" stopOpacity=".2" /><stop offset=".45" stopColor="#c4d4ff" stopOpacity=".65" /><stop offset="1" stopColor="#557dbb" stopOpacity=".14" /></linearGradient>
          <radialGradient id="adv-halo"><stop stopColor="#7195e6" stopOpacity=".14" /><stop offset="1" stopColor="#7195e6" stopOpacity="0" /></radialGradient>
          <filter id="adv-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <ellipse cx="595" cy="392" rx="340" ry="325" fill="url(#adv-halo)" stroke="none" />
        <g stroke="url(#adv-wire)" strokeWidth="1.2">
          <path d="M380 168 535 95 740 150 586 224Z" />
          <path d="M380 168V515L586 594V224" />
          <path d="M586 224 740 150V472L586 594" />
          <path d="M407 184 535 124 708 170 579 231" strokeOpacity=".35" />
          <path d="M408 202 408 487 558 545V245" strokeOpacity=".35" />
          <path d="M612 235 720 180V453L612 552" strokeOpacity=".35" />
          <path d="M425 223 565 268 565 371 425 320Z" />
          <path d="M441 232 550 267V353L441 314Z" />
          <path d="M430 335 565 383 565 399 430 352Z" />
          <path d="M454 369 542 401V408L454 376Z" strokeOpacity=".55" />
          <path d="M434 418 563 465V498L434 451Z" />
          <path d="M452 430 546 464M452 442 546 476" strokeOpacity=".48" />
          <path d="M426 491 563 540V573L426 522Z" />
          <path d="M612 260 704 211V273L612 322Z" />
          <path d="M612 342 704 293V354L612 403Z" />
          <path d="M612 424 704 375V433L612 483Z" />
          <path d="M624 273 690 238M624 286 690 251M624 355 690 320M624 367 690 332" strokeOpacity=".42" />
          <path d="M365 520 588 605 762 495" strokeOpacity=".35" />
          <path d="M365 520 343 556 566 641 762 535 762 495" strokeOpacity=".65" />
          <path d="M343 556 343 578 565 664 762 557 762 535" strokeOpacity=".38" />
          <path d="M380 168 380 146 535 73 760 133 760 150" strokeOpacity=".25" />
          <path d="M480 131V152M500 122V145M520 115V138M540 119V140" strokeOpacity=".65" />
        </g>
        <g stroke="#c8d8ff" strokeOpacity=".7" strokeWidth="1" filter="url(#adv-glow)">
          <path d="M426 216 558 261V377L426 330Z" strokeOpacity=".48" />
          <path d="M454 531 542 563" strokeOpacity=".4" />
          <circle cx="535" cy="95" r="3" fill="#c8d8ff" stroke="none" />
          <circle cx="740" cy="150" r="3" fill="#c8d8ff" stroke="none" />
          <circle cx="586" cy="594" r="3" fill="#c8d8ff" stroke="none" />
        </g>
        <g stroke="#8da9ea" strokeOpacity=".22" strokeWidth="1">
          <path d="M90 710 920 710M145 676 876 676M204 642 834 642M262 608 790 608" />
          <path d="M210 620 95 810M300 620 235 810M390 620 370 810M480 620 505 810M570 620 640 810M660 620 775 810M750 620 905 810" />
        </g>
        <ellipse cx="570" cy="681" rx="245" ry="16" fill="#6689d6" fillOpacity=".08" stroke="none" filter="url(#adv-glow)" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-[28vh] bg-gradient-to-t from-[#030407] via-[#030407]/65 to-transparent" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,7,11,.24),transparent_55%,rgba(5,7,11,.15)),linear-gradient(0deg,rgba(5,7,11,.25),transparent_50%)]" />
    </div>
  );
}
