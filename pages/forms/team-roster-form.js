/**
 * team-roster-form.js — pages/forms/team-roster-form.html
 *
 * Names & numbers roster: ONE garment spec (SanMar style lookup + swatch
 * color) + a player grid. The size tally line ("S×2 · M×5 … — 15 players")
 * recomputes live and PRINTS, so production can pull blanks straight off the
 * sheet. Saves machine-readable lines[] {name, number, size} like the AE
 * intake — a future ShopWorks per-line push can consume it unchanged.
 * Save to NWCA → Forms Inbox (RST prefix).
 */
(function () {
    'use strict';

    var DEFAULT_ROWS = 14;

    document.addEventListener('DOMContentLoaded', function () {
        var tbody = document.getElementById('rosterRows');
        for (var i = 0; i < DEFAULT_ROWS; i++) addRow(tbody);
        document.getElementById('addRowBtn').addEventListener('click', function () { addRow(tbody); });

        NWCAForm.init({ onAfterClear: function () { renumber(); recalcTally(); } });
        NWCAFormContacts.attach({ input: document.getElementById('fldCompany') });
        NWCAFormSave.init({ formId: 'team-roster', build: buildSubmission });
        NWCAFormDates.attach('fldDueDate');
        NWCAForm.staffFill(['fldSalesRep']);
        NWCAForm.autosave({ key: 'team-roster', tables: [{ tbody: tbody, addRow: function () { addRow(tbody); } }] });

        var descInput = document.getElementById('fldDescription');
        descInput.addEventListener('input', function (e) {
            if (e.isTrusted) descInput.dataset.manual = descInput.value.trim() ? '1' : '';
        });
        var colorCell = document.getElementById('colorCell');
        var colorInput = document.getElementById('fldColor');
        NWCAFormStyles.attachRow({
            styleInput: document.getElementById('fldStyle'),
            colorCell: colorCell,
            descInput: descInput,
        });
        // SanMar-verified color → real size run becomes a datalist on Size cells
        colorInput.addEventListener('input', function () {
            var style = document.getElementById('fldStyle').value.trim().toUpperCase();
            var catalogColor = colorInput.dataset.catalogColor;
            if (!style || !catalogColor) return;
            NWCAFormStyles.loadSizes(style, catalogColor).then(function (sizes) {
                if (!sizes || !sizes.length) return;
                var dl = document.getElementById('rosterSizes');
                if (!dl) {
                    dl = document.createElement('datalist');
                    dl.id = 'rosterSizes';
                    document.body.appendChild(dl);
                }
                dl.innerHTML = sizes.map(function (s) { return '<option value="' + escapeHtml(s) + '">'; }).join('');
                document.querySelectorAll('#rosterRows .row-size').forEach(function (el) {
                    el.setAttribute('list', 'rosterSizes');
                });
            }).catch(function (err) {
                console.error('[team-roster] size list failed (free typing stays):', err);
            });
        });
    });

    function addRow(tbody) {
        var tr = document.createElement('tr');

        var nTd = document.createElement('td');
        nTd.className = 'cell-n';
        tr.appendChild(nTd);

        tr.appendChild(cell('row-name', 'Player name'));
        tr.appendChild(cell('row-number', 'Jersey number'));
        var sizeTd = cell('row-size', 'Size');
        sizeTd.querySelector('input').setAttribute('list', 'rosterSizes');
        tr.appendChild(sizeTd);
        tr.appendChild(cell('row-notes', 'Notes'));

        tr.querySelectorAll('input').forEach(function (el) {
            el.addEventListener('input', recalcTally);
        });

        tbody.appendChild(tr);
        renumber();
    }

    function cell(className, ariaLabel) {
        var td = document.createElement('td');
        var input = document.createElement('input');
        input.type = 'text';
        input.className = className;
        input.setAttribute('aria-label', ariaLabel);
        td.appendChild(input);
        return td;
    }

    function renumber() {
        var n = 1;
        document.querySelectorAll('#rosterRows tr .cell-n').forEach(function (td) { td.textContent = n++; });
    }

    // "Sizes: S×2 · M×5 · L×8 — 15 players" — prints, so production pulls
    // blanks straight off the sheet without hand-counting the grid
    function recalcTally() {
        var counts = {};
        var order = [];
        var players = 0;
        document.querySelectorAll('#rosterRows tr').forEach(function (tr) {
            var name = tr.querySelector('.row-name').value.trim();
            var size = tr.querySelector('.row-size').value.trim().toUpperCase();
            if (!name && !size) return;
            players++;
            if (size) {
                if (!(size in counts)) order.push(size);
                counts[size] = (counts[size] || 0) + 1;
            }
        });
        var el = document.getElementById('rosterTally');
        if (!players) { el.textContent = ''; return; }
        var parts = order.map(function (s) { return s + '×' + counts[s]; });
        el.textContent = 'Sizes: ' + (parts.join(' · ') || '(none typed)') + ' — ' + players +
            (players === 1 ? ' player' : ' players');
    }

    function buildSubmission() {
        var V = NWCAFormSave.val;
        var rows = [];
        var lines = [];
        document.querySelectorAll('#rosterRows tr').forEach(function (tr, i) {
            var name = tr.querySelector('.row-name').value.trim();
            var number = tr.querySelector('.row-number').value.trim();
            var size = tr.querySelector('.row-size').value.trim().toUpperCase();
            var notes = tr.querySelector('.row-notes').value.trim();
            if (!name && !number && !size && !notes) return;
            rows.push([String(i + 1), name, number, size, notes]);
            lines.push({ n: i + 1, name: name, number: number, size: size, notes: notes });
        });

        var colorInput = document.getElementById('fldColor');
        return {
            company: V('fldCompany'),
            contactName: V('fldContact'),
            phone: V('fldPhone'),
            email: V('fldEmail'),
            customerNumber: '',
            salesRep: V('fldSalesRep'),
            dueDateText: V('fldDueDate'),
            summary: lines.length + (lines.length === 1 ? ' name · ' : ' names · ') +
                     (V('fldStyle') || 'style ?') + ' ' + (V('fldColor') || '') +
                     (V('fldDueDate') ? ' · due ' + V('fldDueDate') : ''),
            payload: {
                fields: [
                    ['Company / Team', V('fldCompany')], ['Contact', V('fldContact')],
                    ['Phone', V('fldPhone')], ['Email', V('fldEmail')],
                    ['Sales Rep', V('fldSalesRep')], ['Needed By', V('fldDueDate')],
                    ['Style #', V('fldStyle')], ['Color', V('fldColor')],
                    ['Catalog Color', colorInput.dataset.catalogColor || ''],
                    ['Description', V('fldDescription')],
                    ['Name placement', V('fldNamePlacement')], ['Number placement', V('fldNumberPlacement')],
                    ['Font / Style', V('fldFont')], ['Thread / Print color', V('fldThreadColor')],
                    ['Size tally', document.getElementById('rosterTally').textContent],
                ],
                checks: [],
                tables: [{
                    title: 'Roster',
                    columns: ['#', 'Player / Name', 'Number', 'Size', 'Notes'],
                    rows: rows,
                }],
                notes: [],
                lines: lines,
                style: V('fldStyle'),
                catalogColor: colorInput.dataset.catalogColor || '',
            },
        };
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
})();
