# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔴 TOP 8 NEVER-BREAK RULES (Read First!)

These rules prevent disasters. **Violating any of these caused 71+ orphaned files requiring massive cleanup.**

1. **NO Version Suffix Files** - Never create `-backup`, `-FINAL`, `-FIXED`, `-old` files. Use Git branches.
2. **NO Test Files in Root** - ALL test files go in `/tests/` folder. No exceptions.
3. **NO Inline Code** - Zero `<style>` or `<script>` tags with content in HTML files.
4. **NO Silent API Failures** - ALWAYS show errors when API fails. Never use fallback data silently.
5. **ALWAYS Update ACTIVE_FILES.md** - Every file create/delete/move must update documentation immediately.
6. **NO Memory File Bloat** - No dev logs (DAY-*.md), no duplicate docs. Keep INDEX.md under 200 lines.
7. **USE CONFIG FOR API URLs** - Don't hardcode `caspio-pricing-proxy` URL. Use `APP_CONFIG.API.BASE_URL` or config object.
8. **SYNC CALCULATOR & QUOTE BUILDER PRICES** - If both exist for a method, test identical inputs. Prices must match.

## 🚨 CRITICAL: 3-Day Tees Order Submission

**IMPORTANT:** 3-Day Tees order submission uses `server.js:749` NOT a service class!

- ✅ Edit `server.js` lines 749-1050 for order payload changes
- ❌ `ThreeDayTeesOrderService` was deleted (unused dead code)

**Full details:** See `/memory/3-day-tees/SHOPWORKS-INTEGRATION.md`

## Pre-Flight Checklist

**Before creating ANY new file:**
- Is this a test file? → MUST go in /tests/ (no exceptions)
- Check ACTIVE_FILES.md → Does similar functionality exist?
- Follow directory guide → Correct subdirectory placement
- Use kebab-case naming → No spaces, no CAPS
- External JS/CSS only → No inline code
- Update ACTIVE_FILES.md → Required immediately

