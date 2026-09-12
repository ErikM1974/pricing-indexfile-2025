# Pricing Index handover execution — 2026-09

Source: Erik's Claude handover (2026-09-08). Work on develop; one server editor; one section per verified release.

## Checklist
- [x] Read project rules, index and split toolkit; verify no foreign tracked edits.
- [x] Confirm paired proxy gates shipped: proxy v2026.09.07.3 / Heroku 1128, frontend v.25.
- [x] Upgrade Node runtime and CI to 22.x; patch compatible dependencies; full gates and deploy.
- [x] Configure repository CRM_API_SECRET and verify CI executes the money-path and parity specs.
- [x] Review and integrate dependency PRs individually with gates: tooling #38 (replaces #37), Stripe #34, rate-limit #33, csv-parse #32, Puppeteer #31.
- [x] Finish server split: CRM first; order form, quote sync/watchdog, storefront helpers and payments; preserve route table.
- [x] Decompose both order submission handlers into tested stages; add strict Node lint for server/routes/lib.
- [x] Decompose ShipStation submission while finishing the remaining server sections.
- [x] Lower browser warning cap to zero in verified batches.
- [x] Add lessons-length lock and CI/foreign-edit deploy checks.
- [x] Complete housekeeping: empty accidental file, active-file index, TODO markers and superseded memory.
- [ ] Review visual changes with Erik, one surface at a time.

## Current verification

The code-grade implementation is complete. Exact-source CI34193800629 passed onb4e16608; the final release is identified by tagv2026.09.07.38 and its corresponding Heroku build. Server1499lines,23route modules,456registrations (22 infrastructure +434 module registrations),203unit suites/4875passed (4existing skips), DOM88, accessibility4, quote parity84, browser15passed/3optional skips including5calculator surfaces, strict lint0, CSS283clean, types/build/boot passed. CSS design remains an explicitly separate track.

## Baseline
- Frontend develop: 1e0dd7b6, following v2026.09.07.26 (CI fix).
- Current audit: 41 advisories (17 high, 23 moderate, 1 low). Fixing one does not prove every transitive path is clear.
- Existing Actions secret list is empty; current CI skips live-engine specs without CRM_API_SECRET.
- 456 Express registrations; server split must preserve their order and middleware.
- No new pricing paths, customer-data migrations, or visual decisions are implied by dependency work.

## Runtime/security pass
- Node engines and all four CI jobs now select 22.x.
- Resolved Express 4.22.2, Axios 1.20.0, body-parser 1.20.6, path-to-regexp 0.1.13 and qs 6.16.0.
- Compatible updates reduce audit from 41 (17 high) to 25 (6 high / 19 moderate). Remaining chains: Puppeteer/extract-zip, pptxgenjs/image-size, Sentry/OpenTelemetry; major migrations are separate review items.
- CRM_API_SECRET added to the specified GitHub repository after Erik explicitly authorized it. CI live-engine execution verified in runs 34176404389 and 34177871062.

- Local verification passed: route lock456, undefined names0, bootHTTP200, build, lint99 baseline warnings/0errors, CSS283files, typecheck, unit4695passed/4skips, DOM88, axe4, fixture parity84, browser15passed/3opt-in screenshot skips (all five surface parity tests included). Shipped as v2026.09.07.27; CI and Heroku verification recorded below.

- First secret-enabled CI run exercised all live specs and exposed the proxy's existing100requests/minute pricing limit (CAP429; one EMB retry). Pace live preview scenarios and wait for the real60second reset on429; direct tier reads use the same bounded retry. No production limit or pricing assertion changes.

## Verified releases and dependency follow-up
- Runtime/security release v2026.09.07.27 / Heroku2050: Node22.23.2, live SHA f796510c, homepage200, staff relays401. CI34176404389 ran the live-engine specs and passed all jobs after pacing correction.
- CSV PR32 integrates7.0.2; isolated checks cover quoted/BOM/uneven-column input and prototype handling. Full gate results recorded before the merge commit.

- Rate-limit PR33: 8.7.0, all thirteen configurations use limit with existing budgets. Regression tests exercise production login and quote options against Express. Follow-up discovered: global apiLimiter skip checks req.path for /api after Express strips the mount prefix; assess intended general/staff quota before changing that existing behavior. Dedicated login/order/quote limiters remain separately applied.
- Rate-limit verification: 191 unit suites / 4,698 passed, DOM88, accessibility4, fixture parity84, browser15 passed / 3 optional screenshot skips, all five surface parity specs, route456 unchanged, undefined names0 and boot200. A legacy image-quota spelling lock now evaluates limiter options instead.

