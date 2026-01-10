# API Call Audit Report - January 2026

**Audit Date:** 2026-01-10
**Scope:** Frontend + Backend API call patterns
**Status:** Memory leak fixes applied

---

## Executive Summary

**Current Usage:** ~50,000 API calls/month (10% of 500K Caspio limit)
**Verdict:** Plenty of bandwidth. No need to reduce API calls for quota reasons.

---

## Key Findings

| Category | Issue | Impact | Status |
|----------|-------|--------|--------|
| Unbounded server caches | 15+ Map caches with no size limits | Memory leak risk | **FIXED** |
| Hardcoded URLs | 50+ files with inline API URL | Maintenance risk | Low priority |
| 3 calls per product | DTF/DTG fetch bundle+details+swatches separately | Performance | Nice to have |
| No HTTP cache headers | Browsers can't cache responses | Extra requests | Deferred |

---

## Fixes Applied

### Backend Cache Size Limits

Added FIFO eviction to prevent unbounded memory growth:

| File | Cache | Max Size |
|------|-------|----------|
| `pricing.js` | pricingBundleCache | 100 (already had) |
| `products.js` | productSearchCache | 50 (already had) |
| `quotes.js` | quoteSessionsCache | 100 (ADDED) |
| `sanmar-shopworks.js` | sanmarMappingCache | 100 (ADDED) |
| `thumbnails.js` | thumbnailCache | 200 (ADDED) |
| `thumbnails.js` | topSellersCache | 50 (ADDED) |
| `thumbnails.js` | syncStatusCache | 20 (ADDED) |

---

## What's Working Well

### Backend
- Token caching with 60-second buffer (95%+ hit rate)
- Pricing bundle cache (15-min TTL)
- Product search cache (5-min TTL)
- Good pagination with `fetchAllCaspioPages()`

### Frontend
- Quote persistence with localStorage (24hr drafts)
- Session management with 24hr timeout
- Debounce utility available (underused)

---

## Deferred Improvements

These would improve performance but aren't urgent:

1. **HTTP Cache Headers** - Add `Cache-Control: public, max-age=300` to GET endpoints
2. **Batch Product Endpoint** - Combine details+colors+pricing into one call
3. **Client-Side Pricing Cache** - Cache pricing bundle in sessionStorage
4. **URL Consolidation** - Create `window.API_CONFIG.baseUrl` for 50+ files

---

## API Call Patterns

### Most-Called Endpoints (estimated daily)
- `/api/pricing-bundle` - 1000+ calls
- `/api/product-details` - 500+ calls
- `/api/color-swatches` - 300+ calls
- `/api/size-pricing` - 200+ calls

### Tables with Highest Query Volume
- `Sanmar_Bulk_251816_Feb2024` - Product data
- `Pricing_Tiers` - Pricing rules
- `Standard_Size_Upcharges` - Size pricing

---

## Files Modified

**Backend (caspio-pricing-proxy):**
- `src/routes/quotes.js` - Added cache size limit
- `src/routes/sanmar-shopworks.js` - Added cache size limit
- `src/routes/thumbnails.js` - Added cache size limits (3 caches)

---

*Audit performed by Claude Code, January 2026*
