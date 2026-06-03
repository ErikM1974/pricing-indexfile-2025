# Quote Builder Architecture & Change-Routing Manifest

> **Single source of truth for "is this shared across all builders, or per-builder?"**
> Read this BEFORE changing anything in a quote builder. Goal: change a *shared/main
> element once* and have it apply to all four; only touch per-builder files for
> method-specific logic. Last verified 2026-06-02.

## Flagship model & change propagation (set 2026-06-03, Erik's question)
**What we're trying to achieve:** one family of quote builders that LOOK and FLOW like
siblings without being clones — uniform chassis, method-correct cargo.

**EMB is the FLAGSHIP.** It's the richest surface (garments + caps + the most services),
so patterns proven there generalize DOWN to the simpler builders. Design + prove a change
on EMB first, then propagate.

**Every change is STRUCTURE or CONTENT — sort it first:**
- **Structure / pattern (SHARED):** *where/how* — totals-under-line-items layout, sales-tax
  placement, the shipping modal, the `.flow-step` order-flow shell, the Services-bar mechanism,
  date defaults. Lives in shared files (`quote-builder-common.css`, `embroidery-quote-invoice.js`,
  `quote-services-bar.js`, `quote-builder-utils.js`). Change once → all trio builders get it.
- **Content / data (PER-METHOD):** *what* — the service catalog (EMB: Logo Mockup/Graphic
  Design/stitch counts; SCP: screens/ink colors; DTF: transfer sizes/gang sheets), the pricing
  engine (`{method}-pricing-service.js`), the design/logo config. Stays per-builder.

**The "it won't 100% map" resolution:** most things that feel un-mappable are CONTENT, not
structure. "Where sales tax sits" = structure (maps perfectly). "Stitch count" = content (never
leaves EMB). Sort each change into structure-vs-content and the mapping problem dissolves.

**Propagation rule — ADOPT, don't COPY.** Never copy EMB's HTML into SCP/DTF (drags EMB-only
fields along + drifts immediately). Extract the structural part to a shared module/CSS; the other
builder ADOPTS it and supplies its own config. EMB-only pieces can't follow because they aren't in
the shared part. *The Services bar is the proof: one shared `quote-services-bar.js` + a different
`*_SERVICE_CATALOG` per builder.*

**Operating procedure (every future change):**
1. Build/prove on EMB (flagship). 2. Structure or content? Structure → promote to the shared layer;
content → stays EMB. 3. SCP/DTF adopt the shared piece + wire their own config. 4. **DTG = LEAVE IT**
(inline-form architecture; it already shares only the universal bits — PDF generator, utils. Do NOT
force its UI to match; a full fold-in is a separate, much-later project). 5. Record shared-vs-per-method
below so the next change routes itself.

## The five order surfaces (all push to ManageOrders)
| Surface | Pattern | Core JS |
|---|---|---|
| **DTG** (flagship) | **inline-form** (DIFFERENT from the other 3) | `dtg-inline-form.js`, `dtg-quote-page.js`, `dtg-catalog.js`, `dtg-pricing-service.js` |
| **EMB** | "quote-builder" | `embroidery-quote-builder.js`, `embroidery-pricing-service.js`, `embroidery-quote-service.js`, `embroidery-quote-pricing.js` |
| **SCP** | "quote-builder" | `screenprint-quote-builder.js`, `screenprint-pricing-service.js`, `screenprint-quote-service.js` |
| **DTF** | "quote-builder" | `dtf-quote-builder.js`, `dtf-pricing-service.js`, `dtf-quote-service.js`, `dtf-quote-pricing.js`, `dtf-quote-page.js`, `dtf-quote-products.js` |
| **Order Form** (WIP, multi-method) | single-page order entry | `pages/order-form.html` + `order-form-*.js`; pushes via `server.js /api/submit-order-form` → `NWCA-OrderForm` |

### Order Form — the 5th surface (added 2026-06-02)
One staff-facing page that handles **all 6 methods at once** (EMB/SCP/DTG/DTF/Stickers/Emblems) via a drag-services panel + a single size matrix. It is **already partly unified**:
- **SHARES (today):** all 7 method pricing services (`{embroidery,cap-embroidery,screenprint,dtg,dtf,emblem,sticker}-pricing-service.js`), `manageorders-inventory-service.js`, `product-category-filter.js`. → *Proof the pricing engines are UI-agnostic; this is the model for the whole unification.*
- **Push:** `/api/submit-order-form` (server.js) → ManageOrders `NWCA-OrderForm` (apiSource now blank like the rest). The 2026-06-02 push fixes (base PN size-suffix, tax block 2200.101/2202, Notes To Production, per-size breakout) already apply here.
- **Does NOT yet share:** the PDF/invoice generator (`embroidery-quote-invoice.js`), the shared size config (`extended-sizes-config.js` — it has its own `order-form-size-suffix.js`), `quote-builder-utils.js`. → these are its Phase-3 items.

