# 3-Day Tees - Business Logic & Rules

**Last Updated:** 2025-11-08
**Purpose:** Complete business terms, fees, payment rules, and operational decisions
**Status:** Implementation Ready

---

## 📋 Quick Navigation

**Related Documentation:**
- **[Main PRD](../../3-DAY-TEES-PROJECT-REQUIREMENTS.md)** - Executive summary
- **[Overview](OVERVIEW.md)** - Architecture and components
- **[Pricing Formula](PRICING-FORMULA.md)** - Pricing calculations
- **[Inventory Integration](INVENTORY-INTEGRATION.md)** - Multi-SKU patterns
- **[API Patterns](API-PATTERNS.md)** - API integration specs
- **[Implementation Timeline](IMPLEMENTATION-TIMELINE.md)** - Development plan

---

## 🎯 Product Scope

### Fixed Product (PC54 Only)

**Style:** Port & Company Core Cotton Tee (PC54)
**Why PC54:** Reliable inventory levels, consistent DTG print quality, industry-standard sizing

**Available Colors:**
1. **Black** - 1,859 units (Excellent Stock)
2. **Forest** - 605 units (Low Stock - Monitor)
3. **Navy** - 1,470 units (Good Stock)
4. **White** - 2,450 units (Excellent Stock)
5. **Athletic Heather** - 980 units (Moderate Stock)

**Total Inventory:** 7,364 units across all colors

**Available Sizes:**
- S, M, L, XL (standard pricing)
- 2XL (+$2.00 upcharge)
- 3XL (+$3.00 upcharge)

**Future Expansion:** Additional styles may be added based on demand and inventory availability

---

## 💰 Pricing & Fees

### Base Pricing Model

**Formula:** Standard DTG pricing + 25% rush fee

**Base DTG Price Components:**
1. Base garment cost (from API pricing data)
2. Margin markup (MarginDenominator from tier)
3. Print cost (based on location and quantity tier)
4. Half-dollar rounding (ceiling)

**Rush Fee Application:**
- 25% premium applied to rounded base price
- Applied BEFORE final rounding
- Non-negotiable for 3-day turnaround

**Complete Formula:** See [Pricing Formula documentation](PRICING-FORMULA.md)

### Less Than Minimum (LTM) Fee

**Amount:** $75.00
**Threshold:** Orders with < 12 total pieces
**Application:** Distributed across all pieces in order

**Rationale:**
- Higher than standard DTG LTM fee ($50.00)
- Accounts for rush service overhead
- Covers setup and handling for small orders

**Display:**
- Show as separate line item in order summary
- Include per-piece breakdown in notes
- Example: "$75.00 LTM Fee ($6.25/piece for 12 pieces)"

**Future Consideration:** May adjust threshold or fee based on market feedback

### Sales Tax

**Current Rate:** 10.1% (City of Milton, WA)
**Application:** Applied to subtotal (products + rush fee + LTM fee)
**Exclusions:** Shipping is NOT taxed

**Tax Calculation:**
```javascript
const subtotal = productTotal + rushFeeTotal + ltmFee;
const salesTax = subtotal * 0.101;
```

**Future Enhancement (Phase 3):**
- Tax API integration (Avalara or TaxJar)
- Automatic city/state tax rate lookup
- Support for tax-exempt customers
- Real-time rate updates

### Shipping Cost

**Standard Shipping:** $30.00 flat rate (UPS Ground)
**Service Level:** 3-7 business days transit (not guaranteed)
**Included:** All orders receive UPS Ground shipping

**Expedited Options (via phone):**
- Next Day Air - Call for quote
- 2nd Day Air - Call for quote
- Rates vary by destination and package weight

**Future Enhancement (Phase 3):**
- UPS API integration for real-time quotes
- Address validation
- Automatic weight calculation
- Tracking number generation

### Size Upcharges

From API `upcharges` object:

| Size | Upcharge | Notes |
|------|----------|-------|
| S, M, L, XL | $0.00 | Standard sizes |
| 2XL | +$2.00 | Oversized |
| 3XL | +$3.00 | Oversized |
| 4XL | +$4.00 | Not stocked for PC54 |

