# Server split — server.js → routes/<domain>.js (started 2026-09-07)

**Why.** `server.js` was one 15,947-line, 822 KB file with 455 Express registrations, 244 of them under `/api`.
It worked and it was guarded by 4,700 tests, but nobody can review a route in a file that size, and Erik asked
for the code to reach an A-: "split the server into routes". This is the log of that split.

**The rule that makes it safe.** Express walks its stack in registration order, so that order IS behaviour: a
middleware registered after a route never runs for it; two overlapping paths resolve to whichever came first.
Every cut therefore moves a CONTIGUOUS section of the file byte for byte into `routes/<name>.js` and registers it
from the same position with `{ const ctx = { … }; require('./routes/<name>')(app, ctx); }`. Nothing is reordered,
no handler body changes, and `tests/unit/server-route-table.test.js` proves it: the table of every registration
(method, path, middleware) must equal `tests/fixtures/server-route-table.json` after every cut. A deliberate route
change updates the fixture (`node scripts/server/route-table.js --update`); the fixture diff is the review artefact.

**The tools** (`scripts/server/README.md`): `route-table.js` (the lock), `extract-section.js` (the cut — parses with
espree + eslint-scope, computes the section's real dependency surface as `ctx`, and REFUSES a cut that would change
behaviour: a helper the rest of the file uses, a mutable variable assigned across the boundary, a constant declared
below the section). `tests/helpers/server-source.js` gives the text locks the server as one text again.

## Section map (line numbers as of the start; the ROUTE TABLE OF CONTENTS at the top of server.js is the source)

| Section | Lines | Registrations | Status |
|---|---|---|---|
| AI chat forwarders | 4549-4642 | 3 (one loop) | ✅ `routes/ai-chat.js` (`.22`) |
| 253GEAR publisher | 4643-4837 | 14 | ✅ `routes/gear-publisher.js` (`.22`) |
| Blog + sitemaps + static | 4838-5455 | 51 | ✅ `routes/blog.js` (`.22`) |
| Quote delete + push previews + quote_items/analytics relays | 12804-13180 | 14 | ✅ `routes/quote-delete.js` (`.22`) |
| Public quote view | 13181-13252 | 6 | ✅ `routes/public-quote.js` (`.22`) |
| Banner presets | 13253-13324 | 1 | ✅ `routes/banner-presets.js` (`.22`) |
| Staff SAML | 3268-3419 | 16 | ✅ `routes/staff-saml.js` (`.23`) after hoisting `PORTAL_ADMIN_ROLES` |
| CRM API proxy | 3420-4481 originally | 60 | Extracted to `routes/crm-proxy.js`; shared access/cache and Box helpers remain in server.js. See the CRM cut below. |
| Vendor portal | 6555-7090 | 12 | ✅ `routes/vendor-portal.js` (`.23`) after hoisting `BOX_THUMB_RE`, `PORTAL_FETCH_TIMEOUT_MS`, `PORTAL_PROXY`, `portalProxyGet` |
| Customer portal | 7091-10407 | 58 | ✅ `routes/customer-portal.js` (`.23`, 3,242 lines) after hoisting `API_BASE_URL`, `makeApiRequest` |
| Online order form + ShopWorks | 10408-12626 | 45 | ⏳ the other agent's hardening edits the cart routes here — cut after it lands (`SYNC_PROXY_BASE` already hoisted) |
| Quote data plane relays | 12627-12803 | 6 | ✅ `routes/quote-plane.js` (`.23`) after hoisting `quotePlaneWriteLimiter`, `quoteScopedOrStaff`, `originalQueryString` |
| 3-Day Tees / custom tees / caps helpers + routes | 1956-3220 | many | ⏳ not yet analysed |
| Infrastructure (security, session, limiters, health) | 1-1955 | ~40 | stays in server.js (it IS the composition root) |
| Everything after 13324 (quote sessions, ShipStation, cart, pricing pages, static) | 13325-15947 | ~170 | ⏳ not yet analysed |

**Prep the refusals need** (one small, behaviour-neutral commit): move the shared constants (`CRM_API_BASE`,
`CRM_API_SECRET`, `PORTAL_ADMIN_ROLES`, `BOX_THUMB_RE`, `PORTAL_FETCH_TIMEOUT_MS`, `API_BASE_URL`,
`SYNC_PROXY_BASE`, `quotePlaneWriteLimiter`) into one "shared config" block above the first section that uses them.
They are env reads and literals (one `rateLimit()` call); moving a declaration up cannot change a value.

