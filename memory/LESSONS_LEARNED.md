# LESSONS LEARNED

## Saved browser evidence must not record timing samples (2026-09-17)

- Problem/root cause: `CAPTURE_QUOTE_BUILDERS_ORIGINAL=1` failed 30 of 79 replayed builder states on every run, even on the commit before the September 16 changes, although the replayed sources are hash-locked. The saved records held values that change between runs: `Math.random` artwork-widget ids, share links on port 3414, toasts that expire on real timers, guided-step titles that fail contrast only under the resting pointer (Chromium re-applies `:hover` asynchronously after a resize or full-page screenshot), the fast-quote step fade-in (0.3 s, no reduced-motion rule), and the company lookup replacing its "Searching..." node while axe ran. axe names a node that left the document `:root`.
- Solution: `evidence()` lets finite animations finish before each width. Capture mode compares `stableOriginal()` forms of the new record and the saved one, which normalize only those identities and samples on both sides. Customer values, amounts, quote ids, visible text and saved requests stay exact, and settled fast-quote pages must show no contrast failure. No fixture was regenerated.
- Prevention: settle animations before recording axe or snapshots, keep random ids and ports out of saved evidence, and treat an axe `:root` target as a node replaced mid-run.

## Moving an overlay to a native `<dialog>` has three traps (2026-09-17)

- Problem/root cause: the DTG push and assistant-overwrite confirms were unnamed `div[role=dialog]` overlays; Tab walked out to the page and Escape or a backdrop click left focus on `<body>`. Switching to `showModal()` brings its own traps: an overlay class with `display:flex` overrides the browser's `dialog:not([open]) { display:none }`; a panel class with `position:relative` computes to `absolute` in the top layer, so it opens above a scrolled page; and Chrome's native modal still lets Tab leave for the browser toolbar.
- Solution: the `<dialog>` carries the full-screen `.dtg-stock-confirm-backdrop` class (sized, and hidden when closed, by `dialog.` rules in `quote-dtg.css`); `aria-labelledby`/`aria-describedby` name it; a capture-phase keydown wraps Tab and consumes Escape for the newest confirm only (the assistant panel behind stays open); closing refocuses the opener.
- Prevention: find each dialog by role and name in the browser test, then press Tab past the last button, Escape and a backdrop click (`css-unification-quote-builder-alternate-workflows.spec.js`). Also: removing a failed image's `src` still shows Chrome's broken-image icon and alt text, so `placeholder-src` now loads a blank pixel.

## A page `:hover` rule on a filled button needs the workspace's `:not(:disabled)` form (2026-09-17)

- Problem/root cause: the DTG builder's axe check failed now and then on `.dtg-cc-add-default` and its colour label. In the same layer, the workspace's generic `button:hover:not(:disabled)` (0,2,1) outranks a page's `.x:hover` (0,2,0), so a hovered white-text button got the pale tint background (1.05:1). The spec leaves the pointer where it clicked, then resizes and runs axe, so a button landed under the pointer only in some layouts.
- Solution: the DTG hover rules now end in `:hover:not(:disabled)` (0,3,0) for `.dtg-cc-add-default` and `.dtg-fullcat-trigger`; every restored filled button (push, preview confirm, share actions, Enter manually, Retry, Proceed) has the same form. All DTG browser checks pass.
- Prevention: when a page gives a button a filled background, write its hover as `:hover:not(:disabled)`. `css-unification-quote-builder-workflows.spec.js` probes the restored button and state styles on all four builders.

## A CSS migration must carry the classes JavaScript adds at runtime (2026-09-16)

- Problem/root cause: the September builder CSS release (v2026.09.13.2) replaced each builder's old sheets with the unified family, but the census only covered markup and static states. 47 classes that JavaScript adds later kept their only rules in the retired sheets: the Screen Print and DTF "Push to ShopWorks" dialog stayed `display:none` after `.show`, the pricing-error banner, fallback-price badge and "Updating prices…" pill rendered as plain text at the end of the page, the Embroidery monogram/manual-item dialogs and stitch estimator appeared below the footer, and $0 vendor rows, low-stock badges and review deltas lost their warning colours. Nobody saw it for three days because no browser test opened those states.
- Solution: the rules are back, token-based and scoped (`quote-workspace.css` for shared pieces, `quote-<method>.css` for the rest), and the Embroidery import summary and $0 price are rebuilt as keyboard buttons. `tests/e2e/css-unification-quote-builder-workflows.spec.js` checks the computed style of every restored overlay/notice on all four builders and runs a full vendor import by keyboard.
- Prevention: before retiring a sheet, list every class the page's JS applies (classList, className, template strings) and check a loaded sheet styles it; open each runtime state in a browser test. The 52 cosmetic-only groups the audit also found were restored on 2026-09-17 (`memory/CSS_UNIFICATION_2026-09.md`).

