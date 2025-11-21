# 3-Day Tees - Debugging Guide

**Last Updated:** 2025-11-20
**Purpose:** Comprehensive guide for using the debugging tools in 3-day-tees-debug.js
**Status:** Production-ready debugging toolkit

---

## 📋 Quick Navigation

**Related Documentation:**
- **[Main PRD](../../3-DAY-TEES-PROJECT-REQUIREMENTS.md)** - Executive summary
- **[Overview](OVERVIEW.md)** - Architecture and components
- **[Code Organization](CODE-ORGANIZATION.md)** - Code structure decisions
- **[API Patterns](API-PATTERNS.md)** - API integration
- **[Implementation Timeline](IMPLEMENTATION-TIMELINE.md)** - Development plan

---

## 🎯 Overview

### What is 3-day-tees-debug.js?

**File:** `pages/js/3-day-tees-debug.js` (770 lines)
**Purpose:** Comprehensive debugging toolkit for development and troubleshooting
**Status:** DEV ONLY - Not loaded in production

The debug toolkit provides:
- **Debug Console** - Structured logging with category/level filtering
- **State Inspector** - View application state, take snapshots, compare states
- **Test Harness** - Automated pricing tests (6 scenarios)
- **Performance Monitor** - Track API calls, render times, memory usage

---

## 🚀 Quick Start

### Loading the Debug Toolkit

The debug toolkit is loaded via script tag in 3-day-tees.html:

```html
<!-- Debug Tools (DEV ONLY - remove for production) -->
<script src="js/3-day-tees-debug.js"></script>
```

**⚠️ IMPORTANT:** Remove this script tag before deploying to production.

### Accessing Debug Commands

All debug commands are accessed via the global `ThreeDayDebug` object:

```javascript
// Open browser console (F12) and type:
ThreeDayDebug.help()  // Shows all available commands
```

---

## 🔧 Debug Console

### Overview

Structured logging system with category-based filtering and severity levels.

### Available Commands

```javascript
// View all commands
ThreeDayDebug.help()

// Show recent log entries
ThreeDayDebug.console.show()

// Filter logs by category
ThreeDayDebug.console.filter('pricing')
ThreeDayDebug.console.filter('inventory')
ThreeDayDebug.console.filter('api')

// Filter logs by severity level
ThreeDayDebug.console.level('error')   // Show only errors
ThreeDayDebug.console.level('warn')    // Show warnings and errors
ThreeDayDebug.console.level('info')    // Show info, warnings, errors
ThreeDayDebug.console.level('debug')   // Show all logs

// Clear console
ThreeDayDebug.console.clear()

// Export logs to JSON file
ThreeDayDebug.console.export()
```

### Log Categories

- **pricing** - Price calculations, tier selection, upcharge application
- **inventory** - Inventory checks, cache operations, stock levels
- **api** - API calls, responses, errors
- **ui** - UI updates, phase transitions, user interactions
- **validation** - Form validation, input checks
- **cart** - Cart operations, quantity updates

### Example Usage

```javascript
// Enable debug logging for pricing
ThreeDayDebug.console.filter('pricing')

// Select a color and quantity
// Console will show:
// [PRICING] Calculating price for 24 units
// [PRICING] Selected tier: 24-47
// [PRICING] Base price: $35.39
// [PRICING] With rush fee (25%): $44.24

// Export logs for analysis
ThreeDayDebug.console.export()
// Downloads: 3-day-tees-logs-[timestamp].json
```

---

## 📊 State Inspector

### Overview

View and analyze application state, take snapshots, and compare state changes.

### Available Commands

```javascript
// View current state
ThreeDayDebug.state.inspect()

// Take a snapshot
ThreeDayDebug.state.snapshot('before-color-change')

// List all snapshots
ThreeDayDebug.state.listSnapshots()

// Compare two snapshots
ThreeDayDebug.state.compare('before-color-change', 'after-color-change')

// View state history
ThreeDayDebug.state.history()

// Clear snapshots
ThreeDayDebug.state.clearSnapshots()
```

### State Structure

```javascript
{
  selectedColors: ['Forest', 'Navy'],
  selectedPrintLocations: ['LC'],
  sizeQuantities: {
    'Forest': { 'S': 5, 'M': 10, 'L': 8, 'XL': 2 },
    'Navy': { 'M': 12, 'L': 12 }
  },
  pricing: {
    unitPrice: 35.39,
    rushFeePercentage: 25,
    totalQuantity: 49,
    subtotal: 1733.91
  },
  inventoryCache: {
    'Forest': { total: 605, timestamp: 1699468800000 },
    'Navy': { total: 1470, timestamp: 1699468800000 }
  }
}
```

