# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

## Releasing from a SHARED checkout: excluding a file cuts both ways (2026-08-04)

**Problem.** Deploying the Embroidery Studio, the release also carried
`quote-builders/monogram-form.html` â€” a parallel session's WIP that another session's
`git add -A` had swept into `baafe9f3`. Shipping it would have put a **dead "Print Customer
Proof" button** in front of reps (its controller/CSS were still in review on develop). Two
further traps followed: `git checkout main` **aborted** because the shared tree was dirty with
three sessions' edits, and the develop sync-back **silently reverted** the WIP the release had
deliberately excluded.

**Root cause.** A shared working tree makes branch-level operations sweep in work whose owner
isn't in the room. And a merge that restores a file to main's version encodes "main's copy
wins" â€” merging that commit back into develop faithfully replays the deletion.

**Solution.** Cut the release at *my* verified sha in an isolated `git worktree`
(`git merge --no-ff --no-commit <sha>` â†’ `git checkout HEAD -- <foreign file>` â†’ commit with the
exclusion stated in the message), then on the sync-back re-take develop's copy
(`git checkout origin/develop -- <file>`) before pushing.

**Prevention.**
- ðŸ”‘ **Never `git checkout <branch>` in a shared checkout â€” release from a `git worktree`.** Also
  put that worktree at a SHORT path: `/Temp/nwca-rel` worked where the session scratchpad path
  blew Windows MAX_PATH on a deep blog filename ("Filename too long", `Could not reset index`).
- ðŸ”‘ **Every file-level exclusion needs a matching restore on the merge-back**, or the release
  silently deletes the work it was protecting. Verify with `grep` for a marker from the WIP
  *before* pushing the sync â€” not after.
- ðŸ”‘ **Deploy the dependency first and prove it with a live probe**: the box-labels page needed
  proxy `/api/sanmar-orders/label-data` â€” curl'd for HTTP 200 (and absence of `ContactEmail`)
  before the app slug went out.

---

## `el.hidden` doesn't hide a flex element â€” and asserting the property hides the bug too (2026-08-04)

**Problem.** On the contract calculator's DST card, `el.hidden = true` left three elements fully
visible: the drop zone stayed on screen *under* the loaded file card, and two empty note rows
rendered inside the card as stray dashed-bordered strips whenever no note applied.

**Root cause.** `[hidden] { display: none }` lives in the **UA stylesheet**, so ANY author
`display` declaration beats it regardless of specificity â€” and `.dst-drop` / `.dst-note` /
`.dst-suggest` are all `display: flex`. Elements with no author `display` (the card, the error,
the buttons) hid correctly, which is exactly why it looked like the pattern worked.

**Why the first verification pass missed it.** The browser check asserted `el.hidden` â€” the
**property** â€” which is just reading back the attribute that was set. It is true whether or not
the element is visible. Only `getComputedStyle(el).display` answers the actual question.

**Solution.** Attribute-qualified rules, which outrank the plain class rule:
`.dst-drop[hidden], .dst-note[hidden], .dst-suggest[hidden] { display: none; }`

**Prevention.**
- ðŸ”‘ **Any component that sets both a `display` and `[hidden]` needs an explicit
  `.thing[hidden]{display:none}`** â€” assume the UA rule loses.
- ðŸ”‘ **Verify visibility with `getComputedStyle().display` / `getBoundingClientRect()`, never
  the `.hidden` property or a class check.** Asserting the input you just set proves nothing;
  assert the rendered consequence.
- ðŸ”‘ An adversarial review pass caught this after a "passing" browser pass. When a verification
  result is a tautology, it will pass forever.

---

## A corrupt file that "parses" becomes a silent wrong price â€” DST has no magic bytes (2026-08-04)

**Problem.** Browser-verifying the contract calculator's new DST drop zone: 2,000 bytes of
arbitrary garbage named `.dst` didn't error â€” it "decoded" into ~500 nonsense stitches, silently
replaced the previously loaded file, and priced the order at the 8K contract minimum.

**Root cause.** Tajima DST has no file signature: ANY 3-byte record decodes into *some* stitch
delta. `dst-parser.js`'s only guardrails were "file too small" and "zero stitches decoded" â€”
tuned for the Embroidery Studio VIEWER, where garbage is self-evident as noise on the canvas.
On a PRICING surface the same parse produces a plausible number with no visual to contradict it.

**Solution.** Calculator-side validity gate (`embroidery-contract.js handleDstFile`): every real
DST declares its record count in the `ST:` header â€” refuse loudly when it's 0 or disagrees with
the decoded record total by >25%.

**Prevention.**
- ðŸ”‘ **A parser succeeding â‰  the input being valid. For signature-less formats, cross-check an
  internal redundancy** (declared vs decoded counts) before trusting the result with money.