## A module-private function used as a page global fails only after bundling (2026-09-16)

- Problem/root cause: `shopworks-import.js` called `reorderRowByProductType` as a bare global (listed in its `global` lint comment), but it is private to `product-rows.js`. esbuild renames the private copy so it can't shadow a global of the same name, so every ShopWorks import of a part number missing from SanMar threw a ReferenceError after creating the row: no color, no sizes, and the line silently dropped out of the quote total. The jsdom suites stubbed `reorderRowByProductType` on `globalThis`, which hid it.
- Solution: the function is exported and imported. `tests/unit/builders/declared-globals.test.js` fails when a builder module declares as a global a name that is only a private declaration in another builder module (and not a real page global).
- Prevention: don't stub a name in a DOM test that the code should import; prefer importing over the `global` comment. When a vendor line finally imported whole, the engine's "CRITICAL ERROR — contact IT" banner fired for an honest $0 row, so the engine now lists such lines as `unpricedProducts` instead of API failures — and save, print and copy refuse them (`vendorStylesWithoutPrice`), while Email and Push stop when the save they need was refused (`saveAndGetLink` returns true only on a complete save).

## Staff tools warn about decoration rules; they don't block (2026-09-16)

- Problem/root cause: Quick Quote refused screen print on a CornerStone safety vest because the Caspio `Decoration_Method_Rules` row for Workwear was embroidery-only — rules written for the customer product page. The quote builders never check them, and Quick Quote's own safety top-sellers list recommended the vest for print.
- Solution (Erik): screen print and DTF are allowed for every garment category in Caspio (caps stay cap embroidery), and Quick Quote never limits them; DTG and embroidery outside a category's rule still price with a "check the garment" note, are never the lowest-price pick, and start unticked on the customer estimate.
- Prevention: a staff surface uses the category rules as notes, never as a block the builders don't also enforce. Change the Caspio cells (no deploy) when the customer offer changes; `rules-before.json` in the session scratchpad holds the previous matrix.

## One product-type rule for every price surface (2026-09-16)

- Problem/root cause: the builders, product page, public embroidery calculators and Quick Quote each decided cap vs garment embroidery their own way (style prefixes, substring keywords, category only). On 2,484 live styles they disagreed with Erik's rules on 85, 86, 297 and 8 rows: New Era/Richardson apparel priced as caps, every beanie priced as a cap on the product page, "capacity" bags sent to the cap calculator. The flat calculator also crashed (`hideLoading` never existed) whenever a cap opened it.
- Solution: every surface calls `HeadwearClassifier.classify()` and uses `isCap` as returned; Erik's rules live only in the classifier; `tests/unit/headwear-surfaces-parity.test.js` runs each surface's real decision code on live rows. Reopened builder quotes show which prices changed. See `memory/HEADWEAR_ALIGNMENT_2026-09.md`.
- Prevention: a new surface that prices headwear must call the classifier and join the parity test — never a keyword substring or style prefix. Before making anything "embroidery only", read the live `/api/decoration-methods` rules (Personal Protection allows print). Test mocks must copy the live API shapes (stylesearch labels are "STYLE - TITLE"). Classify from catalog fields, never ShopWorks text alone ("Port  Companyknit Cap" is a beanie). When a product changes pricing side, check what the old side carried (logo settings, AS-CAP/3D-EMB charges), not only its unit price.

## Browser evidence must not pin the order of concurrent requests (2026-09-16)

