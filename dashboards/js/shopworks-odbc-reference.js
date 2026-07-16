/* ==========================================================================
   shopworks-odbc-reference.js — ShopWorks OnSite ODBC field catalog browser.
   Loads /dashboards/data/shopworks-odbc-schema.json (2,630 fields pulled live
   from FileMaker_Fields on 2026-07-16) and renders a filterable per-table
   reference. Curated notes for headline fields; automatic kind-badges for
   calc/global/summary prefixes (the fields you must NOT filter on).
   Canonical deep doc: memory/SHOPWORKS_ODBC_INTEGRATION.md.
   ========================================================================== */
(function () {
    'use strict';

    var SCHEMA_URL = '/dashboards/data/shopworks-odbc-schema.json?v=2026.07.16.1';

    var TABLE_DESC = {
        Addr: 'Addresses (customer/vendor/order ship-to). Has per-order ShipMethod + ShipStation sync stamps.',
        Buttons: 'OnSite UI button config — ignore.',
        ContactNumbers: 'Phone/fax/email numbers per contact.',
        Contacts: 'People at customers/vendors (name, title, email, department).',
        Cust: 'CUSTOMER MASTER — credit, terms, tax-exempt, aging buckets, 10yr/monthly sales history.',
        Des: 'Designs — artist, dates, type, variations, ExtDesignID.',
        Event: 'Production calendar events — machine, scheduled date, setup/run time, produced status.',
        InvLevel: 'In-house inventory per part+color — per-size stock, on-order, in-production, committed, min/max.',
        LinesOE: 'Order line items — requested vs actual sizes, backorders, pricing, costs, gross profit, design link.',
        Machines: 'Production machines — type, heads, stitches/min, units/hour, machine rate.',
        Orders: 'ORDER HEADERS — all dates incl. drop-dead, 13 status slots, notes, job costing, commissions, aging, ExtOrderID.',
        OrdTyp: 'Order types — config + the id_StatusKey/ct_Key_Display decoder for Orders.sts_01–13.',
        PO: 'Purchase orders — issued/received dates, vendor, ship-to, payables matching, SanMar API submission flags.',
        Prod: 'Product master — 14-tier price/cost matrix, vendor, SKU, weight, bin location.',
        ProductionLogDetails: 'Shop-floor labor log — per employee+machine: hours, qty, misprints, defects, labor rate.',
        Version: 'OnSite version info — ignore.'
    };

    // Curated gotchas for headline fields: NOTES[table][field] = note. Starred rows.
    var NOTES = {
        Orders: {
            date_OrderDropDead: '★ THE due date ManageOrders never had. Stored — safe in WHERE.',
            date_Modification: '★ Delta-sync key — WHERE date_Modification >= {d \'…\'} beats re-pulling everything.',
            date_OrderPlaced: 'Stored order date — primary range filter.',
            date_ProductionScheduled: 'Production schedule date (MO has nothing like it).',
            date_ProductionDone: 'When production actually finished.',
            date_DesignScheduled: 'Art schedule date.',
            date_DesignDone: 'Art completion date.',
            date_OrderShipped: 'Ship date on the header.',
            ID_Order: 'The WO#. Join key everywhere (LinesOE.id_Order, PO.id_Order, …).',
            id_Customer: 'FK → Cust.ID_Customer.',
            id_EmpSalesperson: 'Rep ID — cleaner than the free-text CustomerServiceRep.',
            CustomerServiceRep: 'Free-text rep name (same dirty data as MO).',
            ExtOrderID: '★ Our pushed external id (EMB-1234, NWCA-…) — SQL-join web orders to WOs.',
            ExtSource: 'APISource of pushed orders (NWCA / OrderForm / 3DT …).',
            sts_APIOrder: '1 = order arrived via the push API.',
            CustomerPurchaseOrder: 'Customer PO text — storefront orders carry QuoteID here.',
            cd_date_PaymentDue: 'Payment due date (CALC — display only, don\'t filter).',
            TermsDays: 'Payment terms days (stored).',
            sts_Paid: 'Multi-state: 0/1/.5/8/222.',
            HoldOrderText: 'Hold reason text.',
            cur_Subtotal: 'Order subtotal (stored).',
            cur_Shipping: 'Shipping charge (stored).'
        },
        Cust: {
            ID_Customer: 'Customer #. Matches MO id_Customer and ShopWorks UI.',
            cur_CreditLimit: '★ Credit limit — never available via ManageOrders.',
            cur_CreditUsed: 'Credit used (pair with cur_CreditLimit).',
            Terms: '★ Payment terms text.',
            sts_CreditAutoHold: 'Auto-hold flag when over limit.',
            TaxExemptNumber: 'Tax-exempt cert #.',
            date_TaxExemptExpiration: 'Cert expiration — audit before big orders.',
            date_LastOrdered: '★ Last order date — dormant-customer reports.',
            CustomerType: 'Type category.',
            CustomerSource: 'How they found us.',
            cur_TotalYearSales1: '★ Year-1 (current) sales. …Sales2-10 = prior years: 10yr history per customer.',
            avg_DaysLate: 'Average days late paying (calc — display only).'
        },
        Addr: {
            ShipMethod: '★ Ship method per address record — the receiving-label gap, solved.',
            sts_ShipStation: 'ShipStation sync flag.',
            timestamp_ShipstationLastUpdate: 'Last ShipStation update.',
            id_Order: 'When set, this address row is an order ship-to.'
        },
        LinesOE: {
            id_Order: 'FK → Orders.ID_Order.',
            PartNumber: 'SKU (may carry _2X/_3X suffixes — same as MO line items).',
            PartColor: 'CATALOG_COLOR code.',
            Size01_Req: '★ REQUESTED qty (S). Size01-06_Req vs _Act = requested vs actual — size redistributions become visible.',
            Size01_Act: '★ ACTUAL qty (S) after edits.',
            Size01_BO: 'Backordered qty (S).',
            cur_UnitPriceUserEntered: 'Rep-entered unit price (stored).',
            id_Design: 'FK → Des.ID_Design.',
            DesignTitle: 'Design name on the line.',
            id_Vendor: 'Vendor for purchasing.'
        },
        PO: {
            ID_PO: 'PO #.',
            id_Order: 'FK → Orders.ID_Order (PO-to-WO link).',
            id_Vendor: 'Vendor.',
            date_POIssued: 'Issued date.',
            date_Received: '★ Received date — inbound visibility at the source.',
            ConfirmationNumber: 'Vendor confirmation (SanMar conf #).',
            sts_API_Submitted: 'Submitted via API (our SanMar PO flow).',
            date_API_Submitted: 'When API-submitted.'
        },
        ProductionLogDetails: {
            id_Order: 'FK → Orders.ID_Order.',
            id_Employee: '★ Who did the work.',
            id_Machine: 'FK → Machines.',
            date_Log: 'Work date — primary filter.',
            Hours: 'Hours logged.',
            Qty: 'Pieces produced.',
            Misprints: '★ Misprint count — quality reporting.',
            Defects: '★ Defect count.',
            cur_LaborRate: 'Labor rate used for costing.'
        },
        Machines: {
            MachineName: 'Display name.',
            MachineType: 'EMB / SP / DTG / …',
            NumberOfHeads: 'Embroidery heads.',
            StitchesPerMinute: 'Rated speed.',
            UnitsPerHour: 'Rated throughput.',
            cur_MachineRate: 'Cost rate per hour.'
        },
        InvLevel: {
            PartNumber: 'SKU.',
            PartColor: 'CATALOG_COLOR.',
            Size01: 'On-hand qty (S). Size01-06 positional like MO.',
            Size01_OnOrder: '★ On purchase orders, not yet received.',
            Size01_InProduction: 'Committed to jobs in production.',
            Size01_Committed: 'Committed to orders.',
            cur_UnitCost: 'Unit cost.'
        },
        Des: {
            ID_Design: 'Design # (= Design_Lookup_2026.Design_Number).',
            DesignName: 'Name.',
            id_Employee_Artist: 'Artist employee ID.',
            date_Designed: 'Design date.',
            sts_DesignDone: 'Done flag.',
            ExtDesignID: 'Our pushed external design id.',
            id_DesignParent: 'Variation parent.'
        },
        OrdTyp: {
            ID_OrderType: 'Order type id (Orders.id_OrderType).',
            OrderType: 'Type name.',
            id_StatusKey_01: '★ id_StatusKey_01-13 + ct_Key_Display_01-13 = labels for Orders.sts_01–13 per order type.',
            pref_DefaultDaysProduction: 'Default production days.',
            pref_RushDays: 'Rush threshold days.'
        },
        Contacts: {
            id_Customer: 'FK → Cust.',
            Email_Primary: 'Primary email.',
            NameFirst: 'First name.', NameLast: 'Last name.'
        }
    };

    // Field-kind detection: prefix → badge. Calc/summary = never in WHERE. Globals = session-scoped, useless.
    var KIND_RE = {
        calc: /^(cn|ct|cd|cm|co|cnr|cor|cnCur|cnPer|cn_sts)_|^explode_|^filter_/,
        global: /^(gn|gt|gd|gm|go|gdr)_/,
        summary: /^sum_/
    };
    function kindOf(name) {
        if (KIND_RE.summary.test(name)) return 'summary';
        if (KIND_RE.global.test(name)) return 'global';
        if (KIND_RE.calc.test(name)) return 'calc';
        return 'stored';
    }
    var KIND_BADGE = {
        calc: '<span class="swo-kind swo-kind--calc" title="Unstored calculation — evaluated per row, unindexable. NEVER in WHERE.">calc</span>',
        global: '<span class="swo-kind swo-kind--global" title="Global field — session value, not row data.">global</span>',
        summary: '<span class="swo-kind swo-kind--summary" title="Summary field — aggregates the found set. NEVER query.">summary</span>',
        stored: ''
    };

    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
    function hl(text, q) {
        var s = esc(text); if (!q) return s;
        try { return s.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark class="swo-hit">$1</mark>'); } catch (e) { return s; }
    }

    var host = document.getElementById('swoTables');
    var filterEl = document.getElementById('swoFilter');
    var storedOnlyEl = document.getElementById('swoStoredOnly');
    var countEl = document.getElementById('swoCount');
    var SCHEMA = null;
    var TOTAL = 0;
    var collapsed = {};   // tableName -> bool (default: collapsed when not filtering)

    function render() {
        if (!SCHEMA) return;
        var q = (filterEl.value || '').trim().toLowerCase();
        var storedOnly = storedOnlyEl.checked;
        var shown = 0;
        var names = Object.keys(SCHEMA.tables);
        var htmlOut = names.map(function (t) {
            var notes = NOTES[t] || {};
            var rows = SCHEMA.tables[t].filter(function (f) {
                var kind = kindOf(f[0]);
                if (storedOnly && kind !== 'stored') return false;
                if (!q) return true;
                var note = notes[f[0]] || '';
                return (t + ' ' + f[0] + ' ' + f[1] + ' ' + note).toLowerCase().indexOf(q) !== -1;
            });
            if (!rows.length) return '';
            shown += rows.length;
            var isCollapsed = q ? false : (collapsed[t] !== undefined ? collapsed[t] : true);
            var body = rows.map(function (f) {
                var kind = kindOf(f[0]);
                var note = notes[f[0]] || '';
                var star = note.indexOf('★') === 0;
                return '<tr' + (star ? ' class="swo-row--star"' : '') + '>' +
                    '<td class="swo-fname">' + (star ? '<i class="fas fa-star swo-star"></i>' : '') + hl(f[0], q) + KIND_BADGE[kind] + '</td>' +
                    '<td class="swo-ftype">' + esc(f[1]) + '</td>' +
                    '<td class="swo-fnote">' + (note ? hl(note.replace(/^★\s*/, ''), q) : '') + '</td></tr>';
            }).join('');
            return '<div class="swo-tbl' + (isCollapsed ? ' collapsed' : '') + '" data-table="' + esc(t) + '">' +
                '<div class="swo-tbl-head" data-action="toggle"><h3>' + hl(t, q) + '</h3>' +
                '<span class="swo-tbl-count">' + rows.length + ' fields</span>' +
                '<i class="fas fa-chevron-down swo-tbl-chevron"></i></div>' +
                '<p class="swo-tbl-desc">' + esc(TABLE_DESC[t] || '') + '</p>' +
                '<div class="swo-scroll"><table class="swo-table"><thead><tr><th>field</th><th>type</th><th>notes / gotchas</th></tr></thead><tbody>' +
                body + '</tbody></table></div></div>';
        }).join('');
        host.innerHTML = shown ? htmlOut : '<div class="swo-empty">No fields match &ldquo;' + esc(q) + '&rdquo;' + (storedOnly ? ' (stored-only is ON)' : '') + '.</div>';
        countEl.textContent = (q || storedOnly)
            ? (shown + ' of ' + TOTAL + ' fields shown' + (storedOnly ? ' · stored only' : '') + (q ? ' · filter: "' + q + '"' : ''))
            : (TOTAL + ' fields across ' + names.length + ' tables — click a table name to expand');
    }

    host.addEventListener('click', function (ev) {
        var head = ev.target.closest('.swo-tbl-head');
        if (!head) return;
        var box = head.closest('.swo-tbl');
        var t = box.getAttribute('data-table');
        collapsed[t] = !box.classList.contains('collapsed');
        box.classList.toggle('collapsed');
    });

    document.addEventListener('DOMContentLoaded', function () {
        fetch(SCHEMA_URL)
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status + ' loading schema JSON');
                return resp.json();
            })
            .then(function (data) {
                SCHEMA = data;
                TOTAL = Object.keys(data.tables).reduce(function (n, t) { return n + data.tables[t].length; }, 0);
                render();
            })
            .catch(function (err) {
                console.error('[shopworks-odbc-reference] schema load failed:', err);
                countEl.textContent = 'Failed to load field catalog.';
                host.innerHTML = '<div class="swo-empty"><i class="fas fa-triangle-exclamation"></i> Unable to load the field catalog (' + esc(err.message) + '). Refresh to retry.</div>';
                if (window.DashPage && DashPage.showError) DashPage.showError('Unable to load the ODBC field catalog. Please refresh.');
            });
        filterEl.addEventListener('input', render);
        storedOnlyEl.addEventListener('change', render);
    });
})();
