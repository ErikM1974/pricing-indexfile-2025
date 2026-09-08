# CSS unification — design direction and implementation plan

Prepared 2026-09-07 against frontend v2026.09.07.38, commit `2ca502a1`.

Erik's brief: unify CSS throughout the application so pages look modern, sleek and easy to maintain.

**Recommendation:** one shared component system, expressed through staff and storefront themes, with explicit department accents and a separate print contract. Build on the token system already shipped. Migrate actual page markup and retire its superseded rules as each family moves.

This is the next phase after [CSS_STANDARDIZATION_PLAN_2026-09.md](CSS_STANDARDIZATION_PLAN_2026-09.md). That first phase deliberately preserved the existing appearance. This phase deliberately improves the appearance and component ownership. This document is the current plan; the older file remains the migration history.

## What the current code proves

A read-only audit used tracked files at the commit above, PostCSS parsing, HTML stylesheet links and quoted CSS imports. The HTML exclusions match the existing hygiene inventory. These are source measurements, not compressed network payloads or a complete runtime route census.

| Measure | Current finding | What it means |
|---|---:|---|
| Application CSS files | 282 | File count alone is not the problem; duplicated ownership is. |
| Raw UTF-8 CSS source | 4,907,064 bytes | Compare like-for-like family source and browser transfer sizes during migration. |
| Tracked HTML candidates | 231 | Generated pages, dynamically loaded CSS, print HTML and route aliases need a runtime inventory too. |
| Candidates loading app tokens | 227 | Token adoption is widespread. Remaining exceptions require classification, not blind linking. |
| Candidates loading `components.css` / `utilities.css` | 1 / 1 | Only Brand Standards uses them among application candidates; the page template is excluded. Most existing pages still own their components. |
| Candidates using storefront core | 25 | Keep and evolve this recognizable storefront system. |
| Candidates using `art-hub.css` | 47 | The historical 41-page estimate understates the current static dependency set. |
| `!important` declarations | 2,303 | Written exceptions explain the debt but do not remove it. |
| Declaration bodies repeated across at least five distinct files | 99 | An opportunity for shared components; repeated one-property rules are not automatically defects. |
| Stylesheets explicitly declaring `@layer` | 8 | Most legacy rules still bypass the intended layer structure. |

The existing `scripts/css-census.py` reports 206 repeated bodies with at least five occurrences. Its label says "files," but its counter counts occurrences. The distinct-file audit above is a different, more precise measure. Its size counter also counts text characters, rather than UTF-8 bytes; do not compare the two size columns as if they were identical.

Specific concentrations:

- `shared_components/css/art-hub.css`: 5,183 lines, 139,058 bytes and 47 direct HTML consumers. It redefines shared space/radius/shadow names. For example, global `--space-8` is 64px, while Art Hub makes it 32px.
- `shared_components/css/quote-builder-common.css`: 4,398 lines, 121,965 bytes and 102 important declarations.
- `shared_components/css/quote-builder-utilities.css`: 377 important declarations. The older "127" describes utility classes, not the number of flagged declarations.
- `shared_components/css/quote-print.css`: 289 important declarations; `pages/css/invoice.css`: 150. Printed and generated documents need their own state coverage.
- `shared_components/css/dtg-inline-form.css`: 2,831 lines; DTG has a separate form architecture, so changes to the other three builders do not automatically reach it.
- The screen-print pricing page directly links 23 local stylesheets, including several overlapping universal, theme, clean and override layers.
- EMB links 15 local stylesheets including vendor files; the audited application sources total about 375 KB before compression. Asset requests and dynamic sheets must also be measured in the browser.

The old palette work succeeded at naming colors. The next gain comes from making each field, action, panel and state have one maintained definition.

## The proposed appearance

Keep Northwest Custom Apparel recognizable: a practical, confident apparel business, with product imagery doing the expressive work on customer pages and clear task information doing the work on staff pages.

