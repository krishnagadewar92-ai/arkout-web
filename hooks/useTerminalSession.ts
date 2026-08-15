import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function useTerminalSession(sessionId: string) {
  const [isSessionValid, setIsSessionValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!sessionId) return;

    // 1. Claim the QR Session immediately
    const claimSession = async () => {
      try {
        const res = await fetch('https://api.arkout.in/api/claim_session', {
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
      navigator.sendBeacon('https://api.arkout.in/api/abort', payload);
    };

    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handleUnload();
    });

    // 3. The 90-Second Idle Auto-Nuke
    let idleTimer: NodeJS.Timeout;
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        handleUnload();
        router.push('/'); // Redirect them out if they are idle
      }, 90000); // 90 seconds of inactivity
    };

    window.addEventListener('touchstart', resetIdleTimer);
    window.addEventListener('click', resetIdleTimer);
    resetIdleTimer();

    return () => {
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('visibilitychange', handleUnload);
      window.removeEventListener('touchstart', resetIdleTimer);
      window.removeEventListener('click', resetIdleTimer);
      clearTimeout(idleTimer);
    };
  }, [sessionId, router]);

  return { isSessionValid, errorMessage };
}
