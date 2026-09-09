# Handover follow-ups — 2026-09-07

## Active checkpoint — 2026-09-09

Standing edit/deploy authorization continues. **Frontend v2026.09.09.7 / Heroku 2085 / 7de7708587984d234b2d13c865b326b787b705ae is LIVE.** Actual successful release and running slug verified 2026-09-09T15:41:56.7768281Z; five changed raw assets and their built assets match approved bytes. Banner/sticker pages and shared home/catalog references verified, plus five public regression pages and five staff gates. Exact-source CI **34370064451** passed all four jobs on **3462512138c1dc3601d29e335c5ca2c7fa82e032**, including the actual money/calculator and full mocked CSS browser steps. No real business writes or notifications during review.

**117 of 225 application pages reviewed and live; 108 pending.** Another 79 tracked HTML sources are excluded (12 archive, 14 email, 50 fixtures/templates, 3 retired). All 26 training pages are complete. Generated document and external content owners remain a separate unfinished track. Whole-app cleanup is not complete. Backend unchanged: v2026.09.08.1 / Heroku1130 / d06aee3e4d25c5e1410241ea8007cdc8339aa3fa.

### Current work

**Nine reviewed pages are integrated on primary develop for candidate v2026.09.09.10:** request-a-quote; digitizing, monogram and purchasing; SanMar vendor/invoices/credits; announcement create/manage. Eight old stylesheet owners retired.126 reviewed locally/99pending; live remains117/108 until rollout. Full combined gates, exact-source CI and verified deployment remain. Earlier .8/.9 plans are superseded.

Full-suite follow-ups: public suggestion positioning, persistent banner mock boundaries, readable age-warning color and explicit fixed/paused test clocks.24 repeated age/poll cases and nine menu/warning cases passed. Hosted pages passed20 focused browser/187 units with five complete reference PDFs258nodes; intake14 focused browser/199units and four reference PDFs74nodes. Original business controllers and provider IDs preserved. External app interiors remain separate unfinished work.

Isolated worktree on codex/hosted-staff-tools is saved at56265125dd0fcb3c430ed3ee3a63621f2e3f5f64; its reviewed work is integrated. Continue next compatible staff-tool family while release gates run, using a new isolated branch. No real business writes or notifications.

### Verification and resume evidence

Instant release: 218 unit suites / 5,205 passed / four existing skips; 88 DOM, 4 accessibility unit, 84 quote parity; 422 mocked browser cases (10.4 minutes), 16 remaining browser (4.3 minutes), three optional screenshot skips, all five live calculator surfaces. Build, lint, types, 299 CSS files, boot200 and production audit zero. Route lock remains485 registrations in24 modules.

Artifacts: C:\Users\erik\.codex\visualizations\2026\09\07\01a07d90-9a4c-7e70-9e4e-c196377b7c6b. Authoritative instant-storefront-{source-record,source-ci,release-record,local-gates,heroku-verification,live-verification}.json; intake-reviewed-source/owned-files/css-measurement/runtime-inventory and intake-focused/unit-focused/paper-review evidence. Isolated node_modules is a junction to primary; never recursively delete through it. No .env copied. Do not rerun one-shot installers/register/commit/release helpers. After an uncertain Heroku push, inspect the actual running slug before retrying.

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


## Manual family ready for exact-source CI — 2026-09-08

Full local release checks passed: 207 unit suites / 5,054 tests (four pre-existing skips), 88 DOM, four a11y unit, 84 quote parity, 192 mocked browser cases and 16 remaining browser cases (three optional screenshot skips), including all five live calculator comparisons. Build/lint/types, 293-file CSS scope and HTTP boot probe pass; 485 registrations/24 modules remain unchanged. All 14 final manual browser cases are included. The updated legacy navigation guard validates 44 real links/targets and native top control; no protection was removed.

Final reviewed PDFs: customer-service 54 pages, biography 2, manual 63, schedule 34; 2,910 selected content blocks present. Summary headings stay with following content, and the roster table has compact, readable paper columns. Source and fixture guards preserve original prose/media/fields/employee/scenario data. Family CSS: 67625 → 32489 UTF-8 bytes (52% less; existing shared foundations and network transfer are separate). .14 remains live until this source passes CI and is deployed. Candidate outcome: 56 live / 169 pending, four training pages left. Use push-pricing-heroku-once.ps1 with the exact release SHA for the next Heroku push; a transport failure requires checking actual release status before retrying.

## Webstore release checks complete — 2026-09-09

Twelve public webstore guides integrated. The interrupted browser run was resumed from unchanged f916e43c118906bcf7c66faf899f74a2bea95871; it is not counted as a pass. Completed release checks:212 unit suites/5,122 passed/four existing skips;88 DOM,4 accessibility unit,84 quote parity;290 mocked browser (486.5s),16 remaining browser and three optional screenshot skips;all five live calculator surfaces,build/lint/types/295 CSS/HTTP boot.485 routes/24 modules unchanged. Twenty-five webstore browser cases and773 paper content blocks retained. Candidate v2026.09.08.20 was reserved before midnight; all36 new stylesheet/controller references already carry that version. Exact-source CI and actual deployment still pending. Live count remains72/225,153 pending until verified rollout. Next15 brand guides are under review in the isolated codex/brand-guide-family worktree.

