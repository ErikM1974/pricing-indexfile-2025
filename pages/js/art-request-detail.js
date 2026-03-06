/**
 * art-request-detail.js — Loads and renders a single art request with notes timeline.
 *
 * URL pattern: /art-request/:designId
 * Fetches from:
 *   GET /api/artrequests?id_design=XXXXX&limit=1
 *   GET /api/design-notes?id_design=XXXXX&orderBy=Note_Date DESC
 *
 * Depends on: app-config.js (APP_CONFIG.API.BASE_URL)
 */
(function () {
    'use strict';

    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // Extract design ID from URL path: /art-request/12345
    const pathParts = window.location.pathname.split('/');
    const designId = pathParts[pathParts.length - 1];

    if (!designId || !/^\d+$/.test(designId)) {
        showError('Invalid Design ID', 'Please check the URL and try again.');
        return;
    }

    // ── Fetch Data ──────────────────────────────────────────────────────
    Promise.all([
        fetch(`${API_BASE}/api/artrequests?id_design=${designId}&limit=1`).then(r => {
            if (!r.ok) throw new Error(`Art request fetch failed: ${r.status}`);
            return r.json();
        }),
        fetch(`${API_BASE}/api/design-notes?id_design=${designId}&orderBy=Note_Date DESC`).then(r => {
            if (!r.ok) throw new Error(`Notes fetch failed: ${r.status}`);
            return r.json();
        })
    ])
    .then(([artRequests, notes]) => {
        if (!artRequests || artRequests.length === 0) {
            showError('Art Request Not Found', `No art request found with Design ID #${designId}.`);
            return;
        }
        render(artRequests[0], notes || []);
    })
    .catch(err => {
        console.error('Failed to load art request:', err);
        showError('Error Loading', 'Unable to load art request data. Please try again.');
    });

    // ── Render ──────────────────────────────────────────────────────────
    function render(req, notes) {
        document.getElementById('ard-loading').style.display = 'none';
        document.getElementById('ard-content').style.display = 'block';

        // Title
        document.title = `Art Request #${designId} - ${req.CompanyName || 'NWCA'}`;
        document.getElementById('ard-design-id').textContent = `Art Request #${designId}`;

        // Status badge
        const statusBadge = document.getElementById('ard-status-badge');
        const rawStatus = req.Status || 'Unknown';
        const statusClean = rawStatus.replace(/[^\p{L}\p{N}\s-]/gu, '').trim();
        statusBadge.textContent = statusClean;
        statusBadge.className = 'ard-status-badge ' + getStatusClass(statusClean);

        // Revision badge
        const revCount = req.Revision_Count || 0;
        if (revCount > 0) {
            const revBadge = document.getElementById('ard-revision-badge');
            revBadge.textContent = `Revision #${revCount}`;
            revBadge.style.display = 'inline-block';
        }

        // Info fields
        setText('ard-company', req.CompanyName);
        setText('ard-sales-rep', req.Sales_Rep);
        setText('ard-order-type', req.Order_Type);
        setText('ard-priority', req.Priority);
        setText('ard-due-date', formatDate(req.Due_Date));
        setText('ard-date-created', formatDate(req.Date_Created));

        // Billing
        const artMins = req.Art_Minutes || 0;
        const artHours = (Math.ceil(artMins / 15) * 0.25).toFixed(2);
        const artBilled = req.Amount_Art_Billed || parseFloat((artHours * 75).toFixed(2));
        document.getElementById('ard-art-minutes').textContent = artMins;
        document.getElementById('ard-art-hours').textContent = artHours;
        document.getElementById('ard-art-billed').textContent = `$${parseFloat(artBilled).toFixed(2)}`;

        // Submitter notes
        if (req.NOTES) {
            document.getElementById('ard-submitter-notes').textContent = req.NOTES;
            document.getElementById('ard-submitter-notes-card').style.display = 'block';
        }

        // Design preview image (check for File_Upload or Mockup_Link fields)
        const previewUrl = req.File_Upload || req.Mockup_Link || null;
        if (previewUrl) {
            document.getElementById('ard-preview-img').src = previewUrl;
            document.getElementById('ard-preview-card').style.display = 'block';
        }

        // Notes timeline
        renderNotes(notes);
    }

    // ── Notes Timeline ──────────────────────────────────────────────────
    function renderNotes(notes) {
        const container = document.getElementById('ard-notes-container');
        const emptyMsg = document.getElementById('ard-empty-notes');

        if (!notes || notes.length === 0) {
            emptyMsg.style.display = 'block';
            return;
        }

        emptyMsg.style.display = 'none';
        container.innerHTML = '';

        notes.forEach(note => {
            const div = document.createElement('div');
            div.className = 'ard-note';

            const noteType = note.Note_Type || 'Note';
            const typeClass = getNoteTypeClass(noteType);

            div.innerHTML = `
                <div class="ard-note-header">
                    <span class="ard-note-type ${typeClass}">${escapeHtml(noteType)}</span>
                    <span class="ard-note-meta">${escapeHtml(note.Note_By || '')} &bull; ${formatDate(note.Note_Date)}</span>
                </div>
                <div class="ard-note-text">${escapeHtml(note.Note_Text || '')}</div>
            `;

            container.appendChild(div);
        });
    }

    // ── Helpers ──────────────────────────────────────────────────────────
    function showError(title, msg) {
        document.getElementById('ard-loading').style.display = 'none';
        document.getElementById('ard-error-title').textContent = title;
        document.getElementById('ard-error-msg').textContent = msg;
        document.getElementById('ard-error').style.display = 'block';
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value || '--';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '--';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    }

    function getStatusClass(status) {
        const lower = status.toLowerCase().replace(/\s+/g, '');
        if (lower.includes('submitted')) return 'ard-status-badge--submitted';
        if (lower.includes('inprogress')) return 'ard-status-badge--inprogress';
        if (lower.includes('revision')) return 'ard-status-badge--revision';
        if (lower.includes('completed')) return 'ard-status-badge--completed';
        if (lower.includes('awaiting')) return 'ard-status-badge--awaiting';
        if (lower.includes('cancel')) return 'ard-status-badge--cancel';
        return 'ard-status-badge--default';
    }

    function getNoteTypeClass(noteType) {
        const lower = noteType.toLowerCase();
        if (lower.includes('design update')) return 'ard-note-type--design-update';
        if (lower.includes('art time')) return 'ard-note-type--art-time';
        if (lower.includes('revision')) return 'ard-note-type--revision';
        return 'ard-note-type--default';
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
})();
