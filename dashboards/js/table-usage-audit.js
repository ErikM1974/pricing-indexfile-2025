/* ==========================================================================
   table-usage-audit.js — controller for the Caspio table-usage audit page.
   Static snapshot (2026-07-10) of all 163 tables + their usage signals, with
   client-side filter/sort/search, per-table review tracking (localStorage), a
   live-existence check via the proxy schema endpoint, and CSV export.

   Data keys: n=name, f=fieldCount, c=created, p/fe/i=code files in
   proxy/frontend/inksoft, u=usedBy[], dup=name-suspect(dup/old), amb=word-ambiguous.
   ========================================================================== */
(function () {
    'use strict';

    var DATA = [{"n":"Art_CustomerInfo_2024","f":16,"c":"2023-05-02","p":0,"fe":0,"i":0,"u":[],"dup":true,"amb":false},{"n":"ArtRequests_COPY","f":117,"c":"2026-06-25","p":0,"fe":0,"i":0,"u":[],"dup":true,"amb":false},{"n":"C_Files","f":12,"c":"2023-09-24","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"Christmas_Bundles_Streich_Bros","f":15,"c":"2025-11-06","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"Christmas_Bundles_WCTTR","f":14,"c":"2025-11-06","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"CreditCard_NWCA_ATMOS_copy","f":12,"c":"2026-06-19","p":0,"fe":0,"i":0,"u":[],"dup":true,"amb":false},{"n":"CreditCard_NWCA_ATMOS_COPY2","f":12,"c":"2026-06-29","p":0,"fe":0,"i":0,"u":[],"dup":true,"amb":false},{"n":"CreditCard_NWCA_ATMOS_prebackfil","f":12,"c":"2026-05-30","p":0,"fe":0,"i":0,"u":[],"dup":true,"amb":false},{"n":"Dfiles","f":7,"c":"2023-09-24","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"Digitizing_Mockups_copy","f":49,"c":"2026-04-23","p":0,"fe":0,"i":0,"u":[],"dup":true,"amb":false},{"n":"DTF_Pricing_copy","f":7,"c":"2026-06-19","p":0,"fe":0,"i":0,"u":[],"dup":true,"amb":false},{"n":"DTG_Garment_Rating","f":13,"c":"2022-04-21","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"Extra_Stitch_Price_Cust_2026","f":13,"c":"2026-02-10","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"Image_Uploads_Data_Base","f":8,"c":"2024-07-22","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"Incoming_Orders_Staging","f":42,"c":"2025-09-09","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"jdesigns","f":9,"c":"2023-09-24","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"Lfiles","f":12,"c":"2023-09-24","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"Log_Date_LastOrdered","f":16,"c":"2021-03-03","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"Logo_Positions","f":4,"c":"2025-08-25","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"ManageOrders_Orders_copy","f":48,"c":"2026-03-30","p":0,"fe":0,"i":0,"u":[],"dup":true,"amb":false},{"n":"mdesigns","f":11,"c":"2023-09-23","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"Mega_File_One","f":10,"c":"2023-09-24","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"Mega_File_Two","f":9,"c":"2023-09-24","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"Old_Designs_All_COPY","f":7,"c":"2026-02-27","p":0,"fe":0,"i":0,"u":[],"dup":true,"amb":false},{"n":"Payroll_Bradley_2023","f":17,"c":"2023-12-13","p":0,"fe":0,"i":0,"u":[],"dup":true,"amb":false},{"n":"pfiles","f":10,"c":"2023-09-24","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"Rdesigns","f":9,"c":"2023-09-24","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"slu_Location_Reference","f":1,"c":"2026-02-28","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"StyleSearch","f":3,"c":"2025-03-31","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"tbl_B_of_A_Statement","f":31,"c":"2023-06-23","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"tbl_B_of_A_Statement_copy","f":31,"c":"2026-04-15","p":0,"fe":0,"i":0,"u":[],"dup":true,"amb":false},{"n":"tdesigns","f":8,"c":"2023-09-24","p":0,"fe":0,"i":0,"u":[],"dup":false,"amb":false},{"n":"Account_Assignment_History","f":11,"c":"2026-01-24","p":2,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"ArtCharges","f":10,"c":"2026-03-08","p":2,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Banner_Pricing","f":7,"c":"2026-05-15","p":6,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"BD_Admins","f":14,"c":"2019-05-11","p":0,"fe":0,"i":0,"u":["view"],"dup":false,"amb":false},{"n":"Box_Contents","f":23,"c":"2026-04-01","p":0,"fe":15,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Box_Density_Reference","f":2,"c":"2026-06-07","p":8,"fe":1,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Box_Link_Sanmar_Credits_2024","f":4,"c":"2024-03-20","p":0,"fe":0,"i":0,"u":["view"],"dup":true,"amb":false},{"n":"Box_Shipments","f":19,"c":"2026-04-01","p":0,"fe":7,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"CAPS_Catalog_2026","f":10,"c":"2026-06-11","p":4,"fe":2,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Cart_Item_Sizes","f":5,"c":"2025-04-18","p":4,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Cart_Items","f":11,"c":"2025-04-18","p":8,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Cart_Sessions","f":7,"c":"2025-04-18","p":4,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Comments","f":13,"c":"2022-04-22","p":3,"fe":0,"i":0,"u":["code"],"dup":false,"amb":true},{"n":"Commission_Payouts","f":18,"c":"2026-03-31","p":10,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Contract_DTG_Costs","f":3,"c":"2026-05-15","p":4,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"CreditCard_NWCA_ATMOS","f":12,"c":"2025-12-23","p":7,"fe":0,"i":2,"u":["code"],"dup":false,"amb":false},{"n":"Custom_Decal_Pricing","f":7,"c":"2026-06-18","p":4,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Customer_Info","f":14,"c":"2025-04-18","p":4,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Customer_Portal_Access","f":6,"c":"2026-06-30","p":11,"fe":6,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Customer_Profile_10yr_2026","f":34,"c":"2026-05-25","p":4,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Customer_Reward_Ledger","f":8,"c":"2026-07-01","p":5,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Customer_Service_History","f":6,"c":"2026-05-04","p":7,"fe":5,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Customer_Service_Overrides","f":6,"c":"2026-05-04","p":1,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Decoration_Method_Overrides","f":4,"c":"2026-06-11","p":10,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Decoration_Method_Rules","f":7,"c":"2026-06-11","p":10,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Design_Lookup_2026","f":30,"c":"2026-02-24","p":45,"fe":7,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Designs_ODBC_2025","f":18,"c":"2023-05-30","p":0,"fe":0,"i":0,"u":["task"],"dup":false,"amb":false},{"n":"Digitized_Designs_Master_2026","f":33,"c":"2026-02-17","p":8,"fe":2,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Digitizing_Mockup_Notes","f":7,"c":"2026-03-15","p":5,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Digitizing_Mockup_Versions","f":10,"c":"2026-03-16","p":4,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"DTF_Pricing","f":12,"c":"2025-08-31","p":8,"fe":7,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"DTG_Calibration","f":10,"c":"2026-06-10","p":4,"fe":4,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"DTG_Costs","f":5,"c":"2025-04-11","p":14,"fe":12,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"DTG_Top_Sellers_2026","f":22,"c":"2026-05-18","p":10,"fe":2,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"EMB_Design_Files","f":37,"c":"2026-03-20","p":5,"fe":1,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Emblem_Pricing","f":3,"c":"2026-05-01","p":4,"fe":1,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Emblem_Pricing_Rules","f":3,"c":"2026-05-01","p":3,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Embroidery_Costs","f":16,"c":"2025-04-11","p":44,"fe":44,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Employee_Reviews","f":27,"c":"2022-01-14","p":0,"fe":0,"i":0,"u":["rel"],"dup":false,"amb":false},{"n":"Garment_Details","f":14,"c":"2024-07-15","p":0,"fe":2,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"GarmentTracker","f":13,"c":"2026-01-09","p":23,"fe":25,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"GarmentTrackerArchive","f":11,"c":"2026-01-25","p":10,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"House_Accounts","f":6,"c":"2026-01-22","p":26,"fe":1,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"House_Daily_Sales_By_Account","f":8,"c":"2026-01-22","p":8,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Industry_Lookalikes_2026","f":17,"c":"2026-05-25","p":6,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Inksoft_Deposits","f":7,"c":"2024-09-04","p":0,"fe":1,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Inksoft_Gift_Certificates","f":13,"c":"2025-12-18","p":8,"fe":1,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Inksoft_Transform","f":12,"c":"2025-12-14","p":0,"fe":0,"i":1,"u":["code"],"dup":false,"amb":false},{"n":"Inksoft_Transform_Designs_seed","f":9,"c":"2025-12-31","p":2,"fe":0,"i":0,"u":["code"],"dup":true,"amb":false},{"n":"JDS_Catalog","f":13,"c":"2026-05-07","p":4,"fe":4,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Kanha_Nai_Production_Log","f":11,"c":"2023-10-06","p":0,"fe":1,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"location","f":3,"c":"2025-06-18","p":251,"fe":2255,"i":48,"u":["code"],"dup":false,"amb":true},{"n":"ManageOrders_LineItems","f":13,"c":"2026-03-29","p":20,"fe":2,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"ManageOrders_Orders","f":49,"c":"2026-03-29","p":45,"fe":2,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Mockup_AI_Analysis","f":28,"c":"2026-03-18","p":5,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Mockup_Print_Locations","f":12,"c":"2026-03-18","p":5,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Monograms","f":16,"c":"2026-01-09","p":16,"fe":18,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Names_Numbers_Rosters","f":17,"c":"2026-04-15","p":2,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Nika_All_Accounts_Caspio","f":85,"c":"2026-01-22","p":11,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Nika_Daily_Sales_By_Account","f":6,"c":"2026-01-22","p":4,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Non_SanMar_Products","f":20,"c":"2026-02-03","p":16,"fe":5,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"NW_Daily_Sales_By_Rep","f":5,"c":"2026-01-02","p":7,"fe":2,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Old_Designs_All","f":16,"c":"2023-09-25","p":0,"fe":0,"i":0,"u":["view"],"dup":true,"amb":false},{"n":"Order_Payments","f":9,"c":"2026-07-05","p":7,"fe":9,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Orders_Shopworks_API","f":42,"c":"2025-09-09","p":0,"fe":0,"i":0,"u":["task"],"dup":false,"amb":false},{"n":"Policies","f":17,"c":"2026-05-14","p":21,"fe":73,"i":0,"u":["code"],"dup":false,"amb":true},{"n":"Policy_Comments","f":10,"c":"2026-05-14","p":1,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Portal_Recommendations","f":13,"c":"2026-06-30","p":9,"fe":1,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Portal_Reorder_Requests","f":18,"c":"2026-06-30","p":13,"fe":1,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Pricing_Rules","f":4,"c":"2025-04-11","p":8,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Pricing_Tiers","f":9,"c":"2025-04-11","p":29,"fe":38,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Product_Upgrades","f":13,"c":"2026-07-02","p":3,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Production_Schedules","f":17,"c":"2021-08-17","p":1,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Quote_Analytics","f":13,"c":"2025-05-29","p":16,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Quote_Change_Log","f":13,"c":"2026-05-22","p":3,"fe":8,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"quote_counters","f":4,"c":"2026-01-15","p":3,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Quote_Items","f":47,"c":"2025-05-29","p":29,"fe":2,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Quote_Sessions","f":109,"c":"2025-05-29","p":26,"fe":8,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Safety_Stripe_Top_Sellers_2026","f":10,"c":"2026-06-28","p":7,"fe":1,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"sales_tax_accounts_2026","f":10,"c":"2026-02-11","p":10,"fe":6,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"SanMar_Invoice_Items","f":8,"c":"2026-03-28","p":2,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"SanMar_Invoices","f":16,"c":"2026-03-28","p":2,"fe":0,"i":1,"u":["code"],"dup":false,"amb":false},{"n":"SanMar_Order_Items","f":13,"c":"2026-03-28","p":6,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"SanMar_Orders","f":22,"c":"2026-03-28","p":18,"fe":4,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"SanMar_Shipments","f":16,"c":"2026-03-28","p":4,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Sanmar_Style_Performance_10yr_26","f":25,"c":"2026-05-25","p":5,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Screenprint_Costs","f":6,"c":"2025-04-11","p":2,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Service_Codes","f":20,"c":"2026-02-01","p":22,"fe":110,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"ShopWorks_Designs","f":13,"c":"2026-02-20","p":12,"fe":6,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Size_Display_Order","f":2,"c":"2025-06-18","p":10,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"staff_announcements","f":12,"c":"2025-07-06","p":1,"fe":2,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Staff_App_Roles","f":2,"c":"2026-06-30","p":10,"fe":7,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Staff_Page_Access","f":4,"c":"2026-06-30","p":10,"fe":9,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Standard_Size_Upcharges","f":3,"c":"2025-05-18","p":5,"fe":1,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Sticker_Pricing","f":6,"c":"2026-05-15","p":6,"fe":1,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Supacolor_Job_History","f":5,"c":"2026-04-19","p":3,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Supacolor_Joblines","f":12,"c":"2026-04-19","p":3,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Supacolor_Jobs","f":27,"c":"2026-04-19","p":31,"fe":13,"i":8,"u":["code"],"dup":false,"amb":false},{"n":"Taneisha_All_Accounts_Caspio","f":85,"c":"2026-01-21","p":11,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Taneisha_Daily_Sales_By_Account","f":6,"c":"2026-01-22","p":4,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"tbl_sanmar_invoices_MASTER","f":14,"c":"2020-01-28","p":0,"fe":0,"i":0,"u":["rel"],"dup":false,"amb":false},{"n":"tbl_vendor_basics","f":4,"c":"2018-08-16","p":2,"fe":0,"i":8,"u":["code"],"dup":false,"amb":false},{"n":"ThreadColors","f":6,"c":"2024-07-15","p":6,"fe":3,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Transfer_Freight","f":4,"c":"2025-08-31","p":3,"fe":4,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Transfer_Order_Files","f":14,"c":"2026-04-28","p":13,"fe":1,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Transfer_Order_Lines","f":10,"c":"2026-04-24","p":7,"fe":4,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Transfer_Order_Notes","f":6,"c":"2026-04-18","p":7,"fe":0,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Transfer_Orders","f":55,"c":"2026-04-18","p":42,"fe":9,"i":0,"u":["code"],"dup":false,"amb":false},{"n":"Box_Link_Sanmar_Invoices","f":5,"c":"2020-07-14","p":0,"fe":0,"i":0,"u":["view","rel"],"dup":false,"amb":false},{"n":"Bundle_Items_Structure","f":11,"c":"2025-11-05","p":0,"fe":0,"i":0,"u":["view","rel"],"dup":false,"amb":false},{"n":"Christmas_Bundles_DrainPro","f":14,"c":"2025-11-05","p":0,"fe":0,"i":0,"u":["view","rel"],"dup":false,"amb":false},{"n":"CompanyContactsMerge2026","f":50,"c":"2026-04-08","p":26,"fe":15,"i":0,"u":["code","task"],"dup":false,"amb":false},{"n":"Design_Statuses","f":5,"c":"2025-09-08","p":0,"fe":0,"i":0,"u":["view","rel"],"dup":false,"amb":false},{"n":"DesignNotes","f":8,"c":"2025-07-18","p":9,"fe":2,"i":0,"u":["code","rel"],"dup":false,"amb":false},{"n":"Designs2026","f":18,"c":"2026-04-06","p":6,"fe":0,"i":0,"u":["code","task"],"dup":false,"amb":false},{"n":"Digitizing_Mockups","f":56,"c":"2026-03-15","p":58,"fe":0,"i":0,"u":["code","webhook"],"dup":false,"amb":false},{"n":"Mockup_Types","f":5,"c":"2025-09-08","p":0,"fe":0,"i":0,"u":["view","rel"],"dup":false,"amb":false},{"n":"Sales_Reps_2026","f":6,"c":"2026-01-23","p":84,"fe":8,"i":0,"u":["code","task"],"dup":false,"amb":false},{"n":"Shopworks_Thumbnail_Report","f":14,"c":"2025-12-19","p":24,"fe":3,"i":0,"u":["code","task"],"dup":false,"amb":false},{"n":"tbl_BOX_Invoices_SM","f":5,"c":"2020-01-24","p":0,"fe":1,"i":0,"u":["code","rel"],"dup":false,"amb":false},{"n":"Artists","f":5,"c":"2025-09-08","p":4,"fe":0,"i":0,"u":["code","view","rel"],"dup":false,"amb":false},{"n":"ArtRequests","f":123,"c":"2019-12-16","p":101,"fe":13,"i":0,"u":["code","rel","webhook"],"dup":false,"amb":false},{"n":"Company_Contacts_Merge_ODBC","f":39,"c":"2021-03-02","p":10,"fe":2,"i":0,"u":["code","rel","task"],"dup":false,"amb":false},{"n":"Employees","f":38,"c":"2022-01-10","p":0,"fe":11,"i":0,"u":["code","view","rel"],"dup":false,"amb":false},{"n":"Mockups","f":31,"c":"2025-08-20","p":53,"fe":56,"i":0,"u":["code","view","rel"],"dup":false,"amb":false},{"n":"ORDER_ODBC","f":46,"c":"2021-03-05","p":20,"fe":3,"i":0,"u":["code","rel","task"],"dup":false,"amb":false},{"n":"PurchaseOrders","f":19,"c":"2026-04-29","p":18,"fe":1,"i":11,"u":["code","task","webhook"],"dup":false,"amb":false},{"n":"Sanmar_Bulk_251816_Feb2024","f":65,"c":"2023-04-17","p":69,"fe":3,"i":0,"u":["code","view","rel"],"dup":false,"amb":false},{"n":"Sanmar_Pricing_2025","f":53,"c":"2024-05-16","p":0,"fe":1,"i":0,"u":["code","view","rel"],"dup":false,"amb":false},{"n":"tbl_Invoices_Sanmar","f":13,"c":"2020-07-14","p":0,"fe":1,"i":0,"u":["code","view","rel"],"dup":false,"amb":false},{"n":"Time_Off_Request","f":13,"c":"2022-01-12","p":0,"fe":3,"i":0,"u":["code","view","rel"],"dup":false,"amb":false}];

    // Tables that plausibly live in a DataPage / Flex app (API can't confirm — UI check)
    var FLEX_HINT = {
        'Christmas_Bundles_WCTTR': 'Christmas Bundles Flex app?',
        'Christmas_Bundles_Streich_Bros': 'Christmas Bundles Flex app?',
        'tbl_B_of_A_Statement': 'bank recon DataPage?',
        'Incoming_Orders_Staging': 'staging pipeline/DataPage?',
        'StyleSearch': 'search DataPage?'
    };

    var LS_KEY = 'nwca_table_audit_review_v1';
    var review = {};
    try { review = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) { review = {}; }
    function saveReview() { try { localStorage.setItem(LS_KEY, JSON.stringify(review)); } catch (e) {} }
    function rv(name) { return review[name] || {}; }

    // Live-refresh state. code/task are baked (repo-side, not browser-refreshable); a
    // Refresh re-pulls view/rel/webhook wiring + fieldCount + which tables still exist.
    var refreshed = false, refreshedAt = null;
    DATA.forEach(function (r) { r._code = r.u.indexOf('code') > -1; r._task = r.u.indexOf('task') > -1; });

    function applyLive(payload) {
        var info = {}, liveSet = {};
        (payload.tables || []).forEach(function (t) { info[t.n || t.name] = t; liveSet[t.n || t.name] = 1; });
        DATA.forEach(function (r) {
            var L = info[r.n];
            if (L) {
                r._exists = true; r._fieldNow = L.fieldCount;
                var u = [];
                if (r._code) u.push('code');
                if (L.view) u.push('view');
                if (L.rel) u.push('rel');
                if (r._task) u.push('task');
                if (L.webhook) u.push('webhook');
                r.u = u;
            } else { r._exists = false; }
        });
        Object.keys(liveSet).forEach(function (name) {
            if (!DATA.some(function (r) { return r.n === name; })) {
                var L = info[name], u = [];
                if (L.view) u.push('view'); if (L.rel) u.push('rel'); if (L.webhook) u.push('webhook');
                DATA.push({ n: name, f: L.fieldCount, c: '(new)', p: 0, fe: 0, i: 0, u: u, dup: false, amb: false, _new: true, _exists: true, _fieldNow: L.fieldCount, _code: false, _task: false });
            }
        });
        refreshed = true; refreshedAt = payload.generatedAt;
    }

    function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
    function tierOf(r) { return r.u.length > 0 ? 'used' : (r.dup ? 'tierA' : 'tierB'); }

    var els = {
        table: document.getElementById('tuaTable'),
        count: document.getElementById('tuaCount'),
        search: document.getElementById('tuaSearch'),
        filters: document.getElementById('tuaFilters'),
    };
    var state = { filter: 'all', q: '', sort: 'tier', dir: 1 };

    function matches(r) {
        if (state.q && r.n.toLowerCase().indexOf(state.q) === -1) return false;
        var t = tierOf(r);
        if (state.filter === 'all') return true;
        if (state.filter === 'cand') return r.u.length === 0;
        if (state.filter === 'used') return t === 'used';
        return t === state.filter;
    }
    var TIER_ORDER = { tierA: 0, tierB: 1, used: 2 };
    function cmp(a, b) {
        var s = state.sort, d = state.dir, va, vb;
        if (s === 'tier') { va = TIER_ORDER[tierOf(a)]; vb = TIER_ORDER[tierOf(b)]; }
        else if (s === 'name') { va = a.n.toLowerCase(); vb = b.n.toLowerCase(); }
        else if (s === 'fields') { va = a.f; vb = b.f; }
        else if (s === 'created') { va = a.c; vb = b.c; }
        else if (s === 'code') { va = a.p + a.fe + a.i; vb = b.p + b.fe + b.i; }
        if (va < vb) return -1 * d; if (va > vb) return 1 * d; return a.n.localeCompare(b.n);
    }

    function sigChips(r) { return r.u.map(function (s) { return '<span class="tua-sig ' + s + '">' + s + '</span>'; }).join(' ') || '<span style="color:var(--gray-400)">—</span>'; }
    function flagChips(r) {
        var out = [];
        if (r.dup) out.push('<span class="tua-flag dup" title="Name looks like a backup/old copy">dup/old</span>');
        if (r.amb) out.push('<span class="tua-flag word" title="Common word — code hits may be the English word, not the table">word</span>');
        if (FLEX_HINT[r.n]) out.push('<span class="tua-flag flex" title="' + esc(FLEX_HINT[r.n]) + '">flex?</span>');
        return '<div class="tua-flags">' + out.join('') + '</div>';
    }
    function tierBadge(r) {
        var t = tierOf(r);
        if (t === 'tierA') return '<span class="tua-tier tua-tier--a" title="No usage + backup/old name — safest to archive">⛔</span>';
        if (t === 'tierB') return '<span class="tua-tier tua-tier--b" title="No code/API usage — verify DataPages before archiving">⚠</span>';
        return '<span class="tua-tier tua-tier--used" title="In use">✓</span>';
    }
    function liveCell(r) {
        if (!refreshed) return '';
        if (r._new) return '<span class="tua-live-new">NEW</span>';
        return r._exists ? '<span class="tua-live-exists">exists</span>' : '<span class="tua-live-gone">✓ gone</span>';
    }
    function fieldCell(r) {
        var fc = (r._fieldNow != null ? r._fieldNow : r.f);
        return fc + (r._fieldNow != null && r._fieldNow !== r.f ? ' <span class="tua-fchg" title="was ' + r.f + '">✎</span>' : '');
    }
    var DECISIONS = ['', 'keep', 'archive', 'deleted'];
    function decideCell(r) {
        var cur = rv(r.n).dec || '';
        var opts = DECISIONS.map(function (d) { return '<option value="' + d + '"' + (d === cur ? ' selected' : '') + '>' + (d || '—') + '</option>'; }).join('');
        return '<select class="tua-decide d-' + esc(cur) + '" data-n="' + esc(r.n) + '">' + opts + '</select>';
    }

    function render() {
        var rows = DATA.filter(matches).slice().sort(cmp);
        var head = '<thead><tr>' +
            '<th class="no-sort" title="Mark reviewed">✓</th>' +
            '<th data-sort="tier">Tier</th>' +
            '<th data-sort="name">Table</th>' +
            '<th data-sort="fields">#f</th>' +
            '<th data-sort="created">Created</th>' +
            '<th data-sort="code">code p/f/i</th>' +
            '<th class="no-sort">used by</th>' +
            '<th class="no-sort">flags</th>' +
            '<th class="no-sort">decision</th>' +
            '<th class="no-sort">notes</th>' +
            (refreshed ? '<th class="no-sort">live</th>' : '') +
            '</tr></thead>';
        var body = rows.map(function (r) {
            var st = rv(r.n);
            return '<tr class="' + (st.rev ? 'is-reviewed' : '') + '" data-n="' + esc(r.n) + '">' +
                '<td><input type="checkbox" class="tua-rev" data-n="' + esc(r.n) + '"' + (st.rev ? ' checked' : '') + '></td>' +
                '<td>' + tierBadge(r) + '</td>' +
                '<td class="tua-name">' + esc(r.n) + (r._new ? ' <span class="tua-flag flex">new</span>' : '') + '</td>' +
                '<td>' + fieldCell(r) + '</td>' +
                '<td>' + esc(r.c) + '</td>' +
                '<td class="tua-code">' + r.p + '/' + r.fe + '/' + r.i + '</td>' +
                '<td>' + sigChips(r) + '</td>' +
                '<td>' + flagChips(r) + '</td>' +
                '<td>' + decideCell(r) + '</td>' +
                '<td><input type="text" class="tua-note" data-n="' + esc(r.n) + '" value="' + esc(st.note || '') + '" placeholder="…"></td>' +
                (refreshed ? '<td>' + liveCell(r) + '</td>' : '') +
                '</tr>';
        }).join('');
        els.table.innerHTML = head + '<tbody>' + (rows.length ? body : '<tr><td colspan="11" class="tua-empty">No tables match.</td></tr>') + '</tbody>';
        els.count.textContent = rows.length + ' of ' + DATA.length + ' tables shown';
    }

    function refreshStats() {
        var used = DATA.filter(function (r) { return r.u.length > 0; }).length;
        var reviewed = Object.keys(review).filter(function (k) { return review[k] && review[k].rev; }).length;
        document.getElementById('stTotal').textContent = DATA.length;
        document.getElementById('stUsed').textContent = used;
        document.getElementById('stCand').textContent = DATA.length - used;
        document.getElementById('stReviewed').textContent = reviewed;
    }

    // ---- events (delegated) ----
    els.table.addEventListener('change', function (e) {
        var n = e.target.getAttribute('data-n'); if (!n) return;
        var st = review[n] = review[n] || {};
        if (e.target.classList.contains('tua-rev')) { st.rev = e.target.checked; e.target.closest('tr').classList.toggle('is-reviewed', st.rev); refreshStats(); }
        else if (e.target.classList.contains('tua-decide')) { st.dec = e.target.value; e.target.className = 'tua-decide d-' + st.dec; }
        saveReview();
    });
    els.table.addEventListener('input', function (e) {
        var n = e.target.getAttribute('data-n'); if (!n || !e.target.classList.contains('tua-note')) return;
        (review[n] = review[n] || {}).note = e.target.value; saveReview();
    });
    els.table.addEventListener('click', function (e) {
        var th = e.target.closest('th[data-sort]'); if (!th) return;
        var s = th.getAttribute('data-sort');
        if (state.sort === s) state.dir *= -1; else { state.sort = s; state.dir = 1; }
        render();
    });
    els.filters.addEventListener('click', function (e) {
        var b = e.target.closest('.tua-chip'); if (!b) return;
        state.filter = b.getAttribute('data-filter');
        Array.prototype.forEach.call(els.filters.children, function (c) { c.classList.toggle('is-active', c === b); });
        render();
    });
    els.search.addEventListener('input', function () { state.q = els.search.value.trim().toLowerCase(); render(); });

    // ---- live refresh (proxy /usage: view/rel/webhook wiring + fieldCount + new/gone) ----
    var liveInfoEl = document.getElementById('tuaLiveInfo');
    document.getElementById('tuaLive').addEventListener('click', function () {
        var btn = this; btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing…';
        DashPage.fetchJson('/api/caspio-schema/usage')
            .then(function (j) {
                applyLive(j);
                refreshStats(); render();
                var gone = DATA.filter(function (r) { return r._exists === false; }).length;
                var isnew = DATA.filter(function (r) { return r._new; }).length;
                btn.disabled = false; btn.innerHTML = '<i class="fas fa-rotate"></i> Refresh (live)';
                if (liveInfoEl) liveInfoEl.textContent = 'live: ' + (j.count || 0) + ' tables'
                    + (isnew ? ' · ' + isnew + ' new' : '') + (gone ? ' · ' + gone + ' gone' : '')
                    + ' · ' + new Date(j.generatedAt).toLocaleTimeString();
            })
            .catch(function (err) {
                console.error('refresh failed:', err);
                DashPage.showError('Could not reach the live schema (proxy /api/caspio-schema/usage). Try again.');
                btn.disabled = false; btn.innerHTML = '<i class="fas fa-rotate"></i> Refresh (live)';
            });
    });

    // ---- CSV export of the full audit + your review ----
    document.getElementById('tuaExport').addEventListener('click', function () {
        var head = ['table', 'tier', 'fields', 'created', 'code_proxy', 'code_frontend', 'code_inksoft', 'usedBy', 'dup_old', 'word_ambiguous', 'flex_hint', 'reviewed', 'decision', 'notes'];
        var lines = [head.join(',')];
        DATA.slice().sort(cmp).forEach(function (r) {
            var st = rv(r.n);
            var row = [r.n, tierOf(r), r.f, r.c, r.p, r.fe, r.i, '"' + r.u.join(' ') + '"', r.dup, r.amb, '"' + (FLEX_HINT[r.n] || '') + '"', !!st.rev, st.dec || '', '"' + String(st.note || '').replace(/"/g, '""') + '"'];
            lines.push(row.join(','));
        });
        var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'caspio-table-audit-review.csv';
        document.body.appendChild(a); a.click(); a.remove();
    });

    refreshStats();
    render();
})();
