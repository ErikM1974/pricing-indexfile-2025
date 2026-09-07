# CSS standardization — project brief for a fresh Claude session (written 2026-09-07)

> **Hand this file to a new chat.** Kickoff prompt is at the bottom. Everything the session needs is here or
> one click away; it should not have to rediscover the repo. Read `CLAUDE.md` first (the Top 9 rules apply
> to every file this project touches), then this.

## 1. Why (Erik, 2026-09-07)

Every page was built one at a time, each with its own stylesheet, palette and spacing. Erik's question:
*"if we clean up the css since all the pages were built one off, will it make creating new pages easier
and consistent?"* — yes: a new page should link a token file + a component file and write a few page rules,
not copy a 40 KB stylesheet and edit it. Brand/layout changes become one edit. The linter keeps it that way.

## 2. Where it stands — measured 2026-09-07 (`python scripts/css-census.py --top 12`)

| Measure | Now | Target |
|---|---|---|
| Stylesheets served (outside dist/vendor/archive/tests) | 295, 4,567 KB | fewer, smaller; no page-private copy of a shared thing |
| Files using `var(--…)` | 215 | all |
| Files with raw hex colours | 266 | 0 outside the token file (stylelint enforces) |
| Distinct hex colours | 1,355 | the token palette (~40) |
| `!important` | 3,182 | only the generated `quote-builder-inline.css` (127 rules, deliberate) + a handful with a comment |
| Rule bodies repeated in 5+ files | 224 | 0 — absorbed by components/utilities |
| Font stacks | inherit 262 · JetBrains Mono 135 · `var(--font-display)` 132 · Inter 83 · Poppins 67 | two tokens: `--font-sans` (Inter), `--font-mono` (JetBrains Mono); Poppins is a per-page legacy |

Most-used colours today (they ARE the palette, name them as tokens): `#e5e7eb` 385 · **`#4cb354` 383 (the NW
green in the wild)** · `#6b7280` 362 · `#ffffff` · `#d1d5db` · `#dc2626` (danger) · `#1f2937` (ink) · `#f3f4f6` ·
`#92400e` / `#f59e0b` / `#fef3c7` (warning trio) · `#64748b`. Other greens in use: `#2e5827`, `#1a472a`, `#2d5f3f`,
`#3a7c52` — pick one primary + one dark, map the rest.

Most-duplicated rule bodies: `grid-template-columns:1fr` ×96 (mobile collapse), the box-sizing reset ×50,
`opacity:1;transform:translateY(0)` ×32 (reveal animation), `display:flex;align-items:center;gap:…` ×19–20 in
three gap sizes, `opacity:.5;cursor:not-allowed` ×26 (disabled). These become utilities.

## 3. What already exists — build on it, do not start over

- **`shared_components/css/staff-dashboard/tokens.css`** (242 lines, 131 variables, `@layer reset, tokens,
  base, components, utilities, overrides`, oklch palette, a discrete type ramp `--font-size-xs…`, space, motion,
  z-index, focus, density). Loaded by 5 pages today. **This is the seed of the app-wide token file** — promote
  it to `shared_components/css/tokens.css`, keep the dashboard importing it, and add what the public pages need
  (the customer-facing green/ink/greys from § 2). The `@layer` order statement must stay the FIRST stylesheet
  a page loads (see its header comment).
- Other partial token sets to reconcile INTO it: `quote-builder-shell.css` (74 vars), `quote-builder-common.css`
  (47), `modern-enhancements.css` (74), `customer-portal.css` (67), `ae-nav-v2.css` (51), `sticker-pricing-page.css`
  (85), `policy-detail.css` (48), `rep-crm.css` (42). Same names where they mean the same thing; alias the old
  names for one release, then delete.
- **Rule-3 clean everywhere**: no `<style>` blocks or decorative inline styles exist (locked by
  `tests/unit/repo-hygiene-final.test.js`). `quote-builder-inline.css` is GENERATED (127 hash classes with
  `!important` — inline-attribute precedence) — leave it; it goes away only when the builders' id-heavy rules
  are refactored, which is the LAST family.
- Families by directory (stylesheet counts): `shared_components/css` 87 · `dashboards/css` 56 · `pages/css` 45
  · `training/css` 23 · `pages/forms` 18 · `calculators/css` 11 · `staff-dashboard` 9 · `admin/css` 4.
  Page-structure families (from the landmark pass): the 14 `g-header` webstore pages share one template; the
  18 forms share `form-sheet`; training pages share `nav-header + .container`; dashboards share
  `minimal-header + tab-container`.

