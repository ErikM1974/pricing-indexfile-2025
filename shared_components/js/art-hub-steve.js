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

        // Quoted charge (AE's estimate from Prelim_Charges)
        const quotedCharge = parseFloat(chargeSpan.textContent.replace('$', '')) || 0;
        const quotedHours = quotedCharge > 0 ? (Math.ceil(quotedCharge / 18.75) * 0.25) : 0;

        // Actual art time (Steve's logged time from Art_Minutes hidden span)
        const actualMinsSpan = card.querySelector('.actual-minutes');
        const actualMins = actualMinsSpan ? (parseInt(actualMinsSpan.textContent) || 0) : 0;
        const actualHours = actualMins > 0 ? (Math.ceil(actualMins / 15) * 0.25) : 0;
        const actualCost = actualHours * 75;

        // Build dual-line display in the .value container
        const valueDiv = chargeSpan.closest('.value');
        if (!valueDiv) {
            // Fallback: just set hours span like before
            hoursSpan.textContent = quotedHours.toFixed(2) + ' hrs';
            return;
        }

        let html = '<div class="charge-line charge-line--quoted">';
        html += '<span class="charge-label">Quoted</span>';
        html += '<span class="charge-val">$' + quotedCharge.toFixed(2) + '</span>';
        html += '<span class="charge-sep">&middot;</span>';
        html += '<span class="charge-hrs">' + quotedHours.toFixed(2) + ' hrs</span>';
        html += '</div>';

        html += '<div class="charge-line charge-line--actual">';
        html += '<span class="charge-label">Actual</span>';
        if (actualMins > 0) {
            html += '<span class="charge-val">$' + actualCost.toFixed(2) + '</span>';
            html += '<span class="charge-sep">&middot;</span>';
            html += '<span class="charge-hrs">' + actualHours.toFixed(2) + ' hrs</span>';
        } else {
            html += '<span class="charge-val charge-val--none">No time logged</span>';
        }
        html += '</div>';

        valueDiv.innerHTML = html;
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
            b.type = 'button'; // Prevent submit inside Caspio forms
            b.textContent = label;
            b.className = `footer-btn footer-btn--${colorClass}`;
            b.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick(b);
            });
            return b;
        }

        // Helper: build a labeled section row (STATUS, TIME)
        function section(labelText) {
            const row = document.createElement('div');
            row.className = 'footer-section';
            const label = document.createElement('span');
            label.className = 'footer-section-label';
            label.textContent = labelText;
            const btns = document.createElement('div');
            btns.className = 'footer-section-btns';
            row.appendChild(label);
            row.appendChild(btns);
            return { row: row, btns: btns };
        }

        // ── Row 1: STATUS — workflow actions ──
        const statusSection = section('STATUS');

        if (!isInactive) {
            // Active: Working + Send Mockup
            statusSection.btns.appendChild(btn('Working', 'working', async (b) => {
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

            const canSendMockup = status.includes('inprogress') || status.includes('revisionrequested') || status.includes('awaitingapproval');
            if (canSendMockup) {
                statusSection.btns.appendChild(btn('Send Mockup', 'approve', () => showSendForApprovalModal(designId, card)));
            }
        } else if (isCompleted) {
            // Completed: Reopen
            statusSection.btns.appendChild(btn('Reopen', 'reopen', async (b) => {
                b.disabled = true;
                b.textContent = 'Reopening...';
                try {
                    const resp = await fetch(`${API_BASE}/api/art-requests/${designId}/status`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'In Progress' })
                    });
                    if (!resp.ok) throw new Error(`Status ${resp.status}`);
                    fetch(`${API_BASE}/api/art-requests/${designId}/note`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            noteType: 'Status Change',
                            noteText: 'Reopened from Completed',
                            noteBy: 'art@nwcustomapparel.com'
                        })
                    }).catch(err => console.warn('Reopen note failed (non-blocking):', err));
                    b.textContent = 'Reopened!';
                    b.style.background = '#28a745';
                    setTimeout(() => window.location.reload(), 800);
                } catch (err) {
                    b.textContent = 'Error';
                    b.style.background = '#dc3545';
                    console.error('Reopen failed:', err);
                    setTimeout(() => { b.textContent = 'Reopen'; b.style.background = ''; b.disabled = false; }, 2000);
                }
            }));
        }

        // ── Row 2: TIME — art time management ──
        const timeSection = section('TIME');
        timeSection.btns.appendChild(btn('Log Time', 'logtime', () => showLogTimeModal(designId, card)));
        if (!isInactive) {
            timeSection.btns.appendChild(btn('Mark Complete', 'done', () => showArtTimeModal(designId, card)));
        }
        timeSection.btns.appendChild(btn('Time Log', 'timelog', () => showTimeLogModal(designId, card)));

        // ── Row 3: Info — Notes + View Details ──
        const infoRow = document.createElement('div');
        infoRow.className = 'footer-info-row';
        infoRow.appendChild(btn('Notes', 'notes', () => openNotesPanel(designId, card)));

        const sep = document.createElement('span');
        sep.className = 'footer-info-separator';
        sep.textContent = '\u00B7';
        infoRow.appendChild(sep);

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
        infoRow.appendChild(detailsLink);

        // Assemble: STATUS → TIME → Info
        if (!isCancelled) {
            container.appendChild(statusSection.row);
            container.appendChild(timeSection.row);
            container.appendChild(infoRow);
        }

        footer.appendChild(container);

        // Make card body clickable to open details
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
            if (e.target.closest('.footer-section, .footer-info-row, .card-details-link')) return;
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

                // Always send completion notification email to sales rep
                const cardRepEl = card ? card.querySelector('.rep-name[data-email]') : null;
                sendNotificationEmail(designId, 'completed', {
                    artMinutes: currentMins + mins,
                    salesRep: cardRepEl ? cardRepEl.dataset.email : ''
                });

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
                    <input id="lt-minutes" type="number" value="0" step="15" class="stepper-input" />
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
            // Clamp so total never goes below 0
            const clampedMins = Math.max(mins, -currentMins);
            if (clampedMins !== mins) minutesInput.value = clampedMins;

            if (clampedMins < 0) {
                const removeMins = Math.abs(clampedMins);
                const removeQh = Math.ceil(removeMins / 15) * 0.25;
                costDiv.textContent = `Removing $${(removeQh * 75).toFixed(2)}`;
                costDiv.style.color = '#dc3545';
            } else {
                const qh = Math.ceil(clampedMins / 15) * 0.25;
                costDiv.textContent = `= $${(qh * 75).toFixed(2)}`;
                costDiv.style.color = '';
            }
            const totalMins = currentMins + clampedMins;
            const totalQh = totalMins > 0 ? (Math.ceil(totalMins / 15) * 0.25) : 0;
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
            // Allow negative down to -currentMins (total can't go below 0)
            minutesInput.value = v < -currentMins ? -currentMins : v;
            updateLogTimeCost();
        });

        modal.querySelector('#lt-cancel').addEventListener('click', removeModals);
        overlay.addEventListener('click', removeModals);

        modal.querySelector('#lt-submit').addEventListener('click', async function () {
            const mins = Math.max(parseInt(minutesInput.value) || 0, -currentMins);
            if (mins === 0 && !confirm('Art time is 0 minutes. Continue anyway?')) return;
            if (mins < 0 && !confirm(`Remove ${Math.abs(mins)} minutes from this design?`)) return;

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

                // Log art time note (for adds and removals)
                if (mins !== 0) {
                    const absMins = Math.abs(mins);
                    const qh = Math.ceil(absMins / 15) * 0.25;
                    const cost = (qh * 75).toFixed(2);
                    const action = mins < 0 ? 'Removed' : 'Logged';
                    const noteBody = noteText
                        ? `${action} ${absMins} minutes ($${cost}) — ${noteText}`
                        : `${action} ${absMins} minutes ($${cost})`;
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
                    logArtCharge(designId, mins, noteText || (mins < 0 ? 'Time removed' : 'Art time logged'), 'Log Time', currentMinsForCharge);
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

    // ── Time Log History Modal (read-only charge history) ────────────────
    async function showTimeLogModal(designId, card) {
        removeModals();

        // Get company name from card header
        const companyEl = card.querySelector('.company-name, h3');
        const company = companyEl ? companyEl.textContent.trim() : '';

        const overlay = createOverlay();
        const modal = document.createElement('div');
        modal.id = 'time-log-modal';
        modal.className = 'art-modal art-modal--timelog';

        modal.innerHTML = `
            <div class="art-modal-header art-modal-header--slate">
                Time Log — #${designId}
                ${company ? '<div class="time-log-company">' + escapeHtml(company) + '</div>' : ''}
            </div>
            <div class="art-modal-body">
                <div style="text-align:center;color:#9ca3af;padding:20px 0;">Loading...</div>
            </div>`;

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        overlay.addEventListener('click', removeModals);

        // Fetch charge history
        try {
            const resp = await fetch(`${API_BASE}/api/art-charges?id_design=${designId}`);
            if (!resp.ok) throw new Error(`Status ${resp.status}`);
            const charges = await resp.json();

            const body = modal.querySelector('.art-modal-body');

            if (!charges || charges.length === 0) {
                body.innerHTML = '<div class="time-log-empty">No time entries logged yet</div>' +
                    '<div class="art-modal-actions"><button class="art-modal-btn-cancel" id="tl-close">Close</button></div>';
                modal.querySelector('#tl-close').addEventListener('click', removeModals);
                return;
            }

            // Summary from the most recent entry's running total
            const latest = charges[0];
            const totalMins = latest.Running_Total_Minutes || 0;
            const totalHrs = totalMins > 0 ? (Math.ceil(totalMins / 15) * 0.25).toFixed(2) : '0.00';
            const totalCost = totalMins > 0 ? (parseFloat(totalHrs) * 75).toFixed(2) : '0.00';

            let html = '<div class="time-log-summary">Total: ' + totalMins + ' min &middot; ' + totalHrs + ' hrs &middot; $' + totalCost + '</div>';

            charges.forEach(function (charge) {
                const mins = charge.Minutes || 0;
                const cost = charge.Cost ? parseFloat(charge.Cost).toFixed(2) : '0.00';
                const isNeg = mins < 0;
                const prefix = isNeg ? '' : '+';
                const dateStr = formatNoteDate(charge.Charge_Date);
                const desc = charge.Description || '';
                const runMins = charge.Running_Total_Minutes || 0;
                const runCost = charge.Running_Total_Cost ? parseFloat(charge.Running_Total_Cost).toFixed(2) : '0.00';

                // Badge class
                const type = (charge.Charge_Type || '').toLowerCase();
                let badgeClass = 'time-log-badge--default';
                if (type.includes('log')) badgeClass = 'time-log-badge--logtime';
                else if (type.includes('completion')) badgeClass = 'time-log-badge--completion';
                else if (type.includes('mockup')) badgeClass = 'time-log-badge--mockup';

                html += '<div class="time-log-entry' + (isNeg ? ' time-log-negative' : '') + '">';
                html += '<div class="time-log-entry-header">';
                html += '<span class="time-log-badge ' + badgeClass + '">' + escapeHtml(charge.Charge_Type || 'Unknown') + '</span>';
                html += '<span class="time-log-date">' + dateStr + '</span>';
                html += '</div>';
                html += '<div class="time-log-detail">' + prefix + mins + ' min &middot; $' + cost + '</div>';
                if (desc) html += '<div class="time-log-desc">' + escapeHtml(desc) + '</div>';
                html += '<div class="time-log-running">Running total: ' + runMins + ' min ($' + runCost + ')</div>';
                html += '</div>';
            });

            html += '<div class="art-modal-actions"><button class="art-modal-btn-cancel" id="tl-close">Close</button></div>';

            body.innerHTML = html;
            modal.querySelector('#tl-close').addEventListener('click', removeModals);

        } catch (err) {
            console.error('Failed to load time log:', err);
            const body = modal.querySelector('.art-modal-body');
            body.innerHTML = '<div class="time-log-empty">Failed to load time log</div>' +
                '<div class="art-modal-actions"><button class="art-modal-btn-cancel" id="tl-close">Close</button></div>';
            modal.querySelector('#tl-close').addEventListener('click', removeModals);
        }
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
        ['art-time-modal', 'log-time-modal', 'time-log-modal', 'quick-action-overlay'].forEach(id => {
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

    // ── Detail Form Styling: Sections, image thumbnails, field cleanup ──
    // Section headers match the physical form layout order (top to bottom)
    const DETAIL_SECTIONS = [
        { title: 'Order Info', icon: 'fas fa-shopping-cart', fields: ['CompanyName', 'Due_Date', 'User_Email'] },
        { title: 'Status & Dates', icon: 'fas fa-palette', fields: ['Status', 'Date_Created', 'Date_Updated'] },
        { title: 'Contact', icon: 'fas fa-address-card', fields: ['First_name', 'Last_name', 'Email_Contact'] },
        { title: 'Art Details', icon: 'fas fa-paint-brush', fields: ['Garment_Placement', 'Prelim_Charges', 'Additional_Services'] },
        { title: 'Garments & Colors', icon: 'fas fa-tshirt', fields: ['GarmentStyle', 'GarmentColor', 'Swatch_1', 'MAIN_IMAGE_URL_1', 'Garm_Style_2', 'Garm_Color_2'] },
        { title: 'Uploaded Files', icon: 'fas fa-file-upload', fields: ['File_Upload_One', 'File_Upload_Two', 'File_Upload_Three', 'File_Upload_Four'] }
    ];

    // Bare CDN URL regex — filter these out (empty Caspio file fields)
    const BARE_CDN_RE = /^https?:\/\/cdn\.caspio\.com\/[A-Z0-9]+\/?$/i;

    function processDetailForm() {
        const galleryTab = document.getElementById('gallery-tab');
        if (!galleryTab) return;

        // Detect detail form — Caspio renders it inside #gallery-tab with an UPDATE button
        // Multiple forms may exist (search form + detail form) — find the one with the update button
        // When Caspio navigates records, it reuses the form element but updates field values.
        // Detect record change via RecordID hidden input and re-process from scratch.
        let form = null;
        const allForms = galleryTab.querySelectorAll('form');
        for (const f of allForms) {
            if (f.dataset.detailStyled) {
                // Check if Caspio navigated to a different record (RecordID changed)
                const recIdInput = f.querySelector('input[name="RecordID"]');
                const currentRecId = recIdInput ? recIdInput.value : '';
                if (currentRecId && currentRecId !== f.dataset.detailRecordId) {
                    // Record changed — clean up all injected elements and re-process
                    f.querySelectorAll('.detail-section-header, .garment-card, .detail-file-grid').forEach(el => el.remove());
                    f.querySelectorAll('.detail-kv-row').forEach(row => {
                        while (row.firstChild) row.parentNode.insertBefore(row.firstChild, row);
                        row.remove();
                    });
                    f.querySelectorAll('.detail-hidden-row').forEach(el => el.classList.remove('detail-hidden-row'));
                    f.querySelectorAll('.detail-swatch-img, .detail-garment-img').forEach(img => {
                        // Restore the hidden span
                        const span = img.previousElementSibling || img.nextElementSibling;
                        if (span && span.classList.contains('cbFormData')) span.style.display = '';
                        img.remove();
                    });
                    delete f.dataset.detailStyled;
                    delete f.dataset.detailRecordId;
                    f.classList.remove('art-detail-form');
                } else {
                    continue;
                }
            }
            const btn = f.querySelector('.cbUpdateButton, input[type="submit"][value="Update"], input[type="submit"][value="UPDATE"]');
            if (btn) { form = f; break; }
        }
        if (!form) return;

        // Store current record ID for change detection
        const recIdInput = form.querySelector('input[name="RecordID"]');
        form.dataset.detailRecordId = recIdInput ? recIdInput.value : '';
        form.dataset.detailStyled = 'true';
        form.classList.add('art-detail-form');

        // Find the main section (first section with many children = the form fields)
        const allSections = form.querySelectorAll('section[data-cb-name="cbTable"]');
        let mainSection = null;
        allSections.forEach(sec => {
            if (sec.children.length > 10) mainSection = sec;
        });
        if (!mainSection) return;

        // ── Build field map: field name → { block (parent div), input/span, labelBlock } ──
        // Semantic markup: each field is a direct child div of the section
        // Inputs have IDs like EditRecord{FieldName}_{suffix}
        // Static data is in <span class="cbFormData">
        const fieldBlockMap = {};

        // Map editable fields via inputs
        form.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach(input => {
            const id = input.id || '';
            const match = id.match(/^EditRecord([A-Za-z_]+\d*)/);
            if (!match) return;
            const fieldName = match[1];
            // Walk up to the block div (direct child of section)
            let block = input.closest('[class*="cbFormBlock"]');
            if (!block) block = input.closest('[data-cb-row-expanded]');
            if (!block) return;
            fieldBlockMap[fieldName] = { block: block, input: input, dataSpan: null };
        });

        // Helper: find sibling data cell for a label div (same row, data cell class)
        function findDataSibling(labelDiv) {
            const rowExp = labelDiv.getAttribute('data-cb-row-expanded') || labelDiv.getAttribute('data-cb-row-collapsed');
            if (!rowExp) return { dataBlock: null, dataSpan: null };
            let sibling = labelDiv.nextElementSibling;
            while (sibling) {
                const sibRow = sibling.getAttribute('data-cb-row-expanded') || sibling.getAttribute('data-cb-row-collapsed');
                if (sibRow === rowExp && (sibling.classList.contains('cbFormDataCell') || sibling.classList.contains('cbFormDataCellNumberDate'))) {
                    return { dataBlock: sibling, dataSpan: sibling.querySelector('.cbFormData') };
                }
                sibling = sibling.nextElementSibling;
            }
            return { dataBlock: null, dataSpan: null };
        }

        // Map static/label fields (left-label pairs like Order_Type, GarmentStyle)
        // These are pairs: cbFormLabelCell div + cbFormDataCell div at the same row level
        mainSection.querySelectorAll('.cbFormLabelCell').forEach(labelDiv => {
            // Check for label with for= attribute
            const labelEl = labelDiv.querySelector('label[for]');
            const forAttr = labelEl ? labelEl.getAttribute('for') : '';
            const match = forAttr ? forAttr.match(/^EditRecord([A-Za-z_]+\d*)/) : null;
            if (match && !fieldBlockMap[match[1]]) {
                let block = labelDiv.closest('[class*="cbFormBlock"]') || labelDiv;
                const { dataBlock, dataSpan } = findDataSibling(labelDiv);
                fieldBlockMap[match[1]] = { block: block, input: null, dataSpan: dataSpan, dataBlock: dataBlock, labelBlock: labelDiv };
            }

            // Also check data-cb-cell-name on the label div itself
            // Strip LabelCell/DataCell suffix and hex deployment suffix (e.g., _773016335370a6)
            const cellName = labelDiv.getAttribute('data-cb-cell-name') || '';
            const cleanCell = cellName.replace(/(Label|Data)Cell$/, '');
            const cellMatch = cleanCell.match(/^EditRecord([A-Za-z_\d]+?)(?:_[0-9a-f]{8,})?$/i);
            if (cellMatch && !fieldBlockMap[cellMatch[1]]) {
                let block = labelDiv.closest('[class*="cbFormBlock"]') || labelDiv;
                const { dataBlock, dataSpan } = findDataSibling(labelDiv);
                fieldBlockMap[cellMatch[1]] = { block: block, input: null, dataSpan: dataSpan, dataBlock: dataBlock, labelBlock: labelDiv };
            }

            // For left-oriented labels (no for=), get field name from label text
            // This also serves as a fallback if the above paths didn't capture the field
            if (!labelEl || !forAttr) {
                const text = labelDiv.textContent.trim();
                // Map both human-readable AND raw Caspio label texts (varies by deployment)
                const TEXT_TO_FIELD = {
                    'Order Type': 'Order_Type',
                    'Order #': 'Order_Num_SW', 'Order Num SW': 'Order_Num_SW',
                    'Placement': 'Garment_Placement', 'Garment Placement': 'Garment_Placement',
                    'Style': 'GarmentStyle', 'GarmentStyle': 'GarmentStyle',
                    'Color': 'GarmentColor', 'GarmentColor': 'GarmentColor',
                    'Art Charge': 'Prelim_Charges', 'Art Estimate from AE': 'Prelim_Charges',
                    'Add\'l Services': 'Additional_Services', 'Additional Services': 'Additional_Services',
                    'Color 2': 'Garm_Color_2', 'Color 3': 'Garm_Color_3',
                    'Color 4': 'Garm_Color_4', 'Style 2': 'Garm_Style_2',
                    'Style 3': 'Garm_Style_3', 'Style 4': 'Garm_Style_4',
                    'Garm Color 2': 'Garm_Color_2', 'Garm Color 3': 'Garm_Color_3',
                    'Garm Color 4': 'Garm_Color_4', 'Garm Style 2': 'Garm_Style_2',
                    'Garm Style 3': 'Garm_Style_3', 'Garm Style 4': 'Garm_Style_4',
                    'Swatch': 'Swatch_1', 'Swatch 1': 'Swatch_1', 'Swatch 2': 'Swatch_2',
                    'Swatch 3': 'Swatch_3', 'Swatch 4': 'Swatch_4',
                    'Garment Image': 'MAIN_IMAGE_URL_1', 'Garment Image 2': 'MAIN_IMAGE_URL_2',
                    'Garment Image 3': 'MAIN_IMAGE_URL_3', 'Garment Image 4': 'MAIN_IMAGE_URL_4',
                    'MAIN IMAGE URL 1': 'MAIN_IMAGE_URL_1', 'MAIN IMAGE URL 2': 'MAIN_IMAGE_URL_2',
                    'MAIN IMAGE URL 3': 'MAIN_IMAGE_URL_3', 'MAIN IMAGE URL 4': 'MAIN_IMAGE_URL_4',
                    'Contact Name': 'Full_Name_Contact', 'Full Name Contact': 'Full_Name_Contact',
                    'Customer #': 'Shopwork_customer_number',
                    'Shopworks Customer Number from New Custom Table': 'Shopwork_customer_number'
                };
                const fieldName = TEXT_TO_FIELD[text];
                if (fieldName && !fieldBlockMap[fieldName]) {
                    const { dataBlock, dataSpan } = findDataSibling(labelDiv);
                    fieldBlockMap[fieldName] = {
                        block: labelDiv,
                        input: null,
                        dataSpan: dataSpan,
                        dataBlock: dataBlock,
                        labelBlock: labelDiv
                    };
                }
            }
        });

        // Also map static display fields that have data-cb-cell-name on data cells
        mainSection.querySelectorAll('.cbFormDataCell, .cbFormDataCellNumberDate').forEach(dataDiv => {
            const cellName = dataDiv.getAttribute('data-cb-cell-name') || '';
            const cleanName = cellName.replace(/(Label|Data)Cell$/, '');
            const match = cleanName.match(/^EditRecord([A-Za-z_\d]+?)(?:_[0-9a-f]{8,})?$/i);
            if (match && !fieldBlockMap[match[1]]) {
                fieldBlockMap[match[1]] = {
                    block: dataDiv,
                    input: null,
                    dataSpan: dataDiv.querySelector('.cbFormData'),
                    dataBlock: dataDiv
                };
            }
        });

        // Map display-only nested containers (Company, Status, Charge, dates)
        // These are .cbFormNestedTableContainer blocks with a label but no EditRecord input
        const NESTED_LABEL_TO_FIELD = {
            'Company': 'CompanyName', 'Charge': 'Amount_Art_Billed',
            'Status': 'Status', 'Created Date': 'Date_Created', 'Updated Date': 'Date_Updated',
            'Shopworks': 'Shopwork_customer_number_nested', 'ID': 'Record_ID'
        };
        mainSection.querySelectorAll('.cbFormNestedTableContainer').forEach(nc => {
            if (nc.querySelector('input[id^="EditRecord"], select[id^="EditRecord"], textarea[id^="EditRecord"]')) return;
            const labelCell = nc.querySelector('.cbFormLabelCell');
            const labelText = labelCell ? labelCell.textContent.trim() : '';
            const fieldName = NESTED_LABEL_TO_FIELD[labelText];
            if (fieldName && !fieldBlockMap[fieldName]) {
                const dataSpan = nc.querySelector('.cbFormData');
                fieldBlockMap[fieldName] = { block: nc, input: null, dataSpan: dataSpan, dataBlock: nc };
            }
        });
        // Also map standalone data cell block 1 (record ID)
        const block1 = mainSection.children[0];
        if (block1 && block1.classList.contains('cbFormDataCellNumberDate') && !fieldBlockMap['Record_ID']) {
            const dataSpan = block1.querySelector('.cbFormData');
            fieldBlockMap['Record_ID'] = { block: block1, input: null, dataSpan: dataSpan, dataBlock: block1 };
        }

        // ── Fix grid layout: mark full-width blocks ──
        // Caspio uses a 6-column inline-grid. 3-col rows (Company|Due|Rep) each take 2 cols.
        // Single-field rows (Notes, Files) and standalone cells need to span all 6 cols.
        // Detect single-field rows: nested containers with data-cb-row-expanded that appear only once
        const rowCounts = {};
        Array.from(mainSection.children).forEach(child => {
            const row = child.getAttribute('data-cb-row-expanded');
            if (row) rowCounts[row] = (rowCounts[row] || 0) + 1;
        });
        Array.from(mainSection.children).forEach(child => {
            const row = child.getAttribute('data-cb-row-expanded');
            // Standalone data cell (block 1 = record ID)
            if (child.classList.contains('cbFormDataCellNumberDate') && !child.classList.contains('cbFormLabelCell')) {
                child.classList.add('detail-full-row');
            }
            // Nested containers in single-field rows (only 1 block in that grid row)
            if (child.classList.contains('cbFormNestedTableContainer') && row && rowCounts[row] === 1) {
                child.classList.add('detail-full-row');
            }
            // Left-label kv pairs (cbFormLabelCell or cbFormDataCell at section level)
            // These should span 3 cols each (handled by .detail-kv-label / .detail-kv-value classes)
        });
        // Button container (last child with button)
        const btnContainer = mainSection.querySelector('.cbBackButtonContainer, .cbFormActionButtonsContainer');
        if (btnContainer) btnContainer.classList.add('detail-full-row');

        // ── Hide Art_Minutes from detail form (single source of truth = Log Time modal on cards) ──
        ['Art_Minutes', 'Amount_Art_Billed'].forEach(fieldName => {
            const entry = fieldBlockMap[fieldName];
            if (entry) {
                const target = entry.block || entry.dataBlock;
                if (target) target.classList.add('detail-hidden-row');
                if (entry.labelBlock) entry.labelBlock.classList.add('detail-hidden-row');
            }
            // Also hide any EditRecord inputs for Art_Minutes (Caspio editable fields)
            form.querySelectorAll('input[id*="Art_Minutes"], input[id*="Amount_Art_Billed"]').forEach(input => {
                const block = input.closest('[class*="cbFormBlock"]') || input.closest('[data-cb-row-expanded]');
                if (block) block.classList.add('detail-hidden-row');
            });
        });

        // ── Inject section headers ──
        DETAIL_SECTIONS.forEach(section => {
            let firstBlock = null;
            for (const fieldName of section.fields) {
                if (fieldBlockMap[fieldName]) {
                    firstBlock = fieldBlockMap[fieldName].block;
                    break;
                }
            }
            if (!firstBlock) return;

            const header = document.createElement('div');
            header.className = 'detail-section-header detail-full-row';
            header.innerHTML = '<i class="' + escapeHtml(section.icon) + '"></i> ' + escapeHtml(section.title);

            // Insert before the first block in this section
            firstBlock.parentNode.insertBefore(header, firstBlock);
        });

        // ── Handle Order_Type object display ──
        const otEntry = fieldBlockMap['Order_Type'];
        if (otEntry) {
            const span = otEntry.dataSpan;
            if (span) {
                const val = span.textContent.trim();
                if (val.startsWith('{') && val.includes(':')) {
                    try {
                        const parsed = JSON.parse(val.replace(/'/g, '"'));
                        span.textContent = Object.values(parsed).join(', ');
                    } catch (e) {
                        const extracted = val.match(/'([^']+)'\s*$/);
                        if (extracted) span.textContent = extracted[1];
                    }
                }
            }
        }

        // ── Status badge coloring ──
        const statusEntry = fieldBlockMap['Status'];
        if (statusEntry) {
            const span = statusEntry.dataSpan || (statusEntry.block && statusEntry.block.querySelector('.cbFormData'));
            if (span) {
                const raw = span.textContent.trim().replace(/\s*[\u{1F534}\u{1F7E0}\u{1F7E1}\u{1F7E2}\u{2705}\u{1F504}\u{1F535}]/gu, '').trim();
                span.textContent = raw; // Strip emoji from display
                const slug = raw.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
                span.classList.add('detail-status-badge');
                if (slug) span.classList.add('status-' + slug);
            }
        }

        // ── Convert Swatch URLs to thumbnail images ──
        ['Swatch_1', 'Swatch_2', 'Swatch_3', 'Swatch_4'].forEach(fieldName => {
            const entry = fieldBlockMap[fieldName];
            if (!entry) return;
            const span = entry.dataSpan;
            if (!span) return;
            const url = span.textContent.trim();
            if (!url || BARE_CDN_RE.test(url) || !url.startsWith('http')) return;

            span.style.display = 'none';
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'Color swatch';
            img.className = 'detail-swatch-img';
            img.onerror = function () { this.style.display = 'none'; span.style.display = ''; };
            span.parentNode.insertBefore(img, span.nextSibling);
        });

        // ── Convert MAIN_IMAGE_URL to garment thumbnails ──
        ['MAIN_IMAGE_URL_1', 'MAIN_IMAGE_URL_2', 'MAIN_IMAGE_URL_3', 'MAIN_IMAGE_URL_4'].forEach(fieldName => {
            const entry = fieldBlockMap[fieldName];
            if (!entry) return;
            const span = entry.dataSpan;
            if (!span) return;
            const url = span.textContent.trim();
            if (!url || BARE_CDN_RE.test(url) || !url.startsWith('http')) return;

            span.style.display = 'none';
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'Garment image';
            img.className = 'detail-garment-img';
            img.onerror = function () { this.style.display = 'none'; span.style.display = ''; };
            span.parentNode.insertBefore(img, span.nextSibling);
        });

        // ── Hide empty garment groups (2, 3, 4) ──
        [
            { style: 'Garm_Style_2', related: ['Garm_Color_2', 'Swatch_2', 'MAIN_IMAGE_URL_2'] },
            { style: 'Garm_Style_3', related: ['Garm_Color_3', 'Swatch_3', 'MAIN_IMAGE_URL_3'] },
            { style: 'Garm_Style_4', related: ['Garm_Color_4', 'Swatch_4', 'MAIN_IMAGE_URL_4'] }
        ].forEach(group => {
            const styleEntry = fieldBlockMap[group.style];
            if (!styleEntry) return;
            const styleVal = styleEntry.dataSpan ? styleEntry.dataSpan.textContent.trim() : '';
            if (!styleVal) {
                // Hide label + data blocks
                if (styleEntry.block) styleEntry.block.classList.add('detail-hidden-row');
                if (styleEntry.dataBlock) styleEntry.dataBlock.classList.add('detail-hidden-row');
                group.related.forEach(relField => {
                    const rel = fieldBlockMap[relField];
                    if (!rel) return;
                    if (rel.block) rel.block.classList.add('detail-hidden-row');
                    if (rel.dataBlock) rel.dataBlock.classList.add('detail-hidden-row');
                });
            }
        });

        // ── Build garment group cards (swatch + image + style/color on one line) ──
        const garmentGroups = [
            { style: 'GarmentStyle', color: 'GarmentColor', swatch: 'Swatch_1', image: 'MAIN_IMAGE_URL_1' },
            { style: 'Garm_Style_2', color: 'Garm_Color_2', swatch: 'Swatch_2', image: 'MAIN_IMAGE_URL_2' },
            { style: 'Garm_Style_3', color: 'Garm_Color_3', swatch: 'Swatch_3', image: 'MAIN_IMAGE_URL_3' },
            { style: 'Garm_Style_4', color: 'Garm_Color_4', swatch: 'Swatch_4', image: 'MAIN_IMAGE_URL_4' }
        ];

        // Find the section header for Garments & Colors to insert cards after it
        const sectionHeaders = mainSection.querySelectorAll('.detail-section-header');
        let garmentHeader = null;
        sectionHeaders.forEach(h => { if (h.textContent.trim() === 'Garments & Colors') garmentHeader = h; });

        garmentGroups.forEach(g => {
            const styleEntry = fieldBlockMap[g.style];
            const colorEntry = fieldBlockMap[g.color];
            const swatchEntry = fieldBlockMap[g.swatch];
            const imageEntry = fieldBlockMap[g.image];

            // Skip if style is empty (group already hidden)
            const styleVal = styleEntry && styleEntry.dataSpan ? styleEntry.dataSpan.textContent.trim() : '';
            if (!styleVal) return;

            const colorVal = colorEntry && colorEntry.dataSpan ? colorEntry.dataSpan.textContent.trim() : '';

            // Build the card
            const card = document.createElement('div');
            card.className = 'garment-card';

            // Images container (swatch + garment image side by side)
            const imagesDiv = document.createElement('div');
            imagesDiv.className = 'garment-card-images';

            // Grab swatch image if it exists
            if (swatchEntry && swatchEntry.dataBlock) {
                const swatchImg = swatchEntry.dataBlock.querySelector('.detail-swatch-img');
                if (swatchImg) imagesDiv.appendChild(swatchImg.cloneNode(true));
            }

            // Grab garment image if it exists
            if (imageEntry && imageEntry.dataBlock) {
                const garmentImg = imageEntry.dataBlock.querySelector('.detail-garment-img');
                if (garmentImg) imagesDiv.appendChild(garmentImg.cloneNode(true));
            }

            if (imagesDiv.children.length > 0) card.appendChild(imagesDiv);

            // Info container (style + color text)
            const infoDiv = document.createElement('div');
            infoDiv.className = 'garment-card-info';
            infoDiv.innerHTML = '<div><span class="garment-card-label">Style</span> ' + escapeHtml(styleVal) + '</div>'
                + '<div><span class="garment-card-label">Color</span> ' + escapeHtml(colorVal) + '</div>';
            card.appendChild(infoDiv);

            // Insert card after the section header
            if (garmentHeader) {
                // Find the right insertion point — after last card or after header
                let insertAfter = garmentHeader;
                let nextEl = insertAfter.nextElementSibling;
                while (nextEl && nextEl.classList.contains('garment-card')) {
                    insertAfter = nextEl;
                    nextEl = insertAfter.nextElementSibling;
                }
                insertAfter.parentNode.insertBefore(card, insertAfter.nextSibling);
            }

            // Hide the original KV-row source blocks for style/color/swatch/image
            [styleEntry, colorEntry, swatchEntry, imageEntry].forEach(entry => {
                if (!entry) return;
                if (entry.block) entry.block.classList.add('detail-hidden-row');
                if (entry.dataBlock) entry.dataBlock.classList.add('detail-hidden-row');
            });
        });

        // ── Clean up labels: add icons if missing ──
        const LABEL_MAP = {
            'Order_Type': { icon: 'fas fa-tag', text: 'Order Type' },
            'Order_Num_SW': { icon: 'fas fa-hashtag', text: 'Order #' },
            'Full_Name_Contact': { icon: 'fas fa-user-circle', text: 'Contact Name' },
            'Shopwork_customer_number': { icon: 'fas fa-id-badge', text: 'Customer #' },
            'Garment_Placement': { icon: 'fas fa-crosshairs', text: 'Placement' },
            'GarmentStyle': { icon: 'fas fa-tshirt', text: 'Style' },
            'GarmentColor': { icon: 'fas fa-fill-drip', text: 'Color' },
            'Prelim_Charges': { icon: 'fas fa-dollar-sign', text: 'Quoted Art Charge' },
            'Additional_Services': { icon: 'fas fa-plus-circle', text: 'Add\'l Services' },
            'Garm_Style_2': { icon: 'fas fa-tshirt', text: 'Style 2' },
            'Garm_Color_2': { icon: 'fas fa-fill-drip', text: 'Color 2' },
            'Garm_Style_3': { icon: 'fas fa-tshirt', text: 'Style 3' },
            'Garm_Color_3': { icon: 'fas fa-fill-drip', text: 'Color 3' },
            'Garm_Style_4': { icon: 'fas fa-tshirt', text: 'Style 4' },
            'Garm_Color_4': { icon: 'fas fa-fill-drip', text: 'Color 4' },
            'Swatch_1': { icon: 'fas fa-square-full', text: 'Swatch' },
            'Swatch_2': { icon: 'fas fa-square-full', text: 'Swatch 2' },
            'Swatch_3': { icon: 'fas fa-square-full', text: 'Swatch 3' },
            'Swatch_4': { icon: 'fas fa-square-full', text: 'Swatch 4' },
            'MAIN_IMAGE_URL_1': { icon: 'fas fa-image', text: 'Garment Image' },
            'MAIN_IMAGE_URL_2': { icon: 'fas fa-image', text: 'Garment Image 2' },
            'MAIN_IMAGE_URL_3': { icon: 'fas fa-image', text: 'Garment Image 3' },
            'MAIN_IMAGE_URL_4': { icon: 'fas fa-image', text: 'Garment Image 4' }
        };

        Object.keys(LABEL_MAP).forEach(fieldName => {
            const entry = fieldBlockMap[fieldName];
            if (!entry || !entry.labelBlock) return;
            const labelBlock = entry.labelBlock;
            // Only overwrite if it doesn't already have a custom icon
            if (labelBlock.querySelector('i.fas, i.far')) return;
            const info = LABEL_MAP[fieldName];
            labelBlock.innerHTML = '<label><i class="' + info.icon + '"></i> ' + escapeHtml(info.text) + '</label>';
        });

        // ── Wrap left-label rows in flex containers for proper layout ──
        // Each label+data pair becomes a .detail-kv-row flex container
        const leftLabelFields = [
            'Shopwork_customer_number', 'Order_Type', 'Order_Num_SW',
            'Garment_Placement', 'Prelim_Charges', 'Additional_Services'
        ];
        leftLabelFields.forEach(fieldName => {
            const entry = fieldBlockMap[fieldName];
            if (!entry || !entry.labelBlock || !entry.dataBlock) return;
            entry.labelBlock.classList.add('detail-kv-label');
            entry.dataBlock.classList.add('detail-kv-value');
            // Wrap pair in a flex row so each pair gets its own line
            const row = document.createElement('div');
            row.className = 'detail-kv-row';
            entry.labelBlock.parentNode.insertBefore(row, entry.labelBlock);
            row.appendChild(entry.labelBlock);
            row.appendChild(entry.dataBlock);

            // Hide KV rows with no value (no text, no images)
            const valText = entry.dataBlock.textContent.trim();
            const hasImg = entry.dataBlock.querySelector('img');
            if (!valText && !hasImg) {
                row.classList.add('detail-hidden-row');
            }
        });

        // ── Hide redundant Contact Name (duplicates Contact section) ──
        const contactNameEntry = fieldBlockMap['Full_Name_Contact'];
        if (contactNameEntry) {
            if (contactNameEntry.block) contactNameEntry.block.classList.add('detail-hidden-row');
            if (contactNameEntry.dataBlock) contactNameEntry.dataBlock.classList.add('detail-hidden-row');
        }

        // ── Move Customer #, Order Type, Order # into Order Info (before Status & Dates header) ──
        const allHeaders = mainSection.querySelectorAll('.detail-section-header');
        let statusHeader = null;
        let artDetailsHeader = null;
        let garmentsHeader = null;
        let filesHeader = null;
        allHeaders.forEach(h => {
            const t = h.textContent.trim();
            if (t === 'Status & Dates') statusHeader = h;
            if (t === 'Art Details') artDetailsHeader = h;
            if (t === 'Garments & Colors') garmentsHeader = h;
            if (t === 'Uploaded Files') filesHeader = h;
        });

        ['Shopwork_customer_number', 'Order_Type', 'Order_Num_SW'].forEach(fieldName => {
            const entry = fieldBlockMap[fieldName];
            if (!entry || !entry.labelBlock) return;
            const kvRow = entry.labelBlock.closest('.detail-kv-row');
            if (kvRow && statusHeader) {
                statusHeader.parentNode.insertBefore(kvRow, statusHeader);
            }
        });

        // ── Reorder sections: Contact → Art Details → Garments → Files ──
        // Art Details header + content goes before Garments header
        if (artDetailsHeader && garmentsHeader) {
            garmentsHeader.parentNode.insertBefore(artDetailsHeader, garmentsHeader);
        }

        // Move Placement, Quoted Art Charge, Add'l Services before Garments header
        ['Garment_Placement', 'Prelim_Charges', 'Additional_Services'].forEach(fieldName => {
            const entry = fieldBlockMap[fieldName];
            if (!entry || !entry.labelBlock) return;
            const kvRow = entry.labelBlock.closest('.detail-kv-row');
            if (kvRow && garmentsHeader) {
                garmentsHeader.parentNode.insertBefore(kvRow, garmentsHeader);
            }
        });

        // Move Notes textarea from Contact into Art Details (AFTER KV rows, before Garments)
        mainSection.querySelectorAll('.cbFormNestedTableContainer').forEach(container => {
            const label = container.querySelector('label');
            if (!label) return;
            if (label.textContent.trim() === 'Notes') {
                if (garmentsHeader) {
                    garmentsHeader.parentNode.insertBefore(container, garmentsHeader);
                }
            }
        });

        // Move Uploaded Files section to the end (after Garments & Colors)
        if (filesHeader) {
            const btnContainer = mainSection.querySelector('.cbBackButtonContainer, .cbFormActionButtonsContainer');
            if (btnContainer) mainSection.insertBefore(filesHeader, btnContainer);
            else mainSection.appendChild(filesHeader);
            // Also move file containers after filesHeader so file grid builder finds them
            mainSection.querySelectorAll('.cbFormNestedTableContainer').forEach(container => {
                const label = container.querySelector('label');
                if (!label) return;
                if (/^File\s+\d$/i.test(label.textContent.trim())) {
                    if (btnContainer) mainSection.insertBefore(container, btnContainer);
                    else mainSection.appendChild(container);
                }
            });
        }

        // ── Build file upload grid (2x2 with download links) ──
        const detailForm = document.querySelector('.art-detail-form');
        if (detailForm && filesHeader) {
            const fileContainers = [];
            detailForm.querySelectorAll('.cbFormNestedTableContainer').forEach(container => {
                const label = container.querySelector('label');
                if (!label) return;
                if (/^File\s+\d$/i.test(label.textContent.trim())) {
                    fileContainers.push(container);
                }
            });

            const fileGrid = document.createElement('div');
            fileGrid.className = 'detail-file-grid detail-full-row';
            let hasAnyFile = false;

            fileContainers.forEach(container => {
                const img = container.querySelector('img');
                const fileInput = container.querySelector('input[type="file"]');
                const removeCheck = container.querySelector('input[type="checkbox"]');
                const removeLabel = removeCheck ? removeCheck.nextElementSibling || removeCheck.parentElement : null;
                const label = container.querySelector('label[for^="label_"], label[id^="label_"], .cbFormLabelCell label');
                const slotLabel = container.querySelector('.cbFormLabelCell label');
                const slotName = slotLabel ? slotLabel.textContent.trim() : '';
                const hasContent = !!img;

                const card = document.createElement('div');
                card.className = 'detail-file-card' + (hasContent ? '' : ' detail-file-empty');

                // Slot label
                const nameEl = document.createElement('div');
                nameEl.className = 'detail-file-name';
                nameEl.textContent = slotName;
                card.appendChild(nameEl);

                if (hasContent) {
                    hasAnyFile = true;
                    // Clone thumbnail
                    const imgClone = img.cloneNode(true);
                    imgClone.removeAttribute('width');
                    imgClone.removeAttribute('vspace');
                    imgClone.className = 'detail-file-thumb';
                    card.appendChild(imgClone);

                    // Download link
                    const dl = document.createElement('a');
                    dl.href = img.src;
                    dl.target = '_blank';
                    dl.className = 'detail-file-download';
                    dl.innerHTML = '<i class="fas fa-download"></i> Download';
                    card.appendChild(dl);

                    // Remove checkbox (keep functional, restyle)
                    if (removeCheck) {
                        const removeWrap = document.createElement('label');
                        removeWrap.className = 'detail-file-remove';
                        const checkClone = removeCheck.cloneNode(true);
                        // Sync checkbox state back to original
                        checkClone.addEventListener('change', function () { removeCheck.checked = this.checked; });
                        removeWrap.appendChild(checkClone);
                        removeWrap.appendChild(document.createTextNode(' Remove'));
                        card.appendChild(removeWrap);
                    }
                }

                // Upload input (replace file)
                if (fileInput) {
                    const uploadWrap = document.createElement('div');
                    uploadWrap.className = 'detail-file-upload';
                    const inputClone = fileInput.cloneNode(true);
                    // Sync file selection back to original
                    inputClone.addEventListener('change', function () {
                        // Copy the FileList by creating a DataTransfer
                        if (this.files.length > 0) {
                            const dt = new DataTransfer();
                            for (const f of this.files) dt.items.add(f);
                            fileInput.files = dt.files;
                        }
                    });
                    uploadWrap.appendChild(inputClone);
                    card.appendChild(uploadWrap);
                }

                fileGrid.appendChild(card);
                container.classList.add('detail-hidden-row');
            });

            // Insert grid after Uploaded Files header (only if files exist)
            if (hasAnyFile) {
                filesHeader.parentNode.insertBefore(fileGrid, filesHeader.nextSibling);
            } else {
                // Hide entire Uploaded Files section when no files have content
                filesHeader.classList.add('detail-hidden-row');
            }
        }
    }

    function initObserver() {
        const galleryTab = document.getElementById('gallery-tab');
        if (!galleryTab) return;

        let debounce;
        const observer = new MutationObserver(() => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                processCards();
                processDetailForm();
            }, 300);
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
