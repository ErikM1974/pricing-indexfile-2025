# CSS standardization — project brief for a fresh Claude session (written 2026-09-07)

> **Hand this file to a new chat.** Kickoff prompt is at the bottom. Everything the session needs is here or
> one click away; it should not have to rediscover the repo. Read `CLAUDE.md` first (the Top 9 rules apply
> to every file this project touches), then this.

## 1. Why (Erik, 2026-09-07)

Every page was built one at a time, each with its own stylesheet, palette and spacing. Erik's question:
*"if we clean up the css since all the pages were built one off, will it make creating new pages easier
and consistent?"* — yes: a new page should link a token file + a component file and write a few page rules,
not copy a 40 KB stylesheet and edit it. Brand/layout changes become one edit. The linter keeps it that way.

## 2. Where it stands — measured 2026-09-07 (`python scripts/css-census.py --top 12`)

| Measure | Now | Target |
|---|---|---|
| Stylesheets served (outside dist/vendor/archive/tests) | 295, 4,567 KB | fewer, smaller; no page-private copy of a shared thing |
| Files using `var(--…)` | 215 | all |
| Files with raw hex colours | 266 | 0 outside the token file (stylelint enforces) |
| Distinct hex colours | 1,355 | the token palette (~40) |
| `!important` | 3,182 | only the generated `quote-builder-inline.css` (127 rules, deliberate) + a handful with a comment |
| Rule bodies repeated in 5+ files | 224 | 0 — absorbed by components/utilities |
| Font stacks | inherit 262 · JetBrains Mono 135 · `var(--font-display)` 132 · Inter 83 · Poppins 67 | two tokens: `--font-sans` (Inter), `--font-mono` (JetBrains Mono); Poppins is a per-page legacy |

Most-used colours today (they ARE the palette, name them as tokens): `#e5e7eb` 385 · **`#4cb354` 383 (the NW
green in the wild)** · `#6b7280` 362 · `#ffffff` · `#d1d5db` · `#dc2626` (danger) · `#1f2937` (ink) · `#f3f4f6` ·
`#92400e` / `#f59e0b` / `#fef3c7` (warning trio) · `#64748b`. Other greens in use: `#2e5827`, `#1a472a`, `#2d5f3f`,
`#3a7c52` — pick one primary + one dark, map the rest.

Most-duplicated rule bodies: `grid-template-columns:1fr` ×96 (mobile collapse), the box-sizing reset ×50,
`opacity:1;transform:translateY(0)` ×32 (reveal animation), `display:flex;align-items:center;gap:…` ×19–20 in
three gap sizes, `opacity:.5;cursor:not-allowed` ×26 (disabled). These become utilities.

## 3. What already exists — build on it, do not start over

- **`shared_components/css/staff-dashboard/tokens.css`** (242 lines, 131 variables, `@layer reset, tokens,
  base, components, utilities, overrides`, oklch palette, a discrete type ramp `--font-size-xs…`, space, motion,
  z-index, focus, density). Loaded by 5 pages today. **This is the seed of the app-wide token file** — promote
  it to `shared_components/css/tokens.css`, keep the dashboard importing it, and add what the public pages need
  (the customer-facing green/ink/greys from § 2). The `@layer` order statement must stay the FIRST stylesheet
  a page loads (see its header comment).
- Other partial token sets to reconcile INTO it: `quote-builder-shell.css` (74 vars), `quote-builder-common.css`
  (47), `modern-enhancements.css` (74), `customer-portal.css` (67), `ae-nav-v2.css` (51), `sticker-pricing-page.css`
  (85), `policy-detail.css` (48), `rep-crm.css` (42). Same names where they mean the same thing; alias the old
  names for one release, then delete.
- **Rule-3 clean everywhere**: no `<style>` blocks or decorative inline styles exist (locked by
  `tests/unit/repo-hygiene-final.test.js`). `quote-builder-inline.css` is GENERATED (127 hash classes with
  `!important` — inline-attribute precedence) — leave it; it goes away only when the builders' id-heavy rules
  are refactored, which is the LAST family.
- Families by directory (stylesheet counts): `shared_components/css` 87 · `dashboards/css` 56 · `pages/css` 45
  · `training/css` 23 · `pages/forms` 18 · `calculators/css` 11 · `staff-dashboard` 9 · `admin/css` 4.
  Page-structure families (from the landmark pass): the 14 `g-header` webstore pages share one template; the
  18 forms share `form-sheet`; training pages share `nav-header + .container`; dashboards share
  `minimal-header + tab-container`.

## 4. The plan (in order; each step ships on its own)

1. **Tokens.** `shared_components/css/tokens.css` from the dashboard file + § 2 palette. Names: `--color-brand`,
   `--color-brand-dark`, `--color-ink`, `--color-muted`, `--color-line`, `--color-surface`, `--color-danger`,
   `--color-warning{,-bg,-ink}`, `--font-sans`, `--font-mono`, `--space-1…8`, `--radius-{sm,md,lg}`,
   `--shadow-{sm,md}`, `--z-{nav,modal,toast}`. Document each in the file. Ship with zero visual change.
2. **Components + utilities.** `shared_components/css/components.css` (header, nav, card, button + variants,
   table, form field, badge, modal, toast, empty state) and `utilities.css` (the § 2 duplicates: flex rows in
   three gaps, stack, grid collapse, disabled, reveal). Drawn from what the pages already render — the
   migration is mostly renaming.
