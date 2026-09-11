# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---


## Core calculator state and paper boundaries (2026-09-11)

- Problem/root cause: DTG/DTF color handlers read an undeclared currentStyleNumber; inline presentation duplicated CSS; fixed print headers covered prices, and the Embroidery product wrapper also contained pricing/inventory. Screen Print errors disappeared after10 seconds without recovery.
- Solution: use the displayed product style with CATALOG_COLOR, canonical scoped CSS and keyboard controls, complete table scroll regions, an independent product wrapper, static print headers and persistent dismissible pricing errors. Keep every financial function body and pricing service unchanged.
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

## CRM UI recovery and print (2026-09-09)

Use native disclosure buttons inside table cells; aria-expanded on ordinary table rows is invalid. Native dialogs must show operational errors inside their top layer and retain a usable retry. Guard delayed account/archive/quarter and category responses so a failed or newer view cannot regain stale figures. Search/view changes must preserve loading/error states. Test original card/table/detail/CSV hashes using exact page basenames (leads.html is also a suffix of unqualified-leads.html). Print must explicitly restore headings and summary counts hidden by generic shell rules.




Historical deployment, token, builder, junction, server split and proxy-auth migration notes are in LESSONS_LEARNED_ARCHIVE.md. Never recursively delete a worktree dependency junction.

Exact-source CI must pass its actual browser/parity jobs, including credentials when required; local green is not CI green. Resolved runner/secret incidents are in LESSONS_LEARNED_ARCHIVE.md.

Quote-operation access rollout (2026-09-07) is archived in LESSONS_LEARNED_ARCHIVE.md; caller/quote scope and live-mutation boundaries remain enforced by quote-sync-access.test.js.

## Dialog entrance contrast (2026-09-08, archived)
Whole-dialog opacity blended text into its background; animate position/scale only and sample mid-animation. Full resolved entry in LESSONS_LEARNED_ARCHIVE.md.

Transfer/Supacolor authentication migration (2026-09-08) is archived in LESSONS_LEARNED_ARCHIVE.md. Keep staff/vendor/customer boundaries and auth-before-large-parser checks; never infer identity from Origin.

## Training controls and printed guides need state/output checks (2026-09-08, archived)

Exercise state transitions and verify complete printed content. Full entry in LESSONS_LEARNED_ARCHIVE.md.

### Shared form styles and print pseudo-elements (2026-09-08, archived): inspect actual filled paper and scoped pseudo-elements. Full entry in LESSONS_LEARNED_ARCHIVE.md.

### Training state must survive every input path (2026-09-08, archived): preserve input/retry/storage behavior. Full entry in LESSONS_LEARNED_ARCHIVE.md.

Native storefront menu focus and paper migration (2026-09-09) is archived in LESSONS_LEARNED_ARCHIVE.md; existing keyboard/browser guards retain the contract.

### Staff reference data and paper need explicit failure states (2026-09-09)

Problem: partial service rows looked fully live, invalid bonus figures could render, malformed form lists looked empty, and screen breakpoints/large unbreakable cards wasted paper. Root cause: optimistic response shapes, fallback labels at response rather than row level, borrowed page CSS and screen rules applied to print. Solution: validate data, visibly distinguish API/mixed/fallback states, retry only dependent content, retain checklists, escape external labels/destinations, use focusable scrolling tables and screen-only breakpoints with compact print layouts. Prevention: preserve original prose/actions, test real existing page access, four widths/axe and failed/malformed/retry states, compare actual paper text including warnings, and keep retry controls off paper. Multiline tooling edits must normalize CRLF or assert replacements; check the resulting code.

### Sign-in and confirmation owners need honest state and paper checks (2026-09-09)

Problem: shared form arrangements initially omitted canonical field styles, infrastructure failures falsely displayed an email-sent state, and artwork pushed receipt contact details onto a trailing sheet. Root cause: class ownership, treating all HTTP responses as success, and screen spacing inherited by print. Solution: canonical fields/shared access shell, generic outage errors preserving the email for retry while keeping successful known/unknown accounts identical, and compact print spacing with empty artwork regions hidden. Fulfillment controllers, totals and server shipping promises remain unchanged and hash-locked. Prevention: exercise keyboard/invalid/pending/rate/network/outage/sent states with all writes and emails blocked, inspect paper with actual artwork fixtures and compare every content block. Preserve line endings in scripted registry edits so removing a line cannot merge an adjacent entry into a comment.

