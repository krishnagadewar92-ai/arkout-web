import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function useTerminalSession(sessionId: string) {
  const [isSessionValid, setIsSessionValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Session claims are made explicitly only after /api/verify-pin succeeds.
    // This hook only manages lifecycle cleanup for that verified session.
    if (!sessionId || (sessionId.length !== 4 && sessionId.length !== 6)) return;

    const apiUrl = sessionId.length === 6 && sessionId.startsWith("02")
      ? (process.env.NEXT_PUBLIC_TERMINAL_02_URL || "https://api2.arkout.in")
      : "https://api.arkout.in";

    setIsSessionValid(true);
    setErrorMessage("");

    const paymentHandoffInProgress = () => {
      try {
        return sessionStorage.getItem("arkout_payment_in_progress") === "1";
      } catch {
        return false;
      }
    };

    const handleUnload = () => {
      // Razorpay/UPI can temporarily hide the page; don't abort while payment
      // confirmation is pending or might need retry.
      if (paymentHandoffInProgress()) return;
      const payload = JSON.stringify({ session_id: sessionId });
      navigator.sendBeacon(`${apiUrl}/api/abort`, payload);
    };

    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = undefined;
      if (document.visibilityState === "hidden") return;

      idleTimer = setTimeout(() => {
        if (paymentHandoffInProgress()) {
          // Keep recovery possible if the payment callback/verification is delayed.
          resetIdleTimer();
          return;
        }
        handleUnload();
        router.push("/");
      }, 90000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = undefined;
      } else {
        resetIdleTimer();
      }
    };

    window.addEventListener("pagehide", handleUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("touchstart", resetIdleTimer);
    window.addEventListener("click", resetIdleTimer);
    resetIdleTimer();

    return () => {
      window.removeEventListener("pagehide", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("touchstart", resetIdleTimer);
      window.removeEventListener("click", resetIdleTimer);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [sessionId, router]);

  return { isSessionValid, errorMessage };
}
