# Lead → Quote linkage (2026-09-17)

Taneisha reported that a quote she built and saved for the **Velco Electrical** lead never
appeared on that lead — the panel kept saying *"No quotes for velasco.d26@gmail.com yet."*
Two independent defects. **Both halves are now LIVE.**

## Status — COMPLETE

| Half | State |
|---|---|
| Proxy — cache invalidation | ✅ **LIVE** `v2026.09.17.1` / Heroku **v1135** (`/api/health` verified) |
| App — `refresh=true` + email preserve | ✅ **LIVE** `v2026.09.18.1` / Heroku **v2131** (`a90dafc3`) |

Live proof for the app half: `https://www.teamnwca.com/dist/shared_components/js/quote-builder-utils.f2da768a00.js`
serves the minified `resolveContactEmail`. The hash is content-derived, so its presence *is* the
proof the new file shipped.

The app half took two attempts. The first (2026-09-17) went red on CI and was `git revert`'d off
`develop`; the second rebuilt it against the content locks and the function-length ratchet. The
reverts are still in `develop`'s history, so **never merge the old `fix/lead-quote-cache` branch** —
merging a branch whose commits `develop` reverted re-undoes the fix. It was rebuilt as one clean
commit (`1cce56f8`) on top of the reverts instead.

## Defect 1 — stale read cache (FIXED, live)

`GET /api/quote_sessions` caches list reads per-filter for 5 minutes. **Only DELETE cleared
it.** Opening a lead auto-runs the `CustomerEmail` lookup, so the EMPTY "no quotes yet" answer
was cached *before* the rep went off to build the quote; `POST` (saving) did not invalidate,
and the panel's "check again" sent no `refresh=true`, so it re-read the cached empty array.
Guaranteed wrong for the first 5 minutes after saving — exactly when a rep looks — then
self-heals, which is why it read as random and never got reported properly.

Fix: cache moved to `proxy src/utils/quote-sessions-cache.js` so all four writing files reach
the invalidator; `POST`/`PUT`/`DELETE` plus `embroidery-push` / `dtf-push` / `scp-push` (which
stamp `PushedToShopWorks`) all invalidate. Locked by
`proxy tests/jest/quote-sessions-cache-invalidation.test.js` — it walks the exact Leads
sequence and was **verified to fail** with the POST invalidation removed.

🔑 That cache is **per-dyno**, so invalidation alone can still miss on a multi-dyno app. The
app's `refresh=true` closes that hole and is NOT yet shipped.

## Defect 2 — customer search wipes the email (fix written, NOT shipped)

All 4 builders' `applyContact` did `customer-email.value = contact.ContactNumbersEmail || ''`,
so picking a ShopWorks customer with **no email on file** silently destroyed the address
already in the field — including one prefilled from a lead. The quote then saved under a
different email and became invisible to that lead's panel; EMB *requires* an email to save, so
it also just blocked reps. `emb/design-search.js` and `emb/shopworks-import.js` already guarded
correctly (`if (!emailInput.value.trim())`) — only the lookup didn't.

Fix on the branch: preserve a non-empty address; because a kept address may belong to the
PREVIOUS customer, a warning toast says so and asks the rep to verify (never silent).
Sites: `emb/adapter.js`, `scp/adapter.js`, `dtf/methods-lifecycle.js`, `dtg/crm.js` (Rule 8).

## How it was finished — the two gates, and how to clear them next time

Both are legitimate repo guards, not flakes:

1. **`tests/unit/builders-function-length.test.js`** — the added lines pushed DTF's
   `init()` to 157 (limit 150, `dtf` allowlist is empty). Fixed properly by extracting the
   rule into ONE shared helper so each builder's edit is a single line — `init()` went back
   under without an allowlist entry. Prefer that over freezing a new entry.

2. **Content-lock drift guards** (`quote-builders-content`, `lead-records-content`,
   `crm-workspaces-content`) — these hash each locked file back to a recorded original, and an
   intentional edit is legal only with a `{before, after, count}` row that reverses it. Rows are
   replayed in REVERSE array order, so a new row is APPENDED and reversed first.
   Use **`scripts/record-content-lock-change.js <base-ref> [--write] [--only=…]`** (added with
   this fix): it computes the rows from the real sources, replays each fixture's own
   pre-transform chain, and refuses to write unless they reverse exactly.

🔑 **Two ledgers, and one of them THROWS.** `tests/helpers/quick-quote-source-mappings.js` runs
BEFORE the quote-builders ledger and throws `Quick Quote workflow mapping drift` if any of its
rows' counts change. Editing the `module.exports` line of `quote-builder-utils.js` tripped it —
the helpers were left as browser globals instead (which matches `applyMethodSwitchCustomer`, and
a jsdom test loads the file via a `<script>` tag to cover them). For a ledger with no
pre-transform, the external `qq-classic-checkpoint/gen_mappings.py` is the tool.

🔑 **No `?v=` cache-bust was needed, and adding one is actively harmful here.** All 4 builder
pages AND `dashboards/lead.html` are in `lib/hashed-pages.js`, so `scripts/build.js` strips the
`?v=` and content-hashes the asset; Heroku's `heroku-postbuild` rebuilds on every deploy. Bumping
`?v=` only edits locked HTML and drags in the second ledger for no benefit. Check
`lib/hashed-pages.js` before bumping anything.

🔑 **`dist/` wrecks local test runs.** A local `npm run build` leaves 27 MB that quadrupled
file-scan time (58s → 220s) and timed out `css-runtime-inventory` and `emb-edit-reload-roundtrip`
— which reads exactly like a regression. It is gitignored; `rm -rf dist` before running
`npm run test:unit`.

🔑 **The app checkout's `node_modules` was empty**, which is why the locks only surfaced in CI the
first time. `npm ci` in a worktree outside OneDrive gives a real local gate (lint, typecheck,
unit, dom, a11y) — do that first.

## Still open — the real design gap

**Nothing auto-links a quote to its lead.** `Linked_Quote_ID` is only ever written by an
explicit Link click in `dashboards/js/lead-workspace.js`; "Start a quote" carries the lead
*into* the builder (via the `nwca-method-switch` stash) but nothing carries the quote ID
*back*. The whole round trip rests on an exact email match, which is why Defect 2 could break
it a second way. Carrying the lead's `Submission_ID` through that stash and writing it back on
save would make this robust — a design change, not a bug fix, and not started.
