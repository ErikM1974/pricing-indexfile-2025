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

## ⏭️ Phase 1b — NEXT: pre-seed + "Attach to Art Request"
**Pre-seed (open from a request with context):** designer has NO URL parser today — ADD a ~20-line init that reads
`?garment=&color=<hex>&placement=&company=&designId=` on load and calls:
- `setStageBg(hex, null, name)` — garment color
- create/seed an entry, then `applyRecommendedPlacement(entry, placement, true)` + `rebuildMockup(entry)`

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
