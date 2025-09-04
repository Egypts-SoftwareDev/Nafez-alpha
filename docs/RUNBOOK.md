Nafez Alpha — Runbook

Start servers
- Alpha: `node server.js` (default port 4000)
- Landing: set `ALPHA_ORIGIN` and `ALPHA_BASE_PATH=/alpha`, then `node server.js`

Important env vars (alpha)
- `PORT`: default 4000
- `LANDING_ORIGIN`: e.g., http://localhost:3000
- `ALPHA_PASSWORD` / `ALPHA_ADMIN_PASSWORD`: simple auth for testing
- `ALPHA_INVITE_CODE`: optional invite gate

Payments (alpha)
- FakeGateway only (simulated). Pledges are recorded in `pledges.json` with status `authorized`.
- Simulator endpoints:
  - `GET /alpha/api/sim/payments/:id/succeed` (or `.../fail`, `.../cancel`)
  - `POST /alpha/api/sim/payments/:id/status` with `{ "status": "succeeded|failed|canceled" }`
  - Auth required (be signed in).

Data files
- `campaigns.json`, `applications.json`, `pledges.json`
- Seeds live in `seeds/`. Use the reset script below to restore.

Reset data
- `node tools/reset-alpha-data.js` to restore JSON files from `seeds/`.

Logs
- Console logs for server; event logs (TBD) will be appended to stdout and rotated by host if needed.

Media upload (images/videos)
- Open Media Manager: `/alpha/admin/media` (sign in first).
- For images: choose a file and click “Upload image”. Max 25 MB; types: PNG, JPG/JPEG, WEBP, GIF. The file is stored under `/alpha/public/uploads/` and the campaign’s `imageUrl` is updated.
- For videos: paste a YouTube/Vimeo URL and click “Save video URL”. The campaign page auto‑embeds it.
- Recommended assets
  - Card/cover image: 1200×675 (16:9), JPG or WEBP, < 500 KB preferred.
  - Logo/secondary image: 800×800 (1:1), PNG with transparent background if needed.
  - Video: YouTube or Vimeo link; keep under 2–3 minutes for alpha.
