# Active Files Registry

Reviewed: shared_components/css/purchasing-workspaces.css — canonical Purchasing Portal and Payables arrangements; two legacy page owners retired.

Reviewed: shared_components/css/vendor-invoice.css — native opt-in purchasing invoice dialog and complete printed documents; legacy AE CSS retained with compatibility coverage.

Reviewed: tests/e2e/css-unification-staff-import.spec.js and tests/fixtures/staff-import-review-data.json — synthetic downloads and conversions, all business traffic blocked.

Reviewed: shared_components/css/staff-import-tools.css — shared SanMar download/conversion arrangements; two legacy page owners retired.

Last updated: 2026-09-08 — shared manual navigation/layout, four consumers, two retired scripts and full chapter/content/print checks.

| Area | Registry |
|---|---|
| ⚠️ Root Directory JavaScript Files (Legacy Location) | [root-files.md](docs/active-files/root-files.md) |
| 🎯 Core Entry Points | [entry-points.md](docs/active-files/entry-points.md) |
| 📊 Calculators & Quote Builders | [calculators-and-builders.md](docs/active-files/calculators-and-builders.md) |
| 🔧 Services & Components | [services-and-components.md](docs/active-files/services-and-components.md) |
| 🎨 Stylesheets | [stylesheets.md](docs/active-files/stylesheets.md) |
| 📚 Documentation & Guides | [documentation.md](docs/active-files/documentation.md) |
| 📂 Dashboard & Admin | [dashboards-and-admin.md](docs/active-files/dashboards-and-admin.md) |
| 🗑️ Recently Removed (For Reference) | [removals.md](docs/active-files/removals.md) |
| 📊 Statistics | [historical-statistics.md](docs/active-files/historical-statistics.md) |
| ⚠️ Files Requiring Attention | [historical-attention.md](docs/active-files/historical-attention.md) |
| 📁 Additional Directories | [additional-directories.md](docs/active-files/additional-directories.md) |
| 🧪 Automated Testing System | [testing.md](docs/active-files/testing.md) |
| 🔄 Update Protocol | [update-protocol.md](docs/active-files/update-protocol.md) |
| Rule 3 extraction — 2026-09-05 (inline `<style>` / `<script>` moved to files, same cascade/execution position) | [recent-extractions.md](docs/active-files/recent-extractions.md) |

Update the relevant area document after every create, delete or move, then update this date. The documents linked above register themselves here. [Update protocol](docs/active-files/update-protocol.md) explains the process.

Historical counts are retained as audit notes and must not be presented as current totals. For current coverage, use Git inventory, the route table and the build asset manifest.

- `shared_components/css/training-practice.css` — scoped training practice layouts, game states and document rhythm; seven training consumers use shared component primitives.
- `shared_components/js/training-practice.js` — shared training mode states, keyboard selection feedback and safe delegated action arguments.

- `tests/e2e/css-unification-training-practice.spec.js` — four-width layouts/accessibility, keyboard/touch exercises, template filtering/copy/local saves/errors and printed reference checks.

- Retired `training/css/training-shared.css` after the last seven HTML consumers migrated; maintained owners are training-guide.css and training-practice.css.

- `shared_components/css/training-reference.css` — scoped reference layouts for cap training, quick tips, shipping and purchasing; existing components/training-guide own controls and tables.
- `shared_components/js/training-reference.js` — shared guide printing, accessible navigation and local checklist persistence/failure states.
- Retired `training/shipping-receiving-guide.js` and `training/sanmar-purchasing-guide.js`; both consumers now use training-reference.js with their original storage prefixes.


- `tests/e2e/css-unification-training-reference.spec.js` — responsive/axe, cap content, quick-tip search/errors/rich text, shared checklist storage/navigation and real PDF coverage.


- `shared_components/css/training-manual.css` — shared manual contents, reading layout and print contract.
- `shared_components/js/training-manual.js` — chapter/hash navigation, biography disclosure and print-state restoration.

- Retired training/js/customer-service.js and training/js/get-to-know-erik.js; their pages now load training-manual.js.
- `tests/e2e/css-unification-training-manual.spec.js` — responsive/axe, all manual/day sections, keyboard disclosures, practice/roster and complete PDF state restoration.

- `shared_components/css/training-simulator.css` — shared exercise controls, scoreboards, questions and native results dialog for the last training family.

- `tests/e2e/css-unification-training-final.spec.js` — final training family: four widths, keyboard/axe, hub failure/retry, exercise grading/restart and storage/timer state.

- `tests/fixtures/training-final-original-content.json` — pre-migration lesson literal hashes, prose, fields and navigation from 20d3e247.
- `tests/unit/training-final-content.test.js` — original training material and field/options preservation.

- `shared_components/css/api-reference.css` — unified internal API reference layout, search, endpoint/field tables and print contract; owns the four dashboard reference pages.

- `tests/fixtures/api-reference-original-content.json` — unified API references: original content/data/schema locks and responsive/search/disclosure/retry/print/access checks.
- `tests/unit/api-reference-content.test.js` — unified API references: original content/data/schema locks and responsive/search/disclosure/retry/print/access checks.
- `tests/e2e/css-unification-api-reference.spec.js` — unified API references: original content/data/schema locks and responsive/search/disclosure/retry/print/access checks.

- `tests/fixtures/policy-reference-original-content.json` — policy guide, migration tracker and two notices: preserved content/data plus responsive/filter/retry/navigation/print checks.
- `tests/unit/policy-reference-content.test.js` — policy guide, migration tracker and two notices: preserved content/data plus responsive/filter/retry/navigation/print checks.
- `tests/e2e/css-unification-policy-reference.spec.js` — policy guide, migration tracker and two notices: preserved content/data plus responsive/filter/retry/navigation/print checks.

- `pages/css/policy-workspace.css` — renamed Policies Hub shared owner; all four CMS/handbook pages opt in to unified controls. Replaces `pages/css/policies-hub-v2.css`.

- `shared_components/js/policies/policy-workspace.js` — native policy contents, read-only table scrolling and shared control classes; preserves editor-owned DOM.

- `tests/fixtures/policy-cms-original-content.json` — policy CMS original-content/data and mocked responsive/state/print verification.
- `tests/fixtures/policy-cms-data.json` — policy CMS original-content/data and mocked responsive/state/print verification.
- `tests/unit/policy-cms-content.test.js` — policy CMS original-content/data and mocked responsive/state/print verification.
- `tests/e2e/css-unification-policy-cms.spec.js` — policy CMS original-content/data and mocked responsive/state/print verification.