| Element | Proposed default |
|---|---|
| Staff surfaces | White panels on a light neutral canvas; thin borders; restrained shadows only for floating menus and dialogs. |
| Storefront surfaces | Preserve the existing cream paper and forest-green palette, real apparel photography and Bricolage display character. |
| Body type | Public Sans, already used by the storefront, as the proposed common body family. Retain compatible system fallbacks. Migrate staff pages deliberately from Inter/Poppins; do not flip a global font on unmigrated pages. |
| Headings | Staff headings generally 28–32px, section headings 18–22px. Customer display headings may use Bricolage. Sentence case; left alignment for working screens. |
| Reading sizes | 16px for forms and reading; 14px for dense operational data; 12px for supporting metadata. Density does not reduce essential text to 10–11px. |
| Core palette | Surface `#ffffff`, canvas `#f3f4f6`, ink `#1f2937`, secondary ink `#41514a`, strong line `#d1d5db`, storefront action `#2f7d3b`. All already exist in app tokens. |
| Department identity | Existing Steve, Ruth, Bradley, shop-floor and AE colors stay meaningful. Use an ownership marker, selected navigation and appropriate actions; avoid repeating a saturated header on every card. |
| Status | Stable status colors plus written labels. A person's color and a project's status remain separate concepts. |
| Spacing | Preserve the shared 4/8/12/16/24/32/48/64/96 scale. Add semantic row/panel/control spacing and explicit comfortable/compact modes. Never redefine `--space-5` or `--space-8` inside a family. |
| Corners | Existing semantic scale: controls 6px, panels 10px, dialogs 14px; 20px reserved for large feature surfaces. Use pill shapes only where their meaning warrants them. |
| Controls | One action hierarchy, common field/label/help/error pattern and consistent focus ring. Default primary controls 44px tall; compact desktop controls can be smaller after target/spacing checks. |
| Tables and forms | Align quantities and money with tabular numerals. Keep required columns available on mobile through a deliberate stacked view or labelled keyboard-scrollable region. |
| Motion | Short feedback for opening/closing and user actions, with reduced motion respected. Avoid decorative page-wide animation. |

Use text contrast of at least 4.5:1 for ordinary text and 3:1 for qualifying large text. The 44px control default is a product choice; WCAG 2.2 AA's target-size criterion has a 24px minimum with spacing and other exceptions. Test actual foreground/background pairs, including department themes. [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

The local interactive concept provides staff, customer-form and shared-control views, department selection, density selection, filtering, search, a dialog and confirmation states. It uses a copy of the current app tokens and sample data. Desktop 1440px and mobile 390px views passed the automated accessibility checks and had no document overflow or JavaScript errors. These checks support the concept; they are not a claim of full accessibility conformance or production readiness.

## One owner for every style

Keep the existing native CSS and asset pipeline. An app-wide framework migration would also require changing legacy markup, script hooks and integration boundaries, without itself resolving ownership.

| Responsibility | Owner and boundary |
|---|---|
| Raw values and semantic aliases | Existing `shared_components/css/tokens.css`. Family themes select aliases; they do not redefine the numeric scales. |
| Staff/storefront/department/density themes | Scoped attributes on a page root, such as `data-surface`, `data-department`, `data-density`. Preserve the dashboard's existing dark/light behavior where supported. |
| Buttons, fields, status, feedback, panels, tables, dialogs | Existing `components.css` becomes the single shared entry point. Split its implementation into cohesive source modules when needed; keep one published entry point. |
| Staff and storefront navigation | Separate shell patterns using the same control primitives. Reduce storefront core to its actual shell/theme/marketing responsibilities after its common controls move. |
| Queue, detail, editor, catalog and document layouts | Reusable family patterns. Each has one owner and a defined responsive behavior. |
| Page CSS | A small scoped file for the page's unique arrangement and domain UI. It cannot redefine common buttons or global token values. |
| Print and PDF | Dedicated document styles and fixtures, including generated invoice/quote HTML. Paper size, pagination, totals, table headings and signatures are explicit contracts. |

During coexistence, never blindly add both `components.css` and `nwca-2026-core.css` to an old page: both currently define broad names such as `.btn` and `.card`. A migrated root needs scoped shared rules and replacement of its legacy competing declarations. Preserve IDs and classes that JavaScript, delegated events, tests and embedded services use; introduce presentation classes where necessary.

Keep the current top-level order: `reset, tokens, base, components, utilities, overrides`. Use explicit component sublayers for primitives, family patterns and page-specific structure on migrated pages. Do not mix competing rules directly in the parent layer and its sublayers without reviewing their precedence. Reserve `overrides` for documented exceptions and document output, not routine appended fixes.

Unlayered normal declarations outrank layered normal declarations; important declarations reverse layer precedence. Consequently, merely wrapping old files in a "legacy" layer can change behavior substantially. Replace one consumer's entire competing rule set under state tests before removing its exceptions. [MDN cascade-layer reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@layer).

