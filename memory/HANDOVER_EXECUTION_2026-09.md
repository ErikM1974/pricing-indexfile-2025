# Pricing Index handover execution — 2026-09

Source: Erik's Claude handover (2026-09-08). Work on develop; one server editor; one section per verified release.

## Checklist
- [x] Read project rules, index and split toolkit; verify no foreign tracked edits.
- [x] Confirm paired proxy gates shipped: proxy v2026.09.07.3 / Heroku 1128, frontend v.25.
- [x] Upgrade Node runtime and CI to 22.x; patch compatible dependencies; full gates and deploy.
- [x] Configure repository CRM_API_SECRET and verify CI executes the money-path and parity specs.
- [ ] Review and integrate dependency PRs individually with gates: tooling #37, Stripe #34, rate-limit #33, csv-parse #32, Puppeteer #31.
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
- CRM_API_SECRET added to the specified GitHub repository after Erik explicitly authorized it. CI execution proof pending next push.

- Local verification passed: route lock456, undefined names0, bootHTTP200, build, lint99 baseline warnings/0errors, CSS283files, typecheck, unit4695passed/4skips, DOM88, axe4, fixture parity84, browser15passed/3opt-in screenshot skips (all five surface parity tests included). Release target v2026.09.07.27; CI and Heroku verification pending.

- First secret-enabled CI run exercised all live specs and exposed the proxy's existing100requests/minute pricing limit (CAP429; one EMB retry). Pace live preview scenarios and wait for the real60second reset on429; direct tier reads use the same bounded retry. No production limit or pricing assertion changes.

## Verified releases and dependency follow-up
- Runtime/security release v2026.09.07.27 / Heroku2050: Node22.23.2, live SHA f796510c, homepage200, staff relays401. CI34176404389 ran the live-engine specs and passed all jobs after pacing correction.
- CSV PR32 integrates7.0.2; isolated checks cover quoted/BOM/uneven-column input and prototype handling. Full gate results recorded before the merge commit.

- Rate-limit PR33: 8.7.0, all thirteen configurations use limit with existing budgets. Regression tests exercise production login and quote options against Express. Follow-up discovered: global apiLimiter skip checks req.path for /api after Express strips the mount prefix; assess intended general/staff quota before changing that existing behavior. Dedicated login/order/quote limiters remain separately applied.
- Rate-limit verification: 191 unit suites / 4,698 passed, DOM88, accessibility4, fixture parity84, browser15 passed / 3 optional screenshot skips, all five surface parity specs, route456 unchanged, undefined names0 and boot200. A legacy image-quota spelling lock now evaluates limiter options instead.
