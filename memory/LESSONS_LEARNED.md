# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

### Bonus hero dial + CTA wrap-hole (2026-09-01, ARCHIVED 2026-09-03): variable-width money never lives inside a fixed ring (ring holds the %, dollars beside it); flex-wrap breaks lines on MAX-CONTENT width, not post-shrink width — give the sibling `flex:1 1 0`. Full entry in archive.
### First real custom-tees order: proforma hid data the session already had; ShopWorks dates were UTC days (2026-09-01, ARCHIVED 2026-09-05): a blank pre-import field is usually a READER gap (parse the session's JSON blob columns); every date written to ShopWorks/Caspio is the PACIFIC day (`nowPacificNaiveIso()`); a session stuck in `Payment Confirmed` NEVER self-links — manual `POST sync-from-shopworks` with the WO#. Full entry in archive.
### An audit reported a clean manifest as 26 missing POs (2026-08-26, ARCHIVED 2026-09-02): a check must distinguish "I looked and it isn't there" from "I never looked" and SAY WHICH — refresh the arrival span itself, compare mirror lastSync <= manifest date, and a failed fetch marks the run INCONCLUSIVE, never missing. Full entry in archive.
### curl from git-bash mangled em dashes into U+FFFD (2026-08-25, ARCHIVED 2026-09-01): non-ASCII Caspio writes go through Python `ensure_ascii=True`, never a git-bash curl body; verify stored text with `ascii()` on a re-read. Full entry in archive.
### A customer's real size request was shown to nobody (2026-08-19, ARCHIVED 2026-08-27): render every field you persist — a saved-but-unshown field is data loss with extra steps. Full entry in archive.
### SAM quotes rendered “No items” (2026-08-19, ARCHIVED 2026-08-27): a channel that opts out of a shared fix re-inherits the bug it fixed; SW-snapshot overlay repaints EXISTING rows only. Full entry in archive.

### Staff dashboard full review — 5 UTC/Pacific bugs on ONE page + the error renderer silently no-oping (2026-08-26, ARCHIVED 2026-09-01): calendar-day math never via toISOString()/new Date("YYYY-MM-DD")+local getters; register the ERROR_AREAS entry in the same commit as showApiError(); clone a deduped fetch Response per caller; derive quote prefixes from config, never a hand list. Full entry in archive.
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

## 2026-09-07 — Dashboards family (`v2026.09.07.10`): two staff design systems, one token file

**Problem.** The 41 queue dashboards run on `art-hub.css`'s "2026 design tokens" (spacing to 32, radius
4/8/12/16, stacked shadows, `--state-*`), the Staff Dashboard runs on `staff-dashboard/tokens.css` (spacing
to 96, radius 6/10/14/20, oklch), and the app-wide `tokens.css` was seeded from the second. Linking the token
file first on an art-hub page therefore puts two definitions of `--space-5`, `--radius-md` and `--shadow-md`
on the same page.
**Root cause.** Both systems were built one page-family at a time, each minting the same names with
different values; the census counted colours, not variable names.
**Solution.** Values that were byte-identical (`--gray-50…900`) were deleted from art-hub so the token file
is their one home; values that differ stay in art-hub, which loads AFTER tokens and therefore wins on its
pages — zero pixels moved. The choice of ONE scale is a visible layout change across 41 staff pages and is
logged on the Brand Standards page as an open decision for Erik, not decided by a script.
**Prevention.** 🔑 Before a family links `tokens.css`, list every custom property its sheets DEFINE and diff
the values against the token file: identical → delete the copy; different → keep it (it shadows) and log
the conflict; never silently switch a page to the token value. 🔑 Colour = person/department is now checkable
in code: `--art-theme: var(--color-ruth)` reads as the rule it implements — grep for a person's token to find
every page that wears their colour.

## 2026-09-07 — Dashboards + calculators families: six ways a mechanical CSS migration bit back

