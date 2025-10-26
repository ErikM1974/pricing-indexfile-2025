# ShopWorks EDP - Payment Block Field Reference

**File Path:** `memory/edp/PAYMENT_BLOCK.md`
**Purpose:** Complete Payment Block field specifications for ShopWorks OnSite 7 EDP integration
**Parent Guide:** [SHOPWORKS_EDP_INTEGRATION.md](../SHOPWORKS_EDP_INTEGRATION.md)

---

## Overview

**Status:** NOT IMPLEMENTED - FUTURE STRIPE INTEGRATION PLANNED

**🚀 Future Goal:** Enable customers to pay for quotes online via Stripe.com, with secure payment tracking in ShopWorks EDP.

**OnSite Version:** OnSite 7 (ALL FIELDS ARE NEW - Payment Block did not exist in OnSite 6.1)

**Total Fields:** 8 fields (no SubBlocks - flat structure)

**Shared Across:** All quote builders (Screen Print, DTG, Embroidery, Cap) when implemented

---

## Payment Block Structure (8 Total Fields)

The Payment Block in ShopWorks OnSite 7 does not use SubBlocks - it's a flat structure of 8 fields.

**Field Categories:**
1. **Payment Details** (4 fields) - Date, amount, type, transaction reference
2. **Cardholder Information** (2 fields) - Name (PII but not PCI sensitive)
3. **Card Expiration** (1 field) - **LEAVE BLANK FOR SECURITY**
4. **Notes** (1 field) - Non-sensitive payment details

---

## OnSite 7 Field Specifications

| OnSite 7 Field Name | OnSite 6.1 Field Name | Type | Purpose | Security Level |
|---------------------|----------------------|------|---------|----------------|
| `date_Payment` | *(NEW in OnSite 7)* | Date | Payment date | ✅ Safe |
| `cur_Payment` | *(NEW in OnSite 7)* | Currency | Payment amount | ✅ Safe |
| `PaymentType` | *(NEW in OnSite 7)* | String | Payment method | ✅ Safe |
| `PaymentNumber` | *(NEW in OnSite 7)* | String | Transaction reference | ✅ Safe (Stripe Charge ID) |
| `Card_Name_First` | *(NEW in OnSite 7)* | String | Cardholder first name | ⚠️ PII but not PCI |
| `Card_Name_Last` | *(NEW in OnSite 7)* | String | Cardholder last name | ⚠️ PII but not PCI |
| `Card_Exp_Date` | *(NEW in OnSite 7)* | String | Card expiration | 🚫 **LEAVE BLANK - PCI SENSITIVE** |
| `Notes` | *(NEW in OnSite 7)* | Text | Payment notes | ✅ Safe (non-sensitive details) |

**Important:** All 8 fields are NEW in OnSite 7. Payment Block was not available in OnSite 6.1.

---

## 🔒 Critical Security Principle for Payment Integration

**NEVER store sensitive credit card data in your database or EDP files.**

### What Stripe Handles (PCI Compliant Storage)

✅ **Stripe Securely Stores:**
- Full credit card numbers
- CVV/CVC security codes
- Card expiration dates
- Card PINs

### What's SAFE to Store in EDP

✅ **Safe to Include:**
- Stripe Charge ID (e.g., `ch_3ABC123xyz`) in `PaymentNumber` field
- Payment amount and date
- Cardholder name (from billing info)
- Last 4 digits of card (Stripe provides this)
- Card brand (Visa, Mastercard, etc.)

### What to NEVER Store

🚫 **NEVER Include:**
- Full card number
- CVV/CVC code
- Card expiration date (even though OnSite 7 has `Card_Exp_Date` field - LEAVE IT BLANK)

---

## 🚀 Future: Stripe Payment Integration Architecture

**Overview:** When ready to implement, this architecture enables customers to pay for quotes (Screen Print, DTG, Embroidery, Cap) online with credit cards via Stripe, with payment transactions automatically recorded in ShopWorks.

### Core Workflow

```
1. Customer Reviews Quote → Sees total: $550.00

2. Customer Clicks "Pay with Credit Card" → Redirects to Stripe Checkout (Stripe-hosted, PCI compliant)

3. Customer Enters Card Details → Stripe securely processes payment
   - NWCA never sees or stores card details
   - Stripe returns Charge ID: ch_3ABC123xyz

4. Stripe Webhook Notification → Triggers EDP Payment Block generation
   - Payment date: 01/27/2025
   - Payment amount: $550.00
   - Stripe Charge ID: ch_3ABC123xyz
   - Card: Visa ****4242 (last 4 digits only)

5. EDP Auto-Generated → Payment Block ready for ShopWorks import

6. Quote Marked as "Paid" → Database updated, accounting notified

7. ShopWorks Import → Payment recorded with Stripe reference
```

