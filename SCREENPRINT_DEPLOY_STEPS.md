# Screen Print Workflow — Deploy Steps

The frontend (this repo) and backend (`caspio-pricing-proxy` repo) are both fully wired. To go live you need to do **3 things in order**.

---

## Step 1 — Add 3 fields in Caspio (do this first)

**No new tables.** Just 3 new columns on the existing `Transfer_Orders` table:

| Field name | Type | Default | Required? | Purpose |
|---|---|---|---|---|
| `Method` | Text 32 | `Supacolor` | No | Discriminator: `Supacolor` (existing) or `Screen Print` (new). |
| `SP_Notes` | Text 64000 (Long Text) | (blank) | No | Steve's free-text instructions for Bradley/L&P — auto-populated from mockup vision, editable. |
| `SP_Vendor` | Text 64 | `L&P Printing` | No | Subcontract vendor. Single value today, future-proofed. |

**How to add in Caspio:**
1. Open Caspio Bridge → Tables → `Transfer_Orders` → Table Design.
2. Add field → Name: `Method`, Type: Text 255 (or 32 if available), Default Value: `Supacolor`.
3. Repeat for `SP_Notes` (Text 64000) — leave default blank.
4. Repeat for `SP_Vendor` (Text 255) — Default Value: `L&P Printing`.
5. Save the table.

**Backfill existing rows** — In Caspio's SQL DataPage / Direct SQL (or just run an UPDATE via an Action):

```sql
UPDATE Transfer_Orders
SET Method = 'Supacolor'
WHERE Method IS NULL OR Method = '';
```

This makes every existing row explicitly `Supacolor` so the new method-aware code paths classify them correctly.

---

## Step 2 — Deploy the `caspio-pricing-proxy` backend

Already-modified files in `../caspio-pricing-proxy/`:

| File | What changed |
|---|---|
| `src/routes/vision.js` | New `MOCKUP_EXTRACTION_PROMPT_SCREENPRINT` constant. `extractMockupInfo()` now takes a `method` arg (default `'Supacolor'`), swaps prompt + max_tokens, parses the right JSON schema, and namespaces its in-memory cache by method. New `normalizeScreenPrint()` helper. |
| `src/routes/transfer-orders.js` | `/analyze-link` accepts `method` from body. `GET /transfer-orders?method=` filter (treats NULL Method as Supacolor). `POST /transfer-orders` defaults Method to `'Supacolor'`, hard-coerces `Is_Reorder=false` for SP rows, defaults `SP_Vendor='L&P Printing'`. Cache key in analyze-link is now `${method}|${fileId}`. |
| `src/utils/transfer-auto-link.js` | Cron query gains `Method='Supacolor' OR Method IS NULL` clause so SP rows aren't scanned for digit-matching against `Supacolor_Jobs.PO_Number`. |

Deploy via your existing process:
```bash
cd ../caspio-pricing-proxy
git add -A
git commit -m "screen print: vision extraction + method-aware POST/GET/cron"
git push heroku main
```

(Or whatever your normal deploy command is.)

Syntax-checked locally — all 3 files parse cleanly. No new dependencies.

---

## Step 3 — Deploy the frontend (this repo)

Already-modified files:

