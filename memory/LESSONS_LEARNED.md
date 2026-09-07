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
### Two customer calculators drifted from Caspio\x27s tiers while the engine followed them (2026-09-06, ARCHIVED 2026-09-07, `v2026.09.06.42`–`.43`): a tier label in a template is a price — generate every tier strip from `pricing-bundle`, price sub-minimum quantities through the canonical engine, and after ANY Caspio tier change diff each calculator\x27s buttons against `/api/pricing-bundle?method=X` and its sub-minimum price against Quick Quote. Full entry in archive.

## 2026-09-06 — Erik asked "is pricing the same everywhere?" — two of five customer calculators were not (`v2026.09.06.44`)

**Problem.** The parity suites were green, yet a cross-surface run (engine on the Quick Quote page
vs what each calculator page displays) found: DTG under 24 pieces off by $1–$2.33 (fixed `.43`),
and DTF showing **$0.00** for every tier on any load after the first in a tab.
**Root cause (DTF).** `dtf-adapter` merged its sessionStorage copy over the fresh API cost with an
`Object.assign(target, stored, target)` — the target is overwritten first, then "restored" from
itself; and the adapter persists `garmentCost: 0` from its initial state, so the stale zero always
won. The first-ever load in a tab worked, which is why nobody saw it.
**Root cause (general).** Rule 9 parity is tested at the ENGINE seam. A calculator page adds a
DOM, adapters, sessionStorage and typed tier UI on top, and none of that was compared to the engine.
**Solution.** Merge order fixed (fresh wins; stored 0 or another style's cost dropped); locked.
The run itself is recorded as a table in `DASHBOARD_REVIEWS` § CROSS-SURFACE.
**Prevention.** 🔑 `Object.assign(a, b, a)` never restores `a` — it is `Object.assign(a, b)`.
Merge INTO a fresh object. 🔑 Never persist a zero price; a stored 0 is a bug waiting for a reload.
🔑 A parity check must read the PAGE (what the customer sees), not just the engine; do it after
any deploy that touches a calculator, an adapter or a Caspio tier. 🔑 Test with a warm
sessionStorage as well as a cold one — the two code paths differ.

## 2026-09-06 — Adding `<main>` to 96 pages found two markup bugs a browser had been hiding (`v2026.09.06.51`)

**Problem.** To place a landmark I had to parse each page's top-level body structure. Two pages
did not balance: `calculators/embroidery-pricing.html` never closed its `.main-container` (the
browser auto-closed it at `</body>`, so the script tags were inside the content container), and
`training/thank-you-card-guide.html` had `<<Contact First Name>>` / `<<Order Number>>` as literal
text — the parser treats `<Contact First Name>` as a start tag, so staff saw "Dear <>" with the
placeholder gone.
**Root cause.** Browsers recover silently from both; nothing in the repo parsed markup structurally,
so the locks (regex-based) never saw either.
**Solution.** Closed the container before the script block; escaped the placeholders as
`&lt;&lt;…&gt;&gt;`. Landmark: swap the single content wrapper's tag (classes/ids kept → zero
selector risk) or wrap a sibling range in a bare `<main>`; verified by full-page before/after
screenshots of all 96 pages and the unit + e2e suites.
**Prevention.** 🔑 Prose that shows angle brackets must be entity-escaped — `<<Name>>` is a tag to
the browser, whatever it looks like in the editor. 🔑 When adding a landmark prefer swapping the
existing wrapper's tag over inserting a new element: nothing in CSS or JS targets `div` by tag.
🔑 Grep a stylesheet for bare `main {` BEFORE introducing a `<main>` — a themed reset would restyle
the swapped element (none of these 96 pages had one; 47 other stylesheets in the repo do).
🔑 A page list built from repo paths is not a URL list: server.js serves some pages at other paths.

## 2026-09-07 — Every money-path alert had gone to a log nobody reads (`v2026.09.07.1`)