### Key Benefits

- ✅ PCI DSS Level 1 Compliance (Stripe certified)
- ✅ Fraud detection with Stripe Radar
- ✅ 3D Secure for international cards
- ✅ Refund capability via Charge ID (no card details needed)
- ✅ Customer sees professional Stripe checkout
- ✅ Automatic receipt emails from Stripe

---

## EDP Payment Block Implementation Example (Future)

**Full Payment Block:**

```javascript
// After successful Stripe payment, generate Payment Block:

edp += '---- Start Payment ----\n';
edp += `date_Payment>> 01/27/2025\n`;
edp += `cur_Payment>> 550.00\n`;
edp += `PaymentType>> Stripe Credit Card\n`;
edp += `PaymentNumber>> ch_3ABC123xyz\n`;  // Stripe Charge ID - enables refunds
edp += `Card_Name_First>> John\n`;
edp += `Card_Name_Last>> Smith\n`;
edp += `Card_Exp_Date>> \n`;  // INTENTIONALLY BLANK - DO NOT STORE for security
edp += `Notes>> Stripe payment for Quote SP0127-1. Card: Visa ****4242. Customer: john@company.com\n`;
edp += '---- End Payment ----\n\n';
```

### Field Usage Details

**date_Payment:**
- Format: MM/DD/YYYY (matches ShopWorks standard)
- Use date payment was processed by Stripe
- Example: `01/27/2025`

**cur_Payment:**
- Format: Currency amount in dollars (e.g., 550.00)
- Should match quote total
- No dollar sign or commas

**PaymentType:**
- Value: `"Stripe Credit Card"` (identifies payment processor)
- Consistent across all quotes
- Distinguishes from "Net 30", "Check", etc.

**PaymentNumber:**
- **Stripe Charge ID** (critical for refunds)
- Format: `ch_3ABC123xyz`
- This ID enables refunds without storing card details
- Never expires, always valid for lookups

**Card_Name_First / Card_Name_Last:**
- From Stripe billing details
- Safe to store (not PCI regulated)
- Helps identify payment source

**Card_Exp_Date:**
- **LEAVE BLANK** - Never store expiration for PCI compliance
- Field exists in OnSite 7 but should remain empty
- Expiration stored securely by Stripe only

**Notes:**
- Non-sensitive details only
- Include: Last 4 digits, card brand, quote reference
- Format: `Stripe payment for Quote [QuoteID]. Card: [Brand] ****[Last4]. Customer: [Email]`

---

## Use Cases for Stripe Payment Integration

1. **Pay for Quotes** - Customer pays for Screen Print, DTG, Embroidery, or Cap quotes online
2. **Deposit Payments** - Require 50% deposit before production on large orders
3. **Full Payment Before Production** - For new customers or rush orders
4. **Online Store Integration** - Future webstore customers pay at checkout
5. **Invoice Payments** - Email payment link for outstanding invoices

---

## Technical Components Needed for Implementation (When Ready)

### Frontend (Quote Builders)

- Stripe.js library integration
- "Pay with Credit Card" button in review phase
- Payment success/failure handling
- Redirect to Stripe Checkout

### Backend (Heroku Proxy Server)

- Stripe webhook endpoint (`/api/stripe/webhook`)
- Webhook signature verification (security)
- EDP Payment Block generation on successful payment
- Database update: Mark quote as "Paid"
- Email notification to accounting with EDP text

### Database Schema Updates

Add payment fields to `quote_sessions` table:
- `PaymentStatus` ("Unpaid", "Paid", "Refunded")
- `PaymentMethod` ("Stripe Credit Card", "Net 30")
- `StripeChargeID` (e.g., "ch_3ABC123xyz")
- `PaymentDate` (timestamp)
- `EDPPaymentGenerated` (boolean)

### Stripe Account Setup

- Create Stripe account at stripe.com
- Get API keys (test and live)
- Configure webhook endpoint
- Set up email receipts
- Enable fraud detection (Stripe Radar)

---

## What Changes vs. What Stays the Same (Across Quote Builders)

### Same Payment Block Structure for ALL Quote Builders

- ✅ Screen Print Quote Builder
- ✅ DTG Quote Builder
- ✅ Embroidery Quote Builder
- ✅ Cap Embroidery Quote Builder
- ✅ All future quote builders

### What's Identical

- All 8 Payment Block field names
- Security rules (never store card details)
- Stripe Charge ID pattern
- Date and currency formats
- EDP Block structure

### What Varies by Quote Builder

- `Notes` field content: References specific quote ID (SP0127-1, DTG0127-1, etc.)
- Payment amount: Calculated from that builder's pricing
- Quote metadata: Stored in Stripe for reference

