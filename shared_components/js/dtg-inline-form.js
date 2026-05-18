/**
 * dtg-inline-form.js — Vanilla-JS DTG order form for /quote-builders/dtg-quote-builder.html.
 *
 * Replaces the iframed legacy Bootstrap form. Mirrors the order-form UX patterns:
 *  - Customer combobox (calls /api/company-contacts-2026/search exactly like order-form)
 *  - Style search (calls /api/stylesearch)
 *  - Color picker (calls /api/product-colors, renders real swatches)
 *  - Multi-row table with size-grid columns
 *  - Live price preview via window.DTGPricingService (the SAME service /pricing/dtg uses)
 *  - Submit to ShopWorks via /api/submit-order-form (the SAME endpoint the order form uses)
 *
 * Exposes a small DOM-scoped API the chat controller can call:
 *
 *   window.DTGInlineForm = {
 *     fillFromQuote(priceQuote, customerFinal),  // chat → form
 *     getState(),
 *     resetForm(),
 *     submitToShopWorks(),                       // also called by the visible button
 *   };
 *
 * Pricing math is the single canonical formula:
 *   garmentCost / marginDenom + sum(printCosts) → Math.ceil(*2)/2 → + size upcharges
 *   LTM (combined qty < 24): floor((50/qty)*100)/100 per piece.
 * Backed by window.DTGPricingService for the live preview, and by
 * POST /api/dtg/quote-pricing on submit so the wire-side price matches.
 */

