# Service_Codes Caspio Table Documentation

**Table Name:** `Service_Codes`
**Database:** Caspio
**Status:** Pending Creation
**Created:** 2026-02-01
**Purpose:** Centralized lookup table for all embroidery service codes, pricing tiers, and fee structures used by the Embroidery Quote Builder and ShopWorks import functionality.

---

## Table Schema

| Column | Data Type | Primary Key | Description |
|--------|-----------|-------------|-------------|
| **ServiceCode** | Text (20) | Yes | Unique identifier for the service (e.g., "AL-1-23", "DGT-001") |
| **ServiceType** | Text (30) | No | Category of service: `DIGITIZING`, `EMBROIDERY`, `DECORATION`, `FEE`, `RUSH` |
| **DisplayName** | Text (50) | No | Human-readable name shown in UI (e.g., "Applique 1-23 pcs") |
| **Category** | Text (20) | No | Grouping for UI display: `Digitizing`, `Apparel Left Chest`, `Flat Back`, `Cap Back`, `Decoration`, `Fees` |
| **PricingMethod** | Text (15) | No | How price is calculated: `FLAT`, `PER_PIECE`, `PER_THOUSAND`, `TIERED` |
| **TierLabel** | Text (15) | No | Quantity range label (e.g., "1-23", "24-47", "72+") |
| **UnitCost** | Number | No | Internal cost (for margin calculations) |
| **SellPrice** | Number | No | Customer-facing price |
| **PerUnit** | Text (15) | No | Unit description: `each`, `per 1000 stitches`, `per location`, `per order` |
| **QuoteBuilderField** | Text (50) | No | Maps to quote builder field name (e.g., "leftChest", "flatBack", "capBack") |
| **Position** | Text (30) | No | Embroidery position code: `LC`, `FB`, `CB`, `FULL`, `CAP`, `OTHER` |
| **StitchBase** | Number | No | Base stitch count for the position (NULL for non-embroidery services) |
| **IsActive** | Boolean | No | Whether this service code is currently available |

---

## Service Code Data

### Digitizing Services (DD)

**Note (2026-02-01):** Digitizing is a FLAT $100 fee handled manually per order. The tiered DGT-001 through DGT-004 codes are obsolete and no longer used.

| ServiceCode | ServiceType | DisplayName | Category | PricingMethod | TierLabel | UnitCost | SellPrice | PerUnit | QuoteBuilderField | Position | StitchBase | IsActive |
|-------------|-------------|-------------|----------|---------------|-----------|----------|-----------|---------|-------------------|----------|------------|----------|
| DD | DIGITIZING | Digitizing | Digitizing | FLAT | - | 0 | 0 | per order | digitizing | - | NULL | TRUE |

### Apparel Left Chest (AL) - Standard Embroidery Tiers

| ServiceCode | ServiceType | DisplayName | Category | PricingMethod | TierLabel | UnitCost | SellPrice | PerUnit | QuoteBuilderField | Position | StitchBase | IsActive |
|-------------|-------------|-------------|----------|---------------|-----------|----------|-----------|---------|-------------------|----------|------------|----------|
| AL-1-23 | EMBROIDERY | Apparel Left Chest 1-23 pcs | Apparel Left Chest | TIERED | 1-23 | 6.75 | 13.50 | each | leftChest | LC | 8000 | TRUE |
| AL-24-47 | EMBROIDERY | Apparel Left Chest 24-47 pcs | Apparel Left Chest | TIERED | 24-47 | 6.25 | 12.50 | each | leftChest | LC | 8000 | TRUE |
| AL-48-71 | EMBROIDERY | Apparel Left Chest 48-71 pcs | Apparel Left Chest | TIERED | 48-71 | 5.25 | 10.50 | each | leftChest | LC | 8000 | TRUE |
| AL-72+ | EMBROIDERY | Apparel Left Chest 72+ pcs | Apparel Left Chest | TIERED | 72+ | 4.75 | 9.50 | each | leftChest | LC | 8000 | TRUE |

