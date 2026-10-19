# Arkout Advertisement Portal setup

The `/adv` route is intentionally unavailable until server-side secrets and storage are configured.

## Vercel environment variables

Set these in the existing `arkout-web` Vercel project for Preview first, and Production only after reviewing the preview:

- `ADV_PORTAL_USERNAME`: dedicated marketing account username.
- `ADV_PORTAL_PASSWORD`: unique, high-entropy password; do not reuse an admin or email password.
- `ADV_SESSION_SECRET`: randomly generated secret with at least 32 characters.
- `BLOB_READ_WRITE_TOKEN`: read/write token for a dedicated Vercel Blob store used only for marketing assets.

Do not place secret values in Git, frontend variables (anything prefixed with `NEXT_PUBLIC_`), chat, or screenshots. Use a separate Blob store for marketing assets. Redeploy after configuring environment variables.

## Portal behaviour

- `/adv` uses an HttpOnly, Secure-in-production, SameSite=Strict signed session cookie.
- Login and state-changing endpoints require same-origin requests.
- Uploads accept JPEG, PNG, and WebP images up to 3 MB; SVG and arbitrary files are rejected.
- Upload, listing, and deletion use only the `arkout-ads/` prefix in the dedicated Blob store.
- `/api/adv/playlist` is a public, read-only list of approved-by-uploaded assets for a kiosk client. Uploading an image makes it available in this feed; deleting removes it from the feed.
- The existing kiosk backend has not yet been configured to consume this feed. This pull request does not modify the live API, kiosk, CUPS, payments, revenue database, or Cloudflare routing.
- Do not attach `www.arkout.in` to a replacement deployment until the preview and environment settings are validated.
