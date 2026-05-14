/**
 * AI Semantic Search for the Policies Hub.
 *
 * Lets any staff member ask a natural-language question and get matched
 * to the most relevant policies via Claude. Opens as a modal from the
 * "Ask Claude" button next to the regular search input.
 *
 * Calls /api/policies-ai-search on the proxy directly (public, rate-limited,
 * no CRM auth needed). Non-streaming — one short JSON response.
 *
 * Public API: window.PolicyAISearch.open()
 */
(function () {
    'use strict';

    const ENDPOINT = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/policies-ai-search';

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function buildModal() {
        return `
            <div class="ai-modal-overlay" id="aiSearchOverlay">
                <div class="ai-modal ai-search-modal" role="dialog" aria-labelledby="aiSearchTitle">
                    <div class="ai-modal-header">
                        <h2 id="aiSearchTitle">
                            <i class="fas fa-wand-magic-sparkles"></i>
                            Ask Claude to find a policy
                        </h2>
                        <button type="button" class="ai-modal-close" aria-label="Close">
                            <i class="fas fa-xmark"></i>
                        </button>
                    </div>

                    <div class="ai-modal-body">
                        <div class="ai-search-help">
                            Describe what you need in plain English. Examples:
                        </div>
                        <div class="ai-search-examples">
                            <button type="button" class="ai-search-example">What do I do if a customer wants Net 30?</button>
                            <button type="button" class="ai-search-example">How do I handle an order below the minimum?</button>
                            <button type="button" class="ai-search-example">Steps to assemble Christmas gift bundles</button>
                        </div>

                        <form class="ai-search-form" id="aiSearchForm">
                            <input
                                type="text"
                                id="aiSearchInput"
                                class="ai-search-input"
                                placeholder="Ask anything about NWCA policies…"
                                maxlength="300"
                                autocomplete="off"
                            >
                            <button type="submit" class="btn btn-primary" id="aiSearchSubmit">
                                <i class="fas fa-sparkles"></i> Search
                            </button>
                        </form>

                        <div class="ai-search-status" id="aiSearchStatus"></div>
                        <div class="ai-search-results" id="aiSearchResults"></div>
                    </div>
                </div>
            </div>
        `;
    }

    function close(host) {
        host.remove();
    }

    function open() {
        const host = document.createElement('div');
        host.innerHTML = buildModal();
        document.body.appendChild(host);

        const overlay = host.querySelector('#aiSearchOverlay');
        const closeBtn = host.querySelector('.ai-modal-close');
        const form = host.querySelector('#aiSearchForm');
        const input = host.querySelector('#aiSearchInput');
        const submit = host.querySelector('#aiSearchSubmit');
        const statusEl = host.querySelector('#aiSearchStatus');
        const resultsEl = host.querySelector('#aiSearchResults');

        // Example chips fill the input + auto-submit
        host.querySelectorAll('.ai-search-example').forEach(btn => {
            btn.addEventListener('click', () => {
                input.value = btn.textContent.trim();
                form.requestSubmit();
            });
        });

        function dismiss() { close(host); document.removeEventListener('keydown', escHandler); }
        function escHandler(e) { if (e.key === 'Escape') dismiss(); }
        document.addEventListener('keydown', escHandler);
        overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); });
        closeBtn.addEventListener('click', dismiss);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const query = input.value.trim();
            if (!query) return;

            submit.disabled = true;
            submit.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Asking Claude…';
            statusEl.innerHTML = '';
            resultsEl.innerHTML = '';

            try {
                const res = await fetch(ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                });

                let data;
                try { data = await res.json(); } catch { data = {}; }

                if (!res.ok) {
                    statusEl.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${escapeHtml(data.error || `Search failed (HTTP ${res.status})`)}`;
                    statusEl.classList.add('error');
                    return;
                }

                renderResults(resultsEl, statusEl, data);
            } catch (err) {
                statusEl.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${escapeHtml(err.message)}`;
                statusEl.classList.add('error');
            } finally {
                submit.disabled = false;
                submit.innerHTML = '<i class="fas fa-sparkles"></i> Search again';
            }
        });

        // Auto-focus the input
        setTimeout(() => input.focus(), 50);
    }

    function renderResults(resultsEl, statusEl, data) {
        const results = data.results || [];
        const searched = data.policies_searched || 0;

        if (results.length === 0) {
            statusEl.innerHTML = `<i class="fas fa-circle-info"></i> No relevant policies found. Try rephrasing, or ask Erik to write a policy on this topic.`;
            return;
        }

        statusEl.innerHTML = `<i class="fas fa-check-circle"></i> Found ${results.length} relevant ${results.length === 1 ? 'policy' : 'policies'} (searched ${searched})`;

        resultsEl.innerHTML = results.map(r => {
            const conf = r.confidence || 'medium';
            const href = `/pages/policy-detail.html?id=${encodeURIComponent(r.policy_id)}`;
            return `
                <a href="${href}" class="ai-search-result ai-search-result-${escapeHtml(conf)}">
                    <div class="ai-search-result-conf"><span class="ai-search-conf-dot"></span> ${escapeHtml(conf)} match</div>
                    <div class="ai-search-result-title">${escapeHtml(r.Title || r.policy_id)}</div>
                    <div class="ai-search-result-category"><i class="fas fa-folder"></i> ${escapeHtml(r.Category || '')}</div>
                    <div class="ai-search-result-why"><i class="fas fa-quote-left"></i> ${escapeHtml(r.why || '')}</div>
                </a>
            `;
        }).join('');
    }

    window.PolicyAISearch = { open };
})();