3. **Page template + linter.** `templates/page-template.html` (tokens + components + one page stylesheet,
   header/main/footer landmarks, versioned assets, `data-call` delegator — everything the locks demand) and
   **stylelint** (`stylelint-config-standard` + `color-no-hex` outside tokens.css + `declaration-no-important`
   with the generated file ignored) wired into `npm test` via a jest wrapper or `package.json` `lint:css`. Widen
   ESLint from the 3 paths in `package.json` `lint` to all browser JS at the same time.
4. **Migrate by family**, smallest blast radius first, each family one deploy:
   forms (18) → training (23) → the webstore/SEO pages (14 + `pages/css`) → dashboards (56) → calculators (11)
   → quote builders + `shared_components/css` LAST (money path; `quote-builder-inline.css` retired here).
   Per family: before-screenshots → change → `node scripts/build.js` → after-screenshots → `python
   scripts/screenshot-diff.py` → 0 differing pixels (timestamps/async excepted, re-checked in a browser) →
   unit + e2e locks → `/deploy` → live spot-check → census re-run → memory note.

## 5. Tooling that already works (proved on 96 pages, 2026-09-06)

- Screenshots: `tests/e2e/builder-screenshots.spec.js` — `SHOT_TAG=before|after`, `SHOT_PAGES_FILE=<txt, one
  repo-relative page per line>`; 1440×900 full page, staff session, animations frozen. The e2e config drives the
  installed Chrome locally (`channel: 'chrome'`) because this network blocks Playwright's browser download.
  ⚠️ The two `employee-bundles/*.html` pages are served at ROOT paths (`/streich-bros-bundle.html`).
- Diff: `python scripts/screenshot-diff.py` (Pillow). Census: `python scripts/css-census.py`.
- Page list: the served-page set is `git ls-files '*.html'` minus the `HTML_SKIP` regex in
  `tests/unit/repo-hygiene-final.test.js`; the landmark pass's list is reproducible from that.
- Deploy: `/deploy` (`.claude/skills/deploy`) — gates on tests, cache-busts `?v=` for every changed CSS/JS, `--no-ff`
  release on `main`, Heroku, verify. Work on `develop`. Never hand-roll.
- Gotchas that bit before (LESSONS 2026-09-05/06): files mix CRLF/LF (rebuild per line, keep endings); a
  scripted rewrite must keep the original quote character; never pin a `?v=` prefix in a test; bash heredocs
  mangle backslashes — write scripts with the Write tool; a green suite proves nothing about a URL no test loads —
  read the live failed-request list; `body >` and sibling selectors are what a wrapper/rename breaks — grep
  before renaming a class.

## 6. Rules that do not bend

- CLAUDE.md Top 9: no inline code, external CSS only, kebab-case, ACTIVE_FILES.md updated on every create/
  delete/move, no hardcoded hosts, pricing untouched (this project never edits a `*-pricing-service.js`).
- Every family deploy is pixel-verified before it ships. "It looks the same to me" is not a verification.
- Erik is price-sensitive on tokens: no Workflows/ultra/deep-research unless asked; Sonnet for routine renames.
- Memory: one fact, one home — progress log in `memory/DASHBOARD_REVIEWS_2026-09.md` (or a new
  `CSS_STANDARDIZATION_LOG` section here), gotchas in `LESSONS_LEARNED.md` (≤300 lines), one-liner in MEMORY.md.

## 7. Kickoff prompt (paste into the new chat)

> Read `CLAUDE.md`, then `memory/CSS_STANDARDIZATION_PLAN_2026-09.md` end to end. Run
> `python scripts/css-census.py --top 12` and confirm the § 2 numbers. Then do Step 1 (tokens file) and Step 3
> (page template + stylelint + wider ESLint) as one deploy with zero visual change, verified with the
> screenshot diff on the five pages that load the dashboard tokens plus ten public pages. Report the census
> after, then proceed family by family per § 4 without asking, following the per-family verification loop.
> Never touch pricing services or the generated `quote-builder-inline.css` until the builders family. Record
> progress in this plan file and MEMORY.md after every family.

## 8. Progress log (newest first)

### 2026-09-07 — Palette pass 2, storefront + catalog LIVE (`v2026.09.07.20`)

- **Scope:** the 22 customer-facing pages (home, catalog, product, brands, fall catalog, carts, custom tees/caps/3-day,
  stickers, banners, quote/inquiry forms, sample checkout, customer login/portal/product, golf product) and the
  sheets they load. Erik 2026-09-07: "you have the authority to make it look even better".
- **What changed on purpose:** (1) the sample-cart drawer, when closed, is now also `visibility: hidden` — it used to sit
  in the scrollbar gutter (15 px on screen at 1440, visible with overlay scrollbars and in every screenshot) and its
  buttons stayed keyboard-focusable while off-screen; (2) the drawer's legacy `#333` / `#666` text greys are the
  storefront inks (`--store-ink`, `--store-ink-soft`), so the drawer reads like the rest of the storefront.
