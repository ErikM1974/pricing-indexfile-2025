# LESSONS LEARNED

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

## Calculator references need complete field and paper ownership (2026-09-11)

- Problem/root cause: legacy price tables clipped rightmost size columns on paper; page-local print rules hid price-load failures, while broad class matching missed compound quantity-control classes.
- Solution: canonical fields on every quantity selector/input, focusable named scroll regions and selected-type state; scoped print table sizing and visible error banners. Preserve each amount, tier, fee and original financial transformation.
- Prevention: compare actual original/current values at four widths, keyboard-scroll all sizes, exercise failure and print-view restoration, and inspect every rendered page including long service lists and the contact footer. Keep headings with rows without making entire long categories unbreakable.

## Storefront quantity edits and scoped CSS (2026-09-11)

- Problem/root cause: the quantity debounce retained the previous successful price and size breakdown for350ms, while the quantity field had already changed; the email/cart controls could therefore reference the old quote.
- Solution: immediately invalidate prior requests, mark methods loading, clear totals/table and refresh handoff controls; retain the existing quantity normalization and pricing engines. A browser regression reconstructs the original defect and checks that the current page withholds price until the new sized result arrives.
- Prevention: readiness must match both selected quantity and priced sizes. Immutable screenshots taken mid-debounce record transient states; retain them as defect evidence and capture a separate settled contract.
- CSS lesson: an empty PostCSS selector list reads back as an empty selector string. Remove the rule explicitly before adding a page scope, or it can target the whole page. Keep drawer styles inside the drawer, test keyboard focus, and inspect every printed page for image overflow and footer-only sheets.

## Customer account requests must retain ownership and persisted state (2026-09-10)

- Problem/root cause: storage exceptions still reported Added; a successful batch cleared later additions; older color/minimum responses and request completion replaced newer UI; custom drawers/modals let keyboard focus escape.
- Solution: report write failure, remove only the submitted list prefix, protect pending rows, track response generations and restore/contain dialog focus. Keep failed requests and notes available for exact retry; unavailable minimums stay visibly unknown while the rep can still quote. After a confirmed send, failed storage cleanup retains only unsent rows in memory and shows Sent with a reload warning; never invite a duplicate request.
- Prevention: reproduce defects against immutable originals with delayed/rejected synthetic requests and unavailable storage. Keep pricing/date/quantity transformations unchanged. Inspect every paper page: complete descriptions, size labels with inputs, visible entered notes and no footer-only page.

## Customer and vendor status views must own pending requests and paper (2026-09-10)

- Problem/root cause: disabling Post did not guard Ctrl+Enter; late job errors escaped into the list, and pending note completion could reopen a prior job. Shared shell print rules hid branding; prefix class edits accidentally styled count labels as buttons.
- Solution: guard the pending note in the controller, retain drafts per job, use request generations and verify the selected job before updating UI. Native job buttons share one activation path. Reuse scoped components and preserve print headers, whole rows and complete totals.
- Migration guards must follow shared visibility/focus ownership and native controls; assert DOM semantics instead of class order or removed custom key handlers, while retaining real-browser hidden/keyboard/phone checks. A print-cancellation test must create an actual QA error (missing size), assert the confirmation and await its dismissal; missing-thread warnings do not block printing, and checking before an asynchronous print finishes is a false pass.
- Prevention: synthetic delayed/failure/retry/keyboard/late-navigation tests with exact original request bodies; compare class tokens exactly, preserve source hashes and fixed label-case exceptions, and visually inspect every paper page. Remove empty-space margins without changing preserved empty element contracts.

## Quote lists must retain failure and action ownership (2026-09-10)

- Problem/root cause: local filtering replaced failed-load feedback with an empty list; delayed inbound/date-window responses could restore obsolete rows. Native-dialog cancellation could not return focus to a trigger disabled before confirmation. Delete authentication recovery called a removed helper.
- Solution: retain load failure until a successful retry, clear dependent data and guard render generations. Claim action ownership before confirmation but disable the trigger only after acceptance; contain focus and preserve cancellation. Reject repeated pending sends/deletes and show expired-session feedback without retrying a write.
- Prevention: synthetic success→failure→filter→retry and reordered reads; keyboard/focus tests at four widths; blocked/expired/pending write tests and exact original payload comparisons. Verify one box label per page, quantities and IDs as well as total PDF text.

## Reporting freshness must describe the rendered result (2026-09-10)

