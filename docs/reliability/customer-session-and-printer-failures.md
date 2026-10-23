# Arkout customer-session and printer-fault reliability

This document is the release contract for the Terminal 02 Preview work. It is not a claim that Raspberry Pi backend changes have already been installed.

## Non-negotiable deployment boundary

- `NEXT_PUBLIC_DEPLOYMENT_STAGE=production` is required to select production APIs.
- Preview, local development, and missing/misconfigured stage values fail closed.
- A Preview build may use only `NEXT_PUBLIC_PREVIEW_TERMINAL_02_API_URL` and `NEXT_PUBLIC_PREVIEW_API_URL`, and only when those are isolated staging services.
- Do not point Preview at `api.arkout.in` or `api2.arkout.in`.
- Keep Razorpay staging credentials and a test-only database on staging. The staging printer driver must be mocked; it must not submit physical print jobs.

## Required Terminal 02 backend contracts

The frontend now expects these endpoints in an isolated staging backend before end-to-end checkout can be tested.

### `POST /api/mark-payment-started`

Request: `{session_id, session_token, order_id}`

- Validate the current PIN, active session token, order/session binding and current order status.
- Use a SQLite write transaction and persist a one-way `payment_started_at` marker before returning.
- Return `{status: "payment_started"}` only when the marker was safely recorded (repeated calls for the same order may be idempotent).
- Reject cancelled, paid, printing, submitted, or review-only orders.
- The frontend must not open Razorpay/UPI unless this endpoint succeeds.

### `POST /api/cancel-order`

Request: `{session_id, session_token, order_id, razorpay_order_id}`

- Authenticate the order, active claim and token; do not trust client-provided price/status.
- Reconcile the order with Razorpay from the server using private credentials. Fail closed on a timeout, invalid response, captured/authorized payment, or any unresolved payment attempt.
- Cancellation is allowed only when the server can prove no payment attempt is pending/captured and the order has never been handed to checkout. If the order was previously handed to checkout, require explicit safe reconciliation first; never treat a closed modal or browser exit as proof of non-payment.
- Atomically transition only an eligible `creating/created` order to `cancelled`. The cancellation and checkout-start transactions must serialize so exactly one wins.
- Remove the order's uploaded documents and release the claim only after the cancellation transition commits.
- Be idempotent, audit the result, and never submit/print a job from this endpoint.
- A concurrent `/api/mark-payment-started` call must either win (then cancellation fails closed) or lose (then checkout-start fails and payment never opens).
- The payment-confirmation path must reject a cancelled order and must never print twice.

### Exit, browser Back and expiry

- When leaving before any order exists, send the token-bound abort beacon. It is only best-effort; server expiry remains the fallback.
- When leaving with an unpaid order before checkout, send the idempotent cancel request.
- After checkout has ever started, browser close, Back, tab switching, timeout, or a lost response must preserve the order for reconciliation. Do not clear browser recovery state until server status is terminal.
- Browser storage and `sendBeacon` can fail. The server's idle lease must still release abandoned non-payment sessions; ambiguous payment orders must be moved to review without auto-printing or deleting reconciliation evidence.
- Never create a fresh order simply because the customer refreshed, closed checkout, or did not receive a callback. Resume only the same order after backend reconciliation.

## Printer fault / maintenance policy

Initial rollout should fail safe at kiosk level until per-printer routing is enforced by the print-order backend:

- Poll CUPS queue state and IPP `printer-state`, `printer-state-reasons`, and reachability with bounded timeouts.
- Treat explicit jam/media-jam, media-empty, door-open, stopped/disabled, offline, or repeated unreachable responses as unhealthy. A single telemetry timeout is `unknown`, not proof that a printer is healthy.
- Require two consecutive fault observations to avoid transient false alarms; immediately block new order creation if a hard fault is reported. Keep any already-paid/in-flight job record intact.
- On a confirmed fault, persist a reason and timestamp, enable maintenance, and notify the admin. Deduplicate alerts until the fault changes or recovers.
- On recovery, require three consecutive healthy observations and a recovery notification. Clear maintenance automatically only if the maintenance state was created by the automatic printer-health worker; never clear a manual admin maintenance decision.
- Because the existing customer API has a kiosk-level maintenance switch, this first policy may temporarily block the whole kiosk if either mapped printer is faulty. Do not claim per-printer maintenance until order creation and printer selection enforce per-queue health on the Raspberry Pi.
- If the Raspberry Pi, CUPS, network, or monitoring process itself is unavailable, fail closed for new orders and create an admin alert once communications recover. No monitoring system can deliver an immediate notification while the Pi has no power/network; persist the fault locally and send it on recovery.

## Release test matrix

1. Preview with no staging endpoint: zero requests to production API; checkout and upload stay disabled.
2. Normal claim; React Strict Mode remount; duplicate click: one claim and one active token.
3. Invalid/stale PIN; already-claimed PIN; expired session; token mismatch.
4. Browser refresh/back/tab close before upload, after upload, after order creation, during Checkout, while returning from a UPI app, and after payment callback.
5. Cancel before checkout; cancel racing with checkout start; cancel endpoint timeout; duplicate cancellation beacon; server restart during cancellation.
6. Payment created, attempt still pending, failed, authorized, captured, callback lost, confirmation timeout, already submitted, and payment-status API unavailable.
7. Confirmed payment during Pi restart, CUPS accepting a job before process crash, printer jam mid-job, and lost CUPS response. Never auto-reprint an ambiguous job.
8. Printer reachable/unreachable, one missed poll, repeated failures, explicit jam, media empty, door open, CUPS stopped, recovery after one poll, sustained recovery, manual maintenance enabled, and alert channel unavailable.
9. Razorpay staging only; mocked printer submission; verify no production database, API, payment, queue, or physical printer is touched.
10. Confirm the main branch, production aliases, live `/print`, Raspberry Pi service, and production DB remain unchanged during all Preview validation.

## Status

The web branch adds fail-closed API routing, token-safe exit cleanup, draft-session cancellation, a pre-payment cancel control, and a required checkout-start handshake. The new checkout-start and cancel-order endpoints, plus automatic Raspberry Pi printer maintenance/alerts, still need to be implemented and tested on an isolated backend before real payment-flow testing or release.
