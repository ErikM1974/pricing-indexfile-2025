# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

### Paid-order status writes must succeed before fulfillment (2026-09-07)

Storefront and sample webhooks continued after a rejected Payment Confirmed write; storefront final writes also omitted authentication. Require a successful authenticated marker before pushing. If fulfillment succeeds but the final Processed write fails, acknowledge and alert for bookkeeping without labeling the push failed or repeating it. Exercise HTTP/transport failures and redelivery with mocked APIs, plus signed HTTP dispatch; source-string checks alone missed variable-based URLs. Status markers are not an atomic cross-dyno lock.

### Bonus hero dial + CTA wrap-hole (2026-09-01, ARCHIVED 2026-09-03): variable-width money never lives inside a fixed ring (ring holds the %, dollars beside it); flex-wrap breaks lines on MAX-CONTENT width, not post-shrink width — give the sibling `flex:1 1 0`. Full entry in archive.
### First real custom-tees order: proforma hid data the session already had; ShopWorks dates were UTC days (2026-09-01, ARCHIVED 2026-09-05): a blank pre-import field is usually a READER gap (parse the session's JSON blob columns); every date written to ShopWorks/Caspio is the PACIFIC day (`nowPacificNaiveIso()`); a session stuck in `Payment Confirmed` NEVER self-links — manual `POST sync-from-shopworks` with the WO#. Full entry in archive.
### An audit reported a clean manifest as 26 missing POs (2026-08-26, ARCHIVED 2026-09-02): a check must distinguish "I looked and it isn't there" from "I never looked" and SAY WHICH — refresh the arrival span itself, compare mirror lastSync <= manifest date, and a failed fetch marks the run INCONCLUSIVE, never missing. Full entry in archive.
### curl from git-bash mangled em dashes into U+FFFD (2026-08-25, ARCHIVED 2026-09-01): non-ASCII Caspio writes go through Python `ensure_ascii=True`, never a git-bash curl body; verify stored text with `ascii()` on a re-read. Full entry in archive.
### A customer's real size request was shown to nobody (2026-08-19, ARCHIVED 2026-08-27): render every field you persist — a saved-but-unshown field is data loss with extra steps. Full entry in archive.
### SAM quotes rendered “No items” (2026-08-19, ARCHIVED 2026-08-27): a channel that opts out of a shared fix re-inherits the bug it fixed; SW-snapshot overlay repaints EXISTING rows only. Full entry in archive.