- `shared_components/js/webstore-guide.js` — twelve public webstore guides: native fragment focus and FAQ print expansion/restoration; no business-service calls.
- `pages/css/company-webstores.css` — rebuilt scoped public webstore family owner; replaces these pages’ borrowed golf layout.

- `tests/fixtures/webstore-original-content.json` — public webstore content/SEO and responsive, native navigation, FAQ and paper verification.
- `tests/unit/webstore-content.test.js` — public webstore content/SEO and responsive, native navigation, FAQ and paper verification.
- `tests/e2e/css-unification-webstore.spec.js` — public webstore content/SEO and responsive, native navigation, FAQ and paper verification.

- `shared_components/css/storefront-shell.css` — fifteen public brand guides; shared storefront shell, preserved source content, native menu/search and responsive/paper coverage.
- `pages/css/brand-guide.css` — fifteen public brand guides; shared storefront shell, preserved source content, native menu/search and responsive/paper coverage.
- `shared_components/js/storefront-navigation.js` — fifteen public brand guides; shared storefront shell, preserved source content, native menu/search and responsive/paper coverage.
- `tests/fixtures/brand-guide-original-content.json` — fifteen public brand guides; shared storefront shell, preserved source content, native menu/search and responsive/paper coverage.
- `tests/unit/brand-guide-content.test.js` — fifteen public brand guides; shared storefront shell, preserved source content, native menu/search and responsive/paper coverage.
- `tests/e2e/css-unification-brand-guides.spec.js` — fifteen public brand guides; shared storefront shell, preserved source content, native menu/search and responsive/paper coverage.
- Renamed `pages/css/custom-carhartt.css` and `pages/js/custom-carhartt.js` to the brand-guide owners above; all fifteen consumers updated.

- `shared_components/js/staff-reference.js` — five staff reference pages: preserve accordion state across complete printing; native fragment focus.
- `tests/fixtures/staff-reference-original-content.json` — original five-page prose, links, images, field/ID inventory and style graphs.

- `shared_components/css/staff-reference.css` — shared reading/print and visible source warning contract for five staff reference pages; standard shell/controls stay in components.css.

- `tests/unit/staff-reference-content.test.js` — five staff guides preserve original full reference text, fields, links and imagery.
- `tests/e2e/css-unification-staff-reference.spec.js` — staff references at four widths, real access gates, mocked valid/malformed/failed data, source warnings, retry, navigation and paper.

- `shared_components/css/access-shell.css` — shared staff/customer/vendor sign-in shell; existing login sheets keep only page arrangements.
- `pages/css/order-confirmation.css` — all three storefront confirmation pages; replaces and retires `pages/css/3-day-tees-success.css` and `pages/css/custom-tees-success.css`.
- `tests/fixtures/entry-status-original-content.json` — original six-page source/controller/CSS inventory.

- `tests/unit/entry-status-content.test.js` — six sign-in/confirmation sources preserve text, hooks and untouched fulfillment controllers.
- `tests/e2e/css-unification-entry-status.spec.js` — four widths, keyboard/sign-in errors/retry, existing confirmation polling and populated paper; all business writes/email mocked or blocked.

- `shared_components/css/catalog-discovery.css` — shared brand-directory and Fall catalog controls/cards; existing brands.css and fall-catalog-2026.css now own only page arrangements.
- Moved `pages/js/brand-guide.js` to `shared_components/js/storefront-navigation.js`; byte-identical native navigation reused by fifteen brand guides and both catalog discovery pages.
- `tests/fixtures/catalog-discovery-original-content.json` — original copy/links/fields/images and complete curated Fall brand/category/style arrays.

- `tests/unit/catalog-discovery-content.test.js`, `tests/e2e/css-unification-catalog-discovery.spec.js`, `tests/fixtures/catalog-discovery-original-content.json` — original catalog copy/curation, named brand links, four widths/native menus, actual server label passthrough, failure/malformed/retry/filters/broken images and populated paper.

- shared_components/css/campaign-storefront.css replaces golf-tournament-showcase.css for three golf/safety pages. golf-tournament-product.css remains its scoped detail arrangement. Shared controls and semantic tokens load first. Work in progress; visual review pending.
- shared_components/js/campaign-storefront.js owns native photo dialog, fragment focus and complete paper disclosure restoration. Financial services and quote submission remain in their existing controllers.

- tests/fixtures/campaign-storefront-original-content.json and tests/unit/campaign-storefront-content.test.js — original three-page prose/links/images/fields/SEO and normalized controller/service guards; only visual class/style attributes and replaced navigation adapters are excluded from controller comparison.

- tests/e2e/css-unification-campaign-storefront.spec.js — four widths/contrast/native photo viewer/filter/gallery/print plus synthetic save/email outcome matrix; all real business writes and email blocked. Submission now retains inputs and sends no customer confirmation unless storage or sales notification accepted the request.

- shared_components/css/storefront-commerce.css — scoped commerce dropdowns, category links and quote badge shared by public instant configurators; base navigation/footer remain storefront-shell.css.
- shared_components/js/instant-storefront.js — shared configurator fragment focus, native dialog keyboard boundary and reversible FAQ paper preparation; no financial requests. Banner/sticker pages opt into canonical tokens/components and retain original price/submit/artwork controllers. app-modern.js delegates DIALOG mobile menus to existing storefront-navigation.js.

- tests/fixtures/instant-storefront-original-content.json and instant-storefront-pricing.json preserve the original banner/sticker content and read-only captured API contracts. tests/unit/instant-storefront-content.test.js locks full content and financial/controller source. tests/e2e/css-unification-instant-storefront.spec.js reviews responsive, menu/dialog, pricing, failure/retry, artwork and print states with actual writes blocked. Review in progress.

- Instant storefront review complete locally: two pages; content/financial locks;14 focused browser cases;419 print text nodes. index.html and pages/catalog.html only refresh the shared app-modern asset reference; their legacy paths remain unchanged. Release gates pending.

Customer/staff intake cleanup in progress: new shared_components/css/customer-intake.css owns the quote-request and three hosted-form wrappers; request-a-quote.css retains public form arrangements. Retired calculators/css/{digitizingform,monogramform,purchasingform}.css and pages/forms/nwca-form-shared.css after the final four consumers migrated. Existing controllers and vendor form URLs retained. Full review pending.

