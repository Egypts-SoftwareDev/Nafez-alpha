Nafez Alpha — Execution Plan

Goals
- Launch landing with proper SEO, analytics, and security headers.
- Run a 10-user closed alpha with simulated payments and stable UX.
- Prepare investor-ready demo flows and lightweight metrics.

Scope (Alpha)
- Discovery: feed, search, category chips, featured/backed.
- Campaign details: story, rewards, pledge form, progress bar.
- Pledges: FakeGateway with webhook simulator; My Pledges view and receipts.
- Creator flow: application wizard, drafts, submit, validations.
- Admin: review applications, approve/reject with status notes.
- Data: JSON persistence; nightly reset tooling.
- Observability: server logs and event logging; health endpoint.

Architecture Notes
- Keep current Node HTTP server and JSON storage for alpha.
- Introduce a `PaymentService` interface and a `FakeGateway` adapter; add provider flags.
- Keep staging option for Paymob sandbox behind a feature flag.

Environments
- Local: `C:\nafez-landing` on 3000; `C:\nafez-alpha` on 4000.
- Production (landing): static/CDN or Node behind reverse proxy; set `ALPHA_ORIGIN` and `ALPHA_BASE_PATH`.

Milestones
1) Landing hardening (perf/SEO/headers/legal) — 2–3 days
2) Alpha readiness (FakeGateway + flows + seed + reset + metrics) — 7–10 days
3) Investor polish (golden paths + dashboard + scripts) — 2–3 days

Acceptance Criteria
- Landing: Lighthouse ≥ 90, SEO assets present, analytics events, legal pages live.
- Alpha: 10 pledges succeed via FakeGateway; My Pledges consistent; 3 app submissions; admin approve/reject works; reset restores seeds; logs show key events.

Risks & Mitigations
- Regulatory and PDPL: keep alpha simulated; draft policies; invite-gated testing.
- Payment outages: FakeGateway for alpha; real provider only on staging later.
- Data corruption: versioned seeds; nightly reset; manual reset script.