**Problem.** (a) The hex tokenizer matched `#add` in `#add-to-cart-button {` — three letters that happen to
be hex — and rewrote the id selector to `var(--…-teal)-to-cart-button`, silently dropping the rule. Three
selectors in the calculators family; a scan of every migrated sheet found no other case. (b) A `!important`
annotation perl inserted `/* stylelint-disable-next-line … */` before every line containing `!important`,
including lines inside comment blocks that merely mention it, nesting a comment in a comment and breaking
four staff-dashboard sheets at parse time. (c) A consecutive-duplicate dedupe assumed declarations end with
`;` on their own line; SVG data URIs contain `;`. (d) Five page locks pinned incidental CSS text
(`max-width: 760px`, `0px`, `#9ca3af` as a `var()` fallback) that the standard config rewrites
value-identically. (e) The generated Pricing Analysis page carries its stylesheet `?v=` in a Python constant;
the deploy's cache-bust bumps the HTML, not the generator, and a lock compares the two. (f) `node lint |
grep | head -8` on Windows Git Bash hung the chain — `head` closed the pipe and nothing upstream got SIGPIPE.
**Root cause.** Regexes that are not comment-aware, value-aware or selector-aware; locks that assert bytes
instead of meaning; a version that lives in two places; MSYS pipe semantics.
**Solution.** (a) A hex is a colour only when a `:` precedes it on its line and no identifier char follows;
the damage signature `var(--x)<letter or dash>` is now part of the post-run scan. (b) A comment-aware
scanner (`fix-nested-annotations.py`) drops nested annotations. (c) Whole-line dedupe with a property
lookahead. (d) Locks accept both forms. (e) Bump `CSS_VER` in `scripts/build-pricing-analysis.py` with its
stylesheet. (f) Write lint output to a file and read it.
**Prevention.** 🔑 Every text transform over CSS must skip comments AND selectors — only a declaration
value is a colour. 🔑 After every automated pass, run the full lint and grep for `var(--[a-z0-9-]+)[A-Za-z_-]`
before the screenshots; a dropped rule is silent in a browser. 🔑 A substring lock on CSS should pin the
MEANING (a selector exists, a value is a custom property), not the exact bytes. 🔑 `stylelint --fix` (number-no-trailing-zeros) rewrote `oklch(55.0% …)` as `oklch(55.% …)`, an invalid value that silently drops the declaration — after every `--fix`, grep the touched sheets for `[0-9]\.[%)]` and re-lint (the parser reports it as declaration-property-value-no-unknown).

## 2026-09-07 — Pages batch: a re-run tokenizer turned its own variables into `--x: var(--x)`

**Problem.** Two sheets had gradient values wrapped onto continuation lines, which the tokenizer's
"a `:` must precede the hex on its line" guard skips. Joining the lines and re-running the tokenizer on
those two sheets rewrote the page-theme `:root` block it had written on the first pass: every
`--customer-portal-yellow: #e6bb4a` became `--customer-portal-yellow: var(--customer-portal-yellow)`,
a new block re-declared the hexes above it, and the last declaration wins — a self-reference, which a
browser treats as invalid at computed-value time. Three pages (customer portal, customer product, garment
designer) would have lost every one-off colour. The lint caught it as `declaration-block-no-duplicate-custom-properties`;
the screenshot diff would have too.
**Root cause.** The tokenizer skipped comments but not the `stylelint-disable color-no-hex … enable`
region it writes, and it named variables fresh on every run instead of reusing the ones already declared.
**Solution.** The disable/enable region is now skipped like a comment, existing `--<prefix>-*` declarations
are read first and reused by value, and new names avoid the existing ones; a dry run over a migrated sheet
reports `0 page vars`. Continuation lines are joined onto their declaration line (`join-continuations.py`)
before tokenizing — a declaration can span three lines, so join until the line carries the `:`.
**Prevention.** 🔑 Any script that rewrites a file it may run over again must recognise its own output. 🔑
Run the tokenizer with `--dry` on an already-migrated sheet before a re-run: the expected report is
`exact 0 · near 0 · far 0 → 0 page vars`. 🔑 After a re-run, grep `^\s*(--[a-z0-9-]+):\s*var\(\1\)` — a
self-referencing custom property is silent in the browser and blanks every use of the variable.

## 2026-09-07 — Quote builders family: retiring a generated sheet by renaming, a near-mapped ink, and curl vs the office firewall

