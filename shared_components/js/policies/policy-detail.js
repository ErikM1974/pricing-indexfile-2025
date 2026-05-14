/**
 * Policy detail page controller.
 *
 * Three modes:
 *   1. Read (default): render Body_HTML (DOMPurified) + breadcrumb + outline
 *   2. Edit (?edit=1, admin only): TipTap editor + Title/Summary/Category fields + Save
 *   3. New (?id=new&edit=1, admin only): blank editor for creating a fresh policy
 *
 * Stub policies (External_URL set) → redirect to that URL on load.
 *
 * Depends on: PoliciesAPI, PoliciesAdminGate, PolicyEditor, DOMPurify
 */
(function () {
    'use strict';

    const VALID_CATEGORIES = ['Financial', 'Operations', 'Customer Service', 'HR', 'Training'];
    const VALID_STATUSES = ['Draft', 'Published', 'Archived'];

    const state = {
        policy: null,           // current record (null while loading)
        isNew: false,
        isEditing: false,
        editor: null,           // TipTap instance
        originalUpdatedAt: '',  // for If-Match concurrency
        parentOptions: [],      // for parent dropdown
        autosaveTimer: null
    };

    // -------------------- utilities --------------------
    function $(id) { return document.getElementById(id); }
    function qs(p) { return new URLSearchParams(window.location.search).get(p); }
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function formatDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit'
        });
    }
    function categoryIcon(cat) {
        const map = {
            'Financial': 'fa-dollar-sign',
            'Operations': 'fa-cogs',
            'Customer Service': 'fa-headset',
            'HR': 'fa-users',
            'Training': 'fa-graduation-cap'
        };
        return map[cat] || 'fa-folder';
    }

    // Estimated read time — uses a 230 wpm baseline (standard for English
    // business prose; verified against Medium's 265 wpm benchmark but tuned
    // down because internal SOPs have more lists and procedural detail).
    // Rounds up; minimum 1 min.
    function estimateReadTime(html) {
        if (!html) return 0;
        const plain = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const words = plain ? plain.split(/\s+/).length : 0;
        return Math.max(1, Math.ceil(words / 230));
    }
    // DOMPurify config — allows embedded videos from a tight allowlist of
    // trusted hosts (YouTube, Loom, Vimeo). Generic iframes from anywhere
    // are still stripped, so a malicious paste can't slip in third-party
    // content. The `data-video-embed` wrapper is preserved so our CSS
    // 16:9 styling kicks in.
    const SAFE_IFRAME_HOSTS = /^https:\/\/(?:www\.)?(youtube\.com|youtube-nocookie\.com|loom\.com|player\.vimeo\.com)\//;

    function sanitizeHtml(html) {
        if (!window.DOMPurify) return html;
        const clean = window.DOMPurify.sanitize(html, {
            ADD_TAGS: ['iframe'],
            ADD_ATTR: ['target', 'rel', 'allow', 'allowfullscreen', 'frameborder', 'loading', 'data-video-embed', 'data-src', 'data-kind'],
            FORBID_TAGS: ['style', 'script', 'object', 'embed', 'form', 'input'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
        });
        // After sanitize, drop iframes whose src isn't on the allowlist.
        // Defense-in-depth in case a future TipTap upgrade adds new iframe sources.
        try {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = clean;
            wrapper.querySelectorAll('iframe').forEach(f => {
                const src = f.getAttribute('src') || '';
                if (!SAFE_IFRAME_HOSTS.test(src)) f.remove();
            });
            return wrapper.innerHTML;
        } catch (e) {
            return clean;
        }
    }

    // -------------------- data load --------------------
    async function loadPolicy() {
        const id = qs('id');
        state.isEditing = qs('edit') === '1';

        if (id === 'new') {
            state.isNew = true;
            state.policy = {
                Policy_ID: '',
                Title: '',
                Summary: '',
                Category: VALID_CATEGORIES[0],
                Body_HTML: '',
                Status: 'Published',
                Tags: '',
                Owner_Email: '',
                Owner_Name: '',
                Sort_Order: 100,
                Parent_Policy_ID: qs('parent') || ''
            };
            return;
        }

        if (!id) {
            renderError('Missing policy id.');
            return;
        }

        try {
            const result = window.IS_POLICIES_ADMIN
                ? await PoliciesAPI.adminGetPolicy(id)
                : await PoliciesAPI.getPolicy(id);
            state.policy = result.policy;
            state.originalUpdatedAt = state.policy.Updated_At || '';
            // Expose policy meta for AI Assist context (read by policy-ai-assist.js)
            window.POLICIES_CURRENT = state.policy;

            // External stub → redirect
            if (state.policy.External_URL && !state.isEditing) {
                window.location.href = state.policy.External_URL;
            }
        } catch (e) {
            console.error('[policy-detail] load error:', e);
            renderError(e.status === 404 ? 'Policy not found.' : 'Could not load policy.');
        }
    }

    async function loadParentOptions() {
        try {
            const result = window.IS_POLICIES_ADMIN
                ? await PoliciesAPI.adminListPolicies()
                : await PoliciesAPI.listPolicies();
            state.parentOptions = (result.policies || [])
                .filter(p => !state.policy || p.Policy_ID !== state.policy.Policy_ID); // can't parent self
        } catch (e) {
            state.parentOptions = [];
        }
    }

    // -------------------- rendering --------------------
    function renderError(msg) {
        const root = $('detailRoot');
        if (root) {
            root.innerHTML = `
                <div class="detail-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h2>${escapeHtml(msg)}</h2>
                    <a href="/pages/policies-hub.html" class="btn btn-secondary">
                        <i class="fas fa-arrow-left"></i> Back to Hub
                    </a>
                </div>
            `;
        }
    }

    function renderBreadcrumb() {
        const el = $('breadcrumb');
        if (!el || !state.policy) return;
        const parts = [
            `<a href="/pages/policies-hub.html">Policies Hub</a>`
        ];
        if (state.policy.Category) {
            parts.push(`<a href="/pages/policies-hub.html?category=${encodeURIComponent(state.policy.Category)}">${escapeHtml(state.policy.Category)}</a>`);
        }
        parts.push(`<span class="crumb-current">${escapeHtml(state.policy.Title || 'New policy')}</span>`);
        el.innerHTML = parts.join('<i class="fas fa-chevron-right crumb-sep"></i>');
    }

    function renderHeader() {
        const titleEl = $('policyTitle');
        const summaryEl = $('policySummary');
        const metaEl = $('policyMeta');
        if (!titleEl || !state.policy) return;

        if (state.isEditing) {
            titleEl.innerHTML = `<input type="text" id="editTitle" class="title-input" value="${escapeHtml(state.policy.Title)}" placeholder="Policy title">`;
            summaryEl.innerHTML = `
                <div class="input-with-ai">
                    <input type="text" id="editSummary" class="summary-input" value="${escapeHtml(state.policy.Summary || '')}" placeholder="Short one-line summary (shows on card)">
                    <button type="button" class="ai-suggest-btn" id="aiSuggestSummary" title="Let Claude write the summary from the policy body">
                        <i class="fas fa-sparkles"></i> Suggest
                    </button>
                </div>
            `;
            metaEl.innerHTML = `
                <div class="edit-meta-row">
                    <label>
                        <span>Category</span>
                        <select id="editCategory">
                            ${VALID_CATEGORIES.map(c => `<option value="${c}" ${state.policy.Category === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                    </label>
                    <label>
                        <span>Status</span>
                        <select id="editStatus">
                            ${VALID_STATUSES.map(s => `<option value="${s}" ${state.policy.Status === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </label>
                    <label>
                        <span>Parent (sub-procedure?)</span>
                        <select id="editParent">
                            <option value="">— None (top level) —</option>
                            ${state.parentOptions
                                .filter(p => !p.Parent_Policy_ID) // only let user choose top-level parents (enforces 2-level rule)
                                .map(p => `<option value="${escapeHtml(p.Policy_ID)}" ${state.policy.Parent_Policy_ID === p.Policy_ID ? 'selected' : ''}>${escapeHtml(p.Title)} (${escapeHtml(p.Category)})</option>`).join('')}
                        </select>
                    </label>
                    <label>
                        <span>Tags (comma-separated)</span>
                        <div class="input-with-ai">
                            <input type="text" id="editTags" value="${escapeHtml(state.policy.Tags || '')}" placeholder="e.g. embroidery, LTM, pickup">
                            <button type="button" class="ai-suggest-btn ai-suggest-btn-sm" id="aiSuggestTags" title="Let Claude propose tags from the policy body">
                                <i class="fas fa-sparkles"></i>
                            </button>
                        </div>
                    </label>
                </div>
            `;

            // Wire the AI suggest buttons after the DOM is in place
            wireAISuggestButtons();
        } else {
            titleEl.innerHTML = escapeHtml(state.policy.Title);
            summaryEl.innerHTML = state.policy.Summary ? escapeHtml(state.policy.Summary) : '';

            const tagsHtml = (state.policy.Tags || '')
                .split(',').map(t => t.trim()).filter(Boolean)
                .map(t => `<span class="meta-tag">${escapeHtml(t)}</span>`).join('');

            const readMinutes = estimateReadTime(state.policy.Body_HTML);

            metaEl.innerHTML = `
                <span class="meta-pill meta-category">
                    <i class="fas ${categoryIcon(state.policy.Category)}"></i> ${escapeHtml(state.policy.Category)}
                </span>
                ${state.policy.Status !== 'Published'
                    ? `<span class="meta-pill meta-status meta-${state.policy.Status.toLowerCase()}">${escapeHtml(state.policy.Status)}</span>`
                    : ''}
                ${readMinutes > 0
                    ? `<span class="meta-readtime"><i class="far fa-clock"></i> ${readMinutes} min read</span>`
                    : ''}
                <span class="meta-owner">
                    <i class="far fa-user"></i> ${escapeHtml(state.policy.Owner_Name || '—')}
                </span>
                <span class="meta-updated">
                    <i class="far fa-calendar"></i> Updated ${formatDate(state.policy.Updated_At)}
                    ${state.policy.Updated_By ? ` by ${escapeHtml(state.policy.Updated_By)}` : ''}
                </span>
                ${tagsHtml ? `<div class="meta-tags">${tagsHtml}</div>` : ''}
            `;
        }
    }

    async function renderBody() {
        const el = $('policyBody');
        if (!el || !state.policy) return;

        if (state.isEditing) {
            el.innerHTML = '<div class="loading-editor">Loading editor…</div>';
            try {
                state.editor = await PolicyEditor.mount(el, {
                    initialHtml: state.policy.Body_HTML || '',
                    placeholder: 'Start writing your policy. Use the toolbar above for formatting, lists, tables, and images.'
                });
                startAutosaveDraft();
            } catch (e) {
                console.error('[policy-detail] editor mount failed:', e);
                el.innerHTML = `<div class="editor-error">Couldn't load editor: ${escapeHtml(e.message)}</div>`;
            }
        } else {
            const html = sanitizeHtml(state.policy.Body_HTML || '');
            el.innerHTML = html || '<p class="empty-body">This policy has no content yet.</p>';
            renderOutline();
        }
    }

    function renderOutline() {
        const outline = $('policyOutline');
        if (!outline) return;

        const headings = $('policyBody').querySelectorAll('h1, h2, h3');
        if (headings.length === 0) {
            outline.innerHTML = '';
            outline.style.display = 'none';
            return;
        }

        outline.style.display = '';
        const items = Array.from(headings).map((h, i) => {
            if (!h.id) h.id = `h-${i}-${(h.textContent || '').slice(0, 30).replace(/\s+/g, '-').toLowerCase()}`;
            const level = parseInt(h.tagName.substring(1), 10);
            return `<a class="outline-link outline-h${level}" href="#${h.id}">${escapeHtml(h.textContent || '')}</a>`;
        }).join('');

        outline.innerHTML = `
            <div class="outline-title">On this page</div>
            ${items}
        `;
    }

    function renderActions() {
        const el = $('policyActions');
        if (!el) return;

        // Share button — visible in both read and edit mode (when there's a real policy)
        const shareBtn = state.policy && !state.isNew
            ? `<button id="shareBtn" class="btn btn-secondary" type="button" title="Copy a link to this policy"><i class="fas fa-link"></i> Copy link</button>`
            : '';

        if (state.isEditing) {
            el.innerHTML = `
                <button id="saveBtn" class="btn btn-primary"><i class="fas fa-save"></i> Save</button>
                <button id="cancelBtn" class="btn btn-secondary">Cancel</button>
                ${!state.isNew && window.IS_POLICIES_ADMIN
                    ? '<button id="archiveBtn" class="btn btn-danger" type="button"><i class="fas fa-archive"></i> Archive</button>'
                    : ''}
                ${shareBtn}
                <span id="saveStatus" class="save-status"></span>
            `;
            $('saveBtn').addEventListener('click', onSave);
            $('cancelBtn').addEventListener('click', onCancel);
            const archive = $('archiveBtn');
            if (archive) archive.addEventListener('click', onArchive);
        } else if (window.IS_POLICIES_ADMIN && state.policy && !state.policy.External_URL) {
            el.innerHTML = `
                <button id="editBtn" class="btn btn-primary"><i class="fas fa-edit"></i> Edit</button>
                ${shareBtn}
            `;
            $('editBtn').addEventListener('click', () => {
                const url = new URL(window.location.href);
                url.searchParams.set('edit', '1');
                window.location.href = url.toString();
            });
        } else if (shareBtn) {
            el.innerHTML = shareBtn;
        } else {
            el.innerHTML = '';
        }

        const share = $('shareBtn');
        if (share) share.addEventListener('click', onShare);
    }

    // ----- AI suggest buttons (Summary + Tags) -----
    //
    // Both call /api/policies/ai-assist (the same streaming endpoint the
    // editor uses), but collect the streamed deltas into a single string
    // and stuff it into the target input field. Non-modal — feels like
    // the field "just fills itself in."
    function wireAISuggestButtons() {
        const summaryBtn = $('aiSuggestSummary');
        if (summaryBtn) {
            summaryBtn.addEventListener('click', async () => {
                const input = $('editSummary');
                const editor = state.editor;
                const bodyHtml = editor ? editor.getHTML() : (state.policy.Body_HTML || '');
                if (!bodyHtml || bodyHtml.replace(/<[^>]+>/g, '').trim().length < 20) {
                    showToast('<i class="fas fa-circle-info"></i> Write some body content first, then I can summarize it.');
                    return;
                }
                await runAISuggest(summaryBtn, input, 'auto-summarize', { surroundingContext: bodyHtml });
            });
        }
        const tagsBtn = $('aiSuggestTags');
        if (tagsBtn) {
            tagsBtn.addEventListener('click', async () => {
                const input = $('editTags');
                const editor = state.editor;
                const bodyHtml = editor ? editor.getHTML() : (state.policy.Body_HTML || '');
                if (!bodyHtml || bodyHtml.replace(/<[^>]+>/g, '').trim().length < 20) {
                    showToast('<i class="fas fa-circle-info"></i> Write some body content first, then I can suggest tags.');
                    return;
                }
                await runAISuggest(tagsBtn, input, 'suggest-tags', { surroundingContext: bodyHtml });
            });
        }
    }

    async function runAISuggest(btn, inputEl, action, extra) {
        const titleEl = $('editTitle');
        const categoryEl = $('editCategory');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';

        try {
            const payload = {
                action,
                title: titleEl ? titleEl.value : (state.policy.Title || ''),
                category: categoryEl ? categoryEl.value : (state.policy.Category || ''),
                ...extra
            };
            const res = await fetch('/api/policies/ai-assist', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                let detail = res.statusText;
                try { detail = (await res.json()).error || detail; } catch (e) { /* noop */ }
                throw new Error(`${res.status}: ${detail}`);
            }

            // Consume SSE deltas into a single string
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

            // Strip surrounding whitespace, surrounding quotes, and any
            // accidental leading "Summary:" / "Tags:" preamble.
            output = output.trim()
                .replace(/^["'`]+|["'`]+$/g, '')
                .replace(/^(Summary|Tags|Tag|TLDR):\s*/i, '')
                .trim();

            if (!output) {
                showToast('<i class="fas fa-circle-info"></i> Claude returned nothing — try again.');
                return;
            }

            inputEl.value = output;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            showToast('<i class="fas fa-check-circle"></i> Filled — review and tweak before saving');
        } catch (e) {
            console.error('[ai-suggest] error:', e);
            showToast(`<i class="fas fa-triangle-exclamation"></i> ${e.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    // Copy the canonical share URL to clipboard + toast confirmation.
    async function onShare() {
        if (!state.policy) return;
        // Build a clean URL: no `edit=1`, no other params
        const u = new URL(window.location.href);
        u.search = `?id=${encodeURIComponent(state.policy.Policy_ID)}`;
        const shareUrl = u.toString();

        try {
            await navigator.clipboard.writeText(shareUrl);
            showToast(`<i class="fas fa-check-circle"></i> Link copied — paste anywhere`);
        } catch (e) {
            // Older browser / no clipboard permission — fallback to prompt
            window.prompt('Copy this link:', shareUrl);
        }
    }

    // Lightweight toast — auto-dismisses. No dependency on a toast library.
    function showToast(html) {
        let host = document.querySelector('.pd-toast');
        if (host) host.remove();
        host = document.createElement('div');
        host.className = 'pd-toast';
        host.innerHTML = html;
        document.body.appendChild(host);
        requestAnimationFrame(() => host.classList.add('show'));
        setTimeout(() => {
            host.classList.remove('show');
            setTimeout(() => host.remove(), 300);
        }, 2500);
    }

    async function renderSubProcedures() {
        const el = $('subProcedures');
        if (!el || !state.policy || state.isNew) return;

        try {
            const useAdmin = window.IS_POLICIES_ADMIN;
            const result = useAdmin
                ? await PoliciesAPI.adminListPolicies({ parent: state.policy.Policy_ID })
                : await PoliciesAPI.listPolicies({ parent: state.policy.Policy_ID });
            const children = result.policies || [];

            if (children.length === 0) {
                el.style.display = 'none';
                return;
            }

            el.style.display = '';
            el.innerHTML = `
                <h2 class="sub-procedures-title">
                    <i class="fas fa-folder-tree"></i> Sub-procedures
                </h2>
                <div class="sub-procedures-list">
                    ${children.map(c => `
                        <a href="/pages/policy-detail.html?id=${encodeURIComponent(c.Policy_ID)}" class="sub-procedure-card">
                            <span class="sub-title">${escapeHtml(c.Title)}</span>
                            <span class="sub-summary">${escapeHtml(c.Summary || '')}</span>
                            <i class="fas fa-arrow-right sub-arrow"></i>
                        </a>
                    `).join('')}
                </div>
            `;
        } catch (e) {
            el.style.display = 'none';
        }
    }

    // -------------------- save / cancel / archive --------------------
    function collectEditPayload() {
        const payload = {
            Title: $('editTitle').value.trim(),
            Summary: $('editSummary').value.trim(),
            Category: $('editCategory').value,
            Status: $('editStatus').value,
            Parent_Policy_ID: $('editParent').value || null,
            Tags: $('editTags').value.trim(),
            Body_HTML: state.editor ? state.editor.getHTML() : '',
            Updated_By: (window.POLICIES_USER && window.POLICIES_USER.email) || ''
        };
        if (state.isNew) {
            payload.Owner_Email = (window.POLICIES_USER && window.POLICIES_USER.email) || '';
            payload.Owner_Name = (window.POLICIES_USER && (window.POLICIES_USER.firstName + ' ' + window.POLICIES_USER.lastName).trim()) || '';
        }
        return payload;
    }

    function setSaveStatus(text, kind) {
        const el = $('saveStatus');
        if (!el) return;
        el.textContent = text || '';
        el.className = 'save-status' + (kind ? ' status-' + kind : '');
    }

    async function onSave() {
        const payload = collectEditPayload();
        if (!payload.Title) {
            setSaveStatus('Title is required', 'error');
            return;
        }
        if (!payload.Category) {
            setSaveStatus('Category is required', 'error');
            return;
        }

        setSaveStatus('Saving…');
        $('saveBtn').disabled = true;

        try {
            let result;
            if (state.isNew) {
                result = await PoliciesAPI.createPolicy(payload);
                clearAutosaveDraft('new');
                const newId = result && result.policy && result.policy.Policy_ID;
                if (newId) {
                    window.location.href = `/pages/policy-detail.html?id=${encodeURIComponent(newId)}`;
                    return;
                }
            } else {
                result = await PoliciesAPI.updatePolicy(state.policy.Policy_ID, payload, {
                    ifMatch: state.originalUpdatedAt
                });
                clearAutosaveDraft(state.policy.Policy_ID);
                // Drop the edit=1 param to return to read mode
                const url = new URL(window.location.href);
                url.searchParams.delete('edit');
                window.location.href = url.toString();
                return;
            }
        } catch (e) {
            $('saveBtn').disabled = false;
            if (e.status === 409) {
                setSaveStatus('⚠ This policy was edited elsewhere. Reload to see latest, or save again to overwrite.', 'error');
                state.originalUpdatedAt = (e.data && e.data.current_updated_at) || state.originalUpdatedAt;
            } else {
                setSaveStatus(`Save failed: ${e.message}`, 'error');
            }
            console.error('[policy-detail] save error:', e);
        }
    }

    function onCancel() {
        if (state.editor) {
            const currentHtml = state.editor.getHTML();
            const original = state.policy.Body_HTML || '';
            if (currentHtml !== original && !window.confirm('Discard unsaved changes?')) return;
        }
        clearAutosaveDraft(state.isNew ? 'new' : state.policy.Policy_ID);
        if (state.isNew) {
            window.location.href = '/pages/policies-hub.html';
        } else {
            const url = new URL(window.location.href);
            url.searchParams.delete('edit');
            window.location.href = url.toString();
        }
    }

    async function onArchive() {
        if (!window.confirm(`Archive "${state.policy.Title}"? It will be hidden from staff but recoverable.`)) return;
        try {
            await PoliciesAPI.archivePolicy(state.policy.Policy_ID);
            window.location.href = '/pages/policies-hub.html';
        } catch (e) {
            setSaveStatus(`Archive failed: ${e.message}`, 'error');
        }
    }

    // -------------------- autosave draft to localStorage --------------------
    function autosaveKey(id) { return `policy_draft_${id}`; }

    function startAutosaveDraft() {
        if (state.autosaveTimer) clearInterval(state.autosaveTimer);
        state.autosaveTimer = setInterval(() => {
            if (!state.editor) return;
            try {
                const id = state.isNew ? 'new' : state.policy.Policy_ID;
                localStorage.setItem(autosaveKey(id), JSON.stringify({
                    body: state.editor.getHTML(),
                    at: Date.now()
                }));
            } catch (e) { /* quota exceeded — silent */ }
        }, 30000);
    }

    function clearAutosaveDraft(id) {
        try { localStorage.removeItem(autosaveKey(id)); } catch (e) { /* ignore */ }
    }

    // -------------------- DOMPurify lazy load --------------------
    async function ensureDOMPurify() {
        if (window.DOMPurify) return;
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js';
            s.onload = resolve;
            s.onerror = () => reject(new Error('DOMPurify failed to load'));
            document.head.appendChild(s);
        });
    }

    // -------------------- main render --------------------
    async function render() {
        renderBreadcrumb();
        renderHeader();
        await renderBody();
        renderActions();
        await renderSubProcedures();
    }

    // -------------------- init --------------------
    async function init() {
        await ensureDOMPurify().catch(e => console.warn('[policy-detail]', e.message));

        // Wait for admin gate to resolve so edit affordances render correctly on first paint.
        await new Promise(resolve => {
            if (document.documentElement.classList.contains('is-policies-admin') || window.POLICIES_USER !== null) {
                resolve();
            } else {
                let resolved = false;
                document.addEventListener('policies:admin-resolved', () => {
                    if (!resolved) { resolved = true; resolve(); }
                }, { once: true });
                // Failsafe — don't block forever
                setTimeout(() => { if (!resolved) { resolved = true; resolve(); } }, 1500);
            }
        });

        // Gate edit mode: non-admins can never enter edit, even via ?edit=1
        if (qs('edit') === '1' && !window.IS_POLICIES_ADMIN) {
            const url = new URL(window.location.href);
            url.searchParams.delete('edit');
            window.location.replace(url.toString());
            return;
        }

        if (state.isEditing) await loadParentOptions();
        await loadPolicy();
        if (state.policy) render();
        wireKeyboardShortcuts();
    }

    // Cmd/Ctrl + S → save (in edit mode); Cmd/Ctrl + E → enter edit mode (read mode);
    // Cmd/Ctrl + Shift + C → copy share link; Esc → cancel edit / back to read.
    function wireKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignore if user is typing in a non-policy input or the TipTap editor
            // is handling its own shortcuts (TipTap captures Cmd+B/I/etc).
            const meta = e.metaKey || e.ctrlKey;

            // Cmd/Ctrl+S → save
            if (meta && !e.shiftKey && e.key.toLowerCase() === 's') {
                if (state.isEditing) {
                    e.preventDefault();
                    const saveBtn = document.getElementById('saveBtn');
                    if (saveBtn && !saveBtn.disabled) saveBtn.click();
                }
                return;
            }

            // Cmd/Ctrl+E → enter edit mode (read mode, admin only)
            if (meta && !e.shiftKey && e.key.toLowerCase() === 'e') {
                if (!state.isEditing && window.IS_POLICIES_ADMIN && state.policy && !state.policy.External_URL) {
                    e.preventDefault();
                    const editBtn = document.getElementById('editBtn');
                    if (editBtn) editBtn.click();
                }
                return;
            }

            // Cmd/Ctrl+Shift+C → copy share link
            if (meta && e.shiftKey && e.key.toLowerCase() === 'c') {
                if (state.policy && !state.isNew) {
                    e.preventDefault();
                    onShare();
                }
                return;
            }

            // Escape → exit edit (with confirmation if dirty) or close any open AI modal
            if (e.key === 'Escape') {
                const aiOverlay = document.getElementById('aiModalOverlay');
                if (aiOverlay) return; // AI modal handles its own Esc
                if (state.isEditing && !state.isNew) {
                    const cancelBtn = document.getElementById('cancelBtn');
                    if (cancelBtn) cancelBtn.click();
                }
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
