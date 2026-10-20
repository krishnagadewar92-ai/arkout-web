"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Activity, AlertTriangle, Archive, CheckCircle2, ChevronRight, FileText, Ink,
  LockKeyhole, LogOut, RefreshCw, ShieldCheck, Printer, Settings2, Wifi,
} from "lucide-react";

type AuthState = { configured: boolean; authenticated: boolean; gatewayConfigured: boolean };
type Json = Record<string, any>;
type PrinterReading = { label?: string; ok?: boolean; state?: string; queued?: number; supplies?: { name?: string; level?: number; color?: string }[]; alerts?: string[] };
type PaperPrinter = { sheets_remaining?: number | null; updated_at?: string | null };
type PaperStock = { printers?: Record<string, PaperPrinter> };

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

function NumberCard({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon: React.ReactNode }) {
  return <div className="admin-glass-metric"><div className="admin-metric-top"><span>{label}</span><span className="admin-metric-icon">{icon}</span></div><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
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
  const [paper, setPaper] = useState<PaperStock | null>(null);
  const [paperInputs, setPaperInputs] = useState<Record<string, string>>({
    Arkout_Color: "", Arkout_BW_Laser: "",
  });
  const [inkInputs, setInkInputs] = useState<Record<string, string>>({
    Black: "", Cyan: "", Magenta: "", Yellow: "",
  });

  const loadDashboard = useCallback(async () => {
    setRefreshing(true);
    setError("");
    const requests = await Promise.allSettled([
      api("/api/admin/proxy/api/status"),
      api("/api/admin/proxy/api/admin/maintenance"),
      api("/api/admin/proxy/api/printer/telemetry"),
      api("/api/admin/proxy/api/printer/history"),
      api("/api/admin/proxy/api/paper-stock"),
    ]);
    if (requests[0].status === "fulfilled") setStatus(requests[0].value);
    if (requests[1].status === "fulfilled") {
      const m = requests[1].value;
      setMaintenance({
        enabled: m.enabled === true,
        message: typeof m.message === "string" ? m.message : "Kiosk is under maintenance",
      });
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
    const failures = requests.filter((result) => result.status === "rejected");
    if (failures.length) setError((failures[0] as PromiseRejectedResult).reason instanceof Error
      ? (failures[0] as PromiseRejectedResult).reason.message
      : "One or more dashboard readings could not be loaded.");
    setRefreshing(false);
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const result = await api("/api/admin/auth");
      const next = {
        configured: Boolean(result.configured),
        authenticated: Boolean(result.authenticated),
        gatewayConfigured: Boolean(result.gatewayConfigured),
      };
      setAuth(next);
      if (next.authenticated && next.gatewayConfigured) await loadDashboard();
    } catch {
      setError("Could not reach the admin portal sign-in endpoint.");
    }
  }, [loadDashboard]);

  useEffect(() => { void checkSession(); }, [checkSession]);

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
      setPrinters([]); setHistory(null); setStatus(null); setPaper(null);
      setNotice("Signed out.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not sign out."); }
    finally { setBusy(false); }
  }

  async function setMaintenanceState(enabled: boolean) {
    if (!enabled && !window.confirm("Reopen Terminal 02 checkout for customers? Only continue if you have completed the final kiosk checks.")) return;
    const nextMessage = maintenance.message.trim() || "Kiosk is under maintenance";
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await api("/api/admin/proxy/api/admin/maintenance", {
        method: "POST",
        body: JSON.stringify({ enabled, message: nextMessage }),
      });
      setMaintenance({ enabled: data.enabled === true, message: typeof data.message === "string" ? data.message : nextMessage });
      setNotice(enabled ? "Terminal 02 maintenance enabled." : "Terminal 02 checkout reopened.");
    } catch (e) { setError(e instanceof Error ? e.message : "Maintenance update failed."); }
    finally { setBusy(false); }
  }

  async function savePaperStock(queue: string) {
    const raw = paperInputs[queue] || "";
    if (raw.trim() === "" || !Number.isInteger(Number(raw)) || Number(raw) < 0 || Number(raw) > 10000) {
      setError("Enter a physically checked whole-sheet count from 0 to 10000.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/admin/proxy/api/paper-stock", { method: "POST", body: JSON.stringify({ printer: queue, sheets_remaining: Number(raw) }) });
      await loadDashboard();
      setNotice("Manual paper-stock estimate saved for " + queue + ".");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save paper stock."); }
    finally { setBusy(false); }
  }

  async function saveInk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values: Record<string, number> = {};
    for (const name of ["Black", "Cyan", "Magenta", "Yellow"]) {
      const raw = inkInputs[name];
      if (raw.trim() === "" || !Number.isFinite(Number(raw)) || Number(raw) < 0 || Number(raw) > 100) {
        setError("Enter all four manual ink values from 0 to 100.");
        return;
      }
      values[name] = Number(raw);
    }
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/admin/proxy/api/ink", { method: "POST", body: JSON.stringify(values) });
      setNotice("Manual supply estimates saved.");
      await loadDashboard();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save manual supply estimates."); }
    finally { setBusy(false); }
  }

  async function operatorAction(path: string, label: string) {
    const prompt = label === "Send backup to Telegram"
      ? "Send the configured local database backup to Telegram?"
      : "Run “" + label + "”? Verify that this action is appropriate before proceeding.";
    if (!window.confirm(prompt)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/admin/proxy/" + path, { method: "POST", body: JSON.stringify({}) });
      setNotice(label + " completed.");
      await loadDashboard();
    } catch (e) { setError(e instanceof Error ? e.message : label + " failed."); }
    finally { setBusy(false); }
  }

  const transactions = history?.transactions ?? history?.recorded_transactions ?? "—";
  const pages = history?.app_recorded_pages ?? history?.application_recorded_pages ?? "—";
  const events = Array.isArray(history?.recent_printer_events) ? history?.recent_printer_events.length :
    Array.isArray(history?.recentPrinterEvents) ? history?.recentPrinterEvents.length : "—";
  const gatewayReady = Boolean(auth?.gatewayConfigured);

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
            <p className="admin-lead">The admin route is protected by server-side credentials and signed, HTTP-only sessions. Configure the required deployment variables before using this portal.</p>
            <div className="admin-setup-list"><code>ARKOUT_WEB_ADMIN_USERNAME</code><code>ARKOUT_WEB_ADMIN_PASSWORD</code><code>ARKOUT_WEB_ADMIN_SESSION_SECRET (32+ characters)</code></div>
            <p className="admin-muted">Do not place admin credentials in client-side code or commit them to Git.</p>
          </div>
        </section>
      ) : !auth.authenticated ? (
        <section className="admin-login-shell">
          <div className="admin-glass-panel admin-login-card">
            <div className="admin-emblem"><LockKeyhole size={24} /></div>
            <p className="admin-kicker">PRIVATE OPERATIONS</p>
            <h1>Your print network.<br /><span>One secure view.</span></h1>
            <p className="admin-lead">Sign in to view printer health, usage history, supply readings, maintenance state and operator actions.</p>
            <form className="admin-login-form" onSubmit={login}>
              <label>Username<input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={200} /></label>
              <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={512} /></label>
              <button className="admin-primary-button" disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in securely"} <ChevronRight size={17} /></button>
            </form>
            <p className="admin-muted"><ShieldCheck size={14} /> Access is private. Credentials never leave the server-side authentication route.</p>
          </div>
        </section>
      ) : (
        <section className="admin-dashboard-shell">
          <div className="admin-dashboard-heading">
            <div><p className="admin-kicker">OPERATIONS OVERVIEW</p><h1>Good to see you.</h1><p>Live readings from the Terminal 02 admin service. Values are shown only when the Raspberry Pi reports them.</p></div>
            <button className="admin-glass-button" onClick={() => void loadDashboard()} disabled={refreshing || !gatewayReady}><RefreshCw size={16} className={refreshing ? "admin-spin" : ""} /> {refreshing ? "Refreshing…" : "Refresh data"}</button>
          </div>

          {!gatewayReady ? (
            <div className="admin-glass-panel admin-connection-alert">
              <AlertTriangle size={22} />
              <div><h2>Secure Pi connection not configured</h2><p>The portal is online, but operational data remains disconnected until a private HTTPS tunnel to <code>127.0.0.1:8899</code> is configured and these server-side variables are set:</p><div className="admin-setup-list"><code>ARKOUT_ADMIN_UPSTREAM_URL</code><code>ARKOUT_ADMIN_UPSTREAM_USERNAME</code><code>ARKOUT_ADMIN_UPSTREAM_PASSWORD</code></div><p className="admin-muted">Do not expose port 8899 directly to the public internet. Use an authenticated HTTPS tunnel or private gateway.</p></div>
            </div>
          ) : (
            <>
              <div className="admin-metric-grid">
                <NumberCard label="Recorded transactions" value={String(transactions)} detail="From application history" icon={<FileText size={17} />} />
                <NumberCard label="Application pages" value={String(pages)} detail="Not a physical lifetime counter" icon={<Printer size={17} />} />
                <NumberCard label="Printer event history" value={String(events)} detail="Events recorded by monitoring" icon={<Activity size={17} />} />
                <NumberCard label="Connection" value={status ? "Connected" : "Checking"} detail="Through the private admin gateway" icon={<Wifi size={17} />} />
              </div>

              <div className="admin-section-grid">
                <section className="admin-glass-panel admin-span-two">
                  <div className="admin-card-heading"><div><p className="admin-kicker">DEVICE STATUS</p><h2>Your printers</h2></div><Printer size={21} /></div>
                  <div className="admin-printer-grid">
                    {printers.length === 0 ? <p className="admin-muted">No live printer readings returned.</p> : printers.map((printer, index) => (
                      <article className="admin-printer-card" key={printer.label || index}>
                        <div className="admin-printer-title"><span className={"admin-device-dot " + (printer.ok ? "is-ok" : "is-error")} /><div><h3>{printer.label || "Printer"}</h3><p>{printer.state || (printer.ok ? "Connected" : "Unavailable")} · Queue {typeof printer.queued === "number" ? printer.queued : "—"}</p></div></div>
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
                  <p className="admin-muted">Reopening requires confirmation. The backend remains the authority for checkout availability.</p>
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
                  <p className="admin-muted">Use only when automatic printer readings are unavailable.</p>
                  <form className="admin-ink-grid" onSubmit={saveInk}>
                    {["Black","Cyan","Magenta","Yellow"].map((name) => <label key={name}>{name}<div><input type="number" min="0" max="100" step="1" value={inkInputs[name]} onChange={(event) => setInkInputs((current) => ({ ...current, [name]: event.target.value }))} placeholder="0–100" /><span>%</span></div></label>)}
                    <button className="admin-secondary-button" type="submit" disabled={busy}>Save manual levels</button>
                  </form>
                </section>

                <section className="admin-glass-panel">
                  <div className="admin-card-heading"><div><p className="admin-kicker">OPERATOR ACTIONS</p><h2>Maintenance tools</h2></div><ShieldCheck size={21} /></div>
                  <p className="admin-muted">Sensitive actions require confirmation and use the protected Pi admin API.</p>
                  <div className="admin-operator-actions">
                    <button className="admin-secondary-button" disabled={busy} onClick={() => void operatorAction("api/uploads/cleanup-now","Clean expired uploads")}>Clean expired uploads</button>
                    <button className="admin-secondary-button" disabled={busy} onClick={() => void operatorAction("api/backup/run","Send backup to Telegram")}>Send backup to Telegram</button>
                  </div>
                  <Link href="/adv" className="admin-portal-link">Manage kiosk advertisements <ChevronRight size={16} /></Link>
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
