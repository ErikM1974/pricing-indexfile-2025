# Steve's Art Dashboard — Stability Audit (2026-04-23)

**Scope**: 10 JS files, ~16,428 lines, comprising Steve's dashboard flow (art-hub-steve, art-request-detail, mockup-detail, and their shared modules).

**Method**: 3 parallel Explore agents each did deep top-to-bottom reads against a 15-dimension checklist. Cross-file pattern sweep run in parallel. Triggered by 2 real bugs found today (Mark Complete unguarded `.addEventListener` + Download fetch-CORS). Audit is anchored in those known failure classes, not speculation.

**Totals**: **4 Critical · 10 High · 15 Medium · 7 Low** (36 findings after dedup). 1 false positive removed.

---

## 🔴 CRITICAL (fix now)

### C1 — `Promise.all` second fetch has no `.catch()` → card audit badges silently incomplete
**Location**: `shared_components/js/art-hub-steve.js:2226-2232`
**Code**:
```js
Promise.all([
    fetch('.../orders/...').then(...).catch(function () { return { result: [] }; }),
    fetch('.../lineitems/...').then(...)   // ← no .catch()
])
```
**Reproduces when**: `/api/manageorders/lineitems/{orderNum}` returns 5xx or network error.
**Impact**: Whole `Promise.all` rejects → `.then()` never runs → card audit badges never render → Steve sees partial state with missing art-charge comparisons. Unhandled promise rejection pollutes console.
**Fix**: Add `.catch(function () { return { result: [] }; })` to the second fetch, matching the first.

### C2 — `approveDesign()` reads `currentRequest.PK_ID` across async boundary → silent save failure
**Location**: `pages/js/art-request-detail.js:3434`
**Issue**: Global `currentRequest` is mutated by page reloads / SPA-like navigations. `approveDesign()` awaits then reads `currentRequest.PK_ID` — if the global was cleared between awaits, `PK_ID` access either throws or writes to the wrong record.
**Reproduces when**: Rapid click-through between designs while an approval save is in flight.
**Impact**: `Final_Approved_Mockup` never saves. Customer sees "Approved" UI but field stays empty → downstream PDF generation / push-to-production broken. **This is the same bug-class as Mark Complete silently failing.**
**Fix**: Capture `var pkId = currentRequest && currentRequest.PK_ID;` at function entry before any `await`. Guard the save with `if (!pkId) { return showArdToast('Lost context, please retry', 'error'); }`.

### C3 — `uploadChangesFiles()` uses `currentRequest.PK_ID` with no null guard
**Location**: `pages/js/art-request-detail.js:3625-3650` (uses PK_ID at ~3630)
**Issue**: Same pattern as C2 — file upload reads global state mid-flow with no null check.
**Reproduces when**: User opens Request Changes, starts file upload, then navigates away before upload completes.
**Impact**: Unhandled TypeError crashes the modal; user sees no feedback. Upload appears to succeed but was never attached.
**Fix**: Capture `pkId` at function entry. Bail early with user-visible toast if missing.

### C4 — Lightbox download falls back to raw Box URL on failure → opens broken tab
**Location**: `pages/js/mockup-detail.js:4314-4347` (`downloadImage()`)
**Issue**: On fetch error, calls `window.open(url, '_blank')` with the raw Box URL. That URL is cross-origin without auth — browser opens a blank / 404 / "access denied" page. User has no idea what went wrong.
**Reproduces when**: File deleted from Box OR proxy returns 404/500.
**Impact**: Steve/Ruth click Download, get a blank tab, try again, assume the button is broken. Looks identical to today's "Failed to fetch" bug we just fixed on art-request-detail.js — **same bug class, different file, still unfixed**.
**Fix**: Mirror the art-request-detail.js fix: show "File missing — Re-upload" card via `showBoxFileMissingModal()`-style UX on 404. Only use `window.open` when we have explicit evidence the raw URL is safe.

---

## 🟠 HIGH (fix soon — edge cases that will trigger within 30 days)

