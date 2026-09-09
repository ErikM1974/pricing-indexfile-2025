# 🧪 Automated Testing System

Reviewed: tests/e2e/css-unification-staff-import.spec.js and tests/fixtures/staff-import-review-data.json cover shared SanMar file tools with synthetic files and mocked downloads.

**Created:** 2025-10-03
**Purpose:** Comprehensive automated testing for all screen print calculators

### CSS migration browser contracts (2026-09-08)

| File | Purpose | Status |
|------|---------|--------|
| `/tests/e2e/css-unification-art-details.spec.js` | Mocked Steve/AE/art-detail/customer layouts and workflow state checks; no live writes. | Active |
| `/tests/unit/transfer-relays.test.js` | Real relay/session/parser contracts with mocked upstream services; browser caller boundary and downloads. | Active |
| `/tests/e2e/transfer-auth.spec.js` | Actual-server staff HTML and anonymous API authentication checks; no business writes. | Active |
| /tests/e2e/css-unification-art.spec.js | Mocked art workflow migration states, responsive layouts, request recovery and keyboard previews (2026-09-08). | Active |
| `/tests/unit/dtg-pricing-readiness.test.js` | Controlled pending, partial, stale response and immutable snapshot pricing regressions; no network (2026-09-08). | Active |
| `/tests/e2e/css-unification-bradley.spec.js` | Mocked Bradley queues/details, keyboard dialogs, image previews and screenshot import at four widths (2026-09-08). | Active |
| `/tests/e2e/css-unification-workspaces.spec.js` | Mocked Vault and Publisher states: windowed scrolling, overlays, saved drafts, failed uploads and publication gates (2026-09-08). | Active |
| `/tests/unit/css-runtime-inventory.test.js` | Census guard for route aliases, dynamic CSS, generated documents, served archives and tracked HTML coverage (2026-09-08). | Active |
| `/tests/unit/css-migration.test.js` | CSS ownership, byte budgets, token resolution and pre-migration billing content lock | Active |
| `/tests/e2e/css-unification.spec.js` | Mocked queue, inquiry, component reference and billing states; never submits live business data | Active |

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

[Back to the registry index](../../ACTIVE_FILES.md)

- `tests/e2e/css-unification-training.spec.js`: training guide layouts, keyboard tables/accordions, clipboard feedback and complete print output. All business services/writes blocked.

- `tests/e2e/css-unification-training-service.spec.js`: four service guides, fourteen keyboard disclosures, phone tables/help, image loading/failure/retry, no-controller reading and print. All business services/writes mocked.

- `tests/e2e/css-unification-printable-forms.spec.js`: 17 printable twins at four widths, keyboard table regions, clear/cancel, paper pages and shared lookup/save/date state checks. All business services/writes mocked. Source text/field contracts live in css-migration.test.js.

- `tests/e2e/css-unification-training-practice.spec.js`: twenty mocked cases, four-width layouts/axe, keyboard/touch/drag, complete game rounds, timers, copy/editor/storage failures and real reference PDFs. Original lesson text and seven JS fixture objects are locked in css-migration.test.js.


- `tests/e2e/css-unification-training-reference.spec.js` — responsive/axe, cap content, quick-tip search/errors/rich text, shared checklist storage/navigation and real PDF coverage.
- `tests/e2e/css-unification-training-manual.spec.js` — responsive/axe, all manual/day sections, keyboard disclosures, practice/roster and complete PDF state restoration.

- `tests/e2e/css-unification-training-final.spec.js` — 21 mocked checks: final four training pages, responsive/axe, every mode, native dialogs, complete/restarted rounds, live-list retry, storage/timer failures and compact real PDF output.
- `tests/unit/training-final-content.test.js` + `tests/fixtures/training-final-original-content.json` — original course literals, prose, fields/options and navigation.

- `tests/e2e/css-unification-api-reference.spec.js` — four reference pages at four widths, search/empty/escaping, ODBC disclosure/stored-only/load retry, paper content/state and unchanged real authentication gates; business calls mocked.
- `tests/unit/api-reference-content.test.js` + `tests/fixtures/api-reference-original-content.json` — original technical prose, fields/options, links, reference literals and ODBC schema bytes.

