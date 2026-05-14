/**
 * Threaded comments / questions per policy.
 *
 * Renders into a `#commentsSection` element on the policy detail page.
 * Anyone with sessionStorage auth can read + post; admin (policies-admin)
 * can resolve, hide, and edit any comment.
 *
 * Endpoints:
 *   GET  caspio-pricing-proxy/api/policy-comments-public/by-policy/:id  (read)
 *   POST caspio-pricing-proxy/api/policy-comments-public/                (post)
 *   PUT  /api/crm-proxy/policy-comments/:id                              (admin update)
 *   DELETE /api/crm-proxy/policy-comments/:id                            (admin hide)
 *   POST /api/crm-proxy/policy-comments/:id/resolve                      (admin resolve)
 *
 * Public API: window.PolicyComments.mount(policyId)
 */
(function () {
    'use strict';

    const PUBLIC_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/policy-comments-public';
    const ADMIN_BASE = '/api/crm-proxy/policy-comments';

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function relativeTime(iso) {
        if (!iso) return '';
        const t = new Date(iso).getTime();
        if (Number.isNaN(t)) return iso;
        const diff = (Date.now() - t) / 1000;
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
        if (diff < 2592000) return `${Math.floor(diff / 86400)} days ago`;
        return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function authorInitials(name) {
        return String(name || '?').trim().split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
    }

    // Stable color per author for the avatar — hash-based
    function authorColor(name) {
        let h = 0;
        for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
        const palette = ['#16a34a', '#2563eb', '#9333ea', '#db2777', '#d97706', '#0891b2', '#dc2626', '#7c3aed'];
        return palette[Math.abs(h) % palette.length];
    }

    // ---------------------------------------------------------------------
    // mount(policyId): the only public entry point
    // ---------------------------------------------------------------------
    async function mount(policyId) {
        const host = document.getElementById('commentsSection');
        if (!host || !policyId) return;

        // Get logged-in author info from sessionStorage (stamped by staff-dashboard.html on login)
        const authorName = sessionStorage.getItem('nwca_user_name') || '';
        const authorEmail = sessionStorage.getItem('nwca_user_email') || '';
        const isAdmin = !!window.IS_POLICIES_ADMIN;

        host.style.display = '';
        host.innerHTML = `
            <h2 class="comments-title">
                <i class="fas fa-comments"></i> Discussion
                <span class="comments-count" id="commentsCount"></span>
            </h2>
            <p class="comments-intro">Ask questions, share examples, or comment on this policy. ${isAdmin ? '<strong>You can resolve and hide comments as admin.</strong>' : ''}</p>

            <div class="comments-thread" id="commentsThread">
                <div class="comments-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading discussion…</div>
            </div>

            ${authorName ? `
                <form class="comments-post-form" id="commentsForm">
                    <div class="comments-post-header">
                        <div class="comments-avatar" style="background:${authorColor(authorName)}">${escapeHtml(authorInitials(authorName))}</div>
                        <div>
                            <div class="comments-post-as">Posting as <strong>${escapeHtml(authorName)}</strong></div>
                            <label class="comments-question-toggle">
                                <input type="checkbox" id="commentsIsQuestion"> This is a question for Erik
                            </label>
                        </div>
                    </div>
                    <textarea
                        id="commentsBody"
                        class="comments-input"
                        rows="3"
                        placeholder="Share a comment, ask a question, or note an edge case…"
                        maxlength="4000"
                    ></textarea>
                    <div class="comments-form-actions">
                        <button type="button" class="comments-polish-btn" id="commentsPolish" title="Let Claude polish your comment before posting">
                            <i class="fas fa-sparkles"></i> Polish with AI
                        </button>
                        <span class="comments-form-status" id="commentsFormStatus"></span>
                        <button type="submit" class="btn btn-primary" id="commentsSubmit">
                            <i class="fas fa-paper-plane"></i> Post
                        </button>
                    </div>
                </form>
            ` : `
                <div class="comments-locked">
                    <i class="fas fa-lock"></i> Log in via the staff dashboard to post a comment.
                </div>
            `}
        `;

        const state = {
            policyId,
            authorName,
            authorEmail,
            isAdmin,
            comments: [],
            replyingTo: null  // Comment_ID we're replying to (sets Parent_Comment_ID on post)
        };

        await loadComments(state);
        wireForm(state);
        handleHashDeepLink(state);
    }

    // If the URL has a #comment-<Comment_ID> hash, scroll that comment into
    // view + briefly highlight it + auto-set the reply target. Called once
    // after initial render and again on hashchange.
    function handleHashDeepLink(state) {
        const tryScroll = () => {
            const hash = (window.location.hash || '').replace(/^#/, '');
            if (!hash.startsWith('comment-')) return;
            const commentId = hash.slice('comment-'.length);
            const target = document.getElementById(`comment-${commentId}`);
            if (!target) return;
            // Scroll smoothly + flash a highlight ring for visibility
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('comment-flash');
            setTimeout(() => target.classList.remove('comment-flash'), 2200);
            // Pre-set reply if the comment isn't the user's own
            const c = state.comments.find(x => x.Comment_ID === commentId);
            if (c && state.authorName && c.Author_Name !== state.authorName) {
                setReplyTarget(state, commentId, c.Author_Name);
            }
        };
        tryScroll();
        window.addEventListener('hashchange', tryScroll);
    }

    async function loadComments(state) {
        const thread = document.getElementById('commentsThread');
        const countEl = document.getElementById('commentsCount');
        try {
            const res = await fetch(`${PUBLIC_BASE}/by-policy/${encodeURIComponent(state.policyId)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            state.comments = data.comments || [];
            countEl.textContent = state.comments.length ? `(${state.comments.length})` : '';
            renderThread(state);
        } catch (e) {
            console.error('[comments] load error:', e);
            thread.innerHTML = `<div class="comments-empty"><i class="fas fa-triangle-exclamation"></i> Could not load discussion: ${escapeHtml(e.message)}</div>`;
        }
    }

    function renderThread(state) {
        const thread = document.getElementById('commentsThread');
        if (state.comments.length === 0) {
            thread.innerHTML = `<div class="comments-empty"><i class="fas fa-comment-slash"></i> No discussion yet. Start the conversation below.</div>`;
            return;
        }

        // Build a parent → children map for threading. Top-level comments
        // have empty Parent_Comment_ID. Render each top-level + its direct
        // children. One level of nesting only — keep the UI flat.
        const byParent = new Map();
        const topLevel = [];
        for (const c of state.comments) {
            const parent = c.Parent_Comment_ID || '';
            if (parent) {
                if (!byParent.has(parent)) byParent.set(parent, []);
                byParent.get(parent).push(c);
            } else {
                topLevel.push(c);
            }
        }

        thread.innerHTML = topLevel.map(c => {
            const replies = byParent.get(c.Comment_ID) || [];
            return renderComment(c, state, false) +
                (replies.length ? `<div class="comments-replies">${replies.map(r => renderComment(r, state, true)).join('')}</div>` : '');
        }).join('');

        wireCommentActions(state);
    }

    function renderComment(c, state, isReply) {
        const isQuestion = c.Is_Question === true || c.Is_Question === 1 || c.Is_Question === '1' || String(c.Is_Question).toLowerCase() === 'yes';
        const isResolved = c.Status === 'Resolved';
        const adminActions = state.isAdmin ? `
            <div class="comment-admin-actions">
                ${isQuestion && !isResolved ? `<button type="button" class="comment-action-btn" data-action="resolve" data-id="${escapeHtml(c.Comment_ID)}"><i class="fas fa-check"></i> Mark resolved</button>` : ''}
                <button type="button" class="comment-action-btn" data-action="hide" data-id="${escapeHtml(c.Comment_ID)}"><i class="fas fa-eye-slash"></i> Hide</button>
            </div>
        ` : '';

        const replyBtn = state.authorName && !isReply ? `
            <button type="button" class="comment-action-btn comment-reply-btn" data-action="reply" data-id="${escapeHtml(c.Comment_ID)}" data-author="${escapeHtml(c.Author_Name)}">
                <i class="fas fa-reply"></i> Reply
            </button>
        ` : '';

        // Body: simple paragraph split — preserve line breaks but escape HTML
        const bodyHtml = escapeHtml(c.Body || '').split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

        return `
            <div class="comment ${isReply ? 'comment-reply' : ''} ${isResolved ? 'comment-resolved' : ''}" id="comment-${escapeHtml(c.Comment_ID)}" data-comment-id="${escapeHtml(c.Comment_ID)}">
                <div class="comment-avatar" style="background:${authorColor(c.Author_Name)}">${escapeHtml(authorInitials(c.Author_Name))}</div>
                <div class="comment-body">
                    <div class="comment-meta">
                        <span class="comment-author">${escapeHtml(c.Author_Name || 'Anonymous')}</span>
                        ${isQuestion ? '<span class="comment-tag comment-tag-question"><i class="fas fa-question-circle"></i> Question</span>' : ''}
                        ${isResolved ? '<span class="comment-tag comment-tag-resolved"><i class="fas fa-check-circle"></i> Resolved</span>' : ''}
                        <span class="comment-date" title="${escapeHtml(c.Created_At || '')}">${escapeHtml(relativeTime(c.Created_At))}</span>
                    </div>
                    <div class="comment-text">${bodyHtml}</div>
                    <div class="comment-actions">
                        ${replyBtn}
                        ${adminActions}
                    </div>
                </div>
            </div>
        `;
    }

    function wireCommentActions(state) {
        const thread = document.getElementById('commentsThread');
        thread.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                if (action === 'reply') {
                    setReplyTarget(state, id, btn.dataset.author);
                } else if (action === 'resolve') {
                    if (!confirm('Mark this question as resolved?')) return;
                    btn.disabled = true;
                    await adminAction(`/${encodeURIComponent(id)}/resolve`, 'POST');
                    await loadComments(state);
                } else if (action === 'hide') {
                    if (!confirm('Hide this comment? Hidden comments stay in Caspio but no one will see them.')) return;
                    btn.disabled = true;
                    await adminAction(`/${encodeURIComponent(id)}`, 'DELETE');
                    await loadComments(state);
                }
            });
        });
    }

    async function adminAction(path, method) {
        try {
            const res = await fetch(ADMIN_BASE + path, {
                method,
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!res.ok) {
                let detail = res.statusText;
                try { detail = (await res.json()).error || detail; } catch (e) { /* noop */ }
                throw new Error(`${res.status}: ${detail}`);
            }
        } catch (e) {
            alert(`Action failed: ${e.message}`);
        }
    }

    function setReplyTarget(state, parentId, authorName) {
        state.replyingTo = parentId;
        const body = document.getElementById('commentsBody');
        const status = document.getElementById('commentsFormStatus');
        if (!body) return;
        body.focus();
        if (status) {
            status.innerHTML = `<i class="fas fa-reply"></i> Replying to <strong>${escapeHtml(authorName)}</strong> · <button type="button" class="comments-cancel-reply" id="commentsCancelReply">cancel</button>`;
            document.getElementById('commentsCancelReply').addEventListener('click', () => {
                state.replyingTo = null;
                status.innerHTML = '';
            });
        }
        // Scroll to the form
        document.getElementById('commentsForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // ---------------------------------------------------------------------
    // Post form
    // ---------------------------------------------------------------------
    function wireForm(state) {
        const form = document.getElementById('commentsForm');
        if (!form) return;
        const bodyInput = document.getElementById('commentsBody');
        const submitBtn = document.getElementById('commentsSubmit');
        const isQuestionCb = document.getElementById('commentsIsQuestion');
        const polishBtn = document.getElementById('commentsPolish');
        const statusEl = document.getElementById('commentsFormStatus');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = (bodyInput.value || '').trim();
            if (!text) {
                statusEl.innerHTML = `<i class="fas fa-circle-info"></i> Add a comment first.`;
                return;
            }

            submitBtn.disabled = true;
            const originalLabel = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Posting…';
            statusEl.innerHTML = '';

            try {
                const res = await fetch(`${PUBLIC_BASE}/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        Policy_ID: state.policyId,
                        Parent_Comment_ID: state.replyingTo || '',
                        Author_Name: state.authorName,
                        Author_Email: state.authorEmail,
                        Body: text,
                        Is_Question: isQuestionCb && isQuestionCb.checked ? true : false
                    })
                });
                if (!res.ok) {
                    let detail = res.statusText;
                    try { detail = (await res.json()).error || detail; } catch (e) { /* noop */ }
                    throw new Error(detail);
                }
                bodyInput.value = '';
                if (isQuestionCb) isQuestionCb.checked = false;
                state.replyingTo = null;
                statusEl.innerHTML = `<i class="fas fa-check-circle"></i> Posted`;
                setTimeout(() => { if (statusEl.innerHTML.includes('Posted')) statusEl.innerHTML = ''; }, 2500);
                await loadComments(state);
            } catch (err) {
                statusEl.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${escapeHtml(err.message)}`;
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalLabel;
            }
        });

        // AI polish button — admin only (uses /api/policies/ai-assist which is role-gated)
        if (polishBtn) {
            if (!state.isAdmin) {
                polishBtn.style.display = 'none';
            } else {
                polishBtn.addEventListener('click', async () => {
                    const draft = (bodyInput.value || '').trim();
                    if (!draft) {
                        statusEl.innerHTML = `<i class="fas fa-circle-info"></i> Write a draft first, then Claude can polish it.`;
                        return;
                    }
                    polishBtn.disabled = true;
                    const orig = polishBtn.innerHTML;
                    polishBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
                    statusEl.innerHTML = '';
                    try {
                        const polished = await polishComment(draft);
                        bodyInput.value = polished;
                        statusEl.innerHTML = `<i class="fas fa-check-circle"></i> Polished — review and tweak before posting`;
                    } catch (e) {
                        statusEl.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${escapeHtml(e.message)}`;
                    } finally {
                        polishBtn.disabled = false;
                        polishBtn.innerHTML = orig;
                    }
                });
            }
        }
    }

    // Uses the existing AI Assist endpoint with action=polish-draft, but
    // tells the model in the prompt to keep it short and conversational
    // (it's a comment, not a policy section).
    async function polishComment(draft) {
        const res = await fetch('/api/policies/ai-assist', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
            body: JSON.stringify({
                action: 'polish-draft',
                selectedText: draft,
                prompt: 'This is a discussion-thread comment, not a policy section. Keep it short, conversational, and direct. Output PLAIN TEXT only — no HTML tags, no Markdown formatting, no preamble. Preserve the original meaning and tone.'
            })
        });
        if (!res.ok) {
            let d = res.statusText;
            try { d = (await res.json()).error || d; } catch (e) { /* noop */ }
            throw new Error(`${res.status}: ${d}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buf = '';
        let output = '';
        let done = false;
        while (!done) {
            const { value, done: streamDone } = await reader.read();
            if (streamDone) break;
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
                let data; try { data = JSON.parse(dataStr); } catch { continue; }
                if (type === 'delta' && typeof data.text === 'string') output += data.text;
                else if (type === 'done') { done = true; break; }
                else if (type === 'error') throw new Error(data.message || 'AI error');
            }
        }

        // Strip any accidental HTML tags Claude included despite the instruction
        return output.replace(/<[^>]+>/g, '').trim();
    }

    window.PolicyComments = { mount };
})();