### Catalog discovery must distinguish failed data from absent products (2026-09-09)

Problem: missing logos left unnamed tiles, failed product batches could appear as verified absent products, and intrinsic grid images overlapped card labels on paper. Root cause: image-only interaction, unchecked response shape, and print grid intrinsic sizing. Solution: named native links, validated batches with explicit retry preserving filters, server price labels retained verbatim, and contained images with separate label flow. Move shared navigation without duplicating it; preserve every curated style/category/brand description. Prevention: test keyboard, malformed/partial/empty/retry states and escaped server labels; assert image-to-body print geometry and compare every PDF text block. Browser review blocks all business writes and emails.

### Campaign inquiries must be received before confirming success (2026-09-09)

Problem: the golf form cleared entered details and sent a customer confirmation even when saving and sales notification both failed; malformed catalog data could also leave sample pricing loading forever. Root cause: all-settled delivery results were logged but never gated the receipt, and initial response shape/loading regions were unchecked. Solution: show success only after storage or sales notification accepts the request, send customer confirmation afterward, preserve inputs on total failure, show confirmation-email failures separately, and stop both catalog/sample loaders on invalid data. Prevention: exercise storage/lead/customer failure combinations and retry with the same values; preserve financial helpers and underlying services. For CSS, validate every token against actual page owners and inspect rendered paper: white text can survive PDF extraction while being invisible, narrow grids can wrap money, and flex list text can split into unintended columns.

Campaign verification follow-up: a runtime census timed out under the full suite. Reuse one inert DOM parser for attribute-only HTML inventory; compare the entire report before/after and keep the deadline/coverage unchanged.304 documents produced a byte-identical531123-byte report,18.31s to13.51s in the measured standalone runs.

### Shared CSS migration must preserve responsive and interaction ownership (2026-09-09)

Problem: consolidating repeated .stk-card selectors moved desktop grid placement after the mobile media query, making tiny phone columns; legacy and shared menu handlers also toggled the same disclosure twice. Root cause: deduplication ignored cascade order, and both controllers owned aria-expanded/visibility. Solution: base geometry precedes responsive rules; the instant pages bypass legacy disclosure/mobile adapters and use existing shared native owners. Financial/submission/artwork code remains source locked. Prevention: real four-width geometry/axe and open/close/resize keyboard checks, every published sticker row and banner preset, retained upload/draft retry, and full paper text plus visual inspection. A clipped screen-reader caption needs an explicit visible print arrangement; shrink optional paper chrome without dropping original content.

## Paper-like form layouts need a separate phone arrangement (2026-09-09)

Problem: the quote request inherited line-oriented paper styling that pushed the project textarea beyond the phone viewport. Root cause: its legacy field row and width rules survived in an online customer form. Solution: canonical vertical fields and bounded grid columns; shared hosted-form wrappers, native keyboard upload and explicit page landmark names. Prevention: check actual control bounds at320/390/768/1440, source-lock serialization and lookup/upload helpers, exercise blocked embeds and retained draft retries, inspect every reference-PDF page. The lookup helper floats popups only on printable forms; anchor the public form menu absolutely to its input and assert its coordinates, not just visibility. Keep mock routes installed across fixture-state transitions: removing them between navigations can allow in-flight requests to reach a live API. Keep department colors tied to ownership: monogram is shop-floor blue, digitizing Ruth purple, purchasing Bradley slate.

## A reviewed page wrapper is not a reviewed external app (2026-09-09)

Problem: the CSS census omitted Jotform scripts and its external-owner backlog named only three Caspio pages. Root cause: provider recognition did not match the currently loaded embeds. Solution: recognize Jotform and explicitly retain vendor-owned UI as pending even after its surrounding page is reviewed. Prevention: lock live embed IDs/URLs, test wrapper boundaries with login/table/empty/failure fixtures and block all real provider writes; do not describe synthetic fixture coverage as validation of a vendor app. Check DESIGN_COLOUR_CODE before mapping an inherited palette: announcement admin tools are neutral; legacy maroon does not make them AE-owned.

## Transient notifications need deterministic contrast checks (2026-09-09)