- Problem/root cause: `CAPTURE_QUICK_QUOTE_ORIGINAL=1` compared each state's whole record with `toEqual`, including `reads` (every mocked `/api` request in arrival order). Quick Quote fires its pricing-bundle, DTG-pricing and inventory reads concurrently, so five capture states (quick price normal/screenprint/pricing-failed/stock-failed, safety) failed on unmodified 556721b1 with the same entries reordered, even with one worker. The pricing-failed state had a second cause: the original page's `#pricing-api-warning` banner pulses forever (2 s, ignores reduced motion), so axe's colour-contrast result for its two buttons (4.3–4.4 against 4.5) depends on the frame it samples and moved between viewport states.
- Solution: `tests/e2e/css-unification-quick-quote.spec.js` compares `reads` as a multiset (key-sorted JSON strings, sorted, duplicates kept), and sets aside colour-contrast nodes inside the allowlisted forever-pulsing banner (`FLICKERING`), on both sides, while re-checking that banner's colours with its animation paused at a fixed frame. Every other rule, node, id, field, link and table stays exact; the immutable `*-original-browser.json` fixtures are untouched.
- Prevention: a request log compared across runs records *what* was asked, not *when* — compare it unordered unless the order is the behaviour under test (then assert that order directly). A contrast reading taken during an animation is a sample, not a page property. About 19 other css-unification specs record `reads`; if one fails on a pure reorder, use the same comparison instead of regenerating evidence.

## Removing a worktree deletes through a node_modules junction (2026-09-16)

- Problem/root cause: two throwaway comparison worktrees had `node_modules` as a Windows junction to the release worktree's `node_modules`. `git worktree remove` (clean trees, no `--force`) deleted the ignored junction's *target contents*, emptying `.codex/worktrees/quick-quote-release/node_modules`. Nothing failed until the next test run: `npm run build` said "esbuild unavailable" and `npx playwright` downloaded a stray copy.
- Solution: `npm ci` in the release worktree (same lockfile hash) restored all 740 packages.
- Prevention: before removing a worktree that borrows packages, remove the link itself first with `cmd /c rmdir <worktree>\node_modules` (removes only the junction), then `git worktree remove`. Never `rm -rf` or `git clean -x` a tree that contains a junction. After any cleanup, check `ls node_modules | wc -l` in the worktree that owns the packages.

## A redesign the reps never tried can hide a pricing dead end (2026-09-16)

- Problem/root cause: the Sept 13 Quick Quote redesign (and its Sept 14 "speed" pass) shipped without a rep trial. Nika could not price 112FPR: a new hard block required `product.isCap` to match the method, and the local cap regex missed Richardson caps (blank `CATEGORY_NAME`, title "Five-Panel with Rope"); the only method left priced the cap as a shirt. The same check never blocked DTG (`eligibility.DTG` is the string `'no'`) but blocked screen print/DTF on every blank-category garment. Browser mocks had only `Caps`/`T-Shirts`, so 59 cases passed.
- Solution: restored last week's line-sheet workflow on today's code; shared `headwear-classifier.js` (category → title → blank-category shapes/description; never brand; a bare numeric style only as a low-confidence last resort); embroidery rows route by confirmed product, unconfirmed keep the rep's choice; `methodAllowed()` reads yes/warn/no; unknown category warns. Price breaks probe each tier's lowest quantity (DTF freight steps inside tiers), the DTF small-batch tier keeps its highest fee-free base, and fee tiers round up to the cent. An adversarial review then caught mode switches leaving old prices under new decoration text (both modes share settings) — fixed with a settings version.
- Prevention: put a new quoting UI in front of the reps who use it before deploying; ask for their actual click path. Browser mocks must include blank-category products. Never hard-block on a heuristic — block only on confirmed data, otherwise warn. A "per pc + fee" table must be checked against the engine at every quantity in the tier, not one sample. Any cached or displayed price needs the version of the settings it was priced with. Browser mocks must match the live rules they stand in for (the mock `Caps` decoration rule allowed embroidery; live allows nothing).

## Shared per-IP limiters must scope by method and caller (2026-09-15)