**Problem.** (a) The generated `quote-builder-inline.css` (127 `.qbi-<hash>` classes, all `!important`) could not
simply lose its flags: each flag reproduces the precedence an inline `style=""` had over the builders' id-based
rules, and a screenshot only proves the default state of a page — modals, later steps and error states never
render in a shot, so a dropped flag could regress a state nobody sees until a customer does. (b) On the garment
designer the page ink `--text: #22301c` was within the "near" threshold of the storefront ink and got mapped to it;
every heading on the page came out a shade darker (the diff caught 351 px on one heading only — small text stays
under the per-channel threshold). (c) Both curls on this machine (Git Bash's and Windows' `curl.exe`) failed the
TLS handshake to `www.teamnwca.com` (exit 35) minutes after a verified Heroku release; `openssl s_client` showed
the certificate was issued by a FortiGate (`CN=FGT61FTK22016247`) — the office firewall inspects TLS for that
domain and curl does not trust its CA. The app was fine: the direct `*.herokuapp.com` URL answered and the
in-app browser loaded the page with the new stylesheet.
**Root cause.** (a) A flag is a cascade fact, not a lint problem. (b) The near threshold is a colour-distance
rule; it has no idea which colour is the page's body ink. (c) A corporate TLS proxy in the path.
**Solution.** (a) The sheet was retired as a GENERATED artifact, not as a set of flags: the same 127 declaration
sets became `quote-builder-utilities.css` with names that are their declarations (`.qb-mt-4`,
`.qb-bg-amber-100-p-2-8-r-4-c-amber-800`) — tokenize the source sheet first so the names carry token names —
the markup's classes were rewritten in the three builders, and the flags stay with a file-level reason until the
id rules are refactored builder by builder (recorded on the Brand Standards page). (b) Kept the page's exact ink;
the tokenizer's near rule now has a documented exception: a sheet's body ink / page text variable is never
near-mapped. (c) Verify a release through the `herokuapp.com` URL or the browser when curl exits 35 here.
**Prevention.** 🔑 Never delete `!important` on the money path by script — a screenshot cannot see the states
that need it. 🔑 A "near" colour rule must exempt the page's ink (`--text`, `--ink`, `--text-primary`): a
shade on the body text is a look change even when no pixel crosses the threshold. 🔑 curl exit 35 from the
office to teamnwca.com is the FortiGate, not the site — check `openssl s_client -connect … | grep issuer`.

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

## 2026-09-07 — Server split, first cut: three ways "moved verbatim" was not the same server

**Problem.** Six sections of the 15,947-line `server.js` moved byte for byte into `routes/*.js`, the registration-order
lock passed, and the server did not boot — then, once it booted, it would have served the static mounts from the
wrong folder. (a) `requireStaff` was missing from the module's ctx: eslint-scope leaves references to top-level
`function`/`var` declarations unresolved in a classic script (they are global-object properties), so the dependency
analysis, built on `variable.references`, saw only the `const` bindings. (b) A later cut's line range began on the
previous cut's call-site line, so `require('./routes/ai-chat')(app, ctx)` moved INTO `routes/gear-publisher.js`, where
it resolves relative to `routes/`. The order lock still passed because the walker followed the include wherever it sat.
(c) `require('./lib/blog')` and `path.join(__dirname, 'staff-dashboard-v3')` inside moved code now named `routes/…`:
the first threw at boot, the second would have 404'd every static mount without any test noticing. Separately, the
first attempt collided with another assistant's uncommitted change in the same tree.
**Root cause.** Textual moves preserve bytes, not meaning: scope resolution, module-relative paths and the cut's
own artefacts all changed meaning silently.
**Solution.** References matched by name against module-scope declarations (ignoring references resolved to inner
bindings); `check-undef.js` (ESLint no-undef with Node globals over `routes/`) after every cut; the walker errors on a
call site inside a module; the extractor rewrites `require('./…')` → `require('../…')` and `__dirname`/`__filename` →
`SERVER_DIR`/`SERVER_FILE` passed through ctx, and the lock forbids the raw forms; a boot smoke (`PORT=3999 timeout 15
node server.js`) plus real requests to moved routes before any gate. The other agent's change went into a git stash
for the duration and came back after the deploy.
**Prevention.** 🔑 After any code move, boot the server and hit one moved route: a passing order lock proves order,
not resolution. 🔑 Derive a cut's range from the section banner every time — never from arithmetic on stale numbers —
and check the first line is the rule line, not a neighbour's call site. 🔑 Treat `__dirname` and `require('./…')` as
part of a file's address, not its code. 🔑 One agent in `server.js` at a time; `git stash -u` is the tool when it is not.

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
