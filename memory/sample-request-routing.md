# Sample requests — where they go, and why Leads never sees them

**Established 2026-08-10** by tracing a real request end-to-end
(`NWCA-SAMPLE-0808-1-480`, Cory Kelly / Inland Beef Company, submitted Sat 8 Aug).
Diagnosis only — **nothing has been changed yet.**

## The one-line fact

🔴 **A FREE sample request is email-only. It writes NO Caspio row of any kind, so it can
never appear in Leads, Quote Management, or any other dashboard surface.** Its only durable
record is the ShopWorks order created by the ManageOrders push.

## The flow (free branch)

One customer-facing form: [pages/sample-cart.html:179](../pages/sample-cart.html) →
handler [pages/js/sample-cart-page.js:451](../pages/js/sample-cart-page.js). It forks at
`sample-cart-page.js:561` — **paid** (any blank cost ≥ $10, `shared_components/js/sample-pricing.js:28`)
goes to Stripe; **free** does this and only this:

| Step | Where | Durable? |
|---|---|---|
| Mint `SAMPLE-MMDD-seq-ms` | `shared_components/js/sample-order-service.js:55` | localStorage only |
| POST order to ShopWorks | `sample-order-service.js:430` → `server.js:3682` → `proxy:src/routes/manageorders-push.js:63` | ✅ ShopWorks order |
| EmailJS #1 `template_wjxuice` → erik@ hardcoded | `sample-order-service.js:491`, sent :501 | ❌ email only |
| EmailJS #2 `template_sample_request` | `sample-cart-page.js:629` | ❌ email only |

- `NWCA-` prefix is added **server-side** on successful push: `proxy:config/manageorders-push-config.js:242`.
- 🔑 **Two staff emails fire per free request, not one.** #2 is the one with the contact
  block + "Samples requested" list (built at `sample-cart-page.js:618-624`).
- 🔑 **#2's recipient is NOT in either repo** — its payload has no `to_email`/subject/reply-to.
  To/CC/BCC live in the **EmailJS dashboard**. Changing who gets it = a dashboard edit, no deploy.
- 🔴 Both sends are fire-and-forget with swallowed errors (`sample-cart-page.js:630-632`,
  `sample-order-service.js:509-512`). If EmailJS is down the customer still sees success, the
  ShopWorks order still exists, and **nobody is told anything.** Silent worst case.

## Why Leads can't see it

Leads = `/dashboards/leads.html`, and it reads **exactly one Caspio table, `Form_Submissions`**
(`proxy:src/routes/form-submissions.js:29`, via SAML forwarder `server.js:4008`), filtered to
five Form_IDs in `dashboards/js/leads-common.js:18`:
`jotform-lead · quote-request · webstore-request · team-roster · manual-lead`.
Only two writers exist: public `POST /api/form-submissions` and the JotForm webhook. **The
sample cart calls neither** — its only backend call is `/api/manageorders/orders/create`, and
that route writes nothing to Caspio.

⚠️ One sample↔Leads thread exists but runs the **wrong direction**: `finishSampleLeadHandoff()`
(`sample-cart-page.js:698-714`) appends a `Lead_Activity` note when an AE started the order
from the Leads board (localStorage `nwca-sample-prefill` stash). It **annotates an existing
lead, never creates one**, and is `requireStaff` (`server.js:4022`) so a customer tab 401s.

## The near-miss widget

Dashboard home has **"Sample Follow-ups"** (`staff-dashboard-v3/index.html:852-861`, controller
`shared_components/js/staff-dashboard/controllers/orders-inbox-controller.js:252-306`).
Its matcher is right (`po.startsWith('SAMPLE-')` at :242 — the push does set
`CustomerPurchaseOrder`). 🔴 **It filters on `date_Invoiced`** (:258-259, re-filtered :275-277),
so `'' >= cutoff` is false for an uninvoiced order. **It is a post-sale call list, not an inbox.**
All three ManageOrders-reading dashboard services use the same invoiced window
(`shopworks-service.js:104-105`, `staff-dashboard-service.js:216-217`) — **no dashboard surface
reads uninvoiced ShopWorks orders at all.**