## 4. The plan (in order; each step ships on its own)

1. **Tokens.** `shared_components/css/tokens.css` from the dashboard file + § 2 palette. Names: `--color-brand`,
   `--color-brand-dark`, `--color-ink`, `--color-muted`, `--color-line`, `--color-surface`, `--color-danger`,
   `--color-warning{,-bg,-ink}`, `--font-sans`, `--font-mono`, `--space-1…8`, `--radius-{sm,md,lg}`,
   `--shadow-{sm,md}`, `--z-{nav,modal,toast}`. Document each in the file. Ship with zero visual change.
2. **Components + utilities.** `shared_components/css/components.css` (header, nav, card, button + variants,
   table, form field, badge, modal, toast, empty state) and `utilities.css` (the § 2 duplicates: flex rows in
   three gaps, stack, grid collapse, disabled, reveal). Drawn from what the pages already render — the
   migration is mostly renaming.
3. **Page template + linter.** `templates/page-template.html` (tokens + components + one page stylesheet,
   header/main/footer landmarks, versioned assets, `data-call` delegator — everything the locks demand) and
   **stylelint** (`stylelint-config-standard` + `color-no-hex` outside tokens.css + `declaration-no-important`
   with the generated file ignored) wired into `npm test` via a jest wrapper or `package.json` `lint:css`. Widen
   ESLint from the 3 paths in `package.json` `lint` to all browser JS at the same time.
4. **Migrate by family**, smallest blast radius first, each family one deploy:
   forms (18) → training (23) → the webstore/SEO pages (14 + `pages/css`) → dashboards (56) → calculators (11)
   → quote builders + `shared_components/css` LAST (money path; `quote-builder-inline.css` retired here).
   Per family: before-screenshots → change → `node scripts/build.js` → after-screenshots → `python
   scripts/screenshot-diff.py` → 0 differing pixels (timestamps/async excepted, re-checked in a browser) →
   unit + e2e locks → `/deploy` → live spot-check → census re-run → memory note.

## 5. Tooling that already works (proved on 96 pages, 2026-09-06)

- Screenshots: `tests/e2e/builder-screenshots.spec.js` — `SHOT_TAG=before|after`, `SHOT_PAGES_FILE=<txt, one
  repo-relative page per line>`; 1440×900 full page, staff session, animations frozen. The e2e config drives the
  installed Chrome locally (`channel: 'chrome'`) because this network blocks Playwright's browser download.
  ⚠️ The two `employee-bundles/*.html` pages are served at ROOT paths (`/streich-bros-bundle.html`).
- Diff: `python scripts/screenshot-diff.py` (Pillow). Census: `python scripts/css-census.py`.
- Page list: the served-page set is `git ls-files '*.html'` minus the `HTML_SKIP` regex in
  `tests/unit/repo-hygiene-final.test.js`; the landmark pass's list is reproducible from that.
- Deploy: `/deploy` (`.claude/skills/deploy`) — gates on tests, cache-busts `?v=` for every changed CSS/JS, `--no-ff`
  release on `main`, Heroku, verify. Work on `develop`. Never hand-roll.
- Gotchas that bit before (LESSONS 2026-09-05/06): files mix CRLF/LF (rebuild per line, keep endings); a
  scripted rewrite must keep the original quote character; never pin a `?v=` prefix in a test; bash heredocs
  mangle backslashes — write scripts with the Write tool; a green suite proves nothing about a URL no test loads —
  read the live failed-request list; `body >` and sibling selectors are what a wrapper/rename breaks — grep
  before renaming a class.

## 6. Rules that do not bend

- CLAUDE.md Top 9: no inline code, external CSS only, kebab-case, ACTIVE_FILES.md updated on every create/
  delete/move, no hardcoded hosts, pricing untouched (this project never edits a `*-pricing-service.js`).
- Every family deploy is pixel-verified before it ships. "It looks the same to me" is not a verification.
- Erik is price-sensitive on tokens: no Workflows/ultra/deep-research unless asked; Sonnet for routine renames.
- Memory: one fact, one home — progress log in `memory/DASHBOARD_REVIEWS_2026-09.md` (or a new
  `CSS_STANDARDIZATION_LOG` section here), gotchas in `LESSONS_LEARNED.md` (≤300 lines), one-liner in MEMORY.md.

