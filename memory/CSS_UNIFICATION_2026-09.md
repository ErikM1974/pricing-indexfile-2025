# CSS unification — design direction and implementation plan

## Active checkpoint — personalization released; staff toolkit next

**Frontend v2026.09.10.1 / Heroku 2097 / 0f151e3899b8517092b1864babd8ea7f579fc95b is LIVE.** Release status and running slug verified 2026-09-10T08:01:41.4246446Z. All 24 live checks passed: six versioned source assets match the release; three generated hashed copies match the build; seven prior authentication/session checks are unchanged; four retired stylesheets return 404; three public forms remain 200; names-and-numbers HTML uses the reviewed layout. The three form controller/service sources deliberately use versioned no-store URLs, outside the existing hashed-page list. Backend unchanged: v2026.09.08.1 / Heroku 1130 / d06aee3e4d25c5e1410241ea8007cdc8339aa3fa.

**162 of 225 application pages reviewed and live; 63 pending.** Another 79 sources are excluded: 12 archive, 14 email, 50 fixtures/templates and 3 retired. All 26 training pages are complete. Shared runtime forms, generated documents and external-provider UI remain separate unfinished tracks. Application-wide CSS cleanup is not complete. Standing edit/deploy authorization continues; no real business writes, outreach, uploads or notifications.

### Personalization completed

- Four pages: monogram dashboard, names-and-numbers dashboard, public names-and-numbers entry, and monogram form. One scoped personalization-workspaces.css owner with canonical tokens/components, Public Sans, navy/gold, consistent controls, responsive layouts, keyboard access and readable production/proof output.
- Four old sheets retired: 78,408 LF bytes and nine important flags. Shared quote-builder-common.css remains for other consumers. Each new direct CSS graph is 106,660 LF bytes; zero important flags in the new owner. Twenty-two original source hashes and 167 reversible changes preserve fields, names, jersey numbers, groups, prices, dates, thread colors, QA and payloads.
- Load/search/save lifetimes, malformed responses, retry, import/OCR ownership, native dialog focus, keyboard thread/location choices and original/current payload equivalence covered. All writes and allocating GETs were mocked. Eight PDF outputs / 18 pages visually reviewed, including 36-row wide rosters and 48-name production/script proofs.
- Reviewed source 315cc03bea6e9e235a5ea46e48113d0a40144ce5 integrated at 9fa9af6b4b38a6a75d0967a02cbb7307bcc610cc. Exact source b3147eab9220ef47330bc3a9a8c8d58287b3730a passed all four CI jobs in run 34451390044, including actual live money/calculator parity and mocked browser checks. Main CI 34452774685 passed with expected browser skip on the changelog commit. One Heroku push.
- Full local gates passed: 233 unit suites / 5,409 tests plus four existing skips; 88 DOM, four accessibility unit and 84 quote parity; 736 mocked browser plus 16 remaining e2e / three optional screenshot skips; all five calculator surfaces. Build, zero lint/type errors, 485 routes / 24 modules / zero undefined names, boot/version and production audit zero. Focused review: 57 browser cases and 288 preservation/CSS/QA checks.
- CSS scan: 272 tracked files. Primary also contains the preexisting ignored dashboards/css/staff-portal-final.css, so its local scan reports 273. Preserve this local-only file; it is not deployed. LESSONS_LEARNED has 262 lines. Heroku build reported two dev-dependency audit findings before pruning; production audit after pruning was zero. Heroku-22 future deprecation was noted; stack migration is separate from this CSS release.

### Next isolated batch — staff workspaces (baseline only)

The artifact training-final-worktree is now on codex/staff-workspaces. Its six pages are DrainPro Bundle, AE Mission Control, Company Numbers, Payroll, Production Shifts and Quote Management. All 61 transitive local HTML/CSS/JS sources match live v2026.09.10.1 / 0f151e38; immutable snapshots and source contracts are saved, and all 61 checks pass. No application edits or browser review have started; no migration credit.
Primary develop is frozen on b98a946b while the staff-toolkit full gates run. Keep this new baseline out of that release. Finish the eight-page toolkit release first, then build fully mocked original browser fixtures for these six pages. Preserve payroll/vacation calculations, shift times, quote attribution and shared inbound/box-label output. Company Numbers shares staff-dashboard controllers; AE and Quote Management share inbound and invoice/label helpers, so audit their other consumers before changing shared owners.
Exact baseline SHA is in artifact staff-workspaces-baseline-checkpoint.json; active-css-resume-state.json records both the in-progress release and the future worktree.

### Staff toolkit — eight-page candidate ready for full gates

- Isolated checkout: artifact training-final-worktree, branch codex/staff-toolkit. Exact reviewed SHA and owned paths are recorded in artifact staff-toolkit-reviewed-source.json. The reviewed source 38f4c3af is integrated into primary develop; live remains v2026.09.10.1 / Heroku 2097 until the next verified release.
- All eight pages and the Jim preview now use the common staff-toolkit.css owner. Eight old page stylesheets were audited and retired: 82,193 LF bytes and 16 important flags. art-hub.css, dash-shell.css and blog.css retain other consumers.
- Thirty-three original sources, including the Jim preview and its stub, are locked against ddfc5395 with 384 reversible HTML/controller changes. All 34 source/vendor contracts and 293 combined CSS/structural guards pass. All 77 focused browser scenarios pass after retirement and conversion of ten ID selectors to attribute selectors.
- Candidate census: 170 of 225 application pages migrated, 55 pending; verified LIVE count remains 162/225. There are still 79 excluded sources. Shared generated documents and provider UI remain separate unfinished tracks.
- Next: integrate this exact reviewed SHA with current primary memory, run full local unit/DOM/accessibility/parity/browser/build/lint/type/boot/audit gates, verify actual exact-source CI including the browser and money steps, and perform one verified release. Then continue the remaining families. No real business writes, outreach, uploads or notifications.


### Resume evidence and safeguards

Private artifacts: C:\Users\erik\.codex\visualizations\2026\09\07\01a07d90-9a4c-7e70-9e4e-c196377b7c6b. Release: personalization-{reviewed-source,integration-record,source-record,source-ci,release-record,local-gates,heroku-verification,live-verification,main-ci,checkpoint-record}.json and pricing-personalization-* logs. Next: staff-toolkit-{plan,source-record,original-browser}.json, staff-toolkit-fixtures.cjs, immutable staff-toolkit-original-* copies and tests/fixtures/staff-toolkit-original-content.json. active-css-resume-state.json is the current private pointer.

Completed mutation/commit/release helpers are one-shot; never rerun them. Original source copies are immutable. Isolated node_modules is a junction into primary: never recursively delete it; no .env copied. Stage explicit owned paths only. Backend preexisting untracked .agents/ and AGENTS.md remain untouched.


### Current isolated draft — all eight toolkit pages

Contract Break-Even, Roland Supplies, Volume Quote, Product Manager, Blog Editor, Portal Admin, Jim Mailing List and Past Due Orders use the registered, linted staff-toolkit.css owner. Public Sans, navy/gold, canonical fields/buttons and scoped page layouts. Each direct CSS graph is 184,660 LF bytes with zero important flags and undefined tokens; nine HTML consumers include the Jim preview. The shared family bundle is cached across these tools; it is not a claim that every individual page transfers fewer bytes.
All 33 original source contracts plus the restored vendor-list drift check pass with 384 reversible HTML/controller mappings. All 77 focused browser scenarios pass, covering four widths, accessibility, keyboard table scrolling, original/current prices and request bodies, loading/error/retry, obsolete responses, pending duplicate saves, original stored categories and image-upload snapshots. Controller ESLint is clean; the e2e spec and fixtures are outside existing lint scope.
Twenty-nine paper pages reviewed: Contract cost/profit three pages each, Volume memo/customer one each, Product catalog one landscape page, Blog short proof one page and long proof four pages. Blog print retains every one of24article sections plus table/code/quote/link and current metadata, with white paper and no screen focus outline. Portal access/requests/rewards each print one page; the long rewards fixture prints five with all24ledger entries, all18orders and their complete lines, plus an explicitly unposted draft. Per-page checks verify every money column remains on the same page as its orders. The final print refinement passed both relevant browser scenarios. Both Volume PDFs match immutable original extracted content exactly after whitespace normalization. Product screen rows and the valid fixed-price/legacy-vendor save match the original; its printed catalog retains all product values. Roland retains its original embed/PDF links; provider UI is a separate mocked boundary. All business writes, uploads and allocating GETs remain mocked.
Volume fixes: older garment pricing/stock cannot replace the current selection or a cleared row; row retries retain context. Pending saves capture all values and hold controls; invalid quote numbers stop before posting; uncertain saves direct staff to check Quote Management. Original price/cost calculations and successful bodies are unchanged.
Product fixes: incomplete product responses surface Retry, counts become unknown during failure/loading and filtering cannot hide the error. Successful saves with failed refresh report a catalog problem. Stored freeform categories survive unrelated edits. Pending image uploads/saves hold their editor, capture payload/record ID before awaiting and reject duplicate submits; failed saves preserve fields and avoid claiming no write occurred. The prior comment named a nonexistent vendor drift test; an actual mirror check now lives in staff-toolkit-content.test.js.
Blog fixes: malformed post lists/details and preview responses surface errors; latest selected post and latest body text own their responses. Pending saves/uploads hold the editor and reject duplicate requests. Successful writes followed by failed canonical reloads report Saved, keep published URL locks and preserve the draft; uncertain writes never claim NOT saved. Native image buttons work by keyboard; the pure markdown renderer and successful request contract are unchanged. Original HTML reversals use full file-input tags so a generic hidden attribute cannot corrupt unrelated elements.

Portal fixes: shared UiDialog lifecycle contains focus and restores the opener; canonical fields/buttons, readable phone totals, full keyboard-scrolling tables and separate customer-search status/listbox states. Failed/incomplete access/request/balance feeds remain unknown through filtering and expose retry; stale lookup, ledger and accrual responses cannot cross customers. Server numeric response schemas were verified read-only in proxy customer-rewards.js and frontend routes/customer-portal.js; pure money/accrual calculations are unchanged. Pending invite and reward writes hold their dialog and reject duplicates. Reward outcomes/errors remain inside the active dialog, uncertain responses do not report zero/success, and rejected request-status changes restore the saved value. Original invite/login-link/status/entry/post/reverse/expiry bodies match exactly in fully mocked workflows.

Portal paper uses a separate plain copy of expanded order details, strips action controls and labels any typed ledger draft as unsaved; screen details stay collapsed afterward. Print uses block flow for the modal host. PDF extraction alone missed visually clipped columns in an earlier draft, and reopening an overwritten PNG path showed stale image content: final rendered evidence now uses PDF-hash-specific filenames. The final paper refinements passed their focused browser checks; no shared UiDialog code was changed.

Mailing list: retain large text and 52px controls; native screenshot buttons, visible unknown counts/retry and captured pending form/AI/status/delete/sync controls. Unknown preview requests fail closed. Original fields, CSV bytes/name, Avery 5160 markup and nine successful synthetic request bodies match exactly. Its one-page labels retain all three synthetic addresses; generated label styling is unchanged and remains a separate runtime owner.

Past Due: keyboard-scrollable full tables, wrapped header controls, unknown counts during loading and validation that complete company lists match their rep groups. Missing rep groups previously appeared all clear; now loading fails visibly. Original 30/60/90-day tables, amounts and normal rep-sheet content match. An upstream omission warning is now repeated on printed headings. Two-page all-rep, one-page single-rep and three-page long reports were reviewed; all 57 long-fixture orders retain their amounts on the same page. The same-origin endpoint, order sorting, totals and freshness intervals are unchanged.

Post-retirement checks: 77 browser scenarios and 293 combined source/CSS/structural checks pass. Portal, Blog, Mailing and Past Due paper checks were rerun; portal per-page money remains complete. Full application gates and exact-source CI are still required before deployment.


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

## Policy reference full gates — 2026-09-08

Integrated source 10a439b32c7e0b80ba500153284795f894c2dac5 passed all required local checks: 210 unit suites /5,088 tests (four existing skips), 88 DOM, four accessibility unit, 84 quote parity, 244 mocked CSS/auth browser cases (364.6 seconds), 16 remaining browser cases (4.1 minutes, three optional screenshots skipped), and all five live calculator surfaces including EMB/CAP additional-logo tiers. Build/lint/types/295 CSS/HTTP boot pass; 485 registrations in 24 modules unchanged. Family source is ready for cache version .18 and exact-source CI; it is not deployed yet.

Useful work continued separately: training-final-worktree is now codex/policy-cms-family based on this integrated source. Its original four CMS pages/dependency graphs are saved in policy-cms-original-baseline.json; shared CSS rename/layout and markup edits are uncommitted, owned by this task, and NOT ready/live. Preserve them. Do not rerun one-shot installers. Upcoming work includes data/controller behavior, accessibility, original content locks and final print review.

## Policy reference release record — v2026.09.08.18

Exact-source CI 34315635746 passed all four jobs on c0c8dd25cb41df08510289c4c16365512db3273f, including live money/calculator parity. The policy migration tracker, historical pricing-negotiation guide, Resources and Sale now use shared controls and scoped typography/layouts. Policy prose, figures and the exact 414-row snapshot are unchanged. Fourteen focused browser cases cover four widths, keyboard filters/scrolling, failed/malformed/empty snapshot retry, mobile contents/history/focus, unchanged role restrictions and complete PDFs. All 797 checked unique tracker fields and all 171 selected static content blocks/headings print; notices remain one page each. Full local checks passed: 5,088 unit, 244 mocked browser, 16 remaining browser and all five calculator surfaces. After verified rollout: 68 of 225 application/served-archive pages reviewed/live, 157 pending. Actual slug and live verification follow.

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

## Policy CMS full gates — 2026-09-08

Integrated source 4dbca64461a7ee16c21cafd53443d1ba6d10db92 passed 211 unit suites /5,098 tests (four existing skips), 88 DOM, four accessibility unit, 84 quote parity, 265 mocked CSS/auth browser cases (385.4 seconds), 16 remaining browser cases (three optional screenshot skips), and all five live calculator surfaces including EMB/CAP additional-logo tiers. Build/lint/types/295 CSS/HTTP boot pass;485 registrations in24 modules unchanged. Ready for .19 cache version and exact-source CI, not deployed yet.

Next work is isolated in training-final-worktree, branch codex/webstore-family based on reviewed CMS commit32cd5e64. Twelve public webstore pages share a new family layout and native guide controller; baseline, plan and original metadata are saved, initial desktop/mobile render review is complete. Work is uncommitted and NOT ready/live. No business writes. Preserve this worktree and node_modules junction.

## Policy CMS release record — v2026.09.08.19

Exact-source CI 34319634271 passed all four jobs on 1919b192842f41790e1cc12142c411bf07539465, including live money/calculator parity. Policies Hub, Policy Detail, Open Questions and Handbook share scoped styles and controls. Original policy text, API client and authentication remain unchanged. Twenty-one family browser cases cover four widths, native navigation/dialog/focus, failures and retry, actual editing/failed-save recovery, SAML comment identity, parent choices, moderation confirmation and complete paper. All 101 selected synthetic content blocks print. Full local checks: 5,098 unit tests, 265 mocked browser plus16 remaining browser, all five calculator surfaces; 485 routes unchanged. After actual verified rollout:72 reviewed /153 pending of225 application sources. Deployment and live verification follow.

