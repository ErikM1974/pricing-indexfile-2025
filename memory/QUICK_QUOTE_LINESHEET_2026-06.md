# Quick Quote — Line Sheet mode (method-first mini-catalog → PDF) (2026-06-23)

> **✅ BUILT on preview (port 3010), NOT yet deployed.** Erik's reframe of the declutter/multi-style/PDF
> asks. Files touched: `calculators/quick-quote/{quick-quote.js, index.html, quick-quote.css}` + NEW
> `calculators/quick-quote/linesheet-print.css`. UI-only — **no engine/Caspio/backend change.**

## What it is
The Quick Quote now has **two modes** (toggle at top of the input panel, `#qqModeToggle`):
- **Quick Price** = the existing tool (1 style → every method priced at once). **Untouched.**
- **Line Sheet** (new) = method-FIRST: AE picks ONE imprint method (locks the sheet — can't mix imprint
  types), sets the shared decoration config ONCE (placement/ink for prints, stitches for EMB), then adds
  **up to 6 styles** (each its own style# + color dropdown + product image). Each style shows a
  **quantity-break ladder**, and **Download PDF / Print** produces a branded one-page NWCA line sheet to
  send the customer. **Print-only, NO customer fields** (generic line sheet, estimate-only footer).

## Why it's pricing-safe (Rule 9)
Each style row is priced INDEPENDENTLY via `probeLadder(method, product, color)` — the SAME engine probe
the Quick-Price matrix uses (`singleItemPreview` per tier). Styles are **NEVER summed** into a combined
total (that pooling problem is what keeps real multi-item orders in the Quote Builder). So every number is
identical-by-construction to the catalog/Quick-Quote/builders. **77 parity tests pass** (quick-quote-parity,
web-quote-cart-parity, dtf-medium-resolver). One stale source-string assertion updated
(`quick-quote-parity.test.js:82` — caps-hide-placement moved into `renderPlacementVisibility()`).

## Architecture (key reuse, low-risk refactor)
- Extracted **`fetchProduct(style)`** (pure, returns product) from `lookupStyle` — used by both modes.
- Generalized **`buildItem`→`buildItemFor(def,product,color,sizes)`** and **`stdSize`→`stdSizeFor(product)`**.
- Factored the matrix probe loop into **`probeLadder(id,product,color)`** — reused by `renderMatrix` AND each line row.
- Config controls (placement/ink/embroidery) are SHARED DOM, made mode-aware via `activeMethodIds()`/
  `hasActive()`/`configIsCap()`; `renderInkField`/`renderEmbPanel`/`renderPlacementVisibility` key off them.
  Config listeners call `repriceActive()` (dispatches quick vs line).
- Line state: `state.mode`, `state.lineMethod`, `state.lineStyles[]` ({uid,raw,product,color,status,tiers}).
- Style rows: `renderLineList()` renders SHELLS only (input never replaced mid-type); `updateLineRow()`
  fills dynamic content (thumb/name/color-select/price) — avoids focus loss.
- PDF: `printLineSheet()` = `window.print()`; `linesheet-print.css` (media=print, scoped `body.qq-mode-line`)
  hides chrome, prints `#qqSheet`. Logo + footer hardcoded (NWCA logo URL, (253) 922-5793, sales@).

## Decisions (Erik confirmed): keep BOTH modes · qty-break ladder per style · green NWCA letterhead · max 6 styles · one color per row · one portrait page (page-break-inside:avoid). Supersedes the earlier "compare 2 styles" idea.

## Verified on preview
Mode toggle swaps panels + body class; SCP line sheet: PC61 (Deep Marine) + PC54 (Olive) each priced with
own ladder (e.g. PC61 24-47 $12.50 → 145+ $11.50, +$50 small-batch); reorder/remove/color-change all reprice;
Quick Price regression intact (PC90H, 4 methods + matrix). Print CSS served 200 + registered media=print.
(Screenshot tool times out on cross-origin CDN images — page is responsive, real browsers render fine.)

## NEXT: deploy (`/deploy`) — staff-only, all green. Then MEMORY.md one-liner. Detail: workflow runs wf_b6bf94b7-b73 (asks) + wf_84014005-b8f (mini-catalog design).