- Problem/root cause: the proxy's 120-per-15-minute write limiter on `/api/files` counted GET image reads and exempted nobody, and the whole office shares one NAT IP. A secret-bearing Policies Hub batch upload 429'd 100%, and slide-heavy hub pages could break their own images with no batch running. The swarm's upload script never sent the secret, and the earlier memory note had the cap as ~60 with reads unlimited.
- Solution: `hasCrmSecret` skip + `meterWritesOnly` wrapper in the proxy middleware, wired onto `writeLimiter`; file GETs now send a one-year immutable Cache-Control. Locked by the proxy's files-write-limiter and files-get-cache-control jest suites.
- Prevention: before blaming a client, read the limiter's own `RateLimit-Policy` header on one probe. Every `/api`-mounted limiter decides its method scope and secret exemption explicitly. A shared-IP office makes any per-IP cap office-wide.

## Campaign headers must use the actual site logo (2026-09-15)

- Problem/root cause: the Carhartt Bucks headers reused a template favicon instead of the homepage's full NWCA logo.
- Solution: reuse the exact homepage logo URL in both customer and staff campaign headers, with proportional shared header sizing and meaningful alt text.
- Prevention: compare new-page branding visually with the live homepage; reserve the favicon for the browser tab.

## Private reports require an all-file boundary and honest live totals (2026-09-14)

- Problem/root cause: an admin link alone does not protect report assets, and this repository is public. Adding recent invoices onto archived sales double-counts the same dates; operational sales do not equal reconciled accounting profit.
- Solution: encrypt the reviewed generated package, keep the key in the hosted environment, and require admin on the shell and every report/download path before static mounts. Replace the whole recent invoice interval; preserve signed credits and exclude tax/shipping using source subtotals. Accept null subtotals as zero only when independently reconciled to a freight-only total.
- Prevention: test anonymous and non-admin access to every asset type, encoded filenames, tampering/missing keys, exact allowlists, no-store headers, interval overlap and partial failures. Preserve original financial scripts/data/downloads, verify browser backup/restore and paper output, and label dated accounting, incomplete coverage and browser-local progress. Never put the decryption key in public CI.

## Evidence hashes must survive checkout line endings (2026-09-13)

- Problem/root cause: an immutable JSON evidence check passed on Windows but failed on Linux because Git changed physical CRLF bytes to LF.
- Solution: normalize physical line endings to LF before hashing text evidence, using the original tracked fixture without changing its content.
- Prevention: pin the canonical LF checksum; preserve original fixtures and make cross-platform byte assumptions explicit. Require the exact release commit to pass CI before deploying.

## Holiday requests must share receipt and inventory contracts (2026-09-13)

- Problem/root cause: supported-size placeholder zeros looked like sold-out stock. A rebuilt request also needs the existing receipt’s fee types and address parser, not only a successful save.
- Solution: use actual SanMar inventory with catalog colors; compute one box through the real eight-piece embroidery tier; use server-validated invitation grants and prices. Save a Draft with confirmed lines, then mark Open. SHIP is a fee line and XMAS references are accepted by both receipt routers.
- Prevention: test real calculator parity, malformed/duplicate stock, partial writes and reload retries, receipt totals and logo access, staff inbox placement and payment blocking. Persist email send intent; uncertain delivery must not automatically resend. Cross-dyno exactly-once creation still requires a unique database key or durable lock.
- Shared-workflow follow-up: an intentional inbox heading change must enter its browser content comparison as well as source mappings. Assert the new heading explicitly while preserving every original figure and the immutable fixture.

## New pages must enter the CSS ownership checks (2026-09-13)

- Problem/root cause: per-page CSS guards covered manifest entries, but the runtime census did not fail when a new application page was omitted. Four reviewed training pages also lacked pointers to their existing browser suite.
- Solution/prevention: require every tracked application/served-archive page to be registered; require shared foundations and a real browser-test owner. Codex and Claude instructions point to one current authoring checklist. Keep the template aligned, stage new source before local census checks, and retain visual review instead of treating registry presence as certification.

## Shared form resets and print dialogs need explicit ownership (2026-09-12)

- Problem/root cause: an unlayered designer reset overrode layered form spacing; global keyboard shortcuts could consume modal field input, and timed print cleanup could remove content before the print dialog finished. Narrow size columns clipped fractional dimensions.
- Solution: keep resets in the reset layer, scope shared form styles at every real mount, let field/native-picker keys reach their target, and restore print state on actual print completion. Give dimension columns enough space and keep mobile fields in an explicit grid.
- Prevention: preserve original payload/artwork function bodies; exercise nested dialogs and native file chooser keyboard events, delayed print restoration, canvas resize/export, all four shared hosts, four widths, every scroll panel and all paper pages.