**Problem.** `alert3DT` / `alertQuotePay` (paid order never reached ShopWorks, payment with no
ledger row) posted to a Slack webhook that a memory errand said was "still to set". A
`heroku config:get` showed NEITHER Slack var was ever set — so since the day they were written
these alerts went to Papertrail and nowhere else.
**Root cause.** The fallback was designed as "log, then Slack if configured", and nobody
verified the "if configured" half on the live app. A read of the code says "alerts exist"; only
the config says whether they reach a human.
**Solution.** One `staffAlert` pipe: log + Slack-if-set + EMAIL through EmailJS
`template_staff_alert` (keys already live for order confirmations). Verified by an actual send
from a Heroku one-off dyno. Locked by `staff-alert-email.test.js`.
**Prevention.** 🔑 An alert path is not verified until a test message has ARRIVED. 🔑 When a
feature depends on a config var, check `heroku config:get` (presence only) before assuming the
errand was done. 🔑 This LAN blocks `api.emailjs.com` (TLS interception): prove sends from Heroku.

## 2026-09-07 — CSS standardization Step 1+3 (`v2026.09.07.3`): three traps in a zero-change deploy

**Problem.** (a) A Bash heredoc that was to write the two token files died at parse time and wrote
nothing — the CSS comments contain apostrophes. (b) The three `tests/ui/*.html` token fixtures could
not be screenshotted through `server.js` (no `/tests` mount), so "the five pages that load the
dashboard tokens" were only two served pages. (c) stylelint-config-standard's `value-keyword-case`
demanded `inter`, `menlo`, `blinkmacsystemfont` inside the `--font-*` tokens.
**Root cause.** (a) The harness hands the whole command to `bash -c`; a quoted heredoc is not immune.
(b) `tests/` is deliberately outside every static mount. (c) The rule checks custom-property values
too, and font names are proper nouns.
**Solution.** (a) Write tool for any multi-line file; Bash only for one-line edits (`perl -pi`, CRLF
kept with `\r\n` in the replacement). (b) `node scripts/qa-static-server.js <repo> 8098` serves the
whole tree; a scratch Playwright config (`baseURL` :8098, `testDir` tests/e2e, `testMatch`
builder-screenshots) reuses the spec unchanged — 3 fixtures screenshotted and diffed with the rest.
(c) `'value-keyword-case': ['lower', { ignoreProperties: ['font-family', 'font', '/^--font-/'] }]`.
**Prevention.** 🔑 Write tool for files, perl for lines. 🔑 A page is only screenshot-able if something
SERVES it — check the mount before counting it. 🔑 Lint the token file BEFORE settling the config:
config-standard rewrites are value-identical (hue `deg`, `rgb(… / 12%)`, `#fff`, one declaration per
line) but prove it with the pixel diff, not by eye. 🔑 Another session deployed `v2026.09.07.2` into
this checkout between my first read and my first edit — `git log -1` + `git status` before the first
commit is what caught that develop had moved (DURABLE_GOTCHAS § Repo/deploy, again).

## 2026-09-07 — Forms family migration (`v2026.09.07.4`): the family list was wrong, and `--fix` is not cosmetic

**Problem.** (a) "The 18 forms stylesheets" were migrated and pixel-verified — and the deploy's cache-bust
then bumped two pages outside `pages/forms/` (`request-a-quote`, `webstore-inquiry`) that load the same
shared sheet. Without the tokens link those pages would have rendered every `var(--print-*)` as nothing.
(b) `stylelint --fix` rewrote `@media (max-width: 700px)` to range syntax, `page-break-inside` to
`break-inside`, and dropped `-webkit-`/`-moz-appearance` (leaving a duplicated `appearance: textfield`).
(c) A one-command migration chain broke at a Python error, but because `for …; done;` ends the `&&`
chain, the second half (`--fix`) still ran and the output read as if everything had.
**Root cause.** (a) A family was defined by directory; consumers are defined by `<link>`. (b) The
standard config's fixers modernize syntax — byte changes, fine in 2026 browsers, but not "formatting".
(c) `;` after a compound command terminates an `&&` chain.
**Solution.** (a) `grep -rl 'pages/forms/.*\.css' --include=*.html .` BEFORE the family list is final; the
two pages got the link and their own before/after through a HEAD worktree. (b) Read `git diff -U0` of
every `--fix` run; dedupe by hand; the pixel diff (screen AND print) is the proof. (c) One step per Bash
call, or `;`-separated steps each ending in a printed count.
**Prevention.** 🔑 A family = every page that LINKS its stylesheets, not a directory listing. 🔑 Name the
three diff classes before diffing — identical, threshold-neutral (≤16/channel), deliberate consolidation —
so differing shots read as expected or as a bug, never as "close enough". 🔑 Printed sheets: verify with
`SHOT_MEDIA=print` too. 🔑 A specificity fight is fixed with a more specific selector
(`.form-table td .size-chip input`), never `!important`; the `!important`s that must stay (print beating
JS-toggled state) carry a `stylelint-disable-next-line` reason.

