# A+ ROADMAP — Turning the NWCA Quote Builders into a Resellable SaaS Product
### Build instructions for Fable

---

## MISSION

You are taking three production apparel-decoration **quote builders** — Embroidery (EMB), DTF transfers (DTF), Screen Print (SCP) — that today run one shop (Northwest Custom Apparel, Milton WA) and turning them into an **A+, resellable, white-label SaaS product** that other decoration shops can license and run on their own branding, prices, and back-ends. Reps build quotes live on the phone; quotes save to Caspio, print/PDF, email via EmailJS, and push to ShopWorks.

Four things are non-negotiable while you do this:

1. **Preserve the no-framework simplicity.** Vanilla JS, no TypeScript migration, no SPA rewrite. Pages stay plain HTML loading `<script src>` tags. You may add a single **esbuild** step (one devDependency) so `import`/`export` works, but the browser must still just load a script.
2. **Never break the live app.** Use the **strangler pattern** — extract behind the existing surface, keep the old path working until the new one is proven, migrate one builder at a time. Every commit keeps the 5,881-test suite and the pricing-parity locks green.
3. **Keep the two pricing guarantees intact.** *(a)* **Pricing = API, never hardcoded** — every price/fee comes from the backend (Caspio `Service_Codes`, `/api/pricing-bundle`); a hardcoded number is a fallback ONLY and must render a visible warning. *(b)* **3 surfaces, one engine** — Customer Catalog, Quick Quote, and the Builders all price through `quote-cart-engine.js → {method}-pricing-service.js`. Never add a 4th pricing path.
4. **Sync all builders.** A change to one builder almost always applies to the other two. The whole point of Phase 0 is to make "change once, applies to all" real in code instead of a manual house rule.

The verified starting state you are fixing: `embroidery-quote-builder.js` is **13,712 lines**, `screenprint-quote-builder.js` **5,409**, `dtf-quote-builder.js` **4,086**, shared `quote-builder-utils.js` **2,481** — global-function soup with heavy `window.*`. **368 inline `style=""`** attributes (EMB 193 / SCP 92 / DTF 83) and **110 inline `onclick=`** handlers (EMB 65 / SCP 20 / DTF 25) weld HTML to globals. **20+ files** hardcode the proxy host `caspio-pricing-proxy-ab30a049961a.herokuapp.com`; the 3 builder JS files carry **269 ShopWorks**, **140 SanMar**, **52 tax/Milton/10.2%** references and hardcoded EmailJS IDs (`service_jgrave3`, `template_quote`, key `4qSbDO-SQs19TbP80`). There is **no tenant/config/white-label layer**. That coupling — not the features — is the product gap.

---

## ⛔ ALREADY SHIPPED — DO NOT REDO (assume done and correct)