### Staff dashboard full review — 5 UTC/Pacific bugs on ONE page + the error renderer silently no-oping (2026-08-26, ARCHIVED 2026-09-01): calendar-day math never via toISOString()/new Date("YYYY-MM-DD")+local getters (Saved Mockups and recovery dates needed the same fix on 2026-09-08); register the ERROR_AREAS entry in the same commit as showApiError(); clone a deduped fetch Response per caller; derive quote prefixes from config, never a hand list. Full entry in archive.
### Quote data plane locked down — 44 caller files, 2 repos (2026-08-26, ARCHIVED 2026-09-02): a gate you cannot flip without a deploy ships scared — mode-switch by config var (off→log→enforce); migrate by ENDPOINT grep never a base swap; a relay must forward the query string verbatim; postures jest-locked in both repos; stage explicit file lists, never `git add -u`, on a shared checkout. Full entry in archive.
### Staff-dashboard hardening — PII roster, proxy-direct reads, auth embed (2026-08-26, ARCHIVED 2026-09-03): a staff page gate is `.html`-only, so secrets live in `lib/` behind a route (`lib/staff-roster.js` → `GET /api/staff/employees`); identity = `/api/crm-session/me` (returns `role`), never a third-party auth embed; every proxy-direct read from a staff page is relayed same-origin so the quote-plane gate covers it. Full entry in archive.
### /inventorylevels leaked wholesale cost + supplier anonymously (2026-08-27, ARCHIVED 2026-09-03): an anonymous route that must stay open for one public caller gets a field PROJECTION (`INVENTORY_PUBLIC_FIELDS` whitelist), not a gate; jest-lock the projection red-first. Full entry in archive.
### 2-minute proxy outage: the commit shipped half the change, and the boot probe tested the other half (2026-08-27, ARCHIVED 2026-09-05): stage the WHOLE change (a `require` and the file it names land in one commit); the boot probe must exercise the route table, not just `listen`; a 2-minute outage is a half-shipped commit until proven otherwise. Full entry in archive.
### Top Sellers "flickers blank, refresh fixes it" (2026-08-26, ARCHIVED 2026-09-02): "works after refresh" = a cold query behind a response cache — time the UNCACHED path first; variant-heavy `limit=48` pages hydrate 10k rows, so partition STYLE IN chunks in parallel; `?isTopSeller=1` is silently ignored (route wants `true`) — validate the result set before trusting a timing. Full entry in archive.
### Customer portal redesign + reward-dollar accrual (2026-09-01, ARCHIVED 2026-09-05): reward money is never computed silently — every ledger line names its source and the 8 `REWARD` Service_Codes rows ARE the program; never claw back automatically. Full entry in archive.
### Staff dashboard Workspaces — three traps the harness caught (2026-09-03, ARCHIVED 2026-09-06): check `admin` FIRST in any role→default map; `hidden` on the dashboard belongs to nav-access (tabs/folds use classes); a harness driving the REAL controllers finds what structural unit tests cannot; multi-line edits against this repo need `\r\n` and an asserted match count. Full entry in archive.
### Company Numbers review — a date a day early, a refresh that wasn't, a goal nobody could change (2026-09-04, ARCHIVED 2026-09-06): `YYYY-MM-DD` parses as UTC midnight (use `toLocalDate()`); a Refresh button must re-fetch, not re-render; a business constant belongs in a Caspio `Service_Codes` row (`CO-ANNUAL-GOAL`) with a VISIBLE fallback. Full entry in archive.
### Customer login dropped the deep link it was handed (2026-09-05, ARCHIVED 2026-09-06, `v2026.09.05.26`): a login page must carry its `?next=` through every hop (magic-link request → email → callback) and validate it as a same-origin path; test the round trip, not the first page. Full entry in archive.
### JSON-in-attribute broke on the first quote (Names & Numbers delete button, 2026-09-05, ARCHIVED 2026-09-06, `v2026.09.05.17`): never put JSON with quotes/apostrophes in an HTML attribute — pass an index/id and look the record up, or escape with `escapeHtml` on the attribute value. Full entry in archive.
### Customer Portals console said nobody had ever signed in (2026-09-05, ARCHIVED 2026-09-06): a "0" that never moves is a broken reader, not a quiet business — the count read a field the login flow never wrote; assert every counter against a source of truth once. Full entry in archive.
### Whole-dashboard deep-review sweep — the same six bugs kept reappearing (2026-09-05, ARCHIVED 2026-09-06, `.24`→`.75`, 54 pages): UTC "today", `[hidden]` beaten by flex, silent-empty states, hardcoded `* 75` art rates, unversioned assets, inline handlers — each is now a jest lock; a review without a lock is a review that repeats. Full entry in archive.
### Customer-facing sweep — the same rules the staff pages broke, plus three real bugs (2026-09-06, ARCHIVED 2026-09-06, `v2026.09.05.77`→`v2026.09.06.5`): inline `display:none` beats `.hidden=false`; a listener registered after an early return never fires; render colours only after the fallback resolves; 6 scripts had a silent proxy-host fallback → `''` + visible error. Full entry in archive.
### Quote builders: finishing Rule 3 meant teaching the shared delegator four more events (2026-09-06, ARCHIVED 2026-09-07, `v2026.09.06.19`–`.22`): 185 inline change/input/blur/keydown/error handlers → `data-change`/`-input`/`-blur`/`-keydown`/`-enter`/`data-onerror` in the ONE shared delegator (`quote-builder-utils.js`, Rule 8); never add an `sr-only` h1 to the builders (axe baselines fail); gate a top-of-file `window.location` read for window-less tests; catch concatenated icon classes at runtime. Full entry in archive.
### Staff pages, the LIVE pass — what a signed-in runtime walk found that 80 static locks had not (2026-09-06, ARCHIVED 2026-09-07, `v2026.09.06.26`–`.28`): a page lock must also cover the scripts that render into it (`RENDERERS`); runtime bare-icon counts must exclude `aria-label` icons; a runtime `<style>` on a page that ships none is a Caspio DataPage embed; JS-created controls get their `aria-label` in code; the Mission Control harness drifts with its page (`node scripts/sync-test-harness.js`); the hashed dashboard bundle is versioned. Full entry in archive.
### Rule 6 sweep S3 — 118 scripts still guessed the proxy host, and two unit tests had been hitting the live API (2026-09-06, ARCHIVED 2026-09-07, `v2026.09.06.31`): every proxy URL comes from `APP_CONFIG.API.BASE_URL` with a VISIBLE failure when it is missing; a scripted rewrite must keep the ORIGINAL quote character; `tests/setup.js`'s fetch stub never installs on Node 18+ (native fetch) — stub `global.fetch` per test. Full entry in archive.
### Final census — 69 dead files, a retired page that still got "fixed" twice, and a lock that pinned a version prefix (2026-09-06, ARCHIVED 2026-09-07, `v2026.09.06.33`–`.34`): check linked + mounted + the `server.js` route (410/301) before "fixing" a page; an orphan census matches the PATH, not the basename; never pin a `?v=` prefix in a test. Full entry in archive.
### EmailJS ids in 25 scripts, 118 unlabelled controls, and 12 SEO pages rendering in quirks mode (2026-09-06, ARCHIVED 2026-09-07, `v2026.09.06.36`): EmailJS service/template ids come from `APP_CONFIG`, never a literal; every control gets a label or `aria-label`; a page that starts with a fragment instead of `<!DOCTYPE html>` renders in quirks mode. Full entry in archive.
### 700 console.logs in production, and a basename match that hid four stale root copies (2026-09-06, ARCHIVED 2026-09-07, `v2026.09.06.37`): `console.log` in served scripts is gated behind localhost / `?debug=1` (lock in `repo-hygiene-final`); an orphan census must match the PATH, not the basename. Full entry in archive.
### My own host sweep broke the DTF calculator for four deploys, and only a console read caught it (2026-09-06, ARCHIVED 2026-09-07, `v2026.09.06.40`): a scripted rewrite must preserve the ORIGINAL quote character (a template literal lost its backticks and fetched `${…}` literally; 182 suites stayed green); after any sweep that touches fetch URLs, read the live console and `performance.getEntriesByType('resource')` for `responseStatus >= 400` on the pages that use them. Full entry in archive.
### The screen-print tier buttons promised a fee Caspio no longer charges (2026-09-06, ARCHIVED 2026-09-07, `v2026.09.06.42`): every dollar or range a customer can READ is pricing — render tier strips, clamps and hints from the API tiers, never type them; after any Caspio tier change compare each calculator's labels with `GET /api/pricing-bundle`; a marker-based `cut()` in a refactor script must assert the method count before/after. Full entry in archive.
### Two customer calculators drifted from Caspio's tiers while the engine followed them (2026-09-06, ARCHIVED 2026-09-07, `v2026.09.06.42`–`.43`): a tier label in a template is a price — generate every tier strip from `pricing-bundle`, price sub-minimum quantities through the canonical engine, and after ANY Caspio tier change diff each calculator's buttons against `/api/pricing-bundle?method=X` and its sub-minimum price against Quick Quote. Full entry in archive.
### Erik asked "is pricing the same everywhere?" — two of five customer calculators were not (2026-09-06, ARCHIVED 2026-09-07, `v2026.09.06.44`): every customer-facing price surface is compared against the canonical engine by `npm run test:parity:surfaces` (Playwright, every live tier); a calculator that renders its own tiers drifts the day Caspio changes. Full entry in archive.
### Adding `<main>` to 96 pages found two markup bugs a browser had been hiding (2026-09-06, ARCHIVED 2026-09-07, `v2026.09.06.51`): a landmark sweep is also a markup audit — validate every page after a structural edit; Full entry in archive.
### Every money-path alert had gone to a log nobody reads (2026-09-07, ARCHIVED 2026-09-08, `v2026.09.07.1`): an alert that only lands in a log is not an alert — money-path failures page a person (email + Slack) and the delivery itself is locked; a silent alerting path is the one failure mode nobody notices. Full entry in archive.

