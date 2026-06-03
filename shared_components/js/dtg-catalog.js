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
    let lastFullCatalogResults = []; // full SanMar catalog stylesearch hits (fallback flow)

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
        // 2026-05-19 — catalog is now always-expanded (no accordion shell).
        // We anchor on the grid element instead of the old <details>.
        const grid = document.getElementById('dtgCatalogGrid');
        if (!grid) return; // page doesn't have the catalog section

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

        // Load immediately — catalog is the primary interaction surface now,
        // not a hidden accordion. Reps see the 20 cards within ~500ms of page
        // load instead of having to click to expand first.
        try {
            await Promise.all([loadCategories(), loadStyles()]);
        } catch (err) {
            console.error('[dtg-catalog] init failed:', err);
            grid.innerHTML = `<div class="dtg-catalog-error">Couldn't load catalog. <button type="button" onclick="location.reload()">Retry</button></div>`;
        }
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
            const fcQuery = currentSearch.trim();
            // Curated 20 has no match. If the rep typed something style-like
            // (3+ chars), offer a one-click jump to the FULL SanMar catalog
            // instead of a dead "no results" message. Curated stays primary;
            // the full catalog is opt-in, on demand.
            if (fcQuery.length >= 3) {
                grid.innerHTML = `
                    <div class="dtg-catalog-empty dtg-fullcat-prompt">
                        <div class="dtg-fullcat-prompt-line">Not one of our 20 DTG-tested styles — no match for "${escapeHtml(fcQuery)}".</div>
                        <button type="button" class="dtg-fullcat-trigger" id="dtgFullCatTrigger">
                            <i class="fas fa-magnifying-glass-plus"></i>
                            Search the full SanMar catalog for "${escapeHtml(fcQuery)}"
                        </button>
                        <div class="dtg-fullcat-prompt-hint">Any SanMar style can be priced for DTG — these just aren't on our proven-print list.</div>
                    </div>`;
                const trigger = document.getElementById('dtgFullCatTrigger');
                if (trigger) trigger.addEventListener('click', () => runFullCatalogSearch(fcQuery));
            } else {
                grid.innerHTML = `<div class="dtg-catalog-empty">No styles match${currentSearch ? ` "${escapeHtml(currentSearch)}"` : ''}.</div>`;
            }
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
            // Click an inline swatch → SELECT that color (Shopify pattern).
            // Adds happen only on the CTA, so reps don't accidentally drop
            // a $$$ order line just by clicking a swatch to preview.
            card.querySelectorAll('.dtg-cc-color-swatch').forEach((sw) => {
                sw.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectColorOnCard(card, sw);
                });
            });
            // Add-default CTA — adds the CURRENTLY SELECTED color (not always
            // the top color). card.dataset.selected* is initialized to top
            // color when the card renders, and updated by selectColorOnCard().
            const addBtn = card.querySelector('.dtg-cc-add-default');
            if (addBtn) {
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    quickAddToQuote(
                        style,
                        card.dataset.selectedColor,
                        card.dataset.selectedCatalogColor,
                        card.dataset.selectedSwatchUrl,
                        row.product_title
                    );
                });
            }
            // "View all colors" button → modal (size data per color)
            const viewAllBtn = card.querySelector('.dtg-cc-view-all');
            if (viewAllBtn) {
                viewAllBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openModal(style);
                });
            }
            // "+N" badge — also opens the modal so reps can reach tail colors
            const moreBtn = card.querySelector('.dtg-cc-more');
            if (moreBtn) {
                moreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openModal(style);
                });
            }
        });

        // Even when the curated 20 DID return hits, offer a quiet path to the
        // full catalog while a search is active — covers the case where the
        // query collides with a curated style (e.g. "5000" surfaces DT5000)
        // but the rep actually wanted a different SanMar style (Gildan 5000).
        const fcQ = currentSearch.trim();
        if (fcQ.length >= 3) {
            const footer = document.createElement('div');
            footer.className = 'dtg-fullcat-footer';
            footer.innerHTML = `Not seeing it? <button type="button" class="dtg-fullcat-footer-link" id="dtgFullCatFooter">Search the full SanMar catalog for "${escapeHtml(fcQ)}" →</button>`;
            grid.appendChild(footer);
            const link = document.getElementById('dtgFullCatFooter');
            if (link) link.addEventListener('click', () => runFullCatalogSearch(fcQ));
        }
    }

    // Mark a swatch as selected on its card. Updates the swatch ring +
    // checkmark, the CTA label ("Add Pink"), the hero image (so the model
    // is wearing the color the rep just picked), the per-color stat line
    // ("Pink · 412 units sold"), and the card-level dataset that the CTA
    // click reads from.
    function selectColorOnCard(card, sw) {
        const colorName = sw.getAttribute('data-color-name') || '';
        const catalogColor = sw.getAttribute('data-catalog-color') || '';
        const swatchUrl = sw.getAttribute('data-swatch-url') || '';
        const frontSrc = sw.getAttribute('data-front-src') || '';
        const colorUnits = Number(sw.getAttribute('data-color-units') || 0);
        // Visually flip the selected state on this card's swatch row
        card.querySelectorAll('.dtg-cc-color-swatch').forEach((s) => {
            s.classList.remove('dtg-cc-color-swatch--selected');
        });
        sw.classList.add('dtg-cc-color-swatch--selected');
        // Persist selection in card dataset for the CTA to pick up
        card.dataset.selectedColor = colorName;
        card.dataset.selectedCatalogColor = catalogColor;
        card.dataset.selectedSwatchUrl = swatchUrl;
        // Update the green CTA label so it says "+ Add Pink" (not "Add Jet Black")
        const label = card.querySelector('.dtg-cc-selected-color-label');
        if (label) label.textContent = colorName;
        // Update the per-color stat line right above the action buttons
        const statName = card.querySelector('.dtg-cc-color-stat-name');
        if (statName) statName.textContent = colorName;
        const statUnits = card.querySelector('.dtg-cc-color-stat-units');
        if (statUnits) statUnits.textContent = fmtInt(colorUnits);
        // Swap the hero image to the model wearing this color. Falls back
        // to data-default-src (the rotated default hero) if this color has
        // no per-color image hydrated by the proxy.
        const heroImg = card.querySelector('.dtg-cc-hero-img');
        if (heroImg) {
            const defaultSrc = heroImg.getAttribute('data-default-src') || '';
            heroImg.src = frontSrc || defaultSrc;
        }
    }

    function renderCard(s) {
        const rankBadge = s.style_rank <= 3
            ? `<span class="dtg-cc-rank dtg-cc-rank-${s.style_rank}">#${s.style_rank}</span>`
            : `<span class="dtg-cc-rank">#${s.style_rank}</span>`;

        // Pick which color the card opens with. Rotates through the first
        // three top colors (rank-1 → 0, rank-2 → 1, rank-3 → 2, rank-4 → 0…)
        // so the grid stops being a wall of black tees. Falls back gracefully
        // when a style has fewer than 3 top colors.
        const topColors = Array.isArray(s.top_colors) ? s.top_colors : [];
        const variantPool = Math.max(1, Math.min(3, topColors.length || 1));
        const defaultIdx = topColors.length
            ? ((Number(s.style_rank) || 1) - 1) % variantPool
            : 0;
        const defaultColor = topColors[defaultIdx] || null;

        // Hero image — use the rotated color's front image if available,
        // otherwise fall back to the style's main image.
        const heroSrc = (defaultColor && defaultColor.front_image_url) || s.main_image_url || '';
        const heroImg = heroSrc
            ? `<img class="dtg-cc-hero-img"
                    src="${escapeHtml(heroSrc)}"
                    alt="${escapeHtml(s.style)} ${escapeHtml(defaultColor ? defaultColor.color_name : (s.top_color || ''))}"
                    data-default-src="${escapeHtml(heroSrc)}"
                    loading="lazy"
                    onerror="this.style.display='none';this.parentElement.classList.add('dtg-cc-hero-missing');">`
            : '<div class="dtg-cc-hero-placeholder"><i class="fas fa-tshirt"></i></div>';

        // Inline color swatches (top 4-6 from server). The defaultIdx-th
        // swatch starts selected. Click another → swap the selected state.
        // Each swatch carries data-color-units so the per-color stat line
        // below can update on selection without a second lookup.
        const swatchesHtml = topColors.length
            ? `<div class="dtg-cc-swatches">${topColors.slice(0, 6).map((c, i) => `
                <button type="button"
                        class="dtg-cc-color-swatch${i === defaultIdx ? ' dtg-cc-color-swatch--selected' : ''}"
                        data-color-name="${escapeHtml(c.color_name)}"
                        data-catalog-color="${escapeHtml(c.catalog_color)}"
                        data-swatch-url="${escapeHtml(c.swatch_image_url || '')}"
                        data-front-src="${escapeHtml(c.front_image_url || '')}"
                        data-color-units="${Number(c.color_units_sold || 0)}"
                        title="${escapeHtml(c.color_name)} — ${fmtInt(c.color_units_sold || 0)} units sold. Click to select.">
                    ${c.swatch_image_url
                        ? `<img src="${escapeHtml(c.swatch_image_url)}" alt="" loading="lazy">`
                        : `<span class="dtg-cc-swatch-placeholder"></span>`}
                    <span class="dtg-cc-swatch-check" aria-hidden="true"><i class="fas fa-check"></i></span>
                </button>`).join('')}
                ${s.color_count > 6 ? `<button type="button" class="dtg-cc-more" title="See all ${s.color_count} colors with size data">+${s.color_count - 6}</button>` : ''}
              </div>`
            : '';

        // Selected-color stat line. Lives between the swatches and the
        // action buttons; updates inside selectColorOnCard() on every click.
        const selectedColorStatHtml = defaultColor
            ? `<div class="dtg-cc-color-stat">
                <span class="dtg-cc-color-stat-name">${escapeHtml(defaultColor.color_name)}</span>
                <span class="dtg-cc-color-stat-dot">·</span>
                <span class="dtg-cc-color-stat-units">${fmtInt(defaultColor.color_units_sold || 0)}</span>
                <span class="dtg-cc-color-stat-label">units sold</span>
              </div>`
            : '';

        // Fabric guess from brand (matches what the bot prompt knows)
        const brand = extractBrand(s.product_title);

        // The article carries the current selection in data-selected-*; the
        // CTA reads from it. Initialized to the rotated default color,
        // updated by selectColorOnCard() when the rep clicks a swatch.
        const ctaColorName = defaultColor ? defaultColor.color_name : (s.top_color || s.style);
        return `
            <article class="dtg-catalog-card"
                     data-style="${escapeHtml(s.style)}"
                     data-selected-color="${escapeHtml(defaultColor ? defaultColor.color_name : (s.top_color || ''))}"
                     data-selected-catalog-color="${escapeHtml(defaultColor ? defaultColor.catalog_color : (s.top_color_catalog || ''))}"
                     data-selected-swatch-url="${escapeHtml(defaultColor ? (defaultColor.swatch_image_url || '') : (s.top_color_swatch || ''))}">
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
                        <span>${fmtInt(s.total_units_sold)} units sold total</span>
                    </div>
                </div>
                ${swatchesHtml}
                ${selectedColorStatHtml}
                <div class="dtg-cc-actions">
                    <button type="button" class="dtg-cc-add-default" title="Add the selected color to your quote">
                        <i class="fas fa-plus"></i> Add <span class="dtg-cc-selected-color-label">${escapeHtml(ctaColorName)}</span>
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

    // ===================================================================
    // Full SanMar catalog fallback (2026-06-03)
    // -------------------------------------------------------------------
    // The curated grid above is our 20 DTG-tested top-sellers. When a rep
    // searches for a style we HAVEN'T vetted (e.g. "DT6000"), the curated
    // filter returns nothing — so we offer a one-click jump to the full
    // SanMar catalog via /api/stylesearch. Picking a result drops it into
    // the order form through the SAME window.DTGInlineForm.previewStyle()
    // path the curated cards use, so colors/sizes/pricing hydrate
    // identically (backend prices ANY style — verified). Full-catalog
    // garments are badged "not DTG-tested" and flagged when the fabric is
    // a known DTG risk. This never blocks a quote — it informs.
    // ===================================================================

    // Known-risky DTG substrates. The curated catalog exists precisely
    // because "we know how it prints"; outside it, warn (never block) on the
    // fabrics that print poorly on the Kornit. Mirrors the catalog footer.
    function dtgSuitabilityWarning(styleAndLabel) {
        const t = String(styleAndLabel || '').toLowerCase();
        if (/\bgildan\b/.test(t)) {
            return "Gildan's fabric coating can dull DTG prints — sample before committing.";
        }
        if (/dri-?fit|posicharge|sport-?wick|performance|polyester|\bpoly\b|moisture[- ]?wick/.test(t)) {
            return 'Performance / polyester fabric — DTG ink bonds best to cotton; colors may look faded.';
        }
        return null;
    }

    async function runFullCatalogSearch(q) {
        const grid = document.getElementById('dtgCatalogGrid');
        if (!grid) return;
        grid.innerHTML = `<div class="dtg-catalog-loading"><i class="fas fa-circle-notch fa-spin"></i> Searching the full SanMar catalog for "${escapeHtml(q)}"…</div>`;
        let results = [];
        try {
            const data = await fetchJSON(`${API_BASE}/api/stylesearch?term=${encodeURIComponent(q)}`);
            results = Array.isArray(data) ? data : (data.results || []);
        } catch (err) {
            console.error('[dtg-catalog] full-catalog search failed:', err);
            grid.innerHTML = `<div class="dtg-catalog-error"><i class="fas fa-triangle-exclamation"></i> Couldn't reach the SanMar catalog. <button type="button" id="dtgFullCatRetry">Retry</button></div>`;
            const retry = document.getElementById('dtgFullCatRetry');
            if (retry) retry.addEventListener('click', () => runFullCatalogSearch(q));
            return;
        }
        renderFullCatalogResults(q, results);
    }

    function renderFullCatalogResults(q, results) {
        const grid = document.getElementById('dtgCatalogGrid');
        if (!grid) return;
        lastFullCatalogResults = Array.isArray(results) ? results : [];
        const header = `
            <div class="dtg-fullcat-head">
                <button type="button" class="dtg-fullcat-back" id="dtgFullCatBack">
                    <i class="fas fa-arrow-left"></i> Back to DTG-tested catalog
                </button>
                <div class="dtg-fullcat-head-text">
                    <strong>Full SanMar catalog</strong> · ${lastFullCatalogResults.length} match${lastFullCatalogResults.length === 1 ? '' : 'es'} for "${escapeHtml(q)}"
                    <span class="dtg-fullcat-head-warn"><i class="fas fa-flask"></i> Outside our 20 DTG-tested styles — confirm the garment prints well before quoting.</span>
                </div>
            </div>`;
        if (!lastFullCatalogResults.length) {
            grid.innerHTML = header + `<div class="dtg-catalog-empty">No SanMar styles match "${escapeHtml(q)}". Try the exact style number (e.g. DT6000).</div>`;
            wireFullCatBack();
            return;
        }
        const cards = lastFullCatalogResults.slice(0, 60).map((m, i) => {
            const style = String(m.value || m.style || m.styleNumber || '').toUpperCase();
            const label = String(m.label || m.PRODUCT_TITLE || style);
            // Strip the leading "STYLE - " and trailing ". STYLE" SanMar wraps
            // its labels in, leaving just the product name.
            const leadRe = new RegExp('^' + style.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[-–]\\s*', 'i');
            const title = stripStyleSuffix(label.replace(leadRe, '')) || label;
            const warn = dtgSuitabilityWarning(label);
            return `
                <article class="dtg-fullcat-card${warn ? ' dtg-fullcat-card--warn' : ''}" data-idx="${i}" data-style="${escapeHtml(style)}">
                    <div class="dtg-fullcat-card-main">
                        <div class="dtg-fullcat-card-style">${escapeHtml(style)}</div>
                        <div class="dtg-fullcat-card-title">${escapeHtml(title)}</div>
                        ${warn ? `<div class="dtg-fullcat-card-warn"><i class="fas fa-triangle-exclamation"></i> ${escapeHtml(warn)}</div>` : ''}
                    </div>
                    <button type="button" class="dtg-fullcat-add" data-idx="${i}">
                        <i class="fas fa-plus"></i> Add to quote
                    </button>
                </article>`;
        }).join('');
        grid.innerHTML = header + `<div class="dtg-fullcat-results">${cards}</div>`;
        wireFullCatBack();
        grid.querySelectorAll('.dtg-fullcat-add').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                const m = lastFullCatalogResults[idx];
                if (m) addFullCatalogStyle(btn, m);
            });
        });
    }

    function wireFullCatBack() {
        const back = document.getElementById('dtgFullCatBack');
        if (!back) return;
        back.addEventListener('click', () => {
            const input = document.getElementById('dtgCatalogSearch');
            if (input) input.value = '';
            currentSearch = '';
            renderGrid();
        });
    }

    // Drop a full-catalog style onto the order form. Fetches the real color
    // list first so the row's color picker is populated; pricing + sizes
    // hydrate inside previewStyle() via the bundle, identical to the curated
    // quickAddToQuote() path.
    async function addFullCatalogStyle(btn, m) {
        if (!window.DTGInlineForm || typeof window.DTGInlineForm.previewStyle !== 'function') {
            console.warn('[dtg-catalog] DTGInlineForm.previewStyle unavailable');
            return;
        }
        const style = String(m.value || m.style || m.styleNumber || '').toUpperCase();
        if (!style) return;
        const label = String(m.label || '');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Adding…'; }
        let colors = [];
        let productTitle = '';
        try {
            const data = await fetchJSON(`${API_BASE}/api/product-colors?styleNumber=${encodeURIComponent(style)}`);
            colors = (data && data.colors) || [];
            productTitle = (data && data.productTitle) || '';
        } catch (err) {
            // Non-fatal — drop the style in anyway; the row's own color combobox
            // retries the color lookup when the rep opens it.
            console.warn('[dtg-catalog] product-colors failed for', style, err);
        }
        try {
            window.DTGInlineForm.previewStyle({
                style,
                desc: stripStyleSuffix(productTitle || label.replace(new RegExp('^' + style + '\\s*[-–]\\s*', 'i'), '')),
                colorsAvailable: colors,
            });
            const formMount = document.getElementById('dtgInlineFormMount');
            if (formMount) formMount.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (btn) { btn.innerHTML = '<i class="fas fa-check"></i> Added'; btn.classList.add('dtg-fullcat-add--done'); }
        } catch (err) {
            console.error('[dtg-catalog] addFullCatalogStyle failed:', err);
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Add to quote'; }
        }
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
