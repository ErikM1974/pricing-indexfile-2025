/**
 * dtg-catalog.js — NWCA-Approved DTG Catalog browser.
 *
 * Renders an interactive grid of the 20 top-selling DTG styles on the
 * dtg-quote-builder.html page, backed by /api/dtg/top-sellers.
 *
 * Flow:
 *   1. Fetch /api/dtg/top-sellers/categories → render category tabs
 *   2. Fetch /api/dtg/top-sellers/styles      → render style grid
 *   3. Click a card → fetch /api/dtg/top-sellers?style=X → open modal
 *      with all colors, size mix, "Add to quote" button per color
 *
 * Integrations:
 *   - "Add to quote" calls window.DTGInlineForm.previewStyle() +
 *     previewLineItems() to drop the style+color onto the form
 *   - Closes modal on success and scrolls form into view
 */

(function () {
    'use strict';

    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // Cache the styles list — we fetch it once
    let stylesCache = null;
    let currentCategory = ''; // '' = All
    let currentSearch = '';   // free-text quick-find filter

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function fmtInt(n) {
        if (!Number.isFinite(Number(n))) return '0';
        return String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    async function fetchJSON(url) {
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.json();
    }

    // ----- Init ---------------------------------------------------------
    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        const accordion = document.getElementById('dtgCatalogAccordion');
        if (!accordion) return; // page doesn't have the catalog section

        // Hook up modal close on backdrop click + X button + Escape
        const backdrop = document.getElementById('dtgCatalogModalBackdrop');
        const closeBtn = document.getElementById('dtgCatalogModalClose');
        if (backdrop) backdrop.addEventListener('click', closeModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !document.getElementById('dtgCatalogModal').hidden) {
                closeModal();
            }
        });

        // Phase 3 — quick-find search input
        const searchInput = document.getElementById('dtgCatalogSearch');
        if (searchInput) {
            let searchTimer = null;
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    currentSearch = searchInput.value.trim();
                    renderGrid();
                }, 120);
            });
        }

        // Lazy-load when accordion is first opened
        let loaded = false;
        const loadIfNeeded = async () => {
            if (loaded) return;
            loaded = true;
            try {
                await Promise.all([loadCategories(), loadStyles()]);
            } catch (err) {
                console.error('[dtg-catalog] init failed:', err);
                const grid = document.getElementById('dtgCatalogGrid');
                if (grid) grid.innerHTML = `<div class="dtg-catalog-error">Couldn't load catalog. <button type="button" onclick="location.reload()">Retry</button></div>`;
            }
        };
        accordion.addEventListener('toggle', () => {
            if (accordion.open) loadIfNeeded();
        });
        // Preload anyway after 800ms so it's snappy when first opened
        setTimeout(loadIfNeeded, 800);
    }

    // ----- Category tabs ------------------------------------------------
    async function loadCategories() {
        const tabs = document.getElementById('dtgCatalogTabs');
        if (!tabs) return;
        const data = await fetchJSON(`${API_BASE}/api/dtg/top-sellers/categories`);
        const cats = data.categories || [];
        // Update "All" count
        const allCount = cats.reduce((s, c) => s + (c.style_count || 0), 0);
        tabs.querySelector('.dtg-cat-tab[data-category=""] .dtg-cat-count').textContent = `(${allCount})`;
        // Append category buttons
        for (const c of cats) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dtg-cat-tab';
            btn.setAttribute('data-category', c.category);
            btn.innerHTML = `${escapeHtml(c.category)} <span class="dtg-cat-count">(${c.style_count})</span>`;
            tabs.appendChild(btn);
        }
        // Wire clicks
        tabs.querySelectorAll('.dtg-cat-tab').forEach((b) => {
            b.addEventListener('click', () => {
                tabs.querySelectorAll('.dtg-cat-tab').forEach((x) => x.classList.remove('active'));
                b.classList.add('active');
                currentCategory = b.getAttribute('data-category') || '';
                renderGrid();
            });
        });
    }

    // ----- Style grid ---------------------------------------------------
    async function loadStyles() {
        const data = await fetchJSON(`${API_BASE}/api/dtg/top-sellers/styles`);
        stylesCache = data.records || [];
        renderGrid();
    }

    function renderGrid() {
        const grid = document.getElementById('dtgCatalogGrid');
        if (!grid || !stylesCache) return;
        // Apply text filter (Phase 3) + category filter
        // If the query is an EXACT style code that exists in the catalog
        // (e.g. "PC61"), narrow strictly to that style — otherwise the
        // substring match would also surface PC61LS, PC61T, etc.
        const q = currentSearch.toLowerCase();
        const exactStyleHit = q ? stylesCache.find((s) => s.style.toLowerCase() === q) : null;
        const filtered = stylesCache.filter((s) => {
            if (currentCategory && s.category !== currentCategory) return false;
            if (q) {
                if (exactStyleHit) {
                    if (s.style.toLowerCase() !== q) return false;
                } else {
                    const hay = `${s.style} ${s.product_title} ${s.category} ${s.top_color}`.toLowerCase();
                    if (!hay.includes(q)) return false;
                }
            }
            return true;
        });
        if (!filtered.length) {
            grid.innerHTML = `<div class="dtg-catalog-empty">No styles match${currentSearch ? ` "${escapeHtml(currentSearch)}"` : ''}.</div>`;
            return;
        }
        grid.innerHTML = filtered.map((s) => renderCard(s)).join('');
        // Build a style → row lookup so per-card click handlers can resolve
        // their row data without a linear scan through stylesCache every time.
        const byStyle = new Map(filtered.map((s) => [s.style, s]));
        // Wire interactions
        grid.querySelectorAll('.dtg-catalog-card').forEach((card) => {
            const style = card.getAttribute('data-style');
            const row = byStyle.get(style) || {};
            // Whole-card click → modal (deep dive: all colors + size mix)
            const titleArea = card.querySelector('.dtg-cc-titleblock');
            if (titleArea) titleArea.addEventListener('click', () => openModal(style));
            const heroArea = card.querySelector('.dtg-cc-hero');
            if (heroArea) heroArea.addEventListener('click', () => openModal(style));
            // Click an inline swatch → fill form directly with that color, no modal
            card.querySelectorAll('.dtg-cc-color-swatch').forEach((sw) => {
                sw.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const colorName = sw.getAttribute('data-color-name');
                    const catalogColor = sw.getAttribute('data-catalog-color');
                    const swatchUrl = sw.getAttribute('data-swatch-url');
                    quickAddToQuote(style, colorName, catalogColor, swatchUrl, row.product_title);
                });
                // Hover swatch → swap hero image to show that color
                sw.addEventListener('mouseenter', () => {
                    const heroImg = card.querySelector('.dtg-cc-hero-img');
                    const variantSrc = sw.getAttribute('data-hover-src') || '';
                    if (heroImg && variantSrc) heroImg.src = variantSrc;
                });
                sw.addEventListener('mouseleave', () => {
                    const heroImg = card.querySelector('.dtg-cc-hero-img');
                    const defaultSrc = heroImg?.getAttribute('data-default-src') || '';
                    if (heroImg && defaultSrc) heroImg.src = defaultSrc;
                });
            });
            // Add-default CTA
            const addBtn = card.querySelector('.dtg-cc-add-default');
            if (addBtn) {
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    quickAddToQuote(
                        style,
                        row.top_color,
                        row.top_color_catalog,
                        row.top_color_swatch,
                        row.product_title
                    );
                });
            }
            // "View all colors" button → modal
            const viewAllBtn = card.querySelector('.dtg-cc-view-all');
            if (viewAllBtn) {
                viewAllBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openModal(style);
                });
            }
        });
    }

    function renderCard(s) {
        const rankBadge = s.style_rank <= 3
            ? `<span class="dtg-cc-rank dtg-cc-rank-${s.style_rank}">#${s.style_rank}</span>`
            : `<span class="dtg-cc-rank">#${s.style_rank}</span>`;

        // Hero product image — SanMar's MAIN_IMAGE_URL via /api/dtg/top-sellers/styles
        const heroImg = s.main_image_url
            ? `<img class="dtg-cc-hero-img"
                    src="${escapeHtml(s.main_image_url)}"
                    alt="${escapeHtml(s.style)} ${escapeHtml(s.top_color || '')}"
                    data-default-src="${escapeHtml(s.main_image_url)}"
                    loading="lazy"
                    onerror="this.style.display='none';this.parentElement.classList.add('dtg-cc-hero-missing');">`
            : '<div class="dtg-cc-hero-placeholder"><i class="fas fa-tshirt"></i></div>';

        // Inline color swatches (top 4-6 from server)
        const topColors = Array.isArray(s.top_colors) ? s.top_colors : [];
        const swatchesHtml = topColors.length
            ? `<div class="dtg-cc-swatches">${topColors.slice(0, 6).map((c) => `
                <button type="button" class="dtg-cc-color-swatch"
                        data-color-name="${escapeHtml(c.color_name)}"
                        data-catalog-color="${escapeHtml(c.catalog_color)}"
                        data-swatch-url="${escapeHtml(c.swatch_image_url || '')}"
                        title="${escapeHtml(c.color_name)} — click to add ${escapeHtml(s.style)} ${escapeHtml(c.color_name)} to quote">
                    ${c.swatch_image_url
                        ? `<img src="${escapeHtml(c.swatch_image_url)}" alt="" loading="lazy">`
                        : `<span class="dtg-cc-swatch-placeholder"></span>`}
                </button>`).join('')}
                ${s.color_count > 6 ? `<span class="dtg-cc-more">+${s.color_count - 6}</span>` : ''}
              </div>`
            : '';

        // Fabric guess from brand (matches what the bot prompt knows)
        const brand = extractBrand(s.product_title);

        return `
            <article class="dtg-catalog-card" data-style="${escapeHtml(s.style)}">
                <div class="dtg-cc-hero">
                    ${heroImg}
                    <div class="dtg-cc-hero-badges">
                        ${rankBadge}
                    </div>
                </div>
                <div class="dtg-cc-titleblock">
                    <div class="dtg-cc-style-row">
                        <span class="dtg-cc-style">${escapeHtml(s.style)}</span>
                        <span class="dtg-cc-category">${escapeHtml(s.category)}</span>
                    </div>
                    <div class="dtg-cc-title">${escapeHtml(stripStyleSuffix(s.product_title))}</div>
                    <div class="dtg-cc-meta">
                        ${brand ? `<span>${escapeHtml(brand)}</span> · ` : ''}
                        <span>${fmtInt(s.total_units_sold)} units sold</span>
                    </div>
                </div>
                ${swatchesHtml}
                <div class="dtg-cc-actions">
                    <button type="button" class="dtg-cc-add-default" title="Add ${escapeHtml(s.top_color)} to quote">
                        <i class="fas fa-plus"></i> Add ${escapeHtml(s.top_color || s.style)}
                    </button>
                    <button type="button" class="dtg-cc-view-all" title="See all ${s.color_count} colors with size data">
                        <i class="fas fa-eye"></i> All ${fmtInt(s.color_count)}
                    </button>
                </div>
            </article>
        `;
    }

    function extractBrand(title) {
        const t = String(title || '').trim();
        if (/^Port\s*&\s*Co/i.test(t)) return 'Port & Co';
        if (/^BELLA\+CANVAS/i.test(t)) return 'BELLA+CANVAS';
        if (/^District/i.test(t)) return 'District';
        if (/^Sport-Tek/i.test(t)) return 'Sport-Tek';
        if (/^Next Level/i.test(t)) return 'Next Level';
        return '';
    }

    // Phase 2 — quick-add a (style, color) to the form without opening the modal
    function quickAddToQuote(style, colorName, catalogColor, swatchUrl, productTitle) {
        if (!window.DTGInlineForm) return;
        try {
            if (typeof window.DTGInlineForm.previewStyle === 'function') {
                window.DTGInlineForm.previewStyle({
                    style,
                    desc: stripStyleSuffix(productTitle || ''),
                    color: colorName,
                    colorsAvailable: [{
                        COLOR_NAME: colorName,
                        CATALOG_COLOR: catalogColor,
                        COLOR_SQUARE_IMAGE: swatchUrl,
                    }],
                });
            }
            // Visual confirmation on the card
            const card = document.querySelector(`.dtg-catalog-card[data-style="${style}"]`);
            if (card) {
                card.classList.add('dtg-cc-just-added');
                setTimeout(() => card.classList.remove('dtg-cc-just-added'), 1200);
            }
            // Scroll the form into view
            const formMount = document.getElementById('dtgInlineFormMount');
            if (formMount) formMount.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (err) {
            console.error('[dtg-catalog] quickAddToQuote failed:', err);
        }
    }

    // Trim the trailing ". STYLENUMBER" from SanMar product titles for a
    // cleaner card display. E.g. "Port & Co Core Cotton Tee. PC54" → "Port
    // & Co Core Cotton Tee".
    function stripStyleSuffix(title) {
        return String(title || '').replace(/\.?\s*[A-Z0-9]+\s*$/, '').trim();
    }

    // ----- Modal --------------------------------------------------------
    async function openModal(style) {
        const modal = document.getElementById('dtgCatalogModal');
        const backdrop = document.getElementById('dtgCatalogModalBackdrop');
        const body = document.getElementById('dtgCatalogModalBody');
        if (!modal || !backdrop || !body) return;
        body.innerHTML = `<div class="dtg-catalog-modal-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading ${escapeHtml(style)}…</div>`;
        modal.hidden = false;
        backdrop.hidden = false;
        document.body.classList.add('dtg-catalog-modal-open');
        try {
            const data = await fetchJSON(`${API_BASE}/api/dtg/top-sellers?style=${encodeURIComponent(style)}`);
            renderModal(data.records || []);
        } catch (err) {
            body.innerHTML = `<div class="dtg-catalog-error">Couldn't load ${escapeHtml(style)}.</div>`;
        }
    }

    function closeModal() {
        const modal = document.getElementById('dtgCatalogModal');
        const backdrop = document.getElementById('dtgCatalogModalBackdrop');
        if (modal) modal.hidden = true;
        if (backdrop) backdrop.hidden = true;
        document.body.classList.remove('dtg-catalog-modal-open');
    }

    function renderModal(records) {
        const body = document.getElementById('dtgCatalogModalBody');
        if (!body || !records.length) return;
        const first = records[0];
        const title = stripStyleSuffix(first.product_title);
        const hero = records.find((r) => r.swatch_image_url) || first;

        // Header
        let html = `
            <div class="dtg-mc-head">
                <div class="dtg-mc-style">${escapeHtml(first.style)}</div>
                <h2 class="dtg-mc-title" id="dtgCatalogModalTitle">${escapeHtml(title)}</h2>
                <div class="dtg-mc-meta">
                    <span class="dtg-mc-rank">#${first.style_rank} top seller</span>
                    <span class="dtg-mc-stat">${fmtInt(first.total_units_sold)} units lifetime</span>
                    <span class="dtg-mc-stat">${fmtInt(first.total_orders)} orders</span>
                    <span class="dtg-mc-stat">${escapeHtml(first.category)}</span>
                </div>
            </div>
        `;

        // Color grid
        html += `<div class="dtg-mc-section-label">Top colors — click "Add to quote" to drop this style + color onto the form</div>`;
        html += `<div class="dtg-mc-colors">`;
        for (const r of records) {
            const swatch = r.swatch_image_url
                ? `<img class="dtg-mc-color-swatch" src="${escapeHtml(r.swatch_image_url)}" alt="" loading="lazy">`
                : `<div class="dtg-mc-color-swatch dtg-mc-color-swatch-placeholder"></div>`;
            // Size mix preview (top 3 sizes by units)
            const sizes = r.sizes || {};
            const topSizes = Object.entries(sizes)
                .filter(([, n]) => Number(n) > 0)
                .sort((a, b) => Number(b[1]) - Number(a[1]))
                .slice(0, 3)
                .map(([s, n]) => `${s}:${fmtInt(n)}`)
                .join(' · ');
            html += `
                <div class="dtg-mc-color-card" data-style="${escapeHtml(r.style)}" data-color="${escapeHtml(r.color_name)}" data-catalog-color="${escapeHtml(r.catalog_color)}" data-swatch="${escapeHtml(r.swatch_image_url || '')}">
                    ${swatch}
                    <div class="dtg-mc-color-info">
                        <div class="dtg-mc-color-name">${escapeHtml(r.color_name)}</div>
                        <div class="dtg-mc-color-meta">
                            <span class="dtg-mc-color-rank">#${r.color_rank}</span>
                            <span class="dtg-mc-color-units">${fmtInt(r.color_units_sold)} units</span>
                        </div>
                        ${topSizes ? `<div class="dtg-mc-color-sizes">Most popular: ${escapeHtml(topSizes)}</div>` : ''}
                    </div>
                    <button type="button" class="dtg-mc-add-btn">
                        <i class="fas fa-plus"></i> Add
                    </button>
                </div>
            `;
        }
        html += `</div>`;

        body.innerHTML = html;

        // Wire Add buttons
        body.querySelectorAll('.dtg-mc-color-card').forEach((card) => {
            const btn = card.querySelector('.dtg-mc-add-btn');
            btn.addEventListener('click', () => addToQuote({
                style: card.getAttribute('data-style'),
                color: card.getAttribute('data-color'),
                catalogColor: card.getAttribute('data-catalog-color'),
                swatch: card.getAttribute('data-swatch'),
                title: title,
            }, card));
        });
    }

    function addToQuote(pick, cardEl) {
        if (!window.DTGInlineForm) {
            console.warn('[dtg-catalog] DTGInlineForm not loaded');
            return;
        }
        try {
            // 1. previewStyle — drops style + color + swatch onto first empty row.
            //    We pass the canonical color name AND a synthetic colorsAvailable
            //    array with just this one entry so fuzzyMatchColor picks it up.
            if (typeof window.DTGInlineForm.previewStyle === 'function') {
                window.DTGInlineForm.previewStyle({
                    style: pick.style,
                    desc: pick.title,
                    color: pick.color,
                    colorsAvailable: [{
                        COLOR_NAME: pick.color,
                        CATALOG_COLOR: pick.catalogColor,
                        COLOR_SQUARE_IMAGE: pick.swatch,
                    }],
                });
            }
            // 2. Visual confirmation on the card
            cardEl.classList.add('dtg-mc-color-card-added');
            const btn = cardEl.querySelector('.dtg-mc-add-btn');
            btn.innerHTML = '<i class="fas fa-check"></i> Added';
            btn.disabled = true;
            // 3. Close modal after a beat and scroll form into view
            setTimeout(() => {
                closeModal();
                const formMount = document.getElementById('dtgInlineFormMount');
                if (formMount) formMount.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 700);
        } catch (err) {
            console.error('[dtg-catalog] addToQuote failed:', err);
        }
    }
})();
