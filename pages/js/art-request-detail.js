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

    const EMAILJS_SERVICE_ID = 'service_jgrave3';
    const EMAILJS_PUBLIC_KEY = '4qSbDO-SQs19TbP80';
    const SITE_ORIGIN = 'https://www.teamnwca.com';

    // Logged-in user identity (from staff portal session)
    function getLoggedInUser() {
        var name = sessionStorage.getItem('nwca_user_name') || '';
        var email = sessionStorage.getItem('nwca_user_email') || '';
        return {
            name: name || 'Staff',
            email: email || 'art@nwcustomapparel.com',
            firstName: (name || 'Staff').split(' ')[0]
        };
    }

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

    // Image extensions that browsers can render natively
    const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif'];

    /** Extract file extension from a URL (strips query params, returns lowercase) */
    function getFileExtension(url) {
        if (!url) return '';
        try {
            var path = url.split('?')[0].split('#')[0];
            var lastDot = path.lastIndexOf('.');
            if (lastDot === -1) return '';
            return path.substring(lastDot + 1).toLowerCase();
        } catch (e) {
            return '';
        }
    }

    // ── Smart Back Navigation ──────────────────────────────────────────
    (function setupBackNavigation() {
        var backLink = document.querySelector('.ard-back-link');
        if (!backLink) return;
        var ref = document.referrer || '';
        if (ref.indexOf('/dashboards/art-hub-steve') !== -1) {
            backLink.textContent = '\u2190 Back to Art Hub';
            backLink.href = '/dashboards/art-hub-steve.html';
        } else if (ref.indexOf('/ae-dashboard') !== -1 || ref.indexOf('/dashboards/ae-dashboard') !== -1) {
            backLink.textContent = '\u2190 Back to AE Dashboard';
            backLink.href = '/dashboards/ae-dashboard.html';
        } else if (window.opener || (window.history.length <= 2 && !ref)) {
            backLink.textContent = '\u2190 Close Tab';
            backLink.href = '#';
            backLink.addEventListener('click', function (e) {
                e.preventDefault();
                window.close();
                window.location.href = '/staff-dashboard.html';
            });
        }
    })();

    // Detect view mode at IIFE scope (must be before header setup)
    var iifeUrlParams = new URLSearchParams(window.location.search);
    var isCustomerView = iifeUrlParams.get('view') === 'customer';
    var isAeView = iifeUrlParams.get('view') === 'ae';
    var selectedMockupSlot = null;

    // Customer view — set up header before data loads
    if (isCustomerView) {
        document.body.classList.add('ard-customer-view');
        var headerTitle = document.querySelector('.ard-header-text h1');
        if (headerTitle) headerTitle.textContent = 'Mockup Approval';
        var backLink = document.querySelector('.ard-back-link');
        if (backLink) backLink.style.display = 'none';
    }

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
        setText('ard-due-date', formatDate(req.Due_Date));
        setText('ard-date-created', formatDate(req.Date_Created));

        // Garment Placement
        if (req.Garment_Placement) {
            setText('ard-placement', req.Garment_Placement);
            document.getElementById('ard-placement-field').style.display = '';
        }

        // ShopWorks References
        var swCustomer = req.Shopwork_customer_number || req.Shopworks_Customer_Number || '';
        var swDesign = req.Design_Num_SW || '';
        var swOrder = req.Order_Num_SW || '';
        if (swCustomer || swDesign || swOrder) {
            document.getElementById('ard-sw-refs-card').style.display = '';
            if (swCustomer) setText('ard-sw-customer', swCustomer);
            if (swDesign) setText('ard-sw-design', swDesign);
            if (swOrder) setText('ard-sw-order', swOrder);
        }

        // Garments & Colors
        renderGarments(req);

        // Billing
        const artMins = req.Art_Minutes || 0;
        const artHours = (Math.ceil(artMins / 15) * 0.25).toFixed(2);
        const artBilled = req.Amount_Art_Billed || parseFloat((artHours * 75).toFixed(2));
        document.getElementById('ard-art-minutes').textContent = artMins;
        document.getElementById('ard-art-hours').textContent = artHours;
        document.getElementById('ard-art-billed').textContent = `$${parseFloat(artBilled).toFixed(2)}`;

        // Quoted charges from AE
        var prelimCharges = req.Prelim_Charges || req.Charge_Quoted || '';
        var addlServices = req.Additional_Services || '';
        if (prelimCharges || addlServices) {
            document.getElementById('ard-quoted-section').style.display = '';
            if (prelimCharges) {
                var chargeVal = typeof prelimCharges === 'number' ? '$' + prelimCharges.toFixed(2) : prelimCharges;
                setText('ard-prelim-charges', chargeVal);
            }
            if (addlServices) {
                setText('ard-addl-services', addlServices);
                document.getElementById('ard-addl-services-field').style.display = '';
            }
        }

        // Invoice Audit — check ShopWorks for art charge line items
        if (swOrder) {
            loadFullInvoice(swOrder, artBilled, prelimCharges);
        }

        // Show "Find Order" button when order # is blank but we have search data
        if (!swOrder && (swCustomer || req.CompanyName)) {
            document.getElementById('ard-sw-refs-card').style.display = '';
            var findBtn = document.getElementById('ard-find-order-btn');
            if (findBtn) {
                findBtn.style.display = '';
                findBtn.addEventListener('click', function () {
                    showFindOrderModal(swCustomer, req.CompanyName, req.Date_Created);
                });
            }
        }

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
            var phone = req.Phone || '';
            if (phone) {
                var phoneEl = document.getElementById('ard-contact-phone');
                phoneEl.textContent = phone;
                phoneEl.style.cursor = 'pointer';
                phoneEl.title = 'Click to call';
                phoneEl.addEventListener('click', function () { window.location.href = 'tel:' + phone; });
                document.getElementById('ard-phone-field').style.display = '';
            }
        }

        // Submitter notes
        if (req.NOTES) {
            document.getElementById('ard-submitter-notes').textContent = req.NOTES;
            document.getElementById('ard-submitter-notes-card').style.display = 'block';
        }

        // Final Approved Mockup + Mockup Gallery
        renderFinalMockup(req);
        renderMockupGallery(req);

        const statusLower = statusClean.toLowerCase().replace(/\s+/g, '');

        // ── Customer View ──────────────────────────────────────────────
        if (isCustomerView) {
            // Hide elements not relevant to customer
            var hideIds = ['ard-steve-actions', 'ard-action-bar', 'ard-invoice-section',
                           'ard-sw-refs-card', 'ard-contact-card', 'ard-charges-card',
                           'ard-submitter-notes-card', 'ard-artwork-section'];
            hideIds.forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            // Hide notes timeline card (second card in right column)
            var notesCard = document.getElementById('ard-add-note-toggle');
            if (notesCard) {
                var nc = notesCard.closest('.ard-card');
                if (nc) nc.style.display = 'none';
            }
            // Render customer action panel (before gallery)
            renderCustomerActionPanel(req, statusClean);
            // Make mockup slots selectable (if awaiting approval)
            if (statusLower.includes('awaitingapproval')) {
                initCustomerMockupSelection(req);
            }
            return;
        }

        // ── AE / Steve Views ───────────────────────────────────────────
        initGalleryInteractions(req);

        // AE Action Bar — show only for AE view when status is "Awaiting Approval"
        if (isAeView && statusLower.includes('awaitingapproval')) {
            document.getElementById('ard-action-bar').style.display = '';
            initActionBar();

            // Copy Customer Link — show when mockup exists
            var mockupUrl = req.Box_File_Mockup || req.BoxFileLink || req.Company_Mockup || '';
            if (mockupUrl) {
                var copyLinkBtn = document.getElementById('ard-btn-copy-link');
                if (copyLinkBtn) {
                    copyLinkBtn.style.display = '';
                    copyLinkBtn.addEventListener('click', function () {
                        var customerUrl = SITE_ORIGIN + '/art-request/' + designId + '?view=customer';
                        navigator.clipboard.writeText(customerUrl).then(function () {
                            copyLinkBtn.textContent = 'Copied!';
                            copyLinkBtn.style.background = '#059669';
                            copyLinkBtn.style.color = '#fff';
                            setTimeout(function () {
                                copyLinkBtn.textContent = 'Copy Customer Link';
                                copyLinkBtn.style.background = '';
                                copyLinkBtn.style.color = '';
                            }, 3000);
                        }).catch(function () {
                            // Fallback for older browsers
                            prompt('Copy this link:', customerUrl);
                        });
                    });
                }
            }

            // Email Customer — show when mockup exists + customer email exists
            if (contactEmail && mockupUrl) {
                document.getElementById('ard-btn-share-customer').style.display = '';
                initShareWithCustomer(req);
            }
        }

        // Steve's Action Bar — hide when accessed via email link (?view=ae)
        if (isAeView) {
            document.body.classList.add('ae-view');
            // Update header text and back link for AE context
            var headerTitleAe = document.querySelector('.ard-header-text h1');
            if (headerTitleAe) headerTitleAe.textContent = 'Art Request Review';
            var backLinkAe = document.querySelector('.ard-back-link');
            if (backLinkAe) {
                backLinkAe.textContent = '\u2190 Back to AE Dashboard';
                backLinkAe.href = '/dashboards/ae-dashboard.html';
            }
        } else {
            renderSteveActions(req, statusClean);
        }

        // Revision feedback banner (shows above gallery for Revision Requested)
        renderRevisionBanner(req, notes);

        // Notes timeline
        renderNotes(notes);
        initAddNoteForm();

        // Art charge history
        renderCharges(charges);

        // Status timeline
        renderStatusTimeline(notes);
    }

    // ── Steve's Action Bar ────────────────────────────────────────────────
    function renderSteveActions(req, statusClean) {
        var bar = document.getElementById('ard-steve-actions');
        if (!bar || !window.ArtActions) return;

        var status = statusClean.toLowerCase().replace(/\s+/g, '');
        var isCompleted = status === 'completed';
        var isCancelled = status === 'cancel' || status === 'cancelled';

        if (isCancelled) return;

        bar.style.display = 'flex';

        var btnWorking = document.getElementById('ard-btn-working');
        var btnComplete = document.getElementById('ard-btn-complete');
        var btnMockup = document.getElementById('ard-btn-send-mockup');
        var btnReopen = document.getElementById('ard-btn-reopen');

        if (isCompleted) {
            btnWorking.style.display = 'none';
            btnComplete.style.display = 'none';
            btnMockup.style.display = 'none';
            btnReopen.style.display = '';
        } else {
            // Hide Send Mockup if status doesn't allow it
            var canSendMockup = status.includes('inprogress') || status.includes('revisionrequested') || status.includes('awaitingapproval');
            if (!canSendMockup) btnMockup.style.display = 'none';
        }

        var repEmail = req.User_Email || req.Sales_Rep || '';
        var company = req.CompanyName || '';

        btnWorking.addEventListener('click', function () {
            btnWorking.disabled = true;
            btnWorking.textContent = 'Updating...';
            fetch(API_BASE + '/api/art-requests/' + designId + '/status', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'In Progress' })
            }).then(function (resp) {
                if (!resp.ok) throw new Error('Status ' + resp.status);
                return fetch(API_BASE + '/api/art-requests/' + designId + '/note', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ noteType: 'Status Change', noteText: 'Status set to Working (In Progress)', noteBy: getLoggedInUser().email })
                });
            }).then(function () {
                btnWorking.textContent = 'Updated!';
                btnWorking.style.background = '#28a745';

                // Notify sales rep (best-effort, non-blocking) — only if status is actually changing
                if (!status.includes('inprogress') && repEmail && typeof emailjs !== 'undefined') {
                    var repName = resolveRepName(repEmail);
                    var repAddr = REP_MAP[repName] || repEmail;
                    emailjs.send(EMAILJS_SERVICE_ID, 'template_art_in_progress', {
                        to_email: repAddr,
                        to_name: repName || 'Sales Team',
                        design_id: designId,
                        company_name: company,
                        detail_link: SITE_ORIGIN + '/art-request/' + designId + '?view=ae',
                        from_name: 'Steve — Art Department'
                    }, EMAILJS_PUBLIC_KEY).catch(function (err) {
                        console.warn('In Progress email failed (non-blocking):', err);
                    });
                }

                setTimeout(function () { location.reload(); }, 1200);
            }).catch(function (err) {
                btnWorking.textContent = 'Error';
                btnWorking.style.background = '#dc3545';
                console.error('Working action failed:', err);
                setTimeout(function () { btnWorking.textContent = 'In Progress'; btnWorking.style.background = ''; btnWorking.disabled = false; }, 2000);
            });
        });

        // Log Time button in billing card header
        var btnLogTimeBilling = document.getElementById('ard-btn-log-time-billing');
        if (btnLogTimeBilling && !isCompleted) {
            btnLogTimeBilling.style.display = '';
            btnLogTimeBilling.addEventListener('click', function () {
                ArtActions.showLogTimeModal(designId, req.Status || 'In Progress 🔵');
            });
        }

        btnComplete.addEventListener('click', function () {
            ArtActions.showArtTimeModal(designId, repEmail, company);
        });

        var isAwaitingApproval = status.includes('awaitingapproval');
        if (isAwaitingApproval) {
            btnMockup.textContent = 'Send Reminder';
            btnMockup.title = 'Re-send mockup notification to sales rep';
        }

        btnMockup.addEventListener('click', function () {
            if (isAwaitingApproval) {
                var mockupUrl = req.Box_File_Mockup || req.BoxFileLink || req.Company_Mockup || '';
                ArtActions.sendMockupReminder(designId, mockupUrl, repEmail, company, btnMockup);
            } else {
                ArtActions.showSendForApprovalModal(designId, company);
            }
        });

        btnReopen.addEventListener('click', function () {
            if (!confirm('Reopen this art request?')) return;
            btnReopen.disabled = true;
            btnReopen.textContent = 'Reopening...';
            fetch(API_BASE + '/api/art-requests/' + designId + '/status', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'In Progress' })
            }).then(function (resp) {
                if (!resp.ok) throw new Error('Status ' + resp.status);
                return fetch(API_BASE + '/api/art-requests/' + designId + '/note', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ noteType: 'Status Change', noteText: 'Reopened from Completed', noteBy: getLoggedInUser().email })
                });
            }).then(function () {
                ArtActions.notifyReopen(designId);
                btnReopen.textContent = 'Reopened!';
                btnReopen.style.background = '#28a745';
                setTimeout(function () { location.reload(); }, 1200);
            }).catch(function (err) {
                btnReopen.textContent = 'Error';
                btnReopen.style.background = '#dc3545';
                console.error('Reopen failed:', err);
                setTimeout(function () { btnReopen.textContent = 'Reopen'; btnReopen.style.background = ''; btnReopen.disabled = false; }, 2000);
            });
        });

        // Initialize approval modal listeners for Send Mockup
        ArtActions.initApprovalModalListeners();
    }

    // sendMockupReminder moved to art-actions-shared.js as ArtActions.sendMockupReminder

    // ── Garments & Colors ─────────────────────────────────────────────────
    function renderGarments(req) {
        var container = document.getElementById('ard-garments-body');
        var card = document.getElementById('ard-garments-card');
        var ROWS = [
            { style: 'GarmentStyle', color: 'GarmentColor', swatch: 'Swatch_1', image: 'MAIN_IMAGE_URL_1', num: 1 },
            { style: 'Garm_Style_2', color: 'Garm_Color_2', swatch: 'Swatch_2', image: 'MAIN_IMAGE_URL_2', num: 2 },
            { style: 'Garm_Style_3', color: 'Garm_Color_3', swatch: 'Swatch_3', image: 'MAIN_IMAGE_URL_3', num: 3 },
            { style: 'Garm_Style_4', color: 'Garm_Color_4', swatch: 'Swatch_4', image: 'MAIN_IMAGE_URL_4', num: 4 }
        ];
        var hasAny = false;
        var html = '';
        ROWS.forEach(function (row) {
            var style = req[row.style] || '';
            var color = req[row.color] || '';
            if (!style && !color) return;
            hasAny = true;
            var swatchUrl = req[row.swatch] || '';
            var imageUrl = req[row.image] || '';
            html += '<div class="ard-garment-row">';
            html += '<div class="ard-garment-info">';
            html += '<div class="ard-garment-num">Garment ' + row.num + '</div>';
            html += '<div class="ard-garment-style">' + escapeHtml(style) + '</div>';
            if (color) html += '<div class="ard-garment-color">' + escapeHtml(color) + '</div>';
            html += '</div>';
            html += '<div class="ard-garment-images">';
            if (swatchUrl) {
                html += '<img class="ard-garment-thumb" src="' + escapeHtml(swatchUrl) + '" alt="Swatch" title="Color Swatch" loading="lazy" onerror="this.style.display=\'none\'">';
            }
            if (imageUrl) {
                html += '<img class="ard-garment-thumb" src="' + escapeHtml(imageUrl) + '" alt="Model" title="Model Image" loading="lazy" onerror="this.style.display=\'none\'">';
            }
            html += '</div></div>';
        });
        if (hasAny) {
            card.style.display = '';
            container.innerHTML = html;
            // Lightbox click on garment thumbnails
            container.querySelectorAll('.ard-garment-thumb').forEach(function (img) {
                img.style.cursor = 'pointer';
                img.addEventListener('click', function () {
                    document.getElementById('ard-lightbox-img').src = img.src;
                    document.getElementById('ard-lightbox-label').textContent = img.alt + ' - ' + img.title;
                    document.getElementById('ard-lightbox').style.display = 'flex';
                });
            });
        }
    }

    // ── Final Approved Mockup ────────────────────────────────────────────

    function renderFinalMockup(req) {
        var section = document.getElementById('ard-final-mockup-section');
        var container = document.getElementById('ard-final-mockup-container');
        var finalUrl = req.Final_Approved_Mockup;

        if (!finalUrl || isEmptySlot(finalUrl)) {
            section.style.display = 'none';
            // Remove draft overlay from mockup slots
            var mockupsSection = document.getElementById('ard-mockups-section');
            if (mockupsSection) mockupsSection.classList.remove('ard-drafts-dimmed');
            return;
        }

        section.style.display = '';
        container.innerHTML = '';

        var ext = getFileExtension(finalUrl);
        var isImage = IMAGE_EXTENSIONS.indexOf(ext) !== -1;

        var card = document.createElement('div');
        card.className = 'ard-final-mockup-card';

        // Determine which slot label this came from
        var sourceLabel = '';
        MOCKUP_SLOTS.forEach(function (slot) {
            if (req[slot.key] === finalUrl) sourceLabel = slot.label;
        });

        if (isImage) {
            card.innerHTML = '<img src="' + escapeHtml(finalUrl) + '" alt="Final Approved Mockup" loading="lazy"'
                + ' onerror="this.style.display=\'none\';">'
                + '<div class="ard-final-mockup-badge">✅ Production Ready</div>'
                + (sourceLabel ? '<div class="ard-final-mockup-source">From: ' + escapeHtml(sourceLabel) + '</div>' : '');
        } else {
            var fileIcon = getFileTypeIcon(ext ? ext.toUpperCase() : '');
            card.innerHTML = '<div class="ard-gallery-placeholder">' + fileIcon
                + '<span class="ard-gallery-ext-badge">' + escapeHtml(ext ? ext.toUpperCase() : 'FILE') + '</span></div>'
                + '<div class="ard-final-mockup-badge">✅ Production Ready</div>';
        }

        card.addEventListener('click', function () {
            if (isImage) {
                openLightbox(finalUrl, 'Final Approved Mockup');
            } else {
                window.open(finalUrl, '_blank');
            }
        });

        container.appendChild(card);

        // Add "Change" button for Steve (not AE or customer view)
        if (!isAeView && !isCustomerView) {
            var changeBtn = document.createElement('button');
            changeBtn.type = 'button';
            changeBtn.className = 'ard-final-change-btn';
            changeBtn.textContent = 'Change Final Mockup';
            changeBtn.addEventListener('click', function () {
                if (!confirm('Clear the final approved mockup? You can then set a different one.')) return;
                setFinalMockup('');
            });
            container.appendChild(changeBtn);
        }

        // Dim draft mockup slots
        var mockupsSection = document.getElementById('ard-mockups-section');
        if (mockupsSection) mockupsSection.classList.add('ard-drafts-dimmed');
    }

    function setFinalMockup(url) {
        var pkId = currentRequest.PK_ID;
        if (!pkId) { alert('Cannot update: missing PK_ID'); return; }

        fetch(API_BASE + '/api/artrequests/' + pkId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Final_Approved_Mockup: url })
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Failed to update: ' + resp.status);
            currentRequest.Final_Approved_Mockup = url;
            renderFinalMockup(currentRequest);
            renderMockupGallery(currentRequest);
            if (url) {
                showArdToast('Final approved mockup set! Don\'t forget to invoice the art charge.');
                // Log note
                fetch(API_BASE + '/api/art-requests/' + designId + '/note', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ noteType: 'Final Approved', noteText: 'Set final approved mockup for production', noteBy: getLoggedInUser().email })
                }).catch(function () {});
                if (typeof refreshNotes === 'function') refreshNotes();
                // Notify AE that final mockup is production-ready
                var aeEmail = currentRequest.User_Email || currentRequest.Sales_Rep || '';
                var company = currentRequest.CompanyName || '';
                if (aeEmail && typeof emailjs !== 'undefined') {
                    emailjs.init(EMAILJS_PUBLIC_KEY);
                    emailjs.send(EMAILJS_SERVICE_ID, 'template_art_note_added', {
                        to_email: aeEmail,
                        to_name: aeEmail.split('@')[0],
                        design_id: designId,
                        company_name: company,
                        note_text: 'Final approved mockup has been set for ' + company + ' #' + designId + '. Ready for production.',
                        note_type: 'Production Ready',
                        detail_link: SITE_ORIGIN + '/art-request/' + designId + '?view=ae',
                        from_name: 'Steve'
                    }, EMAILJS_PUBLIC_KEY).catch(function () {});
                }
            } else {
                showArdToast('Final mockup cleared');
            }
        }).catch(function (err) {
            alert('Error: ' + err.message);
        });
    }

    // ── Mockup Gallery (Unified Two-Section) ────────────────────────────
    // Writable mockup slots Steve controls
    const MOCKUP_SLOTS = [
        { key: 'Box_File_Mockup', label: 'Mockup' },
        { key: 'BoxFileLink', label: 'Mockup 2' },
        { key: 'Company_Mockup', label: 'Mockup 3' }
    ];
    // Read-only artwork fields from AE uploads
    const READ_ONLY_FIELDS = [
        { key: 'File_Upload', label: 'Original Upload' },
        { key: 'CDN_Link', label: 'Artwork 1' },
        { key: 'CDN_Link_Two', label: 'Artwork 2' },
        { key: 'CDN_Link_Three', label: 'Artwork 3' },
        { key: 'CDN_Link_Four', label: 'Artwork 4' }
    ];
    const WRITABLE_KEYS = MOCKUP_SLOTS.map(function (s) { return s.key; });

    /** Return an inline SVG icon for known file types, or empty string */
    function getFileTypeIcon(ext) {
        var e = (ext || '').toUpperCase();
        if (e === 'PDF') {
            return '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">'
                + '<rect x="4" y="2" width="32" height="36" rx="3" fill="#E53E3E"/>'
                + '<rect x="8" y="6" width="24" height="6" rx="1" fill="#FEB2B2"/>'
                + '<text x="20" y="30" text-anchor="middle" fill="#fff" font-size="11" font-weight="700" font-family="Arial,sans-serif">PDF</text>'
                + '</svg>';
        }
        if (e === 'EPS') {
            return '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">'
                + '<rect x="4" y="2" width="32" height="36" rx="3" fill="#DD6B20"/>'
                + '<rect x="8" y="6" width="24" height="6" rx="1" fill="#FEEBC8"/>'
                + '<text x="20" y="30" text-anchor="middle" fill="#fff" font-size="11" font-weight="700" font-family="Arial,sans-serif">EPS</text>'
                + '</svg>';
        }
        if (e === 'AI') {
            return '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">'
                + '<rect x="4" y="2" width="32" height="36" rx="3" fill="#D69E2E"/>'
                + '<rect x="8" y="6" width="24" height="6" rx="1" fill="#FEFCBF"/>'
                + '<text x="20" y="30" text-anchor="middle" fill="#fff" font-size="11" font-weight="700" font-family="Arial,sans-serif">AI</text>'
                + '</svg>';
        }
        if (e === 'SVG') {
            return '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">'
                + '<rect x="4" y="2" width="32" height="36" rx="3" fill="#38A169"/>'
                + '<rect x="8" y="6" width="24" height="6" rx="1" fill="#C6F6D5"/>'
                + '<text x="20" y="30" text-anchor="middle" fill="#fff" font-size="11" font-weight="700" font-family="Arial,sans-serif">SVG</text>'
                + '</svg>';
        }
        return '';
    }

    /** Check if a Caspio field value is empty or a bare CDN base URL */
    function isEmptySlot(val) {
        if (!val || !val.trim()) return true;
        return /^https?:\/\/cdn\.caspio\.com\/[A-Z0-9]+\/?$/i.test(val.trim());
    }

    // ── Revision Feedback Banner ────────────────────────────────────────────
    function renderRevisionBanner(req, notes) {
        var banner = document.getElementById('ard-revision-banner');
        if (!banner) return;

        var statusLower = (req.Status || '').toLowerCase().replace(/\s+/g, '');
        if (statusLower !== 'revisionrequested' || isCustomerView) {
            banner.style.display = 'none';
            return;
        }

        // Find the latest revision note (Note_Type contains 'revision' or text starts with 'Revision requested')
        var revisionNote = null;
        if (notes && notes.length > 0) {
            for (var i = notes.length - 1; i >= 0; i--) {
                var nt = (notes[i].Note_Type || '').toLowerCase();
                var txt = notes[i].Note_Text || '';
                if (nt.indexOf('revision') !== -1 || txt.indexOf('Revision requested by') === 0) {
                    revisionNote = notes[i];
                    break;
                }
            }
        }

        if (!revisionNote) {
            banner.style.display = 'none';
            return;
        }

        var authorName = revisionNote.Note_By || 'AE';
        var noteText = revisionNote.Note_Text || '';
        // Strip "Revision requested by Name: " prefix if present
        noteText = noteText.replace(/^Revision requested by [^:]+:\s*/, '');

        // Check if the note has per-mockup sections (format: **Mockup N:** text)
        var perMockupPattern = /\*\*(Mockup[^:]*?):\*\*/g;
        var hasPerMockup = perMockupPattern.test(noteText);

        var feedbackHtml = '';
        if (hasPerMockup) {
            var sections = noteText.split(/\*\*Mockup[^:]*?:\*\*\s*/);
            var labels = noteText.match(/\*\*(Mockup[^:]*?):\*\*/g) || [];
            for (var j = 0; j < labels.length; j++) {
                var label = labels[j].replace(/\*\*/g, '');
                var text = (sections[j + 1] || '').trim();
                if (!text) continue;
                // Try to find matching mockup slot thumbnail
                var thumbUrl = '';
                for (var k = 0; k < MOCKUP_SLOTS.length; k++) {
                    if (label === MOCKUP_SLOTS[k].label && req[MOCKUP_SLOTS[k].key] && !isEmptySlot(req[MOCKUP_SLOTS[k].key])) {
                        thumbUrl = req[MOCKUP_SLOTS[k].key];
                        break;
                    }
                }
                feedbackHtml += '<div class="ard-rev-section">';
                if (thumbUrl) {
                    feedbackHtml += '<img src="' + escapeHtml(thumbUrl) + '" class="ard-rev-thumb" alt="' + escapeHtml(label) + '">';
                }
                feedbackHtml += '<div class="ard-rev-section-content">'
                    + '<strong>' + escapeHtml(label) + ':</strong> '
                    + escapeHtml(text)
                    + '</div></div>';
            }
        } else {
            feedbackHtml = '<div class="ard-rev-text">' + escapeHtml(noteText) + '</div>';
        }

        banner.style.display = '';
        banner.innerHTML = '<div class="ard-rev-icon">&#9888;&#65039;</div>'
            + '<div class="ard-rev-content">'
            + '<div class="ard-rev-title">Changes Requested by ' + escapeHtml(authorName) + '</div>'
            + feedbackHtml
            + '</div>';
    }

    function renderMockupGallery(req) {
        // Section 1: Writable mockup slots (always 3)
        var mockupsGrid = document.getElementById('ard-mockups-grid');
        mockupsGrid.innerHTML = '';

        MOCKUP_SLOTS.forEach(function (slot, index) {
            var url = req[slot.key];
            var isEmpty = isEmptySlot(url);

            // Customer view: skip empty slots entirely
            if (isCustomerView && isEmpty) return;

            if (isEmpty) {
                // Empty slot — clickable "+" placeholder
                var emptyEl = document.createElement('div');
                emptyEl.className = 'ard-slot-empty';
                emptyEl.dataset.slotIndex = index;
                emptyEl.dataset.fieldKey = slot.key;
                emptyEl.innerHTML = '<span class="ard-slot-empty-icon">+</span>'
                    + '<span class="ard-slot-empty-text">Add Mockup</span>'
                    + '<span class="ard-slot-empty-label">' + escapeHtml(slot.label) + '</span>';

                // Drag target: accept filled mockups being dropped here
                emptyEl.addEventListener('dragover', function (e) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    emptyEl.classList.add('drag-over');
                });
                emptyEl.addEventListener('dragleave', function () {
                    emptyEl.classList.remove('drag-over');
                });
                emptyEl.addEventListener('drop', function (e) {
                    e.preventDefault();
                    emptyEl.classList.remove('drag-over');
                    var fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                    if (isNaN(fromIdx) || fromIdx === index) return;
                    swapMockupSlots(fromIdx, index);
                });

                // Click opens popover
                emptyEl.addEventListener('click', function (e) {
                    e.stopPropagation();
                    showSlotPopover(emptyEl, slot.key);
                });

                mockupsGrid.appendChild(emptyEl);
            } else {
                // Filled slot — thumbnail with remove + drag
                var thumb = renderFilledThumb(url, slot, !isCustomerView);
                thumb.dataset.slotIndex = index;
                thumb.dataset.fieldKey = slot.key;
                if (!isCustomerView) thumb.setAttribute('draggable', 'true');

                if (!isCustomerView) {
                    // Drag start
                    thumb.addEventListener('dragstart', function (e) {
                        e.dataTransfer.setData('text/plain', index.toString());
                        e.dataTransfer.effectAllowed = 'move';
                        thumb.classList.add('dragging');
                    });
                    thumb.addEventListener('dragend', function () {
                        thumb.classList.remove('dragging');
                        document.querySelectorAll('.drag-over').forEach(function (el) { el.classList.remove('drag-over'); });
                    });
                    // Drag target
                    thumb.addEventListener('dragover', function (e) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        thumb.classList.add('drag-over');
                    });
                    thumb.addEventListener('dragleave', function () {
                        thumb.classList.remove('drag-over');
                    });
                    thumb.addEventListener('drop', function (e) {
                        e.preventDefault();
                        thumb.classList.remove('drag-over');
                        var fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                        if (isNaN(fromIdx) || fromIdx === index) return;
                        swapMockupSlots(fromIdx, index);
                    });

                    // "Set as Final" button (Steve view only, not AE)
                    if (!isAeView) {
                        var isFinal = req.Final_Approved_Mockup === url;
                        var setFinalBtn = document.createElement('button');
                        setFinalBtn.type = 'button';
                        setFinalBtn.className = 'ard-set-final-btn' + (isFinal ? ' ard-set-final-btn--active' : '');
                        setFinalBtn.textContent = isFinal ? '✅ Final' : 'Set as Final';
                        setFinalBtn.title = isFinal ? 'This is the production-ready mockup' : 'Set this as the final approved mockup';
                        if (!isFinal) {
                            (function (slotUrl) {
                                setFinalBtn.addEventListener('click', function (e) {
                                    e.stopPropagation();
                                    showFinalChecklistModal(slotUrl);
                                });
                            })(url);
                        }
                        thumb.appendChild(setFinalBtn);
                    }
                }

                mockupsGrid.appendChild(thumb);
            }
        });

        // Wire up remove buttons on mockup slots
        if (!isCustomerView) {
            wireRemoveButtons(mockupsGrid);
        }

        // Customer view: show "no mockups" if grid is empty
        if (isCustomerView && mockupsGrid.children.length === 0) {
            var noMockups = document.createElement('div');
            noMockups.style.cssText = 'text-align:center; padding:24px; color:#999; font-size:14px;';
            noMockups.textContent = 'No mockups available yet.';
            mockupsGrid.appendChild(noMockups);
        }

        // Section 2: Read-only artwork (only shows populated fields) — hidden for customer view
        var artworkGrid = document.getElementById('ard-artwork-grid');
        var artworkSection = document.getElementById('ard-artwork-section');
        artworkGrid.innerHTML = '';

        if (isCustomerView) {
            artworkSection.style.display = 'none';
        } else {
            var artCount = 0;
            READ_ONLY_FIELDS.forEach(function (field) {
                var url = req[field.key];
                if (isEmptySlot(url)) return;
                artCount++;
                var thumb = renderFilledThumb(url, field, false);
                artworkGrid.appendChild(thumb);
            });
            artworkSection.style.display = artCount > 0 ? '' : 'none';
        }
    }

    /** Render a filled gallery thumbnail for a file */
    function renderFilledThumb(url, field, showRemove) {
        var thumb = document.createElement('div');
        thumb.className = 'ard-gallery-thumb';
        var ext = getFileExtension(url);
        var extLabel = ext ? ext.toUpperCase() : 'FILE';
        var isImage = IMAGE_EXTENSIONS.indexOf(ext) !== -1;

        var removeBtnHtml = '';
        if (showRemove) {
            removeBtnHtml = '<button type="button" class="ard-gallery-remove" title="Remove mockup" data-field-key="'
                + escapeHtml(field.key) + '" data-field-label="' + escapeHtml(field.label) + '">&times;</button>';
        }

        if (isImage) {
            thumb.innerHTML = removeBtnHtml
                + '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(field.label) + '" loading="lazy"'
                + ' onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">'
                + '<div class="ard-gallery-placeholder" style="display:none;">'
                + '<span class="ard-gallery-ext-badge">' + escapeHtml(extLabel) + '</span></div>'
                + '<div class="ard-gallery-label">' + escapeHtml(field.label) + '</div>';
        } else {
            var fileIcon = getFileTypeIcon(extLabel);
            thumb.innerHTML = removeBtnHtml
                + '<div class="ard-gallery-placeholder">' + fileIcon
                + '<span class="ard-gallery-ext-badge">' + escapeHtml(extLabel) + '</span>'
                + '<span class="ard-gallery-download-hint">Click to download</span></div>'
                + '<div class="ard-gallery-label">' + escapeHtml(field.label) + '</div>';
        }

        thumb.addEventListener('click', function (e) {
            if (e.target.closest('.ard-gallery-remove')) return;
            if (isImage) {
                openLightbox(url, field.label);
            } else {
                window.open(url, '_blank');
            }
        });

        return thumb;
    }

    /** Wire up remove (x) buttons inside a container */
    function wireRemoveButtons(container) {
        container.querySelectorAll('.ard-gallery-remove').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var fieldKey = btn.dataset.fieldKey;
                var fieldLabel = btn.dataset.fieldLabel;
                if (!confirm('Remove this mockup (' + fieldLabel + ')?')) return;

                var pkId = currentRequest.PK_ID;
                if (!pkId) { alert('Cannot remove: missing PK_ID'); return; }

                btn.disabled = true;
                btn.textContent = '...';

                var body = {};
                body[fieldKey] = '';
                fetch(API_BASE + '/api/artrequests/' + pkId, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                }).then(function (resp) {
                    if (!resp.ok) throw new Error('Failed to clear mockup: ' + resp.status);
                    currentRequest[fieldKey] = '';
                    // Delete AI analysis for this slot (fire-and-forget)
                    fetch(API_BASE + '/api/art-requests/' + designId + '/analysis/' + encodeURIComponent(fieldKey), { method: 'DELETE' }).catch(function () {});
                    return fetch(API_BASE + '/api/art-requests/' + designId + '/note', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ noteType: 'Mockup Removed', noteText: 'Removed mockup from ' + fieldLabel, noteBy: getLoggedInUser().email })
                    });
                }).then(function () {
                    renderMockupGallery(currentRequest);
                    loadVisionAnalysis(); // Refresh vision section
                    if (typeof refreshNotes === 'function') refreshNotes();
                }).catch(function (err) {
                    alert('Error removing mockup: ' + err.message);
                    btn.disabled = false;
                    btn.textContent = '\u00d7';
                });
            });
        });
    }

    /** Swap two mockup slot values (optimistic UI + Caspio PUT) */
    async function swapMockupSlots(fromIdx, toIdx) {
        var fromField = MOCKUP_SLOTS[fromIdx].key;
        var toField = MOCKUP_SLOTS[toIdx].key;
        var fromUrl = currentRequest[fromField] || '';
        var toUrl = currentRequest[toField] || '';

        // Optimistic UI
        currentRequest[fromField] = toUrl;
        currentRequest[toField] = fromUrl;
        renderMockupGallery(currentRequest);

        try {
            var body = {};
            body[fromField] = toUrl;
            body[toField] = fromUrl;
            var resp = await fetch(API_BASE + '/api/artrequests/' + currentRequest.PK_ID, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!resp.ok) throw new Error('Swap failed: ' + resp.status);
        } catch (err) {
            // Revert on failure
            currentRequest[fromField] = fromUrl;
            currentRequest[toField] = toUrl;
            renderMockupGallery(currentRequest);
            alert('Could not reorder mockups: ' + err.message);
        }
    }

    // ── Gallery Interactions (Popover + Upload + Box Picker) ──────────
    var activeSlotKey = null; // which slot is being uploaded to
    var boxFoldersCache = null; // cache loaded folders
    var selectedBoxFile = null; // {id, name} for Box picker modal

    function initGalleryInteractions(req) {
        // Popover: Upload File
        var popUpload = document.getElementById('ard-pop-upload');
        var slotFileInput = document.getElementById('ard-slot-file-input');
        if (popUpload) {
            popUpload.addEventListener('click', function () {
                hideSlotPopover();
                if (slotFileInput) slotFileInput.click();
            });
        }
        if (slotFileInput) {
            slotFileInput.addEventListener('change', function () {
                if (slotFileInput.files.length > 0 && activeSlotKey) {
                    uploadFileToSlot(slotFileInput.files[0], activeSlotKey);
                    slotFileInput.value = '';
                }
            });
        }

        // Popover: Browse Box
        var popBox = document.getElementById('ard-pop-box');
        if (popBox) {
            popBox.addEventListener('click', function () {
                hideSlotPopover();
                openBoxPickerModal(activeSlotKey);
            });
        }

        // Box modal close/cancel
        var boxClose = document.getElementById('ard-box-modal-close');
        var boxCancel = document.getElementById('ard-box-modal-cancel');
        var boxConfirm = document.getElementById('ard-box-modal-confirm');
        if (boxClose) boxClose.addEventListener('click', closeBoxModal);
        if (boxCancel) boxCancel.addEventListener('click', closeBoxModal);
        document.getElementById('ard-box-modal-overlay').addEventListener('click', closeBoxModal);

        // Box modal confirm
        if (boxConfirm) {
            boxConfirm.addEventListener('click', async function () {
                if (!selectedBoxFile || !activeSlotKey) return;
                boxConfirm.disabled = true;
                boxConfirm.textContent = 'Creating link...';

                try {
                    // Create shared link
                    var linkResp = await fetch(API_BASE + '/api/box/shared-link', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileId: selectedBoxFile.id })
                    });
                    if (!linkResp.ok) throw new Error('Failed to create shared link');
                    var linkData = await linkResp.json();
                    var mockupUrl = linkData.downloadUrl || linkData.sharedLink;

                    // Save to specific Caspio field
                    var pkId = currentRequest.PK_ID;
                    var saveBody = {};
                    saveBody[activeSlotKey] = mockupUrl;
                    var saveResp = await fetch(API_BASE + '/api/artrequests/' + pkId, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(saveBody)
                    });
                    if (!saveResp.ok) throw new Error('Failed to save mockup URL');

                    currentRequest[activeSlotKey] = mockupUrl;

                    // Log audit note
                    fetch(API_BASE + '/api/art-requests/' + designId + '/note', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ noteType: 'Mockup Added', noteText: 'Added mockup from Box: ' + selectedBoxFile.name, noteBy: getLoggedInUser().email })
                    }).catch(function () {});

                    closeBoxModal();
                    renderMockupGallery(currentRequest);
                    if (typeof refreshNotes === 'function') refreshNotes();
                } catch (err) {
                    alert('Error: ' + err.message);
                    boxConfirm.disabled = false;
                    boxConfirm.textContent = 'Select File';
                }
            });
        }

        // Close popover on outside click
        document.addEventListener('click', function (e) {
            var popover = document.getElementById('ard-slot-popover');
            if (popover && popover.style.display !== 'none') {
                if (!e.target.closest('#ard-slot-popover') && !e.target.closest('.ard-slot-empty')) {
                    hideSlotPopover();
                }
            }
        });
    }

    /** Show upload popover anchored below a slot element */
    function showSlotPopover(slotEl, fieldKey) {
        activeSlotKey = fieldKey;
        var popover = document.getElementById('ard-slot-popover');
        var rect = slotEl.getBoundingClientRect();
        var scrollY = window.scrollY;
        popover.style.top = (rect.bottom + scrollY + 4) + 'px';
        popover.style.left = rect.left + 'px';
        popover.style.display = '';
    }

    function hideSlotPopover() {
        document.getElementById('ard-slot-popover').style.display = 'none';
    }

    /** Upload a local file to Box, then save URL to a specific Caspio field */
    async function uploadFileToSlot(file, fieldKey) {
        if (file.size > 20 * 1024 * 1024) {
            alert('File too large (max 20MB)');
            return;
        }

        // Show spinner on the slot
        var slotEl = document.querySelector('[data-field-key="' + fieldKey + '"]');
        if (slotEl) {
            var spinner = document.createElement('div');
            spinner.className = 'ard-slot-upload-spinner';
            slotEl.appendChild(spinner);
            slotEl.classList.add('ard-slot-uploading');
        }

        try {
            var pkId = currentRequest.PK_ID;
            if (!pkId) throw new Error('No PK_ID found');

            var formData = new FormData();
            formData.append('file', file);
            formData.append('pkId', String(pkId));
            formData.append('customerId', String(currentRequest.Shopwork_customer_number || currentRequest.id_customer || ''));
            formData.append('companyName', currentRequest.CompanyName || '');

            var resp = await fetch(API_BASE + '/api/art-requests/' + designId + '/upload-mockup', {
                method: 'POST',
                body: formData
            });
            if (!resp.ok) {
                var errData = await resp.json().catch(function () { return {}; });
                throw new Error(errData.error || 'Upload failed');
            }

            var result = await resp.json();
            // Backend auto-finds next empty slot. If it went to wrong field, swap.
            if (result.field !== fieldKey) {
                // Need to swap: move uploaded URL to correct slot
                var swapBody = {};
                swapBody[fieldKey] = result.url;
                swapBody[result.field] = currentRequest[fieldKey] || '';
                await fetch(API_BASE + '/api/artrequests/' + pkId, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(swapBody)
                });
                currentRequest[fieldKey] = result.url;
                currentRequest[result.field] = currentRequest[fieldKey] || '';
            } else {
                currentRequest[result.field] = result.url;
            }

            renderMockupGallery(currentRequest);
            if (typeof refreshNotes === 'function') refreshNotes();
        } catch (err) {
            alert('Upload failed: ' + err.message);
            renderMockupGallery(currentRequest);
        }
    }

    /** Open Box file picker modal for a specific slot */
    function openBoxPickerModal(fieldKey) {
        activeSlotKey = fieldKey;
        selectedBoxFile = null;
        var overlay = document.getElementById('ard-box-modal-overlay');
        var modal = document.getElementById('ard-box-modal');
        var confirmBtn = document.getElementById('ard-box-modal-confirm');
        overlay.style.display = '';
        modal.style.display = '';
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Select File';
        document.body.style.overflow = 'hidden';

        // Reset views
        document.getElementById('ard-box-folders-view').style.display = 'none';
        document.getElementById('ard-box-files-view').style.display = 'none';
        document.getElementById('ard-box-error').style.display = 'none';

        loadBoxFolders();
    }

    function closeBoxModal() {
        document.getElementById('ard-box-modal-overlay').style.display = 'none';
        document.getElementById('ard-box-modal').style.display = 'none';
        document.body.style.overflow = '';
        selectedBoxFile = null;
    }

    /** Load Box folders (cached after first load) */
    function loadBoxFolders() {
        var loadingEl = document.getElementById('ard-box-loading');
        var errorEl = document.getElementById('ard-box-error');

        if (boxFoldersCache) {
            showFolderList(boxFoldersCache);
            return;
        }

        loadingEl.style.display = 'flex';
        fetch(API_BASE + '/api/box/art-folders?limit=500')
            .then(function (resp) {
                loadingEl.style.display = 'none';
                if (!resp.ok) throw new Error('Box API ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                boxFoldersCache = data.folders || [];
                showFolderList(boxFoldersCache);
            })
            .catch(function (err) {
                loadingEl.style.display = 'none';
                errorEl.textContent = 'Could not load Box folders: ' + err.message;
                errorEl.style.display = 'block';
            });
    }

    function showFolderList(folders) {
        var foldersView = document.getElementById('ard-box-folders-view');
        var folderList = document.getElementById('ard-box-folder-list');
        var searchInput = document.getElementById('ard-box-search');
        foldersView.style.display = '';
        document.getElementById('ard-box-files-view').style.display = 'none';
        folderList.innerHTML = '';

        var query = (searchInput.value || '').trim().toLowerCase();
        var filtered = query
            ? folders.filter(function (f) { return f.name.toLowerCase().indexOf(query) !== -1; })
            : folders;

        if (filtered.length === 0) {
            folderList.innerHTML = '<div class="ard-box-folder-empty">No folders match your search.</div>';
            return;
        }

        filtered.forEach(function (folder) {
            var row = document.createElement('div');
            row.className = 'ard-box-folder-item';
            row.innerHTML = '<span class="ard-box-folder-icon">\uD83D\uDCC1</span><span class="ard-box-folder-name">' + escapeHtml(folder.name) + '</span>';
            row.addEventListener('click', function () { openBoxFolder(folder.id, folder.name); });
            folderList.appendChild(row);
        });

        // Wire search filtering
        if (!searchInput._wired) {
            searchInput._wired = true;
            var timer = null;
            searchInput.addEventListener('input', function () {
                clearTimeout(timer);
                timer = setTimeout(function () {
                    if (boxFoldersCache) showFolderList(boxFoldersCache);
                }, 200);
            });
        }
    }

    function openBoxFolder(folderId, folderName) {
        var foldersView = document.getElementById('ard-box-folders-view');
        var filesView = document.getElementById('ard-box-files-view');
        var folderEl = document.getElementById('ard-box-folder');
        var gridEl = document.getElementById('ard-box-grid');
        var emptyEl = document.getElementById('ard-box-files-empty');
        var confirmBtn = document.getElementById('ard-box-modal-confirm');

        foldersView.style.display = 'none';
        filesView.style.display = '';
        folderEl.textContent = '\uD83D\uDCC1 ' + folderName + ' \u2014 loading...';
        gridEl.innerHTML = '';
        gridEl.style.display = 'none';
        emptyEl.style.display = 'none';
        selectedBoxFile = null;
        confirmBtn.disabled = true;

        // Back button
        var backBtn = document.getElementById('ard-box-back');
        if (!backBtn._wired) {
            backBtn._wired = true;
            backBtn.addEventListener('click', function () {
                filesView.style.display = 'none';
                foldersView.style.display = '';
                selectedBoxFile = null;
                confirmBtn.disabled = true;
            });
        }

        fetch(API_BASE + '/api/box/folder-files?folderId=' + folderId)
            .then(function (resp) {
                if (!resp.ok) throw new Error('Box API ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                var files = data.files || [];
                folderEl.textContent = '\uD83D\uDCC1 ' + folderName + ' (' + files.length + ' files)';

                if (files.length === 0) {
                    emptyEl.style.display = 'block';
                    return;
                }

                gridEl.style.display = 'grid';
                var imageExts = ['jpg','jpeg','png','gif','bmp','tiff','tif','svg'];
                files.sort(function (a, b) {
                    var aImg = imageExts.indexOf((a.extension || '').toLowerCase()) !== -1 ? 0 : 1;
                    var bImg = imageExts.indexOf((b.extension || '').toLowerCase()) !== -1 ? 0 : 1;
                    return aImg - bImg;
                });

                files.forEach(function (file) {
                    var card = document.createElement('div');
                    card.className = 'ard-box-file-card';
                    var ext = (file.extension || '').toLowerCase();
                    var sizeKB = file.size ? Math.round(file.size / 1024) : 0;
                    var sizeLabel = sizeKB > 1024 ? (sizeKB / 1024).toFixed(1) + ' MB' : sizeKB + ' KB';
                    var dateLabel = '';
                    if (file.modified_at) {
                        var d = new Date(file.modified_at);
                        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                        dateLabel = months[d.getMonth()] + ' ' + d.getDate();
                        if (d.getFullYear() !== new Date().getFullYear()) dateLabel += ', ' + d.getFullYear();
                    }
                    var metaLabel = dateLabel ? dateLabel + ' \u00b7 ' + sizeLabel : sizeLabel;

                    var phClass = 'ard-box-file-placeholder';
                    if (imageExts.indexOf(ext) !== -1) phClass += ' ph-image';
                    else if (['psd','ai','eps','cdr','indd','indt','idml'].indexOf(ext) !== -1) phClass += ' ph-design';
                    else if (ext === 'pdf') phClass += ' ph-pdf';

                    var thumbSrc = file.thumbnailUrl ? API_BASE + file.thumbnailUrl : '';
                    card.innerHTML =
                        (thumbSrc
                            ? '<img src="' + escapeHtml(thumbSrc) + '" alt="' + escapeHtml(file.name) + '" loading="lazy" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">'
                              + '<div class="' + phClass + '" style="display:none;">' + escapeHtml(ext.toUpperCase() || 'FILE') + '</div>'
                            : '<div class="' + phClass + '">' + escapeHtml(ext.toUpperCase() || 'FILE') + '</div>'
                        )
                        + '<div class="ard-box-file-name">' + escapeHtml(file.name) + '</div>'
                        + '<div class="ard-box-file-meta">' + escapeHtml(metaLabel) + '</div>'
                        + '<div class="ard-box-file-check">\u2713</div>';

                    card.addEventListener('click', function () {
                        // Single select — deselect others
                        gridEl.querySelectorAll('.ard-box-file-card.selected').forEach(function (c) { c.classList.remove('selected'); });
                        card.classList.add('selected');
                        selectedBoxFile = { id: file.id, name: file.name };
                        confirmBtn.disabled = false;
                    });

                    gridEl.appendChild(card);
                });
            })
            .catch(function (err) {
                folderEl.textContent = '\uD83D\uDCC1 ' + folderName;
                emptyEl.textContent = 'Could not load files: ' + err.message;
                emptyEl.style.display = 'block';
            });
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

    // ── Share with Customer ────────────────────────────────────────────
    function initShareWithCustomer(req) {
        var overlay = document.getElementById('share-customer-overlay');
        var modal = document.getElementById('share-customer-modal');
        var btn = document.getElementById('ard-btn-share-customer');
        var closeBtn = document.getElementById('share-customer-close');
        var cancelBtn = document.getElementById('share-customer-cancel');
        var sendBtn = document.getElementById('share-customer-send');
        var emailInput = document.getElementById('share-customer-email');
        var nameInput = document.getElementById('share-customer-name');
        var messageInput = document.getElementById('share-customer-message');
        var previewSection = document.getElementById('share-customer-preview');
        var previewImg = document.getElementById('share-customer-preview-img');
        var repInfo = document.getElementById('share-customer-rep-info');

        var contactEmail = req.Email_Contact || req.Email || '';
        var contactName = ((req.First_name || req.First_Name || '') + ' ' + (req.Last_name || req.Last_Name || '')).trim();
        var mockupUrl = req.Box_File_Mockup || req.BoxFileLink || req.Company_Mockup || '';
        var repEmail = req.User_Email || req.Sales_Rep || '';
        var repName = resolveRepName(repEmail);
        var repAddr = REP_MAP[repName] || repEmail;

        function openModal() {
            emailInput.value = contactEmail;
            nameInput.value = contactName;
            messageInput.value = 'Your mockup is ready for review. Please take a look and let us know if you\'d like any changes.';
            if (mockupUrl) {
                previewImg.src = mockupUrl;
                previewSection.style.display = '';
            } else {
                previewSection.style.display = 'none';
            }
            repInfo.textContent = 'Sending as ' + (repName || 'Sales Rep') + ' (' + repAddr + ')';
            overlay.style.display = 'block';
            modal.style.display = 'block';
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send to Customer';
        }

        function closeModal() {
            overlay.style.display = 'none';
            modal.style.display = 'none';
        }

        btn.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', closeModal);

        sendBtn.addEventListener('click', function () {
            var toEmail = emailInput.value.trim();
            var toName = nameInput.value.trim();
            var message = messageInput.value.trim();
            if (!toEmail) { emailInput.focus(); return; }
            if (!message) { messageInput.focus(); return; }

            sendBtn.disabled = true;
            sendBtn.textContent = 'Sending...';

            var templateParams = {
                to_email: toEmail,
                to_name: toName || 'Valued Customer',
                company_name: req.CompanyName || '',
                design_number: designId,
                message: message,
                mockup_url: mockupUrl,
                from_name: repName || 'Northwest Custom Apparel',
                rep_email: repAddr || 'sales@nwcustomapparel.com',
                rep_phone: '253-922-5793'
            };

            if (typeof emailjs !== 'undefined') {
                emailjs.init(EMAILJS_PUBLIC_KEY);
                emailjs.send(EMAILJS_SERVICE_ID, 'template_customer_mockup', templateParams)
                    .then(function () {
                        // Log audit note
                        fetch(API_BASE + '/api/art-requests/' + designId + '/note', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                noteType: 'Customer Share',
                                noteText: 'Mockup shared with customer: ' + toEmail,
                                noteBy: repAddr || 'sales@nwcustomapparel.com'
                            })
                        }).catch(function () { /* fire-and-forget */ });

                        // Post notification
                        fetch(API_BASE + '/api/art-notifications', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: 'customer_share',
                                designId: designId,
                                companyName: req.CompanyName || '',
                                actorName: repName || 'AE'
                            })
                        }).catch(function () { /* fire-and-forget */ });

                        // Success
                        closeModal();
                        showSuccessMessage('Mockup sent to ' + toEmail);

                        // Re-enable as "Send Again" after 30s
                        btn.disabled = true;
                        btn.textContent = 'Sent!';
                        btn.style.background = '#28a745';
                        btn.style.color = '#fff';
                        setTimeout(function () {
                            btn.disabled = false;
                            btn.textContent = 'Send Again';
                            btn.style.background = '';
                            btn.style.color = '';
                        }, 30000);
                    })
                    .catch(function (err) {
                        console.error('Share email failed:', err);
                        sendBtn.textContent = 'Failed — try again';
                        sendBtn.style.background = '#dc3545';
                        setTimeout(function () {
                            sendBtn.disabled = false;
                            sendBtn.textContent = 'Send to Customer';
                            sendBtn.style.background = '';
                        }, 3000);
                    });
            }
        });
    }

    // ── Customer View Functions ──────────────────────────────────────────

    /**
     * Render the customer action panel (approve/revise buttons)
     */
    function renderCustomerActionPanel(req, statusClean) {
        var statusLower = statusClean.toLowerCase().replace(/\s+/g, '');
        var galleryCard = document.getElementById('ard-gallery-card');
        if (!galleryCard) return;

        var panel = document.createElement('div');
        panel.className = 'ard-customer-action-panel';
        panel.id = 'ard-customer-action-panel';

        if (statusLower.includes('completed') || statusLower.includes('approved')) {
            // Already completed
            panel.innerHTML = '<div class="ard-customer-confirmation-icon">✅</div>'
                + '<h3 style="color:#059669; margin-bottom:8px;">Thank You!</h3>'
                + '<p style="color:#666;">This mockup has been approved.</p>'
                + '<p class="ard-confirmation-company" style="margin-top:16px; font-size:13px; color:#999;">'
                + escapeHtml(req.CompanyName || '') + ' — Design #' + escapeHtml(designId) + '</p>';
        } else if (statusLower.includes('awaitingapproval')) {
            // Ready for review
            panel.innerHTML = '<div class="ard-customer-action-prompt">'
                + 'Please review the mockup' + (MOCKUP_SLOTS.some(function (s) { return req[s.key] && !isEmptySlot(req[s.key]); }) ? 's' : '')
                + ' below. Click a mockup to select it, then approve or request changes.</div>'
                + '<div class="ard-customer-action-buttons">'
                + '<button class="ard-btn-customer-approve" id="ard-btn-customer-approve" disabled>Approve Selected Mockup</button>'
                + '<button class="ard-btn-customer-revise" id="ard-btn-customer-revise">Request Changes</button>'
                + '</div>';
        } else {
            // Not ready for review
            panel.innerHTML = '<div class="ard-customer-not-ready">'
                + '<div class="ard-customer-not-ready-icon">⏳</div>'
                + '<p>This mockup is not ready for review yet.<br>You\'ll receive a notification when it\'s ready.</p></div>';
        }

        // Insert before gallery card
        galleryCard.parentNode.insertBefore(panel, galleryCard);

        // Wire up buttons
        if (statusLower.includes('awaitingapproval')) {
            var approveBtn = document.getElementById('ard-btn-customer-approve');
            var reviseBtn = document.getElementById('ard-btn-customer-revise');

            if (approveBtn) {
                approveBtn.addEventListener('click', function () {
                    handleCustomerApproval(req);
                });
            }
            if (reviseBtn) {
                reviseBtn.addEventListener('click', function () {
                    openCustomerReviseModal(req);
                });
            }
        }
    }

    /**
     * Make mockup gallery slots selectable for customer view
     */
    function initCustomerMockupSelection(req) {
        var grid = document.getElementById('ard-mockups-grid');
        if (!grid) return;

        var thumbs = grid.querySelectorAll('.ard-gallery-thumb');
        if (thumbs.length === 0) return;

        // If only one mockup, auto-select it
        var filledThumbs = [];
        thumbs.forEach(function (thumb) {
            var key = thumb.dataset.fieldKey;
            if (key && req[key] && !isEmptySlot(req[key])) {
                filledThumbs.push(thumb);
            }
        });

        filledThumbs.forEach(function (thumb) {
            thumb.classList.add('ard-customer-selectable');

            // Add "Click to select" hint
            var hint = document.createElement('div');
            hint.className = 'ard-slot-select-hint';
            hint.textContent = 'Click to select';
            thumb.style.position = 'relative';
            thumb.appendChild(hint);

            thumb.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                // Deselect all
                grid.querySelectorAll('.ard-slot-selected').forEach(function (el) {
                    el.classList.remove('ard-slot-selected');
                    var badge = el.querySelector('.ard-slot-select-badge');
                    if (badge) badge.remove();
                    var hintEl = el.querySelector('.ard-slot-select-hint');
                    if (hintEl) hintEl.textContent = 'Click to select';
                });

                // Select this one
                thumb.classList.add('ard-slot-selected');
                var badge = document.createElement('div');
                badge.className = 'ard-slot-select-badge';
                badge.textContent = '✓ Selected';
                thumb.appendChild(badge);

                var hintEl = thumb.querySelector('.ard-slot-select-hint');
                if (hintEl) hintEl.textContent = '';

                selectedMockupSlot = thumb.dataset.fieldKey;

                // Enable approve button
                var approveBtn = document.getElementById('ard-btn-customer-approve');
                if (approveBtn) approveBtn.disabled = false;
            });
        });

        // Auto-select if only one filled mockup
        if (filledThumbs.length === 1) {
            filledThumbs[0].click();
        }
    }

    /**
     * Handle customer approval — update status + log note + notify
     */
    function handleCustomerApproval(req) {
        if (!selectedMockupSlot) {
            alert('Please select a mockup first.');
            return;
        }
        if (!confirm('Approve the selected mockup? This will notify the team.')) return;

        var approveBtn = document.getElementById('ard-btn-customer-approve');
        if (approveBtn) {
            approveBtn.disabled = true;
            approveBtn.textContent = 'Approving...';
        }

        // Find slot label
        var slotLabel = 'Mockup';
        MOCKUP_SLOTS.forEach(function (s) {
            if (s.key === selectedMockupSlot) slotLabel = s.label;
        });

        // 1. Update status to Completed
        fetch(API_BASE + '/api/art-requests/' + designId + '/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Completed' })
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Status update failed: ' + resp.status);

            // 2. Add approval note
            return fetch(API_BASE + '/api/art-requests/' + designId + '/note', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    noteType: 'Customer Approval',
                    noteText: 'Customer approved ' + slotLabel,
                    noteBy: 'customer'
                })
            });
        }).then(function () {
            // 3. Set Final_Approved_Mockup (fire-and-forget)
            var mockupUrl = req[selectedMockupSlot] || '';
            if (mockupUrl && currentRequest && currentRequest.PK_ID) {
                fetch(API_BASE + '/api/artrequests/' + currentRequest.PK_ID, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ Final_Approved_Mockup: mockupUrl })
                }).catch(function () { /* fire-and-forget */ });
            }

            // 4. Notify Steve + AE
            sendCustomerNotifications('approved', req);

            // 5. Show confirmation
            showCustomerConfirmation('approved', req);
        }).catch(function (err) {
            console.error('Customer approval failed:', err);
            if (approveBtn) {
                approveBtn.textContent = 'Error — try again';
                approveBtn.style.background = '#dc3545';
                setTimeout(function () {
                    approveBtn.disabled = false;
                    approveBtn.textContent = 'Approve Selected Mockup';
                    approveBtn.style.background = '';
                }, 3000);
            }
        });
    }

    /**
     * Open the request changes modal for customer feedback
     */
    function openCustomerReviseModal(req) {
        // Reuse existing changes modal
        var overlay = document.getElementById('ard-changes-overlay');
        var modal = document.getElementById('ard-changes-modal');
        var textarea = document.getElementById('ard-changes-notes');
        var submitBtn = document.getElementById('ard-changes-submit');
        var cancelBtn = document.getElementById('ard-changes-cancel');

        if (!overlay || !modal) return;

        textarea.value = '';
        overlay.style.display = 'block';
        modal.style.display = 'block';
        textarea.focus();

        // Remove existing listeners by replacing button
        var newSubmit = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmit, submitBtn);
        var newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

        function closeModal() {
            overlay.style.display = 'none';
            modal.style.display = 'none';
        }

        newCancel.addEventListener('click', closeModal);
        overlay.addEventListener('click', closeModal);

        newSubmit.addEventListener('click', function () {
            var feedback = textarea.value.trim();
            if (!feedback) { textarea.focus(); return; }

            newSubmit.disabled = true;
            newSubmit.textContent = 'Submitting...';

            // 1. Update status to Revision Requested
            fetch(API_BASE + '/api/art-requests/' + designId + '/status', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Revision Requested' })
            }).then(function (resp) {
                if (!resp.ok) throw new Error('Status update failed: ' + resp.status);

                // 2. Add revision note with feedback
                return fetch(API_BASE + '/api/art-requests/' + designId + '/note', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        noteType: 'Customer Feedback',
                        noteText: 'Customer requested changes: ' + feedback,
                        noteBy: 'customer'
                    })
                });
            }).then(function () {
                closeModal();

                // 3. Notify Steve + AE
                sendCustomerNotifications('revision', req);

                // 4. Show confirmation
                showCustomerConfirmation('revision', req);
            }).catch(function (err) {
                console.error('Customer revision request failed:', err);
                newSubmit.textContent = 'Error — try again';
                newSubmit.style.background = '#dc3545';
                setTimeout(function () {
                    newSubmit.disabled = false;
                    newSubmit.textContent = 'Submit Revision Request';
                    newSubmit.style.background = '';
                }, 3000);
            });
        });
    }

    /**
     * Show full-page confirmation after customer action
     */
    function showCustomerConfirmation(type, req) {
        var content = document.getElementById('ard-content');
        if (!content) return;

        var icon, title, message;
        if (type === 'approved') {
            icon = '✅';
            title = 'Thank You!';
            message = 'Your mockup has been approved and the team has been notified. Production will proceed with your approved design.';
        } else {
            icon = '📝';
            title = 'Feedback Submitted';
            message = 'Your feedback has been received. The art team will review your changes and send an updated mockup.';
        }

        content.innerHTML = '<div class="ard-customer-confirmation">'
            + '<div class="ard-customer-confirmation-icon">' + icon + '</div>'
            + '<h2>' + title + '</h2>'
            + '<p>' + message + '</p>'
            + '<p class="ard-confirmation-company">'
            + escapeHtml(req.CompanyName || 'Northwest Custom Apparel') + ' — Design #' + escapeHtml(designId)
            + '</p></div>';
    }

    /**
     * Send email notifications to Steve + AE after customer action
     */
    function sendCustomerNotifications(type, req) {
        if (typeof emailjs === 'undefined') return;

        emailjs.init(EMAILJS_PUBLIC_KEY);

        var company = req.CompanyName || '';
        var noteText = type === 'approved'
            ? 'Customer approved mockup for ' + company + ' (Design #' + designId + ')'
            : 'Customer requested changes for ' + company + ' (Design #' + designId + ')';
        var noteType = type === 'approved' ? 'Customer Approval' : 'Customer Revision Request';

        // Notify Steve
        emailjs.send(EMAILJS_SERVICE_ID, 'template_art_note_added', {
            to_email: 'art@nwcustomapparel.com',
            to_name: 'Steve',
            design_id: designId,
            company_name: company,
            note_text: noteText,
            note_type: noteType,
            detail_link: SITE_ORIGIN + '/art-request/' + designId,
            from_name: 'Customer'
        }, EMAILJS_PUBLIC_KEY).catch(function (err) {
            console.warn('Steve notification failed:', err);
        });

        // Notify AE
        var repEmail = req.User_Email || req.Sales_Rep || '';
        var repName = resolveRepName(repEmail);
        var repAddr = REP_MAP[repName] || repEmail;
        if (repAddr) {
            emailjs.send(EMAILJS_SERVICE_ID, 'template_art_note_added', {
                to_email: repAddr,
                to_name: repName || 'Sales Rep',
                design_id: designId,
                company_name: company,
                note_text: noteText,
                note_type: noteType,
                detail_link: SITE_ORIGIN + '/art-request/' + designId + '?view=ae',
                from_name: 'Customer'
            }, EMAILJS_PUBLIC_KEY).catch(function (err) {
                console.warn('AE notification failed:', err);
            });
        }
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
        var slotsContainer = document.getElementById('ard-changes-slots');
        var generalNotes = document.getElementById('ard-changes-notes');

        // Build per-mockup feedback slots
        slotsContainer.innerHTML = '';
        var filledSlots = MOCKUP_SLOTS.filter(function (s) {
            return currentRequest && currentRequest[s.key] && !isEmptySlot(currentRequest[s.key]);
        });

        if (filledSlots.length > 0) {
            filledSlots.forEach(function (slot) {
                var thumbUrl = currentRequest[slot.key] || '';
                var slotDiv = document.createElement('div');
                slotDiv.className = 'ard-revise-slot';
                slotDiv.innerHTML = '<img src="' + escapeHtml(thumbUrl) + '" class="ard-revise-thumb" alt="' + escapeHtml(slot.label) + '">'
                    + '<div class="ard-revise-slot-right">'
                    + '<label class="ard-revise-slot-label">' + escapeHtml(slot.label) + '</label>'
                    + '<textarea class="ard-revise-slot-textarea" data-slot="' + escapeHtml(slot.label) + '" placeholder="Changes needed for ' + escapeHtml(slot.label) + '..."></textarea>'
                    + '</div>';
                slotsContainer.appendChild(slotDiv);
            });
        }

        generalNotes.value = '';
        document.getElementById('ard-changes-overlay').style.display = 'block';
        document.getElementById('ard-changes-modal').style.display = 'block';

        // Focus first slot textarea or general notes
        var firstSlotTextarea = slotsContainer.querySelector('.ard-revise-slot-textarea');
        if (firstSlotTextarea) {
            firstSlotTextarea.focus();
        } else {
            generalNotes.focus();
        }

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
            // Collect per-slot feedback
            var parts = [];
            var slotTextareas = slotsContainer.querySelectorAll('.ard-revise-slot-textarea');
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
            if (!combinedNotes) {
                if (firstSlotTextarea) {
                    firstSlotTextarea.style.borderColor = '#dc3545';
                } else {
                    generalNotes.style.borderColor = '#dc3545';
                }
                return;
            }
            const aeName = document.getElementById('ard-ae-select').value;
            requestChanges(designId, aeName, combinedNotes);
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
                    noteType: 'Revision Request',
                    noteText: notes,
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
        const detailLink = window.location.origin + window.location.pathname;

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
        if (!container) return;

        // Clear previous content
        container.innerHTML = '';

        if (!notes || notes.length === 0) {
            container.innerHTML = '<p class="ard-empty-notes">No notes recorded for this request.</p>';
            return;
        }

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

    // ── Refresh Notes (re-fetch and re-render) ────────────────────────
    function refreshNotes() {
        return fetch(API_BASE + '/api/design-notes?id_design=' + designId + '&orderBy=Note_Date DESC')
            .then(function (r) { return r.ok ? r.json() : []; })
            .then(function (data) { renderNotes(Array.isArray(data) ? data : (data.Result || [])); })
            .catch(function (err) { console.error('Notes refresh failed:', err); });
    }

    // ── Add Note Form ───────────────────────────────────────────────────
    function initAddNoteForm() {
        var toggle = document.getElementById('ard-add-note-toggle');
        var form = document.getElementById('ard-add-note-form');
        var submitBtn = document.getElementById('ard-note-submit');
        if (!toggle || !form || !submitBtn) return;

        toggle.addEventListener('click', function () {
            form.classList.toggle('open');
            toggle.textContent = form.classList.contains('open') ? '- Close' : '+ Add Note';
        });

        submitBtn.addEventListener('click', function () {
            var typeEl = document.getElementById('ard-note-type');
            var textEl = document.getElementById('ard-note-text');
            var noteType = typeEl.value;
            var noteText = textEl.value.trim();

            typeEl.classList.remove('error');
            textEl.classList.remove('error');
            if (!noteType) { typeEl.classList.add('error'); return; }
            if (!noteText) { textEl.classList.add('error'); return; }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            fetch(API_BASE + '/api/design-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ID_Design: parseInt(designId, 10),
                    Note_Type: noteType,
                    Note_Text: noteText,
                    Note_By: getLoggedInUser().email
                })
            }).then(function (resp) {
                if (!resp.ok) throw new Error('Save failed: ' + resp.status);

                // Notify sales rep if checked
                var notifyEl = document.getElementById('ard-note-notify');
                if (notifyEl && notifyEl.checked && currentRequest) {
                    var repEmail = currentRequest.User_Email || currentRequest.Sales_Rep || '';
                    var repName = resolveRepName(repEmail);
                    if (repEmail && typeof emailjs !== 'undefined') {
                        emailjs.send(EMAILJS_SERVICE_ID, 'template_art_note_added', {
                            to_email: repEmail,
                            to_name: repName,
                            design_id: designId,
                            company_name: currentRequest.CompanyName || '',
                            note_type: noteType,
                            note_text: noteText,
                            from_name: 'Steve (Art Dept)'
                        }, EMAILJS_PUBLIC_KEY).catch(function () { /* best effort */ });
                    }
                }

                // Clear form and collapse
                typeEl.value = '';
                textEl.value = '';
                if (notifyEl) notifyEl.checked = false;
                form.classList.remove('open');
                toggle.textContent = '+ Add Note';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Note';

                // Refresh notes timeline
                refreshNotes();
            }).catch(function (err) {
                console.error('Add note failed:', err);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Note';
                submitBtn.style.background = '#dc3545';
                setTimeout(function () { submitBtn.style.background = ''; }, 2000);
            });
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

    function showFinalChecklistModal(slotUrl) {
        // Remove existing modal if any
        var existing = document.getElementById('ard-final-checklist');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'ard-final-checklist';
        overlay.className = 'ard-checklist-overlay';
        overlay.innerHTML = '<div class="ard-checklist-modal">'
            + '<h3 style="margin:0 0 16px;color:#059669;">Ready to set as production-ready?</h3>'
            + '<label class="ard-checklist-item"><input type="checkbox"> Correct file resolution for print method</label>'
            + '<label class="ard-checklist-item"><input type="checkbox"> Placement matches order specs</label>'
            + '<label class="ard-checklist-item"><input type="checkbox"> Colors match PMS / customer approval</label>'
            + '<p style="font-size:12px;color:#9ca3af;margin:12px 0 0;font-style:italic;">Checklist is informational — not required to proceed.</p>'
            + '<div class="ard-checklist-btns">'
            + '<button type="button" class="ard-checklist-cancel">Cancel</button>'
            + '<button type="button" class="ard-checklist-confirm">Confirm Final ✅</button>'
            + '</div></div>';

        overlay.querySelector('.ard-checklist-cancel').addEventListener('click', function () { overlay.remove(); });
        overlay.querySelector('.ard-checklist-confirm').addEventListener('click', function () {
            overlay.remove();
            setFinalMockup(slotUrl);
        });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

        document.body.appendChild(overlay);
    }

    function showArdToast(message) {
        var toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#059669;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
        document.body.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 3000);
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

    // ── Invoice Audit — ShopWorks Art Charge Verification ─────────────
    var ART_CHARGE_PNS = ['Art', 'GRT-50', 'GRT-75'];

    function isArtChargePn(pn) {
        if (!pn) return false;
        return ART_CHARGE_PNS.indexOf(pn.trim()) !== -1;
    }

    function loadFullInvoice(orderNum, artBilled, prelimCharges) {
        var section = document.getElementById('ard-invoice-section');
        var body = document.getElementById('ard-audit-body');
        var toggle = document.getElementById('ard-invoice-toggle');
        var accordionBody = document.getElementById('ard-invoice-body');
        var icon = document.getElementById('ard-accordion-icon');
        var summary = document.getElementById('ard-invoice-summary');
        if (!section || !body) return;

        section.style.display = '';
        body.innerHTML = '<div class="ard-audit-loading">Loading invoice...</div>';

        // Wire up accordion toggle
        if (toggle && !toggle._wired) {
            toggle._wired = true;
            toggle.addEventListener('click', function () {
                var isOpen = accordionBody.style.display !== 'none';
                accordionBody.style.display = isOpen ? 'none' : '';
                icon.classList.toggle('expanded', !isOpen);
            });
        }

        // Auto-expand on load
        if (accordionBody) accordionBody.style.display = '';
        if (icon) icon.classList.add('expanded');

        // Fetch order header + line items in parallel
        Promise.all([
            fetch(API_BASE + '/api/manageorders/orders/' + encodeURIComponent(orderNum))
                .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }),
            fetch(API_BASE + '/api/manageorders/lineitems/' + encodeURIComponent(orderNum))
                .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        ])
        .then(function (results) {
            var orderData = (results[0].result || [])[0] || null;
            var lineItems = results[1].result || [];

            if (!orderData && lineItems.length === 0) {
                body.innerHTML = renderAuditStatus('gray', 'Order #' + escapeHtml(orderNum) + ' not found (may be older than 60 days)');
                if (summary) summary.textContent = 'Not found';
                return;
            }

            // Build accordion summary text
            var total = orderData ? (parseFloat(orderData.cur_TotalInvoice) || 0) : 0;
            var custName = orderData ? (orderData.CustomerName || '') : '';
            var summaryParts = ['Order #' + orderNum];
            if (custName) summaryParts.push(custName);
            if (total > 0) summaryParts.push('$' + total.toFixed(2));
            summaryParts.push(lineItems.length + ' item' + (lineItems.length !== 1 ? 's' : ''));
            if (summary) summary.textContent = summaryParts.join(' \u00B7 ');

            var html = '';

            // Audit Comparison Stat Boxes
            html += renderAuditStatBoxes(orderData, lineItems, artBilled, prelimCharges);

            // Order Header (enhanced with contact info, dates)
            if (orderData) {
                html += renderOrderHeader(orderData, orderNum);
            }

            // Full Line Items Table (with sizes + color)
            if (lineItems.length > 0) {
                html += renderFullLineItems(lineItems);
            }

            // Order Totals
            if (orderData) {
                html += renderOrderTotals(orderData);
            }

            body.innerHTML = html;
        })
        .catch(function (err) {
            body.innerHTML = renderAuditStatus('gray', 'Unable to load invoice for Order #' + escapeHtml(orderNum) + ': ' + escapeHtml(err.message));
            if (summary) summary.textContent = 'Error loading';
        });
    }

    function renderAuditStatus(color, message, detail) {
        var html = '<div class="ard-audit-status ard-audit-status--' + color + '">';
        html += '<div class="ard-audit-message">' + message + '</div>';
        if (detail) html += '<div class="ard-audit-detail">' + detail + '</div>';
        html += '</div>';
        return html;
    }

    // ── Find & Link ShopWorks Order ───────────────────────────────────
    // Expose functions for inline onclick handlers in dynamically generated HTML
    window.expandLineItems = expandLineItems;
    window.linkOrder = linkOrder;

    function showFindOrderModal(customerId, companyName) {
        var overlay = document.getElementById('find-order-overlay');
        var modal = document.getElementById('find-order-modal');
        var body = document.getElementById('find-order-body');
        var closeBtn = document.getElementById('find-order-close');
        var manualInput = document.getElementById('ard-fo-manual-input');
        var manualBtn = document.getElementById('ard-fo-manual-btn');

        overlay.style.display = 'block';
        modal.style.display = 'flex';
        body.innerHTML = '<div class="ard-fo-loading">Searching ShopWorks...</div>';
        manualInput.value = '';

        function closeModal() {
            overlay.style.display = 'none';
            modal.style.display = 'none';
        }
        closeBtn.onclick = closeModal;
        overlay.onclick = closeModal;

        manualBtn.onclick = function () { searchOrderManual(manualInput.value.trim(), body); };
        manualInput.onkeydown = function (e) { if (e.key === 'Enter') manualBtn.click(); };

        if (customerId) {
            searchOrdersByCustomerId(customerId, companyName, body);
        } else if (companyName) {
            searchOrdersByName(companyName, body);
        } else {
            body.innerHTML = '<div class="ard-fo-empty">No customer info available. Use manual search below.</div>';
        }
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
                    container.innerHTML = '<div class="ard-fo-empty">No orders found for Customer #' +
                        escapeHtml(String(customerId)) + ' in ShopWorks (60-day window).</div>';
                    return;
                }
                orders.sort(function (a, b) {
                    return new Date(b.date_Ordered || 0) - new Date(a.date_Ordered || 0);
                });
                renderOrderCards(orders, container, companyName);
            })
            .catch(function (err) {
                container.innerHTML = '<div class="ard-fo-error">Search failed: ' + escapeHtml(err.message) + '</div>';
            });
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
                    container.innerHTML = '<div class="ard-fo-empty">No customers matching "' +
                        escapeHtml(companyName) + '" found in recent ShopWorks orders.</div>';
                    return;
                }
                var bestMatch = matches[0];
                container.innerHTML = '<div class="ard-fo-loading">Found customer "' +
                    escapeHtml(bestMatch.CustomerName) + '" (#' + bestMatch.id_Customer + '). Loading orders...</div>';
                return searchOrdersByCustomerId(bestMatch.id_Customer, bestMatch.CustomerName, container);
            })
            .catch(function (err) {
                container.innerHTML = '<div class="ard-fo-error">Customer search failed: ' + escapeHtml(err.message) + '</div>';
            });
    }

    function searchOrderManual(orderNum, container) {
        if (!orderNum) return;
        container.innerHTML = '<div class="ard-fo-loading">Looking up Order #' + escapeHtml(orderNum) + '...</div>';
        fetch(API_BASE + '/api/manageorders/orders/' + encodeURIComponent(orderNum))
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                var orders = data.result || [];
                if (orders.length === 0) {
                    container.innerHTML = '<div class="ard-fo-empty">Order #' + escapeHtml(orderNum) + ' not found in ShopWorks.</div>';
                    return;
                }
                renderOrderCards(orders, container, '');
            })
            .catch(function (err) {
                container.innerHTML = '<div class="ard-fo-error">Lookup failed: ' + escapeHtml(err.message) + '</div>';
            });
    }

    function renderOrderCards(orders, container, companyLabel) {
        var header = '<div class="ard-fo-header">Found ' + orders.length + ' order' +
            (orders.length !== 1 ? 's' : '') + (companyLabel ? ' for ' + escapeHtml(companyLabel) : '') + ':</div>';
        var html = header;
        orders.forEach(function (order) {
            var orderNum = order.id_Order || '';
            var dateStr = order.date_Ordered ? new Date(order.date_Ordered).toLocaleDateString() : '--';
            var rep = order.CustomerServiceRep || '--';
            var invoiced = order.date_Invoiced
                ? 'Invoiced ' + new Date(order.date_Invoiced).toLocaleDateString()
                : 'Not invoiced';
            var custName = order.CustomerName || '';
            html += '<div class="ard-order-card" data-order="' + escapeHtml(String(orderNum)) + '">';
            html += '<div class="ard-order-num">Order #' + escapeHtml(String(orderNum)) + '</div>';
            html += '<div class="ard-order-meta">' + escapeHtml(dateStr) + ' &middot; ' + escapeHtml(rep) +
                ' &middot; ' + escapeHtml(invoiced);
            if (custName && !companyLabel) html += ' &middot; ' + escapeHtml(custName);
            html += '</div>';
            html += '<div class="ard-order-items" id="ard-items-' + escapeHtml(String(orderNum)) + '"></div>';
            html += '<div class="ard-order-actions">';
            html += '<button type="button" class="ard-view-items-btn" onclick="expandLineItems(\'' +
                escapeHtml(String(orderNum)) + '\', this)">View Line Items</button>';
            html += '<button type="button" class="ard-link-order-btn" onclick="linkOrder(\'' +
                escapeHtml(String(orderNum)) + '\')">Link This Order</button>';
            html += '</div></div>';
        });
        container.innerHTML = html;
    }

    function expandLineItems(orderNum, btn) {
        var itemsDiv = document.getElementById('ard-items-' + orderNum);
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
                    itemsDiv.innerHTML = '<div class="ard-fo-empty" style="padding:8px 0;">No line items found.</div>';
                    btn.textContent = 'Hide Line Items';
                    btn.disabled = false;
                    return;
                }
                var html = '<table class="ard-line-items-table"><thead><tr><th>PN</th><th>Description</th><th>Qty</th><th>Price</th></tr></thead><tbody>';
                items.forEach(function (item) {
                    var pn = item.PartNumber || '';
                    var isArt = isArtChargePn(pn);
                    var price = item.LineUnitPrice;
                    var desc = (item.PartDescription || '').trim();
                    var descLower = desc.toLowerCase();
                    var isWaived = isArt && (price === null || price === 0 ||
                        descLower.indexOf('waiv') !== -1 ||
                        descLower.indexOf('no charge') !== -1 ||
                        descLower.indexOf('n/c') !== -1 ||
                        descLower.indexOf('comp') !== -1);
                    var rowClass = isWaived ? 'ard-line-item-waived' : isArt ? 'ard-line-item-billed' : '';
                    html += '<tr class="' + rowClass + '">';
                    html += '<td class="ard-li-pn">' + escapeHtml(pn) + '</td>';
                    html += '<td>' + escapeHtml(desc) + '</td>';
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
                itemsDiv.innerHTML = '<div class="ard-fo-error" style="padding:8px 0;">Failed to load: ' + escapeHtml(err.message) + '</div>';
                btn.textContent = 'View Line Items';
                btn.disabled = false;
            });
    }

    function linkOrder(orderNum) {
        if (!currentRequest || !currentRequest.PK_ID) {
            showSuccessMessage('Error: Cannot save — missing record ID');
            return;
        }
        if (!confirm('Link Order #' + orderNum + ' to this art request?')) return;
        var pkId = currentRequest.PK_ID;

        // Step 1: Save Order_Num_SW
        fetch(API_BASE + '/api/artrequests/' + pkId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Order_Num_SW: String(orderNum) })
        })
        .then(function (resp) { if (!resp.ok) throw new Error('HTTP ' + resp.status); return resp.json(); })
        .then(function () {
            // Close modal
            document.getElementById('find-order-overlay').style.display = 'none';
            document.getElementById('find-order-modal').style.display = 'none';
            setText('ard-sw-order', orderNum);
            var findBtn = document.getElementById('ard-find-order-btn');
            if (findBtn) findBtn.style.display = 'none';

            // Step 2: Fetch order data to get Customer # and other info
            return fetch(API_BASE + '/api/manageorders/orders/' + encodeURIComponent(orderNum));
        })
        .then(function (resp) { if (!resp.ok) throw new Error('HTTP ' + resp.status); return resp.json(); })
        .then(function (data) {
            var orders = data.result || [];
            var order = orders[0];
            if (order && order.id_Customer) {
                var swCustomerEl = document.getElementById('ard-sw-customer');
                var currentCustomer = swCustomerEl ? swCustomerEl.textContent.trim() : '';
                if (!currentCustomer || currentCustomer === '--') {
                    // Auto-populate Customer # in Caspio
                    fetch(API_BASE + '/api/artrequests/' + pkId, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ Shopwork_customer_number: String(order.id_Customer) })
                    }).catch(function () {}); // fire-and-forget
                    setText('ard-sw-customer', order.id_Customer);
                    document.getElementById('ard-sw-refs-card').style.display = '';
                }
            }
            // Step 3: Load full invoice view
            var artBilled = currentRequest.Amount_Art_Billed || 0;
            var prelimCharges = currentRequest.Prelim_Charges || currentRequest.Charge_Quoted || null;
            loadFullInvoice(String(orderNum), artBilled, prelimCharges);
            showSuccessMessage('Order #' + orderNum + ' linked successfully');
        })
        .catch(function (err) { alert('Failed to link order: ' + err.message); });
    }

    // ── Audit Stat Boxes — 4-column comparison ────────────────────────
    function renderAuditStatBoxes(orderData, lineItems, artBilled, prelimCharges) {
        // Find art charge items
        var artChargeItems = lineItems.filter(function (item) { return isArtChargePn(item.PartNumber); });
        var invoiceArtTotal = 0;
        var artWaived = false;
        artChargeItems.forEach(function (item) {
            var price = item.LineUnitPrice;
            var desc = (item.PartDescription || '').toLowerCase();
            if (price === null || price === 0 || desc.match(/waiv|no charge|n\/c|comp/)) {
                artWaived = true;
            } else {
                invoiceArtTotal += parseFloat(price) || 0;
            }
        });

        var orderTotal = orderData ? (parseFloat(orderData.cur_TotalInvoice) || 0) : 0;
        var steveBilled = parseFloat(artBilled) || 0;
        var aeQuoted = typeof prelimCharges === 'number' ? prelimCharges : (parseFloat(prelimCharges) || 0);

        // Determine art charge status
        var artChargeStatus, artChargeColor, artChargeLabel;
        if (artChargeItems.length === 0) {
            artChargeStatus = 'missing';
            artChargeColor = 'amber';
            artChargeLabel = 'No Art Charge';
        } else if (artWaived && invoiceArtTotal === 0) {
            artChargeStatus = 'waived';
            artChargeColor = 'red';
            artChargeLabel = 'WAIVED';
        } else {
            artChargeStatus = 'billed';
            artChargeColor = 'green';
            artChargeLabel = '$' + invoiceArtTotal.toFixed(2);
        }

        // Mismatch detection
        var hasMismatch = steveBilled > 0 && artChargeStatus !== 'billed';
        var mismatchNote = '';
        if (hasMismatch) {
            mismatchNote = '<div class="ard-stat-mismatch">Steve billed $' + steveBilled.toFixed(2) +
                ' but art charge is ' + (artWaived ? 'waived' : 'missing') + ' on invoice</div>';
        }

        var html = '<div class="ard-audit-stats">';

        // Box 1: Steve's Work
        html += '<div class="ard-stat-box">';
        html += '<div class="ard-stat-value">$' + steveBilled.toFixed(2) + '</div>';
        html += '<div class="ard-stat-label">Steve\'s Work</div>';
        html += '</div>';

        // Box 2: AE Quoted
        html += '<div class="ard-stat-box">';
        html += '<div class="ard-stat-value">' + (aeQuoted > 0 ? '$' + aeQuoted.toFixed(2) : '--') + '</div>';
        html += '<div class="ard-stat-label">AE Quoted</div>';
        html += '</div>';

        // Box 3: Invoice Art Charge (color-coded)
        html += '<div class="ard-stat-box ard-stat-box--' + artChargeColor + '">';
        html += '<div class="ard-stat-value">' + artChargeLabel + '</div>';
        html += '<div class="ard-stat-label">Invoice Art</div>';
        html += '</div>';

        // Box 4: Order Total
        html += '<div class="ard-stat-box ard-stat-box--slate">';
        html += '<div class="ard-stat-value">$' + orderTotal.toFixed(2) + '</div>';
        html += '<div class="ard-stat-label">Order Total</div>';
        html += '</div>';

        html += '</div>'; // .ard-audit-stats
        html += mismatchNote;

        return html;
    }

    // ── Order Header — enhanced meta info with 2-column grid ──────────
    function renderOrderHeader(order, orderNum) {
        var dateOrdered = order.date_Ordered ? new Date(order.date_Ordered).toLocaleDateString() : '--';
        var dateInvoiced = order.date_Invoiced ? new Date(order.date_Invoiced).toLocaleDateString() : null;
        var dateDue = order.date_Due ? new Date(order.date_Due).toLocaleDateString() : null;
        var rep = order.CustomerServiceRep || '--';
        var customer = order.CustomerName || '';
        var custId = order.id_Customer || '';

        var html = '<div class="ard-invoice-header">';
        html += '<div class="ard-invoice-title">Order #' + escapeHtml(String(orderNum));
        if (customer) html += ' \u2014 ' + escapeHtml(customer);
        html += '</div>';

        html += '<div class="ard-invoice-meta-grid">';

        function metaItem(label, value) {
            return '<div class="ard-invoice-meta-item"><span class="ard-invoice-meta-label">' +
                label + '</span><span class="ard-invoice-meta-value">' + escapeHtml(value) + '</span></div>';
        }

        html += metaItem('Ordered', dateOrdered);
        html += metaItem('Rep', rep);
        if (custId) html += metaItem('Customer #', String(custId));
        if (dateDue) html += metaItem('Due Date', dateDue);
        if (dateInvoiced) html += metaItem('Invoiced', dateInvoiced);

        html += '</div>'; // .ard-invoice-meta-grid
        html += '</div>'; // .ard-invoice-header
        return html;
    }

    // ── Size slot mapping (reused from monogram-form-service.js) ───────
    var SIZE_SLOT_MAP = { Size01: 'S', Size02: 'M', Size03: 'L', Size04: 'XL', Size05: '2XL' };
    var SIZE_SUFFIXES = ['XS','S','M','L','XL','2XL','2X','XXL','3XL','3X','XXXL',
        '4XL','4X','5XL','5X','6XL','6X','LT','XLT','2XLT','3XLT','4XLT','OSFA','OS','ADJ'];

    function getSize06Label(partNumber) {
        if (!partNumber) return '3XL';
        var lastIdx = partNumber.lastIndexOf('_');
        if (lastIdx > 0) {
            var suffix = partNumber.substring(lastIdx + 1).toUpperCase();
            if (SIZE_SUFFIXES.indexOf(suffix) !== -1) return suffix;
        }
        return '3XL';
    }

    function isGarmentItem(item) {
        return ['Size01','Size02','Size03','Size04','Size05','Size06'].some(function (s) {
            return (item[s] || 0) > 0;
        });
    }

    // ── Full Line Items Table (with sizes + color) ──────────────────────
    function renderFullLineItems(items) {
        // Sort by SortOrder if available
        items.sort(function (a, b) { return (a.SortOrder || 0) - (b.SortOrder || 0); });

        // Determine which size columns are needed (only show columns with data)
        var activeSizes = {}; // { 'S': true, 'M': true, ... }
        var itemSizeData = []; // parallel array of parsed size info per item

        items.forEach(function (item) {
            var sizes = {};
            if (isGarmentItem(item)) {
                Object.keys(SIZE_SLOT_MAP).forEach(function (slot) {
                    var qty = item[slot] || 0;
                    if (qty > 0) {
                        var label = SIZE_SLOT_MAP[slot];
                        sizes[label] = qty;
                        activeSizes[label] = true;
                    }
                });
                var s6 = item.Size06 || 0;
                if (s6 > 0) {
                    var label = getSize06Label(item.PartNumber);
                    sizes[label] = s6;
                    activeSizes[label] = true;
                }
            }
            itemSizeData.push(sizes);
        });

        // Build ordered list of active size columns
        var allSizeOrder = ['XS','S','M','L','XL','2XL','3XL','4XL','5XL','6XL','LT','XLT','2XLT','3XLT','4XLT','OSFA','OS','ADJ'];
        var sizeColumns = allSizeOrder.filter(function (s) { return activeSizes[s]; });
        var hasSizes = sizeColumns.length > 0;
        var hasColor = items.some(function (item) { return item.PartColor && isGarmentItem(item); });

        // Build table
        var html = '<div class="ard-invoice-table-wrap">';
        html += '<table class="ard-invoice-table">';
        html += '<thead><tr>';
        html += '<th>Part #</th>';
        if (hasColor) html += '<th>Color</th>';
        html += '<th>Description</th>';
        if (hasSizes) {
            sizeColumns.forEach(function (s) {
                html += '<th class="ard-inv-center">' + s + '</th>';
            });
        }
        html += '<th class="ard-inv-right">Qty</th>';
        html += '<th class="ard-inv-right">Unit Price</th>';
        html += '<th class="ard-inv-right">Ext Price</th>';
        html += '</tr></thead><tbody>';

        items.forEach(function (item, idx) {
            var pn = item.PartNumber || '';
            var desc = item.PartDescription || '';
            var qty = item.LineQuantity || 0;
            var unitPrice = item.LineUnitPrice;
            var color = item.PartColor || '';
            var isArt = isArtChargePn(pn);
            var isGarment = isGarmentItem(item);
            var sizes = itemSizeData[idx];

            // Waiver detection for art charge items
            var descLower = desc.toLowerCase();
            var isWaived = isArt && (unitPrice === null || unitPrice === 0 ||
                descLower.indexOf('waiv') !== -1 || descLower.indexOf('no charge') !== -1 ||
                descLower.indexOf('n/c') !== -1 || descLower.indexOf('comp') !== -1);

            var extPrice = (unitPrice !== null && unitPrice !== undefined) ? (qty * parseFloat(unitPrice)) : 0;
            var rowClass = isWaived ? 'ard-inv-row--waived' : isArt ? 'ard-inv-row--art' : '';

            html += '<tr class="' + rowClass + '">';
            html += '<td class="ard-inv-pn">' + escapeHtml(pn) + '</td>';

            if (hasColor) {
                html += '<td class="ard-inv-color">' + escapeHtml(color) + '</td>';
            }

            html += '<td>' + escapeHtml(desc);
            if (isWaived) html += ' <span class="ard-inv-waived-tag">WAIVED</span>';
            if (isArt && !isWaived) html += ' <span class="ard-inv-art-tag">ART</span>';
            html += '</td>';

            if (hasSizes) {
                if (isGarment) {
                    sizeColumns.forEach(function (s) {
                        var sQty = sizes[s] || 0;
                        if (sQty > 0) {
                            html += '<td class="ard-inv-size-qty">' + sQty + '</td>';
                        } else {
                            html += '<td class="ard-inv-size-empty">&middot;</td>';
                        }
                    });
                } else {
                    // Non-garment items span across size columns
                    html += '<td colspan="' + sizeColumns.length + '"></td>';
                }
            }

            html += '<td class="ard-inv-right">' + qty + '</td>';
            html += '<td class="ard-inv-right">' + (unitPrice !== null && unitPrice !== undefined ? '$' + parseFloat(unitPrice).toFixed(2) : '$0.00') + '</td>';
            html += '<td class="ard-inv-right">$' + extPrice.toFixed(2) + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table>';
        html += '</div>'; // .ard-invoice-table-wrap
        return html;
    }

    // ── Order Totals — subtotal/tax/shipping/total/balance ────────────
    function renderOrderTotals(order) {
        var subtotal = parseFloat(order.cur_SubTotal) || 0;
        var tax = parseFloat(order.cur_SalesTaxTotal) || 0;
        var shipping = parseFloat(order.cur_Shipping) || 0;
        var total = parseFloat(order.cur_TotalInvoice) || 0;
        var balance = parseFloat(order.cur_Balance) || 0;

        var html = '<div class="ard-invoice-totals">';
        html += '<div class="ard-invoice-total-row"><span>Subtotal</span><span>$' + subtotal.toFixed(2) + '</span></div>';
        if (shipping > 0) {
            html += '<div class="ard-invoice-total-row"><span>Shipping</span><span>$' + shipping.toFixed(2) + '</span></div>';
        }
        if (tax > 0) {
            html += '<div class="ard-invoice-total-row"><span>Sales Tax</span><span>$' + tax.toFixed(2) + '</span></div>';
        }
        html += '<div class="ard-invoice-total-row ard-invoice-total-row--grand"><span>Total</span><span>$' + total.toFixed(2) + '</span></div>';
        if (balance > 0) {
            html += '<div class="ard-invoice-total-row ard-invoice-total-row--balance"><span>Balance Due</span><span>$' + balance.toFixed(2) + '</span></div>';
        }
        html += '</div>';
        return html;
    }

    // ── AI Vision Analysis ─────────────────────────────────────────────
    function loadVisionAnalysis() {
        var section = document.getElementById('ard-vision-section');
        var container = document.getElementById('ard-vision-container');
        if (!section || !container || !designId) return;

        fetch(API_BASE + '/api/art-requests/' + designId + '/analysis')
            .then(function (r) { return r.ok ? r.json() : { analyses: [], printLocations: [] }; })
            .then(function (data) {
                var analyses = data.analyses || [];
                if (analyses.length === 0) return;

                // Group print locations by Analysis_ID AND by Mockup_Slot (dual lookup)
                var printMapById = {};
                var printMapBySlot = {};
                (data.printLocations || []).forEach(function (pl) {
                    var aid = pl.Analysis_ID;
                    if (!printMapById[aid]) printMapById[aid] = [];
                    printMapById[aid].push(pl);
                    // Also group by Mockup_Slot for fallback matching
                    var slot = pl.Mockup_Slot;
                    if (slot) {
                        if (!printMapBySlot[slot]) printMapBySlot[slot] = [];
                        printMapBySlot[slot].push(pl);
                    }
                });

                section.style.display = '';
                container.innerHTML = '';

                // Group by Mockup_Slot, keep latest per slot
                var slotMap = {};
                analyses.forEach(function (a) {
                    var slot = a.Mockup_Slot || 'Unknown';
                    if (!slotMap[slot] || new Date(a.Analysis_Date) > new Date(slotMap[slot].Analysis_Date)) {
                        slotMap[slot] = a;
                    }
                });

                var slotOrder = ['Box_File_Mockup', 'BoxFileLink', 'Company_Mockup'];
                var slotLabels = { 'Box_File_Mockup': 'Mockup 1', 'BoxFileLink': 'Mockup 2', 'Company_Mockup': 'Mockup 3' };
                var rendered = [];

                slotOrder.forEach(function (slot) {
                    if (slotMap[slot]) rendered.push({ slot: slot, label: slotLabels[slot] || slot, data: slotMap[slot] });
                });
                Object.keys(slotMap).forEach(function (slot) {
                    if (slotOrder.indexOf(slot) === -1) {
                        rendered.push({ slot: slot, label: slot, data: slotMap[slot] });
                    }
                });

                var cardsHtml = '<div class="ard-vision-grid">';
                rendered.forEach(function (item) {
                    var a = item.data;
                    var isPass = (a.Validation_Status || '').toLowerCase() === 'pass';
                    var validationClass = isPass ? 'ard-vision-valid' : 'ard-vision-warn';
                    var method = (a.Extracted_Method || '').toLowerCase();
                    var isScreenPrint = method.indexOf('screen') !== -1;
                    // Try matching by PK_ID first, then by Analysis_ID fallback format, then by Mockup_Slot
                    var locations = printMapById[String(a.PK_ID)] || printMapById[a.Design_ID + '_' + a.PK_ID] || printMapBySlot[item.slot] || [];

                    cardsHtml += '<div class="ard-vision-card">'
                        + '<div class="ard-vision-card-header">'
                        + '<span class="ard-vision-slot-label">' + escapeHtml(item.label) + '</span>'
                        + '<div class="ard-vision-header-right">';
                    if (a.Extracted_Method) {
                        cardsHtml += '<span class="ard-vision-method-tag">' + escapeHtml(a.Extracted_Method) + '</span>';
                    }
                    cardsHtml += '<span class="ard-vision-badge ' + validationClass + '">' + escapeHtml(a.Validation_Status || 'N/A') + '</span>'
                        + '</div></div>'
                        + '<div class="ard-vision-card-body">';

                    // Compact 3-column field grid
                    cardsHtml += '<div class="ard-vision-fields">';
                    var fields = [
                        { label: 'Design #', value: a.Extracted_Design_Number },
                        { label: 'Customer', value: a.Extracted_Customer_Name },
                        { label: 'Sales Rep', value: a.Extracted_Sales_Rep },
                        { label: 'Garment', value: a.Extracted_Garment_Info },
                        { label: 'Placement', value: a.Extracted_Placement },
                        { label: 'Size', value: a.Extracted_Size },
                        { label: 'Date', value: a.Extracted_Date },
                        { label: 'Time', value: a.Extracted_Time }
                    ];

                    fields.forEach(function (f) {
                        if (f.value) {
                            cardsHtml += '<div class="ard-vision-field">'
                                + '<span class="ard-vision-field-label">' + escapeHtml(f.label) + '</span>'
                                + '<span class="ard-vision-field-value">' + escapeHtml(f.value) + '</span>'
                                + '</div>';
                        }
                    });
                    cardsHtml += '</div>';

                    // Status pills row
                    var approvedYes = (a.Customer_Approved || '').toLowerCase() === 'yes';
                    var filesYes = (a.Files_Prepared || '').toLowerCase() === 'yes';
                    cardsHtml += '<div class="ard-vision-pills">'
                        + '<span class="ard-vision-pill ' + (approvedYes ? 'ard-vision-pill--yes' : 'ard-vision-pill--no') + '">Approved: ' + escapeHtml(a.Customer_Approved || 'No') + '</span>'
                        + '<span class="ard-vision-pill ' + (filesYes ? 'ard-vision-pill--yes' : 'ard-vision-pill--no') + '">Files Ready: ' + escapeHtml(a.Files_Prepared || 'No') + '</span>';
                    if (a.Has_Reflective && a.Has_Reflective.toLowerCase() === 'yes') {
                        cardsHtml += '<span class="ard-vision-pill ard-vision-pill--special">Reflective</span>';
                    }
                    if (a.Has_Metallic && a.Has_Metallic.toLowerCase() === 'yes') {
                        cardsHtml += '<span class="ard-vision-pill ard-vision-pill--special">Metallic</span>';
                    }
                    cardsHtml += '</div>';

                    // Screen Print Details (from child table)
                    if (isScreenPrint && (locations.length > 0 || a.Total_Screens)) {
                        cardsHtml += '<div class="ard-vision-print-section">'
                            + '<div class="ard-vision-print-header">Screen Print Details</div>';

                        // Summary row
                        if (a.Total_Screens || a.Total_Prints || a.Total_Flashes) {
                            cardsHtml += '<div class="ard-vision-print-summary">';
                            if (a.Total_Screens) cardsHtml += '<span class="ard-vision-print-stat"><strong>' + escapeHtml(a.Total_Screens) + '</strong> Screens</span>';
                            if (a.Total_Prints) cardsHtml += '<span class="ard-vision-print-stat"><strong>' + escapeHtml(a.Total_Prints) + '</strong> Prints</span>';
                            if (a.Total_Flashes) cardsHtml += '<span class="ard-vision-print-stat"><strong>' + escapeHtml(a.Total_Flashes) + '</strong> Flashes</span>';
                            cardsHtml += '</div>';
                        }

                        // PMS Colors
                        if (a.PMS_Colors) {
                            cardsHtml += '<div class="ard-vision-pms">'
                                + '<span class="ard-vision-field-label">PMS Colors</span>'
                                + '<span class="ard-vision-field-value">' + escapeHtml(a.PMS_Colors) + '</span>'
                                + '</div>';
                        }

                        // Per-location table
                        if (locations.length > 0) {
                            cardsHtml += '<table class="ard-vision-print-table">'
                                + '<thead><tr>'
                                + '<th>Location</th><th>Ink Colors</th><th>Screens</th><th>Prints</th><th>Flashes</th>'
                                + '</tr></thead><tbody>';

                            locations.forEach(function (loc) {
                                cardsHtml += '<tr>'
                                    + '<td class="ard-vision-print-placement">' + escapeHtml(loc.Placement || '--') + '</td>'
                                    + '<td>' + escapeHtml(loc.Ink_Colors || '--') + '</td>'
                                    + '<td class="ard-vision-print-num">' + escapeHtml(loc.Screens || '--') + '</td>'
                                    + '<td class="ard-vision-print-num">' + escapeHtml(loc.Prints || '--') + '</td>'
                                    + '<td class="ard-vision-print-num">' + escapeHtml(loc.Flashes || '--') + '</td>'
                                    + '</tr>';
                                if (loc.Print_Order) {
                                    cardsHtml += '<tr class="ard-vision-print-order-row">'
                                        + '<td colspan="5"><span class="ard-vision-field-label">Print Order:</span> '
                                        + escapeHtml(loc.Print_Order) + '</td></tr>';
                                }
                            });
                            cardsHtml += '</tbody></table>';
                        }
                        cardsHtml += '</div>';
                    }

                    // Design info (compact)
                    if (a.Design_Colors || a.Design_Text || a.Design_Description) {
                        cardsHtml += '<div class="ard-vision-design">';
                        if (a.Design_Colors) {
                            cardsHtml += '<div class="ard-vision-design-row">'
                                + '<span class="ard-vision-field-label">Colors</span>'
                                + '<span class="ard-vision-field-value">' + escapeHtml(a.Design_Colors) + '</span>'
                                + '</div>';
                        }
                        if (a.Design_Text) {
                            cardsHtml += '<div class="ard-vision-design-row">'
                                + '<span class="ard-vision-field-label">Text on Design</span>'
                                + '<span class="ard-vision-field-value">' + escapeHtml(a.Design_Text) + '</span>'
                                + '</div>';
                        }
                        if (a.Design_Description) {
                            var descId = 'vision-desc-' + item.slot;
                            cardsHtml += '<div class="ard-vision-desc">'
                                + '<span class="ard-vision-field-label">Description</span>'
                                + '<p class="ard-vision-desc-text ard-vision-desc-collapsed" id="' + descId + '">' + escapeHtml(a.Design_Description) + '</p>'
                                + '<button type="button" class="ard-vision-desc-toggle" onclick="var el=document.getElementById(\'' + descId + '\');el.classList.toggle(\'ard-vision-desc-collapsed\');this.textContent=el.classList.contains(\'ard-vision-desc-collapsed\')?\'Show more\':\'Show less\'">Show more</button>'
                                + '</div>';
                        }
                        cardsHtml += '</div>';
                    }

                    // Validation warning
                    if (a.Validation_Notes) {
                        cardsHtml += '<div class="ard-vision-warning">' + escapeHtml(a.Validation_Notes) + '</div>';
                    }

                    cardsHtml += '</div></div>';
                });

                cardsHtml += '</div>';
                container.innerHTML = cardsHtml;
            })
            .catch(function (err) {
                console.warn('Vision analysis load failed:', err.message);
            });
    }

    // Load vision data after page renders
    setTimeout(loadVisionAnalysis, 1000);

})();
