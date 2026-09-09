# Handover follow-ups — 2026-09-07

## Active checkpoint — 2026-09-08

Erik resumed; standing edit/deploy authorization continues. **Frontend v2026.09.08.14 / Heroku 2073 is LIVE**, full SHA **7c65286d02f59e4576d44d67e9bea08069d554fe**, actual slug verified 2026-09-09T02:45:33.3156097Z. Exact-source CI **34303626869** passed all four jobs including live money/calculator parity on eac07064ad2952da43563c0ad89482928b02dffe. Seven deployed runtime assets match committed bytes; four reference HTML shells and two public form regression shells return 200; four staff shells remain protected. No business writes or notifications. The Git transport dropped during the first build, so its automatic retry built the same SHA twice (2072/2073); 2073 is the verified running release.

**52 reviewed application pages live; 173 pending**, from **225 application/served-archive HTML sources**. Another 79 tracked HTML sources are excluded. Eighteen of 26 tracked training pages are reviewed, **eight training pages remain**. Earlier notes counted an ignored local training/api-test-runner.html: it is not tracked or deployed and is excluded from this count; leave it alone. The application denominator remains 225. Generated document/style owners remain separate unfinished work.

### Next batch and plan

- [x] Deploy and verify four reference pages: caps, quick tips, shipping and purchasing (.14).
- [x] Capture four-width baselines and map the remaining tracked training sources.
- [ ] Unify customer-service, get-to-know-erik, sales-coordinator-manual and sales-coordinator-training-schedule with shared reading/navigation/print patterns. Local implementation is complete; validation and release are in progress. See the manual-family checkpoint below.
- [ ] Preserve all original lessons, staff data, figures, field values and media destinations. Repair manual/day hash navigation and selected links, biography keyboard disclosure/print restoration, and missing-birthday/calendar handling in the manual roster. Give tables keyboard-accessible overflow and remove inline presentation styles.
- [ ] Review four widths, keyboard/axe, all 44 manual chapters and 12 schedule sections, practice feedback, print content/state restoration, then full release gates and exact-source CI/deploy.
- [ ] Then finish training/index, sales-tax-code-trainer, shopworks-customer-setup and shopworks-customer-setup-enhanced. Continue the other application families after training.

Design: existing Public Sans, white/neutral/forest tokens, shared controls and reading rhythm. Desktop manual contents beside a restrained reading surface; collapsible contents on phones. Retain lesson content and meaningful status semantics. Do not repeat whole-page CSS overrides. Customer-service has three duplicate IDs to disambiguate (dtf/laser/stickers); preserve the first existing anchor. Schedule has conflicting day initialization, manual selected-link code still looks for removed inline handlers, and missing employee birthdays currently break celebrations. These are next-batch findings, not shipped fixes.

### Verification / resume evidence

.14 local gates: 207 unit suites / **5,044 passed** / four existing skips; 88 DOM, four a11y unit, 84 quote parity; **178 mocked browser cases plus 16 remaining cases** (three optional screenshot skips), all five calculator surfaces. Build/lint/types/**292 CSS**/boot pass; 485 registrations / 24 modules unchanged. Sixteen focused reference browser cases and 99 ownership/census checks passed. Reviewed PDFs: caps 3 pages (nine cap cards), tips 3 complete topics, shipping 10, purchasing 9. All **333 selected paper-content blocks** are present. Original prose/figures/fields/media are locked; shared quick-tips JSON unchanged. Unique family CSS source shrank approximately 43%; this is not a network-transfer measurement.

Artifact directory: C:/Users/erik/.codex/visualizations/2026/09/07/01a07d90-9a4c-7e70-9e4e-c196377b7c6b. training-reference-release-record.json, training-reference-source-ci.json, training-reference-heroku-verification.json, training-reference-live-verification.json and training-reference-local-gates.json are authoritative. Track release main/develop CI separately from exact-source CI. Do not rerun historical installers/release helpers. Fresh-check ownership and branches before each release.

Backend remains v2026.09.08.1 / Heroku 1130 / d06aee3e4d25c5e1410241ea8007cdc8339aa3fa; dependency/runtime backlog and natural scheduler verification remain separate work. Frontend production dependency audit is zero.

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

## Current continuation point — v2026.09.08.9

Frontend CSS family is live on Heroku 2067, 0d06c990d1065e8c20a333f96b2f5f7b05a4b15e, after exact-source CI 34263369308. Steve, AE, Art Request Detail and Mockup Detail are the four new pages (17 reviewed pages total). Assets/access gates/customer shells are verified; full local checks pass 4,966 unit and 90 browser tests. Release-branch CI is tracked separately. Backend security remains live v2026.09.08.1 / Heroku 1130. The broad CSS cleanup is still open; do not re-deploy the completed security or art changes.