Customer intake review: tests/fixtures/customer-intake-original-content.json preserves all four pages and seven controller sources; tests/unit/customer-intake-content.test.js locks those contracts; tests/e2e/css-unification-customer-intake.spec.js checks four widths, hosted failure/navigation, native-form validation/upload/save/lookup and paper. Review in progress.

Customer intake: public request-a-quote and three hosted staff forms use canonical tokens/components/Public Sans with one scoped customer-intake.css owner; public fields retain their own arrangement. Digitizing follows Ruth purple, monogram follows shop-floor blue, purchasing follows Bradley slate. Four old CSS owners retired after their final consumers migrated. Seven existing controller sources remain unchanged; complete original prose/fields/images/vendor URLs locked.14 focused browser cases,11 original-contract checks, four widths/zero axe, navigation, blocked embeds and keyboard fallback, public validation/prefill/calendar/lookup/upload/save failures and retained draft retry checked with all business writes and hosted content mocked. Four one-page reference PDFs retain74 checked text nodes; vendor form contents stay external and are not printed from the wrapper. Raw CSS graph grows with shared primitives/scoping; no network byte-reduction claim. Full release gates remain.

SanMar portal wrapper migration in progress: vendor-portals/css/sanmar-portal-shared.css now scopes the three invoice/credit portal wrappers on canonical components. vendor-portals/css/sanmar-vendor-portal.css retired; its only consumer uses the shared owner. External Caspio apps retain exact embed URLs; hosted fallback and keyboard scrolling added.

Vendor portal review: tests/fixtures/vendor-portals-original-content.json preserves three wrappers and their Caspio URLs; tests/unit/vendor-portals-content.test.js locks content and external app contracts; tests/e2e/css-unification-vendor-portals.spec.js checks four widths, native focus, keyboard table scroll, hosted sign-in/empty/failure boundaries and full synthetic report printing. No real vendor writes.

SanMar vendor portal wrappers: three pages use canonical navigation/typography/Bradley purchasing accents and one scoped sanmar-portal-shared.css owner; the duplicate sanmar-vendor-portal.css is retired. Original invoice/credit Caspio app URLs and wrapper content remain unchanged.12 focused browser cases cover four widths, zero wrapper axe, native focus/keyboard scrolling, mocked login/empty/failure states and complete synthetic report printing; three landscape PDFs retain216 checked nodes. All provider writes blocked. Provider-owned UI styling/data remains explicitly separate; the runtime census now recognizes Jotform alongside Caspio and the external-owner backlog names all six reviewed hosted wrappers. Full release gates remain; no raw-CSS byte reduction claim.

Hosted staff tools migration: shared_components/css/hosted-workspace.css now owns five Caspio wrappers (SanMar vendor/invoices/credits and announcement create/manage), using canonical tokens/components. Retired admin/css/announcements-create.css, admin/css/announcements-manage.css and vendor-portals/css/sanmar-portal-shared.css after their final consumers moved. Exact provider URLs and announcement controllers preserved; native skip links, loading labels and permanent hosted fallback added. Five-page review pending.

Hosted announcement verification: tests/fixtures/announcements-original-content.json preserves original wrapper content/provider IDs and both controller hashes; tests/unit/announcements-content.test.js checks those contracts. tests/e2e/css-unification-announcements.spec.js covers four widths/axe, native navigation/keyboard scrolling, loaded/unavailable/login/empty provider fixtures and complete synthetic reference printing. All real business writes blocked. Vendor browser/source checks now point at the shared hosted arrangement with their prior assertions retained.

Hosted staff tools: five Caspio page wrappers (SanMar vendor/invoices/credits, announcement create/manage) share shared_components/css/hosted-workspace.css with canonical tokens/components. Vendor-local and two announcement sheets retired; the earlier duplicate sanmar-vendor-portal.css is also retired. Bradley purchasing and neutral administrative colors follow the ownership rules. Exact provider IDs and both announcement controller sources retained.20 focused browser cases cover four widths/zero wrapper axe, native skip/navigation/scrolling, loading/failure/fallback and synthetic login/form/report/empty boundaries; five landscape reference PDFs retain258 text nodes, every page visually reviewed. Provider-owned controls and data remain separate unfinished work. Seven original source contracts passed; broader inventory guards and full release gates remain. Raw CSS graph grows with scoped shared primitives; no network-byte reduction claim.

Staff access/portal migration in progress: shared_components/css/staff-admin-tools.css replaces dashboards/css/access-admin.css, drive-access.css and portal-directory.css after their final consumers move. Canonical buttons/fields/cards/tables, named keyboard table scrolling and skip links. Three controllers differ only through explicitly recorded presentation-class and heading/pressed-state replacements; permission payloads, drive rights and portal links unchanged. Full state/content/paper review pending; no added reviewed pages.

Staff admin source contracts: tests/fixtures/staff-admin-original-content.json and tests/unit/staff-admin-content.test.js preserve all original content/IDs/dependencies and reverse only explicit UI-class/heading/pressed-state edits before checking controller hashes. Existing admin/reference and portal-directory hygiene guards now read the shared CSS owner; API/feed/preview/copy/error guards remain.

- Staff admin review: tests/e2e/css-unification-staff-admin.spec.js and tests/fixtures/staff-admin-review-data.json; lifecycle detail in docs/active-files/testing.md.

Staff access and portal tools: dashboards/access-admin.html, dashboards/drive-access.html and dashboards/portal-directory.html share canonical tokens/components and shared_components/css/staff-admin-tools.css. Their three obsolete local CSS owners are retired. Neutral admin/drive and CRM ink preserved.15 focused browser cases cover four widths/zero axe, keyboard views, mocked permissions/save failure/retry/removal confirmation, separate drive rights, denied/malformed data, portal counts/search/sort/clipboard fallback and distinct staff-preview/customer URLs. Three reference PDFs/four pages preserve65 checked text/value nodes, including long wrapping permissions; all visually reviewed. Current-value print mirrors are removed after printing and never change editable data. Original controller hashes restored by reversing only explicit presentation mappings.29 source/hygiene unit checks and290-file CSS lint pass. No actual permission or clipboard writes, business actions or messages. Shared raw CSS graph grows; no byte-reduction claim.