## Shared assistants must preserve complete-save and keyboard ownership (2026-09-12)

- Problem/root cause: the webstore assistant swallowed failed quote-item responses, retained a saved link after revised prices, and its inherited stylesheet exposed hidden feedback. Scrollable conversation content was not keyboard reachable.
- Solution: capture the save fingerprint and successful stages, show persistent incomplete-save feedback, retry unconfirmed items, invalidate revised quotes, guard editing/reset during saves and restore focus. Reuse the emblem assistant styles with canonical controls and keep notifications in the drawer flow.
- Prevention: unchanged price/card/email function locks and original successful payloads; partial retries, duplicate events, changed prices, four-width accessibility and complete three-page reference prints. A lost response still needs server idempotency for guaranteed exactly-once writes.


Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

## Seasonal renewal must keep stock, saved orders and confirmation separate (2026-09-12)

- Problem/root cause: Christmas color changes retained old sizes, floating controls hid selections, failed item saves reported success, and email fields dropped address line2 and thread colors.
- Solution: use canonical scoped styles and native controls; invalidate stock choices immediately and ignore obsolete responses. Capture one order before upload, track confirmed persistence and each email separately, retain failed drafts and retry unfinished stages. Save address2 and map the existing thread-color field.
- Prevention: compare original financial functions and successful payloads over24 combinations; mock every write and exercise stock failures, racing colors, upload/save/mail retries and duplicate pending calls. Review four widths and all paper pages; print native confirmations through an in-flow copy and restore the draft after printing.
- Limit: retry ownership skips acknowledged saves, but the legacy POST API has no idempotency contract for a lost acknowledgment. Do not claim exactly-once delivery. Campaign year is2026;2025 Freeman Road East remains the street address.

## Seasonal assets and order confirmations need real serving and persistence checks (2026-09-11)

- Problem/root cause: the awareness page pointed at a missing service; placing replacements beside its archived HTML would hit the intentional archive410 gate. The original order service swallowed item failures and claimed email delivery after rejection.
- Solution: keep the existing public HTML alias and archive tombstone; place the page assets in the public calculator mount. Capture one order, track confirmed session/items and both emails independently, retain partial progress for explicit retry, and expose upload/service failures. Preserve successful payloads and all original prices.
- Prevention: route current browser assets through the real local Express server; assert public asset bytes and archive410 responses. Keep filesystem-only original diagnostics separate. Compare original/current payloads, exercise partial failures and duplicates, and inspect all mobile/print states.

## Customer quotes need a captured calculation and independent delivery states (2026-09-11)

- Problem/root cause: customer-supplied screen print kept stale amounts actionable during debounce, mixed current prices into an older saved invoice/email, silently swallowed setup-item failures and claimed email success after failed delivery.
- Solution: invalidate on edit before any debounce/early return; scope price and tier responses; capture immutable financial/customer data for submission and print. Track confirmed session/item/setup stages and email independently so manual retries repeat only unfinished operations. A completed quote frees its identity for the next intentional submission. Native dialogs retain drafts and block duplicate pending submissions.
- Prevention: 396 immutable financial cases and exact shared engine/method locks; original request/email/invoice contents; retry each failure stage, delayed price/tier results, cancelled dialogs and short phones. External invoice CSS keeps notes and waiver together in a complete one-page quote. Captured HTML is rendered without opening the operating-system print dialog.

## Design saves must report complete persistence and keep retry ownership (2026-09-11)

- Problem/root cause: Safety Stripe used a modal class its CSS never opened, swallowed item-save failure as success, dropped the design note, and still claimed email delivery after email had been removed. Empty image sources also look failed before a choice is selected.
- Solution: native named dialogs and buttons, pending-save guards, persistent errors with retained drafts, reuse an accepted session when only its item needs retry, and save the note in the existing design detail. Say Design saved only after both writes succeed. Ignore empty image sources and clearly label genuinely missing previews.
- Prevention: capture original hidden-dialog and false-success defects without changing original CSS, compare all 64 design combinations and original request values, exercise partial retries, keyboard focus, clipboard failure and short phone dialogs, and review every paper page with warning/reference retention.