Next: adopt measured parallel execution for mocked CSS browser checks (74 passed in 156.8 s with three workers), then continue the training-directory family. The original CSS Factor task owns forms/reference work in the separate codex/css-forms worktree; its last inspected tree was clean at c20d424b. Coordinate before merging. Production/source/CI records are in the September 7 artifact directory under art-family-*.json; no pending business writes, OCR, messages or syncs were used for validation.

## First training guides checkpoint — 2026-09-08

The lead follow-up, embroidery order-type and NWCA language guides now use one scoped training document owner locally. Eight browser checks passed, covering four widths, keyboard table scrolling/disclosures, pending/failed/retried clipboard operations and print. The original guides overflowed 390px phones by 300px, 9px and 96px respectively; all now fit 320px and wider. Removed 36 static inline styles and 15 language-print important overrides. Prose, historical pricing examples, IDs and link destinations are unchanged and locked by three content checks. The ownership suite passes 27 tests.

Actual printed PDFs were reviewed. The language reference now fits two readable landscape pages with complete content, replacing the old fixed-height 5–7pt sheet. A two-sheet output guard prevents the blank-page regression discovered during review. training/lead-follow-up-guide.html: 30,698 → 70,432 LF source bytes; training/shopworks-embroidery-order-type.html: 27,575 → 68,465 LF source bytes; training/nwca-language-reference.html: 31,727 → 70,479 LF source bytes. The small pages gain the common component foundation, so these are not claimed as transfer savings. Tokens/components remain unchanged.

Validation speedup c5f25ded632c94d222e18d1c19228e3a20280b43 passed CI 34265865374. Art/AE release main CI 34264415089 and develop CI 34264868532 both passed on live 0d06c990d1065e8c20a333f96b2f5f7b05a4b15e. The former CSS Factor task is now archived; its codex/css-forms worktree was checked read-only and remains clean at c20d424b with no new forms work. No unmerged forms implementation was found.

Next: full local gates using the parallel mocked group and serial live-price group, exact-source CI, then deployment/live checks. Seventeen pages remain verified live; these three bring the reviewed implementation count to twenty only after their rollout. Continue the remaining training guides and lessons afterwards; the whole application is still open.

## Training release gates complete — 2026-09-08

All full gates passed: 207 unit suites / 4,972 tests (four existing skips), 88 DOM, four accessibility unit tests, 84 quote-parity cases, 82 mocked browser cases in 207.9 seconds with three workers, and 16 remaining browser cases with three optional screenshot skips. All five live calculator surfaces passed serially. Lint/types, 291 CSS files, build/boot and the unchanged 485 registrations / 24 modules passed. After the last print-only refinement, all eight training browser checks and 27 ownership checks passed again and CSS lint remained clean. Actual final PDFs were reviewed: lead guide nine pages, embroidery guide two, language reference two; proper paper margins and complete content.

Release review found concurrent committed work fe794c6f8584208d87c0b821ce62b190fa5b49f3: two blank one-page employee PDF forms and one forms-library category icon. Both PDFs were opened/rendered and their unfilled content verified; their source bytes will be checked live. This is separate from the archived CSS task and its untouched worktree. The release will include that committed change with its original changelog attribution; no Caspio rows or business data were changed by this task. Exact final source CI and production rollout remain pending.

## Service training guides checkpoint — 2026-09-08

Art approval, thank-you cards, lead sheets and Google reviews now use the common reading foundation plus one scoped service owner and controller. Four duplicated scripts and two page stylesheets are replaced; handwritten examples and practice fields keep two small unique sheets. All fourteen headings are native keyboard buttons; panels remain readable if the controller fails. Field help is always visible and associated with inputs. Image loading/failure/retry is explicit. Tokens/components and the previous three guides are unchanged. Four original inline declarations are gone; prose, links, IDs and practice values are locked by source contracts.

Twelve focused browser cases passed across 1440/768/390/320, keyboard actions, all sections, tables, image failures/retry, field help/local edits, no-controller reading and print. Final print refinements hide chevrons, repeat table headers and keep instructional images with headings. Actual images loaded successfully for visual review; final PDFs have 2/6/3/3 pages, complete and legible. Full local gates now pass 207 unit suites / 4,980 tests (four existing skips), 88 DOM, four accessibility unit, 84 quote parity, lint/types, 290 CSS files, build and HTTP boot. Full browser suites and exact-source CI/deployment are still pending at this checkpoint. The initial hygiene run used Git's unstaged deleted-file list; explicitly staging the six replacements and three new files fixed the census without weakening its checks.

Current production remains v2026.09.08.10 / Heroku 2068 on d65ccce189c969b8b8baed56d755c7ee6e82b58f, with twenty reviewed pages. Source CI 34269638273, release main CI 34270803675 and develop CI 34271017981 all passed. These four guides bring the reviewed implementation to twenty-four after deployment/live checks. CSS source totals grow on the smaller guides because they now load the common cached foundation; do not describe this as byte savings. The application-wide rollout is open, with remaining training/reference, forms, storefront, calculator/builder and generated document states still to cover. No business writes or notifications were made.

