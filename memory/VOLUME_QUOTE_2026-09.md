# Volume Quote — one-time pricing for large embroidery orders (2026-09-02)

Companion to `EMBROIDERY_PRICING_REALIZATION.md` and `COST_ALLOCATION_MODEL.md`. Built from
Taneisha's Braun Northwest request (500 pcs, left chest, design 40514, 4,729 stitches).

## The problem the tool answers

- **The embroidery price list tops out at the 72+ tier.** 500 pieces prices exactly like 72.
- **The flat per-piece embroidery charge assumes a logo near the 8,000-stitch base**
  (`Embroidery_Costs` Shirt rows: `BaseStitchCount` 8,000 — the 10,000 base is on the AS /
  additional-logo rows). A 4,729-stitch logo runs in ~59% of the machine time but is charged
  the same $12 at 72+.
- Erik wants ONE admin place to build a one-time price, see what it costs in margin, and hand
  the rep a **written reason** so the price never turns into a new price list.

## Numbers behind the Braun answer (live Caspio 2026-09-02)

| style | SanMar case / piece | standard 72+ (S-XL) | emb $10 | emb $9.50 + denom 0.57 |
|---|---|---|---|---|
| 1566 Comfort Colors crew | $20.89 / $24.89 | $51.50 | $49.50 | $46.50 |
| 1580 Comfort Colors 1/4-zip | $25.88 / $29.88 | $61.00 | $59.00 | $55.00 |
| CTC86912 Carhartt 1/2-zip | $39.00 / $43.00 | $86.00 | $84.00 | $78.00 |

- 2XL +$2, 3XL +$3 (relative upcharge). No stitch surcharge (< 8K), no setup (design 40514
  already digitized; Braun paid the $100 on WO 141973).
- **Decoration cost at 500 pcs ≈ $1.45/pc** (77 min setup + 3.97 min/pc × 59% ≈ 20.8 machine
  hours × $30.09 + $100 order cost). $12 charged = 87% margin on the decoration line, so a
  $9–10 volume embroidery charge is still 83–85%.
- **Garment margin is the expensive lever.** Denominator 0.53 → 0.57 costs ~2.5× more per
  order than the $2 embroidery break for the same "we gave you a deal" effect. Erik's
  guidance: lead with embroidery-only; garment move only on pushback; never past 0.60.
- Braun context: 27 orders / ~$71K since Jan 2026, all Taneisha. Prior LC garment order (L508,
  WO 141973) billed $45 vs $52 list. Samples on WO 142964 were billed at PIECE cost — do not
  anchor on them. Stock: 1580 True Navy only 3,558 nationally, Seattle 0 in every navy.

## The tool — `/dashboards/volume-quote.html` (Admin → Money & Payroll, admin-only) — LIVE `v2026.09.02.7` (Heroku v1907, SHA 39f4847, verified 2026-09-02)

- Inputs: customer, rep, location, stitch count, design #, digitized?, valid-until, hold-qty;
  N garment lines (style + qty). Per style it loads `/api/pricing-bundle?method=EMB`
  (tiers, MarginDenominator, Shirt 72+ EmbroideryCost, CASE price), `/api/product-details`
  (PIECE price, title) and `/api/sanmar/inventory/:style` (stock, top 3 colours).
- Levers: embroidery $/pc (default = Caspio 72+), garment denominator slider (default = Caspio
  tier value; max = `VOL-DENOM-FLOOR`).
- Output: standard vs one-time per size, garment $ margin/pc, GM %, order $ both ways,
  "given up", and an **approval memo** (copy/print) with numbered reasons + terms.
- **Saved as a real quote (added same day, Erik: "is the quote saved?")** — `VQ-YYYY-NNN` minted by
  `/api/quote-sequence/VQ`; `quote_sessions` (customer-safe Notes with the hold-qty/valid-until terms)
  + one `quote_items` row per style at the one-time S-XL price (`PricingTier` "Volume (one-time)",
  2XL/3XL + standard price in `SizeBreakdown`). Internal levers/hours/GM go in item 1 `LogoSpecs`
  JSON — 🔴 never in Notes, which can surface on customer-facing quote views. Quote Mgmt opens VQ
  read-only (`quote-management.js` STK/PATCH branch); prefix registered in `config/app.config.js`
  PREFIXES, `quote-formatter.js`, CLAUDE.md.
