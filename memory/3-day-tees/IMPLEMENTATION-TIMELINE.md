# 3-Day Tees - Implementation Timeline

**Last Updated:** 2025-11-08
**Purpose:** 4-day accelerated development plan with daily task breakdowns, testing procedures, and deployment checklist
**Status:** Ready for Implementation

---

## 📋 Quick Navigation

**Related Documentation:**
- **[Main PRD](../../3-DAY-TEES-PROJECT-REQUIREMENTS.md)** - Executive summary
- **[Overview](OVERVIEW.md)** - Architecture and reusable components
- **[Pricing Formula](PRICING-FORMULA.md)** - Pricing calculations
- **[Inventory Integration](INVENTORY-INTEGRATION.md)** - Multi-SKU patterns
- **[API Patterns](API-PATTERNS.md)** - Complete API reference
- **[Business Logic](BUSINESS-LOGIC.md)** - Terms and fees

---

## 🚀 Overview: 4-Day Accelerated Timeline

**Why Only 4 Days?**

75% of required functionality already exists in reusable components. This is primarily **integration work**, not new development from scratch.

**What We're Building:**
- Product page with PC54 (5 colors, 6 sizes)
- Real-time inventory from 3 SKUs
- DTG pricing + 25% rush fee
- Size breakdown with upcharges
- File upload for artwork
- Order submission to ShopWorks

**Total Estimated Hours:** 32 hours (4 days × 8 hours)

---

## Day 1: Page Foundation & Product Display

**Goal:** Functional product page with inventory
**Duration:** 8 hours
**Code Reuse:** 80%

### Morning Session (4 hours)

**Task 1.1: Create Page Structure** (1 hour)
- [ ] Create `/pages/3-day-tees.html` using DTG pricing page template
- [ ] Copy universal header from existing pages
- [ ] Set up two-column layout (product left, calculator right)
- [ ] Add page title and description

**Reference Files:**
- Template: `/calculators/dtg-pricing.html`
- Header: `/shared_components/css/universal-header.css`

**Task 1.2: Create Service File** (1 hour)
- [ ] Create `/shared_components/js/3-day-tees-service.js` from sample-order-service.js
- [ ] Update quote prefix to `3DT`
- [ ] Configure EmailJS template ID
- [ ] Set company contact info

**Reference Files:**
- Template: `/shared_components/js/sample-order-service.js`
- Pattern: Order number generator (`3DT{MMDD}-{sequence}`)

**Task 1.3: Implement Multi-SKU Inventory** (1 hour)
- [ ] Copy `fetchPC54Inventory()` from OVERVIEW.md
- [ ] Use `Promise.all()` to query PC54, PC54_2X, PC54_3X
- [ ] Map size fields correctly (PC54_2X.Size01 = 2XL)
- [ ] Return combined inventory object

**Code Pattern:**
```javascript
async function fetchPC54Inventory(color) {
    const [standard, twoXL, threeXL] = await Promise.all([
        fetch(`/api/manageorders/inventorylevels?PartNumber=PC54&Color=${color}`),
        fetch(`/api/manageorders/inventorylevels?PartNumber=PC54_2X&Color=${color}`),
        fetch(`/api/manageorders/inventorylevels?PartNumber=PC54_3X&Color=${color}`)
    ]);

    return {
        'S': standardData.Size01 || 0,
        'M': standardData.Size02 || 0,
        'L': standardData.Size03 || 0,
        'XL': standardData.Size04 || 0,
        '2XL': twoXLData.Size01 || 0,
        '3XL': threeXLData.Size01 || 0
    };
}
```

**Task 1.4: Color Selector with Inventory** (1 hour)
- [ ] Add color dropdown (Forest, Black, Navy, White, Athletic Heather)
- [ ] Fetch inventory on color selection
- [ ] Display inventory badges (In Stock, Low Stock, Out of Stock)
- [ ] Show total inventory count

**Reference Files:**
- Badge component: `/pages/sample-cart.html` lines 351-500

### Afternoon Session (4 hours)

