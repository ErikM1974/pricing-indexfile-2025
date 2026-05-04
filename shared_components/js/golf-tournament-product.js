/**
 * Golf Tournament Product Detail
 *
 * Page: pages/golf-tournament-product.html?style=XXX
 *
 * Fetches rich product data (description, colors, sizes, images) from
 * /api/products/search and embroidery pricing from EmbroideryPricingService.
 * Renders a clean catalog-style detail view with a CTA back to the main
 * landing page form (with style pre-filled).
 */
(function () {
    'use strict';

    const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const STITCH_COUNT = 8000;
    const COMPANY_PHONE = '253-922-5793';
    const SALES_EMAIL = 'sales@nwcustomapparel.com';

    /**
     * Styles that are part of the Summer 2026 free-bonus offer.
     * Add more entries here when you add new bonus items.
     */
    const BONUS_ITEMS = {
        '425044': {
            retailValue: 189,
            threshold: 2000,
            deadline: 'August 31, 2026'
        }
    };

    // ============================================================
    // STATE
    // ============================================================
    const state = {
        styleNumber: null,
        product: null,
        pricing: null,
        embroideryService: null,
        selectedColorIndex: 0
    };

    // ============================================================
    // UTILS
    // ============================================================
    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatPrice(value) {
        if (value == null || isNaN(value)) return '—';
        return '$' + Number(value).toFixed(2);
    }

    function getStyleParam() {
        const params = new URLSearchParams(window.location.search);
        return params.get('style') || params.get('StyleNumber') || params.get('s');
    }

    // ============================================================
    // DATA LOADING
    // ============================================================
    async function loadProduct(styleNumber) {
        const url = `${API_BASE}/api/products/search?q=${encodeURIComponent(styleNumber)}&limit=1`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Product search failed: ${resp.status}`);
        const json = await resp.json();
        const products = json?.data?.products || [];
        if (products.length === 0) throw new Error('Product not found');
        // Prefer exact match
        return products.find(p => p.styleNumber === styleNumber) || products[0];
    }

    async function loadPricing(styleNumber) {
        return await state.embroideryService.fetchPricingData(styleNumber);
    }

    // ============================================================
    // RENDERING
    // ============================================================
    function renderProduct() {
        const main = document.getElementById('product-main');
        if (!main) return;
        const p = state.product;

        // Update breadcrumb + page title
        const crumb = document.getElementById('breadcrumb-current');
        if (crumb) crumb.textContent = `${p.styleNumber} — ${cleanProductName(p.productName)}`;
        const title = document.getElementById('page-title');
        if (title) title.textContent = `${p.styleNumber} — ${cleanProductName(p.productName)} | Tournament Apparel`;

        const galleryHtml = renderGallery(p);
        const infoHtml = renderInfo(p);

        main.innerHTML = `
            <section class="product-detail">
                <div class="product-detail__inner">
                    <div class="product-detail__hero">
                        <div>${galleryHtml}</div>
                        <div class="product-info">${infoHtml}</div>
                    </div>
                </div>
            </section>
            <section class="volume-pricing">
                <div class="volume-pricing__inner" id="volume-pricing-section">
                    <h2 class="volume-pricing__title">Volume Pricing</h2>
                    <p class="volume-pricing__sub">
                        Per piece, with 8,000-stitch logo embroidery in 1 location. Price shown for size S — sizes 2XL+ have small upcharges.
                    </p>
                    <div class="volume-pricing__table-wrap">
                        <div class="loading-state" style="padding:2rem;">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Loading volume pricing&hellip;</span>
                        </div>
                    </div>
                </div>
            </section>
        `;

        bindGalleryThumbs();
        bindColorSwatches();

        // Wire up the quote CTA in the band below
        const quoteCta = document.getElementById('quote-cta');
        if (quoteCta) {
            quoteCta.href = `golf-tournaments-2026.html?prefill=${encodeURIComponent(state.styleNumber)}#quote-form`;
        }
    }

    function cleanProductName(raw) {
        if (!raw) return '';
        // SanMar names sometimes include the style number at the end like "Foo Polo. TM1MU410"
        // or "Foo Polo     425044". Strip those tails.
        return raw
            .replace(/\.\s*[A-Z0-9]+\s*$/, '')   // ". STYLE" tail
            .replace(/\s{2,}[A-Z0-9]+\s*$/, '')  // multi-space STYLE tail
            .trim();
    }

    function renderGallery(p) {
        const images = p.images || {};
        // Build a list of usable image URLs from biggest-to-smallest priority
        const candidates = [];
        if (images?.model?.front) candidates.push({ url: images.model.front, label: 'Front' });
        if (images?.model?.back)  candidates.push({ url: images.model.back, label: 'Back' });
        if (images?.model?.side)  candidates.push({ url: images.model.side, label: 'Side' });
        if (images?.flat?.front)  candidates.push({ url: images.flat.front, label: 'Flat Front' });
        if (images?.flat?.back)   candidates.push({ url: images.flat.back, label: 'Flat Back' });
        if (candidates.length === 0 && images?.main) candidates.push({ url: images.main, label: 'Main' });
        if (candidates.length === 0) candidates.push({ url: `https://cdnm.sanmar.com/catalog/images/${p.styleNumber}.jpg`, label: 'Main' });

        const main = candidates[0];
        const thumbs = candidates.slice(0, 4);

        return `
            <div class="gallery">
                <div class="gallery__main">
                    <img src="${escapeHtml(main.url)}"
                         alt="${escapeHtml(cleanProductName(p.productName))}"
                         id="gallery-main-img"
                         onerror="this.src='https://cdnm.sanmar.com/catalog/images/${escapeHtml(p.styleNumber)}.jpg'">
                </div>
                ${thumbs.length > 1 ? `
                    <div class="gallery__thumbs">
                        ${thumbs.map((t, i) => `
                            <button class="gallery__thumb ${i === 0 ? 'gallery__thumb--active' : ''}"
                                    type="button"
                                    data-img="${escapeHtml(t.url)}"
                                    data-thumb-index="${i}"
                                    aria-label="View ${escapeHtml(t.label)}">
                                <img src="${escapeHtml(t.url)}" alt="${escapeHtml(t.label)}" loading="lazy">
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    function renderInfo(p) {
        const cleanName = cleanProductName(p.productName);
        const desc = (p.description || '').trim();
        // SanMar descriptions tend to be a series of bullet points smushed together — split them.
        const descBullets = desc
            .split(/\s{2,}/)
            .map(s => s.trim())
            .filter(Boolean);
        const descLead = descBullets.shift() || '';

        const colors = p.colors || [];
        const sizes = (p.sizes || []).filter(Boolean);
        const upcharges = p.upcharges || {};

        return `
            <div class="product-info__brand">
                ${escapeHtml(p.brand || 'SanMar')}
                <span class="product-info__sku">&middot; ${escapeHtml(p.styleNumber)}</span>
            </div>
            <h1 class="product-info__name">${escapeHtml(cleanName)}</h1>

            <div class="product-info__price-card" id="info-price-card">
                <div>
                    <div class="product-info__price-label">Embroidered, qty 72+</div>
                    <div class="product-info__price-value" id="info-price-value">
                        <i class="fas fa-spinner fa-spin" style="font-size:1.25rem;"></i>
                    </div>
                    <div class="product-info__price-suffix">per piece</div>
                </div>
                <div class="product-info__price-note">
                    Includes 8,000-stitch logo<br>embroidery in 1 location
                </div>
            </div>

            ${renderBonusCallout(p.styleNumber)}

            ${descLead ? `<p class="product-info__description">${escapeHtml(descLead)}</p>` : ''}

            ${descBullets.length > 0 ? `
                <div class="spec-section">
                    <div class="spec-section__title">
                        <i class="fas fa-circle-info"></i>
                        Product Details
                    </div>
                    <ul style="margin:0; padding-left: 1.25rem; color: var(--gray-700); font-size: 0.875rem; line-height: 1.7;">
                        ${descBullets.slice(0, 8).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}

            ${colors.length > 0 ? `
                <div class="spec-section">
                    <div class="spec-section__title">
                        <i class="fas fa-palette"></i>
                        Available Colors
                        <span class="spec-section__count">(${colors.length})</span>
                    </div>
                    <div class="color-swatches" id="color-swatches">
                        ${colors.map((c, i) => renderColorSwatch(c, i)).join('')}
                    </div>
                    <div class="color-selected-name" id="color-selected-name">
                        <strong>Selected:</strong> <span id="color-selected-text">${escapeHtml(colors[0]?.name || '')}</span>
                    </div>
                </div>
            ` : ''}

            ${sizes.length > 0 ? `
                <div class="spec-section">
                    <div class="spec-section__title">
                        <i class="fas fa-ruler"></i>
                        Available Sizes
                        <span class="spec-section__count">(${sizes.length})</span>
                    </div>
                    <div class="size-pills">
                        ${sizes.map(s => renderSizePill(s, upcharges)).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="product-info__ctas">
                <a href="golf-tournaments-2026.html?prefill=${encodeURIComponent(p.styleNumber)}#quote-form" class="btn-primary">
                    <i class="fas fa-paper-plane"></i>
                    Request Quote for This Style
                </a>
                <a href="golf-tournaments-2026.html#showcase" class="btn-secondary">
                    <i class="fas fa-grip"></i>
                    See All Tournament Styles
                </a>
            </div>
        `;
    }

    /**
     * Render the "Get this FREE with $2,000+ tournament order" callout.
     * Only renders for styles in BONUS_ITEMS — generic styles render nothing.
     */
    function renderBonusCallout(styleNumber) {
        const bonus = BONUS_ITEMS[styleNumber];
        if (!bonus) return '';

        const tournamentUrl = `golf-tournaments-2026.html?utm_source=bag-detail&utm_campaign=golf-2026-q2&utm_medium=bonus-callout&prefill=${encodeURIComponent(styleNumber)}`;

        return `
            <div class="bonus-callout" role="region" aria-label="Summer 2026 Tournament Bonus">
                <div class="bonus-callout__shimmer" aria-hidden="true"></div>
                <div class="bonus-callout__inner">
                    <div class="bonus-callout__icon" aria-hidden="true">&#127873;</div>
                    <div class="bonus-callout__body">
                        <div class="bonus-callout__eyebrow">
                            <span class="bonus-callout__sparkle" aria-hidden="true">&#10024;</span>
                            SUMMER 2026 TOURNAMENT BONUS
                            <span class="bonus-callout__sparkle" aria-hidden="true">&#10024;</span>
                        </div>
                        <h2 class="bonus-callout__headline">
                            Get this bag <span class="bonus-callout__free">FREE</span><br>
                            with a $${bonus.threshold.toLocaleString()}+ tournament order
                        </h2>
                        <p class="bonus-callout__sub">
                            Order any combination of polos, towels, or apparel for your company tournament that totals
                            <strong>$${bonus.threshold.toLocaleString()}+ subtotal</strong>, and we&rsquo;ll throw in this
                            <strong>$${bonus.retailValue} OGIO Vision 2.0 Golf Bag &mdash; embroidered with your logo</strong> &mdash; on the house.
                            Plus we cover your $100 logo digitizing fee.
                        </p>
                        <div class="bonus-callout__perks">
                            <span class="bonus-callout__perk">&check; $${bonus.retailValue} value</span>
                            <span class="bonus-callout__perk">&check; Embroidered with your logo</span>
                            <span class="bonus-callout__perk">&check; Plus $100 free digitizing</span>
                        </div>
                        <a href="${tournamentUrl}" class="bonus-callout__cta">
                            See tournament packages
                            <span aria-hidden="true">&rarr;</span>
                        </a>
                        <p class="bonus-callout__deadline">
                            Offer ends <strong>${escapeHtml(bonus.deadline)}</strong>. Free bag goes to your tournament organizer, the winner of your scramble, or whoever you choose.
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    function renderColorSwatch(color, index) {
        const swatchUrl = color.swatchUrl || color.productImageThumbnail || color.productImageUrl;
        const isActive = (index === 0) ? 'color-swatch--active' : '';
        const productImg = color.productImageUrl || color.productImageThumbnail;
        return `
            <button class="color-swatch ${isActive}"
                    type="button"
                    data-color-index="${index}"
                    data-color-name="${escapeHtml(color.name)}"
                    data-product-img="${escapeHtml(productImg || '')}"
                    title="${escapeHtml(color.name)}">
                ${swatchUrl ? `<img src="${escapeHtml(swatchUrl)}" alt="${escapeHtml(color.name)}" class="color-swatch__image" loading="lazy">` : ''}
                <div class="color-swatch__name">${escapeHtml(color.name)}</div>
            </button>
        `;
    }

    function renderSizePill(size, upcharges) {
        const upchargeAmount = upcharges?.[size];
        if (upchargeAmount && upchargeAmount > 0) {
            return `<span class="size-pill size-pill--upcharge" data-upcharge="+$${upchargeAmount}">${escapeHtml(size)}</span>`;
        }
        return `<span class="size-pill">${escapeHtml(size)}</span>`;
    }

    function bindGalleryThumbs() {
        const thumbs = document.querySelectorAll('.gallery__thumb');
        const mainImg = document.getElementById('gallery-main-img');
        if (!mainImg) return;
        thumbs.forEach(thumb => {
            thumb.addEventListener('click', () => {
                thumbs.forEach(t => t.classList.remove('gallery__thumb--active'));
                thumb.classList.add('gallery__thumb--active');
                mainImg.style.opacity = '0';
                setTimeout(() => {
                    mainImg.src = thumb.dataset.img;
                    mainImg.style.opacity = '1';
                }, 100);
            });
        });
    }

    function bindColorSwatches() {
        const swatches = document.querySelectorAll('.color-swatch');
        const selectedText = document.getElementById('color-selected-text');
        const mainImg = document.getElementById('gallery-main-img');

        swatches.forEach(swatch => {
            swatch.addEventListener('click', () => {
                swatches.forEach(s => s.classList.remove('color-swatch--active'));
                swatch.classList.add('color-swatch--active');
                if (selectedText) selectedText.textContent = swatch.dataset.colorName;

                // Update main gallery image to color-specific shot if available
                const productImg = swatch.dataset.productImg;
                if (productImg && mainImg) {
                    mainImg.style.opacity = '0';
                    setTimeout(() => {
                        mainImg.src = productImg;
                        mainImg.style.opacity = '1';
                    }, 100);
                }
            });
        });
    }

    // ============================================================
    // PRICING RENDER
    // ============================================================
    function renderPricing() {
        const bundle = state.pricing;
        if (!bundle || !bundle.pricing) {
            renderPricingError();
            return;
        }

        const sizes = bundle.uniqueSizes || [];
        const standardSize = sizes.find(s => s.toUpperCase() === 'S')
            || sizes.find(s => s.toUpperCase() === 'OSFA')
            || sizes[0];

        const tiers = (bundle.tierData || []).slice().sort((a, b) => (a.MinQuantity || 0) - (b.MinQuantity || 0));

        // Update the in-info price card
        const priceVal = document.getElementById('info-price-value');
        const tier72 = tiers.find(t => t.MinQuantity >= 72) || tiers[tiers.length - 1];
        const price72 = bundle.pricing[tier72?.TierLabel]?.[standardSize];
        if (priceVal && price72 != null) {
            priceVal.innerHTML = formatPrice(price72);
        } else if (priceVal) {
            priceVal.innerHTML = '<span style="font-size:0.875rem;color:#6b7280;">Quote on request</span>';
        }

        // Render full tier table
        const tableWrap = document.querySelector('#volume-pricing-section .volume-pricing__table-wrap');
        if (!tableWrap) return;

        const rows = tiers.map(tier => {
            const price = bundle.pricing[tier.TierLabel]?.[standardSize];
            const isBest = (tier.MinQuantity >= 72);
            const ltm = tier.LTM_Fee > 0
                ? `<span class="tier-ltm-yes">+$${tier.LTM_Fee} small-order fee</span>`
                : `<span class="tier-ltm-no">No small-order fee</span>`;
            return `
                <tr class="${isBest ? 'tier-best' : ''}">
                    <td class="tier-label">${escapeHtml(tier.TierLabel)} pieces</td>
                    <td class="tier-price">${price != null ? formatPrice(price) : '—'}</td>
                    <td>${ltm}</td>
                </tr>
            `;
        }).join('');

        tableWrap.innerHTML = `
            <table class="volume-pricing__table">
                <thead>
                    <tr>
                        <th style="text-align:left; padding-left: 1.5rem;">Quantity</th>
                        <th>Per piece (size S)</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <p class="volume-pricing__caveat">
                ★ qty 72+ is our best price. Sizes 2XL+ have small upcharges (typically $2 / $3 / $4 per piece). Final pricing confirmed in your custom quote.
            </p>
        `;
    }

    function renderPricingError() {
        const tableWrap = document.querySelector('#volume-pricing-section .volume-pricing__table-wrap');
        if (tableWrap) {
            tableWrap.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: #6b7280;">
                    <i class="fas fa-info-circle" style="font-size: 1.5rem; color: var(--primary); margin-bottom: 0.5rem;"></i>
                    <p>Volume pricing for this style is available on request. <a href="golf-tournaments-2026.html?prefill=${encodeURIComponent(state.styleNumber)}#quote-form" style="color: var(--primary-dark); font-weight: 700;">Request a quote</a> or call ${COMPANY_PHONE}.</p>
                </div>
            `;
        }
        const priceVal = document.getElementById('info-price-value');
        if (priceVal) {
            priceVal.innerHTML = '<span style="font-size:0.875rem;color:#6b7280;">Quote on request</span>';
        }
    }

    // ============================================================
    // ERROR STATE
    // ============================================================
    function renderError(message) {
        const main = document.getElementById('product-main');
        if (!main) return;
        main.innerHTML = `
            <div class="product-error">
                <div class="product-error__icon"><i class="fas fa-triangle-exclamation"></i></div>
                <h2 class="product-error__title">We couldn't load this product</h2>
                <p class="product-error__lead">${escapeHtml(message || 'Something went wrong fetching product data.')}</p>
                <a href="golf-tournaments-2026.html" class="btn-primary" style="display:inline-flex;">
                    <i class="fas fa-arrow-left"></i>
                    Back to Tournament Apparel
                </a>
            </div>
        `;
    }

    // ============================================================
    // BOOT
    // ============================================================
    function setFooterYear() {
        const el = document.getElementById('g-footer-year');
        if (el) el.textContent = new Date().getFullYear();
    }

    async function init() {
        setFooterYear();

        const styleNumber = getStyleParam();
        if (!styleNumber) {
            renderError('No style number specified in the URL. Try going back to the catalog.');
            return;
        }
        state.styleNumber = styleNumber;

        if (typeof EmbroideryPricingService === 'undefined') {
            console.error('[golf-product] EmbroideryPricingService not loaded');
            renderError('Pricing service unavailable. Please reload or call ' + COMPANY_PHONE + '.');
            return;
        }
        state.embroideryService = new EmbroideryPricingService();

        // Fetch product + pricing in parallel
        const [productResult, pricingResult] = await Promise.allSettled([
            loadProduct(styleNumber),
            loadPricing(styleNumber)
        ]);

        if (productResult.status === 'rejected') {
            console.error('[golf-product] Product load failed:', productResult.reason);
            renderError(productResult.reason?.message || 'Product not found.');
            return;
        }

        state.product = productResult.value;
        renderProduct();

        if (pricingResult.status === 'fulfilled') {
            state.pricing = pricingResult.value;
            renderPricing();
        } else {
            console.warn('[golf-product] Pricing load failed:', pricingResult.reason);
            renderPricingError();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
