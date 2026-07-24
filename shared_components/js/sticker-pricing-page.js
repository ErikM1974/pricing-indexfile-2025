/**
 * sticker-pricing-page.js
 *
 * Page logic for /calculators/sticker-manual-pricing.html:
 *   1. Fetch /api/sticker-pricing on load, render 5 pricing tables (one per size).
 *   2. AI chat panel — open/close, SSE streaming chat with Claude via
 *      /api/contract-sticker-ai/chat.
 *   3. Parse PRICE_QUOTE blocks from the AI stream → highlight matching
 *      pricing-table row(s) on the page.
 *   4. Parse CUSTOMER_FINAL + EMAIL DRAFT blocks → render email-draft card,
 *      enable Copy email / Save quote actions.
 *   5. Save quote → POST quote_sessions + quote_items with STK prefix.
 *
 * Mirrors the pattern of embroidery-contract.js (CEMB AI bot) but inverted:
 *   - CEMB: rep pre-fills a calculator, opens chat to draft an email.
 *   - Stickers: rep opens chat first, the bot drives the inputs via the
 *     quote_sticker_price tool, then drafts.
 */

(function () {
    'use strict';

    // -----------------------------------------------------------------
    // Config
    // -----------------------------------------------------------------
    const API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const AI_ENDPOINT = API_BASE_URL + '/api/contract-sticker-ai/chat';
    const QUOTE_PREFIX = 'STK';

    // -----------------------------------------------------------------
    // State
    // -----------------------------------------------------------------
    let pricingData = null;         // { grid: [...], setupFee: {...} }
    let bannerRates = null;         // { rates: [...], setupFee: {...} }
    let decalData = null;           // { tiers: [...], minMaterial, setupFee, safeRollWidthIn }
    const aiState = {
        opened: false,
        messages: [],               // [{role, content}, ...]
        isStreaming: false,
        currentPriceQuote: null,    // last parsed PRICE_QUOTE block
        currentCustomerFinal: null, // last parsed CUSTOMER_FINAL block
        currentEmailDraft: null,    // {to, subject, body}
        lastLookup: null,           // last single-match from lookup_customer
        quoteID: null,
        quoteIDPromise: null,
        savedQuoteID: null,         // populated after save → enables copy-link
        sessionSaved: false,        // quote_sessions row written? (retry-safe)
        savedItemLines: [],         // LineNumbers already persisted (retry-safe)
        greeted: false,             // static greeting shown (no AI call burned on open)
    };

    // -----------------------------------------------------------------
    // Boot
    // -----------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        wireChatPanel();
        wireDecalCalculator();
        // Show the floating "Quote" button by default — hidden by the
        // openChatPanel call once the chat opens.
        showFloatingButton();
        await Promise.all([loadAndRenderPricing(), loadAndRenderBannerRates(), loadAndRenderDecalPricing()]);
        // Auto-open ONCE per browser session — greet the rep the first time
        // they land, but don't slam the drawer open on every refresh or
        // navigation. The greeting renders statically (see renderStaticGreeting),
        // so first paint costs no AI call and reserves no STK quote number until
        // the rep actually responds. Pass {auto:true} so we don't yank focus
        // into the textarea on an unprompted open.
        try {
            if (!sessionStorage.getItem('stk_chat_autoopened')) {
                sessionStorage.setItem('stk_chat_autoopened', '1');
                setTimeout(() => {
                    if (!aiState.opened) openChatPanel({ auto: true });
                }, 600);
            }
        } catch (_) {
            // sessionStorage unavailable (private mode / blocked) — skip auto-open.
        }
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    function fmtMoney(n) {
        if (!Number.isFinite(n)) return '0.00';
        return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    function fmtInt(n) {
        if (!Number.isFinite(n)) return '0';
        return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    // 🔴 Per-sticker is ALWAYS derived from the total, never the stored
    // PricePerSticker column — 26 of the 50 rows don't reconcile (STK-4X4-10000
    // publishes $0.58, which multiplies back to $5,800 against a real $5,846).
    // Reps quote off this table, so the number here has to survive being
    // multiplied. 3dp under a dollar, 2dp above.
    function fmtUnit(row) {
        const unit = Number.isFinite(row.unitPrice)
            ? row.unitPrice
            : (row.Quantity > 0 ? row.TotalPrice / row.Quantity : 0);
        if (!Number.isFinite(unit)) return '0.00';
        return unit < 1 ? unit.toFixed(3) : fmtMoney(unit);
    }

    // -----------------------------------------------------------------
    // Pricing tables: fetch + render
    // -----------------------------------------------------------------
    async function loadAndRenderPricing() {
        const grid = document.getElementById('pricingGrid');
        const errorEl = document.getElementById('pricingError');
        try {
            const r = await fetch(API_BASE_URL + '/api/sticker-pricing');
            if (!r.ok) throw new Error('API returned ' + r.status);
            const data = await r.json();
            if (!Array.isArray(data.grid) || data.grid.length === 0) {
                throw new Error('empty pricing grid');
            }
            pricingData = data;
            renderPricingTables(grid, data);
            errorEl.hidden = true;
            // Rule 4: a hardcoded fallback is only permitted WITH a visible
            // warning. loadGrid() returns HTTP 200 + source:'inline' when Caspio
            // is unreachable, so without this the page shows backup prices that
            // look live. (Today the copies happen to be identical — that's luck,
            // not design.)
            const srcWarn = document.getElementById('pricingSourceWarn');
            if (srcWarn) srcWarn.hidden = (data.source === 'caspio' && !data.degraded);
        } catch (err) {
            console.error('[sticker-page] pricing load failed:', err);
            errorEl.hidden = false;
            grid.innerHTML = '';
        }
    }

    function renderPricingTables(container, data) {
        // Group rows by Size, preserving the canonical size order.
        const sizes = Array.from(new Set(data.grid.map(r => r.Size)));
        sizes.sort();
        const html = sizes.map(size => {
            const rows = data.grid
                .filter(r => r.Size === size)
                .sort((a, b) => a.Quantity - b.Quantity);
            const dim = size.replace('x', '" × ') + '"';
            const skuPrefix = 'STK-' + size.toUpperCase();
            const trs = rows.map(r => {
                const bestValueClass = r.IsBestValue ? ' best-value' : '';
                const bestValueBadge = r.IsBestValue
                    ? ' <span class="best-value-badge">Best Value</span>'
                    : '';
                return `
                    <tr class="pricing-row${bestValueClass}"
                        data-pn="${escapeHtml(r.PartNumber)}"
                        data-size="${escapeHtml(r.Size)}"
                        data-qty="${r.Quantity}">
                        <td class="partnumber-cell">${escapeHtml(r.PartNumber)}</td>
                        <td>${fmtInt(r.Quantity)}${bestValueBadge}</td>
                        <td class="price-highlight">$${fmtMoney(r.TotalPrice)}</td>
                        <td>&approx;&nbsp;$${fmtUnit(r)}</td>
                    </tr>`;
            }).join('');
            return `
                <section class="pricing-section" data-size="${escapeHtml(size)}">
                    <h2 class="size-title">
                        <i class="fas fa-square"></i> ${escapeHtml(dim)} Stickers
                        <span class="pn-prefix">${escapeHtml(skuPrefix)}-*</span>
                    </h2>
                    <table class="pricing-table">
                        <thead>
                            <tr>
                                <th>Part #</th>
                                <th>Quantity</th>
                                <th>Total Price</th>
                                <th>Per Sticker <small>(total ÷ qty)</small></th>
                            </tr>
                        </thead>
                        <tbody>${trs}</tbody>
                    </table>
                    <p class="banner-formula">
                        Quote the <strong>Total Price</strong> &mdash; it&rsquo;s exact.
                        Per-sticker figures are rounded for reading, so multiplying one back out
                        won&rsquo;t always land on the total.
                    </p>
                </section>`;
        }).join('');
        container.innerHTML = html;
    }

    // -----------------------------------------------------------------
    // Banner rate card: fetch + render
    // -----------------------------------------------------------------
    async function loadAndRenderBannerRates() {
        const grid = document.getElementById('bannerRateGrid');
        if (!grid) return;
        try {
            const r = await fetch(API_BASE_URL + '/api/banner-pricing');
            if (!r.ok) throw new Error('API returned ' + r.status);
            const data = await r.json();
            if (!Array.isArray(data.rates) || data.rates.length === 0) {
                throw new Error('empty banner rate card');
            }
            bannerRates = data;
            renderBannerRateCards(grid, data);
        } catch (err) {
            console.error('[sticker-page] banner rates load failed:', err);
            grid.innerHTML = '<div class="banner-formula" style="background:rgba(220,38,38,0.3);color:#fff;">Unable to load banner rates — refresh or contact Erik.</div>';
        }
    }

    function renderBannerRateCards(container, data) {
        const cards = data.rates.map(rate => {
            const isIncluded = rate.IsDefault === true;
            const rateNum = Number(rate.Rate) || 0;
            const isMultiplier = rate.PriceType === 'multiplier';
            const isMin = rate.PriceType === 'minimum';
            const ratePrefix = isMultiplier ? '' : '$';
            const rateSuffix = isMultiplier ? '×' : '';
            let unitLabel;
            switch (rate.PriceType) {
                case 'per_sqft': unitLabel = '/ sqft'; break;
                case 'minimum': unitLabel = 'minimum'; break;
                case 'per_unit': unitLabel = `/ ${rate.Unit || 'unit'}`; break;
                case 'per_lf': unitLabel = '/ linear foot'; break;
                case 'multiplier': unitLabel = 'multiplier'; break;
                default: unitLabel = rate.Unit || '';
            }
            return `
                <div class="banner-rate-card${isIncluded ? ' included' : ''}"
                     data-pn="${escapeHtml(rate.PartNumber)}">
                    <div class="pn">${escapeHtml(rate.PartNumber)}</div>
                    ${isIncluded ? '<div class="included-badge">Default</div>' : ''}
                    <div class="rate">${ratePrefix}${rateNum.toFixed(2)}${rateSuffix}<span class="unit"> ${escapeHtml(unitLabel)}</span></div>
                    <div class="desc">${escapeHtml(rate.Description || '')}</div>
                </div>`;
        }).join('');
        container.innerHTML = cards;
    }

    function highlightBannerRateCardByPartNumber(partNumber) {
        if (!partNumber) return;
        const card = document.querySelector(`.banner-rate-card[data-pn="${CSS.escape(partNumber)}"]`);
        if (!card) return;
        document.querySelectorAll('.banner-rate-card.highlighted').forEach(c => c.classList.remove('highlighted'));
        card.classList.add('highlighted');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // -----------------------------------------------------------------
    // Custom & oversize decal — API-driven rate card + square-foot calculator
    // Pricing comes ENTIRELY from /api/custom-decal-pricing (Rule #6: no
    // hardcoded prices). Compute mirrors caspio-pricing-proxy
    // src/routes/custom-decal-pricing.js computeDecalQuote() — keep in sync.
    // -----------------------------------------------------------------
    function round2(n) { return Math.round(n * 100) / 100; }

    async function loadAndRenderDecalPricing() {
        const grid = document.getElementById('decalRateGrid');
        if (!grid) return;
        try {
            const r = await fetch(API_BASE_URL + '/api/custom-decal-pricing');
            if (!r.ok) throw new Error('API returned ' + r.status);
            const data = await r.json();
            if (!Array.isArray(data.tiers) || data.tiers.length === 0) throw new Error('empty decal rate card');
            data.tiers.sort((a, b) => Number(a.MaxSqFt) - Number(b.MaxSqFt));
            decalData = data;
            renderDecalRateCard(grid, data);
            const minNote = document.getElementById('decalMinNote');
            if (minNote) minNote.textContent = '$' + fmtMoney(Number(data.minMaterial) || 90) + ' material';
            recomputeDecal(); // first paint now that rates are loaded
        } catch (err) {
            console.error('[sticker-page] decal rates load failed:', err);
            grid.innerHTML = '<div class="banner-formula" style="background:rgba(159,31,31,0.10);color:var(--err);border-color:#e8b5b1;">Unable to load custom-decal rates — refresh or contact Erik.</div>';
        }
    }

    // Human label for a tier given its index in the ascending-sorted list.
    function decalTierLabel(tiers, idx) {
        const t = tiers[idx];
        const hi = Number(t.MaxSqFt);
        const lo = idx === 0 ? 0 : Number(tiers[idx - 1].MaxSqFt);
        if (hi >= 999999) return 'Over ' + fmtInt(lo) + ' sq ft';
        if (idx === 0) return 'Up to ' + fmtInt(hi) + ' sq ft';
        return fmtInt(lo) + '–' + fmtInt(hi) + ' sq ft';
    }

    function renderDecalRateCard(container, data) {
        const tiers = data.tiers;
        const minMaterial = Number(data.minMaterial) || 90;
        const rows = tiers.map((t, idx) => {
            const floor = Number(t.floor) || 0;
            const floorCell = idx === 0
                ? '$' + fmtMoney(minMaterial) + ' min'
                : 'never &lt; $' + fmtMoney(floor);
            return `<tr>
                <td>${escapeHtml(decalTierLabel(tiers, idx))}</td>
                <td class="price-highlight">$${fmtMoney(Number(t.RatePerSqFt))} / sq ft</td>
                <td>${floorCell}</td>
            </tr>`;
        }).join('');
        container.innerHTML = `
            <table class="pricing-table decal-rate-table">
                <thead><tr><th>Total finished sq ft</th><th>Rate</th><th>Tier minimum</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
    }

    function wireDecalCalculator() {
        const rowsEl = document.getElementById('decalSizeRows');
        if (!rowsEl) return;
        addDecalRow(); // start with one empty row
        const addBtn = document.getElementById('decalAddRow');
        if (addBtn) addBtn.addEventListener('click', () => { addDecalRow(); recomputeDecal(); });
        const art = document.getElementById('decalArtOnFile');
        if (art) art.addEventListener('change', recomputeDecal);
        const tax = document.getElementById('decalTaxRate');
        if (tax) tax.addEventListener('input', recomputeDecal);
        rowsEl.addEventListener('input', recomputeDecal);
        rowsEl.addEventListener('click', (e) => {
            const btn = e.target.closest('.decal-row-remove');
            if (!btn) return;
            if (rowsEl.querySelectorAll('.decal-row').length > 1) {
                btn.closest('.decal-row').remove();
                recomputeDecal();
            }
        });
    }

    function addDecalRow() {
        const rowsEl = document.getElementById('decalSizeRows');
        if (!rowsEl) return;
        const row = document.createElement('div');
        row.className = 'decal-row';
        row.innerHTML = `
            <input type="number" class="decal-w" min="0" step="0.25" inputmode="decimal" placeholder="W" aria-label="Width in inches">
            <input type="number" class="decal-h" min="0" step="0.25" inputmode="decimal" placeholder="H" aria-label="Height in inches">
            <input type="number" class="decal-q" min="0" step="1" inputmode="numeric" placeholder="Qty" aria-label="Quantity">
            <span class="decal-row-sqft">—</span>
            <button type="button" class="decal-row-remove" aria-label="Remove this size" title="Remove">&times;</button>`;
        rowsEl.appendChild(row);
    }

    function recomputeDecal() {
        if (!decalData) return;
        const rowsEl = document.getElementById('decalSizeRows');
        const out = document.getElementById('decalOutput');
        const errEl = document.getElementById('decalCalcError');
        const warnEl = document.getElementById('decalWarnings');
        if (!rowsEl || !out) return;

        const tiers = decalData.tiers; // already ascending-sorted
        const minMaterial = Number(decalData.minMaterial) || 90;
        const setupAmt = (decalData.setupFee && Number(decalData.setupFee.amount)) || 50;
        const safeWidth = Number(decalData.safeRollWidthIn) || 52;

        let totalSqFt = 0, anyFilled = false, invalid = false;
        const warnings = [];

        Array.from(rowsEl.querySelectorAll('.decal-row')).forEach(row => {
            const wEl = row.querySelector('.decal-w');
            const hEl = row.querySelector('.decal-h');
            const qEl = row.querySelector('.decal-q');
            const sqftCell = row.querySelector('.decal-row-sqft');
            const w = parseFloat(wEl.value), h = parseFloat(hEl.value), q = parseInt(qEl.value, 10);
            if (!wEl.value && !hEl.value && !qEl.value) { sqftCell.textContent = '—'; return; }
            anyFilled = true;
            if (!(w > 0) || !(h > 0) || !(q > 0)) { invalid = true; sqftCell.textContent = '—'; return; }
            const lineSqFt = (w * h) / 144 * q;
            totalSqFt += lineSqFt;
            sqftCell.textContent = fmtMoney(round2(lineSqFt));
            if (Math.min(w, h) > safeWidth) {
                warnings.push(`A ${w}"×${h}" decal exceeds the ${safeWidth}" Roland print/cut width on both sides — it may need rotation, paneling, or custom production review.`);
            }
        });

        const taxPctRaw = parseFloat(document.getElementById('decalTaxRate').value);
        if (Number.isFinite(taxPctRaw) && taxPctRaw < 0) invalid = true;

        if (!anyFilled) {
            errEl.hidden = true; warnEl.innerHTML = '';
            out.innerHTML = '<div class="decal-output-empty">Enter a size and quantity to see the price.</div>';
            return;
        }
        if (invalid) {
            errEl.hidden = false;
            errEl.textContent = 'Enter a positive width, height, and quantity for each size (and a non-negative tax %).';
            warnEl.innerHTML = ''; out.innerHTML = '';
            return;
        }
        errEl.hidden = true;

        let tierIdx = tiers.findIndex(t => totalSqFt <= Number(t.MaxSqFt));
        if (tierIdx === -1) tierIdx = tiers.length - 1;
        const tier = tiers[tierIdx];
        const rate = Number(tier.RatePerSqFt);
        const floor = tierIdx === 0 ? minMaterial : (Number(tier.floor) || minMaterial);
        const rawMaterial = round2(totalSqFt * rate);
        const material = Math.max(rawMaterial, floor);
        const floorApplied = material > rawMaterial + 1e-9;

        const artOnFile = document.getElementById('decalArtOnFile').checked;
        const setup = artOnFile ? 0 : setupAmt;
        const subtotal = round2(material + setup);
        const taxPct = Number.isFinite(taxPctRaw) ? taxPctRaw : 0;
        const tax = round2(subtotal * (taxPct / 100));
        const total = round2(subtotal + tax);

        if (floorApplied) {
            warnings.unshift(`Tier minimum applied: ${fmtMoney(round2(totalSqFt))} sq ft × $${fmtMoney(rate)} = $${fmtMoney(rawMaterial)}, raised to the $${fmtMoney(floor)} tier minimum (volume-break cliff protection).`);
        }
        warnEl.innerHTML = warnings.map(w =>
            `<div class="decal-warn"><i class="fas fa-triangle-exclamation"></i> ${escapeHtml(w)}</div>`
        ).join('');

        out.innerHTML = `
            <div class="decal-out-line"><span>Total finished area</span><span>${fmtMoney(round2(totalSqFt))} sq ft</span></div>
            <div class="decal-out-line"><span>Rate (${escapeHtml(decalTierLabel(tiers, tierIdx))})</span><span>$${fmtMoney(rate)} / sq ft</span></div>
            <div class="decal-out-line"><span>Material${floorApplied ? ' (tier minimum)' : ''}</span><span>$${fmtMoney(material)}</span></div>
            <div class="decal-out-line"><span>Art setup (GRT-50)${artOnFile ? ' — waived' : ''}</span><span>$${fmtMoney(setup)}</span></div>
            <div class="decal-out-line subtotal"><span>Subtotal</span><span>$${fmtMoney(subtotal)}</span></div>
            <div class="decal-out-line"><span>Sales tax (${taxPct}%)</span><span>$${fmtMoney(tax)}</span></div>
            <div class="decal-out-line total"><span>Total quote</span><span>$${fmtMoney(total)}</span></div>`;
    }

    /**
     * Highlight the matching pricing-table row given a PartNumber.
     * Clears prior highlights, adds .ai-highlighted to the new row, scrolls
     * it into view, and appends an "AI-quoted" badge. Idempotent.
     */
    function highlightRowByPartNumber(partNumber) {
        if (!partNumber) return;
        document.querySelectorAll('tr.ai-highlighted').forEach(tr => {
            tr.classList.remove('ai-highlighted');
            tr.querySelectorAll('.ai-quoted-badge').forEach(b => b.remove());
        });
        const tr = document.querySelector(`tr.pricing-row[data-pn="${CSS.escape(partNumber)}"]`);
        if (!tr) return;
        tr.classList.add('ai-highlighted');
        // Append badge inside the first cell (next to PN text)
        const firstTd = tr.querySelector('td');
        if (firstTd && !firstTd.querySelector('.ai-quoted-badge')) {
            const badge = document.createElement('span');
            badge.className = 'ai-quoted-badge';
            badge.textContent = 'AI quoted';
            firstTd.appendChild(badge);
        }
        // Scroll into view (smooth, near the top of the visible viewport but
        // not flush with the sticky header — leave a comfortable margin).
        tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // -----------------------------------------------------------------
    // AI Chat panel
    // -----------------------------------------------------------------
    function wireChatPanel() {
        const openBtn = document.getElementById('aiOpenBtn');
        const closeBtn = document.getElementById('aiChatClose');
        const backdrop = document.getElementById('aiChatBackdrop');
        const form = document.getElementById('aiChatForm');
        const ta = document.getElementById('aiChatTextarea');
        const copyBtn = document.getElementById('aiCopyEmailBtn');
        const saveBtn = document.getElementById('aiSaveQuoteBtn');
        const floatingBtn = document.getElementById('floatingQuoteBtn');
        const resetBtn = document.getElementById('aiChatResetBtn');

        if (openBtn) openBtn.addEventListener('click', () => openChatPanel());
        if (closeBtn) closeBtn.addEventListener('click', closeChatPanel);
        if (backdrop) backdrop.addEventListener('click', closeChatPanel);
        if (floatingBtn) floatingBtn.addEventListener('click', () => openChatPanel());
        if (resetBtn) resetBtn.addEventListener('click', resetChat);

        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                const text = ta.value.trim();
                if (!text || aiState.isStreaming) return;
                ta.value = '';
                autoResizeTextarea(ta);
                aiState.messages.push({ role: 'user', content: text });
                appendChatBubble('user', text);
                sendChatMessage();
            });
        }
        if (ta) {
            ta.addEventListener('input', () => autoResizeTextarea(ta));
            ta.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    form.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            });
        }

        const outlookBtn = document.getElementById('aiOutlookBtn');
        if (outlookBtn) outlookBtn.addEventListener('click', handleOpenOutlook);
        if (copyBtn) copyBtn.addEventListener('click', handleCopyEmail);
        if (saveBtn) saveBtn.addEventListener('click', handleSaveQuote);

        // Esc closes the panel
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && aiState.opened) closeChatPanel();
        });
        // Keep Tab focus inside the drawer while it's open. It's a modal dialog
        // (the backdrop dims the page behind it), so focus shouldn't escape to
        // controls the user can't see.
        document.addEventListener('keydown', trapFocus);
    }

    function trapFocus(e) {
        if (e.key !== 'Tab' || !aiState.opened) return;
        const panel = document.getElementById('aiChatPanel');
        if (!panel) return;
        const focusables = panel.querySelectorAll(
            'button:not([disabled]), textarea, a[href], input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    function autoResizeTextarea(ta) {
        ta.style.height = 'auto';
        ta.style.height = Math.min(220, Math.max(72, ta.scrollHeight)) + 'px';
    }

    function openChatPanel(opts) {
        opts = opts || {};
        // NOTE: intentionally NOT gated on pricingData. The bot prices via the
        // server-side quote_sticker_price / quote_banner_price tools (the source
        // of truth), so it works even when the on-page pricing table failed to
        // load. pricingData is only used for row-highlighting, which no-ops
        // safely when the table isn't there. (Per Rule #4 we still surface the
        // table's load error visibly — we just don't let it lock out the chat.)
        const panel = document.getElementById('aiChatPanel');
        const backdrop = document.getElementById('aiChatBackdrop');
        if (!panel) return;
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
        backdrop.classList.add('open');
        backdrop.setAttribute('aria-hidden', 'false');
        aiState.opened = true;
        hideFloatingButton();
        // The hint text in the hero is no longer relevant once chat opens.
        const hint = document.getElementById('autoOpenHint');
        if (hint) hint.style.opacity = '0';

        if (aiState.messages.length === 0 && !aiState.greeted) {
            // Render the opening line client-side — no AI call, no STK number
            // reserved, until the rep actually sends something.
            renderStaticGreeting();
        }

        // Only pull focus into the textarea on an explicit user open. Stealing
        // focus on an automatic first-load open is disorienting and a WCAG flag.
        if (!opts.auto) {
            setTimeout(() => {
                const ta = document.getElementById('aiChatTextarea');
                if (ta) ta.focus();
            }, 320);
        }
    }

    /**
     * Render the bot's opening line as a static bubble — no network call. The
     * real conversation (and the STK quote-ID reservation) starts only when the
     * rep sends their first message. Used on both first-open and reset.
     */
    function renderStaticGreeting() {
        aiState.greeted = true;
        appendChatBubble(
            'assistant',
            'Hi! I can price die-cut stickers or vinyl banners. Tell me what you '
            + 'need — e.g. “200 of 3×3 stickers” or “5 banners '
            + '4×8 ft” — and I’ll work up a quote.'
        );
        updateContextPill('Ready when you are.');
    }

    function closeChatPanel() {
        const panel = document.getElementById('aiChatPanel');
        const backdrop = document.getElementById('aiChatBackdrop');
        if (!panel) return;
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
        backdrop.classList.remove('open');
        backdrop.setAttribute('aria-hidden', 'true');
        aiState.opened = false;
        showFloatingButton();
    }

    function showFloatingButton() {
        const btn = document.getElementById('floatingQuoteBtn');
        if (btn) btn.hidden = false;
    }
    function hideFloatingButton() {
        const btn = document.getElementById('floatingQuoteBtn');
        if (btn) btn.hidden = true;
    }

    /**
     * Reset chat state for a fresh quote (without reloading the page).
     * Use case: rep finishes a quote for customer A and immediately
     * starts another for customer B without losing their place on the page.
     */
    function resetChat() {
        if (aiState.isStreaming) {
            // Don't reset mid-stream — would orphan an in-flight SSE call.
            showToast('Wait for the current reply to finish first');
            return;
        }
        // Clear UI state
        const messagesEl = document.getElementById('aiChatMessages');
        if (messagesEl) messagesEl.innerHTML = '';
        const actionsEl = document.getElementById('aiChatActions');
        if (actionsEl) actionsEl.hidden = true;

        // Clear any pricing-table highlights from the previous quote
        document.querySelectorAll('tr.ai-highlighted').forEach(tr => {
            tr.classList.remove('ai-highlighted');
            tr.querySelectorAll('.ai-quoted-badge').forEach(b => b.remove());
        });
        document.querySelectorAll('.banner-rate-card.highlighted').forEach(c => c.classList.remove('highlighted'));

        // Reset state but keep the panel open
        aiState.messages = [];
        aiState.currentPriceQuote = null;
        aiState.currentCustomerFinal = null;
        aiState.currentEmailDraft = null;
        aiState.lastLookup = null;
        aiState.quoteID = null;
        aiState.quoteIDPromise = null;
        aiState.savedQuoteID = null;
        aiState.sessionSaved = false;
        aiState.savedItemLines = [];
        aiState.isStreaming = false;
        aiState.greeted = false;

        // Re-greet with a fresh static opening line — no AI call until the rep
        // types the next quote.
        renderStaticGreeting();
        showToast('New quote started');
    }

    function updateContextPill(text) {
        const pill = document.getElementById('aiChatContextPill');
        if (!pill) return;
        if (aiState.quoteID) {
            pill.innerHTML = `<b>${escapeHtml(aiState.quoteID)}</b> · ${escapeHtml(text || 'ready')}`;
        } else {
            pill.innerHTML = escapeHtml(text || '');
        }
    }

    // -----------------------------------------------------------------
    // Quote ID pre-generation (lazy + idempotent)
    // -----------------------------------------------------------------
    async function ensureQuoteID() {
        if (aiState.quoteID) return aiState.quoteID;
        if (aiState.quoteIDPromise) return aiState.quoteIDPromise;
        aiState.quoteIDPromise = (async () => {
            try {
                const r = await fetch(API_BASE_URL + '/api/quote-sequence/' + QUOTE_PREFIX);
                if (!r.ok) throw new Error('quote-sequence ' + r.status);
                const d = await r.json();
                aiState.quoteID = `${d.prefix}-${d.year}-${String(d.sequence).padStart(3, '0')}`;
                updateContextPill('drafting…');
                return aiState.quoteID;
            } catch (err) {
                console.warn('[sticker-ai] ensureQuoteID failed:', err.message);
                aiState.quoteIDPromise = null;
                return null;
            }
        })();
        return aiState.quoteIDPromise;
    }

    // -----------------------------------------------------------------
    // Chat bubbles
    // -----------------------------------------------------------------
    function appendChatBubble(role, text, opts) {
        opts = opts || {};
        const container = document.getElementById('aiChatMessages');
        const msg = document.createElement('div');
        msg.className = 'chat-message ' + role + (opts.error ? ' error' : '');
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.textContent = text;
        msg.appendChild(bubble);
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
        return bubble;
    }

    function appendTypingIndicator() {
        const container = document.getElementById('aiChatMessages');
        const wrap = document.createElement('div');
        wrap.className = 'chat-message assistant typing-wrap';
        const typing = document.createElement('div');
        typing.className = 'chat-typing';
        typing.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
        wrap.appendChild(typing);
        container.appendChild(wrap);
        container.scrollTop = container.scrollHeight;
        return wrap;
    }
    function removeTypingIndicator(el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    function appendToolChip(toolName, statusText) {
        const container = document.getElementById('aiChatMessages');
        const msg = document.createElement('div');
        msg.className = 'chat-message assistant';
        const chip = document.createElement('span');
        chip.className = 'tool-chip';
        const iconClass = toolName === 'lookup_customer' ? 'fa-search' : 'fa-calculator';
        chip.innerHTML = `<i class="fas ${iconClass}"></i> ${escapeHtml(statusText)}`;
        msg.appendChild(chip);
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }

    // -----------------------------------------------------------------
    // Block parsing (PRICE_QUOTE / CUSTOMER_FINAL / EMAIL DRAFT)
    // -----------------------------------------------------------------
    function stripCodeFences(text) {
        if (!text) return text;
        let out = String(text);
        out = out.replace(/^\s*```[a-zA-Z]*\s*\n/, '');
        out = out.replace(/\n\s*```\s*$/, '');
        out = out.replace(/^```[a-zA-Z]*\s*$/gm, '');
        out = out.replace(/^```\s*$/gm, '');
        return out.trim();
    }

    function extractBlock(text, startMarker, endMarker) {
        const startIdx = text.indexOf(startMarker);
        const endIdx = text.indexOf(endMarker);
        if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return null;
        return text.slice(startIdx + startMarker.length, endIdx).trim();
    }

    function parsePriceQuote(text) {
        const raw = extractBlock(text, 'PRICE_QUOTE START', 'PRICE_QUOTE END');
        if (!raw) return null;
        try {
            return JSON.parse(stripCodeFences(raw));
        } catch (err) {
            console.warn('[sticker-ai] PRICE_QUOTE parse failed:', err.message);
            return null;
        }
    }

    function parseCustomerFinal(text) {
        const raw = extractBlock(text, 'CUSTOMER_FINAL START', 'CUSTOMER_FINAL END');
        if (!raw) return null;
        try {
            return JSON.parse(stripCodeFences(raw));
        } catch (err) {
            console.warn('[sticker-ai] CUSTOMER_FINAL parse failed:', err.message);
            return null;
        }
    }

    function parseEmailDraft(text) {
        const raw = extractBlock(text, 'EMAIL DRAFT START', 'EMAIL DRAFT END');
        if (!raw) return null;
        const block = stripCodeFences(raw);
        const toMatch = block.match(/^To:\s*(.*)$/m);
        const subjMatch = block.match(/^Subject:\s*(.*)$/m);
        const body = block
            .replace(/^To:\s*.*$/m, '')
            .replace(/^Subject:\s*.*$/m, '')
            .replace(/^\n+/, '')
            .trim();
        return {
            to: (toMatch && toMatch[1] || '').trim(),
            subject: (subjMatch && subjMatch[1] || '').trim(),
            body,
        };
    }

    // -----------------------------------------------------------------
    // Render finalized assistant reply (strip blocks, render preamble +
    // email-draft card; highlight pricing row)
    // -----------------------------------------------------------------
    function renderAssistantReply(bubbleEl, fullText) {
        // Find the EARLIEST of the three marker starts; everything before
        // it is conversational preamble worth rendering.
        const markers = ['PRICE_QUOTE START', 'CUSTOMER_FINAL START', 'EMAIL DRAFT START'];
        let earliestStart = fullText.length;
        for (const m of markers) {
            const idx = fullText.indexOf(m);
            if (idx !== -1 && idx < earliestStart) earliestStart = idx;
        }
        const preamble = fullText.slice(0, earliestStart).trim();
        bubbleEl.textContent = preamble || '(Quote drafted — see below.)';

        // Parse blocks
        const priceQuote = parsePriceQuote(fullText);
        const customerFinal = parseCustomerFinal(fullText);
        const emailDraft = parseEmailDraft(fullText);

        if (priceQuote) {
            aiState.currentPriceQuote = priceQuote;
            const items = Array.isArray(priceQuote.lineItems) ? priceQuote.lineItems : [];
            const isBanner = priceQuote.productType === 'banner';
            if (isBanner) {
                // For banners, render an inline live-quote card in the chat
                // (no pricing-table row to highlight — banners are continuous).
                // Also highlight the BAN-SQFT card in the rate-card section.
                renderBannerQuoteCard(bubbleEl, priceQuote);
                highlightBannerRateCardByPartNumber('BAN-SQFT');
                if (priceQuote.appliedRules && priceQuote.appliedRules.minimum) {
                    highlightBannerRateCardByPartNumber('BAN-MIN');
                }
            } else {
                // Sticker: highlight matching pricing-table rows
                items.forEach(it => highlightRowByPartNumber(it.partNumber));
            }
        }
        if (customerFinal) aiState.currentCustomerFinal = customerFinal;
        if (emailDraft) {
            aiState.currentEmailDraft = emailDraft;
            renderEmailDraftCard(bubbleEl, emailDraft);
        }
        // Unlock action buttons when we have everything we need to save
        updateActionsAvailability();
    }

    function renderBannerQuoteCard(bubbleEl, priceQuote) {
        const msgEl = bubbleEl.closest('.chat-message');
        if (!msgEl) return;
        const items = Array.isArray(priceQuote.lineItems) ? priceQuote.lineItems : [];
        const banner = items.find(it => /^BAN-\d/.test(it.partNumber)) || items[0] || {};
        const extras = items.filter(it => it !== banner);
        const setup = priceQuote.setupFee || {};
        const orderTotal = items.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0)
            + (setup.include !== false ? (Number(setup.amount) || 0) : 0);

        const card = document.createElement('div');
        card.className = 'banner-quote-card';
        const extrasHtml = extras.map(ex => `
            <div class="bqc-line">
                <span>${escapeHtml(ex.description || ex.partNumber)}</span>
                <span class="v">$${fmtMoney(Number(ex.totalPrice) || 0)}</span>
            </div>`).join('');
        const setupLine = setup.include !== false
            ? `<div class="bqc-line">
                 <span>Art setup fee (${escapeHtml(setup.partNumber || 'GRT-50')})</span>
                 <span class="v">$${fmtMoney(Number(setup.amount) || 0)}</span>
               </div>`
            : '';
        const minNote = priceQuote.appliedRules && priceQuote.appliedRules.minimum
            ? `<div class="bqc-note">${escapeHtml(priceQuote.appliedRules.minimum)}</div>` : '';
        const dsNote = priceQuote.appliedRules && priceQuote.appliedRules.doubleSide
            ? `<div class="bqc-note">${escapeHtml(priceQuote.appliedRules.doubleSide)}</div>` : '';
        card.innerHTML = `
            <div class="bqc-label">Live banner quote</div>
            <div class="bqc-pn">${escapeHtml(banner.partNumber || 'BAN-CUSTOM')}</div>
            <div class="bqc-size">${escapeHtml(banner.description || banner.size || 'Custom banner')}</div>
            <div class="bqc-line">
                <span>${fmtInt(Number(banner.quantity) || 0)} banner${Number(banner.quantity) === 1 ? '' : 's'} @ $${fmtMoney(Number(banner.pricePerUnit) || Number(banner.pricePerSticker) || 0)} each</span>
                <span class="v">$${fmtMoney(Number(banner.totalPrice) || 0)}</span>
            </div>
            ${extrasHtml}
            ${setupLine}
            <div class="bqc-line total">
                <span>Order total</span>
                <span class="v">$${fmtMoney(orderTotal)}</span>
            </div>
            ${minNote}
            ${dsNote}
        `;
        msgEl.appendChild(card);
        const container = document.getElementById('aiChatMessages');
        container.scrollTop = container.scrollHeight;
    }

    function renderEmailDraftCard(bubbleEl, draft) {
        const msgEl = bubbleEl.closest('.chat-message');
        if (!msgEl) return;
        const card = document.createElement('div');
        card.className = 'email-draft-card';
        card.innerHTML = `
            <div class="label">Email draft</div>
            <pre>${escapeHtml(draft.body)}</pre>
        `;
        msgEl.appendChild(card);
        const container = document.getElementById('aiChatMessages');
        container.scrollTop = container.scrollHeight;
    }

    function updateActionsAvailability() {
        const actions = document.getElementById('aiChatActions');
        const outlookBtn = document.getElementById('aiOutlookBtn');
        const copyBtn = document.getElementById('aiCopyEmailBtn');
        const saveBtn = document.getElementById('aiSaveQuoteBtn');
        if (!actions) return;
        const hasDraft = !!aiState.currentEmailDraft;
        const hasQuote = !!aiState.currentPriceQuote;
        actions.hidden = !(hasDraft || hasQuote);
        if (outlookBtn) outlookBtn.disabled = !hasDraft;
        if (copyBtn) copyBtn.disabled = !hasDraft;
        if (saveBtn) saveBtn.disabled = !(hasDraft && hasQuote && aiState.currentCustomerFinal);
        if (aiState.savedQuoteID && saveBtn) {
            saveBtn.innerHTML = `<i class="fas fa-link"></i> Copy share link`;
            saveBtn.disabled = false;
        }
    }

    // -----------------------------------------------------------------
    // SSE streaming chat
    // -----------------------------------------------------------------
    async function sendChatMessage() {
        if (aiState.isStreaming) return;
        aiState.isStreaming = true;
        const sendBtn = document.getElementById('aiChatSend');
        if (sendBtn) sendBtn.disabled = true;

        const typingEl = appendTypingIndicator();

        try {
            await ensureQuoteID();

            const response = await fetch(AI_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: aiState.messages,
                    calcContext: { quoteID: aiState.quoteID },
                }),
            });

            if (!response.ok) throw new Error('AI server returned ' + response.status);

            removeTypingIndicator(typingEl);
            const bubble = appendChatBubble('assistant', '');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';
            let sseBuffer = '';

            while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                sseBuffer += decoder.decode(chunk.value, { stream: true });
                const events = sseBuffer.split('\n\n');
                sseBuffer = events.pop();
                for (const evt of events) {
                    const lines = evt.split('\n');
                    let eventType = null, dataJson = null;
                    for (const ln of lines) {
                        if (ln.startsWith('event: ')) eventType = ln.slice(7).trim();
                        if (ln.startsWith('data: ')) dataJson = ln.slice(6).trim();
                    }
                    if (!eventType || !dataJson) continue;
                    let data;
                    try { data = JSON.parse(dataJson); } catch (_) { continue; }
                    if (eventType === 'delta' && data.text) {
                        accumulated += data.text;
                        bubble.textContent = stripBlocksForLiveDisplay(accumulated);
                        const container = document.getElementById('aiChatMessages');
                        container.scrollTop = container.scrollHeight;
                    } else if (eventType === 'tool_result') {
                        handleToolResultEvent(data);
                    } else if (eventType === 'error') {
                        throw new Error(data.message || 'AI stream error');
                    }
                }
            }

            aiState.messages.push({ role: 'assistant', content: accumulated });
            renderAssistantReply(bubble, accumulated);
        } catch (err) {
            console.error('[sticker-ai] error:', err);
            removeTypingIndicator(typingEl);
            appendChatBubble(
                'assistant',
                "Hmm, I couldn't reach the AI right now. Please try again in a moment.",
                { error: true }
            );
        } finally {
            aiState.isStreaming = false;
            const btn = document.getElementById('aiChatSend');
            if (btn) btn.disabled = false;
            const ta = document.getElementById('aiChatTextarea');
            if (ta) ta.focus();
        }
    }

    /**
     * Strip in-progress block markers from the bubble so the user doesn't
     * see "PRICE_QUOTE START { ..." flashing during streaming. We hide
     * everything from the first marker onward until the stream completes.
     */
    function stripBlocksForLiveDisplay(text) {
        const markers = ['PRICE_QUOTE START', 'CUSTOMER_FINAL START', 'EMAIL DRAFT START'];
        let cutAt = text.length;
        for (const m of markers) {
            const idx = text.indexOf(m);
            if (idx !== -1 && idx < cutAt) cutAt = idx;
        }
        return text.slice(0, cutAt).trim() || '…';
    }

    function handleToolResultEvent(data) {
        const tool = data.tool;
        const result = data.result || {};
        if (tool === 'lookup_customer') {
            const matches = result.matches || [];
            if (matches.length === 1) aiState.lastLookup = matches[0];
            else if (matches.length > 1 && !aiState.lastLookup) aiState.lastLookup = matches[0];
            const status = matches.length === 0
                ? 'No customer match — drafting generic'
                : (matches.length === 1
                    ? `Found ${matches[0].company || matches[0].contact_name || 'match'}`
                    : `${matches.length} matches — narrowing…`);
            appendToolChip(tool, status);
        } else if (tool === 'quote_sticker_price') {
            if (result.offGrid) {
                appendToolChip(tool, `Off-grid: ${result.reason} — escalating to manual quote`);
            } else if (result.partNumber) {
                appendToolChip(tool,
                    `${result.partNumber}: $${fmtMoney(result.totalPrice)} (${fmtInt(result.quantity)} @ $${fmtMoney(result.pricePerSticker)}/pc)`
                );
                highlightRowByPartNumber(result.partNumber);
            }
        } else if (tool === 'quote_banner_price') {
            if (result.error) {
                appendToolChip(tool, `Error: ${result.error}`);
            } else if (result.partNumber) {
                appendToolChip(tool,
                    `${result.partNumber}: $${fmtMoney(result.orderTotal)} (${fmtInt(result.quantity)} × $${fmtMoney(result.perBanner && result.perBanner.total)}/banner)`
                );
                // Live highlight the rate cards while we wait for final PRICE_QUOTE
                highlightBannerRateCardByPartNumber('BAN-SQFT');
                if (result.appliedRules && result.appliedRules.minimum) {
                    highlightBannerRateCardByPartNumber('BAN-MIN');
                }
            }
        }
    }

    // -----------------------------------------------------------------
    // Open in Outlook / Copy email / Save quote actions
    // -----------------------------------------------------------------

    /**
     * Build a mailto: URL from the parsed email draft. Body capped at 1,800
     * chars defensively — some Windows mail handlers truncate URLs around
     * the 2KB mark, which would silently drop the end of the email. If the
     * customer saved the quote first, append the share link to the body so
     * the customer can review the full quote in-browser.
     */
    function buildMailto(draft) {
        const BODY_CAP = 1800;
        let body = draft.body || '';
        if (aiState.savedQuoteID) {
            const shareUrl = `${location.origin}/quote/${encodeURIComponent(aiState.savedQuoteID)}`;
            body += `\n\nView quote online: ${shareUrl}`;
        }
        if (body.length > BODY_CAP) {
            body = body.slice(0, BODY_CAP);
            console.warn('[sticker-ai] mailto body capped at ' + BODY_CAP + ' chars.');
        }
        const params = [];
        if (draft.subject) params.push('subject=' + encodeURIComponent(draft.subject));
        if (body) params.push('body=' + encodeURIComponent(body));
        const qs = params.length ? '?' + params.join('&') : '';
        const to = (draft.to || '').trim();
        return 'mailto:' + encodeURIComponent(to) + qs;
    }

    function handleOpenOutlook() {
        const draft = aiState.currentEmailDraft;
        if (!draft) return;
        try {
            window.location.href = buildMailto(draft);
            showToast('Opening Outlook…');
        } catch (err) {
            console.error('[sticker-ai] mailto open failed:', err);
            showToast('Failed to open Outlook — try Copy email instead');
        }
    }

    function handleCopyEmail() {
        const draft = aiState.currentEmailDraft;
        if (!draft) return;
        const text = (draft.subject ? `Subject: ${draft.subject}\n\n` : '') + draft.body;
        navigator.clipboard.writeText(text).then(() => {
            showToast('Email copied — paste into Outlook');
        }).catch(err => {
            console.warn('[sticker-ai] clipboard failed:', err);
            showToast('Copy failed — check console');
        });
    }

    async function handleSaveQuote() {
        // Second click after save → copy the share link.
        if (aiState.savedQuoteID) {
            // Use the server's clean /quote/<ID> route (server.js:2798) — the same
            // path CEMB uses. /quote-view.html?id=... doesn't match the path-regex
            // and renders as "Quote Not Found".
            const url = `${location.origin}/quote/${encodeURIComponent(aiState.savedQuoteID)}`;
            try {
                await navigator.clipboard.writeText(url);
                showToast(`Share link copied — ${aiState.savedQuoteID}`);
            } catch {
                showToast('Copy failed — link is ' + url);
            }
            return;
        }

        const saveBtn = document.getElementById('aiSaveQuoteBtn');
        if (saveBtn) saveBtn.disabled = true;

        try {
            const priceQuote = aiState.currentPriceQuote;
            const customer = aiState.currentCustomerFinal || {};
            const draft = aiState.currentEmailDraft || {};

            if (!priceQuote || !priceQuote.lineItems || !priceQuote.lineItems.length) {
                throw new Error('No price quote to save');
            }

            const quoteID = aiState.quoteID || await ensureQuoteID();
            if (!quoteID) throw new Error('Failed to get quote ID');

            const lineItems = priceQuote.lineItems;
            const subtotal = lineItems.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);
            const includeSetup = priceQuote.setupFee && priceQuote.setupFee.include !== false;
            // Null-check (NOT ||) so a legitimate $0 / waived setup fee isn't forced to $50.
            const setupRaw = priceQuote.setupFee ? priceQuote.setupFee.amount : null;
            const setupFee = includeSetup ? (setupRaw != null ? Number(setupRaw) : 50) : 0;
            const taxable = customer.taxable === true;
            // Persist the PRE-TAX total the rep saw + emailed (the email shows no tax
            // figure for taxable customers); WA sales tax is applied downstream at
            // invoice (ManageOrders/ShopWorks). No hardcoded rate baked into the quote.
            const total = subtotal + setupFee;

            // Build session payload
            const sessionPayload = {
                QuoteID: quoteID,
                SessionID: `sticker_${Date.now()}`,
                Status: 'Open',
                CustomerEmail: customer.email || '',
                CustomerName: customer.name || '',
                CompanyName: customer.company || '',
                Phone: customer.phone || '',
                TotalQuantity: lineItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
                SubtotalAmount: subtotal,
                LTMFeeTotal: 0,
                TotalAmount: total,
                Notes: JSON.stringify({
                    setup_fee: setupFee,
                    taxable,
                    tax_note: taxable
                        ? 'Pre-tax quote — WA sales tax applied at invoice based on ship-to address.'
                        : 'Tax-exempt — reseller permit on file.',
                    customer,
                    appliedRules: priceQuote.appliedRules || {},
                    emailSubject: draft.subject || '',
                }),
            };
            // Retry-safe: only create the session row once. On a retry after a
            // partial line-item failure, skip straight to re-posting the items.
            if (!aiState.sessionSaved) {
                const sessionRes = await fetch(API_BASE_URL + '/api/quote_sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sessionPayload),
                });
                if (!sessionRes.ok) {
                    const t = await sessionRes.text();
                    throw new Error('quote_sessions POST ' + sessionRes.status + ': ' + t.slice(0, 200));
                }
                aiState.sessionSaved = true;
            }

            const isBanner = priceQuote.productType === 'banner';
            const embType = isBanner ? 'banner' : 'sticker';
            // POST each line item (+ setup fee as an extra item, if included)
            const items = lineItems.map((it, idx) => {
                const unitPrice = Number(it.pricePerUnit) || Number(it.pricePerSticker) || 0;
                return {
                    QuoteID: quoteID,
                    LineNumber: idx + 1,
                    StyleNumber: it.partNumber,
                    ProductName: it.description || `${it.size || ''} ${isBanner ? 'vinyl banner' : 'die-cut sticker'}`.trim(),
                    Color: '',
                    ColorCode: '',
                    EmbellishmentType: embType,
                    PrintLocation: '',
                    PrintLocationName: it.size || '',
                    Quantity: Number(it.quantity) || 0,
                    HasLTM: 'No',
                    BaseUnitPrice: unitPrice,
                    LTMPerUnit: 0,
                    FinalUnitPrice: unitPrice,
                    LineTotal: Number(it.totalPrice) || 0,
                    SizeBreakdown: JSON.stringify(it.size ? { [it.size]: Number(it.quantity) || 0 } : {}),
                    PricingTier: it.isBestValue ? 'BestValue' : 'Standard',
                    ImageURL: '',
                    AddedAt: new Date().toISOString(),
                };
            });
            if (includeSetup) {
                items.push({
                    QuoteID: quoteID,
                    LineNumber: items.length + 1,
                    StyleNumber: 'GRT-50',
                    ProductName: 'Art Setup Fee (one-time)',
                    // 'fee', not 'setup-fee' — pages/js/quote-view.js:819 filters
                    // fee rows on exactly 'fee', so 'setup-fee' rendered the $50
                    // GRT-50 line to the customer as if it were a product.
                    // Mirrored in emblem-pricing-page.js (DIG-100).
                    EmbellishmentType: 'fee',
                    Quantity: 1,
                    BaseUnitPrice: setupFee,
                    FinalUnitPrice: setupFee,
                    LineTotal: setupFee,
                    HasLTM: 'No',
                    LTMPerUnit: 0,
                    SizeBreakdown: '{}',
                    PricingTier: 'Standard',
                    AddedAt: new Date().toISOString(),
                });
            }
            const failures = [];
            for (const it of items) {
                if (aiState.savedItemLines.includes(it.LineNumber)) continue; // already persisted (retry)
                try {
                    const r = await fetch(API_BASE_URL + '/api/quote_items', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(it),
                    });
                    if (!r.ok) {
                        const t = await r.text();
                        failures.push(`line ${it.LineNumber} (${it.StyleNumber}): ${r.status} ${t.slice(0, 120)}`);
                    } else {
                        aiState.savedItemLines.push(it.LineNumber);
                    }
                } catch (e) {
                    failures.push(`line ${it.LineNumber} (${it.StyleNumber}): ${e.message}`);
                }
            }

            // Rule #4 — never report success on a partial write. The saved /quote/:id
            // is the customer-facing deliverable; a missing line item (or the setup
            // fee) would show a wrong total. Do NOT issue the share link unless every
            // item persisted. Failed lines retry on the next click (succeeded ones skip).
            if (failures.length) {
                console.error('[sticker-ai] quote_items failures:', failures);
                throw new Error(`${failures.length} of ${items.length} line item(s) failed to save — do NOT send the link. Click Save to retry.`);
            }

            aiState.savedQuoteID = quoteID;
            updateContextPill('saved ✓');
            updateActionsAvailability();
            showToast(`Saved ${quoteID} — click again for share link`);
        } catch (err) {
            console.error('[sticker-ai] save failed:', err);
            showToast(err && err.message ? `Save failed — ${err.message}` : 'Save failed — check console');
            const btn = document.getElementById('aiSaveQuoteBtn');
            if (btn) btn.disabled = false;
        }
    }

    // -----------------------------------------------------------------
    // Toast
    // -----------------------------------------------------------------
    let toastTimer = null;
    function showToast(text) {
        const toast = document.getElementById('shareToast');
        const textEl = document.getElementById('shareToastText');
        if (!toast || !textEl) return;
        textEl.textContent = text;
        toast.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
    }
})();
