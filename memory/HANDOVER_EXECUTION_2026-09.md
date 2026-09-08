# Pricing Index handover execution — 2026-09

Source: Erik's Claude handover (2026-09-08). Work on develop; one server editor; one section per verified release.

## Checklist
- [x] Read project rules, index and split toolkit; verify no foreign tracked edits.
- [x] Confirm paired proxy gates shipped: proxy v2026.09.07.3 / Heroku 1128, frontend v.25.
- [x] Upgrade Node runtime and CI to 22.x; patch compatible dependencies; full gates and deploy.
- [x] Configure repository CRM_API_SECRET and verify CI executes the money-path and parity specs.
- [x] Review and integrate dependency PRs individually with gates: tooling #38 (replaces #37), Stripe #34, rate-limit #33, csv-parse #32, Puppeteer #31.
- [ ] Finish server split: CRM first; order form, quote sync/watchdog, storefront helpers and payments; preserve route table.
- [ ] Extract and test long order/push handlers; add Node ESLint scope once split completes.
- [ ] Lower browser warning cap to zero in verified batches.
- [ ] Add lessons-length lock and CI/foreign-edit deploy checks.
- [ ] Complete housekeeping: empty accidental file, active-file index, TODO markers and superseded memory.
- [ ] Review visual changes with Erik, one surface at a time.

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
