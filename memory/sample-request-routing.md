# Sample requests → Leads

**Diagnosed + BUILT 2026-08-10. NOT DEPLOYED YET** (Erik's call). Traced from a real request:
`NWCA-SAMPLE-0808-1-480`, Cory Kelly / Inland Beef Company, submitted Sat 8 Aug, imported by
Erik as **ShopWorks order 142752**. That one was added to Leads BY HAND — deliberately, so the
first run of the new code path is a fresh request nobody has to un-break.

## What was wrong

🔴 **A FREE sample request was EMAIL-ONLY.** It wrote NO Caspio row of any kind, so it could
never appear in Leads, Quote Management, or any other dashboard. Its only durable record was
the ShopWorks order. Every free sample request since the flow shipped had the same fate.

The free branch of [pages/sample-cart.html](../pages/sample-cart.html) (handler
`pages/js/sample-cart-page.js:451`, forks at `:561` — paid goes to Stripe) did exactly this:

| Step | Where | Durable? |
|---|---|---|
| Mint `SAMPLE-MMDD-seq-ms` | `shared_components/js/sample-order-service.js:55` | localStorage only |
| POST order to ShopWorks | `sample-order-service.js:430` → `server.js:3682` → `proxy:src/routes/manageorders-push.js:63` | ✅ ShopWorks order |
| EmailJS #1 `template_wjxuice` → erik@ hardcoded | `sample-order-service.js:491` | ❌ email only |
| EmailJS #2 `template_sample_request` | `sample-cart-page.js:629` | ❌ email only |

- `NWCA-` prefix is added **server-side** on successful push: `proxy:config/manageorders-push-config.js:242`.
- 🔑 **Two staff emails fire per request.** #2 is the one carrying the contact block + samples list.
- 🔑 **#2's recipient is NOT in either repo** — its payload has no `to_email`/subject/reply-to.
  To/CC/BCC live in the **EmailJS dashboard**, so changing who gets it needs no deploy.
- 🔴 Both sends are fire-and-forget with swallowed errors. If EmailJS is down the customer sees
  success, the order exists, and nobody is told. That failure mode still exists.

## Why Leads couldn't see it

Leads (`/dashboards/leads.html`) reads **exactly one Caspio table, `Form_Submissions`**
(`proxy:src/routes/form-submissions.js:29`, via SAML forwarder `server.js:4008`), filtered to a
hard-coded list of lead Form_IDs. Only two writers exist: public `POST /api/form-submissions`
and the JotForm webhook. The cart called **neither** — its only backend call creates the
ShopWorks order, and that route writes nothing to Caspio.

⚠️ One sample↔Leads thread already existed but runs the **wrong direction**:
`finishSampleLeadHandoff()` (`sample-cart-page.js:698`) appends a `Lead_Activity` note when an AE
started the order from the Leads board. It **annotates an existing lead, never creates one**, and
is `requireStaff` so a customer tab 401s.

## The fix (built, not deployed)

New `sample-request` formId. `createSampleLead()` in `pages/js/sample-cart-page.js` POSTs to the
already-public `POST /api/form-submissions` after the ShopWorks push, which buys **AE auto-assign**
(customer email → their rep, else **Taneisha Clark**, `proxy:src/utils/jotform.js:45`), the rep's
"new lead" email, and the Slack lead card — no new endpoint.

### 🔴 The form-ID vocabulary lives in 12 places across 2 repos

Miss one and the row saves but stays invisible. This list is the whole checklist:

**Proxy** (deploy FIRST — `validateSubmission` 400s an unknown formId)
1. `src/utils/form-submission-helpers.js` — `FORM_PREFIX` (`SRQ`; **`SAM` is a quote prefix**, hence SRQ)
2. `src/utils/form-submission-helpers.js` — `DEFAULT_STATUS`
3. `src/utils/form-submission-helpers.js` — `LEAD_NOTIFY_FORMS`
4. `src/routes/form-submissions.js` — `DELETABLE_FORM_IDS`
5. `src/routes/form-submissions.js` — `IN_APP_SOURCE_TITLES`
6. `src/routes/ae-dashboard.js` — `LEAD_FORM_IDS`
7. `src/utils/lead-classify-ai.js` — `LEAD_FORM_IDS`
8. `src/utils/lead-conversion.js` — `LEAD_FORM_IDS`
9. `src/utils/lead-followup-digest.js` — `LEAD_FORM_IDS` **+ `SOURCE_LABELS`**
10. `src/utils/slack-form-lead-notify.js` — `FORM_LABELS` **+ `LEADS_BOARD_FORMS`** (new: routes the
    card to the Leads board instead of the Forms Inbox; existing forms unchanged)

**App**
11. `dashboards/js/leads-common.js` — `LEAD_FORM_IDS`, `SOURCE_META`, `STATUS_CHOICES`, `DRAG_STATUS`
12. `dashboards/js/form-submissions.js` — `FORM_META` **and `STATUS_CHOICES`**, plus
    `dashboards/css/form-submissions.css` `.badge--srq`

Also changed: `dashboards/js/leads.js` Source dropdown (now **derived** from `LEAD_FORM_IDS`
instead of a re-typed literal), `pages/sample-cart.html` (+`/config/app.config.js` script tag).

### Three traps this hit (all caught by adversarial review, none by tests)

- 🔴 **A missing map entry becomes a WRONG DEFAULT, not an error.** No `STATUS_CHOICES` entry in
  the Forms Inbox → falls back to `['New','Completed']`, and **`Completed` is a WON status**
  (`leads-common.js:40,50`) → closing the lead banks a $0 win and drops it from the digest.
  *(The same gap existed for `manual-lead` and was closed in passing.)*
- 🔴 **`House` is the dropdown DEFAULT, not a rep**, and isn't in the Leads rep list. Sending it
  satisfies the server's "rep already set" check (`form-submissions.js:166` only fills blanks),
  suppresses auto-assign, and leaves the lead owned by nobody. Send `''`.
- 🔑 **A payload only "saves" if a renderer knows its shape.** The Inbox renders only
  `fields`/`checks`/`tables`/`notes`; a bespoke object stores fine and shows a **blank modal**.

## Deploy

**PROXY FIRST, then app.** App-first means every sample lead silently degrades to the old
email-only behaviour for the length of the window (order still pushes, both emails still fire,
`createSampleLead` swallows the 400 by design).

🔴 **`/deploy` must cache-bust three STAFF assets** — `dashboards/leads.html` and
`dashboards/form-submissions.html` are **not** in `lib/hashed-pages.js`, so without a `?v=` bump
reps keep the old JS and none of this appears: `leads-common.js` (referenced by `leads.html` +
`lead.html`), `dashboards/js/form-submissions.js`, `dashboards/css/form-submissions.css`.
`pages/sample-cart.html` **is** hashed, so its `?v=` bump is harmless but redundant.

## Verify on the first REAL request (nothing here is proven live)

1. 🔴 **Does Caspio `Form_Submissions.Form_ID` accept a new value?** Strong indirect evidence yes:
   `manual-lead` was added in a **code-only commit** (proxy `e6feff6`, Jul 18) with no schema
   change. But if that column has a value list, the row saves invisible. **First real request:
   confirm an `SRQ…` card on `/dashboards/leads.html`.**
2. A lead POST failure logs to the **customer's** browser console — nobody sees it. Worst case is
   today's behaviour (both emails still fire), so it degrades, it doesn't lose data.
3. **Auto-assign will mostly NOT match, and that is fine.** `assignLead` resolves via
   `CompanyContactsMerge2026` by email; sample requesters tend to use consumer domains, so most
   fall to the **Taneisha default** (`proxy:src/utils/jotform.js:45` `DEFAULT_LEAD_REP`).
   ✅ **Erik confirmed 2026-08-10: Taneisha IS the intended catch-all** — no code change; a
   customer who matches an existing contact still routes to their own rep.
4. Slack/rep email only fire if `SLACK_FORM_LEADS_WEBHOOK_URL` is set — `notifyFormLead` is a
   silent no-op otherwise. Watch the proxy logs on the first one.
5. The 06:30 PT AI classifier now sees these rows — check `/dashboards/unqualified-leads.html`
   in week 1 that sample requests aren't being auto-archived.

## Still open / out of scope

- **Paid (Stripe) sample carts create no lead** — they return early at `sample-cart-page.js:561`
  and get a `SAM` `quote_sessions` row instead (visible in Quote Management). Erik's call whether
  they should also produce a Leads card.
- **No dedupe** — an existing lead who then orders samples gets a second card. Matches the other forms.
- **"Sample Follow-ups" widget** (`orders-inbox-controller.js:252-306`) is unchanged and still a
  post-sale call list: matcher is right (`po.startsWith('SAMPLE-')`) but it filters `date_Invoiced`.
  Two live bugs in it: renders `s.Contact_Name` which ManageOrders doesn't have (permanently blank),
  and keys customers on `CustomerName` while every web sample lands on **catch-all customer 2791**,
  so one unrelated web order can hide the whole list.

## Decoys — do not chase

- **Forms Inbox "Samples" tab** = `Form_ID: 'sample-checkout'`, the staff front-counter **loaner**
  tracker (`Sample_Checkout_Items`). Different thing.
- **`dashboards/bundle-orders-dashboard.html`** "Sample Requests" table filters QuoteID prefixes
  `SR`/`XMAS`/`BCA` — prefixes this flow never mints, linked from no nav menu.

See also [[LESSONS_LEARNED]].
