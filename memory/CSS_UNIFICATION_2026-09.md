# CSS unification — design direction and implementation plan

## Active checkpoint — 2026-09-08

Erik resumed; standing edit/deploy authorization continues. **Frontend v2026.09.08.17 / Heroku 2076 is LIVE**, full SHA **f795f3a23f7b87a2a71bbe2698ded16d042dae9f**, actual slug verified 2026-09-09T05:21:12.0072304Z. Exact-source CI **34313504483** passed all four jobs, including live money/calculator parity, on **d945a8423e6403bf7dd025ba576536624da1d741**. Nine deployed runtime assets match committed bytes; four reference dashboards and four other staff shells remain protected; six public regression shells return 200. No business writes or notifications. Main/tag/develop were synchronized; subsequent documentation commits are expected. Track follow-up main/develop CI separately.

**64 reviewed application pages live; 161 pending**, from **225 application/served-archive HTML sources**. Another 79 tracked HTML sources are excluded. **All 26 tracked training pages are reviewed/live.** Ignored local training/api-test-runner.html is not tracked/deployed and is excluded; leave it alone. Generated document/style owners remain separate unfinished work.

### Next batch and plan

- [x] Unify/deploy all four API reference dashboards: Caspio, ManageOrders, SanMar and ShopWorks ODBC (.17).
- [x] Preserve technical catalogs and role/email gates; verify four widths, keyboard search/disclosure, malformed/failed catalog retry, full filtered-view printing and exact copying of code operators.
- [ ] Finish policy migration tracker, historical pricing-negotiation guide, Resources and Sale. Separate worktree **C:/Users/erik/.codex/visualizations/2026/09/07/01a07d90-9a4c-7e70-9e4e-c196377b7c6b/training-final-worktree**, branch **codex/policy-reference-family**, base ecd150e5, plan commit 96b2364f. It contains uncommitted application work belonging to this task; do not delete/reset it. node_modules is a junction to the primary frontend. No .env copied.
- [x] Next four: common layout/controls implemented; original-data/content locks, file registration and strict controller lint added. All **14 focused browser cases**, **178 ownership/content/legacy guard cases** and **294 CSS files** pass. Original 414-row migration snapshot is unchanged; admin restrictions verified separately from test login.
- [ ] Finish next-family print review (migration 33 pages, guide 11, notices one each), then integrate into current develop preserving .17 documentation. Full local gates, exact-source CI and verified deployment remain. These four are NOT live; candidate manifest 68 is not the live count.
- [ ] Continue Policies Hub/detail/questions/handbook together, then remaining application families. No CMS application edits yet.

Design: Public Sans, white/neutral/forest tokens and shared controls. API references replace art-hub/dash-shell dependencies. Next guide replaces Bootstrap dependency; notices share one CSS owner. Preserve original historical policy prose and current permissions; no business-service calls during browser review.

### Verification / resume evidence

.17: **209 unit suites / 5,079 passed / four existing skips**, 88 DOM, four a11y unit, 84 quote parity; full local **230 mocked browser plus 16 remaining browser cases**, three optional screenshot skips, all five live calculator surfaces. Exact-source CI passed all final checks together. Build/lint/types/**295 local CSS**/HTTP boot pass; 485 routes / 24 modules unchanged. Seventeen focused API cases pass; actual PDF review finds all **114 selected original prose blocks and 2,342 unique catalog names**. Family CSS graphs drop **56–58% in raw UTF-8 source bytes** (not network transfer).

Artifacts: C:/Users/erik/.codex/visualizations/2026/09/07/01a07d90-9a4c-7e70-9e4e-c196377b7c6b. api-reference-{release-record,source-ci,heroku-verification,live-verification,local-gates}.json are authoritative. policy-reference-original-baseline.json records the next four originals at ecd150e5. Do not rerun one-shot installers/release helpers. Heroku push helper is single attempt: inspect actual release SHA/status after a disconnect before retrying.

Backend unchanged: v2026.09.08.1 / Heroku 1130 / d06aee3e4d25c5e1410241ea8007cdc8339aa3fa. Dependency/runtime backlog and natural scheduler verification remain separate. Frontend production audit zero.

## Resumed — 2026-09-08

Erik explicitly resumed from the checkpoint and reiterated permission to continue. The historical pause below is superseded. The unchanged saved frontend passed the actual HTTP boot probe on port 3113 with status 200; the earlier timeout did not recur and its cause is unconfirmed. All previously completed local checks remain recorded below. Continue the exact-source CI/release process, frontend callers FIRST and backend gates second, then the remaining CSS families.

### Faster rollout plan

Migrate complete related page families using the existing shared controls and reusable layout owners. Keep one design direction, automate mechanical dependency/class changes with explicit ownership checks, and use focused mocked state checks during editing. Run the full required suite at release boundaries and review actual desktop/mobile rendering. Group compatible small pages into larger releases; retain separate verification for pricing, approvals and generated documents. The current planning estimate is several working days for the remaining rollout and verification, to be tightened from the next measured family. This is an estimate, not a completion promise or a reason to skip coverage.

## User-requested stopping point — 2026-09-08

Final boot probe FAILED: the local server did not answer /api/version on port 3113 within 45 seconds. The preceding build/lint/types/unit/DOM/axe/parity/CSS/browser checks passed, but the overall gate exited 1. Startup was not investigated because Erik requested a stop. Diagnose and rerun the boot probe before preparing a release; do not claim all release gates passed.

PAUSED so Erik can shut down and return later. The authoritative resume record is [HANDOVER_FOLLOWUPS_2026-09.md](HANDOVER_FOLLOWUPS_2026-09.md), first section. Live frontend is v2026.09.08.6 / Heroku 2065: thirteen unified pages, including Ruth and Saved Mockups. Main/develop release CI is green. The tested transfer/Supacolor relay and backend auth changes are saved but NOT deployed; frontend release must go first. Latest local frontend checks: 4,961 unit tests and 66 browser cases passed, with the final boot outcome in the companion checkpoint JSON. After the coordinated security release, continue Steve/AE/details, then the remaining application families. No additional deployment was started for this pause.

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

## Staff workspace checkpoint — 2026-09-08

Erik authorized continuing the entire migration to completion. Design Vault and Gear Publisher now use the scoped shared controls and neutral staff shell. Their Art Hub/dash-shell imports are removed; Vault also moves toast presentation onto the shared entry point. Page-owned layout retains artwork identity, photo bindings, search and publishing hooks.

- dashboards/design-gallery.html: 212,483 → 89,746 raw local CSS bytes; 5 → 3 local stylesheets.
- dashboards/gear-publisher.html: 170,944 → 43,968 raw local CSS bytes; 4 → 3 local stylesheets.

