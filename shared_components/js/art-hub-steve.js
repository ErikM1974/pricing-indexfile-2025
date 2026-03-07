/**
 * art-hub-steve.js — Tab Navigation, Modals, Quick Actions & Status Summary
 *
 * Handles all interactive behavior for Steve's Art Hub dashboard:
 *   - Tab switching with Caspio conflict protection
 *   - View/Add Notes modals (iframe-based Caspio DataPages)
 *   - Quick-action buttons on gallery cards (Working/Done/Send Back)
 *   - Status summary bar above gallery
 *   - EmailJS notifications to sales reps on revision/completion
 *
 * Uses MutationObserver to wait for Caspio DOM, then enhances each card.
 *
 * Depends on: art-hub.css (shared styles), APP_CONFIG or inline constant, EmailJS SDK
 */
(function () {
    'use strict';

    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    const EMAILJS_SERVICE_ID = 'service_1c4k67j';
    const EMAILJS_PUBLIC_KEY = '4qSbDO-SQs19TbP80';

    const REP_EMAIL_MAP = {
        'Taneisha': 'taneisha@nwcustomapparel.com',
        'Nika':     'nika@nwcustomapparel.com',
        'Ruthie':   'ruthie@nwcustomapparel.com',
        'Erik':     'erik@nwcustomapparel.com'
    };

    // ── Tab Navigation ────────────────────────────────────────────────
    let noteWasSubmitted = false;

    function showTab(tabName, event) {
        if (event) {
            event.stopPropagation();

            // Check if the click originated from within a Caspio form
            let target = event.target;
            while (target && target !== document.body) {
                if (target.id && (target.id.includes('caspio') || target.id.includes('cb'))) {
                    return;
                }
                if (target.className && typeof target.className === 'string' &&
                    (target.className.includes('cbResultSet') || target.className.includes('cbForm'))) {
                    return;
                }
                target = target.parentElement;
            }
        }

        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

        const tabMap = {
            'gallery':       { index: 0, pane: 'gallery-tab' },
            'mockupgallery': { index: 1, pane: 'mockupgallery-tab' },
            'table':         { index: 2, pane: 'table-tab' },
            'express':       { index: 3, pane: 'express-tab' },
            'requirements':  { index: 4, pane: 'requirements-tab' }
        };

        const tab = tabMap[tabName];
        if (tab) {
            document.querySelectorAll('.tab-button')[tab.index].classList.add('active');
            document.getElementById(tab.pane).classList.add('active');
        }

        localStorage.setItem('artistDashboardTab', tabName);
    }

    // ── Notes Modals ──────────────────────────────────────────────────
    function viewNotesModal(designId) {
        document.getElementById('viewNotesRequestId').textContent = designId;
        document.getElementById('viewNotesFrame').src = 'https://c3eku948.caspio.com/dp/a0e15000d8d96d34814b43498414?ID_Design=' + designId;
        document.getElementById('viewNotesModal').style.display = 'block';
    }

    function closeViewNotesModal() {
        document.getElementById('viewNotesModal').style.display = 'none';
        document.getElementById('viewNotesFrame').src = '';
    }

    function openNoteModal(designId) {
        noteWasSubmitted = false;
        document.getElementById('requestId').textContent = designId;
        document.getElementById('noteFrame').src = 'https://c3eku948.caspio.com/dp/a0e15000bc57622bf42c450cb7a5?ID_Design=' + designId;
        document.getElementById('noteModal').style.display = 'block';
    }

    function closeNoteModal() {
        document.getElementById('noteModal').style.display = 'none';
        document.getElementById('noteFrame').src = '';

        if (noteWasSubmitted) {
            window.location.reload();
            noteWasSubmitted = false;
        }
    }

    // ── Status Summary Bar (removed — clutter for Steve) ─────────────
    function buildSummaryBar() {
        const existing = document.getElementById('art-status-summary');
        if (existing) existing.remove();
    }

    // ── Card Footer Buttons (unified row) ────────────────────────────────
    function injectQuickActions(card) {
        if (card.querySelector('.card-footer-buttons')) return;

        const statusPill = card.querySelector('.status-pill');
        let status = '';
        if (statusPill) {
            status = statusPill.textContent.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().toLowerCase().replace(/\s+/g, '');
        }

        const isCompleted = status === 'completed';
        const isCancelled = status === 'cancel';
        const isInactive = isCompleted || isCancelled;

        // Hide Overdue badge on completed cards
        if (isCompleted) {
            const duePill = card.querySelector('.due-status-pill');
            if (duePill) duePill.style.display = 'none';
            card.classList.add('card--completed');
        }
        if (isCancelled) {
            card.classList.add('card--cancel');
        }

        const idDiv = card.querySelector('.id-design');
        if (!idDiv) return;
        const designId = idDiv.textContent.replace(/[^0-9]/g, '');
        if (!designId) return;

        const footer = card.querySelector('.card-footer');
        if (!footer) return;

        // Build unified button container
        const container = document.createElement('div');
        container.className = 'card-footer-buttons';

        function btn(label, colorClass, onClick) {
            const b = document.createElement('button');
            b.textContent = label;
            b.className = `footer-btn footer-btn--${colorClass}`;
            b.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick(b);
            });
            return b;
        }

        // Left group: notes buttons
        const notesGroup = document.createElement('div');
        notesGroup.className = 'footer-notes-group';

        if (!isInactive) {
            notesGroup.appendChild(btn('Add Note', 'notes', () => openNoteModal(designId)));
        }
        notesGroup.appendChild(btn('View Notes', 'notes', () => viewNotesModal(designId)));

        // Right group: action buttons + View Details
        const actionsGroup = document.createElement('div');
        actionsGroup.className = 'footer-actions-group';

        if (!isInactive) {
            actionsGroup.appendChild(btn('Working', 'working', async (b) => {
                b.disabled = true;
                b.textContent = 'Updating...';
                try {
                    const resp = await fetch(`${API_BASE}/api/art-requests/${designId}/status`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'In Progress\u{1F535}' })
                    });
                    if (!resp.ok) throw new Error(`Status ${resp.status}`);
                    b.textContent = 'Updated!';
                    b.style.background = '#28a745';
                    setTimeout(() => window.location.reload(), 800);
                } catch (err) {
                    b.textContent = 'Error';
                    b.style.background = '#dc3545';
                    console.error('Quick action failed:', err);
                    setTimeout(() => { b.textContent = 'Working'; b.style.background = ''; b.disabled = false; }, 2000);
                }
            }));

            actionsGroup.appendChild(btn('Done', 'done', () => showArtTimeModal(designId)));
            actionsGroup.appendChild(btn('Send Back', 'sendback', () => showSendBackModal(designId)));
        }

        // View Details — always shown, clicks Caspio's hidden DetailsLink
        actionsGroup.appendChild(btn('View Details', 'details', () => {
            const dataRow = card.closest('div[data-cb-name="data-row"]');
            const caspioLink = dataRow && dataRow.querySelector('a[data-cb-name="DetailsLink"]');
            if (caspioLink) {
                caspioLink.click();
            }
        }));

        container.appendChild(notesGroup);
        container.appendChild(actionsGroup);
        footer.appendChild(container);
    }

    // ── Art Time Modal (Done action) ────────────────────────────────────
    function showArtTimeModal(designId) {
        removeModals();

        const overlay = createOverlay();
        const modal = document.createElement('div');
        modal.id = 'art-time-modal';
        modal.className = 'art-modal art-modal--sm';

        modal.innerHTML = `
            <div class="art-modal-header art-modal-header--green">
                Mark Complete — #${designId}
            </div>
            <div class="art-modal-body">
                <label class="art-modal-label">Art Minutes</label>
                <div class="stepper-row">
                    <button id="at-minus" class="stepper-btn">-</button>
                    <input id="at-minutes" type="number" value="15" min="0" step="15" class="stepper-input" />
                    <button id="at-plus" class="stepper-btn">+</button>
                </div>
                <div id="at-cost" class="art-cost-display">= $18.75 (0.25 hrs)</div>
                <label class="art-modal-checkbox-label">
                    <input type="checkbox" id="at-notify" checked />
                    Notify sales rep design is complete
                </label>
                <div class="art-modal-actions">
                    <button id="at-cancel" class="art-modal-btn-cancel">Cancel</button>
                    <button id="at-submit" class="art-modal-btn-submit art-modal-btn-submit--green">Complete</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        const minutesInput = modal.querySelector('#at-minutes');
        const costDiv = modal.querySelector('#at-cost');

        function updateCost() {
            const mins = parseInt(minutesInput.value) || 0;
            const quarterHours = Math.ceil(mins / 15) * 0.25;
            const cost = (quarterHours * 75).toFixed(2);
            costDiv.textContent = `= $${cost} (${quarterHours.toFixed(2)} hrs)`;
        }

        minutesInput.addEventListener('input', updateCost);
        modal.querySelector('#at-plus').addEventListener('click', () => {
            minutesInput.value = (parseInt(minutesInput.value) || 0) + 15;
            updateCost();
        });
        modal.querySelector('#at-minus').addEventListener('click', () => {
            const v = (parseInt(minutesInput.value) || 0) - 15;
            minutesInput.value = v < 0 ? 0 : v;
            updateCost();
        });

        modal.querySelector('#at-cancel').addEventListener('click', removeModals);
        overlay.addEventListener('click', removeModals);

        modal.querySelector('#at-submit').addEventListener('click', async function () {
            const mins = parseInt(minutesInput.value) || 0;
            if (mins === 0 && !confirm('Art time is 0 minutes. Continue anyway?')) return;

            const shouldNotify = modal.querySelector('#at-notify').checked;

            this.disabled = true;
            this.textContent = 'Saving...';

            try {
                const resp = await fetch(`${API_BASE}/api/art-requests/${designId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'Completed \u2705', artMinutes: mins })
                });
                if (!resp.ok) throw new Error(`Status ${resp.status}`);

                // Log art time as a note for audit trail
                if (mins > 0) {
                    const quarterHours = Math.ceil(mins / 15) * 0.25;
                    const cost = (quarterHours * 75).toFixed(2);
                    await fetch(`${API_BASE}/api/art-requests/${designId}/note`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            noteType: 'Art Time',
                            noteText: `Completed: ${mins} minutes ($${cost})`,
                            noteBy: 'art@nwcustomapparel.com'
                        })
                    }).catch(err => console.warn('Art time note failed (non-blocking):', err));
                }

                // Send completion notification email
                if (shouldNotify) {
                    sendNotificationEmail(designId, 'completed', {
                        artMinutes: mins
                    });
                }

                this.textContent = 'Done!';
                this.style.background = '#009900';
                setTimeout(() => { removeModals(); window.location.reload(); }, 600);
            } catch (err) {
                this.textContent = 'Error — retry';
                this.style.background = '#dc3545';
                this.disabled = false;
                console.error('Complete action failed:', err);
            }
        });
    }

    // ── Send Back Modal (Revision action) ───────────────────────────────
    async function showSendBackModal(designId) {
        removeModals();

        const overlay = createOverlay();
        const modal = document.createElement('div');
        modal.id = 'send-back-modal';
        modal.className = 'art-modal art-modal--md';

        // Default revision display — will be updated after fetch
        let revisionNum = '?';

        modal.innerHTML = `
            <div class="art-modal-header art-modal-header--orange">
                <span>Send Back — #${designId}</span>
                <span class="art-modal-header-badge" id="sb-rev-badge"></span>
            </div>
            <div class="art-modal-body">
                <label class="art-modal-label">Revision Notes *</label>
                <textarea id="sb-notes" rows="4" placeholder="Describe what needs to change..."
                    class="send-back-textarea"></textarea>

                <label class="art-modal-label art-modal-label--spaced">Art Minutes (this session)</label>
                <div class="stepper-row">
                    <button id="sb-minus" class="stepper-btn">-</button>
                    <input id="sb-minutes" type="number" value="0" min="0" step="15" class="stepper-input" />
                    <button id="sb-plus" class="stepper-btn">+</button>
                </div>
                <div id="sb-cost" class="art-cost-display">= $0.00 (0.00 hrs)</div>

                <label class="art-modal-checkbox-label">
                    <input type="checkbox" id="sb-notify" checked />
                    Notify sales rep via email
                </label>

                <div class="art-modal-actions art-modal-actions--spaced">
                    <button id="sb-cancel" class="art-modal-btn-cancel">Cancel</button>
                    <button id="sb-submit" class="art-modal-btn-submit art-modal-btn-submit--orange">Send Back</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        // Stepper logic
        const minutesInput = modal.querySelector('#sb-minutes');
        const costDiv = modal.querySelector('#sb-cost');

        function updateCost() {
            const mins = parseInt(minutesInput.value) || 0;
            const quarterHours = Math.ceil(mins / 15) * 0.25;
            const cost = (quarterHours * 75).toFixed(2);
            costDiv.textContent = `= $${cost} (${quarterHours.toFixed(2)} hrs)`;
        }

        minutesInput.addEventListener('input', updateCost);
        modal.querySelector('#sb-plus').addEventListener('click', () => {
            minutesInput.value = (parseInt(minutesInput.value) || 0) + 15;
            updateCost();
        });
        modal.querySelector('#sb-minus').addEventListener('click', () => {
            const v = (parseInt(minutesInput.value) || 0) - 15;
            minutesInput.value = v < 0 ? 0 : v;
            updateCost();
        });

        modal.querySelector('#sb-cancel').addEventListener('click', removeModals);
        overlay.addEventListener('click', removeModals);

        // Fetch current revision count to display
        let artReqData = null;
        try {
            const artReqResp = await fetch(`${API_BASE}/api/artrequests?id_design=${designId}&select=Revision_Count,Sales_Rep,CompanyName&limit=1`);
            if (artReqResp.ok) {
                const artReqs = await artReqResp.json();
                if (artReqs && artReqs.length > 0) {
                    artReqData = artReqs[0];
                    revisionNum = (artReqData.Revision_Count || 0) + 1;
                    modal.querySelector('#sb-rev-badge').textContent = `Rev #${revisionNum}`;
                    modal.querySelector('#sb-submit').textContent = `Send Back — Rev #${revisionNum}`;
                }
            }
        } catch (e) {
            console.warn('Could not fetch revision count (non-blocking):', e);
        }

        // Submit handler
        modal.querySelector('#sb-submit').addEventListener('click', async function () {
            const notes = modal.querySelector('#sb-notes').value.trim();
            if (!notes) {
                modal.querySelector('#sb-notes').style.borderColor = '#dc3545';
                return;
            }

            const mins = parseInt(minutesInput.value) || 0;
            const shouldNotify = modal.querySelector('#sb-notify').checked;

            this.disabled = true;
            this.textContent = 'Sending...';

            try {
                // Update status (backend increments Revision_Count and adds art time)
                const statusBody = { status: 'Revision Requested \u{1F504}' };
                if (mins > 0) statusBody.artMinutes = mins;

                const statusResp = await fetch(`${API_BASE}/api/art-requests/${designId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(statusBody)
                });
                if (!statusResp.ok) throw new Error(`Status update ${statusResp.status}`);

                // Create revision note
                const noteResp = await fetch(`${API_BASE}/api/art-requests/${designId}/note`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        noteType: 'Design Update',
                        noteText: `Revision Requested (Rev #${revisionNum}): ${notes}`,
                        noteBy: 'art@nwcustomapparel.com'
                    })
                });
                if (!noteResp.ok) throw new Error(`Note creation ${noteResp.status}`);

                // Log art time as a separate note if > 0
                if (mins > 0) {
                    const quarterHours = Math.ceil(mins / 15) * 0.25;
                    const cost = (quarterHours * 75).toFixed(2);
                    await fetch(`${API_BASE}/api/art-requests/${designId}/note`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            noteType: 'Art Time',
                            noteText: `Logged ${mins} minutes ($${cost}) — Rev #${revisionNum}`,
                            noteBy: 'art@nwcustomapparel.com'
                        })
                    }).catch(err => console.warn('Art time note failed (non-blocking):', err));
                }

                // Send notification email
                if (shouldNotify) {
                    sendNotificationEmail(designId, 'revision', {
                        revisionNotes: notes,
                        revisionCount: revisionNum,
                        artMinutes: mins,
                        salesRep: artReqData?.Sales_Rep,
                        companyName: artReqData?.CompanyName
                    });
                }

                this.textContent = 'Sent!';
                this.style.background = '#28a745';
                setTimeout(() => { removeModals(); window.location.reload(); }, 600);
            } catch (err) {
                this.textContent = 'Error — retry';
                this.style.background = '#dc3545';
                this.disabled = false;
                console.error('Send back failed:', err);
            }
        });
    }

    // ── Email Notification ────────────────────────────────────────────────
    async function sendNotificationEmail(designId, type, data) {
        if (typeof emailjs === 'undefined') {
            console.warn('EmailJS not loaded — skipping notification');
            return;
        }

        try {
            // If we don't have artReqData, fetch it
            let salesRep = data.salesRep;
            let companyName = data.companyName;

            if (!salesRep) {
                const resp = await fetch(`${API_BASE}/api/artrequests?id_design=${designId}&select=Sales_Rep,CompanyName&limit=1`);
                if (resp.ok) {
                    const reqs = await resp.json();
                    if (reqs && reqs.length > 0) {
                        salesRep = reqs[0].Sales_Rep;
                        companyName = reqs[0].CompanyName;
                    }
                }
            }

            const repEmail = REP_EMAIL_MAP[salesRep] || 'sales@nwcustomapparel.com';
            const detailLink = `${window.location.origin}/art-request/${designId}`;

            let templateId, templateParams;

            if (type === 'revision') {
                templateId = 'template_art_revision';
                templateParams = {
                    to_email: repEmail,
                    to_name: salesRep || 'Sales Team',
                    design_id: designId,
                    company_name: companyName || 'Unknown',
                    revision_notes: data.revisionNotes || '',
                    revision_count: data.revisionCount || 1,
                    detail_link: detailLink,
                    from_name: 'Steve — Art Department'
                };
            } else if (type === 'completed') {
                const mins = data.artMinutes || 0;
                const quarterHours = Math.ceil(mins / 15) * 0.25;
                const cost = (quarterHours * 75).toFixed(2);
                templateId = 'template_art_completed';
                templateParams = {
                    to_email: repEmail,
                    to_name: salesRep || 'Sales Team',
                    design_id: designId,
                    company_name: companyName || 'Unknown',
                    art_minutes: mins,
                    art_cost: `$${cost}`,
                    detail_link: detailLink,
                    from_name: 'Steve — Art Department'
                };
            }

            if (templateId) {
                await emailjs.send(EMAILJS_SERVICE_ID, templateId, templateParams, EMAILJS_PUBLIC_KEY);
                console.log(`Notification email sent (${type}) for design ${designId}`);
            }
        } catch (err) {
            console.warn(`Notification email failed (${type}, non-blocking):`, err);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────
    function createOverlay() {
        const o = document.createElement('div');
        o.id = 'quick-action-overlay';
        o.className = 'art-modal-overlay';
        return o;
    }

    function removeModals() {
        ['art-time-modal', 'send-back-modal', 'quick-action-overlay'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
    }

    // ── MutationObserver: Watch for Caspio gallery cards ────────────────
    function processCards() {
        const galleryTab = document.getElementById('gallery-tab');
        if (!galleryTab) return;

        const cards = galleryTab.querySelectorAll('.card');
        cards.forEach(injectQuickActions);
        buildSummaryBar();
    }

    function initObserver() {
        const galleryTab = document.getElementById('gallery-tab');
        if (!galleryTab) return;

        let debounce;
        const observer = new MutationObserver(() => {
            clearTimeout(debounce);
            debounce = setTimeout(processCards, 300);
        });

        observer.observe(galleryTab, { childList: true, subtree: true });
    }

    // ── Init ────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        // Restore saved tab preference
        const savedTab = localStorage.getItem('artistDashboardTab');
        if (savedTab && ['mockupgallery', 'table', 'express', 'requirements'].includes(savedTab)) {
            showTab(savedTab);
        }

        initObserver();

        document.addEventListener('DataPageReady', () => {
            setTimeout(processCards, 500);
        });

        // Close modals when clicking outside
        window.addEventListener('click', function (event) {
            if (event.target === document.getElementById('noteModal')) {
                closeNoteModal();
            } else if (event.target === document.getElementById('viewNotesModal')) {
                closeViewNotesModal();
            }
        });

        // Listen for messages from Caspio iframe
        window.addEventListener('message', function (event) {
            if (event.data === 'closeModal' || event.data === 'formSubmitted') {
                noteWasSubmitted = true;
                closeNoteModal();
            }
        });
    });

    // ── Expose globals for HTML onclick attributes ────────────────────
    window.showTab = showTab;
    window.viewNotesModal = viewNotesModal;
    window.closeViewNotesModal = closeViewNotesModal;
    window.openNoteModal = openNoteModal;
    window.closeNoteModal = closeNoteModal;
})();