## 2026-09-07 — Training family (`v2026.09.07.6`): an `!important` that source order cannot replace, and a family with no palette

**Problem.** (a) Moving `nwca-language-reference.css`'s 117-flag print block to the END of the file and
stripping `!important` looked right on screen and broke ONE card in print: its columns are laid out by
inline `style=""` attributes in the HTML, and the print block overrides them with `[style*=…]` selectors.
(b) A parser I wrote to find the losing rules choked on those very selectors (a `{`-free attribute value
containing `)`) and "restored" three wrong declarations. (c) The training family has 190 distinct colours
across 26 one-off pages — no palette to map to without repainting 26 pages.
**Root cause.** (a) Inline styles beat every stylesheet rule except `!important`; source order is
irrelevant. (b) Regex CSS parsing. (c) Pages built one at a time, each with its own theme.
**Solution.** (a) Keep `!important` only on the print rules whose selector targets `[style` (a
disable/enable pair with the reason); everything else in the block runs on source order — verified by the
print pixel diff. (b) Read the card's markup and grep its classes instead. (c) Exact/near colours →
tokens; every other colour → a `--page-<hue>` variable declared ONCE in the page's `:root` (auto-named by
hue, stylelint-disable block), so consolidation later is one block per page, not a page-wide hunt.
**Prevention.** 🔑 Before stripping `!important`, grep the page for `style="` — anything the sheet must
beat inline needs the flag, full stop. 🔑 Print verification (`SHOT_MEDIA=print`) is what caught it; the
screen shots were clean. 🔑 A byte-identical rule shared by N pages is a component; extract it to a
family sheet linked before the page sheet, then re-theme it ONCE (ten maroon training headers → the
Training Center's green in one rule). 🔑 Admin pages cannot be screenshotted by the e2e spec (its session
is role `staff`) — verify them live.

## 2026-09-07 — Webstore family (`v2026.09.07.8`): a push that "succeeded", and variables a sheet did not need

**Problem.** (a) My deploy helper ran `git push … 2>&1 | tail -2` and tested the pipeline's status — `tail`'s.
A reset connection printed `fatal:` and the helper reported success; `origin/main` was a release behind while
Heroku and the tag were current. Caught by asking the remote (`git ls-remote origin refs/heads/main`) before
the next step. (b) `golf-tournament-showcase.css` (15 SEO pages) declared its own `--gray-50…900`; with
`tokens.css` now loading first, a same-named token silently loses to the page's copy on those pages — a
latent trap for every semantic alias built on `--gray-*`. (c) `stylelint --fix` dropped `-webkit-` prefixes
and left `backdrop-filter`/`appearance`/`background-clip` declared twice.
**Root cause.** (a) A pipe returns the LAST command's status. (b) Every sheet minted its own palette; the
names collided with the canonical ones. (c) The prefix fixer does not dedupe.
**Solution.** (a) `if git push … > log 2>&1; then` — or `set -o pipefail`; the deploy skill's own steps
have no pipe. (b) Compare values: identical → delete the page copy; different → rename with the sheet's
prefix (`--gts-*`). (c) A dedupe pass after every `--fix`.
**Prevention.** 🔑 Verify a push by reading the remote, never by the push's printed lines. 🔑 Before linking
`tokens.css` to a page, grep its sheets for `--gray-|--space-|--radius-|--font-` definitions — a same-named
local variable shadows the token on that page. 🔑 `--fix` then dedupe then lint again.

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