The wider shared control owner also adds a small source-byte cost to the first four pilots; their budgets were remeasured for the added dashboard/publisher/toast adapters. These figures are source bytes, not compressed transfer.

Browser review exposed existing behavior defects addressed in the same family: overlay Escape/focus and history cleanup; mobile drawer metadata/hero layout; keyboard photo selection; saved draft field/color/photo restoration; known-job resume through GET; saved publication receipt; and Next no longer skipping review into an empty Live panel. No production business writes were used to test these paths.

The runtime census accounts for 304 tracked HTML sources. It records literal route aliases, CSS imports, script dependencies, dynamic owners and explicit email/archive boundaries. The seasonal breast-cancer bundle remains in scope because a root route still serves it. Family-specific runtime/state coverage remains unfinished; the source census does not certify all application screens.

Before release: complete all local gates, verify exact-source CI, invalidate changed assets, deploy and check live bytes/access gates. Continue next with the five Bradley transfer consumers together, then the coordinated Steve/Ruth/AE art-workflow family. Full application completion remains open.

## Staff workspace release record — v2026.09.08.3

Exact-source CI 34216155948 passed on 03b4f3c5857c43b3d7ab0ebb08121c7ec8454b26. Local verification: 205 unit suites / 4,884 passing tests (four existing skips), 88 DOM tests, four axe unit tests, 84 fixture-parity cases, 33 browser tests passed (three optional screenshot skips), including all five calculator surfaces and 18 CSS state tests. CSS scope 284 files clean; JavaScript lint, types and build clean; 456 server registrations unchanged. Screenshot review also restored the Vault card body wrapper and readable Publisher progress labels. Production rollout requires the matching live SHA and changed-asset byte checks. Six application pages now use the shared owner; the complete runtime/state coverage and all remaining families remain open. Next: all five Bradley transfer consumers.

## Bradley family plan — 2026-09-08

The workspace release is live as v2026.09.08.3 / Heroku 2063, full SHA 6f4a326ce94f4d4c1f6f15ec9e67f98825802b16. Nine changed assets match committed bytes; both staff access gates and both earlier public pilots respond correctly.

- [x] Move Bradley Transfers, Bradley Screen Print, Supacolor Orders, Transfer Detail and Supacolor Job Detail together onto the shared staff shell and Bradley slate accents. Remove their Art Hub imports and keep operational status colors distinct.
- [x] Keep reusable sender, status, screenshot-import and image-viewer patterns in shared owners. The replacement sender entry point will serve opted-in queues; the old entry point remains temporarily for Steve and the two art-detail consumers until their next coordinated migration. Retired sender selectors must have no runtime template before being dropped.
- [x] Replace static inline presentation and visibility mutations with owned classes/hidden states; preserve paste guards. Use a shared dialog helper for keyboard focus, dismissal and scroll restoration. Correct the clipped mobile Job Detail actions and the PO input flex basis that creates excess vertical space after its layout turns into a column.
- [x] Add mocked normal/loading/empty/error/filter/dialog/image/import coverage at desktop, tablet and phone widths; mock sync, Box shared-link creation, OCR, notifications and all business writes. Verify old thumbnail callers through the full existing browser gates.
- [x] Register new owners, update per-page CSS budgets and runtime evidence, pass the complete local and exact-source CI gates. Release rollout/live verification is recorded separately below; continue with Steve/Ruth/AE afterwards.

## Bradley implementation checkpoint — 2026-09-08

Five more pages use the shared staff shell, slate accents, owned control/layout layers and Public Sans. Their targeted browser states now pass, including populated file picking, screenshot review and existing Steve/builder compatibility. Full local gates, exact-source CI and deployment remain pending.

- dashboards/bradley-transfers.html: 216,211 → 118,544 raw local CSS bytes; 4 → 4 local stylesheets.
- dashboards/bradley-screenprint.html: 216,211 → 118,544 raw local CSS bytes; 4 → 4 local stylesheets.
- dashboards/supacolor-orders.html: 197,054 → 106,441 raw local CSS bytes; 4 → 4 local stylesheets.
- pages/transfer-detail.html: 216,465 → 133,999 raw local CSS bytes; 5 → 4 local stylesheets.
- pages/supacolor-job-detail.html: 217,378 → 109,160 raw local CSS bytes; 6 → 4 local stylesheets.

Common-owner growth and source formatting also increased the six earlier pages' source-byte totals; their budgets were remeasured explicitly. These are uncompressed source bytes, not transfer savings. The migrated sheets have no important declarations, CSS IDs or local overrides of global scales. Shared UiDialog owns focus, Escape, inert background and scroll restoration. Visibility guards use the same hidden state as the migrated markup.

Runtime checks corrected premature refresh success notices, stale file-picker checkmarks after failed links, inaccessible scrollable screenshot summaries and unreadable/clipped phone controls. No live business writes were used. The complete application rollout remains open; next is the coordinated Steve/Ruth/AE workflow family.

## Bradley release gate repair — 2026-09-08

The first full browser gate caught an existing DTG save bug: both pricing requests were pending when a fixed six-second delay expired, yet a 24-piece quote posted zero dollars to the test mocks. The release was held. DTG now blocks incomplete, unsupported-size and stale pricing before any save write; Print uses the same readiness check. Late responses cannot overwrite newer inputs, and size maps are copied into the save snapshot. No pricing formula or production business data changed.

Forty-four focused DTG unit checks and 19 targeted browser checks pass, including the negative pending/failed save, the positive live-price save, all 17 Bradley/legacy compatibility cases, file-picker busy/retry states and keyboard-scrolled mobile screenshot review. The full application gates are running again before source CI and deployment.

## Bradley release record — v2026.09.08.5

Exact-source CI 34223103534 passed on eff0bfef251a57b15477ef43b123161cec7a4e3f. Local verification: 206 unit suites / 4,907 passing tests (four existing skips), 88 DOM tests, four axe unit tests, 84 fixture-parity cases, 51 browser tests passed (three optional screenshot skips), including all five calculator surfaces and 35 CSS/compatibility checks. The DTG regression gate blocks pending, failed, partial and stale pricing before saving or printing; the positive browser path saves real live-engine prices. After CI exposed transient contrast during the image-preview fade, the shared animation keeps text opaque and all 35 CSS checks pass with a midpoint assertion. CSS scope 285 files clean; JavaScript lint, types and build clean; 456 server registrations unchanged. Production rollout requires the matching live SHA and changed-asset byte checks. Eleven application pages now use the shared owner. The all-family rollout remains open; next is the six-page Steve/Ruth/AE, detail and Saved Mockups group.

## Art workflow plan — 2026-09-08

Bradley is live as v2026.09.08.5 / Heroku 2064, full SHA 7eccb599b7bc208a032d1c7918be4e0d17b9c9ae. Twenty source assets match committed bytes, the DTG compiled executable matches the tested build, five existing staff gates and three public HTML shells are verified. The compiled filename was resolved from production's own manifest because source-map line endings produce different Windows/Linux bundle hashes. Source CI 34223103534 is green; release-branch CI is finishing separately.