**Task 1.5: Product Images** (1 hour)
- [ ] Integrate PC54 images from Caspio CDN
- [ ] Set up image gallery (front/back views)
- [ ] Add color swatches
- [ ] Implement lazy loading

**Reference Files:**
- Universal image gallery: `/shared_components/js/universal-image-gallery.js`

**Task 1.6: Navigation Integration** (1 hour)
- [ ] Add "3-Day Tees" button to homepage
- [ ] Create route in server.js
- [ ] Add to main navigation menu
- [ ] Update ACTIVE_FILES.md

**Server Route:**
```javascript
app.get('/pages/3-day-tees.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', '3-day-tees.html'));
});
```

**Task 1.7: Testing** (2 hours)
- [ ] Test page load and initial render
- [ ] Verify all 3 inventory API calls succeed
- [ ] Check inventory badges display correctly
- [ ] Test color switching updates inventory
- [ ] Verify images load for all colors
- [ ] Mobile responsiveness check

**✅ Day 1 Checkpoint:**
- Page loads successfully at `http://localhost:3000/pages/3-day-tees.html`
- Shows PC54 with 5 colors
- Displays exact inventory levels from all 3 SKUs
- Color selector works and updates inventory

**Deliverable:** Working product page with real-time inventory

---

## Day 2: Pricing Engine & Configuration UI

**Goal:** Interactive pricing with location toggles
**Duration:** 8 hours
**Code Reuse:** 75%

### Morning Session (4 hours)

**Task 2.1: Location Toggle UI** (1 hour)
- [ ] Copy location toggle component from `/calculators/dtg-pricing.html` (lines 450-600)
- [ ] Add locations: Left Chest, Full Front, Full Back
- [ ] Style active/inactive states
- [ ] Add multi-select capability

**Reference Pattern:**
```javascript
const locations = [
    { code: 'LC', name: 'Left Chest', active: false },
    { code: 'FF', name: 'Full Front', active: false },
    { code: 'FB', name: 'Full Back', active: false }
];
```

**Task 2.2: Size Breakdown Grid** (1 hour)
- [ ] Copy size selector from `/pages/top-sellers-product.html` (lines 802-826)
- [ ] Add quantity inputs for S, M, L, XL, 2XL, 3XL
- [ ] Implement onChange handlers
- [ ] Calculate total quantity live

**Reference Files:**
- Size sorting: `/pages/sample-cart.html` lines 1151-1176

**Task 2.3: DTG Pricing Service Integration** (1 hour)
- [ ] Import DTGPricingService
- [ ] Fetch pricing bundle for PC54
- [ ] Extract tiers, costs, upcharges
- [ ] Store in component state

**API Call:**
```javascript
const pricingData = await fetch(
    '/api/pricing-bundle?method=DTG&styleNumber=PC54'
);
```

**Task 2.4: 7-Step Pricing Formula** (1 hour)
- [ ] Implement base pricing calculation
- [ ] Add 25% rush fee modifier
- [ ] Apply half-dollar ceiling rounding
- [ ] Calculate per-size pricing

**Reference:** Complete formula in PRICING-FORMULA.md

### Afternoon Session (4 hours)

**Task 2.5: Size Upcharge Display** (1 hour)
- [ ] Show base price (S-XL): $X.XX
- [ ] Show 2XL price: $X.XX (+$2.00)
- [ ] Show 3XL price: $X.XX (+$3.00)
- [ ] Update prices when quantity changes

**Task 2.6: LTM Fee Calculation** (1 hour)
- [ ] Check if total quantity < 12
- [ ] Calculate $75 ÷ quantity if LTM applies
- [ ] Display LTM fee per piece
- [ ] Add warning message

**Pattern:**
```javascript
const LTM_FEE = 75.00;
const ltmPerPiece = quantity < 12 ? LTM_FEE / quantity : 0;

if (ltmPerPiece > 0) {
    showWarning(`Less than minimum fee: $${LTM_FEE.toFixed(2)} ($${ltmPerPiece.toFixed(2)}/piece)`);
}
```

