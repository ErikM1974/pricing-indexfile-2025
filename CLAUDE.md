# CLAUDE.md

Guidance for Claude Code when working in this repository.

## 🔴 Top 9 Never-Break Rules

1. **NO version-suffix files** — Never create `-backup`, `-FINAL`, `-FIXED`, `-old`, `-v2`. Use Git branches.
2. **NO test files in root** — ALL tests go in `/tests/` (ui/api/unit subdirectories). No exceptions.
3. **NO inline code** — Zero `<style>` or `<script>` tags with content in HTML files.
4. **NO silent API failures** — Always show errors when an API fails. Never fall back to cached/stale data silently. Wrong pricing is worse than an error.
5. **ALWAYS update ACTIVE_FILES.md** — Every file create/delete/move updates documentation immediately.
6. **USE CONFIG for API URLs** — Don't hardcode `caspio-pricing-proxy` URL. Use `APP_CONFIG.API.BASE_URL`.
7. **SYNC calculator + quote builder prices** — If both exist for a method, test identical inputs match.
8. **SYNC all 4 quote builders** — A change to one (DTG/DTF/EMB/SCP) usually applies to all four. Always check.
9. **3 PRICE SURFACES = ONE engine** — Customer Catalog, Quick Quote, and the Quote Builders all price through `QuoteCartEngine.singleItemPreview` → Caspio (identical *by construction*). ANY price change (Caspio OR a `*-pricing-service.js`) MUST re-run `web-quote-cart-parity` + `quick-quote-parity` and verify ALL 3 — never just one. Never add a 4th pricing path or a hardcoded price.

## Pre-Flight Checklist

**Before creating a file:**
- Test file? → `/tests/`. Calculator? → `/calculators/`. Quote builder? → `/quote-builders/`. Dashboard? → `/dashboards/`. Page? → `/pages/`.
- Shared JS/CSS? → `/shared_components/{js,css}/`. Page-specific? → same folder as the HTML.
- Root HTML allowed ONLY for `index.html`, `cart.html`, `product.html`. Everything else → subdirectory.
- Use kebab-case. External JS/CSS only (no inline).
- Check ACTIVE_FILES.md for existing functionality first.

