"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud, FileText, ChevronRight, Cpu, Check, 
  Palette, Layers, Maximize, Lock, XCircle, Copy, Plus, Minus, Sparkles, Star
} from "lucide-react";
import Image from "next/image";
import { useTerminalSession } from "../../hooks/useTerminalSession";
import { getTerminalApiBaseUrl, validateRecoveryApiBaseUrl } from "../../lib/api-config"; 

type AppStep = 'verify' | 'upload' | 'processing' | 'checkout' | 'success' | 'payment_issue';

type PaymentIssueDetails = {
  message: string;
  paymentId: string;
  orderId: string;
  signature: string;
};

type StoredPaymentRecovery = {
  issue: PaymentIssueDetails;
  sessionId: string;
  sessionToken: string;
  apiUrl: string;
};

type ExistingRazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
};

const PENDING_PAYMENT_KEY = "arkout_pending_payment";
const PENDING_ORDER_KEY = "arkout_pending_order";

// Store an order as soon as checkout opens. If the browser is refreshed before
// Razorpay returns a payment ID/signature, the next page load must not offer a
// second payment until this original order has been reconciled.
function persistPendingOrderRecovery(orderId: string, sessionId: string, sessionToken: string, apiUrl: string) {
  try {
    sessionStorage.removeItem(PENDING_PAYMENT_KEY);
    sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({
      orderId, sessionId, sessionToken, apiUrl, createdAt: Date.now(),
    }));
  } catch {
    // If browser storage is unavailable, server-side payment idempotency remains essential.
  }
}

function persistPendingPaymentRecovery(issue: PaymentIssueDetails, sessionId: string, sessionToken: string, apiUrl: string) {
  try {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify({
      ...issue, sessionId, sessionToken, apiUrl, createdAt: Date.now(),
    }));
    sessionStorage.removeItem(PENDING_ORDER_KEY);
  } catch {
    // Keep the order marker whenever possible rather than silently losing recovery state.
  }
}

function clearPendingOrderRecovery() {
  try { sessionStorage.removeItem(PENDING_ORDER_KEY); } catch {}
}

function clearStoredPaymentRecovery() {
  try {
    sessionStorage.removeItem(PENDING_PAYMENT_KEY);
    sessionStorage.removeItem(PENDING_ORDER_KEY);
  } catch {}
}

