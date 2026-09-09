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

## Final training family

`css-unification-training-final.spec.js` covers the Training Center, tax-code trainer and both customer-setup simulators at four widths, with keyboard/axe, live-list failures/retry, score/restart behavior, timers and unavailable/malformed saved progress. Every service/write is mocked. `training-final-content.test.js` keeps the original lesson literals, prose, fields/options and navigation, with the retired training-hub destination explicitly replaced by Training Center. Run with `npm run test:css`; the content lock is part of `npm run test:unit`.

- `tests/e2e/css-unification-api-reference.spec.js` — four reference pages at four widths, search/empty/escaping, ODBC disclosure/stored-only/load retry, paper content/state and unchanged real authentication gates; business calls mocked.
- `tests/unit/api-reference-content.test.js` + `tests/fixtures/api-reference-original-content.json` — original technical prose, fields/options, links, reference literals and ODBC schema bytes.

- `tests/e2e/css-unification-policy-reference.spec.js` — policy migration filters/retry/empty, guide contents/history/top, notices and all four paper layouts; calls are mocked.
- `tests/unit/policy-reference-content.test.js` + `tests/fixtures/policy-reference-original-content.json` — original policy prose/figures, routes/IDs/fields and migration snapshot.

- `tests/e2e/css-unification-policy-cms.spec.js` — unified policy CMS, mocked reads/writes, responsive controls, role and paper checks; original locks in `tests/unit/policy-cms-content.test.js`.

- Public webstore family: `css-unification-webstore.spec.js` exercises every migrated marketing page at four widths and on paper, with business-service writes blocked; `webstore-content.test.js` preserves the original copy, SEO structured data and links.

- `tests/e2e/css-unification-brand-guides.spec.js`, `tests/unit/brand-guide-content.test.js`, `tests/fixtures/brand-guide-original-content.json`: all fifteen brand guides; preserved copy/SEO/products/links/search fields, native mobile menu/focus, four widths/axe and complete paper.

- Staff references: `tests/unit/staff-reference-content.test.js` and `tests/e2e/css-unification-staff-reference.spec.js` cover original source data, all five layouts and mocked service/print states; all business writes are blocked.

- Entry/status: `tests/unit/entry-status-content.test.js` and `tests/e2e/css-unification-entry-status.spec.js` preserve original content, all three fulfillment controller hashes, sign-in validation/privacy/error/retry and confirmation status/paper. Shared field styling replaces legacy CSS selector locks in customer-login-page.test.js; real browser assertions cover focus/invalid styling.

- `tests/unit/catalog-discovery-content.test.js`, `tests/e2e/css-unification-catalog-discovery.spec.js`, `tests/fixtures/catalog-discovery-original-content.json` — original catalog copy/curation, named brand links, four widths/native menus, actual server label passthrough, failure/malformed/retry/filters/broken images and populated paper.

- Campaign storefront: css-unification-campaign-storefront.spec.js covers three pages at four widths, contrast, photo/gallery/filters, complete paper and synthetic delivery/config failure states; all actual writes/email blocked. campaign-storefront-content.test.js and the original-content fixture preserve full prose, fields, links, structured data and financial helpers/services. Only explicitly reviewed init/config/delivery functions differ.

- Instant storefront browser review uses captured server prices and mocks every quote/artwork write. Original content/controller contracts remain locked by instant-storefront-content.test.js.

Customer intake: public request-a-quote and three hosted staff forms use canonical tokens/components/Public Sans with one scoped customer-intake.css owner; public fields retain their own arrangement. Digitizing follows Ruth purple, monogram follows shop-floor blue, purchasing follows Bradley slate. Four old CSS owners retired after their final consumers migrated. Seven existing controller sources remain unchanged; complete original prose/fields/images/vendor URLs locked.14 focused browser cases,11 original-contract checks, four widths/zero axe, navigation, blocked embeds and keyboard fallback, public validation/prefill/calendar/lookup/upload/save failures and retained draft retry checked with all business writes and hosted content mocked. Four one-page reference PDFs retain74 checked text nodes; vendor form contents stay external and are not printed from the wrapper. Raw CSS graph grows with shared primitives/scoping; no network byte-reduction claim. Full release gates remain.