**Before committing:**
- Remove `console.log` debug statements.
- Update ACTIVE_FILES.md (and `shared_components/js/GUIDE.md` for new shared JS).
- No hardcoded API URLs.
- Pricing change? Verify `printQuote()` and `saveAndGetLink()` use the same inputs as `recalculatePricing()`.
- Quote builder change? Check if it applies to the other 3 (see Quote Builder Sync below).
- ManageOrders discovery? Document per [ManageOrders Documentation Routing](#manageorders-documentation-routing).

**After fixing a bug:**
- Append entry to [LESSONS_LEARNED.md](/memory/LESSONS_LEARNED.md): Problem / Root Cause / Solution / Prevention.
- LESSONS_LEARNED hard limit: 300 lines. If over 250 lines before adding, archive oldest resolved entry to `/memory/LESSONS_LEARNED_ARCHIVE.md` (no limit).
- Keep only: recurring bugs, active architecture rules, gotchas likely to recur. Archive: one-time fixes, historical migrations.

## Auto-Update Memory (Don't Ask, Just Do)

Memory updates are part of completing the task — not a separate ask-permission step. Route each fact per the table below, then notify Erik in one sentence (e.g. "Updated LESSONS_LEARNED.md and MEMORY.md"). **Full architecture, routing & budgets → [memory/MEMORY_SYSTEM.md](memory/MEMORY_SYSTEM.md)** — read it when unsure where a fact goes or when memory feels bloated.

### Where things go (one fact, one home — never restate a fact in a second file)

| What you learned | Where |
|---|---|
| Never-break rule / always-true convention | **CLAUDE.md** Critical Patterns |
| Bug + root cause + fix + prevention | **LESSONS_LEARNED.md** (< 300 lines; archive oldest resolved when > 250) |
| One-line "shipped / decided / gotcha" | **MEMORY.md** index (< 24 KB; age old lines down) |
| > 2 lines of feature/domain detail | **topic file** in `/memory` + add to `INDEX.md` + 1-line pointer in MEMORY.md |

Procedures → a **skill** in `.claude/skills/`; integration fields (ManageOrders/Caspio) → the routing table in MEMORY_SYSTEM.md. **Code = pointers, not bodies** (`file:line` + WHY + gotcha; re-fetch with Grep/Explore). **Repo `/memory` is canonical** over the volatile `~/.claude` auto-memory (repo copy wins when a topic is in both; auto-memory keeps a 1-line pointer). Commit repo memory edits immediately (OneDrive reverts). Run `/memory-maintain` when MEMORY.md > 22 KB or LESSONS > 250 lines.

## File-Lifecycle Automation

On every create/delete/move/rename:
- Update ACTIVE_FILES.md (path, addition, removal — match action to event).
- Update `shared_components/js/GUIDE.md` if it's in that directory.
- On delete/rename: `grep` for the filename in HTML/JS, fix orphaned references.
- On server.js route change: update the route TOC comment block at the top of server.js.

**Dead code detection** (flag, don't auto-delete): JS files with zero `<script>` references; files unchanged 6+ months with no references; any `*.bak`, `*.backup`, `-FINAL` files found.

## API Error Handling (Erik's #1 Rule)

```javascript
// NEVER — silent fallback
try {
  const data = await fetchAPI();
} catch (error) {
  const data = getCachedData(); // NO! Customer sees wrong price.
}

// ALWAYS — visible failure
try {
  const data = await fetchAPI();
} catch (error) {
  showErrorBanner('Unable to load pricing. Please refresh.');
  console.error('API failed:', error);
  throw error;
}
```

## Related Projects (Sibling Repos)

| Project | Location | URL / Port |
|---|---|---|
| **Pricing Index** (this repo) | `.` | port 3000 local / Heroku `sanmar-inventory-app` |
| **caspio-pricing-proxy** (backend API) | `../caspio-pricing-proxy` | `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com` · port 3002 local |
| **Python Inksoft** (InkSoft → ShopWorks) | `../Python Inksoft` | `https://inksoft-transform-8a3dc4e38097.herokuapp.com` · Flask · deploy `git subtree push --prefix web heroku main` |

**Cross-project sync**: When modifying ManageOrders push logic, check if the same change applies in Python Inksoft (`web/`). Shared patterns: size suffixes (`_2X`, `_3XL`), OnSite payload, `TaxTotal=0`, gift certs as line items.

## Critical Patterns

### 💵 Pricing = API, never hardcoded (Erik's rule, 2026-06-03) — ALL quote builders

**Every price, fee, charge, upcharge, percentage, and config value in EVERY quote builder
(EMB/SCP/DTF/DTG) MUST come from the backend API — never a hardcoded number in
the front end.** Caspio is the single source of truth so Erik changes a price in Caspio and
every builder reflects it with **no deploy**.

- **Service fees / setup / digitizing / monogram / rush %, etc.** → Caspio **`Service_Codes`**
  table via proxy **`GET /api/service-codes`** (`src/routes/service-codes.js`; supports
  `?code=`, `/tier/:code/:qty`, full CRUD). Frontend pattern: `loadServiceCodePrices()` +
  `getServicePrice(code, fallback)` (see `embroidery-quote-builder.js`).
- **Decoration / garment / cap / AL / full-back pricing** → `/api/pricing-bundle` +
  `{method}-pricing-service.js` (`calculateALPrice`, etc.).
- A hardcoded number is allowed ONLY as a **fallback** when the API is unreachable, and it
  MUST surface a **visible warning** (Erik's #1 rule: never a silent wrong price).
- When you add ANY new charge to a builder, wire it to the API FIRST. Audit target: Rush 25%,
  LTM, 3D-puff/laser upcharges, and all SCP/DTF/DTG fees are still being migrated to this.

### Two Color-Field System (inventory-critical)

| Field | Use for | Example |
|---|---|---|
| **COLOR_NAME** | UI display, customer quotes | "Brilliant Orange" |
| **CATALOG_COLOR** | API queries, ShopWorks PO, inventory | "BrillOrng" |

```javascript
catalogColor: product.CATALOG_COLOR   // ✅ Inventory works
catalogColor: product.COLOR_NAME      // ❌ "Unable to verify"
```

### Multi-SKU Products (PC54 example)

PC54 has SKUs `PC54`, `PC54_2X`, `PC54_3X` mapped to `Size01–Size06`. **`PC54_2X` uses `Size05`, NOT `Size06`.** Mis-mapping silently breaks ShopWorks line items.

### Embroidery Tier Structure

- Tiers: 1-7 / 8-23 / 24-47 / 48-71 / 72+
- **LTM threshold: `qty <= 7`** (NOT `< 24` like DTG/DTF — common mistake)
- Caps and garments tier separately — never combine qty for a tier discount.
- 5-tier structure + per-tier `MarginDenominator` from Caspio `Pricing_Tiers` (0.55 tier 1-7 / 0.53 others as of 2026-06 — NEVER hardcode it) + `LTM_Fee $50`. Detail: [emb-builder-details.md](memory/emb-builder-details.md).

### Quote Builder Sync (all 4 builders)

Detailed sync manifest lives in **[.claude/rules/quote-builders.md](.claude/rules/quote-builders.md)** — a path-scoped rule that auto-loads when you open a builder file. Headlines: **Rule 8** — sync CSS/layout/table/fees/modals/utils across all 4; pricing/location/logo stay method-specific. **Invoice/PDF/totals/tax = ONE shared `embroidery-quote-invoice.js`** (hits all 4); DTG = separate inline-form. Before changing any builder element, read [memory/quote-builder-architecture.md](memory/quote-builder-architecture.md).

## Quick Reference

- **API Proxy**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`
- **Quote Prefixes**: `DTG · RICH · EMB · EMBC · CEMB · LT · PATCH · SPC · SSC · WEB · OF · CAP · SAM` (CAP = Custom Hats storefront, SAM = paid sample orders, OF = retired Order Form 2026-07-11 — all three read-only in Quote Mgmt, never builder-editable)
- **Dev**: `npm start` (port 3000)

## Security Checklist

When adding endpoints or rendering user data:
- **SQL injection**: use `sanitizeFilterInput()` for Caspio filter params.
- **XSS**: use `escapeHTML()` when rendering external/user data via `innerHTML`.
- **CORS**: EXACT-match allowlist in `lib/cors-allowlist.js` (or `CORS_ALLOWED_ORIGINS` env — no deploy needed) — never substring/wildcard matching (roadmap 1.2, jest-locked).
- **Rate limit**: sensitive endpoints use `strictLimiter`.
- **🔐 Staff RBAC = two Caspio tables (Erik-editable, no deploy)**: `Staff_App_Roles` (Email→Role: admin/accountant/sales/art/shipping/production/staff) drives `permissionsFromRole()` at SAML login; `Staff_Page_Access` (Page→Allowed_Roles/Allowed_Emails) gates `/dashboards/*.html` via the table-driven middleware (admin override; unlisted=any-staff). **When you build a NEW staff dashboard page that should be RESTRICTED, add a `Staff_Page_Access` row** (else it defaults to any logged-in staff). Detail → [memory/STAFF_AUTH_DESIGN.md](memory/STAFF_AUTH_DESIGN.md).

## Policies Hub ↔ Employee Handbook sync

**Before publishing any NEW or substantially-changed Policies Hub policy/procedure, do a two-way Employee Handbook check** (the 22-chapter `employee-handbook` policy + its chapter policies, also `Employee-Handbook-Latest.pdf`):
1. **No contradiction** — scan the handbook; it is the higher authority on HR/employment topics, so reword the policy to defer (never restate or contradict it), or flag the conflict to Erik.
2. **Keep the handbook current** — if the new/changed policy introduces or alters something the handbook should reflect, propose the matching handbook update so it doesn't drift, and surface it to Erik. Steps: `policies-hub-update-playbook.md` → "Handbook cross-check" + `handbook-sync-workflow.md`.

## ManageOrders Documentation Routing

| Discovery type | Destination |
|---|---|
| New fields, endpoints, implementations | `/memory/MANAGEORDERS_COMPLETE_REFERENCE.md` |
| Bugs, gotchas, workarounds | `/memory/LESSONS_LEARNED.md` (Order Processing & ShopWorks) |
| CRM / Order Entry capabilities | `/memory/MANAGEORDERS_CRM_CAPABILITY_REFERENCE.md` |
| 3-Day Tees Stripe→ShopWorks flow | `/memory/3-day-tees/ORDER_PUSH_FLOW.md` |

These files are the single source of truth across all 3 NWCA projects.

## Bandit Integration = LIVING DOC (keep it current)

`/dashboards/bandit-integration.html` (Admin → Bandit Integration) is a **staff-facing live reference** for the bandit sync system. Whenever you change ANY of the following, you MUST update that page **and** `memory/SHOPWORKS_ODBC_INTEGRATION.md` in the same task (never let them drift):
- a bandit scheduled task (the **`\NWCA`** Task Scheduler folder — add/remove/rename/reschedule/change run-as/enable-disable),
- a sync agent script (`../caspio-pricing-proxy/scripts/bandit-agent/*.ps1`) or its `config.json`,
- a sync proxy endpoint (`/api/shopworks-odbc/*`, `/api/thumbnails/*`) or the flow to Caspio/Box.

Bump the page's `?v=` on any HTML/CSS edit. The page's task table + `C:\NWCA\` file-layout + task→script→log map must always match reality on bandit. Re-verify against bandit (`schtasks /query`) rather than trusting the doc.

## Documentation Entry Points

- [/memory/CROSS_PROJECT_HUB.md](memory/CROSS_PROJECT_HUB.md) — start here for cross-project work
- [/memory/LESSONS_LEARNED.md](memory/LESSONS_LEARNED.md) — check first when debugging
- [/memory/INDEX.md](memory/INDEX.md) — master navigation
- [/memory/GLOSSARY.md](memory/GLOSSARY.md) — shared terminology
- [/memory/CASPIO_REST_API_REFERENCE.md](memory/CASPIO_REST_API_REFERENCE.md) — Caspio **platform** REST v3 (Swagger) capability map: tables/views/files/**webhooks**/**directories**/tasks/bridge-apps, what NWCA uses vs untapped, auth, plan-gating, **webhooks fire on REST writes** (≠ Triggered Actions). Distinct from CASPIO_API_CORE.md (our proxy API).
- [/memory/SANMAR_API_REFERENCE.md](memory/SANMAR_API_REFERENCE.md) — SanMar **read-side** SOAP (product/inventory/order-status/shipment/invoice)
- [/memory/sanmar-po/README.md](memory/sanmar-po/README.md) — SanMar **PO submission** (outbound blank ordering): plan, field-mapping, onboarding + buildable PO templates (🟡 review/not built, 2026-06-23)

For deep research, use the Task tool with `subagent_type='Explore'`.

---

**When in doubt:**
1. Check the Top 8 Never-Break Rules above.
2. Check ACTIVE_FILES.md before creating anything new.
3. Use the Explore agent to look up detailed docs.
