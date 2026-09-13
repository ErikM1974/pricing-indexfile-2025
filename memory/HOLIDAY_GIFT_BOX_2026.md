# Holiday Gift Box 2026

## Release status — 2026-09-13

Implementation is locally verified on develop. Erik approved $9 packaging, $25 shipping and free factory pickup on September 13. The live Service_Codes and invitation hash are now configured; website release v2026.09.13.4 is being prepared. The old website remains live until exact-commit CI, deployment and live verification finish.

## Business decisions

- Public customers may request **one box at the embroidery eight-piece tier**; no eight-box minimum.
- Paid requests include $9 packaging and $25 shipping, or $0 shipping for factory pickup. Read current charges from Service_Codes; do not hardcode these values into the page.
- Invited customers use **one shared reusable gift code**. A valid invitation makes the entire box and shipping complimentary.
- Campaign closes after **October 15, 2026, Pacific**: exclusive close is `2026-10-16T00:00:00-07:00`.
- Feature the collection on the main catalog. Hide its promotion automatically after the close.
- Customers choose a jacket, hoodie, beanie and gloves, supply company/contact and delivery details, and may upload a logo and share their holiday team size/date.
- This is a **request for staff review**, with no checkout payment or automatic production push. Staff confirms artwork, stock, delivery, tax and any additional artwork charge, then creates the final normal quote/invoice.

## Where incoming requests go

Requests enter the existing Caspio Quote_Sessions and Quote_Items through the app's dedicated server route. The identifier starts `XMAS-`; ProjectName is `Holiday Gift Box 2026`.

The staff Quotes list recognizes the holiday type; search for "Holiday Gift Box 2026" to find these requests. Company Numbers' Orders Inbox includes Open and Draft holiday requests in its review list. Open priced requests, complimentary samples and incomplete Draft saves have distinct labels. Draft saves cannot be manually promoted from the list; the server verifies all saved items first. Open means the complete request was recorded, not accepted or paid. Both staff lists include shipping in the displayed request estimate.

The customer gets a tokenized `/quote/XMAS-...?k=...` request-summary link. The receipt includes selected products/sizes, box and shipping charges, invitation discount, contact/delivery details, customization notes and uploaded logo access. Direct `/invoice/` links redirect to this same request receipt and preserve its share token, so an unreviewed request never shows invoice payment instructions. Existing acceptance, deposit enabling, deposit checkout and legacy payment-intent paths reject these request records. Staff uses the usual builder to create the final quote; changing this request's status does not turn it into a payable order.

## Product changes — one owner for Astra or Claude

Edit `config/christmas-campaign.json`. Keep its category keys; change a product's style, brand, name, summary, preferred color and excluded colors there. The page and server load that same campaign file. There is no separate staff product editor.

Before shipping a swap, verify the new style's real catalog colors, inventory and every offered size's current price. Test the configured preferred color and at least one alternate. Do not place prices or gift codes in this file. Read `shared_components/css/NWCA-2026-GUIDE.md#creating-or-changing-a-page` before changing markup/styles.

## Inventory and pricing

- Actual stock: `/api/sanmar/inventory/:style?color=CATALOG_COLOR`. Display COLOR_NAME; query with CATALOG_COLOR. The older supported-size endpoint contains placeholder zeros and must not determine stock.
- Missing/wrong-color/malformed/conflicting duplicate inventory is unknown, not sold out. Real zero is unavailable. The page exposes a retry and the server verifies stock again before creating the request. This is an availability check, not an inventory reservation.
- `lib/christmas-pricing.js` uses the real EmbroideryPricingCalculator at quantity eight, with current pricing-bundle tiers, margin, stitch cost, rounding and exact color/size cost/upcharge data. The order quantity remains one of each garment. Gloves are undecorated; their selling price uses the same tier's garment margin without embroidery cost.
- Box and delivery fees come from active FLAT Service_Codes `XMAS-BOX` and `XMAS-SHIP`. Both must exist, including an explicit zero if included. Pickup shipping is zero. Missing or ambiguous fee data fails visibly; no guessed price is offered.
- Live fees configured and read back September 13: XMAS-BOX (PK 308), $9; XMAS-SHIP (PK 309), $25. Both active FLAT rows, hidden from unrelated quote-builder rails. This follows Erik's explicit approval, not the old advertised values.
- Twenty-eight independently captured CT104670 color/size examples check exact parity with the real eight-piece calculator. Fixture prices elsewhere are synthetic test inputs.

## Shared code and request persistence