Build component source modules into cached assets through the existing build/manifest pipeline where bundling is introduced. Avoid adding a chain of browser `@import` requests. CSS-relative image/font URLs and the current hashed-page allowlist must be verified before expanding that pipeline.

## Decisions carried forward from Brand Standards

| Open decision | Recommended resolution |
|---|---|
| Art Hub versus global spacing/radius | Adopt the global numeric scale and semantic density settings. Pilot a staff queue first, then replace Art Hub's global shadows. Include AE's embedded panes and all 47 static consumers in the dependency map. |
| Sticker page's 20/24/32 spacing | Move reusable values into the shared semantic vocabulary. Where 20px serves a specific layout, name that purpose rather than redefining a global numbered token. Review the calculator beside the builders that consume this sheet. |
| Builders' important utilities | Retire them component by component once their ID-based competitors and state rules are replaced. Preserve their effective behavior until then; no global flag deletion. |

The concept makes these recommendations visible. The pilot becomes the first deliberately updated visual reference; screenshots for unmodified states and unrelated pages should remain unchanged.

## Migration order and acceptance

Each wave consists of small, independently reviewable releases. Advance based on verified behavior and reduced ownership, not an assumed number of sessions.

| Wave | Work | Exit condition |
|---|---|---|
| 0. Coverage and contract | Extend the existing CSS census to record actual consumers, dynamic injection, generated HTML, imports, exact declaration counts and bytes. Classify every HTML candidate and runtime page. Add representative normal/loading/empty/error/disabled/dialog/print states to the coverage manifest. | Every in-scope surface has a family, style owner, screenshot route and test strategy; documented exclusions include emails, embedded third-party UI and archived material. |
| 1. Reference and small pilots | Evolve Brand Standards into the living component reference. Implement one queue view using a controlled fixture, one simple staff reading/form page, then one customer inquiry page. Introduce the scoped components and theme/density contract. | Shared primitives work in both themes and at mobile widths; legacy rules are removed from those consumers; screen/interaction/accessibility checks pass. |
| 2. Staff families | Queue dashboards and detail pages, then administrative tools, training and remaining forms. Extract Art Hub's queue, toolbar, filter, table/card, form and modal patterns. Exercise AE's embedded panes separately. | All family consumers migrate; no page shadows global numeric tokens; repeated widgets have one CSS owner; existing supported dark/light modes work. |
| 3. Customer families | Catalog/product, custom tees/caps/3-Day Tees, account portal, webstores and SEO pages. Preserve the storefront identity and actual product-color swatches. Move common controls out of storefront core. | Customer and staff controls share implementations; storefront shell/marketing pieces remain distinct; carts, drawers, errors and responsive menus still work. |
| 4. Calculators | Consolidate each stack into shared calculator patterns and a method-specific layout. DTF fixes and the 23-sheet screen-print stack are explicit targets. | Every changed calculator matches the pricing engine across live tiers; no price, quantity, fee or error becomes hidden; superseded fix/override sheets lose all consumers. |
| 5. All four quote builders | Product lookup, line-item grid, customer panel, fees, summary, guided steps and dialogs become shared patterns. Include the DTG form architecture, not just EMB/DTF/SCP. | Money-path and parity suites pass, populated/error/modal/step states are reviewed, and important utilities shrink with each completed component. |
| 6. Documents and retirement | Finish quote/invoice print stacks, remaining special pages and the final dependency census. Remove unreferenced superseded source only after HTML/JS/routes/import checks. | Required printed content, totals and page breaks remain correct; every surface is migrated or has an explicit maintained exception; the old duplicate implementations are retired. |

Within each family, use small pilots and then migrate siblings in the same contract. Do not change the shared Art Hub file globally while only one page has been reviewed. Use a scoped opt-in boundary, preserve old consumers, and remove the boundary/compatibility aliases once that family is complete. Avoid permanent parallel design systems.

## Keeping it maintainable

Add meaningful guards as the migrated surface grows:

