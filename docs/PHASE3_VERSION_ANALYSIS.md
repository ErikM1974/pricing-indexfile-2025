# Phase 3: Version Conflict Analysis

## Files Identified with Version Numbers

### HTML Files (Root Directory)
1. **DTF Pricing**
   - `dtf-pricing.html` (CURRENT - no version number)
   - `dtf-pricing-v2.html` (OLD VERSION - not referenced)
   - `dtf-pricing-v3.html` (OLD VERSION - not referenced)

2. **Screen Print Pricing**
   - `screen-print-pricing.html` (CURRENT - uses v2 JS files)
   - `screen-print-pricing-v2.html` (OLD VERSION - not referenced)
   - `screen-print-pricing-v3.html` (OLD VERSION - not referenced)

3. **Embroidery Pricing**
   - `embroidery-pricing.html` (CURRENT - uses v3 JS)
   - `embroidery-pricing-v2.html` (OLD VERSION - not referenced)

### JavaScript Files (Active Usage)
1. **DTG Pricing JS**
   - `/shared_components/js/dtg-pricing-v4.js` (ACTIVE - used by dtg-pricing.html)
   - `/shared_components/js/dtg-pricing-v3.js` (INACTIVE - not referenced)

2. **Screen Print JS**
   - `/shared_components/js/screenprint-caspio-adapter-v2.js` (ACTIVE)
   - `/shared_components/js/screenprint-pricing-v2.js` (ACTIVE)

3. **Embroidery JS**
   - `/shared_components/js/embroidery-pricing-v3.js` (ACTIVE)

4. **Cap Embroidery JS**
   - `/shared_components/js/cap-embroidery-pricing-v3.js` (Status unknown)

### Other Versioned Files
- `calculators/art-invoice-service-v2.js` (May be active)
- `modern-search-interface-v2.js` (Status unknown)
- `modern-search-interface-v3.js` (Status unknown)
- `training/adriyella-daily-tasks-v2.html` (Training file)

## Safe to Archive

### HTML Files (Not Referenced Anywhere)
✅ `dtf-pricing-v2.html`
✅ `dtf-pricing-v3.html`
✅ `screen-print-pricing-v2.html`
✅ `screen-print-pricing-v3.html`
✅ `embroidery-pricing-v2.html`

### JavaScript Files (Not Used)
✅ `/shared_components/js/dtg-pricing-v3.js` (v4 is active)

## Files to Keep (Currently Active)

### Active Versioned JS Files
- `/shared_components/js/dtg-pricing-v4.js` ✓
- `/shared_components/js/screenprint-caspio-adapter-v2.js` ✓
- `/shared_components/js/screenprint-pricing-v2.js` ✓
- `/shared_components/js/embroidery-pricing-v3.js` ✓
- `/shared_components/js/cap-embroidery-pricing-v3.js` (Keep for safety)

### Need Further Investigation
- `modern-search-interface-v2.js` vs `modern-search-interface-v3.js`
- `calculators/art-invoice-service-v2.js`

## Recommendation

### Phase 3A: Safe Archival (Zero Risk)
Archive these unused HTML versions:
1. dtf-pricing-v2.html
2. dtf-pricing-v3.html
3. screen-print-pricing-v2.html
4. screen-print-pricing-v3.html
5. embroidery-pricing-v2.html
6. /shared_components/js/dtg-pricing-v3.js

### Phase 3B: Investigation Required
Check usage of:
1. modern-search-interface versions
2. art-invoice-service-v2.js

### Note on Active Files
The current production system uses:
- DTG: v4 JavaScript
- Screen Print: v2 JavaScript
- Embroidery: v3 JavaScript

These version numbers in active files should NOT be changed as they represent the current stable versions.