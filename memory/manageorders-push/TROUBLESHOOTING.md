# Troubleshooting Guide - ManageOrders PUSH API

**Version:** 2.0.1
**Last Updated:** October 29, 2025
**Part of:** ManageOrders PUSH API Documentation
**Parent Document:** [Field Reference Core](FIELD_REFERENCE_CORE.md)

---

## 📋 Navigation

**< Back to [Field Reference Core](FIELD_REFERENCE_CORE.md)**

**Related Documentation:**
- [Implementation Examples](IMPLEMENTATION_EXAMPLES.md) - Working code examples
- [Order & Customer Fields](ORDER_FIELDS.md) - Field specifications
- [Product Fields](PRODUCT_FIELDS.md) - Line item specifications
- [Form Development Guide](FORM_DEVELOPMENT_GUIDE.md) - Building custom forms

---

## Overview

This guide helps diagnose and resolve common issues when working with the ManageOrders PUSH API. Issues are organized by symptom with clear causes and solutions.

---

## Fields Not Appearing in ShopWorks

### Problem: Fields show in console but not in ShopWorks invoice

**Possible Causes:**

#### 1. Hourly Import Delay

**Symptoms:**
- Order created successfully via API
- Order visible in ManageOrders
- Fields not showing in OnSite

**Cause:** ManageOrders receives orders immediately, but OnSite imports from ManageOrders **every hour**

**Solution:**
- Wait for next hourly import (top of the hour)
- Check OnSite after import completes
- Some fields may require additional processing time

**Timeline:**
- API → ManageOrders: Immediate (seconds)
- ManageOrders → OnSite: Up to 1 hour
- Total delay: 0-60 minutes depending on when order submitted

---

#### 2. Field Mapping Configuration

**Symptoms:**
- Fields not displaying on invoices
- Fields visible in raw data but not in UI

**Cause:**
- Fields need to be enabled in ShopWorks OnSite settings
- Invoice templates may not display certain fields

**Solution:**
1. Log into ShopWorks OnSite 7
2. Go to Settings → Field Configuration
3. Enable desired fields for display
4. Update invoice templates to show fields
5. Contact ShopWorks support for template customization

---

#### 3. Field Name Spelling Discrepancy

**Symptoms:**
- Sales rep not populating
- Field appears empty despite being sent

**Cause:**
- Swagger documentation shows `CustomerSeviceRep` (typo - missing 'r')
- Proxy sends correctly spelled `CustomerServiceRep`
- ShopWorks may expect one spelling or the other

**Solution:**
Test with both spellings if issues persist:

```javascript
// Current implementation (correct spelling)
salesRep: "erik@nwcustomapparel.com"
// Proxy sends: CustomerServiceRep

// If issues, try reporting to ShopWorks support
```

**Note:** This is a known documentation issue in ShopWorks Swagger spec

---

#### 4. Invalid Field Values

**Symptoms:**
- Field shows blank or default value
- Warning messages in ShopWorks logs

**Cause:**
- Sales rep doesn't exist in ShopWorks system
- Terms don't match valid ShopWorks payment terms
- Ship method doesn't match configured methods

**Solution:**

**Sales Rep:**
```javascript
// ❌ WRONG - Rep doesn't exist
salesRep: "unknown@nwcustomapparel.com"

// ✅ CORRECT - Use existing rep
salesRep: "erik@nwcustomapparel.com"
```

**Terms:**
```javascript
// ❌ WRONG - Invalid term
terms: "Pay When You Want"

// ✅ CORRECT - Valid OnSite terms
terms: "FREE SAMPLE"
terms: "Net 30"
terms: "PREPAID - Credit Card"
```

**Ship Method:**
```javascript
// ❌ WRONG - Method doesn't exist
method: "Teleportation"

// ✅ CORRECT - Valid methods
method: "UPS Ground"
method: "USPS Priority"
method: "Freight"
```

**Verification:** Check ShopWorks OnSite for list of valid values in dropdown menus

---

### Problem: Colors not appearing

**Symptoms:**
- Product shows in order but color is blank
- Color shows as "Unknown" or generic value