- Stripe pre-upgrade: verified installed SDK19.3 uses API2025-10-29.clover; pinned that contract in lib/stripe-client.js for all seven constructors. Five tests passed BEFORE upgrading: checkout header/encoding/retrieve/expire, tampered signature rejection, signed samples dispatch, lookup503 retry, deposit duplicate acknowledgment.

- Compatibility review for remaining PRs: Puppeteer25 works with native Node22.23.2 and Chrome152, but Jest must invoke its capture script in a child process. ESLint10 adds 66 errors in 47 files; retain ESLint9 during this dependency release. Direct jsdom30 fails Jest module loading on Node22; Jest30.5/environment30.5 with its nested jsdom26 and jest-axe11 passed the four static accessibility checks. TypeScript7 needs four narrow JSDoc/mixin-type corrections.
- Stripe22 verification: 192 unit suites / 4,703 passed (including all five payment contract checks), DOM88, accessibility4, fixture parity84, browser15 passed / 3 optional screenshot skips with all five surface parity specs. Route456 unchanged, undefined names0, boot200. CSV and limiter CI runs34177227765 and34177871062 passed.

- Dependency release v2026.09.07.28 / Heroku2051 is live at5453a30196e65645d404de5053bd7ea725ac633e; homepage200, contacts/cart401, invalid webhook signature400. CI34178342105 (develop dependency commit) and34178655552 (main release) passed. Both branches synchronized.
- Puppeteer PR31:25.10.0 moved to devDependencies; engines now require Node22.12+ within22.x (verified22.23.2). Real Chrome152 smoke includes navigation, script evaluation, events, storage and PNG capture. Audit21 total:19 moderate /2 high. Native capture --help loads; Jest invokes capture as a child process to avoid its ESM-loader limitation. Missing local capture server now reports25 actual skips; deliberately failed local capture correctly fails Jest. The older full capture harness still needs staff-session support before refreshing signed-off baselines; live calculator parity remains the release gate.
- Puppeteer verification: route456 unchanged, undefined names0, boot200, unit192 suites /4,703 passed, DOM88, accessibility4, fixture parity84, browser15 passed /3 optional screenshot skips including all five live surface parity specs.

- Tooling PR38 replaces closed PR37: Jest30.5.1, TypeScript7.0.2, Stylelint17.15/config40, Playwright1.63 and compatible companions. Node minimum22.13. Two DTF type annotations/prototype alias preserve runtime behavior.
- Held upgrades: ESLint10 adds66 errors/47files; jsdom30 fails the Jest loader; browser axe4.13 flags existing dimmed #dtgArtSetupRate and #dtgArtSetupTotal at1.79/2.03 contrast. Keep axe4.12.1 pinned for this release; fix the inactive-fee appearance with Erik before advancing. Baselines and rule caps unchanged.
- CSS: removed24 redundant declarations across four calculator sheets. Built before/after product screenshots: DTF and archived screen-print0 exact pixels; screen-print second after-shot also0. First after-shot had850 pixels only inside the async back-shirt thumbnail. Screenshot helper now normalizes focus/scroll; accessibility failures retain selectors and detailed evidence.
- Tooling verification: 192 unit suites /4,703 passed, DOM88, accessibility4, fixture parity84, browser15 passed /3 optional screenshots skipped; five live calculator surfaces included. Route456 unchanged, undefined names0, boot200, lint99 and CSS283 clean.

- Final audit cleanup: Sentry10.73.0 replaces8.55.2; installed SDK captures a real Express500 through intercepted transport and scrubs email/phone before delivery. Initialization remains before Express. pptxgenjs4.0.1 is used only by three tests/ui presentation utilities and now lives in devDependencies. Production audit0; complete audit2high remain in pptxgenjs/image-size with no compatible fixed release. CI now hard-gates the production audit and reports the development audit separately.
- Final audit verification: installed-Sentry capture/scrub probe passed; route456/undefined0/boot200; full unit192 suites and4,703 tests, DOM88, accessibility4, fixture parity84, browser15 passed/3 optional skips. Tooling CI34180943167 passed. Verified and removed the handover's untracked empty accidental file.