**Task 2.7: Live Pricing Updates** (1 hour)
- [ ] Add onChange handlers to all inputs
- [ ] Debounce rapid changes (300ms)
- [ ] Update price breakdown in real-time
- [ ] Recalculate on location/quantity/size changes

**Task 2.8: Price Breakdown Display** (1 hour)
- [ ] Show base DTG price
- [ ] Show rush fee (25%)
- [ ] Show size upcharges
- [ ] Show LTM fee (if applicable)
- [ ] Show subtotal, tax, shipping
- [ ] Show grand total

**✅ Day 2 Checkpoint:**
- All location toggles functional
- Size selector updates pricing live
- Rush fee applied correctly (25%)
- Upcharges display for 2XL/3XL
- LTM fee shows for < 12 pieces
- Total price matches formula exactly

**Deliverable:** Real-time pricing calculator with 25% rush fee

---

## Day 3: Checkout Flow & File Upload

**Goal:** Complete order form with artwork upload
**Duration:** 8 hours
**Code Reuse:** 85%

### Morning Session (4 hours)

**Task 3.1: Address Form** (1 hour)
- [ ] Copy address component from `/pages/sample-cart.html` (lines 996-1079)
- [ ] Add fields: name, company, email, phone
- [ ] Add shipping address fields
- [ ] Implement "same as billing" toggle

**Required Fields:**
- Customer name (required)
- Email (required, validated)
- Phone (optional, formatted)
- Company (optional)
- Address 1, City, State, ZIP (required for shipping)

**Task 3.2: File Upload UI** (1 hour)
- [ ] Copy file upload component from sample order page
- [ ] Support formats: .ai, .eps, .svg, .pdf, .png, .jpg, .psd
- [ ] Set max file size: 20 MB
- [ ] Allow multiple files (unlimited)
- [ ] Show upload progress

**Reference Files:**
- Upload service: `/shared_components/js/sample-order-service.js` lines 200-250
- API endpoint: `POST /api/files/upload`

**Task 3.3: File Upload Integration** (1 hour)
- [ ] Implement FormData construction
- [ ] Add drag-and-drop support
- [ ] Show file list with remove option
- [ ] Validate file types and sizes
- [ ] Display upload errors

**Upload Pattern:**
```javascript
const formData = new FormData();
formData.append('file', artworkFile);
formData.append('orderNumber', '3DT1108-1');
formData.append('type', 'artwork');

const response = await fetch('/api/files/upload', {
    method: 'POST',
    body: formData
});
```

**Task 3.4: Form Validation** (1 hour)
- [ ] Email format validation
- [ ] Phone number formatting (253-555-1234)
- [ ] Required field checks
- [ ] Show inline error messages
- [ ] Disable submit until valid

**Validation Pattern:**
```javascript
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatPhone(phone) {
    return phone.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
}
```

### Afternoon Session (4 hours)

**Task 3.5: Order Summary** (1 hour)
- [ ] Create summary section
- [ ] List all selected products with sizes
- [ ] Show quantity breakdown by size
- [ ] Display pricing for each line item
- [ ] Add edit buttons to modify selections

**Task 3.6: Sales Tax Calculation** (1 hour)
- [ ] Calculate 10.1% sales tax on subtotal
- [ ] Apply to product total (not shipping)
- [ ] Display tax amount separately
- [ ] Update when prices change

**Tax Formula:**
```javascript
const salesTax = subtotal * 0.101;
const taxRounded = Math.round(salesTax * 100) / 100;
```

**Task 3.7: Shipping Cost** (30 minutes)
- [ ] Add $30 flat rate shipping
- [ ] Display as separate line item
- [ ] Include in grand total
- [ ] Note: UPS Ground standard

**Task 3.8: Terms & Conditions** (30 minutes)
- [ ] Add checkbox for terms acceptance
- [ ] Link to terms page
- [ ] Disable submit until checked
- [ ] Show 3-day turnaround notice

**Task 3.9: Payment Placeholder** (1 hour)
- [ ] Add "Coming Soon - Online Payment" section
- [ ] Show current payment options (check, wire, terms)
- [ ] Add contact info for payment questions
- [ ] Note: Phase 2 will add Stripe

