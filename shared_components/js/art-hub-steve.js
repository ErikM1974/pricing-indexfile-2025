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

    // ── Rush flag normalizer — handles Y / Yes / true / True / 1 ─────
    function isRush(v) {
        if (window.ArtActions && typeof window.ArtActions.isRush === 'function') return window.ArtActions.isRush(v);
        if (!v && v !== 0) return false;
        if (typeof v === 'boolean') return v;
        var s = String(v).trim().toLowerCase();
        return s === 'yes' || s === 'y' || s === 'true' || s === '1';
    }

    // ── Logged-in user identity (from staff portal session) ──────────
    function getLoggedInUser() {
        var name = sessionStorage.getItem('nwca_user_name') || '';
        var email = sessionStorage.getItem('nwca_user_email') || '';
        return {
            name: name || 'Staff',
            email: email || 'art@nwcustomapparel.com',
            firstName: (name || 'Staff').split(' ')[0],
            noteBy: name || email || 'art@nwcustomapparel.com'
        };
    }

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
                    Note_By: getLoggedInUser().email
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
    // Upgrade Box thumbnail proxy URLs to their large (1024x1024) variant when
    // rendering in the modal. Gallery cards keep the small 256x256 version for speed.
    function upgradeBoxThumbUrl(url) {
        if (!url) return url;
        if (url.indexOf('/api/box/thumbnail/') === -1) return url;
        if (url.indexOf('size=large') !== -1) return url;
        return url + (url.indexOf('?') !== -1 ? '&' : '?') + 'size=large';
    }

    window.showModal = function (src) {
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('modalImage');
        if (modal && modalImg) {
            const largeUrl = upgradeBoxThumbUrl(src);
            // Fall back to small if large representation isn't ready
            modalImg.onerror = function () {
                if (modalImg.src === largeUrl && largeUrl !== src) modalImg.src = src;
            };
            modalImg.src = largeUrl;
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
        card.dataset.quotedCharge = quotedCharge;
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
        const isApproved = status === 'approved';
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
                        body: JSON.stringify({ noteType: 'Status Change', noteText: 'Status set to Working (In Progress)', noteBy: getLoggedInUser().noteBy })
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

                    setTimeout(() => refreshCard(designId, { status: 'In Progress', action: 'markWorking' }), 600);
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
            } else if (status.includes('submitted') || status.includes('inprogress') || status.includes('revisionrequested')) {
                statusSection.btns.appendChild(btn('Send Mockup', 'approve', () => {
                    const companyEl = card.querySelector('.company-name');
                    ArtActions.showSendForApprovalModal(designId, companyEl ? companyEl.textContent.trim() : '', function (data) {
                        refreshCard(designId, data);
                    });
                }));
            }
        } else if (isCompleted || isApproved) {
            // Completed/Approved: Reopen
            var reopenFromLabel = isApproved ? 'Approved' : 'Completed';
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
                            noteText: 'Reopened from ' + reopenFromLabel,
                            noteBy: getLoggedInUser().noteBy
                        })
                    }).catch(err => console.warn('Reopen note failed (non-blocking):', err));
                    ArtActions.notifyReopen(designId);
                    b.textContent = 'Reopened!';
                    b.style.background = '#28a745';
                    setTimeout(() => refreshCard(designId, { status: 'In Progress', action: 'reopen' }), 600);
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
            ArtActions.showLogTimeModal(designId, curStatus, function (data) {
                refreshCard(designId, data);
            });
        }));
        if (!isInactive) {
            timeSection.btns.appendChild(btn('Mark Complete', 'done', () => {
                const repEl = card.querySelector('.rep-name[data-email]');
                const repEmail = repEl ? repEl.dataset.email : '';
                const companyEl = card.querySelector('.company-name');
                const company = companyEl ? companyEl.textContent.trim() : '';
                ArtActions.showArtTimeModal(designId, repEmail, company, function (data) {
                    refreshCard(designId, data);
                });
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

        // Make card body clickable to open custom detail page
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
            if (e.target.closest('.footer-section, .footer-info-row, .card-details-link')) return;
            window.open('/art-request/' + designId, '_blank');
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

    // ── In-Place Card Refresh (no page reload) ─────────────────────────
    function findCardByDesignId(designId) {
        var cards = document.querySelectorAll('#gallery-tab .card');
        for (var i = 0; i < cards.length; i++) {
            var idEl = cards[i].querySelector('.id-design');
            if (idEl && idEl.textContent.replace(/[^0-9]/g, '') === String(designId)) return cards[i];
        }
        return null;
    }

    function refreshCard(designId, newData) {
        var card = findCardByDesignId(designId);
        if (!card) { window.location.reload(); return; }

        // 1. Update status pill
        if (newData.status) {
            var pill = card.querySelector('.status-pill');
            if (pill) {
                var statusEmoji = { 'In Progress': '\uD83D\uDD35', 'Completed': '\u2705', 'Awaiting Approval': '\uD83D\uDFE0', 'Submitted': '\uD83C\uDD95', 'Revision Requested': '\uD83D\uDD04' };
                pill.textContent = newData.status + ' ' + (statusEmoji[newData.status] || '');
                pill.className = 'pill status-pill status-' + newData.status.toLowerCase().replace(/\s+/g, '');
            }
        }

        // 2. Update art time display
        if (newData.artMinutes !== undefined) {
            var actualMinsSpan = card.querySelector('.actual-minutes');
            if (actualMinsSpan) actualMinsSpan.textContent = newData.artMinutes;

            var quotedCharge = parseFloat(card.dataset.quotedCharge) || 0;
            var quotedHours = quotedCharge > 0 ? (Math.ceil(quotedCharge / 18.75) * 0.25) : 0;
            var actualMins = newData.artMinutes;
            var actualHours = actualMins > 0 ? (Math.ceil(actualMins / 15) * 0.25) : 0;
            var actualCost = actualHours * 75;

            var valueDiv = card.querySelector('.charge-line') ? card.querySelector('.charge-line').parentElement : null;
            if (valueDiv) {
                var html = '<div class="charge-line charge-line--quoted">';
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
        }

        // 3. Update card classes
        if (newData.status === 'Completed') {
            card.classList.add('card--completed');
            var duePill = card.querySelector('.due-status-pill');
            if (duePill) duePill.style.display = 'none';
        } else {
            card.classList.remove('card--completed');
        }

        // 4. Rebuild footer buttons for new status
        var existingFooter = card.querySelector('.card-footer-buttons');
        if (existingFooter) existingFooter.remove();
        injectQuickActions(card);

        // 5. Flash success on the card
        card.style.transition = 'box-shadow 0.3s ease';
        card.style.boxShadow = '0 0 0 3px #28a745';
        setTimeout(function () { card.style.boxShadow = ''; }, 2000);
    }

    // ── Text Search (Steve's gallery) ───────────────────────────────────
    // Searches card.textContent, which includes company name, Design_Num_SW
    // (`.design-num`) and ID_Design (`.id-design`) rendered by the Caspio
    // DataPage. Works on top of the archive date filter.
    var currentSteveSearchText = '';

    function injectSearchBar() {
        if (document.getElementById('steve-search-bar')) return;
        var galleryTab = document.getElementById('gallery-tab');
        if (!galleryTab) return;

        var bar = document.createElement('div');
        bar.id = 'steve-search-bar';
        bar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 16px;margin:0 0 12px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.08);flex-wrap:wrap;';

        var input = document.createElement('input');
        input.type = 'text';
        input.id = 'steve-text-search';
        input.placeholder = 'Search company, design #, or ID...';
        input.style.cssText = 'padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;color:#1e293b;width:260px;';

        var countSpan = document.createElement('span');
        countSpan.id = 'steve-search-count';
        countSpan.style.cssText = 'font-size:12px;color:#94a3b8;margin-left:auto;';

        var searchTimer = null;
        input.addEventListener('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                currentSteveSearchText = input.value.trim().toLowerCase();
                processCards();
            }, 200);
        });

        bar.appendChild(input);
        bar.appendChild(countSpan);

        // Insert as the first child of #gallery-tab so it sits above archive toggle + cards
        galleryTab.insertBefore(bar, galleryTab.firstChild);
    }

    function updateSteveSearchCount(shown, total) {
        var countSpan = document.getElementById('steve-search-count');
        if (!countSpan) return;
        countSpan.textContent = currentSteveSearchText
            ? shown + ' of ' + total + ' matches'
            : '';
    }

    // ── MutationObserver: Watch for Caspio gallery cards ────────────────
    function processCards() {
        const galleryTab = document.getElementById('gallery-tab');
        if (!galleryTab) return;

        // Remove skeleton loading when real cards arrive
        galleryTab.querySelectorAll('.skeleton-card, .skeleton-grid').forEach(s => s.remove());

        injectSearchBar();

        // Inject archive toggle button if not present
        if (!document.getElementById('archive-toggle-btn')) {
            var gridView = galleryTab.querySelector('#steve-grid-view');
            if (gridView) {
                var toggleDiv = document.createElement('div');
                toggleDiv.style.cssText = 'text-align:right;margin-bottom:8px;';
                toggleDiv.innerHTML = '<button id="archive-toggle-btn" onclick="toggleArchive()" style="padding:6px 14px;font-size:12px;border:1px solid #ccc;border-radius:6px;background:#f9fafb;cursor:pointer;color:#666;">Show Archive</button>';
                gridView.parentNode.insertBefore(toggleDiv, gridView);
            }
        }

        const cards = galleryTab.querySelectorAll('.card');
        var searchShown = 0;
        cards.forEach((card, idx) => {
            // Date filter: hide old cards unless archive is on
            if (!showArchive) {
                var dateField = card.querySelector('[data-field="Date_Created"], .cbResultSetDataCell');
                var cardText = card.textContent || '';
                // Check for date in card — look for common date patterns
                var dateMatch = cardText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
                if (dateMatch) {
                    var parts = dateMatch[1].split('/');
                    var cardDate = new Date(parts[2], parts[0] - 1, parts[1]);
                    if (cardDate < new Date(KANBAN_DATE_CUTOFF)) {
                        card.style.display = 'none';
                        return;
                    }
                }
            }

            // Text search filter — runs on top of archive date filter
            if (currentSteveSearchText) {
                var haystack = (card.textContent || '').toLowerCase();
                if (haystack.indexOf(currentSteveSearchText) === -1) {
                    card.style.display = 'none';
                    return;
                }
            }
            searchShown++;
            card.style.display = '';

            // Staggered entry animation delay
            card.style.animationDelay = (idx * 0.05) + 's';

            addRequestTypeBadge(card);
            styleCardPills(card);

            // Add status class AFTER styleCardPills (needs pill CSS class for fallback)
            addStatusClass(card);

            calculateArtHours(card);
            formatRepName(card);
            cleanEmptyFields(card);
            injectQuickActions(card);
            addAuditIndicator(card);
            injectMissingBadge(card);
        });
        updateSteveSearchCount(searchShown, cards.length);
        buildSummaryBar();
    }

    // ── Status Class: Add CSS class based on card status for left border + glow ──
    function addStatusClass(card) {
        if (card.dataset.statusClassAdded) return;
        const statusPill = card.querySelector('.status-pill');
        if (!statusPill) return;
        const text = statusPill.textContent.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().toLowerCase();
        const classMap = {
            'submitted': 'card--submitted',
            'in progress': 'card--in-progress',
            'awaiting approval': 'card--awaiting-approval',
            'revision requested': 'card--revision-requested',
            'approved': 'card--approved',
            'completed': 'card--completed'
        };
        var cls = classMap[text];

        // Fallback: check the status pill's CSS class (set by styleCardPills)
        if (!cls) {
            var pillClass = statusPill.className || '';
            if (pillClass.indexOf('submitted') !== -1) cls = 'card--submitted';
            else if (pillClass.indexOf('inprogress') !== -1) cls = 'card--in-progress';
            else if (pillClass.indexOf('awaitingapproval') !== -1) cls = 'card--awaiting-approval';
            else if (pillClass.indexOf('revisionrequested') !== -1) cls = 'card--revision-requested';
            else if (pillClass.indexOf('approved') !== -1) cls = 'card--approved';
            else if (pillClass.indexOf('completed') !== -1) cls = 'card--completed';
        }

        if (cls) card.classList.add(cls);

        // Add animated class for awaiting approval pill
        if (text === 'awaiting approval') {
            statusPill.classList.add('status-pill--awaiting');
        }

        // Add shake class for overdue due-date pills
        const duePill = card.querySelector('.due-status-pill');
        if (duePill && duePill.textContent.toLowerCase().includes('overdue')) {
            duePill.classList.add('due-pill--overdue');
        }

        card.dataset.statusClassAdded = '1';
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
                // Only process grid cards when grid is visible (not in board view)
                if (!kanbanActive) {
                    processCards();
                }
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

    // ── Kanban Board View (API-Driven) ──────────────────────────────────
    var kanbanActive = false;
    var kanbanData = null; // Cached API data

    // Date cutoff: only show art requests from March 15, 2026+ (new status system)
    var KANBAN_DATE_CUTOFF = '2026-03-15';
    var showArchive = false;

    // Toggle archive visibility
    window.toggleArchive = function () {
        showArchive = !showArchive;
        var btn = document.getElementById('archive-toggle-btn');
        if (btn) {
            btn.textContent = showArchive ? 'Hide Archive' : 'Show Archive';
            btn.classList.toggle('archive-toggle--active', showArchive);
        }
        // Re-process cards to apply/remove date filter
        processCards();
    };

    var KANBAN_COLUMNS = [
        { id: 'submitted', label: 'Submitted', match: ['Submitted'] },
        { id: 'in-progress', label: 'In Progress', match: ['In Progress'] },
        { id: 'awaiting', label: 'Awaiting Approval', match: ['Awaiting Approval'] },
        { id: 'revision', label: 'Revision Requested', match: ['Revision Requested'] },
        { id: 'approved', label: 'Approved', match: ['Approved'] },
        { id: 'completed', label: 'Completed', match: ['Completed'] }
    ];

    // Normalize raw Caspio status to canonical form
    function normalizeStatus(raw) {
        if (!raw || raw === '') return 'Submitted';
        var s = String(raw).trim();
        if (typeof raw === 'object') {
            var vals = Object.values(raw);
            s = vals.length > 0 ? String(vals[0]).trim() : 'Submitted';
        }
        var lower = s.toLowerCase();
        if (lower === 'submitted' || lower === '') return 'Submitted';
        if (lower === 'in progress') return 'In Progress';
        if (lower === 'awaiting approval') return 'Awaiting Approval';
        if (lower === 'completed' || lower === 'complete') return 'Completed';
        if (lower === 'approved') return 'Approved';
        if (lower.indexOf('revision') !== -1) return 'Revision Requested';
        return 'Submitted'; // Fallback — never lose a card
    }

    // Calculate due date badge text and CSS class from Due_Date string
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
        return { text: 'Upcoming', cls: 'kanban-card-due--ok' };
    }

    window.toggleKanbanView = function (view) {
        var gridView = document.getElementById('steve-grid-view');
        var boardView = document.getElementById('steve-kanban-board');
        var toggleBtns = document.querySelectorAll('#steve-view-toggle .view-toggle-btn');
        if (!gridView || !boardView) return;

        kanbanActive = (view === 'board');
        localStorage.setItem('steveViewPreference', view);

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
            // Process cards when switching back to grid (skipped while board was active)
            processCards();
        }
    };

    function buildKanbanBoard() {
        var board = document.getElementById('steve-kanban-board');
        if (!board) return;

        // Show loading state
        board.innerHTML = '<div style="text-align:center;padding:40px;color:#666;">'
            + '<i class="fas fa-spinner fa-spin" style="font-size:24px;margin-bottom:8px;"></i>'
            + '<div>Loading art requests...</div></div>';

        // Fetch from API with date cutoff
        // Note: Is_Rush is optional — added once the Caspio column exists.
        // If the select references a column Caspio doesn't have, the API 500s.
        // We fetch with Is_Rush and transparently fall back without it on 500.
        var selectFields = 'ID_Design,CompanyName,Design_Num_SW,Status,Sales_Rep,Due_Date,Date_Created,Revision_Count,Order_Type,Is_Rush';
        var selectFieldsFallback = 'ID_Design,CompanyName,Design_Num_SW,Status,Sales_Rep,Due_Date,Date_Created,Revision_Count,Order_Type';
        var baseUrl = API_BASE + '/api/artrequests?orderBy=Date_Created DESC&limit=200'
            + '&dateCreatedFrom=' + KANBAN_DATE_CUTOFF;
        var url = baseUrl + '&select=' + selectFields;

        fetch(url)
            .then(function (resp) {
                if (resp.status === 500) {
                    // Likely Is_Rush column not yet provisioned — retry without it
                    console.warn('[Kanban] fetch 500 with Is_Rush — retrying without it');
                    return fetch(baseUrl + '&select=' + selectFieldsFallback)
                        .then(function (r2) {
                            if (!r2.ok) throw new Error('API returned ' + r2.status);
                            return r2.json();
                        });
                }
                if (!resp.ok) throw new Error('API returned ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                var requests = Array.isArray(data) ? data : [];
                kanbanData = requests;
                renderKanbanColumns(board, requests);
            })
            .catch(function (err) {
                console.error('[Kanban] API fetch failed:', err);
                board.innerHTML = '<div style="text-align:center;padding:40px;color:#dc2626;">'
                    + '<strong>Error loading Kanban:</strong> ' + escapeHtml(err.message)
                    + '<br><button onclick="buildKanbanBoard()" style="margin-top:12px;padding:8px 16px;cursor:pointer;">Retry</button>'
                    + '</div>';
            });
    }

    var COMPLETED_SHOW_LIMIT = 5;

    function renderCardHtml(req) {
        var company = escapeHtml(req.CompanyName || 'Unknown');
        var designNum = req.Design_Num_SW || '';
        var designId = req.ID_Design || '';
        var rep = escapeHtml(req.Sales_Rep || '');
        var revCount = req.Revision_Count || 0;
        var due = getDueBadge(req.Due_Date);

        var orderType = '';
        if (req.Order_Type) {
            var ot = typeof req.Order_Type === 'object' ? Object.values(req.Order_Type)[0] : req.Order_Type;
            orderType = String(ot || '');
        }

        var isRushReq = isRush(req.Is_Rush);
        var badges = '';
        if (isRushReq) badges += '<span class="kanban-card-badge kanban-card-badge--rush">&#128293; RUSH</span>';
        if (orderType) badges += '<span class="kanban-card-badge kanban-card-badge--type">' + escapeHtml(orderType) + '</span>';
        if (revCount > 0) badges += '<span class="kanban-card-badge kanban-card-badge--rev">Rev ' + revCount + '</span>';

        var kanbanElapsed = (typeof ElapsedTimeUtils !== 'undefined')
            ? ElapsedTimeUtils.getKanbanElapsedBadge(req.Status || '', req, 'art')
            : '';

        var rushCls = isRushReq ? ' kanban-card--rush' : '';
        return '<div class="kanban-card' + rushCls + '" data-design-id="' + designId + '" onclick="window.open(\'/art-request/' + designId + '\', \'_blank\')">'
            + '<div class="kanban-card-company">' + company + kanbanElapsed + '</div>'
            + (designNum ? '<div class="kanban-card-design">#' + escapeHtml(designNum) + '</div>' : '')
            + '<div class="kanban-card-meta">'
            + '<span class="kanban-card-rep">' + rep + '</span>'
            + (due.text ? '<span class="kanban-card-due ' + due.cls + '">' + escapeHtml(due.text) + '</span>' : '')
            + '</div>'
            + (badges ? '<div class="kanban-card-badges">' + badges + '</div>' : '')
            + '</div>';
    }

    // Toggle completed column collapse
    window.toggleKanbanCollapse = function (colId, storageKey) {
        var col = document.querySelector('.kanban-column--' + colId);
        if (!col) return;
        col.classList.toggle('kanban-column--collapsed');
        var isCollapsed = col.classList.contains('kanban-column--collapsed');
        localStorage.setItem(storageKey, isCollapsed ? '1' : '0');
    };

    // Show all cards in completed column
    window.kanbanShowAll = function (colId) {
        var col = document.querySelector('.kanban-column--' + colId);
        if (!col) return;
        col.querySelectorAll('.kanban-card[style*="display: none"]').forEach(function (c) {
            c.style.display = '';
        });
        var showAllEl = col.querySelector('.kanban-show-all');
        if (showAllEl) showAllEl.remove();
    };

    function renderKanbanColumns(board, requests) {
        // Group requests into column buckets by normalized status
        var buckets = {};
        KANBAN_COLUMNS.forEach(function (col) { buckets[col.id] = []; });

        requests.forEach(function (req) {
            var status = normalizeStatus(req.Status);
            var placed = false;

            KANBAN_COLUMNS.forEach(function (col) {
                if (!placed && col.match.indexOf(status) !== -1) {
                    buckets[col.id].push(req);
                    placed = true;
                }
            });

            if (!placed) {
                buckets['submitted'].push(req);
            }
        });

        // Rush-first sort within each column (preserves Date_Created DESC as tiebreaker)
        KANBAN_COLUMNS.forEach(function (col) {
            (buckets[col.id] || []).sort(function (a, b) {
                return (isRush(a.Is_Rush) ? 0 : 1) - (isRush(b.Is_Rush) ? 0 : 1);
            });
        });

        var completedCollapsed = localStorage.getItem('steveKanbanCompletedCollapsed') !== '0'; // Default: collapsed

        // Render columns
        board.innerHTML = KANBAN_COLUMNS.map(function (col) {
            var colCards = buckets[col.id] || [];
            var isCompleted = col.id === 'completed';
            var isApproved = col.id === 'approved';
            var isCollapsible = isCompleted || isApproved;

            // For completed/approved: limit visible cards
            var visibleCards = colCards;
            var hiddenCount = 0;
            if (isCompleted && colCards.length > COMPLETED_SHOW_LIMIT) {
                visibleCards = colCards.slice(0, COMPLETED_SHOW_LIMIT);
                hiddenCount = colCards.length - COMPLETED_SHOW_LIMIT;
            }

            var cardsHtml = visibleCards.length === 0
                ? ''
                : visibleCards.map(function (req) { return renderCardHtml(req); }).join('');

            // Hidden cards (rendered but display:none)
            if (hiddenCount > 0) {
                cardsHtml += colCards.slice(COMPLETED_SHOW_LIMIT).map(function (req) {
                    return renderCardHtml(req).replace('class="kanban-card"', 'class="kanban-card" style="display: none"');
                }).join('');
                cardsHtml += '<div class="kanban-show-all" onclick="event.stopPropagation(); window.kanbanShowAll(\'' + col.id + '\')">Show all ' + colCards.length + ' items</div>';
            }

            // Collapse chevron for completed column
            var chevron = isCompleted
                ? '<span class="kanban-collapse-chevron" title="Click to collapse/expand">&#9660;</span>'
                : '';

            var collapseClass = (isCompleted && completedCollapsed) ? ' kanban-column--collapsed' : '';
            var clickHandler = isCompleted
                ? ' onclick="window.toggleKanbanCollapse(\'' + col.id + '\', \'steveKanbanCompletedCollapsed\')"'
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

    // ── Skeleton Loading: Show placeholder cards while Caspio loads ──
    function showSkeletonCards() {
        const galleryTab = document.getElementById('gallery-tab');
        if (!galleryTab || galleryTab.querySelector('.card')) return;
        const grid = galleryTab.querySelector('[class*="grid"], [class*="Gallery"], table');
        const target = grid || galleryTab;
        const skeletonHtml = Array.from({ length: 6 }, () => `
            <div class="skeleton-card">
                <div class="skeleton-header"></div>
                <div class="skeleton-body">
                    <div class="skeleton-line skeleton-line--long"></div>
                    <div class="skeleton-line skeleton-line--medium"></div>
                    <div class="skeleton-line skeleton-line--short"></div>
                    <div class="skeleton-line skeleton-line--pill"></div>
                </div>
            </div>`).join('');
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;padding:10px;';
        wrapper.innerHTML = skeletonHtml;
        wrapper.className = 'skeleton-grid';
        target.appendChild(wrapper);
    }

    // ── Init ────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        // Show skeleton placeholders immediately
        showSkeletonCards();

        // Restore saved tab preference
        const savedTab = localStorage.getItem('artistDashboardTab');
        if (savedTab && ['express', 'requirements'].includes(savedTab)) {
            showTab(savedTab);
        }

        // Always default to Grid view on page load

        initObserver();
        startNotificationPolling();
        loadBrokenMockupsWidget(); // Health check: surface art requests whose Box files are gone

        document.addEventListener('DataPageReady', () => {
            setTimeout(function () {
                if (!kanbanActive) {
                    processCards();
                }
            }, 500);
        });

        // Image modal close button — guard BOTH the close button AND the modal access in the callback
        // (H2) Asymmetric guard: `?.` on close button but then unguarded modal access in the callback
        // would still throw if the modal was missing.
        var imageModalClose = document.getElementById('imageModalClose');
        var imageModal = document.getElementById('imageModal');
        if (imageModalClose && imageModal) {
            imageModalClose.addEventListener('click', function () {
                imageModal.classList.remove('show');
            });
        }

        // Close image modal when clicking outside
        if (imageModal) {
            window.addEventListener('click', function (event) {
                if (event.target === imageModal) imageModal.classList.remove('show');
            });
        }

        // Notes panel: overlay click, close button, submit — (H1) guard each to stop init-chain crashes
        var notesOverlay = document.getElementById('notes-overlay');
        if (notesOverlay) notesOverlay.addEventListener('click', closeNotesPanel);

        var notesPanelClose = document.getElementById('notes-panel-close');
        if (notesPanelClose) notesPanelClose.addEventListener('click', closeNotesPanel);

        var noteSubmitBtn = document.getElementById('note-submit-btn');
        if (noteSubmitBtn) noteSubmitBtn.addEventListener('click', submitNote);

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

        // Fetch order header + line items in parallel.
        // Both fetches need their own .catch() so one failure doesn't reject Promise.all
        // and silently drop the audit badge rendering.
        Promise.all([
            fetch(API_BASE + '/api/manageorders/orders/' + encodeURIComponent(orderNum))
                .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                .catch(function () { return { result: [] }; }),
            fetch(API_BASE + '/api/manageorders/lineitems/' + encodeURIComponent(orderNum))
                .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                .catch(function () { return { result: [] }; })
        ])
        .then(function (results) {
                var orderData = (results[0].result || [])[0] || null;
                var items = results[1].result || [];
                var ART_PNS = ['Art', 'GRT-50', 'GRT-75'];
                var artItems = items.filter(function (item) {
                    return item.PartNumber && ART_PNS.indexOf(item.PartNumber.trim()) !== -1;
                });

                var steveCost = getSteveCostFromCard(card);

                if (artItems.length === 0) {
                    insertAuditBadge(card, 'No Art Charge', 'amber',
                        'No art charge found on invoice' + (steveCost > 0 ? ' \u2014 Steve: $' + steveCost.toFixed(2) : ''));
                } else {
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
                        var overage = steveCost - billedTotal;
                        insertAuditBadge(card, 'Art \u25B2 $' + billedTotal.toFixed(0), 'red',
                            'Steve: $' + steveCost.toFixed(2) + ' \u00B7 Billed: $' + billedTotal.toFixed(2) + ' \u2014 over by $' + overage.toFixed(2));
                    } else {
                        insertAuditBadge(card, 'Art \u2713 $' + billedTotal.toFixed(0), 'green',
                            'Steve: $' + steveCost.toFixed(2) + ' \u00B7 Billed: $' + billedTotal.toFixed(2));
                    }
                }

                // ShopWorks Art Done badge
                if (orderData) {
                    var artDone = orderData.sts_ArtDone === 1;
                    insertAuditBadge(card,
                        artDone ? '\u2713 SW Art Done' : '\u2717 SW Art Pending',
                        artDone ? 'green' : 'amber',
                        artDone ? 'Art marked done in ShopWorks' : 'Art not yet marked done in ShopWorks');
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

    // ── Broken Mockups Health Check Widget ─────────────────────────────
    // Polls /api/art-requests/broken-mockups on page load. If any art requests
    // have Box files that return 404, surfaces a red banner + modal list so
    // Steve can proactively re-upload before Nika/customers stumble on them.

    var brokenMockupsData = null;
    // Map<string designId, Array<{field, fileId}>> — lets per-card logic check
    // "is this card's design one of the broken ones?" in O(1) without re-scanning results.
    var brokenDesignIds = new Map();

    function loadBrokenMockupsWidget() {
        var widget = document.getElementById('steve-broken-mockups-widget');
        if (!widget) return;

        widget.style.display = '';
        widget.innerHTML = '<div class="broken-mockups-loading">'
            + '<span class="broken-mockups-spinner"></span>'
            + 'Checking mockup files in Box...'
            + '</div>';

        fetch(API_BASE + '/api/art-requests/broken-mockups')
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                brokenMockupsData = data;
                // Populate the per-card lookup map before any card render.
                brokenDesignIds = new Map();
                (data.results || []).forEach(function (r) {
                    if (r && r.designId != null) {
                        brokenDesignIds.set(String(r.designId), r.brokenSlots || []);
                    }
                });
                renderBrokenMockupsWidget(data);
                // processCards() may have already run before this fetch resolved —
                // sweep existing cards now so badges appear without waiting for the
                // next Caspio mutation.
                applyMissingBadgesToAllCards();
            })
            .catch(function (err) {
                console.warn('Broken mockups check failed:', err.message);
                widget.style.display = 'none';
            });
    }

    function applyMissingBadgesToAllCards() {
        var galleryTab = document.getElementById('gallery-tab');
        if (!galleryTab) return;
        galleryTab.querySelectorAll('.card').forEach(injectMissingBadge);
    }

    /**
     * Inject a red "File missing" corner badge on a card if its design is on the
     * broken-mockups list. Click opens the detail page in a new tab, where Task 1's
     * broken-slot card surfaces the Design # + Box File ID for manual Box recovery.
     * Idempotent via dataset flag.
     */
    function injectMissingBadge(card) {
        if (!card || card.dataset.missingBadgeAdded === '1') return;
        if (!brokenDesignIds || brokenDesignIds.size === 0) return;

        var idEl = card.querySelector('.id-design');
        if (!idEl) return;
        var designId = idEl.textContent.replace(/[^0-9]/g, '');
        if (!designId || !brokenDesignIds.has(designId)) return;

        card.dataset.missingBadgeAdded = '1';

        var slots = brokenDesignIds.get(designId) || [];
        var slotCount = slots.length;
        var tooltip = slotCount === 1
            ? 'Mockup file missing from Box — click to recover'
            : slotCount + ' mockup files missing from Box — click to recover';

        var badge = document.createElement('a');
        badge.className = 'card-missing-badge';
        badge.href = '/art-request/' + encodeURIComponent(designId);
        badge.target = '_blank';
        badge.rel = 'noopener';
        badge.title = tooltip;
        badge.innerHTML = '<span class="card-missing-badge-icon">\u26a0</span>'
            + '<span class="card-missing-badge-text">File missing</span>';
        // Don't let the badge click bubble up to any card-level handlers.
        badge.addEventListener('click', function (e) { e.stopPropagation(); });

        card.appendChild(badge);
    }

    function renderBrokenMockupsWidget(data) {
        var widget = document.getElementById('steve-broken-mockups-widget');
        if (!widget) return;

        if (!data || data.broken === 0) {
            widget.innerHTML = '';
            widget.style.display = 'none';
            return;
        }

        var label = data.broken === 1
            ? '<strong>1</strong> art request has a missing Box file'
            : '<strong>' + data.broken + '</strong> art requests have missing Box files';

        widget.innerHTML = '<div class="broken-mockups-banner">'
            + '<div class="broken-mockups-icon">\u26a0</div>'
            + '<div class="broken-mockups-text">'
            + '<div class="broken-mockups-title">Broken Box mockups detected</div>'
            + '<div class="broken-mockups-sub">' + label
            + ' (scanned ' + data.checked + ' records). '
            + 'Re-upload to fix before customers see them.</div>'
            + '</div>'
            + '<button type="button" class="broken-mockups-btn" id="broken-mockups-review-btn">'
            + 'Review Broken (' + data.broken + ')</button>'
            + '</div>';

        document.getElementById('broken-mockups-review-btn').addEventListener('click', openBrokenMockupsModal);
    }

    function openBrokenMockupsModal() {
        if (!brokenMockupsData) return;

        var existing = document.getElementById('broken-mockups-modal');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'broken-mockups-modal';
        overlay.className = 'broken-mockups-overlay';

        var rows = brokenMockupsData.results.map(function (r) {
            var dateStr = '';
            if (r.dateCreated) {
                try {
                    var d = new Date(r.dateCreated);
                    if (!isNaN(d.getTime())) {
                        dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    }
                } catch (e) { /* ignore */ }
            }
            var rep = r.salesRep ? (ArtActions.resolveRep(r.salesRep).displayName || r.salesRep) : '';
            var slotLabels = (r.brokenSlots || [])
                .map(function (s) { return friendlySlotLabel(s.field); })
                .join(', ');
            var statusClass = 'broken-status--' + (r.status || '').toLowerCase().replace(/\s+/g, '-');

            return '<tr class="broken-mockups-row">'
                + '<td class="broken-mockups-cell">'
                + '<a href="/art-request/' + encodeURIComponent(r.designId)
                + '" target="_blank" class="broken-mockups-link">#'
                + escapeHtml(String(r.designId)) + '</a>'
                + '</td>'
                + '<td class="broken-mockups-cell">' + escapeHtml(r.companyName || '(no name)') + '</td>'
                + '<td class="broken-mockups-cell">' + escapeHtml(rep || '\u2014') + '</td>'
                + '<td class="broken-mockups-cell">'
                + '<span class="broken-status-pill ' + statusClass + '">'
                + escapeHtml(r.status || '\u2014') + '</span>'
                + '</td>'
                + '<td class="broken-mockups-cell broken-mockups-cell--muted">' + escapeHtml(dateStr) + '</td>'
                + '<td class="broken-mockups-cell broken-mockups-cell--muted">' + escapeHtml(slotLabels) + '</td>'
                + '<td class="broken-mockups-cell">'
                + '<a href="/art-request/' + encodeURIComponent(r.designId)
                + '" target="_blank" class="broken-mockups-action-btn">Open \u2192</a>'
                + '</td>'
                + '</tr>';
        }).join('');

        var cachedNote = brokenMockupsData.cached
            ? ' (cached up to 10 min \u2014 <a href="#" id="broken-mockups-refresh" class="broken-mockups-refresh-link">refresh now</a>)'
            : '';

        overlay.innerHTML = '<div class="broken-mockups-modal">'
            + '<div class="broken-mockups-modal-header">'
            + '<h3>Broken Box Mockups (' + brokenMockupsData.broken + ')</h3>'
            + '<button type="button" class="broken-mockups-modal-close" id="broken-mockups-modal-close">&times;</button>'
            + '</div>'
            + '<div class="broken-mockups-modal-sub">'
            + 'Scanned ' + brokenMockupsData.checked + ' active art requests '
            + '(' + brokenMockupsData.uniqueFileIds + ' Box files checked)' + cachedNote + '. '
            + 'Each row links to the art request \u2014 click Open, then use the Re-upload button on the broken slot.'
            + '</div>'
            + '<div class="broken-mockups-modal-body">'
            + '<table class="broken-mockups-table">'
            + '<thead><tr>'
            + '<th>Design</th><th>Company</th><th>Rep</th><th>Status</th><th>Created</th><th>Broken slots</th><th></th>'
            + '</tr></thead>'
            + '<tbody>' + rows + '</tbody>'
            + '</table>'
            + '</div>'
            + '</div>';

        document.body.appendChild(overlay);

        function close() { overlay.remove(); document.body.style.overflow = ''; }
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        document.getElementById('broken-mockups-modal-close').addEventListener('click', close);
        document.addEventListener('keydown', function escListener(e) {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escListener); }
        });

        var refreshLink = document.getElementById('broken-mockups-refresh');
        if (refreshLink) {
            refreshLink.addEventListener('click', function (e) {
                e.preventDefault();
                refreshLink.textContent = 'refreshing...';
                fetch(API_BASE + '/api/art-requests/broken-mockups?refresh=true')
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        brokenMockupsData = data;
                        renderBrokenMockupsWidget(data);
                        close();
                        if (data.broken > 0) openBrokenMockupsModal();
                    })
                    .catch(function () { refreshLink.textContent = 'refresh failed'; });
            });
        }

        document.body.style.overflow = 'hidden';
    }

    function friendlySlotLabel(field) {
        var map = {
            Box_File_Mockup: 'Mockup 1',
            BoxFileLink: 'Mockup 2',
            Company_Mockup: 'Mockup 3',
            Additional_Art_1: 'Art File 5',
            Additional_Art_2: 'Art File 6'
        };
        return map[field] || field;
    }

    // ── Expose globals for HTML onclick attributes ────────────────────
    window.showTab = showTab;
})();
