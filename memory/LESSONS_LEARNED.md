# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

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
## Two note endpoints write the same table; only one of them tells anybody (2026-08-07)

**Problem.** The AE "Approve Design" button on `/art-request/:id?view=ae` fired a native
`confirm()` and collected no free text, so anything the AE wanted Steve to know had to go
through a separate `+ Add Note` afterwards. Adding an optional note box meant picking a
route for it.

**Root cause / the trap.** The page has TWO note endpoints that look interchangeable and
are not:
- `POST /api/art-requests/:designId/note` (proxy `src/routes/art.js:1436`) — writes
  `DesignNotes`, **no fan-out, and no length validation at all**.
- `POST /api/design-notes` (`art.js:760`) — writes the **same table with the same fields**,
  plus direction-aware Slack + email. `Posted_By_Role:'ae'` routes the primary email to
  Steve at `art@nwcustomapparel.com`; `notify:false` short-circuits the whole fan-out
  before any lookup.

So `/api/design-notes` is a strict **superset** — swapping to it is one row, not two. The
tempting wrong move is to keep the thin call and *add* a design-notes call for the Slack
ping; that duplicates the timeline row.

**Solution.** Swap the approve step to `/api/design-notes` with `notify: !!typedNote`, so a
blank note behaves byte-identically to before (Steve still gets `template_art_completed`
+ the dashboard push, and gains no third ping) and a typed note reaches him.

**Prevention.**
- 🔑 **Before adding a second call to get a side effect, check whether the endpoint you are
  already calling has a superset sibling.** Two routes writing one Caspio table is the norm
  in this repo, not the exception.
- 🔴 **The status write commits BEFORE the note write and is never rolled back.** A rejected
  note leaves the record `Approved` in Caspio while the UI shows "Error — retry", and a
  retry re-fires the status write, the note, the EmailJS to Steve and the dashboard push.
  Free text is the first input that can realistically trigger it — hence `maxlength="2000"`
  on the textarea *plus* a JS length guard (maxlength does not apply to a programmatic
  `.value` set).
- 🔑 **`approveDesign()` never called `refreshNotes()`.** Tolerable for an auto-generated
  status line, invisible-looking for a note the user just typed. If a write is user-authored,
  the surface that displays it must refresh in the same success block.
- 🔑 **`.onclick =` beats `cloneNode`/`replaceChild` for re-openable modals.** Property
  assignment is idempotent; the clone trick used by `openChangesModal()` also copies the
  reflected `disabled` attribute and `innerHTML`, so a modal closed mid-error reopens dead.
  `openCustomerReviseModal():4344` additionally leaks one overlay listener per open.
- 🔴 **A namespaced export reads like a global at the call site — and the ReferenceError
  landed INSIDE a `.catch()`, so it soft-locked the modal (FIXED 2026-08-07).** Three sites in
  `pages/js/art-request-detail.js` called a bare `showToast(...)`. It is defined only as
  `window.TransferActions.showToast` (`transfer-actions-shared.js:593`, inside that file's
  IIFE), so a bare reference threw — proven at runtime: `TransferActions.showToast` is a
  `function` while `window.showToast` is `undefined` and `showToast` alone throws
  `ReferenceError`. Fixed by switching all three to the page's own `showArdToast()`.
  - 🔑 **The upload-failure one was in a `.catch()` handler, so the two lines AFTER it never
    ran** — `btn.disabled = false` and `btn.textContent = 'Submit Revision Request'`. A failed
    upload left Submit permanently disabled reading "Uploading N files…". Compounded by the
    `cloneNode` bug above: reopening the modal clones the *disabled* button, so the flow stayed
    dead. **An error handler that can itself throw converts a visible failure into a soft-lock.**
  - 🔑 The two size/count guards threw *before* their `return`, so they rejected the file by
    accident while aborting the caller's loop — remaining dropped files were silently skipped.
  - 🔑 **Prevention: prefer the page's own helper over one that "seems" global.** Grep for
    `function <name>` AND `window.<name>` before calling — a helper exported as
    `window.NS.<name>` is not in scope, and nothing in a browser fails at load time to tell you.

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
