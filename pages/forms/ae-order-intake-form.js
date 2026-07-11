/**
 * ae-order-intake-form.js — pages/forms/ae-order-intake-form.html
 *
 * Fill-in-the-browser twin of the AE pre-ShopWorks order sheet, with data
 * assists (all existing public endpoints — nothing hand-priced):
 *   - customer type-ahead + contact sub-picker + Customer_Warning/Tax-Exempt/
 *     Terms banners (NWCAFormContacts)
 *   - per-row SanMar style lookup + swatch color picker (NWCAFormStyles);
 *     picking style+color swaps the row's size chips for that style's REAL
 *     size list, with extended-size upcharges from Standard_Size_Upcharges
 *     (via /api/max-prices-by-style — same source as the pricing engine)
 *   - per-row 💰 Quick Quote link (opens the engine tool pre-seeded — this
 *     form never computes decorated prices itself, Rule 9)
 *   - digitized-design lookup on Logo/Artwork (NWCAFormDesigns) — captures
 *     the design # so the ShopWorks push can LINK the design
 *   - hybrid 📅 date pickers, DOR tax lookup, staff autofill, draft autosave
 *
 * Auto-math: sizes → Qty → Line Total (per-size price = base + upcharge) →
 * Subtotal → Tax → Order Total → Balance Due; every auto field editable
 * (typing turns auto OFF for that field). Unit Price = the BASE price the AE
 * quoted; extended sizes add their Caspio upcharge on top automatically.
 */