Staff monitoring migration in progress: new shared_components/css/staff-monitoring.css owns layouts for dashboards/api-usage.html,table-usage-audit.html,bandit-integration.html. Their three dashboards/css sheets retired. Shared tokens/components replace art-hub/dash-shell dependencies. Original data/controllers retained pending specific review refinements; no live completion claimed.

Staff monitoring review sources: tests/unit/staff-monitoring-content.test.js, tests/fixtures/staff-monitoring-original-content.json, tests/fixtures/staff-monitoring-review-data.json and tests/e2e/css-unification-staff-monitoring.spec.js. Synthetic API fixtures, preserved163-table snapshot/source hashes and explicit controller edits; all real business requests blocked.

Staff monitoring: API Usage,Table Usage Audit and Bandit Integration share tokens/components/Public Sans and shared_components/css/staff-monitoring.css. Their three local sheets are retired. Native keyboard sorting/filtering, named scrolling tables and current-value print mirrors preserve the original163-table evidence and full reference prose. Usage failures stay unknown; malformed/incomplete live schema cannot label tables gone. Local storage failures stay visible with export available, and successful recovery clears the related error.17 mocked browser cases cover all four widths/zero axe, numeric/source states, retry, saved notes and CSV export. Three reference PDFs/nine pages retain213 checked text/value nodes, all visually inspected. Print uses normal block flow so a flex fragment cannot produce a blank trailing sheet; focus outlines remain screen-only. All real business writes and notifications blocked. Measured LF raw CSS per page is70,169bytes, down from162,994–164,472bytes (about57%); these are source bytes, not compressed network transfer.

