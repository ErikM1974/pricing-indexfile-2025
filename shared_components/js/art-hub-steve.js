/**
 * art-hub-steve.js — Tab Navigation, Modals, Quick Actions & Status Summary
 *
 * Handles all interactive behavior for Steve's Art Hub dashboard:
 *   - Tab switching with Caspio conflict protection
 *   - Notes slide-out panel (API-powered, replaces Caspio iframes)
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
            if (event.key === 'Escape' && currentNotesDesignId) {
                closeNotesPanel();
            }
        });
    });

    // ── Expose globals for HTML onclick attributes ────────────────────
    window.showTab = showTab;
})();
