# Phase 4: Root Directory Organization Plan

## Current Root Directory Status
- **31 Markdown files** (documentation)
- **59 HTML files** (mixed purposes)
- **Several JS files** (utilities)

## Proposed Organization Structure

### 1. Documentation Files → /docs
Move all .md files except README.md and CLAUDE.md to /docs folder:
- All ART_* documentation
- All cleanup logs (PHASE1, PHASE2, PHASE3)
- All plan files (*_PLAN.md)
- Analysis and summary files

### 2. Dashboard Files → /dashboards
Move specialized dashboard files:
- ae-art-dashboard.html
- ae-dashboard.html
- art-hub-dashboard.html
- art-invoice-unified-dashboard.html
- art-invoices-dashboard.html
- staff-dashboard-integrated.html (if duplicate)

### 3. Pricing Pages (Keep in Root)
These are main navigation pages, keep in root:
- dtg-pricing.html
- dtf-pricing.html
- screen-print-pricing.html
- embroidery-pricing.html
- cap-embroidery-pricing-integrated.html

### 4. Core Files (Keep in Root)
Essential files that must stay:
- index.html
- staff-dashboard.html
- README.md
- CLAUDE.md

### 5. Art/Invoice System Files
Review and organize:
- art-hub-*.html files
- art-invoice-*.html files
- Consider moving to /art-system/ folder

## Files to Investigate

### Potential Duplicates
- `dtg-pricing-refactored.html` vs `dtg-pricing.html`
- `staff-dashboard-integrated.html` vs `staff-dashboard.html`

### Standalone Pages
Need to check if these are linked from main navigation:
- diagnose-search-issue.html
- product-catalog.html
- Various other standalone pages

## Safety Checks Before Moving

1. Check staff-dashboard.html for links to dashboard files
2. Verify no external pages link to files we're moving
3. Keep all actively linked files in their current location
4. Only move true documentation and unused duplicates

## Proposed Actions (Low Risk)

### Phase 4A: Documentation Organization
1. Create /docs folder
2. Move all .md files except README.md and CLAUDE.md
3. This is ZERO risk as .md files are not linked in the application

### Phase 4B: Dashboard Consolidation
1. Check which dashboard files are actively linked
2. Move unused dashboard variants to /dashboards folder
3. Keep actively used dashboards in place

### Phase 4C: Clean Up Duplicates
1. Verify which version is active
2. Archive the inactive version