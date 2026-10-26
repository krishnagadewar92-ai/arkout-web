"use client";

import { ChangeEvent, MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, LoaderCircle, LockKeyhole, Printer, ShieldCheck, UploadCloud } from "lucide-react";

const API_BASE = "https://api2.arkout.in";
const STORAGE_PREFIX = "arkout-terminal-02-session:";
const PENDING_ABORT_SUFFIX = ":pending-abort";
const PENDING_CANCEL_SUFFIX = ":pending-cancel";

type PrintConfig = {
  colorMode: "bw" | "color";
  sides: "single" | "double";
  margin: "standard" | "none";
  copies: number;
};

type UploadedDocument = {
  filename: string;
  pages: number;
};

type ActiveOrder = {
  id: string;
  amount: number;
  currency: string;
};

type ApiPayload = Record<string, unknown>;
type RazorpayPaymentResponse = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};
type RazorpayFailureResponse = {
  error?: { description?: string };
};
type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayPaymentResponse) => void | Promise<void>;
  modal: { ondismiss: () => void };
  theme: { color: string };
};
type RazorpayInstance = {
  open: () => void;
  on: (event: string, callback: (response: RazorpayFailureResponse) => void) => void;
};
type WindowWithRazorpay = Window & {
  Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
};

function apiUrl(path: string) {
  return API_BASE + path;
}

function formatRupees(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

function messageFrom(data: ApiPayload, fallback: string) {
  if (typeof data.error === "string") return data.error;
  if (typeof data.message === "string") return data.message;
  return fallback;
}

async function parseResponse(response: Response): Promise<ApiPayload> {
  try {
    return (await response.json()) as ApiPayload;
  } catch {
    return {};
  }
}

function saveSession(pin: string, token: string, order: ActiveOrder | null) {
  try {
    window.sessionStorage.setItem(
      STORAGE_PREFIX + pin,
      JSON.stringify({ sessionToken: token, order }),
    );
  } catch {
    // In-memory state remains usable if browser storage is unavailable.
  }
}

async function loadRazorpayScript() {
  if (typeof window === "undefined") return false;
  if ((window as WindowWithRazorpay).Razorpay) return true;

  return await new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-arkout-razorpay="true"]',
    );
    const script = existing ?? document.createElement("script");

    const cleanup = () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
    const onLoad = () => {
      cleanup();
      resolve(Boolean((window as WindowWithRazorpay).Razorpay));
    };
    const onError = () => {
      cleanup();
      resolve(false);
    };

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.dataset.arkoutRazorpay = "true";
      document.body.appendChild(script);
    }
    window.setTimeout(() => {
      cleanup();
      resolve(Boolean((window as WindowWithRazorpay).Razorpay));
    }, 8000);
  });
}

