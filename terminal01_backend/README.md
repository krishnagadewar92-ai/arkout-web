# Terminal 01 secure backend (staged)

This backend is a staged replacement for the legacy Terminal 01 API. It must not be installed over the live API until the separate-port test and a coordinated frontend/tunnel cutover are complete.

## Runtime assumptions

- Existing Terminal 01 directory: `/home/robovyu/printpod_local`
- Existing database: `revenue_log.db` (must be backed up before deployment)
- Existing upload directory: `local_uploads` (must be preserved)
- Existing printer queue is accessed through the `lp` command.
- Existing `.env` must remain private and contain Terminal 01's own `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
- The staged application listens on port 5002 by default; the current production API remains on port 5001.

## Dependencies

The host must have Flask, flask-cors, python-dotenv, razorpay, PyPDF2, Pillow, pillow-heif, and the existing CUPS command-line tools installed. Do not copy credentials into Git.

## Frontend configuration

The Terminal 01 page reads `NEXT_PUBLIC_TERMINAL_01_API_URL`. Configure this only for a dedicated staging hostname that routes to port 5002. Do not point the production hostname at port 5002 until the test checklist passes.

## Security and operational notes

- PIN values are not written to logs.
- PIN verification issues a short-lived bearer session token.
- Uploads, order creation, payment confirmation, state changes and abort are session-bound.
- Prices are calculated on the server: B&W ₹1.50/page, standard colour ₹7/page, borderless colour ₹10/page.
- The backend limits packages to 60 physical pages including copies.
- Razorpay signature, payment/order association, amount and captured status are verified before print submission.
- A paid job that fails during CUPS submission is marked `print_error` and requires operator review. Do not automatically retry it: an earlier file in a multi-file package may already have entered the CUPS queue.
- The existing `transactions` table is preserved; the new `t01_*` tables are additive.

## Required pre-cutover tests

1. Start this service on port 5002 without stopping the existing port-5001 API.
2. Confirm PIN rotation and that logs never reveal the PIN.
3. Verify invalid PINs and missing/expired bearer tokens are rejected.
4. Upload valid PDF/image files; verify ownership and page count.
5. Verify 61 pages are rejected and 60 pages are accepted.
6. Verify copies cannot exceed 60 physical pages.
7. Create a test Razorpay order and verify server-side amount calculation.
8. Verify bad signatures, wrong order IDs, wrong amounts and uncaptured payments cannot print.
9. Run a controlled paid print test on the actual Terminal 01 printer.
10. Verify duplicate confirmation does not enqueue a second print.
11. Confirm admin telemetry and kiosk state integrations still work.
12. Only after all checks, plan the tunnel and frontend cutover. Keep Terminal 02 and production website untouched.

This source is not production-ready solely by virtue of being committed. Complete the tests above before switching traffic.
