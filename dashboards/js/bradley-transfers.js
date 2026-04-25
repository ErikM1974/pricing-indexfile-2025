/* Bradley's Transfer Queue — Supacolor dashboard
 *
 * Polls /api/transfer-orders every 60s. Filters client-side for responsiveness.
 * Rush transfers pinned to top. Click card → /pages/transfer-detail.html?id=<ID_Transfer>.
 *
 * Depends on: bradley-transfers.css, art-hub.css (for minimal-header, tab-container)
 * API:        caspio-pricing-proxy /api/transfer-orders (see src/routes/transfer-orders.js)
 */

(function () {
    'use strict';

    // ── Config ───────────────────────────────────────────────────────
    var API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    var POLL_INTERVAL_MS = 60 * 1000;
    var AGE_WARN_HOURS = 24;      // yellow after 1 day
    var AGE_CRITICAL_HOURS = 72;  // red after 3 days

    // ── State ────────────────────────────────────────────────────────
    var state = {
        allTransfers: [],
        filteredTransfers: [],
        stats: {},
        filters: {
            status: '',
            search: '',
            rep: '',
            rushOnly: false,
            requesterEmails: []  // list of aliases to match (set by ?view= handler)
        },
        viewMode: 'default',     // 'default' | 'steve'
        pollTimer: null
    };

    // ── DOM helpers ──────────────────────────────────────────────────
    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ── API ──────────────────────────────────────────────────────────
    async function fetchTransfers() {
        try {
            var resp = await fetch(API_BASE + '/api/transfer-orders?pageSize=500&orderBy=Requested_At%20DESC&includeLineCount=true');
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();
            if (!data.success) throw new Error(data.error || 'API returned success=false');
            state.allTransfers = data.records || [];
            return state.allTransfers;
        } catch (err) {
            console.error('Failed to fetch transfers:', err);
            showToast('Unable to load transfers. Please refresh.', 'error');
            throw err;
        }
    }

    async function fetchStats() {
        try {
            var resp = await fetch(API_BASE + '/api/transfer-orders/stats');
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();
            if (!data.success) throw new Error(data.error || 'Stats API returned success=false');
            state.stats = data.stats || {};
            return state.stats;
        } catch (err) {
            console.error('Failed to fetch stats:', err);
            // Non-fatal — dashboard still works without stats chips
        }
    }

    async function hardDeleteTransfer(idTransfer, body) {
        // ?hard=true tells the backend to physically remove the Transfer_Orders row
        // + cascade Transfer_Notes. Does NOT touch Supacolor_Jobs (separate API-owned table).
        // Backend enforces status guard (Requested / On_Hold only).
        var resp = await fetch(
            API_BASE + '/api/transfer-orders/' + encodeURIComponent(idTransfer) + '?hard=true',
            {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }
        );
        var data = await resp.json();
        if (!resp.ok || !data.success) {
            throw new Error(data.error || 'HTTP ' + resp.status);
        }
        return data;
    }

    // ── Rendering ────────────────────────────────────────────────────
    function renderStats() {
        var byId = function (id) { return document.getElementById(id); };

        // When a requester filter is active (e.g. ?view=steve), the
        // server-side state.stats counts ALL transfers — not Steve's. Compute
        // locally from state.allTransfers so the chips reflect the user's
        // own slice. Falls back to state.stats when no filter is set.
        var s;
        var rushCount;
        var rushSource;
        var reqEmails = (state.filters && state.filters.requesterEmails) || [];
        if (reqEmails.length) {
            var lower = reqEmails.map(function (e) { return e.toLowerCase(); });
            var mine = state.allTransfers.filter(function (t) {
                return lower.indexOf((t.Requested_By || '').toLowerCase()) >= 0;
            });
            s = { Requested: 0, Ordered: 0, Shipped: 0 };
            mine.forEach(function (t) {
                if (s[t.Status] !== undefined) s[t.Status] += 1;
            });
            rushSource = mine;
        } else {
            s = state.stats || {};
            rushSource = state.allTransfers;
        }
        if (byId('bt-stat-requested')) byId('bt-stat-requested').textContent = s.Requested || 0;
        if (byId('bt-stat-ordered')) byId('bt-stat-ordered').textContent = s.Ordered || 0;
        if (byId('bt-stat-shipped')) byId('bt-stat-shipped').textContent = s.Shipped || 0;
        // PO_Created + Received chips dropped in v3.1 — guard against missing elements.
        rushCount = rushSource.filter(function (t) {
            return isRush(t) && t.Status !== 'Received' && t.Status !== 'Cancelled';
        }).length;
        if (byId('bt-stat-rush')) byId('bt-stat-rush').textContent = rushCount;
    }

    function isRush(t) {
        // Normalize Caspio Yes/No to boolean (memory pattern: ArtActions.isRush())
        return t.Is_Rush === true || t.Is_Rush === 'true' || t.Is_Rush === 'Yes' || t.Is_Rush === 1;
    }

    function getAgeHours(dateStr) {
        if (!dateStr) return 0;
        // Caspio strips Z suffix — append if missing (memory gotcha)
        var normalized = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
        var created = new Date(normalized);
        return (Date.now() - created.getTime()) / (1000 * 60 * 60);
    }

    function formatAge(hours) {
        if (hours < 1) return 'just now';
        if (hours < 24) return Math.floor(hours) + 'h ago';
        var days = Math.floor(hours / 24);
        return days === 1 ? '1 day ago' : days + ' days ago';
    }

    function ageClass(hours) {
        if (hours >= AGE_CRITICAL_HOURS) return 'bt-card-age--critical';
        if (hours >= AGE_WARN_HOURS) return 'bt-card-age--warn';
        return '';
    }

    function statusBadgeClass(status) {
        var map = {
            'Requested': 'bt-badge--requested',
            'Ordered': 'bt-badge--ordered',
            'PO_Created': 'bt-badge--po',
            'Shipped': 'bt-badge--shipped',
            'Received': 'bt-badge--received',
            'Cancelled': 'bt-badge--cancelled',
            'On_Hold': 'bt-badge--hold'
        };
        return map[status] || 'bt-badge--cancelled';
    }

    function statusLabel(status) {
        if (status === 'PO_Created') return 'PO Created';
        if (status === 'On_Hold') return 'On Hold';
        return status;
    }

    /**
     * Simplified card (v3.1, 2026-04-25). Shows ONLY what Bradley actually
     * needs: ID, age, status, what came from Steve (design#/company/rep/
     * transfer-type), and Supacolor # if auto-link populated it. Dropped:
     * Qty/Size (NULL in v3 paste-links flow), ShopWorks PO# (ShopWorks-side,
     * not Bradley's concern), reorder badge (v3 dropped reorder mode).
     */
    function renderCard(t) {
        var ageHours = getAgeHours(t.Requested_At);
        var rushClass = isRush(t) ? ' bt-card--rush' : '';
        var rushBadge = isRush(t) ? '<span class="bt-badge bt-badge--rush"><i class="fas fa-bolt"></i> RUSH</span>' : '';
        var lineCountPill = (t.line_count && t.line_count > 1)
            ? '<span class="tas-line-count-pill"><i class="fas fa-list-ol"></i> ' + t.line_count + ' transfers</span>'
            : '';

        // Delete menu only pre-Supacolor (before order placed). Post-order
        // → Cancel from the detail page (preserves audit).
        var canDelete = t.Status === 'Requested' || t.Status === 'On_Hold';
        var deleteMenu = canDelete ?
            '<button class="bt-card-menu-btn" data-action="delete" title="Delete (mistake)" aria-label="Delete transfer">' +
                '<i class="fas fa-trash"></i>' +
            '</button>' : '';

        // Subtitle with Steve-provided info: Sales Rep + Transfer Type
        var subtitleParts = [];
        if (t.Sales_Rep_Name || t.Sales_Rep_Email) {
            subtitleParts.push('<i class="fas fa-user"></i> ' + escapeHtml(t.Sales_Rep_Name || t.Sales_Rep_Email));
        }
        if (t.Transfer_Type) {
            subtitleParts.push('<strong>' + escapeHtml(t.Transfer_Type) + '</strong>');
        }
        var subtitle = subtitleParts.length
            ? '<div class="bt-card-subtitle">' + subtitleParts.join(' &middot; ') + '</div>'
            : '';

        // Supacolor # link — shown only after auto-link fires (or manual override).
        // Click handler (in renderGrid below) resolves the numeric ID_Job via
        // /api/supacolor-jobs/by-number and navigates straight to the live
        // Supacolor job detail page. Lazy resolution keeps initial render fast
        // (no N+1 lookups across cards).
        var scLink = t.Supacolor_Order_Number
            ? '<button type="button" class="bt-card-sc-link" data-sc-number="' + escapeHtml(t.Supacolor_Order_Number) + '" title="Open Supacolor job">' +
                'Supacolor #' + escapeHtml(t.Supacolor_Order_Number) + ' <i class="fas fa-external-link-alt"></i>' +
              '</button>'
            : '';

        return '<div class="bt-card' + rushClass + '" data-id="' + escapeHtml(t.ID_Transfer) + '">' +
            '<div class="bt-card-header">' +
                '<span class="bt-card-id">' + escapeHtml(t.ID_Transfer || '') + '</span>' +
                '<div class="bt-card-header-right">' +
                    rushBadge +
                    '<span class="bt-card-age ' + ageClass(ageHours) + '">' + formatAge(ageHours) + '</span>' +
                    '<span class="bt-badge ' + statusBadgeClass(t.Status) + '">' + escapeHtml(statusLabel(t.Status || 'Requested')) + '</span>' +
                    deleteMenu +
                '</div>' +
            '</div>' +
            '<div class="bt-card-body">' +
                '<h3 class="bt-card-title">' +
                    (t.Design_Number ? '#' + escapeHtml(t.Design_Number) + ' &middot; ' : '') +
                    escapeHtml(t.Company_Name || 'No company') +
                '</h3>' +
                subtitle +
                (t.Customer_Name && t.Customer_Name !== t.Company_Name
                    ? '<div class="bt-card-design">' + escapeHtml(t.Customer_Name) + '</div>'
                    : '') +
            '</div>' +
            (scLink || lineCountPill
                ? '<div class="bt-card-footer">' + lineCountPill + scLink + '</div>'
                : '') +
        '</div>';
    }

    function renderGrid() {
        var grid = $('bt-grid');
        var list = state.filteredTransfers;

        if (list.length === 0) {
            grid.innerHTML = '<div class="bt-empty">' +
                '<i class="fas fa-inbox"></i>' +
                '<div>No transfers match your filters.</div>' +
                '</div>';
            $('bt-result-count').textContent = '0 transfers';
            return;
        }

        grid.innerHTML = list.map(renderCard).join('');
        $('bt-result-count').textContent = list.length + ' transfer' + (list.length === 1 ? '' : 's');

        // Wire up card clicks — three click targets, in priority order:
        //   1. Delete button → open hard-delete modal
        //   2. Supacolor # link → resolve numeric ID + navigate to SC job detail
        //   3. Anywhere else on the card → navigate to Transfer detail page
        grid.querySelectorAll('.bt-card').forEach(function (card) {
            card.addEventListener('click', function (e) {
                var deleteBtn = e.target.closest('.bt-card-menu-btn[data-action="delete"]');
                if (deleteBtn) {
                    e.stopPropagation();
                    openDeleteModal(card.getAttribute('data-id'));
                    return;
                }
                var scLink = e.target.closest('.bt-card-sc-link');
                if (scLink) {
                    e.stopPropagation();
                    e.preventDefault();
                    navigateToSupacolorJob(scLink, scLink.getAttribute('data-sc-number'));
                    return;
                }
                var id = card.getAttribute('data-id');
                window.location.href = '/pages/transfer-detail.html?id=' + encodeURIComponent(id);
            });
        });
    }

    /**
     * Resolve a Supacolor_Job_Number (the business key Bradley sees, e.g.
     * "639515") to its numeric ID_Job (Caspio PK), then navigate to the
     * live Supacolor job detail page. Uses the existing
     * /api/supacolor-jobs/by-number/:jobNumber endpoint.
     *
     * Falls back to the Supacolor list page (pre-filtered by search) if
     * resolution fails.
     */
    async function navigateToSupacolorJob(btnEl, jobNumber) {
        if (!jobNumber) return;
        var origLabel = btnEl.innerHTML;
        btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + escapeHtml(jobNumber);
        btnEl.disabled = true;
        try {
            var resp = await fetch(API_BASE + '/api/supacolor-jobs/by-number/' + encodeURIComponent(jobNumber));
            var data = await resp.json();
            // Endpoint returns data.job (not data.record — verified 2026-04-25).
            // Defensively check both shapes in case the contract changes.
            var job = (data && (data.job || data.record)) || null;
            if (resp.ok && data && data.success && job && job.ID_Job) {
                window.location.href = '/pages/supacolor-job-detail.html?id=' + encodeURIComponent(job.ID_Job);
                return;
            }
            // Not found in our local mirror — drop into the list with the
            // jobNumber pre-filled in search so user can find it manually.
            console.warn('[bradley-transfers] Supacolor job #' + jobNumber + ' not found in local mirror; falling back to list view.');
            window.location.href = '/dashboards/supacolor-orders.html?search=' + encodeURIComponent(jobNumber);
        } catch (err) {
            console.error('[bradley-transfers] Supacolor lookup failed:', err);
            btnEl.innerHTML = origLabel;
            btnEl.disabled = false;
            showToast('Could not open Supacolor job: ' + err.message, 'error');
        }
    }

    // ── Filtering ────────────────────────────────────────────────────
    function applyFilters() {
        var f = state.filters;
        var list = state.allTransfers.slice();

        // Steve view shows all statuses by default (he needs to find completed ones too),
        // but respects an explicit status filter if the dropdown is set.
        var suppressTerminalFilter = state.viewMode === 'steve';

        if (f.status) {
            list = list.filter(function (t) { return t.Status === f.status; });
        } else if (!suppressTerminalFilter) {
            // Default: hide terminal statuses unless explicitly selected
            list = list.filter(function (t) {
                return t.Status !== 'Received' && t.Status !== 'Cancelled';
            });
        }

        // Requester filter — drives ?view=steve (matches any alias in the list)
        if (f.requesterEmails && f.requesterEmails.length) {
            var reqSet = f.requesterEmails.map(function (e) { return e.toLowerCase(); });
            list = list.filter(function (t) {
                var by = String(t.Requested_By || '').toLowerCase();
                return reqSet.indexOf(by) >= 0;
            });
        }

        if (f.search) {
            var q = f.search.toLowerCase();
            list = list.filter(function (t) {
                return (t.Company_Name || '').toLowerCase().includes(q) ||
                       (t.Customer_Name || '').toLowerCase().includes(q) ||
                       String(t.Design_Number || '').toLowerCase().includes(q) ||
                       (t.ID_Transfer || '').toLowerCase().includes(q) ||
                       (t.Supacolor_Order_Number || '').toLowerCase().includes(q) ||
                       // v3.1: search now covers rep names + emails too (Rep dropdown removed)
                       (t.Sales_Rep_Name || '').toLowerCase().includes(q) ||
                       (t.Sales_Rep_Email || '').toLowerCase().includes(q);
            });
        }

        // f.rep filter retained for backward compat with any legacy ?view= caller,
        // but the dropdown is gone in v3.1; search-by-text covers rep names.
        if (f.rep) {
            list = list.filter(function (t) { return t.Sales_Rep_Email === f.rep; });
        }

        if (f.rushOnly) {
            list = list.filter(isRush);
        }

        // Rush-first sort, then by Requested_At ascending (oldest first within each bucket)
        list.sort(function (a, b) {
            var rushA = isRush(a) ? 0 : 1;
            var rushB = isRush(b) ? 0 : 1;
            if (rushA !== rushB) return rushA - rushB;
            var dateA = new Date((a.Requested_At || '') + (a.Requested_At && !a.Requested_At.endsWith('Z') ? 'Z' : '')).getTime() || 0;
            var dateB = new Date((b.Requested_At || '') + (b.Requested_At && !b.Requested_At.endsWith('Z') ? 'Z' : '')).getTime() || 0;
            return dateA - dateB;
        });

        state.filteredTransfers = list;
        renderGrid();
    }

    // populateRepFilter() removed in v3.1 — rep is now visible on each card,
    // and search-by-text covers rep names too. The dropdown was overkill for
    // a queue with ~5 unique reps.

    // ── Refresh ──────────────────────────────────────────────────────
    async function refresh() {
        await Promise.all([fetchTransfers(), fetchStats()]);
        renderStats();
        applyFilters();
    }

    // ── Toast ────────────────────────────────────────────────────────
    function showToast(msg, type) {
        var container = $('bt-toast-container');
        var toast = document.createElement('div');
        toast.className = 'bt-toast bt-toast--' + (type || 'info');
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(function () {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity .3s';
            setTimeout(function () { toast.remove(); }, 300);
        }, 4000);
    }

    // ── Delete modal ─────────────────────────────────────────────────
    var deleteTargetId = null;

    function openDeleteModal(idTransfer) {
        deleteTargetId = idTransfer;
        $('bt-delete-modal-target').textContent = idTransfer || 'This transfer';
        $('bt-delete-form').reset();
        $('bt-delete-modal').style.display = 'flex';
    }

    function closeDeleteModal() {
        deleteTargetId = null;
        $('bt-delete-modal').style.display = 'none';
    }

    async function handleDeleteSubmit(e) {
        e.preventDefault();
        if (!deleteTargetId) return;
        var fd = new FormData(e.target);
        if (!fd.get('confirm')) {
            showToast('Please check the confirmation box.', 'error');
            return;
        }
        // Reuse identity set by transfer-detail.html, else default to Bradley (this is his queue)
        var email = localStorage.getItem('transfer_user_email') || 'bradley@nwcustomapparel.com';
        var name = localStorage.getItem('transfer_user_name') || 'Bradley Wright';
        var idToDelete = deleteTargetId;
        try {
            await hardDeleteTransfer(idToDelete, {
                author: email,
                authorName: name,
                reason: fd.get('reason')
            });
            closeDeleteModal();
            showToast('Transfer ' + idToDelete + ' deleted.', 'success');
            await refresh();
        } catch (err) {
            console.error('Delete failed:', err);
            showToast('Delete failed: ' + err.message, 'error');
        }
    }

    // Flash toast reader — catches messages stashed by transfer-detail.html before redirect.
    function readFlashToast() {
        try {
            var raw = sessionStorage.getItem('bt_flash_toast');
            if (!raw) return;
            sessionStorage.removeItem('bt_flash_toast');
            var msg = JSON.parse(raw);
            if (msg && msg.msg) showToast(msg.msg, msg.type || 'info');
        } catch (_) { /* ignore malformed / blocked sessionStorage */ }
    }

    // ── View mode (URL-driven) ──────────────────────────────────────
    // ?view=steve → filters to Steve's submissions only + retitles the page.
    // No UI toggle — it's link-based. Bradley's queue (no param) remains the default.
    function applyViewModeFromUrl() {
        try {
            var params = new URLSearchParams(window.location.search);
            var view = (params.get('view') || '').toLowerCase();
            if (view === 'steve') {
                state.viewMode = 'steve';
                // Steve's email is art@nwcustomapparel.com (shared art dept alias —
                // no individual steve@ address exists).
                state.filters.requesterEmails = ['art@nwcustomapparel.com'];

                // Retitle the queue section + tab button
                var titleEl = document.querySelector('.tab-title');
                if (titleEl) titleEl.innerHTML = '<i class="fas fa-paint-brush" style="color:#4a6fa5;"></i> Steve\u2019s Transfer Submissions';
                var subtitleEl = document.querySelector('.bt-subtitle');
                if (subtitleEl) subtitleEl.textContent = 'Transfers Steve sent to Bradley — follow them through to shipment';
                var tabActive = document.querySelector('.tab-button.active');
                if (tabActive) tabActive.textContent = "Steve's Transfers";

                // Inject "+ Send Another to Bradley" CTA into the header actions
                // row, alongside the existing Refresh button. Saves Steve a
                // bounce back to art-hub-steve when he wants to fire a follow-up.
                injectSendAnotherButton();
            }
        } catch (err) {
            console.warn('[bradley-transfers] applyViewModeFromUrl failed:', err.message);
        }
    }

    // Inject a primary CTA into the header actions row when ?view=steve
    // is active. Clicking opens the same Send-to-Supacolor modal Steve
    // uses on his hub. Keeps Steve on this page for follow-up submissions.
    function injectSendAnotherButton() {
        var actionsRow = document.querySelector('.bt-header-actions');
        if (!actionsRow || document.getElementById('bt-send-another-btn')) return;
        var btn = document.createElement('button');
        btn.id = 'bt-send-another-btn';
        btn.className = 'bt-btn bt-btn--primary';
        btn.title = 'Open the Send-to-Supacolor modal to fire another transfer';
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Another to Bradley';
        btn.addEventListener('click', function () {
            if (!window.TransferActions || typeof window.TransferActions.openSendModal !== 'function') {
                showToast('Send modal isn\'t loaded — refresh the page.', 'error');
                return;
            }
            window.TransferActions.openSendModal({
                requestedBy: { email: 'art@nwcustomapparel.com', name: 'Steve Deland' },
                enableLines: true,
                onSuccess: function (record) {
                    console.log('[?view=steve] transfer created:', record.ID_Transfer);
                    refresh();
                }
            });
        });
        // Place it BEFORE Refresh so it's the leftmost (most prominent) action.
        actionsRow.insertBefore(btn, actionsRow.firstChild);
    }

    // ── Wire Up ──────────────────────────────────────────────────────
    function init() {
        applyViewModeFromUrl();
        // Filter inputs
        $('bt-filter-status').addEventListener('change', function (e) {
            state.filters.status = e.target.value;
            applyFilters();
        });
        $('bt-filter-search').addEventListener('input', function (e) {
            state.filters.search = e.target.value;
            applyFilters();
        });
        // Rep dropdown removed in v3.1 — search-by-text covers rep names
        $('bt-filter-rush-only').addEventListener('change', function (e) {
            state.filters.rushOnly = e.target.checked;
            applyFilters();
        });
        $('bt-filter-clear').addEventListener('click', function () {
            state.filters = { status: '', search: '', rep: '', rushOnly: false };
            $('bt-filter-status').value = '';
            $('bt-filter-search').value = '';
            $('bt-filter-rush-only').checked = false;
            applyFilters();
        });

        // Stats chip clicks → quick-filter by status
        document.querySelectorAll('.bt-stat-chip[data-status]').forEach(function (chip) {
            chip.addEventListener('click', function () {
                var status = chip.getAttribute('data-status');
                state.filters.status = status;
                $('bt-filter-status').value = status;
                applyFilters();
            });
        });
        $('bt-stat-rush-chip').addEventListener('click', function () {
            state.filters.rushOnly = !state.filters.rushOnly;
            $('bt-filter-rush-only').checked = state.filters.rushOnly;
            applyFilters();
        });

        // Header actions
        $('bt-refresh-btn').addEventListener('click', function () {
            refresh();
            showToast('Refreshed.', 'info');
        });

        // Delete modal wiring
        $('bt-delete-modal-close').addEventListener('click', closeDeleteModal);
        $('bt-delete-modal-cancel').addEventListener('click', closeDeleteModal);
        $('bt-delete-modal').addEventListener('click', function (e) {
            if (e.target === $('bt-delete-modal')) closeDeleteModal();
        });
        $('bt-delete-form').addEventListener('submit', handleDeleteSubmit);

        // Catch any flash toast stashed by transfer-detail before redirect (e.g., "deleted")
        readFlashToast();

        // Initial load + poll
        refresh();
        state.pollTimer = setInterval(refresh, POLL_INTERVAL_MS);

        // Stop polling when tab hidden (save API calls)
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
            } else {
                if (!state.pollTimer) {
                    refresh();
                    state.pollTimer = setInterval(refresh, POLL_INTERVAL_MS);
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