(function () {
    'use strict';

    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const SUBMIT_URL = '/api/submit-order-form'; // relative — same-origin (sanmar-inventory-app)

    const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];

    const LOCATION_LABELS = {
        LC: 'Left Chest',
        FF: 'Full Front',
        JF: 'Jumbo Front',
        FB: 'Full Back',
        JB: 'Jumbo Back',
    };
    const FRONT_LOCATIONS = [
        { code: 'LC', label: 'Left Chest', dim: '4″×4″' },
        { code: 'FF', label: 'Full Front', dim: '12″×16″' },
        { code: 'JF', label: 'Jumbo Front', dim: '16″×20″' },
    ];
    const BACK_LOCATIONS = [
        { code: 'FB', label: 'Full Back', dim: '12″×16″' },
        { code: 'JB', label: 'Jumbo Back', dim: '16″×20″' },
    ];

    // ----- Caches (same pattern as line-items.jsx in order form) -------------
    const _styleSearchCache = new Map(); // query → [{value,label}]
    const _colorsCache = new Map();      // style → {colors, productTitle}
    const _companySearchCache = new Map(); // query → [{Company_Name, contacts, ...}]
    const _bundleCache = new Map();      // style → bundle (for live preview math)

    // ----- State -------------------------------------------------------------
    const state = {
        front: 'LC',
        back: '',
        rows: [],
        customer: {
            company: '',
            companyId: '',  // ManageOrders id_Customer
            contactId: '',
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            designNumber: '',
            terms: 'Prepaid',
            contacts: [],   // populated when a company is picked
        },
        submitting: false,
    };

    function newBlankRow() {
        return {
            id: 'r-' + Math.random().toString(36).slice(2, 10),
            style: '',
            styleUpper: '',
            desc: '',
            color: '',         // COLOR_NAME
            catalogColor: '',  // CATALOG_COLOR (for ShopWorks)
            colorSwatch: '',   // small swatch image url
            colorsAvailable: [],
            sizes: {},         // { S: 4, M: 8, ... }
            availableSizes: [],
        };
    }

    function effectiveLocationCode() {
        if (!state.front) return '';
        if (state.back) return `${state.front}_${state.back}`;
        return state.front;
    }
    function effectiveLocationLabel() {
        const code = effectiveLocationCode();
        if (!code) return '—';
        if (code.includes('_')) {
            const parts = code.split('_').map((c) => LOCATION_LABELS[c] || c);
            return parts.join(' + ');
        }
        return LOCATION_LABELS[code] || code;
    }

    function combinedQty() {
        return state.rows.reduce((sum, r) => {
            return sum + Object.values(r.sizes || {}).reduce((s, v) => s + (Number(v) || 0), 0);
        }, 0);
    }

    // ----- Fetchers ----------------------------------------------------------
    async function fetchStyleSearch(q) {
        const key = q.toLowerCase();
        if (_styleSearchCache.has(key)) return _styleSearchCache.get(key);
        try {
            const r = await fetch(`${API_BASE}/api/stylesearch?term=${encodeURIComponent(q)}`);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const data = await r.json();
            const results = Array.isArray(data) ? data : (data.results || []);
            _styleSearchCache.set(key, results);
            return results;
        } catch (err) {
            console.error('[dtg-inline-form] style search failed:', err);
            return [];
        }
    }

    async function fetchProductColors(style) {
        const sn = String(style || '').trim().toUpperCase();
        if (!sn) return { colors: [], productTitle: '' };
        if (_colorsCache.has(sn)) return _colorsCache.get(sn);
        try {
            const r = await fetch(`${API_BASE}/api/product-colors?styleNumber=${encodeURIComponent(sn)}`);
            if (r.status === 404) {
                const empty = { colors: [], productTitle: '' };
                _colorsCache.set(sn, empty);
                return empty;
            }
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const data = await r.json();
            const result = {
                colors: (data && data.colors) || [],
                productTitle: (data && data.productTitle) || '',
            };
            _colorsCache.set(sn, result);
            return result;
        } catch (err) {
            console.error('[dtg-inline-form] product-colors failed:', err);
            return { colors: [], productTitle: '' };
        }
    }

    async function fetchCompanies(q) {
        const key = q.toLowerCase();
        if (_companySearchCache.has(key)) return _companySearchCache.get(key);
        try {
            const r = await fetch(`${API_BASE}/api/company-contacts-2026/search?q=${encodeURIComponent(q)}&limit=10`);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const data = await r.json();
            const results = Array.isArray(data && data.companies) ? data.companies : [];
            _companySearchCache.set(key, results);
            return results;
        } catch (err) {
            console.error('[dtg-inline-form] company search failed:', err);
            return [];
        }
    }

    async function fetchBundle(style) {
        const sn = String(style || '').trim().toUpperCase();
        if (!sn) return null;
        if (_bundleCache.has(sn)) return _bundleCache.get(sn);
        if (!window.DTGPricingService) {
            console.warn('[dtg-inline-form] window.DTGPricingService unavailable — preview disabled');
            return null;
        }
        try {
            const svc = new window.DTGPricingService();
            const b = await svc.fetchPricingData(sn);
            if (b) _bundleCache.set(sn, b);
            return b;
        } catch (err) {
            console.error('[dtg-inline-form] bundle fetch failed:', err);
            return null;
        }
    }

    // ----- Render ------------------------------------------------------------
    function render() {
        const host = document.getElementById('dtgInlineFormMount');
        if (!host) {
            console.warn('[dtg-inline-form] mount point #dtgInlineFormMount not found');
            return;
        }
        host.innerHTML = `
            <div class="dtg-form-wrap">
                <header class="dtg-form-header">
                    <div class="dfh-title"><i class="fas fa-clipboard-list"></i> DTG order form</div>
                    <div class="dfh-sub">Same canonical pricing as <a href="/pricing/dtg" class="dff-pricing-link">/pricing/dtg</a> and the order form. Chat fills it; rep reviews; one Submit.</div>
                </header>

                <section class="dtg-form-section">
                    <div class="dfs-label"><i class="fas fa-print"></i> Print location (shared across all rows)</div>
                    <div class="dtg-location-row">
                        <div class="dlr-group">
                            <div class="dlr-group-label">FRONT (pick one)</div>
                            <div class="dlr-options" id="dtgFrontOptions"></div>
                        </div>
                        <div class="dlr-group">
                            <div class="dlr-group-label">BACK (optional)</div>
                            <div class="dlr-options" id="dtgBackOptions"></div>
                        </div>
                        <div class="dtg-location-summary" id="dtgLocationSummary"></div>
                    </div>
                </section>

                <div class="dtg-form-body">
                    <div class="dtg-rows-pane">
                        <div class="dfs-label" style="margin-bottom:8px;"><i class="fas fa-list"></i> Line items</div>
                        <div style="overflow-x:auto;">
                            <table class="dtg-rows-table" id="dtgRowsTable">
                                <thead></thead>
                                <tbody></tbody>
                            </table>
                        </div>
                        <button type="button" class="dtg-add-row-btn" id="dtgAddRowBtn"><i class="fas fa-plus"></i> Add row</button>

                        <div id="dtgPriceSummary" class="dtg-price-summary"></div>
                    </div>

                    <aside class="dtg-customer-pane">
                        <div class="dcp-label"><i class="fas fa-building"></i> Customer + push</div>
                        <div class="dcp-search-label">Search customer</div>
                        <div class="dtg-combobox" id="dtgCompanyCombo">
                            <input type="text" id="dtgCompanyInput" autocomplete="off" placeholder="Company name or contact…">
                        </div>

                        <div class="dcp-divider">Or fill manually</div>

                        <div class="dcp-row">
                            <div>
                                <div class="dcp-field-label">First name</div>
                                <input type="text" id="dtgFirstName" autocomplete="off">
                            </div>
                            <div>
                                <div class="dcp-field-label">Last name</div>
                                <input type="text" id="dtgLastName" autocomplete="off">
                            </div>
                        </div>
                        <div class="dcp-field-label">Email</div>
                        <input type="email" id="dtgEmail" autocomplete="off">
                        <div class="dcp-row">
                            <div>
                                <div class="dcp-field-label">Phone</div>
                                <input type="tel" id="dtgPhone" autocomplete="off">
                            </div>
                            <div>
                                <div class="dcp-field-label">Company ID (optional)</div>
                                <input type="text" id="dtgCompanyId" autocomplete="off" placeholder="ShopWorks ID">
                            </div>
                        </div>
                        <div class="dcp-row">
                            <div>
                                <div class="dcp-field-label">Design #</div>
                                <input type="text" id="dtgDesignNumber" autocomplete="off" placeholder="e.g. 12345">
                            </div>
                            <div>
                                <div class="dcp-field-label">Payment terms</div>
                                <select id="dtgTerms">
                                    <option value="Prepaid">Prepaid</option>
                                    <option value="Net 10">Net 10</option>
                                    <option value="Net 30">Net 30</option>
                                    <option value="Pay On Pickup">Pay On Pickup</option>
                                </select>
                            </div>
                        </div>

                        <button type="button" class="dtg-submit-btn" id="dtgSubmitBtn" disabled>
                            <i class="fas fa-truck"></i> Submit to ShopWorks
                        </button>
                        <div id="dtgSubmitStatus" class="dtg-submit-status" hidden></div>
                    </aside>
                </div>

                <footer class="dtg-form-foot">
                    <span>Canonical pricing — round to $0.50 ceiling. Same numbers as <a href="/pricing/dtg" class="dff-pricing-link">/pricing/dtg</a> + order form.</span>
                    <button type="button" class="dff-reset-btn" id="dtgResetBtn">Reset form</button>
                </footer>
            </div>
        `;

        renderLocationPills();
        renderTable();
        renderSummary();
        wireGlobalHandlers();
    }

    function renderLocationPills() {
        const frontEl = document.getElementById('dtgFrontOptions');
        const backEl = document.getElementById('dtgBackOptions');
        if (!frontEl || !backEl) return;
        frontEl.innerHTML = FRONT_LOCATIONS.map((loc) => `
            <button type="button" class="dtg-location-pill${state.front === loc.code ? ' selected' : ''}" data-loc-code="${loc.code}" data-loc-group="front">
                ${escapeHtml(loc.label)}<span class="dim">${escapeHtml(loc.dim)}</span>
            </button>
        `).join('');
        backEl.innerHTML = `
            <button type="button" class="dtg-location-pill${state.back === '' ? ' selected' : ''}" data-loc-code="" data-loc-group="back">
                None
            </button>
        ` + BACK_LOCATIONS.map((loc) => `
            <button type="button" class="dtg-location-pill${state.back === loc.code ? ' selected' : ''}" data-loc-code="${loc.code}" data-loc-group="back">
                ${escapeHtml(loc.label)}<span class="dim">${escapeHtml(loc.dim)}</span>
            </button>
        `).join('');

        const sum = document.getElementById('dtgLocationSummary');
        if (sum) {
            const code = effectiveLocationCode();
            sum.innerHTML = `
                <div>${escapeHtml(effectiveLocationLabel())}</div>
                <span class="dls-code">Code: ${escapeHtml(code || '—')}</span>
            `;
        }

        frontEl.querySelectorAll('.dtg-location-pill').forEach((btn) => {
            btn.addEventListener('click', () => {
                state.front = btn.getAttribute('data-loc-code') || 'LC';
                renderLocationPills();
                schedulePriceUpdate();
            });
        });
        backEl.querySelectorAll('.dtg-location-pill').forEach((btn) => {
            btn.addEventListener('click', () => {
                state.back = btn.getAttribute('data-loc-code') || '';
                renderLocationPills();
                schedulePriceUpdate();
            });
        });
    }

    function renderTable() {
        const table = document.getElementById('dtgRowsTable');
        if (!table) return;
        // Determine which sizes any row has so we can show those columns.
        const sizesShown = collectSizesShown();
        const head = `
            <tr>
                <th>Style</th>
                <th>Description</th>
                <th>Color</th>
                ${sizesShown.map((s) => `<th class="size-col">${escapeHtml(s)}</th>`).join('')}
                <th class="size-col">Total</th>
                <th>$/pc</th>
                <th></th>
            </tr>
        `;
        table.querySelector('thead').innerHTML = head;

        const tbody = table.querySelector('tbody');
        if (state.rows.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="${sizesShown.length + 5}" style="text-align:center;color:#9ca3af;font-style:italic;padding:18px;">Add a row to start — or open the AI chat (right) to draft a quote</td></tr>
            `;
            return;
        }
        tbody.innerHTML = state.rows.map((row) => {
            const total = Object.values(row.sizes || {}).reduce((s, v) => s + (Number(v) || 0), 0);
            const perPiece = row._perPiece;
            const sizeCells = sizesShown.map((sz) => {
                const qty = Number((row.sizes || {})[sz]) || 0;
                const avail = row.availableSizes && row.availableSizes.length > 0
                    ? row.availableSizes.includes(sz)
                    : true;
                return `<td class="size-col">
                    <input type="number" min="0" step="1" value="${qty || ''}" data-row-id="${row.id}" data-size="${escapeHtml(sz)}" ${avail ? '' : 'disabled placeholder="—"'}>
                </td>`;
            }).join('');
            return `
                <tr data-row-id="${escapeHtml(row.id)}">
                    <td class="dtg-row-style">
                        <div class="dtg-combobox" data-row-id="${escapeHtml(row.id)}" data-combo-kind="style">
                            <input type="text" value="${escapeHtml(row.style)}" placeholder="PC54" autocomplete="off">
                        </div>
                    </td>
                    <td class="dtg-row-desc">${escapeHtml(row.desc || '—')}</td>
                    <td class="dtg-row-color">
                        <div class="dtg-combobox" data-row-id="${escapeHtml(row.id)}" data-combo-kind="color">
                            <input type="text" value="${escapeHtml(row.color)}" placeholder="${row.style ? 'Pick color' : 'Pick style first'}" autocomplete="off" ${row.style ? '' : 'disabled'}>
                        </div>
                    </td>
                    ${sizeCells}
                    <td class="size-col"><strong>${total}</strong></td>
                    <td>${perPiece != null ? '$' + perPiece.toFixed(2) : '—'}</td>
                    <td><button type="button" class="dtg-row-remove" data-remove-row="${escapeHtml(row.id)}" title="Remove row">×</button></td>
                </tr>
            `;
        }).join('');

        wireRowHandlers();
    }

    function collectSizesShown() {
        // Default standard sizes that always render. Augment with any size the
        // bundle reported as available on any row.
        const setSizes = new Set(['S', 'M', 'L', 'XL', '2XL', '3XL']);
        for (const row of state.rows) {
            for (const sz of (row.availableSizes || [])) {
                setSizes.add(String(sz).toUpperCase());
            }
            for (const sz of Object.keys(row.sizes || {})) {
                setSizes.add(String(sz).toUpperCase());
            }
        }
        return STANDARD_SIZES.filter((s) => setSizes.has(s));
    }

    function renderSummary() {
        const el = document.getElementById('dtgPriceSummary');
        if (!el) return;
        const cq = combinedQty();
        if (cq === 0) {
            el.innerHTML = `<div class="dps-empty">Add at least one row with sizes to see live pricing.</div>`;
            updateSubmitEnabled();
            return;
        }
        const tier = tierForQty(cq);
        const isLtm = cq < 24;
        const ltmPP = isLtm ? Math.floor((50 / cq) * 100) / 100 : 0;
        const subtotal = state.rows.reduce((s, r) => s + (Number(r._lineTotal) || 0), 0);

        el.innerHTML = `
            <div class="dps-label">Live DTG quote · ${effectiveLocationLabel()}</div>
            <div class="dps-grid">
                <div><span class="dps-tier-pill${isLtm ? ' ltm' : ''}">${escapeHtml(tier)}</span></div>
                <div>${cq} combined pieces${isLtm ? ` · LTM +$${ltmPP.toFixed(2)}/pc` : ''}</div>
                <div class="dps-total">$${fmtMoney(subtotal)}</div>
            </div>
            ${isLtm ? `<div class="dps-note">Bump combined qty to 24 and the $50 LTM fee disappears.</div>` : ''}
        `;
        updateSubmitEnabled();
    }

    function tierForQty(qty) {
        if (qty < 24) return '1-23 (LTM)';
        if (qty <= 47) return '24-47';
        if (qty <= 71) return '48-71';
        return '72+';
    }

    function updateSubmitEnabled() {
        const btn = document.getElementById('dtgSubmitBtn');
        if (!btn) return;
        const cq = combinedQty();
        const hasLines = state.rows.some((r) => r.style && r.color && Object.values(r.sizes || {}).some((v) => Number(v) > 0));
        const hasCustomer = !!(state.customer.email || state.customer.companyId);
        btn.disabled = state.submitting || !hasLines || cq < 1 || !hasCustomer || !state.customer.designNumber;
        btn.title = btn.disabled
            ? 'Need: location + at least one row + customer email/ID + design #'
            : 'Push this quote to ShopWorks';
    }

    // ----- Row + combobox handlers ------------------------------------------
    function wireRowHandlers() {
        const table = document.getElementById('dtgRowsTable');
        if (!table) return;

        // Size qty inputs
        table.querySelectorAll('input[type="number"][data-row-id][data-size]').forEach((input) => {
            input.addEventListener('input', () => {
                const rid = input.getAttribute('data-row-id');
                const sz = input.getAttribute('data-size');
                const row = state.rows.find((r) => r.id === rid);
                if (!row) return;
                const q = Math.max(0, parseInt(input.value || '0', 10) || 0);
                if (!row.sizes) row.sizes = {};
                if (q > 0) row.sizes[sz] = q;
                else delete row.sizes[sz];
                schedulePriceUpdate();
            });
        });

        // Remove row
        table.querySelectorAll('[data-remove-row]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const rid = btn.getAttribute('data-remove-row');
                state.rows = state.rows.filter((r) => r.id !== rid);
                renderTable();
                schedulePriceUpdate();
            });
        });

        // Style combobox (per row)
        table.querySelectorAll('.dtg-combobox[data-combo-kind="style"]').forEach((wrap) => {
            const rid = wrap.getAttribute('data-row-id');
            const input = wrap.querySelector('input');
            attachStyleCombobox(wrap, input, rid);
        });
        // Color combobox (per row)
        table.querySelectorAll('.dtg-combobox[data-combo-kind="color"]').forEach((wrap) => {
            const rid = wrap.getAttribute('data-row-id');
            const input = wrap.querySelector('input');
            attachColorCombobox(wrap, input, rid);
        });
    }

    function attachStyleCombobox(wrap, input, rid) {
        let menu = null;
        let timer = null;
        let lastMatches = [];
        let activeIndex = 0;

        function close() {
            if (menu) { menu.remove(); menu = null; }
        }
        function open() {
            if (!menu) {
                menu = document.createElement('div');
                menu.className = 'dtg-combobox-menu';
                wrap.appendChild(menu);
            }
        }
        function paint() {
            if (!menu) return;
            if (lastMatches.length === 0) {
                menu.innerHTML = `<div class="dtg-combobox-empty">${input.value ? `No matches for "${escapeHtml(input.value)}"` : 'Type 2+ characters'}</div>`;
                return;
            }
            menu.innerHTML = lastMatches.slice(0, 10).map((m, i) => `
                <div class="dtg-combobox-item${i === activeIndex ? ' active' : ''}" data-idx="${i}">
                    <div class="ci-primary">${escapeHtml(m.value || m.style || m.styleNumber || m.label || '')}</div>
                    <div class="ci-secondary">${escapeHtml(m.label || m.PRODUCT_TITLE || '')}</div>
                </div>
            `).join('');
            menu.querySelectorAll('.dtg-combobox-item').forEach((item) => {
                item.addEventListener('mouseenter', () => {
                    activeIndex = parseInt(item.getAttribute('data-idx'), 10) || 0;
                    paint();
                });
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    pick(lastMatches[parseInt(item.getAttribute('data-idx'), 10)]);
                });
            });
        }
        async function search(q) {
            if (q.length < 2) { lastMatches = []; paint(); return; }
            lastMatches = await fetchStyleSearch(q);
            activeIndex = 0;
            paint();
        }
        async function pick(m) {
            if (!m) return;
            const style = String(m.value || m.style || m.styleNumber || '').toUpperCase();
            const desc = String(m.label || m.PRODUCT_TITLE || '');
            const row = state.rows.find((r) => r.id === rid);
            if (!row) return;
            row.style = style;
            row.styleUpper = style;
            row.desc = desc;
            // Reset color when style changes
            row.color = '';
            row.catalogColor = '';
            row.colorSwatch = '';
            row.colorsAvailable = [];
            row.availableSizes = [];
            close();
            renderTable();
            // Asynchronously: fetch colors, fetch bundle (for live price + available sizes)
            const [colorsInfo, bundle] = await Promise.all([
                fetchProductColors(style),
                fetchBundle(style),
            ]);
            row.colorsAvailable = colorsInfo.colors || [];
            if (!row.desc && colorsInfo.productTitle) row.desc = colorsInfo.productTitle;
            if (bundle && Array.isArray(bundle.sizes)) {
                row.availableSizes = bundle.sizes
                    .filter((s) => Number(s.price) > 0)
                    .map((s) => String(s.size).toUpperCase());
            }
            renderTable();
            schedulePriceUpdate();
        }
        input.addEventListener('input', () => {
            open();
            clearTimeout(timer);
            timer = setTimeout(() => search(input.value.trim()), 200);
        });
        input.addEventListener('focus', () => { open(); paint(); });
        input.addEventListener('keydown', (e) => {
            if (!menu) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, lastMatches.length - 1); paint(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); paint(); }
            else if (e.key === 'Enter') { if (lastMatches[activeIndex]) { e.preventDefault(); pick(lastMatches[activeIndex]); } }
            else if (e.key === 'Escape') { close(); }
        });
        document.addEventListener('mousedown', (e) => { if (menu && !wrap.contains(e.target)) close(); });
    }

    function attachColorCombobox(wrap, input, rid) {
        const row = state.rows.find((r) => r.id === rid);
        if (!row || !row.style) return;
        let menu = null;
        let activeIndex = 0;
        let matches = row.colorsAvailable || [];

        function close() { if (menu) { menu.remove(); menu = null; } }
        function open() {
            if (!menu) {
                menu = document.createElement('div');
                menu.className = 'dtg-combobox-menu';
                wrap.appendChild(menu);
            }
        }
        function filter(q) {
            const qq = q.toLowerCase().trim();
            if (!qq) { matches = row.colorsAvailable || []; }
            else matches = (row.colorsAvailable || []).filter((c) =>
                String(c.COLOR_NAME || c.colorName || '').toLowerCase().includes(qq) ||
                String(c.CATALOG_COLOR || c.catalogColor || '').toLowerCase().includes(qq)
            );
            activeIndex = 0;
            paint();
        }
        function paint() {
            if (!menu) return;
            if (matches.length === 0) {
                menu.innerHTML = `<div class="dtg-combobox-empty">No colors</div>`;
                return;
            }
            menu.innerHTML = matches.slice(0, 30).map((c, i) => {
                const name = c.COLOR_NAME || c.colorName || '';
                const cat = c.CATALOG_COLOR || c.catalogColor || '';
                const swatch = c.COLOR_SQUARE_IMAGE || c.colorSwatchUrl || '';
                return `
                    <div class="dtg-combobox-item${i === activeIndex ? ' active' : ''}" data-idx="${i}">
                        <div style="display:flex;align-items:center;gap:8px;">
                            ${swatch ? `<img class="ci-swatch-mini" src="${escapeHtml(swatch)}" alt="">` : ''}
                            <div>
                                <div class="ci-primary">${escapeHtml(name)}</div>
                                ${cat ? `<div class="ci-secondary">${escapeHtml(cat)}</div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            menu.querySelectorAll('.dtg-combobox-item').forEach((item) => {
                item.addEventListener('mouseenter', () => { activeIndex = parseInt(item.getAttribute('data-idx'), 10) || 0; paint(); });
                item.addEventListener('mousedown', (e) => { e.preventDefault(); pick(matches[parseInt(item.getAttribute('data-idx'), 10)]); });
            });
        }
        function pick(c) {
            if (!c) return;
            row.color = c.COLOR_NAME || c.colorName || '';
            row.catalogColor = c.CATALOG_COLOR || c.catalogColor || '';
            row.colorSwatch = c.COLOR_SQUARE_IMAGE || c.colorSwatchUrl || '';
            close();
            renderTable();
            schedulePriceUpdate();
        }
        input.addEventListener('input', () => { open(); filter(input.value); });
        input.addEventListener('focus', () => { open(); filter(input.value); });
        input.addEventListener('keydown', (e) => {
            if (!menu) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, matches.length - 1); paint(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); paint(); }
            else if (e.key === 'Enter') { if (matches[activeIndex]) { e.preventDefault(); pick(matches[activeIndex]); } }
            else if (e.key === 'Escape') { close(); }
        });
        document.addEventListener('mousedown', (e) => { if (menu && !wrap.contains(e.target)) close(); });
    }

    // ----- Customer combobox + manual fields --------------------------------
    function wireGlobalHandlers() {
        // Add row
        const addBtn = document.getElementById('dtgAddRowBtn');
        if (addBtn) addBtn.addEventListener('click', () => {
            state.rows.push(newBlankRow());
            renderTable();
        });

        // Reset
        const reset = document.getElementById('dtgResetBtn');
        if (reset) reset.addEventListener('click', () => resetForm());

        // Submit
        const submit = document.getElementById('dtgSubmitBtn');
        if (submit) submit.addEventListener('click', () => submitToShopWorks());

        // Customer combobox
        const wrap = document.getElementById('dtgCompanyCombo');
        const input = document.getElementById('dtgCompanyInput');
        if (wrap && input) attachCompanyCombobox(wrap, input);

        // Manual customer fields
        bindInputToState('dtgFirstName', 'firstName');
        bindInputToState('dtgLastName', 'lastName');
        bindInputToState('dtgEmail', 'email');
        bindInputToState('dtgPhone', 'phone');
        bindInputToState('dtgCompanyId', 'companyId');
        bindInputToState('dtgDesignNumber', 'designNumber');
        const termsSel = document.getElementById('dtgTerms');
        if (termsSel) termsSel.addEventListener('change', () => {
            state.customer.terms = termsSel.value;
            updateSubmitEnabled();
        });
    }
    function bindInputToState(elId, stateKey) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.addEventListener('input', () => {
            state.customer[stateKey] = el.value.trim();
            updateSubmitEnabled();
        });
    }

    function attachCompanyCombobox(wrap, input) {
        let menu = null;
        let timer = null;
        let matches = [];
        let activeIndex = 0;

        function close() { if (menu) { menu.remove(); menu = null; } }
        function open() {
            if (!menu) {
                menu = document.createElement('div');
                menu.className = 'dtg-combobox-menu';
                wrap.appendChild(menu);
            }
        }
        function paint() {
            if (!menu) return;
            if (matches.length === 0) {
                menu.innerHTML = `<div class="dtg-combobox-empty">${input.value.length >= 2 ? `No matches for "${escapeHtml(input.value)}"` : 'Type 2+ characters'}</div>`;
                return;
            }
            menu.innerHTML = matches.slice(0, 10).map((c, i) => {
                const loc = [c.City, c.State].filter(Boolean).join(', ');
                const contactCount = (c.contacts || []).length;
                return `
                    <div class="dtg-combobox-item${i === activeIndex ? ' active' : ''}" data-idx="${i}">
                        <div class="ci-primary">${escapeHtml(c.Company_Name || '')}</div>
                        <div class="ci-secondary">${escapeHtml(loc || '—')}${contactCount > 0 ? ` · ${contactCount} contact${contactCount === 1 ? '' : 's'}` : ' · no email contacts'}</div>
                    </div>
                `;
            }).join('');
            menu.querySelectorAll('.dtg-combobox-item').forEach((item) => {
                item.addEventListener('mouseenter', () => { activeIndex = parseInt(item.getAttribute('data-idx'), 10) || 0; paint(); });
                item.addEventListener('mousedown', (e) => { e.preventDefault(); pick(matches[parseInt(item.getAttribute('data-idx'), 10)]); });
            });
        }
        async function search(q) {
            if (q.length < 2) { matches = []; paint(); return; }
            matches = await fetchCompanies(q);
            activeIndex = 0;
            paint();
        }
        function pick(c) {
            if (!c) return;
            state.customer.company = c.Company_Name || '';
            state.customer.companyId = c.id_Customer != null ? String(c.id_Customer) : '';
            state.customer.contacts = c.contacts || [];
            input.value = c.Company_Name || '';
            // If only one emailable contact, auto-pick them
            const firstContact = (c.contacts || []).find((ct) => ct.Email || ct.ContactNumbersEmail);
            if (firstContact) {
                applyContact(firstContact);
            }
            // Reflect in companyId field if it's blank
            const cidInput = document.getElementById('dtgCompanyId');
            if (cidInput && !cidInput.value) cidInput.value = state.customer.companyId;
            close();
            updateSubmitEnabled();
        }
        input.addEventListener('input', () => {
            open();
            clearTimeout(timer);
            timer = setTimeout(() => search(input.value.trim()), 200);
        });
        input.addEventListener('focus', () => { open(); paint(); });
        input.addEventListener('keydown', (e) => {
            if (!menu) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, matches.length - 1); paint(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); paint(); }
            else if (e.key === 'Enter') { if (matches[activeIndex]) { e.preventDefault(); pick(matches[activeIndex]); } }
            else if (e.key === 'Escape') { close(); }
        });
        document.addEventListener('mousedown', (e) => { if (menu && !wrap.contains(e.target)) close(); });
    }

    function applyContact(ct) {
        state.customer.firstName = ct.NameFirst || '';
        state.customer.lastName = ct.NameLast || '';
        state.customer.email = ct.Email || ct.ContactNumbersEmail || '';
        state.customer.phone = ct.Phone || ct.Company_Phone || '';
        const fn = document.getElementById('dtgFirstName'); if (fn) fn.value = state.customer.firstName;
        const ln = document.getElementById('dtgLastName'); if (ln) ln.value = state.customer.lastName;
        const em = document.getElementById('dtgEmail'); if (em) em.value = state.customer.email;
        const ph = document.getElementById('dtgPhone'); if (ph) ph.value = state.customer.phone;
        updateSubmitEnabled();
    }

    // ----- Live pricing (via window.DTGPricingService) -----------------------
    let _priceTimer = null;
    function schedulePriceUpdate() {
        clearTimeout(_priceTimer);
        _priceTimer = setTimeout(() => updateLivePrices().catch((e) => console.error('[dtg-inline-form] price update failed:', e)), 200);
    }

    async function updateLivePrices() {
        const code = effectiveLocationCode();
        const cq = combinedQty();
        if (!code || cq === 0 || !window.DTGPricingService) {
            for (const r of state.rows) { r._perPiece = null; r._lineTotal = 0; }
            renderTable();
            renderSummary();
            return;
        }
        const svc = new window.DTGPricingService();
        const isLtm = cq < 24;
        const ltmPP = isLtm ? Math.floor((50 / cq) * 100) / 100 : 0;

        for (const row of state.rows) {
            if (!row.style || !row.color) { row._perPiece = null; row._lineTotal = 0; continue; }
            try {
                const bundle = await fetchBundle(row.style);
                if (!bundle) { row._perPiece = null; row._lineTotal = 0; continue; }
                const allPrices = svc.calculateAllLocationPrices(bundle, cq);
                if (!allPrices || !allPrices[code]) { row._perPiece = null; row._lineTotal = 0; continue; }
                const locPrices = allPrices[code];
                // pick a tier label for lookup
                const tier = svc.getTierForQuantity(bundle.tiers, cq);
                let lineTotal = 0;
                let count = 0;
                let aggregate = 0;
                for (const [sz, qty] of Object.entries(row.sizes || {})) {
                    const q = Number(qty) || 0; if (q <= 0) continue;
                    const priceObj = locPrices[String(sz).toUpperCase()] || locPrices[sz];
                    const base = priceObj && priceObj[tier.TierLabel];
                    if (typeof base !== 'number') continue;
                    const final = base + ltmPP;
                    lineTotal += final * q;
                    aggregate += final * q;
                    count += q;
                }
                row._perPiece = count > 0 ? Math.round((aggregate / count) * 100) / 100 : null;
                row._lineTotal = Math.round(lineTotal * 100) / 100;
            } catch (err) {
                console.error('[dtg-inline-form] row price update failed:', row.style, err);
                row._perPiece = null;
                row._lineTotal = 0;
            }
        }
        renderTable();
        renderSummary();
    }

    // ----- Submit ------------------------------------------------------------
    async function submitToShopWorks() {
        const statusEl = document.getElementById('dtgSubmitStatus');
        const setStatus = (cls, msg) => {
            if (!statusEl) return;
            statusEl.className = `dtg-submit-status ${cls}`;
            statusEl.innerHTML = msg;
            statusEl.hidden = false;
        };

        // Build lines array
        const code = effectiveLocationCode();
        const cleanLines = state.rows
            .filter((r) => r.style && r.color && Object.keys(r.sizes || {}).length > 0)
            .map((r) => ({ styleNumber: r.style, color: r.color, sizes: { ...r.sizes } }));
        if (!code || cleanLines.length === 0) {
            setStatus('error', 'Need a location + at least one filled row.');
            return;
        }
        if (!state.customer.email || !state.customer.designNumber) {
            setStatus('error', 'Need customer email and design number before pushing.');
            return;
        }

        state.submitting = true;
        updateSubmitEnabled();
        setStatus('busy', '<i class="fas fa-circle-notch fa-spin"></i> Pricing + pushing…');

        // 1) Authoritative price via canonical endpoint (= what the chat would quote)
        let pricing;
        try {
            const r = await fetch(`${API_BASE}/api/dtg/quote-pricing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locationCode: code, lines: cleanLines }),
            });
            pricing = await r.json();
            if (!r.ok || pricing.error) {
                setStatus('error', `Pricing failed: ${escapeHtml(pricing && pricing.message ? pricing.message : 'HTTP ' + r.status)}`);
                state.submitting = false; updateSubmitEnabled();
                return;
            }
        } catch (err) {
            setStatus('error', `Pricing failed: ${escapeHtml(err.message)}`);
            state.submitting = false; updateSubmitEnabled();
            return;
        }

        // 2) Build the order-form-shaped payload (mirrors pages/order-form/shopworks.js buildBody)
        const items = Array.isArray(pricing.lineItems) ? pricing.lineItems : [];
        const totals = pricing.totals || {};
        const subtotal = Number(pricing.subtotal) || items.reduce((s, it) => s + (Number(it.lineTotal) || 0), 0);
        const ltmTotal = items.reduce((s, it) => s + (Number(it.ltmPerUnit) || 0) * (Number(it.totalQuantity) || 0), 0);

        const rows = items.map((it, i) => ({
            id: `dtg-row-${i + 1}`,
            style: it.styleNumber || it.style || '',
            desc: it.description || `${it.styleNumber || ''} ${it.color || ''}`.trim(),
            color: it.color || '',
            colorName: it.color || '',
            catalogColor: (state.rows.find((r) => r.style === it.styleNumber && r.color === it.color)?.catalogColor) || '',
            imageUrl: '',
            sizes: it.sizes || {},
            deco: 'dtg',
            rowDecoConfig: { method: 'dtg', locationCode: it.locationCode || code },
            price: Number(it.finalUnitPrice) || 0,
            priceOverride: false,
            manualMode: false,
            manualCost: '',
        }));

        const byRow = {};
        items.forEach((it, i) => {
            byRow[`dtg-row-${i + 1}`] = {
                unitPriceBySize: (it.lineSizes || []).reduce((m, s) => { m[s.size] = s.finalUnit; return m; }, {}),
                rowSubtotal: Number(it.lineTotal) || 0,
                tier: it.tier || pricing.tier,
            };
        });

        const body = {
            info: {
                company: state.customer.company || '',
                buyer: `${state.customer.firstName} ${state.customer.lastName}`.trim(),
                buyerFirst: state.customer.firstName || '',
                buyerLast: state.customer.lastName || '',
                buyerEmail: state.customer.email || '',
                email: state.customer.email || '',
                companyName: state.customer.company || '',
                companyId: state.customer.companyId || '',
                phone: state.customer.phone || '',
                designNumber: state.customer.designNumber || '',
                salesRep: 'Erik Mickelson',
                salesRepEmail: 'erik@nwcustomapparel.com',
                terms: state.customer.terms || 'Prepaid',
                paymentTerms: state.customer.terms || 'Prepaid',
                taxable: true,
                quoteId: window.__dtgQuoteID || '',
            },
            rows,
            ship: { method: 'ups', sameAsBilling: true },
            orderNotes: `DTG quote — ${items.length} line${items.length === 1 ? '' : 's'} · ${pricing.combinedQuantity} combined pcs · tier ${pricing.tier}`,
            files: [],
            decoConfig: { method: 'dtg' },
            breakdown: {
                supported: true,
                byRow,
                totalQty: Number(pricing.combinedQuantity) || 0,
                tier: pricing.tier,
                subtotal: Math.round(subtotal * 100) / 100,
                ltmTotal: Math.round(ltmTotal * 100) / 100,
                taxEstimate: Number(totals.taxEstimate) || 0,
                depositDue: 0,
                grandTotal: Number(totals.grandTotal) || Math.round(subtotal * 100) / 100,
                fees: [],
                errors: [],
            },
            methodNotesBlock: `DTG · ${effectiveLocationLabel()} · Tier ${pricing.tier} · ${items.length} line${items.length === 1 ? '' : 's'} · ${pricing.combinedQuantity} combined pieces`,
            designNumbers: state.customer.designNumber ? [state.customer.designNumber] : [],
            addOns: [],
        };

        // 3) POST to /api/submit-order-form
        try {
            const r = await fetch(SUBMIT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await r.json().catch(() => ({}));
            if (r.ok && data.success) {
                const id = data.shopWorksId || data.extOrderId;
                setStatus('success',
                    `<strong>Pushed to ShopWorks.</strong> Order: <code>${escapeHtml(id || 'submitted')}</code> · ${items.length} line${items.length === 1 ? '' : 's'} · $${fmtMoney(subtotal)}`
                );
            } else {
                setStatus('error', `Push failed: ${escapeHtml(data.error || 'HTTP ' + r.status)}${data.detail ? ` (${escapeHtml(data.detail)})` : ''}`);
            }
        } catch (err) {
            setStatus('error', `Push failed: ${escapeHtml(err.message)}`);
        }
        state.submitting = false;
        updateSubmitEnabled();
    }

    // ----- Public API for chat bridge ---------------------------------------
    async function fillFromQuote(priceQuote, customerFinal) {
        if (priceQuote) {
            // Set location
            const code = priceQuote.locationCode || (priceQuote.lineItems && priceQuote.lineItems[0] && priceQuote.lineItems[0].locationCode) || 'LC';
            if (code.includes('_')) {
                const [front, back] = code.split('_');
                state.front = front;
                state.back = back || '';
            } else {
                state.front = code;
                state.back = '';
            }

            // Build rows from PRICE_QUOTE lineItems
            const items = Array.isArray(priceQuote.lineItems) ? priceQuote.lineItems : [];
            const newRows = items.map((it) => {
                const r = newBlankRow();
                r.style = (it.styleNumber || it.style || '').toUpperCase();
                r.styleUpper = r.style;
                r.color = it.color || '';
                r.desc = it.description || '';
                r.sizes = { ...(it.sizes || {}) };
                return r;
            });
            state.rows = newRows.length > 0 ? newRows : [newBlankRow()];

            // Cache the AI quoteID for the eventual ShopWorks push notes
            if (window.__dtgQuoteID == null && priceQuote.quoteID) {
                window.__dtgQuoteID = priceQuote.quoteID;
            }

            // Hydrate per-row catalog (CATALOG_COLOR + available sizes + swatch)
            for (const row of state.rows) {
                if (!row.style) continue;
                try {
                    const [info, bundle] = await Promise.all([
                        fetchProductColors(row.style),
                        fetchBundle(row.style),
                    ]);
                    row.colorsAvailable = info.colors || [];
                    if (!row.desc && info.productTitle) row.desc = info.productTitle;
                    const matchColor = (info.colors || []).find((c) =>
                        (c.COLOR_NAME || c.colorName || '').toLowerCase() === (row.color || '').toLowerCase()
                    );
                    if (matchColor) {
                        row.catalogColor = matchColor.CATALOG_COLOR || matchColor.catalogColor || '';
                        row.colorSwatch = matchColor.COLOR_SQUARE_IMAGE || '';
                    }
                    if (bundle && Array.isArray(bundle.sizes)) {
                        row.availableSizes = bundle.sizes.filter((s) => Number(s.price) > 0).map((s) => String(s.size).toUpperCase());
                    }
                } catch (e) { console.warn('[dtg-inline-form] hydrate failed for', row.style, e); }
            }
        }

        if (customerFinal) {
            // Accept several shapes the bot might emit:
            //   - `name`: "First Last"
            //   - `firstName` + `lastName` (order-form shape)
            //   - `contact_name` (lookup_customer shape)
            const fullName = customerFinal.name || customerFinal.contact_name || '';
            const nameParts = fullName.split(/\s+/);
            const first = customerFinal.firstName || customerFinal.contact_first || nameParts[0] || '';
            const last = customerFinal.lastName || customerFinal.contact_last || nameParts.slice(1).join(' ') || '';
            state.customer.company = customerFinal.company || state.customer.company;
            state.customer.companyId = customerFinal.customer_number || customerFinal.companyId || state.customer.companyId;
            state.customer.firstName = first || state.customer.firstName;
            state.customer.lastName = last || state.customer.lastName;
            state.customer.email = customerFinal.email || customerFinal.buyerEmail || state.customer.email;
            state.customer.phone = customerFinal.phone || state.customer.phone;
            state.customer.designNumber = customerFinal.designNumber || state.customer.designNumber;
            state.customer.terms = customerFinal.payment_terms || customerFinal.terms || state.customer.terms;

            // Reflect into DOM
            const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            set('dtgCompanyInput', state.customer.company);
            set('dtgCompanyId', state.customer.companyId);
            set('dtgFirstName', state.customer.firstName);
            set('dtgLastName', state.customer.lastName);
            set('dtgEmail', state.customer.email);
            set('dtgPhone', state.customer.phone);
            set('dtgDesignNumber', state.customer.designNumber);
            const termsSel = document.getElementById('dtgTerms');
            if (termsSel && state.customer.terms) termsSel.value = state.customer.terms;
        }

        renderLocationPills();
        renderTable();
        schedulePriceUpdate();

        // Scroll the form into view so the rep sees the fill happen.
        const wrap = document.querySelector('.dtg-form-wrap');
        if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function getState() {
        return JSON.parse(JSON.stringify({
            front: state.front,
            back: state.back,
            locationCode: effectiveLocationCode(),
            combinedQty: combinedQty(),
            rows: state.rows.map((r) => ({
                style: r.style, color: r.color, catalogColor: r.catalogColor,
                desc: r.desc, sizes: r.sizes,
            })),
            customer: state.customer,
        }));
    }

    function resetForm() {
        state.front = 'LC';
        state.back = '';
        state.rows = [newBlankRow()];
        state.customer = {
            company: '', companyId: '', contactId: '',
            firstName: '', lastName: '', email: '', phone: '',
            designNumber: '', terms: 'Prepaid', contacts: [],
        };
        const statusEl = document.getElementById('dtgSubmitStatus');
        if (statusEl) statusEl.hidden = true;
        render();
    }

    // ----- Utilities ---------------------------------------------------------
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function fmtMoney(n) {
        if (!Number.isFinite(Number(n))) return '0.00';
        return Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // ----- Init --------------------------------------------------------------
    function init() {
        // Start with one blank row
        if (state.rows.length === 0) state.rows.push(newBlankRow());
        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose API
    window.DTGInlineForm = {
        fillFromQuote,
        getState,
        resetForm,
        submitToShopWorks,
    };
})();
