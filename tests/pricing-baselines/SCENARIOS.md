# Pricing Baselines — Test Scenarios (Phase 0)

**Purpose**: Lock down each quote builder's current pricing math so any future
refactor can be checked against a known-correct baseline. Erik signs off the
prices ONCE; CI re-runs them on every commit to detect drift.

**Methodology**: Each scenario specifies the EXACT inputs a rep would enter
into the form. Tests load the live builder (via Playwright or live preview
server), simulate the form fill, then capture the displayed price.

**Authoritative price columns**: per-piece price · per-line total · grand
total before tax · LTM applied (Y/N) · tier label (e.g., "24-47").

---

## DTG Quote Builder — 5 scenarios

Style PC54 is the canonical NWCA t-shirt. Locations: LC = Left Chest, FB = Full Back.

| # | Description | Style | Color | Qty | Locations | Sizes |
|---|---|---|---|---|---|---|
| DTG-01 | Small order LC only | PC54 | Athletic Heather | 12 | LC | M:4 L:4 XL:4 |
| DTG-02 | LTM threshold (24 = no fee) | PC54 | Athletic Heather | 24 | LC | M:8 L:8 XL:8 |
| DTG-03 | Multi-location (LC + FB) | PC54 | Athletic Heather | 48 | LC + FB | M:12 L:16 XL:20 |
| DTG-04 | Hoodie larger order | F260 | Charcoal Heather | 72 | LC | M:24 L:24 XL:24 |
| DTG-05 | Extended size mix (upcharges) | PC54 | Black | 12 | LC | M:1 L:1 XL:1 2XL:3 3XL:3 4XL:3 |

---

## EMB (Embroidery) Quote Builder — 7 scenarios

Stitch tiers: <=10k Standard, >10k-15k +per-1K surcharge. LTM threshold qty<=7.
AS-Garm = Additional Stitches garment (per-1K stitch surcharge).
AL = Additional Logo (per-piece additional logo location).

| # | Description | Style | Color | Qty | Locations | Stitches |
|---|---|---|---|---|---|---|
| EMB-01 | Small standard garment | PC54 | Navy | 24 | Left Chest | 8,000 |
| EMB-02 | LTM edge (qty<=7) | PC54 | Black | 7 | Left Chest | 8,000 |
| EMB-03 | Primary + AL right sleeve | PC54 | Athletic Heather | 48 | LC + RS | 8K LC + 5K RS |
| EMB-04 | Full Back (DECG-FB pricing) | PC54 | Black | 24 | Full Back | 15,000 |
| EMB-05 | Cap-only (AS-CAP separate tier) | C112 | Navy | 24 | Cap Front | 8,000 |
| EMB-06 | Beanie (flat headwear distinction) | CP90 | Black | 24 | Beanie Front | 5,000 |
| EMB-07 | Extended sizes 2XL/3XL upcharge | PC54 | Black | 24 | LC | 8K (sizes: M:8 XL:8 2XL:4 3XL:4) |

---

## DTF Quote Builder — 5 scenarios

Location count surcharges: 1 location = base, 2 locations = +X%, 3 locations = +Y%.
Sizes: small = ≤4×4", medium = ≤10×10", large = ≤14×14", jumbo = >14×14".

| # | Description | Style | Color | Qty | Locations |
|---|---|---|---|---|---|
| DTF-01 | Small qty 1 location | PC54 | Navy | 10 | Left Chest (small) |
| DTF-02 | LTM edge | PC54 | Black | 10 | Left Chest (small) |
| DTF-03 | Two locations | PC54 | Black | 24 | LC (small) + FB (large) |
| DTF-04 | Three locations (max) | PC54 | White | 48 | LC + FB + LS (small/large/small) |
| DTF-05 | Jumbo size combo | PC54 | Athletic Heather | 24 | LC (small) + FB (jumbo) |

---

## SCP (Screen Print) Quote Builder — 5 scenarios

Color counts × locations drive the screen charges. Dark garments add flash charge.

| # | Description | Style | Color | Qty | Print Spec |
|---|---|---|---|---|---|
| SCP-01 | Simplest — 1c 1L | PC54 | Black | 24 | 1 color, 1 location (LC) |
| SCP-02 | Multi-color 1 location | PC54 | Navy | 48 | 4 colors, 1 location (FF) |
| SCP-03 | 1c front + 1c back | PC54 | Athletic Heather | 24 | 1c LC + 1c FB |
| SCP-04 | Max colors (6) | PC54 | Black | 48 | 6 colors, 1 location (FF) |
| SCP-05 | Tier break edge (72 vs 73) | PC54 | White | 73 | 2 colors, 1 location (LC) |

---

## Total: 22 scenarios across 4 builders

**Capture format** (`baselines.json`):
```json
{
  "DTG-01": {
    "builder": "DTG",
    "description": "Small order LC only",
    "inputs": { "style": "PC54", "color": "Athletic Heather", "qty": 12, "locations": ["LC"], "sizes": {"M":4,"L":4,"XL":4} },
    "capturedAt": "2026-05-23T...",
    "approvedBy": "erik@nwcustomapparel.com",
    "expected": {
      "perPieceBase": 0,
      "perPieceUpcharges": 0,
      "lineTotal": 0,
      "ltmFee": 0,
      "ltmApplied": false,
      "tier": "12-23",
      "grandTotalBeforeTax": 0,
      "note": "to be filled in by capture script"
    }
  }
}
```

## Sign-off process

1. **Capture script** runs each scenario via the live preview server, records what
   the builder computed → writes to `baselines.captured.json`.
2. **Erik reviews** the JSON. For each entry: "Yep that's right" OR "That should
   be $X, not $Y — investigate."
3. Discrepancies → debugged + fixed before locking baseline.
4. **Lock**: rename `baselines.captured.json` → `baselines.locked.json`, commit.
5. **CI gate**: future commits re-run scenarios; if any captured price differs
   from locked baseline, PR fails with a diff report.

## What this does NOT verify

- Customer-specific pricing overrides (none yet — out of scope)
- Tax computation (covered by separate `tax-rates.test.js`)
- Add-on services like RUSH (separate test)
- ShopWorks push payload accuracy (separate Phase later)
- Quote save/load round-trip (covered by `quote-sessions.test.js`)

## Phase 0a vs 0b

- **Phase 0a (this session)**: Document scenarios + capture first ~10 via preview
  server + Erik signs off + commit as draft baseline.
- **Phase 0b (next session)**: Automate via Playwright or Puppeteer, wire to CI,
  add the remaining 12 scenarios, full sign-off.
