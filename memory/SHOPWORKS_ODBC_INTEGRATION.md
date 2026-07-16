# ShopWorks OnSite ODBC Integration (FileMaker xDBC)

**Status:** 🟢 LIVE READ ACCESS 2026-07-16 via bandit bridge (dev). Production sync agent NOT built yet. Source: vendor PDF `ODBC Integration Guide for OnSite Projects.pdf` (Erik's Downloads, 7 pages) + Claris docs + proxy-repo pattern audit + live schema pull.

## ⚡ Working access path (verified live 2026-07-16)

- **Bandit** (`bandit.NWEINC.local` = 192.168.10.219, Win10 Pro, domain-joined, 57-day uptime — always-on) already had BOTH FileMaker drivers (32+64-bit) AND 3 System DSNs → 192.168.10.6/Data_ODBCMapping (`SW32`, `SWAddress` 32-bit; `SWODBC` 64-bit) — shipping-integration legacy. **No installer needed anywhere.**
- Erik's laptop (ERIKLAPTOP, WORKGROUP, non-domain) reaches bandit via **PowerShell Remoting**: WinRM service started + `TrustedHosts='bandit,bandit.NWEINC.local,192.168.10.219'` (client-side, admin, done 2026-07-16); credential = DPAPI-encrypted `%USERPROFILE%\bandit-cred.xml` (`NWEINC\Erik`, laptop+user-bound, Claude never sees password).
- Query pattern from any session on the laptop (shop LAN only):
  `$cred = Import-Clixml "$env:USERPROFILE\bandit-cred.xml"; Invoke-Command -ComputerName bandit -Credential $cred { ...OdbcConnection 'DRIVER={FileMaker ODBC};Server=192.168.10.6;Database=Data_ODBCMapping;UID=extro;PWD=extro'... }`
- Verified end-to-end: pulled same-day orders (142464-68) w/ due dates. Bandit = intended production sync-agent host (Task Scheduler) when built.

## Schema (pulled live 2026-07-16 — full catalog: [shopworks-odbc-schema-catalog.txt](shopworks-odbc-schema-catalog.txt), 2,630 fields, `Table|Field|Type`)

- **17 tables**: Addr(75) Buttons(20) ContactNumbers(31) Contacts(66) **Cust(294)** Des(76) Event(158) InvLevel(145) **LinesOE(494)** Machines(48) **Orders(539)** OrdTyp(180) **PO(192)** Prod(240) ProductionLogDetails(65) Version(7). `LinesPur` listed by GetSchema('Tables') but ABSENT from FileMaker_Fields + 0-col reads — unmapped placeholder; ask ShopWorks if PO lines needed.
- **Gap-filling headline fields**: `Orders.date_OrderDropDead` (the due date MO lacks!) + `date_ProductionScheduled/Done`, `date_DesignScheduled/Done`, `date_OrderShipped`, `date_ForAging`, `id_EmpSalesperson`, **`date_Modification` = delta-sync key**. `Cust.cur_CreditLimit/cur_CreditUsed/Terms/sts_CreditAutoHold/TaxExemptNumber/date_TaxExemptExpiration/cur_Statement_TotalBalance` = entire CRM credit/terms wishlist.
- **Field-prefix decoder (critical for query perf)**: `cn_`/`ct_`/`cd_` = unstored CALC (number/text/date), `sum_` = summary, `gn_`/`gt_` = global — ALL slow/unindexable, NEVER in WHERE, avoid in SELECT. Plain `date_`/`cur_`/`sts_`/`ID_` fields = stored → use these.
- **Driver gotcha**: .NET `GetSchemaTable()`/`GetSchema('Columns')` fail on wide tables (arithmetic overflow / duplicate SQL_NO_NULLS — FM15-driver bug). **Schema discovery = `SELECT TableName, FieldName, FieldType FROM FileMaker_Fields`** (also FileMaker_Tables). Data reads of those same tables work fine with explicit column lists.
**Verdict:** ODBC gives direct SQL reads of the OnSite FileMaker tables — strictly more data than ManageOrders PULL (due dates, full customer master w/ terms, employee/rep records, vendor PO/receiving detail, design records, per-line production state, unlimited history, SQL aggregation). MO push API remains the ONLY write path into ShopWorks — never write via ODBC.

## Connection card (Erik, 2026-07-16)

- Driver: **FileMaker ODBC 64-bit** (`fmodbc64.dll`) → 64-bit Python/Node work directly, no bitness gymnastics
- Server: **192.168.10.6** (OnSite host, LAN) · Port: default **2399** (leave blank in DSN)
- Database file: `Data_ODBCMapping` · User/pass: `extro` / `extro` (**read-only** — enforces the never-write rule at the account level)
- DSN-less connection string (works without creating a DSN): `DRIVER={FileMaker ODBC};Server=192.168.10.6;Database=Data_ODBCMapping;UID=extro;PWD=extro`
- ✅ Verified 2026-07-16 from Erik's laptop: server pings (3-8ms) and **port 2399 OPEN — xDBC listener already live** (shipping integrations use it) → no ShopWorks ticket needed to enable server-side sharing. Laptop lacks the driver (no fmodbc64.dll) — install from Box link to query.
- Installer inspected 2026-07-16 (`SW ODBC Shipping Address.exe`, 2.9MB, ShopWorks v8.300 Advanced Installer, unsigned, Erik's copy arrived via Slack not Box): bundles **FileMaker ODBC driver 15.0.6, 32-BIT (`fmodbc32.dll`)** — contradicts card's "64-bit" claim; pre-creates DSN → Data_ODBCMapping w/ `UseLongVarchar` already ON + "ENTER YOUR SERVER IP HERE" placeholder. **If only 32-bit lands: agent = 32-bit Python/pyodbc + `SysWOW64\odbcad32.exe` DSN admin.** Verify actual DLL post-install; check Box folder for a Win64 variant.

## Vendor rules (ShopWorks, binding)

- ONE dedicated Windows machine runs the FileMaker ODBC driver; **the querying app MUST run on that same machine** (Heroku can never connect directly).
- DSN target = hosted file **`Data_ODBCMapping`** ONLY (never other files, never multiple DSNs, never modify it). Credentials: `extro` / `extro`.
- Field discovery protocol: full-screen OnSite screenshots w/ fields highlighted → email `support@shopworx.com` → they annotate table/field/relationship names and add missing tables to Data_ODBCMapping. They do setup/access ONLY — no query help.
- **No blanket queries** (always WHERE-filter; unfiltered scans can fill C: and crash the server). **No tight polling** (minutes+, not seconds). No images/attachments via ODBC.
- Installer: `SW ODBC Shipping Address` from `https://shopworx.box.com/v/OnSiteODBCLinks` (same installer as the shipping integrations — **an ODBC connector reset in FMS Admin Console kicks off the shipping machines too**; coordinate).
- Optional paid cloud staging copy of the system for dev; DSN re-pointed to production when done.

## Driver / DSN tech facts (Claris)

- xDBC port **2399, fixed**; FMS-side needs ODBC/JDBC sharing on + account with `fmxdbc` extended privilege; listener = separate `fmxdbc_listener` process (known to wedge/die — treat "connection suddenly dead" as expected; restart via FMS Admin Console = disconnects ALL ODBC clients incl. shipping).
- **Driver bitness must match the app, not the OS.** 32-bit dll → `SysWOW64`, 64-bit → `System32`. Both ODBC admins are literally `odbcad32.exe` — folder decides. Wrong-bitness DSN = `IM002`/`IM014`. Check what the ShopWorks installer laid down BEFORE picking runtime; if 32-bit-only, use 32-bit Python/Node.
- Claris version-pairs client driver ↔ server ("driver for the current version is not compatible with earlier versions") — that's why the OLD vendor installer is required; do NOT substitute a newer Claris driver.
- DSN options that matter: ✅ "Describe text fields as long varchar" (else >255-char text comes back EMPTY), ✅ UTF-8, ✅ "Save long-running queries to a log file". Use a **System DSN** so Task Scheduler jobs can see it.

## FileMaker SQL dialect gotchas (query style guide)

- Row limit: `OFFSET n ROWS FETCH FIRST n ROWS ONLY` (no LIMIT/TOP). Delta-sync on an indexed modification-timestamp beats OFFSET paging.
- Dates via ODBC: `{d '2026-01-01'}` / `{ts '2026-01-01 14:35:10'}` (SQL-92 `DATE '...'` also OK). **`BETWEEN` on dates is pathologically slow — use `>= AND <=`.**
- Empty string = NULL in FileMaker (`col = ''` matches nothing → use `IS NULL`). String compare is CASE-SENSITIVE; `LOWER()` fix kills index use. No TRUE/FALSE — use 1/0. No RIGHT/FULL OUTER JOIN (rewrite as LEFT).
- **Unstored calculation/summary fields are per-row-evaluated, non-indexable, and ShopWorks schemas are full of them** — one in a WHERE (or even SELECT list) turns sub-second into minutes and spikes FMS CPU for OnSite users. Explicit column lists only, never `SELECT *`.
- Assume queries are SERIALIZED through the listener (fixed ~FM19; OnSite embeds older FMS) → ONE connection, sequential queries, connect/login timeouts set, retry-once-on-dead-connection.

## Decided architecture (when built): push agent → proxy → Caspio

Heroku CANNOT reach the LAN DSN (no Linux Claris driver + port 2399 unreachable + never expose 2399 publicly). So:

1. **Windows agent** on the ODBC box (pyodbc is lowest-friction — prebuilt wheels, no build tools; node-odbc needs VS Build Tools when prebuilds miss). Scheduled by Windows Task Scheduler = drop-in analog of the Heroku Scheduler scripts (model: `caspio-pricing-proxy/scripts/sync-sanmar.js:24-52` — env BASE_URL + CRM_API_SECRET only, exit non-zero on failure).
2. **New proxy route** `src/routes/shopworks-odbc-sync.js` cloned from `POST /api/supacolor-jobs/bulk-upsert` (`src/routes/supacolor-jobs.js:813-873`): upsert by natural key, fill-only-empty patch semantics (+`?force=true`), per-row results summary; reuse `src/utils/caspio.js` helpers (`getCaspioAccessToken:15`, `makeCaspioRequest:54`, `putWithRecordsAffected:312`). Mount with `requireCrmApiSecret` (`src/middleware/index.js:44` — timing-safe `x-crm-api-secret`, already CORS-allowlisted) + a writeLimiter clone (`server.js:597-605`). Change-detection à la `scripts/sync-manageorders.js:30-39` CHANGE_FIELDS.
3. **Caspio tables** per entity (precedent: `ManageOrders_Orders`/`ManageOrders_LineItems`; note `Company_Contacts_Merge_ODBC` is literally named for a PRIOR ODBC feed). Website reads via ordinary proxy GETs — no new read path.
4. **Freshness watchdog mandatory** (Supacolor rule): Last_Sync heartbeat + `GET /api/shopworks-odbc/health` → Slack, so a dead shop box is VISIBLE (Erik's #1 rule — never silent stale data). Only the CRM secret lives on the shop machine — Caspio creds never leave Heroku.
5. Live-lookup escape hatch (only if ever needed): Cloudflare Tunnel + Access service token in front of a narrow local API — NOT raw SQL, NOT port 2399. VPN/Private Spaces rejected (cost/fit).

## ODBC fills these documented MO gaps (from MANAGEORDERS_COMPLETE_REFERENCE + CRM ref)

date_Due (MO has none — labels fall back to date_RequestedToShip) · ship method at receiving time ("cannot be put on a receiving label") · full customer master w/ terms/credit (MO "customers" = dedupe of last-60-day orders only) · employee/rep records (MO: dirty free text) · design records beyond id_Design/DesignName · vendor PO & receiving detail (MO: only coarse sts_Purchased/Received) · per-line/per-operation production status (MO: header-level codes only) · unlimited history + server-side SQL aggregation (kills the daily-sales-archive workaround class) · post-push edit visibility (snapshot-staleness bug class).
ODBC does NOT do: images/attachments (Box/mockup flows unaffected), writes (keep MO push), real-time webhooks (it's still pull).

## Next steps (in order)

1. Erik: screenshot OnSite screens w/ wanted fields highlighted → `support@shopworx.com` (ask for ODBC access + field mapping). Start small: order header due-date/status fields + customer master.
2. Pick the Windows box (a shipping machine may already have the driver — same installer) or a dedicated mini-PC; static LAN IP to the OnSite server; install driver + System DSN → `Data_ODBCMapping`; smoke-test from Excel/PowerShell before any code.
3. Build agent + proxy route per architecture above; 15-60 min cadence; watchdog first, data second.
