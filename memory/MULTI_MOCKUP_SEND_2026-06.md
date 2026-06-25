# Multi-Mockup Send (up to 6) — Art Request "Send Mockup" modal

**Status:** Code complete (frontend + proxy) + adversarially reviewed + verified on disk, 2026-06-24.
NOT committed, NOT deployed. **BLOCKED on Erik adding Caspio columns, then deploy.**
Built for Steve to stage up to 6 mockup variations per job and email them all to the AE in one send.

## ⏯️ RESUME HERE (pickup checklist, in order)

1. **Re-confirm code on disk** (it clobbered once mid-session): grep `shared_components/js/art-actions-shared.js` for
   `getSendSelection(modal).values()`, `Promise.allSettled`, and `pasteInput.addEventListener`. If any missing, restore
   from `%TEMP%/art-actions-shared.BACKUP.js`. Run `node --check` on it.
2. **Confirm the one proxy unit test is green** (I updated its 5→8 field assertion; a re-run was in flight at stop, result
   unconfirmed): `cd ../caspio-pricing-proxy && npx jest tests/jest/recover-broken-mockup-slot-aware.test.js`.
3. **Erik action (blocking):** add the 6 Caspio columns below to `ArtRequests`.
4. **Deploy** (only after columns exist): commit ONLY this feature's files (list in "Pre-ship verification"), deploy the
   proxy first, then the frontend via `/deploy`. Re-run `git status` first — the tree has unrelated WIP from other sessions.
5. **EmailJS sanity check:** send a 2-mockup test → AE email shows TWO images (confirms `mockup_images_html` is raw HTML).
6. Optional: the deferred dashboard-thumbnail follow-up (bottom of this file).

## What changed (why it was easy)

The EmailJS pipeline was **already array-capable** — `sendNotificationEmail('approval', {mockupUrls:[…]})`
maps over the whole array into `mockup_images_html` ([art-actions-shared.js](../shared_components/js/art-actions-shared.js)).
The only blocker was the modal's **single-select** UI (every card click deselected the others; `submitSendForApproval`
built a 1-element array). The feature = make the modal multi-select + collect all selections, and add 3 real mockup slots.

## 🔴 Erik action required — add 6 Caspio columns to `ArtRequests`