Problem/root cause: a DTG service outage exposed white text on an amber toast (3.18 contrast); the notification was absent on healthy runs. Solution: use existing dark warning/success tokens and render all four real toast types in the accessibility check. Prevention: wait for their final painted state, test transient failures deliberately, and inspect each builder’s actual style owner. The other three builders have a separate warning foreground; pricing and notification behavior remain unchanged.

DTG test follow-up: initial product hydration can replace a number input between automated focus and text insertion. Set the value and dispatch its actual input event atomically using the shared test helper, then assert the row quantity before waiting for pricing. Keep real pricing reads and mocked writes; never relax the positive-money guard.

## Monitoring data needs complete responses and visible persistence failures (2026-09-09)

Problem/root cause: malformed usage could appear as zero, partial schema could mark tables gone, and local review storage assumed every read/write succeeded. Solution: validate complete responses before rendering, preserve snapshot evidence and notes, distinguish unknown from zero, show export/retry paths and clear only recovered errors. Prevention: exercise malformed/partial/denied storage and successful recovery with synthetic records, preserve the original snapshot, and inspect current-value PDFs. Print long reports in block flow; inherited flex/min-height can create a blank trailing sheet even when PDF text is complete.

## Local file tools need dependency errors and native download evidence (2026-09-09)

Problem/root cause: missing transform/parser globals could leave conversion stuck, malformed FTP rows looked like valid files, and a download mock observed no request even when the browser saved the file. Solution: validate dependencies/listings, show visible errors with the file retained, and test browser-managed attachments using an isolated loopback CSV server. Prevention: compare actual download bytes/queries and converted SKU/prices for CSV/TSV/XLSX; preserve pure financial transforms. Use canonical data-table classes as well as scrolling wrappers; check current-value paper text and geometry, not text extraction alone.

## Purchasing views must distinguish missing ledgers from zero balances (2026-09-09)

Problem/root cause: incomplete invoices looked empty, failed import logs were classified as loaded, delayed requests could replace newer selections, and partial printouts dropped failed lookups. Solution: validate source shapes, keep unknown status and disable unsafe actions, invalidate old responses, and print failure notes with complete invoices. Prevention: test malformed/empty/failed/recovered feeds, mock confirmation and exact CSV bytes, preserve pure money/CSV helpers and AE compatibility. Declare CSS sublayers after primitives; check money widths at768 as well as phones, and inspect all printed line-item columns/current filter values. Optional paid-status sync needs its own visible fallback state.

### Photo failures must survive filtering (2026-09-09)
- Problem: malformed 200 replies looked empty, failed refreshes retained stale counts, and manage action errors appeared inside a hidden upload step.
- Root cause: unchecked response defaults, filters rerendered cached rows, and unrelated controls shared a status host.
- Solution: validate complete photo responses, clear counts to unknown until success, guard late reads and give manage actions a visible status. Confirm mutation success explicitly.
- Prevention: synthetic browser cases cover failure/filter/retry, native file compression and request payloads; original upload and URL helpers remain source locked.

### Caspio design reports need actual provider boundaries (2026-09-09)
- Problem/root cause: simplistic fixtures missed nested source definitions and generated unlayered ID styles; the existing digitized mobile form hid its fields. Provider replacement also detached the archive sticky observer.
- Solution: keep original field names and handlers, hide only the cloned source definitions, rebind replaced forms, and isolate77 exact provider exceptions from the zero-exception local owner (275flags retired). Failed/empty searches clear loading without conflating errors with no results.
- Prevention: real read-only searches verify provider markup; synthetic tests reproduce nested records, all select options, mobile precedence, pricing tiers, clipboard denial and current-value paper output. Match print exceptions by selector/property AND media context. Preserve six original controller/helper hashes outside31 recorded UI edits.

## Preview tools must preserve exports and ignore hidden canvas sizes (2026-09-09)

- Problem/root cause: late tumbler images replaced newer selections, malformed catalogs looked empty, and moving a canvas onto ResizeObserver caused a zero-size redraw while printing. Print rules moved before later screen rules stopped hiding the workspace.
- Solution: invalidate prior selected-image requests, clear stale preview and disable downloads while loading, provide retries, skip hidden/zero-size stage redraws, and order print rules after screen layouts. Native inputs and scrollable stats remain keyboard reachable; dialog focus returns to the rebuilt thread control.
- Prevention: compare five actual PNG downloads byte for byte, retain eight original script hashes outside mapped UI edits, verify complete approval text and each PDF page, exercise four widths and delayed/failing responses. CSS text-transform can change innerText casing without changing source copy; compare DOM text and inspect paper separately.