### Example Usage

```javascript
// Take snapshot before making changes
ThreeDayDebug.state.snapshot('initial-load')

// User selects colors and sizes
// ...

// Take snapshot after changes
ThreeDayDebug.state.snapshot('after-selection')

// Compare states
ThreeDayDebug.state.compare('initial-load', 'after-selection')
// Shows:
// Added: selectedColors (2 colors)
// Changed: totalQuantity (0 → 49)
// Changed: subtotal (0.00 → 1733.91)
```

---

## 🧪 Test Harness

### Overview

Automated pricing tests covering common scenarios.

### Available Commands

```javascript
// Run all tests
ThreeDayDebug.tests.runAll()

// Run specific test
ThreeDayDebug.tests.pricing.testLTM()
ThreeDayDebug.tests.pricing.testTiers()
ThreeDayDebug.tests.pricing.testMultiColor()
ThreeDayDebug.tests.pricing.testUpcharges()
ThreeDayDebug.tests.pricing.testRushFee()
ThreeDayDebug.tests.pricing.testCombinations()

// View test results
ThreeDayDebug.tests.results()

// Clear test results
ThreeDayDebug.tests.clear()
```

### Test Scenarios

#### Test 1: LTM Fee (Less Than Minimum)

```javascript
ThreeDayDebug.tests.pricing.testLTM()

// Tests:
// - 8 units (under minimum of 12)
// - Verifies $75 LTM fee applied
// - Checks per-unit distribution: $75 / 8 = $9.38
```

#### Test 2: Quantity Tiers

```javascript
ThreeDayDebug.tests.pricing.testTiers()

// Tests pricing across all tiers:
// - 12-23 units (Tier 1)
// - 24-47 units (Tier 2)
// - 48-71 units (Tier 3)
// - 72+ units (Tier 4)
```

#### Test 3: Multi-Color Orders

```javascript
ThreeDayDebug.tests.pricing.testMultiColor()

// Tests:
// - 2 colors selected
// - Different quantities per color
// - Correct tier selection for total quantity
// - Aggregated pricing
```

#### Test 4: Size Upcharges

```javascript
ThreeDayDebug.tests.pricing.testUpcharges()

// Tests:
// - Standard sizes (S, M, L, XL): $0 upcharge
// - 2XL: +$2.00 upcharge
// - 3XL: +$3.00 upcharge
```

#### Test 5: 25% Rush Fee

```javascript
ThreeDayDebug.tests.pricing.testRushFee()

// Tests:
// - Base DTG price calculation
// - 25% rush fee application
// - Correct rounding (half-dollar ceiling)
```

#### Test 6: Complex Combinations

```javascript
ThreeDayDebug.tests.pricing.testCombinations()

// Tests:
// - Multiple colors + Multiple sizes
// - Mix of standard and oversized
// - LTM fee with upcharges
// - Full pricing calculation
```

### Example Test Output

```javascript
ThreeDayDebug.tests.runAll()

// Console output:
// ✓ Test 1: LTM Fee - PASSED
//   Expected: $75.00 LTM fee for 8 units
//   Actual: $75.00 ✓
//
// ✓ Test 2: Quantity Tiers - PASSED
//   Tier 1 (12-23): $38.50/unit ✓
//   Tier 2 (24-47): $35.39/unit ✓
//   Tier 3 (48-71): $33.16/unit ✓
//   Tier 4 (72+): $31.47/unit ✓
//
// ✓ Test 3: Multi-Color - PASSED
//   2 colors, 49 total units
//   Expected tier: 48-71 ✓
//   Price: $35.39/unit ✓
//
// ✓ Test 4: Size Upcharges - PASSED
//   Standard sizes: $0 upcharge ✓
//   2XL: +$2.00 ✓
//   3XL: +$3.00 ✓
//
// ✓ Test 5: Rush Fee - PASSED
//   Base DTG: $28.31
//   With 25% rush: $35.39 ✓
//
// ✓ Test 6: Complex Combinations - PASSED
//   Total: $1,733.91 ✓
//
// All tests passed: 6/6
```

---

## ⚡ Performance Monitor

### Overview

Track API calls, render times, and memory usage.

### Available Commands

```javascript
// View performance summary
ThreeDayDebug.performance.summary()

// View API call statistics
ThreeDayDebug.performance.api()

// View render performance
ThreeDayDebug.performance.render()

// View memory usage
ThreeDayDebug.performance.memory()

// Start performance profiling
ThreeDayDebug.performance.start()

// Stop performance profiling
ThreeDayDebug.performance.stop()

// Clear performance data
ThreeDayDebug.performance.clear()
```

