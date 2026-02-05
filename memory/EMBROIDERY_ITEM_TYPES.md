# Embroidery ItemTypes Reference

**Created:** 2026-02-04
**Purpose:** Canonical reference for `Embroidery_Costs` table ItemTypes. Prevents duplicate records and documents API usage.

---

## Quick Reference

| ItemType | Purpose | Base Stitches | Used By |
|----------|---------|---------------|---------|
| **Shirt** | Contract garment (labor only) | 8,000 | pricing-bundle EMB |
| **Cap** | Contract cap (labor only) | 8,000 | pricing-bundle CAP |
| **AL** | Additional Logo (garment) | 8,000 | al-pricing, pricing-bundle EMB-AL |
| **AL-CAP** | Additional Logo (cap) | 5,000 | al-pricing, pricing-bundle CAP-AL |
| **FB** | Full Back (per-1K rate) | 25,000 | al-pricing |
| **CTR-Garmt** | Contract garment (detailed stitch rows) | varies | contract-pricing |
| **CTR-Cap** | Contract cap (detailed stitch rows) | varies | contract-pricing |
| **CTR-FB** | Contract Full Back | 25,000 | contract-pricing |
| **DECG-Garmt** | Customer-supplied garment (DECG) | 8,000 | decg-pricing |
| **DECG-Cap** | Customer-supplied cap (DECG) | 8,000 | decg-pricing |
| **DECG-FB** | Customer-supplied Full Back | 25,000 | decg-pricing |
| **3D-Puff** | Add-on service (cap puff embroidery) | 0 | pricing-bundle CAP-PUFF |
| **Patch** | Add-on service (laser patch) | 0 | pricing-bundle PATCH |

---

## Detailed ItemType Specifications

### Standard Contract Embroidery

#### Shirt
- **Purpose:** Contract garment embroidery (labor + margin)
- **Base Stitches:** 8,000
- **Stitch Increment:** 1,000
- **Additional Stitch Rate:** $1.25/1K
- **Tiers:** 1-7, 8-23, 24-47, 48-71, 72+
- **LTM:** $50 on 1-7 tier only
- **API Endpoint:** `/api/pricing-bundle?method=EMB`
- **Frontend:** Quote builders, embroidery calculator

#### Cap
- **Purpose:** Contract cap embroidery (labor + margin)
- **Base Stitches:** 8,000
- **Stitch Increment:** 1,000
- **Additional Stitch Rate:** $1.00/1K (different from garments!)
- **Tiers:** 1-7, 8-23, 24-47, 48-71, 72+
- **LTM:** $50 on 1-7 tier only
- **API Endpoint:** `/api/pricing-bundle?method=CAP`
- **Frontend:** Quote builders, embroidery calculator

### Additional Logo (AL) Types

#### AL (Additional Logo - Garment)
- **Purpose:** Second/third logo position on garments
- **Base Stitches:** 8,000
- **Stitch Increment:** 1,000
- **Additional Stitch Rate:** $1.25/1K
- **Tiers:** 1-7, 8-23, 24-47, 48-71, 72+
- **LTM:** Not applicable (part of main order)
- **API Endpoint:** `/api/pricing-bundle?method=EMB-AL`, `/api/al-pricing`
- **Frontend:** AL pricing page, quote builders

#### AL-CAP (Additional Logo - Cap)
- **Purpose:** Second/third logo position on caps (back, side)
- **Base Stitches:** 5,000 (NOT 8,000!)
- **Stitch Increment:** 1,000
- **Additional Stitch Rate:** $1.00/1K
- **Tiers:** 1-7, 8-23, 24-47, 48-71, 72+
- **LTM:** Not applicable (part of main order)
- **API Endpoint:** `/api/pricing-bundle?method=CAP-AL`, `/api/al-pricing`
- **Frontend:** AL pricing page, quote builders

### Full Back Position

#### FB (Full Back)
- **Purpose:** Large back embroidery position
- **Base Stitches:** 25,000 minimum
- **Pricing Method:** Per-1K rate (ALL stitches charged, not just excess)
- **Additional Stitch Rate:** $1.25/1K
- **Tiers:** Single "ALL" tier
- **LTM:** $50 (on ALL tier)
- **API Endpoint:** `/api/al-pricing`
- **Frontend:** AL pricing page, quote builders

### Contract Pricing (Detailed)

These ItemTypes store explicit rows for each stitch count (5K-15K), used for detailed contract pricing displays.

#### CTR-Garmt
- **Purpose:** Contract garment with explicit stitch counts
- **Stitch Counts:** 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 15000
- **Tiers:** 1-7, 8-23, 24-47, 48-71, 72+ (per stitch count)
- **API Endpoint:** `/api/contract-pricing`
- **Frontend:** Contract pricing page

#### CTR-Cap
- **Purpose:** Contract cap with explicit stitch counts
- **Stitch Counts:** 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 15000
- **Tiers:** 1-7, 8-23, 24-47, 48-71, 72+ (per stitch count)
- **API Endpoint:** `/api/contract-pricing`
- **Frontend:** Contract pricing page

#### CTR-FB
- **Purpose:** Contract Full Back
- **Base Stitches:** 25,000
- **Tiers:** 1-7, 8-23, 24-47, 48-71, 72+
- **API Endpoint:** `/api/contract-pricing`
- **Frontend:** Contract pricing page

### Customer-Supplied (DECG) Types

#### DECG-Garmt
- **Purpose:** Customer-supplied garment embroidery (labor only, no garment cost)
- **Base Stitches:** 8,000
- **Additional Stitch Rate:** $1.25/1K
- **Tiers:** 1-7, 8-23, 24-47, 48-71, 72+
- **LTM:** $50 on 1-7 tier
- **API Endpoint:** `/api/decg-pricing`
- **Frontend:** DECG pricing page

