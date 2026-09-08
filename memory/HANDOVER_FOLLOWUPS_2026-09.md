# Handover follow-ups — 2026-09-07

## Coordinated transfer authentication LIVE — 2026-09-08

Frontend v2026.09.08.7 / Heroku 2066 / c20d424b142c3e5e275cab891c8ad13e0be22fc2 was deployed FIRST and verified against the actual slug, live /api/version and six changed source assets. Five staff page gates and six safe anonymous GET API boundaries passed; the two public inquiry/reference pages still load. Exact-source CI 34250102640 passed, including the new real-server authentication checks and live-engine pricing parity. Release-branch CI is tracked separately.

Backend v2026.09.08.1 / Heroku 1130 / d06aee3e4d25c5e1410241ea8007cdc8339aa3fa followed only after that verification. Actual slug identity matches, /api/health returns healthy, eight anonymous API checks return 401, and a credentialed image request without a URL reaches the expected 400 validation without contacting a vendor. All 136 backend unit suites / 1,777 tests passed on unchanged implementation code. Both scheduled Supacolor scripts carry the existing secret; no scheduler log lines newer than release were present at the first check, so no natural post-release run is yet claimed. No business writes, syncs, notifications or test records were triggered.

The earlier pause and pending-deployment paragraphs below are history. The boot probe passed unchanged on resume; its earlier timeout was not reproduced and the cause is unconfirmed. Backend dependency/runtime findings remain a separate backlog; this release did not upgrade them. Continue CSS work using the plan in CSS_UNIFICATION_2026-09.md.

## Resumed — 2026-09-08

Erik explicitly resumed from the checkpoint and reiterated permission to continue. The historical pause below is superseded. The unchanged saved frontend passed the actual HTTP boot probe on port 3113 with status 200; the earlier timeout did not recur and its cause is unconfirmed. All previously completed local checks remain recorded below. Continue the exact-source CI/release process, frontend callers FIRST and backend gates second, then the remaining CSS families.

## User-requested stopping point — 2026-09-08

Final boot probe FAILED: the local server did not answer /api/version on port 3113 within 45 seconds. The preceding build/lint/types/unit/DOM/axe/parity/CSS/browser checks passed, but the overall gate exited 1. Startup was not investigated because Erik requested a stop. Diagnose and rerun the boot probe before preparing a release; do not claim all release gates passed.

Erik asked to stop so he can shut down his laptop and resume later today. Work is PAUSED at his request; do not deploy or continue the migration until he resumes. The prior review/fix/deploy and application-wide CSS authorization remains in scope after resuming. This section supersedes older pending-state paragraphs below.

### What is live

- Frontend: v2026.09.08.6, Heroku 2065, full SHA 5d547dca8dae53493a8caa0cb0392ac00f899e11. Exact-source CI 34228004194 and release main/develop CI 34228863592 / 34229080442 succeeded. Live release identity and six source assets were verified. Thirteen pages have shared design owners, including Ruth and Saved Mockups. Their local CSS sources shrank about 58–59%. The application-wide CSS rollout is NOT complete.
- Backend: v2026.09.07.4, Heroku 1129, actual slug SHA cc8eda5c72160e65ec7f38791d4d4a6d0ac045f7. The pending transfer authentication change is NOT deployed on either app. In particular, do not describe the pending Supacolor detail HTML gate as already live.
- Earlier frontend server work is live: server.js reduced from 15,947 to 1,499 lines, strict Node lint and warning cap zero, tested order/payment/ShipStation stages and production dependency audit zero.

### Saved work, ready for release preparation

- Frontend develop: checkpoint commit titled "Save tested transfer relay rollout and resume checkpoint". Includes all 19 owned security files and the resume documentation, explicitly including routes/transfers.js and both new test files. There are 28 staff relays, six migrated same-origin browser controllers, a staff-authenticated 10 MB vision parser before global parsing, and the Supacolor detail HTML gate. The intentional route fixture is 485 registrations / 24 modules / zero undefined names. CI runs the new authentication browser spec. No release version/cache bump has been minted for this source yet.
- Backend develop: implementation commit d5fd4f242f17926da88ac5e881106fb89135466f, "Require authenticated transfer and Supacolor callers", plus resume documentation. Protects transfer-orders, the separate transfer-order-notes route, supacolor-jobs, and the three related Supacolor vision extraction paths. Both scheduler scripts send the existing secret and fail before requests when it is absent. Leave the preexisting untracked .agents/ and AGENTS.md alone.
- Existing CRM_API_SECRET values match across the frontend, proxy and proxy scheduler configuration. Values were neither displayed nor changed. Vendor session/ownership and secret forwarding are covered; public customer mockup mode makes no staff transfer request. No live business writes, syncs, recovery operations, notifications, emails or test records were triggered.

