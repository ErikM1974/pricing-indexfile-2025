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
## Volume Quote page: re-rendering a list wiped what the user was typing in another row (2026-09-02)

**Problem.** Building `/dashboards/volume-quote.html`: entering three styles in a row only ever
produced ONE loaded garment line.
**Root cause.** `renderLines()` rebuilt every row's `innerHTML` whenever ANY row changed state
(loading → loaded → stock checked). The rows whose inputs the user was still typing in were
replaced by fresh elements, so their values and pending events went to detached nodes.
**Solution.** Rows are created once and updated in place: find the row by `data-id`, refresh only
the three info cells, remove rows no longer in state. Inputs are never re-created.
**Prevention.** 🔑 In a list where the user types while async loads land, never rebuild the whole
list from state — patch the cells that changed. 🔑 The first-render bug beside it (`addLine()`
without a render) was invisible because the add BUTTON rendered; test the initial state, not only
the interaction. 🔑 Cost-model constants for a staff page live in Caspio (`Service_Codes`
`VOL-*`), never in the page's `.js` — `/dashboards` gates `.html` only, the `.js` is public.

## Contract fee was "Caspio-driven" on paper and hardcoded in practice (2026-09-02)

**Problem.** Raising the contract small-order fee in Caspio (Embroidery_Costs.LTM 50 → 100) would
have changed nothing on the calculator; and the full-back fee read $50 in the API, $100 on the page
and $100 in the AI prompt at the same time.
**Root cause.** `fetchContractPricing()` mapped `ltmFee: data.ltmFee || 50` — the proxy sends the
fee nested per product (`garments.ltmFee`), never top-level, so the fallback ALWAYS won. Its
`fullBack` mapping copied only the rates and `minStitches`, dropping `ltmFee`/`ltmThreshold`, so
`ltmFeeForProduct('fullback')` returned 0 — 4-piece full-back orders were quoted with NO fee. The page
"facts" strip and the AI prompt carried the same numbers as static text.
**Solution.** Per-product fee from the payload; page facts, hero terms and the order minimum are
filled from the API; prompt told to trust CALC_CONTEXT only; the $150 minimum applied once on the
single pricing path (`applyOrderMinimum` after `combineLines`) so hero/total/copy/AI agree.
**Prevention.** 🔑 `x || DEFAULT` on a field the API does not send is a hardcoded price with extra
steps — grep the payload shape before trusting a fallback. 🔑 A number that appears in copy, a
prompt and an API is three prices; only the API may hold it. 🔑 Test a Caspio-driven value by
CHANGING it in Caspio and watching the page, not by reading the code. 🔑 One rule beats two: a
fee PLUS a minimum produced a price cliff (23 pcs $302, 24 pcs $192) — a single order minimum is
monotonic and explainable; reach for the minimum first.

## 2026-09-03 — Staff dashboard Workspaces: three traps the harness caught before anyone did

**Problem.** The role-based tab layout (`workspace-controller.js`) landed Erik on the Office tab
and its generated Everything tab silently dropped every Admin tool whenever the Admin tab was
not the active one. Both passed the unit test and failed only in `tests/ui/test-workspaces.html`.
**Root cause.** (1) `permissionsFromRole('admin')` fans out to `accountant`, `house`, `taneisha`,
`nika` — a role→default map that checks `accountant` before `admin` sends every admin to Office.
(2) The tab code hid inactive panels with the `hidden` ATTRIBUTE, but `hidden` on a
`[data-requires-role]` node is nav-access-controller's gate signal ("not allowed / not yet
resolved"), and the palette, My Stuff and the Everything builder all skip such nodes — so an
inactive Admin tab looked "not allowed". (3) The repo's files are CRLF: a node edit script with
`\n` in multi-line search strings matched nothing (single-line edits worked, which hid it), and a
re-run then appended duplicate CSS blocks; the Bash tool's heredoc also breaks on 4-byte emoji.
**Solution.** Check `admin` FIRST in the role map; panels switch with an `is-on` class and never
touch `hidden`; the edit script is CRLF-aware and idempotent, written to a file and run with node.
**Prevention.** 🔑 Any role→default mapping must treat the admin fan-out as a superset: match
`admin` first. 🔑 One attribute, one owner: `hidden` on the dashboard belongs to nav-access; tab
and fold visibility use classes. 🔑 A harness that lifts the REAL markup and drives the REAL
controllers over a stubbed session finds what a structural unit test cannot — keep both.
🔑 Multi-line string edits against this repo need `\r\n`; assert the match count and make the
script idempotent before running it twice.