A 62-finding expert audit is live in production. **Do not re-suggest or re-touch any of these:** all money-leak fixes (DTF zero-location gate, EMB customer-supplied $50 fee charged, extra-color surcharge billable, cap stitch clamp, SCP $0-back guard, missing-size fallback removed, SPSU reprice, server quote-sequence for SCP); endgame fixes (SCP email dead-end, real PDF quote #s, save-before-email everywhere, share-modal "Email to customer", quote-view push for all methods, accepted-quote warning banner); the guided 4-step shell; the "Switch method" header menu (carries customer+products); the PNW design-token skin + print/PDF rebrand; "Save as PDF"; logo-status chips; the in-flight "Updating prices…" pill; "auto %" rush chips; SCP duplicate-row auto-merge; EMB "Retry pricing"; and the Caspio blank-date 400 save fix. **These are the baseline you build on, not work items.**

---

## SCORECARD

| Dimension | Now | Target | Single biggest lever |
|---|:--:|:--:|---|
| Code Architecture & Maintainability | C− | A+ | Strangle the 13,712-line EMB god-file into ES modules behind one `QuoteBuilderBase` + per-method adapters (esbuild, no framework) |
| UI/UX & Delight | B− | A+ | Keyboard-first happy path + skeletons/optimistic pricing + undo toasts (kill the blocking overlay & the mouse-bound flow) |
| Accessibility (WCAG 2.1 AA / 2.2) | D | A | Fix the two shared chokepoints (token/focus layer + modal/widget JS) and lock with `jest-axe` CI so all 3 builders inherit conformance |
| Performance | C | A+ | Memoize + in-flight-dedupe the pricing fetch and debounce recalc (kills the ~20× refetch + per-keystroke reprice); real minified asset pipeline |
| Security (multi-tenant, PII) | D+ | A | Per-tenant authz boundary on the proxy (close the sequential-ID IDOR) + helmet/CSP + fix the CORS `endsWith` bug |
| Testing / Reliability / Observability | C | A+ | Blocking GitHub Actions CI + Sentry with release tagging + true save→email→push E2E + `/readyz` uptime alerting |
| Productization / Resale | D+ | A+ | Invert the dependency: runtime per-tenant config + 4 vendor adapters (OrderPush/Catalog/DataStore/Email) so everything reads config-not-code |
| Mobile / Responsive | C− | A | Kill the inline-style leak that beats every media query; numeric keypads; sticky mobile total bar |
| Pricing-Engine Integrity & Domain | C+ | A+ | Version the price list and snapshot it onto every saved quote so a quote reprices to the exact cent months later |

---

## GROUND RULES (honor on every task)

- **Pricing = API, never hardcoded.** No new numeric price/fee/tax literal in any builder JS. Fees resolve from `Service_Codes` / `GET /api/service-codes`; decoration/garment from `/api/pricing-bundle` + `{method}-pricing-service.js`. A fallback constant is allowed only with a **visible UI warning badge**.
- **3 surfaces, one engine.** Any pricing-path change re-runs `web-quote-cart-parity` and `quick-quote-parity` and verifies Catalog + Quick Quote + Builder all agree. Never add a 4th path or bypass the engine.
- **Sync all builders.** When you touch shared behavior (modals, toasts, totals, invoice, utils), it lands in all three. Method-specific pricing/location/logo stays per-method. The invoice/PDF/tax path is the shared `embroidery-quote-invoice.js` — edit it once.
- **No inline `<style>` or `<script>` *blocks*** in HTML (attribute-level `style=""`/`onclick=` currently exist and are being removed — do not add more; migrate them per the tasks below). External JS/CSS only, kebab-case, correct subdirectory.
- **Verify with tests AND a real browser.** Add tests for new work; then drive the actual flow (the `/verify` and `/run` skills, Playwright) — not just unit assertions. A green test with a broken button is a failure.
- **Incremental, never break live.** Strangler only. Each PR is independently shippable and keeps all 5,881 tests + parity locks green. Re-export moved functions onto `window` during a transition; delete the `window.*` copy only after every caller is migrated.
- **Ask before destructive changes.** Deleting files, dropping Caspio columns, changing a shared table, force-pushing, or flipping a proxy secret to "secret-only" — confirm first, and update `ACTIVE_FILES.md` + `shared_components/js/GUIDE.md` in the same commit as any create/delete/move.
- **Deploy via the existing `/deploy` skill** (pre-flight gates, single-version cache-bust, `--no-ff` release merge). Never hand-roll a deploy.

**Effort key:** S ≤ ½ day · M ≈ 1–2 days · L ≈ 3–5 days · XL ≈ 1–3 weeks (decompose into shippable PRs).

---

# PHASE 0 — FOUNDATION
*Unblock every later phase. Add the build step, extract the modules, invert the config, stand up CI. Ship each piece behind the unchanged `<script src>` surface so the live app never notices.*

### 0.1 — Add an esbuild build pipeline with content-hashed, minified output  `[P0 · L · serves: Architecture, Performance]`
**Why.** ES modules are the prerequisite for all decomposition, and buyers expect a real build; today you ship 14k-line unminified files with fragile manual `?v=` cache-busting.
**Do.** Add `esbuild` as the single devDependency and a `scripts/build.js` that bundles per-builder ESM entry points — `shared_components/js/builders/{emb,scp,dtf}/index.js` — with `bundle:true, format:'iife', sourcemap:true, minify:true` (IIFE preserves the `window.*` globals the pages still rely on), plus a shared vendor/util chunk. Emit content-hashed filenames (`dtf-quote-builder.a1b2c3.js`) into `/dist` and write an `asset-manifest.json`. Add npm scripts `build` / `watch` and a `prestart`/`postinstall` build so `npm start` serves the same static files. In `server.js`, rewrite `<script src>` tags from the manifest (or middleware swap). Also set `drop:['console','debugger']` in the production bundle so the pricing hot-path logs (`dtf-pricing-service.js` ~127/133/139/159 and siblings) vanish in prod; gate any needed logs behind `?debug=1`. As a pre-bundle stopgap, add `defer` to the builder `<script>` tags.
**Files.** `package.json`, `scripts/build.js`, `server.js`, `shared_components/js/builders/{emb,scp,dtf}/index.js`, the 3 builder HTMLs. Mirror the working ESM style in `shared_components/js/staff-dashboard/controllers/*.js`.
**Done when.** Editing a source module + `npm run build` yields a behavior-identical bundle; production HTML references hashed filenames with no `?v=` strings; a no-op re-deploy produces identical hashes.

### 0.2 — Compression + immutable cache headers  `[P0 · S · serves: Performance]`
**Why.** Shipping large files without brotli/gzip and without long cache lifetimes wastes every load.
**Do.** In `server.js`, mount `compression` ahead of `express.static`. Serve `/dist` hashed assets with `Cache-Control: public, max-age=31536000, immutable`; serve HTML `no-cache` so new manifest refs are picked up. Confirm Heroku isn't stripping `Content-Encoding`.
**Files.** `server.js`, `package.json`.
**Done when.** A built `.js` returns `Content-Encoding: br|gzip` + immutable cache; HTML returns `no-cache`.

### 0.3 — Runtime per-tenant config spine (`window.TENANT`) + kill hardcoded hosts/IDs  `[P0 · L · serves: Productization, Security, Pricing]`
**Why.** Nothing multi-tenant can exist until a shop's identity/settings live in **data, not code**; the 20+ hardcoded proxy URLs and baked EmailJS IDs are the concrete symptom.
**Do.** Create `config/tenant.js` exporting `window.TENANT`, resolved at **runtime** by hostname (`acme.quotebuilder.app → acme`) or `?tenant=` in dev, then hydrated from `GET {BOOTSTRAP_URL}/api/tenants/:id/config` returning `{ id, branding:{name,logoUrl,palette,phone,email,address}, api:{baseUrl}, email:{provider,serviceId,publicKey,templates}, tax:{mode,rate,lookupUrl}, methods:{emb,dtf,scp}, currency, units, orderSystem:{adapter,config}, catalog:{adapter,config}, license, features }`. Make the existing `shared_components/js/app-config.js` `APP_CONFIG` a **compatibility shim** that now reads from `window.TENANT`, so the 30+ call sites keep working. Then grep the literal `caspio-pricing-proxy-ab30a049961a.herokuapp.com` across `embroidery-/screenprint-/dtf-quote-builder.js`, `quote-cart-engine.js`, `quote-builder-utils.js`, `quick-quote.js`, `server.js` and replace **every** one with `APP_CONFIG.API.BASE_URL` (this is house Rule 6, currently violated). Do the same for `service_jgrave3` / `4qSbDO-SQs19TbP80` / `template_*` → `TENANT.email.*`.
**Files.** `config/tenant.js`, `config/app.config.js`, `shared_components/js/app-config.js`, the 3 builder JS, `quote-cart-engine.js`, `quote-builder-utils.js`, `server.js`.
**Done when.** `?tenant=demo` renders a different name/logo/phone with zero code change; `APP_CONFIG.API.BASE_URL === window.TENANT.api.baseUrl`; the CI guard in 0.6 finds no hardcoded host or EmailJS ID outside `config/`.

### 0.4 — Strangler-decompose EMB into modules; revive ONE `QuoteBuilderBase` + adapters  `[P0 · XL · serves: Architecture, and every dimension downstream]`
**Why.** The 13,712-line EMB file (224 top-level fns, 130 `window.*`) is the #1 reason a buyer's engineer can't read, diff, or trust the code. A `QuoteBuilderBase` (793 lines) already exists and is loaded by DTF but nobody extends it — finishing it collapses ~90% duplicated logic into one base + three thin adapters and makes "sync all builders" real in code.
**Do.** **Pilot EMB only, then repeat SCP → DTF.** First resolve dead scaffolding: audit `quote-builder-base.js` (793) vs `quote-builder-core.js` (684) vs `INTEGRATION-EXAMPLE.js` (329) — keep **one** base, delete the other two and their `<script>` tags, updating `ACTIVE_FILES.md` + `GUIDE.md` (ask before deleting; grep each filename in HTML/JS first). Then split EMB into: `builders/emb/state.js` (one mutable store with getters/setters — no free `window.` vars), `builders/emb/pricing.js` (the **only** module that talks to `/api/pricing-bundle`; wraps `embroidery-pricing-service.js` + `quote-cart-engine.js`), `builders/emb/render.js` (pure DOM builders — **zero** `fetch`/`await`/state mutation), `builders/emb/persistence.js` (Caspio save/load, quote-sequence, EmailJS), `builders/emb/events.js` (wires the DOM). Move functions in behavioral clusters; re-export each onto `window` from `index.js` during transition (strangler); drop each `window.` copy only after its callers migrate. Define the shared base to own everything common (row/state, autosave, beforeunload guard, save/print/email invoice flow, totals, tax, modals, utils) and a small adapter interface each method implements: `getPricingService()`, `getTierConfig()`, `getLocationModel()`, `getNudgeTiers()`, `renderMethodSpecificRow()`. `index.js` constructs `new EmbAdapter()` and passes it to the base.
**Files.** `shared_components/js/embroidery-quote-builder.js`, `embroidery-pricing-service.js`, `quote-cart-engine.js`, `quote-builder-base.js` (kept), `quote-builder-core.js` + `INTEGRATION-EXAMPLE.js` (deleted), new `shared_components/js/builders/emb/*`, `ACTIVE_FILES.md`, `GUIDE.md`.
**Done when.** No module > ~600 lines; `render.js` has zero fetch/await; each `index.js` is < ~400 lines and holds only method-specific pricing/location/logo differences; a shared-behavior change (e.g. a new modal) is a one-file edit visible in all three; parity locks pass after every commit.

### 0.5 — One canonical quote-item model shared by all three builders  `[P0 · M · serves: Architecture, Pricing, Testing]`
**Why.** Each builder carries its own line-item shape and bookkeeping (DTF's `registerChildRow`/`setChildRowQty` Map vs EMB arrays) — the root of divergence bugs and the reason "sync all builders" is manual.
**Do.** Create `shared_components/js/builders/shared/quote-model.js` exporting a `QuoteItem` factory and a `QuoteState` store (add/update/remove/duplicate line, subtotal, tier grouping for caps-vs-garments). Migrate EMB → SCP → DTF onto it, deleting each builder's bespoke row-tracking (DTF's child-row Map plumbing) in favor of the shared store. Type it with the typedefs from 0.6.
**Files.** `shared_components/js/builders/shared/quote-model.js`, `dtf-quote-builder.js`, `screenprint-quote-builder.js`, EMB modules.
**Done when.** All three read/write line items through the same `QuoteState` API; adding a line-item field is a one-file change reflected everywhere.

### 0.6 — CI pipeline + ESLint + Prettier + JSDoc/`checkJs` contract  `[P0 · M · serves: Architecture, Testing, Security, Pricing]`
**Why.** Nothing today stops a broken build, a new global, an unescaped sink, or a failed pricing test from reaching production; a required CI gate is the cheapest reliability multiplier and the guardrail that stops the god-files from silently regrowing.
**Do.** Create `.github/workflows/ci.yml` on `pull_request` + push to `develop`/`main`, `node 18.x`, jobs: **test** (`npm ci` → `npm test` → integration), **lint** (`npx eslint .`), **typecheck** (`tsc -p tsconfig.json`), **pricing-parity** (`web-quote-cart-parity` + `quick-quote-parity` as npm scripts). Mark **test** + **pricing-parity** as required status checks via branch protection. Add ESLint (flat config scoped to `shared_components/js/builders/**` so legacy files are grandfathered) with `no-implicit-globals`, `no-restricted-syntax` banning new `window.X =` assignments, `import/no-cycle`, `no-undef`, `eqeqeq`, plus `eslint-plugin-no-unsanitized` (feeds 1.4) — run with `--max-warnings <current baseline>` and ratchet down. Add Prettier. Add `tsconfig.json` (`allowJs, checkJs, noEmit, strict:false`, scoped to `builders/**`) and `shared_components/js/types/quote.d.ts` with `@typedef`s for `QuoteItem`, `PricingResult` (the shape `singleItemPreview` returns), `TierConfig`, `ServiceCodePrice`, `MethodAdapter`; annotate the base, adapters, pricing module. Add a Jest guard test that fails if the proxy host literal or an EmailJS ID appears outside `config/`. Add a committed `package-lock.json`, `npm audit --audit-level=high` step, and `.github/dependabot.yml` (weekly, npm, both repos).
**Files.** `.github/workflows/ci.yml`, `.eslintrc.cjs`/flat config, `.eslintignore`, `tsconfig.json`, `shared_components/js/types/quote.d.ts`, `package.json`, `package-lock.json`, `.github/dependabot.yml`, `tests/unit/no-hardcoded-hosts.test.js`, `README.md` (status badge).
**Done when.** A PR that breaks a pricing test, adds a `window.` global in a migrated module, adds an unescaped `innerHTML`, or re-hardcodes the host cannot merge; `npm run typecheck` fails if an adapter omits a required method.

---

# PHASE 1 — TRUST
*Harden the app that exists, make every failure visible, and prove it works. Security review + accessibility + observability + the real test pyramid. Most of this is single-tenant hardening that stands on its own; the multi-tenant authz boundary lands in Phase 2.*

### 1.1 — HTTP security headers + CSP via helmet  `[P0 · M · serves: Security]`
**Why.** `server.js` sets only CORS + cache headers — no CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or HSTS. A buyer's IT review fails on this immediately, and CSP is the structural defense for the 105+ `innerHTML` sinks.
**Do.** `npm i helmet`, mount at the top of the middleware stack (before CORS ~line 400). Enable HSTS, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'self'`. Add a CSP **in report-only mode** for one release: `script-src 'self'` + pinned CDN hosts (or none once 1.3 self-hosts them), `style-src 'self' 'unsafe-inline'` (required until the 368 inline styles migrate in 1.7/3.7), `connect-src 'self'` + the tenant proxy origin, `img-src 'self' data: https://cdn.caspio.com`. Collect violations, then enforce.
**Files.** `server.js`, `package.json`.
**Done when.** `curl -I` shows CSP + HSTS + nosniff; all 3 builders load and price with no CSP console errors.

### 1.2 — Fix the CORS `endsWith` origin bug + credentialed wildcard  `[P0 · M · serves: Security]`
**Why.** `isOriginAllowed()` uses `origin.endsWith(allowed)`, so `https://evil-teamnwca.com` matches `teamnwca.com`, and `/\.herokuapp\.com$/` trusts **any** Heroku app — combined with `Allow-Credentials: true` this is exploitable cross-origin credential theft, and it's live today regardless of tenancy.
**Do.** In `server.js` (~379–410) replace the substring check with **exact** origin equality against an explicit allowlist loaded from config (per-tenant in Phase 2). Drop the broad `*.herokuapp.com` regex in production; gate localhost/127.0.0.1 behind `NODE_ENV !== 'production'`. Never emit `Access-Control-Allow-Origin: '*'` with credentials — if the origin isn't matched, omit the header (remove the `origin || '*'` fallback at ~line 404). Add a unit test asserting a look-alike domain and an arbitrary `*.herokuapp.com` origin are both rejected in prod.
**Files.** `server.js`, `tests/unit/`.
**Done when.** The test proves look-alike and arbitrary-Heroku origins are rejected in production mode.

### 1.3 — SRI-pin or self-host all CDN assets  `[P1 · M · serves: Security]`
**Why.** Bootstrap (jsdelivr), Font Awesome (cdnjs), and the EmailJS SDK load with no `integrity=`, so a CDN compromise runs attacker JS in a page handling customer PII and pricing.
**Do.** Preferred: **vendor** the three into `shared_components/vendor/` and serve from the app origin so CSP can be `script-src 'self'`. Otherwise add `integrity="sha384-…" crossorigin="anonymous"` pinned to exact patch versions (bootstrap@5.1.3, font-awesome 6.6.0, @emailjs/browser exact — never a floating `@3`) in all 3 builder HTMLs.
**Files.** the 3 builder HTMLs, `shared_components/vendor/`.
**Done when.** No builder references a floating-major CDN URL; tampering a byte blocks execution.

### 1.4 — Audit every `innerHTML` sink for `escapeHTML` + lint against regressions  `[P1 · L · serves: Security]`
**Why.** EMB has ~105 `innerHTML` assignments vs ~109 `escapeHTML` calls — close but not guaranteed 1:1, and customer name/company/notes/product fields are attacker-influenced free text rendered into quotes, PDFs, and emails. One miss is stored XSS in an authenticated rep session.
**Do.** Grep `.innerHTML =` across the 3 builders + `quote-builder-utils.js`; confirm every interpolated user/API value is `escapeHTML()`-wrapped or built via `textContent`/`createElement`. For fields needing limited markup, vendor DOMPurify instead of raw `innerHTML`. Enforce with the `eslint-plugin-no-unsanitized` rule wired into 0.6's lint gate.
**Files.** the 3 builder JS, `quote-builder-utils.js`, ESLint config.
**Done when.** Pasting `<img src=x onerror=alert(1)>` into customer name/company/notes/product renders inert text in the live quote, the PDF, and the emailed copy; new unescaped `innerHTML` fails CI.

### 1.5 — Input validation + sanitization at the proxy write boundary  `[P1 · L · serves: Security]`
**Why.** `sanitizeFilterInput()` exists but coverage is uneven, and quote/customer write endpoints accept client-shaped bodies — an injection and data-integrity risk once multiple tenants write.
**Do.** In `caspio-pricing-proxy`, add schema validation (zod or hand-rolled) on every POST/PUT body for quote/customer routes: whitelist fields, cap string lengths (name/company/notes), coerce numeric price/qty, reject unknown keys, `express.json({limit})` for oversized payloads. Confirm `sanitizeFilterInput()` wraps **every** Caspio `q.where`/filter built from request input.
**Files.** `../caspio-pricing-proxy/src/routes/quotes.js`, `../caspio-pricing-proxy/src/utils/`, `../caspio-pricing-proxy/server.js`.
**Done when.** A save with a 1 MB notes field, an extra field, or a filter param containing Caspio operators is rejected 400, not persisted.

### 1.6 — Rate limiting + move EmailJS send server-side  `[P2 · M · serves: Security]`
**Why.** The quote-save, quote-sequence, and email paths are what an internet-exposed instance gets hammered on; unbounded EmailJS sends run up the tenant's bill and enable spam/phishing from their domain.
**Do.** Apply per-IP and per-tenant `express-rate-limit` to `/api/quote-sequence`, quote-save, and any EmailJS-fanout endpoint. Move the EmailJS send **behind the proxy** so it's authenticated per tenant and countable (or at minimum lock the EmailJS dashboard to the tenant domain + a monthly cap).
**Files.** `../caspio-pricing-proxy/src/middleware/`, `server.js`.
**Done when.** A loop hitting quote-save 100×/min from one IP gets 429; EmailJS sends are attributable to a tenant and capped.

### 1.7 — Migrate inline `style=""` to token-backed utility classes  `[P1 · L · serves: Mobile, A11y, UI/UX, Security-CSP, Architecture]`
**Why.** 368 inline styles beat every media query on specificity, so the size grid/customer panel/modals render at desktop 12px on an iPad (triggering iOS auto-zoom and sub-44px targets), they can't be themed per tenant, and they block CSP `style-src` tightening.
**Do.** Grep `style="` in the 3 builder HTMLs. Extract the recurring input pattern (`width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box` on customer-name/company/number/phone/project/po/terms/order-number ~lines 600–750) into a single `.qb-field` class in `quote-builder-common.css`, defined once and synced across all 3. Start with EMB's 193. (Finish the tail + build the gallery in 3.7.)
**Files.** the 3 builder HTMLs, `shared_components/css/quote-builder-common.css`.
**Done when.** Inline `style="` count drops ≥50% (≥150 removed); on iPad Safari 768px portrait, tapping any customer field does not zoom and every field is ≥44px tall.

### 1.8 — Accessibility at the two shared chokepoints (so all 3 builders inherit AA)  `[P0–P1 · L · serves: Accessibility, Mobile, UI/UX]`
**Why.** This is an excellent internal tool never built for a11y — div-soup, icon-only buttons, inline onclick, and the new forest palette's low-contrast tokens will fail an axe scan on the first page, which is a hard blocker the moment Erik sells to a school/municipality needing a VPAT. Fix it at the token/focus layer (`quote-builder-shell.css`) and the shared widget/modal JS (`quote-builder-utils.js`), not per element.
**Do (one coherent workstream):**
- **Contrast (P0/S).** In `quote-builder-shell.css` audit text tokens at 4.5:1. Confirmed failures on white/birch: `--pnw-moss #6b8e60` (~3.6:1), `--pnw-stone-soft #9ca3af` (~2.5:1), `--qb-state-warn #f59e0b` as amber text (~2.1:1). Add darker text-only variants (`--pnw-moss-text #4d6b42`, `--pnw-stone-strong #55606e`, amber-text `#b45309`) and repoint every foreground/hint/placeholder/small-label rule; leave the light values for borders/large-decorative only.
- **Real buttons + names (P0/L).** Sweep the 3 builders for `<i onclick>`, `<div onclick>`, `<span onclick>` and convert interactive ones to `<button type="button">` (this is also how you drop the `window.*` exports in 0.4 — do it during each builder's decomposition, replacing `onclick="fn(id)"` with `data-action="fn" data-id` + one delegated listener per container). Add `aria-hidden="true"` to decorative Font Awesome glyphs; give every icon-only control a visible label or `aria-label` (row delete, qty ±, chevrons, modal close, share/copy). Replace hand-rolled `tabindex=0 role=button` (e.g. the logo-card header ~line 99) with real buttons.
- **One accessible modal helper (P0/L).** Add `openAccessibleModal(el)`/`closeAccessibleModal(el)` to `quote-builder-utils.js`: `role="dialog" aria-modal="true"`, `aria-labelledby` the title, save/restore `activeElement`, move focus in, trap Tab/Shift+Tab, Esc to close, `inert`/`aria-hidden` the background. Route **every** modal in all 3 (share, design search, ShopWorks import, size/extended-size popovers) through it — SCP/DTF have zero focus-trap today.
- **Keyboard color picker + size grid (P0/L).** Render swatches as `role="listbox"`/radiogroup with arrow-nav, Space/Enter select, `aria-selected`, an accessible name = COLOR_NAME (not CATALOG_COLOR), and a non-color-only selected indicator (checkmark/ring). Give each qty input a real (visually-hidden) `<label>` ("Adult Large quantity"); make ± steppers real buttons.
- **ARIA live regions (P1/M).** Add a shared `announce(msg)` writing to one `<div id="qb-live" aria-live="polite" aria-atomic="true" class="sr-only">`. Route toasts/"copied"/"saved" through polite; give the "Updating prices…" pill `role="status"`; announce the new grand total on recalc ("Total updated: $842.50"); use `role="alert"`/assertive only for pricing failures and the accepted-quote/API-error banners.
- **Focus-visible + reduced-motion (P1/S).** Global `:focus-visible { outline:2px solid var(--pnw-forest); outline-offset:2px; box-shadow:var(--pnw-glow-focus); }` (grep for stray `outline:none`); add a shared `@media (prefers-reduced-motion: reduce)` block neutralizing animations/transitions in `quote-builder-shell.css` + `-common.css` (neither honors it today).
- **Labels + validation ARIA (P1/M).** Every customer/product input gets an associated `<label for>` (the design-number input ~line 111 is placeholder-only); on validation failure set `aria-invalid="true"` + `aria-describedby` → the error node, mark required with `aria-required`, move focus to the first invalid field and announce a summary.
- **Semantic price table (P1/M).** In the shared `embroidery-quote-invoice.js` renderer use `<table><caption>` + `<th scope="col">` (Product/Color/Qty/Unit/Line Total) + `scope="row"`; wrap totals in an `aria-labelledby` region; ensure LTM/setup/rush read as rows. The PDF/EmailJS HTML reuses the same semantic table.
- **Guided shell as steps (P1/M).** Mark the 4-step rail as `role="tablist"`/`role="tab"`/`role="tabpanel"` (roving tabindex + arrows) if freely selectable, else `<ol>` + `aria-current="step"` + visually-hidden "Step 2 of 4"; move focus to the new panel heading on change. Make the Switch-method menu a real keyboard menu (arrows/Enter/Esc/focus-trap/return).
- **Landmarks/skip/headings (P2/S).** Wrap the builder in `<main id="main">`, the rail in `<aside>`; add a visually-hidden "Skip to quote builder" as the first focusable; promote the styled title div to a single `<h1>`; keep heading order.
- **Target size (P2/M + Mobile).** Shared `.qb-icon-btn` giving all icon buttons/chips/swatches `min-height/width:24px` (44px for primary), `touch-action: manipulation`, visible `:active`.
**Files.** `shared_components/css/quote-builder-shell.css`, `-common.css`, `-guided.css`, `color-picker-shared.css`, `shared_components/js/quote-builder-utils.js`, `embroidery-quote-invoice.js`, the 3 builder HTMLs, EMB modules.
**Done when.** Axe passes `color-contrast`, `button-name`/`link-name`, `aria-dialog-name`, `label`, `th-has-data-cells`, `region`/`bypass`/`heading-order` on all 3; you can build a full quote and switch methods with **keyboard only**; NVDA/VoiceOver announces color name, each size label, step position, reprices, and the new total.

### 1.9 — `jest-axe` + Playwright axe CI gates  `[P0 · M · serves: Accessibility, Testing]`
**Why.** Without an automated gate every 1.8 fix rots on the next deploy; a green axe report is the artifact that lets Erik produce a VPAT for a buyer's questionnaire.
**Do.** Add `tests/a11y/builders.a11y.test.js` that jsdom-loads each builder HTML + shared CSS and runs `expect(await axe(document)).toHaveNoViolations()` with `wcag2a,wcag2aa,wcag21aa`. Add a real-browser Playwright pass (`@axe-core/playwright`) that boots `npm start`, navigates each builder, adds a product to render the price table + fee panel + a modal, and asserts zero serious/critical violations. Check in a baseline so the count can only drop. Wire both into CI + the `/deploy` pre-flight.
**Files.** `tests/a11y/builders.a11y.test.js`, `tests/ui/`, `package.json`, `jest.config.js`, `.claude/skills/deploy`.
**Done when.** CI fails on any new serious/critical axe violation.

### 1.10 — Sentry client + server error tracking with release tagging  `[P0 · M · serves: Testing/Observability, Security]`
**Why.** Zero error tracking today — a silent client exception mid-quote loses a rep a live phone quote and you learn from an angry call, not a dashboard.
**Do.** Adopt Sentry (or GlitchTip). Server: `@sentry/node` init at the top of `server.js` (`environment: TENANT_ID||'nwca'`, `release: RELEASE_VERSION`), `Sentry.expressErrorHandler()` after routes. Client: a new external `shared_components/js/observability.js` (no inline blocks) loads the browser SDK, same release string, wraps the 3 builders' entry points, `beforeSend` scrubs PII (customer email/phone), `tags:{tenant, method}`. Feed `release` from the `$DEPLOY_VERSION` the deploy skill already computes.
**Files.** `server.js`, `shared_components/js/observability.js`, `.claude/skills/deploy/SKILL.md`, the 3 builder HTMLs.
**Done when.** Throwing in a builder surfaces in Sentry tagged with the right release + tenant, PII redacted.

### 1.11 — `/healthz` + `/readyz` + external uptime & dependency monitoring  `[P0 · S · serves: Testing/Reliability]`
**Why.** No health route watches the `caspio-pricing-proxy` dependency; when the proxy is down every quote silently fails to price — you must detect that in seconds.
**Do.** Add `GET /healthz` (200 `{status,release,uptime}`) for liveness and `GET /readyz` that does a 2s-timeboxed probe of the proxy `/api/service-codes` and returns 503 if unreachable — making "pricing API down" monitorable (aligns with the never-silent-price rule). Register both apps with an external monitor (UptimeRobot/Better Stack) hitting `/readyz` every 60s, alerting the existing Slack webhook infra.
**Files.** `server.js`, `../caspio-pricing-proxy/server.js`.
**Done when.** Killing the proxy flips `/readyz` to 503 and fires a Slack alert within ~2 min.

### 1.12 — Structured JSON logging with request/tenant correlation IDs  `[P1 · M · serves: Testing/Observability]`
**Why.** Debugging a tenant incident across the app + proxy is near-impossible with plain Heroku console lines.
**Do.** Add `pino`/`pino-http` to `server.js` emitting JSON with a per-request `requestId` (UUID middleware, echoed as `X-Request-Id`) and a `tenant` field; propagate `X-Request-Id` on every outbound call to the proxy and log the same id there. Replace ad-hoc `console.log` in route handlers with `req.log`. On the client, attach the failed response's `X-Request-Id` to Sentry context.
**Files.** `server.js`, `../caspio-pricing-proxy/server.js`, `shared_components/js/observability.js`.
**Done when.** Given a failure time, one `requestId` greps the full path across both apps.

### 1.13 — True Playwright E2E of the money path (save→email→push)  `[P0 · L · serves: Testing, Pricing, UI/UX]`
**Why.** Playwright is already a devDependency but there's no real E2E; the revenue flow reps live in is untested end-to-end, so a regression in the save-before-email chain ships undetected.
**Do.** Create `tests/e2e/playwright.config.js` (`webServer: npm start`, chromium + webkit). For each of EMB/SCP/DTF: build a quote (add product, cross a tier boundary, pick a location), assert the on-screen total, Save and assert a real `EMB-####` id is minted, trigger "Email to customer" and assert the EmailJS call fires with the saved id (`page.route('**/api.emailjs.com/**')`), trigger the ShopWorks quote-view push and assert the request. Mock Caspio/EmailJS/ShopWorks at the network layer for determinism. Add money-critical guards matching today's shipped fixes' inverse (DTF zero-location **blocks**; EMB customer-supplied $50 fee **appears**). Wire as an `e2e` CI job.
**Files.** `tests/e2e/*.spec.js`, `tests/e2e/playwright.config.js`, `quote-cart-engine.js`.
**Done when.** `npx playwright test` is green locally and in CI; breaking save-before-email turns it red.

### 1.14 — jsdom DOM/component tests for the extracted seams  `[P1 · L · serves: Testing, Architecture]`
**Why.** jsdom is installed but Jest runs `node`, so the builders' DOM logic (row add/remove, qty-tier nudges, fee display) — exactly where inline onclick and `window.*` break — has zero unit coverage. E2E is too slow for every branch.
**Do.** Add a second Jest project (`testEnvironment:'jsdom'`, `tests/dom/**` and `tests/unit/builders/emb/**`). Test, offline (mock fetch): `state.test.js` (add/remove/duplicate row, dirty tracking, caps-vs-garments tier bucketing), `render.test.js` (pure render fns → expected markup), `adapter.test.js` (EmbAdapter satisfies the `MethodAdapter` typedef), DTF `registerChildRow`/`setChildRowQty`/`removeProduct`, and the qty-nudge thresholds (DTG 12/24/48/72, EMB 8/24/48/72, SCP 24/37/73/145). Expand `collectCoverageFrom` to include the 3 builder JS + `quote-cart-engine.js`; set a coverage threshold at current % and ratchet up.
**Files.** `jest.config.js`, `tests/dom/*`, `tests/unit/builders/emb/*`, the 3 builder JS.
**Done when.** DOM tests run green in CI, coverage includes the builders, and a dropped adapter method fails a test.

### 1.15 — Unify error handling; enforce no-silent-fallback structurally  `[P1 · M · serves: Architecture, Security]`
**Why.** Erik's #1 rule (never show a stale/wrong price) is enforced only by convention across three files; a buyer needs it guaranteed by one code path, and the base already has a half-built `safeExecute`/`showError`.
**Do.** Create `shared_components/js/builders/shared/errors.js` exporting `safeExecute(fn,{userMessage})`, `showErrorBanner(msg)`, `assertPriceOrThrow(result)`, and a **warning-badge helper** for the "hardcoded fallback used" case. Route all builder API calls (pricing, Caspio, EmailJS) through it; fold `QuoteBuilderBase.safeExecute` in.
**Files.** `shared_components/js/builders/shared/errors.js`, `quote-builder-base.js`, `builders/emb/pricing.js`.
**Done when.** No `catch` in the builders returns pricing data without `showErrorBanner`; every fallback price renders the visible warning badge.

---

# PHASE 2 — PRODUCT
*Make it genuinely multi-tenant, white-label, and sellable. This phase ends at "a second real shop runs on an isolated tenant with their own branding + prices." The config spine (0.3) is the prerequisite for everything here.*

### 2.1 — Per-tenant authorization boundary on the proxy — close the IDOR  `[P0 · XL · serves: Security, Productization] — THE GATING ITEM`
**Why.** Sequential quote IDs (`EMB-/SCP-/DTF-NNNN`) on one shared proxy with no tenant scoping mean any licensee can enumerate and read another shop's quotes and customer PII. This is the single disqualifying flaw for reselling; no second paying tenant ships until it's closed.
**Do.** In `caspio-pricing-proxy` add a `Tenants`/API-key table and a `tenantId` column on `quote_sessions`/`quote_items` (and any customer table). Add tenant-resolution middleware deriving `tenantId` **server-side** from a per-tenant API key or signed JWT — **never** from a request body/query param the client can spoof. Inject a mandatory `AND tenantId='<caller>'` into every Caspio read/write on quote/customer/quote-sequence routes; return **404 (not 403)** on cross-tenant IDs so existence isn't leaked. Issue per-tenant keys; NWCA runs under a default tenant id so existing calls keep working. Frontend sends the tenant credential on every fetch via one shared helper in `quote-cart-engine.js` sourced from `TENANT`.
**Files.** `../caspio-pricing-proxy/src/routes/quotes.js`, `.../quote-sequence.js`, `.../middleware/tenant.js`, `../caspio-pricing-proxy/server.js`, `quote-cart-engine.js`, `config/tenant.js`, `tests/api/`.
**Done when.** An integration test provisions two tenants and proves tenant B gets 404 fetching tenant A's `EMB-####`; existing NWCA flows pass under the default tenant.

### 2.2 — Four vendor adapter interfaces (route all I/O through them)  `[P0 · XL · serves: Productization]`
**Why.** 269 ShopWorks + 140 SanMar refs mean the app only works for a shop running NWCA's exact stack. Adapters let a buyer plug in their own order system/catalog/DB/email — or run standalone. This is THE resale unlock.
**Do.** Create `shared_components/js/adapters/` with four contracts + an NWCA impl each: **OrderPushAdapter** `{push(quote):Promise<{externalId}>, capabilities}` — move ShopWorks/OnSite/ManageOrders behind `ShopWorksOrderAdapter`; add `NoopOrderAdapter` (standalone: save + PDF, no push). **CatalogAdapter** `{searchProducts,getColors,getSizes}` — `SanMarCatalogAdapter` + `CsvCatalogAdapter` (uploaded product CSV). **DataStoreAdapter** `{saveQuote,loadQuote,sequence,getPriceBook}` — `CaspioDataStoreAdapter`. **EmailAdapter** `{sendQuote}` — `EmailJsAdapter` + stub `SmtpEmailAdapter`. A factory `getAdapters(TENANT)` returns the set named in `TENANT.orderSystem.adapter` etc. Builders call `adapters.orderPush.push(...)`, never ShopWorks directly.
**Files.** `shared_components/js/adapters/{order-push,catalog,datastore,email}.js`, `../caspio-pricing-proxy/lib/manageorders-push-client.js`.
**Done when.** With `orderSystem.adapter='noop'` + `catalog.adapter='csv'`, a full EMB quote builds, prices, saves, PDFs, and emails with zero SanMar/ShopWorks calls.

### 2.3 — Portable, deterministic pricing: PriceBook + price-list versioning + canonical breakdown  `[P0 · XL · serves: Pricing, Productization]`
**Why.** Each shop must set its own prices/margins or the product prices at NWCA's numbers (commercially useless), and a resold pricing product's #1 promise is determinism — a quote must reprice to the identical cent months later even after Caspio prices change. Today pricing is welded to Caspio table names and **nothing records which prices produced a saved quote** (grep for `priceListVersion`/`effectiveDate`/`pricedOn` returns zero).
**Do (three tightly-coupled pieces; keep NWCA output byte-identical):**
- **PriceBook schema.** Define portable JSON `{ tiers:[{min,max,marginDenominator}], serviceCodes:{code:{tierPrices|flat}}, ltm:{threshold,fee}, upcharges, methods:{emb,dtf,scp} }`. Refactor `{method}-pricing-service.js` + `quote-cart-engine.js` so `singleItemPreview` consumes a `PriceBook` object rather than calling Caspio endpoints directly; `CaspioDataStoreAdapter.getPriceBook(tenant,method)` maps Caspio → PriceBook. Preserve "3 surfaces one engine" — all three take the same PriceBook.
- **Versioning + snapshot.** Give the Caspio pricing tables (`Pricing_Tiers`, `Service_Codes`, `Embroidery_Costs`, the `/api/pricing-bundle` payload) a version id + effective_date; have `/api/pricing-bundle` and `/api/service-codes` return `priceListVersion` (e.g. `pb_2026_07_07`). `singleItemPreview` captures the version + the raw bundle it priced with and writes both to the saved quote (new `quote_sessions` columns `Price_List_Version` + `Priced_At` + a per-item input snapshot JSON). Add `GET /api/pricing-bundle?version=…` returning the historical bundle so reopen/duplicate **reprice from the snapshot, not live**.
- **Canonical breakdown object.** `singleItemPreview` returns one schema `{ garment:{base,upcharges[]}, decoration:{method,stitches/colors/locations[]}, fees:[{code,label,amount}], subtotal, tax:{rate,jurisdiction,amount,exempt}, total, rounding, priceListVersion }`. The 3 builders and `embroidery-quote-invoice.js` render **from** this object instead of recomputing, so the printed breakdown is engine-authoritative.
**Files.** `quote-cart-engine.js`, `embroidery-/dtf-/screenprint-pricing-service.js`, `embroidery-quote-invoice.js`, `../caspio-pricing-proxy/src/routes/pricing-bundle.js`, `.../service-codes.js`.
**Done when.** `web-quote-cart-parity` + `quick-quote-parity` pass unchanged for NWCA; a Jest test saves a quote, mutates the live bundle fixture, reloads by id, and asserts the recomputed total equals the original to the cent; a hand-authored demo PriceBook prices a quote end-to-end with **no Caspio call**; `sum(breakdown components) === line.total` in every method.

### 2.4 — Pluggable tax engine + currency/units + deterministic money module  `[P0 · L · serves: Pricing, Productization]`
**Why.** 52 Milton/10.2%/DOR references hardwire Washington tax inside the 3 builder JS — a shop in Texas or Ontario gets **wrong tax** (a legal/margin defect), and hardcoded `$`/inches block any non-US buyer. Rounding is ad hoc (`r2()`, `Math.round(x*rate*100)/100`, DTG floor-not-round, cap `CeilDollar`) scattered across services.
**Do.** Create `shared_components/js/tax-engine.js` `computeTax({subtotal,shipping,ship_to,tenant,exemptionCert})` resolving a per-tenant rule set: origin-vs-destination sourcing, per-line taxability, tax-exempt flag (cert stored on the quote), and VAT/inclusive mode. Move the WA DOR lookup + `(subtotal+shipping)*rate` rounding out of the builders into this module as the `US-WA` rule; grep the 3 builders for `10.2`/`Milton`/`tax` and replace every inline computation with a call. Create `shared_components/js/money.js` with integer-cent arithmetic and **named** rounding policies (`bankers`, `ceilDollar`, `floorCent`) + a currency descriptor (code, symbol, decimals, separators); replace the local `r2`/round/floor helpers in `quote-cart-engine.js` and each service, preserving each documented rule (DTG LTM floor, cap CeilDollar) as an explicit named policy. Route all money/dimension formatting through `TENANT.currency`/`TENANT.units` helpers in `quote-builder-utils.js`.
**Files.** `shared_components/js/tax-engine.js`, `money.js`, `quote-cart-engine.js`, the pricing services, the 3 builder JS, `memory/wa-sales-tax-rules.md`.
**Done when.** A zero-rate exempt tenant, a flat-6% tenant, and a 20% VAT-inclusive tenant all price correctly through the same engine; a flat-8.25% + `£` tenant renders correct tax/currency across builders and PDFs with **no WA/DOR code path hit**; the 5,881 tests still pass and a new test covers each rounding policy's edge cases (x.005, x.999).

### 2.5 — Tenant theming / white-label design tokens  `[P1 · M · serves: Productization, UI/UX]`
**Why.** A resold app that says "Northwest Custom Apparel" in forest-green is a non-starter for a competitor shop; theming off config is low-effort once `TENANT` exists and is the most visible thing in a demo.
**Do.** The PNW palette is already CSS custom properties in `quote-builder-shell.css`/`art-hub.css`. Add `shared_components/js/tenant-theme.js` that, after `TENANT` loads, sets `document.documentElement.style` for each token from `TENANT.branding.palette` (primary/accent/ground/ink) and injects `--tenant-logo`. Replace the print/PDF header's hardcoded `cdn.caspio.com` NWCA logo and any inline brand color/logo with the token/config value. Ship 3 seed themes (forest/NWCA, slate, crimson).
**Files.** `shared_components/css/quote-builder-shell.css`, `shared_components/js/tenant-theme.js`, `config/app.config.js`, `embroidery-quote-invoice.js`.
**Done when.** Swapping `TENANT.branding` re-skins all 3 builders **and** the print/PDF output with no CSS edit; no literal brand `#hex` remains in the builder HTML.

### 2.6 — Minimal shop-owner admin console (branding + pricing)  `[P1 · L · serves: Productization]`
**Why.** Self-serve resale means the buyer edits their own branding/prices — not by asking you to change Caspio. This is what makes it a product vs a consulting engagement. (Full tabs come in 3.33; ship the minimal editor now.)
**Do.** Create `dashboards/tenant-admin.html` (+ external js/css, follow the `dash-page` skill/shell) with two v1 tabs: **Branding** (name/logo upload/palette pickers → `TENANT.branding`) and **Pricing** (edit the PriceBook per method with **live preview via the existing engine**). Persist via `PUT /api/tenants/:id/config`. Gate behind the existing `Staff_Page_Access`/RBAC with an `owner` role.
**Files.** `dashboards/tenant-admin.html`, `dashboards/js/tenant-admin.js`, `../caspio-pricing-proxy/src/routes/tenants.js`.
**Done when.** An owner can change their logo and raise the EMB LTM fee entirely from the UI, and all 3 builders reflect it on next load with no deploy.

### 2.7 — Demo/trial tenant with a fully standalone stack  `[P2 · M · serves: Productization, Sales]`
**Why.** Every SaaS sale starts with a no-signup demo, and it doubles as the single best proof the adapter layer is real — the app running with NWCA's vendors OFF.
**Do.** Create a `demo` tenant using `NoopOrderAdapter`, `CsvCatalogAdapter` (seeded 20-product CSV), an in-browser/localStorage DataStore adapter, and PDF-only email; seed a sample customer + a couple quotes. `?tenant=demo` (or `demo.*` host) loads it with a persistent "DEMO — resets nightly" banner and disabled real pushes.
**Files.** `config/demo-tenant.js`, `shared_components/js/adapters/datastore.js`, `tools/seed-demo-data.js`.
**Done when.** The app builds/prices/saves/PDFs a quote for all 3 methods with the backend proxy **off**.

### 2.8 — Live 3-surface diff-parity test (not just fixtures)  `[P1 · M · serves: Pricing, Testing]`
**Why.** The current parity locks assert the engine against 2026-06-11 fixtures and string-match a copy-pasted `findPricingTier` — that catches engine regressions but **not** a builder that stops calling the engine. Multi-tenant needs a guarantee all three surfaces produce byte-identical numbers.
**Do.** Add `tests/unit/three-surface-parity.test.js` that, over a matrix (method × qty tiers × locations × LTM boundary), invokes the **same entrypoint each surface uses** and asserts all three totals+breakdowns deep-equal `singleItemPreview`. Replace the fragile source-string canary with a behavioral assertion (call the real tier function). Wire into the `/deploy` pre-flight so a pricing change blocks release unless all three match.
**Files.** `tests/unit/web-quote-cart-parity.test.js`, `quick-quote-parity.test.js`, `three-surface-parity.test.js`, `quote-cart-engine.js`, `.claude/skills/deploy`.
**Done when.** Deliberately breaking one builder's tier lookup fails this test.

### 2.9 — Feature-flag layer for safe per-tenant rollout  `[P1 · M · serves: Testing/Reliability, Productization]`
**Why.** Reselling means rolling a risky change to tenant A while B stays stable, and killing a bad feature without a redeploy — impossible today.
**Do.** Add `shared_components/js/feature-flags.js` reading a Caspio `Tenant_Feature_Flags` table (Tenant, Flag_Key, Enabled) via the proxy, cached with a short TTL, exposing `isEnabled('scp_auto_merge',{tenant})`. Gate net-new/risky behaviors behind it; provide a hardcoded default map as the offline fallback (with a console warning per the fallback-must-warn rule) — same "change with no deploy" philosophy as `Service_Codes`.
**Files.** `shared_components/js/feature-flags.js`, `config/app.config.js`, `../caspio-pricing-proxy/src/routes/service-codes.js`.
**Done when.** Toggling a flag row in Caspio enables/disables the feature in the browser within one cache TTL, no redeploy.

### 2.10 — Caspio migration + tenant-onboarding runbook + schema_version check  `[P2 · M · serves: Testing/Reliability, Productization]`
**Why.** Pricing/features depend on exact Caspio table/field names (many documented 500s from mismatches), yet there's no migration or rollback story — onboarding a tenant is currently an undocumented, irreversible manual edit.
**Do.** Create `/migrations/` with numbered append-only change files (forward change, exact Caspio REST/datapage steps, verification query, explicit rollback). Add a `schema_version` row in a Caspio Meta table and a `server.js` startup check that Slack-warns if the running app's expected version ≠ Caspio's. Document the per-tenant provisioning sequence (required tables, seeded `Service_Codes`/`Pricing_Tiers`) as a repeatable checklist.
**Files.** `migrations/001-tenant-feature-flags.md`, `migrations/README.md`, `server.js`.
**Done when.** A fresh tenant provisions by following `/migrations` sequentially, and a schema mismatch is surfaced at boot.

---

# PHASE 3 — DELIGHT + SCALE
*Make reps love it, make it fast, make it work on an iPad, deepen pricing, and finish the go-to-market surface. Everything here rides on the Phase 0–2 foundation.*

## UX polish (serves: UI/UX, with A11y already wired in 1.8)

### 3.1 — Keyboard-first happy path + hotkeys + keystroke budget  `[P0 · L]`
**Why.** Reps quote live on the phone; every extra click is dead air, and a demo where a full quote goes out in ~20 keystrokes is the wow that closes a sale. You can't cut what you don't measure.
**Do.** Record the current happy path (style→color→qty→location→save→email) clicks+keystrokes per builder in `QUOTE_PATH_BUDGET.md`. Then: (1) autofocus the style# input on load, Enter commits → focus qty, tab order follows visual order; (2) add `setupHotkeys()` in `quote-builder-utils.js` bound in each builder — Ctrl+Enter recalc+save, Ctrl+D duplicate last row, Ctrl+Shift+E save+email, Alt+N new line, `?` shortcut sheet; (3) collapse save+email into one "Save & email" primary button running `saveAndGetLink()` then the email step with no intermediate modal click.
**Files.** `quote-builder-utils.js`, `embroidery-quote-builder.js`, `embroidery-quote-invoice.js`, the 3 builder HTMLs, `QUOTE_PATH_BUDGET.md`.
**Done when.** Keystrokes to a saved+emailed 1-line quote drop ≥40% vs baseline and every step is mouse-free.

### 3.2 — Per-region skeletons + optimistic pricing (retire the blocking overlay)  `[P0 · L · also serves: Performance]`
**Why.** `showLoading(show)` (utils ~1191) throws one full-screen overlay for every async op, reads as slow/enterprise, and blocks the rep from typing the next line while the customer waits.
**Do.** Add `renderSkeleton(target,kind)` in `quote-builder-utils.js` injecting shimmer placeholders sized to real content (price cells, tier grid, invoice totals) via a `.skeleton` class in `-common.css` (respects reduced-motion). During recalc keep the row editable and show the price cell in a skeleton/pulse (extend the shipped "Updating prices…" pill) instead of the global overlay; reserve the blocking overlay for save/push only. Optimistic path: on qty change immediately show the last-known unit price greyed with a subtle spinner, reconcile when Caspio returns.
**Files.** `quote-builder-utils.js`, `-common.css`, the 3 builder JS.
**Done when.** No full-screen overlay during recalcs; a rep can start a second line while the first is still pricing.

### 3.3 — Undo action-toasts + a real toast stack  `[P0 · M]`
**Why.** Under phone pressure reps mis-click; today `removeProduct`/`confirmNewQuote` destroy silently or behind a scary `confirm()`. "Deleted — Undo" removes fear and is a hallmark of loved software.
**Do.** Refactor `showToast` (utils ~142) into a queue manager: cap 3 visible, stack, dedupe identical consecutive (`×N`), type-based durations (errors sticky, success 3s), manual close, hover-to-pause; keep the assertive/polite aria roles + escapeHtml. Add `showActionToast(msg,{label,onAction,timeout=6000})` that stashes a soft-deleted snapshot. Wire into row delete (stash the JS-state entry — DTF Map / EMB array — re-insert + recalc on Undo) and `confirmNewQuote` (snapshot whole state, restore on Undo; replace the blocking `confirm()` with a non-blocking toast unless there are unsaved changes).
**Files.** `quote-builder-utils.js`, `-common.css`, the 3 builder JS.
**Done when.** Deleting a line + Undo within 6s restores it byte-identical (incl. price); starting a new quote is reversible; 5 toasts in 1s stack cleanly.

### 3.4 — First-run onboarding coach-marks + empty states + help affordance  `[P0 · L]`
**Why.** It's a resale product now — a new shop's rep landing on a blank builder with no data and no guidance churns in the trial.
**Do.** Create `shared_components/js/quote-builder-onboarding.js` + CSS. On first load per browser (`localStorage nwca-onboarded-{method}`) show a 3–4 step coach-mark tour anchored to real elements (style input, nudge chips, Save & email, Switch-method) using PNW tokens — dismissible, "Skip tour", never twice. Replace the bare empty table with an illustrated empty state ("Add your first product — type a style like PC61") that focuses the input on click. Add a persistent `?` in the shell header reopening the tour + shortcut sheet.
**Files.** `quote-builders/embroidery-quote-builder.html`, `quote-builder-guided.css`, `quote-builder-onboarding.js`, `quote-builder-utils.js`.
**Done when.** A first-time user with zero data reaches their first priced line without docs.

### 3.5 — Rep context memory + smart defaults  `[P1 · M]`
**Why.** Reps repeat the same choices all day; memory is invisible delight that shaves clicks off every quote.
**Do.** Add `getRepPref`/`setRepPref` (localStorage, namespaced per method) in `quote-builder-utils.js`; pre-fill last-used location/print size, last discount type, fees-panel expanded state, and the rep's own name/email. On "New Quote" keep rep identity + default location, clear customer + line items. Show a one-time-per-session "Restored your last settings" hint. Ensure every remembered value still resets in `resetQuote()` so parity holds.
**Files.** `quote-builder-utils.js`, the 3 builder JS.
**Done when.** A rep who always quotes left-chest EMB never re-picks location; rep name/email never re-typed within a session.

### 3.6 — Inline real-time validation with recovery guidance  `[P1 · M · a11y ARIA already done in 1.8]`
**Why.** Discovering a missing email or zero-qty only when Save fails is a phone-call-killer.
**Do.** Add `validateField(el)` + `validateQuote()` running on blur/input; show inline messages under the field (qty=0 → "Quantity must be at least 1", bad email → "Check this email address"). Disable "Save & email" with a tooltip listing exactly what's missing rather than letting the click fail. Keep the visible-error path for API/system failures (toast/banner); distinguish soft user-fixable validation (inline) from system errors.
**Files.** `quote-builder-utils.js`, the 3 builder JS, `-common.css`.
**Done when.** It's impossible to reach a failed save from an empty required field; every blocked action names the one thing to fix.

### 3.7 — Design-system gallery + finish the inline-style migration  `[P1 · L · serves: UI/UX, Mobile, A11y]`
**Why.** Tokens exist but are undocumented and inconsistently applied; a living reference is a great demo artifact and stops visual drift. (Finishes 1.7.)
**Do.** Create `pages/design-system.html` (external CSS/JS) rendering the canonical set from real token vars: color/type/spacing scales, buttons (primary/secondary/danger/ghost), inputs+validation states, toast variants, skeleton, empty state, coach-mark, modal, tier/nudge chips, invoice table — each documented with exact class + token names, in light **and** dark. Convert the remaining highest-traffic inline styles to token-backed utility classes.
**Files.** `pages/design-system.html`, `quote-builder-shell.css`, `-common.css`, the 3 builder HTMLs.
**Done when.** The gallery shows every component in both themes using only tokens; total inline `style="` in the builders is near zero.

### 3.8 — Microcopy pass + copy dictionary; kill `alert`/`confirm`  `[P1 · M · also the white-label wording seam]`
**Why.** Copy is 80% of perceived polish; generic "An error occurred" and raw `confirm()` read as an internal tool.
**Do.** Centralize user-facing strings in `shared_components/js/quote-builder-copy.js` (keys→strings) and route toasts, empty states, validation, and button labels through it. Rewrite for the phone-rep voice — success ("Quote EMB1234 saved — link copied"), errors that name the next action ("Couldn't reach pricing. Check your connection and hit Retry"). Kill every native `alert()`/`confirm()` in the builders. Keep numbers/prices out of the dictionary.
**Files.** `quote-builder-copy.js`, `quote-builder-utils.js`, the 3 builder JS.
**Done when.** No raw browser alert/confirm remains; every error string names a next action; one file controls all copy (the future white-label wording seam).

### 3.9 — Purposeful, reduced-motion-safe micro-interactions  `[P2 · M]`
**Do.** In `-common.css`, keyed to tokens and gated on `prefers-reduced-motion`: (1) recalced unit-price change flashes/counts-up green; (2) crossing a nudge tier animates the active chip + shows "You just unlocked the 24+ price"; (3) success checkmark morph on Save & email; (4) row add slides in / delete collapses (pairs with the Undo toast). Every animation ≤250ms, interruptible.
**Files.** `-common.css`, `quote-builder-utils.js`, EMB modules.
**Done when.** Correct actions get immediate proportional feedback; OS reduce-motion removes all of it with no layout breakage.

### 3.10 — Present/customer mode  `[P3 · M]`
**Do.** A "Present" toggle that renders the current quote as a full-bleed, token-styled summary (customer, line items, per-unit + totals, logo-status chips, a short-link/QR) with builder chrome hidden — reusing `embroidery-quote-invoice.js` totals so numbers can't drift, pulling shop name/logo from `TENANT`. Print-clean and projector-legible.
**Files.** `embroidery-quote-invoice.js`, `quote-builder-shell.css`, the builder HTMLs.
**Done when.** One keystroke flips any in-progress quote into a clean presentation view matching the PDF exactly.

## Performance runtime (serves: Performance)

### 3.11 — In-flight dedupe + in-memory memo on `fetchPricingData`  `[P0 · M]`
**Why.** One interaction re-runs `fetchPricingData` ~20×, each doing `sessionStorage.getItem` + `JSON.parse` of the whole bundle — the root of live-quote lag.
**Do.** In `dtf-/screenprint-/dtg-pricing-service.js` add two layers above sessionStorage: (1) a static in-memory `Map<cacheKey, parsedObject>` so repeat reads are O(1) with no parse; (2) an in-flight `Map<cacheKey, Promise>` — before `fetch()`, return the pending promise so 20 concurrent calls for PC61 collapse to one request. Keep the 5-min sessionStorage TTL.
**Files.** the 3 pricing services.
**Done when.** Building a 5-product quote fires ≤1 network request per distinct style and zero JSON.parse after first hit per style.

### 3.12 — Debounce recalc across all builders  `[P0 · M]`
**Why.** Qty/size keystrokes each re-price the whole cart synchronously; debouncing is the core INP win.
**Do.** Add `scheduleRecalc(fn,180)` (trailing-edge, cancels on save/print) in `quote-builder-utils.js`; route keystroke-driven paths (size-grid qty, extra-color, location) through it; keep blur/save/print on the **synchronous** path so money math is never stale. Apply identically to all builders (`dtf-quote-builder.js` invokes `updatePricing()` at ~202/851/879/989/1742/2269/2319).
**Files.** the 3 builder JS, `quote-builder-utils.js`.
**Done when.** Typing "144" fires one recalc; save/print still reflect the exact typed value.

### 3.13 — Incremental size-grid render (no full innerHTML rebuild)  `[P1 · M]`
**Do.** Audit `updatePricing()` for full-table `innerHTML` replacement; build row/cell DOM once, cache element refs in a `Map<rowId,{unitEl,totalEl}>`, and on recalc write only changed `textContent`; batch writes outside the debounced read phase.
**Files.** the 3 builder JS.
**Done when.** Editing one qty in a 6-product quote updates only that row's cells; per-keystroke scripting < ~16ms.

### 3.14 — Lazy-load + size-constrain thumbnails; batch + prefetch bundles; virtualize large lists  `[P1–P3 · M total]`
**Do.** On product/color `<img>` thumbnails (dtf search render ~1072 + EMB/SCP equivalents) add `loading="lazy" decoding="async"` + explicit width/height and request thumbnails at display size. In `quote-cart-engine.js` `priceCart()` (~1102), collect independent group promises and `await Promise.all(...)` (the dedupe layer prevents duplicate hits; keep per-group error isolation). Fire `pricingService.fetchPricingData(style)` fire-and-forget on product/color select so the bundle is warm before `updatePricing()`. If product search can return >100 items, window the render (IntersectionObserver sentinel or fixed-height scroller).
**Files.** `dtf-quote-builder.js`, `quote-cart-engine.js`, the pricing services.
**Done when.** The picker defers off-screen images (CLS ~0); a 4-group quote issues concurrent requests; first recalc after select hits 0 network; a 500-result search keeps DOM node count roughly constant.

### 3.15 — RUM (web-vitals) + Lighthouse CI budget  `[P1 · M · adds a CI job]`
**Do.** Inline the ~2 KB `web-vitals` lib into the shared bundle (no external CDN); record INP/LCP/CLS via `PerformanceObserver` and post to a light `/api/rum` (or console in dev). Add `@lhci/cli` as an npm script + CI job that boots `server.js`, runs the 3 builder pages, and asserts LCP < 2.5s, INP < 200ms, and a per-page JS-size cap from the minified baseline. Wire into the `/deploy` pre-flight.
**Files.** `package.json`, `server.js`, `.github/workflows`.
**Done when.** `npm run lhci` fails if any builder exceeds the JS-size or INP budget.

## Mobile / Responsive (serves: Mobile; a11y touch-targets already in 1.8)

### 3.16 — Numeric keypads for size/qty cells  `[P0 · M]`
**Why.** Entering a size run is the #1 mobile interaction; `type="number"` shows spinners, still pops the full iOS keyboard, and accepts `e`/`+`/`-`.
**Do.** Where size cells are emitted (grep `<input type="number"` in the 3 builder JS for Size01-06/qty), change to `type="text" inputmode="numeric" pattern="[0-9]*"`; keep `parseInt` + the `??`-vs-`||` zero-safety. Leave tax-rate/art-charge/stitch-count as `inputmode="decimal"`.
**Files.** the 3 builder JS.
**Done when.** Focusing a size cell opens the numeric keypad; no spinners; the row is visibly narrower.

### 3.17 — Sticky mobile total/price bar  `[P0 · L]`
**Why.** The sidebar sticky is useless when the sidebar stacks below the form at ≤768px — the live total scrolls off exactly when the rep is quoting.
**Do.** Add a shared `.qb-mobile-total-bar` in `-common.css`, shown only `@media (max-width:768px)`, `position:fixed;bottom:0`, `padding-bottom:env(safe-area-inset-bottom)`. Render once per builder (sync all 3): grand total (large), qty count, primary CTA to the Save/Email action. Wire it to the **same state math** feeding the sidebar (EMB/SCP recalc; DTF `calculateFromState()`+`computeFeesAndTotals()`) — never re-read the number from DOM text. Add `body{padding-bottom:72px}` under the breakpoint.
**Files.** `-common.css`, the 3 builder HTMLs.
**Done when.** On a 390px viewport the total stays pinned and updates when a size qty changes.

### 3.18 — Real responsive size grid (container queries) + full-height-safe modals + viewport plumbing + breakpoint system  `[P1–P2 · L total]`
**Do.** Size grid: at ≤768px switch cells to a wrapping grid `repeat(auto-fill,minmax(64px,1fr))` of stacked label-over-input tiles ≥44px; prefer `container-type:inline-size` on the item card + `@container (max-width:560px)` so a grid inside the narrower guided column also collapses; keep the summary table in an `overflow-x:auto` container that never scrolls the page body. Modals: `@media(max-width:768px)` `max-height:100dvh`, body `overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1`, `.modal-footer{position:sticky;bottom:0}` + safe-area padding (verify the new-style ns-* modal ~1234 and the share/email modal keep the primary button visible with the keyboard open). In each builder `<head>` set `viewport-fit=cover` (no `maximum-scale`/`user-scalable=no`); replace `100vh` with `100dvh` (vh fallback line above). Define a documented breakpoint scale at the top of `-common.css` (phone ≤430 / tablet-portrait 431–768 / tablet-landscape 769–1024 / desktop >1024), reconcile guided.css's lone 860 breakpoint, and add the missing mobile rules to `quote-builder-shell.css` (zero `@media` today). Document the contract in `memory/quote-builder-architecture.md`.
**Files.** `-common.css`, `-shell.css`, `-guided.css`, the 3 builder JS + HTMLs, `memory/quote-builder-architecture.md`.
**Done when.** At 768px portrait a 6-size run needs zero horizontal scroll; every modal's primary action stays reachable; guided columns collapse at the same width the form fields stack.

### 3.19 — Eliminate hover-only affordances + reliable mobile print/PDF  `[P2 · M]`
**Do.** Audit `-common.css` for `:hover` rules that reveal controls/content and the builders for load-bearing `title=` tooltips (logo-status chip explanations); make revealed controls always-visible under `@media (hover:none)` and convert informational tooltips to tap-to-toggle popovers/inline text. Test the print path on iOS Safari for all 3 (shared `embroidery-quote-invoice.js`): force a fixed letter-width print container (not %), add `-webkit-print-color-adjust:exact; print-color-adjust:exact` so PNW backgrounds/logo survive, confirm the real PDF quote #.
**Files.** `-common.css`, the builder HTMLs, `embroidery-quote-invoice.js`.
**Done when.** With `@media(hover:none)` emulated no action/pricing text is hidden; an iPad-generated PDF is visually identical to desktop with correct quote #, totals, and branding.

### 3.20 — Device-matrix + visual-regression smoke tests  `[P2–P3 · M · adds a CI job · serves: Mobile, Testing]`
**Do.** A Playwright spec loading each builder at 390×844 / 768×1024 / 1024×768 asserting: `document.body.scrollWidth ≤ viewport` (no horizontal page scroll), every visible input/button in the size grid + customer panel `offsetHeight ≥ 44`, the mobile total bar visible ≤768px, and no size input is `type=number`. Add Playwright `toHaveScreenshot()` snapshots for each builder's empty state, a populated quote, and the print/PDF view in light + default themes at mobile+desktop; commit baselines under `tests/e2e/__screenshots__`, disable animations, upload diffs on failure.
**Files.** `tests/ui/`, `tests/e2e/visual.spec.js`, `quote-builder-shell.css`, `art-hub.css`.
**Done when.** The spec fails if any mobile P0 is reverted and a token/skin regression produces a failing pixel diff on the PR.

## Pricing depth & invariants (serves: Pricing)

### 3.21 — Quote expiry + effective-date re-quote flow  `[P1 · M]`
**Do.** Add `Valid_Until` (per-tenant default, e.g. 30 days from `Priced_At`) to `quote_sessions`, stamped at save. On quote-view load, if expired show an EXPIRED banner + "Re-quote at current prices" running the engine against the latest `priceListVersion`, rendering a side-by-side old-vs-new line delta (uses the breakdown object from 2.3). Block accept/pay on an expired quote until re-quoted.
**Files.** `quote-cart-engine.js`, `embroidery-quote-builder.html`, `embroidery-quote-invoice.js`.
**Done when.** Loading an expired quote gates the accept action and re-quote produces the new version's numbers.

### 3.22 — Owner cost + margin visibility (staff-only)  `[P1 · M]`
**Do.** Extend the breakdown object with an owner-only `{cost,margin,marginPct}` from base cost + `MarginDenominator` already in the services; gate rendering behind `Staff_App_Roles` RBAC so it shows in the builder but is **stripped** from customer-facing quote-view/PDF; add a low-margin warning chip below a per-tenant threshold.
**Files.** `quote-cart-engine.js`, `embroidery-/screenprint-pricing-service.js`, `memory/STAFF_AUTH_DESIGN.md`.
**Done when.** A customer-host render (the parity test's `CUSTOMER_HOST` gate) asserts no cost/margin field is present.

### 3.23 — Close SCP/DTF/EMB domain-completeness gaps (via `Service_Codes`)  `[P2 · L]`
**Do.** Add, as first-class `Service_Codes`-driven fees (no new hardcoded numbers; each with a fallback + visible warning): **Screen print** — oversized/jumbo surcharge, flash/underbase for dark garments, ink-color-change vs new-screen distinction. **DTF** — gang-sheet/linear-inch pricing mode, metallic/specialty film upcharge. **Embroidery** — 3D-puff, metallic-thread, per-thousand-stitch pricing beyond the fixed tiers for large designs. Each appears itemized in the 2.3 breakdown.
**Files.** the 3 pricing services, `memory/emb-builder-details.md`.
**Done when.** Each new fee resolves from `/api/service-codes` and shows itemized.

### 3.24 — Golden-master snapshots by price-list version + single-engine lint  `[P2 · S–M]`
**Do.** `tests/scripts/capture-pricing-golden.js` runs a fixed input matrix through the engine for a given `priceListVersion` → `tests/pricing-baselines/<version>.json`; a Jest test re-runs and diffs, printing a per-line delta on mismatch (regenerate + commit on an intentional change). Add an ESLint rule / Jest source-scan that fails if any file **outside** `quote-cart-engine.js` / `*-pricing-service.js` contains a price-arithmetic signature (qty×unit+fee) or a hardcoded tax/fee literal, with an allowlist of sanctioned engine files.
**Files.** `tests/pricing-baselines/`, `tests/unit/web-quote-cart-parity.test.js`, `quote-cart-engine.js`, ESLint config.
**Done when.** Re-running capture with an unchanged bundle is byte-stable; adding a stray `qty * 12.50` to a builder fails the scan.

## Go-to-market & scale (serves: Productization, Reliability)

### 3.25 — Full admin console + self-serve onboarding wizard  `[P1–P2 · L]`
**Do.** Extend `dashboards/tenant-admin.html` with the remaining tabs: **Methods** (toggle emb/dtf/scp → `TENANT.methods`; disabled methods hide their tiles), **Email** (provider + template ids + test-send), **Tax** (flat | lookup url | none), **Users** (invite reps). Then `pages/onboarding.html` — a 5-step wizard reusing guided-shell styling: (1) name/logo/color, (2) pick methods, (3) first PriceBook (CSV upload or a seeded "typical margins" template), (4) email or "skip, use PDF", (5) first user — on finish POST a new tenant config and drop them into the EMB builder pre-seeded with a sample customer/product.
**Files.** `dashboards/tenant-admin.html`+js, `pages/onboarding.html`+js, `../caspio-pricing-proxy/src/routes/tenants.js`.
**Done when.** An owner can disable DTF and change email/tax from the UI; a brand-new tenant goes from landing to a saved PDF quote in < 5 min with no dev intervention.

### 3.26 — Licensing / metering / billing hooks  `[P2 · M]`
**Do.** Add `TENANT.license {plan,status:active|trial|suspended,seats,trialEndsAt}` validated server-side on every write (suspended → builders load **read-only** with an upgrade banner — never a silent block). Meter billable events (quote created/emailed/order pushed) to a per-tenant `usage_events` table. Reuse the existing Stripe integration: subscription webhooks flip `license.status`.
**Files.** `../caspio-pricing-proxy/src/middleware/license.js`, `.../routes/tenants.js`, `.../routes/stripe-webhook.js`.
**Done when.** An expired-trial tenant can view but not save and sees an upgrade CTA; monthly quote count is queryable per tenant.

### 3.27 — Staging→prod pipeline with automated rollback  `[P2 · M]`
**Do.** Introduce a Heroku pipeline (`sanmar-inventory-app-staging` auto-deploys `develop` → promote to prod from `main`). Extend the `/deploy` skill so after promote it hits `/readyz` and runs a Playwright smoke subset against the live URL; on failure auto-run `heroku rollback` and Slack-alert. Tag each Heroku release with the same `RELEASE_VERSION` fed to Sentry.
**Files.** `.claude/skills/deploy/SKILL.md`, `tests/e2e/smoke.spec.js`, `server.js`.
**Done when.** Promoting a build whose `/readyz` or smoke fails auto-rolls-back and alerts, no human on the keyboard.

### 3.28 — Docs, packaging, extension seam, SLOs  `[P2–P3 · M]`
**Do.** Publish the buyer/engineer docs: `docs/EXTENDING.md` (the `MethodAdapter` interface + render hooks + `registerBuilder('cap', new CapAdapter())`, with a ~150-line reference adapter and a stable `shared_components/js/builders/public-api.js` re-exporting only the base, adapter types, error helpers); `docs/ADAPTERS.md`, `docs/CONFIG.md` (the `TENANT` schema), `docs/INSTALL.md`; `docs/SECURITY.md` (data classification, data-flow Browser→app→proxy→Caspio/ShopWorks/EmailJS, tenant-isolation model, secret inventory + rotation runbook, CSP/CORS posture, patch cadence, `security@` disclosure, a SOC2-style control checklist); `docs/ACCESSIBILITY.md` (manual keyboard/NVDA/VoiceOver/200%-zoom/400%-reflow/text-spacing script + the axe baseline + a filled WCAG 2.1 AA + 2.2 conformance table as a VPAT starting point); `docs/SLO.md` + `docs/INCIDENT_RUNBOOK.md` (99.9% `/readyz`, pricing p95 < 1.5s, save→email success > 99%, per-`tenant` alert routing). Add `deploy/Dockerfile` + `docker-compose.yml` (static app + proxy), `.env.example`, a one-command `provision-tenant` script, real semver release tags + `CHANGELOG`, and `docs/ROADMAP.md`.
**Files.** `docs/*`, `shared_components/js/builders/public-api.js`, `deploy/*`, `tools/provision-tenant`.
**Done when.** A fresh machine with Docker + the docs brings up a working demo tenant; a non-NWCA prospect can answer their vendor-security and accessibility questionnaires from the docs; a new decoration method is added by one adapter + one HTML entry touching zero base-class code.

---

## DEFINITION OF DONE — A+ ACCEPTANCE CRITERIA

Measure against these; each must be **automated or demonstrable**, not asserted.

- **Architecture.** No builder module > ~600 lines; `render.js` has zero fetch/await; one `QuoteBuilderBase` + three adapters, each `index.js` < ~400 lines; a shared-behavior change is a one-file edit visible in all three; **0** inline `onclick=` in the builder HTML; **0** new `window.*` globals pass lint; `npm run typecheck` clean.
- **UI/UX.** Saved+emailed 1-line quote in ≥40% fewer keystrokes than the recorded baseline and fully keyboard-reachable; no full-screen overlay during recalcs; delete + Undo restores byte-identical; a first-run user reaches a priced line with no docs; no raw `alert`/`confirm` remains.
- **Accessibility.** `jest-axe` + Playwright-axe **clean** (no serious/critical) on all 3 builders in CI; full quote buildable keyboard-only; VPAT conformance table in `docs/ACCESSIBILITY.md`; all interactive targets ≥24px (44px for primary).
- **Performance.** Lighthouse ≥95 / LCP < 2.5s / INP < 200ms on each builder in `lhci`; ≤1 pricing request per distinct style per interaction; one recalc per burst of keystrokes; production console clean; hashed immutable assets.
- **Security.** Cross-tenant read returns **404** (proven by test); CSP + HSTS + nosniff present; CORS rejects look-alike and arbitrary-Heroku origins in prod; XSS payloads render inert in live quote + PDF + email; `npm audit` gate green; no Caspio/ShopWorks secret in any browser-served asset.
- **Testing/Reliability.** Blocking CI (test + lint + typecheck + parity + axe + e2e) required on `main`; Sentry errors tagged by release + tenant with PII scrubbed; `/readyz` flips to 503 + Slack alert when the proxy dies; E2E covers save→email→push for all 3; the 5,881 tests stay green throughout.
- **Productization.** A new tenant is onboarded in **< 30 min with zero code changes** (branding + prices + methods from the admin/wizard); `?tenant=demo` runs the full app with the proxy off (adapters proven); no `service_jgrave3`/proxy-host literal anywhere outside `config/`.
- **Mobile.** No horizontal page scroll and no sub-44px targets at 390 / 768 / 1024; sticky total bar pinned + live ≤768px; numeric keypad on size cells; iPad PDF identical to desktop.
- **Pricing integrity.** A quote saved today reprices to the **exact cent** after the live price list changes (snapshot test); `sum(breakdown) === total` per method; the same PriceBook drives all 3 surfaces (live diff-parity test); a flat-rate/VAT/exempt tenant taxes correctly with no WA code path.

---

## SELLABLE v1 CUT LINE

Ship the **minimum that makes it sellable to a second real shop**, then stop and land a design partner before gold-plating:

**v1 = ship these:** 0.1 build pipeline · 0.3 config spine + no-hardcoded-hosts · 0.4 EMB+SCP+DTF decomposition to base+adapters · 0.6 CI/lint/types · **1.1 helmet/CSP · 1.2 CORS fix · 1.4 XSS audit** · 1.10 Sentry · 1.11 health/uptime · 1.13 E2E money path · **2.1 tenant isolation (the gate)** · 2.2 adapters (NWCA + Noop/CSV) · 2.3 PriceBook + versioning + breakdown · 2.4 tax/currency engine · 2.5 tenant theming · 2.6 **minimal** admin (branding + pricing only) · 2.7 demo tenant. Plus the mobile P0s (3.16 keypad, 3.17 sticky total) and UX P0 undo/skeleton (3.2, 3.3) because a demo iPad and a live phone call are where the sale is won.

**Defer to v1.1+:** full admin tabs (methods/email/tax/users) · self-serve onboarding wizard (a manual `provision-tenant` script is fine for the first 3 design partners) · billing/metering (invoice manually) · SMTP/non-EmailJS email · non-USD currency · micro-interactions/present mode · virtualization · golden-master tooling · staging pipeline + SLO dashboards · domain-completeness fees. Record this in `docs/ROADMAP.md`.

**The one hard gate:** no second paying tenant goes live before **2.1 tenant isolation** is proven by the cross-tenant-404 test. Everything else can trail; that one cannot.

---

## HOW TO WORK

Go **phase by phase, task by task** — do not start Phase 2 multi-tenancy before the Phase 0 config spine and module seams exist, and do not start UX/mobile/perf polish (Phase 3) before Trust (Phase 1) is green. Within a task, work the strangler way: extract behind the current surface, keep the old path until the new one is proven, migrate EMB first then SCP then DTF. **Keep the 5,881 tests and both parity locks green on every commit** — if a change touches any pricing path, re-run `web-quote-cart-parity` + `quick-quote-parity` and verify all three surfaces. **Add tests for everything new** (unit for extracted modules, jsdom for DOM logic, Playwright for flows, axe for a11y) and wire each new check into the CI pipeline from 0.6 so it can't regress. Verify with a **real browser**, not just assertions. When a task creates/deletes/moves a file, update `ACTIVE_FILES.md` + `shared_components/js/GUIDE.md` in the same commit; after fixing a bug, append to `memory/LESSONS_LEARNED.md`. Ask before anything destructive (file/column deletes, force-push, flipping a proxy secret). **Ship via the existing `/deploy` skill** — never hand-roll a deploy. When in doubt, prefer the smaller, reversible, independently-shippable PR over the big-bang change.