Erik reiterated authorization to continue until the application-wide work is complete. The six-page art family is Ruth, Saved Mockups, Steve, AE, Art Request Detail and Mockup Detail. Ruth and Saved Mockups are the first implementation pair.

- [x] Replace Ruth's four competing legacy shared imports with one scoped art-workflow owner, preserving status/hold/rush/due/revision and billing meaning. Use existing shared controls, Public Sans, neutral surfaces and purple accents. Port grid, board and recovery patterns for later Steve/AE adoption.
- [x] Move Saved Mockups onto shared staff controls with readable metadata and one artwork card per phone row. Preserve search and Designer/Request destinations; make image preview keyboard-accessible and request/image failures visible with recovery.
- [x] Test real rendered normal/loading/empty/error/retry/filter/tab/board/dialog states at 1440/768/390/320. Mock all writes, OCR, Box shared links, recovery and notifications. Baselines were captured at 1440/390 before editing.
- [x] Register new owners and tests immediately; replace dead consumer imports, measure bytes and update the ownership manifest. Complete all local gates, exact-source CI, deployment and live verification.
- [ ] Continue Steve/AE and both detail consumers, then remaining staff/customer/calculator/builder/document families. Full rollout remains open.

## Art first-pair checkpoint — 2026-09-08

Bradley release-branch CI is green on main (34223767617) and develop (34224009251), matching the verified live v2026.09.08.5. Ruth and Saved Mockups now use shared controls and scoped art/page owners locally. First browser pass: ten tests passed at four widths; 37 focused unit checks passed. Additional failed-refresh/bulk-recovery cases, billing-content preservation and the final full gates are still pending. No art-family deployment has occurred.

Ruth removes four competing shared legacy imports; Saved Mockups removes Art Hub. The board now retains search, respects status filters and excludes paused work; completed expansion and recovery dialogs have keyboard paths. Error states expose retry and clear stale records. Saved Mockups uses one card per phone row and preserves calendar dates. Stylesheet budgets use committed LF source bytes, because checkout CRLF otherwise caused false growth after a clean release checkout.

## Art release-gate follow-through — 2026-09-08

All 12 Ruth/Saved Mockups browser cases passed, including failed-refresh, recovery/upload/bulk failures, retry, cancellation, keyboard dialogs, and four widths. The full local gate passed 206 unit suites / 4,915 tests, 88 DOM tests, four axe unit tests, 84 fixture-parity cases, and CSS lint on 286 files before catching a Bradley error-toast opacity frame. The release remains held until the corrected full gate and exact-source CI pass. The toast now keeps text opaque through entry/dismissal; the two existing retry tests sample real animation midpoints. Ruth also retains keyboard focus after rebuilding filters and expanding completed work. Reviewed final Saved Mockups desktop, Ruth phone recovery and phone billing screenshots.

After this pair ships, prioritize the confirmed transfer/Supacolor authentication boundary below, then resume Steve/AE and both art detail pages. The application-wide CSS work is still open.

## Art first-pair release record — v2026.09.08.6

Exact-source CI 34228004194 passed on ba9305807615977e3c1051162abeec6f41d365c4. Ruth and Saved Mockups have scoped shared controls, readable responsive layouts and keyboard-accessible filters, cards, board expansion and recovery dialogs. Their local CSS sources dropped from 195,318 to 83,050 bytes and 153,935 to 62,346 bytes respectively, measured with committed LF line endings. Existing billing content and workflow destinations are preserved. Loading, empty, request/image errors, recovery, retry and cancelled operations have rendered coverage. The Bradley toast regression now preserves opaque text through actual entry/dismissal animation midpoints.

Verification: 206 unit suites / 4,915 passing tests (four existing skips), 88 DOM tests, four axe unit tests, 84 fixture-parity cases, JavaScript lint and types clean, CSS lint on 286 files, build and boot checks, and the full browser gate including all five live-price calculator surfaces. Business writes and notifications were mocked. Route table remains 456 registrations / 23 modules. Thirteen pages use the unified design owners after this rollout; deployment requires matching live SHA and source-asset bytes. Next priority is the confirmed transfer/Supacolor caller/authentication boundary, then Steve/AE and both detail pages. The application-wide rollout remains open.

## Art first-pair live verification — v2026.09.08.6

Heroku 2065 succeeded on 5d547dca8dae53493a8caa0cb0392ac00f899e11. Six changed source assets match the committed bytes, four existing staff HTML gates refuse anonymous access, and the two public reference/inquiry pages still return the unified shell. Exact-source CI 34228004194 is green; main/develop release-branch checks run separately. Local gates passed 4,915 unit tests, 88 DOM tests, four axe unit tests, 84 fixture-parity cases and 63 browser tests (three optional screenshot skips), including 47 CSS/compatibility cases and five calculator surfaces. Thirteen pages are now live on unified owners.

Next: implement the staff transfer/Supacolor relay module and six browser callers, preserving the proxy's 10 MB screenshot limit behind staff authentication; cover actual-server HTML/API gates and vendor/customer exceptions. Backend source d5fd4f242f17926da88ac5e881106fb89135466f has 1,777 passing unit tests and stays undeployed until the frontend callers are live. Existing CRM credentials match across both apps and proxy scheduler configuration without any secret change. Then resume Steve/AE and both detail-page CSS migrations.

## Steve, AE and art details checkpoint — 2026-09-08

- [x] Migrate Steve, AE, Art Request Detail and Mockup Detail onto scoped Public Sans staff/customer surfaces, department accents and shared theme/detail/action/intake owners. Consolidate 113 identical detail rules and 199 repeated intake rules. Keep shared tokens/components unchanged.
- [x] Remove their competing legacy imports. Keep queue CSS out of details and unused ArtActions dialogs out of Mockup Detail. Preserve runtime classes, field IDs, URLs and pricing calculations.
- [x] Pass 23 mocked browser checks at 1440/768/390/320: galleries, board/filter/selection, five intake variants, invalid/queued-file states, loading/failure/retry, sender cancellation, customer rush/privacy, staff/customer print and keyboard thread-color selection. Review mobile AE navigation, detail dialog and print screenshots. A visible × replaces the picker's missing font icon; the full gate will include that final change.
- [x] Register owners and measure actual local CSS: Steve 235,880 → 157,571 bytes; AE 352,636 → 278,859; Art Request Detail 288,866 → 266,717; Mockup Detail 141,469 → 211,674. These are LF source bytes, not transfer savings; the smaller mockup page now pays for the common component/detail/transfer foundations, shared in browser cache.
- [x] Lock style graphs, per-page local aliases, JavaScript badge colors, budgets and the four exact customer/print visibility exceptions. The first ownership run passed 20 tests; recheck after final owner split.
- [x] Complete all application gates, cache invalidation, exact-source CI, deployment and live verification. The four-page family is live as v2026.09.08.9 / Heroku 2067 (verified below). Frontend security remains live v2026.09.08.7 / Heroku 2066; proxy security v2026.09.08.1 / Heroku 1130.