### H1 — Unguarded chain: `getElementById('notes-overlay').addEventListener(...)` at page init
**Location**: `shared_components/js/art-hub-steve.js:2154, 2157, 2160`
**Issue**: Three sequential unguarded `getElementById().addEventListener()` calls during `DOMContentLoaded`. If ANY of the three HTML IDs is missing (HTML edit, partial merge, cached template), the throw propagates out of the init function and `ArtActions.initApprovalModalListeners()` at line 2170 never runs. **Same bug class as today's Mark Complete**.
**Fix**: `const el = document.getElementById('notes-overlay'); if (el) el.addEventListener(...)` for all three.

### H2 — Asymmetric null guard: `closeBtn?.addEventListener` but `modal` accessed unguarded
**Location**: `shared_components/js/art-hub-steve.js:2142-2143`
**Issue**: Uses optional chaining `?.` on the button but then unconditionally reads `document.getElementById('imageModal')` inside the callback.
**Impact**: If `#imageModalClose` missing but `#imageModal` present, callback runs and crashes on the modal access.
**Fix**: Guard both.

### H3 — `initShareWithCustomer()` still has 7+ unguarded queries after today's fix
**Location**: `pages/js/art-request-detail.js:2725-2905`
**Issue**: Today we added `if (!overlay) return` at the top (fix from earlier session), but the function also pulls `modal, btn, closeBtn, cancelBtn, sendBtn, emailInput, nameInput, messageInput, previewSection, previewImg` — only `overlay` is guarded. If any of the others is missing, later `addEventListener` throws.
**Fix**: Bail out if ANY required element is null: `if (!overlay || !modal || !btn || !closeBtn || !cancelBtn || !sendBtn || !emailInput || !messageInput) return;`

### H4 — `statusUpdateInProgress` flag can deadlock the button permanently
**Location**: `pages/js/mockup-detail.js:1274-1341`
**Issue**: Flag set `true` at line 1277, reset only in `.catch()` at line 1341. If the `.then()` chain throws synchronously BEFORE reaching the catch, flag stays `true` forever — all future status changes blocked until page reload.
**Reproduces when**: A `.then()` handler throws (malformed response, null deref in follow-up code).
**Fix**: Reset flag in `.finally()` block, not `.catch()`.

### H5 — Document-level click listener added on every render (memory leak + duplicate fires)
**Location**: `pages/js/mockup-detail.js:1895-1904` (`initGalleryInteractions()`)
**Issue**: `document.addEventListener('click', ...)` for `.pmd-slot-replace` runs every time the gallery re-renders. After 3 renders, each Replace click fires the handler 3×.
**Impact**: Slot popover opens multiple times, flickers, or creates stale state.
**Fix**: Move to module-level init (run once), OR track listener and `removeEventListener` before re-adding.

### H6 — `openMockupEditModal()` guards root modal but not children
**Location**: `pages/js/mockup-detail.js:284+`
**Issue**: Function has `if (!modal) return;` for the container but then calls `document.getElementById('pmd-edit-design-name').value = …` for nested fields without guards.
**Fix**: Either guard all children or use `modal.querySelector()` so scoping fails safely.

### H7 — Double-submit hazard: box-picker confirm button never re-enables on network hang
**Location**: `pages/js/art-request-detail.js:2016-2084`
**Issue**: Disabled on click, re-enabled only in `.catch`. A hung fetch (no response, no error) leaves button disabled forever.
**Fix**: Add a 30s timeout that re-enables with "Timed out — try again" error state.

### H8 — Fire-and-forget save of `Final_Approved_Mockup` only logs `.warn` if it fails
**Location**: `pages/js/art-request-detail.js:3434-3446`
**Issue**: Wrapped in try/catch that only `console.warn`s. If the critical save fails, user still sees "Approved" toast; the field is silently empty.
**Fix**: Convert to user-visible amber toast with "Approval saved but Final_Approved_Mockup failed to persist — contact Erik". Consider: don't flip UI state to "Approved" until save confirmed.

