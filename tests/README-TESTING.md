# Screen Print Calculator Testing System

## 📋 Overview

This automated testing system validates all screen print calculators (automated, manual, and quote builder) to ensure:
- ✅ Pricing accuracy across all scenarios
- ✅ Toggle functionality (safety stripes, dark garment)
- ✅ Cross-calculator consistency
- ✅ All features work correctly

## 🚀 Quick Start

### Method 1: Visual Test Runner (Recommended)

1. **Open the test runner:**
   ```
   /tests/screenprint-test-runner.html
   ```

2. **Click "Run All Tests"**

3. **Review results:**
   - Summary cards show pass/fail statistics
   - Detailed results for each test
   - Suggested fixes for any failures

### Method 2: Console Testing

1. **Open any calculator page**

2. **Load test files in console:**
   ```javascript
   // Load test suite
   const script1 = document.createElement('script');
   script1.src = '/tests/screenprint-calculator-test-suite.js';
   document.head.appendChild(script1);

   // Load test cases
   const script2 = document.createElement('script');
   script2.src = '/tests/screenprint-test-cases.js';
   document.head.appendChild(script2);
   ```

3. **Run tests:**
   ```javascript
   const suite = new ScreenPrintTestSuite();
   ScreenPrintTestCases.forEach(test => suite.addTest(test));
   const report = await suite.runAllTests();
   suite.printReport(report);
   ```

## 📊 Test Categories

### 1. Basic Pricing (3 tests)
- Validates fundamental pricing calculations
- Tests different quantity tiers
- Verifies setup fees

### 2. Safety Stripes (4 tests)
- **Test:** $2.00 surcharge applied correctly
- **Test:** Works with dark garment
- **Test:** Works on additional locations
- **Test:** Multiple locations ($2 × number of locations)

### 3. Dark Garment (2 tests)
- **Test:** Adds underbase (color count +1)
- **Test:** No underbase when no colors selected
- **Test:** Setup fee reflects extra color

### 4. LTM Fee (2 tests)
- **Test:** $50 fee at minimum tier (24-36 qty)
- **Test:** No fee above minimum

### 5. Additional Locations (2 tests)
- **Test:** Back location pricing
- **Test:** Multiple additional locations
- **Test:** Setup fees for each location

### 6. Color Count (2 tests)
- **Test:** 1 color minimum
- **Test:** 6 colors maximum
- **Test:** Setup fee scales correctly

### 7. Complex Scenarios (2 tests)
- **Test:** All features combined
- **Test:** Edge cases (min qty + max colors)

## 🔍 What Gets Tested

### For Each Test Case:
1. **Input Configuration**
   - Quantity
   - Color count
   - Dark garment toggle
   - Safety stripes toggle
   - Additional locations

2. **Price Calculations**
   - Base price
   - Safety stripes surcharge
   - Setup fees
   - LTM fees
   - Total per-shirt cost

3. **Cross-Calculator Validation**
   - Automated vs Manual comparison
   - Ensures same inputs = same outputs
   - 1% tolerance for rounding differences

## 🛠️ Auto-Fix System

The test suite can **detect issues and suggest fixes**:

### Example Issues Detected:
1. **Safety stripes not applied**
   - Shows exact file and line number
   - Provides corrected code
   - Explains the problem

2. **Dark garment underbase missing**
   - Identifies calculation error
   - Shows proper formula
   - Points to specific code location

3. **Cross-calculator mismatch**
   - Highlights differences
   - Suggests reconciliation approach

## 📈 Test Results

### Summary Metrics:
- **Total Tests:** 17 comprehensive test cases
- **Pass Rate:** Displayed as percentage
- **Failed Tests:** Detailed breakdown
- **Suggested Fixes:** Automatic generation

### Result Details:
Each test shows:
- ✅ or ❌ Pass/Fail status
- Test category
- Timestamp
- Expected vs Actual values
- Error messages if failed
- Pricing breakdown

## 🎯 Running Specific Tests