SanMar vendor portal wrappers: three pages use canonical navigation/typography/Bradley purchasing accents and one scoped sanmar-portal-shared.css owner; the duplicate sanmar-vendor-portal.css is retired. Original invoice/credit Caspio app URLs and wrapper content remain unchanged.12 focused browser cases cover four widths, zero wrapper axe, native focus/keyboard scrolling, mocked login/empty/failure states and complete synthetic report printing; three landscape PDFs retain216 checked nodes. All provider writes blocked. Provider-owned UI styling/data remains explicitly separate; the runtime census now recognizes Jotform alongside Caspio and the external-owner backlog names all six reviewed hosted wrappers. Full release gates remain; no raw-CSS byte reduction claim.

Hosted staff tools: five Caspio page wrappers (SanMar vendor/invoices/credits, announcement create/manage) share shared_components/css/hosted-workspace.css with canonical tokens/components. Vendor-local and two announcement sheets retired; the earlier duplicate sanmar-vendor-portal.css is also retired. Bradley purchasing and neutral administrative colors follow the ownership rules. Exact provider IDs and both announcement controller sources retained.20 focused browser cases cover four widths/zero wrapper axe, native skip/navigation/scrolling, loading/failure/fallback and synthetic login/form/report/empty boundaries; five landscape reference PDFs retain258 text nodes, every page visually reviewed. Provider-owned controls and data remain separate unfinished work. Seven original source contracts passed; broader inventory guards and full release gates remain. Raw CSS graph grows with scoped shared primitives; no network-byte reduction claim.

Staff access and portal tools: dashboards/access-admin.html, dashboards/drive-access.html and dashboards/portal-directory.html share canonical tokens/components and shared_components/css/staff-admin-tools.css. Their three obsolete local CSS owners are retired. Neutral admin/drive and CRM ink preserved.15 focused browser cases cover four widths/zero axe, keyboard views, mocked permissions/save failure/retry/removal confirmation, separate drive rights, denied/malformed data, portal counts/search/sort/clipboard fallback and distinct staff-preview/customer URLs. Three reference PDFs/four pages preserve65 checked text/value nodes, including long wrapping permissions; all visually reviewed. Current-value print mirrors are removed after printing and never change editable data. Original controller hashes restored by reversing only explicit presentation mappings.29 source/hygiene unit checks and290-file CSS lint pass. No actual permission or clipboard writes, business actions or messages. Shared raw CSS graph grows; no byte-reduction claim.

Staff monitoring: API Usage,Table Usage Audit and Bandit Integration share tokens/components/Public Sans and shared_components/css/staff-monitoring.css. Their three local sheets are retired. Native keyboard sorting/filtering, named scrolling tables and current-value print mirrors preserve the original163-table evidence and full reference prose. Usage failures stay unknown; malformed/incomplete live schema cannot label tables gone. Local storage failures stay visible with export available, and successful recovery clears the related error.17 mocked browser cases cover all four widths/zero axe, numeric/source states, retry, saved notes and CSV export. Three reference PDFs/nine pages retain213 checked text/value nodes, all visually inspected. Print uses normal block flow so a flex fragment cannot produce a blank trailing sheet; focus outlines remain screen-only. All real business writes and notifications blocked. Measured LF raw CSS per page is70,169bytes, down from162,994–164,472bytes (about57%); these are source bytes, not compressed network transfer.

