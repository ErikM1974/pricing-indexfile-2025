/* ==========================================================================
   manageorders-api-reference.js — ManageOrders / OnSite External API cheat sheet.
   Field reference for the ShopWorks OnSite External (Push/Pull) API, from the public
   Swagger (app.swaggerhub.com/apis/ShopWorks/OnSiteExternalAPI/1.0.0) + the "reality"
   deltas + gotchas from memory/MANAGEORDERS_COMPLETE_REFERENCE.md (the canonical deep doc).
   Static reference + live filter across every field. No API calls.
   ========================================================================== */
(function () {
    'use strict';

    var ENDPOINTS = [
        ['POST', '/signin', 'Auth', 'Authenticate (AWS Cognito) → returns id_token bearer'],
        ['POST', '/order-push', 'Push', 'Create ONE order in OnSite. Proxy: POST /api/manageorders/orders/create'],
        ['GET', '/order-pull', 'Push', 'Download previously-pushed orders (verify/reconcile). ⚠ fields at TOP level, not wrapped in order_json (Swagger wrong)'],
        ['POST', '/track-push', 'Tracking', 'Push tracking numbers TO OnSite (requires OnSite v12+)'],
        ['GET', '/track-pull', 'Tracking', 'Retrieve tracking by upload date/time range'],
        ['GET', '/orders', 'Pull', 'List orders in a timeframe'],
        ['GET', '/getorderno/{ext_order_id}', 'Pull', 'Resolve ExtOrderID → WO#. NOT source-scoped; empty for builder ExtSources'],
        ['GET', '/lineitems/{order_no}', 'Pull', 'Line items — PartNumber + positional Size01–Size06 (Size06 = catch-all)'],
        ['GET', '/payments  ·  /payments/{order_no}', 'Pull', 'Payments (all, or by WO#)'],
        ['GET', '/tracking  ·  /tracking/{order_no}', 'Pull', 'Tracking (all, or by WO#). sts_* codes: 0=No 1=Yes .5=Partial 8/222=N/A'],
        ['GET', '/inventorylevels', 'Pull', 'Inventory levels'],
    ];

    // model = { name, desc, fields: [ [name, type, required(bool), note] ] }
    var MODELS = [
        { name: 'ExternalOrderJson', desc: 'The order-push root (POST /order-push). Nested arrays below.', fields: [
            ['ExtOrderID', 'string', true, 'Globally-unique external id — must carry FULL date+seq+YEAR (daily-reset seq collides in 24h). NWCA-{n}=InkSoft · EMB/DTF/SCP-{seq}=builders · OF-{n}=OrderForm. Dup push → 409.'],
            ['ExtSource', 'string', false, '= APISource — filters orders in the PULL API (NWCA / OrderForm / 3DT…). Set in OnSite Integration Settings.'],
            ['ExtCustomerID', 'string', false, ''],
            ['ExtCustomerPref', 'string', false, ''],
            ['date_OrderPlaced', 'string', false, '⚠ MM/DD/YYYY (NOT ISO/YYYY-MM-DD).'],
            ['date_OrderRequestedToShip', 'string', false, 'MM/DD/YYYY'],
            ['date_OrderDropDead', 'string', false, 'MM/DD/YYYY'],
            ['id_OrderType', 'number', false, 'OnSite order-type id.'],
            ['id_EmpCreatedBy', 'number', false, ''],
            ['id_Customer', 'number', false, 'Blank/unknown → 3739 default account.'],
            ['id_CompanyLocation', 'number', false, ''],
            ['id_SalesStatus', 'number', false, ''],
            ['id_ReceivingStatus', 'number', false, ''],
            ['id_ShippingStatus', 'number', false, ''],
            ['ContactEmail', 'string', false, ''],
            ['ContactNameFirst', 'string', false, ''],
            ['ContactNameLast', 'string', false, ''],
            ['ContactPhone', 'string', false, ''],
            ['CustomerPurchaseOrder', 'string', false, 'PO#. Storefront orders link by PO==QuoteID; builder quotes link by ExtOrderID.'],
            ['CustomerSeviceRep', 'string', false, '⚠ NOTE the typo — the API field is literally "CustomerSeviceRep" (missing r). PUSH + PULL both use it.'],
            ['OnHold', 'number', false, ''],
            ['Terms', 'string', false, ''],
            ['DiscountPartNumber', 'string', false, ''],
            ['DiscountPartDescription', 'string', false, ''],
            ['cur_Shipping', 'number', false, 'Shipping charge.'],
            ['TaxTotal', 'number', false, '⚠ PUSH 0. OnSite DROPS the order-level tax field on import — put the tax in a Notes-on-Order block and the rep applies tax via the ShopWorks dropdown.'],
            ['TotalDiscounts', 'number', false, ''],
            ['Customer', 'object', false, '→ Customer model (new-customer create).'],
            ['Designs', 'array', false, '→ Designs[] (decoration).'],
            ['LinesOE', 'array', false, '→ LinesOE[] (line items).'],
            ['Notes', 'array', false, '→ Notes[] — ⚠ only 4 valid Types; one bad Type aborts the whole push.'],
            ['Payments', 'array', false, '→ Payments[].'],
            ['ShippingAddresses', 'array', false, '→ ShippingAddresses[].'],
            ['Attachments', 'array', false, '→ Attachments[] (files/mockups).'],
        ]},
        { name: 'LinesOE[]', desc: 'Order line items. One line per size (Size + Qty), NOT Size01–06 (that\'s the PULL side).', fields: [
            ['PartNumber', 'string', true, 'BASE part number — NO size suffix. OnSite\'s Size Translation Table appends _2X/_3X.'],
            ['Color', 'string', true, '⚠ MUST be CATALOG_COLOR (mainframe code, e.g. "BrillOrng"), NOT COLOR_NAME. Chokepoint: transformLineItems() in manageorders-push-client.js.'],
            ['Description', 'string', false, ''],
            ['Size', 'string', false, 'Plain size (S/M/L/2XL). Do NOT pre-suffix — OnSite appends modifiers.'],
            ['Qty', 'string', false, ''],
            ['Price', 'string', false, ''],
            ['id_ProductClass', 'number', false, ''],
            ['CustomField01', 'string', false, ''],
            ['CustomField02', 'string', false, ''],
            ['CustomField03', 'string', false, ''],
            ['CustomField04', 'string', false, ''],
            ['CustomField05', 'string', false, ''],
            ['NameFirst', 'string', false, 'Personalization (names/numbers).'],
            ['NameLast', 'string', false, ''],
            ['LineItemNotes', 'string', false, ''],
            ['WorkOrderNotes', 'string', false, ''],
            ['ExtDesignIDBlock', 'string', false, 'Links this line to a Design block.'],
            ['DesignIDBlock', 'string', false, ''],
            ['ExtShipID', 'string', false, 'Links line → a ShippingAddresses[].ExtShipID (split shipments).'],
            ['DisplayAsPartNumber', 'string', false, ''],
            ['DisplayAsDescription', 'string', false, ''],
        ]},
        { name: 'Designs[]', desc: 'Decoration/design blocks on the order.', fields: [
            ['DesignName', 'string', false, ''],
            ['ExtDesignID', 'string', false, '⚠ Must be GLOBALLY unique — derive from the FULL QuoteID (daily-reset seqs collide → SW silently merges).'],
            ['id_Design', 'number', false, '⚠ OMIT the field (do NOT send 0) when the design is unknown.'],
            ['id_DesignType', 'number', false, 'EMB=2 · SCP=1 · DTF=8 · DTG=45 · sticker=4 · emblem=5.'],
            ['id_Artist', 'number', false, ''],
            ['ForProductColor', 'string', false, '⚠ CATALOG_COLOR codes (not COLOR_NAME) AND list ALL colors the design applies to.'],
            ['VendorDesignID', 'string', false, ''],
            ['CustomField01', 'string', false, ''],
            ['CustomField02', 'string', false, ''],
            ['CustomField03', 'string', false, ''],
            ['CustomField04', 'string', false, ''],
            ['CustomField05', 'string', false, ''],
            ['Locations', 'array', false, '→ Locations[] (per-placement).'],
        ]},
        { name: 'Designs[].Locations[]', desc: 'Per-location decoration detail.', fields: [
            ['Location', 'string', false, 'e.g. Left Chest, Full Back.'],
            ['TotalColors', 'string', false, ''],
            ['TotalFlashes', 'string', false, ''],
            ['TotalStitches', 'string', false, ''],
            ['DesignCode', 'string', false, ''],
            ['CustomField01', 'string', false, ''], ['CustomField02', 'string', false, ''], ['CustomField03', 'string', false, ''], ['CustomField04', 'string', false, ''], ['CustomField05', 'string', false, ''],
            ['ImageURL', 'string', false, ''],
            ['Notes', 'string', false, ''],
            ['LocationDetails', 'array', false, 'Nested detail array.'],
        ]},
        { name: 'Payments[]', desc: 'Payment records (e.g. Stripe deposit on storefront orders).', fields: [
            ['date_Payment', 'string', false, 'MM/DD/YYYY'],
            ['AccountNumber', 'string', false, ''],
            ['Amount', 'number', false, ''],
            ['AuthCode', 'string', false, ''],
            ['CreditCardCompany', 'string', false, ''],
            ['Gateway', 'string', false, 'e.g. Stripe.'],
            ['ResponseCode', 'string', false, ''],
            ['ResponseReasonCode', 'string', false, ''],
            ['ResponseReasonText', 'string', false, ''],
            ['Status', 'string', false, ''],
            ['FeeOther', 'number', false, ''],
            ['FeeProcessing', 'number', false, ''],
        ]},
        { name: 'ShippingAddresses[]', desc: 'Ship-to addresses (multiple = split shipment).', fields: [
            ['ShipCompany', 'string', false, ''],
            ['ShipMethod', 'string', false, "'Customer Pickup' for pickup orders (Stripe skips $0 shipping)."],
            ['ShipAddress01', 'string', false, ''], ['ShipAddress02', 'string', false, ''],
            ['ShipCity', 'string', false, ''], ['ShipState', 'string', false, ''], ['ShipZip', 'string', false, ''], ['ShipCountry', 'string', false, ''],
            ['ExtShipID', 'string', false, 'Referenced by LinesOE[].ExtShipID.'],
        ]},
        { name: 'Notes[]', desc: 'Order notes. ⚠ Only 4 valid Types — one invalid Type aborts the ENTIRE push.', fields: [
            ['Note', 'string', false, 'Note body (tax block goes here — see TaxTotal).'],
            ['Type', 'string', false, '⚠ Must be one of the 4 valid note types (e.g. Notes-On-Order / Accounting). An unknown Type = push rejected.'],
        ]},
        { name: 'Attachments[]', desc: 'Files + mockups. Multi-file via Transfer_Order_Files (N working + 1 mockup; single-mockup enforced app-side).', fields: [
            ['MediaURL', 'string', false, 'File URL (resolveToProxyUrl — never a raw Box shared link).'],
            ['MediaName', 'string', false, ''],
            ['LinkURL', 'string', false, ''],
            ['LinkNote', 'string', false, ''],
            ['Link', 'number', false, ''],
        ]},
        { name: 'Customer (object)', desc: 'New-customer create (when id_Customer is not an existing account).', fields: [
            ['CompanyName', 'string', false, ''], ['CustomerSource', 'string', false, ''], ['CustomerType', 'string', false, ''],
            ['InvoiceNotes', 'string', false, ''], ['MainEmail', 'string', false, ''], ['SalesGroup', 'string', false, ''],
            ['TaxExempt', 'string', false, ''], ['TaxExemptNumber', 'string', false, ''], ['WebSite', 'string', false, ''],
            ['CustomDateField01', 'string', false, ''], ['CustomDateField02', 'string', false, ''], ['CustomDateField03', 'string', false, ''], ['CustomDateField04', 'string', false, ''],
            ['CustomField01', 'string', false, ''], ['CustomField02', 'string', false, ''], ['CustomField03', 'string', false, ''], ['CustomField04', 'string', false, ''], ['CustomField05', 'string', false, ''], ['CustomField06', 'string', false, ''],
            ['CustomerReminderInvoiceNotes', 'string', false, ''],
            ['BillingCompany', 'string', false, ''], ['BillingAddress01', 'string', false, ''], ['BillingAddress02', 'string', false, ''],
            ['BillingCity', 'string', false, ''], ['BillingState', 'string', false, ''], ['BillingZip', 'string', false, ''], ['BillingCountry', 'string', false, ''],
        ]},
        { name: 'SignIn', desc: 'POST /signin body → returns an id_token (Cognito) used as Bearer on every call.', fields: [
            ['username', 'string', true, ''],
            ['password', 'string', true, ''],
        ]},
        { name: 'track-push (TrackingJson[])', desc: 'POST /track-push body — push tracking numbers (OnSite v12+).', fields: [
            ['ExtOrderID', 'string', true, 'Must match an existing order.'],
            ['ExtShipID', 'string', false, 'For split shipments.'],
            ['TrackingNumber', 'string', true, ''],
            ['ShippingMethod', 'string', false, 'e.g. "UPS Ground".'],
            ['Cost', 'number', false, ''],
            ['Weight', 'number', false, ''],
            ['CustomField01', 'string', false, ''], ['CustomField02', 'string', false, ''], ['CustomField03', 'string', false, ''], ['CustomField04', 'string', false, ''], ['CustomField05', 'string', false, ''],
        ]},

        // ===== PULL API (GET /v1/manageorders/*) — response models =====
        { name: 'Orders (pull)', desc: 'GET /orders + /orders/{order_no} response. Completed = sts_Shipped && sts_Invoiced && sts_Paid.', fields: [
            ['id_Order', 'integer', false, '= WO# (ShopWorks work-order number).'],
            ['id_OrderType', 'number', false, ''],
            ['id_Customer', 'integer', false, ''],
            ['id_CustomerInternal', 'integer', false, ''],
            ['CustomerName', 'string', false, ''],
            ['CustomerServiceRep', 'string', false, 'Sales rep. NOTE: correct spelling HERE (pull); the PUSH field is the "CustomerSeviceRep" typo.'],
            ['CustomerPurchaseOrder', 'string', false, 'PO# — storefront orders link WO by PO==QuoteID.'],
            ['ContactFirstName', 'string', false, ''], ['ContactLastName', 'string', false, ''], ['ContactEmail', 'string', false, ''], ['ContactPhone', 'string', false, ''], ['ContactFax', 'string', false, ''], ['ContactTitle', 'string', false, ''], ['ContactDepartment', 'string', false, ''],
            ['date_Ordered', 'string', false, ''], ['date_Invoiced', 'string', false, ''], ['date_RequestedToShip', 'string', false, ''], ['date_Produced', 'string', false, ''],
            ['date_Shippied', 'string', false, '⚠ misspelled "date_Shippied" (double-i) in the API — read it exactly.'],
            ['sts_Invoiced', 'string', false, '⚠ multi-state code: 0=No · 1=Yes · .5=Partial · 8/222=N/A. NOT a boolean.'],
            ['sts_Paid', 'string', false, '0/1/.5/8/222 (see sts_Invoiced).'],
            ['sts_Produced', 'string', false, '0/1/.5/8/222.'],
            ['sts_Purchased', 'string', false, '0/1/.5/8/222.'],
            ['sts_Received', 'string', false, '0/1/.5/8/222.'],
            ['sts_Shipped', 'integer', false, '0/1/.5/8/222.'],
            ['sts_ArtDone', 'integer', false, ''], ['sts_ReceivedSub', 'integer', false, ''], ['sts_PurchasedSub', 'integer', false, ''], ['sts_SizingType', 'integer', false, ''],
            ['TotalProductQuantity', 'integer', false, ''],
            ['cur_TotalInvoice', 'number', false, ''], ['cur_SubTotal', 'number', false, ''], ['cur_SalesTaxTotal', 'number', false, ''], ['cur_Shipping', 'number', false, ''], ['cur_Payments', 'number', false, ''], ['cur_Balance', 'number', false, ''], ['cur_Adjustment', 'number', false, ''],
            ['TermsName', 'string', false, ''], ['TermsDays', 'integer', false, ''],
            ['DesignName', 'string', false, 'LIVE design name (operator edits show here; pushed.* stays frozen).'],
            ['id_Design', 'number', false, ''], ['id_URL', 'string', false, ''],
        ]},
        { name: 'LineItems (pull)', desc: 'GET /lineitems/{order_no}. Size01–06 are POSITIONAL.', fields: [
            ['id_Order', 'integer', false, ''],
            ['PartNumber', 'string', false, ''], ['PartColor', 'string', false, ''], ['PartDescription', 'string', false, ''],
            ['LineQuantity', 'integer', false, ''], ['LineUnitPrice', 'number', false, ''],
            ['Name', 'string', false, 'Personalization.'], ['SortOrder', 'integer', false, ''], ['InvoiceNotes', 'string', false, ''],
            ['Size01', 'string', false, '⚠ POSITIONAL: Size01=S · Size02=M · Size03=L · Size04=XL · Size05=2XL · Size06=catch-all. Extended SKUs (_2X/_3X) land in the SAME column — SUM across all lines per style to rebuild the true distribution.'],
            ['Size02', 'string', false, 'M'], ['Size03', 'string', false, 'L'], ['Size04', 'string', false, 'XL'], ['Size05', 'string', false, '2XL'], ['Size06', 'string', false, 'catch-all (extended sizes)'],
            ['Custom01', 'string', false, ''], ['Custom02', 'string', false, ''], ['Custom03', 'string', false, ''], ['Custom04', 'string', false, ''], ['Custom05', 'string', false, ''],
        ]},
        { name: 'GetOrderNo (pull)', desc: 'GET /getorderno/{ext_order_id} → resolves ExtOrderID → WO#. NOT source-scoped; empty for builder ExtSources.', fields: [
            ['id_Order', 'number', false, 'The resolved WO#.'],
        ]},
        { name: 'Tracking (pull)', desc: 'GET /tracking + /tracking/{order_no}.', fields: [
            ['id_Order', 'integer', false, ''], ['TrackingNumber', 'string', false, ''], ['Type', 'string', false, 'carrier/service.'],
            ['AddressCompany', 'string', false, ''], ['Address1', 'string', false, ''], ['Address2', 'string', false, ''], ['AddressCity', 'string', false, ''], ['AddressState', 'string', false, ''], ['AddressZip', 'string', false, ''], ['AddressCountry', 'string', false, ''],
            ['Weight', 'string', false, ''], ['Cost', 'string', false, ''], ['date_Creation', 'string', false, ''], ['date_Imported', 'string', false, ''],
        ]},
        { name: 'OnSitePayments (pull)', desc: 'GET /payments — payments entered in OnSite.', fields: [
            ['id_Order', 'integer', false, ''], ['Amount', 'number', false, ''], ['PaymentType', 'string', false, ''], ['date_PaymentApplied', 'string', false, ''], ['PaymentNumber', 'string', false, ''], ['id_SubPayment', 'integer', false, ''],
        ]},
        { name: 'WebPayments (pull)', desc: 'GET /payments — web (Stripe/portal) payments, with billing address.', fields: [
            ['id_Order', 'integer', false, ''], ['Amount', 'number', false, ''], ['sts_Approved', 'integer', false, ''], ['PaymentNumber', 'string', false, ''], ['id_SubPayment', 'integer', false, ''], ['date_PaymentApplied', 'string', false, ''],
            ['FirstName', 'string', false, ''], ['LastName', 'string', false, ''],
            ['BillingCompnay', 'string', false, '⚠ misspelled "BillingCompnay" in the API.'], ['BillingAddress', 'string', false, ''], ['BillingCity', 'string', false, ''], ['BillingState', 'string', false, ''], ['BillingZip', 'string', false, ''], ['BillingCountry', 'string', false, ''],
        ]},
        { name: 'InventoryLevels (pull)', desc: 'GET /inventorylevels — per part+color, quantity per size.', fields: [
            ['id_InventoryLevel', 'integer', false, ''], ['PartNumber', 'string', false, ''], ['Color', 'string', false, ''], ['ColorRange', 'string', false, ''], ['PartDescription', 'string', false, ''],
            ['Size01', 'number', false, 'qty in S'], ['Size02', 'number', false, 'M'], ['Size03', 'number', false, 'L'], ['Size04', 'number', false, 'XL'], ['Size05', 'number', false, '2XL'], ['Size06', 'number', false, 'extended'],
            ['UnitCost', 'number', false, ''], ['TotalCost', 'number', false, ''], ['GLAccount', 'string', false, ''], ['SKU', 'string', false, ''], ['PreprintGroup', 'string', false, ''], ['ProductType', 'string', false, ''], ['FindCode', 'string', false, ''], ['id_Vendor', 'number', false, ''], ['VendorName', 'string', false, ''],
        ]},
    ];

    function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
    function hl(text, q) {
        var s = esc(text); if (!q) return s;
        try { return s.replace(new RegExp('(' + esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark class="mo-hit">$1</mark>'); } catch (e) { return s; }
    }

    var epHost = document.getElementById('moEndpoints');
    var host = document.getElementById('moModels');
    var filter = document.getElementById('moFilter');
    var countEl = document.getElementById('moCount');
    var TOTAL_FIELDS = MODELS.reduce(function (n, m) { return n + m.fields.length; }, 0);

    function renderEndpoints() {
        epHost.innerHTML = ENDPOINTS.map(function (e) {
            return '<div class="mo-ep"><span class="mo-m ' + esc(e[0]) + '">' + esc(e[0]) + '</span>' +
                '<span class="mo-path">' + esc(e[1]) + '</span><span class="mo-grp">' + esc(e[2]) + '</span>' +
                '<span class="mo-desc">' + esc(e[3]) + '</span></div>';
        }).join('');
    }

    function renderModels(q) {
        var shown = 0;
        var htmlOut = MODELS.map(function (m) {
            var rows = m.fields.filter(function (f) {
                if (!q) return true;
                return (f[0] + ' ' + f[1] + ' ' + f[3]).toLowerCase().indexOf(q) !== -1;
            });
            if (!rows.length) return '';
            shown += rows.length;
            var body = rows.map(function (f) {
                return '<tr' + (f[2] ? ' class="mo-req-row"' : '') + '>' +
                    '<td class="mo-fname">' + hl(f[0], q) + (f[2] ? ' <span class="mo-req">*</span>' : '') + '</td>' +
                    '<td class="mo-ftype">' + esc(f[1]) + '</td>' +
                    '<td class="mo-fnote">' + (f[3] ? hl(f[3], q) : '') + '</td></tr>';
            }).join('');
            return '<div class="mo-model"><div class="mo-model-head"><h3>' + esc(m.name) + '</h3>' +
                '<span class="mo-model-count">' + rows.length + ' fields</span></div>' +
                '<p class="mo-model-desc">' + esc(m.desc) + '</p>' +
                '<div class="mo-scroll"><table class="mo-table"><thead><tr><th>field</th><th>type</th><th>notes / gotchas</th></tr></thead><tbody>' +
                body + '</tbody></table></div></div>';
        }).join('');
        host.innerHTML = shown ? htmlOut : '<div class="mo-empty">No fields match &ldquo;' + esc(q) + '&rdquo;.</div>';
        countEl.textContent = q ? (shown + ' of ' + TOTAL_FIELDS + ' fields match') : (TOTAL_FIELDS + ' fields across ' + MODELS.length + ' models');
    }

    renderEndpoints();
    renderModels('');
    if (filter) filter.addEventListener('input', function () { renderModels(filter.value.trim().toLowerCase()); });
})();