## Coordination rule (learned 2026-09-07)

Only one agent edits `server.js` at a time. The first cut collided with another assistant's uncommitted hardening
change in the same tree; the cut was backed out, that change was set aside in a git stash, the cut redone on the
clean tree, and the stash restored after the deploy. Two agents committing from one tree ship each other's
half-finished work — and a `server.js` committed with call sites but without `routes/` would not boot.

## 8. Progress log (newest first)

### 2026-09-07 — Order-form section: 48 registrations, server.js 8,740 → 6,525 lines

- Moved 2,219 lines into routes/order-form.js at the same call site. All 61 original statements match in sequence at the syntax-tree level after normalizing module-relative paths. No shared declarations needed moving.
- The section contains the 978-line submit-order-form handler plus monitoring and legacy cart/catalog/pricing relays. Fresh inspection corrects the handover: submit-3day-order already lives in routes/customer-portal.js (422 lines). Its behavior needs separate tests; it was not in this cut.
- Route table remains 456 registrations; undefined names zero in 16 modules. Full release gates and live verification follow this initial extraction before any handler logic is decomposed.

### 2026-09-07 — CRM cut: 60 registrations, server.js 9,554 → 8,740 lines

- Erik explicitly approved the reviewed CRM extraction after the dependency release v2026.09.07.29 / Heroku2052. The tree was clean at85d57bf7.
- Moved the CRM section into routes/crm-proxy.js at its original registration point. Twelve shared declarations stay above it: role lookup; page-access cache, lifetime, loader, imports and gates; Box allowlist, forwarder and ID validator. Cache replacement remains with its loader.
- A syntax-tree comparison verifies all95 original section statements still exist unchanged in the new module or shared helpers (only relative require paths normalized). Route table456 unchanged; undefined names0 in15 modules; actual server boot and12 anonymous read-only route-family checks returned401.
- Full gates passed:192 unit suites /4,703 tests (4 established skips), DOM88, accessibility4, fixture parity84, browser15 passed /3 optional screenshot skips, including all five live pricing surfaces. Lint99 existing warnings, CSS283 clean, typecheck and boot200 passed. Route fixture unchanged. Release target:v2026.09.07.30; CI is checked before deployment.


### 2026-09-07 — third cut LIVE (`v2026.09.07.24`): 4 more modules, 119 registrations, `server.js` 10,561 → 9,529 lines

- `routes/pages.js` (83 — the staff dashboard entry pages, page gates, clean-URL storefront routes and redirects,
  the pages sitemap), `routes/staff-api.js` (29 — ManageOrders reads, payments, quote-session reads, SanMar invoices
  and FTP, finished photos, command search), `routes/customer-auth.js` (4 — the customer magic-link login), and
  `routes/crm-auth.js` (3). The helpers between them that the portal modules receive through ctx (`requireCustomer`,
  `fetchPortalAccess`, `safeLoginNext`, the magic-link template) stay in `server.js` on purpose.
- Two tool rules added after a mis-cut on stale line numbers (dry runs made before the stash, cuts after it, twenty
  lines apart): the extractor refuses any range that contains another module's call site, and the walker now
  recognises the `require('../routes/…')` spelling such a swallow produces and rejects it. Ranges are derived from
  text anchors on the tree being cut, never carried over.
- Route table identical (455); no undefined names in 14 modules; boot + request smoke (storefront pages 200, staff
  pages 302 to login, staff API 401 anonymous, customer login 200); gates + e2e + both parity suites green.

### 2026-09-07 — second cut LIVE (`v2026.09.07.23`): 4 more modules, 92 registrations, `server.js` 14,600 → 10,561 lines

- `routes/staff-saml.js` (16), `routes/vendor-portal.js` (12), `routes/customer-portal.js` (58, 3,242 lines — the
  biggest section in the file), `routes/quote-plane.js` (6). Eleven shared declarations were hoisted first with
  `hoist-declaration.js` (constants, limiters and four helper functions the rest of the file calls); a literal
  initializer may always move up, everything else only past code that does not evaluate it at load time.
- The CRM proxy and the order form were left alone on purpose: the other assistant's uncommitted hardening edits both.
  Its change was stashed for the cut and restored after the deploy (the lessons file merged by hand once more).
