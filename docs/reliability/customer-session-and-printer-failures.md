# Arkout customer-session and printer-fault reliability

This document is the release contract for the Terminal 02 Preview work. It is not a claim that Raspberry Pi backend changes have already been installed.

## Non-negotiable deployment boundary

- `NEXT_PUBLIC_DEPLOYMENT_STAGE=production` is required to select production APIs.
- Preview, local development, and missing/misconfigured stage values fail closed.
- A Preview build may use only `NEXT_PUBLIC_PREVIEW_TERMINAL_02_API_URL` and `NEXT_PUBLIC_PREVIEW_API_URL`, and only when those are isolated staging services.
- Do not point Preview at `api.arkout.in` or `api2.arkout.in`.
- Keep Razorpay staging credentials and a test-only database on staging. The staging printer driver must be mocked; it must not submit physical print jobs.

## Required Terminal 02 backend contracts

The frontend now expects these endpoints in an isolated staging backend before end-to-end checkout can be tested. The active Raspberry Pi backend has not yet been patched with them.

### `POST /api/mark-payment-started`

Request: `{session_id, session_token, order_id}`

- Validate the current PIN, active session token, order/session binding and current order status.
- Use a SQLite write transaction and persist a one-way `payment_started_at` marker before returning.
- Return `{status: "payment_started"}` only when the marker was safely recorded (repeated calls for the same order may be idempotent).
- Reject cancelled, paid, printing, submitted, or review-only orders.
- The frontend must not open Razorpay/UPI unless this endpoint succeeds.

### `POST /api/recover-order`

Request: `{session_id, session_token}`

- Find the newest token-bound order for the session; never create or print.
- Return `no_order` only when no reservation exists. Return HTTP 202 `order_creation_pending` for a still-running reservation; don't treat it as absent.
- Return the same order ID, amount, currency and authoritative `payment_started` flag when an order exists.
- A response lost after reservation must recover the same order, never cause a second external order.

### `POST /api/authorize-resume`

Request: `{session_id, session_token, order_id}`

- Only issue a high-entropy, short-lived, one-time token after a minimum cooldown (candidate default: 90 seconds) and a fresh Razorpay reconciliation.
- No payment record or only terminal `failed/cancelled` records may be considered for resumption. Any created/pending, authorized, captured, refunded, unknown, malformed or unreachable provider state fails closed.
- Store only the resume-token hash. Bind it to the session/order; expiry defaults to 90 seconds.
- A new resume authorization must not overwrite another still-valid authorization. A consumed token must never be accepted twice.
- The frontend must not reopen checkout on a boolean alone; it needs this token and must send it to `/api/mark-payment-started`.

### `POST /api/cancel-order`

Request: `{session_id, session_token, order_id, razorpay_order_id}`

- Authenticate the order, active claim and token; do not trust client-provided price/status.
- Reconcile the order with Razorpay from the server using private credentials. Fail closed on a timeout, invalid response, captured/authorized payment, or any unresolved payment attempt.
- Cancellation is allowed only when the server can prove no payment attempt is pending/captured and the order has never been handed to checkout. If the order was previously handed to checkout, require explicit safe reconciliation first; never treat a closed modal or browser exit as proof of non-payment.
- Atomically transition only an eligible `creating/created` order to `cancelled`. The cancellation and checkout-start transactions must serialize so exactly one wins.
- Remove the order's uploaded documents and release the claim only after the cancellation transition commits.
- Be idempotent, audit the result, and never submit/print a job from this endpoint.
- A concurrent `/api/mark-payment-started` call must either win (then cancellation fails closed) or lose (then checkout-start fails and payment never opens).
- The payment-confirmation path must reject a cancelled order and must never print twice. `/api/payment-status` must return authoritative `payment_started`; a resumable order must be reopened only after the one-time `/api/authorize-resume` token is issued.
- A `creating` reservation that times out must be reconciled with Razorpay before deletion; if a remote order may exist but its ID was not recorded, quarantine the reservation and alert the admin.

### Exit, browser Back and expiry

- When leaving before any order exists, send token-bound best-effort cleanup. Keepalive requests may be blocked on tab/process termination; server expiry remains the fallback.
- When leaving with an unpaid order before checkout, send the idempotent cancel request.
- After checkout has ever started, browser close, Back, tab switching, timeout, or a lost response must preserve the order for reconciliation. Do not clear browser recovery state until server status is terminal.
- Browser storage, pagehide, keepalive fetch and network beacons can fail. They are a convenience, not the source of truth. The server's idle lease must still release abandoned non-payment sessions.
- A session abort must preserve any `creating` order and any order whose payment-start marker exists. On an expired session, release the customer claim/PIN but retain the payment order, immutable manifest and print payload in quarantine for reconciliation. Do not delete evidence because the browser disappeared.
- The current Raspberry Pi expiry/rotation cleanup must be reviewed: it presently deletes `uploaded_documents` during stale-session cleanup after moving unresolved `creating/created` orders to `payment_review`. That can lose the documents needed if payment was captured but the callback was lost. This is a release blocker: keep evidence for payment-ambiguous orders until a verified terminal resolution/refund-retention policy allows removal.
- The seven-day upload-folder cleanup must exclude files referenced by active, submitted, printing or payment-review orders. Evidence retention must be explicit, then scheduled cleanup can remove files only after the order is safely terminal.
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

## Status (2026-10-23)

The web branch adds fail-closed API routing, token-safe exit cleanup, persistent claim-replay recovery, visible-session heartbeats, draft-session cancellation, a pre-payment cancel control, order recovery, and a required checkout-start handshake. Vercel reports the Preview branch deployment as READY at the latest commit, but full browser/E2E verification has not been completed through the connected deployment inspector.

An **isolated backend candidate** and a dependency-stubbed test harness are being prepared outside this website repository. The candidate is based on a saved `app.py.payment-security-merged-review-v3_4_6.py` snapshot from 17 October 2026, not a byte-for-byte capture of the active Raspberry Pi `/home/arkout/printpod-kiosk/printpod_local/app.py` that was confirmed on 23 October. The candidate's 20 unit tests pass against temporary SQLite with mocked Flask/Razorpay/CUPS dependencies; this does not establish real CORS, provider, CUPS, systemd, or physical-printer correctness.

**Do not install the candidate by overwriting the live file.** Re-read and back up the actual active source, rebase/reconcile the patch against it, and run all tests on the exact merged candidate in an isolated staging environment. The following are still release blockers until deployed and verified on staging: `/api/mark-payment-started`, `/api/recover-order`, `/api/authorize-resume`, `/api/cancel-order`, `/api/session-heartbeat`, durable critical-payment alerts, and automatic Raspberry Pi printer maintenance/notifications.

Production branch, current live `/print`, live Raspberry Pi service/database, Razorpay production flow, CUPS queues and physical printers have not been changed by these candidate edits. Keep this PR in draft and do not merge or promote it until the staging and hardware release matrix above passes.