### Filter by Category:
```javascript
const suite = new ScreenPrintTestSuite();

// Load only safety stripes tests
ScreenPrintTestCases
    .filter(t => t.category === 'safety-stripes')
    .forEach(test => suite.addTest(test));

const report = await suite.runAllTests();
```

### Filter by Calculator:
```javascript
// Test only manual calculator
ScreenPrintTestCases.forEach(test => {
    test.calculator = 'manual';
    suite.addTest(test);
});
```

## 💾 Exporting Results

### JSON Export:
```javascript
const json = suite.exportReport(report);
console.log(json);
// Or save to file via UI button
```

### HTML Export:
- Click "Export HTML" in test runner
- Saves complete test report as HTML file
- Includes all results, fixes, and styling

## 🔧 Adding New Tests

### Test Case Template:
```javascript
{
    id: 'your-test-id',
    name: 'Descriptive Test Name',
    category: 'test-category',
    calculator: 'all', // or 'automated', 'manual'
    inputs: {
        quantity: 48,
        colors: 3,
        darkGarment: false,
        safetyStripes: false,
        additionalLocations: [],
        baseCost: 3.53 // For manual mode
    },
    expected: {
        // What you expect to happen
        price: 11.00,
        safetyStripeSurcharge: 2.00
    },
    validate: (actual, expected) => {
        // Your validation logic
        if (actual.price !== expected.price) {
            return {
                passed: false,
                error: `Expected ${expected.price}, got ${actual.price}`
            };
        }
        return { passed: true };
    }
}
```

Add to `/tests/screenprint-test-cases.js`

## 🐛 Troubleshooting

### Issue: Tests not finding calculators
**Solution:**
- Ensure calculator page is loaded
- Check for `window.screenPrintCalculator` or `window.screenPrintManualCalculator`
- Verify calculator initialization completed

### Issue: Cross-calculator mismatch
**Solution:**
- Check if both calculators use same API data
- Verify margin denominators match
- Review rounding methods

### Issue: All tests failing
**Solution:**
- Check console for JavaScript errors
- Verify test files loaded correctly
- Ensure calculator JavaScript is not minified

## 📝 Test Coverage

### Current Coverage:
- ✅ Basic pricing calculations
- ✅ Safety stripes functionality
- ✅ Dark garment underbase
- ✅ LTM fee application
- ✅ Additional locations
- ✅ Color count variations
- ✅ Complex multi-feature scenarios
- ✅ Cross-calculator consistency

### Future Enhancements:
- [ ] Quote builder integration
- [ ] Performance benchmarking
- [ ] Automated regression testing
- [ ] CI/CD pipeline integration

## 🎬 Demo Walkthrough

### Step-by-Step:

1. **Open Test Runner**
   - Navigate to `/tests/screenprint-test-runner.html`
   - See clean interface with green NWCA branding

2. **Run Tests**
   - Click "Run All Tests" button
   - Watch loading spinner
   - See results populate in real-time

3. **Review Summary**
   - Check pass/fail counts
   - View pass rate percentage
   - Identify categories with issues

4. **Examine Failed Tests**
   - Click "Failed" filter tab
   - Read error messages
   - Review expected vs actual values

5. **Apply Fixes**
   - Scroll to "Suggested Fixes" section
   - Copy provided code
   - Apply to specified files
   - Re-run tests to verify

6. **Export Results**
   - Click "Export JSON" for data
   - Click "Export HTML" for report
   - Share with team or save for records

## 🏆 Best Practices

1. **Run tests after ANY calculator changes**
2. **Add test cases for new features**
3. **Keep test cases up to date with business rules**
4. **Document any expected failures**
5. **Use tests as regression suite**

## 📞 Support

For questions or issues with the testing system:
- Check console logs for detailed errors
- Review test case definitions
- Ensure all dependencies loaded
- Contact development team

---

**Created:** 2025-10-03
**Last Updated:** 2025-10-03
**Version:** 1.0.0
