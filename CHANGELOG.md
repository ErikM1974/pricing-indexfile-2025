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

