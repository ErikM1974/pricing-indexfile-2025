/**
 * CompanyContactPicker — Hybrid grouped Company + Contact autocomplete
 * for AE intake forms. Replaces the wall-of-duplicates pattern from
 * CustomerLookupService.bindToInput where typing a company name returned
 * one row per contact (so "Northwest Custom Apparel" appeared 10+ times).
 *
 * Single search box. Type 3+ chars → /api/company-contacts/search returns
 * up to 25 contacts. Client groups results into sections:
 *
 *   ┌─────────────────────────────────────────────┐
 *   │ RECENTLY USED  (from localStorage)          │
 *   │   Bob Rowe @ Wesley Homes        rrowe@…    │
 *   │ COMPANIES (deduped by id_Customer)          │
 *   │   Northwest Custom Apparel  12 contacts ›   │
 *   │   Northwest Embroidery       3 contacts ›   │
 *   │ CONTACTS                                    │
 *   │   Kim Whitney  @ Northwest Custom Apparel   │
 *   │   Steve Deland @ Northwest Custom Apparel   │
 *   └─────────────────────────────────────────────┘
 *
 * Click a Contact → fills Company Name + Contact Name + Email + the
 *   hidden customerId in one shot. Done.
 * Click a Company → fetches /api/company-contacts/by-company and swaps
 *   the dropdown to that company's full contact list (Stage 2).
 *
 * Free-typing the Company Name is still allowed; customerId stays empty
 * if no match is selected (same behavior as the legacy autocomplete).
 *
 * Used by 3 art intake forms (sticker-banner, jds, mockup-submit).
 * The 4 quote builders keep using CustomerLookupService — their UX is
 * single-contact-per-quote and doesn't benefit from grouping.
 *
 * Usage:
 *   var picker = new CompanyContactPicker();
 *   picker.bindPair({
 *       companyInputId: 'jds-company',
 *       contactInputId: 'jds-contact-name',     // optional
 *       emailInputId:   'jds-contact-email',    // optional
 *       customerIdHiddenId: 'jds-customer-id',
 *       onSelect: function (selection) {
 *           // selection = { company, contact, customerId }
 *           // contact may be null if AE only picked a company
 *       },
 *       onClear: function () { … }
 *   });
 */