`CHRISTMAS_GIFT_CODE_SHA256` is configured on the app as the SHA-256 hex digest of the trimmed, uppercase invitation code. The secret signing key is existing SESSION_SECRET. The private invitation handoff is saved outside the repository in the working checkpoint directory, restricted to Erik's Windows account. Keep plaintext out of source, browser assets, logs and documentation. Give Erik the private file at release. Rotating its hash invalidates existing invitation grants.

The server issues a 30-minute invitation grant and a 10-minute estimate, bounded by campaign close. Client totals and a client `complimentary` flag are ignored. Selections, delivery method, invitation and current prices must match when a new request is saved.

The browser captures a UUID and exact request body in sessionStorage; retries and reload recovery keep that reference. A confirmed session starts Draft, writes/checks the four garment lines plus box and SHIP fee lines, and becomes Open only after all six are confirmed. A changed payload or conflicting stored lines requires review. Pre-save errors permit correction; uncertain writes retain the captured request.

The route returns a pending response after 15 seconds to stay inside Heroku's request window. The browser polls using the same body/key. An in-process map joins duplicate attempts, while confirmed database stages allow restart recovery. **Caspio IDs are not unique constraints:** simultaneous requests on separate dynos are not an exactly-once guarantee. A database uniqueness constraint or durable distributed lock is needed before claiming that guarantee or scaling concurrent writers. Duplicate rows are detected and flagged for staff review.

## Confirmation emails

Saved provider templates, created September 13 without sending messages:

| Template | Recipient | Reply-to |
| --- | --- | --- |
| `holiday_box_customer` — Holiday Gift Box 2026 — Customer | `{{to_email}}` | sales@nwcustomapparel.com |
| `holiday_box_sales` — Holiday Gift Box 2026 — Sales | sales@nwcustomapparel.com | `{{customer_email}}` |

Server uses the existing `sendEmailJSTemplate` helper, service `service_1c4k67j`, and existing EMAILJS_PUBLIC_KEY / EMAILJS_PRIVATE_KEY. Do not substitute a different service from an unrelated environment variable. No holiday EmailJS browser SDK remains.

Local sources are `email-templates/holiday-box-customer.html` and `email-templates/holiday-box-sales.html`; compile with `npm run build:emails`, verify with `npm run check:emails`. They share canonical email-theme styles. Deploying the repository does not update EmailJS; apply later template content changes explicitly to the saved provider copies.

Bindings: customer_name, company_name, request_id, request_url, request_type, amount_label, items_html, delivery_details, planning_details, customer_email, customer_phone and to_email. Ordinary variables are escaped by EmailJS; only items_html is intentionally raw HTML, built from server-escaped product data.

Email intent is saved before sending. Provider acknowledgement is recorded separately for customer and sales. Confirmed rejection is retryable; a timeout or uncertain marker save does not automatically resend. The customer still receives the saved request reference if email fails. Provider acceptance is not proof of inbox delivery. No real test emails or customer orders have been sent during this implementation; actual mail-client delivery is unverified.

## Verification and remaining release work

Full local unit/DOM/accessibility suite: 271 suites, 6,372 passing tests, four skipped, September 13. Lint and type checking pass at the same code state.

Owners: seasonal-christmas-orders unit suite; seasonal-christmas-behavior browser suite; CSS seasonal, catalog, quote-view, invoice, Quote Management and email suites; staff-dashboard-workspaces inbox checks. Original CSS migration fixtures remain unchanged; explicit reversible holiday integration mappings preserve unrelated source contracts.

Local verification completed September 13: the 28-case money-path/calculator-parity/holiday behavior run passed; all 22 Quote Management browser cases passed, including the new holiday search, shipping totals and incomplete-save behavior; affected catalog, quote, invoice, staff and email layouts passed their broader browser suites. Four receipt states pass accessibility and overflow checks at 1440/768/390/320 pixels. Generated holiday page/receipt/email paper outputs were reviewed. Lint, type checking, CSS lint, build and production dependency audit pass. Current full-suite and CI evidence, commit and pending business decisions are recorded in the working checkpoint below. No real orders, payment charges or emails were created by tests.

Before release: finish exact release-commit checks, green CI and live read-only pricing/stock/code verification. Local unit/DOM/a11y/type/CSS/behavior/parity/build/audit checks and paper review passed; the route-table fixture includes the intentional new routes. CI caught a Windows CRLF versus Linux LF mismatch in an original-evidence hash: normalize physical line endings before hashing; the original fixture remains unchanged. Follow this repo's `.claude/skills/deploy/SKILL.md`, not the sibling proxy deploy skill. Verify the live campaign without creating a real order or sending mail.

Working evidence/checkpoint: `C:/Users/erik/.codex/visualizations/2026/09/08/01a081d3-550f-7fc1-826b-bcdac1807b9a/GIFT_BOX_REBUILD_PLAN.md`.