### CSS standardization Step 1+3 (2026-09-07, archived): keep token loading and screenshot parity tied to the served page. Full entry in LESSONS_LEARNED_ARCHIVE.md.

### Forms family migration (2026-09-07, archived): verify the served family inventory; formatter fixes can change appearance. Full entry in LESSONS_LEARNED_ARCHIVE.md.

### Training family migration (2026-09-07, archived): retain flags that override inline styles; verify print and page-specific tokens. Full entry in LESSONS_LEARNED_ARCHIVE.md.

### Webstore deployment and token migration (2026-09-07, archived): check each push exit code and remote SHA; avoid token-name collisions; dedupe after prefix fixes. Full entry in LESSONS_LEARNED_ARCHIVE.md.

### Dashboards family (2026-09-07, archived): inspect both staff design systems before replacing their tokens. Full entry in LESSONS_LEARNED_ARCHIVE.md.

### Dashboard/calculator CSS transforms (2026-09-07, archived): parse selectors and values separately, inspect semantic changes and verify generated asset versions. Full entry in LESSONS_LEARNED_ARCHIVE.md.

## CSS tokenizers must recognize their own output (2026-09-07, archived)

Never rewrite a variable declaration into a self-reference; dry-run reruns and check cyclic aliases. Full resolved migration record is in LESSONS_LEARNED_ARCHIVE.md.