### Verification at the pause

- Frontend full release gate: 207 unit suites / 4,961 passing tests (four existing skips), 88 DOM tests, four axe unit tests, 84 fixture-parity cases, and 66 browser tests (three optional screenshot skips), including all five calculator surfaces. Build, JavaScript lint, types, route-table and undefined-name checks passed; CSS lint passed on 286 files. The final local boot-probe outcome is recorded in the companion checkpoint JSON in the artifact directory below.
- Focused coverage: 46 relay/vendor unit checks and 20 browser checks passed, with real-server staff HTML/API boundaries, vendor ownership, public customer rendering, large screenshot payloads, binary forwarding, malformed input and upstream failures. Old caller tests were updated to the same-origin contract; the subsequent full unit run passed.
- Backend: all 136 unit suites / 1,777 tests passed, including 48 focused auth/vision checks. Integration suites that create production records were deliberately not run.
- Full local gate label: transfer-relays-ready. Logs were copied to the durable artifact directory below. No new deployment was started for this stopping point.

### Resume in this order

1. Read this section, CSS_UNIFICATION_2026-09.md, and the backend memory/PROXY_REVIEW_FIXES_2026_09_07.md. Inspect both develop branches, working trees and remote freshness; preserve any new work from other assistants. Check the companion checkpoint JSON for exact saved commit IDs and the boot outcome. Recreate any missing temporary helpers from durable artifacts or repository instructions.
2. Finish frontend release preparation: use the next unused release version, bump changed browser asset references, retain the new files and the route fixture, push develop and require CI on that exact source. Local full gates already passed except any boot outcome explicitly noted in the JSON; rerun checks if source changes or a concern warrants it. Follow the repository deployment skill and verify all required parity/CI jobs actually ran.
3. DEPLOY FRONTEND FIRST and verify release status, actual slug/full SHA, source bytes, anonymous staff HTML/API denials, and public pages. Then update develop and verify release-branch CI. The backend must not be deployed before these callers are live.
4. Only then deploy the backend gates and authenticated scheduler scripts together. Recheck its deployment prerequisites, verify actual release/slug SHA and /api/health, and use safe anonymous GET probes. Never invoke live full sync or alert/notification endpoints to test. Existing scheduled-job logs can be checked without triggering a run.
5. Record both live releases and resume the CSS migration: Steve, AE, Art Request Detail and Mockup Detail, followed by remaining staff, customer, calculator, builder and document families. Preserve navigation, pricing, approval, recovery and billing behavior; mock all writes, uploads, Box shared-link creation and notifications in browser checks. Do not declare the whole application finished at thirteen pages.

### Durable pointers and separate backlog

- Frontend repo: C:/Users/erik/OneDrive - Northwest Custom Apparel/2025/Pricing Index File 2025
- Backend repo: C:/Users/erik/OneDrive - Northwest Custom Apparel/2025/caspio-pricing-proxy
- Artifacts and copied logs: C:/Users/erik/.codex/visualizations/2026/09/07/01a07d90-9a4c-7e70-9e4e-c196377b7c6b. Start with pause-checkpoint-2026-09-08.json; art-live-verification.json records the live CSS release.
- Prepared but NOT run: commit-transfer-frontend-source.cjs and verify-transfer-frontend-live.cjs. The source helper can still prepare a cache-bump commit after this checkpoint, but inspect it and current ownership first. Frontend/backend release preparation helpers have not yet been created. Do not rerun older integration or art-release mutation helpers.
- Node 22 runtime and full-gate/Git helpers were under the Windows TEMP directory. The artifacts preserve copies for resume; temporary files may need restoring after restart. Use corporate certificate handling, never disable TLS verification, and never change global safe.directory to work around the sandbox identity.
- Separate open items: extract-mockup-info authentication boundary; backend runtime/dependency backlog (15 audit findings: nine high, six moderate); remaining browser-global audit and CSS families. The frontend lessons file is around 254 lines: archive resolved material before adding more, keep its 300-line lock and the auto-memory 180-line limit.

