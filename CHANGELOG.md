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