## CRM extraction approved by Erik
- Dependency release v2026.09.07.29 / Heroku2052 is verified at85d57bf7; both main/develop CI runs34181654283 and34181786791 passed. Production audit0; development-only audit2high.
- User explicitly approved the CRM refactor. routes/crm-proxy.js now owns60 registrations; shared gates/cache/Box helpers stay in server.js. All95 original statements match at the syntax-tree level, route456 unchanged, undefined0, and12 booted anonymous route-family checks return401. See SERVER_SPLIT_2026-09.md section8 for the cut.
- CRM verification: Full gates passed:192 unit suites /4,703 tests (4 established skips), DOM88, accessibility4, fixture parity84, browser15 passed /3 optional screenshot skips, including all five live pricing surfaces. Lint99 existing warnings, CSS283 clean, typecheck and boot200 passed. Route fixture unchanged.

## Remaining server and lint work approved by Erik
- Start with the order-form section, then test and decompose submission stages, finish the remaining server sections, add Node lint coverage and reduce tolerated browser warnings to zero. CSS design remains a separate track.
- First cut: routes/order-form.js, 48 registrations and 2,219 source lines moved unchanged; server.js is 6,525 lines. All 61 statements match in order, route fixture456 unchanged and undefined0. The 3-Day Tees submit handler is already in customer-portal.js and will be covered there.

- Browser gate initially exposed a DTF test race: typing preceded async search-listener binding (trace showed no product request). The harness now waits for the existing end-of-init overlay state. Production handler code remains identical; both DTF save lanes and the full browser suite are rerun. The oldest resolved webstore lesson was archived before recording this finding.

- Order-form extraction v2026.09.07.31 / Heroku2054 verified live at8c18e68a. Source CI34185104267 passed; full local browser rerun15 passed/3optional skips including all5surface parity tests; all other gates remained green.
- Next step: 17 order-form behavior tests passed before and after decomposing its978-line handler into eight lib/order-form stages and a247-line orchestrator. Eleven paid-storefront contract tests cover existing behavior before its extraction. A lessons-cap unit check enforces300 lines. All services are mocked in these tests; no real order/payment writes.

- Paid storefront submission keeps Stripe verification and response handling in customer-portal; its payload now passes through four tested lib/storefront-order stages. The11-case contract suite passed on both versions. Order-form getTaxAccount was an unused legacy helper and is omitted from the extracted stages; active tax-account resolution/cache stays intact.

- Submission stages released as v2026.09.07.32 / Heroku2055 atc2e80441; live version, homepage, authentication and twelve safe order-form probes passed. Source CI34186002926 and release main CI34186329698 passed. Local195unit suites/4732passed, DOM88, accessibility4, parity84 and browser15passed (all5surfaces) before deployment.
- Lint follow-up: all99 tolerated findings resolved across37browser files; two intentional NUL sentinel regexes have explained per-line exceptions. Existing unreachable fake screen-print summary remains disabled (only unreachable tail removed). Enabled legacy rules are errors, warning cap0. Server/routes/lib now share strict Node rules with real Node globals; four unused server bindings removed. Browser no-undef/no-unused-vars remain the separately documented global-audit backlog.
- Calculator prerequisite failures now propagate to the existing visible error UI; thirteen regression cases cover HTTP/transport/invalid data and successful selection. Lessons cap remains enforced. Deployment instructions now require completed-success CI on the exact pushed source SHA at Step5.1, before release merging.
- Lint review also fixed an accidental JavaScript label where the in-stock message needed assignment; three mocked stock-status cases cover available, out-of-stock and low-stock messages.

- Zero-warning verification: strict server/routes/lib and legacy lint0;197unit suites/4748passed (4established skips), DOM88, accessibility4, quote parity84, browser15passed/3optional skips including5calculator surfaces, CSS283clean, typecheck/route456/undefined0/boot200. Lessons238lines. Prior release develop CI34186558351 also passed.

- Zero-warning release v2026.09.07.33 / Heroku2056 is live atec2c9206. Source CI34187145344 passed; homepage/auth/webhook checks and twelve safe probes passed. Main/develop release CI verification remains part of the release follow-through.
- Next quote cut: three route modules, twenty registrations; server.js3939lines. Every279 original top-level statement outside the watchdog matches after relocation. One injected-clock watchdog factory retains shared mutable state and passed an original/extracted behavioral comparison (all notifications mocked). No scheduler or additional notification is introduced.