## Webstore public family plan — 2026-09-08

Worktree codex/webstore-family starts from the reviewed CMS commit 32cd5e640c9a304f1cf4f1f1650efdb7d12553bb; CMS full release gates continue in primary. Live still .18 /68 reviewed until the actual .19 verification. Baseline metadata, policy/offer prose, headings, destinations, images, structured data and CSS graphs for all 12 public webstore marketing pages are saved in webstore-original-baseline.json. No business writes.

- [x] Inventory the twelve consumers of company-webstores.css: company, college, construction, event, fundraising, government, industrial, property-management, restaurant, retail, school-spirit and team. All currently borrow golf-tournament-showcase.css.
- [ ] Give the family its own shared scoped public layout in company-webstores.css, using app tokens/components/Public Sans; remove its borrowed golf stylesheet and duplicated control ownership. Preserve all copy, offer terms, imagery, SEO metadata/structured data and inquiry destinations.
- [ ] Review desktop/tablet/phones, native navigation/FAQ/links, contrast and print; lock original content and register family ownership. These pages have no business-service controller.
- [ ] Pass full release checks and exact-source CI, then verify actual deployment after CMS. Candidate would be 84 of225 reviewed /141 pending. Do not claim live from a local manifest.

## Webstore family reviewed locally — 2026-09-08

All twelve public webstore pages now use one scoped family owner, shared controls and Public Sans. The separate photo/text hero keeps the original shop/product photos visible; public navigation remains reachable on phones. No original wording, marketing price examples, offer terms, links, imagery or SEO metadata/JSON-LD changed; the complete original main text is equality-locked. No business writes or service calls.

All 24 responsive/navigation/print browser cases pass, plus one case checking all twelve live-server route aliases (25 cases total). Four widths have no horizontal overflow or axe violations. Native FAQs work by keyboard, every anchor target receives focus, and printing opens all FAQ answers then restores prior disclosure state. Actual PDFs retain all 773 checked content/pricing/FAQ blocks across12 pages; first/middle/last samples reviewed. Print cards retain images, avoid clipping and keep footer contents together. Three content/ownership suites pass150 tests, with the final full-copy equality check separately passing all12 pages; CSS and controller lint pass.

Raw CSS graph per page:81,097 → 70707 bytes (12.8% smaller), including shared tokens/components. Baseline captures relative CSS paths on the company hub as well as root paths on the spokes. Full primary gates, cache version, exact-source CI and actual deployment remain. Local manifest84 is a candidate count only; live remains68 until CMS(.19) verification, then72 until this family ships.

## Webstore full-gate correction — 2026-09-08

The first primary unit pass stopped on24 existing hygiene assertions across all12 pages: new shared components, family CSS and controller references lacked cache versions. Added explicit candidate .20 query versions. This is a reference-only correction; no policy/product copy or CSS/JS behavior changed. Re-run the full gates before source CI. The previously passed focused rendering and paper evidence still describes the same runtime bytes.

## Webstore release checks complete — 2026-09-09

Twelve public webstore guides integrated. The interrupted browser run was resumed from unchanged f916e43c118906bcf7c66faf899f74a2bea95871; it is not counted as a pass. Completed release checks:212 unit suites/5,122 passed/four existing skips;88 DOM,4 accessibility unit,84 quote parity;290 mocked browser (486.5s),16 remaining browser and three optional screenshot skips;all five live calculator surfaces,build/lint/types/295 CSS/HTTP boot.485 routes/24 modules unchanged. Twenty-five webstore browser cases and773 paper content blocks retained. Candidate v2026.09.08.20 was reserved before midnight; all36 new stylesheet/controller references already carry that version. Exact-source CI and actual deployment still pending. Live count remains72/225,153 pending until verified rollout. Next15 brand guides are under review in the isolated codex/brand-guide-family worktree.

## Webstore release record — v2026.09.08.20

Exact-source CI 34330122846 passed all four jobs on a71e4e24ee620f1c82347ad24d14728b6829d744, including actual money/calculator parity. Twelve public webstore guides now use shared tokens/components, consistent navigation, photo/text heroes, product/price grids and native FAQ printing. All original text, imagery, terms and SEO data preserved. Local checks:5,122 unit tests,290 mocked browser and16 remaining browser,all5 calculator surfaces;773 paper blocks retained.485 routes unchanged. Candidate84 reviewed/141 pending becomes live only after actual rollout verification.

## Brand guides family plan — 2026-09-08

The webstore family plus its cache correction is committed at b417e03de7f9db0aea8bd6f485b2c2c947bd207b; full checks run in primary. Live .19 has72 reviewed pages. New worktree branch codex/brand-guide-family isolates the next15 static brand pages using custom-carhartt.css/js. Original complete main text, metadata/structured data, every image/link/input and CSS graphs are saved in brand-guide-original-baseline.json. No application edits yet.

- [x] Inventory all15 shared consumers: Bella+Canvas, Carhartt, CornerStone, District, Eddie Bauer, Gildan, New Era, Nike, The North Face, OGIO, Port & Company, Port Authority, Richardson, Sport-Tek and TravisMathew.
- [ ] Move shared navigation/footer onto scoped storefront-shell.css plus app tokens/components/Public Sans; rename the old single-brand CSS/JS owners to brand-guide.css/js. Preserve individual brand/product content and static Richardson showcase tiles.
- [ ] Replace custom mobile overlay behavior with a native dialog, focus/escape restoration and search preserving the existing /catalog query semantics. Keep every original menu destination and business term.
- [ ] Lock content/SEO/image/field data, verify four widths/contrast, native dialog keyboard/focus, search and complete printed product/FAQ blocks; then full release checks, exact-source CI and verified deployment after webstores.

If both pending families deploy successfully, this batch would reach99 of225 application pages reviewed,126 pending. Until actual release verification, candidate manifests do not change the live count. No business-service writes.

## Brand guides reviewed locally — 2026-09-09

Fifteen custom-brand pages share tokens/components + storefront-shell.css + renamed brand-guide.css/controller. Original full main text, all anchors/images/SEO JSON-LD and search fields remain exact. Native dialog supports focus wrap/return, Escape, backdrop and desktop resize; search still trims/encodes the catalogue query. Richardson showcase tiles stay static.31 focused browser cases pass at1440/768/390/320 with zero axe violations;168 source/ownership/runtime cases pass after correcting selector scope and rerunning an inventory timeout from competing browser load. Strict JS and focused CSS clean. Duplicate rules merged into owners. PDFs retain1261 checked text/product/FAQ blocks (Carhartt6 pages, others5); case-normalized comparison reflects the existing uppercase eyebrow. Desktop/phone and first/middle/last paper renders reviewed. Raw CSS graph65,000 ->72790 bytes: shared components add coverage; no byte-saving claim. Pending full primary release gates and deployment; not yet live. Candidate2026.09.09.1 references pre-versioned on all15 consumers.

## Brand integration — 2026-09-09

Reviewed brand commit a6d59feca31b1a4419c1f963bb91c063e7d03539 integrated after verified webstore release2079. Only the two append-only memory conflicts required a union; all reviewed app changes merged directly. Current live checkpoint84/141 retained. Full primary gates now run with candidate2026.09.09.1 references already present. Next five staff reference pages remain plan-only in their isolated branch.

## Brand guide release checks complete — 2026-09-09

Fifteen brand guides integrated and tested at2ac3c56bf26bd50fecf4fd28043267b4c0939fb3. Completed release checks:213 unit suites/5152 passed/four existing skips;88 DOM,4 accessibility unit,84 quote parity;321 mocked browser (444.6s),16 remaining browser and three optional screenshot skips;all five calculator surfaces,build/lint/types/296 CSS/HTTP boot.485 routes/24 modules unchanged.31 focused brand browser cases and1261 paper blocks retained. Candidatev2026.09.09.1; all60 new stylesheet/controller references already versioned. Exact-source CI and actual deployment pending. Live84/225;141 pending until verified rollout. Next five staff references are IN PROGRESS in the isolated worktree: first layout, shared print contract and service warning/retry changes implemented; focused content/browser review remains. They are not part of this release.

## Brand guide release record — v2026.09.09.1

Exact-source CI 34332748897 passed all four jobs on 6b197548bbb43ca9ab5a602a7059edb2c260fe98, including actual money/calculator parity. Fifteen brand guides now share storefront navigation, typography, controls and page owners. All original copy, products, images, links and SEO preserved. Native menu supports focus wrap/return, Escape/backdrop/close and resize; original catalogue search retained.31 family browser cases,1261 paper blocks verified. Full local checks:5152 unit tests,321 mocked browser and16 remaining browser,all5 calculators;485 routes unchanged. Candidate99 reviewed/126 pending becomes live only after actual rollout verification.

## Staff references and forms directory plan — 2026-09-09

Next bounded family after brand guides: commission-structure, embroidery-bonus-plan, seo-strategy, forms-library and data-entry-guide (five sources). Base a6d59feca31b1a4419c1f963bb91c063e7d03539; original text/links/images/IDs/fields and dependency graphs saved in staff-reference-original-baseline.json. Existing shared reading/navigation patterns will own headers, readable sections, tables, controls and print; only page-specific arrangements stay local. Preserve published plan/strategy prose and commission examples exactly. Bonus amounts remain API-driven; test actual config, denied/malformed/fallback responses and complete printed warnings. Data-entry service prices keep source warnings visible and get usable retry instead of an ambiguous fallback badge. Forms directory retains live entries and destinations with explicit loading, malformed, empty and failed/retry states. Keep staff gates and service endpoints unchanged.

- [ ] Capture original desktop/phone screenshots with synthetic service responses.
- [ ] Migrate five layouts and needed navigation/print/error controls, retiring borrowed shell dependencies.
- [ ] Lock original prose, fields, API mappings and financial computation; test keyboard, four widths/axe, retry/empty/malformed, and actual PDF content.
- [ ] Register every file immediately, document results, run full primary release gates and exact-source CI, then verify actual rollout.

This is a plan only; no application files in this family changed yet. Brand guides remain reviewed in codex/brand-guide-family at a6d59feca31b1a4419c1f963bb91c063e7d03539; production checks for the prior webstore release are still running.

## Staff reference implementation started — 2026-09-09

Original five-page screenshots captured with synthetic read-only service data. First layout pass now replaces borrowed art-hub/dash-shell CSS with existing shared components. Canonical buttons/headers/cards and scoped page owners use shared semantic tokens; original main text is unchanged. New staff-reference.js handles complete accordion printing/restoration and native fragment focus. Baseline fixture and file inventory registered. This batch is IN PROGRESS and has not passed review or been deployed. Next: fix responsive/print details, explicit service-source warnings and retry, validate config, then add focused content/browser guards.

## Five staff references reviewed — 2026-09-09

Commission structure, embroidery bonus plan, SEO strategy, forms library and data-entry guide now use shared tokens/components plus staff-reference CSS/print controller and scoped page arrangements. Original full main text/links/media/fields/IDs retained. Existing financial prose/examples unchanged; service/bonus figures remain API-driven. Incomplete data is visibly API+fallback; failed/malformed data warns and retries without clearing checklists. Bonus rep labels escaped; form directory handles malformed/empty data, hostile text/category keys and unsafe URLs. Four dashboards retain anonymous302; data-entry guide remains public200, with ordinary-staff admin restrictions intact.21 focused browser cases at four widths with zero axe violations;403 focused source/ownership cases; strict JS/CSS pass. Eight populated/failure PDFs preserve805 checked content/warning blocks, no retry controls on paper. Commission print9 ->5 pages, SEO15 ->11; screen-only breakpoints prevent mobile rules affecting paper. Candidate2026.09.09.2 pre-versioned. Reviewed branch must still integrate and pass full primary gates/exact-source CI/actual rollout. Live is brand release2026.09.09.1/2080:99 reviewed/126 pending. Only a verified staff rollout changes that to104/121.

## Staff reference integration — 2026-09-09

Reviewed staff reference commit 245d00e86e1c07099f5e4bbc4b1ea6999c327b62 integrated after live brand release2080. Only appended memory notes conflicted; retained both release and review records. All application changes merged directly. Full primary gates run next. Live99/126 remains authoritative until actual staff rollout.

## Staff reference full-gate correction — 2026-09-09

The complete unit suite caught a source serialization lock: HTML serialization changed three commission data-args attributes from single-quoted JSON to equivalent HTML entities. Restored the original attribute spelling without changing actions or weakening the guard. Full gates resume from this corrected commit; focused behavior/content still describes identical DOM/runtime semantics.

## Staff reference release checks complete — 2026-09-09

Five staff references integrated and tested at3432538f676b06ce8cc8cd3c6cc10d15eb6ae8f1. Completed:214 unit suites/5162 passed/four existing skips;88 DOM,4 accessibility unit,84 quote parity;342 mocked browser (464.9s),16 remaining browser and3 optional screenshot skips;all5 live calculator surfaces,build/lint/types/297 CSS/HTTP boot.485 routes/24 modules unchanged.21 focused family browser cases and805 checked paper blocks retained. Candidatev2026.09.09.2,24 changed/shared references versioned. Exact-source CI and actual deployment pending. Live remains99/225,126 pending. Next isolated codex/entry-status-family has first-pass six sign-in/confirmation layouts; not reviewed or part of this release.

## Staff reference release record — v2026.09.09.2

Exact-source CI 34341414138 passed all four jobs on0203038d69fd8733d5fd6c5d404cd56f423d92b5, including actual money/calculator parity. Five staff references share components, scoped page arrangements and complete print behavior. Original content, examples and existing access boundaries retained. Service/bonus/form-directory failures are explicit with usable retry.21 focused browser cases,805 paper blocks; full checks5162 unit tests,342 mocked browser,16 remaining browser,all5 calculators;485 routes unchanged. Candidate104 reviewed/121 pending becomes live only after actual rollout verification.

## Entry and order-confirmation family plan — 2026-09-09

Six sources after staff references: staff/customer/vendor sign-in and3-Day Tees/custom-tees/custom-caps confirmation pages. Isolated codex/entry-status-family based on245d00e86e1c07099f5e4bbc4b1ea6999c327b62. Original full text, fields, images, routes, controller hashes and CSS graphs captured. Keep three auth flows and three channel-specific fulfillment/email controllers; replace borrowed storefront styles with a scoped confirmation owner and share sign-in shell/control styling. Preserve every payment-status state and server-stamped amounts/ship promises. Tests must block every actual business write, email and authentication request while exercising synthetic response states. Candidate2026.09.09.3 only after primary full gates, exact-source CI and verified deployment.

- [ ] Capture original desktop/phone and current state contracts.
- [ ] Build shared scoped sign-in and confirmation owners, retaining original prose and function hooks.
- [ ] Verify four widths/axe, keyboard/email validation/rate limits/failure/sent/try-again, confirmation working/done/delayed/error and complete paper.
- [ ] Register files/tests/owners, integrate only reviewed scope, full local checks/CI/actual release.

Current live remains99/225,126 pending atv2026.09.09.1/2080. Five staff references are reviewed and full primary gates running. This next family is planned only.

## Six entry/status pages reviewed — 2026-09-09