## 7. Kickoff prompt (paste into the new chat)

> Read `CLAUDE.md`, then `memory/CSS_STANDARDIZATION_PLAN_2026-09.md` end to end. Run
> `python scripts/css-census.py --top 12` and confirm the § 2 numbers. Then do Step 1 (tokens file) and Step 3
> (page template + stylelint + wider ESLint) as one deploy with zero visual change, verified with the
> screenshot diff on the five pages that load the dashboard tokens plus ten public pages. Report the census
> after, then proceed family by family per § 4 without asking, following the per-family verification loop.
> Never touch pricing services or the generated `quote-builder-inline.css` until the builders family. Record
> progress in this plan file and MEMORY.md after every family.

## 8. Progress log (newest first)

### 2026-09-07 — Forms family LIVE (`v2026.09.07.4`): 18 stylesheets, 0 raw hex, 3 documented `!important`

- **What moved.** 17 forms + `nwca-form-shared.css` link `tokens.css` first; every hex became `var(--…)` (93 uses
  → 0). The family's deliberate print palette (green sampled from the official PDFs, neutral inks that print
  true) became 7 named tokens — `--print-green/-green-dark/-ink/-ink-soft/-line/-red/-gold` — and the
  info banner became the app's `--color-info-bg/-line/-ink` (sky trio); everything else mapped to the palette
  within the diff threshold (≤16 per channel). Two pages OUTSIDE the directory load the family sheet
  (`pages/request-a-quote.html`, `pages/webstore-inquiry.html`) — found by the cache-bust, not by the family
  list; they got the tokens link too. 🔑 Always grep the whole tree for a family stylesheet before calling
  the family list complete.
- **Deliberate consolidations (the only pixels that changed, eyeballed in crops):** `#666` → `--print-ink-soft`
  (d=17) on two labels, `#333` → `--print-ink` on the PTO signature line — 4 of 34 shots, all on those elements.
- **`!important` 6 → 3.** `.size-chip input` now outranks `.form-table td input` through
  `.form-table td .size-chip input`; the three print rules (`.contacts-dropdown`, `.swatch-grid`, `.no-print`)
  stay, each with a `stylelint-disable-next-line` reason (print must beat JS-toggled state).
- **stylelint.** `--fix` rewrote value-identical syntax (`rgba()` → `rgb(… / %)`, `#ffffff` → `#fff`,
  `max-width:` → `width <=`, `page-break-inside` → `break-inside`, `-webkit-/-moz-appearance` dropped — one
  duplicate deduped by hand); reviewed in `git diff -U0`. Three rules are off with reasons in
  `stylelint.config.mjs`: `no-descending-specificity` (would reorder the cascade), `selector-id-pattern`
  (camelCase ids are wired into JS), `declaration-block-single-line-max-declarations` (house style); `clip` is
  allowed for `.sr-only`. All 18 sheets are in `CSS_LINT_SCOPE`.
- **Verification.** 17 pages × screen + print (`SHOT_MEDIA=print` added to `builder-screenshots.spec.js`):
  30/34 identical, the 4 = the consolidations above; the two outside consumers before/after through a HEAD
  worktree; unit 188 suites, dom, a11y, lint 0 errors / 99 warnings, e2e a11y + money-path green.
- **Step 2 not started here.** The forms' shared sheet already IS the family component layer; components.css +
  utilities.css get their first real consumer with the training family (`nav-header + .container`).
- **Census after:** 296 sheets · 4,575 KB · 224 use `var(--)` (+8) · 252 raw-hex files (−15) · 1,348 distinct
  hex (−7) · 3,179 `!important` (−3) · 226 duplicated bodies (+2: tokenizing made five `.assist-hint` icon rules
  byte-identical — that is a utility waiting to be absorbed, not a regression).

### 2026-09-07 — Step 1 + Step 3 shipped as ONE deploy (`v2026.09.07.3`), zero visual change