The other CSS task owns a separate forms/reference family in branch codex/css-forms under the transfer-frontend-release worktree. Coordinate merges after this release; do not switch its worktree or overwrite its work. Seventeen reviewed pages will be live after this four-page release, not the entire app. Remaining families and generated/email/embedded surfaces still need their own runtime states.

## Art/AE family release record — v2026.09.08.9

Exact-source CI 34263369308 passed on 61db6e6ef323cbe9680e56f79bbd59b50051305f, including the money path and all five calculator surfaces. Local verification: 207 unit suites / 4,966 passing tests (four existing skips), 88 DOM tests, four accessibility unit tests, 84 quote-parity cases, 90 browser tests (three optional screenshot skips), clean JavaScript lint/types, 290 clean CSS files, build and HTTP startup. The route table remains 485 registrations / 24 modules. All 24 new family browser tests pass; staff/customer print and thread-color keyboard behavior are included. The migrated transfer consumers load ui-dialog.js before the sender; both Steve and Art Request Detail have focus/dismissal regression coverage.

Steve, AE and both details now share scoped theme, queue, detail, intake and action owners. Seventeen reviewed pages are ready for this rollout. Source CSS falls on Steve, AE and Art Request Detail; Mockup Detail gains the common foundations and keeps queue/unused action CSS excluded. Actual stylesheet graphs and byte budgets are locked. Exactly four customer/print visibility exceptions are documented; generated thread-sheet HTML and other unreviewed families remain open. Release rollout still requires matching Heroku slug SHA and source-asset bytes.

## Art/AE family live verification — v2026.09.08.9

Heroku 2067 succeeded on 0d06c990d1065e8c20a333f96b2f5f7b05a4b15e; 17 changed source assets match committed bytes. Six anonymous staff route gates and four public/customer HTML shells pass. Source CI 34263369308 passed all four jobs, including money/calculator parity. Main/develop release-branch checks are tracked separately and were still running when this checkpoint was saved. Local gates: 207 unit suites / 4,966 passing tests, 88 DOM, four accessibility unit tests, 84 quote-parity cases and 90 browser tests, with only the four existing unit skips and three optional screenshot skips.

All 24 new art-family browser cases and the Steve transfer-sender compatibility check pass. The missing ui-dialog.js dependency discovered by the full run is fixed and locked by a load-order guard. Seventeen application pages now use reviewed unified owners; the application-wide migration remains open. The three-worker trial passed all 74 mocked CSS/relay cases in 156.8 seconds. Use parallel workers for the isolated mocked checks when practical; live-price checks remain serial. CI optimization is the next implementation step, followed by training-directory pages while the other task owns forms/reference work.

## Training continuation plan and validation speed — 2026-09-08

- [x] Art/AE main CI 34264415089 passed all four jobs on the live 0d06c990d1065e8c20a333f96b2f5f7b05a4b15e. Develop CI 34264868532 is finishing the live-price step separately.
- [x] Add `npm run test:css` and use it for the mocked CI step with three workers, matching the measured 74-case local trial (156.8 seconds). Keep global and live-price workers at one. Exact-change CI still needs verification.
- [ ] Baseline the training-directory reference pages and group their shared navigation, readable document layout, tables, callouts and keyboard interactions. Preserve prose, links, policy/pricing examples and local exercise behavior. Coordinate around the separate forms/reference worktree.
- [ ] Migrate the common guide shell with Public Sans, neutral staff surfaces and the existing training accent. Use restrained green wayfinding, left-aligned document headings and readable line lengths; shared rules own recurring patterns and page files own only unique layouts. Keep tokens/components unchanged.
- [ ] Verify desktop/tablet/phone, print, tabs/accordions/search/copy/quiz states as applicable, then update exact style graphs and budgets, run all gates and deploy after exact-source CI. Training is not yet migrated or live.

## First training guides checkpoint — 2026-09-08

The lead follow-up, embroidery order-type and NWCA language guides now use one scoped training document owner locally. Eight browser checks passed, covering four widths, keyboard table scrolling/disclosures, pending/failed/retried clipboard operations and print. The original guides overflowed 390px phones by 300px, 9px and 96px respectively; all now fit 320px and wider. Removed 36 static inline styles and 15 language-print important overrides. Prose, historical pricing examples, IDs and link destinations are unchanged and locked by three content checks. The ownership suite passes 27 tests.

Actual printed PDFs were reviewed. The language reference now fits two readable landscape pages with complete content, replacing the old fixed-height 5–7pt sheet. A two-sheet output guard prevents the blank-page regression discovered during review. training/lead-follow-up-guide.html: 30,698 → 70,432 LF source bytes; training/shopworks-embroidery-order-type.html: 27,575 → 68,465 LF source bytes; training/nwca-language-reference.html: 31,727 → 70,479 LF source bytes. The small pages gain the common component foundation, so these are not claimed as transfer savings. Tokens/components remain unchanged.

Validation speedup c5f25ded632c94d222e18d1c19228e3a20280b43 passed CI 34265865374. Art/AE release main CI 34264415089 and develop CI 34264868532 both passed on live 0d06c990d1065e8c20a333f96b2f5f7b05a4b15e. The former CSS Factor task is now archived; its codex/css-forms worktree was checked read-only and remains clean at c20d424b with no new forms work. No unmerged forms implementation was found.

Next: full local gates using the parallel mocked group and serial live-price group, exact-source CI, then deployment/live checks. Seventeen pages remain verified live; these three bring the reviewed implementation count to twenty only after their rollout. Continue the remaining training guides and lessons afterwards; the whole application is still open.

## Training release gates complete — 2026-09-08

All full gates passed: 207 unit suites / 4,972 tests (four existing skips), 88 DOM, four accessibility unit tests, 84 quote-parity cases, 82 mocked browser cases in 207.9 seconds with three workers, and 16 remaining browser cases with three optional screenshot skips. All five live calculator surfaces passed serially. Lint/types, 291 CSS files, build/boot and the unchanged 485 registrations / 24 modules passed. After the last print-only refinement, all eight training browser checks and 27 ownership checks passed again and CSS lint remained clean. Actual final PDFs were reviewed: lead guide nine pages, embroidery guide two, language reference two; proper paper margins and complete content.

