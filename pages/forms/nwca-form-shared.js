/**
 * nwca-form-shared.js — shared behaviors for the fillable form twins in
 * /pages/forms/. Extracted 2026-07-11 from garment-drop-off-form.js.
 *
 * Nothing is saved anywhere — these forms are fill → Print / Save as PDF only.
 *
 * Each form page calls NWCAForm.init({ onAfterClear }) after building its DOM:
 *   - wires #printFormBtn → window.print()
 *   - wires #clearFormBtn → confirm, blank every input/checkbox/textarea,
 *     drop data-manual flags, then onAfterClear() for form-specific resets
 *   - tracks dirty state → beforeunload guard (cleared after printing)
 */
(function (global) {
    'use strict';

    var dirty = false;

    function init(opts) {
        opts = opts || {};

        var printBtn = document.getElementById('printFormBtn');
        if (printBtn) {
            printBtn.addEventListener('click', function () { window.print(); });
        }

        var clearBtn = document.getElementById('clearFormBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                if (!window.confirm('Clear everything typed into this form?')) return;
                document.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], input[type="number"], textarea')
                    .forEach(function (el) { el.value = ''; delete el.dataset.manual; });
                document.querySelectorAll('input[type="checkbox"]').forEach(function (el) { el.checked = false; });
                dirty = false;
                document.dispatchEvent(new CustomEvent('nwca-form:cleared'));
                if (typeof opts.onAfterClear === 'function') opts.onAfterClear();
            });
        }

        document.addEventListener('input', function () { dirty = true; });
        window.addEventListener('beforeunload', function (e) {
            if (!dirty) return;
            e.preventDefault();
            e.returnValue = '';
        });
        window.addEventListener('afterprint', function () { dirty = false; });
    }

    // Successful Save-to-NWCA clears the leave-warning (nwca-form-save.js)
    function markClean() { dirty = false; }

    // ── Staff autofill ────────────────────────────────────────────────────
    // If the visitor has a staff SAML session (same-origin cookie), prefill
    // the given field ids with their first name — only when still empty.
    // Anonymous counter use: the fetch 401s/empty and nothing happens.
    function staffFill(ids) {
        fetch('/api/crm-session/me')
            .then(function (r) { return r.json(); })
            .then(function (me) {
                if (!me || !me.authenticated) return;
                var name = me.name || me.firstName || '';
                if (!name) return;
                (ids || []).forEach(function (id) {
                    var el = document.getElementById(id);
                    if (el && !el.value.trim()) el.value = name;
                });
            })
            .catch(function () { /* anonymous — fine */ });
    }

    // ── Draft autosave (localStorage) ─────────────────────────────────────
    // Generic snapshot/restore so a closed tab doesn't eat a half-filled form.
    //   NWCAForm.autosave({ key: 'ae-order-intake',
    //                       tables: [{ tbody: el, addRow: fn }] })
    // Values keyed by element id; table cells keyed tableIdx:row:cellIdx with
    // rows re-created via addRow() on restore. Cleared on successful save
    // (markClean), on Clear, and after printing.
    function autosave(opts) {
        var key = 'nwca-form-draft:' + (opts && opts.key || location.pathname + location.search);
        var tables = (opts && opts.tables) || [];
        var timer = null;

        function snapshot() {
            var data = { at: Date.now(), fields: {}, checks: {}, tables: [] };
            document.querySelectorAll('input[id], textarea[id]').forEach(function (el) {
                if (el.type === 'checkbox') data.checks[el.id] = el.checked;
                else if (el.type !== 'date') data.fields[el.id] = el.value;
            });
            tables.forEach(function (t) {
                var rows = [];
                t.tbody.querySelectorAll('tr').forEach(function (tr) {
                    var cells = [];
                    tr.querySelectorAll('input').forEach(function (el) {
                        cells.push(el.type === 'checkbox' ? (el.checked ? '__CHK__' : '') : el.value);
                    });
                    rows.push(cells);
                });
                data.tables.push(rows);
            });
            try { localStorage.setItem(key, JSON.stringify(data)); } catch (_) { /* quota — skip */ }
        }

        function clear() { try { localStorage.removeItem(key); } catch (_) {} }

        function restore(data) {
            Object.keys(data.fields || {}).forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.value = data.fields[id];
            });
            Object.keys(data.checks || {}).forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.checked = !!data.checks[id];
            });
            (data.tables || []).forEach(function (rows, ti) {
                var t = tables[ti];
                if (!t) return;
                while (t.tbody.querySelectorAll('tr').length < rows.length && typeof t.addRow === 'function') t.addRow();
                var trs = t.tbody.querySelectorAll('tr');
                rows.forEach(function (cells, ri) {
                    if (!trs[ri]) return;
                    var inputs = trs[ri].querySelectorAll('input');
                    cells.forEach(function (v, ci) {
                        if (!inputs[ci]) return;
                        if (inputs[ci].type === 'checkbox') inputs[ci].checked = v === '__CHK__';
                        else inputs[ci].value = v;
                    });
                    // fire one input per row so auto-math recomputes
                    if (inputs[0]) inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
                });
            });
            document.dispatchEvent(new CustomEvent('nwca-form:restored'));
        }

        // offer restore if a meaningful draft exists (younger than 3 days)
        var saved = null;
        try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) {}
        if (saved && saved.at && Date.now() - saved.at < 3 * 86400000) {
            var hasContent = Object.keys(saved.fields || {}).some(function (id) { return saved.fields[id]; }) ||
                Object.keys(saved.checks || {}).some(function (id) { return saved.checks[id]; });
            if (hasContent) {
                var bar = document.createElement('div');
                bar.className = 'form-save-banner form-save-banner--ok no-print';
                var when = new Date(saved.at);
                bar.innerHTML = '<i class="fas fa-clock-rotate-left"></i> Unsaved draft from ' +
                    ((when.getMonth() + 1) + '/' + when.getDate() + ' ' + ((when.getHours() % 12) || 12) + ':' + String(when.getMinutes()).padStart(2, '0') + (when.getHours() < 12 ? 'am' : 'pm')) +
                    ' — <button type="button" class="draft-restore-btn">Restore it</button> or <button type="button" class="draft-discard-btn">discard</button>.';
                var sheet = document.querySelector('.form-sheet');
                sheet.parentNode.insertBefore(bar, sheet);
                bar.querySelector('.draft-restore-btn').addEventListener('click', function () { restore(saved); bar.remove(); });
                bar.querySelector('.draft-discard-btn').addEventListener('click', function () { clear(); bar.remove(); });
            }
        }

        document.addEventListener('input', function () {
            if (timer) clearTimeout(timer);
            timer = setTimeout(snapshot, 800);
        });
        document.addEventListener('change', function () {
            if (timer) clearTimeout(timer);
            timer = setTimeout(snapshot, 800);
        });
        window.addEventListener('afterprint', clear);
        document.addEventListener('nwca-form:saved', clear);   // fired by nwca-form-save.js
        document.addEventListener('nwca-form:cleared', clear); // fired by the Clear button below

        autosaveClear = clear;
    }

    var autosaveClear = null;

    global.NWCAForm = { init: init, markClean: markClean, staffFill: staffFill, autosave: autosave };
})(window);
