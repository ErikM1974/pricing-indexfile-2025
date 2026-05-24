/**
 * Customer Design Combobox — shared widget for EMB/DTF/SCP quote builders.
 *
 * Wraps an existing `<input type="text">` for a Design # field and turns it
 * into an autocomplete that searches the picked customer's designs.
 *
 *   - Type-as-you-go filter (matches idDesign or designName, case-insensitive)
 *   - Customer-aware: fetches /api/designs/by-customer/:customerId?method=X
 *   - Per-customer cache (5 min) — switching back-and-forth is instant
 *   - Shows thumbnail per row when available
 *   - Pick a row → input.value set + onPick callback fired
 *
 * DTG has its own inline implementation (dtg-inline-form.js:2383+) tightly
 * fused to DTG's state model. This shared widget is for builders that
 * don't have one yet (DTF, SCP) — and optionally as a lighter alternative
 * for EMB's existing modal+gallery pattern.
 *
 * Backend route: caspio-pricing-proxy/src/routes/designs-by-method.js
 *
 * Usage:
 *   const cb = CustomerDesignCombobox.attach(inputEl, {
 *     method:        'dtf',          // 'dtf' | 'scp' | 'emb' | 'dtg' | etc.
 *     getCustomerId: () => +document.getElementById('customer-number')?.value,
 *     onPick:        (design) => { ... use design.idDesign + design.designName + ... },
 *     placeholder:   'Type design # or name',  // optional
 *   });
 *
 *   // Refresh when customer changes
 *   cb.refresh();
 *
 *   // Clear cache (e.g. on form reset)
 *   cb.clearCache();
 *
 * Created 2026-05-24 — Phase 11.1.
 */

