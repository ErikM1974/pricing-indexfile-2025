# scripts/css — the CSS standardization toolkit (2026-09-07)

The tools that migrated every served stylesheet onto `shared_components/css/tokens.css`, kept the result
pixel-identical, and now keep it that way. Plan, decisions and the per-family log: `memory/CSS_STANDARDIZATION_PLAN_2026-09.md`.
The design reference staff see: `/dashboards/brand-standards.html` (rendered live from the token file).
Every script runs from the repo root (`python scripts/css/<tool>.py …`) and works wherever the repo is cloned.

## The loop for any CSS change that should not change how a page looks

1. `SHOT_TAG=before SHOT_PAGES_FILE=<txt> npx playwright test --config tests/e2e/playwright.config.js builder-screenshots`
   — one repo-relative `.html` per line; shots land in `tests/e2e/screenshots/`. Admin-gated pages redirect under the
   staff session: shoot those with `--config scripts/css/playwright.static.config.js` (a static server, no auth, no live data).
   `SHOT_MEDIA=print` shoots print stylesheets.
2. Change the CSS. Then `npm run lint:css` (must be clean) and `node scripts/build.js` (the dev server serves `dist/`).
3. `SHOT_TAG=after …` the same list, then `python scripts/screenshot-diff.py` — the target is 0 differing pixels.
   Timestamps, async data and product photos are the accepted exceptions; prove one by shooting the page twice
   (`SHOT_TAG=after2`) — if the two after-shots agree with each other and differ from before, it is not the CSS.
   `crop-pairs.py name@x0,y0,x1,y1` writes a before/after crop to look at.
4. Gates: `npm run test:unit`, `npm run test:e2e`, and on anything that touches a calculator or builder
   `npm run test:parity` + `npm run test:parity:surfaces`. Then `/deploy` (`.claude/skills/deploy/SKILL.md`).

## Migrating a sheet that still carries raw hex (the tail is done; this is for a new or resurrected page)