---

## Security & Compliance Resources

### PCI Compliance

- Stripe is PCI DSS Level 1 certified (highest level)
- By using Stripe Checkout, you avoid PCI compliance requirements
- Never handle raw card data = automatic compliance

### Stripe Documentation

- Stripe Checkout: https://stripe.com/docs/payments/checkout
- Webhooks: https://stripe.com/docs/webhooks
- Security: https://stripe.com/docs/security

### Best Practices

- Always verify webhook signatures
- Use HTTPS for all payment pages
- Log payment events for auditing
- Test in Stripe test mode before going live
- Set up fraud detection rules in Stripe Dashboard

---

## Implementation Timeline (When Ready)

### Phase 1: Proof of Concept (1-2 weeks)

- Set up Stripe test account
- Implement basic checkout flow for one quote builder
- Test webhook handler
- Generate test EDP Payment Blocks
- Manual import into ShopWorks test environment

### Phase 2: Production Rollout (2-3 weeks)

- Roll out to all quote builders (Screen Print, DTG, Embroidery, Cap)
- Add payment status tracking in database
- Create admin dashboard for paid vs. unpaid quotes
- Implement email notifications for accounting
- Test refund workflow

### Phase 3: Advanced Features (Future)

- Auto-import EDP to ShopWorks (if API available)
- Payment plans / deposit options
- Automatic payment reminders for unpaid quotes
- Customer payment history portal
- Subscription billing for webstores

---

## Additional Notes

**Current Status:** Payment Block fields are documented but not implemented. All quotes currently use "Net 30" payment terms with manual processing.

**Future Decision Points:**
- When to require payment vs. offering terms?
- Deposit percentage for large orders?
- Payment deadline after quote generation?
- Auto-decline quotes unpaid after X days?

**Related Documentation:**
- For full Stripe integration code examples, see conversation history from 2025-10-26

---

## Example: Complete Payment Block Integration

### Stripe Webhook Handler

```javascript
// Server-side: Handle successful payment webhook
app.post('/api/stripe/webhook', async (req, res) => {
    const event = req.body;

    // Verify webhook signature (security)
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    try {
        const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

        if (event.type === 'charge.succeeded') {
            const charge = event.data.object;

            // Extract payment details
            const paymentData = {
                quoteID: charge.metadata.quote_id,
                chargeID: charge.id,
                amount: (charge.amount / 100).toFixed(2),  // Convert cents to dollars
                cardBrand: charge.payment_method_details.card.brand,
                last4: charge.payment_method_details.card.last4,
                cardholderName: charge.billing_details.name,
                customerEmail: charge.billing_details.email,
                paymentDate: new Date(charge.created * 1000)
            };

            // Generate EDP Payment Block
            const edpPayment = generatePaymentBlock(paymentData);

            // Update database
            await updateQuotePaymentStatus(paymentData.quoteID, paymentData);

            // Notify accounting
            await sendAccountingNotification(paymentData, edpPayment);
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Webhook error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
});

function generatePaymentBlock(paymentData) {
    const nameParts = paymentData.cardholderName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    let edp = '---- Start Payment ----\n';
    edp += `date_Payment>> ${formatDate(paymentData.paymentDate)}\n`;
    edp += `cur_Payment>> ${paymentData.amount}\n`;
    edp += `PaymentType>> Stripe Credit Card\n`;
    edp += `PaymentNumber>> ${paymentData.chargeID}\n`;
    edp += `Card_Name_First>> ${firstName}\n`;
    edp += `Card_Name_Last>> ${lastName}\n`;
    edp += `Card_Exp_Date>> \n`;  // BLANK for security
    edp += `Notes>> Stripe payment for Quote ${paymentData.quoteID}. Card: ${paymentData.cardBrand} ****${paymentData.last4}. Customer: ${paymentData.customerEmail}\n`;
    edp += '---- End Payment ----\n\n';

    return edp;
}
```

---

## Related Files

- **Overview & Navigation:** [SHOPWORKS_EDP_INTEGRATION.md](../SHOPWORKS_EDP_INTEGRATION.md)
- **Order Block:** [ORDER_BLOCK.md](ORDER_BLOCK.md)
- **Customer Block:** [CUSTOMER_BLOCK.md](CUSTOMER_BLOCK.md)
- **Contact Block:** [CONTACT_BLOCK.md](CONTACT_BLOCK.md)
- **Design Block:** [DESIGN_BLOCK.md](DESIGN_BLOCK.md)
- **Product Block:** [PRODUCT_BLOCK.md](PRODUCT_BLOCK.md) - CRITICAL for CATALOG_COLOR

---

**Last Updated:** 2025-10-26
**Version:** OnSite 7
**Status:** Ready for future implementation