## TIER 1 — SHARED: change ONE file → applies everywhere

### Shared by ALL 4 builders
| File | Controls | Change here for… |
|---|---|---|
| **`shared_components/js/embroidery-quote-invoice.js`** | **THE PDF / invoice / print generator** | ANY invoice or PDF change: layout, page fit, totals math, tax block, the method specs/locations box, footer. *Dispatches by method flag (`isDTG`/`isScreenprint`/`isDTF`/else=EMB).* ← **the #1 "change once → all 4" file.** |
| `shared_components/js/quote-builder-utils.js` | shared utility fns | any shared helper |
| `shared_components/js/customer-context-banners.js` | customer banners | banner behavior |

### Shared by EMB / SCP / DTF (the "trio" — NOT DTG)
`extended-sizes-config.js` (size→suffix/column) · `artwork-upload.js` · `customer-lookup-service.js` · `product-category-filter.js` · `product-thumbnail-modal.js` · `inventory-badges.js` · `exact-match-search.js`
CSS: `quote-builder-common.css` · `quote-builder-shell.css` · `quote-share-modal.css` · `color-picker-shared.css` · `customer-lookup.css`

### Backend (caspio-pricing-proxy) — shared push logic (SCP/DTF/EMB)
| File | Controls |
|---|---|
| `config/size-suffix-config.js` | `getPartNumber` size-suffix map (push uses BASE PN; SW appends — see LESSONS 2026-06-02) |
| `config/manageorders-emb-config.js` | `getTaxAccount` (rate→GL account, 10.1%→2200.101) + `buildSalesTaxNote` (DTG-style tax block, all 3 transformers) |
| `lib/{scp,dtf,embroidery}-push-transformer.js` | the 3 push transformers — usually change TOGETHER |

## TIER 2 — METHOD-SPECIFIC: edit per builder (then CHECK the others)
- Pricing engine / tiers / upcharges → `{method}-pricing-service.js` / `*-quote-pricing.js`
- Save/load → `{method}-quote-service.js`
- Location / artwork / method-only fields, the 4 HTML pages
- **Rule:** a change to one builder's method logic USUALLY applies to the analogous spot in the other 3 (per CLAUDE.md Quote Builder Sync). Always check all 4.

## Change-routing cheat sheet (where does X go?)
| You want to change… | Go to | Scope |
|---|---|---|
| Invoice / PDF layout, page-fit, totals, tax display | `embroidery-quote-invoice.js` | ALL 4 ✓ |
| Size suffix / matrix / extended sizes (UI) | `extended-sizes-config.js` (+ DTG separately) | trio (DTG gap) |
| Size suffix on the SW push | `config/size-suffix-config.js` (proxy) | SCP/DTF/EMB |
| Tax account / tax notes on push | `manageorders-emb-config.js` (proxy) | SCP/DTF/EMB |
| Shared utility | `quote-builder-utils.js` | ALL 4 |
| Pricing / upcharge / tier logic | `{method}-pricing-service.js` | one builder — CHECK all 4 |
| Common UI panel (customer/fees/totals/modal) | shared CSS today; markup still per-HTML | trio shared CSS; DTG separate; promote to partial when touched |

## ⚠️ DTG caveat
DTG uses the inline-form architecture and does NOT share the trio's common UI/CSS — only the **PDF generator** + utils + context banners. A UI/panel change to EMB/SCP/DTF must be **separately applied to DTG** until the Phase-3 refactor (ROADMAP_2026_05) folds DTG into the shared pattern.

## "Main elements" that MUST stay uniform across all four
PDF/invoice layout · totals + tax block · size handling · customer-info panel · fee/charges panel · modal styling.
Today: **PDF/totals/tax = already single-source ✓**; size config = shared (DTG gap); panels = shared CSS for the trio, separate for DTG.

## Roadmap to FULL uniformity (so nothing is edited 5×) — covers DTG/EMB/SCP/DTF **+ Order Form**
Already shared across all 5: the **7 pricing services** (Order Form proves they're UI-agnostic) + the ManageOrders push path. Phase 3 extends that to the other main elements.
1. **(done) Manifest** — this file. Routes every change.
2. **Enforce**: all invoice/PDF/totals/size/tax logic stays in the shared files above. Never duplicate them into a surface.
3. **Phase 3.1 — shared `pricingData` contract** (the shape the invoice consumes) + validator + jest lock. Low risk, foundation. **START HERE.**
4. **Phase 3.2 — unify size + per-size pricing** (DTG already has `_priceBySize`; trio + Order Form get the same model → fixes the 2XL upcharge gap).
5. **Phase 3.3 — shared save/load base** (promote `quote-builder-base.js`).
6. **Phase 3.4 — promote common UI panels** (size matrix, fee/customer panels, modals) to shared renderers so all 5 render from one source.
7. **Phase 3.5 — fold DTG (and the Order Form's invoice/size gaps) onto the shared base** → a main-element change then reaches all 5 automatically.
