# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

### Bonus hero dial + CTA wrap-hole (2026-09-01, ARCHIVED 2026-09-03): variable-width money never lives inside a fixed ring (ring holds the %, dollars beside it); flex-wrap breaks lines on MAX-CONTENT width, not post-shrink width — give the sibling `flex:1 1 0`. Full entry in archive.
## First real custom-tees order: proforma hid data the session already had; ShopWorks dates were UTC days (2026-09-01)

**Problem.** Real paid order DTG0831-2727 ($68.99 CC, ship Eugene OR): the pre-import
proforma (`/invoice/:id`) showed Ship To "—", REQ SHIP DATE "—", Bill To with no street,
and "2 @ $29.50 = $61.00" (doesn't foot). ShopWorks also recorded the order/payment as
08/31 though the customer paid Sun 8/30 7:38 PM Pacific.

**Root cause.** (1) invoice.js only read `pushed.ShippingAddresses` (exists post-import)
or `originalSubmission.ship` (quote-builders only) — storefront orders keep the address in
the flat `CustomerDataJSON`/`OrderSettingsJSON` session columns it never parsed. (2)
Storefront quote_items store the BASE-size price in `FinalUnitPrice` with extended-size
upcharges only in `LineTotal`, and `SizeBreakdown` was never rendered. (3) The push stamped
`new Date().toISOString()` = the UTC day — every order after ~5 PM PT dates +1 in ShopWorks.
Also: `″` (U+2033) in push notes → "?" (ManageOrders is cp1252); `requestedShipDate` was
never sent though the proxy supports it and `shipPromise.iso` is stamped at checkout.

**Solution.** invoice.js: lazy `storefrontCustomerData()/storefrontOrderSettings()` blob
parsers feeding Ship-To/Bill-To/req-ship-date fallbacks; blended unit price when
unit×qty ≠ LineTotal + render SizeBreakdown; `parseDateSafe()` so bare `YYYY-MM-DD` renders
local, not UTC-shifted a day early. server.js push: `orderDate`/payment `date`/samples dates
= `nowPacificNaiveIso().split('T')[0]`; send `requestedShipDate: shipPromise.iso`; `″`→" in".

**Prevention.** A "blank" field on a pre-import surface is usually a READER gap, not missing
data — check the session's JSON blob columns before touching the push. Any date written to
ShopWorks/Caspio must be the PACIFIC day (`nowPacificNaiveIso()`), and any bare date STRING
rendered in the browser must not go through `new Date('YYYY-MM-DD')`. Push text stays cp1252.

**Post-import follow-ups (2026-09-01, hand-linked as WO 142999).** The session was stuck in
`Payment Confirmed` because the webhook's Processed PUT failed on 8/30 — the hourly bulk-sync
only touches PROCESSED quotes, so a stuck session NEVER self-links; the fix is a manual
`POST sync-from-shopworks` with the WO#. Two invoice nits fixed the same day: `parseDateSafe()`
treats ManageOrders' `T00:00:00.000Z` date-only shape as a calendar day (req-ship rendered Sep 3
instead of Sep 4), and Bill To prefers the storefront checkout's CustomerDataJSON identity/billing
over the catch-all-2791 record — Erik's rule: the invoice bills the BUYER even though storefront
orders land on the catch-all customer.

### An audit reported a clean manifest as 26 missing POs (2026-08-26, ARCHIVED 2026-09-02): a check must distinguish "I looked and it isn't there" from "I never looked" and SAY WHICH — refresh the arrival span itself, compare mirror lastSync <= manifest date, and a failed fetch marks the run INCONCLUSIVE, never missing. Full entry in archive.
### curl from git-bash mangled em dashes into U+FFFD (2026-08-25, ARCHIVED 2026-09-01): non-ASCII Caspio writes go through Python `ensure_ascii=True`, never a git-bash curl body; verify stored text with `ascii()` on a re-read. Full entry in archive.
### A customer's real size request was shown to nobody (2026-08-19, ARCHIVED 2026-08-27): render every field you persist — a saved-but-unshown field is data loss with extra steps. Full entry in archive.
### SAM quotes rendered “No items” (2026-08-19, ARCHIVED 2026-08-27): a channel that opts out of a shared fix re-inherits the bug it fixed; SW-snapshot overlay repaints EXISTING rows only. Full entry in archive.