- **What changed with no visible effect:** three storefront accent tints that several pages shared are named once
  (`--store-green-300`, `--store-green-200`, `--store-rush-tint`), and 13 page variables within the near threshold of a
  token were mapped to it (product page orange tints, fall-catalog green tint, customer portal/product tints, the
  recommendations sheet's green).
- **Deliberately left alone:** the catalog's colour-family filter swatches (`--cs-*`), the hi-vis safety colours
  (`--ssr-lime/-orange/-yellow`), the home hero accents and the customer portal's gold ramp — they represent
  products or a deliberate accent, not the brand.
- **Verification:** before/after shots of all 22 pages, diffs reviewed page by page; e2e (a11y, money path) green.
- **Storefront review verdict:** the 2026 storefront is already a coherent design system (cream paper, forest green,
  rush orange, Bricolage display); the remaining page variables are page-specific by design. No further "look"
  changes were warranted without a design brief.

### 2026-09-07 — Palette pass 1, app-wide collapse LIVE (`v2026.09.07.19`): 30 ramp steps named, 604 page variables gone

- **What:** 30 hex values that 8 to 35 sheets each declared as their own page variable are now steps of the token
  ramps (`--red-200/300/500`, `--amber-200/300/400/900`, `--orange-200`, `--green-200/300/500/600/700`,
  `--emerald-100/200/500/700/800`, `--blue-200/800`, `--violet-600`, `--indigo-700`, `--brand-400`, `--brand-mid`) plus
  the legacy palettes named for what they are (`--bs-danger/-success/-warning/-warning-ink`, `--material-green-100/-900`).
  `collapse-page-vars.py` then removed every page variable whose value equals a token and rewrote its uses: 147 sheets,
  604 variables, 1,105 uses — value-identical by construction (every page that loads a migrated sheet loads
  tokens.css, locked).
- **Verification:** unresolved `var()` references counted before and after: 434 → 434, none new. A 31-page sample
  across every family screenshot before/after: 29 identical; the christmas-bundles top strip and one DTG builder block
  are transient (a second after-shot equals the before-shot pixel for pixel). Gates + e2e green.
- **Why first:** it is the cheapest census win with zero look change — the remaining page variables are now the
  genuinely page-specific colours, which is what the storefront design pass needs to see.
- **Next:** the storefront + catalog design pass (deliberate look changes, reviewed page by page).

### 2026-09-07 — Tail batch + dead sheets LIVE (`v2026.09.07.18`): 12 sheets, 12 pages migrated; 18 sheets + 2 fixtures deleted

- **Tail = the 12 sheets no family covered:** `admin/css/*` (4 sheets, 3 admin pages), `dashboards/production-shifts/styles.css`,
  `dashboards/reports/price-audit-report.css`, `employee-bundles/css/*` (2), `tools/custom-tees-calibrate.css`,
  `vendor-portals/css/*` (2 sheets, 3 pages), `calculators/quick-quote/dtf-prints-prototype.css`. 458 colours →
  84 exact / 113 near / 61 far as 39 sheet-scoped variables; the two vendor-portal sheets lost ten byte-identical
  `--gray-*` definitions each. 9 pages gained the tokens link (12 of 12 now).
- **Verification:** all 12 pages screenshot pixel-identical before/after through the static server (the admin pages
  redirect under the staff session, so every tail page was shot statically — layout and chrome, no live data).
  Two lint findings fixed by hand: stylelint's number fixer had turned `oklch(55.0% …)` into `oklch(55.% …)` (an
  invalid value — the page was re-shot after the fix, still identical), and three empty flag-row rules were removed.
- **Dead sheets deleted (Erik, 2026-09-07: "get rid of the dead sheets"):** 18 stylesheets, ~17,000 lines, that no page,
  script, server route or `@import` referenced (verified by path, basename and stem search): `laser-tumbler-styles`,
  `screenprint-manual-fix`, `webstores-styles`, `cart-styles`, `gallery-styles`, `main-redesign`, `main`,
  `modern-search-interface`, `pages/css/policies-hub`, `pages/css/utilities`, `pricing-pages-enhanced`, `pricing-pages`,
  `product-styles`, `shared_components/css/contract-pricing-theme`, `dashboard-styles`, `dtg-brand-override`,
  `dtg-quote-builder-extracted`, `dtg-quote-builder` — plus the two `tests/ui/test-dtg-*-layout.html` fixtures that
  linked the last one and that no test ran. ACTIVE_FILES rows marked ❌ Removed (three rows had claimed consumers that
  no longer linked them).
- **Next:** the storefront + catalog palette pass (Erik: "you have the authority to make it look even better").

### 2026-09-07 — Quote builders family LIVE (`v2026.09.07.16`) — the LAST family: 19 sheets, 19 pages

- **Family = the 6 `quote-builders/` pages (4 builders, the monogram form, the screen-print fast quote) + the 13
  calculator, dashboard and storefront pages that share their sheets, and 19 stylesheets (22,006 lines): the
  shell, common, guided, print, share-modal, session, customer-lookup, colour-picker, ShopWorks-import and
  sticker-pricing sheets, the per-builder sheets (dtf, dtg ×3, embroidery, screen-print, monogram, fast quote)
  and the NEW `quote-builder-utilities.css`. No `*-pricing-service.js` touched; parity suites green.
- **The generated `quote-builder-inline.css` is retired.** Its 127 hash classes (`.qbi-xxxxxxx`) became readable
  utilities named by their declarations (`.qb-mt-4`, `.qb-bg-amber-100-p-2-8-r-4-c-amber-800`) in
  `quote-builder-utilities.css`, linked in the same (last) position; 196 class uses rewritten in the three builders.
  Their `!important` stays with a file-level reason: it reproduces the precedence an inline attribute had over the
  builders' id-based rules, and a screenshot cannot see the modal/step/error states that depend on it — retiring
  the flags means refactoring those id rules builder by builder (Brand Standards → Decisions, follow-up).
- **Colours:** 2,293 hex uses → 1,159 exact / 682 near / 452 far, the far ones 205 sheet-scoped variables. The
  shell's `--pnw-*` forest palette and common's `--builder-*`/`--color-*` palette alias the tokens ONLY where the
  value is exact; 17 near matches were restored to their exact hex (the builders' cream/birch/fog neutrals are the
  design system, not stray colours). Duplicate token definitions dropped (sticker-pricing-page ×5, common ×2);
  sticker-pricing-page keeps its own 20/24/32 spacing steps (shadow, logged on the brand page).