## Product detail views must distinguish sizes from warehouse stock (2026-09-09)

- Problem/root cause: inventory omitted APP_CONFIG; its size-run endpoint returns source sanmar-bulk with placeholder zero totals, which the old renderer called out of stock. Discovery hid partial failures, audit reused prior results after failures, and a pending color response could replace the selected stock view.
- Solution: load the existing config, label unavailable warehouse quantities honestly, validate complete responses, clear stale results, provide retries, ignore superseded reads and keep unavailable SanMar comparisons unknown while exposing internal Caspio drift. Pure API/stock/TSV helpers stay unchanged.
- Prevention: preserve seven original script hashes outside32mapped UI edits; compare all warehouse values and four clipboard outputs. Check four widths, denied clipboard and actual provider response shape. Printing relatively positioned images inside clipped cards can omit later-page pictures: use static image containers/visible overflow in print, verify all11 rendered images plus every original data word. Browser tests must wait for a debounced filter before recording and clicking a choice.

## Financial reports need complete data and faithful paper output (2026-09-09)

- Problem/root cause: quote audits defaulted missing comparison fields to zero/OK and truthy fallback replaced valid zero subtotals with older session values; table sorting required a mouse. Shared table sizing also wrapped amounts mid-number on phones.
- Solution: validate the full saved comparison, surface errors/retry, preserve explicit zero with nullish fallback, use native sort buttons with aria-sort, and let complete numeric columns scroll. The generator owns Pricing Analysis markup and chart proportions; private financial JSON stays in memory.
- Prevention: reverse mapped UI edits to original source/data hashes, compare all42rendered tables, test auth/empty/failure/zero/fallback states, and verify every printed page against original visible data. PDF text extraction can join words across hyphens; normalize punctuation while retaining every numeric token. Respect named CSS page size in PDF capture and check print rules after screen rules.

## Record workspaces need current-response checks before secondary writes (2026-09-10)

- Problem/root cause: A stale linked quote can update the current lead after refresh; removed kit/art hosts can still receive asynchronous callbacks. Native dialog conversion and fixed banners can also lose focus or cover recovery controls.
- Solution: bind quote rendering and existing value sync to the current view sequence, lead object, quote ID and connected target. Reject malformed replies, ignore superseded loads, preserve uncertain outreach warnings beside the action, contain modal focus, and block all unknown API traffic in previews.
- Prevention: mock delayed responses and every write, verify unchanged valid quote sync and original payloads, reverse recorded controller changes into original source hashes, and retain explicit shared-module ownership. Inspect populated PDFs: narrow grids can split money; give the order table full width and verify every row and rendered page. Precompute file updates before writing so a missing preview anchor cannot leave a partial batch. Timestamp-based browser snapshots must set the baseline time zone explicitly; fixed Date.now alone does not standardize local date formatting on Windows and Linux.

## Personalization lists must retain failed-load state (2026-09-09)

- Problem/root cause: after a failed refresh, search/status changes rendered old monogram or roster data and removed Retry; missing roster arrays looked like zero records.
- Solution: clear prior records/counts when loading, validate list arrays, preserve the error while filtering, and accept only the latest request before rendering. Current filters apply after a successful retry.
- Prevention: synthetic failure/filter/retry, missing-list and out-of-order success cases must exercise the actual controls; wait for debounced handlers before judging output. Keep original rows, field values and controller/service source hashes outside mapped UI/recovery edits.

## Personalization forms must preserve saved details and complete paper output (2026-09-09)

**Problem:** Saved catalog styles reopened blank; custom styles interrupted loading, and editing manual styles threw. Wide roster printouts clipped garment/custom columns.
**Root cause:** The loader populated only the custom dropdown path although saved forms create manual inputs; subsequent handlers assumed every style control was a select. The editable roster table was wider than the printed page.
**Solution:** Restore saved styles and custom flags in manual rows, clear prior lookup constraints, guard dropdown-only handlers and retain flags through row rebuilds. Render the active roster group on paper in bounded column sections with repeated identities/headings, using existing descriptors and unchanged size-breakdown output.
**Prevention:** Test catalog/custom round trips, row rebuilding, editing and loading after another order. Check narrow layouts, complete PDF values and multi-page headings; use the shared dialog lifecycle with native dialogs for keyboard focus and scroll restoration.