### Full Back (FB) - Stitch-Based Pricing

**Note (2026-02-01):** FB uses STITCH-BASED pricing, NOT tiers. ALL stitches charged at $1.25/1K, minimum 25K stitches = $31.25 minimum.

**CRITICAL - Special Handling in Code:**
1. FB pricing is determined by `ServiceCode === 'FB'` only - do NOT filter by `PricingMethod`
2. The API may return `PricingMethod: null` in some cases, so filtering by `STITCH_BASED` can miss the record
3. Unlike other positions (LC, RC, etc.) where only EXCESS stitches over 8K are charged, FB charges for ALL stitches
4. See `/memory/EMBROIDERY_PRICING_RULES.md` for complete Full Back pricing formula

| ServiceCode | ServiceType | DisplayName | Category | PricingMethod | TierLabel | UnitCost | SellPrice | PerUnit | QuoteBuilderField | Position | StitchBase | IsActive |
|-------------|-------------|-------------|----------|---------------|-----------|----------|-----------|---------|-------------------|----------|------------|----------|
| FB | EMBROIDERY | Full Back (Stitch-Based) | Full Back | STITCH_BASED | ALL | 0.625 | 1.25 | per 1000 stitches | fullBack | FB | 25000 | TRUE |

### Cap Back (CB) - Uses Same Tiers as Cap AL

| ServiceCode | ServiceType | DisplayName | Category | PricingMethod | TierLabel | UnitCost | SellPrice | PerUnit | QuoteBuilderField | Position | StitchBase | IsActive |
|-------------|-------------|-------------|----------|---------------|-----------|----------|-----------|---------|-------------------|----------|------------|----------|
| CB-1-23 | EMBROIDERY | Cap Back 1-23 pcs | Cap Back | TIERED | 1-23 | 3.40 | 6.75 | each | capBack | CB | 8000 | TRUE |
| CB-24-47 | EMBROIDERY | Cap Back 24-47 pcs | Cap Back | TIERED | 24-47 | 2.90 | 5.75 | each | capBack | CB | 8000 | TRUE |
| CB-48-71 | EMBROIDERY | Cap Back 48-71 pcs | Cap Back | TIERED | 48-71 | 2.75 | 5.50 | each | capBack | CB | 8000 | TRUE |
| CB-72+ | EMBROIDERY | Cap Back 72+ pcs | Cap Back | TIERED | 72+ | 2.65 | 5.25 | each | capBack | CB | 8000 | TRUE |

### Special Services (Monogram, Name)

| ServiceCode | ServiceType | DisplayName | Category | PricingMethod | TierLabel | UnitCost | SellPrice | PerUnit | QuoteBuilderField | Position | StitchBase | IsActive |
|-------------|-------------|-------------|----------|---------------|-----------|----------|-----------|---------|-------------------|----------|------------|----------|
| Monogram | EMBROIDERY | Monogram (3 letters) | Special | FLAT | - | 6.25 | 12.50 | each | monogram | OTHER | 2000 | TRUE |
| Name | EMBROIDERY | Name Personalization | Special | FLAT | - | 6.25 | 12.50 | each | name | OTHER | 3500 | TRUE |

### Decoration - Garments (DECG) Tiers

