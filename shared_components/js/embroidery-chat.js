/**
 * embroidery-chat.js — EMB Research Assistant chat panel controller.
 *
 * Streams from /api/emb-quote-ai/chat (Claude Sonnet 4.6 + SSE). 3 tools:
 *   - lookup_customer
 *   - recommend_top_sellers_emb  (Caspio EMB_Top_Sellers_2026)
 *   - lookup_product_details     (live SanMar)
 *
 * Research-only. Does NOT touch the form (matches Erik's "rep builds quotes
 * manually, chat answers questions" charter). Bot reply text is rendered
 * verbatim — tool chips show which tool was called, but result rendering
 * stays minimal (the bot summarizes results in its own reply).
 *
 * Created 2026-05-24 — Phase EMB Chat C. Inspired by dtg-quote-page.js but
 * dramatically simplified (no form-write, no result cards, no size matrix).
 * If DTF + SCP get their own chats, extract the common pieces into a shared
 * quote-builder-chat.js helper.
 */

(function () {
    'use strict';

    const API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const AI_ENDPOINT = API_BASE_URL + '/api/emb-quote-ai/chat';

    const chatState = {
        opened: false,
        messages: [],            // [{role, content}, ...] — full conversation
        isStreaming: false,
    };

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        wireChatPanel();
        showFloatingButton();
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // === F1: Safe markdown → HTML rendering for bot replies (2026-05-25) ===
    // The bot streams beautifully-formatted markdown (tables, **bold**, links,
    // headings, lists) but the chat panel was rendering it as plain textContent.
    // This function converts a focused subset of markdown to safe HTML.
    //
    // Security: input is HTML-escaped FIRST, then markdown patterns are applied.
    // URLs are validated against a protocol allowlist (http/https/mailto only).
    // DOMPurify lazy-loaded as defense-in-depth (sanitizes the final HTML).
    //
    // Supports:
    //   **bold**, *italic*, `inline code`
    //   [link text](https://url) and raw https:// URLs (auto-linkified)
    //   ### Heading 3, ## Heading 2 (no h1 — kept as plain text — bot shouldn't use it)
    //   - list item / * list item, 1. numbered
    //   | col | col | + | --- | --- | table rows
    //   blank line = paragraph break, single \n = <br>
    function isSafeUrl(u) {
        try {
            const parsed = new URL(u, window.location.href);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:'
                || parsed.protocol === 'mailto:' || parsed.protocol === 'tel:';
        } catch { return false; }
    }
    function markdownToHtml(text) {
        if (!text) return '';
        // 1. Escape HTML so any < > & in bot output stays inert
        let s = escapeHtml(text);

        // 2. Code blocks (preserve content verbatim — process FIRST)
        const codeBlocks = [];
        s = s.replace(/```([\s\S]*?)```/g, (_, code) => {
            codeBlocks.push(code);
            return `\x00CODEBLOCK${codeBlocks.length - 1}\x00`;
        });

        // 3. Inline code
        const inlineCodes = [];
        s = s.replace(/`([^`\n]+)`/g, (_, code) => {
            inlineCodes.push(code);
            return `\x00INLINECODE${inlineCodes.length - 1}\x00`;
        });

        // 4. Tables (pipe-separated rows with header divider)
        const tableLines = [];
        const rawLines = s.split('\n');
        const lines = [];
        let i = 0;
        while (i < rawLines.length) {
            const line = rawLines[i];
            // Detect table: current row has pipes AND next row is divider
            if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < rawLines.length && /^\s*\|[\s|:-]+\|\s*$/.test(rawLines[i+1])) {
                // Collect all consecutive table rows
                const rows = [line];
                let j = i + 1;
                while (j < rawLines.length && /^\s*\|.*\|\s*$/.test(rawLines[j])) {
                    rows.push(rawLines[j]);
                    j++;
                }
                // rows[1] is the divider, skip it
                const parseRow = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
                const header = parseRow(rows[0]);
                const bodyRows = rows.slice(2).map(parseRow);
                let html = '<table><thead><tr>';
                for (const h of header) html += `<th>${h}</th>`;
                html += '</tr></thead><tbody>';
                for (const r of bodyRows) {
                    html += '<tr>';
                    for (const c of r) html += `<td>${c}</td>`;
                    html += '</tr>';
                }
                html += '</tbody></table>';
                lines.push(html);
                i = j;
                continue;
            }
            lines.push(line);
            i++;
        }
        s = lines.join('\n');

        // 5. Headings
        s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');

        // 6. Lists (simple — group consecutive list items)
        s = s.replace(/(^|\n)((?:[\-*] .+(?:\n|$))+)/g, (m, lead, block) => {
            const items = block.trim().split('\n').map(l => l.replace(/^[\-*] /, ''));
            return lead + '<ul>' + items.map(it => `<li>${it}</li>`).join('') + '</ul>';
        });
        s = s.replace(/(^|\n)((?:\d+\. .+(?:\n|$))+)/g, (m, lead, block) => {
            const items = block.trim().split('\n').map(l => l.replace(/^\d+\. /, ''));
            return lead + '<ol>' + items.map(it => `<li>${it}</li>`).join('') + '</ol>';
        });

        // 7. Bold + italic (bold first, so ** doesn't get caught by *)
        s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

        // 8. Markdown links [text](url) — validate URL
        s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, url) => {
            if (!isSafeUrl(url)) return m; // leave as plain text if URL is unsafe
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        });

        // 9. Auto-link raw URLs (must NOT re-link URLs already in <a> tags)
        // Match http(s)://... up to whitespace, ), or end of string, NOT preceded by =" or '> (markers of an existing href)
        s = s.replace(/(^|[\s(])(https?:\/\/[^\s<>"')]+)/g, (m, lead, url) => {
            if (!isSafeUrl(url)) return m;
            return `${lead}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });

        // 10. Restore code blocks + inline code
        s = s.replace(/\x00CODEBLOCK(\d+)\x00/g, (_, idx) => `<pre><code>${codeBlocks[+idx]}</code></pre>`);
        s = s.replace(/\x00INLINECODE(\d+)\x00/g, (_, idx) => `<code>${inlineCodes[+idx]}</code>`);

        // 11. Convert remaining newlines to <br> (skip lines that are already block elements)
        s = s.replace(/\n\n+/g, '\n\n'); // collapse multi-blank
        s = s.split('\n').map(line => {
            // Don't add <br> after block-level elements
            if (/^\s*(<\/?(h[123]|ul|ol|li|table|thead|tbody|tr|th|td|pre|p)\b|<\/(h[123]|ul|ol|table|pre|p)>\s*$)/.test(line)) return line;
            return line;
        }).join('\n');
        s = s.replace(/\n/g, '<br>');
        // Clean up <br>s adjacent to block elements
        s = s.replace(/<br>\s*(<(h[123]|ul|ol|table|pre|p)\b)/g, '$1');
        s = s.replace(/(<\/(h[123]|ul|ol|table|pre|p)>)\s*<br>/g, '$1');

        // 12. DOMPurify if available — defense-in-depth sanitization
        if (window.DOMPurify) {
            return window.DOMPurify.sanitize(s, {
                ALLOWED_TAGS: ['strong', 'em', 'code', 'pre', 'a', 'br',
                               'h2', 'h3', 'ul', 'ol', 'li',
                               'table', 'thead', 'tbody', 'tr', 'th', 'td'],
                ALLOWED_ATTR: ['href', 'target', 'rel'],
                ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
            });
        }
        return s;
    }

    // Lazy-load DOMPurify from CDN once (mirror of pattern in policy-detail.js)
    let _dompurifyPromise = null;
    function ensureDOMPurify() {
        if (window.DOMPurify) return Promise.resolve();
        if (_dompurifyPromise) return _dompurifyPromise;
        _dompurifyPromise = new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js';
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => resolve(); // proceed without sanitizer if CDN fails — escape+regex still applies
            document.head.appendChild(s);
        });
        return _dompurifyPromise;
    }
    // Fire-and-forget on script load so it's ready by the time the user sends
    // their first message.
    ensureDOMPurify();

    function wireChatPanel() {
        const closeBtn   = document.getElementById('aiChatClose');
        const backdrop   = document.getElementById('aiChatBackdrop');
        const form       = document.getElementById('aiChatForm');
        const ta         = document.getElementById('aiChatTextarea');
        const floatBtn   = document.getElementById('floatingQuoteBtn');
        const resetBtn   = document.getElementById('aiChatResetBtn');
        const copyBtn    = document.getElementById('aiChatCopyBtn');

        if (closeBtn) closeBtn.addEventListener('click', closeChatPanel);
        if (backdrop) backdrop.addEventListener('click', closeChatPanel);
        if (floatBtn) floatBtn.addEventListener('click', openChatPanel);
        if (resetBtn) resetBtn.addEventListener('click', resetChat);
        if (copyBtn)  copyBtn.addEventListener('click', handleCopyChat);

        if (form && ta) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const text = ta.value.trim();
                if (!text || chatState.isStreaming) return;
                ta.value = '';
                autoResizeTextarea(ta);
                chatState.messages.push({ role: 'user', content: text });
                appendBubble('user', text);
                sendChatMessage();
            });
            ta.addEventListener('input', () => autoResizeTextarea(ta));
            ta.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    form.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && chatState.opened) closeChatPanel();
        });
    }

    function autoResizeTextarea(ta) {
        ta.style.height = 'auto';
        ta.style.height = Math.min(220, Math.max(72, ta.scrollHeight)) + 'px';
    }

    function openChatPanel() {
        const panel    = document.getElementById('aiChatPanel');
        const backdrop = document.getElementById('aiChatBackdrop');
        if (!panel) return;
        // The aside has the HTML `hidden` attribute on initial load to prevent
        // a FOUC flash (unstyled white block over the Ask button before CSS
        // catches up). Removing it here lets the slide-in transform animate.
        panel.removeAttribute('hidden');
        if (backdrop) backdrop.removeAttribute('hidden');
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
        if (backdrop) {
            backdrop.classList.add('open');
            backdrop.setAttribute('aria-hidden', 'false');
        }
        chatState.opened = true;
        hideFloatingButton();

        // First-open: greeting message. Subsequent opens skip this — the
        // conversation continues where it left off.
        if (chatState.messages.length === 0) {
            chatState.messages.push({
                role: 'user',
                content: "(Open the chat — greet the rep briefly and offer to help: customer lookup, top embroidery sellers, or color/size checks.)",
            });
            updateContextPill('Ready — ask me anything');
            sendChatMessage();
        }
        setTimeout(() => { document.getElementById('aiChatTextarea')?.focus(); }, 250);
    }

    function closeChatPanel() {
        const panel    = document.getElementById('aiChatPanel');
        const backdrop = document.getElementById('aiChatBackdrop');
        if (!panel) return;
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
        if (backdrop) {
            backdrop.classList.remove('open');
            backdrop.setAttribute('aria-hidden', 'true');
        }
        chatState.opened = false;
        showFloatingButton();
    }

    function showFloatingButton() {
        const b = document.getElementById('floatingQuoteBtn');
        if (b) b.hidden = false;
    }
    function hideFloatingButton() {
        const b = document.getElementById('floatingQuoteBtn');
        if (b) b.hidden = true;
    }

    function resetChat() {
        if (chatState.isStreaming) return;
        const messagesEl = document.getElementById('aiChatMessages');
        if (messagesEl) messagesEl.innerHTML = '';
        chatState.messages = [];
        // Re-trigger the greeting
        chatState.messages.push({
            role: 'user',
            content: "(Open the chat — greet the rep briefly and offer to help with EMB research.)",
        });
        updateContextPill('Ready — ask me anything');
        sendChatMessage();
    }

    function updateContextPill(text) {
        const pill = document.getElementById('aiChatContextPill');
        if (pill) pill.innerHTML = escapeHtml(text || '');
    }

    // --- Bubbles + chips ---------------------------------------------------

    function appendBubble(role, text, opts) {
        opts = opts || {};
        const container = document.getElementById('aiChatMessages');
        const msg = document.createElement('div');
        msg.className = 'chat-message ' + role + (opts.error ? ' error' : '');
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        // F1 (2026-05-25): assistant replies render as safe markdown HTML
        // (clickable links, tables, **bold**, lists). User messages + error
        // strings stay as plain text — safer and they don't have markdown anyway.
        if (role === 'assistant' && !opts.error) {
            bubble.innerHTML = markdownToHtml(text);
        } else {
            bubble.textContent = text;
        }
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

    function appendToolChip(toolName, statusText) {
        const container = document.getElementById('aiChatMessages');
        const msg = document.createElement('div');
        msg.className = 'chat-message assistant';
        const chip = document.createElement('span');
        chip.className = 'tool-chip';
        let iconClass = 'fa-cog';
        if (toolName === 'lookup_customer')             iconClass = 'fa-search';
        else if (toolName === 'recommend_top_sellers_emb') iconClass = 'fa-star';
        else if (toolName === 'lookup_product_details')    iconClass = 'fa-palette';
        chip.innerHTML = `<i class="fas ${iconClass}"></i> ${escapeHtml(statusText)}`;
        msg.appendChild(chip);
        container.appendChild(msg);
        scrollChatBottom();
        return msg;
    }

    function scrollChatBottom() {
        const c = document.getElementById('aiChatMessages');
        if (c) c.scrollTop = c.scrollHeight;
    }

    // --- Streaming chat send -----------------------------------------------

    async function sendChatMessage() {
        chatState.isStreaming = true;
        const typing = appendTypingIndicator();
        let bubble = null;
        let assistantText = '';

        try {
            const response = await fetch(AI_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
                body: JSON.stringify({
                    messages: chatState.messages,
                    // No calcContext for EMB v1 — chat doesn't read the form.
                    // Future v2 could pass {quoteID, currentRows} for richer context.
                    calcContext: null,
                }),
            });

            if (!response.ok) {
                removeTypingIndicator(typing);
                const errText = await response.text().catch(() => '');
                appendBubble('assistant', `Error ${response.status}: ${errText.slice(0, 200)}`, { error: true });
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                // SSE parsing: events separated by blank lines, each event has
                // `event: TYPE\n` and `data: JSON\n` lines.
                const events = buffer.split('\n\n');
                buffer = events.pop() || ''; // keep incomplete trailer

                for (const rawEvent of events) {
                    const lines = rawEvent.split('\n');
                    let eventType = 'message';
                    let dataStr = '';
                    for (const line of lines) {
                        if (line.startsWith('event:')) eventType = line.slice(6).trim();
                        else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
                    }
                    if (!dataStr) continue;
                    let data;
                    try { data = JSON.parse(dataStr); } catch { continue; }

                    if (eventType === 'delta') {
                        // Streaming text — accumulate + render
                        if (!bubble) {
                            removeTypingIndicator(typing);
                            bubble = appendBubble('assistant', '');
                        }
                        assistantText += data.text || '';
                        // F1 (2026-05-25): re-render markdown each delta so the
                        // user sees formatted output stream in (tables, bold,
                        // clickable links). Re-parsing the full text per delta
                        // is fine — text is short (sub-2K chars typical) and
                        // markdownToHtml is sub-millisecond.
                        bubble.innerHTML = markdownToHtml(assistantText);
                        scrollChatBottom();
                    } else if (eventType === 'tool_result') {
                        // Tool fired — show a chip describing it. Bot's next
                        // delta event will explain the result in plain text.
                        const tool = data.tool || 'tool';
                        let statusText = '';
                        if (tool === 'lookup_customer') {
                            const n = data?.result?.count || 0;
                            statusText = n > 0 ? `Found ${n} customer match${n === 1 ? '' : 'es'}` : 'No customer matches';
                        } else if (tool === 'recommend_top_sellers_emb') {
                            const n = data?.result?.count || 0;
                            statusText = `Pulled ${n} top seller${n === 1 ? '' : 's'}`;
                        } else if (tool === 'lookup_product_details') {
                            const sty = data?.result?.styleNumber || '';
                            const cc  = data?.result?.colorCount || 0;
                            statusText = sty ? `${sty} — ${cc} colors` : 'Product lookup';
                        } else {
                            statusText = tool;
                        }
                        appendToolChip(tool, statusText);
                    } else if (eventType === 'done') {
                        // Conversation turn complete — push the assistant's full
                        // reply into history so the next turn has context.
                        if (assistantText) {
                            chatState.messages.push({ role: 'assistant', content: assistantText });
                        }
                    } else if (eventType === 'error') {
                        removeTypingIndicator(typing);
                        appendBubble('assistant', `Error: ${data.message || 'unknown'}`, { error: true });
                    }
                }
            }
        } catch (err) {
            console.error('[emb-chat] send failed:', err);
            removeTypingIndicator(typing);
            appendBubble('assistant', `Network error: ${err.message}`, { error: true });
        } finally {
            chatState.isStreaming = false;
            removeTypingIndicator(typing);
        }
    }

    async function handleCopyChat() {
        if (!chatState.messages.length) return;
        const text = chatState.messages
            .filter(m => typeof m.content === 'string' && !m.content.startsWith('(Open the chat'))
            .map(m => `${m.role.toUpperCase()}: ${m.content}`)
            .join('\n\n');
        try {
            await navigator.clipboard.writeText(text);
            updateContextPill('Copied conversation ✓');
            setTimeout(() => updateContextPill('Ready — ask me anything'), 2000);
        } catch (e) {
            console.warn('[emb-chat] copy failed:', e);
        }
    }
})();
