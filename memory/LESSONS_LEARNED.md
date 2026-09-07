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

## 2026-09-06 — EmailJS ids in 25 scripts, 118 unlabelled controls, and 12 SEO pages rendering in quirks mode (`v2026.09.06.36`)

**Problem.** Rule 6 had been applied to the proxy host but not to EmailJS: 69 copies of the public
key / service id sat in served scripts while `APP_CONFIG.EMAIL` (tenant getters) existed unused.
A static census found 118 form controls with no accessible name, and the 12 `*-webstores` SEO pages
had no doctype/`<html>`/`<body>` at all — bare fragments served with `sendFile`, so every browser
rendered them in quirks mode.
**Root cause.** Config centralisation was done per-constant when a file was touched; nothing
swept for the second literal. Labels were written next to controls (`<label>Name</label><input>`)
without `for=`, which looks right and is invisible to AT. The SEO pages were authored as body
fragments for a wrapper that never existed.
**Solution.** Sweep script → `APP_CONFIG.EMAIL.*` with a visible error, window-guarded; a11y
fixer: `for=` where a label sits beside the control (minting ids), else `aria-label` from the
visible label/placeholder; the fragments wrapped as documents. Both locked in
`repo-hygiene-final.test.js`.
**Prevention.** 🔑 When a config getter exists, grep for the VALUE it returns — a literal beside
an unused getter is the common failure. 🔑 `<label>` without `for=` and not wrapping is
decoration; the a11y lock now fails on it. 🔑 A page that starts with `<meta charset>` has no
`<html>`: check `document.compatMode` on any page that "looks slightly off". 🔑 Module-scope
config reads need `typeof window !== 'undefined'` — the Node-run service tests load the file.

## 2026-09-06 — 700 console.logs in production, and a basename match that hid four stale root copies (`v2026.09.06.37`)

**Problem.** CLAUDE.md says "remove console.log before committing"; 68 served scripts still shipped
~700 of them (a customer's console on the screen-print calculator scrolled 35 lines). The orphan
lock said every script was referenced — but root-level `utils.js`, `dp5-helper.js`,
`pricing-matrix-api.js` and `app-new.js` were stale copies nothing loads: their basenames appeared
in comments and in the paths of their `shared_components/js` twins.
**Root cause.** The rule was enforced by review, not by a lock. A referrer census that matches on
basename cannot tell `/utils.js` from `/shared_components/js/utils.js` or `./utils.js`.
**Solution.** Per-file gated logger (localhost / `?debug=1`) via one idempotent script; lock on bare
`console.log(`. Referrer matching is now path-aware (directory-qualified for duplicated basenames,
quoted `"/name.js"` for root files, sibling `./name.js` for ES modules).
**Prevention.** 🔑 Any "is X referenced" census must match the PATH, not the name — and skip
comments, tests, one-off scripts and archives. 🔑 Gate, don't delete, debug logging: the
`?debug=1` switch keeps the diagnostics Erik uses without paying for them on every customer load.
🔑 A generated identifier prefix can start with a digit — check the first character.

## 2026-09-06 — My own host sweep broke the DTF calculator for four deploys, and only a console read caught it (`v2026.09.06.40`)

**Problem.** S3 (`.31`) rewrote `fetch(\`https://HOST/api/x?style=${s}\`)` sites to
`BASE_URL + '/api/x?style=${s}'` — a single-quoted string — so the DTF calculator fetched the
`${…}` text literally and 404'd on every load from `.31` to `.39`. 182 suites stayed green
(no test exercises that adapter against a URL) and the parity suites price through services
that never hit it.
**Root cause.** The rewrite's `suffix` branch dropped the literal into `'%s'` regardless of the
original quote character; a template literal's backtick was in the regex's quote class, so it
matched, and the replacement lost it.
**Solution.** Backticks restored on all 7 sites; a lock fails on any complete quoted string
containing both `/api/` and `${`.
**Prevention.** 🔑 A scripted rewrite must preserve the ORIGINAL quote character (or refuse
backtick literals); grep the diff for `'…${` before committing. 🔑 After any sweep that touches
fetch URLs, read the live console AND the failed-request list on the pages that use them —
a green suite proves nothing about a URL no test builds. 🔑 Read `performance.getEntriesByType('resource')`
for `responseStatus >= 400`: it shows the literal URL that went out.

## 2026-09-06 — The screen-print tier buttons promised a fee Caspio no longer charges (`v2026.09.06.42`)

**Problem.** Erik moved the ScreenPrint tiers in Caspio (24-47 with a $50 LTM, 48-71 with none).
The calculator's ENGINE followed (it reads `LTM_Fee` off the matched API tier) but its tier strip
was typed in the template: "24-36 + $75 Small Batch Fee", "37-71 + $50", with `(75 / clamped)` and
`(50 / clamped)` in the input handlers. At 50 pieces the page showed a $50 fee it did not charge.
**Root cause.** "Pricing from the API" was applied to the numbers that reach the total and not to
the numbers the customer READS; the strip was built once for a tier layout and never re-derived.
**Solution.** The strip, its inputs, clamps and hints are rendered from the API tiers when the
bundle lands; the art-setup tooltip reads GRT-50; a lock forbids typed tier ids/fees in v2.
**Prevention.** 🔑 Every dollar or range a customer can read is pricing — grep templates for
`$\d` and `\d+-\d+ pieces`, not just the math. 🔑 Compare the UI's tier labels with
`GET /api/pricing-bundle` tiers on each calculator after ANY Caspio tier change. 🔑 A
marker-based `cut()` in a refactor script must assert the method count before/after (117
unrelated lines vanished here and only a runtime probe caught it). 🔑 The dev server serves
`/dist` hashed assets — `node scripts/build.js` before a local probe, or you test the old file.

## 2026-09-06 — Two customer calculators drifted from Caspio's tiers while the engine followed them (`v2026.09.06.42`–`.43`)

**Problem.** Erik re-cut the ScreenPrint tiers (24-47/$50, 48-71/$0) and split the DTG LTM row
(1-11/$50, 12-23/$0) in Caspio. Quick Quote and the builders followed at once (the canonical
engines resolve the row by quantity). The two customer calculators did not: screen print typed
its buttons and fees; DTG typed "Less than 24 + $50" and mapped every sub-24 quantity to 24-47
costs + $50 — $1 under the engine at 8 pieces, $2.33 over at 15.
**Root cause.** Rule 9 was enforced on the engines, not on the pages that render tier buttons:
a page can read `LTM_Fee` for the total and still type the tier ranges, fees and sub-24 mapping.
**Solution.** Both strips are generated from `pricing-bundle` tiers; DTG sub-24 prices through
`DTGCanonicalPricing` (cost-row fallback + `ltmPerUnit`), verified against the engine computed
from the live bundle on the local dev server and live.
**Prevention.** 🔑 After ANY Caspio tier change, diff every calculator's tier buttons against
`/api/pricing-bundle?method=X` tiers AND compare its price at a sub-minimum quantity with Quick
Quote. 🔑 A tier label in a template is a price. 🔑 The dev server serves `/dist` — rebuild
before a local probe; the Browser pane's console log is cumulative across pages, read the page's
own behaviour (a constructed calculator) not the log.

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
