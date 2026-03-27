/**
 * mockup-ruth.js — Ruth's Digitizing Mockup Dashboard
 *
 * Fetches mockups from our API (no Caspio DataPages) and renders card gallery.
 * Handles tab switching, status filtering, quick actions, and toast notifications.
 *
 * Depends on: mockup-ruth.css, app-config.js
 */
(function () {
    'use strict';

    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // ── State ────────────────────────────────────────────────────────────
    let allMockups = [];
    let currentFilter = 'queue'; // 'queue' | 'completed' | 'all'
    let lastNotificationPoll = Date.now();

    // ── Status Helpers ───────────────────────────────────────────────────
    const QUEUE_STATUSES = ['Submitted', 'In Progress', 'Awaiting Approval', 'Revision Requested'];
    const COMPLETED_STATUSES = ['Approved'];

    function getStatusClass(status) {
        const s = (status || '').toLowerCase().replace(/\s+/g, '-');
        return `status-pill--${s}`;
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatDateShort(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function isDueSoon(dueDate) {
        if (!dueDate) return false;
        const due = new Date(dueDate);
        const now = new Date();
        const diffDays = (due - now) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 2;
    }

    function isOverdue(dueDate) {
        if (!dueDate) return false;
        const due = new Date(dueDate);
        return due < new Date();
    }

    function getElapsedText(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        let text, cssClass;
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
        return { text, cssClass };
    }

    // ── Set Current Date ─────────────────────────────────────────────────
    function setCurrentDate() {
        const el = document.getElementById('currentDate');
        if (el) {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            el.textContent = new Date().toLocaleDateString('en-US', options);
        }
    }

    // ── Tab Navigation ───────────────────────────────────────────────────
    function showTab(tabName) {
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

        const tabMap = {
            'queue':     { index: 0, pane: 'queue-tab' },
            'completed': { index: 1, pane: 'completed-tab' },
            'billing':   { index: 2, pane: 'billing-tab' }
        };

        const tab = tabMap[tabName];
        if (tab) {
            document.querySelectorAll('.tab-button')[tab.index].classList.add('active');
            const pane = document.getElementById(tab.pane);
            if (pane) pane.classList.add('active');
        }

        currentFilter = tabName;
        if (tabName !== 'billing') {
            renderCards();
        }
    }

    // ── Fetch Mockups ────────────────────────────────────────────────────
    async function fetchMockups() {
        showLoading(true);
        try {
            const resp = await fetch(`${API_BASE}/api/mockups?orderBy=Submitted_Date DESC&limit=500`);
            if (!resp.ok) throw new Error(`API returned ${resp.status}`);
            const data = await resp.json();
            allMockups = data.records || [];
            updateStatusCounts();
            renderCards();
            if (kanbanActive) buildKanbanBoard();
        } catch (err) {
            console.error('Failed to fetch mockups:', err);
            showError('Unable to load mockups. Please refresh the page.');
        } finally {
            showLoading(false);
        }
    }

    // ── Update Status Counts ─────────────────────────────────────────────
    function updateStatusCounts() {
        const counts = {
            submitted: 0,
            inProgress: 0,
            awaitingApproval: 0,
            revisionRequested: 0,
            approved: 0
        };

        allMockups.forEach(m => {
            const s = (m.Status || '').toLowerCase();
            if (s === 'submitted') counts.submitted++;
            else if (s === 'in progress') counts.inProgress++;
            else if (s === 'awaiting approval') counts.awaitingApproval++;
            else if (s === 'revision requested') counts.revisionRequested++;
            else if (s === 'approved') counts.approved++;
        });

        // Update badge counts on tabs
        const queueBadge = document.getElementById('queue-count');
        const completedBadge = document.getElementById('completed-count');
        const queueTotal = counts.submitted + counts.inProgress + counts.awaitingApproval + counts.revisionRequested;

        if (queueBadge) queueBadge.textContent = queueTotal;
        if (completedBadge) completedBadge.textContent = counts.approved;

        // Update status summary bar
        const summaryEl = document.getElementById('status-summary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="status-stat" title="Submitted">
                    <span class="status-stat-count">${counts.submitted}</span>
                    <span class="status-stat-label">Submitted</span>
                </div>
                <div class="status-stat" title="In Progress">
                    <span class="status-stat-count">${counts.inProgress}</span>
                    <span class="status-stat-label">In Progress</span>
                </div>
                <div class="status-stat" title="Awaiting Approval">
                    <span class="status-stat-count">${counts.awaitingApproval}</span>
                    <span class="status-stat-label">Awaiting Approval</span>
                </div>
                <div class="status-stat" title="Revision Requested">
                    <span class="status-stat-count">${counts.revisionRequested}</span>
                    <span class="status-stat-label">Revisions</span>
                </div>
            `;
        }
    }

    // ── Search Filter ─────────────────────────────────────────────────────
    let ruthSearchText = '';

    function injectSearchBar() {
        if (document.getElementById('ruth-search-bar')) return;
        const queueGrid = document.getElementById('queue-grid');
        if (!queueGrid) return;

        const bar = document.createElement('div');
        bar.id = 'ruth-search-bar';
        bar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 16px;margin:0 0 12px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.08);';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'ruth-search-input';
        input.placeholder = 'Search company, design #, rep...';
        input.style.cssText = 'padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;color:#1e293b;width:260px;';

        const countSpan = document.createElement('span');
        countSpan.id = 'ruth-search-count';
        countSpan.style.cssText = 'font-size:12px;color:#94a3b8;margin-left:auto;';

        let timer = null;
        input.addEventListener('input', function () {
            clearTimeout(timer);
            const el = this;
            timer = setTimeout(function () {
                ruthSearchText = el.value.trim().toLowerCase();
                renderCards();
                if (kanbanActive) buildKanbanBoard();
            }, 200);
        });

        bar.appendChild(input);
        bar.appendChild(countSpan);
        queueGrid.parentNode.insertBefore(bar, queueGrid);
    }

    // ── Render Cards ─────────────────────────────────────────────────────
    function renderCards() {
        const queueGrid = document.getElementById('queue-grid');
        const completedGrid = document.getElementById('completed-grid');

        if (!queueGrid || !completedGrid) return;

        injectSearchBar();

        // Filter mockups
        let queueMockups = allMockups.filter(m => QUEUE_STATUSES.includes(m.Status));
        let completedMockups = allMockups.filter(m => COMPLETED_STATUSES.includes(m.Status));

        // Apply text search
        if (ruthSearchText) {
            const matchFn = m => {
                const text = ((m.Company_Name || '') + ' ' + (m.Design_Number || '') + ' ' + (m.Design_Name || '') + ' ' + (m.Submitted_By || '')).toLowerCase();
                return text.indexOf(ruthSearchText) !== -1;
            };
            queueMockups = queueMockups.filter(matchFn);
            completedMockups = completedMockups.filter(matchFn);
        }

        // Update search count
        const countSpan = document.getElementById('ruth-search-count');
        if (countSpan) {
            const total = allMockups.length;
            const shown = queueMockups.length + completedMockups.length;
            countSpan.textContent = ruthSearchText ? shown + ' of ' + total + ' mockups' : total + ' mockups';
        }

        // Render queue
        if (queueMockups.length === 0) {
            queueGrid.innerHTML = `
                <div class="mockup-empty" style="grid-column: 1 / -1;">
                    <div class="mockup-empty-icon">&#9745;</div>
                    <div class="mockup-empty-text">No pending mockups - you're all caught up!</div>
                </div>`;
        } else {
            queueGrid.innerHTML = queueMockups.map(m => buildCard(m, true)).join('');
        }

        // Render completed
        if (completedMockups.length === 0) {
            completedGrid.innerHTML = `
                <div class="mockup-empty" style="grid-column: 1 / -1;">
                    <div class="mockup-empty-icon">&#128194;</div>
                    <div class="mockup-empty-text">No completed mockups yet</div>
                </div>`;
        } else {
            completedGrid.innerHTML = completedMockups.map(m => buildCard(m, false)).join('');
        }

        // Stagger card entry animations
        document.querySelectorAll('.mockup-card').forEach((card, idx) => {
            card.style.animationDelay = (idx * 0.05) + 's';
        });

        // Attach event listeners to cards
        attachCardListeners();

        // Audit badges for completed cards with work order numbers
        addAuditIndicators();
    }

    function buildCard(mockup, showActions) {
        const id = mockup.ID;
        const company = escapeHtml(mockup.Company_Name || 'Unknown Company');
        const designNum = escapeHtml(mockup.Design_Number || '—');
        const designName = escapeHtml(mockup.Design_Name || '');
        const status = mockup.Status || 'Submitted';
        const statusClass = getStatusClass(status);
        const mockupType = escapeHtml(mockup.Mockup_Type || '');
        const submittedBy = escapeHtml(mockup.Submitted_By || '');
        const submittedDate = formatDate(mockup.Submitted_Date);
        const dueDate = mockup.Due_Date;
        const revCount = mockup.Revision_Count || 0;

        // Badges
        let badges = '';
        if (mockupType) {
            badges += `<span class="card-badge">${mockupType}</span>`;
        }
        if (revCount > 0) {
            badges += `<span class="card-badge card-badge--revision">Rev ${revCount}</span>`;
        }
        if (dueDate && isDueSoon(dueDate) && status !== 'Approved') {
            badges += `<span class="card-badge card-badge--due-soon">Due ${formatDateShort(dueDate)}</span>`;
        }
        if (dueDate && isOverdue(dueDate) && status !== 'Approved') {
            badges += `<span class="card-badge card-badge--due-soon card-badge--overdue">OVERDUE</span>`;
        }

        // Quick action buttons for Ruth + elapsed time badge
        let actionsHtml = '';
        const elapsedBadge = (typeof ElapsedTimeUtils !== 'undefined')
            ? ElapsedTimeUtils.getStatusElapsedBadge(status, mockup, 'mockup')
            : '';

        if (showActions) {
            const statusLower = status.toLowerCase();
            if (statusLower === 'submitted') {
                actionsHtml = `
                    <div class="card-actions">
                        <button class="card-action-btn card-action-btn--start" data-id="${id}" data-action="start">Start Working</button>
                        ${elapsedBadge}
                    </div>`;
            } else if (statusLower === 'in progress' || statusLower === 'revision requested') {
                actionsHtml = `
                    <div class="card-actions">
                        <button class="card-action-btn card-action-btn--send" data-id="${id}" data-action="send-approval">Send for Approval</button>
                        ${elapsedBadge}
                    </div>`;
            } else if (statusLower === 'awaiting approval') {
                actionsHtml = `
                    <div class="card-actions">
                        ${elapsedBadge || '<span class="elapsed-badge elapsed--waiting">Waiting for AE review...</span>'}
                    </div>`;
            } else {
                actionsHtml = elapsedBadge ? `<div class="card-actions">${elapsedBadge}</div>` : '';
            }
        }

        // AE display name (extract before @)
        let aeDisplay = '';
        if (submittedBy) {
            const atIdx = submittedBy.indexOf('@');
            aeDisplay = atIdx > 0 ? submittedBy.substring(0, atIdx) : submittedBy;
            aeDisplay = aeDisplay.charAt(0).toUpperCase() + aeDisplay.slice(1);
        }

        const thumbUrl = mockup.Box_Mockup_1 || '';
        const thumbHtml = thumbUrl
            ? `<div class="card-thumb"><img src="${escapeHtml(thumbUrl)}" alt="Mockup preview" loading="lazy" onerror="this.parentElement.style.display='none';"></div>`
            : '';

        const workOrder = escapeHtml(mockup.Work_Order_Number || '');

        // Status class for left border + hover glow
        const statusSlug = (status || '').toLowerCase().replace(/\s+/g, '-');
        const cardStatusClass = statusSlug ? `mockup-card--${statusSlug}` : '';

        return `
        <div class="mockup-card ${cardStatusClass}" data-mockup-id="${id}" data-work-order="${workOrder}">
            <div class="card-header">
                <div class="card-header-left">
                    <div class="card-company">${company}</div>
                    <div class="card-design-number">#${designNum}</div>
                </div>
                <div class="card-header-right">
                    <span class="status-pill ${statusClass}">${escapeHtml(status)}</span>
                </div>
            </div>
            ${thumbHtml}
            <div class="card-body">
                ${designName ? `<div class="card-design-name">${designName}</div>` : ''}
                <div class="card-meta">
                    ${aeDisplay ? `<div class="card-meta-row"><span class="card-meta-label">From:</span> ${escapeHtml(aeDisplay)}</div>` : ''}
                    ${mockup.Garment_Info ? `<div class="card-meta-row"><span class="card-meta-label">Garment:</span> ${escapeHtml(mockup.Garment_Info)}</div>` : ''}
                    ${mockup.Print_Location ? `<div class="card-meta-row"><span class="card-meta-label">Location:</span> ${escapeHtml(mockup.Print_Location)}</div>` : ''}
                </div>
                ${badges ? `<div class="card-badges">${badges}</div>` : ''}
            </div>
            <div class="card-footer">
                <span class="card-date">${submittedDate}</span>
                <a href="/mockup/${id}" class="card-action-link" onclick="event.stopPropagation();">View Details &rarr;</a>
            </div>
            ${actionsHtml}
        </div>`;
    }

    // ── Card Event Listeners ─────────────────────────────────────────────
    function attachCardListeners() {
        // Whole card click → detail page
        document.querySelectorAll('.mockup-card').forEach(card => {
            card.addEventListener('click', function (e) {
                // Don't navigate if clicking a button or link
                if (e.target.closest('button') || e.target.closest('a')) return;
                const id = this.dataset.mockupId;
                if (id) window.location.href = `/mockup/${id}`;
            });
        });

        // Quick action buttons
        document.querySelectorAll('.card-action-btn').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                const id = this.dataset.id;
                const action = this.dataset.action;
                handleQuickAction(id, action, this);
            });
        });
    }

    // ── Quick Actions ────────────────────────────────────────────────────
    async function handleQuickAction(mockupId, action, btnEl) {
        const originalText = btnEl.textContent;
        btnEl.disabled = true;
        btnEl.textContent = 'Updating...';

        try {
            let newStatus = '';
            if (action === 'start') {
                newStatus = 'In Progress';
            } else if (action === 'send-approval') {
                newStatus = 'Awaiting Approval';
            }

            if (!newStatus) return;

            const resp = await fetch(`${API_BASE}/api/mockups/${mockupId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    author: 'ruth@nwcustomapparel.com',
                    authorName: 'Ruth'
                })
            });

            if (!resp.ok) throw new Error(`Status update failed: ${resp.status}`);

            showToast(`Mockup updated to "${newStatus}"`, 'success');

            // Notify AE when Ruth starts working
            if (action === 'start' && typeof emailjs !== 'undefined') {
                const mockup = allMockups.find(m => String(m.Mockup_ID) === String(mockupId));
                if (mockup && mockup.Submitted_By) {
                    try {
                        emailjs.init('4qSbDO-SQs19TbP80');
                        emailjs.send('service_jgrave3', 'template_art_note_added', {
                            to_email: mockup.Submitted_By,
                            to_name: mockup.Sales_Rep || 'Sales Rep',
                            design_id: mockup.Design_Number || 'NEW',
                            company_name: mockup.Company_Name || 'Unknown',
                            note_text: 'Ruth has started working on your mockup request for ' + (mockup.Company_Name || 'Unknown'),
                            note_type: 'In Progress',
                            detail_link: 'https://www.teamnwca.com/mockup/' + mockupId + '?view=ae',
                            from_name: 'Ruth (Digitizing)'
                        }).catch(function () {});
                    } catch (e) { /* silent */ }
                }
            }

            // Refresh data
            await fetchMockups();

        } catch (err) {
            console.error('Quick action error:', err);
            showToast('Failed to update mockup. Please try again.', 'error');
            btnEl.disabled = false;
            btnEl.textContent = originalText;
        }
    }

    // ── Loading / Error States ───────────────────────────────────────────
    function showLoading(show) {
        const el = document.getElementById('mockup-loading');
        if (el) el.style.display = show ? 'block' : 'none';
    }

    function showError(message) {
        const queueGrid = document.getElementById('queue-grid');
        if (queueGrid) {
            queueGrid.innerHTML = `
                <div class="mockup-error" style="grid-column: 1 / -1;">
                    <strong>Error:</strong> ${escapeHtml(message)}
                    <br><button onclick="location.reload()" style="margin-top:10px;padding:8px 16px;border:none;border-radius:4px;background:#6B46C1;color:white;cursor:pointer;">Refresh Page</button>
                </div>`;
        }
    }

    // ── Toast Notification ───────────────────────────────────────────────
    function showToast(message, type) {
        type = type || 'info';
        // Remove existing toasts
        document.querySelectorAll('.mockup-toast').forEach(t => t.remove());

        const toast = document.createElement('div');
        toast.className = `mockup-toast mockup-toast--${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ── Notification Polling ─────────────────────────────────────────────
    async function pollNotifications() {
        try {
            const resp = await fetch(`${API_BASE}/api/mockup-notifications?since=${lastNotificationPoll}&user=ruth@nwcustomapparel.com`);
            if (!resp.ok) return;
            const data = await resp.json();
            if (data.notifications && data.notifications.length > 0) {
                data.notifications.forEach(n => {
                    showToast(n.message, 'info');
                });
                lastNotificationPoll = Date.now();
                // Refresh data when there are new notifications
                fetchMockups();
            }
        } catch (err) {
            // Silent fail — polling is non-critical
        }
    }

    // ── ShopWorks Art Done Audit Badges ──────────────────────────────────
    function addAuditIndicators() {
        const completedGrid = document.getElementById('completed-grid');
        if (!completedGrid) return;

        const cards = completedGrid.querySelectorAll('.mockup-card[data-work-order]');
        cards.forEach(card => {
            const wo = card.dataset.workOrder;
            if (!wo) return;
            if (card.dataset.auditQueued) return;
            card.dataset.auditQueued = '1';

            fetch(API_BASE + '/api/manageorders/orders/' + encodeURIComponent(wo))
                .then(r => {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                })
                .then(data => {
                    const orders = data.result || [];
                    if (orders.length === 0) return;
                    const artDone = orders[0].sts_ArtDone === 1;
                    insertAuditBadge(card,
                        artDone ? '\u2713 SW Art Done' : '\u2717 SW Art Pending',
                        artDone ? 'green' : 'amber',
                        artDone ? 'Art marked done in ShopWorks' : 'Art not yet marked done in ShopWorks');
                })
                .catch(() => { /* silent */ });
        });
    }

    function insertAuditBadge(card, text, color, tooltip) {
        const badge = document.createElement('span');
        badge.className = 'audit-badge audit-badge--' + color;
        badge.textContent = text;
        if (tooltip) badge.title = tooltip;
        const headerArea = card.querySelector('.card-header') || card.querySelector('.card-company');
        if (headerArea) {
            headerArea.appendChild(badge);
        }
    }

    // ── Kanban Board View ───────────────────────────────────────────────
    var kanbanActive = false;

    // Date cutoff: only show mockups from March 15, 2026+ (new status system)
    var KANBAN_DATE_CUTOFF = new Date('2026-03-15');

    var KANBAN_COLUMNS = [
        { id: 'submitted', label: 'Submitted', match: ['Submitted'] },
        { id: 'in-progress', label: 'In Progress', match: ['In Progress'] },
        { id: 'awaiting', label: 'Awaiting Approval', match: ['Awaiting Approval'] },
        { id: 'revision', label: 'Revision Requested', match: ['Revision Requested'] },
        { id: 'approved', label: 'Approved', match: ['Approved'] },
        { id: 'completed', label: 'Completed', match: ['Completed'] }
    ];

    window.toggleKanbanView = function (view) {
        var gridView = document.getElementById('ruth-grid-view');
        var boardView = document.getElementById('ruth-kanban-board');
        var toggleBtns = document.querySelectorAll('#ruth-view-toggle .view-toggle-btn');
        if (!gridView || !boardView) return;

        kanbanActive = (view === 'board');
        localStorage.setItem('ruthViewPreference', view);

        toggleBtns.forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        if (kanbanActive) {
            gridView.style.display = 'none';
            boardView.classList.add('active');
            buildKanbanBoard();
        } else {
            gridView.style.display = '';
            boardView.classList.remove('active');
        }
    };

    function buildKanbanBoard() {
        var board = document.getElementById('ruth-kanban-board');
        if (!board || !allMockups.length) return;

        // Filter to March 15+ (new status system) for all statuses
        var kanbanMockups = allMockups.filter(function (m) {
            if (!m.Submitted_Date) return false;
            var submitted = new Date(m.Submitted_Date);
            return submitted >= KANBAN_DATE_CUTOFF;
        });

        // Apply search filter
        if (ruthSearchText) {
            kanbanMockups = kanbanMockups.filter(function (m) {
                var text = ((m.Company_Name || '') + ' ' + (m.Design_Number || '') + ' ' + (m.Design_Name || '') + ' ' + (m.Submitted_By || '')).toLowerCase();
                return text.indexOf(ruthSearchText) !== -1;
            });
        }

        var COMPLETED_SHOW_LIMIT = 5;
        var completedCollapsed = localStorage.getItem('ruthKanbanCompletedCollapsed') !== '0'; // Default: collapsed

        // Toggle helpers (shared via window)
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

        board.innerHTML = KANBAN_COLUMNS.map(function (col) {
            var colCards = kanbanMockups.filter(function (m) {
                return col.match.indexOf(m.Status) !== -1;
            });

            var isCompleted = col.id === 'completed';

            // Build card HTML
            var renderCard = function (m, hidden) {
                var company = escapeHtml(m.Company_Name || 'Unknown');
                var designNum = escapeHtml(m.Design_Number || '');
                var id = m.ID;

                var aeDisplay = '';
                var sub = m.Submitted_By || '';
                if (sub) {
                    var atIdx = sub.indexOf('@');
                    aeDisplay = atIdx > 0 ? sub.substring(0, atIdx) : sub;
                    aeDisplay = aeDisplay.charAt(0).toUpperCase() + aeDisplay.slice(1);
                }

                var dueText = '';
                var dueClass = '';
                if (m.Due_Date) {
                    if (isOverdue(m.Due_Date)) {
                        dueText = 'OVERDUE';
                        dueClass = 'kanban-card-due--overdue';
                    } else if (isDueSoon(m.Due_Date)) {
                        dueText = 'Due ' + formatDateShort(m.Due_Date);
                        dueClass = 'kanban-card-due--soon';
                    }
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
                    ? ElapsedTimeUtils.getKanbanElapsedBadge(col.id, m, 'mockup')
                    : '';

                var hiddenStyle = hidden ? ' style="display: none"' : '';
                return '<div class="kanban-card" data-mockup-id="' + id + '"' + hiddenStyle + ' onclick="window.location.href=\'/mockup/' + id + '\'">'
                    + '<div class="kanban-card-company">' + company + kanbanElapsed + '</div>'
                    + (designNum ? '<div class="kanban-card-design">#' + designNum + '</div>' : '')
                    + '<div class="kanban-card-meta">'
                    + '<span class="kanban-card-rep">' + escapeHtml(aeDisplay) + '</span>'
                    + (dueText ? '<span class="kanban-card-due ' + dueClass + '">' + dueText + '</span>' : '')
                    + '</div>'
                    + (badges ? '<div class="kanban-card-badges">' + badges + '</div>' : '')
                    + thumbHtml
                    + '</div>';
            };

            // Limit completed cards
            var cardsHtml = '';
            if (isCompleted && colCards.length > COMPLETED_SHOW_LIMIT) {
                cardsHtml = colCards.slice(0, COMPLETED_SHOW_LIMIT).map(function (m) { return renderCard(m, false); }).join('');
                cardsHtml += colCards.slice(COMPLETED_SHOW_LIMIT).map(function (m) { return renderCard(m, true); }).join('');
                cardsHtml += '<div class="kanban-show-all" onclick="event.stopPropagation(); window.kanbanShowAll(\'' + col.id + '\')">Show all ' + colCards.length + ' items</div>';
            } else {
                cardsHtml = colCards.map(function (m) { return renderCard(m, false); }).join('');
            }

            var chevron = isCompleted
                ? '<span class="kanban-collapse-chevron" title="Click to collapse/expand">&#9660;</span>'
                : '';
            var collapseClass = (isCompleted && completedCollapsed) ? ' kanban-column--collapsed' : '';
            var clickHandler = isCompleted
                ? ' onclick="window.toggleKanbanCollapse(\'' + col.id + '\', \'ruthKanbanCompletedCollapsed\')"'
                : '';

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

    // ── Skeleton Loading ─────────────────────────────────────────────────
    function showSkeletonCards() {
        const queueGrid = document.getElementById('queue-grid');
        if (!queueGrid || queueGrid.children.length > 0) return;
        queueGrid.innerHTML = Array.from({ length: 6 }, () => `
            <div class="skeleton-card">
                <div class="skeleton-header"></div>
                <div class="skeleton-body">
                    <div class="skeleton-line skeleton-line--long"></div>
                    <div class="skeleton-line skeleton-line--medium"></div>
                    <div class="skeleton-line skeleton-line--short"></div>
                    <div class="skeleton-line skeleton-line--pill"></div>
                </div>
            </div>`).join('');
    }

    // ── Init ─────────────────────────────────────────────────────────────
    function init() {
        setCurrentDate();
        showSkeletonCards();
        fetchMockups();

        // Always default to Grid view on page load

        // Poll for notifications every 30 seconds
        setInterval(pollNotifications, 30000);
    }

    // Expose tab function globally (used by onclick in HTML)
    window.showTab = showTab;

    // Start when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