- Quote-cut verification: route456 unchanged, undefined0 in19modules, strict lint0,198unit suites/4757passed (4skips), DOM88, accessibility4, parity84, browser15passed/3optional skips including5surfaces, CSS283clean, typecheck and boot200. Five safe local health/quote-read/validation probes passed.
- Access-control follow-up discovered by smoke: sync-from-shopworks and bulk/tracking/change-log operations lacked a frontend gate; anonymous nonexistent-quote sync reached the handler and returned404. Stopped bulk probes before execution. Both deployed apps already share CRM_API_SECRET; proxy scheduled jobs and tracking callbacks need to send it before frontend enforcement. No live bulk mutation was tested. Customer quote-link access must be preserved, while staff-only overrides/operations require authentication.

- Quote extraction v2026.09.07.34 / Heroku2057 is live at4758a8f1; source CI34188045298 and main CI34188356984 passed. Proxy caller-auth v2026.09.07.4 / Heroku1129 is live atcc8eda5c; full144suites/1822tests and safe health/auth validation passed; branches synchronized.
- Quote access follow-up: 42 new regression cases cover all eleven operation gates, constant-time credentials, preserved customer/legacy links, blocked work-order substitution and authenticated internal writes. Fixture456 deliberately updated for exactly eleven middleware additions, with no registration reorder. Seven operations require staff; four admit staff or the proxy secret.
- Separate backend dependency backlog observed during its build: Node is unpinned (Heroku selected24.20.0), production audit15 findings (9high/6moderate), unlike the frontend's zero-production-audit gate. The caller-auth patch does not upgrade backend dependencies.
- Access-gate verification:199unit suites/4799passed (4existing skips), DOM88, accessibility4, quote parity84, browser15passed/3optional skips including all5calculator surfaces; build, lint0, types, CSS283 and boot200 passed. Prior release main/develop CI34188356984/34188668244 both passed.

- Access fix v2026.09.07.35 / Heroku2058 is live at1186cde2. Source CI34189595856 passed; full live SHA and six anonymous operation gates verified, with no authenticated business write or alert. Both branches synchronized.
- Storefront helper preview: six cache-owning factories plus composition index and one gallery route. Fifteen contracts pass on original and extracted helpers;43 declarations/206 remaining statements match before the gallery cut; fixture456 unchanged. Full gates follow application.
- Office TLS workaround: retain certificate verification, export the already trusted corporate root to a temporary PEM and use Git OpenSSL with a temporary TLS1.2 min/max config. Per-command settings only; no repository/global TLS weakening. Connection resets still require bounded retries.
- Storefront verification:200unit suites/4814passed (4existing skips), DOM88, accessibility4, quote parity84, browser15passed/3optional skips including all5surfaces; build/lint0/types/CSS283/route456/undefined0/boot200 passed. Access release main/develop CI34190009168/34190129973 both passed.
- Payment follow-up confirmed with mocked APIs: storefront final/failure status writes omit the proxy credential; storefront and samples fulfillment continue after a failed initial Payment Confirmed PUT. Fix these with failure/retry regression coverage during payment extraction; no production payment/order calls were made by the probe.

- Storefront release v2026.09.07.36 / Heroku2059 is live atb24aac66; source CI34190758128 and main CI34191138428 passed; live gallery20styles/0pricing errors.
- Payment extraction applied after original/extracted helper comparison. Seventeen mocked fulfillment cases cover rejected marker writes, HTTP/transport failures after push, authenticated final writes, retry and redelivery; a signed HTTP regression confirms async samples rejection becomes500. Customer-link, HMAC, lookup and deposit-configuration contracts accompany the helper move.
- Payment verification:202unit suites/4853passed (4existing skips), DOM88, accessibility4, quote parity84, browser15passed/3optional skips including5calculator surfaces; build/lint0/types/CSS283/route456/undefined0 passed. v.36 develop CI34191372902 also passed.

- Payment release v2026.09.07.37 / Heroku2060 verified live atd47f5f32; exact-source CI34192330279 passed. Full SHA/homepage/access/invalid-webhook checks passed; branches synchronized.
- Final scoped cut: security/session infrastructure stays in server.js per the handover. Broader infrastructure preparation was rejected by automatic review and remains unapplied. Product/SEO and policy routes moved through dry-run guarded extraction; ShipStation has six tested stages,22 original/extracted cases. Root now1499lines and fixture456 unchanged.
- Housekeeping: ACTIVE_FILES is now a25-line index over14 docs/active-files area files; all1337 annotated row keys retained, including five repaired portal rows. Historical counts are explicitly labeled. Five remaining marker dispositions are tracked in HANDOVER_FOLLOWUPS_2026-09.md. Memory index named no current superseded deletion candidate.