(function (global) {
    'use strict';

    const API_BASE_DEFAULT = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    function getApiBase() {
        if (typeof window !== 'undefined' && window.APP_CONFIG?.API?.BASE_URL) {
            return window.APP_CONFIG.API.BASE_URL;
        }
        return API_BASE_DEFAULT;
    }

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    }

    function formatDate(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return '';
        }
    }

    function attach(inputEl, opts) {
        if (!inputEl) {
            console.warn('[CustomerDesignCombobox] No input element provided');
            return null;
        }
        opts = opts || {};
        const method = opts.method;
        if (!method) {
            console.warn('[CustomerDesignCombobox] opts.method is required (dtf|scp|emb|dtg)');
            return null;
        }
        const getCustomerId = typeof opts.getCustomerId === 'function' ? opts.getCustomerId : (() => null);
        const onPick = typeof opts.onPick === 'function' ? opts.onPick : (() => {});

        if (opts.placeholder) inputEl.placeholder = opts.placeholder;
        inputEl.autocomplete = 'off';

        // Wrap the input in a positioning container so the dropdown floats correctly
        const wrap = document.createElement('span');
        wrap.className = 'cdcb-wrap';
        wrap.style.position = 'relative';
        wrap.style.display = 'inline-block';
        wrap.style.width = inputEl.style.width || '100%';
        const parent = inputEl.parentNode;
        if (parent) {
            parent.insertBefore(wrap, inputEl);
            wrap.appendChild(inputEl);
        }

        let menu = null;
        let designs = [];
        let lastCustomerId = null;
        let lastFetchTs = 0;
        const CACHE_TTL = 5 * 60 * 1000;
        let activeIndex = -1;
        let blurTimer = null;

        function close() {
            if (menu) {
                menu.remove();
                menu = null;
                activeIndex = -1;
            }
        }

        function ensureMenu() {
            if (menu) return menu;
            menu = document.createElement('div');
            menu.className = 'cdcb-menu';
            // Inline styles to avoid CSS dependency
            menu.style.cssText = [
                'position:absolute', 'top:100%', 'left:0', 'right:0',
                'background:#fff', 'border:1px solid var(--pnw-rule, rgba(31, 73, 34, 0.10))',
                'border-radius:var(--qb-radius-md, 8px)',
                'box-shadow:var(--pnw-shadow-md, 0 4px 12px rgba(0,0,0,0.1))',
                'max-height:340px', 'overflow-y:auto', 'z-index:1000',
                'margin-top:4px', 'font-size:13px',
            ].join(';');
            wrap.appendChild(menu);
            return menu;
        }

        function paint(filterText) {
            const m = ensureMenu();
            const customerId = getCustomerId();

            if (!customerId) {
                m.innerHTML =
                    '<div class="cdcb-empty" style="padding:12px;color:#6b7280;font-style:italic;">' +
                    'Pick a customer first to see their designs</div>';
                return;
            }

            const q = String(filterText || '').toLowerCase().trim();
            const filtered = !q ? designs : designs.filter((d) =>
                String(d.idDesign).toLowerCase().includes(q) ||
                String(d.designName || '').toLowerCase().includes(q)
            );

            if (filtered.length === 0) {
                m.innerHTML =
                    '<div class="cdcb-empty" style="padding:12px;color:#6b7280;">' +
                    'No ' + method.toUpperCase() + ' designs found for this customer' +
                    (q ? ' matching "' + escapeHtml(q) + '"' : '') +
                    '</div>';
                return;
            }

            const rows = filtered.slice(0, 50).map((d, idx) => {
                const isActive = idx === activeIndex;
                const thumb = d.thumbnailUrl
                    ? '<img src="' + escapeHtml(d.thumbnailUrl) + '" alt="" class="cdcb-thumb" style="width:40px;height:40px;object-fit:cover;border-radius:4px;background:#f3f4f6;flex-shrink:0;">'
                    : '<div class="cdcb-thumb cdcb-thumb-empty" style="width:40px;height:40px;border-radius:4px;background:#f3f4f6;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:10px;">No img</div>';
                const status = [];
                if (d.locationCount > 1) status.push(d.locationCount + ' locations');
                if (d.isVariation) status.push('variation');
                if (!d.designComplete) status.push('in progress');
                const dateLabel = d.dateCreated ? formatDate(d.dateCreated) : '';
                if (dateLabel && status.length === 0) status.push(dateLabel);
                const subline = status.join(' · ');
                return (
                    '<div class="cdcb-row' + (isActive ? ' cdcb-row-active' : '') + '" data-idx="' + idx + '"' +
                    ' style="display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--pnw-rule, rgba(31, 73, 34, 0.10));' +
                    (isActive ? 'background:var(--pnw-mist, #e8eee7);' : '') +
                    '">' +
                        thumb +
                        '<div style="flex:1;min-width:0;">' +
                            '<div style="font-weight:600;color:var(--pnw-pine, #1a3517);">' +
                                '#' + escapeHtml(d.idDesign) +
                                (d.designName ? ' — ' + escapeHtml(d.designName) : '') +
                            '</div>' +
                            (subline ? '<div style="font-size:11px;color:#6b7280;margin-top:2px;">' + escapeHtml(subline) + '</div>' : '') +
                        '</div>' +
                    '</div>'
                );
            }).join('');

            const more = filtered.length > 50
                ? '<div style="padding:8px;text-align:center;font-size:11px;color:#9ca3af;">Showing first 50 of ' + filtered.length + ' — narrow your search</div>'
                : '';

            m.innerHTML = rows + more;

            // Wire row clicks
            m.querySelectorAll('.cdcb-row').forEach((rowEl) => {
                rowEl.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // prevent input blur before click registers
                    const idx = parseInt(rowEl.dataset.idx, 10);
                    if (!isNaN(idx) && filtered[idx]) {
                        pick(filtered[idx]);
                    }
                });
                rowEl.addEventListener('mouseenter', () => {
                    activeIndex = parseInt(rowEl.dataset.idx, 10);
                });
            });
        }

        function pick(design) {
            inputEl.value = design.idDesign;
            try { onPick(design); } catch (e) { console.error('[CustomerDesignCombobox] onPick threw:', e); }
            close();
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }

        async function loadDesigns(force) {
            const customerId = getCustomerId();
            if (!customerId) {
                designs = [];
                lastCustomerId = null;
                return;
            }
            const cidStr = String(customerId);
            const fresh = (cidStr === String(lastCustomerId)) && (Date.now() - lastFetchTs) < CACHE_TTL;
            if (fresh && !force && designs.length > 0) return;
            try {
                const url = getApiBase() +
                    '/api/designs/by-customer/' + encodeURIComponent(cidStr) +
                    '?method=' + encodeURIComponent(method) + '&limit=200';
                const r = await fetch(url);
                if (!r.ok) {
                    console.warn('[CustomerDesignCombobox] Fetch failed:', r.status);
                    designs = [];
                    return;
                }
                const data = await r.json();
                designs = Array.isArray(data.designs) ? data.designs : [];
                lastCustomerId = cidStr;
                lastFetchTs = Date.now();
            } catch (err) {
                console.warn('[CustomerDesignCombobox] Fetch error:', err.message);
                designs = [];
            }
        }

        // Input events
        inputEl.addEventListener('focus', async () => {
            paint(inputEl.value);
            await loadDesigns(false);
            paint(inputEl.value);
        });
        inputEl.addEventListener('input', () => {
            paint(inputEl.value);
        });
        inputEl.addEventListener('blur', () => {
            // Defer close so row click handlers can fire first
            blurTimer = setTimeout(close, 150);
        });
        inputEl.addEventListener('keydown', (e) => {
            if (!menu) return;
            const visibleRows = menu.querySelectorAll('.cdcb-row');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = Math.min(activeIndex + 1, visibleRows.length - 1);
                paint(inputEl.value);
                const active = menu.querySelector('.cdcb-row-active');
                if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = Math.max(activeIndex - 1, 0);
                paint(inputEl.value);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (activeIndex >= 0) {
                    const idx = activeIndex;
                    const q = String(inputEl.value || '').toLowerCase().trim();
                    const filtered = !q ? designs : designs.filter((d) =>
                        String(d.idDesign).toLowerCase().includes(q) ||
                        String(d.designName || '').toLowerCase().includes(q)
                    );
                    if (filtered[idx]) pick(filtered[idx]);
                }
            } else if (e.key === 'Escape') {
                close();
            }
        });

        // Click outside closes
        document.addEventListener('mousedown', (e) => {
            if (!menu) return;
            if (!wrap.contains(e.target)) close();
        });

        // Public API
        return {
            refresh: () => loadDesigns(true).then(() => { if (menu) paint(inputEl.value); }),
            clearCache: () => { designs = []; lastCustomerId = null; lastFetchTs = 0; },
            close,
        };
    }

    global.CustomerDesignCombobox = { attach };
})(typeof window !== 'undefined' ? window : globalThis);
