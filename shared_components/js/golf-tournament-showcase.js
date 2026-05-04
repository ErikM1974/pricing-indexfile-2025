/**
 * Golf Tournament Showcase — Landing page logic
 *
 * Page: pages/golf-tournaments-2026.html
 *
 * Pulls the live preferred-style list from the Garment Tracker config endpoint,
 * fetches embroidery pricing for each style via EmbroideryPricingService, and
 * renders the product grid with per-piece pricing at qty 24/48/72/144.
 *
 * Form submission uses EmailJS dual-fire (customer confirmation + sales lead alert)
 * mirroring the pattern from calculators/christmas-bundles.html.
 */
(function () {
    'use strict';

    // ============================================================
    // CONFIG
    // ============================================================
    const API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const STITCH_COUNT = 8000;
    const QTY_TIERS = [24, 48, 72, 144];

    // EmailJS — service & template IDs.
    // Public key + service ID per CLAUDE.md; templates must be created in EmailJS dashboard.
    const EMAILJS_PUBLIC_KEY = '4qSbDO-SQs19TbP80';
    const EMAILJS_SERVICE_ID = 'service_1c4k67j';
    const EMAILJS_CUSTOMER_TEMPLATE = 'template_golf_customer';
    const EMAILJS_LEAD_TEMPLATE = 'template_golf_lead';

    const SALES_REP_EMAILS = 'taneisha@nwcustomapparel.com, nika@nwcustomapparel.com, erik@nwcustomapparel.com';
    const COMPANY_PHONE = '253-922-5793';

    // Map a style key to a coarse filter tag used by the chip filter
    const FILTER_TAGS = {
        'TravisMathew Outerwear & Vests': 'outerwear',
        'TravisMathew & Nike Polos': 'polos',
        'OGIO & Sport-Tek Tops': 'tops',
        'Sport-Tek Bottoms': 'bottoms',
        'Golf Towels': 'towels',
        'Hemmed Towels': 'towels'
    };

    // Hero example-package picks (one polo + one towel + bonus included)
    // Picks the most popular polo and a standard golf towel for the worked example
    const EXAMPLE_POLO = 'TM1MU410'; // TravisMathew Coto Performance Polo
    const EXAMPLE_TOWEL = 'TW51';    // Port Authority Grommeted Golf Towel

    // ============================================================
    // STATE
    // ============================================================
    const state = {
        config: null,
        pricing: new Map(), // styleNumber -> { '24': price, '48': price, ... } or { error: msg }
        embroideryService: null,
        quoteService: null  // BaseQuoteService instance for Caspio saves (prefix: GOLF)
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

    function getSanmarImageUrl(styleNumber) {
        // SanMar CDN — main catalog image, served by cdnm.sanmar.com.
        // Pattern confirmed via /api/products/search response shape.
        return `https://cdnm.sanmar.com/catalog/images/${encodeURIComponent(styleNumber)}.jpg`;
    }

    function generateFallbackQuoteId() {
        // Used only when BaseQuoteService isn't available (script load failure)
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const seq = String(Math.floor(Math.random() * 900) + 100);
        return `GOLF${mm}${dd}-${seq}`;
    }

    /**
     * Persist the lead to Caspio quote_sessions table (prefix: GOLF).
     * Returns { quoteID, savedToCaspio } — never throws. EmailJS fires regardless.
     */
    async function saveLeadToCaspio(formData) {
        if (!state.quoteService) {
            return { quoteID: generateFallbackQuoteId(), savedToCaspio: false, reason: 'service-unavailable' };
        }

        const interestsSummary = formData.interests.length ? formData.interests.join(', ') : 'Not specified';
        const tournamentDateFmt = formatTournamentDate(formData.tournamentDate);

        // Pack lead context into Notes since we don't have line items at submission time
        const notesPayload = [
            `Tournament: ${tournamentDateFmt}`,
            `Player count: ${formData.playerCount}`,
            `Interests: ${interestsSummary}`,
            `Phone: ${formData.phone}`,
            formData.notes ? `Customer notes: ${formData.notes}` : null
        ].filter(Boolean).join(' | ');

        const result = await state.quoteService.saveQuote({
            customerEmail: formData.email,
            customerName: formData.name,
            companyName: formData.company,
            totalQuantity: parseInt(formData.playerCount, 10) || 0,
            subtotal: 0,        // Lead inquiry — sales team builds the actual quote later
            ltmFeeTotal: 0,
            totalCost: 0,
            notes: notesPayload
        });

        return {
            quoteID: result.quoteID,
            savedToCaspio: !!result.success,
            error: result.error
        };
    }

    function tierLabelForQty(qty) {
        if (qty <= 7) return '1-7';
        if (qty <= 23) return '8-23';
        if (qty <= 47) return '24-47';
        if (qty <= 71) return '48-71';
        return '72+';
    }

    // ============================================================
    // DATA LOADING
    // ============================================================
    async function loadConfig() {
        const resp = await fetch(`${API_BASE}/api/garment-tracker/config`);
        if (!resp.ok) throw new Error(`Garment tracker config failed: ${resp.status}`);
        const json = await resp.json();
        if (!json.success || !json.config) throw new Error('Invalid garment tracker config response');
        return json.config;
    }

    async function loadPricingForStyle(styleNumber) {
        try {
            const bundle = await state.embroideryService.fetchPricingData(styleNumber);

            // Pull Small (or first available) price from each tier.
            // The pricing object is keyed by tier label, then size.
            const sizes = bundle.uniqueSizes || [];
            const standardSize = sizes.find(s => s.toUpperCase() === 'S')
                || sizes.find(s => s.toUpperCase() === 'OSFA')
                || sizes[0];

            if (!standardSize) {
                return { error: 'No size data' };
            }

            const result = {};
            QTY_TIERS.forEach(qty => {
                const tier = tierLabelForQty(qty);
                const price = bundle.pricing?.[tier]?.[standardSize];
                result[qty] = (price != null && !isNaN(price)) ? Number(price) : null;
            });
            result.size = standardSize;
            return result;
        } catch (err) {
            console.warn(`[golf-showcase] Pricing failed for ${styleNumber}:`, err.message);
            return { error: err.message || 'Quote on request' };
        }
    }

    // ============================================================
    // RENDERING — product grid
    // ============================================================
    function renderShowcaseSkeleton() {
        const container = document.getElementById('product-categories');
        if (!container || !state.config?.itemGroups) return;

        const html = state.config.itemGroups.map((group, idx) => {
            const tag = FILTER_TAGS[group.name] || 'all';
            const cards = group.styles.map(sku => {
                const item = state.config.premiumItems[sku];
                if (!item) return '';
                return renderProductCard(sku, item.name, tag);
            }).join('');

            const isLeadCategory = group.name === 'TravisMathew & Nike Polos';
            const collapsed = isLeadCategory ? '' : 'category--collapsed';

            return `
                <div class="category ${collapsed}" data-category-tag="${escapeHtml(tag)}" data-category-name="${escapeHtml(group.name)}">
                    <div class="category__header" role="button" tabindex="0" aria-expanded="${isLeadCategory ? 'true' : 'false'}">
                        <h3>
                            <i class="fas fa-flag"></i>
                            ${escapeHtml(group.name)}
                        </h3>
                        <div class="category__header-meta">
                            <span>${group.styles.length} style${group.styles.length === 1 ? '' : 's'}</span>
                            <i class="fas fa-chevron-down category__chevron"></i>
                        </div>
                    </div>
                    <div class="category__grid">${cards}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        bindCategoryToggles();
    }

    function renderProductCard(sku, name, filterTag) {
        const detailUrl = `golf-tournament-product.html?style=${encodeURIComponent(sku)}`;
        return `
            <article class="product-card" data-sku="${escapeHtml(sku)}" data-filter="${escapeHtml(filterTag)}">
                <a href="${detailUrl}" class="product-card__image" aria-label="View ${escapeHtml(name)} colors and details">
                    <img src="${getSanmarImageUrl(sku)}"
                         alt="${escapeHtml(name)}"
                         loading="lazy"
                         onerror="this.style.display='none';this.parentNode.innerHTML='<i class=\\'fas fa-tshirt product-card__image-placeholder\\'></i>'">
                </a>
                <div class="product-card__body">
                    <div class="product-card__sku">${escapeHtml(sku)}</div>
                    <a href="${detailUrl}" class="product-card__name-link">
                        <div class="product-card__name">${escapeHtml(name)}</div>
                    </a>
                    <div class="product-card__price-snapshot" data-price-snapshot>
                        <span class="product-card__price-pending">
                            <i class="fas fa-spinner fa-spin"></i> Loading price&hellip;
                        </span>
                    </div>
                </div>
                <a href="${detailUrl}" class="product-card__detail-link">
                    <i class="fas fa-palette"></i>
                    <span>See colors, sizes &amp; details</span>
                    <i class="fas fa-arrow-right"></i>
                </a>
                <button class="product-card__expand"
                        type="button"
                        aria-expanded="false"
                        aria-controls="pricing-${escapeHtml(sku)}"
                        data-expand-toggle>
                    <span>Quick view: volume pricing</span>
                    <i class="fas fa-chevron-down"></i>
                </button>
                <div class="product-card__pricing-table" id="pricing-${escapeHtml(sku)}" data-pricing-table>
                    <span class="product-card__price-pending">Loading&hellip;</span>
                </div>
                <div class="product-card__note">Includes 8,000-stitch logo embroidery, 1 location</div>
            </article>
        `;
    }

    function bindCategoryToggles() {
        document.querySelectorAll('.category').forEach(cat => {
            const header = cat.querySelector('.category__header');
            if (!header) return;
            const toggle = () => {
                const isCollapsed = cat.classList.toggle('category--collapsed');
                header.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
            };
            header.addEventListener('click', toggle);
            header.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle();
                }
            });
        });
    }

    function bindCardExpanders() {
        document.querySelectorAll('[data-expand-toggle]').forEach(btn => {
            btn.addEventListener('click', () => {
                const expanded = btn.getAttribute('aria-expanded') === 'true';
                btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
            });
        });
    }

    function bindFilterChips() {
        const chips = document.querySelectorAll('.filter-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('filter-chip--active'));
                chip.classList.add('filter-chip--active');
                applyFilter(chip.dataset.filter);
            });
        });
    }

    function applyFilter(tag) {
        document.querySelectorAll('.category').forEach(cat => {
            const catTag = cat.dataset.categoryTag;
            const matches = (tag === 'all' || catTag === tag);
            cat.style.display = matches ? '' : 'none';
            // Auto-expand the matching category when user picks a non-all filter
            if (matches && tag !== 'all') {
                cat.classList.remove('category--collapsed');
                const header = cat.querySelector('.category__header');
                if (header) header.setAttribute('aria-expanded', 'true');
            }
        });
    }

    // ============================================================
    // RENDERING — fill in prices once they arrive
    // ============================================================
    function fillPriceInCard(sku, priceData) {
        const card = document.querySelector(`.product-card[data-sku="${CSS.escape(sku)}"]`);
        if (!card) return;

        const snapshot = card.querySelector('[data-price-snapshot]');
        const table = card.querySelector('[data-pricing-table]');

        if (priceData.error || priceData[72] == null) {
            const msg = priceData.error || 'Quote on request';
            snapshot.innerHTML = `<span class="product-card__price-pending">${escapeHtml(msg)}</span>`;
            table.innerHTML = `<p style="text-align:center;color:#6b7280;font-size:0.8125rem;padding:0.5rem;">Contact Taneisha for pricing on this style.</p>`;
            return;
        }

        snapshot.innerHTML = `
            <span class="product-card__price-label">From</span>
            <span class="product-card__price-value">${formatPrice(priceData[72])}</span>
            <span class="product-card__price-suffix">/player at qty 72+</span>
        `;

        const rows = QTY_TIERS.map(qty => {
            const price = priceData[qty];
            const isBest = (qty === 72);
            return `<th class="${isBest ? 'col-best' : ''}">Qty ${qty}</th>`;
        }).join('');

        const cells = QTY_TIERS.map(qty => {
            const price = priceData[qty];
            const isBest = (qty === 72);
            return `<td class="${isBest ? 'col-best' : ''}">${formatPrice(price)}</td>`;
        }).join('');

        table.innerHTML = `
            <table class="pricing-table">
                <thead><tr>${rows}</tr></thead>
                <tbody><tr>${cells}</tr></tbody>
            </table>
            <p style="font-size:0.6875rem;color:#6b7280;margin-top:0.5rem;text-align:center;">
                Per piece, embroidered. +$50 small-order fee under qty 24. Final pricing confirmed in your quote.
            </p>
        `;
    }

    async function loadAllPricing() {
        const skus = Object.keys(state.config.premiumItems);

        // Fire all in parallel — embroidery service caches results in sessionStorage
        const promises = skus.map(async sku => {
            const result = await loadPricingForStyle(sku);
            state.pricing.set(sku, result);
            fillPriceInCard(sku, result);
            return { sku, result };
        });

        await Promise.allSettled(promises);
        renderExamplePackage();
    }

    // ============================================================
    // RENDERING — example package
    // ============================================================
    function renderExamplePackage() {
        const container = document.getElementById('example-package-card');
        if (!container) return;

        const polo = state.pricing.get(EXAMPLE_POLO);
        const towel = state.pricing.get(EXAMPLE_TOWEL);
        const poloItem = state.config.premiumItems[EXAMPLE_POLO];
        const towelItem = state.config.premiumItems[EXAMPLE_TOWEL];

        if (!polo || !towel || polo.error || towel.error) {
            container.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-info-circle"></i>
                    <span>Sample package pricing available on request &mdash; submit the form below.</span>
                </div>
            `;
            return;
        }

        const playerCount = 72;
        const poloUnit = polo[72];
        const towelUnit = towel[72];
        const poloLine = poloUnit * playerCount;
        const towelLine = towelUnit * playerCount;
        const subtotal = poloLine + towelLine;
        // Summer Bonus is FREE on top — not subtracted from total. We show the value to anchor the offer.
        const DIGITIZING_VALUE = 100;
        const GOLF_BAG_VALUE = 239; // OGIO Vision 2.0 — value with embroidered logo
        const bonusValue = DIGITIZING_VALUE + GOLF_BAG_VALUE;

        container.innerHTML = `
            <table class="example-package__line-items">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th class="num">Qty</th>
                        <th class="num">Per piece</th>
                        <th class="num">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${escapeHtml(poloItem.name)} &mdash; embroidered</td>
                        <td class="num">${playerCount}</td>
                        <td class="num">${formatPrice(poloUnit)}</td>
                        <td class="num">${formatPrice(poloLine)}</td>
                    </tr>
                    <tr>
                        <td>${escapeHtml(towelItem.name)} &mdash; embroidered</td>
                        <td class="num">${playerCount}</td>
                        <td class="num">${formatPrice(towelUnit)}</td>
                        <td class="num">${formatPrice(towelLine)}</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3">Estimated package total (before tax &amp; shipping)</td>
                        <td class="num">${formatPrice(subtotal)}</td>
                    </tr>
                </tfoot>
            </table>
            <div class="example-package__bonus">
                <div class="example-package__bonus-header">
                    &#127873; <strong>PLUS Summer Bonus (FREE)</strong> &mdash; ~${formatPrice(bonusValue)} value included (this order clears the $2,000 threshold)
                </div>
                <ul class="example-package__bonus-list">
                    <li><strong>$100 logo digitizing</strong> &mdash; one-time setup fee waived</li>
                    <li><strong>OGIO Vision 2.0 Golf Bag</strong> ($239 value) embroidered with your logo &mdash; yours to give to the organizer or use as a winner&rsquo;s prize</li>
                </ul>
            </div>
            <p class="example-package__caveat">
                Worked example for 72 players, base size (S). Final quote includes any size upcharges (typically $2 for 2XL, $3 for 3XL) and your sales tax + shipping (or pickup at our Milton factory &mdash; free). Standard turnaround is 14 business days from logo approval &mdash; book early.
            </p>
        `;
    }

    // ============================================================
    // FORM SUBMIT
    // ============================================================
    function bindForm() {
        const form = document.getElementById('golf-quote-form');
        const success = document.getElementById('form-success');
        if (!form || !success) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('qf-submit');
            const originalBtn = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending&hellip;';

            try {
                const formData = collectFormData();
                const validationError = validateFormData(formData);
                if (validationError) {
                    alert(validationError);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtn;
                    return;
                }

                // Save to Caspio quote_sessions (prefix: GOLF). Returns a quote ID either way.
                const saveResult = await saveLeadToCaspio(formData);
                const quoteId = saveResult.quoteID;
                if (!saveResult.savedToCaspio) {
                    console.warn('[golf-showcase] Caspio save failed — lead lives in EmailJS + console only:', saveResult.error);
                }

                const utm = getUtmParams();
                const leadScore = scoreLead(formData);

                // Customer confirmation email — comes from sales@, signed by team
                const customerParams = {
                    to_email: formData.email,
                    customer_name: formData.name,
                    company_name: formData.company,
                    quote_id: quoteId,
                    tournament_date: formatTournamentDate(formData.tournamentDate),
                    player_count: formData.playerCount,
                    interests: formData.interests.join(', ') || 'Not specified',
                    notes: formData.notes || 'None',
                    sales_email: 'sales@nwcustomapparel.com',
                    sales_phone: COMPANY_PHONE,
                    company_phone: COMPANY_PHONE,
                    reply_to: 'sales@nwcustomapparel.com'
                };

                // Internal lead alert email (fires in parallel)
                const leadParams = {
                    to_email: SALES_REP_EMAILS,
                    quote_id: quoteId,
                    lead_score: leadScore.label,
                    lead_score_emoji: leadScore.emoji,
                    customer_name: formData.name,
                    customer_email: formData.email,
                    customer_phone: formData.phone,
                    company_name: formData.company,
                    tournament_date: formatTournamentDate(formData.tournamentDate),
                    player_count: formData.playerCount,
                    interests: formData.interests.join(', ') || 'Not specified',
                    notes: formData.notes || 'None',
                    submitted_at: new Date().toLocaleString('en-US', {
                        timeZone: 'America/Los_Angeles',
                        dateStyle: 'short',
                        timeStyle: 'short'
                    }),
                    utm_source: utm.source || 'direct',
                    utm_campaign: utm.campaign || '(none)',
                    utm_medium: utm.medium || '(none)',
                    talking_points: leadScore.talkingPoints,
                    reply_to: formData.email
                };

                // Fire both emails. Lead alert is the one that MUST succeed —
                // customer confirmation is nice-to-have. If lead alert fails, surface it.
                const [customerResult, leadResult] = await Promise.allSettled([
                    sendEmail(EMAILJS_CUSTOMER_TEMPLATE, customerParams),
                    sendEmail(EMAILJS_LEAD_TEMPLATE, leadParams)
                ]);

                if (leadResult.status === 'rejected') {
                    console.error('[golf-showcase] Lead alert failed:', leadResult.reason);
                    // Still show success to user — we have their info in console; Erik can recover.
                    // But surface a softer message so they know to expect a slight delay.
                    showSuccess(quoteId, true);
                } else {
                    showSuccess(quoteId, false);
                }

                if (customerResult.status === 'rejected') {
                    console.warn('[golf-showcase] Customer confirmation failed (non-blocking):', customerResult.reason);
                }

                // Log lead to console for recovery if EmailJS misconfigured
                console.log('[golf-showcase] LEAD CAPTURED:', {
                    quoteId,
                    ...formData,
                    leadScore: leadScore.label,
                    utm
                });

                form.reset();
            } catch (err) {
                console.error('[golf-showcase] Form submission error:', err);
                alert('There was an error sending your request. Please call Taneisha directly at 253-922-5793 or email taneisha@nwcustomapparel.com.');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtn;
            }
        });
    }

    function applyPrefill() {
        const params = new URLSearchParams(window.location.search);
        const style = params.get('prefill');
        if (!style) return;

        const item = state.config?.premiumItems?.[style];
        const styleLine = item ? `${style} (${item.name})` : style;
        const notes = document.getElementById('qf-notes');
        if (notes && !notes.value) {
            notes.value = `Especially interested in ${styleLine}. Please include this in my quote.`;
        }

        // Auto-check the right interest checkbox if we know the category
        if (item) {
            for (const group of (state.config.itemGroups || [])) {
                if (group.styles.includes(style)) {
                    const tag = (FILTER_TAGS[group.name] || '').toLowerCase();
                    const map = { polos: 'polos', outerwear: 'outerwear', bottoms: 'bottoms', towels: 'towels', tops: 'polos' };
                    const interestVal = map[tag];
                    if (interestVal) {
                        const cb = document.querySelector(`input[name="interests"][value="${interestVal}"]`);
                        if (cb) cb.checked = true;
                    }
                    break;
                }
            }
        }
    }

    function collectFormData() {
        return {
            company: document.getElementById('qf-company').value.trim(),
            name: document.getElementById('qf-name').value.trim(),
            email: document.getElementById('qf-email').value.trim(),
            phone: document.getElementById('qf-phone').value.trim(),
            tournamentDate: document.getElementById('qf-date').value,
            playerCount: document.getElementById('qf-players').value,
            interests: Array.from(document.querySelectorAll('input[name="interests"]:checked')).map(c => c.value),
            notes: document.getElementById('qf-notes').value.trim()
        };
    }

    function validateFormData(d) {
        if (!d.company) return 'Please enter your tournament name or company.';
        if (!d.name) return 'Please enter your name.';
        if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return 'Please enter a valid email address.';
        if (!d.phone) return 'Please enter a phone number so Taneisha can call you back.';
        if (!d.tournamentDate) return 'Please pick a tournament month.';
        if (!d.playerCount) return 'Please pick an estimated player count.';
        return null;
    }

    function formatTournamentDate(monthValue) {
        // monthValue is "YYYY-MM"
        if (!monthValue) return '';
        const [y, m] = monthValue.split('-');
        const date = new Date(Number(y), Number(m) - 1, 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    function getUtmParams() {
        const p = new URLSearchParams(window.location.search);
        return {
            source: p.get('utm_source'),
            campaign: p.get('utm_campaign'),
            medium: p.get('utm_medium')
        };
    }

    function scoreLead(d) {
        const players = d.playerCount === 'other' ? 0 : Number(d.playerCount);
        const tournamentDate = d.tournamentDate ? new Date(d.tournamentDate + '-01') : null;
        const daysAway = tournamentDate ? Math.round((tournamentDate - Date.now()) / 86400000) : null;

        // Bonus threshold: $2,000 subtotal. As a rough proxy from form data only,
        // 24+ pieces of any tournament-grade item will clear $2K (e.g., 24 polos × $87 = $2,088).
        // So almost every legitimate tournament lead is bonus-eligible.

        let label, emoji, talkingPoints;

        // Note: 14-business-day standard turnaround means tournaments < 30 days are RUSH territory.
        if (daysAway != null && daysAway < 60 && players >= 72) {
            label = 'HOT';
            emoji = '🔥';
            talkingPoints = `Tournament is ${daysAway} days away — production deadline tight (14-business-day standard). Confirm color/size mix on first call. Push for booking THIS WEEK to lock production slot. May need rush production fee. Subtotal will easily clear the $2,000 bonus threshold (free $100 digitizing + OGIO Vision 2.0 golf bag).`;
        } else if ((daysAway != null && daysAway < 90) || players >= 48) {
            label = 'WARM';
            emoji = '🟡';
            talkingPoints = `${players >= 48 ? 'Big group' : 'Tight timeline'}. Lead with the Summer Bonus: order subtotal of $2,000+ unlocks free $100 digitizing + a free embroidered OGIO Vision 2.0 golf bag for the organizer/winner. Send Embroidery Quote Builder link with 3-4 polo options.`;
        } else {
            label = 'STANDARD';
            emoji = '🟢';
            talkingPoints = `Earlier-stage lead. Educate on the volume tier breakpoints AND the $2,000 subtotal bonus threshold (free golf bag + digitizing). Suggest mixing in towels/hats to push subtotal over $2K.`;
        }
        return { label, emoji, talkingPoints };
    }

    async function sendEmail(templateId, params) {
        if (typeof emailjs === 'undefined') {
            throw new Error('EmailJS library not loaded');
        }
        return emailjs.send(EMAILJS_SERVICE_ID, templateId, params);
    }

    function showSuccess(quoteId, withLeadWarning) {
        const form = document.getElementById('golf-quote-form');
        const success = document.getElementById('form-success');
        const idEl = document.getElementById('form-success-id');

        if (idEl) idEl.textContent = quoteId;
        if (form) form.hidden = true;
        if (success) {
            success.hidden = false;
            success.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (withLeadWarning) {
            // Quietly log — don't alarm the user.
            console.warn('[golf-showcase] Lead notification email failed; lead is in console only.');
        }
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

        // Initialize EmailJS
        if (typeof emailjs !== 'undefined') {
            emailjs.init(EMAILJS_PUBLIC_KEY);
        } else {
            console.warn('[golf-showcase] EmailJS not loaded — form submission will fail until script tag is fixed.');
        }

        // Initialize the Caspio quote-save service (prefix: GOLF). Optional — form still works without it.
        if (typeof BaseQuoteService !== 'undefined') {
            state.quoteService = new BaseQuoteService({
                prefix: 'GOLF',
                storagePrefix: 'golf',
                sessionPrefix: 'golf_sess'
            });
        } else {
            console.warn('[golf-showcase] BaseQuoteService not loaded — leads will not be saved to Caspio.');
        }

        // Initialize embroidery pricing service (defined in embroidery-pricing-service.js)
        if (typeof EmbroideryPricingService === 'undefined') {
            console.error('[golf-showcase] EmbroideryPricingService not loaded — pricing will not display.');
            const container = document.getElementById('product-categories');
            if (container) {
                container.innerHTML = `<div class="loading-state"><i class="fas fa-triangle-exclamation"></i><span>Pricing service unavailable. Please reload the page or call ${COMPANY_PHONE}.</span></div>`;
            }
            bindForm();
            return;
        }
        state.embroideryService = new EmbroideryPricingService();

        bindFilterChips();
        bindForm();

        try {
            state.config = await loadConfig();
        } catch (err) {
            console.error('[golf-showcase] Config load failed:', err);
            const container = document.getElementById('product-categories');
            if (container) {
                container.innerHTML = `
                    <div class="loading-state">
                        <i class="fas fa-triangle-exclamation"></i>
                        <span>Apparel catalog couldn't load. Call ${COMPANY_PHONE} or use the form below to request a quote.</span>
                    </div>
                `;
            }
            return;
        }

        renderShowcaseSkeleton();
        bindCardExpanders();

        // Now that config is loaded, apply any ?prefill=STYLE param to the form
        applyPrefill();

        // Background-load all pricing in parallel
        loadAllPricing();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

// Sticky anchor nav — slides in once visitor scrolls past the hero
(function stickyNav() {
    function init() {
        const nav = document.querySelector('[data-sticky-nav]');
        const hero = document.querySelector('.hero');
        if (!nav || !hero || !('IntersectionObserver' in window)) return;

        const observer = new IntersectionObserver(([entry]) => {
            nav.classList.toggle('is-visible', !entry.isIntersecting);
        }, {
            rootMargin: '-80px 0px 0px 0px',
            threshold: 0
        });

        observer.observe(hero);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

// Team-photo lightbox — click any team card image to open a full-screen viewer
(function teamLightbox() {
    function init() {
        const lb = document.querySelector('[data-lightbox]');
        const triggers = [...document.querySelectorAll('.team__card .team__card-image')];
        if (!lb || !triggers.length) return;

        const lbImg = lb.querySelector('.lightbox__image');
        const lbCap = lb.querySelector('.lightbox__caption');
        const closeBtn = lb.querySelector('.lightbox__close');
        const prevBtn = lb.querySelector('.lightbox__prev');
        const nextBtn = lb.querySelector('.lightbox__next');

        let currentIndex = -1;
        let lastFocused = null;

        function open(index) {
            if (index < 0 || index >= triggers.length) return;
            currentIndex = index;
            const trigger = triggers[index];
            const sourceImg = trigger.querySelector('img');
            const figcap = trigger.closest('.team__card').querySelector('figcaption');
            if (!sourceImg) return;
            lbImg.src = sourceImg.src;
            lbImg.alt = sourceImg.alt || '';
            lbCap.textContent = figcap ? figcap.textContent.trim() : '';
            lb.classList.add('is-open');
            lb.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            lastFocused = document.activeElement;
            closeBtn.focus();
        }

        function close() {
            lb.classList.remove('is-open');
            lb.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            lbImg.src = '';
            if (lastFocused && typeof lastFocused.focus === 'function') {
                lastFocused.focus();
            }
        }

        function navigate(delta) {
            const next = (currentIndex + delta + triggers.length) % triggers.length;
            open(next);
        }

        triggers.forEach((trigger, i) => {
            trigger.setAttribute('role', 'button');
            trigger.setAttribute('tabindex', '0');
            trigger.setAttribute('aria-label', 'View larger photo');
            trigger.addEventListener('click', () => open(i));
            trigger.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open(i);
                }
            });
        });

        closeBtn.addEventListener('click', close);
        prevBtn.addEventListener('click', () => navigate(-1));
        nextBtn.addEventListener('click', () => navigate(1));
        lb.addEventListener('click', (e) => {
            if (e.target === lb) close();
        });
        document.addEventListener('keydown', (e) => {
            if (!lb.classList.contains('is-open')) return;
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowLeft') navigate(-1);
            else if (e.key === 'ArrowRight') navigate(1);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