Staff import tools in progress: dashboards/sanmar-ftp-integration.html and dashboards/sanmar-shopworks-converter.html use shared_components/css/staff-import-tools.css with tokens/components. Their two dashboards/css/*.css owners are retired after their final consumers moved. Pure conversion/SKU helpers and converter controller retained; FTP changes are explicitly recorded presentation/loading/response-validation hooks. Browser/source review pending; no new reviewed/live count.

Staff import source checks: tests/unit/staff-import-content.test.js and tests/fixtures/staff-import-original-content.json preserve original static content/dependencies plus four controller/transform sources, reversed through nine exact recorded edits. Existing sanmar-shopworks-parts.test.js retains the financial/SKU conversion locks.

Staff file tools: SanMar Downloads and SanMar → ShopWorks Parts share tokens/components/Public Sans and shared_components/css/staff-import-tools.css; two local sheets retired. Canonical buttons/data tables, native named file input, skip links and focused scrolling regions retain all original prose/IDs/dependencies and source-locked financial/SKU transforms. Malformed FTP listings and missing converter libraries report visible failures with retry/file retention.17 mocked browser cases cover four widths/zero axe, exact synthetic FTP download query/bytes, CSV/TSV/XLSX conversion, errors and recovery. Two one-page portrait PDFs retain70 checked content/data blocks, visually reviewed; print hides only action controls and their empty download column. All real business writes/imports/uploads/emails blocked. A tiny temporary loopback server serves only synthetic CSV because browser-managed attachments bypass page routing; request assertions observe that server and compare actual downloaded bytes.

Purchasing migration in progress: dashboards/purchasing-portal.html and dashboards/sanmar-payables.html plus their two tests/ui/test-… harnesses now load purchasing-workspaces.css and canonical components. Retired dashboards/css/purchasing-portal.css and dashboards/css/sanmar-payables.css after all four consumers moved. The shared legacy sanmar-invoice-viewer.css remains for its three production consumers while the separate invoice-viewer review proceeds. Source tests and browser review pending; these two pages are not yet in the reviewed manifest.

Invoice viewer opt-in: Purchasing/Payables and their two harnesses now load vendor-invoice.css with a native dialog; AE Mission Control and its harness retain legacy sanmar-invoice-viewer.css. All six HTML consumers use one shared controller cache version. Invoice rendering/money functions remain unchanged; documented changes decorate tables, manage focus/request lifetime and preserve failed-PO notes on paper. Verification pending.

Purchasing review fixtures: tests/fixtures/purchasing-review-data.json contains dated synthetic feed/invoice/import/CSV data derived from the existing UI harnesses; tests/fixtures/purchasing-original-content.json preserves original page and controller/helper contracts plus explicit edits. No live reads/writes used to make the fixture. Browser/source tests follow.
Purchasing review files added: tests/e2e/css-unification-purchasing.spec.js and tests/unit/purchasing-content.test.js use synthetic request/invoice/import/export fixtures, source contracts and original controller hashes. Four-width accessibility, keyboard, complete paper, failures/recovery, download bytes, mock-only stamping and legacy AE viewer compatibility; review pending.

Purchasing Portal and SanMar Payables reviewed: shared purchasing-workspaces.css and opt-in vendor-invoice.css use canonical tokens, controls, data tables, named file input and native invoice dialog. Bradley slate and existing payables ownership retained. Two old page sheets retired across production/harness HTML; AE keeps its legacy invoice CSS with the same updated controller version.24 mocked browser cases cover four widths/zero axe, keyboard/focus, source filters, exact CSV values, mock-only import confirmation/cancellation/failure, visible unknown balances and optional feed recovery, concurrent lookup protection and legacy AE compatibility. Four one-page PDFs preserve176 checked reading/data/current-field blocks; invoice columns, totals and failed PO notes verified together. Original five controller/helper hashes reverse through50 documented UI/load-validation edits; money/CSV calculations unchanged. The AE page and other generated-document families receive no review credit.

Added tests/fixtures/asset-library-review-data.json: synthetic finished-photo lookup/gallery/design/provider-wrapper states and additional-logo pricing fixture, derived from the existing inert library stub and original fallback schema. No provider app or real business records executed.
In progress: shared_components/css/photo-workspaces.css — shared finished-photo capture/library arrangements. Original page owners remain until all consumers migrate and browser checks pass.

Photo implementation in progress: capture/library and their library harness now load tokens/components/photo-workspaces.css with Public Sans, canonical controls, visible native camera/album inputs and shared UiDialog focus/inert/scroll handling. Original photo upload, compression, customer visibility and API helpers remain unchanged outside documented presentation/dialog edits. Retired dashboards/css/finished-photos.css and dashboards/css/finished-photos-library.css after all three consumers moved; former poster references were already retired. Digitized/old-design pages remain at originals. New family review still pending; no extra reviewed/live credit.

Photo family review now covers capture/library first; both Caspio design pages remain original and receive no credit until their provider-boundary review. Added tests/e2e/css-unification-photos.spec.js, tests/unit/photo-content.test.js and tests/fixtures/photo-original-content.json alongside asset-library-review-data.json. Checks cover responsive/keyboard/dialogs, stale or malformed reads, explicit publication status, synthetic image upload and preserved compression/API helpers. A failed manage action now has its own always-visible status in the manage section. Nothing has been published by these fixture reviews.

Reviewed photo family: shared_components/css/photo-workspaces.css owns capture/library arrangements across dashboards/finished-photos.html, dashboards/finished-photos-library.html and tests/ui/test-finished-photos-library.html. Two old photo sheets retired.22 mocked browser checks cover four widths/zero axe, native camera/album fields, exact synthetic JPEG resizing/upload metadata, customer/rep filters, errors remaining visible through filtering, publish/delete confirmation failures and delayed customer/image responses.28 printed content blocks retained across three pages/two PDFs.46 explicit controller edits reverse to eight original controller/helper hashes; image compression, URL resolution and API payload structure preserved. The library graph falls from164,116 to68587LFbytes; capture grows from34,293 to the same shared graph because it now loads canonical components. This is a maintenance/consistency gain on capture, not a per-page byte reduction. Caspio design pages remain original and unreviewed.

Draft design family: shared_components/css/design-libraries.css owns local design/archive shells, record cards and dialogs; shared_components/js/design-library-ui.js decorates existing provider fields without changing data or submit handlers. Provider integration and browser review pending; no new review credit.

Design implementation draft: both design HTML consumers now load design-libraries.css and design-library-ui.js with canonical local controls and UiDialog. Retired dashboards/css/digitized-designs.css and shared_components/css/old-designs.css after their consumers moved. Existing neutral reference and amber archive identities, Caspio URLs, field identities and price calculations retained; incomplete prices have a visible reference warning and clipboard failures stay visible. Provider-specific layout/overrides still require actual rendering review before this candidate is considered complete.

Draft shared_components/css/design-library-provider.css isolates required Caspio overrides: actual generated unlayered selectors hide the digitized nested search fields at phone widths (also reproduced in the original page) and override canonical field layout/type. Local design-libraries.css remains free of important declarations. Each provider override needs a bounded manifest entry and actual four-width verification before review credit; adapter implementation is still in progress.

Design-library review in progress: tests/fixtures/design-library-review-data.json, tests/fixtures/design-library-original-content.json, tests/e2e/css-unification-design-libraries.spec.js, tests/unit/design-library-content.test.js cover synthetic nested Caspio forms/results, mobile provider precedence, search errors, pricing, clipboard dialogs, paper content and original source preservation. No production records are included.

Reviewed design libraries: dashboards/digitized-designs.html and dashboards/old-designs.html load tokens/components/design-libraries.css plus the explicitly inventoried design-library-provider.css. The helper shared_components/js/design-library-ui.js preserves provider field names and submit handlers, adapts nested mobile form/results and hides only cloned source definitions. Neutral reference/amber archive retained. Fifteen focused browser cases cover four widths, zero fixture axe violations, complete five-tier AL and full-back prices, visible reference fallback, dialogs/keyboard, exact clipboard values, failed/empty/recovered search and replacement forms. Two PDFs/three pages retain39visible text/current-filter blocks. Six suites/220source/CSS checks and286CSSfiles clean.31recorded controller UI edits reverse to six original hashes. Actual read-only Caspio queries returned24records per page without business writes; private actual data is not in Git. Two old sheets retire275flags;77exact provider exceptions remain, ordinary app owner zero. Both CSS graphs74123LFbytes versus34,811/61,697: consistency/maintenance gain with larger payloads, not a byte-reduction claim. Original hidden/focus/typed-button tests now follow shared owners and always-visible actions. Initial strict-locator, incomplete mock select tags and print-context exception matching errors were corrected.

Preview-tool draft: shared_components/css/design-preview-tools.css now owns the public pages/design-view.html layout; retired pages/css/design-view.css after its only app consumer moved. Gallery uses canonical fonts, controls and dialog dependency. Customer design URLs/images/contact details preserved; review pending, no page credit yet. DST Studio and JDS are still original on this branch.

Preview-tool draft tests: tests/fixtures/preview-tools-review-data.json, tests/fixtures/preview-tools-original-content.json, tests/unit/preview-tools-content.test.js, tests/e2e/css-unification-preview-tools.spec.js capture synthetic gallery/tool responses, customer-only fields, errors/retry, keyboard/dialog state and original UI/helper hashes. Further DST and JDS output fixtures still required. No live customer data.

Preview-tool draft now also moves pages/jds-mockup-creator.html into shared_components/css/design-preview-tools.css; retired pages/css/jds-mockup-creator.css after its sole app consumer moved. Shared controls/native artwork chooser retain oxblood theme; Inter remains loaded for unchanged branded canvas exports. Review pending; no page credit.

Preview-tool draft: shared_components/css/embroidery-studio.css now owns pages/dst-viewer.html; retired pages/css/dst-viewer.css after its only app consumer moved. Scoped dark instrument theme uses shared tokens/controls, visible native DST chooser, mobile toolbar wrapping and keyboard dialog metadata. Original approval-sheet font metrics retained pending separate document design. Source/output/browser checks pending; no review credit.

Preview tool ownership: pages/design-view.html and pages/jds-mockup-creator.html load tokens/components/design-preview-tools.css; pages/dst-viewer.html loads tokens/components/embroidery-studio.css. All three old page CSS files retired (seven flags removed; new owners zero). Shared app type/control/focus, local dark instrument and oxblood identities. Five PNG exports verified byte-identical to originals; approval text retained. Three original CSS graphs grow to shared component ownership: pages/design-view.html 25016→72122LFbytes; pages/dst-viewer.html 47479→102971LFbytes; pages/jds-mockup-creator.html 38748→72122LFbytes. Payload reduction is not claimed. Focused browser/source/print review continues before release credit.

Reviewed preview tools: pages/design-view.html, pages/dst-viewer.html and pages/jds-mockup-creator.html now share canonical UI controls/type/focus and two scoped layout owners. Native file inputs stay visible. Gallery excludes internal fields and reports failed/malformed/image states; DST keeps its dark instrument role, accessible thread dialog, keyboard stats and fitted resize behavior; tumbler retains oxblood identity with latest-image protection and retryable failures. Sixteen focused browser cases pass at1440/768/390/320 with zero fixture axe findings. Eight suites/748source/CSS/historical guards pass. Eight original script hashes preserved outside38 mapped UI edits. Five actual downloads match original bytes and filenames: DST1166×662stitchout/1410×1600garment; JDS1840×1980framed/1800×1800bare/1708×1178comparison. Two reviewed PDFs each one page retain all original text words; gallery shrank from two pages. Original approval fonts remain an output boundary. No real business writes/uploads/messages. Three old sheets/seven important flags removed; new owners zero. Existing historical gallery guards follow its new owner and semantically inspect hidden dialog attributes. Zero-size ResizeObserver callbacks while printing and print-rule order are regression-covered. LESSONS_LEARNED now254lines;15 already-archived short references moved to the archive before adding the preview lesson. CSS byte budgets measured honestly: shared ownership increases these three graphs.

Product detail draft: shared_components/css/product-detail-tools.css owns pages/dtg-compatible-products.html, pages/inventory-details.html and pages/sanmar-catalog-color-audit.html, replacing pages/css/dtg-compatible-products.css, pages/css/inventory-details.css, pages/sanmar-catalog-color-audit.css. Public storefront/card/stock layouts and staff audit report share tokens/components; no external header/product helper files deleted. DTG obsolete reference to already-missing sample-cart.js removed; inventory now loads APP_CONFIG before its unchanged API module. Existing cart-count/header and inventory renderer contracts remain; local UI wiring/tests/print review pending. No page credit.

Product detail draft evidence registered: tests/fixtures/product-detail-original-content.json (seven original script hashes reversed through32mapped UI edits), tests/fixtures/product-detail-review-data.json (synthetic records), tests/unit/product-detail-content.test.js and tests/e2e/css-unification-product-detail-tools.spec.js. Three pages use shared product-detail-tools.css; three old sheets retired. Discovery retains11style destinations; inventory API/renderer helpers unchanged. Confirmed backend src/routes/inventory.js returns source sanmar-bulk with sizes and placeholder zero totals: UI now labels warehouse availability unavailable. Failed/partial audit does not label unavailable SanMar results as clean or orphans. Four copied table outputs stay unchanged. Browser/source/print review pending; no live credit. Graphs 42911→75201LFbytes, 44431→75201LFbytes, 21628→75201LFbytes.

Product detail ownership follow-up: the DTG list was the only consumer of shared_components/css/universal-cart-header.css. Its layout is now provided by product-detail-tools.css plus components.css, so the unused sheet is retired and removed from lint scope. UniversalCartHeader behavior remains unchanged; its obsolete stylesheet comment is updated and the consuming script cache version is2026.09.09.17. Historical tests/unit/public-cart-header-pages.test.js follows the current owner and still locks no style injection, badge visibility, asset versions and destinations. Seven original script hashes now reverse33mapped changes (the extra change is only that comment). This retires four sheets/5important declarations total; current local owner zero.

Reviewed product detail tools: DTG-compatible products, inventory details and SanMar catalog-color audit share canonical typography, controls, stock/audit tables and one scoped page owner. Four old stylesheets/five important declarations retired; new owner zero.22focused browser cases pass at1440/768/390/320 with zero fixture axe findings; eight source/CSS/legacy suites238checks pass and282CSS files lint clean in the isolated tree. Seven original script hashes preserved outside33mapped changes (including one obsolete header comment). All11style destinations, warehouse quantities/stock thresholds and four exact clipboard strings retained. Inventory missing configuration and catalog-size placeholder quantities are handled explicitly; unknown stock stays unknown. Malformed/partial/empty/retry, delayed color/search responses and denied clipboard covered. Three PDF outputs/six pages/610extracted words preserve all original data words; action-only request/cart/copied labels omitted intentionally in print. All11product pictures verified in PDF raster output after correcting clipped relative-position containers. DTG print reduces5→3pages; inventory1 and audit2 remain complete. Graphs now75,936LFbytes each versus42,911/44,431/21,628originally; no payload reduction claim. Lessons remain254lines after archiving six redundant short references. No business writes/uploads/emails/notifications.

Pricing reports layout draft started: shared_components/css/pricing-reports.css will own dashboards/reports/price-audit-report.html, pages/quote-audit.html and generated dashboards/pricing-analysis.html. It uses shared controls/tables and retains report-specific chart/layout patterns. Original source/print capture complete:8tables/181rows,1table/3synthetic rows,33tables/179rows; original generator rebuild preserves33tables/5675body words. Six original source/data hashes retained. No page wiring or review credit yet.

Pricing report pages now load tokens/components/pricing-reports.css and shared Public Sans/monospace type. Three prior page sheets retired (18important declarations). Both static reports and quote audit use canonical tables/keyboard scrolling; quote visibility moved from inline display to native hidden. The analysis generator emits the new owner/classes/skip link and preserves bar magnitudes using a dynamic --report-share property; original data JSON unchanged. Layout draft only: source, sorting, error, accessibility and full paper review still pending; no review/live credit.

Pricing reports proof files: `tests/fixtures/pricing-reports-original-content.json`, `tests/fixtures/pricing-reports-review-data.json`, `tests/unit/pricing-reports-content.test.js`, `tests/e2e/css-unification-pricing-reports.spec.js`. Original financial report prose and42table outputs are stored as hashes, not copied business records; review responses are synthetic. Six source/data hashes lock the generator math, private dataset, auth helper and table calculations outside recorded UI edits. Focused keyboard/recovery/print validation pending.

CRM layout draft: shared_components/css/crm-accounts.css owns House, Nika and Taneisha account layouts; shared_components/css/crm-pipeline.css owns Leads, Lead Scorecard and Unqualified Leads. Six pages now use canonical Public Sans/tokens/components, scoped navy/gold layouts, shared controls/tables and keyboard scroll regions. Original six-page synthetic baseline, card/detail/table/CSV/PDF outputs and17source hashes captured before edits. Legacy sheets remain temporarily until the draft and all runtime states are verified; dashboards/css/leads.css remains required by source-locked dashboards/lead.html. This draft adds no reviewed/live page credit.

CRM review evidence registered: tests/fixtures/crm-workspaces-original-content.json holds original page contracts, table/card/detail/CSV hashes and17source hashes with63mapped UI/recovery changes; tests/fixtures/crm-workspaces-review-data.json contains synthetic accounts/leads only. Layout draft uses two shared CSS owners, native account/house dialogs and a named account opener separate from contact links. Malformed account/lead/scorecard data now raises visible errors; stale totals clear on failed reload. Financial formulas, original payloads and three excluded lead-detail files remain source locked. Six-page source/browser/print review is still pending.
CRM source guard: tests/unit/crm-workspaces-content.test.js verifies all six original HTML contracts and reverses the documented UI changes against all17original source hashes, including the excluded lead-detail HTML/controller/CSS.
CRM browser guard: tests/e2e/css-unification-crm-workspaces.spec.js verifies six layouts at four widths, original cards/tables/details/CSV, filters, dialogs, recovery and mocked operational failures. Every API and mutation is intercepted, including mutating GET reconcile. Verification pending.

CRM lifecycle review: six application pages use shared_components/css/crm-accounts.css and crm-pipeline.css; the two existing scorecard/category tests/ui HTML previews now mirror the production markup/assets and retain their stub controllers. Four obsolete sheets retired: dashboards/css/house-accounts.css, dashboards/css/rep-crm.css, dashboards/css/lead-scorecard.css, dashboards/css/unqualified-leads.css. dashboards/css/leads.css is retained unchanged for the excluded lead-detail page. scripts/css/migration-manifest.json records the six reviewed style graphs and budgets; tests/unit/sales-small-pages.test.js follows the new owners. 88mapped controller edits reverse17original hashes, and31focused browser scenarios pass. Paper/visual approval and full integration gates are being finalized; this does not raise the live count.

## CRM workspaces reviewed — candidate v2026.09.09.19

Six pages: House Accounts, Nika CRM, Taneisha CRM, Leads, Lead Scorecard and Unqualified Leads. Two scoped canonical owners (crm-accounts.css/crm-pipeline.css), Public Sans, navy/gold headers, consistent controls/tables, native account/house dialogs and independent contact links. Four legacy sheets/7important declarations retired; new owners zero. Existing scorecard/category test previews mirror production main markup/assets and keep stub controllers. Excluded lead detail HTML/controller/leads.css remain unchanged.

31focused browser scenarios pass at1440/768/390/320 with zero fixture axe violations, including populated dialogs, keyboard/focus return, filters, original CSV, malformed responses/retry, stale background archive/quarter totals and category/scorecard races. Eleven source/CSS/historical suites299checks pass, including25new page/source/preview locks. All17original hashes reverse88mapped UI/recovery edits; financial formulas and request payloads retained. 18original account-card hashes,5table-output hashes/12visible rows,2rep-detail hashes and lead CSV preserved. Six base PDF outputs/8Letter-landscape pages (previous11),640original card/table words checked, plus2board-print pages with all five leads; every paper page and four-width layout reviewed. Headings and summary counts remain in print. Narrow scorecards keep money figures together.

Account CSS graphs123,166LFbytes versus54,563/59,002/59,002; pipeline97,911 versus176,101/161,043/161,142. This consolidates ownership; account payloads increased while pipeline payloads decreased. Full CSS scope278clean in isolated tree. Runtime census:155reviewed migrations locally/70pending/79excluded, but LIVE REMAINS149/76 on.18 until.19 is deployed and verified. Lessons250lines after archiving three resolved references. No real writes/uploads/emails/notifications; every API, including mutating GET reconcile, was intercepted.

Next: integrate this exact reviewed SHA into clean develop, preserve the .18 live checkpoint, run all full application gates, then require actual browser/money/calculator steps in exact-source CI before one deployment. Verify release/running slug, both raw/versioned and registered hashed assets, prior staff/public access and four retired-sheet404 responses. Backend unchanged.

- `shared_components/css/crm-records.css` — candidate shared lead-detail, Forms Inbox and Marketing Shipments layouts; isolated draft under review.

- `tests/e2e/css-unification-lead-records.spec.js` — lead records original contracts, synthetic browser fixtures and focused preservation/recovery checks.

- `tests/fixtures/lead-records-original-content.json` — lead records original contracts, synthetic browser fixtures and focused preservation/recovery checks.

- `tests/fixtures/lead-records-review-data.json` — lead records original contracts, synthetic browser fixtures and focused preservation/recovery checks.

- `tests/unit/lead-records-content.test.js` — lead records original contracts, synthetic browser fixtures and focused preservation/recovery checks.

CRM records lifecycle review: dashboards/lead.html, dashboards/form-submissions.html and dashboards/marketing-shipments.html now use shared_components/css/crm-records.css with canonical components and the unchanged CRM pipeline owner. Retired dashboards/css/leads.css, dashboards/css/lead-workspace.css, dashboards/css/form-submissions.css, dashboards/css/marketing-shipments.css. The three tests/ui previews (test-lead-workspace, test-form-submissions, test-leads) mirror current production markup and retain API stubs; Inbox stubs now block unknown API traffic. Runtime art-module trigger reviewed; shared garment-submit-form.css/js remain original and pending modernization. The manifest records direct and triggered graph costs separately. Original content and 17 source hashes are retained in tests/fixtures/lead-records-original-content.json with 93 reversible controller edits and explicit retirement provenance. This is reviewed source preparation, not a production completion claim; live remains .19, 155/225 pages, 70 pending until verified deployment.

Personalization work in progress: shared_components/css/personalization-workspaces.css now owns reviewed layouts for both dashboards, pages/names-numbers.html and quote-builders/monogram-form.html. The roster adopts existing shared_components/js/ui-dialog.js; monogram-form-controller.js restores saved catalog/custom styles correctly. Four old CSS owners are retired with complete source/hash provenance; all four consumers are registered. Live credit waits for verified deployment.

Personalization preservation: tests/fixtures/personalization-original-content.json and tests/unit/personalization-content.test.js preserve four original HTML contracts and twenty-two source hashes (including unchanged ui-dialog.js) outside 167 explicitly mapped UI/recovery edits. All22 checks pass.

Personalization browser review: tests/e2e/css-unification-personalization.spec.js uses synthetic tests/fixtures/personalization-review-data.json. All57 focused scenarios pass; dashboard/roster four-width accessibility, lists/retry races, saved monogram styles, native roster dialog lifecycle and complete normal/wide paper output are covered. Monogram visual migration remain pending; roster load/search/OCR/save recovery and original native CSV/payload comparison now pass.

Personalization lifecycle review: both personalization dashboards, pages/names-numbers.html and quote-builders/monogram-form.html now share shared_components/css/personalization-workspaces.css and canonical components. All57 focused browser cases and69 source/name-QA checks pass. Four original CSS owners retired: dashboards/css/monogram-dashboard.css, dashboards/css/names-numbers-dashboard.css, shared_components/css/names-numbers.css, shared_components/css/monogram-form.css. Their complete original CSS and hashes remain in the source fixture for paired original browser comparisons. No other consumers or preview references remain. Two dashboard papers, two roster papers (seven pages), and four monogram papers (nine pages) were visually reviewed. Monogram font/authoritative thread mappings are retained; only bounded --proof-thread and --column-min runtime properties remain. Recovery, keyboard pickers, native imports, duplicate/obsolete saves and original native CSV/payload comparisons are covered with mocked API writes. Candidate v2026.09.10.1; not live yet. Production remains .20/Heroku2096,158/225 pages with67 pending until exact-source gates and verified deployment.

Staff toolkit source capture: tests/fixtures/staff-toolkit-original-content.json now preserves eight original dashboard HTML contracts and31 source hashes. Scope: blog editor, contract break-even, customer portal administration, Jim mailing list, past-due orders, product manager, Roland supplies and volume quote. Every captured source matches production .20/ddfc5395 exactly. No application edits or migration credit yet. Next: synthetic four-width original browser/print captures, then one maintained family layout. GET quote-sequence allocates a number and must be mocked alongside every save/upload/send/reward action.

Staff toolkit preservation: tests/unit/staff-toolkit-content.test.js locks the eight original HTML contracts and31 source hashes; only explicitly mapped UI edits and proven stylesheet retirements may differ.

### Staff toolkit draft — 2026-09-10

- `shared_components/css/staff-toolkit.css` — scoped draft layout owner for contract comparison and Roland Supplies, using canonical components. Old page sheets retained pending all-consumer review.
- `tests/e2e/css-unification-staff-toolkit.spec.js`, `tests/e2e/fixtures/staff-toolkit-data.js`, `tests/fixtures/staff-toolkit-original-browser.json`, `tests/fixtures/staff-toolkit-volume-original-workflow.json` — mocked browser, original calculation/payload and provider-boundary evidence.

- Staff toolkit draft expanded to Volume Quote: canonical fields, row retries, request ownership, snapshot saves and separate customer/internal print modes. Original payload/PDF content preserved; all legacy page styles remain pending retirement review.

- Staff toolkit draft: Product Manager now shares the staff owner and preserves legacy categories/vendor codes with guarded uploads/saves. Added tests/fixtures/staff-toolkit-product-original-workflow.json for original edit fields and save payload; added the missing vendor mirror check to tests/unit/staff-toolkit-content.test.js. Legacy product CSS remains pending retirement review.

- Staff toolkit draft: Blog Editor now uses canonical controls, current-request preview/edit handling, guarded saves/uploads and complete article-proof printing. Added tests/fixtures/staff-toolkit-blog-original-workflow.json for original draft payloads, preview HTML and permanent published URLs; retained legacy blog/editor styles pending consumer audit.
- Staff toolkit review: added tests/e2e/fixtures/staff-toolkit-portal-data.js for synthetic customer lookup, rewards ledger/accrual and mocked write acknowledgments; no real customer or financial operations are used.

- Staff toolkit draft: Portal Admin now uses the shared owner and existing ui-dialog.js lifecycle, guarded customer/reward reads and pending actions, and complete rewards printing. Added tests/fixtures/staff-toolkit-portal-original-workflow.json for exact original tables/invite/ledger/accrual/request bodies. Legacy portal CSS remains pending consumer audit; all business actions are mocked in review.

- tests/fixtures/staff-toolkit-mailing-original-workflow.json — immutable synthetic mailing-list edit/export/labels/request contract. Preview HTML/stub now share the staff toolkit owner; unknown preview requests fail closed.

- tests/fixtures/staff-toolkit-pastdue-original-workflow.json — immutable synthetic 30/60/90-day board and per-rep print contract for staff toolkit review.

- Staff toolkit family: retired dashboards/css/{blog-editor,contract-break-even,customer-portal-admin,jim-mailing-list,past-due-orders,product-manager,roland-printer-supplies,volume-quote}.css after auditing all HTML/JS consumers (including the Jim preview). Shared owner shared_components/css/staff-toolkit.css is registered and linted; original CSS retained only inside the immutable test fixture. art-hub.css, dash-shell.css and blog.css retain other consumers.

- tests/fixtures/staff-workspaces-original-content.json — six remaining staff-workspace HTML contracts and transitive local JS/CSS hashes, verified against live v2026.09.10.1. tests/unit/staff-workspaces-content.test.js preserves original content outside explicit future UI mappings. Planning/baseline only; no migration credit.

### Staff workspaces browser baseline — 2026-09-10
- Added tests/e2e/css-unification-staff-workspaces.spec.js: synthetic provider boundaries and original four-width/tab/paper capture; remaining workspace fixtures to follow. No application review credit yet.


- Added shared_components/css/staff-workspaces.css: scoped staff layout; first Drain-Pro consumer, canonical controls and contained provider regions. Legacy DrainPro-Bundle.css is retained until browser/paper review and consumer audit pass.
- Added tests/fixtures/staff-workspaces-drainpro-original-browser.json: original tab text, links, two provider URLs and four-width overflow measurements.

- Retired dashboards/css/DrainPro-Bundle.css after consumer audit and six browser checks. Original 11787 LF bytes / 7 flags preserved in staff-workspaces-original-content.json; staff-workspaces.css owns the current layout.
- Added tests/fixtures/staff-workspaces-shifts-original-browser.json: original department tables, timeline text, every employee detail, segment math, four widths and four printed schedule captures.

- Added shared_components/css/staff-schedules.css: scoped production schedule draft with canonical tokens/controls and preserved timeline/print geometry. Old production-shifts/styles.css retained until complete browser/paper/consumer review.

- Retired dashboards/production-shifts/styles.css after original/current data, six browser scenarios and four one-page current paper reviews. Replaced its explicit lint entry with staff-schedules.css; updated the production page guard and active-owner documentation. Original 45452 LF bytes / 71 flags preserved in the source fixture.