**Personalization recovery follow-up:** Validate roster arrays before replacing current data; obsolete load/search/OCR/save responses must not change a newer view. Keep failed loads inert with visible retry, clear canceled OCR UI and preserve keyboard file access. Save success must match the API envelope; lock duplicate submissions and scope acknowledgments/navigation to the originating roster. Original native CSV and payload comparisons plus rejection/race tests prevent silent drift. Validate Excel groups/rows before replacing data; ignore obsolete files/views and imports preceding a save. Collect unsaved cells before adding a group; keep required-input errors inside native dialogs. Monogram ItemsJSON and save IDs/HTTP status must be validated before replacing names or clearing dirty state. Picker label clicks already dispatch native checkbox clicks; never toggle both. Return focus after Done/Escape, keep retry errors in place and preserve original proof fonts/colors when removing global print overrides.

## Staff tools must capture saves and distinguish failed refreshes (2026-09-10)

- Problem/root cause: late pricing/stock and image uploads could apply to a newer editor; product filtering hid failed loads, and unknown stored categories disappeared from the select.
- Solution: bind async reads to the current record/selection, capture save payloads before awaiting, hold editing controls while saving, retain freeform stored categories and show explicit list retry with unknown counts. A failed refresh after a successful save is a load error; an uncertain write must not claim nothing changed.
- Prevention: compare original price tables, successful payloads and PDF text; mock delayed reads/uploads and every write, test pending double-submit, preserve locked fields after failure, and verify vendor arrays against the builders. Inspect actual phone controls and every paper page; source comments naming tests are not evidence those tests exist.

Staff-tool follow-up: distinguish successful blog writes from failed canonical reloads and retain published slug locks; previews must belong to the latest body text. Reversal ledgers need unique full tags, not generic replacements such as hidden. Normalize selector whitespace when consolidating duplicate CSS, and inspect PDF backgrounds/focus rings as well as extracted text.

Portal follow-up: scope delayed ledgers/calculations to their customer and invalidate each loop after a view change. Hold pending financial actions and display feedback inside the active dialog. Printing closed details can omit lines; render a plain paper copy, preserve screen disclosure state and keep modal print flow block-based. Repeated monetary values can conceal missing columns in whole-document text checks: verify amounts per page and inspect freshly named PNGs tied to the PDF hash. Read UTF-8 fixtures explicitly in Windows Python.

Mailing/Past Due follow-up: failed or incomplete lists must remain unknown through filtering; missing rep groups cannot imply all clear. Hold form and outreach controls during pending requests, keep uncertain-write wording honest, and fail closed in preview stubs. Compare native CSV/label markup and per-page money; carry omission warnings from the board into repeated printed headings. Canonical visibility comes from components.css, and native file buttons/shared UiDialog replace legacy label/overlay mechanics: update structural guards while retaining browser behavior checks.

### Drain-Pro tab ownership (2026-09-10)
- Problem/root cause: switchTab relied on the browser global event, so a direct call could fail or clear both panels. Solution: resolve the target by tab ID before changing state; explicit selected/hidden semantics and arrow/Home/End navigation. Prevention: synthetic click, keyboard, direct-call and invalid-target browser checks; provider URLs stay unchanged.

### Production schedule controls and paper (2026-09-10)
- Problem/root cause: mobile rule cards kept a 240px minimum, header ghost links lost contrast on navy, detail dialogs did not contain focus, and 44px screen buttons expanded paper rows. Solution: bounded responsive grids, shared solid controls, inert/focus/scroll restoration and separate print row heights. Prevention: original/current ten-employee and four-department comparisons, four-width axe/scroll checks, modal keyboard tests and one-page PDF locks. Preserve data.js and policy prose; CSS case changes are presentation only.

