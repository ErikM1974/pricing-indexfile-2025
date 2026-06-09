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
    const aiState = {
        opened: false,
        messages: [],
        isStreaming: false,
        currentPriceQuote: null,
        currentCustomerFinal: null,
        currentEmailDraft: null,
        lastLookup: null,
        // A3 — list of contacts/companies from the most recent
        // lookup_customer tool result. Used to fill the form's customer
        // pane when the rep replies with a single A/B/C menu letter.
        lastMatches: [],
        quoteID: null,
        quoteIDPromise: null,
        savedQuoteID: null,
    };

    // Master switch (2026-05-19): the chat panel is now a research assistant.
    // When false, tool results render in chat for the rep to READ, but never
    // write to the order form. Erik flipped this off because manual entry via
    // the catalog is faster than waiting on tool-call cycles. Set true to
    // re-enable chat-driven order intake — none of the listeners were removed,
    // just gated.
    const ENABLE_BOT_FORM_FILL = false;

    document.addEventListener('DOMContentLoaded', init);
    function init() {
        wireChatPanel();
        showFloatingButton();
        // 2026-05-19: chat no longer auto-opens. Rep clicks the floating
        // ✨ button when they want to research / ask a question.
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

    /**
     * Detect an explicit print location code in the rep's chat message and
     * auto-update the form's location pill. The rep typed it — they shouldn't
     * also have to click the pill manually. Mirrors the customer-pick and
     * matrix-submit pattern: chat is allowed to write to the form when the
     * rep was explicit.
     *
     * Supports:
     *   - Single front codes: LC, FF, JF
     *   - Front + back combos as a single token: LC_FB, FF_FB, JF_JB, LC_JB
     *   - Front + back as two tokens with "and"/"+"/"&" between:
     *     "LC and FB", "JF + JB", "LC&FB"
     *
     * The detection is whole-word + case-insensitive. "FFmpeg" doesn't match
     * "FF". "LC" only matches if it's a standalone token.
     */
    function tryAutoSetLocation(text) {
        if (!ENABLE_BOT_FORM_FILL) return null;
        if (!window.DTGInlineForm || typeof window.DTGInlineForm.setLocation !== 'function') return null;
        const t = String(text || '');
        // 1. Combo as a single token (e.g. "LC_FB")
        const COMBO_RE = /\b(LC|FF|JF)_(FB|JB)\b/i;
        let m = COMBO_RE.exec(t);
        if (m) {
            return window.DTGInlineForm.setLocation(m[1].toUpperCase(), m[2].toUpperCase());
        }
        // 2. Two tokens with separator: "LC and FB" / "JF + JB" / "LC&FB"
        const TWO_TOKEN_RE = /\b(LC|FF|JF)\s*(?:and|\+|&|,)\s*(FB|JB)\b/i;
        m = TWO_TOKEN_RE.exec(t);
        if (m) {
            return window.DTGInlineForm.setLocation(m[1].toUpperCase(), m[2].toUpperCase());
        }
        // 3. Single front code
        const FRONT_RE = /\b(LC|FF|JF)\b/i;
        m = FRONT_RE.exec(t);
        if (m) {
            return window.DTGInlineForm.setLocation(m[1].toUpperCase(), '');
        }
        // 4. Back-only as a hint — rep typed "FB" alone meaning add full back
        //    to whatever front is current. Keep current front, add back.
        const BACK_RE = /\b(FB|JB)\b/i;
        m = BACK_RE.exec(t);
        if (m) {
            const snap = window.DTGInlineForm.getFormSnapshot?.();
            const currentFront = snap?.front || 'LC';
            return window.DTGInlineForm.setLocation(currentFront, m[1].toUpperCase());
        }
        return null;
    }

    /**
     * A3 — When the bot has shown an A/B/C menu of customer matches and the
     * rep replies with just a single letter, fill the form's customer pane
     * with the corresponding match immediately. Saves a round-trip and gives
     * the rep instant feedback.
     *
     * Strict regex: the trimmed message must be a single letter (a-z) with
     * an optional trailing dot or paren. "Add 2 more" doesn't match.
     * "d" → index 3. "D." → index 3. "d)" → index 3.
     */
    function tryMenuLetterCustomerPick(text) {
        if (!ENABLE_BOT_FORM_FILL) return;
        const m = /^([a-zA-Z])[.)]?$/.exec(String(text || '').trim());
        if (!m) return;
        if (!Array.isArray(aiState.lastMatches) || !aiState.lastMatches.length) return;
        const idx = m[1].toLowerCase().charCodeAt(0) - 97; // a=0
        if (idx < 0 || idx >= aiState.lastMatches.length) return;
        const match = aiState.lastMatches[idx];
        if (!match) return;
        if (window.DTGInlineForm && typeof window.DTGInlineForm.previewCustomer === 'function') {
            try { window.DTGInlineForm.previewCustomer(match); } catch (e) { /* non-fatal */ }
        }
        // Refine lastLookup to the picked one so subsequent fillFromQuote
        // calls have the right anchor.
        aiState.lastLookup = match;
    }

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
        const chatCopyBtn = document.getElementById('aiChatCopyBtn');

        if (openBtn) openBtn.addEventListener('click', openChatPanel);
        if (closeBtn) closeBtn.addEventListener('click', closeChatPanel);
        if (backdrop) backdrop.addEventListener('click', closeChatPanel);
        if (floatingBtn) floatingBtn.addEventListener('click', openChatPanel);
        if (resetBtn) resetBtn.addEventListener('click', resetChat);
        if (chatCopyBtn) chatCopyBtn.addEventListener('click', handleCopyChat);

        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                const text = ta.value.trim();
                if (!text || aiState.isStreaming) return;
                ta.value = '';
                autoResizeTextarea(ta);
                aiState.messages.push({ role: 'user', content: text });
                appendChatBubble('user', text);
                // Auto-update form from explicit rep input — chat writes to form
                // for things the rep was explicit about, so they don't have to
                // ALSO click. The form's snapshot then flows to the bot on the
                // next request via getFormSnapshot().
                tryAutoSetLocation(text);
                tryMenuLetterCustomerPick(text);
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
        aiState.isStreaming = false;
        // Clear the persistent quoteID + form state so next page load
        // doesn't try to resume a quote the rep just discarded.
        try {
            sessionStorage.removeItem('dtg.quoteID.v1');
            sessionStorage.removeItem('dtg.formState.v1');
        } catch {}
        try { delete window.__dtgQuoteID; } catch {}
        // 2026-05-19 — chat reset no longer wipes the form. The rep's manual
        // line-item work is their canonical state; chat is a side panel that
        // can be reset independently.
        if (ENABLE_BOT_FORM_FILL && window.DTGInlineForm && typeof window.DTGInlineForm.resetForm === 'function') {
            try { window.DTGInlineForm.resetForm(); } catch (e) { /* non-fatal */ }
        }
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
        // B4 — try restoring from sessionStorage first so a page refresh
        // doesn't burn a new quote sequence number.
        try {
            const stashed = sessionStorage.getItem('dtg.quoteID.v1');
            if (stashed) {
                aiState.quoteID = stashed;
                updateContextPill('drafting…');
                return aiState.quoteID;
            }
        } catch {}
        if (aiState.quoteIDPromise) return aiState.quoteIDPromise;
        aiState.quoteIDPromise = (async () => {
            try {
                const r = await fetch(API_BASE_URL + '/api/quote-sequence/' + QUOTE_PREFIX);
                if (!r.ok) throw new Error('quote-sequence ' + r.status);
                const d = await r.json();
                aiState.quoteID = `${d.prefix}-${d.year}-${String(d.sequence).padStart(3, '0')}`;
                try { sessionStorage.setItem('dtg.quoteID.v1', aiState.quoteID); } catch {}
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
        if (opts.productDetails) {
            const card = buildProductDetailsEl(opts.productDetails, {
                preselectedColor: opts.preselectedColor || null,
            });
            msg.appendChild(card);
            // If a curated-colors promise was started, wait for it then
            // inject the top-picks row into the rendered card.
            if (opts.curatedColorsPromise) {
                opts.curatedColorsPromise.then((curatedColors) => {
                    if (Array.isArray(curatedColors) && curatedColors.length) {
                        injectTopPicksRow(card, curatedColors, opts.productDetails);
                    }
                }).catch(() => { /* non-fatal */ });
            }
        }
        container.appendChild(msg);
        scrollChatBottom();
    }

    /**
     * Render product-details (lookup_product_details tool result) — title, then
     * a grid of clickable color swatches (from SanMar's COLOR_SQUARE_IMAGE),
     * then a list of size chips with upcharges proactively shown. Clicking a
     * swatch sends "Let's go with [Color Name]" back to the bot.
     */
    /**
     * Fetch the curated top colors for a style from the DTG_Top_Sellers_2026
     * Caspio table. Returns an array of { name, catalogColor, swatchUrl, units }
     * or [] if the style isn't in the curated list.
     */
    const _curatedColorsCache = new Map();
    async function fetchCuratedColorsForStyle(styleNumber) {
        const sn = String(styleNumber || '').trim().toUpperCase();
        if (!sn) return [];
        if (_curatedColorsCache.has(sn)) return _curatedColorsCache.get(sn);
        try {
            const r = await fetch(`${API_BASE_URL}/api/dtg/top-sellers?style=${encodeURIComponent(sn)}`);
            if (!r.ok) { _curatedColorsCache.set(sn, []); return []; }
            const data = await r.json();
            const list = Array.isArray(data && data.records) ? data.records.map((r) => ({
                name: r.color_name || '',
                catalogColor: r.catalog_color || '',
                swatchUrl: r.swatch_image_url || '',
                units: Number(r.color_units_sold || 0),
                rank: Number(r.color_rank || 0),
            })) : [];
            _curatedColorsCache.set(sn, list);
            return list;
        } catch {
            _curatedColorsCache.set(sn, []);
            return [];
        }
    }

    /**
     * Inject a "★ NWCA top picks" row above the existing color grid in
     * a product-details card. Renders 4-6 mini swatches with click handlers
     * that fire the same chat-message dispatch as a regular swatch pick.
     */
    function injectTopPicksRow(cardEl, curatedColors, productData) {
        if (!cardEl || !Array.isArray(curatedColors) || !curatedColors.length) return;
        // Find the existing color-swatch-grid in the card so we can insert before it
        const grid = cardEl.querySelector('.color-swatch-grid');
        if (!grid) return;
        // Already injected? (don't double-render if fetch resolved twice)
        if (cardEl.querySelector('.pd-top-picks')) return;

        const wrap = document.createElement('div');
        wrap.className = 'pd-top-picks';
        const styleNumber = productData?.styleNumber || '';
        const limit = Math.min(6, curatedColors.length);
        const picks = curatedColors.slice(0, limit);

        wrap.innerHTML = `
            <div class="pd-top-picks-label">
                <i class="fas fa-star"></i>
                NWCA top picks for ${escapeHtml(styleNumber)}
                <span class="pd-top-picks-hint">— our best-selling colors</span>
            </div>
            <div class="pd-top-picks-grid">
                ${picks.map((c) => `
                    <button type="button" class="pd-top-pick"
                            data-color-name="${escapeHtml(c.name)}"
                            data-catalog-color="${escapeHtml(c.catalogColor)}"
                            title="${escapeHtml(c.name)} — ${c.units.toLocaleString()} units sold">
                        ${c.swatchUrl
                            ? `<img class="pd-top-pick-swatch" src="${escapeHtml(c.swatchUrl)}" alt="" loading="lazy" onerror="this.classList.add('placeholder');this.removeAttribute('src');">`
                            : `<div class="pd-top-pick-swatch placeholder"></div>`}
                        <span class="pd-top-pick-name">${escapeHtml(c.name)}</span>
                    </button>
                `).join('')}
            </div>
        `;
        // Click handler — same payload as the full-grid swatches
        wrap.querySelectorAll('.pd-top-pick').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (aiState.isStreaming) return;
                const colorName = btn.getAttribute('data-color-name') || '';
                if (!colorName) return;
                const ta = document.getElementById('aiChatTextarea');
                const form = document.getElementById('aiChatForm');
                if (!ta || !form) return;
                ta.value = styleNumber
                    ? `For ${styleNumber}, let's go with ${colorName}.`
                    : `Let's go with ${colorName}.`;
                form.dispatchEvent(new Event('submit', { cancelable: true }));
            });
        });

        // Insert BEFORE the swatch-grid section label (or grid itself)
        const sectionLabel = grid.previousElementSibling;
        if (sectionLabel && sectionLabel.classList.contains('pd-section-label')) {
            cardEl.insertBefore(wrap, sectionLabel);
        } else {
            cardEl.insertBefore(wrap, grid);
        }
    }

    /**
     * Detect a "preselected" color for a product-details card by inspecting:
     *   (a) form rows — if a row already exists with this style + a non-empty
     *       color (set by previewStyle/fillFromQuote), use it.
     *   (b) the latest user chat message — if it mentions a token (3+ chars)
     *       that appears as a whole word in exactly one canonical COLOR_NAME,
     *       use it. Multiple matches → prefer shortest (the "plain" one).
     *
     * Returns the canonical color name (string) or null.
     */
    function detectPreselectedColor(result) {
        const colors = Array.isArray(result.colors) ? result.colors : [];
        if (!colors.length) return null;

        // 🔴 PRIORITY: Latest user message wins over existing form rows.
        //
        // Why: if the rep already added PC61 Jet Black and now types
        // "pc61 in yellow", they're adding a NEW color. The user's CURRENT
        // intent (yellow) trumps the existing row (jet black). Looking at
        // the form row first would pick Jet Black and render the wrong
        // matrix.
        //
        // (a) Latest user message scan — explicit color win.
        try {
            const userMsgs = (aiState.messages || []).filter((m) => m.role === 'user');
            if (userMsgs.length) {
                const txt = String(userMsgs[userMsgs.length - 1].content || '').toLowerCase();
                if (txt) {
                    // For each canonical color, count how many of its words
                    // (3+ chars) appear in the user text. Higher word-match
                    // wins; ties broken by shorter canonical name. So
                    // "athletic heather" picks "Athletic Heather" not
                    // "Black Heather".
                    const scored = [];
                    for (const c of colors) {
                        const cn = String(c.name || '').toLowerCase();
                        if (!cn) continue;
                        const words = (cn.match(/[a-z]+/g) || []).filter((w) => w.length >= 3);
                        if (!words.length) continue;
                        let matchCount = 0;
                        for (const w of words) {
                            const re = new RegExp('\\b' + w + '\\b');
                            if (re.test(txt)) matchCount++;
                        }
                        if (matchCount > 0) scored.push({ c, matchCount, len: cn.length });
                    }
                    if (scored.length) {
                        scored.sort((a, b) => (b.matchCount - a.matchCount) || (a.len - b.len));
                        return scored[0].c.name;
                    }
                }
            }
        } catch (e) { /* ignore */ }

        // (b) Form row fallback — only if the user message had no color
        //     mention. Used for repeated lookups where the rep clicked
        //     "+ Another color of PC61" without typing a new color.
        try {
            if (window.DTGInlineForm && typeof window.DTGInlineForm.getRows === 'function') {
                const rows = window.DTGInlineForm.getRows() || [];
                const style = String(result.styleNumber || '').toUpperCase();
                // Match on style only IF there's exactly one row for this style.
                // If multiple rows (e.g. two PC61 colors), don't guess —
                // let the rep pick from the swatch grid.
                const matched = rows.filter((r) => String(r.style || '').toUpperCase() === style && r.color);
                if (matched.length === 1) {
                    const row = matched[0];
                    const exact = colors.find((c) => String(c.name || '').toLowerCase() === String(row.color).toLowerCase());
                    if (exact) return exact.name;
                    const fuzzy = colors.find((c) => String(c.name || '').toLowerCase().includes(String(row.color).toLowerCase()));
                    if (fuzzy) return fuzzy.name;
                }
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    function buildProductDetailsEl(data, opts = {}) {
        const wrap = document.createElement('div');
        wrap.className = 'product-details-card';
        const colors = Array.isArray(data.colors) ? data.colors : [];
        const sizes = Array.isArray(data.sizes) ? data.sizes : [];
        const warnings = Array.isArray(data.avoidWarnings) ? data.avoidWarnings : [];
        const preselectedColor = opts.preselectedColor || null;
        const preselectedColorObj = preselectedColor
            ? colors.find((c) => String(c.name || '').toLowerCase() === String(preselectedColor).toLowerCase())
            : null;

        // Detect avoid-list colors (for warning badge on PC61 Red, PC78H White)
        const avoidColorMatch = (name) => {
            const n = String(name).toLowerCase();
            if (data.styleNumber === 'PC61' && n.includes('red')) return true;
            if (data.styleNumber === 'PC78H' && n === 'white') return true;
            return false;
        };

        // Pick the hero image — preselected wins if set, else first w/ image.
        const hero = preselectedColorObj && preselectedColorObj.mainImageUrl
            ? preselectedColorObj
            : (colors.find((c) => c.mainImageUrl) || null);
        const isConfirmed = !!preselectedColorObj;

        let html = '';
        if (hero) {
            html += `
                <div class="pd-hero${isConfirmed ? ' confirmed' : ''}">
                    <img class="pd-hero-img"
                         src="${escapeHtml(hero.mainImageUrl)}"
                         alt="${escapeHtml(data.styleNumber)} in ${escapeHtml(hero.name)}"
                         data-default-src="${escapeHtml(hero.mainImageUrl)}"
                         data-default-color="${escapeHtml(hero.name)}"
                         onerror="this.style.display='none';">
                    <div class="pd-hero-caption" data-default-color="${escapeHtml(hero.name)}">${isConfirmed ? '<i class="fas fa-check"></i> ' : ''}${escapeHtml(hero.name)}</div>
                </div>`;
        }

        html += `
            <div class="pd-label">Catalog details</div>
            <div class="pd-title"><span class="pd-style">${escapeHtml(data.styleNumber)}</span> · ${escapeHtml(data.title || '')}</div>
            <div class="pd-meta">${fmtInt(data.colorCount || 0)} colors available · ${fmtInt(data.sizeCount || 0)} sizes${data.hasUpcharges ? ' · 2XL+ upcharges apply' : ''}</div>
        `;

        if (colors.length > 0) {
            if (isConfirmed) {
                // Color already known — collapse swatches behind an expander so
                // the card reads as a confirmation, not an interrogation.
                html += `<button type="button" class="pd-swatch-expander" aria-expanded="false">Pick a different color (${fmtInt(colors.length)} available) <i class="fas fa-chevron-down"></i></button>`;
                html += `<div class="color-swatch-grid pd-collapsed" hidden>`;
            } else {
                html += `<div class="pd-section-label">Hover to preview · click to pick</div>`;
                html += `<div class="color-swatch-grid">`;
            }
            for (const c of colors) {
                const warn = avoidColorMatch(c.name);
                const isHero = isConfirmed && preselectedColorObj && c.name === preselectedColorObj.name;
                const imgHtml = c.swatchImageUrl
                    ? `<img class="cs-img" src="${escapeHtml(c.swatchImageUrl)}" alt="${escapeHtml(c.name)}" loading="lazy" onerror="this.classList.add('placeholder');this.removeAttribute('src');">`
                    : `<div class="cs-img placeholder"></div>`;
                html += `
                    <button type="button" class="color-swatch${warn ? ' warning' : ''}${isHero ? ' picked' : ''}"
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

        // Inline size-entry matrix — only when a color is locked (confirmed
        // mode). Lets the rep tab through size inputs and click "Add to
        // quote" instead of typing "S:4 M:8 L:6" in the chat textarea.
        // Submits a structured message back to the bot which then prices
        // via quote_dtg_pricing as part of its normal intake.
        if (isConfirmed && sizes.length > 0) {
            const matrixId = 'pd-matrix-' + Math.random().toString(36).slice(2, 9);
            html += `<div class="pd-size-matrix" id="${matrixId}" data-style="${escapeHtml(data.styleNumber)}" data-color="${escapeHtml(preselectedColorObj.name)}">`;
            html += `<div class="pd-section-label">Quick sizes — fill what you need, then Add to quote</div>`;
            html += `<div class="pd-size-matrix-grid">`;
            for (const s of sizes) {
                const up = s.hasUpcharge ? `<span class="pd-sm-up">+$${fmtMoney(s.upcharge)}</span>` : '';
                const upchargeClass = s.hasUpcharge ? ' has-upcharge' : '';
                html += `
                    <label class="pd-sm-cell${upchargeClass}">
                        <span class="pd-sm-label">${escapeHtml(s.size)}${up}</span>
                        <input type="number" min="0" step="1" inputmode="numeric"
                               data-size="${escapeHtml(s.size)}"
                               placeholder="0">
                    </label>`;
            }
            html += `</div>`;
            html += `
                <div class="pd-size-matrix-actions">
                    <span class="pd-sm-total">0 pcs</span>
                    <button type="button" class="pd-sm-add" disabled>
                        Add to quote <i class="fas fa-arrow-right"></i>
                    </button>
                </div>`;
            html += `</div>`;
        } else if (sizes.length > 0) {
            // Non-confirmed mode (no color yet) — show the original read-only
            // size chips with upcharges so the rep sees the available range.
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

        // If we rendered in "confirmed" mode (preselected color), lock the
        // hero on that color so swatch hovers don't replace it until the
        // rep explicitly clicks one.
        if (isConfirmed) wrap.dataset.locked = 'true';

        // Wire up the inline size matrix (only present in confirmed mode)
        const matrix = wrap.querySelector('.pd-size-matrix');
        if (matrix) {
            const inputs = matrix.querySelectorAll('input[data-size]');
            const totalEl = matrix.querySelector('.pd-sm-total');
            const addBtn = matrix.querySelector('.pd-sm-add');

            function recalcMatrix() {
                let total = 0;
                inputs.forEach((inp) => {
                    const v = parseInt(inp.value, 10);
                    if (Number.isFinite(v) && v > 0) total += v;
                });
                totalEl.textContent = total === 1 ? '1 pc' : `${total} pcs`;
                addBtn.disabled = total === 0 || aiState.isStreaming;
            }

            inputs.forEach((inp) => {
                inp.addEventListener('input', recalcMatrix);
                // Enter on any cell submits if total > 0
                inp.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !addBtn.disabled) {
                        e.preventDefault();
                        addBtn.click();
                    }
                });
            });

            addBtn.addEventListener('click', () => {
                if (aiState.isStreaming) return;
                const parts = [];
                const sizesObj = {};
                inputs.forEach((inp) => {
                    const v = parseInt(inp.value, 10);
                    if (Number.isFinite(v) && v > 0) {
                        const sz = inp.getAttribute('data-size');
                        parts.push(`${sz}:${v}`);
                        sizesObj[sz] = v;
                    }
                });
                if (!parts.length) return;
                const style = matrix.getAttribute('data-style') || '';
                const color = matrix.getAttribute('data-color') || '';

                // 2026-05-19 — chat is now research-only. The matrix still
                // sends sizes to the bot so it can quote, but no longer writes
                // to the order form. Rep manually adds the style via the catalog.
                if (ENABLE_BOT_FORM_FILL && window.DTGInlineForm && typeof window.DTGInlineForm.previewLineItems === 'function') {
                    try {
                        window.DTGInlineForm.previewLineItems([{
                            styleNumber: style,
                            color: color,
                            sizes: sizesObj,
                        }]);
                    } catch (e) { /* non-fatal */ }
                }

                // Still send the chat message so the bot tracks the line
                // and can call quote_dtg_pricing when it has the location.
                const msg = `Sizes for ${style} ${color}: ${parts.join(' ')}`;
                const ta = document.getElementById('aiChatTextarea');
                const form = document.getElementById('aiChatForm');
                if (!ta || !form) return;
                ta.value = msg;
                form.dispatchEvent(new Event('submit', { cancelable: true }));
                // Disable the matrix after submit so the rep can't double-submit
                inputs.forEach((inp) => { inp.disabled = true; });
                addBtn.disabled = true;
                addBtn.innerHTML = '<i class="fas fa-check"></i> Sent';
                matrix.classList.add('pd-size-matrix-sent');

                // After submit, show explicit follow-up actions so the rep
                // doesn't have to guess "what next?". Two clear paths:
                //   (1) Add another color of THIS style — clicks the existing
                //       swatch expander, scrolls the grid into view.
                //   (2) Different style or done — just type/use chat.
                if (!matrix.parentElement.querySelector('.pd-size-matrix-followup')) {
                    const followup = document.createElement('div');
                    followup.className = 'pd-size-matrix-followup';
                    followup.innerHTML = `
                        <button type="button" class="pd-sm-add-color">
                            <i class="fas fa-plus"></i> Another color of ${escapeHtml(style)}
                        </button>
                        <span class="pd-sm-divider">— or type a new style in chat below</span>
                    `;
                    matrix.parentElement.insertBefore(followup, matrix.nextSibling);

                    followup.querySelector('.pd-sm-add-color').addEventListener('click', () => {
                        const expander = wrap.querySelector('.pd-swatch-expander');
                        const grid = wrap.querySelector('.color-swatch-grid');
                        // Open the swatch grid if it's collapsed (confirmed mode)
                        if (expander && expander.getAttribute('aria-expanded') === 'false') {
                            expander.click();
                        }
                        // Scroll to it so the rep can pick
                        if (grid) {
                            setTimeout(() => grid.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                        }
                    });
                }
            });

            // Auto-focus the first non-upcharge size cell (usually S or M)
            const firstReg = matrix.querySelector('.pd-sm-cell:not(.has-upcharge) input');
            if (firstReg) setTimeout(() => firstReg.focus(), 100);
        }

        // Wire up the swatch-grid expander (only present in confirmed mode)
        const expander = wrap.querySelector('.pd-swatch-expander');
        const grid = wrap.querySelector('.color-swatch-grid');
        if (expander && grid) {
            expander.addEventListener('click', () => {
                const isHidden = grid.hasAttribute('hidden');
                if (isHidden) {
                    grid.removeAttribute('hidden');
                    expander.setAttribute('aria-expanded', 'true');
                    expander.innerHTML = `Hide colors <i class="fas fa-chevron-up"></i>`;
                    // Unlock the hero so hovering a swatch previews the new
                    // color. The first click commits + re-locks via the
                    // standard swatch click handler below.
                    wrap.dataset.locked = 'false';
                } else {
                    grid.setAttribute('hidden', '');
                    expander.setAttribute('aria-expanded', 'false');
                    expander.innerHTML = `Pick a different color (${fmtInt(colors.length)} available) <i class="fas fa-chevron-down"></i>`;
                    // Restore the original confirmed-color lock
                    wrap.dataset.locked = 'true';
                }
            });
        }

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
                // Include the style number so the bot doesn't have to ask
                // "which style?" when multiple product-detail cards are on screen.
                const styleNumber = data && data.styleNumber ? data.styleNumber : '';
                ta.value = styleNumber
                    ? `For ${styleNumber}, let's go with ${colorName}.`
                    : `Let's go with ${colorName}.`;
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
            // Preserve the AI quoteID alongside the priceQuote so the form can
            // include it in the ShopWorks "Notes On Order".
            if (aiState.quoteID && !priceQuote.quoteID) priceQuote.quoteID = aiState.quoteID;
            renderDtgQuoteCard(bubbleEl, priceQuote);
        }
        if (customerFinal) aiState.currentCustomerFinal = customerFinal;
        if (emailDraft) {
            aiState.currentEmailDraft = emailDraft;
            renderEmailDraftCard(bubbleEl, emailDraft);
        }
        updateActionsAvailability();

        // 2026-05-19 — bot is research-only now. Quote info renders in the
        // chat for the rep to read; they manually build the order via the
        // catalog. Flag flip restores the auto-fill behavior.
        if (ENABLE_BOT_FORM_FILL && (priceQuote || customerFinal) && window.DTGInlineForm && typeof window.DTGInlineForm.fillFromQuote === 'function') {
            try {
                window.DTGInlineForm.fillFromQuote(priceQuote, customerFinal);
            } catch (err) {
                console.error('[dtg-ai] failed to fill inline form:', err);
            }
        }
    }

    // Weighted avg per-piece: lineTotal / qty. We compute this on the frontend
    // (rather than trust the bot's `finalUnitPrice` field) because the bot
    // sometimes emits the S-XL base unit instead of the actual weighted avg
    // when sizes include 2XL+ upcharges. The lineTotal IS reliable (math is
    // done by the canonical pricing module), so dividing by qty always wins.
    function avgPerPiece(it) {
        const qty = Number(it.totalQuantity) || 0;
        const total = Number(it.lineTotal) || 0;
        if (qty > 0 && total > 0) return Math.round((total / qty) * 100) / 100;
        return Number(it.finalUnitPrice) || 0;
    }

    function renderDtgQuoteCard(bubbleEl, priceQuote) {
        const msgEl = bubbleEl.closest('.chat-message');
        if (!msgEl) return;
        const items = Array.isArray(priceQuote.lineItems) ? priceQuote.lineItems : [];
        if (items.length === 0) return;
        const rules = priceQuote.appliedRules || {};
        const totals = priceQuote.totals || {};

        // Shared imprint + tier come from the top of the PRICE_QUOTE block when
        // multi-line, or from the first line for backward-compat.
        const sharedLocLabel = priceQuote.locationLabel
            || items[0].locationLabel || items[0].locationCode || '';
        const sharedTier = priceQuote.tier || items[0].tier || '';
        const tierIsLtm = /LTM/i.test(String(sharedTier));
        const combinedQty = Number(priceQuote.combinedQuantity)
            || items.reduce((s, it) => s + (Number(it.totalQuantity) || 0), 0);
        const subtotal = Number(priceQuote.subtotal)
            || items.reduce((s, it) => s + (Number(it.lineTotal) || 0), 0);

        const card = document.createElement('div');
        card.className = 'dtg-quote-card';

        const isMulti = items.length > 1;

        let linesHtml = '';
        items.forEach((it) => {
            const sizesHtml = it.sizes
                ? Object.entries(it.sizes).map(([s, q]) => `<span>${escapeHtml(s)}: ${fmtInt(q)}</span>`).join('')
                : '';
            linesHtml += `
                <div class="dtg-line-item">
                    <div class="dtg-pn">${escapeHtml(it.partNumber || 'DTG-CUSTOM')}</div>
                    <div class="dtg-product-line">${escapeHtml(it.description || ((it.style || it.styleNumber || '') + ' — ' + (it.color || '')))}</div>
                    <div class="dtg-sizes">${sizesHtml}</div>
                    <div class="dtg-line"><span>${fmtInt(Number(it.totalQuantity) || 0)} pieces @ $${fmtMoney(avgPerPiece(it))}/pc</span><span class="v">$${fmtMoney(Number(it.lineTotal) || 0)}</span></div>
                </div>`;
        });

        const upchargeNote = rules.sizeUpcharge ? `<div class="dtg-rule-note"><strong>Size upcharge:</strong> ${escapeHtml(rules.sizeUpcharge)}</div>` : '';
        const ltmNote = rules.ltm ? `<div class="dtg-rule-note"><strong>LTM:</strong> ${escapeHtml(rules.ltm)}</div>` : '';
        const tierNote = rules.tier ? `<div class="dtg-rule-note"><strong>Tier:</strong> ${escapeHtml(rules.tier)}</div>` : '';
        const tierByImprintNote = rules.tierIsByImprint
            ? `<div class="dtg-rule-note dtg-rule-info"><strong>Pricing model:</strong> ${escapeHtml(rules.tierIsByImprint)}</div>`
            : '';

        card.innerHTML = `
            <div class="dtg-label">Live DTG quote${isMulti ? ` · ${items.length} lines` : ''}</div>
            <div class="dtg-shared-header">
                <span class="dtg-location-pill">${escapeHtml(sharedLocLabel)}</span>
                <span class="dtg-tier-pill${tierIsLtm ? ' ltm' : ''}">${escapeHtml(sharedTier)}</span>
                <span class="dtg-combined-qty">${fmtInt(combinedQty)} combined pieces</span>
            </div>

            ${linesHtml}

            <div class="dtg-line subtotal"><span>Subtotal</span><span class="v">$${fmtMoney(subtotal)}</span></div>
            ${Number(totals.taxEstimate) ? `<div class="dtg-line"><span>Tax (est)</span><span class="v">$${fmtMoney(Number(totals.taxEstimate))}</span></div>` : ''}
            <div class="dtg-line total"><span>Order total</span><span class="v">$${fmtMoney(Number(totals.grandTotal) || subtotal)}</span></div>

            ${tierNote}
            ${ltmNote}
            ${upchargeNote}
            ${tierByImprintNote}
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
        if (!actions) return;
        const hasDraft = !!aiState.currentEmailDraft;
        const hasQuote = !!aiState.currentPriceQuote;
        const hasCustomer = !!aiState.currentCustomerFinal;
        actions.hidden = !(hasDraft || hasQuote);
        if (outlookBtn) outlookBtn.disabled = !hasDraft;
        if (copyBtn) copyBtn.disabled = !hasDraft;
        if (saveBtn) saveBtn.disabled = !(hasDraft && hasQuote && hasCustomer);
        if (aiState.savedQuoteID && saveBtn) {
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
            // Send a live snapshot of the form so the bot knows what's
            // already set (location, rows, customer) and skips re-asking.
            // The form is the source of truth — the bot reads from it.
            const formState = (window.DTGInlineForm && typeof window.DTGInlineForm.getFormSnapshot === 'function')
                ? (function () {
                    try { return window.DTGInlineForm.getFormSnapshot(); } catch { return null; }
                })()
                : null;
            const response = await fetch(AI_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: aiState.messages,
                    calcContext: {
                        quoteID: aiState.quoteID,
                        formState,
                    },
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
            // A3 — stash the full match list so a subsequent "d" reply
            // from the rep can fill the customer pane via letter-index
            // without waiting for the bot's follow-up reply.
            aiState.lastMatches = matches.slice(0, 26); // up to A-Z
            const status = matches.length === 0
                ? 'No customer match — drafting generic'
                : (matches.length === 1
                    ? `Found ${matches[0].company || matches[0].contact_name || 'match'}`
                    : `${matches.length} matches — narrowing…`);
            appendToolChip(tool, status);
            // 2026-05-19 — chat is research-only. Customer info renders in
            // the chat chip above for the rep to copy; we no longer push it
            // to the form's customer pane.
            if (ENABLE_BOT_FORM_FILL && matches.length === 1 && window.DTGInlineForm && typeof window.DTGInlineForm.previewCustomer === 'function') {
                try { window.DTGInlineForm.previewCustomer(matches[0]); } catch (e) { /* non-fatal */ }
            }
        } else if (tool === 'quote_dtg_pricing') {
            if (result.error) {
                appendToolChip(tool, `Error: ${result.message || result.error}`);
            } else {
                // 2026-05-19 — chat is research-only. The bot quotes the
                // price into the chat chip; rep manually mirrors the order
                // via the catalog. Pricing math still runs server-side so
                // the rep can quote over the phone before building.
                const lineItems = Array.isArray(result.lineItems) && result.lineItems.length
                    ? result.lineItems
                    : (result.styleNumber ? [result] : []);
                if (ENABLE_BOT_FORM_FILL && lineItems.length && window.DTGInlineForm && typeof window.DTGInlineForm.previewLineItems === 'function') {
                    try { window.DTGInlineForm.previewLineItems(lineItems); } catch (e) { /* non-fatal */ }
                }
                if (Array.isArray(result.lineItems) && result.lineItems.length > 1) {
                    const qty = result.combinedQuantity || result.totalQuantity || 0;
                    const sub = result.subtotal || result.lineItems.reduce((s, l) => s + (Number(l.lineTotal) || 0), 0);
                    const ltm = result.isLtmTier ? ` · LTM +$${fmtMoney(result.ltmPerUnit)}/pc` : '';
                    appendToolChip(tool,
                        `${result.lineItems.length} lines @ ${result.locationLabel || result.locationCode} · ${fmtInt(qty)} combined pieces · tier ${result.tier}${ltm} · subtotal $${fmtMoney(sub)}`
                    );
                } else {
                    appendToolChip(tool,
                        `${result.partNumber}: $${fmtMoney(result.lineTotal)} (${fmtInt(result.totalQuantity)} @ avg $${fmtMoney(result.finalUnitPrice)})`
                    );
                }
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
                const preselectedColor = detectPreselectedColor(result);

                // Fire a parallel fetch for the curated top colors for this
                // style (from DTG_Top_Sellers_2026). When it lands, slot the
                // top-picks row into the rendered product card. Non-blocking:
                // the card renders immediately with just the full grid; the
                // top-picks row appears 100-300ms later.
                let curatedColorsPromise = null;
                if (cc >= 10) {
                    // Only worth showing for styles with many colors. For
                    // smaller catalogs (PC150 has 16 colors, just a few)
                    // the full grid is already manageable.
                    curatedColorsPromise = fetchCuratedColorsForStyle(result.styleNumber);
                }

                appendToolChip(tool, `${result.styleNumber}: ${cc} color${cc === 1 ? '' : 's'} · ${sc} size${sc === 1 ? '' : 's'}${preselectedColor ? ` · ✓ ${preselectedColor}` : ''}`, { productDetails: result, preselectedColor, curatedColorsPromise });
                // 2026-05-19 — chat is research-only. The product card with
                // color swatches renders in the chat for the rep to browse;
                // they pick the style + color from the catalog above to build
                // the actual order.
                if (ENABLE_BOT_FORM_FILL && window.DTGInlineForm && typeof window.DTGInlineForm.previewStyle === 'function') {
                    try {
                        window.DTGInlineForm.previewStyle({
                            style: result.styleNumber,
                            desc: result.title || '',
                            color: preselectedColor || null,
                            colorsAvailable: result.colors || [],
                            availableSizes: (result.sizes || []).map((s) => String(s.size).toUpperCase()),
                        });
                    } catch (e) { /* non-fatal */ }
                }
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

    // Copy Chat — dump the full conversation to clipboard as plain text.
    // Used when the rep wants to paste the chat into a bug report, share it
    // with another rep, or send it to the AI feedback loop.
    function handleCopyChat() {
        const container = document.getElementById('aiChatMessages');
        if (!container) { showToast('No chat to copy'); return; }
        const lines = [];
        if (aiState.quoteID) lines.push(`Quote: ${aiState.quoteID}`);
        lines.push(`Copied: ${new Date().toLocaleString()}`);
        lines.push('---');
        container.querySelectorAll('.chat-message').forEach((msg) => {
            const role = msg.classList.contains('user') ? 'REP' : 'BOT';
            // innerText drops <script> + collapses whitespace nicely
            const txt = (msg.innerText || '').trim();
            if (!txt) return;
            lines.push(`${role}: ${txt}`);
            lines.push('');
        });
        const text = lines.join('\n').trim();
        if (!text) { showToast('Nothing to copy yet'); return; }
        navigator.clipboard.writeText(text).then(() => {
            showToast(`Chat copied — ${container.querySelectorAll('.chat-message').length} messages`);
        }).catch((err) => {
            console.warn('[dtg-ai] copy-chat failed:', err);
            showToast('Copy failed — check console');
        });
    }

    let _dtgSaveInFlight = false;
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
        // [2026-06-08] Phase 1 Chunk C — reentrancy guard. The form's #dtgSaveBtn and the
        // chat-panel #aiSaveQuoteBtn both call this; a fast double-click during the in-flight
        // POST would CREATE a second quote_sessions + duplicate quote_items under one QuoteID.
        if (_dtgSaveInFlight) return;
        _dtgSaveInFlight = true;
        const saveBtn = document.getElementById('aiSaveQuoteBtn');
        if (saveBtn) saveBtn.disabled = true;
        try {
            // [2026-06-08] Phase 1 Chunk C — the MANUAL inline-form is the source of truth
            // when it has priced rows. aiState.currentPriceQuote is the AI chat's quote and
            // does NOT reflect manual row/qty/tax edits (it's set ONLY from the PRICE_QUOTE
            // block at :997). Prefer the live form quote so the saved record == the on-screen
            // total (Erik's #1 rule) and so tax/wholesale (recomputeTaxRate, the single
            // authority) persist. Fall back to the AI quote when the form has no priced rows.
            let priceQuote = aiState.currentPriceQuote;
            let customer = aiState.currentCustomerFinal || {};
            const draft = aiState.currentEmailDraft || {};
            const formQuote = (window.DTGInlineForm && typeof window.DTGInlineForm.getSaveQuote === 'function')
                ? window.DTGInlineForm.getSaveQuote()
                : null;
            if (formQuote && formQuote.lineItems && formQuote.lineItems.length) {
                priceQuote = formQuote;
                if (formQuote.customer) customer = { ...customer, ...formQuote.customer };
            }
            if (!priceQuote || !priceQuote.lineItems || !priceQuote.lineItems.length) {
                throw new Error('No price quote to save');
            }
            const quoteID = aiState.quoteID || await ensureQuoteID();
            if (!quoteID) throw new Error('Failed to get quote ID');
            const lineItems = priceQuote.lineItems;
            const totals = priceQuote.totals || {};
            const subtotal = lineItems.reduce((s, it) => s + (Number(it.lineTotal) || 0), 0);
            // Canonical tax for the saved record. /invoice reconstructs
            // grand = TotalAmount + TaxAmount (reading TaxAmount VERBATIM), so TotalAmount
            // MUST be pre-tax — never bake tax in (the SCP/DTF double-tax bug). The form
            // branch carries taxRate/taxAmount; the AI branch uses totals.taxEstimate.
            let taxRate = Number(priceQuote.taxRate);
            if (!Number.isFinite(taxRate)) taxRate = Number(totals.taxRate) || 0;
            let taxAmount = Number(priceQuote.taxAmount);
            if (!Number.isFinite(taxAmount)) taxAmount = Number(totals.taxAmount);
            if (!Number.isFinite(taxAmount)) taxAmount = Number(totals.taxEstimate) || 0;
            if (!taxRate && subtotal > 0 && taxAmount > 0) {
                taxRate = Math.round((taxAmount / subtotal) * 10000) / 10000;
            }
            const isWholesale = !!priceQuote.isWholesale;
            // [2026-06-09] Phase 2 — billed shipping (taxable in WA). Mirror DTF/SCP: TotalAmount
            // is products-only PRE-tax (EXCLUDES shipping); the fee rides as a separate SHIP line
            // item (written below) so /quote + /invoice SHOW a Shipping row + foot. TaxAmount stays
            // on (subtotal+fee) — shipping IS taxed. (The first cut baked the fee into TotalAmount
            // with NO SHIP item: it footed, but the readers detect shipping ONLY via the SHIP item
            // — never the ShippingFee column — so the shipping line was hidden + the Subtotal was
            // silently inflated. Caught by the Phase 2 adversarial review.) AI-chat fallback quotes
            // carry no shippingFee → 0 (no SHIP item, unchanged).
            const shippingFee = Number(priceQuote.shippingFee) || 0;

            // Phase 11.6 (Erik 2026-05-24): edit-reopen mode — when the rep
            // loaded the form via /quote-builders/dtg-quote-builder.html?edit=DTG-NNN,
            // dtg-inline-form set window._dtgEditingQuoteId + _dtgEditingPK_ID
            // + _dtgEditingRevision. In that mode the save becomes a REVISION
            // (PUT to existing session + replace items, same QuoteID, bumped
            // RevisionNumber) instead of CREATE (POST a fresh session).
            const isEditMode = !!(window._dtgEditingQuoteId && window._dtgEditingPK_ID);
            const effectiveQuoteID = isEditMode ? window._dtgEditingQuoteId : quoteID;
            const newRevision = isEditMode ? (Number(window._dtgEditingRevision) || 1) + 1 : 1;

            const sessionPayload = {
                QuoteID: effectiveQuoteID,
                SessionID: `dtg_${Date.now()}`,
                Status: 'Open',
                CustomerEmail: customer.email || '',
                CustomerName: customer.name || '',
                CompanyName: customer.company || '',
                Phone: customer.phone || '',
                TotalQuantity: lineItems.reduce((s, it) => s + (Number(it.totalQuantity) || 0), 0),
                SubtotalAmount: subtotal,
                // [2026-06-09] Phase 2 — billed shipping (0 unless the rep entered/estimated one).
                // Kept as audit metadata; the readers foot off the SHIP line item, not this column.
                ShippingFee: shippingFee,
                LTMFeeTotal: lineItems.reduce((s, it) => s + (Number(it.ltmPerUnit) * Number(it.totalQuantity) || 0), 0),
                // PRE-tax, products-only (matches EMB/SCP/DTF). EXCLUDES shipping — the SHIP line
                // item carries it. /quote + /invoice add SHIP + TaxAmount on top → grand foots.
                TotalAmount: subtotal,
                // [2026-06-08] Phase 1 Chunk C — persist tax so saved record + /quote + /invoice
                // + push agree. TaxRate is a DECIMAL (0.101) like EMB; readers normalize >1?/100.
                TaxRate: taxRate,
                TaxAmount: taxAmount,
                IsWholesale: isWholesale ? 'Yes' : 'No',
                Notes: JSON.stringify({
                    productType: 'dtg',
                    designNumber: customer.designNumber || null,
                    appliedRules: priceQuote.appliedRules || {},
                    customer,
                    emailSubject: draft.subject || '',
                    // Chunk E (edit-reload) restores these so a reopened exempt/wholesale/
                    // out-of-state quote doesn't silently revert to 10.1% Milton pickup.
                    shipping: priceQuote.shipping || null,
                    tax: {
                        isWholesale,
                        isTaxExempt: !!priceQuote.isTaxExempt,
                        taxExemptNumber: priceQuote.taxExemptNumber || '',
                        taxRate,
                        taxRateSource: (priceQuote.shipping && priceQuote.shipping.taxRateSource) || '',
                        taxAccount: priceQuote.taxAccount || '',
                        taxAccountName: priceQuote.taxAccountName || '',
                        taxRateOverride: (priceQuote.shipping && priceQuote.shipping.taxRateOverride != null)
                            ? priceQuote.shipping.taxRateOverride : null,
                        includeTax: priceQuote.shipping ? (priceQuote.shipping.includeTax !== false) : true,
                    },
                }),
                ...(isEditMode ? { RevisionNumber: newRevision } : {}),
            };

            if (isEditMode) {
                // PUT existing session by PK_ID (Caspio update)
                const putRes = await fetch(`${API_BASE_URL}/api/quote_sessions/${window._dtgEditingPK_ID}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sessionPayload),
                });
                if (!putRes.ok) {
                    const t = await putRes.text();
                    throw new Error('quote_sessions PUT ' + putRes.status + ': ' + t.slice(0, 200));
                }
                // Replace items: fetch existing rows then DELETE each by PK_ID.
                // Caspio's proxy doesn't support bulk-delete by QuoteID filter,
                // so we walk the list. If any individual delete fails we keep
                // going and log — the new items still post (might briefly show
                // dupes in quote-view but the latest revision wins on amount).
                try {
                    const existingRes = await fetch(
                        `${API_BASE_URL}/api/quote_items?QuoteID=${encodeURIComponent(effectiveQuoteID)}`
                    );
                    if (existingRes.ok) {
                        const existing = await existingRes.json();
                        const oldItems = Array.isArray(existing) ? existing : [];
                        for (const oi of oldItems) {
                            if (!oi || !oi.PK_ID) continue;
                            try {
                                const delRes = await fetch(
                                    `${API_BASE_URL}/api/quote_items/${oi.PK_ID}`,
                                    { method: 'DELETE' }
                                );
                                if (!delRes.ok) {
                                    console.warn('[dtg-ai] delete item', oi.PK_ID, 'returned', delRes.status);
                                }
                            } catch (innerErr) {
                                console.warn('[dtg-ai] delete item', oi.PK_ID, 'failed:', innerErr.message);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[dtg-ai] item-cleanup pass failed (continuing):', e.message);
                }
            } else {
                // CREATE — original flow
                const sessionRes = await fetch(API_BASE_URL + '/api/quote_sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sessionPayload),
                });
                if (!sessionRes.ok) {
                    const t = await sessionRes.text();
                    throw new Error('quote_sessions POST ' + sessionRes.status + ': ' + t.slice(0, 200));
                }
            }

            const items = lineItems.map((it, idx) => ({
                QuoteID: effectiveQuoteID,
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
            // [2026-06-09] Phase 2 — append a SHIP fee line item so /quote + /invoice show + foot
            // shipping (mirror DTF/SCP _saveShipFeeItem). getShippingFee() reads EmbellishmentType
            // 'fee' & StyleNumber 'SHIP'; TotalAmount EXCLUDES shipping and tax is on the shipping-
            // inclusive base, so the reader's (subtotalNet + SHIP + tax) foots with no double-count.
            // Posted in BOTH paths (edit deletes old items first, so no dup). edit-reload ignores it
            // — loadSavedDtgQuoteForEdit rebuilds rows on EmbellishmentType==='dtg' only.
            if (shippingFee > 0) {
                items.push({
                    QuoteID: effectiveQuoteID,
                    LineNumber: items.length + 1,
                    StyleNumber: 'SHIP',
                    ProductName: 'Shipping',
                    Color: '',
                    EmbellishmentType: 'fee',
                    Quantity: 1,
                    BaseUnitPrice: shippingFee,
                    FinalUnitPrice: shippingFee,
                    LineTotal: shippingFee,
                    AddedAt: new Date().toISOString(),
                });
            }
            for (const it of items) {
                const r = await fetch(API_BASE_URL + '/api/quote_items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(it),
                });
                if (!r.ok) console.warn('[dtg-ai] quote_items POST failed:', r.status);
            }
            aiState.savedQuoteID = effectiveQuoteID;
            // Bump in-memory edit revision so consecutive saves keep
            // incrementing (Rev 2 → 3 → 4) without page reload.
            if (isEditMode) window._dtgEditingRevision = newRevision;
            updateContextPill(isEditMode ? `saved Rev ${newRevision} ✓` : 'saved ✓');
            updateActionsAvailability();
            showToast(isEditMode
                ? `Saved ${effectiveQuoteID} as Rev ${newRevision}`
                : `Saved ${effectiveQuoteID} — click again for share link`);
        } catch (err) {
            console.error('[dtg-ai] save failed:', err);
            showToast('Save failed — check console');
            const btn = document.getElementById('aiSaveQuoteBtn');
            if (btn) btn.disabled = false;
        } finally {
            _dtgSaveInFlight = false;
        }
    }

    // [2026-06-08] Phase 1 Chunk C — expose the save handler so the inline form's
    // "Save & Get Link" button (dtg-inline-form.js #dtgSaveBtn) can trigger it. The
    // file is an IIFE, so the form reaches handleSaveQuote only through window.
    // Manual quotes were previously unsaveable (the chat-panel Save button is hidden
    // without an AI quote); handleSaveQuote now reads the form via getSaveQuote().
    window.dtgSaveQuote = handleSaveQuote;

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

    // ========================================================================
    // Phase 11.7 (Erik 2026-05-24) — power-header "+ New Quote" button handler
    //
    // Wired from the unified power-header in dtg-quote-builder.html. Confirms
    // unsaved work via the inline form's dirty flag, then resets the form +
    // clears edit-mode + saved-quote-ID context so the next save creates a
    // fresh DTG-NNN (not a revision of whatever was just open).
    //
    // Exposed on window so the inline `onclick` attribute in the HTML can
    // reach it (file uses an IIFE so other helpers stay private).
    // ========================================================================
    window.dtgConfirmNewQuote = function dtgConfirmNewQuote() {
        try {
            const form = window.DTGInlineForm;
            const dirty = form && typeof form.isDirty === 'function' && form.isDirty();
            if (dirty) {
                if (!confirm('You have unsaved changes. Start a new quote? (Resets the form.)')) {
                    return;
                }
            }
            if (form && typeof form.resetForm === 'function') {
                form.resetForm();
                // Clear edit-mode context so next save creates a new quote ID
                // (not a revision of whatever we just reset away from).
                try {
                    delete window._dtgEditingQuoteId;
                    delete window._dtgEditingPK_ID;
                    delete window._dtgEditingRevision;
                } catch (_) { /* swallow */ }
                // Also drop the saved quote ID from chat-panel state so the
                // Email Quote button correctly requires a fresh save first.
                if (window.aiState) window.aiState.savedQuoteID = null;
                showToast('New quote — form cleared');
            } else {
                // Last-resort fallback if inline form hasn't loaded yet
                location.reload();
            }
        } catch (e) {
            console.error('[DTG] New Quote handler failed:', e);
            if (confirm('Reset failed. Reload the page to start fresh?')) {
                location.reload();
            }
        }
    };
})();