### Performance Metrics

```javascript
ThreeDayDebug.performance.summary()

// Output:
{
  api: {
    totalCalls: 15,
    averageResponseTime: 234,  // ms
    slowestCall: {
      endpoint: '/api/manageorders/inventorylevels',
      duration: 892,  // ms
      timestamp: '2025-11-20T10:30:00.000Z'
    },
    cacheHitRate: 73.3  // %
  },
  render: {
    averageRenderTime: 45,  // ms
    slowestRender: {
      component: 'Size Quantity Grid',
      duration: 127,  // ms
    },
    totalRenders: 23
  },
  memory: {
    used: 12.4,  // MB
    limit: 256,  // MB
    percentUsed: 4.8  // %
  }
}
```

### Example Usage

```javascript
// Start profiling
ThreeDayDebug.performance.start()

// Perform actions (select colors, change quantities, etc.)
// ...

// Stop profiling
ThreeDayDebug.performance.stop()

// View results
ThreeDayDebug.performance.summary()

// Identify slow API calls
ThreeDayDebug.performance.api()
// Shows:
// API Call Performance:
// 1. /inventorylevels (PC54_2X, Forest) - 892ms ⚠️ SLOW
// 2. /inventorylevels (PC54, Navy) - 234ms ✓
// 3. /inventorylevels (PC54_3X, White) - 156ms ✓
// Cache hit rate: 73.3%
```

---

## 🔍 Debugging Common Issues

### Issue 1: Incorrect Pricing

**Symptoms:**
- Price doesn't match expected value
- Tier selection seems wrong
- Upcharges not applied

**Debug Steps:**

```javascript
// 1. Enable pricing logs
ThreeDayDebug.console.filter('pricing')

// 2. Take state snapshot
ThreeDayDebug.state.snapshot('before-calculation')

// 3. Trigger price calculation
// (select colors/sizes)

// 4. Take another snapshot
ThreeDayDebug.state.snapshot('after-calculation')

// 5. Compare states
ThreeDayDebug.state.compare('before-calculation', 'after-calculation')

// 6. Run pricing tests
ThreeDayDebug.tests.pricing.runAll()

// 7. Review logs
ThreeDayDebug.console.show()
```

**Expected Output:**
```
[PRICING] Total quantity: 49
[PRICING] Selected tier: 48-71
[PRICING] Base DTG price: $28.31
[PRICING] Rush fee (25%): $7.08
[PRICING] Final unit price: $35.39 ✓
```

---

### Issue 2: Inventory Not Updating

**Symptoms:**
- Inventory badges show stale data
- Cache not refreshing
- Stock levels incorrect

**Debug Steps:**

```javascript
// 1. Enable inventory logs
ThreeDayDebug.console.filter('inventory')

// 2. Check cache status
ThreeDayDebug.state.inspect()
// Look at: inventoryCache

// 3. Clear cache manually
window.state.inventoryCache = {}

// 4. Trigger inventory refresh
// (select different color)

// 5. Check API performance
ThreeDayDebug.performance.api()

// 6. Review inventory logs
ThreeDayDebug.console.show()
```

**Expected Output:**
```
[INVENTORY] Cache miss for Forest
[API] GET /inventorylevels?PartNumber=PC54&Color=Forest - 234ms
[INVENTORY] ✓ Cached inventory for Forest: 605 units
[INVENTORY] Cache hit for Forest (age: 45s)
```

---

### Issue 3: Slow Performance

**Symptoms:**
- Page feels sluggish
- API calls taking too long
- Render delays

**Debug Steps:**

```javascript
// 1. Start performance profiling
ThreeDayDebug.performance.start()

// 2. Perform typical user actions
// (select 5 colors, change quantities)

// 3. Stop profiling
ThreeDayDebug.performance.stop()

// 4. View summary
ThreeDayDebug.performance.summary()

// 5. Identify bottlenecks
ThreeDayDebug.performance.api()
ThreeDayDebug.performance.render()

// 6. Check cache hit rate
// Should be > 70% for good performance
```

**Expected Output:**
```
Performance Summary:
- API calls: 15 total, 11 cached (73.3% hit rate) ✓
- Average response: 234ms ✓
- Slowest call: 892ms (PC54_2X inventory) ⚠️
- Render average: 45ms ✓
- Memory used: 12.4 MB (4.8%) ✓

Recommendation: Cache is working well.
Consider optimizing PC54_2X inventory call.
```

---

## 📝 Best Practices

