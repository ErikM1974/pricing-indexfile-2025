# LESSONS LEARNED

Bug â†’ root cause â†’ fix â†’ prevention. Newest first. **Hard limit 300 lines** â€” archive the
oldest resolved entry to `LESSONS_LEARNED_ARCHIVE.md` once this passes 250.

---

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

### Training exercises: round lifecycle and saved progress (2026-09-08)

Problem: restarting bound handlers again, speed rounds graded the first answer, and old timers changed a new mode; blocked/malformed localStorage prevented startup. Root cause: DOM/event lifetime and round lifetime were mixed, while persistence was assumed available. Solution: bind once, reset the same instance, grade the current question once, cancel interval/delayed work on mode changes, use a wall-clock deadline, and validate saved progress with visible read/write failures. Preserve unreadable storage rather than overwriting it. Prevention: complete/restart rounds, switch modes with work pending, and test denied/malformed/readable-but-unwritable storage in a real browser.

### Reference search, disclosure and paper code need explicit contracts (2026-09-08)

Problem: reference descriptions disappeared on phones, ODBC tables were click-only and retry reloaded the page; font ligatures changed copied SQL operators in PDFs. Root cause: legacy shell rules, non-native disclosure, assumed-valid schema and programming-font contextual glyph substitution. Solution: shared scoped reference layout with native details, escaped raw-text highlighting, schema validation and retry preserving search; print the complete catalogue and restore filters, and disable ligatures/contextual alternates for code. Prevention: lock original catalog literals/schema/prose, test roles and keyboard/filter/failure states, compare every PDF field name and technical paragraph, and inspect actual paper operators.

### Guide and tracker migrations need their actual role and print state (2026-09-08)

Problem: guide contents disappeared on phones, bootstrap spacing vanished on paper, and tracker filters/retry assumed mouse input and a valid snapshot. Root cause: legacy framework utilities and shared test login assumptions. Solution: native responsive disclosure, explicit number spacing, typed filter buttons, validated snapshot with visible retry preserving search, and full-content print that restores screen state. Prevention: keep original policy data immutable, test real anonymous/staff denial separately from a local admin viewing session, verify actual contrast on colored panels, and compare PDF content as well as row counts.

### Policy readers and editors need separate state and print checks (2026-09-08)

Problem: SAML staff lost comment controls, failed editor loads could save empty content, phone contents had a clipped secondary scroller, and chart search/printing concealed collapsed teams. Root cause: browser-storage-only identity, editor state assumed ready, stylesheet load-order overrides, and missing disclosure/print contracts. Solution: use resolved identity, gate saving and parent choices on successful setup, put mobile rules in the actual page owner, synchronize search expansion, and explicitly print complete teams/chapters. Preserve TipTap's existing normalization rather than forcing byte equality after visual editing. Prevention: test failed saves/posts with exact draft preservation, blocked storage, all chapter links, missing sanitizer/editor, actual content following dividers, and populated PDFs with collapsed screen states.

### Public family migrations must preserve offer text and all stylesheet paths (2026-09-08)

Problem: borrowed campaign CSS hid navigation without its original controller, CSS byte audits missed a relative stylesheet link, and printed footers split onto a trailing page. Root cause: cross-page stylesheet dependencies and incomplete source/path/print accounting. Solution: one scoped family layout with native navigation and FAQs, resolve relative and root asset paths alike, preserve the entire original main text plus SEO/image/link data, and keep footer blocks together. Prevention: check every route alias, four widths and keyboard disclosures, then compare actual PDF offer/pricing/FAQ text and render paper samples.

Webstore follow-up: full hygiene checks also require cache versions on every new local CSS/JS reference. Add the reserved candidate version before full gates, including unchanged shared components newly linked into a page.


### Native storefront menus still need keyboard and layout ownership checks (2026-09-09)

Problem: the inherited drawer had no focus boundary or return, and initial native-dialog review found reverse Tab leaving the menu. Root cause: hidden custom panels and relying on browser traversal alone. Solution: native modal with explicit first/last Tab wrap, Escape/backdrop/close-button dismissal, return focus, desktop-resize cleanup; scope every CSS rule to unified ownership and merge repeated selectors. Prevention: run all fifteen brand pages at four widths, test both search triggers and empty input, lock original brand/SEO/product text, and compare rendered PDF text allowing CSS text-transform case changes.

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
