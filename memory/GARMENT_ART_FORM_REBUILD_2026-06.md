# Garment Art Request Form — Caspio DataPage → Custom API Form (2026-06-17)

Rebuilt the **Submit Artwork to Steve → Garment** workflow from a Caspio DataPage into a
custom, API-driven form so AEs submit **fully structured** art requests. Steve no longer
interprets a free-text `NOTES` dump. Mirrors the existing Sticker/Banner/JDS custom-form
pattern.

## What changed

- **Retired** Caspio DataPage `a0e150009f0e9f9d4ff3457dae47` (was embedded in
  `ae-dashboard.html` `#garment-form-container`). Its enhancement layer
  `ae-submit-form.js` + `screenshot-fill.js` are now **dead code** (unwired; flagged in
  ACTIVE_FILES). Source XML export kept by Erik for reference.
- **New** `shared_components/js/garment-submit-form.js` (`GarmentSubmitForm.init(id)`) +
  `shared_components/css/garment-submit-form.css` (`.gsf-*`). Posts to `POST /api/artrequests`
  (Caspio auto-numbers `PK_ID`/`ID_Design`) + `POST /api/files/upload`. Pickers:
  `CompanyContactPicker`, `DesignNamePicker.lookupByNumber`, `WorkOrderPicker`. EmailJS
  `template_art_note_added`.