function readStoredPaymentRecovery(): StoredPaymentRecovery | null {
  try {
    const paymentRaw = sessionStorage.getItem(PENDING_PAYMENT_KEY);
    if (paymentRaw) {
      const saved = JSON.parse(paymentRaw);
      if (
        saved && typeof saved.orderId === "string" && saved.orderId.length > 0 &&
        typeof saved.sessionId === "string" &&
        typeof saved.sessionToken === "string" &&
        typeof saved.apiUrl === "string"
      ) {
        return {
          issue: {
            message: typeof saved.message === "string" ? saved.message :
              "A previous payment needs verification. Do not pay again until its status is confirmed.",
            paymentId: typeof saved.paymentId === "string" ? saved.paymentId : "",
            orderId: saved.orderId,
            signature: typeof saved.signature === "string" ? saved.signature : "",
          },
          sessionId: saved.sessionId,
          sessionToken: saved.sessionToken,
          apiUrl: validateRecoveryApiBaseUrl(saved.sessionId, saved.apiUrl),
        };
      }
    }

    const orderRaw = sessionStorage.getItem(PENDING_ORDER_KEY);
    if (orderRaw) {
      const saved = JSON.parse(orderRaw);
      if (
        saved && typeof saved.orderId === "string" && saved.orderId.length > 0 &&
        typeof saved.sessionId === "string" &&
        typeof saved.sessionToken === "string" &&
        typeof saved.apiUrl === "string"
      ) {
        return {
          issue: {
            message: "The payment window closed or refreshed before this browser received the payment result. Do not pay again. This order must be checked before another payment attempt.",
            paymentId: "",
            orderId: saved.orderId,
            signature: "",
          },
          sessionId: saved.sessionId,
          sessionToken: saved.sessionToken,
          apiUrl: validateRecoveryApiBaseUrl(saved.sessionId, saved.apiUrl),
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

const loadRazorpay = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function Home() {
  const [step, setStep] = useState<AppStep>('verify');
  const [pin, setPin] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [verifiedSessionPin, setVerifiedSessionPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  
  const [apiBaseUrl, setApiBaseUrl] = useState("");

  const [files, setFiles] = useState<File[]>([]);
  const [uploadedFilenames, setUploadedFilenames] = useState<string[]>([]); 
  const [progress, setProgress] = useState(0);
  const [logText, setLogText] = useState("Initializing neural engine...");

  const [basePages, setBasePages] = useState(1);
  const [copies, setCopies] = useState(1);
  const [colorMode, setColorMode] = useState<'bw' | 'color'>('bw');
  const [sides, setSides] = useState<'single' | 'double'>('single');
  const [margin, setMargin] = useState<'standard' | 'none'>('standard');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentIssue, setPaymentIssue] = useState<PaymentIssueDetails>({ message: "", paymentId: "", orderId: "", signature: "" });
  const [isConfirming, setIsConfirming] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [resumableOrder, setResumableOrder] = useState<ExistingRazorpayOrder | null>(null);

  const setPaymentHandoffFlag = (active: boolean) => {
    try {
      if (active) sessionStorage.setItem("arkout_payment_in_progress", "1");
      else sessionStorage.removeItem("arkout_payment_in_progress");
    } catch {
      // Payment verification still runs server-side if browser storage is unavailable.
    }
  };

  // Review States
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isReviewSubmitted, setIsReviewSubmitted] = useState(false);

  const { isSessionValid, errorMessage } = useTerminalSession(verifiedSessionPin);

  useEffect(() => {
    // Payment recovery takes priority over starting a new session. Never show
    // checkout again while an earlier order has an unresolved payment outcome.
    const recovery = readStoredPaymentRecovery();
    if (recovery) {
      setApiBaseUrl(recovery.apiUrl || "https://api.arkout.in");
      setPin(recovery.sessionId);
      setSessionToken(recovery.sessionToken);
      const recoveryIssue = recovery.apiUrl
        ? recovery.issue
        : {
            ...recovery.issue,
            message: `${recovery.issue.message} This preview is not configured to contact the saved payment endpoint. Do not pay again; return to the original kiosk or contact support.`,
          };
      setPaymentIssue(recoveryIssue);
      setPaymentHandoffFlag(true);
      setStep("payment_issue");
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const urlPin = urlParams.get('pin');
    let savedPin = "";
    let savedToken = "";
    try {
      savedPin = sessionStorage.getItem("arkout_session_pin") || "";
      savedToken = sessionStorage.getItem("arkout_session_token") || "";
    } catch {}
    const pinToResume = urlPin || (savedToken.length >= 32 ? savedPin : "");
    if (pinToResume) {
      setPin(pinToResume);
      verifyTerminalPin(pinToResume);
    }
  }, []);

  // Reset margin to standard if user switches back to B&W
  useEffect(() => {
    if (colorMode === 'bw') setMargin('standard');
  }, [colorMode]);

  const totalPages = basePages * copies;
  const maxCopies = Math.floor(30 / basePages);

  const handleIncrementCopies = () => { if (copies < maxCopies) setCopies(prev => prev + 1); };
  const handleDecrementCopies = () => { if (copies > 1) setCopies(prev => prev - 1); };

  const currentPrice = useMemo(() => {
    const safePages = totalPages > 0 ? totalPages : 1; 
    let pricePerPage = 1.5;
    if (colorMode === 'color') pricePerPage = margin === 'none' ? 10 : 7;
    return safePages * pricePerPage;
  }, [totalPages, colorMode, margin]);

  const verifyTerminalPin = async (pinToVerify: string) => {
    setIsVerifying(true);
    setPinError("");
    
    if (pinToVerify.length !== 4 && !(pinToVerify.length === 6 && pinToVerify.startsWith("02"))) {
      setPinError("Invalid PIN format.");
      setIsVerifying(false);
      return;
    }

    const targetUrl = getTerminalApiBaseUrl(pinToVerify);
    if (!targetUrl) {
      setPinError("This preview has no isolated backend configured. Checkout is disabled for safety.");
      setIsVerifying(false);
      return;
    }

    setApiBaseUrl(targetUrl);

    try {
      const response = await fetch(`${targetUrl}/api/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinToVerify }),
      });
      if (response.ok) {
        // On a same-tab refresh, reuse the session token already issued to this browser.
        let savedPin = "";
        let savedToken = "";
        try {
          savedPin = sessionStorage.getItem("arkout_session_pin") || "";
          savedToken = sessionStorage.getItem("arkout_session_token") || "";
        } catch {}
        if (savedPin === pinToVerify && savedToken.length >= 32) {
          setSessionToken(savedToken);
          setVerifiedSessionPin(pinToVerify);
          setStep("upload");
        } else {
          // Claim the session only after the entire PIN has been verified by its terminal.
          const claimResponse = await fetch(`${targetUrl}/api/claim_session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: pinToVerify }),
          });
          const claimData = await claimResponse.json().catch(() => ({}));
          if (claimResponse.ok && typeof claimData.session_token === "string" && claimData.session_token.length >= 32) {
            setSessionToken(claimData.session_token);
            setVerifiedSessionPin(pinToVerify);
            try {
              sessionStorage.setItem("arkout_session_pin", pinToVerify);
              sessionStorage.setItem("arkout_session_token", claimData.session_token);
            } catch {}
            setStep("upload");
          } else {
            setPinError(
              claimData.error || "This kiosk session is already in use. Please scan the current QR code again."
            );
          }
        }
      } else {
        setPinError("Invalid PIN. Check the kiosk screen.");
      }
    } catch (err) {
      setPinError("Cannot connect to Terminal node.");
    }
    setIsVerifying(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const handleOptimize = async () => {
    if (files.length === 0) return;
    setStep('processing');
    setProgress(0);
    setLogText("Establishing secure node bridge...");

    const formData = new FormData();
    formData.append("session_id", pin);
    formData.append("session_token", sessionToken);
    files.forEach((file) => formData.append("files", file));

    try {
      setTimeout(() => { setProgress(25); setLogText("Analyzing document structure & pages..."); }, 400);
      
      const response = await fetch(`${apiBaseUrl}/upload`, { method: "POST", body: formData });

      if (response.ok) {
        const data = await response.json();
        const detectedPages = data.total_pages > 0 ? data.total_pages : 1;
        setBasePages(detectedPages);

        if (data.files && Array.isArray(data.files)) {
            setUploadedFilenames(data.files.map((f: any) => f.filename));
        }

        setCopies(1);
        setProgress(60);
        setLogText(`Analysis complete. Found ${detectedPages} pages.`);
        
        setTimeout(() => { setProgress(85); setLogText("Preparing print configuration options..."); }, 1200);
        setTimeout(() => { setProgress(100); setLogText("Ready."); }, 2200);
      } else {
        setLogText("Error: Server rejected the package.");
      }
    } catch (error) {
      setLogText("Error: Tunnel connection lost.");
    }
  };

  const handlePayment = async (existingOrder?: ExistingRazorpayOrder) => {
    if (!existingOrder && uploadedFilenames.length === 0) {
      alert("Upload your documents again before paying.");
      return;
    }

    setIsPaying(true);
    const isLoaded = await loadRazorpay();
    if (!isLoaded) {
      alert("Failed to load payment gateway.");
      setIsPaying(false);
      return;
    }

    try {
      let order: ExistingRazorpayOrder;
      if (existingOrder) {
        // Reuse only the exact order positively re-authorized by a fresh
        // /api/payment-status response. Do not call create-order for recovery.
        if (
          existingOrder.id !== paymentIssue.orderId ||
          !Number.isSafeInteger(existingOrder.amount) ||
          existingOrder.amount <= 0 ||
          existingOrder.currency !== "INR"
        ) {
          throw new Error("The existing order could not be safely resumed. Check its status again.");
        }
        order = existingOrder;
      } else {
        // The server derives price from its own files/config, not from a client-supplied amount.
        const orderRes = await fetch(`${apiBaseUrl}/api/create-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: pin,
            session_token: sessionToken,
            filenames: uploadedFilenames,
            config: { colorMode, sides, margin, copies },
          }),
        });

        const orderData = await orderRes.json().catch(() => ({}));
        if (!orderRes.ok || !orderData.id) {
          // The backend deliberately refuses to return an existing order straight
          // into checkout. Preserve it for reconciliation instead of treating
          // that safety response as a generic error or clearing the recovery flag.
          if (
            orderRes.status === 409 &&
            orderData.status === "existing_order_requires_reconciliation" &&
            typeof orderData.order_id === "string" &&
            orderData.order_id.length > 0
          ) {
            const issue: PaymentIssueDetails = {
              message: orderData.error ||
                "An existing payment order must be checked before checkout can resume. Do not pay again until its status is confirmed.",
              paymentId: "",
              orderId: orderData.order_id,
              signature: "",
            };
            persistPendingOrderRecovery(orderData.order_id, pin, sessionToken, apiBaseUrl);
            setPaymentIssue(issue);
            setResumableOrder(null);
            setPaymentHandoffFlag(true);
            setStep("payment_issue");
            setIsPaying(false);
            return;
          }
          throw new Error(orderData.error || orderData.message || "Order creation failed");
        }

        // Refuse checkout if the server's authoritative price differs from the displayed quote.
        if (Number(orderData.amount) !== Math.round(currentPrice * 100)) {
          throw new Error("The server price differs from the displayed price. Please restart and calculate again.");
        }
        order = {
          id: String(orderData.id),
          amount: Number(orderData.amount),
          currency: String(orderData.currency || ""),
        };
        if (!Number.isSafeInteger(order.amount) || order.amount <= 0 || order.currency !== "INR") {
          throw new Error("The server returned an invalid order amount or currency.");
        }
      }

      let paymentCallbackReceived = false;
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "Arkout Print Hub",
        description: existingOrder ? "Secure Print - existing order retry" : `Secure Print - ${totalPages} Pages`,
        order_id: order.id,
        handler: async function (response: any) {
          paymentCallbackReceived = true;
          setResumableOrder(null);
          const initialIssue: PaymentIssueDetails = {
            message: "Payment response received. The server is checking payment and print status. Do not pay again.",
            paymentId: response.razorpay_payment_id || "",
            orderId: response.razorpay_order_id || order.id,
            signature: response.razorpay_signature || "",
          };
          // Persist the callback synchronously before starting network verification,
          // so a refresh/network failure can recover the same payment attempt.
          persistPendingPaymentRecovery(initialIssue, pin, sessionToken, apiBaseUrl);
          setPaymentIssue(initialIssue);
          setPaymentHandoffFlag(true);
          let paymentConfirmed = false;
          // Never submit a print directly from the browser. The backend verifies
          // the Razorpay signature and captured status, then submits the stored job once.
          try {
            const verifyRes = await fetch(`${apiBaseUrl}/api/confirm-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: initialIssue.orderId,
                razorpay_payment_id: initialIssue.paymentId,
                razorpay_signature: initialIssue.signature,
              }),
            });

            const confirmation = await verifyRes.json().catch(() => ({}));
            if (
              !verifyRes.ok ||
              !["submitted", "already_submitted"].includes(confirmation.status)
            ) {
              const issue: PaymentIssueDetails = {
                message: confirmation.error ||
                  confirmation.message ||
                  "We could not confirm the payment and print status. Do not pay again; retry verification or contact support.",
                paymentId: initialIssue.paymentId,
                orderId: initialIssue.orderId,
                signature: initialIssue.signature,
              };
              setPaymentIssue(issue);
              persistPendingPaymentRecovery(issue, pin, sessionToken, apiBaseUrl);
              setStep("payment_issue");
              return;
            }

            paymentConfirmed = true;
            clearStoredPaymentRecovery();
            setStep("success");
          } catch (err) {
            const issue: PaymentIssueDetails = {
              message: "The payment response was received, but the kiosk could not confirm the print status. Do not pay again; retry verification or contact support.",
              paymentId: initialIssue.paymentId,
              orderId: initialIssue.orderId,
              signature: initialIssue.signature,
            };
            setPaymentIssue(issue);
            persistPendingPaymentRecovery(issue, pin, sessionToken, apiBaseUrl);
            setStep("payment_issue");
          } finally {
            setIsPaying(false);
            // Keep the session alive on ambiguous outcomes so the same payment can be retried.
            if (paymentConfirmed) setPaymentHandoffFlag(false);
          }
        },
        prefill: { name: "Arkout User", contact: "9999999999" },
        theme: { color: "#000000" },
        modal: {
          ondismiss: function () {
            if (!paymentCallbackReceived) {
              const issue: PaymentIssueDetails = {
                message: "The payment window was closed before the browser received a result. Do not pay again until the existing order has been checked.",
                paymentId: "",
                orderId: order.id,
                signature: "",
              };
              persistPendingOrderRecovery(order.id, pin, sessionToken, apiBaseUrl);
              setPaymentIssue(issue);
              setStep("payment_issue");
              setPaymentHandoffFlag(true);
            }
            setIsPaying(false);
            fetch(`${apiBaseUrl}/api/set-state`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "processing", session_id: pin, session_token: sessionToken }),
            }).catch(() => {});
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);

      // Update the kiosk status for the customer-facing screen; not used as proof of payment.
      fetch(`${apiBaseUrl}/api/set-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "payment", session_id: pin, session_token: sessionToken }),
      }).catch(() => {});

      rzp.on("payment.failed", function (response: any) {
        paymentCallbackReceived = true;
        setResumableOrder(null);
        const description = response?.error?.description || "Payment attempt failed.";
        const issue: PaymentIssueDetails = {
          message: `Payment attempt reported a failure: ${description} Check the existing order status before retrying. Do not pay through a new order.`,
          paymentId: response?.error?.metadata?.payment_id || "",
          orderId: response?.error?.metadata?.order_id || order.id,
          signature: "",
        };
        persistPendingOrderRecovery(order.id, pin, sessionToken, apiBaseUrl);
        setPaymentIssue(issue);
        setStep("payment_issue");
        setPaymentHandoffFlag(true);
        setIsPaying(false);
        fetch(`${apiBaseUrl}/api/set-state`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "processing", session_id: pin, session_token: sessionToken }),
        }).catch(() => {});
      });

      persistPendingOrderRecovery(order.id, pin, sessionToken, apiBaseUrl);
      setPaymentHandoffFlag(true);
      rzp.open();
    } catch (err) {
      clearStoredPaymentRecovery();
      setPaymentHandoffFlag(false);
      alert(err instanceof Error ? err.message : "Gateway error.");
      setIsPaying(false);
      fetch(`${apiBaseUrl}/api/set-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "processing", session_id: pin, session_token: sessionToken }),
      }).catch(() => {});
    }
  };

  const retryPaymentConfirmation = async () => {
    if (!paymentIssue.orderId || !paymentIssue.paymentId || !paymentIssue.signature || isConfirming) return;
    setIsConfirming(true);
    setPaymentHandoffFlag(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: paymentIssue.orderId,
          razorpay_payment_id: paymentIssue.paymentId,
          razorpay_signature: paymentIssue.signature,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && ["submitted", "already_submitted"].includes(data.status)) {
        clearStoredPaymentRecovery();
        setResumableOrder(null);
        setPaymentHandoffFlag(false);
        setStep("success");
      } else {
        const issue: PaymentIssueDetails = {
          ...paymentIssue,
          message: data.error || data.message || "Payment/print status is still being checked. Do not pay again; retry or contact support.",
        };
        setPaymentIssue(issue);
        persistPendingPaymentRecovery(issue, pin, sessionToken, apiBaseUrl);
      }
    } catch {
      const issue: PaymentIssueDetails = {
        ...paymentIssue,
        message: "Could not reach the verification service. Do not pay again; retry verification when the connection returns.",
      };
      setPaymentIssue(issue);
      persistPendingPaymentRecovery(issue, pin, sessionToken, apiBaseUrl);
    } finally {
      setIsConfirming(false);
      // Keep the session reserved if verification is still ambiguous; only a
      // confirmed submission is allowed to clear the payment handoff flag.
    }
  };

  const reconcileExistingOrder = async () => {
    if (!paymentIssue.orderId || !pin || !sessionToken || isReconciling) return;
    setIsReconciling(true);
    setPaymentHandoffFlag(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/payment-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: paymentIssue.orderId,
          session_id: pin,
          session_token: sessionToken,
        }),
      });
      const data = await res.json().catch(() => ({}));

      // Only the server's explicit submitted status can end recovery successfully.
      // This endpoint never submits a print; all other states remain pending/review.
      if (res.ok && data.status === "submitted") {
        clearStoredPaymentRecovery();
        setResumableOrder(null);
        setPaymentHandoffFlag(false);
        setStep("success");
        return;
      }

      if (
        res.ok &&
        data.status === "awaiting_payment" &&
        data.can_resume_same_order === true &&
        data.razorpay_order_id === paymentIssue.orderId &&
        Number.isSafeInteger(Number(data.amount)) &&
        Number(data.amount) > 0 &&
        data.currency === "INR"
      ) {
        const allowedOrder: ExistingRazorpayOrder = {
          id: data.razorpay_order_id,
          amount: Number(data.amount),
          currency: data.currency,
        };
        setResumableOrder(allowedOrder);
        const issue: PaymentIssueDetails = {
          ...paymentIssue,
          paymentId: "",
          signature: "",
          message: data.message ||
            "No captured or unresolved payment attempt was found. You may resume checkout for this same order.",
        };
        setPaymentIssue(issue);
        persistPendingPaymentRecovery(issue, pin, sessionToken, apiBaseUrl);
        return;
      }

      setResumableOrder(null);
      const issue: PaymentIssueDetails = {
        ...paymentIssue,
        paymentId: typeof data.razorpay_payment_id === "string" && data.razorpay_payment_id
          ? data.razorpay_payment_id
          : paymentIssue.paymentId,
        message: data.message || data.error ||
          "The existing order could not be reconciled yet. Do not pay again; check again later or contact support.",
      };
      setPaymentIssue(issue);
      persistPendingPaymentRecovery(issue, pin, sessionToken, apiBaseUrl);
    } catch {
      const issue: PaymentIssueDetails = {
        ...paymentIssue,
        message: "Could not reach the order-status service. Do not pay again; retry checking the existing order when the connection returns.",
      };
      setPaymentIssue(issue);
      persistPendingPaymentRecovery(issue, pin, sessionToken, apiBaseUrl);
    } finally {
      setIsReconciling(false);
      // Keep payment handoff active until server confirms an already-submitted job.
    }
  };

  const resumeExistingOrder = async () => {
    if (!resumableOrder || !paymentIssue.orderId || isReconciling || isPaying) return;
    setIsReconciling(true);
    setPaymentHandoffFlag(true);
    try {
      // Recheck immediately before opening Checkout; an earlier positive result can go stale.
      const res = await fetch(`${apiBaseUrl}/api/payment-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: paymentIssue.orderId,
          session_id: pin,
          session_token: sessionToken,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.status === "submitted") {
        clearStoredPaymentRecovery();
        setResumableOrder(null);
        setPaymentHandoffFlag(false);
        setStep("success");
        return;
      }

      const canResume =
        res.ok &&
        data.status === "awaiting_payment" &&
        data.can_resume_same_order === true &&
        data.razorpay_order_id === paymentIssue.orderId &&
        Number.isSafeInteger(Number(data.amount)) &&
        Number(data.amount) > 0 &&
        data.currency === "INR";

      if (!canResume) {
        setResumableOrder(null);
        const issue: PaymentIssueDetails = {
          ...paymentIssue,
          paymentId: typeof data.razorpay_payment_id === "string" ? data.razorpay_payment_id : paymentIssue.paymentId,
          message: data.message || data.error ||
            "The existing order is no longer eligible for payment retry. Do not pay again; contact support if payment may have completed.",
        };
        setPaymentIssue(issue);
        persistPendingPaymentRecovery(issue, pin, sessionToken, apiBaseUrl);
        return;
      }

      const order: ExistingRazorpayOrder = {
        id: data.razorpay_order_id,
        amount: Number(data.amount),
        currency: data.currency,
      };
      setResumableOrder(order);
      // Opens Razorpay with the existing order ID; no /api/create-order call is made.
      await handlePayment(order);
    } catch {
      const issue: PaymentIssueDetails = {
        ...paymentIssue,
        message: "Could not recheck the existing order. Do not pay again; check the order status when the connection returns.",
      };
      setPaymentIssue(issue);
      persistPendingPaymentRecovery(issue, pin, sessionToken, apiBaseUrl);
    } finally {
      setIsReconciling(false);
    }
  };

  const handleReviewSubmit = async () => {
    setIsReviewSubmitted(true);
    try {
      await fetch(`${apiBaseUrl}/api/submit-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          rating: rating, 
          review_text: reviewText 
        })
      });
    } catch (err) { 
      console.error("Failed to submit review", err); 
    }
  };

  const resetApp = async () => {
    clearStoredPaymentRecovery();
    setResumableOrder(null);
    setPaymentHandoffFlag(false);
    setVerifiedSessionPin("");
    setSessionToken("");
    try { sessionStorage.removeItem("arkout_session_pin"); sessionStorage.removeItem("arkout_session_token"); } catch {}
    try {
      await fetch(`${apiBaseUrl}/api/abort`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: pin, session_token: sessionToken }) });
    } catch (e) { console.error("Abort failed"); }

    setFiles([]); setUploadedFilenames([]);
    setStep('verify'); setProgress(0); setPin("");
    setColorMode('bw'); setSides('single'); setMargin('standard'); 
    setBasePages(1); setCopies(1);
    setRating(0); setReviewText(""); setIsReviewSubmitted(false);
    setPaymentIssue({ message: "", paymentId: "", orderId: "", signature: "" });
    setApiBaseUrl("https://api.arkout.in");
  };

  if (!isSessionValid) {
    return (
      <main className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center font-sans text-white">
        <XCircle size={64} className="text-red-500 mb-6" />
        <h1 className="text-2xl font-semibold mb-2">Session Grabbed</h1>
        <p className="text-zinc-400">{errorMessage}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full relative overflow-hidden font-sans text-white flex flex-col items-center justify-center p-4 md:p-6 bg-zinc-950">
      
      {/* BACKGROUND ADVERTISEMENT LAYER */}
      <div className={`absolute inset-0 transition-all duration-700 ease-in-out z-0 flex items-center justify-center overflow-hidden pointer-events-none ${step !== 'verify' ? 'blur-3xl scale-105 opacity-40' : 'blur-none opacity-100'}`}>
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-900/20 via-black to-purple-900/20 z-10"></div>
        <div className="relative z-0 flex flex-col items-center text-center p-12 max-w-4xl">
          <span className="px-4 py-1.5 rounded-full bg-white/10 text-cyan-400 text-xs font-medium tracking-widest uppercase mb-4 backdrop-blur-md">Sponsored • Arkout Ecosystem</span>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500 mb-6">
            The Future of Autonomous Printing.
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl">
            Lightning-fast cloud routing, enterprise security, and zero friction. Scan your terminal QR code to begin.
          </p>
        </div>
      </div>

      <div className="z-10 w-full max-w-2xl flex flex-col items-center">
        
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] backdrop-blur-xl border border-white/10 text-xs font-medium text-zinc-300 mb-3 shadow-sm">
            <Sparkles size={12} className="text-cyan-400" /> Arkout Secure Kiosk Node
          </div>
        </motion.div>

        <div className="w-full relative">
          <div className="absolute -inset-[1px] rounded-[36px] bg-gradient-to-b from-white/20 to-white/5 opacity-50 blur-[2px]"></div>
          
          <div className="relative bg-zinc-900/75 backdrop-blur-2xl border border-white/15 rounded-[34px] p-6 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden min-h-[420px] flex flex-col justify-between">

            <AnimatePresence mode="wait">

              {/* STEP 0: PIN VERIFICATION */}
              {step === 'verify' && (
                <motion.div key="verify" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, filter: "blur(10px)" }} className="flex flex-col w-full max-w-sm mx-auto items-center text-center justify-center my-auto">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/10 to-white/[0.02] border border-white/15 flex items-center text-cyan-400 justify-center mb-5 shadow-inner">
                    <Lock size={28} />
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight text-white mb-2">Terminal Authentication</h3>
                  <p className="text-sm text-zinc-400 mb-6 leading-relaxed">Enter the 4 or 6-digit PIN visible on the kiosk screen to establish a secure session.</p>

                  <input 
                    type="text" 
                    maxLength={6} 
                    placeholder="••••" 
                    value={pin} 
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} 
                    className="w-full bg-black/40 border border-white/15 rounded-2xl py-4 text-center text-3xl font-mono text-white tracking-[0.3em] focus:outline-none focus:border-cyan-400/80 focus:ring-4 focus:ring-cyan-500/20 transition-all mb-4 shadow-inner"
                  />
                  {pinError && <p className="text-red-400 text-xs font-medium mb-4">{pinError}</p>}

                  <button 
                    onClick={() => verifyTerminalPin(pin)} 
                    disabled={(pin.length !== 4 && pin.length !== 6) || isVerifying} 
                    className={`w-full py-4 rounded-2xl font-semibold text-sm tracking-wide flex justify-center items-center space-x-2 transition-all duration-300 ${(pin.length === 4 || pin.length === 6) ? "bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.2)]" : "bg-white/5 text-zinc-600 border border-white/5 cursor-not-allowed"}`}
                  >
                    {isVerifying ? <span>Verifying Node...</span> : <span>Continue</span>}
                  </button>
                </motion.div>
              )}

              {/* STEP 1: FILE DROP ZONE */}
              {step === 'upload' && (
                <motion.div key="upload" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, filter: "blur(10px)" }} className="flex flex-col w-full max-w-lg mx-auto my-auto">
                  <h3 className="text-xl font-semibold tracking-tight mb-2">Select Documents</h3>
                  <p className="text-sm text-zinc-400 mb-6">Upload PDFs, images, or documents for instant local rendering.</p>

                  <label className="relative flex flex-col items-center justify-center w-full min-h-[14rem] p-6 border border-dashed border-white/20 rounded-3xl cursor-pointer transition-all duration-300 bg-black/30 hover:bg-black/50 hover:border-cyan-400/50 group">
                    {files.length === 0 ? (
                      <div className="flex flex-col items-center z-10">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-zinc-300 mb-4 group-hover:scale-105 transition-transform">
                          <UploadCloud size={28} />
                        </div>
                        <span className="text-sm font-medium text-white mb-1">Click to browse or drop files</span>
                        <span className="text-xs text-zinc-500">Supports PDF, PNG, JPG, HEIC</span>
                      </div>
                    ) : (
                      <div className="flex flex-col w-full gap-2.5 z-10 max-h-[160px] overflow-y-auto pr-1">
                        {files.map((f, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                            <FileText size={18} className="text-cyan-400 flex-shrink-0" />
                            <span className="text-xs font-medium text-zinc-200 truncate">{f.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <input type="file" multiple className="hidden" onChange={handleFileChange} accept=".pdf,.docx,.png,.jpg,.jpeg,.heic" />
                  </label>

                  <div className="flex gap-3 mt-6">
                    <button onClick={resetApp} className="px-5 py-4 rounded-2xl font-semibold text-xs bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-all">Back</button>
                    <button onClick={handleOptimize} disabled={files.length === 0} className={`flex-1 py-4 rounded-2xl font-semibold text-sm flex justify-center items-center gap-2 transition-all ${files.length > 0 ? "bg-white text-black hover:bg-zinc-200 shadow-lg" : "bg-white/5 text-zinc-600 cursor-not-allowed"}`}>
                      <span>Process Package</span> <ChevronRight size={16} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: PROCESSING ANIMATION */}
              {step === 'processing' && (
                <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center my-auto py-6">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-6">
                    <Cpu size={32} className="animate-pulse" />
                  </div>
                  <div className="w-full max-w-sm mb-6">
                    <div className="flex justify-between text-xs font-medium text-zinc-400 mb-2">
                      <span>Secure Pipeline</span>
                      <span className="text-cyan-400 font-mono">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden border border-white/10">
                      <motion.div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <p className="text-xs font-mono text-zinc-400 mb-8">{logText}</p>
                  
                  {progress === 100 && basePages <= 30 && (
                    <button onClick={() => setStep('checkout')} className="w-full max-w-xs py-4 rounded-2xl font-semibold text-sm bg-white text-black hover:bg-zinc-200 transition-all shadow-lg flex items-center justify-center gap-2">
                      Configure Print <ChevronRight size={16} />
                    </button>
                  )}
                  {progress === 100 && basePages > 30 && (
                    <div className="text-center">
                      <p className="text-red-400 text-xs mb-4 font-medium">Exceeds 30-page limit ({basePages} pages).</p>
                      <button onClick={resetApp} className="px-6 py-3 rounded-xl bg-white/10 text-white text-xs font-medium">Restart</button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* STEP 3: CHECKOUT & CONFIG */}
              {step === 'checkout' && (
                <motion.div key="checkout" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex flex-col md:flex-row w-full gap-6 my-auto">
                  <div className="flex-1 flex flex-col space-y-4">
                    <h3 className="text-lg font-semibold tracking-tight">Print Layout</h3>

                    {/* Ink Mode */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">Color Profile</label>
                      <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10">
                        <button onClick={() => setColorMode('bw')} className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${colorMode === 'bw' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400'}`}>B&W (₹1.5)</button>
                        <button onClick={() => setColorMode('color')} className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${colorMode === 'color' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-zinc-400'}`}>Color (₹7)</button>
                      </div>
                    </div>

                    {/* Borders Options - Only visible if Color is selected */}
                    {colorMode === 'color' && (
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">Borders</label>
                        <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10">
                          <button onClick={() => setMargin('standard')} className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${margin === 'standard' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400'}`}>Standard (₹7)</button>
                          <button onClick={() => setMargin('none')} className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${margin === 'none' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-zinc-400'}`}>Borderless (₹10)</button>
                        </div>
                      </div>
                    )}

                    {/* Layout Mode */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">Sides</label>
                      <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10">
                        <button onClick={() => setSides('single')} className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${sides === 'single' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400'}`}>Single</button>
                        <button onClick={() => setSides('double')} className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${sides === 'double' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400'}`}>Double</button>
                      </div>
                    </div>

                    {/* Copies */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider flex justify-between">
                        <span>Copies</span>
                        <span className="text-cyan-400">Max {maxCopies}</span>
                      </label>
                      <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10 items-center justify-between px-3">
                        <button onClick={handleDecrementCopies} disabled={copies <= 1} className="p-2 text-zinc-400 hover:text-white disabled:opacity-30"><Minus size={16}/></button>
                        <span className="font-semibold text-sm">{copies}</span>
                        <button onClick={handleIncrementCopies} disabled={copies >= maxCopies} className="p-2 text-zinc-400 hover:text-white disabled:opacity-30"><Plus size={16}/></button>
                      </div>
                    </div>
                  </div>

                  {/* Summary Pane */}
                  <div className="flex-1 flex flex-col justify-between p-6 bg-black/40 rounded-3xl border border-white/10">
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-xs text-zinc-400"><span>Pages / Copy</span><span className="text-white">{basePages}</span></div>
                      <div className="flex justify-between text-xs text-zinc-400"><span>Total Sheets</span><span className="text-cyan-400 font-semibold">{totalPages}</span></div>
                      <div className="pt-3 border-t border-white/10 flex justify-between items-baseline">
                        <span className="text-xs text-zinc-400 font-medium">Total Amount</span>
                        <span className="text-3xl font-bold tracking-tight text-white">₹{currentPrice.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-4">
                      <button onClick={() => handlePayment()} disabled={isPaying || totalPages > 30} className="w-full py-4 rounded-2xl font-semibold text-sm bg-white text-black hover:bg-zinc-200 transition-all shadow-lg flex justify-center items-center gap-2">
                        {isPaying ? <span>Authorizing...</span> : <><span>Pay via UPI / Card</span> <ChevronRight size={16} /></>}
                      </button>
                      <button onClick={resetApp} className="w-full py-2 text-zinc-500 text-xs hover:text-red-400 transition-colors">Cancel Session</button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* PAYMENT VERIFICATION / PRINT STATUS NEEDS REVIEW */}
              {step === 'payment_issue' && (
                <motion.div key="payment_issue" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center w-full my-auto py-6 text-center">
                  <XCircle size={48} className="text-amber-400 mb-4" />
                  <h2 className="text-xl font-semibold tracking-tight mb-2">Payment Needs Review</h2>
                  <p className="text-sm text-zinc-300 mb-4 max-w-md">{paymentIssue.message}</p>
                  {paymentIssue.paymentId && (
                    <p className="text-xs text-zinc-500 mb-3 break-all">
                      Payment reference: <span className="font-mono text-zinc-300">{paymentIssue.paymentId}</span>
                    </p>
                  )}
                  {paymentIssue.orderId && (
                    <p className="text-xs text-zinc-500 mb-6 break-all">
                      Order reference: <span className="font-mono text-zinc-300">{paymentIssue.orderId}</span>
                    </p>
                  )}
                  <p className="text-xs text-zinc-500 mb-6 max-w-md">
                    Please do not pay again until this payment has been checked.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {paymentIssue.orderId && paymentIssue.paymentId && paymentIssue.signature && (
                      <button
                        onClick={retryPaymentConfirmation}
                        disabled={isConfirming}
                        className="px-6 py-3.5 rounded-2xl font-semibold text-xs bg-cyan-400 text-black hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {isConfirming ? "Checking Payment..." : "Check Payment / Print Status"}
                      </button>
                    )}
                    {paymentIssue.orderId && (!paymentIssue.paymentId || !paymentIssue.signature) && (
                      <div className="flex flex-col items-center gap-3">
                        <button
                          onClick={reconcileExistingOrder}
                          disabled={isReconciling || !apiBaseUrl}
                          className="px-6 py-3.5 rounded-2xl font-semibold text-xs bg-cyan-400 text-black hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          {isReconciling ? "Checking Existing Order..." : "Check Existing Order Status"}
                        </button>
                        {resumableOrder && (
                          <button
                            onClick={resumeExistingOrder}
                            disabled={isReconciling || isPaying || !apiBaseUrl}
                            className="px-6 py-3.5 rounded-2xl font-semibold text-xs bg-white text-black hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          >
                            {isReconciling || isPaying ? "Rechecking Existing Order..." : "Resume Payment for This Order"}
                          </button>
                        )}
                        <p className="text-xs text-amber-300 max-w-md">
                          This checks the existing Razorpay order only. It will not create another order or trigger printing during status checking. Payment can resume only if the server confirms this same order is eligible.
                        </p>
                      </div>
                    )}
                    {!paymentIssue.orderId && !paymentIssue.paymentId && !paymentIssue.signature && (
                      <button onClick={resetApp} className="px-6 py-3.5 rounded-2xl font-semibold text-xs bg-white/10 text-white hover:bg-white/20 transition-all">
                        Return to Start
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* STEP 4: SUCCESS & RATING */}
              {step === 'success' && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center w-full my-auto py-4">
                  <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400 mb-4 shadow-lg">
                    <Check size={28} />
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight mb-1">Payment Confirmed</h2>
                  <p className="text-xs text-zinc-400 mb-6 text-center">Payment verified by the server. Your print job was accepted for submission.</p>

                  {/* Rating Component */}
                  {!isReviewSubmitted ? (
                    <div className="w-full max-w-sm bg-black/40 border border-white/10 rounded-3xl p-5 mb-6 flex flex-col items-center transition-all">
                      <h4 className="text-sm font-medium mb-3 text-zinc-200">Rate your experience</h4>
                      <div className="flex gap-3 mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button 
                            key={star} 
                            onMouseEnter={() => setHoveredStar(star)}
                            onMouseLeave={() => setHoveredStar(0)}
                            onClick={() => setRating(star)}
                            className="focus:outline-none transition-transform hover:scale-125"
                          >
                            <Star 
                              size={28} 
                              className={`${(hoveredStar || rating) >= star ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'text-zinc-700'} transition-all duration-300`} 
                            />
                          </button>
                        ))}
                      </div>

                      {/* Expandable Review Text Area */}
                      <AnimatePresence>
                        {rating > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0, marginTop: 0 }} 
                            animate={{ opacity: 1, height: "auto", marginTop: 16 }} 
                            exit={{ opacity: 0, height: 0 }}
                            className="w-full flex flex-col gap-3 overflow-hidden"
                          >
                            <textarea 
                              placeholder="Tell us what you loved or what we can improve..."
                              value={reviewText}
                              onChange={(e) => setReviewText(e.target.value)}
                              className="w-full bg-black/50 border border-white/15 rounded-xl p-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400/50 resize-none h-20"
                            />
                            <button onClick={handleReviewSubmit} className="w-full py-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold hover:bg-cyan-500/30 transition-all">
                              Submit Feedback
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm bg-black/40 border border-white/10 rounded-3xl p-5 mb-6 flex flex-col items-center text-center">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-3">
                        <Star size={20} className="text-amber-400 fill-amber-400" />
                      </div>
                      <h4 className="text-sm font-medium text-white mb-1">Thank you!</h4>
                      <p className="text-xs text-zinc-400">Your feedback helps us refine the Arkout experience.</p>
                    </motion.div>
                  )}

                  <button onClick={resetApp} className="px-8 py-3.5 rounded-2xl font-semibold text-xs bg-white text-black hover:bg-zinc-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                    Print Another Document
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}
