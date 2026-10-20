"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Activity, AlertTriangle, Archive, CheckCircle2, ChevronRight, Download,
  FileText, LockKeyhole, LogOut, RefreshCw, ShieldCheck, Printer, Settings2,
  Wifi, UploadCloud, XCircle, BarChart3, HardDrive, Network,
} from "lucide-react";

type AuthState = { configured: boolean; authenticated: boolean; gatewayConfigured: boolean };
type Json = Record<string, any>;
type PrinterReading = {
  label?: string; queue?: string; ok?: boolean; state?: string; queued?: number;
  supplies?: { name?: string; level?: number; color?: string }[]; alerts?: string[];
};
type PaperPrinter = { sheets_remaining?: number | null; updated_at?: string | null };
type PaperStock = { printers?: Record<string, PaperPrinter> };
type Job = { id?: string | number; job_id?: string | number; jobId?: string | number; user?: string; title?: string; filename?: string; status?: string; printer?: string; queue?: string; pages?: number; submitted?: string };
type UploadItem = { filename?: string; original_filename?: string; name?: string; pages?: number; uploaded_at?: string; timestamp?: string; uploadedAt?: string; size?: number; status?: string };

async function parseJson(response: Response): Promise<Json> {
  try { return await response.json(); } catch { return {}; }
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers || {}) },
  });
  const data = await parseJson(response);
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed.");
  return data;
}

function apiArray(data: Json | null, keys: string[]): any[] {
  if (!data) return [];
  for (const key of keys) if (Array.isArray(data[key])) return data[key];
  return [];
}

function scalar(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  return "—";
}

function firstDefined(source: Json | null, keys: string[]) {
  if (!source) return undefined;
  for (const key of keys) if (source[key] !== undefined && source[key] !== null) return source[key];
  return undefined;
}

