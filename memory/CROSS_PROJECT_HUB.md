# NWCA Cross-Project Knowledge Hub

**Last Updated:** 2026-01-11
**Purpose:** Single entry point for documentation across all 3 NWCA projects

---

## Project Overview

| Project | Location | Purpose | Port |
|---------|----------|---------|------|
| **Pricing Index File 2025** | This repo | Frontend - calculators, quote builders, pages | 3000 |
| **caspio-pricing-proxy** | `../caspio-pricing-proxy` | Backend API server, caching, proxying | 3002 |
| **Python Inksoft** | `../Python Inksoft` | Order transformation - InkSoft → ShopWorks | 5000 |

---

## Quick Links by Project

| Project | CLAUDE.md | Memory Index | Memory Files |
|---------|-----------|--------------|--------------|
| Pricing Index | [CLAUDE.md](../CLAUDE.md) | [INDEX.md](./INDEX.md) | 111 files |
| caspio-proxy | [CLAUDE.md](../../caspio-pricing-proxy/CLAUDE.md) | (see memory/) | 26 files |
| Python Inksoft | [CLAUDE.md](../../Python%20Inksoft/CLAUDE.md) | (see memories/) | 19 files |

**Total documentation:** 156 markdown files across all projects

---

## Single Sources of Truth

These are the MASTER documents - update HERE, not copies elsewhere:

| Topic | Master Location | Owner |
|-------|-----------------|-------|
| **ManageOrders API** | [MANAGEORDERS_COMPLETE_REFERENCE.md](./MANAGEORDERS_COMPLETE_REFERENCE.md) | Pricing Index |
| **CRM Capabilities** | [MANAGEORDERS_CRM_CAPABILITY_REFERENCE.md](./MANAGEORDERS_CRM_CAPABILITY_REFERENCE.md) | Pricing Index |
| **Caspio API Endpoints** | [CASPIO_API_CORE.md](./CASPIO_API_CORE.md) | Pricing Index |
| **Lessons Learned** | [LESSONS_LEARNED.md](./LESSONS_LEARNED.md) | Pricing Index |
| **3-Day Tees Flow** | [3-day-tees/ORDER_PUSH_FLOW.md](./3-day-tees/ORDER_PUSH_FLOW.md) | Pricing Index |
| **Size Modifiers** | `Python Inksoft/transform.py` (lines 19-74) | Python Inksoft |
| **API Specification** | `caspio-proxy/memory/API_SPECIFICATION.yaml` | caspio-proxy |

---

## Cross-Project Workflows

### Order Flow: InkSoft → ShopWorks
```
1. InkSoft order placed
2. Python Inksoft transforms JSON (transform.py)
3. Calls caspio-pricing-proxy /api/manageorders/orders/create
4. caspio-proxy forwards to ManageOrders API
5. ShopWorks imports order via OnSite
```

### Order Flow: 3-Day Tees → ShopWorks
```
1. Customer checkout (Pricing Index frontend)
2. Stripe payment + Caspio quote save
3. Webhook → server.js:749-1050
4. Calls caspio-pricing-proxy /api/manageorders/orders/create
5. ShopWorks imports with payment record
```

### Inventory Check: Frontend → SanMar
```
1. Quote builder checks availability (Pricing Index)
2. Calls caspio-pricing-proxy /api/sanmar/inventory
3. caspio-proxy caches (5 min) or calls Caspio
4. Caspio calls SanMar real-time
5. Returns stock by size/color/warehouse
```

---

## Glossary

Key terms used across all projects:

| Term | Definition | Used In |
|------|------------|---------|
| `CATALOG_COLOR` | SanMar internal color code (e.g., "BrillOrng") | All - API queries |
| `COLOR_NAME` | Display color name (e.g., "Brilliant Orange") | All - UI display |
| `QuoteID` | Quote identifier format: `[PREFIX][MMDD]-[seq]` | Pricing Index |
| `ExtOrderID` | External order ID format: `NWCA-[number]` | All - ShopWorks |
| `id_Integration` | ShopWorks integration ID for size translation | Python Inksoft |
| `sts_*` | ShopWorks status flags (0=No, 1=Yes, .5=Partial) | All |
| `cur_*` | ShopWorks currency/amount fields | All |
| `SIZE_MODIFIERS` | Size suffix mapping (`_2X`, `_3X`) | All |

---

## Documentation Maintenance

### When to Update What

| Discovered | Update This File | Tag With |
|------------|------------------|----------|
| Bug fix / gotcha | [LESSONS_LEARNED.md](./LESSONS_LEARNED.md) | `[Project Name]` |
| ManageOrders field/endpoint | [MANAGEORDERS_COMPLETE_REFERENCE.md](./MANAGEORDERS_COMPLETE_REFERENCE.md) | N/A |
| Caspio API change | [CASPIO_API_CORE.md](./CASPIO_API_CORE.md) | N/A |
| New memory file | [INDEX.md](./INDEX.md) | N/A |
| Cross-project pattern | This file (CROSS_PROJECT_HUB.md) | N/A |

### Validation Commands

```bash
# Pricing Index - check doc health
npm run validate-docs      # Check orphaned/dead links
npm run doc-freshness      # Check staleness (coming soon)

# All projects - verify cross-project links work
# (manual: open files, confirm paths resolve)
```

---

## Code Path Quick Reference

| Feature | Files to Edit |
|---------|---------------|
| **3-Day Tees order submission** | `server.js:749-1050` (NOT ThreeDayTeesOrderService - deleted!) |
| **ManageOrders PUSH transform** | `caspio-proxy/lib/manageorders-push-client.js` |
| **Size translation** | `Python Inksoft/transform.py:19-74` |
| **Pricing calculator logic** | `shared_components/js/*-pricing-*.js` |
| **Quote builder logic** | `quote-builders/*-quote-builder.html` |
| **API caching** | `caspio-proxy/server.js` (search "cache") |

---

## Related Documentation

- [INDEX.md](./INDEX.md) - Full Pricing Index memory navigation
- [LESSONS_LEARNED.md](./LESSONS_LEARNED.md) - Problems solved across all projects
- [ACTIVE_FILES.md](../ACTIVE_FILES.md) - Code file registry

---

**This file is the entry point for Claude Code to understand the full NWCA system.**
