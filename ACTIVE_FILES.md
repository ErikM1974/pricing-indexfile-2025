# Active Files Registry

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
