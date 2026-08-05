# DST Studio — `/pages/dst-viewer.html`

Staff tool for Tajima `.DST` stitch files. Rebuilt from a beta viewer into a production tool
2026-08-04/05. **100% client-side** — the parser, renderer, mockups and approval sheet all run
in the browser, so it works with every backend down and no file ever leaves the machine.

Shipped: app `v2026.08.04.2` (rebuild) → `v2026.08.05.6` (rename + de-beta) → `.7` (card
promoted) → `.8` (logo fix). **Erik confirmed on screen — visual pass CLOSED.**

## Files

| File | Role |
|---|---|
| `pages/dst-viewer.html` | Shell + print-only approval sheet |
| `pages/css/dst-viewer.css` | Dark "digitizer's bench" UI + `@media print` sheet |
| `pages/js/dst-viewer.js` | App: stage render, zoom/pan, mockups, exports, recents |
| `pages/js/dst-parser.js` | **Pure UMD** DST parse + production math — also `require()`d by `tests/unit/dst-parser.test.js` (12 tests) and by the contract calculator |
| `pages/js/dst-palette.js` | 225 real Robison-Anton 40wt colors (snapshot of inksoft `/api/embroidery/palette`, 2026-08-04) |
| `pages/js/dst-garments.js` | Vector tee/polo/hoodie/cap/beanie/tote with real mm scale + placement anchors |

## What it does

Four render modes (realistic thread with satin sheen / flat / wire+jumps / trace playback),
zoom-pan stage with mm rulers and live cursor readout, per-run RA thread assignment persisted
per design, production panel (sew time at adjustable SPM, thread metres, trims, **density
heatmap + hotspot rings**), true-scale garment mockups with drag placement and a
placement-max warning, PNG exports, and a printable customer approval sheet.

## Gotchas worth keeping

- 🔑 **Named "DST Studio", not "Embroidery ___".** On the staff dashboard *everything* is
  embroidery (Contract Embroidery, Additional Stitches, Embroidery customer-supplied are all
  neighbours) — "DST" is the word staff actually have in hand. Card, `<title>`, header and the
  Mockup Generator breadcrumb must all agree.
- 🔑 **Customer-facing output is signed "Northwest Custom Apparel"**, never an internal tool
  name — applies to the mockup PNG watermark and the approval sheet.
- 🔑 **Satin renders solid only at ~0.42 mm same-side pitch** (one crossing every 0.21 mm).
  Looser and the sample badge draws as an open zigzag that looks broken.
- 🔑 **Wire-mode ink must adapt to fabric luminance** — a fixed dark ink is invisible on the
  dark default fabric. `bitmap.dirty = true` on fabric change or the cached bitmap keeps the
  old ink.
- 🔑 **Auto-assigned colors walk the hue wheel by the golden angle and snap to the nearest REAL
  RA thread**, so a 34-run file opens with 34 distinct orderable colors rather than cycling 12.
- 🔑 **`fitView()` at zero stage size** clamps to minimum zoom and the design reads as blank;
  it now remembers a degenerate fit and re-fits once real size appears (one-shot, so it never
  overrides a zoom the user chose).
- ⚠️ Clipboard "Copy Summary" needs user activation — it fails under synthetic clicks only.
  There's an `execCommand` fallback.
- ⚠️ The CDN logo has no CORS header, so it can never be drawn into a canvas export. Nothing
  needs that today; if you ever want it *inside* an exported mockup, serve it same-origin.

## Dashboard card

Art & Design, **2nd position beside Shirt Designer**. No `tool-btn--beta`; amber
`.qs-new-badge` "Updated · Aug 5". ⏭️ **Remove the chip span ~Sept 2026** (comment left in the
markup).

## Related

- Same parser feeds the Contract Embroidery drop-zone → `contract-embroidery-dst.md`
- Sibling tool `/pages/mockup-generator.html` (EMB/PDF thread comparison, backend-dependent,
  still beta)