- **`!important`: 622 flags across the family (296 in `quote-print.css`, 127 utilities, 102 common) — 5 file-level
  reasons, 44 per-line.** Every builder page now links `tokens.css` (13 of the 19 already did).
- **Verification:** 21 shots (19 pages + 2 print): 15 identical; 2 async (webstores chat greeting + quote number,
  quote-management timestamp); the DTG builder differs by 6 corner pixels of a near-mapped border; the DTF and
  screen-print builders (screen + the DTF print, +2 px tall) differ in the safety-apparel recommendations panel —
  a FIX, not a regression: `safety-stripe-recs.css` was migrated to bare `var(--gray-…)` tokens with the webstore
  family (`.8`) while the four builders that also load it had no tokens link, so on those pages the panel had rendered
  transparent with an inverted pill since that release. The tokens link restores the designed look (the same the DTF
  calculator shows). A repo-wide audit found one more such page (`calculators/quick-quote/dtf-prints-prototype.html`,
  now linked) and `tests/unit/css-tokens.test.js` locks it: no page may load a `CSS_LINT_SCOPE` sheet without `tokens.css`.
  Gates: unit, e2e (a11y, money path), `test:parity` 84/84, `test:parity:surfaces` green.
- **Census after:** see the final census in § 9.

### 2026-09-07 — Staff pages + customer portal batch LIVE (`v2026.09.07.14`): 45 sheets, 46 pages

- **Family = the 45 `pages/*.html` not in the storefront list + `vendor-portals/sanmar-vendor-portal.html`
  (it loads `vendor-portal.css`), and 45 stylesheets: every remaining `pages/css/*.css`, the four page-level
  sheets in `pages/`, `product/styles/product.css` (also loaded by the root product page and the golf product
  page) and four shared widgets (company-contact-picker, garment-submit-form, product-thumbnail-modal,
  universal-cart-header — the first two also load on the AE dashboard). `quote-print.css` waits for the
  builders family (one builder links it). The two EmailJS template pages have no stylesheets and were left alone.
- **Colours:** 3,324 hex uses → 1,650 exact / 1,023 near / 651 far, the far ones now 342 sheet-scoped
  variables. Token definitions that duplicated the token file byte-for-byte were removed (fifteen in
  `jds-mockup-creator.css`); six sheets keep their own `--radius-sm/-md` or `--shadow-*` values that shadow
  the token on their pages (3-day-tees, custom-caps, custom-tees, quote-audit, quote-view, product.css) and
  `jds-mockup-creator.css` keeps nine — logged on the brand page, not moved.
- **`!important`: 298 flags — 7 sheets carry a file-level reason (art-request-detail, garment-designer,
  invoice, policy-detail, quote-audit, quote-view, embroidery-contract-pricing), 56 flags a per-line one.**
  Eight sheets carry a file-level `no-duplicate-selectors` reason (appended rules; merging reorders the cascade).
  `font-family-no-missing-generic-family-keyword` now ignores `Font Awesome*`: icon glyphs are private-use
  codepoints and no fallback family renders them.
- **Two deliberate look changes, both recorded on the brand page:** the garment designer's page ink
  (`--text: #22301c`) is KEPT exact — the near token (`--store-ink`) was a shade darker on every heading
  (the diff caught it: 351 px on one heading). The mockup-library header gradient and back-link now use the
  brand greens and storefront rule colour (all three stops within the near threshold; the 398 px the diff
  flagged are sub-pixel text fringes over the slightly darker gradient — verified with a fresh before-shot
  from a HEAD worktree, which matched the original before-shot pixel for pixel).
- **Verification:** 49 shots (46 pages + root product page, golf product page, AE dashboard): 46 identical;
  the 3 that differ are the data-entry guide's "last loaded" timestamp, which product photo the DTG page's
  grid loaded, and the mockup-library header above. Gates + e2e green.
- **Tooling:** a re-run of the tokenizer over an already-migrated sheet rewrote its own page-theme block into
  `--x: var(--x)` self-references (invalid in a browser); the tokenizer now skips its own block and reuses
  existing page variables, and value continuation lines are joined before tokenizing (memory/LESSONS_LEARNED.md).
- **Census after:** 300 sheets · 4910 KB · 287 use var(--) · 227 raw-hex files (theme blocks included) · 808 distinct hex (1023 before the batch) · 3072 !important · 212 duplicated bodies
- **Next:** the quote builders family (`quote-builder-shell.css`, `sticker-pricing-page.css`,
  `quote-print.css`, the generated `quote-builder-inline.css` retirement) — money path: parity suites +
  `test:parity:surfaces` after, no `*-pricing-service.js` changes.

### 2026-09-07 — Calculators family LIVE (`v2026.09.07.12`): 58 sheets, 26 pages

- **Family = the 25 calculator pages + `pages/dtg-compatible-products.html` (it loads two of the same shared
  sheets) and 58 stylesheets: every `calculators/**` sheet plus the shared `universal-*`, `calculator-*`,
  `dtf-*`, `screenprint-*`, contract-pricing and pricing-widget sheets that ONLY calculators load. Two sheets
  the quote builders also load (`quote-builder-shell.css`, `sticker-pricing-page.css`) wait for the builders
  family — nothing on the money path's builder pages changed.
