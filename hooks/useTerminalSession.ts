import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function useTerminalSession(sessionId: string) {
  const [isSessionValid, setIsSessionValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!sessionId) return;

    // Keep session claims and aborts on the same API as PIN verification.
    const apiUrl = sessionId.length === 6 && sessionId.startsWith("02")
      ? (process.env.NEXT_PUBLIC_TERMINAL_02_URL || "https://api2.arkout.in")
      : "https://api.arkout.in";

    // 1. Claim the QR Session immediately
    const claimSession = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/claim_session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId })
        });

        if (res.status === 403) {
          setIsSessionValid(false);
          setErrorMessage("Someone beat you to it! Please scan the new QR on the kiosk.");
        }
      } catch (err) {
        console.error("Failed to claim session:", err);
      }
    };
    claimSession();

    // 2. The Back-Button / Tab-Close Beacon
    const handleUnload = () => {
      const payload = JSON.stringify({ session_id: sessionId });
      navigator.sendBeacon(`${apiUrl}/api/abort`, payload);
    };

    // 2a. Pause inactivity cleanup while the page is hidden. Mobile UPI apps and
    // payment overlays can hide the page without ending the customer's session.
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = undefined;
      if (document.visibilityState === 'hidden') return;
      idleTimer = setTimeout(() => {
        handleUnload();
        router.push('/'); // Redirect them out if they are idle
      }, 90000); // 90 seconds of visible-page inactivity
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = undefined;
      } else {
        resetIdleTimer();
      }
    };

    window.addEventListener('pagehide', handleUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. The 90-Second Idle Auto-Nuke

    window.addEventListener('touchstart', resetIdleTimer);
    window.addEventListener('click', resetIdleTimer);
    resetIdleTimer();

    return () => {
      window.removeEventListener('pagehide', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('touchstart', resetIdleTimer);
      window.removeEventListener('click', resetIdleTimer);
      clearTimeout(idleTimer);
    };
  }, [sessionId, router]);

  return { isSessionValid, errorMessage };
}
