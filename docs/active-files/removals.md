# 🗑️ Recently Removed (For Reference)

### CRM Role-Based Access Control (2026-01-23)
**Context:** Replaced shared password login with Caspio-based role permissions
- `/pages/crm-login.html` (255 lines) → Deleted (replaced by Caspio auth)
- CRM dashboards now use role-based access via Express session
- **Erik:** Full access (taneisha, nika, house)
- **Taneisha:** Own dashboard only
- **Nika:** Own dashboard only

### Richardson Simplification (2026-01-02)
**Context:** Richardson quote builder simplified to real-time pricing lookup (81% code reduction)
- `richardson-caps-calculator.js` (2,659 lines) → Replaced by `richardson-factory-direct.js` (450 lines)
- `richardson-quote-service.js` (262 lines) → Quote building removed
- `richardson-112-images.js` → 112 is SanMar product, not Factory Direct
- `richardson-color-selector-enhancement.js` → Color picker not needed
- `richardson-color-selector.css` → Color picker styles removed

### Memory System Cleanup (2026-01-08)
**Context:** Cleaned up /memory/ docs to reduce Claude Code context bloat
- `/memory/3-day-tees/DAY-5-MORNING-SUMMARY.md` (413 lines) → Deleted (outdated dev log)
- `/memory/3-day-tees/DAY-5-AFTERNOON-SUMMARY.md` (498 lines) → Deleted (outdated dev log)
- `/memory/3-day-tees/DAY-6-MORNING-SUMMARY.md` (357 lines) → Deleted (outdated dev log)
- `/memory/PRICING_MANUAL_CORE.md` (294 lines) → Deleted (duplicated MANUAL_CALCULATOR_CONCEPTS.md)
- `/memory/INDEX.md` (525 lines → 130 lines) → Trimmed by 75%
- **Total savings:** ~1,957 lines of duplicate/stale content

### Removed During Cleanup (2025-01-27)
- **71 JavaScript files** - Orphaned, unused, or duplicate
- **6 HTML backup files** - Replaced by Git version control
- **Archive folder** - 3.8MB moved to external backup
- **Test files in root** - Moved to `/tests/` folder

### Additional Cleanup (2025-01-27 - Second Pass)
- **8 data/test files from root** - CSV test results, log files
- **5 training folder files** - .bak file, test files, duplicates
- **11 orphaned JS files** - Unused adapters and utilities in shared_components/js/

### Root Directory Organization (2025-01-27 - Third Pass)
**Moved from root to organized folders:**
- **6 data export files** → `/docs/data-exports/` (CSV, JSON, XML exports)
- **2 template files** → `/docs/templates/` (EmailJS and instructions)
- **4 guide documents** → `/docs/guides/` (API, CSS, system docs)
- **4 log/generated files** → `/logs/` (server.log, dependency maps)
- **1 script file** → `/scripts/` (migrate-beta.sh)
- **Total:** 17 files moved from root, reducing clutter by ~25%

### Files Scheduled for Removal
| File | Reason | Remove By | Status |
|------|--------|-----------|--------|
| None currently | - | - | - |

[Back to the registry index](../../ACTIVE_FILES.md)

### Training service consolidation — 2026-09-08

- `training/css/art-approval-guide.css`: replaced by shared training-service.css / training-guide.js after checking all consumers.
- `training/css/google-review-guide.css`: replaced by shared training-service.css / training-guide.js after checking all consumers.
- `training/js/art-approval-guide.js`: replaced by shared training-service.css / training-guide.js after checking all consumers.
- `training/js/thank-you-card-guide.js`: replaced by shared training-service.css / training-guide.js after checking all consumers.
- `training/js/lead-sheet-guide.js`: replaced by shared training-service.css / training-guide.js after checking all consumers.
- `training/js/google-review-guide.js`: replaced by shared training-service.css / training-guide.js after checking all consumers.


2026-09-08: retired training/shipping-receiving-guide.js and training/sanmar-purchasing-guide.js after both HTML callers moved to shared_components/js/training-reference.js.


2026-09-08: training/js/customer-service.js and training/js/get-to-know-erik.js retired after both callers moved to training-manual.js.
