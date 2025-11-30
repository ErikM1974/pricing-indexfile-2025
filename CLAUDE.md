# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔴 TOP 5 NEVER-BREAK RULES (Read First!)

These rules prevent disasters. **Violating any of these caused 71+ orphaned files requiring massive cleanup.**

1. **NO Version Suffix Files** - Never create `-backup`, `-FINAL`, `-FIXED`, `-old` files. Use Git branches.
2. **NO Test Files in Root** - ALL test files go in `/tests/` folder. No exceptions.
3. **NO Inline Code** - Zero `<style>` or `<script>` tags with content in HTML files.
4. **NO Silent API Failures** - ALWAYS show errors when API fails. Never use fallback data silently.
5. **ALWAYS Update ACTIVE_FILES.md** - Every file create/delete/move must update documentation immediately.

## 🚨 CRITICAL: 3-Day Tees Integration Code Path

**IMPORTANT:** The 3-Day Tees order submission has a specific code path that is NOT obvious:

### The CORRECT Code Path:
1. User completes payment via Stripe → Redirects to `pages/3-day-tees-success.html`
2. Success page retrieves order data from `sessionStorage`
3. Success page calls `POST /api/submit-3day-order` endpoint
4. **`server.js:749`** handles the endpoint and builds the ManageOrders payload
5. Calls ManageOrders PUSH API via `caspio-pricing-proxy`

### What NOT to Edit:
- ❌ `shared_components/js/three-day-tees-order-service.js` - **DELETED** (was unused dead code)
- ❌ Any "ThreeDayTeesOrderService" class references

### What TO Edit for 3-Day Tees Orders:
- ✅ **`server.js`** lines 749-1050 - `/api/submit-3day-order` endpoint
- ✅ `pages/3-day-tees-success.html` - Success page that calls the endpoint
- ✅ `caspio-pricing-proxy/lib/manageorders-push-client.js` - Backend transformation

### Key Fields in server.js Payload:
```javascript
const manageOrdersPayload = {
  customerPurchaseOrder: tempOrderNumber,  // REQUIRED for ShopWorks PO field
  notes: [{
    type: 'Notes On Order',  // NOT "Notes To Production"
    note: `Full customer details, billing, payment info...`
  }]
};
```

**Why This Matters:** In Nov 2024, we spent hours debugging why edits to the service file weren't working - it was completely unused! Always verify the actual code path before making changes.

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
- Descriptive commit message
- Tested in browser

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

### Two-Repository Architecture

**This project (Pricing Index File 2025)** - Frontend
- Quote builders, calculators, pricing pages
- Uses API endpoints from backend
- Port 3000 (local), Heroku (production)

**Backend (caspio-pricing-proxy)** - API Server
- Location: `../caspio-pricing-proxy` (sibling directory)
- Port 3002 (local), Heroku (production)
- Base URL: `https://caspio-pricing-proxy-ab30a049961a.herokuapp.com`

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
- **Formula**: `(baseCost / 0.6) + sizeUpcharge`
- **Rounding**: Half-dollar ceiling (`Math.ceil(price * 2) / 2`)

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

## Documentation Lookup

**All detailed documentation is in `/memory/` directory.**

When you need detailed docs, use the Task tool with `subagent_type='Explore'` or read specific files:
- `/memory/INDEX.md` - Master navigation for all documentation
- `/memory/CASPIO_API_CORE.md` - API documentation (63 endpoints)
- `/memory/QUOTE_BUILDER_GUIDE.md` - Creating quote builders
- `/memory/MANAGEORDERS_INTEGRATION.md` - ShopWorks PULL API
- `/memory/3-day-tees/` - 3-Day Tees implementation

**Do NOT add more file includes here** - use Task tool to look up docs on-demand to save memory.

---

**When in doubt:**
1. Check the Top 5 Never-Break Rules
2. Check ACTIVE_FILES.md for existing functionality
3. Use Task tool with Explore agent to look up detailed docs