- `tests/e2e/css-unification-policy-reference.spec.js` — policy migration filters/retry/empty, guide contents/history/top, notices and all four paper layouts; calls are mocked.
- `tests/unit/policy-reference-content.test.js` + `tests/fixtures/policy-reference-original-content.json` — original policy prose/figures, routes/IDs/fields and migration snapshot.

- `tests/e2e/css-unification-policy-cms.spec.js` — unified policy CMS, mocked reads/writes, responsive controls, role and paper checks; original locks in `tests/unit/policy-cms-content.test.js`.

- `tests/e2e/css-unification-webstore.spec.js`, `tests/unit/webstore-content.test.js`, and `tests/fixtures/webstore-original-content.json` — twelve webstore marketing pages; original copy/SEO/images/destinations, native FAQs/navigation and responsive/print contracts.

- `tests/e2e/css-unification-brand-guides.spec.js`, `tests/unit/brand-guide-content.test.js`, `tests/fixtures/brand-guide-original-content.json`: all fifteen brand guides; preserved copy/SEO/products/links/search fields, native mobile menu/focus, four widths/axe and complete paper.

- `tests/fixtures/staff-reference-original-content.json` — preserved source baseline for five staff references.

- Staff references: `tests/unit/staff-reference-content.test.js` and `tests/e2e/css-unification-staff-reference.spec.js` cover original source data, all five layouts and mocked service/print states; all business writes are blocked.

- `tests/fixtures/entry-status-original-content.json` — complete original copy, fields, images, links and controller hashes for three sign-in and three confirmation pages.

- Entry/status: `tests/unit/entry-status-content.test.js` and `tests/e2e/css-unification-entry-status.spec.js` preserve original content, all three fulfillment controller hashes, sign-in validation/privacy/error/retry and confirmation status/paper. Shared field styling replaces legacy CSS selector locks in customer-login-page.test.js; real browser assertions cover focus/invalid styling.

- `tests/unit/catalog-discovery-content.test.js`, `tests/e2e/css-unification-catalog-discovery.spec.js`, `tests/fixtures/catalog-discovery-original-content.json` — original catalog copy/curation, named brand links, four widths/native menus, actual server label passthrough, failure/malformed/retry/filters/broken images and populated paper.

- tests/unit/campaign-storefront-content.test.js + tests/fixtures/campaign-storefront-original-content.json: complete original content and financial/controller preservation for three golf/safety pages.

- tests/e2e/css-unification-campaign-storefront.spec.js: campaign layout and delivery outcome browser coverage with mocked business services.

- Instant storefront: tests/unit/instant-storefront-content.test.js; tests/e2e/css-unification-instant-storefront.spec.js; original-content and pricing fixtures in tests/fixtures.

Customer intake: customer-intake-content.test.js and css-unification-customer-intake.spec.js use the preserved customer-intake-original-content.json fixture. All vendor content and business writes mocked.

Vendor portals: vendor-portals-content.test.js and css-unification-vendor-portals.spec.js preserve original wrapper/Caspio contracts and synthetic vendor states using vendor-portals-original-content.json.

Hosted announcement verification: tests/fixtures/announcements-original-content.json preserves original wrapper content/provider IDs and both controller hashes; tests/unit/announcements-content.test.js checks those contracts. tests/e2e/css-unification-announcements.spec.js covers four widths/axe, native navigation/keyboard scrolling, loaded/unavailable/login/empty provider fixtures and complete synthetic reference printing. All real business writes blocked. Vendor browser/source checks now point at the shared hosted arrangement with their prior assertions retained.

Staff admin source contracts: tests/fixtures/staff-admin-original-content.json and tests/unit/staff-admin-content.test.js preserve all original content/IDs/dependencies and reverse only explicit UI-class/heading/pressed-state edits before checking controller hashes. Existing admin/reference and portal-directory hygiene guards now read the shared CSS owner; API/feed/preview/copy/error guards remain.

