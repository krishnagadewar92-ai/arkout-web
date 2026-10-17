import { test, expect } from "@playwright/test";

const API_ORIGIN = "https://api-staging.invalid";
const ORDER_ID = "order_mock_recovery_123";
const SESSION_ID = "1234";
const SESSION_TOKEN = "mock-session-token-0123456789abcdef0123456789abcdef";

const eligibleResponse = {
  status: "awaiting_payment",
  local_status: "created",
  payment_status: "not_captured",
  razorpay_order_id: ORDER_ID,
  amount: 150,
  currency: "INR",
  provider_statuses: [],
  can_resume_same_order: true,
  message: "No captured or unresolved payment attempt was found. You may resume checkout for this same order.",
};

async function openRecoveryPage(page, paymentStatusResponse, confirmResponses = null, storedApiUrl = API_ORIGIN, storedPayment = null) {
  const calls = { paymentStatus: 0, createOrder: 0, confirmPayment: 0, confirmPayloads: [], triggerPrint: 0 };

  await page.addInitScript(({ orderId, sessionId, sessionToken, apiUrl, payment }) => {
    if (payment) {
      sessionStorage.setItem("arkout_pending_payment", JSON.stringify({
        ...payment,
        sessionId,
        sessionToken,
        apiUrl,
        createdAt: Date.now(),
      }));
    } else {
      sessionStorage.setItem("arkout_pending_order", JSON.stringify({
        orderId,
        sessionId,
        sessionToken,
        apiUrl,
        createdAt: Date.now(),
      }));
    }
  }, {
    orderId: ORDER_ID,
    sessionId: SESSION_ID,
    sessionToken: SESSION_TOKEN,
    apiUrl: storedApiUrl,
    payment: storedPayment,
  });

  await page.route("https://api-staging.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const origin = request.headers().origin || "http://127.0.0.1:3000";
    const corsHeaders = {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-allow-credentials": "true",
    };

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (url.pathname === "/api/payment-status") {
      calls.paymentStatus += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify(paymentStatusResponse),
      });
      return;
    }
    if (url.pathname === "/api/confirm-payment") {
      calls.confirmPayment += 1;
      calls.confirmPayloads.push(request.postDataJSON());
      const configuredResponse = Array.isArray(confirmResponses) && confirmResponses.length > 0
        ? confirmResponses[Math.min(calls.confirmPayment - 1, confirmResponses.length - 1)]
        : { httpStatus: 200, body: { status: "submitted", order_id: ORDER_ID, job_ids: ["mock-job-1"] } };
      await route.fulfill({
        status: configuredResponse.httpStatus,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify(configuredResponse.body),
      });
      return;
    }
    if (url.pathname === "/api/create-order") {
      calls.createOrder += 1;
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify({
          status: "existing_order_requires_reconciliation",
          order_id: ORDER_ID,
          error: "Mock guard: do not create another order",
        }),
      });
      return;
    }
    if (url.pathname === "/api/trigger-print") {
      calls.triggerPrint += 1;
      await route.fulfill({ status: 410, contentType: "application/json", headers: corsHeaders, body: "{}" });
      return;
    }
    if (url.pathname === "/api/set-state" || url.pathname === "/api/abort") {
      await route.fulfill({ status: 200, contentType: "application/json", headers: corsHeaders, body: '{"status":"ok"}' });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify({ error: "Unexpected mocked API route" }),
    });
  });

  await page.route("https://checkout.razorpay.com/v1/checkout.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        window.Razorpay = class {
          constructor(options) {
            window.__arkoutRazorpayOptions = options;
            window.__arkoutRazorpayHandlers = {};
            window.__arkoutRazorpayOpenCount = 0;
          }
          on(name, callback) {
            window.__arkoutRazorpayHandlers[name] = callback;
          }
          open() {
            window.__arkoutRazorpayOpenCount += 1;
          }
        };
      `,
    });
  });

  await page.goto("http://127.0.0.1:3000/print");
  await expect(page.getByRole("heading", { name: "Payment Needs Review" })).toBeVisible();
  return calls;
}

test("eligible recovery resumes the same existing order, then mock confirmation succeeds once", async ({ page }) => {
  const calls = await openRecoveryPage(page, eligibleResponse);

  await page.getByRole("button", { name: "Check Existing Order Status" }).click();
  const resumeButton = page.getByRole("button", { name: "Resume Payment for This Order" });
  await expect(resumeButton).toBeVisible();

  await resumeButton.click();
  await expect.poll(() => page.evaluate(() => window.__arkoutRazorpayOpenCount)).toBe(1);
  const options = await page.evaluate(() => ({
    orderId: window.__arkoutRazorpayOptions.order_id,
    amount: window.__arkoutRazorpayOptions.amount,
    currency: window.__arkoutRazorpayOptions.currency,
  }));
  expect(options).toEqual({ orderId: ORDER_ID, amount: 150, currency: "INR" });
  expect(calls.paymentStatus).toBe(2); // eligibility check, then immediate pre-checkout recheck
  expect(calls.createOrder).toBe(0);
  expect(calls.triggerPrint).toBe(0);

  await page.evaluate(async () => {
    await window.__arkoutRazorpayOptions.handler({
      razorpay_order_id: "order_mock_recovery_123",
      razorpay_payment_id: "pay_mock_success_123",
      razorpay_signature: "mock-signature-for-test-only",
    });
  });
  await expect(page.getByRole("heading", { name: "Payment Confirmed" })).toBeVisible();
  expect(calls.confirmPayment).toBe(1);
  expect(calls.createOrder).toBe(0);
  expect(calls.triggerPrint).toBe(0);
});

test("an unresolved or captured-payment review response never offers resume", async ({ page }) => {
  const reviewResponse = {
    status: "payment_review",
    local_status: "payment_review",
    payment_status: "captured",
    razorpay_order_id: ORDER_ID,
    razorpay_payment_id: "pay_captured_needs_review",
    amount: 150,
    currency: "INR",
    can_resume_same_order: false,
    message: "A captured payment was found and recorded for review. No print was submitted. Do not pay again; contact support.",
  };
  const calls = await openRecoveryPage(page, reviewResponse);
  await page.getByRole("button", { name: "Check Existing Order Status" }).click();
  await expect(page.getByText(/No print was submitted|contact support/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume Payment for This Order" })).toHaveCount(0);
  expect(calls.createOrder).toBe(0);
  expect(calls.triggerPrint).toBe(0);
});

test("an already-submitted order goes to success without opening checkout again", async ({ page }) => {
  const submittedResponse = {
    status: "submitted",
    local_status: "submitted",
    payment_status: "captured",
    razorpay_order_id: ORDER_ID,
    razorpay_payment_id: "pay_already_submitted",
    job_ids: ["mock-job-1"],
    message: "This order is already submitted. It will not be printed again.",
  };
  const calls = await openRecoveryPage(page, submittedResponse);
  await page.getByRole("button", { name: "Check Existing Order Status" }).click();
  await expect(page.getByRole("heading", { name: "Payment Confirmed" })).toBeVisible();
  expect(calls.paymentStatus).toBe(1);
  expect(calls.createOrder).toBe(0);
  expect(calls.triggerPrint).toBe(0);
});


test("temporary confirmation failure retries the same payment reference without creating another order", async ({ page }) => {
  const confirmationResponses = [
    { httpStatus: 503, body: { error: "Payment status temporarily unavailable. Do not pay again." } },
    { httpStatus: 200, body: { status: "submitted", order_id: ORDER_ID, job_ids: ["mock-job-1"] } },
  ];
  const calls = await openRecoveryPage(page, eligibleResponse, confirmationResponses);

  await page.getByRole("button", { name: "Check Existing Order Status" }).click();
  await page.getByRole("button", { name: "Resume Payment for This Order" }).click();
  await expect.poll(() => page.evaluate(() => window.__arkoutRazorpayOpenCount)).toBe(1);

  await page.evaluate(async () => {
    await window.__arkoutRazorpayOptions.handler({
      razorpay_order_id: "order_mock_recovery_123",
      razorpay_payment_id: "pay_mock_retry_456",
      razorpay_signature: "mock-signature-for-test-only",
    });
  });
  await expect(page.getByRole("heading", { name: "Payment Needs Review" })).toBeVisible();
  await page.getByRole("button", { name: "Check Payment / Print Status" }).click();
  await expect(page.getByRole("heading", { name: "Payment Confirmed" })).toBeVisible();

  expect(calls.confirmPayment).toBe(2);
  expect(calls.confirmPayloads).toEqual([
    {
      razorpay_order_id: "order_mock_recovery_123",
      razorpay_payment_id: "pay_mock_retry_456",
      razorpay_signature: "mock-signature-for-test-only",
    },
    {
      razorpay_order_id: "order_mock_recovery_123",
      razorpay_payment_id: "pay_mock_retry_456",
      razorpay_signature: "mock-signature-for-test-only",
    },
  ]);
  expect(calls.createOrder).toBe(0);
  expect(calls.triggerPrint).toBe(0);
});


test("preview refuses a stored live API URL and makes no live request", async ({ page }) => {
  let liveApiRequestCount = 0;
  await page.route("https://api.arkout.in/**", async (route) => {
    liveApiRequestCount += 1;
    await route.abort();
  });

  const calls = await openRecoveryPage(page, eligibleResponse, null, "https://api.arkout.in");
  await expect(page.getByText(/not configured to contact the saved payment endpoint/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Check Existing Order Status" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Resume Payment for This Order" })).toHaveCount(0);

  expect(calls.paymentStatus).toBe(0);
  expect(calls.confirmPayment).toBe(0);
  expect(calls.createOrder).toBe(0);
  expect(calls.triggerPrint).toBe(0);
  expect(liveApiRequestCount).toBe(0);
});


test("preview disables payment-confirmation retry for a stale live recovery URL", async ({ page }) => {
  let liveApiRequestCount = 0;
  await page.route("https://api.arkout.in/**", async (route) => {
    liveApiRequestCount += 1;
    await route.abort();
  });

  const storedPayment = {
    message: "A previous payment response needs verification.",
    paymentId: "pay_stale_live_123",
    orderId: ORDER_ID,
    signature: "stale-signature-for-test-only",
  };
  const calls = await openRecoveryPage(
    page,
    eligibleResponse,
    null,
    "https://api.arkout.in",
    storedPayment,
  );

  await expect(page.getByText(/not configured to contact the saved payment endpoint/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Check Payment / Print Status" })).toBeDisabled();

  expect(calls.paymentStatus).toBe(0);
  expect(calls.confirmPayment).toBe(0);
  expect(calls.createOrder).toBe(0);
  expect(calls.triggerPrint).toBe(0);
  expect(liveApiRequestCount).toBe(0);
});
