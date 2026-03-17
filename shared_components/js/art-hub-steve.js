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
 * Depends on: art-hub.css (shared styles), art-actions-shared.js (ArtActions), APP_CONFIG, EmailJS SDK
 */
(function () {
    'use strict';

    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // ── Shared references from art-actions-shared.js ─────────────────
    const REP_EMAIL_MAP = ArtActions.REP_EMAIL_MAP;

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
            'gallery':      { index: 0, pane: 'gallery-tab' },
            'express':      { index: 1, pane: 'express-tab' },
            'requirements': { index: 2, pane: 'requirements-tab' }
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

    const escapeHtml = ArtActions.escapeHtml;

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

    const formatNoteDate = ArtActions.formatNoteDate;

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
            detail_link: SITE_ORIGIN + '/art-request/' + designId + '?view=ae'
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
    function addRequestTypeBadge(card) {
        if (card.querySelector('.badge--mockup')) return; // already added
        const typeSpan = card.querySelector('.cb-request-type');
        if (!typeSpan) return;
        const type = typeSpan.textContent.trim();
        if (type.toLowerCase() !== 'mockup') return;

        const badge = document.createElement('span');
        badge.className = 'badge badge--mockup';
        badge.textContent = '\uD83D\uDCF8 MOCKUP'; // 📸
        const companyEl = card.querySelector('.company-name');
        if (companyEl) {
            companyEl.parentNode.insertBefore(badge, companyEl.nextSibling);
        } else {
            card.prepend(badge);
        }
    }

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
                    await fetch(`${API_BASE}/api/art-requests/${designId}/note`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ noteType: 'Status Change', noteText: 'Status set to Working (In Progress)', noteBy: 'art@nwcustomapparel.com' })
                    }).catch(() => {});
                    b.textContent = 'Updated!';
                    b.style.background = '#28a745';

                    // Notify sales rep (best-effort, non-blocking) — only if status is actually changing
                    const repEl = card.querySelector('.rep-name[data-email]');
                    const cardRepEmail = repEl ? repEl.dataset.email : '';
                    if (!status.includes('inprogress') && cardRepEmail && typeof emailjs !== 'undefined') {
                        const companyEl = card.querySelector('.company-name');
                        const repDispName = getRepDisplayName(cardRepEmail);
                        emailjs.send(EMAILJS_SERVICE_ID, 'template_art_in_progress', {
                            to_email: cardRepEmail,
                            to_name: repDispName || 'Sales Team',
                            design_id: designId,
                            company_name: companyEl ? companyEl.textContent.trim() : '',
                            detail_link: SITE_ORIGIN + '/art-request/' + designId + '?view=ae',
                            from_name: 'Steve — Art Department'
                        }, EMAILJS_PUBLIC_KEY).catch(err => {
                            console.warn('In Progress email failed (non-blocking):', err);
                        });
                    }

                    setTimeout(() => window.location.reload(), 1200);
                } catch (err) {
                    b.textContent = 'Error';
                    b.style.background = '#dc3545';
                    console.error('Quick action failed:', err);
                    setTimeout(() => { b.textContent = 'Working'; b.style.background = ''; b.disabled = false; }, 2000);
                }
            }));

            if (status.includes('awaitingapproval')) {
                // Already sent — show Send Reminder (simple confirm + re-send, no full modal)
                statusSection.btns.appendChild(btn('Send Reminder', 'approve', async (b) => {
                    b.disabled = true;
                    b.textContent = 'Loading...';
                    try {
                        const resp = await fetch(`${API_BASE}/api/artrequests?id_design=${designId}&limit=1`);
                        if (!resp.ok) throw new Error('Fetch failed');
                        const data = await resp.json();
                        const req = data.Result ? data.Result[0] : data[0];
                        const mockupUrl = req.Box_File_Mockup || req.BoxFileLink || req.Company_Mockup || '';
                        const repEl = card.querySelector('.rep-name[data-email]');
                        const repEmail = repEl ? repEl.dataset.email : '';
                        const companyEl = card.querySelector('.company-name');
                        const company = companyEl ? companyEl.textContent.trim() : '';
                        b.textContent = 'Send Reminder';
                        ArtActions.sendMockupReminder(designId, mockupUrl, repEmail, company, b);
                    } catch (err) {
                        console.error('Send Reminder failed:', err);
                        b.textContent = 'Error';
                        b.style.background = '#dc3545';
                        setTimeout(() => { b.textContent = 'Send Reminder'; b.style.background = ''; b.disabled = false; }, 2000);
                    }
                }));
            } else if (status.includes('inprogress') || status.includes('revisionrequested')) {
                statusSection.btns.appendChild(btn('Send Mockup', 'approve', () => {
                    const companyEl = card.querySelector('.company-name');
                    ArtActions.showSendForApprovalModal(designId, companyEl ? companyEl.textContent.trim() : '');
                }));
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
                    ArtActions.notifyReopen(designId);
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
        timeSection.btns.appendChild(btn('Log Time', 'logtime', () => {
            const statusPillEl = card.querySelector('.status-pill');
            const curStatus = statusPillEl ? statusPillEl.textContent.trim() : 'In Progress 🔵';
            ArtActions.showLogTimeModal(designId, curStatus);
        }));
        if (!isInactive) {
            timeSection.btns.appendChild(btn('Mark Complete', 'done', () => {
                const repEl = card.querySelector('.rep-name[data-email]');
                const repEmail = repEl ? repEl.dataset.email : '';
                const companyEl = card.querySelector('.company-name');
                const company = companyEl ? companyEl.textContent.trim() : '';
                ArtActions.showArtTimeModal(designId, repEmail, company);
            }));
        }
        timeSection.btns.appendChild(btn('Time Log', 'timelog', () => {
            const companyEl = card.querySelector('.company-name');
            ArtActions.showTimeLogModal(designId, companyEl ? companyEl.textContent.trim() : '');
        }));

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
        detailsLink.href = '/art-request/' + designId;
        detailsLink.target = '_blank';
        detailsLink.addEventListener('click', (e) => {
            e.stopPropagation();
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

    // ── Modal functions delegated to ArtActions (art-actions-shared.js) ──
    // showArtTimeModal, showLogTimeModal, showTimeLogModal,
    // showSendForApprovalModal, submitSendForApproval, closeApprovalModal,
    // sendNotificationEmail, logArtCharge, createOverlay, removeModals,
    // updateApprovalTotal, resolveRep — all now in window.ArtActions

    // EmailJS constants still needed for sendNoteEmail (notes panel)
    const EMAILJS_SERVICE_ID = 'service_jgrave3';
    const EMAILJS_PUBLIC_KEY = '4qSbDO-SQs19TbP80';
    const SITE_ORIGIN = 'https://www.teamnwca.com';

    // ── MutationObserver: Watch for Caspio gallery cards ────────────────
    function processCards() {
        const galleryTab = document.getElementById('gallery-tab');
        if (!galleryTab) return;

        const cards = galleryTab.querySelectorAll('.card');
        cards.forEach(card => {
            addRequestTypeBadge(card);
            styleCardPills(card);
            calculateArtHours(card);
            formatRepName(card);
            cleanEmptyFields(card);
            injectQuickActions(card);
            addAuditIndicator(card);
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

        let icon, verb, accentColor;
        switch (notification.type) {
            case 'approved':
                icon = '✅'; verb = 'approved'; accentColor = '#28a745'; break;
            case 'revision':
                icon = '🔄'; verb = 'requested changes on'; accentColor = '#fd7e14'; break;
            case 'new_submission':
                icon = '📋'; verb = 'submitted a new art request for'; accentColor = '#6f42c1'; break;
            case 'completed':
                icon = '✅'; verb = 'completed'; accentColor = '#28a745'; break;
            default:
                icon = '🔔'; verb = 'updated'; accentColor = '#0d6efd'; break;
        }

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
        if (savedTab && ['express', 'requirements'].includes(savedTab)) {
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
            }
        });

        // ── Approval Modal Event Listeners (delegated to shared module) ──
        ArtActions.initApprovalModalListeners();
    });

    // ── Audit Indicator on Gallery Cards ────────────────────────────
    var auditObserver = null;

    function initAuditObserver() {
        if (auditObserver) return;
        auditObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var card = entry.target;
                auditObserver.unobserve(card);
                loadCardAudit(card);
            });
        }, { rootMargin: '200px' });
    }

    function addAuditIndicator(card) {
        if (card.dataset.auditQueued) return;
        // Find Order # from hidden Caspio span (cb-order-num) or info-grid labels
        var orderNum = '';
        var cbOrderSpan = card.querySelector('.cb-order-num');
        if (cbOrderSpan) {
            orderNum = cbOrderSpan.textContent.replace(/[^0-9]/g, '').trim();
        }
        if (!orderNum) {
            // Fallback: check info-grid labels
            var labels = card.querySelectorAll('.label, .info-label');
            labels.forEach(function (lbl) {
                if (lbl.textContent.trim() === 'Order #') {
                    var val = lbl.nextElementSibling;
                    if (val) orderNum = val.textContent.replace(/[^0-9]/g, '').trim();
                }
            });
        }
        if (!orderNum) return;

        card.dataset.auditQueued = '1';
        card.dataset.auditOrder = orderNum;
        initAuditObserver();
        auditObserver.observe(card);
    }

    function getSteveCostFromCard(card) {
        var actualMinsSpan = card.querySelector('.actual-minutes');
        var actualMins = actualMinsSpan ? (parseInt(actualMinsSpan.textContent) || 0) : 0;
        var actualHours = actualMins > 0 ? (Math.ceil(actualMins / 15) * 0.25) : 0;
        return actualHours * 75;
    }

    function loadCardAudit(card) {
        var orderNum = card.dataset.auditOrder;
        if (!orderNum) return;

        fetch(API_BASE + '/api/manageorders/lineitems/' + encodeURIComponent(orderNum))
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) {
                var items = data.result || [];
                var ART_PNS = ['Art', 'GRT-50', 'GRT-75'];
                var artItems = items.filter(function (item) {
                    return item.PartNumber && ART_PNS.indexOf(item.PartNumber.trim()) !== -1;
                });

                var steveCost = getSteveCostFromCard(card);

                if (artItems.length === 0) {
                    insertAuditBadge(card, 'No Art Charge', 'amber',
                        'No art charge found on invoice' + (steveCost > 0 ? ' \u2014 Steve: $' + steveCost.toFixed(2) : ''));
                    return;
                }

                var waived = false;
                var billedTotal = 0;
                artItems.forEach(function (item) {
                    var price = item.LineUnitPrice;
                    var desc = (item.PartDescription || '').toLowerCase();
                    if (price === null || price === 0 ||
                        desc.indexOf('waiv') !== -1 || desc.indexOf('no charge') !== -1 ||
                        desc.indexOf('n/c') !== -1 || desc.indexOf('comp') !== -1) {
                        waived = true;
                    } else {
                        billedTotal += parseFloat(price) || 0;
                    }
                });

                if (waived && billedTotal === 0) {
                    insertAuditBadge(card, 'Art Waived', 'red',
                        'Art charge waived on invoice' + (steveCost > 0 ? ' \u2014 Steve: $' + steveCost.toFixed(2) : ''));
                } else if (steveCost > billedTotal) {
                    // Steve's work exceeds what was billed — red flag
                    var overage = steveCost - billedTotal;
                    insertAuditBadge(card, 'Art \u25B2 $' + billedTotal.toFixed(0), 'red',
                        'Steve: $' + steveCost.toFixed(2) + ' \u00B7 Billed: $' + billedTotal.toFixed(2) + ' \u2014 over by $' + overage.toFixed(2));
                } else {
                    // Steve's work ≤ billed — profitable or break-even
                    insertAuditBadge(card, 'Art \u2713 $' + billedTotal.toFixed(0), 'green',
                        'Steve: $' + steveCost.toFixed(2) + ' \u00B7 Billed: $' + billedTotal.toFixed(2));
                }
            })
            .catch(function () {
                // Silent fail — don't clutter cards with errors
            });
    }

    function insertAuditBadge(card, text, color, tooltip) {
        var badge = document.createElement('span');
        badge.className = 'audit-badge audit-badge--' + color;
        badge.textContent = text;
        if (tooltip) badge.title = tooltip;
        // Insert after the status pill or in the card header area
        var headerArea = card.querySelector('.card-header') || card.querySelector('.company-name');
        if (headerArea) {
            headerArea.appendChild(badge);
        }
    }

    // ── Expose globals for HTML onclick attributes ────────────────────
    window.showTab = showTab;
})();