- tests/e2e/css-unification-staff-admin.spec.js — Synthetic staff roles, drive access and portal behavior, responsive/accessibility/print review; all writes mocked.
- tests/fixtures/staff-admin-review-data.json — Synthetic staff admin browser fixtures; no real permission or account records.

Staff monitoring review sources: tests/unit/staff-monitoring-content.test.js, tests/fixtures/staff-monitoring-original-content.json, tests/fixtures/staff-monitoring-review-data.json and tests/e2e/css-unification-staff-monitoring.spec.js. Synthetic API fixtures, preserved163-table snapshot/source hashes and explicit controller edits; all real business requests blocked.

Staff import source checks: tests/unit/staff-import-content.test.js and tests/fixtures/staff-import-original-content.json preserve original static content/dependencies plus four controller/transform sources, reversed through nine exact recorded edits. Existing sanmar-shopworks-parts.test.js retains the financial/SKU conversion locks.

Staff file tools: SanMar Downloads and SanMar → ShopWorks Parts share tokens/components/Public Sans and shared_components/css/staff-import-tools.css; two local sheets retired. Canonical buttons/data tables, native named file input, skip links and focused scrolling regions retain all original prose/IDs/dependencies and source-locked financial/SKU transforms. Malformed FTP listings and missing converter libraries report visible failures with retry/file retention.17 mocked browser cases cover four widths/zero axe, exact synthetic FTP download query/bytes, CSV/TSV/XLSX conversion, errors and recovery. Two one-page portrait PDFs retain70 checked content/data blocks, visually reviewed; print hides only action controls and their empty download column. All real business writes/imports/uploads/emails blocked. A tiny temporary loopback server serves only synthetic CSV because browser-managed attachments bypass page routing; request assertions observe that server and compare actual downloaded bytes.

Purchasing review fixtures: tests/fixtures/purchasing-review-data.json contains dated synthetic feed/invoice/import/CSV data derived from the existing UI harnesses; tests/fixtures/purchasing-original-content.json preserves original page and controller/helper contracts plus explicit edits. No live reads/writes used to make the fixture. Browser/source tests follow.
Purchasing review files added: tests/e2e/css-unification-purchasing.spec.js and tests/unit/purchasing-content.test.js use synthetic request/invoice/import/export fixtures, source contracts and original controller hashes. Four-width accessibility, keyboard, complete paper, failures/recovery, download bytes, mock-only stamping and legacy AE viewer compatibility; review pending.

Purchasing Portal and SanMar Payables reviewed: shared purchasing-workspaces.css and opt-in vendor-invoice.css use canonical tokens, controls, data tables, named file input and native invoice dialog. Bradley slate and existing payables ownership retained. Two old page sheets retired across production/harness HTML; AE keeps its legacy invoice CSS with the same updated controller version.24 mocked browser cases cover four widths/zero axe, keyboard/focus, source filters, exact CSV values, mock-only import confirmation/cancellation/failure, visible unknown balances and optional feed recovery, concurrent lookup protection and legacy AE compatibility. Four one-page PDFs preserve176 checked reading/data/current-field blocks; invoice columns, totals and failed PO notes verified together. Original five controller/helper hashes reverse through50 documented UI/load-validation edits; money/CSV calculations unchanged. The AE page and other generated-document families receive no review credit.

Added tests/fixtures/asset-library-review-data.json: synthetic finished-photo lookup/gallery/design/provider-wrapper states and additional-logo pricing fixture, derived from the existing inert library stub and original fallback schema. No provider app or real business records executed.

Photo family review now covers capture/library first; both Caspio design pages remain original and receive no credit until their provider-boundary review. Added tests/e2e/css-unification-photos.spec.js, tests/unit/photo-content.test.js and tests/fixtures/photo-original-content.json alongside asset-library-review-data.json. Checks cover responsive/keyboard/dialogs, stale or malformed reads, explicit publication status, synthetic image upload and preserved compression/API helpers. A failed manage action now has its own always-visible status in the manage section. Nothing has been published by these fixture reviews.

