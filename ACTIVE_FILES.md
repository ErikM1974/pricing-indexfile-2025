# Active Files Registry

Last updated: 2026-09-08 — printable form shared owner, 17 scoped consumers and browser/content checks.

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