- Problem/root cause: controllers caught API failures but resolved without a failure value, so Company Numbers labelled failed reads Updated and retained old totals, dates and charts. A recovered sample list kept its old error, and late revenue windows could overwrite a newer selection.
- Solution: shared controllers announce actual results (including direct Retry and fallback goals), clear dependent stale displays on failure, remove recovered errors, and render only the latest revenue request. The header distinguishes incomplete reads.
- Prevention: test initial failure and failure after success, recovery, partial comparison/fallback goals and delayed success/error with synthetic records. Preserve exact money/date-window results. Runtime SVG variables need a scoped alias when replacing the legacy theme; print checks must retain production amounts and blanks status that the old mobile cascade hid.

## Shared staff dialogs and print jobs (2026-09-10)

An afterprint handler must clear its fallback timer and remove only its own captured sheet; otherwise an old timer can delete the next document. Use page (not always) for modern break-before/after so box labels and rep reports actually separate in Chromium. Native dialog errors belong inside the dialog; guard obsolete previews and keep pending sends from closing or accepting duplicate actions. Mark lazy tabs mounted only when their delayed loader actually runs. Render PDFs with nonzero synthetic costs and multi-box data, check per-page identifiers and totals, and inspect white paper backgrounds.

## CRM UI recovery and print (2026-09-09, archived)
Full entry in LESSONS_LEARNED_ARCHIVE.md; preserve asynchronous view ownership and native dialog/table semantics.

Historical deployment, token, builder, junction, server split and proxy-auth migration notes are in LESSONS_LEARNED_ARCHIVE.md. Never recursively delete a worktree dependency junction.

Exact-source CI must pass its actual browser/parity jobs, including credentials when required; local green is not CI green. Resolved runner/secret incidents are in LESSONS_LEARNED_ARCHIVE.md.

Quote-operation access rollout (2026-09-07) is archived in LESSONS_LEARNED_ARCHIVE.md; caller/quote scope and live-mutation boundaries remain enforced by quote-sync-access.test.js.

## Record workspaces need current-response checks before secondary writes (2026-09-10)

- Problem/root cause: A stale linked quote can update the current lead after refresh; removed kit/art hosts can still receive asynchronous callbacks. Native dialog conversion and fixed banners can also lose focus or cover recovery controls.
- Solution: bind quote rendering and existing value sync to the current view sequence, lead object, quote ID and connected target. Reject malformed replies, ignore superseded loads, preserve uncertain outreach warnings beside the action, contain modal focus, and block all unknown API traffic in previews.
- Prevention: mock delayed responses and every write, verify unchanged valid quote sync and original payloads, reverse recorded controller changes into original source hashes, and retain explicit shared-module ownership. Inspect populated PDFs: narrow grids can split money; give the order table full width and verify every row and rendered page. Precompute file updates before writing so a missing preview anchor cannot leave a partial batch. Timestamp-based browser snapshots must set the baseline time zone explicitly; fixed Date.now alone does not standardize local date formatting on Windows and Linux.

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

## Method dialogs need explicit state and spacing (2026-09-12)

- Problem/root cause: DTF color controls kept aria-expanded true after selection; its distinct size-dialog body/footer and customer heading relied on removed legacy spacing. Long location names overflowed the phone summary.
- Solution: synchronize picker open/close attributes, give the method-specific size grid and footer canonical spacing, align the customer header and wrap summary values. Native location and shipping controls share the existing keyboard delegation.
- Prevention: compare original prices, fees, shipping and saved fields at four widths; test selection/Escape and native location keys, inspect complete size dialogs, every table column and all paper pages.

## DTG hidden states and printable controls (2026-09-12)

- Root cause: legacy flex/display rules exposed empty CRM notices, a design thumbnail without a design, expired share notifications and disabled assistant actions without quote output. Phone date fields and preflight values were clipped.
- Fix: shared hidden/notification contracts, native keyboard controls, wrapping customer values and full-width dates; compact method-scoped print controls retain every financial value.
- Prevention: test populated fees, locations, shipping, successful/failed saves and research-only replies against original fields/payloads. Inspect complete scroll areas and every printed page; assert intended hidden/disabled state before normalizing original visibility.

## Notifications and runtime style ownership (2026-09-12)

- Problem/root cause: sample notifications repeatedly loaded icons and rendered behind the native cart dialog; narrow messages lacked a width bound. The runtime census missed stylesheet links embedded in template strings and mistook data-invoice-style for inline CSS.
- Solution: reuse the bundled icon link, render an accessible manual popover in the active dialog, bound/wrap the notification and retain focus; parse generated stylesheet links and distinguish style attributes from data attributes. Include every reviewed stylesheet in the actual expanded lint result.
- Prevention: exercise each notification type at four widths, real failed-stock add, focus, text escaping, timed removal and print hiding. Reconcile shared-source evidence against the same immutable baseline instead of changing its hashes.

## Server response templates need explicit style and escaping contracts (2026-09-13)

