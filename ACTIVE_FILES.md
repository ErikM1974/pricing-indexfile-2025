# Active Files Registry
**Last Updated:** 2026-06-11
**Total Active Files:** 575 (HTML+JS+CSS, excludes `node_modules/`, `.git/`, `tests/`, `.claude/`, `archive-working-files/`)
**Purpose:** Track all active files to prevent orphaned code accumulation
**Audit cadence:** Quarterly. Bump the timestamp on every file create/delete/move (CLAUDE.md Top 8 Rule #5).

## ⚠️ Root Directory JavaScript Files (Legacy Location)

**Note:** These files are still in root directory for historical reasons. They should eventually move to `/shared_components/js/` but currently index.html depends on these paths.

**⚠️ IMPORTANT:** DO NOT MOVE these files without updating all HTML references. index.html has hardcoded paths to these root files.

| File | Purpose | Used By | Future Action |
|------|---------|---------|---------------|
| `app-modern.js` | Main application logic | index.html | Move to shared_components |
| `app-new.js` | New app version | Unknown | Verify if needed |
| `autocomplete-new.js` | Search autocomplete | index.html | Move to shared_components |
| `brands.js` | Brands listing page logic | brands.html | Move to shared_components |
| `brands-flyout.js` | Brands flyout/dropdown menu (header nav) | index.html, multiple | Move to shared_components |
| `c112-bogo-promo.js` | BOGO promotion logic | Specific promo | Move to calculators |
| `cart.js` | Cart functionality | NONE (cart.html retired 2026-06-11) | 🚩 Dead — flagged for deletion |
| `cart-ui.js` | Cart UI components | NONE (cart.html retired 2026-06-11) | 🚩 Dead — flagged for deletion |
| `cart-price-recalculator.js` | Price recalculation | NONE (cart.html retired 2026-06-11) | 🚩 Dead — flagged for deletion |
| `catalog-search.js` | Catalog search | index.html | Move to shared_components |
| `home-2026.js` | Homepage chrome glue (drawer close/Escape/scroll-lock, All-categories tile) — 2026 redesign | index.html | ✅ Active (NEW 2026-06-11) |
| `dp5-helper.js` | Helper functions (root copy — see also `/shared_components/js/dp5-helper.js`) | Unknown | Verify if needed |
| `order-form-pdf.js` | PDF generation | NONE (cart.html retired 2026-06-11) | 🚩 Dead — flagged for deletion |
| `pricing-matrix-api.js` | Pricing API (root copy — see also `/shared_components/js/pricing-matrix-api.js`) | NONE (cart.html retired 2026-06-11; calculators use the shared_components copy) | 🚩 Dead — flagged for deletion |
| `product-search-service.js` | Product search | index.html, multiple | Move to shared_components |
| `utils.js` | Utility functions | Multiple pages | Move to shared_components |

### Root-Level HTML & Backend (not migrated to subdirs)

| File | Purpose | Notes | Status |
|------|---------|-------|--------|
| `/index.html` | Main catalog page | See "Main Pages" section | ✅ Active |
| `/product.html` | Product display page | See "Main Pages" section | ✅ Active |
| `/brands.html` | Brands listing page | brands.js, brands.css, brands-flyout.js | ✅ Active |
| `/staff-dashboard-v3/index.html` | Staff dashboard (V3 — sole canonical, served at `/staff-dashboard.html`) | See "Dashboard & Admin" section | ✅ Active |
| `/staff-dashboard-v3/art-aging-widget.js` | Hub "Art Requests Needing Attention" card — aging counts (>7d red / 3-7d yellow) + 5 oldest, lazy-loaded, self-contained (2026-07-05) | config.js, caspio-date-utils.js, /api/artrequests | ✅ Active |
| `/emailjs-template-mockup-customer-approval.html` | EmailJS HTML template — customer mockup approval email body | EmailJS service | ✅ Active |
| `/server.js` | Express server (port 3000) — routes for `/api/submit-order-form`, `/api/3-day-tees-checkout`, etc. | Express, EmailJS, Stripe, Caspio proxy | ✅ Active |
| `/lib/quote-snapshot-diff.js` | **NEW (2026-06-26)** `diffSnapshots()` + helpers (`WATCHED_ORDER_FIELDS`, `normalizeForDiff`, `sizeColsOf`) extracted from server.js so the SW-snapshot change-detection is unit-testable (server.js boots on require). Now also diffs per-size `Size01..06` → `LineSizes[...]` change rows. | required by server.js (sync-from-shopworks) | ✅ Active |
| `/robots.txt` | Crawler rules — staff/internal paths + credential share-links disallowed (2026-06-11) | served via server.js `/robots.txt` route | ✅ Active |
| `/jest.config.js` | Jest test runner config (used by `tests/jest/`) | Jest | ⚙️ Tooling |

### Root-Level Stylesheets (legacy location)

| File | Purpose | Used By | Future Action |
|------|---------|---------|---------------|
| `main.css` | Primary global styles | NONE (index.html moved to nwca-2026.css 2026-06-11) | 🚩 Dead — flagged for deletion |
| `main-redesign.css` | 2025 redesign styles | brands.html ONLY (index.html moved to nwca-2026.css 2026-06-11) | ⚠️ Retire after brands.html migrates |
| `cart-styles.css` | Cart page styles | NONE (cart.html retired 2026-06-11) | 🚩 Dead — flagged for deletion |
| `gallery-styles.css` | Product gallery styles | NONE (no HTML links it, verified 2026-06-11) | 🚩 Dead — flagged for deletion |
| `pricing-pages.css` | Shared pricing page styles | Pricing pages | Move to shared_components |
| `pricing-pages-enhanced.css` | Enhanced pricing page styles | Pricing pages | Move to shared_components |
| `product-styles.css` | Product page styles | product.html | Move to shared_components |
| `modern-search-interface.css` | Modern search UI styles | NONE (no HTML links it, verified 2026-06-11) | 🚩 Dead — flagged for deletion |
| `catalog-search.css` | Catalog search base styles (autocomplete, product cards) — skinned by nwca-2026.css | index.html | ✅ Active |
| `/shared_components/css/nwca-2026-core.css` | **NEW** 2026 design system CORE — tokens/base, buttons/chips, masthead + mega-nav, drawer, footer, interior-page primitives (page header, forms, tables, alerts, toasts, badges, pager, skeletons, cards, modal base, empty state). Load FIRST on every 2026-system page. Class reference: `NWCA-2026-GUIDE.md` | index.html (+ all interior pages migrating per memory/CUSTOMER_SITE_REDESIGN_2026-06.md) | ✅ Active (NEW 2026-06-11, split from nwca-2026.css) |
| `/shared_components/css/nwca-2026.css` | 2026 design system HOMEPAGE layer ("press-room editorial" green refresh) — hero, homepage bands, catalog results layer, quick-view/compare modals. REQUIRES nwca-2026-core.css loaded first | index.html only | ✅ Active (NEW 2026-06-11; core layers split out 2026-06-11) |
| `/shared_components/css/NWCA-2026-GUIDE.md` | **NEW** Class reference for nwca-2026-core.css interior-page primitives (one snippet per primitive) — read this instead of the CSS when building pages | Developers building 2026-system pages | 📖 Docs (NEW 2026-06-11) |
| `brands.css` | Brands page styles | brands.html | Move to shared_components |

## 🎯 Core Entry Points

### Main Pages
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/index.html` | Main catalog page | app-modern.js, product-search-service.js, catalog-search.js, autocomplete-new.js | ✅ Active |
| `/product.html` | Product detail (2026 redesign) — gallery, swatches, live inventory, 3-question decoration CONFIGURATOR (qty → placement → priced method chips) gated by method eligibility; tier matrix demoted to "See every quantity price" expandable; "Add to quote" CTA + masthead quote badge + toast (Phase 2 quote-cart) | product/js/product-2026.js, product/js/pdp-configurator.js, product/css/product-2026.css, nwca-2026-core.css, decoration-methods.js, quote-cart-engine.js, quote-cart-store.js, embroidery-quote-pricing.js, dtf-quote-pricing.js, 5 shared pricing services | ✅ Active (quote-cart Phase 2 2026-06-11) |
| `/product/css/product-2026.css` | Page-layer CSS for product.html on nwca-2026 system (incl. `.pdp-cfg-*` configurator styles + `.pdp-cfg-actions` add-to-quote block) | nwca-2026-core.css | ✅ Active |
| `/product/js/product-2026.js` | product.html page logic: product/inventory/related fetch, eligibility lookup (DecorationMethods), SEO/JSON-LD, CTA mailto built from the configurator selection; Add-to-Quote wiring (pooling-scope conflict guard + toast w/ "View quote (N)" link — zero price math, selection from PdpConfigurator.getSelection); hands all pricing UI to PdpConfigurator | DecorationMethods, PdpConfigurator, QuoteCartStore | ✅ Active |
| `/product/js/pdp-configurator.js` | 3-question decoration configurator (Phase 1 quote-cart): qty stepper, placement chips (garment/cap), SCP ink stepper, per-method priced chips + total/LTM-honesty/nudge via QuoteCartEngine.singleItemPreview (zero local price math), location-aware tier-matrix expandable, per-chip visible error states; getSelection() exposes status/engineMethod/sizes for the Add-to-Quote flow | QuoteCartEngine + EmbroideryPricingCalculator + DTFConfig + EMB/CAP/DTG/SCP/DTF PricingService globals | ✅ Active (NEW 2026-06-11) |
| `/pages/catalog.html` | Dedicated customer catalog (URL state, facets, quick view, category landing) — served at `/catalog`; masthead quote badge (markup + quote-cart-store.js script only — catalog-2026.js untouched) | nwca-2026-core.css, catalog-2026.css/js, product-search-service.js, decoration-methods.js, app-modern.js, brands-flyout.js, quote-cart-store.js | ✅ Active (badge 2026-06-11) |
| `/pages/css/catalog-2026.css` | Catalog page layer CSS (facet rail + mobile filter drawer, cards, autocomplete v2) | nwca-2026-core.css | ✅ Active |
| `/pages/js/catalog-2026.js` | Catalog logic: URL state, facets (incl. `?method=` Decoration filter from the decoration-methods rules feed), server-price-only cards, autocomplete v2 w/ thumbnails, quick view | product-search-service.js (read-only), DecorationMethods | ✅ Active |
| `/pages/quote-cart.html` | Customer cart page (clean URL `/quote-cart`) — per-print-type group cards (pooled qty + tier badge + tier-progress meter), qty steppers, engine service/fee/LTM rows, amber tier nudges, totals panel (engine grandTotal ONLY — withheld w/ visible error when any group fails), Email-instead mailto, empty state. **Phase 3 (2026-06-11): "Save & email my quote" — slide-down form + per-group artwork upload + frozen WQ save (web-quote-service.js) + share-link success panel + EmailJS notifications** | nwca-2026-core.css, quote-cart.css, quote-cart-page.js, quote-cart-store.js, quote-cart-engine.js, web-quote-service.js, EmailJS SDK + authorities (embroidery-quote-pricing.js, screenprint-pricing-service.js, dtf-pricing-service.js, dtf-quote-pricing.js) | ✅ Active (Phase 3 2026-06-11) |
| `/pages/css/quote-cart.css` | Quote-cart page layer CSS (group cards, tier-progress meter, line rows + steppers, fee rows, amber nudge box, sticky totals rail; Phase 3 save panel: slide-down form, artwork fieldset, spinner, share-link success block; 375px single-column) | nwca-2026-core.css | ✅ Active |
| `/pages/js/quote-cart-page.js` | Quote-cart page logic: reprice via QuoteCartEngine.priceCart on every load + after every store mutation (ZERO local price math); group cards render engine results verbatim (baked-LTM honest lines foot via full-precision effectiveUnit, SCP itemized fees), per-group error card + Retry + grand-total withholding, qty steppers → QuoteCartStore.updateQty, mailto from the grouped summary. **Phase 3: save-panel state machine (form → saving → success, PRICING_CHANGED re-confirm), per-group artwork picks (20 MB image/pdf; upload failure = visible warning, save continues), localhost-gated `?dryrun=1`, fire-and-forget emails** | QuoteCartEngine, QuoteCartStore, WebQuoteService, EmbroideryPricingCalculator + DTFConfig + SCP/DTF services | ✅ Active (Phase 3 2026-06-11) |

### Secondary Pages (/pages/ directory)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/policies-hub.html` | **CANONICAL** Caspio-backed Policies Hub (tree sidebar, search, category chips, admin-gated CRUD) — renamed 2026-05-14 from policies-hub-v2.html as the production cutover | policies-admin-gate.js, policies-api.js, policies-hub.js, policies-hub-v2.css | ✅ Active |
| `/pages/policies-hub-legacy.html` | Pre-Caspio hardcoded hub (9 cards, no editing) — archived 2026-05-14 for safety; safe to delete after ~30 days if no fallback events | dashboard-styles.css, policies-hub.css | 🗄️ Legacy |
| `/pages/policy-detail.html` | **NEW** Individual policy read/edit page (TipTap rich-text editor, breadcrumb, outline, sub-procedures) | policies-admin-gate.js, policies-api.js, policy-editor-tiptap.js, policy-detail.js, policies-hub-v2.css, policy-detail.css | ✅ Active |
| `/pages/css/policies-hub-v2.css` | **NEW** Stylesheet for policies hub v2 (tree sidebar, cards, category chips, NW-green theme) | — | ✅ Active |
| `/pages/css/policy-detail.css` | **NEW** Stylesheet for policy-detail.html (prose body, TipTap chrome, outline sidebar, edit form) | — | ✅ Active |
| `/shared_components/js/policies/policies-api.js` | **NEW** Policies Hub fetch wrapper (public reads + admin CRUD, 401 redirect, 409 concurrency) | /api/policies-public/*, /api/crm-proxy/policies/* | ✅ Active |
| `/shared_components/js/policies/policies-admin-gate.js` | **NEW** Resolves `window.IS_POLICIES_ADMIN` from `/api/crm-session/me` permissions; emits `policies:admin-resolved` event | /api/crm-session/me | ✅ Active |
| `/shared_components/js/policies/policies-hub.js` | **NEW** Hub page controller (tree render, search debounce, category filter, grid/list toggle, recently-updated) | PoliciesAPI, PoliciesAdminGate | ✅ Active |
| `/shared_components/js/policies/policy-detail.js` | **NEW** Detail page controller (read/edit/new modes, save flow, autosave drafts, sub-procedure listing) | PoliciesAPI, PoliciesAdminGate, PolicyEditor, DOMPurify (CDN) | ✅ Active |
| `/shared_components/js/policies/policy-editor-tiptap.js` | **NEW** TipTap 2.10.4 rich-text editor wrapper loaded from esm.sh — StarterKit + Image + Link + Table + Placeholder + Typography + custom videoEmbed node (YouTube/Loom/Vimeo). Image upload via drag-drop, paste, or button → `/api/files/upload`. AI Assist toolbar button. | esm.sh @tiptap/* @2.10.4, /api/files/upload, PolicyAIAssist | ✅ Active |
| `/shared_components/js/policies/policy-ai-assist.js` | **NEW** AI Assist modal for the TipTap editor — action picker (Generate / Polish / Expand / Summarize / FAQ / Translate / Explain-like-I'm-new), SSE stream consumer with live token rendering, Insert or Replace into editor | `/api/policies/ai-assist`, DOMPurify | ✅ Active |
| `/shared_components/js/policies/policy-ai-search.js` | **NEW** AI semantic search modal for the hub — natural-language query → Claude ranks the policy index → shows confidence-tagged results with "why this matches" explanations | `https://caspio-pricing-proxy/api/policies-ai-search` (public, rate-limited) | ✅ Active |
| `/shared_components/js/policies/policy-lightbox.js` | **NEW** Image lightbox for the policy detail page — click any `<img>` inside `.policy-body` → fullscreen overlay with prev/next arrow navigation, Esc closes, ← → cycles | (no deps) | ✅ Active |
| `/shared_components/js/policies/policy-mermaid.js` | **NEW** Mermaid diagram support — auto-renders `<pre class="mermaid">` blocks on read view (lazy-loaded from jsDelivr CDN), plus "Insert diagram" modal with tabs (Generate-from-prompt via Claude / Write Mermaid code by hand), live preview, and Insert into TipTap editor | mermaid@10.9.1 from jsDelivr CDN, `/api/policies/ai-assist` (action=generate-mermaid) | ✅ Active |
| `/shared_components/js/policies/policy-comments.js` | **NEW** Threaded discussion / Q&A panel on every policy detail page — anyone with sessionStorage auth can post + reply; admin (policies-admin) can resolve questions, hide comments, and click "✨ Polish with AI" to clean up draft text via the existing AI Assist endpoint. Author avatar shows stable color-coded initials. URL-hash deep-link (`#comment-<id>`) scrolls into view + flashes the target + auto-sets reply target. | `https://caspio-pricing-proxy/api/policy-comments-public` (open reads + posts), `/api/crm-proxy/policy-comments` (admin moderation), `/api/policies/ai-assist` (action=polish-draft) | ✅ Active |
| `/pages/policy-questions.html` | **NEW** Open Questions Inbox — admin-only aggregated view of every unresolved question across all policies. Sortable/filterable, with "Reply on policy" / "Mark resolved" / "Hide" actions. Stale (>3 day) and very-stale (>7 day) cards get amber/red left-border accents. | policy-questions-inbox.js, policies-admin-gate.js, policies-hub-v2.css | ✅ Active |
| `/shared_components/js/policies/policy-questions-inbox.js` | **NEW** Question Inbox controller — fetches /api/crm-proxy/policy-comments/inbox (admin-gated, joins questions with policy metadata server-side), renders sort/filter toolbar + question cards, handles resolve/hide actions, falls back to a "locked" notice for non-admin users. | `/api/crm-proxy/policy-comments/inbox`, policies-admin-gate.js | ✅ Active |
| `/pages/handbook.html` | **NEW (2026-05-27)** Employee Handbook online reader — single-page scrolling view of all 22 chapters with sticky TOC sidebar, scroll-spy highlighting, smooth-scroll anchors, print + PDF download buttons. Auto-syncs with Caspio chapter policies (same content as the auto-generated PDF). | handbook-reader.js, handbook.css, policies-hub-v2.css | ✅ Active |
| `/pages/css/handbook.css` | **NEW (2026-05-27)** Stylesheet for handbook.html — sticky TOC sidebar layout, chapter cards, Fraunces typography for chapter titles, print media query, mobile collapse. Extends policies-hub-v2.css design tokens. | — | ✅ Active |
| `/shared_components/js/policies/handbook-reader.js` | **NEW (2026-05-27)** Handbook reader controller — fetches parent + 22 chapters from `/api/policies-public/*` in throttled batches (4 parallel, 250ms gap to avoid 429), renders hero + intro + chapters + TOC, scroll-spy via IntersectionObserver, back-to-top button, print handler. | `https://caspio-pricing-proxy/api/policies-public/*` | ✅ Active |
| `/scripts/build-handbook-pdf.py` | **NEW (2026-05-27, polished 2026-05-28)** Permanent PDF generator — fetches employee-handbook parent + 22 chapters via the public proxy API, assembles into single HTML, renders to PDF via xhtml2pdf. Corporate polish: full-bleed "Employee Handbook" cover with NWCA logo (PIL-rendered PNG, prepended as a full-page image by PyMuPDF since xhtml2pdf can't full-bleed), embedded brand fonts (Source Serif 4 + Source Sans 3 from `scripts/fonts/`), Contents page (one page) with real page numbers via 2-pass render (PyMuPDF reads pass-1 bookmarks → rebuilds TOC), `Page N` footers, numbered chapter openers, signature block on the Acknowledgment page for bound copies. Re-run any time chapters change. Output → `forms/Employee-Handbook-Latest.pdf`. **Not a temp script** — keep. | Python 3 + xhtml2pdf + Pillow + PyMuPDF (`pip install xhtml2pdf Pillow PyMuPDF`) | ✅ Active |
| `/scripts/fonts/` | **NEW (2026-05-28)** 7 OFL static TTFs embedded into the handbook PDF (xhtml2pdf `@font-face` is broken on Windows, so these are pre-registered with reportlab in `register_fonts()`): `SourceSerif4-Regular/Bold/Black.ttf` (display headings + cover) + `SourceSans3-Regular/Bold/It/BoldIt.ttf` (body). Used only by `build-handbook-pdf.py`. | (consumed by build-handbook-pdf.py) | ✅ Active |
| `/scripts/assets/nwca-logo.png` | **NEW (2026-05-28)** NWCA logo (437×238 RGBA) composited onto the handbook PDF cover by `build_title_png` (placed on a white rounded plate so the dark-green artwork shows on the green gradient). Used only by `build-handbook-pdf.py`. | (consumed by build-handbook-pdf.py) | ✅ Active |
| `/forms/Employee-Handbook-Latest.pdf` | **NEW (2026-05-27, repolished 2026-05-28)** Auto-generated 37-page Employee Handbook PDF — full-bleed "Employee Handbook" cover with NWCA logo, single-page Contents with `Page N` footers, brand-fonted corporate typography, print/bind-ready. Regenerate via `python scripts/build-handbook-pdf.py` after any chapter edit in the Policies Hub. Linked from `/pages/handbook.html`, `/pages/policies-hub.html` hero tile, and the parent policy's Body_HTML. | (generated by build-handbook-pdf.py) | ✅ Active |
| `/scripts/seed-policies.js` | **NEW** Stub seed script — inserts via /api/policies once the proxy is deployed (superseded by `seed-policies-direct.js` for initial migration) | Node `https`, CRM_API_SECRET env var | 🔧 Deferred (proxy-based) |
| `/scripts/extract-legacy-policies.js` | **NEW** Extracts/cleans the 9 legacy policy HTML files → writes `scripts/legacy-policies.json` | Node `fs`/`path` | 🔧 One-time (ran 2026-05-14) |
| `/scripts/seed-policies-direct.js` | **NEW** Direct Caspio inserter — reads `legacy-policies.json` and POSTs to Caspio REST API using credentials from `caspio-pricing-proxy/.env`. Used for initial migration before proxy deploy. | Node `https`, Caspio OAuth | 🔧 One-time (ran 2026-05-14, seeded 9 rows) |
| `/scripts/verify-policies.js` | **NEW** Reads back the `Policies` table from Caspio and prints a per-row summary — confirms a seed/migration landed | Node `https`, Caspio OAuth | 🔧 Diagnostic |
| `/scripts/backfill-body-plain.js` | **NEW** One-shot: scans every `Policies` row where Body_HTML is set but Body_Plain is empty, derives plain text locally, and PUTs it back via Caspio REST. Used 2026-05-14 to fix the 9 legacy-migrated rows whose bulk insert bypassed the server-side strip. | Node `https`, Caspio OAuth | 🔧 One-time (ran 2026-05-14) |
| `/scripts/reparent-policy.js` | **NEW** Direct Caspio PUT to set `Parent_Policy_ID` on a given policy — used to demo the 3-level hierarchy. Started with `ltm-order-decision-algorithm` → child of `ltm-fee-policy`. Add more `RE_PARENT_PAIRS` and re-run. | Node `https`, Caspio OAuth | 🔧 Reusable |
| `/scripts/legacy-policies.json` | **NEW** Generated artifact from `extract-legacy-policies.js` — 9 cleaned policy records ready for Caspio insert | (generated) | 🔧 Generated |
| `/scripts/dry-run-backfill-shopworks-wo.js` | **NEW (2026-06-16)** READ-ONLY audit: finds storefront quotes whose ShopWorks order exists in ManageOrders but whose `quote_sessions.ShopWorks_Order_Number` is empty (which freezes their synced name/status). Cross-checks live MO orders (PO==QuoteID) against quote_sessions via the proxy public API — no Caspio creds, no writes. Builder quotes (EMB/SCP/DTF/OF) link by ExtOrderID, not PO, so they're out of scope (see header). `DAYS_BACK=N node scripts/dry-run-backfill-shopworks-wo.js`. | Node global `fetch`, proxy `/api/manageorders/orders` + `/api/quote_sessions` | 🔧 Diagnostic (reusable) |
| `/scripts/capture-pricing-baselines.js` | **NEW (2026-05-23)** Phase 0b — Puppeteer headless capture of all 22 pricing baseline scenarios (DTG/EMB/DTF/SCP). Spawns or reuses dev server, navigates each builder, evals pricing services, writes `tests/pricing-baselines/baselines.captured.json`. Used by `npm run capture:pricing` (local) and `npm run test:pricing-baselines` (CI gate vs `baselines.locked.json`). | puppeteer@24, server.js on :3000, each builder's `*-pricing-service.js` exposed on window | ✅ Active (18/22 wired: DTG 5/5, EMB 3/7, DTF 5/5, SCP 5/5; EMB-03/04/05/06 stubs for Phase 0b.1) |
| `/tests/integration/pricing-baselines.test.js` | **NEW (2026-05-23)** Phase 0b — Jest regression gate. Runs the capture script then diffs each scenario's captured values against `baselines.locked.json`. Fails CI if any per-piece, line subtotal, LTM, or grand-total drifts >$0.01. Per-size breakdown comparison too. Tolerates stub scenarios (Phase 0b.1) — they skip rather than fail. | `scripts/capture-pricing-baselines.js`, jest@30, `tests/pricing-baselines/baselines.locked.json` | ✅ Active |
| `/tests/integration/order-form-parity.test.js` | **NEW (2026-06-09)** Jest CI gate wrapping the order-form parity harness — fails the build on ANY order-form↔quote-page money divergence. Soft-skips if no local :3000 server (CI=1 spawns its own). Asserts ≥19 covered scenarios + 0 mismatches. `npm run test:order-form-parity`. | `scripts/capture-order-form-baselines.js`, jest@30, puppeteer | ✅ Active |
| `/scripts/capture-order-form-baselines.js` | **NEW (2026-06-09)** Order-form ↔ **LIVE** quote-page PARITY harness (redesign safety net). On the order-form page (which loads every `*-pricing-service.js`), computes BOTH the live quote-page price (reusing `capture-pricing-baselines.js` `PAGE_RUNNERS`) AND the order-form `priceForm()` price, then diffs them — **live-vs-live, so a legit Caspio price change can't cause a false fail** (the v1 diff-vs-`baselines.locked.json` gave a false DTG "over-charge" alarm because the locked file was stale). Strips the order form's baked LTM-per-piece before comparing. `npm run capture:order-form-parity`. **Verified 2026-06-09: SCP 5/5 + DTG 5/5 + SCP-ADV-UB all GREEN** (SCP underbase per-piece fix + DTG service-delegation landed this session). Next: EMB/DTF mappers, DTG S-not-min adversarial, jest/CI wrapper. | puppeteer@24, server.js on :3000, order-form engine + `*-pricing-service.js` on window, `capture-pricing-baselines.js` (PAGE_RUNNERS/SCENARIOS) | ✅ Active (SCP+DTG; EMB/DTF pending) |
| `/tests/pricing-baselines/README.md` | **NEW (2026-05-23)** Phase 0b — Workflow guide. How to capture locally, how to re-lock after intentional pricing change, how to debug CI drift failures, what files do what. | (docs) | ✅ Active |
| `/tests/pricing-baselines/SCENARIOS.md` | **NEW (2026-05-23)** Phase 0a — Human-readable list of all 22 pricing scenarios (DTG 5, EMB 7, DTF 5, SCP 5). Specifies inputs (style, qty, sizes, location, stitches/colors) per case. | (docs) | ✅ Active |
| `/tests/pricing-baselines/baselines.captured.json` | **NEW (2026-05-23)** Phase 0b — Fresh capture output. Overwritten by every `npm run capture:pricing` run. **DO NOT manually edit.** | (generated) | 🔧 Generated |
| `/shared_components/js/dtf-quote-builder.js` (Phase 8 push) | **2026-05-23** Added `showDtfPushButton(quoteId)` + `dtfPushToShopWorks()` + invocation in `saveAndGetLink()` success. Mirrors EMB push pattern. Gated behind `?enableDtfPush=1` until Erik confirms `caspio-pricing-proxy/config/manageorders-dtf-config.js` OnSite IDs. POSTs to proxy `/api/dtf-push/push-quote`. | dtf-quote-builder.html (`#dtf-push-shopworks-btn`), proxy DTF push endpoint | ✅ Active (gated) |
| `/tests/pricing-baselines/baselines.locked.json` | **NEW (pending Erik sign-off)** Phase 0b — Erik-approved baseline values. CI gate target. Only updated via explicit lock workflow (see `README.md`). | (Erik-approved) | ⏸ Pending lock |
| `/shared_components/js/artwork-upload.js` | **NEW (2026-05-23)** Phase 9 — Shared drag-drop multi-file artwork upload widget. Posts to `/api/files/upload` (Caspio Artwork folder). Used by EMB/DTF/SCP quote builders to attach reference art to a quote. DTG has its own inline version with extra design-name/placements + SW Designs[] linking. API: `ArtworkUpload.attach({mountSelector, onChange})` → returns `{getFiles, setFiles, clear, isUploading, count}`. 20MB cap. Files saved as JSON inside `quote_sessions.Notes.referenceArtwork[]` — no schema change. | `/api/files/upload`, `quote-builder-shell.css`, Font Awesome | ✅ Active |
| `/shared_components/js/inventory-badges.js` | **NEW (2026-05-23)** Phase 10.1 — Shared SanMar inventory badge renderer for table-based quote builders (EMB/DTF/SCP). Wraps existing `OrderFormInventory.getInventoryForRow()`. When called with `(rowEl, {style, catalogColor})`, fetches per-size stock and injects small `.inv-badge` next to each `input.size-input`. Color-coded: green (≥100), amber (1-99), red (OOS), gray (unknown). Has size aliasing (XXL/2XL). DTG uses OrderFormInventory directly via React-style re-render; this module exists so HTML-table builders don't need a render-layer rewrite. API: `InventoryBadges.attach(rowEl, {style, catalogColor, sizeCellSelector})` and `clear(containerEl)`. | `pages/order-form/inventory/inventory-check.js`, `quote-builder-shell.css` (`.inv-badge` styles) | ✅ Active |
| `/shared_components/js/customer-design-combobox.js` | **NEW (2026-05-24)** Phase 11.1 — Shared customer-aware design lookup widget. Wraps an existing `<input>` and turns it into an autocomplete that searches the picked customer's designs via proxy `/api/designs/by-customer/:customerId?method=dtf\|scp\|emb\|dtg`. Per-customer 5-min cache. Shows thumbnail per row. Keyboard navigation (↑↓ Enter Esc). DTG has its own inline implementation; this widget is for DTF/SCP (and optionally a lighter alternative for EMB's modal+gallery). API: `CustomerDesignCombobox.attach(inputEl, {method, getCustomerId, onPick})` → returns `{refresh, clearCache, close}`. | proxy `/api/designs/by-customer`, `Designs2026` Caspio table | ✅ Active |
| `/shared_components/js/embroidery-chat.js` | **NEW (2026-05-24)** EMB Chat C — Research-only chat controller for the Embroidery Quote Builder's floating "Ask" panel. Streams SSE from proxy `/api/emb-quote-ai/chat` (Claude Sonnet 4.6). 3 tools: lookup_customer, recommend_top_sellers_emb (Caspio `EMB_Top_Sellers_2026` — Erik curates from 10yr sales), lookup_product_details (live SanMar). Does NOT write to the form (matches Erik's "rep builds quotes manually" charter). Leaner than DTG's controller — text bubbles + tool chips only, no result cards. Reuses `.ai-chat-*` CSS from sticker-pricing-page.css. | `/api/emb-quote-ai/chat`, sticker-pricing-page.css (chat panel styles), Font Awesome | ✅ Active |
| `/pages/pricing-negotiation-policy.html` | Pricing strategy & negotiation guide | Bootstrap, Font Awesome | ✅ Active |
| `/pages/inventory-details.html` | Inventory details page | Various | ✅ Active |
| `/pages/resources.html` | Resources page | Various | ✅ Active |
| `/pages/sale.html` | Sale page | Various | ✅ Active |
| `/pages/webstore-info.html` | Webstore information | Various | ✅ Active |
| `/pages/top-sellers-showcase.html` | Top sellers showcase (API-driven "New Products" filter - see CLAUDE.md § "Managing New Products") | Various | ✅ Active |
| `/pages/top-sellers-product.html` | Top sellers product page | Various | ✅ Active |
| `/pages/golf-tournaments-2026.html` | **NEW** Summer 2026 golf tournament campaign landing page (MailChimp funnel target) | golf-tournament-showcase.js, .css, embroidery-pricing-service.js, EmailJS | ✅ Active |
| `/pages/golf-tournament-product.html` | **NEW** Per-style detail page (colors/sizes/full pricing) — linked from golf-tournaments-2026.html product cards | golf-tournament-product.js, .css, embroidery-pricing-service.js | ✅ Active |
| `/memory/emailjs-custom-tees-templates.md` | **NEW** Paste-ready Subject + HTML for EmailJS `template_sample_customer`/`template_sample_sales` (Custom T-Shirts rewire of the legacy 3DT templates) + wiring checklist | EmailJS dashboard | ✅ Reference |
| `/pages/golf-tournament-lead-emailjs-template.html` | **NEW** Reference HTML for EmailJS `template_golf_lead` (paste into EmailJS dashboard) — internal lead alert to taneisha+nika+erik | EmailJS dashboard | ✅ Reference |
| `/pages/golf-tournament-customer-emailjs-template.html` | **NEW** Reference HTML for EmailJS `template_golf_customer` (paste into EmailJS dashboard) — customer-facing "thanks, we got your inquiry" confirmation | EmailJS dashboard | ✅ Reference |
| `/pages/quote-view.html` | **NEW** Public quote viewing page (shareable URL) | quote-view.js, quote-view.css | ✅ Active |
| `/pages/invoice.html` | **NEW** Single-page invoice view at `/invoice/:quoteId` — clean PDF-style one-pager that auto-syncs from ShopWorks (shares `/api/quote-sessions/:quoteId/full` with quote-view) | invoice.js, invoice.css | ✅ Active |
| `/pages/js/invoice.js` | **NEW** Invoice page controller — fetches full quote+ShopWorks snapshot, renders header/bill+ship/details/line items/totals, wires Print + Refresh-from-ShopWorks buttons, auto-syncs when snapshot >30min stale | /api/quote-sessions/:quoteId/full, /api/quote-sessions/:quoteId/sync-from-shopworks | ✅ Active |
| `/pages/css/invoice.css` | **NEW** Invoice page styles — print-first letter-paper layout, NWCA forest-green accent, condensed line items, screen-only toolbar, @media print rules | Inter font | ✅ Active |
| `/pages/embroidery-contract-pricing.html` | **NEW** Shareable contract embroidery pricing page | embroidery-contract-pricing.js, embroidery-contract-pricing.css | ✅ Active |
| `/pages/data-entry-guide.html` | **NEW** ShopWorks data entry guide with API-driven service prices | data-entry-guide.js, data-entry-guide.css, app-config.js | ✅ Active |
| `/pages/jds-mockup-creator.html` | Standalone JDS Polar Camel tumbler mockup creator — AEs/Steve pick a color, drop a logo, then download/copy/compare a customer-approval mockup. Canvas compositing + branded presentation frame + multi-color comparison sheet; no backend or AI calls. | jds-mockup-creator.js, jds-mockup-creator.css, jds-tumbler-template.js, /api/jds-catalog, /api/jds/products/:sku | ✅ Active |
| `/pages/garment-designer.html` | **NEW (2026-06-17)** NWCA Easy Shirt Designer — standalone canvas tool: place artwork (PNG/JPG/SVG/AI/PSD/PDF) **+ Tajima DST embroidery files** on a recolored shirt mockup by placement (Left Chest/Full Front/Upper/Full Back), assign Robison-Anton Poly thread colors per stitch element, generate a Customer Proof. Productionized from an 868KB single-file app → extracted JS/CSS (no-inline). Phase 1 integration (pre-seed + attach-to-ArtRequest) pending. | garment-designer.js, garment-designer.css, ag-psd@27, pdf.js@3.11, jszip@3.10 | ✅ Active |
| `/pages/data-entry-guide.js` | **NEW** API price fetching for data entry guide | /api/service-codes | ✅ Active |
| `/pages/data-entry-guide.css` | **NEW** Data entry guide styles (print-friendly) | — | ✅ Active |
| `/pages/design-gallery.html` | **NEW** Standalone design gallery — search 39K+ digitized designs | design-gallery.js, design-gallery.css, design-thumbnail-service.js, app-config.js | ✅ Active |
| `/pages/js/design-gallery.js` | **NEW** Design gallery controller — search, cards, share with customer, lightbox zoom | /api/digitized-designs/search-all, /by-customer | ✅ Active |
| `/pages/css/design-gallery.css` | **NEW** Design gallery page styles (responsive grid, cards, enlarged modal, lightbox) | — | ✅ Active |
| `/pages/design-view.html` | **NEW** Public customer-facing design preview page — shareable via /design/:designNumber | design-view.js, design-view.css, app-config.js | ✅ Active |
| `/pages/js/design-view.js` | **NEW** Customer design view — fetches design images, renders gallery + lightbox | /api/digitized-designs/lookup | ✅ Active |
| `/pages/css/design-view.css` | **NEW** Customer design view styles (branded, responsive, lightbox overlay) | — | ✅ Active |
| `/pages/art-request-detail.html` | **NEW** Staff-facing art request detail page — shareable via /art-request/:designId | art-request-detail.js, art-request-detail.css, app-config.js | ✅ Active |
| `/pages/art-billing-reference.html` | **NEW** Standalone billing-codes / file-requirements / file-definitions reference. Linked from Steve's gallery toolbar; shareable URL for customers and AEs. Was a tab on art-hub-steve.html (extracted 2026-04-26 to declutter Steve's nav). | art-hub.css | ✅ Active |
| `/pages/js/art-request-detail.js` | **NEW** Art request detail — fetches art request + notes, renders info cards + timeline, Box file upload | /api/artrequests, /api/design-notes, /api/art-requests/:id/upload-mockup (box-upload.js) | ✅ Active |
| `/pages/css/art-request-detail.css` | **NEW** Art request detail styles (two-column, status badges, billing grid, notes timeline) | — | ✅ Active |
| `/pages/dst-viewer.html` | **NEW** DST embroidery stitch file viewer — drag-drop .DST, color/mono/trace modes | dst-viewer.js, dst-viewer.css, Font Awesome, DM Mono/Outfit fonts | ✅ Active |
| `/pages/js/dst-viewer.js` | **NEW** DST binary parser, canvas renderer (3 modes), trace animation, thread color sequence | Vanilla JS, no dependencies | ✅ Active |
| `/pages/css/dst-viewer.css` | **NEW** DST viewer dark theme styles (2-col grid, canvas, sidebar, trace controls, responsive) | CSS variables | ✅ Active |
| `/pages/mockup-generator.html` | **NEW** Embroidery mockup generator — upload DST+EMB/PDF, generate colored mockups, compare threads | mockup-generator.js, mockup-generator.css, Font Awesome, Inter font | ✅ Active |
| `/pages/js/mockup-generator.js` | **NEW** Mockup generator frontend — file upload, API calls to Python Inksoft, thread display, comparison table | Vanilla JS, calls inksoft-transform Heroku | ✅ Active |
| `/pages/css/mockup-generator.css` | **NEW** Mockup generator dark theme styles (upload zones, results grid, comparison table, spinner) | CSS variables | ✅ Active |
| `/pages/js/thread-color-picker.js` | **NEW** Thread color picker modal — searchable RA catalog (~866 colors), family tabs, swatch grid | Vanilla JS, calls /api/embroidery/palette | ✅ Active |
| `/pages/css/thread-color-picker.css` | **NEW** Thread color picker modal dark theme styles (overlay, search, family tabs, color grid) | CSS variables | ✅ Active |

### 3-Day Tees System (design-studio rebuild 2026-06-09)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/3-day-tees.html` | 3-Day Tees design studio — single-page designer→colors→checkout flow, Stripe hosted checkout | 3-day-tees-app.js + modules below, 3-day-tees.css, app.config.js | ✅ Active |
| `/pages/3-day-tees-success.html` | Post-payment confirmation — polls quote session, EmailJS confirmations, mockups + promise date | 3-day-tees-success.js, 3-day-tees-success.css | ✅ Active |
| `/pages/js/3-day-tees-app.js` | App core: state + sessionStorage restore, API loads, UI renderers, 4-step checkout pipeline | TDTPricing/TDTShipDate/TDTCalibration/TDTDesigner | ✅ Active |
| `/pages/js/3-day-tees-pricing.js` | PURE pricing engine (quote/unitPrice) — also require()d by server.js for the authoritative reprice | — (dual browser/Node) | ✅ Active |
| `/pages/js/3-day-tees-shipdate.js` | PURE ship-promise engine (9AM Pacific cutoff, holiday calendar → 2032) — also require()d by server.js | — (dual browser/Node) | ✅ Active |
| `/pages/js/3-day-tees-calibration.js` | Print-area calibration (pixel-measured PC54 ghost shots, LC/FF/FB rects in image fractions) | — | ✅ Active |
| `/pages/js/3-day-tees-designer.js` | Canvas designer component: drag/pinch/keyboard placement in inches, per-color preview, hi-res mockup export | TDTCalibration, /api/image-proxy | ✅ Active |
| `/pages/js/3-day-tees-success.js` | Success-page logic (status polling w/ refresh=true, EmailJS once-guard) | TDTShipDate, app.config.js | ✅ Active |
| `/pages/css/3-day-tees.css` | Studio design system ("press-room editorial": paper/ink-green/safety-orange, Bricolage Grotesque) | — | ✅ Active |
| `/pages/css/3-day-tees-success.css` | Success page styles (rides 3-day-tees.css tokens) | 3-day-tees.css | ✅ Active |
| `/tests/unit/parse-rate-percent.test.js` | Regression lock: 2026-06-10 falsy-zero tax fix (0% is a valid rate, NaN falls back) | jest, quote-builder-utils.js | ✅ Active |
| `/tests/unit/quote-snapshot-diff.test.js` | **NEW (2026-06-26)** Locks the size-aware ShopWorks-snapshot diff: a per-size redistribution (S→M) at constant total qty + unit price now emits a `LineSizes[...]` change row (powers the quote-view "edited in ShopWorks" banner) — old diff missed it. | jest, lib/quote-snapshot-diff.js | ✅ Active |
| `/tests/unit/dtf-save-parity.test.js` | **NEW (2026-06-11)** DTF audit lock: every sizeGroup → quote_items row (XS incl.), ColorCode=CATALOG_COLOR chain, Notes JSON round-trips shipToName/includeTax/pricingMetadata | jest, dtf-quote-service.js | ✅ Active |
| `/tests/unit/dtf-childrow-state.test.js` | **NEW (2026-06-11)** P2 closure lock: DTFQuoteBuilder.childRows JS-state model — calculateFromState/getTotalQuantity price extended-size child rows with ZERO DOM (document stub throws on any query) | jest, dtf-quote-builder.js | ✅ Active |
| `/tests/unit/dtf-location-size-lock-parity.test.js` | **NEW (2026-06-19)** Guards the DTF location→transfer-size lock (Small/Med/Large) against drift between its 2 hand-copies — `DTFConfig.transferLocations` (dtf-quote-pricing.js) ↔ `DTF_LOCATIONS_FALLBACK` (quote-cart-engine.js); also pins the audited mapping. Keeps all 3 DTF surfaces sizing identically (from the 2026-06-19 3-surface audit). | jest, dtf-quote-pricing.js, quote-cart-engine.js | ✅ Active |
| `/tests/unit/dtf-size-upcharge-fallback.test.js` | **NEW (2026-06-20)** DTF-1 audit lock: builder `getSizeUpcharge()` flags + fires a VISIBLE warning when it substitutes a hardcoded extended-size upcharge because the API lacked it (Erik #1: never a silent hardcoded price); price unchanged, warning de-duped. Runs the real class via the dtf-childrow-state harness. | jest, dtf-quote-builder.js | ✅ Active |
| `/tests/unit/dtg-canonical-fallback-parity.test.js` | **NEW (2026-06-20)** DTG-4 audit lock: pins the empty-tiers fallback margin equal across the TWO DTG copies — server `caspio-pricing-proxy/lib/dtg-canonical-pricing.js` ↔ client `dtg-pricing-service.js` (both 0.53; had drifted 0.57 vs 0.53). Cross-repo, skips if the proxy sibling isn't checked out. | jest, dtg-pricing-service.js | ✅ Active |
| `/tests/unit/scp-save-parity.test.js` | **NEW (2026-06-11)** Rule-8 sweep lock: SCP save persists FULL sizeBreakdown (XS/LT/7XL) + foots to SubtotalAmount; print path (buildScreenprintPricingData) emits a PDF line for EVERY popup size, XXL child-row price, OSFA-only parent price | jest, screenprint-quote-service.js, screenprint-quote-builder.js | ✅ Active |
| `/tests/unit/emb-save-parity.test.js` | **NEW (2026-06-11)** Rule-8 sweep lock: every EMB engine lineItem (XS + tall LT groups incl.) → quote_items row, foots to SubtotalAmount, ColorCode=CATALOG_COLOR | jest, embroidery-quote-service.js | ✅ Active |
| `/tests/unit/push-button-binding.test.js` | **NEW (2026-06-14)** Regression lock (SCP+DTF): exactly ONE `scp/dtfPushToShopWorks` declaration and it's `async`; the bound `window.*` fn returns a Promise (catches a duplicate back-compat alias hoisting over the async one-click auto-save flow) | jest, screenprint-quote-builder.js, dtf-quote-builder.js | ✅ Active |
| `/tests/unit/3dt-pricing.test.js` | Behavioral spec: 7-step formula, sub-24 cost fallback, LTM, tax base | jest | ✅ Active |
| `/tests/unit/3dt-shipdate.test.js` | Behavioral spec: cutoff/weekend/holiday/PST-PDT matrix | jest | ✅ Active |
| `/tests/3dt-test-push-payload.json` | Reference webhook-equivalent payload for ManageOrders TEST pushes | — | ✅ Active |
| `/tests/3dt-fire-test-webhook.js` | Fires a SIGNED synthetic checkout.session.completed at localhost — full post-payment pipeline test without a card (reads .env webhook secret) | node, .env | ✅ Active |

> Deleted 2026-06-09 (legacy implementation): `/pages/js/3-day-tees.js`, `/pages/js/3-day-tees-debug.js`, `/pages/css/3-day-tees-redesign.css`, `/pages/js/services/ApiService.js`, `/pages/js/services/InventoryService.js`, `/pages/js/utils/debounce.js`, `/tests/test-3day-{inventory,multisku}.js`, `/tests/3-day-tees-{redesign-demo,performance-test}.html`, `/tests/3-day-tees-inventory-summary.md`. Recovery: `git show HEAD~1:<path>`.

### Custom T-Shirts System (multi-style DTG storefront, built 2026-06-10 — pre-launch, awaiting Erik review + redirect cutover)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/custom-tees.html` | Custom T-Shirts page at /custom-tees — gallery of the 20 DTG top sellers + designer + Stripe checkout | custom-tees-app.js + modules below (absolute /pages/ asset paths — clean-URL serving) | ✅ Built |
| `/pages/custom-tees-success.html` | Post-payment success page | custom-tees-success.js | ✅ Built |
| `/pages/js/custom-tees-app.js` | App core: gallery (/api/dtg/top-sellers/styles), per-style designer/state, rush toggle, checkout pipeline (channel:'custom-tees') | TDTPricing/TDTShipDate/CTS_CALIBRATION/TDTDesigner | ✅ Built |
| `/pages/js/custom-tees-pricing.js` | PURE pricing engine — INTERNAL-DTG-BUILDER PARITY: rush opt-in, tier-row distributed LTM, FB/JB/JF locations. Jest-locked. | — (dual browser/Node; server requires it) | ✅ Built |
| `/pages/js/cts-gallery-merch.js` | **NEW (2026-06-12)** PURE gallery merchandising helpers: SanMar PRODUCT_DESCRIPTION → card blurb + fabric facts; featured-color variety pass (de-dupes Jet Black across the grid). NO pricing math — card prices come from server `GET /api/cts/gallery-extras` via CTS_PRICING.quote().perShirt. Jest-locked. | — (dual browser/Node; server requires it) | ✅ Built |
| `/pages/js/custom-tees-shipdate.js` | Ship-promise engine: standardPromise() 7–10 biz-day window + rush 3-day cutoff promise. Jest-locked. | — (dual browser/Node) | ✅ Built |
| `/pages/js/custom-tees-calibration.js` | Per-style print-area registry `window.CTS_CALIBRATION.forStyle()` — hybrid: PC54 hand-calibrated + generic flat-lay model for other styles; LC/FF/JF/FB/JB inches authoritative | — | ✅ Built |
| `/pages/js/custom-tees-designer.js` | Canvas designer (3DT fork): styleNumber-aware via CTS_CALIBRATION, JF/JB jumbo locations, approximate-preview flag for uncalibrated styles | CTS_CALIBRATION, /api/image-proxy | ✅ Built |
| `/pages/js/custom-tees-success.js` | Success-page logic: mode-aware promise copy, style-aware emails | TDTShipDate, app.config.js, EmailJS | ✅ Built |
| `/pages/css/custom-tees.css` + `/pages/css/custom-tees-success.css` | Page styling (3DT theme + gallery band) | — | ✅ Built |
| `/pages/order-status.html` | Customer order-status page at /order-status?id=&t= — HMAC-token link from the confirmation email, no login (timeline, promise date, UPS tracking, mockups, summary) | order-status.js/.css + custom-tees.css tokens (absolute /pages/ paths — clean-URL serving) | ✅ Built |
| `/pages/js/order-status.js` | Status-page logic: reads ?id&t, calls same-origin /api/order-status/:quoteId, renders 4-step timeline + totals; friendly 404 state; everything escaped | server.js GET /api/order-status | ✅ Built |
| `/pages/css/order-status.css` | Status-page styling (rides on custom-tees.css tokens) | custom-tees.css | ✅ Built |
| `/tests/unit/custom-tees-pricing.test.js` | Jest lock: rush opt-in, distributed LTM ($49.92/12pcs), FB/JB/JF, fail-closed (17 tests) | custom-tees-pricing.js | ✅ Active |
| `/tests/unit/custom-tees-shipdate.test.js` | Jest lock: 7–10 day window, holiday skip, binding end date (7 tests) | custom-tees-shipdate.js | ✅ Active |
| `/tests/unit/cts-gallery-merch.test.js` | **NEW (2026-06-12)** Jest lock for cts-gallery-merch: real-PC54-copy blurb/fabric parsing, entity decode, variety-pass de-dupe/lookback/determinism | cts-gallery-merch.js | ✅ Active |
| `/config/storefront-channels.js` | Storefront CHANNEL REGISTRY (pure half): per-channel QuoteID builders, ShopWorks push constants (designTypeId/artistId/SW_LOC/LTM part), banners, EmailJS templates, Stripe paths — server.js binds server-only behaviors on top; adding 'custom-caps' = one entry here + one in server.js CHANNELS | server.js (checkout/webhook emails/push/order-status/shipped email) | ✅ Active |
| `/tests/unit/storefront-channels.test.js` | Characterization lock (28 tests): exact pre-registry strings/values for BOTH channels — QuoteID formats, note labels, banners, push ids, shipped-email gate, resolver default semantics | config/storefront-channels.js | ✅ Active |
| `/tests/cts-e2e-local.js` | Local E2E driver: checkout-session → Caspio stamp assertions → prints webhook-leg command | local server :3000 + live proxy | ✅ Active |
| `/tools/custom-tees-calibrate.html` | STAFF print-box calibration tool — lay the 16×20 envelope on each style's photo once; the storefront designer anchors to it (no-deploy edits) | custom-tees-calibrate.{js,css}, app.config.js, proxy /api/dtg-calibration | ✅ Active |
| `/tools/custom-tees-calibrate.js` | Tool logic: style/color/view picker, drag/scale aspect-locked box, upsert to Caspio DTG_Calibration via proxy; silhouette auto-detect starting position | proxy /api/dtg-calibration + /api/dtg/top-sellers + /api/product-details | ✅ Active |
| `/tools/custom-tees-calibrate.css` | Calibration-tool styling | — | ✅ Active |

### Custom Hats System ('custom-caps' channel — server core built 2026-06-11; storefront pages built 2026-06-11, /custom-caps route NOT yet registered)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/custom-caps.html` | Custom Hats storefront (future /custom-caps) — 9-style cap gallery (/api/caps/catalog), logo upload + proof panel, OSFA qty + tier ladder, Stripe checkout (channel:'custom-caps'). Absolute /pages/ asset paths — clean-URL serving | custom-caps-app.js, custom-caps-pricing.js, custom-caps.css, app.config.js | ✅ Built |
| `/pages/custom-caps-success.html` | Post-payment success page (Stripe redirect target per registry stripeSuccessPath) | custom-caps-success.js, custom-caps.css | ✅ Built |
| `/pages/js/custom-caps-app.js` | App core: catalog gallery w/ live from-prices, per-style CAP bundle loads, color-aggregated SanMar stock (never per-size — stale sized partIds), 8-cap-min inline error, back-logo CAP-AL add-on, tax lookup, 4-step checkout pipeline → POST /api/create-checkout-session | CAPSPricing, app.config.js, proxy /api/caps/catalog + /api/pricing-bundle + /api/sanmar/inventory + /api/service-codes + /api/tax-rates/lookup + /api/files/upload | ✅ Built |
| `/pages/js/custom-caps-success.js` | Success-page logic: polls quote session (refresh=true), proof-first timeline/promise copy from server-stamped settings, clears caps_studio_v1, EmailJS FALLBACK sends gated on webhook emailsSentAt stamp | app.config.js, EmailJS | ✅ Built |
| `/pages/css/custom-caps.css` | Storefront + success styling (press-room editorial tokens layered from the custom-tees look; cap-native: proof panel, tier ladder, OSFA steppers) | — | ✅ Built |
| `/pages/js/custom-caps-pricing.js` | PURE pricing engine for Custom Hats — EMB CAP PARITY: blank OSFA ÷ tier margin + EmbroideryCost(tier, 8K) → CeilDollar; CAP-AL back-logo flat tier add-on; 8-cap minimum enforced (structured BELOW_MINIMUM error — 1-7 LTM tier unreachable); NO LTM/digitizing lines; CAPS-SHIP-* threshold shipping fail-closed. Jest-locked. | — (dual browser/Node; server.js requires it) | ✅ Built |
| `/tests/unit/custom-caps-pricing.test.js` | Jest parity lock vs the verified 9-style lineup (112/C402/112PFP/256/258/220/C914/STC26/CT105298 @ qty 8/24/48/72), back-logo tiers, qty<8 structured error, fail-closed throws, CeilDollar edges | custom-caps-pricing.js | ✅ Active |

### Other Pages (Undocumented Until 2026-02-27)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/richardson-112-product.html` | Richardson 112 product display page | richardson-112-product.css | ✅ Active |
| `/pages/richardson-112-product.css` | Richardson 112 page styles | — | ✅ Active |
| `/pages/dtg-compatible-products.html` | DTG-compatible products listing | — | ✅ Active |
| `/pages/sample-cart.html` | Sample ordering cart page | — | ✅ Active |
| `/pages/order-form.html` | **NEW** Online order form (embroidery/screenprint/DTG/DTF) — paper-style layout, pushes to ShopWorks ManageOrders | order-form/*.css, order-form/*.js, order-form/components/*.jsx | ✅ Active |
| `/pages/order-form/init.js` | Order form tweak defaults (accent/font/layout) | — | ✅ Active |
| `/pages/order-form/shopworks.js` | Order Form submit client — routes to `/api/submit-order-form` on server.js (mirrors 3-Day Tees flow) | — | ✅ Active |
| `/pages/order-form/app.jsx` | Order form root React component (form state, print toolbar) | components/* | ✅ Active |
| `/pages/order-form/components/paper-form.jsx` | Paper-style order form (info grid, garment table, footer) | common.jsx, line-items.jsx | ✅ Active |
| `/pages/order-form/components/line-items.jsx` | Product combobox + sizes/decoration helpers | data.js | ✅ Active |
| `/pages/order-form/components/artwork.jsx` | Drag-drop artwork uploader with placement chips + PMS colors | — | ✅ Active |
| `/pages/order-form/components/print-sheet.jsx` | Print-only paper form layout | common.jsx | ✅ Active |
| `/pages/order-form/components/common.jsx` | Shared icons, logo, field/section wrappers | — | ✅ Active |
| `/pages/order-form/components/tweaks.jsx` | Accent/font/layout tweaks panel | — | ✅ Active |
| `/pages/order-form/components/service-codes.js` | Order Form add-on services client (Phase 2a 2026-05-03) — fetches `/api/service-codes` (31 services), caches 1h, exposes `window.OrderFormServiceCodes` with `addOrReplace()` singleton enforcement, `appliesTo()` cap/garment guard, `resolvedPrice()` for FIXED/FLAT/HOURLY/CALCULATED/PASSTHROUGH | `/api/service-codes` proxy endpoint | ✅ Active |
| `/pages/order-form/components/add-on-picker.jsx` | Order Form add-on picker UI (Phase 2b 2026-05-03) — modal + chip strip + params dialog. Superseded by service-rail/ in Phase 3; kept as fallback for 1 release. Will be removed in Phase 4. | service-codes.js, tiered-pricing.js | ⚠️ Deprecated (Phase 4 removal) |
| `/pages/order-form/components/service-rail/service-rail.jsx` | **NEW Phase 3** Service Rail orchestrator — left-side drag-and-drop catalog. Method-aware (reads engine.getRailServices), groups by RailGroup column, manages drag state, renders cards + drop zones | rail-card.jsx, rail-section.jsx, drop-zone.jsx, service-codes.js, tiered-pricing.js | ✅ Active |
| `/pages/order-form/components/service-rail/rail-card.jsx` | **NEW Phase 3** Individual draggable service card — handles 6 PricingMethod variants (FIXED/FLAT/TIERED/CALCULATED/HOURLY/PASSTHROUGH) with inline stitch/percent/hours/amount inputs. AS-CAP/AS-Garm Standard tier shows INCLUDED badge (not draggable) | tiered-pricing.js | ✅ Active |
| `/pages/order-form/components/service-rail/rail-section.jsx` | **NEW Phase 3** Collapsible group wrapper — header with name + count badge, collapse state in sessionStorage. Color-coded variants (stitch/cap/garment/setup/order) | — | ✅ Active |
| `/pages/order-form/components/service-rail/drop-zone.jsx` | **NEW Phase 3** Drop target component — validates eligibility (cap-scoped → cap rows, garment-scoped → garment rows, order-level → order zone), green/red visual feedback. Reuses CAP_SCOPED/GARMENT_SCOPED logic from picker | — | ✅ Active |
| `/pages/order-form/components/service-rail/service-rail.css` | **NEW Phase 3** Rail styles — 2-column grid layout (`.of-layout`, `.of-rail` 280px sticky left), card variants by group, drop zone illumination, mobile fallback (single-column at <1100px), print hidden | — | ✅ Active |
| `/pages/order-form/components/customer-approval-view.jsx` | **NEW Phase D.2 (2026-05-04)** Customer-facing order approval view — replaces PaperForm when `?draftId=` is present. Card-per-line-item layout with photo, sizes, decoration breakdown, prominent prices. Header with NWCA branding, info card, summary card with grand total, approval CTA (D.3 wires the action). | customer-approval.css | ✅ Active |
| `/pages/order-form/customer-approval.css` | **NEW Phase D.2 (2026-05-04)** Scoped styles for `.cav` (Customer Approval View). Uses existing `--accent`/`--ink`/`--line` tokens. Responsive 2-column grid ≥1100px, single-column below, mobile-stacked card price rows below 760px, print-clean (hides CTAs). | — | ✅ Active |
| `/pages/order-form/components/tiered-pricing.js` | Order Form TIERED add-on resolver (Phase 2c 2026-05-03) — fetches `/api/al-pricing`, `/api/decg-pricing`, `/api/contract-pricing`, exposes `window.OrderFormTieredPricing.resolveSync()` for picker auto-fill of AL, AL-CAP, AS-Garm, AS-CAP, DECG, DECC, DECG-FB, CTR-Garmt, CTR-Cap unit prices | `/api/al-pricing`, `/api/decg-pricing`, `/api/contract-pricing` proxy endpoints | ✅ Active |
| `/pages/order-form/components/design-autocomplete.jsx` | Order Form Design # autocomplete (Phase B 2026-05-02) — fetches `/api/digitized-designs/by-customer`, autocomplete dropdown with last-used-date sort, picks → `info.designNumber` → server resolves to ShopWorks `id_Design` | `/api/digitized-designs/by-customer` | ✅ Active |
| `/pages/order-form/styles.css` | Order form base styles | — | ✅ Active |
| `/pages/order-form/paper.css` | Order form paper-layout styles | — | ✅ Active |
| `/pages/order-form/print.css` | Order form print layout | — | ✅ Active |
| `/pages/order-form/pricing/shared.js` | Order Form pricing — shared utilities (rounding, tier helpers, error/breakdown shapes, totalQty, tax/deposit) | — | ✅ Active |
| `/pages/order-form/pricing/registry.js` | Order Form pricing — method registry + dispatcher (register/getMethod/priceForm/bundle cache, customer-mode manualCost guard) | shared.js | ✅ Active |
| `/pages/order-form/pricing/methods/embroidery.jsx` | Order Form pricing — Embroidery method (cap+flat auto-detect, LTM-builtin, 8K-stitch single logo MVP, ConfigBar) — VERIFIED LIVE | EmbroideryPricingService, CapEmbroideryPricingService, ProductCategoryFilter, registry.js, shared.js | ✅ Active |
| `/pages/order-form/components/totals.jsx` | Order Form pricing UI — DecoConfigStrip, TotalsPanel (subtotal/tax/deposit/total + tier badge + LTM callout), RowTierBadge, BetaChip (dismissible), ManualCostPill, ManualCostPrompt | registry.js, common.jsx | ✅ Active |
| `/pages/order-form/inventory/inventory-check.js` | Order Form SanMar inventory check — wraps ManageOrdersInventoryService with multi-SKU fan-out (base PN + suffixed PNs for extended/cap/fitted/W×L sizes). Exposes window.OrderFormInventory.getInventoryForRow(style, catalogColor, sizes) → { bySize, cacheAge, status } and classifyInventory(qty, available) → 'good'/'low'/'over'/'oos'/'unknown' | manageorders-inventory-service.js, order-form-size-suffix.js | ✅ Active |
| `/pages/order-form/pricing/methods/screenprint.jsx` | Order Form pricing — Screen Print method (front/back/sleeve color counts + white underbase, ConfigBar) — BETA chip until verified vs `/pricing/screen-print` | ScreenPrintPricingService, registry.js, shared.js | ✅ Active |
| `/pages/order-form/pricing/methods/dtg.jsx` | Order Form pricing — DTG method (location combo dropdown 9 codes, LTM under 24, ConfigBar) — BETA chip until verified vs `/pricing/dtg` | DTGPricingService, registry.js, shared.js | ✅ Active |
| `/pages/order-form/pricing/methods/dtf.jsx` | Order Form pricing — DTF method (front/back/sleeve transfer-size pickers, multi-location labor + freight, ConfigBar) — BETA chip until verified vs `/pricing/dtf` | DTFPricingService, registry.js, shared.js | ✅ Active |
| `/shared_components/js/sticker-pricing-service.js` | Sticker pricing service — fetches `/api/sticker-pricing` Caspio table; INLINE_GRID now includes PartNumber + 6×6 tier (50 SKUs total). Used by order-form sticker.jsx method | — | ✅ Active |
| `/shared_components/js/sticker-pricing-page.js` | **NEW (2026-05-15)** Sticker + Banner quote page logic — renders sticker pricing tables (`/api/sticker-pricing`) AND banner rate card (`/api/banner-pricing`), drives AI chat (SSE via `/api/contract-sticker-ai/chat` which handles BOTH product lines), parses PRICE_QUOTE/CUSTOMER_FINAL/EMAIL DRAFT blocks, highlights sticker rows OR banner rate cards based on `productType`, renders inline banner-quote card, saves to `quote_sessions` with STK prefix | sticker-pricing-service.js, sticker-manual-pricing.html | ✅ Active |
| `/shared_components/js/emblem-pricing-service.js` | Embroidered emblem/patch pricing service — fetches `/api/emblem-pricing`; falls back to inline grid (16 sizes × 10 qty tiers + LTM/digitizing/add-on rules) until Caspio table is deployed | — | ✅ Active |
| `/shared_components/js/order-form-size-suffix.js` | Isomorphic ShopWorks size-suffix mapping (PC61 → PC61_2X / PC61_3XL etc.) loaded by both browser (window.orderFormSizeSuffix) and server.js (require). Single source of truth — verified against the 15,152-row ShopWorks CSV | — | ✅ Active |
| `/pages/order-form/pricing/methods/sticker.jsx` | Order Form pricing — Stickers method (form-wide size dropdown 2x2/3x3/4x4/5x5 + new artwork checkbox, ConfigBar) — BETA chip until verified | StickerPricingService, registry.js, shared.js | ✅ Active |
| `/pages/order-form/pricing/methods/emblem.jsx` | Order Form pricing — Emblems/Patches method (form-wide width/height + metallic/velcro/extra-colors/new-design add-ons, ConfigBar) — BETA chip until verified | EmblemPricingService, registry.js, shared.js | ✅ Active |
| `/pages/top-sellers-product.css` | Top sellers product page styles | — | ✅ Active |
| `/pages/css/policies-hub.css` | Policies hub page styles | — | ✅ Active |
| `/pages/css/utilities.css` | Shared utility CSS for pages | — | ✅ Active |
| `/pages/policies/dtg-artwork-checklist.html` | DTG artwork preparation checklist | — | ✅ Active |

### SanMar Catalog Color Audit (NEW 2026-05-02)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/sanmar-catalog-color-audit.html` | Diagnostic page — diffs Caspio `Sanmar_Bulk_251816_Feb2024` vs SanMar's live `mainframeColor` per style. Read-only, surfaces rejection candidates for ShopWorks→SanMar PO pushes | sanmar-catalog-color-audit.js, sanmar-catalog-color-audit.css | ✅ Active |
| `/pages/sanmar-catalog-color-audit.js` | Audit page controller — fetches `/api/sanmar/catalog-color-audit/:style`, renders 5 buckets (inSync / caspioMismatch / caspioOrphan / sanmarOnly / internalDrift), Copy-CSV per bucket | /api/sanmar/catalog-color-audit (proxy) | ✅ Active |
| `/pages/sanmar-catalog-color-audit.css` | Audit page styles — summary cards, bucket tables, sticky headers | — | ✅ Active |

### SanMar PO Integration — Planning Docs (NEW 2026-06-23)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/memory/sanmar-po/` | Outbound SanMar **PO submission** (blank ordering) — review/plan/field-mapping/onboarding + buildable PO templates (`po-payload.schema.json`, `po-sample.json`, `submitPO`/`getPreSubmitInfo` SOAP skeletons). Distinct from the read-side `/memory/SANMAR_API_REFERENCE.md`. Code (when built) lands in `caspio-pricing-proxy`. | PO Integration Guide v24.3; caspio-pricing-proxy `sanmar-soap.js` | 🟡 Reference (review/not built) |

### Box Labels - Shipping & Receiving (NEW 2026-04-01)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/box-labels.html` | Box label management page — lookup, drag/drop, print labels | box-labels.js, box-labels.css, SortableJS, jsPDF, JsBarcode, qrcode-generator | ✅ Active |
| `/pages/js/box-labels.js` | Box management logic — API calls, drag/drop, PDF generation | SortableJS CDN, jsPDF CDN, JsBarcode CDN | ✅ Active |
| `/pages/css/box-labels.css` | Box labels page styling — production-floor UI | — | ✅ Active |

### Customer Portal (NEW 2026-03-21)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/customer-portal.html` | Customer-facing portal at `/portal/:customerId` — mockups + art requests, no login (URL = token) | customer-portal.js, customer-portal.css, app-config.js | ✅ Active |
| `/pages/js/customer-portal.js` | Portal controller — fetches mockups + art requests by customer ID | /api/mockups, /api/artrequests | ✅ Active |
| `/pages/css/customer-portal.css` | Portal styling (responsive cards, branded) | — | ✅ Active |
| `/pages/customer-login.html` | Magic-link login page at `/customer/login` — email entry → "check your email" (passwordless, invite-only, #6 Phase 1) | customer-login.js/.css | ✅ Active |
| `/pages/js/customer-login.js` | Login logic — POSTs `/auth/customer/request-link`; always shows the same "check your email" state (no account enumeration) | server.js POST /auth/customer/request-link | ✅ Active |
| `/pages/css/customer-login.css` | Login page styling (branded green card) | — | ✅ Active |
| `/lib/customer-magic-link.js` | Magic-link + session token crypto (HMAC mint/verify; MAGIC_LINK_SECRET link / SESSION_SECRET cookie) for the authenticated customer portal | server.js (loadCustomerSession, /auth/customer/*) | ✅ Active |
| `/pages/customer-invoice.html` | ShopWorks-style invoice page at `/portal/invoice/:orderNo` (session-gated) — on-screen + Download PDF (html2pdf) | customer-invoice.js/.css | ✅ Active |
| `/pages/js/customer-invoice.js` | Fetches `/api/portal/invoice/:orderNo` (ownership-checked), renders the invoice (header/line-items/sizes/totals), wires html2pdf download | server.js GET /api/portal/invoice | ✅ Active |
| `/pages/css/customer-invoice.css` | Invoice paper styling (print-friendly) | — | ✅ Active |
| `/pages/customer-product.html` | Portal product-detail page at `/portal/product/:style` (session-gated) — specs, all colors, order-history size matrix, traffic-light availability, re-order (Phase B, 2026-07-01) | customer-product.js/.css, customer-portal.css, app-config.js | ✅ Active |
| `/pages/js/customer-product.js` | Fetches `/api/portal/product/:style` (+ preview mirror), renders specs/swatch gallery/size matrix/availability/re-order; POSTs `/api/portal/reorder-request` | server.js GET /api/portal/product | ✅ Active |
| `/pages/css/customer-product.css` | Product-detail page styling (layers on customer-portal.css tokens) | customer-portal.css | ✅ Active |
| `/pages/js/portal-reorder-list.js` | Shared multi-item "Re-order List" (2026-07-04) — floating FAB + drawer; sessionStorage-persisted across portal pages; "Send all" POSTs `/api/portal/reorder-batch` (grouped Batch_Num, no price). Loaded on product page + portal home | server.js POST /api/portal/reorder-batch | ✅ Active |
| `/pages/css/portal-reorder-list.css` | Re-order List floating button + drawer styling (portal --cp-* tokens w/ fallbacks) | — | ✅ Active |

### Mockup Detail Page (NEW 2026-04)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/mockup-detail.html` | Single-mockup detail page — full image, design info, history | mockup-detail.js, mockup-detail.css | ✅ Active |
| `/pages/js/mockup-detail.js` | Mockup detail controller — fetches record + thumbnails, history timeline | /api/mockups/:id | ✅ Active |
| `/pages/css/mockup-detail.css` | Mockup detail styling | — | ✅ Active |

### Supacolor Job Detail (NEW 2026-04)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/supacolor-job-detail.html` | Single Supacolor job detail page — sync status, line items | supacolor-job-detail.js, supacolor-job-detail.css | ✅ Active |
| `/pages/js/supacolor-job-detail.js` | Supacolor job detail controller — fetches job, sync trigger, status badges | /api/supacolor-jobs/:jobNumber | ✅ Active |
| `/pages/css/supacolor-job-detail.css` | Supacolor job detail styling (matches dashboard theme) | — | ✅ Active |

### Embroidery Contract Pricing (Page-Level Assets)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/embroidery-contract-pricing.js` | Contract embroidery pricing logic for shareable customer page | /api/embroidery-costs, app-config.js | ✅ Active |
| `/pages/embroidery-contract-pricing.css` | Contract embroidery pricing page styles | — | ✅ Active |

## 📊 Calculators & Quote Builders

### Quick Quote (staff rapid all-method)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/quick-quote/index.html` | Staff rapid price lookup — type style + qty + placement → every eligible method priced at once. No customer record/save. Linked from staff dashboard "Quote Builders". | quick-quote.js, quick-quote.css, quote-cart-engine.js, all 5 pricing services, decoration-methods.js, app.config.js | ✅ Active |
| `/calculators/quick-quote/quick-quote.js` | Page logic — drives `QuoteCartEngine.singleItemPreview()` (SAME engine as the Quote Builder + customer catalog, so prices can't drift). Cap-aware placements, per-size 2XL+ breakdown, advanced stitch-count/ink/dark/stripes inputs. Style lookup via `/api/product-details`; eligibility via DecorationMethods. **Two modes: Quick Price (1 style, every method) + Line Sheet (1 method, up to 6 styles → branded one-page PDF via window.print; each style priced independently via `probeLadder`, never summed).** | quote-cart-engine.js, embroidery-quote-pricing.js, all 5 *-pricing-service.js, decoration-methods.js, /api/product-details | ✅ Active |
| `/calculators/quick-quote/quick-quote.css` | Page styles — self-contained light card UI; includes Line Sheet mode (mode toggle, style list, on-screen sheet preview) | — | ✅ Active |
| `/calculators/quick-quote/linesheet-print.css` | Print stylesheet (`media="print"`) for Line Sheet mode — strips app chrome, prints only `#qqSheet` as a one-page NWCA line sheet (Print / Save as PDF). Scoped to `body.qq-mode-line`. | quick-quote.js (toggles body class), index.html | ✅ Active |
| `/calculators/quick-quote/dtf-prints-prototype.html` | **Prototype** — DTF "logo = size + position" model: add prints, each a size + position, priced by size via the live DTFPricingService. Not linked from anywhere (noindex); evaluates a unified placement model before touching live tools. | dtf-prints-prototype.js, dtf-prints-prototype.css, quick-quote.css, dtf-pricing-service.js, app.config.js | 🧪 Prototype |
| `/calculators/quick-quote/dtf-prints-prototype.js` | Prototype logic — prices a list of (size, position) prints through `DTFPricingService.calculatePriceForQuantity` (sums per-size transfer + $2.50 labor + freight). DTF-only, no engine/cart dependency. | dtf-pricing-service.js, app.config.js | 🧪 Prototype |
| `/calculators/quick-quote/dtf-prints-prototype.css` | Prototype styles — layers on quick-quote.css tokens (prints rows + breakdown only) | quick-quote.css | 🧪 Prototype |

### Unified Manual Pricing Calculator
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/manual-pricing.html` | Unified manual pricing — all 5 methods on one page | manual-pricing.js, manual-pricing.css, all 5 pricing services | ✅ Active |
| `/calculators/manual-pricing.js` | Page logic — orchestrates DTG/DTF/EMB/CAP/SP pricing services | All 5 *-pricing-service.js files | ✅ Active |
| `/calculators/manual-pricing.css` | Page styles — extends manual-calculator-styles.css | manual-calculator-styles.css | ✅ Active |

### Service Price Cheat Sheet
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/service-price-cheat-sheet.html` | Printable service price reference — all embroidery service prices | service-price-cheat-sheet.js, .css, app-config.js | ✅ Active |
| `/calculators/service-price-cheat-sheet.js` | API-driven price fetching and rendering | /api/service-codes, /api/decg-pricing, /api/al-pricing | ✅ Active |
| `/calculators/service-price-cheat-sheet.css` | Page styles with print-friendly layout | — | ✅ Active |

### Compare Pricing by Style
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/compare-pricing.html` | Compare pricing by SanMar style — all methods on one page | compare-pricing.js, compare-pricing.css, manual-pricing.css, all 5 pricing services | ✅ Active |
| `/calculators/compare-pricing.js` | Page logic — fetches SanMar product data then pricing | All 5 *-pricing-service.js files | ✅ Active |
| `/calculators/compare-pricing.css` | Page styles — product info banner, extends manual-pricing.css | manual-pricing.css, manual-calculator-styles.css | ✅ Active |

### DTG System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/dtg-pricing.html` | DTG pricing calculator | dtg-adapter.js, dtg-pricing-service.js | ✅ Active |
| `/calculators/dtg-manual-pricing.html` | ~~DELETED~~ Manual DTG pricing — superseded by `/calculators/manual-pricing.html` (unified) | — | ❌ Deleted |
| `/calculators/archive/manual-pricing-deprecated/dtg-manual-pricing.html` | Archived pre-unification DTG manual calculator | — | 📦 Archived |
| `/quote-builders/dtg-quote-builder.html` | **DTG flagship (v14, 2026-05-19+).** Manual-first inline-form DTG quote builder + DTG AI bot + Submit-to-ShopWorks + sales tax (per-address WA DOR lookup, exempt/pickup/out-of-state) + order-summary band. Legacy iframe REMOVED (legacy builder deleted 2026-06-08; `/quote-builders/dtg-quote-builder-legacy.html` 301-redirects here). This is the sole DTG builder. | dtg-inline-form.js, dtg-quote-page.js, dtg-pricing-service.js, quote-order-summary.js | ✅ Active |
| ~~`/shared_components/js/dtg-quote-pricing.js`~~ | **DELETED 2026-06-09** — dead legacy DTG quote pricing engine; only consumer was the also-dead dtg-quote-products.js. No HTML loaded it. | — | ❌ Deleted |
| `/shared_components/js/dtg-quote-products.js` | DTG quote product manager (⚠️ legacy — was loaded by the deleted legacy builder; dead-code candidate; refs now-deleted DTGQuotePricing) | SanMar API | ⚠️ Orphan? |
| `/shared_components/js/dtg-quote-system.js` | DTG quote system orchestrator (⚠️ legacy — dead-code candidate) | — | ⚠️ Orphan? |

### DTF System

#### DTF Pricing Calculator (Customer-facing)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/dtf-pricing.html` | DTF pricing page | dtf-pricing-calculator.js, dtf-pricing-service.js | ✅ Active |
| `/pricing/dtf/index.html` | ~~PATH NEVER EXISTED~~ — actual DTF page is at `/calculators/dtf-pricing.html` | — | ❌ Stale path |
| `/shared_components/js/dtf-pricing-calculator.js` | DTF calculator UI & pricing logic | dtf-pricing-service.js, DTFConfig | ✅ Active |
| `/shared_components/js/dtf-pricing-service.js` | API data fetcher & transformer | Caspio API | ✅ Active |
| `/shared_components/js/dtf-integration.js` | Coordinates calculator, adapter, events | dtf-pricing-calculator.js | ✅ Active |
| `/shared_components/js/dtf-adapter.js` | Caspio data adapter | Caspio API | ✅ Active |
| `/shared_components/js/dtf-config.js` | Location mappings (no pricing values) | - | ✅ Active |
| `/shared_components/css/dtf-toggle-pricing.css` | Toggle interface styles | - | ✅ Active |

#### DTF Quote Builder (Staff)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/quote-builders/dtf-quote-builder.html` | DTF Quote Builder 2026 (Excel-style) | 4 JS files below | ✅ Active |
| `/shared_components/js/dtf-quote-builder.js` | Main DTF quote controller | DTFQuotePricing class | ✅ Active |
| `/shared_components/js/dtf-quote-pricing.js` | **CONSOLIDATED** Pricing + Config + Service | Caspio API | ✅ Active |
| `/shared_components/js/dtf-quote-products.js` | DTF quote product manager | ExactMatchSearch | ✅ Active |
| `/shared_components/js/dtf-quote-service.js` | DTF quote database service | EmailJS, Caspio API | ✅ Active |
| `/shared_components/css/dtf-quote-builder.css` | DTF quote builder styles (green theme) | - | ✅ Active |

**DTF Formula Alignment (2026-01-07):** Fixed dtf-pricing-calculator.js to use pre-transformed API data from service. Both calculator and quote builder now use identical pricing formula. See `/memory/DTF_PRICING_SYSTEM.md`.

### Embroidery System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/embroidery-pricing-all/index.html` | **CORPORATE-ONLY** Embroidery pricing page — Additional Logo · Customer Supplied Garments · Additional Stitches · Full Back Embroidery tabs. Contract Embroidery split off into its own standalone page (`/calculators/embroidery-contract/`) Round 6 / 2026-05-13. Old `?tab=contract` URLs redirect via JS. | embroidery-pricing-all.js | ✅ Active |
| `/calculators/embroidery-pricing-all/embroidery-pricing-all.js` | Corporate embroidery pricing logic (AL retail + DECG retail + stitch surcharges + Full Back) | /api/al-pricing, /api/decg-pricing, /api/pricing-bundle?method=EMB | ✅ Active |
| `/calculators/embroidery-pricing-all/embroidery-pricing-all.css` | Tabbed interface styles | - | ✅ Active |
| `/calculators/embroidery-contract/index.html` | **Round 7 (2026-05-14)** Editorial Contract Embroidery pricing page. Replaced the Round 6 minimal-pink page with a magazine-style layout extracted from the Claude Designer mockup: top bar with theme chip, editorial hero (serif title with italic year + 3-fact aside), 2-column calculator card with pink-gradient result panel + 72px hero price, 3-card callouts, tabbed pricing tables (Garment / Cap / Full Back) with live active-tier-column + current-stitch-row + intersection-cell highlighting, ShopWorks parts row, dark contact card with numbered checklist, footnote. Single-tier wholesale pricing for Ruthie / ASI distributors who supply their own blanks. | embroidery-contract.js, embroidery-contract.css, Google Fonts (Fraunces, Geist, Geist Mono) | ✅ Active |
| `/calculators/embroidery-contract/embroidery-contract.js` | **Round 7 (2026-05-14)** Standalone calculator JS for the Contract Embroidery page. Fetches `/api/contract-pricing`, builds 3 pricing matrices, drives the editorial UI (segmented item picker, qty/stitch presets, hero serif price, live table highlighting), supports URL-param share-links (`?type=&qty=&stitches=`) — Ruthie types inputs, copies a share-URL, customer clicks the URL and sees the calculator pre-filled with the same quote. No ES-module deps; pure browser JS. | /api/contract-pricing | ✅ Active |
| `/calculators/embroidery-contract/embroidery-contract.css` | **DEDUP (2026-05-29)** Now page-specific ONLY (~137 lines): segmented item-type picker (`.seg`), pricing-table tabs (`.tabs`), `.divider`, two-column qty/stitch row (`.calc-form .row`), tfoot active-column highlight, + seg/tabs focus rings. All shared chrome (tokens, top bar, hero, calc shell, result panel, buttons, table base, contact, footer, AI chat panel) moved to `/shared_components/css/contract-pricing-2026.css`, loaded BEFORE this file so page rules win the cascade. | contract-pricing-2026.css, Google Fonts | ✅ Active |
| `/shared_components/css/contract-pricing-2026.css` | **NEW (2026-05-29)** Shared editorial chrome for BOTH contract calculators (`embroidery-contract` + `dtg-contract`): design tokens, top bar, hero, calculator shell, result panel, totals, buttons, pricing-table base, contact card, footnote, toast, pricing-error, and the entire AI chat panel (~1,207 lines). Eliminates the ~1,090 lines that were copy-pasted between the two pages. Loaded BEFORE each page's own CSS so page rules win the cascade. **Bump the `?v=` on BOTH pages when editing this file.** | embroidery-contract.css, dtg-contract.css | ✅ Active |
| `/quote-builders/embroidery-quote-builder.html` | Embroidery/Cap Combo Quote Builder 2026 (Excel-style) | embroidery-quote-pricing.js | ✅ Active |
| `/shared_components/js/embroidery-quote-pricing.js` | Embroidery pricing engine (tiers, LTM, stitch surcharges, FB) | Caspio API | ✅ Active |
| `/shared_components/js/embroidery-quote-service.js` | Embroidery quote save/update/email service | Caspio API, EmailJS | ✅ Active |
| `/shared_components/js/embroidery-quote-invoice.js` | Embroidery invoice generation (ShopWorks format) | — | ✅ Active |
| `/shared_components/js/quote-pricing-data.js` | Shared `pricingData` contract (Phase 3.1) — builds + validates the shape all 4 quote builders pass to `embroidery-quote-invoice.js`. Normalizes method→flags, percent tax→decimal, zero-fills fee fields. | — | ✅ Active |
| `/shared_components/js/quote-services-bar.js` | Persistent, catalog-driven "Add to order" services bar (2026-06-03) — `QuoteServicesBar.render(mountId, catalog, onAdd)`; clicking a chip adds that service as a line item. Reusable across EMB/SCP/DTG/DTF (each passes its own catalog). | quote builders | ✅ Active |
| `/shared_components/js/embroidery-quote-products.js` | Embroidery product row management | SanMar API | ✅ Active |
| `/shared_components/js/embroidery-quote-logos.js` | Logo card management (positions, stitch tiers, AL) | — | ✅ Active |
| `/shared_components/js/embroidery-quote-adapter.js` | Embroidery data adapter (Caspio → pricing engine) | Caspio API | ✅ Active |

### Screen Print System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/screen-print-pricing.html` | Screen print calculator | screenprint-pricing-v2.js, screenprint-pricing-service.js | ✅ Active |
| `/quote-builders/screenprint-quote-builder.html` | Screen Print Quote Builder 2026 (Excel-style) | screenprint-pricing-service.js | ✅ Active |
| `/shared_components/js/screenprint-quote-products.js` | Screen print quote product manager | SanMar API | ✅ Active |
| `/shared_components/js/screenprint-quote-service.js` | Screen print quote save/email service | Caspio API, EmailJS | ✅ Active |
| `/quote-builders/screenprint-fast-quote.html` | Fast quote form (60 sec) | screenprint-fast-quote-service.js | ✅ Active |
| `/shared_components/js/screenprint-pricing-v2.js` | Main calculator logic | screenprint-pricing-service.js | ✅ Active |
| `/shared_components/js/screenprint-pricing-service.js` | Pricing data adapter | Caspio API | ✅ Active |
| `/shared_components/js/screenprint-fast-quote-service.js` | Fast quote service | EmailJS, Caspio API | ✅ Active |
| `/tests/unit/scp-dark-garment-parity.test.js` | **NEW (2026-06-11)** Rule-7 lock: calculator dark-garment underbase = setup screen only, per-piece by RAW colors — parity vs builder worked-example fixtures (covers v2 + manual calculator) | jest, screenprint-pricing-v2.js, screenprint-manual-pricing.js | ✅ Active |

### Monogram Form System (NEW 2026-01-08)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/quote-builders/monogram-form.html` | Monogram/personalization tracking form | monogram-form-service.js, monogram-form-controller.js | ✅ Active |
| `/shared_components/js/monogram-form-service.js` | API service (ManageOrders, Caspio) | ManageOrders API | ✅ Active |
| `/shared_components/js/monogram-form-controller.js` | UI controller and state management | monogram-form-service.js | ✅ Active |
| `/shared_components/css/monogram-form.css` | Monogram form styling | quote-builder-common.css | ✅ Active |
| `/memory/MONOGRAM_FORM_SYSTEM.md` | Implementation documentation | - | 📚 Docs |

**Features:** Order lookup from ShopWorks, dynamic name entry (up to 50), print PDF for production, search by order/company.

### Cap Embroidery System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/cap-embroidery-pricing-integrated.html` | SanMar cap pricing (23 Richardson styles) | cap-embroidery-pricing-service.js | ✅ Active |
| `/calculators/richardson-2025.html` | Richardson Factory Direct pricing (133 styles) | richardson-factory-direct.js | ✅ Active |
| `/calculators/richardson-factory-direct.js` | Richardson pricing lookup (2026 refactor - simplified) | API pricing-bundle | ✅ Active |
| `/calculators/richardson-2025-styles.css` | Richardson page styles | - | ✅ Active |

### Webstore System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/webstores.html` | **REWRITTEN (2026-05-16)** Custom webstore quote + fundraiser pricing page — AI-first redesign mirroring sticker/emblem layout. Bot handles BOTH store-setup quotes AND per-item fundraiser math via 4 tools (lookup_customer + 2 pricing + web_search). External CSS/JS only. | sticker-pricing-page.css, webstore-pricing-page.css, webstore-pricing-page.js | ✅ Active |
| `/calculators/webstores-calculator.js` | 🗄️ Pre-AI store-setup logic. Save flow + math now handled inline in webstore-pricing-page.js (same WEB prefix). Delete after soak. | — | 🗄️ Legacy (delete ~2026-06-16) |
| `/calculators/webstores-fundraiser.js` | 🗄️ Pre-AI fundraiser pricing calculator. Math now in `quote_fundraiser_pricing` tool on the proxy. Delete after soak. | — | 🗄️ Legacy (delete ~2026-06-16) |
| `/calculators/webstores-quote-service.js` | 🗄️ Pre-AI quote save service. Save flow now in webstore-pricing-page.js (same Caspio endpoints, same WEB prefix). Delete after soak. | base-quote-service.js | 🗄️ Legacy (delete ~2026-06-16) |
| `/calculators/webstores-styles.css` | 🗄️ Pre-AI page styles. New page uses sticker-pricing-page.css + webstore-pricing-page.css. Delete after soak. | — | 🗄️ Legacy (delete ~2026-06-16) |

### Special Calculators
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/christmas-bundles.html` | Christmas bundle | christmas-bundle-service.js, product-search-service.js | ✅ Active |
| `/calculators/christmas-bundle-service.js` | Christmas bundle pricing/quote service | base-quote-service.js | ✅ Active |
| `/calculators/christmas-bundle-emailjs-template.html` | EmailJS HTML template for Christmas bundle | EmailJS service | ✅ Active |
| `/calculators/archive/seasonal-2025/breast-cancer-awareness-bundle.html` | BCA bundle (Oct 2025 promo - archived) | breast-cancer-bundle-service.js | 📦 Archived |
| `/calculators/archive/seasonal-2025/breast-cancer-awareness-bundle-tailwind.html` | BCA bundle Tailwind variant | breast-cancer-bundle-service.js | 📦 Archived |
| `/calculators/archive/seasonal-2025/breast-cancer-bundle-service.js` | BCA bundle quote/email service | EmailJS | 📦 Archived |
| `/calculators/archive/seasonal-2025/breast-cancer-sales-email.html` | BCA promotional email body | EmailJS | 📦 Archived |
| `/calculators/safety-stripe-creator.html` | Safety stripes creator (drag-drop config builder) | safety-stripe-calculator.js, safety-stripe-creator-service.js | ✅ Active |
| `/calculators/safety-stripe-calculator.js` | Safety stripes pricing logic | screenprint-pricing-service.js | ✅ Active |
| `/calculators/safety-stripe-creator-service.js` | Safety stripes quote save/email service | base-quote-service.js, EmailJS | ✅ Active |
| `/calculators/art-invoice-creator.html` | Art invoices | art-invoice-service-v2.js | ✅ Active |
| `/calculators/art-invoice-service-v2.js` | Art invoice creation/save/email service (v2) | Caspio API, EmailJS | ✅ Active |
| `/calculators/art-invoice-emailjs-template.html` | EmailJS HTML template for art invoices | EmailJS service | ✅ Active |
| `/calculators/embroidery-manual-service.js` | Embroidery manual pricing service (used by unified manual calculator) | embroidery-pricing-service.js | ✅ Active |
| `/calculators/leatherette-patch-quote-service.js` | Leatherette patch (PATCH) quote save service | base-quote-service.js | ✅ Active |

### DTG Contract Pricing (Customer-facing)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/dtg-contract/index.html` | **REWRITTEN (2026-05-15)** Contract DTG editorial page — matches Contract Embroidery layout (Fraunces serif + pink accents + AI quote assistant). Replaces the old calculator-base.css layout. | dtg-contract.css, dtg-contract.js | ✅ Active |
| `/calculators/dtg-contract/dtg-contract.css` | **DEDUP (2026-05-29)** Now page-specific ONLY (~339 lines): location checkbox grid (`.loc*`), heavyweight toggle (`.hw-toggle*`), per-piece breakdown (`.pp-breakdown*`), per-location pricing-table extras (tfoot qty-col highlight + `.effective-row`), + location/toggle focus-within rings. All shared chrome moved to `/shared_components/css/contract-pricing-2026.css`, loaded BEFORE this file. | contract-pricing-2026.css | ✅ Active |
| `/calculators/dtg-contract/dtg-contract.js` | **NEW (2026-05-15)** Contract DTG calc + AI assistant. Hardcoded 4-tier pricing ($7.50/$6.75/$6.00/$5.25 per location), $50 LTM at qty≤23, +$1 heavyweight. AI panel calls `/api/contract-dtg-ai/chat`, saves quotes with `CDTG` prefix. | — | ✅ Active |

### Screen Print Customer Pricing (Customer-facing)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/screenprint-customer/index.html` | Customer-supplied-garment screen print pricing calculator (staff-used, linked from Staff Dashboard) — pre-submission price-tier ladder + live-pricing error banner (FIXED 2026-07-01) | screenprint-customer-calculator.js, screenprint-pricing-service.js, quote-cart-engine.js | ✅ Active |
| `/calculators/screenprint-customer/screenprint-customer-calculator.js` | Customer-facing screen print calculator logic — pricing = 100% live via `QuoteCartEngine.singleItemPreview({customerSuppliedGarment:true})`, SAME engine Quick Quote uses (FIXED 2026-07-01: was 100% hardcoded pricing, wrong tier boundaries/LTM/dark-garment math — see LESSONS_LEARNED) | quote-cart-engine.js, screenprint-pricing-service.js, calculator-utilities.js (escapeHTML), screenprint-customer-quote-service.js | ✅ Active |
| `/calculators/screenprint-customer/screenprint-customer-quote-service.js` | Screen print customer quote save service | base-quote-service.js | ✅ Active |
| `/calculators/screenprint-customer/screenprint-customer-styles.css` | Screen print customer page styles | — | ✅ Active |
| `/calculators/screenprint-customer/screenprint-customer-fix.css` | Screen print customer style fixes + tier-ladder/error-banner styles (2026-07-01) | — | ✅ Active |

### Embroidered Emblem Calculator
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/embroidered-emblem/index.html` | **REWRITTEN (2026-05-16; hardened 2026-05-29)** Embroidered emblem patch quote page — AI-first, mirrors sticker layout. External CSS/JS only. Chat auto-opens with a STATIC greeting (no Claude call until the first rep message); accessible dialog (role=dialog/aria-modal/focus-trap/focus-return). | sticker-pricing-page.css, emblem-pricing-page.css, emblem-pricing-page.js | ✅ Active |
<!-- 4 pre-AI legacy files (emblem-calculator.js, emblem-quote-service.js, embroidered-emblem-styles.css, emblem-calculator-missing-styles.css) DELETED 2026-05-29 — unreferenced by index.html, confirmed via grep. Recover from git history if ever needed. -->


### Laser Tumbler & Sticker Calculators
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/laser-tumbler-polarcamel.html` | Laser tumbler (Polar Camel) customer product page — color picker, formula-priced tier table, logo mockup + instant quote section. Prices 100% live via jds-api-service.js (Caspio JDS-* Service_Codes). | laser-tumbler-simple.js, laser-tumbler-mockup.js, jds-tumbler-template.js, jds-api-service.js, manageorders-inventory-service.js | ✅ Active |
| `/calculators/laser-tumbler-styles.css` | Laser tumbler page styles | — | ✅ Active |
| `/calculators/sticker-manual-pricing.html` | Sticker + banner + **custom/oversize decal** pricing page (AI quote chat). 2026-06-18: added the Custom & Oversize Decal square-foot calculator + API-driven rate card (cliff-protected ladder, $90 min, GRT-50 setup) for sizes >6×6 / odd dims the standard grid can't cover. Backed by proxy `/api/custom-decal-pricing`. | sticker-pricing-page.css, sticker-pricing-page.js, memory/CUSTOM_DECAL_PRICING_2026-06.md | ✅ Active |
| `/calculators/laser-manual-pricing.html` | Laser pricing calculator (manual) | manual-calculator-styles.css | ✅ Active |

### Caspio-Embedded Forms
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/digitizingform.html` | Digitizing request form (Caspio-embedded) | Caspio datapage | ✅ Active |
| `/calculators/monogramform.html` | Monogram request form (Caspio-embedded) | Caspio datapage | ✅ Active |
| `/calculators/purchasingform.html` | Purchasing form (Caspio-embedded) | Caspio datapage | ✅ Active |

### Embroidery Pricing (Unified - Feb 2026)

**All embroidery pricing now consolidated in `/calculators/embroidery-pricing-all/`**

| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/calculators/embroidery-pricing-all/index.html` | Unified AL/CEMB + DECG pricing page | embroidery-pricing-all.js, .css | ✅ Active |
| `/calculators/embroidery-pricing.html` | Embroidery pricing calculator (garment + cap) | embroidery-pricing-service.js | ✅ Active |
| `/calculators/archive/embroidery-customer/*` | DECG standalone calculator (3 files: index.html, embroidery-customer-calculator.js, embroidery-customer-styles.css) | - | 📦 Archived |
| `/calculators/archive/embroidery-contract/*` | Contract embroidery calculator (5 files: index.html, embroidery-contract-calculator.js, embroidery-quote-service.js, embroidery-contract-fix.css, embroidery-contract-styles.css) | - | 📦 Archived |
| `/calculators/archive/embroidery-pricing.html` | Old embroidery pricing page | - | 📦 Archived |
| `/calculators/archive/manual-pricing-deprecated/*` | Pre-unification manual calculators (5 HTML: dtg, dtf, embroidery, screenprint, cap-embroidery — superseded by `/calculators/manual-pricing.html`) | - | 📦 Archived |
| `/calculators/archive/cap-embroidery-manual-pricing.html` | Pre-unification cap embroidery manual calculator | cap-embroidery-manual-service.js | 📦 Archived |
| `/calculators/archive/cap-embroidery-pricing-integrated.html` | Pre-unification integrated cap embroidery pricing | - | 📦 Archived |
| `/calculators/archive/cap-embroidery-manual-service.js` | Cap embroidery manual service (archived) | - | 📦 Archived |
| `/calculators/archive/cap-embroidery-fix.css` | Cap embroidery fix styles (archived) | - | 📦 Archived |

**AL/CEMB Pricing (Additional Logo / Contract Embroidery):**
- Garments: 5K base, $13→$5 (1-7 to 72+), +$1.00/1K
- Caps (AL-CAP/CB/CS): 5K base, $6.50→$4 (1-7 to 72+), +$1.00/1K
- Full Back (FB): $1.25/1K flat rate, 25K minimum
- LTM Fee: $50 for qty 1-7
- **API:** `/api/al-pricing`

**DECG Pricing (Customer-Supplied Embroidery):**
- Garments: $28-$20/pc (1-7 to 72+ tier) + $1.25/1K above 8K stitches
- Caps: $22.50-$16/pc (1-7 to 72+ tier) + $1.00/1K above 8K stitches
- Full Back: $1.40-$1.20/1K (8-23 to 72+ tier, **MIN 8 PIECES**, min 25K stitches)
- LTM Fee: $50 for 1-7 pieces (garments/caps only, not full back)
- Heavyweight Surcharge: +$10/piece (Carhartt jackets, bags, canvas, leather)
- **API:** `/api/decg-pricing`
- **Docs:** `/memory/DECG_PRICING_2026.md`, `/memory/EMBROIDERY_PRICING_RULES.md`

## 🔧 Services & Components

### Core JavaScript Services
| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| `/config/app.config.js` | Central configuration - ALL hardcoded values | All pages | ✅ Active |
| `/shared_components/js/base-quote-service.js` | Base quote class | All quote builders | ✅ Active |
| `/shared_components/js/calculator-utilities.js` | Shared utilities | All calculators | ✅ Active |
| `/shared_components/js/utils.js` | General utilities | Multiple pages | ✅ Active |
| `/shared_components/js/app-config.js` | Legacy config (migrate to /config/) | DTF system | ⚠️ Deprecate |

### Adapters (Master Bundle Pattern)
| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| `/shared_components/js/dtg-adapter.js` | DTG pricing adapter | DTG, DTF systems | ✅ Active |
| `/shared_components/js/dtf-adapter.js` | DTF pricing adapter | DTF system | ✅ Active |
| `/shared_components/js/embroidery-pricing-service.js` | Embroidery adapter | Embroidery system | ✅ Active |
| `/shared_components/js/golf-tournament-showcase.js` | **NEW** Golf tournament landing page logic — fetches Garment Tracker config + live embroidery pricing, renders product grid, handles EmailJS lead capture | embroidery-pricing-service.js, EmailJS, /api/garment-tracker/config, /api/pricing-bundle | ✅ Active |
| `/shared_components/js/golf-tournament-product.js` | **NEW** Product detail page logic — fetches /api/products/search for colors/sizes/description + embroidery pricing for full tier table | embroidery-pricing-service.js, /api/products/search, /api/pricing-bundle | ✅ Active |

### Quote System Components
| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| `/shared_components/js/quote-builder-base.js` | Base functionality | All quote builders | ✅ Active |
| `/shared_components/js/quote-builder-utils.js` | **NEW** Shared utilities: escapeHtml, formatPrice, showToast, etc. (2026-01-30 consolidation) | All quote builders | ✅ Active |
| `/shared_components/js/quote-cart-engine.js` | **NEW (2026-06-11, customer quote-cart Phase 0)** PURE orchestration engine for the customer quote cart — pooling/grouping per staff-builder scope (EMB garments / EMB caps / DTG / SCP-per-design / DTF), fee assembly via /api/service-codes, honest-LTM display math, tier nudges, per-group trace. Owns ZERO price formulas: adapters call the staff authorities (EmbroideryPricingCalculator class, POST /api/dtg/quote-pricing, ScreenPrintPricingService bundle + exact builder findPricingTier copy, DTFPricingService.calculatePriceForQuantity). Dual browser/Node. API: `priceCart(cart)`, `singleItemPreview(item)`. **`priceScpGroup` opts gained `customerSuppliedGarment` (2026-07-01)** — routes to `ScreenPrintPricingService.generateManualPricingData(0)` instead of a per-style fetch, for customer-supplied-blank orders (calculators/screenprint-customer); every other formula (tier/LTM/screens/stripes) unchanged. Design: memory/CUSTOMER_QUOTE_CART_DESIGN_2026-06.md | embroidery-quote-pricing.js, screenprint-pricing-service.js, dtf-pricing-service.js, /api/dtg/quote-pricing, /api/service-codes; locked by tests/unit/web-quote-cart-parity.test.js + tests/unit/screenprint-customer-parity.test.js | ✅ Active |
| `/shared_components/js/quote-cart-store.js` | **NEW (2026-06-11, customer quote-cart Phase 2; localStorage since 2026-07-04)** localStorage cart store (`window.QuoteCartStore`) — key `nwca.quoteCart.v1`, schema v1, 24h TTL (mismatch/expiry/corruption → silent reset); localStorage so the quote survives closing the tab. Items carry style/color/qty/sizes/method/placement/inkColors ONLY — **zero prices stored**; pricing happens via quote-cart-engine at render time so Caspio changes reprice on next view. API: add/updateQty/remove/clear/getItems/count/totalPieces/onChange (same-tab pub/sub + storage events). Auto-wires masthead `[data-quote-badge]` elements (hidden at 0). Dual browser/Node | localStorage; consumed by index.html, product.html, pages/catalog.html, pages/quote-cart.html; locked by tests/unit/quote-cart-store.test.js | ✅ Active |
| `/shared_components/js/mo-fetch.js` | **NEW (2026-07-04, airtight PII path)** `window.moFetch(path)` — ManageOrders READ fetch that tries the SAML-authed same-origin forwarder `/api/mo/*` first and FALLS BACK to the direct proxy `/api/manageorders/*` on 401 (customer context) / non-2xx / network error, so repointing a caller can't break a page. Only `orders`/`lineitems` are forwarded. Consumed by art-hub-steve/ae, mockup-detail, mockup-ruth, art-request-detail. Server side: `moForwardTo` + `/api/mo/{orders,orders/:no,lineitems/:no}` in server.js (requireStaff). Plan/finish: memory/AIRTIGHT_PII_PROXY_PLAN_2026-07.md | app-config.js (APP_CONFIG.API.BASE_URL); server `/api/mo/*` forwarder | ✅ Active (migration; gate-flip pending verify) |
| `/shared_components/js/web-quote-service.js` | **NEW (2026-06-11, customer quote-cart Phase 3)** SAVE/SHARE/EMAIL service for the customer cart (`window.WebQuoteService`) — WQ-prefix QuoteID via GET /api/quote-sequence/WQ (visible fallback), pre-save PARITY GATE (forceRefresh reprice; >1¢ group-total move → PRICING_CHANGED, nothing saved), two-table save via proxy CRUD (POST /api/quote_sessions + /api/quote_items), FOOTING ASSERT (rows must foot to engine group totals ±2¢ or the save aborts), artwork upload (POST /api/files/upload), fire-and-forget EmailJS (reuses service_jgrave3/template_quote_email: customer copy + sales@ alert). ZERO price math — every dollar copied from QuoteCartEngine.priceCart results. Sessions: Status 'Web Quote Request', SubtotalAmount===TotalAmount===engine grandTotal, TaxRate/TaxAmount 0 (rep taxes at confirmation), NO method-specific columns (phantom-default rule), Notes JSON {channel, taxNote, groups, artworkKeys}. Items: product rows per engine line (baked-LTM billed units) + fee/service rows (EmbellishmentType 'fee', StyleNumber = service code). Dual browser/Node | quote-cart-engine.js, /api/quote-sequence, /api/quote_sessions, /api/quote_items, /api/files/upload, EmailJS; locked by tests/unit/web-quote-service.test.js | ✅ Active |
| `/tests/unit/quote-cart-store.test.js` | **NEW (2026-06-11)** QuoteCartStore lock — add/updateQty(sizes rewrite, min-1)/remove/clear/deep-copy, 24h TTL expiry reset, schema-version-mismatch reset, corrupted-JSON reset, onChange pub/sub + unsubscribe, no-price-fields-stored guard (9 tests) | jest (node env, sessionStorage shim), quote-cart-store.js | ✅ Active |
| `/tests/unit/web-quote-service.test.js` | **NEW (2026-06-11, Phase 3)** WebQuoteService save-contract lock (25 tests) — WQ QuoteID formatting + fallback, parity gate (changed price → PRICING_CHANGED, zero POSTs), session/items payload goldens for a mixed EMB+DTG cart (footing to group totals + grand total, fee-row conventions, no phantom session columns, CATALOG_COLOR in ColorCode), SCP itemized-LTM convention, FOOTING_MISMATCH abort, partial-save warning, email reuse/failure/skip behavior, dry-run never POSTs. All fetches mocked — no Caspio rows created | jest, web-quote-service.js | ✅ Active |
| `/shared_components/js/storefront-quote-items.js` | **NEW (2026-06-12)** Synthesizes quote_items rows from a storefront order's colorConfigs (custom-tees/custom-caps) so /quote + /invoice render line items + foot to subtotal. Pure logic, dual browser/node export. Consumed by server.js save3DTQuoteSession | (none) | ✅ Active |
| `/tests/unit/storefront-quote-items.test.js` | **NEW (2026-06-12)** storefront-quote-items lock (7 tests) — caps single-color OSFA foots to subtotal, tees multi-color+extended-size upcharge in LineTotal + SHIP fee row, empty/zero-qty robustness | jest, storefront-quote-items.js | ✅ Active |
| `/tests/unit/web-quote-cart-parity.test.js` | **NEW (2026-06-11)** Quote-cart engine parity lock — every worked example from memory/CUSTOMER_QUOTE_CART_DESIGN_2026-06.md asserted to the cent (EMB a-d, DTG a-d incl. 1-23 inversion + combo anti-double-count, SCP a-d separate-mode footing, DTF a-d), pooling/caps-separate/below-minimum guards, manual-cost host-gate coverage for all 5 pricing services, SCP findPricingTier source canary | jest, quote-cart-engine.js, tests/fixtures/pricing/ | ✅ Active |
| `/tests/unit/screenprint-customer-parity.test.js` | **NEW (2026-07-01)** Regression lock for the fixed customer-supplied-garment SCP calculator — live-API-cross-verified tier/LTM/screen values (24-47/48-71/72-144/145-576, $50 LTM only at 24-47), dark-garment per-piece-unchanged/screens-only assertion, safety-stripe location scaling, below-minimum gate, manual-cost host-gate-stays-on, source assertion that Quick Quote calls the SAME `QuoteCartEngine.singleItemPreview` (9 tests) | jest, quote-cart-engine.js, screenprint-pricing-service.js, tests/fixtures/pricing/scp-bundle-PC61.json + service-codes.json | ✅ Active |
| `/tests/fixtures/pricing/` (24 JSON files) | **NEW (2026-06-11)** Live API captures backing the quote-cart parity tests: EMB/EMB-AL/CAP/CAP-AL/CAP-PUFF/PATCH bundles, size-pricing (PC61/PC90H/C112), ScreenPrint bundles (PC61/PC54), DTF + BLANK bundles, service-codes, 8 recorded POST /api/dtg/quote-pricing responses. Captured 2026-06-11 from caspio-pricing-proxy | jest fetch mock in web-quote-cart-parity.test.js | ✅ Active |
| `/shared_components/js/quote-order-summary.js` | **Shared order-summary band** (Order Recap + Ship-To card + getShipFields accessor), selector-agnostic via `QuoteOrderSummary.configure()`. Extracted from EMB (2026-06-08, Phase 0 of DTF/SCP parity). MUST load before each `*-quote-builder.js`. | EMB (live); DTF/SCP (Phase 2/3) | ✅ Active |
| `/shared_components/js/fetch-timeout.js` | Global fetch() wrapper adding 15s AbortController timeout to all requests | All embroidery pages | ✅ Active |
| `/shared_components/js/dash-page-helpers.js` | **NEW (2026-05-16)** Canonical helpers for staff-dashboard child pages — `window.DashPage.showError/hideError/apiUrl/fetchJson`. Enforces CLAUDE.md API-error rule (no silent fallback). Loaded by every page scaffolded via the `/dash-page` skill. | APP_CONFIG, fetch-timeout.js | ✅ Active |
| `/shared_components/js/emblem-pricing-page.js` | **NEW (2026-05-16)** Embroidered emblem patch page controller — fetches `/api/emblem-pricing` grid, renders 16×10 table, drives AI chat panel via SSE to `/api/contract-emblem-ai/chat`, parses PRICE_QUOTE/CUSTOMER_FINAL/EMAIL DRAFT blocks, highlights pricing-grid cell on quote, saves to `quote_sessions` with PATCH prefix. Mirrors sticker-pricing-page.js pattern. | /api/emblem-pricing, /api/contract-emblem-ai/chat, /api/quote-sequence/PATCH, /api/quote_sessions, /api/quote_items | ✅ Active |
| `/shared_components/js/webstore-pricing-page.js` | **NEW (2026-05-16)** Custom-webstore page controller — drives AI chat via SSE to `/api/contract-webstore-ai/chat`. **Dual-mode**: parses PRICE_QUOTE blocks with `productType: "webstore-setup"` (renders cream/navy store-quote card with store-type pill + per-item surcharge meta) OR `"fundraiser-item"` (renders deep-purple sell-price card with breakdown + 1099-NEC warning). Renders web_search results inline as a search-results list with linked sources. Saves to `quote_sessions` with WEB prefix. | /api/contract-webstore-ai/chat, /api/quote-sequence/WEB, /api/quote_sessions, /api/quote_items | ✅ Active |
| `/shared_components/js/dtg-quote-page.js` | **NEW (2026-05-17)** DTG quote-builder controller — drives AI chat via SSE to `/api/dtg-quote-ai/chat`. Renders deep-green `.dtg-quote-card` on PRICE_QUOTE, renders `.top-seller-card` recommendation cards inline on recommend_top_sellers tool, renders web_search results inline. When the bot emits PRICE_QUOTE + CUSTOMER_FINAL, it calls `window.DTGInlineForm.fillFromQuote()` to populate the inline order form below — the rep reviews + clicks Submit on the form (NOT in chat). Saves to `quote_sessions` with DTG prefix. | /api/dtg-quote-ai/chat, /api/quote-sequence/DTG, /api/quote_sessions, dtg-inline-form.js | ✅ Active |
| `/shared_components/js/dtg-inline-form.js` | **NEW (2026-05-18)** Inline DTG order form controller (vanilla JS, replaces the iframed legacy Bootstrap form). Mirrors `/order-form` UX: customer combobox calling `/api/company-contacts-2026/search`, style search calling `/api/stylesearch`, color picker calling `/api/product-colors`, multi-row size grid. Live per-row pricing via `window.DTGPricingService` (same service `/pricing/dtg` uses). Submit to ShopWorks first calls `/api/dtg/quote-pricing` (canonical authoritative price) then POSTs the order-form-shaped payload to `/api/submit-order-form`. Exposes `window.DTGInlineForm.fillFromQuote(priceQuote, customerFinal)` for the chat bridge. | /api/stylesearch, /api/product-colors, /api/company-contacts-2026/search, /api/dtg/quote-pricing, /api/submit-order-form, dtg-pricing-service.js, dtg-inline-form.css | ✅ Active |
| `/shared_components/js/quote-formatter.js` | Format quotes | All quote builders | ✅ Active |
| `/shared_components/js/quote-persistence.js` | Save/load quotes | All quote builders | ✅ Active |
| `/shared_components/js/quote-session.js` | Session management | All quote builders | ✅ Active |
| `/shared_components/js/quote-validation.js` | Input validation | All quote builders | ✅ Active |
| `/shared_components/js/quote-ui-feedback.js` | User feedback | All quote builders | ✅ Active |
| `/shared_components/js/quote-builder-step2-modern.js` | **NEW** Modern Step 2 UI manager (2025 refactor) | Embroidery & Cap quote builders | ✅ Active |
| `/shared_components/js/sidebar-resize.js` | **NEW** Resizable sidebar with drag handle | Embroidery quote builder | ✅ Active |
| `/shared_components/js/color-picker-component.js` | **NEW** Shared color picker module (2026 consolidation) | All quote builders | ✅ Active |
| `/shared_components/js/extended-sizes-config.js` | **NEW** Shared extended sizes config (2026 consolidation) | All quote builders | ✅ Active |
| `/shared_components/js/quote-extended-sizes.js` | **NEW** Shared extended size popup functions (2026-03-21 extraction) | EMB, DTG, Screenprint | ✅ Active |
| `/shared_components/js/quote-builder-core.js` | **NEW** Core quote builder functionality (2026 consolidation) | All quote builders | ✅ Active |
| `/shared_components/js/pricing-sidebar-component.js` | **NEW** Unified pricing sidebar (2026 consolidation) | All quote builders | ✅ Active |
| `/shared_components/js/quote-share-modal.js` | **NEW** Shareable URL success modal (2026 consolidation) | All quote builders | ✅ Active |
| `/shared_components/js/customer-lookup-service.js` | **NEW** Customer autocomplete search (2026-01-29) | All quote builders | ✅ Active |
| `/shared_components/js/customer-context-banners.js` | **NEW** Customer Warning banner + Tax Exempt chip + Account Tier badge + Payment Terms autofill with legacy-CRM mapping (2026-05-23). Exposes `window.surfaceCustomerContext(contact, config)` + `window.mapToOfferedTerms()` | EMB, DTF, SCP quote builders + customer-lookup-service.js | ✅ Active |
| `/shared_components/js/product-thumbnail-modal.js` | **NEW** Product image thumbnail + click-to-enlarge modal (2026-01-29) | DTG, Screen Print, Embroidery builders | ✅ Active |
| `/shared_components/js/shopworks-import-parser.js` | **NEW** ShopWorks order text parser (2026-01-31) | Embroidery quote builder | ✅ Active |
| `/shared_components/js/INTEGRATION-EXAMPLE.js` | **NEW** Integration example/docs (2026 consolidation) | Reference only | 📚 Docs |

### Customer Lookup System (NEW 2026-01-29)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/customer-lookup-service.js` | Customer autocomplete from Caspio Company_Contacts_Merge_ODBC | caspio-proxy API | ✅ Active |
| `/shared_components/css/customer-lookup.css` | Autocomplete dropdown styling | - | ✅ Active |
| `/shared_components/css/safety-stripe-recs.css` | **NEW (2026-06-28)** Styles for the shared safety-apparel recommendation cards (`.ssr-*`): hi-vis accent panel, responsive card grid, color swatch dots, rank/hi-vis badges, Add button. Paired with safety-stripe-recs.js. | safety-stripe-recs.js | ✅ Active |

**Backend (caspio-pricing-proxy):**

### ShopWorks Import System (NEW 2026-01-31)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/shopworks-import-parser.js` | Parse ShopWorks order text into structured data | - | ✅ Active |
| `/shared_components/css/shopworks-import.css` | Import modal and preview styling | - | ✅ Active |
| `/shared_components/css/old-designs.css` | Old designs archive page styling (amber theme) | - | ✅ Active |
| `/shared_components/js/old-designs.js` | Old designs image modal and Caspio enhancements | - | ✅ Active |

**Features:**
- "Paste from ShopWorks" button in quote builders
- Parses customer info, products, sizes, quantities
- Detects service items: digitizing (DD), additional logo (AL), DECG, monograms
- Auto-populates customer, sales rep, and product rows
- Preview before import with summary

**Backend (caspio-pricing-proxy):**
- `GET /api/company-contacts/search?q=<term>` - Search contacts by company, name, or email
- `GET /api/company-contacts/:id` - Get single contact
- `POST /api/company-contacts` - Create new contact
- `PUT /api/company-contacts/:id` - Update contact
- `POST /api/company-contacts/sync` - Sync contacts from ManageOrders (Heroku Scheduler)

**Features:**
- Autocomplete search with 3+ character minimum
- Active customers only (Customersts_Active = 1)
- Results sorted by most recent order
- Auto-fills name, email, company fields in quote builders
- Phone field removed from all quote builders (not in Caspio table)

### Public Quote View System (NEW 2026-01-12)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/pages/quote-view.html` | Public customer-facing quote page | quote-view.js, quote-view.css, jsPDF | ✅ Active |
| `/pages/js/quote-view.js` | Quote data loading, PDF generation, acceptance flow; WQ web-cart support (2026-06-11): 'Web Quote Request' type label, method-subhead rows on MIXED-EmbellishmentType quotes (single-method staff quotes unchanged), 'Sales tax — calculated by your rep' zero-tax label for WQ | jsPDF, html2canvas | ✅ Active |
| `/pages/css/quote-view.css` | Professional quote styling (mobile-responsive) | Inter font | ✅ Active |
| `/pages/quote-audit.html` | Staff-only pricing audit page (SW vs 2026) | quote-audit.js, quote-audit.css, staff-auth-helper.js | ✅ Active |
| `/pages/js/quote-audit.js` | Audit data rendering, staff auth gate | staff-auth-helper.js | ✅ Active |
| `/pages/css/quote-audit.css` | Audit page styling (self-contained) | Inter font | ✅ Active |
| `/tools/art-search.html` | Staff-only cross-tool art search ("where is design 12345?") — SERVER-gated via /tools gateStaffHtml + client StaffAuthHelper belt-and-braces (moved from /pages 2026-07-05) | art-search.js, art-search.css, staff-auth-helper.js | ✅ Active |
| `/tools/art-search.js` | Art search logic: design # exact / company LIKE / contact client-filter over /api/artrequests; normalizeStatus pills; deep-link ?q= | staff-auth-helper.js, /api/artrequests | ✅ Active |
| `/tools/art-search.css` | Art search styling (2026 art-hub tokens) | art-hub.css :root tokens | ✅ Active |

**Server Routes (server.js):**
- `GET /quote/:quoteId` - Serves public quote page
- `GET /api/public/quote/:quoteId` - Returns quote data + tracks views
- `POST /api/public/quote/:quoteId/accept` - Accepts quote with name/email
- `GET /api/quote_items/quote/:quoteId` - Get items by quote ID

**Features:**
- Shareable URLs like `nwcustomapparel.com/quote/DTF0112-1`
- View tracking (FirstViewedAt, ViewCount)
- One-click PDF download via jsPDF
- Quote acceptance workflow
- Status badges (Open, Viewed, Accepted, Expired)

**Database Fields Required in `quote_sessions` (Caspio):**
- `FirstViewedAt` (DateTime) - When customer first opened
- `ViewCount` (Integer) - Number of times viewed
- `AcceptedAt` (DateTime) - When customer accepted
- `AcceptedByName` (Text) - Name of person accepting
- `AcceptedByEmail` (Text) - Email of person accepting

### Cap Embroidery Quote System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/cap-embroidery-pricing-logic.js` | Cap embroidery pricing logic (shared between manual + quote builder) | embroidery-pricing-service.js | ✅ Active |
| `/shared_components/js/cap-embroidery-pricing-service.js` | Cap embroidery Caspio data adapter | Caspio API | ✅ Active |
| ~~`/shared_components/js/cap-quote-builder.js`~~ | **DELETED 2026-06-09** — dead cap-quote system (no HTML loads it; EMB builder handles caps via shared services). | — | ❌ Deleted |
| ~~`/shared_components/js/cap-quote-logos.js`~~ | **DELETED 2026-06-09** — orphaned after cap-quote-builder.js deletion; zero references verified. | — | ❌ Deleted |
| ~~`/shared_components/js/cap-quote-pricing.js`~~ | **DELETED 2026-06-09** — dead cap-quote pricing engine (50/100 hardcodes, no HTML loads it). | — | ❌ Deleted |
| ~~`/shared_components/js/cap-quote-products.js`~~ | **DELETED 2026-06-09** — orphaned after cap-quote-builder.js deletion; zero references verified. | SanMar API | ❌ Deleted |
| ~~`/shared_components/js/cap-quote-service.js`~~ | **DELETED 2026-06-09** — dead cap-quote save/email service (50/100 hardcodes diverged saved totals). | — | ❌ Deleted |

### Art Invoice System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/art-invoice-config.js` | Art invoice business constants (tiers, defaults) | — | ✅ Active |
| `/shared_components/js/art-invoice-creator.js` | Art invoice creator UI controller | art-invoice-config.js, EmailJS | ✅ Active |
| `/shared_components/js/art-invoice-utils.js` | Shared art invoice utility functions | — | ✅ Active |
| `/shared_components/js/art-invoice-viewer.js` | Art invoice viewer / PDF rendering | jsPDF | ✅ Active |

### Art Hub Extended
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/art-hub-steve-gallery.js` | **NEW** JS-rendered Steve gallery (replaces Caspio DataPage 2026-04-25) — exposes `window.SteveGallery` | /api/art-requests, /api/box/shared-image | ✅ Active |

### DTG Extended Services
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/dtg-catalog.js` | NWCA-Approved DTG Catalog browser on `/quote-builders/dtg-quote-builder.html` — fetches `/api/dtg/top-sellers/{categories,styles,?style=X}`, renders style grid + detail modal with colors/sizes, drops picks onto the inline form via `window.DTGInlineForm.previewStyle()`. **2026-06-03**: when a quick-find search misses the curated 20, offers a fallback to the FULL SanMar catalog via `/api/stylesearch` (empty-state CTA + a quiet footer link for queries that collide with a curated style, e.g. "5000"→DT5000); picking a result fetches `/api/product-colors` and drops the style into the form (full DTG pricing hydrates via `/api/dtg/product-bundle`, identical to curated). Non-blocking DTG-suitability warnings flag Gildan + poly/performance fabrics (`dtgSuitabilityWarning()`). | `/api/dtg/top-sellers/*`, `/api/stylesearch`, `/api/product-colors` proxy endpoints, dtg-inline-form.js, dtg-catalog.css | ✅ Active |
| `/shared_components/js/dtg-config.js` | DTG location/print settings configuration | — | ✅ Active |
| `/shared_components/js/dtg-integration.js` | DTG calculator/adapter coordinator | dtg-pricing-service.js | ✅ Active |
| `/shared_components/js/dtg-page-setup.js` | DTG pricing page initialization | — | ✅ Active |
| `/shared_components/js/dtg-pricing-service.js` | DTG pricing Caspio data adapter | Caspio API | ✅ Active |
| `/shared_components/js/dtg-product-recommendations.js` | DTG-tested product suggestions | — | ✅ Active |
| `/shared_components/js/dtg-product-recommendations-modal.js` | Modal UI for DTG product recommendations | dtg-product-recommendations.js | ✅ Active |

### DTF Extended Services
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| ~~`/shared_components/js/dtf-quote-adapter.js`~~ | **DELETED 2026-06-09** — orphaned DTF quote adapter carrying a full hardcoded DTF price grid (re-wire trap). Zero script refs. | — | ❌ Deleted |
| `/shared_components/js/dtf-quote-page.js` | DTF quote page initialization | — | ✅ Active |

### Embroidery Extended Services
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/embroidery-customization-options.js` | Embroidery customization options UI (logo placements, AL toggles) | — | ✅ Active |
| `/shared_components/js/embroidery-enhanced-loading.js` | Embroidery page loading animations | — | ✅ Active |
| `/shared_components/js/embroidery-quote-builder.js` | Legacy/extracted embroidery quote builder controller | EmbroideryQuotePricing class | ✅ Active |

### Screen Print Extended Services
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/screenprint-manual-pricing.js` | Screen print manual pricing service (used by unified manual calculator) | screenprint-pricing-service.js | ✅ Active |
| `/shared_components/js/screenprint-quote-builder.js` | Legacy/extracted screen print quote builder controller | ScreenprintQuotePricing class | ✅ Active |
| `/shared_components/js/screenprint-shopworks-guide-generator.js` | Screen print ShopWorks manual data-entry guide generator | shopworks-guide-generator.js | ⚠️ Orphan — loaded by no HTML; superseded by the `/api/scp-push/push-quote` API push (2026-05-29). Safe to delete pending Erik's OK. |

### Universal Components (header, gallery, grid)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/universal-cart-header.js` | Universal cart header (icon + item count) | cart.js, app-config.js | ✅ Active |
| `/shared_components/js/universal-header-component.js` | Universal page header (logo, nav, search) | brands-flyout.js | ✅ Active |
| `/shared_components/js/universal-image-gallery.js` | Universal product image gallery | — | ✅ Active |
| `/shared_components/js/universal-pricing-grid.js` | Universal pricing grid (tiered pricing display) | — | ✅ Active |
| `/shared_components/js/universal-product-display.js` | Universal product display (info, swatches, decoration selector) | — | ✅ Active |

### Product Search & Filtering
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/decoration-methods.js` | **NEW 2026-06-11** Decoration method eligibility — fetches `/api/decoration-methods` rules+overrides (sessionStorage 1h cache), `eligibleFor(product)` → EMB/SCP/DTF bools + DTG `'yes'/'warn'/'no'` cotton gate, `categoriesFor(method)` for the catalog Decoration filter; API down → embroidery-only fallback (`source:'fallback'`, caller must show a visible warning) | APP_CONFIG (optional) | ✅ Active |
| `/shared_components/js/product-category-filter.js` | Single source of truth for cap-vs-flat-headwear classification | — | ✅ Active |
| `/shared_components/js/product-filters.js` | Product filter UI (size, color, brand, etc.) | — | ✅ Active |
| `/shared_components/js/product-grid.js` | Product grid display + lazy load | — | ✅ Active |
| `/shared_components/js/safety-stripe-recs.js` | **NEW (2026-06-28)** Shared renderer for curated hi-vis "safety apparel" recommendation cards (`SafetyStripeRecs.render(mountId, {variant,audience,onAdd,limit})`). Used by all 4 quote builders, Quick Quote, and the customer catalog. Fetches `GET /api/safety-stripes/top-sellers/styles` (Caspio `Safety_Stripe_Top_Sellers_2026`); `variant:'builder'` = one-click Add, `variant:'catalog'` = customer card (no sales numbers). Fails quiet (optional cross-sell). | safety-stripe-recs.css, caspio-proxy API | ✅ Active |
| `/shared_components/js/product-pricing-ui.js` | Product pricing UI rendering | universal-pricing-grid.js | ✅ Active |
| `/shared_components/js/product-recommendations.js` | Product recommendation engine | — | ✅ Active |
| `/shared_components/js/product-search.js` | Product search UI | product-search-service.js | ✅ Active |
| `/shared_components/js/exact-match-search.js` | Optimized exact-style-number search for sales reps | /api/products/search | ✅ Active |

### ShopWorks Integration Services
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/edp-generator-service.js` | OnSite 7 EDP file generator (External Data Processor format) | — | ✅ Active |
| `/shared_components/js/shopworks-edp-generator.js` | ShopWorks-specific EDP wrapper | edp-generator-service.js | ✅ Active |
| `/shared_components/js/shopworks-guide-generator.js` | Generic ShopWorks order guide generator | — | ✅ Active |
| `/shared_components/js/manageorders-customer-service.js` | ManageOrders customer lookup service | /api/manageorders/customers | ✅ Active |
| `/shared_components/js/manageorders-inventory-service.js` | ManageOrders inventory queries | /api/manageorders/inventory | ✅ Active |

### Mockup Workflow Services
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/mockup-ae.js` | AE mockup workflow logic (review, send, approve) | — | ✅ Active |
| `/shared_components/js/mockup-ruth.js` | Ruth mockup workflow logic (digitizing) | — | ✅ Active |
| `/shared_components/js/mockup-submit-form.js` | Mockup submit form controller | — | ✅ Active |
| `/shared_components/js/sticker-banner-submit-form.js` | **NEW** AE Sticker/Banner art-request intake form (posts to /api/artrequests with Item_Type=Sticker/Banner + structured Item_Specs_Notes block) | /api/artrequests, /api/files/upload, EmailJS | ✅ Active |
| `/shared_components/js/garment-submit-form.js` | **NEW (2026-06-17)** AE Garment art-request intake form — replaced Caspio DataPage a0e150009f0e9f9d4ff3457dae47. Fully structured fields (Artwork_Status, Approval_Status, Artwork_Locations JSON, Color_Mode/PMS/Thread/Underbase, Exact_Text, prev-order ref, Uploaded_File_Type, AE checklist). Style→Color cascade via /api/stylesearch + /api/product-colors. | /api/artrequests, /api/files/upload, /api/stylesearch, /api/product-colors, CompanyContactPicker, DesignNamePicker, WorkOrderPicker, EmailJS | ✅ Active |
| `/shared_components/js/jds-tumbler-template.js` | **NEW** Algorithm module for JDS Tumbler Mockup Creator — mask coords, color sampling, engrave-color resolver, logo silhouette extractor. Shared by standalone page and (Phase 2) art-request integration. | (none — pure canvas logic) | ✅ Active |
| `/pages/js/jds-mockup-creator.js` | Standalone JDS Mockup Creator page logic — color picker, file upload (PNG/JPG/SVG), live preview with pointer/touch drag + arrow-key nudge, auto-fit, recenter, toggleable imprint guide, branded presentation frame, full-res PNG download, copy-to-clipboard, multi-color comparison sheet, and an Edit/Preview-frame toggle. | jds-tumbler-template.js, /api/jds-catalog, /api/jds/products/:sku | ✅ Active |
| `/pages/css/jds-mockup-creator.css` | Standalone JDS Mockup Creator styling — 2026 design tokens (scoped :root), Inter, two-column layout, swatch grid, drop zone, segmented Edit/Preview control, compare grid, focus/reduced-motion a11y states, brand maroon accent. | jds-mockup-creator.html | ✅ Active |
| `/pages/js/garment-designer.js` | **NEW (2026-06-17)** Easy Shirt Designer logic (extracted from the single-file app, 5028 lines) — entries[] model, DST decoder/renderer, RA-Poly thread system (per-stitch element naming), drawn/photo shirt mockup compositor, Customer Proof, PNG/proof export. Fixed: duplicate proof thread line, malformed-DST guard. | garment-designer.html, ag-psd, pdf.js, jszip | ✅ Active |
| `/pages/css/garment-designer.css` | **NEW (2026-06-17)** Easy Shirt Designer styling (extracted, 1851 lines). | garment-designer.html | ✅ Active |
| `/shared_components/js/garment-text-engine.js` | **NEW (2026-06-20)** Pure text-tool + contrast math (txtCase/defaultTextModel/rotatedBounds/arcLayout/hexLuminance/pickContrastWarning) — no DOM/canvas, loads in browser (window.GarmentTextEngine) AND Jest. Extracted from garment-designer.js for testability; loaded before it. | garment-designer.js (delegates), tests/unit/garment-text-engine.test.js | ✅ Active |
| `/images/garments/{polo,hoodie,longsleeve,ladies}_{front,back}.jpg` | **NEW (2026-06-20)** SanMar flat-laydown garment photos (K500 polo, PC78H hoodie, PC54LS long-sleeve, LPC54 ladies tee — solid colors, 1200×1800) for the Easy Shirt Designer "Garment style" picker. Same-origin so the recolor canvas can read pixels (SanMar CDN lacks CORS). Sourced via proxy `/api/product-details`. | garment-designer.js (GARMENT_STYLES) | ✅ Active |
| `/pages/mockup-library.html` | **NEW (2026-06-20)** Saved Mockups library — gallery of every art request with a `Rep_Mockup` (Shirt Designer mockups). Search + re-open in designer + open request. No new Caspio table (reads existing `Rep_Mockup`). Linked from AE dashboard nav + designer header. | mockup-library.js/.css, art-hub.css, app.config.js | ✅ Active |
| `/pages/js/mockup-library.js` | **NEW (2026-06-20)** Saved Mockups logic — fetches `/api/artrequests?repMockup=true`, renders cards (image + company + design# + meta chips), company/design# search, lightbox, visible-error handling. | mockup-library.html, proxy `/api/artrequests` | ✅ Active |
| `/pages/css/mockup-library.css` | **NEW (2026-06-20)** Saved Mockups library styling (reuses art-hub.css tokens) — responsive card grid, lightbox. | mockup-library.html | ✅ Active |

### Sample Order System
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/sample-inventory-service.js` | Real-time SanMar inventory check for sample products | /api/sanmar/inventory | ✅ Active |
| `/shared_components/js/sample-order-service.js` | Free sample order submission to ShopWorks (customer #2791, $0.01/sample) | /api/manageorders, EmailJS | ✅ Active |

### Pricing Matrix & Calculator Helpers
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/pricing-calculator.js` | Generic pricing calculator helper | — | ✅ Active |
| `/shared_components/js/pricing-matrix-api.js` | Pricing matrix API client (shared_components copy) | Caspio API | ✅ Active |
| `/shared_components/js/pricing-matrix-capture.js` | Captures pricing matrix from hidden Caspio iframe | Caspio datapage | ✅ Active |
| `/shared_components/js/pricing-pages.js` | Shared logic for pricing pages (legacy) | — | ✅ Active |
| `/shared_components/js/calculator-inventory.js` | Collapsible warehouse inventory grid (auto-attaches to color swatches) | /api/sanmar/inventory | ✅ Active |
| `/shared_components/js/sku-validation-service.js` | SanMar→ShopWorks SKU validation + 2XL→`_2X` translation | — | ✅ Active |

### Additional Logo (AL) Helpers
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/additional-logo-cap-simple.js` | Simple AL pricing for cap quote builder | embroidery-pricing-service.js | ✅ Active |
| `/shared_components/js/additional-logo-embroidery-simple.js` | Simple AL pricing for embroidery quote builder | embroidery-pricing-service.js | ✅ Active |

### UI Utilities & Helpers
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/toast-notifications.js` | Toast notification system (success/error/info) | — | ✅ Active |
| `/shared_components/js/elapsed-time-utils.js` | Elapsed-time badges with urgency tiers (Fresh / Waiting / Overdue) — used by all art/mockup dashboards | caspio-date-utils.js | ✅ Active |
| `/shared_components/js/caspio-date-utils.js` | Single source of truth for parsing Caspio timestamps (Pacific server time → correct UTC instant, DST-aware). Use `window.CaspioDate.parse/formatDateTime/formatDate/formatAge` instead of any `+ 'Z'` append idiom. | — | ✅ Active |
| `/shared_components/js/enhanced-loading-animations.js` | Enhanced loading animations (skeleton screens, spinners) | — | ✅ Active |
| `/shared_components/js/manual-mode-indicator.js` | Visual banner shown when pricing pages are in manual cost override mode | — | ✅ Active |
| `/shared_components/js/header-button-functions.js` | Header button helper functions (shareQuote, etc.) | — | ✅ Active |
| `/shared_components/js/cart-drawer.js` | Slide-in cart drawer UI | cart.js | ✅ Active |
| `/shared_components/js/confetti.js` | Canvas-based confetti animation (lightweight, no library) | — | ✅ Active |
| `/shared_components/js/quote-indicator-manager.js` | Persistent quote-indicator widget (collapsible, real-time updates) | — | ✅ Active |
| `/shared_components/js/design-thumbnail-service.js` | Fetch design thumbnails from `Shopworks_Thumbnail_Report` (cached) | /api/thumbnails | ✅ Active |
| `/shared_components/js/jds-api-service.js` | JDS Industries API service (laser tumblers, 1hr cache) | /api/jds | ✅ Active |
| `/shared_components/js/laser-tumbler-simple.js` | Simple laser tumbler quote flow | jds-api-service.js | ✅ Active |
| `/shared_components/js/laser-tumbler-mockup.js` | Customer logo mockup + instant quote on the laser tumbler page — page's 4 colors only, logo upload w/ artwork warnings, drag/size canvas preview, PNG download, qty→price via formula pricing | jds-tumbler-template.js, jds-api-service.js, laser-tumbler-simple.js, /api/jds-catalog | ✅ Active |
| `/shared_components/js/dp5-helper.js` | Embroidery pricing UI helper — bridges hidden Caspio matrix to custom UI | Caspio datapage | ✅ Active |

### Staff Auth & Misc Dashboards
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/lib/staff-saml.js` | Staff SAML SSO Service Provider (#2) — verifies Caspio "Staff" directory signed assertions server-side; replaces forgeable /api/crm-session. Used by `/auth/saml/*` routes in server.js | @node-saml/node-saml, SAML_* env vars | 🟡 Built 2026-06-29, awaiting deploy+test (see memory/STAFF_AUTH_DESIGN.md) |
| `/shared_components/js/staff-auth-helper.js` | Staff auth gate (Caspio role lookup) — used by quote-audit and staff-only pages | /api/staff/auth | ✅ Active |
| `/shared_components/js/staff-dashboard-employees.js` | Staff dashboard employee list/widget | /api/employees | ✅ Active |
| `/shared_components/js/monogram-dashboard.js` | Monogram dashboard controller | — | ✅ Active |

### Test/Dev Utilities (in shared_components/js — TODO move to /tests/)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/js/order-service-test-extended.js` | Extended order service tests | sample-order-service.js | ⚠️ Move to /tests/ |
| `/shared_components/js/order-service-test-utilities.js` | Order service test utilities | — | ⚠️ Move to /tests/ |

### Product Page Modules (`/product/`)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/product/js/pdp-configurator.js` | Product page 3-question configurator (2026-06-11 redesign) | QuoteCartEngine | ✅ Active |
| `/product/js/product-2026.js` | Product page controller (2026-06-11 redesign) | — | ✅ Active |
| `/product/css/product-2026.css` | Product page styles (2026-06-11 redesign) | — | ✅ Active |
| `/product/js/decoration-selector.js` | Legacy decoration selector — zero references repo-wide (verified 2026-06-11), kept pending owner decision | — | 🚩 Orphan |
| `/product/components/inventory.js` | Product inventory display (per size/color) — used by pages/inventory-details.html | services/api.js | ✅ Active |
| `/product/services/api.js` | Product API service (fetch product, inventory, pricing) — used by pages/inventory-details.html | Caspio API | ✅ Active |
| `/product/styles/product.css` | Inventory-details page styles (linked by pages/inventory-details.html) | — | ✅ Active |

> 🗑️ **2026-06-11 legacy ES-module tree deleted** (dead since the product.html configurator rewrite; zero references verified): `app.js`, `components/{search,gallery,pricing,inventory-summary,info,swatches,decoration-selector,quote-modal,image-zoom}.js`, `services/{state,quote-service,email-service}.js`, `styles/{product-2025,product-redesign,quote-modal}.css`. Recovery: `git show <pre-cleanup-commit>:product/app.js`.

## 🎨 Stylesheets

### Core CSS Files
| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| `/shared_components/css/universal-header.css` | Header styles | All pages | ✅ Active |
| `/shared_components/css/universal-calculator-theme.css` | Calculator theme | All calculators | ✅ Active |
| `/shared_components/css/embroidery-quote-builder.css` | ~~DELETED~~ — replaced by `embroidery-quote-builder-extracted.css` (2026-01-27) | — | ❌ Deleted |
| `/shared_components/css/embroidery-quote-builder-extracted.css` | Embroidery quote builder styles (2026-01-27 extraction) | Embroidery quote builder | ✅ Active |
| `/shared_components/css/quote-builder-unified-step1.css` | ~~DELETED~~ — superseded by `quote-builder-common.css` (2026-01-27) | — | ❌ Deleted |
| `/shared_components/css/dtg-quote-builder.css` | DTG specific | DTG quote builder | ✅ Active |
| `/shared_components/css/golf-tournament-showcase.css` | **NEW** Golf tournament landing page styles (golf theme — fairway greens, sand accents, gold offer ribbon) | golf-tournaments-2026.html, golf-tournament-product.html | ✅ Active |
| `/shared_components/css/golf-tournament-product.css` | **NEW** Product detail page styles (gallery, color swatches, size pills, volume pricing table) — layered on top of showcase.css | golf-tournament-product.html | ✅ Active |
| `/shared_components/css/dtg-quote-builder-extracted.css` | DTG quote builder extracted styles (2026-01-27) | DTG quote builder | ✅ Active |
| `/shared_components/css/screenprint-quote-builder-extracted.css` | Screenprint quote builder extracted styles (2026-01-27) | Screenprint quote builder | ✅ Active |
| `/shared_components/css/quote-builder-step2-modern.css` | ~~DELETED~~ — Step 2 styles merged into `quote-builder-common.css` | — | ❌ Deleted |
| `/shared_components/css/quote-builder-common.css` | **Shared** quote builder styles (2026-03 unification — common to all 4 builders) | All 4 quote builders | ✅ Active |
| `/shared_components/css/quote-builder-shell.css` | **NEW (2026-05-23)** Phase 2a — Canonical PNW visual language. PNW palette tokens (forest greens + birch + mist), card/button/titlebar/chip/input primitives (`.qb-*`), and legacy aliases that auto-uplift `var(--builder-primary)` / `var(--nwca-blue)` / `var(--nwca-green)` to PNW forest. Load order: shell BEFORE common BEFORE builder-specific. Opt-in body class `qb-shell-body` activates Inter typography + topo SVG background. | All 4 quote builders (Phase 2b rollout: SCP → DTF → EMB) | ✅ Active (Phase 2a tokens defined; per-builder reskin in progress) |
| `/shared_components/css/quote-share-modal.css` | **NEW** Shareable URL modal styles (2026 consolidation) | All quote builders | ✅ Active |
| `/shared_components/css/quote-print.css` | Quote print styles (PDF export) | All quote builders | ✅ Active |
| `/shared_components/css/quote-system.css` | Quote system shared styles | All quote builders | ✅ Active |

### Calculator & Pricing Stylesheets
| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| `/shared_components/css/calculator-base.css` | Calculator base styles (foundation for all calc pages) | All calculators | ✅ Active |
| `/shared_components/css/contract-pricing-theme.css` | **NEW (2026-05-13)** Pink-accent theme overlay for Contract pricing pages — operational color-code matching the pink box labels NWCA puts on contract jobs in the factory. Layers on top of calculator-base.css; rebinds `--primary-green`/`--primary-color`/`--primary-dark` to rose-600/700 so existing calculator CSS reuses pink without rewrite. Adds `.contract-share-btn` + `.contract-share-toast` + `.contract-info-banner` components for the "calculate → copy link → share with customer" workflow. Activated via `<body class="contract-pricing">`. | calculators/dtg-contract/index.html, calculators/embroidery-contract/index.html | ✅ Active |
| `/shared_components/css/calculator-modern-enhancements.css` | Modern calculator enhancements (2026 refresh) | All calculators | ✅ Active |
| `/shared_components/css/shared-pricing-styles.css` | Shared pricing display styles | All pricing pages | ✅ Active |
| `/shared_components/css/screenprint-pricing-clean.css` | Clean screen print pricing styles | Screen print calculator | ✅ Active |
| `/shared_components/css/screenprint-pricing-tables.css` | Screen print pricing tables | Screen print calculator | ✅ Active |
| `/shared_components/css/screenprint-toggle-styles.css` | Screen print toggle styles | Screen print calculator | ✅ Active |
| `/shared_components/css/screenprint-safety-stripes.css` | Safety stripes feature styles | Screen print + safety stripe creator | ✅ Active |
| `/shared_components/css/safety-stripe-creator.css` | Safety stripe creator styles | safety-stripe-creator.html | ✅ Active |
| `/shared_components/css/dtf-calculator.css` | DTF calculator styles | DTF pricing calculator | ✅ Active |
| `/shared_components/css/dtf-calculator-fix.css` | DTF calculator style fixes | DTF pricing calculator | ✅ Active |
| `/shared_components/css/dtf-outline-override.css` | DTF outline override styles | DTF pricing calculator | ✅ Active |
| `/shared_components/css/dtg-brand-override.css` | DTG brand color overrides | DTG quote builder | ✅ Active |
| `/shared_components/css/dtg-ltm-quantity-input.css` | DTG LTM quantity input styles | DTG calculators | ✅ Active |
| `/shared_components/css/laser-tumbler-simple.css` | Laser tumbler simple flow styles | Laser tumbler calculator | ✅ Active |
| `/calculators/screenprint-manual-fix.css` | Screen print manual calculator fix styles | Manual pricing calculator | ✅ Active |

### Universal & Component Stylesheets
| File | Purpose | Used By | Status |
|------|---------|---------|--------|
| `/shared_components/css/universal-image-gallery.css` | Universal image gallery styles | Product pages | ✅ Active |
| `/shared_components/css/universal-pricing-components.css` | Universal pricing component styles | Pricing pages | ✅ Active |
| `/shared_components/css/universal-pricing-grid.css` | Universal pricing grid styles | Pricing pages | ✅ Active |
| `/shared_components/css/universal-pricing-header.css` | Universal pricing header styles | Pricing pages | ✅ Active |
| `/shared_components/css/universal-pricing-layout.css` | Universal pricing layout styles | Pricing pages | ✅ Active |
| `/shared_components/css/universal-product-display.css` | Universal product display styles | Product pages | ✅ Active |
| `/shared_components/css/universal-quick-quote.css` | Universal quick quote styles | Quote builders | ✅ Active |
| `/shared_components/css/universal-toggle-pricing.css` | Universal toggle pricing styles | Pricing pages | ✅ Active |
| `/shared_components/css/universal-ltm-quantity-input.css` | Universal LTM quantity input styles | All quote builders | ✅ Active |
| `/shared_components/css/additional-logo-pricing-table.css` | Additional logo pricing table styles | Cap + embroidery quote builders | ✅ Active |
| `/shared_components/css/color-picker-shared.css` | Shared color picker styles | All quote builders | ✅ Active |
| `/shared_components/css/product-thumbnail-modal.css` | Product thumbnail modal styles | All quote builders | ✅ Active |
| `/shared_components/css/image-modal.css` | Generic image modal styles | Multiple pages | ✅ Active |
| `/shared_components/css/cart-drawer.css` | Cart drawer slide-in styles | Cart UI | ✅ Active |
| `/shared_components/css/dashboard-styles.css` | Shared dashboard styles | All dashboards | ✅ Active |
| `/shared_components/css/kanban.css` | Kanban board shared styles (4 boards: art-hub, transfers, supacolor, etc.) | All kanban dashboards | ✅ Active |
| `/shared_components/css/art-hub.css` | Art Hub design tokens + shared styles (2026 design system) | art-hub-steve, art-hub-ruth, ae-dashboard, bradley-transfers | ✅ Active |
| `/shared_components/css/dash-shell.css` | **NEW (2026-05-16)** Canonical shell classes (`.dash-header`, `.dash-back-link`, `.dash-content`, `.dash-error-banner`, `.dash-stat-card`, `.dash-card`, `.dash-btn`) for staff-dashboard child pages. Reuses art-hub.css tokens — defines NO new tokens. Emitted by every page scaffolded via the `/dash-page` skill. | art-hub.css, all `/dash-page new`-scaffolded pages | ✅ Active |
| `/dashboards/css/digitized-designs.css` | **NEW (2026-05-16)** Page-specific styles for digitized-designs.html. Extracted from inline `<style>` block on 2026-05-16 by `/dash-page lift` — pure extraction (no token swap, no class rename) so behavior matches pre-lift exactly. | digitized-designs.html | ✅ Active |
| `/shared_components/css/emblem-pricing-page.css` | **NEW (2026-05-16)** Emblem patch page overrides — loads ON TOP of sticker-pricing-page.css. Adds the 16×10 pricing-grid table styling, AI-quoted cell highlight, live emblem-quote card, mobile collapse. Sticker provides the chat panel + hero + accordion shell; this file only adds emblem-unique bits. | sticker-pricing-page.css, /calculators/embroidered-emblem/index.html | ✅ Active |
| `/shared_components/css/webstore-pricing-page.css` | **NEW (2026-05-16)** Custom-webstore page overrides — loads ON TOP of sticker-pricing-page.css. Adds: cream/navy `.webstore-quote-card` for store-setup quotes, deep-purple/gold `.fundraiser-quote-card` for fundraiser sell-price math, distinct `.web-search-chip` styling + `.web-search-results` inline list for Tavily search results. | sticker-pricing-page.css, /calculators/webstores.html | ✅ Active |
| `/shared_components/css/dtg-quote-page.css` | **NEW (2026-05-17)** DTG quote-builder overrides — loads ON TOP of sticker-pricing-page.css. Adds: deep-green `.dtg-quote-card` for the live price card, `.top-seller-card` recommendation cards (rendered inline in chat by the recommend_top_sellers tool), `.shopworks-success-card`, `.shopworks-error-card`. | sticker-pricing-page.css, /quote-builders/dtg-quote-builder.html | ✅ Active |
| `/shared_components/css/dtg-inline-form.css` | **NEW (2026-05-18)** Inline DTG order form styles — NWCA-green, replaces the iframed legacy Bootstrap form. Adds `.dtg-form-wrap` (paper card), `.dtg-location-pill` (front/back imprint chooser), `.dtg-rows-table` (multi-row table with style/color combobox + size grid), `.dtg-price-summary` (live tier + LTM card), `.dtg-customer-pane` (right-side customer panel mirroring the order form). | /quote-builders/dtg-quote-builder.html, dtg-inline-form.js | ✅ Active |
| `/shared_components/css/dtg-catalog.css` | **NEW (2026-05-18)** NWCA-Approved DTG Catalog browser styles — category-tabbed style grid (`.dtg-catalog-grid` + `.dtg-catalog-card`) with rank badges, plus full-screen detail modal (`.dtg-catalog-modal`) with per-color "Add to quote" cards. **2026-06-03**: + full-catalog fallback styles (`.dtg-fullcat-*`: empty-state CTA, results header/back link, compact result cards, suitability warning chips, footer link). Loaded on dtg-quote-builder.html. | /quote-builders/dtg-quote-builder.html, dtg-catalog.js | ✅ Active |
| `/shared_components/css/art-invoice-shared.css` | Shared art invoice styles | Art invoice creator + viewer | ✅ Active |
| `/shared_components/css/art-invoice-dashboard.css` | Art invoice dashboard styles | art-invoices-dashboard.html | ✅ Active |
| `/shared_components/css/mockup-ruth.css` | Ruth mockup workflow styles | art-hub-ruth.html | ✅ Active |
| `/shared_components/css/mockup-submit-form.css` | Mockup submit form styles | mockup-submit-form | ✅ Active |
| `/shared_components/css/sticker-banner-submit-form.css` | **NEW** Sticker/Banner intake form + Item-Type pill bar styles (ae-dashboard Submit Artwork tab) | ae-dashboard.html | ✅ Active |
| `/shared_components/css/garment-submit-form.css` | **NEW (2026-06-17)** Garment art-request form styles (.gsf-* — sections, garment rows, location rows, AE checklist, style autocomplete) | ae-dashboard.html | ✅ Active |
| `/shared_components/css/sticker-pricing-page.css` | **NEW (2026-05-15)** Sticker + Banner quote page styles — NWCA green theme, right-side drawer chat panel, row-highlight animation on AI-quoted SKU, dark-blue banner rate-card grid + live banner-quote card | sticker-manual-pricing.html | ✅ Active |
| `/shared_components/css/ae-nav-v2.css` | **NEW** AE Dashboard two-tier navigation (Tier 1: Steve/Ruth/Transfers/Personalization sections; Tier 2: sub-tabs) | ae-dashboard.html | ✅ Active |
| `/shared_components/css/transfer-actions.css` | Transfer action button styles | bradley-transfers + transfer-detail | ✅ Active |
| `/shared_components/css/force-green-theme.css` | Force NWCA green theme override | Multiple pages | ✅ Active |
| `/shared_components/css/modern-enhancements.css` | Modern UI enhancement overlays | Multiple pages | ✅ Active |
| `/shared_components/css/names-numbers.css` | Names & Numbers roster manager styles | names-numbers.html + dashboard | ✅ Active |
| `/shared_components/css/monogram-form.css` | Monogram form styles | monogram-form.html | ✅ Active |
| `/shared_components/css/old-designs.css` | Old designs archive styles | old-designs.html | ✅ Active |
| `/shared_components/css/customer-lookup.css` | Customer lookup autocomplete styles | All quote builders | ✅ Active |
| `/shared_components/css/shopworks-import.css` | ShopWorks import modal styles | Embroidery quote builder | ✅ Active |

### 🧮 Manual Calculator CSS Architecture

**Shared Foundation:** `/calculators/manual-calculator-styles.css` (655 lines)
- Provides: Headers, breadcrumbs, forms, buttons, alerts, pricing displays, responsive design, print styles
- Color Theme: NWCA Green (#4cb354)
- Used by: DTG, DTF, Embroidery, Laser manual calculators

**⚠️ IMPORTANT:** These calculators were built independently over time. Each works correctly but uses different CSS approaches. **Leave as-is unless broken.**

| Calculator | CSS Pattern | External Files | Inline CSS | Notes |
|------------|-------------|----------------|------------|-------|
| **DTG Manual** | ✅ Standard | 1 (shared) | ~100 lines | Product showcase, hero section |
| **DTF Manual** | ✅ Standard | 1 (shared) | ~150 lines | Product showcase, DTF features |
| **Embroidery Manual** | ✅ Standard | 1 (shared) | ~200 lines | Product showcase, stitch displays |
| **Laser Manual** | ✅ Standard | 1 (shared) | ~150 lines | Product showcase, laser features |
| **Screen Print Manual** | 🔶 Complex | **16 files** | ~200 lines | Copied from contract page, never refactored. Uses universal-pricing-* files + manual-calculator-styles.css. **Looks great, leave it alone.** |
| **Cap Embroidery Manual** | 🔶 Standalone | 1 (cap-fix) | ~550 lines | Built independently, doesn't use shared CSS. **Works fine as-is.** |
| **Sticker Pricing** | ✅ Clean Table | 0 | ~400 lines | **Simple pricing table page - NO calculator.** Replaced complex calculator with clean, easy-to-read tables for 4 standard sizes (2"×2", 3"×3", 4"×4", 5"×5"). Mobile-responsive, NWCA green theme. |

#### CSS Files Detail

**Screen Print Manual (16 files):**
```
manual-calculator-styles.css (shared)
universal-pricing-header.css
universal-pricing-layout.css
universal-calculator-theme.css
universal-pricing-components.css
shared-pricing-styles.css
modern-enhancements.css
universal-header.css
universal-image-gallery.css
universal-quick-quote.css
universal-pricing-grid.css
image-modal.css
force-green-theme.css
screenprint-pricing-tables.css
screenprint-safety-stripes.css
screenprint-toggle-styles.css
```

**Cap Embroidery Manual:**
```
cap-embroidery-fix.css
+ 550 lines of inline CSS
```

**Sticker Manual:**
```
686 lines of inline CSS (complete framework)
```

#### Guidance for NEW Manual Calculators

**Standard Pattern (Recommended):**
```html
<link href="manual-calculator-styles.css" rel="stylesheet">

<style>
    /* ONLY calculator-specific features */
    /* Product showcase, unique animations, method-specific UI */
    /* Keep under 200 lines */
</style>
```

**What Goes Where:**
- **Shared CSS:** Headers, breadcrumbs, forms, buttons, pricing displays
- **Inline CSS:** Product showcases, unique features, method-specific animations

**DO NOT:** Try to "fix" existing calculators unless there's a bug. They work.

## 📚 Documentation & Guides

### Memory/Reference Documentation
| File | Purpose | Status |
|------|---------|--------|
| `/memory/CUSTOMER_SITE_REDESIGN_2026-06.md` | **NEW** Customer-facing redesign master plan + Custom Hats store spec (2026-06-11) | ✅ Active |
| `/memory/CUSTOMER_SITE_REDESIGN_2026-06_FINDINGS.md` | **NEW** Full 8-agent discovery audit evidence for the redesign (2026-06-11) | ✅ Active |
| `/memory/CUSTOMER_QUOTE_CART_DESIGN_2026-06.md` | **NEW** Customer quote-cart: builder parity rules EMB/DTG/SCP/DTF (worked examples = jest fixtures) + architect design + 5-phase plan (2026-06-11) | ✅ Active |
| `/memory/QUOTE_BUILDER_GUIDE.md` | Complete guide for creating new quote builders | ✅ Active |
| `/memory/SCREENPRINT_QUOTE_BUILDER.md` | Screen Print Quote Builder 2026 documentation | ✅ Active |
| `/memory/EMBROIDERY_PRICING_RULES.md` | Complete embroidery pricing formulas (FB, AL, caps, tiers) | ✅ Active |
| `/memory/EMBROIDERY_PRICING_PHILOSOPHY.md` | **NEW** Three-tier philosophy, loopholes, financial impact (2026-02-05) | ✅ Active |
| `/memory/training/EMBROIDERY_PRICING_SALES_TRAINING.md` | **NEW** Sales rep training slides for Taneisha & Ruthie (2026-02-05) | ✅ Active |
| `/memory/EMBROIDERY_ITEM_TYPES.md` | Canonical ItemType reference for Embroidery_Costs table | ✅ Active |
| `/memory/DECG_PRICING_2026.md` | **NEW** Customer Supplied Embroidery (DECG) pricing reference | ✅ Active |
| `/memory/CASPIO_API_TEMPLATE.md` | API documentation (55 endpoints) | ✅ Active |
| `/memory/STAFF_DIRECTORY.md` | Staff contacts for dropdowns | ✅ Active |
| `/memory/DATABASE_PATTERNS.md` | Database schema reference | ✅ Active |
| `/memory/CRM_DASHBOARD_AUTH.md` | CRM dashboard role-based auth (sessions + API proxy) | ✅ Active |

## 📂 Dashboard & Admin

### New Dashboard Pages (NEW 2026-04)
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/dashboards/portal-directory.html` | Customer portal directory — index of customer portals | portal-directory.js, portal-directory.css | ✅ Active |
| `/dashboards/js/portal-directory.js` | Portal directory controller — customer list, search | /api/customers | ✅ Active |
| `/dashboards/css/portal-directory.css` | Portal directory styles | — | ✅ Active |
| `/dashboards/supacolor-orders.html` | Supacolor orders dashboard — local mirror of Supacolor jobs | supacolor-orders.js, supacolor-orders.css, kanban.css | ✅ Active |
| `/dashboards/js/supacolor-orders.js` | Supacolor orders controller — sync trigger, kanban view, filters | /api/supacolor-jobs | ✅ Active |
| `/dashboards/css/supacolor-orders.css` | Supacolor orders dashboard styles | kanban.css | ✅ Active |
| `/dashboards/roland-printer-supplies.html` | Roland Printer Supplies — JotForm supply-order embed (ink/parts/consumables) for Steve & Brian + printable PDF download (added 2026-06-02, dash-shell canonical) | dash-shell.css, art-hub.css, roland-printer-supplies.css, JotForm 261515595979071 | ✅ Active |
| `/dashboards/css/roland-printer-supplies.css` | Roland Printer Supplies page-specific styles | dash-shell.css, art-hub.css | ✅ Active |
| `/forms/NWCA_LG540_Order_Form_1page.pdf` | Roland printer printable supply-order form (1-page; downloaded from roland-printer-supplies.html) | — | ✅ Active |

### Staff Dashboards
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/staff-dashboard-v3/index.html` | **CANONICAL (V3 sole survivor, 2026-05-28)** Main staff dashboard served at `/staff-dashboard.html`. Uses @layer CSS (tokens → base → components → utilities → overrides) + unlayered theme. v2 and v1 files deleted; their URLs 301-redirect to canonical. Recovery: `git show v2026.05.27.5:staff-dashboard.html`. | staff-dashboard/{tokens,base,components,utilities,dashboard-v3-theme,dashboard-v3-patch-2}.css, staff-dashboard-v3/{config,caspio-isolation}.js + modular controllers under shared_components/js/staff-dashboard/ | ✅ Active |
| `/dashboards/ae-dashboard.html` | AE dashboard | Multiple | ✅ Active |
| `/dashboards/art-hub-dashboard.html` | ~~DELETED~~ Coordinator redirect (removed 2026-03-15) | — | ❌ Deleted |
| `/dashboards/art-invoices-dashboard.html` | Art invoices | art-invoice-* files | ✅ Active |
| `/dashboards/commission-structure.html` | Online store commission structure reference | commission-structure.css | ✅ Active |
| `/dashboards/css/commission-structure.css` | Commission dashboard styles | - | ✅ Active |
| `/dashboards/access-admin.html` | **NEW (2026-06-30)** Erik-only RBAC control panel — manage staff roles (`Staff_App_Roles`) + page access (`Staff_Page_Access`). Code-gated `requireCrmRole(['admin'])`. | access-admin.js, access-admin.css, `/api/crm-proxy/admin-rbac/*` | ✅ Active |
| `/dashboards/js/access-admin.js` | Access-Admin controller — roles + page-access CRUD via admin-gated crm-proxy | /api/crm-proxy/admin-rbac | ✅ Active |
| `/dashboards/css/access-admin.css` | Access-Admin panel styles (NWCA green, no inline) | - | ✅ Active |
| `/dashboards/customer-portal-admin.html` | **NEW (2026-06-30)** Customer Portals admin console — list/add/enable-disable/delete portal invites (`Customer_Portal_Access`), send magic-link login emails, preview a customer's portal. Role-gated `requireCrmRole(['admin','accountant','art','sales','taneisha','nika'])`. | dash-shell.css, dash-page-helpers.js, customer-portal-admin.css/js, `/api/crm-proxy/customer-portal-access/*`, `/api/portal-admin/*` | ✅ Active |
| `/dashboards/js/customer-portal-admin.js` | Customer Portals console controller (CRUD + CRM lookup + send-link + preview) | DashPage, same-origin `/api/crm-proxy/*` + `/api/portal-admin/*` | ✅ Active |
| `/dashboards/css/customer-portal-admin.css` | Customer Portals console page styles (table, modal, badges) | dash-shell.css, art-hub.css tokens | ✅ Active |
| `/dashboards/taneisha-crm.html` | Taneisha's Account CRM dashboard | rep-crm.js, rep-crm.css | ✅ Active |
| `/dashboards/nika-crm.html` | **NEW** Nika's Account CRM dashboard | rep-crm.js, rep-crm.css | ✅ Active |
| `/dashboards/css/rep-crm.css` | **SHARED** CRM dashboard styles (used by both reps) | - | ✅ Active |
| `/dashboards/js/rep-crm.js` | **SHARED** CRM service/controller (config-driven) | APP_CONFIG, REP_CONFIG | ✅ Active |
| `/dashboards/js/rep-calendar.js` | **SHARED** Calendar logic (config-driven) | APP_CONFIG, REP_CONFIG | ✅ Active |
| `/dashboards/house-accounts.html` | **NEW** House Account assignment dashboard | house-accounts.js, house-accounts.css | ✅ Active |
| `/dashboards/css/house-accounts.css` | **NEW** House Accounts dashboard styles | - | ✅ Active |
| `/dashboards/js/house-accounts.js` | **NEW** House Accounts service/controller | APP_CONFIG | ✅ Active |
| `/dashboards/monogram-dashboard.html` | Monogram orders dashboard | monogram-dashboard.css, monogram-dashboard.js | ✅ Active |
| `/dashboards/css/monogram-dashboard.css` | Monogram dashboard styles (NWCA green theme) | CSS variables | ✅ Active |
| `/dashboards/names-numbers-dashboard.html` | Names & Numbers roster dashboard | names-numbers-dashboard.js, names-numbers.css | ✅ Active |
| `/pages/names-numbers.html` | Names & Numbers roster form (team names, numbers, sizes) | names-numbers-controller.js, names-numbers-service.js | ✅ Active |
| `/shared_components/js/names-numbers-controller.js` | Roster form UI controller (tabs, groups, table, OCR, import) | names-numbers-service.js | ✅ Active |
| `/shared_components/js/names-numbers-service.js` | Roster API service (CRUD, Excel parse, OCR) | APP_CONFIG | ✅ Active |
| `/shared_components/js/names-numbers-dashboard.js` | Roster dashboard logic (search, filter, KPIs) | names-numbers-service.js | ✅ Active |
| `/shared_components/css/names-numbers.css` | Names & Numbers shared styles (blue theme) | CSS variables | ✅ Active |
| `/dashboards/staff-login.html` | Staff authentication login page | — | ✅ Active |
| `/dashboards/staff-portal-simple.html` | Simplified staff portal | — | ✅ Active |
| `/dashboards/staff-portal-final.html` | Final staff portal layout | — | ✅ Active |
| `/dashboards/quote-management.html` | Quote management dashboard (search, edit, manage quotes) | quote-management.css, js/quote-management.js | ✅ Active |
| `/dashboards/js/quote-management.js` | Quote management page logic (extracted from inline `<script>` 2026-07-05 — Rule 3) | APP_CONFIG, staff-auth-helper, caspio-date-utils | ✅ Active |
| `/dashboards/css/quote-management.css` | Quote management dashboard styles | — | ✅ Active |
| `/dashboards/js/sanmar-inbound-today.js` | "SanMar Inbound Calendar" modal — pick any day → that day's POs (PO+WO, line items w/ color/size, per-box contents, logos), box labels + PDF; month-calendar picker | APP_CONFIG, /api/sanmar-orders/inbound-today + /daily-inbound (proxy) | ✅ Active |
| `/dashboards/digitized-designs.html` | Digitized designs management dashboard | — | ✅ Active |
| `/dashboards/old-designs.html` | Old designs archive search (Caspio embed) | old-designs.css, old-designs.js | ✅ Active |
| `/dashboards/art-invoice-view.html` | Art invoice detail view page | — | ✅ Active |
| `/dashboards/bundle-orders-dashboard.html` | Bundle orders management dashboard | bundle-orders.js | ✅ Active |
| `/dashboards/bundle-orders.js` | Bundle orders dashboard logic | — | ✅ Active |
| `/dashboards/art-hub-coordinator.html` | ~~DELETED~~ Coordinator workflow (removed 2026-03-15) | — | ❌ Deleted |
| `/dashboards/art-hub-ruth.html` | Art hub — Ruth's personalized view | — | ✅ Active |
| `/dashboards/art-hub-steve.html` | Art hub — Steve's personalized view | art-hub.css, art-hub-steve.js | ✅ Active |
| `/dashboards/bradley-transfers.html` | **NEW** Bradley's Supacolor transfer queue (heat-transfer orders to subcontractor) | bradley-transfers.js, bradley-transfers.css, art-hub.css, caspio-pricing-proxy /api/transfer-orders | ✅ Active |
| `/dashboards/production-shifts.html` | **NEW** Production team daily shift schedule + WA labor rules (clock-in/out, breaks, lunch) | production-shifts/{styles.css, app.jsx, data.js}, React 18 + Babel CDN | ✅ Active |
| `/dashboards/production-shifts/styles.css` | **NEW** Production Shifts page styles (Geist font, timeline, table, work-rules cards) | — | ✅ Active |
| `/dashboards/production-shifts/app.jsx` | **NEW** Production Shifts React app (Header, DaySummary, MasterTable, Timeline, WorkRules, LaborRules) | data.js (window.NWCA_SCHEDULE + NWCA_HELPERS) | ✅ Active |
| `/dashboards/production-shifts/data.js` | **NEW** Production Shifts employee data + time helpers (window.NWCA_SCHEDULE, NWCA_HELPERS) | — | ✅ Active |
| `/forms/NWCA-Meal-Period-Waiver.pdf` | **NEW** Voluntary Meal Period Waiver — employees download, fill out, return to Bradley Wright | served via `/forms` static route, linked from production-shifts dashboard | ✅ Active |
| `/forms/policies/*` (9 files) | **NEW** SweetProcess-migrated policy attachments — screen-print & Shopify workflow diagrams, Providing Good Artwork guide, Polycom + SoundPoint IP 650 phone manuals, DTG ops manual + ink order form, credit-card auth form, new-clerk receiving checklist | served via `/forms` static route; embedded/linked from Policies Hub policies (Caspio) | ✅ Active |
| `/dashboards/js/bradley-transfers.js` | **NEW** Transfer queue controller — poll API, filter/sort, create transfer modal | /api/transfer-orders, /api/transfer-orders/stats | ✅ Active |
| `/dashboards/css/bradley-transfers.css` | **NEW** Transfer queue styles (navy theme, rush pulse, status chips, modal) | — | ✅ Active |
| `/pages/transfer-detail.html` | **NEW** Single-transfer detail page with status transition buttons (Mark Ordered / Add PO / Ship / Receive / Cancel / Rush) + activity timeline | transfer-detail.js, transfer-detail.css, bradley-transfers.css, /api/transfer-orders/:id | ✅ Active |
| `/pages/js/transfer-detail.js` | **NEW** Transfer detail controller — fetches record + notes, status machine, 6 modals, localStorage-based user identity | /api/transfer-orders/:id (+ /status, /rush, /notes) | ✅ Active |
| `/pages/css/transfer-detail.css` | **NEW** Transfer detail page styles (header card, 2-col grid, timeline, action buttons) | — | ✅ Active |
| `/shared_components/js/transfer-actions-shared.js` | **NEW** Box file picker modal + `window.TransferActions.openSendModal()` — shared by mockup-detail, art-request-detail, Steve's dashboard | /api/box/folder-files, /api/box/shared-link, /api/transfer-orders, transfer-actions.css | ✅ Active |
| `/shared_components/css/transfer-actions.css` | **NEW** Self-contained modal styling for Send to Supacolor picker (navy theme, toasts) | — | ✅ Active |
| `/dashboards/js/steve-send-supacolor.js` | **NEW** Steve's dashboard header button handler — prompts for design #, looks up ArtRequest, opens shared modal | transfer-actions-shared.js, /api/artrequests | ✅ Active |
| `/dashboards/bradley-screenprint.html` | **NEW** Bradley's screen-print queue (Method='Screen Print' transfers to L&P Printing — no upstream API) | bradley-screenprint.js, bradley-transfers.css (shared), art-hub.css, /api/transfer-orders?method=Screen%20Print | ✅ Active |
| `/dashboards/js/bradley-screenprint.js` | **NEW** Screen-print queue controller — mirrors bradley-transfers.js, strips Supacolor-only chrome (auto-link, stale-link, job navigation) | /api/transfer-orders?method=Screen%20Print | ✅ Active |
| `/dashboards/js/steve-send-screenprint.js` | **NEW** Steve's "Send to Screen Print" button handler — opens shared modal in `method:'Screen Print'` mode (L&P Printing vendor) | transfer-actions-shared.js | ✅ Active |
| `/shared_components/css/art-hub.css` | **NEW** Shared art hub dashboard styles (CSS custom props for theming) | — | ✅ Active |
| `/shared_components/js/art-actions-shared.js` | **NEW** Shared art action modals (Log Time, Mark Complete, Send Mockup) — used by art-hub-steve.js + art-request-detail.js | art-hub.css, caspio-proxy API, EmailJS | ✅ Active |
| `/shared_components/js/art-hub-steve.js` | Steve's gallery card processing + notes panel — delegates modals to art-actions-shared.js | art-hub.css, art-actions-shared.js, caspio-proxy API | ✅ Active |
| `/shared_components/js/art-hub-ae.js` | AE gallery card processing (maroon theme, View Details only) | art-hub.css, ae-dashboard.html | ✅ Active |
| `/shared_components/js/art-ae.js` | AE Steve Mockups tab — API-driven art request gallery (replaces Caspio DataPage) | art-hub.css, ae-dashboard.html | ✅ Active |
| `/shared_components/js/ae-dashboard.js` | **NEW** AE dashboard: tab switching, modals, dropdown, notification polling + toasts | ae-dashboard.html | ✅ Active |
| `/dashboards/css/taneisha-crm.css` | ⚠️ DEPRECATED - use rep-crm.css | - | ⚠️ Legacy |
| `/dashboards/js/taneisha-crm.js` | ⚠️ DEPRECATED - use rep-crm.js | - | ⚠️ Legacy |

### Staff Dashboard Legacy JS (still loaded by V3 as bridge globals)
| File | Purpose | Status |
|------|---------|--------|
| `/shared_components/js/staff-dashboard-service.js` | ShopWorks ManageOrders API integration; V3 garment-tracker controller bridges to its `window.StaffDashboardService.*` globals | ✅ Active |
| `/shared_components/js/staff-dashboard-announcements.js` | Priority announcements with dismiss | ✅ Active |
| `/shared_components/js/staff-dashboard-init.js` | Initialization, widget toggles, auto-refresh | ✅ Active |
| `/shared_components/js/production-schedule-stats.js` | Precomputed turnaround stats from 819 records | ✅ Active |
| `/shared_components/js/production-schedule-predictor.js` | Prediction engine for turnaround times | ✅ Active |

### Staff Dashboard V3 Refactor (in development on `refactor/staff-dashboard-v3` branch — 2026-05-12)
Polish + code-quality pass. Plan: `~/.claude/plans/this-is-a-big-parsed-unicorn.md`. Built in parallel at `/staff-dashboard-v3/`; cuts over once 90-day soak passes. v2 will move to `/staff-dashboard-v2.html` at cutover.
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/shared_components/css/staff-dashboard/tokens.css` | **NEW (v3)** Design tokens — oklch + NW green, space/motion/z-index/font-size/focus-ring scales, semantic alias layer. Wrapped in `@layer tokens`. | — | 🚧 In dev |
| `/shared_components/js/staff-dashboard/core/dashboard-endpoints.js` | **NEW (v3)** Endpoint registry — single source of truth for every URL the dashboard hits. Reads BASE from `window.APP_CONFIG.API.BASE_URL` (Rule #7). | window.APP_CONFIG | 🚧 In dev |
| `/shared_components/js/staff-dashboard/core/dashboard-fetch.js` | **NEW (v3)** Uniform fetch wrapper. Always throws on error (Rule #4 — no silent fallbacks), GET dedup, 30s timeout, 429 jittered retry. Exports `dashboardFetch`, `dashboardFetchJson`, `DashboardApiError`. | — | 🚧 In dev |
| `/shared_components/js/staff-dashboard/core/dashboard-store.js` | **NEW (v3)** Versioned state store — namespaced `nwca-dash:*` keys, per-key TTL + version stamping, safe corrupt-entry recovery. Replaces 10 scattered localStorage/sessionStorage keys. | — | 🚧 In dev |
| `/shared_components/js/staff-dashboard/core/dashboard-events.js` | **NEW (v3)** Delegated event router — replaces 22+ inline `onclick=` (Rule #3). Markup: `data-action="metrics:refresh"`. Listen: `events.register('metrics:refresh', fn)`. Auto-installs on import. | — | 🚧 In dev |
| `/shared_components/js/staff-dashboard/core/dashboard-errors.js` | **NEW (v3)** Centralized error UI — `showApiError(area, error, { onRetry })` replaces 4 inline error renderers. Retry buttons routed through the event delegator. | dashboard-events.js, dashboard-fetch.js, dashboard-ui-utils.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/core/dashboard-ui-utils.js` | **NEW (v3)** Shared UI helpers — `escapeHtml`, `formatMoney`, `formatPercent`, `formatRelativeTime`, `daysRemainingInYear`, `sparklineSvg`, `debounce`, etc. Used by every controller. | — | 🚧 In dev |
| `/shared_components/css/staff-dashboard/base.css` | **NEW (v3)** Reset, body, typography, layout shell, sidebar, header. Wrapped in `@layer base`. Includes responsive sidebar overlay for tablet (<1100px) + mobile (<768px). | tokens.css | 🚧 In dev |
| `/shared_components/js/staff-dashboard/widgets/dashboard-modal.js` | **NEW (v3)** `<dashboard-modal>` custom element — owns scroll-lock, focus-trap, escape-to-close, backdrop-click, ARIA dialog. Replaces duplicated logic in staff-directory + gap-report modals. | — | 🚧 In dev |
| `/shared_components/js/staff-dashboard/services/employees-service.js` | **NEW (v3)** Wraps the hardcoded employee roster (data preserved verbatim from staff-dashboard-employees.js per Erik's plan answer #2). Exposes `all()`, `active()`, `upcomingBirthdays(N)`, `upcomingAnniversaries(N)`, `search(q)`. | — | 🚧 In dev |
| `/shared_components/js/staff-dashboard/controllers/sidebar-controller.js` | **NEW (v3)** Sidebar collapse/expand + mobile hamburger overlay. Persists section states via dashboard-store. Replaces inline `toggleSidebarSection` from staff-dashboard.html. | dashboard-events.js, dashboard-store.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/controllers/announcements-controller.js` | **NEW (v3)** Hero + list rendering + dismiss flow. Reads from `window.staffAnnouncementsData` (data stays inline per Erik's plan answer #2). Replaces staff-dashboard-announcements.js. | dashboard-events.js, dashboard-store.js, dashboard-ui-utils.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/controllers/sales-goal-controller.js` | **NEW (v3, Phase 4.1)** Compressed 56px sales-goal pill. Pace badge (+%/− vs expected-today), days-remaining countdown, projected EOY. Reads `ANNUAL_GOAL` from `dashboard-ui-utils`. All client-side math. | dashboard-ui-utils.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/controllers/celebrations-controller.js` | **NEW (v3, Phase 4.5)** Combined "Team" widget — single dropdown for birthdays + anniversaries (replaces 3 separate pills) + staff-directory modal with live search input. Uses `<dashboard-modal>`. | dashboard-events.js, employees-service.js, dashboard-modal.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/services/shopworks-service.js` | **NEW (v3)** Wraps ManageOrders endpoints — `loadRevenueWindow(days)`, `loadYearOverYear(days)`, `loadYtdSubset(60)`. Uses `dashboardFetch` (no silent fallbacks). v3 first cut covers revenue + YoY; team-perf hybrid YTD lands in follow-up phase. | dashboard-fetch.js, dashboard-endpoints.js, dashboard-store.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/controllers/metrics-controller.js` | **NEW (v3, Phase 4.4)** Revenue card with sparkline (220×32 inline SVG), AOV + order count, YoY badge. Reads `defaultRevenuePeriod` from Tweaks. **Does not** touch `#salesTeamList` — that's owned by team-performance-controller. 60-day window deliberately doesn't feed sales-goal banner (Rule #4 — partial-year would skew pace math). | shopworks-service.js, dashboard-errors.js, dashboard-events.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/controllers/auth-controller.js` | **NEW (v3)** Lifts the inline auth code out of staff-dashboard.html (Rule #3). Polls Caspio `[@authfield:...]` placeholders + listens for `DataPageReady`, applies welcome name, mirrors to legacy sessionStorage keys for back-compat with downstream pages. | dashboard-store.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/widgets/tweaks-fab.js` | **NEW (v3, Phase 4.7)** Floating settings drawer. Persists via `dashboard-store`. Options: accent (4 hues), density (comfy/compact), default revenue period (7/30/60/90 — NEW), reset to defaults (NEW). Light theme intentionally NOT exposed. Exposes `window.StaffDashboardV3Tweaks`. | dashboard-store.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/core/dashboard-app.js` | **NEW (v3)** Single ES module entry point. Loaded as `<script type="module">` from `/staff-dashboard-v3/index.html`. Bootstraps tweaks → auth → sidebar → announcements → sales-goal → celebrations → metrics, then sets a 5-min refresh interval. | All controllers + tweaks-fab + dashboard-modal | 🚧 In dev |
| `/shared_components/css/staff-dashboard/components.css` | **NEW (v3)** All reusable components — sales-goal pill (Phase 4.1), announcements, tool categories + buttons, metrics cards (revenue + rep cards + sparkline), Team widget dropdown (Phase 4.5), staff modal (uses `<dashboard-modal>`), production predictor, garment tracker, error banners, skeleton loaders, tweaks FAB + panel. Wrapped in `@layer components`. Uses CSS nesting + container queries. | tokens.css, base.css | 🚧 In dev |
| `/shared_components/css/staff-dashboard/utilities.css` | **NEW (v3)** Single-purpose helpers — `.stack`, `.cluster`, `.text-*`, `.surface-*`, `.visually-hidden`, `.is-hidden`, `.hide-mobile`/`.show-mobile-only`, focus + spacing + width utilities. Wrapped in `@layer utilities` so direct usage beats component defaults. | tokens.css | 🚧 In dev |
| `/staff-dashboard-v3/index.html` | **NEW (v3)** Parallel-build entry point at `/staff-dashboard-v3/`. Will live alongside `/staff-dashboard.html` (v2) for 90-day soak. At cutover, v2 moves to `/staff-dashboard-v2.html` and the canonical route serves v3. **Coming next.** | All v3 CSS + dashboard-app.js | 🚧 In dev |
| `/staff-dashboard-v3/config.js` | **NEW (v3)** Tiny bootstrap that sets `window.APP_CONFIG.API.BASE_URL` to the caspio-pricing-proxy URL. Loaded as a regular `<script>` BEFORE the module entry point so dashboard-endpoints.js can read it. Keeps Rule #3 (no inline JS in HTML) clean. | — | 🚧 In dev |
| `/staff-dashboard-v3/announcements-bootstrap.js` | **NEW (v3)** Reads the `<script type="application/json" id="staffAnnouncementsData">` block from index.html and assigns it to `window.staffAnnouncementsData`. Lifts inline data out of a real `<script>` block per Rule #3 — JSON island is data, not logic. | — | 🚧 In dev |
| `/staff-dashboard-v3/caspio-isolation.js` | **NEW (v3, 2026-05-13)** Tiny non-module `<script>` loaded in `<head>` BEFORE the Caspio auth embed runs. Sets up a `MutationObserver` on `<head>` that disables any `<link rel="stylesheet">` Caspio's embed script injects (semantic.css, responsive576/1024.css, etc). Fixes the "dashboard renders correctly then half-a-second later reverts to dim" bug — Caspio's `semantic.css` was overriding our color palette. Caspio's JS keeps working (still populates `[@authfield:*]` divs for auth-controller). Observer auto-disconnects after 30s. | — | ✅ Active |
| `/shared_components/js/staff-dashboard/controllers/production-controller.js` | **NEW (v3)** Renders the Production Schedule Predictor widget (per-service turnaround days + season badge). Depends on legacy `production-schedule-stats.js` + `production-schedule-predictor.js` loaded as plain `<script>` tags before the v3 module entry. | window.ProductionPredictor (legacy globals) | 🚧 In dev |
| `/shared_components/js/staff-dashboard/services/caspio-archive-service.js` | **NEW (v3)** Reads per-rep YTD totals from the Caspio archive via `/caspio/daily-sales-by-rep/ytd?year=N`. Single source of truth for archived per-rep YTD data. | dashboard-fetch.js, dashboard-endpoints.js, dashboard-store.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/controllers/team-performance-controller.js` | **NEW (v3)** Renders per-rep YTD revenue cards. v3 first cut: archive-only (covers Jan 1 → ~60 days ago); live top-up + full hybrid logic in follow-up phase. Includes name normalization (Ruth↔Ruthie, House+House-Legacy aggregation). Pushes total YTD to sales-goal banner. | caspio-archive-service.js, sales-goal-controller.js, dashboard-events.js | 🚧 In dev |
| `/shared_components/js/staff-dashboard/controllers/garment-tracker-controller.js` | **NEW (v3)** Renders the Garment Tracker table (per-rep premium item quantities + bonus pace toward $500 goal). **Bridges** to legacy `window.StaffDashboardService.loadGarmentTrackerFromTable/syncGarmentTracker/getGarmentTrackerConfig` (loaded as plain `<script>` from `/shared_components/js/staff-dashboard-service.js`). Full proper port of the 1,500-line legacy sync logic deferred to Phase 2 follow-up. | window.StaffDashboardService (legacy bridge), dashboard-events.js, dashboard-errors.js | 🚧 In dev |

### Dashboard Reports
| File | Purpose | Status |
|------|---------|--------|
| `/dashboards/reports/price-audit-report.html` | **NEW** Price audit report — SW 2025 vs 2026 pricing comparison for rep training (2026-02-15) | ✅ Active |
| `/dashboards/reports/price-audit-report.css` | **NEW** Styles for price audit report page (2026-02-15) | ✅ Active |

### Employee Bundle Pages
| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/dashboards/DrainPro-Bundle.html` | Drain-Pro employee bundle labels | Caspio datapage | ✅ Active |
| `/employee-bundles/streich-bros-bundle.html` | Streich Bros employee bundle labels | Caspio datapage | ✅ Active |
| `/employee-bundles/wcttr-bundle.html` | WCTTR (West Coast Truck and Trailer Repair) employee bundle labels | Caspio datapage | ✅ Active |

## 🗑️ Recently Removed (For Reference)

### CRM Role-Based Access Control (2026-01-23)
**Context:** Replaced shared password login with Caspio-based role permissions
- `/pages/crm-login.html` (255 lines) → Deleted (replaced by Caspio auth)
- CRM dashboards now use role-based access via Express session
- **Erik:** Full access (taneisha, nika, house)
- **Taneisha:** Own dashboard only
- **Nika:** Own dashboard only

### Richardson Simplification (2026-01-02)
**Context:** Richardson quote builder simplified to real-time pricing lookup (81% code reduction)
- `richardson-caps-calculator.js` (2,659 lines) → Replaced by `richardson-factory-direct.js` (450 lines)
- `richardson-quote-service.js` (262 lines) → Quote building removed
- `richardson-112-images.js` → 112 is SanMar product, not Factory Direct
- `richardson-color-selector-enhancement.js` → Color picker not needed
- `richardson-color-selector.css` → Color picker styles removed

### Memory System Cleanup (2026-01-08)
**Context:** Cleaned up /memory/ docs to reduce Claude Code context bloat
- `/memory/3-day-tees/DAY-5-MORNING-SUMMARY.md` (413 lines) → Deleted (outdated dev log)
- `/memory/3-day-tees/DAY-5-AFTERNOON-SUMMARY.md` (498 lines) → Deleted (outdated dev log)
- `/memory/3-day-tees/DAY-6-MORNING-SUMMARY.md` (357 lines) → Deleted (outdated dev log)
- `/memory/PRICING_MANUAL_CORE.md` (294 lines) → Deleted (duplicated MANUAL_CALCULATOR_CONCEPTS.md)
- `/memory/INDEX.md` (525 lines → 130 lines) → Trimmed by 75%
- **Total savings:** ~1,957 lines of duplicate/stale content

### Removed During Cleanup (2025-01-27)
- **71 JavaScript files** - Orphaned, unused, or duplicate
- **6 HTML backup files** - Replaced by Git version control
- **Archive folder** - 3.8MB moved to external backup
- **Test files in root** - Moved to `/tests/` folder

### Additional Cleanup (2025-01-27 - Second Pass)
- **8 data/test files from root** - CSV test results, log files
- **5 training folder files** - .bak file, test files, duplicates
- **11 orphaned JS files** - Unused adapters and utilities in shared_components/js/

### Root Directory Organization (2025-01-27 - Third Pass)
**Moved from root to organized folders:**
- **6 data export files** → `/docs/data-exports/` (CSV, JSON, XML exports)
- **2 template files** → `/docs/templates/` (EmailJS and instructions)
- **4 guide documents** → `/docs/guides/` (API, CSS, system docs)
- **4 log/generated files** → `/logs/` (server.log, dependency maps)
- **1 script file** → `/scripts/` (migrate-beta.sh)
- **Total:** 17 files moved from root, reducing clutter by ~25%

### Files Scheduled for Removal
| File | Reason | Remove By | Status |
|------|--------|-----------|--------|
| None currently | - | - | - |

## 📊 Statistics

**As of 2026-04-29 audit (filesystem totals — see header for scope):**
- Active code files: **575** (296 HTML, 269 JS, 195 CSS — `tests/` excluded)
- Per directory:
  - `shared_components/js/`: 146 files (largest single dir)
  - `calculators/` (incl. archive): 84 files
  - `pages/` (incl. js/, css/, order-form/, services/, utils/): 76 files
  - `shared_components/css/`: 61 files
  - `dashboards/` (incl. js/, css/, reports/): 39 files
  - `training/`: 41 files
  - Root (HTML/JS/CSS only): 34 files
  - `product/` (incl. components/, services/, styles/, js/): 20 files
  - `scripts/` (incl. safety-tools/): 20 files
  - `mockups/`: 11 files
  - `policies/`: 8 files
  - `email-templates/`: 7 files
  - `quote-builders/`: 6 files
  - `tools/`, `templates/`: 5 each
  - `admin/`, `art-tools/`, `vendor-portals/`: 3-4 each
  - `employee-bundles/`, `richardson-caps/`: 2 each


### File Count by Type
- **HTML Files:** ~120
- **JavaScript Files:** ~130
- **CSS Files:** ~65
- **Active Calculators:** 20 (includes contract, customer-facing, forms)
- **Active Quote Builders:** 5 (DTG, DTF, Embroidery, Screen Print, Monogram)
- **Active Dashboards:** 20 (includes staff portals, CRM, art hub variants, bundle orders, quote management)

### Organization Health
- **Files in correct folders:** 100%
- **No inline code:** Target achieved
- **No duplicate files:** Target achieved
- **No test files in root:** Target achieved

## ⚠️ Files Requiring Attention

### Need Refactoring
| File | Issue | Priority |
|------|-------|----------|
| Various HTML files | Still have inline scripts (113 files) | Medium |
| Multiple JS files | Hardcoded API URLs (149 instances) | High |

## 📁 Additional Directories

### Training Materials (`/training/` — 41 files)

Operational guides, training modules, and Adriyella's daily-task tooling. Most are standalone HTML pages with embedded JS/CSS.

| File | Purpose | Status |
|------|---------|--------|
| `/training/garment-art-request-guide.md` | **NEW (2026-06-17)** AE field guide for the rebuilt Garment art-request form — each field, what's required, what "approved" means, repeat/revision how-tos, short-notes rule | ✅ Active |
| `/training/adriyella-admin.html` | Adriyella admin landing page | ✅ Active |
| `/training/adriyella-admin-dashboard.html` | Adriyella admin dashboard | ✅ Active |
| `/training/adriyella-billing-dashboard.html` | Adriyella billing dashboard | ✅ Active |
| `/training/adriyella-bonus-calculator.html` | Adriyella bonus calculator | ✅ Active |
| `/training/adriyella-bonus-report.html` | Adriyella bonus report | ✅ Active |
| `/training/adriyella-daily-report.html` | Adriyella daily report | ✅ Active |
| `/training/adriyella-daily-tasks.html` | Adriyella daily tasks (v1) | ✅ Active |
| `/training/adriyella-daily-tasks-v2.html` | Adriyella daily tasks (v2 — current) | ✅ Active |
| `/training/adriyella-task-history.html` | Adriyella task history view | ✅ Active |
| `/training/adriyella-test-guide.html` | Adriyella test guide | ✅ Active |
| `/training/adriyella-performance-utils.js` | Adriyella performance utility functions | ✅ Active |
| `/training/adriyella-task-service.js` | Adriyella task service (Caspio CRUD) | ✅ Active |
| `/training/api-test-runner.html` | API test runner harness | ✅ Active |
| `/training/art-approval-guide.html` | Art approval workflow guide | ✅ Active |
| `/training/bonus-policy.html` | Bonus policy reference | ✅ Active |
| `/training/cap-training.html` | Cap embroidery training | ✅ Active |
| `/training/customer-categorization-training.html` | Customer categorization training | ✅ Active |
| `/training/customer-service.html` | Customer service training | ✅ Active |
| `/training/get-to-know-erik.html` | "Get to know Erik" intro page | ✅ Active |
| `/training/google-review-guide.html` | Google review request guide | ✅ Active |
| `/training/lead-email-templates.html` | Lead email templates | ✅ Active |
| `/training/lead-follow-up-guide.html` | Lead follow-up guide | ✅ Active |
| `/training/lead-sheet-guide.html` | Lead sheet guide | ✅ Active |
| `/training/lead-source-training.html` | Lead source training | ✅ Active |
| `/training/nwca-language-reference.html` | NWCA language/terminology reference | ✅ Active |
| `/training/quick-reference-tips.html` | Quick reference tips | ✅ Active |
| `/training/sales-coordinator-manual.html` | Sales coordinator manual | ✅ Active |
| `/training/sales-coordinator-training-schedule.html` | Sales coordinator training schedule | ✅ Active |
| `/training/sales-tax-code-trainer.html` | Sales tax code trainer | ✅ Active |
| `/training/shipping-receiving-guide.html` | Shipping & Receiving Clerk training guide (receiving/shipping/pickups/close-day/hand-off) | ✅ Active |
| `/training/shipping-receiving-guide.css` | Styles for the Shipping & Receiving training guide (print-friendly) | ✅ Active |
| `/training/shipping-receiving-guide.js` | Shipping & Receiving guide behaviour: print, persistent checklists, back-to-top | ✅ Active |
| `/training/shopworks-customer-setup.html` | ShopWorks customer setup guide | ✅ Active |
| `/training/shopworks-customer-setup-enhanced.html` | ShopWorks customer setup (enhanced) | ✅ Active |
| `/training/shopworks-customer-setup-working.html` | ShopWorks customer setup (working draft) | ⚠️ Verify |
| `/training/shopworks-embroidery-order-type.html` | ShopWorks embroidery order type guide | ✅ Active |
| `/training/shopworks-notes.html` | ShopWorks notes reference | ✅ Active |
| `/training/shopworks-sales-tax-training.html` | ShopWorks sales tax training | ✅ Active |
| `/training/team-match-game.html` | Team match game (training) | ✅ Active |
| `/training/test.html` | Test page (likely scratch — verify) | ⚠️ Verify |
| `/training/thank-you-card-guide.html` | Thank-you card guide | ✅ Active |
| `/training/training-engine-base.js` | Training engine base class | ✅ Active |
| `/training/training-games-hub.html` | Training games hub | ✅ Active |
| `/training/server.js` | Local training server (dev only) | ⚙️ Tooling |
| `/training/simple-server.js` | Simple training server (dev only) | ⚙️ Tooling |

### Mockups & Prototypes (`/mockups/` — 11 files)

UI/UX prototypes used during design iteration. Not in production routes.

| File | Purpose | Status |
|------|---------|--------|
| `/mockups/dtg-3-step-mockup.html` | DTG 3-step ordering flow mockup | 🎨 Prototype |
| `/mockups/dtg-3-step-complete.html` | DTG 3-step complete state mockup | 🎨 Prototype |
| `/mockups/dtg-location-mockup.html` | DTG location selector mockup | 🎨 Prototype |
| `/mockups/dtg-location-mockup-real-image.html` | DTG location mockup (real image variant) | 🎨 Prototype |
| `/mockups/dtg-location-mockup-with-images.html` | DTG location mockup (with images) | 🎨 Prototype |
| `/mockups/dtg-location-selector-final.html` | DTG location selector (final design) | 🎨 Prototype |
| `/mockups/edit-ruth-mockup.html` | Ruth mockup edit prototype | 🎨 Prototype |
| `/mockups/product-page-complete-mockup.html` | Product page complete mockup | 🎨 Prototype |
| `/mockups/staff-portal-mockup-1.html` | Staff portal mockup variant 1 | 🎨 Prototype |
| `/mockups/staff-portal-mockup-2.html` | Staff portal mockup variant 2 | 🎨 Prototype |
| `/mockups/staff-portal-mockup-3.html` | Staff portal mockup variant 3 | 🎨 Prototype |

### Other Active Directories (file-count summary)

These directories contain code but aren't enumerated at file level — list grows on demand.

| Directory | File Count | Contents |
|-----------|-----------|----------|
| `/admin/` | 4 HTML | Announcements admin, BOGO promo admin, universal records admin |
| `/art-tools/` | 3 HTML | AE art dashboard, AE submit art, art approval |
| `/email-templates/` | 7 HTML | EmailJS templates: BCA customer email, xmas bundle, ready, embroidery, sample request, screenprint customer |
| `/employee-bundles/` | 2 HTML | streich-bros-bundle, wcttr-bundle |
| `/policies/` (root-level) | 8 HTML | Bundle kitting xmas, customer notification SOP, DTG artwork checklist, LTM fee policy, LTM order decision algorithm, payment terms, retail-vs-wholesale policy, sales office procedures |
| `/richardson-caps/` | 1 HTML + 1 JS | view-combination-caps.html, scripts/richardson-combination-caps-manual.js |
| `/scripts/` | 14 JS | Backfill, validation, prevention, cleanup, doc-freshness, generate-new-products, parse-production-schedule, etc. |
| `/scripts/safety-tools/` | 7 JS | auto-recovery, comprehensive-test-suite, dependency-mapper, error-monitor, file-access-monitor, safe-delete, validate-critical-paths |
| `/templates/` | 4 HTML + 1 JS | Calculator template, email template, emblem email template, laser tumbler EmailJS template, quote service template |
| `/tools/` | 5 HTML | Cap layout mockup, CSS diagnostic, decoration selector mockup, diagnose-css-override, diagnose-search-issue |
| `/vendor-portals/` | 3 HTML | sanmar-credits, sanmar-invoices, sanmar-vendor-portal |
| `/config/` | 1 JS | app.config.js (central configuration) |
| `/temp/` | 1 JS | verify-dtg-pricing.js (likely cruft — verify and remove) |

### Support & Documentation
| Directory | Purpose | Status | Notes |
|-----------|---------|--------|-------|
| `/admin/` | Administrative tools and utilities | ✅ Active | Backend administration |
| `/art-tools/` | Art department tools | ✅ Active | Design utilities |
| `/caspio-tables/` | Caspio database configurations | ✅ Active | Database schemas |
| `/email-templates/` | EmailJS templates | ✅ Active | Quote email templates |
| `/logs/` | Log and generated files | 🚫 Ignored | Not in version control |
| `/memory/` | Claude AI memory files | ✅ Active | API specs only |
| `/mockups/` | Design mockups | ✅ Active | UI/UX references |
| `/node_modules/` | NPM dependencies | 🔧 Generated | Do not modify |
| `/policies/` | Business policies | ✅ Active | Company procedures |
| `/product/` | Product pages | ✅ Active | Product display system |
| `/scripts/` | Utility scripts | ✅ Active | Contains safety-tools/ |
| `/src/` | Server source code | ✅ Active | Node.js backend |
| `/templates/` | HTML templates | ✅ Active | Reusable components |
| `/tests/` | **Automated Testing Suite** | ✅ Active | **Screen print calculator validation** |
| `/tools/` | Development tools | ✅ Active | Build and dev utilities |
| `/training/` | Training materials | ✅ Active | Staff training docs |
| `/vendor-portals/` | Vendor integrations | ✅ Active | External vendor access |

## 🧪 Automated Testing System

**Created:** 2025-10-03
**Purpose:** Comprehensive automated testing for all screen print calculators

### Test Suite Files
| File | Purpose | Status |
|------|---------|--------|
| `/tests/screenprint-calculator-test-suite.js` | Core testing framework | ✅ Active |
| `/tests/screenprint-test-cases.js` | 17 comprehensive test cases | ✅ Active |
| `/tests/screenprint-test-runner.html` | Visual test interface | ✅ Active |
| `/tests/README-TESTING.md` | Testing documentation | ✅ Active |

### Features
- ✅ Automated pricing validation across all calculators
- ✅ Safety stripes functionality testing
- ✅ Dark garment toggle verification
- ✅ Cross-calculator consistency checks
- ✅ Auto-fix suggestions for detected issues
- ✅ Visual test results with export options
- ✅ 17 test cases covering all scenarios

### Test Categories
1. **Basic Pricing** (3 tests) - Fundamental pricing calculations
2. **Safety Stripes** (4 tests) - $2.00 surcharge validation
3. **Dark Garment** (2 tests) - Underbase color addition
4. **LTM Fee** (2 tests) - Minimum order fee logic
5. **Additional Locations** (2 tests) - Multi-location pricing
6. **Color Count** (2 tests) - 1-6 color validation
7. **Complex Scenarios** (2 tests) - Combined features testing

### Embroidery CSV Validator (2026-02)
| File | Purpose | Status |
|------|---------|--------|
| `/tests/embroidery-csv-validator.html` | Drag-and-drop ShopWorks CSV validation tool (size suffix, qty math, fee checks) | ✅ Active |

**Usage:** Open in browser, drag CSV export → instant validation report with pass/warn/fail per row

### Order Validation Tests (2026-02)
| File | Purpose | Status |
|------|---------|--------|
| `/tests/validation/validate-2025-orders.js` | Validate 2025 embroidery orders against pricing system | ✅ Active |
| `/tests/validation/known-vendors.js` | Non-SanMar vendor identification patterns (Carhartt infant, Rabbit Skins added 2026-02-01) | ✅ Active |
| `/tests/validation/2025-orders-validation-report.json` | Generated validation report (not in git) | 📊 Output |
| `/tests/validation/2025-oddballs-recommendations.csv` | **NEW** CSV export of 110 oddball items with recommendations | 📊 Output |

**Run:** `node tests/validation/validate-2025-orders.js`

**Purpose:** Analyzes 6,222 embroidery line items from 2025 to determine:
- Which orders can be priced via the quote builder (service codes + SanMar products)
- Which need manual lookup (non-SanMar vendors)
- Which are oddballs (typos, free-text, comments)

| `/tests/validation/validate-csv-output-paths.js` | Full simulation: 3-CSV join, live API pricing, all 4 output path validation | ✅ Active |
| `/tests/validation/csv-output-paths-report.json` | Generated full simulation report (not in git) | 📊 Output |

**Run:** `node tests/validation/validate-csv-output-paths.js` (~3 min, 1134 API calls)

**Purpose:** Joins 3 CSV data sources (line items, ODBC orders, stitch counts), reconstructs 1,261 embroidery orders, calls live pricing API, validates all 4 output paths (UI, PDF, Save, Clipboard). Compares computed pricing vs ShopWorks actuals.

### Data Seeding Scripts (2026-02)
| File | Purpose | Status |
|------|---------|--------|
| `/tests/scripts/seed-classified-items.js` | Seed service codes & non-SanMar products to Caspio | ✅ Active |
| `/tests/scripts/cleanup-duplicate-products.js` | Remove duplicate non-SanMar products | ✅ Active |
| `/tests/scripts/cleanup-duplicate-service-codes.js` | Remove duplicate service codes | ✅ Active |
| `/tests/scripts/update-embroidery-costs.js` | **NEW** Update AL/CB/CS/FB records in Embroidery_Costs | ✅ Active |
| `/tests/scripts/add-cemb-service-codes.js` | **NEW** Add CEMB/CEMB-CAP service codes | ✅ Active |
| `/tests/scripts/cleanup-embroidery-costs.js` | **NEW** Delete duplicates, add missing DECG-FB 1-7 (2026-02-04) | ✅ Active |
| `/tests/scripts/update-ctr-pricing-linear.js` | **NEW** Update CTR pricing with linear $/1K model (2026-02-04) | ✅ Active |
| `/tests/scripts/sync-shopworks-service-codes.js` | **NEW** Sync all 28 ShopWorks service codes to Caspio (2026-02-14) | ✅ Active |
| `/tests/scripts/batch-price-audit-report.js` | **NEW** Batch service pricing audit — compares SW vs 2026 prices across all fixtures. `--html` generates dashboard report (2026-02-15) | ✅ Active |

**Run:** `node tests/scripts/seed-classified-items.js`

**Seeded Data (Feb 2026):**
- **8 service codes:** CDP, SPSU, Transfer, SPRESET, Shipping, Freight, Name/Number, emblem
- **26 non-SanMar products:** Richardson caps (6), Callaway polos (2), Cutter & Buck (3), Hi-Vis safety (4), Polar Camel drinkware (4), Specialty items (5), Other (2)

**Embroidery Pricing Consolidation (Feb 2026):**
- **`update-embroidery-costs.js`:** Adds AL (5 tiers), AL-CAP (5 tiers), CB (5 tiers), CS (5 tiers), FB (1 record) = 21 records
- **`add-cemb-service-codes.js`:** Adds CEMB (5 tiers), CEMB-CAP (5 tiers) = 10 service codes
- **`update-ctr-pricing-linear.js`:** Updates CTR-Garmt, CTR-Cap, CTR-FB with linear $/1K pricing (Feb 2026)

## 🔄 Update Protocol

### When to Update This File
1. **After creating** any new file
2. **After deleting** any file
3. **After moving** files to different folders
4. **Weekly** review for orphaned files

### How to Update
1. Add new files to appropriate section
2. Mark deprecated files with removal date
3. Update statistics section
4. Update last modified date at top

### Validation Commands
```bash
# Find files not listed in ACTIVE_FILES.md
find . -type f -name "*.js" -o -name "*.html" | grep -v node_modules | while read file; do
  grep -q "$file" ACTIVE_FILES.md || echo "Not documented: $file"
done

# Find files listed but not existing
grep -o '`[^`]*`' ACTIVE_FILES.md | tr -d '`' | while read file; do
  [ -f ".$file" ] || echo "File missing: $file"
done
```

---

**Maintenance Note:** This file is critical for preventing code chaos. Keep it updated!

*Generated after comprehensive cleanup that removed 71+ orphaned files*