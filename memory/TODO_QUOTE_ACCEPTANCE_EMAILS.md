# TODO: Quote Acceptance Email Notifications

**Created:** 2026-01-15
**Status:** ✅ LIVE (2026-07-04, deploy v2026.07.04.6) — both EmailJS templates created; emails send on accept.
**Priority:** Done (one OPTIONAL follow-up: the 3 Caspio audit fields)

> ⚠️ **EmailJS Template IDs are capped at 24 characters.** `template_quote_accepted_staff` (29
> chars) got silently truncated to `template_quote_accepted_` when typed into the EmailJS editor.
> The staff template therefore uses the short id **`quote_accepted_staff`** (20 chars). The customer
> id `template_quote_accepted_customer` (32) only survived because it was set programmatically
> (bypassing the input's maxlength). **When creating any new EmailJS template, keep the id ≤ 24 chars.**
> Both ids are hardcoded in `server.js:884-885` (`QUOTE_ACCEPTED_CUSTOMER_TEMPLATE` /
> `QUOTE_ACCEPTED_STAFF_TEMPLATE`).

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
2. **EmailJS** — ✅ DONE. Both templates exist with these ids + param names:
   - `template_quote_accepted_customer` — `{{to_name}}`, `{{to_email}}` (To field),
     `{{quote_id}}`, `{{quote_amount}}`
   - `quote_accepted_staff` (short id — see 24-char cap note above) — `{{to_email}}` (To field),
     `{{quote_id}}`, `{{customer_name}}`, `{{customer_email}}`, `{{company_name}}`, `{{quote_amount}}`, `{{quote_url}}`
3. ✅ Templates exist + `server.js:885` deployed (v2026.07.04.6) — emails send automatically on
   accept. (Optional not-yet-done: add "a confirmation email is on its way" to the accept success
   modal in `pages/js/quote-view.js`.)

---

## Related

- Quote dashboard exists at: `/dashboards/quote-management.html`
- Acceptance endpoint: `POST /api/public/quote/:quoteId/accept`
- EmailJS service ID: `service_1c4k67j`
- EmailJS public key: `4qSbDO-SQs19TbP80`
