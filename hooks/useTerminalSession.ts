import { useEffect, useState } from "react";
import { getTerminalApiBaseUrl } from "../lib/api-config";

/**
 * Lifecycle-only helper for the legacy Terminal 01 screen.
 * PIN verification owns authentication; this hook must not claim the session a
 * second time. Unload cleanup is best-effort and never runs during payment handoff.
 */
export function useTerminalSession(sessionId: string) {
  const [isSessionValid] = useState(true);
  const [errorMessage] = useState("");

  useEffect(() => {
    if (!/^\d{4}$/.test(sessionId)) return;

    const apiBase = getTerminalApiBaseUrl(sessionId);
    // Preview/local builds must never silently fall back to a production API.
    if (!apiBase) return;

    const handlePageHide = () => {
      try {
        if (sessionStorage.getItem("arkout_payment_in_progress") === "1") return;
        const token = sessionStorage.getItem("arkout_session_token") || "";
        // The server rejects tokenless release. Never send an unsafe cleanup request.
        if (!token) return;
        const payload = JSON.stringify({ session_id: sessionId, session_token: token });
        navigator.sendBeacon(
          apiBase + "/api/abort",
          new Blob([payload], { type: "application/json" }),
        );
      } catch {
        // Server-side idle expiry remains the fallback if storage/beacon is unavailable.
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [sessionId]);

  return { isSessionValid, errorMessage };
}