The approved code-grade work is separate from new product behavior and CSS design. These local tickets give each remaining marker an explicit disposition. No external issue, message or alert was sent.

| Ticket | State | Source | Work and acceptance |
|---|---|---|---|
| SHIP-01 | Planned feature | `lib/shipstation/prepare.js` configured-carrier marker | Replace the existing Stamps.com allowlist only after verifying the account's carrier endpoint and agreeing how carrier removals/outages should behave. Cache the authoritative list, preserve explicit staff routing choices and test cache expiry, removal and upstream failure. The current USPS-only routing is preserved by 22 submission contracts. |
| QUOTE-01 | Requires schema and concurrency design | `routes/public-quotes.js` view-tracking marker | Provision or verify the quote view fields, define what counts as a view, and use an atomic increment/event record rather than the commented read-modify-write example. Tracking failure must never break a customer quote read or disclose it. The feature remains disabled. |
| DOC-01 | Editorial follow-up | `shared_components/js/embroidery-quote-pricing.js` item-type marker | Clarify the old garment-path comment alongside the dedicated `calculateCapProductPrice` flow. Any future change in the API's item-type pricing contract needs real fixture/surface parity; no pricing behavior was changed for this marker audit. |
| HIST-01 | Resolved; historical quotation | `routes/ai-chat.js` former-auth marker | The marker quotes the old unauthenticated state to explain its removal. The current forwarders are gated; this is not an outstanding auth task. Keep the incident context. |
| HIST-02 | Resolved; historical quotation | `calculators/safety-stripe-calculator.js` former-template marker | The marker describes the removed placeholder template that caused silent failures. It is incident history, not a live placeholder implementation. |

Scope checked: tracked JavaScript outside tests, tooling, archives and vendored/minified files, plus the new ShipStation files. Five markers remain in this scope; the original handover's eight was an earlier snapshot. No unclassified TODO/FIXME/HACK marker was found in that scope.

Other explicitly separate work:

- CSS design: the next phase is now mapped in [CSS_UNIFICATION_2026-09.md](CSS_UNIFICATION_2026-09.md), including the audit, shared staff/customer concept, three recommended design decisions and family migration gates. Production migration remains open.
- Browser global-variable audit: `no-undef` and `no-unused-vars` remain disabled in the legacy browser scope. All enabled rules are errors with a zero-warning budget; server/routes/lib use the strict Node scope.
- Frontend development audit: two high findings remain in the presentation-tooling dependency chain; the production audit is zero and CI enforces it.
- Backend dependency/runtime backlog observed during the caller-auth release: Node was unpinned and the production audit reported 15 findings (9 high, 6 moderate). This is separate from the frontend dependency upgrades and is not cleared by the caller-auth patch.
- Memory cleanup: `memory/INDEX.md` did not label a currently indexed file as superseded. No documentation was deleted based on age alone. Its existing deliberate retention notes remain authoritative.

- Transfer/Supacolor caller boundary confirmed by read-only source audit (2026-09-08): the proxy mounts have no earlier authentication. Protect transfer-orders, the separate transfer-order-notes write, and supacolor-jobs only after same-origin staff relays/callers and both authenticated cron scripts are ready. Supacolor Job Detail also needs the existing staff HTML gate. Existing vendor-session/ownership relays already send the secret; public customer mockup mode does not call transfer APIs. Three related vision extraction routes need a separate caller check and matching staff relays/gates. No anonymous business-data probes, writes, notifications or syncs were used. Prioritize this follow-through after the Ruth/Saved Mockups release.

Transfer/Supacolor implementation checkpoint (2026-09-08): frontend now has 28 staff relays in routes/transfers.js, the authenticated 10 MB vision parser before global parsing, six same-origin browser callers and the Supacolor detail HTML gate. The route fixture is updated to 485 registrations / 24 modules in the pending source change. Forty-six mocked relay/vendor unit checks and 20 browser checks pass, including real-server anonymous denials, signed-staff HTML access and customer mockup rendering with no staff transfer fetch. CI explicitly runs the new authentication browser spec. Full frontend release gates remain pending; backend d5fd4f242f17926da88ac5e881106fb89135466f has 1,777 passing unit tests and is held until the caller release is live. Existing production credentials match; no secret values or production business writes were used.
