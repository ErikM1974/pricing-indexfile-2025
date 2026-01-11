# Lessons Learned

A running log of problems solved, gotchas discovered, and patterns that work. Covers all three related projects:
- **Pricing Index File 2025** (Frontend) - Calculators, quote builders, pricing pages
- **caspio-pricing-proxy** (Backend) - API proxy server
- **Python Inksoft** (Integration) - InkSoft to ShopWorks order transformation

Add new entries at the top of the relevant category.

---

## Table of Contents
1. [API & Data Flow](#api--data-flow)
2. [Order Processing & ShopWorks](#order-processing--shopworks)
3. [Multi-SKU Products & Sizes](#multi-sku-products--sizes)
4. [Code Organization](#code-organization)
5. [Calculator & Quote Builder Sync](#calculator--quote-builder-sync)
6. [Development Environment](#development-environment)
7. [Security](#security)
8. [Best Practices](#best-practices)

---

## Related Documentation

**For comprehensive ManageOrders API documentation, see:**
- **[MANAGEORDERS_COMPLETE_REFERENCE.md](./MANAGEORDERS_COMPLETE_REFERENCE.md)** - Complete API reference covering all PULL/PUSH endpoints, every field, patterns, gotchas, and usage across all three projects (1000+ lines)

---

# API & Data Flow

## Problem: Caspio ArtRequests file uploads stored wrong data pattern
**Date:** 2026-01
**Project:** caspio-pricing-proxy
**Symptoms:** Documentation incorrectly described storing ExternalKeys in File_Upload fields
**Root cause:** Assumed REST API pattern without checking existing data - CSV export revealed 3000+ records use file PATH pattern (`/Artwork/logo.png`), not ExternalKey UUIDs
**Solution:** Store file paths (`/Artwork/${fileName}`) not ExternalKeys. CDN_Link formula auto-generates URLs from paths
**Prevention:** Always check existing data patterns via CSV export before documenting API usage. Added to `ARTREQUESTS_FILE_UPLOAD_GUIDE.md` with "CRITICAL: Store File Paths, Not ExternalKeys" warning

---

## Problem: OGIO brand products missing from search results
**Date:** 2025
**Project:** caspio-pricing-proxy
**Symptoms:** OGIO products never appeared in search, other brands worked fine
**Root cause:** Using `makeCaspioRequest()` which doesn't handle pagination. OGIO has 100+ products, Caspio returns max 1000 per page but OGIO was on page 2 of results
**Solution:** Always use `fetchAllCaspioPages()` for any multi-record query
**Prevention:** `makeCaspioRequest()` is now deprecated (server.js line 89). Use `fetchAllCaspioPages()` everywhere

---

## Problem: Caspio API quota exceeded (630K calls/month)
**Date:** 2025
**Project:** caspio-pricing-proxy
**Symptoms:** API throttling, requests failing with 429 errors
**Root cause:** No caching - identical queries hitting Caspio repeatedly
**Solution:** Implemented caching with TTLs: 15min for pricing, 5min for searches, 1hr for Sanmar mappings
**Prevention:** Always check if caching exists before adding new endpoints. Target: <500K calls/month

---

## Problem: API requests failing mid-stream
**Date:** 2025
**Project:** caspio-pricing-proxy
**Symptoms:** Random auth failures even with valid token
**Root cause:** Token expiring during request processing
**Solution:** Check token expiry with 60-second buffer before making requests
**Prevention:** `getCaspioAccessToken()` in server.js (lines 45-79) handles this automatically

---

## Problem: Inventory showing "Unable to Verify"
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Cart saves successfully but inventory check shows "Unable to Verify"
**Root cause:** Using `COLOR_NAME` instead of `CATALOG_COLOR` for API queries
**Solution:** Always use `product.CATALOG_COLOR` for inventory API calls, not `product.COLOR_NAME`
**Prevention:** Added to CLAUDE.md Critical Patterns - Two Color Field System:
- `COLOR_NAME` = Display to users ("Brilliant Orange")
- `CATALOG_COLOR` = API queries ("BrillOrng")

---

## Problem: Wrong pricing displayed silently
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Prices shown to customers were incorrect, no error visible
**Root cause:** API failed but code used cached/fallback data silently
**Solution:** Always show visible error when API fails - throw errors, don't fallback
**Prevention:** Rule #4 in CLAUDE.md: NO Silent API Failures. Every service file has "NO FALLBACK VALUES" comments

---

## Problem: API URL hardcoded, broke in different environments
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** API calls fail when deployed or URL changes
**Root cause:** Hardcoded `caspio-pricing-proxy` URL in code
**Solution:** Use `APP_CONFIG.API.BASE_URL` or config object
**Prevention:** Rule #7 in CLAUDE.md: USE CONFIG FOR API URLs. Config is in `/config/app.config.js`

---

## Problem: Rate limiting not applied correctly
**Date:** 2025
**Project:** caspio-pricing-proxy
**Symptoms:** External APIs (ManageOrders, JDS) getting throttled
**Root cause:** No rate limiting on proxy endpoints
**Solution:** Implemented three rate-limit tiers:
- ManageOrders: 30 requests/minute
- JDS Industries: 60 requests/minute
- General API: 200 requests/15 minutes
**Prevention:** Always add rate limiter when creating new external API endpoints

---

# Order Processing & ShopWorks

## Problem: 3-Day Tees orders not processing correctly
**Date:** 2024-11
**Project:** Pricing Index + caspio-pricing-proxy
**Symptoms:** Hours spent debugging wrong code path
**Root cause:** Assumed order submission used `ThreeDayTeesOrderService` class - but that was DELETED. Actual path is `server.js:749-1050`
**Solution:** Document the actual code path clearly
**Prevention:** Added to CLAUDE.md:
- Frontend: `pages/3-day-tees-success.html` (line 884-937)
- Backend: `server.js` (line 749-1050) - EDIT HERE
- ManageOrders: `lib/manageorders-push-client.js`

---

## Problem: All sizes showing as Adult/S in ShopWorks
**Date:** 2025-12
**Project:** Python Inksoft
**Symptoms:** Imported orders show correct product but every item is Adult/S regardless of actual size
**Root cause:** Missing or zero `id_Integration` in store config - ShopWorks doesn't know which Size Translation Table to use
**Solution:** Get valid Integration ID from ShopWorks: Tools > Configuration > Order API Integrations
**Prevention:** Every new store config MUST have valid `id_Integration`. Check `/web/stores.py` for any `"id_Integration": 0` (those are broken!)

---

## Problem: Size modifiers not applying correctly
**Date:** 2025
**Project:** Python Inksoft
**Symptoms:** 2XL and 3XL items going to wrong SKUs
**Root cause:** ShopWorks uses `_2X` and `_3X` format, NOT `_2XL` and `_3XL`
**Solution:** Hardcoded size modifiers in `transform.py` (lines 19-74) because ShopWorks Size Translation Table is unreliable
**Prevention:** Always check SIZE_MODIFIERS dict before assuming size format

---

## Problem: Gift certificates disappearing or consolidating
**Date:** 2025
**Project:** Python Inksoft
**Symptoms:** Multiple gift certs on same order getting merged into one
**Root cause:** Gift certs were in Payments array - ShopWorks consolidates identical PartNumbers
**Solution:** Gift certs are now LINE ITEMS with unique PartNumbers: "Gift Code 1", "Gift Code 2", etc.
**Prevention:** See `transform.py` lines 475-506. Gift certs are NOT payments

---

## Problem: Tax calculation wrong after ShopWorks import
**Date:** 2025
**Project:** Python Inksoft
**Symptoms:** Tax amounts incorrect in ShopWorks
**Root cause:** ShopWorks API has a bug - doesn't set `sts_EnableTax01-04` flags on line items
**Solution:** Python tool hardcodes all 4 tax flags to 1, sets TaxTotal to 0, lets OnSite calculate
**Prevention:** See `transform.py` lines 1121. This is a workaround for ShopWorks API bug

---

## Problem: Orders landing on weekends/holidays
**Date:** 2025
**Project:** Python Inksoft
**Symptoms:** Ship dates on Saturdays, Sundays, Christmas
**Root cause:** No business day logic
**Solution:** Auto-adjust to next business day - skips weekends and 12+ US holidays
**Prevention:** `transform.py` lines 220-301 handles this automatically. Includes MLK Day, Presidents Day, Memorial Day, Labor Day, Thanksgiving, day after Thanksgiving, Dec 26, Jan 2, etc.

---

# Multi-SKU Products & Sizes

## Problem: PC54 2XL size mapping wrong
**Date:** 2025
**Project:** All
**Symptoms:** 2XL orders going to wrong ShopWorks SKU
**Root cause:** PC54_2X uses Size05, not Size06 as expected
**Solution:** Check size field mapping for multi-SKU products
**Prevention:** Added Multi-SKU Product Pattern to CLAUDE.md:
| Product | ShopWorks SKUs | Size Fields |
|---------|----------------|-------------|
| PC54 | PC54, PC54_2X, PC54_3X | Size01-Size06 |
| PC54_2X uses **Size05** (NOT Size06!) |

---

## Problem: Multi-SKU products have inconsistent size field counts
**Date:** 2025
**Project:** All
**Symptoms:** Extended sizes (4XL, 5XL) not mapping correctly
**Root cause:** Each SKU variant (base, _2X, _3X) uses different number of size fields
**Solution:** Always verify size field mapping with actual ShopWorks data
**Prevention:** Document in `/memory/SHOPWORKS_SIZE_MAPPING.md`. Test with extended sizes specifically

---

## Problem: ShopWorks Size Translation Table unreliable
**Date:** 2025
**Project:** Python Inksoft
**Symptoms:** Sizes sometimes translate correctly, sometimes not
**Root cause:** ShopWorks Size Translation Table has inconsistent data
**Solution:** Bypass it - hardcode size modifiers in Python tool
**Prevention:** `SIZE_MODIFIERS` dict in `transform.py` is the source of truth, not ShopWorks

---

# Code Organization

## Problem: 71+ orphaned files in codebase
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Duplicate files, backup versions, test files scattered everywhere
**Root cause:** Creating `-backup`, `-FIXED`, `-old` suffix files instead of using git
**Solution:** Massive cleanup, established Top 8 Never-Break Rules
**Prevention:** Rule #1: NO Version Suffix Files - use Git branches

---

## Problem: Test files scattered in root directory
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Confusion about which files are active vs test
**Root cause:** No enforced test file location
**Solution:** All test files must go in `/tests/` with subdirectories: `ui/`, `api/`, `unit/`
**Prevention:** Rule #2 in CLAUDE.md: NO Test Files in Root

---

## Problem: LTM fee logic inconsistent between calculator and quote builder
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Calculator shows one LTM fee, quote builder shows different amount
**Root cause:** LTM fee logic appears in THREE separate places that weren't synced
**Solution:** Must update all three when changing LTM logic:
- `/cart-price-recalculator.js` (lines 53-63)
- `/quote-builders/screenprint-quote-builder.html` (lines 3015-3044)
- `/shared_components/js/screenprint-pricing-v2.js` (lines 1587-1595)
**Prevention:** Document all locations. Consider consolidating into shared function

---

## Problem: Multiple config files causing confusion
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Changed config in one file, but app used different file
**Root cause:** Multiple config files exist:
- `/config/app.config.js` - PRIMARY (frozen)
- `/shared_components/js/app-config.js` - LEGACY (marked for deprecation)
- `/shared_components/js/dtf-config.js` - DTF-specific
- `/shared_components/js/dtg-config.js` - DTG-specific
**Solution:** Use `/config/app.config.js` for all new code
**Prevention:** ACTIVE_FILES.md marks legacy config as "Deprecate"

---

## Problem: Root directory JS files cause dependency issues
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Moving files breaks index.html and cart.html
**Root cause:** Historical JS files in root have hardcoded paths in HTML
**Solution:** Left files in root, documented the risk
**Prevention:** ACTIVE_FILES.md (line 10) warns: "DO NOT MOVE these files without updating all HTML references"
Files affected: `app-modern.js`, `cart.js`, `cart-ui.js`, `cart-price-recalculator.js`, `product-search-service.js`

---

# Calculator & Quote Builder Sync

## Problem: Calculator and quote builder show different prices
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Sales rep quotes one price, customer sees different price
**Root cause:** Calculator and quote builder had independent pricing implementations
**Solution:** Must test BOTH with identical inputs whenever pricing logic changes
**Prevention:** Rule #8 in CLAUDE.md: SYNC CALCULATOR & QUOTE BUILDER PRICES
Test example: PC61 Forest Green x 37 pieces should show $29.85/piece in BOTH

---

## Problem: Rounding logic inconsistent
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Some prices round up, some round down
**Root cause:** Different files used different rounding (Math.round vs Math.ceil)
**Solution:** Standardized on half-dollar ceiling: `Math.ceil(price * 2) / 2`
**Prevention:** All pricing must use half-dollar ceiling. Documented in service files

---

## Problem: Manual pricing override via URL could be exploited
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Users could add `?manualCost=0.01` to URL and get low prices
**Root cause:** Manual override feature for testing had no validation
**Solution:** Added to security review - consider removing or restricting
**Prevention:** Only use for internal testing. Don't advertise this feature

---

# Development Environment

## Problem: WSL localhost doesn't connect to local server
**Date:** 2025
**Project:** caspio-pricing-proxy
**Symptoms:** `localhost:3002` works in Windows but not in WSL terminal
**Root cause:** WSL has different network namespace than Windows host
**Solution:** Use WSL IP address instead of localhost: run `hostname -I` to get IP
**Prevention:** Documented in `/memory/LOCAL_DEVELOPMENT.md`. Use WSL IP: 172.x.x.x

---

## Problem: Git subtree push fails with "non-fast-forward"
**Date:** 2025
**Project:** Python Inksoft
**Symptoms:** `git push heroku main` fails from web/ folder
**Root cause:** Trying to push from within web/ subfolder instead of repo root
**Solution:** Use `git subtree push --prefix web heroku main` from main repo root
**Prevention:** Documented in deploy command

---

## Problem: Flask 404 after adding new routes
**Date:** 2025
**Project:** Python Inksoft
**Symptoms:** New Flask routes return 404, existing routes work
**Root cause:** Old server process still running on port 5000
**Solution:** Kill existing server (`taskkill //F //PID <PID>` on Windows), restart fresh
**Prevention:** Always check for zombie Flask processes before debugging routes

---

## Problem: CORS allows all origins in production
**Date:** 2025
**Project:** caspio-pricing-proxy
**Symptoms:** Security audit flagged this
**Root cause:** Development config (`origin: '*'`) left in production
**Solution:** Restrict to specific origins in production
**Prevention:** Check `config.js` CORS settings before deploying. Should whitelist only known domains

---

# Security

## Problem: SQL injection possible in Caspio queries
**Date:** 2025
**Project:** caspio-pricing-proxy
**Symptoms:** Security audit found injectable parameters
**Root cause:** Caspio API doesn't support parameterized queries - must use string interpolation
**Solution:** Input sanitization functions that escape quotes, remove SQL keywords
**Prevention:** Always use `sanitizeFilterInput()` for any user input going to Caspio. See `quotes.js` lines 8-29

---

## Problem: Stripe webhook could be spoofed
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Security concern about fake webhook calls
**Root cause:** No signature verification
**Solution:** Verify Stripe webhook signature before processing
**Prevention:** `server.js` line 197 verifies signature. Never skip this check

---

## Problem: XSS possible when rendering external data
**Date:** 2025
**Project:** Pricing Index
**Symptoms:** Security audit flagged innerHTML usage
**Root cause:** User/external data rendered without escaping
**Solution:** Use `escapeHTML()` helper when rendering via innerHTML
**Prevention:** Documented in CLAUDE.md Security Checklist

---

# Best Practices

## Pattern: Multi-location store fallback resolution
**Date:** 2025
**Project:** Python Inksoft
**Description:** AMC, Hops n Drops have 100+ locations each
**Pattern:** 3-level fallback for location resolution:
1. Exact match on checkout field value
2. Case-insensitive match if #1 fails
3. ZIP code fallback from shipping address
**Files:** `stores.py` lines 335-376

---

## Pattern: OAuth token caching with expiry buffer
**Date:** 2025
**Project:** All
**Description:** Prevent auth failures during long requests
**Pattern:** Cache token with 60-second buffer before expiry
**Files:**
- caspio-pricing-proxy: `server.js` lines 45-79
- Python Inksoft: `caspio_api.py` lines 35-73

---

## Pattern: Prefixed console.log for debugging
**Date:** 2025
**Project:** Pricing Index
**Description:** Easy to filter logs by module
**Pattern:** `[ModuleName] Message` format
**Example:** `[DTFPricingService] Fetching complete pricing bundle from API...`
**Benefit:** grep-friendly, identifies source module

---

## Pattern: Quote ID format for phone reference
**Date:** 2025
**Project:** Pricing Index
**Description:** Sales reps need to reference quotes by phone
**Pattern:** `[PREFIX][MMDD]-[sequence]`
**Examples:** `DTG0107-1`, `EMB0107-2`, `RICH0107-1`
**Why:** Domain-aware IDs are easier to read over phone than UUIDs

---

## Pattern: Structured error responses
**Date:** 2025
**Project:** All
**Description:** Consistent error format across all APIs
**Pattern:**
```json
{"error": "Descriptive message", "code": "ERROR_CODE"}
```
**Prevention:** Never return generic 500 errors. Always include actionable message

---

# Template for New Entries

```markdown
## Problem: [Brief description]
**Date:** YYYY-MM
**Project:** [Pricing Index | caspio-pricing-proxy | Python Inksoft | All]
**Symptoms:** What the bug looked like to users/developers
**Root cause:** What was actually wrong
**Solution:** How we fixed it
**Prevention:** How to avoid this in future (rule added, pattern documented, etc.)
```

For best practices/patterns:
```markdown
## Pattern: [Name]
**Date:** YYYY-MM
**Project:** [Project name]
**Description:** What problem this solves
**Pattern:** How it works
**Files:** Where to find implementation
```
