# Easy Shirt Designer → Art-Request Integration (2026-06-17)

The **NWCA Easy Shirt Designer** (`pages/garment-designer.html` + `pages/js/garment-designer.js` +
`pages/css/garment-designer.css`) places artwork incl. **Tajima DST** on a recolored shirt mockup,
assigns **Robison-Anton Poly** thread colors per stitch element, and prints a **Customer Proof**.
Productionized 2026-06-17 from an 868KB single-file app (extracted JS/CSS, no inline blocks; fixed
duplicate proof thread line + malformed-DST guard).

## Decisions (Erik, 2026-06-17)
- **Standalone link FIRST**, in-form button as fast-follow.
- Rep mockups are **REFERENCE for Steve** — he still owns the production proof. **Never** shown in customer view (`?view=customer`).
- Productionize first (DONE), then integrate.
- Strongest fit = **embroidery/DST** (thread + placement specs); for DTG/screenprint it's general placement.

## ✅ Phase 1a — SHIPPED (standalone)
Designer is a clean NWCA page reachable from the AE dashboard nav ("Shirt Designer" → `/pages/garment-designer.html`).
Reps can build a mockup + proof and download/print it (JDS-equivalent baseline). No data flow into the request yet.

## ✅ Phase 1b.1 — SHIPPED (pre-seed + sender) — FE `v2026.06.17.12` (2026-06-17)
- **Sender** (`art-request-detail.js`/`.html`/`.css`): green **🧵 Build Mockup** button in the detail-page title row, **gated on `!isCustomerView`**. Builds `/pages/garment-designer.html?color=&garmentName=&placement=&company=&designId=` from `req.GarmentColor`/`Garm_Color_2`, `parseLocations(req.Artwork_Locations)[0].placement || req.Garment_Placement`, `CompanyName`, `designId`. Opens in a new tab.
- **Pre-seed** (`garment-designer.js`/css): `applyUrlPreseed()` runs after `initPhotoMock()`. Reads the params, resolves a color NAME→hex via new `resolveGarmentHex()` (exact then loose-contains over `PC61_COLORS`/`GARMENT_COLORS`; raw `#hex` passes through), calls `setStageBg(hex, null, name)`, stashes placement into `pendingSide`/`pendingPlacement`, and renders a green context banner ("Building a mockup for {company} · Design #{id} · {color} · {placement}") with an "⬆ Upload artwork for this request" button (`seedUpload()` sets the seeded placement then opens the file picker on the user gesture). Live-verified: "J. Navy"→#15263E recolors the shirt, banner shows, zero console errors.

## ✅ Phase 1b.2 — SHIPPED (Save to Art Request) — proxy + FE, 2026-06-18
**What shipped (as designed below, verified end-to-end):**
- Caspio: Erik added `Rep_Mockup` (Text 255) + `Rep_Mockup_Meta` (Text 64000). Proxy `art.js` EDITABLE_FIELDS now whitelists both (deployed; PUT verified `updatedFields:["Rep_Mockup","Rep_Mockup_Meta"]`).
- **Designer** (`garment-designer.{html,js,css}`): purple **💾 Save to Art Request** toolbar button (`#saveReqBtn`), hidden unless opened from a request (revealed by `applyUrlPreseed` when `designId` present). `saveToArtRequest()` = `getCleanMock(current()).toBlob()` → POST `/api/files/upload` → image URL = `{PROXY}/api/files/{externalKey}` (the GET streams the image with its content-type, so `<img>` resolves directly — **no CDN formula needed**, the key insight since `Rep_Mockup` is plain Text) → PUT `/api/art-requests/{designId}/fields` with `Rep_Mockup` + `Rep_Mockup_Meta` (JSON: source/designId/date/garmentColor/garmentName/placement/printWidthIn/kind/threadSummary/threads[]). `showToast` feedback; guards on `mockOn && mockCanvas`; `postMessage('rep-mockup-saved')` to the opener.
- **Detail page** (`art-request-detail.{html,js,css}`): `renderRepMockup(req)` paints a purple "🧵 Rep Reference Mockup" card (image + 👕/📍/width chips + 🧵 thread line + "Reference · not the production proof" badge + "Open in Designer" re-seed link), **gated `!isCustomerView`** (customer view hides it — verified). Print job sheet pushes the rep mockup into `artImgs` (staff-only). A `message` listener re-fetches + re-renders when the designer saves, so the card appears without a manual refresh.
- **Verified live:** backend upload→serve (200 image/png)→PUT→GET round-trip; detail card renders all fields; customer view hides it; designer button reveals + no-artwork guard toasts. (Orphaned 20KB test file left in Artwork folder — `/api/files/:key` DELETE returned DELETE_FAILED; harmless, unreferenced.)
- **Deferred (unchanged from plan):** auto-approve/customer-email gate; true re-edit (designer drops source art — re-open only re-seeds garment/placement).

