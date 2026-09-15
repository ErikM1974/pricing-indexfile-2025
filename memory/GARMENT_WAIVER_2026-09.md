# Customer-Supplied Garment Liability Waiver — e-signature (2026-09-15)

Erik 2026-09-15: "a customer brings in garments they bought at Costco and all they want us to do is logo
them, but we don't want to be responsible if we have a needle break or doing an expensive $400 jacket
and have to replace it … have it so we can send a link and the customer can electronically sign it … have
it on our forms site … should the sales rep be able to press an email customer button right from the form
and it emails the form to them, maybe use email.js."

## Status

**LIVE 2026-09-15**: proxy v2026.09.15.1 (`7869c82`) then app v2026.09.15.7 (`0216ca93`, Heroku v2124).
Forms_Library row PK 120 (`garment-liability-waiver`, Customer Intake) added through the admin forwarder.
First live send: staff panel emailed a link to erik@ (EmailJS history: OK via the Outlook service, 3:45 PM).
First live signature: **GLW0915-4943** (Erik, order TEST-WAIVER, 9/15/2026 3:54 PM PT) — copy + rep notice sent; archive it in the Inbox.

## What shipped

| Piece | Where | Notes |
|---|---|---|
| Customer e-sign page | `pages/forms/garment-liability-waiver.html` (+ `.css`, `.js`) | printable-forms family; 10 clauses + e-sign consent, typed name (signature of record), optional drawn signature (canvas), consent box, Sign. Prints as a paper waiver too. |
| Staff send panel | same page, shown only with a staff cookie (`/api/crm-session/me`) | fill the customer's details → **Email customer** (server sends) or **Copy link**. Link shape `?c=&n=&e=&p=&o=&g=&q=&r=&re=&m=` (company, name, email, phone, order, garments, count, rep, rep email, methods `emb,scr,dtf,las,pat`). |
| Record | Caspio `Form_Submissions`, `Form_ID = garment-waiver`, prefix **GLW**, default status **Signed** | proxy `src/utils/form-submission-helpers.js` (`SIGNED_FORMS` + `withSignatureAudit`) stamps `payload.audit = { ip, userAgent, receivedAt }` server-side. |
| Forms Inbox | `dashboards/form-submissions.html` + `js/form-submissions.js` | "Waivers" chip, `badge--wvr`, statuses `Signed → Attached to Order → Archived` (never `Completed` — a WON status on the lead boards). Detail shows the e-signature block + the drawn PNG (only a validated `data:image/png;base64` URL ≤ 60 KB is ever rendered). |
| Emails | `routes/garment-waiver.js` (main app) | `POST /api/garment-waiver/send-link` (staff): server builds the link from validated fields and sends EmailJS **`template_garment_waiver`** (params `to_email, reply_to, subject, customer_name, rep_name, rep_email, message_html`). `POST /api/garment-waiver/signed` (public, 10/h/IP): re-reads the row through the proxy with the CRM secret, refuses unless `Form_ID = garment-waiver` AND stored Email matches, then customer copy + rep notice (rep = `repEmail` if `@nwcustomapparel.com`, else sales@). One send per id per dyno. Override template with `EMAILJS_TEMPLATE_GARMENT_WAIVER`. |
| Forms Library | Caspio `Forms_Library` row (Customer Intake), `Form_ID = garment-liability-waiver` | `Fill_Online_URL = /pages/forms/garment-liability-waiver.html`, `PDF_URL = /forms/customer-supplied-garment-liability-waiver.pdf` (blank, 2 pages, regenerate with the print CSS when the wording changes). Added through the admin-only `/api/crm-proxy/forms-library` forwarder from a signed-in browser. |

## Evidence stored per signature (`Payload_JSON`)

`payload.signature`: `typedName`, `drawn` (PNG data URL, ≤ 30,000 chars, stepped down 600×180 → 300×90 or
omitted), `signedAt` (ISO UTC), `signedAtPacific` (text), `timeZone`, `waiverVersion` (`2026-09-15`),
`textSha256` (SHA-256 of the exact waiver text shown, via `crypto.subtle`), `userAgent`, `screen`,
`repEmail`. `payload.notes` carries the full waiver text as signed and the garment description;
`payload.audit` is the proxy's server-side stamp. The wording lives in the HTML — **bump
`WAIVER_VERSION` in the JS and the "Waiver version" line in the HTML together** whenever a clause changes
(the unit test `tests/unit/garment-liability-waiver.test.js` locks them equal).

## Wording provenance

Clauses honour the May 26 2026 `forms/Customer-Supplied-Garments-Acknowledgment.pdf` terms exactly:
liability capped at the decoration charge (no replacement / refund of the garment), 3% misprint
allowance, 7-day recourse window from pickup, pre-existing-condition notes/photos, receiving count is the
count of record, extras recommended, clean garments, Washington law. Methods offered exclude DTG (Erik
2026-09-07: no customer-supplied DTG). E-sign consent cites the federal ESIGN Act and Washington's UETA
without section numbers. Drafted by a three-lens draft/judge/synthesis workflow. ⚠️ Not legal advice —
Erik should have counsel skim it once; the Policies Hub "Customer-Supplied Garments Policy" (Customer
Service) is the source of the numbers and should be kept in step.

## Decisions from the adversarial review (2026-09-15)

- **Emails never echo customer-typed text.** The waiver row is created by an anonymous POST, so its text is untrusted; the customer copy carries reference + name + server receipt time + a link to the wording, the rep notice points at the Inbox. `/signed` also demands a row younger than 20 min, so an old row cannot be turned into a mailing.
- **Wording integrity:** the proxy hashes the stored text (`audit.textSha256`); `/signed` compares it with `pages/forms/garment-liability-waiver.txt` and the rep notice says "Check the record" on a mismatch (never blocks the customer). The Inbox labels server-observed rows apart from device-reported ones.
- **A GLW row is only accepted with a typed name + consent** (proxy `validateSubmission`), and the signer identity fields of a signed row are immutable through the Inbox PUT.
- **No localStorage draft** on the customer page (shared tablets); a `/signed` 404 unlocks the form and says the signature was not recorded (honeypot fake-success shape).
- **Email is required to sign** (the consent clause promises an electronic copy); at the counter the rep types the customer's email. Known limits, accepted for v1: the link carries the prefill in the query string (PII in URL/logs); nothing records that a link was SENT or stops a customer signing twice; the customer copy relies on the page's follow-up call (no retry). Follow-ups: a "Resend copy" button in the Inbox, a "link sent" record, one-time links.

## Gotchas

- 🔑 The customer page POSTs straight to the proxy (`APP_CONFIG.API.BASE_URL`), so the **proxy must be
  deployed before the app** — otherwise every sign attempt 400s with "formId must be one of …".
- 🔑 Delivery proof = EmailJS **Email History** (dashboard.emailjs.com/admin/history): the server sends through the
  `service_1c4k67j` **Outlook** service, so the mail lands in the M365 mailbox — the Gmail connector never sees it.
- 🔑 EmailJS from Heroku only: `api.emailjs.com` is unreachable from the LAN, so the send-link / signed
  routes can only be proven live (`heroku logs` show `[garment-waiver] link emailed …`).
- 🔑 A rep opening the page also gets the staff panel; that is fine for counter signing on a tablet.
- ⏭️ Optional follow-ups: a "Resend copy" button in the Inbox detail; attaching the GLW reference to the
  ShopWorks order note automatically; a Slack ping when a waiver is signed.
