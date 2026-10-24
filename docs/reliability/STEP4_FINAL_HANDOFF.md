# Step 4 — Final integration and release handoff

**Status: final review handoff prepared; not a production release.**

## Reverified
- 29 isolated candidate tests pass with temporary SQLite and mocked Flask/Razorpay/CUPS.
- Python compilation passes for the candidate, patch script, test suite, and source-capture helper.
- Step 3 bundle integrity verified against SHA-256.
- Pull request #11 remains draft/open/not merged; the latest Preview build status is READY. Build readiness is not proof of browser or end-to-end payment/printer correctness.
- No production branch, active Pi file, DB, CUPS queue, live payment endpoint, or physical printer was modified.

## Source reconciliation is still a hard deployment gate
The active Raspberry Pi service was previously confirmed to run `/home/arkout/printpod-kiosk/printpod_local/app.py`. This candidate was based on a saved source snapshot and must not overwrite the active file. Run `scripts/capture-active-backend.py` on the Pi to capture exact source bytes, SHA-256, service metadata and route inventory in a restricted directory without restarting service, dumping DB, or reading .env contents. Review the captured source for hard-coded credentials before sharing it. Merge the candidate into a copy of that exact source, preserving later changes; then re-run all tests against the merged result.

## Required staging evidence
1. Isolated SQLite database/uploads, Razorpay TEST credentials, dedicated staging API domain, explicit Preview origin and a mocked print driver. Preview must never point at `api2.arkout.in`.
2. Claim replay and other-browser exclusion; heartbeat refresh/wrong-token rejection; session expiry after Back/close; pending order recovery.
3. Cancel versus checkout-start race in both directions; provider order-creation timeout; pending/authorized/captured payments; lost callback; cancelled order with unexpected provider payment. Ambiguous payment must preserve evidence, alert admin, and never allow duplicate checkout/print.
4. CUPS jam/media-empty/cover-open/offline/device-disconnect, CUPS service stopped, single timeout, repeated failures, stuck job and provider-alert outage. A configured unhealthy queue blocks new orders; no queue map does not mean healthy.
5. Three consecutive healthy probes before automatic recovery; a human/admin-owned maintenance decision never auto-clears; durable alert retries after network returns.
6. Restart/kill service around provider call, payment capture, CUPS acceptance and DB status write. Uncertain prints go to review and are never automatically resubmitted.
7. Verify the actual configured printer queues via `lpstat -p -d`, `lpstat -r`, and `lpstat -a`. Test using a staging/mocked queue first.

## Total Pi outage
A local process cannot send an immediate alert if the Pi is powered off or lacks network. A separate externally hosted watchdog is required for timely Pi-offline alerting; it must use an authenticated heartbeat with timestamp/boot ID, a threshold, recovery notification, and no public control endpoint. That external watchdog is not deployed by this bundle.

## Rollback rules
- Schedule a maintenance window; stop accepting new customer sessions/orders.
- Back up exact active source, service unit/config, SQLite using SQLite's backup API, uploaded-document manifest and any pending job evidence. Protect files with 0700 directories/0600 files; never print secrets.
- Deploy only after exact-source reconciliation and staging sign-off. Run compile/API smoke checks before reopening.
- If the release fails, roll back application/service configuration first. Do not blindly restore an older database: that may erase real payments/jobs. Restore the DB only under an explicit, validated recovery plan.
- Keep maintenance enabled if printer/service status is unknown. Manually reconcile provider payments and CUPS submissions before reopening or reprinting.

## Decision
**Do not merge PR #11 or install the candidate on the live Pi yet.** The exact active-source merge, isolated end-to-end payment staging, real queue verification and authorized hardware fault tests remain incomplete.