## 〈design, as built〉 Phase 1b.2 — "Save to Art Request" — DESIGN LOCKED (4-agent workflow, 2026-06-17)
**Storage decision** (reconciling save-endpoints + field-mapping + approval + state-feasibility agents):
- **One dedicated mockup field, NOT the customer File_Upload slots.** Reusing File_Upload_Two/Three would (a) collide with the customer's own additional art and (b) LEAK to customer view (those slots render under `READ_ONLY_FIELDS`, customer-facing) — violates "reference-only, hidden from customer." → Add **`Rep_Mockup`** (Text 255, the `/Artwork/{file}` mockup URL) + **`Rep_Mockup_Meta`** (Text 64000, compact JSON: `{by,email,date,garmentColor,garmentName,placements:[],threads:[],designId}` — powers the card label + audit line + job-sheet + future specs-only re-edit). Both go in proxy `art.js` EDITABLE_FIELDS.
- **Do NOT overwrite** the AE's authoritative `Thread_Colors`/`Artwork_Locations`/`Color_Mode` (customer intent ≠ rep's reference mock). The mock PNG already bakes the thread legend; specs live in `Rep_Mockup_Meta`.
- **No new endpoint needed**: designer does `getCleanMock(entry).toBlob()` → **POST `/api/files/upload`** (→ `/Artwork/{file}`) then **PUT `/api/art-requests/{designId}/fields`** with `Rep_Mockup`+`Rep_Mockup_Meta`. Detail page renders a purple "Rep Reference Mockup (by X · date)" card from those fields, gated `!isCustomerView`, + a job-sheet section. Slack to Steve `art@` on save (fire-and-forget).
- **Approval = reference-only for v1** (Erik's decision): rep mock NEVER changes `Approval_Status`; Steve still owns the production proof + `Final_Approved_Mockup`. (Agent-3's auto-approve/auto-customer-email gate = explicitly DEFERRED — too much risk near pricing/approval.)
- **Re-edit = specs-only / deferred** (Agent 4): the designer discards the original art `File`/buffer after `openEntry()` and rasterizes to canvas, so true re-open requires re-uploading the source. v1 saves PNG + specs; "Load this design" is a later phase.
- **BLOCKED ON:** Erik adding `Rep_Mockup` + `Rep_Mockup_Meta` to the Caspio ArtRequests table (Text). Then build designer Save button + detail rep card + proxy whitelist + job-sheet section in one chunk.

### (original Phase 1b attach notes — superseded by the decision above)
**Attach (push output back onto the ArtRequest):** add an "Attach to Art Request" button that:
- `getCleanMock(entry).toDataURL('image/png')` → Blob → **POST `/api/files/upload`** (multipart) → store **`/Artwork/{fileName}`** (NOT externalKey — CDN_Link formula depends on the path) in a File_Upload slot.
- `entry.dstThreads[]`/`entry.dstElements[]` → **`Thread_Colors`** (use `dstThreadSummaryInline()`: "Stop 1 (outline): 2267 Red · ...").
- `entry._mockPlace` + `entry.printLoc`/`entry.printW` → **`Artwork_Locations`** JSON (placement/width/height).
- `currentGarment`/`currentGarmentName` → garment color note.
- Mark it a REFERENCE: render on detail page (`art-request-detail.js`) as a "Rep Reference Mockup (by X)" card + on the print job sheet; **gate on `!isCustomerView`**. Steve's `Final_Approved_Mockup` stays separate/authoritative.
- Reuse EXISTING fields (File_Upload_*, Thread_Colors, Artwork_Locations) — **likely ZERO new Caspio columns** for MVP. If a clean separation is wanted, add one `Rep_Mockup` text field + put it in proxy `art.js` EDITABLE_FIELDS.

**Return path (decide at build):** designer opened in a new tab → on Attach, POST to proxy directly + `window.opener.postMessage(result)` back to the form, OR redirect back to the form with the uploaded path. (Form `garment-submit-form.js` would receive + show "mockup attached".)

## ⏭️ Phase 2 — in-form "Build Mockup" button
Button in `garment-submit-form.js` opens the designer pre-seeded from the form's current garment/color/placement +
decoration=Embroidery; on return, attaches the mockup + specs to the in-progress request before submit.

