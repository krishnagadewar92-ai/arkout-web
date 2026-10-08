"use client";

import React, { useState, useEffect, useCallback } from "react";

// Configuration - Pointing to your live Cloudflare tunnel endpoint
const API_BASE = process.env.NEXT_PUBLIC_KIOSK_API || "https://api.arkout.in";

interface PrinterData {
  name: string;
  state: string;
  ink_levels: Record<string, number>;
  alerts: Array<{ code: string; severity: string; message?: string }>;
}

interface KioskTelemetry {
  kiosk_mode: { status: string; maintenance_reason?: string };
  hardware_usb: { printers_detected: number; status: string };
  printers: { printers: PrinterData[] };
  paper_inventory: { color_tray: number; bw_tray: number };
  recent_payment_failures: Array<{
    id: string;
    amount: number;
    reason: string;
    bank_message: string;
    time: string;
  }>;
}

export default function AdminFleetDashboard() {
  // --- AUTHENTICATION STATE ---
  const [authorized, setAuthorized] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [loginError, setLoginError] = useState("");

  // --- TELEMETRY STATE ---
  const [telemetry, setTelemetry] = useState<KioskTelemetry null |>(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  // --- MARKETING AD STATE ---
  const [adFile, setAdFile] = useState<File null |>(null);
  const [adUploading, setAdUploading] = useState(false);

  // Authenticate Owner / Handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate phone number format (E.164 or 10-digit) and admin secret key
    if (phoneNumber.trim().length >= 10 && adminToken.trim().length > 0) {
      sessionStorage.setItem("arkout_admin_token", adminToken);
      sessionStorage.setItem("arkout_owner_phone", phoneNumber);
      setAuthorized(true);
      setLoginError("");
    } else {
      setLoginError("Please enter a valid phone number and Fleet Secret.");
    }
  };

  // Fetch Telemetry from Raspberry Pi Backend
  const fetchStatus = useCallback(async () => {
    const token = sessionStorage.getItem("arkout_admin_token") || adminToken;
    try {
      const res = await fetch(`${API_BASE}/api/status`, {
        headers: { Authorization: `Basic ${btoa(`admin:${token}`)}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      } else {
        setActionMessage("Session expired or unauthorized node response.");
      }
    } catch {
      setActionMessage("Kiosk node unreachable over Cloudflare tunnel.");
    }
  }, [adminToken]);

  useEffect(() => {
    const savedToken = sessionStorage.getItem("arkout_admin_token");
    if (savedToken) {
      setAdminToken(savedToken);
      setAuthorized(true);
    }
  }, []);

  useEffect(() => {
    if (authorized) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [authorized, fetchStatus]);

  // Action: Toggle Maintenance Mode
  const toggleMaintenance = async (enable: boolean) => {
    const token = sessionStorage.getItem("arkout_admin_token");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/maintenance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${btoa(`admin:${token}`)}`,
        },
        body: JSON.stringify({
          enable,
          reason: enable ? "Terminal under servicing" : "",
        }),
      });
      if (res.ok) {
        setActionMessage(`Maintenance mode ${enable ? "activated" : "cleared"}.`);
        fetchStatus();
      }
    } finally {
      setLoading(false);
    }
  };

  // Action: Refill Paper Stock
  const handlePaperRefill = async (tray: "color" | "bw") => {
    const token = sessionStorage.getItem("arkout_admin_token");
    try {
      const res = await fetch(`${API_BASE}/api/admin/paper/refill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${btoa(`admin:${token}`)}`,
        },
        body: JSON.stringify({ [tray]: true }),
      });
      if (res.ok) {
        setActionMessage(`Tray ${tray.toUpperCase()} reset to 500 sheets.`);
        fetchStatus();
      }
    } catch {
      setActionMessage("Failed to update paper level.");
    }
  };

  // Action: Upload & Deploy Marketing Ad
  const handleAdUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adFile) return;
    const token = sessionStorage.getItem("arkout_admin_token");
    setAdUploading(true);
    setActionMessage("Setting kiosk to maintenance and deploying ad...");

    const formData = new FormData();
    formData.append("file", adFile);

    try {
      const res = await fetch(`${API_BASE}/api/admin/ads/upload`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`admin:${token}`)}`,
        },
        body: formData,
      });
      if (res.ok) {
        setActionMessage("Ad asset synchronized. Maintenance mode lifted.");
        setAdFile(null);
        fetchStatus();
      } else {
        setActionMessage("Ad sync rejected by terminal.");
      }
    } catch {
      setActionMessage("Network error transferring ad media.");
    } finally {
      setAdUploading(false);
    }
  };

  // --- RENDER LOGIN GATE ---
  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-2xl"
        >
          <div className="mb-6 text-center">
            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold tracking-widest text-cyan-400">
              TERMINAL 01 COMMAND
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Kiosk Owner Access</h1>
            <p className="mt-1 text-xs text-zinc-400">Authenticate via registered handler number</p>
          </div>

          {loginError && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
              {loginError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-300">Registered Phone Number</label>
              <input
                type="tel"
                required
                placeholder="+91 98765 43210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-300">Fleet Control Key</label>
              <input
                type="password"
                required
                placeholder="Enter admin password"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-cyan-500 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400"
            >
              Authenticate Station
            </button>
          </div>
        </form>
      </div>
    );
  }

  const isMaintenance = telemetry?.kiosk_mode.status === "maintenance";

  return (
    <div className="min-h-screen bg-black px-6 py-8 text-white selection:bg-cyan-500 selection:text-black">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER & QUICK CONTROLS */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-zinc-950/60 p-6 backdrop-blur-xl">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight">Arkout Fleet Core</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isMaintenance
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                }`}
              >
                {isMaintenance ? "MAINTENANCE ACTIVE" : "ONLINE & SPOOLING"}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">Node: Pune Central Station (Terminal 01)</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              disabled={loading}
              onClick={() => toggleMaintenance(!isMaintenance)}
              className={`rounded-xl px-4 py-2.5 text-xs font-semibold tracking-wider transition uppercase ${
                isMaintenance
                  ? "bg-emerald-500 text-black hover:bg-emerald-400"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30"
              }`}
            >
              {isMaintenance ? "Exit Maintenance" : "Enter Maintenance"}
            </button>
            <button
              onClick={() => {
                sessionStorage.clear();
                setAuthorized(false);
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-400 hover:text-white"
            >
              Logout
            </button>
          </div>
        </header>

        {actionMessage && (
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-3 text-xs text-cyan-300">
            {actionMessage}
          </div>
        )}

        {/* METRICS & INVENTORY GRID */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* 1. PAPER INVENTORY */}
          <div className="rounded-3xl border border-white/10 bg-zinc-950/50 p-6 backdrop-blur-md">
            <h2 className="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
              Paper Tray Capacity
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <div className="flex justify-between text-xs font-mono">
                  <span>Color Cassette (DCP-T830DW)</span>
                  <span className="font-semibold">{telemetry?.paper_inventory.color_tray ?? 0} / 500</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-cyan-400"
                    style={{
                      width: `${((telemetry?.paper_inventory.color_tray ?? 0) / 500) * 100}%`,
                    }}
                  />
                </div>
                <button
                  onClick={() => handlePaperRefill("color")}
                  className="mt-2 text-[11px] text-cyan-400 hover:underline"
                >
                  Confirm Refill (+500)
                </button>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono">
                  <span>B&W Main Tray (HL-L5210DW)</span>
                  <span className="font-semibold">{telemetry?.paper_inventory.bw_tray ?? 0} / 500</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-purple-400"
                    style={{
                      width: `${((telemetry?.paper_inventory.bw_tray ?? 0) / 500) * 100}%`,
                    }}
                  />
                </div>
                <button
                  onClick={() => handlePaperRefill("bw")}
                  className="mt-2 text-[11px] text-purple-400 hover:underline"
                >
                  Confirm Refill (+500)
                </button>
              </div>
            </div>
          </div>

          {/* 2. HARDWARE USB DIAGNOSTICS */}
          <div className="rounded-3xl border border-white/10 bg-zinc-950/50 p-6 backdrop-blur-md">
            <h2 className="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
              USB Motherboard Health
            </h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 p-3">
                <span className="text-xs text-zinc-300">Connected Printers</span>
                <span className="font-mono text-sm font-bold text-white">
                  {telemetry?.hardware_usb.printers_detected ?? 0} / 2 Devices
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 p-3">
                <span className="text-xs text-zinc-300">Bus Status</span>
                <span
                  className={`text-xs font-semibold ${
                    (telemetry?.hardware_usb.printers_detected ?? 0) >= 2
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {telemetry?.hardware_usb.status ?? "Scanning..."}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Direct hardware interrogation via lsusb. Disconnections report immediately.
              </p>
            </div>
          </div>

          {/* 3. MARKETING AD MANAGER */}
          <div className="rounded-3xl border border-white/10 bg-zinc-950/50 p-6 backdrop-blur-md">
            <h2 className="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
              Marketing Asset Deployment
            </h2>
            <form onSubmit={handleAdUpload} className="mt-3 space-y-3">
              <input
                type="file"
                accept="video/mp4,image/*"
                onChange={(e) => setAdFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white hover:file:bg-white/20"
              />
              <p className="text-[11px] text-zinc-500">
                Uploading places the kiosk in maintenance, synchronizes the video, and resumes automatically.
              </p>
              <button
                type="submit"
                disabled={!adFile || adUploading}
                className="w-full rounded-xl bg-white/10 py-2 text-xs font-medium text-white transition hover:bg-white/20 disabled:opacity-40"
              >
                {adUploading ? "Transferring & Applying..." : "Upload New Promotion"}
              </button>
            </form>
          </div>
        </div>

        {/* PRINTER CONSUMABLES & PREDICTIVE HEALTH */}
        <section className="rounded-3xl border border-white/10 bg-zinc-950/50 p-6 backdrop-blur-md">
          <h2 className="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
            Printer Consumables & Physical Telemetry
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {telemetry?.printers?.printers?.map((printer) => (
              <div
                key={printer.name}
                className="rounded-2xl border border-white/5 bg-black/40 p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-white">{printer.name}</span>
                  <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 uppercase">
                    {printer.state}
                  </span>
                </div>

                {/* Ink Levels */}
                <div className="grid grid-cols-4 gap-2 pt-2">
                  {Object.entries(printer.ink_levels).map(([color, pct]) => (
                    <div key={color} className="rounded-lg bg-zinc-900/60 p-2 text-center">
                      <div className="text-[10px] text-zinc-400 truncate">{color}</div>
                      <div className="mt-1 font-mono text-xs font-bold text-white">{pct}%</div>
                    </div>
                  ))}
                </div>

                {/* Jam / Predictive Alerts */}
                {printer.alerts.length > 0 && (
                  <div className="space-y-1 pt-2">
                    {printer.alerts.map((alert, i) => (
                      <div
                        key={i}
                        className={`rounded-lg p-2 text-xs ${
                          alert.severity === "error"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                        }`}
                      >
                        {alert.message || alert.code}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* PAYMENT FAILURES DIAGNOSTICS */}
        <section className="rounded-3xl border border-white/10 bg-zinc-950/50 p-6 backdrop-blur-md">
          <h2 className="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
            Recent Razorpay Transaction Failures
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-white/10 text-zinc-500 uppercase">
                <tr>
                  <th className="pb-3">Timestamp</th>
                  <th className="pb-3">Payment ID</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Razorpay Diagnostic Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300">
                {telemetry?.recent_payment_failures?.length ? (
                  telemetry.recent_payment_failures.map((fail) => (
                    <tr key={fail.id}>
                      <td className="py-3 text-zinc-400">{fail.time}</td>
                      <td className="py-3 text-cyan-400">{fail.id}</td>
                      <td className="py-3">₹{fail.amount.toFixed(2)}</td>
                      <td className="py-3 text-amber-400">
                        {fail.reason} {fail.bank_message && `(${fail.bank_message})`}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-zinc-500">
                      No recent payment dropoffs recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
