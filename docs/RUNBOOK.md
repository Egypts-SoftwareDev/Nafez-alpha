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
- Webhook simulator (TBD): will allow toggling pledge status for demos.

Data files
- `campaigns.json`, `applications.json`, `pledges.json`
- Seeds live in `seeds/`. Use the reset script below to restore.

Reset data
- `node tools/reset-alpha-data.js` to restore JSON files from `seeds/`.

Logs
- Console logs for server; event logs (TBD) will be appended to stdout and rotated by host if needed.