| Step | Tool | What it does |
|---|---|---|
| 1 | `dedupe-token-defs.py <sheets>` | removes a sheet's own `--gray-*` / `--space-*` … definitions when byte-identical to the token file; keeps and reports the ones that differ (they shadow the token on that page) |
| 2 | `tokenize-sheet.py --prefix=<sheet> <sheet>` | every hex → the exact token, a near token (≤16 per channel, never for a page's body ink), or a page variable `--<prefix>-<hue>` declared once in a `:root` block wrapped in `stylelint-disable/enable color-no-hex`. Idempotent: it skips its own block and reuses existing page variables. `--dry` to preview |
| 3 | `merge-root.py <sheets>` | merges the new block into a sheet's existing `:root` |
| 4 | `join-continuations.py file:line[,line]` | a declaration whose value wraps onto the next line hides its hexes from the tokenizer (it needs a `:` on the line); join first |
| 5 | `stylelint --fix`, then `fix-nested-annotations.py <sheets>` | drops a `stylelint-disable-next-line` that landed inside a comment |
| 6 | `splice-scope.pl <block.txt>` | adds the sheets to `CSS_LINT_SCOPE` in `scripts/lint-css.js` (a ratchet: a sheet never leaves) |
| 7 | `link-tokens.py --tokens=/shared_components/css/tokens.css?v=<ver> <pages>` | links the token file before a page's first local stylesheet |
| 8 | `restore-near-root.py <sheets>` | for a sheet whose `:root` palette IS the design (the quote builders' `--pnw-*`), puts near-mapped values back to their exact hex |

## Audits (read-only)

- `audit-tokens-links.js` (`NODE_PATH=node_modules node scripts/css/audit-tokens-links.js`): pages loading a migrated sheet
  without the token file — must print 0 (also locked by `tests/unit/css-tokens.test.js`).
- `raw-hex-outside-theme.py`: served sheets with a raw hex outside the token files and the `:root` theme blocks — must print 0.
- `tail-consumers.py`: those sheets with the pages that link them, resolved by path (never match by basename).
- `palette-inventory.py`: the storefront sheets' remaining page variables with use counts and nearest tokens (edit `SHEETS` for another family).
- `collapse-page-vars.py [--dry]`: after adding a ramp step to `tokens.css`, removes every page variable equal to a token and rewrites its uses — value-identical.
- `python scripts/css-census.py --top 12`: the numbers the plan is measured against.

## Things that bit (full entries in memory/LESSONS_LEARNED.md)

- A `#` followed by three hex letters in an **id selector** (`#add-to-cart`) is not a colour; only a declaration value is.
- A **re-run** tokenizer once rewrote its own declarations into `--x: var(--x)` (invalid in a browser) — now idempotent; grep `^\s*(--[a-z0-9-]+):\s*var\(\1\)` after any pass.
- **Near-mapping a page's ink** (`--text`, `--ink`) darkens every heading even when no pixel crosses the diff threshold — keep inks exact.
- **Never delete `!important` by script** on the money path: a screenshot cannot see the modal, step and error states that need it. Every flag carries a written reason instead.
- `stylelint --fix` (number fixer) once wrote `oklch(55.% …)` from `55.0%` — grep `[0-9]\.[%)]` after `--fix`.
- A sheet migrated to bare `var(--gray-…)` tokens renders **transparent** on any page that does not load `tokens.css` — the audit above exists because that happened to the four quote builders for a day.
- `curl` exits 35 to `www.teamnwca.com` from the office (FortiGate TLS inspection): verify a release via the `herokuapp.com` URL or a browser.

## Unified component migration

`migration-manifest.json` records the reviewed consumers, exact local stylesheet dependencies, measured raw-source bytes, budgets and fixture states. It also lists known pending dynamic/generated/email/embed owners; it is explicitly not a completed all-route inventory. Tests: `tests/unit/css-migration.test.js` and `tests/e2e/css-unification.spec.js`. Increase budgets only for a reviewed change; do not reintroduce Art Hub/print-form dependencies to the migrated pages.

## Runtime ownership census

Run `node scripts/css/runtime-inventory.js --out <report.json>` from the repository root. It reads tracked HTML, literal GET route aliases, CSS imports, local script/module dependencies and candidate injected/generated style owners. It never executes the server or calls business services. The regression test verifies catalog/dashboard aliases, dynamically loaded garment styles, generated invoices and the explicitly served seasonal archive.

The report distinguishes application pages, served archives, email artifacts, fixtures/templates and retired sources. It flags missing styles and parse errors. Variable-built routes, runtime class/style mutations and external embeds still require family review. Its page count is not browser-state coverage; only entries and fixtures in migration-manifest.json carry reviewed state coverage.

Design Vault and Gear Publisher replace Art Hub and dash-shell imports with the scoped shared entry point. Vault also uses its shared toast implementation through a presentation class added by the existing toast service; other consumers retain their stylesheet until migrated. Dynamic sizing variables --h/--w are explicit per-page manifest exceptions, not theme variables.

The Bradley family adds five reviewed consumers and mocked transfer/order/image/import/sender states in css-unification-bradley.spec.js. That spec also exercises the legacy Steve sender and the three existing product-thumbnail modal consumers. Budgets are raw source bytes, measured again when a common owner grows; compressed transfer is a separate deployment observation.

Ruth and Saved Mockups are the first two art-family consumers. Their mocked browser contract is css-unification-art.spec.js; Ruth's board/recovery patterns live in art-workflow.css. Source budgets normalize CRLF to committed LF and retain a 2 KB allowance. This does not certify the remaining Steve/AE/detail consumers.

The four Steve/AE/detail consumers now have 23 mocked browser tests in css-unification-art-details.spec.js, including five rendered intake variants, queued files, invalid fields, print privacy, sender cancellation and thread selection. art-theme.css prevents details from loading the queue owner. The migration guard resolves local aliases in every actual consuming page, and locks the four explicit Art Request Detail visibility/print exceptions. See the style guide for ownership; this still does not certify other application families.
