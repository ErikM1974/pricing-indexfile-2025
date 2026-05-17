/**
 * webstore-pricing-page.js
 *
 * Page logic for /calculators/webstores.html:
 *   1. AI chat panel — open/close, SSE streaming chat with Claude via
 *      /api/contract-webstore-ai/chat.
 *   2. Parse PRICE_QUOTE blocks (TWO product types: webstore-setup +
 *      fundraiser-item) → render different inline quote cards.
 *   3. Parse CUSTOMER_FINAL + EMAIL DRAFT blocks → render email-draft
 *      card, enable Copy email / Open in Outlook / Save quote actions.
 *   4. Render `web_search` tool results inline with source links.
 *   5. Save quote → POST quote_sessions + quote_items with WEB prefix.
 *
 * Mirrors sticker-pricing-page.js but with two distinct quote-card
 * renderers + web-search result rendering.
 */

(function () {
    'use strict';

    // -----------------------------------------------------------------
    // Config
    // -----------------------------------------------------------------
    const API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const AI_ENDPOINT = API_BASE_URL + '/api/contract-webstore-ai/chat';
    const QUOTE_PREFIX = 'WEB';

    // -----------------------------------------------------------------
    // State
    // -----------------------------------------------------------------
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
    };

    // -----------------------------------------------------------------
    // Boot
    // -----------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        wireChatPanel();
        showFloatingButton();
        // Auto-open the chat shortly after load — same UX as sticker/emblem.
        setTimeout(() => {
            if (!aiState.opened) openChatPanel();
        }, 600);
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
    function domainOf(url) {
        try { return new URL(url).hostname.replace(/^www\./, ''); }
        catch { return ''; }
    }

    // -----------------------------------------------------------------
    // Chat panel wiring
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
                content: "(Open the chat — greet the rep briefly and ask whether they're drafting a store-setup quote or pricing a fundraiser item.)",
            });
            updateContextPill('Drafting quote… ready when you are.');
            sendChatMessage();
        }

        setTimeout(() => {
            const ta = document.getElementById('aiChatTextarea');
            if (ta) ta.focus();
        }, 320);
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

    function resetChat() {
        if (aiState.isStreaming) {
            showToast('Wait for the current reply to finish first');
            return;
        }
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

        aiState.messages.push({
            role: 'user',
            content: "(Open the chat — greet the rep briefly and ask whether they're drafting a store-setup quote or pricing a fundraiser item.)",
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

    // -----------------------------------------------------------------
    // Quote ID
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
                console.warn('[webstore-ai] ensureQuoteID failed:', err.message);
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
        else if (toolName === 'quote_webstore_setup') iconClass = 'fa-store';
        else if (toolName === 'quote_fundraiser_pricing') iconClass = 'fa-hand-holding-dollar';
        chip.innerHTML = `<i class="fas ${iconClass}"></i> ${escapeHtml(statusText)}`;
        msg.appendChild(chip);
        if (opts.searchResults) {
            msg.appendChild(buildWebSearchResultsEl(opts.searchResults));
        }
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }

    function buildWebSearchResultsEl(data) {
        const wrap = document.createElement('div');
        wrap.className = 'web-search-results';
        let html = `<div class="wsr-query">Searched: "${escapeHtml(data.query_used || '')}"</div>`;
        if (data.answer) {
            html += `<div class="wsr-answer"><b>Synthesized:</b> ${escapeHtml(data.answer)}</div>`;
        }
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

    // -----------------------------------------------------------------
    // Block parsing
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
        catch (err) { console.warn('[webstore-ai] PRICE_QUOTE parse failed:', err.message); return null; }
    }
    function parseCustomerFinal(text) {
        const raw = extractBlock(text, 'CUSTOMER_FINAL START', 'CUSTOMER_FINAL END');
        if (!raw) return null;
        try { return JSON.parse(stripCodeFences(raw)); }
        catch (err) { console.warn('[webstore-ai] CUSTOMER_FINAL parse failed:', err.message); return null; }
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
            if (priceQuote.productType === 'webstore-setup') {
                renderWebstoreQuoteCard(bubbleEl, priceQuote);
            } else if (priceQuote.productType === 'fundraiser-item') {
                renderFundraiserQuoteCard(bubbleEl, priceQuote);
            }
        }
        if (customerFinal) aiState.currentCustomerFinal = customerFinal;
        if (emailDraft) {
            aiState.currentEmailDraft = emailDraft;
            renderEmailDraftCard(bubbleEl, emailDraft);
        }
        updateActionsAvailability();
    }

    // -----------------------------------------------------------------
    // Card renderers (TWO product modes)
    // -----------------------------------------------------------------
    function renderWebstoreQuoteCard(bubbleEl, priceQuote) {
        const msgEl = bubbleEl.closest('.chat-message');
        if (!msgEl) return;
        const items = Array.isArray(priceQuote.lineItems) ? priceQuote.lineItems : [];
        const cfg = priceQuote.storeConfig || {};
        const total = items.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);

        const card = document.createElement('div');
        card.className = 'webstore-quote-card';

        const linesHtml = items.map(it => `
            <div class="wsq-line">
                <span>${escapeHtml(it.description || it.partNumber)}</span>
                <span class="v">$${fmtMoney(Number(it.totalPrice) || 0)}</span>
            </div>`).join('');

        const storeTypeClass = cfg.storeType === 'Open/Close' ? 'open-close' : '';
        const surchargeText = cfg.surchargePerItem
            ? `$${fmtMoney(Number(cfg.surchargePerItem))} per item sold (built into supporter checkout)`
            : '';
        const volumeText = cfg.expectedAnnualVolume
            ? `~${fmtInt(Number(cfg.expectedAnnualVolume))} items/year expected · est annual surcharge $${fmtMoney(Number(cfg.expectedAnnualVolume) * Number(cfg.surchargePerItem || 0))}`
            : '';
        const minText = cfg.minimumAnnualGuarantee
            ? `$${fmtMoney(Number(cfg.minimumAnnualGuarantee))}/year annual sales minimum`
            : '';
        const warnNote = priceQuote.appliedRules && priceQuote.appliedRules.minimumRisk
            ? `<div class="wsq-warn"><b>Heads up:</b> ${escapeHtml(priceQuote.appliedRules.minimumRisk)}</div>` : '';

        card.innerHTML = `
            <div class="wsq-label">Live store quote</div>
            <div class="wsq-pn">${escapeHtml(priceQuote.partNumber || 'WEB-SETUP')}</div>
            ${cfg.storeType ? `<div class="wsq-store-type ${storeTypeClass}">${escapeHtml(cfg.storeType)}</div>` : ''}
            ${linesHtml}
            <div class="wsq-line total">
                <span>Total setup</span>
                <span class="v">$${fmtMoney(total)}</span>
            </div>
            ${(surchargeText || volumeText || minText) ? `
                <div class="wsq-meta">
                    ${surchargeText ? `<div><strong>Per-item:</strong> ${escapeHtml(surchargeText)}</div>` : ''}
                    ${volumeText ? `<div><strong>Volume:</strong> ${escapeHtml(volumeText)}</div>` : ''}
                    ${minText ? `<div><strong>Minimum:</strong> ${escapeHtml(minText)}</div>` : ''}
                </div>` : ''}
            ${warnNote}
        `;
        msgEl.appendChild(card);
        scrollChatBottom();
    }

    function renderFundraiserQuoteCard(bubbleEl, priceQuote) {
        const msgEl = bubbleEl.closest('.chat-message');
        if (!msgEl) return;
        const pricing = priceQuote.pricing || {};
        const breakdown = priceQuote.breakdown || {};
        const rules = priceQuote.appliedRules || {};

        const card = document.createElement('div');
        card.className = 'fundraiser-quote-card';

        const taxWarn = rules.taxThreshold
            ? `<div class="fqc-tax-warn"><strong>1099-NEC required:</strong> ${escapeHtml(rules.taxThreshold)}</div>`
            : '';

        card.innerHTML = `
            <div class="fqc-label">Fundraiser sell price</div>
            <div class="fqc-price">$${fmtMoney(Number(pricing.sellPrice) || 0)}</div>
            <div class="fqc-spec">Per-item sell price for supporters at checkout</div>

            <div class="fqc-line"><span>Blank with margin (${fmtInt((Number(pricing.margin) || 0) * 100)}%)</span><span class="v">$${fmtMoney(Number(breakdown.blankWithMargin) || 0)}</span></div>
            <div class="fqc-line"><span>+ Embellishment fee</span><span class="v">$${fmtMoney(Number(breakdown.embellishmentFee) || 0)}</span></div>
            <div class="fqc-line"><span>+ Donation built-in</span><span class="v">$${fmtMoney(Number(breakdown.donationBuiltIn) || 0)}</span></div>
            <div class="fqc-line"><span>+ CC fee recovery (${fmtInt((Number(pricing.ccFee) || 0) * 1000) / 10}%)</span><span class="v">$${fmtMoney(Number(breakdown.ccFeeRecovery) || 0)}</span></div>
            <div class="fqc-line"><span>+ Rounded up to nearest $5</span><span class="v">+$${fmtMoney(Number(breakdown.roundedUpCushion) || 0)}</span></div>
            <div class="fqc-line total"><span>= Customer pays</span><span class="v">$${fmtMoney(Number(pricing.sellPrice) || 0)}</span></div>

            <div class="fqc-donation-banner">
                $${fmtMoney(Number(pricing.donation) || 0)} per item back to the program
                ${pricing.estimatedAnnualVolume ? `· est $${fmtMoney(Number(pricing.estimatedAnnualDonation) || 0)}/year` : ''}
            </div>
            ${taxWarn}
        `;
        msgEl.appendChild(card);
        scrollChatBottom();
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
            console.error('[webstore-ai] error:', err);
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
        } else if (tool === 'quote_webstore_setup') {
            if (result.error) {
                appendToolChip(tool, `Error: ${result.error}`);
            } else {
                appendToolChip(tool,
                    `${result.storeType} store: $${fmtMoney(result.totalSetup)} setup ($${fmtMoney(result.surchargePerItem)}/item ongoing)`
                );
            }
        } else if (tool === 'quote_fundraiser_pricing') {
            if (result.error) {
                appendToolChip(tool, `Error: ${result.error}`);
            } else {
                const p = result.pricing || {};
                appendToolChip(tool,
                    `Sell $${fmtMoney(p.sellPrice)} (blank $${fmtMoney(p.blankCost)} + $${fmtMoney(p.donation)} donation)`
                );
            }
        } else if (tool === 'web_search') {
            if (result.error) {
                appendToolChip(tool, `Web search: ${result.error === 'web_search_unavailable' ? 'offline (TAVILY_API_KEY not set)' : result.message || result.error}`);
            } else {
                const n = Array.isArray(result.results) ? result.results.length : 0;
                appendToolChip(tool, `Searched the web — ${n} result${n === 1 ? '' : 's'}`, { searchResults: result });
            }
        }
    }

    // -----------------------------------------------------------------
    // Outlook / Copy / Save
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
            console.warn('[webstore-ai] mailto body capped at ' + BODY_CAP + ' chars.');
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
            console.error('[webstore-ai] mailto open failed:', err);
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
            console.warn('[webstore-ai] clipboard failed:', err);
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

            if (!priceQuote) throw new Error('No price quote to save');

            const quoteID = aiState.quoteID || await ensureQuoteID();
            if (!quoteID) throw new Error('Failed to get quote ID');

            const isFundraiser = priceQuote.productType === 'fundraiser-item';
            const lineItems = Array.isArray(priceQuote.lineItems) ? priceQuote.lineItems : [];
            let subtotal = 0;
            let totalQuantity = 0;
            if (isFundraiser) {
                // Fundraiser is per-item pricing — treat as 1 unit at sell price for save
                const p = priceQuote.pricing || {};
                subtotal = Number(p.sellPrice) || 0;
                totalQuantity = 1;
            } else {
                subtotal = lineItems.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);
                totalQuantity = lineItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
            }

            const sessionPayload = {
                QuoteID: quoteID,
                SessionID: `webstore_${Date.now()}`,
                Status: 'Open',
                CustomerEmail: customer.email || '',
                CustomerName: customer.name || '',
                CompanyName: customer.company || '',
                Phone: customer.phone || '',
                TotalQuantity: totalQuantity,
                SubtotalAmount: subtotal,
                LTMFeeTotal: 0,
                TotalAmount: subtotal,
                Notes: JSON.stringify({
                    productType: priceQuote.productType,
                    storeConfig: priceQuote.storeConfig || null,
                    fundraiserPricing: priceQuote.pricing || null,
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

            // Save line items
            let items = [];
            if (isFundraiser) {
                const p = priceQuote.pricing || {};
                items = [{
                    QuoteID: quoteID,
                    LineNumber: 1,
                    StyleNumber: 'FUNDRAISER-ITEM',
                    ProductName: 'Fundraiser item pricing',
                    EmbellishmentType: 'fundraiser',
                    Quantity: 1,
                    BaseUnitPrice: Number(p.blankCost) || 0,
                    FinalUnitPrice: Number(p.sellPrice) || 0,
                    LineTotal: Number(p.sellPrice) || 0,
                    HasLTM: 'No',
                    LTMPerUnit: 0,
                    SizeBreakdown: JSON.stringify({
                        blankCost: p.blankCost,
                        donation: p.donation,
                        margin: p.margin,
                        ccFee: p.ccFee,
                        embellishment: p.embellishment,
                        sellPrice: p.sellPrice,
                    }),
                    PricingTier: 'Fundraiser',
                    AddedAt: new Date().toISOString(),
                }];
            } else {
                items = lineItems.map((it, idx) => ({
                    QuoteID: quoteID,
                    LineNumber: idx + 1,
                    StyleNumber: it.partNumber,
                    ProductName: it.description || it.partNumber,
                    EmbellishmentType: 'service',
                    Quantity: Number(it.quantity) || 1,
                    BaseUnitPrice: Number(it.pricePerUnit) || 0,
                    FinalUnitPrice: Number(it.pricePerUnit) || 0,
                    LineTotal: Number(it.totalPrice) || 0,
                    HasLTM: 'No',
                    LTMPerUnit: 0,
                    SizeBreakdown: JSON.stringify(priceQuote.storeConfig || {}),
                    PricingTier: priceQuote.storeConfig?.storeType || 'Standard',
                    AddedAt: new Date().toISOString(),
                }));
            }

            for (const it of items) {
                const r = await fetch(API_BASE_URL + '/api/quote_items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(it),
                });
                if (!r.ok) {
                    const t = await r.text();
                    console.warn('[webstore-ai] quote_items POST failed:', r.status, t.slice(0, 200));
                }
            }

            aiState.savedQuoteID = quoteID;
            updateContextPill('saved ✓');
            updateActionsAvailability();
            showToast(`Saved ${quoteID} — click again for share link`);
        } catch (err) {
            console.error('[webstore-ai] save failed:', err);
            showToast('Save failed — check console');
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