Release review found concurrent committed work fe794c6f8584208d87c0b821ce62b190fa5b49f3: two blank one-page employee PDF forms and one forms-library category icon. Both PDFs were opened/rendered and their unfilled content verified; their source bytes will be checked live. This is separate from the archived CSS task and its untouched worktree. The release will include that committed change with its original changelog attribution; no Caspio rows or business data were changed by this task. Exact final source CI and production rollout remain pending.

## Training guides release record — v2026.09.08.10

Exact-source CI 34269638273 passed on 67d1cd731d8baf0872fef794af828fcad5032d86, including the live money path and all five calculator surfaces. Local gates passed: 207 unit suites / 4,972 tests (four existing skips), 88 DOM, four accessibility unit tests, 84 quote-parity cases and all 98 browser tests (three optional screenshots skipped). The fully mocked 82-case group ran with three workers; live pricing stayed serial. JavaScript lint/types, 291 CSS files, build and boot are clean; routes remain 485 registrations / 24 modules.

The lead follow-up, embroidery order-type and NWCA language guides share one reading/navigation/table/print owner. All original text, historical examples and links are preserved. Phone overflow is fixed; disclosures work by keyboard; clipboard errors offer retry. Actual PDFs were reviewed, including a complete two-page landscape language handout with a page-count guard. Twenty application pages are ready for the shared design after this rollout. Small guides gain the cached common foundation; source byte growth is recorded explicitly, not claimed as a transfer saving. The application-wide CSS migration remains open.

## Service training guides checkpoint — 2026-09-08

Art approval, thank-you cards, lead sheets and Google reviews now use the common reading foundation plus one scoped service owner and controller. Four duplicated scripts and two page stylesheets are replaced; handwritten examples and practice fields keep two small unique sheets. All fourteen headings are native keyboard buttons; panels remain readable if the controller fails. Field help is always visible and associated with inputs. Image loading/failure/retry is explicit. Tokens/components and the previous three guides are unchanged. Four original inline declarations are gone; prose, links, IDs and practice values are locked by source contracts.

Twelve focused browser cases passed across 1440/768/390/320, keyboard actions, all sections, tables, image failures/retry, field help/local edits, no-controller reading and print. Final print refinements hide chevrons, repeat table headers and keep instructional images with headings. Actual images loaded successfully for visual review; final PDFs have 2/6/3/3 pages, complete and legible. Full local gates now pass 207 unit suites / 4,980 tests (four existing skips), 88 DOM, four accessibility unit, 84 quote parity, lint/types, 290 CSS files, build and HTTP boot. Full browser suites and exact-source CI/deployment are still pending at this checkpoint. The initial hygiene run used Git's unstaged deleted-file list; explicitly staging the six replacements and three new files fixed the census without weakening its checks.

Current production remains v2026.09.08.10 / Heroku 2068 on d65ccce189c969b8b8baed56d755c7ee6e82b58f, with twenty reviewed pages. Source CI 34269638273, release main CI 34270803675 and develop CI 34271017981 all passed. These four guides bring the reviewed implementation to twenty-four after deployment/live checks. CSS source totals grow on the smaller guides because they now load the common cached foundation; do not describe this as byte savings. The application-wide rollout is open, with remaining training/reference, forms, storefront, calculator/builder and generated document states still to cover. No business writes or notifications were made.

## Service-guide full gates complete — 2026-09-08

All gates passed on the final service-guide source: 207 suites / 4,980 unit tests (four existing skips), 88 DOM, four accessibility unit tests, 84 quote-parity cases and 110 browser tests (three optional screenshot skips). The isolated 94-case group took 183.3 seconds with three workers; sixteen remaining cases and all five calculator surfaces passed serially. CSS lint: 290 files, one fewer because two duplicate sheets became one shared owner. Build, lint/types, route table/undefined checks and HTTP boot are clean. Exact-source CI and rollout follow. The next larger batch has read-only baselines for all seventeen printable forms, including phone overflow and actual print page counts; no forms implementation has started.

## Training guides release record — v2026.09.08.11

Exact-source CI 34273774152 passed on edd6cf1ca5b9371df2e71817f6ebcd3d925ba8b0, including all required jobs and live money/calculator parity. The full local application gate passed; exact counts and timing are recorded in the service-guide checkpoint and local-gates artifact. Routes remain 485 registrations / 24 modules. Business writes and notifications were mocked.

Art approval, thank-you cards, lead sheets and Google reviews share one scoped service-guide owner and controller. Six duplicate assets are replaced; unique handwritten specimens and practice fields keep two small page sheets. Original prose, example values, IDs and destinations are preserved. Four-width/keyboard checks cover all fourteen disclosures, visible field help, image loading/failure/retry, no-controller reading and printing. Actual image-loaded PDFs were reviewed (2, 6, 3 and 3 pages). Twenty-four pages are ready for unified styling after this rollout. The application-wide migration remains open.


## Printable forms release record — v2026.09.08.12

Exact-source CI 34280132378 passed on 70b32f5ae11672d21a77e67624d1f9aff31be684, including all four required jobs and live money/calculator parity. Full local unit/DOM/a11y/browser/quote-parity/CSS/build/boot gates passed; counts are in the printable-forms local-gates record. Routes remain 485 registrations / 24 modules. Business writes and notifications were mocked.

Seventeen printable forms now share a scoped owner and Public Sans screen layout. Page sheets retain unique fields and paper orientation; all original prose, IDs/default values and destinations are guarded. All seventeen blank PDFs retain their page counts. Focused browser coverage includes four widths, keyboard/focus, clear/cancel, saves, drafts, contacts/dates, QC, roster totals and AE money/provenance. Native swatch clicks support keyboard and pointer, menus escape table scroll containers, failed color lookups stay visible, and style changes clear stale color verification. Temporary print text preserves full values and restores editing afterward; reviewed output retains writing lines, compact card authorization, complete notes and legal/signature groups. Forty-one reviewed pages are ready after this rollout; the application-wide migration remains open.



## Training practice release record — v2026.09.08.13

Exact-source CI 34300872261 passed on 0ca66081bdd5bee21197a76aa29259c25021f38c, all four jobs including live money/calculator parity. Seven pages use scoped training layouts and existing shared controls. Original lessons and seven exercise data objects are guarded. Matching works through keyboard, touch and drag; score retries, answered-state locks, timers and native completion dialogs are checked. Template copying and browser storage failures remain visible; saved content renders safely after reload. The superseded training-shared.css has no HTML callers and is retired. Reference PDFs reviewed: hub one page, notes six pages with complete sections, twelve complete email templates. The corrected inventory has 225 application/served-archive pages: 48 reviewed after rollout, 177 pending. Actual slug/live verification follows this release commit.


### Reference family implemented — 2026-09-08

