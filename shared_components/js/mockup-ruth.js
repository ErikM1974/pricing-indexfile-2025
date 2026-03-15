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

    // ── Render Cards ─────────────────────────────────────────────────────
    function renderCards() {
        const queueGrid = document.getElementById('queue-grid');
        const completedGrid = document.getElementById('completed-grid');

        if (!queueGrid || !completedGrid) return;

        // Filter mockups
        const queueMockups = allMockups.filter(m => QUEUE_STATUSES.includes(m.Status));
        const completedMockups = allMockups.filter(m => COMPLETED_STATUSES.includes(m.Status));

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

        // Attach event listeners to cards
        attachCardListeners();
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
            badges += `<span class="card-badge card-badge--due-soon">OVERDUE</span>`;
        }

        // Quick action buttons for Ruth
        let actionsHtml = '';
        if (showActions) {
            const statusLower = status.toLowerCase();
            if (statusLower === 'submitted') {
                actionsHtml = `
                    <div class="card-actions">
                        <button class="card-action-btn card-action-btn--start" data-id="${id}" data-action="start">Start Working</button>
                    </div>`;
            } else if (statusLower === 'in progress' || statusLower === 'revision requested') {
                actionsHtml = `
                    <div class="card-actions">
                        <button class="card-action-btn card-action-btn--send" data-id="${id}" data-action="send-approval">Send for Approval</button>
                    </div>`;
            } else if (statusLower === 'awaiting approval') {
                actionsHtml = `
                    <div class="card-actions">
                        <span style="font-size:12px;color:#888;padding:6px 0;">Waiting for AE review...</span>
                    </div>`;
            }
        }

        // AE display name (extract before @)
        let aeDisplay = '';
        if (submittedBy) {
            const atIdx = submittedBy.indexOf('@');
            aeDisplay = atIdx > 0 ? submittedBy.substring(0, atIdx) : submittedBy;
            aeDisplay = aeDisplay.charAt(0).toUpperCase() + aeDisplay.slice(1);
        }

        return `
        <div class="mockup-card" data-mockup-id="${id}">
            <div class="card-header">
                <div class="card-header-left">
                    <div class="card-company">${company}</div>
                    <div class="card-design-number">#${designNum}</div>
                </div>
                <div class="card-header-right">
                    <span class="status-pill ${statusClass}">${escapeHtml(status)}</span>
                </div>
            </div>
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

    // ── Init ─────────────────────────────────────────────────────────────
    function init() {
        setCurrentDate();
        fetchMockups();

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