function NumberCard({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon: ReactNode }) {
  return <div className="admin-glass-metric"><div className="admin-metric-top"><span>{label}</span><span className="admin-metric-icon">{icon}</span></div><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

function queueJobs(status: Json | null): Job[] {
  const direct = apiArray(status, ["queue_jobs", "queued_jobs", "jobs", "print_queue", "queueJobs", "pending_jobs"]);
  if (direct.length) return direct;
  if (status?.queue && typeof status.queue === "object") {
    const nested = status.queue as Json;
    return apiArray(nested, ["jobs", "items", "queued"]);
  }
  return [];
}

function recentUploads(data: Json | null): UploadItem[] {
  return apiArray(data, ["uploads", "files", "recent", "documents"]).filter((x) => x && typeof x === "object");
}

function formatRupees(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

export default function ArkoutAdminPage() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [maintenance, setMaintenance] = useState({ enabled: true, message: "Kiosk is under maintenance" });
  const [printers, setPrinters] = useState<PrinterReading[]>([]);
  const [history, setHistory] = useState<Json | null>(null);
  const [status, setStatus] = useState<Json | null>(null);
  const [queueData, setQueueData] = useState<Json | null>(null);
  const [paper, setPaper] = useState<PaperStock | null>(null);
  const [uploadsData, setUploadsData] = useState<Json | null>(null);
  const [revenue, setRevenue] = useState<Json | null>(null);
  const [paperInputs, setPaperInputs] = useState<Record<string, string>>({ Arkout_Color: "", Arkout_BW_Laser: "" });
  const [inkInputs, setInkInputs] = useState<Record<string, string>>({ Black: "", Cyan: "", Magenta: "", Yellow: "" });
  const [duplexByFile, setDuplexByFile] = useState<Record<string, boolean>>({});

  const loadDashboard = useCallback(async () => {
    setRefreshing(true);
    setError("");
    const requests = await Promise.allSettled([
      api("/api/admin/proxy/api/status"),
      api("/api/admin/proxy/api/admin/maintenance"),
      api("/api/admin/proxy/api/printer/telemetry"),
      api("/api/admin/proxy/api/printer/history"),
      api("/api/admin/proxy/api/paper-stock"),
      api("/api/admin/proxy/api/uploads/recent"),
      api("/api/admin/proxy/api/revenue/history"),
      api("/api/admin/proxy/api/printer/queue"),
    ]);
    if (requests[0].status === "fulfilled") setStatus(requests[0].value);
    if (requests[1].status === "fulfilled") {
      const m = requests[1].value;
      setMaintenance({ enabled: m.enabled === true, message: typeof m.message === "string" ? m.message : "Kiosk is under maintenance" });
    }
    if (requests[2].status === "fulfilled") setPrinters(Array.isArray(requests[2].value.printers) ? requests[2].value.printers : []);
    if (requests[3].status === "fulfilled") setHistory(requests[3].value);
    if (requests[4].status === "fulfilled") {
      const p = requests[4].value as PaperStock;
      setPaper(p);
      setPaperInputs({
        Arkout_Color: p.printers?.Arkout_Color?.sheets_remaining == null ? "" : String(p.printers.Arkout_Color.sheets_remaining),
        Arkout_BW_Laser: p.printers?.Arkout_BW_Laser?.sheets_remaining == null ? "" : String(p.printers.Arkout_BW_Laser.sheets_remaining),
      });
    }
    if (requests[5].status === "fulfilled") setUploadsData(requests[5].value);
    if (requests[6].status === "fulfilled") setRevenue(requests[6].value);
    if (requests[7].status === "fulfilled") setQueueData(requests[7].value);
    const failures = requests.filter((result) => result.status === "rejected");
    if (failures.length) setError((failures[0] as PromiseRejectedResult).reason instanceof Error
      ? (failures[0] as PromiseRejectedResult).reason.message
      : "One or more dashboard readings could not be loaded.");
    setRefreshing(false);
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const result = await api("/api/admin/auth");
      const next = { configured: Boolean(result.configured), authenticated: Boolean(result.authenticated), gatewayConfigured: Boolean(result.gatewayConfigured) };
      setAuth(next);
      if (next.authenticated && next.gatewayConfigured) await loadDashboard();
    } catch {
      setError("Could not reach the admin portal sign-in endpoint.");
    }
  }, [loadDashboard]);

  useEffect(() => { void checkSession(); }, [checkSession]);

  useEffect(() => {
    if (!auth?.authenticated || !auth.gatewayConfigured) return;
    const timer = window.setInterval(() => { void loadDashboard(); }, 30000);
    return () => window.clearInterval(timer);
  }, [auth?.authenticated, auth?.gatewayConfigured, loadDashboard]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api("/api/admin/auth", { method: "POST", body: JSON.stringify({ username, password }) });
      setPassword("");
      setAuth({ configured: true, authenticated: true, gatewayConfigured: Boolean(result.gatewayConfigured) });
      setNotice("Secure sign-in successful.");
      if (result.gatewayConfigured) await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true);
    try {
      await api("/api/admin/auth", { method: "DELETE" });
      setAuth((current) => current ? { ...current, authenticated: false } : current);
      setPrinters([]); setHistory(null); setStatus(null); setQueueData(null); setPaper(null); setUploadsData(null); setRevenue(null);
      setNotice("Signed out.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not sign out."); }
    finally { setBusy(false); }
  }

  async function setMaintenanceState(enabled: boolean) {
    if (!enabled && !window.confirm("Reopen Terminal 02 checkout for customers? Confirm the physical kiosk is ready first.")) return;
    const nextMessage = maintenance.message.trim() || "Kiosk is under maintenance";
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await api("/api/admin/proxy/api/admin/maintenance", { method: "POST", body: JSON.stringify({ enabled, message: nextMessage }) });
      setMaintenance({ enabled: data.enabled === true, message: typeof data.message === "string" ? data.message : nextMessage });
      setNotice(enabled ? "Terminal 02 maintenance enabled." : "Terminal 02 checkout reopened.");
    } catch (e) { setError(e instanceof Error ? e.message : "Maintenance update failed."); }
    finally { setBusy(false); }
  }

  async function savePaperStock(queue: string) {
    const raw = paperInputs[queue] || "";
    if (raw.trim() === "" || !Number.isInteger(Number(raw)) || Number(raw) < 0 || Number(raw) > 10000) {
      setError("Enter a physically checked whole-sheet count from 0 to 10000."); return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/admin/proxy/api/paper-stock", { method: "POST", body: JSON.stringify({ printer: queue, sheets_remaining: Number(raw) }) });
      await loadDashboard(); setNotice("Manual paper-stock estimate saved for " + queue + ".");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save paper stock."); }
    finally { setBusy(false); }
  }

  async function saveInk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values: Record<string, number> = {};
    for (const name of ["Black", "Cyan", "Magenta", "Yellow"]) {
      const raw = inkInputs[name];
      if (raw.trim() === "" || !Number.isFinite(Number(raw)) || Number(raw) < 0 || Number(raw) > 100) {
        setError("Enter all four manual ink values from 0 to 100."); return;
      }
      values[name] = Number(raw);
    }
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/admin/proxy/api/ink", { method: "POST", body: JSON.stringify(values) });
      setNotice("Manual supply estimates saved."); await loadDashboard();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save manual supply estimates."); }
    finally { setBusy(false); }
  }

  async function operatorAction(path: string, label: string) {
    const prompt = label === "Send backup to Telegram"
      ? "Send the configured local database backup to Telegram?"
      : "Run “" + label + "”? Check that this action is appropriate before proceeding.";
    if (!window.confirm(prompt)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/admin/proxy/" + path, { method: "POST", body: JSON.stringify({}) });
      setNotice(label + " completed."); await loadDashboard();
    } catch (e) { setError(e instanceof Error ? e.message : label + " failed."); }
    finally { setBusy(false); }
  }

  async function cancelPrintJob(job: Job) {
    const jobId = job.job_id ?? job.jobId ?? job.id;
    if (jobId === undefined || jobId === null || String(jobId).trim() === "") {
      setError("This queued job has no usable job ID, so it cannot be cancelled from this view."); return;
    }
    const title = job.title || job.filename || ("job " + jobId);
    if (!window.confirm("Cancel queued print " + title + " (ID " + jobId + ")? This affects the queued job, not an already printed page.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/admin/proxy/api/printer/cancel-job", {
        method: "POST",
        body: JSON.stringify({ job_id: jobId, jobId, id: jobId }),
      });
      setNotice("Cancellation requested for queued print job " + jobId + ".");
      await loadDashboard();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not cancel the queued print job."); }
    finally { setBusy(false); }
  }

  async function reprintFile(file: UploadItem, mode: "bw" | "color") {
    const filename = file.filename || file.name || "";
    if (!filename) { setError("This upload does not include a filename."); return; }
    const duplex = Boolean(duplexByFile[filename]);
    if (!window.confirm("Send " + filename + " to " + (mode === "color" ? "the colour printer" : "the B&W printer") + (duplex ? " (double-sided)" : "") + "? This will create a new print job.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/admin/proxy/api/printer/reprint", {
        method: "POST",
        body: JSON.stringify({
          filename,
          color_mode: mode,
          color: mode === "color",
          duplex,
          double_sided: duplex,
        }),
      });
      setNotice("Reprint queued for " + filename + ".");
      await loadDashboard();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not reprint this upload."); }
    finally { setBusy(false); }
  }

  async function downloadReport(path: string, filename: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/proxy/" + path, { cache: "no-store" });
      if (!response.ok) {
        const data = await parseJson(response);
        throw new Error(typeof data.error === "string" ? data.error : "Report download failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(filename + " downloaded.");
    } catch (e) { setError(e instanceof Error ? e.message : "Report download failed."); }
    finally { setBusy(false); }
  }

  const gatewayReady = Boolean(auth?.gatewayConfigured);
  const transactions = firstDefined(history, ["transactions", "recorded_transactions"]) ?? firstDefined(revenue, ["transactions", "transaction_count"]);
  const pages = firstDefined(history, ["app_recorded_pages", "application_recorded_pages", "total_pages"]);
  const eventCount = Array.isArray(history?.events) ? history.events.length : firstDefined(history, ["event_count"]);
  const liveQueueJobs = queueJobs(queueData);
  const jobs = liveQueueJobs.length ? liveQueueJobs : queueJobs(status);
  const uploads = recentUploads(uploadsData);
  const todayRevenue = firstDefined(revenue, ["today_revenue", "todayRevenue", "revenue_today"]);
  const weekRevenue = firstDefined(revenue, ["week_revenue", "weekly_revenue", "this_week"]);
  const monthRevenue = firstDefined(revenue, ["month_revenue", "monthly_revenue", "this_month"]);

  return (
    <main className="arkout-admin-page">
      <div className="admin-ambient admin-ambient-one" /><div className="admin-ambient admin-ambient-two" /><div className="admin-ambient admin-ambient-three" />
      <header className="admin-topbar">
        <Link href="/" className="admin-brand"><Image src="/arkout-logo.png" alt="" width={36} height={36} /><span>arkout <small>CONTROL</small></span></Link>
        <div className="admin-topbar-right">
          <span className="admin-environment"><span className="admin-status-dot" /> Terminal 02 · Operations</span>
          {auth?.authenticated && <button className="admin-quiet-button" onClick={() => void logout()} disabled={busy}><LogOut size={15} /> Sign out</button>}
        </div>
      </header>

      {!auth?.configured ? (
        <section className="admin-login-shell">
          <div className="admin-glass-panel admin-login-card">
            <div className="admin-emblem"><LockKeyhole size={24} /></div>
            <p className="admin-kicker">PRIVATE OPERATIONS</p>
            <h1>Admin access needs setup.</h1>
            <p className="admin-lead">The portal is protected by server-side credentials and signed, HTTP-only sessions. Configure the listed Vercel server environment variables before sign-in is enabled.</p>
            <div className="admin-setup-list"><code>ARKOUT_WEB_ADMIN_USERNAME</code><code>ARKOUT_WEB_ADMIN_PASSWORD</code><code>ARKOUT_WEB_ADMIN_SESSION_SECRET (32+ characters)</code></div>
            <p className="admin-muted">Never put admin credentials in client-side code or commit them to Git.</p>
          </div>
        </section>
      ) : !auth.authenticated ? (
        <section className="admin-login-shell">
          <div className="admin-glass-panel admin-login-card">
            <div className="admin-emblem"><LockKeyhole size={24} /></div>
            <p className="admin-kicker">PRIVATE OPERATIONS</p>
            <h1>Your print network.<br /><span>One secure view.</span></h1>
            <p className="admin-lead">Sign in to manage maintenance, live supply readings, queue cancellation, reprints, uploaded files, revenue reports, backup and cleanup tasks.</p>
            <form className="admin-login-form" onSubmit={login}>
              <label>Username<input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={200} /></label>
              <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={512} /></label>
              <button className="admin-primary-button" disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in securely"} <ChevronRight size={17} /></button>
            </form>
            <p className="admin-muted"><ShieldCheck size={14} /> Credentials are checked server-side. The password is not stored in browser code.</p>
          </div>
        </section>
      ) : (
        <section className="admin-dashboard-shell">
          <div className="admin-dashboard-heading">
            <div><p className="admin-kicker">OPERATIONS OVERVIEW</p><h1>Everything in one place.</h1><p>Terminal 02 live readings, recorded usage, queued work and operator controls. Physical lifetime page meters are shown only if the printer reports them.</p></div>
            <button className="admin-glass-button" onClick={() => void loadDashboard()} disabled={refreshing || !gatewayReady}><RefreshCw size={16} className={refreshing ? "admin-spin" : ""} /> {refreshing ? "Refreshing…" : "Refresh all data"}</button>
          </div>

          {!gatewayReady ? (
            <div className="admin-glass-panel admin-connection-alert">
              <AlertTriangle size={22} />
              <div><h2>Secure Pi connection not configured</h2><p>Configure the server-side variables for a private HTTPS tunnel to the Raspberry Pi's loopback-only admin service:</p><div className="admin-setup-list"><code>ARKOUT_ADMIN_UPSTREAM_URL</code><code>ARKOUT_ADMIN_UPSTREAM_USERNAME</code><code>ARKOUT_ADMIN_UPSTREAM_PASSWORD</code><code>Optional: ARKOUT_ADMIN_ACCESS_CLIENT_ID</code><code>Optional: ARKOUT_ADMIN_ACCESS_CLIENT_SECRET</code></div><p className="admin-muted">Protect the hostname with a Cloudflare Access application using service-token authentication. Cloudflare Access service-token variables are optional; without them, the Pi admin API's Basic Auth is the origin protection. Use a long unique password and do not expose port 8899 directly except through the tunnel.</p></div>
            </div>
          ) : (
            <>
              <div className="admin-metric-grid">
                <NumberCard label="Recorded transactions" value={scalar(transactions)} detail="Application history" icon={<FileText size={17} />} />
                <NumberCard label="Recorded pages" value={scalar(pages)} detail="Not a physical lifetime counter" icon={<Printer size={17} />} />
                <NumberCard label="Queued print jobs" value={jobs.length ? String(jobs.length) : scalar(firstDefined(queueData, ["count", "queued_jobs_count"]) ?? firstDefined(status, ["queued_jobs_count", "queue_count"]))} detail="Cancel only jobs still queued" icon={<Activity size={17} />} />
                <NumberCard label="Connection" value={status ? "Connected" : "Checking"} detail="Private admin gateway" icon={<Wifi size={17} />} />
              </div>

              <div className="admin-section-grid">
                <section className="admin-glass-panel admin-span-two">
                  <div className="admin-card-heading"><div><p className="admin-kicker">DEVICE STATUS</p><h2>Live printer supplies</h2></div><Printer size={21} /></div>
                  <div className="admin-printer-grid">
                    {printers.length === 0 ? <p className="admin-muted">No live printer readings returned.</p> : printers.map((printer, index) => (
                      <article className="admin-printer-card" key={printer.queue || printer.label || index}>
                        <div className="admin-printer-title"><span className={"admin-device-dot " + (printer.ok ? "is-ok" : "is-error")} /><div><h3>{printer.label || printer.queue || "Printer"}</h3><p>{printer.state || (printer.ok ? "Connected" : "Unavailable")} · Queue {typeof printer.queued === "number" ? printer.queued : "—"}</p></div></div>
                        <div className="admin-supply-list">{(printer.supplies || []).map((supply, supplyIndex) => <div className="admin-supply-row" key={(supply.name || "Supply") + supplyIndex}><span>{supply.name || "Supply"}</span><span>{typeof supply.level === "number" ? supply.level + "%" : "Not reported"}</span><div className="admin-supply-track"><i style={{ width: (typeof supply.level === "number" ? Math.max(0,Math.min(100,supply.level)) : 0) + "%" }} /></div></div>)}</div>
                        {printer.alerts?.length ? <p className="admin-warning-text">{printer.alerts.join(", ")}</p> : <p className="admin-muted">No printer alerts reported.</p>}
                      </article>
                    ))}
                  </div>
                </section>

                <section className="admin-glass-panel">
                  <div className="admin-card-heading"><div><p className="admin-kicker">CHECKOUT CONTROL</p><h2>Maintenance</h2></div><Settings2 size={21} /></div>
                  <p className={"admin-maintenance-state " + (maintenance.enabled ? "is-maintenance" : "is-open")}><span />{maintenance.enabled ? "Maintenance enabled" : "Checkout is open"}</p>
                  <label className="admin-field-label">Kiosk message<input value={maintenance.message} maxLength={240} onChange={(event) => setMaintenance((current) => ({ ...current, message: event.target.value }))} /></label>
                  <div className="admin-actions-row"><button className="admin-secondary-button" disabled={busy || maintenance.enabled} onClick={() => void setMaintenanceState(true)}>Enable maintenance</button><button className="admin-primary-button" disabled={busy || !maintenance.enabled} onClick={() => void setMaintenanceState(false)}>Reopen checkout</button></div>
                  <p className="admin-muted">Opening checkout requires confirmation. Backend maintenance remains authoritative.</p>
                </section>

                <section className="admin-glass-panel">
                  <div className="admin-card-heading"><div><p className="admin-kicker">PAPER STOCK</p><h2>Remaining sheets</h2></div><Archive size={21} /></div>
                  <p className="admin-muted">Manual estimates only. Physically check each tray before saving.</p>
                  {[["Arkout_Color","Colour printer"],["Arkout_BW_Laser","B&W printer"]].map(([queue,label]) => (
                    <div className="admin-paper-row" key={queue}>
                      <label>{label}<span>{paper?.printers?.[queue]?.sheets_remaining == null ? "Not entered" : "Saved estimate: " + paper.printers[queue].sheets_remaining}</span></label>
                      <div className="admin-paper-controls"><input inputMode="numeric" type="number" min="0" max="10000" step="1" placeholder="Sheets" value={paperInputs[queue] || ""} onChange={(event) => setPaperInputs((current) => ({ ...current, [queue]: event.target.value }))} /><button className="admin-small-button" disabled={busy} onClick={() => void savePaperStock(queue)}>Save</button></div>
                    </div>
                  ))}
                </section>

                <section className="admin-glass-panel">
                  <div className="admin-card-heading"><div><p className="admin-kicker">MANUAL FALLBACK</p><h2>Supply levels</h2></div><Activity size={21} /></div>
                  <p className="admin-muted">Use only when automatic readings are unavailable.</p>
                  <form className="admin-ink-grid" onSubmit={saveInk}>
                    {["Black","Cyan","Magenta","Yellow"].map((name) => <label key={name}>{name}<div><input type="number" min="0" max="100" step="1" value={inkInputs[name]} onChange={(event) => setInkInputs((current) => ({ ...current, [name]: event.target.value }))} placeholder="0–100" /><span>%</span></div></label>)}
                    <button className="admin-secondary-button" type="submit" disabled={busy}>Save manual levels</button>
                  </form>
                </section>

                <section className="admin-glass-panel">
                  <div className="admin-card-heading"><div><p className="admin-kicker">SYSTEM HEALTH</p><h2>Network & device</h2></div><Network size={21} /></div>
                  <div className="admin-health-grid">
                    {[
                      ["Network", firstDefined(status, ["network_status", "network", "internet_status", "online"])],
                      ["CPU", firstDefined(status, ["cpu_percent", "cpu", "cpu_usage"])],
                      ["RAM", firstDefined(status, ["ram_percent", "ram", "memory_percent"])],
                      ["Disk", firstDefined(status, ["disk_percent", "disk", "disk_usage"])],
                      ["CPU temperature", firstDefined(status, ["cpu_temp_c", "cpu_temperature", "temperature"])],
                      ["Uptime", firstDefined(status, ["uptime", "uptime_text"])],
                      ["Latency", firstDefined(status, ["latency_ms", "latency"])],
                    ].map(([label,value]) => <div className="admin-health-item" key={String(label)}><span>{String(label)}</span><strong>{scalar(value)}</strong></div>)}
                  </div>
                  <p className="admin-muted">Values shown here are fields returned by the Pi's status endpoint.</p>
                </section>

                <section className="admin-glass-panel">
                  <div className="admin-card-heading"><div><p className="admin-kicker">REVENUE & REPORTS</p><h2>Recorded business activity</h2></div><BarChart3 size={21} /></div>
                  <div className="admin-revenue-metrics">
                    <div><span>Today</span><strong>{formatRupees(typeof todayRevenue === "number" ? todayRevenue : typeof revenue?.today === "number" ? revenue.today : undefined)}</strong></div>
                    <div><span>This week</span><strong>{formatRupees(typeof weekRevenue === "number" ? weekRevenue : undefined)}</strong></div>
                    <div><span>This month</span><strong>{formatRupees(typeof monthRevenue === "number" ? monthRevenue : undefined)}</strong></div>
                  </div>
                  <div className="admin-report-actions">
                    <button className="admin-secondary-button" disabled={busy} onClick={() => void downloadReport("api/revenue/export.csv","arkout-revenue.csv")}><Download size={15} /> Export revenue CSV</button>
                    <button className="admin-secondary-button" disabled={busy} onClick={() => void downloadReport("api/revenue/report.pdf","arkout-revenue-report.pdf")}><Download size={15} /> Download PDF report</button>
                  </div>
                  <p className="admin-muted">Revenue summaries and reports use the existing backend routes.</p>
                </section>

                <section className="admin-glass-panel admin-span-two">
                  <div className="admin-card-heading"><div><p className="admin-kicker">PRINT QUEUE</p><h2>Active and pending jobs</h2></div><Printer size={21} /></div>
                  {jobs.length === 0 ? <p className="admin-muted">The status endpoint did not return any queued-job list, or the queue is empty. Refresh to check again.</p> : (
                    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Job</th><th>Printer</th><th>Status</th><th>Pages</th><th>Action</th></tr></thead><tbody>
                      {jobs.map((job,index) => {
                        const id = job.job_id ?? job.jobId ?? job.id ?? "unknown";
                        const title = job.title || job.filename || ("Print job " + id);
                        return <tr key={String(id) + "-" + index}><td><strong>{title}</strong><small>ID {String(id)}</small></td><td>{job.printer || job.queue || "—"}</td><td>{job.status || "Queued"}</td><td>{job.pages ?? "—"}</td><td><button className="admin-danger-button" disabled={busy || id === "unknown"} onClick={() => void cancelPrintJob(job)}><XCircle size={14} /> Cancel print</button></td></tr>;
                      })}
                    </tbody></table></div>
                  )}
                  <p className="admin-muted">Cancel print works only for a job still queued in CUPS. It cannot recall a page that has already physically printed.</p>
                </section>

                <section className="admin-glass-panel admin-span-two">
                  <div className="admin-card-heading"><div><p className="admin-kicker">UPLOAD LIBRARY</p><h2>Recent files & reprints</h2></div><UploadCloud size={21} /></div>
                  {uploads.length === 0 ? <p className="admin-muted">No recent upload items were returned by the admin API.</p> : (
                    <div className="admin-upload-grid">
                      {uploads.map((file,index) => {
                        const filename = file.filename || file.name || ("upload-" + index);
                        const title = file.original_filename || filename;
                        const duplex = Boolean(duplexByFile[filename]);
                        return <article className="admin-upload-card" key={filename + "-" + index}>
                          <div className="admin-upload-icon"><FileText size={20} /></div>
                          <h3>{title}</h3>
                          <p>{file.pages != null ? file.pages + " page(s)" : "Page count not reported"}{file.uploaded_at || file.uploadedAt || file.timestamp ? " · " + String(file.uploaded_at || file.uploadedAt || file.timestamp) : ""}</p>
                          <label className="admin-duplex-option"><input type="checkbox" checked={duplex} onChange={(event) => setDuplexByFile((current) => ({ ...current, [filename]: event.target.checked }))} /> Double-sided</label>
                          <div className="admin-reprint-actions"><button className="admin-small-button" disabled={busy} onClick={() => void reprintFile(file,"bw")}>Reprint B&W</button><button className="admin-small-button" disabled={busy} onClick={() => void reprintFile(file,"color")}>Reprint Color</button></div>
                        </article>;
                      })}
                    </div>
                  )}
                </section>

                <section className="admin-glass-panel admin-span-two">
                  <div className="admin-card-heading"><div><p className="admin-kicker">PRINTER & PAYMENT HISTORY</p><h2>Health events and order failures</h2></div><Activity size={21} /></div>
                  <div className="admin-history-summary">
                    <div><span>Health samples</span><strong>{scalar(history?.health_samples?.total)}</strong></div>
                    <div><span>Printer unhealthy samples</span><strong>{scalar(history?.health_samples?.printer_unhealthy)}</strong></div>
                    <div><span>Network unhealthy samples</span><strong>{scalar(history?.health_samples?.network_unhealthy)}</strong></div>
                    <div><span>Reported paper jams</span><strong>{scalar(history?.event_counts?.paper_jam_reports)}</strong></div>
                    <div><span>Printer fault transitions</span><strong>{scalar(history?.event_counts?.printer_fault_events)}</strong></div>
                    <div><span>Recorded order errors</span><strong>{Array.isArray(history?.recent_recorded_failures) ? history.recent_recorded_failures.length : "—"}</strong></div>
                  </div>
                  <div className="admin-events-list">
                    {(Array.isArray(history?.events) ? history.events : []).slice(0,20).map((event: Json,index:number) => <div className="admin-event-row" key={String(event.id || event.timestamp || index)}><span>{String(event.timestamp || event.time || "Time not reported")}</span><strong>{String(event.printer_queue || event.printer || "Printer")}</strong><span>{String(event.severity || event.event_type || "Event")}</span><p>{String(event.details || "No details reported")}</p></div>)}
                    {!Array.isArray(history?.events) || history.events.length === 0 ? <p className="admin-muted">No printer-state events returned yet. The monitor records changes from its installation time.</p> : null}
                  </div>
                  <h3 className="admin-subheading">Recent recorded order failures</h3>
                  <div className="admin-events-list">
                    {(Array.isArray(history?.recent_recorded_failures) ? history.recent_recorded_failures : []).map((failure: Json,index:number) => <div className="admin-event-row" key={String(failure.order_id || failure.time || index)}><span>{String(failure.time || "Time not reported")}</span><strong>{String(failure.status || "Order issue")}</strong><span>Order</span><p>{String(failure.details || "No detail returned")}</p></div>)}
                    {(!Array.isArray(history?.recent_recorded_failures) || history.recent_recorded_failures.length === 0) ? <p className="admin-muted">No failed/error orders or saved order errors reported.</p> : null}
                  </div>
                  <p className="admin-muted">Application-recorded page totals are not the printers' physical lifetime meters. Paper-jam counts include only explicit CUPS reports.</p>
                </section>

                <section className="admin-glass-panel">
                  <div className="admin-card-heading"><div><p className="admin-kicker">OPERATOR ACTIONS</p><h2>Cleanup & backups</h2></div><HardDrive size={21} /></div>
                  <p className="admin-muted">Sensitive actions ask for confirmation. Automatic deletion remains controlled by the backend retention settings.</p>
                  <div className="admin-operator-actions">
                    <button className="admin-secondary-button" disabled={busy} onClick={() => void operatorAction("api/uploads/cleanup-now","Clean expired uploads")}>Clean expired uploads</button>
                    <button className="admin-secondary-button" disabled={busy} onClick={() => void operatorAction("api/backup/run","Send backup to Telegram")}>Send backup to Telegram</button>
                  </div>
                  <Link href="/adv" className="admin-portal-link">Manage kiosk advertisements <ChevronRight size={16} /></Link>
                </section>

                <section className="admin-glass-panel">
                  <div className="admin-card-heading"><div><p className="admin-kicker">CONNECTED PORTALS</p><h2>Arkout services</h2></div><Wifi size={21} /></div>
                  <div className="admin-portal-links">
                    <Link href="/print"><span><Printer size={17} /> Print interface</span><ChevronRight size={16} /></Link>
                    <Link href="/print/preview"><span><FileText size={17} /> Safe print demo</span><ChevronRight size={16} /></Link>
                    <Link href="/adv"><span><UploadCloud size={17} /> Restricted ad portal</span><ChevronRight size={16} /></Link>
                  </div>
                  <p className="admin-muted">The preview link does not contact a kiosk, create an order or start payment.</p>
                </section>
              </div>
            </>
          )}
        </section>
      )}

      {(error || notice) && <div role="status" className={"admin-toast " + (error ? "is-error" : "is-notice")}>{error ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}{error || notice}</div>}
      <footer className="admin-footer"><span>© {new Date().getFullYear()} Arkout Techworks Pvt. Ltd.</span><span><ShieldCheck size={13} /> Restricted operations · Audit-friendly controls</span></footer>
    </main>
  );
}