#### DECG-Cap
- **Purpose:** Customer-supplied cap embroidery (labor only)
- **Base Stitches:** 8,000
- **Additional Stitch Rate:** $1.00/1K
- **Tiers:** 1-7, 8-23, 24-47, 48-71, 72+
- **LTM:** $50 on 1-7 tier
- **API Endpoint:** `/api/decg-pricing`
- **Frontend:** DECG pricing page

#### DECG-FB
- **Purpose:** Customer-supplied Full Back embroidery
- **Base Stitches:** 25,000
- **Tiers:** 1-7, 8-23, 24-47, 48-71, 72+ (1-7 tier added 2026-02-04)
- **LTM:** $50 on 1-7 tier
- **API Endpoint:** `/api/decg-pricing`
- **Frontend:** DECG pricing page

### Add-On Services

#### 3D-Puff
- **Purpose:** 3D puff embroidery upcharge for caps
- **Stitch Count:** 0 (not stitch-based)
- **Tiers:** Single "ALL" tier
- **Upcharge:** $5.00/cap
- **LTM:** $50 (why on ALL? Legacy - consider removing)
- **API Endpoint:** `/api/pricing-bundle?method=CAP-PUFF`

#### Patch
- **Purpose:** Laser leatherette patch upcharge
- **Stitch Count:** 0 (not stitch-based)
- **Tiers:** Single "ALL" tier
- **Upcharge:** $5.00/piece
- **Setup Fee:** $50 (GRT-50, not $100 digitizing)
- **LTM:** $50 (why on ALL? Legacy - consider removing)
- **API Endpoint:** `/api/pricing-bundle?method=PATCH`

---

## Deleted/Deprecated ItemTypes

These ItemTypes were removed from `Embroidery_Costs` on 2026-02-04:

| ItemType | Reason | Replaced By |
|----------|--------|-------------|
| ~~CB~~ | Cap Back - legacy, unused | AL-CAP |
| ~~CS~~ | Cap Side - legacy, unused | AL-CAP |

---

## Data Integrity Rules

### Unique Constraint (Caspio)
A unique constraint exists via a **formula field** `Unique_Constraint` with the formula:
```
[@field:ItemType] + '-' + CAST([@field:StitchCount] AS VARCHAR) + '-' + [@field:TierLabel]
```

This produces values like `AL-8000-1-7`, `DECG-FB-25000-72+`, etc. The field is marked as **Unique** in Caspio table design, preventing duplicate records.

**Added:** 2026-02-04

### Required Tiers
Each ItemType (except FB, 3D-Puff, Patch) MUST have all 5 tiers:
- 1-7
- 8-23
- 24-47
- 48-71
- 72+

### LTM Rules
- LTM = $50 ONLY on tier "1-7"
- LTM = $0 on all other tiers
- Exception: FB, 3D-Puff, Patch have LTM on "ALL" tier (legacy behavior)

### Before Adding New ItemTypes

1. **Check this reference** - Does the ItemType already exist?
2. **Check API usage** - Which endpoint will query this ItemType?
3. **Add all 5 tiers** - Don't create incomplete records
4. **Set correct LTM** - $50 on 1-7 tier only
5. **Update this document** - Add the new ItemType to the reference

### Before Updating Prices

Use UPSERT pattern, never blind INSERT:

```javascript
// Before inserting, check if record exists
const existing = await caspio.getRecords('Embroidery_Costs', {
  where: `ItemType='${itemType}' AND StitchCount=${stitches} AND TierLabel='${tier}'`
});

if (existing.length > 0) {
  // UPDATE existing record
  await caspio.updateRecord('Embroidery_Costs', existing[0].EmbroideryCostID, newData);
} else {
  // INSERT new record
  await caspio.createRecord('Embroidery_Costs', newData);
}
```

---

## Cleanup History

### 2026-02-04: Duplicate/Legacy Cleanup + Unique Constraint

**Script Executed:** `node tests/scripts/cleanup-embroidery-costs.js`
- Deleted 19 duplicate/legacy records
- Added DECG-FB 1-7 tier

**Unique Constraint Added:** Formula field `Unique_Constraint` with Unique checkbox enabled in Caspio DataHub.

**Final Cleanup (same day):**
- Deleted orphan ID 56 (AL-5000-72+ - wrong stitch count)
- Deleted orphan ID 71 (CS-5000-72+ - deprecated)
- Added missing AL-8000-72+ ($7.00) to complete AL tiers

**Records Added:**
| ItemType | StitchCount | Tier | Price | LTM |
|----------|-------------|------|-------|-----|
| DECG-FB | 25000 | 1-7 | $1.50/1K | $50 |
| AL | 8000 | 72+ | $7.00 | $0 |

---

## Related Documentation

- [EMBROIDERY_PRICING_RULES.md](./EMBROIDERY_PRICING_RULES.md) - Complete pricing formulas
- [EMBROIDERY_PRICING_2026.md](./EMBROIDERY_PRICING_2026.md) - Feb 2026 tier restructure
- [DECG_PRICING_2026.md](./DECG_PRICING_2026.md) - Customer-supplied pricing
- [SERVICE_CODES_TABLE.md](./SERVICE_CODES_TABLE.md) - Service codes reference

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-04 | Initial documentation created after duplicate cleanup |
| 2026-02-04 | Added unique constraint formula field documentation |
| 2026-02-04 | Deleted orphan records (IDs 56, 71), added missing AL-8000-72+ |