## Brand guide release checks complete — 2026-09-09

Fifteen brand guides integrated and tested at2ac3c56bf26bd50fecf4fd28043267b4c0939fb3. Completed release checks:213 unit suites/5152 passed/four existing skips;88 DOM,4 accessibility unit,84 quote parity;321 mocked browser (444.6s),16 remaining browser and three optional screenshot skips;all five calculator surfaces,build/lint/types/296 CSS/HTTP boot.485 routes/24 modules unchanged.31 focused brand browser cases and1261 paper blocks retained. Candidatev2026.09.09.1; all60 new stylesheet/controller references already versioned. Exact-source CI and actual deployment pending. Live84/225;141 pending until verified rollout. Next five staff references are IN PROGRESS in the isolated worktree: first layout, shared print contract and service warning/retry changes implemented; focused content/browser review remains. They are not part of this release.

## Staff reference release checks complete — 2026-09-09

Five staff references integrated and tested at3432538f676b06ce8cc8cd3c6cc10d15eb6ae8f1. Completed:214 unit suites/5162 passed/four existing skips;88 DOM,4 accessibility unit,84 quote parity;342 mocked browser (464.9s),16 remaining browser and3 optional screenshot skips;all5 live calculator surfaces,build/lint/types/297 CSS/HTTP boot.485 routes/24 modules unchanged.21 focused family browser cases and805 checked paper blocks retained. Candidatev2026.09.09.2,24 changed/shared references versioned. Exact-source CI and actual deployment pending. Live remains99/225,126 pending. Next isolated codex/entry-status-family has first-pass six sign-in/confirmation layouts; not reviewed or part of this release.

## Entry/status release checks complete — 2026-09-09

Six sign-in/confirmation pages integrated and tested atf343ce6fa4d28e047bc78922c2009b3f3099727b. Completed:215 unit suites/5177 passed/four existing skips;88 DOM,4 accessibility unit,84 quote parity;372 mocked browser (491.99999999999994s),16 remaining browser and3 optional screenshot skips;all5 live calculator surfaces,build/lint/types/297 CSS/HTTP boot.485 routes/24 modules unchanged.30 focused family browser cases and167 checked content blocks in17 one-sheet PDFs retained. Candidatev2026.09.09.3,17 changed/shared references versioned. Exact-source CI and actual deployment pending. Live remains104/225,121 pending. Next isolated codex/catalog-discovery covers brand directory/fall catalog and shared navigation; not reviewed or part of this release.

## Catalog discovery release checks complete — 2026-09-09

Brand directory and Fall catalog tested at 03c7ec49ca597b40ce0346497ec812737954180e. Completed: 216 unit suites/5182 passed/four existing skips; 88 DOM, 4 accessibility unit, 84 quote parity; 389 mocked browser (887.5s), 16 remaining browser and3 optional skips; all5 live calculator surfaces. Build/lint/types/298 CSS/HTTP boot; 485 routes/24 modules unchanged. Shared navigation moved unchanged across17 consumers; all179 curated products,21 brands and10 categories retained. 48 focused browser cases,229 focused units,7 PDFs/292 checked blocks. Candidate v2026.09.09.4, 23 changed references versioned. Exact-source CI and actual deployment pending; live remains110 reviewed/115 pending. Next isolated codex/campaign-storefront contains three golf/safety pages in progress, not part of this release.

## Instant storefront local review complete — 2026-09-09

Candidate v2026.09.09.7.14 focused browser cases passed26.2s (last targeted all50-price/menu checks passed6s);11 original content/controller contracts passed. Four widths/axe, both menu modes, focus/search, all50 sticker prices and seven banner presets, server custom/quantity/finishing totals and recovery, failed/empty/degraded data, invalid form, artwork failure and retained draft retry verified with all writes mocked. Two PDFs retain419 text nodes, all9 paper pages visually reviewed. Three scoped CSS owners lint clean. The saved WIP is now finished and reviewed; full primary release gates, exact-source CI and rollout remain. Live115/110; only verified deployment changes this to117/108. Previous paused/WIP notes are historical.

## Instant storefront release checks complete — v2026.09.09.7

Tested source 7d6cf7bc8124e7d3da8642093c3a9018b98e8897. Build/lint/types,485 routes/24 modules, 218 unit suites/5205 passed/four existing skips,88 DOM,4 accessibility-unit,84 quote parity,422 mocked browser and16 remaining browser cases;3 optional screenshot skips;all5 actual calculator surfaces. 299 CSS lint clean,HTTP boot200,production audit zero.14 focused browser and209 focused unit checks;two PDFs/419 retained text nodes. Only instant branch work and its documented shared asset references ship; saved WIP is now fully reviewed. Candidate v2026.09.09.7; exact-source CI and actual rollout pending. Live115/110 until verification.

## Customer intake local review complete — 2026-09-09

