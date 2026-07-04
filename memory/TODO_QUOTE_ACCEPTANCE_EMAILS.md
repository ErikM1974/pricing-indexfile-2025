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

## Code status — DONE (2026-07-04)

The server code is built and shipped fail-soft in `POST /api/public/quote/:quoteId/accept`
(`server.js`), so it is safe to run BEFORE the manual steps below — it just skips whatever
isn't set up yet:

- `sendQuoteAcceptedEmails(session, name, email)` fires both emails fire-and-forget after a
  successful accept. Missing EmailJS keys OR a not-yet-created template → warn + skip, never
  throws. Customer receipt → the accepting email; rep alert → `session.SalesRepEmail`
  (fallback `sales@nwcustomapparel.com`).
- Dedicated columns are written ONLY when env `QUOTE_ACCEPT_FIELDS_LIVE=1`; the acceptance
  data is ALSO always stored in Notes JSON, so nothing is lost if the flag is off.

### To turn it on (Erik):
1. **Caspio** — add the 3 `quote_sessions` fields (table above), then
   `heroku config:set QUOTE_ACCEPT_FIELDS_LIVE=1 --app sanmar-inventory-app`. Optional —
   Notes JSON still captures acceptance without it.
2. **EmailJS** — create the 2 templates with EXACTLY these ids + param names:
   - `template_quote_accepted_customer` — `{{to_name}}`, `{{to_email}}` (To field),
     `{{quote_id}}`, `{{quote_amount}}`
   - `template_quote_accepted_staff` — `{{to_email}}` (To field), `{{quote_id}}`,
     `{{customer_name}}`, `{{customer_email}}`, `{{company_name}}`, `{{quote_amount}}`, `{{quote_url}}`
3. Once the templates exist, emails send automatically on the next acceptance — no deploy.
   (Optional: add "a confirmation email is on its way" to the accept success modal in
   `pages/js/quote-view.js` — held until templates are confirmed so we don't promise an
   email that won't arrive.)

---

## Related

- Quote dashboard exists at: `/dashboards/quote-management.html`
- Acceptance endpoint: `POST /api/public/quote/:quoteId/accept`
- EmailJS service ID: `service_1c4k67j`
- EmailJS public key: `4qSbDO-SQs19TbP80`