- **Colours:** 2,261 hex uses across the 58 sheets → 955 exact / 723 near / 583 far, the far ones now sheet-scoped variables declared once. Definitions that duplicated the token file byte-for-byte were removed (eleven `--gray-*` and a `--radius-sm` in embroidery-pricing-all); nine sheets keep their own `--shadow-sm`/`--shadow-md` values, which shadow the token on their pages.
- **`!important`: 446 flags — 14 sheets carry a file-level reason (the override stacks), 75 flags a per-line one.** This family is the override-stack archetype — one DTF page layers
  `dtf-calculator.css` + `dtf-calculator-fix.css` + `dtf-outline-override.css` + `dtf-toggle-pricing.css`, and
  `force-green-theme.css` exists only to `!important` CSS variables over JS-injected styles. Sheets with more
  than ten flags carry a file-level reason; the flags come out only when a page is untangled as a whole
  (recorded on the Brand Standards page as follow-up work, page by page).
- **Verification:** 26 pages: 18 identical; the 8 that differ are timestamps and badge counters (cap-embroidery, cheat-sheet, purchasing form, emblem), the christmas-bundles top strip, the webstores chat greeting (generated text and quote number), and two pages whose product photo and colour data loaded after the before shot (DTG, laser tumbler). The tokenizer had mangled three `#add-to-cart` id selectors (a three-letter id read as a hex colour); repaired, the two pages that use them re-shot pixel-identical, and the scan found no other case in any family. Gates + e2e (a11y, money path) green; `npm run test:parity:surfaces` 5 passed (every live tier on every customer calculator equals the engine).
- **Census after:** 300 sheets · 4832 KB · 279 use var(--) · 231 raw-hex files · 1023 distinct hex · 3073 !important · 211 duplicated bodies
- **Next:** the `pages/css` staff pages batch (art-request-detail, mockup-detail, quote-view, policy-detail,
  invoice…), then the quote builders + the generated `quote-builder-inline.css` retirement.

### 2026-09-07 — Dashboards family LIVE (`v2026.09.07.10`): 78 sheets, 70 pages

- **Family = every `dashboards/*.html` (60) + the queue-dashboard system they share (`art-hub.css` on 41 pages,
  `dash-shell.css` on 34), the staff dashboard's own nine layers, every `dashboards/css` sheet (58) and the ten
  shared widgets the dashboards load (kanban, transfer-actions, mockup-ruth, invoice viewer, toasts, box-label
  print, names-numbers…). Ten `pages/` staff pages that load those widgets got the tokens link too and were
  screenshotted (their own big sheets — art-request-detail, mockup-detail, quote-view, policy-detail, invoice —
  are the next batch).
- **Colours:** 1,965 hex uses in dashboards/css alone (827 exact / 697 near / 441 far); across all 78 sheets 1,821 exact / 1,012 near / 713 far, the far ones now 386 sheet-scoped variables. `art-hub.css`'s ten `--gray-*` definitions were byte-identical to the token file's and
  were removed; its `--state-*` and `--surface-*` names became aliases of the ramps. The people/department
  colours the pages already carried (`--art-theme: #009900 / #6b46c1 / #981e32`, workspaces' `--f-*` families)
  now read `var(--color-dash-theme)`, `var(--color-ruth)`, `var(--color-ae)` … — the colour code is code.
- **Open decision (brand page):** `art-hub.css` keeps its own spacing/radius/shadow scale (4-based to 32, radius
  4/8/12/16) which differs from the token file's (seeded from the staff dashboard: to 96, radius 6/10/14/20).
  On art-hub pages the page copy wins (loaded after tokens), so nothing moved; unifying the two scales is a
  visible layout change across 41 staff pages and is Erik's call — recorded in the Decisions log as OPEN.
- **`!important` 577 flags across the 78 sheets, none removed this pass** — the 49 `[hidden] { display: none !important }` copies (the repo's own rule:
  the attribute must beat any display rule) carry per-line reasons; three sheets that override Caspio DataPage
  markup (`digitized-designs`, `sanmar-inbound`, `company-numbers`) carry a file-level reason.
- **Verification:** 70 pages: 61 identical; the 9 that differ are 'loaded h:mm' timestamps and badge counters, one gallery thumbnail that had not loaded in the before shot, and three async-rendered pages (the production-shifts React app, Roland supplies, Supacolor orders) whose before shot was the pre-render viewport — their repeat after-shots are pixel-identical to each other. Gates + e2e green.
- **Census after:** 300 sheets · 4755 KB · 256 use var(--) · 237 raw-hex files · 1122 distinct hex · 3073 !important · 210 duplicated bodies (the size grew ~130 KB: one-line reasons on 577 flags and 386 declared theme variables — the price of legibility)
- **Next:** calculators (11 sheets), then the `pages/css` staff pages batch, then the quote builders + the
  generated `quote-builder-inline.css` retirement.

### 2026-09-07 — Webstore / SEO family + Step 2 components LIVE (`v2026.09.07.8`)

- **Family = 39 public pages, 19 sheets** (every page with the `g-header` template or `nwca-2026-core.css`, plus
  index/brands/product): 476 hex uses → 266 exact / 128 near / 82 far → 0 raw hex outside `:root` theme blocks.
- **Storefront 2026 as tokens.** `nwca-2026-core.css`'s palette (cream paper, forest greens, safety-orange rush,
  Bricolage Grotesque/Public Sans) became the `--store-*` and `--font-store-*` group in `tokens.css`; its own
  `--paper/--ink/--green-*/--rush-*` names are aliases now — the brand page shows the customer-facing system
  next to the staff one. `--gray-900 #111827` added (the SEO headline ink).
