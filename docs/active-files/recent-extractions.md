# Rule 3 extraction — 2026-09-05 (inline `<style>` / `<script>` moved to files, same cascade/execution position)

Fifteen staff-dashboard pages still carried inline code (found by the 2026-09-05 page audit). Each block was moved verbatim into an external file linked at the exact position the inline tag held, so cascade order and script execution order are unchanged. JSON-LD `<script type="application/ld+json">` blocks (custom-stickers, custom-banners) are data and stayed inline.

| File | Purpose | Dependencies | Status |
|------|---------|--------------|--------|
| `/dashboards/css/art-hub-steve.css` | Steve's queue: the green `--art-theme` override + the `#steve-grid-view .sg-toolbar` / grid styles that were two inline `<style>` blocks | art-hub.css (loads before) | ✅ Active |
| `/dashboards/css/art-hub-ruth.css` | Ruth's hub: the purple `--art-theme` override (was inline) | art-hub.css | ✅ Active |
| `/dashboards/css/names-numbers-dashboard.css` | Names & Numbers dashboard KPI row / table styles (was inline) | names-numbers.css | ✅ Active |
| `/training/css/sales-coordinator-manual.css` + `/training/js/sales-coordinator-manual.js` | Sales Coordinator manual: 13 KB of page styles and the 19 KB chapter navigator (`showChapter` etc.) that were inline | — | ✅ Active |
| `/training/css/customer-service.css` + `/training/js/customer-service.js` | Customer Service training page styles + TOC smooth-scroll script (were inline) | — | ✅ Active |
| `/training/css/quick-reference-tips.css` + `/training/js/quick-reference-tips.js` | Quick Reference Tips styles + the tips loader/filter (were inline) | /api tips endpoint (unchanged) | ✅ Active |
| `/training/css/training-games-hub.css` + `/training/js/training-games-hub.js` | Training Games hub styles + filter pills (were inline) | — | ✅ Active |
| `/calculators/css/purchasingform.css` + `/calculators/js/purchasingform.js` | Purchase Request (JotForm embed) page styles + the post-load JotForm styling hook (were inline) | JotForm embed script | ✅ Active |
| `/dashboards/js/taneisha-crm.js`, `/dashboards/js/nika-crm.js` | `window.REP_CONFIG` for each rep's CRM page (was an inline config script) — must load BEFORE rep-crm.js | rep-crm.js | ✅ Active |
| `/calculators/embroidery-pricing-all/embroidery-pricing-all-inline.js` | The `?tab=` deep-link bootstrap that ran inline BEFORE the main calculator script (kept as a sibling so the order is exact — never appended to the main file) | embroidery-pricing-all.js | ✅ Active |
| `/calculators/screenprint-customer/screenprint-customer.js` | DOMContentLoaded bootstrap for the customer screen-print calculator (was inline) | screenprint-customer-calculator.js | ✅ Active |
| `/dashboards/js/commission-structure.js` | `toggleAccordion()` for the commission structure page (was inline) | — | ✅ Active |
| `/dashboards/reports/price-audit-report.js` | Rep-name table filter for the price audit report (was inline) | — | ✅ Active |
| `/dashboards/js/digitized-designs.js` | Digitized designs gallery: image modal + filtering (18 KB, was inline) | digitized-designs.css | ✅ Active |
| `/training/css/*.css` + `/training/js/*.js` (22 more pages, 2026-09-05 sweep 3) | Same extraction for every Training Center sub-page that still had inline blocks: api-test-runner, art-approval-guide, bonus-policy, cap-training (css only), customer-categorization-training, get-to-know-erik, google-review-guide, lead-email-templates, lead-follow-up-guide, lead-sheet-guide, lead-source-training, nwca-language-reference (css only), sales-coordinator-training-schedule, sales-tax-code-trainer, shopworks-customer-setup (+ -enhanced, -working), shopworks-embroidery-order-type (css only), shopworks-notes, shopworks-sales-tax-training, team-match-game, thank-you-card-guide. One `<basename>.css` / `<basename>.js` per page, linked where the inline tag stood. | — | ✅ Active |
| `/dashboards/css/DrainPro-Bundle.css` + `/dashboards/js/DrainPro-Bundle.js` | (bundle-orders-dashboard + staff-portal-simple css deleted 2026-09-06 with their pages) Inline blocks extracted from the DrainPro bundle storefront, the bundle-orders dashboard and the legacy simple portal (2026-09-05). | — | ✅ Active |
| `/tests/unit/staff-pages-consistency.test.js` | **NEW (2026-09-05)** Repo-wide lock over every `dashboards/`, `dashboards/reports/`, `training/` page plus the staff-facing `pages/` and calculator pages: no inline `<style>`/`<script>` bodies (JSON-LD allowed), ONE Font Awesome build (6.4.0), a site-hosted favicon (never Caspio CDN), and the Sales Coordinator manual's data-driven chapter navigation. | jest | ✅ Active |
| `/tests/unit/quote-builders-page.test.js` | **NEW (2026-09-05)** Structural lock for the 4 quote builders (pricing math is covered by parity + per-method tests): no `onclick=` in the 4 pages, the builder modules, or the classic shared scripts they load (utils, order-summary, extended-sizes); the data-call delegator exists and behaves in jsdom (args, `$this`, data-stop, data-toggle-hidden, missing-fn toast); no `alert()`/`console.log` in builder modules; `.os-*` + DTG form inputs labelled; every page has `#toast-container` | jest; quote-builder-utils.js, builders/* | ✅ Active |

| `/tests/unit/proxy-review-relays.test.js` | Proxy review regression coverage: staff contact relays, secret forwarding, legacy cart gates, same-origin browser lookups | Jest; local mocked upstream | Active |

| `/memory/HANDOVER_EXECUTION_2026-09.md` | Execution checklist and verification record for the 2026-09-08 handover | Dependencies, server split, lint, CI, housekeeping | Active |

| tests/unit/rate-limit-behavior.test.js | Actual limiter middleware: login quota, IPv6 subnet grouping and staff exemption | Dependency upgrade regression | Active |

| lib/stripe-client.js | Shared Stripe client, explicitly preserves API version across SDK upgrades | Server and portal ctx | Active |
| tests/unit/stripe-sdk-contract.test.js | Intercepted checkout APIs and signed HTTP webhook regression coverage | Fake keys, no external writes | Active |

| `/tests/unit/calculator-api-errors.test.js` | Product loader behavior: failed color/size APIs keep pricing hidden and show the existing error banner; stale size pricing cleared; successful API data preserved | EMB + cap calculators | Active |
| `/tests/unit/sample-inventory-status.test.js` | Vendor inventory status/messages for available, unavailable and low-stock sizes; mocked API response | Sample inventory service | Active |

| `/lib/quote-sync-access.js` | Shared-secret/staff gate for scheduled quote sync and tracking callbacks | Server and quote routes | Active |
| `/tests/unit/quote-sync-access.test.js` | Real route access checks, scoped customer links and authenticated internal calls with mocked upstreams | Jest | Active |

| `lib/storefront/channels.js` | Storefront service factory; one cache/state owner per app | Server context | Active |
| `lib/storefront/custom-caps.js` | Storefront service factory; one cache/state owner per app | Server context | Active |
| `lib/storefront/custom-tees.js` | Storefront service factory; one cache/state owner per app | Server context | Active |
| `lib/storefront/index.js` | Storefront service factory; one cache/state owner per app | Server context | Active |
| `lib/storefront/inventory.js` | Storefront service factory; one cache/state owner per app | Server context | Active |
| `lib/storefront/tax.js` | Storefront service factory; one cache/state owner per app | Server context | Active |
| `lib/storefront/three-day-tees.js` | Storefront service factory; one cache/state owner per app | Server context | Active |
| `routes/storefront-gallery.js` | Public gallery pricing and merchandising route; registration order retained | Server context | Active |
| `tests/unit/storefront-services.test.js` | Fifteen original/extracted contracts for cache scope/expiry, failures, tax and pricing inputs | Mocked APIs and pricing boundaries; pure pricing parity remains separate | Active |

### Payment services (2026-09-07)

| File | Purpose | Owner | Status |
|---|---|---|---|
| `routes/stripe-webhook.js` | Payment verification, quote records or fulfillment stage | Server payment composition | Active |
| `lib/payments/alerts.js` | Payment verification, quote records or fulfillment stage | Server payment composition | Active |
| `lib/payments/deposits.js` | Payment verification, quote records or fulfillment stage | Server payment composition | Active |
| `lib/payments/email-transport.js` | Payment verification, quote records or fulfillment stage | Server payment composition | Active |
| `lib/payments/index.js` | Payment verification, quote records or fulfillment stage | Server payment composition | Active |
| `lib/payments/order-emails.js` | Payment verification, quote records or fulfillment stage | Server payment composition | Active |
| `lib/payments/order-records.js` | Payment verification, quote records or fulfillment stage | Server payment composition | Active |
| `lib/payments/quote-emails.js` | Payment verification, quote records or fulfillment stage | Server payment composition | Active |
| `lib/payments/quote-integrity.js` | Payment verification, quote records or fulfillment stage | Server payment composition | Active |
| `lib/payments/quote-links.js` | Payment verification, quote records or fulfillment stage | Server payment composition | Active |
| `lib/payments/quote-payment.js` | Payment verification, quote records or fulfillment stage | Server payment composition | Active |
| `lib/payments/samples-fulfillment.js` | Payment verification, quote records or fulfillment stage | Server payment composition | Active |
| `lib/payments/storefront-payment.js` | Payment verification, quote records or fulfillment stage | Server payment composition | Active |
| `tests/unit/payment-fulfillment.test.js` | Failed payment writes, redelivery and fulfillment outcomes | Mocked APIs and notifications | Active |
| `tests/unit/payment-integrity.test.js` | Payment HMAC, customer links, exact lookup and authoritative deposit configuration | Mocked services and test secrets | Active |
| `tests/unit/shipstation-submit-contract.test.js` | Existing ShipStation handler behavior before decomposition; all upstream calls mocked | Approved handover section 1 | Active |

### ShipStation submission stages (2026-09-07)

| File | Purpose | Owner | Status |
|---|---|---|---|
| `lib/shipstation/prepare.js` | Snapshot and carrier selection | Quote synchronization | Active |
| `lib/shipstation/billing.js` | Authenticated billing enrichment | Quote synchronization | Active |
| `lib/shipstation/items.js` | Grouped items and shared metadata cache | Quote synchronization | Active |
| `lib/shipstation/payload.js` | Warehouse payload composition | Quote synchronization | Active |
| `lib/shipstation/delivery.js` | Authenticated delivery and bounded 404 retry | Quote synchronization | Active |
| `lib/shipstation/submit.js` | HTTP orchestration and bookkeeping | Quote synchronization | Active |

| `routes/policies-assist.js` | Existing staff policy AI streaming route, registered in original position | Role-gated forwarder | Active |
| `routes/product-pages.js` | Product HTML/SEO and sitemap routes, registered in original position | Public product pages | Active |

[Back to the registry index](../../ACTIVE_FILES.md)
