# 3-Day Tees - Fast Turnaround Service

**Last Updated:** 2025-11-20
**Status:** Implementation Complete - Ready for Testing
**Phase 2 Progress:** 80% complete

---

## 📋 Quick Navigation

### Getting Started
- [Overview](#-overview) - What is 3-Day Tees?
- [Quick Start](#-quick-start) - Get running in 5 minutes
- [File Structure](#-file-structure) - Where everything lives

### Documentation
- [Main PRD](../../3-DAY-TEES-PROJECT-REQUIREMENTS.md) - Executive summary
- [Implementation Guides](#-implementation-guides) - Complete technical docs
- [Development Workflow](#-development-workflow) - How to work on this project
- [Testing Procedures](#-testing-procedures) - Manual testing guide

### For Developers
- [Code Organization](CODE-ORGANIZATION.md) - How code is structured
- [Debugging Guide](DEBUGGING-GUIDE.md) - Debug toolkit and testing
- [API Integration](API-PATTERNS.md) - API endpoints and patterns

---

## 🎯 Overview

### What is 3-Day Tees?

**3-Day Tees** is a fast turnaround service for Port & Company PC54 t-shirts with DTG (Direct-to-Garment) printing. Customers can order decorated t-shirts with guaranteed 3-business-day production from artwork approval.

**Key Features:**
- ✅ **Fixed Product:** Port & Company PC54 (Core Cotton Tee)
- ✅ **5 Colors:** Jet Black, White, Navy, Athletic Heather, Dark Heather Grey
- ✅ **6 Sizes:** S, M, L, XL, 2XL, 3XL (with upcharges for 2XL/3XL)
- ✅ **DTG Printing:** Direct-to-garment with 25% rush fee
- ✅ **Real-Time Inventory:** Multi-SKU architecture (PC54, PC54_2X, PC54_3X)
- ✅ **File Upload:** Unlimited artwork files, 20MB max per file
- ✅ **Payment Processing:** Manual (Phase 1), Stripe integration (Phase 2)

**Business Model:**
- **Base Pricing:** Standard DTG pricing from API
- **Rush Fee:** 25% premium for 3-day turnaround
- **LTM Fee:** $75 for orders under 12 pieces
- **Size Upcharges:** $2 (2XL), $3 (3XL)
- **Shipping:** $30 flat rate (UPS Ground)
- **Sales Tax:** 10.1% (City of Milton, WA)

---

## 🚀 Quick Start

### Prerequisites

1. **Node.js** installed (for local development server)
2. **Git** installed (optional, for version control)
3. **Modern browser** (Chrome, Firefox, Edge, Safari)

### Running Locally

```bash
# Navigate to project root
cd "c:\Users\erik\OneDrive - Northwest Custom Apparel\2025\Pricing Index File 2025"

# Start the server
npm start

# Open browser
# Navigate to: http://localhost:3000/pages/3-day-tees.html
```

**Expected Result:** The 3-Day Tees page loads with:
- 5 color swatches (selectable)
- Size quantity grid (6 sizes)
- Inventory badges (In Stock/Low Stock/Out of Stock)
- Pricing calculator (updates in real-time)
- File upload section
- Order review phase

### First-Time Setup

If this is your first time running the project:

```bash
# Install dependencies (if not already installed)
npm install

# Verify server.js exists
ls server.js

# Start server (will run on port 3000)
npm start
```

**Troubleshooting:**
- **Port 3000 already in use?** Change port in server.js or kill the process using port 3000
- **Cannot find module?** Run `npm install` to install dependencies
- **Page not loading?** Check console for errors (F12 → Console tab)

---

## 📂 File Structure

### Core Application Files

```
/pages/
├── 3-day-tees.html              # Main HTML page (2,176 lines)
│   ├── Structure: 6 phases (Colors → Sizes → Locations → Upload → Review → Success)
│   ├── External JS: js/3-day-tees.js
│   └── External CSS: css/3-day-tees.css
│
├── /js/
│   ├── 3-day-tees.js            # Core application logic (1,814 lines)
│   │   ├── Pricing calculations (DTG + 25% rush fee)
│   │   ├── Multi-SKU inventory management
│   │   ├── File upload handling
│   │   ├── Order submission logic
│   │   └── Event handlers and validation
│   │
│   └── 3-day-tees-debug.js      # Debugging toolkit (770 lines) - DEV ONLY
│       ├── Debug console with filtering
│       ├── State inspector
│       ├── Test harness (6 automated tests)
│       └── Performance monitor
│
└── /css/
    └── 3-day-tees.css           # Application styles (1,943 lines)
        ├── Layout and grid system
        ├── Color swatch styles
        ├── Size input styles
        ├── Phase navigation
        └── Responsive breakpoints
```

### Shared Component Dependencies

```
/shared_components/
├── /js/
│   ├── dtg-pricing-service.js        # DTG pricing calculations (reused from DTG page)
│   ├── sample-order-service.js       # Order creation via ManageOrders API
│   └── sample-inventory-service.js   # Real-time inventory checks (5-min cache)
│
└── /css/
    └── (standard Bootstrap + custom styles)
```

### Documentation Files

```
/memory/3-day-tees/
├── README.md                         # This file - Main documentation entry point
├── OVERVIEW.md                       # Architecture and reusable components (25 total)
├── PRICING-FORMULA.md                # 7-step DTG pricing + 25% rush fee
├── INVENTORY-INTEGRATION.md          # Multi-SKU inventory architecture
├── API-PATTERNS.md                   # 4 API endpoints (pricing, inventory, order, upload)
├── IMPLEMENTATION-TIMELINE.md        # 4-day development plan (Phase 1 complete)
├── BUSINESS-LOGIC.md                 # Business rules, terms, fees
├── CODE-ORGANIZATION.md              # Architectural decisions (Tasks 6-10)
├── DEBUGGING-GUIDE.md                # Debug toolkit and testing procedures
└── TEST-EXECUTION-CHECKLIST.md       # Manual testing checklist (Day 6)
```

**Main PRD:** `3-DAY-TEES-PROJECT-REQUIREMENTS.md` (root directory)

---

## 📚 Implementation Guides

### Core Documentation

1. **[OVERVIEW.md](OVERVIEW.md)** - Start here for architecture overview
   - 25 reusable components identified
   - Multi-SKU inventory patterns (PC54/PC54_2X/PC54_3X)
   - Component integration strategy
   - File structure and dependencies

2. **[PRICING-FORMULA.md](PRICING-FORMULA.md)** - Complete pricing calculation
   - 7-step DTG pricing formula
   - 25% rush fee application
   - Size upcharge handling ($2 for 2XL, $3 for 3XL)
   - LTM fee logic ($75 for orders < 12 pieces)

3. **[INVENTORY-INTEGRATION.md](INVENTORY-INTEGRATION.md)** - Multi-SKU architecture
   - PC54/PC54_2X/PC54_3X pattern (CRITICAL for inventory)
   - Real-time inventory checks via ManageOrders API
   - CATALOG_COLOR vs COLOR_NAME (common error source)
   - 5-minute cache strategy

4. **[API-PATTERNS.md](API-PATTERNS.md)** - API integration patterns
   - 4 API endpoints documented
   - Request/response examples
   - Error handling strategies
   - Authentication and rate limiting

5. **[IMPLEMENTATION-TIMELINE.md](IMPLEMENTATION-TIMELINE.md)** - Development roadmap
   - 4-day development plan (Phase 1: 100% complete)
   - Testing procedures (Phase 2: Ready for testing)
   - Phase 2 Stripe integration (planned)
   - Deployment checklist

6. **[BUSINESS-LOGIC.md](BUSINESS-LOGIC.md)** - Business rules reference
   - Pricing & fees (LTM, shipping, tax)
   - Payment terms (manual → Stripe in Phase 2)
   - Terms & conditions
   - Error handling & fallbacks

### Code Quality Documentation

7. **[CODE-ORGANIZATION.md](CODE-ORGANIZATION.md)** - Architectural decisions
   - External JavaScript extraction (Task 6)
   - External CSS extraction (Task 10)
   - JSDoc documentation (Task 9)
   - Consolidated initialization (Task 8)
   - Debug toolkit separation

8. **[DEBUGGING-GUIDE.md](DEBUGGING-GUIDE.md)** - Debug tools and testing
   - Debug console with log filtering
   - State inspector for application state
   - Test harness (6 automated pricing tests)
   - Performance monitor
   - Console commands reference

9. **[TEST-EXECUTION-CHECKLIST.md](TEST-EXECUTION-CHECKLIST.md)** - Manual testing
   - Day 6 test execution checklist
   - 8 test cases (4 priority levels)
   - Verification procedures
   - Issue tracking template
   - Production readiness sign-off

---

## 🛠️ Development Workflow

### Making Changes to the Code

**1. Locate the file to edit:**
```bash
# Main HTML structure
pages/3-day-tees.html

# Application logic
pages/js/3-day-tees.js

# Styling
pages/css/3-day-tees.css

# Debug tools (development only)
pages/js/3-day-tees-debug.js
```

**2. Make your changes:**
- Edit the appropriate file
- Save changes
- Refresh browser (Ctrl+Shift+R for hard refresh)

**3. Test your changes:**
```bash
# Start server if not running
npm start

# Open in browser
http://localhost:3000/pages/3-day-tees.html

# Check console for errors (F12)
# Verify functionality works as expected
```

**4. Use debug toolkit (development mode):**

Load the debug toolkit by adding `?debug=true` to URL:
```
http://localhost:3000/pages/3-day-tees.html?debug=true
```

Access debug tools in browser console:
```javascript
// Show all available commands
ThreeDayDebug.help()

// Inspect current application state
ThreeDayDebug.state.inspect()

// Run automated pricing tests
ThreeDayDebug.tests.runAll()

// Check performance metrics
ThreeDayDebug.performance.summary()

// Export debug logs
ThreeDayDebug.console.export()
```

**5. Verify no errors:**
```bash
# Check browser console (F12)
# Should see no red errors
# Should see successful initialization logs:
# [3-Day Tees] Initializing application...
# [3-Day Tees] ✓ Application initialization complete
```

### Common Development Tasks

**Adding a new color:**
```javascript
// File: pages/js/3-day-tees.js
// Location: ~line 50

const colors = [
    {
        name: 'Jet Black',
        catalogColor: 'Jet Black',
        hex: '#000000',
        image: 'https://cdn.caspio.com/...'
    },
    // Add new color here
    {
        name: 'Your New Color',
        catalogColor: 'YourNewColor',  // MUST match ShopWorks format
        hex: '#123456',
        image: 'https://cdn.caspio.com/...'
    }
];
```

**Modifying pricing:**
```javascript
// File: pages/js/3-day-tees.js
// Location: calculateUnitPrice() function

// Rush fee is 25% (change if needed)
const RUSH_FEE_MULTIPLIER = 1.25;

// Size upcharges (change if needed)
const upcharge = pricingData.pricing?.upcharges?.[size] || 0;
```

**Changing file upload limits:**
```javascript
// File: pages/js/3-day-tees.js
// Location: validateFile() function

const MAX_FILE_SIZE = 20 * 1024 * 1024;  // 20MB (change if needed)
```

### Code Organization Principles

**Follow these principles when making changes:**

1. **Single Responsibility** - Each function does one thing
2. **Logical Grouping** - Related functions are near each other
3. **Clear Dependencies** - Initialization order is explicit
4. **Documentation** - All functions have JSDoc comments

**Example:**
```javascript
/**
 * Calculate final unit price for 3-Day Tees product
 *
 * Formula:
 * 1. Get base DTG price for quantity/location
 * 2. Apply 25% rush fee: basePrice × 1.25
 * 3. Round to half-dollar: Math.ceil(price × 2) / 2
 * 4. Add size upcharge if applicable
 *
 * @param {number} quantity - Total quantity across all colors/sizes
 * @param {string} location - Print location code (e.g., 'LC', 'FF', 'FB')
 * @param {string} size - Size code (e.g., 'S', 'M', 'L', 'XL', '2XL', '3XL')
 * @param {Object} pricingData - Pricing data from DTG API
 * @returns {number} Final unit price with rush fee and size upcharge
 */
function calculateUnitPrice(quantity, location, size, pricingData) {
    // Implementation...
}
```

---

## 🧪 Testing Procedures

### Manual Testing Checklist

**See [TEST-EXECUTION-CHECKLIST.md](TEST-EXECUTION-CHECKLIST.md) for complete testing guide.**

**Quick Test (5 minutes):**

1. **Load page** - Verify all colors and sizes load
2. **Select colors** - Click multiple color swatches
3. **Enter quantities** - Add quantities to size grid
4. **Check inventory** - Verify badges show (In Stock/Low Stock/Out of Stock)
5. **View pricing** - Verify live pricing updates
6. **Upload file** - Add an artwork file
7. **Review order** - Check Phase 5 summary
8. **Console check** - No red errors in browser console

### Automated Tests

**Run automated pricing tests:**

```javascript
// In browser console (with debug=true)
ThreeDayDebug.tests.runAll()

// Expected output:
// ✅ Test 1: Base pricing (24 qty, LC) - PASSED
// ✅ Test 2: LTM fee (6 qty, LC) - PASSED
// ✅ Test 3: Rush fee calculation - PASSED
// ✅ Test 4: Size upcharges (2XL, 3XL) - PASSED
// ✅ Test 5: Multi-color orders - PASSED
// ✅ Test 6: Quantity tier changes - PASSED
// ✓ All tests passed (6/6)
```

### Regression Testing

**After making code changes, verify:**

- [ ] Page loads without errors
- [ ] All 5 colors selectable
- [ ] Size grid updates per color
- [ ] Inventory badges display correctly
- [ ] Pricing calculates accurately
- [ ] File upload works
- [ ] Order review shows correct data
- [ ] Success message displays on submit
- [ ] Console shows no errors

### Browser Testing

**Test in these browsers:**
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Edge (latest)
- ✅ Safari (latest)

**Mobile Testing:**
- ✅ Chrome Mobile (Android)
- ✅ Safari Mobile (iOS)

### Performance Testing

```javascript
// In browser console (with debug=true)
ThreeDayDebug.performance.summary()

// Check metrics:
// - API calls: Should be < 15 on initial load
// - Cache hit rate: Should be > 80% after first load
// - Average render time: Should be < 100ms
// - Memory usage: Should be < 50MB
```

---

## 🚀 Deployment

### Pre-Deployment Checklist

- [ ] All tests passing (manual and automated)
- [ ] No console errors in production
- [ ] Debug toolkit excluded from production build
- [ ] API endpoints pointing to production
- [ ] File upload size limits configured
- [ ] Email notifications working
- [ ] Order submission to ShopWorks verified
- [ ] Inventory checks returning accurate data
- [ ] Payment processing configured (Stripe in Phase 2)

### Deployment Steps

**1. Remove debug toolkit:**
```html
<!-- File: pages/3-day-tees.html -->
<!-- Comment out or remove this line: -->
<!-- <script src="js/3-day-tees-debug.js"></script> -->
```

**2. Verify production API endpoints:**
```javascript
// File: pages/js/3-day-tees.js
// Verify these point to production:
const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const MANAGEORDERS_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders';
```

**3. Test production build:**
```bash
# Start server
npm start

# Open in browser (without debug=true)
http://localhost:3000/pages/3-day-tees.html

# Verify functionality
# Check console - should see no debug logs
```

**4. Deploy to Heroku:**
```bash
# Commit changes
git add .
git commit -m "Deploy 3-Day Tees - Phase 2 complete"

# Push to Heroku
git push heroku main

# Verify deployment
# Open production URL
```

**5. Post-deployment verification:**
- [ ] Production URL loads correctly
- [ ] Order submission creates ShopWorks orders
- [ ] Customer emails sending
- [ ] Sales team emails sending
- [ ] Inventory checks working
- [ ] File uploads working

### Production Monitoring

**Monitor these metrics:**
- Order submission success rate (should be > 95%)
- API response times (should be < 2 seconds)
- File upload success rate (should be > 98%)
- Email delivery rate (should be 100%)
- Inventory accuracy (verify weekly)

### Rollback Procedure

**If issues occur in production:**

```bash
# Revert to previous version
git revert HEAD

# Push to Heroku
git push heroku main

# Notify team
# Investigate issue in development
# Fix and redeploy when ready
```

---

## 📞 Support & Resources

### Documentation Quick Links

- **Main PRD:** [3-DAY-TEES-PROJECT-REQUIREMENTS.md](../../3-DAY-TEES-PROJECT-REQUIREMENTS.md)
- **Architecture:** [OVERVIEW.md](OVERVIEW.md)
- **Pricing:** [PRICING-FORMULA.md](PRICING-FORMULA.md)
- **Inventory:** [INVENTORY-INTEGRATION.md](INVENTORY-INTEGRATION.md)
- **APIs:** [API-PATTERNS.md](API-PATTERNS.md)
- **Code Organization:** [CODE-ORGANIZATION.md](CODE-ORGANIZATION.md)
- **Debugging:** [DEBUGGING-GUIDE.md](DEBUGGING-GUIDE.md)
- **Testing:** [TEST-EXECUTION-CHECKLIST.md](TEST-EXECUTION-CHECKLIST.md)

### External Resources

- **ShopWorks Documentation:** Contact ShopWorks support for OnSite 7 documentation
- **ManageOrders API:** See `memory/MANAGEORDERS_INTEGRATION.md` for complete API reference
- **DTG Pricing Service:** See `shared_components/js/dtg-pricing-service.js` for implementation
- **Sample Order Service:** See `shared_components/js/sample-order-service.js` for order creation

### Company Information

- **Company:** Northwest Custom Apparel
- **Phone:** 253-922-5793
- **Email:** sales@nwcustomapparel.com
- **Address:** 2025 Freeman Road East, Milton, WA 98354
- **Hours:** Monday - Friday, 8:30 AM - 5:00 PM PST

---

## 🔧 Troubleshooting

### Common Issues

**Issue: Page not loading**
```
Solution:
1. Check server is running: npm start
2. Verify port 3000 is available
3. Check browser console for errors
4. Clear browser cache (Ctrl+Shift+R)
```

**Issue: Inventory showing "Unable to Verify"**
```
Solution:
1. Verify CATALOG_COLOR is correct (not COLOR_NAME)
2. Check API endpoints are accessible
3. Verify network connectivity
4. Check console for API error details
```

**Issue: Pricing not calculating**
```
Solution:
1. Check DTG pricing API is responding
2. Verify quantity is valid (> 0)
3. Check location is selected
4. Verify pricingData loaded successfully
5. Run debug tests: ThreeDayDebug.tests.runAll()
```

**Issue: File upload failing**
```
Solution:
1. Check file size < 20MB
2. Verify file type is supported
3. Check network connectivity
4. Verify upload API endpoint
5. Check console for error details
```

**Issue: Order not submitting**
```
Solution:
1. Verify all required fields filled
2. Check customer information valid
3. Verify file uploads complete
4. Check ManageOrders API accessible
5. Review console for submission errors
```

### Debug Commands

**Check application state:**
```javascript
ThreeDayDebug.state.inspect()
```

**Verify pricing data:**
```javascript
console.log(window.pricingData)
```

**Check inventory cache:**
```javascript
console.log(state.inventoryCache)
```

**Test API connectivity:**
```javascript
fetch('https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/health')
    .then(r => r.json())
    .then(console.log)
```

**Clear all caches:**
```javascript
sessionStorage.clear()
localStorage.clear()
location.reload(true)
```

---

## 📈 Project Status

### Phase 1: Core Implementation ✅ COMPLETE (100%)

- ✅ File structure organization
- ✅ Multi-color selection (5 colors)
- ✅ Size quantity grid (6 sizes)
- ✅ Multi-SKU inventory integration
- ✅ DTG pricing calculation (7-step formula + 25% rush fee)
- ✅ File upload functionality (unlimited files, 20MB max)
- ✅ Order review and submission
- ✅ ManageOrders API integration
- ✅ Email notifications (customer + sales team)
- ✅ External JavaScript extraction (Task 6)
- ✅ External CSS extraction (Task 10)
- ✅ JSDoc documentation (Task 9)
- ✅ Consolidated initialization (Task 8)
- ✅ Debug toolkit (Task 11)
- ✅ Documentation updates (7 files)
- ✅ New documentation creation (3 files)

### Phase 2: Testing & Refinement ⏳ IN PROGRESS (80%)

- ✅ Manual testing checklist created
- ✅ Automated pricing tests implemented
- ✅ Debug toolkit with 6 test scenarios
- ✅ Code organization documentation
- ✅ Debugging guide documentation
- ⏳ User acceptance testing (pending)
- ⏳ Cross-browser verification (pending)
- ⏳ Production deployment (pending)

### Phase 3: Payment Integration 📝 PLANNED

- ⏳ Stripe API integration
- ⏳ Payment processing UI
- ⏳ Payment confirmation emails
- ⏳ Order notes update with payment ID
- ⏳ Error handling for failed payments
- ⏳ Test mode validation
- ⏳ Production payment testing

### Phase 4: Production Launch 📝 PLANNED

- ⏳ Final production testing
- ⏳ Staff training
- ⏳ Customer communication
- ⏳ Monitoring setup
- ⏳ Go-live checklist
- ⏳ Post-launch monitoring

---

## 📝 Changelog

### 2025-11-20 - Phase 2 Development Complete

**Tasks 6-11 Complete:**
- Extracted JavaScript to external file (1,814 lines)
- Extracted CSS to external file (1,943 lines)
- Added JSDoc documentation to pricing functions
- Consolidated initialization to single handler
- Created debug toolkit (770 lines)
- Removed obsolete inventory code
- Updated 7 existing documentation files
- Created 3 new documentation files

**File Size Improvements:**
- HTML: 6,500+ lines → 2,176 lines (-67%)
- Embedded code: 0 (was 3,700+ lines)
- External code: 3,757 lines (organized and documented)

**Documentation Complete:**
- README.md (this file) - Main documentation entry point
- CODE-ORGANIZATION.md - Architectural decisions
- DEBUGGING-GUIDE.md - Debug toolkit and testing
- All 7 existing files updated with implementation details

**Status:** Ready for Day 6 manual testing

### 2025-11-08 - Phase 1 Development Complete

**Initial Implementation:**
- 6-phase user workflow
- 5 colors, 6 sizes, 3 print locations
- Multi-SKU inventory (PC54/PC54_2X/PC54_3X)
- DTG pricing with 25% rush fee
- File upload (unlimited files, 20+ types)
- Order submission to ShopWorks
- Email notifications

**Status:** Core functionality complete, ready for code organization

---

## 🎓 Training Notes

### For New Developers

**1. Read these files in order:**
1. This README (overview and quick start)
2. [OVERVIEW.md](OVERVIEW.md) (architecture and components)
3. [CODE-ORGANIZATION.md](CODE-ORGANIZATION.md) (how code is structured)
4. [DEBUGGING-GUIDE.md](DEBUGGING-GUIDE.md) (debugging tools)

**2. Understand these concepts:**
- Multi-SKU inventory (PC54/PC54_2X/PC54_3X)
- CATALOG_COLOR vs COLOR_NAME (critical for inventory)
- 7-step DTG pricing formula
- 25% rush fee application
- File upload handling
- Order submission workflow

**3. Practice with debug toolkit:**
```javascript
// Load debug mode
http://localhost:3000/pages/3-day-tees.html?debug=true

// Run all tests
ThreeDayDebug.tests.runAll()

// Inspect state
ThreeDayDebug.state.inspect()
```

**4. Make a small change:**
- Add a console.log to a function
- Change a color hex value
- Modify a size upcharge
- Test your change works

### For Sales Team

**What customers see:**
1. Select colors (up to 5)
2. Enter quantities per size
3. Choose print location
4. Upload artwork files
5. Review order and pricing
6. Submit order

**What happens behind the scenes:**
1. Inventory checked in real-time
2. Pricing calculated with rush fee
3. Files uploaded to server
4. Order created in ShopWorks
5. Emails sent to customer and sales team

**Customer expectations:**
- 3 business days from artwork approval
- $30 flat shipping (UPS Ground)
- 10.1% sales tax (Milton, WA)
- $75 LTM fee if < 12 pieces

---

## 📄 License & Contact

**Project:** 3-Day Tees Fast Turnaround Service
**Company:** Northwest Custom Apparel
**Developer:** Erik Mickelson (erik@nwcustomapparel.com)
**Last Updated:** 2025-11-20
**Version:** 2.0.0 (Phase 2 Complete)

---

**Documentation Type:** Main README
**Parent Document:** 3-DAY-TEES-PROJECT-REQUIREMENTS.md
**Related Docs:** All files in `/memory/3-day-tees/`