- **golf-tournament-showcase.css** (the g-header template's 2,542-line base, 15 pages) defined seven `--gray-*`
  variables byte-identical to the token file's → deleted (tokens load first, 69 uses resolve the same).
- **Step 2 shipped:** `shared_components/css/components.css` (chrome, card, btn, alert, badge, field, table, modal,
  toast, empty-state, pager; NWCA-2026-GUIDE names; `components` layer) + `utilities.css` (the census duplicates
  as `.u-*` classes; `utilities` layer). First consumers: the page template and the Brand Standards page (its
  own sheet shrank to swatch/table rules). Legacy pages adopt these family by family — a legacy `.card` linked
  blindly would inherit properties it never set.
- **`!important`:** all 8 in the family kept with `stylelint-disable-next-line` reasons — `[hidden]` must beat
  any display rule (×4), `prefers-reduced-motion` kill switches (×2 files), one legacy blog CTA colour.
- **Verification:** 39 pages: 32 identical; index differs by a dynamic footer link, product.html by live inventory counts, and five brand pages only where SanMar CDN product photos were not delivered during the batch run — a probe through both the static server and server.js showed those images complete and visible with the new CSS, and two single-page re-shoots matched their before shots at 0 px. Unit/dom/a11y/lint/e2e green.
- **Orphans flagged, not deleted:** `pages/css/utilities.css` (2025-11 3-Day-Tees helpers) and `pages/css/policies-hub.css`
  (superseded by v2) — no consumer; the hygiene lock's orphan census covers JS only. Erik's `git rm`.
- **Census after:** 300 sheets · 4621 KB · 246 use var(--) · 248 raw-hex files · 1301 distinct hex · 3073 !important · 215 duplicated bodies
- **Next:** dashboards (56 sheets + the staff pages under `pages/css`: art-request-detail, mockup-detail, quote-view,
  policy-detail, invoice…), then calculators, then the quote builders (+ `quote-builder-inline.css` retirement).

### 2026-09-07 — Training family + Brand Standards page LIVE (`v2026.09.07.6`)

- **Erik's mid-course instructions (2026-09-07):** "you have permission to make the CSS better", "a brand standards
  page you can follow", "save the brand standards under the Administration section … apply them as you improve the
  CSS … a working document, update as necessary." So from this family on the loop has THREE diff classes named
  up front: identical, threshold-neutral (≤16/channel), and **deliberate standard-driven changes** — each of those
  is recorded in the page's Decisions log and here.
- **Brand Standards page** `dashboards/brand-standards.html` (+ `css/brand-standards.css`, `js/brand-standards.js`):
  Administration → Marketing card; in `ADMIN_DEFAULT_PAGES` (admin-only by default); first page built from
  `templates/page-template.html`. Rendered LIVE from `tokens.css` (fetches the SOURCE path — the hashed copy is
  minified, comments gone): colour ramps + semantic names, people/department colours, type, space/radius/shadow,
  motion/z-index, plus static Rules, Building-a-page and a dated DECISIONS LOG. 🔑 The e2e staff session is role
  `staff`, so admin pages cannot be screenshotted by the spec — verify admin pages live in Chrome.
- **Tokens added:** people/department colours (`--color-steve/-ruth/-bradley/-floor/-ae` + dark/light/tint) and
  the staff sub-page chrome `--color-dash-theme/-dark/-bg` (= dash-shell.css `--dash-theme`, #090/#060/#f0f9f0).
- **Training (26 sheets, 27 pages):** every page links tokens.css first. Ten pages shared a byte-identical
  nine-rule nav chrome → `training/css/training-shared.css` (extracted; four maroon variants unified by force);
  **brand pass applied**: that chrome is now the Training Center's green gradient (`--color-dash-theme` →
  `-dark`) instead of the AE dashboard's maroon — one rule re-themes ten pages. Three coral-styled guides
  (art-approval, google-review, lead-sheet) keep their own chrome (different markup). Every other hex became a
  token (exact/near) or a page-scoped `--page-<hue>` variable declared once in the page's `:root`
  (stylelint-disable block) — 190 distinct colours, 528 "far" uses, now named in one place per page; the
  consolidation to the palette is a design pass Erik can do one block at a time.
- **`!important` 120 → 15.** `nwca-language-reference.css`'s 117-flag print block moved to the END of the
  file (source order now wins); the 15 that remain override inline `style=""` attributes in that page's markup
  (`[style*=…]` selectors) — nothing but `!important` beats an inline style; documented with a disable/enable
  pair. get-to-know-erik's 2 and sales-coordinator-manual's 1 were plain source-order fixes.
- **stylelint.** Three more rules off with reasons: `keyframes-name-pattern` (names referenced from animation
  shorthands/JS), and `no-duplicate-selectors` disabled per FILE on three legacy sheets whose duplicates predate
  this work (merging would reorder the cascade). `--fix` reviewed as before. Scope now 48 files.
- **Verification.** 27 pages × screen + print: 36/54 identical; the 18 that differ = the ten re-themed nav
  headers (bounding boxes 0–76px from the top, eyeballed), team-match-game's random shuffle (two "after" shots
  differ from each other by 22k px), and the language-reference print view after the `!important` repair
  (0 differing pixels once the 15 inline-style overrides kept their flag). Unit 188 suites, dom, a11y, lint 0 errors / 99 warnings, e2e a11y + money-path green.
