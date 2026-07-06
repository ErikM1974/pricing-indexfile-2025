# Storefront Checkout + Catalog + Funnel Proposal (2026-07-05)

> **STATUS: Erik approved 2026-07-05 → Phase 0 + Phase 1 BUILT same day (committed to
> develop, NOT yet deployed).** Catalog (Part 2) + remaining funnel fixes (Part 3) still
> proposals. Remaining **[DECIDE]**s below still stand.

## ✅ Built 2026-07-05 (Phase 0 + 1) — and Erik's go-live checklist

**Shipped in code (develop):**
- Phase 0: accept endpoint hardened (strictLimiter + JSON-only CSRF gate, server.js);
  totals-hash binding (`computeQuoteTotalsHash`); `parseNotesJson` preserves legacy
  plain-text Notes under `_legacyText`.
- Phase 1: `POST /api/quotes/:quoteId/enable-deposit` (requireStaff; rep confirms shipping$
  + taxRate%; DEPOSIT-PCT from Service_Codes fail-closed; terms+hash → Notes JSON `deposit`
  block) · `POST /api/public/quote/:quoteId/deposit-checkout` (Stripe HOSTED session from
  stored terms only, hash re-verified) · webhook `metadata.kind` branch (records
  `payments[]` in Notes, 503-retry on write failure, dedup by sessionId, stale-hash alert,
  Slack 💰 + fail-soft EmailJS receipts + fail-soft Order_Payments ledger mirror).
- Money math: `shared_components/js/quote-deposit-math.js` (dual-load, 9 jest tests,
  deposit+balance foot exactly; tax on subtotal+shipping per WA).