Staff/customer/vendor sign-in and3-Day Tees/custom-tees/custom-caps confirmation pages now use shared access/confirmation layouts and scoped page arrangements. Original full main text, images, fields, links and IDs preserved. All three fulfillment/email controllers and helpers unchanged and hash-locked. Magic-link pages retain deep links and identical successful known/unknown-account messaging; server outages now display generic retryable errors preserving email.30 focused browser cases passed in34.3s at1440/768/390/320, zero axe violations;198 focused unit cases passed.17 populated/error/delayed/sent PDFs retain167 checked content blocks, each one sheet including mockup captions and contact/footer text. Candidate2026.09.09.3 pre-versioned; two obsolete success stylesheets retired, caps studio stylesheet remains until its own migration. Full primary gates/CI/deploy pending. Verified live staff releasev2026.09.09.2/2081 is104 reviewed/121 pending; only verified entry rollout becomes110/115.

## Entry/status integration — 2026-09-09

Reviewed entry/status commit 1118d1d4642bf38db59948b3064362280f6df69a integrated after verified staff release2081. Only appended memory notes conflicted; retained both histories and the latest live checkpoint. All app changes merged directly; original commission serialization from the staff full-suite fix is preserved. Full primary gates next. Live104 reviewed/121 pending remains authoritative until actual entry rollout.

## Entry/status release checks complete — 2026-09-09

Six sign-in/confirmation pages integrated and tested atf343ce6fa4d28e047bc78922c2009b3f3099727b. Completed:215 unit suites/5177 passed/four existing skips;88 DOM,4 accessibility unit,84 quote parity;372 mocked browser (491.99999999999994s),16 remaining browser and3 optional screenshot skips;all5 live calculator surfaces,build/lint/types/297 CSS/HTTP boot.485 routes/24 modules unchanged.30 focused family browser cases and167 checked content blocks in17 one-sheet PDFs retained. Candidatev2026.09.09.3,17 changed/shared references versioned. Exact-source CI and actual deployment pending. Live remains104/225,121 pending. Next isolated codex/catalog-discovery covers brand directory/fall catalog and shared navigation; not reviewed or part of this release.

## Entry/status release record — v2026.09.09.3

Exact-source CI 34345813195 passed all four jobs onfba80b9d825a42f2e77cd0d757f9b88aca1396d3, including actual money/calculator parity. Six sign-in/confirmation pages share components and explicit page arrangements. Original content, input/deep-link contracts, fulfillment/email controller bytes, totals and server promises retained. Infrastructure errors display honestly with retry preserving email.30 focused browser cases,167 paper blocks;full checks5177 unit tests,372 mocked browser,16 remaining browser,all5 calculators;485 routes unchanged. One initial local live embroidery fetch failed visibly; unchanged full live-group rerun and CI passed. Candidate110 reviewed/115 pending becomes live only after actual rollout verification.

## Catalog discovery plan — 2026-09-09

Next two surfaces:brands.html andpages/fall-catalog-2026.html. Isolated codex/catalog-discovery based on1118d1d4642bf38db59948b3064362280f6df69a. Capture original content, route/link/field/image contracts and exact curated Fall BRANDS/CATS/ITEMS arrays before changes. Share existing storefront navigation by moving the byte-identical brand-guide controller toshared_components/js/storefront-navigation.js and updating all fifteen existing consumers; preserve their reviewed behavior and retest them. Replace legacy catalogue CSS with canonical controls, shared card layout and scoped responsive/print arrangements. Brand tiles become named native links so missing logos and keyboard input remain usable. Keep API priority ordering, product destinations and server price labels; validate malformed/failed loads with visible retry retaining filters. No pricing computation or business-service writes.

- [ ] Original desktop/phone/API contract capture.
- [ ] Migrate shared navigation, both catalogue owners and necessary accessible/failure states.
- [ ] Preserve curated taxonomy and original page content; four widths/keyboard/filter/failed-image/retry/price-label/print checks.
- [ ] Full primary gates, exact-source CI and verified rollout after the pending entry/status release. Candidate2026.09.09.4; no live-count change yet.

## Catalog discovery implementation in progress — 2026-09-09

Two catalog layouts implemented in codex/catalog-discovery, not reviewed/deployable yet. Shared navigation moved byte-identically and all15 prior brand-guide script references updated. Brand tiles are named native links with visible labels when logos fail; retry retains search. Fall catalog retains all179 original curated styles,21 brand descriptions,10 categories and server-generated price labels; malformed batches visibly warn and retry preserves filters. Removed unused header dropdown placeholders/controllers; the existing native Products/Brands links preserve destinations. Source fixtures and tests registered. Next: four-width/keyboard/price/state/paper review, then primary full gates/CI after entry-status release. Live stillstaff.2/2081:104 reviewed/121 pending; candidate manifests are not a live count.

## Catalog discovery reviewed — 2026-09-09

Brand directory and Fall catalog share canonical controls/cards and storefront navigation, with scoped responsive and paper arrangements. Shared controller moved unchanged; all fifteen existing brand consumers updated and retested. Original page content, product destinations and all 179 curated styles, 21 brand descriptions and 10 categories preserved. Server display-price labels remain authoritative. Named brand links survive missing logos; validated data distinguishes empty/failed/malformed/partial results and retry retains filters. 48 focused browser cases (17 catalog plus 31 prior brands) passed; all 17 catalog cases passed again after containing print images. Four widths, zero axe violations. 229 focused unit checks passed. Seven PDFs retain 292 checked blocks: complete Fall catalog 23 pages, brand views one page, filtered/failure Fall views two pages with contact footer intact. Screen and every paper page visually reviewed. No business writes. Candidate 2026.09.09.4 requires full primary gates, exact-source CI and actual rollout after entry/status release. Live count stays 104/121 until entry release verified; catalog would reach 112/113 after both rollouts.

## Catalog discovery integration — 2026-09-09

Reviewed commit a29c40992536519b55ee313c307d29c263c33d5e integrated after verified entry/status release 2082. Only appended memory notes conflicted; both histories and latest live checkpoint retained. All application changes merged directly; prior commission serialization fix retained. Next full primary release checks. Live 110 reviewed/115 pending stays authoritative until verified catalog rollout.

## Catalog discovery release checks complete — 2026-09-09

Brand directory and Fall catalog tested at 03c7ec49ca597b40ce0346497ec812737954180e. Completed: 216 unit suites/5182 passed/four existing skips; 88 DOM, 4 accessibility unit, 84 quote parity; 389 mocked browser (887.5s), 16 remaining browser and3 optional skips; all5 live calculator surfaces. Build/lint/types/298 CSS/HTTP boot; 485 routes/24 modules unchanged. Shared navigation moved unchanged across17 consumers; all179 curated products,21 brands and10 categories retained. 48 focused browser cases,229 focused units,7 PDFs/292 checked blocks. Candidate v2026.09.09.4, 23 changed references versioned. Exact-source CI and actual deployment pending; live remains110 reviewed/115 pending. Next isolated codex/campaign-storefront contains three golf/safety pages in progress, not part of this release.

## Catalog discovery release record — v2026.09.09.4

Exact-source CI 34349270516 passed all four jobs on 945362553cd95ba5ef781aa4318f4a61a85ff74b, including actual money/calculator parity. Brand directory and Fall catalog share navigation/cards/controls; prior fifteen brand consumers retain byte-identical navigation behavior. All 179 curated styles, 21 brand descriptions, 10 categories and server price labels preserved. Visible malformed/partial/failure/retry states retain filters and named brand links survive absent logos. 48 focused browser cases, 229 focused units, 292 paper blocks; full checks 5182 unit tests,389 mocked browser,16 remaining browser,all5 calculators;485 routes unchanged. Candidate112 reviewed/113 pending becomes live only after rollout verification.

## Campaign storefront plan — 2026-09-09

Next three shared-style consumers: Golf Tournament Apparel, its product detail, and Custom Safety Stripe Apparel. Branch codex/campaign-storefront based on 03c7ec49ca597b40ce0346497ec812737954180e. Original prose, link/image/field/SEO contracts and all four controller/service sources recorded before edits. Consolidate the oversized showcase sheet into a scoped campaign owner built on canonical typography, controls, surfaces and semantic tokens. Keep original photos, page-specific storytelling, published terms, safety copy and quote/pricing/email behavior. Shared public fragment/print/photo-viewer behavior gets keyboard focus and complete paper checks; financial helpers and services remain source locked. Existing Summer 2026 offer deadline is historical business copy, not silently changed as part of CSS work.

- [ ] Capture original desktop/phone and controlled product/pricing/form states.
- [ ] Rebuild shared campaign and product page arrangements, preserve content and financial behavior, register changed owners immediately.
- [ ] Four widths/axe/keyboard/photo viewer/filter/gallery/form failure and success with all real business writes and email blocked; compare complete PDF content.
- [ ] Full primary release checks, exact-source CI and verified deployment after catalog discovery. Candidate 2026.09.09.5; live count remains 110/115 until catalog verification, then112/113. Only verified three-page rollout would become115/110.

## Campaign storefront implementation in progress — 2026-09-09

Original screenshots captured for three golf/safety pages. Shared campaign-storefront.css replaces the oversized golf-tournament-showcase owner; product detail retains a scoped arrangement. Canonical controls and semantic colors applied; original page storytelling/photos/prose retained. New shared controller replaces the old custom photo overlay with a native dialog, fragment focus and reversible full-FAQ printing. Pricing/email/quote code is unchanged apart from class/style attributes; two underlying services byte-locked. Generated inline style declarations extracted into named page classes. Original-content fixture and financial/controller guards registered. Not reviewed/deployable: responsive/contrast/dialog/form/error/full-paper tests and complete primary release gates remain. Candidate .5, separate from catalog .4 release.

## Campaign storefront reviewed — 2026-09-09

Golf landing/product and custom safety apparel share canonical tokens/controls plus scoped campaign arrangements. Original complete prose, images, SEO, field values and product links preserved; existing Summer 2026 deadline/offer terms retained as historical business copy, not renewed by this CSS release. Native photo viewer supports keyboard navigation/Escape/focus return; FAQ printing restores screen state. All nineteen focused browser cases passed; final five layout/failure/paper cases passed again after print refinements; four widths and zero axe violations.203 focused unit checks passed. Five PDFs retain 636 text nodes; safety six pages, product two, failed product one, golf ten and failed golf nine, all pages visually reviewed. Live config GET returned200 and all six groups pass the new shape validation. Underlying price/save services and other financial helpers preserved; only reviewed init/config/delivery functions differ. Receipt now requires storage or delivered sales notification; total failure keeps details and never sends customer confirmation. All test writes/email mocked. CSS ownership/style budgets measured explicitly; raw bytes grow with shared components/scoping and full paper support, no size-reduction claim. Candidate2026.09.09.5; full primary gates/exact-source CI/actual rollout still required. Verified live .4/2083 remains112/113; verified campaign release would115/110.

## Campaign storefront integration — 2026-09-09

Reviewed commit 5a5b096c9c7075de930674010e26d8e39c8eee2b integrated after verified catalog release2083. Only appended memory notes conflicted; both histories and latest live checkpoint retained. All application changes merged directly. Full primary release checks next; current live112/113 until campaign rollout is verified.

## Campaign full-suite inventory timeout resolved — 2026-09-09

First full primary unit run passed216 suites/5191 tests with four skips, but the runtime inventory child process exceeded its unchanged30-second deadline under concurrent tests. Standalone original inventory took18.31s. Reusing one inert DOMParser instead of constructing304 full windows reduced it to13.51s; the entire531123-byte report is identical before/after. No timeout increase or skipped assertion. Existing inventory regression and full primary suite will run again on this source.

## Instant storefront plan — 2026-09-09

Banner and sticker public configurators are the next shared-style family. Isolated codex/instant-storefront based on f5c12668f7bb7e0aa086912ae0ad65539a4f68df. Preserve original prose/SEO/images/fields and all server-authoritative pricing, quote submission, optional artwork and quote-cart behavior. Existing instant-quote.css owns shared configurator geometry; detach its controls/colors from the broad nwca-2026-core sheet and use tokens/components/storefront-shell plus scoped commerce navigation arrangements. Preserve browsing dropdowns/autocomplete and quote badge. Financial controllers/ladders/artwork captured before edits. Candidate2026.09.09.6 after campaign .5; not part of that release.

- [ ] Capture original desktop/phone plus safe synthetic preset/grid states.
- [ ] Migrate shared and banner-specific arrangements, native menu behavior and canonical controls without price calculation changes. Register all changed owners.
- [ ] Four widths/axe/keyboard/native dialogs, preset/custom/finishing/quantity price states, failed loads and submissions with draft retention; all actual uploads/writes/email blocked; compare complete paper.
- [ ] Full primary gates/exact-source CI/actual deployment; verified live remains112/113 until campaign release, then115/110.

## Instant storefront local review complete — 2026-09-09

Candidate v2026.09.09.7.14 focused browser cases passed26.2s (last targeted all50-price/menu checks passed6s);11 original content/controller contracts passed. Four widths/axe, both menu modes, focus/search, all50 sticker prices and seven banner presets, server custom/quantity/finishing totals and recovery, failed/empty/degraded data, invalid form, artwork failure and retained draft retry verified with all writes mocked. Two PDFs retain419 text nodes, all9 paper pages visually reviewed. Three scoped CSS owners lint clean. The saved WIP is now finished and reviewed; full primary release gates, exact-source CI and rollout remain. Live115/110; only verified deployment changes this to117/108. Previous paused/WIP notes are historical.

## Instant storefront release checks complete — v2026.09.09.7

Tested source 7d6cf7bc8124e7d3da8642093c3a9018b98e8897. Build/lint/types,485 routes/24 modules, 218 unit suites/5205 passed/four existing skips,88 DOM,4 accessibility-unit,84 quote parity,422 mocked browser and16 remaining browser cases;3 optional screenshot skips;all5 actual calculator surfaces. 299 CSS lint clean,HTTP boot200,production audit zero.14 focused browser and209 focused unit checks;two PDFs/419 retained text nodes. Only instant branch work and its documented shared asset references ship; saved WIP is now fully reviewed. Candidate v2026.09.09.7; exact-source CI and actual rollout pending. Live115/110 until verification.

## Instant storefront release record — v2026.09.09.7

Exact-source CI 34370064451 passed all four jobs on3462512138c1dc3601d29e335c5ca2c7fa82e032, including actual money/calculator parity and full mocked CSS browser group. Banner/sticker pricing, quote and artwork implementations preserved; shared native menu/disclosure ownership, four widths,14 focused browser cases,all50 sticker prices,seven banner presets,209 focused unit cases and419 checked paper text nodes. Full checks 5205 unit tests,422 mocked browser,16 remaining browser;485 routes unchanged. Candidate117 reviewed/108 pending becomes live only after actual rollout verification.

## Customer and staff intake plan — 2026-09-09