## Product caches and previews must describe current pricing and selection (2026-09-11)

- Problem/root cause: cached products retained old calculated prices and renewed their own age; failed inventory looked like zero stock, and delayed color/image responses could replace the latest selection. Failed product reads left placeholder prices visible.
- Solution: preserve the original cache timestamp, await current validated policy and recompute prices; distinguish pending/unknown stock, guard request generations, and show persistent failure or fallback notices. Native dialogs and radio controls retain keyboard focus; compact the printed contact block so it does not create a footer-only page.
- Prevention: compare all 64 original color/quantity results and exact financial bodies, byte-compare the downloaded logo, test cached policy changes with an explicit timestamp relative to the fixed browser clock, retry and response races, and review every screen and paper page. Keep the shared engraving renderer unchanged.

## Richardson selections and policy labels must describe the current quote (2026-09-11)

- Problem/root cause: typing a new style retained the old quote; suggestions required a mouse, delayed blur hid focused results, API failures silently used defaults, and fee captions stayed hardcoded. A new top-level CSS layer defeated canonical hidden utilities.
- Solution: clear selection immediately, use native suggestion buttons inside a named combobox dialog popup, retain focus ownership, validate all five reads and persist fallback warnings through print, and render captions from loaded fees. Keep page styles inside components.pages and allow natural paper pagination.
- Prevention: immutable 72-state financial/category contracts, independent exact financial method bodies, failed/incomplete reads, keyboard focus after the real delay, four widths, loaded branding checks and every paper page. Do not introduce a layer after utilities or accept broken-image captures as complete review.

## Specialty pricing references must remain usable in every state (2026-09-11)

- Problem/root cause: legacy phone CSS hid every emblem price; closed chat actions and idle confirmation appeared prematurely. A delayed textarea-focus callback moved focus after keyboard navigation or panel close. Print omitted collapsed references.
- Solution: preserve the full grid in a named keyboard scroll region, use canonical hidden/inert state, guard delayed focus against current panel ownership, and open/restore references only around print. Separate reference sections into complete paper pages.
- Prevention: exact original prices and intercepted request bodies, native Tab/Shift+Tab/Escape followed by the real delay, phone horizontal scrolling, hidden-state checks, and visual review of every PDF page.

## Contract calculators need one policy and visibility owner (2026-09-11)

- Problem/root cause: explanatory DTG fee labels and the reference footer stayed hardcoded after API policy changed; author display rules exposed contradictory hidden notices. Assistant focus escaped, and clipped screen-reader-only elements damaged printed headings.
- Solution: render labels from the existing loaded policy, preserve all price math, use canonical hidden controls and scoped shared styles, confine assistant focus, and omit screen-reader-only live regions from print. Compact row spacing keeps contacts with short price lists.
- Prevention: immutable source/value evidence; alternate API fees/minimums and failed reads; native keyboard and focus restoration; exact financial function bodies; actual paper review with nonzero synthetic staff costs that must never print. Use literal split/join or replacement callbacks when source edits contain dollar signs.

## Core calculator state and paper boundaries (2026-09-11)

- Problem/root cause: DTG/DTF color handlers read an undeclared currentStyleNumber; inline presentation duplicated CSS; fixed print headers covered prices, and the Embroidery product wrapper also contained pricing/inventory. Screen Print errors disappeared after10 seconds without recovery. Native arrow scroll began after an inventory refresh had replaced its region; search ARIA targeted an empty placeholder.
- Solution: use the displayed product style with CATALOG_COLOR, canonical scoped CSS and keyboard controls, complete table scroll regions, an independent product wrapper, static print headers and persistent dismissible pricing errors. Save keyboard horizontal movement synchronously before refresh; bind search to actual results and preserve Escape focus. Keep every financial function body and pricing service unchanged.
- Prevention: immutable original source/value contracts, exact financial function checks, every quantity/color/input path, keyboard focus after generated controls are replaced, failed inventory/pricing, and visual review of every paper page. Do not make whole long sections unbreakable.

## CRM UI recovery and print (2026-09-09, archived)
Full entry in LESSONS_LEARNED_ARCHIVE.md; preserve asynchronous view ownership and native dialog/table semantics.

