/**
 * ae-order-intake-form.js — pages/forms/ae-order-intake-form.html
 *
 * Fill-in-the-browser twin of /forms/ae-customer-order-intake-form.pdf — the
 * AE's pre-ShopWorks order sheet. Data assists (all existing public endpoints):
 *   - customer type-ahead (NWCAFormContacts → CompanyContactsMerge2026)
 *   - per-row SanMar style lookup (NWCAFormStyles → /api/stylesearch +
 *     /api/product-colors; picking a color remembers CATALOG_COLOR on the row
 *     for a future ShopWorks push)
 *   - WA tax rate suggestion (POST /api/tax-rates/lookup — never hardcoded)
 *
 * Auto-math (every auto field editable; typing turns auto OFF for that field):
 *   sizes → Qty → Line Total (× Unit Price) → Subtotal → Tax ($ from looked-up
 *   rate) → Order Total → Balance Due (− Deposit). Unit Price is ALWAYS manual
 *   — this sheet records the DECORATED price the AE quoted (Rule 9: the pricing
 *   engine owns pricing; this form only records the agreed number).
 *
 * Save to NWCA → Form_Submissions (AEO prefix) → Forms Inbox.
 */
(function () {
    'use strict';

    var SIZE_COUNT = 6; // S M L XL 2XL 3XL
    var DEFAULT_ROWS = 4;
    var taxRate = null; // percent, from /api/tax-rates/lookup only

    document.addEventListener('DOMContentLoaded', function () {
        var tbody = document.getElementById('orderRows');
        for (var i = 0; i < DEFAULT_ROWS; i++) addRow(tbody);

        document.getElementById('addRowBtn').addEventListener('click', function () { addRow(tbody); });

        // Order Date defaults to today (editable)
        var today = new Date();
        document.getElementById('fldOrderDate').value =
            (today.getMonth() + 1) + '/' + today.getDate() + '/' + today.getFullYear();

        wireMoneyField('fldSubtotal', recalcTax);
        wireMoneyField('fldTax', recalcTotal);
        wireMoneyField('fldOrderTotal', recalcBalance);
        wireMoneyField('fldDeposit', recalcBalance, true);   // deposit is always user-typed
        wireMoneyField('fldBalanceDue', function () {});

        document.getElementById('taxLookupBtn').addEventListener('click', lookupTaxRate);

        NWCAForm.init({ onAfterClear: function () { taxRate = null; setTaxHint('', ''); recalcSubtotal(); } });
        NWCAFormContacts.attach({ input: document.getElementById('fldCompany') });
        NWCAFormSave.init({ formId: 'ae-order-intake', build: buildSubmission });
    });

    // ---------- rows ----------

    function addRow(tbody) {
        var tr = document.createElement('tr');

        var styleTd = textCell('cell-text cell-style', 'Style number');
        tr.appendChild(styleTd);

        var colorTd = textCell('cell-text cell-color', 'Color');
        tr.appendChild(colorTd);

        var descTd = textCell('cell-text cell-desc', 'Product description');
        tr.appendChild(descTd);

        for (var s = 0; s < SIZE_COUNT; s++) {
            var td = document.createElement('td');
            var input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.className = 'size-qty';
            input.setAttribute('aria-label', 'Size quantity');
            input.addEventListener('input', function () { recalcQty(tr); });
            td.appendChild(input);
            tr.appendChild(td);
        }

        tr.appendChild(textCell('cell-text cell-other', 'Other sizes'));

        tr.appendChild(autoCell(tr, 'row-qty', 'Quantity', recalcLine));

        var priceTd = document.createElement('td');
        var price = document.createElement('input');
        price.type = 'text';
        price.inputMode = 'decimal';
        price.className = 'row-price';
        price.setAttribute('aria-label', 'Unit price');
        price.addEventListener('input', function () { recalcLine(tr); });
        priceTd.appendChild(price);
        tr.appendChild(priceTd);

        var totalTd = document.createElement('td');
        totalTd.className = 'cell-total';
        var total = document.createElement('input');
        total.type = 'text';
        total.inputMode = 'decimal';
        total.className = 'row-total';
        total.setAttribute('aria-label', 'Line total');
        total.addEventListener('input', function () {
            total.dataset.manual = total.value.trim() ? '1' : '';
            if (!total.dataset.manual) recalcLine(tr);
            recalcSubtotal();
        });
        totalTd.appendChild(total);
        tr.appendChild(totalTd);

        tbody.appendChild(tr);

        // assists: style lookup + verified-color tick + protect hand-typed descriptions
        var styleInput = styleTd.querySelector('input');
        var colorInput = colorTd.querySelector('input');
        var descInput = descTd.querySelector('input');
        descInput.addEventListener('input', function (e) {
            if (e.isTrusted) descInput.dataset.manual = descInput.value.trim() ? '1' : '';
        });
        colorInput.addEventListener('input', function () {
            colorTd.classList.toggle('is-verified', !!colorInput.dataset.catalogColor);
        });
        NWCAFormStyles.attachRow({ styleInput: styleInput, colorCell: colorTd, descInput: descInput });
    }

    function textCell(className, ariaLabel) {
        var td = document.createElement('td');
        td.className = className;
        var input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('aria-label', ariaLabel);
        td.appendChild(input);
        return td;
    }

    function autoCell(tr, className, ariaLabel, downstream) {
        var td = document.createElement('td');
        var input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'numeric';
        input.className = className;
        input.setAttribute('aria-label', ariaLabel);
        input.addEventListener('input', function () {
            input.dataset.manual = input.value.trim() ? '1' : '';
            if (!input.dataset.manual) recalcQty(tr);
            downstream(tr);
        });
        td.appendChild(input);
        return td;
    }

    // ---------- math chain (auto unless the field was hand-typed) ----------

    function money(n) { return (Math.round(n * 100) / 100).toFixed(2); }
    function num(v) { var n = parseFloat(String(v).replace(/[$,\s]/g, '')); return isNaN(n) ? null : n; }

    function recalcQty(tr) {
        var qtyInput = tr.querySelector('.row-qty');
        if (qtyInput.dataset.manual !== '1') {
            var sum = 0;
            var any = false;
            tr.querySelectorAll('.size-qty').forEach(function (el) {
                var n = parseInt(el.value, 10);
                if (!isNaN(n)) { sum += n; any = true; }
            });
            qtyInput.value = any ? String(sum) : '';
        }
        recalcLine(tr);
    }

    function recalcLine(tr) {
        var total = tr.querySelector('.row-total');
        if (total.dataset.manual !== '1') {
            var qty = num(tr.querySelector('.row-qty').value);
            var price = num(tr.querySelector('.row-price').value);
            total.value = (qty !== null && price !== null) ? money(qty * price) : '';
        }
        recalcSubtotal();
    }

    function recalcSubtotal() {
        var subtotal = document.getElementById('fldSubtotal');
        if (subtotal.dataset.manual !== '1') {
            var sum = 0;
            var any = false;
            document.querySelectorAll('#orderRows .row-total').forEach(function (el) {
                var n = num(el.value);
                if (n !== null) { sum += n; any = true; }
            });
            subtotal.value = any ? money(sum) : '';
        }
        recalcTax();
    }

    function recalcTax() {
        var tax = document.getElementById('fldTax');
        if (tax.dataset.manual !== '1' && taxRate !== null) {
            var subtotal = num(document.getElementById('fldSubtotal').value);
            tax.value = subtotal !== null ? money(subtotal * taxRate / 100) : '';
        }
        recalcTotal();
    }

    function recalcTotal() {
        var total = document.getElementById('fldOrderTotal');
        if (total.dataset.manual !== '1') {
            var subtotal = num(document.getElementById('fldSubtotal').value);
            var tax = num(document.getElementById('fldTax').value) || 0;
            total.value = subtotal !== null ? money(subtotal + tax) : '';
        }
        recalcBalance();
    }

    function recalcBalance() {
        var balance = document.getElementById('fldBalanceDue');
        if (balance.dataset.manual !== '1') {
            var total = num(document.getElementById('fldOrderTotal').value);
            var deposit = num(document.getElementById('fldDeposit').value) || 0;
            balance.value = total !== null ? money(total - deposit) : '';
        }
    }

    function wireMoneyField(id, downstream, alwaysManual) {
        var el = document.getElementById(id);
        el.addEventListener('input', function (e) {
            if (!alwaysManual && e.isTrusted) el.dataset.manual = el.value.trim() ? '1' : '';
            downstream();
        });
    }

    // ---------- tax rate (API only — never a hardcoded rate) ----------

    function lookupTaxRate() {
        var zip = document.getElementById('fldTaxZip').value.trim();
        var pickup = document.getElementById('fulPickup').checked;
        // pickup (or no ZIP typed) → look up the shop's own ZIP; still an API answer
        var effectiveZip = (!zip || pickup) ? '98354' : zip;
        setTaxHint('Looking up…', '');
        fetch(NWCAFormSave.apiBase() + '/api/tax-rates/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: '', city: '', state: 'WA', zip: effectiveZip }),
        })
            .then(function (resp) { return resp.json(); })
            .then(function (data) {
                if (!data.success) throw new Error(data.error || 'lookup failed');
                taxRate = data.taxRate;
                if (data.outOfState) {
                    taxRate = 0;
                    setTaxHint('Out of state — no WA tax', 'is-ok');
                } else if (data.fallback) {
                    setTaxHint('Default rate ' + data.taxRate + '% (DOR unavailable) — verify', 'is-warn');
                } else {
                    setTaxHint((data.locationCode || effectiveZip) + ' — ' + data.taxRate + '%', 'is-ok');
                }
                var tax = document.getElementById('fldTax');
                delete tax.dataset.manual; // a fresh lookup re-enables auto tax
                recalcTax();
            })
            .catch(function (err) {
                console.error('[ae-intake] tax lookup failed:', err);
                setTaxHint('Lookup failed — enter tax manually', 'is-warn');
            });
    }

    function setTaxHint(text, cls) {
        var el = document.getElementById('taxHint');
        el.textContent = text;
        el.className = 'tax-hint' + (cls ? ' ' + cls : '');
    }

    // ---------- save ----------

    function buildSubmission() {
        var V = NWCAFormSave.val;
        var methods = [];
        [['mEmbroidery', 'Embroidery'], ['mDtg', 'DTG'], ['mTransfers', 'Transfers'], ['mScreen', 'Screen Printing'],
         ['mLaser', 'Laser Engraving'], ['mPatches', 'Patches'], ['mStickers', 'Stickers'], ['mBanners', 'Banners']]
            .forEach(function (pair) { if (NWCAFormSave.checked(pair[0])) methods.push(pair[1]); });
        if (NWCAFormSave.checked('mOther')) methods.push('Other: ' + (V('mOtherText') || '?'));
        var checksList = methods.slice();
        if (NWCAFormSave.checked('proofYes')) checksList.push('Proof required');
        if (NWCAFormSave.checked('proofNo')) checksList.push('No proof needed');
        if (NWCAFormSave.checked('fulPickup')) checksList.push('Customer Pickup');
        if (NWCAFormSave.checked('fulShip')) checksList.push('Ship');

        var rows = [];
        var totalQty = 0;
        document.querySelectorAll('#orderRows tr').forEach(function (tr) {
            var inputs = tr.querySelectorAll('input');
            // order: style, color, desc, 6 sizes, other, qty, unit price, line total
            var v = Array.prototype.map.call(inputs, function (el) { return el.value.trim(); });
            if (v.some(function (c) { return c; })) {
                var colorInput = tr.querySelector('.cell-color input');
                var catalogColor = (colorInput && colorInput.dataset.catalogColor) || '';
                rows.push([v[0], v[1], catalogColor].concat(v.slice(2)));
                totalQty += parseInt(v[10], 10) || 0;
            }
        });

        var poCust = V('fldPoCustomer');
        return {
            company: V('fldCompany'),
            contactName: V('fldContact'),
            phone: V('fldPhone'),
            email: V('fldEmail'),
            customerNumber: /^\d+$/.test(poCust) ? poCust : '',
            salesRep: V('fldSalesRep'),
            dueDateText: V('fldInHands'),
            summary: totalQty + ' pcs · $' + (V('fldOrderTotal') || '?') + ' · ' + (methods[0] || 'method not marked'),
            payload: {
                fields: [
                    ['Company', V('fldCompany')], ['Contact Name', V('fldContact')], ['Phone', V('fldPhone')],
                    ['Email', V('fldEmail')], ['Sales Rep', V('fldSalesRep')], ['Order Date', V('fldOrderDate')],
                    ['In-Hands Date', V('fldInHands')], ['PO # / Customer #', poCust],
                    ['Decoration Location', V('fldDecoLocation')], ['Logo / Artwork Name', V('fldLogoName')],
                    ['Thread / Print Colors', V('fldThreadColors')], ['Artwork Instructions', V('fldArtInstructions')],
                    ['Ship Method', V('fldShipMethod')], ['Ship-To / Delivery', V('fldShipTo')],
                    ['Pickup / Ship Date', V('fldShipDate')], ['Deposit / Payment Notes', V('fldPaymentNotes')],
                    ['Subtotal', V('fldSubtotal')], ['Tax', V('fldTax')], ['Order Total', V('fldOrderTotal')],
                    ['Deposit', V('fldDeposit')], ['Balance Due', V('fldBalanceDue')],
                ],
                checks: checksList,
                tables: [{
                    title: 'Order Lines',
                    columns: ['Style', 'Color', 'Catalog Color', 'Description', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Other', 'Qty', 'Unit Price', 'Line Total'],
                    rows: rows,
                }],
                notes: [
                    ['Production Notes', V('fldNotes')],
                    ['Printed Name', V('fldPrintedName')], ['Signature Date', V('fldSignDate')],
                ],
            },
        };
    }
})();
