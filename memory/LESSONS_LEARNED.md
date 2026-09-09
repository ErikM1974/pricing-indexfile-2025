# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

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

## Worktree junction deletion incident (2026-09-07, archived)

Never recursively delete a tree containing a junction to shared packages. Inspect link targets, remove only the link through a safe native operation, then verify before deleting the tree. Prefer a module lookup path over a shared node_modules junction. A widespread missing-package failure after cleanup means restore the locked install before debugging code; full resolved incident is in LESSONS_LEARNED_ARCHIVE.md.

## Server split first-cut incident (2026-09-07, archived)

Module moves change scope and relative paths; verify dependency bindings, route order and a real HTTP boot. Full resolved incident and prevention details are in LESSONS_LEARNED_ARCHIVE.md.

## Proxy review authentication (2026-09-07, archived)

Keep caller migrations before proxy gates and authenticate before special parsers. Full resolved incident and regression details are in LESSONS_LEARNED_ARCHIVE.md.

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

CI setup follow-up (2026-09-09): a Google Chrome apt index checksum mismatch blocked Playwright before tests on two runners. CI uses bundled Chromium; disable only the unrelated Google Chrome source on the disposable runner and keep Ubuntu repositories/checksum verification intact. Require the actual browser steps to pass on the new exact commit.

## 2026-09-08 — Node runtime and dependency audit must match CI

**Problem.** Production and CI selected Node 18 while local checks ran Node 22; 17 high audit findings remained.
**Root cause.** Old lockfile resolutions and exact transitive pins kept vulnerable packages installed.
**Solution.** Select Node 22 in engines and all CI jobs; Express 4.22.2, Axios 1.20.0, compatible audit fixes,
and a qs 6.16 override (Express/body-parser pin an older minor). The repository Actions secret is now configured
with Erik's explicit approval; verify the live-engine step actually runs on the next CI push.
**Prevention.** Audit the resolved tree after updating: a green install is not a clean audit. Preserve CRLF in
these two already-CRLF-tracked package files to avoid hiding the dependency diff. Major upgrades stay separate.

## Tooling upgrades and visual verification (2026-09-07, archived)

Keep version choices tied to measured checks and compare screenshots only after readiness. Full entry in LESSONS_LEARNED_ARCHIVE.md.

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
- Prevention: exercise populated, failed, retry and cancelled states with mocked writes; check old consumers when a shared helper opts into new presentation. Queue-age labels need semantic warning ink: amber-600 on white failed contrast only when a fixture crossed24 hours. Fix the CSS and lock fresh/warning/critical ages under a fixed date, retaining axe checks. A browser clock must be explicitly paused for exact polling-count tests; installation alone lets startup/network latency advance timers. Also wait for the application to register its next timer after an asynchronous response; an intercepted request count is not a timer-ready signal. Deliberately delayed fixtures and a no-more-polls assertion protect this boundary.

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

### Campaign inquiries must be received before confirming success (2026-09-09)

Problem: the golf form cleared entered details and sent a customer confirmation even when saving and sales notification both failed; malformed catalog data could also leave sample pricing loading forever. Root cause: all-settled delivery results were logged but never gated the receipt, and initial response shape/loading regions were unchecked. Solution: show success only after storage or sales notification accepts the request, send customer confirmation afterward, preserve inputs on total failure, show confirmation-email failures separately, and stop both catalog/sample loaders on invalid data. Prevention: exercise storage/lead/customer failure combinations and retry with the same values; preserve financial helpers and underlying services. For CSS, validate every token against actual page owners and inspect rendered paper: white text can survive PDF extraction while being invisible, narrow grids can wrap money, and flex list text can split into unintended columns.

Campaign verification follow-up: a runtime census timed out under the full suite. Reuse one inert DOM parser for attribute-only HTML inventory; compare the entire report before/after and keep the deadline/coverage unchanged.304 documents produced a byte-identical531123-byte report,18.31s to13.51s in the measured standalone runs.

### Shared CSS migration must preserve responsive and interaction ownership (2026-09-09)

Problem: consolidating repeated .stk-card selectors moved desktop grid placement after the mobile media query, making tiny phone columns; legacy and shared menu handlers also toggled the same disclosure twice. Root cause: deduplication ignored cascade order, and both controllers owned aria-expanded/visibility. Solution: base geometry precedes responsive rules; the instant pages bypass legacy disclosure/mobile adapters and use existing shared native owners. Financial/submission/artwork code remains source locked. Prevention: real four-width geometry/axe and open/close/resize keyboard checks, every published sticker row and banner preset, retained upload/draft retry, and full paper text plus visual inspection. A clipped screen-reader caption needs an explicit visible print arrangement; shrink optional paper chrome without dropping original content.

## Paper-like form layouts need a separate phone arrangement (2026-09-09)