Historical deployment, token, builder, junction, server split and proxy-auth migration notes are in LESSONS_LEARNED_ARCHIVE.md. Never recursively delete a worktree dependency junction.

Exact-source CI must pass its actual browser/parity jobs, including credentials when required; local green is not CI green. Resolved runner/secret incidents are in LESSONS_LEARNED_ARCHIVE.md.

Quote-operation access rollout (2026-09-07) is archived in LESSONS_LEARNED_ARCHIVE.md; caller/quote scope and live-mutation boundaries remain enforced by quote-sync-access.test.js.

## 2026-09-12: Background calculator rendering must not move keyboard focus

Problem: screen-print price initialization could steal focus from thumbnails or another control. Root cause: rendering the small-order quantity field scheduled a delayed focus callback, just like explicit tier selection. Solution: render the field without focusing during refresh, and focus synchronously for explicit tier selection. Prevention: preserve keyboard focus through initialization and check the correct quantity field after choosing a small-order tier.

Browser baselines must work from a fresh checkout. The tumbler export test previously depended on an ignored local original PNG. It now renders the preserved original controller in an isolated browser context and compares the actual download in the same browser, without changing immutable fixtures.

## Quick Quote must distinguish unavailable stock and fresh print state (2026-09-12)

- Problem/root cause: inventory errors disappeared; old async replies and cached rate-card markup could outlive the current selection. Layout rules exposed native hidden controls, and touch-height defaults orphaned paper footers.
- Solution: clear old stock before each lookup, check the request generation, show a persistent unknown-stock warning with retry, and print a rate card only after its content is rebuilt for the current request. Restore screen print state afterward; scope hidden, keyboard and paper rules to both Quick Quote pages.
- Prevention: preserve financial controller hashes and browser amounts; test failed-stock retry, keyboard price/quantity selection, failed rate-card preparation and narrow table scrolling. Visually inspect complete PDFs and long phone layouts; text assertions alone miss split currency and orphaned footers.


## Scoped reference pages need explicit print and failure modes (2026-09-12)

- Problem/root cause: shared navigation print rules hid the reference title; an old blanket contract-print rule hid ordinary pricing; a missing stitch response silently retained default fees.
- Solution: give the reference header an explicit paper display, distinguish active-tab/account/contract print modes, open and restore disclosures, keep reference cards together, and fail visibly when required pricing is missing.
- Prevention: preserve exact financial functions, exercise API rejection and recovery, and review complete PDFs alongside keyboard/dialog checks. Replace private customer initializers with synthetic records before test execution; never copy private controller data into a reversal ledger.


## Quote requests must acknowledge a confirmed save (2026-09-12)

- Problem/root cause: the fast request service ignored its database failure result and continued into email and the success screen; a submission handler relied on the implicit event target, so clicking its icon could bypass the button lock.
- Solution: require a successful database result before confirming or emailing, select and lock the actual submit button, retain fields on failure and provide persistent accessible validation/retry.
- Prevention: mock database rejection and retry, click both the button and its icon, assert one pending request and unchanged successful payloads; inspect narrow actions and every printed page.

## Shared quote documents must await their external styles (2026-09-12)

- Problem/root cause: document.write can report a complete document before linked print styles load; fixed print timers can open an unformatted quote. Chromium protocol interception also suppresses resource loading in these popup documents during tests.
- Solution: all four builders await the shared invoice generator's stylesheet/image/font readiness with a bounded visible failure. Invoice tests serve real local assets and route business fetches through the same synthetic handler before releasing protocol interception.
- Prevention: assert exactly one print after a delayed stylesheet, zero prints after a failed required stylesheet, original financial totals/payloads and full phone/paper layouts. Never weaken a missing-styles check to accommodate a test harness.

## Quote tables need ink and page-break checks (2026-09-12)

- Problem/root cause: DOM totals can be correct while narrow auto-sized columns split quantities or clip cents; grid cards can fragment into blank print frames.
- Solution/prevention: use explicit numeric column widths and scrollable screen regions, assert actual printed currency ink fits cells, and inspect every PDF page with customer/order groups kept together.

## Quote controls need complete column and field ownership (2026-09-12)

