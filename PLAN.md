# Embroidery Quote → ShopWorks PUSH Plan

## Goal
Add "Push to ShopWorks" capability that transforms saved embroidery quotes (`quote_sessions` + `quote_items`) into ManageOrders PUSH API orders. Button appears on **both** the quote-view page AND in the embroidery builder after save.

---

## OnSite Integration Settings (from screenshot)
- **URL:** `https://manageordersapi.com/embroidery` (separate integration from `/onsite`)
- **Auth:** Same `MANAGEORDERS_USERNAME` / `MANAGEORDERS_PASSWORD` credentials, POST to `/embroidery/signin`
- **Customer Number:** 3739
- **Company Location ID:** 2
- **Order Type ID:** 6
- **Employee Created By:** 2
- **AutoHold:** No (0)
- **DesignType ID:** 2 (Embroidery)
- **Artist Created By:** 24
- **ProductClass:** 1
- **Tax Account:** 2200 (WA State Sales Tax)
- **Combine Line Items:** ON
- **Create Customers:** OFF (all orders go to customer 3739)
- **Auto Import via Server:** ON

---

## Key Learnings from API Guide PDF

1. **`TaxTotal`** — creates a single tax line item automatically using Tax Account from OnSite settings (2200). Do NOT send tax as a LinesOE entry.
2. **`TotalDiscounts`** — creates a discount line item automatically using Discount Line Item from OnSite settings. Do NOT send discount as a LinesOE entry.
3. **`cur_Shipping`** — total shipping amount at order level.
4. **`ExtDesignIDBlock`** on LinesOE — links line items to designs (Production Spec). If present and matches a design's `ExtDesignID`, OnSite assigns that line to that design's locations. If NOT present, line item gets assigned to ALL designs.
5. **`ExtDesignID`** on Designs — if this value already exists in OnSite, it reuses the existing design (no duplicate created). Great for repeat orders.
6. **`StitchesTotal`** in Locations — embroidery stitch count per location.
7. **`id_DesignType: 2`** — embroidery design type (from OnSite settings).
8. **Size** on LinesOE — must match the Size Translation Table. OnSite handles `_2X`, `_3X` etc. modifiers.
9. **`ExtShipID`** — links line items to shipping addresses for Shipping Spec creation. Must match between LinesOE and ShippingAddresses.
10. **Customer block** only used when "Create Customer" is ON (it's OFF for us). All orders go to customer 3739.
11. **`id_Customer`** at order level overrides the default — we send 3739 explicitly.

---

## Implementation Steps (7 steps)

### Step 1: Backend Config — `config/manageorders-emb-config.js`
New file with embroidery-specific OnSite defaults:

```javascript
const EMB_ONSITE_DEFAULTS = {
  id_Customer: 3739,
  id_CompanyLocation: 2,
  id_OrderType: 6,
  id_EmpCreatedBy: 2,
  AutoHold: 0,
  id_DesignType: 2,       // Embroidery
  id_Artist: 24,
  id_ProductClass: 1,
  ExtSource: 'NWCA-EMB',
  ExtCustomerPref: 'NWCA-EMB',
};
const EMB_BASE_URL = 'https://manageordersapi.com/embroidery';
```

Reuse `SIZE_MAPPING`, `NOTE_TYPES`, `translateSize()` from existing `manageorders-push-config.js`.

### Step 2: Auth Update — `lib/manageorders-push-auth.js`
- Add `getTokenForEndpoint(baseUrl)` function
- Separate token cache per base URL (`tokenCacheByUrl` Map)
- Same credentials (`MANAGEORDERS_USERNAME`/`PASSWORD`), different signin URL
- Existing `getToken()` unchanged for backward compatibility (3-Day Tees)

### Step 3: Transformation — `lib/embroidery-push-transformer.js`
New module with one main function: `transformQuoteToOrder(session, items)` → returns `ExternalOrderJson`

#### Order-level fields:
- `ExtOrderID`: `NWCA-EMB-{QuoteID}` (e.g., `NWCA-EMB-EMB-2026-177`)
- `id_Customer`: 3739
- `id_OrderType`: 6
- `date_OrderPlaced`: from `DateOrderPlaced` (ISO→MM/DD/YYYY)
- `date_OrderRequestedToShip`: from `ReqShipDate`
- `date_OrderDropDead`: from `DropDeadDate`
- `ContactNameFirst`/`Last`: split `CustomerName` on last space
- `ContactEmail`: from `SalesRepEmail` (or customer email if we add it)
- `ContactPhone`: from `Phone`
- `CustomerPurchaseOrder`: from `PurchaseOrderNumber`
- `CustomerServiceRep`: from `SalesRepEmail` → name lookup
- `Terms`: from `PaymentTerms`
- `TaxTotal`: from `TaxAmount` (order-level, NOT line item)
- `cur_Shipping`: extracted from SHIP fee item total
- `TotalDiscounts`: extracted from DISCOUNT fee item (positive number)

#### Product LinesOE (EmbellishmentType = 'embroidery'):
For each product item:
- `PartNumber`: `StyleNumber` (e.g., `PC54`)
- `Description`: `ProductName`
- `Color`: `Color`
- `Size`: parsed from `SizeBreakdown` JSON → each size gets its own LinesOE entry with `Size` matching the translation table value
- `Qty`: quantity for that size
- `Price`: `FinalUnitPrice` (handles size upcharges via LogoSpecs)
- `ExtShipID`: `'SHIP-1'` (all items to same address)
- `ExtDesignIDBlock`: link to the appropriate design (garment or cap)

#### Service/Fee LinesOE (EmbellishmentType = 'fee'):
- `PartNumber`: `StyleNumber` (AS-Garm, DD, GRT-50, etc.)
- `Description`: `ProductName`
- `Qty`: `Quantity`
- `Price`: `FinalUnitPrice`
- `Size`: empty (fees don't have sizes)
- **SKIP**: TAX, SHIP, DISCOUNT items (handled at order level)

#### AL LinesOE (EmbellishmentType = 'embroidery-additional'):
- `PartNumber`: `StyleNumber` (AL, AL-CAP, CB, CS)
- `Qty`: `Quantity`
- `Price`: `FinalUnitPrice`

#### DECG/DECC LinesOE (EmbellishmentType = 'customer-supplied'):
- `PartNumber`: `StyleNumber` (DECG or DECC)
- `Qty`: `Quantity`
- `Price`: `FinalUnitPrice`

#### Designs block:
Built from first item's `LogoSpecs` JSON + session fields:

```javascript
Designs: [{
  DesignName: `Garment Design ${GarmentDesignNumber || 'Primary'}`,
  ExtDesignID: `EMB-G-${QuoteID}`,
  id_DesignType: 2,
  id_Artist: 24,
  ForProductColor: firstProductColor,
  Locations: logoSpecs.logos
    .filter(l => !l.pos.includes('Cap'))
    .map(logo => ({
      Location: logo.pos,         // 'Left Chest', 'Full Back', 'AL'
      StitchesTotal: String(logo.stitch),
      DesignCode: GarmentDesignNumber || '',
      Notes: ''
    }))
}]
// + second design for caps if CapDesignNumber exists
```

#### Shipping:
```javascript
ShippingAddresses: [{
  ShipCompany: CompanyName,
  ShipAddress01: ShipToAddress,
  ShipCity: ShipToCity,
  ShipState: ShipToState,
  ShipZip: ShipToZip,
  ShipCountry: 'USA',
  ShipMethod: ShipMethod,
  ExtShipID: 'SHIP-1'
}]
```

#### Notes:
```javascript
Notes: [
  { Type: 'Notes On Order', Note: OrderNotes + '\n' + ImportNotes },
  { Type: 'Notes To Art', Note: `Design #${GarmentDesignNumber}\nDigitizing: ${DigitizingCodes}\nStitch counts: ...` },
  { Type: 'Notes To Production', Note: `Quote: ${QuoteID}\nTier: ${PricingTier}` }
]
```

### Step 4: Backend Route — `src/routes/embroidery-push.js`

Three endpoints:

**`POST /api/embroidery-push/push-quote`**
Request: `{ quoteId, isTest? }`
1. Validate `quoteId`
2. Fetch `quote_sessions` where `QuoteID = quoteId` (via internal Caspio proxy)
3. Check `PushedToShopWorks` — reject if already pushed (unless `force: true`)
4. Fetch `quote_items` where `QuoteID = quoteId`
5. Call `transformQuoteToOrder(session, items)`
6. Auth: `getTokenForEndpoint(EMB_BASE_URL)` → `/embroidery/signin`
7. POST to `EMB_BASE_URL/order-push` with Bearer token
8. On success: update `PushedToShopWorks` with ISO timestamp via PUT to quote_sessions
9. Return `{ success, extOrderId, timestamp }`

**`GET /api/embroidery-push/verify/:extOrderId`**
- Check if order exists via `/embroidery/order-pull`

**`GET /api/embroidery-push/health`**
- Test auth against `/embroidery/signin`

### Step 5: Frontend — Quote-View Button (`pages/quote-view.js`)
- "Push to ShopWorks" button in the action bar
- Staff-only visibility (check URL param or referrer)
- Confirmation modal: "Push {quoteId} to ShopWorks as NWCA-EMB-{quoteId}?"
- Test mode checkbox
- Loading spinner during push
- Success: green toast with ExtOrderID, button → "Pushed ✓" (disabled)
- Already pushed: button shows "Pushed ✓" on page load
- Error: red toast + retry option

### Step 6: Frontend — Builder Button (`quote-builders/embroidery-quote-builder`)
- After `saveAndGetLink()` succeeds, show "Push to ShopWorks" button
- Same API call, same confirmation flow
- Button only appears after successful save (needs quoteId)

### Step 7: Caspio Field + Testing
- **Erik adds**: `PushedToShopWorks` Text(255) column to `quote_sessions` in Caspio UI
- Test with a real saved quote
- Verify in ManageOrders order-pull
- Check OnSite import (next hourly cycle)
- Validate: products, sizes, fees, design block, shipping, notes

---

## Files Changed/Created

### New Files (3)
1. `caspio-pricing-proxy/config/manageorders-emb-config.js` — EMB OnSite defaults
2. `caspio-pricing-proxy/lib/embroidery-push-transformer.js` — Quote→Order transform
3. `caspio-pricing-proxy/src/routes/embroidery-push.js` — API route (3 endpoints)

### Modified Files (4)
1. `caspio-pricing-proxy/lib/manageorders-push-auth.js` — Multi-endpoint token cache
2. `caspio-pricing-proxy/src/server.js` — Register embroidery-push routes
3. `pages/quote-view.js` — Push to ShopWorks button
4. `quote-builders/embroidery-quote-builder.html` — Push button after save

### Caspio Change (Erik manual)
- Add `PushedToShopWorks` Text(255) column to `quote_sessions`

---

## Risk Mitigation
- **Duplicate prevention**: Check `PushedToShopWorks` before allowing push + check ManageOrders for existing ExtOrderID
- **Test mode**: `isTest: true` adds `TEST-` to ExtOrderID prefix
- **Rollback**: Orders in ManageOrders can be deleted before OnSite hourly import
- **Tax safety**: TaxTotal at order level only (per API guide: creates single tax line item from account 2200)
- **Discount safety**: TotalDiscounts at order level (per API guide: creates single discount line item)
- **Design reuse**: ExtDesignID checked against existing OnSite designs — repeat orders won't create duplicate designs