- The old **New Artwork / Mockup toggle is gone** — replaced by a single required
  **Artwork Status** dropdown (Erik's call). "Mockup only" is one option; the form adapts
  (Repeat/Revision reveals+requires the prev-order section; Approved gates the full AE checklist).

## Caspio columns Erik added to `ArtRequests` (Text unless noted)
`Artwork_Status, Approval_Status, Color_Mode, PMS_Colors, Thread_Colors, Underbase_Required(20),
Exact_Text(64000), Prev_Order_Num(50), Prev_Design_Num(50), Repeat_Keep_Same(500),
Repeat_Change(64000), Uploaded_File_Type, AE_Checklist_Confirmed(Yes/No),
AE_Checklist_Confirmed_By, Artwork_Locations(64000 — JSON)`.
**Decoration method reuses `Order_Type_Source`** (Order_Type is REST-unwriteable). Per-location
placement/size/instructions is a **JSON array** in `Artwork_Locations` (not per-location columns).

## Downstream surfaces updated to render the new fields (all custom JS)
- **`pages/js/art-request-detail.js` + `.html` + `.css`** — new "Art Specifications" card
  (`renderArtSpecs`): locations table from `Artwork_Locations` JSON, color/thread/underbase,
  amber-highlighted Exact Text, prev-order ref, file type, AE-checklist badge. Artwork/Approval
  **status pills** in the title row (`renderStatusPills`). Approval pill + checklist line hidden
  in `?view=customer`.
- **Steve gallery** `art-hub-steve-gallery.js` (buildCard) + **kanban** `art-hub-steve.js`
  (renderCardHtml) — compact Artwork/Approval badges. **AE gallery** `art-ae.js` (buildCard) +
  **review tab** `ae-dashboard.js` (loadReviewTab).
- **Approval_Status auto-write**: Steve "Send Mockup" → `Customer reviewing proof`
  (`art-actions-shared.js`); AE approve → `Customer approved — ready for production`
  (`art-request-detail.js approveDesign`). Both fire-and-forget `PUT /fields`.
- **Backend** `caspio-pricing-proxy/src/routes/art.js` — added all 15 fields to
  `EDITABLE_FIELDS` so detail-page edits + status flows persist them.
- **Ruth parity (render-only)** `mockup-ruth.js` + `mockup-ae.js` — surface thread colors on
  mockup cards by parsing the existing `AE_Notes` "Thread Colors:" block (prefers a
  `Thread_Colors` column if it ever exists). **No `Digitizing_Mockups` schema change** — the
  mockup `POST /api/mockups` passes fields straight to Caspio, so adding a column to the payload
  would 500 an active form. Render-only is zero-risk.

## Gotchas / rules (don't relearn)
- **SELECT-fallback sync**: galleries fetch with the new fields in the **primary select only**;
  on 500 (columns missing pre-migration) they fall back to a select without them. `art-ae.js`
  derives `SELECT_FIELDS_LEGACY` from `SELECT_FIELDS` via `.replace` — the new fields are
  stripped there too. `ae-dashboard.js` review tab got an explicit retry-without-`Approval_Status`.
- **Mockup POST has no field whitelist** — it spreads `req.body` to Caspio. Never add a payload
  field that needs a not-yet-existing column to an active form.
- Garment Style→Color cascade uses `/api/stylesearch` + `/api/product-colors` (same as DTG/DTF/EMB).
- Placement list is curated in-form (no Logo_Positions endpoint).
- `GarmentColor` stores `COLOR_NAME` (UI display), matching the old DataPage.

## Tests / docs
- `tests/unit/garment-submit-form-payload.test.js` — locks the POST payload contract (node env,
  document stub via `_buildPayloadForTest`; 3 tests green).
- AE guide: `training/garment-art-request-guide.md`.

## Verified (local preview)
Form renders (11 sections, adaptive logic, validation, Style→Color); detail-page Art Spec card +
pills; Steve gallery (30 cards) + AE gallery (8) badges; Ruth thread row live on 28/90 real
records — all with zero console errors.

## SHIPPED LIVE 2026-06-17 — FE `v2026.06.17.5` (rel 1376) + proxy v813
Erik added all 15 `ArtRequests` cols. Deployed via `/deploy` (cache-bust to ?v=2026.06.17.5 across
ae-dashboard/art-hub-steve/art-hub-ruth/art-request-detail/mockup-detail). Production-verified by a
4-agent sweep: all pages 200 + new ?v=; served JS/CSS contain new markers (not stale slug);
proxy POST→PUT `/fields`→GET→DELETE round-trip clean (PUT whitelist v813 accepts the new cols);
form-dep endpoints + new-col SELECT all 200 (not 500). Test records 52991/52992/52993 deleted.

## Laser Leatherette Patch decoration method — ADDED 2026-06-18 (front-end only, no Caspio change)
New decoration method for laser-engraved leatherette patches applied to caps. Erik-confirmed
design (3 AskUserQuestion answers): **ship now, no Caspio columns**; capture material/shape/
size/edge; offer 4 attachment options.

- **`garment-submit-form.js`**: `'Laser Leatherette Patch'` added to `DECORATION_METHODS`. New
  conditional **"Laser Leatherette Patch Specs"** panel (`buildPatchSection`, `#gsf-patch-section`)
  inserted between Decoration (3) and Garment (4) — **NON-numbered** (leather `.gsf-patch-badge`
  🪡) so it doesn't disturb the 1–11 numbering that `findSectionByNum('8')` + checklist depend on.
  Fields: Leatherette Color (`PATCH_MATERIALS` list + "Other — specify exact stock" → reveals
  `#gsf-patch-material-other`), Patch Shape, Width"/Height", Edge/Border Finish, Attachment to Cap.
  Shown/hidden via `applyPatchVisibility()` on any `.gsf-decoration` change; "Other" text via
  `applyPatchMaterialOther()`. Required-when-picked validation in `validate()` (material/shape/
  width/attach + other-text).
- **Storage = existing columns ONLY (no new Caspio fields):** `buildPayload` builds `patchSpec`
  (empty keys dropped) and (a) attaches it as a nested `patch` object on each kept
  `Artwork_Locations` entry, back-filling the placement width/height from the patch size when
  blank (synthesizes a `Cap Front` entry if no placement given so specs are never lost); and
  (b) prepends a readable `LASER LEATHERETTE PATCH` block to `NOTES` for surfaces that don't
  parse the JSON. Method name rides in `Order_Type_Source` → **auto-renders as a badge** on
  Steve/AE galleries + kanban with zero gallery changes.
- **`art-request-detail.js`**: `findPatchSpec(locs)` helper; `renderArtSpecs` adds a "Laser
  Leatherette Patch" subhead block (color/shape/size/edge/attachment) after the locations table;
  `buildPrintSheet` adds a matching `ps-kv` section to the printable Job Sheet.
- **`garment-submit-form.css`**: `.gsf-patch-section` (leather `#8b5e3c` left accent) + `.gsf-patch-badge`.
- **Tests**: 2 new cases in `garment-submit-form-payload.test.js` (patch specs in Artwork_Locations
  + NOTES + size back-fill; "Other" material) — **5/5 green**. Existing 3 unaffected (patch keys
  only appear when the method is picked).
- **Verified (local preview harness)**: panel hidden by default, reveals on check, hides on uncheck,
  "Other" toggle works, all option lists correct, renders cleanly in the form's 2-col grid, zero
  console errors.
- **SHIPPED LIVE 2026-06-18 — FE `v2026.06.18.8` (Heroku rel 1391).** Prod-verified: ae-dashboard +
  art-request-detail serve `?v=2026.06.18.8`; live `garment-submit-form.js` + `art-request-detail.js`
  contain the patch markers (not a stale slug). Tests 49 suites / 1363 green; parser gate 792 green.
- **Leatherette color list** lives only in `PATCH_MATERIALS` (JS array) — Erik can edit it; no
  Caspio dependency. **Old pre-2026-06-18 records** simply have no `patch` in their locations →
  the new blocks correctly stay hidden.

## Notifications — DECIDED 2026-06-17 (keep as-is; do NOT "restore" the dropped bits)
Garment form intentionally matches the Sticker/Banner/JDS pattern, NOT the retired DataPage:
- EmailJS (`service_jgrave3`/`template_art_note_added`): Steve `art@` + AE confirmation + sales-rep CC — same as before.
- Backend Slack now fires for garment (`notifyArtRequestSubmission` + `notifyRushArtRequest`) because it routes through the proxy POST — the old DataPage bypassed the proxy so it never did. Intentional improvement (uniform across all 4 item types).
- DROPPED on purpose (custom forms never had them): the `/api/art-notifications` dashboard toast, and the separate `sendRushConfirmation` rush EMAIL (rush is now the Slack ping). Erik confirmed keep-as-is — do NOT re-add as a "regression fix."