(function (global) {
    'use strict';

    var STYLE_INJECTED = false;
    var RECENT_STORAGE_KEY = 'nwca_recent_contacts';
    var RECENT_MAX_STORED = 20;
    var RECENT_MAX_SHOWN = 5;

    function injectStyles() {
        if (STYLE_INJECTED) return;
        STYLE_INJECTED = true;
        var css = ''
            + '.ccp-dropdown {'
            + '  position: absolute; top: 100%; left: 0; right: 0; z-index: 1000;'
            + '  background: #fff; border: 1px solid #d1d5db; border-radius: 6px;'
            + '  box-shadow: 0 4px 12px rgba(0,0,0,0.1);'
            + '  max-height: 380px; overflow-y: auto; margin-top: 2px;'
            + '  display: none;'
            + '}'
            + '.ccp-dropdown.ccp-open { display: block; }'
            + '.ccp-section-header {'
            + '  padding: 8px 12px 4px; font-size: 11px; font-weight: 700;'
            + '  text-transform: uppercase; letter-spacing: 0.05em;'
            + '  color: #6b7280; background: #f9fafb; border-bottom: 1px solid #e5e7eb;'
            + '  position: sticky; top: 0;'
            + '}'
            + '.ccp-item {'
            + '  padding: 8px 12px; cursor: pointer;'
            + '  border-bottom: 1px solid #f3f4f6; display: flex; align-items: center;'
            + '  gap: 10px;'
            + '}'
            + '.ccp-item:hover, .ccp-item.ccp-highlight { background: #f3f4f6; }'
            + '.ccp-item-icon { font-size: 16px; flex-shrink: 0; opacity: 0.6; }'
            + '.ccp-item-body { flex: 1; min-width: 0; }'
            + '.ccp-item-primary {'
            + '  font-weight: 600; color: #111827; font-size: 14px;'
            + '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
            + '}'
            + '.ccp-item-secondary {'
            + '  font-size: 12px; color: #6b7280;'
            + '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
            + '}'
            + '.ccp-item-meta {'
            + '  font-size: 11px; color: #9ca3af; flex-shrink: 0;'
            + '}'
            + '.ccp-item-id {'
            + '  font-size: 12px; font-weight: 400; color: #9ca3af; margin-left: 4px;'
            + '}'
            + '.ccp-empty, .ccp-loading {'
            + '  padding: 16px 12px; text-align: center; color: #6b7280; font-size: 13px;'
            + '}'
            + '.ccp-back {'
            + '  padding: 6px 12px; cursor: pointer; font-size: 12px;'
            + '  color: #2563eb; background: #eff6ff; border-bottom: 1px solid #dbeafe;'
            + '}'
            + '.ccp-back:hover { background: #dbeafe; }'
            + '';
        var styleEl = document.createElement('style');
        styleEl.id = 'ccp-styles';
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }

    function escapeHtml(str) {
        if (str == null) return '';
        var div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function readRecent() {
        try {
            var raw = localStorage.getItem(RECENT_STORAGE_KEY);
            if (!raw) return [];
            var arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function writeRecent(contact) {
        // Store the minimal shape we need to render later. Order = most-recent first.
        try {
            var entry = {
                id_Customer: contact.id_Customer,
                CustomerCompanyName: contact.CustomerCompanyName || contact.company || '',
                ct_NameFull: contact.ct_NameFull || contact.name || '',
                ContactNumbersEmail: contact.ContactNumbersEmail || contact.email || '',
                ID_Contact: contact.ID_Contact
            };
            if (!entry.CustomerCompanyName && !entry.ct_NameFull) return;
            var existing = readRecent().filter(function (r) {
                // Dedupe on contact identity (ID_Contact if present, else company+name)
                if (r.ID_Contact && entry.ID_Contact) return r.ID_Contact !== entry.ID_Contact;
                return (r.CustomerCompanyName + '|' + r.ct_NameFull) !== (entry.CustomerCompanyName + '|' + entry.ct_NameFull);
            });
            existing.unshift(entry);
            existing = existing.slice(0, RECENT_MAX_STORED);
            localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(existing));
        } catch (e) {
            // localStorage quota / parse errors — recently-used is best-effort
        }
    }

    function CompanyContactPicker(options) {
        options = options || {};
        this.baseURL = options.baseURL
            || (global.APP_CONFIG && global.APP_CONFIG.API && global.APP_CONFIG.API.BASE_URL)
            || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.minSearchLength = options.minSearchLength || 3;
        this.debounceMs = options.debounceMs || 250;
        this.maxResults = options.maxResults || 25; // contacts per /search call
        this.maxCompaniesShown = options.maxCompaniesShown || 5;
        this.maxContactsShown = options.maxContactsShown || 8;

        this._searchCache = new Map();
        this._byCompanyCache = new Map();
        this._cacheTTL = 5 * 60 * 1000;
        this._debounceTimer = null;
    }

    CompanyContactPicker.prototype._search = function (query) {
        var self = this;
        var key = query.toLowerCase().trim();
        var cached = this._searchCache.get(key);
        if (cached && Date.now() - cached.timestamp < this._cacheTTL) {
            return Promise.resolve(cached.data);
        }
        var url = this.baseURL + '/api/company-contacts/search?q=' + encodeURIComponent(query) + '&limit=' + this.maxResults;
        return fetch(url)
            .then(function (r) {
                if (!r.ok) throw new Error('search ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var contacts = (data && data.contacts) || [];
                self._searchCache.set(key, { data: contacts, timestamp: Date.now() });
                if (self._searchCache.size > 50) {
                    self._searchCache.delete(self._searchCache.keys().next().value);
                }
                return contacts;
            })
            .catch(function (err) {
                console.warn('[CompanyContactPicker] search failed:', err);
                return [];
            });
    };

    CompanyContactPicker.prototype._byCompany = function (companyName) {
        var self = this;
        var key = companyName.toLowerCase().trim();
        var cached = this._byCompanyCache.get(key);
        if (cached && Date.now() - cached.timestamp < this._cacheTTL) {
            return Promise.resolve(cached.data);
        }
        // limit=25 matches the backend's max — covers companies like NWCA
        // with 10+ contacts. Cap was raised from 10 → 25 on 2026-05-08.
        var url = this.baseURL + '/api/company-contacts/by-company?company=' + encodeURIComponent(companyName) + '&limit=25';
        return fetch(url)
            .then(function (r) {
                if (!r.ok) throw new Error('by-company ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var contacts = (data && data.contacts) || [];
                self._byCompanyCache.set(key, { data: contacts, timestamp: Date.now() });
                if (self._byCompanyCache.size > 30) {
                    self._byCompanyCache.delete(self._byCompanyCache.keys().next().value);
                }
                return contacts;
            })
            .catch(function (err) {
                console.warn('[CompanyContactPicker] by-company failed:', err);
                return [];
            });
    };

    /**
     * Group a flat /search response into { recentMatches, companies, contacts }.
     * - companies: deduped on id_Customer || CustomerCompanyName, with contact count.
     *              Capped at maxCompaniesShown.
     * - contacts: pass-through, top maxContactsShown.
     * - recentMatches: localStorage entries that match the query string.
     */
    CompanyContactPicker.prototype._groupResults = function (contacts, query) {
        var q = (query || '').toLowerCase().trim();

        // Companies — dedupe by id_Customer (fall back to name if id missing).
        var seen = {};
        var companies = [];
        contacts.forEach(function (c) {
            var key = c.id_Customer ? ('id:' + c.id_Customer) : ('name:' + (c.CustomerCompanyName || '').toLowerCase());
            if (seen[key]) {
                seen[key].count += 1;
                return;
            }
            seen[key] = {
                id_Customer: c.id_Customer || 0,
                CustomerCompanyName: c.CustomerCompanyName || '',
                count: 1
            };
            companies.push(seen[key]);
        });
        companies = companies.slice(0, this.maxCompaniesShown);

        // Flag rows whose CustomerCompanyName collides with another row in
        // the same result set so the renderer can disambiguate them with
        // #id_Customer. Caspio sometimes has multiple distinct customer
        // records with the same display name (legacy + new, etc.) — without
        // this the AE can't tell them apart in the dropdown.
        var nameCounts = {};
        companies.forEach(function (co) {
            var k = (co.CustomerCompanyName || '').toLowerCase();
            nameCounts[k] = (nameCounts[k] || 0) + 1;
        });
        companies.forEach(function (co) {
            co._isDup = nameCounts[(co.CustomerCompanyName || '').toLowerCase()] > 1;
        });

        var topContacts = contacts.slice(0, this.maxContactsShown);

        var recent = readRecent();
        var recentMatches = recent.filter(function (r) {
            if (!q) return false;
            return ((r.CustomerCompanyName || '').toLowerCase().indexOf(q) !== -1)
                || ((r.ct_NameFull || '').toLowerCase().indexOf(q) !== -1)
                || ((r.ContactNumbersEmail || '').toLowerCase().indexOf(q) !== -1);
        }).slice(0, RECENT_MAX_SHOWN);

        return { recentMatches: recentMatches, companies: companies, contacts: topContacts };
    };

    CompanyContactPicker.prototype._renderGrouped = function (dropdown, grouped, query) {
        var html = '';
        if (grouped.recentMatches.length) {
            html += '<div class="ccp-section-header">Recently used</div>';
            grouped.recentMatches.forEach(function (c, i) {
                html += '<div class="ccp-item" data-kind="recent" data-index="' + i + '">'
                    + '  <div class="ccp-item-body">'
                    + '    <div class="ccp-item-primary">' + escapeHtml(c.ct_NameFull || c.CustomerCompanyName) + '</div>'
                    + '    <div class="ccp-item-secondary">'
                    +        (c.ct_NameFull ? '@ ' + escapeHtml(c.CustomerCompanyName || '') + ' ' : '')
                    +        (c.ContactNumbersEmail ? '· ' + escapeHtml(c.ContactNumbersEmail) : '')
                    + '    </div>'
                    + '  </div>'
                    + '</div>';
            });
        }

        if (grouped.companies.length) {
            html += '<div class="ccp-section-header">Companies</div>';
            grouped.companies.forEach(function (c, i) {
                var meta = c.count > 1 ? c.count + ' contacts ›' : 'view contacts ›';
                // Append #id_Customer when this name clashes with another
                // company in the same result set — lets the AE pick the
                // right one between e.g. two "Northwest Custom Apparel"
                // records that have different ShopWorks IDs.
                var idTag = (c._isDup && c.id_Customer)
                    ? ' <span class="ccp-item-id">#' + escapeHtml(String(c.id_Customer)) + '</span>'
                    : '';
                html += '<div class="ccp-item" data-kind="company" data-index="' + i + '">'
                    + '  <div class="ccp-item-body">'
                    + '    <div class="ccp-item-primary">' + escapeHtml(c.CustomerCompanyName) + idTag + '</div>'
                    + '  </div>'
                    + '  <div class="ccp-item-meta">' + escapeHtml(meta) + '</div>'
                    + '</div>';
            });
        }

        if (grouped.contacts.length) {
            html += '<div class="ccp-section-header">Contacts</div>';
            grouped.contacts.forEach(function (c, i) {
                html += '<div class="ccp-item" data-kind="contact" data-index="' + i + '">'
                    + '  <div class="ccp-item-body">'
                    + '    <div class="ccp-item-primary">' + escapeHtml(c.ct_NameFull || '(no name)') + '</div>'
                    + '    <div class="ccp-item-secondary">'
                    + '      @ ' + escapeHtml(c.CustomerCompanyName || '')
                    +        (c.ContactNumbersEmail ? ' · ' + escapeHtml(c.ContactNumbersEmail) : '')
                    + '    </div>'
                    + '  </div>'
                    + '</div>';
            });
        }

        if (!html) {
            html = '<div class="ccp-empty">No matches for "' + escapeHtml(query) + '"</div>';
        }

        dropdown.innerHTML = html;
    };

    CompanyContactPicker.prototype._renderCompanyContacts = function (dropdown, companyName, contacts) {
        var html = '<div class="ccp-back" data-action="back">← Back to results</div>'
            + '<div class="ccp-section-header">' + escapeHtml(companyName) + ' contacts</div>';
        if (!contacts.length) {
            html += '<div class="ccp-empty">No contacts on file for this company</div>';
        } else {
            contacts.forEach(function (c, i) {
                // /by-company returns { name, email, company, id_Customer }
                html += '<div class="ccp-item" data-kind="bycompany-contact" data-index="' + i + '">'
                    + '  <div class="ccp-item-body">'
                    + '    <div class="ccp-item-primary">' + escapeHtml(c.name || '(no name)') + '</div>'
                    + '    <div class="ccp-item-secondary">' + escapeHtml(c.email || '') + '</div>'
                    + '  </div>'
                    + '</div>';
            });
        }
        dropdown.innerHTML = html;
    };

    CompanyContactPicker.prototype.bindPair = function (opts) {
        injectStyles();
        var self = this;

        var companyInput = document.getElementById(opts.companyInputId);
        if (!companyInput) {
            console.error('[CompanyContactPicker] Company input not found:', opts.companyInputId);
            return null;
        }
        var contactInput = opts.contactInputId ? document.getElementById(opts.contactInputId) : null;
        var emailInput = opts.emailInputId ? document.getElementById(opts.emailInputId) : null;
        var customerIdHidden = opts.customerIdHiddenId ? document.getElementById(opts.customerIdHiddenId) : null;

        // Build dropdown element under the company input.
        var dropdown = document.createElement('div');
        dropdown.className = 'ccp-dropdown';
        dropdown.id = opts.companyInputId + '-ccp-dropdown';
        // Position relative to the input's parent — same trick as the legacy
        // CustomerLookupService dropdown.
        if (companyInput.parentNode) {
            companyInput.parentNode.style.position = 'relative';
            companyInput.parentNode.appendChild(dropdown);
        }

        // Last-rendered grouped/contacts data so click handlers can resolve the row.
        var lastGrouped = null;
        var lastByCompany = null;

        function show() { dropdown.classList.add('ccp-open'); }
        function hide() { dropdown.classList.remove('ccp-open'); }

        function applySelection(selection) {
            // selection = { company: {CustomerCompanyName, id_Customer}, contact: {…} | null }
            var company = selection.company || {};
            var contact = selection.contact || null;

            companyInput.value = company.CustomerCompanyName || '';
            if (customerIdHidden) {
                customerIdHidden.value = company.id_Customer ? String(company.id_Customer) : '';
            }
            if (contactInput) {
                contactInput.value = contact
                    ? (contact.ct_NameFull || contact.name || '')
                    : '';
            }
            if (emailInput) {
                emailInput.value = contact
                    ? (contact.ContactNumbersEmail || contact.email || '')
                    : '';
            }
            if (contact) {
                writeRecent({
                    id_Customer: company.id_Customer,
                    CustomerCompanyName: company.CustomerCompanyName,
                    ct_NameFull: contact.ct_NameFull || contact.name,
                    ContactNumbersEmail: contact.ContactNumbersEmail || contact.email,
                    ID_Contact: contact.ID_Contact
                });
            }
            hide();
            if (typeof opts.onSelect === 'function') {
                opts.onSelect({
                    company: company,
                    contact: contact,
                    customerId: company.id_Customer || 0
                });
            }
        }

        function loadInitial() {
            var q = companyInput.value.trim();
            if (q.length < self.minSearchLength) {
                hide();
                return;
            }
            dropdown.innerHTML = '<div class="ccp-loading">Searching…</div>';
            show();
            self._search(q).then(function (contacts) {
                lastGrouped = self._groupResults(contacts, q);
                self._renderGrouped(dropdown, lastGrouped, q);
                show();
            });
        }

        function loadCompanyContacts(companyEntry) {
            dropdown.innerHTML = '<div class="ccp-loading">Loading contacts…</div>';
            self._byCompany(companyEntry.CustomerCompanyName).then(function (contacts) {
                lastByCompany = { company: companyEntry, contacts: contacts };
                self._renderCompanyContacts(dropdown, companyEntry.CustomerCompanyName, contacts);
            });
        }

        // Input event — debounced search
        companyInput.addEventListener('input', function () {
            clearTimeout(self._debounceTimer);
            // If the AE types after a selection, clear the contact/email fields
            // so stale data doesn't carry over into a new company.
            if (contactInput) contactInput.value = '';
            if (emailInput) emailInput.value = '';
            if (customerIdHidden) customerIdHidden.value = '';
            self._debounceTimer = setTimeout(loadInitial, self.debounceMs);
        });

        // Focus event — show dropdown if there's already a query
        companyInput.addEventListener('focus', function () {
            if (companyInput.value.trim().length >= self.minSearchLength) {
                loadInitial();
            }
        });

        // Click handler on the dropdown
        dropdown.addEventListener('mousedown', function (e) {
            // Stop propagation so the document-level "click-outside-to-close"
            // listener (added below) doesn't fire. Important: when we render
            // Stage 2 by mutating dropdown.innerHTML, the original click target
            // becomes detached, so dropdown.contains(e.target) returns false
            // in the document handler — which would close the dropdown right
            // before Stage 2 finishes loading.
            e.stopPropagation();
            // mousedown rather than click — input.blur fires before click otherwise
            // and can hide the dropdown before the click registers.
            var backEl = e.target.closest('[data-action="back"]');
            if (backEl) {
                e.preventDefault();
                if (lastGrouped) {
                    self._renderGrouped(dropdown, lastGrouped, companyInput.value.trim());
                }
                return;
            }
            var item = e.target.closest('.ccp-item');
            if (!item) return;
            e.preventDefault();
            var kind = item.getAttribute('data-kind');
            var idx = parseInt(item.getAttribute('data-index'), 10);

            if (kind === 'recent' && lastGrouped) {
                var r = lastGrouped.recentMatches[idx];
                if (!r) return;
                applySelection({
                    company: { CustomerCompanyName: r.CustomerCompanyName, id_Customer: r.id_Customer },
                    contact: r.ct_NameFull ? r : null
                });
            } else if (kind === 'contact' && lastGrouped) {
                var c = lastGrouped.contacts[idx];
                if (!c) return;
                applySelection({
                    company: { CustomerCompanyName: c.CustomerCompanyName, id_Customer: c.id_Customer },
                    contact: c
                });
            } else if (kind === 'company' && lastGrouped) {
                var co = lastGrouped.companies[idx];
                if (!co) return;
                // If the form has no contact input (e.g. Ruth's mockup-submit),
                // picking a company is the final selection. Otherwise drill into
                // Stage 2 to pick a specific contact.
                if (!contactInput) {
                    applySelection({ company: co, contact: null });
                    return;
                }
                loadCompanyContacts(co);
            } else if (kind === 'bycompany-contact' && lastByCompany) {
                var bc = lastByCompany.contacts[idx];
                if (!bc) return;
                applySelection({
                    company: { CustomerCompanyName: lastByCompany.company.CustomerCompanyName, id_Customer: lastByCompany.company.id_Customer },
                    contact: bc
                });
            }
        });

        // Hide dropdown when clicking elsewhere
        document.addEventListener('mousedown', function (e) {
            if (!dropdown.contains(e.target) && e.target !== companyInput) {
                hide();
            }
        });

        // Keyboard nav
        companyInput.addEventListener('keydown', function (e) {
            var items = dropdown.querySelectorAll('.ccp-item');
            if (!items.length || !dropdown.classList.contains('ccp-open')) return;
            var current = -1;
            for (var i = 0; i < items.length; i++) {
                if (items[i].classList.contains('ccp-highlight')) { current = i; break; }
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                var next = current < items.length - 1 ? current + 1 : 0;
                items.forEach(function (it) { it.classList.remove('ccp-highlight'); });
                items[next].classList.add('ccp-highlight');
                items[next].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                var prev = current > 0 ? current - 1 : items.length - 1;
                items.forEach(function (it) { it.classList.remove('ccp-highlight'); });
                items[prev].classList.add('ccp-highlight');
                items[prev].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter' && current >= 0) {
                e.preventDefault();
                items[current].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            } else if (e.key === 'Escape') {
                hide();
                if (typeof opts.onClear === 'function') opts.onClear();
            }
        });

        return {
            clear: function () {
                companyInput.value = '';
                if (contactInput) contactInput.value = '';
                if (emailInput) emailInput.value = '';
                if (customerIdHidden) customerIdHidden.value = '';
                hide();
                if (typeof opts.onClear === 'function') opts.onClear();
            }
        };
    };

    global.CompanyContactPicker = CompanyContactPicker;
})(typeof window !== 'undefined' ? window : this);