| ServiceCode | ServiceType | DisplayName | Category | PricingMethod | TierLabel | UnitCost | SellPrice | PerUnit | QuoteBuilderField | Position | StitchBase | IsActive |
|-------------|-------------|-------------|----------|---------------|-----------|----------|-----------|---------|-------------------|----------|------------|----------|
| DECG-1-2 | DECORATION | Garment Decoration 1-2 pcs | Decoration Garments | TIERED | 1-2 | 22.50 | 45.00 | each | decorationGarment | FULL | 10000 | TRUE |
| DECG-3-5 | DECORATION | Garment Decoration 3-5 pcs | Decoration Garments | TIERED | 3-5 | 20.00 | 40.00 | each | decorationGarment | FULL | 10000 | TRUE |
| DECG-6-11 | DECORATION | Garment Decoration 6-11 pcs | Decoration Garments | TIERED | 6-11 | 19.00 | 38.00 | each | decorationGarment | FULL | 10000 | TRUE |
| DECG-12-23 | DECORATION | Garment Decoration 12-23 pcs | Decoration Garments | TIERED | 12-23 | 16.00 | 32.00 | each | decorationGarment | FULL | 10000 | TRUE |
| DECG-24-71 | DECORATION | Garment Decoration 24-71 pcs | Decoration Garments | TIERED | 24-71 | 15.00 | 30.00 | each | decorationGarment | FULL | 10000 | TRUE |
| DECG-72-143 | DECORATION | Garment Decoration 72-143 pcs | Decoration Garments | TIERED | 72-143 | 12.50 | 25.00 | each | decorationGarment | FULL | 10000 | TRUE |
| DECG-144+ | DECORATION | Garment Decoration 144+ pcs | Decoration Garments | TIERED | 144+ | 7.50 | 15.00 | each | decorationGarment | FULL | 10000 | TRUE |

### Decoration - Caps (DECC) Tiers (~20% Lower Than Garments)

| ServiceCode | ServiceType | DisplayName | Category | PricingMethod | TierLabel | UnitCost | SellPrice | PerUnit | QuoteBuilderField | Position | StitchBase | IsActive |
|-------------|-------------|-------------|----------|---------------|-----------|----------|-----------|---------|-------------------|----------|------------|----------|
| DECC-1-2 | DECORATION | Cap Decoration 1-2 pcs | Decoration Caps | TIERED | 1-2 | 18.00 | 36.00 | each | decorationCap | CAP | 8000 | TRUE |
| DECC-3-5 | DECORATION | Cap Decoration 3-5 pcs | Decoration Caps | TIERED | 3-5 | 16.00 | 32.00 | each | decorationCap | CAP | 8000 | TRUE |
| DECC-6-11 | DECORATION | Cap Decoration 6-11 pcs | Decoration Caps | TIERED | 6-11 | 15.00 | 30.00 | each | decorationCap | CAP | 8000 | TRUE |
| DECC-12-23 | DECORATION | Cap Decoration 12-23 pcs | Decoration Caps | TIERED | 12-23 | 12.50 | 25.00 | each | decorationCap | CAP | 8000 | TRUE |
| DECC-24-71 | DECORATION | Cap Decoration 24-71 pcs | Decoration Caps | TIERED | 24-71 | 12.00 | 24.00 | each | decorationCap | CAP | 8000 | TRUE |
| DECC-72-143 | DECORATION | Cap Decoration 72-143 pcs | Decoration Caps | TIERED | 72-143 | 10.00 | 20.00 | each | decorationCap | CAP | 8000 | TRUE |
| DECC-144+ | DECORATION | Cap Decoration 144+ pcs | Decoration Caps | TIERED | 144+ | 6.00 | 12.00 | each | decorationCap | CAP | 8000 | TRUE |

### Fees (GRT, RUSH, LTM, ART, SEG)

| ServiceCode | ServiceType | DisplayName | Category | PricingMethod | TierLabel | UnitCost | SellPrice | PerUnit | QuoteBuilderField | Position | StitchBase | IsActive |
|-------------|-------------|-------------|----------|---------------|-----------|----------|-----------|---------|-------------------|----------|------------|----------|
| GRT-50 | FEE | Setup Fee (Standard) | Fees | FLAT | - | 25.00 | 50.00 | per order | setupFee | - | NULL | TRUE |
| GRT-75 | FEE | Design Prep Fee | Fees | FLAT | - | 37.50 | 75.00 | per hour | designPrepFee | - | NULL | TRUE |
| RUSH | RUSH | Rush Order Fee | Fees | FLAT | - | 0 | 50.00 | per order | rushFee | - | NULL | TRUE |
| LTM | FEE | Less Than Minimum Fee | Fees | FLAT | - | 25.00 | 50.00 | per order | ltmFee | - | NULL | TRUE |
| ART | FEE | Art Charge | Fees | FLAT | - | 0 | 0 | varies | artCharge | - | NULL | TRUE |
| SEG | FEE | Sew Emblems to Garments | Fees | FLAT | - | 2.50 | 5.00 | per emblem | sewingFee | - | NULL | TRUE |

