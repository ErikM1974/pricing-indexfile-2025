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
    var INKSOFT_API = 'https://inksoft-transform-8a3dc4e38097.herokuapp.com';

    // ── EmailJS Config ──────────────────────────────────────────────────
    var EMAILJS_SERVICE_ID = 'service_jgrave3';
    var EMAILJS_PUBLIC_KEY = '4qSbDO-SQs19TbP80';
    var HEROKU_ORIGIN = 'https://www.teamnwca.com';
    var RUTH_EMAIL = 'ruth@nwcustomapparel.com';

    // Logged-in user identity (from staff portal session)
    function getLoggedInUser() {
        var name = sessionStorage.getItem('nwca_user_name') || '';
        var email = sessionStorage.getItem('nwca_user_email') || '';
        return {
            name: name || 'Staff',
            email: email || 'staff@nwcustomapparel.com',
            firstName: (name || 'Staff').split(' ')[0],
            noteBy: name || email || 'staff@nwcustomapparel.com'
        };
    }

    var MOCKUP_SLOTS = [
        { key: 'Box_Mockup_1', label: 'Mockup 1', noteKey: 'Mockup_1_Note' },
        { key: 'Box_Mockup_2', label: 'Mockup 2', noteKey: 'Mockup_2_Note' },
        { key: 'Box_Mockup_3', label: 'Mockup 3', noteKey: 'Mockup_3_Note' },
        { key: 'Box_Mockup_4', label: 'Mockup 4' },
        { key: 'Box_Mockup_5', label: 'Mockup 5' },
        { key: 'Box_Mockup_6', label: 'Mockup 6' },
        { key: 'Box_Reference_File', label: 'Reference File' }
    ];

    // ── State ──────────────────────────────────────────────────────────────
    var currentMockup = null;
    var activeSlotKey = null;
    var selectedBoxFile = null;
    var boxFoldersCache = null;
    var isAeView = false;
    var mockupId = null;
    var mockupVersions = [];
    var boxPanelFiles = [];
    var reviseAttachedFiles = [];
    var dragSource = null;
    var storedEmbRecords = {};       // keyed by Mockup_Slot: "1", "2", "3"
    var activeThreadEditorSlot = null; // which slot's editor is open
    var editorThreads = [];           // working copy of threads for active editor

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
        // Set maroon theme CSS variables for AE view
        var root = document.documentElement;
        root.style.setProperty('--art-theme', '#981e32');
        root.style.setProperty('--art-theme-dark', '#7a1828');
        root.style.setProperty('--art-theme-light', '#b92c43');
        root.style.setProperty('--art-theme-bg', '#fff5f5');
        root.style.setProperty('--art-theme-bg-hover', '#fce8ec');
        root.style.setProperty('--art-theme-bg-selected', '#fde2e8');
        root.style.setProperty('--art-theme-rgba-15', 'rgba(152,30,50,0.15)');
        root.style.setProperty('--art-theme-rgba-10', 'rgba(152,30,50,0.1)');
        // Init prev/next navigation for AE view
        initMockupNavigation();
    }

    // Adjust header and theme for customer view — NWCA green
    if (isCustomerView) {
        var headerTitle = document.getElementById('pmd-header-title');
        var backLink = document.getElementById('pmd-back-link');
        if (headerTitle) headerTitle.textContent = 'Mockup Approval';
        if (backLink) backLink.style.display = 'none';
        document.body.classList.add('pmd-customer-view');
        // Set green theme CSS variables for customer view
        var root = document.documentElement;
        root.style.setProperty('--art-theme', '#2e7d32');
        root.style.setProperty('--art-theme-dark', '#1b5e20');
        root.style.setProperty('--art-theme-light', '#4caf50');
        root.style.setProperty('--art-theme-bg', '#f1f8e9');
        root.style.setProperty('--art-theme-bg-hover', '#e8f5e9');
        root.style.setProperty('--art-theme-bg-selected', '#c8e6c9');
        root.style.setProperty('--art-theme-rgba-15', 'rgba(46,125,50,0.15)');
        root.style.setProperty('--art-theme-rgba-10', 'rgba(46,125,50,0.1)');
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
        }),
        fetch(API_BASE + '/api/mockup-versions/' + mockupId).then(function (r) {
            if (!r.ok) return { versions: [] };
            return r.json();
        })
    ]).then(function (results) {
        var mockupData = results[0];
        var notesData = results[1];
        mockupVersions = (results[2] && results[2].versions) || [];

        if (!mockupData.success || !mockupData.record) {
            showError('Mockup Not Found', 'No mockup found with ID ' + mockupId);
            return;
        }

        currentMockup = mockupData.record;
        currentMockup._notes = notesData.notes || [];
        render(currentMockup, currentMockup._notes);
    }).catch(function (err) {
        console.error('Failed to load mockup:', err);
        showError('Error Loading Mockup', err.message);
    });

    // ── AE Edit Mockup Modal ──────────────────────────────────────────
    function openMockupEditModal(mockup) {
        var modal = document.getElementById('pmd-edit-modal');
        if (!modal) return;

        document.getElementById('pmd-edit-design-name').value = mockup.Design_Name || '';
        var typeSelect = document.getElementById('pmd-edit-mockup-type');
        var typeVal = mockup.Mockup_Type || '';
        for (var i = 0; i < typeSelect.options.length; i++) {
            if (typeSelect.options[i].value === typeVal) { typeSelect.selectedIndex = i; break; }
        }
        document.getElementById('pmd-edit-garment').value = mockup.Garment_Info || '';
        document.getElementById('pmd-edit-placement').value = mockup.Print_Location || '';
        document.getElementById('pmd-edit-logo-width').value = mockup.Logo_Width || '';
        document.getElementById('pmd-edit-logo-height').value = mockup.Logo_Height || '';
        document.getElementById('pmd-edit-design-size').value = mockup.Design_Size || '';
        var dueDate = mockup.Due_Date || '';
        if (dueDate) {
            var d = new Date(dueDate);
            if (!isNaN(d)) document.getElementById('pmd-edit-due-date').value = d.toISOString().split('T')[0];
        }
        document.getElementById('pmd-edit-thread-colors').value = mockup.Thread_Colors || '';
        document.getElementById('pmd-edit-ae-notes').value = mockup.AE_Notes || '';

        modal.style.display = 'flex';

        document.getElementById('pmd-edit-close').onclick = function () { modal.style.display = 'none'; };
        document.getElementById('pmd-edit-cancel').onclick = function () { modal.style.display = 'none'; };
        modal.addEventListener('click', function (e) { if (e.target === modal) modal.style.display = 'none'; });
        document.getElementById('pmd-edit-save').onclick = function () { saveMockupEdit(mockup); };
    }

    function saveMockupEdit(originalMockup) {
        var saveBtn = document.getElementById('pmd-edit-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        var fields = [
            { key: 'Design_Name', el: 'pmd-edit-design-name', orig: originalMockup.Design_Name || '' },
            { key: 'Mockup_Type', el: 'pmd-edit-mockup-type', orig: originalMockup.Mockup_Type || '' },
            { key: 'Garment_Info', el: 'pmd-edit-garment', orig: originalMockup.Garment_Info || '' },
            { key: 'Print_Location', el: 'pmd-edit-placement', orig: originalMockup.Print_Location || '' },
            { key: 'Logo_Width', el: 'pmd-edit-logo-width', orig: originalMockup.Logo_Width || '' },
            { key: 'Logo_Height', el: 'pmd-edit-logo-height', orig: originalMockup.Logo_Height || '' },
            { key: 'Design_Size', el: 'pmd-edit-design-size', orig: originalMockup.Design_Size || '' },
            { key: 'Due_Date', el: 'pmd-edit-due-date', orig: originalMockup.Due_Date ? new Date(originalMockup.Due_Date).toISOString().split('T')[0] : '' },
            { key: 'Thread_Colors', el: 'pmd-edit-thread-colors', orig: originalMockup.Thread_Colors || '' },
            { key: 'AE_Notes', el: 'pmd-edit-ae-notes', orig: originalMockup.AE_Notes || '' }
        ];

        var updates = {};
        var changedNames = [];
        fields.forEach(function (f) {
            var newVal = document.getElementById(f.el).value.trim();
            if (newVal !== f.orig) {
                updates[f.key] = newVal;
                changedNames.push(f.key);
            }
        });

        if (Object.keys(updates).length === 0) {
            document.getElementById('pmd-edit-modal').style.display = 'none';
            showToast('No changes to save', 'info');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
            return;
        }

        fetch(API_BASE + '/api/mockups/' + mockupId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Save failed: ' + resp.status);
            return resp.json();
        }).then(function () {
            // Log note about what changed
            return fetch(API_BASE + '/api/mockup-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    Mockup_ID: parseInt(mockupId),
                    Author: getLoggedInUser().email,
                    Author_Name: getLoggedInUser().firstName,
                    Note_Text: 'AE updated fields: ' + changedNames.join(', '),
                    Note_Type: 'status_change'
                })
            }).catch(function () {});
        }).then(function () {
            // Notify Ruth
            if (typeof emailjs !== 'undefined') {
                emailjs.init(EMAILJS_PUBLIC_KEY);
                emailjs.send(EMAILJS_SERVICE_ID, 'mockup_note_notification', {
                    to_email: RUTH_EMAIL,
                    to_name: 'Ruth',
                    design_number: originalMockup.Design_Number || mockupId,
                    company_name: originalMockup.Company_Name || '',
                    note_text: 'AE updated mockup details: ' + changedNames.join(', '),
                    note_type: 'AE Edit',
                    detail_link: HEROKU_ORIGIN + '/mockup/' + mockupId,
                    from_name: getLoggedInUser().firstName || 'AE'
                }, EMAILJS_PUBLIC_KEY).catch(function () {});
            }
            document.getElementById('pmd-edit-modal').style.display = 'none';
            showToast('Request updated successfully', 'success');
            setTimeout(function () { location.reload(); }, 800);
        }).catch(function (err) {
            console.error('Mockup edit save failed:', err);
            showToast('Failed to save: ' + err.message, 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        });
    }

    // ── AE Prev/Next Navigation ─────────────────────────────────────────
    function initMockupNavigation() {
        var navBar = document.getElementById('pmd-nav-bar');
        if (!navBar) return;

        var REP_EMAIL_MAP = {
            'Taneisha': 'taneisha@nwcustomapparel.com',
            'Nika': 'nika@nwcustomapparel.com',
            'Ruthie': 'ruthie@nwcustomapparel.com',
            'Erik': 'erik@nwcustomapparel.com'
        };

        var cacheKey = 'ae_mockup_nav_list';
        var cached = sessionStorage.getItem(cacheKey);
        var navList = null;
        var cacheRendered = false;

        if (cached) {
            try { navList = JSON.parse(cached); } catch (e) { navList = null; }
        }
        if (navList && navList.length > 0) {
            cacheRendered = renderNav(navList);
        }

        // Fetch fresh list in background
        var repFilter = sessionStorage.getItem('ae_mockup_rep_filter') || '';
        var apiUrl = API_BASE + '/api/mockups?orderBy=Submitted_Date DESC&limit=500';
        if (repFilter && repFilter !== 'All') {
            if (REP_EMAIL_MAP[repFilter]) {
                apiUrl += '&submittedBy=' + encodeURIComponent(REP_EMAIL_MAP[repFilter]);
            }
        }

        fetch(apiUrl).then(function (r) {
            if (!r.ok) throw new Error('Failed');
            return r.json();
        }).then(function (data) {
            var records = data.records || [];
            if (!records.length) return;
            var list = records.map(function (m) {
                return { id: m.ID, company: m.Company_Name || '', design: m.Design_Number || '' };
            });
            sessionStorage.setItem(cacheKey, JSON.stringify(list));
            if (!cacheRendered) renderNav(list);
        }).catch(function () {});

        function renderNav(list) {
            var currentId = parseInt(mockupId);
            var idx = -1;
            for (var i = 0; i < list.length; i++) {
                if (parseInt(list[i].id) === currentId) { idx = i; break; }
            }
            if (idx === -1) return false;

            navBar.style.display = '';
            var prevBtn = document.getElementById('pmd-nav-prev');
            var nextBtn = document.getElementById('pmd-nav-next');
            document.getElementById('pmd-nav-position').textContent = (idx + 1) + ' of ' + list.length;

            if (idx > 0) {
                var prev = list[idx - 1];
                prevBtn.disabled = false;
                prevBtn.innerHTML = '&larr; ' + escapeHtml(prev.company || '#' + prev.id);
                prevBtn.addEventListener('click', function () {
                    window.location.href = '/mockup/' + prev.id + '?view=ae';
                });
            }
            if (idx < list.length - 1) {
                var next = list[idx + 1];
                nextBtn.disabled = false;
                nextBtn.innerHTML = escapeHtml(next.company || '#' + next.id) + ' &rarr;';
                nextBtn.addEventListener('click', function () {
                    window.location.href = '/mockup/' + next.id + '?view=ae';
                });
            }
            return true;
        }
    }

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
        renderActionBars(mockup, notes);

        // Revision feedback banner (shows above gallery for Revision Requested)
        renderRevisionBanner(mockup, notes);

        // Status timeline (5-step progress stepper)
        renderStatusTimeline(notes);

        // ShopWorks Art Done check (for completed/approved mockups with a work order number)
        var woNum = mockup.Work_Order_Number;
        var statusLower = status.toLowerCase();
        if (woNum && (statusLower === 'completed' || statusLower === 'approved')) {
            checkShopWorksArtDone(woNum);
        }

        // Gallery
        renderGallery(mockup);

        // Info fields
        renderInfoFields(mockup);

        // AE Edit button (all non-completed statuses)
        if (isAeView) {
            var statusForEdit = (mockup.Status || '').toLowerCase();
            if (statusForEdit !== 'completed') {
                var editBar = document.createElement('div');
                editBar.className = 'pmd-ae-edit-bar';
                editBar.innerHTML = '<button type="button" class="pmd-ae-edit-btn" id="pmd-ae-edit-btn">Edit Request</button>';
                var infoCard = document.getElementById('pmd-info-fields');
                if (infoCard && infoCard.parentNode) {
                    infoCard.parentNode.insertBefore(editBar, infoCard.nextSibling);
                }
                document.getElementById('pmd-ae-edit-btn').addEventListener('click', function () {
                    openMockupEditModal(mockup);
                });
            }
        }

        // Load stored EMB data from Caspio (shows swatches + results without re-parsing)
        loadStoredEmbData(mockup.PK_ID || mockup.ID);

        // Notes (hide for customer view, move to right column for AE view)
        if (isCustomerView) {
            var notesList = document.getElementById('pmd-notes-list');
            if (notesList) notesList.closest('.pmd-card').style.display = 'none';
        } else {
            renderNotes(notes);
            // AE view: move notes card to right column (below Request Details)
            if (isAeView) {
                var notesCard = document.getElementById('pmd-notes-list');
                if (notesCard) {
                    var card = notesCard.closest('.pmd-card');
                    var rightCol = document.querySelector('.pmd-right-col');
                    if (card && rightCol) rightCol.appendChild(card);
                }
            }
        }

        // Wire up interactions
        if (!isCustomerView) {
            initGalleryInteractions();
            initNoteForm();
        }
        initLightbox();
        if (!isCustomerView) initBoxModal();
        if (!isCustomerView && !isAeView) initBoxFilesPanel();

        // Wire up Find Order button
        var findOrderBtn = document.getElementById('pmd-find-order-btn');
        if (findOrderBtn) {
            findOrderBtn.addEventListener('click', function () {
                showFindOrderModal(mockup.Company_Name);
            });
        }
    }

    // ── Action Bars ────────────────────────────────────────────────────────
    function renderActionBars(mockup, notes) {
        var statusLower = (mockup.Status || '').toLowerCase().replace(/\s+/g, '');
        var ruthBar = document.getElementById('pmd-ruth-action-bar');
        var aeBar = document.getElementById('pmd-ae-action-bar');

        if (isCustomerView) {
            // Customer view
            ruthBar.style.display = 'none';
            aeBar.style.display = '';

            // Check if any mockup slots are filled
            var customerHasMockups = MOCKUP_SLOTS.some(function (s) { return mockup[s.key]; });

            if (statusLower === 'approved') {
                aeBar.innerHTML = '<div class="pmd-customer-thankyou">'
                    + '<div class="pmd-customer-thankyou-icon">&#9989;</div>'
                    + '<h3>Thank You!</h3>'
                    + '<p>This mockup has been approved. We will proceed with production.</p>'
                    + '</div>';
            } else if (statusLower === 'completed') {
                aeBar.innerHTML = '<div class="pmd-customer-thankyou">'
                    + '<div class="pmd-customer-thankyou-icon">&#9989;</div>'
                    + '<h3>This Request is Complete</h3>'
                    + '<p>Thank you for your feedback. This design has been finalized.</p>'
                    + '</div>';
            } else if (customerHasMockups) {
                // Customer can approve or request changes whenever mockups exist
                var greetingHtml = '';
                if (currentMockup.Customer_Name) {
                    greetingHtml = '<p class="pmd-customer-greeting">Hi ' + escapeHtml(currentMockup.Customer_Name) + ',</p>';
                }
                var sentDateHtml = '';
                if (currentMockup.Customer_Approval_Sent_Date) {
                    sentDateHtml = '<p class="pmd-customer-sent-date">Sent on ' + escapeHtml(formatDate(currentMockup.Customer_Approval_Sent_Date)) + '</p>';
                }
                aeBar.innerHTML = '<div class="pmd-customer-action-panel">'
                    + greetingHtml
                    + '<p class="pmd-customer-prompt">Please review the mockup(s) below and select the one you approve, or request changes.</p>'
                    + sentDateHtml
                    + '<div class="pmd-customer-btns">'
                    + '<button class="pmd-action-btn pmd-action-btn--approve pmd-action-btn--lg" id="pmd-btn-customer-approve">Approve Selected Mockup</button>'
                    + '<button class="pmd-action-btn pmd-action-btn--revise pmd-action-btn--lg" id="pmd-btn-customer-revise">Request Changes</button>'
                    + '</div>'
                    + '<button class="pmd-pdf-download-btn" id="pmd-btn-download-pdf" title="Download a PDF copy for your records">&#128196; Download PDF</button>'
                    + '</div>';

                document.getElementById('pmd-btn-customer-approve').addEventListener('click', function () {
                    handleCustomerApproval(this);
                });
                document.getElementById('pmd-btn-customer-revise').addEventListener('click', function () {
                    openReviseModal();
                });
                document.getElementById('pmd-btn-download-pdf').addEventListener('click', function () {
                    generateCustomerPDF();
                });
            } else {
                aeBar.innerHTML = '<div class="pmd-customer-status-msg">'
                    + '<p>This mockup is not ready for review yet. Please check back later.</p>'
                    + '</div>';
            }
        } else if (isAeView) {
            // AE view
            ruthBar.style.display = 'none';

            // Check if any mockup slots are filled
            var hasMockups = MOCKUP_SLOTS.some(function (s) { return mockup[s.key]; });

            // Customer approval elapsed time (shown on any status)
            var custElapsedHtml = '';
            if (mockup.Customer_Approval_Sent_Date) {
                var custElapsed = getElapsedText(new Date(mockup.Customer_Approval_Sent_Date));
                custElapsedHtml = ' <span class="approval-elapsed pmd-customer-elapsed ' + custElapsed.cssClass + '" title="Sent to customer ' + escapeHtml(formatDate(mockup.Customer_Approval_Sent_Date)) + '">(customer sent ' + escapeHtml(custElapsed.text) + ')</span>';
            }

            // Send to Customer + Copy Link buttons (shared across statuses)
            var sendCopyButtons = '<button class="pmd-action-btn pmd-action-btn--send" id="pmd-btn-send-customer" title="Send approval email to customer">Send to Customer</button>'
                + '<button class="pmd-action-btn pmd-action-btn--copy" id="pmd-btn-copy-link" title="Copy customer approval link">Copy Customer Link</button>';

            if (statusLower === 'awaitingapproval') {
                aeBar.style.display = '';
                var aeElapsedHtml = '';
                if (mockup.Approval_Sent_Date) {
                    var aeElapsed = getElapsedText(new Date(mockup.Approval_Sent_Date));
                    aeElapsedHtml = ' <span class="approval-elapsed ' + aeElapsed.cssClass + '" style="margin-left:8px;" title="' + escapeHtml(formatDate(mockup.Approval_Sent_Date)) + '">(sent ' + escapeHtml(aeElapsed.text) + ')</span>';
                }

                aeBar.innerHTML = '<span class="pmd-action-bar-label">Select mockup(s) to approve:' + aeElapsedHtml + custElapsedHtml + '</span>'
                    + '<button class="pmd-action-btn pmd-action-btn--approve" id="pmd-btn-approve">Approve Mockup</button>'
                    + '<button class="pmd-action-btn pmd-action-btn--revise" id="pmd-btn-revise">Request Changes</button>'
                    + sendCopyButtons;

                document.getElementById('pmd-btn-approve').addEventListener('click', function () {
                    if (selectedMockupSlots.length === 0) {
                        showToast('Please click one or more mockup images to select them first', 'error');
                        return;
                    }
                    var slotLabels = selectedMockupSlots.map(function (key) {
                        var slot = MOCKUP_SLOTS.filter(function (s) { return s.key === key; })[0];
                        return slot ? slot.label : key;
                    });
                    var approvalNote = 'AE approved ' + slotLabels.join(', ');
                    handleStatusUpdate('Approved', approvalNote, this);
                });
                document.getElementById('pmd-btn-revise').addEventListener('click', function () {
                    openReviseModal();
                });
            } else if (statusLower === 'approved') {
                // Approved — waiting for Ruth to finalize
                aeBar.style.display = '';
                aeBar.innerHTML = '<span class="pmd-action-bar-label">\u2705 Approved \u2014 Waiting for Ruth to finalize and mark complete' + custElapsedHtml + '</span>'
                    + '<button class="pmd-action-btn pmd-action-btn--reopen" id="pmd-btn-reopen">Reopen for Changes</button>'
                    + sendCopyButtons;
            } else if (statusLower === 'completed') {
                // Completed — fully done
                aeBar.style.display = '';
                aeBar.innerHTML = '<span class="pmd-action-bar-label">\u2705 Completed' + custElapsedHtml + '</span>'
                    + '<button class="pmd-action-btn pmd-action-btn--reopen" id="pmd-btn-reopen">Reopen for Changes</button>'
                    + sendCopyButtons;
            } else if (hasMockups) {
                // Other status but mockups exist — show send + copy buttons
                aeBar.style.display = '';
                var aeDeleteHtml = (statusLower === 'submitted' || statusLower === 'inprogress' || statusLower === 'revisionrequested')
                    ? '<button class="pmd-action-btn pmd-action-btn--delete" id="pmd-btn-ae-delete">Delete Request</button>' : '';
                aeBar.innerHTML = '<span class="pmd-action-bar-label">Mockup actions:' + custElapsedHtml + '</span>'
                    + sendCopyButtons + aeDeleteHtml;
                var aeDeleteBtn = document.getElementById('pmd-btn-ae-delete');
                if (aeDeleteBtn) {
                    aeDeleteBtn.addEventListener('click', function () { openDeleteModal(); });
                }
            } else {
                // No mockups yet — show delete for early statuses (e.g. duplicate submission)
                if (statusLower === 'submitted' || statusLower === 'inprogress' || statusLower === 'revisionrequested') {
                    aeBar.style.display = '';
                    aeBar.innerHTML = '<span class="pmd-action-bar-label">No mockups yet</span>'
                        + '<button class="pmd-action-btn pmd-action-btn--delete" id="pmd-btn-ae-delete">Delete Request</button>';
                    document.getElementById('pmd-btn-ae-delete').addEventListener('click', function () { openDeleteModal(); });
                } else {
                    aeBar.style.display = 'none';
                }
            }

            // Attach send/copy/reopen listeners if buttons exist
            var sendBtn = document.getElementById('pmd-btn-send-customer');
            var copyBtn = document.getElementById('pmd-btn-copy-link');
            var reopenBtn = document.getElementById('pmd-btn-reopen');
            if (sendBtn) {
                sendBtn.addEventListener('click', function () {
                    openSendToCustomerModal();
                });
            }
            if (copyBtn) {
                copyBtn.addEventListener('click', function () {
                    var customerUrl = window.location.origin + '/mockup/' + mockupId + '?view=customer';
                    navigator.clipboard.writeText(customerUrl).then(function () {
                        showToast('Customer link copied to clipboard!', 'success');
                    }).catch(function () {
                        prompt('Copy this link:', customerUrl);
                    });
                });
            }
            if (reopenBtn) {
                reopenBtn.addEventListener('click', function () {
                    handleReopen(this, getAeDisplayName(currentMockup.Submitted_By || ''));
                });
            }
        } else {
            // Ruth's view
            aeBar.style.display = 'none';

            // Delete button HTML (shared across Submitted / In Progress / Revision Requested)
            var deleteButtonHtml = '<button class="pmd-action-btn pmd-action-btn--delete" id="pmd-btn-delete">Delete Request</button>';

            if (statusLower === 'submitted') {
                ruthBar.style.display = '';
                ruthBar.innerHTML = '<span class="pmd-action-bar-label">Ready to start?</span>'
                    + '<button class="pmd-action-btn pmd-action-btn--start" id="pmd-btn-start">Start Working</button>'
                    + deleteButtonHtml;
                document.getElementById('pmd-btn-start').addEventListener('click', function () {
                    handleStatusUpdate('In Progress', null, this);
                });
                document.getElementById('pmd-btn-delete').addEventListener('click', function () {
                    openDeleteModal();
                });
            } else if (statusLower === 'inprogress' || statusLower === 'revisionrequested') {
                ruthBar.style.display = '';
                ruthBar.innerHTML = '<span class="pmd-action-bar-label">Ready for review?</span>'
                    + '<button class="pmd-action-btn pmd-action-btn--send" id="pmd-btn-send">Send for Approval</button>'
                    + deleteButtonHtml;
                document.getElementById('pmd-btn-send').addEventListener('click', function () {
                    handleStatusUpdate('Awaiting Approval', null, this);
                });
                document.getElementById('pmd-btn-delete').addEventListener('click', function () {
                    openDeleteModal();
                });
            } else if (statusLower === 'awaitingapproval') {
                ruthBar.style.display = '';
                // Find when approval was sent
                var approvalSentDate = mockup.Approval_Sent_Date;
                var elapsedHtml = '';
                if (approvalSentDate) {
                    var elapsed = getElapsedText(new Date(approvalSentDate));
                    elapsedHtml = '<span class="approval-elapsed ' + elapsed.cssClass + '" title="' + escapeHtml(formatDate(approvalSentDate)) + '">'
                        + 'Sent to AE ' + escapeHtml(elapsed.text)
                        + '</span>';
                } else {
                    elapsedHtml = '<span class="approval-elapsed">Waiting for AE review</span>';
                }
                // Count existing reminders
                var ruthReminderCount = 0;
                if (notes && notes.length > 0) {
                    for (var ri = 0; ri < notes.length; ri++) {
                        if ((notes[ri].Note_Text || '').indexOf('Approval reminder sent') === 0) {
                            ruthReminderCount++;
                        }
                    }
                }
                var nudgeBtnLabel = ruthReminderCount > 0 ? 'Send Reminder to AE (' + ruthReminderCount + ' sent)' : 'Send Reminder to AE';
                ruthBar.innerHTML = elapsedHtml
                    + '<button class="pmd-action-btn pmd-action-btn--send" id="pmd-btn-nudge" data-reminder-count="' + ruthReminderCount + '">' + nudgeBtnLabel + '</button>';
                document.getElementById('pmd-btn-nudge').addEventListener('click', function () {
                    var btn = this;
                    btn.disabled = true;
                    btn.textContent = 'Sending...';

                    var aeEmail = currentMockup.Submitted_By || 'ae@nwcustomapparel.com';
                    var company = currentMockup.Company_Name || '';
                    var design = currentMockup.Design_Number || currentMockup.ID;

                    // Resend approval email with REMINDER prefix
                    sendApprovalNotification(aeEmail, 'Reminder: Mockup is waiting for your review — ' + company + ' #' + design, 'REMINDER: ');

                    // Record nudge in notes timeline
                    fetch(API_BASE + '/api/mockup-notes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            Mockup_ID: parseInt(mockupId),
                            Author: getLoggedInUser().email,
                            Author_Name: getLoggedInUser().firstName,
                            Note_Text: 'Approval reminder sent to ' + getAeDisplayName(aeEmail),
                            Note_Type: 'artist_note'
                        })
                    }).then(function () {
                        refreshNotes();
                        showToast('Reminder sent to ' + getAeDisplayName(aeEmail), 'success');
                    }).catch(function () {
                        showToast('Reminder email sent', 'success');
                    }).finally(function () {
                        var newCount = parseInt(btn.getAttribute('data-reminder-count') || '0') + 1;
                        btn.setAttribute('data-reminder-count', newCount);
                        setTimeout(function () {
                            btn.disabled = false;
                            btn.textContent = 'Send Reminder to AE (' + newCount + ' sent)';
                        }, 5000);
                    });
                });
            } else if (statusLower === 'approved') {
                ruthBar.style.display = '';
                ruthBar.innerHTML = '<span class="pmd-action-bar-label">\u2705 Approved \u2014 Ready for final review</span>'
                    + '<button class="pmd-action-btn pmd-action-btn--complete" id="pmd-btn-mark-complete">Mark Complete</button>'
                    + '<button class="pmd-action-btn pmd-action-btn--reopen" id="pmd-btn-reopen">Reopen for Changes</button>';
                document.getElementById('pmd-btn-mark-complete').addEventListener('click', function () {
                    openMarkCompleteModal(this);
                });
                document.getElementById('pmd-btn-reopen').addEventListener('click', function () {
                    handleReopen(this, 'Ruth');
                });
            } else if (statusLower === 'completed') {
                ruthBar.style.display = '';
                ruthBar.innerHTML = '<span class="pmd-action-bar-label">This mockup is completed</span>'
                    + '<button class="pmd-action-btn pmd-action-btn--reopen" id="pmd-btn-reopen">Reopen for Changes</button>';
                document.getElementById('pmd-btn-reopen').addEventListener('click', function () {
                    handleReopen(this, 'Ruth');
                });
            } else {
                ruthBar.style.display = 'none';
            }
        }
    }

    // ── Mockup Selection (multi-select for AE, single for Customer) ─────
    var selectedMockupSlots = [];
    var customerApprovalInProgress = false;

    function handleCustomerApproval(btnEl) {
        if (customerApprovalInProgress) return;
        if (selectedMockupSlots.length === 0) {
            showToast('Please click on a mockup to select it first', 'error');
            return;
        }
        customerApprovalInProgress = true;
        if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Submitting...'; }

        var slotLabels = selectedMockupSlots.map(function (key) {
            var slot = MOCKUP_SLOTS.filter(function (s) { return s.key === key; })[0];
            return slot ? slot.label : key;
        });
        var approvalNote = 'Customer approved ' + slotLabels.join(', ');

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
            // Log customer approval note for timeline
            return fetch(API_BASE + '/api/mockup-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    Mockup_ID: parseInt(mockupId),
                    Author: 'Customer',
                    Author_Name: 'Customer',
                    Note_Text: approvalNote,
                    Note_Type: 'status_change'
                })
            }).catch(function (err) { console.warn('Note logging failed (non-blocking):', err); });
        }).then(function () {
            if (typeof NWCAConfetti !== 'undefined') NWCAConfetti.fire();
            sendStatusNotifications('Approved');
            showCustomerConfirmation('approved');
        }).catch(function (err) {
            customerApprovalInProgress = false;
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

    // ── Mark Complete Modal (Ruth) ─────────────────────────────────────────
    function openMarkCompleteModal(btnEl) {
        // Create modal overlay
        var overlay = document.createElement('div');
        overlay.className = 'pmd-modal-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9998;display:flex;align-items:center;justify-content:center;';

        var modal = document.createElement('div');
        modal.style.cssText = 'background:#fff;border-radius:12px;padding:0;max-width:440px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);z-index:9999;';
        modal.innerHTML =
            '<div style="background:#16a34a;color:#fff;padding:14px 20px;border-radius:12px 12px 0 0;font-weight:600;font-size:16px;">' +
                'Mark Complete \u2014 #' + (currentMockup.Design_Number || mockupId) +
            '</div>' +
            '<div style="padding:20px;">' +
                '<label style="font-size:13px;font-weight:600;color:#333;display:block;margin-bottom:6px;">Final notes (optional):</label>' +
                '<textarea id="pmd-complete-notes" style="width:100%;height:80px;border:1px solid #d1d5db;border-radius:8px;padding:10px;font-size:14px;resize:vertical;box-sizing:border-box;" placeholder="Any final notes before completing..."></textarea>' +
                '<div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;">' +
                    '<button id="pmd-complete-cancel" style="padding:10px 20px;border:1px solid #d1d5db;border-radius:8px;background:#fff;cursor:pointer;font-size:14px;">Cancel</button>' +
                    '<button id="pmd-complete-submit" style="padding:10px 20px;border:none;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;font-weight:600;font-size:14px;">Mark Complete</button>' +
                '</div>' +
            '</div>';

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });

        document.getElementById('pmd-complete-cancel').addEventListener('click', function () {
            document.body.removeChild(overlay);
        });

        document.getElementById('pmd-complete-submit').addEventListener('click', function () {
            var submitBtn = this;
            var notesText = (document.getElementById('pmd-complete-notes').value || '').trim();
            submitBtn.disabled = true;
            submitBtn.textContent = 'Completing...';

            var noteText = 'Marked as complete by Ruth';
            if (notesText) noteText += ': ' + notesText;

            // 1. Update status to Completed
            fetch(API_BASE + '/api/mockups/' + mockupId + '/status', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Completed' })
            }).then(function (resp) {
                if (!resp.ok) throw new Error('Status update failed: ' + resp.status);

                // 2. Log completion note
                return fetch(API_BASE + '/api/mockup-notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        Mockup_ID: parseInt(mockupId),
                        Author: getLoggedInUser().email,
                        Author_Name: getLoggedInUser().firstName,
                        Note_Text: noteText,
                        Note_Type: 'status_change'
                    })
                });
            }).then(function () {
                // 3. Notify AE
                sendStatusNotifications('Completed');

                // 4. ShopWorks reminder
                document.body.removeChild(overlay);
                showToast('\u2705 Marked complete! Don\u2019t forget to upload the thumbnail to ShopWorks.', 'success');
                setTimeout(function () { location.reload(); }, 2500);
            }).catch(function (err) {
                console.error('Mark complete failed:', err);
                submitBtn.textContent = 'Error \u2014 retry';
                submitBtn.style.background = '#dc3545';
                submitBtn.disabled = false;
            });
        });
    }

    // ── Reopen from Approved/Completed ──────────────────────────────────────
    function handleReopen(btnEl, reopenedBy) {
        if (!confirm('Reopen this mockup for additional changes? Status will be set to Revision Requested.')) {
            return;
        }
        if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Reopening...'; }

        var previousStatus = (currentMockup.Status || '').replace(/\s+/g, '');
        var noteText = 'Reopened from ' + previousStatus + ' — additional changes needed';
        var authorName = reopenedBy || 'Unknown';

        // Update status to Revision Requested
        fetch(API_BASE + '/api/mockups/' + mockupId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Status: 'Revision Requested' })
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Status ' + resp.status);
            // Log note
            return fetch(API_BASE + '/api/mockup-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    Mockup_ID: parseInt(mockupId),
                    Author: authorName,
                    Author_Name: authorName,
                    Note_Text: noteText,
                    Note_Type: 'status_change'
                })
            });
        }).then(function () {
            // Send notifications to Ruth + AE
            sendStatusNotifications('Revision Requested');
            showToast('Mockup reopened for changes', 'success');
            if (btnEl) { btnEl.textContent = 'Reopened!'; btnEl.style.background = '#28a745'; }
            // Reload page after short delay
            setTimeout(function () { location.reload(); }, 1000);
        }).catch(function (err) {
            showToast('Failed to reopen: ' + err.message, 'error');
            if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Reopen for Changes'; }
        });
    }

    // ── Status Update ──────────────────────────────────────────────────────
    var statusUpdateInProgress = false;
    function handleStatusUpdate(newStatus, notes, btnEl) {
        if (statusUpdateInProgress) return;
        statusUpdateInProgress = true;
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.textContent = 'Updating...';
        }

        var author, authorName;
        if (isCustomerView) {
            author = 'Customer';
            authorName = 'Customer';
        } else {
            var loggedIn = getLoggedInUser();
            author = loggedIn.email;
            authorName = loggedIn.firstName;
        }

        var body = { status: newStatus, author: author, authorName: authorName };
        if (notes) body.notes = notes;

        // Build note text for timeline tracking
        // Always include the status name so timeline scanner can detect it
        var noteText;
        if (notes) {
            noteText = 'Status changed to ' + newStatus + ': ' + notes;
        } else {
            noteText = 'Status changed to ' + newStatus;
        }

        fetch(API_BASE + '/api/mockups/' + mockupId + '/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Status update failed');
            return resp.json();
        }).then(function () {
            // Log status change note for timeline
            return fetch(API_BASE + '/api/mockup-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    Mockup_ID: parseInt(mockupId),
                    Author: author,
                    Author_Name: authorName,
                    Note_Text: noteText,
                    Note_Type: 'status_change'
                })
            }).catch(function (err) { console.warn('Note logging failed (non-blocking):', err); });
        }).then(function () {
            // Celebrate approvals and completions
            if ((newStatus === 'Approved' || newStatus === 'Completed') && typeof NWCAConfetti !== 'undefined') {
                NWCAConfetti.fire();
            }

            // Fire-and-forget email notifications
            sendStatusNotifications(newStatus);

            if (isCustomerView) {
                showCustomerConfirmation(newStatus === 'Approved' ? 'approved' : 'revision');
                return;
            }
            showToast('Status updated to "' + newStatus + '"', 'success');
            setTimeout(function () { location.reload(); }, 800);
        }).catch(function (err) {
            statusUpdateInProgress = false;
            console.error('Status update error:', err);
            showToast('Failed to update status: ' + err.message, 'error');
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.textContent = 'Retry';
            }
        });
    }

    // ── Revision Feedback Banner ────────────────────────────────────────────
    function renderRevisionBanner(mockup, notes) {
        var banner = document.getElementById('pmd-revision-banner');
        if (!banner) return;

        var statusLower = (mockup.Status || '').toLowerCase().replace(/\s+/g, '');
        if (statusLower !== 'revisionrequested' || isCustomerView) {
            banner.style.display = 'none';
            return;
        }

        // Find the latest revision_request note
        var revisionNote = null;
        if (notes && notes.length > 0) {
            for (var i = notes.length - 1; i >= 0; i--) {
                if (notes[i].Note_Type === 'revision_request') {
                    revisionNote = notes[i];
                    break;
                }
            }
        }

        if (!revisionNote) {
            banner.style.display = 'none';
            return;
        }

        var authorName = revisionNote.Author_Name || 'AE';
        var noteText = revisionNote.Note_Text || '';

        // Check if the note has per-mockup sections (format: **Mockup N:** text)
        var perMockupPattern = /\*\*(Mockup \d+):\*\*\s*/g;
        var hasPerMockup = perMockupPattern.test(noteText);

        var feedbackHtml = '';
        if (hasPerMockup) {
            // Parse per-mockup sections and show with thumbnails
            var sections = noteText.split(/\*\*Mockup \d+:\*\*\s*/);
            var labels = noteText.match(/\*\*(Mockup \d+):\*\*/g) || [];
            for (var j = 0; j < labels.length; j++) {
                var label = labels[j].replace(/\*\*/g, '');
                var text = (sections[j + 1] || '').trim();
                if (!text) continue;
                var slotIndex = parseInt(label.replace('Mockup ', '')) - 1;
                var slotKey = MOCKUP_SLOTS[slotIndex] ? MOCKUP_SLOTS[slotIndex].key : null;
                var thumbUrl = slotKey && mockup[slotKey] ? mockup[slotKey] : '';
                feedbackHtml += '<div class="pmd-rev-section">';
                if (thumbUrl) {
                    feedbackHtml += '<img src="' + escapeHtml(thumbUrl) + '" class="pmd-rev-thumb" alt="' + escapeHtml(label) + '">';
                }
                feedbackHtml += '<div class="pmd-rev-section-content">'
                    + '<strong>' + escapeHtml(label) + ':</strong> '
                    + escapeHtml(text)
                    + '</div></div>';
            }
        } else {
            feedbackHtml = '<div class="pmd-rev-text">' + escapeHtml(noteText) + '</div>';
        }

        banner.style.display = '';
        banner.innerHTML = '<div class="pmd-rev-icon">&#9888;&#65039;</div>'
            + '<div class="pmd-rev-content">'
            + '<div class="pmd-rev-title">Changes Requested by ' + escapeHtml(authorName) + '</div>'
            + feedbackHtml
            + '</div>';
    }

    // ── Per-Mockup Notes ──────────────────────────────────────────────────
    /** Save a per-mockup note (blur auto-save) */
    function saveMockupNote(noteKey, value) {
        if (!mockupId || !noteKey) return;
        var trimmed = (value || '').trim();
        if (trimmed === (currentMockup[noteKey] || '')) return;

        var body = {};
        body[noteKey] = trimmed;
        fetch(API_BASE + '/api/mockups/' + mockupId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Save note failed: ' + resp.status);
            currentMockup[noteKey] = trimmed;
            var inp = document.querySelector('.pmd-mockup-note-input[data-note-key="' + noteKey + '"]');
            if (inp) {
                inp.classList.add('pmd-note-saved');
                setTimeout(function () { inp.classList.remove('pmd-note-saved'); }, 1200);
            }
        }).catch(function (err) {
            console.error('Mockup note save error:', err);
            var inp = document.querySelector('.pmd-mockup-note-input[data-note-key="' + noteKey + '"]');
            if (inp) {
                inp.classList.add('pmd-note-error');
                setTimeout(function () { inp.classList.remove('pmd-note-error'); }, 1200);
            }
        });
    }

    /** Create a mockup note input element for a slot */
    function createMockupNoteInput(slot, mockup) {
        if (!slot.noteKey) return null;
        if (isCustomerView) return null;

        // AE view: read-only display
        if (isAeView) {
            var noteVal = mockup[slot.noteKey] || '';
            if (!noteVal) return null;
            var disp = document.createElement('div');
            disp.className = 'pmd-mockup-note-display';
            disp.textContent = noteVal;
            return disp;
        }

        // Ruth/artist view: editable input
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'pmd-mockup-note-input';
        input.dataset.noteKey = slot.noteKey;
        input.value = mockup[slot.noteKey] || '';
        input.maxLength = 255;
        input.placeholder = 'Add note (e.g. Resized, Changed color)';
        input.addEventListener('blur', function () {
            saveMockupNote(slot.noteKey, input.value);
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        });
        input.addEventListener('click', function (e) { e.stopPropagation(); });
        input.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        return input;
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

        // Check if any of slots 4-6 have content
        var hasExtraSlots = mockup.Box_Mockup_4 || mockup.Box_Mockup_5 || mockup.Box_Mockup_6;
        var extraSlotKeys = ['Box_Mockup_4', 'Box_Mockup_5', 'Box_Mockup_6'];
        var extraSlotsExpanded = hasExtraSlots; // Auto-expand if any have content

        // Create toggle button for extra slots (Ruth/default view only, not customer)
        var extraToggle = null;
        var extraContainer = null;
        if (!isCustomerView) {
            extraContainer = document.createElement('div');
            extraContainer.className = 'pmd-extra-slots-container';
            extraContainer.style.display = extraSlotsExpanded ? '' : 'none';

            extraToggle = document.createElement('button');
            extraToggle.className = 'pmd-extra-slots-toggle';
            extraToggle.innerHTML = (extraSlotsExpanded ? '<i class="fas fa-chevron-up"></i> Hide Extra Mockups' : '<i class="fas fa-chevron-down"></i> More Mockups (4-6)');
            extraToggle.style.cssText = 'width:100%;padding:0.5rem;margin-top:0.5rem;border:1px dashed #ccc;border-radius:6px;background:#f9f9f9;cursor:pointer;color:#666;font-size:0.85rem;display:flex;align-items:center;justify-content:center;gap:0.4rem;';
            extraToggle.addEventListener('click', function () {
                extraSlotsExpanded = !extraSlotsExpanded;
                extraContainer.style.display = extraSlotsExpanded ? '' : 'none';
                extraToggle.innerHTML = extraSlotsExpanded ? '<i class="fas fa-chevron-up"></i> Hide Extra Mockups' : '<i class="fas fa-chevron-down"></i> More Mockups (4-6)';
            });
        }

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
                } else if (isRefFile && isAeView) {
                    // AE can upload a missing reference file
                    slotEl.innerHTML = '<div class="pmd-slot-empty">'
                        + '<span class="pmd-slot-empty-icon">+</span>'
                        + '<span>Add Reference File</span>'
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
                    var showReplace = isAeView && isRefFile;
                    var showSelectBadge = isCustomerView || (aeCanSelect && !isRefFile);
                    slotEl.innerHTML = '<div class="pmd-slot-filled">'
                        + '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(slot.label) + '" loading="lazy"'
                        + ' onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
                        + '<div class="pmd-file-placeholder" style="display:none;">'
                        + '<span class="pmd-file-ext-badge">' + ext.toUpperCase() + '</span></div>'
                        + '<div class="pmd-slot-label">' + escapeHtml(slot.label) + '</div>'
                        + (showRemove ? '<button type="button" class="pmd-slot-remove" data-field-key="' + slot.key + '">&times;</button>' : '')
                        + (showReplace ? '<button type="button" class="pmd-slot-replace" data-field-key="' + slot.key + '">&#9998; Replace</button>' : '')
                        + (showSelectBadge ? '<div class="pmd-slot-select-badge">' + (isCustomerView ? 'Click to view & select' : 'Click to select') + '</div>' : '')
                        + '<button type="button" class="pmd-slot-download" data-download-url="' + escapeHtml(url) + '" data-download-name="' + escapeHtml(slot.label) + '">'
                        + '<svg viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
                        + '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>'
                        + '<polyline points="7 10 12 15 17 10"></polyline>'
                        + '<line x1="12" y1="15" x2="12" y2="3"></line>'
                        + '</svg>' + (isCustomerView ? '<span>Download</span>' : '') + '</button>'
                        + '</div>';

                    // Revision badge on filled mockup slots
                    if (statusLower === 'revisionrequested' && !isRefFile) {
                        var revBadge = document.createElement('div');
                        revBadge.className = 'pmd-slot-revision-badge';
                        revBadge.textContent = 'Needs Update';
                        slotEl.appendChild(revBadge);
                    }

                    // Version badge (only if more than 1 version exists for this slot)
                    var slotVersions = mockupVersions.filter(function (v) { return v.Slot_Key === slot.key; });
                    if (slotVersions.length > 1) {
                        var currentVer = slotVersions[0]; // sorted desc by API
                        var vBadge = document.createElement('div');
                        vBadge.className = 'pmd-slot-version-badge';
                        vBadge.textContent = 'v' + currentVer.Version_Number;
                        vBadge.title = slotVersions.length + ' versions';
                        // Shift left if remove button exists to avoid overlap
                        if (showRemove) vBadge.style.right = '28px';
                        slotEl.appendChild(vBadge);

                        vBadge.addEventListener('click', function (e) {
                            e.stopPropagation();
                            toggleVersionDropdown(slotEl, slotVersions);
                        });
                    }

                    if (isCustomerView) {
                        // Customer view: click to select (single) AND open lightbox for full-size view
                        (function (slotKey, el, imgUrl, imgLabel) {
                            el.addEventListener('click', function (e) {
                                if (e.target.closest('.pmd-slot-download')) return; // let download handle itself
                                grid.querySelectorAll('.pmd-gallery-slot').forEach(function (s) { s.classList.remove('pmd-slot-selected'); });
                                el.classList.add('pmd-slot-selected');
                                selectedMockupSlots = [slotKey];
                                var approveBtn = document.getElementById('pmd-btn-customer-approve');
                                if (approveBtn) approveBtn.disabled = false;
                                openLightbox(imgUrl, imgLabel);
                            });
                        })(slot.key, slotEl, url, slot.label);
                    } else if (aeCanSelect && !isRefFile) {
                        // AE view: click to toggle mockup selection (multi-select)
                        (function (slotKey, el) {
                            el.addEventListener('click', function (e) {
                                if (e.target.closest('.pmd-slot-remove')) return;
                                var idx = selectedMockupSlots.indexOf(slotKey);
                                if (idx !== -1) {
                                    // Deselect
                                    selectedMockupSlots.splice(idx, 1);
                                    el.classList.remove('pmd-slot-selected');
                                } else {
                                    // Select
                                    selectedMockupSlots.push(slotKey);
                                    el.classList.add('pmd-slot-selected');
                                }
                                var approveBtn = document.getElementById('pmd-btn-approve');
                                if (approveBtn) approveBtn.disabled = (selectedMockupSlots.length === 0);
                            });
                        })(slot.key, slotEl);
                    } else {
                        slotEl.addEventListener('click', function (e) {
                            if (e.target.closest('.pmd-slot-remove') || e.target.closest('.pmd-slot-replace') || e.target.closest('.pmd-slot-version-badge') || e.target.closest('.pmd-version-dropdown') || e.target.closest('.pmd-slot-download')) return;
                            openLightbox(url, slot.label);
                        });
                    }
                } else {
                    var showRemoveNonImg = !isAeView && !isCustomerView;
                    var showReplaceNonImg = isAeView && isRefFile;
                    slotEl.innerHTML = '<div class="pmd-slot-filled">'
                        + '<div class="pmd-file-placeholder">'
                        + '<span class="pmd-file-ext-badge">' + ext.toUpperCase() + '</span>'
                        + '<span style="font-size:12px;color:#666;">' + escapeHtml(slot.label) + '</span>'
                        + '</div>'
                        + '<div class="pmd-slot-label">' + escapeHtml(slot.label) + '</div>'
                        + (showRemoveNonImg ? '<button type="button" class="pmd-slot-remove" data-field-key="' + slot.key + '">&times;</button>' : '')
                        + (showReplaceNonImg ? '<button type="button" class="pmd-slot-replace" data-field-key="' + slot.key + '">&#9998; Replace</button>' : '')
                        + '<button type="button" class="pmd-slot-download" data-download-url="' + escapeHtml(url) + '" data-download-name="' + escapeHtml(slot.label) + '">'
                        + '<svg viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
                        + '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>'
                        + '<polyline points="7 10 12 15 17 10"></polyline>'
                        + '<line x1="12" y1="15" x2="12" y2="3"></line>'
                        + '</svg></button>'
                        + '</div>';
                    // Version badge for non-image slots
                    var slotVersionsNI = mockupVersions.filter(function (v) { return v.Slot_Key === slot.key; });
                    if (slotVersionsNI.length > 1) {
                        var currentVerNI = slotVersionsNI[0];
                        var vBadgeNI = document.createElement('div');
                        vBadgeNI.className = 'pmd-slot-version-badge';
                        vBadgeNI.textContent = 'v' + currentVerNI.Version_Number;
                        vBadgeNI.title = slotVersionsNI.length + ' versions';
                        if (showRemoveNonImg) vBadgeNI.style.right = '28px';
                        slotEl.appendChild(vBadgeNI);

                        vBadgeNI.addEventListener('click', function (e) {
                            e.stopPropagation();
                            toggleVersionDropdown(slotEl, slotVersionsNI);
                        });
                    }

                    slotEl.addEventListener('click', function (e) {
                        if (e.target.closest('.pmd-slot-remove') || e.target.closest('.pmd-slot-replace') || e.target.closest('.pmd-slot-version-badge') || e.target.closest('.pmd-version-dropdown') || e.target.closest('.pmd-slot-download')) return;
                        window.open(url, '_blank');
                    });
                }
            }

            // Add per-slot thread swatch strip container (filled later by renderAllSlotSwatches)
            if (!isRefFile) {
                var slotIdx = slot.key.replace('Box_Mockup_', '');
                slotEl.dataset.slotNumber = slotIdx;
                // Container div for thread dots (populated after EMB records load)
                var threadStripId = 'pmd-slot-threads-' + slotIdx;
                var threadStrip = document.createElement('div');
                threadStrip.className = 'pmd-slot-threads';
                threadStrip.id = threadStripId;
                threadStrip.dataset.slot = slotIdx;
                threadStrip.style.display = 'none'; // hidden until data loads
                slotEl.appendChild(threadStrip);
            }

            // Wrap slot with optional note input
            var noteInput = createMockupNoteInput(slot, mockup);
            var wrapper;
            if (noteInput) {
                wrapper = document.createElement('div');
                wrapper.className = 'pmd-mockup-slot-wrapper';
                wrapper.appendChild(slotEl);
                wrapper.appendChild(noteInput);
            } else {
                wrapper = slotEl;
            }

            // Route slots 4-6 to the collapsible extra container
            if (extraContainer && extraSlotKeys.indexOf(slot.key) !== -1) {
                extraContainer.appendChild(wrapper);
            } else {
                grid.appendChild(wrapper);
            }
        });

        // Add toggle + extra slots container to grid (after main slots, before reference)
        if (extraToggle && extraContainer) {
            grid.appendChild(extraToggle);
            grid.appendChild(extraContainer);
        }

        // Auto-select filled mockup slots for AE view
        if (aeCanSelect) {
            var filledSlots = grid.querySelectorAll('.pmd-gallery-slot .pmd-slot-filled img');
            filledSlots.forEach(function (img) {
                var slotEl = img.closest('.pmd-gallery-slot');
                if (slotEl) {
                    var slotKey = null;
                    MOCKUP_SLOTS.forEach(function (s) {
                        if (slotEl.querySelector('[data-field-key="' + s.key + '"]') ||
                            slotEl.querySelector('.pmd-slot-label') && slotEl.querySelector('.pmd-slot-label').textContent === s.label) {
                            slotKey = s.key;
                        }
                    });
                    // Match by slot label text
                    if (!slotKey) {
                        var labelEl = slotEl.querySelector('.pmd-slot-label');
                        if (labelEl) {
                            MOCKUP_SLOTS.forEach(function (s) {
                                if (s.label === labelEl.textContent.trim()) slotKey = s.key;
                            });
                        }
                    }
                    if (slotKey && selectedMockupSlots.indexOf(slotKey) === -1) {
                        selectedMockupSlots.push(slotKey);
                        slotEl.classList.add('pmd-slot-selected');
                    }
                }
            });
            var approveBtn = document.getElementById('pmd-btn-approve');
            if (approveBtn) approveBtn.disabled = (selectedMockupSlots.length === 0);
        }

        // Thread editor container (below grid, one shared panel)
        var existingEditor = document.getElementById('pmd-thread-editor-container');
        if (!existingEditor) {
            var editorContainer = document.createElement('div');
            editorContainer.className = 'pmd-thread-editor-container';
            editorContainer.id = 'pmd-thread-editor-container';
            editorContainer.style.display = 'none';
            grid.parentNode.appendChild(editorContainer);
        }

        // Wire remove buttons
        grid.querySelectorAll('.pmd-slot-remove').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var fieldKey = btn.dataset.fieldKey;
                if (!confirm('Remove this file?')) return;
                removeSlotFile(fieldKey);
            });
        });

        // Wire download buttons
        grid.querySelectorAll('.pmd-slot-download').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var dlUrl = btn.dataset.downloadUrl;
                var dlName = btn.dataset.downloadName;
                if (dlUrl) downloadImage(dlUrl, dlName);
            });
        });

        // Wire drag-and-drop on gallery slots (Ruth view only)
        if (!isAeView && !isCustomerView) {
            grid.querySelectorAll('.pmd-gallery-slot').forEach(function (slotEl) {
                var fieldKey = slotEl.dataset.fieldKey;
                var slotUrl = mockup[fieldKey];
                var slotIsEmpty = !slotUrl || !slotUrl.trim();

                if (!slotIsEmpty) {
                    // Filled slot: make draggable (drag to Box panel to unassign)
                    slotEl.draggable = true;
                    slotEl.addEventListener('dragstart', function (e) {
                        dragSource = { type: 'slot', slotKey: fieldKey };
                        slotEl.classList.add('dragging');
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', 'slot:' + fieldKey);
                    });
                    slotEl.addEventListener('dragend', function () {
                        slotEl.classList.remove('dragging');
                        dragSource = null;
                        clearAllDropHighlights();
                    });
                }

                // All slots accept drops from Box panel
                slotEl.addEventListener('dragover', function (e) {
                    if (!dragSource || dragSource.type !== 'box') return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    slotEl.classList.add('drag-over');
                });
                slotEl.addEventListener('dragleave', function () {
                    slotEl.classList.remove('drag-over');
                });
                slotEl.addEventListener('drop', function (e) {
                    e.preventDefault();
                    slotEl.classList.remove('drag-over');
                    if (!dragSource || dragSource.type !== 'box') return;
                    handleBoxToSlotDrop(dragSource.fileId, dragSource.fileName, fieldKey);
                });
            });
        }
    }

    // ── Remove Slot File ───────────────────────────────────────────────────
    function removeSlotFile(fieldKey) {
        var updateBody = {};
        updateBody[fieldKey] = '';
        // Also clear associated mockup note
        var slotWithNote = MOCKUP_SLOTS.find(function (s) { return s.key === fieldKey; });
        if (slotWithNote && slotWithNote.noteKey) {
            updateBody[slotWithNote.noteKey] = '';
        }

        fetch(API_BASE + '/api/mockups/' + mockupId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateBody)
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Failed to remove file');
            currentMockup[fieldKey] = '';
            if (slotWithNote && slotWithNote.noteKey) currentMockup[slotWithNote.noteKey] = '';
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

        // Replace button — AE replaces reference file on filled slot
        document.addEventListener('click', function (e) {
            var replaceBtn = e.target.closest('.pmd-slot-replace');
            if (replaceBtn) {
                e.stopPropagation();
                var fieldKey = replaceBtn.dataset.fieldKey;
                var slotEl = replaceBtn.closest('.pmd-gallery-slot');
                showSlotPopover(slotEl, fieldKey);
            }
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
            refreshVersionsThenRender();
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
                refreshVersionsThenRender();
                showToast('File linked from Box', 'success');
                sendUploadNotification(activeSlotKey, selectedBoxFile.name);

                // Insert version record (fire-and-forget)
                fetch(API_BASE + '/api/mockup-versions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        Mockup_ID: parseInt(mockupId),
                        Slot_Key: activeSlotKey,
                        File_URL: fileUrl,
                        File_Name: selectedBoxFile.name || '',
                        Box_File_ID: String(selectedBoxFile.id || ''),
                        Uploaded_By: 'Ruth'
                    })
                }).catch(function (err) {
                    console.error('Version tracking failed:', err);
                });

                // Add note then refresh to show it
                fetch(API_BASE + '/api/mockup-notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        Mockup_ID: parseInt(mockupId),
                        Author: getLoggedInUser().email,
                        Author_Name: getLoggedInUser().firstName,
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
    function buildGarmentDisplayValue(mockup) {
        var parts = [];
        for (var i = 1; i <= 4; i++) {
            var style = mockup['Garment_Style_' + i];
            var color = mockup['Garment_Color_' + i];
            if (style || color) {
                parts.push((style || '') + (style && color ? ' / ' : '') + (color || ''));
            }
        }
        if (parts.length > 0) return parts.join(', ');
        return mockup.Garment_Info || '';
    }

    function renderInfoFields(mockup) {
        var container = document.getElementById('pmd-info-fields');
        if (!container) return;

        var fields;
        // Build logo dimensions display string
        var logoDimensions = '';
        if (mockup.Logo_Width && mockup.Logo_Height) {
            logoDimensions = mockup.Logo_Width + ' x ' + mockup.Logo_Height;
        } else if (mockup.Logo_Width) {
            logoDimensions = mockup.Logo_Width + ' wide';
        } else if (mockup.Logo_Height) {
            logoDimensions = mockup.Logo_Height + ' tall';
        }

        if (isCustomerView) {
            // Customer sees expanded info
            fields = [
                { label: 'Design #', value: mockup.Design_Number },
                { label: 'Design Name', value: mockup.Design_Name },
                { label: 'Company', value: mockup.Company_Name },
                { label: 'Application', value: mockup.Mockup_Type },
                { label: 'Placement', value: mockup.Print_Location },
                { label: 'Logo Dimensions', value: logoDimensions },
                { label: 'Design Size', value: mockup.Design_Size },
                { label: 'Work Order', value: mockup.Work_Order_Number },
                { label: 'Size Specs', value: mockup.Size_Specs },
                { label: 'Your Rep', value: getAeDisplayName(mockup.Submitted_By) }
            ];
        } else {
            fields = [
                { label: 'Design #', value: mockup.Design_Number },
                { label: 'Design Name', value: mockup.Design_Name },
                { label: 'Company', value: mockup.Company_Name },
                { label: 'Application', value: mockup.Mockup_Type },
                { label: 'Garment', value: buildGarmentDisplayValue(mockup) },
                { label: 'Placement', value: mockup.Print_Location },
                { label: 'Logo Dimensions', value: logoDimensions },
                { label: 'Design Size', value: mockup.Design_Size },
                { label: 'Thread Colors', value: mockup.Thread_Colors },
                { label: 'Size Specs', value: mockup.Size_Specs },
                { label: 'Submitted By', value: getAeDisplayName(mockup.Submitted_By) },
                { label: 'Submitted', value: formatDate(mockup.Submitted_Date) },
                { label: 'Due Date', value: formatDate(mockup.Due_Date) },
                { label: 'Work Order', value: mockup.Work_Order_Number, id: 'pmd-wo-value' },
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
                var idAttr = f.id ? ' id="' + f.id + '"' : '';
                return '<div class="pmd-field-row">'
                    + '<span class="pmd-field-label">' + escapeHtml(f.label) + '</span>'
                    + '<span class="pmd-field-value"' + idAttr + '>' + escapeHtml(f.value) + '</span>'
                    + '</div>';
            }).join('');

        // Add "Find Order" button if no Work Order Number and not customer view
        if (!mockup.Work_Order_Number && !isCustomerView) {
            container.innerHTML += '<div class="pmd-field-row">'
                + '<span class="pmd-field-label">Work Order</span>'
                + '<span class="pmd-field-value" id="pmd-wo-value">'
                + '<button type="button" class="pmd-find-order-btn" id="pmd-find-order-btn">Find Order</button>'
                + '</span></div>';
        }

        // Show AE Notes if present (not for customer view)
        if (mockup.AE_Notes && !isCustomerView) {
            container.innerHTML += '<div class="pmd-field-row" style="flex-direction:column;gap:4px;">'
                + '<span class="pmd-field-label">AE Instructions</span>'
                + '<span class="pmd-field-value" style="white-space:pre-wrap;">' + escapeHtml(mockup.AE_Notes) + '</span>'
                + '</div>';
        }

        // Ruth's view: editable Logo Width, Logo Height, Thread Colors + EMB Upload
        if (!isAeView && !isCustomerView) {
            container.innerHTML += '<div class="pmd-editable-section">'
                + '<div class="pmd-editable-header">Ruth\'s Fields</div>'
                + '<div class="pmd-emb-upload-row">'
                + '  <button type="button" class="pmd-emb-upload-btn" id="pmd-emb-upload-btn">'
                + '    <span class="pmd-emb-btn-text">\u2B06 Upload EMB File</span>'
                + '    <span class="pmd-emb-spinner"></span>'
                + '  </button>'
                + '  <input type="file" accept=".emb" id="pmd-emb-file-input" style="display:none;">'
                + '  <span class="pmd-emb-filename" id="pmd-emb-filename"></span>'
                + '</div>'
                + '<div class="pmd-dst-upload-row">'
                + '  <button type="button" class="pmd-dst-upload-btn" id="pmd-dst-upload-btn">'
                + '    <span class="pmd-dst-btn-text">\u2B06 Upload DST File</span>'
                + '    <span class="pmd-dst-spinner"></span>'
                + '  </button>'
                + '  <input type="file" accept=".dst" id="pmd-dst-file-input" style="display:none;">'
                + '  <span class="pmd-dst-filename" id="pmd-dst-filename"></span>'
                + '</div>'
                + '<div class="pmd-emb-results" id="pmd-emb-results"></div>'
                + '<div class="pmd-field-row pmd-field-row--editable">'
                + '  <span class="pmd-field-label">Logo Width</span>'
                + '  <input type="text" class="pmd-inline-input" id="pmd-logo-width" placeholder="e.g. 4" value="' + escapeHtml(mockup.Logo_Width || '') + '">'
                + '</div>'
                + '<div class="pmd-field-row pmd-field-row--editable">'
                + '  <span class="pmd-field-label">Logo Height</span>'
                + '  <input type="text" class="pmd-inline-input" id="pmd-logo-height" placeholder="e.g. 3.5" value="' + escapeHtml(mockup.Logo_Height || '') + '">'
                + '</div>'
                + '<div class="pmd-field-row pmd-field-row--editable" style="flex-direction:column;gap:4px;">'
                + '  <span class="pmd-field-label">Thread Colors</span>'
                + '  <div class="pmd-thread-input-wrapper">'
                + '    <input type="text" class="pmd-inline-input pmd-thread-input" id="pmd-thread-colors" placeholder="Type to search colors..." value="' + escapeHtml(mockup.Thread_Colors || '') + '">'
                + '    <div class="pmd-thread-suggestions" id="pmd-thread-suggestions"></div>'
                + '  </div>'
                + '</div>'
                + '<div class="pmd-thread-swatches" id="pmd-thread-swatches"></div>'
                + '<button type="button" class="pmd-print-thread-sheet-btn" id="pmd-print-thread-sheet-btn" style="display:none;">\uD83D\uDDA8\uFE0F Print Thread Sheet</button>'
                + '</div>';

            // Auto-save on blur for width/height
            var widthInput = document.getElementById('pmd-logo-width');
            var heightInput = document.getElementById('pmd-logo-height');
            var threadInput = document.getElementById('pmd-thread-colors');

            if (widthInput) {
                widthInput.addEventListener('blur', function () {
                    saveInlineField('Logo_Width', this.value.trim(), this);
                });
            }
            if (heightInput) {
                heightInput.addEventListener('blur', function () {
                    saveInlineField('Logo_Height', this.value.trim(), this);
                });
            }
            if (threadInput) {
                threadInput.addEventListener('blur', function () {
                    // Delay to allow suggestion click
                    var input = this;
                    setTimeout(function () {
                        saveInlineField('Thread_Colors', input.value.trim(), input);
                    }, 200);
                });
                initThreadColorAutocomplete(threadInput);
            }

            // EMB Upload button
            var embUploadBtn = document.getElementById('pmd-emb-upload-btn');
            var embFileInput = document.getElementById('pmd-emb-file-input');
            if (embUploadBtn && embFileInput) {
                embUploadBtn.addEventListener('click', function () { embFileInput.click(); });
                embFileInput.addEventListener('change', function () {
                    if (this.files.length) handleEmbUpload(this.files[0]);
                    this.value = ''; // reset for re-upload
                });
            }

            // DST Upload button
            var dstUploadBtn = document.getElementById('pmd-dst-upload-btn');
            var dstFileInput = document.getElementById('pmd-dst-file-input');
            if (dstUploadBtn && dstFileInput) {
                dstUploadBtn.addEventListener('click', function () { dstFileInput.click(); });
                dstFileInput.addEventListener('change', function () {
                    if (this.files.length) handleDstUpload(this.files[0]);
                    this.value = '';
                });
            }

            // Print Thread Sheet button
            var printSheetBtn = document.getElementById('pmd-print-thread-sheet-btn');
            if (printSheetBtn) {
                printSheetBtn.addEventListener('click', generateThreadSheet);
            }
        }
    }

    // ── Inline Field Save ────────────────────────────────────────────────
    function saveInlineField(fieldName, value, inputEl) {
        var updateData = {};
        updateData[fieldName] = value;
        fetch(API_BASE + '/api/mockups/' + mockupId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Save failed');
            if (inputEl) {
                inputEl.classList.add('pmd-inline-saved');
                setTimeout(function () { inputEl.classList.remove('pmd-inline-saved'); }, 1500);
            }
            // Update local state
            if (currentMockup) currentMockup[fieldName] = value;
        }).catch(function (err) {
            showToast('Failed to save: ' + err.message, 'error');
        });
    }

    // ── Thread Color Autocomplete ────────────────────────────────────────
    var threadColorCache = null;
    function initThreadColorAutocomplete(input) {
        var suggestionsEl = document.getElementById('pmd-thread-suggestions');
        if (!suggestionsEl) return;

        // Fetch thread colors once
        function getThreadColors() {
            if (threadColorCache) return Promise.resolve(threadColorCache);
            return fetch(API_BASE + '/api/thread-colors?instock=true')
                .then(function (r) { return r.ok ? r.json() : { Result: [] }; })
                .then(function (data) {
                    threadColorCache = (data.Result || data.result || data || []).map(function (c) {
                        return c.Thread_Color || c.thread_color || '';
                    }).filter(Boolean);
                    return threadColorCache;
                }).catch(function () { return []; });
        }

        input.addEventListener('input', function () {
            var val = this.value;
            // Get the last color being typed (after last comma)
            var parts = val.split(',');
            var currentTyping = parts[parts.length - 1].trim().toLowerCase();

            if (currentTyping.length < 1) {
                suggestionsEl.style.display = 'none';
                return;
            }

            getThreadColors().then(function (colors) {
                // Filter already-entered colors
                var entered = parts.slice(0, -1).map(function (p) { return p.trim().toLowerCase(); });
                var matches = colors.filter(function (c) {
                    return c.toLowerCase().indexOf(currentTyping) !== -1
                        && entered.indexOf(c.toLowerCase()) === -1;
                }).slice(0, 8);

                if (matches.length === 0) {
                    suggestionsEl.style.display = 'none';
                    return;
                }

                suggestionsEl.innerHTML = matches.map(function (m) {
                    return '<div class="pmd-thread-suggestion">' + escapeHtml(m) + '</div>';
                }).join('');
                suggestionsEl.style.display = 'block';

                // Click handler for suggestions
                suggestionsEl.querySelectorAll('.pmd-thread-suggestion').forEach(function (el) {
                    el.addEventListener('mousedown', function (e) {
                        e.preventDefault();
                        var selected = this.textContent;
                        // Replace current typing with selected color
                        parts[parts.length - 1] = ' ' + selected;
                        input.value = parts.join(',').replace(/^,\s*/, '').replace(/,\s*,/g, ',') + ', ';
                        suggestionsEl.style.display = 'none';
                        input.focus();
                    });
                });
            });
        });

        // Hide suggestions on blur
        input.addEventListener('blur', function () {
            setTimeout(function () { suggestionsEl.style.display = 'none'; }, 300);
        });
    }

    // ── EMB Upload Handler ────────────────────────────────────────────────
    function handleEmbUpload(file) {
        // Validate file
        var ext = (file.name || '').split('.').pop().toLowerCase();
        if (ext !== 'emb') {
            showToast('Please select an .emb file', 'error');
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            showToast('File too large (max 20 MB)', 'error');
            return;
        }

        var btn = document.getElementById('pmd-emb-upload-btn');
        var filenameEl = document.getElementById('pmd-emb-filename');
        if (btn) btn.classList.add('loading');
        if (btn) btn.disabled = true;
        if (filenameEl) filenameEl.textContent = file.name;

        var formData = new FormData();
        formData.append('file', file);

        fetch(INKSOFT_API + '/api/embroidery/parse-emb-full', {
            method: 'POST',
            body: formData
        })
        .then(function (resp) {
            if (!resp.ok) return resp.json().then(function (d) { throw new Error(d.error || 'Parse failed'); });
            return resp.json();
        })
        .then(function (data) {
            if (!data.success) throw new Error(data.error || 'Parse failed');

            var threads = data.threads || [];
            var threadDetail = data.thread_detail || [];
            var resultsEl = document.getElementById('pmd-emb-results');

            // Merge per-run stitch counts from thread_detail into threads
            if (threadDetail.length > 0 && threads.length > 0) {
                threads.forEach(function (t, i) {
                    var detail = threadDetail[i];
                    if (detail) {
                        t.stitches = detail.stitches;
                        t.thread_length = detail.thread_length;
                        // Use OLE hex if available (more accurate)
                        if (detail.hex) t.hex = detail.hex;
                    }
                });
            }

            // Build results panel HTML
            var html = '<div class="pmd-emb-results-header">';
            if (data.image_base64) {
                html += '<img class="pmd-emb-preview" src="data:image/jpeg;base64,' + data.image_base64 + '" alt="EMB Preview">';
            }
            html += '<div class="pmd-emb-stats">';
            html += '<div><span class="pmd-emb-stat-label">Threads:</span> ' + threads.length + ' runs</div>';
            if (data.dimensions_available) {
                html += '<div><span class="pmd-emb-stat-label">Size:</span> '
                    + data.width_inches + '&Prime; &times; ' + data.height_inches + '&Prime;</div>';
            }
            if (data.stitch_count) {
                html += '<div><span class="pmd-emb-stat-label">Stitches:</span> '
                    + Number(data.stitch_count).toLocaleString() + '</div>';
            }
            if (data.hoop_width_mm && data.hoop_height_mm) {
                html += '<div><span class="pmd-emb-stat-label">Hoop:</span> '
                    + data.hoop_width_mm + ' &times; ' + data.hoop_height_mm + ' mm</div>';
            }
            if (data.design_number) {
                html += '<div><span class="pmd-emb-stat-label">Design #:</span> ' + escapeHtml(data.design_number) + '</div>';
            }
            if (data.colorway_name) {
                html += '<div><span class="pmd-emb-stat-label">Colorway:</span> ' + escapeHtml(data.colorway_name) + '</div>';
            }
            html += '</div></div>';

            if (resultsEl) {
                resultsEl.innerHTML = html;
                resultsEl.classList.add('active');
            }

            // Auto-fill Logo Width & Height
            if (data.dimensions_available) {
                var widthInput = document.getElementById('pmd-logo-width');
                var heightInput = document.getElementById('pmd-logo-height');
                if (widthInput) {
                    widthInput.value = data.width_inches;
                    saveInlineField('Logo_Width', String(data.width_inches), widthInput);
                }
                if (heightInput) {
                    heightInput.value = data.height_inches;
                    saveInlineField('Logo_Height', String(data.height_inches), heightInput);
                }
            } else {
                showToast('Dimensions not available from this EMB file — enter manually', 'info');
            }

            // Auto-fill Thread Colors (comma-separated names)
            if (threads.length > 0) {
                var colorNames = threads.map(function (t) { return t.name; }).join(', ');
                var threadInput = document.getElementById('pmd-thread-colors');
                if (threadInput) {
                    threadInput.value = colorNames;
                    saveInlineField('Thread_Colors', colorNames, threadInput);
                }
                renderThreadSwatches(threads);
            }

            // Save additional EMB metadata to Caspio (Stitch_Count, Color_Changes if fields exist)
            if (data.stitch_count) {
                saveInlineField('Stitch_Count', String(data.stitch_count));
            }
            if (data.color_changes != null) {
                saveInlineField('Color_Changes', String(data.color_changes));
            }

            var toastParts = [threads.length + ' threads'];
            if (data.dimensions_available) toastParts.push(data.width_inches + '" × ' + data.height_inches + '"');
            if (data.stitch_count) toastParts.push(Number(data.stitch_count).toLocaleString() + ' stitches');
            if (data.application_type) toastParts.push(data.application_type);
            showToast('EMB parsed: ' + toastParts.join(', '), 'success');

            // Upload EMB to Box then save record to Caspio (non-blocking)
            uploadEmbToBox(file, data, threads);
        })
        .catch(function (err) {
            showToast('Failed to parse EMB: ' + err.message, 'error');
        })
        .finally(function () {
            if (btn) btn.classList.remove('loading');
            if (btn) btn.disabled = false;
        });
    }

    function uploadEmbToBox(file, parsedData, threads) {
        var boxFileId = '';

        // Step 1: Upload to Box (if folder exists)
        var boxPromise;
        if (currentMockup && currentMockup.Box_Folder_ID) {
            var company = currentMockup.Company_Name || 'Unknown';
            var designNum = currentMockup.Design_Number || currentMockup.PK_ID || '';
            var shortCompany = company.substring(0, 30).trim();
            var boxFileName = (shortCompany + ' EMB ' + designNum + '.emb').replace(/[<>:"/\\|?*]/g, '');

            var formData = new FormData();
            formData.append('file', file);
            formData.append('folderId', currentMockup.Box_Folder_ID);
            formData.append('fileName', boxFileName);

            boxPromise = fetch(API_BASE + '/api/box/upload-to-folder', {
                method: 'POST',
                body: formData
            })
            .then(function (resp) {
                if (!resp.ok) throw new Error('Box upload failed');
                return resp.json();
            })
            .then(function (boxData) {
                if (boxData.success) {
                    boxFileId = boxData.fileId || '';
                    showToast('EMB saved to Box: ' + boxData.fileName, 'success');
                    if (currentMockup.Box_Folder_ID) {
                        loadBoxPanelFiles(currentMockup.Box_Folder_ID);
                    }
                }
                return boxFileId;
            })
            .catch(function (err) {
                showToast('Box upload failed: ' + err.message, 'error');
                return '';
            });
        } else {
            showToast('No Box folder for this mockup — EMB not uploaded to Box', 'info');
            boxPromise = Promise.resolve('');
        }

        // Step 2: Save EMB record to Caspio (after Box upload completes)
        // Smart sync: check for existing record first → UPDATE if exists, CREATE if new
        boxPromise.then(function (resolvedBoxFileId) {
            if (!currentMockup) return;

            var mockupIdVal = currentMockup.PK_ID || currentMockup.ID;

            // Calculate total thread length
            var totalThreadLength = 0;
            if (threads && threads.length > 0) {
                threads.forEach(function (t) {
                    if (t.thread_length) totalThreadLength += t.thread_length;
                });
                totalThreadLength = Math.round(totalThreadLength / 100000 * 10) / 10; // 0.01mm to meters, 1 decimal
            }

            var record = {
                Mockup_ID: mockupIdVal,
                Mockup_Slot: '1',
                Box_File_ID: resolvedBoxFileId || '',
                File_Name: file.name,
                File_Size_KB: Math.round(file.size / 1024),
                Design_Number: parsedData.design_number || currentMockup.Design_Number || '',
                Colorway_Name: parsedData.colorway_name || 'Colorway 1',
                Is_Primary: 'Yes',
                Application_Type: parsedData.application_type || '',
                Machine_Format: '',
                Source_Format: '',
                Width_MM: parsedData.width_mm || null,
                Height_MM: parsedData.height_mm || null,
                Width_Inches: parsedData.width_inches || null,
                Height_Inches: parsedData.height_inches || null,
                Stitch_Count: parsedData.stitch_count || null,
                Color_Changes: parsedData.color_changes != null ? parsedData.color_changes : null,
                Thread_Count: parsedData.count || (threads ? threads.length : null),
                Hoop_Width_MM: parsedData.hoop_width_mm || null,
                Hoop_Height_MM: parsedData.hoop_height_mm || null,
                Thread_Colors: threads ? threads.map(function (t) { return t.name; }).join(', ') : '',
                Thread_Sequence_JSON: threads ? JSON.stringify(threads) : '',
                Thread_Length_Total_M: totalThreadLength || null,
                Box_Folder_ID: currentMockup.Box_Folder_ID || '',
                Uploaded_By: 'ruth@nwcustomapparel.com'
            };

            // Check for existing primary EMB record for this mockup
            fetch(API_BASE + '/api/emb-designs/by-mockup/' + mockupIdVal)
            .then(function (resp) {
                if (!resp.ok) return { records: [] };
                return resp.json();
            })
            .then(function (existing) {
                var existingPrimary = null;
                if (existing.records && existing.records.length > 0) {
                    // Find existing primary record to update
                    for (var i = 0; i < existing.records.length; i++) {
                        if (existing.records[i].Is_Primary === 'Yes') {
                            existingPrimary = existing.records[i];
                            break;
                        }
                    }
                }

                if (existingPrimary && existingPrimary.ID) {
                    // UPDATE existing record — keeps Caspio in sync with new EMB file
                    record.Upload_Date = new Date().toISOString();
                    return fetch(API_BASE + '/api/emb-designs/' + existingPrimary.ID, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(record)
                    }).then(function (resp) {
                        if (!resp.ok) throw new Error('Caspio update failed');
                        return resp.json();
                    }).then(function (result) {
                        console.log('EMB record updated in Caspio, ID:', existingPrimary.ID);
                        showToast('EMB data updated in database', 'success');
                        loadStoredEmbData(mockupIdVal);
                    });
                } else {
                    // CREATE new record — first EMB for this mockup
                    return fetch(API_BASE + '/api/emb-designs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(record)
                    }).then(function (resp) {
                        if (!resp.ok) throw new Error('Caspio save failed');
                        return resp.json();
                    }).then(function (result) {
                        if (result.success) {
                            console.log('EMB record saved to Caspio, ID:', result.record.ID);
                            showToast('EMB data saved to database', 'success');
                            loadStoredEmbData(mockupIdVal);
                        }
                    });
                }
            })
            .catch(function (err) {
                console.error('Failed to save EMB record to Caspio:', err.message);
                showToast('Warning: EMB file uploaded but database save failed', 'warning');
            });
        });
    }

    // ── DST Upload + AI Vision Elements ──────────────────────────────────

    function handleDstUpload(file) {
        if (!file || !file.name.toLowerCase().endsWith('.dst')) {
            showToast('Please select a .dst file', 'error');
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            showToast('DST file too large (max 20 MB)', 'error');
            return;
        }

        var btn = document.getElementById('pmd-dst-upload-btn');
        var filenameEl = document.getElementById('pmd-dst-filename');
        if (btn) { btn.classList.add('loading'); btn.disabled = true; }
        if (filenameEl) filenameEl.textContent = file.name;

        // Build FormData with DST file + mockup URL for vision context
        var formData = new FormData();
        formData.append('dstFile', file);
        var mockupImgUrl = currentMockup ? currentMockup.Box_Mockup_1 : '';
        if (mockupImgUrl) {
            formData.append('mockup_url', mockupImgUrl);
        }

        showToast('Parsing DST + identifying elements...', 'info');

        fetch(INKSOFT_API + '/api/embroidery/parse-dst-elements', {
            method: 'POST',
            body: formData
        })
        .then(function (resp) {
            if (!resp.ok) throw new Error('DST parse failed (HTTP ' + resp.status + ')');
            return resp.json();
        })
        .then(function (data) {
            if (!data.success) {
                showToast('DST parse failed', 'error');
                return;
            }

            var runCount = data.run_count || 0;
            var stitchCount = data.stitch_count || 0;
            var elements = data.elements || [];

            // Show results toast
            var parts = [runCount + ' thread runs', stitchCount.toLocaleString() + ' stitches'];
            if (elements.length > 0) parts.push('elements identified');
            showToast('DST parsed: ' + parts.join(', '), 'success');

            // Pre-populate thread editor for slot 1 with elements (no colors yet)
            var threads = [];
            for (var i = 0; i < runCount; i++) {
                threads.push({
                    run: i + 1,
                    name: '',
                    hex: '',
                    catalog: '',
                    element: elements[i] || ''
                });
            }

            // Store in editorThreads and open the editor for slot 1
            editorThreads = threads;
            activeThreadEditorSlot = 1;

            // If no existing record for slot 1, create a temporary one
            if (!storedEmbRecords['1']) {
                storedEmbRecords['1'] = {
                    Mockup_ID: currentMockup ? (currentMockup.PK_ID || currentMockup.ID) : mockupId,
                    Mockup_Slot: '1',
                    Thread_Count: runCount,
                    Color_Changes: runCount - 1,
                    Stitch_Count: stitchCount,
                    Thread_Sequence_JSON: JSON.stringify(threads)
                };
            } else {
                // Update existing record with DST data
                storedEmbRecords['1'].Thread_Count = runCount;
                storedEmbRecords['1'].Color_Changes = runCount - 1;
                storedEmbRecords['1'].Stitch_Count = stitchCount;
                storedEmbRecords['1'].Thread_Sequence_JSON = JSON.stringify(threads);
            }

            // Render the editor panel
            var editorContainer = document.getElementById('pmd-thread-editor-container');
            if (editorContainer) {
                editorContainer.style.display = 'block';
                renderThreadEditorPanel(1);
            }

            renderAllSlotSwatches();

            // Upload DST to Box + save reference to Caspio
            uploadDstToBox(file, data);
        })
        .catch(function (err) {
            showToast('DST parse failed: ' + err.message, 'error');
        })
        .finally(function () {
            if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
        });
    }

    function uploadDstToBox(file, parsedData) {
        if (!currentMockup || !currentMockup.Box_Folder_ID) {
            showToast('No Box folder — DST not uploaded to Box', 'info');
            return;
        }

        var company = currentMockup.Company_Name || 'Unknown';
        var designNum = currentMockup.Design_Number || currentMockup.PK_ID || '';
        var shortCompany = company.substring(0, 30).trim();
        var boxFileName = (shortCompany + ' DST ' + designNum + '.dst').replace(/[<>:"/\\|?*]/g, '');

        var formData = new FormData();
        formData.append('file', file);
        formData.append('folderId', currentMockup.Box_Folder_ID);
        formData.append('fileName', boxFileName);

        fetch(API_BASE + '/api/box/upload-to-folder', {
            method: 'POST',
            body: formData
        })
        .then(function (resp) {
            if (!resp.ok) throw new Error('Box upload failed');
            return resp.json();
        })
        .then(function (boxData) {
            if (boxData.success) {
                showToast('DST saved to Box: ' + boxData.fileName, 'success');
                // Save DST reference to Caspio EMB record
                var mockupIdVal = currentMockup.PK_ID || currentMockup.ID;
                var existing = storedEmbRecords['1'];
                var dstFields = {
                    DST_Box_File_ID: boxData.fileId || '',
                    DST_File_Name: file.name,
                    Stitch_Count: parsedData.stitch_count || null,
                    Thread_Count: parsedData.run_count || null,
                    Color_Changes: (parsedData.run_count || 1) - 1
                };

                if (existing && existing.ID) {
                    fetch(API_BASE + '/api/emb-designs/' + existing.ID, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dstFields)
                    }).then(function (r) {
                        if (r.ok) showToast('DST reference saved to database', 'success');
                    });
                } else {
                    dstFields.Mockup_ID = mockupIdVal;
                    dstFields.Mockup_Slot = '1';
                    dstFields.Is_Primary = 'Yes';
                    dstFields.Uploaded_By = 'ruth@nwcustomapparel.com';
                    fetch(API_BASE + '/api/emb-designs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dstFields)
                    }).then(function (r) {
                        if (r.ok) return r.json();
                    }).then(function (result) {
                        if (result && result.success) {
                            showToast('DST data saved to database', 'success');
                            loadStoredEmbData(mockupIdVal);
                        }
                    });
                }

                if (currentMockup.Box_Folder_ID) {
                    loadBoxPanelFiles(currentMockup.Box_Folder_ID);
                }
            }
        })
        .catch(function (err) {
            showToast('DST Box upload failed: ' + err.message, 'error');
        });
    }

    // Apply DST elements from slot 1 to another slot (reuse already-parsed data)
    function applyDstElementsToSlot(slotNumber) {
        var sourceRec = storedEmbRecords['1'];
        if (!sourceRec || !sourceRec.Thread_Sequence_JSON) {
            showToast('No DST data found — upload a DST first', 'error');
            return;
        }
        var sourceThreads = [];
        try { sourceThreads = JSON.parse(sourceRec.Thread_Sequence_JSON); } catch (e) { return; }
        if (sourceThreads.length === 0) {
            showToast('No thread data to apply', 'error');
            return;
        }

        // Copy elements + run structure (keep colors empty so Ruth can pick for this slot)
        var threads = sourceThreads.map(function (t) {
            return {
                run: t.run,
                name: '',
                hex: '',
                catalog: '',
                element: t.element || ''
            };
        });

        editorThreads = threads;
        activeThreadEditorSlot = slotNumber;

        // Create/update the stored record for this slot
        var mockupIdVal = currentMockup ? (currentMockup.PK_ID || currentMockup.ID) : mockupId;
        if (!storedEmbRecords[String(slotNumber)]) {
            storedEmbRecords[String(slotNumber)] = {
                Mockup_ID: mockupIdVal,
                Mockup_Slot: String(slotNumber),
                Thread_Count: sourceRec.Thread_Count,
                Color_Changes: sourceRec.Color_Changes,
                Stitch_Count: sourceRec.Stitch_Count,
                Thread_Sequence_JSON: JSON.stringify(threads)
            };
        } else {
            storedEmbRecords[String(slotNumber)].Thread_Count = sourceRec.Thread_Count;
            storedEmbRecords[String(slotNumber)].Color_Changes = sourceRec.Color_Changes;
            storedEmbRecords[String(slotNumber)].Stitch_Count = sourceRec.Stitch_Count;
            storedEmbRecords[String(slotNumber)].Thread_Sequence_JSON = JSON.stringify(threads);
        }

        // Open editor and render
        var editorContainer = document.getElementById('pmd-thread-editor-container');
        if (editorContainer) {
            editorContainer.style.display = 'block';
            renderThreadEditorPanel(slotNumber);
        }
        renderAllSlotSwatches();
        showToast('DST elements applied to Mockup ' + slotNumber + ' — pick colors for each run', 'success');
    }

    // Fetch DST from Box and run AI vision to generate thread elements
    function generateElementsFromBoxDst(slotNumber, dstBoxFileId, mockupUrl, btnEl) {
        if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Processing...'; }
        showToast('Downloading DST from Box + identifying elements...', 'info');

        // Step 1: Download DST from Box via proxy
        fetch(API_BASE + '/api/box/download/' + dstBoxFileId)
        .then(function (resp) {
            if (!resp.ok) throw new Error('Box download failed (HTTP ' + resp.status + ')');
            return resp.blob();
        })
        .then(function (blob) {
            // Step 2: Send DST blob to parse-dst-elements endpoint
            var formData = new FormData();
            formData.append('dstFile', blob, 'design.dst');
            if (mockupUrl) formData.append('mockup_url', mockupUrl);

            return fetch(INKSOFT_API + '/api/embroidery/parse-dst-elements', {
                method: 'POST',
                body: formData
            });
        })
        .then(function (resp) {
            if (!resp.ok) throw new Error('DST parse failed (HTTP ' + resp.status + ')');
            return resp.json();
        })
        .then(function (data) {
            if (!data.success) throw new Error(data.error || 'Parse failed');

            var runCount = data.run_count || 0;
            var stitchCount = data.stitch_count || 0;
            var elements = data.elements || [];

            showToast('Found ' + runCount + ' thread runs, ' + stitchCount.toLocaleString() + ' stitches', 'success');

            // Pre-populate threads with elements (no colors)
            var threads = [];
            for (var i = 0; i < runCount; i++) {
                threads.push({
                    run: i + 1,
                    name: '',
                    hex: '',
                    catalog: '',
                    element: elements[i] || ''
                });
            }

            // Update stored record
            var rec = storedEmbRecords[String(slotNumber)];
            if (rec) {
                rec.Thread_Count = runCount;
                rec.Color_Changes = runCount - 1;
                rec.Stitch_Count = stitchCount;
                rec.Thread_Sequence_JSON = JSON.stringify(threads);
            }

            // Open thread editor
            editorThreads = threads;
            activeThreadEditorSlot = slotNumber;
            var editorContainer = document.getElementById('pmd-thread-editor-container');
            if (editorContainer) {
                editorContainer.style.display = 'block';
                renderThreadEditorPanel(slotNumber);
            }
            renderAllSlotSwatches();

            // Remove the generate button
            if (btnEl && btnEl.parentNode) btnEl.remove();
        })
        .catch(function (err) {
            showToast('Failed: ' + err.message, 'error');
            if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '&#9881; Generate Thread Elements'; }
        });
    }

    function loadStoredEmbData(mockupIdVal) {
        if (!mockupIdVal) return;

        fetch(API_BASE + '/api/emb-designs/by-mockup/' + mockupIdVal)
        .then(function (resp) {
            if (!resp.ok) return null;
            return resp.json();
        })
        .then(function (data) {
            if (!data || !data.records || data.records.length === 0) return;

            // Distribute records by Mockup_Slot
            storedEmbRecords = {};
            data.records.forEach(function (rec) {
                var slot = rec.Mockup_Slot || '1';
                storedEmbRecords[slot] = rec;
            });

            // Render mini swatch dots on gallery images
            renderAllSlotSwatches();

            // Show "Print Thread Sheet" button if any slot has data
            var printBtn = document.getElementById('pmd-print-thread-sheet-btn');
            if (printBtn) printBtn.style.display = Object.keys(storedEmbRecords).length > 0 ? 'inline-flex' : 'none';

            // Also render sidebar EMB results from primary record (backward compat)
            var primary = data.records[0];
            var resultsEl = document.getElementById('pmd-emb-results');
            var swatchesEl = document.getElementById('pmd-thread-swatches');

            // Only render sidebar if swatches are not already showing (from a fresh upload)
            if (swatchesEl && swatchesEl.classList.contains('active')) return;

            if (resultsEl) {
                var html = '<div class="pmd-emb-results-header">';
                html += '<div class="pmd-emb-stats">';
                if (primary.Thread_Count) {
                    html += '<div><span class="pmd-emb-stat-label">Threads:</span> ' + primary.Thread_Count + ' runs</div>';
                }
                if (primary.Width_Inches && primary.Height_Inches) {
                    html += '<div><span class="pmd-emb-stat-label">Size:</span> '
                        + primary.Width_Inches + '&Prime; &times; ' + primary.Height_Inches + '&Prime;</div>';
                }
                if (primary.Stitch_Count) {
                    html += '<div><span class="pmd-emb-stat-label">Stitches:</span> '
                        + Number(primary.Stitch_Count).toLocaleString() + '</div>';
                }
                if (primary.Hoop_Width_MM && primary.Hoop_Height_MM) {
                    html += '<div><span class="pmd-emb-stat-label">Hoop:</span> '
                        + primary.Hoop_Width_MM + ' &times; ' + primary.Hoop_Height_MM + ' mm</div>';
                }
                if (primary.Design_Number) {
                    html += '<div><span class="pmd-emb-stat-label">Design #:</span> ' + escapeHtml(primary.Design_Number) + '</div>';
                }
                if (primary.Colorway_Name) {
                    html += '<div><span class="pmd-emb-stat-label">Colorway:</span> ' + escapeHtml(primary.Colorway_Name) + '</div>';
                }
                html += '</div></div>';
                resultsEl.innerHTML = html;
                resultsEl.classList.add('active');
            }

            if (primary.Thread_Sequence_JSON) {
                try {
                    var threads = JSON.parse(primary.Thread_Sequence_JSON);
                    if (threads && threads.length > 0) {
                        renderThreadSwatches(threads);
                    }
                } catch (e) {
                    console.warn('Failed to parse stored Thread_Sequence_JSON:', e.message);
                }
            }
        })
        .catch(function (err) {
            console.warn('Could not load stored EMB data:', err.message);
        });
    }

    // ── Per-Slot Thread Swatch Strips + Editor ───────────────────────────

    function renderAllSlotSwatches() {
        for (var s = 1; s <= 3; s++) {
            var strip = document.getElementById('pmd-slot-threads-' + s);
            if (!strip) continue;

            var rec = storedEmbRecords[String(s)];
            if (!rec || !rec.Thread_Sequence_JSON) {
                strip.style.display = 'none';
                // Show "+ Add Threads" button for Ruth view on filled slots
                if (!isAeView && !isCustomerView) {
                    var slotEl = strip.parentElement;
                    var filledDiv = slotEl && slotEl.querySelector('.pmd-slot-filled');
                    if (filledDiv && !slotEl.querySelector('.pmd-add-threads-btn')) {
                        var addBtn = document.createElement('button');
                        addBtn.className = 'pmd-add-threads-btn';
                        addBtn.textContent = '+ Add Threads';
                        addBtn.dataset.slot = String(s);
                        addBtn.addEventListener('click', function (e) {
                            e.stopPropagation();
                            var slotNum = parseInt(e.target.dataset.slot);
                            toggleThreadEditor(slotNum);
                        });
                        slotEl.appendChild(addBtn);
                    }
                }
                continue;
            }

            var threads = [];
            try { threads = JSON.parse(rec.Thread_Sequence_JSON); } catch (e) { /* empty */ }
            if (!threads || threads.length === 0) {
                strip.style.display = 'none';
                // If DST exists in Box but no threads, show "Generate Elements" button
                if (!isAeView && !isCustomerView && rec.DST_Box_File_ID) {
                    var slotEl2 = strip.parentElement;
                    if (slotEl2 && !slotEl2.querySelector('.pmd-generate-elements-btn')) {
                        // Remove "+ Add Threads" if it exists (we have a better option)
                        var existingAdd = slotEl2.querySelector('.pmd-add-threads-btn');
                        if (existingAdd) existingAdd.remove();

                        (function (slotNum, dstBoxId, mockupUrl) {
                            var genBtn = document.createElement('button');
                            genBtn.className = 'pmd-generate-elements-btn';
                            genBtn.innerHTML = '&#9881; Generate Thread Elements';
                            genBtn.dataset.slot = String(slotNum);
                            genBtn.addEventListener('click', function (e) {
                                e.stopPropagation();
                                generateElementsFromBoxDst(slotNum, dstBoxId, mockupUrl, genBtn);
                            });
                            slotEl2.appendChild(genBtn);
                        })(s, rec.DST_Box_File_ID, currentMockup ? currentMockup['Box_Mockup_' + s] || currentMockup.Box_Mockup_1 : '');
                    }
                }
                continue;
            }

            // Customer view: render always-visible inline thread box AFTER the slot
            // (not inside it — .pmd-gallery-slot has overflow:hidden + aspect-ratio:1 which clips children)
            if (isCustomerView) {
                strip.style.display = 'none';
                var slotEl = strip.parentElement; // .pmd-gallery-slot
                var gridEl = slotEl ? slotEl.parentElement : null; // .pmd-gallery-grid

                // Remove any existing inline box for this slot
                if (gridEl) {
                    var existingBox = gridEl.querySelector('.pmd-thread-inline-box[data-slot="' + s + '"]');
                    if (existingBox) existingBox.remove();
                }

                if (slotEl && gridEl) {
                    var hasElements = threads.some(function (t) { return t.element; });
                    var box = document.createElement('div');
                    box.className = 'pmd-thread-inline-box';
                    box.dataset.slot = String(s);

                    var boxTitle = document.createElement('div');
                    boxTitle.className = 'pmd-thread-inline-title';
                    boxTitle.textContent = 'Thread Sequence';
                    box.appendChild(boxTitle);

                    threads.forEach(function (t) {
                        var row = document.createElement('div');
                        row.className = 'pmd-thread-inline-row';

                        var dot = document.createElement('span');
                        dot.className = 'pmd-thread-inline-dot';
                        dot.style.background = t.hex || '#888';
                        row.appendChild(dot);

                        var num = document.createElement('span');
                        num.className = 'pmd-thread-inline-num';
                        num.textContent = t.run || '';
                        row.appendChild(num);

                        var name = document.createElement('span');
                        name.className = 'pmd-thread-inline-name';
                        name.textContent = t.name || '(no color)';
                        row.appendChild(name);

                        if (hasElements && t.element) {
                            var el = document.createElement('span');
                            el.className = 'pmd-thread-inline-element';
                            el.textContent = t.element;
                            row.appendChild(el);
                        }

                        box.appendChild(row);
                    });

                    // Insert AFTER the slot element (as sibling in grid), not inside it
                    gridEl.insertBefore(box, slotEl.nextSibling);
                }
            } else {
                // Ruth/AE view: render mini dots + info button + edit button strip
                strip.innerHTML = '';
                threads.forEach(function (t) {
                    var dot = document.createElement('span');
                    dot.className = 'pmd-mini-dot';
                    dot.style.background = t.hex || '#888';
                    dot.title = 'Run ' + t.run + ': ' + (t.name || '?') + (t.element ? ' \u2014 ' + t.element : '') + (t.catalog ? ' #' + t.catalog : '');
                    strip.appendChild(dot);
                });

                // Info button — click to show thread sequence popover
                (function (slotNum, threadList) {
                    var infoBtn = document.createElement('button');
                    infoBtn.className = 'pmd-thread-info-btn';
                    infoBtn.innerHTML = 'i';
                    infoBtn.title = 'View thread sequence';
                    infoBtn.dataset.slot = String(slotNum);
                    infoBtn.addEventListener('click', function (e) {
                        e.stopPropagation();
                        toggleThreadInfoPopover(infoBtn, threadList, slotNum);
                    });
                    strip.appendChild(infoBtn);
                })(s, threads);

                // Edit button (Ruth view only)
                if (!isAeView) {
                    var editBtn = document.createElement('button');
                    editBtn.className = 'pmd-edit-threads-btn';
                    editBtn.innerHTML = '&#9998;';
                    editBtn.title = 'Edit thread colors';
                    editBtn.dataset.slot = String(s);
                    editBtn.addEventListener('click', function (e) {
                        e.stopPropagation();
                        var slotNum = parseInt(e.target.closest('.pmd-edit-threads-btn').dataset.slot);
                        toggleThreadEditor(slotNum);
                    });
                    strip.appendChild(editBtn);
                }

                strip.style.display = 'flex';
            }

            // Remove "+ Add Threads" button if it exists (we now have data)
            var parent = strip.parentElement;
            var addBtnExisting = parent && parent.querySelector('.pmd-add-threads-btn');
            if (addBtnExisting) addBtnExisting.remove();
        }
    }

    var _threadPopover = null;
    var _threadPopoverSlot = null;

    function toggleThreadInfoPopover(anchorEl, threads, slotNum) {
        // If same slot is already showing, close it
        if (_threadPopover && _threadPopoverSlot === slotNum) {
            closeThreadInfoPopover();
            return;
        }
        closeThreadInfoPopover();
        if (!threads || threads.length === 0) return;

        var pop = document.createElement('div');
        pop.className = 'pmd-thread-popover';
        pop.id = 'pmd-thread-popover';

        // Header with title + close button
        var header = document.createElement('div');
        header.className = 'pmd-thread-popover-header';
        var title = document.createElement('span');
        title.className = 'pmd-thread-popover-title';
        title.textContent = 'Mockup ' + slotNum + ' — Thread Sequence';
        header.appendChild(title);
        var closeBtn = document.createElement('button');
        closeBtn.className = 'pmd-thread-popover-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            closeThreadInfoPopover();
        });
        header.appendChild(closeBtn);
        pop.appendChild(header);

        var hasElements = threads.some(function (t) { return t.element; });

        threads.forEach(function (t) {
            var row = document.createElement('div');
            row.className = 'pmd-thread-popover-row';

            var dot = document.createElement('span');
            dot.className = 'pmd-thread-popover-dot';
            dot.style.background = t.hex || '#888';
            row.appendChild(dot);

            var num = document.createElement('span');
            num.className = 'pmd-thread-popover-num';
            num.textContent = t.run || '';
            row.appendChild(num);

            var name = document.createElement('span');
            name.className = 'pmd-thread-popover-name';
            name.textContent = t.name || '(no color)';
            row.appendChild(name);

            if (hasElements) {
                var el = document.createElement('span');
                el.className = 'pmd-thread-popover-element';
                el.textContent = t.element || '';
                row.appendChild(el);
            }

            var cat = document.createElement('span');
            cat.className = 'pmd-thread-popover-cat';
            cat.textContent = t.catalog || '';
            row.appendChild(cat);

            pop.appendChild(row);
        });

        document.body.appendChild(pop);
        _threadPopover = pop;
        _threadPopoverSlot = slotNum;

        // Position below the anchor button
        var rect = anchorEl.getBoundingClientRect();
        pop.style.left = rect.left + 'px';
        pop.style.top = (rect.bottom + 6) + 'px';

        // Keep within viewport
        requestAnimationFrame(function () {
            var popRect = pop.getBoundingClientRect();
            if (popRect.right > window.innerWidth - 8) {
                pop.style.left = (window.innerWidth - popRect.width - 8) + 'px';
            }
            if (popRect.bottom > window.innerHeight - 8) {
                pop.style.top = (rect.top - popRect.height - 6) + 'px';
            }
        });

        // Click outside to close
        setTimeout(function () {
            document.addEventListener('click', _threadPopoverOutsideClick);
        }, 10);
    }

    function _threadPopoverOutsideClick(e) {
        if (_threadPopover && !_threadPopover.contains(e.target) && !e.target.closest('.pmd-thread-info-btn')) {
            closeThreadInfoPopover();
        }
    }

    function closeThreadInfoPopover() {
        if (_threadPopover) {
            _threadPopover.remove();
            _threadPopover = null;
            _threadPopoverSlot = null;
        }
        document.removeEventListener('click', _threadPopoverOutsideClick);
    }

    function toggleThreadEditor(slotNumber) {
        var container = document.getElementById('pmd-thread-editor-container');
        if (!container) return;

        // If same slot is already open, close it
        if (activeThreadEditorSlot === slotNumber) {
            container.style.display = 'none';
            activeThreadEditorSlot = null;
            editorThreads = [];
            return;
        }

        activeThreadEditorSlot = slotNumber;

        // Load threads from stored record or start empty
        var rec = storedEmbRecords[String(slotNumber)];
        if (rec && rec.Thread_Sequence_JSON) {
            try { editorThreads = JSON.parse(rec.Thread_Sequence_JSON); } catch (e) { editorThreads = []; }
        } else {
            editorThreads = [];
        }

        // Initialize ThreadColorPicker if not already done
        if (typeof ThreadColorPicker !== 'undefined' && !ThreadColorPicker._initialized) {
            ThreadColorPicker.init().then(function () {
                ThreadColorPicker._initialized = true;
            }).catch(function (err) {
                console.warn('ThreadColorPicker init failed:', err.message);
            });
        }

        renderThreadEditorPanel(slotNumber);
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function renderThreadEditorPanel(slotNumber) {
        var container = document.getElementById('pmd-thread-editor-container');
        if (!container) return;

        // Show "Apply DST" button if slot 1 has DST data and this is a different slot with no threads
        var showApplyDst = slotNumber > 1 && editorThreads.length === 0
            && storedEmbRecords['1'] && storedEmbRecords['1'].Thread_Sequence_JSON;

        var html = '<div class="pmd-thread-editor-header">'
            + '<span>Thread Sequence &mdash; Mockup ' + slotNumber + '</span>'
            + '<div>'
            + (showApplyDst ? '<button type="button" id="pmd-te-apply-dst" class="pmd-te-apply-dst-btn">&#128295; Apply DST Elements</button> ' : '')
            + '<button type="button" id="pmd-te-save">Save</button>'
            + ' <button type="button" id="pmd-te-close">&times; Close</button>'
            + '</div></div>';

        // Column headers
        var hasElements = editorThreads.some(function (t) { return t.element; });
        html += '<div class="pmd-thread-editor-col-headers' + (hasElements ? ' pmd-te-has-elements' : '') + '">'
            + '<span>#</span><span></span><span>Color Name</span>'
            + (hasElements ? '<span>Element</span>' : '')
            + '<span></span><span style="text-align:right">Cat#</span>'
            + '</div>';

        // Thread rows
        html += '<div id="pmd-te-rows">';
        if (editorThreads.length === 0) {
            html += '<div style="padding:16px 12px;color:#9ca3af;font-size:0.8rem;text-align:center;">'
                + 'No threads yet. Click "+ Add Run" to start.</div>';
        } else {
            editorThreads.forEach(function (t, idx) {
                html += '<div class="pmd-thread-editor-row' + (hasElements ? ' pmd-te-has-elements' : '') + '" data-run-index="' + idx + '">'
                    + '<span class="pmd-te-run">' + (t.run || (idx + 1)) + '</span>'
                    + '<span class="pmd-te-swatch" style="background:' + escapeHtml(t.hex || '#888') + ';"></span>'
                    + '<span class="pmd-te-name">' + escapeHtml(t.name || 'Click to set') + '</span>'
                    + (hasElements ? '<span class="pmd-te-element">' + escapeHtml(t.element || '') + '</span>' : '')
                    + '<span class="pmd-te-edit-icon">&#9998;</span>'
                    + '<span class="pmd-te-catalog">' + escapeHtml(t.catalog || '') + '</span>'
                    + '</div>';
            });
        }
        html += '</div>';

        // Action buttons
        html += '<div class="pmd-thread-editor-actions">'
            + '<button type="button" id="pmd-te-add-run">+ Add Run</button>'
            + '<button type="button" id="pmd-te-remove-last">Remove Last</button>'
            + '<button type="button" id="pmd-te-save-bottom" class="pmd-te-save-btn">Save Threads</button>'
            + '</div>';

        container.innerHTML = html;

        // Wire events
        container.querySelectorAll('.pmd-thread-editor-row').forEach(function (row) {
            row.addEventListener('click', function () {
                var idx = parseInt(row.dataset.runIndex);
                var current = editorThreads[idx] || { hex: '#888', name: '', catalog: '' };
                if (typeof ThreadColorPicker !== 'undefined') {
                    ThreadColorPicker.open(idx, current, onEditorColorSelected);
                }
            });
        });

        document.getElementById('pmd-te-add-run').addEventListener('click', function () {
            var newRun = { run: editorThreads.length + 1, name: 'Click to set', hex: '#888', catalog: '' };
            editorThreads.push(newRun);
            renderThreadEditorPanel(activeThreadEditorSlot);
            // Open picker immediately for the new run
            if (typeof ThreadColorPicker !== 'undefined') {
                setTimeout(function () {
                    ThreadColorPicker.open(editorThreads.length - 1, newRun, onEditorColorSelected);
                }, 100);
            }
        });

        document.getElementById('pmd-te-remove-last').addEventListener('click', function () {
            if (editorThreads.length > 0) {
                editorThreads.pop();
                renderThreadEditorPanel(activeThreadEditorSlot);
            }
        });

        var saveHandler = function () { saveSlotThreads(activeThreadEditorSlot); };
        document.getElementById('pmd-te-save').addEventListener('click', saveHandler);
        document.getElementById('pmd-te-save-bottom').addEventListener('click', saveHandler);

        document.getElementById('pmd-te-close').addEventListener('click', function () {
            container.style.display = 'none';
            activeThreadEditorSlot = null;
            editorThreads = [];
        });

        // "Apply DST Elements" button (only rendered for slots 2/3 when slot 1 has DST data)
        var applyDstBtn = document.getElementById('pmd-te-apply-dst');
        if (applyDstBtn) {
            applyDstBtn.addEventListener('click', function () {
                applyDstElementsToSlot(activeThreadEditorSlot);
            });
        }
    }

    function onEditorColorSelected(runIndex, newColor) {
        if (runIndex < 0 || runIndex >= editorThreads.length) return;
        editorThreads[runIndex].hex = newColor.hex;
        editorThreads[runIndex].name = newColor.name;
        editorThreads[runIndex].catalog = newColor.catalog;

        // Update DOM immediately
        var rows = document.querySelectorAll('#pmd-te-rows .pmd-thread-editor-row');
        if (rows[runIndex]) {
            var swatch = rows[runIndex].querySelector('.pmd-te-swatch');
            var nameEl = rows[runIndex].querySelector('.pmd-te-name');
            var catEl = rows[runIndex].querySelector('.pmd-te-catalog');
            if (swatch) swatch.style.background = newColor.hex;
            if (nameEl) nameEl.textContent = newColor.name;
            if (catEl) catEl.textContent = newColor.catalog;
        }
    }

    function saveSlotThreads(slotNumber) {
        if (!currentMockup || !slotNumber) return;

        var mockupIdVal = currentMockup.PK_ID || currentMockup.ID;
        var existing = storedEmbRecords[String(slotNumber)];

        // Renumber runs
        editorThreads.forEach(function (t, idx) { t.run = idx + 1; });

        var record = {
            Mockup_ID: mockupIdVal,
            Mockup_Slot: String(slotNumber),
            Thread_Count: editorThreads.length,
            Color_Changes: Math.max(0, editorThreads.length - 1),
            Thread_Colors: editorThreads.map(function (t) { return t.name; }).join(', '),
            Thread_Sequence_JSON: JSON.stringify(editorThreads),
            Colorway_Name: 'Mockup ' + slotNumber,
            Is_Primary: slotNumber === 1 ? 'Yes' : 'No',
            Upload_Date: new Date().toISOString(),
            Uploaded_By: 'ruth@nwcustomapparel.com'
        };

        var url, method;
        if (existing && existing.ID) {
            url = API_BASE + '/api/emb-designs/' + existing.ID;
            method = 'PUT';
        } else {
            url = API_BASE + '/api/emb-designs';
            method = 'POST';
        }

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        })
        .then(function (resp) {
            if (!resp.ok) throw new Error('Save failed');
            return resp.json();
        })
        .then(function (result) {
            // Update local cache
            if (method === 'POST' && result.record) {
                storedEmbRecords[String(slotNumber)] = result.record;
            } else if (existing) {
                existing.Thread_Sequence_JSON = record.Thread_Sequence_JSON;
                existing.Thread_Colors = record.Thread_Colors;
                existing.Thread_Count = record.Thread_Count;
                existing.Color_Changes = record.Color_Changes;
            }
            renderAllSlotSwatches();
            showToast('Thread data saved for Mockup ' + slotNumber, 'success');

            // Show print button
            var printBtn = document.getElementById('pmd-print-thread-sheet-btn');
            if (printBtn) printBtn.style.display = 'inline-flex';
        })
        .catch(function (err) {
            console.error('Failed to save thread data:', err.message);
            showToast('Failed to save thread data: ' + err.message, 'error');
        });
    }

    // ── Print Thread Sheet PDF ───────────────────────────────────────────

    function generateThreadSheet() {
        if (!currentMockup) return;

        var company = currentMockup.Company_Name || '';
        var designNum = currentMockup.Design_Number || '';
        var designName = currentMockup.Design_Name || '';
        var today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

        // Gather metadata for richer header
        var primaryRec = storedEmbRecords['1'];
        var stitchCount = primaryRec ? (primaryRec.Stitch_Count || '') : '';
        var logoW = currentMockup.Logo_Width || '';
        var logoH = currentMockup.Logo_Height || '';
        var placement = currentMockup.Print_Location || '';
        var garmentDesc = currentMockup.Garment_Description || '';
        var hoopW = primaryRec ? (primaryRec.Hoop_Width || '') : '';
        var hoopH = primaryRec ? (primaryRec.Hoop_Height || '') : '';

        // Check if any slot has elements
        var anyElements = false;
        for (var chk = 1; chk <= 3; chk++) {
            var chkRec = storedEmbRecords[String(chk)];
            if (chkRec && chkRec.Thread_Sequence_JSON) {
                try {
                    var chkThreads = JSON.parse(chkRec.Thread_Sequence_JSON);
                    if (chkThreads.some(function (t) { return t.element; })) anyElements = true;
                } catch (e) {}
            }
        }

        var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
            + '<title>Thread Sheet - ' + escapeHtml(company) + ' #' + escapeHtml(designNum) + '</title>'
            + '<style>'
            + '* { box-sizing: border-box; margin: 0; padding: 0; }'
            + 'body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #1a1a1a; }'
            + '.header { text-align: center; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 2px solid #333; }'
            + '.header h1 { font-size: 20px; margin-bottom: 4px; }'
            + '.header .meta { font-size: 13px; color: #555; }'
            + '.header .meta-details { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 18px; margin-top: 8px; font-size: 12px; color: #444; }'
            + '.header .meta-details span { white-space: nowrap; }'
            + '.header .meta-details .md-label { font-weight: 700; color: #222; }'
            + '.mockup-section { display: flex; gap: 20px; margin-bottom: 28px; page-break-inside: avoid; align-items: flex-start; }'
            + '.mockup-img { width: 220px; height: 220px; object-fit: contain; border: 1px solid #ddd; border-radius: 6px; background: #f8f8f8; flex-shrink: 0; }'
            + '.thread-table { flex: 1; }'
            + '.thread-table h3 { font-size: 14px; margin-bottom: 6px; color: #333; }'
            + 'table { width: 100%; border-collapse: collapse; font-size: 12px; }'
            + 'th { background: #333; color: #fff; padding: 5px 8px; text-align: left; font-size: 11px; }'
            + 'td { padding: 5px 8px; border-bottom: 1px solid #e5e5e5; }'
            + 'tr:nth-child(even) { background: #f9f9f9; }'
            + '.color-dot { display: inline-block; width: 16px; height: 16px; border-radius: 50%; border: 1px solid #ccc; vertical-align: middle; }'
            + '.td-element { color: #555; font-style: italic; }'
            + '.footer { text-align: center; font-size: 11px; color: #999; margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; }'
            + '@media print {'
            + '  body { padding: 12px; }'
            + '  @page { size: letter portrait; margin: 0.4in; }'
            + '  .mockup-section { page-break-inside: avoid; }'
            + '}'
            + '</style></head><body>';

        // Header
        html += '<div class="header">'
            + '<h1>THREAD COLOR SHEET</h1>'
            + '<div class="meta">'
            + escapeHtml(company) + ' &mdash; #' + escapeHtml(designNum)
            + (designName ? ' &mdash; ' + escapeHtml(designName) : '')
            + '</div>';

        // Metadata details row
        var metaParts = [];
        if (stitchCount) metaParts.push('<span><span class="md-label">Stitches:</span> ' + Number(stitchCount).toLocaleString() + '</span>');
        if (logoW && logoH) metaParts.push('<span><span class="md-label">Size:</span> ' + escapeHtml(logoW) + '&Prime; &times; ' + escapeHtml(logoH) + '&Prime;</span>');
        if (hoopW && hoopH) metaParts.push('<span><span class="md-label">Hoop:</span> ' + escapeHtml(hoopW) + ' &times; ' + escapeHtml(hoopH) + ' mm</span>');
        if (placement) metaParts.push('<span><span class="md-label">Placement:</span> ' + escapeHtml(placement) + '</span>');
        if (garmentDesc) metaParts.push('<span><span class="md-label">Garment:</span> ' + escapeHtml(garmentDesc) + '</span>');
        if (metaParts.length > 0) {
            html += '<div class="meta-details">' + metaParts.join('') + '</div>';
        }
        html += '<div class="meta" style="margin-top:4px;">' + today + '</div>';
        html += '</div>';

        // Each mockup slot with threads
        var hasContent = false;
        for (var s = 1; s <= 3; s++) {
            var rec = storedEmbRecords[String(s)];
            var imgUrl = currentMockup['Box_Mockup_' + s];
            if (!rec && !imgUrl) continue;

            var threads = [];
            if (rec && rec.Thread_Sequence_JSON) {
                try { threads = JSON.parse(rec.Thread_Sequence_JSON); } catch (e) { threads = []; }
            }

            if (threads.length === 0 && !imgUrl) continue;
            hasContent = true;

            html += '<div class="mockup-section">';

            // Mockup image
            if (imgUrl) {
                html += '<img src="' + escapeHtml(imgUrl) + '" class="mockup-img" alt="Mockup ' + s + '">';
            } else {
                html += '<div class="mockup-img" style="display:flex;align-items:center;justify-content:center;color:#999;">No Image</div>';
            }

            // Thread table
            html += '<div class="thread-table">';
            html += '<h3>Mockup ' + s + (rec && rec.Colorway_Name ? ' &mdash; ' + escapeHtml(rec.Colorway_Name) : '') + '</h3>';

            if (threads.length > 0) {
                var slotHasElements = threads.some(function (t) { return t.element; });
                html += '<table><tr><th>#</th><th></th><th>Color</th>'
                    + (slotHasElements ? '<th>Element</th>' : '')
                    + '<th>Cat#</th></tr>';
                threads.forEach(function (t) {
                    html += '<tr>'
                        + '<td><strong>' + (t.run || '') + '</strong></td>'
                        + '<td><span class="color-dot" style="background:' + escapeHtml(t.hex || '#888') + ';"></span></td>'
                        + '<td>' + escapeHtml(t.name || '') + '</td>'
                        + (slotHasElements ? '<td class="td-element">' + escapeHtml(t.element || '') + '</td>' : '')
                        + '<td style="font-family:monospace;">' + escapeHtml(t.catalog || '') + '</td>'
                        + '</tr>';
                });
                html += '</table>';
            } else {
                html += '<p style="color:#999;font-size:12px;">No thread data</p>';
            }

            html += '</div></div>';
        }

        if (!hasContent) {
            showToast('No thread data to print', 'info');
            return;
        }

        // Footer
        html += '<div class="footer">NW Custom Apparel &mdash; 253-922-5793 &mdash; Printed ' + today + '</div>';
        html += '</body></html>';

        var printWin = window.open('', '', 'width=900,height=700');
        printWin.document.write(html);
        printWin.document.close();
        setTimeout(function () { printWin.print(); }, 500);
    }

    function renderThreadSwatches(threads) {
        var container = document.getElementById('pmd-thread-swatches');
        if (!container) return;

        container.innerHTML = '';
        threads.forEach(function (t) {
            var swatch = document.createElement('span');
            swatch.className = 'pmd-thread-swatch';
            var html = '<span class="pmd-thread-swatch-dot" style="background:' + escapeHtml(t.hex || '#888') + ';"></span>'
                + '<span class="pmd-thread-swatch-run">' + t.run + '</span>'
                + '<span>' + escapeHtml(t.name || '?') + '</span>'
                + (t.catalog ? '<span class="pmd-thread-swatch-catalog">' + escapeHtml(t.catalog) + '</span>' : '');
            if (t.stitches) {
                html += '<span class="pmd-thread-swatch-stitches">' + Number(t.stitches).toLocaleString() + ' st</span>';
            }
            swatch.innerHTML = html;
            container.appendChild(swatch);
        });
        container.classList.add('active');
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
                + '<span class="pmd-note-meta">' + escapeHtml(note.Author_Name || '') + ' &bull; ' + formatDateTime(note.Created_Date) + '</span>'
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

        // Posting-as indicator
        var STAFF_NAMES = ['Erik', 'Taneisha', 'Nika', 'Steve', 'Ruth', 'Jim', 'Mikalah'];
        var postingAsEl = document.getElementById('pmd-posting-as');
        if (postingAsEl) {
            var user = getLoggedInUser();
            var detectedName = user.name && user.name !== 'Staff' ? user.firstName : '';
            if (detectedName) {
                postingAsEl.innerHTML = '<span class="posting-as-label">Posting as:</span> '
                    + '<span class="posting-as-name">' + escapeHtml(detectedName) + '</span> '
                    + '<span class="posting-as-check">✓</span>';
            } else {
                var opts = '<option value="">-- select your name --</option>';
                STAFF_NAMES.forEach(function (n) { opts += '<option value="' + n + '">' + n + '</option>'; });
                opts += '<option value="Other">Other</option>';
                postingAsEl.innerHTML = '<span class="posting-as-label">Posting as:</span> '
                    + '<select id="pmd-posting-as-select">' + opts + '</select>';
                var sel = document.getElementById('pmd-posting-as-select');
                if (sel) {
                    sel.addEventListener('change', function () {
                        if (sel.value) sessionStorage.setItem('nwca_user_name', sel.value);
                    });
                }
            }
        }

        btn.addEventListener('click', function () {
            var text = input.value.trim();
            if (!text) return;

            // Get posting-as name
            var postingAsSelect = document.getElementById('pmd-posting-as-select');
            var postingAsName = postingAsSelect ? postingAsSelect.value : '';
            if (!postingAsName) postingAsName = getLoggedInUser().noteBy;
            if (!postingAsName || postingAsName === 'Staff') {
                if (postingAsSelect) { postingAsSelect.style.borderColor = '#dc3545'; return; }
            }

            btn.disabled = true;
            btn.textContent = 'Saving...';

            var noteType = isAeView ? 'ae_instruction' : 'artist_note';
            var author = postingAsName;
            var authorName = postingAsName.split(' ')[0];

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

                // Send email notification to the other party
                if (typeof emailjs !== 'undefined') {
                    var designId = currentMockup.Design_Number || mockupId;
                    var company = currentMockup.Company_Name || 'Unknown';
                    var toEmail, toName;
                    if (isAeView) {
                        // AE added note → notify Ruth
                        toEmail = 'ruth@nwcustomapparel.com';
                        toName = 'Ruth';
                    } else {
                        // Ruth added note → notify the AE who submitted
                        toEmail = currentMockup.Submitted_By || 'sales@nwcustomapparel.com';
                        toName = getAeDisplayName(toEmail);
                    }
                    emailjs.init('4qSbDO-SQs19TbP80');
                    emailjs.send('service_jgrave3', 'template_art_note_added', {
                        to_email: toEmail,
                        to_name: toName,
                        design_id: designId,
                        company_name: company,
                        note_text: text,
                        note_type: noteType.replace(/_/g, ' '),
                        detail_link: HEROKU_ORIGIN + '/mockup/' + mockupId + (isAeView ? '' : '?view=ae'),
                        from_name: authorName
                    }).catch(function () { /* fire-and-forget */ });
                }
            }).catch(function (err) {
                showToast('Failed to save note: ' + err.message, 'error');
            }).finally(function () {
                btn.disabled = false;
                btn.textContent = 'Add Note';
            });
        });
    }

    // ── Delete Mockup Modal ────────────────────────────────────────────────
    function openDeleteModal() {
        var overlay = document.getElementById('pmd-delete-overlay');
        var infoDiv = document.getElementById('pmd-delete-info');
        var reasonField = document.getElementById('pmd-delete-reason');

        // Show design info so user confirms the right one
        var company = (currentMockup.Company_Name || 'Unknown');
        var designNum = (currentMockup.Design_Number || currentMockup.ID || '');
        var designName = (currentMockup.Design_Name || '');
        infoDiv.innerHTML = '<div class="pmd-delete-info-row"><strong>Company:</strong> ' + escapeHtml(company) + '</div>'
            + '<div class="pmd-delete-info-row"><strong>Design #:</strong> ' + escapeHtml(String(designNum)) + '</div>'
            + (designName ? '<div class="pmd-delete-info-row"><strong>Design Name:</strong> ' + escapeHtml(designName) + '</div>' : '');

        reasonField.value = '';
        overlay.classList.add('show');
        reasonField.focus();

        // Wire up cancel
        document.getElementById('pmd-delete-cancel').onclick = function () {
            overlay.classList.remove('show');
        };

        // Wire up confirm
        document.getElementById('pmd-delete-confirm').onclick = function () {
            handleDeleteMockup(this);
        };

        // Close on overlay click
        overlay.onclick = function (e) {
            if (e.target === overlay) overlay.classList.remove('show');
        };

        // Close on Escape
        var escHandler = function (e) {
            if (e.key === 'Escape') {
                overlay.classList.remove('show');
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    function handleDeleteMockup(btnEl) {
        var reason = (document.getElementById('pmd-delete-reason').value || '').trim();
        btnEl.disabled = true;
        btnEl.textContent = 'Deleting...';

        fetch(API_BASE + '/api/mockups/' + mockupId, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(function (resp) {
            if (!resp.ok) {
                return resp.json().then(function (data) {
                    throw new Error(data.error || 'Failed to delete mockup');
                });
            }
            return resp.json();
        })
        .then(function (data) {
            document.getElementById('pmd-delete-overlay').classList.remove('show');
            showToast('Mockup request deleted successfully', 'success');
            // Redirect back to dashboard after brief delay
            setTimeout(function () {
                var backLink = document.getElementById('pmd-back-link');
                window.location.href = backLink ? backLink.href : '/art-hub-ruth.html';
            }, 1200);
        })
        .catch(function (err) {
            btnEl.disabled = false;
            btnEl.textContent = 'Delete Permanently';
            showToast('Failed to delete: ' + err.message, 'error');
        });
    }

    // ── Request Changes Modal (AE) ─────────────────────────────────────────
    function openReviseModal() {
        var overlay = document.getElementById('pmd-revise-overlay');
        var slotsContainer = document.getElementById('pmd-revise-slots');
        var generalNotes = document.getElementById('pmd-revise-notes');

        // Build per-mockup feedback slots
        slotsContainer.innerHTML = '';
        var filledSlots = MOCKUP_SLOTS.filter(function (s) {
            return s.key !== 'Box_Reference_File' && currentMockup && currentMockup[s.key];
        });

        if (filledSlots.length > 0) {
            filledSlots.forEach(function (slot) {
                var thumbUrl = currentMockup[slot.key] || '';
                var slotDiv = document.createElement('div');
                slotDiv.className = 'pmd-revise-slot';
                slotDiv.innerHTML = '<img src="' + escapeHtml(thumbUrl) + '" class="pmd-revise-thumb" alt="' + escapeHtml(slot.label) + '">'
                    + '<div class="pmd-revise-slot-right">'
                    + '<label class="pmd-revise-slot-label">' + escapeHtml(slot.label) + '</label>'
                    + '<textarea class="pmd-revise-slot-textarea" data-slot="' + escapeHtml(slot.label) + '" placeholder="Changes needed for ' + escapeHtml(slot.label) + '..."></textarea>'
                    + '</div>';
                slotsContainer.appendChild(slotDiv);
            });
        }

        generalNotes.value = '';
        reviseAttachedFiles = [];
        var fileList = document.getElementById('pmd-revise-file-list');
        fileList.innerHTML = '';
        var fileInput = document.getElementById('pmd-revise-file-input');
        fileInput.value = '';
        overlay.classList.add('show');

        // Wire up file upload dropzone
        var dropzone = document.getElementById('pmd-revise-dropzone');
        dropzone.onclick = function () { fileInput.click(); };
        fileInput.onchange = function () {
            if (fileInput.files && fileInput.files[0]) {
                addReviseFile(fileInput.files[0]);
                fileInput.value = '';
            }
        };
        dropzone.ondragover = function (e) { e.preventDefault(); dropzone.classList.add('dragover'); };
        dropzone.ondragleave = function () { dropzone.classList.remove('dragover'); };
        dropzone.ondrop = function (e) {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                addReviseFile(e.dataTransfer.files[0]);
            }
        };

        // Focus first slot textarea or general notes
        var firstSlotTextarea = slotsContainer.querySelector('.pmd-revise-slot-textarea');
        if (firstSlotTextarea) {
            firstSlotTextarea.focus();
        } else {
            generalNotes.focus();
        }

        document.getElementById('pmd-revise-cancel').addEventListener('click', closeReviseModal);
        document.getElementById('pmd-revise-submit').addEventListener('click', function () {
            // Collect per-slot feedback
            var parts = [];
            var slotTextareas = slotsContainer.querySelectorAll('.pmd-revise-slot-textarea');
            for (var i = 0; i < slotTextareas.length; i++) {
                var text = slotTextareas[i].value.trim();
                if (text) {
                    parts.push('**' + slotTextareas[i].getAttribute('data-slot') + ':** ' + text);
                }
            }

            // Add general notes
            var general = generalNotes.value.trim();
            if (general) {
                parts.push(general);
            }

            var combinedNotes = parts.join('\n');
            if (!combinedNotes && reviseAttachedFiles.length === 0) {
                showToast('Please describe the changes needed or attach a file', 'error');
                return;
            }

            var btn = this;

            // Upload attached file first, then submit
            if (reviseAttachedFiles.length > 0) {
                btn.disabled = true;
                btn.innerHTML = '<span class="pmd-btn-spinner"></span>Uploading file...';
                var formData = new FormData();
                formData.append('file', reviseAttachedFiles[0]);
                formData.append('slot', 'Box_Reference_File');
                formData.append('companyName', currentMockup.Company_Name || '');
                fetch(API_BASE + '/api/mockups/' + mockupId + '/upload-file', {
                    method: 'POST',
                    body: formData
                }).then(function (resp) {
                    if (!resp.ok) return resp.json().then(function (d) { throw new Error(d.error || 'Upload failed'); });
                    return resp.json();
                }).then(function () {
                    if (combinedNotes) {
                        combinedNotes += '\n';
                    }
                    combinedNotes += 'Attached file: ' + reviseAttachedFiles[0].name;
                    closeReviseModal();
                    handleStatusUpdate('Revision Requested', combinedNotes, btn);
                }).catch(function (err) {
                    showToast('File upload failed: ' + err.message, 'error');
                    btn.disabled = false;
                    btn.textContent = 'Request Changes';
                });
            } else {
                closeReviseModal();
                handleStatusUpdate('Revision Requested', combinedNotes, btn);
            }
        });
    }

    function addReviseFile(file) {
        if (file.size > 20 * 1024 * 1024) {
            showToast('File too large (max 20MB)', 'error');
            return;
        }
        reviseAttachedFiles = [file];
        renderReviseFileChips();
    }

    function renderReviseFileChips() {
        var fileList = document.getElementById('pmd-revise-file-list');
        fileList.innerHTML = '';
        reviseAttachedFiles.forEach(function (f, idx) {
            var chip = document.createElement('span');
            chip.className = 'pmd-revise-file-chip';
            chip.innerHTML = '<i class="fas fa-paperclip"></i> ' + escapeHtml(f.name)
                + ' <span class="pmd-revise-file-chip-remove" data-idx="' + idx + '">&times;</span>';
            chip.querySelector('.pmd-revise-file-chip-remove').onclick = function () {
                reviseAttachedFiles.splice(idx, 1);
                renderReviseFileChips();
            };
            fileList.appendChild(chip);
        });
    }

    function closeReviseModal() {
        document.getElementById('pmd-revise-overlay').classList.remove('show');
        reviseAttachedFiles = [];
    }

    // ── Version Helpers ────────────────────────────────────────────────────
    function refreshVersionsThenRender() {
        fetch(API_BASE + '/api/mockup-versions/' + mockupId).then(function (r) {
            if (!r.ok) return { versions: [] };
            return r.json();
        }).then(function (data) {
            mockupVersions = (data && data.versions) || [];
            renderGallery(currentMockup);
        }).catch(function () {
            renderGallery(currentMockup);
        });
    }

    function toggleVersionDropdown(slotEl, versions) {
        var existing = document.querySelector('.pmd-version-dropdown');
        if (existing) { existing.remove(); return; }

        var dropdown = document.createElement('div');
        dropdown.className = 'pmd-version-dropdown';

        versions.forEach(function (v) {
            var item = document.createElement('div');
            item.className = 'pmd-version-item' + (v.Is_Current === 'Yes' ? ' pmd-version-item--current' : '');
            item.innerHTML = '<span class="pmd-version-num">v' + v.Version_Number + '</span>'
                + '<span class="pmd-version-name">' + escapeHtml(v.File_Name || 'File') + '</span>'
                + '<span class="pmd-version-date">' + formatDate(v.Uploaded_Date) + '</span>'
                + (v.Is_Current === 'Yes' ? '<span class="pmd-version-current-tag">Current</span>' : '');

            item.addEventListener('click', function (e) {
                e.stopPropagation();
                dropdown.remove();
                var vExt = getFileExtension(v.File_URL);
                if (IMAGE_EXTENSIONS.indexOf(vExt) !== -1) {
                    openLightbox(v.File_URL, 'v' + v.Version_Number + ' \u2014 ' + (v.File_Name || ''));
                } else {
                    window.open(v.File_URL, '_blank');
                }
            });
            dropdown.appendChild(item);
        });

        slotEl.appendChild(dropdown);

        // Close on outside click
        setTimeout(function () {
            document.addEventListener('click', function closeDropdown() {
                dropdown.remove();
                document.removeEventListener('click', closeDropdown);
            }, { once: true });
        }, 0);
    }

    // ── Lightbox ───────────────────────────────────────────────────────────
    function initLightbox() {
        var lightbox = document.getElementById('pmd-lightbox');
        var closeBtn = document.getElementById('pmd-lightbox-close');
        var downloadBtn = document.getElementById('pmd-lightbox-download');

        closeBtn.addEventListener('click', closeLightbox);
        lightbox.addEventListener('click', function (e) {
            if (e.target === lightbox) closeLightbox();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                closeLightbox();
                closeReviseModal();
                // Close edit overlay if open
                var editOverlay = document.querySelector('.pmd-edit-overlay');
                if (editOverlay) editOverlay.style.display = 'none';
                // Close any art-actions-shared modals
                var artModals = document.querySelectorAll('.art-modal-overlay');
                artModals.forEach(function (m) { m.remove(); });
            }
        });

        if (downloadBtn) {
            downloadBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var img = document.getElementById('pmd-lightbox-img');
                var label = document.getElementById('pmd-lightbox-label');
                if (img && img.src) {
                    downloadImage(img.src, label ? label.textContent : 'mockup');
                }
            });
        }
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

    function downloadImage(url, filename) {
        var safeName = (filename || 'mockup').replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'mockup';
        fetch(url)
            .then(function (resp) {
                if (!resp.ok) throw new Error('Download failed');
                return resp.blob();
            })
            .then(function (blob) {
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                var ext = '.png';
                var ct = blob.type;
                if (ct.indexOf('jpeg') !== -1 || ct.indexOf('jpg') !== -1) ext = '.jpg';
                else if (ct.indexOf('gif') !== -1) ext = '.gif';
                else if (ct.indexOf('webp') !== -1) ext = '.webp';
                else if (ct.indexOf('pdf') !== -1) ext = '.pdf';
                a.download = safeName + ext;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(a.href);
            })
            .catch(function () {
                window.open(url, '_blank');
            });
    }

    // ── Helpers ─────────────────────────────────────────────────────────────
    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function getElapsedText(date) {
        var now = new Date();
        var diffMs = now - date;
        var diffMins = Math.floor(diffMs / 60000);
        var diffHours = Math.floor(diffMs / 3600000);
        var diffDays = Math.floor(diffMs / 86400000);

        var text, cssClass;
        if (diffMins < 60) {
            text = diffMins <= 1 ? 'just now' : diffMins + ' minutes ago';
            cssClass = 'approval-elapsed--fresh';
        } else if (diffHours < 24) {
            text = diffHours === 1 ? '1 hour ago' : diffHours + ' hours ago';
            cssClass = 'approval-elapsed--fresh';
        } else if (diffDays < 3) {
            text = diffDays === 1 ? '1 day ago' : diffDays + ' days ago';
            cssClass = 'approval-elapsed--waiting';
        } else {
            text = diffDays + ' days ago';
            cssClass = 'approval-elapsed--overdue';
        }
        return { text: text, cssClass: cssClass };
    }

    // ── Status Timeline (5-step visual stepper) ────────────────────────
    function renderStatusTimeline(notes) {
        var container = document.getElementById('pmd-timeline');
        var stepsEl = document.getElementById('pmd-timeline-steps');
        if (!container || !stepsEl || !currentMockup) return;

        var STEPS = [
            { key: 'submitted', label: 'Submitted', match: ['submitted'] },
            { key: 'inprogress', label: 'In Progress', match: ['in progress', 'working'] },
            { key: 'awaiting', label: 'Awaiting Approval', match: ['awaiting approval', 'mockup sent'] },
            { key: 'approved', label: 'Approved', match: ['approved'] },
            { key: 'completed', label: 'Completed', match: ['completed'] }
        ];

        var revisionStep = { key: 'revision', label: 'Revision Requested', match: ['revision'] };

        var currentStatus = (currentMockup.Status || '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().toLowerCase();
        var stepDates = {};
        var hasRevision = false;

        // Submitted = creation date
        stepDates.submitted = currentMockup.Submitted_Date;

        // Scan notes chronologically to find status transitions
        var sortedNotes = (notes || []).slice().sort(function (a, b) {
            return new Date(a.Created_Date) - new Date(b.Created_Date);
        });

        sortedNotes.forEach(function (note) {
            var text = (note.Note_Text || '').toLowerCase();
            var type = (note.Note_Type || '').toLowerCase();
            var date = note.Created_Date;

            if (type.includes('mockup sent') || text.includes('mockup sent') || text.includes('awaiting approval')) {
                if (!stepDates.awaiting) stepDates.awaiting = date;
            }
            if (text.includes('revision requested') || type.includes('revision')) {
                stepDates.revision = date;
                hasRevision = true;
            }
            if (text.includes('working') || text.includes('in progress')) {
                if (!stepDates.inprogress) stepDates.inprogress = date;
            }
            if (text.includes('approved') && !text.includes('completed') && (type.includes('status') || type.includes('approval'))) {
                if (!stepDates.approved) stepDates.approved = date;
            }
            if (text.includes('completed') && type.includes('status')) {
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
            var stateClass = 'pmd-step--future';
            if (i < currentStepIdx) stateClass = 'pmd-step--done';
            if (i === currentStepIdx) stateClass = 'pmd-step--current';

            var div = document.createElement('div');
            div.className = 'pmd-step ' + stateClass;
            if (step.key === 'revision') div.className += ' pmd-step--revision';

            var dateStr = stepDates[step.key] ? formatDate(stepDates[step.key]) : '';

            div.innerHTML =
                '<div class="pmd-step-dot"></div>' +
                '<div class="pmd-step-label">' + escapeHtml(step.label) + '</div>' +
                (dateStr ? '<div class="pmd-step-date">' + dateStr + '</div>' : '');

            stepsEl.appendChild(div);
        });

        container.style.display = '';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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

    // ── Send to Customer Modal ────────────────────────────────────────────
    function openSendToCustomerModal() {
        if (!currentMockup) return;

        var overlay = document.getElementById('pmd-send-customer-overlay');
        var infoGrid = document.getElementById('pmd-send-info-grid');
        var previewGrid = document.getElementById('pmd-send-preview-grid');
        var ccInfo = document.getElementById('pmd-send-cc-info');
        var nameInput = document.getElementById('pmd-send-contact-name');
        var emailInput = document.getElementById('pmd-send-contact-email');
        var sizeInput = document.getElementById('pmd-send-design-size');

        // Populate read-only info
        var infoItems = [
            { label: 'Company', value: currentMockup.Company_Name || '' },
            { label: 'Design #', value: currentMockup.Design_Number || '' },
            { label: 'Placement', value: currentMockup.Print_Location || '' },
            { label: 'Work Order', value: currentMockup.Work_Order_Number || '' },
            { label: 'Sales Rep', value: getAeDisplayName(currentMockup.Submitted_By) },
            { label: 'Application', value: currentMockup.Mockup_Type || '' }
        ];
        infoGrid.innerHTML = infoItems.filter(function (i) { return i.value; }).map(function (i) {
            return '<div class="pmd-send-info-item">'
                + '<span class="pmd-send-info-label">' + escapeHtml(i.label) + '</span>'
                + '<span class="pmd-send-info-value">' + escapeHtml(i.value) + '</span>'
                + '</div>';
        }).join('');

        // Pre-fill design size from saved data
        sizeInput.value = currentMockup.Design_Size || '';

        // Pre-fill contact from previously saved data
        if (currentMockup.Customer_Name || currentMockup.Customer_Email) {
            nameInput.value = currentMockup.Customer_Name || '';
            emailInput.value = currentMockup.Customer_Email || '';
        } else {
            nameInput.value = '';
            emailInput.value = '';
            // Auto-populate from contacts API
            autoPopulateContact();
        }

        // Build mockup preview thumbnails
        var previewHtml = '';
        var mockupCount = 0;
        MOCKUP_SLOTS.forEach(function (slot) {
            if (slot.key === 'Box_Reference_File') return;
            var url = currentMockup[slot.key];
            if (!url) return;
            var ext = getFileExtension(url);
            if (IMAGE_EXTENSIONS.indexOf(ext) === -1) return;
            mockupCount++;
            previewHtml += '<div class="pmd-send-preview-item">'
                + '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(slot.label) + '" class="pmd-send-preview-thumb">'
                + '<span class="pmd-send-preview-label">' + escapeHtml(slot.label) + '</span>'
                + '</div>';
        });
        if (mockupCount === 0) {
            previewHtml = '<p class="pmd-send-preview-empty">No mockup images to send. Upload images first.</p>';
        }
        previewGrid.innerHTML = previewHtml;

        // CC info
        var repName = getAeDisplayName(currentMockup.Submitted_By);
        ccInfo.innerHTML = '<strong>CC:</strong> Ruth (ruth@nwcustomapparel.com) + ' + escapeHtml(repName) + ' (' + escapeHtml(currentMockup.Submitted_By || '') + ')';

        // Wire up buttons
        document.getElementById('pmd-send-customer-cancel').onclick = function () {
            overlay.classList.remove('show');
        };
        document.getElementById('pmd-send-customer-submit').onclick = function () {
            submitSendToCustomer(this);
        };

        // Close on overlay click
        overlay.onclick = function (e) {
            if (e.target === overlay) overlay.classList.remove('show');
        };

        overlay.classList.add('show');
    }

    function autoPopulateContact() {
        if (!currentMockup) return;

        var companyName = currentMockup.Company_Name;
        if (!companyName) return;

        var nameInput = document.getElementById('pmd-send-contact-name');
        var emailInput = document.getElementById('pmd-send-contact-email');

        fetch(API_BASE + '/api/company-contacts/by-company?company=' + encodeURIComponent(companyName))
            .then(function (resp) {
                if (!resp.ok) throw new Error('Contact lookup failed');
                return resp.json();
            })
            .then(function (data) {
                if (data.contacts && data.contacts.length > 0) {
                    var contact = data.contacts[0];
                    if (!nameInput.value) nameInput.value = contact.name || '';
                    if (!emailInput.value) emailInput.value = contact.email || '';
                }
            })
            .catch(function () {
                // Silently fail — AE can type manually
            });
    }

    function submitSendToCustomer(btnEl) {
        var nameInput = document.getElementById('pmd-send-contact-name');
        var emailInput = document.getElementById('pmd-send-contact-email');
        var sizeInput = document.getElementById('pmd-send-design-size');
        var overlay = document.getElementById('pmd-send-customer-overlay');

        var customerName = (nameInput.value || '').trim();
        var customerEmail = (emailInput.value || '').trim();
        var designSize = (sizeInput.value || '').trim();

        // Validate email
        if (!customerEmail) {
            showToast('Customer email is required', 'error');
            emailInput.focus();
            return;
        }
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerEmail)) {
            showToast('Please enter a valid email address', 'error');
            emailInput.focus();
            return;
        }

        // Check at least one mockup image exists
        var hasMockup = false;
        MOCKUP_SLOTS.forEach(function (slot) {
            if (slot.key === 'Box_Reference_File') return;
            var url = currentMockup[slot.key];
            if (url && IMAGE_EXTENSIONS.indexOf(getFileExtension(url)) !== -1) hasMockup = true;
        });
        if (!hasMockup) {
            showToast('No mockup images to send. Upload images first.', 'error');
            return;
        }

        // Disable button
        btnEl.disabled = true;
        btnEl.textContent = 'Sending...';

        // 1. Save customer info + design size to Caspio
        var updateData = {
            Customer_Email: customerEmail,
            Customer_Name: customerName,
            Customer_Approval_Sent_Date: new Date().toISOString()
        };
        if (designSize) updateData.Design_Size = designSize;

        fetch(API_BASE + '/api/mockups/' + mockupId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Failed to save customer info');
            return resp.json();
        }).then(function () {
            // 2. Build mockup link HTML for email (link instead of large inline images)
            var approvalUrl = HEROKU_ORIGIN + '/mockup/' + mockupId + '?view=customer';
            var mockupCount = 0;
            MOCKUP_SLOTS.forEach(function (slot) {
                if (slot.key === 'Box_Reference_File') return;
                var url = currentMockup[slot.key];
                if (!url) return;
                var ext = getFileExtension(url);
                if (IMAGE_EXTENSIONS.indexOf(ext) === -1) return;
                mockupCount++;
            });
            var mockupImagesHtml = '<div style="text-align:center;margin:20px 0;">'
                + '<p style="font-size:14px;color:#555;margin:0 0 16px 0;">We have ' + mockupCount + ' mockup' + (mockupCount !== 1 ? 's' : '') + ' ready for your review.</p>'
                + '<a href="' + approvalUrl + '" style="display:inline-block;padding:14px 32px;background-color:#16a34a;color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">View Mockup' + (mockupCount !== 1 ? 's' : '') + ' &amp; Approve</a>'
                + '<p style="font-size:12px;color:#999;margin:16px 0 0 0;">Click the button above to view, select, and approve your mockup' + (mockupCount !== 1 ? 's' : '') + '.</p>'
                + '</div>';

            // 3. Send EmailJS
            if (typeof emailjs === 'undefined') {
                throw new Error('Email service not loaded');
            }
            emailjs.init(EMAILJS_PUBLIC_KEY);

            var repEmail = currentMockup.Submitted_By || '';
            var ccEmails = RUTH_EMAIL;
            if (repEmail && repEmail !== RUTH_EMAIL) {
                ccEmails += ',' + repEmail;
            }

            return emailjs.send(EMAILJS_SERVICE_ID, 'mockup_customer_approval', {
                to_email: customerEmail,
                to_name: customerName || 'Customer',
                cc_emails: ccEmails,
                company_name: currentMockup.Company_Name || '',
                design_number: currentMockup.Design_Number || '',
                design_size: designSize || 'Not specified',
                placement: currentMockup.Print_Location || 'Not specified',
                work_order: currentMockup.Work_Order_Number || '',
                sales_rep_name: getAeDisplayName(currentMockup.Submitted_By),
                mockup_images_html: mockupImagesHtml,
                mockup_count: mockupCount,
                approval_link: HEROKU_ORIGIN + '/mockup/' + mockupId + '?view=customer',
                from_name: 'Northwest Custom Apparel'
            });
        }).then(function () {
            // 4. Log a note
            return fetch(API_BASE + '/api/mockup-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    Mockup_ID: parseInt(mockupId, 10),
                    Author: currentMockup.Submitted_By || 'ae@nwcustomapparel.com',
                    Author_Name: getAeDisplayName(currentMockup.Submitted_By),
                    Note_Text: 'Customer approval email sent to ' + (customerName || 'customer') + ' (' + customerEmail + ')',
                    Note_Type: 'customer_approval_sent'
                })
            });
        }).then(function () {
            // 5. Success
            overlay.classList.remove('show');
            showToast('Approval email sent to ' + customerEmail, 'success');
            setTimeout(function () { location.reload(); }, 1200);
        }).catch(function (err) {
            showToast('Failed to send: ' + (err.message || err.text || 'Unknown error'), 'error');
            btnEl.disabled = false;
            btnEl.textContent = 'Send Approval Email';
        });
    }

    // ── EmailJS Notifications ─────────────────────────────────────────────
    function sendMockupNotification(params) {
        if (typeof emailjs === 'undefined') { console.warn('EmailJS not loaded — skipping notification to', params.to_email); return; }
        try {
            console.log('Sending mockup notification to', params.to_email, '—', params.note_type);
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
            }).then(function () {
                console.log('Mockup notification sent to', params.to_email);
            }).catch(function (err) {
                console.error('Mockup notification FAILED to', params.to_email, ':', err);
            });
        } catch (e) { console.error('Mockup notification error:', e); }
    }

    function sendApprovalNotification(aeEmail, message, subjectPrefix) {
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
                subject_prefix: subjectPrefix || '',
                message: message || 'Mockup is ready for your review.',
                mockup_count: mockupCount,
                mockup_images_html: mockupImagesHtml,
                art_time_display: 'N/A',
                detail_link: HEROKU_ORIGIN + '/mockup/' + mockupId + '?view=ae'
            }).catch(function () { /* fire-and-forget */ });
        } catch (e) { /* silent */ }
    }

    function sendUploadNotification(fieldKey, fileName) {
        // AE replacing a reference file — notify Ruth
        if (isAeView && fieldKey === 'Box_Reference_File') {
            var company = currentMockup ? (currentMockup.Company_Name || '') : '';
            var design = currentMockup ? (currentMockup.Design_Number || mockupId) : mockupId;
            sendMockupNotification({
                to_email: RUTH_EMAIL,
                to_name: 'Ruth',
                note_text: 'AE replaced the reference file for ' + company + ' #' + design
                    + '. File: "' + (fileName || 'file') + '". Please review.',
                note_type: 'Reference File Updated',
                detail_link: HEROKU_ORIGIN + '/mockup/' + mockupId,
                from_name: getAeDisplayName(currentMockup ? currentMockup.Submitted_By : '')
            });
            return;
        }
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
        } else if (newStatus === 'Completed') {
            // Ruth marks complete → notify AE
            var aeEmail4 = currentMockup.Submitted_By || 'ae@nwcustomapparel.com';
            sendMockupNotification({
                to_email: aeEmail4,
                to_name: getAeDisplayName(aeEmail4),
                note_text: 'Mockup completed for ' + company + ' #' + design + ' \u2014 ready for production',
                note_type: 'Completed',
                detail_link: aeLink,
                from_name: 'Ruth \u2014 Digitizing'
            });
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
            // Always notify the submitting AE as confirmation
            var aeEmail3 = currentMockup.Submitted_By || 'ae@nwcustomapparel.com';
            sendMockupNotification({
                to_email: aeEmail3,
                to_name: getAeDisplayName(aeEmail3),
                note_text: isCustomerView
                    ? 'Customer requested changes for ' + company + ' #' + design
                    : 'Your revision request was sent to Ruth for ' + company + ' #' + design,
                note_type: isCustomerView ? 'Customer Revision Request' : 'Revision Confirmation',
                detail_link: aeLink,
                from_name: isCustomerView ? 'Customer' : 'Ruth \u2014 Digitizing'
            });
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

    // ── Box Files Panel ────────────────────────────────────────────────────
    function initBoxFilesPanel() {
        var card = document.getElementById('pmd-box-files-card');
        if (!card) return;

        var folderId = currentMockup && currentMockup.Box_Folder_ID;
        if (!folderId) {
            card.style.display = '';
            document.getElementById('pmd-box-panel-empty').style.display = '';
            return;
        }

        card.style.display = '';
        loadBoxPanelFiles(folderId);
    }

    function loadBoxPanelFiles(folderId) {
        var loadingEl = document.getElementById('pmd-box-panel-loading');
        var emptyEl = document.getElementById('pmd-box-panel-empty');
        var grid = document.getElementById('pmd-box-panel-grid');
        var countEl = document.getElementById('pmd-box-file-count');

        loadingEl.style.display = 'flex';
        emptyEl.style.display = 'none';
        grid.innerHTML = '';

        fetch(API_BASE + '/api/box/folder-files?folderId=' + folderId)
            .then(function (resp) {
                if (!resp.ok) throw new Error('Failed to load Box files');
                return resp.json();
            })
            .then(function (data) {
                loadingEl.style.display = 'none';
                boxPanelFiles = data.files || [];

                if (boxPanelFiles.length === 0) {
                    emptyEl.style.display = '';
                    emptyEl.textContent = 'No files in this folder.';
                    countEl.textContent = '';
                    return;
                }

                countEl.textContent = '(' + boxPanelFiles.length + ')';
                renderBoxPanelFiles(boxPanelFiles);
            })
            .catch(function (err) {
                loadingEl.style.display = 'none';
                grid.innerHTML = '<p style="color:#dc2626;padding:12px;font-size:13px;">Failed to load: ' + escapeHtml(err.message) + '</p>';
            });
    }

    function renderBoxPanelFiles(files) {
        var grid = document.getElementById('pmd-box-panel-grid');
        grid.innerHTML = '';

        files.forEach(function (file) {
            var ext = (file.extension || '').toLowerCase();
            var item = document.createElement('div');
            item.className = 'pmd-box-panel-item';
            item.draggable = true;
            item.dataset.boxFileId = file.id;
            item.dataset.boxFileName = file.name;
            item.title = file.name;

            if (file.thumbnailUrl) {
                item.innerHTML = '<img src="' + escapeHtml(API_BASE + file.thumbnailUrl) + '" alt="' + escapeHtml(file.name) + '" loading="lazy">'
                    + '<div class="pmd-box-panel-item-name">' + escapeHtml(file.name) + '</div>'
                    + '<button type="button" class="pmd-box-panel-item-delete" data-box-file-id="' + file.id + '" title="Delete from Box">&times;</button>';
            } else {
                item.innerHTML = '<div class="pmd-box-panel-placeholder">'
                    + '<span class="pmd-box-panel-ext">' + escapeHtml(ext.toUpperCase() || '?') + '</span>'
                    + '</div>'
                    + '<div class="pmd-box-panel-item-name">' + escapeHtml(file.name) + '</div>'
                    + '<button type="button" class="pmd-box-panel-item-delete" data-box-file-id="' + file.id + '" title="Delete from Box">&times;</button>';
            }

            // Drag start
            item.addEventListener('dragstart', function (e) {
                dragSource = { type: 'box', fileId: file.id, fileName: file.name };
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', 'box:' + file.id);
            });
            item.addEventListener('dragend', function () {
                item.classList.remove('dragging');
                dragSource = null;
                clearAllDropHighlights();
            });

            // Click to lightbox (if image thumbnail available)
            if (file.thumbnailUrl) {
                item.addEventListener('click', function (e) {
                    if (e.target.closest('.pmd-box-panel-item-delete')) return;
                    openLightbox(API_BASE + file.thumbnailUrl, file.name);
                });
            }

            // Delete button
            var deleteBtn = item.querySelector('.pmd-box-panel-item-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (!confirm('Delete "' + file.name + '" from Box?\nThis cannot be undone.')) return;
                    deleteBoxFile(file.id);
                });
            }

            grid.appendChild(item);
        });

        // Make Box panel grid a drop target (for slot-to-panel drags)
        initBoxPanelDropTarget(grid);
    }

    function initBoxPanelDropTarget(grid) {
        grid.addEventListener('dragover', function (e) {
            if (!dragSource || dragSource.type !== 'slot') return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            grid.classList.add('drag-over');
        });
        grid.addEventListener('dragleave', function (e) {
            if (!grid.contains(e.relatedTarget)) {
                grid.classList.remove('drag-over');
            }
        });
        grid.addEventListener('drop', function (e) {
            e.preventDefault();
            grid.classList.remove('drag-over');
            if (!dragSource || dragSource.type !== 'slot') return;
            handleSlotToBoxDrop(dragSource.slotKey);
        });
    }

    function handleBoxToSlotDrop(fileId, fileName, slotKey) {
        showToast('Assigning file to slot...', 'info');

        fetch(API_BASE + '/api/box/shared-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: fileId })
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Failed to create shared link');
            return resp.json();
        }).then(function (linkData) {
            var fileUrl = linkData.downloadUrl || linkData.sharedLink;

            var saveBody = {};
            saveBody[slotKey] = fileUrl;

            return fetch(API_BASE + '/api/mockups/' + mockupId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saveBody)
            }).then(function (resp) {
                if (!resp.ok) throw new Error('Failed to save to slot');
                currentMockup[slotKey] = fileUrl;
                refreshVersionsThenRender();
                showToast('File assigned to ' + (MOCKUP_SLOTS.filter(function (s) { return s.key === slotKey; })[0] || { label: 'slot' }).label, 'success');

                // Refresh Box panel
                if (currentMockup.Box_Folder_ID) {
                    loadBoxPanelFiles(currentMockup.Box_Folder_ID);
                }
            });
        }).catch(function (err) {
            showToast('Error: ' + err.message, 'error');
        });
    }

    function handleSlotToBoxDrop(slotKey) {
        showToast('Unassigning file from slot...', 'info');

        var updateBody = {};
        updateBody[slotKey] = '';

        fetch(API_BASE + '/api/mockups/' + mockupId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateBody)
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Failed to unassign');
            currentMockup[slotKey] = '';
            renderGallery(currentMockup);
            showToast('File unassigned (still in Box)', 'info');

            if (currentMockup.Box_Folder_ID) {
                loadBoxPanelFiles(currentMockup.Box_Folder_ID);
            }
        }).catch(function (err) {
            showToast('Failed: ' + err.message, 'error');
        });
    }

    function deleteBoxFile(fileId) {
        showToast('Deleting file...', 'info');

        fetch(API_BASE + '/api/box/file/' + fileId, {
            method: 'DELETE'
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Delete failed');
            return resp.json();
        }).then(function () {
            showToast('File deleted from Box', 'success');
            if (currentMockup.Box_Folder_ID) {
                loadBoxPanelFiles(currentMockup.Box_Folder_ID);
            }
        }).catch(function (err) {
            showToast('Delete failed: ' + err.message, 'error');
        });
    }

    function clearAllDropHighlights() {
        document.querySelectorAll('.drag-over').forEach(function (el) {
            el.classList.remove('drag-over');
        });
        document.querySelectorAll('.dragging').forEach(function (el) {
            el.classList.remove('dragging');
        });
    }

    // ── Find & Link ShopWorks Order ─────────────────────────────────────
    window.pmdExpandLineItems = pmdExpandLineItems;
    window.pmdLinkOrder = pmdLinkOrder;

    function showFindOrderModal(companyName) {
        var overlay = document.getElementById('pmd-fo-overlay');
        var modal = document.getElementById('pmd-fo-modal');
        var body = document.getElementById('pmd-fo-body');
        var manualInput = document.getElementById('pmd-fo-manual-input');
        var manualBtn = document.getElementById('pmd-fo-manual-btn');
        var closeBtn = document.getElementById('pmd-fo-close');

        overlay.style.display = 'block';
        modal.style.display = 'flex';
        body.innerHTML = '<div class="pmd-fo-loading">Searching ShopWorks...</div>';
        manualInput.value = '';

        function closeModal() {
            overlay.style.display = 'none';
            modal.style.display = 'none';
        }
        closeBtn.onclick = closeModal;
        overlay.onclick = closeModal;

        manualBtn.onclick = function () { searchOrderManual(manualInput.value.trim(), body); };
        manualInput.onkeydown = function (e) { if (e.key === 'Enter') manualBtn.click(); };

        if (companyName) {
            searchOrdersByName(companyName, body);
        } else {
            body.innerHTML = '<div class="pmd-fo-empty">No company info available. Use manual search below.</div>';
        }
    }

    function searchOrdersByName(companyName, container) {
        fetch(API_BASE + '/api/manageorders/customers')
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                var customers = data.customers || [];
                var nameLower = companyName.toLowerCase();
                var matches = customers.filter(function (c) {
                    var cn = (c.CustomerName || '').toLowerCase();
                    return cn.indexOf(nameLower) !== -1 || nameLower.indexOf(cn) !== -1;
                });
                if (matches.length === 0) {
                    container.innerHTML = '<div class="pmd-fo-empty">No customers matching "' +
                        escapeHtml(companyName) + '" found in recent ShopWorks orders.</div>';
                    return;
                }
                var bestMatch = matches[0];
                container.innerHTML = '<div class="pmd-fo-loading">Found customer "' +
                    escapeHtml(bestMatch.CustomerName) + '" (#' + bestMatch.id_Customer + '). Loading orders...</div>';
                return searchOrdersByCustomerId(bestMatch.id_Customer, bestMatch.CustomerName, container);
            })
            .catch(function (err) {
                container.innerHTML = '<div class="pmd-fo-error">Customer search failed: ' + escapeHtml(err.message) + '</div>';
            });
    }

    function searchOrdersByCustomerId(customerId, companyName, container) {
        fetch(API_BASE + '/api/manageorders/orders?id_Customer=' + encodeURIComponent(customerId))
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                var orders = data.result || [];
                if (orders.length === 0) {
                    container.innerHTML = '<div class="pmd-fo-empty">No orders found for Customer #' +
                        escapeHtml(String(customerId)) + ' in ShopWorks (60-day window).</div>';
                    return;
                }
                orders.sort(function (a, b) {
                    return new Date(b.date_Ordered || 0) - new Date(a.date_Ordered || 0);
                });
                renderFoOrderCards(orders, container, companyName);
            })
            .catch(function (err) {
                container.innerHTML = '<div class="pmd-fo-error">Search failed: ' + escapeHtml(err.message) + '</div>';
            });
    }

    function searchOrderManual(orderNum, container) {
        if (!orderNum) return;
        container.innerHTML = '<div class="pmd-fo-loading">Looking up Order #' + escapeHtml(orderNum) + '...</div>';
        fetch(API_BASE + '/api/manageorders/orders/' + encodeURIComponent(orderNum))
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                var orders = data.result || [];
                if (orders.length === 0) {
                    container.innerHTML = '<div class="pmd-fo-empty">Order #' + escapeHtml(orderNum) + ' not found in ShopWorks.</div>';
                    return;
                }
                renderFoOrderCards(orders, container, '');
            })
            .catch(function (err) {
                container.innerHTML = '<div class="pmd-fo-error">Lookup failed: ' + escapeHtml(err.message) + '</div>';
            });
    }

    function buildOrderCardHtml(order, companyLabel) {
        var orderNum = order.id_Order || '';
        var dateStr = order.date_Ordered ? new Date(order.date_Ordered).toLocaleDateString() : '--';
        var rep = order.CustomerServiceRep || '--';
        var invoiced = order.date_Invoiced
            ? 'Invoiced ' + new Date(order.date_Invoiced).toLocaleDateString()
            : 'Not invoiced';
        var custName = order.CustomerName || '';
        var artDone = order.sts_ArtDone === 1;
        var html = '<div class="pmd-order-card">';
        html += '<div class="pmd-order-num">Order #' + escapeHtml(String(orderNum));
        html += ' <span class="pmd-fo-art-status pmd-fo-art-status--' + (artDone ? 'done' : 'pending') + '">';
        html += artDone ? '\u2713 Art Done' : '\u2717 Art Pending';
        html += '</span></div>';
        html += '<div class="pmd-order-meta">' + escapeHtml(dateStr) + ' &middot; ' + escapeHtml(rep) +
            ' &middot; ' + escapeHtml(invoiced);
        if (custName && !companyLabel) html += ' &middot; ' + escapeHtml(custName);
        html += '</div>';
        html += '<div class="pmd-order-items" id="pmd-items-' + escapeHtml(String(orderNum)) + '"></div>';
        html += '<div class="pmd-order-actions">';
        html += '<button type="button" class="pmd-view-items-btn" onclick="pmdExpandLineItems(\'' +
            escapeHtml(String(orderNum)) + '\', this)">View Line Items</button>';
        html += '<button type="button" class="pmd-link-order-btn" onclick="pmdLinkOrder(\'' +
            escapeHtml(String(orderNum)) + '\')">Link This Order</button>';
        html += '</div></div>';
        return html;
    }

    function renderFoOrderCards(orders, container, companyLabel) {
        // Date-window filtering: show orders within ±30 days of mockup submission
        var mockupDate = currentMockup && currentMockup.Submitted_Date
            ? new Date(currentMockup.Submitted_Date)
            : null;
        var nearbyOrders = [];
        var otherOrders = [];

        if (mockupDate && orders.length > 3) {
            var windowMs = 30 * 24 * 60 * 60 * 1000; // 30 days
            var windowStart = new Date(mockupDate.getTime() - windowMs);
            var windowEnd = new Date(mockupDate.getTime() + windowMs);
            orders.forEach(function (order) {
                var oDate = order.date_Ordered ? new Date(order.date_Ordered) : null;
                if (oDate && oDate >= windowStart && oDate <= windowEnd) {
                    nearbyOrders.push(order);
                } else {
                    otherOrders.push(order);
                }
            });
        }

        var useFiltering = nearbyOrders.length > 0 && otherOrders.length > 0;
        var html = '';

        if (useFiltering) {
            var mockupDateStr = mockupDate.toLocaleDateString();
            html += '<div class="pmd-fo-header">Found ' + nearbyOrders.length + ' order' +
                (nearbyOrders.length !== 1 ? 's' : '') + ' near mockup date (' + escapeHtml(mockupDateStr) + ')' +
                (companyLabel ? ' for ' + escapeHtml(companyLabel) : '') + ':</div>';
            nearbyOrders.forEach(function (order) {
                html += buildOrderCardHtml(order, companyLabel);
            });
            html += '<div class="pmd-fo-show-all" id="pmd-fo-show-all-toggle" style="padding:10px 0;text-align:center;">';
            html += '<button type="button" onclick="pmdShowAllOrders()" style="background:none;border:none;color:#6366f1;cursor:pointer;font-size:13px;text-decoration:underline;">';
            html += 'Show all ' + orders.length + ' orders</button></div>';
            html += '<div id="pmd-fo-other-orders" style="display:none;">';
            otherOrders.forEach(function (order) {
                html += buildOrderCardHtml(order, companyLabel);
            });
            html += '</div>';
        } else {
            html += '<div class="pmd-fo-header">Found ' + orders.length + ' order' +
                (orders.length !== 1 ? 's' : '') + (companyLabel ? ' for ' + escapeHtml(companyLabel) : '') + ':</div>';
            orders.forEach(function (order) {
                html += buildOrderCardHtml(order, companyLabel);
            });
        }
        container.innerHTML = html;
    }

    window.pmdShowAllOrders = function () {
        var otherDiv = document.getElementById('pmd-fo-other-orders');
        var toggleDiv = document.getElementById('pmd-fo-show-all-toggle');
        if (otherDiv) otherDiv.style.display = 'block';
        if (toggleDiv) toggleDiv.style.display = 'none';
    };

    function pmdExpandLineItems(orderNum, btn) {
        var itemsDiv = document.getElementById('pmd-items-' + orderNum);
        if (!itemsDiv) return;
        if (itemsDiv.innerHTML) {
            itemsDiv.innerHTML = '';
            btn.textContent = 'View Line Items';
            return;
        }
        btn.textContent = 'Loading...';
        btn.disabled = true;
        fetch(API_BASE + '/api/manageorders/lineitems/' + encodeURIComponent(orderNum))
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                var items = data.result || [];
                if (items.length === 0) {
                    itemsDiv.innerHTML = '<div class="pmd-fo-empty" style="padding:8px 0;">No line items found.</div>';
                    btn.textContent = 'Hide Line Items';
                    btn.disabled = false;
                    return;
                }
                var html = '<table class="pmd-line-items-table"><thead><tr><th>PN</th><th>Description</th><th>Qty</th><th>Price</th></tr></thead><tbody>';
                items.forEach(function (item) {
                    var pn = item.PartNumber || '';
                    var price = item.LineUnitPrice;
                    html += '<tr>';
                    html += '<td>' + escapeHtml(pn) + '</td>';
                    html += '<td>' + escapeHtml((item.PartDescription || '').trim()) + '</td>';
                    html += '<td>' + (item.LineQuantity || '') + '</td>';
                    html += '<td>' + (price !== null && price !== undefined ? '$' + parseFloat(price).toFixed(2) : '$0.00') + '</td>';
                    html += '</tr>';
                });
                html += '</tbody></table>';
                itemsDiv.innerHTML = html;
                btn.textContent = 'Hide Line Items';
                btn.disabled = false;
            })
            .catch(function (err) {
                itemsDiv.innerHTML = '<div class="pmd-fo-error" style="padding:8px 0;">Failed to load: ' + escapeHtml(err.message) + '</div>';
                btn.textContent = 'View Line Items';
                btn.disabled = false;
            });
    }

    function pmdLinkOrder(orderNum) {
        if (!currentMockup || !currentMockup.ID) {
            alert('Error: Cannot save — missing record ID');
            return;
        }
        if (!confirm('Link Order #' + orderNum + ' to this mockup?')) return;

        fetch(API_BASE + '/api/mockups/' + currentMockup.ID, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Work_Order_Number: String(orderNum) })
        })
        .then(function (resp) {
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            return resp.json();
        })
        .then(function () {
            // Close modal
            document.getElementById('pmd-fo-overlay').style.display = 'none';
            document.getElementById('pmd-fo-modal').style.display = 'none';

            // Update the Work Order field on the page
            var woEl = document.getElementById('pmd-wo-value');
            if (woEl) woEl.textContent = orderNum;

            // Remove the Find Order button if it exists
            var findBtn = document.getElementById('pmd-find-order-btn');
            if (findBtn) findBtn.remove();

            // Update local state
            currentMockup.Work_Order_Number = String(orderNum);

            // Now run the ShopWorks Art Done check
            checkShopWorksArtDone(orderNum);

            alert('Order #' + orderNum + ' linked successfully');
        })
        .catch(function (err) {
            alert('Failed to link order: ' + err.message);
        });
    }

    // ── ShopWorks Art Done Check ─────────────────────────────────────────
    function checkShopWorksArtDone(workOrderNumber) {
        fetch(API_BASE + '/api/manageorders/orders/' + encodeURIComponent(workOrderNumber))
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var orders = data.result || [];
                if (orders.length === 0) return;
                var order = orders[0];
                var artDone = order.sts_ArtDone === 1;

                var badge = document.createElement('span');
                badge.className = 'pmd-sw-badge ' + (artDone ? 'pmd-sw-badge--done' : 'pmd-sw-badge--pending');
                badge.textContent = artDone ? '\u2713 Art Done in ShopWorks' : '\u2717 Art not yet done in ShopWorks';
                badge.title = artDone
                    ? 'Artwork marked done in ShopWorks (Order #' + workOrderNumber + ')'
                    : 'Artwork not yet marked done in ShopWorks (Order #' + workOrderNumber + ')';

                var badgesDiv = document.querySelector('.pmd-badges');
                if (badgesDiv) {
                    badgesDiv.appendChild(badge);
                }
            })
            .catch(function () {
                // Silent fail — non-critical indicator
            });
    }

    // ── Customer PDF Download ──────────────────────────────────────────
    function generateCustomerPDF() {
        if (!window.jspdf) {
            alert('PDF library not loaded. Please refresh and try again.');
            return;
        }

        var btn = document.getElementById('pmd-btn-download-pdf');
        var originalText = btn.innerHTML;
        btn.innerHTML = 'Generating...';
        btn.disabled = true;

        var mockup = currentMockup;
        var jsPDF = window.jspdf.jsPDF;
        var pdf = new jsPDF('p', 'mm', 'letter');
        var pageWidth = 215.9;
        var margin = 18;
        var contentWidth = pageWidth - margin * 2;
        var yPos = 0;

        // ── Header banner ──
        pdf.setFillColor(46, 125, 50); // green to match customer theme
        pdf.rect(0, 0, pageWidth, 36, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Northwest Custom Apparel', margin, 12);

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text('2025 Freeman Road East, Milton, WA 98354', margin, 19);
        pdf.text('(253) 922-5793 | sales@nwcustomapparel.com', margin, 25);

        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Mockup Approval Sheet', pageWidth - margin, 14, { align: 'right' });

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        var statusText = mockup.Status || 'In Progress';
        pdf.text(statusText, pageWidth - margin, 22, { align: 'right' });

        if (mockup.Customer_Approval_Sent_Date) {
            pdf.text('Sent: ' + formatDate(mockup.Customer_Approval_Sent_Date), pageWidth - margin, 29, { align: 'right' });
        }

        yPos = 44;

        // ── Company + Design Info ──
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(mockup.Company_Name || '', margin, yPos);
        yPos += 7;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Design #' + (mockup.Design_Number || '') + ' — ' + (mockup.Design_Name || ''), margin, yPos);
        yPos += 10;

        // ── Request Details table ──
        var logoDim = '';
        if (mockup.Logo_Width && mockup.Logo_Height) logoDim = mockup.Logo_Width + ' x ' + mockup.Logo_Height;
        else if (mockup.Logo_Width) logoDim = mockup.Logo_Width + ' wide';

        var details = [
            ['Application', mockup.Mockup_Type || ''],
            ['Placement', mockup.Print_Location || ''],
            ['Logo Dimensions', logoDim],
            ['Design Size', mockup.Design_Size || ''],
            ['Your Rep', getAeDisplayName(mockup.Submitted_By) || '']
        ].filter(function (d) { return d[1]; });

        pdf.setFontSize(9);
        details.forEach(function (d) {
            pdf.setFont('helvetica', 'bold');
            pdf.text(d[0] + ':', margin, yPos);
            pdf.setFont('helvetica', 'normal');
            pdf.text(d[1], margin + 35, yPos);
            yPos += 5;
        });

        yPos += 6;

        // ── Draw line separator ──
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 8;

        // ── Load mockup images and render ──
        var slots = [];
        for (var s = 1; s <= 3; s++) {
            var key = 'Box_Mockup_' + s;
            if (mockup[key]) {
                slots.push({ num: s, url: mockup[key] });
            }
        }

        // Load all images in parallel
        var imagePromises = slots.map(function (slot) {
            return loadImageAsBase64(slot.url).then(function (imgData) {
                slot.imgData = imgData;
                return slot;
            }).catch(function () {
                slot.imgData = null;
                return slot;
            });
        });

        Promise.all(imagePromises).then(function (loadedSlots) {
            var pageHeight = 279.4; // letter height in mm
            var pageBottom = 260;   // leave 20mm for footer area
            var imgWidth = contentWidth * 0.6;
            var imgHeight = imgWidth * 0.75; // 4:3 aspect ratio (~81mm)

            loadedSlots.forEach(function (slot) {
                // Calculate total space needed for this mockup section
                var mockupImgH = slot.imgData ? imgHeight : 12;
                var rec = storedEmbRecords[String(slot.num)];
                var threads = [];
                if (rec && rec.Thread_Sequence_JSON) {
                    try { threads = JSON.parse(rec.Thread_Sequence_JSON); } catch (e) { /* empty */ }
                }
                var threadH = threads.length > 0 ? (8 + threads.length * 4) : 0;
                var neededH = 6 + mockupImgH + 4 + threadH + 8; // label+gap + image + gap + threads + spacing

                // Smart page break: if this mockup won't fit, start a new page
                if (yPos + neededH > pageBottom) {
                    pdf.addPage();
                    yPos = margin;
                }

                // Mockup label
                pdf.setFontSize(11);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(46, 125, 50);
                pdf.text('Mockup ' + slot.num, margin, yPos);
                pdf.setTextColor(0, 0, 0);
                yPos += 4;

                // Mockup image
                if (slot.imgData) {
                    pdf.addImage(slot.imgData, 'JPEG', margin, yPos, imgWidth, imgHeight);
                    yPos += imgHeight + 4;
                } else {
                    pdf.setFontSize(9);
                    pdf.setFont('helvetica', 'italic');
                    pdf.text('(Image could not be loaded)', margin, yPos + 5);
                    yPos += 12;
                }

                // Thread sequence for this slot
                if (threads.length > 0) {
                    pdf.setFontSize(7);
                    pdf.setFont('helvetica', 'bold');
                    pdf.setTextColor(100, 100, 100);
                    pdf.text('THREAD SEQUENCE', margin, yPos);
                    yPos += 4;

                    pdf.setFontSize(8);
                    threads.forEach(function (t) {
                        // Color dot
                        var hex = t.hex || '#888888';
                        var r = parseInt(hex.slice(1, 3), 16);
                        var g = parseInt(hex.slice(3, 5), 16);
                        var b = parseInt(hex.slice(5, 7), 16);
                        pdf.setFillColor(r, g, b);
                        pdf.circle(margin + 2, yPos - 1, 1.5, 'F');

                        // Run number + name
                        pdf.setFont('helvetica', 'normal');
                        pdf.setTextColor(80, 80, 80);
                        pdf.text(String(t.run || ''), margin + 6, yPos);
                        pdf.setTextColor(0, 0, 0);
                        pdf.text(t.name || '(no color)', margin + 12, yPos);

                        // Element name
                        if (t.element) {
                            pdf.setFont('helvetica', 'italic');
                            pdf.setTextColor(74, 122, 74);
                            pdf.text(t.element, margin + 50, yPos);
                        }

                        pdf.setTextColor(0, 0, 0);
                        yPos += 4;
                    });
                }

                yPos += 8;
            });

            // ── Footer — always at bottom of last page ──
            var footerY = pageHeight - 10;
            pdf.setFontSize(7);
            pdf.setTextColor(150, 150, 150);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Generated ' + formatDate(new Date().toISOString()) + ' | Northwest Custom Apparel', pageWidth / 2, footerY, { align: 'center' });

            // Save
            var fileName = 'Mockup-' + (mockup.Design_Number || 'unknown') + '-' + (mockup.Company_Name || 'customer').replace(/[^a-zA-Z0-9]/g, '-') + '.pdf';
            pdf.save(fileName);

            btn.innerHTML = originalText;
            btn.disabled = false;
        }).catch(function (err) {
            console.error('PDF generation error:', err);
            alert('Error generating PDF. Please try again.');
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
    }

    function loadImageAsBase64(url) {
        // Proxy external images (Box, etc.) through our server to avoid CORS issues
        var proxyUrl = '/api/image-proxy?url=' + encodeURIComponent(url);

        return fetch(proxyUrl)
            .then(function (resp) {
                if (!resp.ok) throw new Error('Image proxy returned ' + resp.status);
                return resp.blob();
            })
            .then(function (blob) {
                return new Promise(function (resolve, reject) {
                    var reader = new FileReader();
                    reader.onloadend = function () { resolve(reader.result); };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            });
    }

})();