## 2026-09-04 — Company Numbers review: a date a day early, a refresh that wasn't, a goal nobody could change

**Problem.** The revenue card said "Jun 5 - Sep 3" for a fetch that ran Jun 6 → Sep 4; the header
promised "refreshes every 5 minutes" while seven of eight cards loaded once; the $3M annual goal
was a JS constant (`ANNUAL_GOAL`) so a new year meant a deploy; "DEAD" (ShopWorks' dead-accounts
rep) ranked as a salesperson; the static Production card had a refresh button that re-rendered
the same file.
**Root cause.** (1) `new Date('2026-09-04')` is UTC midnight = Sep 3 evening in Pacific — the
same UTC/Pacific class as the 2026-08-26 dashboard bugs, this time in the range FORMATTER, not the
range MATH, so the API window was right and only the label lied. (2) The refresh loop only ever
called `initMetrics()`; the header copy was written for the whole page. (3) A "config" value that
never had a Caspio home stays a constant until someone asks why it needs a deploy.
**Solution.** `toLocalDate()` parses bare `YYYY-MM-DD` as a local calendar day; "Last N days" is
N days inclusive (was N+1). One 5-minute tick refreshes every live card, only while the tab is
visible (hidden tabs spend no Caspio calls; catch-up on return), with an `Updated h:mm` /
`Failed h:mm` stamp per card. Goal → Service_Codes `CO-ANNUAL-GOAL` via `company-goal-service.js`
through `/api/staff/service-codes`; the built-in default is used ONLY with a visible ⚠ (chip +
team card). DEAD folds into House. Refresh button gone; footer prints `dataThrough` + `updatedAt`.
**Prevention.** 🔑 A `YYYY-MM-DD` string is a DAY, never an instant — build it with
`new Date(y, m-1, d)`; grep for `new Date(` over anything that formats a Caspio/ShopWorks day.
🔑 Copy that describes behaviour ("refreshes every…", "based on N…") is a claim — lock it with a
test that reads the code path, or print the truth from the data (stamps, `dataThrough`).
🔑 A proxy WRITE (POST) needs the CRM secret and auto-mode blocks a shell that reads it — creating
a Caspio row from a session is Erik's step, so ship the visible-fallback path first and hand him
the one-line curl. 🔑 Placeholder reps (DEAD, House-Legacy) live in the archive forever — the
consolidation set is the only filter; add to it, never to the query.

## 2026-09-05 — JSON-in-attribute broke on the first quote (Names & Numbers delete button, `v2026.09.05.17`)
**Problem:** after converting `onclick="dashboard.deleteRoster(${id}, '${esc(name)}')"` to `data-args="${esc(JSON.stringify([id, name]))}"`, the attribute read `[10,` — the delete button silently did nothing.
**Root cause:** that page's `esc()` is the `div.textContent → innerHTML` trick, which escapes `< > &` but NOT `"`, so the JSON's quotes ended the attribute early.
**Solution:** escape for an attribute (`&amp; &quot; &lt;`) — `JSON.stringify(...).replace(/"/g,'&quot;')`; the quote-builder `escapeHtml()` and portal-directory `escapeAttr()` already do.
**Prevention:** the delegator reports a bad `data-args` as a visible error (never silent); when writing JSON into a `data-*` attribute inside a template literal, check the page's escaper handles `"` first. Lock: `tests/unit/staff-pages-datacall.test.js`.

## 2026-09-05 — Customer login dropped the deep link it was handed (`v2026.09.05.26`)

**Problem.** A customer following a link to `/portal/product/PC54` (or any portal page) was bounced
to `/customer/login?next=%2Fportal%2Fproduct%2FPC54`, signed in, and landed on the portal HOME.
Same on the vendor twin.

