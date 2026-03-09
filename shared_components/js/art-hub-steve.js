/**
 * art-hub-steve.js — Tab Navigation, Modals, Quick Actions & Status Summary
 *
 * Handles all interactive behavior for Steve's Art Hub dashboard:
 *   - Tab switching with Caspio conflict protection
 *   - Notes slide-out panel (API-powered, replaces Caspio iframes)
 *   - Quick-action buttons on gallery cards (Working/Done/Send Back/Send for Approval)
 *   - Send for Approval modal (file thumbnails, art time, message to AE)
 *   - Status summary bar above gallery
 *   - EmailJS notifications to sales reps on revision/completion/approval
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

    /**
     * Resolve a Sales_Rep value (display name OR email) to both name and email.
     * Handles: 'Nika' (direct key), 'nika@nwcustomapparel.com' (reverse lookup),
     *          unknown emails (prefix extraction), empty/null (fallback).
     */
    function resolveRep(repValue) {
        if (!repValue || !repValue.trim()) {
            return { displayName: 'Sales Team', email: 'sales@nwcustomapparel.com' };
        }
        const val = repValue.trim();
        // Direct key match (display name like 'Nika')
        if (REP_EMAIL_MAP[val]) return { displayName: val, email: REP_EMAIL_MAP[val] };
        // Reverse lookup (email like 'nika@nwcustomapparel.com' → 'Nika')
        for (const [name, addr] of Object.entries(REP_EMAIL_MAP)) {
            if (val.toLowerCase() === addr.toLowerCase()) return { displayName: name, email: addr };
        }
        // Unknown email — extract name from prefix
        if (val.includes('@')) {
            const local = val.substring(0, val.indexOf('@'));
            return { displayName: local.charAt(0).toUpperCase() + local.slice(1), email: val };
        }
        // Unknown non-email string
        return { displayName: val, email: 'sales@nwcustomapparel.com' };
    }

    /**
     * Post a structured art charge record (fire-and-forget, non-blocking).
     * Called after each successful art time submission.
     * Skips 0-minute entries — no charge to log.
     */
    function logArtCharge(designId, mins, description, chargeType, currentTotalMins) {
        if (mins <= 0) return;

        const newTotalMins = currentTotalMins + mins;
        const cost = parseFloat((Math.ceil(mins / 15) * 0.25 * 75).toFixed(2));
        const totalCost = parseFloat((Math.ceil(newTotalMins / 15) * 0.25 * 75).toFixed(2));

        fetch(`${API_BASE}/api/art-charges`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ID_Design: parseInt(designId),
                Minutes: mins,
                Cost: cost,
                Description: (description || '').substring(0, 255),
                Charge_Type: chargeType,
                Logged_By: 'art@nwcustomapparel.com',
                Running_Total_Minutes: newTotalMins,
                Running_Total_Cost: totalCost
            })
        }).catch(err => console.warn('Art charge log failed (non-blocking):', err));
    }

    // ── Tab Navigation ────────────────────────────────────────────────
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

    // ── Notes Slide-Out Panel ───────────────────────────────────────────
    let currentNotesDesignId = null;

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function getNoteTypeClass(noteType) {
        const lower = (noteType || '').toLowerCase();
        if (lower.includes('mockup sent'))        return 'note-type-pill--mockup-sent';
        if (lower.includes('status update'))      return 'note-type-pill--status-update';
        if (lower.includes('design update'))      return 'note-type-pill--design-update';
        if (lower.includes('art time'))           return 'note-type-pill--art-time';
        if (lower.includes('customer feedback'))  return 'note-type-pill--customer-feedback';
        if (lower.includes('internal note'))      return 'note-type-pill--internal-note';
        if (lower.includes('revision'))           return 'note-type-pill--design-update';
        return 'note-type-pill--default';
    }

    function getRepDisplayName(email) {
        if (!email) return 'Unknown';
        for (const [name, addr] of Object.entries(REP_EMAIL_MAP)) {
            if (addr === email) return name;
        }
        // Fallback: extract name before @
        const atIdx = email.indexOf('@');
        if (atIdx > 0) {
            const raw = email.substring(0, atIdx);
            return raw.charAt(0).toUpperCase() + raw.slice(1);
        }
        return email;
    }

    function formatNoteDate(dateStr) {
        if (!dateStr) return '--';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    }

    function openNotesPanel(designId, card) {
        // If already open for a different card, just refresh
        currentNotesDesignId = designId;

        // Populate header
        const company = card.querySelector('.company-name');
        document.getElementById('notes-panel-company').textContent = company ? company.textContent.trim() : '';
        document.getElementById('notes-panel-id').textContent = 'ID: ' + designId;

        // Reset form
        document.getElementById('note-type-select').value = '';
        document.getElementById('note-text').value = '';
        document.getElementById('note-text').style.borderColor = '';
        document.getElementById('note-type-select').style.borderColor = '';
        document.getElementById('note-notify-checkbox').checked = false;
        document.getElementById('note-submit-btn').disabled = false;
        document.getElementById('note-submit-btn').textContent = 'Add Note';

        // Show panel
        document.getElementById('notes-overlay').classList.add('active');
        document.getElementById('notes-panel').classList.add('open');
        document.body.style.overflow = 'hidden';

        // Fetch notes
        fetchNotes(designId);
    }

    function closeNotesPanel() {
        document.getElementById('notes-panel').classList.remove('open');
        document.getElementById('notes-overlay').classList.remove('active');
        document.body.style.overflow = '';
        currentNotesDesignId = null;
    }

    async function fetchNotes(designId) {
        const timeline = document.getElementById('notes-timeline');
        const loading = document.getElementById('notes-loading');
        const empty = document.getElementById('notes-empty');
        const badge = document.getElementById('notes-count-badge');

        timeline.innerHTML = '';
        loading.style.display = 'block';
        empty.style.display = 'none';
        badge.textContent = '...';

        try {
            const resp = await fetch(`${API_BASE}/api/design-notes?id_design=${designId}`);
            if (!resp.ok) throw new Error(`API returned ${resp.status}`);
            const data = await resp.json();
            const notes = data.Result || data || [];

            loading.style.display = 'none';

            if (!Array.isArray(notes) || notes.length === 0) {
                empty.style.display = 'block';
                badge.textContent = '0';
                return;
            }

            badge.textContent = notes.length;
            renderNotesTimeline(notes);
        } catch (err) {
            console.error('Failed to fetch notes:', err);
            loading.style.display = 'none';
            timeline.innerHTML = `
                <div class="notes-error">
                    Unable to load notes. Please try again.
                    <br><button onclick="document.querySelector('#notes-timeline').innerHTML=''; fetchNotesRetry()">Retry</button>
                </div>`;
            badge.textContent = '!';
        }
    }

    // Global retry function for the error button
    window.fetchNotesRetry = function () {
        if (currentNotesDesignId) fetchNotes(currentNotesDesignId);
    };

    function renderNotesTimeline(notes) {
        const timeline = document.getElementById('notes-timeline');
        timeline.innerHTML = '';

        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card';
            card.dataset.noteId = note.Note_ID;

            const noteType = note.Note_Type || 'Note';
            const typeClass = getNoteTypeClass(noteType);
            const authorName = getRepDisplayName(note.Note_By);
            const dateStr = formatNoteDate(note.Note_Date);
            const noteText = escapeHtml(note.Note_Text || '');

            card.innerHTML = `
                <div class="note-card-header">
                    <span class="note-type-pill ${typeClass}">${escapeHtml(noteType)}</span>
                    <button class="note-delete-btn" title="Delete note" data-note-id="${note.Note_ID}">&times;</button>
                </div>
                <div class="note-card-text">${noteText}</div>
                <div class="note-card-meta">
                    <span class="note-card-author">${escapeHtml(authorName)}</span>
                    <span>${dateStr}</span>
                </div>
            `;

            // Delete handler
            card.querySelector('.note-delete-btn').addEventListener('click', () => deleteNote(note.Note_ID));

            timeline.appendChild(card);
        });
    }

    async function submitNote() {
        const noteType = document.getElementById('note-type-select').value;
        const noteText = document.getElementById('note-text').value.trim();
        const notify = document.getElementById('note-notify-checkbox').checked;
        const submitBtn = document.getElementById('note-submit-btn');

        // Validate
        let valid = true;
        if (!noteType) {
            document.getElementById('note-type-select').style.borderColor = '#dc3545';
            valid = false;
        } else {
            document.getElementById('note-type-select').style.borderColor = '';
        }
        if (!noteText) {
            document.getElementById('note-text').style.borderColor = '#dc3545';
            valid = false;
        } else {
            document.getElementById('note-text').style.borderColor = '';
        }
        if (!valid) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        try {
            const resp = await fetch(`${API_BASE}/api/design-notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ID_Design: parseInt(currentNotesDesignId, 10),
                    Note_Type: noteType,
                    Note_Text: noteText,
                    Note_By: 'art@nwcustomapparel.com'
                })
            });

            if (!resp.ok) throw new Error(`Create note failed: ${resp.status}`);

            // Clear form
            document.getElementById('note-type-select').value = '';
            document.getElementById('note-text').value = '';
            document.getElementById('note-notify-checkbox').checked = false;
            submitBtn.textContent = 'Saved!';
            setTimeout(() => { submitBtn.textContent = 'Add Note'; submitBtn.disabled = false; }, 1200);

            // Refresh timeline
            fetchNotes(currentNotesDesignId);

            // Send email notification if checkbox checked
            if (notify) {
                sendNoteEmail(currentNotesDesignId, noteType, noteText);
            }
        } catch (err) {
            console.error('Failed to create note:', err);
            submitBtn.textContent = 'Error — try again';
            submitBtn.style.background = '#dc3545';
            setTimeout(() => {
                submitBtn.textContent = 'Add Note';
                submitBtn.style.background = '';
                submitBtn.disabled = false;
            }, 2000);
        }
    }

    async function deleteNote(noteId) {
        if (!confirm('Delete this note? This cannot be undone.')) return;

        try {
            const resp = await fetch(`${API_BASE}/api/design-notes/${noteId}`, {
                method: 'DELETE'
            });
            if (!resp.ok) throw new Error(`Delete failed: ${resp.status}`);

            // Remove from DOM
            const card = document.querySelector(`.note-card[data-note-id="${noteId}"]`);
            if (card) card.remove();

            // Update count
            const remaining = document.querySelectorAll('.note-card').length;
            document.getElementById('notes-count-badge').textContent = remaining;
            if (remaining === 0) {
                document.getElementById('notes-empty').style.display = 'block';
            }
        } catch (err) {
            console.error('Failed to delete note:', err);
            alert('Unable to delete note. Please try again.');
        }
    }

    function sendNoteEmail(designId, noteType, noteText) {
        if (typeof emailjs === 'undefined') {
            console.warn('EmailJS not loaded — skipping note notification');
            return;
        }

        // Look up company name from panel header
        const companyName = document.getElementById('notes-panel-company').textContent || 'Unknown';

        // Look up the sales rep email from the card that opened this panel
        // We need to find the card with this designId to get the rep email
        const cards = document.querySelectorAll('.card');
        let repEmail = 'sales@nwcustomapparel.com';
        let repName = 'Sales Team';
        cards.forEach(card => {
            const idEl = card.querySelector('.id-design');
            if (idEl && idEl.textContent.replace(/[^0-9]/g, '') === String(designId)) {
                const repEl = card.querySelector('.rep-name');
                if (repEl) {
                    const email = repEl.dataset.email || repEl.textContent;
                    if (email && email.includes('@')) {
                        repEmail = email;
                        repName = getRepDisplayName(email);
                    }
                }
            }
        });

        const templateParams = {
            to_email: repEmail,
            to_name: repName,
            design_id: designId,
            company_name: companyName,
            note_type: noteType,
            note_text: noteText,
            from_name: 'Art Department',
            detail_link: `https://www.teamnwca.com/art-hub-detail.html?ID_Design=${designId}`
        };

        emailjs.send(EMAILJS_SERVICE_ID, 'template_art_note_added', templateParams, EMAILJS_PUBLIC_KEY)
            .then(() => console.log('Note notification email sent'))
            .catch(err => console.warn('Note notification email failed (non-blocking):', err));
    }

    // ── Image Modal (migrated from Caspio Footer) ─────────────────────
    window.showModal = function (src) {
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('modalImage');
        if (modal && modalImg) {
            modalImg.src = src;
            modal.classList.add('show');
        }
    };

    // ── Card Data Processing (migrated from Caspio Footer) ──────────
    function styleCardPills(card) {
        const block = card.closest('div[data-cb-name="data-row"]');
        if (!block) return;

        // Due date pill — read from Caspio calculated field
        const duePill = card.querySelector('.due-status-pill');
        const calcField = block.querySelector('.cbResultSetCalculatedField');
        if (duePill && calcField) {
            const text = calcField.textContent.trim();
            duePill.textContent = text;
            duePill.className = 'pill due-status-pill due-' + text.toLowerCase().replace(/ /g, '-');
        }

        // Status pill — add CSS class from text
        const statusPill = card.querySelector('.status-pill');
        if (statusPill) {
            const text = statusPill.textContent.trim();
            const clean = text.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().toLowerCase().replace(/\s+/g, '');
            statusPill.className = 'pill status-pill status-' + clean;
        }
    }

    function calculateArtHours(card) {
        const chargeSpan = card.querySelector('.charge-amount');
        const hoursSpan = card.querySelector('.charge-hours');
        if (!chargeSpan || !hoursSpan) return;

        const charge = parseFloat(chargeSpan.textContent.replace('$', '')) || 0;
        if (charge > 0) {
            const quarterHours = Math.ceil(charge / 18.75);
            hoursSpan.textContent = (quarterHours * 0.25).toFixed(2) + ' hrs';
        } else {
            hoursSpan.textContent = '0.00 hrs';
        }
    }

    // ── Rep Name Formatting (email → display name) ────────────────────
    function formatRepName(card) {
        const repEl = card.querySelector('.rep-name');
        if (!repEl || repEl.dataset.formatted) return;
        repEl.dataset.formatted = '1';

        const email = (repEl.dataset.email || repEl.textContent || '').trim();
        if (!email) return;

        // Reverse lookup from REP_EMAIL_MAP
        let displayName = '';
        for (const [name, addr] of Object.entries(REP_EMAIL_MAP)) {
            if (email.toLowerCase() === addr.toLowerCase()) {
                displayName = name;
                break;
            }
        }

        // Fallback: extract name from email (before @)
        if (!displayName) {
            const atIndex = email.indexOf('@');
            if (atIndex > 0) {
                const local = email.substring(0, atIndex);
                displayName = local.charAt(0).toUpperCase() + local.slice(1);
            } else {
                displayName = email;
            }
        }

        repEl.textContent = displayName;
        repEl.title = email;
        repEl.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = 'mailto:' + email;
        });
    }

    // ── Clean Empty Fields (hide SW#, Contact if blank) ─────────────
    function cleanEmptyFields(card) {
        // Hide SW design # if empty
        const swNum = card.querySelector('.design-num');
        if (swNum && !swNum.textContent.trim()) swNum.style.display = 'none';

        // Hide contact info-item if both names empty
        const contactItem = card.querySelector('.info-item-contact');
        if (contactItem) {
            const val = contactItem.querySelector('.value');
            if (val && !val.textContent.trim()) contactItem.style.display = 'none';
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

        // Button row: notes on left, actions on right
        const buttonRow = document.createElement('div');
        buttonRow.className = 'footer-button-row';

        // Left group: single Notes button
        const notesGroup = document.createElement('div');
        notesGroup.className = 'footer-notes-group';
        notesGroup.appendChild(btn('Notes', 'notes', () => openNotesPanel(designId, card)));

        // Right group: action buttons (no View Details here)
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
                        body: JSON.stringify({ status: 'In Progress' })
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

            // Log Time — show when actively working (In Progress or Revision Requested)
            const canLogTime = status.includes('inprogress') || status.includes('revisionrequested');
            if (canLogTime) {
                actionsGroup.appendChild(btn('Log Time', 'logtime', () => showLogTimeModal(designId, card)));
            }

            actionsGroup.appendChild(btn('Mark Complete', 'done', () => showArtTimeModal(designId, card)));

            // Send Mockup — show when In Progress, Revision Requested, or Awaiting Approval
            const canSendMockup = status.includes('inprogress') || status.includes('revisionrequested') || status.includes('awaitingapproval');
            if (canSendMockup) {
                actionsGroup.appendChild(btn('Send Mockup', 'approve', () => showSendForApprovalModal(designId, card)));
            }
        }

        buttonRow.appendChild(notesGroup);
        buttonRow.appendChild(actionsGroup);
        container.appendChild(buttonRow);

        // View Details — subtle text link below button row
        const detailsLink = document.createElement('a');
        detailsLink.className = 'card-details-link';
        detailsLink.textContent = 'View Details \u2192';
        detailsLink.href = '#';
        detailsLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const dataRow = card.closest('div[data-cb-name="data-row"]');
            const caspioLink = dataRow && dataRow.querySelector('a[data-cb-name="DetailsLink"]');
            if (caspioLink) {
                caspioLink.click();
            }
        });
        container.appendChild(detailsLink);

        footer.appendChild(container);

        // Make card body clickable to open details
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
            if (e.target.closest('.footer-button-row, .card-details-link')) return;
            const dataRow = card.closest('div[data-cb-name="data-row"]');
            const caspioLink = dataRow && dataRow.querySelector('a[data-cb-name="DetailsLink"]');
            if (caspioLink) {
                caspioLink.click();
            }
        });
    }

    // ── Art Time Modal (Mark Complete action) ────────────────────────────
    async function showArtTimeModal(designId, card) {
        removeModals();

        // Fetch current art time from API
        let currentMins = 0;
        try {
            const resp = await fetch(`${API_BASE}/api/artrequests?id_design=${designId}&limit=1`);
            if (resp.ok) {
                const reqs = await resp.json();
                if (reqs && reqs.length > 0) currentMins = reqs[0].Art_Minutes || 0;
            }
        } catch (err) {
            console.warn('Could not fetch current art time:', err);
        }

        const prevHours = (Math.ceil(currentMins / 15) * 0.25).toFixed(2);
        const prevCost = (parseFloat(prevHours) * 75).toFixed(2);

        const overlay = createOverlay();
        const modal = document.createElement('div');
        modal.id = 'art-time-modal';
        modal.className = 'art-modal art-modal--sm';
        modal.dataset.currentMins = currentMins;

        modal.innerHTML = `
            <div class="art-modal-header art-modal-header--green">
                Mark Complete — #${designId}
            </div>
            <div class="art-modal-body">
                <div class="art-prev-time">${currentMins > 0
                    ? `Previously logged: ${currentMins} min ($${prevCost})`
                    : 'No art time logged yet'}</div>
                <label class="art-modal-label">Additional time:</label>
                <div class="stepper-row">
                    <button id="at-minus" class="stepper-btn">-</button>
                    <input id="at-minutes" type="number" value="0" min="0" step="15" class="stepper-input" />
                    <button id="at-plus" class="stepper-btn">+</button>
                </div>
                <div id="at-cost" class="art-cost-display">= $0.00</div>
                <div id="at-new-total" class="art-new-total"></div>
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
        const newTotalDiv = modal.querySelector('#at-new-total');

        function updateCost() {
            const mins = parseInt(minutesInput.value) || 0;
            const quarterHours = Math.ceil(mins / 15) * 0.25;
            const cost = (quarterHours * 75).toFixed(2);
            costDiv.textContent = `= $${cost}`;
            const totalMins = currentMins + mins;
            const totalQh = Math.ceil(totalMins / 15) * 0.25;
            const totalCost = (totalQh * 75).toFixed(2);
            newTotalDiv.textContent = `Final total: ${totalMins} min (${totalQh.toFixed(2)} hrs, $${totalCost})`;
        }
        updateCost();

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

            const shouldNotify = modal.querySelector('#at-notify').checked;

            this.disabled = true;
            this.textContent = 'Saving...';

            try {
                // Additive art time — backend adds mins to existing total
                const resp = await fetch(`${API_BASE}/api/art-requests/${designId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'Completed', artMinutes: mins })
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
                            noteText: `Completed: ${mins} additional minutes ($${cost})`,
                            noteBy: 'art@nwcustomapparel.com'
                        })
                    }).catch(err => console.warn('Art time note failed (non-blocking):', err));
                    logArtCharge(designId, mins, 'Completed', 'Completion', currentMins);
                }

                // Send completion notification email
                if (shouldNotify) {
                    // Get rep email from card for correct routing
                    const cardRepEl = card ? card.querySelector('.rep-name[data-email]') : null;
                    sendNotificationEmail(designId, 'completed', {
                        artMinutes: currentMins + mins,
                        salesRep: cardRepEl ? cardRepEl.dataset.email : ''
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

    // ── Log Time Modal (standalone art time logging) ────────────────────
    async function showLogTimeModal(designId, card) {
        removeModals();

        // Fetch current art time from API
        let currentMins = 0;
        try {
            const resp = await fetch(`${API_BASE}/api/artrequests?id_design=${designId}&limit=1`);
            if (resp.ok) {
                const reqs = await resp.json();
                if (reqs && reqs.length > 0) currentMins = reqs[0].Art_Minutes || 0;
            }
        } catch (err) {
            console.warn('Could not fetch current art time:', err);
        }

        // Get current status from card for the PUT (status stays unchanged)
        const statusPill = card.querySelector('.status-pill');
        const currentStatus = statusPill ? statusPill.textContent.trim() : 'In Progress 🔵';

        const prevHours = (Math.ceil(currentMins / 15) * 0.25).toFixed(2);
        const prevCost = (parseFloat(prevHours) * 75).toFixed(2);

        const overlay = createOverlay();
        const modal = document.createElement('div');
        modal.id = 'log-time-modal';
        modal.className = 'art-modal art-modal--sm';
        modal.dataset.currentMins = currentMins;
        modal.dataset.currentStatus = currentStatus;

        modal.innerHTML = `
            <div class="art-modal-header art-modal-header--teal">
                Log Art Time — #${designId}
            </div>
            <div class="art-modal-body">
                <div class="art-prev-time">${currentMins > 0
                    ? `Previously logged: ${currentMins} min ($${prevCost})`
                    : 'No art time logged yet'}</div>
                <div class="stepper-row">
                    <button id="lt-minus" class="stepper-btn">-</button>
                    <input id="lt-minutes" type="number" value="0" min="0" step="15" class="stepper-input" />
                    <button id="lt-plus" class="stepper-btn">+</button>
                </div>
                <div id="lt-cost" class="art-cost-display">= $0.00</div>
                <div id="lt-new-total" class="art-new-total"></div>
                <label class="art-modal-label" style="margin-top:12px;">Note (optional)</label>
                <input type="text" id="lt-note" class="art-modal-note-input" placeholder="What did you work on?" />
                <div class="art-modal-actions">
                    <button id="lt-cancel" class="art-modal-btn-cancel">Cancel</button>
                    <button id="lt-submit" class="art-modal-btn-submit art-modal-btn-submit--teal">Log Time</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        const minutesInput = modal.querySelector('#lt-minutes');
        const costDiv = modal.querySelector('#lt-cost');
        const newTotalDiv = modal.querySelector('#lt-new-total');

        function updateLogTimeCost() {
            const mins = parseInt(minutesInput.value) || 0;
            const qh = Math.ceil(mins / 15) * 0.25;
            costDiv.textContent = `= $${(qh * 75).toFixed(2)}`;
            const totalMins = currentMins + mins;
            const totalQh = Math.ceil(totalMins / 15) * 0.25;
            const totalCost = (totalQh * 75).toFixed(2);
            newTotalDiv.textContent = `New total: ${totalMins} min (${totalQh.toFixed(2)} hrs, $${totalCost})`;
        }
        updateLogTimeCost();

        minutesInput.addEventListener('input', updateLogTimeCost);
        modal.querySelector('#lt-plus').addEventListener('click', () => {
            minutesInput.value = (parseInt(minutesInput.value) || 0) + 15;
            updateLogTimeCost();
        });
        modal.querySelector('#lt-minus').addEventListener('click', () => {
            const v = (parseInt(minutesInput.value) || 0) - 15;
            minutesInput.value = v < 0 ? 0 : v;
            updateLogTimeCost();
        });

        modal.querySelector('#lt-cancel').addEventListener('click', removeModals);
        overlay.addEventListener('click', removeModals);

        modal.querySelector('#lt-submit').addEventListener('click', async function () {
            const mins = parseInt(minutesInput.value) || 0;
            if (mins === 0 && !confirm('Art time is 0 minutes. Continue anyway?')) return;

            const noteText = modal.querySelector('#lt-note').value.trim();

            this.disabled = true;
            this.textContent = 'Saving...';

            try {
                // PUT status (unchanged) with additive art minutes
                const resp = await fetch(`${API_BASE}/api/art-requests/${designId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: currentStatus, artMinutes: mins })
                });
                if (!resp.ok) throw new Error(`Status ${resp.status}`);

                // Log art time note
                if (mins > 0) {
                    const qh = Math.ceil(mins / 15) * 0.25;
                    const cost = (qh * 75).toFixed(2);
                    const noteBody = noteText
                        ? `Logged ${mins} minutes ($${cost}) — ${noteText}`
                        : `Logged ${mins} minutes ($${cost})`;
                    await fetch(`${API_BASE}/api/art-requests/${designId}/note`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            noteType: 'Art Time',
                            noteText: noteBody,
                            noteBy: 'art@nwcustomapparel.com'
                        })
                    }).catch(err => console.warn('Art time note failed (non-blocking):', err));
                    const currentMinsForCharge = parseInt(modal.dataset.currentMins) || 0;
                    logArtCharge(designId, mins, noteText || 'Art time logged', 'Log Time', currentMinsForCharge);
                }

                this.textContent = 'Saved!';
                this.style.background = '#0891b2';
                setTimeout(() => { removeModals(); window.location.reload(); }, 600);
            } catch (err) {
                this.textContent = 'Error — retry';
                this.style.background = '#dc3545';
                this.disabled = false;
                console.error('Log time failed:', err);
            }
        });
    }

    // ── Send Mockup Modal (merged Send Back + Send for Approval) ────────
    async function showSendForApprovalModal(designId, card) {
        const overlay = document.getElementById('approval-overlay');
        const modal = document.getElementById('approval-modal');
        if (!overlay || !modal) return;

        // Reset modal state
        document.getElementById('approval-message').value = '';
        document.getElementById('approval-minutes').value = '0';
        document.getElementById('approval-cost').textContent = '= $0.00';
        document.getElementById('approval-files').innerHTML = '';
        document.getElementById('approval-no-files').style.display = 'none';
        document.getElementById('approval-recipient').textContent = '';
        document.getElementById('approval-cc-row').style.display = 'none';
        document.getElementById('approval-cc-toggle').checked = false;
        document.getElementById('approval-cc-options').innerHTML = '';
        document.getElementById('approval-prev-time').textContent = '';
        document.getElementById('approval-new-total').textContent = '';
        const submitBtn = document.getElementById('approval-submit');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Mockup';
        submitBtn.style.background = '';

        // Get company name from card
        const companyEl = card.querySelector('.company-name');
        document.getElementById('approval-company').textContent = companyEl ? companyEl.textContent.trim() : '';

        // Show modal while data loads
        overlay.style.display = 'block';
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Fetch art request data for files and revision count
        let artReqData = null;
        try {
            const resp = await fetch(`${API_BASE}/api/artrequests?id_design=${designId}&limit=1`);
            if (resp.ok) {
                const reqs = await resp.json();
                if (reqs && reqs.length > 0) {
                    artReqData = reqs[0];
                }
            }
        } catch (e) {
            console.warn('Could not fetch art request data:', e);
        }

        // Revision badge
        const revBadge = document.getElementById('approval-modal-rev');
        const revCount = artReqData ? (artReqData.Revision_Count || 0) : 0;
        if (revCount > 0) {
            revBadge.textContent = `Rev #${revCount}`;
            revBadge.style.display = 'inline-block';
        } else {
            revBadge.style.display = 'none';
        }

        // Populate recipient display and CC options
        // Use User_Email (sales rep email in Caspio), fall back to Sales_Rep, then card data-email
        let salesRep = artReqData ? (artReqData.User_Email || artReqData.Sales_Rep) : '';
        if (!salesRep) {
            const repEl = card.querySelector('.rep-name[data-email]');
            if (repEl) salesRep = repEl.dataset.email;
        }
        const rep = resolveRep(salesRep);
        const recipientEl = document.getElementById('approval-recipient');
        recipientEl.textContent = `Sending to: ${rep.displayName} (${rep.email})`;

        // Build CC checkboxes (all reps except primary)
        const ccRow = document.getElementById('approval-cc-row');
        const ccOptions = document.getElementById('approval-cc-options');
        const ccToggle = document.getElementById('approval-cc-toggle');
        const otherReps = Object.keys(REP_EMAIL_MAP).filter(r => r !== rep.displayName);
        if (otherReps.length > 0) {
            ccRow.style.display = 'flex';
            ccOptions.innerHTML = otherReps.map(rep =>
                `<label class="approval-cc-rep-label">
                    <input type="checkbox" class="approval-cc-rep" value="${escapeHtml(rep)}" disabled> ${escapeHtml(rep)}
                </label>`
            ).join('');
            ccToggle.addEventListener('change', function () {
                ccOptions.querySelectorAll('.approval-cc-rep').forEach(cb => {
                    cb.disabled = !this.checked;
                    if (!this.checked) cb.checked = false;
                });
            });
        }

        // Populate running art time total
        const currentArtMins = artReqData ? (artReqData.Art_Minutes || 0) : 0;
        modal.dataset.currentArtMins = currentArtMins;
        const prevTimeEl = document.getElementById('approval-prev-time');
        if (currentArtMins > 0) {
            const prevQh = Math.ceil(currentArtMins / 15) * 0.25;
            const prevCost = (prevQh * 75).toFixed(2);
            prevTimeEl.textContent = `Previously logged: ${currentArtMins} min ($${prevCost})`;
        } else {
            prevTimeEl.textContent = 'No art time logged yet';
        }
        updateApprovalTotal();

        // Build file thumbnails from all available file/CDN fields
        const fileFields = [
            { key: 'File_Upload', label: 'Original Upload' },
            { key: 'Mockup_Link', label: 'Mockup' },
            { key: 'CDN_Link', label: 'Artwork 1' },
            { key: 'CDN_Link_Two', label: 'Artwork 2' },
            { key: 'CDN_Link_Three', label: 'Artwork 3' },
            { key: 'CDN_Link_Four', label: 'Artwork 4' }
        ];

        const filesGrid = document.getElementById('approval-files');
        const noFilesMsg = document.getElementById('approval-no-files');
        filesGrid.innerHTML = '';
        let fileCount = 0;

        if (artReqData) {
            fileFields.forEach(field => {
                const url = artReqData[field.key];
                if (!url || !url.trim()) return;
                // Filter bare CDN base URLs (no actual file)
                if (/^https?:\/\/cdn\.caspio\.com\/[A-Z0-9]+\/?$/i.test(url.trim())) return;
                fileCount++;

                const fileCard = document.createElement('div');
                fileCard.className = 'approval-file-card selected';
                fileCard.dataset.url = url;
                fileCard.innerHTML = `
                    <input type="checkbox" class="mockup-checkbox"
                           value="${escapeHtml(url)}" checked>
                    <img src="${escapeHtml(url)}" alt="${escapeHtml(field.label)}" loading="lazy"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="approval-file-placeholder" style="display:none;">File</div>
                    <div class="approval-file-label">${escapeHtml(field.label)}</div>
                    <div class="approval-selected-badge">✓</div>
                `;

                // Checkbox toggle on card click
                fileCard.addEventListener('click', (e) => {
                    if (e.target.classList.contains('mockup-checkbox')) return;
                    const cb = fileCard.querySelector('.mockup-checkbox');
                    cb.checked = !cb.checked;
                    fileCard.classList.toggle('selected', cb.checked);
                });
                fileCard.querySelector('.mockup-checkbox').addEventListener('change', function () {
                    fileCard.classList.toggle('selected', this.checked);
                });

                filesGrid.appendChild(fileCard);
            });
        }

        if (fileCount === 0) {
            noFilesMsg.style.display = 'block';
            filesGrid.style.display = 'none';
            submitBtn.disabled = true;
            submitBtn.textContent = 'No Files Available';
        } else {
            noFilesMsg.style.display = 'none';
            filesGrid.style.display = 'grid';
        }

        // Store data on modal for submit handler
        // Use resolved salesRep (includes card fallback) so email sends to correct rep
        modal.dataset.designId = designId;
        modal.dataset.artReqJson = JSON.stringify({
            Sales_Rep: salesRep || '',
            CompanyName: artReqData ? artReqData.CompanyName : (companyEl ? companyEl.textContent.trim() : ''),
            Revision_Count: artReqData ? (artReqData.Revision_Count || 0) : 0
        });
    }

    function closeApprovalModal() {
        document.getElementById('approval-overlay').style.display = 'none';
        document.getElementById('approval-modal').style.display = 'none';
        document.body.style.overflow = '';
    }

    async function submitSendForApproval() {
        const modal = document.getElementById('approval-modal');
        const designId = modal.dataset.designId;
        const submitBtn = document.getElementById('approval-submit');
        const mins = parseInt(document.getElementById('approval-minutes').value) || 0;
        const message = document.getElementById('approval-message').value.trim();

        // Get selected mockup URLs from checkboxes
        const selectedBoxes = document.querySelectorAll('.mockup-checkbox:checked');
        const mockupUrls = Array.from(selectedBoxes).map(cb => cb.value);
        if (mockupUrls.length === 0) {
            alert('Please select at least one mockup image to send.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Mockup';
            return;
        }

        // Parse stored art request data
        let artReqMeta = {};
        try { artReqMeta = JSON.parse(modal.dataset.artReqJson || '{}'); } catch (e) { /* ignore */ }
        const revCount = artReqMeta.Revision_Count || 0;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        try {
            // 1. Update status to Awaiting Approval (backend handles additive art time)
            const statusBody = { status: 'Awaiting Approval' };
            if (mins > 0) statusBody.artMinutes = mins;

            const statusResp = await fetch(`${API_BASE}/api/art-requests/${designId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(statusBody)
            });
            if (!statusResp.ok) throw new Error(`Status update ${statusResp.status}`);

            // 2. Create "Mockup Sent" note
            const revLabel = revCount > 0 ? ` (Rev #${revCount})` : '';
            const noteText = message
                ? `Mockup sent for approval${revLabel}: ${message}`
                : `Mockup sent for approval${revLabel}`;

            const noteResp = await fetch(`${API_BASE}/api/art-requests/${designId}/note`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    noteType: 'Mockup Sent',
                    noteText: noteText,
                    noteBy: 'art@nwcustomapparel.com'
                })
            });
            if (!noteResp.ok) throw new Error(`Note creation ${noteResp.status}`);

            // 3. Log art time as separate note if > 0
            if (mins > 0) {
                const quarterHours = Math.ceil(mins / 15) * 0.25;
                const cost = (quarterHours * 75).toFixed(2);
                await fetch(`${API_BASE}/api/art-requests/${designId}/note`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        noteType: 'Art Time',
                        noteText: `Logged ${mins} minutes ($${cost})${revLabel}`,
                        noteBy: 'art@nwcustomapparel.com'
                    })
                }).catch(err => console.warn('Art time note failed (non-blocking):', err));
                const currentArtMinsForCharge = parseInt(modal.dataset.currentArtMins) || 0;
                logArtCharge(designId, mins, message || 'Mockup sent for approval', 'Mockup Sent', currentArtMinsForCharge);
            }

            // 4. Collect CC recipients (if toggle is checked)
            const ccEmails = [];
            const ccToggle = document.getElementById('approval-cc-toggle');
            if (ccToggle && ccToggle.checked) {
                document.querySelectorAll('.approval-cc-rep:checked').forEach(cb => {
                    const repName = cb.value;
                    const repAddr = REP_EMAIL_MAP[repName];
                    if (repAddr) ccEmails.push({ name: repName, email: repAddr });
                });
            }

            // 5. Send approval email to sales rep (fire-and-forget)
            sendNotificationEmail(designId, 'approval', {
                message: message,
                revisionCount: revCount,
                artMinutes: mins,
                salesRep: artReqMeta.Sales_Rep,
                companyName: artReqMeta.CompanyName,
                mockupUrls: mockupUrls,
                ccEmails: ccEmails
            });

            submitBtn.textContent = 'Sent!';
            submitBtn.style.background = '#28a745';
            setTimeout(() => { closeApprovalModal(); window.location.reload(); }, 600);
        } catch (err) {
            submitBtn.textContent = 'Error — retry';
            submitBtn.style.background = '#dc3545';
            submitBtn.disabled = false;
            console.error('Send for approval failed:', err);
        }
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
                const resp = await fetch(`${API_BASE}/api/artrequests?id_design=${designId}&select=User_Email,Sales_Rep,CompanyName&limit=1`);
                if (resp.ok) {
                    const reqs = await resp.json();
                    if (reqs && reqs.length > 0) {
                        salesRep = reqs[0].User_Email || reqs[0].Sales_Rep;
                        companyName = reqs[0].CompanyName;
                    }
                }
            }

            const rep = resolveRep(salesRep);
            const repEmail = rep.email;
            const detailLink = `${window.location.origin}/art-request/${designId}`;

            let templateId, templateParams;

            if (type === 'revision') {
                templateId = 'template_art_revision';
                templateParams = {
                    to_email: repEmail,
                    to_name: rep.displayName,
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
                    to_name: rep.displayName,
                    design_id: designId,
                    company_name: companyName || 'Unknown',
                    art_minutes: mins,
                    art_cost: `$${cost}`,
                    detail_link: detailLink,
                    from_name: 'Steve — Art Department'
                };
            }

            if (type === 'approval') {
                const mins = data.artMinutes || 0;
                const quarterHours = Math.ceil(mins / 15) * 0.25;
                const cost = (quarterHours * 75).toFixed(2);
                const urls = data.mockupUrls || [];
                // Build HTML string of selected mockup images for the email
                const imagesHtml = urls.map((url, i) =>
                    `<div style="display:inline-block;margin:8px;"><img src="${url}" alt="Mockup ${i + 1}" style="max-width:260px;border-radius:8px;border:1px solid #e5e7eb;"></div>`
                ).join('');
                templateId = 'art_approval_request';
                templateParams = {
                    to_email: repEmail,
                    to_name: rep.displayName,
                    design_id: designId,
                    company_name: companyName || 'Unknown',
                    revision_count: data.revisionCount || 0,
                    message: data.message || 'Mockup is ready for your review.',
                    art_time_display: `${mins} min (${quarterHours.toFixed(2)} hrs, $${cost})`,
                    detail_link: detailLink,
                    from_name: 'Art Department',
                    mockup_url: urls[0] || '',
                    mockup_images_html: imagesHtml,
                    mockup_count: urls.length
                };
            }

            if (templateId) {
                await emailjs.send(EMAILJS_SERVICE_ID, templateId, templateParams, EMAILJS_PUBLIC_KEY);
                console.log(`Notification email sent (${type}) for design ${designId}`);

                // Send CC emails for approval type (separate sends — EmailJS free tier has no native CC)
                if (type === 'approval' && data.ccEmails && data.ccEmails.length > 0) {
                    for (const cc of data.ccEmails) {
                        try {
                            const ccParams = Object.assign({}, templateParams, {
                                to_email: cc.email,
                                to_name: cc.name
                            });
                            await emailjs.send(EMAILJS_SERVICE_ID, templateId, ccParams, EMAILJS_PUBLIC_KEY);
                            console.log(`CC email sent to ${cc.name} (${cc.email}) for design ${designId}`);
                        } catch (ccErr) {
                            console.warn(`CC email to ${cc.name} failed (non-blocking):`, ccErr);
                        }
                    }
                }
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
        ['art-time-modal', 'log-time-modal', 'quick-action-overlay'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
    }

    // Helper: update approval modal's new total line
    function updateApprovalTotal() {
        const modal = document.getElementById('approval-modal');
        if (!modal) return;
        const currentArtMins = parseInt(modal.dataset.currentArtMins) || 0;
        const sessionMins = parseInt(document.getElementById('approval-minutes').value) || 0;
        const totalMins = currentArtMins + sessionMins;
        const totalQh = Math.ceil(totalMins / 15) * 0.25;
        const totalCost = (totalQh * 75).toFixed(2);
        const el = document.getElementById('approval-new-total');
        if (el) el.textContent = `New total: ${totalMins} min (${totalQh.toFixed(2)} hrs, $${totalCost})`;
    }

    // ── MutationObserver: Watch for Caspio gallery cards ────────────────
    function processCards() {
        const galleryTab = document.getElementById('gallery-tab');
        if (!galleryTab) return;

        const cards = galleryTab.querySelectorAll('.card');
        cards.forEach(card => {
            styleCardPills(card);
            calculateArtHours(card);
            formatRepName(card);
            cleanEmptyFields(card);
            injectQuickActions(card);
        });
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

    // ── Real-Time Notification Polling (toast for sales rep actions) ────
    const POLL_INTERVAL_MS = 45000; // 45 seconds
    let pollTimerId = null;
    let lastNotificationTime = parseInt(sessionStorage.getItem('artNotifLastSeen')) || Date.now();

    function startNotificationPolling() {
        // Initial poll shortly after page load (5s delay for Caspio to settle)
        setTimeout(() => pollNotifications(), 5000);
        pollTimerId = setInterval(pollNotifications, POLL_INTERVAL_MS);

        // Pause polling when tab is hidden, resume when visible
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                clearInterval(pollTimerId);
                pollTimerId = null;
            } else {
                pollNotifications();
                pollTimerId = setInterval(pollNotifications, POLL_INTERVAL_MS);
            }
        });
    }

    async function pollNotifications() {
        try {
            const resp = await fetch(`${API_BASE}/api/art-notifications?since=${lastNotificationTime}`);
            if (!resp.ok) return;
            const data = await resp.json();

            if (data.notifications && data.notifications.length > 0) {
                data.notifications.forEach(n => showArtNotificationToast(n));
                lastNotificationTime = data.serverTime || Date.now();
                sessionStorage.setItem('artNotifLastSeen', String(lastNotificationTime));
            }
        } catch (err) {
            // Silent failure — polling is best-effort
        }
    }

    function showArtNotificationToast(notification) {
        const container = getOrCreateToastContainer();
        const toast = document.createElement('div');
        toast.className = 'art-notif-toast';

        const isApproval = notification.type === 'approved';
        const icon = isApproval ? '✅' : '🔄';
        const verb = isApproval ? 'approved' : 'requested changes on';
        const accentColor = isApproval ? '#28a745' : '#fd7e14';

        toast.style.borderLeftColor = accentColor;
        toast.innerHTML =
            '<div class="art-notif-toast-content">' +
                '<span class="art-notif-toast-icon">' + icon + '</span>' +
                '<div class="art-notif-toast-text">' +
                    '<strong>' + escapeHtml(notification.actorName) + '</strong> ' +
                    verb + ' design <strong>#' + escapeHtml(notification.designId) + '</strong>' +
                    (notification.companyName ? ' (' + escapeHtml(notification.companyName) + ')' : '') +
                '</div>' +
                '<button class="art-notif-toast-close" aria-label="Dismiss">&times;</button>' +
            '</div>';

        // Click toast body to open detail page
        toast.querySelector('.art-notif-toast-content').addEventListener('click', (e) => {
            if (e.target.classList.contains('art-notif-toast-close')) return;
            window.open('/art-request/' + notification.designId, '_blank');
        });

        // Dismiss button
        toast.querySelector('.art-notif-toast-close').addEventListener('click', () => {
            dismissToast(toast);
        });

        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));

        // Auto-dismiss after 8 seconds
        setTimeout(() => dismissToast(toast), 8000);
    }

    function dismissToast(toast) {
        if (!toast || toast.classList.contains('removing')) return;
        toast.classList.add('removing');
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
            const container = document.getElementById('art-notif-container');
            if (container && container.children.length === 0) container.remove();
        }, 300);
    }

    function getOrCreateToastContainer() {
        let container = document.getElementById('art-notif-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'art-notif-container';
            document.body.appendChild(container);
        }
        return container;
    }

    // ── Init ────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        // Restore saved tab preference
        const savedTab = localStorage.getItem('artistDashboardTab');
        if (savedTab && ['mockupgallery', 'table', 'express', 'requirements'].includes(savedTab)) {
            showTab(savedTab);
        }

        initObserver();
        startNotificationPolling();

        document.addEventListener('DataPageReady', () => {
            setTimeout(processCards, 500);
        });

        // Image modal close button
        document.getElementById('imageModalClose')?.addEventListener('click', () => {
            document.getElementById('imageModal').classList.remove('show');
        });

        // Close image modal when clicking outside
        window.addEventListener('click', function (event) {
            if (event.target === document.getElementById('imageModal')) {
                document.getElementById('imageModal').classList.remove('show');
            }
        });

        // Notes panel: overlay click to close
        document.getElementById('notes-overlay').addEventListener('click', closeNotesPanel);

        // Notes panel: close button
        document.getElementById('notes-panel-close').addEventListener('click', closeNotesPanel);

        // Notes panel: submit button
        document.getElementById('note-submit-btn').addEventListener('click', submitNote);

        // Notes panel: Escape key to close
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                if (currentNotesDesignId) closeNotesPanel();
                // Close approval modal on Escape
                const approvalModal = document.getElementById('approval-modal');
                if (approvalModal && approvalModal.style.display !== 'none') {
                    closeApprovalModal();
                }
            }
        });

        // ── Approval Modal Event Listeners ──────────────────────────────
        document.getElementById('approval-overlay').addEventListener('click', closeApprovalModal);
        document.getElementById('approval-modal-close').addEventListener('click', closeApprovalModal);
        document.getElementById('approval-cancel').addEventListener('click', closeApprovalModal);
        document.getElementById('approval-submit').addEventListener('click', submitSendForApproval);

        // Live cost calculation for approval modal minutes + stepper buttons
        const approvalMinsInput = document.getElementById('approval-minutes');
        function updateApprovalCost() {
            const mins = parseInt(approvalMinsInput.value) || 0;
            const quarterHours = Math.ceil(mins / 15) * 0.25;
            const cost = (quarterHours * 75).toFixed(2);
            document.getElementById('approval-cost').textContent = `= $${cost}`;
            updateApprovalTotal();
        }
        approvalMinsInput.addEventListener('input', updateApprovalCost);
        document.getElementById('approval-plus').addEventListener('click', () => {
            approvalMinsInput.value = (parseInt(approvalMinsInput.value) || 0) + 15;
            updateApprovalCost();
        });
        document.getElementById('approval-minus').addEventListener('click', () => {
            const v = (parseInt(approvalMinsInput.value) || 0) - 15;
            approvalMinsInput.value = v < 0 ? 0 : v;
            updateApprovalCost();
        });
    });

    // ── Expose globals for HTML onclick attributes ────────────────────
    window.showTab = showTab;
})();