- **Tokens.** `shared_components/css/tokens.css` = the `@layer` order statement + everything the dashboard seed
  had (type ramp, `--nw-*`, space, radius, motion, z-index — values untouched) + the § 2 palette as ramps
  (`--brand-50/100/500/600/700/800` = #f0fdf4 #e8f5e9 **#4cb354** #409a47 #2e5827 #1a472a; `--gray-50…800`;
  `--slate-*`; `--red/amber/emerald/blue-*`) and the semantic names the plan asked for (`--color-brand`,
  `-brand-hover/-dark/-deep/-tint`, `--color-on-brand`, `--color-ink/-ink-soft/-muted/-faint`,
  `--color-line/-line-strong`, `--color-surface/-alt/-raised`, `--color-danger/-ink/-bg`,
  `--color-warning/-ink/-bg`, `--color-success/-bg`, `--color-info`, `--shadow-sm/md`, `--z-nav`). Every hex
  carries its census count. `staff-dashboard/tokens.css` is theme-only now (density, dark/light, accent
  overrides, aliases) and the 5 pages that load it link the app file first. **15/15 pages pixel-identical**
  (12 served through server.js + the 3 `tests/ui` fixtures through `scripts/qa-static-server.js` with a scratch
  Playwright config — server.js has no `/tests` mount).
- **Decisions.** Brand = `#4cb354` (383 uses); dark = `#2e5827` (146); deep = `#1a472a` (116). The other greens
  (`#2d5f3f` 111, `#3a7c52` 77, `#16a34a` 74, `#166534` 68, `#22c55e` 60) map to the nearest of those, family
  by family. The 2026 storefront set (`nwca-2026-core.css`: `--paper/--ink/--green-*`, 25 pages, cream +
  forest, Bricolage/Public Sans) is a different design language — NOT folded in; reconcile in the webstore
  family. Person/department colours (`DESIGN_COLOUR_CODE.md`) stay page-local, never brand tokens.
- **Page template.** `templates/page-template.html`: tokens → (components/utilities when Step 2 lands) → ONE
  page CSS → `app.config.js` + `data-call-delegator.js` + ONE page JS; header/main/footer; labelled; versioned;
  class vocabulary = `NWCA-2026-GUIDE.md` (btn, card, alert, field, table-wrap/data-table, empty-state) so
  Step 2's components.css has one name set. Locked by `tests/unit/css-tokens.test.js`, which also locks: layer
  order is the file's first statement, no token defined in both token files, app tokens before dashboard
  tokens on every page that loads them.
- **stylelint.** `stylelint.config.mjs` = standard + `color-no-hex` (off only in the two token files) +
  `declaration-no-important` (`quote-builder-inline.css` ignored) + BEM-tolerant `selector-class-pattern`; font
  names exempt from `value-keyword-case`. Scope ratchet = `CSS_LINT_SCOPE` in `scripts/lint-css.js` (today:
  the two token files; each family's stylesheets are ADDED when it migrates, never removed). Runs as
  `npm run lint:css`, in CI's lint job, and as `tests/unit/css-lint.test.js` under `test:unit` — so `/deploy`
  Step 0.6 gates on it. Standard's value-identical rewrites to know about: hue `150deg`, `rgb(34 197 94 / 12%)`,
  `#fff`, one declaration per line, blank line before a rule.
- **ESLint widened to ALL browser JS** (`eslint . --max-warnings 99`). STRICT scope unchanged (+ `scripts/lint-css.js`).
  LEGACY scope = `js.configs.recommended` minus `no-undef` (1,088 findings in 146 files) and `no-unused-vars`
  (843 in 206) — classic scripts share `window` globals across files; those two need a per-file `/* global */`
  audit and are their own ratchet. The 9 rules that fired (99 findings: useless-escape 43, case-declarations
  19, prototype-builtins 12, redeclare 9, empty 8, unreachable 3, control-regex 2, irregular-whitespace 1,
  unused-labels 1) are warnings under the cap: fix some → lower the cap; never raise it. 30 ESM files are
  declared in `LEGACY_ESM`. Measured before the split: 2,119 findings in 294 of 410 files.
- **Census after this deploy:** 296 stylesheets · 4,572 KB · 216 use `var(--)` · 267 raw-hex files (the new
  token file is one of them, by design) · 1,355 distinct hex · 3,182 `!important` · 224 duplicated bodies — the
  § 2 baseline plus the token file, as intended: nothing migrated yet.
- **Next:** forms family (18 pages, `form-sheet`), and Step 2 (`components.css` + `utilities.css`) ships with
  it as its first consumer.
