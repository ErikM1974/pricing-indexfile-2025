# December 2026 Finish Line

The staff dashboard’s Administration → Analysis group links to `/dashboards/december-finish-line.html`. This page, its live data, the saved report and all downloads require the verified `admin` permission. Access Admin rows cannot widen this dedicated gate.

## Private document package

This GitHub repository is PUBLIC. **Never commit plaintext financial/customer reports, the transfer ZIP, source documents, decrypted packaging JSON, or the encryption key.**

- `private/december-finish-line.enc` contains only AES-256-GCM authenticated ciphertext. The server reads `FINISH_LINE_ARCHIVE_KEY` from its environment and decrypts in memory after an authorized request.
- `routes/december-finish-line.js` registers before every public static mount. All `/admin/december-finish-line/*` requests pass the admin gate, including JS, CSS, JSON, CSV, PDF and XLSX. Unknown requests terminate with 404. Encoded dashboard filenames receive the same strict gate.
- Responses are private/no-store/noindex, with no-referrer and nosniff. Generated reports have a restrictive document CSP. No plaintext assets are added to `/dist` or any static folder.
- The selected transfer consists of 51 generated report/download documents, including nine HTML reports. Import externalizes their authored CSS, executable scripts and inline handlers. JSON data islands retain their exact text in hidden elements. Their existing financial calculations and browser progress models are preserved.
- A historical link to the old financial command center redirects to the current report, preserving relative link resolution. Original financial/payroll source-document links become references to the private transfer folder.
- The report package is a dated September 11 financial baseline. Its generated-document styling is preserved as imported content, separate from the canonical staff landing-page CSS.

## Current ShopWorks/Caspio reads

`lib/december-finish-line-live.js` powers `/admin/december-finish-line/live` with read-only requests:

- `NW_Daily_Sales_By_Rep` through `/api/caspio/daily-sales-by-rep` for early-year daily sales.
- Fresh `/api/manageorders/orders` invoice-date reads replace the entire matching recent 60-day interval. Count normalized order IDs once; preserve signed credits; use `cur_SubTotal` without subtracting tax/shipping again.
- Some zero-merchandise/freight-only invoices have a null subtotal. Treat it as zero only if the independent total exactly equals tax plus shipping. Missing ordinary subtotals fail visibly.
- `Sales_Reps_2026` supplies current rep assignment. Rep figures are company attribution across channels, **not direct-sales quotas**; webstores may be included. Unknown groups remain in company totals.
- Active `Service_Codes` entry `CO-ANNUAL-GOAL` supplies the company goal. Failure displays unavailable, without an invented substitute.
- A separate ordered-date read shows recent uninvoiced work. It is never added to achieved sales, nor called complete backlog/AR. The two agreed excluded/unconfirmed orders remain excluded from detailed reads; older aggregate rows cannot be independently audited by order ID.

Successful totals cache for five minutes; manual refresh bypasses that cache. ManageOrders calls request fresh data, and `stale:true` is rejected. The page checks every five minutes while visible and resumes after returning to an old tab. It never triggers archive writes, orders, quotes, email, campaigns, or payments.

Each imported report also shows a current ShopWorks sales strip above its saved content. The owner/marketing/monthly light panels receive an explicit shared-token surface so their dark text remains readable inside the original dark report shell. Financial model scripts and data remain unchanged.

The archive lacks a completeness watermark. Latest archived sales date is labeled as a sales date, not a sync confirmation. Missing history or failed recent invoices withholds the entire YTD total. Goal/workload/rep failures appear separately. API midnight-UTC dates are date labels; do not convert them to the prior Pacific day.

The private catalog carries the saved accounting cutoff/net-sales amount. The live service compares operational sales through that same cutoff and shows any reconciliation difference. **Do not replace reconciled profit, payroll, accruals or receivables with invoice totals.** Existing payroll imports are incomplete for this purpose; no complete company AR feed was identified.

## Updating documents

Keep the dated ZIP, allowlist and plaintext preparation output in private storage outside this checkout. `scripts/december-finish-line/import-package.py` accepts the ZIP, reviewed output allowlist, private output path and snapshot label. It requires Python with beautifulsoup4/html5lib. `seal-package.js` encrypts and verifies the resulting package using a private key file outside the checkout. Preserve the existing key unless deliberately rotating the hosted environment in the same release.

Never rerun every historical generator or replace the website with the transfer’s website snapshot. Preserve the original package and any independently edited website PDFs. The owner’s browser-local progress was not in the transfer. Use the report’s backup/import tools to move entered progress between browsers/computers; it is not shared database state.

## Verification owners

- `tests/unit/december-finish-line.test.js`: authenticated encryption, tampering, all-file admin gating, encoded paths, exact file allowlist and private cache headers.
- `tests/unit/december-finish-line-live.test.js`: invoice/archive non-overlap, deduplication, signed credits, null-subtotal checks, exclusions, partial failure and cache/refresh semantics using synthetic data only.
- `tests/e2e/css-unification-december-finish-line.spec.js`: actual server role gates; synthetic UI data, four widths, keyboard/accessibility, print, retry and expired sessions.
- Live private document review must run locally with the separately stored key. CI uses synthetic data and never receives the production archive key.
- `tests/fixtures/finish-line-source-mappings.json` records only the intentional new dashboard link and server registration so historical CSS evidence remains unchanged.

The original OneDrive checkout had an unreadable Git index during this integration. Work was isolated in a clean clone; do not overwrite that original checkout or its unrelated changes when returning to it.