**Root cause.** Three parties each did half the job and nobody owned the hand-off: the gate
(`requireCustomer`) put `?next=` on the login URL, `/auth/customer/verify` honoured `?next=` on the
magic link — but the login page never read `?next=` and `request-link` never put it on the link it
emailed. Both ends were "ready" and the middle was missing, so it looked wired in every code review.

**Solution.** `customer-login.js`/`vendor-login.js` read `?next=`, keep it only under their own prefix,
and post it with the email; both `request-link` routes append `&next=` to the emailed link; both
`verify` routes and both request routes validate through ONE `safeLoginNext(raw, prefix)` (same-site
path under the prefix, no `//`, no scheme, no whitespace/`<>`, ≤400 chars). Locked in
`tests/unit/customer-login-page.test.js`.

**Prevention.** A parameter that is *produced* on one route and *consumed* on another must have the
carrying hop tested end-to-end — grep every place the name appears and make sure each one is a link
in the same chain, not an island. Any redirect target that arrives from the client goes through a
single allow-list helper, never an inline `startsWith`. 🔑 Verification trap: while the Browser pane
is hidden, CSS transitions never advance, so `getComputedStyle` returns the START colour of a
transitioned property — check `el.matches(selector)` / `getAnimations()` before calling a rule broken.

## 2026-09-05 — Vendor portal showed "Unable to load jobs" on EVERY load since launch (`v2026.09.05.28`)

**Problem.** The red error banner on `/vendor` was visible all the time — including when jobs loaded
fine — since the portal shipped (2026-07-19). Nobody reported it; Ed presumably read past it.

**Root cause.** `<div id="vp-error" class="vp-error" hidden>` relied on the browser's default
`[hidden] { display: none }`, but `.vp-error { display: flex }` is an AUTHOR rule, and any author
rule beats the UA stylesheet regardless of specificity. Same for the `.vp-btn { display: inline-flex }`
Retry button. The controller dutifully toggled `.hidden` and it changed nothing visible. The
customer portal never hit this because its CSS declares `[hidden] { display: none !important; }`.

**Solution.** `[hidden] { display: none !important; }` at the top of `vendor-portal.css`; lock in
`tests/unit/vendor-portal-page.test.js` (rule present AND before the first `.vp-*` display rule).

**Prevention.** Every page-level stylesheet that toggles visibility with the `hidden` attribute MUST
declare `[hidden] { display: none !important; }` itself — the moment any hidden-able element gets a
class with `display: flex/grid/inline-flex`, the attribute silently stops working. When auditing a
page, read `getComputedStyle(el).display` on a `hidden` element at least once; `el.hidden === true`
proves nothing. 🔑 Verification: a JS probe of `.hidden` is a probe of INTENT, not of the pixels.

## 2026-09-05 — Customer Portals console said nobody had ever signed in (141 invites, "Have Signed In: 0")

**Problem.** The staff console's "Have Signed In" tile read 0 and every "Last Sign-In" cell read
"Never" for all 141 invited customers — including customers known to have used the portal.

**Root cause.** The table has a `LastLogin` column, the proxy PROJECTS it (`last_login`) and the
console RENDERS it, but nothing ever WROTE it: the customer magic-link verify route never stamped a
login, and the proxy had no `customer-portal-access/touch-login` route — the vendor portal got both
(2026-07-19) and the customer side was never mirrored. Three layers displayed a field with no writer.

**Solution.** Proxy `POST /api/customer-portal-access/touch-login` (mirrors vendor); app
`/auth/customer/verify` calls it fire-and-forget after setting the cookie. Locked in
`tests/unit/customer-portal-admin-page.test.js` (server call + proxy route, cross-repo when present).

**Prevention.** For every field a page renders, name its WRITER — if the answer is "the table has the
column", nothing writes it. A stat that reads 0 across 100% of rows is a data-plane gap, not a fact;
check for the writer before reporting it as truth. Pairs with the deep-link lesson above: a chain
(write → project → render) needs every hop, and the missing hop is invisible from either end.
🔑 History before 2026-09-05 is unrecoverable — "Never" for old rows means "not recorded", not "never".

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