**✅ Day 3 Checkpoint:**
- Complete order form functional
- File upload works (20+ formats)
- Form validation working
- Order summary displays correctly
- Final pricing shows all components (subtotal + tax + shipping)
- Terms checkbox required

**Deliverable:** Checkout page ready for submission

---

## Day 4: Order Submission & Testing

**Goal:** Production-ready integration with ShopWorks
**Duration:** 8 hours
**Code Reuse:** 90%

### Morning Session (4 hours)

**Task 4.1: ManageOrders API Integration** (1 hour)
- [ ] Copy order submission from `/shared_components/js/sample-order-service.js` (lines 75-121)
- [ ] Build line items from size breakdown
- [ ] Use BASE part number "PC54" (never "PC54_2X")
- [ ] Use CATALOG_COLOR for color field
- [ ] Add order notes with rush service details

**Critical Pattern:**
```javascript
const lineItem = {
    partNumber: "PC54",              // ✅ BASE style only
    description: "Port & Company Core Cotton Tee - 3-Day Rush",
    color: product.catalogColor,     // ✅ Use CATALOG_COLOR
    size: size,                      // ✅ Human-readable
    quantity: details.quantity,
    price: details.unitPrice,        // Size-specific (includes rush + upcharge)
    notes: `DTG - ${location} - 3-Day Rush Service (+25%)`
};
```

**Task 4.2: Order Number Generator** (30 minutes)
- [ ] Implement format: `3DT{MMDD}-{sequence}`
- [ ] Use sessionStorage for daily sequence
- [ ] Auto-reset at midnight
- [ ] Clean up old sequences