Reviewed photo family: shared_components/css/photo-workspaces.css owns capture/library arrangements across dashboards/finished-photos.html, dashboards/finished-photos-library.html and tests/ui/test-finished-photos-library.html. Two old photo sheets retired.22 mocked browser checks cover four widths/zero axe, native camera/album fields, exact synthetic JPEG resizing/upload metadata, customer/rep filters, errors remaining visible through filtering, publish/delete confirmation failures and delayed customer/image responses.28 printed content blocks retained across three pages/two PDFs.46 explicit controller edits reverse to eight original controller/helper hashes; image compression, URL resolution and API payload structure preserved. The library graph falls from164,116 to68587LFbytes; capture grows from34,293 to the same shared graph because it now loads canonical components. This is a maintenance/consistency gain on capture, not a per-page byte reduction. Caspio design pages remain original and unreviewed.

Design-library review in progress: tests/fixtures/design-library-review-data.json, tests/fixtures/design-library-original-content.json, tests/e2e/css-unification-design-libraries.spec.js, tests/unit/design-library-content.test.js cover synthetic nested Caspio forms/results, mobile provider precedence, search errors, pricing, clipboard dialogs, paper content and original source preservation. No production records are included.

Reviewed design libraries: dashboards/digitized-designs.html and dashboards/old-designs.html load tokens/components/design-libraries.css plus the explicitly inventoried design-library-provider.css. The helper shared_components/js/design-library-ui.js preserves provider field names and submit handlers, adapts nested mobile form/results and hides only cloned source definitions. Neutral reference/amber archive retained. Fifteen focused browser cases cover four widths, zero fixture axe violations, complete five-tier AL and full-back prices, visible reference fallback, dialogs/keyboard, exact clipboard values, failed/empty/recovered search and replacement forms. Two PDFs/three pages retain39visible text/current-filter blocks. Six suites/220source/CSS checks and286CSSfiles clean.31recorded controller UI edits reverse to six original hashes. Actual read-only Caspio queries returned24records per page without business writes; private actual data is not in Git. Two old sheets retire275flags;77exact provider exceptions remain, ordinary app owner zero. Both CSS graphs74123LFbytes versus34,811/61,697: consistency/maintenance gain with larger payloads, not a byte-reduction claim. Original hidden/focus/typed-button tests now follow shared owners and always-visible actions. Initial strict-locator, incomplete mock select tags and print-context exception matching errors were corrected.

Preview-tool draft tests: tests/fixtures/preview-tools-review-data.json, tests/fixtures/preview-tools-original-content.json, tests/unit/preview-tools-content.test.js, tests/e2e/css-unification-preview-tools.spec.js capture synthetic gallery/tool responses, customer-only fields, errors/retry, keyboard/dialog state and original UI/helper hashes. Further DST and JDS output fixtures still required. No live customer data.

Reviewed preview tools: pages/design-view.html, pages/dst-viewer.html and pages/jds-mockup-creator.html now share canonical UI controls/type/focus and two scoped layout owners. Native file inputs stay visible. Gallery excludes internal fields and reports failed/malformed/image states; DST keeps its dark instrument role, accessible thread dialog, keyboard stats and fitted resize behavior; tumbler retains oxblood identity with latest-image protection and retryable failures. Sixteen focused browser cases pass at1440/768/390/320 with zero fixture axe findings. Eight suites/748source/CSS/historical guards pass. Eight original script hashes preserved outside38 mapped UI edits. Five actual downloads match original bytes and filenames: DST1166×662stitchout/1410×1600garment; JDS1840×1980framed/1800×1800bare/1708×1178comparison. Two reviewed PDFs each one page retain all original text words; gallery shrank from two pages. Original approval fonts remain an output boundary. No real business writes/uploads/messages. Three old sheets/seven important flags removed; new owners zero. Existing historical gallery guards follow its new owner and semantically inspect hidden dialog attributes. Zero-size ResizeObserver callbacks while printing and print-rule order are regression-covered. LESSONS_LEARNED now254lines;15 already-archived short references moved to the archive before adding the preview lesson. CSS byte budgets measured honestly: shared ownership increases these three graphs.
