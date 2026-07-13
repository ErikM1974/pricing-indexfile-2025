## v2026.07.13.12 (2026.07.13)

- feat(home): surface Custom Safety Stripe Apparel on the homepage
- seo(safety): keyword-optimize meta description + keywords for hi-vis search
- feat(brand): refresh favicon to NWCA circle/tee logo + add apple-touch-icon
- Deploy v2026.07.13.12: cache-bust nwca-2026.css (.duo-safety band + 5-col svc-grid)

## v2026.07.13.11 (2026.07.13)

- feat(seo): rebuild /custom-safety-apparel around screen-printed safety-stripes program
- feat(seo): expand safety-stripe design menu (14 layouts) + visible not-ANSI disclaimer

## v2026.07.13.10 (2026.07.13)

- feat(seo): Custom Bella+Canvas landing page + clean URL for golf tournament page
- feat(seo): golf tournament page — canonical, JSON-LD, cross-links + clean-URL inbound links

## v2026.07.13.9 (2026.07.13)

- feat(seo): Custom Port Authority + Port & Company brand landing pages
- feat(seo): 5 brand landing pages — CornerStone, North Face, Gildan, Eddie Bauer, TravisMathew

## v2026.07.13.8 (2026.07.13)

- fix(a11y): expose aria-expanded on brand landing mobile menu button (WCAG 4.1.2)
- Merge develop into a11y fix branch (bring in new brand pages)
- fix(a11y): add aria-expanded baseline to custom-sport-tek + custom-new-era
- chore(cache-bust): bump custom-carhartt.js ?v= to 2026.07.13.8 on 7 brand pages

## v2026.07.13.7 (2026.07.13)

- fix(seo): align FAQPage JSON-LD with visible FAQ copy on 4 brand pages
- feat(seo): Custom OGIO + District brand landing pages

## v2026.07.13.6 (2026.07.13)

- feat(seo): Custom New Era brand landing page (/custom-new-era)
- feat(seo): Custom Sport-Tek brand landing page (/custom-sport-tek)

## v2026.07.13.5 (2026.07.13)

- feat(seo): Custom Nike brand landing page (/custom-nike) — Dri-FIT polo families + fleece/caps/tees grid w/ real order stats (NKDC1963 = 1,700+ embroidered), swoosh/premium-gift angle, FAQ + CollectionPage/ItemList/FAQPage schema; Brands dropdown routes Nike → landing; sitemap + drawer/footer links

## v2026.07.13.4 (2026.07.13)

- feat(seo): Custom Richardson brand landing page (/custom-richardson) — 112-family + trucker/rope cap grid w/ real order stats (112 = 7,800+ decorated), leather/laser-patch decoration section, real customer showcase, FAQ + CollectionPage/ItemList/FAQPage schema; Brands dropdown routes Richardson → landing page; sitemap + drawer/footer links; reuses Carhartt landing CSS/JS

## v2026.07.13.3 (2026.07.13)

- fix(nav): click-to-open mega dropdowns (Products/Brands) — replaces hover. Kills 'diagonal death' entirely, works on touch/tablet, never opens by accident; nav-dropdown.js disclosure (toggle, outside-click/Escape close, one-at-a-time, aria-expanded), CSS drops :hover open. Verified: click open/close, hover no-op, panel hit-testable, aria syncs, 0 console errors
- perf(nav): eliminate mega-menu open delay — idle-prefetch brand list on requestIdleCallback so the Brands dropdown is warm before first open (was ~3s API fetch on fresh page); pairs with proxy /api/all-brands cache

## v2026.07.13.2 (2026.07.13)

- feat(nav): Carhartt discoverable from homepage — Brands dropdown routes Carhartt to /custom-carhartt (BRAND_LANDING_PAGES map, extensible), footer Shop column link; flyout cache-busted

## v2026.07.13.1 (2026.07.13)

- feat(seo): Custom Carhartt brand landing page (/custom-carhartt) — static indexable 18-style grid with real order stats, FAQ + CollectionPage/ItemList/FAQPage schema, .net educational cross-link; + /sitemap-pages.xml (core pages) in robots, drawer/footer links

## v2026.07.12.12 (2026.07.12)

- fix(masthead): homepage search box crushed by 8-item menu — Corporate site moves to util-strip, search gets 190px floor, p1/p2 tiered demotion + quote-badge :has relief (verified 1680/1200/1050/mobile, zero overflow)

## v2026.07.12.11 (2026.07.12)

- feat(seo): PDP 'This style on our blog' block — /api/blog-product-map (live-derived from post bodies, self-maintaining) + related-posts.js; fix client SEO rewrite clobbering SSR method-aware titles + duplicate Product schema (client now defers when SSR head present)
- Deploy v2026.07.12.11: cache-bust product-2026.{js,css} + related-posts.js

## v2026.07.12.10 (2026.07.12)

- docs(memory): Caspio q.distinct-ignored + unordered-groupBy-pagination gotcha; archive resolved staff-backdoors entry
- docs(memory): lesson — Caspio v3 unordered pagination drops rows; proxy-wide q.orderBy sweep (36 sites/10 routes, proxy 3ef35ee)
- feat(product-seo): decoration-method-aware titles — tees get 'Screen Printed & DTG', polos/outerwear 'Embroidered', caps 'Embroidery & Patches', performance 'Screen Printed & DTF' (matches style+method search queries)
- fix(seo): self-host favicon — cdn.caspio.com is robots-blocked so Google SERPs showed a generic globe; 48x48 PNG + PNG-in-ICO at root routes, 153 pages repointed
- Merge remote-tracking branch 'origin/develop' into claude/adoring-feistel-7404e2
- docs(memory): dedupe the two pagination lessons into one entry (both sessions wrote one; 296 lines, under the 300 cap)

## v2026.07.12.9 (2026.07.12)

- feat(seo): Organization schema w/ sameAs → nwcustomapparel.net (entity stitching)

## v2026.07.12.8 (2026.07.12)

- feat(seo): product pages visible to search — hybrid-SSR heads + Product schema + /sitemap-products.xml (569 styles)

## v2026.07.12.7 (2026.07.12)

- perf(pdp): fetchpriority=high on gallery hero (pairs with proxy gzip + cache deploy)

## v2026.07.12.6 (2026.07.12)

- feat(dashboard): Blog Editor link in Administration section

## v2026.07.12.5 (2026.07.12)

- feat(seo): Google Search Console ownership proof route

## v2026.07.12.4 (2026.07.12)

- feat(blog): server-rendered blog + staff editor — SEO-first, posts in Caspio, publish without deploys

## v2026.07.12.3 (2026.07.12)

- feat(public): customer lead forms — Request a Quote + Company Store Inquiry + roster in footer
- Deploy v2026.07.12.3: cache-bust public-form + inbox assets

## v2026.07.12.2 (2026.07.12)

- fix(cc-auth): print fits ONE Letter page — compact print layer

## v2026.07.12.1 (2026.07.12)

- feat(forms): Credit Card Authorization 2026 — PCI-safe twin replaces the 2015 PDF
- Deploy v2026.07.12.1: cache-bust forms-inbox assets

## v2026.07.11.8 (2026.07.11)

- feat(forms): Quick Quote ↔ AE intake round-trip — send engine price back to the row with provenance
- feat(ae-intake): printable per-size price line — 'Per pc: std $83.00 · 2XL $85.00 ×5 …' under the size chips
- feat(forms): batch 2 — 7 fill-online forms: onboarding, team roster, webstore request, credit app, tax-exempt cert, PTO, injury report
- Deploy v2026.07.11.8: cache-bust ?v= (quick-quote, ae-order-intake, forms-inbox)

## v2026.07.11.7 (2026.07.11)

- fix(forms): AE form hotfix — swatch grid [hidden] override, QQ deep-link path + quick mode

## v2026.07.11.6 (2026.07.11)

- feat(forms): refinement batch — dynamic sizes+upcharges, contacts v2, swatches, dates, design lookup, QQ deep-link, autofill+autosave
- refactor: retire legacy Order Form — remove button, app, and dead routes
- Deploy v2026.07.11.6: 10 files (compare-pricing.html,dtg-pricing.html,manual-pricing.html...)

## v2026.07.11.5 (2026.07.11)

- feat(forms): ops batch — 8 fillable PDFs + QC/Spoilage/Maintenance twins + AEO ShopWorks push UI

## v2026.07.11.4 (2026.07.11)

- feat(forms): AE Order Intake fill-online twin — customer + SanMar assists, auto-math, AEO saves

## v2026.07.11.3 (2026.07.11)

- feat(forms): Forms Inbox + Caspio-saved submissions + samples tracker + box label + customer lookup

## v2026.07.11.2 (2026.07.11)

- feat(forms): 3 more fillable twins (artwork request, name personalization, sample checkout) + shared form framework

## v2026.07.11.1 (2026.07.11)

- docs(memory): wave 8 — official 2026 org chart embedded + Team-widget link live r1622
- docs(memory): wave 8b — org chart coded (maintainable HTML replaces image as canonical)
- feat(forms): Forms Library page + fillable garment drop-off twin + 5 form PDFs
- chore(git): mark *.pdf binary in .gitattributes — prevent EOL normalization corrupting form PDFs

## v2026.07.10.9 (2026.07.10)

- docs(memory): wave 7 — booklet-perfect handbook PDF live r1621
- feat(dashboard): View Org Chart (2026) link in the Team widget dropdown

## v2026.07.10.8 (2026.07.10)

- feat(handbook): booklet-perfect PDF — logo cover, punch margins, zero ghost pages (28pp)
- docs: repair handbook-pdf ACTIVE_FILES rows (shell-substitution ate backtick paths)

## v2026.07.10.7 (2026.07.10)

- docs(memory)+data: wave 5 — handbook compliance additions published (7/7 verified)
- data(policy-migration): wave-3 snapshot — RETIRE? cleared, HR compliance-gap queue added
- feat(policies): reading-first typography + print stylesheet for ALL hub policies; booklet-quality handbook PDF

## v2026.07.10.6 (2026.07.10)

- docs(memory): v2026.07.10.5 live (r1618) + tracker admin-gated via Staff_Page_Access
- data(policy-migration): wave-2 snapshot — Erik Q&A cascade applied (RETIRE? 15→5, hub 138)
- docs(memory): HR reorg wave 2 — Erik Q&A cascade shipped (hub 138, creds scrubbed)
- feat(training): Training Center role-track directory + 2-category nav (Office Assistant folded in)

## v2026.07.10.5 (2026.07.10)

- docs(memory): Caspio platform findings from image-uploads build + training claude.md entry
- docs(memory): HR/staff-dashboard 2-category reorg — SweetProcess classification project (2026-07-10)
- docs(memory): HR reorg batch 1 reviewed — 9 discuss resolved, live hub sales-tax 10.1% bug found
- docs(memory): HR reorg trust mode — 3 live hub fixes (tax 10.2, BofA), tier system CORE/ERIK/AUTO
- feat(dashboards): Policy Migration tracker — SweetProcess→hub project status page (admin nav)

## v2026.07.10.4 (2026.07.10)

