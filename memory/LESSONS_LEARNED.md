# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

## `table-layout: fixed` reads widths from the FIRST ROW, not from your `<th>` classes (2026-08-13)

**Problem.** The new per-rep Past Due print sheets came out with all 8 columns an identical
90 px despite explicit per-column width classes on the `<th>`. Customer names wrapped to two
lines, which nearly doubled sheet height (Nika: 9.7 in of a 10 in page for 23 rows).

**Root cause.** Under `table-layout: fixed` the browser derives every column width from the
**first row of the table** and ignores later rows. The first row here was the repeating rep
banner — `<tr><th colspan="8">` — which expresses no per-column width, so the engine fell back
to equal division. The width classes on the third row were never consulted.

**Solution.** Move the widths onto a `<colgroup>` / `<col>` set. `<colgroup>` outranks all rows
under fixed layout, so it works regardless of what the first row looks like.

**Prevention.**
- 🔑 **`table-layout: fixed` + any `colspan` in the first row ⇒ you MUST use `<colgroup>`.** This
  is the normal shape for a print table, because the repeating `<thead>` banner that carries the
  rep/customer name onto spilled pages is itself a full-width `colspan` row.
- 🔑 **A repeating identity row belongs in `<thead>`, not in an `<h*>` above the table.** Only
  `thead { display: table-header-group }` reprints on the next physical page. The old printout
  put the rep name in an `<h3>`, which is exactly why page 3 of Erik's 8/13 PDF was an orphan
  list belonging to nobody.
- 🔑 **Verify print layout by MEASURING, not by eyeballing.** `getBoundingClientRect()` per cell
  plus `Range.getClientRects().length` for line count found this in one pass; the rendered page
  looked plausible. Careful: an inline-block (the days-late badge) reports 2 rects without
  wrapping, so line-count alone false-positives.
- 🔴 **Harness trap:** the sheet's typography is scoped to `#pdo-print-sheet`. Cloning its
  *innerHTML* into a differently-id'd preview div silently drops every rule and renders at
  browser-default 16 px — the first measurements were 2× too tall and entirely fictional. Move
  the real node, or reuse the real id.

---

## Never forward a Content-Length you did not measure (2026-08-12)

