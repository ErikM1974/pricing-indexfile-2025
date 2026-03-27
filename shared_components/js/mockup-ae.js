/**
 * mockup-ae.js — AE Mockup Gallery (purple cards)
 *
 * Renders mockup cards in the AE Dashboard "Mockups" tab.
 * Cards link to /mockup/:id?view=ae for approval/review.
 *
 * Usage: MockupAeGallery.init('container-id')
 *
 * Depends on: mockup-ruth.css (reuses card styles), app-config.js
 */
var MockupAeGallery = (function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    var containerId = null;
    var allMockups = [];
    var currentRepFilter = sessionStorage.getItem('ae_dashboard_rep_filter') || 'All';
    var currentSearchText = '';

    var REP_EMAIL_MAP = {
        'Taneisha': 'taneisha@nwcustomapparel.com',
        'Nika': 'nika@nwcustomapparel.com',
        'Ruthie': 'ruthie@nwcustomapparel.com',
        'Erik': 'erik@nwcustomapparel.com'
    };

    function resolveRepName(email) {
        if (!email) return '';
        for (var name in REP_EMAIL_MAP) {
            if (email.toLowerCase() === REP_EMAIL_MAP[name].toLowerCase()) return name;
        }
        var at = email.indexOf('@');
        if (at > 0) return email.substring(0, at).charAt(0).toUpperCase() + email.substring(1, at);
        return email;
    }

    function init(containerIdParam) {
        containerId = containerIdParam;
        var container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '<div style="text-align:center;padding:40px;color:#888;">'
            + '<div class="mockup-loading-spinner" style="width:30px;height:30px;border:3px solid #e5e7eb;border-top-color:#6B46C1;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px;"></div>'
            + 'Loading mockups...</div>';

        fetchMockups();
    }

    function fetchMockups() {
        fetch(API_BASE + '/api/mockups?orderBy=Submitted_Date DESC&limit=200')
            .then(function (r) {
                if (!r.ok) throw new Error('API returned ' + r.status);
                return r.json();
            })
            .then(function (data) {
                allMockups = data.records || [];
                render();
            })
            .catch(function (err) {
                var container = document.getElementById(containerId);
                if (container) {
                    container.innerHTML = '<div style="text-align:center;padding:40px;color:#dc2626;">'
                        + '<strong>Error:</strong> ' + escapeHtml(err.message)
                        + '<br><button onclick="MockupAeGallery.init(\'' + containerId + '\')" '
                        + 'style="margin-top:10px;padding:8px 16px;border:none;border-radius:4px;background:#6B46C1;color:white;cursor:pointer;">Retry</button>'
                        + '</div>';
                }
            });
    }

    function render() {
        var container = document.getElementById(containerId);
        if (!container) return;

        if (allMockups.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#999;">'
                + '<div style="font-size:48px;margin-bottom:12px;">&#128194;</div>'
                + '<div style="font-size:16px;font-weight:500;">No mockup requests yet</div>'
                + '</div>';
            return;
        }

        // Status summary
        var counts = { submitted: 0, inProgress: 0, awaitingApproval: 0, revisionRequested: 0, approved: 0 };
        allMockups.forEach(function (m) {
            var s = (m.Status || '').toLowerCase();
            if (s === 'submitted') counts.submitted++;
            else if (s === 'in progress') counts.inProgress++;
            else if (s === 'awaiting approval') counts.awaitingApproval++;
            else if (s === 'revision requested') counts.revisionRequested++;
            else if (s === 'approved') counts.approved++;
        });

        var html = '<div class="status-summary" style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">';
        if (counts.awaitingApproval > 0) {
            html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa;font-size:14px;cursor:pointer;" onclick="MockupAeGallery.filterByStatus(\'Awaiting Approval\')">'
                + '<span style="font-weight:700;font-size:18px;color:#d97706;">' + counts.awaitingApproval + '</span>'
                + '<span style="font-weight:500;color:#92400e;">Needs Your Review</span></div>';
        }
        html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;background:#f8f5ff;border:1px solid #e9e0f5;font-size:14px;">'
            + '<span style="font-weight:700;font-size:18px;">' + counts.submitted + '</span>'
            + '<span style="font-weight:500;color:#666;">Submitted</span></div>';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;background:#eff6ff;border:1px solid #bfdbfe;font-size:14px;">'
            + '<span style="font-weight:700;font-size:18px;">' + counts.inProgress + '</span>'
            + '<span style="font-weight:500;color:#666;">In Progress</span></div>';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;background:#ecfdf5;border:1px solid #a7f3d0;font-size:14px;">'
            + '<span style="font-weight:700;font-size:18px;">' + counts.approved + '</span>'
            + '<span style="font-weight:500;color:#666;">Approved</span></div>';
        html += '</div>';

        // Search + Rep filter bar
        var repOptions = ['All', 'Taneisha', 'Nika', 'Ruthie', 'Erik'];
        html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;margin:0 0 12px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.08);flex-wrap:wrap;">';
        html += '<input type="text" id="mockup-ae-search" placeholder="Search company, design #..." style="padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;color:#1e293b;width:200px;">';
        html += '<label style="font-size:13px;font-weight:600;color:#64748b;white-space:nowrap;margin-left:8px;">Rep:</label>';
        html += '<select id="mockup-ae-rep-filter" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;color:#1e293b;">';
        repOptions.forEach(function (name) {
            html += '<option value="' + name + '"' + (name === currentRepFilter ? ' selected' : '') + '>' + name + '</option>';
        });
        html += '</select>';
        html += '<span id="mockup-ae-rep-count" style="font-size:12px;color:#94a3b8;margin-left:auto;"></span>';
        html += '</div>';

        // Card grid — filter by rep + search
        var displayMockups = allMockups.filter(function (m) {
            var matchRep = currentRepFilter === 'All' || resolveRepName(m.Submitted_By || '') === currentRepFilter;
            var matchSearch = !currentSearchText || (
                (m.Company_Name || '').toLowerCase().indexOf(currentSearchText) !== -1 ||
                (m.Design_Number || '').toLowerCase().indexOf(currentSearchText) !== -1 ||
                (m.Design_Name || '').toLowerCase().indexOf(currentSearchText) !== -1
            );
            return matchRep && matchSearch;
        });

        html += '<div class="mockup-grid">';
        displayMockups.forEach(function (m) {
            html += buildCard(m);
        });
        html += '</div>';

        container.innerHTML = html;

        // Update count
        var countSpan = document.getElementById('mockup-ae-rep-count');
        if (countSpan) {
            var isFiltered = currentRepFilter !== 'All' || currentSearchText;
            countSpan.textContent = isFiltered
                ? displayMockups.length + ' of ' + allMockups.length + ' mockups'
                : allMockups.length + ' mockups';
        }

        // Wire rep filter change
        var repSelect = document.getElementById('mockup-ae-rep-filter');
        if (repSelect) {
            repSelect.addEventListener('change', function () {
                currentRepFilter = this.value;
                sessionStorage.setItem('ae_dashboard_rep_filter', currentRepFilter);
                render();
            });
        }

        // Wire text search
        var searchInput = document.getElementById('mockup-ae-search');
        if (searchInput) {
            var searchTimer = null;
            searchInput.addEventListener('input', function () {
                clearTimeout(searchTimer);
                var input = this;
                searchTimer = setTimeout(function () {
                    currentSearchText = input.value.trim().toLowerCase();
                    render();
                }, 200);
            });
        }

        // Wire card clicks
        container.querySelectorAll('.mockup-card').forEach(function (card) {
            card.addEventListener('click', function () {
                var id = card.dataset.mockupId;
                if (id) window.location.href = '/mockup/' + id + '?view=ae';
            });
        });
    }

    function buildCard(mockup) {
        var id = mockup.ID;
        var company = escapeHtml(mockup.Company_Name || 'Unknown Company');
        var designNum = escapeHtml(mockup.Design_Number || '—');
        var designName = escapeHtml(mockup.Design_Name || '');
        var status = mockup.Status || 'Submitted';
        var statusClass = 'status-pill--' + status.toLowerCase().replace(/\s+/g, '-');
        var mockupType = escapeHtml(mockup.Mockup_Type || '');
        var submittedDate = formatDate(mockup.Submitted_Date);
        var revCount = mockup.Revision_Count || 0;

        var badges = '';
        if (mockupType) {
            mockupType.split(', ').forEach(function (t) {
                badges += '<span class="card-badge">' + escapeHtml(t.trim()) + '</span>';
            });
        }
        if (revCount > 0) {
            badges += '<span class="card-badge card-badge--revision">Rev ' + revCount + '</span>';
        }

        // Elapsed time badge for all statuses + CTA for awaiting approval
        var elapsedBadge = (typeof ElapsedTimeUtils !== 'undefined')
            ? ElapsedTimeUtils.getStatusElapsedBadge(status, mockup, 'mockup')
            : '';
        var ctaHtml = '';
        if (status === 'Awaiting Approval') {
            ctaHtml = '<div class="card-actions">'
                + '<span style="font-size:12px;color:#d97706;font-weight:600;padding:6px 0;">&#9888; Needs your review</span>'
                + (elapsedBadge ? '<div>' + elapsedBadge + '</div>' : '')
                + '</div>';
        } else if (elapsedBadge) {
            ctaHtml = '<div class="card-actions">' + elapsedBadge + '</div>';
        }

        var thumbUrl = mockup.Box_Mockup_1 || '';
        var thumbHtml = '';
        if (thumbUrl) {
            thumbHtml = '<div class="card-thumb">'
                + '<img src="' + escapeHtml(thumbUrl) + '" alt="Mockup preview" loading="lazy"'
                + ' onerror="this.parentElement.style.display=\'none\';">'
                + '</div>';
        }

        var repName = resolveRepName(mockup.Submitted_By || '');

        return '<div class="mockup-card" data-mockup-id="' + id + '" data-rep="' + escapeHtml(repName) + '" style="cursor:pointer;">'
            + '<div class="card-header">'
            + '  <div class="card-header-left">'
            + '    <div class="card-company">' + company + '</div>'
            + '    <div class="card-design-number">#' + designNum + '</div>'
            + '  </div>'
            + '  <div class="card-header-right">'
            + '    <span class="status-pill ' + statusClass + '">' + escapeHtml(status) + '</span>'
            + '  </div>'
            + '</div>'
            + thumbHtml
            + '<div class="card-body">'
            + (designName ? '<div class="card-design-name">' + designName + '</div>' : '')
            + (badges ? '<div class="card-badges">' + badges + '</div>' : '')
            + (repName ? '<div class="card-meta-row"><span class="card-meta-label">REP</span> ' + escapeHtml(repName) + '</div>' : '')
            + '</div>'
            + '<div class="card-footer">'
            + '  <span class="card-date">' + submittedDate + '</span>'
            + '  <span class="card-action-link">View Details &rarr;</span>'
            + '</div>'
            + ctaHtml
            + '</div>';
    }

    function filterByStatus(status) {
        var container = document.getElementById(containerId);
        if (!container) return;

        var filtered = allMockups.filter(function (m) { return m.Status === status; });

        var html = '<div style="margin-bottom:16px;">'
            + '<button onclick="MockupAeGallery.init(\'' + containerId + '\')" '
            + 'style="padding:6px 14px;border:1px solid #d1d5db;border-radius:4px;background:white;cursor:pointer;font-size:13px;font-family:inherit;">'
            + '&larr; Show All</button>'
            + '<span style="margin-left:12px;font-size:14px;color:#666;">Showing: <strong>' + escapeHtml(status) + '</strong> (' + filtered.length + ')</span>'
            + '</div>';

        html += '<div class="mockup-grid">';
        filtered.forEach(function (m) { html += buildCard(m); });
        html += '</div>';

        container.innerHTML = html;

        container.querySelectorAll('.mockup-card').forEach(function (card) {
            card.addEventListener('click', function () {
                var id = card.dataset.mockupId;
                if (id) window.location.href = '/mockup/' + id + '?view=ae';
            });
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function getElapsedText(date) {
        var now = new Date();
        var diffMs = now - date;
        var diffMins = Math.floor(diffMs / 60000);
        var diffHours = Math.floor(diffMs / 3600000);
        var diffDays = Math.floor(diffMs / 86400000);

        var text, cssClass;
        if (diffMins < 60) {
            text = diffMins <= 1 ? 'just now' : diffMins + ' min ago';
            cssClass = 'approval-elapsed--fresh';
        } else if (diffHours < 24) {
            text = diffHours === 1 ? '1 hr ago' : diffHours + ' hrs ago';
            cssClass = 'approval-elapsed--fresh';
        } else if (diffDays < 3) {
            text = diffDays === 1 ? '1 day ago' : diffDays + ' days ago';
            cssClass = 'approval-elapsed--waiting';
        } else {
            text = diffDays + ' days ago';
            cssClass = 'approval-elapsed--overdue';
        }
        return { text: text, cssClass: cssClass };
    }

    // ── Kanban Board View ───────────────────────────────────────────────
    var kanbanActive = false;
    var KANBAN_DATE_CUTOFF = new Date('2026-03-15');
    var COMPLETED_SHOW_LIMIT = 5;

    var KANBAN_COLUMNS = [
        { id: 'submitted', label: 'Submitted', match: ['Submitted'] },
        { id: 'in-progress', label: 'In Progress', match: ['In Progress'] },
        { id: 'awaiting', label: 'Awaiting Approval', match: ['Awaiting Approval'] },
        { id: 'revision', label: 'Revision Requested', match: ['Revision Requested'] },
        { id: 'approved', label: 'Approved', match: ['Approved'] },
        { id: 'completed', label: 'Completed', match: ['Completed'] }
    ];

    function normalizeStatus(raw) {
        if (!raw || raw === '') return 'Submitted';
        var s = String(raw).trim();
        var lower = s.toLowerCase();
        if (lower === 'submitted' || lower === '') return 'Submitted';
        if (lower === 'in progress') return 'In Progress';
        if (lower === 'awaiting approval') return 'Awaiting Approval';
        if (lower === 'completed' || lower === 'complete') return 'Completed';
        if (lower === 'approved') return 'Approved';
        if (lower.indexOf('revision') !== -1) return 'Revision Requested';
        return 'Submitted';
    }

    function getDueBadge(dueDateStr) {
        if (!dueDateStr) return { text: '', cls: '' };
        var due = new Date(dueDateStr);
        if (isNaN(due.getTime())) return { text: '', cls: '' };
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        var diffDays = Math.round((due - today) / 86400000);
        if (diffDays < 0) return { text: 'OVERDUE', cls: 'kanban-card-due--overdue' };
        if (diffDays === 0) return { text: 'Due Today', cls: 'kanban-card-due--soon' };
        if (diffDays === 1) return { text: 'Due Tomorrow', cls: 'kanban-card-due--soon' };
        if (diffDays <= 7) {
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            return { text: 'Due ' + months[due.getMonth()] + ' ' + due.getDate(), cls: 'kanban-card-due--ok' };
        }
        return { text: '', cls: '' };
    }

    function renderMockupKanbanCard(m, hidden) {
        var company = escapeHtml(m.Company_Name || 'Unknown');
        var designNum = escapeHtml(m.Design_Number || '');
        var id = m.ID;
        var due = getDueBadge(m.Due_Date);

        var aeDisplay = '';
        var sub = m.Submitted_By || '';
        if (sub) {
            var atIdx = sub.indexOf('@');
            aeDisplay = atIdx > 0 ? sub.substring(0, atIdx) : sub;
            aeDisplay = aeDisplay.charAt(0).toUpperCase() + aeDisplay.slice(1);
        }

        var badges = '';
        var mockupType = m.Mockup_Type || '';
        var revCount = m.Revision_Count || 0;
        if (mockupType) badges += '<span class="kanban-card-badge kanban-card-badge--type">' + escapeHtml(mockupType) + '</span>';
        if (revCount > 0) badges += '<span class="kanban-card-badge kanban-card-badge--rev">Rev ' + revCount + '</span>';

        var thumbHtml = '';
        if (m.Box_Mockup_1) {
            thumbHtml = '<img class="kanban-card-thumb" src="' + escapeHtml(m.Box_Mockup_1) + '" loading="lazy" onerror="this.style.display=\'none\'" alt="">';
        }

        var kanbanElapsed = (typeof ElapsedTimeUtils !== 'undefined')
            ? ElapsedTimeUtils.getKanbanElapsedBadge(m.Status || '', m, 'mockup')
            : '';

        var hiddenStyle = hidden ? ' style="display: none"' : '';
        return '<div class="kanban-card" data-mockup-id="' + id + '"' + hiddenStyle + ' onclick="window.open(\'/mockup/' + id + '?view=ae\', \'_blank\')">'
            + '<div class="kanban-card-company">' + company + kanbanElapsed + '</div>'
            + (designNum ? '<div class="kanban-card-design">#' + designNum + '</div>' : '')
            + '<div class="kanban-card-meta">'
            + '<span class="kanban-card-rep">' + escapeHtml(aeDisplay) + '</span>'
            + (due.text ? '<span class="kanban-card-due ' + due.cls + '">' + escapeHtml(due.text) + '</span>' : '')
            + '</div>'
            + (badges ? '<div class="kanban-card-badges">' + badges + '</div>' : '')
            + thumbHtml
            + '</div>';
    }

    window.toggleRuthAeKanbanView = function (view) {
        var galleryView = document.getElementById('mockup-ae-gallery');
        var boardView = document.getElementById('ruth-ae-kanban-board');
        var toggleBtns = document.querySelectorAll('#ruth-ae-view-toggle .view-toggle-btn');
        if (!galleryView || !boardView) return;

        kanbanActive = (view === 'board');

        toggleBtns.forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        if (kanbanActive) {
            galleryView.style.display = 'none';
            boardView.classList.add('active');
            buildRuthAeKanbanBoard();
        } else {
            galleryView.style.display = '';
            boardView.classList.remove('active');
        }
    };

    // Collapse/expand helpers (shared via window)
    window.toggleKanbanCollapse = window.toggleKanbanCollapse || function (colId, storageKey) {
        var col = document.querySelector('.kanban-column--' + colId);
        if (!col) return;
        col.classList.toggle('kanban-column--collapsed');
        localStorage.setItem(storageKey, col.classList.contains('kanban-column--collapsed') ? '1' : '0');
    };
    window.kanbanShowAll = window.kanbanShowAll || function (colId) {
        var col = document.querySelector('.kanban-column--' + colId);
        if (!col) return;
        col.querySelectorAll('.kanban-card[style*="display: none"]').forEach(function (c) { c.style.display = ''; });
        var link = col.querySelector('.kanban-show-all');
        if (link) link.remove();
    };

    function buildRuthAeKanbanBoard() {
        var board = document.getElementById('ruth-ae-kanban-board');
        if (!board) return;

        // Filter to date cutoff
        var filtered = allMockups.filter(function (m) {
            if (!m.Submitted_Date) return false;
            return new Date(m.Submitted_Date) >= KANBAN_DATE_CUTOFF;
        });

        // Group into buckets
        var buckets = {};
        KANBAN_COLUMNS.forEach(function (col) { buckets[col.id] = []; });

        filtered.forEach(function (m) {
            var status = normalizeStatus(m.Status);
            var placed = false;
            KANBAN_COLUMNS.forEach(function (col) {
                if (!placed && col.match.indexOf(status) !== -1) {
                    buckets[col.id].push(m);
                    placed = true;
                }
            });
            if (!placed) buckets['submitted'].push(m);
        });

        var completedCollapsed = localStorage.getItem('ruthAeKanbanCompletedCollapsed') !== '0';

        board.innerHTML = KANBAN_COLUMNS.map(function (col) {
            var colCards = buckets[col.id] || [];
            var isCompleted = col.id === 'completed';

            var cardsHtml = '';
            if (isCompleted && colCards.length > COMPLETED_SHOW_LIMIT) {
                cardsHtml = colCards.slice(0, COMPLETED_SHOW_LIMIT).map(function (m) { return renderMockupKanbanCard(m, false); }).join('');
                cardsHtml += colCards.slice(COMPLETED_SHOW_LIMIT).map(function (m) { return renderMockupKanbanCard(m, true); }).join('');
                cardsHtml += '<div class="kanban-show-all" onclick="event.stopPropagation(); window.kanbanShowAll(\'' + col.id + '\')">Show all ' + colCards.length + ' items</div>';
            } else {
                cardsHtml = colCards.map(function (m) { return renderMockupKanbanCard(m, false); }).join('');
            }

            var chevron = isCompleted ? '<span class="kanban-collapse-chevron">&#9660;</span>' : '';
            var collapseClass = (isCompleted && completedCollapsed) ? ' kanban-column--collapsed' : '';
            var clickHandler = isCompleted ? ' onclick="window.toggleKanbanCollapse(\'' + col.id + '\', \'ruthAeKanbanCompletedCollapsed\')"' : '';

            return '<div class="kanban-column kanban-column--' + col.id + collapseClass + '">'
                + '<div class="kanban-column-header"' + clickHandler + '>'
                + chevron
                + '<span>' + col.label + '</span>'
                + '<span class="kanban-column-count">' + colCards.length + '</span>'
                + '</div>'
                + '<div class="kanban-column-body">' + cardsHtml + '</div>'
                + '</div>';
        }).join('');
    }

    return {
        init: init,
        filterByStatus: filterByStatus
    };

})();