- feat(dashboards): SanMar Web Services cheat sheet (admin-only) + reference bump to guide v24.5
- chore(training): include SanMar Purchasing Guide page assets (other session's finished work, committed verbatim)

## v2026.07.10.3 (2026-07-10)

- fix(builders): color-picker dropdown escapes table-card clipping (EMB/SCP/DTF)
- docs(memory): LESSONS â€” SW >2MB silent image drop + dropdown clipping; archive duplicate-row entry
- docs(memory): MO reference Â§13 â€” sw.jpg transcode implementation note
- docs(memory): MO reference â€” Designs populate matrix per method + full id_DesignType taxonomy

## v2026.07.10.2 (2026.07.10)

- feat(manageorders-ref): add PULL API models (Orders/LineItems/Tracking/Payments/InventoryLevels) — now 18 models/266 fields, both Swaggers

## v2026.07.10.1 (2026.07.10)

- feat(dashboards): ManageOrders/OnSite API field cheat sheet (admin-only) + Swagger snapshot

## v2026.07.09.19 (2026.07.09)

- types: T4 — lift ALL 38 @ts-nocheck in builders/ (rubric #5 closed)

## v2026.07.09.18 (2026.07.09)

- refactor: burn-down tranche 3 — EMB allowlist EMPTY, ratchet endgame

## v2026.07.09.17 (2026.07.09)

- refactor: burn-down tranche 2 — SCP allowlist EMPTY, EMB 10→5

## v2026.07.09.16 (2026.07.09)

- refactor: deeper burn-down tranche 1 — real-end ratchet measure, DTG done, DTF allowlist EMPTY

## v2026.07.09.15 (2026.07.09)

- polish: A-grade follow-ups F1-F4 — DtgAdapter, DTG combobox ARIA, burn-down, pragma lifts

## v2026.07.09.14 (2026.07.09)

- polish: Builder A-grade Batch 7 — invoice labels, size-constants, styles, a11y

## v2026.07.09.13 (2026.07.09)

- refactor: Builder A-grade Batch 5 — DTG decomposition (5.1+5.2)

## v2026.07.09.12 (2026.07.09)

- feat(dtg): Batch 6 — formula collapse: ONE canonical engine, client delegates

## v2026.07.09.11 (2026.07.09)

- feat(table-audit): live Refresh button — re-pull view/rel/webhook wiring + fieldCount + new/deleted tables via /api/caspio-schema/usage

## v2026.07.09.10 (2026.07.09)

- docs(dtf): update 2 stale HTML comments referencing the deleted dtf-quote-page.js
- feat(dashboards): Caspio Table Audit cleanup tool (admin-only) — 163 tables + usage signals

## v2026.07.09.9 (2026.07.09)

- refactor(dtf): Batch 4.3+4.4 — dtf-quote-page.js migrated into the bundle; quick wins
- refactor(dtf): Batch 4 finale — class → 5 prototype mixins; builders-wide function-length ratchet

## v2026.07.09.8 (2026.07.09)

- docs(caspio): document what Claude CAN/CAN'T create in Caspio (tables/fields YES via script; DataPages/apps UI-only)
- refactor(emb): Batch 3 session 3 — money-engine + review-modal splits; function-length ratchet — BATCH 3 CLOSED

## v2026.07.09.7 (2026.07.09)

- memory: archive 6 old resolved lessons (299→274 lines) — memory-maintain
- refactor(emb): Batch 3.3 bridge diet — 58 consumer-less window bridges deleted
- refactor(emb): Batch 3 session 2 — _saveAndGetLinkInner split + two-way bridge locks

## v2026.07.09.6 (2026.07.09)

- refactor: Builder A-grade Batch 3 session 1 — EMB structure (3.1 + 3.4 + 3.5)

## v2026.07.09.5 (2026.07.09)

- docs(caspio): v4 live-inventory snapshot + spec corrections + schema-introspection build plan (#10)
- docs(caspio): mark integration TODO #10 DONE & LIVE (proxy v890) — no-token schema-introspection endpoints
- docs(caspio-ref): correct bulk-insert response shape to Result[]/Status (live-spec)

## v2026.07.09.4 (2026.07.09)

- fix+test: Builder A-grade Batch 2 — safety net + XXL name preservation

## v2026.07.09.3 (2026.07.09)

- docs: Batch-1 plan status — XXL verdict corrected (Size05 column, suffix-only distinction); tax identifiers flipped v2026.07.09.2
- feat(dashboards): Caspio REST API v4 reference — Erik-only admin viewer + v4 memory docs
- Deploy v2026.07.09.3: cache-bust caspio-api-reference.html

## v2026.07.09.2 (2026.07.09)

- fix: flip ShopWorks tax identifiers to Tax_10.2 / 2200.102 (Erik created the accounts)
- Deploy v2026.07.09.2: cache-bust bumps

## v2026.07.09.1 (2026.07.09)

- docs: BUILDER_A_GRADE_PLAN.md — per-builder A-grade plan from 5-audit research
- fix: Builder A-grade Batch 1 — correctness sweep (SCP bugs, DTF tax collapse, 10.2 sweep, SIZE06 lock)
- Deploy v2026.07.09.1: cache-bust bumps

## v2026.07.08.14 (2026.07.08)

- feat(dtg): carry-over batch — shared error surfaces + accessible catalog modal
- Deploy v2026.07.08.14: cache-bust bumps

## v2026.07.08.13 (2026.07.08)

- feat(a11y): 1.8 stage 2 — accessible-modal engine, live region, skip links, focus-visible, semantic invoice table
- feat(observability): 1.12 — structured JSON request logs with cross-app correlation ids
- docs(roadmap): Phase 2 DEFERRED BY DECISION (Erik, 2026-07-08) — single-shop for now, not blocked
- Deploy v2026.07.08.13: cache-bust bumps

## v2026.07.08.12 (2026.07.08)

- fix(quotes): handle proxy 404 on quote deletes + LESSONS entry
- feat(a11y): 1.8 stage 1 — BOTH axe baselines to ZERO across all 4 builders
- Deploy v2026.07.08.12: cache-bust bumps

## v2026.07.08.11 (2026.07.08)

- feat(testing): 1.14 jsdom DOM suite + 1.9 axe a11y ratchet, wired into CI
- feat(testing): 1.13 Playwright money-path E2E + 1.9 rendered axe ratchet, CI e2e job
- feat(ui): 1.7 stage 1 — 91 inline styles → qb-* utility classes; fields adopt the skin's 44px touch treatment
- Deploy v2026.07.08.11: cache-bust bumps

## v2026.07.08.10 (2026.07.08)

- fix(observability): Sentry init before express require (v8 instrumentation order)

## v2026.07.08.9 (2026.07.08)

- feat(observability): 1.10 — Sentry error tracking, release-tagged + PII-scrubbed (env-gated)
- Deploy v2026.07.08.9: cache-bust bumps

## v2026.07.08.8 (2026.07.08)

- feat(security): 1.3 — vendor all third-party code the builders execute (no more CDNs)
- chore: .gitattributes — vendor/** exempt from EOL normalization (byte-exact upstream diffs)
- Deploy v2026.07.08.8: 7 files (vendored-lib ?v= bumps)

## v2026.07.08.7 (2026.07.08)

- fix(deploy-skill): exclude .claude/worktrees from the cache-bust sweep
- feat(security): 1.4 stage 2 COMPLETE — sink audit done, moved-legacy lint override REMOVED, utils in scope
- Deploy v2026.07.08.7: 4 files (dtf-quote-builder.html, dtg-quote-builder.html, embroidery-quote-builder.html...)

## v2026.07.08.6 (2026.07.08)

- feat(builders): 1.15 shared errors.js — persistent banner + fallback badge; loud-failure primitives
- fix(security): 1.4 stage 1 — escape SCP/DTF suggestion+summary+toast sinks; register escapers in lint
- Deploy v2026.07.08.6: 4 files (dtf-quote-builder.html, dtg-quote-builder.html, embroidery-quote-builder.html...)

## v2026.07.08.5 (2026.07.08)

- feat(security): 1.1+1.2+1.11 — helmet CSP(report-only)+HSTS, exact-match CORS allowlist, /healthz+/readyz+/api/version

## v2026.07.08.4 (2026.07.08)

- feat(dtf): 0.4 DTF decomposition D1 — DTFQuoteBuilder class + output + push -> builders/dtf/ (shell 4,082->164)
- feat(dtf): 0.4/0.5 DTF decomposition D2 COMPLETE — state.js + DtfAdapter + base boot; monolith -> tombstone

## v2026.07.08.3 (2026.07.08)

- feat(scp): 0.4 SCP decomposition S1a — print-config + persistence + product-rows -> builders/scp/ (shell 5,406->2,507)
- feat(scp): 0.4 SCP decomposition S1b — pricing-sync + quote-lifecycle + save-output + push -> builders/scp/ (shell 2,507->618)
- feat(scp): 0.4/0.5 SCP decomposition S2 COMPLETE — state.js + ScpAdapter + base boot; monolith -> tombstone

## v2026.07.08.2 (2026.07.08)

- feat(emb): 0.4 base+adapter — QuoteBuilderBase revived, EmbAdapter drives the page (shell = 289 lines)
- feat(emb): 0.5 quote-model + state migration — the monolith is GONE (EMB page is 100% modules)

## v2026.07.08.1 (2026.07.08)

- docs: A+ resale roadmap for Fable (9-expert grading workflow)
- feat(build): Phase 0.1+0.2 esbuild pipeline — hashed, minified, immutable assets for the 3 quote builders
- feat(config): Phase 0.3 tenant config spine — window.TENANT + APP_CONFIG shim, hardcoded hosts/EmailJS IDs removed from builder path
- refactor(server): Phase 0.3 backend — 23 proxy-host literals → one CASPIO_PROXY_BASE constant
- feat(ci): Phase 0.6 CI pipeline + lint/typecheck gates + Rule-6 hardcoded-literal guard
- chore(builders): 0.4 base audit — delete dead quote-builder-core.js + INTEGRATION-EXAMPLE.js, drop DTF's zombie base tag
- feat(emb): 0.4 extraction #0 — Service_Codes fees → builders/emb/pricing.js (strangler seam proven)
- feat(emb): 0.4 extraction #1 — design-search modal cluster → builders/emb/design-search.js (986 lines out)
- feat(emb): 0.4 extraction #2 — service-pricing-review modal → builders/emb/spr-modal.js (941 lines out)
- chore(emb): 0.4 cluster #9 audit — DECG stitch modal is dead code, deleted (200 lines + markup)
- feat(emb): 0.4 extraction #3 — ShopWorks import flow → builders/emb/shopworks-import.js (2,012 lines out)
- feat(emb): 0.4 extraction #4 — draft/edit-load persistence → builders/emb/persistence.js (1,195 lines out)
- feat(emb): 0.4 extraction #5 — output/diagnostics → builders/emb/output.js (780 lines out)
- feat(emb): 0.4 extraction #6 — save + ShopWorks push → builders/emb/save-push.js (918 lines out)
- feat(emb): 0.4 extraction #7 — quote lifecycle (reset/fees/discounts) → builders/emb/quote-lifecycle.js (643 lines out)
- docs(emb): checkpoint plan + memory at 8 extracted modules (pre-cluster-5)
- feat(emb): 0.4 extraction #8 — the hot pricing path → builders/emb/pricing-sync.js (1,795 lines out)
- feat(emb): 0.4 extraction #9 — logo-config UI → builders/emb/logo-config.js (378 lines out)
- feat(emb): 0.4 extraction #10 — product-rows mega-cut; ALL CLUSTERS DONE, monolith = 728-line shell
- docs(emb): plan/ACTIVE_FILES/GUIDE entries for extraction #10 (all clusters done)
- Deploy v2026.07.08.1: 11 files (dtf-prints-prototype.html,index.html,quote-management.html...)

## v2026.07.07.10 (2026.07.07)

- feat(quote-builders): logo status chips — On file / New / TBD (all 3 builders)
- Deploy v2026.07.07.10: 4 files (dtf-quote-builder.html,dtg-quote-builder.html,embroidery-quote-builder.html...)

## v2026.07.07.9 (2026.07.07)

- fix(quote-builders): Caspio 400 on blank dates (SCP save outage) + Save-as-PDF button
- Deploy v2026.07.07.9: 4 files (dtf-quote-builder.html,dtg-quote-builder.html,embroidery-quote-builder.html...)

## v2026.07.07.8 (2026.07.07)

- feat(quote-builders): batch 2 — auto-merge, retry pricing, reprice pill, rush chips
- Deploy v2026.07.07.8: 4 files (dtf-quote-builder.html,dtg-quote-builder.html,embroidery-quote-builder.html...)

## v2026.07.07.7 (2026.07.07)

- docs(memory): lesson — recovery cron silently dead after gating (fixed fc56a3d, 11/21 healed)
- docs(memory): 5-expert quote-builder audit 2026-07-07 (EMB/DTF/SCP) — 62 findings, punch list
- fix(quote-builders): expert-audit wave 1-3 — SCP/DTF/EMB money leaks, endgame, domain gaps
- feat(quote-builders): expert-audit wave 4 — endgame + guided-shell + method switch
- style(quote-builders): expert-audit wave 5 — PNW shell ON, print rebrand, one chrome
- chore(quote-builders): expert-audit wave 6 — dead code, lessons, audit status
- fix(art-hub): box-url follow-up frontend fixes (prior session 2026-07-07, uncommitted)
- Deploy v2026.07.07.7: 6 files (dtf-prints-prototype.html,index.html,customer-product.html...)

## v2026.07.07.6 (2026.07.07)

- style(dashboard): New Quote CTA redesign + drop the card's explainer line

## v2026.07.07.5 (2026.07.07)

- docs(memory): one-door dashboard entry deployed (v2026.07.07.4)
- feat(dashboard): Quick Quote stays findable + dated NEW badge on the CTA

## v2026.07.07.4 (2026.07.07)

- docs(memory): Phase B deployed (v2026.07.07.3)
- feat(dashboard): ONE door into quoting — New Quote launcher (guided-quote entry)

## v2026.07.07.3 (2026.07.07)

- docs(memory): mark guided-quote Phase A deployed (v2026.07.07.2)
- feat(quote-builders): guided-quote Phase B — 4-step Guided Quote shell (trio)
- docs(memory): Phase B built — resume point

## v2026.07.07.2 (2026.07.07)

- docs(memory): mark quote-builder UX P1 batch deployed (v2026.07.07.1)
- feat(quote-builders): guided-quote Phase A — calm the page for AE adoption
- Deploy v2026.07.07.2: 1 files (dtf-prints-prototype.html...)

## v2026.07.07.1 (2026.07.07)

- docs(memory): quote-builder order-entry UX audit 2026-07 — scorecard, verified price risks, P1-P3 recs
- feat(quote-builders): duplicate-row button on SCP + DTF (UX audit P1 #1) + fix EMB duplicate race
- docs(memory): resume point after quote-builder UX P1 #1 (duplicate-row shipped)
- feat(quote-builders): bulk size paste on all 4 builders (UX audit P1 #2)
- feat(quote-builders): clickable quantity nudge on EMB/SCP/DTF (UX audit P1 #3)
- Deploy v2026.07.07.1: 4 files (dtf-quote-builder.html,dtg-quote-builder.html,embroidery-quote-builder.html...)

## v2026.07.06.12 (2026.07.06)

- fix(staff-dashboard): move Quick Access back to the top (above the new widgets)

## v2026.07.06.11 (2026.07.06)

- feat(staff-dashboard): Orders Inbox + Money Collected + Sample Follow-ups + Product Manager; announcements retired

## v2026.07.06.10 (2026.07.06)

- fix(staff-dashboard): revenue widget dead since /api/mo repointing — new URL() needs an origin base

## v2026.07.06.9 (2026.07.06)

- feat(sample-cart): full reskin on the nwca-2026 design system

## v2026.07.06.8 (2026.07.06)

- chore: seed-top-sellers sends X-CRM-API-Secret (admin endpoint is gated); ran 2026-07-06 — 65/68 styles flagged
- feat(samples): Stripe checkout for paid samples — 4th storefront channel
- Deploy v2026.07.06.8: 3 files (catalog.html,sample-cart.html,product.html...)

## v2026.07.06.7 (2026.07.06)

- chore: gitignore svc.json (service-account key — keep out of git)
- feat(catalog): Top Sellers view + sample program consolidation — retire legacy showcase pages
- chore: seed script for IsTopSeller flags + memory/docs for top-sellers consolidation
- Deploy v2026.07.06.7: 2 files (catalog.html,product.html...)

## v2026.07.06.6 (2026.07.06)

- docs: document SCP preview reprice-race fix + archive one resolved lesson
- fix(quote-view): remove dead hardcoded size-upcharge map + legacy renderer (Rule 9 audit)
- Deploy v2026.07.06.6: 1 files (quote-view.html,...)

## v2026.07.06.3 (2026.07.06)

- fix(emb): customer engine HARD-ERRORS on $12/$9 decoration-cost fallback (Rule 4)
- fix: audit findings — quote-view init crash, tax label regression, money-path double-charge + Notes-race hardening

## v2026.07.06.2 (2026.07.06)

- fix: Milton WA sales tax 10.1% -> 10.2% everywhere (DOR-verified 2026-07-06)

## v2026.07.06.1 (2026.07.06)

- docs: online payment go-live checklist complete (templates created, dry run passed)
- docs: Broken Arrow Wear checkout teardown + ranked adoption list (Phase 3 research)
- feat: delivery-promise chips + pickup skips the rep gate (BAW adoptions #1+#2)
- Deploy v2026.07.06.1: 3 files (cache-bust)

## v2026.07.05.9 (2026.07.05)

- fix: pass grand_total to staff deposit-paid email (shared receipt body)

## v2026.07.05.8 (2026.07.05)

- docs: storefront checkout/catalog/funnel proposal (deposit-on-accepted-quote model)
- feat: online deposit checkout on accepted quotes (Storefront Checkout Phase 0+1)
- feat: pay-in-full online payment (DEPOSIT-PCT=100) — pct-aware wording
- Deploy v2026.07.05.8: 2 files (quote-management.html,quote-view.html...)

## v2026.07.05.7 (2026.07.05)

- cleanup: remove departed rep 'Adriyella' from selectable sales-rep dropdowns

## v2026.07.05.6 (2026.07.05)

- cleanup: remove entire Adriyella task/bonus/report suite (she no longer works at NWCA)

## v2026.07.05.5 (2026.07.05)

- docs(memory): EmailJS templates master reference — usage map, orphans, missing-in-emailjs findings
- docs(memory): EmailJS content audit result — all 32 active templates verified clean
- cleanup(emailjs): retire dead Adriyella daily-report + template_stripe stub

## v2026.07.05.4 (2026.07.05)

- fix(hub): art-aging widget 404 — API_BASE already ends in /api on v3, drop the doubled /api/api/artrequests

## v2026.07.05.3 (2026.07.05)

- polish: SCP/DTG duplicate-mode + review fixes + art-search server-gated (v2026.07.05.3)

## v2026.07.05.2 (2026.07.05)

- feat: Tier 1+2 UX batch — 19 improvements across portal, PDP, builders, QM, art hub

## v2026.07.05.1 (2026.07.05)

- docs(memory): quote-accept emails LIVE — both templates created (EmailJS 24-char id cap)
- fix+test+refactor: audit residuals — reorder form reset, numeric ladder lock, QM inline script extracted
- Deploy v2026.07.05.1: cache-bust customer-product.js

## v2026.07.04.6 (2026.07.04)

- fix(emails): staff quote-accept template id → quote_accepted_staff (EmailJS 24-char cap)

## v2026.07.04.5 (2026.07.04)

- docs(memory): artrequests/mockups finding closed (anon 401); secret-only flip deferred (92-site repoint, supervised)
- docs(memory): revert manageorders to secret-or-origin after browser test caught un-repointed callers; add LESSON
- security: repoint remaining ManageOrders callers through /api/mo forwarder
- Deploy v2026.07.04.5: cache-bust 4 files (manageorders caller repoint)

## v2026.07.04.4 (2026.07.04)

- docs(memory): record ManageOrders secret-only flip (residual closed, proxy v878)
- fix(review backlog): remaining MED/LOW code + UX findings across all surfaces
- Merge review backlog: remaining MED/LOW code + UX findings
- Deploy v2026.07.04.4: cache-bust 18 files (review backlog)

## v2026.07.04.3 (2026.07.04)

- feat(quote): quote-acceptance emails (customer receipt + rep alert), fail-soft
- feat(security): route ManageOrders reads through a SAML-authed forwarder (fallback-safe)
- Merge: quote-acceptance emails + airtight ManageOrders forwarder (fallback-safe)
- Deploy v2026.07.04.3: 5 files (ae-dashboard.html,art-hub-ruth.html,art-hub-steve.html,...)

## v2026.07.04.2 (2026.07.04)

- fix(review batch2): session revocation, cart persistence, funnel + quote-view UX
- Merge batch2: session revocation, cart persistence, funnel/quote-view UX
- Deploy v2026.07.04.2: 5 files (index.html,catalog.html,quote-cart.html,...)

## v2026.07.04.1 (2026.07.04)

- fix(review): wrong-money + XSS + UX from post-jun12 review
- docs(memory): record 3 recurring code patterns from post-Jun12 review
- fix(portal): _portalPdCache — cache only successful non-empty rows + 30min TTL
- Merge post-jun12 review fixes (security PII gate, wrong-money, XSS, UX)
- Deploy v2026.07.04.1: 12 files (index.html,ae-dashboard.html,art-hub-steve.html,...)

## v2026.07.01.14 (2026-07-01)

- fix(portal): My Logos images load eager (lazy left them blank below the fold)

## v2026.07.01.13 (2026-07-01)

- docs(portal): My Logos — SanMar stock-photo fallback removed (real proofs only)
- fix(portal): My Logos loads Box proofs DIRECTLY (no double-proxy) — fixes stalled images under page-load concurrency

## v2026.07.01.12 (2026-07-01)

- docs(portal): My Logos lightbox uses full-res Box image (?size=large)
- docs(portal): decision — My Logos proof sheet stays as-is (it's what Steve sends the customer)
- fix(portal): My Logos never shows the SanMar catalog stock photo — real design proofs only

## v2026.07.01.11 (2026-07-01)

- docs(portal): My Logos image+click fixes + 3 gotchas (MAIN_IMAGE=garment, /art-request=staff page, approv regex)
- feat(portal): My Logos lightbox loads the LARGE Box image (?size=large → 1024/full), grid stays 256px

## v2026.07.01.10 (2026-07-01)

- fix(portal): My Logos 'Approved' badge — exact-match status ('Awaiting Approval' was wrongly flagged approved)

## v2026.07.01.9 (2026-07-01)

- docs(portal): My Logos shows approved proof + badge (v2026.07.01.8)
- fix(portal): My Logos shows the real design proof + opens a lightbox (not the staff page)

## v2026.07.01.8 (2026-07-01)

- docs(portal): My Logos Phase 0 SHIPPED + honest correction (Canva filename prefix is likely a design#, not customer id)
- feat(portal): My Logos shows the APPROVED proof per design + an 'Approved' badge

## v2026.07.01.7 (2026-07-01)

- docs(portal): Your Products catalog view (one card/style + swatches) shipped
- docs(portal): My Logos brainstorm + full ID registry (Canva/Box folder ids, key discovery: logos are id-prefixed)
- docs(memory): calculator pricing audit — 30-agent sweep of all 14 live calculators
- docs(portal): My Logos refined design — auto-first hybrid, reference-not-copy, phased (P0 = expose getPortalData)
- fix(calculators): live-source LTM display, delete dead laser code, submit-flow fixes
- feat(portal): My Logos Phase 0 — one 'My Logos' gallery from existing mockups+art (grouped by design)

## v2026.07.01.6 (2026-07-01)

- docs(portal): recs Phase 1 SHIPPED (candidate pool + margin ranking + reward pills); reward $ + accrual pending
- feat(portal): Your Products = one card per style with ordered-color swatches (catalog view)

## v2026.07.01.5 (2026-07-01)

- docs(portal): capture per-customer recs + rewards PROPOSAL (2026-07-01 brainstorm, awaiting Erik's 3 decisions)
- fix(screenprint): quote-ID mismatch + email-failure-masks-save in customer calculator
- feat(portal): per-customer recommendations from the AE playbook pool + reward pills (Phase 1)

## v2026.07.01.4 (2026.07.01)

- fix(screenprint): wire customer-supplied-garment calculator to live pricing engine
- docs(portal): record 2026-07-01 cohesive redesign (unified cards, hero tables, Coming-Soon pair, badge fixes)

## v2026.07.01.3 (2026.07.01)

- feat(portal): cohesive 'Your Account' redesign — unified cards, hero Orders/Invoices, Coming-Soon art/mockups

## v2026.07.01.2 (2026.07.01)

- feat(portal): rebrand to Your Account + re-order color/size picker + Coming-soon recs + simplified order status

## v2026.07.01.1 (2026.07.01)

- docs(portal): Phase 5 reward-dollars foundation SHIPPED + verified (ledger/grant/redeem)
- Memory: archive 3 oldest resolved lessons (259→247 lines) + index the new portal docs
- docs(memory): add catalog/pricing/quote/PDF UX audit + enhancement proposal
- feat(portal): add customer 'Sign In' button to the teamnwca.com masthead → /customer/login + login-page back link

## v2026.06.30.5 (2026.06.30)

- docs(portal): Phase 4 COMPLETE + verified — catalog-in-preview fix + rep request queue
- feat(portal-p5): reward-dollars foundation — portal balance card + redeem-as-request + admin grant/adjust ledger panel

## v2026.06.30.4 (2026.06.30)

- feat(portal-p4): rep re-order request work-queue in the Customer Portals console (Requests tab — list/status/delete/filter)

## v2026.06.30.3 (2026.06.30)

- docs(portal): Phase 4 catalog + re-order SHIPPED — status + remaining fast-follows
- fix(portal-p4): show catalog in staff preview via mirror endpoints + seed recommendations (catalog was hidden in preview)

## v2026.06.30.2 (2026.06.30)

- docs(portal): Customer Portals admin console SHIPPED + catalog/rewards next-phase reuse map
- docs(portal): Phase 4 build plan — personalized catalog + request-to-rep re-order
- feat(portal-p4): personalized catalog (Your Products + recs) + request-to-rep re-order on the customer portal

## v2026.06.30.1 (2026.06.30)

- docs(memory): staff SAML deployed live (release v1473) — login-half verified; next=round-trip test
- debug(saml): log assertion structure on ACS verify failure (temporary)
- Debug SAML assertion structure
- fix(saml): Caspio signs the response wrapper — wantAuthnResponseSigned not assertion
- Fix SAML response-signature validation
- chore(saml): remove temp diagnostic logging; add staff display-name map
- SAML cleanup: remove debug, add name map
- docs(memory): staff SAML SSO verified working end-to-end (v1476); remaining = the flip
- feat(staff-auth): THE FLIP — require SAML session on dashboards; kill forgeable /api/crm-session (#2)
- Staff-auth flip: SAML-gated dashboards, forgeable endpoint removed
- docs(memory): staff-auth flip DONE (v1477) — hole closed, dashboards SAML-gated
- docs(memory): #2 COMPLETE — staff SAML login confirmed working post-flip (v1477)
- docs(memory): refresh resume note — #1 & #2 shipped live; next = #8 durable sessions
- docs(memory): index new Caspio integration docs; /memory-maintain pass
- security(session): fail-closed if SESSION_SECRET missing/default in prod
- docs(security): proxy side-door audit (#9) — 98 open HIGH/CRITICAL endpoints
- docs(security): #9 Phase-1 progress — customer-profile/industry-lookalikes + sales-archive writes gated (live)
- chore(#9): cleanup-service-codes script sends x-crm-api-secret (writes now gated)
- docs(security): #9 Phase-1 Batch 3 — pricing/service-code writes + files DELETE gated (v853)
- security(#9): front-end sends x-crm-api-secret on proxy shipstation writes
- docs(security): #9 Phase 1 COMPLETE (non-Inksoft) — 5 batches gated + verified live
- feat(#8): durable staff sessions via cookie-session (survive deploys)
- docs(memory): #8 durable sessions DONE (cookie-session); #9 Phase-1 complete; refresh resume note
- docs(memory): #5 task-triggers DONE & LIVE; #3 webhook premise found unsound (reframe to #4)
- docs(security): #9 Phase-5 digitized-designs/lookup trimmed (live); Phase-3 reality-check noted
- feat(rbac): derive staff permissions from Caspio Staff_App_Roles (replace hardcoded map)
- docs(rbac): Caspio-driven roles SHIPPED — Staff_App_Roles table, not directory Role field
- feat(rbac): table-driven page access — gate /dashboards by Staff_Page_Access
- docs(rbac): table-driven page access shipped — CLAUDE.md rule + design doc
- feat(rbac): Access-Admin UI — Erik-only control panel for roles + page access
- docs(memory): resume point — RBAC live; Access-Admin UI in 2 open PRs to review/merge
- Merge PR #7: Access-Admin UI (Erik-only roles + page-access control panel)
- feat(rbac): link Access Admin from the staff dashboard Administration section
- docs(memory): Access-Admin UI merged+deployed+live (PRs #7/#2); RBAC fully self-service
- security(rbac): gate SanMar vendor-portal pages (were PUBLIC) via shared table-driven gate
- polish(rbac): branded 403 'Access Restricted' page (NWCA logo, card, personalized)
- docs(memory): branch hygiene RECONCILED — both repos develop=main=deploy=live; proxy UPS features now live
- security(staff-auth): close anonymous page backdoors — %2e gate bypass, ungated sibling mounts + root aliases
- docs(security): record staff-dashboard seal audit + remediation (criticals closed, Phase-3 mapped)
- docs(security): tee up Phase-3 side-door remediation — 4 waves, caller-mapped, ready to run
- docs(security): Wave 1 side-door gates DONE + lesson on path-specific Express auth gates
- feat(portal): magic-link customer login plumbing (Phase 1)
- docs(portal): record Phase 0+1 SHIPPED (magic-link login live, dormant) + Phase 2/3 next
- fix(branding): use the public logo URL — NWCA Logo.png 403s (broken on login + 403 + email)
- feat(portal): Phase 2 — session-scoped portal, closes the enumeration IDOR
- docs(portal): Phase 2 LIVE — session-scoped portal, enumeration IDOR closed (art-email flow kept)
- polish(portal): show the invite's company name on an empty portal (not 'Your Company')
- feat(portal): Phase 3 — Orders + Invoices/Balances sections (session-scoped)
- fix(portal): derive paid amount from cur_Balance (cur_Payments is null in the feed)
- docs(portal): Phase 3 LIVE — Orders + Invoices sections (paid derived from cur_Balance)
- feat(portal): on-screen + downloadable ShopWorks-style invoice (#6)
- docs(portal): record on-screen + downloadable invoice (ownership-checked)
- polish(portal): invoice matches ShopWorks — NWCA address/accounting email, Date Due, Design ID
- fix(portal): embed same-origin logo in invoice PDF + compact layout + UTC date fix
- feat(portal): Customer Portals staff admin console — manage invites (add/enable/disable/delete), CRM lookup, send magic-link, preview portal, Account Rep + My customers filter

## v2026.06.29.3 (2026.06.29)

- docs(memory): add Caspio platform REST v3 (Swagger) capability reference
- docs(memory): fold live entitlement-probe results into Caspio reference
- docs(memory): add Caspio integration build to-do + session resume note
- docs(memory): add Phase 2 authenticated customer portal vision
- docs(memory): verified portal endpoint design (#1) + Phase-2 auth
- feat(portal): gated customer-safe data endpoint (#1 phase 1 — data-minimization)
- docs(memory): portal #1 stage A+B shipped (data-minimization endpoint)
- feat(portal): gate art-request detail customer view (#1 Stage C1)
- feat(portal): gate mockup detail customer view (#1 Stage C2)
- docs(memory): portal #1 Stage C complete (both detail pages gated)
- docs(memory): verified staff-auth design (#2)
- docs(memory): correct staff-auth IdP — company is M365, not Google
- docs(memory): staff-auth IdP resolved — Caspio App Connection (custom SAML)
- docs(memory): commit SAML SP config values for the Caspio App Connection
- feat(nav): add NWCA link to homepage top nav → nwcustomapparel.net
- docs(memory): capture Caspio IdP metadata for staff SAML connection
- docs(memory): capture+validate Caspio IdP signing cert (staff SAML)
- feat(staff-auth): SAML SSO endpoints (#2) — server-verified login via Caspio
- docs(memory): staff SAML SP endpoints built (commit 41e5e93f) — next = env+deploy+test
- Deploy v2026.06.29.3: 3 files (art-request-detail.html,customer-portal.html,mockup-detail.html,...)

## v2026.06.29.1 (2026.06.29)

- fix(safety-recs): show all 9 curated styles in Quick Quote + catalog (was capped at 6)

## v2026.06.28.4 (2026.06.28)

- feat(safety-recs): collapsible accordion (collapsed by default) on all surfaces

## v2026.06.28.3 (2026.06.28)

- fix(safety-recs): scope to screen print + DTF only (not EMB/cap-emb/DTG)

## v2026.06.28.2 (2026.06.28)

- feat(safety-recs): add Quick Quote + customer catalog surfaces

## v2026.06.28.1 (2026.06.28)

- feat(safety-recs): hi-vis garment recommendation cards across the 4 quote builders

## v2026.06.27.1 (2026.06.27)

- Memory: archive 3 resolved DTF/SCP one-time fixes (2026-06-11) to keep LESSONS < 250
- chore: remove dead screenprint-quote-pricing.js
- feat(scp): Vellum + Color Change setup parts in SCP builder + invoice
- Deploy v2026.06.27.1: 4 files (order-form.html,dtf-quote-builder.html,dtg-quote-builder.html,...)

## v2026.06.26.6 (2026.06.26)

- fix(rep-map): Ruthie/Ruth → ruth@ in REP_EMAIL_MAP / REP_MAP (sync w/ proxy)
- Deploy v2026.06.26.6: 4 files (ae-dashboard.html,art-hub-steve.html,art-request-detail.html,...)

## v2026.06.26.5 (2026.06.26)

- Memory: async catch-up + H12 lesson for SanMar recent-completed sync
- fix(art-hub): AE completion notifications — gallery 404, email misroute, resolver
- Deploy v2026.06.26.5: 4 files (ae-dashboard.html,art-hub-steve.html,art-request-detail.html,...)

## v2026.06.26.4 (2026.06.26)

- fix(quote-mgmt): make Refresh Inbound catch-up async (kick off + poll)

## v2026.06.26.3 (2026.06.26)

- Memory: SanMar fast-completing-order sync gap + fix (LESSONS, Order Processing & ShopWorks)
- feat(quote-mgmt): manual catch-up for orders that fall between scheduled SanMar syncs

## v2026.06.26.2 (2026.06.26)

- Memory: pickup note — quote-view size table not syncing from ShopWorks (diagnosis done, both fixes approved, code pending)
- fix(quote-view): mirror ShopWorks size edits on the Quote Management screen

## v2026.06.26.1 (2026.06.26)

- @ Docs: AE Dashboard surfaces mockups 4-6, shipped v2026.06.25.6
- Memory: trim LESSONS toward <250 — reduce 4 duplicated rules to pointers, archive 2
- Memory: reduce EMB falsy-zero recurrence to a pointer — LESSONS now under 250
- Memory: introduce .claude/rules/ path-scoped rules (item 3 of 3)
- feat(quote-view): "Send to Steve" — pre-fill Steve's art form from a synced order

## v2026.06.25.6 (2026.06.25)

- @ AE Dashboard: surface mockup slots 4-6 + responsive 6-slot grid
- Deploy v2026.06.25.6: 2 files (ae-dashboard.html,art-request-detail.html,...)

## v2026.06.25.5 (2026.06.25)

- Deploy v2026.06.25.5: 1 files (QUICK_QUOTE_SCP_REDESIGN_2026-06.md)

## v2026.06.25.4 (2026.06.25)

- Memory: archive 7 oldest resolved one-time fixes from LESSONS_LEARNED
- Memory system: governance doc + CLAUDE.md routing + /memory-maintain skill
- Memory: trim CLAUDE.md back under 200-line budget
- Memory: de-dup Auto-Update routing bullets into the Where-things-go table
- Memory: add resume/status note to MEMORY_SYSTEM.md (session pause 2026-06-25)
- Memory: reconcile divergent wa-sales-tax-rules.md to one canonical copy
- Memory: regenerate INDEX.md + archive 15 zero-reference historical docs
- Memory: mark redesign substantially done; defer 3 optional backlog items
- Quote Mgmt: show ShopWorks order # on the list row
- Merge deployed UPS-delivery-dates (cf56321d) into develop alongside SW# row feature

## v2026.06.25.2 (2026.06.25)

- @ Multi-mockup send: select & send up to 6 mockups from the Send Mockup modal
- @ Docs: mark multi-mockup feature committed + Caspio columns confirmed
- Deploy v2026.06.25.2: 12 files (ae-dashboard.html,art-hub-ruth.html,art-hub-steve.html,...)

## v2026.06.25.1 (2026.06.25)

- Screen Print Quote Builder sleeves

## v2026.06.24.18 (2026.06.24)

- Docs: record SCP-sleeve additional-location feature (v2026.06.24.17)
- Deploy v2026.06.24.18: Quick Quote — screen-print sleeves price PER-SLEEVE (left/right may differ)

## v2026.06.24.17 (2026.06.24)

- Deploy v2026.06.24.17: Quick Quote — screen-print sleeves price as additional locations; DTF sleeve shows ≤5×5" size

## v2026.06.24.16 (2026.06.24)

- docs(lessons): DTF combined/range sizes (vests) — base size 0 upcharge fix + table guidance
- docs(manageorders): per-box receiving-label field map + ship-method gotcha (SanMar inbound)
- Deploy v2026.06.24.16: Quick Quote — print size shown inline on each placement chip (method-aware, no hover)

## v2026.06.24.15 (2026.06.24)

- Deploy v2026.06.24.15: DTF fix — combined/range sizes (vests: S/M, L/XL) now price (base = 0 upcharge); guard test

## v2026.06.24.8 (2026.06.24)

- Deploy v2026.06.24.8: Quick Quote — Line Sheet default + sleeves DTF-only; dashboard 'Updated · Jun 24' badge

## v2026.06.24.5 (2026.06.24)

- Deploy v2026.06.24.5: Quick Quote — note DTG/DTF print sizes per location (LC 4x4, FF/FB 12x16, JF/JB 16x20; DTF bands)

## v2026.06.24.3 (2026.06.24)

- Deploy v2026.06.24.3: Quick Quote — surface DTG 1-11 small-batch fee in line sheet + matrix (probe qty 6)

## v2026.06.24.2 (2026.06.24)

- docs(sanmar-po): SanMar PO Integration plan, field-mapping, onboarding + buildable PO templates
- docs(sanmar-po): wire SanMar PO docs into CLAUDE.md + INDEX.md discovery entry points
- WIP combine: Quick Quote design cleanup + parallel dashboard edits (pre-reconcile)
- Merge remote-tracking branch 'origin/develop' into develop
- Deploy v2026.06.24.2: Quick Quote design cleanup (token scale, sectioned inputs, collapsed-breakdown cards, mobile) + merge SanMar dashboard/PO docs

## v2026.06.23.3 (2026.06.23)

- docs(lessons): log /api/inventory COLOR_NAME-not-CATALOG_COLOR gotcha; archive SCP dark-garment entry to stay under the 300-line cap
- Deploy v2026.06.23.3: Quick Quote — SCP front/back ink split + two-section breakdown, Line Sheet mode (mini-catalog PDF), mode-toggle polish

## v2026.06.23.2 (2026.06.23)

- test: re-lock DTG pricing baselines after the 1-23 -> 1-11/12-23 split
- feat(quick-quote): SanMar blank-stock indicator per color
- Deploy v2026.06.23.2: cache-bust quick-quote (inventory)

## v2026.06.23.1 (2026.06.23)

- feat(quick-quote): rate-card breakdown + expose DTF Medium (catalog + quick quote)
- Deploy v2026.06.23.1: cache-bust quick-quote + pdp-configurator

## v2026.06.22.8 (2026.06.22)

- Doc: prototype resume doc — cap embroidery + 2XL upcharges + inventory check all added (v.5-7); remaining = live cutover
- feat(custom-tees): price storefront off DTG_Store table (decoupled from wholesale)
- Deploy v2026.06.22.8: 2 files (SHIRT_DESIGNER_INTEGRATION_2026-06.md,custom-tees.html,...)

## v2026.06.22.7 (2026.06.22)

- Prints prototype: inventory check — color picker (62 colors, CATALOG_COLOR) + per-size stock from /api/inventory with low/out badges + total; 'Unable to verify' fallback (3 of 3: cap + 2XL + inventory)

## v2026.06.22.6 (2026.06.22)

- Prints prototype: 2XL+ size upcharges — allocate extended sizes (sellingPriceDisplayAddOns), each adds blank upcharge to per-shirt; blended order total + by-size breakdown; suppressed for caps (OSFA)

## v2026.06.22.5 (2026.06.22)

- Doc: prototype resume doc — Screen Print added (ink-colors model, formula + verified); all 4 methods built, remaining = 2XL + cutover
- Prints prototype: cap embroidery — auto-detect cap vs garment by style + Garment/Cap override toggle; cap base/AL/blank + AS-Cap surcharge; Cap front/back labels (CAP + CAP-AL bundles)

## v2026.06.22.4 (2026.06.22)

- Doc: prototype resume doc — EMB added (stitch-count logos, formula + verified values); remaining = SCP + 2XL
- Prints prototype: add Screen Print (4th method) — locations by ink-color count (front +flash, back additional), component-rounded + per-shirt LTM, min-24 guard; all 4 methods now in the unified parts model

## v2026.06.22.3 (2026.06.22)

- Prints prototype: copy + labels reflect all 3 methods (Decoration pricing; Prints↔Logos, +Add print↔+Add logo dynamic)

## v2026.06.22.2 (2026.06.22)

- Doc: PRINTS prototype rollout scope — rounding lives in 4 per-method services (shared chokepoint), EMB/SCP both round-the-total + per-piece LTM today, catalog matrix auto-inherits
- Prints prototype: add Embroidery (3rd method) — logos by stitch count (primary base+surcharge, additional logo AL rate), component-rounded + per-shirt LTM; unified 'parts' model across DTF/DTG/EMB; matrix + live stitch input

## v2026.06.22.1 (2026.06.22)

- Doc: PRINTS_SIZE_MODEL_PROTOTYPE resume doc — size-only/4-name-ladder/component-rounded/per-shirt-LTM/matrix model; decision pending to take live
- Prints prototype: downloadable one-page rate-card PDF (both DTF+DTG, every size × 12/24/48/72) below the matrix; print-to-PDF, both bundles loaded on demand

## v2026.06.21.9 (2026.06.21)

- Prints prototype: add price-break matrix (12/24/48/72 + active qty) — full per-shirt build per quantity for the selected prints; click a row to set qty

## v2026.06.21.8 (2026.06.21)

- Prints prototype: remove the location picker — price is size-only, a print goes anywhere; placement stays a Quote Builder (production) concern

## v2026.06.21.7 (2026.06.21)

- Prints prototype: component-rounded ('round each part') pricing — blank + each print rounded to $0.50, small-batch fee as a per-shirt line item; all-in per-shirt price adds up by hand (model under eval, not live formula)

## v2026.06.21.6 (2026.06.21)

- Prints prototype: ONE shared size ladder (Small/Medium/Large/Jumbo) across DTF+DTG — Medium=DTF-only, Jumbo=DTG-only flagged + disabled; method-neutral footer

## v2026.06.21.5 (2026.06.21)

- Prints prototype: add DTG (size-based, Small/Large/Jumbo) — method toggle; DTG replica verified penny-match vs server canonical pricer

## v2026.06.21.4 (2026.06.21)

- Doc: DTG is size-based too (FF=FB, JF=JB verified live) — EMB/DTF/DTG all price by size, only SCP by location count
- Add DTF Prints prototype: 'logo = size + position' model (DTF-only, noindex, unlinked; prices via live DTFPricingService, no live tool touched)

## v2026.06.21.3 (2026.06.21)

- Doc: Quick Quote per-piece breakdown on result cards (emb serviceLines + print front-only derive)
- Doc: DTF live price reads DTF_Pricing.unit_price + PressingLaborCost (Supacolor_Cost/Margin_Pct/Decoration_Cost are reference-only)
- Deploy v2026.06.21.3: Quick Quote — show DTF transfer-size band (≤5×5"/≤12×16.5") per location on the card (UI only, prices unchanged)

## v2026.06.21.2 (2026.06.21)

- Deploy v2026.06.21.2: Quick Quote — front/back price breakdown on the DTG/SCP/DTF cards (derived via front-only re-price; UI only, prices unchanged)

## v2026.06.21.1 (2026.06.21)

- Deploy v2026.06.21.1: Quick Quote — per-piece breakdown on the embroidery card (garment + main logo, then each additional logo) (UI only, prices unchanged)

## v2026.06.20.15 (2026.06.20)

- Deploy v2026.06.20.15: Quick Quote embroidery — typical-stitch helper + >25K primary-logo under-pricing guardrail (UI only, prices unchanged)

## v2026.06.20.14 (2026.06.20)

- Deploy v2026.06.20.14: designer upload timeouts + accessible modal focus management

## v2026.06.20.13 (2026.06.20)

- Deploy v2026.06.20.13: harden Shirt Designer — proxy-safe inputs, text-engine module + 36 tests, toolbar IA regroup

## v2026.06.20.12 (2026.06.20)

- Deploy v2026.06.20.12: Quick Quote Phase 2 — placement preset buttons, one-click next-tier nudge, best-value star (UI only, prices unchanged)

## v2026.06.20.11 (2026.06.20)

- Deploy v2026.06.20.11: Quick Quote UX — config chips on cards + matrix, tasteful price-flash, safety stripes inline, a11y focus rings (UI only, prices unchanged) + CLAUDE.md Rule 9 + pricing memory

## v2026.06.20.10 (2026.06.20)

- Deploy v2026.06.20.10: Text tool for Easy Shirt Designer (fonts, arc, outline, multi-line)

## v2026.06.20.9 (2026.06.20)

- Deploy v2026.06.20.8: audit #2 — DTG fallback-margin parity lock (test + doc; proxy 0.57->0.53 deployed separately)
- Release v2026.06.20.8
- Changelog v2026.06.20.8
- Deploy v2026.06.20.9: 7 files (ACTIVE_FILES.md,ae-dashboard.html,garment-designer.css,...)

## v2026.06.20.8 (2026.06.20)

- Deploy v2026.06.20.8: audit #2 — DTG fallback-margin parity lock (test + doc; proxy 0.57->0.53 deployed separately)

## v2026.06.20.8 (2026.06.20)

- Deploy v2026.06.20.8: 13 files (ACTIVE_FILES.md,hoodie_back.jpg,hoodie_front.jpg,...)

## v2026.06.20.7 (2026.06.20)

- Deploy v2026.06.20.7: audit hygiene #3 — SCP per-screen display + LTM fallback warning, DTF design-rate warning, SCP comment

## v2026.06.20.6 (2026.06.20)

- Deploy v2026.06.20.6: catalog price matrices now engine-probed — single source = the quoted headline (audit #1)

## v2026.06.20.5 (2026.06.20)

- Deploy v2026.06.20.5: pricing-audit fixes — SCP tier label + below-min message, DTF size-upcharge warning + lock test

## v2026.06.20.4 (2026.06.20)

- Deploy v2026.06.20.4: 6 files (ae-dashboard.html,SHIRT_DESIGNER_INTEGRATION_2026-06.md,garment-designer.css,...)

## v2026.06.20.3 (2026.06.20)

- Deploy v2026.06.20.3: 6 files (index.html,quick-quote.css,product.html,...) — safety-stripes example image on all 3 SCP surfaces

## v2026.06.20.2 (2026.06.20)

- chore(pricing-baselines): re-lock SCP (clean Ed_Cost/0.53 model) + DTF (freight bump)
- Deploy v2026.06.20.2: 14 files (PRINT_METHOD_MARGIN_STRATEGY_2026-06.md,SHIRT_DESIGNER_INTEGRATION_2026-06.md,catalog.html,...)

## v2026.06.20.1 (2026.06.20)

- Deploy v2026.06.20.1: 16 files (ACTIVE_FILES.md,index.html,PRINT_METHOD_MARGIN_STRATEGY_2026-06.md,...) — SCP Ed_Cost÷0.53 clean model

## v2026.06.18.9 (2026.06.18)

- Memory: mark Laser Leatherette Patch shipped (v2026.06.18.8)
- Deploy v2026.06.18.9: 5 files (index.html,quick-quote.css,quick-quote.js,...)

## v2026.06.18.8 (2026.06.18)

- Deploy v2026.06.18.8: 8 files (ae-dashboard.html,CUSTOM_DECAL_PRICING_2026-06.md,GARMENT_ART_FORM_REBUILD_2026-06.md,...)

## v2026.06.18.7 (2026.06.18)

- Deploy v2026.06.18.7: 10 files (.gitignore,ACTIVE_FILES.md,index.html,...)

## v2026.06.18.6 (2026.06.18)

- Deploy v2026.06.18.6: 5 files (index.html,quick-quote.css,quick-quote.js,...)

## v2026.06.18.5 (2026.06.18)

- Deploy v2026.06.18.5: 6 files (index.html,quick-quote.css,quick-quote.js,...)

## v2026.06.18.4 (2026.06.18)

- Deploy v2026.06.18.4: 5 files (index.html,quick-quote.css,quick-quote.js,...)

## v2026.06.18.3 (2026.06.18)

- Deploy v2026.06.18.3: 9 files (ACTIVE_FILES.md,index.html,quick-quote.css,...)

## v2026.06.18.2 (2026.06.18)

- Training: document Rep Reference Mockup (Save to Art Request) flow
- Deploy v2026.06.18.2: add Shirt Designer link to staff dashboard Art & Design

## v2026.06.18.1 (2026.06.18)

- Designer: record Phase 1b.1 shipped (pre-seed+sender) + lock 1b.2 save-to-Caspio design
- Deploy v2026.06.18.1: 7 files (SHIRT_DESIGNER_INTEGRATION_2026-06.md,art-request-detail.html,art-request-detail.css,...)

## v2026.06.17.12 (2026.06.17)

- Deploy v2026.06.17.12: 6 files (art-request-detail.html,art-request-detail.css,garment-designer.css,...)

## v2026.06.17.11 (2026.06.17)

- Easy Shirt Designer: productionized standalone page + dashboard link
- Deploy v2026.06.17.11: cache-bust

## v2026.06.17.10 (2026.06.17)

- Art job sheet: guarantee one page (auto shrink-to-fit)
- Deploy v2026.06.17.10: cache-bust

## v2026.06.17.9 (2026.06.17)

- Art job sheet: show artwork (original art + approved/primary mockup)
- Deploy v2026.06.17.9: cache-bust

## v2026.06.17.8 (2026.06.17)

- Art job sheet: printable one-page view on the art-request detail page
- Deploy v2026.06.17.8: cache-bust

## v2026.06.17.7 (2026.06.17)

- Deploy v2026.06.17.7: 7 files (ACTIVE_FILES.md,ae-dashboard.html,ae-submit-form.css,...)

## v2026.06.17.6 (2026.06.17)

- Docs: garment art form — shipped record + notifications decision + LESSONS entry

## v2026.06.17.5 (2026.06.17)

- Garment art request: custom structured form replacing Caspio DataPage
- Deploy v2026.06.17.5: cache-bust 5 files

## v2026.06.17.4 (2026.06.17)

- Deploy v2026.06.17.4: fix quote-view req-ship/drop-dead/ship-date off-by-one (UTC-midnight cal dates)

## v2026.06.17.3 (2026.06.17)

- Deploy v2026.06.17.3: Due column = requested ship date only (drop-dead omitted — not in MO API)

## v2026.06.17.2 (2026.06.17)

- Deploy v2026.06.17.2: add Due (req-ship) column + drop-dead flag to Quote Mgmt; first-name salesperson

## v2026.06.17.1 (2026.06.17)

- Deploy v2026.06.17.1: Refresh Inbound now PERSISTS via proxy catch-up (sticks across reloads)

## v2026.06.16.8 (2026.06.16)

- Docs: record SanMar OSS-vs-OSN inbound feed-lag gotcha + the catch-up fix

## v2026.06.16.7 (2026.06.16)

- Deploy v2026.06.16.7: manual 'Refresh Inbound' button — live SanMar shipment status on demand

## v2026.06.16.6 (2026.06.16)

- Deploy v2026.06.16.6: $0 orders (Paid=n/a) now count as completed — drop off Active tab

## v2026.06.16.5 (2026.06.16)

- Deploy v2026.06.16.5: move SanMar inbound block under Order Status (staff quote view)

## v2026.06.16.4 (2026.06.16)

- Deploy v2026.06.16.4: 6 files (quote-management.css,quote-management.html,LESSONS_LEARNED.md,...)

## v2026.06.16.3 (2026.06.16)

- Deploy v2026.06.16.3: 3 files (quote-management.html,quote-view.js,quote-view.html,...)

## v2026.06.16.2 (2026.06.16)

- Deploy v2026.06.16.2: 8 files (ACTIVE_FILES.md,quote-management.html,LESSONS_LEARNED.md,...)

## v2026.06.16.1 (2026.06.16)

- Deploy v2026.06.16.1: 6 files (ACTIVE_FILES.md,seed-policies.js,index.html,...)

## v2026.06.15.5 (2026.06.15)

- Deploy v2026.06.15.5: 7 files (quote-management.css,quote-management.html,LESSONS_LEARNED.md,...)

## v2026.06.15.4 (2026.06.15)

- Deploy v2026.06.15.4: 4 files (LESSONS_LEARNED.md,quote-view.js,quote-view.html,...)

## v2026.06.15.3 (2026.06.15)

- Deploy v2026.06.15.3: 3 files (quote-management.css,quote-management.html,LESSONS_LEARNED.md,...)

## v2026.06.15.2 (2026.06.15)

- Deploy v2026.06.15.2: 4 files (quote-management.html,LESSONS_LEARNED.md,LESSONS_LEARNED_ARCHIVE.md,...)

## v2026.06.15.1 (2026.06.15)

- Test+docs: lock SCP/DTF push-button async binding (fix shipped in v2026.06.14.10)
- Deploy v2026.06.15.1: 6 files (quote-management.css,quote-management.html,CUSTOMER_SITE_REDESIGN_2026-06.md,...)

## v2026.06.14.10 (2026.06.14)

- Fix 2 silent-wrong-price gaps: SCP save now gates tax on the Include Tax checkbox (was billing full WA tax while the screen showed $0); DTF print now guards on pricing-loaded (could print a $0 PDF on an API outage)
- Docs: record Path 1 push-button parity (always-visible Push + readiness checklist) in quote-builder manifest

## v2026.06.14.9 (2026.06.14)

- Deploy v2026.06.14.9: always-visible Push to ShopWorks + readiness checklist for SCP/DTF (EMB parity); DTG relabel

## v2026.06.14.8 (2026.06.14)

- Tax UX level-up (best-of-both) across EMB/SCP/DTF — dynamic rate label + always-visible row

## v2026.06.14.7 (2026.06.14)

- SCP/DTF polish: badge accuracy + footer CSS to shared (responsive) + remove dead save-quote CSS

## v2026.06.14.6 (2026.06.14)

- Trio polish: EMB dead-code cleanup + collapsible customer panel; SCP estimator call aligned
- Docs: record full-layout alignment + final consistency audit in quote-builder manifest

## v2026.06.14.5 (2026.06.14)

- DTF: wrap footer tax-rate input + % so they group right (parity with SCP)

## v2026.06.14.4 (2026.06.14)

- SCP/DTF: relocate Fees & Charges to a horizontal Services & Fees bar in the content area (EMB parity)

## v2026.06.14.3 (2026.06.14)

- SCP/DTF: relocate Order Details + Shipping + Subtotal/Tax/TOTAL to a footer invoice band (EMB parity)

## v2026.06.14.2 (2026.06.14)

- SCP/DTF: move reference-artwork upload to a top content card (EMB flagship parity)

## v2026.06.14.1 (2026.06.14)

- Align SCP/DTF action areas to EMB flagship + restore Save-button JS hooks

## v2026.06.12.7 (2026.06.12)

- Deploy v2026.06.12.7: SanMar-style gallery cards (blurbs+live 12pc/ladder pricing+varied colors+sort+badges), About-this-shirt specs panel, Caspio-driven PC54 sale (CTS-SALE-{STYLE}), service-code burst fixes

## v2026.06.12.6 (2026.06.12)

- Deploy v2026.06.12.6: custom-tees AI-art hero + 'AI Artwork + Full-Color DTG' feature section (5 samples)

## v2026.06.12.5 (2026.06.12)

- Deploy v2026.06.12.5: real customer-job photos in hero rotator (9) + Express cards; remove Free-samples sticker

## v2026.06.12.4 (2026.06.12)

- Deploy v2026.06.12.4: Express Order homepage section (Custom T-Shirts + Custom Hats), golf relocated

## v2026.06.12.3 (2026.06.12)

- Deploy v2026.06.12.3: caps web orders route to Custom Embroidery (id_OrderType 21 / acct 4050)

## v2026.06.12.2 (2026.06.12)

- fix(storefront): write quote_items + pre-tax TotalAmount/TaxAmount so /quote + /invoice render line items
- docs(lessons): archive 2 old resolved entries to stay under the 300-line cap
- docs(lessons): archive await-sync entry — under 300-line cap
- docs(lessons): condense storefront entry under 300-line cap
- docs(lessons): collapse archived stubs to single lines — under 300-line cap (300)

## v2026.06.12.1 (2026.06.12)

- docs(redesign): decision 19 - decorated catalog card prices live (from X with logo at 72+)

## v2026.06.11.12 (2026.06.11)

- docs(redesign): end-of-day pickup point - 11 releases live incl. Phase 2 cart via parallel session's v2026.06.11.11 deploy
- docs(redesign): pickup additions - proxy push-note fix pending deploy + stash redundancy check
- fix(quote-cart): screen print enforces its real 13-piece customer minimum (Erik 2026-06-11)
- feat(quote-cart): Phase 3 - save/share/email as real WQ quotes
- docs(redesign): record SCP minimum fix + Phase 3 E2E proof (awaiting clean deploy window)
- refactor(dtf): remove deprecated/duplicate code paths after the .11 single-source refactor
- docs: AGENTS.md - Codex-targeted copy of the repo working rules
- Deploy v2026.06.11.12: cache-bust

## v2026.06.11.11 (2026.06.11)

- feat(quote-cart): Phase 2 - Add-to-Quote cart with pooled per-method pricing
- feat(quote-cart): register /quote-cart clean-URL route + TOC
- Deploy v2026.06.11.11: 55 files (ACTIVE_FILES.md,christmas-bundles.html,laser-tumbler-polarcamel.html...)

## v2026.06.11.10 (2026.06.11)

- fix(catalog): cap price margin from API only - removes last hardcoded 0.57 fallback (completes parallel session's margin cleanup)
- fix(pricing): margins from Caspio everywhere - kill stale hardcoded 0.57 sweep
- Deploy v2026.06.11.10: cache-bust

## v2026.06.11.9 (2026.06.11)

- docs(redesign): record v2026.06.11.8 - quote-cart Phase 0 + pricing fixes live
- chore(baselines): re-lock pricing baselines to live Caspio values (Erik-approved 2026-06-11)
- chore(pricing-baselines): re-lock after Erik's intentional DTG/DTF Caspio margin lift (signed off 2026-06-11)
- feat(product): Phase 1 configurator replaces decoration tabs (decisions 17+18)
- Deploy v2026.06.11.9: cache-bust

## v2026.06.11.8 (2026.06.11)

- docs(quote-cart): parity rules (EMB/DTG/SCP/DTF) + customer quote-cart design + 5-phase plan
- docs(redesign): decision 17 - configurator-first pricing display (quote like a storefront)
- docs(redesign): decision 18 - configurator prices two locations exactly, disclaims the rest
- fix(pricing): SCP calculator dark-garment parity + DTG unpriceable combos removed (Erik chip sessions)
- feat(quote-cart): Phase 0 - pricing engine + 62-test parity lock + manual-cost gates (P0 hotfix)
- Deploy v2026.06.11.8: cache-bust

## v2026.06.11.7 (2026.06.11)

- docs(redesign): record v2026.06.11.6 hats store launch
- fix(product): related cards used SanMar placeholder jpgs - switch to real FRONT_MODEL photography
- Deploy v2026.06.11.7: cache-bust

## v2026.06.11.6 (2026.06.11)

- docs(redesign): record v2026.06.11.5 — decoration gating live + hats core dormant + open Erik decisions
- feat(quote-mgmt): CAP prefix routes to read-only quote view; document CAP in prefix list
- feat(custom-caps): storefront + success page — the Custom Hats store UI (P4 step 3)
- feat(custom-caps): register /custom-caps route + homepage card goes live
- Deploy v2026.06.11.6: cache-bust

## v2026.06.11.5 (2026.06.11)

- docs(redesign): record v2026.06.11.4 Wave 2 deploy + P3 remainders + P4 start
- refactor(storefront): extract CHANNELS registry — hats becomes an additive entry (P4 step 1)
- feat(decoration): method eligibility gating — product tabs + catalog Decoration filter (Erik-approved matrix)
- feat(custom-caps): channel entry + pure cap pricing module + server repricer (P4 step 2)
- Deploy v2026.06.11.5: cache-bust

## v2026.06.11.4 (2026.06.11)

- feat(seo): robots.txt — disallow staff/internal paths + credential-bearing share links
- feat(design-system): nwca-2026-core.css — interior-page layer split + primitives + AA fixes
- feat(redesign): /catalog page + rebuilt product.html — Wave 2 (P2+P3 core)
- fix(catalog): portrait product photos overflowed the card media area
- feat(homepage): cut category/brand navigation over to /catalog (P2 cutover)
- Deploy v2026.06.11.4: cache-bust 3 files

## v2026.06.11.3 (2026.06.11)

- docs(redesign): mark v2026.06.11.2 deployed in pickup section
- style(homepage): hero emphasis — orange color, not underline (read as spellcheck squiggle)
- Deploy v2026.06.11.3: cache-bust nwca-2026.css

## v2026.06.11.2 (2026.06.11)

- wip(customer-redesign): homepage rebuild on nwca-2026 + P0 hotfixes — NOT deployed, awaiting screenshot approval
- fix(search): stale hardcoded categories blanked 11 common search words — Fleece->Sweatshirts/Fleece, Headwear->Caps
- feat(homepage): hero rotator — 4 real prints crossfade in the registration frame
- Deploy v2026.06.11.2: 1 files (index.html...)

## v2026.06.11.1 (2026.06.11)

- wip(custom-tees): order-shipped email with tracking — wired, NOT yet deployed

## v2026.06.10.14 (2026.06.10)

- feat(custom-tees): webhook-side confirmation emails + customer order-status page

## v2026.06.10.13 (2026.06.10)

- feat(custom-tees): live stock all 20 styles + admin artwork downloads + email rewire

## v2026.06.10.12 (2026.06.10)

- feat(custom-tees): UberPrints model — baked small-batch pricing + threshold shipping

## v2026.06.10.11 (2026.06.10)

- feat(custom-tees): e-commerce perfection pass — online $25 LTM, rights gate, trust copy, push fixes

## v2026.06.10.10 (2026.06.10)

- fix(calibration-tool): empty-state overlay swallowed all box drags

## v2026.06.10.9 (2026.06.10)

- feat(staff-dashboard): Custom Tees storefront + Tee Print-Box Calibration links in Quote Builders (Erik request)

## v2026.06.10.8 (2026.06.10)

- feat(custom-tees): staff print-box calibration tool + Caspio-backed layouts

## v2026.06.10.7 (2026.06.10)

- feat(custom-tees): garment silhouette auto-fit — print box anchors to the actual photo

## v2026.06.10.6 (2026.06.10)

- feat(custom-tees): free placement + size-based pricing + drag-resize handle (Erik round 2)

## v2026.06.10.5 (2026.06.10)

- docs(lessons): cloned-channel push hardcodes + clean-URL relative-path gotcha
- feat(custom-tees): design close-up zoom + raised back print area (Erik feedback)

## v2026.06.10.4 (2026.06.10)

- feat(custom-tees): multi-style DTG storefront — gallery, designer, Stripe checkout
- fix(custom-tees): E2E-verified checkout leg + endpoint shape fixes
- docs: ACTIVE_FILES — Custom T-Shirts system built (pre-launch status + test files)
- feat(custom-tees): cutover — 3DT URLs 301 to /custom-tees, homepage card, rush-aware push notes

## v2026.06.10.3 (2026.06.10)

- Deploy v2026.06.10.3: 3 files (dtg-quote-builder.html,dtg-inline-form.js,dtg-quote-page.js,)

## v2026.06.10.2 (2026.06.10)

- feat(dtf): unsaved-changes tracking + leave-page guard (EMB/SCP parity)

## v2026.06.10.1 (2026.06.10)

- chore: delete orphaned cap-quote-logos.js + cap-quote-products.js (zero references)
- fix(emb): audit fix wave — money-path consistency, save robustness, UX + features
- fix(emb): updatePushButtonState no longer re-applies inline steel-blue background
- docs+fix: push-preview UNBILLED regex (cross-repo note contract), LESSONS entries, cache-busts
- Deploy v2026.06.10.1: 5 files (invoice.html,dtf-quote-builder.html,dtg-quote-builder.html...)

## v2026.06.09.8 (2026.06.09)

- docs(memory): record date-normalizer deploy v1308 + OF-0059 verify
- feat(3-day-tees): full design-studio rebuild — designer canvas, server-side reprice, real UPS shipping, hardened Stripe→ShopWorks flow
- feat(3-day-tees): perfection pass — FF placement, per-color calibration, contrast guard, full payment-loop proof
- Deploy v2026.06.09.8: 2 files (3-day-tees-success.html,3-day-tees.html...)

## v2026.06.09.7 (2026.06.09)

- fix(deploy-skill): cache-bust .jsx files + kill basename-collision over-bump
- fix(order-form push): normalize orderDate/requestedShipDate to YYYY-MM-DD

## v2026.06.09.6 (2026.06.09)

- docs(memory): SCP/sticker Pricing=API done (v2026.06.09.5) + emblem note
- Deploy v2026.06.09.6: order-form push + PDF — parity-locked, fee itemization, $0-fee guard, SCP/DTG fixes

## v2026.06.09.5 (2026.06.09)

- docs(memory): safety-stripe API + dead-code cleanup shipped (v2026.06.09.4)
- feat(pricing=api): SCP LTM + calculator setup/stripe + sticker setup → Caspio
- Deploy v2026.06.09.5: SCP/sticker Pricing=API cache-bust

## v2026.06.09.4 (2026.06.09)

- docs(memory): mark pricing audit DEPLOYED (proxy v803 + frontend v2026.06.09.3)
- feat(pricing=api): wire safety-stripe to Caspio Service_Codes SP-STRIPE
- Deploy v2026.06.09.4: 8 files (safety-stripe SP-STRIPE API wiring cache-bust)
- docs: record dead-code deletions (cap-quote-*, dtf-quote-adapter, dtg-quote-pricing, legacy EMB email)

## v2026.06.09.3 (2026.06.09)

- docs(memory): LTMFeeTotal column INTEGER→CURRENCY (schema fix from parallel chip session)
- docs(memory): full pricing-surface audit 2026-06-09 (47 verified findings) + resume checklist
- fix(order-form): pricing + tax parity with quote builders (C1/C2 + Themes A/B/G/H/I)
- fix(quote-mgmt): route OF quotes to Order Form + use APP_CONFIG for proxy URL (Theme J)
- fix(quote-builders): EMB puff-line key, rate-aware invoice tax label, DTG/DTF manual-cost host gate
- feat(pricing=api): migrate SCP/DTF/EMB charged fees to Caspio Service_Codes (Themes C/D/F)
- fix(order-form,dtg): tax % label trailing zeros + DTG push excludes invalid-color rows
- docs(memory): record pricing-audit fixes + LESSONS_LEARNED (order-form parity)
- Deploy v2026.06.09.3: 12 files (ae-dashboard.html,art-hub-steve.html,bradley-screenprint.html...)

## v2026.06.09.2 (2026.06.09)

- docs(memory): DTG Phase 2 SHIPPED LIVE v2026.06.09.1
- fix(dtg): round LTMFeeTotal to integer — LTM quotes (qty<24) failed to save
- docs(memory): LTMFeeTotal integer-column fix recorded (LESSONS + roadmap)
- Deploy v2026.06.09.2: 1 files (dtg-quote-builder.html,...)

## v2026.06.09.1 (2026.06.09)

- docs(memory): DTG roadmap START-HERE → Phase 2 handoff (Phase 1 shipped v2026.06.08.23)
- feat(dtg): Phase 2 (A) — billable shipping into tax base (inline-form)
- feat(dtg): Phase 2 (B) — save shipping fee (TotalAmount incl fee, ShippingFee col)
- feat(dtg): Phase 2 (C) — server.js cur_Shipping from ship.fee + buildOrderNote shipping-aware
- feat(dtg): Phase 2 (D) — ship-fee field CSS + cache-bust v2026.06.09.1
- test(dtg): Phase 2 (E) — lock billable-shipping tax base in dtg-tax-base.test.js
- fix(dtg): Phase 2 review — SHIP line item + products-only TotalAmount (DTF/SCP parity)
- fix(dtg): Phase 2 live-test — drop ShippingFee session write (SHIP item is canonical)
- docs(memory): DTG Phase 2 built+verified — roadmap status, LESSONS entry, archive
- docs(memory): DTG Phase 2 TEST push OF-0057 conversion-verified
- Merge dtg-phase2-wip: DTG Phase 2 — billable shipping + UPS estimator

## v2026.06.08.23 (2026.06.08)

- docs(memory): DTG parity roadmap + status (legacy deleted, exempt fixed, Phase 0 band done; Phases 1-2 planned)
- docs(memory): DTG Phase 1 status + the save-flow blocker for Chunk C (manual form doesn't write aiState.currentPriceQuote)
- docs(memory): DTG roadmap START-HERE handoff — resolved save-flow blocker + Phase 1/2 pickup steps + prompt
- WIP(dtg): Phase 1 Chunks A+B — tax controls + single-authority threading (NOT deployed)
- feat(dtg): Phase 1 — tax UI + wholesale + save-fidelity (Chunks C/D/E), verified
- fix(dtg): resetForm must clear Phase 1 tax flags (reset-bleed → 0% tax)
- docs(memory): DTG Phase 1 — reset-bleed fix + live TEST push results (OF-0055/0056)
- Deploy v2026.06.08.23: 1 files (dtg-quote-builder.html,...)

## v2026.06.08.7 (2026.06.08)

- docs(memory): SCP Phase 3 band DONE+reviewed+reset-fix; band parity COMPLETE across EMB/DTF/SCP
- Deploy v2026.06.08.7: freight estimate now cost-based (negotiated + 15% handling) label

## v2026.06.08.2 (2026.06.08)

- docs(memory): Phase 0 DTF/SCP parity DONE + verified live; log the shared-extraction gotcha
- Deploy v2026.06.08.2: consolidate freight boxes across whole order (fix multi-style over-quote)

## v2026.06.07.13 (2026.06.07)

- Deploy v2026.06.07.13: freight estimate shows exact-vs-rough zone wording

## v2026.06.07.11 (2026.06.07)

- Deploy v2026.06.07.11: 3 files (LESSONS_LEARNED.md,embroidery-quote-builder.html,embroidery-quote-builder.js,...)

## v2026.06.07.2 (2026.06.07)

- docs(memory): log to-100 readiness lessons (adversarial-verify-own-fix, B8 tax-exempt persistence, B1/monogram traps) + final verdict
- docs(memory): archive 12 oldest resolved one-off lessons (301->225 lines)
- feat(emb): wholesale / reseller checkbox — 0 tax, routes to ShopWorks account 2203
- Deploy v2026.06.07.2: cache-bust wholesale checkbox

## v2026.06.07.1 (2026.06.07)

- fix(emb): readiness C-group a11y + dead-code polish (C2-C7, C10)
- Deploy v2026.06.07.1: cache-bust C-group a11y/dead-code

## v2026.06.06.11 (2026.06.06)

- fix(emb): readiness C8 — revive the inert AL-pricing save backstop
- fix(emb): readiness true-100 — close 4 verification-caught gaps (B8-R1/R2, A3-DECG, C8)
- fix(emb): readiness apply-ready tail — design-search onclick (C11) + residential freight (B12)
- Deploy v2026.06.06.11: cache-bust true-100 batch (B8-R1/R2, A3-DECG, C8, C11, B12)

## v2026.06.06.10 (2026.06.06)

- fix(emb): readiness B-group batch 1 — push-preview artwork, tax-exempt toggle, PDF/label/email
- Deploy v2026.06.06.10: cache-bust B-group batch 1

## v2026.06.06.9 (2026.06.06)

- test(emb): stored-XSS regression test for the shared invoice/PDF generator (P0-1)
- fix(emb): readiness P0/P1 batch 2 — close 5 newly-found audit blockers (A1-A3,B5,B6)
- fix(emb): readiness P0/P1 batch 3 — finish A-group (A4 import under-bill, A5/A6 wrong-account)
- Deploy v2026.06.06.9: cache-bust A-group + B5/B6

## v2026.06.06.8 (2026.06.06)

- fix(emb): P2 batch — design-not-found push warning + push-modal focus trap
- Deploy v2026.06.06.8: cache-bust P2-9/P2-16

## v2026.06.06.7 (2026.06.06)

- fix(emb): P2 customer/shipping batch — pickup-reload address guard + stale-banner clear + project-name
- fix(emb): P2 batch — ProjectName persistence + dashboard pushed-order lock + push-button email re-enable
- Deploy v2026.06.06.7: cache-bust P2 batch

## v2026.06.06.6 (2026.06.06)

- chore: remove stray inv_sample.json (malformed-path debug artifact)
- fix(emb): P2 errors-dimension — service-code silent-default warning + revive AL-failure backstop
- Deploy v2026.06.06.6: 1 files (embroidery-quote-builder.html,...)

## v2026.06.06.5 (2026.06.06)

- **security(emb): readiness deep-dive P0** — fixed **stored XSS** in the shared invoice/PDF generator (an unescaped customer name/note/address executed on print; affects all 4 builders), **SQL injection** on the public `GET /api/quote_items` `styleNumber`, and a **destructive `DELETE … OR 1=1`** injection in `/api/emb-designs`. (proxy + frontend)
- fix(emb): P1 wrong-money — phantom freight after switching to Pickup; tax-exempt customers still charged WA tax; design-lookup auto-attaching the WRONG customer on a fuzzy match; AL/DECG pricing errors saving $0; WA DOR tax-rate truncated to 1 decimal; `/invoice` dropping discount (didn't foot) + omitting shipping from the grand total; Design # + artwork pushing a duplicate design.
- Cache-bust `embroidery-quote-invoice.js` (all 4 builders), `embroidery-quote-builder.js`, `pages/js/invoice.js` → v2026.06.06.5.
- Deploy v2026.06.06.5

## v2026.06.06.4 (2026.06.06)

- fix(emb): readiness-audit P0 (Erik's #1 rule) — reopening a Customer-Pickup quote silently overwrote the saved tax rate with today's live Milton rate (the async lookup resolved after the restore). Guarded with `window._restoringQuote`.
- fix(emb): readiness-audit P1 — legacy additional-logo quotes double-charged the AL on reload; now gated on no AL row present.
- fix(emb): readiness-audit P1 — OSFA-only caps/beanies dropped their quantity on reload; now mirrors the ShopWorks-import parent-OSFA path.
- fix(emb): a Full Back added as an *additional* logo was dropped from the grand total (`additionalServicesTotal`); now summed.
- test(emb): 298-check combinatorial pricing matrix + edit-reload regression guards (12 tests) + ShopWorks push verification (all 20 line-item types land in LinesOE/order-level).
- Deploy v2026.06.06.4

## v2026.06.06.3 (2026.06.06)

- fix(emb): per-tier margin (N2) — 8+ garment tiers were under-charged at 0.55 vs 0.53; builder now matches the live pricing pages (J790 $79 / 112 $26). Cap was already correct.
- fix(emb): additional-stitch band re-sourced from canonical Embroidery_Costs Mid/Large rows by label (Caspio edits now take effect); 25K cap derived from data, not hardcoded
- fix(emb): additional-logo + DECG fallbacks now category-correct; DECC customer-supplied cap base corrected to 8,000 (matches the page)
- feat(emb): DECG/DECC "Heavyweight +$10/pc" toggle (API-sourced) + reusable services-bar checkbox field; also fixes a pre-existing DECG stitch-count-not-persisted bug
- docs(emb): "10,000 stitches included" wording on the garment + cap pricing pages
- Deploy v2026.06.06.3

## v2026.06.06.2 (2026.06.06)

- fix(emb): round-2 — Email works on a just-saved quote (N3) + PDF Graphic-Design rate tracks API (N7)
- Deploy v2026.06.06.2

## v2026.06.06.1 (2026.06.06)

- docs(memory): overnight deep-review hardening — 25 fixes shipped (proxy v790 + frontend v.10/.11/.12); remaining + risky catalogued
- fix(emb): round-2 — fix 3 regressions from the review pass + a pre-existing tax double-count
- Deploy v2026.06.06.1

## v2026.06.05.12 (2026.06.05)

- fix(emb): review wave 4 — silent-fallback warnings + save-while-uploading + FB rate + onboarding/a11y
- Deploy v2026.06.05.12

## v2026.06.05.11 (2026.06.05)

- fix(emb): review wave 3 — un-break DTF/SCP/DTG (my indigo regression) + label/security/a11y/cleanup
- Deploy v2026.06.05.11

## v2026.06.05.10 (2026.06.05)

- docs(memory): audit continued (v.8 #11/#13a/#13c, v.9 #8); #4a/#12 held as judgment calls
- fix(emb): review wave 2 — data-integrity + silent-price + push-button bugs
- Deploy v2026.06.05.10

## v2026.06.05.9 (2026.06.05)

- feat(emb): push-readiness checklist (audit #8) — show Customer# / products / name gates above Push
- Deploy v2026.06.05.9

## v2026.06.05.8 (2026.06.05)

- docs(memory): Order Recap shipped v2026.06.05.7
- feat(emb): audit batch — Rush%→API (#13a), resetQuote hygiene (#13c), tax-in-push-preview (#11)
- Deploy v2026.06.05.8

## v2026.06.05.7 (2026.06.05)

- docs(memory): audit #3 right-panel re-skin shipped v2026.06.05.6
- feat(emb): Order Recap — use the empty space left of the totals for an 'order at a glance' band
- Deploy v2026.06.05.7: 4 files

## v2026.06.05.6 (2026.06.05)

- docs(memory): EMB audit (39 agents/13 fixes) — shipped batch v2026.06.05.5 + proxy v789; remaining visual/polish
- ui(emb): right-panel re-skin (audit #3) — Quote Summary card chrome, indigo headers, de-yellow Special Notes, renumber
- Deploy v2026.06.05.6: 4 files

## v2026.06.05.5 (2026.06.05)

- docs(memory): v2026.06.05.4 right-panel UX redesign (artwork->logo card, action stack, drop Save&Share)
- fix(emb): audit batch — 3 pricing bugs + artwork shrink + shipping de-dup + upload timeout + focus
- Deploy v2026.06.05.5: 9 files (cap-embroidery-pricing-integrated.html,dtf-pricing.html,dtg-pricing.html,...)

## v2026.06.05.4 (2026.06.05)

- docs(memory): v2026.06.05.3 lookup-limit fix + Maxx email data-gap finding
- docs(memory): proxy v788 push session-selection fix + sequence root-cause (dup QuoteID)
- ui(emb): reorganize right panel — artwork into logo card, unified action stack, drop Save & Share dropdown

## v2026.06.05.3 (2026.06.05)

- docs(memory): mark 3 order-entry improvements SHIPPED v2026.06.05.2 (pending Erik live verify)
- fix(lookup): raise customer-contact dropdown limit 10->25 so all of a company's contacts show (Aaberg's has 17); shared service -> all 4 builders
- Deploy v2026.06.05.3: 4 files (dtf-quote-builder.html,dtg-quote-builder-legacy.html,embroidery-quote-builder.html,...)

## v2026.06.05.2 (2026.06.05)

- docs(memory): next-session pickup 2026-06-05 — AS-Garm fix shipped + verified; 3 UX/bug items queued
- feat(emb): order-entry flow improvements — AL qty auto-tally, logo card auto-collapse, prominent one-click Push
- Deploy v2026.06.05.2: 1 files (embroidery-quote-builder.html,...)

## v2026.06.05.1 (2026.06.05)

- fix(order-form): stamp APISource="ManageOrders" (was blank) to match the ShopWorks integration filter
- docs(memory): next-session pickup — AS-Garm subtotal fix + APISource receiving win recap
- fix(emb): include AS-Garm/AS-CAP stitch fees in saved SubtotalAmount
- Deploy v2026.06.05.1: 1 files (embroidery-quote-builder.html,...)

## v2026.06.04.15 (2026.06.04)

- fix(emb): artwork lifecycle + PDF footing — 6 audit bugs (reset-bleed wrong-logo, edit-reload artwork wipe, unnamed-art push drop, missing stitch-surcharge line, dropped non-standard sizes, setup-fee double-display)
- fix(emb): PDF printed a Date.now() quote # instead of the real saved ID
- feat(emb): DECG (garment) + DECC (cap) Customer-Supplied chips, live-priced from /api/decg-pricing
- fix(emb): DECG/DECC double-save — 2x over-charge on invoice + ShopWorks push
- fix(emb): restore Services-bar fees (RUSH/GRT-50/GRT-75/DD) lost on edit-reload
- fix(emb): drop phantom garment logo / production note on cap-only orders
- fix(emb): restore cap embellishment type (3D-puff/laser-patch) on edit-reload
- fix(emb): edit-reload pricing — dropped 2XL extended size + AS-Garm/AS-CAP double-count
- docs(memory): cert run, edit-reload restore class, artwork/PDF audit
- Deploy v2026.06.04.15: EMB bulletproof — 13 bug fixes + DECG/DECC chips (cert + artwork/PDF audit)

## v2026.06.04.6 (2026.06.04)

- docs(memory): box-density data findings (real SanMar cartons; no weight in feed)
- feat(emb): estimator reads tunable box density; suppress spurious cap note
- Deploy v2026.06.04.6: tunable box density + cap-note fix

## v2026.06.04.5 (2026.06.04)

- docs(memory): audit pickup — surfaces + shipping estimator DEPLOYED; cert remaining
- feat(emb): data-backed box density for shipping estimate (real SanMar cartons)
- Deploy v2026.06.04.5: data-backed box density

## v2026.06.04.4 (2026.06.04)

- feat(emb): 'Estimate UPS Ground' shipping button (prepay estimate)
- fix(emb): shipping estimate boxes per-product (4 jackets = 1 box, not 2)
- Deploy v2026.06.04.4: shipping estimator + EMB audit fixes

## v2026.06.04.3 (2026.06.04)

- fix(emb): edge-case hardening from adversarial audit (4 real bugs)
- docs(memory): push test + edge-case audit findings + 4 fixes + backlog
- fix(emb invoice): /quote renders AL/AL-CAP/DD/GRT fee line items (foots now)
- docs(memory): EMB deep-audit pickup — bulletproof mission state + resume plan
- fix(emb): /invoice tax foots + PDF shows Design#/PO#/Req-Ship (output-surface audit)
- Deploy v2026.06.04.3: cache-bust EMB audit fixes (surfaces + edge-cases)

## v2026.06.04.2 (2026.06.04)

- feat(emb): Additional Logo picker — placement + EXACT stitch count (API-priced)
- docs(memory): AL picker redesign (placement + exact stitches) + J790 stress-test
- Deploy v2026.06.04.2: cache-bust AL picker assets

## v2026.06.04.1 (2026.06.04)

- feat(emb): Additional Logo as a bar line item, live-priced from the API
- feat(emb): retire the top Additional Logo toggle (AL now on the Services bar)
- fix(emb): AL re-prices on add/qty-change (not in sync updatePricingDisplay)
- docs(memory): AL build done+verified; lesson on await-in-sync-fn (EMB recalc/display split)
- feat(emb): move Design # lookup into the logo cards; drop the Artwork sidebar step
- docs(memory): Design # lookup moved into logo cards — done+verified
- Deploy v2026.06.04.1: 4 files (dtf-quote-builder.html,dtg-quote-builder-legacy.html,embroidery-quote-builder.html,...)

## v2026.06.03.4 (2026.06.03)

- EMB: source Services-bar fee prices from Caspio Service_Codes (/api/service-codes)
- docs(memory): record Service_Codes price-wiring + AL pricing source for next session
- docs(CLAUDE): add rule — all quote-builder pricing/charges run off the API, never hardcoded
- Deploy v2026.06.03.4: 1 files (embroidery-quote-builder.html,...)

## v2026.06.03.3 (2026.06.03)

- EMB: move Digitizing to the Services bar (Artwork ▾ → DD $100 line item)
- docs(memory): update EMB pickup — Services bar deployed (v2026.06.03.2), Digitizing on bar; AL build is next
- Deploy v2026.06.03.3: 1 files (embroidery-quote-builder.html,...)

## v2026.06.03.2 (2026.06.03)

- EMB: persistent catalog-driven Services bar — click a service = line item
- docs: register quote-services-bar.js in ACTIVE_FILES.md + shared JS GUIDE.md
- docs(memory): EMB redesign session pickup note (resume point for next session)
- docs(architecture): flagship model + change-propagation strategy (EMB flagship; structure-vs-content; adopt-don't-copy; DTG separate)
- EMB Services bar v2: category dropdowns + Rush Fee as a line item w/ amount entry
- EMB Rush Fee: computed 25%-of-subtotal line item (part RUSH), mirrors ShopWorks
- EMB Services bar: match real ShopWorks parts/descriptions (test order 142021)
- Deploy v2026.06.03.2: 4 files (dtf-quote-builder.html,dtg-quote-builder-legacy.html,embroidery-quote-builder.html,...)

## v2026.06.03.1 (2026.06.03)

- EMB builder: linear order-flow sidebar redesign (pickup-first, invoice-style totals)
- EMB invoice: move totals (Subtotal/Shipping/Sales Tax/Total) under the line items
- EMB invoice: edit shipping from the totals line via a popup; fix cut-off tax %
- EMB invoice: show carrier name (not $0.00) on the Shipping line when no charge
- Invoice: add billing address to BILL TO + a SHIP TO block when shipping
- docs(lessons): log WA DOR tax-rate ResultCode-2 wrong-tax bug; archive oldest dashboard entry
- Deploy v2026.06.03.1: 8 files (ACTIVE_FILES.md,dtf-quote-builder.html,dtg-quote-builder-legacy.html,...)

## v2026.06.02.4 (2026.06.02)

- chore: expand Claude Code permissions for deploy workflow
- Quote-view PDF Phase 11.4: fix one-page fit for full-size-run quotes

## v2026.06.02.3 (2026.06.02)

- Phase 3.1: shared pricingData contract for 4 quote builders
- Phase 3.1 verification: tax/LTM/severity matrices + empty-input regression fix
- Phase 3.1 fix: validator warns (not throws) on production heroku
- Merge pull request #5 from ErikM1974/claude/refine-local-plan-p6aDc
- Invoice: unified LTM totals row for SCP/DTF/DTG (Finding #2 follow-up)
- Deploy v2026.06.02.3: 5 files (dtf-quote-builder.html,dtg-quote-builder-legacy.html,dtg-quote-builder.html,...)

## v2026.06.02.2 (2026.06.02)

- Fix DTG/order-form routing: apiSource OrderForm -> ManageOrders
- Order form: send blank APISource (uniform with all push paths → catch-all)
- Doc: ManageOrders integration APISource routing + consolidation (2026-06-02)
- Docs: quote-builder shared-vs-per-builder manifest + change-routing (2026-06-02)
- docs(phase3): add Order Form as 5th surface + Phase 3.1 kickoff
- Add Roland printer supplies page + dashboard button

## v2026.06.02.1 (2026.06.02)

- Docs: record self-review round 2 findings + OneDrive silent-revert gotcha/workaround
- Fix ShopWorks sync-back: look up builder orders by their REAL ExtOrderID
- Doc: double size-suffix push bug + fix + design-type confirmation (2026-06-02)
- Doc: design ExtDesignID collision bug + fix (2026-06-02)
- PDF: compact print layout so quotes fit one page when locations are shown
- Deploy v2026.06.02.1: PDF single-page layout (embroidery-quote-invoice.js + builder cache-bust)

## v2026.06.01.9 (2026.06.01)

- Deploy v2026.06.01.9: quote-builder deep-review fixes (28 findings)

## v2026.06.01.8 (2026.06.01)

- Deploy v2026.06.01.8: 5 files (quote-management.html,LESSONS_LEARNED.md,LESSONS_LEARNED_ARCHIVE.md,...)

## v2026.06.01.6 (2026.06.01)

- Quote edit-load: lock pushed quotes + defensive matching-quote pick
- Deploy v2026.06.01.6: 5 files (cache-bust)

## v2026.06.01.5 (2026.06.01)

- Print/PDF: fix EMB tax-rate pass + DTG flagship title/specs flag
- Deploy v2026.06.01.5: 2 files (cache-bust)

## v2026.06.01.4 (2026.06.01)

- Print/PDF: use the quote's actual tax rate (was hardcoded 10.1% in all 4 builders)
- Deploy v2026.06.01.4: 5 files (cache-bust)

## v2026.06.01.3 (2026.06.01)

- Quote reports: method-aware specs header + fix blank invoice DECORATION
- Deploy v2026.06.01.3: 7 files (invoice.html,quote-view.html,dtf-quote-builder.html)

## v2026.06.01.2 (2026.06.01)

- SCP: capture + persist ShopWorks customer # (was missing -> orders fell back to cust 3739)
- Deploy v2026.06.01.2: 5 files (dtf-quote-builder.html,dtg-quote-builder-legacy.html,dtg-quote-builder.html)

## v2026.06.01.1 (2026.06.01)

- DTF quote builder: add review-before-push preview modal (parity with EMB/SCP)
- Deploy v2026.06.01.1: 1 files (dtf-quote-builder.html)

## v2026.05.29.10 (2026.05.29)

- Note emails: =-free '?ae' rep-link flag (fixes corrupted ?view=ae)
- Deploy v2026.05.29.10: 2 files (art-request-detail.html,mockup-detail.html,...)

## v2026.05.29.8 (2026.05.29)

- Mockup notes: backend-owned notifications + notify checkbox
- Deploy v2026.05.29.8: 1 files (mockup-detail.html,...)

## v2026.05.29.7 (2026.05.29)

- Art notes: hand note notifications to the backend; fix direction + label
- Deploy v2026.05.29.7: 2 files (art-hub-steve.html,art-request-detail.html,...)

## v2026.05.29.6 (2026.05.29)

- Add archived-policy filter + Show-archived toggle to Policies Hub
- Deploy v2026.05.29.6: archived-filter cache-bust

## v2026.05.29.5 (2026.05.29)

- Deploy v2026.05.29.5: sticker save-path parity — pre-tax total, retry-safe partial-save block, $0-setup-fee fix

## v2026.05.29.4 (2026.05.29)

- Harden /deploy: guard untracked HTML-referenced assets + fail loudly on dirty checkout
- Deploy v2026.05.29.4: Richardson cap pricing parity — 3D Puff option + new-design setup (00 digitizing / 0 GRT-50)

## v2026.05.29.3 (2026.05.29)

- Add missing shared contract-pricing-2026.css (was untracked → broke prod)
- Deploy v2026.05.29.3: 8 files (index.html,index.html,richardson-2025.html,...)

## v2026.05.29.2 (2026.05.29)

- Fix DTF Quote Builder -> ShopWorks push: real customer, fees, ship-to, typed notes
- Fix sticker pricing page: once-per-session AI chat, a11y, table corrections
- Deploy v2026.05.29.2: 31 files (ACTIVE_FILES.md,dtg-contract.css,dtg-contract.js,...)

## v2026.05.29.1 (2026.05.29)

- Deploy v2026.05.29.1: 6 files (embroidery-pricing-all.css, index.html...)

## v2026.05.28.6 (2026.05.28)

- Deploy v2026.05.28.6: 13 files (.gitignore,ACTIVE_FILES.md,Employee-Handbook-Latest.pdf,...)

## v2026.05.28.5 (2026.05.28)

- Deploy v2026.05.28.5: 5 files (policies-hub-v2.css,handbook.html,policies-hub.html...)

## v2026.05.28.4 (2026.05.28)

- Deploy v2026.05.28.4: 9 files (ACTIVE_FILES.md,LESSONS_LEARNED.md,staff-dashboard-dark.css,...)

## v2026.05.28.3 (2026.05.28)

- Deploy v2026.05.28.3: 4 files (quote-management.css,quote-management.html,quote-view.js,...)

## v2026.05.28.2 (2026.05.28)

- Deploy v2026.05.28.2: Replace pricing banner with Option D (minimal two-column)

## v2026.05.28.1 (2026.05.28)

- Deploy v2026.05.28.1: 4 files (ACTIVE_FILES.md,server.js,staff-dashboard-legacy.html,...)

## v2026.05.27.5 (2026.05.27)

- Deploy v2026.05.27.5: 2 files (dashboard-v3-theme.css,index.html,...)

## v2026.05.27.4 (2026.05.27)

- Deploy v2026.05.27.4: Fix handbook page header — self-contained topbar styles, strip duplicate intro links

## v2026.05.27.3 (2026.05.27)

- Deploy v2026.05.27.3: Update Ch 2 Expanding Horizons — add laser engraving + Roland, drop Safety Shirts

## v2026.05.27.2 (2026.05.27)

- Deploy v2026.05.27.2: Employee Handbook online reader + hub hero tile

## v2026.05.27.1 (2026.05.27)

- Deploy v2026.05.27.1: 3 files (Employee-Handbook-2026-Updates.pdf,Employee-Handbook-Latest.pdf,build-handbook-pdf.py,...)

## v2026.05.26.5 (2026-05-26)

- Deploy v2026.05.26.5: 1 file (Customer-Supplied-Garments-Acknowledgment.pdf)

## v2026.05.26.4 (2026-05-26)

- Deploy v2026.05.26.4: 3 files (production-shifts.html,app.jsx,styles.css...)

## v2026.05.26.3 (2026-05-26)

- Deploy v2026.05.26.3: 5 files (ACTIVE_FILES.md,production-shifts.html,app.jsx...)

## v2026.05.26.2 (2026-05-26)

- Deploy v2026.05.26.2: 7 files (ACTIVE_FILES.md,production-shifts.html,app.jsx...)

## v2026.05.26.1 (2026.05.26)

- Phase 11.3 (EMB): rich-mode artwork upload + persistence via ImportNotes object
- LESSONS_LEARNED: add Quote Builders section + Phase 11.3 entry
- Phase 11.3.5: lock edits after push — enforce one-way ShopWorks sync
- Phase 11.4 + 11.5: DTG Print Quote + Email Quote buttons (parity with EMB/DTF/SCP)
- Phase 11.6: DTG edit-reopen for pre-push revisions
- LESSONS_LEARNED: add Phase 11.3.5/11.4/11.5/11.6 milestone entry
- Phase 11.7: DTG chrome harmonization — power-header parity with EMB/DTF/SCP
- EMB Chat C: research-only AI chat panel on the Embroidery Quote Builder
- EMB chat FOUC fix — white box no longer flashes over Ask button on load
- LESSONS_LEARNED: EMB chat FOUC fix (CSS in head + hidden attr)
- EMB Smart F1: bot chat panel now renders markdown — tables, links, bold
- FOUC fix v2: !important on [hidden] for ai-chat-panel + backdrop + button
- Deploy v2026.05.26.1: 13 files (LESSONS_LEARNED.md,dtf-quote-builder.html,dtg-quote-builder-legacy.html...)

## v2026.05.24.1 (2026.05.24)

- Phase 0b + Phase 2: pricing baseline CI gate + PNW visual unification
- Phase 2c: kill remaining hardcoded colors — PNW palette across all 3 builders
- Phase 0b.2: retry logic for capture script — kill CI flakiness
- Phase 2d: extend PNW palette to customer-facing pricing calculators
- Changelog v2026.05.23.6
- Phase 2f: PNW palette to Quote Management dashboard header
- Add ROADMAP_2026_05.md — master plan post-Phase 2 deployment
- Add Phase 8 (ShopWorks push) as North Star to roadmap
- Phase 8: DTF push button + handler (frontend side)
- Phase 8: SCP push button + handler (frontend side)
- Phase 8: lift DTF + SCP push gates — production ready
- Phase 9: artwork upload widget — EMB/DTF/SCP
- Phase 10: roadmap update + overnight status report
- Phase 10.7: migrate DTG customer-context-badges to shared helper
- Update OVERNIGHT status doc with DTG customer-context migration commit
- Verify EMB/Cap/Patch builder live + add verification table to status doc
- Phase 10.1: SanMar inventory badges on EMB/DTF/SCP rows
- Update OVERNIGHT status doc — Phase 10.1 (inventory badges) shipped, 10.2 deferred
- Phase 11.1: customer-aware design combobox on DTF + SCP
- Strategic plan: NWCA Quote Builder Unified UX Master Plan
- Phase 11.3 (DTF first): rich-mode artwork upload — design name + per-file placement
- Phase 11.3 (SCP): wire rich-mode artwork upload — design name + per-file placement
- Deploy v2026.05.24.1: extend bulk-sync + invoice auto-sync to cover EMB/SCP/DTF orders (PushedToShopWorks timestamp OR Status=Processed). Lets all 4 builders' ShipStation buttons work via shared infra without touching parallel session's push handlers.

## v2026.05.23.6 (2026.05.23)

- Phase 0b + 2a/2b/2c/2d: pricing baseline CI gate + Pacific Northwest visual unification
- 22-scenario pricing capture script + Jest regression gate (npm run test:pricing-baselines)
- PNW palette tokens (shell.css) applied to all 4 quote builders + 5 customer pricing calculators
- Caspio Pricing_Tiers SCP margins updated (PK_ID 14→0.48, 15→0.50, 16→0.50) — ~$7K-9K/yr lift
- 3-try retry on capture script kills CI flakiness

## v2026.05.23.5 (2026.05.23)

- Deploy v2026.05.23.5: EMB/DTF/SCP — shared customer-context-banners helper

## v2026.05.23.4 (2026.05.23)

- Deploy v2026.05.23.4: Order Form — same CRM-term mapping as DTG

## v2026.05.23.3 (2026.05.23)

- Deploy v2026.05.23.3: DTG terms dropdown — revert to NWCA's 3 offered terms + CRM mapping

## v2026.05.23.2 (2026.05.23)

- Deploy v2026.05.23.2: DTG quote builder — Customer Warning + Tax Exempt + Payment Terms + Phone_Best

## v2026.05.23.1 (2026.05.23)

- Deploy v2026.05.23.1: 3 audit fixes (rushOrder, customer warning, quote URL)

## v2026.05.22.8 (2026.05.22)

- Deploy v2026.05.22.8: Phase 2 change banner on quote-view

## v2026.05.22.7 (2026.05.22)

- Deploy v2026.05.22.7: Quote_Change_Log Phase 1 — diff + write + read endpoints

## v2026.05.22.6 (2026.05.22)

- Deploy v2026.05.22.6: M1 revert + tax-account auto-resolve

## v2026.05.22.5 (2026.05.22)

- Deploy v2026.05.22.5: 1 files (server.js,...)

## v2026.05.22.4 (2026.05.22)

- Deploy v2026.05.22.4: 1 files (quote-management.html,...)

## v2026.05.22.3 (2026.05.22)

- Deploy v2026.05.22.3: 4 files (invoice.html,invoice.js,quote-view.js,...)

## v2026.05.22.2 (2026.05.22)

- Deploy v2026.05.22.2: 1 files (quote-management.html,...)

## v2026.05.22.1 (2026.05.22)

- ShipStation: robust shipTo.name+street1 fallback (digit-count heuristic to detect name-vs-street when ShipAddress01/02 ambiguous)
- ShipStation: only send carrierCode+serviceCode when carrier is configured in account (NWCA has stamps_com only); use requestedShippingService freetext for unconfigured carriers (UPS/FedEx) so warehouse picks at rate-buy time
- Deploy v2026.05.21.28: ShipStation — route ONLY USPS orders to ShipStation (UPS uses WorldShip, FedEx uses carrier tool, pickup needs no label). Invoice button shows 'Ship via WorldShip' hint for UPS orders instead of misrouting to ShipStation.
- ShipStation: route-skip checks (pickup/UPS/FedEx) run BEFORE alreadySent dedup, so a stale ShipStation_Order_ID on a UPS order doesn't block the skip-to-WorldShip response
- ShipStation: enrich items[] with product image URLs from SanMar bulk catalog (COLOR_PRODUCT_IMAGE), cached 24h. Warehouse pickers see actual garment+color in ShipStation order view.
- Deploy v2026.05.21.28: ShipStation — ship-method override modal (UPS/FedEx orders show 'Override → USPS' button → modal lets rep pick Priority Mail / First Class / Ground Advantage on-the-fly; image enrichment via SanMar catalog)
- ShipStation: retry on 404 with salted orderKey (ShipStation reserves keys of deleted orders permanently → 404 on createorder with same orderKey unless we salt it)
- ShipStation: use WO# as orderNumber (warehouse cross-refs with ShopWorks), add weight estimate by garment type, add customField1 (decoration), customField2 (design#), customField3 (RUSH flag)
- ShipStation: use real SanMar PIECE_WEIGHT (lbs→oz) co-fetched with image URL via /api/inventory; hardcoded prefix table is fallback only
- Deploy v2026.05.22.1: 4 files (quote-management.html,quote-view.js,quote-view.html,...)

## v2026.05.21.27 (2026.05.21)

- Deploy v2026.05.21.27: ShipStation Phase 3 — pricing-index /send-to-shipstation endpoint + /shipstation-tracking webhook callback, 🚢 button on invoice toolbar with shipped/awaiting/default states + tracking# link

## v2026.05.21.26 (2026.05.21)

- fix(quote-management): correct SalesRep -> SalesRepEmail field + archive resolved LESSONS_LEARNED entries

## v2026.05.21.25 (2026.05.21)

- Deploy v2026.05.21.25: 2 files (quote-management.css,quote-management.html,...)

## v2026.05.21.24 (2026.05.21)

- Deploy v2026.05.21.24: Phase E audit fixes — M1 split tax-application block into Notes To Accounting (keeps Notes On Order clean for CSR), L4 explicit RUSH checkbox in OF form (replaces fragile Notes-regex detection)

## v2026.05.21.23 (2026.05.21)

- Deploy v2026.05.21.23: Phase C+D audit fixes — H1 customer-record enrichment (Is_Tax_Exempt, Customer_Warning, Payment_Terms), H3 line-item grouping by base SKU, M5 tax-rate edge cases, L1 SOFT_DELETE_RETENTION_DAYS constant + /api/config endpoint

## v2026.05.21.22 (2026.05.21)

- Deploy v2026.05.21.22: Phase B audit fixes — H5 submissionId idempotency guard, M3 block multi-method orders at submit, M4 NWCA_LOCATIONS constant for pickup branch

## v2026.05.21.21 (2026.05.21)

- Deploy v2026.05.21.21: 3 files — Phase A audit fixes: C1 dashboard handles Processed+Failed statuses, C3 Pacific TZ parse helper (server-side + client-side via caspio-date-utils)

## v2026.05.21.20 (2026.05.21)

- Deploy v2026.05.21.20: 2 files — quote-management dashboard handles Cancelled_in_ShopWorks: red badge, filter option, stat card, retention countdown, row tint, exclude from Total Value

## v2026.05.21.19 (2026.05.21)

- Deploy v2026.05.21.19: 11 files — soft-delete (Status=Cancelled_in_ShopWorks) with 30-day audit retention + bulk-sync cron purge; CANCELLED banner on invoice + quote-view

## v2026.05.21.18 (2026.05.21)

- Deploy v2026.05.21.18: 1 files — fix OF push: link line items to design via ExtDesignIDBlock (auto-toggles Apply Designs in SW) + send street in ShipAddress02 (was hardcoded empty)

## v2026.05.21.17 (2026.05.21)

- Deploy v2026.05.21.17: 8 files — wire Phone_Best from CompanyContactsMerge2026 into OF form picker + invoice billingContact fallback

## v2026.05.21.16 (2026.05.21)

- Deploy v2026.05.21.16: 9 files — add billing address to invoice + quote-view (server-side fetch from CompanyContactsMerge2026 by id_Customer)

## v2026.05.21.15 (2026.05.21)

- Deploy v2026.05.21.15: 7 files — QuickBooks invoice polish (RUSH banner, AMOUNT DUE, payment info, size labels, label cleanup)

## v2026.05.21.14 (2026.05.21)

- Deploy v2026.05.21.14: 2 files (invoice.css) — comprehensive print stylesheet rewrite for 1-page PDF fidelity

## v2026.05.21.13 (2026.05.21)

- Deploy v2026.05.21.13: 6 files (invoice.html,invoice.js,dtf-quote-builder.html,...) — fix invoice line prices + decoration label

## v2026.05.21.12 (2026.05.21)

- Deploy v2026.05.21.12: 11 files (ACTIVE_FILES.md,invoice.css,invoice.html,...)

## v2026.05.21.9 (2026.05.21)

- Deploy v2026.05.21.9: multi-design, payments, tracking, action buttons, print styles + bulk-sync endpoint

## v2026.05.21.8 (2026.05.21)

- Deploy v2026.05.21.8: Phase 4e - View Original Submission audit panel with diff highlighting + stale-sync warning

## v2026.05.21.7 (2026.05.21)

- Deploy v2026.05.21.7: show computed tax rate next to Sales Tax (9.50%, 10.10%, etc.) on financial summary

## v2026.05.21.6 (2026.05.21)

- Deploy v2026.05.21.6: 4 files — Phase 4d: Financial summary + Art thumbnails + Billing block + accurate location count from /order-pull

## v2026.05.21.5 (2026.05.21)

- Deploy v2026.05.21.5: 4 files (quote-view.css,quote-view.js,quote-view.html,) — Manual ShopWorks WO# entry (workaround for /v1/getorderno gap)

## v2026.05.21.4 (2026.05.21)

- Deploy v2026.05.21.4: 3 files (quote-view.css,quote-view.js,quote-view.html,) — Phase 4c: Order Status grid + Notes + Shipping panels

## v2026.05.21.3 (2026.05.21)

- Deploy v2026.05.21.3: 3 files (quote-view.css,quote-view.js,quote-view.html,) — Phase 4b: ShopWorks overlay (override email/phone/PO/dates) + new Designs panel

## v2026.05.21.2 (2026.05.21)

- Deploy v2026.05.21.2: 3 files (quote-view.css,quote-view.js,quote-view.html,) — Phase 4a: ShopWorks sync strip (Pending/Imported pill + Refresh button)

## v2026.05.21.1 (2026.05.21)

- Deploy v2026.05.21.1: 1 files (server.js,...) — add quote-sessions ShopWorks sync endpoints (POST /sync-from-shopworks, GET /full)

## v2026.05.20.19 (2026.05.20)

- Deploy v2026.05.20.19: new-artwork upload UI + submit wiring + readiness gates (Phase 2+3)

## v2026.05.20.18 (2026.05.20)

- Deploy v2026.05.20.18: new-artwork upload path Phase 1 — open Designs[] gate when files present

## v2026.05.20.17 (2026.05.20)

- Deploy v2026.05.20.17: remove awkward pine-needle stripes from titlebar

## v2026.05.20.16 (2026.05.20)

- Deploy v2026.05.20.16: PNW theme + CSS tokens (4 files)

## v2026.05.20.15 (2026.05.20)

- Deploy v2026.05.20.15: pickup ShippingAddresses with Customer Pickup marker

## v2026.05.20.14 (2026.05.20)

- Deploy v2026.05.20.14: clear stale pill content on hide

## v2026.05.20.13 (2026.05.20)

- Deploy v2026.05.20.13: 3 files (dtg-quote-builder.html,dtg-inline-form.css,dtg-inline-form.js,...)

## v2026.05.20.12 (2026.05.20)

- Correct MO retention docs: ~2 years, not 60 days
- Deploy v2026.05.20.12: 1 files (server.js,...)

## v2026.05.20.11 (2026.05.20)

- Deploy v2026.05.20.11: 4 files (dtg-quote-builder.html,server.js,dtg-inline-form.css,...)

## v2026.05.20.10 (2026.05.20)

- Deploy v2026.05.20.10: 4 files (dtg-quote-builder.html,server.js,dtg-inline-form.css,...)

## v2026.05.20.9 (2026.05.20)

- Deploy v2026.05.20.9: 1 files (server.js,...)

## v2026.05.20.8 (2026.05.20)

- Deploy v2026.05.20.8: 3 files (dtg-quote-builder.html,server.js,dtg-inline-form.js,...)

## v2026.05.20.7 (2026.05.20)

- Deploy v2026.05.20.7: 3 files (dtg-quote-builder.html,server.js,dtg-inline-form.js,...)

## v2026.05.20.6 (2026.05.20)

- Add WAC citations + WA tax rules doc
- Deploy v2026.05.20.6: 5 files (LESSONS_LEARNED.md,wa-sales-tax-rules.md,dtg-quote-builder.html,...)

## v2026.05.20.5 (2026.05.20)

- Deploy v2026.05.20.5: 5 files (LESSONS_LEARNED.md,dtg-quote-builder.html,server.js,...)

## v2026.05.20.4 (2026.05.20)

- Deploy v2026.05.20.4: stop regenerating combobox menu DOM on hover

## v2026.05.20.3 (2026.05.20)

- Deploy v2026.05.20.3: customer search did-you-mean fallback

## v2026.05.20.2 (2026.05.20)

- Deploy v2026.05.20.2: contact picker — switch between a company's contacts after pick

## v2026.05.20.1 (2026.05.20)

- Deploy v2026.05.20.1: fix customer combobox selection — missing menu.contains guard

## v2026.05.19.14 (2026.05.19)

- Deploy v2026.05.19.14: customer + design comboboxes — fix dropdown position bug

## v2026.05.19.13 (2026.05.19)

- Deploy v2026.05.19.13: Design # picker — customer-aware DTG design dropdown with thumbnails

## v2026.05.19.12 (2026.05.19)

- Deploy v2026.05.19.12: pre-flight readiness panel + tier-break optimization hints

## v2026.05.19.11 (2026.05.19)

- Deploy v2026.05.19.11: line-item card — per-size price + clone + OOS warn + dropdown chevron

## v2026.05.19.10 (2026.05.19)

- Deploy v2026.05.19.10: DTG two-column layout + card-per-line-item form

## v2026.05.19.9 (2026.05.19)

- Deploy v2026.05.19.9: DTG page re-engineered — catalog-first, chatbot as research assistant

## v2026.05.19.8 (2026.05.19)

- Deploy v2026.05.19.8: DTG catalog — per-color units stat + rotated hero color across cards

## v2026.05.19.7 (2026.05.19)

- Deploy v2026.05.19.7: DTG form — auto-hydrate availableSizes when previewStyle has none

## v2026.05.19.6 (2026.05.19)

- Deploy v2026.05.19.6: DTG catalog — second-add fix + hero image swap per color

## v2026.05.19.5 (2026.05.19)

- Deploy v2026.05.19.5: DTG catalog — Shopify-style swatch select + Kornit Storm Hexa rename

## v2026.05.19.4 (2026.05.19)

- Deploy v2026.05.19.4: DTG catalog — fix Phase 2 swatch click + grid breakpoint + exact-style search

## v2026.05.18.16 (2026.05.18)

- Deploy v2026.05.18.16: FORM IS SOURCE OF TRUTH architecture

## v2026.05.18.15 (2026.05.18)

- Deploy v2026.05.18.15: customer panel always below + Another color CTA + bot next-steps

## v2026.05.18.14 (2026.05.18)

- Deploy v2026.05.18.14: portal color dropdown + inline size matrix + fuzzy-match fix

## v2026.05.18.13 (2026.05.18)

- Deploy v2026.05.18.13: DTG chat backdrop transparent — see form behind chat

## v2026.05.18.12 (2026.05.18)

- Deploy v2026.05.18.12: DTG live form mirror + layout unsmush + REP MODE

## v2026.05.18.11 (2026.05.18)

- Deploy v2026.05.18.11: DTG chat — fuzzy color match + adaptive swatch card + AI-touched indicator

## v2026.05.18.10 (2026.05.18)

- Deploy v2026.05.18.10: resetForm preserves rep, resets dirty + shipping

## v2026.05.18.9 (2026.05.18)

- Deploy v2026.05.18.9: DTG UX hardening — 9 fixes

## v2026.05.18.8 (2026.05.18)

- Deploy v2026.05.18.8: stock-confirm modal at Submit time

## v2026.05.18.7 (2026.05.18)

- LESSONS_LEARNED: document DTG LTM Caspio-driven refactor
- Deploy v2026.05.18.7: DTG line items - N/A cells + inventory badges + description tooltip

## v2026.05.18.6 (2026.05.18)

- Deploy v2026.05.18.6: DTG LTM Caspio-driven (4 frontend files)

## v2026.05.18.5 (2026.05.18)

- Deploy v2026.05.18.5: row color swatches + editability hint

## v2026.05.18.4 (2026.05.18)

- Deploy v2026.05.18.4: chat avg-price fix + Copy Chat + form tightening + immediate row render

## v2026.05.18.3 (2026.05.18)

- Deploy v2026.05.18.3: swatch click includes style number

## v2026.05.18.2 (2026.05.18)

- Deploy v2026.05.18.2: 6 files (dtg-quote-builder.html, dtg-inline-form.css, dtg-inline-form.js...)

## v2026.05.18.1 (2026.05.18)

- Deploy v2026.05.18.1: 3 files (dtg-quote-builder.html, dtg-quote-page.css, dtg-quote-page.js...)

## v2026.05.17.4 (2026.05.17)

- Deploy v2026.05.17.4: 3 files (dtg-quote-builder.html, dtg-quote-page.css, dtg-quote-page.js...)

## v2026.05.17.3 (2026.05.17)

- Deploy v2026.05.17.3: 3 files (dtg-quote-builder.html, dtg-quote-page.css, dtg-quote-page.js...)

## v2026.05.17.2 (2026.05.17)

- Deploy v2026.05.17.2: 3 files (dtg-quote-builder.html, dtg-quote-page.css, dtg-quote-page.js...)

## v2026.05.17.1 (2026-05-17)

- Deploy v2026.05.17.1: 6 files (ACTIVE_FILES.md,dtg-quote-builder-legacy.html,dtg-quote-builder.html,...)

## v2026.05.16.7 (2026-05-16)

- Deploy v2026.05.16.7: 7 files (ACTIVE_FILES.md,index.html,webstores.html,...)

## v2026.05.16.6 (2026-05-16)

- Deploy v2026.05.16.6: 1 files (index.html,...)

## v2026.05.16.5 (2026-05-16)

- Deploy v2026.05.16.5: 5 files (ACTIVE_FILES.md,index.html,emblem-pricing-page.css,...)

## v2026.05.16.4 (2026-05-16)

- Deploy v2026.05.16.4: 3 files (ACTIVE_FILES.md,digitized-designs.css,digitized-designs.html,...)

## v2026.05.16.3 (2026-05-16)

- Deploy v2026.05.16.3: 6 files (SKILL.md,SKILL.md,ACTIVE_FILES.md,...)

## v2026.05.16.2 (2026.05.16)

- Release v2026.05.16.2

## v2026.05.16.1 (2026.05.16)

- Release v2026.05.16.1