- **Step 2 status:** `training-shared.css` is the family's component layer; the app-wide `components.css` still
  waits for the webstore family (where `nwca-2026-core.css`'s primitives live).
- **Census after:** 298 sheets · 4594 KB · 240 use var(--) · 252 raw-hex files · 1332 distinct hex · 3073 !important · 216 duplicated bodies

### 2026-09-07 — Forms family LIVE (`v2026.09.07.4`): 18 stylesheets, 0 raw hex, 3 documented `!important`

- **What moved.** 17 forms + `nwca-form-shared.css` link `tokens.css` first; every hex became `var(--…)` (93 uses
  → 0). The family's deliberate print palette (green sampled from the official PDFs, neutral inks that print
  true) became 7 named tokens — `--print-green/-green-dark/-ink/-ink-soft/-line/-red/-gold` — and the
  info banner became the app's `--color-info-bg/-line/-ink` (sky trio); everything else mapped to the palette
  within the diff threshold (≤16 per channel). Two pages OUTSIDE the directory load the family sheet
  (`pages/request-a-quote.html`, `pages/webstore-inquiry.html`) — found by the cache-bust, not by the family
  list; they got the tokens link too. 🔑 Always grep the whole tree for a family stylesheet before calling
  the family list complete.
- **Deliberate consolidations (the only pixels that changed, eyeballed in crops):** `#666` → `--print-ink-soft`
  (d=17) on two labels, `#333` → `--print-ink` on the PTO signature line — 4 of 34 shots, all on those elements.
- **`!important` 6 → 3.** `.size-chip input` now outranks `.form-table td input` through
  `.form-table td .size-chip input`; the three print rules (`.contacts-dropdown`, `.swatch-grid`, `.no-print`)
  stay, each with a `stylelint-disable-next-line` reason (print must beat JS-toggled state).
- **stylelint.** `--fix` rewrote value-identical syntax (`rgba()` → `rgb(… / %)`, `#ffffff` → `#fff`,
  `max-width:` → `width <=`, `page-break-inside` → `break-inside`, `-webkit-/-moz-appearance` dropped — one
  duplicate deduped by hand); reviewed in `git diff -U0`. Three rules are off with reasons in
  `stylelint.config.mjs`: `no-descending-specificity` (would reorder the cascade), `selector-id-pattern`
  (camelCase ids are wired into JS), `declaration-block-single-line-max-declarations` (house style); `clip` is
  allowed for `.sr-only`. All 18 sheets are in `CSS_LINT_SCOPE`.
- **Verification.** 17 pages × screen + print (`SHOT_MEDIA=print` added to `builder-screenshots.spec.js`):
  30/34 identical, the 4 = the consolidations above; the two outside consumers before/after through a HEAD
  worktree; unit 188 suites, dom, a11y, lint 0 errors / 99 warnings, e2e a11y + money-path green.
- **Step 2 not started here.** The forms' shared sheet already IS the family component layer; components.css +
  utilities.css get their first real consumer with the training family (`nav-header + .container`).
- **Census after:** 296 sheets · 4,575 KB · 224 use `var(--)` (+8) · 252 raw-hex files (−15) · 1,348 distinct
  hex (−7) · 3,179 `!important` (−3) · 226 duplicated bodies (+2: tokenizing made five `.assist-hint` icon rules
  byte-identical — that is a utility waiting to be absorbed, not a regression).

### 2026-09-07 — Step 1 + Step 3 shipped as ONE deploy (`v2026.09.07.3`), zero visual change

- **Tokens.** `shared_components/css/tokens.css` = the `@layer` order statement + everything the dashboard seed
  had (type ramp, `--nw-*`, space, radius, motion, z-index — values untouched) + the § 2 palette as ramps
  (`--brand-50/100/500/600/700/800` = #f0fdf4 #e8f5e9 **#4cb354** #409a47 #2e5827 #1a472a; `--gray-50…800`;
  `--slate-*`; `--red/amber/emerald/blue-*`) and the semantic names the plan asked for (`--color-brand`,
  `-brand-hover/-dark/-deep/-tint`, `--color-on-brand`, `--color-ink/-ink-soft/-muted/-faint`,
  `--color-line/-line-strong`, `--color-surface/-alt/-raised`, `--color-danger/-ink/-bg`,
  `--color-warning/-ink/-bg`, `--color-success/-bg`, `--color-info`, `--shadow-sm/md`, `--z-nav`). Every hex
  carries its census count. `staff-dashboard/tokens.css` is theme-only now (density, dark/light, accent
  overrides, aliases) and the 5 pages that load it link the app file first. **15/15 pages pixel-identical**
  (12 served through server.js + the 3 `tests/ui` fixtures through `scripts/qa-static-server.js` with a scratch
  Playwright config — server.js has no `/tests` mount).
- **Decisions.** Brand = `#4cb354` (383 uses); dark = `#2e5827` (146); deep = `#1a472a` (116). The other greens
  (`#2d5f3f` 111, `#3a7c52` 77, `#16a34a` 74, `#166534` 68, `#22c55e` 60) map to the nearest of those, family
  by family. The 2026 storefront set (`nwca-2026-core.css`: `--paper/--ink/--green-*`, 25 pages, cream +
  forest, Bricolage/Public Sans) is a different design language — NOT folded in; reconcile in the webstore
  family. Person/department colours (`DESIGN_COLOUR_CODE.md`) stay page-local, never brand tokens.
- **Page template.** `templates/page-template.html`: tokens → (components/utilities when Step 2 lands) → ONE
  page CSS → `app.config.js` + `data-call-delegator.js` + ONE page JS; header/main/footer; labelled; versioned;
  class vocabulary = `NWCA-2026-GUIDE.md` (btn, card, alert, field, table-wrap/data-table, empty-state) so
  Step 2's components.css has one name set. Locked by `tests/unit/css-tokens.test.js`, which also locks: layer
  order is the file's first statement, no token defined in both token files, app tokens before dashboard
  tokens on every page that loads them.
