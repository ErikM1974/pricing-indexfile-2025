# Caspio v4 — Live Account Inventory Snapshot (2026-07-09)

> Captured from an **authenticated** read of the real `c3eku948` account via REST v4 (Erik's short-lived token, since revoked). Read-only GETs only. **Re-pull for current truth** — object lists drift. Companion to [CASPIO_REST_API_V4_REFERENCE.md](CASPIO_REST_API_V4_REFERENCE.md) (the contract) and the v3 doc's §7 live-inventory.
>
> Re-pull: `curl -s -H "Authorization: Bearer <token>" https://c3eku948.caspio.com/integrations/rest/v4/tables?pageSize=1000 | jq -r '.data[].name'` (token via OAuth client_credentials / the API-Profile UI).

## Profile & limits (`GET /v4/me`)
- **Profile:** `ProdDetailsAPI` · account `c3eku948` · token TTL ~24h.
- **Rate limit:** **2000 requests / 300s** window (`rateLimit.limit=2000, windowSeconds=300`).
- **Scope:** this profile returned **all 163 tables** → effectively *"Enable access to all objects"* is ON. (Confirms the 73.0 granular-perms change is not gating our reads.)

## Counts
| Object | Count |
|---|---|
| Tables | **163** |
| Views | 19 |
| Directories | 1 (`Staff`) |
| Flex apps | 1 (`Christmas Bundles`) |
| Bridge apps | 14 |
| Outgoing webhooks | 24 (all Zapier) |

## ⭐ Outgoing webhooks — migration-relevant finding
All **24** are `Zapier-ZapID_subscription:*` (Active), auto-created by Zapier ("don't modify"). Every webhook whose event was visible uses **`eventSources:["Datasheet"]`** — i.e. they fire **only on manual datasheet edits, NOT on REST/API writes** — and carry the secret in-payload via `[@out-hook:secret]` (compatibility mode). Visible object bindings:
- `ArtRequests` ×3 (recordInsert, Datasheet)
- `Digitizing_Mockups` ×2 (Datasheet)
- `PurchaseOrders` ×1 (Datasheet)
- (remaining ~18 had no event object visible to this profile summary)

**Implication:** none of the existing webhooks fire on proxy REST writes, so a **new** proxy-owned webhook with `eventSources` including `RESTAPIs` is a clean, non-conflicting addition — the basis for converting a polling cron → authenticated push (start with `Quote_Sessions`). Verify the ShopWorks→Caspio sync actually writes *through* Caspio REST first, else it won't fire.

## Key table IDs + sample schemas (`GET /v4/tables/{id}/fields`)
`name : dataType : editable` (editable=false ⇒ auto-generated, never send in write bodies).

- **Quote_Sessions** = `x2y7pe` (large; ~decoration/pricing fields). Notables: `CreatedAt : TIMESTAMP : false` (auto) vs `CreatedAt_Quote : DATE/TIME : true`; JSON blobs `ColorConfigsJSON`/`CustomerDataJSON`/`DesignNumbers` are `TEXT64K`. (No maintained `UpdatedAt` — key on `CreatedAt`, per prior lesson.)
- **Service_Codes** = `v4c5vz`: `ServiceCode, ServiceType, DisplayName, Category, SellPrice(NUMBER), UnitCost(NUMBER), Tier, TierLabel, PricingMethod, PerUnit, RailGroup/RailOrder, IsActive(YES/NO), Visible(YES/NO), Position, SortOrder, AliasFor, StitchBase, QuoteBuilderField`.
- **Pricing_Tiers** = `d7e9rz`: `DecorationMethod, TierLabel, MinQuantity(INT), MaxQuantity(INT), MarginDenominator(NUMBER), TargetMargin(NUMBER), LTM_Fee(CURRENCY), TierID(AUTONUMBER), Date_Updated(TIMESTAMP,false)`.
- **Non_SanMar_Products** = `o5i3xx` (product-manager dashboard): `StyleNumber, ProductName, Brand, Category, DefaultCost(NUMBER), DefaultSellPrice(NUMBER), MarginPercent(INT), PricingMethod, AvailableSizes, DefaultColors, SizeUpchargeXL/2XL/3XL(INT), ImageURL, VendorCode, VendorURL, IsActive(YES/NO), ID_Product(AUTONUMBER)`.

## Full table list (163, alphabetical — 2026-07-09)
Account_Assignment_History, ArtCharges, ArtRequests, ArtRequests_COPY, Art_CustomerInfo_2024, Artists, BD_Admins, Banner_Pricing, Box_Contents, Box_Density_Reference, Box_Link_Sanmar_Credits_2024, Box_Link_Sanmar_Invoices, Box_Shipments, Bundle_Items_Structure, CAPS_Catalog_2026, C_Files, Cart_Item_Sizes, Cart_Items, Cart_Sessions, Christmas_Bundles_DrainPro, Christmas_Bundles_Streich_Bros, Christmas_Bundles_WCTTR, Comments, Commission_Payouts, CompanyContactsMerge2026, Company_Contacts_Merge_ODBC, Contract_DTG_Costs, CreditCard_NWCA_ATMOS, CreditCard_NWCA_ATMOS_COPY2, CreditCard_NWCA_ATMOS_copy, CreditCard_NWCA_ATMOS_prebackfil, Custom_Decal_Pricing, Customer_Info, Customer_Portal_Access, Customer_Profile_10yr_2026, Customer_Reward_Ledger, Customer_Service_History, Customer_Service_Overrides, DTF_Pricing, DTF_Pricing_copy, DTG_Calibration, DTG_Costs, DTG_Garment_Rating, DTG_Top_Sellers_2026, Decoration_Method_Overrides, Decoration_Method_Rules, DesignNotes, Design_Lookup_2026, Design_Statuses, Designs2026, Designs_ODBC_2025, Dfiles, Digitized_Designs_Master_2026, Digitizing_Mockup_Notes, Digitizing_Mockup_Versions, Digitizing_Mockups, Digitizing_Mockups_copy, EMB_Design_Files, Emblem_Pricing, Emblem_Pricing_Rules, Embroidery_Costs, Employee_Reviews, Employees, Extra_Stitch_Price_Cust_2026, GarmentTracker, GarmentTrackerArchive, Garment_Details, House_Accounts, House_Daily_Sales_By_Account, Image_Uploads_Data_Base, Incoming_Orders_Staging, Industry_Lookalikes_2026, Inksoft_Deposits, Inksoft_Gift_Certificates, Inksoft_Transform, Inksoft_Transform_Designs_seed, JDS_Catalog, Kanha_Nai_Production_Log, Lfiles, Log_Date_LastOrdered, Logo_Positions, ManageOrders_LineItems, ManageOrders_Orders, ManageOrders_Orders_copy, Mega_File_One, Mega_File_Two, Mockup_AI_Analysis, Mockup_Print_Locations, Mockup_Types, Mockups, Monograms, NW_Daily_Sales_By_Rep, Names_Numbers_Rosters, Nika_All_Accounts_Caspio, Nika_Daily_Sales_By_Account, Non_SanMar_Products, ORDER_ODBC, Old_Designs_All, Old_Designs_All_COPY, Order_Payments, Orders_Shopworks_API, Payroll_Bradley_2023, Policies, Policy_Comments, Portal_Recommendations, Portal_Reorder_Requests, Pricing_Rules, Pricing_Tiers, Product_Upgrades, Production_Schedules, PurchaseOrders, Quote_Analytics, Quote_Change_Log, Quote_Items, Quote_Sessions, Rdesigns, Safety_Stripe_Top_Sellers_2026, Sales_Reps_2026, SanMar_Invoice_Items, SanMar_Invoices, SanMar_Order_Items, SanMar_Orders, SanMar_Shipments, Sanmar_Bulk_251816_Feb2024, Sanmar_Pricing_2025, Sanmar_Style_Performance_10yr_26, Screenprint_Costs, Service_Codes, ShopWorks_Designs, Shopworks_Thumbnail_Report, Size_Display_Order, Staff_App_Roles, Staff_Page_Access, Standard_Size_Upcharges, Sticker_Pricing, StyleSearch, Supacolor_Job_History, Supacolor_Joblines, Supacolor_Jobs, Taneisha_All_Accounts_Caspio, Taneisha_Daily_Sales_By_Account, ThreadColors, Time_Off_Request, Transfer_Freight, Transfer_Order_Files, Transfer_Order_Lines, Transfer_Order_Notes, Transfer_Orders, jdesigns, location, mdesigns, pfiles, quote_counters, sales_tax_accounts_2026, slu_Location_Reference, staff_announcements, tbl_BOX_Invoices_SM, tbl_B_of_A_Statement, tbl_B_of_A_Statement_copy, tbl_Invoices_Sanmar, tbl_sanmar_invoices_MASTER, tbl_vendor_basics, tdesigns

## Views (19)
All_Employees, BD_Active_Admins, Bradley_Payroll, Employees, Erik_Active_Admin, Erik_Mickelson_Admin, Erik_Ruth_Mgrs, Invoices, Old_Designs_With_DST, Ruth_Admin, Ruth_Erik_Authentication, Sanmar_2025, Sanmar_2025_clone, Sanmar_Credits, Sanmar_Pricing_2024_NoCaps_View, Time_Off_REquest, VacationHours, XmasBundle25, vw_Mockups_Gallery

## Bridge apps (14)
Eriks Credit Card · Human Resources 2025 · Inksoft Deposits · Monograms · Nika and Taneisha 2026 · Old Designs · Policies · Production · Safety Stripes · Sanmar Pricing 2026 · Shopworks API 2025 · Steve Art · Transfers_EMB_Stickers_JDS · Xmas Box Labels

## Cleanup / housekeeping candidates spotted (verify before acting)
- `*_COPY` / `_copy` / `_COPY2` / `_prebackfil` / `_clone` duplicate tables: `ArtRequests_COPY`, `Digitizing_Mockups_copy`, `DTF_Pricing_copy`, `ManageOrders_Orders_copy`, `Old_Designs_All_COPY`, `CreditCard_NWCA_ATMOS_COPY2`/`_copy`/`_prebackfil`, `tbl_B_of_A_Statement_copy`, `Sanmar_2025_clone` — likely stale backups (do NOT delete via REST — table DELETE is 405 by design; clean up in the Caspio UI after confirming).
