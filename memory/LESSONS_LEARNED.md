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

## 2026-09-05 — Whole-dashboard deep-review sweep (`.24` → `.75`, 54 pages): the same six bugs kept reappearing

**Problem.** Fifty-four staff pages, each "done" by a different session, shared the same defects: (1) a
page's error banner span carried a class the shared helper never writes (`.dash-error-text` vs
`.dash-error-banner-message`) so **every** failure on the Blog Editor showed an empty red bar; (2)
`toISOString().slice(0,10)` as "today" on SIX pages (Payables default range + import-stamp, Payroll pill +
slip run date, Forms Inbox `Date_Returned`, Volume Quote valid-until, Ruth's due badges, Monogram date
filter) — a day ahead after 5 PM Pacific, and in Ruth's case "due today" read OVERDUE all day; (3) flex/grid
wrappers beating the UA `[hidden]` rule (Jim's Mailing List showed an empty screenshot placeholder on every
load; the vendor portal showed its error banner on every load); (4) `r.ok ? r.json() : {rows:[]}` rendering a
500 as "No matches"/"No photos yet" (Finished Photos, Payables imports cross-ref → every row "NOT IMPORTED");
(5) prices typed in reference UIs (Digitized Designs AL tables, Ruth's Billing Codes, the shared art-time
modal's `* 75` in 18 places incl. a Caspio write); (6) click-only tiles/chips/rows and unlabelled dialogs.

**Root cause.** Each page was built to work, not to fail: no page had a failure-path smoke, no shared
lock caught a helper/class mismatch, and "today" was written six different ways because no helper existed.

**Solution.** One jest lock per page (`tests/unit/<page>-page.test.js`, ~30 new files) + a section per page in
`memory/DASHBOARD_REVIEWS_2026-09.md`; fixes verified on `static-dist` with fetch stubbed to FAIL first,
then live in Erik's Chrome. Shared fixes: `artRate()` from Service_Codes GRT-75 with a visible fallback note;
`/api/al-pricing` behind the Digitized AL modal; `SanMarInvoiceViewer` title/focus fixes for 3 pages.

**Prevention.**
- 🔴 **Smoke the failure path first**: on static-dist every same-origin API 404s — if a page shows an empty
  state, a blank banner, or stale data instead of the reason + Retry, that is the bug.
- 🔴 **"Today" = local calendar day** (`getFullYear/getMonth/getDate`), never `toISOString().slice(0,10)`;
  Caspio `YYYY-MM-DD` parses via `parseCalendarDate()`; compare at DAY granularity.
- 🔴 Every page CSS carries `[hidden] { display: none !important; }` — the lock for each page asserts it.
- 🔴 A helper's DOM contract (`.dash-error-banner-message`, `.dash-error-banner-close`) is locked per page;
  a wrong class is a silent error path.
- 🔑 Computed colours/sizes go in `style="--w:…"` custom properties + a CSS `var()` — the lock regex allows
  `style="--` and nothing else. Icons are `aria-hidden`; a `title`-only button also gets `aria-label`.
- 🔑 Background tabs freeze CSS transitions — a `width` read as 0 with `--w: 85%` set is the tab, not the CSS
  (`document.hidden`); set `transition:none` before trusting a computed size.

## 2026-09-06 — Customer-facing sweep (`v2026.09.05.77` → `v2026.09.06.5`, 5 batches, ~70 public pages): the SAME rules the staff pages broke, plus three real bugs

**Problem.** Public pages had never been through the deep-review loop. Beyond the hygiene the staff sweep
found (bare icons, inline handlers, `display:none` beaten by `.hidden=`), three things were wrong for customers:
(1) `dtg-compatible-products` grid had `style="display:none"` while the script set `.hidden = false` — the inline
style always won, so the product grid could never show; (2) `design-view`'s Escape listener was registered
AFTER `init()`'s early `return`, so the lightbox had no Esc on error pages; (3) `inventory-details` rendered
the colour swatches BEFORE resolving the fallback colour, so with no `COLOR` in the URL nothing showed selected.
Six public scripts still carried the proxy host as a silent fallback (`… || 'https://caspio-pricing-proxy…'`),
and four legacy public pages carried whole `<style>`/`<script>` blocks + `onclick=`/`onerror=` (Rule 3).

**Root cause.** The same as the staff sweep: pages built to work, never smoked on the failure path; plus
"fallback host" habits from before Rule 6 existed.

**Solution.** Five batches, each with a scratchpad python fix script, a jest lock (`public-legacy-pages`,
`public-storefront-pages`, `public-forms-account-pages`, `public-content-pages`, `public-cart-header-pages`),
static-dist smoke, deploy, live verify in Chrome. Sections per batch in `memory/DASHBOARD_REVIEWS_2026-09.md`
(§ CUSTOMER-FACING PAGES).

**Prevention.**
- 🔴 **`hidden` attribute + `[hidden]{display:none!important}` guard, never `style="display:none"` + `.hidden=`** —
  the inline style outranks the attribute's UA rule (the dtg grid bug).
- 🔴 **No fallback host.** `const API_BASE = (APP_CONFIG…) || ''` and a VISIBLE message when empty
  (toast / error panel / console.error + placeholder for image-only lookups). The locks assert the host string is absent.
- 🔴 Register global listeners (Esc, delegated clicks) OUTSIDE any function that can return early.
- 🔴 Resolve state (selected colour, fallbacks) BEFORE rendering the controls that display it.
- 🔑 Live host for public verification is `sanmar-inventory-app-4cd7b252508d.herokuapp.com` —
  `www.nwcustomapparel.com` is the Apache marketing site and 404s on app paths.
- 🔑 A JS component that injects `<style>` on render is a Rule 3 violation by another route — extract to a
  stylesheet the consumer links (universal cart header).
- 🔑 The icon-hiding regex must allow `_` in extra classes (`g-footer__rep-icon`) and the `${…}` dynamic form.
- 🔑 `loading="lazy"` images read `naturalWidth 0` until scrolled near — not a broken image.

## 2026-09-06 — Calculator sweep (`v2026.09.06.9` → `.16`): 8 pages of inline code, 5 shared scripts with hardcoded hosts, and a dead loader

**Problem.** The staff calculators were the last family untouched by Rule 3: screen-print, dtf, dtg, embroidery,
cap-embroidery, digitizing, monogram and laser-manual carried 1,000-line inline `<style>` blocks and up to
1,416-line inline `<script>` blocks; six shared calculator scripts and three page scripts had the proxy host
hardcoded (pricing-pages even kept an unused "backup host"); `pricing-pages.js` chain-loaded `cart.js` at runtime
through a loader that force-skipped it and pointed at three files that no longer existed, and carried a full
duplicate of `calculator-inventory.js`; `app.config.js` was loaded AFTER the scripts that read it on four pages.

**Root cause.** Pages were built by copy-paste in 2025; nothing locked them; the config script was appended
where it was convenient, not where parse-time reads needed it.

**Solution.** Verbatim extraction (CSS → `calculators/css/<page>.css`, JS → `calculators/js/<page>-page.js` at the
same script position, global scope preserved because shared scripts call page functions by name), hosts from
`APP_CONFIG` with a visible console.error when missing, one config tag in `<head>`, injected `<style>` blocks
→ real stylesheets, delegated handlers via `data-call-delegator.js`, gated logging. Locks:
`screen-print-pricing-page`, `calculator-pages-rule3`, `calculator-shared-components`, `calculator-hygiene`,
`pricing-pages-no-legacy-loader`. Sections in `memory/DASHBOARD_REVIEWS_2026-09.md` § CALCULATORS.

**Prevention.**
- 🔴 **`app.config.js` goes in `<head>`.** A module-level `const HOST = APP_CONFIG…` reads at parse time; a
  config tag placed later in `<body>` leaves it empty. The lock asserts config precedes every shared script.
- 🔴 **`data-call="x.fn"` resolves `window.x`** — a top-level `let`/`const` is NOT a window property (inline
  `onclick` saw it through lexical scope). Expose it (`window.compareCalc = compareCalc`) when converting.
- 🔴 A runtime `loadScript('/cart.js')` string is a reference a `<script>`-tag scan will miss — grep the string,
  not just the tag, before calling a file dead (cart.js was "dead" for 3 months while still referenced).
- 🔑 Keep extracted page scripts at GLOBAL scope when shared scripts call their functions by name; an IIFE
  wrapper silently breaks `showLoading`/`loadProduct`-style cross-calls.
- 🔑 A shared script that injects `<style>` on render is Rule 3 by another route; extract and link.
- 🔑 The icon-hiding regex must tolerate extra attributes (`id=`) after `class=` and the `fa-${…}` dynamic form.
- 🔑 A page that 301s live (compare-pricing → quick-quote, webstore-info → company-webstores) still passes every
  static-dist smoke — check the live URL before trusting a smoke on a retired page.

## 2026-09-06 — Quote builders: finishing Rule 3 meant teaching the shared delegator four more events (`v2026.09.06.19`–`.22`)

**Problem.** The 2026-09-05 review had converted the builders' `onclick=` to `data-call`, but 185 `onchange=` /
`oninput=` / `onblur=` / `onkeydown=` / `onerror=` handlers remained across the three builder pages and their
row templates, plus a 540-line inline style/script pair on the fast-quote page and 79 bare icons in the shared
classic scripts every builder loads.

**Solution.** ONE change to `quote-builder-utils.js` (Rule 8: shared, not four copies): `data-change` /
`data-input` / `data-blur` (focusout) / `data-keydown` with comma lists, `?optional` names, `data-*-args`
(`$this`/`$event`), `data-keyclick`, `data-enter` (+`-args`, `-unless`), `<img data-onerror>`; a parser rewrote
every inline form mechanically (dry run reviewed first). Locks: `quote-builders-hygiene.test.js` (jsdom exercises
every new path) + the parity suites untouched and green.

**Prevention.**
- 🔴 **Do not add an `sr-only` h1 to the four builders** — axe `heading-order` + `region` baselines
  (`tests/a11y/builders.a11y.test.js`) fail; they carry no h1 by design.
- 🔴 A top-of-file `window.location.hostname` read breaks any test that evals the file without a window
  (`scp-dark-garment-parity`) — gate with `typeof window !== 'undefined' && !!window.location`.
- 🔑 The old inline guard `if(window.x)x()` is the delegator's `?x` — keep it for functions a page may not define
  (`renderOrderRecap`, the push-button state updaters).
- 🔑 Icon regexes must also catch `class="fas ' + var + '"` (concatenation) and `fa-${expr}` forms; grep at
  runtime (`i.fas:not([aria-hidden])`) after the static pass.
- 🔑 Builders are staff-gated: an expired Chrome session redirects to the Caspio login silently (the probe
  returns empty counts). Verify wiring on static-dist (no auth) and ask Erik to sign in for the live pass.

## 2026-09-06 — Staff pages, the LIVE pass: what a signed-in runtime walk found that 80 static locks had not (`v2026.09.06.26`–`.28`)

**Problem.** Every dashboard-linked page had a static jest lock from the 09-05 sweep, yet a signed-in walk of
the RUNTIME DOM on teamnwca.com found: 64 inline `onclick`s on the garment designer, 15 handlers rendered by
the AE dashboard's scripts, `onerror` on every Pride Wall tile, seven shared scripts injecting `<style>` blocks
on every render, two employee-bundle pages with 230-line inline `<style>`, ~100 undecorated icons in scripts
whose `class=` was not the first attribute, unversioned shared assets on 20 pages, seven unlabeled AE controls.

**Root cause.** The static locks matched the page HTML and one icon regex shape; anything a script rendered
after load, any `<i id=… class=…>` ordering, and any JS-injected stylesheet was invisible to them.

**Solution.** One generic runtime probe per page (handlers / bare icons / injected styles / unversioned /
unnamed buttons / unlabeled inputs / h1), traced to source; `data-call-delegator.js` grew `data-input`,
`data-open` and `<img data-onerror|data-onload>` modes; injected styles became real stylesheets linked by every
consumer; lock `staff-live-hygiene.test.js` checks the SCRIPTS that render into pages, not only the pages.

**Prevention.**
- 🔴 A page lock must also cover the scripts that render into it (`RENDERERS` list) — that is where the
  handlers and icons live. Grep `<i(?![^>]*aria-hidden)[^>]*class="fa…"` (any attribute order).
- 🔴 Runtime "bare icon" counts must exclude icons with `aria-label` — the Design Vault's 110 source badges
  are deliberate, labelled icons, not defects.
- 🔑 `<style>` elements at runtime on a page that ships none are usually Caspio DataPage embeds (DrainPro,
  employee bundles, digitized/old designs) or a browser extension (glasp) — check `textContent` before chasing.
- 🔑 A JS-created control (`document.createElement('input')`) needs its `aria-label` set in code; the template
  scan will never see it.
- 🔑 The Mission Control harness drifts whenever its page changes — `node scripts/sync-test-harness.js`.
- 🔑 The esbuild-hashed dashboard bundle (`dashboard-app.XXXXXXXX.js`, 8 chars) is versioned; a "10-hex"
  hash regex flags it falsely.

## 2026-09-06 — Rule 6 sweep S3 (`v2026.09.06.31`): 118 scripts still guessed the proxy host, and two unit tests had been hitting the live API

**Problem.** After every sweep, `no-hardcoded-hosts` still counted 222 proxy-host literals. 118
browser scripts carried `|| 'https://caspio-pricing-proxy…'` (or a ternary, a direct
`fetch('https://…')`, an object property, or a `return 'https://…'` accessor) — so a page that
forgot `/config/app.config.js` silently worked against the literal and nobody noticed the config
was missing. Two embroidery unit suites had passed for months only because the calculator's
constructor fetched the LIVE proxy from Node.
**Root cause.** Rule 6 was applied per-file when a file was touched; nothing swept the tree, and
the fallback made the missing config invisible. The tests constructed `new Calc()` without
`skipInit`, and the fallback host made that a real network call that happened to succeed.
**Solution.** One script rewrote every fallback form to read `APP_CONFIG.API.BASE_URL` and log
`[file] APP_CONFIG.API.BASE_URL missing` when absent (accessors return `''`); 18 forms the regex
could not classify were rewritten by hand; `app.config.js` added in `<head>` of 32 consumer pages
and moved ahead of the first script on 5 more (the homepage tag was `defer`, but `brands-flyout.js`
instantiates at parse time). Baseline 222 → 42 (Node-side `lib/`, `scripts/`, the two sanctioned
`EXACT_ONE` literals, three `preconnect` hints). Tests construct with `{ skipInit: true }`.
**Prevention.** 🔑 A colon is not a ternary: `key: 'https://…'` inside an object literal matched
the `[?:]` regex and became `key: ''` — a SILENT empty base; grep the diff for `: ''` after any
regex rewrite. 🔑 Whole-file diffs after a scripted edit = line endings, not content: this repo
mixes CRLF files, LF files and MIXED files (`dtg-pricing-service.js`); rebuild from `git show
HEAD:` with `difflib` keeping each original line's ending, never `replace('\n','\r\n')`.
🔑 A script that reads config at parse time needs the config tag BEFORE it, and `defer` on the
config tag re-orders it after every non-deferred script. 🔑 A unit test that only passes with
network access is an integration test in disguise — `skipInit` exists for exactly this.
🔑 `git diff` on this OneDrive checkout warns "LF will be replaced by CRLF" for every touched
file; silence it with `-c core.safecrlf=false`, it is not a content change.

## 2026-09-06 — Final census (`v2026.09.06.33`–`.34`): 69 dead files, a retired page that still got "fixed" twice, and a lock that pinned a version prefix

**Problem.** After five sweeps the tree still held 35 browser scripts nobody loads (oldest untouched since
2025-06), 11 design mockups, 8 pre-Caspio policy pages with no static mount, and a C112 promo page that
`server.js` answers with a 410 — yet the S2 batch had extracted its inline code and S3 had converted its host
literal. A lock (`office-ops-pages`) failed the day after it was written because it matched `?v=2026.09.05.7x`
and the deploy bumped the version.
**Root cause.** No repo-wide reference count existed; every sweep worked from a linked-page list, so a file
that nothing links was invisible until a directory scan pulled it in — and then it got "cleaned" instead of
deleted. Reachability was never checked against `server.js` (a route can retire a page that the file
system still shows as live).
**Solution.** `repo-hygiene-final.test.js`: every served page is Rule-3 clean, every browser script has a
referrer (page, script, `server.js`, build), and the census's dead list stays unreferenced. The deletion
itself is a human `git rm` (`memory/DEAD_FILES_2026-09-06.md`) — the agent's bulk removal is blocked by
policy, correctly. Version assertions compare numerically (≥ a floor), never a prefix.
**Prevention.** 🔑 Before fixing a page, check three things: is it linked, is it mounted, and does a
`server.js` route override it (410/301/redirect) — a file on disk is not a live page. 🔑 A referrer census
must exclude `tests/`, `scripts/` (one-off Node), and `/archive/` — those "references" kept dead files
alive for a year. 🔑 Rendered markup is only visible at runtime: the forms' shared scripts added 5 bare icons
per page that 18 static locks passed; probe the DOM after load, then add the renderer to the lock.
🔑 Never pin a cache-bust version prefix in a test; the next deploy bumps it.

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
