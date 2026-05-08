/**
 * jds-submit-form.js — AE JDS Vendor Product Art Request Submit Form
 *
 * Custom JS form for AEs to submit JDS Industries product art requests
 * (laser tumblers, mugs, awards, plaques, pens, leather patches…) to Steve.
 * Posts directly to /api/artrequests with Item_Type='JDS', JDS_SKU set, and
 * Item_Specs_Notes as a structured plain-text block.
 *
 * Picker flow:
 *   Categories grid → product grid → click → selected-product card sticky on top.
 *   Live JDS price/inventory loads via JDSApiService once selected.
 *
 * Catalog metadata (category, friendly name, imprint area, decoration default,
 * engrave color) lives in Caspio JDS_Catalog and is served by
 * /api/jds-catalog. Live JDS pricing/inventory lives at /api/jds/products/:sku.
 *
 * Usage: JDSSubmitForm.init('container-id')
 *
 * Depends on: app-config.js, customer-lookup-service.js, staff-auth-helper.js,
 *             jds-catalog-service.js, jds-api-service.js,
 *             (optional) emailjs SDK for Steve notification
 */
var JDSSubmitForm = (function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    var SITE_ORIGIN = 'https://www.teamnwca.com';
    var STEVE_EMAIL = 'art@nwcustomapparel.com';

    // ── State ──────────────────────────────────────────────────────────────
    var containerId = null;
    var catalogService = null;
    var apiService = null;
    var customerLookup = null;

    var view = 'categories';        // 'categories' | 'products' | 'variants' | 'form'
    var allCatalog = [];            // array of all active catalog rows
    var allCategories = [];         // [{category, count, sampleThumbnail}]
    var currentCategory = null;     // when in 'products' view
    var currentFamily = null;       // when in 'variants' view
    var searchQuery = '';

    var selectedRow = null;         // current JDS_Catalog row
    var liveProduct = null;         // live JDS API response (price, inventory)
    var liveError = null;           // string if live call failed (still allow submit)

    // SKU → thumbnail URL map. Catalog rows have ThumbnailURL blank by default
    // so the picker grid fetches live JDS thumbnails in one batch via
    // POST /api/jds/products on first catalog load. Module-level cache so
    // re-renders (back/forward navigation) don't refetch.
    var jdsThumbBySku = {};
    var jdsThumbsInflight = false;

    var referenceFiles = [];
    var selectedContact = null;
    var isRush = false;

    // ── Init ───────────────────────────────────────────────────────────────
    function init(containerIdParam) {
        containerId = containerIdParam;
        if (!catalogService && typeof JDSCatalogService !== 'undefined') {
            catalogService = new JDSCatalogService();
        }
        if (!apiService && typeof JDSApiService !== 'undefined') {
            apiService = new JDSApiService();
        }
        renderCategoriesView();
        loadCatalog();
    }

    function setItemType() { /* no-op — only one variant in v1 */ }
    function getItemType() { return 'JDS'; }

    // ── Catalog loading ────────────────────────────────────────────────────
    function loadCatalog() {
        if (!catalogService) {
            renderEmptyState('Catalog service unavailable. Refresh the page.');
            return;
        }
        Promise.all([
            catalogService.listCategories(),
            catalogService.listAll()
        ])
            .then(function (results) {
                allCategories = results[0] || [];
                allCatalog = results[1] || [];
                if (view === 'categories') renderCategoriesView();
                if (view === 'products') renderProductsView();

                // Kick off batch JDS thumbnail fetch for every SKU. Don't block
                // the initial render — pictures pop in once they arrive.
                var skus = allCatalog
                    .map(function (r) { return r && r.SKU; })
                    .filter(function (s) { return !!s; });
                if (skus.length) {
                    loadJdsThumbnailsForSkus(skus).then(rerenderCurrentView);
                }
            })
            .catch(function (err) {
                console.error('[JDSSubmitForm] Catalog load failed:', err);
                renderEmptyState('Failed to load JDS catalog: ' + (err.message || 'unknown error'));
            });
    }

    /**
     * Batch-fetch live JDS thumbnails for an array of SKUs, populating the
     * module-level jdsThumbBySku map. Hits POST /api/jds/products which is
     * already 1-hour cached server-side. Idempotent — safe to call repeatedly;
     * re-uses inflight promise if a fetch is already running.
     */
    var jdsThumbsPromise = null;
    function loadJdsThumbnailsForSkus(skus) {
        if (jdsThumbsPromise) return jdsThumbsPromise;
        if (!skus || !skus.length) return Promise.resolve(jdsThumbBySku);
        jdsThumbsInflight = true;
        jdsThumbsPromise = fetch(API_BASE + '/api/jds/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skus: skus })
        })
            .then(function (r) {
                if (!r.ok) throw new Error('JDS batch fetch ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var products = (data && data.result) || [];
                products.forEach(function (p) {
                    if (!p || !p.sku) return;
                    var thumb = (p.images && p.images.thumbnail) || p.thumbnail;
                    if (thumb && thumb !== 'unavailable') {
                        jdsThumbBySku[String(p.sku).toLowerCase()] = thumb;
                    }
                });
                jdsThumbsInflight = false;
                return jdsThumbBySku;
            })
            .catch(function (err) {
                console.warn('[JDSSubmitForm] Batch thumbnail fetch failed:', err);
                jdsThumbsInflight = false;
                jdsThumbsPromise = null; // allow retry on next render
                return jdsThumbBySku;
            });
        return jdsThumbsPromise;
    }

    /**
     * Resolve the best available thumbnail URL for a catalog row:
     * 1. Catalog ThumbnailURL override (if set)
     * 2. Live JDS API thumbnail from the cached batch fetch
     * 3. null (caller renders the empty placeholder)
     */
    function getThumbForRow(row) {
        if (!row) return null;
        if (row.ThumbnailURL) return row.ThumbnailURL;
        var sku = row.SKU && String(row.SKU).toLowerCase();
        return sku ? (jdsThumbBySku[sku] || null) : null;
    }

    /**
     * Re-render whichever view is currently mounted. Used after async events
     * (thumbnails arrive, catalog refresh) to pick up new state without
     * dropping any already-loaded data.
     *
     * Skips form view: re-rendering the form would lose the AE's typed input.
     * Instead, we update just the selected-card thumbnail in place.
     */
    function rerenderCurrentView() {
        if (view === 'categories') renderCategoriesView();
        else if (view === 'products') renderProductsView();
        else if (view === 'variants') renderVariantsView();
        else if (view === 'form' && selectedRow) updateSelectedThumb();
    }

    /**
     * Surgical update of just the .jds-selected-thumb img inside the form
     * view, preserving the AE's typed input. Pulls thumbnail from the row
     * cache (catalog override → live JDS batch → live single-product fetch).
     */
    function updateSelectedThumb() {
        if (!selectedRow) return;
        var wrap = document.querySelector('.jds-selected-thumb');
        if (!wrap) return;
        var src = getThumbForRow(selectedRow)
            || (liveProduct && liveProduct.images && liveProduct.images.thumbnail)
            || '';
        if (src && src !== 'unavailable') {
            wrap.innerHTML = '<img src="' + escapeHtml(src) + '" alt="">';
        }
    }

    // ── Render: Categories ─────────────────────────────────────────────────
    function renderCategoriesView() {
        view = 'categories';
        var container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = ''
            + '<div class="jds-container">'
            + '  <div class="jds-banner">'
            + '    <div class="jds-banner-emoji">\u{1F3AF}</div>'
            + '    <div class="jds-banner-text">'
            + '      <h3>JDS Product Art Request</h3>'
            + '      <p>Pick a JDS product, attach the artwork, and Steve will create the mockup.</p>'
            + '    </div>'
            + '  </div>'
            + '  <div class="jds-search-bar">'
            + '    <input type="text" class="jds-search-input" id="jds-search" placeholder="Search by SKU or name across all categories…" value="' + escapeHtml(searchQuery) + '">'
            + '  </div>'
            + '  <div class="jds-category-section" id="jds-category-section">'
            + '    <div class="jds-section-header">Browse by category</div>'
            + '    <div class="jds-category-grid" id="jds-category-grid"></div>'
            + '  </div>'
            + '  <div class="jds-search-results" id="jds-search-results" hidden>'
            + '    <div class="jds-section-header" id="jds-search-header">Search results</div>'
            + '    <div class="jds-product-grid" id="jds-search-grid"></div>'
            + '  </div>'
            + '</div>';

        renderCategoryGrid();
        wireSearchEvents();
        if (searchQuery) applySearchFilter();
    }

    function renderCategoryGrid() {
        var grid = document.getElementById('jds-category-grid');
        if (!grid) return;
        if (!allCategories.length) {
            grid.innerHTML = '<div class="jds-empty">No active products in catalog yet. Add SKUs in the JDS_Catalog Caspio table.</div>';
            return;
        }
        grid.innerHTML = allCategories.map(function (c) {
            // Sample thumbnail: server-provided (catalog ThumbnailURL override)
            // OR first matching SKU's live JDS thumbnail from the batch cache.
            var sample = c.sampleThumbnail;
            if (!sample) {
                var firstInCat = allCatalog.find(function (r) {
                    return String(r.Category || '').toLowerCase() === String(c.category || '').toLowerCase();
                });
                if (firstInCat) sample = getThumbForRow(firstInCat);
            }
            var thumb = sample
                ? '<img src="' + escapeHtml(sample) + '" alt="" loading="lazy">'
                : '<div class="jds-card-thumb-empty">\u{1F4E6}</div>';
            return ''
                + '<button type="button" class="jds-category-card" data-category="' + escapeHtml(c.category) + '">'
                + '  <div class="jds-card-thumb">' + thumb + '</div>'
                + '  <div class="jds-card-name">' + escapeHtml(c.category) + '</div>'
                + '  <div class="jds-card-count">' + c.count + ' product' + (c.count === 1 ? '' : 's') + '</div>'
                + '</button>';
        }).join('');

        grid.querySelectorAll('.jds-category-card').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var cat = btn.getAttribute('data-category');
                openCategory(cat);
            });
        });
    }

    function wireSearchEvents() {
        var input = document.getElementById('jds-search');
        if (!input) return;
        var t;
        input.addEventListener('input', function () {
            searchQuery = input.value;
            clearTimeout(t);
            t = setTimeout(applySearchFilter, 150);
        });
    }

    function applySearchFilter() {
        var sec = document.getElementById('jds-category-section');
        var res = document.getElementById('jds-search-results');
        var grid = document.getElementById('jds-search-grid');
        var hdr = document.getElementById('jds-search-header');
        if (!sec || !res || !grid || !hdr) return;

        var q = (searchQuery || '').trim().toLowerCase();
        if (!q) {
            sec.hidden = false;
            res.hidden = true;
            return;
        }
        sec.hidden = true;
        res.hidden = false;
        var matches = allCatalog.filter(function (r) {
            return String(r.SKU || '').toLowerCase().indexOf(q) !== -1
                || String(r.DisplayName || '').toLowerCase().indexOf(q) !== -1
                || String(r.Category || '').toLowerCase().indexOf(q) !== -1;
        });
        hdr.textContent = matches.length + ' result' + (matches.length === 1 ? '' : 's') + ' for "' + searchQuery + '"';
        grid.innerHTML = matches.map(buildProductCardHtml).join('');
        bindProductCardEvents(grid);
    }

    // ── Render: Products in a category ─────────────────────────────────────
    function openCategory(category) {
        currentCategory = category;
        view = 'products';
        renderProductsView();
    }

    /**
     * Group rows in a category by their `Family` field. NULL family = solo
     * (treated as its own single-row group).
     * Returns: [{family: string|null, rows: [...], thumbnail, displayName}]
     */
    function groupByFamily(rows) {
        var groups = [];
        var byFamily = {};
        rows.forEach(function (row) {
            var fam = row.Family && String(row.Family).trim() ? String(row.Family).trim() : null;
            if (!fam) {
                groups.push({ family: null, rows: [row] });
                return;
            }
            var key = fam.toLowerCase();
            if (!byFamily[key]) {
                var g = { family: fam, rows: [] };
                byFamily[key] = g;
                groups.push(g);
            }
            byFamily[key].rows.push(row);
        });
        // Pick a representative thumbnail + displayName for each family group.
        // Falls through getThumbForRow → catalog override → live JDS batch.
        groups.forEach(function (g) {
            var first = g.rows[0];
            g.thumbnail = getThumbForRow(first);
            g.displayName = first.DisplayName || first.SKU || '';
            // If family contains "X — Color" naming convention (em dash before
            // the color), strip the color suffix for the family-tile label.
            if (g.rows.length > 1) {
                var stripped = g.displayName.split(/\s+[—–-]\s+/)[0];
                if (stripped && stripped !== g.displayName) g.displayName = stripped;
            }
        });
        return groups;
    }

    function renderProductsView() {
        view = 'products';
        var container = document.getElementById(containerId);
        if (!container) return;

        var rows = allCatalog.filter(function (r) {
            return String(r.Category || '').toLowerCase() === String(currentCategory || '').toLowerCase();
        });
        var groups = groupByFamily(rows);

        container.innerHTML = ''
            + '<div class="jds-container">'
            + '  <div class="jds-breadcrumb">'
            + '    <button type="button" class="jds-link" id="jds-back-categories">← All categories</button>'
            + '    <span class="jds-breadcrumb-sep">/</span>'
            + '    <span class="jds-breadcrumb-current">' + escapeHtml(currentCategory) + '</span>'
            + '  </div>'
            + '  <div class="jds-section-header">' + escapeHtml(currentCategory) + ' &mdash; ' + groups.length + ' product' + (groups.length === 1 ? '' : 's') + '</div>'
            + '  <div class="jds-product-grid" id="jds-products-grid"></div>'
            + '</div>';

        var grid = document.getElementById('jds-products-grid');
        if (grid) {
            grid.innerHTML = groups.length
                ? groups.map(buildGroupCardHtml).join('')
                : '<div class="jds-empty">No products in this category.</div>';
            bindGroupCardEvents(grid);
        }

        var back = document.getElementById('jds-back-categories');
        if (back) back.addEventListener('click', function () { renderCategoriesView(); });
    }

    /**
     * Render a "group card" for the products grid:
     * - Family of 1 (solo SKU): renders like the old product card. data-sku set.
     * - Family of 2+: renders a family tile with a "<n> colors/variants" badge.
     *   data-family set; click drills into the variants view.
     */
    function buildGroupCardHtml(group) {
        var first = group.rows[0];
        var thumbSrc = group.thumbnail || getThumbForRow(first);
        var thumb = thumbSrc
            ? '<img src="' + escapeHtml(thumbSrc) + '" alt="" loading="lazy">'
            : '<div class="jds-card-thumb-empty">\u{1F4E6}</div>';

        if (group.rows.length === 1) {
            var imprint = first.ImprintArea
                ? '<div class="jds-card-imprint">' + escapeHtml(first.ImprintArea) + '</div>'
                : '';
            return ''
                + '<button type="button" class="jds-product-card" data-sku="' + escapeHtml(first.SKU) + '">'
                + '  <div class="jds-card-thumb">' + thumb + '</div>'
                + '  <div class="jds-card-body">'
                + '    <div class="jds-card-name">' + escapeHtml(first.DisplayName || first.SKU) + '</div>'
                + '    <div class="jds-card-sku">' + escapeHtml(first.SKU) + '</div>'
                + '    ' + imprint
                + '  </div>'
                + '</button>';
        }

        var imprintFam = first.ImprintArea
            ? '<div class="jds-card-imprint">' + escapeHtml(first.ImprintArea) + '</div>'
            : '';
        return ''
            + '<button type="button" class="jds-product-card jds-product-card--family" data-family="' + escapeHtml(group.family) + '">'
            + '  <div class="jds-card-thumb">' + thumb + '</div>'
            + '  <div class="jds-card-body">'
            + '    <div class="jds-card-name">' + escapeHtml(group.displayName) + '</div>'
            + '    <div class="jds-card-family-badge">' + group.rows.length + ' colors / variants</div>'
            + '    ' + imprintFam
            + '  </div>'
            + '</button>';
    }

    function bindGroupCardEvents(grid) {
        grid.querySelectorAll('.jds-product-card').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var sku = btn.getAttribute('data-sku');
                if (sku) {
                    selectProduct(sku);
                    return;
                }
                var fam = btn.getAttribute('data-family');
                if (fam) openFamily(fam);
            });
        });
    }

    /**
     * Re-used by the search-results path (which also renders single-product cards).
     * Search results don't collapse to families — every match is an individual SKU.
     */
    function buildProductCardHtml(row) {
        var thumbSrc = getThumbForRow(row);
        var thumb = thumbSrc
            ? '<img src="' + escapeHtml(thumbSrc) + '" alt="" loading="lazy">'
            : '<div class="jds-card-thumb-empty">\u{1F4E6}</div>';
        var imprint = row.ImprintArea
            ? '<div class="jds-card-imprint">' + escapeHtml(row.ImprintArea) + '</div>'
            : '';
        return ''
            + '<button type="button" class="jds-product-card" data-sku="' + escapeHtml(row.SKU) + '">'
            + '  <div class="jds-card-thumb">' + thumb + '</div>'
            + '  <div class="jds-card-body">'
            + '    <div class="jds-card-name">' + escapeHtml(row.DisplayName || row.SKU) + '</div>'
            + '    <div class="jds-card-sku">' + escapeHtml(row.SKU) + '</div>'
            + '    ' + imprint
            + '  </div>'
            + '</button>';
    }

    function bindProductCardEvents(grid) {
        grid.querySelectorAll('.jds-product-card').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var sku = btn.getAttribute('data-sku');
                if (sku) selectProduct(sku);
            });
        });
    }

    // ── Render: Variants in a family ───────────────────────────────────────
    function openFamily(family) {
        currentFamily = family;
        view = 'variants';
        renderVariantsView();
    }

    function renderVariantsView() {
        view = 'variants';
        var container = document.getElementById(containerId);
        if (!container) return;

        var rows = allCatalog.filter(function (r) {
            return String(r.Family || '').toLowerCase() === String(currentFamily || '').toLowerCase()
                && String(r.Category || '').toLowerCase() === String(currentCategory || '').toLowerCase();
        });
        // Family display name: first row's DisplayName with color suffix stripped.
        var familyLabel = rows[0] ? (rows[0].DisplayName || '').split(/\s+[—–-]\s+/)[0] : currentFamily;

        container.innerHTML = ''
            + '<div class="jds-container">'
            + '  <div class="jds-breadcrumb">'
            + '    <button type="button" class="jds-link" id="jds-back-categories">← All categories</button>'
            + '    <span class="jds-breadcrumb-sep">/</span>'
            + '    <button type="button" class="jds-link" id="jds-back-products">' + escapeHtml(currentCategory) + '</button>'
            + '    <span class="jds-breadcrumb-sep">/</span>'
            + '    <span class="jds-breadcrumb-current">' + escapeHtml(familyLabel || currentFamily) + '</span>'
            + '  </div>'
            + '  <div class="jds-section-header">Pick a color / variant &mdash; ' + rows.length + ' option' + (rows.length === 1 ? '' : 's') + '</div>'
            + '  <div class="jds-product-grid" id="jds-variants-grid"></div>'
            + '</div>';

        var grid = document.getElementById('jds-variants-grid');
        if (grid) {
            grid.innerHTML = rows.length
                ? rows.map(buildVariantCardHtml).join('')
                : '<div class="jds-empty">No variants in this family.</div>';
            bindProductCardEvents(grid);
        }

        var back = document.getElementById('jds-back-categories');
        if (back) back.addEventListener('click', function () { renderCategoriesView(); });
        var back2 = document.getElementById('jds-back-products');
        if (back2) back2.addEventListener('click', function () { renderProductsView(); });
    }

    /**
     * Variant card — emphasizes the color/variant suffix from DisplayName.
     * Same click target shape as the solo product card (data-sku).
     */
    function buildVariantCardHtml(row) {
        var thumbSrc = getThumbForRow(row);
        var thumb = thumbSrc
            ? '<img src="' + escapeHtml(thumbSrc) + '" alt="" loading="lazy">'
            : '<div class="jds-card-thumb-empty">\u{1F4E6}</div>';
        // If DisplayName has " — Color" suffix, isolate the color for emphasis.
        var name = row.DisplayName || row.SKU || '';
        var parts = name.split(/\s+[—–-]\s+/);
        var variant = parts.length > 1 ? parts[parts.length - 1] : name;
        return ''
            + '<button type="button" class="jds-product-card" data-sku="' + escapeHtml(row.SKU) + '">'
            + '  <div class="jds-card-thumb">' + thumb + '</div>'
            + '  <div class="jds-card-body">'
            + '    <div class="jds-card-name">' + escapeHtml(variant) + '</div>'
            + '    <div class="jds-card-sku">' + escapeHtml(row.SKU) + '</div>'
            + '  </div>'
            + '</button>';
    }

    // ── Select product → form view ─────────────────────────────────────────
    function selectProduct(sku) {
        var row = allCatalog.find(function (r) { return String(r.SKU || '').toLowerCase() === String(sku || '').toLowerCase(); });
        if (!row) return;
        selectedRow = row;
        liveProduct = null;
        liveError = null;
        // Track the family path so "Change product" returns to the right view.
        currentFamily = row.Family && String(row.Family).trim() ? String(row.Family).trim() : null;
        if (row.Category) currentCategory = row.Category;
        renderFormView();
        loadLiveProduct(sku);
    }

    function loadLiveProduct(sku) {
        if (!apiService) return;
        apiService.getProduct(sku)
            .then(function (product) {
                liveProduct = product || null;
                liveError = null;
                // Cache the live thumbnail so subsequent navigations skip the
                // single-product fetch (and any other view that renders this
                // SKU's card gets the image).
                if (product && product.images && product.images.thumbnail
                    && product.images.thumbnail !== 'unavailable'
                    && product.sku) {
                    jdsThumbBySku[String(product.sku).toLowerCase()] = product.images.thumbnail;
                }
                updateLiveBlock();
                updateSelectedThumb();
            })
            .catch(function (err) {
                console.warn('[JDSSubmitForm] Live JDS fetch failed for', sku, err);
                liveProduct = null;
                liveError = err.message || 'Live pricing unavailable';
                updateLiveBlock();
            });
    }

    // ── Render: Form view ──────────────────────────────────────────────────
    function renderFormView() {
        view = 'form';
        var container = document.getElementById(containerId);
        if (!container || !selectedRow) return;

        var row = selectedRow;
        var thumbSrc = getThumbForRow(row)
            || (liveProduct && liveProduct.images && liveProduct.images.thumbnail)
            || '';

        // Breadcrumb — insert a Family step if this SKU belongs to a multi-row family.
        var familyCrumb = '';
        if (currentFamily) {
            var familyLabel = (row.DisplayName || '').split(/\s+[—–-]\s+/)[0] || currentFamily;
            familyCrumb = ''
                + '    <button type="button" class="jds-link" id="jds-back-variants">' + escapeHtml(familyLabel) + '</button>'
                + '    <span class="jds-breadcrumb-sep">/</span>';
        }

        container.innerHTML = ''
            + '<div class="jds-container">'
            + '  <div class="jds-breadcrumb">'
            + '    <button type="button" class="jds-link" id="jds-back-categories">← All categories</button>'
            + '    <span class="jds-breadcrumb-sep">/</span>'
            + '    <button type="button" class="jds-link" id="jds-back-products">' + escapeHtml(row.Category || '') + '</button>'
            + '    <span class="jds-breadcrumb-sep">/</span>'
            +      familyCrumb
            + '    <span class="jds-breadcrumb-current">' + escapeHtml(row.SKU) + '</span>'
            + '  </div>'

            // Selected-product card
            + '  <div class="jds-selected-card">'
            + '    <div class="jds-selected-thumb">'
            +        (thumbSrc
                        ? '<img src="' + escapeHtml(thumbSrc) + '" alt="">'
                        : '<div class="jds-card-thumb-empty">\u{1F4E6}</div>')
            + '    </div>'
            + '    <div class="jds-selected-body">'
            + '      <div class="jds-selected-cat">' + escapeHtml(row.Category || '') + '</div>'
            + '      <div class="jds-selected-name">' + escapeHtml(row.DisplayName || row.SKU) + '</div>'
            + '      <div class="jds-selected-sku">SKU <strong>' + escapeHtml(row.SKU) + '</strong></div>'
            +        (row.ImprintArea
                        ? '<div class="jds-selected-imprint"><strong>Imprint:</strong> ' + escapeHtml(row.ImprintArea) + '</div>'
                        : '')
            + '      <div class="jds-live-block" id="jds-live-block">'
            + '        <div class="jds-live-loading">Loading live pricing &amp; inventory…</div>'
            + '      </div>'
            + '      <button type="button" class="jds-link jds-change-btn" id="jds-change-product">Change product</button>'
            + '    </div>'
            + '  </div>'

            // Form
            + '  <div class="jds-form-card">'
            + '    <div class="jds-form-header">Art Request Details</div>'
            + '    <div class="jds-form-body" id="jds-form-body">'

            //   Company + Sales Rep
            + '      <div class="jds-row">'
            + '        <div class="jds-field">'
            + '          <label class="jds-field-label">Company Name <span class="jds-required">*</span></label>'
            + '          <input type="text" class="jds-input" id="jds-company" placeholder="Type 3+ letters to search customers..." autocomplete="off">'
            + '          <span class="jds-field-hint">Type to search. Pick from the dropdown to auto-fill contact + email.</span>'
            + '          <span class="jds-error-msg" id="jds-company-error">Company name is required</span>'
            + '        </div>'
            + '        <div class="jds-field">'
            + '          <label class="jds-field-label">Sales Rep</label>'
            //   Canonical 9-option list — matches all 4 quote builders
            //   (dtg/dtf/emb/scp). Defaults to logged-in user via StaffAuthHelper.
            //   Submit logic reads option.text (display name) not value (email)
            //   so Sales_Rep column stays consistent with existing rows.
            + '          <select class="jds-input" id="jds-sales-rep">'
            + '            <option value="sales@nwcustomapparel.com">General Sales</option>'
            + '            <option value="adriyella@nwcustomapparel.com">Adriyella</option>'
            + '            <option value="bradley@nwcustomapparel.com">Bradley Wright</option>'
            + '            <option value="erik@nwcustomapparel.com">Erik Mickelson</option>'
            + '            <option value="jim@nwcustomapparel.com">Jim Mickelson</option>'
            + '            <option value="nika@nwcustomapparel.com">Nika Lao</option>'
            + '            <option value="ruth@nwcustomapparel.com">Ruth Nhong</option>'
            + '            <option value="art@nwcustomapparel.com">Steve Deland</option>'
            + '            <option value="taneisha@nwcustomapparel.com">Taneisha Clark</option>'
            + '          </select>'
            + '        </div>'
            + '      </div>'
            + '      <input type="hidden" id="jds-customer-id">'

            //   Contact
            + '      <div class="jds-row">'
            + '        <div class="jds-field">'
            + '          <label class="jds-field-label">Contact Name</label>'
            + '          <input type="text" class="jds-input" id="jds-contact-name" placeholder="First Last">'
            + '        </div>'
            + '        <div class="jds-field">'
            + '          <label class="jds-field-label">Contact Email</label>'
            + '          <input type="email" class="jds-input" id="jds-contact-email" placeholder="customer@email.com">'
            + '        </div>'
            + '      </div>'

            //   Design name + Due date
            + '      <div class="jds-row">'
            + '        <div class="jds-field">'
            + '          <label class="jds-field-label">Design Name <span class="jds-required">*</span></label>'
            + '          <input type="text" class="jds-input" id="jds-design-name" placeholder="e.g. Lincoln Lynx Logo Engrave">'
            + '          <span class="jds-error-msg" id="jds-design-name-error">Design name is required</span>'
            + '        </div>'
            + '        <div class="jds-field">'
            + '          <label class="jds-field-label">Due Date</label>'
            + '          <input type="date" class="jds-input" id="jds-due-date">'
            + '        </div>'
            + '      </div>'

            //   Decoration spec block
            + '      <div class="jds-section-header">Decoration Spec</div>'
            + '      <div class="jds-row">'
            + '        <div class="jds-field">'
            + '          <label class="jds-field-label">Decoration Method <span class="jds-required">*</span></label>'
            + '          <select class="jds-select" id="jds-decoration">'
            + '            <option value="Laser Engrave"' + selOpt(row.DefaultDecoration, 'Laser Engrave') + '>Laser Engrave</option>'
            + '            <option value="UV Print"' + selOpt(row.DefaultDecoration, 'UV Print') + '>UV Print</option>'
            + '            <option value="Sublimation"' + selOpt(row.DefaultDecoration, 'Sublimation') + '>Sublimation</option>'
            + '            <option value="4-Color Print"' + selOpt(row.DefaultDecoration, '4-Color Print') + '>4-Color Print</option>'
            + '            <option value="Sand Carve"' + selOpt(row.DefaultDecoration, 'Sand Carve') + '>Sand Carve</option>'
            + '          </select>'
            + '        </div>'
            + '        <div class="jds-field">'
            + '          <label class="jds-field-label">Engrave / Print Color</label>'
            + '          <input type="text" class="jds-input" id="jds-engrave-color" placeholder="e.g. Silver on Black" value="' + escapeHtml(row.EngraveColor || '') + '">'
            + '        </div>'
            + '      </div>'
            + '      <div class="jds-field">'
            + '        <label class="jds-field-label">Imprint Placement</label>'
            + '        <textarea class="jds-textarea" id="jds-imprint-placement" placeholder="Where on the product? Describe size, position, orientation…">' + escapeHtml(row.ImprintArea || '') + '</textarea>'
            + '        <span class="jds-field-hint">Pre-filled from catalog. AE can adjust per job.</span>'
            + '      </div>'

            //   Quantity + Work Order
            + '      <div class="jds-row">'
            + '        <div class="jds-field">'
            + '          <label class="jds-field-label">Estimated Quantity</label>'
            + '          <input type="number" class="jds-input" id="jds-quantity" placeholder="e.g. 144" min="1" step="1">'
            + '          <span class="jds-field-hint">Drives the live tier display in the summary card.</span>'
            + '        </div>'
            + '        <div class="jds-field">'
            + '          <label class="jds-field-label">Work Order # (optional)</label>'
            + '          <input type="text" class="jds-input" id="jds-work-order" placeholder="ShopWorks order #">'
            + '        </div>'
            + '      </div>'

            //   Instructions
            + '      <div class="jds-field">'
            + '        <label class="jds-field-label">Additional Instructions for Steve</label>'
            + '        <textarea class="jds-textarea" id="jds-instructions" placeholder="Anything else Steve should know..."></textarea>'
            + '      </div>'

            //   File upload tip
            + '      <div class="jds-tip">'
            + '        <span class="jds-tip-icon">\u{1F4A1}</span>'
            + '        Vector art preferred (.AI, .EPS, .PDF). Raster files should be 300 DPI minimum. '
            + '        For files larger than 20MB, upload to Box and paste the link in instructions.'
            + '      </div>'

            //   File upload
            + '      <div class="jds-field">'
            + '        <label class="jds-field-label">Reference Files (logo, sketches, photos)</label>'
            + '        <div class="jds-file-drop" id="jds-file-drop">'
            + '          <div class="jds-file-drop-icon">\u{1F4CE}</div>'
            + '          <div>Click to upload or drag &amp; drop</div>'
            + '          <div class="jds-file-drop-hint">.AI, .EPS, .PDF, .PNG, .JPG, .SVG &mdash; max 4 files, 20MB each</div>'
            + '        </div>'
            + '        <input type="file" id="jds-file-input" style="display:none;" accept="image/*,.pdf,.eps,.ai,.svg" multiple>'
            + '        <div id="jds-file-preview-area"></div>'
            + '      </div>'

            //   Rush + Submit
            + '      <div class="jds-rush-row">'
            + '        <button type="button" class="jds-rush-toggle" id="jds-rush-toggle" aria-pressed="false">'
            + '          <span class="jds-rush-icon">\u{1F525}</span>'
            + '          <span class="jds-rush-label">Rush Order</span>'
            + '          <span class="jds-rush-hint">Tick if Steve needs this ASAP</span>'
            + '        </button>'
            + '      </div>'
            + '      <div class="jds-submit-row">'
            + '        <button type="button" class="jds-submit-btn" id="jds-submit-btn">Submit JDS Request</button>'
            + '        <span class="jds-submit-status" id="jds-submit-status"></span>'
            + '      </div>'

            + '    </div>'
            + '  </div>'
            + '</div>';

        wireFormEvents();
        initCompanyAutocomplete();
        initSalesRep();
        updateLiveBlock();
    }

    function selOpt(actual, candidate) {
        return (actual && String(actual).toLowerCase() === String(candidate).toLowerCase()) ? ' selected' : '';
    }

    function updateLiveBlock() {
        var block = document.getElementById('jds-live-block');
        if (!block) return;
        if (liveError) {
            block.innerHTML = ''
                + '<div class="jds-live-warn">'
                + '  ⚠️ Live JDS pricing unavailable — submission still works, Steve gets the SKU + your notes.'
                + '</div>';
            return;
        }
        if (!liveProduct) {
            block.innerHTML = '<div class="jds-live-loading">Loading live pricing &amp; inventory…</div>';
            return;
        }
        var p = liveProduct;
        var caseQty = p.caseQuantity || 0;
        var inStock = (p.availableQuantity || 0) > 0;
        var stockLine = inStock
            ? 'In stock — ' + Number(p.availableQuantity).toLocaleString() + ' at JDS' + (p.localQuantity ? ' (' + Number(p.localQuantity).toLocaleString() + ' local)' : '')
            : '<span class="jds-out">Out of stock at JDS</span>';

        var tiers = [
            { label: '< ' + caseQty + ' (small)', price: p.lessThanCasePrice },
            { label: caseQty + ' (1 case)', price: p.oneCase },
            { label: (caseQty * 5) + ' (5 cases)', price: p.fiveCases },
            { label: (caseQty * 10) + ' (10 cases)', price: p.tenCases },
            { label: (caseQty * 20) + '+ (20+ cases)', price: p.twentyCases }
        ];
        var tiersHtml = tiers.map(function (t) {
            var price = (typeof t.price === 'number') ? '$' + t.price.toFixed(2) : '—';
            return '<tr><td>' + escapeHtml(t.label) + '</td><td>' + price + '</td></tr>';
        }).join('');

        block.innerHTML = ''
            + '<div class="jds-live-stock">' + stockLine + '</div>'
            + '<table class="jds-live-tier-table">'
            + '  <thead><tr><th>Qty</th><th>JDS wholesale / ea</th></tr></thead>'
            + '  <tbody>' + tiersHtml + '</tbody>'
            + '</table>';
    }

    // ── Wire form events ───────────────────────────────────────────────────
    function wireFormEvents() {
        var back1 = document.getElementById('jds-back-categories');
        if (back1) back1.addEventListener('click', function () { renderCategoriesView(); });
        var back2 = document.getElementById('jds-back-products');
        if (back2) back2.addEventListener('click', function () { renderProductsView(); });
        var backVariants = document.getElementById('jds-back-variants');
        if (backVariants) backVariants.addEventListener('click', function () { renderVariantsView(); });
        var change = document.getElementById('jds-change-product');
        if (change) change.addEventListener('click', function () {
            // Family path → back to variant picker; solo SKU → back to category grid
            if (currentFamily) renderVariantsView();
            else renderProductsView();
        });

        // File upload
        var fileDrop = document.getElementById('jds-file-drop');
        var fileInput = document.getElementById('jds-file-input');
        if (fileDrop && fileInput) {
            fileDrop.addEventListener('click', function () { fileInput.click(); });
            fileInput.addEventListener('change', function () {
                if (fileInput.files.length > 0) addReferenceFiles(fileInput.files);
            });
            fileDrop.addEventListener('dragover', function (e) {
                e.preventDefault();
                fileDrop.classList.add('jds-file-drop--active');
            });
            fileDrop.addEventListener('dragleave', function () {
                fileDrop.classList.remove('jds-file-drop--active');
            });
            fileDrop.addEventListener('drop', function (e) {
                e.preventDefault();
                fileDrop.classList.remove('jds-file-drop--active');
                if (e.dataTransfer.files.length > 0) addReferenceFiles(e.dataTransfer.files);
            });
        }

        // Rush toggle
        var rushBtn = document.getElementById('jds-rush-toggle');
        if (rushBtn) {
            rushBtn.addEventListener('click', function () {
                isRush = !isRush;
                rushBtn.classList.toggle('jds-rush-toggle--active', isRush);
                rushBtn.setAttribute('aria-pressed', isRush ? 'true' : 'false');
            });
        }

        // Submit
        var submitBtn = document.getElementById('jds-submit-btn');
        if (submitBtn) submitBtn.addEventListener('click', handleSubmit);
    }

    // ── Company autocomplete ────────────────────────────────────────────────
    function initCompanyAutocomplete() {
        if (typeof CustomerLookupService === 'undefined') return;
        customerLookup = new CustomerLookupService({ maxResults: 10 });
        customerLookup.bindToInput('jds-company', {
            onSelect: function (contact) {
                // CustomerLookupService passes contacts in the legacy response
                // shape from /api/company-contacts/search:
                //   ct_NameFull            (e.g. "Bob Rowe")
                //   ContactNumbersEmail    (e.g. "rrowe@wesleyhomes.org")
                //   id_Customer / CustomerCompanyName
                // Auto-fill skips empty contact fields only — if the AE has
                // already typed something, we don't clobber their input.
                selectedContact = contact;
                document.getElementById('jds-customer-id').value = contact.id_Customer || '';
                document.getElementById('jds-company').classList.remove('jds-error');
                document.getElementById('jds-company-error').style.display = 'none';
                var nameEl = document.getElementById('jds-contact-name');
                var emailEl = document.getElementById('jds-contact-email');
                if (contact.ct_NameFull && nameEl && !nameEl.value) {
                    nameEl.value = contact.ct_NameFull;
                }
                if (contact.ContactNumbersEmail && emailEl && !emailEl.value) {
                    emailEl.value = contact.ContactNumbersEmail;
                }
            },
            onClear: function () {
                selectedContact = null;
                document.getElementById('jds-customer-id').value = '';
            }
        });
    }

    function initSalesRep() {
        // Sales Rep is a <select> dropdown (matches all 4 quote builders).
        // StaffAuthHelper.autoSelectSalesRep matches by email value, falling
        // back to email-from-name lookup via STAFF_EMAIL_MAP. If no login
        // session exists, dropdown defaults to first option ("General Sales").
        if (typeof StaffAuthHelper !== 'undefined' && StaffAuthHelper.isLoggedIn) {
            try {
                StaffAuthHelper.autoSelectSalesRep('jds-sales-rep');
            } catch (_e) { /* no-op — first option remains selected */ }
        }
    }

    // ── File handling ──────────────────────────────────────────────────────
    function addReferenceFiles(fileList) {
        var allowed = 4 - referenceFiles.length;
        for (var i = 0; i < fileList.length && i < allowed; i++) {
            var f = fileList[i];
            if (f.size > 20 * 1024 * 1024) {
                showToast('"' + f.name + '" is over 20MB and was skipped.', 'error');
                continue;
            }
            referenceFiles.push(f);
        }
        renderFilePreviews();
    }

    function renderFilePreviews() {
        var area = document.getElementById('jds-file-preview-area');
        if (!area) return;
        if (referenceFiles.length === 0) { area.innerHTML = ''; return; }
        var html = '<div class="jds-file-list">';
        referenceFiles.forEach(function (f, idx) {
            html += '<div class="jds-file-item">'
                + '<span class="jds-file-name">' + escapeHtml(f.name) + '</span>'
                + '<span class="jds-file-size">' + formatFileSize(f.size) + '</span>'
                + '<button type="button" class="jds-file-remove" data-idx="' + idx + '" title="Remove">×</button>'
                + '</div>';
        });
        html += '</div>';
        area.innerHTML = html;
        area.querySelectorAll('.jds-file-remove').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var i = parseInt(btn.getAttribute('data-idx'));
                referenceFiles.splice(i, 1);
                renderFilePreviews();
            });
        });
    }

    // ── Validation ─────────────────────────────────────────────────────────
    function validate() {
        var valid = true;
        var company = document.getElementById('jds-company').value.trim();
        if (!company) {
            document.getElementById('jds-company').classList.add('jds-error');
            document.getElementById('jds-company-error').style.display = 'block';
            valid = false;
        } else {
            document.getElementById('jds-company').classList.remove('jds-error');
            document.getElementById('jds-company-error').style.display = 'none';
        }
        var designName = document.getElementById('jds-design-name').value.trim();
        if (!designName) {
            document.getElementById('jds-design-name').classList.add('jds-error');
            document.getElementById('jds-design-name-error').style.display = 'block';
            valid = false;
        } else {
            document.getElementById('jds-design-name').classList.remove('jds-error');
            document.getElementById('jds-design-name-error').style.display = 'none';
        }
        return valid;
    }

    // ── Build Item_Specs_Notes block ───────────────────────────────────────
    function buildItemSpecsNotes() {
        var lines = ['JDS PRODUCT REQUEST'];
        push(lines, 'SKU', selectedRow && selectedRow.SKU);
        push(lines, 'Product', selectedRow && selectedRow.DisplayName);
        push(lines, 'Category', selectedRow && selectedRow.Category);
        push(lines, 'Decoration', getVal('jds-decoration'));
        push(lines, 'Imprint Area (catalog)', selectedRow && selectedRow.ImprintArea);
        var placement = getVal('jds-imprint-placement');
        if (placement && placement !== (selectedRow && selectedRow.ImprintArea)) {
            push(lines, 'Imprint Placement', placement);
        }
        push(lines, 'Engrave/Print Color', getVal('jds-engrave-color'));
        push(lines, 'Estimated Quantity', getVal('jds-quantity'));
        if (liveProduct && liveProduct.caseQuantity && typeof liveProduct.oneCase === 'number') {
            lines.push('JDS Case Price (live): $' + liveProduct.oneCase.toFixed(2) + '/ea @ ' + liveProduct.caseQuantity + ' (1 case)');
        }
        if (liveProduct && typeof liveProduct.availableQuantity === 'number') {
            var stockText = liveProduct.availableQuantity > 0
                ? 'In stock — ' + liveProduct.availableQuantity.toLocaleString() + ' ea'
                : 'Out of stock at JDS';
            lines.push('JDS Inventory (live): ' + stockText);
        }
        return lines.join('\n');
    }

    function push(lines, label, value) {
        if (value && String(value).trim()) lines.push(label + ': ' + String(value).trim());
    }

    function getVal(id) {
        var el = document.getElementById(id);
        return el ? (el.value || '').trim() : '';
    }

    // ── Submit ─────────────────────────────────────────────────────────────
    function handleSubmit() {
        if (!selectedRow) {
            showToast('Pick a JDS product first.', 'error');
            return;
        }
        if (!validate()) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        var btn = document.getElementById('jds-submit-btn');
        var statusEl = document.getElementById('jds-submit-status');
        btn.disabled = true;
        statusEl.textContent = 'Uploading files...';

        var companyName = getVal('jds-company');
        var designName = getVal('jds-design-name');
        var dueDate = document.getElementById('jds-due-date').value || null;
        var contactName = getVal('jds-contact-name');
        var contactEmail = getVal('jds-contact-email');
        var instructions = getVal('jds-instructions');
        var workOrder = getVal('jds-work-order');
        var customerId = parseInt(document.getElementById('jds-customer-id').value) || 0;
        var aeName = getSubmitterName();
        var aeEmail = getSubmitterEmail();
        // Sales Rep dropdown: option.value is email, option.text is display
        // name. Sales_Rep column stores display names (matches existing rows
        // + what art-hub-steve-gallery getRepFirstName() expects).
        var repSel = document.getElementById('jds-sales-rep');
        var salesRep = (repSel && repSel.selectedIndex >= 0)
            ? repSel.options[repSel.selectedIndex].text
            : aeName;

        var firstName = '';
        var lastName = '';
        if (contactName) {
            var parts = contactName.split(/\s+/);
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ');
        }

        uploadFilesSequentially()
            .then(function (upload) {
                // Abort the submission if ANY attached file failed to upload.
                // Creating the art request anyway would silently strand the
                // AE's artwork (Steve sees a request with empty file slots
                // and no idea something was attempted). Better to fail fast
                // and let the AE retry — their typed input is preserved
                // because we don't re-render the form view.
                if (upload.failedFiles && upload.failedFiles.length > 0) {
                    var msg = upload.failedFiles.length === 1
                        ? 'Could not upload "' + upload.failedFiles[0] + '" — please retry'
                        : 'Could not upload ' + upload.failedFiles.length + ' files (' + upload.failedFiles.join(', ') + ') — please retry';
                    var err = new Error(msg);
                    err.code = 'UPLOAD_FAILED';
                    throw err;
                }
                var uploaded = upload.results;

                statusEl.textContent = 'Creating request...';

                // Design name has no dedicated column on ArtRequests — fold it
                // into Item_Specs_Notes so Steve sees it. Posting Design_Name
                // returns 404 FieldNotFound from Caspio.
                var notes = buildItemSpecsNotes();
                if (designName) {
                    notes = 'Design Name: ' + designName + '\n\n' + notes;
                }
                if (instructions) {
                    notes = notes + '\n\nAE Instructions:\n' + instructions;
                }

                // Order_Type = Decoration Method on JDS records — Steve sees
                // the decoration at a glance in Request Info on the detail
                // page without opening the Specs card. Fall back to 'JDS'
                // if somehow blank (validation should keep this from being
                // empty since Decoration Method is a required field).
                var decoration = getVal('jds-decoration');

                // Quantity is a Number column on Caspio — empty string would
                // 400 the POST. Send null when blank so Caspio stores NULL.
                var quantityRaw = getVal('jds-quantity');
                var quantityVal = quantityRaw ? (parseInt(quantityRaw, 10) || null) : null;

                var payload = {
                    CompanyName: companyName,
                    Status: 'Submitted',
                    Item_Type: 'JDS',
                    JDS_SKU: selectedRow.SKU,
                    Order_Type: decoration || 'JDS',
                    // Dedicated JDS spec columns added to Caspio 2026-05-08.
                    // The detail page renders these as labeled rows in the
                    // JDS Product Specs card (build JDS spec rows helper).
                    // Item_Specs_Notes is still built and sent below as a
                    // backstop / human-readable single-pane view.
                    JDS_Design_Name: designName || '',
                    JDS_Color: getVal('jds-engrave-color'),
                    JDS_Placement: getVal('jds-imprint-placement'),
                    JDS_Quantity: quantityVal,
                    Item_Specs_Notes: notes,
                    NOTES: instructions || '',
                    Due_Date: dueDate,
                    First_name: firstName,
                    Last_name: lastName,
                    Email_Contact: contactEmail,
                    Sales_Rep: salesRep,
                    User_Email: aeEmail,
                    Mockup: 'Yes',
                    Is_Rush: !!isRush,
                    Revision_Count: 0
                };

                if (customerId > 0) {
                    payload.id_Customer = customerId;
                    // CompanyContactsMerge2026.id_Customer comes from the
                    // ManageOrders/ShopWorks sync, so the same value goes to
                    // Shopwork_customer_number — that's what the dashboard's
                    // ShopWorks References card reads for Customer #.
                    payload.Shopwork_customer_number = String(customerId);
                }
                if (workOrder) payload.Order_Num_SW = workOrder;

                var slots = ['File_Upload_One', 'File_Upload_Two', 'File_Upload_Three', 'File_Upload_Four'];
                uploaded.forEach(function (u, i) {
                    if (i < slots.length && u && u.fileName) {
                        payload[slots[i]] = '/Artwork/' + u.fileName;
                    }
                });

                return fetch(API_BASE + '/api/artrequests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            })
            .then(function (resp) {
                if (!resp.ok) throw new Error('Failed to create art request (' + resp.status + ')');
                return resp.json();
            })
            .then(function (result) {
                // Backend returns the post-create record at result.record
                // (canonical, since v2026.05.08.5). Fall back to the legacy
                // result.request.Result[0] shape just in case the form is
                // running against an older proxy version.
                var record = (result && result.record)
                    || (result && result.request && result.request.Result && result.request.Result[0])
                    || null;
                var designId = record && (record.ID_Design || record.PK_ID);
                statusEl.textContent = 'Notifying Steve...';
                sendNotificationEmails(designId, companyName, designName, aeName, aeEmail);
                showSuccess(designId, companyName);
            })
            .catch(function (err) {
                console.error('[JDSSubmitForm] Submit error:', err);
                btn.disabled = false;
                statusEl.textContent = '';
                // Upload failures already have a complete user-facing message
                // ("Could not upload …"). Don't double-up with a "Submission
                // failed:" prefix that misleads the AE into thinking the art
                // request was created when it wasn't.
                var toastMsg = (err && err.code === 'UPLOAD_FAILED')
                    ? err.message
                    : 'Submission failed: ' + err.message;
                showToast(toastMsg, 'error');
            });
    }

    /**
     * Upload reference files one-by-one to /api/files/upload. Resolves to
     * { results, failedFiles } where failedFiles is the list of File.name
     * values that didn't make it. The caller (handleSubmit) aborts the whole
     * submission if anything failed — we'd rather have the AE retry than
     * create an art request with missing artwork (which is what was happening
     * before this guard: silent upload failures, "Submitted!" toast, Steve
     * sees a request with no files).
     */
    function uploadFilesSequentially() {
        if (referenceFiles.length === 0) {
            return Promise.resolve({ results: [], failedFiles: [] });
        }
        var results = [];
        var failedFiles = [];
        var statusEl = document.getElementById('jds-submit-status');

        function uploadNext(idx) {
            if (idx >= referenceFiles.length) {
                return Promise.resolve({ results: results, failedFiles: failedFiles });
            }
            var f = referenceFiles[idx];
            if (statusEl) statusEl.textContent = 'Uploading file ' + (idx + 1) + ' of ' + referenceFiles.length + '...';
            var fd = new FormData();
            fd.append('file', f);
            return fetch(API_BASE + '/api/files/upload', { method: 'POST', body: fd })
                .then(function (r) {
                    if (!r.ok) {
                        return r.text().then(function (body) {
                            console.warn('Upload failed for ' + f.name + ':', r.status, body);
                            results.push(null);
                            failedFiles.push(f.name);
                        });
                    }
                    return r.json().then(function (data) {
                        if (data && data.success) {
                            results.push({ fileName: data.fileName, externalKey: data.externalKey });
                        } else {
                            // 200 OK but server reported a logical failure
                            // (e.g. { success: false, error: '...' }).
                            console.warn('Upload reported failure for ' + f.name + ':', data && data.error);
                            results.push(null);
                            failedFiles.push(f.name);
                        }
                    });
                })
                .catch(function (err) {
                    console.warn('Upload error for ' + f.name + ':', err);
                    results.push(null);
                    failedFiles.push(f.name);
                })
                .then(function () { return uploadNext(idx + 1); });
        }
        return uploadNext(0);
    }

    function sendNotificationEmails(designId, companyName, designName, aeName, aeEmail) {
        if (typeof emailjs === 'undefined') return;
        try {
            emailjs.init('4qSbDO-SQs19TbP80');
            var detailLink = SITE_ORIGIN + '/mockup/' + (designId || '');
            var skuFragment = selectedRow ? ' [' + selectedRow.SKU + ']' : '';
            emailjs.send('service_jgrave3', 'template_art_note_added', {
                to_email: STEVE_EMAIL,
                to_name: 'Steve',
                design_id: designId || 'NEW',
                company_name: companyName,
                note_text: 'New JDS Art Request' + skuFragment + ' from ' + aeName + ' for ' + companyName + ' — "' + designName + '"',
                note_type: 'New JDS Submission',
                detail_link: detailLink,
                from_name: aeName
            }).catch(function () {});

            if (aeEmail && aeEmail !== STEVE_EMAIL) {
                emailjs.send('service_jgrave3', 'template_art_note_added', {
                    to_email: aeEmail,
                    to_name: aeName,
                    design_id: designId || 'NEW',
                    company_name: companyName,
                    note_text: 'Your JDS art request' + skuFragment + ' for ' + companyName + ' ("' + designName + '") was submitted to Steve.',
                    note_type: 'Submission Confirmation',
                    detail_link: detailLink + '?view=ae',
                    from_name: 'NWCA Art Department'
                }).catch(function () {});
            }
        } catch (e) {
            console.warn('[JDSSubmitForm] EmailJS failed:', e);
        }
    }

    function showSuccess(designId, companyName) {
        var body = document.getElementById('jds-form-body');
        if (!body) return;
        body.innerHTML = '<div class="jds-success">'
            + '<div class="jds-success-icon">✅</div>'
            + '<h3>JDS Request Submitted!' + (designId ? ' <span class="jds-success-id">Design #' + escapeHtml(String(designId)) + '</span>' : '') + '</h3>'
            + '<p>Your JDS art request for <strong>' + escapeHtml(companyName) + '</strong> '
            + 'has been sent to Steve. He will create the mockup and notify you when it\'s ready.</p>'
            + (designId ? '<a href="/art-request/' + designId + '?view=ae" class="jds-success-link">View Request →</a>' : '')
            + '<button type="button" class="jds-success-another" id="jds-another-btn">Submit Another</button>'
            + '</div>';
        var anotherBtn = document.getElementById('jds-another-btn');
        if (anotherBtn) anotherBtn.addEventListener('click', function () {
            referenceFiles = [];
            selectedContact = null;
            isRush = false;
            selectedRow = null;
            liveProduct = null;
            liveError = null;
            renderCategoriesView();
        });
    }

    function renderEmptyState(message) {
        var container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '<div class="jds-container"><div class="jds-empty jds-empty--error">' + escapeHtml(message) + '</div></div>';
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    function escapeHtml(str) {
        if (str == null) return '';
        var div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function getSubmitterEmail() {
        if (typeof StaffAuthHelper !== 'undefined') {
            var email = StaffAuthHelper.getLoggedInStaffEmail();
            if (email) return email;
        }
        if (window.APP_CONFIG && window.APP_CONFIG.USER && window.APP_CONFIG.USER.email) {
            return window.APP_CONFIG.USER.email;
        }
        return localStorage.getItem('userEmail') || 'ae@nwcustomapparel.com';
    }

    function getSubmitterName() {
        if (typeof StaffAuthHelper !== 'undefined') {
            var name = StaffAuthHelper.getLoggedInStaffName();
            if (name) return name;
        }
        if (window.APP_CONFIG && window.APP_CONFIG.USER && window.APP_CONFIG.USER.name) {
            return window.APP_CONFIG.USER.name;
        }
        var email = getSubmitterEmail();
        var atIdx = email.indexOf('@');
        var local = atIdx > 0 ? email.substring(0, atIdx) : email;
        return local.charAt(0).toUpperCase() + local.slice(1);
    }

    function showToast(message, type) {
        type = type || 'info';
        document.querySelectorAll('.jds-toast').forEach(function (t) { t.remove(); });
        var toast = document.createElement('div');
        toast.className = 'jds-toast jds-toast--' + type;
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(function () { toast.classList.add('show'); });
        setTimeout(function () {
            toast.classList.remove('show');
            setTimeout(function () { toast.remove(); }, 300);
        }, 3000);
    }

    return {
        init: init,
        setItemType: setItemType,
        getItemType: getItemType
    };

})();