## Key designer internals (from 2026-06-17 recon)
- Data model: global `entries[]`; each entry `{ printLoc, printW, artDX, artDY, canvas, mockCanvas, kind:'dst'|'pdf'|'image', dstThreads[], dstElements[], palette[], _mockPlace }`.
- Garment color: `currentGarment` (hex/'checker') via `setStageBg()`; `PC61_COLORS[]` (62 colors), `GARMENT_COLORS[]` quick picks.
- Placement presets: `placementDefaults(loc)` (Left Chest 3.75", Upper Back 11.5", Full Front/Back 12").
- Render: `rebuildMockup()` → `composeDrawnMock()` (drawn shirt) or `composePhotoMock()` (photo). Output via `getCleanMock(entry)` (no selection chrome) → `.toDataURL()/.toBlob()`.
- DST: `parseDSTArrayBuffer()`, `renderDSTCanvas()`, `openDST()`; threads `updateDSTThreadColor()`/`updateDSTThreadElement()`; 52 hardcoded RA-Poly threads; proof `buildProofSheet()` → `window.print()`.
- NO URL params / postMessage / localStorage today — pre-seed must be ADDED.

## NWCA integration anchors
- Precedent: JDS Mockup Creator = standalone page + nav link, downloads PNG, NO backend submit. We go further (attach).
- File upload: `/api/files/upload` → `/Artwork/{fileName}`; CDN_Link formula derives URL. See `memory/ARTREQUESTS_FILE_UPLOAD_GUIDE.md`.
- Form payload pattern: `garment-submit-form.js` buildPayload (File_Upload_One..Four, Artwork_Locations, Thread_Colors).
- Detail render: `art-request-detail.js` renderMockupGallery / renderArtSpecs (add a Rep-Reference card).

## 🔍 FULL AUDIT + USABILITY ROADMAP (2026-06-20, 47-agent workflow, 73 findings / 32 confirmed high-crit)
Erik's vision: AE tool to (1) upload art (2) remove white BG (3) place on shirt mockup (4) SEND to customer (5) SAVE for reuse (6) FORWARD to Steve + complete his art form. Audit verdict vs the 6 steps: **1 Works · 2 Partial (engine great, controls hidden) · 3 Works (standout) · 4 MISSING · 5 Partial · 6 Half (attach works, create-new doesn't).**

**ROOT CAUSE (single highest-leverage fix):** `<div class="easy-hidden-tools" aria-hidden="true">` (garment-designer.html:74) hides ~20 controls incl. ALL of Step-2 background removal; CSS `display:none !important` (css:665-667) and **nothing in 5,221 lines of JS ever un-hides it** (grep-verified). The bg-removal ENGINE is excellent (edge-seeded flood-fill `buildKnockout` 2934, 2-color detect, letter-counter recovery, `softenFringe` halo un-mix 4622, auto-knock on white-border upload 781) — it's just unreachable.

**PHASE 1 — ✅ IMPLEMENTED LOCALLY 2026-06-20 (FE `v2026.06.20.1`, NOT yet deployed; browser-verified on preview, zero console errors).** All 8 items below shipped to `pages/garment-designer.{html,js,css}`: visible "⬜ Remove White BG" toolbar button (`removeBgClick`→`toggleKnockout`, label/`aria-pressed` synced via `syncRemoveBgBtn`); auto-knock toast now has a real **Undo** action (`showToast` extended w/ `{label,fn}` + `#toast.has-action{pointer-events:auto}`); auto-knock skips photos (`&& !entry.photographic` at openEntry); `handleFiles` 60MB soft-warning + **sequential** decode (async loop, no OOM); `openEPS()` tries pdf.js then friendly fallback (EPS no longer dead-ends); light-on-light **contrast chip** (`maybeWarnLowContrast`/`artMeanLuminance`/`currentGarmentLuminance` hooked into `rebuildMockup`, `#contrastWarn`); honest copy (killed WOW Mode/"Private & secure"/"nothing uploads"/"Art File Viewer"; proof carries "shown on a PC61 crew tee for reference"); a11y (global `:focus-visible`, `role=status aria-live` toast, `role=img` canvas); `ART_PROXY_BASE` now from `APP_CONFIG.API.BASE_URL` (loaded `/config/app.config.js`) w/ literal fallback. Verified live: white-bg PNG auto-knocks + button reflects state + manual toggle restores/re-removes; contrast chip shows on white shirt, clears on black. **NEXT: deploy (`/deploy`) when Erik approves; then Phase 2.** Detail (original plan):

