/* ==========================================================================
   sanmar-api-reference.js — SanMar Web Services (SOAP) cheat sheet controller.
   From the SanMar Web Services Integration Guide v24.5 (July 2026) + our tested
   reference memory/SANMAR_API_REFERENCE.md (the canonical deep doc — update THERE).
   Static reference + live filter across every service/method/field. No API calls.
   ========================================================================== */
(function () {
    'use strict';

    // [group, path, note] — prefix path with https://<host>:8080 (prod ws. / test test-ws.)
    var ENDPOINTS = [
        ['Standard', '/SanMarWebService/SanMarProductInfoServicePort?wsdl', 'Product info (5 methods; bulk/delta/brand/category are async → FTP)'],
        ['Standard', '/SanMarWebService/SanMarWebServicePort?wsdl', 'Inventory (all-warehouse or by-warehouse)'],
        ['Standard', '/SanMarWebService/SanMarPricingServicePort?wsdl', 'Pricing (cost tiers — piece/case/sale/myPrice)'],
        ['Standard', '/SanMarWebService/InvoicePort?wsdl', 'Invoicing (10 methods)'],
        ['Standard', '/SanMarWebService/webservices/PackingSlipService?wsdl', 'LPN / Packing slip (GetPackingSlip)'],
        ['PromoStd', '/promostandards/ProductDataServiceBindingV2', 'Product Data V2.0.0 — ✅ what our proxy uses in prod'],
        ['PromoStd', '/promostandards/MediaContentServiceBinding?wsdl', 'Media Content V1.1.0 (images/documents)'],
        ['PromoStd', '/promostandards/InventoryServiceBindingV2final?WSDL', 'Inventory V2.0.0 (partIdArray ≤200 = batch a cart)'],
        ['PromoStd', '/promostandards/PricingAndConfigurationServiceBinding?WSDL', 'Pricing & Configuration (Net/List/Customer)'],
        ['PromoStd', '/promostandards/OrderShipmentNotificationServiceBinding?wsdl', 'Order Shipment Notification V1.0.0 (tracking)'],
        ['PromoStd', '/promostandards/OrderStatusServiceBindingV2?wsdl', 'Order Status V2.0.0 (V1 removed Aug 2024)'],
        ['PromoStd', '/promostandards/InvoiceServiceBindingV1_0_0?WSDL', 'Invoice V1.0.0'],
    ];

    // model = { name, desc, fields: [ [name, kind, note] ] }  (kind shown in the type column)
    var MODELS = [
        { name: 'Authentication', desc: 'Standard calls need customer# + SanMar.com credentials; PromoStandards needs only id/password. Test env credentials are SEPARATE (and its data is stale — use PROD WSDLs even for testing reads).', fields: [
            ['SanMarCustomerNumber', 'INT · Standard', 'SanMar customer number (required on Standard calls).'],
            ['SanMarUserName / SanMarUserPassword', 'STRING · Standard', 'SanMar.com credentials — create at sanmar.com/signup/webuser.'],
            ['senderId / senderPassword', '— · Standard', 'NOT used by SanMar — leave empty.'],
            ['id / password', 'STRING · PromoStd', 'SanMar.com username/password (shar: namespace).'],
            ['errorOccurred / message', 'response', 'true + "ERROR: User authenticating failed" on bad credentials.'],
            ['TLS 1.2 · IP 63.251.12.134 · port 8080', 'connectivity', 'WSDL timeout in a browser = firewall/port-8080 block.'],
        ]},
        { name: 'Product Info (Standard) — 5 methods', desc: 'SanMarProductInfoServicePort. Bulk/delta/brand/category are ASYNC: SOAP returns an ack; the CSV lands in the FTP SanMarPI folder (~20 min).', fields: [
            ['getProductInfoByStyleColorSize', 'method', 'LIVE query: style (req) + color (CATALOG color, opt) + size (opt).'],
            ['getProductBulkInfo', 'method', 'Full catalog CSV → FTP SanMarPI-Bulk-<cust#>.csv. Once/month.'],
            ['getProductDeltaInfo', 'method', 'Changes since last bulk/delta → SanMarPI-Delta-<cust#>.csv. Daily; merge on unique_key.'],
            ['getProductInfoByBrand / ByCategory', 'method', 'Async → Brand_<X>_<date>.csv / Category_<X>_<date>.csv (process updated Jun 2026).'],
            ['mapPrice / MAP_PRICE', 'field', 'Minimum Advertised Price (NEW Jun 2026; bulk CSV col AP).'],
            ['piecePrice / casePrice', 'field', 'piece = ≤5 pcs; case = per-piece in a full case (best volume).'],
            ['pieceSalePrice / caseSalePrice + saleStartDate/saleEndDate', 'field', 'Sale window; sale pricing changes every Mon & Wed.'],
            ['dozenPrice / dozenSalePrice', 'field', '⚠ DEPRECATED — just echoes piece price.'],
            ['priceCode + priceText', 'field', 'A/P=50% · B/Q=45% · C/R=40% · D/S=35% · E/T=30% suggested retail; priceText = sizes it applies to.'],
            ['productStatus', 'field', 'Active / Coming Soon / New / Regular / Discontinued.'],
            ['caseSize · category · keywords · image URLs', 'field', 'cdnm.sanmar.com image links (front/back/side model, flat, swatch).'],
        ]},
        { name: 'PromoStandards Product Data V2.0.0', desc: 'ProductDataServiceBindingV2 — our proxy\'s production product feed (src/routes/sanmar-product-data.js).', fields: [
            ['getProduct', 'method', 'Full detail: wsVersion 2.0.0, productId (req), partId/colorName (opt), localization us/en.'],
            ['getProductSellable', 'method', '{productId, partId} filtered by isSellable=true/false.'],
            ['getProductDateModified', 'method', 'Changed since changeTimeStamp (ISO-8601) — best for incremental sync.'],
            ['getProductCloseOut', 'method', 'All discontinued SKUs; request = credentials + wsVersion only.'],
            ['colorName vs standardColorName', 'field', '⚠ colorName = MAINFRAME/API key (← SANMAR_MAINFRAME_COLOR); standardColorName = display (← COLOR_NAME). Always call with colorName.'],
            ['ProductPriceGroupArray', 'field', 'groupName (e.g. MSRP) + qtyMin/qtyMax/price — the Jun-2026 MAP/MSRP surface.'],
            ['ProductPartArray', 'field', 'partId, ColorArray, ApparelSize (labelSize), Dimension+weight, gtin, isCloseout/isCaution/isOnDemand/isHazmat, ShippingPackageArray.'],
            ['partId', 'field', '= uniqueKey = inventoryKey + sizeIndex concatenated (e.g. 11803+2 → 118032).'],
        ]},
        { name: 'PromoStandards Media Content V1.1.0', desc: 'Product images + documents. Pull at productId level → all variant images in ONE call.', fields: [
            ['getMediaContent', 'method', 'wsVersion 1.1.0, cultureName en-us, mediaType ∈ {Image, Document} ONLY, productId (req), partId/classType (opt).'],
            ['classType', 'field', '1004 Swatch · 1006 Primary · 1007 Front · 1008 Rear · 2001 High-res.'],
            ['MediaContentArray', 'field', 'url, mediaType, ClassTypeArray, color, singlePart.'],
            ['getMediaDateModified', 'method', '❌ NOT supported by SanMar.'],
        ]},
        { name: 'Inventory (Standard)', desc: 'SanMarWebServicePort. Query by Style / Style+Color / Style+Size (color = CATALOG/mainframe).', fields: [
            ['getInventoryQtyForStyleColorSize', 'method', 'Qty from ALL warehouses.'],
            ['getInventoryQtyForStyleColorSizeByWhse', 'method', 'Same + required warehouse number.'],
            ['response shape', 'field', 'style → skus → sku{color,size} → repeating whse{whseID, whseName, qty} — warehouses in DESCENDING order.'],
            ['3000 cap', 'gotcha', '⚠ Max qty returned per warehouse is 3000 — "3000" means ≥3000, not exact. (Both inventory services.)'],
        ]},
        { name: 'PromoStandards Inventory V2.0.0', desc: 'The live-check service our Quick Quote uses. getFilterValues NOT supported.', fields: [
            ['getInventoryLevels', 'method', '3 query shapes: productId+labelSize+partColor · productId only · partIdArray.'],
            ['partIdArray', 'field', '⚠ Up to 200 partIds per call — batch an entire cart in ONE request at checkout.'],
            ['PartInventory', 'field', 'partId, partColor, labelSize, quantityAvailable (EA), manufacturedItem, buyToOrder.'],
            ['InventoryLocationArray', 'field', 'inventoryLocationId/Name, postalCode, country, inventoryLocationQuantity (per-warehouse qty — updated Feb 2026).'],
        ]},
        { name: 'Pricing (Standard) — getPricing', desc: 'SanMarPricingServicePort. Returns COST tiers, not MSRP. ⚠ Price varies BY COLOR (White ≠ colors).', fields: [
            ['getPricing', 'method', 'By style[/color/size] OR by inventoryKey + sizeIndex. Style-only = all SKUs.'],
            ['piecePrice / casePrice', 'field', 'piece ≤5 pcs; case = per-piece full-case (best volume).'],
            ['salePrice + saleStartDate/saleEndDate', 'field', 'Active sale window.'],
            ['myPrice', 'field', 'YOUR customer-negotiated price.'],
            ['incentivePrice', 'field', 'Program/incentive pricing.'],
            ['dozenPrice', 'field', '⚠ deprecated — echoes piece price.'],
            ['inventoryKey + sizeIndex', 'field', 'Alt request key; sizeIndex is a SMALL ORDINAL (1=XS, 2=S, 3=M, 4=L, 5=XL, 6+=2XL…) — NOT a hundreds scheme.'],
        ]},
        { name: 'PromoStandards Pricing & Configuration V1.0.0', desc: 'MSRP/List + Net + Customer pricing. GetAvailableLocations / GetDecorationColors / GetDecorationPricing NOT supported.', fields: [
            ['getConfigurationAndPricing', 'method', 'productID, partId, currency USD, fobId (1-7,12,31), priceType ∈ Net/List/Customer, configurationType=Blank.'],
            ['priceType', 'field', 'Net = your cost · List = MSRP (A/R coded) · Customer = TVBP/special.'],
            ['price breaks', 'field', 'minQuantity + price (DECIMAL 12,4) + priceUom {EA, DZ, CA…} + priceEffectiveDate/priceExpiryDate.'],
            ['getFobPoints', 'method', 'fobId/City/State/Zip/Country per product.'],
        ]},
        { name: 'Order Status V2.0.0 (PromoStandards)', desc: 'READ-ONLY PO tracking (distinct from PO submission). Wait 2h after PO; ≤3 polls/day; STOP on Complete/Canceled.', fields: [
            ['getOrderStatus', 'method', 'queryType ∈ poSearch / soSearch / lastUpdate (≤30 days) / allOpen / allOpenIssues; returnIssueDetailType + returnProductDetail required.'],
            ['status values', 'field', 'Received · Confirmed · Partially Shipped · Shipped · Complete (terminal) · Canceled (terminal).'],
            ['issues', 'field', 'issueStatus Open/Pending; issueCategory generalHold/backOrderHold.'],
            ['getServiceMethods', 'method', 'Capability probe. getIssue ❌ NOT supported.'],
            ['⚠ allOpen excludes Complete', 'gotcha', 'A fast order can transit placed→Complete between polls and NEVER resurface — pair with an invoice-based catch-up (see LESSONS 2026-06-26).'],
        ]},
        { name: 'Order Shipment Notification V1.0.0 (PromoStandards)', desc: 'Tracking numbers per shipment. OSS (status) and OSN (shipments) are SEPARATE feeds that lag each other.', fields: [
            ['getOrderShipmentNotification', 'method', 'queryType 1 = customer PO# · 2 = SanMar SO# · 3 = shipmentDateTimeStamp (UTC, ⚠ 7-day max window).'],
            ['response', 'field', 'ShipTo/ShipFrom, trackingNumber, shipmentDate, carrier (UPS), shipmentMethod (Ground), per-package Item array (productId, partId, qty).'],
            ['error 301', 'gotcha', 'PO/Invoice not found — order must be SHIPPED + INVOICED first. Persisting past 48h → flag + pause polling.'],
            ['error 303', 'gotcha', 'Input date older than 7 days.'],
        ]},
        { name: 'Invoicing (Standard) — 10 methods', desc: 'InvoicePort. Invoiced daily after 9pm PT → pull NEXT day. SalesTax field returns 0.0.', fields: [
            ['GetInvoiceByInvoiceNo / GetInvoicesByInvoiceNo', 'method', 'Invoice# ≤10 chars.'],
            ['GetInvoices', 'method', 'Incremental pull.'],
            ['GetInvoicesByInvoiceDateRange', 'method', '≤3-month range.'],
            ['GetInvoicesByOrderDate / ByPurchaseOrderNo', 'method', 'PO# input ≤13 chars.'],
            ['Header-only variants ×3 + GetUnpaidInvoices(+Header)', 'method', 'Headers without line detail; unpaid AR view.'],
            ['header fields', 'field', 'SubTotal, SalesTax (0.0), ShippingHandlingCharges, TotalAmount, Terms, DueDate, FreightSavings, TrackingIDs.'],
            ['line fields', 'field', 'StyleNo, StyleColor, StyleSize, StyleDescription, Quantity, UnitPrice, Amount, UniqueKey.'],
        ]},
        { name: 'PromoStandards Invoice V1.0.0', desc: 'Pull after 3pm PT. getVoidedInvoices NOT supported. Daily Invoice File (FTP 6am PT) = same data, better for bulk.', fields: [
            ['getInvoices', 'method', 'queryType 1=PO · 2=invoice# · 3=date · 4=availableTimeStamp.'],
            ['fields', 'field', 'invoiceAmountDue, taxAmount, productId, partId, extendedPrice (camelCase).'],
        ]},
        { name: 'LPN / Packing Slip — GetPackingSlip', desc: 'PackingSlipService. Feeds our Box Labels system (WO#→SanMar PO→shipment).', fields: [
            ['PackingSlipId', 'field', 'The LPN from the box label (e.g. LP000123456789; prefixes LP / L / S / R).'],
            ['decorator rule', 'gotcha', 'Succeeds only if the order Ship-To matches the decorator account address — else "Data Not Found."'],
            ['header', 'field', 'ShipmentDate, ShipmentUnitIndex (= BOX NUMBER), ShipmentUnitQuantity, OrderNumber, InvoiceNumber, PurchaseOrderReference, Weight, Carrier{Name, ShippingMethod, TrackingId}.'],
            ['body item', 'field', 'SkuId, StyleNo, Description, Color, Size, Quantity, GTIN (14-digit).'],
        ]},
        { name: 'SanMar↔ShopWorks bridge (NWCA)', desc: 'Our own translation rules — not in the SanMar guide but where integrations break.', fields: [
            ['catalogColor / CATALOG_COLOR', 'rule', '⚠ THE key rule: API/inventory/order calls use the MAINFRAME color ("BrillOrng"), NEVER the display COLOR_NAME ("Brilliant Orange"). Exception: our proxy /api/inventory product feed keys on COLOR_NAME (see LESSONS 2026-06-23).'],
            ['size suffixes', 'rule', 'ShopWorks SKU suffixes: 2XL→_2X (ONLY short form), XXL→_XXL (ladies, same Size05 column), 3XL+→_3XL/_4XL…, OSFA→_OSFA. S-XL = no suffix.'],
            ['sizeIndex', 'rule', 'Small ordinal (1=XS…5=XL, 6+=2XL…). The old hundreds scheme (S=100…) was WRONG.'],
            ['uniqueKey', 'rule', '= inventoryKey concat sizeIndex — the merge key for bulk/delta CSVs (= PromoStandards partId).'],
            ['FTP files', 'rule', 'sanmar_dip.txt (hourly inventory+pricing) · SanMar_EPDD.csv (case+MSRP) · SanMar_SDL_N.csv (valid styles/colors/sizes + GTIN) · Daily Invoice File (6am PT) · Daily Status File (nightly).'],
            ['discontinued', 'rule', 'sanmar_dip.txt: discontinued_code=S + quantity=0; sizes stay listed while ANY size ≥12 units; zero can rebound from returns.'],
            ['hemmed pants', 'rule', 'NOT in integrated data / PO submittal — order via SanMar.com/phone/email. Unhemmed = supported.'],
        ]},
    ];

    function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
    function hl(text, q) {
        var s = esc(text); if (!q) return s;
        try { return s.replace(new RegExp('(' + esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark class="sm-hit">$1</mark>'); } catch (e) { return s; }
    }

    var epHost = document.getElementById('smEndpoints');
    var host = document.getElementById('smModels');
    var filter = document.getElementById('smFilter');
    var countEl = document.getElementById('smCount');
    var TOTAL = MODELS.reduce(function (n, m) { return n + m.fields.length; }, 0);

    function renderEndpoints() {
        epHost.innerHTML = ENDPOINTS.map(function (e) {
            return '<div class="sm-ep"><span class="sm-grp ' + (e[0] === 'PromoStd' ? 'ps' : 'std') + '">' + esc(e[0]) + '</span>' +
                '<span class="sm-path">' + esc(e[1]) + '</span><span class="sm-desc">' + esc(e[2]) + '</span></div>';
        }).join('');
    }

    function renderModels(q) {
        var shown = 0;
        var out = MODELS.map(function (m) {
            var rows = m.fields.filter(function (f) {
                if (!q) return true;
                return (m.name + ' ' + f[0] + ' ' + f[1] + ' ' + f[2]).toLowerCase().indexOf(q) !== -1;
            });
            if (!rows.length) return '';
            shown += rows.length;
            var body = rows.map(function (f) {
                return '<tr><td class="sm-fname">' + hl(f[0], q) + '</td>' +
                    '<td class="sm-ftype">' + esc(f[1]) + '</td>' +
                    '<td class="sm-fnote">' + hl(f[2], q) + '</td></tr>';
            }).join('');
            return '<div class="sm-model"><div class="sm-model-head"><h3>' + esc(m.name) + '</h3>' +
                '<span class="sm-model-count">' + rows.length + '</span></div>' +
                '<p class="sm-model-desc">' + esc(m.desc) + '</p>' +
                '<div class="sm-scroll"><table class="sm-table"><thead><tr><th>method / field</th><th>kind</th><th>notes / gotchas</th></tr></thead><tbody>' +
                body + '</tbody></table></div></div>';
        }).join('');
        host.innerHTML = shown ? out : '<div class="sm-empty">No entries match &ldquo;' + esc(q) + '&rdquo;.</div>';
        countEl.textContent = q ? (shown + ' of ' + TOTAL + ' entries match') : (TOTAL + ' entries across ' + MODELS.length + ' sections');
    }

    renderEndpoints();
    renderModels('');
    if (filter) filter.addEventListener('input', function () { renderModels(filter.value.trim().toLowerCase()); });
})();