### H9 — `wireModalEvents()` in Transfer flow has unguarded `$()` helper chain
**Location**: `shared_components/js/transfer-actions-shared.js:506-510`
**Issue**: `$('#tas-modal .tas-modal-close').addEventListener(...)` — if `$()` returns null (modal not injected yet), throws and kills wiring.
**Fix**: Capture `$()` result, null-check, then wire.

### H10 — `initApprovalModalListeners()` never tears down listeners on modal close (memory leak)
**Location**: `shared_components/js/art-actions-shared.js:1296-1334`
**Issue**: Wires listeners on approval modal but doesn't clean up. Each invocation stacks more listeners.
**Impact**: After a few modal opens, button handlers fire multiple times.
**Fix**: Call `removeModals()` before wiring, OR store handler refs and `removeEventListener` before adding.

---

## 🟡 MEDIUM (defensive improvements — will bite under unusual conditions)

### M1 — Kanban view-toggle race
**Location**: `art-hub-steve.js:1929-1946` — rapid Grid ↔ Board clicks during slow API overlap into stale state.
**Fix**: Use AbortController; cancel prior fetch on new toggle.

### M2 — XSS vector in error-toast innerHTML
**Location**: `art-hub-steve.js:1950-1953` — builds HTML with `err.message`. Malicious error header could inject.
**Fix**: Use `textContent` or wrap with `escapeHtml()`.

### M3 — Fallback fetch assumes same response shape
**Location**: `art-hub-steve.js:1931-1938` — retry without `Is_Rush` field; if fallback endpoint returns different shape, `Array.isArray(data)` silently renders empty board.
**Fix**: Validate data shape explicitly after fallback.

### M4 — MutationObserver race with badge application
**Location**: `art-hub-steve.js:1705-1706, 2346-2350` — cards still being injected when `applyMissingBadgesToAllCards()` runs.
**Fix**: Debounce badge injection or gate on stable DOM.

### M5 — Inline `onclick="..."` handlers in Kanban cards
**Location**: `art-hub-steve.js:1984, 2069` — embeds designId into onclick string; if designId has quotes, breaks JS.
**Fix**: Use event delegation with `data-design-id` attribute.

### M6 — Unsafe inline `onerror` handler on `<img>`
**Location**: `transfer-actions-shared.js:588` — inline JS reads `nextElementSibling`; if DOM changes mid-load, throws.
**Fix**: Use `img.addEventListener('error', ...)` bound at construction.

### M7 — Box API errors logged without response body
**Location**: `transfer-actions-shared.js:553-554` — generic "Box lookup failed" toast; debug info discarded.
**Fix**: `console.error('Box API error:', data)` on failure.

### M8 — `$$` selector chain passes possibly-null `$()` result
**Location**: `transfer-actions-shared.js:507` — if `$('#tas-modal')` is null, `querySelectorAll` on null throws.
**Fix**: Guard intermediate.

### M9 — `initMockupSelection()` captures `req` in closure, reads stale state
**Location**: `art-request-detail.js:2972-3028` — if AE edits/approves, callback still sees original `req`.
**Fix**: Read from `currentRequest[selectedMockupSlot]` at event-fire time, not init.

### M10 — `pollForVisionAnalysis()` exits silently after max retries
**Location**: `art-request-detail.js` ~2172 — no `console.warn` on final failure; user has no indication AI review skipped.
**Fix**: Log final failure; consider surfacing to user.

### M11 — Upload race: no global lock on `uploadFileToSlot()`
**Location**: `art-request-detail.js:2114-2196` — rapid uploads to multiple slots can interleave `currentRequest` writes.
**Fix**: Global `isUploading` flag; disable slot buttons during any upload.

### M12 — `loadStoredEmbData()` vs `renderAllSlotSwatches()` race
**Location**: `mockup-detail.js:3072-3091, 3152+` — async fetch updates globals while user-triggered renders also run.
**Fix**: Version counter or debounced render.

### M13 — Multiple `resp.json()` without `resp.ok` check
**Location**: `mockup-detail.js:2509, 2639, 2708` — 5xx responses with JSON error bodies are parsed as success.
**Fix**: Always `if (!resp.ok) throw new Error(...)` before `.json()`.