**PHASE 1 — quick wins (~1-2 days, mostly un-hiding working code):**
1. Surface "Remove White Background" in main toolbar → existing `toggleKnockout()` 3024; make auto-knock toast "Undo" a real link (toast 785 points at the hidden ⬜).
2. `&& !entry.photographic` on auto-knock guard (781; flag computed at 2748, ignored).
3. File-size warning + decode watchdog + sequential decode (`handleFiles` 671-697 has zero size guard; `openEntry` un-awaited at 696 → parallel OOM risk).
4. EPS: remove from accept list (html:319) or pdf.js-decode (currently advertised but hard-rejected 754-759).
5. Light-on-light contrast keyline/warning (multiply blend 3923-3930 has no safeguard; `garmentLooksDark()` 1464 used only for advice text).
6. Kill false/stale copy: proof hardcodes "PC61 Essential Tee" (4828) regardless of garment; landing still says "Nothing uploads to a server"/"Private & secure"/"Art File Viewer"/"WOW Mode" (now false + customer-skinned for an internal tool).
7. A11y quick: one global `:focus-visible` rule (ZERO exist), `role=status aria-live` toast, `role=img`+live label on stage canvas.
8. Move hardcoded `ART_PROXY_BASE` (5133) + `CONTACT_EMAIL` (14) → `APP_CONFIG.API.BASE_URL` (Rule 6) BEFORE building Phase 2 on top.

**PHASE 2 — connect the tools (~1-2 wks, REUSE existing infra, don't build new):**
- **Real "Send to Customer":** the approval pipeline ALREADY EXISTS — `sendForApproval` (art-actions-shared.js:1199-1306) sets "Awaiting Approval"+Approval_Status, logs "Mockup Sent" note, fires `mockup_customer_approval` EmailJS template, drives public `art-tools/art-approval.html` approve/request-changes page. `saveToArtRequest` (5135) already produces the exact public image URL (5167) it consumes. Just pass `imageUrl` in. (emailUs 4947 = mailto to ERIK w/ NO attachment, hidden — delete it.)
- **Real "Send to Steve" (create-new):** designer already computes every field Steve's form needs (meta obj 5179-5190: placement/printWidth/color/DST threads) but throws it away. Add always-visible button → upload PNG → render `GarmentSubmitForm` in a modal **prefilled** (add optional `prefill` param to `init()` 147) with PNG as File_Upload_One.
- De-gate save / add in-tool design-# search (save hard-bails without `?designId`). Backend hardening: `/api/files/*` + PUT `/art-requests/:id/fields` are UNAUTH + CORS `*` (world-readable customer art, world-writable PII by guessing int designId, raw designId in Caspio WHERE) — gate behind staff auth before wider rollout.

**PHASE 3 — bigger bets:** saved-mockup library + re-send; true re-edit (also upload source file — currently discarded, "Open in Designer" reloads EMPTY); more garment styles (only ONE PC61 crew tee exists — fabric dropdown changes advice text only, never silhouette; `recolorFrame` pipeline already handles any solid-color garment photo so it's content+selector); mobile stacking (CSS specificity bug keeps 335px sidebar wide on phone) + externalize ~73% base64 image bloat (816KB JS).

**MOCKUP FIDELITY (Erik emphasized):** strongest part — real PC61 front+back photo chroma-keyed + HSL luminance-preserving recolor (`recolorFrame` 3683) keeps real folds; art multiplied through shade map + mask-clipped so prints sit IN fabric. Weak spots: WHITE shirt forced to flat #FFFFFF (clamp 0.98, 3701) washes folds; heathers go flat (full target sat onto every pixel); white/light art on light shirt vanishes (no contrast guard). Placement/inch-sizing is print-shop-correct (bodyW/22" PPI, Left Chest 3.75" wearer-left offset, un-escapable printZone).

**CRITIC — audit was static reading, NOT runtime.** Untested & worth a live run with a real 5pm-quality file: (a) low-res/blurry JPG has NO print-DPI adequacy check (upscales garbage); (b) JPG compression halo may survive `tol=222`; (c) end-to-end seam — do the SAME knocked-out pixels flow getKnockedArt 3014→getCleanMock 3421→saveToArtRequest→GarmentSubmitForm; (d) front+back two-location job — meta/save records only ONE placement, may drop the 2nd; (e) no remove/replace/start-over affordance (reload = total loss, no persistence); (f) `Rep_Mockup` last-write-wins, no collision check for 2 AEs same designId.
