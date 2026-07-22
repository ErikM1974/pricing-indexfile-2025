/**
 * jim-mailing-list.js — controller for dashboards/jim-mailing-list.html
 *
 * The owner's ("Jim's") manual prospect / mailing list. Add / edit / delete
 * companies. One same-origin call to the SAML-session forwarder
 * /api/crm-proxy/jim-mailing-list* (which adds the CRM secret + stamps identity
 * before hitting the proxy's secret-only Prospect_Mailing_List route).
 *
 * Built for an 83-year-old, non-technical user: one form (reused for add AND
 * edit), plain confirmations, and every failure shown loudly via
 * DashPage.showError — never a silently empty or wrong list.
 */
(function () {
    'use strict';

    var API = '/api/crm-proxy/jim-mailing-list';

    var state = {
        entries: [],      // rows from the API
        search: '',
        editingId: null,  // PK_ID being edited, or null when adding
    };

    // form field id → Caspio column
    var FIELD_MAP = {
        'jml-company': 'Company',
        'jml-contact': 'Contact_Name',
        'jml-address': 'Address',
        'jml-city': 'City',
        'jml-state': 'State',
        'jml-zip': 'Zip',
        'jml-phone': 'Phone',
        'jml-email': 'Email',
        'jml-website': 'Website',
        'jml-source': 'Source',
        'jml-category': 'Category',
        'jml-notes': 'Notes',
    };

    function el(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        el('jml-form').addEventListener('submit', onSubmit);
        el('jml-cancel').addEventListener('click', cancelEdit);
        el('jml-search').addEventListener('input', function () {
            state.search = el('jml-search').value.trim().toLowerCase();
            render();
        });
        // Delegated — the list is rebuilt on every render(), so listen on the container.
        el('jml-list').addEventListener('click', onListClick);
        load();
    });

    // ── data ──────────────────────────────────────────────────────────────
    function jsonFetch(url, options) {
        var opts = options || {};
        opts.credentials = 'same-origin';
        return fetch(url, opts).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
                if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
                return j;
            });
        });
    }

    function load() {
        DashPage.hideError();
        el('jml-list').innerHTML = '<div class="jml-loading">Loading your list…</div>';
        jsonFetch(API)
            .then(function (data) {
                state.entries = (data.entries || []).slice();
                render();
            })
            .catch(function (err) {
                el('jml-list').innerHTML = '<div class="jml-empty">Your list could not load.</div>';
                DashPage.showError('Could not load the mailing list: ' + err.message + ' — press Refresh or try again.');
            });
    }

    // ── add / edit ────────────────────────────────────────────────────────
    function onSubmit(e) {
        e.preventDefault();
        DashPage.hideError();

        var body = {};
        Object.keys(FIELD_MAP).forEach(function (fid) { body[FIELD_MAP[fid]] = el(fid).value.trim(); });

        if (!body.Company) {
            DashPage.showError('Please type a company name before saving.');
            el('jml-company').focus();
            return;
        }

        var editing = state.editingId != null;
        var save = el('jml-save');
        save.disabled = true;

        var req = editing
            ? jsonFetch(API + '/' + encodeURIComponent(state.editingId), {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            })
            : jsonFetch(API, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });

        req.then(function () {
            var name = body.Company;
            resetForm();
            showOk((editing ? 'Saved your changes to ' : 'Added ') + name + '.');
            load();
        }).catch(function (err) {
            save.disabled = false;
            DashPage.showError('Could not save: ' + err.message + ' — nothing was changed, please try again.');
        });
    }

    function startEdit(id) {
        var row = state.entries.filter(function (r) { return String(r.PK_ID) === String(id); })[0];
        if (!row) return;
        state.editingId = row.PK_ID;
        Object.keys(FIELD_MAP).forEach(function (fid) { el(fid).value = row[FIELD_MAP[fid]] || ''; });

        el('jml-form-title').innerHTML = '<i class="fas fa-pen" aria-hidden="true"></i> Editing ' + esc(row.Company);
        el('jml-save-text').textContent = 'Save changes';
        el('jml-cancel').hidden = false;
        document.querySelector('.jml-form-card').classList.add('is-editing');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        el('jml-company').focus();
    }

    function cancelEdit() { resetForm(); }

    function resetForm() {
        state.editingId = null;
        el('jml-form').reset();
        el('jml-form-title').innerHTML = '<i class="fas fa-plus-circle" aria-hidden="true"></i> Add a company';
        el('jml-save-text').textContent = 'Save company';
        el('jml-save').disabled = false;
        el('jml-cancel').hidden = true;
        document.querySelector('.jml-form-card').classList.remove('is-editing');
    }

    // ── delete ────────────────────────────────────────────────────────────
    function remove(id) {
        var row = state.entries.filter(function (r) { return String(r.PK_ID) === String(id); })[0];
        if (!row) return;
        if (!window.confirm('Remove ' + row.Company + ' from your list?\n\nThis cannot be undone.')) return;
        DashPage.hideError();
        jsonFetch(API + '/' + encodeURIComponent(id), { method: 'DELETE' })
            .then(function () {
                if (state.editingId != null && String(state.editingId) === String(id)) resetForm();
                showOk('Removed ' + row.Company + '.');
                load();
            })
            .catch(function (err) {
                DashPage.showError('Could not remove ' + row.Company + ': ' + err.message + ' — it is still on your list.');
            });
    }

    function onListClick(e) {
        var btn = e.target.closest('[data-act]');
        if (!btn) return;
        var id = btn.getAttribute('data-id');
        if (btn.getAttribute('data-act') === 'edit') startEdit(id);
        else if (btn.getAttribute('data-act') === 'delete') remove(id);
    }

    // ── render ────────────────────────────────────────────────────────────
    function matches(row) {
        if (!state.search) return true;
        var hay = [row.Company, row.Contact_Name, row.Address, row.City, row.State,
            row.Zip, row.Phone, row.Email, row.Website, row.Source, row.Category, row.Notes].join(' ').toLowerCase();
        return hay.indexOf(state.search) !== -1;
    }

    function render() {
        var rows = state.entries.filter(matches);
        var total = state.entries.length;

        if (!total) el('jml-count').textContent = '';
        else if (state.search) el('jml-count').textContent = '(showing ' + rows.length + ' of ' + total + ')';
        else el('jml-count').textContent = '(' + total + ' ' + (total === 1 ? 'company' : 'companies') + ')';

        if (!total) {
            el('jml-list').innerHTML = '<div class="jml-empty"><i class="fas fa-inbox" aria-hidden="true"></i>' +
                'Your list is empty. Add your first company using the form above.</div>';
            return;
        }
        if (!rows.length) {
            el('jml-list').innerHTML = '<div class="jml-empty">No companies match “' + esc(state.search) + '”.</div>';
            return;
        }
        el('jml-list').innerHTML = rows.map(entryHtml).join('');
    }

    function entryHtml(r) {
        var lines = [];

        if (r.Contact_Name) lines.push(line('fa-user', esc(r.Contact_Name)));

        // Street on its own line, then "City, State ZIP"
        var cityLine = [r.City && r.State ? r.City + ', ' + r.State : (r.City || r.State || ''), r.Zip].filter(Boolean).join(' ');
        if (r.Address) lines.push(line('fa-location-dot', esc(r.Address)));
        if (cityLine) lines.push(line(r.Address ? '' : 'fa-location-dot', esc(cityLine)));

        if (r.Phone) lines.push(line('fa-phone', '<a href="tel:' + esc(r.Phone.replace(/[^0-9+]/g, '')) + '">' + esc(r.Phone) + '</a>'));
        if (r.Email) lines.push(line('fa-envelope', '<a href="mailto:' + esc(r.Email) + '">' + esc(r.Email) + '</a>'));
        if (r.Website) lines.push(line('fa-globe', '<a href="' + esc(webHref(r.Website)) + '" target="_blank" rel="noopener noreferrer">' + esc(webLabel(r.Website)) + '</a>'));

        var extra = '';
        if (r.Category) extra += '<span class="jml-entry-cat"><i class="fas fa-tag" aria-hidden="true"></i> ' + esc(r.Category) + '</span>';
        if (r.Notes) extra += '<div class="jml-entry-notes">' + esc(r.Notes) + '</div>';
        if (r.Source) extra += '<span class="jml-entry-source"><i class="fas fa-book-open" aria-hidden="true"></i> Found in: ' + esc(r.Source) + '</span>';

        return '<div class="jml-entry">' +
            '<div class="jml-entry-main">' +
                '<h3 class="jml-entry-name">' + esc(r.Company) + '</h3>' +
                lines.join('') + extra +
            '</div>' +
            '<div class="jml-entry-actions">' +
                '<button type="button" class="jml-mini-btn jml-edit" data-act="edit" data-id="' + esc(r.PK_ID) + '">' +
                    '<i class="fas fa-pen" aria-hidden="true"></i> Edit</button>' +
                '<button type="button" class="jml-mini-btn jml-delete" data-act="delete" data-id="' + esc(r.PK_ID) + '">' +
                    '<i class="fas fa-trash" aria-hidden="true"></i> Delete</button>' +
            '</div>' +
        '</div>';
    }

    function line(icon, html) {
        return '<div class="jml-entry-line">' + (icon ? '<i class="fas ' + icon + '" aria-hidden="true"></i>' : '<i></i>') + html + '</div>';
    }
    // Website may arrive as "www.foo.com" (no scheme) — add https:// for the link,
    // and show a clean label without the scheme / trailing slash.
    function webHref(u) { var s = String(u == null ? '' : u).trim(); if (!s) return ''; return /^https?:\/\//i.test(s) ? s : 'https://' + s; }
    function webLabel(u) { return String(u == null ? '' : u).trim().replace(/^https?:\/\//i, '').replace(/\/+$/, ''); }

    // ── success confirmation (auto-hides) ─────────────────────────────────
    var okTimer = null;
    function showOk(msg) {
        el('jml-ok-text').textContent = msg;
        el('jml-ok').hidden = false;
        if (okTimer) clearTimeout(okTimer);
        okTimer = setTimeout(function () { el('jml-ok').hidden = true; }, 4000);
    }
})();