### Payroll upload ownership and cut-apart slips (2026-09-10)
- Problem/root cause: changing the document while its upload/poll was in flight allowed a late response to restart the abandoned read. Solution: a generation and job check at every async boundary, with busy state beginning before file reading. Prevention: delayed synthetic upload/poll cancellation tests and unchanged import payload locks.
- Shared screen line-height overflowed slip footnotes, while legacy 3.333in rows plus a border pushed six slots onto two pages. Keep paper line-height explicit and rows at 3.32in; verify all values, flags and footnotes plus six slots on one Letter sheet.

Release-check follow-up (2026-09-10): update legacy integration expectations when a shared consumer adopts native dialogs, export/import failure-fixture constants explicitly, and give each local browser run exclusive ownership of its server. A reused server dies when its owning suite exits. Size CI from measured end-to-end duration while retaining short setup timeouts.

Build-verification follow-up (2026-09-10): ESM bundle hashes can differ across Windows and Linux even when compiled code matches, because their linked source maps differ. Read the deployed asset manifest; verify compiled bodies after only source-map-reference/line-ending normalization, and validate every mapped source against the exact release commit. Do not treat a guessed local bundle filename404 as a broken live page.

Calibration follow-up (2026-09-10): keep saved-layout failures visible while allowing copy-only review, bind late photos to the selected view, and hold editing during writes. Size the overlay as fractions of a shared photo frame: pixel offsets from screen layout drift when paper resizes the image. Check actual paper alignment as well as saved-coordinate equality; only use declared palette tokens and canonical field classes.

Records Admin follow-up (2026-09-10): record original successful writes/CSV before changing controls; a saved session plus a failed item write is partial success, never complete. Retain load failure through filtering, hold pending actions and use saved data for status rollback. Native dialogs need explicit Tab containment. Give phone dates enough width and avoid shared heading aliases that hide print titles. Use split/join or a replacement callback for literal source rewrites: String.replace replacement strings interpret double dollar signs and can remove visible currency from template literals; original content locks catch this.

Box-label follow-up (2026-09-10): a failed/new lookup must clear old printable data. Capture a draft key and serialized payload before a lookup changes state, flush it on pagehide, and warn if local storage fails. Hold the arrangement while refreshing/printing, scope Print anyway to its lookup, and reject incomplete refreshes. Repacking invalidates affected verification marks; provide a keyboard move for one-piece lines as well as multi-piece splits. Compare every paper page and original allocation, not only aggregate totals.

### Staff home visibility and keyboard ownership (2026-09-10)
- Problem/root cause: a display rule defeated Everything's hidden rows; welcome cleared inline display but retained hidden; Directory rendered an old search before clearing it, and a pending roster looked empty.
- Solution: one scoped layout plus canonical hidden state, explicit welcome visibility, clear-before-filter ordering, and render open roster views when the read settles. Keep a separate library link outside summary, focusable directory scrolling and a real active descendant for palette selection.
- Prevention: preserve original roles/links/values, distinguish loading/empty/failure, exercise reload/pins/disclosures and keyboard search at four widths. Historical UI fixtures still consume the legacy dashboard sheets; remove production links without breaking those fixtures.

### Hosted employee lists need a bounded page and usable fallback (2026-09-10)
- Problem/root cause: a wide provider table expanded the whole phone page; shared controls were duplicated by Bootstrap and two local sheets, and failed embeds left blank space.
- Solution: share the wrapper owner and canonical controls, give the provider a labelled keyboard-scroll region plus an always-available direct destination, and keep provider markup/approval behavior externally owned. Remove focus outlines only on paper.
- Prevention: original source/provider locks, wide DOM and iframe fixtures, delayed/failed/login/empty states, narrow-screen axe and every PDF page. Allow exact static font/icon CSS reads before rejecting other fetches in axe-aware mock handlers; use declared tokens such as radius-pill.

### Customer invoice PDF exports need their own geometry and failure cleanup (2026-09-10)
- Problem/root cause: PDF action was enabled before loading and failed silently; resized capture viewports clipped exports, scrolled phone captures were blank, and html2pdf kept an invisible blocking overlay after rendering failed.
- Solution: enable after successful render, offer visible load/PDF retry, use an independent paper clone with explicit canvas scrollX/scrollY zero, and remove only the failed worker’s overlay. Keep financial values and date-only parsing unchanged.
- Prevention: record original fields/amounts/links, test actual desktop and scrolled-phone downloads, raster ink/logo checks, real library failure/retry and every rendered PDF page. A successful download event is not proof that the invoice is visible. CSS scale tokens are not uniform multiples: space-8 is64px, not32px; validate every variable against the actual token file.