Customer intake: public request-a-quote and three hosted staff forms use canonical tokens/components/Public Sans with one scoped customer-intake.css owner; public fields retain their own arrangement. Digitizing follows Ruth purple, monogram follows shop-floor blue, purchasing follows Bradley slate. Four old CSS owners retired after their final consumers migrated. Seven existing controller sources remain unchanged; complete original prose/fields/images/vendor URLs locked.14 focused browser cases,11 original-contract checks, four widths/zero axe, navigation, blocked embeds and keyboard fallback, public validation/prefill/calendar/lookup/upload/save failures and retained draft retry checked with all business writes and hosted content mocked. Four one-page reference PDFs retain74 checked text nodes; vendor form contents stay external and are not printed from the wrapper. Raw CSS graph grows with shared primitives/scoping; no network byte-reduction claim. Full release gates remain.

Candidate2026.09.09.8. Isolated codex/customer-intake; instant2 .7 exact-source CI still running separately.121 total pages reviewed locally after this four-page batch; live115 remains until actual deployments are verified (.7 becomes117/108, intake .8 becomes121/104). Complete primary release gates/exact-source CI/actual slug and asset verification still required.

## Vendor portal local review complete — 2026-09-09

SanMar vendor portal wrappers: three pages use canonical navigation/typography/Bradley purchasing accents and one scoped sanmar-portal-shared.css owner; the duplicate sanmar-vendor-portal.css is retired. Original invoice/credit Caspio app URLs and wrapper content remain unchanged.12 focused browser cases cover four widths, zero wrapper axe, native focus/keyboard scrolling, mocked login/empty/failure states and complete synthetic report printing; three landscape PDFs retain216 checked nodes. All provider writes blocked. Provider-owned UI styling/data remains explicitly separate; the runtime census now recognizes Jotform alongside Caspio and the external-owner backlog names all six reviewed hosted wrappers. Full release gates remain; no raw-CSS byte reduction claim.

Candidate2026.09.09.9; isolated codex/vendor-portals. Three source contracts passed; broader CSS/runtime guards next.124 total local reviewed pages, but live117/108 remains until intake .8 and then vendor .9 are separately verified. Vendor release would become124/101. Do not merge vendor work into intake .8.

## Hosted staff tools local browser review — 2026-09-09

Hosted staff tools: five Caspio page wrappers (SanMar vendor/invoices/credits, announcement create/manage) share shared_components/css/hosted-workspace.css with canonical tokens/components. Vendor-local and two announcement sheets retired; the earlier duplicate sanmar-vendor-portal.css is also retired. Bradley purchasing and neutral administrative colors follow the ownership rules. Exact provider IDs and both announcement controller sources retained.20 focused browser cases cover four widths/zero wrapper axe, native skip/navigation/scrolling, loading/failure/fallback and synthetic login/form/report/empty boundaries; five landscape reference PDFs retain258 text nodes, every page visually reviewed. Provider-owned controls and data remain separate unfinished work. Seven original source contracts passed; broader inventory guards and full release gates remain. Raw CSS graph grows with scoped shared primitives; no network-byte reduction claim.

This five-page group supersedes the vendor-only .9 plan.126 pages reviewed locally/99pending, but live remains117/108 until intake .8 rollout (121/104), then this verified group would126/99. Never count branch review as live. Candidate2026.09.09.9; full checks/exact-source CI/rollout required.

## Nine-page release consolidation — 2026-09-09

Intake4 and hosted staff tools5 are reviewed and now integrated on primary develop. Candidate v2026.09.09.10 supersedes unreleased .8/.9 references; no empty intermediate release or live-count change. Shared intake/hosted arrangements retire eight CSS files across nine pages; original nine intake/announcement controllers and all provider IDs remain unchanged. Existing Bradley warning text uses semantic readable ink; fixed browser dates cover fresh/warning/critical queue ages. Public lookup anchoring, persistent banner mocks and explicitly paused confirmation polling fix full-suite findings without changing order handling.24 repeated age/poll cases passed; nine repeated menu/warning cases passed; hosted20 browser/187 unit/five PDFs258nodes, intake14 browser/199unit/four reference PDFs74nodes. Full primary combined gates, exact-source CI and actual rollout now required. Expected456 mocked browser plus16 remaining browser/all5 calculator surfaces. Live still.7/2085,117 reviewed/108pending. Only verified nine-page rollout becomes126/99.

## Administrative ownership correction before release — 2026-09-09

Final design-rule audit caught inherited announcement maroon. DESIGN_COLOUR_CODE reserves that accent for AE chrome; both administrative wrappers now use existing neutral ink tokens, while vendor wrappers retain Bradley slate. Controller/provider contracts remain unchanged. Combined full run was intentionally stopped after deterministic checks passed so the final source can be retested; no completed browser gate claimed.

### Staff tools review in progress — 2026-09-09

Three layouts implemented in isolated codex/staff-admin-tools.15 focused browser cases passed after labeling the empty drive summary as a group. Permission writes/removal confirmations and drive rights/portal destinations mocked and retained. Paper review found clipped native table values/placeholder ambiguity and excessive drive whitespace; current-value print mirrors and scoped compact print arrangements under review. No new pages counted reviewed/live yet. Source hash guards reverse only explicit presentation changes.
