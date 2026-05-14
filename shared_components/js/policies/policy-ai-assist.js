/**
 * AI Assist modal for the Policies Hub TipTap editor.
 *
 * Renders a modal with action picker + prompt input, POSTs to
 * /api/policies/ai-assist, consumes the SSE stream, and streams the result
 * into a preview area. The author then accepts (inserts into the editor) or
 * cancels.
 *
 * Public API: window.PolicyAIAssist.open(editor, { selectedText, title, category })
 */
(function () {
    'use strict';

    const ENDPOINT = '/api/policies/ai-assist';

    // Action catalog rendered in the modal. `needsPrompt` controls whether the
    // textarea is shown, `needsSelection` enforces that text must be selected
    // (so we don't send a destructive transform of nothing).
    const ACTIONS = [
        {
            key: 'generate-from-prompt',
            label: 'Write a new policy',
            icon: 'fa-wand-magic-sparkles',
            description: 'Describe a policy in one sentence and Claude drafts a full version.',
            needsPrompt: true,
            promptPlaceholder: 'e.g. "How to handle a customer asking for Net 30 terms"',
            needsSelection: false
        },
        {
            key: 'polish-draft',
            label: 'Polish my writing',
            icon: 'fa-feather-pointed',
            description: 'Tighten sentences, fix grammar, improve scannability. Preserves meaning and structure.',
            needsPrompt: false,
            needsSelection: false  // can polish the whole body
        },
        {
            key: 'expand-section',
            label: 'Add more detail',
            icon: 'fa-arrows-up-down',
            description: 'Take a thin section and add examples, edge cases, and sub-bullets.',
            needsPrompt: false,
            needsSelection: true
        },
        {
            key: 'summarize-section',
            label: 'Make it shorter',
            icon: 'fa-compress',
            description: 'Cut to the essentials while keeping accuracy.',
            needsPrompt: false,
            needsSelection: true
        },
        {
            key: 'add-faq',
            label: 'Add an FAQ section',
            icon: 'fa-question-circle',
            description: 'Generate 5–8 realistic Q&A pairs based on the current policy content.',
            needsPrompt: false,
            needsSelection: false
        },
        {
            key: 'translate-to-spanish',
            label: 'Translate to Spanish',
            icon: 'fa-language',
            description: 'Natural, professional Mexican Spanish for shop-floor staff.',
            needsPrompt: false,
            needsSelection: true
        }
    ];

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    let abortController = null;

    function buildModalHtml() {
        const actionCards = ACTIONS.map(a => `
            <label class="ai-action-card" data-action="${a.key}">
                <input type="radio" name="ai-action" value="${a.key}">
                <div class="ai-action-icon"><i class="fas ${a.icon}"></i></div>
                <div class="ai-action-body">
                    <div class="ai-action-label">${escapeHtml(a.label)}</div>
                    <div class="ai-action-desc">${escapeHtml(a.description)}</div>
                </div>
            </label>
        `).join('');

        return `
            <div class="ai-modal-overlay" id="aiModalOverlay">
                <div class="ai-modal" role="dialog" aria-labelledby="aiModalTitle">
                    <div class="ai-modal-header">
                        <h2 id="aiModalTitle">
                            <i class="fas fa-sparkles"></i>
                            AI Assist
                        </h2>
                        <button type="button" class="ai-modal-close" aria-label="Close">
                            <i class="fas fa-xmark"></i>
                        </button>
                    </div>

                    <div class="ai-modal-body" id="aiModalBody">
                        <div class="ai-selection-note" id="aiSelectionNote"></div>

                        <div class="ai-action-grid">
                            ${actionCards}
                        </div>

                        <div class="ai-prompt-wrap" id="aiPromptWrap" style="display:none">
                            <label class="ai-prompt-label" for="aiPromptInput">What's the policy about?</label>
                            <textarea id="aiPromptInput" class="ai-prompt-input" rows="3" placeholder=""></textarea>
                        </div>

                        <div class="ai-output-wrap" id="aiOutputWrap" style="display:none">
                            <div class="ai-output-header">
                                <span><i class="fas fa-sparkles"></i> Claude is writing…</span>
                                <span class="ai-status" id="aiStatus"></span>
                            </div>
                            <div class="ai-output" id="aiOutput"></div>
                        </div>
                    </div>

                    <div class="ai-modal-footer">
                        <button type="button" class="btn btn-secondary" id="aiCancelBtn">Cancel</button>
                        <button type="button" class="btn btn-secondary" id="aiTryAgainBtn" style="display:none">
                            <i class="fas fa-rotate-right"></i> Try again
                        </button>
                        <button type="button" class="btn btn-primary" id="aiSubmitBtn" disabled>
                            <i class="fas fa-sparkles"></i> Generate
                        </button>
                        <button type="button" class="btn btn-primary" id="aiInsertBtn" style="display:none">
                            <i class="fas fa-check"></i> Insert into policy
                        </button>
                        <button type="button" class="btn btn-primary" id="aiReplaceBtn" style="display:none">
                            <i class="fas fa-check"></i> Replace selection
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function open(editor, context = {}) {
        if (!editor) {
            alert('Editor not ready yet. Please wait a moment and try again.');
            return;
        }

        // Detect selection — if the author selected text in the editor, we
        // pass that as the input; otherwise we send the whole body as context.
        const sel = editor.state.selection;
        const selectedText = sel && !sel.empty
            ? editor.state.doc.textBetween(sel.from, sel.to, '\n\n')
            : '';
        const fullBody = editor.getHTML();
        const fullPlain = editor.state.doc.textContent || '';

        // Mount modal
        const host = document.createElement('div');
        host.innerHTML = buildModalHtml();
        document.body.appendChild(host);

        const overlay = host.querySelector('#aiModalOverlay');
        const closeBtn = host.querySelector('.ai-modal-close');
        const cancelBtn = host.querySelector('#aiCancelBtn');
        const submitBtn = host.querySelector('#aiSubmitBtn');
        const tryAgainBtn = host.querySelector('#aiTryAgainBtn');
        const insertBtn = host.querySelector('#aiInsertBtn');
        const replaceBtn = host.querySelector('#aiReplaceBtn');
        const promptWrap = host.querySelector('#aiPromptWrap');
        const promptInput = host.querySelector('#aiPromptInput');
        const outputWrap = host.querySelector('#aiOutputWrap');
        const outputEl = host.querySelector('#aiOutput');
        const statusEl = host.querySelector('#aiStatus');
        const selectionNote = host.querySelector('#aiSelectionNote');

        let currentAction = null;
        let generatedText = '';

        // Show what we're applying to
        if (selectedText) {
            selectionNote.innerHTML = `<i class="fas fa-quote-left"></i> Will apply to your selection (${selectedText.length} chars).`;
            selectionNote.classList.add('has-selection');
        } else if (fullPlain.trim()) {
            selectionNote.innerHTML = `<i class="fas fa-file-lines"></i> No selection — will use the whole policy as context.`;
        } else {
            selectionNote.innerHTML = `<i class="fas fa-circle-info"></i> Policy is empty — start with "Write a new policy".`;
        }

        function close() {
            if (abortController) {
                abortController.abort();
                abortController = null;
            }
            host.remove();
        }

        function selectAction(actionKey) {
            currentAction = ACTIONS.find(a => a.key === actionKey);
            host.querySelectorAll('.ai-action-card').forEach(card => {
                card.classList.toggle('selected', card.dataset.action === actionKey);
                const radio = card.querySelector('input[type="radio"]');
                if (radio) radio.checked = (card.dataset.action === actionKey);
            });

            // Show / hide prompt textarea
            if (currentAction.needsPrompt) {
                promptWrap.style.display = '';
                promptInput.placeholder = currentAction.promptPlaceholder || '';
                setTimeout(() => promptInput.focus(), 50);
            } else {
                promptWrap.style.display = 'none';
            }

            // Selection requirement warning
            if (currentAction.needsSelection && !selectedText) {
                selectionNote.innerHTML = `<i class="fas fa-triangle-exclamation"></i> This action needs you to select text in the policy first. Cancel, select text, then try again.`;
                selectionNote.classList.add('warn');
                submitBtn.disabled = true;
                return;
            } else {
                selectionNote.classList.remove('warn');
            }

            submitBtn.disabled = false;
        }

        async function runStream() {
            if (!currentAction) return;

            outputWrap.style.display = '';
            outputEl.textContent = '';
            generatedText = '';
            statusEl.textContent = '';
            submitBtn.style.display = 'none';
            tryAgainBtn.style.display = 'none';
            insertBtn.style.display = 'none';
            replaceBtn.style.display = 'none';

            const body = {
                action: currentAction.key,
                prompt: promptInput.value.trim(),
                selectedText: selectedText,
                surroundingContext: fullBody, // server uses this for FAQ/context
                title: context.title || '',
                category: context.category || ''
            };

            abortController = new AbortController();

            try {
                const res = await fetch(ENDPOINT, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
                    body: JSON.stringify(body),
                    signal: abortController.signal
                });

                if (!res.ok) {
                    let detail = '';
                    try { detail = (await res.json()).error || res.statusText; } catch (e) { detail = res.statusText; }
                    throw new Error(`Server returned ${res.status}: ${detail}`);
                }

                // Parse SSE stream
                const reader = res.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let buf = '';

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, { stream: true });

                    // SSE messages are separated by \n\n
                    let idx;
                    while ((idx = buf.indexOf('\n\n')) >= 0) {
                        const block = buf.slice(0, idx);
                        buf = buf.slice(idx + 2);
                        const event = parseSSEBlock(block);
                        if (!event) continue;

                        if (event.type === 'delta') {
                            generatedText += event.data.text || '';
                            outputEl.textContent = generatedText;
                            outputEl.scrollTop = outputEl.scrollHeight;
                        } else if (event.type === 'done') {
                            const u = event.data.usage || {};
                            const cacheRead = u.cache_read_input_tokens || 0;
                            const cacheNote = cacheRead > 0 ? ` · cache hit (${cacheRead} tokens cached)` : '';
                            statusEl.innerHTML = `<i class="fas fa-check"></i> Done — ${u.output_tokens || 0} tokens out${cacheNote}`;
                            insertBtn.style.display = '';
                            if (selectedText) replaceBtn.style.display = '';
                            tryAgainBtn.style.display = '';
                        } else if (event.type === 'error') {
                            throw new Error(event.data.message || 'Unknown error from AI');
                        }
                    }
                }
            } catch (e) {
                if (e.name === 'AbortError') {
                    statusEl.innerHTML = `<i class="fas fa-circle-stop"></i> Cancelled.`;
                } else {
                    console.error('[ai-assist] error:', e);
                    statusEl.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${escapeHtml(e.message)}`;
                    statusEl.classList.add('error');
                }
                tryAgainBtn.style.display = '';
                submitBtn.style.display = '';
                submitBtn.disabled = false;
            } finally {
                abortController = null;
            }
        }

        function insertIntoEditor(replaceSelection) {
            if (!generatedText.trim()) return;

            // Sanitize via DOMPurify if available — server already constrains output
            // to a safe tag whitelist, but defense in depth never hurts.
            let html = generatedText;
            if (window.DOMPurify) {
                html = window.DOMPurify.sanitize(html, {
                    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input'],
                    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'style', 'class', 'id']
                });
            }

            const chain = editor.chain().focus();
            if (replaceSelection && selectedText) {
                chain.deleteSelection().insertContent(html).run();
            } else {
                chain.insertContent(html).run();
            }
            close();
        }

        // Wire events
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        closeBtn.addEventListener('click', close);
        cancelBtn.addEventListener('click', close);
        submitBtn.addEventListener('click', runStream);
        tryAgainBtn.addEventListener('click', runStream);
        insertBtn.addEventListener('click', () => insertIntoEditor(false));
        replaceBtn.addEventListener('click', () => insertIntoEditor(true));

        host.querySelectorAll('.ai-action-card').forEach(card => {
            card.addEventListener('click', () => selectAction(card.dataset.action));
        });

        // Keyboard: Escape closes
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                close();
                document.removeEventListener('keydown', escapeHandler);
            }
        });

        // Default action: if there's a selection, lead with "Polish"; otherwise "Generate"
        if (selectedText) {
            selectAction('polish-draft');
        } else if (fullPlain.trim()) {
            selectAction('polish-draft');
        } else {
            selectAction('generate-from-prompt');
        }
    }

    function parseSSEBlock(block) {
        // SSE block: "event: TYPE\ndata: JSON"
        const lines = block.split('\n');
        let type = 'message', dataStr = '';
        for (const line of lines) {
            if (line.startsWith('event: ')) type = line.slice(7).trim();
            else if (line.startsWith('data: ')) dataStr += line.slice(6);
        }
        if (!dataStr) return null;
        try {
            return { type, data: JSON.parse(dataStr) };
        } catch (e) {
            return { type, data: { raw: dataStr } };
        }
    }

    window.PolicyAIAssist = { open };
})();
