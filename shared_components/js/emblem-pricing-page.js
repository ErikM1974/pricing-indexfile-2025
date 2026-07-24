/**
 * emblem-pricing-page.js
 *
 * Page logic for /calculators/embroidered-emblem/index.html:
 *   1. Fetch /api/emblem-pricing on load, render the 16-size × 10-qty grid.
 *   2. AI chat panel — open/close, SSE streaming chat with Claude via
 *      /api/contract-emblem-ai/chat.
 *   3. Parse PRICE_QUOTE blocks from the AI stream → highlight matching
 *      pricing-grid cell on the page + render inline emblem-quote card.
 *   4. Parse CUSTOMER_FINAL + EMAIL DRAFT blocks → render email-draft card,
 *      enable Copy email / Open in Outlook / Save quote actions.
 *   5. Save quote → POST quote_sessions + quote_items with PATCH prefix.
 *
 * Mirrors the pattern of sticker-pricing-page.js exactly — only emblem-
 * specific bits (grid render, quote card, tool name) differ.
 */

(function () {
    'use strict';

    // -----------------------------------------------------------------
    // Config
    // -----------------------------------------------------------------
    // NOTE: these standalone calculator pages don't load a shared script that
    // defines window.APP_CONFIG.API.BASE_URL, so we use the documented hardcoded
    // fallback (same pattern as sticker-pricing-page.js). True Rule #6 compliance
    // is a codebase-wide change — define a shared APP_CONFIG and load it on every
    // calculator page — tracked separately.
    const API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const AI_ENDPOINT = API_BASE_URL + '/api/contract-emblem-ai/chat';
    const QUOTE_PREFIX = 'PATCH';

    // -----------------------------------------------------------------
    // State
    // -----------------------------------------------------------------
    let pricingData = null;         // { grid, rules, qtyTiers, source }
    const aiState = {
        opened: false,
        greeted: false,             // static greeting shown? (gates the no-API greeting)
        messages: [],               // [{role, content}, ...]
        isStreaming: false,
        currentPriceQuote: null,    // last parsed PRICE_QUOTE block
        currentCustomerFinal: null, // last parsed CUSTOMER_FINAL block
        currentEmailDraft: null,    // {to, subject, body}
        quoteID: null,
        quoteIDPromise: null,
        savedQuoteID: null,         // populated after save → enables copy-link
        sessionSaved: false,        // quote_sessions row written? (retry-safe)
        savedItemLines: [],         // LineNumbers already persisted (retry-safe)
        lastOpener: null,           // element to return focus to on close (a11y)
    };

    // -----------------------------------------------------------------
    // Boot
    // -----------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        wireChatPanel();
        wireHeroArt();
        showFloatingButton();
        await loadAndRenderPricing();
        // Auto-open the panel shortly after load. The greeting is rendered
        // CLIENT-SIDE (no Claude call) — the first real rep message is what
        // hits the backend. Pricing-grid load state does NOT gate this: the
        // chat prices server-side, so it opens even if the grid fetch failed.
        setTimeout(() => {
            if (!aiState.opened) openChatPanel();
        }, 600);
    }

    function wireHeroArt() {
        const heroArt = document.getElementById('emblemHeroArt');
        if (heroArt) {
            heroArt.addEventListener('error', function () { this.style.display = 'none'; });
        }
    }

    // -----------------------------------------------------------------
    // Utilities
    // -----------------------------------------------------------------
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

    // -----------------------------------------------------------------
    // Pricing grid: fetch + render
    // -----------------------------------------------------------------
    async function loadAndRenderPricing() {
        const wrap = document.getElementById('emblemGridWrap');
        const errorEl = document.getElementById('pricingError');
        try {
            const r = await fetch(API_BASE_URL + '/api/emblem-pricing');
            if (!r.ok) throw new Error('API returned ' + r.status);
            const data = await r.json();
            if (!data.grid || typeof data.grid !== 'object'
                || !Array.isArray(data.qtyTiers) || data.qtyTiers.length === 0) {
                throw new Error('empty pricing grid');
            }
            pricingData = data;
            renderPricingGrid(wrap, data);
            errorEl.hidden = true;
        } catch (err) {
            console.error('[emblem-page] pricing load failed:', err);
            errorEl.hidden = false;
            wrap.innerHTML = '';
        }
    }

    function renderPricingGrid(container, data) {
        const sizeKeys = Object.keys(data.grid)
            .map(k => ({ key: k, num: parseFloat(k) }))
            .sort((a, b) => a.num - b.num);
        const qtyTiers = data.qtyTiers;

        const thead = `<thead><tr>
            <th class="size-col-head">Size (avg)</th>
            ${qtyTiers.map(q => `<th>${fmtInt(q)}+</th>`).join('')}
        </tr></thead>`;

        const tbody = '<tbody>' + sizeKeys.map(({ key, num }) => {
            const row = data.grid[key];
            const tds = qtyTiers.map((q, idx) => {
                const price = Number(row[idx]) || 0;
                const pn = `EMB-${key}-${q}`;
                return `<td class="qty-cell"
                            data-pn="${escapeHtml(pn)}"
                            data-size="${escapeHtml(key)}"
                            data-qty="${q}">$${fmtMoney(price)}</td>`;
            }).join('');
            return `<tr data-size="${escapeHtml(key)}">
                <td class="size-label">${num.toFixed(2)}"</td>
                ${tds}
            </tr>`;
        }).join('') + '</tbody>';

        container.innerHTML = `<table class="emblem-pricing-table">${thead}${tbody}</table>`;
    }

    /**
     * Highlight the matching grid cell given a PartNumber (EMB-{size}-{qty}).
     * Clears prior highlights, adds .ai-highlighted to the new cell, scrolls
     * it into view. Idempotent.
     */
    function highlightCellByPartNumber(partNumber) {
        if (!partNumber) return;
        document.querySelectorAll('td.ai-highlighted').forEach(td => {
            td.classList.remove('ai-highlighted');
        });
        const td = document.querySelector(`td[data-pn="${CSS.escape(partNumber)}"]`);
        if (!td) return;
        td.classList.add('ai-highlighted');
        td.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // -----------------------------------------------------------------
    // AI Chat panel — wiring, open/close, reset
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

        // Remember what to return focus to on close (skip body / auto-open).
        const active = document.activeElement;
        aiState.lastOpener = (active && active !== document.body && typeof active.focus === 'function')
            ? active
            : document.getElementById('aiOpenBtn');

        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
        backdrop.classList.add('open');
        backdrop.setAttribute('aria-hidden', 'false');
        setBackgroundInert(true);
        aiState.opened = true;
        hideFloatingButton();
        const hint = document.getElementById('autoOpenHint');
        if (hint) hint.style.opacity = '0';

        // First open → static greeting, NO backend call. The first real rep
        // message is what spends a Claude call (and a PATCH sequence number).
        if (!aiState.greeted) {
            renderStaticGreeting();
            aiState.greeted = true;
        }

        setTimeout(() => {
            const ta = document.getElementById('aiChatTextarea');
            if (ta) ta.focus();
        }, 320);
    }

    function renderStaticGreeting() {
        appendChatBubble('assistant',
            'Hi! Ready to draft an emblem patch quote. Tell me the size and quantity to '
            + 'start — or paste the whole spec at once (size, qty, backing, colors, art '
            + 'status, customer) and I will quote it in one shot.');
        updateContextPill('Ready when you are.');
        announce('Assistant ready. Tell me the emblem size and quantity to start, or paste the full spec.');
    }

    function announce(text) {
        const statusEl = document.getElementById('aiChatStatus');
        if (statusEl) statusEl.textContent = text || '';
    }

    // Make the page behind the chat drawer non-interactive while it is open,
    // so keyboard focus stays trapped in the dialog (native `inert` also
    // implies aria-hidden for assistive tech).
    function setBackgroundInert(on) {
        ['.header', '.main-container'].forEach(function (sel) {
            const el = document.querySelector(sel);
            if (!el) return;
            if (on) el.setAttribute('inert', '');
            else el.removeAttribute('inert');
        });
    }

    function closeChatPanel() {
        const panel = document.getElementById('aiChatPanel');
        const backdrop = document.getElementById('aiChatBackdrop');
        if (!panel) return;
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
        backdrop.classList.remove('open');
        backdrop.setAttribute('aria-hidden', 'true');
        setBackgroundInert(false);
        aiState.opened = false;
        showFloatingButton();
        // Return focus to whatever opened the panel (a11y). Background inert is
        // cleared above, so the opener is focusable again.
        const opener = aiState.lastOpener;
        if (opener && typeof opener.focus === 'function') {
            try { opener.focus(); } catch (_) { /* element gone */ }
        }
    }

    function showFloatingButton() {
        const btn = document.getElementById('floatingQuoteBtn');
        if (btn) btn.hidden = false;
    }
    function hideFloatingButton() {
        const btn = document.getElementById('floatingQuoteBtn');
        if (btn) btn.hidden = true;
    }

    function resetChat() {
        if (aiState.isStreaming) {
            showToast('Wait for the current reply to finish first');
            return;
        }
        const messagesEl = document.getElementById('aiChatMessages');
        if (messagesEl) messagesEl.innerHTML = '';
        const actionsEl = document.getElementById('aiChatActions');
        if (actionsEl) actionsEl.hidden = true;

        document.querySelectorAll('td.ai-highlighted').forEach(td => td.classList.remove('ai-highlighted'));

        aiState.messages = [];
        aiState.currentPriceQuote = null;
        aiState.currentCustomerFinal = null;
        aiState.currentEmailDraft = null;
        aiState.quoteID = null;
        aiState.quoteIDPromise = null;
        aiState.savedQuoteID = null;
        aiState.sessionSaved = false;
        aiState.savedItemLines = [];
        aiState.isStreaming = false;
        aiState.greeted = false;

        // Static greeting — no Claude call until the rep types their first message.
        renderStaticGreeting();
        aiState.greeted = true;
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
                console.warn('[emblem-ai] ensureQuoteID failed:', err.message);
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
        chip.className = 'tool-chip' + (toolName === 'quote_emblem_price' ? ' emblem-tool' : '');
        const iconClass = toolName === 'lookup_customer' ? 'fa-search' : 'fa-thread';
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
        try { return JSON.parse(stripCodeFences(raw)); }
        catch (err) { console.warn('[emblem-ai] PRICE_QUOTE parse failed:', err.message); return null; }
    }

    function parseCustomerFinal(text) {
        const raw = extractBlock(text, 'CUSTOMER_FINAL START', 'CUSTOMER_FINAL END');
        if (!raw) return null;
        try { return JSON.parse(stripCodeFences(raw)); }
        catch (err) { console.warn('[emblem-ai] CUSTOMER_FINAL parse failed:', err.message); return null; }
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
    // Render finalized assistant reply
    // -----------------------------------------------------------------
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
            const items = Array.isArray(priceQuote.lineItems) ? priceQuote.lineItems : [];
            renderEmblemQuoteCard(bubbleEl, priceQuote);
            items.forEach(it => highlightCellByPartNumber(it.partNumber));
        }
        if (customerFinal) aiState.currentCustomerFinal = customerFinal;
        if (emailDraft) {
            aiState.currentEmailDraft = emailDraft;
            renderEmailDraftCard(bubbleEl, emailDraft);
        }
        updateActionsAvailability();
        announce(priceQuote ? 'Quote drafted. ' + (preamble || '') : (preamble || 'Reply ready.'));
    }

    function renderEmblemQuoteCard(bubbleEl, priceQuote) {
        const msgEl = bubbleEl.closest('.chat-message');
        if (!msgEl) return;
        const items = Array.isArray(priceQuote.lineItems) ? priceQuote.lineItems : [];
        const item = items[0] || {};
        const dig = priceQuote.digitizingFee || {};
        const includeDig = dig.include !== false;
        const digAmount = includeDig ? (Number(dig.amount) || 0) : 0;
        const subtotal = items.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);
        const orderTotal = subtotal + digAmount;

        const ltm = item.ltm || {};
        const mods = item.modifiers || {};

        const card = document.createElement('div');
        card.className = 'emblem-quote-card';

        const modBits = [];
        if (mods.metallicThread) modBits.push('metallic');
        if (mods.velcroBacking) modBits.push('velcro');
        if (mods.extraColors > 0) modBits.push(`+${mods.extraColors} colors`);
        const modSummary = modBits.length ? `(${modBits.join(' · ')})` : '';

        const digLine = includeDig
            ? `<div class="eqc-line">
                 <span>Digitizing fee (${escapeHtml(dig.partNumber || 'DIG-100')})</span>
                 <span class="v">$${fmtMoney(digAmount)}</span>
               </div>`
            : '';
        const ltmNote = ltm.applies
            ? `<div class="eqc-note">LTM fee $${fmtMoney(ltm.perPatchAmount)}/patch built in (qty < ${ltm.threshold || 200}).</div>`
            : '';
        const sizeNote = priceQuote.appliedRules && priceQuote.appliedRules.sizeTier
            ? `<div class="eqc-note">${escapeHtml(priceQuote.appliedRules.sizeTier)}</div>` : '';
        const qtyNote = priceQuote.appliedRules && priceQuote.appliedRules.quantityTier
            ? `<div class="eqc-note">${escapeHtml(priceQuote.appliedRules.quantityTier)}</div>` : '';
        const rushNote = priceQuote.appliedRules && priceQuote.appliedRules.rush
            ? `<div class="eqc-note">${escapeHtml(priceQuote.appliedRules.rush)}</div>` : '';

        card.innerHTML = `
            <div class="eqc-label">Live emblem quote</div>
            <div class="eqc-pn">${escapeHtml(item.partNumber || 'EMB-CUSTOM')}</div>
            <div class="eqc-spec">${escapeHtml(item.description || 'Embroidered emblem patch')} ${escapeHtml(modSummary)}</div>
            <div class="eqc-line">
                <span>${fmtInt(Number(item.quantity) || 0)} patches @ $${fmtMoney(Number(item.pricePerPatch) || 0)} each</span>
                <span class="v">$${fmtMoney(Number(item.totalPrice) || 0)}</span>
            </div>
            ${digLine}
            <div class="eqc-line total">
                <span>Order total</span>
                <span class="v">$${fmtMoney(orderTotal)}</span>
            </div>
            ${sizeNote}
            ${qtyNote}
            ${rushNote}
            ${ltmNote}
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
        const hasCustomer = !!aiState.currentCustomerFinal;
        actions.hidden = !(hasDraft || hasQuote);

        const draftHint = 'Finish the quote to draft the email first';
        if (outlookBtn) {
            outlookBtn.disabled = !hasDraft;
            outlookBtn.title = hasDraft ? '' : draftHint;
        }
        if (copyBtn) {
            copyBtn.disabled = !hasDraft;
            copyBtn.title = hasDraft ? '' : draftHint;
        }
        if (saveBtn) {
            if (aiState.savedQuoteID) {
                saveBtn.innerHTML = '<i class="fas fa-link"></i> Copy share link';
                saveBtn.disabled = false;
                saveBtn.title = 'Copy the shareable /quote link';
            } else {
                saveBtn.innerHTML = '<i class="fas fa-link"></i> Save &amp; share link';
                const ready = hasDraft && hasQuote && hasCustomer;
                saveBtn.disabled = !ready;
                saveBtn.title = ready ? ''
                    : !hasQuote ? 'Get a price first'
                    : !hasCustomer ? 'Confirm the customer details in chat to enable saving'
                    : 'Draft the email to enable saving';
            }
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
            console.error('[emblem-ai] error:', err);
            removeTypingIndicator(typingEl);
            appendChatBubble(
                'assistant',
                "Hmm, I couldn't reach the AI right now. Please try again in a moment.",
                { error: true }
            );
            announce("Couldn't reach the AI. Please try again.");
        } finally {
            aiState.isStreaming = false;
            const btn = document.getElementById('aiChatSend');
            if (btn) btn.disabled = false;
            const ta = document.getElementById('aiChatTextarea');
            if (ta) ta.focus();
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
            const status = matches.length === 0
                ? 'No customer match — drafting generic'
                : (matches.length === 1
                    ? `Found ${matches[0].company || matches[0].contact_name || 'match'}`
                    : `${matches.length} matches — narrowing…`);
            appendToolChip(tool, status);
        } else if (tool === 'quote_emblem_price') {
            if (result.offGrid) {
                appendToolChip(tool, `Off-grid: ${result.reason} — escalating to manual quote`);
            } else if (result.partNumber) {
                appendToolChip(tool,
                    `${result.partNumber}: $${fmtMoney(result.totalPrice)} (${fmtInt(result.quantity)} @ $${fmtMoney(result.pricePerPatch)}/patch)`
                );
                highlightCellByPartNumber(result.partNumber);
                // Rule #4 — if Caspio was unreachable and the backend priced from
                // its inline fallback grid, the price may be stale. Surface it.
                if (result.pricingSource === 'inline') showInlinePricingWarning();
            }
        }
    }

    // -----------------------------------------------------------------
    // Outlook / Copy / Save actions
    // -----------------------------------------------------------------
    function buildMailto(draft) {
        const BODY_CAP = 1800;
        let body = draft.body || '';
        if (aiState.savedQuoteID) {
            const shareUrl = `${location.origin}/quote/${encodeURIComponent(aiState.savedQuoteID)}`;
            body += `\n\nView quote online: ${shareUrl}`;
        }
        if (body.length > BODY_CAP) {
            body = body.slice(0, BODY_CAP);
            console.warn('[emblem-ai] mailto body capped at ' + BODY_CAP + ' chars.');
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
            console.error('[emblem-ai] mailto open failed:', err);
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
            console.warn('[emblem-ai] clipboard failed:', err);
            showToast('Copy failed — check console');
        });
    }

    async function handleSaveQuote() {
        // Second click after save → copy the share link.
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
            const subtotal = lineItems.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);
            const includeDig = priceQuote.digitizingFee && priceQuote.digitizingFee.include !== false;
            // Use the tool's amount as-is (nullish check, NOT ||, so a legitimate
            // $0 / waived-but-itemized fee isn't silently forced back to $100).
            const digRaw = priceQuote.digitizingFee ? priceQuote.digitizingFee.amount : null;
            const digFee = includeDig ? (digRaw != null ? Number(digRaw) : 100) : 0;
            const taxable = customer.taxable === true;
            // Persist the PRE-TAX total the rep saw on the quote card and emailed.
            // Emblem quote emails show no tax figure; WA sales tax is applied
            // downstream at invoice time (ManageOrders/ShopWorks push TaxTotal:0 and
            // OnSite computes tax). We never bake a hardcoded rate into the saved
            // quote — the taxable flag is persisted for the invoice stage instead.
            const total = subtotal + digFee;

            // LTM total — captured for the LTMFeeTotal field on quote_sessions.
            // The AI tool returns ltm.perPatchAmount per line item; sum across.
            let ltmTotal = 0;
            for (const it of lineItems) {
                const ltm = it.ltm;
                if (ltm && ltm.applies && Number(it.quantity) > 0) {
                    ltmTotal += (Number(ltm.perPatchAmount) || 0) * Number(it.quantity);
                }
            }
            ltmTotal = Math.round(ltmTotal * 100) / 100;

            const sessionPayload = {
                QuoteID: quoteID,
                SessionID: `emblem_${Date.now()}`,
                Status: 'Open',
                CustomerEmail: customer.email || '',
                CustomerName: customer.name || '',
                CompanyName: customer.company || '',
                Phone: customer.phone || '',
                TotalQuantity: lineItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
                SubtotalAmount: subtotal,
                LTMFeeTotal: ltmTotal,
                TotalAmount: total,
                Notes: JSON.stringify({
                    digitizing_fee: digFee,
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

            const items = lineItems.map((it, idx) => {
                const unitPrice = Number(it.pricePerPatch) || 0;
                const ltm = it.ltm || {};
                const mods = it.modifiers || {};
                return {
                    QuoteID: quoteID,
                    LineNumber: idx + 1,
                    StyleNumber: it.partNumber,
                    ProductName: it.description || `${it.size || ''}" embroidered emblem patch`.trim(),
                    Color: '',
                    ColorCode: '',
                    EmbellishmentType: 'emblem',
                    PrintLocation: '',
                    PrintLocationName: it.size ? `${it.size}"` : '',
                    Quantity: Number(it.quantity) || 0,
                    HasLTM: ltm.applies ? 'Yes' : 'No',
                    BaseUnitPrice: Number(it.basePrice) || 0,
                    LTMPerUnit: Number(ltm.perPatchAmount) || 0,
                    FinalUnitPrice: unitPrice,
                    LineTotal: Number(it.totalPrice) || 0,
                    SizeBreakdown: JSON.stringify({
                        size: it.size,
                        shape: it.shape || 'square',
                        modifiers: mods,
                    }),
                    PricingTier: it.size ? `${it.size}" @ ${it.quantity}+` : 'Standard',
                    ImageURL: '',
                    AddedAt: new Date().toISOString(),
                };
            });
            if (includeDig) {
                items.push({
                    QuoteID: quoteID,
                    LineNumber: items.length + 1,
                    StyleNumber: 'DIG-100',
                    ProductName: 'Digitizing Fee (one-time)',
                    // 'fee', not 'setup-fee' — see the matching note in
                    // sticker-pricing-page.js. quote-view.js:819 filters on 'fee';
                    // these two files are written to mirror each other, so fixing
                    // only one would fork them.
                    EmbellishmentType: 'fee',
                    Quantity: 1,
                    BaseUnitPrice: digFee,
                    FinalUnitPrice: digFee,
                    LineTotal: digFee,
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

            // Rule #4 — never report success on a partial write. The saved
            // /quote/:id is the customer-facing deliverable; a missing line item
            // (or the DIG-100 fee) would show a wrong total. Do NOT issue the
            // share link unless every line item persisted. Failed lines are
            // retried on the next click (succeeded ones are skipped above).
            if (failures.length) {
                console.error('[emblem-ai] quote_items failures:', failures);
                throw new Error(`${failures.length} of ${items.length} line item(s) failed to save — do NOT send the link. Click Save to retry.`);
            }

            aiState.savedQuoteID = quoteID;
            updateContextPill('saved ✓');
            updateActionsAvailability();
            announce(`Quote ${quoteID} saved. Click again to copy the share link.`);
            showToast(`Saved ${quoteID} — click again for share link`);
        } catch (err) {
            console.error('[emblem-ai] save failed:', err);
            showToast(err && err.message ? `Save failed — ${err.message}` : 'Save failed — check console');
            const btn = document.getElementById('aiSaveQuoteBtn');
            if (btn) btn.disabled = false;
        }
    }

    // Visible warning when the backend priced from its inline fallback grid
    // (Caspio unreachable). Reuses the pricing-error banner so the rep can't
    // miss it. Wrong/stale pricing is worse than an error (CLAUDE.md Rule 4).
    function showInlinePricingWarning() {
        const errorEl = document.getElementById('pricingError');
        if (errorEl) {
            errorEl.innerHTML = '<strong>Heads up:</strong> live pricing was unavailable, so this quote used fallback prices. Double-check before sending, and refresh to retry live pricing.';
            errorEl.hidden = false;
        }
        announce('Warning: this quote used fallback pricing. Verify before sending.');
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
