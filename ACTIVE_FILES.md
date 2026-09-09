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
