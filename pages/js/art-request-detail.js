/**
 * art-request-detail.js — Loads and renders a single art request with notes timeline,
 * mockup gallery, and AE approval/revision actions.
 *
 * URL pattern: /art-request/:designId
 * Fetches from:
 *   GET /api/artrequests?id_design=XXXXX&limit=1
 *   GET /api/design-notes?id_design=XXXXX&orderBy=Note_Date DESC
 *
 * Depends on: app-config.js (APP_CONFIG.API.BASE_URL), EmailJS SDK
 */
(function () {
    'use strict';

    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    const EMAILJS_SERVICE_ID = 'service_1c4k67j';
    const EMAILJS_PUBLIC_KEY = '4qSbDO-SQs19TbP80';

    const REP_MAP = {
        'Taneisha': 'taneisha@nwcustomapparel.com',
        'Nika':     'nika@nwcustomapparel.com',
        'Ruthie':   'ruthie@nwcustomapparel.com',
        'Erik':     'erik@nwcustomapparel.com'
    };

    /** Resolve email or display name → display name using REP_MAP reverse lookup */
    function resolveRepName(emailOrName) {
        if (!emailOrName) return '';
        if (REP_MAP[emailOrName]) return emailOrName;
        for (const [name, addr] of Object.entries(REP_MAP)) {
            if (emailOrName.toLowerCase() === addr.toLowerCase()) return name;
        }
        if (emailOrName.includes('@')) {
            const local = emailOrName.substring(0, emailOrName.indexOf('@'));
            return local.charAt(0).toUpperCase() + local.slice(1);
        }
        return emailOrName;
    }

    // File fields to check for mockups/artwork
    const FILE_FIELDS = [
        { key: 'Box_File_Mockup', label: 'Mockup' },
        { key: 'BoxFileLink', label: 'Mockup 2' },
        { key: 'Company_Mockup', label: 'Mockup 3' },
        { key: 'File_Upload', label: 'Original Upload' },
        { key: 'CDN_Link', label: 'Artwork 1' },
        { key: 'CDN_Link_Two', label: 'Artwork 2' },
        { key: 'CDN_Link_Three', label: 'Artwork 3' },
        { key: 'CDN_Link_Four', label: 'Artwork 4' }
    ];

    // Extract design ID from URL path: /art-request/12345
    const pathParts = window.location.pathname.split('/');
    const designId = pathParts[pathParts.length - 1];

    if (!designId || !/^\d+$/.test(designId)) {
        showError('Invalid Design ID', 'Please check the URL and try again.');
        return;
    }

    // Store request data globally within IIFE for action handlers
    let currentRequest = null;

    // ── Fetch Data ──────────────────────────────────────────────────────
    Promise.all([
        fetch(`${API_BASE}/api/artrequests?id_design=${designId}&limit=1`).then(r => {
            if (!r.ok) throw new Error(`Art request fetch failed: ${r.status}`);
            return r.json();
        }),
        fetch(`${API_BASE}/api/design-notes?id_design=${designId}&orderBy=Note_Date DESC`).then(r => {
            if (!r.ok) throw new Error(`Notes fetch failed: ${r.status}`);
            return r.json();
        }),
        fetch(`${API_BASE}/api/art-charges?id_design=${designId}`).then(r => {
            if (!r.ok) return [];
            return r.json();
        }).catch(() => [])
    ])
    .then(([artRequests, notes, charges]) => {
        if (!artRequests || artRequests.length === 0) {
            showError('Art Request Not Found', `No art request found with Design ID #${designId}.`);
            return;
        }
        currentRequest = artRequests[0];
        render(currentRequest, notes || [], charges || []);
    })
    .catch(err => {
        console.error('Failed to load art request:', err);
        showError('Error Loading', 'Unable to load art request data. Please try again.');
    });

    // ── Render ──────────────────────────────────────────────────────────
    function render(req, notes, charges) {
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

        // Request type badge (Mockup)
        if (req.Request_Type && req.Request_Type.toLowerCase() === 'mockup') {
            const typeBadge = document.createElement('span');
            typeBadge.className = 'ard-type-badge ard-type-badge--mockup';
            typeBadge.textContent = '\uD83D\uDCF8 MOCKUP';
            const headerEl = document.getElementById('ard-design-id');
            if (headerEl) headerEl.parentNode.insertBefore(typeBadge, headerEl.nextSibling);
        }

        // Info fields
        setText('ard-company', req.CompanyName);
        const repEmail = req.User_Email || req.Sales_Rep || '';
        const repResolved = resolveRepName(repEmail);
        setText('ard-sales-rep', repResolved);
        // Order_Type can be an object like {'6':'Transfer'} from Caspio
        const orderType = req.Order_Type && typeof req.Order_Type === 'object'
            ? Object.values(req.Order_Type).join(', ')
            : req.Order_Type;
        setText('ard-order-type', orderType);
        setText('ard-priority', req.Priority);
        setText('ard-due-date', formatDate(req.Due_Date));
        setText('ard-date-created', formatDate(req.Date_Created));

        // Garment Placement
        if (req.Garment_Placement) {
            setText('ard-placement', req.Garment_Placement);
            document.getElementById('ard-placement-field').style.display = '';
        }

        // Billing
        const artMins = req.Art_Minutes || 0;
        const artHours = (Math.ceil(artMins / 15) * 0.25).toFixed(2);
        const artBilled = req.Amount_Art_Billed || parseFloat((artHours * 75).toFixed(2));
        document.getElementById('ard-art-minutes').textContent = artMins;
        document.getElementById('ard-art-hours').textContent = artHours;
        document.getElementById('ard-art-billed').textContent = `$${parseFloat(artBilled).toFixed(2)}`;

        // Contact Info
        const firstName = req.First_name || req.First_Name || '';
        const lastName = req.Last_name || req.Last_Name || '';
        const contactEmail = req.Email_Contact || req.Email || '';
        const contactName = [firstName, lastName].filter(Boolean).join(' ');
        if (contactName || contactEmail) {
            document.getElementById('ard-contact-card').style.display = '';
            if (contactName) setText('ard-contact-name', contactName);
            if (contactEmail) {
                const emailEl = document.getElementById('ard-contact-email');
                emailEl.textContent = contactEmail;
                emailEl.style.cursor = 'pointer';
                emailEl.title = 'Click to email';
                emailEl.addEventListener('click', () => { window.location.href = 'mailto:' + contactEmail; });
            }
        }

        // Submitter notes
        if (req.NOTES) {
            document.getElementById('ard-submitter-notes').textContent = req.NOTES;
            document.getElementById('ard-submitter-notes-card').style.display = 'block';
        }

        // Mockup Gallery
        renderMockupGallery(req);

        // Mockup Upload
        initMockupUpload(req);

        // AE Action Bar — show only when status contains "Awaiting Approval"
        const statusLower = statusClean.toLowerCase().replace(/\s+/g, '');
        if (statusLower.includes('awaitingapproval')) {
            document.getElementById('ard-action-bar').style.display = '';
            initActionBar();
        }

        // Notes timeline
        renderNotes(notes);

        // Art charge history
        renderCharges(charges);

        // Status timeline
        renderStatusTimeline(notes);
    }

    // ── Mockup Gallery ────────────────────────────────────────────────────
    function renderMockupGallery(req) {
        const galleryCard = document.getElementById('ard-gallery-card');
        const grid = document.getElementById('ard-gallery-grid');
        grid.innerHTML = '';

        let fileCount = 0;
        FILE_FIELDS.forEach(field => {
            const url = req[field.key];
            if (!url || !url.trim()) return;
            // Filter out bare CDN base URLs that aren't actual files
            if (/^https?:\/\/cdn\.caspio\.com\/[A-Z0-9]+\/?$/i.test(url.trim())) return;
            fileCount++;

            const thumb = document.createElement('div');
            thumb.className = 'ard-gallery-thumb';
            thumb.innerHTML = `
                <img src="${escapeHtml(url)}" alt="${escapeHtml(field.label)}" loading="lazy"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="ard-gallery-placeholder" style="display:none;">
                    <span>File</span>
                </div>
                <div class="ard-gallery-label">${escapeHtml(field.label)}</div>
            `;
            thumb.addEventListener('click', () => openLightbox(url, field.label));
            grid.appendChild(thumb);
        });

        if (fileCount > 0) {
            galleryCard.style.display = '';
        }
    }

    // ── Mockup Upload ─────────────────────────────────────────────────
    // Writable text URL fields for Steve's mockup uploads (priority order)
    // CDN_Link* fields are Caspio FILE fields (read-only via API) — cannot write to them.
    const UPLOAD_FIELDS = [
        { key: 'Box_File_Mockup', label: 'Mockup' },
        { key: 'BoxFileLink', label: 'Mockup 2' },
        { key: 'Company_Mockup', label: 'Mockup 3' }
    ];

    function initMockupUpload(req) {
        var uploadCard = document.getElementById('ard-upload-card');
        var saveBtn = document.getElementById('ard-btn-upload');
        var slotLabel = document.getElementById('ard-upload-slot');
        var statusEl = document.getElementById('ard-upload-status');

        if (!uploadCard || !saveBtn) return;

        // Track active mode: 'file' or 'url'
        var activeMode = 'file';
        var selectedFile = null;

        // Find first empty upload slot
        var targetField = findNextSlot();

        if (!targetField) {
            slotLabel.textContent = 'All mockup slots are full (5/5)';
            saveBtn.style.display = 'none';
        } else {
            slotLabel.textContent = 'Will save to: ' + targetField.label;
        }

        uploadCard.style.display = '';

        // ── Tab Switching ─────────────────────────────────────────────
        var tabFile = document.getElementById('ard-tab-file');
        var tabUrl = document.getElementById('ard-tab-url');
        var panelFile = document.getElementById('ard-panel-file');
        var panelUrl = document.getElementById('ard-panel-url');

        if (tabFile) tabFile.addEventListener('click', function () {
            activeMode = 'file';
            tabFile.classList.add('active');
            tabUrl.classList.remove('active');
            panelFile.style.display = '';
            panelUrl.style.display = 'none';
            updateSaveButton();
        });
        if (tabUrl) tabUrl.addEventListener('click', function () {
            activeMode = 'url';
            tabUrl.classList.add('active');
            tabFile.classList.remove('active');
            panelUrl.style.display = '';
            panelFile.style.display = 'none';
            updateSaveButton();
        });

        // ── File Upload (drag & drop + click) ─────────────────────────
        var dropzone = document.getElementById('ard-dropzone');
        var fileInput = document.getElementById('ard-file-input');
        var filePreview = document.getElementById('ard-file-preview');
        var filePreviewImg = document.getElementById('ard-file-preview-img');
        var fileInfo = document.getElementById('ard-file-info');
        var fileRemove = document.getElementById('ard-file-remove');

        if (dropzone) {
            dropzone.addEventListener('click', function () { fileInput.click(); });
            dropzone.addEventListener('dragover', function (e) {
                e.preventDefault();
                dropzone.classList.add('ard-dropzone--active');
            });
            dropzone.addEventListener('dragleave', function () {
                dropzone.classList.remove('ard-dropzone--active');
            });
            dropzone.addEventListener('drop', function (e) {
                e.preventDefault();
                dropzone.classList.remove('ard-dropzone--active');
                if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
            });
        }

        if (fileInput) fileInput.addEventListener('change', function () {
            if (fileInput.files.length > 0) handleFileSelect(fileInput.files[0]);
        });

        if (fileRemove) fileRemove.addEventListener('click', function () {
            clearFileSelection();
        });

        function handleFileSelect(file) {
            if (file.size > 20 * 1024 * 1024) {
                showUploadStatus('File too large (max 20MB)', true);
                return;
            }
            selectedFile = file;
            var sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            fileInfo.textContent = file.name + ' (' + sizeMB + ' MB)';

            // Show preview for images
            if (file.type.startsWith('image/')) {
                var reader = new FileReader();
                reader.onload = function (e) {
                    filePreviewImg.src = e.target.result;
                    filePreview.style.display = '';
                };
                reader.readAsDataURL(file);
            } else {
                filePreviewImg.src = '';
                filePreview.style.display = '';
            }
            dropzone.style.display = 'none';
            updateSaveButton();
        }

        function clearFileSelection() {
            selectedFile = null;
            fileInput.value = '';
            filePreview.style.display = 'none';
            filePreviewImg.src = '';
            dropzone.style.display = '';
            updateSaveButton();
        }

        // ── URL Paste (fallback) ──────────────────────────────────────
        var urlInput = document.getElementById('ard-mockup-url');
        var urlPreview = document.getElementById('ard-upload-preview');
        var urlPreviewImg = document.getElementById('ard-upload-preview-img');
        var debounceTimer = null;

        if (urlInput) urlInput.addEventListener('input', function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function () {
                var url = urlInput.value.trim();
                if (url && isValidUrl(url)) {
                    urlPreviewImg.src = url;
                    urlPreviewImg.onerror = function () { urlPreview.style.display = 'none'; };
                    urlPreviewImg.onload = function () { urlPreview.style.display = ''; };
                } else {
                    urlPreview.style.display = 'none';
                }
                updateSaveButton();
            }, 400);
        });

        // ── Save Button State ─────────────────────────────────────────
        function updateSaveButton() {
            if (!targetField) { saveBtn.disabled = true; return; }
            if (activeMode === 'file') {
                saveBtn.disabled = !selectedFile;
                saveBtn.textContent = 'Upload Mockup';
            } else {
                var url = urlInput ? urlInput.value.trim() : '';
                saveBtn.disabled = !url || !isValidUrl(url);
                saveBtn.textContent = 'Save Mockup URL';
            }
        }

        // ── Save Handler ──────────────────────────────────────────────
        saveBtn.addEventListener('click', async function () {
            if (!targetField) return;
            saveBtn.disabled = true;
            statusEl.style.display = 'none';

            if (activeMode === 'file' && selectedFile) {
                await uploadFileToBox(selectedFile);
            } else if (activeMode === 'url') {
                await saveUrlDirect();
            }
        });

        // ── File Upload via Box API ───────────────────────────────────
        async function uploadFileToBox(file) {
            var progressBar = document.getElementById('ard-upload-progress');
            var progressFill = document.getElementById('ard-progress-fill');
            var progressText = document.getElementById('ard-progress-text');

            saveBtn.textContent = 'Uploading...';
            if (progressBar) { progressBar.style.display = ''; progressFill.style.width = '10%'; }

            try {
                var pkId = req.PK_ID;
                if (!pkId) throw new Error('No PK_ID found on art request');

                var formData = new FormData();
                formData.append('file', file);
                formData.append('pkId', String(pkId));
                formData.append('customerId', String(req.Shopwork_customer_number || req.id_customer || ''));
                formData.append('companyName', req.CompanyName || '');

                if (progressFill) progressFill.style.width = '30%';
                if (progressText) progressText.textContent = 'Uploading to Box...';

                var resp = await fetch(API_BASE + '/api/art-requests/' + designId + '/upload-mockup', {
                    method: 'POST',
                    body: formData
                });

                if (progressFill) progressFill.style.width = '80%';

                if (!resp.ok) {
                    var errData = await resp.json().catch(function () { return {}; });
                    throw new Error(errData.error || 'Server returned ' + resp.status);
                }

                var result = await resp.json();
                if (progressFill) progressFill.style.width = '100%';
                if (progressText) progressText.textContent = 'Done!';

                // Update local data and re-render
                currentRequest[result.field] = result.url;
                renderMockupGallery(currentRequest);

                showUploadStatus('Mockup uploaded to Box and saved to ' + result.field, false);
                clearFileSelection();
                if (progressBar) setTimeout(function () { progressBar.style.display = 'none'; }, 1500);

                advanceToNextSlot();

            } catch (err) {
                console.error('Box upload failed:', err);
                showUploadStatus('Error: ' + (err.message || 'Upload failed'), true);
                if (progressBar) progressBar.style.display = 'none';
                saveBtn.textContent = 'Upload Mockup';
                saveBtn.disabled = false;
            }
        }

        // ── URL Paste Save (fallback) ─────────────────────────────────
        async function saveUrlDirect() {
            var url = urlInput.value.trim();
            if (!url) return;

            saveBtn.textContent = 'Saving...';

            try {
                var pkId = req.PK_ID;
                if (!pkId) throw new Error('No PK_ID found on art request');

                var resp = await fetch(API_BASE + '/api/artrequests/' + pkId, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [targetField.key]: url })
                });

                if (!resp.ok) {
                    var errData = await resp.json().catch(function () { return {}; });
                    throw new Error(errData.error || 'Server returned ' + resp.status);
                }

                currentRequest[targetField.key] = url;
                renderMockupGallery(currentRequest);

                showUploadStatus('Mockup URL saved to ' + targetField.label, false);
                urlInput.value = '';
                if (urlPreview) urlPreview.style.display = 'none';

                advanceToNextSlot();

            } catch (err) {
                console.error('Failed to save mockup URL:', err);
                showUploadStatus('Error: ' + (err.message || 'Failed to save'), true);
                saveBtn.textContent = 'Save Mockup URL';
                saveBtn.disabled = false;
            }
        }

        // ── Helpers ───────────────────────────────────────────────────
        function findNextSlot() {
            for (var i = 0; i < UPLOAD_FIELDS.length; i++) {
                var val = req[UPLOAD_FIELDS[i].key];
                if (!val || !val.trim() || /^https?:\/\/cdn\.caspio\.com\/[A-Z0-9]+\/?$/i.test(val.trim())) {
                    return UPLOAD_FIELDS[i];
                }
            }
            return null;
        }

        function advanceToNextSlot() {
            targetField = null;
            for (var i = 0; i < UPLOAD_FIELDS.length; i++) {
                var val = currentRequest[UPLOAD_FIELDS[i].key];
                if (!val || !val.trim() || /^https?:\/\/cdn\.caspio\.com\/[A-Z0-9]+\/?$/i.test(val.trim())) {
                    targetField = UPLOAD_FIELDS[i];
                    break;
                }
            }
            if (targetField) {
                slotLabel.textContent = 'Will save to: ' + targetField.label;
                updateSaveButton();
            } else {
                slotLabel.textContent = 'All mockup slots are full (5/5)';
                saveBtn.style.display = 'none';
            }
        }

        function showUploadStatus(msg, isError) {
            statusEl.textContent = msg;
            statusEl.className = 'ard-upload-status ' + (isError ? 'ard-upload-status--error' : 'ard-upload-status--success');
            statusEl.style.display = '';
        }
    }

    function isValidUrl(str) {
        try {
            const url = new URL(str);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (e) {
            return false;
        }
    }

    // ── Lightbox ────────────────────────────────────────────────────────
    function openLightbox(url, label) {
        const lightbox = document.getElementById('ard-lightbox');
        document.getElementById('ard-lightbox-img').src = url;
        document.getElementById('ard-lightbox-label').textContent = label || '';
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        document.getElementById('ard-lightbox').style.display = 'none';
        document.getElementById('ard-lightbox-img').src = '';
        document.body.style.overflow = '';
    }

    // Lightbox event listeners
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('ard-lightbox-close').addEventListener('click', closeLightbox);
        document.getElementById('ard-lightbox-backdrop').addEventListener('click', closeLightbox);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeLightbox();
                closeChangesModal();
            }
        });
    });

    // ── AE Action Bar ──────────────────────────────────────────────────
    function initActionBar() {
        const aeSelect = document.getElementById('ard-ae-select');
        const approveBtn = document.getElementById('ard-btn-approve');
        const changesBtn = document.getElementById('ard-btn-changes');

        // Enable buttons when name is selected
        aeSelect.addEventListener('change', () => {
            const hasName = aeSelect.value !== '';
            approveBtn.disabled = !hasName;
            changesBtn.disabled = !hasName;
        });

        approveBtn.addEventListener('click', () => {
            const aeName = aeSelect.value;
            if (!aeName) return;
            if (!confirm(`Approve this design as ${aeName}? This will mark the request as Completed.`)) return;
            approveDesign(designId, aeName);
        });

        changesBtn.addEventListener('click', () => {
            const aeName = aeSelect.value;
            if (!aeName) return;
            openChangesModal();
        });
    }

    // ── Approve Design ─────────────────────────────────────────────────
    async function approveDesign(id, aeName) {
        const approveBtn = document.getElementById('ard-btn-approve');
        const changesBtn = document.getElementById('ard-btn-changes');
        approveBtn.disabled = true;
        changesBtn.disabled = true;
        approveBtn.textContent = 'Approving...';

        try {
            // 1. Update status to Completed
            const statusResp = await fetch(`${API_BASE}/api/art-requests/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Completed' })
            });
            if (!statusResp.ok) throw new Error(`Status update failed: ${statusResp.status}`);

            // 2. Create approval note
            const aeEmail = REP_MAP[aeName] || 'sales@nwcustomapparel.com';
            const noteResp = await fetch(`${API_BASE}/api/art-requests/${id}/note`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    noteType: 'Status Update',
                    noteText: `Design approved by ${aeName}`,
                    noteBy: aeEmail
                })
            });
            if (!noteResp.ok) throw new Error(`Note creation failed: ${noteResp.status}`);

            // 3. Send completion email to Steve (fire-and-forget)
            sendAENotificationEmail('approved', aeName);

            // 4. Push real-time notification for Steve's dashboard
            pushArtNotification('approved', aeName);

            showSuccessMessage('Design approved! Steve has been notified.');
            disableActionBar();
            updateStatusBadge('Completed', 'ard-status-badge--completed');
        } catch (err) {
            console.error('Approve design failed:', err);
            approveBtn.textContent = 'Error — retry';
            approveBtn.style.background = '#dc3545';
            approveBtn.disabled = false;
            changesBtn.disabled = false;
        }
    }

    // ── Request Changes ────────────────────────────────────────────────
    function openChangesModal() {
        document.getElementById('ard-changes-notes').value = '';
        document.getElementById('ard-changes-overlay').style.display = 'block';
        document.getElementById('ard-changes-modal').style.display = 'block';
        document.getElementById('ard-changes-notes').focus();

        // Wire up event listeners (only once)
        const cancelBtn = document.getElementById('ard-changes-cancel');
        const submitBtn = document.getElementById('ard-changes-submit');
        const overlay = document.getElementById('ard-changes-overlay');

        // Remove old listeners by replacing elements
        const newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        newCancel.addEventListener('click', closeChangesModal);

        const newOverlay = overlay.cloneNode(true);
        overlay.parentNode.replaceChild(newOverlay, overlay);
        newOverlay.addEventListener('click', closeChangesModal);

        const newSubmit = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmit, submitBtn);
        newSubmit.addEventListener('click', () => {
            const notes = document.getElementById('ard-changes-notes').value.trim();
            if (!notes) {
                document.getElementById('ard-changes-notes').style.borderColor = '#dc3545';
                return;
            }
            const aeName = document.getElementById('ard-ae-select').value;
            requestChanges(designId, aeName, notes);
        });
    }

    function closeChangesModal() {
        document.getElementById('ard-changes-overlay').style.display = 'none';
        document.getElementById('ard-changes-modal').style.display = 'none';
    }

    async function requestChanges(id, aeName, notes) {
        const submitBtn = document.getElementById('ard-changes-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            // 1. Update status to Revision Requested
            const statusResp = await fetch(`${API_BASE}/api/art-requests/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Revision Requested' })
            });
            if (!statusResp.ok) throw new Error(`Status update failed: ${statusResp.status}`);

            // 2. Create revision note
            const aeEmail = REP_MAP[aeName] || 'sales@nwcustomapparel.com';
            const noteResp = await fetch(`${API_BASE}/api/art-requests/${id}/note`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    noteType: 'Design Update',
                    noteText: `Revision requested by ${aeName}: ${notes}`,
                    noteBy: aeEmail
                })
            });
            if (!noteResp.ok) throw new Error(`Note creation failed: ${noteResp.status}`);

            // 3. Send revision email to Steve (fire-and-forget)
            sendAENotificationEmail('revision', aeName, notes);

            // 4. Push real-time notification for Steve's dashboard
            pushArtNotification('revision', aeName);

            closeChangesModal();
            showSuccessMessage('Revision request sent! Steve has been notified.');
            disableActionBar();
            updateStatusBadge('Revision Requested', 'ard-status-badge--revision');
        } catch (err) {
            console.error('Request changes failed:', err);
            submitBtn.textContent = 'Error — retry';
            submitBtn.style.background = '#dc3545';
            submitBtn.disabled = false;
        }
    }

    // ── AE Email Notification (to Steve) ──────────────────────────────
    function sendAENotificationEmail(type, aeName, notes) {
        if (typeof emailjs === 'undefined') {
            console.warn('EmailJS not loaded — skipping notification');
            return;
        }

        const companyName = currentRequest ? currentRequest.CompanyName : 'Unknown';
        const detailLink = window.location.href;

        let templateId, templateParams;

        if (type === 'approved') {
            templateId = 'template_art_completed';
            const artMins = currentRequest ? (currentRequest.Art_Minutes || 0) : 0;
            const quarterHours = Math.ceil(artMins / 15) * 0.25;
            const cost = (quarterHours * 75).toFixed(2);
            templateParams = {
                to_email: 'art@nwcustomapparel.com',
                to_name: 'Steve',
                design_id: designId,
                company_name: companyName,
                art_minutes: artMins,
                art_cost: `$${cost}`,
                detail_link: detailLink,
                from_name: `${aeName} — Sales`
            };
        } else if (type === 'revision') {
            templateId = 'template_art_revision';
            templateParams = {
                to_email: 'art@nwcustomapparel.com',
                to_name: 'Steve',
                design_id: designId,
                company_name: companyName,
                revision_notes: notes || '',
                revision_count: currentRequest ? (currentRequest.Revision_Count || 0) + 1 : 1,
                detail_link: detailLink,
                from_name: `${aeName} — Sales`
            };
        }

        if (templateId) {
            emailjs.send(EMAILJS_SERVICE_ID, templateId, templateParams, EMAILJS_PUBLIC_KEY)
                .then(() => console.log(`AE notification email sent (${type})`))
                .catch(err => console.warn(`AE notification email failed (${type}, non-blocking):`, err));
        }
    }

    // ── Push Real-Time Notification (for Steve's dashboard toast) ────────
    function pushArtNotification(type, aeName) {
        const companyName = currentRequest ? currentRequest.CompanyName : 'Unknown';
        fetch(`${API_BASE}/api/art-notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, designId, companyName, actorName: aeName })
        }).catch(err => console.warn('Art notification push failed (non-blocking):', err));
    }

    // ── UI Helpers ────────────────────────────────────────────────────────
    function showSuccessMessage(msg) {
        const el = document.getElementById('ard-success-msg');
        el.textContent = msg;
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 5000);
    }

    function disableActionBar() {
        document.getElementById('ard-btn-approve').disabled = true;
        document.getElementById('ard-btn-changes').disabled = true;
        document.getElementById('ard-ae-select').disabled = true;
        document.getElementById('ard-btn-approve').textContent = 'Approved';
        document.getElementById('ard-btn-approve').style.opacity = '0.6';
        document.getElementById('ard-btn-changes').style.opacity = '0.6';
    }

    function updateStatusBadge(text, cssClass) {
        const badge = document.getElementById('ard-status-badge');
        badge.textContent = text;
        badge.className = 'ard-status-badge ' + cssClass;
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
        if (lower.includes('revisionrequested')) return 'ard-status-badge--revision';
        if (lower.includes('awaitingapproval')) return 'ard-status-badge--awaiting';
        if (lower.includes('completed')) return 'ard-status-badge--completed';
        if (lower.includes('cancel')) return 'ard-status-badge--cancel';
        return 'ard-status-badge--default';
    }

    function getNoteTypeClass(noteType) {
        const lower = noteType.toLowerCase();
        if (lower.includes('mockup sent')) return 'ard-note-type--mockup-sent';
        if (lower.includes('design update')) return 'ard-note-type--design-update';
        if (lower.includes('art time')) return 'ard-note-type--art-time';
        if (lower.includes('status update')) return 'ard-note-type--status-update';
        if (lower.includes('revision')) return 'ard-note-type--revision';
        return 'ard-note-type--default';
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Art Charge History ────────────────────────────────────────────────
    function renderCharges(charges) {
        const card = document.getElementById('ard-charges-card');
        const list = document.getElementById('ard-charges-list');
        const empty = document.getElementById('ard-charges-empty');

        if (!charges || charges.length === 0) return;

        card.style.display = '';
        empty.style.display = 'none';
        list.innerHTML = '';

        charges.forEach(function (charge) {
            const div = document.createElement('div');
            div.className = 'ard-charge-row';

            const typeBadgeClass = getChargeTypeClass(charge.Charge_Type);
            const minsDisplay = charge.Minutes || 0;
            const costDisplay = charge.Cost ? '$' + parseFloat(charge.Cost).toFixed(2) : '$0.00';
            const dateDisplay = formatDate(charge.Charge_Date);
            const desc = charge.Description || '';
            const runMins = charge.Running_Total_Minutes || 0;
            const runCost = charge.Running_Total_Cost ? parseFloat(charge.Running_Total_Cost).toFixed(2) : '0.00';

            div.innerHTML =
                '<div class="ard-charge-header">' +
                    '<span class="ard-charge-type ' + typeBadgeClass + '">' + escapeHtml(charge.Charge_Type || 'Unknown') + '</span>' +
                    '<span class="ard-charge-date">' + dateDisplay + '</span>' +
                '</div>' +
                '<div class="ard-charge-detail">' +
                    '<span class="ard-charge-time">' + minsDisplay + ' min &middot; ' + costDisplay + '</span>' +
                    (desc ? '<span class="ard-charge-desc">' + escapeHtml(desc) + '</span>' : '') +
                '</div>' +
                '<div class="ard-charge-running">Running total: ' + runMins + ' min ($' + runCost + ')</div>';

            list.appendChild(div);
        });
    }

    function getChargeTypeClass(type) {
        if (!type) return 'ard-charge-type--default';
        var lower = type.toLowerCase();
        if (lower.includes('mockup')) return 'ard-charge-type--mockup';
        if (lower.includes('completion')) return 'ard-charge-type--completion';
        if (lower.includes('log')) return 'ard-charge-type--logtime';
        return 'ard-charge-type--default';
    }

    // ── Status Timeline ──────────────────────────────────────────────────
    function renderStatusTimeline(notes) {
        var container = document.getElementById('ard-timeline');
        var stepsEl = document.getElementById('ard-timeline-steps');
        if (!container || !stepsEl || !currentRequest) return;

        var STEPS = [
            { key: 'submitted', label: 'Submitted', match: ['submitted'] },
            { key: 'inprogress', label: 'In Progress', match: ['in progress', 'working'] },
            { key: 'awaiting', label: 'Awaiting Approval', match: ['awaiting approval', 'mockup sent'] },
            { key: 'completed', label: 'Completed', match: ['completed', 'approved'] }
        ];

        var revisionStep = { key: 'revision', label: 'Revision Requested', match: ['revision'] };

        var currentStatus = (currentRequest.Status || '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().toLowerCase();
        var stepDates = {};
        var hasRevision = false;

        // Submitted = creation date
        stepDates.submitted = currentRequest.Date_Created;

        // Scan notes chronologically to find status transitions
        var sortedNotes = (notes || []).slice().sort(function (a, b) {
            return new Date(a.Note_Date) - new Date(b.Note_Date);
        });

        sortedNotes.forEach(function (note) {
            var text = (note.Note_Text || '').toLowerCase();
            var type = (note.Note_Type || '').toLowerCase();
            var date = note.Note_Date;

            if (type.includes('mockup sent') || text.includes('mockup sent')) {
                if (!stepDates.awaiting) stepDates.awaiting = date;
            }
            if (text.includes('revision requested') || type.includes('revision')) {
                stepDates.revision = date;
                hasRevision = true;
            }
            if (text.includes('working') || text.includes('in progress')) {
                if (!stepDates.inprogress) stepDates.inprogress = date;
            }
            if ((text.includes('approved') || text.includes('completed')) && type.includes('status')) {
                if (!stepDates.completed) stepDates.completed = date;
            }
        });

        // Infer "In Progress" if later steps exist
        if (!stepDates.inprogress && (stepDates.awaiting || stepDates.completed)) {
            stepDates.inprogress = stepDates.submitted;
        }

        // Build step list (include revision only if it happened)
        var activeSteps = STEPS.slice();
        if (hasRevision) {
            activeSteps.splice(3, 0, revisionStep);
        }

        // Determine current step — live status is definitive
        var currentStepIdx = 0;
        var statusMatchFound = false;

        // First try: match against the actual current status (definitive)
        activeSteps.forEach(function (step, i) {
            if (step.match.some(function (s) { return currentStatus.includes(s); })) {
                currentStepIdx = i;
                statusMatchFound = true;
            }
        });

        // Fallback: use dates if no live status match
        if (!statusMatchFound) {
            activeSteps.forEach(function (step, i) {
                if (stepDates[step.key]) currentStepIdx = i;
            });
        }

        // Render
        stepsEl.innerHTML = '';
        activeSteps.forEach(function (step, i) {
            var stateClass = 'ard-step--future';
            if (i < currentStepIdx) stateClass = 'ard-step--done';
            if (i === currentStepIdx) stateClass = 'ard-step--current';

            var div = document.createElement('div');
            div.className = 'ard-step ' + stateClass;
            if (step.key === 'revision') div.className += ' ard-step--revision';

            var dateStr = stepDates[step.key] ? formatDate(stepDates[step.key]) : '';

            div.innerHTML =
                '<div class="ard-step-dot"></div>' +
                '<div class="ard-step-label">' + escapeHtml(step.label) + '</div>' +
                (dateStr ? '<div class="ard-step-date">' + dateStr + '</div>' : '');

            stepsEl.appendChild(div);
        });

        container.style.display = '';
    }
})();