Problem: the quote request inherited line-oriented paper styling that pushed the project textarea beyond the phone viewport. Root cause: its legacy field row and width rules survived in an online customer form. Solution: canonical vertical fields and bounded grid columns; shared hosted-form wrappers, native keyboard upload and explicit page landmark names. Prevention: check actual control bounds at320/390/768/1440, source-lock serialization and lookup/upload helpers, exercise blocked embeds and retained draft retries, inspect every reference-PDF page. The lookup helper floats popups only on printable forms; anchor the public form menu absolutely to its input and assert its coordinates, not just visibility. Keep mock routes installed across fixture-state transitions: removing them between navigations can allow in-flight requests to reach a live API. Keep department colors tied to ownership: monogram is shop-floor blue, digitizing Ruth purple, purchasing Bradley slate.

## A reviewed page wrapper is not a reviewed external app (2026-09-09)

Problem: the CSS census omitted Jotform scripts and its external-owner backlog named only three Caspio pages. Root cause: provider recognition did not match the currently loaded embeds. Solution: recognize Jotform and explicitly retain vendor-owned UI as pending even after its surrounding page is reviewed. Prevention: lock live embed IDs/URLs, test wrapper boundaries with login/table/empty/failure fixtures and block all real provider writes; do not describe synthetic fixture coverage as validation of a vendor app. Check DESIGN_COLOUR_CODE before mapping an inherited palette: announcement admin tools are neutral; legacy maroon does not make them AE-owned.

## Transient notifications need deterministic contrast checks (2026-09-09)

Problem/root cause: a DTG service outage exposed white text on an amber toast (3.18 contrast); the notification was absent on healthy runs. Solution: use existing dark warning/success tokens and render all four real toast types in the accessibility check. Prevention: wait for their final painted state, test transient failures deliberately, and inspect each builder’s actual style owner. The other three builders have a separate warning foreground; pricing and notification behavior remain unchanged.

DTG test follow-up: initial product hydration can replace a number input between automated focus and text insertion. Set the value and dispatch its actual input event atomically using the shared test helper, then assert the row quantity before waiting for pricing. Keep real pricing reads and mocked writes; never relax the positive-money guard.

## Monitoring data needs complete responses and visible persistence failures (2026-09-09)

Problem/root cause: malformed usage could appear as zero, partial schema could mark tables gone, and local review storage assumed every read/write succeeded. Solution: validate complete responses before rendering, preserve snapshot evidence and notes, distinguish unknown from zero, show export/retry paths and clear only recovered errors. Prevention: exercise malformed/partial/denied storage and successful recovery with synthetic records, preserve the original snapshot, and inspect current-value PDFs. Print long reports in block flow; inherited flex/min-height can create a blank trailing sheet even when PDF text is complete.

## Local file tools need dependency errors and native download evidence (2026-09-09)

Problem/root cause: missing transform/parser globals could leave conversion stuck, malformed FTP rows looked like valid files, and a download mock observed no request even when the browser saved the file. Solution: validate dependencies/listings, show visible errors with the file retained, and test browser-managed attachments using an isolated loopback CSV server. Prevention: compare actual download bytes/queries and converted SKU/prices for CSV/TSV/XLSX; preserve pure financial transforms. Use canonical data-table classes as well as scrolling wrappers; check current-value paper text and geometry, not text extraction alone.

## Purchasing views must distinguish missing ledgers from zero balances (2026-09-09)

Problem/root cause: incomplete invoices looked empty, failed import logs were classified as loaded, delayed requests could replace newer selections, and partial printouts dropped failed lookups. Solution: validate source shapes, keep unknown status and disable unsafe actions, invalidate old responses, and print failure notes with complete invoices. Prevention: test malformed/empty/failed/recovered feeds, mock confirmation and exact CSV bytes, preserve pure money/CSV helpers and AE compatibility. Declare CSS sublayers after primitives; check money widths at768 as well as phones, and inspect all printed line-item columns/current filter values. Optional paid-status sync needs its own visible fallback state.

### Photo failures must survive filtering (2026-09-09)
- Problem: malformed 200 replies looked empty, failed refreshes retained stale counts, and manage action errors appeared inside a hidden upload step.
- Root cause: unchecked response defaults, filters rerendered cached rows, and unrelated controls shared a status host.
- Solution: validate complete photo responses, clear counts to unknown until success, guard late reads and give manage actions a visible status. Confirm mutation success explicitly.
- Prevention: synthetic browser cases cover failure/filter/retry, native file compression and request payloads; original upload and URL helpers remain source locked.

### Caspio design reports need actual provider boundaries (2026-09-09)
- Problem/root cause: simplistic fixtures missed nested source definitions and generated unlayered ID styles; the existing digitized mobile form hid its fields. Provider replacement also detached the archive sticky observer.
- Solution: keep original field names and handlers, hide only the cloned source definitions, rebind replaced forms, and isolate77 exact provider exceptions from the zero-exception local owner (275flags retired). Failed/empty searches clear loading without conflating errors with no results.
- Prevention: real read-only searches verify provider markup; synthetic tests reproduce nested records, all select options, mobile precedence, pricing tiers, clipboard denial and current-value paper output. Match print exceptions by selector/property AND media context. Preserve six original controller/helper hashes outside31 recorded UI edits.