- ðŸ”‘ **The same parse carries different risk per surface**: viewer â†’ garbage renders as visible
  noise; calculator â†’ silent wrong price (Erik's #1 rule). Reused code inherits the validation
  needs of its STRICTEST consumer.
- Verify error paths with actively hostile bytes, not just wrong extensions â€” 12 green jest
  tests and a clean happy path coexisted with this hole.

---

## Monogram thread-color dropdown dead in prod: API envelope change nobody re-tested (2026-08-04)

**Problem.** The monogram form's thread-color selector had been silently broken live:
`this.threadColors.filter is not a function` on every page load. Users could still type
names, so nobody reported it.

**Root cause.** `GET /api/thread-colors` originally returned a bare array; at some point the
proxy started returning an `{success, count, colors}` envelope. `fetchThreadColors()` kept
`return await response.json()` with the comment "Returns array directly" â€” HTTP 200, valid
JSON, wrong shape. The error surfaced only in the console + a toast reps ignored.

**Solution.** Service now unwraps both shapes and **throws** on anything else
(`monogram-form-service.js` `fetchThreadColors`). Found while browser-verifying the
Stitch-Proof feature, fixed in `ced3bc2f`.

**Prevention.**
- ðŸ”‘ **HTTP 200 + valid JSON â‰  valid response â€” assert the SHAPE at every fetch boundary**
  (same family as the pricing-bundle empty-arrays-on-rate-limit lesson, v1791).
- ðŸ”‘ **When a proxy route's response shape changes, grep ALL frontend consumers** â€” the app
  and proxy deploy independently, so shape drift breaks quietly.
- ðŸ”‘ A broken feature users can work around generates zero bug reports; only a
  browser-verification pass with the console open finds it.

---

## /deploy's cache-bust silently does nothing if you pushed develop first (2026-08-03)

**Problem.** Deploying the vacation-slip work, the skill's Step 2 found **zero** changed assets
and bumped no `?v=` string â€” even though `payroll.js`, `payroll.css` and the brand-new
`vacation-carryover.js` were all in the release. Left alone, the deploy would have shipped new
JS/CSS behind unchanged URLs, so every browser that had ever opened the page would keep serving
the cached old files.

**Root cause.** Step 2 detects changed assets with
`git diff --name-only origin/develop HEAD` plus the dirty working tree. Both are empty in the
**normal** workflow â€” commit your work, `git push origin develop`, *then* `/deploy`. Once
develop is pushed, `origin/develop == HEAD`; once it's committed, the tree is clean. The
comparison answers "what have I not pushed yet?", which has nothing to do with what is live.

**Solution.** Compare against **`main`** â€” the branch that actually reflects production:
`git diff --name-only main develop -- '*.js' '*.jsx' '*.css'`. That correctly returned all
three files, and the bump then verified live (`/api/version` sha matched the deployed commit).

**Prevention.**
- ðŸ”‘ **A cache-bust's baseline must be what is LIVE (`main`), never what is PUSHED
  (`origin/develop`).** Pushing develop is not deploying; any diff based on push state measures
  the wrong thing.
- ðŸ”‘ **This is a silent success, which is the dangerous kind.** The deploy reports âœ…, the
  Heroku release succeeds, and the backend SHA check *passes* â€” because the backend really did
  update. Only the browser assets are stale, and nothing in the pipeline looks at them. It is
  the same failure class the skill already documents for `.jsx` files ("deployed but nothing
  changed"), reached by a different route.
- âš ï¸ The skill file still contains the `origin/develop` comparison. Until it's fixed, check
  `git diff --name-only main develop -- '*.js' '*.jsx' '*.css'` by hand and confirm Step 2's
  bump list is non-empty whenever a release touches front-end assets.

---

## The vacation slip printed the accountant's tax year, not the employee's (2026-08-03)

**Problem.** Sorphorn Sorm's slip read **112 accrued / 56 used / 56 remaining**. Both figures
were wrong by the same 32 hours; it should read **80 / 24 / 56**.

**Root cause.** Payroll books hours to the tax year of the **check date**, not the work date.
She took 32 h on 12/22, 12/23, 12/29 and 12/30 of 2025 â€” a pay period whose check date was
01/09/2026. Those hours therefore land in the 2026 payroll year and on her 2026 W-2, and to pay
them the system carried 32 h of 2025 balance forward. **Accrued and used are both inflated by
the same carryover, so they cancel** â€” which is why remaining was right the whole time and the
defect was invisible in the one column anyone checks. Correct cash-basis accounting on the
accountant's side; a display problem on ours.

**Solution.** New hand-maintained Caspio column `Employees.Vacation_Annual_Entitlement`, read
live at slip time: `carryover = max(0, available âˆ’ entitlement)`, `slip_accrued = entitlement`,
`slip_used = used âˆ’ carryover`, `slip_remaining = remaining` untouched. Blocking gates before
anything reaches paper (`accrued âˆ’ used == remaining` Â±0.01; entitlement must be set) and a
per-run audit CSV carrying raw + adjusted + carryover + flags.

**Prevention.**
- ðŸ”‘ **Two errors that cancel leave one clean column and no symptom.** Remaining reconciled
  perfectly for months while both inputs were wrong. When a derived figure is right, that is
  evidence about the *derivation*, not about its inputs â€” check the source columns too. (Same
  shape as the 2026-07-27 finding where `Sick_Hours_Remaining` was correct while
  `Sick_Accum_Hours_Available` sat at 0.)
- ðŸ”‘ **An "as of" date is not a date field, it is the frame every derived value must be read
  in.** The entitlement is date-effective off `Leave_Balances_As_Of`, never `today` â€” otherwise
  reprinting July's packet in September silently prints September's grant.
- ðŸ”´ **Never store a hand-maintained value in a column an importer writes.** The Friday import
  overwrites all three `Vacation_Hours_*` columns; the entitlement had to be its own field or it
  would be destroyed weekly. The tell that this was already happening: someone had hand-patched
  Sorphorn to 80/24/56 in Caspio, and the next import would have silently reverted it.
- ðŸ”´ **`Number('') === 0`.** Caspio returns a blank NUMBER as `''`, so blank and zero collapse
  under any numeric coercion. Here blank must *block* the slip while 0 is legitimate (salaried
  staff) â€” the two had to be separated explicitly, and the round-trip verified against live
  Caspio rather than assumed.
- ðŸ”´ **Do not generalise a correction to the neighbouring field because it looks similar.**
  Sick hours carry over year to year *by Washington statute*, so the identical-looking inflation
  there is correct. Both rules are jest-locked precisely because "fixing" sick too is the
  obvious next mistake.
- ðŸ”‘ **When a computed figure can't be trusted, refuse to print it â€” don't print a guess.** A
  missing entitlement defaults to nothing, never to 80; the employee is named in a banner and in
  the audit CSV so a missing slip is explained rather than merely absent.

### The validation gate I wrote was a tautology, and my own comment said so (same day)

An adversarial review of the above found the spec-mandated check had **zero power over the
value it existed to guard**. `carryover = max(0, available âˆ’ entitlement)` makes the clamp inert
whenever entitlement â‰¤ available, so `accrued âˆ’ used` collapses to `available âˆ’ used` â€” the
entitlement cancels, and the importer writes `remaining = accrued âˆ’ used` by construction. A
mis-keyed entitlement of 8 gave `{accrued 8, used âˆ’48, remaining 56}`: identity satisfied, no
flags, "Hours used âˆ’48.00" printed for an employee. Fixed by asserting the one relation the
identity cannot see â€” a carryover is hours both accrued *and* used last year, so
`carryover > used` is impossible.

- ðŸ”‘ **"This always holds" written next to an assertion is a bug report, not reassurance.** My
  comment read "holds algebraically for every case, because the carryover is added to accrued and
  used in equal measure" â€” a correct proof that the check could never fail, i.e. never fire.
  **An invariant that cannot fail is not validating anything.** Before trusting a check, ask what
  input makes it trip; if the answer is only "corrupt data from a system that can't produce it",
  the check is decorative.
- ðŸ”‘ **A hand-maintained value needs a check that constrains IT, not the machine-written values
  around it.** Everything else on the record came from one importer and agreed with itself by
  construction, so any relation among those fields was self-satisfying. Only a relation the
  hand-typed number participates in asymmetrically has power.
- ðŸ”‘ **State the limits of a guard in the same breath as the guard.** The fix catches an
  entitlement below `remaining` and nothing above it â€” so 70 instead of 80 still prints silently.
  That gap is now a passing test named "documenting the gap", because the failure mode of a
  partial guard is someone later assuming it was total.
- ðŸ”‘ **Adversarial review earns its keep on code that already passes its own tests.** 47 green
  tests, a live round-trip against Caspio and a rendered print check all missed this; four
  independent reviewers found it, and asking each finding's verifier to *refute* it killed 10 of
  17 claims. Confirming passes would have kept all 17.
- ðŸ”´ **A field allowlist protects fields, not strings built from them.** The same review found a
  pre-existing leak: the payroll reconciliation put `"NAME: gross X - deductions Y != net Z"`
  into a `rowIssues` array that bypassed the careful per-field `toSafeReview()` filter, and the
  page rendered it â€” on the one page whose stated purpose is that compensation never reaches the
  browser. **Audit the error and log paths with the same rigour as the data path.**

## The blog content bank was written from style numbers it never looked up â€” 20 of 23 drafts misdescribe products (2026-08-03)

**Problem.** The weekly blog autopilot reached `best-carhartt-styles-custom-company-workwear`.
Every publish-time check the task specifies **passed**: all 5 linked styles returned HTTP 200,