- A migration manifest records the surface, owning family, CSS entry point, allowed theme and visual states. CI verifies actual dependencies against it.
- New or migrated application components have zero CSS ID selectors and zero important declarations by default. Any necessary vendor, state or print exception is small, explicit and counted separately.
- New page-level redefinitions of global spacing, type, radius and shadow values fail. Theme aliases use an allowlist of supported semantic properties.
- Migrated pages cannot import retired fix/override sheets or copy common component selectors. Legacy exceptions can decrease, never silently increase.
- Record raw bytes, actual compressed transfer, request count and important counts per family. The first three pilots establish realistic budgets; file splitting alone does not count as a size reduction.
- New pages come from the maintained template and documented component examples. They choose a shell and theme instead of copying an old page's CSS. Update both the template and storefront guide when the contract changes.
- Keep Brand Standards' decisions log current and remove stale “open” labels as the choices land. Update the active-file registry on every move/create/delete.

For each release: capture approved reference states at desktop/tablet/mobile widths; compare computed theme/layout values; check keyboard focus, tab order, dialogs and 200% zoom; run automated accessibility checks and inspect the images. Pure extraction targets pixel equivalence. Deliberate redesign targets reviewed changes with unchanged business behavior. Data/time/photo differences must be explained rather than ignored broadly.

Run the existing full unit and browser gates, CSS/JS lint, types and build when production styles or markup change. For calculators/builders also run both fixture parity suites and all five calculator-surface parity checks. Test invoice/quote print output separately, including long descriptions and multi-page orders. Use mocked service data for visual states; never submit a live order just to take a screenshot.

Production releases continue through the existing exact-source CI and deployment workflow, with per-family cache invalidation, live spot checks and a known rollback release. This planning pass changes documentation only; the local concept does not load production data or deploy an app redesign.

## Completion checklist

- [x] Audit the current foundation, common files and static consumers.
- [x] Inspect existing representative staff, builder and storefront screenshots.
- [x] Build and inspect a shared staff/customer/component concept at desktop and mobile widths.
- [x] Recommend the palette, type, density, component boundaries and three open design decisions.
- [x] Define family order, retirement rules and verification gates.
- [ ] Complete the runtime/state coverage manifest and production component reference.
- [x] Implement and verify the three small pilots (plus the component reference).
- [ ] Migrate all families and retire their superseded styles.

**First implementation target:** the component reference plus a single staff queue pilot. Establish the shared button/field/status/table/panel patterns there, then prove the same primitives on a customer inquiry page before broad rollout.

## Implementation checkpoint — 2026-09-08

Erik approved implementation ("go for it"). Four local pilots now use the shared scoped layer: Brand Standards, Design Queue, Art Billing & File Reference, and Company Store Inquiry. The app-wide rollout remains open.

- Shared components define Public Sans, staff/storefront themes, six department choices, semantic density, 44px controls, fields, choices, statuses, table regions and native dialogs. No global numeric scales changed.
- Queue and billing replaced Art Hub dependencies; inquiry replaced its print-form styles. Temporary behavior-hook adapters live in the shared component owner.
- Raw local CSS source: Queue 173,704 → 44,482 bytes; billing 149,859 → 38,545; inquiry 33,091 → 34,443; component reference 34,377 → 37,950 (before final minor documentation/motion edits). Shared foundation adds a small cost to the simple form while removing about 74% from the two Art Hub consumers. These are source bytes, not compressed transfer.
- All eight pilot browser tests pass: original queue/form contracts; 1440/768/390/320 layouts; six department contrasts; density without scale changes; keyboard dialog; loading/empty/error/retry; success focus on both customer forms; print-visible amounts. Seventeen focused unit tests pass, including unchanged billing prose/prices/links. JS lint zero and CSS lint 284 files clean.
- `scripts/css/migration-manifest.json` locks pilot owners, state coverage and budgets, and records known pending dynamic/generated/email/embed sources. It is not a completed runtime census.
- Remaining before release: full unit/DOM/a11y/browser and pricing gates, cache invalidation, exact-source CI, deploy and live verification. Next family: staff queues/details under the same contract, including AE panes and Caspio ownership boundaries.

## Pilot release record — v2026.09.08.2

Exact-source CI 34211413665 passed on 2360d4b1006587a78388eeacb24f919335dd5394. Local verification: 204 unit suites / 4,881 passing tests (four existing skips), 88 DOM tests, four axe unit tests, 84 fixture-parity cases, all five calculator surfaces and the nine CSS state tests. CSS scope 284 files clean; JavaScript lint and types clean. Production rollout uses this tag and requires the matching live SHA. The all-family rollout and complete runtime census remain open.
