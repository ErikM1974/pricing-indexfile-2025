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

    // ── Rush flag normalizer — handles Y / Yes / true / True / 1 ─────────
    function isRush(v) {
        if (!v && v !== 0) return false;
        if (typeof v === 'boolean') return v;
        const s = String(v).trim().toLowerCase();
        return s === 'yes' || s === 'y' || s === 'true' || s === '1';
    }

    // ── Status Helpers ───────────────────────────────────────────────────
    const QUEUE_STATUSES = ['Submitted', 'In Progress', 'Awaiting Approval', 'Revision Requested'];
    // Both 'Approved' and 'Completed' are valid final statuses in the data model.
    // Kanban columns already treat them as separate end-states; this list unions them
    // for the Completed tab so no records fall through the cracks.
    const COMPLETED_STATUSES = ['Approved', 'Completed'];

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
            'on-hold':   { index: 2, pane: 'on-hold-tab' },
            'billing':   { index: 3, pane: 'billing-tab' }
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
            // Sort by ID DESC, not Submitted_Date — recent records have null
            // Submitted_Date (Caspio field type changed away from auto-populated
            // Timestamp) and would otherwise sort to the bottom of the queue.
            // ID is auto-increment, always populated, monotonic by submission.
            const resp = await fetch(`${API_BASE}/api/mockups?orderBy=ID DESC&limit=500`);
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
            approved: 0,
            onHold: 0
        };

        allMockups.forEach(m => {
            // On-hold mockups get their own count and are excluded from the
            // status-specific buckets (so Ruth's "Submitted" backlog isn't
            // inflated by paused work).
            if (m.Is_On_Hold) {
                counts.onHold++;
                return;
            }
            const s = (m.Status || '').toLowerCase();
            if (s === 'submitted') counts.submitted++;
            else if (s === 'in progress') counts.inProgress++;
            else if (s === 'awaiting approval') counts.awaitingApproval++;
            else if (s === 'revision requested') counts.revisionRequested++;
            else if (s === 'approved' || s === 'completed') counts.approved++;
        });

        // Update badge counts on tabs
        const queueBadge = document.getElementById('queue-count');
        const completedBadge = document.getElementById('completed-count');
        const onHoldBadge = document.getElementById('on-hold-count');
        const queueTotal = counts.submitted + counts.inProgress + counts.awaitingApproval + counts.revisionRequested;

        if (queueBadge) queueBadge.textContent = queueTotal;
        if (completedBadge) completedBadge.textContent = counts.approved;
        if (onHoldBadge) onHoldBadge.textContent = counts.onHold;

        // Update status summary bar — adds an "On Hold" stat tile alongside
        // the workflow status counts. Display only (not interactive); on-hold
        // mockups are visible on the All tab with their muted card styling.
        const summaryEl = document.getElementById('status-summary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="status-stat status-stat--submitted" title="Submitted">
                    <span class="status-stat-count" data-stat="submitted">${counts.submitted}</span>
                    <span class="status-stat-label">Submitted</span>
                </div>
                <div class="status-stat status-stat--in-progress" title="In Progress">
                    <span class="status-stat-count" data-stat="inProgress">${counts.inProgress}</span>
                    <span class="status-stat-label">In Progress</span>
                </div>
                <div class="status-stat status-stat--awaiting-approval" title="Awaiting Approval">
                    <span class="status-stat-count" data-stat="awaitingApproval">${counts.awaitingApproval}</span>
                    <span class="status-stat-label">Awaiting Approval</span>
                </div>
                <div class="status-stat status-stat--revision-requested" title="Revision Requested">
                    <span class="status-stat-count" data-stat="revisionRequested">${counts.revisionRequested}</span>
                    <span class="status-stat-label">Revisions</span>
                </div>
                <div class="status-stat status-stat--on-hold" title="On Hold (customer paused)">
                    <span class="status-stat-count" data-stat="onHold">${counts.onHold}</span>
                    <span class="status-stat-label">On Hold</span>
                </div>
            `;
            popChangedCounts(counts);
        }
    }

    // Pop animation when a count value changes between renders.
    // Module-level cache so we only pop on actual deltas, not first render.
    var __ruthPrevCounts = null;
    function popChangedCounts(counts) {
        if (!__ruthPrevCounts) { __ruthPrevCounts = Object.assign({}, counts); return; }
        Object.keys(counts).forEach(function (k) {
            if (counts[k] !== __ruthPrevCounts[k]) {
                var el = document.querySelector('.status-stat-count[data-stat="' + k + '"]');
                if (!el) return;
                el.classList.remove('status-stat-count--pop');
                // Force reflow so re-adding the class restarts the animation
                void el.offsetWidth;
                el.classList.add('status-stat-count--pop');
            }
        });
        __ruthPrevCounts = Object.assign({}, counts);
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
        input.placeholder = 'Search company, design #, rep, or ID...';
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
        const onHoldGrid = document.getElementById('on-hold-grid');

        if (!queueGrid || !completedGrid) return;

        injectSearchBar();

        // Filter mockups. On-hold mockups are paused — they don't appear in
        // either the queue or completed grids. They get their own dedicated tab
        // so Ruth can see paused work when she wants to without it cluttering
        // her active backlog.
        let queueMockups = allMockups.filter(m => !m.Is_On_Hold && QUEUE_STATUSES.includes(m.Status));
        let completedMockups = allMockups.filter(m => !m.Is_On_Hold && COMPLETED_STATUSES.includes(m.Status));
        let onHoldMockups = allMockups.filter(m => !!m.Is_On_Hold);

        // Apply text search
        if (ruthSearchText) {
            const matchFn = m => {
                const text = ((m.Company_Name || '') + ' ' + (m.Design_Number || '') + ' ' + (m.Design_Name || '') + ' ' + (m.Submitted_By || '') + ' ' + (m.ID || '')).toLowerCase();
                return text.indexOf(ruthSearchText) !== -1;
            };
            queueMockups = queueMockups.filter(matchFn);
            completedMockups = completedMockups.filter(matchFn);
            onHoldMockups = onHoldMockups.filter(matchFn);
        }

        // Update search count
        const countSpan = document.getElementById('ruth-search-count');
        if (countSpan) {
            const total = allMockups.length;
            const shown = queueMockups.length + completedMockups.length + onHoldMockups.length;
            countSpan.textContent = ruthSearchText ? shown + ' of ' + total + ' mockups' : total + ' mockups';
        }

        // Rush-first sort within queue (preserves Submitted_Date ordering as tiebreaker since allMockups was fetched DESC)
        queueMockups.sort(function (a, b) {
            return (isRush(a.Is_Rush) ? 0 : 1) - (isRush(b.Is_Rush) ? 0 : 1);
        });

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

        // Render on-hold (paused mockups, AE-managed)
        if (onHoldGrid) {
            if (onHoldMockups.length === 0) {
                onHoldGrid.innerHTML = `
                    <div class="mockup-empty" style="grid-column: 1 / -1;">
                        <div class="mockup-empty-icon">&#9989;</div>
                        <div class="mockup-empty-text">No mockups currently on hold.</div>
                    </div>`;
            } else {
                // Pass showActions=false — Ruth can view paused mockups but not act on them
                // until the AE flips them back to active.
                onHoldGrid.innerHTML = onHoldMockups.map(m => buildCard(m, false)).join('');
            }
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
        const isRushMockup = isRush(mockup.Is_Rush);
        if (isRushMockup) {
            badges += `<span class="card-badge card-badge--rush">&#128293; RUSH</span>`;
        }
        if (mockupType) {
            badges += `<span class="card-badge">${mockupType}</span>`;
        }
        if (revCount > 0) {
            badges += `<span class="card-badge card-badge--revision">Rev ${revCount}</span>`;
        }
        if (dueDate && isDueSoon(dueDate) && status !== 'Approved' && status !== 'Completed') {
            badges += `<span class="card-badge card-badge--due-soon">Due ${formatDateShort(dueDate)}</span>`;
        }
        if (dueDate && isOverdue(dueDate) && status !== 'Approved' && status !== 'Completed') {
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

        // AE first-name extraction. Used both inline in the card header (next to
        // #design_num) and in the deprecated "From:" meta line below — see
        // "Steve gallery rep header" pattern (v2026.04.26.10). Take the local-part
        // of the email (or the raw name for non-email Submitted_By values), then
        // pull just the first whitespace-separated token, then capitalize.
        let aeDisplay = '';
        if (submittedBy) {
            const atIdx = submittedBy.indexOf('@');
            let raw = atIdx > 0 ? submittedBy.substring(0, atIdx) : submittedBy;
            raw = String(raw).split(/\s+/)[0]; // first token only — drops surnames
            aeDisplay = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
        }

        const thumbUrl = mockup.Box_Mockup_1 || '';
        const thumbHtml = thumbUrl
            ? `<div class="card-thumb"><img src="${escapeHtml(thumbUrl)}" alt="Mockup preview" loading="lazy" data-original-src="${escapeHtml(thumbUrl)}" onerror="if(window.ArtActions&&window.ArtActions.handleBoxImageError){window.ArtActions.handleBoxImageError(this);}else{this.parentElement.style.display='none';}"></div>`
            : '';

        const workOrder = escapeHtml(mockup.Work_Order_Number || '');

        // AE-provided dimensions — shows Ruth what size to digitize without opening the card
        let dimensions = '';
        if (mockup.Logo_Width && mockup.Logo_Height) {
            dimensions = `${mockup.Logo_Width}" × ${mockup.Logo_Height}"`;
        } else if (mockup.Logo_Width) {
            dimensions = `${mockup.Logo_Width}" wide`;
        } else if (mockup.Logo_Height) {
            dimensions = `${mockup.Logo_Height}" tall`;
        } else if (mockup.Size_Specs) {
            dimensions = mockup.Size_Specs; // fallback for legacy records that only have the combined string
        }

        // Stitch count — formatted with thousands separator
        let stitchCountText = '';
        if (mockup.Stitch_Count != null && mockup.Stitch_Count !== '') {
            const sc = parseInt(mockup.Stitch_Count, 10);
            stitchCountText = isNaN(sc) ? String(mockup.Stitch_Count) : sc.toLocaleString();
        }

        // Thread colors — the embroiderer's #1 need. Prefer a structured
        // Thread_Colors column if it ever exists; otherwise parse the
        // "Thread Colors:" block out of AE_Notes (where the submit form folds
        // them today). Render-only — no schema change, no submit-form risk.
        let threadColorsText = (mockup.Thread_Colors || '').trim();
        if (!threadColorsText && mockup.AE_Notes) {
            const tcm = String(mockup.AE_Notes).match(/Thread Colors:\s*([\s\S]*?)(?:\n\s*\n|Additional Instructions:|$)/i);
            if (tcm) {
                threadColorsText = tcm[1].split('\n')
                    .map(function (l) { return l.replace(/^\s*\d+\.\s*/, '').trim(); })
                    .filter(Boolean).join(', ');
            }
        }

        // Status class for left border + hover glow
        const statusSlug = (status || '').toLowerCase().replace(/\s+/g, '-');
        const cardStatusClass = statusSlug ? `mockup-card--${statusSlug}` : '';
        const rushClass = isRushMockup ? ' mockup-card--rush' : '';
        // On-hold overlay — visibility only, AE owns the toggle via the
        // mockup detail edit modal. Pill renders next to status pill;
        // .mockup-card--on-hold drops opacity to 0.65.
        const isOnHold = !!mockup.Is_On_Hold;
        const onHoldClass = isOnHold ? ' mockup-card--on-hold' : '';
        const onHoldPillHtml = isOnHold
            ? `<span class="status-pill status-pill--on-hold" title="${escapeHtml(mockup.On_Hold_Note || 'On hold — customer paused this mockup')}">On Hold</span> `
            : '';

        return `
        <div class="mockup-card ${cardStatusClass}${rushClass}${onHoldClass}" data-mockup-id="${id}" data-work-order="${workOrder}">
            <div class="card-header">
                <div class="card-header-left">
                    <div class="card-company">${company}</div>
                    <div class="card-design-number">#${designNum}${aeDisplay ? `<span class="card-rep-name" data-action="filter-rep" data-rep="${escapeHtml(aeDisplay)}" title="Click to filter by ${escapeHtml(aeDisplay)}">${escapeHtml(aeDisplay)}</span>` : ''}</div>
                </div>
                <div class="card-header-right">
                    ${onHoldPillHtml}<span class="status-pill ${statusClass}">${escapeHtml(status)}</span>
                </div>
            </div>
            ${thumbHtml}
            <div class="card-body">
                ${designName ? `<div class="card-design-name">${designName}</div>` : ''}
                <div class="card-meta">
                    ${mockup.Garment_Info ? `<div class="card-meta-row"><span class="card-meta-label">Garment:</span> ${escapeHtml(mockup.Garment_Info)}</div>` : ''}
                    ${mockup.Print_Location ? `<div class="card-meta-row"><span class="card-meta-label">Location:</span> ${escapeHtml(mockup.Print_Location)}</div>` : ''}
                    ${dimensions ? `<div class="card-meta-row"><span class="card-meta-label">Dimensions:</span> ${escapeHtml(dimensions)}</div>` : ''}
                    ${stitchCountText ? `<div class="card-meta-row"><span class="card-meta-label">Stitches:</span> ${escapeHtml(stitchCountText)}</div>` : ''}
                    ${threadColorsText ? `<div class="card-meta-row"><span class="card-meta-label">Thread:</span> ${escapeHtml(threadColorsText)}</div>` : ''}
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
                // Click rep name → fill search box, filter to that AE. Search
                // already matches Submitted_By (lines 275, 691) so no filter
                // logic change needed — just populating the input is enough.
                const repBtn = e.target.closest('.card-rep-name[data-action="filter-rep"]');
                if (repBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const name = repBtn.dataset.rep || '';
                    const input = document.getElementById('ruth-search-input');
                    if (input && name) {
                        const current = input.value.trim().toLowerCase();
                        input.value = (current === name.toLowerCase()) ? '' : name;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.focus();
                    }
                    return;
                }
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

            // AE notification is handled SERVER-SIDE by the status chokepoint
            // (caspio-pricing-proxy PUT /api/mockups/:id/status), which emails
            // the submitting AE on In Progress / Awaiting Approval / Completed /
            // Revision Requested regardless of which screen Ruth used. The old
            // client-side emailjs block here never fired (it looked up records
            // by Mockup_ID, but /api/mockups rows key on ID) and swallowed
            // errors — removed 2026-07-15 in favor of the reliable backend path.

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

            moFetch('orders/' + encodeURIComponent(wo))
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
                var text = ((m.Company_Name || '') + ' ' + (m.Design_Number || '') + ' ' + (m.Design_Name || '') + ' ' + (m.Submitted_By || '') + ' ' + (m.ID || '')).toLowerCase();
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

            // Rush-first within each column
            colCards.sort(function (a, b) {
                return (isRush(a.Is_Rush) ? 0 : 1) - (isRush(b.Is_Rush) ? 0 : 1);
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
                var isRushM = isRush(m.Is_Rush);
                var kanbanDim = '';
                if (m.Logo_Width && m.Logo_Height) kanbanDim = m.Logo_Width + '" × ' + m.Logo_Height + '"';
                else if (m.Logo_Width) kanbanDim = m.Logo_Width + '" wide';
                else if (m.Logo_Height) kanbanDim = m.Logo_Height + '" tall';
                else if (m.Size_Specs) kanbanDim = m.Size_Specs;
                var kanbanStitch = '';
                if (m.Stitch_Count != null && m.Stitch_Count !== '') {
                    var ks = parseInt(m.Stitch_Count, 10);
                    kanbanStitch = isNaN(ks) ? String(m.Stitch_Count) : ks.toLocaleString();
                }
                if (isRushM) badges += '<span class="kanban-card-badge kanban-card-badge--rush">&#128293; RUSH</span>';
                if (mockupType) badges += '<span class="kanban-card-badge kanban-card-badge--type">' + escapeHtml(mockupType) + '</span>';
                if (kanbanDim) badges += '<span class="kanban-card-badge kanban-card-badge--dim">📐 ' + escapeHtml(kanbanDim) + '</span>';
                if (kanbanStitch) badges += '<span class="kanban-card-badge kanban-card-badge--dim">🧵 ' + escapeHtml(kanbanStitch) + '</span>';
                if (revCount > 0) badges += '<span class="kanban-card-badge kanban-card-badge--rev">Rev ' + revCount + '</span>';

                var thumbHtml = '';
                if (m.Box_Mockup_1) {
                    thumbHtml = '<img class="kanban-card-thumb" src="' + escapeHtml(m.Box_Mockup_1) + '" loading="lazy" data-original-src="' + escapeHtml(m.Box_Mockup_1) + '" onerror="if(window.ArtActions&&window.ArtActions.handleBoxImageError){window.ArtActions.handleBoxImageError(this);}else{this.style.display=\'none\';}" alt="">';
                }

                var kanbanElapsed = (typeof ElapsedTimeUtils !== 'undefined')
                    ? ElapsedTimeUtils.getKanbanElapsedBadge(col.id, m, 'mockup')
                    : '';

                var hiddenStyle = hidden ? ' style="display: none"' : '';
                var rushCls = isRushM ? ' kanban-card--rush' : '';
                return '<div class="kanban-card' + rushCls + '" data-mockup-id="' + id + '"' + hiddenStyle + ' onclick="window.location.href=\'/mockup/' + id + '\'">'
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

    // ─── Broken Box Mockups widget ───────────────────────────────────────
    // Sister of art-hub-steve.js's broken-mockups widget. Polls
    // /api/mockups/broken-mockups on init; if any rows have Box files that
    // 404, surfaces a pulsing pill above the queue. Click → modal with
    // per-row Auto-recover / Open in Box / Re-upload + bulk recover.
    //
    // Reuses the .broken-mockups-* / .bml-* CSS already loaded by art-hub.css
    // for Steve's widget. UI grammar matches Steve's so the team learns it once.
    //
    // Data model difference: Steve's results have 1 broken slot per record;
    // Ruth's records can have multiple. We FLATTEN data.results into one
    // "row" per (id, slotField) pair so each row corresponds to one
    // recovery operation.

    var brokenMockupsData = null;
    var brokenIds = new Set();

    var SLOT_LABELS = {
        Box_Mockup_1: 'Mockup 1', Box_Mockup_2: 'Mockup 2', Box_Mockup_3: 'Mockup 3',
        Box_Mockup_4: 'Mockup 4', Box_Mockup_5: 'Mockup 5', Box_Mockup_6: 'Mockup 6',
        Box_Reference_File: 'Reference File'
    };
    function friendlySlotLabel(field) { return SLOT_LABELS[field] || field; }

    // Each row in the modal is a single (id, slotField) pair so the action
    // buttons map 1:1 to one Caspio update. Records with N broken slots
    // produce N rows, each with its own Auto-recover button.
    function flattenBrokenSlots(data) {
        var rows = [];
        (data.results || []).forEach(function (rec) {
            (rec.brokenSlots || []).forEach(function (slot) {
                rows.push({
                    id: rec.id,
                    designNumber: rec.designNumber,
                    companyName: rec.companyName,
                    salesRep: rec.salesRep,
                    status: rec.status,
                    submittedDate: rec.submittedDate,
                    slotField: slot.field,
                    fileId: slot.fileId
                });
            });
        });
        return rows;
    }

    function loadBrokenMockupsWidget() {
        var widget = document.getElementById('ruth-broken-mockups-widget');
        if (!widget) return;

        widget.style.display = '';
        widget.innerHTML = '<div class="broken-mockups-loading">'
            + '<span class="broken-mockups-spinner"></span>'
            + 'Checking mockup files in Box...'
            + '</div>';

        fetch(API_BASE + '/api/mockups/broken-mockups')
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                brokenMockupsData = data;
                brokenIds = new Set();
                (data.results || []).forEach(function (r) {
                    if (r && r.id != null) brokenIds.add(String(r.id));
                });
                renderBrokenMockupsWidget(data);
            })
            .catch(function (err) {
                console.warn('[Ruth broken-mockups] check failed:', err.message);
                widget.style.display = 'none';
            });
    }

    function renderBrokenMockupsWidget(data) {
        var widget = document.getElementById('ruth-broken-mockups-widget');
        if (!widget) return;
        if (!data || data.broken === 0) {
            widget.innerHTML = '';
            widget.style.display = 'none';
            return;
        }
        widget.style.display = '';
        var label = data.broken === 1 ? 'broken Box mockup' : 'broken Box mockups';
        widget.innerHTML = '<button type="button" class="broken-mockups-pill" id="ruth-broken-pill"'
            + ' aria-label="Review broken Box mockups">'
            +   '<span class="broken-mockups-pill-icon" aria-hidden="true">⚠</span>'
            +   '<span class="broken-mockups-pill-text">'
            +     '<strong>' + data.broken + '</strong> ' + label
            +   '</span>'
            +   '<span class="broken-mockups-pill-cta">Review &amp; recover →</span>'
            + '</button>';
        document.getElementById('ruth-broken-pill').addEventListener('click', openBrokenMockupsModal);
    }

    function openBrokenMockupsModal() {
        if (!brokenMockupsData) return;
        var rows = flattenBrokenSlots(brokenMockupsData);
        if (rows.length === 0) return;

        var existing = document.getElementById('broken-mockups-modal');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'broken-mockups-modal';
        overlay.className = 'broken-mockups-overlay';
        overlay.innerHTML = bmlBuildModalHtml(brokenMockupsData, rows);
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        bmlWireEvents(overlay);
    }

    function bmlBuildModalHtml(data, rows) {
        var rowsHtml = rows.map(bmlBuildRowHtml).join('');
        var bulkLabel = rows.length === 1
            ? 'Auto-recover this 1'
            : 'Auto-recover all ' + rows.length;
        return '<div class="broken-mockups-modal">'
            + '<div class="broken-mockups-modal-header">'
            +   '<h3>🚫 Broken Box Mockups (' + rows.length + ')</h3>'
            +   '<button type="button" class="broken-mockups-modal-close" id="broken-mockups-modal-close" aria-label="Close">&times;</button>'
            + '</div>'
            + '<div class="broken-mockups-modal-sub">'
            +   'Scanned ' + data.checked + ' active mockups · ' + data.uniqueFileIds + ' Box files checked. '
            +   'Try <strong>Auto-recover</strong> first — it usually finds a replacement in the same Box folder.'
            + '</div>'
            + '<div class="bml-toolbar">'
            +   '<button type="button" class="bml-bulk-btn" id="bml-bulk-recover">⚡ ' + escapeHtml(bulkLabel) + '</button>'
            +   '<button type="button" class="bml-refresh-btn" id="bml-refresh">↻ Refresh list</button>'
            + '</div>'
            + '<div class="broken-mockups-modal-body bml-row-list">' + rowsHtml + '</div>'
            + '</div>';
    }

    function bmlBuildRowHtml(row) {
        var dateStr = '';
        if (row.submittedDate) {
            try {
                var d = new Date(row.submittedDate);
                if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }
            } catch (e) { /* ignore */ }
        }
        var rep = row.salesRep || '';
        var company = row.companyName || '';
        var fileId = String(row.fileId || '');
        var statusKey = (row.status || '').toLowerCase().replace(/\s+/g, '-');
        var statusClass = 'broken-status--' + statusKey;
        var statusText = row.status || '—';

        var fileIdLine = fileId
            ? ' · fileId: <code class="bml-fileid-code">' + escapeHtml(fileId) + '</code>'
                + ' <button type="button" class="bml-copy" data-copy="' + escapeHtml(fileId)
                + '" title="Copy fileId" aria-label="Copy fileId">📋</button>'
            : '';
        var boxUrl = fileId ? 'https://app.box.com/file/' + encodeURIComponent(fileId) : '';

        return '<article class="bml-row" '
            +   'data-id="' + escapeHtml(String(row.id)) + '" '
            +   'data-design-number="' + escapeHtml(String(row.designNumber || '')) + '" '
            +   'data-company="' + escapeHtml(company) + '" '
            +   'data-slot-field="' + escapeHtml(String(row.slotField || '')) + '" '
            +   'data-file-id="' + escapeHtml(fileId) + '">'
            +   '<div class="bml-row__head">'
            +     '<a class="bml-row__title" href="/mockup/' + encodeURIComponent(row.id)
            +       '" target="_blank" rel="noopener" title="Open detail page">'
            +       '<span class="bml-row__company">' + escapeHtml(company || '(no company)') + '</span>'
            +       '<span class="bml-row__design">#' + escapeHtml(String(row.designNumber || '')) + '</span>'
            +     '</a>'
            +     '<span class="broken-status-pill ' + statusClass + '">' + escapeHtml(statusText) + '</span>'
            +   '</div>'
            +   '<div class="bml-row__meta">'
            +     (rep ? '<span>Rep: ' + escapeHtml(rep) + '</span>' : '')
            +     (dateStr ? (rep ? ' · ' : '') + 'Submitted ' + escapeHtml(dateStr) : '')
            +     ' · Broken: ' + escapeHtml(friendlySlotLabel(row.slotField))
            +     fileIdLine
            +   '</div>'
            +   '<div class="bml-row__actions">'
            +     '<button type="button" class="bml-action bml-action--recover" data-action="recover">⚡ Auto-recover</button>'
            +     (boxUrl ? '<a class="bml-action bml-action--box" href="' + boxUrl + '" target="_blank" rel="noopener" title="Opens Box — lands on Restore screen if file is in trash">🔗 Open in Box</a>' : '')
            +     '<button type="button" class="bml-action bml-action--reupload" data-action="reupload">📤 Re-upload</button>'
            +   '</div>'
            +   '<div class="bml-row__dropzone" hidden>'
            +     '<input type="file" class="bml-file-input" accept="image/*,application/pdf,.svg,.eps,.ai" hidden>'
            +     '<div class="bml-dropzone-prompt">📥 Drop file here or <span class="bml-dropzone-link">click to choose</span></div>'
            +     '<div class="bml-dropzone-hint">Will overwrite the broken slot. Image, PDF, SVG, AI, or EPS.</div>'
            +   '</div>'
            +   '<div class="bml-row__result" hidden></div>'
            + '</article>';
    }

    function bmlWireEvents(overlay) {
        function close() {
            overlay.remove();
            document.body.style.overflow = '';
            document.removeEventListener('keydown', escListener);
        }
        function escListener(e) { if (e.key === 'Escape') close(); }

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });
        var closeBtn = overlay.querySelector('#broken-mockups-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', close);
        document.addEventListener('keydown', escListener);

        var bulkBtn = overlay.querySelector('#bml-bulk-recover');
        if (bulkBtn) bulkBtn.addEventListener('click', function () {
            bmlActionRecoverAll(overlay, bulkBtn);
        });

        var refreshBtn = overlay.querySelector('#bml-refresh');
        if (refreshBtn) refreshBtn.addEventListener('click', function () {
            var orig = refreshBtn.innerHTML;
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '⏳ Refreshing...';
            bmlReloadFromServer().then(function () {
                close();
                if (brokenMockupsData && brokenMockupsData.broken > 0) openBrokenMockupsModal();
            }).catch(function () {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = orig;
            });
        });

        overlay.addEventListener('click', function (e) {
            var copyBtn = e.target.closest('.bml-copy');
            if (copyBtn) {
                e.preventDefault(); e.stopPropagation();
                var text = copyBtn.dataset.copy || '';
                try {
                    navigator.clipboard.writeText(text);
                    var orig = copyBtn.innerHTML;
                    copyBtn.innerHTML = '✓';
                    setTimeout(function () { copyBtn.innerHTML = orig; }, 1200);
                } catch (err) { /* ignore */ }
                return;
            }
            var actionBtn = e.target.closest('.bml-action[data-action]');
            if (actionBtn) {
                e.preventDefault();
                var row = actionBtn.closest('.bml-row');
                if (!row) return;
                if (actionBtn.dataset.action === 'recover') return bmlActionRecover(row);
                if (actionBtn.dataset.action === 'reupload') return bmlActionReupload(row);
                return;
            }
            var dropzone = e.target.closest('.bml-row__dropzone');
            if (dropzone && !e.target.classList.contains('bml-file-input')) {
                var input = dropzone.querySelector('.bml-file-input');
                if (input) input.click();
            }
        });

        overlay.addEventListener('change', function (e) {
            if (!e.target.classList.contains('bml-file-input')) return;
            var row = e.target.closest('.bml-row');
            if (!row) return;
            var file = e.target.files && e.target.files[0];
            if (file) bmlPerformUpload(row, file);
        });

        overlay.addEventListener('dragover', function (e) {
            var dz = e.target.closest('.bml-row__dropzone');
            if (!dz || dz.hidden) return;
            e.preventDefault();
            dz.classList.add('is-dragover');
        });
        overlay.addEventListener('dragleave', function (e) {
            var dz = e.target.closest('.bml-row__dropzone');
            if (dz) dz.classList.remove('is-dragover');
        });
        overlay.addEventListener('drop', function (e) {
            var dz = e.target.closest('.bml-row__dropzone');
            if (!dz || dz.hidden) return;
            e.preventDefault();
            dz.classList.remove('is-dragover');
            var row = dz.closest('.bml-row');
            var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (row && file) bmlPerformUpload(row, file);
        });
    }

    function bmlActionRecover(row) {
        var id = row.dataset.id;
        var designNumber = row.dataset.designNumber;
        var companyName = row.dataset.company || '';
        var slotField = row.dataset.slotField;

        if (!id || !slotField) return bmlSetRowState(row, 'error', 'Missing record info on row');
        if (!designNumber) {
            return bmlSetRowState(row, 'error',
                'Missing Design # — cannot search Box folder. Try Re-upload.');
        }

        bmlSetRowState(row, 'recovering');
        fetch(API_BASE + '/api/mockups/' + encodeURIComponent(id) + '/auto-recover-mockup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slotField: slotField, designNumber: designNumber, companyName: companyName })
        })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (resp) { bmlApplyResultToRow(row, resp.body); })
        .catch(function (err) { bmlSetRowState(row, 'error', err.message || String(err)); });
    }

    function bmlActionReupload(row) {
        var dz = row.querySelector('.bml-row__dropzone');
        if (!dz) return;
        dz.hidden = !dz.hidden;
        if (!dz.hidden) {
            try { dz.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* */ }
        }
    }

    function bmlPerformUpload(row, file) {
        var id = row.dataset.id;
        var companyName = row.dataset.company || '';
        var slotField = row.dataset.slotField;
        var designNumber = row.dataset.designNumber || '';
        if (!id || !slotField) return bmlSetRowState(row, 'error', 'Missing record info on row');

        bmlSetRowState(row, 'uploading', { fileName: file.name });

        var fd = new FormData();
        fd.append('file', file);
        fd.append('companyName', companyName);
        fd.append('slot', slotField);
        if (designNumber) fd.append('designNumber', designNumber);

        fetch(API_BASE + '/api/mockups/' + encodeURIComponent(id) + '/upload-file', {
            method: 'POST',
            body: fd
        })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (resp) {
            if (resp.ok && resp.body && resp.body.success) {
                bmlSetRowState(row, 'reuploaded', resp.body);
                bmlScheduleRowFadeAndRefresh(row);
            } else {
                var msg = (resp.body && resp.body.error) || ('HTTP ' + resp.ok);
                bmlSetRowState(row, 'error', msg);
            }
        })
        .catch(function (err) { bmlSetRowState(row, 'error', err.message || String(err)); });
    }

    function bmlActionRecoverAll(overlay, bulkBtn) {
        var rows = Array.prototype.slice.call(overlay.querySelectorAll('.bml-row'));
        if (rows.length === 0) return;

        if (!confirm('Run auto-recover on all ' + rows.length + ' broken slot'
                + (rows.length === 1 ? '' : 's') + '? Recovered records fade out;'
                + ' ones with no folder match stay for manual Re-upload.')) {
            return;
        }

        var entries = rows.map(function (row) {
            return {
                id: row.dataset.id,
                slotField: row.dataset.slotField,
                designNumber: row.dataset.designNumber,
                companyName: row.dataset.company
            };
        });

        bulkBtn.disabled = true;
        var origLabel = bulkBtn.innerHTML;
        bulkBtn.innerHTML = '⏳ Searching ' + rows.length + ' Box folder'
            + (rows.length === 1 ? '' : 's') + '...';
        rows.forEach(function (row) { bmlSetRowState(row, 'recovering'); });

        fetch(API_BASE + '/api/mockups/auto-recover-mockups-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entries: entries })
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            (data.results || []).forEach(function (result, idx) {
                // Match results to rows by index — same order, same length.
                var row = rows[idx];
                if (row) bmlApplyResultToRow(row, result);
            });
            bulkBtn.innerHTML = '✓ Recovered ' + data.recovered + ' of ' + data.total;
            setTimeout(function () {
                bulkBtn.disabled = false;
                bulkBtn.innerHTML = origLabel;
            }, 3500);
        })
        .catch(function (err) {
            bulkBtn.disabled = false;
            bulkBtn.innerHTML = origLabel;
            rows.forEach(function (row) { bmlSetRowState(row, 'error', err.message || String(err)); });
        });
    }

    function bmlApplyResultToRow(row, body) {
        if (!body || !body.status) {
            return bmlSetRowState(row, 'error', (body && body.error) || 'Unknown response');
        }
        if (body.status === 'recovered') {
            bmlSetRowState(row, 'recovered', body);
            bmlScheduleRowFadeAndRefresh(row);
        } else if (body.status === 'no-folder') {
            bmlSetRowState(row, 'no-folder');
        } else if (body.status === 'empty-folder') {
            bmlSetRowState(row, 'empty-folder', body);
        } else if (body.status === 'no-match') {
            bmlSetRowState(row, 'no-match', body);
        } else {
            bmlSetRowState(row, 'error', body.error || 'Unknown status: ' + body.status);
        }
    }

    function bmlSetRowState(row, state, payload) {
        var stateClasses = ['is-recovering', 'is-recovered', 'is-error', 'is-no-folder',
                            'is-empty-folder', 'is-no-match', 'is-uploading', 'is-reuploaded'];
        stateClasses.forEach(function (c) { row.classList.remove(c); });
        row.classList.add('is-' + state);

        var resultEl = row.querySelector('.bml-row__result');
        var actionsEl = row.querySelector('.bml-row__actions');
        var dropzoneEl = row.querySelector('.bml-row__dropzone');
        var html = '';
        var actionsDisabled = false;

        if (state === 'recovering') {
            html = '<span class="bml-spinner"></span> Searching Box folder...';
            actionsDisabled = true;
            if (dropzoneEl) dropzoneEl.hidden = true;
        } else if (state === 'recovered') {
            var conf = (payload && payload.confidence) ? ' (' + payload.confidence + ' confidence)' : '';
            var fileName = (payload && payload.newFileName) ? ' — ' + payload.newFileName : '';
            html = '<span class="bml-result bml-result--ok">✅ Recovered'
                + escapeHtml(conf + fileName) + ' — reloading...</span>';
            actionsDisabled = true;
        } else if (state === 'reuploaded') {
            html = '<span class="bml-result bml-result--ok">✅ Re-uploaded — reloading...</span>';
            actionsDisabled = true;
        } else if (state === 'no-folder') {
            html = '<span class="bml-result bml-result--warn">⚠ No matching folder in Box.'
                + ' Use <strong>Re-upload</strong> to attach a new file.</span>';
        } else if (state === 'empty-folder') {
            var folderName = (payload && payload.folder && payload.folder.name) ? payload.folder.name : '';
            html = '<span class="bml-result bml-result--warn">⚠ Folder "' + escapeHtml(folderName)
                + '" has no images. Use <strong>Re-upload</strong>.</span>';
        } else if (state === 'no-match') {
            var cands = (payload && payload.candidates && payload.candidates.length)
                ? ' (saw: ' + payload.candidates.map(escapeHtml).join(', ') + ')'
                : '';
            html = '<span class="bml-result bml-result--warn">⚠ No filename match in Box folder'
                + cands + '. Use <strong>Re-upload</strong>.</span>';
        } else if (state === 'uploading') {
            var fname = (payload && payload.fileName) ? payload.fileName : 'file';
            html = '<span class="bml-spinner"></span> Uploading ' + escapeHtml(fname) + ' to Box...';
            actionsDisabled = true;
        } else if (state === 'error') {
            var msg = (typeof payload === 'string') ? payload : 'Unknown error';
            html = '<span class="bml-result bml-result--error">❌ ' + escapeHtml(msg) + '</span>';
        }

        if (resultEl) {
            resultEl.innerHTML = html;
            resultEl.hidden = !html;
        }
        if (actionsEl) {
            Array.prototype.slice.call(actionsEl.querySelectorAll('button'))
                .forEach(function (btn) { btn.disabled = actionsDisabled; });
        }
    }

    var _bmlPendingFadeTimer = null;
    function bmlScheduleRowFadeAndRefresh(row) {
        setTimeout(function () {
            row.classList.add('is-fading-out');
            setTimeout(function () {
                if (row && row.parentNode) row.remove();
                bmlMaybeShowEmptyState();
            }, 400);
        }, 1200);

        if (_bmlPendingFadeTimer) clearTimeout(_bmlPendingFadeTimer);
        _bmlPendingFadeTimer = setTimeout(function () {
            _bmlPendingFadeTimer = null;
            bmlReloadFromServer().catch(function () { /* next page load catches up */ });
        }, 2000);
    }

    function bmlMaybeShowEmptyState() {
        var overlay = document.getElementById('broken-mockups-modal');
        if (!overlay) return;
        var rows = overlay.querySelectorAll('.bml-row');
        if (rows.length > 0) return;
        var modalBody = overlay.querySelector('.broken-mockups-modal-body');
        if (modalBody) {
            modalBody.innerHTML = '<div class="bml-empty-state">'
                + '<div class="bml-empty-state-icon">✨</div>'
                + '<div class="bml-empty-state-title">All broken links resolved!</div>'
                + '<div class="bml-empty-state-sub">Nice work — the queue will refresh momentarily.</div>'
                + '</div>';
        }
    }

    function bmlReloadFromServer() {
        return fetch(API_BASE + '/api/mockups/broken-mockups?refresh=true')
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) {
                brokenMockupsData = data;
                brokenIds = new Set();
                (data.results || []).forEach(function (r) {
                    if (r && r.id != null) brokenIds.add(String(r.id));
                });
                renderBrokenMockupsWidget(data);
            });
    }

    // ── Init ─────────────────────────────────────────────────────────────
    function init() {
        setCurrentDate();
        showSkeletonCards();
        fetchMockups();
        loadBrokenMockupsWidget(); // Health check: surface mockups whose Box files are gone

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
