/**
 * Policies Hub — main page controller
 *
 * Renders:
 *   - Left tree sidebar (Category → Policy → Sub-procedure, 3 levels max)
 *   - Main card grid + list-view toggle
 *   - Debounced search box (hits /api/policies-public/search)
 *   - Category filter chips
 *   - Recently Updated rail
 *   - Admin-only "+ New Policy" button (rendered after admin gate resolves)
 *
 * Depends on: PoliciesAPI, PoliciesAdminGate (loaded as separate <script>s).
 */
(function () {
    'use strict';
    const PoliciesAPI = window.PoliciesAPI;

    let storageUnavailable = false;
    let savedView = 'grid';
    try { savedView = localStorage.getItem('policies_view') === 'list' ? 'list' : 'grid'; }
    catch (error) { storageUnavailable = true; }
    let treeGeneration = 0;
    let searchGeneration = 0;
    const state = {
        tree: [],              // [{category, policies: [{..., children: [...]}]}]
        flatById: new Map(),   // policy_id -> record
        viewMode: savedView,
        categoryFilter: 'all',
        searchQuery: '',
        searchResults: null,   // null = not searching; array = active search
        statusFilter: 'Published', // (legacy, unused)
        showArchived: false    // admin toggle — archived policies hidden by default
    };

    // ----------------------------- helpers -----------------------------
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function categoryIcon(cat) {
        const map = {
            'Financial': 'fa-dollar-sign',
            'Operations': 'fa-cogs',
            'Customer Service': 'fa-headset',
            'Marketing': 'fa-bullhorn',
            'HR': 'fa-users',
            'Training': 'fa-graduation-cap'
        };
        return map[cat] || 'fa-folder';
    }

    function debounce(fn, ms) {
        let t = null;
        return function (...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    function isArchived(p) {
        return !!p && (p.Status === 'Archived' || p.Is_Active === false || p.Is_Active === 'false' || p.Is_Active === 0);
    }

    // ----------------------------- data load -----------------------------
    async function loadTree() {
        const generation = ++treeGeneration;
        try {
            const useAdmin = window.IS_POLICIES_ADMIN;
            const result = useAdmin
                ? await PoliciesAPI.adminGetTree()
                : await PoliciesAPI.getTree();

            if (generation !== treeGeneration) return;
            if (!result || !Array.isArray(result.tree)) throw new Error('Unexpected policy catalogue format');
            state.tree = result.tree;

            // Build flat index for quick lookup
            state.flatById.clear();
            const walk = (node) => {
                state.flatById.set(node.Policy_ID, node);
                (node.children || []).forEach(walk);
            };
            state.tree.forEach(cat => cat.policies.forEach(walk));

            render();
        } catch (e) {
            if (generation !== treeGeneration) return;
            console.error('[policies-hub] loadTree error:', e);
            renderError('Could not load policies. Please refresh.');
        }
    }

    // ----------------------------- rendering -----------------------------
    function render() {
        renderTreeSidebar();
        renderCategoryChips();
        renderCards();
        renderRecentlyUpdated();
        renderAdminAffordances();
    }

    function renderError(msg, retry = loadTree) {
        for (const id of ['policiesGrid', 'policiesList']) {
            const panel = document.getElementById(id);
            if (!panel) continue;
            panel.innerHTML = `<div class="hub-error" role="alert"><p>${escapeHtml(msg)}</p><button class="btn" type="button">Retry</button></div>`;
            panel.querySelector('button').addEventListener('click', retry);
        }
        applyViewMode();
    }

    function showStorageNotice() {
        if (document.querySelector('.policy-storage-notice')) return;
        const note = document.createElement('p');
        note.className = 'policy-storage-notice'; note.setAttribute('role', 'status');
        note.textContent = 'Your view preference could not be saved. You can still browse policies and switch views.';
        document.querySelector('.hub-page-header').append(note);
    }

    function renderTreeSidebar() {
        const el = document.getElementById('treeSidebar');
        if (!el) return;

        if (state.tree.length === 0) {
            el.innerHTML = '<div class="tree-empty">No policies yet.</div>';
            return;
        }

        const rowsHtml = state.tree.map(cat => {
            const vis = cat.policies.filter(p => state.showArchived || !isArchived(p));
            if (vis.length === 0) return '';
            const policiesHtml = vis.map(p => renderTreeNode(p, 1)).join('');
            return `
                <details class="tree-cat" open>
                    <summary>
                        <i class="fas ${categoryIcon(cat.category)}" aria-hidden="true"></i>
                        <span>${escapeHtml(cat.category)}</span>
                        <span class="tree-count">${vis.length}</span>
                    </summary>
                    <ul class="tree-list">${policiesHtml}</ul>
                </details>
            `;
        }).join('');

        // eslint-disable-next-line no-unsanitized/property -- Composed UI markup: external labels are escaped or encoded; other values are fixed markup or numeric counts.
        el.innerHTML = rowsHtml;
    }

    function renderTreeNode(node, depth) {
        const visChildren = (node.children || []).filter(c => state.showArchived || !isArchived(c));
        const hasChildren = visChildren.length > 0;
        const isExternal = !!node.External_URL;
        const isDraft = node.Status === 'Draft';
        const archived = isArchived(node);
        const href = `/pages/policy-detail.html?id=${encodeURIComponent(node.Policy_ID)}`;

        const linkClass = ['tree-link'];
        if (isDraft) linkClass.push('is-draft');
        if (archived) linkClass.push('is-archived');
        if (isExternal) linkClass.push('is-external');

        const externalBadge = isExternal ? '<i class="fas fa-external-link-alt tree-external-icon" aria-label="External" aria-hidden="true"></i>' : '';
        const draftBadge = isDraft ? '<span class="tree-badge tree-badge-draft">Draft</span>' : '';
        const archivedBadge = archived ? '<span class="tree-badge tree-badge-archived">Archived</span>' : '';

        if (hasChildren && depth < 3) {
            const childrenHtml = visChildren.map(c => renderTreeNode(c, depth + 1)).join('');
            return `
                <li class="tree-item tree-item-parent">
                    <a class="${linkClass.join(' ')}" href="${href}">${escapeHtml(node.Title)}${externalBadge}${draftBadge}${archivedBadge}</a>
                    <details>
                        <summary aria-label="Sub-procedures for ${escapeHtml(node.Title)}">
                            Sub-procedures (${visChildren.length})
                        </summary>
                        <ul class="tree-list tree-list-nested">${childrenHtml}</ul>
                    </details>
                </li>
            `;
        }

        return `
            <li class="tree-item">
                <a class="${linkClass.join(' ')}" href="${href}">${escapeHtml(node.Title)}${externalBadge}${draftBadge}${archivedBadge}</a>
            </li>
        `;
    }

    function renderCategoryChips() {
        const el = document.getElementById('categoryChips');
        if (!el) return;

        const counts = { all: 0 };
        state.tree.forEach(cat => {
            const n = cat.policies.filter(p => state.showArchived || !isArchived(p)).length;
            counts[cat.category] = n;
            counts.all += n;
        });

        const allCats = ['Financial', 'Operations', 'Customer Service', 'Marketing', 'HR', 'Training'];
        const chips = [
            { key: 'all', label: 'All Policies', icon: 'fa-layer-group' },
            ...allCats.map(c => ({ key: c, label: c, icon: categoryIcon(c) }))
        ];

        // eslint-disable-next-line no-unsanitized/property -- Composed UI markup: external labels are escaped or encoded; other values are fixed markup or numeric counts.
        el.innerHTML = chips.map(c => `
            <button type="button" aria-pressed="${state.categoryFilter === c.key}" class="category-chip ${state.categoryFilter === c.key ? 'active' : ''}" data-category="${escapeHtml(c.key)}">
                <i class="fas ${c.icon}" aria-hidden="true"></i>
                ${escapeHtml(c.label)}
                <span class="count">${counts[c.key] || 0}</span>
            </button>
        `).join('');

        el.querySelectorAll('.category-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                searchGeneration++;
                state.categoryFilter = chip.dataset.category;
                state.searchResults = null;
                const searchInput = document.getElementById('hubSearch');
                if (searchInput) searchInput.value = '';
                state.searchQuery = '';
                render();
                Array.from(document.querySelectorAll('.category-chip')).find(button => button.dataset.category === state.categoryFilter)?.focus();
            });
        });
    }

    function renderCards() {
        const grid = document.getElementById('policiesGrid');
        const list = document.getElementById('policiesList');
        if (!grid || !list) return;

        // Determine the policies to render
        let policies;
        if (state.searchResults !== null) {
            policies = state.searchResults;
        } else {
            // Collect top-level policies from tree (sub-procedures shown inside detail page)
            policies = [];
            state.tree.forEach(cat => {
                if (state.categoryFilter === 'all' || state.categoryFilter === cat.category) {
                    cat.policies.forEach(p => { if (state.showArchived || !isArchived(p)) policies.push(p); });
                }
            });
        }

        if (policies.length === 0) {
            const msg = state.searchResults !== null
                ? `No policies match "${escapeHtml(state.searchQuery)}".`
                : 'No policies in this category yet.';
            // eslint-disable-next-line no-unsanitized/property -- Composed UI markup: external labels are escaped or encoded; other values are fixed markup or numeric counts.
            grid.innerHTML = `<div class="hub-empty"><i class="far fa-folder-open" aria-hidden="true"></i> ${msg}</div>`;
            // eslint-disable-next-line no-unsanitized/property -- Restores or copies this controller’s own already-escaped UI markup.
            list.innerHTML = grid.innerHTML;
            applyViewMode();
            return;
        }

        // Grid view
        // eslint-disable-next-line no-unsanitized/property -- Composed UI markup: external labels are escaped or encoded; other values are fixed markup or numeric counts.
        grid.innerHTML = policies.map(renderCard).join('');

        // List view
        // eslint-disable-next-line no-unsanitized/property -- Composed UI markup: external labels are escaped or encoded; other values are fixed markup or numeric counts.
        list.innerHTML = `
            <div class="policy-list-header">
                <span>Policy</span>
                <span>Category</span>
                <span>Updated</span>
                <span>Owner</span>
            </div>
            ${policies.map(renderListItem).join('')}
        `;

        // Apply current view mode
        applyViewMode();
    }

    function renderCard(p) {
        const isExternal = !!p.External_URL;
        const href = `/pages/policy-detail.html?id=${encodeURIComponent(p.Policy_ID)}`;
        const isDraft = p.Status === 'Draft';
        const archived = isArchived(p);

        return `
            <a href="${href}" class="policy-card ${isDraft ? 'is-draft' : ''} ${archived ? 'is-archived' : ''}" data-category="${escapeHtml(p.Category)}">
                ${archived ? '<span class="policy-flag flag-archived">ARCHIVED</span>' : ''}
                ${isDraft ? '<span class="policy-flag flag-draft">DRAFT</span>' : ''}
                ${isExternal ? '<span class="policy-flag flag-external"><i class="fas fa-external-link-alt" aria-hidden="true"></i> External</span>' : ''}
                <span class="policy-category-tag">
                    <i class="fas ${categoryIcon(p.Category)}" aria-hidden="true"></i> ${escapeHtml(p.Category)}
                </span>
                <h3 class="policy-title">${escapeHtml(p.Title)}</h3>
                <p class="policy-description">${escapeHtml(p.Summary || '')}</p>
                <div class="policy-meta">
                    <span class="policy-updated">
                        <i class="far fa-calendar" aria-hidden="true"></i> ${formatDate(p.Updated_At || p.Created_At)}
                    </span>
                    <span class="policy-owner">
                        <i class="far fa-user" aria-hidden="true"></i> ${escapeHtml(p.Owner_Name || '—')}
                    </span>
                </div>
            </a>
        `;
    }

    function renderListItem(p) {
        const href = `/pages/policy-detail.html?id=${encodeURIComponent(p.Policy_ID)}`;
        const isDraft = p.Status === 'Draft';
        const archived = isArchived(p);
        return `
            <a href="${href}" class="policy-list-item ${archived ? 'is-archived' : ''}" data-category="${escapeHtml(p.Category)}">
                <span class="policy-list-title">
                    ${escapeHtml(p.Title)}
                    ${isDraft ? '<span class="policy-flag flag-draft">DRAFT</span>' : ''}
                    ${archived ? '<span class="policy-flag flag-archived">ARCHIVED</span>' : ''}
                </span>
                <span class="policy-list-category">${escapeHtml(p.Category)}</span>
                <span class="policy-list-date">${formatDate(p.Updated_At || p.Created_At)}</span>
                <span class="policy-list-owner">${escapeHtml(p.Owner_Name || '—')}</span>
            </a>
        `;
    }

    function renderRecentlyUpdated() {
        const el = document.getElementById('recentItems');
        if (!el) return;

        const flat = [];
        state.flatById.forEach(p => flat.push(p));
        const sorted = flat
            .filter(p => p.Status !== 'Archived')
            .sort((a, b) => new Date(b.Updated_At || b.Created_At) - new Date(a.Updated_At || a.Created_At))
            .slice(0, 4);

        if (sorted.length === 0) {
            el.innerHTML = '<div class="recent-empty">Nothing updated yet.</div>';
            return;
        }

        // eslint-disable-next-line no-unsanitized/property -- Composed UI markup: external labels are escaped or encoded; other values are fixed markup or numeric counts.
        el.innerHTML = sorted.map(p => {
            const href = `/pages/policy-detail.html?id=${encodeURIComponent(p.Policy_ID)}`;
            return `
                <a href="${href}" class="recent-item">
                    <span class="recent-item-title">${escapeHtml(p.Title)}</span>
                    <span class="recent-item-date">${formatDate(p.Updated_At || p.Created_At)}</span>
                </a>
            `;
        }).join('');
    }

    function renderAdminAffordances() {
        const btn = document.getElementById('newPolicyBtn');
        const draftToggle = document.getElementById('draftToggle');
        const archivedToggleWrap = document.getElementById('archivedToggleWrap');
        const badge = document.getElementById('questionsBadge');
        if (btn) btn.hidden = !window.IS_POLICIES_ADMIN;
        if (draftToggle) draftToggle.hidden = !window.IS_POLICIES_ADMIN;
        if (archivedToggleWrap) archivedToggleWrap.hidden = !window.IS_POLICIES_ADMIN;
        if (badge) badge.hidden = !window.IS_POLICIES_ADMIN;
        if (window.IS_POLICIES_ADMIN) loadQuestionsBadge();
    }

    // Fetch the open-questions count from the admin inbox endpoint and
    // update the topbar badge. An unavailable count must not look like zero.
    async function loadQuestionsBadge() {
        const badge = document.getElementById('questionsBadge');
        const countEl = document.getElementById('questionsBadgeCount');
        if (!badge || !countEl) return;
        try {
            const res = await fetch('/api/crm-proxy/policy-comments/inbox/count', { credentials: 'same-origin' });
            if (!res.ok) throw new Error('Question count unavailable');
            const data = await res.json();
            const n = data.count;
            if (!Number.isInteger(n) || n < 0) throw new Error('Invalid question count');
            countEl.textContent = n;
            badge.classList.toggle('has-questions', n > 0);
            badge.title = n === 0
                ? 'No open questions — inbox zero'
                : `${n} open question${n === 1 ? '' : 's'} waiting`;
        } catch (e) {
            countEl.textContent = '?';
            badge.classList.remove('has-questions');
            badge.title = 'Question count unavailable. Open the inbox to retry.';
            badge.setAttribute('aria-label', badge.title);
        }
    }

    // ----------------------------- view modes -----------------------------
    function applyViewMode() {
        const grid = document.getElementById('policiesGrid');
        const list = document.getElementById('policiesList');
        const buttons = document.querySelectorAll('.view-toggle-btn');
        if (!grid || !list) return;

        if (state.viewMode === 'list') {
            grid.classList.add('hidden');
            list.classList.add('active');
        } else {
            grid.classList.remove('hidden');
            list.classList.remove('active');
        }
        buttons.forEach(b => {
            b.classList.toggle('active', b.dataset.view === state.viewMode);
            b.setAttribute('aria-pressed', String(b.dataset.view === state.viewMode));
        });
    }

    // ----------------------------- events -----------------------------
    function wireEvents() {
        // Search (debounced 300ms)
        const searchInput = document.getElementById('hubSearch');
        if (searchInput) {
            const onSearch = debounce(async () => {
                const generation = ++searchGeneration;
                const q = searchInput.value.trim();
                state.searchQuery = q;
                if (!q) {
                    state.searchResults = null;
                    render();
                    return;
                }
                try {
                    const result = await PoliciesAPI.searchPolicies(q);
                    if (generation !== searchGeneration) return;
                    if (!result || !Array.isArray(result.policies)) throw new Error('Unexpected search response');
                    state.searchResults = result.policies;
                    render();
                } catch (e) {
                    if (generation !== searchGeneration) return;
                    console.error('[policies-hub] search error:', e);
                    renderError('Could not search policies. Your search has been kept.', () => searchInput.dispatchEvent(new Event('input')));
                }
            }, 300);
            searchInput.addEventListener('input', onSearch);
        }

        // View toggle (grid / list)
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.viewMode = btn.dataset.view;
                try { localStorage.setItem('policies_view', state.viewMode); }
                catch (error) { showStorageNotice(); }
                applyViewMode();
            });
        });

        // Show-archived toggle (admin)
        const archChk = document.getElementById('archivedToggle');
        if (archChk) {
            archChk.addEventListener('change', () => {
                state.showArchived = archChk.checked;
                render();
            });
        }

        // New Policy button
        const newBtn = document.getElementById('newPolicyBtn');
        if (newBtn) {
            newBtn.addEventListener('click', () => {
                window.location.href = '/pages/policy-detail.html?id=new&edit=1';
            });
        }

        // AI Search button — opens the Claude-powered semantic search modal
        const aiBtn = document.getElementById('aiSearchBtn');
        if (aiBtn) {
            aiBtn.addEventListener('click', () => {
                if (window.PolicyAISearch && typeof window.PolicyAISearch.open === 'function') {
                    window.PolicyAISearch.open();
                } else {
                    alert('AI search not ready yet. Refresh and try again.');
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            const meta = e.metaKey || e.ctrlKey;

            // Cmd/Ctrl+K → focus search input (universal "open quick-find" shortcut)
            if (meta && !e.shiftKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                const s = document.getElementById('hubSearch');
                if (s) { s.focus(); s.select(); }
                return;
            }

            // "/" → also focuses search (when not already in a text field)
            if (e.key === '/' && !meta && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                const s = document.getElementById('hubSearch');
                if (s) s.focus();
                return;
            }

            // Cmd/Ctrl+N → new policy (admin only)
            if (meta && !e.shiftKey && e.key.toLowerCase() === 'n') {
                if (window.IS_POLICIES_ADMIN) {
                    e.preventDefault();
                    window.location.href = '/pages/policy-detail.html?id=new&edit=1';
                }
                return;
            }

            // Escape → clear search if focused
            if (e.key === 'Escape') {
                const s = document.getElementById('hubSearch');
                if (s && document.activeElement === s) {
                    s.value = '';
                    s.dispatchEvent(new Event('input'));
                    s.blur();
                }
            }
        });
    }

    // ----------------------------- init -----------------------------
    function init() {
        if (storageUnavailable) showStorageNotice();
        wireEvents();
        loadTree();
    }

    document.addEventListener('policies:admin-resolved', () => {
        renderAdminAffordances();
        // Reload tree in case admin sees drafts the public view doesn't
        if (window.IS_POLICIES_ADMIN) loadTree();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
