# SanMar FTP → Product-Master Pricing Refresh

**What this is:** how the Caspio product master `Sanmar_Bulk_251816_Feb2024` (the table every
quote builder prices garments from — `MAX(CASE_PRICE)` per size, proxy `pricing.js:943`) gets
refreshed from SanMar. Built 2026-07-22. SanMar pricing changes only every ~3–4 months, so this
is a **run-it-when-it-changes** refresh, not a scheduled sync.

## The source
- SanMar FTP: host `ftp.sanmar.com`, user **`6920`** (a dedicated FTP account, NOT the 251816
  customer number, NOT the sanmar.com web login), **plain FTP (port 21)**.
- Pricing/product master file: newest **`/SanMarPDD/SanMarPI/SanMarPI-Bulk-*.csv`** (~330 MB).
  Its columns match the `Sanmar_Bulk` table. The `-139942` suffix is a batch id — match the
  glob and take the newest by modified time; never hardcode the full name.
- Other useful files in the same tree: `Category_*.csv` (per-category subsets),
  `/SanMarPDD/sanmar_dip.txt` (inventory + pricing, hourly), `Sanmar_SaleItems.txt`.
- The v23.5 guide now specifies **SFTP on port 2200**; plain FTP still works today. Moving to
  SFTP + rotating the FTP password out of plaintext is a **deferred** hardening follow-up.

## Two ways to get the file (both built)
1. **Dashboard (any admin):** `/dashboards/sanmar-ftp-integration.html` — "SanMar Downloads" in
   the staff-dashboard **Administration** nav. Lists SanMar's files with live size/date and a
   **Download** button per file (streams straight to the browser's Downloads — the web version
   of FileZilla). Hard-gated `requireCrmRole(['admin'])`.
   - Backed by two server.js endpoints (this repo, deploys to Heroku `sanmar-inventory-app`):
     `GET /api/staff/sanmar-ftp/list` (5-min cache; flags the newest bulk file as `masterKey`)
     and `GET /api/staff/sanmar-ftp/download?dir=&name=` (streams via **basic-ftp**;
     `Content-Type: application/octet-stream` so `compression` skips it and Content-Length +
     the browser progress bar survive). Only the allow-listed dirs
     `['/SanMarPDD/SanMarPI/','/SanMarPDD/']` + a safe filename regex are downloadable (no path
     traversal).
   - **REQUIRED config var: `SANMAR_FTP_PASSWORD`** on the app (optional `SANMAR_FTP_USER`
     default `6920`, `SANMAR_FTP_HOST` default ftp.sanmar.com). Until it's set the page shows
     "Not set up yet" and a setup note. Never hardcoded.
2. **Local double-click:** `../sanmar-ftp-box/Download-SanMar-Pricing.bat` (+
   `download_sanmar_pricing.py`, stdlib only) — pulls the newest `SanMarPI-Bulk-*.csv` to the
   user's Downloads folder; prompts for the FTP password (or reads a gitignored `.env`). No
   server needed. See `sanmar-ftp-box/HOW-TO-Download-SanMar-Pricing.md`.

## Import into Caspio (manual, after download)
- App **Sanmar Pricing 2026** → table `Sanmar_Bulk_251816_Feb2024` → Import the CSV.
- Mode **Update & add records**, match on **`UNIQUE_KEY`** (Integer, Unique).
- **Leave unmapped** so NWCA-owned values survive the update: `IsTopSeller`, `IsNew`,
  `Display_Image_URL` (formula). Only SanMar columns get mapped.
- Caspio scheduled **imports are $0 API** (confirmed by Caspio support — imports don't count
  against the 500K/mo meter; only Extensions/Webhooks/REST do).
- One table refresh → all price surfaces update (~15-min pricing cache; `?refresh=true` busts).
  Re-run `web-quote-cart-parity` + `quick-quote-parity` after a big price change (CLAUDE Rule 9).
- **Gotcha:** the table has a leftover `string` (Text 255, **Unique**) field — a blank/dup
  Unique value blocks INSERTs of new styles. Check/clear it before an insert-mode import.

## Not this
- `../sanmar-ftp-box/sanmar_ftp_to_box.py` is a **separate** Heroku app that feeds the Caspio
  **inventory** tables (Inventory1-5) from `sanmar_dip.txt` — unrelated to product-master pricing.
- SanMar SOAP `getPricing`/`getConfigurationAndPricing` exist but are **unused** for quotes;
  garment cost comes only from `Sanmar_Bulk...CASE_PRICE`. See [[SANMAR_API_REFERENCE]].
