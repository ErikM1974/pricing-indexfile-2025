/* Bradley's Screen Print Queue
 *
 * Polls /api/transfer-orders?method=Screen%20Print every 60s. Filters client-side.
 * Rush orders pinned to top. Click card → /pages/transfer-detail.html?id=<ID_Transfer>.
 *
 * Mirrors bradley-transfers.js but stripped of Supacolor-specific UI:
 *   - No auto-link / stale-link chip / Supacolor job navigation
 *   - PO row still present (Bradley enters ShopWorks PO# when ordering from L&P)
 *   - All transfers fetched have Method='Screen Print' — backend filters server-side
 *
 * Depends on: bradley-transfers.css, art-hub.css (for minimal-header, tab-container)
 * API:        caspio-pricing-proxy /api/transfer-orders?method=Screen%20Print
 */

(function () {
    'use strict';

    // ── Config ───────────────────────────────────────────────────────
    var API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    var POLL_INTERVAL_MS = 60 * 1000;
    var AGE_WARN_HOURS = 24;
    var AGE_CRITICAL_HOURS = 72;
    var METHOD_FILTER = 'Screen Print';

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
            requesterEmails: []
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

    // Same digit extractor used on Supacolor side — Bradley types whatever
    // ShopWorks gave him; we stamp the canonical "<digits> BW" form server-side.
    function extractPoDigits(poNumber) {
        if (poNumber === null || poNumber === undefined) return null;
        var m = String(poNumber).match(/(\d{5,})/);
        return m ? parseInt(m[1], 10) : null;
    }

    // ── API ──────────────────────────────────────────────────────────
    async function fetchTransfers() {
        try {
            // Backend ?method= filter (proxy v2026.05.07+) — falls back to
            // client-side filter if backend ignores the param. Any row whose
            // Method is 'Supacolor' or null is treated as Supacolor and
            // excluded from this dashboard.
            var url = API_BASE + '/api/transfer-orders?pageSize=500&orderBy=Requested_At%20DESC&includeLineCount=true' +
                '&method=' + encodeURIComponent(METHOD_FILTER);
            var resp = await fetch(url);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();
            if (!data.success) throw new Error(data.error || 'API returned success=false');
            // Defensive client-side filter — drops anything that isn't Screen Print.
            var rows = (data.records || []).filter(function (t) {
                return t.Method === 'Screen Print';
            });
            state.allTransfers = rows;
            return rows;
        } catch (err) {
            console.error('Failed to fetch screen-print orders:', err);
            showToast('Unable to load screen-print queue. Please refresh.', 'error');
            throw err;
        }
    }

    async function hardDeleteTransfer(idTransfer, body) {
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
        // No backend stats endpoint for SP yet — compute locally from the
        // already-filtered allTransfers list. Equivalent to the steve-view
        // path on bradley-transfers.js (server stats include all methods).
        var byId = function (id) { return document.getElementById(id); };
        var s = { Requested: 0, Ordered: 0, Shipped: 0 };
        var rushSource;
        var reqEmails = (state.filters && state.filters.requesterEmails) || [];
        if (reqEmails.length) {
            var lower = reqEmails.map(function (e) { return e.toLowerCase(); });
            rushSource = state.allTransfers.filter(function (t) {
                return lower.indexOf((t.Requested_By || '').toLowerCase()) >= 0;
            });
        } else {
            rushSource = state.allTransfers;
        }
        rushSource.forEach(function (t) {
            if (s[t.Status] !== undefined) s[t.Status] += 1;
        });
        if (byId('bt-stat-requested')) byId('bt-stat-requested').textContent = s.Requested || 0;
        if (byId('bt-stat-ordered')) byId('bt-stat-ordered').textContent = s.Ordered || 0;
        if (byId('bt-stat-shipped')) byId('bt-stat-shipped').textContent = s.Shipped || 0;
        var rushCount = rushSource.filter(function (t) {
            return isRush(t) && t.Status !== 'Received' && t.Status !== 'Cancelled';
        }).length;
        if (byId('bt-stat-rush')) byId('bt-stat-rush').textContent = rushCount;
    }

    function isRush(t) {
        return t.Is_Rush === true || t.Is_Rush === 'true' || t.Is_Rush === 'Yes' || t.Is_Rush === 1;
    }

    function getAgeHours(dateStr) {
        if (!dateStr) return 0;
        var d = window.CaspioDate ? window.CaspioDate.parse(dateStr) : new Date(dateStr);
        if (!d || isNaN(d.getTime())) return 0;
        return (Date.now() - d.getTime()) / (1000 * 60 * 60);
    }

    function formatAge(hours) {
        if (hours < 1) {
            var minutes = Math.floor(hours * 60);
            if (minutes < 1) return 'just now';
            return minutes + 'm ago';
        }
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
            'Shipped': 'bt-badge--shipped',
            'Received': 'bt-badge--received',
            'Cancelled': 'bt-badge--cancelled',
            'On_Hold': 'bt-badge--hold'
        };
        return map[status] || 'bt-badge--cancelled';
    }

    function statusLabel(status) {
        if (status === 'On_Hold') return 'On Hold';
        return status;
    }

    /**
     * Card layout mirrors bradley-transfers.js but drops Supacolor-only chrome:
     *   - No "Link to Supacolor #…" chip / no stale-link warning
     *   - No "Linking…" pending pill (no auto-link cron for SP)
     *   - Vendor badge added (L&P Printing)
     *   - PO row still useful — Bradley enters ShopWorks PO# when ordering from L&P
     */
    function renderCard(t) {
        var ageHours = getAgeHours(t.Requested_At);
        var rushClass = isRush(t) ? ' bt-card--rush' : '';
        var rushBadge = isRush(t) ? '<span class="bt-badge bt-badge--rush"><i class="fas fa-bolt"></i> RUSH</span>' : '';
        var lineCountPill = (t.line_count && t.line_count > 1)
            ? '<span class="tas-line-count-pill"><i class="fas fa-list-ol"></i> ' + t.line_count + ' lines</span>'
            : '';
        var fileCountPill = (t.file_count && t.file_count > 1)
            ? '<span class="bt-pill bt-pill--files"><i class="fas fa-paperclip"></i> ' + t.file_count + ' files</span>'
            : '';

        var thumb;
        if (t.mockup_thumbnail_url) {
            thumb = '<img class="bt-card-thumb" src="' + escapeHtml(t.mockup_thumbnail_url) +
                '" alt="" loading="lazy" onerror="this.classList.add(\'bt-card-thumb--err\');this.removeAttribute(\'src\');">';
        } else {
            thumb = '<div class="bt-card-thumb bt-card-thumb--placeholder"><i class="fas fa-image"></i></div>';
        }

        var canDelete = t.Status === 'Requested' || t.Status === 'On_Hold';
        var deleteMenu = canDelete ?
            '<button class="bt-card-menu-btn" data-action="delete" title="Delete (mistake)" aria-label="Delete order">' +
                '<i class="fas fa-trash"></i>' +
            '</button>' : '';

        // Subtitle: Sales Rep + vendor (always L&P today, but read from row for future-proofing)
        var vendorLabel = t.SP_Vendor || 'L&P Printing';
        var subtitleParts = [];
        if (t.Sales_Rep_Name || t.Sales_Rep_Email) {
            subtitleParts.push('<i class="fas fa-user"></i> ' + escapeHtml(t.Sales_Rep_Name || t.Sales_Rep_Email));
        }
        subtitleParts.push('<strong>' + escapeHtml(vendorLabel) + '</strong>');
        var subtitle = '<div class="bt-card-subtitle">' + subtitleParts.join(' &middot; ') + '</div>';

        // PO row — same UX as Supacolor side, but no auto-link cron expectation.
        // Once Bradley enters PO and marks Ordered, status flips. No "Linking…" state.
        var poDigits = extractPoDigits(t.ShopWorks_PO_Number);
        var poRow;
        if (poDigits) {
            poRow =
                '<div class="bt-card-po">' +
                    '<span class="bt-card-po-label">PO</span>' +
                    '<span class="bt-card-po-number">' + poDigits + ' BW</span>' +
                '</div>';
        } else if (t.Status === 'Requested' || t.Status === 'On_Hold') {
            poRow =
                '<button type="button" class="bt-card-po bt-card-po--empty"' +
                    ' data-action="enter-po"' +
                    ' data-id-transfer="' + escapeHtml(t.ID_Transfer) + '"' +
                    ' title="Enter the ShopWorks PO# to mark this as Ordered">' +
                    '<i class="fas fa-keyboard"></i> Enter PO# to order' +
                '</button>';
        } else {
            poRow = '';
        }

        // Surface SP_Notes preview as a small chip on the card so Bradley can
        // spot orders with special instructions at a glance.
        var spNotesPill = '';
        if (t.SP_Notes) {
            var snippet = String(t.SP_Notes).trim().slice(0, 80);
            if (String(t.SP_Notes).length > 80) snippet += '…';
            spNotesPill = '<span class="bt-pill bt-pill--sp-notes" title="' + escapeHtml(t.SP_Notes) + '">' +
                '<i class="fas fa-sticky-note"></i> ' + escapeHtml(snippet) + '</span>';
        }

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
            '<div class="bt-card-body bt-card-body--with-thumb">' +
                thumb +
                '<div class="bt-card-body-text">' +
                    '<h3 class="bt-card-title">' +
                        (t.Design_Number ? '#' + escapeHtml(t.Design_Number) + ' &middot; ' : '') +
                        escapeHtml(t.Company_Name || 'No company') +
                    '</h3>' +
                    poRow +
                    subtitle +
                    (t.Customer_Name && t.Customer_Name !== t.Company_Name
                        ? '<div class="bt-card-design">' + escapeHtml(t.Customer_Name) + '</div>'
                        : '') +
                '</div>' +
            '</div>' +
            (lineCountPill || fileCountPill || spNotesPill
                ? '<div class="bt-card-footer">' + lineCountPill + fileCountPill + spNotesPill + '</div>'
                : '') +
        '</div>';
    }

    function renderGrid() {
        var grid = $('bt-grid');
        var list = state.filteredTransfers;

        if (list.length === 0) {
            grid.innerHTML = '<div class="bt-empty">' +
                '<i class="fas fa-inbox"></i>' +
                '<div>No screen-print orders match your filters.</div>' +
                '</div>';
            $('bt-result-count').textContent = '0 orders';
            return;
        }

        grid.innerHTML = list.map(renderCard).join('');
        $('bt-result-count').textContent = list.length + ' order' + (list.length === 1 ? '' : 's');

        // Wire card clicks. Three targets, in priority order:
        //   1. Delete button → open hard-delete modal
        //   2. Enter PO# button → navigate to detail page with #enter-po hash
        //   3. Anywhere else → navigate to transfer detail page
        grid.querySelectorAll('.bt-card').forEach(function (card) {
            card.addEventListener('click', function (e) {
                var deleteBtn = e.target.closest('.bt-card-menu-btn[data-action="delete"]');
                if (deleteBtn) {
                    e.stopPropagation();
                    openDeleteModal(card.getAttribute('data-id'));
                    return;
                }
                var enterPoBtn = e.target.closest('.bt-card-po--empty[data-action="enter-po"]');
                if (enterPoBtn) {
                    e.stopPropagation();
                    e.preventDefault();
                    var poTransferId = enterPoBtn.getAttribute('data-id-transfer');
                    window.location.href = '/pages/transfer-detail.html?id=' + encodeURIComponent(poTransferId) + '#enter-po';
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

        var suppressTerminalFilter = state.viewMode === 'steve';

        if (f.status) {
            list = list.filter(function (t) { return t.Status === f.status; });
        } else if (!suppressTerminalFilter) {
            list = list.filter(function (t) {
                return t.Status !== 'Received' && t.Status !== 'Cancelled';
            });
        }

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
                       (t.Sales_Rep_Name || '').toLowerCase().includes(q) ||
                       (t.Sales_Rep_Email || '').toLowerCase().includes(q) ||
                       (t.SP_Notes || '').toLowerCase().includes(q);
            });
        }

        if (f.rep) {
            list = list.filter(function (t) { return t.Sales_Rep_Email === f.rep; });
        }

        if (f.rushOnly) {
            list = list.filter(isRush);
        }

        // Rush-first sort, then oldest first
        list.sort(function (a, b) {
            var rushA = isRush(a) ? 0 : 1;
            var rushB = isRush(b) ? 0 : 1;
            if (rushA !== rushB) return rushA - rushB;
            var dA = window.CaspioDate ? window.CaspioDate.parse(a.Requested_At) : null;
            var dB = window.CaspioDate ? window.CaspioDate.parse(b.Requested_At) : null;
            var dateA = dA ? dA.getTime() : 0;
            var dateB = dB ? dB.getTime() : 0;
            return dateA - dateB;
        });

        state.filteredTransfers = list;
        renderGrid();
    }

    // ── Refresh ──────────────────────────────────────────────────────
    async function refresh() {
        await fetchTransfers();
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
        $('bt-delete-modal-target').textContent = idTransfer || 'This order';
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
            showToast('Order ' + idToDelete + ' deleted.', 'success');
            await refresh();
        } catch (err) {
            console.error('Delete failed:', err);
            showToast('Delete failed: ' + err.message, 'error');
        }
    }

    function readFlashToast() {
        try {
            var raw = sessionStorage.getItem('bt_flash_toast');
            if (!raw) return;
            sessionStorage.removeItem('bt_flash_toast');
            var msg = JSON.parse(raw);
            if (msg && msg.msg) showToast(msg.msg, msg.type || 'info');
        } catch (_) { /* ignore malformed / blocked sessionStorage */ }
    }

    // ── View mode (?view=steve filters to Steve's submissions) ──────
    function applyViewModeFromUrl() {
        try {
            var params = new URLSearchParams(window.location.search);
            var view = (params.get('view') || '').toLowerCase();
            if (view === 'steve') {
                state.viewMode = 'steve';
                state.filters.requesterEmails = ['art@nwcustomapparel.com'];

                var titleEl = document.querySelector('.tab-title');
                if (titleEl) titleEl.innerHTML = '<i class="fas fa-paint-brush" style="color:#4a6fa5;"></i> Steve’s Screen Print Submissions';
                var subtitleEl = document.querySelector('.bt-subtitle');
                if (subtitleEl) subtitleEl.textContent = 'Screen-print orders Steve sent to Bradley for L&P Printing';
                var tabActive = document.querySelector('.tab-button.active');
                if (tabActive) tabActive.textContent = "Steve's Screen Print";

                injectSendAnotherButton();
            }
        } catch (err) {
            console.warn('[bradley-screenprint] applyViewModeFromUrl failed:', err.message);
        }
    }

    function injectSendAnotherButton() {
        var actionsRow = document.querySelector('.bt-header-actions');
        if (!actionsRow || document.getElementById('bt-send-another-btn')) return;
        var btn = document.createElement('button');
        btn.id = 'bt-send-another-btn';
        btn.className = 'bt-btn bt-btn--primary';
        btn.title = 'Open the Send-to-Screen-Print modal to fire another order';
        btn.innerHTML = '<i class="fas fa-print"></i> Send Another to Bradley';
        btn.addEventListener('click', function () {
            if (!window.TransferActions || typeof window.TransferActions.openSendModal !== 'function') {
                showToast('Send modal isn\'t loaded — refresh the page.', 'error');
                return;
            }
            window.TransferActions.openSendModal({
                method: 'Screen Print',
                requestedBy: { email: 'art@nwcustomapparel.com', name: 'Steve Deland' },
                enableLines: true,
                onSuccess: function (record) {
                    console.log('[?view=steve] screen-print order created:', record.ID_Transfer);
                    refresh();
                }
            });
        });
        actionsRow.insertBefore(btn, actionsRow.firstChild);
    }

    // ── Wire Up ──────────────────────────────────────────────────────
    function init() {
        applyViewModeFromUrl();
        $('bt-filter-status').addEventListener('change', function (e) {
            state.filters.status = e.target.value;
            applyFilters();
        });
        $('bt-filter-search').addEventListener('input', function (e) {
            state.filters.search = e.target.value;
            applyFilters();
        });
        $('bt-filter-rush-only').addEventListener('change', function (e) {
            state.filters.rushOnly = e.target.checked;
            applyFilters();
        });
        $('bt-filter-clear').addEventListener('click', function () {
            state.filters = { status: '', search: '', rep: '', rushOnly: false, requesterEmails: state.filters.requesterEmails };
            $('bt-filter-status').value = '';
            $('bt-filter-search').value = '';
            $('bt-filter-rush-only').checked = false;
            applyFilters();
        });

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

        $('bt-refresh-btn').addEventListener('click', function () {
            refresh();
            showToast('Refreshed.', 'info');
        });

        $('bt-delete-modal-close').addEventListener('click', closeDeleteModal);
        $('bt-delete-modal-cancel').addEventListener('click', closeDeleteModal);
        $('bt-delete-modal').addEventListener('click', function (e) {
            if (e.target === $('bt-delete-modal')) closeDeleteModal();
        });
        $('bt-delete-form').addEventListener('submit', handleDeleteSubmit);

        readFlashToast();

        refresh();
        state.pollTimer = setInterval(refresh, POLL_INTERVAL_MS);

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