Next isolated branch codex/customer-intake at C:\Users\erik\.codex\visualizations\2026\09\07\01a07d90-9a4c-7e70-9e4e-c196377b7c6b\training-final-worktree, based on 7d6cf7bc8124e7d3da8642093c3a9018b98e8897. Four pages: request-a-quote plus digitizingform, monogramform and purchasingform. Original complete prose, destinations, images, fields, IDs, Jotform embed URLs and seven controller sources recorded in customer-intake-original-baseline.json. Keep customer vs staff navigation meaningful while sharing field/panel/typography owners. Preserve vendor form IDs and native request payload/validation/style lookup/upload/date/prefill behavior. External form contents remain vendor-owned; review loaded, unavailable and keyboard-accessible wrapper states without submitting real forms. No pages count reviewed yet. Instant2 candidate .7 runs full primary gates separately; no intake changes enter that release.

- [ ] Capture original desktop/phone and controlled native-form/embedded states.
- [ ] Replace three repeated embed-page styles with scoped shared arrangements; unify native quote-request fields using canonical tokens/components. Preserve original content, upload/submit helpers and hosted form destinations.
- [ ] Four widths/axe, navigation, prefill/date/style lookup, failed/successful mocked uploads/submissions, vendor embed availability and complete paper content.
- [ ] Register reviewed owners, full local gates/exact-source CI and verified release after instant2.

## Customer intake implementation in progress — 2026-09-09

Original four-page desktop/phone screenshots captured with hosted forms mocked. Public quote form now uses canonical full-width fields and choice controls, fixing its phone project-textarea overflow; three duplicate hosted-form wrappers share one scoped owner with Ruth/Bradley department colors. Existing prose, images, business helper sources and vendor embed destinations retained. Verified direct Jotform destinations respond200; persistent accessible fallback links and paper destinations added. Four old CSS owners retired after final consumers migrated; lifecycle docs updated. Candidate .8, isolated from instant .7. Four-width/state/keyboard/axe/paper verification and full gates remain; no additional pages counted reviewed.

## Customer intake local review complete — 2026-09-09

Customer intake: public request-a-quote and three hosted staff forms use canonical tokens/components/Public Sans with one scoped customer-intake.css owner; public fields retain their own arrangement. Digitizing follows Ruth purple, monogram follows shop-floor blue, purchasing follows Bradley slate. Four old CSS owners retired after their final consumers migrated. Seven existing controller sources remain unchanged; complete original prose/fields/images/vendor URLs locked.14 focused browser cases,11 original-contract checks, four widths/zero axe, navigation, blocked embeds and keyboard fallback, public validation/prefill/calendar/lookup/upload/save failures and retained draft retry checked with all business writes and hosted content mocked. Four one-page reference PDFs retain74 checked text nodes; vendor form contents stay external and are not printed from the wrapper. Raw CSS graph grows with shared primitives/scoping; no network byte-reduction claim. Full release gates remain.

Candidate2026.09.09.8. Isolated codex/customer-intake; instant2 .7 exact-source CI still running separately.121 total pages reviewed locally after this four-page batch; live115 remains until actual deployments are verified (.7 becomes117/108, intake .8 becomes121/104). Complete primary release gates/exact-source CI/actual slug and asset verification still required.

## Vendor portal wrapper plan — 2026-09-09

Next isolated batch: vendor-portals/sanmar-vendor-portal.html, sanmar-invoices.html and sanmar-credits.html. Branch codex/vendor-portals based on d7c91600f85993eb4d0d45471ff0c0fc4356b3b7. Two nearly identical WSU-themed sheets duplicate their navigation/heading/card arrangements. Original complete wrapper prose, links/images and Caspio DataPage embed URLs captured in vendor-portals-original-baseline.json. Use canonical chrome and Bradley purchasing color, preserve exact embedded invoice/credit apps and every financial behavior. Caspio-rendered form/table content remains external; test the boundary with synthetic login/table/empty/failed states and block all real vendor writes. No invoice or credit transactions during review.

- [ ] Capture original desktop/phone and read-only hosted entry availability.
- [ ] Consolidate wrapper CSS, accessible navigation/table scrolling and persistent hosted fallback; register lifecycle.
- [ ] Four widths/axe, keyboard/empty/error boundaries, original embed contracts and complete reference/data-fixture print review.
- [ ] Full primary gates/exact-source CI/actual deployment after intake4 .8. Vendor3 not reviewed or counted yet.

## Vendor portal wrappers implementation in progress — 2026-09-09

Three original desktop/phone views captured with synthetic Caspio reports; both hosted DataPage entry URLs respond200. Canonical navigation, Bradley accent and one scoped arrangement replace duplicated WSU styles. Exact invoice/credit embed URLs unchanged; persistent hosted fallback links, named keyboard-scroll regions and paper destinations added. Vendor-owned controls and data are not rewritten. Four-width/axe, external login/report/empty/error boundary and full synthetic paper review still required. Candidate .9, isolated from intake .8 running primary gates.

## Vendor portal local review complete — 2026-09-09

SanMar vendor portal wrappers: three pages use canonical navigation/typography/Bradley purchasing accents and one scoped sanmar-portal-shared.css owner; the duplicate sanmar-vendor-portal.css is retired. Original invoice/credit Caspio app URLs and wrapper content remain unchanged.12 focused browser cases cover four widths, zero wrapper axe, native focus/keyboard scrolling, mocked login/empty/failure states and complete synthetic report printing; three landscape PDFs retain216 checked nodes. All provider writes blocked. Provider-owned UI styling/data remains explicitly separate; the runtime census now recognizes Jotform alongside Caspio and the external-owner backlog names all six reviewed hosted wrappers. Full release gates remain; no raw-CSS byte reduction claim.

Candidate2026.09.09.9; isolated codex/vendor-portals. Three source contracts passed; broader CSS/runtime guards next.124 total local reviewed pages, but live117/108 remains until intake .8 and then vendor .9 are separately verified. Vendor release would become124/101. Do not merge vendor work into intake .8.

## Hosted staff tools grouped plan — 2026-09-09

Group reviewed vendor3 with the two announcement wrappers on codex/hosted-staff-tools, based on9a3191a65a8f7975ea33a54caed24a95399b045e. Their external Caspio forms/reports share the same page boundary, so consolidate the vendor arrangement into shared_components/css/hosted-workspace.css and use it for all five. This replaces two duplicate announcement sheets and the vendor-local arrangement; canonical tokens/components remain the sole control/navigation owners. Preserve exact provider IDs, all original wrapper prose/links/images and both announcement controller sources. Business data and access rules stay unchanged; all actual hosted submissions blocked in review.

