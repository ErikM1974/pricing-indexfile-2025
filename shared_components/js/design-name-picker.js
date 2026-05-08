/**
 * DesignNamePicker — Customer-scoped design autocomplete for AE intake
 * forms. Queries the existing /api/digitized-designs/search-all endpoint
 * (which reads Caspio's Design_Lookup_2026 table — sync'd from ShopWorks
 * once a day) and surfaces matching designs as the AE types.
 *
 * Strict customer scope: only designs for the currently-selected company
 * appear in the dropdown (the AE picks the company first via
 * CompanyContactPicker, then types in the Design Name field). Designs
 * for other companies never show, even if they match the query — picking
 * a foreign design by accident would corrupt the request.
 *
 * Sort: newest first (Design_Number DESC). Design numbers increment
 * over time, so the highest number is the most recently created design.
 *
 * Edge case: if no company is picked yet, the dropdown shows a hint
 * ("Pick a company first to see their designs") instead of running
 * the search. Free-typing remains valid throughout.
 *
 * Usage:
 *   DesignNamePicker.bind({
 *       inputId: 'jds-design-name',
 *       getCustomerId: function () { return parseInt(document.getElementById('jds-customer-id').value, 10) || 0; },
 *       onSelect: function (design) {
 *           // design = { designNumber, designName, company, customerId }
 *           // Component already filled the input. Cache the design so
 *           // the form's submit handler can include Design_Num_SW in
 *           // the payload.
 *       },
 *       onClear: function () { … }   // optional
 *   });
 *
 * Reuses .ccp-* CSS injected by company-contact-picker.js (loaded in
 * the same page) so styling stays consistent.
 */
(function (global) {
    'use strict';

    var DEFAULT_BASE_URL = (global.APP_CONFIG && global.APP_CONFIG.API && global.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    var MIN_SEARCH_LEN = 2;
    var DEBOUNCE_MS = 250;
    var MAX_RESULTS = 25;
    var CACHE_TTL = 5 * 60 * 1000;
    var searchCache = new Map();
    var debounceTimer = null;

    function escapeHtml(str) {
        if (str == null) return '';
        var div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function fetchDesigns(query, customerId) {
        var key = (query.toLowerCase().trim()) + '|' + customerId;
        var cached = searchCache.get(key);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return Promise.resolve(cached.data);
        }
        var url = DEFAULT_BASE_URL
            + '/api/digitized-designs/search-all?q=' + encodeURIComponent(query)
            + '&limit=' + MAX_RESULTS
            + '&customerId=' + encodeURIComponent(String(customerId));
        return fetch(url)
            .then(function (r) {
                if (!r.ok) throw new Error('search-all ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var results = (data && data.results) || [];
                searchCache.set(key, { data: results, timestamp: Date.now() });
                if (searchCache.size > 50) {
                    searchCache.delete(searchCache.keys().next().value);
                }
                return results;
            })
            .catch(function (err) {
                console.warn('[DesignNamePicker] search failed:', err);
                return [];
            });
    }

    /**
     * Filter to this customer only + sort newest first.
     * Backend returns customerMatch=true on rows where Customer_ID matches
     * the passed customerId. We hard-filter — never show foreign designs.
     */
    function applyScopeAndSort(results, customerId) {
        if (!customerId) return [];
        var mine = results.filter(function (r) { return r.customerMatch === true; });
        mine.sort(function (a, b) {
            // Newest first: highest Design_Number on top. Coerce to int to
            // ignore any leading zeros / non-numeric quirks.
            var an = parseInt(a.designNumber, 10) || 0;
            var bn = parseInt(b.designNumber, 10) || 0;
            return bn - an;
        });
        return mine;
    }

    function bind(opts) {
        var input = document.getElementById(opts.inputId);
        if (!input) {
            console.error('[DesignNamePicker] input not found:', opts.inputId);
            return null;
        }
        var getCustomerId = opts.getCustomerId || function () { return 0; };

        // Reuse the .ccp-dropdown styling injected by CompanyContactPicker.
        // Skipped if companion picker isn't loaded (defensive — the dropdown
        // still works, it'll just be unstyled).
        var dropdown = document.createElement('div');
        dropdown.className = 'ccp-dropdown';
        dropdown.id = opts.inputId + '-dnp-dropdown';
        if (input.parentNode) {
            input.parentNode.style.position = 'relative';
            input.parentNode.appendChild(dropdown);
        }

        var lastResults = [];

        function show() { dropdown.classList.add('ccp-open'); }
        function hide() { dropdown.classList.remove('ccp-open'); }

        function renderEmpty(msg) {
            dropdown.innerHTML = '<div class="ccp-empty">' + escapeHtml(msg) + '</div>';
            show();
        }

        function renderResults(results, query) {
            if (!results.length) {
                renderEmpty('No matching designs for this customer');
                return;
            }
            var html = '<div class="ccp-section-header">Designs (newest first)</div>';
            results.forEach(function (d, i) {
                html += '<div class="ccp-item" data-kind="design" data-index="' + i + '">'
                    + '  <div class="ccp-item-body">'
                    + '    <div class="ccp-item-primary">' + escapeHtml(d.designName || '(no name)') + '</div>'
                    + '    <div class="ccp-item-secondary">#' + escapeHtml(String(d.designNumber || '')) + ' · ' + escapeHtml(d.company || '') + '</div>'
                    + '  </div>'
                    + '</div>';
            });
            dropdown.innerHTML = html;
            show();
        }

        function loadAndRender() {
            var q = input.value.trim();
            if (q.length < MIN_SEARCH_LEN) {
                hide();
                return;
            }
            var customerId = getCustomerId();
            if (!customerId) {
                renderEmpty('Pick a company first to see their designs');
                return;
            }
            dropdown.innerHTML = '<div class="ccp-loading">Searching designs…</div>';
            show();
            fetchDesigns(q, customerId).then(function (raw) {
                lastResults = applyScopeAndSort(raw, customerId);
                renderResults(lastResults, q);
            });
        }

        // Input event — debounced search
        input.addEventListener('input', function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadAndRender, DEBOUNCE_MS);
        });

        // Focus — re-show dropdown if there's already a query
        input.addEventListener('focus', function () {
            if (input.value.trim().length >= MIN_SEARCH_LEN) {
                loadAndRender();
            }
        });

        // Click handler on the dropdown — same propagation-stop pattern
        // CompanyContactPicker uses; without it the document-level
        // click-outside-to-close listener can fire on the same mousedown
        // and hide the dropdown before the click registers.
        dropdown.addEventListener('mousedown', function (e) {
            e.stopPropagation();
            var item = e.target.closest('.ccp-item');
            if (!item) return;
            e.preventDefault();
            var idx = parseInt(item.getAttribute('data-index'), 10);
            var d = lastResults[idx];
            if (!d) return;
            input.value = d.designName || '';
            hide();
            if (typeof opts.onSelect === 'function') opts.onSelect(d);
        });

        // Hide dropdown when clicking elsewhere
        document.addEventListener('mousedown', function (e) {
            if (!dropdown.contains(e.target) && e.target !== input) {
                hide();
            }
        });

        // Keyboard nav
        input.addEventListener('keydown', function (e) {
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
                input.value = '';
                hide();
                if (typeof opts.onClear === 'function') opts.onClear();
            }
        };
    }

    global.DesignNamePicker = { bind: bind };
})(typeof window !== 'undefined' ? window : this);