### Configuration Values (CONFIG)

| ServiceCode | ServiceType | DisplayName | Category | PricingMethod | TierLabel | UnitCost | SellPrice | PerUnit | QuoteBuilderField | Position | StitchBase | IsActive |
|-------------|-------------|-------------|----------|---------------|-----------|----------|-----------|---------|-------------------|----------|------------|----------|
| STITCH-RATE | CONFIG | Garment Stitch Rate | Config | CONFIG | - | 0.625 | 1.25 | per 1000 stitches | additionalStitchRate | - | 8000 | TRUE |
| CAP-STITCH-RATE | CONFIG | Cap Stitch Rate | Config | CONFIG | - | 0.50 | 1.00 | per 1000 stitches | capAdditionalStitchRate | - | 5000 | TRUE |
| PUFF-UPCHARGE | CONFIG | 3D Puff Upcharge | Config | CONFIG | - | 2.50 | 5.00 | per cap | puffUpchargePerCap | - | NULL | TRUE |
| PATCH-UPCHARGE | CONFIG | Laser Patch Upcharge | Config | CONFIG | - | 2.50 | 5.00 | per cap | patchUpchargePerCap | - | NULL | TRUE |
| CAP-DISCOUNT | CONFIG | Cap Discount Percentage | Config | CONFIG | - | 0 | 0.20 | multiplier | capDiscount | - | NULL | TRUE |
| HEAVYWEIGHT-SURCHARGE | CONFIG | Heavyweight Garment Surcharge | Config | CONFIG | - | 5.00 | 10.00 | per garment | heavyweightSurcharge | - | NULL | TRUE |

---

## Alias Mappings Table

For handling common typos and legacy code references. These should be implemented in the lookup service to normalize input before querying.

| Alias (Typo/Legacy) | Maps To | Notes |
|---------------------|---------|-------|
| Aonogram | Monogram | Common typo (A key near M on keyboard) |
| Nname | Name | Common typo (double N) |
| Nnames | Name | Common typo (double N, plural) |
| Names | Monogram | Plural "names" = monogramming |
| EJB | FB | Legacy code for Flat Back (Embroidered Jacket Back) |
| Flag | AL | Legacy code for Apparel Left (chest) position |
| Setup | GRT-50 | Common shorthand for setup fee |
| Setup Fee | DD | Maps to digitizing setup |
| Design Prep | GRT-75 | Common shorthand for design prep/graphic design fee |
| Excess Stitch | AS-GARM | Additional stitches (garment) |
| SECC | DECC | Typo for DECC (customer-supplied caps) |
| SEW | SEG | Alias for sewing |

### Implementation Example

```javascript
const SERVICE_CODE_ALIASES = {
  'Aonogram': 'Monogram',
  'Nname': 'Name',
  'Names': 'Name',
  'EJB': 'FB',
  'Flag': 'AL',
  'Setup': 'GRT-50',
  'Design Prep': 'GRT-75'
};

function resolveServiceCode(code) {
  // Check aliases first, then return original code
  return SERVICE_CODE_ALIASES[code] || code;
}
```

---

## Query Examples

### Get All Active Embroidery Tiers for Left Chest
```sql
SELECT * FROM Service_Codes
WHERE ServiceType = 'EMBROIDERY'
  AND Position = 'LC'
  AND IsActive = TRUE
ORDER BY TierLabel
```

