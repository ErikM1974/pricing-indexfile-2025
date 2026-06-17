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

## ⏭️ Phase 1b.2 — NEXT: "Save to Art Request" (the attach/save piece) — DESIGN LOCKED (4-agent workflow, 2026-06-17)
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
