# SanMar Payables — native page + marketing fund (2026-07-20)

Native replacement for the Caspio-embedded "Sanmar Vendor Portal" (`vendor-portals/sanmar-vendor-portal.html`,
which just embeds Caspio DataPage `a0e15000094c1ad41f84402184a5`) + the manual email-parse workflow.
Page: `dashboards/sanmar-payables.html` (+ `css/js`), harness `tests/ui/test-sanmar-payables.{html,js}`.
Full design/plan → the approved plan file; this captures the durable domain facts.

## Backend already existed (verified live in prod)
`caspio-pricing-proxy/src/routes/sanmar-invoices.js` already reads the SanMar SOAP Invoicing service:
`GET /api/sanmar-invoices/by-date?start=&end=` (GetInvoicesByInvoiceDateRange, ≤3-mo), `/unpaid`
(GetUnpaidInvoices), `/by-po/:po`, `/incremental`, secret-gated `POST /sync`+`/backfill`. Stores to Caspio
`SanMar_Invoices`/`SanMar_Invoice_Items` (NOT the legacy `tbl_Invoices_Sanmar`). Env `SANMAR_CUSTOMER_NUMBER/
SANMAR_USERNAME/SANMAR_PASSWORD`. App-side forwarder added: `GET /api/staff/sanmar-invoices/by-date` (requireStaff,
validates dates + ≤100-day window, `server.js` near the `payments/recent` template).

## ShopWorks import CSV — golden 7-col format (byte-identical verified 79/79 vs `Sanmar Payables 6-26-26.csv`)
`PayableDate,InvoiceNumber,Amount,Id_Vendor,PONumber,Id_Vendor_Charge,PayableDueDateOverride,,,` (3 trailing empty cols).
- PayableDate = invoiceDate as **M/D/YYYY**; PayableDueDateOverride = dueDate (SanMar returns invoiceDate+30 for Net30).
- InvoiceNumber = **`INV-`**+raw (SanMar returns raw `161980143`); credits = **`CR-`**+raw, negative Amount.
- Amount = `$`+2dp+**trailing space**, comma-grouped (so `"$1,222.47 "` gets csv-quoted).
- PONumber keeps SanMar's `" BW"/" EM"` suffix. Id_Vendor & Id_Vendor_Charge constants (see vendor split below).

## Vendor split by SanMar `terms` (THE key rule)
- **terms `Net30` → ShopWorks vendor `1002` (SANMAR)** — the standard payables import. Includes credits (CR-) and
  freight (FTC). Verified: the live ShopWorks payables ledger (`Sanmar payables inside shopworks currently 2026.csv`)
  is 100% vendor 1002 (1975 rows: 1889 INV + 82 CR + 4 FTC).
- **terms `MRKFUND` → ShopWorks vendor `2425` ("6920-0001 Marketing (Sanmar)")** — a SEPARATE account/import. These
  come back with same-day due dates and NEVER appear in the 1002 ledger. On the Invoices tab they're badged MARKETING
  and non-exportable to the 1002 CSV; they live on the Marketing Fund tab (2425 CSV).
- SanMar's per-invoice `invoiceStatus` is **unreliable** (reads "Unpaid" even for long-paid invoices) — never use it
  for paid status; ShopWorks `date_Paid` is the truth (Phase 2).

## Marketing Fund (vendor 2425)
SanMar allots NWCA a **2026 marketing fund of $35,110.95** (a ceiling; NOT posted in the invoice feed). MRKFUND
charges draw it down. **Remaining = allotment − net MRKFUND charges YTD** (charges +, credits −). As of 2026-07-20:
net spent ≈ $11,505 → remaining ≈ $23,606 (33% used); at ~$1,750/mo pace, on track to leave ~$14K UNUSED by Dec 31
(use-it-or-lose-it). The Marketing Fund tab pulls MRKFUND items via quarterly `by-date` windows, shows an editable
allotment, remaining/projection, monthly bars, and its own `Sanmar_Marketing_2425_<year>_YTD.csv`.

## Access & status
- ✅ `Staff_Page_Access` row created (Page=`sanmar-payables.html` → `admin,accountant`) via `PUT /api/admin-rbac/pages`.
- ✅ Nav link added under Administration in `staff-dashboard-v3/index.html` (old embed relabeled "(legacy)").
- ⏳ **App deploy** (Pricing Index) to make the page + `/api/staff/sanmar-invoices/by-date` forwarder live.

## Phase 2 — paid/imported match + reconciliation (ODBC, STAGED 2026-07-20)
Full detail → SHOPWORKS_ODBC_INTEGRATION.md "SanMar Payables — ODBC paid/imported signal". Summary:
- **Path A (PO-level, works with current DSN, STAGED):** added `PayableExists`/`PayableMatch` to the PO sync
  (2 Caspio `PurchaseOrders` cols created; `shopworks-odbc-sync.js` whitelist + `sync-purchase-orders.ps1` SELECT
  edited). Imported? = `PayableExists==1`; Paid? = that + `PayablesOutstanding==0`. COARSE for split-invoice POs.
  ⏳ deploy proxy + recopy the agent to bandit.
- **Path B (invoice-level, the real one):** the ShopWorks AP/bill table (`date_Paid`, `ID_Payable`, `InvoiceNumber`)
  is NOT in the current DSN. Wrote `bandit-agent/probe-payables.ps1` — ⏳ ERIK run it on bandit to see if the AP
  table is SELECT-able or must be exposed in OnSite "Manage ODBC". Then build `sync-payables.ps1` + Caspio
  `ShopWorks_Payables` + reconciliation view (stale SanMar-open, missing bills, amount mismatches).
- Erik greenlit expanding ODBC fields + Caspio columns.