| File | What changed |
|---|---|
| `dashboards/art-hub-steve.html` | New "Send to Screen Print" button next to existing Supacolor button + cross-link tab to screen-print queue. |
| `dashboards/js/steve-send-screenprint.js` | NEW — opens the modal in `method:'Screen Print'` mode. |
| `dashboards/bradley-screenprint.html` | NEW — Bradley's screen-print queue. |
| `dashboards/js/bradley-screenprint.js` | NEW — queue controller, no Supacolor-specific chrome. |
| `shared_components/js/transfer-actions-shared.js` | Method-aware modal: title/intro/checklist/submit-label switch by method. New SP_Notes textarea (visible for SP only). `analyzeRow()` passes method to backend. `renderMockupSummary()` renders the per-location ink chart for SP. `handleSubmit()` auto-prepends formatted print specs to `SP_Notes`. |
| `pages/js/transfer-detail.js` | `isScreenPrint(rec)` helper. Method-aware breadcrumb. New `renderScreenPrintPanel()` for the SP detail card (vendor + Special Instructions). `renderSupacolorLiveStatus()` early-returns for SP. `renderPoBanner()` 2-state for SP. `renderActionsPanel()` keeps actions visible through Ordered/Shipped for SP, shows "Mark Shipped" / "Mark Received" buttons. |
| `dashboards/bradley-transfers.html`, `dashboards/supacolor-orders.html`, `dashboards/art-hub-steve.html` | Cross-link tab buttons added to `bradley-screenprint.html`. Cache-bust on shared script (`?v=19`). |
| `pages/transfer-detail.html`, `pages/mockup-detail.html`, `pages/art-request-detail.html` | Cache-bust on shared script (`?v=19`). |

Deploy via your existing process (`/deploy` skill or whatever you use).

---

## Step 4 — EmailJS template (optional but recommended)

The frontend uses a separate EmailJS template ID for SP notifications: **`screenprint_requested`**.

Until that template exists in your EmailJS dashboard, SP submissions will log a warning (`"EmailJS screenprint_requested failed: not found"`) but the workflow itself still works — the order lands in Bradley's queue.

To create it: clone the existing `transfer_requested` template in EmailJS, rename to `screenprint_requested`, replace any "Supacolor" copy with "L&P Printing" / "Screen Print", and reference these new template variables when you want them:
- `{{method}}` — always `"Screen Print"` for this template
- `{{sp_vendor}}` — `"L&P Printing"`
- `{{sp_notes}}` — Steve's free-text + auto-extracted print specs
- `{{sp_notes_block_html}}` — pre-rendered HTML block for the body

---

## Verification (after all 3 steps deploy)

1. **Steve side**: Open `/dashboards/art-hub-steve.html`. Click "Send to Screen Print". Modal title says "Send Screen Print to Bradley". SP_Notes textarea visible.

2. **Submit a real SP order**: Pick a screen-print mockup from Box. Vision should auto-fill design#/customer/rep/garment AND populate the SP_Notes textarea with the per-location ink chart. Submit.

3. **Bradley side**: Open `/dashboards/bradley-screenprint.html`. The new order shows in "Requested". Card shows mockup thumbnail, SP_Notes preview pill, vendor label "L&P Printing", **no Supacolor link chip**.

4. **Detail page**: Click the card. Should show Screen Print Order panel with vendor + SP_Notes block, **no Supacolor live status card**, action panel offers "Mark Ordered" → "Mark Shipped" → "Mark Received".

5. **Status flow**: Walk it through Ordered → Shipped → Received. Each transition should succeed; card should leave the active queue once Received.

6. **Legacy regression**: Open any pre-existing Supacolor transfer. Should render exactly as before. Auto-link cron should still work for new Supacolor rows.

---

## Caveats / known limitations

- **Vision call cost** — each mockup analyze runs Claude Haiku 4.5. SP prompt uses 1024 max-tokens (Supacolor uses 512) due to the longer JSON schema. ~$0.001 per analyze, cached for 1hr per `(method, fileId)` key.
- **Cache key change** — `/analyze-link` cache is now `${method}|${fileId}`. Existing cache entries (just `${fileId}`) become unreachable on first deploy and will be re-populated on next analyze. No data loss; just a one-time cache warmup.
- **PMS code accuracy** — vision captures whatever Steve writes in the ink pills. If Steve writes the wrong PMS code, vision faithfully captures it. (Sanity-check at submit by reading the modal summary.)
- **`screenprint_requested` EmailJS template** — until created, the email send will fail silently (non-blocking). The workflow still works.