export default function Terminal02SecurePrintPage({ pin }: { pin: string }) {
  const [sessionToken, setSessionToken] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [startupError, setStartupError] = useState("");
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [config, setConfig] = useState<PrintConfig>({
    colorMode: "bw",
    sides: "single",
    margin: "standard",
    copies: 1,
  });
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [canOpenCheckout, setCanOpenCheckout] = useState(false);
  const [canResumeSameOrder, setCanResumeSameOrder] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPreparingOrder, setIsPreparingOrder] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [isOpeningCheckout, setIsOpeningCheckout] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"info" | "error" | "success">("info");
  const [submitted, setSubmitted] = useState(false);

  const storageKey = STORAGE_PREFIX + pin;
  const pendingAbortKey = storageKey + PENDING_ABORT_SUFFIX;
  const pendingCancelKey = storageKey + PENDING_CANCEL_SUFFIX;
  const abortRequestedRef = useRef(false);
  const publicRazorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";

  // Idle sessions are aborted directly. Sessions with an order use the
  // provider-reconciled cancellation endpoint; the server refuses cancellation
  // whenever a payment or print could still be active.
  const canAbortIdleSession = useCallback(() => {
    return Boolean(sessionToken) &&
      !activeOrder &&
      !submitted &&
      !isUploading &&
      !isPreparingOrder &&
      !isOpeningCheckout &&
      !isCheckingStatus;
  }, [
    sessionToken,
    activeOrder,
    submitted,
    isUploading,
    isPreparingOrder,
    isOpeningCheckout,
    isCheckingStatus,
  ]);

  const clearSessionStorage = useCallback(() => {
    try {
      window.sessionStorage.removeItem(pendingAbortKey);
      window.sessionStorage.removeItem(pendingCancelKey);
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // The server remains authoritative if browser storage is unavailable.
    }
  }, [pendingAbortKey, pendingCancelKey, storageKey]);

  const queueIdleSessionAbort = useCallback(() => {
    if (!canAbortIdleSession() || abortRequestedRef.current) return;
    abortRequestedRef.current = true;

    const body = JSON.stringify({ session_id: pin, session_token: sessionToken });
    try {
      window.sessionStorage.setItem(
        pendingAbortKey,
        JSON.stringify({ sessionToken, requestedAt: Date.now() }),
      );
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // Still attempt a best-effort server abort below.
    }

    let queued = false;
    try {
      queued = navigator.sendBeacon(
        apiUrl("/api/abort"),
        new Blob([body], { type: "text/plain;charset=UTF-8" }),
      );
    } catch {
      queued = false;
    }

    if (!queued) {
      void fetch(apiUrl("/api/abort"), {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body,
        cache: "no-store",
        keepalive: true,
      }).then((response) => {
        if (response.ok || response.status === 401) clearSessionStorage();
      }).catch(() => {
        // The pending marker is retried by the next Terminal 02 page.
      });
    }
  }, [
    canAbortIdleSession,
    clearSessionStorage,
    pin,
    sessionToken,
    pendingAbortKey,
    storageKey,
  ]);

  // For an order, ask the server to reconcile Razorpay before cancellation.
  // A pending/captured/unknown payment results in a safe refusal, not data loss.
  const queueActiveOrderCancellation = useCallback(() => {
    if (!activeOrder || !sessionToken || submitted || abortRequestedRef.current) return;
    abortRequestedRef.current = true;

    const payload = {
      session_id: pin,
      session_token: sessionToken,
      order_id: activeOrder.id,
      razorpay_order_id: activeOrder.id,
    };
    const body = JSON.stringify(payload);

    try {
      window.sessionStorage.setItem(
        pendingCancelKey,
        JSON.stringify({ ...payload, requestedAt: Date.now() }),
      );
    } catch {
      // Best-effort beacon still proceeds.
    }

    let queued = false;
    try {
      queued = navigator.sendBeacon(
        apiUrl("/api/cancel-order"),
        new Blob([body], { type: "text/plain;charset=UTF-8" }),
      );
    } catch {
      queued = false;
    }

    if (!queued) {
      void fetch(apiUrl("/api/cancel-order"), {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body,
        cache: "no-store",
        keepalive: true,
      }).then(async (response) => {
        const data = await parseResponse(response);
        // Clear the retry marker after a definitive response. On a refusal,
        // preserve the stored order so the customer can check/recover it.
        if (response.ok || (response.status >= 400 && response.status < 500)) {
          try { window.sessionStorage.removeItem(pendingCancelKey); } catch {
            // Ignore browser storage restrictions.
          }
        }
        if (response.ok && ["cancelled", "already_cancelled"].includes(String(data.status))) {
          clearSessionStorage();
        }
      }).catch(() => {
        // The pending marker is resolved on the next Terminal 02 load.
      });
    }
  }, [
    activeOrder,
    sessionToken,
    submitted,
    pin,
    pendingCancelKey,
    clearSessionStorage,
  ]);

  const queueLifecycleCleanup = useCallback(() => {
    if (activeOrder) {
      queueActiveOrderCancellation();
    } else {
      queueIdleSessionAbort();
    }
  }, [activeOrder, queueActiveOrderCancellation, queueIdleSessionAbort]);

  function handleBackToArkout(event: ReactMouseEvent<HTMLAnchorElement>) {
    // Preserve normal browser behavior for open-in-new-tab and modified clicks.
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;

    event.preventDefault();
    queueLifecycleCleanup();
    window.location.assign("/");
  }

  useEffect(() => {
    const abortOnBrowserHistoryNavigation = () => queueLifecycleCleanup();
    const abortOnPageExit = () => queueLifecycleCleanup();
    const reloadIfRestoredAfterAbort = (event: PageTransitionEvent) => {
      if (event.persisted && abortRequestedRef.current) window.location.reload();
    };

    window.addEventListener("popstate", abortOnBrowserHistoryNavigation);
    window.addEventListener("pagehide", abortOnPageExit);
    window.addEventListener("pageshow", reloadIfRestoredAfterAbort);
    return () => {
      window.removeEventListener("popstate", abortOnBrowserHistoryNavigation);
      window.removeEventListener("pagehide", abortOnPageExit);
      window.removeEventListener("pageshow", reloadIfRestoredAfterAbort);
    };
  }, [queueLifecycleCleanup]);

  useEffect(() => {
    let cancelled = false;

    async function initialiseSession() {
      setSessionLoading(true);
      setStartupError("");
      try {
        let pendingCancelProblem = "";
        let pendingCancelPayload: {
          sessionToken?: unknown;
          order_id?: unknown;
          razorpay_order_id?: unknown;
        } | null = null;
        try {
          const cancelRaw = window.sessionStorage.getItem(pendingCancelKey);
          if (cancelRaw) pendingCancelPayload = JSON.parse(cancelRaw);
        } catch {
          throw new Error("The previous order state could not be read safely. Check its payment status before starting a new session.");
        }

        if (
          pendingCancelPayload &&
          typeof pendingCancelPayload.sessionToken === "string" &&
          typeof pendingCancelPayload.order_id === "string" &&
          typeof pendingCancelPayload.razorpay_order_id === "string"
        ) {
          try {
            const cancelResponse = await fetch(apiUrl("/api/cancel-order"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                session_id: pin,
                session_token: pendingCancelPayload.sessionToken,
                order_id: pendingCancelPayload.order_id,
                razorpay_order_id: pendingCancelPayload.razorpay_order_id,
              }),
              cache: "no-store",
            });
            const cancelData = await parseResponse(cancelResponse);
            if (
              cancelResponse.ok &&
              ["cancelled", "already_cancelled"].includes(String(cancelData.status))
            ) {
              try {
                window.sessionStorage.removeItem(pendingCancelKey);
                window.sessionStorage.removeItem(pendingAbortKey);
                window.sessionStorage.removeItem(storageKey);
              } catch {
                // Server cancellation succeeded; storage cleanup is best effort.
              }
              window.location.replace("/");
              return;
            }

            // A refusal means the order must be recovered, not force-cleared.
            pendingCancelProblem = messageFrom(
              cancelData,
              "The previous order could not be cancelled safely. Check its payment status before retrying.",
            );
            try { window.sessionStorage.removeItem(pendingCancelKey); } catch {
              // Preserve the saved order and token even if marker cleanup fails.
            }
          } catch {
            // Preserve the order state and let the regular status-recovery UI load.
            pendingCancelProblem = "We could not verify cancellation after leaving the page. Check the existing order status; do not pay again until it is resolved.";
          }
        }

        let pendingAbortToken = "";
        try {
          const pendingRaw = window.sessionStorage.getItem(pendingAbortKey);
          if (pendingRaw) {
            const pending = JSON.parse(pendingRaw) as { sessionToken?: unknown };
            if (typeof pending.sessionToken === "string") pendingAbortToken = pending.sessionToken;
          }
        } catch {
          throw new Error("The previous kiosk session state could not be read safely. Reload this QR page or ask staff for help.");
        }

        if (pendingAbortToken) {
          const abortResponse = await fetch(apiUrl("/api/abort"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: pin, session_token: pendingAbortToken }),
            cache: "no-store",
          });
          const abortData = await parseResponse(abortResponse);
          if (!abortResponse.ok && abortResponse.status !== 401) {
            if (abortResponse.status === 409) {
              throw new Error("The previous session may still be processing a print. Do not pay again; ask kiosk staff to verify its status.");
            }
            throw new Error(messageFrom(abortData, "Could not close the previous idle session safely. Reload the QR page or ask kiosk staff for help."));
          }
          try {
            window.sessionStorage.removeItem(pendingAbortKey);
            window.sessionStorage.removeItem(storageKey);
          } catch {
            // Continue only after the server confirmed abort or the token was already invalid.
          }
        }

        const maintenanceResponse = await fetch(apiUrl("/api/maintenance"), {
          cache: "no-store",
        });
        if (!maintenanceResponse.ok) {
          throw new Error("Terminal 02 availability could not be confirmed.");
        }
        const maintenance = await parseResponse(maintenanceResponse);

        let restoredToken = "";
        let restoredOrder: ActiveOrder | null = null;
        try {
          const saved = window.sessionStorage.getItem(storageKey);
          if (saved) {
            const parsed = JSON.parse(saved) as {
              sessionToken?: unknown;
              order?: unknown;
            };
            if (typeof parsed.sessionToken === "string") restoredToken = parsed.sessionToken;
            if (
              parsed.order &&
              typeof parsed.order === "object" &&
              typeof (parsed.order as ActiveOrder).id === "string" &&
              typeof (parsed.order as ActiveOrder).amount === "number" &&
              typeof (parsed.order as ActiveOrder).currency === "string"
            ) {
              restoredOrder = parsed.order as ActiveOrder;
            }
          }
        } catch {
          // Ignore unusable browser state and require a fresh server claim below.
        }

        if (cancelled) return;
        if (restoredToken) {
          setSessionToken(restoredToken);
          setActiveOrder(restoredOrder);
          if (restoredOrder) {
            setMessage(pendingCancelProblem || "An existing order was found. Check its status before attempting payment again.");
            setCanOpenCheckout(false);
          }
        }

        if (maintenance.enabled === true) {
          setMaintenanceMessage(
            typeof maintenance.message === "string"
              ? maintenance.message
              : "Kiosk is under maintenance",
          );
          return;
        }

        if (restoredToken) return;

        const claimResponse = await fetch(apiUrl("/api/claim_session"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: pin }),
        });
        const claimData = await parseResponse(claimResponse);
        if (!claimResponse.ok || typeof claimData.session_token !== "string") {
          throw new Error(messageFrom(claimData, "Could not reserve this kiosk session. Scan the current QR code again."));
        }
        if (cancelled) return;

        const token = claimData.session_token;
        setSessionToken(token);
        saveSession(pin, token, null);
      } catch (error) {
        if (!cancelled) {
          setStartupError(
            error instanceof Error
              ? error.message
              : "Could not connect to Terminal 02.",
          );
        }
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    }

    void initialiseSession();
    return () => {
      cancelled = true;
    };
  }, [pin, storageKey, pendingAbortKey]);

  const estimatedRupees = useMemo(() => {
    const rate =
      config.colorMode === "color"
        ? config.margin === "none"
          ? 10
          : 8
        : 2;
    return totalPages * config.copies * rate;
  }, [config, totalPages]);

  function saveOrder(next: ActiveOrder | null, token = sessionToken) {
    setActiveOrder(next);
    if (token) saveSession(pin, token, next);
  }

  async function uploadDocuments(event: ChangeEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken) {
      setMessage("The kiosk session is not ready. Please scan the current QR code again.");
      setMessageKind("error");
      return;
    }
    if (files.length === 0) {
      setMessage("Choose at least one PDF or image to upload.");
      setMessageKind("error");
      return;
    }
    if (activeOrder) {
      setMessage("This session already has an order. Check its payment status before starting another checkout.");
      setMessageKind("error");
      return;
    }

    setIsUploading(true);
    setMessage("");
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    form.append("session_id", pin);
    form.append("session_token", sessionToken);

    try {
      const response = await fetch(apiUrl("/upload"), {
        method: "POST",
        body: form,
      });
      const data = await parseResponse(response);
      if (!response.ok) {
        throw new Error(messageFrom(data, "Upload was rejected."));
      }
      const docs = Array.isArray(data.files)
        ? data.files.filter(
            (item): item is UploadedDocument =>
              !!item &&
              typeof item === "object" &&
              typeof (item as UploadedDocument).filename === "string" &&
              typeof (item as UploadedDocument).pages === "number",
          )
        : [];
      if (docs.length === 0 || typeof data.total_pages !== "number") {
        throw new Error("The server did not return a valid uploaded-document manifest.");
      }
      const uploadedPageCount = data.total_pages;
      setUploadedDocuments(docs);
      setTotalPages(uploadedPageCount);
      setConfig((current) => ({
        ...current,
        copies: Math.min(current.copies, Math.max(1, Math.floor(30 / uploadedPageCount))),
      }));
      setFiles([]);
      setMessage("Documents uploaded and registered to this kiosk session.");
      setMessageKind("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
      setMessageKind("error");
    } finally {
      setIsUploading(false);
    }
  }

  async function createSecureOrder() {
    if (!publicRazorpayKey) {
      setMessage("Secure checkout is not configured on this website. No payment was started.");
      setMessageKind("error");
      return;
    }
    if (!sessionToken || uploadedDocuments.length === 0 || totalPages < 1) {
      setMessage("Upload documents and wait for the server to confirm their page count first.");
      setMessageKind("error");
      return;
    }
    if (activeOrder) {
      setMessage("An order already exists for this session. Check its status rather than creating another order.");
      setMessageKind("error");
      return;
    }

    setIsPreparingOrder(true);
    setMessage("");
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error("The payment gateway could not be loaded. No order was created.");

      const response = await fetch(apiUrl("/api/create-order"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: pin,
          session_token: sessionToken,
          filenames: uploadedDocuments.map((doc) => doc.filename),
          config,
        }),
      });
      const data = await parseResponse(response);

      if (!response.ok) {
        if (
          response.status === 409 &&
          typeof data.order_id === "string" &&
          typeof data.amount === "number" &&
          typeof data.currency === "string"
        ) {
          const existing = {
            id: data.order_id,
            amount: data.amount,
            currency: data.currency,
          };
          saveOrder(existing);
          setCanOpenCheckout(false);
          setCanResumeSameOrder(false);
        }
        throw new Error(messageFrom(data, "A secure order could not be created."));
      }
      if (
        typeof data.id !== "string" ||
        typeof data.amount !== "number" ||
        typeof data.currency !== "string"
      ) {
        throw new Error("The server returned an invalid order. Do not pay; contact support.");
      }

      const order = { id: data.id, amount: data.amount, currency: data.currency };
      saveOrder(order);
      setCanOpenCheckout(true);
      setCanResumeSameOrder(false);
      setMessage("Secure order ready. The amount below was calculated by the backend.");
      setMessageKind("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not prepare the secure order.");
      setMessageKind("error");
    } finally {
      setIsPreparingOrder(false);
    }
  }

  async function openCheckout() {
    if (!activeOrder || !sessionToken || !publicRazorpayKey || isOpeningCheckout) return;

    setIsOpeningCheckout(true);
    try {
      const maintenanceResponse = await fetch(apiUrl("/api/maintenance"), { cache: "no-store" });
      const maintenance = await parseResponse(maintenanceResponse);
      if (!maintenanceResponse.ok) {
        throw new Error("Terminal 02 availability could not be confirmed. Do not continue payment.");
      }
      if (maintenance.enabled === true) {
        setMaintenanceMessage(
          typeof maintenance.message === "string"
            ? maintenance.message
            : "Kiosk is under maintenance",
        );
        setCanOpenCheckout(false);
        setCanResumeSameOrder(false);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error("The payment gateway could not be loaded. Do not pay again.");

      // A resumed checkout must obtain a one-time server authorization first.
      const resuming = canResumeSameOrder;
      let resumeToken: string | undefined;
      if (resuming) {
        const resumeResponse = await fetch(apiUrl("/api/authorize-resume"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: pin,
            session_token: sessionToken,
            order_id: activeOrder.id,
          }),
          cache: "no-store",
        });
        const resumeData = await parseResponse(resumeResponse);
        if (!resumeResponse.ok || typeof resumeData.resume_token !== "string") {
          throw new Error(messageFrom(
            resumeData,
            "The existing order is not yet safe to resume. Check payment status and try again later.",
          ));
        }
        resumeToken = resumeData.resume_token;
      }

      // Record every checkout attempt before opening the external payment UI.
      // If this fails, do not open Razorpay because the watchdog would lack a reliable timestamp.
      const startedResponse = await fetch(apiUrl("/api/mark-payment-started"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: pin,
          session_token: sessionToken,
          order_id: activeOrder.id,
          ...(resumeToken ? { resume_token: resumeToken } : {}),
        }),
        cache: "no-store",
      });
      const startedData = await parseResponse(startedResponse);
      if (!startedResponse.ok) {
        throw new Error(messageFrom(
          startedData,
          "The payment attempt could not be recorded. Checkout was not opened; check the order status before retrying.",
        ));
      }

      setCanOpenCheckout(false);
      setCanResumeSameOrder(false);
      const Checkout = (window as WindowWithRazorpay).Razorpay;
      if (!Checkout) throw new Error("The payment gateway is unavailable.");

      const checkout = new Checkout({
        key: publicRazorpayKey,
        amount: activeOrder.amount,
        currency: activeOrder.currency,
        name: "Arkout Print Hub",
        description: "Terminal 02 secure printing",
        order_id: activeOrder.id,
        theme: { color: "#0891b2" },
        handler: async (payment) => {
          if (!payment.razorpay_order_id || !payment.razorpay_payment_id || !payment.razorpay_signature) {
            setMessage("Payment response was incomplete. Do not pay again; check the order status.");
            setMessageKind("error");
            return;
          }
          setMessage("Verifying payment with the server. Do not close this page or pay again.");
          setMessageKind("info");
          try {
            const verifyResponse = await fetch(apiUrl("/api/confirm-payment"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: payment.razorpay_order_id,
                razorpay_payment_id: payment.razorpay_payment_id,
                razorpay_signature: payment.razorpay_signature,
              }),
            });
            const verifyData = await parseResponse(verifyResponse);
            if (verifyResponse.ok && ["submitted", "already_submitted"].includes(String(verifyData.status))) {
              setSubmitted(true);
              setMessage("Payment verified. The server accepted the print submission.");
              setMessageKind("success");
              return;
            }
            setCanOpenCheckout(false);
            setCanResumeSameOrder(false);
            setMessage(
              messageFrom(
                verifyData,
                "Payment could not be confirmed. Do not pay again; check payment status or contact support.",
              ),
            );
            setMessageKind("error");
          } catch {
            setMessage("Payment confirmation could not be reached. Do not pay again; check payment status before doing anything else.");
            setMessageKind("error");
          }
        },
        modal: {
          ondismiss: () => {
            setCanOpenCheckout(false);
            setCanResumeSameOrder(false);
            setMessage("Checkout closed. Verifying payment status before any cancellation is allowed…");
            setMessageKind("info");
            void checkPaymentStatus();
          },
        },
      });

      checkout.on("payment.failed", (failure) => {
        setCanOpenCheckout(false);
        setCanResumeSameOrder(false);
        const description = failure.error?.description;
        setMessage(
          (typeof description === "string" && description
            ? "Payment attempt failed: " + description + ". "
            : "Payment attempt failed. ") +
            "Reconciling with the server before offering cancellation or retry.",
        );
        setMessageKind("info");
        void checkPaymentStatus();
      });
      checkout.open();
    } catch (error) {
      setCanOpenCheckout(false);
      setMessage(error instanceof Error ? error.message : "Could not open secure checkout.");
      setMessageKind("error");
    } finally {
      setIsOpeningCheckout(false);
    }
  }

  async function checkPaymentStatus() {
    if (!activeOrder || !sessionToken || isCheckingStatus) return;
    setIsCheckingStatus(true);
    setCanOpenCheckout(false);
    setCanResumeSameOrder(false);
    setMessage("Checking order and payment status. This will not submit a print job.");
    setMessageKind("info");

    try {
      const response = await fetch(apiUrl("/api/payment-status"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: activeOrder.id,
          session_id: pin,
          session_token: sessionToken,
        }),
      });
      const data = await parseResponse(response);
      if (!response.ok) {
        throw new Error(messageFrom(data, "Could not retrieve order status. Do not pay again."));
      }
      if (data.status === "submitted") {
        setSubmitted(true);
        setMessage(typeof data.message === "string" ? data.message : "This order has already been submitted. It will not be printed again.");
        setMessageKind("success");
      } else if (data.status === "processing") {
        setMessage(typeof data.message === "string" ? data.message : "The print submission is still processing. Do not pay again.");
        setMessageKind("info");
      } else if (data.status === "awaiting_payment" && data.can_resume_same_order === true) {
        const providerStatuses = Array.isArray(data.provider_statuses)
          ? data.provider_statuses.map((value: unknown) => String(value).toLowerCase())
          : [];
        const confirmedFailedAttempts =
          providerStatuses.length > 0 &&
          providerStatuses.every((status: string) => status === "failed");

        if (confirmedFailedAttempts) {
          setCanResumeSameOrder(false);
          setMessage("Razorpay confirmed the payment failed. Cancelling this order and closing the kiosk session…");
          setMessageKind("info");
          void cancelCurrentOrder(false);
        } else {
          setCanResumeSameOrder(true);
          setMessage("No captured or unresolved payment attempt was found. You may resume checkout for this same order.");
          setMessageKind("success");
        }
      } else {
        setMessage(
          messageFrom(
            data,
            "This order needs support review. Do not pay again.",
          ),
        );
        setMessageKind("error");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Status check failed. Do not pay again.");
      setMessageKind("error");
    } finally {
      setIsCheckingStatus(false);
    }
  }

  async function cancelCurrentOrder(requireConfirmation = true) {
    if (!activeOrder || !sessionToken || isCancellingOrder || submitted) return;
    if (requireConfirmation) {
      const confirmed = window.confirm(
        "Cancel this print order and end the kiosk session? Arkout will first reconcile Razorpay. If a payment is captured, pending, or uncertain, cancellation will be refused and the order will remain available for recovery.",
      );
      if (!confirmed) return;
    }

    setIsCancellingOrder(true);
    setMessage("");
    setMessageKind("info");
    try {
      const response = await fetch(apiUrl("/api/cancel-order"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: pin,
          session_token: sessionToken,
          order_id: activeOrder.id,
          razorpay_order_id: activeOrder.id,
        }),
        cache: "no-store",
      });
      const data = await parseResponse(response);
      if (
        !response.ok ||
        !["cancelled", "already_cancelled"].includes(String(data.status))
      ) {
        throw new Error(messageFrom(
          data,
          "Cancellation could not be confirmed. The order has been preserved; check payment status before trying again.",
        ));
      }

      clearSessionStorage();
      setMessage("Order cancelled and kiosk session closed.");
      setMessageKind("success");
      setActiveOrder(null);
      setSessionToken("");
      setUploadedDocuments([]);
      setTotalPages(0);
      window.location.assign("/");
    } catch (error) {
      setMessage(error instanceof Error
        ? error.message
        : "Could not cancel safely. The existing order has been preserved.");
      setMessageKind("error");
    } finally {
      setIsCancellingOrder(false);
    }
  }

  const availableCopies = totalPages > 0 ? Math.max(1, Math.floor(30 / totalPages)) : 1;
  const canUpload = !activeOrder && !maintenanceMessage && !startupError && !sessionLoading;

  if (sessionLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-white">
        <div className="flex items-center gap-3 text-slate-300"><LoaderCircle className="animate-spin" size={20} /> Connecting securely to Terminal 02…</div>
      </main>
    );
  }

  if (maintenanceMessage || startupError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-12 text-white">
        <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl sm:p-10">
          <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-200">
            {maintenanceMessage ? <LockKeyhole size={28} aria-hidden="true" /> : <AlertTriangle size={28} aria-hidden="true" />}
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Arkout Terminal 02</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{maintenanceMessage ? "Kiosk is under maintenance" : "Terminal 02 is temporarily unavailable"}</h1>
          <p className="mt-4 leading-7 text-slate-300">{maintenanceMessage || startupError}</p>
          {activeOrder && sessionToken && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-slate-300">An order exists for this browser session. You can check its status without starting another payment or print job.</p>
              <button type="button" onClick={checkPaymentStatus} disabled={isCheckingStatus} className="mt-4 w-full rounded-xl border border-white/20 px-4 py-3 font-semibold hover:bg-white/10 disabled:opacity-50">
                {isCheckingStatus ? "Checking status…" : "Check existing payment status"}
              </button>
              {message && <p role="status" className="mt-3 text-sm leading-6 text-slate-300">{message}</p>}
            </div>
          )}
          <div className="mt-6 flex items-start gap-3 text-sm leading-6 text-slate-400"><ShieldCheck size={19} className="mt-0.5 shrink-0 text-cyan-300" aria-hidden="true" /> No new checkout or print submission can be started while maintenance is enabled.</div>
          <Link href="/" onClick={handleBackToArkout} className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-slate-200"><ArrowLeft size={17} aria-hidden="true" /> Back to Arkout</Link>
        </section>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-12 text-white">
        <section className="w-full max-w-xl rounded-3xl border border-emerald-300/20 bg-white/[0.04] p-8 text-center shadow-2xl sm:p-10">
          <CheckCircle2 size={56} className="mx-auto text-emerald-300" aria-hidden="true" />
          <h1 className="mt-5 text-3xl font-bold">Print submission confirmed</h1>
          <p className="mt-4 leading-7 text-slate-300">{message || "The server confirmed the verified payment and accepted the print submission."}</p>
          <p className="mt-3 text-sm text-slate-400">Do not submit or pay for this order again.</p>
          <Link href="/" onClick={handleBackToArkout} className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-slate-950"><ArrowLeft size={17} aria-hidden="true" /> Back to Arkout</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200"><Printer size={28} aria-hidden="true" /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Arkout PrintPod · Terminal 02</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Secure printing checkout</h1>
            <p className="mt-1 text-sm text-slate-400">PIN session: {pin}</p>
          </div>
        </header>

        <section className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl sm:p-8">
          {!activeOrder && (
            <>
              <form onSubmit={uploadDocuments} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">1. Upload documents</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-400">PDFs and supported images only. Up to 10 files and 30 pages per print package.</p>
                </div>
                <label htmlFor="terminal-02-files" className="flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-8 text-center hover:border-cyan-300/50">
                  <UploadCloud size={30} className="text-cyan-300" aria-hidden="true" />
                  <span className="mt-3 font-semibold">{files.length ? files.length + " file(s) selected" : "Choose documents"}</span>
                  <span className="mt-1 text-sm text-slate-400">PDF, JPG, PNG, WebP or HEIC</span>
                  <input id="terminal-02-files" className="sr-only" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" onChange={(event) => setFiles(Array.from(event.target.files || []))} />
                </label>
                <button type="submit" disabled={isUploading || files.length === 0 || !canUpload} className="w-full rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50">
                  {isUploading ? "Uploading and validating…" : "Upload and count pages"}
                </button>
              </form>

              {uploadedDocuments.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 font-semibold"><FileText size={18} className="text-cyan-300" /> Server-registered documents</div>
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    {uploadedDocuments.map((doc) => <li key={doc.filename} className="flex justify-between gap-4"><span className="break-all">{doc.filename}</span><span className="shrink-0">{doc.pages} page(s)</span></li>)}
                  </ul>
                  <p className="mt-3 text-sm font-semibold">Total pages confirmed by server: {totalPages}</p>
                </div>
              )}

              {uploadedDocuments.length > 0 && (
                <div className="space-y-5 border-t border-white/10 pt-6">
                  <div>
                    <h2 className="text-lg font-semibold">2. Print settings</h2>
                    <p className="mt-1 text-sm text-slate-400">The backend validates the settings and calculates the final amount.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm text-slate-300">Color mode
                      <select value={config.colorMode} onChange={(event) => setConfig({ ...config, colorMode: event.target.value as PrintConfig["colorMode"], margin: event.target.value === "bw" ? "standard" : config.margin })} className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-3 text-white">
                        <option value="bw">Black & white</option>
                        <option value="color">Color</option>
                      </select>
                    </label>
                    <label className="block text-sm text-slate-300">Sides
                      <select value={config.sides} onChange={(event) => setConfig({ ...config, sides: event.target.value as PrintConfig["sides"] })} className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-3 text-white">
                        <option value="single">Single-sided</option>
                        <option value="double">Double-sided</option>
                      </select>
                    </label>
                    <label className="block text-sm text-slate-300">Copies
                      <select value={config.copies} onChange={(event) => setConfig({ ...config, copies: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-3 text-white">
                        {Array.from({ length: availableCopies }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm text-slate-300">Margins
                      <select value={config.margin} disabled={config.colorMode === "bw"} onChange={(event) => setConfig({ ...config, margin: event.target.value as PrintConfig["margin"] })} className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-3 text-white disabled:opacity-50">
                        <option value="standard">Standard</option>
                        <option value="none">Borderless</option>
                      </select>
                    </label>
                  </div>
                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
                    <p className="text-sm text-slate-300">Estimated total</p>
                    <p className="mt-1 text-2xl font-bold">{formatRupees(Math.round(estimatedRupees * 100))}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">Estimate only. The server's registered order amount is authoritative at checkout.</p>
                  </div>
                  <button type="button" onClick={createSecureOrder} disabled={isPreparingOrder || !canUpload} className="w-full rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">
                    {isPreparingOrder ? "Preparing secure order…" : "Create secure checkout"}
                  </button>
                </div>
              )}
            </>
          )}

          {activeOrder && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Secure order registered</h2>
                <p className="mt-1 break-all text-xs text-slate-400">Order ID: {activeOrder.id}</p>
                <p className="mt-3 text-sm text-slate-300">Server-calculated amount</p>
                <p className="mt-1 text-3xl font-bold">{formatRupees(activeOrder.amount)}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">Only resume payment after the server confirms that the same order has no captured or unresolved payment attempt.</p>
              </div>

              {canOpenCheckout && (
                <button type="button" onClick={openCheckout} disabled={isOpeningCheckout} className="w-full rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-50">
                  {isOpeningCheckout ? "Checking availability…" : "Continue to secure payment"}
                </button>
              )}

              {canResumeSameOrder && (
                <button type="button" onClick={openCheckout} disabled={isOpeningCheckout} className="w-full rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-50">
                  {isOpeningCheckout ? "Checking availability…" : "Resume this same order"}
                </button>
              )}

              <button type="button" onClick={checkPaymentStatus} disabled={isCheckingStatus} className="w-full rounded-xl border border-white/20 px-5 py-3 font-semibold hover:bg-white/10 disabled:opacity-50">
                {isCheckingStatus ? "Checking payment status…" : "Check existing payment status"}
              </button>

              <button
                type="button"
                onClick={() => void cancelCurrentOrder()}
                disabled={isCancellingOrder || isCheckingStatus || !sessionToken}
                className="w-full rounded-xl border border-rose-300/30 bg-rose-400/[0.08] px-5 py-3 font-semibold text-rose-100 hover:bg-rose-400/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCancellingOrder ? "Verifying payment and cancelling…" : "Cancel order & end session"}
              </button>
              <p className="text-xs leading-5 text-slate-400">
                Cancellation is permitted only after the server confirms that no payment or print is pending. If payment status is uncertain, your order will be preserved for recovery.
              </p>
            </div>
          )}

          {message && (
            <div role="status" className={"rounded-2xl border p-4 text-sm leading-6 " + (messageKind === "success" ? "border-emerald-300/25 bg-emerald-300/[0.06] text-emerald-100" : messageKind === "error" ? "border-rose-300/25 bg-rose-300/[0.06] text-rose-100" : "border-white/10 bg-black/20 text-slate-300")}>
              {message}
            </div>
          )}

          <div className="flex items-start gap-3 border-t border-white/10 pt-5 text-xs leading-5 text-slate-400"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-cyan-300" aria-hidden="true" /> Payment verification and print submission are performed by the Terminal 02 backend. This page never calls the direct-print endpoint.</div>
        </section>

        <Link href="/" onClick={handleBackToArkout} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white"><ArrowLeft size={16} aria-hidden="true" /> Back to Arkout</Link>
      </div>
    </main>
  );
}
