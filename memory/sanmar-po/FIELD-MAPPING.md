# SanMar PO — Field Mapping (Caspio / ShopWorks → SanMar PO)

How to build a valid SanMar PO line + header from data NWCA already holds. Pairs with `templates/po-payload.schema.json`. Read [../SANMAR_API_REFERENCE.md](../SANMAR_API_REFERENCE.md) for the authoritative color/size/sizeIndex facts (this doc defers to it).

## The line-item identity question — RESOLVED

SanMar accepts **either** identity per line:

1. **`inventoryKey` + `sizeIndex`** — SanMar-*recommended* ("reduces processing errors"). **Not stored in Caspio.**
2. **`style` + `color` + `size`** — fully buildable from Caspio today. **Use this for v1.**

So the common fear ("we don't have the IDs SanMar wants") is **not a blocker** — path #2 works now. If/when you want path #1, resolve the keys on demand (don't hardcode):
- **getPricing (Standard)** by `style`/`color`/`size` returns `inventoryKey` **and** `sizeIndex` in the same response (see SANMAR_API_REFERENCE → Pricing Services). `getPreSubmitInfo` also returns them.
- Or join the FTP `SanMar_SDL_N.csv` / `Sanmar_EPDD.csv` (`unique_key` = `inventoryKey` + `sizeIndex` string-concatenated, e.g. inventoryKey `11803` + sizeIndex `2` = `118032`).

## Color — use the MAINFRAME color, not the display name

⚠️ The PO `color` field **must be `SANMAR_MAINFRAME_COLOR`** (SanMar's order/mainframe key), **never** the customer-facing `COLOR_NAME`.

| Caspio column | Role | PO use |
|---|---|---|
| `COLOR_NAME` | Display ("Brilliant Orange") | ❌ never send to the PO |
| `CATALOG_COLOR` | API key — usually equals mainframe color | ⚠️ usually OK, but verify |
| `SANMAR_MAINFRAME_COLOR` | SanMar mainframe/order color | ✅ this is the PO `color` |

`CATALOG_COLOR` and `SANMAR_MAINFRAME_COLOR` are usually identical but **can differ** — the proxy already has an audit endpoint that diffs them (`caspio-pricing-proxy/src/routes/sanmar-product-data.js`, the catalog-color audit). Prefer `SANMAR_MAINFRAME_COLOR`; if absent for a row, fall back to `CATALOG_COLOR` and flag for verification. (The `inventoryKey`+`sizeIndex` path sidesteps color strings entirely — another reason it's the "recommended" path.)

## Size — send the human-readable size, NOT the ShopWorks suffix

The PO `size` is the plain size (`S`, `M`, `2XL`). It is **not**:
- the ShopWorks SKU suffix (`_2X`, `_3XL`, `Size05`/`Size06`) — that's NWCA-internal, see [../SHOPWORKS_SIZE_MAPPING.md](../SHOPWORKS_SIZE_MAPPING.md);
- the `sizeIndex` ordinal (1=XS, 2=S, 3=M, 4=L, 5=XL, 6+=2XL.. — confirm 2XL+ from a live getPricing response).

⚠️ **Fragile seam:** multi-SKU / extended sizes (the `PC54_2X` → `Size05` class of bug). If you build line identity from style+color+size strings, **validate extended sizes explicitly** before trusting real orders. The `inventoryKey`+`sizeIndex` path avoids the string ambiguity.

## Header / ship-to mapping

| PO field (schema) | Source | Notes |
|---|---|---|
| `poNumber` | ShopWorks `PurchaseOrders.PONumber` / `ID_PO` (or a generated NWCA PO#) | <=28 chars, unique, no commas. Owning this = exact linkage to `SanMar_Orders` |
| `shipTo.*` | the decorator address (in-house decoration) or end customer (drop-ship) | use ST/AVE/RD/DR/BLVD abbreviations; no commas (FTP path) |
| `shipMethod` | business rule | `UPS` default; will-call codes (PRE=Seattle…) require Warehouse Selection account mode |
| `warehouseSelection` | null unless account configured | only for will-call / Warehouse Selection mode |
| `lines[].quantity` | order qty per SKU | **consolidate duplicate product lines into one** before submit |

## Hard rules (from the guide)

- **No commas** in any field on the FTP flat-file path (comma is the delimiter). Harmless on SOAP, but keep data clean.
- **Consolidate duplicate lines** — SanMar checks stock per line; duplicate lines can source from a short warehouse and error/hold the PO.
- **Hemmed pants are NOT supported** via integrated PO — must stay manual (sanmar.com / phone / email). Carve them out so they don't silently slip into an auto-built PO.
- **Free ground freight > $200** continental US (excl. bags) — informational; may inform batching.

## Source-of-truth pointers (code)

- SOAP transport + auth: `caspio-pricing-proxy/src/utils/sanmar-soap.js` (`ENDPOINTS` 14-26 — add PO endpoints; `getStandardAuth` 40-54; `makeSoapRequest` 76-120).
- Mainframe color in Caspio: `caspio-pricing-proxy/src/routes/sanmar-product-data.js:704`, `products.js:679`.
- ShopWorks PO data: Caspio `PurchaseOrders` (`creditcard-lookups.js` reads it), vendor master `tbl_vendor_basics`.
- Existing (fuzzy) SanMar↔ShopWorks linkage this would replace: `caspio-pricing-proxy/src/routes/sanmar-orders.js` (`/link`, `/match-manageorders`).
