# TODO: Quote Acceptance Email Notifications

**Created:** 2026-01-15
**Status:** Waiting for manual steps
**Priority:** Medium

---

## Summary

When a customer accepts a quote, we want to:
1. Send confirmation email to customer
2. Send alert email to sales rep
3. Store acceptance data in dedicated Caspio fields (not Notes JSON)

---

## Manual Steps Required (Erik)

### Step 1: Add Caspio Fields

Add these fields to `quote_sessions` table in Caspio:

| Field Name | Type | Description |
|------------|------|-------------|
| `AcceptedAt` | Date/Time | When quote was accepted |
| `AcceptedByName` | Text (255) | Customer name who accepted |
| `AcceptedByEmail` | Text (255) | Customer email who accepted |

### Step 2: Create EmailJS Templates

Go to emailjs.com and create 2 templates:

#### Template 1: `template_quote_accepted_customer`
```
Subject: Quote {{quote_id}} Accepted - Northwest Custom Apparel

Hi {{to_name}},

Thank you for accepting your quote!

Quote Details:
- Quote ID: {{quote_id}}
- Amount: ${{quote_amount}}

What's Next:
A member of our team will reach out shortly to discuss next steps and collect a deposit.

Questions? Call us at (253) 922-5793

Thank you for your business!
Northwest Custom Apparel
```

#### Template 2: `template_quote_accepted_staff`
```
Subject: 🎉 Quote Accepted: {{quote_id}} by {{customer_name}}

A customer has accepted their quote!

Quote ID: {{quote_id}}
Customer: {{customer_name}}
Email: {{customer_email}}
Company: {{company_name}}
Amount: ${{quote_amount}}

View Quote: {{quote_url}}

Next Steps:
- Contact customer to collect deposit
- Create order in ShopWorks
```

---

## After Manual Steps - Claude Will Update

Once the above is done, tell Claude to:
1. Update `server.js` acceptance endpoint to use dedicated fields
2. Add EmailJS calls to send both notification emails

**File to modify:** `server.js` (lines ~2645-2685)

---

## Related

- Quote dashboard exists at: `/dashboards/quote-management.html`
- Acceptance endpoint: `POST /api/public/quote/:quoteId/accept`
- EmailJS service ID: `service_1c4k67j`
- EmailJS public key: `4qSbDO-SQs19TbP80`