- Problem/root cause: screen-print empty rows spanned only 13 of 14 columns, so horizontal scrolling clipped instructions; generic input padding overrode shipping currency spacing. Hidden native ink radios and mouse-only expanders blocked keyboard operation.
- Solution: match both initial/reset column spans, use named shipping field styles with sufficient specificity, retain native focusable radios and reuse keyboard delegation for fees/order sections. Share artwork and customer controls with method-scoped layout rules.
- Prevention: assert far-right scroll geometry, numeric text/currency clearance, arrow/Enter/Space operation, exact original prices and saved fields, every paper page, and all embroidery scenes after shared-style changes. Assert timed notices immediately at their trigger before comparing four-width layouts.

## Notifications and runtime style ownership (2026-09-12)

- Problem/root cause: sample notifications repeatedly loaded icons and rendered behind the native cart dialog; narrow messages lacked a width bound. The runtime census missed stylesheet links embedded in template strings and mistook data-invoice-style for inline CSS.
- Solution: reuse the bundled icon link, render an accessible manual popover in the active dialog, bound/wrap the notification and retain focus; parse generated stylesheet links and distinguish style attributes from data attributes. Include every reviewed stylesheet in the actual expanded lint result.
- Prevention: exercise each notification type at four widths, real failed-stock add, focus, text escaping, timed removal and print hiding. Reconcile shared-source evidence against the same immutable baseline instead of changing its hashes.

## Server response templates need explicit style and escaping contracts (2026-09-13)

- Problem/root cause: blog styles referenced tokens their response never loaded; access notices interpolated raw staff names, and JSON-LD could close its script when a title contained HTML.
- Solution: serve canonical tokens/components and scoped blog/status styles; escape names as text and encode less-than signs in serialized JSON-LD. Authorization and HTTP/SEO behavior stay with the original callers.
- Prevention: preserve original response content, links and metadata; test malicious names/titles, anonymous and authorized gates, keyboard exits with unavailable CSS, four widths and every printed page. Keep reviewed server owners in the runtime census after closing their backlog entries.

## Faded action notices must leave keyboard navigation (2026-09-13)

- Problem/root cause: the garment designer hid notices only with opacity, leaving their action controls in keyboard navigation; a full browser run also sampled the fading text during a contrast scan.
- Solution: give dismissed notices an explicit hidden visibility state and honor reduced-motion preferences. Update old shared-safety checks to expect the now-migrated builder bodies.
- Prevention: test the fully visible notice with contrast checks at four widths, activate its action by keyboard, and verify both the message and action are hidden afterward. Retain immutable originals and run the entire application gate before deployment.

- Related capture rule: check expiring product-cart notices separately from multi-viewport page snapshots. Preserve their exact original text/link, visible contrast and keyboard dismissal before comparing permanent content. Original fixtures remain immutable; changing machine speed must not change the expected page contract.

## Inclusive customer pricing must preserve exact totals (2026-09-13)

- Problem/root cause: SCP floored its LTM share before multiplication; EMB/SCP PDFs read rounded DOM text. Saved customer views preferred base prices, and screen-print handoffs had no returned row ID.
- Solution: retain exact per-unit values for output, allocate saved row cents cumulatively, display billed totals/quantity and return the created product row. Keep API fees authoritative and display customer LTM inside unit prices.
- Prevention: real Quick Quote-to-builder numeric handoffs for every method plus cap puff/patch/back-only, small quantities 3/7/23/24/37, screen/PDF consistency, seven-row fractional cents and saved/customer-cart checks. Check a real supplier-photo PDF too: external images need the same-origin relay for canvas access even when HTML displays them. See QUICK_QUOTE_2026-09.md.

## Downloaded PDF layout is separate from print CSS (2026-09-15)

- Problem/root cause: Quick Quote's jsPDF download used plain text columns and a small image; changing website print CSS would not improve that downloaded file. Rough height estimates could also miss wrapped content.
- Solution: update the existing PDF renderer with measured table rows, flowing text, a local logo and appropriately sized image canvases; keep pricing in the shared document model.
- Prevention: inspect actual generated PDF pages and exercise long notes, multiple options, sampled quantities and setup fees. Preserve the caller's model, exact totals and original source estimate. No-quantity sheets must omit order totals.
