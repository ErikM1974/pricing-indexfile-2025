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

    // ── EmailJS Config ──────────────────────────────────────────────────
    var EMAILJS_SERVICE_ID = 'service_1c4k67j';
    var EMAILJS_PUBLIC_KEY = '4qSbDO-SQs19TbP80';
    var HEROKU_ORIGIN = 'https://sanmar-inventory-app-4cd7b252508d.herokuapp.com';
    var RUTH_EMAIL = 'ruth@nwcustomapparel.com';

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
    var isCustomerView = urlParams.get('view') === 'customer';

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

    // Adjust header for customer view
    if (isCustomerView) {
        var headerTitle = document.getElementById('pmd-header-title');
        var backLink = document.getElementById('pmd-back-link');
        if (headerTitle) headerTitle.textContent = 'Mockup Approval';
        if (backLink) backLink.style.display = 'none';
        document.body.classList.add('pmd-customer-view');
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

        // Notes (hide for customer view)
        if (isCustomerView) {
            var notesList = document.getElementById('pmd-notes-list');
            if (notesList) notesList.closest('.pmd-card').style.display = 'none';
        } else {
            renderNotes(notes);
        }

        // Wire up interactions
        if (!isCustomerView) {
            initGalleryInteractions();
            initNoteForm();
        }
        initLightbox();
        if (!isCustomerView) initBoxModal();
    }

    // ── Action Bars ────────────────────────────────────────────────────────
    function renderActionBars(mockup) {
        var statusLower = (mockup.Status || '').toLowerCase().replace(/\s+/g, '');
        var ruthBar = document.getElementById('pmd-ruth-action-bar');
        var aeBar = document.getElementById('pmd-ae-action-bar');

        if (isCustomerView) {
            // Customer view
            ruthBar.style.display = 'none';
            aeBar.style.display = '';

            if (statusLower === 'awaitingapproval') {
                aeBar.innerHTML = '<div class="pmd-customer-action-panel">'
                    + '<p class="pmd-customer-prompt">Please review the mockup(s) below and select the one you approve, or request changes.</p>'
                    + '<div class="pmd-customer-btns">'
                    + '<button class="pmd-action-btn pmd-action-btn--approve pmd-action-btn--lg" id="pmd-btn-customer-approve" disabled>Approve Selected Mockup</button>'
                    + '<button class="pmd-action-btn pmd-action-btn--revise pmd-action-btn--lg" id="pmd-btn-customer-revise">Request Changes</button>'
                    + '</div>'
                    + '</div>';

                document.getElementById('pmd-btn-customer-approve').addEventListener('click', function () {
                    handleCustomerApproval(this);
                });
                document.getElementById('pmd-btn-customer-revise').addEventListener('click', function () {
                    openReviseModal();
                });
            } else if (statusLower === 'approved') {
                aeBar.innerHTML = '<div class="pmd-customer-thankyou">'
                    + '<div class="pmd-customer-thankyou-icon">&#9989;</div>'
                    + '<h3>Thank You!</h3>'
                    + '<p>This mockup has been approved. We will proceed with production.</p>'
                    + '</div>';
            } else {
                aeBar.innerHTML = '<div class="pmd-customer-status-msg">'
                    + '<p>This mockup is not ready for review yet. Please check back later.</p>'
                    + '</div>';
            }
        } else if (isAeView) {
            // AE view
            ruthBar.style.display = 'none';

            if (statusLower === 'awaitingapproval') {
                aeBar.style.display = '';
                aeBar.innerHTML = '<span class="pmd-action-bar-label">Select a mockup to approve:</span>'
                    + '<button class="pmd-action-btn pmd-action-btn--approve" id="pmd-btn-approve" disabled>Approve Mockup</button>'
                    + '<button class="pmd-action-btn pmd-action-btn--revise" id="pmd-btn-revise">Request Changes</button>'
                    + '<button class="pmd-action-btn pmd-action-btn--copy" id="pmd-btn-copy-link" title="Copy customer approval link">Copy Customer Link</button>';

                document.getElementById('pmd-btn-approve').addEventListener('click', function () {
                    if (!selectedMockupSlot) {
                        showToast('Please click a mockup image to select it first', 'error');
                        return;
                    }
                    var slotLabel = MOCKUP_SLOTS.filter(function (s) { return s.key === selectedMockupSlot; })[0];
                    var approvalNote = 'AE approved ' + (slotLabel ? slotLabel.label : selectedMockupSlot);
                    handleStatusUpdate('Approved', approvalNote, this);
                });
                document.getElementById('pmd-btn-revise').addEventListener('click', function () {
                    openReviseModal();
                });
                document.getElementById('pmd-btn-copy-link').addEventListener('click', function () {
                    var customerUrl = window.location.origin + '/mockup/' + mockupId + '?view=customer';
                    navigator.clipboard.writeText(customerUrl).then(function () {
                        showToast('Customer link copied to clipboard!', 'success');
                    }).catch(function () {
                        prompt('Copy this link:', customerUrl);
                    });
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

    // ── Customer Approval ───────────────────────────────────────────────
    var selectedMockupSlot = null;

    function handleCustomerApproval(btnEl) {
        if (!selectedMockupSlot) {
            showToast('Please click on a mockup to select it first', 'error');
            return;
        }
        if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Submitting...'; }

        var slotLabel = MOCKUP_SLOTS.filter(function (s) { return s.key === selectedMockupSlot; })[0];
        var approvalNote = 'Customer approved ' + (slotLabel ? slotLabel.label : selectedMockupSlot);

        var body = {
            status: 'Approved',
            author: 'Customer',
            authorName: 'Customer',
            notes: approvalNote
        };

        fetch(API_BASE + '/api/mockups/' + mockupId + '/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Approval failed');
            return resp.json();
        }).then(function () {
            showCustomerConfirmation('approved');
        }).catch(function (err) {
            showToast('Error: ' + err.message, 'error');
            if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Approve Selected Mockup'; }
        });
    }

    function showCustomerConfirmation(type) {
        var content = document.getElementById('pmd-content');
        if (type === 'approved') {
            content.innerHTML = '<div class="pmd-customer-confirmation">'
                + '<div class="pmd-customer-confirmation-icon">&#9989;</div>'
                + '<h2>Thank You!</h2>'
                + '<p>Your mockup approval has been recorded. We will proceed with production.</p>'
                + '<p class="pmd-customer-company">' + escapeHtml(currentMockup.Company_Name || '') + '</p>'
                + '</div>';
        } else {
            content.innerHTML = '<div class="pmd-customer-confirmation">'
                + '<div class="pmd-customer-confirmation-icon">&#128221;</div>'
                + '<h2>Feedback Submitted</h2>'
                + '<p>Your revision request has been submitted. Our team will make the changes and send an updated mockup.</p>'
                + '<p class="pmd-customer-company">' + escapeHtml(currentMockup.Company_Name || '') + '</p>'
                + '</div>';
        }
    }

    // ── Status Update ──────────────────────────────────────────────────────
    function handleStatusUpdate(newStatus, notes, btnEl) {
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.textContent = 'Updating...';
        }

        var author, authorName;
        if (isCustomerView) {
            author = 'Customer';
            authorName = 'Customer';
        } else if (isAeView) {
            author = currentMockup.Submitted_By || 'ae@nwcustomapparel.com';
            authorName = getAeDisplayName(currentMockup.Submitted_By);
        } else {
            author = 'ruth@nwcustomapparel.com';
            authorName = 'Ruth';
        }

        var body = { status: newStatus, author: author, authorName: authorName };
        if (notes) body.notes = notes;

        fetch(API_BASE + '/api/mockups/' + mockupId + '/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Status update failed');
            return resp.json();
        }).then(function () {
            // Fire-and-forget email notifications
            sendStatusNotifications(newStatus);

            if (isCustomerView) {
                showCustomerConfirmation(newStatus === 'Approved' ? 'approved' : 'revision');
                return;
            }
            showToast('Status updated to "' + newStatus + '"', 'success');
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

        var statusLower = (mockup.Status || '').toLowerCase().replace(/\s+/g, '');
        var isRefFile = false;
        var aeCanSelect = isAeView && statusLower === 'awaitingapproval';

        // Customer view: only show filled mockup slots (not reference file)
        var slotsToRender = isCustomerView
            ? MOCKUP_SLOTS.filter(function (s) { return s.key !== 'Box_Reference_File' && mockup[s.key]; })
            : MOCKUP_SLOTS;

        slotsToRender.forEach(function (slot) {
            var url = mockup[slot.key];
            var isEmpty = !url || !url.trim();
            isRefFile = slot.key === 'Box_Reference_File';
            var slotEl = document.createElement('div');
            slotEl.className = 'pmd-gallery-slot';
            slotEl.dataset.fieldKey = slot.key;

            // Reference File gets distinct styling
            if (isRefFile) {
                slotEl.classList.add('pmd-gallery-slot--reference');
            }

            // Revision emphasis on filled mockup slots (not reference)
            if (statusLower === 'revisionrequested' && !isEmpty && !isRefFile) {
                slotEl.classList.add('pmd-gallery-slot--needs-revision');
            }

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
                    var showRemove = !isAeView && !isCustomerView;
                    var showSelectBadge = isCustomerView || (aeCanSelect && !isRefFile);
                    slotEl.innerHTML = '<div class="pmd-slot-filled">'
                        + '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(slot.label) + '" loading="lazy"'
                        + ' onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
                        + '<div class="pmd-file-placeholder" style="display:none;">'
                        + '<span class="pmd-file-ext-badge">' + ext.toUpperCase() + '</span></div>'
                        + '<div class="pmd-slot-label">' + escapeHtml(slot.label) + '</div>'
                        + (showRemove ? '<button type="button" class="pmd-slot-remove" data-field-key="' + slot.key + '">&times;</button>' : '')
                        + (showSelectBadge ? '<div class="pmd-slot-select-badge">Click to select</div>' : '')
                        + '</div>';

                    // Revision badge on filled mockup slots
                    if (statusLower === 'revisionrequested' && !isRefFile) {
                        var revBadge = document.createElement('div');
                        revBadge.className = 'pmd-slot-revision-badge';
                        revBadge.textContent = 'Needs Update';
                        slotEl.appendChild(revBadge);
                    }

                    if (isCustomerView) {
                        // Customer view: click to select for approval
                        (function (slotKey, el) {
                            el.addEventListener('click', function () {
                                grid.querySelectorAll('.pmd-gallery-slot').forEach(function (s) { s.classList.remove('pmd-slot-selected'); });
                                el.classList.add('pmd-slot-selected');
                                selectedMockupSlot = slotKey;
                                var approveBtn = document.getElementById('pmd-btn-customer-approve');
                                if (approveBtn) approveBtn.disabled = false;
                            });
                        })(slot.key, slotEl);
                    } else if (aeCanSelect && !isRefFile) {
                        // AE view: click to select which mockup to approve
                        (function (slotKey, el) {
                            el.addEventListener('click', function (e) {
                                if (e.target.closest('.pmd-slot-remove')) return;
                                grid.querySelectorAll('.pmd-gallery-slot').forEach(function (s) { s.classList.remove('pmd-slot-selected'); });
                                el.classList.add('pmd-slot-selected');
                                selectedMockupSlot = slotKey;
                                var approveBtn = document.getElementById('pmd-btn-approve');
                                if (approveBtn) approveBtn.disabled = false;
                            });
                        })(slot.key, slotEl);
                    } else {
                        slotEl.addEventListener('click', function (e) {
                            if (e.target.closest('.pmd-slot-remove')) return;
                            openLightbox(url, slot.label);
                        });
                    }
                } else {
                    var showRemoveNonImg = !isAeView && !isCustomerView;
                    slotEl.innerHTML = '<div class="pmd-slot-filled">'
                        + '<div class="pmd-file-placeholder">'
                        + '<span class="pmd-file-ext-badge">' + ext.toUpperCase() + '</span>'
                        + '<span style="font-size:12px;color:#666;">' + escapeHtml(slot.label) + '</span>'
                        + '</div>'
                        + '<div class="pmd-slot-label">' + escapeHtml(slot.label) + '</div>'
                        + (showRemoveNonImg ? '<button type="button" class="pmd-slot-remove" data-field-key="' + slot.key + '">&times;</button>' : '')
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
        popover.style.display = 'block';
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
            sendUploadNotification(fieldKey, file.name);
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
                sendUploadNotification(activeSlotKey, selectedBoxFile.name);

                // Add note then refresh to show it
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
                }).then(function () {
                    refreshNotes();
                }).catch(function () {
                    refreshNotes();
                });
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

        var fields;
        if (isCustomerView) {
            // Customer sees only basic info
            fields = [
                { label: 'Design #', value: mockup.Design_Number },
                { label: 'Design Name', value: mockup.Design_Name },
                { label: 'Company', value: mockup.Company_Name },
                { label: 'Application', value: mockup.Mockup_Type },
                { label: 'Placement', value: mockup.Print_Location },
                { label: 'Size Specs', value: mockup.Size_Specs }
            ];
        } else {
            fields = [
                { label: 'Design #', value: mockup.Design_Number },
                { label: 'Design Name', value: mockup.Design_Name },
                { label: 'Company', value: mockup.Company_Name },
                { label: 'Application', value: mockup.Mockup_Type },
                { label: 'Garment', value: mockup.Garment_Info },
                { label: 'Placement', value: mockup.Print_Location },
                { label: 'Size Specs', value: mockup.Size_Specs },
                { label: 'Submitted By', value: getAeDisplayName(mockup.Submitted_By) },
                { label: 'Submitted', value: formatDate(mockup.Submitted_Date) },
                { label: 'Due Date', value: formatDate(mockup.Due_Date) },
                { label: 'Work Order', value: mockup.Work_Order_Number },
                { label: 'Completed', value: formatDate(mockup.Completion_Date) }
            ];
        }

        container.innerHTML = fields
            .filter(function (f) { return f.value; })
            .map(function (f) {
                // Render Mockup Type as badge pills
                if (f.label === 'Application' && f.value) {
                    var badges = f.value.split(', ').map(function (t) {
                        return '<span class="pmd-type-badge">' + escapeHtml(t.trim()) + '</span>';
                    }).join(' ');
                    return '<div class="pmd-field-row">'
                        + '<span class="pmd-field-label">' + escapeHtml(f.label) + '</span>'
                        + '<span class="pmd-field-value">' + badges + '</span>'
                        + '</div>';
                }
                return '<div class="pmd-field-row">'
                    + '<span class="pmd-field-label">' + escapeHtml(f.label) + '</span>'
                    + '<span class="pmd-field-value">' + escapeHtml(f.value) + '</span>'
                    + '</div>';
            }).join('');

        // Show AE Notes if present (not for customer view)
        if (mockup.AE_Notes && !isCustomerView) {
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
        var img = document.getElementById('pmd-lightbox-img');
        var labelEl = document.getElementById('pmd-lightbox-label');

        img.style.display = '';
        labelEl.textContent = label || '';

        img.onerror = function () {
            img.style.display = 'none';
            labelEl.textContent = 'Image could not be loaded \u2014 link may have expired';
        };

        img.src = url;
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

    // ── EmailJS Notifications ─────────────────────────────────────────────
    function sendMockupNotification(params) {
        if (typeof emailjs === 'undefined') return;
        try {
            emailjs.init(EMAILJS_PUBLIC_KEY);
            emailjs.send(EMAILJS_SERVICE_ID, 'template_art_note_added', {
                to_email: params.to_email,
                to_name: params.to_name,
                design_id: currentMockup.Design_Number || currentMockup.ID,
                company_name: currentMockup.Company_Name || 'Unknown',
                note_text: params.note_text,
                note_type: params.note_type,
                detail_link: params.detail_link,
                from_name: params.from_name || 'Mockup System'
            }).catch(function () { /* fire-and-forget */ });
        } catch (e) { /* silent */ }
    }

    function sendApprovalNotification(aeEmail, message) {
        if (typeof emailjs === 'undefined') return;
        try {
            emailjs.init(EMAILJS_PUBLIC_KEY);

            // Build mockup images HTML from filled slots
            var mockupImagesHtml = '';
            var mockupCount = 0;
            MOCKUP_SLOTS.forEach(function (slot) {
                if (slot.key === 'Box_Reference_File') return;
                var url = currentMockup[slot.key];
                if (!url) return;
                var ext = getFileExtension(url);
                if (IMAGE_EXTENSIONS.indexOf(ext) === -1) return;
                mockupCount++;
                mockupImagesHtml += '<div style="margin-bottom:12px;text-align:center;">'
                    + '<p style="font-size:13px;color:#666;margin:0 0 6px 0;font-weight:600;">' + slot.label + '</p>'
                    + '<img src="' + url + '" alt="' + slot.label + '" style="max-width:100%;max-height:300px;border-radius:8px;border:1px solid #e5e7eb;">'
                    + '</div>';
            });

            emailjs.send(EMAILJS_SERVICE_ID, 'art_approval_request', {
                to_email: aeEmail,
                to_name: getAeDisplayName(aeEmail),
                from_name: 'Ruth',
                design_id: currentMockup.Design_Number || currentMockup.ID,
                company_name: currentMockup.Company_Name || 'Unknown',
                revision_count: currentMockup.Revision_Count || 0,
                message: message || 'Mockup is ready for your review.',
                mockup_count: mockupCount,
                mockup_images_html: mockupImagesHtml,
                art_time_display: 'N/A',
                detail_link: HEROKU_ORIGIN + '/mockup/' + mockupId + '?view=ae'
            }).catch(function () { /* fire-and-forget */ });
        } catch (e) { /* silent */ }
    }

    function sendUploadNotification(fieldKey, fileName) {
        // Only Ruth (default view) sends upload notifications to the AE
        if (isAeView || isCustomerView) return;
        if (!currentMockup) return;

        var aeEmail = currentMockup.Submitted_By || '';
        if (!aeEmail) return;

        var slotLabel = MOCKUP_SLOTS.filter(function (s) { return s.key === fieldKey; })[0];
        var slotName = slotLabel ? slotLabel.label : fieldKey;
        var company = currentMockup.Company_Name || 'Unknown';
        var design = currentMockup.Design_Number || currentMockup.ID;

        sendMockupNotification({
            to_email: aeEmail,
            to_name: getAeDisplayName(aeEmail),
            note_text: 'Ruth uploaded "' + (fileName || 'file') + '" to ' + slotName
                + ' for ' + company + ' #' + design
                + '. Please review when ready.',
            note_type: 'Mockup Uploaded',
            detail_link: HEROKU_ORIGIN + '/mockup/' + mockupId + '?view=ae',
            from_name: 'Ruth'
        });
    }

    function sendStatusNotifications(newStatus) {
        if (!currentMockup) return;
        var company = currentMockup.Company_Name || '';
        var design = currentMockup.Design_Number || currentMockup.ID;
        var ruthLink = HEROKU_ORIGIN + '/mockup/' + mockupId;
        var aeLink = HEROKU_ORIGIN + '/mockup/' + mockupId + '?view=ae';

        if (newStatus === 'Awaiting Approval' && !isAeView && !isCustomerView) {
            // Ruth sends for approval → notify AE with rich approval email
            var aeEmail = currentMockup.Submitted_By || 'ae@nwcustomapparel.com';
            sendApprovalNotification(aeEmail, 'Mockup is ready for your review: ' + company + ' #' + design);
        } else if (newStatus === 'Approved') {
            // Notify Ruth
            sendMockupNotification({
                to_email: RUTH_EMAIL,
                to_name: 'Ruth',
                note_text: 'Mockup approved for ' + company + ' #' + design,
                note_type: 'Approved',
                detail_link: ruthLink,
                from_name: isCustomerView ? 'Customer' : getAeDisplayName(currentMockup.Submitted_By)
            });
            // If customer approved, also notify AE
            if (isCustomerView) {
                var aeEmail2 = currentMockup.Submitted_By || 'ae@nwcustomapparel.com';
                sendMockupNotification({
                    to_email: aeEmail2,
                    to_name: getAeDisplayName(aeEmail2),
                    note_text: 'Customer approved mockup for ' + company + ' #' + design,
                    note_type: 'Customer Approved',
                    detail_link: aeLink,
                    from_name: 'Customer'
                });
            }
        } else if (newStatus === 'Revision Requested') {
            // Notify Ruth
            sendMockupNotification({
                to_email: RUTH_EMAIL,
                to_name: 'Ruth',
                note_text: 'Changes requested for ' + company + ' #' + design,
                note_type: 'Revision Requested',
                detail_link: ruthLink,
                from_name: isCustomerView ? 'Customer' : getAeDisplayName(currentMockup.Submitted_By)
            });
            // If customer requested changes, also notify AE
            if (isCustomerView) {
                var aeEmail3 = currentMockup.Submitted_By || 'ae@nwcustomapparel.com';
                sendMockupNotification({
                    to_email: aeEmail3,
                    to_name: getAeDisplayName(aeEmail3),
                    note_text: 'Customer requested changes for ' + company + ' #' + design,
                    note_type: 'Customer Revision Request',
                    detail_link: aeLink,
                    from_name: 'Customer'
                });
            }
        }
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
