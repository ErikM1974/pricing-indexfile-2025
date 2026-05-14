/**
 * Mermaid diagram support for the Policies Hub.
 *
 * Two responsibilities:
 *
 * 1. Render mode (policy-detail.html read view):
 *    Lazy-loads Mermaid from CDN and renders every <pre class="mermaid">
 *    block inside .policy-body into an SVG diagram.
 *
 * 2. Author mode (TipTap editor):
 *    Exposes window.PolicyMermaid.openInsertModal(editor) which opens a
 *    modal where the author either:
 *      - Pastes Mermaid syntax directly (with a live preview), or
 *      - Describes the diagram and Claude generates the syntax (via the
 *        existing /api/policies/ai-assist endpoint with action=generate-mermaid)
 *    On insert, the diagram lands in the editor as <pre class="mermaid">…</pre>
 *    so it roundtrips cleanly to Caspio and back.
 *
 * Mermaid is loaded on demand — read view kicks it off after policy body
 * is rendered; author view loads it when the Insert modal opens.
 */
(function () {
    'use strict';

    const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs';
    let mermaidLib = null;
    let loadPromise = null;

    function loadMermaid() {
        if (mermaidLib) return Promise.resolve(mermaidLib);
        if (loadPromise) return loadPromise;
        loadPromise = (async () => {
            const mod = await import(MERMAID_CDN);
            mermaidLib = mod.default || mod;
            mermaidLib.initialize({
                startOnLoad: false,
                theme: 'default',
                securityLevel: 'strict',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                themeVariables: {
                    primaryColor: '#e7f0eb',
                    primaryTextColor: '#1f3d2a',
                    primaryBorderColor: '#2e5b3e',
                    lineColor: '#4b5563',
                    secondaryColor: '#faf5ff',
                    tertiaryColor: '#fef3c7'
                }
            });
            return mermaidLib;
        })();
        return loadPromise;
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // -------------------- RENDER MODE --------------------

    /**
     * Find every <pre class="mermaid"> in the given root and replace each
     * with the rendered SVG. Safe to call multiple times (skips already-
     * rendered blocks).
     */
    async function renderAll(root) {
        const blocks = (root || document).querySelectorAll('pre.mermaid:not([data-rendered])');
        if (blocks.length === 0) return;

        const lib = await loadMermaid();
        for (const [i, block] of blocks.entries()) {
            const source = block.textContent.trim();
            if (!source) continue;
            const id = `mermaid-${Date.now()}-${i}`;
            try {
                const { svg } = await lib.render(id, source);
                const wrap = document.createElement('div');
                wrap.className = 'policy-mermaid';
                wrap.dataset.rendered = '1';
                wrap.innerHTML = svg;
                block.replaceWith(wrap);
            } catch (e) {
                console.warn('[mermaid] failed to render:', e.message);
                // Leave the source block visible as a fallback so author can see/fix
                block.dataset.rendered = 'error';
                block.classList.add('mermaid-error');
                const errEl = document.createElement('div');
                errEl.className = 'mermaid-error-banner';
                errEl.innerHTML = `<i class="fas fa-triangle-exclamation"></i> Diagram failed to render — showing source below`;
                block.parentNode.insertBefore(errEl, block);
            }
        }
    }

    // Auto-render on DOM ready when on the detail page (read view).
    // Skip when on the hub or other pages.
    function autoRenderWhenReady() {
        const tryRender = () => {
            const root = document.querySelector('.policy-body');
            if (root && !root.classList.contains('mermaid-watched')) {
                root.classList.add('mermaid-watched');
                renderAll(root);
                // Observe future re-renders (e.g., after edit→cancel returns to read mode)
                const observer = new MutationObserver(() => renderAll(root));
                observer.observe(root, { childList: true, subtree: false });
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', tryRender);
        } else {
            tryRender();
        }
        // Also retry after a delay — policy body renders async
        setTimeout(tryRender, 800);
        setTimeout(tryRender, 2000);
    }

    // -------------------- INSERT MODAL --------------------

    const EXAMPLE_DESCRIPTIONS = [
        'Customer notification flow when an order is ready',
        'Decision tree for approving Net 30 terms',
        'Steps in the LTM order decision',
        'DTG artwork intake and approval process'
    ];

    const STARTER_MERMAID = `flowchart TD
    A[Step 1] --> B{Decision?}
    B -->|Yes| C[Step 2a]
    B -->|No| D[Step 2b]
    C --> E[Done]
    D --> E`;

    function openInsertModal(editor) {
        if (!editor) return;
        const host = document.createElement('div');
        host.innerHTML = `
            <div class="ai-modal-overlay" id="mermaidOverlay">
                <div class="ai-modal" role="dialog" aria-labelledby="mermaidTitle" style="max-width:780px">
                    <div class="ai-modal-header">
                        <h2 id="mermaidTitle">
                            <i class="fas fa-diagram-project"></i>
                            Insert diagram
                        </h2>
                        <button type="button" class="ai-modal-close" aria-label="Close">
                            <i class="fas fa-xmark"></i>
                        </button>
                    </div>

                    <div class="ai-modal-body">
                        <div class="mermaid-tabs">
                            <button type="button" class="mermaid-tab active" data-tab="generate"><i class="fas fa-sparkles"></i> Generate from description</button>
                            <button type="button" class="mermaid-tab" data-tab="manual"><i class="fas fa-code"></i> Write Mermaid code</button>
                        </div>

                        <div class="mermaid-pane mermaid-pane-generate active">
                            <div class="ai-search-help">Describe what you want diagrammed. Claude turns it into a flowchart.</div>
                            <div class="ai-search-examples">
                                ${EXAMPLE_DESCRIPTIONS.map(d => `<button type="button" class="ai-search-example">${escapeHtml(d)}</button>`).join('')}
                            </div>
                            <form class="ai-search-form" id="mermaidGenForm">
                                <input type="text" id="mermaidPrompt" class="ai-search-input" placeholder="What should the diagram show?" maxlength="300">
                                <button type="submit" class="btn btn-primary" id="mermaidGenBtn"><i class="fas fa-sparkles"></i> Generate</button>
                            </form>
                            <div class="ai-search-status" id="mermaidStatus"></div>
                        </div>

                        <div class="mermaid-pane mermaid-pane-manual">
                            <label class="ai-prompt-label">Mermaid syntax</label>
                            <textarea id="mermaidCode" class="mermaid-code" rows="10" spellcheck="false"></textarea>
                            <div class="mermaid-help">
                                Need help? See <a href="https://mermaid.js.org/syntax/flowchart.html" target="_blank" rel="noopener">flowchart syntax</a>.
                            </div>
                        </div>

                        <div class="mermaid-preview-wrap" id="mermaidPreviewWrap" style="display:none">
                            <div class="ai-output-header"><span><i class="fas fa-eye"></i> Preview</span></div>
                            <div class="mermaid-preview" id="mermaidPreview"></div>
                        </div>
                    </div>

                    <div class="ai-modal-footer">
                        <button type="button" class="btn btn-secondary" id="mermaidCancel">Cancel</button>
                        <button type="button" class="btn btn-primary" id="mermaidInsert" disabled><i class="fas fa-check"></i> Insert</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(host);

        const overlay = host.querySelector('#mermaidOverlay');
        const closeBtn = host.querySelector('.ai-modal-close');
        const cancelBtn = host.querySelector('#mermaidCancel');
        const insertBtn = host.querySelector('#mermaidInsert');
        const promptInput = host.querySelector('#mermaidPrompt');
        const codeArea = host.querySelector('#mermaidCode');
        const genForm = host.querySelector('#mermaidGenForm');
        const genBtn = host.querySelector('#mermaidGenBtn');
        const statusEl = host.querySelector('#mermaidStatus');
        const previewWrap = host.querySelector('#mermaidPreviewWrap');
        const previewEl = host.querySelector('#mermaidPreview');
        const tabs = host.querySelectorAll('.mermaid-tab');
        const panes = host.querySelectorAll('.mermaid-pane');

        // Seed with starter so manual tab isn't empty
        codeArea.value = STARTER_MERMAID;
        updatePreview(STARTER_MERMAID);

        function dismiss() { host.remove(); document.removeEventListener('keydown', escHandler); }
        function escHandler(e) { if (e.key === 'Escape') dismiss(); }
        document.addEventListener('keydown', escHandler);
        overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); });
        closeBtn.addEventListener('click', dismiss);
        cancelBtn.addEventListener('click', dismiss);

        // Tab switching
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.toggle('active', t === tab));
                panes.forEach(p => p.classList.toggle('active', p.classList.contains(`mermaid-pane-${tab.dataset.tab}`)));
            });
        });

        // Example chips
        host.querySelectorAll('.ai-search-example').forEach(btn => {
            btn.addEventListener('click', () => {
                promptInput.value = btn.textContent.trim();
                genForm.requestSubmit();
            });
        });

        // Live preview when code is edited manually
        codeArea.addEventListener('input', () => updatePreview(codeArea.value));

        // Generate via Claude
        genForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const prompt = promptInput.value.trim();
            if (!prompt) return;
            genBtn.disabled = true;
            genBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Generating…';
            statusEl.innerHTML = '';
            statusEl.classList.remove('error');

            try {
                const code = await runGenerateMermaid(prompt, editor);
                codeArea.value = code;
                statusEl.innerHTML = `<i class="fas fa-check-circle"></i> Diagram generated — review the preview below, edit if needed, then click Insert`;
                // Auto-switch to manual tab so user can tweak
                tabs[1].click();
                await updatePreview(code);
            } catch (err) {
                statusEl.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${escapeHtml(err.message)}`;
                statusEl.classList.add('error');
            } finally {
                genBtn.disabled = false;
                genBtn.innerHTML = '<i class="fas fa-sparkles"></i> Generate';
            }
        });

        // Insert into editor
        insertBtn.addEventListener('click', () => {
            const src = codeArea.value.trim();
            if (!src) return;
            // Insert as <pre class="mermaid">…</pre> via TipTap insertContent
            editor.chain().focus()
                .insertContent({
                    type: 'mermaidDiagram',
                    attrs: { source: src }
                })
                .run();
            dismiss();
        });

        async function updatePreview(source) {
            if (!source || !source.trim()) {
                previewWrap.style.display = 'none';
                insertBtn.disabled = true;
                return;
            }
            previewWrap.style.display = '';
            previewEl.innerHTML = '<div class="mermaid-preview-loading"><i class="fas fa-circle-notch fa-spin"></i> Rendering…</div>';

            try {
                const lib = await loadMermaid();
                const id = `mermaid-preview-${Date.now()}`;
                const { svg } = await lib.render(id, source);
                previewEl.innerHTML = svg;
                insertBtn.disabled = false;
            } catch (e) {
                previewEl.innerHTML = `<div class="mermaid-preview-error"><i class="fas fa-triangle-exclamation"></i> ${escapeHtml(e.message || 'Invalid Mermaid syntax')}</div>`;
                insertBtn.disabled = true;
            }
        }

        setTimeout(() => promptInput.focus(), 50);
    }

    async function runGenerateMermaid(prompt, editor) {
        // Provide surrounding policy context to help Claude write a relevant diagram
        const ctx = editor ? editor.getHTML() : '';

        const res = await fetch('/api/policies/ai-assist', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
            body: JSON.stringify({
                action: 'generate-mermaid',
                prompt: prompt,
                surroundingContext: ctx,
                title: (window.POLICIES_CURRENT && window.POLICIES_CURRENT.Title) || '',
                category: (window.POLICIES_CURRENT && window.POLICIES_CURRENT.Category) || ''
            })
        });
        if (!res.ok) {
            let detail = res.statusText;
            try { detail = (await res.json()).error || detail; } catch (e) { /* noop */ }
            throw new Error(`${res.status}: ${detail}`);
        }

        // Consume SSE deltas
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buf = '';
        let output = '';
        let finished = false;
        while (!finished) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buf.indexOf('\n\n')) >= 0) {
                const block = buf.slice(0, idx);
                buf = buf.slice(idx + 2);
                let type = 'message', dataStr = '';
                for (const line of block.split('\n')) {
                    if (line.startsWith('event: ')) type = line.slice(7).trim();
                    else if (line.startsWith('data: ')) dataStr += line.slice(6);
                }
                if (!dataStr) continue;
                let data; try { data = JSON.parse(dataStr); } catch { data = null; }
                if (!data) continue;
                if (type === 'delta' && typeof data.text === 'string') output += data.text;
                else if (type === 'done') { finished = true; break; }
                else if (type === 'error') throw new Error(data.message || 'AI error');
            }
        }

        // Strip code fences if Claude added them despite the prompt saying not to
        return output
            .replace(/^```(?:mermaid)?\s*/i, '')
            .replace(/```\s*$/, '')
            .trim();
    }

    // -------------------- PUBLIC API --------------------
    window.PolicyMermaid = {
        renderAll,
        openInsertModal,
        loadMermaid
    };

    // Auto-render on policy detail pages
    autoRenderWhenReady();
})();
