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
            var resp = await fetch(API_BASE + '/api/transfer-orders?pageSize=500&orderBy=Requested_At%20DESC');
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

    async function createTransfer(payload) {
        var resp = await fetch(API_BASE + '/api/transfer-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        var data = await resp.json();
        if (!resp.ok || !data.success) {
            throw new Error(data.error || 'HTTP ' + resp.status);
        }
        return data.record;
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
        var s = state.stats;
        $('bt-stat-requested').textContent = s.Requested || 0;
        $('bt-stat-ordered').textContent = s.Ordered || 0;
        $('bt-stat-po').textContent = s.PO_Created || 0;
        $('bt-stat-shipped').textContent = s.Shipped || 0;
        $('bt-stat-received').textContent = s.Received || 0;
        var rushCount = state.allTransfers.filter(function (t) {
            return isRush(t) && t.Status !== 'Received' && t.Status !== 'Cancelled';
        }).length;
        $('bt-stat-rush').textContent = rushCount;
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

    function renderCard(t) {
        var ageHours = getAgeHours(t.Requested_At);
        var rushClass = isRush(t) ? ' bt-card--rush' : '';
        var rushBadge = isRush(t) ? '<span class="bt-badge bt-badge--rush"><i class="fas fa-bolt"></i> RUSH</span>' : '';

        // Delete menu only available pre-Supacolor (before Bradley places the order).
        // After that, Cancel (from detail page) is the correct action.
        var canDelete = t.Status === 'Requested' || t.Status === 'On_Hold';
        var deleteMenu = canDelete ?
            '<button class="bt-card-menu-btn" data-action="delete" title="Delete (mistake)" aria-label="Delete transfer">' +
                '<i class="fas fa-trash"></i>' +
            '</button>' : '';

        return '<div class="bt-card' + rushClass + '" data-id="' + escapeHtml(t.ID_Transfer) + '">' +
            '<div class="bt-card-header">' +
                '<span class="bt-card-id">' + escapeHtml(t.ID_Transfer || '') + '</span>' +
                '<div class="bt-card-header-right">' +
                    '<span class="bt-card-age ' + ageClass(ageHours) + '">' + formatAge(ageHours) + '</span>' +
                    deleteMenu +
                '</div>' +
            '</div>' +
            '<div>' +
                '<h3 class="bt-card-title">' + escapeHtml(t.Company_Name || 'No company') + '</h3>' +
                '<div class="bt-card-design">' +
                    (t.Design_Number ? 'Design #' + escapeHtml(t.Design_Number) : 'No design #') +
                    (t.Customer_Name ? ' &middot; ' + escapeHtml(t.Customer_Name) : '') +
                '</div>' +
            '</div>' +
            '<div class="bt-card-meta">' +
                '<span class="bt-card-meta-label">Qty:</span>' +
                '<span class="bt-card-meta-value">' + (t.Quantity || '—') +
                    (t.Transfer_Size ? ' &middot; ' + escapeHtml(t.Transfer_Size) : '') + '</span>' +
                '<span class="bt-card-meta-label">Rep:</span>' +
                '<span class="bt-card-meta-value">' + escapeHtml(t.Sales_Rep_Name || t.Sales_Rep_Email || '—') + '</span>' +
                (t.Supacolor_Order_Number ?
                    '<span class="bt-card-meta-label">SC #:</span>' +
                    '<span class="bt-card-meta-value">' + escapeHtml(t.Supacolor_Order_Number) + '</span>' : '') +
                (t.ShopWorks_PO_Number ?
                    '<span class="bt-card-meta-label">PO #:</span>' +
                    '<span class="bt-card-meta-value">' + escapeHtml(t.ShopWorks_PO_Number) + '</span>' : '') +
            '</div>' +
            '<div class="bt-card-footer">' +
                '<span class="bt-badge ' + statusBadgeClass(t.Status) + '">' + escapeHtml(statusLabel(t.Status || 'Requested')) + '</span>' +
                rushBadge +
            '</div>' +
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

        // Wire up card clicks — delete button takes priority; rest of card navigates.
        grid.querySelectorAll('.bt-card').forEach(function (card) {
            card.addEventListener('click', function (e) {
                var deleteBtn = e.target.closest('.bt-card-menu-btn[data-action="delete"]');
                if (deleteBtn) {
                    e.stopPropagation();
                    openDeleteModal(card.getAttribute('data-id'));
                    return;
                }
                var id = card.getAttribute('data-id');
                window.location.href = '/pages/transfer-detail.html?id=' + encodeURIComponent(id);
            });
        });
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
                       (t.ShopWorks_PO_Number || '').toLowerCase().includes(q);
            });
        }

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

    function populateRepFilter() {
        var reps = {};
        state.allTransfers.forEach(function (t) {
            if (t.Sales_Rep_Email) {
                reps[t.Sales_Rep_Email] = t.Sales_Rep_Name || t.Sales_Rep_Email;
            }
        });
        var select = $('bt-filter-rep');
        var current = select.value;
        // Preserve "All Reps" option + add sorted unique reps
        var options = ['<option value="">All Reps</option>'];
        Object.keys(reps).sort(function (a, b) {
            return reps[a].localeCompare(reps[b]);
        }).forEach(function (email) {
            options.push('<option value="' + escapeHtml(email) + '">' + escapeHtml(reps[email]) + '</option>');
        });
        select.innerHTML = options.join('');
        if (current) select.value = current;
    }

    // ── Refresh ──────────────────────────────────────────────────────
    async function refresh() {
        await Promise.all([fetchTransfers(), fetchStats()]);
        populateRepFilter();
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

    // ── New Transfer Modal ───────────────────────────────────────────
    function openNewModal() {
        $('bt-new-modal').style.display = 'flex';
        $('bt-new-transfer-form').reset();
        $('bt-new-rush-details').style.display = 'none';
    }

    function closeNewModal() {
        $('bt-new-modal').style.display = 'none';
    }

    async function handleNewTransferSubmit(e) {
        e.preventDefault();
        var form = e.target;
        var data = new FormData(form);
        var payload = {};
        data.forEach(function (value, key) {
            if (key === 'Is_Rush') {
                payload.Is_Rush = true;
            } else if (key === 'Quantity' || key === 'Press_Count' || key === 'Design_ID' || key === 'Color_Count') {
                if (value) payload[key] = parseInt(value, 10);
            } else if (value) {
                payload[key] = value;
            }
        });
        if (!payload.Is_Rush) payload.Is_Rush = false;

        // Bradley is the requestor when creating manually
        payload.Requested_By = 'bradley@nwcustomapparel.com';
        payload.Requested_By_Name = 'Bradley (manual)';

        try {
            var created = await createTransfer(payload);
            closeNewModal();
            showToast('Transfer ' + (created.ID_Transfer || '') + ' created.', 'success');
            await refresh();
        } catch (err) {
            console.error('Create failed:', err);
            showToast('Could not create transfer: ' + err.message, 'error');
        }
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

                // Hide "New Transfer" button — Steve doesn't create manual entries here
                var newBtn = document.getElementById('bt-new-transfer-btn');
                if (newBtn) newBtn.style.display = 'none';
            }
        } catch (err) {
            console.warn('[bradley-transfers] applyViewModeFromUrl failed:', err.message);
        }
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
        $('bt-filter-rep').addEventListener('change', function (e) {
            state.filters.rep = e.target.value;
            applyFilters();
        });
        $('bt-filter-rush-only').addEventListener('change', function (e) {
            state.filters.rushOnly = e.target.checked;
            applyFilters();
        });
        $('bt-filter-clear').addEventListener('click', function () {
            state.filters = { status: '', search: '', rep: '', rushOnly: false };
            $('bt-filter-status').value = '';
            $('bt-filter-search').value = '';
            $('bt-filter-rep').value = '';
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
        $('bt-new-transfer-btn').addEventListener('click', openNewModal);

        // Modal
        $('bt-new-modal-close').addEventListener('click', closeNewModal);
        $('bt-new-modal-cancel').addEventListener('click', closeNewModal);
        $('bt-new-modal').addEventListener('click', function (e) {
            if (e.target === $('bt-new-modal')) closeNewModal();
        });
        $('bt-new-rush-toggle').addEventListener('change', function (e) {
            $('bt-new-rush-details').style.display = e.target.checked ? '' : 'none';
        });
        $('bt-new-transfer-form').addEventListener('submit', handleNewTransferSubmit);

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
