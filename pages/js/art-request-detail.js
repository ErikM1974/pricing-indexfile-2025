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

        // Mockup Gallery (unified two-section)
        renderMockupGallery(req);
        initGalleryInteractions(req);

        // AE Action Bar — show only when status contains "Awaiting Approval"
        const statusLower = statusClean.toLowerCase().replace(/\s+/g, '');
        if (statusLower.includes('awaitingapproval')) {
            document.getElementById('ard-action-bar').style.display = '';
            initActionBar();

            // Share with Customer — show when mockup exists + customer email exists
            var mockupUrl = req.Box_File_Mockup || req.BoxFileLink || req.Company_Mockup || '';
            if (contactEmail && mockupUrl) {
                document.getElementById('ard-btn-share-customer').style.display = '';
                initShareWithCustomer(req);
            }
        }

        // Steve's Action Bar — always show for artist workflow
        renderSteveActions(req, statusClean);

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
                    body: JSON.stringify({ noteType: 'Status Change', noteText: 'Status set to Working (In Progress)', noteBy: 'art@nwcustomapparel.com' })
                });
            }).then(function () {
                btnWorking.textContent = 'Updated!';
                btnWorking.style.background = '#28a745';

                // Notify sales rep (best-effort, non-blocking)
                if (repEmail && typeof emailjs !== 'undefined') {
                    var repName = resolveRepName(repEmail);
                    var repAddr = REP_MAP[repName] || repEmail;
                    emailjs.send(EMAILJS_SERVICE_ID, 'template_art_in_progress', {
                        to_email: repAddr,
                        to_name: repName || 'Sales Team',
                        design_id: designId,
                        company_name: company,
                        detail_link: window.location.origin + '/art-request/' + designId,
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
                sendMockupReminder(designId, req, repEmail, company);
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
                    body: JSON.stringify({ noteType: 'Status Change', noteText: 'Reopened from Completed', noteBy: 'art@nwcustomapparel.com' })
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

    // ── Send Reminder (re-send mockup notification without new revision) ──
    function sendMockupReminder(designId, req, repEmail, company) {
        var repName = resolveRepName(repEmail);
        var repAddr = REP_MAP[repName] || repEmail;
        var displayTo = repName || repAddr || 'sales rep';

        if (!confirm('Send a mockup reminder to ' + displayTo + '?')) return;

        var btn = document.getElementById('ard-btn-send-mockup');
        btn.disabled = true;
        btn.textContent = 'Sending...';

        // Find the first available mockup URL for the email
        var mockupUrl = req.Box_File_Mockup || req.BoxFileLink || req.Company_Mockup || '';

        // 1. Log a "Reminder" note
        fetch(API_BASE + '/api/art-requests/' + designId + '/note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                noteType: 'Reminder',
                noteText: 'Mockup reminder sent to ' + displayTo,
                noteBy: 'art@nwcustomapparel.com'
            })
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Note failed ' + resp.status);

            // 2. Send EmailJS approval reminder (same template as original)
            if (typeof emailjs !== 'undefined' && repAddr) {
                var revCount = req.Revision_Count || 0;
                emailjs.send(EMAILJS_SERVICE_ID, 'art_approval_request', {
                    to_email: repAddr,
                    to_name: repName || 'Sales Team',
                    design_id: designId,
                    company_name: company,
                    detail_link: window.location.origin + '/art-request/' + designId,
                    mockup_url: mockupUrl,
                    message: 'Reminder: A mockup is awaiting your review.',
                    from_name: 'Steve — Art Department',
                    revision_count: revCount
                }, EMAILJS_PUBLIC_KEY).catch(function (err) {
                    console.warn('Reminder email failed:', err);
                });
            }

            // 3. Post toast notification to AE dashboard
            fetch(API_BASE + '/api/art-notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'mockup_reminder',
                    designId: designId,
                    companyName: company,
                    actorName: 'Steve',
                    targetRep: repAddr
                })
            }).catch(function () { /* fire-and-forget */ });

            btn.textContent = 'Reminder Sent!';
            btn.style.background = '#28a745';
            setTimeout(function () {
                btn.textContent = 'Send Reminder';
                btn.style.background = '';
                btn.disabled = false;
            }, 3000);

        }).catch(function (err) {
            console.error('Reminder failed:', err);
            btn.textContent = 'Error';
            btn.style.background = '#dc3545';
            setTimeout(function () {
                btn.textContent = 'Send Reminder';
                btn.style.background = '';
                btn.disabled = false;
            }, 2000);
        });
    }

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

    function renderMockupGallery(req) {
        // Section 1: Writable mockup slots (always 3)
        var mockupsGrid = document.getElementById('ard-mockups-grid');
        mockupsGrid.innerHTML = '';

        MOCKUP_SLOTS.forEach(function (slot, index) {
            var url = req[slot.key];
            var isEmpty = isEmptySlot(url);

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
                var thumb = renderFilledThumb(url, slot, true);
                thumb.dataset.slotIndex = index;
                thumb.dataset.fieldKey = slot.key;
                thumb.setAttribute('draggable', 'true');

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

                mockupsGrid.appendChild(thumb);
            }
        });

        // Wire up remove buttons on mockup slots
        wireRemoveButtons(mockupsGrid);

        // Section 2: Read-only artwork (only shows populated fields)
        var artworkGrid = document.getElementById('ard-artwork-grid');
        var artworkSection = document.getElementById('ard-artwork-section');
        artworkGrid.innerHTML = '';
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
                    return fetch(API_BASE + '/api/art-requests/' + designId + '/note', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ noteType: 'Mockup Removed', noteText: 'Removed mockup from ' + fieldLabel, noteBy: 'art@nwcustomapparel.com' })
                    });
                }).then(function () {
                    renderMockupGallery(currentRequest);
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
                        body: JSON.stringify({ noteType: 'Mockup Added', noteText: 'Added mockup from Box: ' + selectedBoxFile.name, noteBy: 'art@nwcustomapparel.com' })
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
                    Note_By: 'art@nwcustomapparel.com'
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
                            rep_name: repName,
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
