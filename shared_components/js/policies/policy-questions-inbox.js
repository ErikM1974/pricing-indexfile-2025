/**
 * Open Questions Inbox controller.
 *
 * Admin-only page (gated via policies-admin-gate.js → IS_POLICIES_ADMIN).
 * Loads /api/crm-proxy/policy-comments/inbox once, renders a sortable +
 * filterable list of open questions with "jump to policy" / "resolve" /
 * "hide" actions on each card.
 *
 * Talks to the proxy through /api/crm-proxy/policy-comments/...
 * (same role-gated factory as the admin moderation routes).
 */
(function () {
    'use strict';

    const ADMIN_BASE = '/api/crm-proxy/policy-comments';

    const state = {
        questions: [],
        sort: 'oldest',           // oldest | newest | longestwaiting
        filterPolicy: 'all',      // 'all' | a specific Policy_ID
        filterAuthor: 'all',      // 'all' | a specific Author_Name
        filterAge: 'all'          // 'all' | 'over-3-days' | 'over-7-days'
    };

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
        if (diff < 3600) return `${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} hr`;
        const days = Math.floor(diff / 86400);
        return `${days} day${days === 1 ? '' : 's'}`;
    }

    function daysOpen(iso) {
        if (!iso) return 0;
        const t = new Date(iso).getTime();
        if (Number.isNaN(t)) return 0;
        return Math.floor((Date.now() - t) / 86400000);
    }

    function authorInitials(name) {
        return String(name || '?').trim().split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
    }
    function authorColor(name) {
        let h = 0;
        for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
        const palette = ['#16a34a', '#2563eb', '#9333ea', '#db2777', '#d97706', '#0891b2', '#dc2626', '#7c3aed'];
        return palette[Math.abs(h) % palette.length];
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

    // ---------------------------------------------------------------- data
    async function loadInbox() {
        const listEl = document.getElementById('questionsList');
        try {
            const res = await fetch(`${ADMIN_BASE}/inbox`, { credentials: 'same-origin' });
            if (res.status === 401) {
                // Not authenticated → redirect to login
                const here = encodeURIComponent(window.location.pathname);
                window.location.href = `/dashboards/staff-login.html?redirect=${here}`;
                return;
            }
            if (res.status === 403) {
                document.getElementById('questionsLockedNote').style.display = '';
                listEl.style.display = 'none';
                document.getElementById('questionsToolbar').style.display = 'none';
                return;
            }
            if (!res.ok) {
                let detail = res.statusText;
                try { detail = (await res.json()).error || detail; } catch (e) { /* noop */ }
                throw new Error(`${res.status}: ${detail}`);
            }
            const data = await res.json();
            state.questions = data.questions || [];
            renderCount(data.count || 0);
            renderToolbar();
            renderList();
        } catch (e) {
            console.error('[inbox] load error:', e);
            listEl.innerHTML = `<div class="hub-error"><i class="fas fa-triangle-exclamation"></i> Could not load inbox: ${escapeHtml(e.message)}</div>`;
        }
    }

    function renderCount(n) {
        const el = document.getElementById('inboxCount');
        if (!el) return;
        el.textContent = n > 0 ? n : '';
        el.style.display = n > 0 ? '' : 'none';
    }

    // ------------------------------------------------------------ toolbar
    function renderToolbar() {
        const el = document.getElementById('questionsToolbar');
        if (!el) return;

        const policies = Array.from(new Set(state.questions.map(q => q.Policy_ID))).sort();
        const policyTitles = new Map(state.questions.map(q => [q.Policy_ID, q.Policy_Title]));

        const authors = Array.from(new Set(state.questions.map(q => q.Author_Name))).filter(Boolean).sort();

        el.innerHTML = `
            <div class="questions-toolbar-group">
                <label class="questions-toolbar-label">Sort</label>
                <select id="sortSelect" class="questions-select">
                    <option value="oldest" ${state.sort === 'oldest' ? 'selected' : ''}>Oldest waiting</option>
                    <option value="newest" ${state.sort === 'newest' ? 'selected' : ''}>Newest first</option>
                </select>
            </div>
            <div class="questions-toolbar-group">
                <label class="questions-toolbar-label">Policy</label>
                <select id="policyFilter" class="questions-select">
                    <option value="all">All policies</option>
                    ${policies.map(pid => `<option value="${escapeHtml(pid)}" ${state.filterPolicy === pid ? 'selected' : ''}>${escapeHtml(policyTitles.get(pid) || pid)}</option>`).join('')}
                </select>
            </div>
            <div class="questions-toolbar-group">
                <label class="questions-toolbar-label">Author</label>
                <select id="authorFilter" class="questions-select">
                    <option value="all">Anyone</option>
                    ${authors.map(a => `<option value="${escapeHtml(a)}" ${state.filterAuthor === a ? 'selected' : ''}>${escapeHtml(a)}</option>`).join('')}
                </select>
            </div>
            <div class="questions-toolbar-group">
                <label class="questions-toolbar-label">Age</label>
                <select id="ageFilter" class="questions-select">
                    <option value="all">Any age</option>
                    <option value="over-3-days" ${state.filterAge === 'over-3-days' ? 'selected' : ''}>Over 3 days</option>
                    <option value="over-7-days" ${state.filterAge === 'over-7-days' ? 'selected' : ''}>Over 7 days</option>
                </select>
            </div>
        `;

        el.querySelector('#sortSelect').addEventListener('change', e => { state.sort = e.target.value; renderList(); });
        el.querySelector('#policyFilter').addEventListener('change', e => { state.filterPolicy = e.target.value; renderList(); });
        el.querySelector('#authorFilter').addEventListener('change', e => { state.filterAuthor = e.target.value; renderList(); });
        el.querySelector('#ageFilter').addEventListener('change', e => { state.filterAge = e.target.value; renderList(); });
    }

    // ------------------------------------------------------------- list
    function applyFilters(list) {
        let out = list.slice();
        if (state.filterPolicy !== 'all') out = out.filter(q => q.Policy_ID === state.filterPolicy);
        if (state.filterAuthor !== 'all') out = out.filter(q => q.Author_Name === state.filterAuthor);
        if (state.filterAge === 'over-3-days') out = out.filter(q => daysOpen(q.Created_At) >= 3);
        if (state.filterAge === 'over-7-days') out = out.filter(q => daysOpen(q.Created_At) >= 7);

        if (state.sort === 'newest') {
            out.sort((a, b) => new Date(b.Created_At) - new Date(a.Created_At));
        } else {
            out.sort((a, b) => new Date(a.Created_At) - new Date(b.Created_At));
        }
        return out;
    }

    function renderList() {
        const el = document.getElementById('questionsList');
        if (!el) return;

        const filtered = applyFilters(state.questions);

        if (state.questions.length === 0) {
            el.innerHTML = `
                <div class="inbox-zero">
                    <i class="fas fa-circle-check"></i>
                    <h2>Inbox zero</h2>
                    <p>No open questions. Either everyone's caught up or no one's asking.</p>
                </div>
            `;
            return;
        }

        if (filtered.length === 0) {
            el.innerHTML = `
                <div class="inbox-zero inbox-zero-filtered">
                    <i class="fas fa-filter"></i>
                    <h2>No matches</h2>
                    <p>No questions match the current filters. <a href="#" id="clearFilters">Clear filters</a></p>
                </div>
            `;
            const clear = el.querySelector('#clearFilters');
            if (clear) clear.addEventListener('click', e => {
                e.preventDefault();
                state.filterPolicy = 'all';
                state.filterAuthor = 'all';
                state.filterAge = 'all';
                renderToolbar();
                renderList();
            });
            return;
        }

        el.innerHTML = filtered.map(renderCard).join('');
        wireCardActions();
    }

    function renderCard(q) {
        const days = daysOpen(q.Created_At);
        const isStale = days >= 3;
        const isVeryStale = days >= 7;
        const ageClass = isVeryStale ? 'card-very-stale' : isStale ? 'card-stale' : '';

        const policyUrl = `/pages/policy-detail.html?id=${encodeURIComponent(q.Policy_ID)}#comment-${encodeURIComponent(q.Comment_ID)}`;
        const bodyHtml = escapeHtml(q.Body || '').split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

        return `
            <article class="question-card ${ageClass}" data-comment-id="${escapeHtml(q.Comment_ID)}">
                <div class="question-card-header">
                    <div class="question-author">
                        <div class="question-avatar" style="background:${authorColor(q.Author_Name)}">${escapeHtml(authorInitials(q.Author_Name))}</div>
                        <div>
                            <div class="question-author-name">${escapeHtml(q.Author_Name || 'Anonymous')}</div>
                            <div class="question-author-email">${escapeHtml(q.Author_Email || '')}</div>
                        </div>
                    </div>
                    <div class="question-age">
                        <i class="fas fa-clock"></i> Waiting ${escapeHtml(relativeTime(q.Created_At))}
                    </div>
                </div>

                <div class="question-body">${bodyHtml}</div>

                <div class="question-policy">
                    <span class="question-policy-label">On:</span>
                    <a href="${policyUrl}" class="question-policy-link">${escapeHtml(q.Policy_Title)}</a>
                    <span class="question-policy-category">
                        <i class="fas ${categoryIcon(q.Policy_Category)}"></i> ${escapeHtml(q.Policy_Category)}
                    </span>
                </div>

                <div class="question-actions">
                    <a href="${policyUrl}" class="btn btn-primary question-reply-btn">
                        <i class="fas fa-reply"></i> Reply on policy
                    </a>
                    <button type="button" class="btn btn-secondary question-resolve-btn" data-action="resolve" data-id="${escapeHtml(q.Comment_ID)}">
                        <i class="fas fa-check"></i> Mark resolved
                    </button>
                    <button type="button" class="btn btn-secondary question-hide-btn" data-action="hide" data-id="${escapeHtml(q.Comment_ID)}">
                        <i class="fas fa-eye-slash"></i> Hide
                    </button>
                </div>
            </article>
        `;
    }

    function wireCardActions() {
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                if (action === 'resolve') {
                    if (!confirm('Mark this question as resolved? It will be removed from the inbox.')) return;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Resolving…';
                    await adminAction(`/${encodeURIComponent(id)}/resolve`, 'POST');
                } else if (action === 'hide') {
                    if (!confirm('Hide this question? Hidden comments stay in Caspio for audit but no one sees them.')) return;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Hiding…';
                    await adminAction(`/${encodeURIComponent(id)}`, 'DELETE');
                }
                // Reload the inbox after either action
                await loadInbox();
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

    // -------------------------------------------------------------- init
    function init() {
        // Wait for admin gate to resolve so we know who we are
        if (document.documentElement.classList.contains('is-policies-admin') || window.IS_POLICIES_ADMIN) {
            loadInbox();
            return;
        }
        // Listen once for the gate to resolve
        let fired = false;
        document.addEventListener('policies:admin-resolved', () => {
            if (fired) return;
            fired = true;
            if (window.IS_POLICIES_ADMIN) {
                loadInbox();
            } else {
                document.getElementById('questionsLockedNote').style.display = '';
                document.getElementById('questionsList').style.display = 'none';
                document.getElementById('questionsToolbar').style.display = 'none';
            }
        }, { once: true });

        // Failsafe — if the gate never fires (e.g. /api/crm-session/me failed),
        // try to load anyway after 2.5s. Backend will 401 if no session.
        setTimeout(() => {
            if (!fired) {
                fired = true;
                loadInbox();
            }
        }, 2500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.PolicyQuestionsInbox = { reload: loadInbox };
})();
