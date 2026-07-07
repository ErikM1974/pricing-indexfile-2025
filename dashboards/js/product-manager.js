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

    const $ = (id) => document.getElementById(id);

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    document.addEventListener('DOMContentLoaded', function () {
        wire();
        loadProducts().catch(function (err) {
            console.error('[product-manager] load failed:', err);
            DashPage.showError('Unable to load products. Please refresh — or check the console.');
        });
    });

    async function loadProducts() {
        const data = await DashPage.fetchJson('/api/non-sanmar-products?active=all&refresh=true');
        products = (data && data.data) || [];
        renderStats();
        renderTable();
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
            <div class="pm-table-wrap">
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
                                : '<span class="pm-thumb pm-thumb-empty" title="No image"><i class="fas fa-image"></i></span>'}</td>
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
                                <button type="button" class="pm-btn pm-btn-ghost pm-edit" data-id="${escapeHtml(String(p.ID_Product))}"><i class="fas fa-pen"></i> Edit</button>
                                <a class="pm-btn pm-btn-ghost" href="/product.html?style=${encodeURIComponent(p.StyleNumber)}" target="_blank" rel="noopener" title="View in catalog"><i class="fas fa-eye"></i></a>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>
            </div>`;
    }

    /* ── Form ────────────────────────────────────────── */

    function openForm(product) {
        $('pmFormTitle').textContent = product ? `Edit ${product.StyleNumber}` : 'Add product';
        $('fId').value = product ? product.ID_Product : '';
        $('fStyle').value = product ? (product.StyleNumber || '') : '';
        $('fStyle').disabled = !!product;   // style number is the key — never edited
        $('fName').value = product ? (product.ProductName || '') : '';
        $('fBrand').value = product ? (product.Brand || '') : '';
        $('fCategory').value = product && product.Category ? product.Category : 'Other';
        $('fCost').value = product && parseFloat(product.DefaultCost) > 0 ? parseFloat(product.DefaultCost) : '';
        $('fPricingMethod').value = product && String(product.PricingMethod || '').toLowerCase().includes('fix') ? 'FixedPrice' : 'Margin';
        $('fSell').value = product && parseFloat(product.DefaultSellPrice) > 0 ? parseFloat(product.DefaultSellPrice) : '';
        $('fSizes').value = product ? (product.AvailableSizes || '') : '';
        $('fColors').value = product ? (product.DefaultColors || '') : '';
        $('fVendor').value = product ? (product.VendorCode || '') : '';
        $('fVendorUrl').value = product ? (product.VendorURL || '') : '';
        $('fImageUrl').value = product ? (product.ImageURL || '') : '';
        $('fImageFile').value = '';
        $('fNotes').value = product ? (product.Notes || '') : '';
        $('fActive').checked = product ? isActiveRow(product) : true;
        syncSellVisibility();
        syncImagePreview();
        $('pmFormCard').hidden = false;
        $('pmFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function closeForm() {
        $('pmFormCard').hidden = true;
    }

    function syncSellVisibility() {
        $('fSellWrap').hidden = $('fPricingMethod').value !== 'FixedPrice';
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
        DashPage.hideError();
        const saveBtn = $('pmSaveBtn');
        const original = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
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

            // Image: uploaded file wins over pasted URL
            let imageUrl = $('fImageUrl').value.trim();
            const file = $('fImageFile').files && $('fImageFile').files[0];
            if (file) {
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading image…';
                imageUrl = await uploadImage(file);
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
            }

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
                VendorCode: $('fVendor').value.trim(),
                VendorURL: $('fVendorUrl').value.trim(),
                ImageURL: imageUrl,
                Notes: $('fNotes').value.trim(),
                IsActive: $('fActive').checked
            };

            const id = $('fId').value;
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
            await loadProducts();
        } catch (err) {
            console.error('[product-manager] save failed:', err);
            DashPage.showError(err.message || 'Save failed — nothing was changed. Try again or check the console.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = original;
        }
    }

    /* ── Wiring ──────────────────────────────────────── */

    function wire() {
        $('pmAddBtn').addEventListener('click', () => openForm(null));
        $('pmFormClose').addEventListener('click', closeForm);
        $('pmForm').addEventListener('submit', saveProduct);
        $('fPricingMethod').addEventListener('change', syncSellVisibility);
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