Four local pages now use shared reference patterns and existing controls/tables. Sixteen focused browser cases pass at 1440/768/390/320: keyboard/touch checklists, original storage keys, save/reset/read failures, protected malformed progress, print/nav/reduced motion, quick-tip search/empty/load/retry and safe rich text. Original HTML prose/figures/fields/media and shared tips JSON are preserved (99 ownership/content cases passed before final formatting; rechecked by full gates next). Quick-tip calendar dates no longer shift backwards in Pacific time; seven-day badges exclude future dates.

Real PDFs reviewed: caps 3 pages (was 7), tips 3 with one full topic per page, shipping 10 (was 11), purchasing 9 (was 10). All 333 selected content blocks occur in the PDFs; cap images, procedure screenshots, complete checklist sections and document hierarchy inspected. Full release gates/source CI/deploy remain pending. These four pages are not yet counted live: .13 remains 48 live / 177 pending. Source/PDF/test artifacts use reference-* in the existing artifact directory.


### Reference family ready for source CI — 2026-09-08

Full local release checks passed: 207 unit suites / 5,044 passed / four existing skips; 88 DOM, four a11y, 84 quote parity; 178 mocked CSS/auth browser cases plus 16 other browser cases (three optional screenshot skips), including all five live calculator comparisons. Build/lint/types/292 CSS/boot pass; 485 registrations / 24 modules. All sixteen family browser cases and 99 ownership/content checks passed. Desktop/phone and PDFs reviewed, 333 selected content blocks preserved; caps 3, tips 3, shipping 10 and purchasing 9 pages. Source CI, release and live verification remain required; production is still .13 / 48 reviewed / 177 pending. .13 main CI 34301559921 and develop CI 34301708124 both passed.

Next training work has eight tracked pages: manuals/schedule/Erik biography (4), ShopWorks customer setup pair plus tax code game (3), Training Center (1). Baselines also captured an ignored local api-test-runner.html that is NOT tracked/deployed; leave it alone and exclude it from migration counts. Initial baselines cover all eight. Verify all chapters/days, hash navigation, keyboard disclosure, stored progress and print states; basic first-load checks do not cover these large manuals. Training census: 26 tracked pages, 18 reviewed after this release, eight pending; the earlier thirteen/nine remaining-family totals included that ignored local artifact. Overall 225/52/173 application counts are unchanged. The biography writeEmbed error occurred with external scripts blocked and is not yet established as a live-app defect. Keep business lesson data unchanged during CSS migration.

## Training reference release record — v2026.09.08.14

Exact-source CI 34303626869 passed all four required jobs on eac07064ad2952da43563c0ad89482928b02dffe, including live money/calculator parity. Four pages share the existing component/training-guide foundations and scoped training-reference patterns. Original lessons, figures, media and shared tips data remain unchanged. Sixteen focused browser cases cover four widths, keyboard/touch checklists, persistence/read/write/reset failures, safe tip rendering and request retry. Reviewed PDFs: caps 3, tips 3 complete topics, shipping 10, purchasing 9; all 333 selected text blocks preserved. After verified rollout: 52 of 225 application/served-archive pages reviewed/live, 173 pending. Actual slug and live verification follow.


## Manual-family implementation checkpoint — 2026-09-08

Four next pages implemented locally: customer-service, get-to-know-erik, sales-coordinator-manual, sales-coordinator-training-schedule. Production remains .14 / Heroku 2073 / 7c65286d (52 live, 173 pending). This candidate would make 56 live / 169 pending, leaving four training pages. Shared training-manual.css/js own reading/contents/navigation/print. Old customer-service/bio page scripts are retired and explicitly staged as removals; all create/delete actions registered.

Four-width browser review and 14 family browser cases passed before final paper refinements; all 44 manual chapters and all 12 schedule sections were exercised with axe. 109 ownership/content cases passed. Full local release suite and exact-source CI/deployment are still pending. Original body text/media/fields and employee/scenario data remain locked. PDF review now verifies 2,910 selected content blocks (navigation labels omitted intentionally from paper): customer-service 54 pages, biography 2, manual 64, schedule 33. Generic .card was removed from schedule to eliminate an unwanted blank opening page. Paper has no blank sheets. Latest shared summary page-break refinement and continuous-document scroll marker still need the final broad browser run.

Artifact directory remains the same. manual-family-owned-files.json is the explicit ownership list; training-manual-baseline-record.json records pre-migration content on c9b0d054. manual-paper-review.json reports selected paper text; manual-after-*.pdf and manual-paper-*-*.png contain visual evidence. Do not rerun install-training-manual-family.cjs or register-training-manual-checks.cjs: they are one-shot mutation helpers. Next: finish paper overview, run training-manual-full-gates.ps1, then prepare a version from fresh tags/HTML, commit explicit files including the new browser test, wait exact-source CI and deploy.


## Manual family ready for exact-source CI — 2026-09-08

Full local release checks passed: 207 unit suites / 5,054 tests (four pre-existing skips), 88 DOM, four a11y unit, 84 quote parity, 192 mocked browser cases and 16 remaining browser cases (three optional screenshot skips), including all five live calculator comparisons. Build/lint/types, 293-file CSS scope and HTTP boot probe pass; 485 registrations/24 modules remain unchanged. All 14 final manual browser cases are included. The updated legacy navigation guard validates 44 real links/targets and native top control; no protection was removed.

Final reviewed PDFs: customer-service 54 pages, biography 2, manual 63, schedule 34; 2,910 selected content blocks present. Summary headings stay with following content, and the roster table has compact, readable paper columns. Source and fixture guards preserve original prose/media/fields/employee/scenario data. Family CSS: 67625 → 32489 UTF-8 bytes (52% less; existing shared foundations and network transfer are separate). .14 remains live until this source passes CI and is deployed. Candidate outcome: 56 live / 169 pending, four training pages left. Use push-pricing-heroku-once.ps1 with the exact release SHA for the next Heroku push; a transport failure requires checking actual release status before retrying.

## Training manual release record — v2026.09.08.15

Exact-source CI 34306633189 passed all four jobs on 20d3e247ee8519e99cb51084d9099467cf78588e, including live money/calculator parity. Four pages now share accessible contents/chapter navigation, native biography disclosure and complete-guide printing with restored screen state. Original prose/media/employee/exercise data remains locked. Fourteen browser cases cover four widths, every chapter/day, keyboard/history and print state. All 2,910 selected paper-content blocks are present. After verified rollout: 56 of 225 application/served-archive pages reviewed/live, 169 pending; four training pages remain. Actual slug and live verification follow.

## Final training family local checkpoint — 2026-09-08

Worktree codex/training-final-family (base 20d3e247) implements Training Center, tax-code trainer and both ShopWorks customer-setup exercises with tokens/components/training-practice/training-simulator and scoped page arrangements. No pricing/lesson values changed. Original course literals, prose and fields/options are locked. All 14 initial browser cases and 121 content/ownership checks passed; three further score/persistence cases are running. Shared fields, compact navigation, mobile layouts and native tax/results dialogs are reviewed; complete visual and full release gates remain. Primary develop is .15 live release plus checkpoint e975fb14; integrate this work after local verification, preserve the primary checkpoint, and do not claim .16 live until actual deployment is verified. Candidate census after this family is 60 reviewed / 165 remaining of 225; all 26 training sources covered.