- Final local gates:203unit suites/4875passed (4existing skips), DOM88, accessibility4, quote parity84, browser15passed/3optional skips including5calculator surfaces; build/lint0/types/CSS283/route456/undefined0/boot200 passed. Payment release main/develop CI34192741076/34192896564 both passed.


## Awareness seasonal bundle — local review, September 11, 2026

- [x] Original source checkpoint efa9012a: 6 seasonal source hashes and 10 immutable awareness-browser records; original broken service URL distinguished from diagnostics using the unchanged service.
- [x] Canonical controls and tokens, Public Sans, scoped page stylesheet, external controller, labeled inputs, native product dialog, and compact print layouts replace CDN-generated/inline CSS. The root seasonal route is still served and stays in scope.
- [x] Static text, original product images, destinations and initial field values match. Sixteen real original/current service combinations preserve every successful database and email payload; six retry/ownership cases pass. No pricing or API gate changes.
- [x] Twenty current browser cases pass plus the final contact print check; four widths, zero tested accessibility violations/overflow, keyboard dialog focus, logo image/PDF replacement/removal, missing provider, pending edits and independent session/item/upload/email retries. All 36 screens and ten paper pages across nine PDFs reviewed; contact/review/success now fit one page, product catalog two complete pages.
- [ ] Final integration/whole-application gates and publication remain separate. The public GitHub publication question is unanswered. Live remains v2026.09.11.6 / Heroku 2109, 207/225 reviewed; local candidate 214/225 reviewed, 11 pending. Christmas is next and remains untouched.

Specialty batch gate follow-up: the full 1,532-case sweep on b66a5252 had 1,528 passes, two original-only skips, and two test defects (fixed preview port and expiring notification). Test-only commit 1c7ce288 corrects these without changing application assets; all 31 affected browser checks pass. Original failure logs are retained. Remaining end-to-end/live calculator gate results are tracked in the local artifact record; exact-source CI is still required before deployment.

## Shutdown checkpoint — September 11, 2026

User requested a saved stopping point. Stop here; resume with the Christmas gift-box page. Seasonal awareness is locally reviewed and final verification has passed:311 guards in six suites, zero ESLint warnings, CSS lint clean across275 files,21 actual-server browser cases passed and one original-only case skipped. The final browser run uses the actual Express mounts, verifies all three public asset responses byte-for-byte, and retains410 for both archived paths. No route registrations or access gates changed.

Final awareness assets are calculators/breast-cancer-awareness-bundle.css, calculators/breast-cancer-awareness-bundle.js, and calculators/breast-cancer-bundle-service.js. The HTML keeps its existing archived source and public root alias. The archived original service is unchanged. Six source hashes, one reversible HTML mapping,16 successful original/current service combinations, six retry/concurrency cases,36 reviewed screens and10 reviewed paper pages preserve the original evidence. Final recaptured visual review is recorded in the local resume artifact.

Local candidate:214/225 page surfaces reviewed,11 remaining (Christmas; embroidery-pricing-all; quick-quote index and DTF prototype; webstores calculator; garment designer; five quote builders). Shared runtime/generated-document/provider cleanup and final whole-application/CI/deploy verification are additional work, not extra page credits. Planning estimate:16–24 active working hours including those checks; elapsed time while the laptop is off is excluded.

Previous six-specialty batch: b66a5252 application assets are fully verified with test-only correction1c7ce288. Initial CSS run1528passed/2failed/2original-only skipped; both test defects corrected and31 affected cases passed. Remaining e2e16passed/3optional screenshot skips, all5 calculator parity surfaces passed. Full unit composite5925passed/4 existing skips after cross-project checks. Original failure logs remain, and exact-source CI is still required.

Live remains v2026.09.11.6 / Heroku2109 /75ef8019,207/225 reviewed. Nothing from this local checkpoint has been deployed. Automatic approval review rejected public GitHub publication; explicit publication consent remains pending. Last remote checkpoint bcbe080e; do not push/deploy or reroute the push while unanswered. No environment/credential files copied and no real order, upload, email or printer action performed.

Resume: read the active-css-resume-state.json and CSS_RESUME.md artifact pointers, inspect worktree status, then capture untouched Christmas originals before edits. That page still advertises an expired2025 offer and its old products endpoint is deliberately removed; inspect the existing retirement decisions before altering behavior. Do not invent new dates/offers or reopen endpoints. The two test-only corrections from1c7ce288 are included in this seasonal tree; retain that evidence when integrating branches. Never rerun consumed one-shot migration helpers.