**Before committing:**
- Remove all console.logs
- Update ACTIVE_FILES.md
- No hardcoded URLs (use config)
- **Quote builder change?** → Check if same change needed in other 3 builders
- **Pricing logic change?** → Verify `printQuote()` and `saveAndGetLink()` use same inputs as `recalculatePricing()`
- **Run `npm run validate-docs`** if you created/moved memory files
- **Document any ManageOrders discoveries** (see [ManageOrders Documentation Updates](#manageorders-documentation-updates))
- Descriptive commit message
- Tested in browser

**After fixing a bug or learning something new:**
- Add entry to [LESSONS_LEARNED.md](/memory/LESSONS_LEARNED.md) with Problem/Root Cause/Solution/Prevention
- Update relevant memory file if it's about: ManageOrders, Caspio API, Stripe, ShopWorks
- Tag with project: `[Pricing Index]`, `[caspio-proxy]`, `[Python Inksoft]`, `[All]`

## Codebase Health (Auto-Enforced)

**Claude enforces these rules automatically on EVERY task — no manual cleanup sessions needed.**

### On every file create:
- Add entry to ACTIVE_FILES.md immediately (Rule #5)
- Add entry to `shared_components/js/GUIDE.md` if it's a new JS file in that directory
- Verify the file follows directory structure rules (tests→`/tests/`, shared JS→`/shared_components/js/`, etc.)

### On every file delete:
- Remove from ACTIVE_FILES.md immediately
- Remove from GUIDE.md if applicable
- Check for orphaned references (`grep` for filename in HTML/JS files)

### On every file move/rename:
- Update ACTIVE_FILES.md with new path
- Update GUIDE.md if applicable
- Update all `<script src>` and `import` references

### On every server.js route change:
- Update the Route TOC comment block at the top of server.js (line numbers)

### Dead code detection (check during related work):
- If you notice a JS file with zero HTML `<script>` references, flag it to Erik
- If you find version-suffixed files (-v2, -v3, -backup), flag for removal
- If a file hasn't been modified in 6+ months and has no references, flag it

### Monthly health check (on first /deploy of each month):
- Quick scan for `*.bak`, `*.backup`, `*-FINAL` files
- Verify ACTIVE_FILES.md file count matches reality (±5 tolerance)
- Check GUIDE.md covers all files in `shared_components/js/`

## Documentation Triggers (Auto-Update)

**CRITICAL: Claude MUST auto-update memory files as part of the fix/feature workflow — no asking, just do it and notify.**

The workflow for any bug fix, feature, or integration change is:
1. Write code → 2. Commit → 3. Deploy → **4. Update memory files** → 5. Notify Erik what was updated

### Bug Fixes (any non-trivial fix)
**Auto-update** LESSONS_LEARNED.md (Problem/Root Cause/Solution/Prevention) + update MEMORY.md if the fix changes documented behavior. Notify:
> "Updated LESSONS_LEARNED.md and MEMORY.md with the fix details."

### API/Integration Changes
**Auto-update** MEMORY.md section for the affected integration (ManageOrders, Caspio, Stripe, ShopWorks). Notify:
> "Updated MEMORY.md with the integration changes."

### Pricing Changes
**Auto-update** relevant pricing docs. Notify:
> "Updated pricing documentation with the changes."

### New Feature Complete
**Auto-update** MEMORY.md with feature details. Notify:
> "Documented new feature in MEMORY.md."

### Rule: Don't Ask, Just Do
Memory updates are part of completing the task — not a separate step that needs permission. If Erik says "skip" for a specific update, don't update that one.

## Memory Maintenance Protocol

**Auto-memory dir**: `~/.claude/projects/C--Users-erik-OneDrive---Northwest-Custom-Apparel-2025-Pricing-Index-File-2025/memory/`

### What Goes Where (Decision Tree)
| Content type | Destination |
|---|---|
| Sync rules, gotchas, key architectural decisions | MEMORY.md |
| Detailed implementation notes (>10 lines on a topic) | Topic file (e.g., `emb-builder-details.md`) |
| Bug fixes with root cause | `/memory/LESSONS_LEARNED.md` (git-tracked) |
| One-time script results, batch stats, historical counts | **Nowhere** — ephemeral |

### Size Discipline
- **Target**: 100–150 lines. **Hard limit**: 200 lines (only first 200 load into context).
- **Warning threshold**: 180 lines — a Stop hook fires automatically if exceeded.
- When adding content: if a section grows past 10 lines, move details to a topic file and link from MEMORY.md.
- When approaching 180 lines: condense existing content before adding more.

### Topic File Rules
- Located in the auto-memory directory (see path above).
- Always linked from MEMORY.md header (e.g., `> Topic files: [emb-builder-details.md] | [design-lookup-details.md]`).
- Each file should be self-contained with a `> Linked from MEMORY.md` header.
- Create new topic files as needed — they have no line limit.

## File Organization

```
Creating a new file? Start here:
├─ Test file? → `/tests/` (ui/api/unit subdirectories)
├─ Calculator? → `/calculators/`
├─ Quote builder? → `/quote-builders/`
├─ Dashboard? → `/dashboards/`
├─ General page? → `/pages/`
├─ JavaScript file?
│  ├─ Shared/reusable? → `/shared_components/js/`
│  └─ Page-specific? → Same folder as HTML
├─ CSS file?
│  ├─ Shared styles? → `/shared_components/css/`
│  └─ Page-specific? → Same folder as HTML
└─ Is it index.html, cart.html, or product.html? → Root (ONLY THESE!)
   └─ Everything else → MUST go in a subdirectory!
```

## API Error Handling (Erik's #1 Rule)

```javascript
// NEVER - Silent fallback
try {
  const data = await fetchAPI();
} catch (error) {
  const data = getCachedData(); // NO! Will cause wrong pricing
}

// ALWAYS - Visible failure
try {
  const data = await fetchAPI();
} catch (error) {
  showErrorBanner('Unable to load pricing. Please refresh.');
  console.error('API failed:', error);
  throw error; // Stop execution
}
```

**Remember:** Wrong pricing data is WORSE than showing an error!

## Project Overview

### Related Projects

**This project (Pricing Index File 2025)** - Frontend
- Quote builders, calculators, pricing pages
- Uses API endpoints from backend
- Port 3000 (local), Heroku (production)

**Backend (caspio-pricing-proxy)** - API Server
- Location: `../caspio-pricing-proxy` (sibling directory)
- Port 3002 (local), Heroku (production)
- Base URL: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`

**Python Inksoft** - Order Transformation
- Location: `../Python Inksoft` (sibling directory)
- Transforms InkSoft orders to ShopWorks format
- No direct dependency with this project

### Key System Components

1. **Adapters** (`/shared_components/js/*-adapter.js`) - Handle pricing data from Caspio
2. **Quote System** - Two tables: `quote_sessions` + `quote_items`, ID: `[PREFIX][MMDD]-seq`
3. **API Proxy** - `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`
4. **Cart Management** - Session-based, single embellishment type per cart

## Quick Reference

```
API Proxy: https://caspio-pricing-proxy-ab30a049961a.herokuapp.com
EmailJS Public Key: 4qSbDO-SQs19TbP80
EmailJS Service ID: service_1c4k67j
Company Phone: 253-922-5793

Quote Prefixes: DTG, RICH, EMB, EMBC, LT, PATCH, SPC, SSC, WEB
```

## Critical Patterns to Remember

### Two Color Field System (CRITICAL for Inventory)

| Field | Purpose | Example | Used For |
|-------|---------|---------|----------|
| **COLOR_NAME** | Display to users | "Brilliant Orange" | UI, customer quotes |
| **CATALOG_COLOR** | API queries | "BrillOrng" | Inventory API, ShopWorks |

```javascript
// WRONG - Cart saves but inventory shows "Unable to Verify"
catalogColor: product.COLOR_NAME  // Should be CATALOG_COLOR

// CORRECT
catalogColor: product.CATALOG_COLOR
```

### Multi-SKU Product Pattern (PC54 Example)

| Product | ShopWorks SKUs | Size Fields |
|---------|----------------|-------------|
| PC54 | PC54, PC54_2X, PC54_3X | Size01-Size06 |

**Critical:** PC54_2X uses **Size05** (NOT Size06!)

### Sample Cart Pricing Formula
- **Formula**: `(baseCost / 0.57) + sizeUpcharge` (2026 margin: 43%)
- **Rounding**: Half-dollar ceiling (`Math.ceil(price * 2) / 2`)

### Quote Builder Sync Rule (CRITICAL)

**Shared Utilities (2026-01-30 consolidation):**
Common utility functions are now in `/shared_components/js/quote-builder-utils.js`:
- `escapeHtml()` - XSS protection for HTML output
- `formatPrice()` - Price display formatting
- `showToast()` - Toast notifications (fixed in DTF - was broken)
- `copyShareableUrl()` - Share modal URL copy
- `handleCellKeydown()` - Table keyboard navigation
- `getDiscountValues()` - Discount calculation helpers

**When modifying ANY quote builder, check if the change applies to all 4:**
- `quote-builders/dtg-quote-builder.html`
- `quote-builders/dtf-quote-builder.html`
- `quote-builders/embroidery-quote-builder.html`
- `quote-builders/screenprint-quote-builder.html`

**Changes that MUST be synced across all builders:**
- CSS styling (colors, spacing, layout, input padding)
- Table structure changes (columns, child rows, thumbnails)
- Fee/charges panel updates
- Customer info panel changes
- Modal styling
- If modifying a function in `quote-builder-utils.js`, it affects ALL builders automatically

**Method-specific (do NOT sync):**
- Pricing logic (each method has unique pricing formula)
- Location selection UI (DTG: dropdown, DTF: radio grid, Screenprint: checkboxes)
- Logo/artwork configuration (Embroidery has digitizing, etc.)
- Method-specific services (`*-pricing-service.js`, `*-quote-service.js`)
- `updateDiscountType()`, `updateAdditionalCharges()`, `updateFeeTableRows()` - these call builder-specific functions

**After making quote builder changes, always ask:**
> "Does this change apply to the other 3 quote builders?"
> "Should this be moved to quote-builder-utils.js?"
> "Does this affect `printQuote()` or `saveAndGetLink()`? Verify PDF and URL quote output match the UI."

### Embroidery Tier Structure (Feb 2026)

**IMPORTANT:** Embroidery uses a 5-tier structure with LTM only for tiny orders:
- Tiers: 1-7, 8-23, 24-47, 48-71, 72+
- LTM threshold: `qty <= 7` (NOT `< 24` like DTG/DTF)
- See `/memory/EMBROIDERY_PRICING_2026.md` for details

## Development Commands

```bash
npm start          # Start Express server (port 3000) - That's it!
```

## Debug Commands

```javascript
// Check pricing data loaded
console.log('Pricing:', window.pricingData);

// Test API connection
fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/health')
    .then(r => r.json()).then(d => console.log('API:', d));

// Clear all caches
localStorage.clear(); sessionStorage.clear(); location.reload(true);
```

## Security Checklist

When adding new API endpoints or rendering user data:
- **SQL Injection**: Use `sanitizeFilterInput()` for Caspio filter parameters
- **XSS**: Use `escapeHTML()` when rendering external/user data via innerHTML
- **CORS**: Update `ALLOWED_ORIGINS` in server.js if adding new domains
- **Rate Limits**: Sensitive endpoints should use `strictLimiter`

See `/memory/SECURITY_AUDIT_2026-01.md` for full audit report.

## Documentation Lookup

**All detailed documentation is in `/memory/` directory.**

When you need detailed docs, use the Task tool with `subagent_type='Explore'` or read specific files:
- `/memory/CROSS_PROJECT_HUB.md` - **START HERE** - Entry point for all 3 NWCA projects
- `/memory/LESSONS_LEARNED.md` - Past bugs and solutions (check first when debugging!)
- `/memory/INDEX.md` - Master navigation for all documentation
- `/memory/GLOSSARY.md` - Shared terminology across all projects
- `/memory/MANAGEORDERS_COMPLETE_REFERENCE.md` - **MASTER** ShopWorks ManageOrders API (PULL + PUSH)
- `/memory/3-day-tees/` - 3-Day Tees implementation
- `/memory/LASER_PATCH_IMPLEMENTATION.md` - Laser leatherette patch feature (caps, GRT-50 setup fee)

**Keep this list short** - add new docs to `/memory/INDEX.md` and topic-specific sections below.

## ManageOrders Documentation Updates

When discovering new ManageOrders patterns or issues:

1. **New fields, endpoints, or implementations** → Add to `/memory/MANAGEORDERS_COMPLETE_REFERENCE.md`
2. **Bugs, gotchas, and workarounds** → Add to `/memory/LESSONS_LEARNED.md` under "Order Processing & ShopWorks"
3. **CRM/Order Entry capabilities** → See `/memory/MANAGEORDERS_CRM_CAPABILITY_REFERENCE.md`
4. **3-Day Tees Stripe→ShopWorks flow** → See `/memory/3-day-tees/ORDER_PUSH_FLOW.md`

**These files are the single source of truth** - all three projects (Pricing Index, caspio-proxy, Python Inksoft) reference them.

---

**When in doubt:**
1. Check the Top 8 Never-Break Rules
2. Check ACTIVE_FILES.md for existing functionality
3. Use Task tool with Explore agent to look up detailed docs