### Development Workflow

1. **Start with console filtering**
   ```javascript
   ThreeDayDebug.console.filter('pricing')  // Focus on one area
   ```

2. **Take snapshots before/after changes**
   ```javascript
   ThreeDayDebug.state.snapshot('before-fix')
   // Make changes
   ThreeDayDebug.state.snapshot('after-fix')
   ThreeDayDebug.state.compare('before-fix', 'after-fix')
   ```

3. **Run automated tests**
   ```javascript
   ThreeDayDebug.tests.runAll()  // Verify nothing broke
   ```

4. **Monitor performance**
   ```javascript
   ThreeDayDebug.performance.summary()  // Check for regressions
   ```

5. **Export logs for analysis**
   ```javascript
   ThreeDayDebug.console.export()  // Save for later review
   ```

### Production Deployment

**⚠️ CRITICAL:** Remove debug toolkit before production:

```html
<!-- DEBUG ONLY - REMOVE FOR PRODUCTION -->
<script src="js/3-day-tees-debug.js"></script>
```

**Checklist:**
- [ ] Remove debug script tag from 3-day-tees.html
- [ ] Verify `window.ThreeDayDebug` is undefined in production
- [ ] Test production build without debug tools
- [ ] Confirm no debug logs in production console

---

## 🎓 Training Examples

### Example 1: Testing New Pricing Logic

```javascript
// Scenario: Added new tier for 144+ units

// 1. Take baseline snapshot
ThreeDayDebug.state.snapshot('baseline')

// 2. Enable pricing logs
ThreeDayDebug.console.filter('pricing')

// 3. Test with 144 units
// (manually enter quantities)

// 4. Run tier test
ThreeDayDebug.tests.pricing.testTiers()

// 5. Expected output:
// ✓ Tier 4 (144+): $29.99/unit ✓

// 6. Export logs
ThreeDayDebug.console.export()
```

### Example 2: Debugging Cache Issues

```javascript
// Scenario: Cache not expiring after 5 minutes

// 1. Inspect current state
ThreeDayDebug.state.inspect()
// Note: inventoryCache.Forest.timestamp

// 2. Enable inventory logs
ThreeDayDebug.console.filter('inventory')

// 3. Wait 6 minutes

// 4. Select Forest again
// Expected: "Cache miss for Forest"
// Actual: "Cache hit for Forest (age: 6m)" ⚠️ BUG

// 5. Check cache logic in console
const cacheAge = Date.now() - window.state.inventoryCache['Forest'].timestamp
console.log('Cache age (ms):', cacheAge)
console.log('Cache TTL (ms):', 5 * 60 * 1000)
console.log('Should refresh:', cacheAge > (5 * 60 * 1000))

// 6. Export logs for bug report
ThreeDayDebug.console.export()
```

### Example 3: Performance Regression Testing

```javascript
// Scenario: After code changes, test performance

// 1. Clear previous performance data
ThreeDayDebug.performance.clear()

// 2. Start profiling
ThreeDayDebug.performance.start()

// 3. Run complete user flow
// - Load page
// - Select 5 colors
// - Change 25 size quantities
// - View order summary

// 4. Stop profiling
ThreeDayDebug.performance.stop()

// 5. Compare to baseline (target metrics)
ThreeDayDebug.performance.summary()

// Expected:
// - API calls: < 20
// - Average response: < 300ms
// - Cache hit rate: > 70%
// - Render average: < 50ms
// - Memory used: < 20 MB

// 6. If metrics exceed targets:
ThreeDayDebug.performance.api()  // Find slow API calls
ThreeDayDebug.performance.render()  // Find slow renders
```

---

## 📚 Additional Resources

### Related Documentation
- **[Code Organization](CODE-ORGANIZATION.md)** - Understand code structure
- **[API Patterns](API-PATTERNS.md)** - API integration details
- **[Implementation Timeline](IMPLEMENTATION-TIMELINE.md)** - Development history

### Console Shortcuts

```javascript
// Quick access aliases
const debug = ThreeDayDebug
const log = ThreeDayDebug.console
const state = ThreeDayDebug.state
const tests = ThreeDayDebug.tests
const perf = ThreeDayDebug.performance

// Usage:
debug.help()
log.filter('pricing')
state.inspect()
tests.runAll()
perf.summary()
```

---

**Documentation Type:** Debugging Guide
**Parent Document:** [3-DAY-TEES-PROJECT-REQUIREMENTS.md](../../3-DAY-TEES-PROJECT-REQUIREMENTS.md)
**Related Docs:** All files in [/memory/3-day-tees/](.)