**Generator Pattern:**
```javascript
function generateOrderNumber() {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${month}${day}`;

    const storageKey = `3dt_sequence_${dateKey}`;
    let sequence = parseInt(sessionStorage.getItem(storageKey) || '0') + 1;
    sessionStorage.setItem(storageKey, sequence.toString());

    return `3DT${dateKey}-${sequence}`;
}
```

**Task 4.3: Success Confirmation** (30 minutes)
- [ ] Copy modal from `/pages/sample-cart.html` (lines 1123-1135)
- [ ] Display order number prominently
- [ ] Show confirmation message
- [ ] Add "View Order Details" button
- [ ] Provide next steps

**Task 4.4: EmailJS Notifications** (1 hour)
- [ ] Send customer confirmation email
- [ ] Send sales team notification
- [ ] BCC erik@nwcustomapparel.com
- [ ] Include order summary with pricing
- [ ] Attach uploaded artwork links

**Email Template Variables:**
```javascript
{
    order_number: '3DT1108-1',
    customer_name: 'John Smith',
    customer_email: 'john@company.com',
    total_amount: '457.19',
    rush_service: '3-Day Turnaround',
    products_table: '<table>...</table>',  // HTML table
    company_phone: '253-922-5793'
}
```

### Afternoon Session (4 hours)

**Task 4.5: Database Fallback** (1 hour)
- [ ] Implement quote_sessions save on API failure
- [ ] Save quote_items for each line item
- [ ] Generate fallback quote ID
- [ ] Show appropriate error message
- [ ] Still send emails even if API fails

**Reference:** Complete fallback pattern in API-PATTERNS.md

**Task 4.6: Loading States** (30 minutes)
- [ ] Add spinner overlay during submission
- [ ] Disable submit button while processing
- [ ] Show progress messages
- [ ] Prevent double-submission

**Task 4.7: Cross-Browser Testing** (1 hour)
- [ ] Test in Chrome (primary)
- [ ] Test in Firefox
- [ ] Test in Safari
- [ ] Check all form validations
- [ ] Verify file uploads work
- [ ] Test order submission end-to-end

**Task 4.8: Mobile Responsiveness** (30 minutes)
- [ ] Test on iOS Safari
- [ ] Test on Android Chrome
- [ ] Check layout at 375px width
- [ ] Verify touch targets (44px minimum)
- [ ] Test file upload on mobile

**Task 4.9: ShopWorks End-to-End Test** (1 hour)
- [ ] Create test order with real data
- [ ] Submit to ShopWorks OnSite
- [ ] Verify order appears in system
- [ ] Check all fields populated correctly
- [ ] Confirm pricing matches exactly
- [ ] Verify CATALOG_COLOR linked properly

**✅ Day 4 Checkpoint:**
- Complete order submits to ShopWorks successfully
- Order appears in OnSite with correct data
- Customer receives confirmation email
- Sales team receives notification
- Fallback database save works
- All browsers tested
- Mobile responsive

**Deliverable:** Production-ready 3-Day Tees page

---

## Phase 2: Stripe Payment Integration (Future)

**Timeline:** 2 additional days (after Phase 1 complete)
**Status:** Prerequisites documented, ready for implementation

### Day 5: Stripe Setup & Integration

**Duration:** 8 hours

**Morning (4 hours):**
- [ ] Install Stripe.js and stripe npm package
- [ ] Implement Stripe Elements UI on checkout page
- [ ] Create payment intent before order creation
- [ ] Add card input form with validation

**Afternoon (4 hours):**
- [ ] Handle payment success scenarios
- [ ] Handle payment failure scenarios
- [ ] Link payment ID to order in ShopWorks
- [ ] Test with Stripe test cards

### Day 6: Testing & Deployment

**Duration:** 8 hours

**Morning (4 hours):**
- [ ] Test payment flow end-to-end
- [ ] Test 3D Secure cards
- [ ] Test declined cards
- [ ] Add payment receipt emails

**Afternoon (4 hours):**
- [ ] Update order notes with payment confirmation
- [ ] Switch to live Stripe keys
- [ ] Test with real (small) payment
- [ ] Deploy to production

### Phase 2 Prerequisites (Complete During Phase 1)

**Stripe Account Setup:**
- [ ] Create Stripe account (if needed)
- [ ] Complete business profile
- [ ] Connect bank account
- [ ] Wait for micro-deposit verification (1-2 business days)
- [ ] Collect API keys (test and live)
- [ ] Create webhook endpoint
- [ ] Store credentials in .env file

**Test Cards for Development:**
```
Visa (Success):           4242 4242 4242 4242
Visa (Decline):           4000 0000 0000 0002
Visa (3D Secure):         4000 0027 6000 3184
Mastercard (Success):     5555 5555 5555 4444
Amex (Success):           3782 822463 10005