### Final training print follow-up

Actual print review found the tax exercise forced onto a new page and repeated simulator controls consuming five pages. Scoped print rules now keep directory at two pages, tax challenge at one, basic setup at one and expanded simulator at two. Four real-PDF cases added; all 21 family browser cases passed, followed by four final print cases. Original fields/course material remain unchanged. Review port 3416 is isolated from the primary release suite on 3400. Source CSS now 21% smaller including the new print contract.

## Final training release record — v2026.09.08.16

Exact-source CI 34310205668 passed all four jobs on 76a52b66f0de2a049e639a6bc446cd7163e19275, including live money/calculator parity. The Training Center, tax trainer and both ShopWorks simulators now share responsive controls and clear round/progress state. Original course data, fields and options remain locked. Twenty-one focused browser cases cover four widths, keyboard/dialogs, full/restarted rounds, storage/timer failures and compact real PDFs. All 26 tracked training pages are covered. After verified rollout: 60 of 225 application/served-archive pages reviewed/live, 165 pending. Actual slug and live verification follow.

## API reference family plan — 2026-09-08

Work continues with standing edit/deploy authorization. Isolated worktree training-final-worktree now uses branch codex/api-reference-family, based on exact .16 source 76a52b66. Primary .16 deployment remains independent. No API reference changes are live yet.

- [x] Save original static prose, links, fields and reference-data AST hashes for Caspio, ManageOrders, SanMar and ShopWorks ODBC; capture desktop/phone baselines. Artifact api-reference-original-baseline.json is based on 76a52b66.
- [ ] Replace art-hub/dash-shell dependencies with shared scoped reference layout, tokens and controls; use Public Sans, restrained forest accents, readable endpoint/field tables and useful phone layouts.
- [ ] Preserve technical content, service/schema paths, identifiers and access gates. Keep descriptions visible on phones; add keyboard table scrolling, labeled searches/status counts and native ODBC disclosure controls. Honor reduced motion and fragment navigation.
- [ ] Verify failed/malformed/empty ODBC catalog and retry without losing the search. Preserve source catalog and never call business services in browser checks.
- [ ] Lock original data/content; review four widths, search cases, keyboard, complete printing and access protections; run required full release gates and exact-source CI before release.

Baseline each page loads 169,584–173,804 raw CSS bytes including shared dependencies. Four-page completion would bring the census to 64 reviewed / 161 pending of 225. This is a candidate outcome, not a live count. All original artifacts are in C:/Users/erik/.codex/visualizations/2026/09/07/01a07d90-9a4c-7e70-9e4e-c196377b7c6b. Do not rerun baseline capture or reset this worktree.

## API reference family local review — 2026-09-08

All four API reference pages use tokens/components/api-reference and their page-specific arrangements. Original reference-data AST hashes, prose/links/fields and the ODBC schema are preserved. Strict lint now covers all four controllers. Seventeen focused browser cases passed at 1440/768/390/320 with axe, native disclosure, escaped search, failed/malformed/empty schema and retry, real role/email gates, and print-state restoration. Four final PDF checks then passed after paper refinement; all 2,630 ODBC rows print even from a filtered screen. PDFs: Caspio 16 pages, ManageOrders 14, SanMar 11, ODBC 105. All 114 selected original prose blocks and 2,342 unique catalogue names appear in extracted PDF text; the dynamic Loading placeholder is excluded. Code ligatures are disabled so comparison operators copy exactly. Final rendered review and full integration gates remain before release.

Family CSS graphs: dashboards/caspio-api-reference.html: 173804 → 73142 bytes (58% less); dashboards/manageorders-api-reference.html: 169916 → 72834 bytes (57% less); dashboards/sanmar-api-reference.html: 169584 → 72821 bytes (57% less); dashboards/shopworks-odbc-reference.html: 171448 → 76198 bytes (56% less). These are source bytes, not network payloads. Current production remains .16 / Heroku 2075 / 520acd1d, 60 reviewed and 165 pending. Its follow-up main CI 34311104854 and develop CI 34311287933 passed. API candidate outcome is 64 reviewed / 161 pending, not yet live.

### API integration guard update

The first full unit run found five legacy admin-reference assertions tied to per-page important visibility guards and the old ODBC Retry id. Updated that existing guard to require the loaded unified components visibility owner, no page important rules, and the native Retry listener. The 17 real-browser cases already cover layout, disclosure and retry. Full regression rerun follows; no production change yet.

## API reference family ready for exact-source CI — 2026-09-08

Full integrated release checks passed on ecd150e5: 209 unit suites / 5,079 tests (four existing skips), 88 DOM, four a11y unit, 84 quote parity, 230 mocked browser cases and 16 remaining browser cases (three optional screenshot skips), including all five live calculator comparisons and EMB/CAP additional-logo tiers. Build/lint/types, 295-file local CSS scope and actual HTTP boot pass; 485 routes / 24 modules unchanged. All 17 reference browser cases and final paper checks are included. .16 remains production until exact-source CI and actual release verification finish.

Meanwhile the separate training-final-worktree now uses codex/policy-reference-family (base ecd150e5; plan commit 96b2364f). Its uncommitted task work is the next four pages: policy migration tracker, pricing-negotiation guide, Resources and Sale. Baseline and desktop/phone review saved; shared-layout rewrite applied, but controls/tests/complete review remain. Do not reset it or claim those pages are ready/live. Candidate after that next group: 68 / 157; this API group alone is 64 / 161. Policy CMS/editor/handbook are a later shared family.

## API reference release record — v2026.09.08.17

Exact-source CI 34313504483 passed all four jobs on d945a8423e6403bf7dd025ba576536624da1d741, including live money/calculator parity. The Caspio, ManageOrders, SanMar and ShopWorks ODBC reference pages share typography, labeled search, readable tables and phone layouts. Original technical catalogs and schema remain locked. Seventeen focused browser cases cover four widths, native disclosure, escaped search, malformed/failed catalog retry, PDF state and unchanged role/email gates. All 114 checked prose blocks and 2,342 unique catalog names print completely; code operators copy exactly. Full local checks passed: 5,079 unit, 230 mocked browser, 16 remaining browser and all five calculator surfaces. After verified rollout: 64 of 225 application/served-archive pages reviewed/live, 161 pending. Actual slug and live verification follow.

## Policy guides and notices plan — 2026-09-08

