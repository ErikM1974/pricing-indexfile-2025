# Catalog CX overhaul — state at 2026-08-25 laptop-shutdown stopping point

**Goal (Erik):** best customer experience on the main catalog — customers must FIND products
easily and be moved to BUY. Done when finding + buying is easy.

## ✅ Done

### 1. Root cause of "customers can't find things": catalog search was 10–22s PER TERM
- `/api/products/search?q=` ran five `LIKE '%term%'` scans (incl. PRODUCT_DESCRIPTION) + a
  groupBy over the **181,104-row** `Sanmar_Bulk_251816_Feb2024` table per uncached term.
  Measured live: hoodie 21s · polo 16s · tshirt 18s · "safety green" 10s. Repeats cache (~0.4s),
  but autocomplete fires ONE UNCACHED TERM PER KEYSTROKE → customers effectively never saw
  results ("Searching…" forever, observed live).
- **Fix implemented + committed: proxy `ddbf2e6` on develop — NOT DEPLOYED.**
  `src/utils/style-search-index.js`: one grouped fetch of the ~4,513 distinct styles (30-min TTL,
  stale-while-revalidate), searched in memory (~2ms), handed to Caspio as `STYLE IN (top 300
  ranked)`. Same five fields, same phrase semantics. Rank: exact style > style prefix > style
  substr > title > brand > keywords/desc (cap cuts desc-tier noise first — a relevance
  improvement for broad terms). No match → `STYLE='__NO_MATCH__'` keeps pipeline/response shape.
  Jest lock: `tests/jest/style-search-index.test.js` (11 tests, green).
- **Verified locally** (proxy on :3002): builds 4,513 styles from 5,039 grouped rows; first-page
  parity with production on hoodie/polo/carhartt/beanie/PC54; never-seen terms 0.1–0.7s, broad
  keyword terms worst ~4s (vs 10–22s).
- 🔴 **Two traps hit + hardened** (now in code comments): (a) paging a Caspio groupBy WITHOUT
  `q.orderBy` silently skipped ~420 styles — `q.orderBy: STYLE` added; (b) `strict: true` on the
  fetch so a truncated build throws and keeps the stale index instead of silently hiding products.

### 2. Live customer walk of /catalog (findings list — mostly NOT yet fixed)
- 🔴 **Cold landing = alphabetical "A4" brand wall.** Default sort name_asc over 12,413 rows —
  first screen is entirely obscure A4 athleticwear. Needs top-sellers/curated-first landing.
- 🔴 **Price whiplash:** card + Quick View say "from $34.50 with logo" (CTA205) = the hidden
  **72+ tier**; PDP opens at $38.00 (24-pc default), $42 under 24. "from" needs qualification
  or the 24+ anchor.
- 🟡 "Showing 1–38 of **12,413 products**" — count is style×price-split groups; real distinct
  styles ≈ 3,400 active (4,513 incl. discontinued). Inflated + may confuse pagination.
- 🟡 Cold-cache landing spinner measured **28s** (proxy listing caches cold + Heroku dyno);
  warm ~0.6s. Index deploy + (optionally) listing warm-up will largely cure.
- 🟡 Known, still unfixed: Quick-View hardcodes `Math.ceil` (`catalog-search.js:1707`) vs
  API-driven `roundCapPrice` → $24.50 PDP vs $25.00 QV possible on caps (MEMORY.md Rule-9 item).
- ✅ Solid already: rich filter panel (category/brand/price/color/size with counts), shareable
  URLs (?category=Caps), live per-size stock on PDP, PDP price table + sticky CTA bar, mobile
  2-col grid no overflow, 44px tap targets.
- PDP has NO bridge to the pay-online express storefronts (/custom-tees, /custom-caps) for
  styles those channels sell — quote-only path shown even when buy-now exists.

### 3. Multi-lens audit workflow was MID-RUN at shutdown
- `catalog-cx-audit`, runId `wf_4fb7e80e-115` — 8 audit lenses (flow, pricing, layout, PDP,
  live data, CRO, IA, mobile/perf) → adversarial verify → synthesis (prioritized quick wins +
  layout proposal). Read-only, idempotent.
- Resume (same session): `Workflow({scriptPath:'<session>/workflows/scripts/catalog-cx-audit-wf_4fb7e80e-115.js', resumeFromRunId:'wf_4fb7e80e-115'})`.
  If the resume cache is gone, just re-run the script fresh — it audits, it doesn't mutate.

## ⏭️ Next steps on return (in order)
1. Resume/re-run the audit workflow → read synthesis.
2. **Proxy: add index warm-up at boot** (first search after a dyno restart currently pays the
   ~40s build; call `getStyleSearchIndex(fetchAllCaspioPages)` fire-and-forget after listen).
3. Deploy the proxy (Erik's go — no /deploy skill for proxy; it's git push heroku from that repo).
4. App-repo quick wins per synthesis: landing sort/curation, "from $" honesty, QV `Math.ceil`
   parity fix, count label. Then `/deploy` the app.
5. Bigger layout decisions → present proposal to Erik.
