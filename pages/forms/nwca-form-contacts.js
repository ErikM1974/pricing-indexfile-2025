/**
 * nwca-form-contacts.js — customer lookup for the fillable form twins.
 *
 * Type-ahead on the Company/Customer field backed by the proxy's existing
 * CompanyContactsMerge2026 search (GET /api/company-contacts-2026/search —
 * same endpoint the Online Order Form autocomplete uses). Picking a company
 * fills the header fields; picking a specific contact under a company also
 * fills name/email/phone. Typing manually always works — the lookup is an
 * assist, never a requirement. Lookup failure shows a "type manually" row
 * and never blocks the form.
 *
 * Usage (after /config/app.config.js + this file are loaded):
 *   NWCAFormContacts.attach({ input: el })                 // standard field map
 *   NWCAFormContacts.attach({ input: el, onPick: fn })     // custom fill (box label)
 *
 * Standard map fills whichever of these IDs exist on the page:
 *   fldCompany · fldContact · fldPhone · fldEmail · fldCustomerNum ·
 *   fldSalesRep · fldAe
 */
(function (global) {
    'use strict';

    var DEBOUNCE_MS = 250;
    var MIN_CHARS = 2;

    function apiBase() {
        if (global.APP_CONFIG && global.APP_CONFIG.API && global.APP_CONFIG.API.BASE_URL) {
            return global.APP_CONFIG.API.BASE_URL.replace(/\/+$/, '');
        }
        return null; // config missing — lookup disabled, manual typing unaffected
    }

    function fillStandard(company, contact) {
        var set = function (id, value) {
            var el = document.getElementById(id);
            if (el && value) el.value = value;
        };
        set('fldCompany', company.Company_Name);
        set('fldCustomerNum', company.id_Customer != null ? String(company.id_Customer) : '');
        set('fldSalesRep', company.Sales_Rep);
        set('fldAe', company.Sales_Rep);
        if (contact) {
            set('fldContact', contact.ct_NameFull || ((contact.NameFirst || '') + ' ' + (contact.NameLast || '')).trim());
            set('fldEmail', contact.Email);
            set('fldPhone', contact.Phone_Best || contact.Company_Phone || company.Phone_Best || company.Company_Phone);
        } else {
            set('fldPhone', company.Phone_Best || company.Company_Phone);
        }
    }

    function attach(opts) {
        var input = opts && opts.input;
        if (!input) return;

        var box = document.createElement('div');
        box.className = 'contacts-dropdown';
        box.setAttribute('role', 'listbox');
        box.hidden = true;
        // anchor the dropdown to the field's positioned wrapper
        var parent = input.parentNode;
        parent.classList.add('contacts-anchor');
        parent.appendChild(box);

        var timer = null;
        var lastQuery = '';
        var items = []; // flat list of {el, company, contact}
        var active = -1;
        var suppressNext = false; // pick() re-dispatches 'input' for the dirty-guard — don't re-search on it

        input.setAttribute('autocomplete', 'off');

        input.addEventListener('input', function () {
            if (suppressNext) { suppressNext = false; return; }
            var q = input.value.trim();
            if (timer) clearTimeout(timer);
            if (q.length < MIN_CHARS) { hide(); return; }
            timer = setTimeout(function () { search(q); }, DEBOUNCE_MS);
        });

        input.addEventListener('keydown', function (e) {
            if (box.hidden) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
            else if (e.key === 'Enter') { if (active >= 0) { e.preventDefault(); pick(items[active]); } }
            else if (e.key === 'Escape') { hide(); }
        });

        document.addEventListener('click', function (e) {
            if (e.target !== input && !box.contains(e.target)) hide();
        });

        function search(q) {
            var base = apiBase();
            if (!base) { hide(); return; }
            lastQuery = q;
            fetch(base + '/api/company-contacts-2026/search?q=' + encodeURIComponent(q) + '&limit=8')
                .then(function (resp) {
                    if (!resp.ok) throw new Error('HTTP ' + resp.status);
                    return resp.json();
                })
                .then(function (data) {
                    if (q !== lastQuery) return; // stale response
                    render(data.companies || []);
                })
                .catch(function (err) {
                    console.error('[form-contacts] lookup failed:', err);
                    renderMessage('Customer lookup unavailable — keep typing manually.');
                });
        }

        function render(companies) {
            box.innerHTML = '';
            items = [];
            active = -1;
            if (!companies.length) { renderMessage('No matches — keep typing manually.'); return; }
            companies.forEach(function (company) {
                items.push({ el: row(companyLabel(company), 'contacts-row--company'), company: company, contact: null });
                (company.contacts || []).slice(0, 4).forEach(function (contact) {
                    items.push({
                        el: row(contactLabel(contact), 'contacts-row--contact'),
                        company: company,
                        contact: contact
                    });
                });
            });
            items.forEach(function (item, i) {
                item.el.addEventListener('mousedown', function (e) { e.preventDefault(); pick(item); });
                item.el.addEventListener('mousemove', function () { setActive(i); });
                box.appendChild(item.el);
            });
            box.hidden = false;
        }

        function companyLabel(c) {
            var where = [c.City, c.State].filter(Boolean).join(', ');
            return '<strong>' + escapeHtml(c.Company_Name || '(no name)') + '</strong>' +
                   (where ? ' <span class="contacts-muted">' + escapeHtml(where) + '</span>' : '') +
                   (c.id_Customer != null ? ' <span class="contacts-muted">#' + escapeHtml(String(c.id_Customer)) + '</span>' : '');
        }

        function contactLabel(ct) {
            var name = ct.ct_NameFull || ((ct.NameFirst || '') + ' ' + (ct.NameLast || '')).trim();
            return escapeHtml(name || '(no name)') +
                   (ct.Email ? ' <span class="contacts-muted">' + escapeHtml(ct.Email) + '</span>' : '');
        }

        function row(html, cls) {
            var el = document.createElement('div');
            el.className = 'contacts-row ' + cls;
            el.setAttribute('role', 'option');
            el.innerHTML = html;
            return el;
        }

        function renderMessage(text) {
            box.innerHTML = '';
            items = [];
            active = -1;
            var el = document.createElement('div');
            el.className = 'contacts-row contacts-row--empty';
            el.textContent = text;
            box.appendChild(el);
            box.hidden = false;
        }

        function move(delta) {
            if (!items.length) return;
            setActive((active + delta + items.length) % items.length);
        }

        function setActive(i) {
            if (active >= 0 && items[active]) items[active].el.classList.remove('is-active');
            active = i;
            if (items[active]) {
                items[active].el.classList.add('is-active');
                items[active].el.scrollIntoView({ block: 'nearest' });
            }
        }

        function pick(item) {
            if (!item) return;
            if (typeof opts.onPick === 'function') {
                opts.onPick(item.company, item.contact);
            } else {
                fillStandard(item.company, item.contact);
            }
            hide();
            if (timer) clearTimeout(timer); // kill any pending debounce from the typed query
            lastQuery = '';                 // invalidate any fetch already in flight
            suppressNext = true;
            input.dispatchEvent(new Event('input', { bubbles: true })); // dirty-guard sees the fill
        }

        function hide() {
            box.hidden = true;
            items = [];
            active = -1;
        }
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    global.NWCAFormContacts = { attach: attach, fillStandard: fillStandard };
})(window);