(function () {
    'use strict';

    var DEFAULT_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
    var DEFAULT_ROWS = 4;
    var taxRate = null; // percent, from /api/tax-rates/lookup only

    document.addEventListener('DOMContentLoaded', function () {
        var tbody = document.getElementById('orderRows');
        for (var i = 0; i < DEFAULT_ROWS; i++) addRow(tbody);

        document.getElementById('addRowBtn').addEventListener('click', function () { addRow(tbody); });

        var today = new Date();
        document.getElementById('fldOrderDate').value =
            (today.getMonth() + 1) + '/' + today.getDate() + '/' + today.getFullYear();

        wireMoneyField('fldSubtotal', recalcTax);
        wireMoneyField('fldTax', recalcTotal);
        wireMoneyField('fldOrderTotal', recalcBalance);
        wireMoneyField('fldDeposit', recalcBalance, true);
        wireMoneyField('fldBalanceDue', function () {});

        document.getElementById('taxLookupBtn').addEventListener('click', lookupTaxRate);

        NWCAForm.init({ onAfterClear: function () { taxRate = null; setTaxHint('', ''); recalcSubtotal(); } });
        NWCAFormContacts.attach({ input: document.getElementById('fldCompany') });
        NWCAFormSave.init({ formId: 'ae-order-intake', build: buildSubmission });
        NWCAFormDates.attach('fldOrderDate', 'fldInHands', 'fldShipDate');
        NWCAForm.staffFill(['fldSalesRep']);
        NWCAForm.autosave({ key: 'ae-order-intake', tables: [{ tbody: tbody, addRow: function () { addRow(tbody); } }] });

        NWCAFormDesigns.attach({
            input: document.getElementById('fldLogoName'),
            customerId: function () {
                var el = document.getElementById('fldCustomerNum');
                var v = el ? el.value.trim() : '';
                return /^\d+$/.test(v) ? v : '';
            },
        });

        // picked-company intelligence → prefill payment notes with terms
        document.addEventListener('nwca-contacts:company', function (e) {
            var company = e.detail || {};
            var terms = company.Payment_Terms || company.CustTerms || company.Preferred_Terms_FromOrders;
            var notes = document.getElementById('fldPaymentNotes');
            if (terms && notes && !notes.value.trim()) notes.value = 'Terms: ' + terms;
        });
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

        // ONE sizes cell holding size chips (default S–3XL; swaps to the
        // style's real size run — incl. 4XL/5XL/talls — after style+color pick)
        var sizesTd = document.createElement('td');
        sizesTd.className = 'cell-sizes';
        var chips = document.createElement('div');
        chips.className = 'size-chips';
        sizesTd.appendChild(chips);
        tr.appendChild(sizesTd);
        buildChips(tr, DEFAULT_SIZES, {});

        tr.appendChild(textCell('cell-text cell-other', 'Other sizes'));

        tr.appendChild(autoCell(tr, 'row-qty', 'Quantity', recalcLine));

        var priceTd = document.createElement('td');
        var price = document.createElement('input');
        price.type = 'text';
        price.inputMode = 'decimal';
        price.className = 'row-price';
        price.setAttribute('aria-label', 'Base unit price');
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

        var styleInput = styleTd.querySelector('input');
        var colorInput = colorTd.querySelector('input');
        var descInput = descTd.querySelector('input');
        descInput.addEventListener('input', function (e) {
            if (e.isTrusted) descInput.dataset.manual = descInput.value.trim() ? '1' : '';
        });
        styleInput.addEventListener('blur', function () {
            styleInput.value = styleInput.value.toUpperCase().trim();
        });
        colorInput.addEventListener('input', function () {
            colorTd.classList.toggle('is-verified', !!colorInput.dataset.catalogColor);
            maybeLoadRealSizes(tr, styleInput, colorInput);
        });
        NWCAFormStyles.attachRow({ styleInput: styleInput, colorCell: colorTd, descInput: descInput });
    }

    function buildChips(tr, sizeList, upchargeMap) {
        var chips = tr.querySelector('.size-chips');
        // preserve any quantities already typed, by size label
        var existing = {};
        chips.querySelectorAll('.size-qty').forEach(function (el) {
            if (el.value) existing[el.dataset.size] = el.value;
        });
        chips.innerHTML = '';
        sizeList.forEach(function (size) {
            var up = parseFloat(upchargeMap[String(size).toUpperCase()]) || 0;
            var chip = document.createElement('span');
            chip.className = 'size-chip' + (up ? ' size-chip--upcharge' : '');
            var label = document.createElement('label');
            label.textContent = size;
            if (up) label.title = 'Extended size: +$' + up.toFixed(2) + ' (Caspio Standard_Size_Upcharges)';
            var input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.className = 'size-qty';
            input.dataset.size = size;
            input.dataset.upcharge = String(up);
            input.setAttribute('aria-label', 'Qty size ' + size);
            if (existing[size]) input.value = existing[size];
            input.addEventListener('input', function () { recalcQty(tr); });
            chip.appendChild(label);
            chip.appendChild(input);
            chips.appendChild(chip);
        });
        recalcQty(tr);
    }

    // style + SanMar-verified color → swap in the style's real size run + upcharges
    function maybeLoadRealSizes(tr, styleInput, colorInput) {
        var style = styleInput.value.trim().toUpperCase();
        var catalogColor = colorInput.dataset.catalogColor;
        if (!style || !catalogColor) return;
        var stamp = style + '|' + catalogColor;
        if (tr.dataset.sizesFor === stamp) return;
        tr.dataset.sizesFor = stamp;

        Promise.all([
            NWCAFormStyles.loadSizes(style, catalogColor),
            NWCAFormStyles.loadUpcharges(style),
        ]).then(function (results) {
            var sizes = results[0];
            var upcharges = results[1] || {};
            if (tr.dataset.sizesFor !== stamp) return; // row re-picked meanwhile
            if (sizes && sizes.length) buildChips(tr, sizes, upcharges);
            ensureQqLink(tr, style);
        }).catch(function (err) {
            console.error('[ae-intake] size load failed (default grid stays):', err);
            ensureQqLink(tr, style);
        });
    }

    // 💰 Quick Quote — read the REAL decorated price from the engine tool
    function ensureQqLink(tr, style) {
        var chips = tr.querySelector('.cell-sizes');
        var link = chips.querySelector('.qq-link');
        if (!link) {
            link = document.createElement('a');
            link.className = 'qq-link no-print';
            link.target = '_blank';
            link.rel = 'noopener';
            link.innerHTML = '<i class="fas fa-sack-dollar"></i> Quick Quote';
            chips.appendChild(link);
        }
        link.addEventListener('click', function () {
            var qty = tr.querySelector('.row-qty').value || '';
            link.href = '/calculators/quick-quote/index.html?style=' + encodeURIComponent(style) + (qty ? '&qty=' + encodeURIComponent(qty) : '');
        });
        link.href = '/calculators/quick-quote/index.html?style=' + encodeURIComponent(style);
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

    // ---------- math chain ----------

    function money(n) { return (Math.round(n * 100) / 100).toFixed(2); }
    function num(v) { var n = parseFloat(String(v).replace(/[$,\s]/g, '')); return isNaN(n) ? null : n; }

    function recalcQty(tr) {
        var qtyInput = tr.querySelector('.row-qty');
        if (qtyInput && qtyInput.dataset.manual !== '1') {
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

    // line total = Σ per-size qty × (base + that size's upcharge)
    function recalcLine(tr) {
        var total = tr.querySelector('.row-total');
        if (!total) return;
        if (total.dataset.manual !== '1') {
            var base = num(tr.querySelector('.row-price').value);
            if (base === null) {
                total.value = '';
            } else {
                var sum = 0;
                var any = false;
                tr.querySelectorAll('.size-qty').forEach(function (el) {
                    var q = parseInt(el.value, 10);
                    if (isNaN(q) || q <= 0) return;
                    sum += q * (base + (parseFloat(el.dataset.upcharge) || 0));
                    any = true;
                });
                if (!any) {
                    // no size split typed — fall back to Qty × base
                    var qty = num(tr.querySelector('.row-qty').value);
                    total.value = qty !== null ? money(qty * base) : '';
                } else {
                    total.value = money(sum);
                }
            }
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
                delete tax.dataset.manual;
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

        var rows = [];      // human-readable table for the Inbox
        var lines = [];     // machine block for the ShopWorks push
        var totalQty = 0;
        document.querySelectorAll('#orderRows tr').forEach(function (tr) {
            var style = tr.querySelector('.cell-style input').value.trim();
            var colorInput = tr.querySelector('.cell-color input');
            var colorName = colorInput.value.trim();
            var catalogColor = colorInput.dataset.catalogColor || '';
            var description = tr.querySelector('.cell-desc input').value.trim();
            var otherSizes = tr.querySelector('.cell-other input').value.trim();
            var qty = tr.querySelector('.row-qty').value.trim();
            var basePrice = tr.querySelector('.row-price').value.trim();
            var lineTotal = tr.querySelector('.row-total').value.trim();

            var sizes = [];
            var sizesDisplay = [];
            tr.querySelectorAll('.size-qty').forEach(function (el) {
                var q = parseInt(el.value, 10);
                if (isNaN(q) || q <= 0) return;
                var up = parseFloat(el.dataset.upcharge) || 0;
                sizes.push({ size: el.dataset.size, qty: q, upcharge: up });
                sizesDisplay.push(el.dataset.size + '×' + q + (up ? '(+$' + up.toFixed(2) + ')' : ''));
            });

            var anything = style || colorName || description || sizes.length || otherSizes || qty || basePrice;
            if (!anything) return;

            totalQty += parseInt(qty, 10) || 0;
            rows.push([style, colorName, catalogColor, description, sizesDisplay.join(' '), otherSizes, qty, basePrice, lineTotal]);
            lines.push({
                style: style, colorName: colorName, catalogColor: catalogColor, description: description,
                basePrice: basePrice, sizes: sizes, otherSizes: otherSizes, qty: qty, lineTotal: lineTotal,
            });
        });

        var logoInput = document.getElementById('fldLogoName');
        var designNumber = logoInput.dataset.designNumber || '';

        var poCust = V('fldPoCustomer');
        return {
            company: V('fldCompany'),
            contactName: V('fldContact'),
            phone: V('fldPhone'),
            email: V('fldEmail'),
            customerNumber: /^\d+$/.test(poCust) ? poCust : V('fldCustomerNum'),
            salesRep: V('fldSalesRep'),
            dueDateText: V('fldInHands'),
            summary: totalQty + ' pcs · $' + (V('fldOrderTotal') || '?') + ' · ' + (methods[0] || 'method not marked') +
                     (designNumber ? ' · design #' + designNumber : ''),
            payload: {
                fields: [
                    ['Company', V('fldCompany')], ['Contact Name', V('fldContact')], ['Phone', V('fldPhone')],
                    ['Email', V('fldEmail')], ['Sales Rep', V('fldSalesRep')], ['Order Date', V('fldOrderDate')],
                    ['In-Hands Date', V('fldInHands')], ['PO # / Customer #', poCust],
                    ['Decoration Location', V('fldDecoLocation')], ['Logo / Artwork Name', V('fldLogoName')],
                    ['Design #', designNumber],
                    ['Thread / Print Colors', V('fldThreadColors')], ['Artwork Instructions', V('fldArtInstructions')],
                    ['Ship Method', V('fldShipMethod')], ['Ship-To / Delivery', V('fldShipTo')],
                    ['Pickup / Ship Date', V('fldShipDate')], ['Deposit / Payment Notes', V('fldPaymentNotes')],
                    ['Subtotal', V('fldSubtotal')], ['Tax', V('fldTax')], ['Order Total', V('fldOrderTotal')],
                    ['Deposit', V('fldDeposit')], ['Balance Due', V('fldBalanceDue')],
                ],
                checks: checksList,
                tables: [{
                    title: 'Order Lines',
                    columns: ['Style', 'Color', 'Catalog Color', 'Description', 'Sizes', 'Other', 'Qty', 'Base Price', 'Line Total'],
                    rows: rows,
                }],
                lines: lines,                       // machine block for the SW push
                designNumber: designNumber,         // captured digitized design link
                designName: V('fldLogoName'),
                notes: [
                    ['Production Notes', V('fldNotes')],
                    ['Printed Name', V('fldPrintedName')], ['Signature Date', V('fldSignDate')],
                ],
            },
        };
    }
})();