- Route table identical (455); no undefined names in 10 modules; boot + request smoke (SAML login, portal and vendor
  routes answering their gates, quote relays 401 anonymous); gates + e2e + both parity suites green.

### 2026-09-07 — first cut LIVE (`v2026.09.07.22`): 6 modules, 89 registrations, 1,347 lines out

- Six sections moved verbatim; `server.js` 15,947 → 14,600 lines. Two needed prep first: `sendHashedHtml`,
  `noCacheHeaders` and the asset-manifest constants lived inside the blog section but the whole file uses them —
  `hoist-declaration.js` moved them above the section (a function declaration is hoisted by the language; a `const`
  moves up only past code that does not evaluate it at load time, which the tool checks).
- Route table identical (455 registrations); 17 text locks now read the server through `tests/helpers/server-source.js`;
  ESLint treats `routes/**` exactly like `server.js` (ignored, same review process) until the split is done.
- **Three traps the first attempt hit, each now a lock or a tool rule:** (1) the scope analyser leaves references to
  top-level `function`/`var` unresolved in a classic script, so `requireStaff` was missing from ctx and the server did
  not boot → references are matched by name, and `check-undef.js` runs after every cut; (2) a cut whose range began on
  a neighbouring call-site line swallowed that call into the new module → the walker now errors on a call site inside a
  module; (3) verbatim `require('./lib/x')` and `path.join(__dirname, …)` resolve relative to `routes/` once moved — the
  first fails at boot, the second would have served 404s silently → the extractor rewrites them (`require('../…')`,
  `SERVER_DIR`/`SERVER_FILE` through ctx) and the lock forbids the raw forms in `routes/`.
- Gates: unit, e2e (a11y + money path), `test:parity` and `test:parity:surfaces` green (quote relays moved); a booted
  server answered robots, the blog sitemap, banner presets and the static mounts before the deploy.

### Order submission stages (2026-09-07, following v2026.09.07.31)

The DTG order submission is decomposed into garments, services, artwork, notes, payload, drafts and completion stages under lib/order-form, coordinated by submit.js (247 lines). A17-case route-level harness passed on the original and on the staged code. It covers dry-run reads, distinct size prices/colors, design links, tax/rep/shipping data, fees, rejected lines, processed drafts, response replay, upstream rejection and nonfatal audit failures. Validation remains at its original position relative to draft writes. Three switch-case scopes and unused note parameters were cleaned when entering the existing strict library lint scope.

### Quote synchronization, lifecycle and public quotes (2026-09-07)

Three contiguous route cuts move20 registrations: quote-sync9, quote-lifecycle9, public-quotes2. The Pacific timestamp helper remains shared in the root. The watchdog moves to one lib/quote-sync-health instance created before both consumers; its mutable timestamps, results and dedup map stay together. An original/extracted contract comparison covers thresholds, counters, reason order, dedup, retries and instance isolation. All279 other original top-level statements survive unchanged (relative paths normalized); the456-route fixture remains the required lock.

### Storefront service factories (2026-09-07)

Forty-three shared declarations now belong to six focused lib/storefront factories: tax, inventory, 3-Day Tees, custom tees, custom caps and channel bindings. An index composes them once in dependency order; caches and their loaders stay in the same closure. All43 moved declarations and206 remaining statements matched at the syntax-tree level before the gallery cut. The public gallery keeps its aggregate/style-copy caches in routes/storefront-gallery.js, registered in its original position. Fixture456 remains unchanged. Fifteen contracts passed against both the original helpers and extracted factories; they test authoritative pricing inputs, not a replacement pricing engine.

### Payment stages (2026-09-07)

Thirty-nine shared declarations move into focused lib/payments factories for links, integrity, email transport/templates, alerts, deposits, records and sample fulfillment. The raw Stripe route remains before body parsers and now awaits separate quote and storefront stages inside its error boundary. Original declarations were syntax-tree compared before the deliberate payment fixes: rejected Payment Confirmed writes stop fulfillment with a retryable response; all final storefront writes authenticate; a failed Processed write after a successful push is acknowledged and alerted for manual bookkeeping, without labeling fulfillment failed. Status markers preserve existing redelivery behavior; they are not a cross-dyno atomic claim. Route456 remains unchanged.