- Problem/root cause: blog styles referenced tokens their response never loaded; access notices interpolated raw staff names, and JSON-LD could close its script when a title contained HTML.
- Solution: serve canonical tokens/components and scoped blog/status styles; escape names as text and encode less-than signs in serialized JSON-LD. Authorization and HTTP/SEO behavior stay with the original callers.
- Prevention: preserve original response content, links and metadata; test malicious names/titles, anonymous and authorized gates, keyboard exits with unavailable CSS, four widths and every printed page. Keep reviewed server owners in the runtime census after closing their backlog entries.

## Generated staff documents need physical geometry and readiness checks (2026-09-13)

- Problem/root cause: call sheets, mailing labels and thread sheets carried isolated CSS and printed on a timer or load event; blocked windows and missing assets could fail silently. An imported thread run was inserted as HTML.
- Solution: canonical tokens/components plus one staff-print sheet, with a shared promise for styles/fonts/images, visible failures in the parent and preview, and escaped thread text with validated color data. Keep Avery 5160 dimensions explicit in print media.
- Prevention: real-window ready/blocked/delayed/missing-file cases; preserve original addresses, amounts and source hashes; test each label at 2.625 by 1 inch, 0.125-inch column gaps and all 32 labels across two pages. Inspect every screen scroll segment and PDF page. Baseline replay must reverse newer print edits before older family edits.

## Customer print previews must wait for successful assets (2026-09-13)

- Problem/root cause: the customer-supplied quote printed on load and ignored image failures; narrow columns split numeric headings and phones clipped the table.
- Solution: reuse staff-print readiness, report blocked/missing helper/style/image failures in the preview and parent, and give the full table keyboard scrolling with unbroken numeric columns. Preserve the captured calculation, notes and waiver.
- Prevention: real popup tests with a local HTTP asset server, delayed and failed resources, zero OS printing, original amount/source locks, all four screen widths and both complete paper quotes. Protocol interception can stall document.write styles, so readiness tests serve deterministic assets directly.

## Cart removals need one notice and a remaining focus target (2026-09-13)

- Problem/root cause: the drawer added its own success toast after the service already announced removal, creating overlapping messages. Replacing the item list removed the focused button.
- Solution: keep the service notification as the single owner and focus the next removal control or drawer close button after successful removal.
- Prevention: both direct hosts, four widths, exactly one visible top-layer notice, exact remaining style, keyboard focus after first/last removal, timer cleanup and print visibility. Preserve the original source reversal ledger.

## Email themes need static output and preserved binding contracts (2026-09-13)

- Problem/root cause: four provider templates repeated typography/colors and fixed widths; generic table traversal spread section padding into nested data cells. Incremental inline serialization could drift on repeated builds.
- Solution: compile one ordered theme from canonical tokens into static inline output, mark only immediate card sections, and clear/replay theme-owned properties consistently. Preserve every variable, raw HTML slot, link and plain-text copy.
- Prevention: immutable original hashes/content, idempotent compiler checks, structural section bounds, four widths, long names, blocked images and every PDF page. Local Chromium review does not certify mail clients or publish provider templates.

## Faded action notices must leave keyboard navigation (2026-09-13)

- Problem/root cause: the garment designer hid notices only with opacity, leaving their action controls in keyboard navigation; a full browser run also sampled the fading text during a contrast scan.
- Solution: give dismissed notices an explicit hidden visibility state and honor reduced-motion preferences. Update old shared-safety checks to expect the now-migrated builder bodies.
- Prevention: test the fully visible notice with contrast checks at four widths, activate its action by keyboard, and verify both the message and action are hidden afterward. Retain immutable originals and run the entire application gate before deployment.

- Related capture rule: check expiring product-cart notices separately from multi-viewport page snapshots. Preserve their exact original text/link, visible contrast and keyboard dismissal before comparing permanent content. Original fixtures remain immutable; changing machine speed must not change the expected page contract.

## Inclusive customer pricing must preserve exact totals (2026-09-13)

- Problem/root cause: SCP floored its LTM share before multiplication; EMB/SCP PDFs read rounded DOM text. Saved customer views preferred base prices, and screen-print handoffs had no returned row ID.
- Solution: retain exact per-unit values for output, allocate saved row cents cumulatively, display billed totals/quantity and return the created product row. Keep API fees authoritative and display customer LTM inside unit prices.
- Prevention: real Quick Quote-to-builder numeric handoffs for every method plus cap puff/patch/back-only, small quantities 3/7/23/24/37, screen/PDF consistency, seven-row fractional cents and saved/customer-cart checks. Check a real supplier-photo PDF too: external images need the same-origin relay for canvas access even when HTML displays them. See QUICK_QUOTE_2026-09.md.
