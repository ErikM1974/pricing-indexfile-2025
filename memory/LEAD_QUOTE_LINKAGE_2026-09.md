# Lead → Quote linkage (2026-09-17)

Taneisha reported that a quote she built and saved for the **Velco Electrical** lead never
appeared on that lead — the panel kept saying *"No quotes for velasco.d26@gmail.com yet."*
Two independent defects. **Half is live; half is unfinished.** This file is the resume point.

## Status

| Half | State |
|---|---|
| Proxy — cache invalidation | ✅ **LIVE** `v2026.09.17.1` / Heroku **v1135** (`/api/health` verified) |
| App — `refresh=true` + email preserve | ⏭️ **UNFINISHED** on `origin/fix/lead-quote-cache`, CI RED |

`develop` was `git revert`'d back to green after the red CI (code byte-identical to the last
green commit `570902cd`); the LESSONS commit stayed. **Nothing app-side reached production.**

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

## To finish (next session)

Branch `origin/fix/lead-quote-cache` — worktree at `C:\Users\erik\wt-lead-quote-fix`.
Cache-bust `2026.09.17.3` is already applied (only `lead-workspace.js` carries a `?v=`; the
builder modules are ESM imports served through the content-hashed bundle, and Heroku's
`heroku-postbuild` → `scripts/build.js` rehashes them).

CI is red on two gates, both legitimate:

1. **`tests/unit/builders-function-length.test.js`** — the ~10 added lines push DTF's
   `applyContact` past the 150-line ratchet. Extract a helper (preferred) or allowlist it.
2. **Content-lock drift guards** — `quote-builders-content`, `lead-records-content` and
   `crm-workspaces-content` hash-lock these files ("preserves original builder logic …
   outside **recorded** presentation changes"). The four changed files need re-recording in
   the fixture ledger, same process as hash-locked HTML.

🔑 **App `node_modules` is EMPTY** in the OneDrive checkout — no local jest or eslint, so CI is
the only gate and content locks surface only *after* pushing. Install deps first, or expect a
push/fix cycle.

🔴 The OneDrive checkout is chronically stale (was 86 commits behind) and shows ~3,482
"modified" files that are **pure CRLF churn, no content change**. Work from a worktree; commit
path-scoped (`git commit -- <paths>`) because its index holds thousands of pre-staged files.

## Still open — the real design gap

**Nothing auto-links a quote to its lead.** `Linked_Quote_ID` is only ever written by an
explicit Link click in `dashboards/js/lead-workspace.js`; "Start a quote" carries the lead
*into* the builder (via the `nwca-method-switch` stash) but nothing carries the quote ID
*back*. The whole round trip rests on an exact email match, which is why Defect 2 could break
it a second way. Carrying the lead's `Submission_ID` through that stash and writing it back on
save would make this robust — a design change, not a bug fix, and not started.