- **stylelint.** `stylelint.config.mjs` = standard + `color-no-hex` (off only in the two token files) +
  `declaration-no-important` (`quote-builder-inline.css` ignored) + BEM-tolerant `selector-class-pattern`; font
  names exempt from `value-keyword-case`. Scope ratchet = `CSS_LINT_SCOPE` in `scripts/lint-css.js` (today:
  the two token files; each family's stylesheets are ADDED when it migrates, never removed). Runs as
  `npm run lint:css`, in CI's lint job, and as `tests/unit/css-lint.test.js` under `test:unit` — so `/deploy`
  Step 0.6 gates on it. Standard's value-identical rewrites to know about: hue `150deg`, `rgb(34 197 94 / 12%)`,
  `#fff`, one declaration per line, blank line before a rule.
- **ESLint widened to ALL browser JS** (`eslint . --max-warnings 99`). STRICT scope unchanged (+ `scripts/lint-css.js`).
  LEGACY scope = `js.configs.recommended` minus `no-undef` (1,088 findings in 146 files) and `no-unused-vars`
  (843 in 206) — classic scripts share `window` globals across files; those two need a per-file `/* global */`
  audit and are their own ratchet. The 9 rules that fired (99 findings: useless-escape 43, case-declarations
  19, prototype-builtins 12, redeclare 9, empty 8, unreachable 3, control-regex 2, irregular-whitespace 1,
  unused-labels 1) are warnings under the cap: fix some → lower the cap; never raise it. 30 ESM files are
  declared in `LEGACY_ESM`. Measured before the split: 2,119 findings in 294 of 410 files.
- **Census after this deploy:** 296 stylesheets · 4,572 KB · 216 use `var(--)` · 267 raw-hex files (the new
  token file is one of them, by design) · 1,355 distinct hex · 3,182 `!important` · 224 duplicated bodies — the
  § 2 baseline plus the token file, as intended: nothing migrated yet.
- **Next:** forms family (18 pages, `form-sheet`), and Step 2 (`components.css` + `utilities.css`) ships with
  it as its first consumer.

## 9. Final census — 2026-09-07, after the last family (`v2026.09.07.16`), next to the § 2 baseline

| Measure | § 2 baseline | Final | What the number means now |
|---|---|---|---|
| Stylesheets served (outside dist/vendor/archive/tests) | 295, 4,567 KB | 300, 4,968 KB | + `tokens.css`, `components.css`, `utilities.css`, `training-shared.css`, `brand-standards.css`, `quote-builder-utilities.css`; − `quote-builder-inline.css`. Larger because every `!important` and every one-off colour now carries a written reason or a named variable. |
| Files using `var(--…)` | 215 | 293 of 300 | the 7 without are link-orphans or the tail below |
| Files with raw hex colours | 266 | **30** outside the token files and the `:root` theme blocks (226 if the theme blocks count) | 12 are loaded by pages outside the plan's families, 18 are link-orphans (below) |
| Distinct hex colours | 1,355 | 725 | nearly all now sit inside the sheet-scoped `:root` theme blocks; the 12 most-used colours in the wild are tokens or theme values |
| `!important` | 3,182 | 3,066 | every flag carries a reason — per line, or a file-level reason on a documented override stack (the calculators' fix/override sheets, `quote-print.css`, `invoice.css`…); the generated sheet's 127 hash rules are now readable utilities. Removing flags is per-page design work, listed on the Brand Standards page |
| Rule bodies repeated in 5+ files | 224 | 222 | `components.css` + `utilities.css` exist for NEW pages; legacy duplicates were deliberately not rewritten (pixel-identical mandate) |
| Sheets under stylelint (`CSS_LINT_SCOPE`) | 0 | 271 | a ratchet — a sheet never leaves; `npm run lint:css`, CI, and `tests/unit/css-lint.test.js` |
| Pages loading `tokens.css` | 0 | 218 of 242 — every page that loads a migrated sheet | locked by `tests/unit/css-tokens.test.js` |

**Eight releases:** foundation `v2026.09.07.3` · forms `.4` · training + Brand Standards `.6` · webstore + components `.8`
· dashboards `.10` · calculators `.12` · staff pages + customer portal `.14` · quote builders `.16`.

**Remaining tail — DONE in `v2026.09.07.18` (12 sheets, all pages pixel-identical). Was:** `admin/css/*` (4 sheets,
3 admin pages), `dashboards/production-shifts/styles.css`, `dashboards/reports/price-audit-report.css`,
`employee-bundles/css/*` (2), `tools/custom-tees-calibrate.css`, `vendor-portals/css/*` (2 sheets, 3 pages),
`calculators/quick-quote/dtf-prints-prototype.css`. One small batch with the same pipeline (before-shots →
tokenize → lint → after-shots → diff) finishes them.

**Link-orphans — DELETED in `v2026.09.07.18` on Erik's instruction (18 sheets, ~17,000 lines, plus two dead `tests/ui` fixtures). Were:**
`laser-tumbler-styles`, `screenprint-manual-fix`, `webstores-styles`, `cart-styles`, `gallery-styles`,
`main-redesign` (4,345 lines), `main` (named only in a `server.js` comment), `modern-search-interface`,
`pages/css/policies-hub` + `pages/css/utilities` (flagged 2026-09-07), `pricing-pages-enhanced`, `pricing-pages`,
`product-styles`, `shared_components/css/contract-pricing-theme`, `dashboard-styles`, `dtg-brand-override`,
`dtg-quote-builder-extracted`, `dtg-quote-builder` (2,115 lines).

**Open decisions for Erik (also on the Brand Standards page):** the art-hub vs token spacing/radius scale (41 queue
pages); the sticker pricing page's own spacing steps; retiring the builders' inline-precedence `!important`
(an id-rule refactor, builder by builder, on the money path).
