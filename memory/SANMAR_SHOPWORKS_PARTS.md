# SanMar → ShopWorks Parts Converter

**What:** admin tool that turns a SanMar price list into a **ShopWorks (OnSite) Parts import
CSV**. `/dashboards/sanmar-shopworks-converter.html` (staff dashboard → Administration →
"🔄 SanMar → ShopWorks Parts converter"). Built 2026-07-23. `requireCrmRole(['admin'])`.

**Runs 100% in the browser** (PapaParse for CSV streaming, SheetJS for XLSX) — the file is
never uploaded, so the ~180k-row raw feed is handled locally with no server memory/timeout.

## Two inputs (auto-detected by header)
1. **ShopWorks "Sanmar Integration Only Price List"** (has `ID_Product` + `sts_LimitSize*`;
   ShopWorks generates it monthly, already in the 21/17-col parts format) → **fixup path**.
2. **Raw SanMar feed** (has `STYLE`/`STYLE#` + `SIZE` + `PIECE_PRICE`; from FileZilla / the
   SanMar Downloads page) → **full-conversion path** (collapse colors → one row per style+size
   at max piece price; build part#, prices, size flags, size-in-description).

Output = the ShopWorks parts columns: `ID_Product, Description, ColorRange, Price_Unit_Piece/
Dozen/Case, Price_Unit_Special, PageNumber, sts_LimitSize01-06, BarCodeValue, ProductColor,
BrandName`. Download = `Shopworks_Import_Converted.csv`. Import into ShopWorks Parts (matches on
`ID_Product` → updates existing, adds new).

## Transform rules (VERIFIED 2026-07-22 vs the 15,150 existing parts)
- **2XL part number: `_2XL` → `_2X`**; ladies **`_XXL` stays `_XXL`**. Full-file check of the
  07-14-26 list: 2,213 `_2XL` styles (2,080 already exist as `_2X` = clean update, 0 conflict
  with `_XXL`), 560 `_XXL` (0 conflict), zero existing parts use `_2XL`. The distinct 2XL
  variants (`_2XLT/_2XLR/_2XLL/_2XLS/_2XLP`) keep their suffix.
- **Descriptions get the size** on extended-size rows: `Size 2XL - …`, `Size 3XL - …`,
  `Size OSFA - …`, `Size XXL - …` (ladies). Tidy: collapse whitespace, strip trailing period.
- **sts_LimitSize** (blocked=1, allowed=blank): base S/M/L/XL = `----11`; **2XL & XXL = `1111-1`
  (Size05)**; everything else = `11111-` (Size06).
- Full path: `ID_Product` = **`sanmarToShopWorksSKU(style,size)`** (reuses
  `shared_components/js/sku-validation-service.js` — handles `2XL→_2X`, ladies `XXL_STYLES→_XXL`,
  ~97-size map); strip SanMar's trailing `STYLE#` off `PRODUCT_TITLE`; `Dozen = Piece`.

## Files
- Transform (pure, unit-tested node+browser): `dashboards/js/sanmar-shopworks-parts.js`
  (`tests/unit/sanmar-shopworks-parts.test.js` — 20 tests). **JS output is byte-identical to the
  reference-verified Python** on the real 07-14-26 file (15,332 parts, 0 diffs).
- Controller: `dashboards/js/sanmar-shopworks-converter.js`; page/css:
  `dashboards/sanmar-shopworks-converter.{html,css}`; libs: `dashboards/js/vendor/{papaparse,xlsx.full}.min.js`.
- Route: `server.js` (admin page route before the `/dashboards` static mount).

## Related / not this
- The old desktop tool `2026/Sanmar Converter…/SanMar_ShopWorks_Converter/sanmar_to_shopworks.py`
  and the InkSoft `web/sanmar_converter.*` were the starting points — the InkSoft JS lacked
  streaming + ladies-`_XXL`; this app's version fixes both. Superseded for NWCA use.
- Feeding the product master (`Sanmar_Bulk`) is a DIFFERENT flow → [[SANMAR_FTP_INTEGRATION]].
