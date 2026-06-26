# PICKUP — Quote-view size table not syncing from ShopWorks (2026-06-26)

**Status:** Diagnosis DONE + verified (workflow, high confidence). Erik approved **BOTH fixes**.
**Code NOT yet written** — working tree was clean at stop. Resume at implementation.

## The bug (Erik's report)
Quote DTG0625-0244 / WO #142292. In ShopWorks (source of truth) he removed Small, added Medium →
ShopWorks line is now **M=2, L=1, XL=1** (total qty still 4, unit still $31.75, total still $127.00).
The Quote Management screen `/quote/:id` still shows the OLD **S=1, M=1, L=1, XL=1**. Banner only
flagged "Purchasing status: 0 → 1".

## Root cause (two independent gaps — both verified by reading the code)
1. **Display gap (primary, the visible symptom).** The S/M/L/XL table renders from the ORIGINAL Caspio
   quote (`item.SizeBreakdown` via `parseSizeBreakdown` / `buildProductRows` / `renderProductRow`,
   [pages/js/quote-view.js:1408-1560]). The only ShopWorks overlay, `_overlayQuoteFromShopWorks(order, lineItems)`
   ([pages/js/quote-view.js:2902]), rewrites ONLY the totals card + per-row `.price-col` / `.total-col`
   (from `LineUnitPrice` × `LineQuantity`). It NEVER reads `Size01..Size06` and NEVER writes `.size-col`
   or `.qty-col`. So a fresh snapshot does NOT change displayed sizes. The snapshot.lineItems DO carry the
   correct Size01-06 (proxy `fetchLineItems` returns them raw — caspio-pricing-proxy/src/utils/manageorders.js:228).
2. **Detection gap (secondary, why no banner).** `diffSnapshots(oldSnap,newSnap)` ([server.js:6852])
   compares lines by `PartNumber|PartColor` and ONLY checks `LineUnitPrice` + total `LineQuantity`
   ([server.js:6895-6916]). It never compares `Size01..Size06`, so a size-only swap at constant total qty/
   price produces zero change-log rows. The "Purchasing status 0→1" was `sts_Purchased` flipping
   (a WATCHED_ORDER_FIELDS header field, server.js:6817) — unrelated to sizing.

Banner is 100% driven by Quote_Change_Log rows (quote-view.js `_loadChangeLog` ~L2303 → GET
`/api/quote-change-log/:quoteId`, route in server.js:8729). Independent of the data table.

## The fix (BOTH — Erik approved)
### Fix 1 — Display: overlay size cells from snapshot
Extend `_overlayQuoteFromShopWorks()` (quote-view.js:2902) to also rewrite `.size-col` (6 cells:
S, M, LG, XL, XXL, XXXL) + `.qty-col`, the same way it already mirrors price/total. Add a `sw-mirrored` class.

**Column mapping (per matched SW line, aggregate across base + extended-SKU lines for the style+color):**
- Base SKU line (no size suffix): `Size01→S`, `Size02→M`, `Size03→L(LG col)`, `Size04→XL`,
  `Size05→2XL(XXL col)`, `Size06→catch-all (XXXL col)`.
- Extended-SKU line (PartNumber suffix `_2X`/`_3X`/`_4X`/…): the populated Size0N qty maps to its
  column — `_2X`→XXL col, everything else (`_3X`+, OSFA, tall, youth…) → XXXL catch-all col.
  NOTE ShopWorks uses `_2X` NOT `_2XL` (SUFFIX_OVERRIDES in buildProductRows L1492).
- The existing overlay iterates `tr.first-row` and matches by style+color, aggregating matching SW lines.
  Was mid-read of `buildProductRows` (L1408-1510) / `renderProductRow` (L1515-1561, where the 6
  `.size-col` cells live in order S,M,LG,XL,XXL,XXXL) and `parseSizeBreakdown` — finish reading those
  to mirror the exact same column semantics. Watch: extended sizes render as SEPARATE rows
  (`tr.extended-row`) in the original table, but the snapshot overlay only walks `tr.first-row`. Decide
  whether to (a) only overlay the standard-size first row + qty, or (b) handle extended rows too. The
  safe, total-preserving approach: write standard size cells on the first row and the qty col = full
  line total; if extended rows exist, keep them consistent. Keep it minimal but correct — verify the
  rendered totals still reconcile (S+M+L+XL+ext = qty).

### Fix 2 — Detection: size-aware diff
Extend `diffSnapshots()` (server.js:6852) so the matched-line branch also compares `Size01..Size06`
(emit a `line_item` / `warning` change row like `Size[PC54Y White] S:1→0, M:1→2`). Then a size swap
surfaces in the banner/change-log. Keep `normalizeForDiff` semantics.

### Test
Add a unit test for the size-aware diff (e.g. tests/unit/diff-snapshots-sizes.test.js): feed old
{Size01:1,Size02:1,Size03:1,Size04:1} vs new {Size02:2,Size03:1,Size04:1} same PartNumber/total/price →
expect a size change row; same totals with no per-size change → expect none.

## Constraints / gotchas
- Erik's #1 rule: never silent-wrong price. These are display+detection only; do NOT alter pricing.
- 3 PRICE SURFACES rule: this does not change pricing engine, but quote-view is customer-facing — sanity
  check no price regression. (No re-run of parity needed: no `*-pricing-service.js` / Caspio price touched.)
- After fix: bump cache-bust `?v=` on quote-view.js include; deploy via `/deploy`.
- Append a LESSONS_LEARNED.md entry (Problem/Root Cause/Solution/Prevention) after shipping.
- This is the SAME quote used by "Send to Steve" (LIVE 2026-06-26) — don't disturb that path.

## Workflow artifact
Root-cause workflow run: wf_8751bf22-96c (verdict: render-reads-original-quote-not-snapshot, high conf).