- UI: quote-view customer deposit panel (`#deposit-panel`, pay button, paid/receipt state,
  ?deposit=success|canceled banners; deposit card prints, pay button doesn't) + staff strip
  (`#qv-deposit-strip`: shipping/tax inputs, live preview, Enable/Update + link copy) +
  Quote Management deposit chips (`renderDepositChip`: "Deposit link live" / "Deposit paid ·
  bal $" / "Paid in full").
- Proxy: `src/routes/order-payments.js` (append-only ledger, CRM-gated, idempotent on
  Stripe_Session_ID) mounted at `/api/order-payments`.

**Go-live checklist (updated 2026-07-05 PM — Erik chose PAY IN FULL):**
1. ✅ **DONE — Caspio Service_Codes `DEPOSIT-PCT` SellPrice=100** (PK_ID 253, inserted via
   `caspio-pricing-proxy/scripts/create-order-payments-table.js`). **100 = pay in full;
   change SellPrice to 50 in Caspio to switch to 50% deposits — all wording (customer
   panel, Stripe line item, QM chips, staff strip) is pct-aware, no deploy.**
2. ✅ **DONE — Caspio table `Order_Payments`** created via the same script (9 STRING
   columns, Customer_Reward_Ledger house pattern). NOTE: this account 404s on Caspio REST
   v3 — v2 `POST /tables` works but only accepts minimal `{Name, Columns:[{Name,Type}]}`.
3. ✅ **DONE — EmailJS templates created 2026-07-05** via browser automation in the
   dashboard (no template-creation API exists): `template_deposit_cust` ("Quote Payment
   Received — Customer", slug 0q7varp) + `template_deposit_staff` ("Quote Payment
   Received - Staff", slug yfds024; Reply-To = {{customer_email}}). Both SHARE the
   receipt body (the staff-body swap fought the dashboard UI), so the server passes
   grand_total to the staff send too (v2026.07.05.9). Both verified with real 200-OK
   sends. Dashboard-automation gotchas: renderer oscillates 1x/2x screenshot scale
   (coordinates unreliable) and Save/menu buttons ignore synthetic + most real clicks —
   reliable pattern = JS `.focus()` the button + REAL Enter key. Original spec:
   - `template_deposit_cust` — To: `{{to_email}}` · Subject: `Payment received — Quote
     {{quote_id}} | Northwest Custom Apparel` · Body: Hi {{to_name}}, we received your
     payment of ${{amount_paid}} for quote {{quote_id}}. Order total ${{grand_total}};
     balance due ${{balance_due}}. We'll start on your proof right away — you'll approve
     it before production. Questions? (253) 922-5793.
   - `template_deposit_staff` — To: `{{to_email}}` · Subject: `💰 {{quote_id}} paid
     ${{amount_paid}} online` · Body: {{customer_name}} ({{customer_email}},
     {{company_name}}) paid ${{amount_paid}} via Stripe. Balance due ${{balance_due}}.
     Quote: {{quote_url}}. Enter/verify the order in ShopWorks.
   - Also recommended: Stripe Dashboard → Settings → Emails → enable "Successful
     payments" receipts (customer gets Stripe's own receipt with zero setup).
4. ✅ **Deployed 2026-07-05** (proxy + main). No new env vars.
5. ✅ **DONE — Test-mode dry run PASSED 2026-07-05** (local server STRIPE_MODE=development,
   test quote WQ-2026-990 $100+$12.50 ship+10.1% tax=$123.86): hardened accept 200 →
   deposit terms+hash stamped → public deposit-checkout minted a real cs_test session
   (Stripe hosted page rendered "Payment in full — $123.86") → signed
   checkout.session.completed delivered locally → `quote-payment-recorded`; redelivery →
   `duplicate`; tampered signature → 400; Notes payments[] + Order_Payments ledger row
   written; second checkout attempt → "Deposit already paid". Test rows DELETED from
   Quote_Sessions + Order_Payments after. (Browser card-entry path was blocked by a
   password-manager extension popup — payment completion simulated via signed webhook,
   same as stripe-cli fixtures; Stripe-side card acceptance is proven daily by custom-tees.)
   **System FULLY LIVE as of v2026.07.05.9.**

---

## Part 1 — Online Payment Checkout

### 1.1 The core finding

The Custom-Tees/3-Day-Tees Stripe stack is **not a one-off experiment — it is a general-purpose
payment platform** that already solves the hard problems:

| Capability | Where | Status |
|---|---|---|
| Channel registry (per-channel config) | `config/storefront-channels.js` (3 channels) | ✅ live |
| Server-side authoritative reprice (±$0.01 gate, 409 on drift) | `server.js:4750–4777` (`rebuildTdtQuote`/`rebuildCtsQuote`/`rebuildCapsQuote`) | ✅ live |
| Stripe hosted Checkout session (PCI SAQ-A) | `server.js:4715–5031` | ✅ live |
| Signature-verified webhook + idempotency via Caspio Status | `server.js:920–1119` | ✅ live |
| Save-to-Caspio-BEFORE-Stripe (fail-closed), `refresh=true` cache bypass | `server.js:4874–4915` | ✅ live |
| ShopWorks push with payment record + dedup + "Payment Confirmed - ShopWorks Failed" manual lane | `server.js:5094–5503` | ✅ live |
| WA DOR tax lookup (24h cache, account codes) | proxy `src/routes/tax-rate.js`, `POST /api/tax-rates/lookup` | ✅ live |
| UPS Ground estimator (zones, fuel, residential, markup) | proxy `src/routes/shipping.js` | ✅ live (zone chart approximate) |
| Order-status page, HMAC token, no login | `server.js:670–679` | ✅ live |
| Slack alerting on every failure lane (`alert3DT`) | `server.js:639` | ✅ live |

**Missing for general checkout:** deposits/partial payments, a payments ledger, refunds API,
server-side reprice of the *general catalog* cart (QuoteCartEngine authorities are browser-side
except DTG), per-style shipping weights, tax exemption, saved cards.

### 1.2 Recommended payment model: **Deposit-on-accepted-quote** (not pay-in-full at cart)

Rejected models and why:
- **Pay-in-full at cart (general catalog):** conflicts with the proof loop (customer pays before
  proof exists → refund churn when qty/method changes); and general-cart totals are
  browser-computed (EMB/SCP/DTF authorities are browser classes) — charging real money on a
  client-computed number violates the money-gate principle the 3DT flow established.
- **Authorize-now / capture-after-proof:** Stripe card auths expire ~7 days; proof loops
  routinely run longer. Dead on arrival.
- **Pay-in-full at accept:** viable but refund-heavy; 50% deposit is the trade norm and matches
  the quote-view success modal, which already tells the customer a rep will "discuss deposit".

**The model:** Quote → customer Accepts → **deposit paid online (Stripe link)** → proof loop →
balance invoiced (online link) at proof approval/ship. Express channels (custom-tees/caps,
3-day-tees) stay pay-in-full — they are self-serve with `needsArtReview` banners and that works.

### 1.3 Phased plan

**Phase 0 — Hardening (prerequisites, ~days):**
1. Add CSRF/abuse protection to `POST /api/public/quote/:quoteId/accept` (`server.js:10469`) —
   currently unauthenticated + no token. Minimum: single-use accept token embedded in the quote
   link (HMAC like `computeOrderStatusToken`), rate-limit, and origin check.
2. Quote **versioning/locking**: add a totals-hash (grandTotal + item rows) stamped on the quote;
   any payment link binds to that hash. A rep edit after link issuance invalidates the link (409).
   Prereq for taking money against a quote.
3. New Caspio table **`Order_Payments`** (append-only ledger): QuoteID, Type
   (deposit/balance/refund), Amount, StripeSessionID/PaymentIntent, Status, Timestamp, Notes.
   Mirrors the append-only `Customer_Reward_Ledger` pattern.

**Phase 1 — Rep-triggered deposit link (~1–2 weeks):**
- Quote Management gets a **"Send deposit link"** action on Accepted quotes (rep has already
  confirmed tax + shipping — same human step as today; we only replace "call with a card /
  mail a check" with Stripe).
- `POST /api/quotes/:quoteId/deposit-session` (staff-gated): loads quote_sessions, verifies
  Status=Accepted + totals-hash, deposit % from **Service_Codes `DEPOSIT-PCT`** (Erik-editable,
  Rule: pricing=API — no hardcoded 50%), creates Stripe Checkout session with metadata
  `{quoteID, kind:'deposit', totalsHash}`, records Pending row in Order_Payments.
- Extend the existing webhook: branch on `metadata.kind`. On `deposit` completion: write ledger
  row, set quote_sessions `PaymentStatus='Deposit Paid'`, EmailJS receipts (customer + rep),
  Slack alert. **No auto-ShopWorks-push in Phase 1** — rep enters the order as today, with the
  Stripe payment reference in hand.
- Customer sees the deposit CTA on the quote-view page after accepting (fixes the current
  post-accept dead end).

**Phase 2 — Balance + refunds + status (~2–3 weeks):**
- "Pay balance" link (same rail, `kind:'balance'`, amount = grandTotal − deposits from ledger),
  sent at proof approval; surfaces on quote-view and `/order-status`.
- `POST /api/refund` (staff-gated): Stripe Refunds API + ledger row + EmailJS template; listen
  for `charge.refunded` webhook events.
- Optional: auto-push to ShopWorks on deposit with `payments[]` record (reuse 3DT push shape);
  needs Erik's call on whether deposit-paid orders should auto-enter production queue **[DECIDE]**.
- Accounting: deposit = customer liability until invoiced; WA sales tax remitted when the sale
  closes in ShopWorks. **Confirm treatment with accountant [DECIDE]** (same open thread as the
  Phase-5 reward-$ accrual).

**Phase 3 — Self-serve express checkout for a curated catalog subset (~4–6 weeks, optional):**
- Extend the channel registry with a `catalog-express` channel: pay-in-full for a curated list
  of style+method combos (like custom-tees but multi-style).
- Requires: (a) **server-side reprice through the same engine authorities** —
  `quote-cart-engine.js` is already dual-environment (Node require-able); the EMB/SCP/DTF
  service classes need Node loading the way `3-day-tees-pricing.js` dual-loads. Never a 4th
  pricing path (Rule 9). (b) Address-at-checkout tax via existing DOR endpoint. (c) Shipping via
  UPS estimator — **gap: per-style piece weights** for arbitrary garments (Sanmar data or a
  Caspio weights table). (d) Stock gate generalization.
- Only worth it if quote-lane friction data says self-serve demand exists. **[DECIDE later]**

### 1.4 Risk assessment

| Risk | Mitigation |
|---|---|
| Paid against a stale/edited quote | totals-hash bound into Stripe metadata; webhook verifies before recording; link invalidated on edit |
| Double deposit (webhook redelivery / two links) | ledger idempotency on StripeSessionID + quote PaymentStatus check (same pattern as 3DT Status gates) |
| Webhook regression breaking live 3DT/CTS flow | branch on `metadata.kind` with default = existing path; unit tests lock existing behavior before touching |
| Payment succeeded, ledger write failed | same lane as 3DT: Slack alert + manual-recovery status; Stripe retries |
| Refund abuse / staff error | staff-gated endpoint (SAML `requireStaff`), ledger is append-only, amounts capped at net-paid |
| PCI | Stripe **hosted Checkout only** — no Elements, no card fields anywhere; SAQ-A stays |
| Tax on deposits (WA) | charge deposit as % of tax-inclusive grand total; remittance timing per accountant **[DECIDE]** |

---

## Part 2 — Catalog layout proposal (summary)

Full critique in session 2026-07-05. Keep: `nwca-2026-core.css` token system, pdp-configurator
3-question flow, engine-probed pricing, mobile sticky CTA bar.

**IA headline: make the two buying lanes explicit.** Every product card/PDP badges either
**"Buy online"** (express channels — pay now) or **"Fast quote"** (catalog — no payment now).
Payment decision above is what makes this legible: quote lane ends in an online deposit, so both
lanes now end in "pay online", differing only in when.

Quick wins (days): per-product `<title>` SEO; categories via `/api/categories` instead of
hardcoded `app-modern.js:22–39`; retire stale `catalog-search.css` (25K); mobile filter Reset;
hero carousel controls; document z-index scale (mobile CTA 200 vs modal 260 conflict).
Medium (1–2 sprints): modularize `catalog-search.js` (1,959-line monolith); lazy-load non-primary
pricing services on PDP (6 of 14 scripts); fuzzy autocomplete + category suggestions;
recently-viewed shelf; best-seller shelf from a Caspio content table (no-deploy editorial).
No framework migration — vanilla stack is fine at current velocity.

---

## Part 3 — Quote funnel verdict (summary)

**Do NOT merge quote-flow and Stripe-flow into one checkout.** Converge on a shared spine:
one cart, one order record (quote_sessions), one status surface, one payment rail (Part 1),
two lanes on top (Express pay-now / Quote-then-deposit).

Priority fixes: ① accept-endpoint CSRF (Phase 0); ② quote versioning (Phase 0);
③ post-accept dead end → becomes the deposit CTA (Phase 1); ④ expiry reminders at day 20/28
(cron + EmailJS); ⑤ artwork-upload failure needs retry UI (currently non-blocking warn only);
⑥ pricing-changed gate should show the delta; ⑦ cross-device cart (server-backed, later).

---

## Decisions Erik owns
1. Deposit % (Service_Codes `DEPOSIT-PCT` — 50%?) and whether any customer tier skips deposit.
2. Phase 2: auto-push deposit-paid orders to ShopWorks, or keep rep order-entry?
3. Accountant: deposit liability + WA tax remittance timing.
4. Phase 3 (self-serve express catalog) — go/no-go after Phase 1–2 data.