## Quote builder stylesheet migration (2026-09-07, archived)

Preserve generated override precedence and exact palette matches; full resolved migration and corporate TLS notes are in LESSONS_LEARNED_ARCHIVE.md.

## 2026-09-07 — `git worktree remove --force` followed a node_modules junction and deleted the real packages

**Problem.** A HEAD worktree at `C:/tmp/pi-before` (for before-screenshots) had the main tree's `node_modules`
JUNCTIONED in so `scripts/build.js` could find esbuild. `git worktree remove --force` deleted the worktree
recursively, followed the junction into the real `node_modules`, removed packages alphabetically (`@asamuzakjp`,
`@babel`, …) and stopped with "Invalid argument". Nothing said so; the next full gate run failed 184 of 188 unit
suites with `Cannot find module '@babel/code-frame'` and e2e/parity could not start.
**Root cause.** Windows junctions look like directories to recursive deletes (git's, and MSYS `rm -rf`);
the link was inside the thing being deleted.
**Solution.** `npm ci` (lockfile reinstall) restored everything in one pass; the gates were re-run green before
the deploy. The junction is now removed FIRST with `cmd /c rmdir <junction>` (which removes only the link),
verified gone, and only then is the directory deleted.
**Prevention.** 🔑 Never delete a directory that contains a junction or symlink to something you keep — remove
the link with `rmdir` (cmd) first and check it is gone. 🔑 Prefer `NODE_PATH=<repo>/node_modules` over a
junction when a scratch tree needs the repo's packages. 🔑 When 184 suites fail at once with "Cannot find
module", suspect the install, not the change — `npm ci` before debugging anything.

## Server split first-cut incident (2026-09-07, archived)

Module moves change scope and relative paths; verify dependency bindings, route order and a real HTTP boot. Full resolved incident and prevention details are in LESSONS_LEARNED_ARCHIVE.md.

## 2026-09-07 — Proxy review: contact and shipping authentication
**Problem:** Customer-directory reads/updates and shipping reads were reachable without credentials.
**Root cause:** Browser callers went directly to the proxy; shipping sync omitted the secret.
**Solution:** Contact lookups now use staff-authenticated same-origin relays; server reads send
withProxySecret(). Legacy cart CRUD is staff-only (the public cart was retired).
**Prevention:** Test anonymous and authenticated calls at both layers. Deploy the app BEFORE
proxy gates. Public forms retain manual entry; directory autocomplete requires staff login.
Regression coverage: tests/unit/proxy-review-relays.test.js. The payroll relay also needs its 40 MB parser BEFORE the global 5 MB parser; moving it only before the forwarder does not work.
Validation after v2026.09.07.24: full unit 4,695 passed / 4 skipped; fixture parity 84 passed; browser E2E 15 passed / 3 opt-in screenshot skips (includes all five calculator-parity checks). Route lock updated to 456 registrations. Commit tests/fixtures/server-route-table.json with the hardening and explicitly add tests/unit/proxy-review-relays.test.js.

## 2026-09-08 — CI was red for nine hours and nobody noticed, because every local gate was green

**Problem.** Every GitHub CI run from 2026-09-07 15:54 through the twenty-two releases that followed failed, on
two assistants' commits alike. Nobody looked, because the deploy loop runs the same suites locally and those were
green every time. Two causes, both environmental: a unit test read a file from the SIBLING repository
(`../caspio-pricing-proxy/src/routes/ae-dashboard.js`), which the runner never checks out; and the Playwright
money-path and calculator-parity specs price through the LIVE proxy, whose reads have required `CRM_API_SECRET`
since the quote-plane lockdown — the repository has no Actions secrets, so every run ended in "engine error".
**Root cause.** Tests that assume the developer machine (a sibling checkout, a secret in the environment) with no
guard, and a CI whose red state had no reader.
**Solution.** The cross-repo assertion skips with a warning when the sibling is absent. The e2e job is split: the
rendered axe ratchet always runs; the live-engine specs run only when `CRM_API_SECRET` is configured as an Actions
secret and are reported as skipped otherwise (the /deploy pre-flight runs them locally with the real secret, so a
skip never means untested).
**Prevention.** 🔑 A test that reads outside the repository or needs a secret must guard for its absence and SAY
it skipped. 🔑 `gh run list -L 5` belongs in the deploy pre-flight: local green is not CI green. 🔑 To switch the
live-engine specs back on in CI, add `CRM_API_SECRET` under Settings → Secrets → Actions.

## 2026-09-08 — Node runtime and dependency audit must match CI

**Problem.** Production and CI selected Node 18 while local checks ran Node 22; 17 high audit findings remained.
**Root cause.** Old lockfile resolutions and exact transitive pins kept vulnerable packages installed.
**Solution.** Select Node 22 in engines and all CI jobs; Express 4.22.2, Axios 1.20.0, compatible audit fixes,
and a qs 6.16 override (Express/body-parser pin an older minor). The repository Actions secret is now configured
with Erik's explicit approval; verify the live-engine step actually runs on the next CI push.
**Prevention.** Audit the resolved tree after updating: a green install is not a clean audit. Preserve CRLF in
these two already-CRLF-tracked package files to avoid hiding the dependency diff. Major upgrades stay separate.

## 2026-09-07 — Major SDK upgrades need contract checks

**Problem:** Rate-limit option spelling broke a text lock; Stripe22 types rejected the intentionally retained API version.
**Root cause:** The quota test matched source text, and Stripe generated types describe only its newest API contract.
**Solution:** Evaluate limiter options semantically; preserve 2025-10-29.clover through one shared Stripe factory,
with the documented narrow type exception. HTTP tests verify quotas, IPv6 grouping, API headers and signed webhook dispatch.
**Prevention:** Run contract tests before and after each major upgrade; a dependency PR passing CI alone is insufficient.

## 2026-09-07 — Tooling upgrades and visual verification

**Problem:** New major tooling exposed type inference gaps, redundant CSS and two existing dimmed DTG art-fee contrast findings.
**Solution:** Jest30/TypeScript7/Stylelint17 pass with narrow type corrections and 24 redundant declarations removed.
Keep ESLint9, jsdom26 and browser axe4.12.1 until their measured migration issues are addressed; do not raise ratchets.
**Prevention:** Screenshots must build the changed assets and normalize focus/scroll before capture. A second after-shot
proved the remaining 850-pixel screen-print difference was an async thumbnail; the second comparison was exactly zero.
Native Node22.23 runs Puppeteer25; invoke its capture CLI outside Jest, and report unavailable baselines as actual skips.

## 2026-09-07 — DTF browser checks must await initialization

**Problem:** The money-path test typed before the search listener existed; its trace contained no product lookup.
**Root cause:** The search box is visible before async pricing initialization binds listeners.
**Solution:** In the browser test, await the existing end-of-init inline overlay state before typing. Production code and money assertions are unchanged.
**Prevention:** Wait for functional readiness, not merely static HTML visibility; retain both blocked-save and successful-save coverage.

## Calculator prerequisite failures must stop pricing (2026-09-07)
- Problem: color/size failures were swallowed; the next pricing stage could hide the error or reuse another style's size data.
- Root cause: empty error branches and catch blocks inside prerequisite loaders.
- Solution: propagate errors to the product loader's existing error UI; clear size data before requesting it.
- Prevention: calculator-api-errors.test.js covers HTTP, transport, malformed/empty responses and successful API data.

## A JavaScript label silently dropped an inventory message (2026-09-07)
- Problem/root cause: `message:` was a label, not assignment, so in-stock samples had no message.
- Solution: assign the message; no-unused-labels is now an error.
- Prevention: test returned stock status and customer message together for available, low-stock and unavailable inventory.

## Quote operations need caller and quote scope checks (2026-09-07)
- Problem/root cause: bulk sync, tracking writes and change-log operations trusted their expected caller without authenticating it.
- Solution: deploy credentials in proxy jobs/callbacks first; gate app operations with staff/shared-secret checks and authenticate loopback writes.
- Customer refresh/vendor reads preserve existing share-token/legacy links, but resolve only that quote's work order; overrides require staff/trusted sync. Compare token byte lengths before timingSafeEqual.
- Prevention: quote-sync-access.test.js exercises actual route chains, rejected callers, customer scope and internal forwarding; never probe live bulk mutations to test a gate.

## Scoped CSS migration must replace every competing entry point (2026-09-08)
- Problem/root cause: legacy unlayered sheets outrank layered components; print-form date helpers attach to the whole field, including its label.
- Solution: opt in per consumer, remove its competing styles and anchor the calendar button to the input bottom. A later utilities layer owns hidden state without important flags.
- Prevention: exercise loading/error/success and mobile states, assert the date button stays inside its input, and lock actual stylesheet owners plus unchanged billing content.

## Shared workflow state must match its visibility owner (2026-09-08)
- Problem/root cause: migrating hidden state left paste guards on inline display; queues showed success before awaiting refresh, and failed file links left a success icon.
- Solution: keep visibility checks aligned with the migrated owner, centralize custom-dialog focus/scroll state, preserve keyboard focus when filters or expansion buttons are replaced, and update success indicators only after the operation settles.
- Prevention: exercise populated, failed, retry and cancelled states with mocked writes; check old consumers when a shared helper opts into new presentation.

## A visible quantity grid does not prove pricing is ready (2026-09-08)
- Problem/root cause: DTG rendered sizes before its bundle request completed; Save accepted zero/partial prices, and an older request could overwrite edits. A six-second browser delay hid the readiness gap.
- Solution: require every entered row/positive size to have current pricing; invalidate on edits, discard old responses, copy size maps, and use the same guard for Save and Print. Pending manual rows throw a visible error instead of falling back to AI data.
- Prevention: controlled pending/failure/out-of-order tests plus browser assertions on actual readiness and posted money. Keep Save independent of customer/Push completeness; unused blank rows are allowed. EMB/SCP already recalculate before save; DTF computes from state.

## Dialog text must stay readable during entrance motion (2026-09-08)
- Problem/root cause: whole-dialog and toast opacity animations briefly blended text into its background; CI and the full local suite sampled low-contrast frames that focused runs missed.
- Solution/prevention: animate position/scale only, and pause real preview/toast entry and dismissal animations mid-frame during the browser contrast check. Do not hide the failure with a fixed delay or weaken the accessibility assertion.

## Style/build checks must distinguish source from platform artifacts (2026-09-08)
- Problem/root cause: a clean Windows checkout restored CRLF and inflated CSS budgets; esbuild linked-map hashes differed from Linux although executable code matched.
- Solution: measure committed LF source bytes. Resolve production bundles from the production manifest and compare executable bytes excluding only the source-map filename.
- Prevention: keep exact source-asset/live-SHA checks and do not increase budgets or claim missing deployment from a local bundle filename alone.

## Server authentication migrations must preserve every caller boundary (2026-09-08)
- Problem/root cause: transfer/Supacolor routers were open; separate notes, image downloads, vision extraction and two scheduler jobs used different call paths. The app's smaller global parser would also reject previously valid screenshots.
- Solution: staff-session relays keep the credential server-side, authenticate before the 10 MB screenshot parser, allowlist paths/queries and preserve binary downloads. Vendor sessions retain ownership checks; public customer mockups do not request staff transfers.
- Prevention: test actual mounts/page gates, allowed and denied identities, large/malformed requests, vendor notes and customer rendering. Deploy browser relays first, then backend gates and authenticated cron callers; never infer identity from Origin.

## Art-family themes and dialogs need runtime state coverage (2026-09-08)
- Problem/root cause: department-scoped layout vanished in customer mode, guessed palette names had no definition, tablists mixed navigation links with tabs, and selection/toast opacity reduced text contrast. Icon-only controls also depended on an unloaded font.
- Solution: stable page scope, actual shared aliases, separate tablists, opaque text, native named keyboard controls and a visible close glyph. Load ui-dialog.js before transfer-actions-shared.js on every unified consumer; a dependency guard and both sender browser paths lock this. Customer rush indicators are read-only; print keeps its existing staff-only job sheet.
- Prevention: resolve tokens per real style graph, inspect screenshots as well as axe, and exercise intake/error/dialog/print states at four widths with writes mocked. Keep exact visibility exceptions rather than deleting important flags by script.

## Training controls and printed guides need state/output checks (2026-09-08, archived)

Exercise state transitions and verify complete printed content. Full entry in LESSONS_LEARNED_ARCHIVE.md.

### Shared form styles and print pseudo-elements (2026-09-08, archived): inspect actual filled paper and scoped pseudo-elements. Full entry in LESSONS_LEARNED_ARCHIVE.md.

### Training state must survive every input path (2026-09-08, archived): preserve input/retry/storage behavior. Full entry in LESSONS_LEARNED_ARCHIVE.md.

## Reference content and browser persistence need their own checks (2026-09-08)
- Problem/root cause: rich quick-tip data carried inline presentation rules into redesigned pages; local date-only strings displayed a day earlier in Pacific time. Guide checklist writes and resets could fail silently after a one-time storage probe.
- Solution: preserve shared JSON for other consumers, sanitize only the new renderer, use calendar-date comparisons and visible request/retry states; guard each storage read/write/reset and preserve unreadable saved progress.
- Prevention: lock original prose/media/data, test timezone boundaries and later storage failures, and review actual PDF text plus page images. A green stylesheet check alone cannot verify these behaviors.


### Manual navigation and paper visibility share one state owner (2026-09-08)
- Problem/root cause: removed inline handlers left stale selected-link code; duplicate initializers ignored deep links; missing birthdays and UTC date parsing broke roster display. Generic card print rules forced long schedule sections onto new sheets.
- Solution: real section links, native disclosure buttons, one navigation/print-state owner, optional-birthday handling and local calendar dates; retire the legacy card class from documents.
- Prevention: exercise every chapter/day and back/forward history, preserve original lesson data, check temporary print expansion restores screen state, and inspect actual PDFs for blank pages and complete text.

### Training exercises: round lifecycle and saved progress (2026-09-08)

Problem: restarting bound handlers again, speed rounds graded the first answer, and old timers changed a new mode; blocked/malformed localStorage prevented startup. Root cause: DOM/event lifetime and round lifetime were mixed, while persistence was assumed available. Solution: bind once, reset the same instance, grade the current question once, cancel interval/delayed work on mode changes, use a wall-clock deadline, and validate saved progress with visible read/write failures. Preserve unreadable storage rather than overwriting it. Prevention: complete/restart rounds, switch modes with work pending, and test denied/malformed/readable-but-unwritable storage in a real browser.

### Reference search, disclosure and paper code need explicit contracts (2026-09-08)

Problem: reference descriptions disappeared on phones, ODBC tables were click-only and retry reloaded the page; font ligatures changed copied SQL operators in PDFs. Root cause: legacy shell rules, non-native disclosure, assumed-valid schema and programming-font contextual glyph substitution. Solution: shared scoped reference layout with native details, escaped raw-text highlighting, schema validation and retry preserving search; print the complete catalogue and restore filters, and disable ligatures/contextual alternates for code. Prevention: lock original catalog literals/schema/prose, test roles and keyboard/filter/failure states, compare every PDF field name and technical paragraph, and inspect actual paper operators.

### Guide and tracker migrations need their actual role and print state (2026-09-08)

Problem: guide contents disappeared on phones, bootstrap spacing vanished on paper, and tracker filters/retry assumed mouse input and a valid snapshot. Root cause: legacy framework utilities and shared test login assumptions. Solution: native responsive disclosure, explicit number spacing, typed filter buttons, validated snapshot with visible retry preserving search, and full-content print that restores screen state. Prevention: keep original policy data immutable, test real anonymous/staff denial separately from a local admin viewing session, verify actual contrast on colored panels, and compare PDF content as well as row counts.

### Policy readers and editors need separate state and print checks (2026-09-08)

Problem: SAML staff lost comment controls, failed editor loads could save empty content, phone contents had a clipped secondary scroller, and chart search/printing concealed collapsed teams. Root cause: browser-storage-only identity, editor state assumed ready, stylesheet load-order overrides, and missing disclosure/print contracts. Solution: use resolved identity, gate saving and parent choices on successful setup, put mobile rules in the actual page owner, synchronize search expansion, and explicitly print complete teams/chapters. Preserve TipTap's existing normalization rather than forcing byte equality after visual editing. Prevention: test failed saves/posts with exact draft preservation, blocked storage, all chapter links, missing sanitizer/editor, actual content following dividers, and populated PDFs with collapsed screen states.

### Public family migrations must preserve offer text and all stylesheet paths (2026-09-08)

Problem: borrowed campaign CSS hid navigation without its original controller, CSS byte audits missed a relative stylesheet link, and printed footers split onto a trailing page. Root cause: cross-page stylesheet dependencies and incomplete source/path/print accounting. Solution: one scoped family layout with native navigation and FAQs, resolve relative and root asset paths alike, preserve the entire original main text plus SEO/image/link data, and keep footer blocks together. Prevention: check every route alias, four widths and keyboard disclosures, then compare actual PDF offer/pricing/FAQ text and render paper samples.

Webstore follow-up: full hygiene checks also require cache versions on every new local CSS/JS reference. Add the reserved candidate version before full gates, including unchanged shared components newly linked into a page.


### Native storefront menus still need keyboard and layout ownership checks (2026-09-09)

Problem: the inherited drawer had no focus boundary or return, and initial native-dialog review found reverse Tab leaving the menu. Root cause: hidden custom panels and relying on browser traversal alone. Solution: native modal with explicit first/last Tab wrap, Escape/backdrop/close-button dismissal, return focus, desktop-resize cleanup; scope every CSS rule to unified ownership and merge repeated selectors. Prevention: run all fifteen brand pages at four widths, test both search triggers and empty input, lock original brand/SEO/product text, and compare rendered PDF text allowing CSS text-transform case changes.

### Staff reference data and paper need explicit failure states (2026-09-09)

Problem: partial service rows looked fully live, invalid bonus figures could render, malformed form lists looked empty, and screen breakpoints/large unbreakable cards wasted paper. Root cause: optimistic response shapes, fallback labels at response rather than row level, borrowed page CSS and screen rules applied to print. Solution: validate data, visibly distinguish API/mixed/fallback states, retry only dependent content, retain checklists, escape external labels/destinations, use focusable scrolling tables and screen-only breakpoints with compact print layouts. Prevention: preserve original prose/actions, test real existing page access, four widths/axe and failed/malformed/retry states, compare actual paper text including warnings, and keep retry controls off paper. Multiline tooling edits must normalize CRLF or assert replacements; check the resulting code.

### Sign-in and confirmation owners need honest state and paper checks (2026-09-09)

Problem: shared form arrangements initially omitted canonical field styles, infrastructure failures falsely displayed an email-sent state, and artwork pushed receipt contact details onto a trailing sheet. Root cause: class ownership, treating all HTTP responses as success, and screen spacing inherited by print. Solution: canonical fields/shared access shell, generic outage errors preserving the email for retry while keeping successful known/unknown accounts identical, and compact print spacing with empty artwork regions hidden. Fulfillment controllers, totals and server shipping promises remain unchanged and hash-locked. Prevention: exercise keyboard/invalid/pending/rate/network/outage/sent states with all writes and emails blocked, inspect paper with actual artwork fixtures and compare every content block. Preserve line endings in scripted registry edits so removing a line cannot merge an adjacent entry into a comment.

### Catalog discovery must distinguish failed data from absent products (2026-09-09)

Problem: missing logos left unnamed tiles, failed product batches could appear as verified absent products, and intrinsic grid images overlapped card labels on paper. Root cause: image-only interaction, unchecked response shape, and print grid intrinsic sizing. Solution: named native links, validated batches with explicit retry preserving filters, server price labels retained verbatim, and contained images with separate label flow. Move shared navigation without duplicating it; preserve every curated style/category/brand description. Prevention: test keyboard, malformed/partial/empty/retry states and escaped server labels; assert image-to-body print geometry and compare every PDF text block. Browser review blocks all business writes and emails.
