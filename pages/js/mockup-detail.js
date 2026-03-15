/**
 * mockup-detail.js — Mockup Detail Page (Ruth + AE views)
 *
 * Fetches mockup by ID from URL, renders gallery, info, notes, and actions.
 * Dual view: Ruth (default) or AE (?view=ae).
 *
 * Depends on: mockup-detail.css, app-config.js
 */
(function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    var IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'];

    var MOCKUP_SLOTS = [
        { key: 'Box_Mockup_1', label: 'Mockup 1' },
        { key: 'Box_Mockup_2', label: 'Mockup 2' },
        { key: 'Box_Mockup_3', label: 'Mockup 3' },
        { key: 'Box_Reference_File', label: 'Reference File' }
    ];

    // ── State ──────────────────────────────────────────────────────────────
    var currentMockup = null;
    var activeSlotKey = null;
    var selectedBoxFile = null;
    var boxFoldersCache = null;
    var isAeView = false;
    var mockupId = null;

    // ── URL Parsing ────────────────────────────────────────────────────────
    var pathParts = window.location.pathname.split('/');
    mockupId = pathParts[pathParts.length - 1];

    if (!mockupId || !/^\d+$/.test(mockupId)) {
        showError('Invalid Mockup ID', 'Please check the URL and try again.');
        return; // Exit IIFE early
    }

    var urlParams = new URLSearchParams(window.location.search);
    isAeView = urlParams.get('view') === 'ae';

    // Adjust header for AE view
    if (isAeView) {
        var headerTitle = document.getElementById('pmd-header-title');
        var backLink = document.getElementById('pmd-back-link');
        if (headerTitle) headerTitle.textContent = 'Mockup Review';
        if (backLink) {
            backLink.textContent = 'Back to AE Dashboard';
            backLink.href = '/ae-dashboard.html';
        }
    }

    // ── Fetch & Render ─────────────────────────────────────────────────────
    Promise.all([
        fetch(API_BASE + '/api/mockups/' + mockupId).then(function (r) {
            if (!r.ok) throw new Error('Mockup not found');
            return r.json();
        }),
        fetch(API_BASE + '/api/mockup-notes/' + mockupId).then(function (r) {
            if (!r.ok) return { notes: [] };
            return r.json();
        })
    ]).then(function (results) {
        var mockupData = results[0];
        var notesData = results[1];

        if (!mockupData.success || !mockupData.record) {
            showError('Mockup Not Found', 'No mockup found with ID ' + mockupId);
            return;
        }

        currentMockup = mockupData.record;
        render(currentMockup, notesData.notes || []);
    }).catch(function (err) {
        console.error('Failed to load mockup:', err);
        showError('Error Loading Mockup', err.message);
    });

    // ── Main Render ────────────────────────────────────────────────────────
    function render(mockup, notes) {
        document.getElementById('pmd-loading').style.display = 'none';
        document.getElementById('pmd-content').style.display = '';

        // Title
        var designId = mockup.Design_Number || ('Mockup #' + mockup.ID);
        var company = mockup.Company_Name || 'Unknown Company';
        document.getElementById('pmd-design-id').textContent = company + ' — #' + designId;
        document.title = '#' + designId + ' — ' + company + ' | Mockup Detail';

        // Status badge
        var status = mockup.Status || 'Submitted';
        var statusBadge = document.getElementById('pmd-status-badge');
        statusBadge.textContent = status;
        statusBadge.className = 'pmd-status-badge pmd-status-badge--' + status.toLowerCase().replace(/\s+/g, '-');

        // Revision badge
        if (mockup.Revision_Count > 0) {
            var revBadge = document.getElementById('pmd-revision-badge');
            revBadge.textContent = 'Rev ' + mockup.Revision_Count;
            revBadge.style.display = '';
        }

        // Action bars
        renderActionBars(mockup);

        // Gallery
        renderGallery(mockup);

        // Info fields
        renderInfoFields(mockup);

        // Notes
        renderNotes(notes);

        // Wire up interactions
        initGalleryInteractions();
        initNoteForm();
        initLightbox();
        initBoxModal();
    }

    // ── Action Bars ────────────────────────────────────────────────────────
    function renderActionBars(mockup) {
        var statusLower = (mockup.Status || '').toLowerCase().replace(/\s+/g, '');
        var ruthBar = document.getElementById('pmd-ruth-action-bar');
        var aeBar = document.getElementById('pmd-ae-action-bar');

        if (isAeView) {
            // AE view
            ruthBar.style.display = 'none';

            if (statusLower === 'awaitingapproval') {
                aeBar.style.display = '';
                aeBar.innerHTML = '<span class="pmd-action-bar-label">Review this mockup:</span>'
                    + '<button class="pmd-action-btn pmd-action-btn--approve" id="pmd-btn-approve">Approve Mockup</button>'
                    + '<button class="pmd-action-btn pmd-action-btn--revise" id="pmd-btn-revise">Request Changes</button>';

                document.getElementById('pmd-btn-approve').addEventListener('click', function () {
                    handleStatusUpdate('Approved', null, this);
                });
                document.getElementById('pmd-btn-revise').addEventListener('click', function () {
                    openReviseModal();
                });
            } else {
                aeBar.style.display = 'none';
            }
        } else {
            // Ruth's view
            aeBar.style.display = 'none';

            if (statusLower === 'submitted') {
                ruthBar.style.display = '';
                ruthBar.innerHTML = '<span class="pmd-action-bar-label">Ready to start?</span>'
                    + '<button class="pmd-action-btn pmd-action-btn--start" id="pmd-btn-start">Start Working</button>';
                document.getElementById('pmd-btn-start').addEventListener('click', function () {
                    handleStatusUpdate('In Progress', null, this);
                });
            } else if (statusLower === 'inprogress' || statusLower === 'revisionrequested') {
                ruthBar.style.display = '';
                ruthBar.innerHTML = '<span class="pmd-action-bar-label">Ready for review?</span>'
                    + '<button class="pmd-action-btn pmd-action-btn--send" id="pmd-btn-send">Send for Approval</button>';
                document.getElementById('pmd-btn-send').addEventListener('click', function () {
                    handleStatusUpdate('Awaiting Approval', null, this);
                });
            } else {
                ruthBar.style.display = 'none';
            }
        }
    }

    // ── Status Update ──────────────────────────────────────────────────────
    function handleStatusUpdate(newStatus, notes, btnEl) {
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.textContent = 'Updating...';
        }

        var body = {
            status: newStatus,
            author: isAeView ? (currentMockup.Submitted_By || 'ae@nwcustomapparel.com') : 'ruth@nwcustomapparel.com',
            authorName: isAeView ? getAeDisplayName(currentMockup.Submitted_By) : 'Ruth'
        };

        if (notes) {
            body.notes = notes;
        }

        fetch(API_BASE + '/api/mockups/' + mockupId + '/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Status update failed');
            return resp.json();
        }).then(function () {
            showToast('Status updated to "' + newStatus + '"', 'success');
            // Reload the page to reflect changes
            setTimeout(function () { location.reload(); }, 800);
        }).catch(function (err) {
            console.error('Status update error:', err);
            showToast('Failed to update status: ' + err.message, 'error');
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.textContent = 'Retry';
            }
        });
    }

    // ── Gallery Rendering ──────────────────────────────────────────────────
    function renderGallery(mockup) {
        var grid = document.getElementById('pmd-gallery-grid');
        if (!grid) return;
        grid.innerHTML = '';

        MOCKUP_SLOTS.forEach(function (slot) {
            var url = mockup[slot.key];
            var isEmpty = !url || !url.trim();
            var slotEl = document.createElement('div');
            slotEl.className = 'pmd-gallery-slot';
            slotEl.dataset.fieldKey = slot.key;

            if (isEmpty) {
                // Show empty slot
                if (!isAeView) {
                    slotEl.innerHTML = '<div class="pmd-slot-empty">'
                        + '<span class="pmd-slot-empty-icon">+</span>'
                        + '<span>' + escapeHtml(slot.label) + '</span>'
                        + '</div>';
                    slotEl.addEventListener('click', function (e) {
                        e.stopPropagation();
                        showSlotPopover(slotEl, slot.key);
                    });
                } else {
                    slotEl.innerHTML = '<div class="pmd-slot-empty">'
                        + '<span class="pmd-slot-empty-icon">&#128247;</span>'
                        + '<span>No ' + escapeHtml(slot.label) + '</span>'
                        + '</div>';
                    slotEl.style.cursor = 'default';
                }
            } else {
                // Show filled slot
                var ext = getFileExtension(url);
                var isImage = IMAGE_EXTENSIONS.indexOf(ext) !== -1;

                if (isImage) {
                    slotEl.innerHTML = '<div class="pmd-slot-filled">'
                        + '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(slot.label) + '" loading="lazy"'
                        + ' onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
                        + '<div class="pmd-file-placeholder" style="display:none;">'
                        + '<span class="pmd-file-ext-badge">' + ext.toUpperCase() + '</span></div>'
                        + '<div class="pmd-slot-label">' + escapeHtml(slot.label) + '</div>'
                        + (!isAeView ? '<button type="button" class="pmd-slot-remove" data-field-key="' + slot.key + '">&times;</button>' : '')
                        + '</div>';
                    slotEl.addEventListener('click', function (e) {
                        if (e.target.closest('.pmd-slot-remove')) return;
                        openLightbox(url, slot.label);
                    });
                } else {
                    slotEl.innerHTML = '<div class="pmd-slot-filled">'
                        + '<div class="pmd-file-placeholder">'
                        + '<span class="pmd-file-ext-badge">' + ext.toUpperCase() + '</span>'
                        + '<span style="font-size:12px;color:#666;">' + escapeHtml(slot.label) + '</span>'
                        + '</div>'
                        + '<div class="pmd-slot-label">' + escapeHtml(slot.label) + '</div>'
                        + (!isAeView ? '<button type="button" class="pmd-slot-remove" data-field-key="' + slot.key + '">&times;</button>' : '')
                        + '</div>';
                    slotEl.addEventListener('click', function (e) {
                        if (e.target.closest('.pmd-slot-remove')) return;
                        window.open(url, '_blank');
                    });
                }
            }

            grid.appendChild(slotEl);
        });

        // Wire remove buttons
        grid.querySelectorAll('.pmd-slot-remove').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var fieldKey = btn.dataset.fieldKey;
                if (!confirm('Remove this file?')) return;
                removeSlotFile(fieldKey);
            });
        });
    }

    // ── Remove Slot File ───────────────────────────────────────────────────
    function removeSlotFile(fieldKey) {
        var updateBody = {};
        updateBody[fieldKey] = '';

        fetch(API_BASE + '/api/mockups/' + mockupId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateBody)
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Failed to remove file');
            currentMockup[fieldKey] = '';
            renderGallery(currentMockup);
            showToast('File removed', 'info');
        }).catch(function (err) {
            showToast('Failed to remove: ' + err.message, 'error');
        });
    }

    // ── Gallery Interactions (Upload Popover) ──────────────────────────────
    function initGalleryInteractions() {
        var popUpload = document.getElementById('pmd-pop-upload');
        var popBox = document.getElementById('pmd-pop-box');
        var fileInput = document.getElementById('pmd-slot-file-input');

        popUpload.addEventListener('click', function () {
            hideSlotPopover();
            if (fileInput) fileInput.click();
        });

        fileInput.addEventListener('change', function () {
            if (fileInput.files.length > 0 && activeSlotKey) {
                uploadFileToSlot(fileInput.files[0], activeSlotKey);
                fileInput.value = '';
            }
        });

        popBox.addEventListener('click', function () {
            hideSlotPopover();
            openBoxPickerModal(activeSlotKey);
        });

        // Close popover on outside click
        document.addEventListener('click', function (e) {
            var popover = document.getElementById('pmd-slot-popover');
            if (popover.style.display !== 'none' && !e.target.closest('.pmd-slot-popover') && !e.target.closest('.pmd-gallery-slot')) {
                hideSlotPopover();
            }
        });
    }

    function showSlotPopover(slotEl, fieldKey) {
        activeSlotKey = fieldKey;
        var popover = document.getElementById('pmd-slot-popover');
        var rect = slotEl.getBoundingClientRect();
        var scrollY = window.scrollY;
        popover.style.top = (rect.bottom + scrollY + 4) + 'px';
        popover.style.left = rect.left + 'px';
        popover.style.display = '';
    }

    function hideSlotPopover() {
        document.getElementById('pmd-slot-popover').style.display = 'none';
    }

    // ── Upload File to Slot ────────────────────────────────────────────────
    function uploadFileToSlot(file, fieldKey) {
        if (file.size > 20 * 1024 * 1024) {
            showToast('File too large (max 20MB)', 'error');
            return;
        }

        var slotEl = document.querySelector('[data-field-key="' + fieldKey + '"]');
        if (slotEl) {
            var spinner = document.createElement('div');
            spinner.className = 'pmd-slot-upload-spinner';
            slotEl.appendChild(spinner);
            slotEl.classList.add('pmd-slot-uploading');
        }

        var formData = new FormData();
        formData.append('file', file);
        formData.append('slot', fieldKey);
        formData.append('companyName', currentMockup.Company_Name || '');

        fetch(API_BASE + '/api/mockups/' + mockupId + '/upload-file', {
            method: 'POST',
            body: formData
        }).then(function (resp) {
            if (!resp.ok) return resp.json().then(function (d) { throw new Error(d.error || 'Upload failed'); });
            return resp.json();
        }).then(function (result) {
            currentMockup[fieldKey] = result.url || result.sharedLink || '';
            renderGallery(currentMockup);
            showToast('File uploaded successfully', 'success');
        }).catch(function (err) {
            showToast('Upload failed: ' + err.message, 'error');
            if (slotEl) {
                slotEl.classList.remove('pmd-slot-uploading');
                var sp = slotEl.querySelector('.pmd-slot-upload-spinner');
                if (sp) sp.remove();
            }
        });
    }

    // ── Box Picker Modal ───────────────────────────────────────────────────
    function initBoxModal() {
        document.getElementById('pmd-box-modal-close').addEventListener('click', closeBoxModal);
        document.getElementById('pmd-box-overlay').addEventListener('click', closeBoxModal);
        document.getElementById('pmd-box-cancel').addEventListener('click', closeBoxModal);

        document.getElementById('pmd-box-confirm').addEventListener('click', function () {
            if (!selectedBoxFile || !activeSlotKey) return;
            confirmBoxSelection();
        });
    }

    function openBoxPickerModal(fieldKey) {
        activeSlotKey = fieldKey;
        selectedBoxFile = null;
        document.getElementById('pmd-box-confirm').disabled = true;
        document.getElementById('pmd-box-overlay').style.display = '';
        document.getElementById('pmd-box-modal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        loadBoxFolders();
    }

    function closeBoxModal() {
        document.getElementById('pmd-box-overlay').style.display = 'none';
        document.getElementById('pmd-box-modal').style.display = 'none';
        document.body.style.overflow = '';
        selectedBoxFile = null;
    }

    function loadBoxFolders() {
        var loadingEl = document.getElementById('pmd-box-loading');
        var fileList = document.getElementById('pmd-box-file-list');
        var breadcrumb = document.getElementById('pmd-box-breadcrumb');

        breadcrumb.innerHTML = '<span class="pmd-box-breadcrumb-link" id="pmd-box-root">Mockup Folders</span>';
        document.getElementById('pmd-box-root').addEventListener('click', function () {
            loadBoxFolders();
        });

        if (boxFoldersCache) {
            renderFolderList(boxFoldersCache);
            return;
        }

        loadingEl.style.display = 'flex';
        fileList.innerHTML = '';

        fetch(API_BASE + '/api/box/mockup-folders?limit=500')
            .then(function (resp) {
                if (!resp.ok) throw new Error('Box API ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                boxFoldersCache = data.folders || [];
                loadingEl.style.display = 'none';
                renderFolderList(boxFoldersCache);
            })
            .catch(function (err) {
                loadingEl.style.display = 'none';
                fileList.innerHTML = '<p style="color:#dc2626;padding:20px;">Failed to load folders: ' + escapeHtml(err.message) + '</p>';
            });
    }

    function renderFolderList(folders) {
        var fileList = document.getElementById('pmd-box-file-list');
        fileList.innerHTML = '';

        if (folders.length === 0) {
            fileList.innerHTML = '<p style="color:#999;padding:20px;text-align:center;">No folders found</p>';
            return;
        }

        folders.forEach(function (folder) {
            var item = document.createElement('div');
            item.className = 'pmd-box-folder-item';
            item.innerHTML = '<div class="pmd-box-file-icon" style="background:#f3f0ff;color:#6B46C1;">&#128193;</div>'
                + '<span>' + escapeHtml(folder.name) + '</span>';
            item.addEventListener('click', function () {
                loadBoxFiles(folder.id, folder.name);
            });
            fileList.appendChild(item);
        });
    }

    function loadBoxFiles(folderId, folderName) {
        var loadingEl = document.getElementById('pmd-box-loading');
        var fileList = document.getElementById('pmd-box-file-list');
        var breadcrumb = document.getElementById('pmd-box-breadcrumb');

        breadcrumb.innerHTML = '<span class="pmd-box-breadcrumb-link" id="pmd-box-root2">Folders</span>'
            + ' <span style="color:#999;">/</span> '
            + '<span>' + escapeHtml(folderName) + '</span>';
        document.getElementById('pmd-box-root2').addEventListener('click', function () {
            loadBoxFolders();
        });

        loadingEl.style.display = 'flex';
        fileList.innerHTML = '';
        selectedBoxFile = null;
        document.getElementById('pmd-box-confirm').disabled = true;

        fetch(API_BASE + '/api/box/folder-files?folderId=' + folderId)
            .then(function (resp) {
                if (!resp.ok) throw new Error('Failed to load files');
                return resp.json();
            })
            .then(function (data) {
                loadingEl.style.display = 'none';
                var files = data.files || [];

                if (files.length === 0) {
                    fileList.innerHTML = '<p style="color:#999;padding:20px;text-align:center;">No files in this folder</p>';
                    return;
                }

                files.forEach(function (file) {
                    var ext = getFileExtension(file.name);
                    var isImage = IMAGE_EXTENSIONS.indexOf(ext) !== -1;
                    var iconBg = isImage ? '#dbeafe' : '#f0f0f0';
                    var iconColor = isImage ? '#2563eb' : '#666';

                    var item = document.createElement('div');
                    item.className = 'pmd-box-file-item';
                    item.innerHTML = '<div class="pmd-box-file-icon" style="background:' + iconBg + ';color:' + iconColor + ';">'
                        + ext.toUpperCase().substring(0, 3)
                        + '</div>'
                        + '<span>' + escapeHtml(file.name) + '</span>';

                    item.addEventListener('click', function () {
                        fileList.querySelectorAll('.pmd-box-file-item').forEach(function (el) {
                            el.classList.remove('selected');
                        });
                        item.classList.add('selected');
                        selectedBoxFile = { id: file.id, name: file.name };
                        document.getElementById('pmd-box-confirm').disabled = false;
                    });

                    fileList.appendChild(item);
                });
            })
            .catch(function (err) {
                loadingEl.style.display = 'none';
                fileList.innerHTML = '<p style="color:#dc2626;padding:20px;">Error: ' + escapeHtml(err.message) + '</p>';
            });
    }

    function confirmBoxSelection() {
        var confirmBtn = document.getElementById('pmd-box-confirm');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Creating link...';

        // Create shared link for the selected Box file
        fetch(API_BASE + '/api/box/shared-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: selectedBoxFile.id })
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Failed to create shared link');
            return resp.json();
        }).then(function (linkData) {
            var fileUrl = linkData.downloadUrl || linkData.sharedLink;

            // Save the URL to the Caspio field
            var saveBody = {};
            saveBody[activeSlotKey] = fileUrl;

            return fetch(API_BASE + '/api/mockups/' + mockupId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saveBody)
            }).then(function (resp) {
                if (!resp.ok) throw new Error('Failed to save URL');
                currentMockup[activeSlotKey] = fileUrl;
                closeBoxModal();
                renderGallery(currentMockup);
                showToast('File linked from Box', 'success');

                // Add note (fire-and-forget)
                fetch(API_BASE + '/api/mockup-notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        Mockup_ID: parseInt(mockupId),
                        Author: 'ruth@nwcustomapparel.com',
                        Author_Name: 'Ruth',
                        Note_Text: 'Added file from Box: ' + selectedBoxFile.name,
                        Note_Type: 'artist_note'
                    })
                }).catch(function () {});

                refreshNotes();
            });
        }).catch(function (err) {
            showToast('Error: ' + err.message, 'error');
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Select File';
        });
    }

    // ── Info Fields ────────────────────────────────────────────────────────
    function renderInfoFields(mockup) {
        var container = document.getElementById('pmd-info-fields');
        if (!container) return;

        var fields = [
            { label: 'Design #', value: mockup.Design_Number },
            { label: 'Design Name', value: mockup.Design_Name },
            { label: 'Company', value: mockup.Company_Name },
            { label: 'Mockup Type', value: mockup.Mockup_Type },
            { label: 'Garment', value: mockup.Garment_Info },
            { label: 'Placement', value: mockup.Print_Location },
            { label: 'Size Specs', value: mockup.Size_Specs },
            { label: 'Submitted By', value: getAeDisplayName(mockup.Submitted_By) },
            { label: 'Submitted', value: formatDate(mockup.Submitted_Date) },
            { label: 'Due Date', value: formatDate(mockup.Due_Date) },
            { label: 'Work Order', value: mockup.Work_Order_Number },
            { label: 'Completed', value: formatDate(mockup.Completion_Date) }
        ];

        container.innerHTML = fields
            .filter(function (f) { return f.value; })
            .map(function (f) {
                return '<div class="pmd-field-row">'
                    + '<span class="pmd-field-label">' + escapeHtml(f.label) + '</span>'
                    + '<span class="pmd-field-value">' + escapeHtml(f.value) + '</span>'
                    + '</div>';
            }).join('');

        // Show AE Notes if present
        if (mockup.AE_Notes) {
            container.innerHTML += '<div class="pmd-field-row" style="flex-direction:column;gap:4px;">'
                + '<span class="pmd-field-label">AE Instructions</span>'
                + '<span class="pmd-field-value" style="white-space:pre-wrap;">' + escapeHtml(mockup.AE_Notes) + '</span>'
                + '</div>';
        }
    }

    // ── Notes ──────────────────────────────────────────────────────────────
    function renderNotes(notes) {
        var container = document.getElementById('pmd-notes-list');
        if (!container) return;
        container.innerHTML = '';

        if (!notes || notes.length === 0) {
            container.innerHTML = '<p class="pmd-empty-notes">No notes yet.</p>';
            return;
        }

        notes.forEach(function (note) {
            var noteType = note.Note_Type || 'artist_note';
            var typeLabel = noteType.replace(/_/g, ' ');

            var div = document.createElement('div');
            div.className = 'pmd-note pmd-note--' + noteType;
            div.innerHTML = '<div class="pmd-note-header">'
                + '<span class="pmd-note-type pmd-note-type--' + noteType + '">' + escapeHtml(typeLabel) + '</span>'
                + '<span class="pmd-note-meta">' + escapeHtml(note.Author_Name || '') + ' &bull; ' + formatDate(note.Created_Date) + '</span>'
                + '</div>'
                + '<div class="pmd-note-text">' + escapeHtml(note.Note_Text || '') + '</div>';

            container.appendChild(div);
        });
    }

    function refreshNotes() {
        fetch(API_BASE + '/api/mockup-notes/' + mockupId)
            .then(function (r) { return r.ok ? r.json() : { notes: [] }; })
            .then(function (data) { renderNotes(data.notes || []); })
            .catch(function (err) { console.error('Notes refresh failed:', err); });
    }

    function initNoteForm() {
        var btn = document.getElementById('pmd-add-note-btn');
        var input = document.getElementById('pmd-note-input');
        if (!btn || !input) return;

        btn.addEventListener('click', function () {
            var text = input.value.trim();
            if (!text) return;

            btn.disabled = true;
            btn.textContent = 'Saving...';

            var noteType = isAeView ? 'ae_instruction' : 'artist_note';
            var author = isAeView ? (currentMockup.Submitted_By || 'ae@nwcustomapparel.com') : 'ruth@nwcustomapparel.com';
            var authorName = isAeView ? getAeDisplayName(currentMockup.Submitted_By) : 'Ruth';

            fetch(API_BASE + '/api/mockup-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    Mockup_ID: parseInt(mockupId),
                    Author: author,
                    Author_Name: authorName,
                    Note_Text: text,
                    Note_Type: noteType
                })
            }).then(function (resp) {
                if (!resp.ok) throw new Error('Failed to save note');
                input.value = '';
                refreshNotes();
                showToast('Note added', 'success');
            }).catch(function (err) {
                showToast('Failed to save note: ' + err.message, 'error');
            }).finally(function () {
                btn.disabled = false;
                btn.textContent = 'Add Note';
            });
        });
    }

    // ── Request Changes Modal (AE) ─────────────────────────────────────────
    function openReviseModal() {
        document.getElementById('pmd-revise-overlay').classList.add('show');
        document.getElementById('pmd-revise-notes').value = '';
        document.getElementById('pmd-revise-notes').focus();

        document.getElementById('pmd-revise-cancel').addEventListener('click', closeReviseModal);
        document.getElementById('pmd-revise-submit').addEventListener('click', function () {
            var notes = document.getElementById('pmd-revise-notes').value.trim();
            if (!notes) {
                showToast('Please describe the changes needed', 'error');
                return;
            }
            closeReviseModal();
            handleStatusUpdate('Revision Requested', notes, this);
        });
    }

    function closeReviseModal() {
        document.getElementById('pmd-revise-overlay').classList.remove('show');
    }

    // ── Lightbox ───────────────────────────────────────────────────────────
    function initLightbox() {
        var lightbox = document.getElementById('pmd-lightbox');
        var closeBtn = document.getElementById('pmd-lightbox-close');

        closeBtn.addEventListener('click', closeLightbox);
        lightbox.addEventListener('click', function (e) {
            if (e.target === lightbox) closeLightbox();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeLightbox();
        });
    }

    function openLightbox(url, label) {
        var lightbox = document.getElementById('pmd-lightbox');
        document.getElementById('pmd-lightbox-img').src = url;
        document.getElementById('pmd-lightbox-label').textContent = label || '';
        lightbox.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        var lightbox = document.getElementById('pmd-lightbox');
        lightbox.classList.remove('show');
        document.getElementById('pmd-lightbox-img').src = '';
        document.body.style.overflow = '';
    }

    // ── Helpers ─────────────────────────────────────────────────────────────
    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function getFileExtension(url) {
        if (!url) return '';
        var cleanUrl = url.split('?')[0].split('#')[0];
        var parts = cleanUrl.split('.');
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    }

    function getAeDisplayName(email) {
        if (!email) return 'Unknown';
        var atIdx = email.indexOf('@');
        var name = atIdx > 0 ? email.substring(0, atIdx) : email;
        return name.charAt(0).toUpperCase() + name.slice(1);
    }

    // ── Loading / Error States ──────────────────────────────────────────────
    function showError(title, message) {
        document.getElementById('pmd-loading').style.display = 'none';
        var errorEl = document.getElementById('pmd-error');
        errorEl.style.display = '';
        document.getElementById('pmd-error-title').textContent = title || 'Error';
        document.getElementById('pmd-error-msg').textContent = message || '';
    }

    // ── Toast ───────────────────────────────────────────────────────────────
    function showToast(message, type) {
        type = type || 'info';
        document.querySelectorAll('.pmd-toast').forEach(function (t) { t.remove(); });

        var toast = document.createElement('div');
        toast.className = 'pmd-toast pmd-toast--' + type;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(function () {
            toast.classList.add('show');
        });

        setTimeout(function () {
            toast.classList.remove('show');
            setTimeout(function () { toast.remove(); }, 300);
        }, 3000);
    }

})();