Expiry: Any future date (12/25)
CVC: Any 3 digits (123)
ZIP: Any 5 digits (98354)
```

**Security Checklist:**
- [ ] Never commit credentials to Git (.env in .gitignore)
- [ ] Use HTTPS in production
- [ ] Validate webhook signatures
- [ ] Use Stripe Elements (PCI compliance)
- [ ] Test mode keys for development, live keys for production

**Resources:**
- Stripe Testing Guide: https://stripe.com/docs/testing
- Stripe Elements: https://stripe.com/docs/payments/elements
- Webhook Testing: https://stripe.com/docs/webhooks/test

---

## 🧪 Testing Procedures

### Unit Testing

**Inventory Service:**
```javascript
// Test multi-SKU fetch
const inventory = await fetchPC54Inventory('Forest');
console.assert(inventory.S === 50, 'S inventory should be 50');
console.assert(inventory['2XL'] === 75, '2XL from PC54_2X');
console.assert(inventory['3XL'] === 30, '3XL from PC54_3X');
```

**Pricing Formula:**
```javascript
// Test 7-step formula
const price = calculate3DayTeesPrice(24, 'LC', 'M');
console.assert(price.finalPrice === 16.00, 'Medium @ 24qty Left Chest = $16.00');
console.assert(price.rushFee > 0, 'Rush fee should be applied');
```

**Order Number Generator:**
```javascript
// Test format
const orderNo = generateOrderNumber();
console.assert(/^3DT\d{4}-\d+$/.test(orderNo), 'Should match 3DT{MMDD}-{seq}');
```

### Integration Testing

**Test Case 1: Complete Order Flow**
1. Load page → verify PC54 appears
2. Select Forest color → verify inventory loads
3. Select Left Chest → verify price updates
4. Add quantities: M(5), L(10), XL(5), 2XL(4) = 24 total
5. Upload .ai file → verify success
6. Fill customer info → verify validation
7. Submit order → verify ShopWorks receives

**Expected Result:** Order appears in OnSite with correct data

**Test Case 2: LTM Fee Scenario**
1. Add quantities totaling 8 pieces
2. Verify LTM fee shows: $75.00
3. Verify per-piece LTM: $9.38
4. Submit order
5. Verify line items include LTM in price

**Expected Result:** Total includes LTM fee correctly

**Test Case 3: Multi-Location Pricing**
1. Select Left Chest + Full Back
2. Add 24 pieces
3. Verify price includes BOTH location costs
4. Submit order
5. Check order notes mention both locations

**Expected Result:** Pricing reflects multiple locations

**Test Case 4: API Failure Fallback**
1. Disable network (simulate API down)
2. Submit order
3. Verify quote saves to database
4. Verify email still sends
5. Verify user sees success message with quote ID

**Expected Result:** Graceful degradation, no data loss

### Browser Compatibility Matrix

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome | Latest | ✅ Primary | Full testing |
| Firefox | Latest | ✅ Secondary | Full testing |
| Safari | Latest | ✅ Secondary | iOS critical |
| Edge | Latest | ✅ Secondary | Windows default |
| Mobile Safari | iOS 14+ | ✅ Critical | iPhone testing |
| Chrome Mobile | Latest | ✅ Critical | Android testing |

### Performance Benchmarks

**Page Load:**
- Target: < 3 seconds on 3G
- Measure: Time to interactive
- Optimize: Lazy load images, defer JS

**Inventory API:**
- Target: < 2 seconds for all 3 SKUs
- Using: Promise.all() parallel requests
- Fallback: Cached data if API slow

**Order Submission:**
- Target: < 5 seconds total
- Includes: API call + email send + DB save
- User feedback: Show progress messages

---

## 📦 Deployment Checklist

### Pre-Deployment

**Code Quality:**
- [ ] All console.log statements removed
- [ ] No hardcoded test data
- [ ] Error handling in place for all APIs
- [ ] Loading states for all async operations

**Testing:**
- [ ] All Day 4 tests passing
- [ ] Cross-browser testing complete
- [ ] Mobile responsiveness verified
- [ ] End-to-end ShopWorks test successful

**Documentation:**
- [ ] ACTIVE_FILES.md updated
- [ ] All 6 modular docs complete
- [ ] README.md updated with 3-Day Tees info
- [ ] Code comments added for complex logic

**Environment:**
- [ ] Server route added for new page
- [ ] EmailJS template created and tested
- [ ] API endpoints verified accessible
- [ ] File upload path configured

### Deployment Steps

1. **Git Commit:**
   ```bash
   git add .
   git commit -m "Add 3-Day Tees page with rush service pricing"
   git push origin main
   ```

2. **Server Restart:**
   ```bash
   npm start
   ```

3. **Verify Route:**
   - Visit: `http://localhost:3000/pages/3-day-tees.html`
   - Check: Page loads without errors

4. **Production Test:**
   - Complete full order flow
   - Verify ShopWorks receives order
   - Check email notifications sent
   - Confirm order number format correct

5. **User Acceptance:**
   - [ ] Erik reviews page
   - [ ] Test with internal order
   - [ ] Verify pricing matches expectations
   - [ ] Confirm rush fee applies correctly

### Post-Deployment

**Monitoring:**
- [ ] Watch for JavaScript errors (browser console)
- [ ] Monitor API response times
- [ ] Track order submission success rate
- [ ] Review customer feedback

**Analytics:**
- [ ] Add Google Analytics tracking
- [ ] Track page views
- [ ] Monitor conversion rate
- [ ] Measure average order value