Design: Public Sans, white surfaces on the existing neutral canvas (#ffffff/#f3f4f6), dark ink (#1f2937), strong dividing lines (#d1d5db), semantic Bradley slate on vendor pages and neutral administrative ink on announcements. Left-aligned page heading, clear Create/Manage navigation, one hosted content area with permanent fallback and optional instructions. No repeated decorative cards around instructions. Native skip links, loading text, bounded keyboard-scroll region, and paper destinations. Apply the established application direction rather than adding another palette or control system.

- [ ] Capture original two-page desktop/phone state and exact hosted/controller contracts.
- [ ] Consolidate the five hosted page arrangements; register additions/deletions immediately.
- [ ] Four widths/axe/keyboard/loading/failed/login/form/report/empty states and complete reference paper with provider writes blocked.
- [ ] Update coverage/counts only after review; full primary gates, exact-source CI and verified grouped release after intake .8.

## Hosted workspace implementation in progress — 2026-09-09

Hosted staff tools migration: shared_components/css/hosted-workspace.css now owns five Caspio wrappers (SanMar vendor/invoices/credits and announcement create/manage), using canonical tokens/components. Retired admin/css/announcements-create.css, admin/css/announcements-manage.css and vendor-portals/css/sanmar-portal-shared.css after their final consumers moved. Exact provider URLs and announcement controllers preserved; native skip links, loading labels and permanent hosted fallback added. Five-page review pending.

## Hosted staff tools local browser review — 2026-09-09

Hosted staff tools: five Caspio page wrappers (SanMar vendor/invoices/credits, announcement create/manage) share shared_components/css/hosted-workspace.css with canonical tokens/components. Vendor-local and two announcement sheets retired; the earlier duplicate sanmar-vendor-portal.css is also retired. Bradley purchasing and neutral administrative colors follow the ownership rules. Exact provider IDs and both announcement controller sources retained.20 focused browser cases cover four widths/zero wrapper axe, native skip/navigation/scrolling, loading/failure/fallback and synthetic login/form/report/empty boundaries; five landscape reference PDFs retain258 text nodes, every page visually reviewed. Provider-owned controls and data remain separate unfinished work. Seven original source contracts passed; broader inventory guards and full release gates remain. Raw CSS graph grows with scoped shared primitives; no network-byte reduction claim.

This five-page group supersedes the vendor-only .9 plan.126 pages reviewed locally/99pending, but live remains117/108 until intake .8 rollout (121/104), then this verified group would126/99. Never count branch review as live. Candidate2026.09.09.9; full checks/exact-source CI/rollout required.

## Nine-page release consolidation — 2026-09-09

Intake4 and hosted staff tools5 are reviewed and now integrated on primary develop. Candidate v2026.09.09.10 supersedes unreleased .8/.9 references; no empty intermediate release or live-count change. Shared intake/hosted arrangements retire eight CSS files across nine pages; original nine intake/announcement controllers and all provider IDs remain unchanged. Existing Bradley warning text uses semantic readable ink; fixed browser dates cover fresh/warning/critical queue ages. Public lookup anchoring, persistent banner mocks and explicitly paused confirmation polling fix full-suite findings without changing order handling.24 repeated age/poll cases passed; nine repeated menu/warning cases passed; hosted20 browser/187 unit/five PDFs258nodes, intake14 browser/199unit/four reference PDFs74nodes. Full primary combined gates, exact-source CI and actual rollout now required. Expected456 mocked browser plus16 remaining browser/all5 calculator surfaces. Live still.7/2085,117 reviewed/108pending. Only verified nine-page rollout becomes126/99.

## Administrative ownership correction before release — 2026-09-09

Final design-rule audit caught inherited announcement maroon. DESIGN_COLOUR_CODE reserves that accent for AE chrome; both administrative wrappers now use existing neutral ink tokens, while vendor wrappers retain Bradley slate. Controller/provider contracts remain unchanged. Combined full run was intentionally stopped after deterministic checks passed so the final source can be retested; no completed browser gate claimed.

## Nine-page release checks complete — v2026.09.09.10

Tested source7b8f8f3bd0ca5256f3426cf9f94be51ee61ef8a9. Build/lint/types,485 routes/24modules,221 unit suites/5232 passed/four existing skips,88DOM,4accessibility unit,84quote parity,456mocked browser and16remaining browser/three optional screenshot skips;all five calculator surfaces. 293 CSS lint clean,HTTP boot200,production audit zero. Intake14 and hosted20 focused browser cases;9 reference PDFs retain332checked nodes. Original nine intake/announcement controllers and provider IDs preserved; eight obsolete CSS owners retired. Public lookup anchored; queue age warning uses readable semantic ink; test mocks/date/poll clocks deterministic.24 repeated age/poll and9menu/warning cases passed. Candidatev2026.09.09.10 consolidates unreleased .8/.9. Exact-source CI and actual rollout remain; live117/108 until verified126/99.

## Nine-page release record — v2026.09.09.10

Exact-source CI 34379198691 passed all four jobs on8fffd4a65741675e823d0ba9eacaa9ab29deab70, including actual money/calculator comparisons and full mocked browser checks. Nine intake/hosted staff pages use canonical controls and shared arrangements; eight old sheets retired. Original nine controller sources and provider IDs retained. Public lookup and age-warning contrast corrected; browser fixture boundaries and clocks deterministic. Full suite5232 passed,456mocked browser,16remaining browser and all five calculator surfaces;485routes unchanged. Candidate126reviewed/99pending becomes live only after actual rollout verification. Unreleased .8/.9 plans consolidated here.

## Staff access and portal tools plan — 2026-09-09

Next isolated branch codex/staff-admin-tools based on7b8f8f3bd0ca5256f3426cf9f94be51ee61ef8a9: dashboards/access-admin.html, drive-access.html and portal-directory.html. Source/controller/route/content/field contracts captured before changes. Primary nine-page release .10 runs separately; this plan is not part of that release.

Use Public Sans, canonical fields/buttons/cards and a shared scoped staff tools arrangement. Administrative access/drive pages use neutral ink; retain the portal directory's navy identity with existing tokens rather than AE maroon. White content surfaces, consistent left-aligned headings and clear table/card reading order. Keep drive rights visibly distinct with written Modify/Read only/Full control labels, retired-account warnings, and existing mapped-versus-permitted explanations. Customer portal counts and Preview/Copy Link destinations remain unchanged.

- [ ] Capture synthetic original desktop/phone states; no actual roles, file permissions, customer data or clipboard writes.
- [ ] Migrate page arrangements; preserve source contracts and only adjust UI class hooks/accessibility semantics as needed. Canonical primitives stay in components.css.
- [ ] Test original admin role/page payloads with writes mocked, failure/draft retention and cancelled removal; data stays behind the existing server gates. Drive mapping remains read-only with per-person rights and both views preserved.
- [ ] Verify portal grouping/counts/sort/search, missing IDs, failed feeds, clipboard failure fallback and staff-preview/customer-link distinction; retain date behavior.
- [ ] Four widths/axe/keyboard and complete reference/data-fixture paper; register reviewed owners and retire obsolete CSS only after final consumers move.
- [ ] Full local checks, exact-source CI and verified deployment after .10. No staff-tools pages count as reviewed yet.

## Staff access/portal implementation in progress — 2026-09-09

Staff access/portal migration in progress: shared_components/css/staff-admin-tools.css replaces dashboards/css/access-admin.css, drive-access.css and portal-directory.css after their final consumers move. Canonical buttons/fields/cards/tables, named keyboard table scrolling and skip links. Three controllers differ only through explicitly recorded presentation-class and heading/pressed-state replacements; permission payloads, drive rights and portal links unchanged. Full state/content/paper review pending; no added reviewed pages.

### Staff tools review in progress — 2026-09-09

Three layouts implemented in isolated codex/staff-admin-tools.15 focused browser cases passed after labeling the empty drive summary as a group. Permission writes/removal confirmations and drive rights/portal destinations mocked and retained. Paper review found clipped native table values/placeholder ambiguity and excessive drive whitespace; current-value print mirrors and scoped compact print arrangements under review. No new pages counted reviewed/live yet. Source hash guards reverse only explicit presentation changes.

## Staff tools local review complete — 2026-09-09

Staff access and portal tools: dashboards/access-admin.html, dashboards/drive-access.html and dashboards/portal-directory.html share canonical tokens/components and shared_components/css/staff-admin-tools.css. Their three obsolete local CSS owners are retired. Neutral admin/drive and CRM ink preserved.15 focused browser cases cover four widths/zero axe, keyboard views, mocked permissions/save failure/retry/removal confirmation, separate drive rights, denied/malformed data, portal counts/search/sort/clipboard fallback and distinct staff-preview/customer URLs. Three reference PDFs/four pages preserve65 checked text/value nodes, including long wrapping permissions; all visually reviewed. Current-value print mirrors are removed after printing and never change editable data. Original controller hashes restored by reversing only explicit presentation mappings.29 source/hygiene unit checks and290-file CSS lint pass. No actual permission or clipboard writes, business actions or messages. Shared raw CSS graph grows; no byte-reduction claim.

129 pages reviewed locally/96 pending; production count remains tied to the actual verified release. Nine-page .10 release in primary is separate. This isolated candidate .11 still requires broader guards, full checks, exact-source CI and rollout.

## Staff release verification follow-up — 2026-09-09

Integrated source d4a0b187 passed 222 unit suites/5241 tests,88DOM,4accessibility unit,84quote parity,291CSS checks,boot/audit and all471 mocked browser cases. The remaining browser run passed15 but failed the DTG service-outage warning contrast. Its CSS now uses readable semantic warning/success colors; the unchanged test also renders all four actual toast states deterministically. Three repeated DTG checks passed. Final deterministic checks and the full remaining browser suite are being rerun; exact-source CI will repeat the entire mocked suite before release. No pricing or business-controller change. Live remains v2026.09.09.10,126reviewed/99pending.

The isolated worktree now holds codex/staff-monitoring-tools (API Usage,Table Usage Audit,Bandit Integration), with17 focused browser cases passing after response/storage/retry validation. Its final paper review and source registration remain. Staff access/portal work is already integrated here, pending release.

### DTG money-path test synchronization — 2026-09-09

The final remaining-browser rerun passed15 cases but the DTG positive money path failed with0pieces; trace showed product-bundle and service-codes200 and no pricing request. Size hydration could replace the field between Playwright focus and insertion. The test now uses the existing atomic value+input/change helper, then asserts24 in the actual row footer. The successful-save and unavailable/pending-pricing guards each passed three repetitions (6cases), with save writes still mocked. No production controller, price, timeout, assertion threshold or retry setting changed. Final full remaining browser verification continues; do not claim full gates until its summary passes.

## Staff tools release checks complete — v2026.09.09.11

Tested source 0b9d08a23687f70c2445dc77fdde71e4185fc8aa: build/lint/types,485routes/24modules,222suites/5241passed/four existing skips;88DOM,4accessibility unit,84quote parity,471mocked browser and16remaining browser/three optional screenshot skips;all five calculators. 291CSS lint clean,boot200,production audit zero.15 focused staff browser cases and226source/inventory cases;three reference PDFs/four pages/65checked nodes. Original content/fields preserved; controllers reverse only recorded presentation/print changes. Three obsolete local sheets retired. Real permissions, data writes and notifications untouched. DTG warning/success notification colors also use readable existing tokens; all four real toast states are now checked deterministically, with three repeated checks passing. The471 mocked cases passed on d4a0b187ade98f936df5e619b90d6d6767e7cbad; the isolated DTG follow-up changed no page or asset loaded by those cases. Both DTG money paths also passed three repetitions after atomic quantity entry, with the real row footer asserted and all writes mocked. Deterministic and the full remaining browser suites were rerun on current source; exact-source CI repeats all471 before release. Source CI and rollout remain; live126/99 until verified129/96.

### CI package-index recovery before .11 — 2026-09-09

Exact-source run34385622118 on481232711e07332613f8a0fd7e5123096426878b passed the three deterministic jobs. Browser setup failed twice before any browser test: Google Chrome apt index SHA256 mismatch (same received/expected mismatch on the retry). CI already selects Playwright bundled Chromium, so its unrelated Google Chrome vendor apt source is now disabled only on the disposable runner, preserving Ubuntu repositories and package integrity checks. Both known .list/.sources paths are checked for the actual Google Chrome URL before being moved to a disabled suffix. All existing browser installation, timeout and test steps remain. This CI-only follow-up requires a new exact-source all-job run; the final local app checks remain tied to0b9d08a23687f70c2445dc77fdde71e4185fc8aa. Never describe skipped browser steps as passed.

### Payment-status test clock recovery before .11 — 2026-09-09

Run34386325023 on0e7acabec720031597b669daff55b513f54ac77f passed all three deterministic jobs, browser installation and rendered axe;470 mocked cases passed, one existing custom-tees delayed-webhook case failed twice. Its test advanced a paused clock when a request arrived, before the asynchronous response registered the next timer. The test now observes the actual unchanged poll timer registration before advancing exactly3000ms, deliberately delays the11th synthetic response and verifies polling stops at25 reads. All three success pages and transient recovery passed18 repeated local cases. No fulfillment, payment, email or production controller changes. This test-only follow-up requires a new complete exact-source CI run; money/calculator steps on the failed prior run were skipped, not passed.

## Staff tools release record — v2026.09.09.11

Exact-source CI 34388214812 passed all four jobs on5215f8214f28c15805a552d12628ab09e51ce0cf, including actual money/calculator and471mocked browser comparisons. Access Admin,Drive Access and Customer Portals share canonical styles. Permissions, readonly drive data and original portal destinations remain; current table values print completely. DTG warning/success colors are readable, with every toast type exercised in accessibility checks. Full local suite5241passed,16remaining browser/all five calculators;485routes unchanged. Count becomes129reviewed/96pending only after actual rollout verification.

## Next isolated batch — staff monitoring and audit tools, 2026-09-09

Branch codex/staff-monitoring-tools starts at d4a0b187ade98f936df5e619b90d6d6767e7cbad. Primary .11 (staff access/drive/portal) full checks continue separately. Scope: dashboards/api-usage.html,table-usage-audit.html,bandit-integration.html. Original prose/IDs/links/media/style graphs/controllers captured in staff-monitoring-original-baseline.json.

- [ ] Shared neutral staff shell and canonical controls/tables; preserve department ownership.
- [ ] Retain API attribution versus billing caveats, exact counts/rates/source reliability and history warnings. No invented fresh data.
- [ ] Preserve all163 original audit records, local decisions/notes/review storage, sort/filter/export and mocked live snapshot refresh; never archive or delete real tables.
- [ ] Preserve all Bandit task/command/endpoint references; keyboard scrolling and complete print with long tables/code.
- [ ] Review four widths/axe/keyboard, denied/failed/malformed/retry/storage/export cases with all business traffic mocked; source/ownership/full release checks and actual live verification.

Still126pages live/99pending after verified .10;129reviewed locally/96pending with .11. These three monitoring pages are only planned, not reviewed. Candidate .12. Keep source controllers exact except explicit presentation and demonstrated error-state fixes, which require their own tests.

### Staff monitoring layout implementation started

Staff monitoring migration in progress: new shared_components/css/staff-monitoring.css owns layouts for dashboards/api-usage.html,table-usage-audit.html,bandit-integration.html. Their three dashboards/css sheets retired. Shared tokens/components replace art-hub/dash-shell dependencies. Original data/controllers retained pending specific review refinements; no live completion claimed.

Native table sorting, storage/failure states, print values and focused review remain.

### Staff monitoring validation and keyboard refinements

Current isolated source keeps163 snapshot rows and original operations, adds native sorting/pressed-state/print hooks, rejects malformed usage and incomplete live-schema responses before altering evidence, and surfaces local review storage failures. Shared styles now retain labels/caveats at narrow widths. Browser and source review still pending; no new live count. Initial migration helper failed on one exact marker after an owned partial edit; restored only that owned controller from its captured baseline, made the helper transactional, then successfully applied all20 recorded changes.

## Staff monitoring local review complete — 2026-09-09

Staff monitoring: API Usage,Table Usage Audit and Bandit Integration share tokens/components/Public Sans and shared_components/css/staff-monitoring.css. Their three local sheets are retired. Native keyboard sorting/filtering, named scrolling tables and current-value print mirrors preserve the original163-table evidence and full reference prose. Usage failures stay unknown; malformed/incomplete live schema cannot label tables gone. Local storage failures stay visible with export available, and successful recovery clears the related error.17 mocked browser cases cover all four widths/zero axe, numeric/source states, retry, saved notes and CSV export. Three reference PDFs/nine pages retain213 checked text/value nodes, all visually inspected. Print uses normal block flow so a flex fragment cannot produce a blank trailing sheet; focus outlines remain screen-only. All real business writes and notifications blocked. Measured LF raw CSS per page is70,169bytes, down from162,994–164,472bytes (about57%); these are source bytes, not compressed network transfer.

132 pages reviewed locally/93pending, including the separate staff-admin candidate. Production remains126/99 until verified releases. Candidate .12 requires broader guards, full integration checks, exact-source CI and rollout after .11. Original controllers reverse only the23 recorded presentation/validation/recovery edits; financial calculations and snapshot data retained.

## Next paired staff import tools — 2026-09-09

Branch codex/staff-import-tools starts at71f8d6c466cc523a798d33f5572ba3a61114a5dc (the reviewed monitoring batch). Scope: SanMar Downloads and the browser-only SanMar→ShopWorks converter. Purchasing Portal was inspected but is deferred to its purchasing/invoice-viewer family. Candidate .12 may combine these two tools with the three monitoring pages after review; no additional pages count yet. Primary .11 exact-source CI34385622118 is running on481232711e07332613f8a0fd7e5123096426878b.

- [ ] Preserve all original prose/links/scripts and pure conversion/SKU sources, including prices, size flags and part-number rules.
- [ ] Shared canonical neutral admin controls and scoped tool arrangements, phone layouts, skip/named keyboard table regions and native file input.
- [ ] Download listing must distinguish unavailable/configuration/session/malformed/empty states; mock all requests and downloads, never import files into live systems.
- [ ] Exercise synthetic CSV/TSV/Excel file selection, conversion/reset/download and unavailable dependencies; preserve source transform tests and compare output bytes.
- [ ] Four widths/axe/keyboard and complete reference/preview paper. Register reviewed styles and retire only the two superseded owners, then integrate/full checks/CI/release.

Monitoring is reviewed locally (132of225/93pending); current live count remains126/99 until .11 verification. Saved originals: staff-import-original-baseline.json.

### Staff import arrangement implementation

Staff import tools in progress: dashboards/sanmar-ftp-integration.html and dashboards/sanmar-shopworks-converter.html use shared_components/css/staff-import-tools.css with tokens/components. Their two dashboards/css/*.css owners are retired after their final consumers moved. Pure conversion/SKU helpers and converter controller retained; FTP changes are explicitly recorded presentation/loading/response-validation hooks. Browser/source review pending; no new reviewed/live count.

Original synthetic desktop/phone screenshots captured before migration. The initial multi-file CSS patch rejected a mismatched documentation heading atomically; no partial file was created. Current shared stylesheet and page/controller migration still require verification. .11 revised-source CI34386325023 on0e7acabec720031597b669daff55b513f54ac77f has passed setup/axe and is running full mocked browser checks after the Google apt-index recovery.

### Staff import review findings

Initial browser review passed13 cases and found the missing transform library left conversion stuck; converter now checks required format dependencies and shows a visible error with the chosen file retained. Pure conversion/pricing rules unchanged. Native attachment tests now use a local HTTP server serving only synthetic CSV; intercepted browser download responses were canceled by Chrome. Two additional missing-parser cases added. Source/paper/full focused checks pending. A second combined patch rejected an unverified documentation heading atomically; corrected by reading the exact heading before editing. No partial test file existed.

## Staff import local review complete — 2026-09-09

Staff file tools: SanMar Downloads and SanMar → ShopWorks Parts share tokens/components/Public Sans and shared_components/css/staff-import-tools.css; two local sheets retired. Canonical buttons/data tables, native named file input, skip links and focused scrolling regions retain all original prose/IDs/dependencies and source-locked financial/SKU transforms. Malformed FTP listings and missing converter libraries report visible failures with retry/file retention.17 mocked browser cases cover four widths/zero axe, exact synthetic FTP download query/bytes, CSV/TSV/XLSX conversion, errors and recovery. Two one-page portrait PDFs retain70 checked content/data blocks, visually reviewed; print hides only action controls and their empty download column. All real business writes/imports/uploads/emails blocked. A tiny temporary loopback server serves only synthetic CSV because browser-managed attachments bypass page routing; request assertions observe that server and compare actual downloaded bytes.

134 of225 application pages reviewed locally/91pending, including staff admin3 and monitoring3; production still126/99 until .11 rollout. Source guard45passed; broader inventory/gates follow. The .12 candidate can combine monitoring3 and import2 after .11. Shared financial transform and SKU validation remain byte-locked; nine controller edit mappings are precise reversible presentation/loading/validation/error changes.

Staff import final local guards:235passed across six source/inventory suites,287CSS files clean. Shared CSS graph64,626LF bytes per page versus163,985/162,764before (about60% smaller). Final print-only compacting retained all70 reading/data blocks on two complete one-page PDFs; keyboard/four-width/axe review reran after the print refinement. No financial transform change.

## Staff operations integration — 2026-09-09

Merged the two reviewed branches after verified .11 rollout (Heroku2087). Conflict resolution preserved the live checkpoint and both branches’ appended evidence/lessons. Archived the resolved junction-recovery narrative while retaining its active prevention rule. Five-page candidate .12 now enters full checks; .13 purchasing plan remains isolated.

## Five staff operations pages ready for CI — v2026.09.09.12

Tested source 82b954c487c7c1ea84454768cc85ea493102d295: build, lint, types, 485 routes/24 modules, 224 unit suites/5258 passed/four existing skips; 88 DOM, four accessibility unit, 84 quote parity, 505 mocked browser and 16 remaining browser/three optional screenshot skips. All five calculator surfaces passed. 288 CSS files clean, HTTP boot200 and production audit zero. The monitoring and import pages passed 34 focused browser cases and five print documents/11 pages/283 checked content blocks. Original static references, schema snapshot and monetary/SKU transforms are guarded; five obsolete CSS owners retired. Both shared owners and all changed controllers use 2026.09.09.12. Live remains129 reviewed/96pending until exact-source CI and actual rollout verify134/91. Purchasing work remains isolated and is not in this release.

## Staff operations release record — v2026.09.09.12

Exact-source CI 34391912020 passed all four jobs on 5b2cfbbc6b716d49186ac0a53a2ad1f8c3c2235d, including actual money/calculator checks and505 mocked browser comparisons. API Usage, Table Usage Audit, Bandit Integration, SanMar Downloads and the ShopWorks Parts converter share two canonical owners. Permissions, download formats, conversion values and local notes remain. Five old sheets retired; five reference PDFs/11pages/283content blocks reviewed. Full local suite5258passed,16 remaining browser/all five calculators;485routes unchanged. Count becomes134reviewed/91pending only after actual rollout verification.

## Next purchasing workspace review — 2026-09-09

Branch codex/purchasing-workspaces starts atd524d2e51de086c1af8461392bd0fae6a0fc91c7. The saved codex/staff-import-tools branch is complete for candidate .12 (monitoring3 plus import2); do not include this new plan in .12. Primary .11 exact-source CI34388214812 runs on5215f8214f28c15805a552d12628ab09e51ce0cf. Production still.10/2086/126reviewed;134reviewed locally/91pending. Current plan adds no reviewed pages.

- [ ] Preserve original purchasing feed counts/status/turnaround, filters, open-work default and exact Jotform destinations. Keep Bradley slate; payables retains its existing NW-green ownership rather than adopting an unapproved new department color.
- [ ] Preserve payables/credits, local dates, imported/paid/unknown distinctions, vendor1002/2425 export data, marketing fund figures, and all existing financial parsing/matching helpers. No actual marking, upload, import or email.
- [ ] Use canonical controls/tables and scoped purchasing arrangements, accessible native file input, keyboard tiles/tabs, visible failure/retry/partial-feed states and all four widths.
- [ ] Review shared invoice viewer at screen and paper sizes, loading/empty/partial/error/retry, keyboard modal boundary and returned focus. Preserve all invoice rows/totals/server fields. The viewer also belongs to AE Mission Control plus three UI harnesses: its legacy CSS stays until those owners migrate; any shared controller edit must retain that behavior and one version across consumers.
- [ ] Source-lock original prose/IDs/links/scripts and five controller/helper sources; record only explicit presentation/recovery edits. Existing purchasing/payables unit guards remain meaningful, updated only for real owner/native-control changes.
- [ ] Complete mocked business-state/browser and PDF review before adding these two pages to the manifest. Then full integration gates/exact-source CI and rollout after .12.

Only inspection and this plan have been completed. Saved originals: purchasing-original-baseline.json. Legacy fixture stubs were read for schemas; new browser checks must block every unmocked business request, including their realFetch fallback.

Purchasing workspace implementation started: shared arrangement owner, canonical static controls/tables, native file input, named keyboard scroll regions and four migrated production/harness entry points. Two old page owners retired; shared invoice CSS/controller still legacy and pending. Current pages are intentionally unreviewed; no business controller changes yet. Primary .12 full gates run independently on82b954c487c7c1ea84454768cc85ea493102d295; .11 is verified live at84bd143a/Heroku2087 (129of225).

Purchasing invoice implementation: native opt-in dialog/canonical dynamic controls and invoice tables, keyboard boundary/focus return, stale-open response cancellation, validated invoice-array response and complete partial-result print notes. AE retains its legacy presentation at the same controller version; its compatibility checks remain required. All 19 explicit controller edits are recorded in purchasing-controller-changes.json. Original invoiceHtml/money/CSV functions remain unchanged. No completed review credit yet.

Purchasing verification fixes in progress: malformed feeds cannot become zero balances; import-log failure stays unknown and disables export/stamping until a valid status source arrives; delayed earlier date queries cannot replace a new range; marketing refresh clears stale values and export. Mark button restores selection-aware state after completion. All explicit edits recorded for reverse-source guards; original money/CSV calculations unchanged. Browser/source tests remain pending.

## Purchasing local review complete — 2026-09-09

Purchasing Portal and SanMar Payables reviewed: shared purchasing-workspaces.css and opt-in vendor-invoice.css use canonical tokens, controls, data tables, named file input and native invoice dialog. Bradley slate and existing payables ownership retained. Two old page sheets retired across production/harness HTML; AE keeps its legacy invoice CSS with the same updated controller version.24 mocked browser cases cover four widths/zero axe, keyboard/focus, source filters, exact CSV values, mock-only import confirmation/cancellation/failure, visible unknown balances and optional feed recovery, concurrent lookup protection and legacy AE compatibility. Four one-page PDFs preserve176 checked reading/data/current-field blocks; invoice columns, totals and failed PO notes verified together. Original five controller/helper hashes reverse through50 documented UI/load-validation edits; money/CSV calculations unchanged. The AE page and other generated-document families receive no review credit.

136 of225 application pages reviewed locally/89pending. Production remains129/96 pending the five-page .12 release, whose exact-source CI is running. This separate two-page .13 candidate still needs inventory/full integration gates, exact-source CI and actual rollout. The optional-feed helper stopped after writing controllers and production markup because the harness status has different attributes; finish-purchasing-feed-registration.cjs completed its one remaining marker and recorded all50 reverse-checked edits. Do not rerun either helper.

Purchasing final local evidence:217passed across six content/controller/inventory suites;24focused browser cases, followed by4 final layout/current-value/complete-invoice paper cases after the print selector adopted class ownership.287CSS clean. Four one-page PDFs/176checked blocks including current fields and all seven invoice columns. Shared graph73178LFbytes per page versus170,371/172,534before. The malformed mock invoice envelope and date-window expectation were corrected in tests; tablet money and print column scope were fixed in app styles. Live .12 is now verified at Heroku2088/b2bec6591225fb161b0d37a4a85911d5c8b00865 (134live/91pending). This isolated .13 batch remains pending full integration/CI/deploy;136locally/89pending.

## Purchasing integration — 2026-09-09

Merged reviewed source after verified .12 rollout. Conflict resolution preserved the live checkpoint, all append-only purchasing evidence, existing import ownership and new reviewed purchasing owners. The review commit helper stopped on an extra EOF blank line in its new source test; finalization removed only that blank line and completed source971f673521d606cf592dfca1a7d4df626a96a229. Do not rerun either commit helper. Full integrated verification follows.

Full purchasing integration initially passed224unit suites and failed one older office-operations source guard that still required the deleted viewer stylesheet, bare button classes and a September5 cache version. Updated that existing guard to canonical controls and an actual shared CSS/viewer/page version match; all five office-operations checks passed. Full integrated gates restart on the resulting source; the initial failed unit log is retained.

## Purchasing release checks complete — v2026.09.09.13

Tested source 5664f53f64a01cec66cb23c9390243e78b9dd018: build/lint/types,485routes/24modules,225unit suites/5267passed/four existing skips,88DOM,four accessibility unit,84quote parity,529mocked browser,16remaining browser/three optional screenshots skipped, all five calculators. 288CSS clean,boot200,production audit zero.24focused purchasing browser cases and four complete one-page PDFs/176checked blocks. Preserve exact money/CSV values and legacy AE viewer, native dialog/file controls, unknown balances and protected import/export state. Two old page sheets retired; both shared owners and all six viewer consumers use2026.09.09.13. Live remains134/91 until verified136/89 after exact-source CI and actual rollout.

## Purchasing release record — v2026.09.09.13

Exact-source CI 34396445336 passed all four jobs on 12b924f395e36f843a2c50667d06c181982fe5bc, including actual money/calculator parity and529mocked browser cases. Purchasing Portal and SanMar Payables share canonical controls/tables and a native opt-in invoice dialog. Complete source and visible failure states, exact CSV values and legacy AE compatibility verified. Four one-page PDFs/176checked blocks retain current fields, all invoice columns/totals and failed-lookup notices.485routes unchanged. Count becomes136reviewed/89pending only after actual rollout verification.

## Next asset library family — 2026-09-09

Isolated codex/asset-libraries starts at5664f53f64a01cec66cb23c9390243e78b9dd018, the integrated purchasing source currently running full gates. Live .12/Heroku2088/b2bec6591225fb161b0d37a4a85911d5c8b00865 has134reviewed/91pending. Purchasing .13 adds2reviewed locally (136/89), with full checks, exact-source CI and rollout still pending. This four-page plan adds no review credit and is excluded from .13. Original HTML/prose/IDs/links/dependencies/eight controller-helper sources captured in asset-library-original-baseline.json.

- [ ] Review Finished Photos capture and library as a coherent photo workflow, preserving deep photo green (not shop-floor blue or Steve green), native upload/camera/barcode fallback, order/design selection, customer visibility, local image preview, gallery filters and lightbox. No actual camera session, upload, record changes, share or notification: synthetic media/services only.
- [ ] Review Digitized Design Master List and Old Designs Archive shells with their original Caspio IDs and pricing/image/share controls. Keep person/department ownership from DESIGN_COLOUR_CODE and actual launcher labels; archive stays amber. Provider interior remains explicitly unreviewed. Preserve additional-logo/Full Back amounts and calculation helpers exactly.
- [ ] Replace each confirmed obsolete CSS owner across all consumers, using canonical controls/tables/dialogs and a small shared arrangement layer; keep meaningful distinct palettes. All new files enter ACTIVE_FILES immediately.
- [ ] Four-width/keyboard/axe review, native image controls, complete visible failure/empty/loading/retry states, blocked/malformed embeds, synthetic images/clipboard/downloads and no unexpected business requests. Preserve source text, embed IDs, invoice/art data and financial helpers through explicit reversible edits.
- [ ] Inspect all reference paper states, including current order/design/photo details and provider-wrapper limits; register only actually reviewed application pages. Then full integration gates, exact-source CI and rollout after .13.

Only source inspection and this plan are complete. Next step: collect original synthetic browser states, then implement shared arrangements. Saved purchasing branch971f673521d606cf592dfca1a7d4df626a96a229 remains unchanged. Never recursively delete through the node_modules junction.

Photo implementation in progress: capture/library and their library harness now load tokens/components/photo-workspaces.css with Public Sans, canonical controls, visible native camera/album inputs and shared UiDialog focus/inert/scroll handling. Original photo upload, compression, customer visibility and API helpers remain unchanged outside documented presentation/dialog edits. Retired dashboards/css/finished-photos.css and dashboards/css/finished-photos-library.css after all three consumers moved; former poster references were already retired. Digitized/old-design pages remain at originals. New family review still pending; no extra reviewed/live credit.

Photo family review now covers capture/library first; both Caspio design pages remain original and receive no credit until their provider-boundary review. Added tests/e2e/css-unification-photos.spec.js, tests/unit/photo-content.test.js and tests/fixtures/photo-original-content.json alongside asset-library-review-data.json. Checks cover responsive/keyboard/dialogs, stale or malformed reads, explicit publication status, synthetic image upload and preserved compression/API helpers. A failed manage action now has its own always-visible status in the manage section. Nothing has been published by these fixture reviews.

## Photo local review — 2026-09-09

Reviewed photo family: shared_components/css/photo-workspaces.css owns capture/library arrangements across dashboards/finished-photos.html, dashboards/finished-photos-library.html and tests/ui/test-finished-photos-library.html. Two old photo sheets retired.22 mocked browser checks cover four widths/zero axe, native camera/album fields, exact synthetic JPEG resizing/upload metadata, customer/rep filters, errors remaining visible through filtering, publish/delete confirmation failures and delayed customer/image responses.28 printed content blocks retained across three pages/two PDFs.46 explicit controller edits reverse to eight original controller/helper hashes; image compression, URL resolution and API payload structure preserved. The library graph falls from164,116 to68587LFbytes; capture grows from34,293 to the same shared graph because it now loads canonical components. This is a maintenance/consistency gain on capture, not a per-page byte reduction. Caspio design pages remain original and unreviewed.

138of225 reviewed locally/87pending; live remains136/89 on verified .13/2089/c461a4967f4c36a5983e5df106266273b500cd6b. Complete final source/CSS guards, integration/full gates, exact-source CI and actual .14 rollout before increasing live count. First browser invocation omitted repository config and could not launch bundled Chromium; corrected config uses installed Chrome. Source identity guard now checks stable IDs as a set because native file fields moved beside their labels. Broken-image fixture originally sent a valid SVG with HTTP503 (browsers may still decode it); it now sends invalid image bytes. Preview failure state covers either load order. Paper checks retain visible text, ignoring decorative circle glyphs and excluding CSS-hidden action text. All prior one-shot helpers are complete; do not rerun them.

Photo final checks:22mocked browser cases and478checks across eight source/CSS/compatibility suites passed; two PDFs/three pages/28visible blocks verified. The legacy photo guard now checks native file labels/inputs and dialog semantics, retaining all prior failure/keyboard checks. Isolated stylelint286clean including photo-workspaces.css; primary has one extra ignored preexisting dashboards/css/staff-portal-final.css, so its full lint total will be287 after integration. That unrelated ignored sheet is not staged, modified or shipped. Source review is ready for full integrated gates; live remains .13/2089,136reviewed/89pending.

## Photo integration — 2026-09-09

Preserved the .13 live checkpoint and all append-only photo evidence. The initial review commit helper stopped while restaging two already-indexed deletions; finish-photo-reviewed.cjs staged only existing owned files and committed the saved source, preserving both indexed deletions. Do not rerun either review helper. Full integrated checks follow.

## Photo release checks complete — v2026.09.09.14

Tested source 694e88c7e04f18797427d8f4d81207ddf9c679e2: build/lint/types,485routes/24modules,226unit suites/5279passed/four existing skips,88DOM,four accessibility unit,84quote parity,551mocked browser,16remaining browser/three optional screenshot skips,all five calculators. 287CSS clean,boot200,production audit zero.22focused photo cases; two PDFs/three pages/28visible blocks. One shared owner and both controllers versioned2026.09.09.14 across capture/library/harness. Canonical native controls, preserved compression/payload helpers, unknown photo counts and visible publication errors; old requests cannot replace current customers/previews. Two old sheets retired. Live remains136/89 until verified138/87 after exact-source CI and rollout.

## Photo release record — v2026.09.09.14

Exact-source CI 34400870432 passed all four jobs on 30b900e8159597072738cf3fb2f373d30106b656, including actual money/calculator parity and551mocked browser checks. Photo capture/library share controls and dialogs with native camera/album inputs.22focused interaction cases and two PDFs/three pages/28visible blocks; exact image compression/upload metadata and malformed/failed/late photo states checked using synthetic data only.485routes unchanged. Count becomes138reviewed/87pending only after verified rollout.

## Design libraries plan — 2026-09-09

Next isolated candidate .15: dashboards/digitized-designs.html and dashboards/old-designs.html, with their existing controllers and Caspio presentation adapters. Base 694e88c7e04f18797427d8f4d81207ddf9c679e2. Preserve every embed URL, field, additional-logo/full-back price computation, image action and keyboard control. Neutral reference ownership for digitized designs; amber archive ownership; Public Sans and existing canonical fields/buttons/dialogs. First read the actual provider rendering and inventory inline styles; then choose the smallest safe adapter, unify local shell/cards/dialogs, and review synthetic filters, load failure, images, price tables, copy failures, four widths and print. Provider internals must stay separately identified. Photo .14 full integrated gates are running on primary; live .13/2089 remains136reviewed/89pending. No new design review credit.

Draft design family: shared_components/css/design-libraries.css owns local design/archive shells, record cards and dialogs; shared_components/js/design-library-ui.js decorates existing provider fields without changing data or submit handlers. Provider integration and browser review pending; no new review credit.

Design implementation draft: both design HTML consumers now load design-libraries.css and design-library-ui.js with canonical local controls and UiDialog. Retired dashboards/css/digitized-designs.css and shared_components/css/old-designs.css after their consumers moved. Existing neutral reference and amber archive identities, Caspio URLs, field identities and price calculations retained; incomplete prices have a visible reference warning and clipboard failures stay visible. Provider-specific layout/overrides still require actual rendering review before this candidate is considered complete.

Draft shared_components/css/design-library-provider.css isolates required Caspio overrides: actual generated unlayered selectors hide the digitized nested search fields at phone widths (also reproduced in the original page) and override canonical field layout/type. Local design-libraries.css remains free of important declarations. Each provider override needs a bounded manifest entry and actual four-width verification before review credit; adapter implementation is still in progress.

Design libraries: actual read-only Caspio searches verified 24 provider records per page and exposed a nested source dl plus generated mobile hiding rules. Shared adapter currently inventories 77 exact important declarations (275 in the two retired sheets); ordinary local app owner uses zero. Existing four art-detail exceptions stay exact. Tests use synthetic nested markup and provider-like unlayered styles. Complete visual/print and full release gates before review/live credit. Both new graphs 73748LFbytes: original digitized34,811/archive61,697; maintenance consistency grows these payloads and is not claimed as a per-page byte reduction.

## Design-library local review — 2026-09-09

Reviewed design libraries: dashboards/digitized-designs.html and dashboards/old-designs.html load tokens/components/design-libraries.css plus the explicitly inventoried design-library-provider.css. The helper shared_components/js/design-library-ui.js preserves provider field names and submit handlers, adapts nested mobile form/results and hides only cloned source definitions. Neutral reference/amber archive retained. Fifteen focused browser cases cover four widths, zero fixture axe violations, complete five-tier AL and full-back prices, visible reference fallback, dialogs/keyboard, exact clipboard values, failed/empty/recovered search and replacement forms. Two PDFs/three pages retain39visible text/current-filter blocks. Six suites/220source/CSS checks and286CSSfiles clean.31recorded controller UI edits reverse to six original hashes. Actual read-only Caspio queries returned24records per page without business writes; private actual data is not in Git. Two old sheets retire275flags;77exact provider exceptions remain, ordinary app owner zero. Both CSS graphs74123LFbytes versus34,811/61,697: consistency/maintenance gain with larger payloads, not a byte-reduction claim. Original hidden/focus/typed-button tests now follow shared owners and always-visible actions. Initial strict-locator, incomplete mock select tags and print-context exception matching errors were corrected.

140of225 reviewed locally/85pending. Verified LIVE remains138/87 on .14/2090/db9c6a64ea6f1dc98b32aecd9924f45fcc1ce473. Integrate, run full gates, verify exact-source CI and rollout before increasing live count. Provider administration, other embedded apps and generated document families remain separate unfinished tracks. All earlier append/commit/release helpers are one-shot and must not be rerun.

## Design-library integration — 2026-09-09

Preserved the .14 live checkpoint and all append-only design evidence. The initial review commit helper stopped on whitespace-only HTML lines; finish-design-reviewed.cjs removed trailing whitespace and committed the owned source, preserving both indexed deletions. Do not rerun either review helper. Full integrated checks follow.

Integrated design checks found two historical photo-source locks still expected the previously untouched design controllers. The photo guard now reverses the same31 explicitly documented design edits before checking its original hashes; no source lock was removed or rebased. All227suites rerun on the updated integrated source.

## Design-library release checks complete — v2026.09.09.15

Tested source 09faa19b656c10c7e8331aee477c3ebea080711f: build/lint/types,485routes/24modules,227unit suites/5289passed/four existing skips,88DOM,four accessibility unit,84quote parity,566mocked browser,16remaining browser/three optional screenshot skips,all five calculators. 287CSS clean,boot200,production audit zero.15focused cases; two PDFs/three pages/39visible text/current-filter blocks. Two CSS owners and three controllers/helpers versioned2026.09.09.15; exact Caspio embed URLs and pricing helpers preserved.77scoped provider exceptions replace275old flags; local app owner zero. Actual provider search reads checked24records per page; synthetic tests cover pricing/dialog/search/failure states. Live remains138/87 until verified140/85 after exact-source CI and rollout.

## Design-library release record — v2026.09.09.15

Exact-source CI 34405981395 passed all four jobs on d74325695312458086835c71010f223d4f0f8ba4, including actual money/calculator parity and566mocked browser checks. Design libraries share controls and dialogs with a scoped Caspio adapter.15focused interaction cases and two PDFs/three pages/39visible blocks; exact pricing, clipboard and provider form replacement states checked using synthetic data.485routes unchanged. Count becomes140reviewed/85pending only after verified rollout.

## Design preview tools plan — 2026-09-09

Next isolated candidate .16, base09faa19b656c10c7e8331aee477c3ebea080711f: pages/design-view.html, pages/dst-viewer.html and pages/jds-mockup-creator.html. Public design gallery, local DST studio and JDS tumbler mockup UI. Preserve all existing URLs, inputs, output pixels/measurements and pure DST/color/garment/template helpers; customer gallery must keep internal pricing/order notes absent. JDS uses documented drinkware oxblood identity; DST retains its dark instrument workspace, matched to its existing launcher. All use shared control/font/focus conventions with separate family layout owners.

- [x] Capture original desktop/mobile states with synthetic APIs/assets and local sample files.
- [x] Consolidate local style owners and canonical controls; review native file inputs, keyboard/dialog/canvas controls and complete visible failure states.
- [x] Compare image/PNG/download/approval outputs, DST counts/dimensions and public/private content boundaries.
- [ ] Run browser/source/print review, integrate full gates and exact-source CI, deploy and verify actual slug.

No app CSS changes or extra review credit yet. Verified live .14/2090/db9c6a64ea6f1dc98b32aecd9924f45fcc1ce473:138/225,87pending. Design-library .15 source09faa19b656c10c7e8331aee477c3ebea080711f has full gates running after historical source guards were extended through its documented edits. Original preview-tool evidence remains outside Git at C:/Users/erik/.codex/visualizations/2026/09/07/01a07d90-9a4c-7e70-9e4e-c196377b7c6b. No real uploads, writes, emails or notifications.

Preview-tool draft: shared_components/css/design-preview-tools.css now owns the public pages/design-view.html layout; retired pages/css/design-view.css after its only app consumer moved. Gallery uses canonical fonts, controls and dialog dependency. Customer design URLs/images/contact details preserved; review pending, no page credit yet. DST Studio and JDS are still original on this branch.

Preview-tool draft now also moves pages/jds-mockup-creator.html into shared_components/css/design-preview-tools.css; retired pages/css/jds-mockup-creator.css after its sole app consumer moved. Shared controls/native artwork chooser retain oxblood theme; Inter remains loaded for unchanged branded canvas exports. Review pending; no page credit.

Preview-tool draft: shared_components/css/embroidery-studio.css now owns pages/dst-viewer.html; retired pages/css/dst-viewer.css after its only app consumer moved. Scoped dark instrument theme uses shared tokens/controls, visible native DST chooser, mobile toolbar wrapping and keyboard dialog metadata. Original approval-sheet font metrics retained pending separate document design. Source/output/browser checks pending; no review credit.

Preview tool ownership: pages/design-view.html and pages/jds-mockup-creator.html load tokens/components/design-preview-tools.css; pages/dst-viewer.html loads tokens/components/embroidery-studio.css. All three old page CSS files retired (seven flags removed; new owners zero). Shared app type/control/focus, local dark instrument and oxblood identities. Five PNG exports verified byte-identical to originals; approval text retained. Three original CSS graphs grow to shared component ownership: pages/design-view.html 25016→72122LFbytes; pages/dst-viewer.html 47479→102971LFbytes; pages/jds-mockup-creator.html 38748→72122LFbytes. Payload reduction is not claimed. Focused browser/source/print review continues before release credit.

## Preview tools local review — 2026-09-09

Reviewed preview tools: pages/design-view.html, pages/dst-viewer.html and pages/jds-mockup-creator.html now share canonical UI controls/type/focus and two scoped layout owners. Native file inputs stay visible. Gallery excludes internal fields and reports failed/malformed/image states; DST keeps its dark instrument role, accessible thread dialog, keyboard stats and fitted resize behavior; tumbler retains oxblood identity with latest-image protection and retryable failures. Sixteen focused browser cases pass at1440/768/390/320 with zero fixture axe findings. Eight suites/748source/CSS/historical guards pass. Eight original script hashes preserved outside38 mapped UI edits. Five actual downloads match original bytes and filenames: DST1166×662stitchout/1410×1600garment; JDS1840×1980framed/1800×1800bare/1708×1178comparison. Two reviewed PDFs each one page retain all original text words; gallery shrank from two pages. Original approval fonts remain an output boundary. No real business writes/uploads/messages. Three old sheets/seven important flags removed; new owners zero. Existing historical gallery guards follow its new owner and semantically inspect hidden dialog attributes. Zero-size ResizeObserver callbacks while printing and print-rule order are regression-covered. LESSONS_LEARNED now254lines;15 already-archived short references moved to the archive before adding the preview lesson. CSS byte budgets measured honestly: shared ownership increases these three graphs.

143of225 reviewed locally/82pending. Verified LIVE remains140/85 on .15/2091/dd96cc3242104e280dd76377c54bc8aed8750d02. Integrate, full gates, exact-source CI and verified rollout remain required. Root checkpointc58d06b28c0b2b6e1ab942267200571bb023f959. No subsequent family started yet.

## Preview-tool release checks complete — v2026.09.09.16

Tested source 8c9db3cac7a3830f208ce89008346d08cb08ebde: build/lint/types,485routes/24modules,228unit suites/5303passed/four existing skips,88DOM,four accessibility unit,84quote parity,582mocked browser,16remaining browser/three optional screenshot skips,all five calculators. 286CSS clean,boot200,production audit zero.16focused cases; two PDFs/two pages/139words retain original text. Five actual PNG exports match original bytes. Two CSS owners and three controllers versioned2026.09.09.16; eight original script hashes preserved outside38mapped UI edits. Seven old flags retired; both new owners zero. Synthetic tests cover gallery privacy, native inputs, dialog/keyboard, failed/recovered responses and print-time canvas visibility. Live remains140/85 until verified143/82 after exact-source CI and rollout.

Preview CI follow-up: run34410360529 on fddd6f7a failed only the thread-picker browser check (581other mocked cases passed; three deterministic jobs green). The test read the unfiltered Ash choice before the original120ms debounce completed, then clicked the filtered White-Navy choice. Wait for a matching rendered picker name before reading/clicking. Runtime assets and all output helpers are unchanged. All16preview browser cases and five repeated picker cases pass locally; initial full local228suites/5303tests,582mocked,16money/calculator remain valid runtime evidence on8c9db3. Fresh exact-source CI must pass all four jobs before .16 deployment.

## Preview-tool release record — v2026.09.09.16

Exact-source CI 34411825164 passed all four jobs on e711da2f34e8c9ecd81738e6d725d45877ad0810, including actual money/calculator parity and582mocked browser checks. Three preview tools share controls, native file inputs and accessible dialogs.16focused cases, five byte-identical PNG exports, two PDFs/two pages/139words retained; original eight script hashes preserved outside38UI edits.485routes unchanged. Count becomes143reviewed/82pending only after verified rollout.

## Product detail tools plan — 2026-09-09

Next isolated candidate .17, base8c9db3cac7a3830f208ce89008346d08cb08ebde: pages/dtg-compatible-products.html, pages/inventory-details.html, pages/sanmar-catalog-color-audit.html. Related product discovery, stock inspection and read-only catalog-color audit surfaces. Preserve their product/style/color identities, exact counts/warehouse stock and CSV output, price-link destinations, sample-cart behavior, API configuration and shared inventory renderer. Public discovery and staff audit retain separate role/context labels while sharing canonical controls and table/card patterns.

- [x] Record original four-width, populated/failure and printed states with synthetic reads.
- [x] Consolidate CSS ownership, retain shared-module contracts, expose honest loading/empty/partial/error and keyboard states.
- [x] Review source/CSV/paper and responsive interactions; keep real business writes/uploads/messages blocked.
- [ ] Integrate full gates and exact-source CI, deploy and verify actual release.

No product-page CSS edits or review credit yet. Verified LIVE .15/2091/dd96cc3242104e280dd76377c54bc8aed8750d02:140of225,85pending. Preview-tool .16 reviewed source29819a19e9d45947b26a4300206f5ce739af569b is integrated as8c9db3cac7a3830f208ce89008346d08cb08ebde; full gates running,228unit suites/5303passed so far. Its three pages reach143/82 only after verified rollout. Root remains clean during full gates. Artifact original baselines and dependency hashes in C:\Users\erik\.codex\visualizations\2026\09\07\01a07d90-9a4c-7e70-9e4e-c196377b7c6b.

Product detail draft: shared_components/css/product-detail-tools.css owns pages/dtg-compatible-products.html, pages/inventory-details.html and pages/sanmar-catalog-color-audit.html, replacing pages/css/dtg-compatible-products.css, pages/css/inventory-details.css, pages/sanmar-catalog-color-audit.css. Public storefront/card/stock layouts and staff audit report share tokens/components; no external header/product helper files deleted. DTG obsolete reference to already-missing sample-cart.js removed; inventory now loads APP_CONFIG before its unchanged API module. Existing cart-count/header and inventory renderer contracts remain; local UI wiring/tests/print review pending. No page credit.

Product detail draft evidence registered: tests/fixtures/product-detail-original-content.json (seven original script hashes reversed through32mapped UI edits), tests/fixtures/product-detail-review-data.json (synthetic records), tests/unit/product-detail-content.test.js and tests/e2e/css-unification-product-detail-tools.spec.js. Three pages use shared product-detail-tools.css; three old sheets retired. Discovery retains11style destinations; inventory API/renderer helpers unchanged. Confirmed backend src/routes/inventory.js returns source sanmar-bulk with sizes and placeholder zero totals: UI now labels warehouse availability unavailable. Failed/partial audit does not label unavailable SanMar results as clean or orphans. Four copied table outputs stay unchanged. Browser/source/print review pending; no live credit. Graphs 42911→75201LFbytes, 44431→75201LFbytes, 21628→75201LFbytes.

Product detail ownership follow-up: the DTG list was the only consumer of shared_components/css/universal-cart-header.css. Its layout is now provided by product-detail-tools.css plus components.css, so the unused sheet is retired and removed from lint scope. UniversalCartHeader behavior remains unchanged; its obsolete stylesheet comment is updated and the consuming script cache version is2026.09.09.17. Historical tests/unit/public-cart-header-pages.test.js follows the current owner and still locks no style injection, badge visibility, asset versions and destinations. Seven original script hashes now reverse33mapped changes (the extra change is only that comment). This retires four sheets/5important declarations total; current local owner zero.

## Product detail local review — 2026-09-09

Reviewed product detail tools: DTG-compatible products, inventory details and SanMar catalog-color audit share canonical typography, controls, stock/audit tables and one scoped page owner. Four old stylesheets/five important declarations retired; new owner zero.22focused browser cases pass at1440/768/390/320 with zero fixture axe findings; eight source/CSS/legacy suites238checks pass and282CSS files lint clean in the isolated tree. Seven original script hashes preserved outside33mapped changes (including one obsolete header comment). All11style destinations, warehouse quantities/stock thresholds and four exact clipboard strings retained. Inventory missing configuration and catalog-size placeholder quantities are handled explicitly; unknown stock stays unknown. Malformed/partial/empty/retry, delayed color/search responses and denied clipboard covered. Three PDF outputs/six pages/610extracted words preserve all original data words; action-only request/cart/copied labels omitted intentionally in print. All11product pictures verified in PDF raster output after correcting clipped relative-position containers. DTG print reduces5→3pages; inventory1 and audit2 remain complete. Graphs now75,936LFbytes each versus42,911/44,431/21,628originally; no payload reduction claim. Lessons remain254lines after archiving six redundant short references. No business writes/uploads/emails/notifications.

146of225 reviewed locally/79pending; verified LIVE remains140/85 on .15/2091/dd96cc3242104e280dd76377c54bc8aed8750d02. Preview-tool .16 sourcee711da2f34e8c9ecd81738e6d725d45877ad0810 is in fresh CI34411825164 after synchronizing the debounced picker test (runtime unchanged,16focused plus five repeat cases passed). Product .17 still needs integration, full local gates, exact-source CI and actual rollout. Next planned review family is the three pricing reports: dashboards/reports/price-audit-report.html, pages/quote-audit.html, dashboards/pricing-analysis.html; inspect the last page generator before editing. No pricing-report edits yet.

## Product detail release checks complete — v2026.09.09.17

Full integrated source passed build/lint/types,485routes/24modules,229unit suites/5316tests/four existing skips,88DOM,four accessibility unit,84quote parity,604mocked browser,16remaining browser/three optional screenshot skips,all five calculators,283CSS clean,boot200 and production audit zero.22focused cases; three PDFs/six pages/610extracted words retain original business text with all11product images. Seven original script hashes preserved outside33mapped changes; four exact clipboard outputs and warehouse values retained. Four old sheets/five flags retired, new owner zero. Catalog size placeholders are labelled unavailable stock; no new stock source is invented. Versioned source assets follow existing page serving policy. Live remains143/82 until verified146/79 after exact-source CI and rollout.

## Product detail release record — v2026.09.09.17

Exact-source CI 34415212298 passed all four jobs on d9695d9ff41b3423b2c5be4b21bb349928cf105b, including actual money/calculator parity and604mocked browser checks. Three product detail tools share controls, table layouts and honest unknown/error states.22focused cases, exact warehouse and four clipboard outputs, three PDFs/six pages. Seven source hashes preserved outside33mapped changes. Four old sheets/five flags retired.485routes unchanged. Count becomes146reviewed/79pending only after verified rollout.

## Pricing reports plan — 2026-09-09

Candidate .18, based on reviewed product source98e17e0d5f999cb45df77f285cf0af16cdf69ebf: dashboards/reports/price-audit-report.html, pages/quote-audit.html, dashboards/pricing-analysis.html. Unify staff report headings, navigation, table scrolling, financial-number alignment and printable sheets. Preserve all historical numbers/copy/links and valid audit totals. Pricing Analysis is generated: update its generator layout and verify a rebuild against the original data; keep memory/pricing-analysis-data.json unchanged and non-served. Use synthetic quote responses and block real business writes.

- [x] Capture original four-width report, staff-gate, populated audit and paper evidence.
- [x] Consolidate CSS and generator layout with source locks on report data and money formatting.
- [x] Verify keyboard sorting/navigation, incomplete/error recovery, precise financial tables and complete paper.
- [ ] Integrate full gates, exact-source CI and verified deployment.

No pricing-report edits or review credit yet. Verified live remains .15/2091/dd96cc3242104e280dd76377c54bc8aed8750d02 (140of225/85pending). Preview .16 sourcee711da2f is in fresh CI34411825164. Product .17 source98e17e0d is committed/reviewed with22browser cases,238source/CSS checks and three PDFs/six pages including all11product images; it still needs integration/full gates/CI/rollout. Shared working-tree node_modules is a junction into primary; no.env copied.

Pricing reports layout draft started: shared_components/css/pricing-reports.css will own dashboards/reports/price-audit-report.html, pages/quote-audit.html and generated dashboards/pricing-analysis.html. It uses shared controls/tables and retains report-specific chart/layout patterns. Original source/print capture complete:8tables/181rows,1table/3synthetic rows,33tables/179rows; original generator rebuild preserves33tables/5675body words. Six original source/data hashes retained. No page wiring or review credit yet.

Pricing report pages now load tokens/components/pricing-reports.css and shared Public Sans/monospace type. Three prior page sheets retired (18important declarations). Both static reports and quote audit use canonical tables/keyboard scrolling; quote visibility moved from inline display to native hidden. The analysis generator emits the new owner/classes/skip link and preserves bar magnitudes using a dynamic --report-share property; original data JSON unchanged. Layout draft only: source, sorting, error, accessibility and full paper review still pending; no review/live credit.

Reviewed pricing reports: price-audit-report, quote-audit and generated pricing-analysis share canonical typography, table/control/focus rules and one scoped pricing-reports.css owner. Three legacy sheets/18important declarations retired; new owner zero.19focused browser cases cover four widths, zero fixture axe findings, all42original table outputs/363rows, keyboard numeric/text sorting, current-section navigation, session hydration, denied/missing/failed/malformed/empty data and retry. Complete quote comparisons preserve valid zero audit totals instead of replacing them with old session totals; all pricing formulas remain unchanged.33explicit mappings reverse six original script/generator/data hashes. Generator layout and output stay synchronized, private memory JSON remains unserved, and financial report fixtures contain hashes instead of copied records. Three PDFs/32landscape pages/10,146checked original data words; all pages visually reviewed. Price audit12→9pages, quote1→1, analysis20portrait→22landscape. Graphs: dashboards/reports/price-audit-report.html 23434→85591LFbytes; pages/quote-audit.html 25979→85591LFbytes; dashboards/pricing-analysis.html 168092→85591LFbytes. Full release gates pending; this review reaches149/76 locally, live count changes only after verified rollout. No real writes, imports, uploads, emails or notifications.

## Pricing report release checks complete — v2026.09.09.18

Full integrated source passed build/lint/types,485routes/24modules,230unit suites/5328tests/four existing skips,88DOM,four accessibility unit,84quote parity,623mocked browser,16remaining browser/three optional screenshot skips,all five calculators,281CSS clean,boot200 and production audit zero.19focused cases;42table hashes/363rows; three PDFs/32landscape pages/10,146checked original data words. Six original script/generator/data hashes preserved outside33mapped changes. Three legacy sheets/18flags retired, new owner zero. Stored audit zero totals remain authoritative; missing audit data cannot masquerade as zero/OK. Private financial JSON unchanged and unserved. Live remains146/79 until verified149/76 after exact-source CI and rollout.

## Pricing reports release record — v2026.09.09.18

Exact-source CI 34428559307 passed all four jobs on 0b4eabe6e009638a360f6cf12438e7759cba0b73, including actual money/calculator parity and623mocked browser checks. Three pricing reports share controls, table layouts and honest incomplete/error states.19focused cases,42original table hashes/363rows, three PDFs/32pages/10,146checked data words. Six source hashes preserved outside33mapped changes. Three old sheets/18flags retired.485routes unchanged. Count becomes149reviewed/76pending only after verified rollout.

## CRM workspaces reviewed — candidate v2026.09.09.19

Six pages: House Accounts, Nika CRM, Taneisha CRM, Leads, Lead Scorecard and Unqualified Leads. Two scoped canonical owners (crm-accounts.css/crm-pipeline.css), Public Sans, navy/gold headers, consistent controls/tables, native account/house dialogs and independent contact links. Four legacy sheets/7important declarations retired; new owners zero. Existing scorecard/category test previews mirror production main markup/assets and keep stub controllers. Excluded lead detail HTML/controller/leads.css remain unchanged.

31focused browser scenarios pass at1440/768/390/320 with zero fixture axe violations, including populated dialogs, keyboard/focus return, filters, original CSV, malformed responses/retry, stale background archive/quarter totals and category/scorecard races. Eleven source/CSS/historical suites299checks pass, including25new page/source/preview locks. All17original hashes reverse88mapped UI/recovery edits; financial formulas and request payloads retained. 18original account-card hashes,5table-output hashes/12visible rows,2rep-detail hashes and lead CSV preserved. Six base PDF outputs/8Letter-landscape pages (previous11),640original card/table words checked, plus2board-print pages with all five leads; every paper page and four-width layout reviewed. Headings and summary counts remain in print. Narrow scorecards keep money figures together.

Account CSS graphs123,166LFbytes versus54,563/59,002/59,002; pipeline97,911 versus176,101/161,043/161,142. This consolidates ownership; account payloads increased while pipeline payloads decreased. Full CSS scope278clean in isolated tree. Runtime census:155reviewed migrations locally/70pending/79excluded, but LIVE REMAINS149/76 on.18 until.19 is deployed and verified. Lessons250lines after archiving three resolved references. No real writes/uploads/emails/notifications; every API, including mutating GET reconcile, was intercepted.

Next: integrate this exact reviewed SHA into clean develop, preserve the .18 live checkpoint, run all full application gates, then require actual browser/money/calculator steps in exact-source CI before one deployment. Verify release/running slug, both raw/versioned and registered hashed assets, prior staff/public access and four retired-sheet404 responses. Backend unchanged.

## CRM release checks complete — v2026.09.09.19

Full integrated source passed build/lint/types,485routes/24modules,231unit suites/5359tests/four existing skips,88DOM,four accessibility unit,84quote parity,654mocked browser,16remaining browser/three optional screenshot skips,all five calculators,279CSS clean,boot200 and production audit zero.31focused CRM scenarios;299source/CSS/historical checks. Six base PDFs/eight pages/640original data words, plus two complete board-print pages.17source hashes preserved outside88UI/recovery mappings. Four old sheets/seven flags retired. Live remains149/76 until exact-source CI and verified.19 rollout raises it to155/70.

## CRM release record — v2026.09.09.19

Exact-source CI 34433719156 passed all four jobs on 37fe944b6ceb2bbdb4361a37aaefaaee61d0a53d, including actual live money/calculator parity and654mocked browser checks. Six CRM workspaces share canonical account/pipeline owners.31focused scenarios,299source/CSS/historical checks,17original source hashes/88mapped edits, complete base and board print. Four old sheets/seven flags retired;485routes unchanged. Count becomes155reviewed/70pending only after verified rollout.

## Lead records reviewed — candidate v2026.09.09.20

Three application pages: lead detail, form submissions and marketing shipments. One canonical scoped crm-records.css owner with existing components/pipeline, Public Sans and navy/gold header. Four legacy sheets, 42,003LFbytes and four important flags retired; the new owner has zero. Three static previews now mirror current production markup and retain strict mock boundaries.

25 focused browser cases pass, including four widths/axe, original content and tables, native Inbox dialog/focus/print, lazy art prefill/inert host, kit validation, original sample/quote handoffs and payloads, malformed/error/retry and superseded loads. A stale quote response can no longer trigger value sync for a refreshed lead; valid current quote sync remains unchanged and tested through a mock write. Uncertain outreach timeout wording remains beside the action. Seven source/CSS/historical suites pass 275checks, including 21 record/source/preview/runtime checks. Seventeen original hashes are preserved through 93 reversible controller edits, HTML semantic contracts and explicit stylesheet retirement provenance. No real writes/sends/uploads/notifications.

Five reviewed PDF outputs total seven pages: lead two, Inbox list one, shipment list one, Inbox dialog one and populated lead two; complete orders, amounts, statuses, contact, quote and art reference are visible. Order cells stay on one line in print. The final paper spacing adjustment passed both affected browser cases. Full CSS scope275clean before this final whitespace/print adjustment. Direct CSS graphs 129469LFbytes each (original186,763/167,810/177,211); lead art-trigger graph 165253bytes, counted separately. Original garment-submit-form.css/js stay source locked and remain on the shared runtime modernization backlog.

Local census becomes158 reviewed migrations/67pending/79excluded; LIVE REMAINS.19 at155/70 until full local gates, exact-source CI actual browser/money/calculator checks and verified deployment. Integrate only the recorded reviewed SHA with the primary .19 checkpoint, preserving current live memory. Backend unchanged.

## CRM release checks complete — v2026.09.09.20

Full integrated source passed build/lint/types,485routes/24modules,232unit suites/5383tests/four existing skips,88DOM,four accessibility unit,84quote parity,679mocked browser,16remaining browser/three optional screenshot skips,all five calculators,276CSS clean,boot200 and production audit zero.25 focused record scenarios;275 source/CSS/historical checks. Five PDF outputs/seven pages include populated lead orders and full Inbox detail.17 original source hashes preserved through93 UI/recovery mappings, HTML contracts and four explicit stylesheet retirements/four flags. Live remains155/70 until exact-source CI and verified.20 rollout raises it to158/67.

## Lead records CI portability repair

Exact-source CI34439501966 on637361ee failed three of679mocked browser comparisons because the original captures use Pacific timestamps and Linux defaults to UTC (11:00a versus6:00p).676browser cases passed; unit/lint/types passed; live parity was not run after the browser failure. Application implementation is unchanged. The lead-record spec now explicitly sets America/Los_Angeles; all25focused cases pass with process TZ=UTC. Prior full local checks remain applicable to unchanged application bytes, and the new exact-source CI must run all679browser cases and actual live money/calculator parity before release.

## CRM release record — v2026.09.09.20

Exact-source CI 34440499535 passed all four jobs on c8523b2655fd1dadb2bdcf678309dc882850ba1e, including actual live money/calculator parity and679mocked browser checks. Three record workspaces share canonical CRM controls and layouts.25 focused scenarios,275 source/CSS/historical checks,17 original source hashes/93 mapped edits and explicit retirement provenance, five PDF outputs/seven pages. Four old sheets/four flags retired;485 routes unchanged. Shared art-module styling remains pending. Count becomes158 reviewed/67 pending only after verified rollout.

## Personalization review record

Reviewed source 315cc03bea6e9e235a5ea46e48113d0a40144ce5;57 focused browser/288 preservation-CSS-QA checks;167 source mappings;8PDFs/18pages;4retired owners/78408bytes/9flags. Full integration and release checks follow.

## Personalization release checks complete — v2026.09.10.1

Full integrated source passed build/lint/types,485routes/24modules,233unit suites/5409tests/four existing skips,88DOM,four accessibility unit,84quote parity,736mocked browser,16remaining browser/three optional screenshot skips,all five calculators,273CSS clean,boot200 and production audit zero.57 focused personalization scenarios;288 preservation/CSS/name-QA/historical checks;8PDF outputs/18reviewed pages.22 original hashes/167 reversible mappings;4retired owners/78408bytes/9flags. Live remains158/67 until exact-source CI and verified release raises it to162/63.

## Personalization release record — v2026.09.10.1

Exact-source CI 34451390044 passed all four jobs on b3147eab9220ef47330bc3a9a8c8d58287b3730a, including actual live money/calculator parity and736mocked browser checks. Four personalization pages share canonical controls and one scoped owner.57 focused scenarios,288 preservation/CSS/QA checks,22 original hashes/167 mapped changes,8PDFs/18pages. Four old sheets/78408bytes/nine flags retired;485 routes unchanged. Count becomes162 reviewed/63 pending only after verified rollout.

## Staff workspaces — Drain-Pro reviewed draft (2026-09-10)

Six-page source baseline has 61 original hashes from live 0f151e3899b8517092b1864babd8ea7f579fc95b. Drain-Pro is the first reviewed draft: Public Sans/shared controls, retained red brand accents/logo, compact staff header, phone layout, explicit keyboard tabs, direct/invalid call protection, both-provider paper output and screen-state restoration. Six mocked browser cases cover four widths, exact original text/links/provider URLs and screen/paper states. Two current PDF pages visually reviewed; original three-page proof preserved after settling its legacy animation. Nineteen reversible changes; 61 source contracts plus full migration/stylelint guards passed. Old DrainPro-Bundle.css retired: 11,787 LF bytes / seven flags. Current shared graph 63,835 LF bytes; new owner has zero flags. Caspio forms were synthetic boundaries; their internal UI remains a separate unfinished track.

This is on codex/staff-workspaces only, excluded from the current eight-page toolkit release. Candidate inventory adds one reviewed page after the toolkit candidate (171/225, 54 pending); production count must continue to come from the verified release checkpoint. Remaining five original browser fixtures and migrations: AE mission control, company numbers, payroll, production shifts and quote management. Preserve math, employee records, filters, timestamps, source URLs and every business request; all writes/allocating GETs mocked. Shared SanMar inbound/invoice/box-label helpers need consumer audits. Do not merge this advancing branch into another release.