**Problem.** Steve's "Send to Supacolor" picker answered searches with `Unterminated string in
JSON at position 476` — the browser was told the response was shorter than it was and stopped
mid-string. `/api/box/folder-files` broke the same way for folders of 5–27 files: **8 of 16 real
art folders sampled**. Live 7 days (2026-08-05→12); fixed app `v2026.08.12.1` + proxy same day.

**Root cause.** `boxForward` copied `content-length` from upstream then piped the body, but
**node-fetch asks for gzip and inflates transparently** — so the header described the COMPRESSED
bytes while the pipe sent decompressed ones. `content-encoding` was correctly NOT copied, which is
what made the length a *lie* rather than a detectable mismatch.

**Why it looked intermittent — a BAND, not a threshold.** Corruption needs uncompressed ≥ 1024 (so
the proxy gzips) AND gzip < 1024 (so our own `compression()` declines to re-compress and leaves
the bogus header). Below the band the proxy sends plaintext; above it `compression()` strips the
header and goes chunked — accidentally correct. **Small is safe by being small, huge by being
huge, and every picker lives in the broken middle.** Search caps at `limit=20`, so it could never
reach the size that recovers: 14+ hits always failed, ≤13 always worked.

**Solution.** Stop copying `content-length` in `boxForward`, `boxForwardWrite` and the proxy's `jotform.js`; let Node frame the response.

**Prevention.**
- 🔑 **Do NOT gate the copy on `content-encoding` being absent.** That works for
  node-fetch/undici, but **axios DELETES that header after inflating while keeping the stale
  length** (measured: 47 on a 3008-byte stream), so the conditional form is unwritable in the
  proxy. Portable rule: **only ever set a length you computed from the bytes you are about to
  write.** Sweep: 5 `.pipe(res)` sites across both repos, these two the only offenders.
- 🔑 **The obvious source-grep lock is VACUOUS.**
  `not.toContain("upstream.headers.get('content-length')")` would have been GREEN all week — that
  literal never existed; the code reads `.get(h)` in a loop. Both tests instead PARSE the real
  array/handler out of source and drive it through a live HTTP round trip.
- 🔑 **An express+`compression()` upstream CANNOT reproduce this** — it removes Content-Length
  when it gzips, so the harness passes against the bug. Use a raw `http.createServer` writing
  `Content-Encoding: gzip` AND a gzip-sized `Content-Length` by hand.
- 🔑 **Test the BAND** — one small + one large payload both pass while broken. Assert the
  predicate and guard that the sizes straddle it.
- ⚠️ Worse than truncation: with keep-alive the surplus bytes are parsed as the next response and
  the connection desynchronises (`HPE_INVALID_CONSTANT`).
- ⚠️ `application/octet-stream` is compressible in the app's mime-db 1.54.0 but not the proxy's
  1.52.0 — a routine proxy `npm install` would have started **silently corrupting small `.DST`
  downloads** (a bad stitch file, not a visible error). Closed permanently by the same change.
- ⚠️ `git blame` misleads: the loop arrived in `76b6aa85`, a commit about content-hashed caching.
- Locked by `box-forward-content-length.test.js` + `jotform-file-content-length.test.js`, both
  verified to go red when the bug is reintroduced.

---

## A prefix gate covers its prefix and nothing beside it; Origin is not auth (2026-08-11)

**Problem.** `GET /api/mockup-notes/:id` and `GET /api/mockup-versions/:id` answered a bare
anonymous curl with AE note text, author emails, thread colours and Box file ids. Separately,
`curl -H 'Origin: https://www.teamnwca.com'` returned `Company_Name`, `Id_Customer`,
`Work_Order_Number` and `AE_Notes` — 500 rows a time from the list route.

**Root cause.** Two different holes wearing one costume. `src/routes/mockup-routes.js` is ONE
router serving FOUR PII prefixes, and the 2026-07-04 fix gated `app.use('/api/mockups', …)` —
a path-prefix gate, so the three sibling prefixes were never covered. And the gate it did have
was `secret-OR-browser-Origin`, which accepts a header the caller supplies.

**Solution.** Every prefix gated, reads secret-only, with an app-side session-gated forwarder
(`mockupForward`) so browsers authenticate by SAML cookie and only the server holds the secret.
`guardReadsOnly` throughout — the customer approval view writes these same paths with no staff
session. Locked in both repos; the app-side test greps browser JS for cross-origin GETs.

**Prevention.**
- 🔑 **A prefix gate secures exactly its prefix.** Ask what OTHER prefixes the router serves —
  derive the list from the router source in a test, so a new prefix fails until someone makes an
  auth decision about it. Third time this shape has bitten (four gated sub-prefixes on `/api`,
  the Box family, now this).
- 🔴 **`Origin` is a CSRF signal, never an authentication one.** It is caller-controlled: one
  curl flag impersonates any allowlisted browser. "secret-or-origin" reads like defence in depth
  and is really just "or".
- 🔑 **Check the sibling that looks like plumbing.** `mockup-notifications` looked like transient
  toast machinery; each entry carries `companyName` + `designNumber`, and it filters by `?user=`
  only when that param is *supplied*, so an anonymous poll with no user returned everything. It
  is in-memory and usually empty, which is exactly why it read as harmless.
- 🔴 **Gating reads changes who can still call it server-side.** `send-ruth-digest.js` scans via
  `localhost/api/mockups/broken-mockups` — loopback still goes through Express, so without the
  secret the nightly digest 401s and reports *nothing broken*. Grep for internal callers,
  including ones that look local.
- 🔑 **Moving a call same-origin moves it under the app's rate limiter.** These reads bypassed the
  200-req/15-min `/api/` bucket while they were cross-origin; a 30 s notification poll now counts
  against a ceiling the whole office shares behind one egress IP.
- 🔑 **A content-hashed page serves `dist/`, not your edit** — art-hub-ruth kept calling the proxy
  after the fix because the browser had `mockup-ruth.c1a6c72b6a.js`. Run `npm run build` and
  confirm the HASH changed before believing a dashboard behaves the old way.
- 🔑 **`EADDRINUSE` means you just tested the OLD code.** A restart that silently failed to bind
  left the previous process serving, and the first "verification" showed the pre-fix behaviour.
  Read the startup log, not just the response.

---

## An ungated shell over gated assets tells the user the wrong story (2026-08-11)

**Problem.** Ruth: "I can't see any images, the screen is completely dark." Her mockup detail page
showed a black overlay reading *"Image could not be loaded — link may have expired"*, a red
*"Failed to load Box files"*, and an anonymous `IMG` badge — while Ruth's Fields, the notes and the
slots all rendered perfectly. Nothing was broken and no link had expired: **she was signed out.**

**Root cause.** Two halves of the same page authenticate differently. The record, notes and versions
load **anonymously** from the proxy (`mockup-detail.js:336-352`), so the page renders fully. Every
Box asset goes through the app's same-origin forwarders (`server.js:3809-3817`), all `requireStaff`,
so all of them 401. And `/mockup/:id` (`server.js:5192`) was registered with **no gate at all** —
unlike `/art-hub-ruth.html` five lines above it — so she was never bounced to SSO. The staff session
is `cookie-session` with **no `maxAge`** (`server.js:786-792`): it dies when the browser closes, so
this is reached routinely, not after some long idle. "Expired" was impossible by construction.

**Solution.** `gateStaffDetailPage` on `/mockup/:id` and `/art-request/:designId`, exempting
`?view=customer` (external approval links carry their own capability token and cannot complete staff
SSO). Client side, `mockup-detail.js` now branches on the real HTTP status — 401 → "You're signed
out" + a `/auth/saml/login?next=…` link in both a page banner and the lightbox label; 502/503 →
"Box service is temporarily unavailable". An `<img>` error carries no status, so the lightbox
HEAD-probes to recover one. Locked by `tests/unit/detail-page-gate.test.js`.

**Prevention.**
- 🔑 **If a page's shell and its assets have different auth requirements, the weaker one sets what
  the user sees.** Anonymous data + gated images = a page that looks healthy and is useless. Gate
  the shell at the same level as its most-protected dependency, or the failure is silent.
- 🔴 **Never let an error string assert a cause the code cannot know.** An `<img>` error event has
  no status, so "link may have expired" was a guess — and it was wrong in the common case, sending
  the diagnosis toward Box and expiry instead of toward a missing cookie. Probe for the status, or
  say only what you know.
- 🔑 **A 401 that renders as a generic broken-file badge is unactionable.** `handleBoxImageError()`
  branched on 404 only; every other status fell to the same anonymous placeholder. The page had
  **zero** references to `401`, `loginUrl` or `auth/saml` — nothing to click.
- 🔑 **"Only one person is affected" can mean "only one person is signed out."** These routes gate on
  session *presence*, not role, so no registry/allowlist entry could have caused it — which ruled
  out the whole `Ruthie`-vs-`ruth@` family of causes before any code was read.
- 🔑 **Verify a suspected auth hole with a CLEAN client.** A browser fetch returned 200 for a Box
  endpoint while `/api/crm-session/me` said `authenticated:false` — which looked exactly like an
  anonymous data leak. It was `Cache-Control: private, max-age=300` replaying the earlier
  authenticated response. `curl` with no cookie returned 401 and killed the false positive.
- 🔑 **`/api/crm-session/me` is the cheap "are you actually signed in?" test** — 200 either way, safe
  to paste into the address bar, no redirect. Reach for it before theorising.

---

## A new lead source saved fine and stayed invisible — the form-ID vocabulary lives in 12 places (2026-08-10)

**Problem.** A customer's free sample request (`NWCA-SAMPLE-0808-1-480`, Inland Beef Company)
reached Erik's inbox and nowhere else. Erik: "shouldn't it be in Leads so Taneisha can follow up?"

**Root cause.** The free branch of `/sample-cart.html` pushed a ShopWorks order and fired two
EmailJS sends — and wrote **no database row at all**. Leads reads exactly one table
(`Form_Submissions`) filtered to a hard-coded list of lead `Form_ID`s, and the cart called neither
of that table's writers. The dashboard's "Sample Follow-ups" widget *looks* like the safety net but
filters on `date_Invoiced`, so it can only show samples already invoiced — a post-sale call
list, not an inbox. No dashboard surface reads uninvoiced ShopWorks orders at all.

**Solution.** New `sample-request` formId, POSTed from the cart to the already-public
`POST /api/form-submissions` — which buys AE auto-assign (email match → their rep, else
Taneisha), the "new lead" email and the Slack card for free. Full site list + fix detail:
`memory/sample-request-routing.md`.

**Prevention.**
- 🔑 **The lead form-ID vocabulary is duplicated in 12 places across 2 repos.** Adding a
  source means updating all of them; miss one and the row saves but stays invisible.
- 🔴 **A missing map entry becomes a WRONG DEFAULT, not an error.** No `STATUS_CHOICES`
  entry → the Forms Inbox falls back to `['New','Completed']`, and `Completed` is a **WON**
  status (`leads-common.js:40,50`) → closing the lead banks a $0 win and drops it from the
  follow-up digest. Same family as `[]`-is-truthy and `Number(null) === 0`.
- 🔑 **Derive a filter list from the canonical constant, never re-type it.** `leads.js`
  built its Source dropdown from a literal that *happened* to equal `LEAD_FORM_IDS` minus
  `jotform-lead`; the 6th id broke that invariant silently.
- 🔑 **A payload only "saves" if a renderer knows its shape.** The Inbox renders only
  `fields`/`checks`/`tables`/`notes` — a bespoke object stores fine and shows a blank modal.
- 🔴 **`House` is a dropdown DEFAULT, not a rep.** Sending it satisfies the server's
  "rep already set" check, suppresses auto-assign and leaves the lead owned by nobody — the
  exact failure the change existed to prevent. Send blank and let the server assign.
- 🔑 **A content-hashed page serves `dist/`, not your file.** The preview runs
  `node server.js` (no `prestart`), so the browser executed a stale asset and the new function read
  as `undefined` — indistinguishable from a scope bug. Run `npm run build`, then confirm the
  asset HASH changed.
- ⚠️ 3 of the 4 review defects were on STAFF surfaces the customer path never touches:
  the customer flow was right on the first pass, the staff rendering was not.

---
## A sum-based gate passes vacuously on a document that has no sums (2026-08-10)

**Problem.** Erik uploaded the one-page "Available Vacation And Sick Time" report to the payroll
uploader. It read fine — 21 employees — and the reconciliation gate returned **`passed=true`**,
enabling *Save to payroll records*. Saving would have written 21 `Payroll_Register` rows with every
hour and wage 0, `Paid_This_Period=false`, under a check date the model had to guess: a pay period
that never happened, permanently in the Pay Periods tab.

**Root cause.** `reconcile()` ran 7 checks, 4 of them money/count (gross, net, deductions, check
count). A leave-only page prints none of those. The extraction schema marked them `required`, so the
model returned 0; the gate compared **0 to 0** and called it a match. The gate reported success having
verified nothing. Only the 3 vacation checks did real work.

**Solution.** An explicit `mode` on `POST /parse` — `'packet'` or `'leave'`, rejected if it is
anything else, never inferred. Leave mode uses its own schema (no money field exists to zero out),
its own prompt, and `reconcileLeave()`, which checks all six leave columns against the report's own
`Total:` row. Leave mode writes only the `Employees` leave columns — no register row, no `Pay`.
`tests/jest/payroll-leave-reconcile.test.js` locks it with the real 21-row page.

**Prevention.**
- 🔑 **A gate that compares derived to printed is only as strong as the printed side being NON-ZERO.**
  Assert the reference values exist before trusting the verdict. `expect(checks.every(c => c.printed
  !== 0))` is the whole lesson in one line.
- 🔑 **"Required field" + "figure isn't on the page" = a fabricated zero.** A schema cannot ask for
  something that isn't there and get an honest answer; it gets a plausible one that then sails through
  arithmetic. Give each document shape its own schema instead of one superset.
- 🔑 **Never infer which document you were handed — make the caller declare it.** Auto-detection here
  would have had to fail *safe*, and the failure mode of guessing "packet" is exactly the vacuous gate.
- 🔑 **A sum-based check is invariant to row permutation.** On a skewed photo the totals can reconcile
  while every individual row is attributed to the wrong person. Totals matching is necessary, not
  sufficient — the prompt now tells the reader to verify alignment against the ID column.
- 🔑 **Erik's "16 vacation hours" was real and the import would have contradicted it.** The report
  prints `Hrs Avail.` as a column; the importer recomputed it as accrued − used. Those differ whenever
  the report floors an over-drawn balance at zero (Taneisha Clark: 0 accrued, 16 used, printed 0, not
  −16) — the entire 16-hour gap between the 1112/796 and 332 totals. **Save the printed column, don't
  re-derive it.** Erik, asked directly 2026-08-10: *"exactly what Liesls payroll packet says"* —
  **both** paths now save it.
- 🔑 **"It's already validated" is worth one grep.** Extending the printed-column rule to the packet
  path looked like a two-line edit because `reconcile()` checks `Vacation available`. It has **no sick
  check at all** — `PACKET_SCHEMA.printedTotals` carried only vacation, so all three sick figures had
  been reaching `Employees` unverified since the uploader shipped. Saving the printed sick column
  without fixing that would have traded a derived-but-consistent number for an unchecked one. The
  packet gate went from 7 checks to 10.
- 🔴 **Changing what a column MEANS silently broke a feature two files away — and my algebra said it
  hadn't.** `vacation-carryover.js` guarded its blocking `identity-failed` flag with *"the import
  writes Vacation_Hours_Remaining as exactly r2(accrued − used), so this check is a tautology"*.
  Switching to the printed column made that false. I reasoned it through and concluded no NEW block
  appears, because a floored row already fails `E − U` vs `A − U` **when `A < E`**. That qualifier was
  the whole problem: a new hire short of their anniversary has the entitlement forced to **0**, so
  `A = E = 0`, the carryover clamp is **inert**, and the old check passed *exactly* (−16 vs −16).
  Taneisha's slip printed before the change and was blocked after it. **Erik caught it by asking
  "will the print still work" — nothing in 1490 passing tests did.**
- 🔑 **When you change an invariant, RUN the dependent code over real rows — don't reason about it.**
  The module was already Node-requireable with 63 tests; a 20-line script over the actual figures,
  old value vs new, showed `printable: true → false` in one line. Algebra with an unexamined case
  reads exactly like algebra without one.
- 🔑 **A relaxed check needs the narrow shape, not a looser threshold.** The fix splits the one
  comparison into the entitlement algebra (`slip.accrued − slip.used` vs `available − used`) and the
  import's self-consistency (`remaining` vs `available − used`), and exempts ONLY over-drawn-and-
  printed-as-exactly-zero. Both original guards still block — including `remaining: 999` and a
  `remaining: 0` on a row that is not over-drawn, which a sloppier exemption would have waved through.
- 🔑 **A QA harness must cache-bust the files it is testing.** The browser served a stale
  `vacation-carryover.js` and the harness confidently showed the OLD blocked slip after the fix was
  already on disk. A harness that can show you yesterday's build is worse than no harness.

---