**Optimization:**
- [ ] Review performance metrics
- [ ] Optimize slow API calls
- [ ] Compress large images
- [ ] Add additional caching if needed

---

## 🔧 Implementation Notes

### Code Reuse Breakdown by Day

| Day | Focus Area | Reuse % | New Code | Existing Components |
|-----|------------|---------|----------|---------------------|
| 1 | Page Foundation | 80% | Inventory fetcher, page structure | Product display, image gallery |
| 2 | Pricing Engine | 75% | Rush fee logic, size upcharges | DTG service, location toggles |
| 3 | Checkout Flow | 85% | File validation | Address form, upload UI |
| 4 | Order Submission | 90% | Order number format | API integration, emails |

**Total Code Reuse:** ~82.5% (33 hours saved vs. building from scratch)

### Critical Success Factors

**1. CATALOG_COLOR Usage**
- ❌ Wrong: Use "Forest Green" (COLOR_NAME)
- ✅ Correct: Use "Forest" (CATALOG_COLOR)
- Why: ShopWorks inventory matching requires exact catalog names

**2. BASE Part Number Only**
- ❌ Wrong: Use "PC54_2X" for 2XL orders
- ✅ Correct: Use "PC54" with size field = "2XL"
- Why: ShopWorks routes automatically based on size

**3. Multi-SKU Inventory Query**
- ❌ Wrong: Query only PC54
- ✅ Correct: Query PC54 + PC54_2X + PC54_3X in parallel
- Why: 2XL and 3XL inventory is in separate SKUs

**4. Rush Fee Application**
- ❌ Wrong: Apply rush fee before rounding
- ✅ Correct: Round base price, THEN apply 25% rush, THEN round again
- Why: Ensures correct half-dollar pricing

**5. ShopWorks Verification**
- ❌ Wrong: Assume order submission worked
- ✅ Correct: Verify order appears in OnSite with correct data
- Why: Catch integration issues before production

### Risk Mitigation Strategies

**If ManageOrders API Fails:**
- Save to quote database (quote_sessions + quote_items)
- Email quote ID to customer and sales team
- Show success message (don't block user)
- Follow up manually to create order in ShopWorks

**If Email Send Fails:**
- Still show success (order is saved)
- Log error for admin follow-up
- Don't throw error to user

**If Inventory API Slow:**
- Show cached data with timestamp
- Display "Last updated: X minutes ago"
- Provide manual refresh button

**If File Upload Fails:**
- Allow order submission without file
- Email sales team to request artwork
- Provide manual artwork upload link

---

## 📝 Quality Assurance

### Acceptance Criteria

**Phase 1 Complete When:**
- [ ] Page loads in < 3 seconds
- [ ] Inventory displays from all 3 SKUs
- [ ] Pricing calculator shows correct values (±$0.01)
- [ ] Rush fee applies at exactly 25%
- [ ] LTM fee shows for < 12 pieces
- [ ] File upload accepts 20+ formats
- [ ] Order submits to ShopWorks successfully
- [ ] Emails sent to customer and sales team
- [ ] Success modal shows order number
- [ ] Mobile responsive (tested on iOS and Android)

**Phase 2 Complete When:**
- [ ] Stripe payment processing works
- [ ] Payment receipt generated
- [ ] Order linked to payment ID in ShopWorks
- [ ] 3D Secure cards handled correctly
- [ ] Failed payments show clear error messages
- [ ] Webhook verifies payment before order creation

### Known Limitations (Phase 1)

**No Online Payment:**
- Users must pay by check, wire, or terms
- Phase 2 will add Stripe integration

**Manual Artwork Review:**
- All artwork reviewed by art team before production
- No automatic approval yet

**Single Product Only:**
- PC54 only (no other styles)
- Future: Add more products to 3-Day service

---

**Documentation Type:** Implementation Timeline & Testing Guide
**Parent Document:** [3-DAY-TEES-PROJECT-REQUIREMENTS.md](../../3-DAY-TEES-PROJECT-REQUIREMENTS.md)
**Related Docs:** All files in [/memory/3-day-tees/](.)
