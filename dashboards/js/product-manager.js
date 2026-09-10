/**
 * product-manager.js — controller for dashboards/product-manager.html
 * (non-SanMar catalog items, 2026-07-06)
 *
 * Reps add/edit products that live in the Caspio Non_SanMar_Products table;
 * the proxy merges active rows into /api/products/search so they appear in
 * the customer catalog next to SanMar goods. PRICING RULE (Erik): reps enter
 * COST — the catalog computes the decorated sell price with the same margin
 * machinery as SanMar items. FixedPrice mode exists for special cases only.
 *
 * APIs (via DashPage.fetchJson → APP_CONFIG.API.BASE_URL):
 *   GET/POST /api/non-sanmar-products, PUT/DELETE /api/non-sanmar-products/:id
 *   POST /api/files/upload (image → Caspio CDN via the proxy files API)
 */
(function () {
    'use strict';

    let products = [];
    let filterText = '';
    let listReady = false;
    let listRequestId = 0;
    let saving = false;

    // Curated vendor codes. MIRROR of NON_SANMAR_VENDORS in
    // shared_components/js/quote-builder-utils.js — the two lists are locked by
    // tests/unit/staff-toolkit-content.test.js. Duplicated rather than shared
    // because this dashboard does not load the (builder-only) utils bundle.
    // VendorCode is free text and GET /api/non-sanmar-products?vendor= filters on
    // EXACT uppercase equality, so free-typed spellings split vendor reporting
    // permanently — hence the list, with 'Other…' kept for real one-offs.
    const NON_SANMAR_VENDORS = [
        { code: 'SSA', label: 'S&S Activewear' },
        { code: 'ALP', label: 'Alphabroder' },
        { code: 'CARH', label: 'Carhartt (direct)' },
        { code: 'RICH', label: 'Richardson' },
        { code: 'JDS', label: 'JDS Industries' },
        { code: 'AUG', label: 'Augusta / Holloway' }
    ];

    const $ = (id) => document.getElementById(id);

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    document.addEventListener('DOMContentLoaded', function () {
        wire();
        boot();
    });

    function boot() {
        const requestId = ++listRequestId;
        listReady = false; products = [];
        ['stat-total', 'stat-active', 'stat-incomplete'].forEach(id => { $(id).textContent = '—'; });
        const root = $('content-root');
        root.classList.add('dash-loading'); root.textContent = 'Loading products…';
        return loadProducts(requestId).then(function (current) { if (current) DashPage.hideError(); }).catch(function (err) {
            if (requestId !== listRequestId) return;
            console.error('[product-manager] load failed:', err);
            DashPage.showError('Unable to load products (' + (err.message || 'request failed') + ').');
            root.classList.remove('dash-loading');
            root.innerHTML = '<p class="pm-empty" role="alert">Products unavailable (' + escapeHtml(err.message || 'request failed') + '). ' +
                '<button type="button" class="btn pm-btn pm-btn-ghost btn-ghost" id="pmRetry">Retry</button></p>';
            const rb = $('pmRetry'); if (rb) rb.addEventListener('click', boot);
        });
    }

    async function loadProducts(requestId) {
        const data = await DashPage.fetchJson('/api/non-sanmar-products?active=all&refresh=true');
        if (requestId !== listRequestId) return false;
        if (!data || !Array.isArray(data.data)) throw new Error('Product list response incomplete');
        products = data.data; listReady = true;
        renderStats(); renderTable(); return true;
    }

    function renderStats() {
        $('stat-total').textContent = products.length;
        $('stat-active').textContent = products.filter(isActiveRow).length;
        $('stat-incomplete').textContent = products.filter((p) =>
            !p.ImageURL || !(parseFloat(p.DefaultCost) > 0 || parseFloat(p.DefaultSellPrice) > 0)).length;
    }

    function isActiveRow(p) {
        return p.IsActive === true || p.IsActive === 1 || p.IsActive === 'Yes' || p.IsActive === 'true';
    }

    function matchesFilter(p) {
        if (!filterText) return true;
        return `${p.StyleNumber || ''} ${p.ProductName || ''} ${p.Brand || ''} ${p.Category || ''}`
            .toLowerCase().includes(filterText);
    }

    function renderTable() {
        if (!listReady) return;
        const root = $('content-root');
        root.classList.remove('dash-loading');
        const rows = products.filter(matchesFilter);

        if (!rows.length) {
            root.innerHTML = `<p class="pm-empty">${products.length
                ? 'No products match that filter.'
                : 'No non-SanMar products yet — click <strong>Add product</strong> to create the first one.'}</p>`;
            return;
        }

        root.innerHTML = `
            <div class="pm-table-wrap" role="region" aria-label="Product catalog" tabindex="0">
            <table class="pm-table">
                <thead>
                    <tr>
                        <th></th><th>Style</th><th>Product</th><th>Brand</th><th>Category</th>
                        <th class="pm-num">Cost</th><th>Pricing</th><th>Status</th><th></th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map((p) => `
                        <tr data-id="${escapeHtml(String(p.ID_Product))}" class="${isActiveRow(p) ? '' : 'pm-row-inactive'}">
                            <td>${p.ImageURL
                                ? `<img class="pm-thumb" src="${escapeHtml(p.ImageURL)}" alt="" loading="lazy">`
                                : '<span class="pm-thumb pm-thumb-empty" role="img" title="No image" aria-label="No image"><i class="fas fa-image" aria-hidden="true"></i></span>'}</td>
                            <td class="pm-style">${escapeHtml(p.StyleNumber)}</td>
                            <td>${escapeHtml(p.ProductName)}</td>
                            <td>${escapeHtml(p.Brand)}</td>
                            <td>${escapeHtml(p.Category || '')}</td>
                            <td class="pm-num">${parseFloat(p.DefaultCost) > 0 ? '$' + parseFloat(p.DefaultCost).toFixed(2) : '<span class="pm-warn-text">missing</span>'}</td>
                            <td>${String(p.PricingMethod || '').toLowerCase().includes('fix')
                                ? `Fixed $${(parseFloat(p.DefaultSellPrice) || 0).toFixed(2)}`
                                : 'Auto margin'}</td>
                            <td>${isActiveRow(p)
                                ? '<span class="pm-chip pm-chip-live">Live</span>'
                                : '<span class="pm-chip">Hidden</span>'}</td>
                            <td class="pm-actions">
                                <button type="button" class="btn pm-btn pm-btn-ghost pm-edit btn-ghost" data-id="${escapeHtml(String(p.ID_Product))}" aria-label="Edit ${escapeHtml(p.StyleNumber)}"><i class="fas fa-pen" aria-hidden="true"></i> Edit</button>
                                <a class="btn pm-btn pm-btn-ghost btn-ghost" href="/product.html?style=${encodeURIComponent(p.StyleNumber)}" target="_blank" rel="noopener" title="View in catalog" aria-label="View ${escapeHtml(p.StyleNumber)} in the catalog (new tab)"><i class="fas fa-eye" aria-hidden="true"></i></a>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>
            </div>`;
    }

    /* ── Form ────────────────────────────────────────── */

    function openForm(product) {
        if (saving) return;
        $('pmFormTitle').textContent = product ? `Edit ${product.StyleNumber}` : 'Add product';
        $('fId').value = product ? product.ID_Product : '';
        $('fStyle').value = product ? (product.StyleNumber || '') : '';
        $('fStyle').disabled = !!product;   // style number is the key — never edited
        $('fName').value = product ? (product.ProductName || '') : '';
        $('fBrand').value = product ? (product.Brand || '') : '';
        const category = $('fCategory');
        category.querySelectorAll('[data-stored-category]').forEach(option => option.remove());
        const storedCategory = product && product.Category ? String(product.Category) : 'Other';
        if (![...category.options].some(option => option.value === storedCategory)) {
            const option = document.createElement('option');
            option.value = storedCategory; option.textContent = storedCategory; option.dataset.storedCategory = 'true';
            category.appendChild(option);
        }
        category.value = storedCategory;
        $('fCost').value = product && parseFloat(product.DefaultCost) > 0 ? parseFloat(product.DefaultCost) : '';
        $('fPricingMethod').value = product && String(product.PricingMethod || '').toLowerCase().includes('fix') ? 'FixedPrice' : 'Margin';
        $('fSell').value = product && parseFloat(product.DefaultSellPrice) > 0 ? parseFloat(product.DefaultSellPrice) : '';
        $('fSizes').value = product ? (product.AvailableSizes || '') : '';
        $('fColors').value = product ? (product.DefaultColors || '') : '';
        setVendorFields(product ? product.VendorCode : '');
        $('fVendorUrl').value = product ? (product.VendorURL || '') : '';
        $('fImageUrl').value = product ? (product.ImageURL || '') : '';
        $('fImageFile').value = '';
        $('fNotes').value = product ? (product.Notes || '') : '';
        $('fActive').checked = product ? isActiveRow(product) : true;
        syncSellVisibility();
        syncImagePreview();
        $('pmFormCard').hidden = false;
        $('pmFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Focus the first editable field so keyboard users land in the form (style is locked on edit)
        setTimeout(function () { const f = product ? $('fName') : $('fStyle'); if (f) f.focus(); }, 60);
    }

    function closeForm() {
        $('pmFormCard').hidden = true;
        const add = $('pmAddBtn'); if (add) add.focus();
    }

    function syncSellVisibility() {
        $('fSellWrap').hidden = $('fPricingMethod').value !== 'FixedPrice';
    }

    /** Fill the vendor <select> once (curated codes + an Other… escape). */
    function buildVendorOptions() {
        const sel = $('fVendorSelect');
        if (!sel || sel.options.length) return;
        const opt = (label, value) => {
            const o = document.createElement('option');
            o.value = value;
            o.textContent = label;   // textContent — vendor labels are never markup
            return o;
        };
        sel.appendChild(opt('— none —', ''));
        NON_SANMAR_VENDORS.forEach(v => sel.appendChild(opt(v.label, v.code)));
        sel.appendChild(opt('Other…', '__other'));
    }

    /**
     * Point the select at the row's stored code. A code that is NOT in the curated
     * list (older rows carry arbitrary values) falls through to Other… with the raw
     * value in the text box, so editing an unrelated field can never silently
     * rewrite someone's vendor.
     */
    function setVendorFields(code) {
        buildVendorOptions();
        const raw = String(code || '').trim();
        const known = NON_SANMAR_VENDORS.some(v => v.code === raw.toUpperCase());
        $('fVendorSelect').value = raw ? (known ? raw.toUpperCase() : '__other') : '';
        $('fVendor').value = known ? '' : raw;
        syncVendorOther();
    }

    function syncVendorOther() {
        $('fVendor').hidden = $('fVendorSelect').value !== '__other';
    }

    /** The code we actually persist to VendorCode. */
    function readVendorCode() {
        const sel = $('fVendorSelect').value;
        if (sel === '__other') return $('fVendor').value.trim().toUpperCase();
        return sel;
    }

    function syncImagePreview() {
        const url = $('fImageUrl').value.trim();
        const img = $('fImagePreview');
        img.hidden = !url;
        if (url) img.src = url;
    }

    async function uploadImage(file) {
        const fd = new FormData();
        fd.append('file', file, file.name);
        const resp = await fetch(DashPage.apiUrl('/api/files/upload'), { method: 'POST', body: fd });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.externalKey) {
            throw new Error(data.error || data.message || `Upload failed (${resp.status})`);
        }
        // The proxy streams the file back by key — a stable, CDN-backed URL
        return DashPage.apiUrl(`/api/files/${encodeURIComponent(data.externalKey)}`);
    }

    async function saveProduct(e) {
        e.preventDefault();
        if (saving) return;
        saving = true;
        DashPage.hideError();
        const saveBtn = $('pmSaveBtn');
        const original = saveBtn.innerHTML;
        const controls = [...document.querySelectorAll('#pmForm input, #pmForm select, #pmForm textarea, #pmForm button, #pmFormClose, #pmAddBtn, .pm-edit')];
        const disabled = controls.map(control => control.disabled);
        controls.forEach(control => { control.disabled = true; });
        let saveAttempted = false;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Saving…';
        try {
            const pricingMethod = $('fPricingMethod').value;
            const cost = parseFloat($('fCost').value) || 0;
            const sell = parseFloat($('fSell').value) || 0;
            if (pricingMethod === 'Margin' && cost <= 0) {
                throw new Error('Enter your cost — the catalog prices from it (or switch to Fixed sell price).');
            }
            if (pricingMethod === 'FixedPrice' && sell <= 0) {
                throw new Error('Fixed pricing needs a sell price.');
            }

            // Capture the editor before the image upload can yield to another event.
            const id = $('fId').value;
            const file = $('fImageFile').files && $('fImageFile').files[0];

            const payload = {
                StyleNumber: $('fStyle').value.trim().toUpperCase(),
                ProductName: $('fName').value.trim(),
                Brand: $('fBrand').value.trim(),
                Category: $('fCategory').value,
                DefaultCost: cost,
                DefaultSellPrice: pricingMethod === 'FixedPrice' ? sell : 0,
                PricingMethod: pricingMethod,
                AvailableSizes: $('fSizes').value.trim(),
                DefaultColors: $('fColors').value.trim(),
                VendorCode: readVendorCode(),
                VendorURL: $('fVendorUrl').value.trim(),
                ImageURL: $('fImageUrl').value.trim(),
                Notes: $('fNotes').value.trim(),
                IsActive: $('fActive').checked
            };

            // An uploaded file still takes precedence over the captured URL.
            if (file) {
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Uploading image…';
                payload.ImageURL = await uploadImage(file);
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Saving…';
            }
            saveAttempted = true;
            if (id) {
                await DashPage.fetchJson(`/api/non-sanmar-products/${encodeURIComponent(id)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                await DashPage.fetchJson('/api/non-sanmar-products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            closeForm();
            // A failed refresh does not mean the completed product save failed.
            await boot();
        } catch (err) {
            console.error('[product-manager] save failed:', err);
            DashPage.showError(saveAttempted
                ? 'Could not confirm the product save (' + (err.message || 'request failed') + '). Check the catalog before retrying.'
                : (err.message || 'Unable to save this product. Check the fields and try again.'));
        } finally {
            saving = false;
            controls.forEach((control, index) => { control.disabled = disabled[index]; });
            if ($('pmFormCard').hidden) $('pmAddBtn').focus();
            saveBtn.innerHTML = original;
        }
    }

    /* ── Wiring ──────────────────────────────────────── */

    function wire() {
        $('pmAddBtn').addEventListener('click', () => openForm(null));
        $('pmFormClose').addEventListener('click', closeForm);
        $('pmForm').addEventListener('submit', saveProduct);
        $('fPricingMethod').addEventListener('change', syncSellVisibility);
        $('fVendorSelect').addEventListener('change', syncVendorOther);
        $('fImageUrl').addEventListener('input', syncImagePreview);
        $('pmFilter').addEventListener('input', function () {
            filterText = this.value.trim().toLowerCase();
            renderTable();
        });
        document.addEventListener('click', function (e) {
            const btn = e.target.closest('.pm-edit');
            if (!btn) return;
            const product = products.find((p) => String(p.ID_Product) === btn.dataset.id);
            if (product) openForm(product);
        });
        const bannerClose = document.querySelector('.dash-error-banner-close');
        if (bannerClose) bannerClose.addEventListener('click', DashPage.hideError);
    }
})();
