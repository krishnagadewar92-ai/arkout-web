# Arkout Advertisement Portal setup

The /adv route uses a separate marketing login and a dedicated Vercel Blob store. It must remain separate from customer documents, revenue records, printer controls, payments, and kiosk maintenance controls.

## Vercel environment variables

Set these in the existing arkout-web Vercel project:

- ADV_PORTAL_USERNAME: dedicated marketing account username.
- ADV_PORTAL_PASSWORD: unique, high-entropy password; do not reuse an admin or email password.
- ADV_SESSION_SECRET: randomly generated secret with at least 32 characters.
- BLOB_READ_WRITE_TOKEN: read/write token for a dedicated Vercel Blob store used only for marketing assets.

Do not place secret values in Git, frontend variables (anything prefixed with NEXT_PUBLIC_), chat, or screenshots. Use a separate Blob store for marketing assets. Redeploy after configuring environment variables.

## Portal behaviour

- /adv uses an HttpOnly, Secure-in-production, SameSite=Strict signed session cookie.
- Login and state-changing endpoints require same-origin requests.
- Upload tokens are generated only for an authenticated same-origin session and restricted to the arkout-ads/ path, supported media MIME type, and 50 MB maximum per file.
- Uploads go directly from the browser to Vercel Blob, avoiding Vercel Functions' request-body limit for video files.
- Supported uploads: JPG/JPEG, PNG, WebP, GIF, AVIF, HEIC/HEIF, MP4, M4V, MOV, and WebM. HEIC/HEIF images are converted to JPEG in the upload browser when its native decoder supports them.
- The public /api/adv/playlist endpoint is read-only and returns only supported assets inside the arkout-ads/ prefix, with media type and upload timestamp.
- The kiosk consumer should show the playlist full-screen only while the kiosk is idle, fit portrait media to the vertical screen without cropping, hold images briefly, play videos to completion, and skip videos that the browser cannot decode.
- For the vertically mounted kiosk, upload portrait media in a 9:16 ratio; 1080 × 1920 is recommended. Best cross-device video compatibility is MP4 containing H.264 video and AAC audio. MOV files are accepted, but iPhone HEVC/H.265 videos may not play on the Raspberry Pi's Chromium build; export those as Most Compatible/MP4 when needed.
- Never connect this portal to customer-uploaded print documents, revenue data, payment routes, printer/CUPS controls, or maintenance controls.

## Operational notes

- Images typically remain on screen for about 10 seconds; videos advance when playback ends.
- The marketing portal and its Blob storage are independent of the production Flask API. Kiosk UI changes should be tested on a confirmed idle kiosk with maintenance disabled before refreshing the browser.
- Keep backups of the local kiosk HTML before changing playback code. No production backend restart is required for kiosk HTML changes.