Standing edit/deploy authorization continues. Separate worktree training-final-worktree now uses codex/policy-reference-family, base ecd150e5, while the primary API reference family runs full release gates. API pages are not yet live. New scope: dashboards/policy-migration.html, pages/pricing-negotiation-policy.html, pages/resources.html and pages/sale.html. Policy editor/detail/hub/questions and the handbook share more controls and follow as a separate family.

- [x] Save original prose, headings, links, fields/IDs, CSS dependencies and exact migration snapshot hash in policy-reference-original-baseline.json (artifact directory).
- [ ] Review baseline desktop/phone, adopt shared typography/controls/reference patterns, replace Bootstrap/layout and dashboard-shell dependencies where used, and unify the two notice pages together.
- [ ] Preserve policy wording/figures, published migration records and route protections; repair native fragment navigation, keyboard filters and visible retry without changing any policy data.
- [ ] Review four widths, filtering, empty/error/retry, keyboard and complete paper content; add content/ownership locks, then full regression, exact-source CI and verified release.

Candidate result after this four-page group would be 68 reviewed / 157 pending of 225, assuming the API batch first ships its 64 / 161. No new page is live from this worktree yet. No business writes or notifications. Artifact path: C:/Users/erik/.codex/visualizations/2026/09/07/01a07d90-9a4c-7e70-9e4e-c196377b7c6b.

## Policy reference family reviewed locally — 2026-09-08

All four pages use shared tokens/components and scoped page owners. Removed Bootstrap from the historical guide and art-hub/dash-shell from the migration tracker. Resources/Sale retain their original notice text and share one layout. Historical policy prose/figures, original fields/IDs and the exact 414-row snapshot remain locked. Corrected the guide breadcrumb to the existing canonical /pages/policies-hub.html route. No policy/business data writes.

All 14 focused browser cases pass at four widths, including keyboard filtering and table scrolling, failed/malformed/empty snapshot retry, safe external text rendering, mobile contents/history/back-to-top focus, actual PDFs and unchanged anonymous/staff restrictions. The tracker needs a local admin test cookie; its ordinary staff denial is expected. All 178 ownership/content/legacy guard cases pass; strict lint on both controllers and 294 local CSS files pass. Actual PDF inspection: tracker 33 pages with all 797 unique checked record/prose fields, guide 11 with 161 content blocks/headings, notices one page each. Every original content block is present; only screen breadcrumbs/duplicate navigation titles and emoji presentation selectors are excluded from extraction comparisons. Print expands all 414 tracker rows and guide contents, then restores screen filters/disclosure.

Measured local CSS graphs: dashboards/policy-migration.html 167206 → 64221 bytes; pages/pricing-negotiation-policy.html 23460 → 67226 bytes; pages/resources.html 18041 → 57441 bytes; pages/sale.html 18041 → 57441 bytes. The tracker drops about 62%; guide/notices gain the cached shared component graph. Baseline guide count excludes external Bootstrap, so do not claim a network reduction from local byte totals. Visual review corrected principle-number spacing on paper and stronger link contrast on colored guide panels. Full primary gates, exact-source CI and verified .18 rollout remain. Candidate 68 reviewed /157 pending is not live until deployment.

## Policies CMS family plan — 2026-09-08

Worktree codex/policy-cms-family is based on integrated policy-reference source 10a439b3. The prior four-page candidate is running full gates independently in the primary checkout. Live remains .17 / Heroku 2076 /64 reviewed. No CMS application changes or business writes yet.

- [x] Save original HTML prose/headings, destinations, IDs/fields, CSS graphs, inline-state inventory and dependency ownership for Policies Hub, Policy Detail, Open Questions and Handbook. Four pages share policies-hub-v2.css; detail also owns policy-detail.css/org-chart-2026.css, handbook owns handbook.css. Artifact policy-cms-original-baseline.json.
- [ ] Move all four together onto shared tokens/components; replace the legacy shared stylesheet name and redundant control rules, retain purposeful reading/editor/chart arrangements, use consistent Public Sans and a responsive contents/navigation pattern. Register lifecycle changes immediately.
- [ ] Preserve published policy bodies, actual role gates and API payloads; exercise reads and admin edit/comment/question actions using mocked services only. Do not publish policies or modify the downloadable handbook PDF.
- [ ] Verify grid/list/search/categories, keyboard/dialog/focus lifecycle, storage and load errors/retry, admin vs staff viewing, chapter navigation and complete populated printing. Preserve source data and legal/policy prose.
- [ ] Run full local gates, exact-source CI and verified deployment after the preceding .18 batch; update the canonical live checkpoint only after actual release verification.

Candidate count after this family would be 72 reviewed /153 pending of 225, contingent on the previous four shipping first. Runtime generated documents remain separately tracked.

## Policies CMS family reviewed locally — 2026-09-08

All four pages now share tokens/components/Public Sans and policy-workspace.css. Original static prose/navigation/fields remain locked; the existing API client and authentication gate are unchanged. Published Caspio policy and organization records and the downloadable handbook PDF are untouched. Body content is exercised with synthetic fixtures only.

Twenty-one focused browser cases pass at four widths with axe, keyboard navigation, visible storage/catalogue/search/inbox failures and retry, ordinary-staff/admin controls, native AI modal/focus recovery, actual TipTap editing and unchanged normalized content through failed saves, loaded parent choices, disabled saving when the editor cannot load, blocked-storage comment identity, failed-post draft preservation, native moderation confirmation, chart search revealing collapsed teams, and paper preserving collapsed-screen state. Eight controllers pass strict lint; 294 worktree CSS files pass. Four targeted unit suites pass 137 tests with one sibling-proxy check skipped only in this isolated worktree.

Paper review verifies every selected synthetic block (101 in total): hub/detail/questions one page each, 23-page handbook with all 22 chapters and text following ordinary content dividers, and two-page chart with every tested team/name. Actual first/middle/last renders reviewed. Print hides editing controls, starts handbook chapters on new pages, restores disclosures/collapsed teams, and keeps chart coverage readable. Visual review also caught and removed the old mobile TOC height/row overrides from its actual handbook owner.

Bug fixes: use resolved staff identity for comments before guarded legacy storage; fail closed on missing content sanitizer or editor; load parent options after policy mode resolves; preserve text after ordinary handbook dividers; synchronize chart search visibility and expanded state; show unknown question count instead of a false zero; escape AI error toast text.

Measured raw local CSS graphs: pages/policies-hub.html 51709 → 99945 bytes; pages/policy-detail.html 138235 → 209120 bytes; pages/policy-questions.html 51709 → 99945 bytes; pages/handbook.html 65652 → 112698 bytes. These are source bytes, not network transfers; the shared component graph adds bytes to lighter pages and reduces repeated control ownership across the application. Full primary gates, exact-source CI and verified .19 release remain. Live remains .18 /68 reviewed /157 pending; candidate72 is not yet live.