### Get Pricing for a Specific Quantity (e.g., 36 pieces, Left Chest)
```javascript
// Quantity 36 falls in tier "24-47"
const tier = serviceCodes.find(sc =>
  sc.Position === 'LC' &&
  sc.TierLabel === '24-47' &&
  sc.IsActive
);
console.log(tier.SellPrice); // 12.50
```

### Get All Fees
```sql
SELECT * FROM Service_Codes
WHERE ServiceType IN ('FEE', 'RUSH')
  AND IsActive = TRUE
```

### Get DECC Pricing (Cap Decoration)
```sql
SELECT ServiceCode, TierLabel, SellPrice
FROM Service_Codes
WHERE ServiceCode LIKE 'DECC%'
  AND IsActive = TRUE
ORDER BY
  CASE TierLabel
    WHEN '1-2' THEN 1
    WHEN '3-5' THEN 2
    WHEN '6-11' THEN 3
    WHEN '12-23' THEN 4
    WHEN '24-71' THEN 5
    WHEN '72-143' THEN 6
    WHEN '144+' THEN 7
  END
```

---

## API Endpoint Design

**Endpoint:** `GET /api/service-codes`

**Query Parameters:**
- `code` - Filter by specific code (exact match)
- `type` - Filter by ServiceType
- `category` - Filter by Category
- `position` - Filter by Position
- `active` - Filter by IsActive (default: true)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "ServiceCode": "AL-1-23",
      "ServiceType": "EMBROIDERY",
      "DisplayName": "Apparel Left Chest 1-23 pcs",
      "Category": "Apparel Left Chest",
      "PricingMethod": "TIERED",
      "TierLabel": "1-23",
      "UnitCost": 6.75,
      "SellPrice": 13.50,
      "PerUnit": "each",
      "QuoteBuilderField": "leftChest",
      "Position": "LC",
      "StitchBase": 8000,
      "IsActive": true
    }
  ],
  "count": 1
}
```

---

## Implementation Steps

1. **Create Caspio Table** - Use schema above in Caspio DataPage builder
2. **Import Initial Data** - Copy data from tables above into Caspio
3. **Create API Endpoint** - Add to `caspio-pricing-proxy/server.js`
4. **Update ShopWorks Parser** - Fetch codes from API instead of hardcoded values
5. **Update Quote Builder** - Use `QuoteBuilderField` for import mapping

---

## Related Files

- `/shared_components/js/shopworks-import-parser.js` - Parser to update with API calls
- `/shared_components/js/embroidery-quote-pricing.js` - Pricing calculator
- `/quote-builders/embroidery-quote-builder.html` - Primary UI consumer
- `caspio-pricing-proxy/server.js` - API endpoint to add
- `/memory/EMBROIDERY_PRICING_ARCHITECTURE.md` - How pricing flows through the system
- `/memory/LESSONS_LEARNED.md` - Past issues with service code lookups

---

## Erik's Decisions (2026-02-01)

| Decision | Answer |
|----------|--------|
| Service code location | Move to Caspio (not hardcoded) |
| FB pricing structure | Different tiers than AL (1-11, 12-23, 24-47, 48+) - needs pricing research |
| CB pricing | Same as Cap AL tiers |
| DECC pricing | Same tiers as DECG, ~20% lower prices |
| Table structure | Full structure with all fields as documented |
| UI mapping | Specify target field in Caspio via QuoteBuilderField |
| Implementation | Full implementation with API endpoint |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-01 | Initial documentation created with complete schema and sample data | Claude |
| 2026-02-01 | Pricing audit: Updated FB to stitch-based pricing, removed obsolete DGT-001 through DGT-004 (digitizing is $100 flat), added SEG, CAP-DISCOUNT, HEAVYWEIGHT-SURCHARGE, updated alias table | Claude |