### Staff dashboard full review — 5 UTC/Pacific bugs on ONE page + the error renderer silently no-oping (2026-08-26, ARCHIVED 2026-09-01): calendar-day math never via toISOString()/new Date("YYYY-MM-DD")+local getters; register the ERROR_AREAS entry in the same commit as showApiError(); clone a deduped fetch Response per caller; derive quote prefixes from config, never a hand list. Full entry in archive.
### Quote data plane locked down — 44 caller files, 2 repos (2026-08-26, ARCHIVED 2026-09-02): a gate you cannot flip without a deploy ships scared — mode-switch by config var (off→log→enforce); migrate by ENDPOINT grep never a base swap; a relay must forward the query string verbatim; postures jest-locked in both repos; stage explicit file lists, never `git add -u`, on a shared checkout. Full entry in archive.
### Staff-dashboard hardening — PII roster, proxy-direct reads, auth embed (2026-08-26, ARCHIVED 2026-09-03): a staff page gate is `.html`-only, so secrets live in `lib/` behind a route (`lib/staff-roster.js` → `GET /api/staff/employees`); identity = `/api/crm-session/me` (returns `role`), never a third-party auth embed; every proxy-direct read from a staff page is relayed same-origin so the quote-plane gate covers it. Full entry in archive.
### /inventorylevels leaked wholesale cost + supplier anonymously (2026-08-27, ARCHIVED 2026-09-03): an anonymous route that must stay open for one public caller gets a field PROJECTION (`INVENTORY_PUBLIC_FIELDS` whitelist), not a gate; jest-lock the projection red-first. Full entry in archive.
## 2-minute proxy outage: the commit shipped half the change, and the boot probe tested the other half (2026-08-27)

**Problem.** Deleting the legacy box-labels routes crashed the proxy dyno on deploy (H10 on
customer pricing calls, ~2 min until `heroku releases:rollback`). The slug had the route FILE
deleted but `server.js` still `require`d it — `Cannot find module` on boot.

**Root Cause.** Two failures stacked: (1) `git add <deleted-file> <edited-files>` — the first
pathspec matched nothing (the file was already staged by `git rm`), and **git add ABORTS the
whole command on a bad pathspec, staging NONE of the later files**; the commit went out with
only the `git rm`. (2) The local boot probe passed because it ran against the WORKING TREE
(which had the server.js edit), not against what was committed — the exact gap between "my
checkout works" and "the commit works".

**Solution.** Rollback restored production in seconds; the missing edit was committed with the
staged diff INSPECTED (`git diff --cached` shows the require removal), boot-probed with
`tree == HEAD` asserted first, and redeployed clean (proxy `v2026.08.26.6`). Legacy routes now
404 live; the repack station's `/api/sanmar-orders/label-data` unaffected.

**Prevention.**
- 🔴 **Never combine pathspecs in one `git add` during a delete+edit change.** One `git add`
  per file, then `git diff --cached --stat` MUST list every file you meant to ship — read it
  before committing. An already-`git rm`'d path in the list is the trap that aborts the rest.
- 🔴 **A boot probe is only honest when `git status --porcelain` shows no tracked dirt** —
  otherwise it verifies the working tree, not the commit that deploys. Assert clean, THEN probe.
- 🔑 **Delete a module and its require in the SAME commit, verified in the same staged diff.**
  The app-side twin of this change survived because its deletion was a single-file block edit.
- 🔑 The rollback playbook worked exactly as written: slug rollback in seconds, fix landed
  forward through the normal gated path — no hand-pushes, no `--no-verify`.

### Top Sellers "flickers blank, refresh fixes it" (2026-08-26, ARCHIVED 2026-09-02): "works after refresh" = a cold query behind a response cache — time the UNCACHED path first; variant-heavy `limit=48` pages hydrate 10k rows, so partition STYLE IN chunks in parallel; `?isTopSeller=1` is silently ignored (route wants `true`) — validate the result set before trusting a timing. Full entry in archive.
## Customer portal redesign + reward-dollar accrual — the self-service portal, and money that must never be computed silently (2026-09-01)

**Problem.** The portal was four tabs on one scroll: logos/invoices/orders existed but a customer
could not approve a proof, download a logo, see tracking, print a statement, ask for a quote, or
see their quotes without emailing the rep. Reward dollars were hand-granted with no rule.

**Solution.** App-shell redesign (sidebar spine + attention list + order drawer + statement +
quotes + account) on the SAME allowlist endpoints, plus `/api/portal/me`, `/quotes`,
`/order/:no/tracking`, `POST /api/portal/request` (general requests into the existing rep queue),
and a reward ACCRUAL: garment lines on invoiced+paid orders in a 12-month window × a rate per
SanMar piece-cost band, bands Erik-editable in Service_Codes (`REWARD`/`RWD-EARN`), posted from
the admin console one grant per order keyed by Order_Ref. Detail → `memory/CUSTOMER_PORTAL_2026-09.md`.

**Prevention / lessons.**
- 🔴 **Credit that a customer can redeem is money: no default rate, ever.** With no config rows the
  calculator returns configured:false and $0 with every line annotated — the ONE fallback that
  must be a visible refusal, not a "reasonable" 1%. Locked by `portal-reward-accrual.test.js`.
- 🔴 **"Paid" needs a known balance.** `cur_Balance` can be null in ManageOrders; null ≠ 0. Paid =
  `sts_Paid==='1'` OR a KNOWN zero balance on a non-zero invoice; `cur_TotalInvoice=0` rows
  (`sts_Paid='8'`) never earn.
- 🔑 **Idempotency by Order_Ref, recompute on post.** The console shows a breakdown, but the POST
  recomputes server-side and grants only `reward − already granted` per order — a stale tab or a
  double-click cannot double-pay, and client amounts are never trusted.