Two live bugs in that widget (code-level, not verified against a live response):
- `:299-300` renders `s.Contact_Name`, which the ManageOrders pull model doesn't have (it has
  `ContactFirstName`/`ContactLastName`) → **contact subline permanently blank.**
- `:247-250` keys customers on `o.CustomerName`, but every web sample lands on ShopWorks
  **catch-all customer 2791** (`proxy:config/manageorders-push-config.js:15`), so all web
  samples collapse to one key and the "ordered since?" suppression at :285-289 lets **one
  unrelated web order hide the whole list.**

## Rep assignment: none

The cart's "Sales representative" dropdown (`pages/sample-cart.html:205-211`, incl. Taneisha,
default **House**) feeds exactly one field: `salesRep` → ShopWorks `CustomerServiceRep`
(`sample-order-service.js:322` → `proxy:lib/manageorders-push-client.js:129`). **No routing,
no email, no CRM.** By contrast `POST /api/form-submissions` auto-assigns the AE (customer
email → their rep, else **Taneisha Clark** default), emails that rep, and posts a Slack card
(`proxy:src/routes/form-submissions.js:136-185`). **All that machinery exists; the cart never
calls it.**

## Fix options (none applied)

- **A — cheapest, no backend change.** After the push in `sample-cart-page.js` (~:606) add one
  non-blocking `fetch` to the already-public `POST {proxyBase}/api/form-submissions` with
  `formId: 'quote-request'` (or `manual-lead`). Buys the Leads row + AE auto-assign + rep email
  + Slack card free. ⚠️ No same-origin forwarder exists for that POST — hit the proxy base
  directly like the other public forms. Must never break a submitted order on failure.
- **B — a real `sample-request` source.** `LEAD_FORM_IDS` is duplicated in **five** places
  (proxy: `form-submission-helpers.js:7,30,57`, `form-submissions.js:154`, `ae-dashboard.js:46`,
  `lead-classify-ai.js:19`, `lead-conversion.js:21`, `lead-followup-digest.js:29`; app:
  `leads-common.js:18,20,29,50`, `form-submissions.js:18`). Miss one and the row saves invisible.
  **Deploy proxy first** (`validateSubmission` rejects unknown formIds).
- **C — 5-min stopgap, zero deploy.** Add taneisha@ to To/CC of `template_sample_request` in the
  **EmailJS dashboard**. (Email #1 is hardcoded and would need a deploy.)

## Decoys — do not chase

- **Forms Inbox "Samples" tab** = `Form_ID: 'sample-checkout'`, the staff front-counter
  **loaner-sample tracker** (`Sample_Checkout_Items`). Different thing entirely.
- **`dashboards/bundle-orders-dashboard.html`** has a "Sample Requests" table filtering QuoteID
  prefixes `SR`/`XMAS`/`BCA` (`dashboards/bundle-orders.js:165`) — prefixes this flow never
  mints, and it's linked from no nav menu.
- **Ctrl+K** searches `ORDER_ODBC` by numeric `ID_Order` or `CompanyName`; catch-all customer
  2791 means the company name isn't the customer's.

## Backwards, and worth knowing

**Paid** samples DO persist — `server.js:8722-8735` saves a `quote_sessions` row (SAM prefix)
fail-closed before Stripe, and Quote Management shows all quote_sessions with no prefix
whitelist. So **paid samples are visible and free samples are not** — the opposite of what you
want, since the free sample is the one needing a follow-up call.

**Every free sample request since this flow shipped has the same fate.** How many is unknown
(no one queried ShopWorks).

## Unknowns (stated, not guessed)

- Whether `NWCA-SAMPLE-0808-1-480` actually landed in OnSite (code proves a successful push
  response, not the import).
- Who else is on To/CC/BCC of `template_sample_request` (EmailJS dashboard).
- Which rep, if any, Cory Kelly picked.

See also [[LESSONS_LEARNED]], `memory/SHOPWORKS_ODBC_INTEGRATION.md`.