**Application:** Added after final price rounding (Step 8 of pricing formula)

---

## 💳 Payment Terms

### Phase 1: Manual Payment Collection

**Process:**
1. Customer completes order on website
2. Order confirmation sent via email
3. Sales rep calls customer to collect payment
4. Payment processed via phone (credit card, check info, wire transfer)
5. Production begins after payment confirmed

**Accepted Payment Methods:**
- Credit card (via phone)
- Check (company check or cashier's check)
- Wire transfer (for corporate accounts)

**Payment Terms:** Payment due upon order placement (before production)

**Customer Communication:**
- Order confirmation email includes: "Our sales team will contact you to process payment"
- Website displays: "Payment will be processed via phone after order confirmation"

### Phase 2: Online Payment (Stripe Integration)

**Target Timeline:** After Phase 1 stable (see [Implementation Timeline](IMPLEMENTATION-TIMELINE.md))

**Payment Flow:**
1. Customer completes checkout form
2. Enters credit card on secure Stripe form
3. Payment processed immediately
4. Order confirmation sent after successful payment
5. Production begins automatically

**Accepted Cards:**
- Visa, Mastercard, American Express, Discover
- Debit cards with credit processing

**Security:**
- PCI-compliant via Stripe
- No card data stored on NWCA servers
- Tokenized payment processing

**Test Cards for Development:**
- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002
- See [Implementation Timeline](IMPLEMENTATION-TIMELINE.md#phase-2-stripe-integration) for complete list

---

## 📧 Order Management

### Order Number Format

**Pattern:** `3DT{MMDD}-{sequence}`
**Example:** `3DT1108-1` (First order on November 8)

**Implementation:**
- Uses sessionStorage for daily sequence tracking
- Sequence resets daily (MMDD changes)
- Cross-tab safe (prevents duplicate numbers)
- Generator function in sample-order-service.js

**Code Reference:**
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

### Email Notifications

**Service:** EmailJS (existing integration)
**Public Key:** 4qSbDO-SQs19TbP80
**Service ID:** service_1c4k67j

**Customer Email:**
- **To:** Customer email from checkout form
- **Subject:** "3-Day Tees Order Confirmation - [OrderNumber]"
- **Content:**
  - Order number
  - Order summary (products, quantities, total)
  - Estimated completion date (3 business days from artwork approval)
  - Artwork upload instructions
  - Contact information (253-922-5793)
  - Next steps (sales rep will call for payment)

**Sales Team Email:**
- **To:** sales@nwcustomapparel.com
- **BCC:** erik@nwcustomapparel.com (admin notification)
- **Subject:** "NEW 3-Day Tees Order - [OrderNumber]"
- **Content:**
  - Complete order details
  - Customer information
  - Shipping address
  - Payment status (Phase 1: "Pending", Phase 2: "Paid")
  - Notes/special instructions

**Error Notification Email (API Failure):**
- **To:** erik@nwcustomapparel.com
- **Subject:** "3-Day Tees Order Failed - [OrderNumber]"
- **Content:**
  - Error details
  - Quote ID (from database fallback)
  - Customer contact information
  - Full order data (JSON)
  - Action required: Manual entry into ShopWorks

---

## 📊 Inventory Display Rules

### Stock Status Badges

**Purpose:** Inform customers of product availability

**Badge Levels:**
1. **✅ "In Stock"** (Green)
   - Threshold: 50+ units available
   - Display exact count: "127 units in stock"
   - Action: Allow order placement

2. **⚠️ "Low Stock"** (Yellow)
   - Threshold: 10-49 units available
   - Display exact count: "23 units in stock"
   - Action: Show warning, but allow order placement

3. **❌ "Out of Stock"** (Red)
   - Threshold: < 10 units available
   - Display: "Out of Stock - Call 253-922-5793"
   - Action: Disable color selection option

**Inventory Refresh:**
- Real-time check on page load
- 5-minute cache via sessionStorage
- Multi-SKU query (PC54 + PC54_2X + PC54_3X)

**Display Location:**
- Color selector (badge per color)
- Size breakdown grid (per-size availability)

**Implementation:** See [Inventory Integration Guide](INVENTORY-INTEGRATION.md)

---

## 📜 Terms & Conditions

**Display Location:** Checkout page, above order submission button
**Format:** Scrollable text box with "I agree" checkbox (required)
**Alternative:** Link to modal popup with full text

### Complete Legal Text

```
3-DAY TEES - TERMS & CONDITIONS

PRODUCTION & SHIPPING TIMELINE
We will ship your order within 3 business days from final artwork approval. Production
time does not include shipping transit time. Artwork must be approved by 12:00 PM PST
to count toward the same business day.

SHIPPING DETAILS
All orders ship via UPS Ground at a flat rate of $30.00. Standard UPS Ground transit
time is 3-7 business days depending on destination. Transit time is NOT guaranteed.
Shipping time is separate from our 3-day production guarantee.

EXPEDITED SHIPPING OPTIONS
Need guaranteed delivery? Contact us at 253-922-5793 for Next Day Air or 2nd Day Air
quotes. Expedited shipping rates vary by destination and package weight.

BUSINESS DAYS
Business days are Monday through Friday, excluding federal holidays and company
closures. Orders received after 12:00 PM PST Friday will begin production the following
Monday.

ARTWORK REQUIREMENTS
Customer is responsible for providing print-ready artwork in vector format (AI, EPS, PDF)
or high-resolution raster files (300 DPI minimum). Artwork corrections or revisions may
delay production timeline. Digital proofs will be provided via email for approval.

CANCELLATION POLICY
Orders cannot be cancelled once artwork has been approved and production has started.
Rush orders are prioritized in our production queue and cannot be stopped once printing
begins.

PAYMENT TERMS
Phase 1: Payment will be collected via phone after order confirmation. Our sales team
will contact you to process payment.
Phase 2 (Coming Soon): Online payment via credit card at checkout.

RETURNS & EXCHANGES
Due to the custom nature of this service, all sales are final. We cannot accept returns
or exchanges on custom-printed merchandise. If there is an error in our printing or
production, please contact us within 5 business days of receipt for resolution.

PRICING
Pricing includes:
- Direct-to-garment printing
- 25% rush service premium
- Standard UPS Ground shipping ($30.00)
- Sales tax (where applicable)

Size upcharges apply to 2XL (+$2.00) and 3XL (+$3.00). Orders under 12 pieces incur a
Less Than Minimum (LTM) fee of $75.00.

QUALITY GUARANTEE
We guarantee the quality of our printing and garments. If you are not satisfied with
the print quality or garment construction, please contact us within 5 business days of
receipt for resolution.

CONTACT INFORMATION
Northwest Custom Apparel
Phone: 253-922-5793
Email: sales@nwcustomapparel.com
Address: 2025 Freeman Road East, Milton, WA 98354
Business Hours: Monday - Friday, 9:00 AM - 5:00 PM PST

AGREEMENT
By submitting your order, you acknowledge that you have read, understand, and agree to
these terms and conditions. You also confirm that you have the legal right to use any
logos, artwork, or designs submitted for printing.
```

### HTML Implementation

```html
<div class="terms-section">
    <h3>Terms & Conditions</h3>
    <div class="terms-container">
        <!-- Scrollable terms text -->
        <div class="terms-text">
            [Full terms text above]
        </div>
    </div>

    <!-- Required checkbox -->
    <div class="terms-acceptance">
        <label class="checkbox-label">
            <input type="checkbox" id="termsAccepted" required>
            <span>
                I have read and agree to the
                <a href="#" onclick="showTermsModal(); return false;">
                    Terms & Conditions
                </a>
            </span>
        </label>
    </div>
</div>

<script>
function showTermsModal() {
    // Display full terms in modal popup
    const modal = document.getElementById('termsModal');
    modal.style.display = 'block';
}
</script>
```

**Validation:** Order submission disabled until checkbox checked

---

## 📞 User Experience Guidelines

### Customer Support Phone

**Number:** 253-922-5793
**Display Locations:**
- Header contact bar (top of page)
- Out of stock messages
- Error messages with "call us" prompt
- Order confirmation emails
- Terms & Conditions section

**Hours:** Monday - Friday, 9:00 AM - 5:00 PM PST

**Purpose:**
- Payment processing (Phase 1)
- Expedited shipping quotes
- Out-of-stock color inquiries
- Technical support
- Custom requests

### Company Contact Information

**Email:** sales@nwcustomapparel.com
**Website:** https://www.nwcustomapparel.com
**Address:** 2025 Freeman Road East, Milton, WA 98354

**Business Hours:** Monday - Friday, 9:00 AM - 5:00 PM PST
**Established:** 1977 (Family Owned and Operated)

---

## 🚨 Error Handling & Fallbacks

### ManageOrders API Failure

**Scenario:** Order creation API call fails

**Fallback Process:**
1. Save order to quote database (quote_sessions + quote_items)
2. Display user-friendly error message
3. Send error notification email to admin
4. Show saved quote ID to customer
5. Sales rep manually enters order into ShopWorks

**User Message:**
```
"We're experiencing technical difficulties. Your order has been saved as
quote #3DT1108-1. Please call 253-922-5793 to complete your order.
We apologize for the inconvenience."
```

**Admin Notification Email:**
- To: erik@nwcustomapparel.com
- Subject: "3-Day Tees Order Failed - 3DT1108-1"
- Content: Error details, customer info, full order JSON

**Database Fallback Pattern:**
- Use existing quote_sessions and quote_items tables
- Same structure as other quote builders
- Allows order retrieval and manual processing

**Implementation:** See [API Patterns - Quote Database Fallback](API-PATTERNS.md#quote-database-fallback-pattern)

### File Upload Errors

**Supported Formats:** 20+ types (AI, EPS, PDF, PNG, JPG, etc.)
**Maximum Size:** 20 MB per file
**Multiple Files:** Unlimited uploads

**Error Messages:**
- File too large: "File exceeds 20MB limit. Please compress or contact us at 253-922-5793"
- Unsupported format: "File type not supported. Accepted formats: AI, EPS, PDF, PNG, JPG, TIFF, PSD"
- Upload failed: "Upload failed. Please try again or email artwork to sales@nwcustomapparel.com"

### Inventory Check Errors

**Scenario:** Inventory API fails to return data

**Fallback:**
- Display "Unable to Verify Stock" badge
- Show message: "Call 253-922-5793 to confirm availability"
- Allow order placement (sales rep will verify)

**Retry Logic:**
- Automatic retry after 5 seconds
- Maximum 3 retry attempts
- Cache previous successful result (5 minutes)

---

## 🔮 Future Enhancements

### Phase 3: Tax API Integration

**Purpose:** Automatic tax rate lookup by customer location

**Provider Options:**
- Avalara
- TaxJar

**Features:**
- Automatic city/state tax rate calculation
- Support for tax-exempt customers
- Real-time rate updates
- Multi-jurisdiction handling

**Benefits:**
- Accurate tax collection
- Compliance with local tax laws
- Reduced manual tax management

### Phase 3: Shipping API Integration

**Purpose:** Real-time shipping quotes based on destination

**Provider:** UPS API (connect to NWCA account)

**Features:**
- Real-time rate quotes by ZIP code
- Package weight calculation (from quantities)
- Service level options (Ground, 3-Day, 2-Day, Next Day)
- Address validation
- Automatic tracking number generation

**Benefits:**
- Accurate shipping costs
- Customer choice of service level
- Reduced shipping overcharges/undercharges
- Automated tracking updates

### Product Expansion

**Potential Future Products:**
- PC61 (Long Sleeve Tee)
- PC78 (Hooded Sweatshirt)
- PC90 (Crewneck Sweatshirt)
- Additional color options

**Criteria for Addition:**
- Reliable inventory levels
- Proven DTG print quality
- Customer demand
- Pricing profitability

---

**Documentation Type:** Business Logic Reference
**Parent Document:** [3-DAY-TEES-PROJECT-REQUIREMENTS.md](../../3-DAY-TEES-PROJECT-REQUIREMENTS.md)
**Related Docs:** All files in [/memory/3-day-tees/](.)