### Compact invoice state must survive refresh and print (2026-09-10)
- Problem/root cause: share links lost k, URL/storage flags exposed staff controls, one-way hiding and cached storefront blobs kept stale addresses/art, carrier overrides preceded terminal shipment state, and print display rules forced RUSH onto every invoice.
- Solution: verify server identity, preserve quote tokens, reset optional fields/caches per full load, separate tracking links from send controls, guard pending actions and terminal shipments, use shared hidden state and named native dialogs with explicit trigger-focus restoration.
- Prevention: original source/money/payload locks, fresh-versus-refreshed fixtures, delayed/failure/retry/duplicate cases, actual rush/cancelled paper, radio-group keyboard order and visual service-label review. Native showModal moves focus before shared helpers can capture the trigger; capture the trigger beforehand.

### Quote documents need calendar dates, server identity and complete paper (2026-09-10)
- Problem/root cause: invoice links dropped quote tokens, stale storage exposed staff controls, UTC parsing shifted requested calendar dates, and failed supplemental/sync reads left silent stale information. Wide tables hid money/sizes on phones and whole-table print avoidance created empty paper.
- Solution: retain k through navigation, verify current server identity, format only calendar business dates locally, retain refresh warnings through print/retry, use labelled mobile cells, row-level paper pagination and native named dialogs with explicit focus return. Pending financial actions reject duplicates and expose errors inside the active dialog.
- Prevention: freeze original values, request bodies and source hashes; compare rendered totals (the renderer replaces initial placeholder IDs), all four widths/axe, delayed/error/retry/keyboard paths, actual lazy art imports and every PDF page. Keep shared builder-print and garment-form owners unchanged until their other consumers migrate.

Control-class follow-up: regex word boundaries treat hyphens as separators, so sw-action-btn falsely matches a check for the canonical btn class. Compare whitespace-delimited class tokens, assert real rendered target sizes, and inspect staff toolbars as well as public actions.

### Cart text, storage and pending saves need explicit boundaries (2026-09-10)
- Problem/root cause: stored garment names and checkout errors rendered as HTML, failed removals threw without a visible message, and the save trigger reopened a form while its previous save was pending.
- Solution: escape rendered text/attributes without changing payload values; retain the cart with a focused storage error; guard and disable pending save entry points.
- Prevention: immutable pricing/payload contracts plus harmless stored-markup, quota-error/retry and delayed duplicate-save browser probes. Artwork fieldsets need min-width:0 on phones; printed fields need matching control specificity, complete text/file references and review of every PDF page.

### Confirmation timers need scheduling room in browser checks (2026-09-10)
- Problem/root cause: a4.2-second UI toast occasionally exceeded a5-second test wait with three browsers active. Solution: allow10 seconds while still asserting the real dismissal; application timing stays unchanged. Prevention: compare immutable values after transient confirmation clears and repeat the failed case under the original worker load.
- Redirect follow-up: a product401 navigates to sign-in while the harness waits for fonts. Wait for the expected login document to load before page evaluation; catching a destroyed execution context or retrying the whole test hides the race.

### Heroku Git must use the trust store that verifies its certificate (2026-09-11)
- Problem/root cause: the corporate OpenSSL CA verified GitHub but rejected git.heroku.com before upload. Solution: verify ls-remote with the Windows schannel backend, then use the same backend and sslVerify=true for the push. Prevention: never disable verification; prove the prior slug is unchanged after a transport failure, then verify the actual release, source assets and access after resuming.

### Custom storefront recovery and paper must preserve the draft (2026-09-11)
- Problem/root cause: Retry was registered only after successful boot, storage quota failures were silent, nested gallery controls swallowed keyboard activation, and custom summary sheets let focus escape. Fixed bars and trailing layout space broke paper.
- Solution: wire Retry before requests, expose storage failure while retaining values, use native buttons/dialogs, mirror complete entered fields for print, and move contact information beside the letterhead with exact afterprint restoration.
- Prevention: compare immutable prices/payloads, exercise first-load failure and quota recovery, verify background focus is inert (native Tab may reach browser chrome), and inspect every actual PDF page for missing notes, split totals and blank trailing sheets.
