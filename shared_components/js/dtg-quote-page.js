/**
 * dtg-quote-page.js
 *
 * Page logic for /quote-builders/dtg-quote-builder.html (the new chat-first
 * page). Mirrors webstore-pricing-page.js. 4 bot tools (lookup_customer,
 * quote_dtg_pricing, recommend_top_sellers, web_search). The legacy form
 * lives inside an accordion on the same page and continues to use its
 * own JS files — this controller only drives the chat experience.
 *
 * NEW vs. emblem/webstore: a 4th action button "Submit to ShopWorks"
 * that POSTs to /api/submit-order-form (the same endpoint the order form
 * uses) once the bot has a complete quote with customer + designNumber.
 */

(function () {
    'use strict';

    const API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const AI_ENDPOINT = API_BASE_URL + '/api/dtg-quote-ai/chat';
    const QUOTE_PREFIX = 'DTG';
    const SUBMIT_ORDER_FORM_URL = '/api/submit-order-form'; // relative — same-origin (sanmar-inventory-app)

    const aiState = {
        opened: false,
        messages: [],
        isStreaming: false,
        currentPriceQuote: null,
        currentCustomerFinal: null,
        currentEmailDraft: null,
        lastLookup: null,
        quoteID: null,
        quoteIDPromise: null,
        savedQuoteID: null,
        shopWorksOrderId: null, // set after successful Submit to ShopWorks
    };

    document.addEventListener('DOMContentLoaded', init);
    function init() {
        wireChatPanel();
        showFloatingButton();
        setTimeout(() => { if (!aiState.opened) openChatPanel(); }, 600);
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function fmtMoney(n) {
        if (!Number.isFinite(n)) return '0.00';
        return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    function fmtInt(n) {
        if (!Number.isFinite(n)) return '0';
        return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    function domainOf(url) {
        try { return new URL(url).hostname.replace(/^www\./, ''); }
        catch { return ''; }
    }

    function wireChatPanel() {
        const openBtn = document.getElementById('aiOpenBtn');
        const closeBtn = document.getElementById('aiChatClose');
        const backdrop = document.getElementById('aiChatBackdrop');
        const form = document.getElementById('aiChatForm');
        const ta = document.getElementById('aiChatTextarea');
        const copyBtn = document.getElementById('aiCopyEmailBtn');
        const saveBtn = document.getElementById('aiSaveQuoteBtn');
        const submitBtn = document.getElementById('aiSubmitShopWorksBtn');
        const floatingBtn = document.getElementById('floatingQuoteBtn');
        const resetBtn = document.getElementById('aiChatResetBtn');

        if (openBtn) openBtn.addEventListener('click', openChatPanel);
        if (closeBtn) closeBtn.addEventListener('click', closeChatPanel);
        if (backdrop) backdrop.addEventListener('click', closeChatPanel);
        if (floatingBtn) floatingBtn.addEventListener('click', openChatPanel);
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
        if (submitBtn) submitBtn.addEventListener('click', handleSubmitToShopWorks);

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && aiState.opened) closeChatPanel();
        });
    }

    function autoResizeTextarea(ta) {
        ta.style.height = 'auto';
        ta.style.height = Math.min(220, Math.max(72, ta.scrollHeight)) + 'px';
    }

    function openChatPanel() {
        const panel = document.getElementById('aiChatPanel');
        const backdrop = document.getElementById('aiChatBackdrop');
        if (!panel) return;
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
        backdrop.classList.add('open');
        backdrop.setAttribute('aria-hidden', 'false');
        aiState.opened = true;
        hideFloatingButton();
        const hint = document.getElementById('autoOpenHint');
        if (hint) hint.style.opacity = '0';

        if (aiState.messages.length === 0) {
            aiState.messages.push({
                role: 'user',
                content: "(Open the chat — greet the rep briefly and ask what DTG quote they're drafting: product, qty, print locations.)",
            });
            updateContextPill('Drafting quote… ready when you are.');
            sendChatMessage();
        }
        setTimeout(() => { document.getElementById('aiChatTextarea')?.focus(); }, 320);
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
    function showFloatingButton() { const b = document.getElementById('floatingQuoteBtn'); if (b) b.hidden = false; }
    function hideFloatingButton() { const b = document.getElementById('floatingQuoteBtn'); if (b) b.hidden = true; }

    function resetChat() {
        if (aiState.isStreaming) { showToast('Wait for the current reply to finish'); return; }
        const messagesEl = document.getElementById('aiChatMessages');
        if (messagesEl) messagesEl.innerHTML = '';
        const actionsEl = document.getElementById('aiChatActions');
        if (actionsEl) actionsEl.hidden = true;
        aiState.messages = [];
        aiState.currentPriceQuote = null;
        aiState.currentCustomerFinal = null;
        aiState.currentEmailDraft = null;
        aiState.lastLookup = null;
        aiState.quoteID = null;
        aiState.quoteIDPromise = null;
        aiState.savedQuoteID = null;
        aiState.shopWorksOrderId = null;
        aiState.isStreaming = false;
        aiState.messages.push({
            role: 'user',
            content: "(Open the chat — greet the rep briefly and ask what DTG quote they're drafting.)",
        });
        updateContextPill('Drafting quote… ready when you are.');
        sendChatMessage();
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
                console.warn('[dtg-ai] ensureQuoteID failed:', err.message);
                aiState.quoteIDPromise = null;
                return null;
            }
        })();
        return aiState.quoteIDPromise;
    }

    // --- Chat bubbles + tool chips ----------------------------------
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
        scrollChatBottom();
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
        scrollChatBottom();
        return wrap;
    }
    function removeTypingIndicator(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

    function appendToolChip(toolName, statusText, opts) {
        opts = opts || {};
        const container = document.getElementById('aiChatMessages');
        const msg = document.createElement('div');
        msg.className = 'chat-message assistant';
        const chip = document.createElement('span');
        chip.className = 'tool-chip' + (toolName === 'web_search' ? ' web-search-chip' : '');
        let iconClass = 'fa-calculator';
        if (toolName === 'lookup_customer') iconClass = 'fa-search';
        else if (toolName === 'web_search') iconClass = 'fa-globe';
        else if (toolName === 'quote_dtg_pricing') iconClass = 'fa-print';
        else if (toolName === 'recommend_top_sellers') iconClass = 'fa-star';
        else if (toolName === 'lookup_product_details') iconClass = 'fa-palette';
        chip.innerHTML = `<i class="fas ${iconClass}"></i> ${escapeHtml(statusText)}`;
        msg.appendChild(chip);
        if (opts.searchResults) msg.appendChild(buildWebSearchResultsEl(opts.searchResults));
        if (opts.topSellers) msg.appendChild(buildTopSellersEl(opts.topSellers));
        if (opts.productDetails) msg.appendChild(buildProductDetailsEl(opts.productDetails));
        container.appendChild(msg);
        scrollChatBottom();
    }

    /**
     * Render product-details (lookup_product_details tool result) — title, then
     * a grid of clickable color swatches (from SanMar's COLOR_SQUARE_IMAGE),
     * then a list of size chips with upcharges proactively shown. Clicking a
     * swatch sends "Let's go with [Color Name]" back to the bot.
     */
    function buildProductDetailsEl(data) {
        const wrap = document.createElement('div');
        wrap.className = 'product-details-card';
        const colors = Array.isArray(data.colors) ? data.colors : [];
        const sizes = Array.isArray(data.sizes) ? data.sizes : [];
        const warnings = Array.isArray(data.avoidWarnings) ? data.avoidWarnings : [];

        // Detect avoid-list colors (for warning badge on PC61 Red, PC78H White)
        const avoidColorMatch = (name) => {
            const n = String(name).toLowerCase();
            if (data.styleNumber === 'PC61' && n.includes('red')) return true;
            if (data.styleNumber === 'PC78H' && n === 'white') return true;
            return false;
        };

        // Pick a default hero image — first color with a mainImageUrl wins.
        const defaultHero = colors.find(c => c.mainImageUrl) || null;

        let html = '';
        if (defaultHero) {
            html += `
                <div class="pd-hero">
                    <img class="pd-hero-img"
                         src="${escapeHtml(defaultHero.mainImageUrl)}"
                         alt="${escapeHtml(data.styleNumber)} in ${escapeHtml(defaultHero.name)}"
                         data-default-src="${escapeHtml(defaultHero.mainImageUrl)}"
                         data-default-color="${escapeHtml(defaultHero.name)}"
                         onerror="this.style.display='none';">
                    <div class="pd-hero-caption" data-default-color="${escapeHtml(defaultHero.name)}">${escapeHtml(defaultHero.name)}</div>
                </div>`;
        }

        html += `
            <div class="pd-label">Catalog details</div>
            <div class="pd-title"><span class="pd-style">${escapeHtml(data.styleNumber)}</span> · ${escapeHtml(data.title || '')}</div>
            <div class="pd-meta">${fmtInt(data.colorCount || 0)} colors available · ${fmtInt(data.sizeCount || 0)} sizes${data.hasUpcharges ? ' · 2XL+ upcharges apply' : ''}</div>
        `;

        if (colors.length > 0) {
            html += `<div class="pd-section-label">Hover to preview · click to pick</div>`;
            html += `<div class="color-swatch-grid">`;
            for (const c of colors) {
                const warn = avoidColorMatch(c.name);
                const imgHtml = c.swatchImageUrl
                    ? `<img class="cs-img" src="${escapeHtml(c.swatchImageUrl)}" alt="${escapeHtml(c.name)}" loading="lazy" onerror="this.classList.add('placeholder');this.removeAttribute('src');">`
                    : `<div class="cs-img placeholder"></div>`;
                html += `
                    <button type="button" class="color-swatch${warn ? ' warning' : ''}"
                            data-color-name="${escapeHtml(c.name)}"
                            data-catalog-color="${escapeHtml(c.catalogColor || '')}"
                            data-main-image="${escapeHtml(c.mainImageUrl || '')}"
                            title="${escapeHtml(c.name)}${warn ? ' — ⚠ avoid for DTG' : ''}">
                        ${imgHtml}
                        <span class="cs-name">${escapeHtml(c.name)}</span>
                    </button>`;
            }
            html += `</div>`;
        }

        for (const w of warnings) {
            html += `<div class="pd-color-warning">${escapeHtml(w)}</div>`;
        }

        if (sizes.length > 0) {
            html += `<div class="pd-section-label">Sizes${data.upchargeSummary ? ' (upcharges shown)' : ''}</div>`;
            html += `<div class="pd-size-list">`;
            for (const s of sizes) {
                const cls = s.hasUpcharge ? 'pd-size-chip has-upcharge' : 'pd-size-chip';
                const up = s.hasUpcharge ? `<span class="upcharge">+$${fmtMoney(s.upcharge)}</span>` : '';
                html += `<span class="${cls}">${escapeHtml(s.size)}${up}</span>`;
            }
            html += `</div>`;
        }

        wrap.innerHTML = html;

        const heroImg = wrap.querySelector('.pd-hero-img');
        const heroCap = wrap.querySelector('.pd-hero-caption');

        // Hover a swatch → preview that color in the hero. Click → pick + lock.
        wrap.querySelectorAll('.color-swatch').forEach((btn) => {
            const mainImg = btn.getAttribute('data-main-image') || '';
            const colorName = btn.getAttribute('data-color-name') || '';

            if (heroImg && mainImg) {
                btn.addEventListener('mouseenter', () => {
                    if (wrap.dataset.locked === 'true') return;
                    heroImg.style.display = '';
                    heroImg.src = mainImg;
                    if (heroCap) heroCap.textContent = colorName;
                });
                btn.addEventListener('mouseleave', () => {
                    if (wrap.dataset.locked === 'true') return;
                    const defSrc = heroImg.getAttribute('data-default-src') || '';
                    const defCol = heroImg.getAttribute('data-default-color') || '';
                    if (defSrc) {
                        heroImg.style.display = '';
                        heroImg.src = defSrc;
                    }
                    if (heroCap && defCol) heroCap.textContent = defCol;
                });
            }

            btn.addEventListener('click', () => {
                if (aiState.isStreaming) return;
                if (!colorName) return;
                // Lock hero on the picked color so it persists after the click.
                if (heroImg && mainImg) {
                    heroImg.style.display = '';
                    heroImg.src = mainImg;
                    heroImg.setAttribute('data-default-src', mainImg);
                    heroImg.setAttribute('data-default-color', colorName);
                    if (heroCap) {
                        heroCap.textContent = colorName;
                        heroCap.setAttribute('data-default-color', colorName);
                    }
                    wrap.dataset.locked = 'true';
                }
                const ta = document.getElementById('aiChatTextarea');
                const form = document.getElementById('aiChatForm');
                if (!ta || !form) return;
                ta.value = `Let's go with ${colorName}.`;
                form.dispatchEvent(new Event('submit', { cancelable: true }));
            });
        });

        return wrap;
    }

    function buildWebSearchResultsEl(data) {
        const wrap = document.createElement('div');
        wrap.className = 'web-search-results';
        let html = `<div class="wsr-query">Searched: "${escapeHtml(data.query_used || '')}"</div>`;
        if (data.answer) html += `<div class="wsr-answer"><b>Synthesized:</b> ${escapeHtml(data.answer)}</div>`;
        const results = Array.isArray(data.results) ? data.results.slice(0, 3) : [];
        for (const r of results) {
            const dom = domainOf(r.url);
            html += `
                <div class="wsr-result">
                    <a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.title || r.url)}</a>
                    ${dom ? `<span class="wsr-domain">${escapeHtml(dom)}</span>` : ''}
                    <div class="wsr-snip">${escapeHtml((r.snippet || '').slice(0, 220))}${(r.snippet || '').length > 220 ? '…' : ''}</div>
                </div>`;
        }
        wrap.innerHTML = html;
        return wrap;
    }

    function buildTopSellersEl(data) {
        const wrap = document.createElement('div');
        wrap.className = 'top-seller-recommendations';
        const products = Array.isArray(data.products) ? data.products : [];
        let html = `<div class="tsr-label">Top DTG sellers — ${escapeHtml(data.category || 'any')}</div>`;
        products.forEach((p, i) => {
            const rank = p.salesRank || i + 1;
            const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
            const colorChips = (p.bestColors || []).slice(0, 4).map(c => `
                <span class="ts-color-chip">
                    <span class="swatch" style="background:${escapeHtml(c.color || '#000')}"></span>
                    ${escapeHtml(c.name)}${c.units ? ` (${escapeHtml(c.units)})` : ''}
                </span>`).join('');
            const warnings = (p.warnings || []).map(w => `<div class="ts-warning">⚠ ${escapeHtml(w)}</div>`).join('');
            const thumbHtml = p.mainImageUrl
                ? `<div class="ts-thumb"><img src="${escapeHtml(p.mainImageUrl)}" alt="${escapeHtml(p.styleNumber)}" loading="lazy" onerror="this.parentElement.style.display='none';"></div>`
                : '';
            html += `
                <div class="top-seller-card${thumbHtml ? ' has-thumb' : ''}">
                    <div class="ts-rank-badge ${rankClass}">#${rank}</div>
                    ${thumbHtml}
                    <div class="ts-body">
                        <div><span class="ts-style">${escapeHtml(p.styleNumber)}</span> · <span class="ts-name">${escapeHtml(p.name)}</span></div>
                        <div class="ts-brand">${escapeHtml(p.brand || '')} · ${escapeHtml(p.fabric || '')}</div>
                        <div class="ts-sales">${escapeHtml(p.salesData || '')}</div>
                        ${p.bestFor ? `<div class="ts-best-for">${escapeHtml(p.bestFor)}</div>` : ''}
                        ${colorChips ? `<div class="ts-colors">${colorChips}</div>` : ''}
                        ${warnings}
                    </div>
                </div>`;
        });
        wrap.innerHTML = html;
        return wrap;
    }

    // --- Block parsing -----------------------------------------------
    function stripCodeFences(text) {
        if (!text) return text;
        let out = String(text);
        out = out.replace(/^\s*```[a-zA-Z]*\s*\n/, '').replace(/\n\s*```\s*$/, '');
        out = out.replace(/^```[a-zA-Z]*\s*$/gm, '').replace(/^```\s*$/gm, '');
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
        try { return JSON.parse(stripCodeFences(raw)); }
        catch (err) { console.warn('[dtg-ai] PRICE_QUOTE parse failed:', err.message); return null; }
    }
    function parseCustomerFinal(text) {
        const raw = extractBlock(text, 'CUSTOMER_FINAL START', 'CUSTOMER_FINAL END');
        if (!raw) return null;
        try { return JSON.parse(stripCodeFences(raw)); }
        catch (err) { console.warn('[dtg-ai] CUSTOMER_FINAL parse failed:', err.message); return null; }
    }
    function parseEmailDraft(text) {
        const raw = extractBlock(text, 'EMAIL DRAFT START', 'EMAIL DRAFT END');
        if (!raw) return null;
        const block = stripCodeFences(raw);
        const toMatch = block.match(/^To:\s*(.*)$/m);
        const subjMatch = block.match(/^Subject:\s*(.*)$/m);
        const body = block
            .replace(/^To:\s*.*$/m, '').replace(/^Subject:\s*.*$/m, '')
            .replace(/^\n+/, '').trim();
        return {
            to: (toMatch && toMatch[1] || '').trim(),
            subject: (subjMatch && subjMatch[1] || '').trim(),
            body,
        };
    }

    function renderAssistantReply(bubbleEl, fullText) {
        const markers = ['PRICE_QUOTE START', 'CUSTOMER_FINAL START', 'EMAIL DRAFT START'];
        let earliestStart = fullText.length;
        for (const m of markers) {
            const idx = fullText.indexOf(m);
            if (idx !== -1 && idx < earliestStart) earliestStart = idx;
        }
        const preamble = fullText.slice(0, earliestStart).trim();
        bubbleEl.textContent = preamble || '(Quote drafted — see below.)';

        const priceQuote = parsePriceQuote(fullText);
        const customerFinal = parseCustomerFinal(fullText);
        const emailDraft = parseEmailDraft(fullText);

        if (priceQuote) {
            aiState.currentPriceQuote = priceQuote;
            renderDtgQuoteCard(bubbleEl, priceQuote);
        }
        if (customerFinal) aiState.currentCustomerFinal = customerFinal;
        if (emailDraft) {
            aiState.currentEmailDraft = emailDraft;
            renderEmailDraftCard(bubbleEl, emailDraft);
        }
        updateActionsAvailability();
    }

    function renderDtgQuoteCard(bubbleEl, priceQuote) {
        const msgEl = bubbleEl.closest('.chat-message');
        if (!msgEl) return;
        const items = Array.isArray(priceQuote.lineItems) ? priceQuote.lineItems : [];
        const item = items[0] || {};
        const rules = priceQuote.appliedRules || {};
        const totals = priceQuote.totals || {};

        const card = document.createElement('div');
        card.className = 'dtg-quote-card';

        const tierIsLtm = /LTM/i.test(String(item.tier || ''));
        const sizesHtml = item.sizes
            ? Object.entries(item.sizes).map(([s, q]) => `<span>${escapeHtml(s)}: ${fmtInt(q)}</span>`).join('')
            : '';

        const upchargeNote = rules.sizeUpcharge ? `<div class="dtg-rule-note"><strong>Size upcharge:</strong> ${escapeHtml(rules.sizeUpcharge)}</div>` : '';
        const ltmNote = rules.ltm ? `<div class="dtg-rule-note"><strong>LTM:</strong> ${escapeHtml(rules.ltm)}</div>` : '';
        const tierNote = rules.tier ? `<div class="dtg-rule-note"><strong>Tier:</strong> ${escapeHtml(rules.tier)}</div>` : '';

        card.innerHTML = `
            <div class="dtg-label">Live DTG quote</div>
            <div class="dtg-pn">${escapeHtml(item.partNumber || 'DTG-CUSTOM')}</div>
            <div class="dtg-product-line">${escapeHtml(item.description || (item.style + ' — ' + (item.color || '')))}</div>
            <div>
                <span class="dtg-location-pill">${escapeHtml(item.locationLabel || item.locationCode || '')}</span>
                <span class="dtg-tier-pill${tierIsLtm ? ' ltm' : ''}">${escapeHtml(item.tier || '')}</span>
            </div>
            <div class="dtg-sizes">${sizesHtml}</div>

            <div class="dtg-line"><span>${fmtInt(Number(item.totalQuantity) || 0)} pieces @ avg $${fmtMoney(Number(item.finalUnitPrice) || 0)}</span><span class="v">$${fmtMoney(Number(item.lineTotal) || 0)}</span></div>
            ${Number(totals.taxEstimate) ? `<div class="dtg-line"><span>Tax (est)</span><span class="v">$${fmtMoney(Number(totals.taxEstimate))}</span></div>` : ''}
            <div class="dtg-line total"><span>Order total</span><span class="v">$${fmtMoney(Number(totals.grandTotal) || Number(item.lineTotal) || 0)}</span></div>

            ${tierNote}
            ${ltmNote}
            ${upchargeNote}
        `;
        msgEl.appendChild(card);
        scrollChatBottom();
    }

    function renderEmailDraftCard(bubbleEl, draft) {
        const msgEl = bubbleEl.closest('.chat-message');
        if (!msgEl) return;
        const card = document.createElement('div');
        card.className = 'email-draft-card';
        card.innerHTML = `<div class="label">Email draft</div><pre>${escapeHtml(draft.body)}</pre>`;
        msgEl.appendChild(card);
        scrollChatBottom();
    }

    function scrollChatBottom() {
        const container = document.getElementById('aiChatMessages');
        if (container) container.scrollTop = container.scrollHeight;
    }

    function updateActionsAvailability() {
        const actions = document.getElementById('aiChatActions');
        const outlookBtn = document.getElementById('aiOutlookBtn');
        const copyBtn = document.getElementById('aiCopyEmailBtn');
        const saveBtn = document.getElementById('aiSaveQuoteBtn');
        const submitBtn = document.getElementById('aiSubmitShopWorksBtn');
        if (!actions) return;
        const hasDraft = !!aiState.currentEmailDraft;
        const hasQuote = !!aiState.currentPriceQuote;
        const hasCustomer = !!aiState.currentCustomerFinal;
        const hasDesign = hasCustomer && !!aiState.currentCustomerFinal.designNumber;
        actions.hidden = !(hasDraft || hasQuote);
        if (outlookBtn) outlookBtn.disabled = !hasDraft;
        if (copyBtn) copyBtn.disabled = !hasDraft;
        if (saveBtn) saveBtn.disabled = !(hasDraft && hasQuote && hasCustomer);
        // Submit to ShopWorks: needs full quote + customer + designNumber
        if (submitBtn) {
            submitBtn.disabled = !(hasQuote && hasCustomer && hasDesign) || !!aiState.shopWorksOrderId;
            if (aiState.shopWorksOrderId) {
                submitBtn.innerHTML = `<i class="fas fa-check"></i> Pushed ${escapeHtml(aiState.shopWorksOrderId)}`;
            } else if (!hasDesign && hasCustomer) {
                submitBtn.title = 'Bot needs a designNumber from the rep before push is allowed';
            } else {
                submitBtn.title = '';
            }
        }
        if (aiState.savedQuoteID && saveBtn && !aiState.shopWorksOrderId) {
            saveBtn.innerHTML = `<i class="fas fa-link"></i> Copy share link`;
            saveBtn.disabled = false;
        }
    }

    // --- SSE streaming chat ------------------------------------------
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
                        scrollChatBottom();
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
            console.error('[dtg-ai] error:', err);
            removeTypingIndicator(typingEl);
            appendChatBubble('assistant', "Hmm, I couldn't reach the AI right now. Please try again in a moment.", { error: true });
        } finally {
            aiState.isStreaming = false;
            const btn = document.getElementById('aiChatSend');
            if (btn) btn.disabled = false;
            document.getElementById('aiChatTextarea')?.focus();
        }
    }

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
        } else if (tool === 'quote_dtg_pricing') {
            if (result.error) {
                appendToolChip(tool, `Error: ${result.message || result.error}`);
            } else {
                appendToolChip(tool,
                    `${result.partNumber}: $${fmtMoney(result.lineTotal)} (${fmtInt(result.totalQuantity)} @ avg $${fmtMoney(result.finalUnitPrice)})`
                );
            }
        } else if (tool === 'recommend_top_sellers') {
            const n = result.count || (result.products?.length) || 0;
            appendToolChip(tool, `Recommended ${n} top seller${n === 1 ? '' : 's'}`, { topSellers: result });
        } else if (tool === 'web_search') {
            if (result.error) {
                appendToolChip(tool, `Web search: ${result.error === 'web_search_unavailable' ? 'offline (TAVILY_API_KEY not set)' : result.message || result.error}`);
            } else {
                const n = Array.isArray(result.results) ? result.results.length : 0;
                appendToolChip(tool, `Searched the web — ${n} result${n === 1 ? '' : 's'}`, { searchResults: result });
            }
        } else if (tool === 'lookup_product_details') {
            if (result.error) {
                appendToolChip(tool, `Lookup failed: ${result.message || result.error}`);
            } else {
                const cc = result.colorCount ?? (Array.isArray(result.colors) ? result.colors.length : 0);
                const sc = result.sizeCount ?? (Array.isArray(result.sizes) ? result.sizes.length : 0);
                appendToolChip(tool, `${result.styleNumber}: ${cc} color${cc === 1 ? '' : 's'} · ${sc} size${sc === 1 ? '' : 's'}`, { productDetails: result });
            }
        }
    }

    // --- Outlook / Copy / Save / SUBMIT-TO-SHOPWORKS -----------------
    function buildMailto(draft) {
        const BODY_CAP = 1800;
        let body = draft.body || '';
        if (aiState.savedQuoteID) {
            const shareUrl = `${location.origin}/quote/${encodeURIComponent(aiState.savedQuoteID)}`;
            body += `\n\nView quote online: ${shareUrl}`;
        }
        if (body.length > BODY_CAP) body = body.slice(0, BODY_CAP);
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
            console.error('[dtg-ai] mailto open failed:', err);
            showToast('Failed to open Outlook — try Copy email');
        }
    }
    function handleCopyEmail() {
        const draft = aiState.currentEmailDraft;
        if (!draft) return;
        const text = (draft.subject ? `Subject: ${draft.subject}\n\n` : '') + draft.body;
        navigator.clipboard.writeText(text).then(() => {
            showToast('Email copied — paste into Outlook');
        }).catch(err => {
            console.warn('[dtg-ai] clipboard failed:', err);
            showToast('Copy failed — check console');
        });
    }

    async function handleSaveQuote() {
        if (aiState.savedQuoteID) {
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
            const totals = priceQuote.totals || {};
            const subtotal = lineItems.reduce((s, it) => s + (Number(it.lineTotal) || 0), 0);
            const total = Number(totals.grandTotal) || subtotal;

            const sessionPayload = {
                QuoteID: quoteID,
                SessionID: `dtg_${Date.now()}`,
                Status: 'Open',
                CustomerEmail: customer.email || '',
                CustomerName: customer.name || '',
                CompanyName: customer.company || '',
                Phone: customer.phone || '',
                TotalQuantity: lineItems.reduce((s, it) => s + (Number(it.totalQuantity) || 0), 0),
                SubtotalAmount: subtotal,
                LTMFeeTotal: lineItems.reduce((s, it) => s + (Number(it.ltmPerUnit) * Number(it.totalQuantity) || 0), 0),
                TotalAmount: total,
                Notes: JSON.stringify({
                    productType: 'dtg',
                    designNumber: customer.designNumber || null,
                    appliedRules: priceQuote.appliedRules || {},
                    customer,
                    emailSubject: draft.subject || '',
                }),
            };
            const sessionRes = await fetch(API_BASE_URL + '/api/quote_sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionPayload),
            });
            if (!sessionRes.ok) {
                const t = await sessionRes.text();
                throw new Error('quote_sessions POST ' + sessionRes.status + ': ' + t.slice(0, 200));
            }
            const items = lineItems.map((it, idx) => ({
                QuoteID: quoteID,
                LineNumber: idx + 1,
                StyleNumber: it.style || it.partNumber,
                ProductName: it.description || `${it.style} ${it.color || ''}`.trim(),
                Color: it.color || '',
                EmbellishmentType: 'dtg',
                PrintLocation: it.locationCode || '',
                PrintLocationName: it.locationLabel || '',
                Quantity: Number(it.totalQuantity) || 0,
                HasLTM: it.ltmPerUnit > 0 ? 'Yes' : 'No',
                BaseUnitPrice: Number(it.baseUnitPrice) || 0,
                LTMPerUnit: Number(it.ltmPerUnit) || 0,
                FinalUnitPrice: Number(it.finalUnitPrice) || 0,
                LineTotal: Number(it.lineTotal) || 0,
                SizeBreakdown: JSON.stringify(it.sizes || {}),
                PricingTier: it.tier || 'Standard',
                AddedAt: new Date().toISOString(),
            }));
            for (const it of items) {
                const r = await fetch(API_BASE_URL + '/api/quote_items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(it),
                });
                if (!r.ok) console.warn('[dtg-ai] quote_items POST failed:', r.status);
            }
            aiState.savedQuoteID = quoteID;
            updateContextPill('saved ✓');
            updateActionsAvailability();
            showToast(`Saved ${quoteID} — click again for share link`);
        } catch (err) {
            console.error('[dtg-ai] save failed:', err);
            showToast('Save failed — check console');
            const btn = document.getElementById('aiSaveQuoteBtn');
            if (btn) btn.disabled = false;
        }
    }

    /**
     * Submit to ShopWorks: build the same payload the order form sends
     * (per pages/order-form/shopworks.js:buildBody) and POST it to
     * /api/submit-order-form on this domain. The backend forwards to the
     * proxy's /api/manageorders/orders/create — we don't touch ManageOrders
     * credentials directly.
     */
    async function handleSubmitToShopWorks() {
        if (aiState.shopWorksOrderId) {
            showToast(`Already pushed — ${aiState.shopWorksOrderId}`);
            return;
        }
        const priceQuote = aiState.currentPriceQuote;
        const customer = aiState.currentCustomerFinal || {};
        if (!priceQuote || !customer.designNumber) {
            showToast('Need a complete quote with designNumber before push');
            return;
        }

        const btn = document.getElementById('aiSubmitShopWorksBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Pushing…`;
        }

        try {
            const item = (priceQuote.lineItems && priceQuote.lineItems[0]) || {};
            const totals = priceQuote.totals || {};

            // Build the order-form-shaped payload. The backend's
            // /api/submit-order-form handler maps this to a ManageOrders
            // payload via the same machinery the order form uses.
            const body = {
                info: {
                    buyer: customer.name || '',
                    buyerEmail: customer.email || '',
                    companyName: customer.company || '',
                    companyId: customer.customer_number || '',
                    phone: customer.phone || '',
                    designNumber: customer.designNumber || '',
                    salesRep: customer.account_owner || 'Erik Mickelson',
                    salesRepEmail: customer.email_salesrep || 'sales@nwcustomapparel.com',
                    paymentTerms: customer.payment_terms || 'Net 10',
                    taxable: customer.taxable !== false,
                    // Reference: the original quote ID from the chat
                    quoteId: aiState.quoteID || '',
                },
                rows: [{
                    id: 'dtg-row-1',
                    style: item.style || '',
                    desc: item.description || `${item.style || ''} ${item.color || ''}`.trim(),
                    color: item.color || '',
                    sizes: item.sizes || {},
                    deco: 'dtg',
                    rowDecoConfig: {
                        method: 'dtg',
                        locationCode: item.locationCode || '',
                    },
                    price: item.finalUnitPrice || 0,
                    manualMode: false,
                }],
                ship: customer.shipping?.same_as_billing
                    ? { sameAsBilling: true, method: customer.shipping?.method || 'UPS Ground' }
                    : (customer.shipping || { method: 'UPS Ground' }),
                orderNotes: `DTG quote ${aiState.quoteID || ''} — pushed by AI bot`,
                decoConfig: { method: 'dtg' },
                breakdown: {
                    supported: true,
                    totalQty: Number(item.totalQuantity) || 0,
                    tier: item.tier || null,
                    subtotal: Number(item.lineTotal) || 0,
                    ltmTotal: Number(item.ltmPerUnit) * Number(item.totalQuantity) || 0,
                    taxEstimate: Number(totals.taxEstimate) || 0,
                    grandTotal: Number(totals.grandTotal) || Number(item.lineTotal) || 0,
                    fees: [],
                    errors: [],
                    byRow: {
                        'dtg-row-1': {
                            unitPriceBySize: (item.lineSizes || []).reduce((m, s) => {
                                m[s.size] = s.finalUnit;
                                return m;
                            }, {}),
                            rowSubtotal: Number(item.lineTotal) || 0,
                            tier: item.tier,
                        },
                    },
                },
                methodNotesBlock: `DTG · ${item.locationLabel || item.locationCode || ''} · Tier ${item.tier || ''}`,
                designNumbers: customer.designNumber ? [customer.designNumber] : [],
                addOns: [],
            };

            const r = await fetch(SUBMIT_ORDER_FORM_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const json = await r.json().catch(() => ({}));
            if (!r.ok || !json.success) {
                throw new Error(json.error || json.detail || `HTTP ${r.status}`);
            }
            const orderId = json.shopWorksId || json.extOrderId || 'pushed';
            aiState.shopWorksOrderId = orderId;
            renderShopWorksSuccess(orderId, json.mode);
            updateActionsAvailability();
            showToast(`Pushed to ShopWorks — order ${orderId}`);
        } catch (err) {
            console.error('[dtg-ai] ShopWorks push failed:', err);
            renderShopWorksError(err.message || String(err));
            const btn = document.getElementById('aiSubmitShopWorksBtn');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fas fa-truck-fast"></i> Submit to ShopWorks`;
            }
        }
    }

    function renderShopWorksSuccess(orderId, mode) {
        const container = document.getElementById('aiChatMessages');
        const msg = document.createElement('div');
        msg.className = 'chat-message assistant';
        const card = document.createElement('div');
        card.className = 'shopworks-success-card';
        card.innerHTML = `
            <div class="sws-label">✓ Pushed to ShopWorks</div>
            <div class="sws-order-id">${escapeHtml(orderId)}</div>
            ${mode === 'mock' ? '<div style="font-size:11px;margin-top:4px;color:#78350f;">(Mock mode — backend unreachable, payload stashed in localStorage)</div>' : ''}
        `;
        msg.appendChild(card);
        container.appendChild(msg);
        scrollChatBottom();
    }

    function renderShopWorksError(message) {
        const container = document.getElementById('aiChatMessages');
        const msg = document.createElement('div');
        msg.className = 'chat-message assistant';
        const card = document.createElement('div');
        card.className = 'shopworks-error-card';
        card.innerHTML = `<strong>ShopWorks push failed:</strong> ${escapeHtml(message)}`;
        msg.appendChild(card);
        container.appendChild(msg);
        scrollChatBottom();
    }

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
