# SanMar PO — Onboarding & Test Checklist

SanMar requires onboarding + Test-environment validation before you can submit production POs. This is a **dependency, not a code task**. Source: PO Integration Guide v24.3. Update the status boxes as you go.

**Contact:** `sanmarintegrations@sanmar.com` · **SanMar customer #:** _(fill in)_ · **No charge** for integration access (requires a signed agreement).

## Status at a glance

- **Onboarding stage:** ⬜ not started
- **Test env creds received:** ⬜
- **Test PO submitted:** ⬜
- **Test PO approved by SanMar:** ⬜
- **Production configured:** ⬜
- **First live PO validated:** ⬜

## Steps

### 1. Prerequisite — Web Services access
- [ ] Confirm you already have SanMar Web Services access (you do — the proxy reads product/inventory/order/invoice data today). PO integration is requested *on top of* existing access.
- [ ] Have your SanMar customer number + a sanmar.com web-services username/password (create at https://www.sanmar.com/signup/webuser if needed).

### 2. Request PO integration
- [ ] Email `sanmarintegrations@sanmar.com` requesting **Purchase Order integration**, include your customer #.
- [ ] Sign the (free) Integration Agreement — requires the company **Owner / Authorized Signatory** (Erik).
- [ ] SanMar sets up a **Test** account (2-3 business days) + a one-time secure link to Test web-service credentials.
  - ⚠️ Test creds are **separate** from production creds. Store as distinct env vars (e.g. `SANMAR_TEST_USERNAME` / `SANMAR_TEST_PASSWORD` / `SANMAR_TEST_CUSTOMER_NUMBER`) in the proxy.

### 3. Decide account configuration (hard-coded per account, NOT per order)
- [ ] **Shipping option:** Warehouse Consolidation (default) · Auto-split · Warehouse Selection (required for will-call). NWCA closest warehouse = **PRE (Seattle, id 1)**.
- [ ] **Payment method:** NET terms or last-4 of a credit card on file.
- [ ] **Shipping notification email**, shipping label company name, sanmar.com username for the integrated config.

### 4. Submit the test PO
- [ ] Use **`templates/po-sample.json`** — it is already the multi-line, multi-style order SanMar wants (PC61/PC55/S508/DT5001/T200), shipping to the address you'll use in production.
- [ ] Confirm the ship-to is correct and each `color` is the `SANMAR_MAINFRAME_COLOR`.
- [ ] Submit via Test WSDL: `https://test-ws.sanmar.com:8080/SanMarWebService/SanMarPOServicePort?wsdl` (Standard `submitPO`).
- [ ] Email your test **PO number** to `sanmarintegrations@sanmar.com`. They review the order files + return your **Holding file** (warehouse # + Y/N availability per line).
- [ ] If shipping via PSST or will-call, expect additional test requirements.

### 5. Go to production
- [ ] After test passes, give SanMar: go-live date/time, shipping notification email, sanmar.com username, chosen shipping option.
- [ ] SanMar configures prod (24-48 hrs). Switch the proxy to the prod WSDL: `https://ws.sanmar.com:8080/SanMarWebService/SanMarPOServicePort?wsdl`.
- [ ] Submit one small **live** PO; SanMar validates it processed cleanly. Then you're free to submit at will.

## Gotchas to carry into the build
- Confirm whether the PO API needs an **order-submission account** distinct from the read account (ask during onboarding).
- Test env "may not match prod inventory/pricing" and can be down during SanMar internal updates.
- Production setup info is **hard-coded** by SanMar and can't be changed per-order — get the shipping option right up front.
- Hemmed pants: not supported via integrated PO (keep manual).

## Notes log
_(record dates, who you spoke to, customer #, account config chosen, test PO #s)_