## Service-guide full gates complete — 2026-09-08

All gates passed on the final service-guide source: 207 suites / 4,980 unit tests (four existing skips), 88 DOM, four accessibility unit tests, 84 quote-parity cases and 110 browser tests (three optional screenshot skips). The isolated 94-case group took 183.3 seconds with three workers; sixteen remaining cases and all five calculator surfaces passed serially. CSS lint: 290 files, one fewer because two duplicate sheets became one shared owner. Build, lint/types, route table/undefined checks and HTTP boot are clean. Exact-source CI and rollout follow. The next larger batch has read-only baselines for all seventeen printable forms, including phone overflow and actual print page counts; no forms implementation has started.


### Reference family implemented — 2026-09-08

Four local pages now use shared reference patterns and existing controls/tables. Sixteen focused browser cases pass at 1440/768/390/320: keyboard/touch checklists, original storage keys, save/reset/read failures, protected malformed progress, print/nav/reduced motion, quick-tip search/empty/load/retry and safe rich text. Original HTML prose/figures/fields/media and shared tips JSON are preserved (99 ownership/content cases passed before final formatting; rechecked by full gates next). Quick-tip calendar dates no longer shift backwards in Pacific time; seven-day badges exclude future dates.

Real PDFs reviewed: caps 3 pages (was 7), tips 3 with one full topic per page, shipping 10 (was 11), purchasing 9 (was 10). All 333 selected content blocks occur in the PDFs; cap images, procedure screenshots, complete checklist sections and document hierarchy inspected. Full release gates/source CI/deploy remain pending. These four pages are not yet counted live: .13 remains 48 live / 177 pending. Source/PDF/test artifacts use reference-* in the existing artifact directory.


### Reference family ready for source CI — 2026-09-08

Full local release checks passed: 207 unit suites / 5,044 passed / four existing skips; 88 DOM, four a11y, 84 quote parity; 178 mocked CSS/auth browser cases plus 16 other browser cases (three optional screenshot skips), including all five live calculator comparisons. Build/lint/types/292 CSS/boot pass; 485 registrations / 24 modules. All sixteen family browser cases and 99 ownership/content checks passed. Desktop/phone and PDFs reviewed, 333 selected content blocks preserved; caps 3, tips 3, shipping 10 and purchasing 9 pages. Source CI, release and live verification remain required; production is still .13 / 48 reviewed / 177 pending. .13 main CI 34301559921 and develop CI 34301708124 both passed.

Next training work has eight tracked pages: manuals/schedule/Erik biography (4), ShopWorks customer setup pair plus tax code game (3), Training Center (1). Baselines also captured an ignored local api-test-runner.html that is NOT tracked/deployed; leave it alone and exclude it from migration counts. Initial baselines cover all eight. Verify all chapters/days, hash navigation, keyboard disclosure, stored progress and print states; basic first-load checks do not cover these large manuals. Training census: 26 tracked pages, 18 reviewed after this release, eight pending; the earlier thirteen/nine remaining-family totals included that ignored local artifact. Overall 225/52/173 application counts are unchanged. The biography writeEmbed error occurred with external scripts blocked and is not yet established as a live-app defect. Keep business lesson data unchanged during CSS migration.


## Manual-family implementation checkpoint — 2026-09-08

Four next pages implemented locally: customer-service, get-to-know-erik, sales-coordinator-manual, sales-coordinator-training-schedule. Production remains .14 / Heroku 2073 / 7c65286d (52 live, 173 pending). This candidate would make 56 live / 169 pending, leaving four training pages. Shared training-manual.css/js own reading/contents/navigation/print. Old customer-service/bio page scripts are retired and explicitly staged as removals; all create/delete actions registered.

Four-width browser review and 14 family browser cases passed before final paper refinements; all 44 manual chapters and all 12 schedule sections were exercised with axe. 109 ownership/content cases passed. Full local release suite and exact-source CI/deployment are still pending. Original body text/media/fields and employee/scenario data remain locked. PDF review now verifies 2,910 selected content blocks (navigation labels omitted intentionally from paper): customer-service 54 pages, biography 2, manual 64, schedule 33. Generic .card was removed from schedule to eliminate an unwanted blank opening page. Paper has no blank sheets. Latest shared summary page-break refinement and continuous-document scroll marker still need the final broad browser run.

Artifact directory remains the same. manual-family-owned-files.json is the explicit ownership list; training-manual-baseline-record.json records pre-migration content on c9b0d054. manual-paper-review.json reports selected paper text; manual-after-*.pdf and manual-paper-*-*.png contain visual evidence. Do not rerun install-training-manual-family.cjs or register-training-manual-checks.cjs: they are one-shot mutation helpers. Next: finish paper overview, run training-manual-full-gates.ps1, then prepare a version from fresh tags/HTML, commit explicit files including the new browser test, wait exact-source CI and deploy.
