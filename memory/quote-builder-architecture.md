# Quote Builder Architecture & Change-Routing Manifest

> **Single source of truth for "is this shared across all builders, or per-builder?"**
> Read this BEFORE changing anything in a quote builder. Goal: change a *shared/main
> element once* and have it apply to all four; only touch per-builder files for
> method-specific logic. Last verified 2026-06-02.

## The four builders
| Builder | Pattern | Core JS |
|---|---|---|
| **DTG** (flagship) | **inline-form** (DIFFERENT from the other 3) | `dtg-inline-form.js`, `dtg-quote-page.js`, `dtg-catalog.js`, `dtg-pricing-service.js` |
| **EMB** | "quote-builder" | `embroidery-quote-builder.js`, `embroidery-pricing-service.js`, `embroidery-quote-service.js`, `embroidery-quote-pricing.js` |
| **SCP** | "quote-builder" | `screenprint-quote-builder.js`, `screenprint-pricing-service.js`, `screenprint-quote-service.js` |
| **DTF** | "quote-builder" | `dtf-quote-builder.js`, `dtf-pricing-service.js`, `dtf-quote-service.js`, `dtf-quote-pricing.js`, `dtf-quote-page.js`, `dtf-quote-products.js` |

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

## Roadmap to FULL uniformity (so nothing is edited 4×)
1. **(done) Manifest** — this file. Routes every change.
2. **Enforce**: all invoice/PDF/totals/size/tax logic stays in the shared files above. Never duplicate them into a builder.
3. **Promote common UI to shared renderers** — extract the duplicated HTML panels (size matrix, fee panel, customer panel, modals) into shared JS partials so all 4 render from one source (medium effort).
4. **Refactor DTG to the shared pattern** (ROADMAP Phase 3) so it's a true peer — then a panel change reaches all 4 automatically.