### M14 — Partial HTML escaping in `innerHTML` (XSS hazard)
**Location**: `mockup-detail.js:1543, 1553, 1562, 1577, 1663` — some fields escaped via `escapeHtml()`, others inline.
**Fix**: Audit each `innerHTML` assignment; use `escapeHtml()` consistently or switch to `.textContent`.

### M15 — `sendNotificationEmail()` doesn't guard `emailjs` like other places do
**Location**: `art-actions-shared.js:193/213/346 (guarded) vs :305 (unguarded)` — inconsistent.
**Fix**: Add `if (typeof emailjs === 'undefined') return;` at start of function.

---

## 🟢 LOW (cleanup / minor UX — schedule when convenient)

- **L1** — `palette.colors.filter()` after early return still possible if palette becomes falsy; add re-check. (`thread-color-picker.js:146-155`)
- **L2** — No fetch timeout on thread-color API — modal hangs forever if Heroku is down. (`thread-color-picker.js:8, 21`)
- **L3** — `sendNotificationEmail()` builds `<img src="'+url+'"` without escaping URL quotes. (`art-actions-shared.js:273-274`)
- **L4** — `getLoggedInUser()` `.split('@')[0]` crashes not, but handles malformed emails ungracefully. (`art-request-detail.js:23-34`)
- **L5** — 30-second "Sent!" cooldown on share-email button has no visible countdown or reset. (`art-request-detail.js:2886-2891`)
- **L6** — Supacolor lookup silent-failure: no toast if `lookupArtRequest()` returns null. (`steve-send-supacolor.js:48-57`)
- **L7** — `Object.assign()` used without polyfill check — breaks on IE11 (NWCA probably doesn't support IE11 anyway). (`art-actions-shared.js:312, 372, 389`)

---

## 📊 Cross-cutting patterns (grep-level findings across all 10 files)

- **30+ unguarded `document.getElementById(...).addEventListener`** in mockup-detail.js (lines 622, 784, 787, 790, 830, 842, 879, 959, 962, 971, 974, 1003, 1051, 1054, 1063, 1180, 1184, 1972, 1973, 1974, 1976, 2005, 2062, 3523, 3535, 3543 and more). **Same class as today's Mark Complete bug**. Most individual instances are low-risk (the IDs exist in HTML), but there's no systemic defense. One HTML rename = cascading silent failures.
- **20+ `.catch(function () {})` empty/fire-and-forget blocks** — many legitimately non-blocking (emails, notes), but the lack of even a `console.warn` makes diagnosis painful.
- **217 `.innerHTML =` assignments** across the 6 primary files — needs spot-check audit (M14 captures the worst known instances).
- **0 cross-origin fetches** outside the Box proxy — **good**.
- **0 dangerous class-based `querySelectorAll(...).forEach(remove)`** — **good** (today's overlay-cleanup bug was fixed to use specific ID).

---

## 📋 Triage recommendation

**Fix this sprint (CRITICAL + bug-class-matches-today):**
- C1, C2, C3, C4 (all 4 Critical)
- H3 (same bug class as today's Mark Complete — 7 more unguarded queries in same function)
- H5 (listener leak in mockup gallery — easy to trigger, pollutes UX)

**Next sprint:**
- H1, H2, H4, H6, H7, H8, H9, H10

**Backlog:**
- All Medium + Low; prioritize by traffic (mockup-detail is Steve's most-visited page)

**Dismiss / will not fix:**
- L7 (Object.assign polyfill — NWCA doesn't support IE11)
- The "217 innerHTML" blanket count is not actionable — specific instances already flagged as M14

---

## False positives (noted, not included)

- Agent 1 flagged a "Promise.all missing catch" at `transfer-actions-shared.js:2226-2232`. That file is only 943 lines — the agent duplicated the `art-hub-steve.js` line ref by mistake. Verified: transfer-actions-shared.js has one `Promise.all` at line 727, properly `await`ed. **Not an issue.**
- elapsed-time-utils.js has **zero findings** — clean defensive code.
- Agent 1's "innerHTML with escapeHtml is already safe" in transfer-actions-shared.js was correctly noted as a non-issue.
