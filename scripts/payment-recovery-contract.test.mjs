import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [source, apiConfig, lifecycleHook, adminSource] = await Promise.all([
  readFile(new URL("../app/print/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/api-config.ts", import.meta.url), "utf8"),
  readFile(new URL("../hooks/useTerminalSession.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
]);

test("frontend does not submit print jobs through the legacy direct-print endpoint", () => {
  assert.doesNotMatch(source, /\/api\/trigger-print/);
  assert.match(source, /\/api\/confirm-payment/);
});

test("create-order request is session-bound and sends the uploaded manifest/config", () => {
  assert.match(source, /session_id: pin,[\s\S]*session_token: sessionToken,[\s\S]*filenames: uploadedFilenames,[\s\S]*config: \{ colorMode, sides, margin, copies \}/);
});

test("duplicate create-order response is moved into recovery instead of opening checkout", () => {
  assert.match(source, /orderData\.status === "existing_order_requires_reconciliation"/);
  assert.match(source, /persistPendingOrderRecovery\(orderData\.order_id, pin, sessionToken, apiBaseUrl\)/);
  assert.match(source, /setStep\("payment_issue"\)/);
});

test("payment confirmation includes order, payment, and signature fields", () => {
  assert.match(source, /\/api\/confirm-payment[\s\S]*razorpay_order_id: initialIssue\.orderId,[\s\S]*razorpay_payment_id: initialIssue\.paymentId,[\s\S]*razorpay_signature: initialIssue\.signature/);
});

test("order-only recovery calls payment-status with session credentials", () => {
  assert.match(source, /\/api\/payment-status[\s\S]*razorpay_order_id: paymentIssue\.orderId,[\s\S]*session_id: pin,[\s\S]*session_token: sessionToken/);
});

test("resume is offered only when the server authorizes the same existing order", () => {
  assert.match(source, /data\.status === "awaiting_payment"[\s\S]*data\.can_resume_same_order === true[\s\S]*data\.razorpay_order_id === paymentIssue\.orderId[\s\S]*Number\.isSafeInteger\(Number\(data\.amount\)\)[\s\S]*data\.currency === "INR"/);
  assert.match(source, /existingOrder\.id !== paymentIssue\.orderId/);
  assert.match(source, /Resume Payment for This Order/);
});

test("resume rechecks server status and opens Razorpay with the existing order object", () => {
  const start = source.indexOf("const resumeExistingOrder = async () => {");
  const end = source.indexOf("const handleReviewSubmit = async () => {", start);
  assert.notEqual(start, -1, "resumeExistingOrder handler must exist");
  assert.notEqual(end, -1, "resumeExistingOrder handler terminator must exist");
  const body = source.slice(start, end);
  assert.match(body, /\/api\/payment-status/);
  assert.match(body, /data\.can_resume_same_order === true/);
  assert.match(body, /await handlePayment\(order\)/);
  assert.equal(body.includes('fetch(`${apiBaseUrl}/api/create-order`'), false);
});

test("only explicit server-submitted statuses display successful payment/print completion", () => {
  assert.match(source, /\["submitted", "already_submitted"\]\.includes\(confirmation\.status\)/);
  assert.match(source, /res\.ok && data\.status === "submitted"/);
});

test("ambiguous outcomes persist recovery details and warn against paying again", () => {
  assert.match(source, /Do not pay again/);
  assert.match(source, /persistPendingPaymentRecovery\(issue, pin, sessionToken, apiBaseUrl\)/);
  assert.match(source, /persistPendingOrderRecovery\(order\.id, pin, sessionToken, apiBaseUrl\)/);
});


test("preview builds use explicit non-production endpoints and fail closed if not configured", () => {
  assert.match(apiConfig, /NEXT_PUBLIC_DEPLOYMENT_STAGE === "preview"/);
  assert.match(apiConfig, /NEXT_PUBLIC_PREVIEW_API_URL/);
  assert.match(apiConfig, /NEXT_PUBLIC_PREVIEW_TERMINAL_02_API_URL/);
  assert.match(apiConfig, /NEXT_PUBLIC_PREVIEW_KIOSK_API_URL/);
  assert.match(apiConfig, /if \(!expectedUrl \|\| !candidateUrl \|\| candidateUrl !== expectedUrl\) return ""/);
  assert.match(source, /const targetUrl = getTerminalApiBaseUrl\(pinToVerify\)/);
  assert.match(source, /if \(!targetUrl\)[\s\S]*Checkout is disabled for safety/);
});

test("session cleanup and admin controls never fall back to live endpoints in preview", () => {
  assert.match(lifecycleHook, /getTerminalApiBaseUrl\(sessionId\)/);
  assert.match(lifecycleHook, /if \(!apiUrl\) return/);
  assert.match(adminSource, /const API_BASE = getAdminApiBaseUrl\(\)/);
  assert.ok((adminSource.match(/if \(!API_BASE\)/g) || []).length >= 4);
});
