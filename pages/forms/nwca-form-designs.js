/**
 * nwca-form-designs.js — digitized-design lookup for the fillable form twins.
 *
 * Type-ahead on the Logo/Artwork field via the proxy's digitized-designs
 * search (GET /api/digitized-designs/search-all?q=&customerId=) — searches
 * design NAME or NUMBER, optionally scoped to the picked customer. Picking a
 * design fills the field and remembers the design number on the input
 * (dataset.designNumber), which the ShopWorks push uses to LINK the actual
 * design instead of the "No design linked" note.
 */
(function (global) {
    'use strict';

    var DEBOUNCE_MS = 300;
    var MIN_CHARS = 2;

    function apiBase() {
        if (global.APP_CONFIG && global.APP_CONFIG.API && global.APP_CONFIG.API.BASE_URL) {
            return global.APP_CONFIG.API.BASE_URL.replace(/\/+$/, '');
        }
        return null;
    }

    function attach(opts) {
        var input = opts && opts.input;
        if (!input) return;

        var box = document.createElement('div');
        box.className = 'contacts-dropdown';
        box.hidden = true;
        var parent = input.parentNode;
        parent.classList.add('contacts-anchor');
        parent.appendChild(box);

        var timer = null;
        var lastQuery = '';
        var suppressNext = false;

        input.setAttribute('autocomplete', 'off');

        input.addEventListener('input', function () {
            if (suppressNext) { suppressNext = false; return; }
            delete input.dataset.designNumber; // typed edits invalidate the link
            var q = input.value.trim();
            if (timer) clearTimeout(timer);
            if (q.length < MIN_CHARS) { box.hidden = true; return; }
            timer = setTimeout(function () { search(q); }, DEBOUNCE_MS);
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') box.hidden = true;
        });

        document.addEventListener('click', function (e) {
            if (e.target !== input && !box.contains(e.target)) box.hidden = true;
        });

        function search(q) {
            var base = apiBase();
            if (!base) return;
            lastQuery = q;
            var customerId = typeof opts.customerId === 'function' ? opts.customerId() : '';
            var url = base + '/api/digitized-designs/search-all?q=' + encodeURIComponent(q) + '&limit=8' +
                (customerId ? '&customerId=' + encodeURIComponent(customerId) : '');
            fetch(url)
                .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                .then(function (data) {
                    if (q !== lastQuery) return;
                    render(data.results || data.designs || []);
                })
                .catch(function (err) {
                    console.error('[form-designs] search failed:', err);
                    box.hidden = true; // lookup is an assist — silence is fine, typing continues
                });
        }

        function render(results) {
            box.innerHTML = '';
            if (!results.length) {
                var empty = document.createElement('div');
                empty.className = 'contacts-row contacts-row--empty';
                empty.textContent = 'No digitized design match — keep typing (new art?).';
                box.appendChild(empty);
                box.hidden = false;
                return;
            }
            results.slice(0, 8).forEach(function (d) {
                var el = document.createElement('div');
                el.className = 'contacts-row';
                el.innerHTML = '<strong>#' + escapeHtml(String(d.designNumber)) + '</strong> ' + escapeHtml(d.designName || '') +
                    ' <span class="contacts-muted">' + escapeHtml(d.company || '') +
                    (d.maxStitchCount ? ' · ' + Number(d.maxStitchCount).toLocaleString() + ' st' : '') + '</span>';
                el.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    suppressNext = true;
                    input.value = (d.designName || ('Design #' + d.designNumber));
                    input.dataset.designNumber = String(d.designNumber);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    // suppressNext consumed by that dispatch; keep the link
                    input.dataset.designNumber = String(d.designNumber);
                    box.hidden = true;
                    if (typeof opts.onPick === 'function') opts.onPick(d);
                });
                box.appendChild(el);
            });
            box.hidden = false;
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

    global.NWCAFormDesigns = { attach: attach };
})(window);