Staff file tools: SanMar Downloads and SanMar → ShopWorks Parts share tokens/components/Public Sans and shared_components/css/staff-import-tools.css; two local sheets retired. Canonical buttons/data tables, native named file input, skip links and focused scrolling regions retain all original prose/IDs/dependencies and source-locked financial/SKU transforms. Malformed FTP listings and missing converter libraries report visible failures with retry/file retention.17 mocked browser cases cover four widths/zero axe, exact synthetic FTP download query/bytes, CSV/TSV/XLSX conversion, errors and recovery. Two one-page portrait PDFs retain70 checked content/data blocks, visually reviewed; print hides only action controls and their empty download column. All real business writes/imports/uploads/emails blocked. A tiny temporary loopback server serves only synthetic CSV because browser-managed attachments bypass page routing; request assertions observe that server and compare actual downloaded bytes.

Purchasing Portal and SanMar Payables reviewed: shared purchasing-workspaces.css and opt-in vendor-invoice.css use canonical tokens, controls, data tables, named file input and native invoice dialog. Bradley slate and existing payables ownership retained. Two old page sheets retired across production/harness HTML; AE keeps its legacy invoice CSS with the same updated controller version.24 mocked browser cases cover four widths/zero axe, keyboard/focus, source filters, exact CSV values, mock-only import confirmation/cancellation/failure, visible unknown balances and optional feed recovery, concurrent lookup protection and legacy AE compatibility. Four one-page PDFs preserve176 checked reading/data/current-field blocks; invoice columns, totals and failed PO notes verified together. Original five controller/helper hashes reverse through50 documented UI/load-validation edits; money/CSV calculations unchanged. The AE page and other generated-document families receive no review credit.

Reviewed photo family: shared_components/css/photo-workspaces.css owns capture/library arrangements across dashboards/finished-photos.html, dashboards/finished-photos-library.html and tests/ui/test-finished-photos-library.html. Two old photo sheets retired.22 mocked browser checks cover four widths/zero axe, native camera/album fields, exact synthetic JPEG resizing/upload metadata, customer/rep filters, errors remaining visible through filtering, publish/delete confirmation failures and delayed customer/image responses.28 printed content blocks retained across three pages/two PDFs.46 explicit controller edits reverse to eight original controller/helper hashes; image compression, URL resolution and API payload structure preserved. The library graph falls from164,116 to68587LFbytes; capture grows from34,293 to the same shared graph because it now loads canonical components. This is a maintenance/consistency gain on capture, not a per-page byte reduction. Caspio design pages remain original and unreviewed.

Design-library review in progress: tests/fixtures/design-library-review-data.json, tests/fixtures/design-library-original-content.json, tests/e2e/css-unification-design-libraries.spec.js, tests/unit/design-library-content.test.js cover synthetic nested Caspio forms/results, mobile provider precedence, search errors, pricing, clipboard dialogs, paper content and original source preservation. No production records are included.

Reviewed design libraries: dashboards/digitized-designs.html and dashboards/old-designs.html load tokens/components/design-libraries.css plus the explicitly inventoried design-library-provider.css. The helper shared_components/js/design-library-ui.js preserves provider field names and submit handlers, adapts nested mobile form/results and hides only cloned source definitions. Neutral reference/amber archive retained. Fifteen focused browser cases cover four widths, zero fixture axe violations, complete five-tier AL and full-back prices, visible reference fallback, dialogs/keyboard, exact clipboard values, failed/empty/recovered search and replacement forms. Two PDFs/three pages retain39visible text/current-filter blocks. Six suites/220source/CSS checks and286CSSfiles clean.31recorded controller UI edits reverse to six original hashes. Actual read-only Caspio queries returned24records per page without business writes; private actual data is not in Git. Two old sheets retire275flags;77exact provider exceptions remain, ordinary app owner zero. Both CSS graphs74123LFbytes versus34,811/61,697: consistency/maintenance gain with larger payloads, not a byte-reduction claim. Original hidden/focus/typed-button tests now follow shared owners and always-visible actions. Initial strict-locator, incomplete mock select tags and print-context exception matching errors were corrected.