- **Customer PDF**: section 6 renders a prices-and-terms sheet (no cost/margin/levers); "Print /
  save as PDF" prints only that card (`body.vq-mode-customer`), the memo prints via `vq-mode-memo`.
- Price math mirrors `embroidery-pricing-service.js` (case ÷ denom + emb, half-dollar ceil,
  relative upcharge) — verified identical to the earlier hand calc on all 3 styles.

## Cost model = Caspio `Service_Codes` rows, ServiceType `VOLUME` (Erik-editable, no deploy)

🔴 **The page has NO built-in constants** — its `.js` is served anonymously (`/dashboards`
gates `.html` only), so the hour rate lives in Caspio. Missing rows ⇒ red banner, prices still
compute, cost/margin show n/a. Values from `COST_ALLOCATION_MODEL.md` (settled 2026-07-30):

| ServiceCode | SellPrice | StitchBase | meaning |
|---|---|---|---|
| `VOL-HOUR-RATE` | 30.09 | — | $ per machine hour (production pool incl. Steve's art) |
| `VOL-ORDER-COST` | 100 | — | $ per order (driver-based; $70 flat alternative) |
| `VOL-SETUP-MIN` | 77 | — | minutes per order before the first piece (S = 1.279 hr) |
| `VOL-MIN-PER-PC` | 3.97 | 8000 | minutes per piece at StitchBase (v = 0.0661 hr/pc); scaled by stitches/base, 50% floor |
| `VOL-MIN-GM` | 45 | — | % gross-margin floor — page warns red below it |
| `VOL-MIN-QTY` | 144 | — | pieces on one PO before a one-time price is considered |
| `VOL-DENOM-FLOOR` | 0.60 | — | largest garment denominator allowed (40% garment margin) |
| `VOL-SPM` | 500 | — | sewing speed (ShopWorks `Machines`: every head 500 spm; Erik 2026-09-02) |
| `VOL-HEADS-WORST` | 4 | — | heads on the worst machine the job could land on (the 4-head #1) |
| `VOL-HANDLING-MIN` | **2.4** (was 1.0; Erik 2026-09-02) | — | hoop/unhoop/trim/inspect minutes per piece (log fit) |
| `VOL-SLACK` | 50 | — | % added to sewing + handling + setup for breaks/rehoops/downtime |

**Worst case (added 2026-09-02, Erik: "include slack time and worst production case scenarios")**:
`minWorst = (stitches ÷ (SPM × heads) + handling) × (1 + slack)`; the page prices against
`max(fitted, worst)` and the memo states both. Braun 4,800 st: worst 5.1 min/pc → 44 h → $2.87/pc
vs typical 2.4 min/pc → $1.47/pc. Evidence from `ProductionLogDetails` 2024-01→2026-09 (3,688 logged
orders, min/pc = Σhours×60 ÷ Σqty): **144+ pcs p50 3.50 · p75 4.67 · p90 5.99 · p95 6.65**; 72-143 p50
4.20 / p90 7.12; 1-7 p50 11.7. So worst-case ≈ p90 of real large orders. 🔑 Logging RESUMED Aug 2026
(118 rows) after the May gap. Pay 17 cross-check: production wages $21.48/h, loaded $23.42 (8 emb
staff), $25.23 incl. digital print + art — $30.09 stays (adds factory expense, per clocked hour).

Category `Volume Quote`, PricingMethod `FLAT`, PerUnit descriptive, `Visible` false,
`IsActive` true. ✅ Rows created 2026-09-02 via `POST /api/service-codes` (Erik approved). Edit values in Caspio; the page reads them with `?type=VOLUME` on every load, no deploy.
