# AGENTS.md

Guidance for Codex when working in this repository.

## 🔴 Working directories (moved off OneDrive 2026-09-18)

Work in these paths. They are plain local folders — **no OneDrive, no sync**.

| Project | Path |
|---|---|
| **Pricing Index** (this repo) | `C:\dev\pricing-index` |
| **caspio-pricing-proxy** | `C:\dev\caspio-pricing-proxy` |
| **inksoft-transform** (was "Python Inksoft") | `C:\dev\inksoft-transform` |

The old copies under `OneDrive - Northwest Custom Apparel\2025\` are **RETIRED** and
carry a `RETIRED-MOVED-TO-C-DEV.md` marker. If you find yourself in one, stop and switch.

🔴 **Never run a git repo from OneDrive.** It truncated the git index (1,323 files reported
deleted while they sat on disk), forked tracked files into `-Eriklaptop` conflict copies from a
second machine, and left a duplicate `develop` 94 commits stale.

🔑 A checkout with no `.env` **silently skips 22 credential-dependent unit tests** (26 skipped
vs 4), so a gate run there is weaker than it looks.

## CSS for every new or changed page

Read [the current design-system guide](shared_components/css/NWCA-2026-GUIDE.md#creating-or-changing-a-page) before writing page markup or styles. This applies to Astra and every other coding agent working here.

- Reuse the existing page family's layout and shared controls. Start new staff pages from `templates/page-template.html`; use a reviewed sibling for storefronts, calculators and quote builders.
- Use canonical `tokens.css` and `components.css`, the unified body attributes and scoped family styles. Add only necessary page-specific arrangements; do not copy shared component rules, invent a second token scale or stack override stylesheets.
- Register every new app page in `scripts/css/migration-manifest.json` (`pilots` is the historical name of the reviewed-page list), including its actual styles, measured byte budget, tested states and existing browser-test file. The census guard rejects unregistered application pages.
- Follow the guide's checks and visual review before marking a page complete. Do not silence a guard, raise a budget or add an exception merely to make checks pass. Generated print layouts, email templates and embedded providers keep their own recorded owners.

## 🔴 Top 8 Never-Break Rules

1. **NO version-suffix files** — Never create `-backup`, `-FINAL`, `-FIXED`, `-old`, `-v2`. Use Git branches.
2. **NO test files in root** — ALL tests go in `/tests/` (ui/api/unit subdirectories). No exceptions.
3. **NO inline code** — Zero `<style>` or `<script>` tags with content in HTML files.
4. **NO silent API failures** — Always show errors when an API fails. Never fall back to cached/stale data silently. Wrong pricing is worse than an error.
5. **ALWAYS update ACTIVE_FILES.md** — Every file create/delete/move updates documentation immediately.
6. **USE CONFIG for API URLs** — Don't hardcode `caspio-pricing-proxy` URL. Use `APP_CONFIG.API.BASE_URL`.
7. **SYNC calculator + quote builder prices** — If both exist for a method, test identical inputs match.
8. **SYNC all 4 quote builders** — A change to one (DTG/DTF/EMB/SCP) usually applies to all four. Always check.

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

Memory updates are part of completing the task — not a separate ask-permission step.

- **Bug fixes** → append to LESSONS_LEARNED.md; update MEMORY.md only if the fix changes documented behavior.
- **API / integration changes** (ManageOrders, Caspio, Stripe, ShopWorks) → update the relevant section/topic file.
- **New features** → one-liner in MEMORY.md or full detail in topic file (>2 lines → topic file).
- Notify Erik in one sentence: "Updated LESSONS_LEARNED.md and MEMORY.md."
- Memory rules in detail: `~/.Codex/projects/.../memory/MEMORY.md` (auto-loaded each session).

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
| **Python Inksoft** (InkSoft → ShopWorks) | `../inksoft-transform` | `https://inksoft-transform-8a3dc4e38097.herokuapp.com` · Flask · deploy `git subtree push --prefix web heroku main` |

**Cross-project sync**: When modifying ManageOrders push logic, check if the same change applies in Python Inksoft (`web/`). Shared patterns: size suffixes (`_2X`, `_3XL`), OnSite payload, `TaxTotal=0`, gift certs as line items.

## Critical Patterns

### 💵 Pricing = API, never hardcoded (Erik's rule, 2026-06-03) — ALL quote builders

**Every price, fee, charge, upcharge, percentage, and config value in EVERY quote builder
(EMB/SCP/DTF/DTG + Order Form) MUST come from the backend API — never a hardcoded number in
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
- 5-tier structure + `MarginDenominator 0.57` + `LTM_Fee $50`. Detail: [emb-builder-details.md](memory/emb-builder-details.md).

### Quote Builder Sync (all 4 builders)

Files: `quote-builders/{dtg,dtf,embroidery,screenprint}-quote-builder.html` + matching `shared_components/js/*-quote-builder.js`. Shared utils: `quote-builder-utils.js`. Shared CSS: `quote-builder-common.css`.

**🔧 Before changing ANY quote-builder element, read [memory/quote-builder-architecture.md](memory/quote-builder-architecture.md)** — the shared-vs-per-builder manifest + change-routing cheat sheet. Key: **invoice/PDF/totals/tax = ONE shared file `embroidery-quote-invoice.js` → changes hit all 4 at once.** DTG uses a separate (inline-form) architecture, so trio UI changes don't reach it automatically.

**Sync these across all 4**: CSS/layout/spacing · table structure · fee/charges panel · customer info panel · modal styling · utility functions in `quote-builder-utils.js`.

**Do NOT sync** (method-specific): pricing logic · location selection UI · logo/artwork config · `*-pricing-service.js` / `*-quote-service.js` · `updateDiscountType()` / `updateAdditionalCharges()` / `updateFeeTableRows()`.

After any builder change, ask: "Does this apply to the other 3? Should this move to `quote-builder-utils.js`? Does it affect `printQuote()` or `saveAndGetLink()`?"

## Quick Reference

- **API Proxy**: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`
- **Quote Prefixes**: `DTG · RICH · EMB · EMBC · CEMB · LT · PATCH · SPC · SSC · WEB · OF`
- **Dev**: `npm start` (port 3000)

## Security Checklist

When adding endpoints or rendering user data:
- **SQL injection**: use `sanitizeFilterInput()` for Caspio filter params.
- **XSS**: use `escapeHTML()` when rendering external/user data via `innerHTML`.
- **CORS**: update `ALLOWED_ORIGINS` in server.js for new domains.
- **Rate limit**: sensitive endpoints use `strictLimiter`.

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

## Documentation Entry Points

- [December Finish Line project guide](memory/december-finish-line.md) — attached planning folders, current financial reports, assumptions, and website integration notes; read when working on 2026 profit, Q4 sales, or December Finish Line.
- [/memory/CROSS_PROJECT_HUB.md](memory/CROSS_PROJECT_HUB.md) — start here for cross-project work
- [/memory/LESSONS_LEARNED.md](memory/LESSONS_LEARNED.md) — check first when debugging
- [/memory/INDEX.md](memory/INDEX.md) — master navigation
- [/memory/GLOSSARY.md](memory/GLOSSARY.md) — shared terminology

For deep research, use the Task tool with `subagent_type='Explore'`.

---

**When in doubt:**
1. Check the Top 8 Never-Break Rules above.
2. Check ACTIVE_FILES.md before creating anything new.
3. Use the Explore agent to look up detailed docs.