**Cause:** Using display color name instead of exact ShopWorks catalog color

**Solution:**

```javascript
// ❌ WRONG - Display name from vendor
color: "Forest Green"  // Vendor calls it this
color: "Forrest Green" // Typo
color: "Dark Green"    // Close but not exact

// ✅ CORRECT - Exact ShopWorks catalog name
color: "Forest"  // Exactly as it appears in OnSite catalog
```

**How to Find Correct Color:**
1. Look up product in ShopWorks OnSite catalog
2. Note exact spelling of color name
3. Use that exact string (case-sensitive)

**Common Pitfalls:**
- Extra words ("Green" vs "Forest Green")
- Typos ("Forrest" vs "Forest")
- Different capitalization
- Punctuation differences

**See Also:** [Product Fields - CATALOG_COLOR](PRODUCT_FIELDS.md#line-item-fields)

---

### Problem: Size not translated correctly

**Symptoms:**
- Size shows as raw value (e.g., "L" instead of "Large")
- Size doesn't match OnSite format
- Inventory not decrementing

**Cause:** Sending web size directly instead of letting proxy translate

**Solution:**

```javascript
// ✅ CORRECT - Let proxy translate
size: "S"     // Proxy translates to Size01
size: "M"     // Proxy translates to Size02
size: "L"     // Proxy translates to Size03
size: "XL"    // Proxy translates to Size04
size: "2XL"   // Proxy translates to Size05
size: "3XL"   // Proxy translates to Size06
size: "OSFA"  // Proxy translates to Other XXXL

// ❌ WRONG - Don't manually translate
size: "Size03"       // May cause issues
size: "Large"        // Wrong format
size: "L (Size03)"   // Extra text causes problems
```

**How It Works:**
1. You send: `size: "L"`
2. Proxy translates: `"L"` → `"Size03"`
3. OnSite receives: `Size03` (correct format)
4. Inventory decrements properly ✅

**Size Translation Table:**

| Web Size | OnSite Column | Notes |
|----------|---------------|-------|
| S | Size01 | Standard |
| M | Size02 | Standard |
| L | Size03 | Standard |
| XL | Size04 | Standard |
| 2XL | Size05 | Often upcharge |
| 3XL | Size06 | Often upcharge |
| 4XL | Size07 | Often upcharge |
| OSFA | Other XXXL | One Size Fits All |

---

## API Errors

### 400 Bad Request

**Symptoms:**
- API returns 400 status code
- Error message in response

**Common Causes:**

1. **Missing Required Field:**
```javascript
// ❌ Missing orderNumber
const order = {
  // orderNumber: "SAMPLE-1027",  // Forgot this!
  customer: { /* ... */ },
  // ...
};

// ✅ Include all required fields
const order = {
  orderNumber: "SAMPLE-1027",  // Required
  customer: { /* ... */ },      // Required
  shipping: { /* ... */ },      // Required
  lineItems: [ /* ... */ ]      // Required (non-empty)
};
```

2. **Invalid Data Type:**
```javascript
// ❌ WRONG - quantity is string, should be number
quantity: "12"

// ✅ CORRECT - quantity is number
quantity: 12
```

3. **Invalid Date Format:**
```javascript
// ❌ WRONG - Wrong format
orderDate: "10/27/2025"  // MM/DD/YYYY
orderDate: "27-10-2025"  // DD-MM-YYYY

// ✅ CORRECT - YYYY-MM-DD format
orderDate: "2025-10-27"  // Proxy auto-converts to MM/DD/YYYY
```

4. **Empty Line Items:**
```javascript
// ❌ WRONG - Empty array
lineItems: []

// ✅ CORRECT - At least one item
lineItems: [{
  partNumber: "PC54",
  description: "Tee",
  color: "Navy",
  size: "L",
  quantity: 1,
  price: 10.00
}]
```

**Solution:** Check console logs for specific error message describing which field is invalid

---

### 401 Unauthorized

**Symptoms:**
- API returns 401 status code
- "Unauthorized" or "Authentication failed" message

**Cause:** ManageOrders API authentication failed

**Possible Issues:**
1. Proxy server not running
2. ManageOrders credentials not configured
3. Credentials expired or invalid

**Solution:**

1. **Check Proxy Status:**
```bash
curl https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/push/health
```

2. **Verify Credentials:**
- Check Heroku config vars
- Ensure `MANAGEORDERS_USERNAME` and `MANAGEORDERS_PASSWORD` are set
- Test credentials with ShopWorks support

3. **Check Proxy Logs:**
```bash
heroku logs --tail --app caspio-pricing-proxy
```

---

### 500 Internal Server Error

**Symptoms:**
- API returns 500 status code
- Generic "Internal Server Error" message

**Cause:** Server-side error in ManageOrders API or proxy

**Solution:**

1. **Check ManageOrders API Status:**
- Contact ShopWorks support
- Check for known outages
- Verify API endpoint is accessible

2. **Review Proxy Logs:**
```bash
heroku logs --tail --app caspio-pricing-proxy | grep ERROR
```

3. **Check for Data Issues:**
- Extremely long field values
- Special characters causing parsing errors
- Nested data structures not properly formatted

4. **Retry with Minimal Data:**
- Strip order down to required fields only
- If minimal order works, add fields back one at a time
- Identify problematic field

5. **Contact Support:**
- Provide full error details
- Include order data (sanitized)
- Include proxy logs
- Contact: erik@nwcustomapparel.com

---

## Testing Checklist

### Before Going Live

**API Testing:**
- [ ] Test with `isTest: true` flag
- [ ] Verify order appears in ManageOrders
- [ ] Check order imports to OnSite after hourly import
- [ ] Verify all expected fields populate

**Product Testing:**
- [ ] Test with various product types (tees, polos, caps)
- [ ] Test with different colors (verify CATALOG_COLOR)
- [ ] Test with all standard sizes (S through 3XL)
- [ ] Test with special sizes (OSFA, youth sizes)

**Address Testing:**
- [ ] Test with different shipping addresses
- [ ] Test with address line 2 (apartment/suite)
- [ ] Test with various states
- [ ] Test with international addresses (if applicable)

**Order Complexity Testing:**
- [ ] Test with single line item
- [ ] Test with multiple line items (2-5 items)
- [ ] Test with large orders (10+ items)
- [ ] Test with mixed product types

**Data Validation:**
- [ ] Verify color mapping works (display → catalog)
- [ ] Verify size translation works (web → OnSite)
- [ ] Check notes appear correctly
- [ ] Verify line breaks in notes

---

### After Going Live

**Monitor First Orders:**
- [ ] Monitor first 10 orders closely
- [ ] Verify fields consistency across orders
- [ ] Check production can read orders correctly

**Production Workflow:**
- [ ] Confirm shipping labels generate properly
- [ ] Verify customer info is accessible
- [ ] Check inventory decrements correctly

**Customer Experience:**
- [ ] Verify order confirmation emails
- [ ] Check customer portal shows orders
- [ ] Test order tracking if available

**Reporting:**
- [ ] Check orders appear in reports
- [ ] Verify data exports work
- [ ] Test any custom integrations

---

## Debug Commands

### Check Order Status

```bash
# Check if order exists in ManageOrders
curl "https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/orders/verify/NWCA-SAMPLE-1027-1"
```

### View Proxy Logs

```bash
# View recent logs
heroku logs --tail --app caspio-pricing-proxy

# Search for specific order
heroku logs --app caspio-pricing-proxy | grep "SAMPLE-1027-1"

# Filter errors only
heroku logs --app caspio-pricing-proxy | grep ERROR
```

### Test API Connectivity

```bash
# Health check
curl https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/push/health

# Test authentication
curl -X POST https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/manageorders/auth/test
```

---

## Common Error Messages

### "Order number already exists"

**Cause:** Duplicate order number
**Solution:** Each order must have unique `orderNumber`. Add timestamp or increment counter.

```javascript
// Add timestamp to ensure uniqueness
orderNumber: `SAMPLE-${Date.now()}`
```

---

### "Invalid customer ID"

**Cause:** Customer #2791 doesn't exist in your ShopWorks system
**Solution:** Contact ShopWorks support to create or verify customer ID

---

### "Color not found in catalog"

**Cause:** Using display color instead of catalog color
**Solution:** See [Colors not appearing](#problem-colors-not-appearing) above

---

### "Size column not recognized"

**Cause:** Manually translating sizes instead of letting proxy handle it
**Solution:** Send web sizes (`"L"`), let proxy translate to OnSite format

---

### "Duplicate sales tax line items"

**Symptoms:**
- Two identical tax line items appear in OnSite invoice
- Both show same tax amount (e.g., two `Tax_10.1` entries for $34.54)
- Total is correct but tax appears twice in line item list

**Cause:** Tax being sent in BOTH locations:
1. As a line item in `LinesOE` array (`PartNumber: "Tax_10.1"`)
2. As Payment block fields (`TaxTotal`, `TaxPartNumber`, `TaxPartDescription`)

ShopWorks OnSite creates a tax line item from EACH source, resulting in duplicates.

**Solution:** Use Payment block approach only (recommended):

```javascript
// ❌ WRONG - Tax in both places causes duplicates
const lineItems = [
    { partNumber: 'PC54', quantity: 10, price: 38.00 },
    { partNumber: 'Tax_10.1', quantity: 1, price: 34.54 }  // DON'T DO THIS
];

const order = {
    lineItems: lineItems,
    taxTotal: 34.54,              // This ALSO creates a tax line
    taxPartNumber: 'Tax_10.1',
    taxPartDescription: 'City of Milton Sales Tax 10.1%'
};

// ✅ CORRECT - Tax via Payment block only
const lineItems = [
    { partNumber: 'PC54', quantity: 10, price: 38.00 }
    // No tax line item here
];

const order = {
    lineItems: lineItems,
    taxTotal: 34.54,              // ShopWorks auto-creates tax line from this
    taxPartNumber: 'Tax_10.1',
    taxPartDescription: 'City of Milton Sales Tax 10.1%'
};
```

**Reference:** See [Payment Block - TaxTotal field](PAYMENT_SHIPPING_FIELDS.md#payment-subblock) for complete documentation.

**Fixed in:**
- `sample-order-service.js` (October 31, 2025) - Removed tax line item from LinesOE
- `caspio-pricing-proxy/lib/manageorders-push-client.js` (October 31, 2025) - Added TaxPartNumber and TaxPartDescription field mapping

---

## Getting Help

**For API Issues:**
- Email: erik@nwcustomapparel.com
- Include: Order data, error message, proxy logs

**For ShopWorks Issues:**
- Contact: ShopWorks Support
- Provide: Order number, field name, expected vs actual value

**For Urgent Production Issues:**
- Phone: 253-922-5793
- Hours: Monday-Friday 8:30 AM - 5:00 PM PST

---

## Related Documentation

**Implementation Guides:**
- [Implementation Examples](IMPLEMENTATION_EXAMPLES.md) - Working code examples
- [Form Development Guide](FORM_DEVELOPMENT_GUIDE.md) - Building custom forms
- [Enhancement Roadmap](ENHANCEMENT_ROADMAP.md) - Future improvements

**Field Specifications:**
- [Order & Customer Fields](ORDER_FIELDS.md) - Order-level fields
- [Product Fields](PRODUCT_FIELDS.md) - Line item fields
- [Payment & Shipping Fields](PAYMENT_SHIPPING_FIELDS.md) - Payment and shipping fields

**Parent Documentation:**
- [Field Reference Core](FIELD_REFERENCE_CORE.md) - Complete field reference
- [MANAGEORDERS_PUSH_WEBSTORE.md](../MANAGEORDERS_PUSH_WEBSTORE.md) - PUSH API overview

---

**Version:** 2.0.1
**Last Updated:** October 29, 2025
**Maintained By:** Erik & Claude AI
**Questions:** Contact erik@nwcustomapparel.com