Until these exist, the new slots stay blank (no errors — empty slots just don't render). Add as **plain Text**
(NOT Caspio *File* fields — File fields are read-only via the API and can't be written):

| Column | Type |
|---|---|
| `Mockup_4` | Text (255) |
| `Mockup_5` | Text (255) |
| `Mockup_6` | Text (255) |
| `Mockup_4_Note` | match existing `Mockup_1_Note` type (Text 255) |
| `Mockup_5_Note` | match `Mockup_1_Note` |
| `Mockup_6_Note` | match `Mockup_1_Note` |

`GET /api/artrequests` returns all columns (no `q.select`), so once added they flow to the frontend with **no extra code**.

## Code changes (already made)

**Frontend (this repo):**
- `shared_components/js/art-actions-shared.js` — multi-select: per-open selection `Map` (`modal._selectedMockups`),
  box + previously-sent cards now **toggle** (plain click; no cross-grid deselect), `prevFileFields` lists all 6
  mockup fields, removed auto-select-first, **`SEND_MOCKUP_CAP = 6`** counter (`#approval-selected-count`) + hard cap,
  `submitSendForApproval` collects Box files (one `/api/box/shared-link` each via `Promise.allSettled`) + previously-sent
  URLs + paste URL into `mockupUrls[]`, **aborts visibly if any Box link fails** (Erik's #1 rule), dedupes, caps at 6,
  persists new Box links sequentially into empty `Mockup_*` slots.
- `pages/js/art-request-detail.js` — `MOCKUP_SLOTS` now 6 (renders a 6-slot MOCKUPS grid; Set-as-Final/notes/drag all
  generic); vision `slotOrder`/`slotLabels` extended to 6.
- `pages/art-request-detail.html` **and** `dashboards/art-hub-steve.html` — counter `<span id="approval-selected-count">`
  + "click to toggle, up to 6" labels. **Modal markup is duplicated in these two files — keep them in lockstep.**
- `shared_components/css/art-hub.css` — `.approval-count` + `.at-cap` flash.

**Proxy (`../caspio-pricing-proxy`):** added `Mockup_4/5/6` to `MOCKUP_FIELDS` (`box-upload.js` — auto-fill spills into
4/5/6) + the two other field arrays there, `VALID_SLOT_FIELDS` (`recover-broken-mockup.js`), `ART_FIELDS`
(`box-webhooks.js`), `SLOT_LABELS` (`send-steve-digest.js`); added `Mockup_4/5/6_Note` to `EDITABLE_FIELDS` (`art.js`).
Test updated: `recover-broken-mockup-slot-aware.test.js` (5→8 field list).

## ⚠️ Pre-ship verification (out-of-band)

- **EmailJS template `art_approval_request` is EXTERNAL** (EmailJS dashboard, not in repo). `mockup_images_html` must be a
  **raw/triple-brace** variable. Sanity check: single-image sends already render today → it's almost certainly already raw.
  Confirm by sending a **2-mockup** test and checking the AE email shows TWO images (not escaped `<img>` text).
- Two-repo deploy: deploy proxy (Heroku `caspio-pricing-proxy`) **before/with** the frontend so the new fields are writable.
- Shared-checkout: at build time the tree had heavy unrelated WIP from other sessions (`sanmar-inbound-today.js`,
  `sanmar-daily-inbound.js`, `quote-management.*`, `screenprint-quote-builder.*`, `staff-dashboard-v3/index.html`,
  `ACTIVE_FILES.md`). Commit ONLY this feature's files: `shared_components/js/art-actions-shared.js`,
  `pages/js/art-request-detail.js`, `pages/art-request-detail.html`, `dashboards/art-hub-steve.html`,
  `shared_components/css/art-hub.css`, `memory/MULTI_MOCKUP_SEND_2026-06.md` + the proxy files.
- ⚠️ **CLOBBER seen this session:** three edits to `art-actions-shared.js` (submit rewrite, notes, paste listener)
  silently reverted mid-session in this shared OneDrive checkout, then were re-applied + re-verified on disk. **Before
  deploying, re-confirm `art-actions-shared.js` contains `getSendSelection(modal).values()` + `Promise.allSettled`
  in `submitSendForApproval` and the `#box-paste-url` input listener in `initApprovalModalListeners`.** A known-good
  backup is saved at `%TEMP%/art-actions-shared.BACKUP.js`. Lesson: after editing in this checkout, re-Read/grep on
  disk to confirm; don't trust the edit-success message alone.

## Deferred follow-up (minor, flagged by review — NOT shipping with v1)

Dashboard CARD thumbnails (`art-hub-steve.js` ~539/629, `art-ae.js` ~190/399, `art-hub-steve-gallery.js` ~20/466,
`ae-dashboard.js` ~576) use explicit `q.select` / fallback chains covering only the original 3 mockup fields. A record
whose ONLY filled mockups are slots 4/5/6 would show no card thumbnail. **Rare** (slots auto-fill 1→6 in order, so 4/5/6
fill only after 1/2/3) and cosmetic (cards need one representative image). The **Send modal is unaffected** — it does its
own no-`select` fetch, so all 6 always appear as "Previously Sent." Extend those selects/fallbacks + the gallery label map
(~3183) if Erik wants the new slots reflected on cards.

## Manual test checklist (staff, controlled)

1. Send a 2-mockup test first → confirm AE email shows both images (EmailJS template check).
2. Detail page Send Mockup: select 2 Box files + 1 previously-sent + type a paste URL = counter "4 of 6", all stay lit, Send enabled.
3. Cap: select to 6, attempt 7th → blocked + counter flashes red.
4. Cross-grid independence: selecting a prev card does NOT clear a selected Box card.
5. Single mockup (regression) still sends.
6. Box partial-failure (one bad file) → visible error, NO email sent.
7. Repeat from the Steve hub card + Steve gallery card (same shared modal).
8. Reminder button + `/mockup/:id` tool unaffected.