- 🔑 **Verify a money calculation against LIVE data with the program INJECTED** before any config
  exists: lift the block out of server.js, stub its four helpers, run it for one customer, read
  every line. That turned "looks right" into $58.08 with the cost and band on each line.
- 🔑 **A page that shares a stylesheet is a hidden consumer.** `customer-product.html` links
  `customer-portal.css`; a full rewrite still had to keep every legacy `--cp-*` token as an
  alias and the .cp-header/.cp-swatch/.cp-size/.cp-btn blocks. Grep the class list before rewriting.
- 🔑 **Screenshots of an emulated phone can be a cropped 3× render** — measure
  `scrollWidth`/`getBoundingClientRect` before "fixing" an overflow that isn't there.
- 🔑 **Locally, a staff session is a cookie-session cookie signed by keygrip over `name=value`**
  and a customer session is `lib/customer-magic-link.mintSession()` — both mintable from .env
  secrets, so gated routes and the preview console can be exercised without SAML.
- 🔴 **The proxy's ManageOrders limiter is ONE 30-requests/minute bucket per IP — the whole
  dyno shares it.** `Promise.all` over 25 line-item calls trips it and `portalFetchJson` returns
  null, which downstream reads as "no lines" (a 630-order web-store account lost every line).
  Pace ManageOrders fan-outs (~2.2 s apart), cache immutable results (invoiced+paid line items),
  bound each request under Heroku's 30 s H12 and return `partial` + progress. ⚠️ `buildMyProducts`
  still fans out 25 in parallel — same latent bug.
- 🔑 **Scope a money program to the orders it is FOR.** GOLD accounts looked like 600 orders/yr
  until ORDER_ODBC showed 95% were Inksoft web-store purchases by employees. Excluding them made the
  accrual tractable AND correct; a config row (`RWD-WEBSTORE`) can bring them back deliberately.
- 🔑 **Caspio `Service_Codes.Notes` is Text-255** — a longer note 400s as "doesn't match the data
  type", which reads like a schema error, not a length error.
- 🔑 **The Heroku CLI session can expire mid-session while git pushes keep working** (git uses the
  long-lived deploy token, the CLI uses its own ~14-day token). Symptoms: `heroku releases --json`
  returns EMPTY (my poll loop parsed nothing 40 times) and `config:set` asks for a browser login with
  `setRawMode is not a function`. Verify a release with the app's `/api/version` (or the proxy's
  `/api/health` + a live probe of the new route), and set config vars through the Platform API:
  `curl -X PATCH https://api.heroku.com/apps/<app>/config-vars -H "Authorization: Bearer $(cat ~/.heroku-deploy-token)" -H "Accept: application/vnd.heroku+json; version=3" -d '{"VAR":"1"}'`.
- 🔑 **Before building a new mirror table, ask what already syncs.** I built an `ORDER_LINES` route +
  CSV export before Erik pointed at `ManageOrders_LineItems` — the daily `sync-manageorders` archive
  the rep bonuses already read. Same data, zero new plumbing. `grep -rn <TableName> ../caspio-pricing-proxy/scripts`
  (and ask) is a two-minute check that saved nothing here because it ran too late.
- 🔴 **Per-customer money JSON needs `Cache-Control: no-store`.** Express's default weak ETag let
  Chrome answer a fresh portal load from its own copy and show a customer their PRE-grant $0
  balance minutes after $97 had posted — the API returned 97 to curl the whole time. Any route
  whose body changes because of a write elsewhere (balances, ledgers, statuses) sets no-store;
  now done for every `/api/portal*` route in one middleware.
- 🔑 **A mirror pulled by ORDER DATE goes stale for anything reopened later.** The 60-day
  ManageOrders pull never revisits a March order re-invoiced in September. Two guards, both cheap:
  the engine compares archived Σ(qty×price) to the LIVE `cur_SubTotal` it already holds and refetches
  on a mismatch; the sync compares the archive to `ORDER_ODBC` (delta-synced by modification stamp,
  any age) and re-pulls mismatches. Neither needs a modification column the archive does not have.
- 🔑 **Money that was granted is a policy question, not a math one.** Erik: never claw back
  automatically — but a zeroed $4,000 order must not keep its reward. Engine reports `overGranted`
  (never a negative pending); a staff **Reverse** posts −min(over-grant, unspent balance). Per-order
  `adjust` entries net against grants; only `redeem` counts as spent.
- 🔴 **The proxy pre-push hook only lets `Release v…` / `Changelog v…` subjects onto main.** A
  hand-typed "Release: …" merge was refused 4× and the force-push to undo it was (rightly) blocked —
  follow `.claude/skills/deploy/SKILL.md` Steps 6-11 verbatim (commits captured BEFORE the merge,
  `Release vTAG`, CHANGELOG commit, tag, push) even when hand-rolling.
- 🔴 **Never put a multi-line text with backticks inside a double-quoted `node -e "…"` in bash** —
  every `` `word` `` runs as a command and vanishes from the text (this entry was written twice).
  Write the script to a file, or use a single-quoted heredoc.

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

