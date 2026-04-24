/**
 * art-actions-shared.js — Shared Art Action Modals & Helpers
 *
 * Extracted from art-hub-steve.js so both the Art Hub gallery cards
 * AND the Art Request Detail page can reuse the same modal functions.
 *
 * Exposes: window.ArtActions
 *
 * Depends on: EmailJS SDK (optional, for notifications), APP_CONFIG (optional)
 */
(function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // Logged-in user identity (from staff portal session)
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

    var EMAILJS_SERVICE_ID = 'service_jgrave3';
    var EMAILJS_PUBLIC_KEY = '4qSbDO-SQs19TbP80';
    var SITE_ORIGIN = 'https://www.teamnwca.com';

    // Module-level callback for Send for Approval modal (functions can't go in dataset)
    var _pendingApprovalOnSuccess = null;

    var REP_EMAIL_MAP = {
        'Taneisha': 'taneisha@nwcustomapparel.com',
        'Nika':     'nika@nwcustomapparel.com',
        'Ruthie':   'ruthie@nwcustomapparel.com',
        'Erik':     'erik@nwcustomapparel.com'
    };

    // ── Utilities ─────────────────────────────────────────────────────

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Handle image load failure — try Box proxy fallback for broken shared/static URLs,
     * or detect a 404 on our proxy URL (file truly gone from Box). Exposed via ArtActions
     * so inline onerror handlers across art-ae/mockup-ae/mockup-ruth can reuse it.
     */
    function handleBoxImageError(img) {
        var originalSrc = img.getAttribute('data-original-src') || img.src;
        var placeholder = img.nextElementSibling;
        if (originalSrc.indexOf('/shared/static/') !== -1 && !img.dataset.proxyAttempted) {
            img.dataset.proxyAttempted = '1';
            img.src = API_BASE + '/api/box/shared-image?url=' + encodeURIComponent(originalSrc);
            return;
        }

        // Proxy URL failure — HEAD check to distinguish missing-file 404 from transient errors.
        // On 404, flip the parent card into a "File missing" state instead of a generic badge.
        if (originalSrc.indexOf('/api/box/thumbnail/') !== -1 && !img.dataset.headChecked) {
            img.dataset.headChecked = '1';
            fetch(originalSrc, { method: 'HEAD' })
                .then(function (resp) {
                    if (resp.status === 404) {
                        img.style.display = 'none';
                        var card = img.closest('.art-card, .mockup-card, .gallery-card, [data-mockup-id], [data-design-id]') || img.parentElement;
                        if (card && !card.dataset.brokenRendered) {
                            card.dataset.brokenRendered = '1';
                            var label = document.createElement('div');
                            label.className = 'art-box-missing-badge';
                            label.style.cssText = 'background:#fff5f5;color:#c0392b;border:1px dashed #dc3545;border-radius:4px;padding:6px 10px;font-size:11px;font-weight:600;text-align:center;margin:4px 0;';
                            label.textContent = '\u26a0 File missing \u2014 re-upload';
                            (card.querySelector('.art-card-body, .mockup-card-body') || card).appendChild(label);
                        } else if (placeholder) {
                            placeholder.style.display = 'flex';
                        }
                        return;
                    }
                    img.style.display = 'none';
                    if (placeholder) placeholder.style.display = 'flex';
                })
                .catch(function () {
                    img.style.display = 'none';
                    if (placeholder) placeholder.style.display = 'flex';
                });
            return;
        }

        img.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
    }

    function formatNoteDate(dateStr) {
        if (!dateStr) return '--';
        try {
            var d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    }

    function resolveRep(repValue) {
        if (!repValue || !repValue.trim()) {
            return { displayName: 'Sales Team', email: 'sales@nwcustomapparel.com' };
        }
        var val = repValue.trim();
        if (REP_EMAIL_MAP[val]) return { displayName: val, email: REP_EMAIL_MAP[val] };
        for (var name in REP_EMAIL_MAP) {
            if (val.toLowerCase() === REP_EMAIL_MAP[name].toLowerCase()) return { displayName: name, email: REP_EMAIL_MAP[name] };
        }
        if (val.indexOf('@') !== -1) {
            var local = val.substring(0, val.indexOf('@'));
            return { displayName: local.charAt(0).toUpperCase() + local.slice(1), email: val };
        }
        return { displayName: val, email: 'sales@nwcustomapparel.com' };
    }

    // ── Modal Helpers ─────────────────────────────────────────────────

    function createOverlay() {
        var o = document.createElement('div');
        o.id = 'quick-action-overlay';
        o.className = 'art-modal-overlay';
        return o;
    }

    function removeModals() {
        ['art-time-modal', 'log-time-modal', 'time-log-modal', 'quick-action-overlay'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });
    }

    // ── Art Charge Logging ────────────────────────────────────────────

    function logArtCharge(designId, mins, description, chargeType, currentTotalMins, options) {
        if (mins <= 0) return;

        var isWaived = options && options.waived;
        var newTotalMins = currentTotalMins + mins;
        var cost = isWaived ? 0 : parseFloat((Math.ceil(mins / 15) * 0.25 * 75).toFixed(2));
        var totalCost = isWaived ? 0 : parseFloat((Math.ceil(newTotalMins / 15) * 0.25 * 75).toFixed(2));

        fetch(API_BASE + '/api/art-charges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ID_Design: parseInt(designId),
                Minutes: mins,
                Cost: cost,
                Description: (description || '').substring(0, 255),
                Charge_Type: chargeType,
                Logged_By: getLoggedInUser().email,
                Running_Total_Minutes: newTotalMins,
                Running_Total_Cost: totalCost
            })
        }).catch(function (err) { console.warn('Art charge log failed (non-blocking):', err); });
    }

    // ── Reopen Notification ─────────────────────────────────────────────

    function notifyReopen(designId) {
        fetch(API_BASE + '/api/artrequests?id_design=' + designId + '&select=User_Email,Sales_Rep,CompanyName&limit=1')
            .then(function (resp) { return resp.ok ? resp.json() : []; })
            .then(function (reqs) {
                if (!reqs || !reqs.length) return;
                var salesRep = reqs[0].Sales_Rep || reqs[0].User_Email;
                var companyName = reqs[0].CompanyName || '';
                var rep = resolveRep(salesRep);

                // Toast notification to AE dashboard
                fetch(API_BASE + '/api/art-notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'status_changed',
                        designId: designId,
                        companyName: companyName,
                        actorName: 'Steve',
                        targetRep: rep.email
                    })
                }).catch(function () { /* fire-and-forget */ });

                // EmailJS email to AE
                if (typeof emailjs !== 'undefined') {
                    emailjs.init(EMAILJS_PUBLIC_KEY);
                    emailjs.send(EMAILJS_SERVICE_ID, 'template_art_note_added', {
                        to_email: rep.email,
                        to_name: rep.displayName,
                        design_id: designId,
                        company_name: companyName,
                        note_text: 'Design #' + designId + ' has been reopened — Steve is making additional changes.',
                        note_type: 'Status Update',
                        detail_link: SITE_ORIGIN + '/art-request/' + designId + '?view=ae',
                        from_name: 'Steve — Art Department'
                    }).catch(function (err) { console.warn('Reopen email failed:', err); });
                }
            })
            .catch(function (err) { console.warn('Reopen notification failed:', err); });
    }

    // ── Email Notification ────────────────────────────────────────────

    async function sendNotificationEmail(designId, type, data) {
        if (typeof emailjs === 'undefined') {
            console.warn('EmailJS not loaded — skipping notification');
            return;
        }

        try {
            var salesRep = data.salesRep;
            var companyName = data.companyName;

            if (!salesRep) {
                var resp = await fetch(API_BASE + '/api/artrequests?id_design=' + designId + '&select=User_Email,Sales_Rep,CompanyName&limit=1');
                if (resp.ok) {
                    var reqs = await resp.json();
                    if (reqs && reqs.length > 0) {
                        salesRep = reqs[0].Sales_Rep || reqs[0].User_Email;
                        companyName = reqs[0].CompanyName;
                    }
                }
            }

            var rep = resolveRep(salesRep);
            var repEmail = rep.email;
            var detailLink = SITE_ORIGIN + '/art-request/' + designId + '?view=ae';

            var templateId, templateParams;

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
                var mins = data.artMinutes || 0;
                var quarterHours = Math.ceil(mins / 15) * 0.25;
                var cost = (quarterHours * 75).toFixed(2);
                templateId = 'template_art_completed';
                templateParams = {
                    to_email: repEmail,
                    to_name: rep.displayName,
                    design_id: designId,
                    company_name: companyName || 'Unknown',
                    art_minutes: mins,
                    art_cost: '$' + cost,
                    detail_link: detailLink,
                    from_name: 'Steve — Art Department'
                };
            }

            if (type === 'approval') {
                var aMins = data.artMinutes || 0;
                var aQh = Math.ceil(aMins / 15) * 0.25;
                var aCost = (aQh * 75).toFixed(2);
                var urls = data.mockupUrls || [];
                // L3 — Escape URLs and notes before interpolating into email HTML.
                // A URL containing `"` or `>` (e.g. a Box shared link with a weird
                // suffix) would break the img tag and open an injection surface.
                // Artist notes are user-entered and MUST be escaped.
                function escapeEmailHtml(s) {
                    return String(s == null ? '' : s)
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');
                }
                var imagesHtml = urls.map(function (url, i) {
                    return '<div style="display:inline-block;margin:8px;"><img src="' + escapeEmailHtml(url) + '" alt="Mockup ' + (i + 1) + '" style="max-width:260px;border-radius:8px;border:1px solid #e5e7eb;"></div>';
                }).join('');
                // Build mockup notes HTML for email
                var notesArr = data.mockupNotes || [];
                var notesHtml = '';
                if (notesArr.length > 0) {
                    notesHtml = '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 18px;margin-bottom:20px;">'
                        + '<p style="font-size:13px;color:#92400e;font-weight:600;margin:0 0 6px 0;">Artist Notes:</p>'
                        + notesArr.map(function (n) { return '<p style="font-size:13px;color:#333;margin:0 0 4px 0;line-height:1.4;">' + escapeEmailHtml(n) + '</p>'; }).join('')
                        + '</div>';
                }

                templateId = 'art_approval_request';
                templateParams = {
                    to_email: repEmail,
                    to_name: rep.displayName,
                    design_id: designId,
                    company_name: companyName || 'Unknown',
                    revision_count: data.revisionCount || 0,
                    message: data.message || 'Mockup is ready for your review.',
                    art_time_display: aMins + ' min (' + aQh.toFixed(2) + ' hrs, $' + aCost + ')',
                    detail_link: detailLink,
                    from_name: 'Art Department',
                    mockup_url: urls[0] || '',
                    mockup_images_html: imagesHtml,
                    mockup_count: urls.length,
                    mockup_notes_html: notesHtml
                };
            }

            if (templateId) {
                await emailjs.send(EMAILJS_SERVICE_ID, templateId, templateParams, EMAILJS_PUBLIC_KEY);
                // Notification email sent successfully

                if (type === 'approval' && data.ccEmails && data.ccEmails.length > 0) {
                    for (var i = 0; i < data.ccEmails.length; i++) {
                        try {
                            var ccParams = Object.assign({}, templateParams, {
                                to_email: data.ccEmails[i].email,
                                to_name: data.ccEmails[i].name
                            });
                            await emailjs.send(EMAILJS_SERVICE_ID, templateId, ccParams, EMAILJS_PUBLIC_KEY);
                        } catch (ccErr) {
                            console.warn('CC email to ' + data.ccEmails[i].name + ' failed (non-blocking):', ccErr);
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('Notification email failed (' + type + ', non-blocking):', err);
        }
    }

    // ── Rush Flag Normalizer ──────────────────────────────────────────
    // Caspio YES/NO columns return different values depending on access path:
    //   - Via REST API: typically true/false (boolean)
    //   - Via DataPage form with CheckedValue="Y": the string "Y"
    //   - Legacy writes from our code may have used "Yes"
    // This helper treats any rush-indicating value as true.
    function isRush(val) {
        if (!val && val !== 0) return false;
        if (typeof val === 'boolean') return val;
        var s = String(val).trim().toLowerCase();
        return s === 'yes' || s === 'y' || s === 'true' || s === '1';
    }

    // ── Rush Confirmation Email ───────────────────────────────────────
    // Sends TWO emails per rush:
    //   1. Confirmation to the submitting AE (CC sales rep if different)
    //   2. Notification to Steve (art@) or Ruth (ruth@) based on recipient param
    // Slack DM to Steve/Ruth is handled separately by Zapier watching Is_Rush=Yes.
    function sendRushConfirmation(params) {
        if (typeof emailjs === 'undefined') {
            console.warn('[Rush] EmailJS not loaded — skipping confirmation');
            return Promise.resolve();
        }
        emailjs.init(EMAILJS_PUBLIC_KEY);

        var ccEmail = '';
        if (params.salesRepEmail && params.salesRepEmail !== params.aeEmail) {
            ccEmail = params.salesRepEmail;
        }

        var baseParams = {
            ae_name: params.aeName || 'Sales Rep',
            design_name: params.designName || params.designId || '',
            company: params.company || '',
            recipient: params.recipient || '',
            detail_link: SITE_ORIGIN + (params.detailPath || ''),
            rush_time: new Date().toLocaleString('en-US', {
                timeZone: 'America/Los_Angeles',
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
            }),
            from_name: 'NWCA Art Department'
        };

        // Send 1: AE confirmation (+ sales rep CC if different)
        var aeParams = Object.assign({}, baseParams, {
            to_email: params.aeEmail,
            to_name: params.aeName || 'Sales Rep',
            cc_email: ccEmail
        });
        var aeSend = emailjs.send(EMAILJS_SERVICE_ID, 'template_rush_confirm', aeParams)
            .then(function () {
                console.log('[Rush] AE confirmation sent to', params.aeEmail, ccEmail ? '(cc ' + ccEmail + ')' : '');
            })
            .catch(function (err) {
                console.warn('[Rush] AE confirmation failed (non-blocking):', err);
            });

        // Send 2: recipient notification (Steve or Ruth)
        var recipientEmail = params.recipient === 'Steve'
            ? 'art@nwcustomapparel.com'
            : 'ruth@nwcustomapparel.com';
        var recipientParams = Object.assign({}, baseParams, {
            to_email: recipientEmail,
            to_name: params.recipient || 'Art Team',
            cc_email: '' // no sales-rep CC on the recipient's copy
        });
        var recipientSend = emailjs.send(EMAILJS_SERVICE_ID, 'template_rush_confirm', recipientParams)
            .then(function () {
                console.log('[Rush] Recipient notification sent to', recipientEmail);
            })
            .catch(function (err) {
                console.warn('[Rush] Recipient notification failed (non-blocking):', err);
            });

        return Promise.all([aeSend, recipientSend]);
    }

    // ── Approval Modal Total Helper ───────────────────────────────────

    function updateApprovalTotal() {
        var modal = document.getElementById('approval-modal');
        if (!modal) return;
        var currentArtMins = parseInt(modal.dataset.currentArtMins) || 0;
        var sessionMins = parseInt(document.getElementById('approval-minutes').value) || 0;
        var totalMins = currentArtMins + sessionMins;
        var totalQh = Math.ceil(totalMins / 15) * 0.25;
        var totalCost = (totalQh * 75).toFixed(2);
        var el = document.getElementById('approval-new-total');
        if (el) el.textContent = 'New total: ' + totalMins + ' min (' + totalQh.toFixed(2) + ' hrs, $' + totalCost + ')';
    }

    // ═══════════════════════════════════════════════════════════════════
    //  MODAL FUNCTIONS (parameterized — no card DOM dependency)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Mark Complete Modal
     * @param {string} designId
     * @param {string} repEmail - Sales rep email (for completion notification)
     * @param {string} companyName - Company name (for notification)
     */
    async function showArtTimeModal(designId, repEmail, companyName, onSuccess) {
      try {
        console.log('[ArtActions.showArtTimeModal] opening for designId=', designId);
        removeModals();

        var currentMins = 0;
        var currentStatus = '';
        try {
            var resp = await fetch(API_BASE + '/api/artrequests?id_design=' + designId + '&limit=1');
            if (resp.ok) {
                var reqs = await resp.json();
                if (reqs && reqs.length > 0) {
                    currentMins = reqs[0].Art_Minutes || 0;
                    currentStatus = (reqs[0].Status || '').toLowerCase().replace(/\s+/g, '');
                }
            }
        } catch (err) {
            console.warn('Could not fetch current art time:', err);
        }

        var isAwaitingApproval = currentStatus.indexOf('awaitingapproval') !== -1;

        var prevHours = (Math.ceil(currentMins / 15) * 0.25).toFixed(2);
        var prevCost = (parseFloat(prevHours) * 75).toFixed(2);

        var overlay = createOverlay();
        var modal = document.createElement('div');
        modal.id = 'art-time-modal';
        modal.className = 'art-modal art-modal--sm';
        modal.dataset.currentMins = currentMins;

        modal.innerHTML =
            '<div class="art-modal-header art-modal-header--green">' +
                'Mark Complete — #' + designId +
            '</div>' +
            '<div class="art-modal-body">' +
                (isAwaitingApproval
                    ? '<div class="art-modal-warning">' +
                          '\u26A0 This request is <strong>Awaiting Approval</strong> &mdash; the AE hasn\'t reviewed the mockup yet.' +
                      '</div>'
                    : '') +
                '<div class="art-prev-time">' + (currentMins > 0
                    ? 'Previously logged: ' + currentMins + ' min ($' + prevCost + ')'
                    : 'No art time logged yet') + '</div>' +
                '<label class="art-modal-label">Additional time:</label>' +
                '<div class="stepper-row">' +
                    '<button id="at-minus" class="stepper-btn">-</button>' +
                    '<input id="at-minutes" type="number" value="0" min="0" step="15" class="stepper-input" />' +
                    '<button id="at-plus" class="stepper-btn">+</button>' +
                '</div>' +
                '<div id="at-cost" class="art-cost-display">= $0.00</div>' +
                '<div id="at-new-total" class="art-new-total"></div>' +
                '<label class="art-waive-label" style="display:flex;align-items:center;gap:8px;margin:10px 0 4px;cursor:pointer;font-size:13px;color:#555;">' +
                    '<input type="checkbox" id="at-waive" style="width:16px;height:16px;cursor:pointer;" />' +
                    'Waive art fee <span style="color:#999;font-size:12px;">(no charge to customer)</span>' +
                '</label>' +
                '<div class="art-modal-actions">' +
                    '<button id="at-cancel" class="art-modal-btn-cancel">Cancel</button>' +
                    '<button id="at-submit" class="art-modal-btn-submit art-modal-btn-submit--green">Complete</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        var minutesInput = modal.querySelector('#at-minutes');
        var costDiv = modal.querySelector('#at-cost');
        var newTotalDiv = modal.querySelector('#at-new-total');
        var waiveCheckbox = modal.querySelector('#at-waive');

        function updateCost() {
            var mins = parseInt(minutesInput.value) || 0;
            var isWaived = waiveCheckbox && waiveCheckbox.checked;
            var qh = Math.ceil(mins / 15) * 0.25;
            var totalMins = currentMins + mins;
            var totalQh = Math.ceil(totalMins / 15) * 0.25;
            if (isWaived) {
                costDiv.textContent = '= $0.00 (fee waived)';
                costDiv.style.color = '#b45309';
                newTotalDiv.textContent = 'Final total: ' + totalMins + ' min (' + totalQh.toFixed(2) + ' hrs, $0.00 \u2014 fee waived)';
            } else {
                costDiv.textContent = '= $' + (qh * 75).toFixed(2);
                costDiv.style.color = '';
                newTotalDiv.textContent = 'Final total: ' + totalMins + ' min (' + totalQh.toFixed(2) + ' hrs, $' + (totalQh * 75).toFixed(2) + ')';
            }
        }
        updateCost();

        minutesInput.addEventListener('input', updateCost);
        if (waiveCheckbox) waiveCheckbox.addEventListener('change', updateCost);
        modal.querySelector('#at-plus').addEventListener('click', function () {
            minutesInput.value = (parseInt(minutesInput.value) || 0) + 15;
            updateCost();
        });
        modal.querySelector('#at-minus').addEventListener('click', function () {
            var v = (parseInt(minutesInput.value) || 0) - 15;
            minutesInput.value = v < 0 ? 0 : v;
            updateCost();
        });

        modal.querySelector('#at-cancel').addEventListener('click', removeModals);
        overlay.addEventListener('click', removeModals);

        modal.querySelector('#at-submit').addEventListener('click', async function () {
            var mins = parseInt(minutesInput.value) || 0;
            var isWaived = waiveCheckbox && waiveCheckbox.checked;
            this.disabled = true;
            this.textContent = 'Saving...';

            try {
                var statusResp = await fetch(API_BASE + '/api/art-requests/' + designId + '/status', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'Completed', artMinutes: mins })
                });
                if (!statusResp.ok) throw new Error('Status ' + statusResp.status);

                // Always log a completion note
                var completionNoteText = 'Marked as complete by Steve';
                if (mins > 0) {
                    var qh = Math.ceil(mins / 15) * 0.25;
                    var cost = isWaived ? '0.00' : (qh * 75).toFixed(2);
                    completionNoteText = isWaived
                        ? 'Marked as complete by Steve: ' + mins + ' additional minutes ($0.00 \u2014 fee waived)'
                        : 'Marked as complete by Steve: ' + mins + ' additional minutes ($' + cost + ')';
                    logArtCharge(designId, mins, 'Completed', isWaived ? 'Completion (fee waived)' : 'Completion', currentMins, { waived: isWaived });
                }
                await fetch(API_BASE + '/api/art-requests/' + designId + '/note', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        noteType: 'Status Change',
                        noteText: completionNoteText,
                        noteBy: getLoggedInUser().noteBy
                    })
                }).catch(function (err) { console.warn('Completion note failed (non-blocking):', err); });

                sendNotificationEmail(designId, 'completed', {
                    artMinutes: currentMins + mins,
                    salesRep: repEmail,
                    companyName: companyName
                });

                fetch(API_BASE + '/api/art-notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'completed',
                        designId: designId,
                        companyName: companyName || '',
                        actorName: 'Steve',
                        targetRep: repEmail || null
                    })
                }).catch(function () { /* fire-and-forget */ });

                this.textContent = 'Done!';
                this.style.background = '#009900';
                if (typeof NWCAConfetti !== 'undefined') NWCAConfetti.fire();
                var totalMins = currentMins + mins;
                setTimeout(function () {
                    removeModals();
                    // ShopWorks reminder
                    alert('\u2705 Marked complete!\n\nReminder: Upload the thumbnail to ShopWorks.');
                    if (typeof onSuccess === 'function') {
                        onSuccess({ status: 'Completed', artMinutes: totalMins, action: 'markComplete' });
                    } else {
                        window.location.reload();
                    }
                }, 600);
            } catch (err) {
                this.textContent = 'Error — retry';
                this.style.background = '#dc3545';
                this.disabled = false;
                console.error('Complete action failed:', err);
            }
        });
      } catch (fatalErr) {
        // Surface silent failures that previously left the Mark Complete button
        // doing "nothing" from the user's perspective. Now staff see what broke.
        console.error('[ArtActions.showArtTimeModal] fatal:', fatalErr);
        alert('Could not open Mark Complete dialog: ' + (fatalErr && fatalErr.message ? fatalErr.message : 'unknown error')
              + '\n\nPlease reload the page and try again. If this keeps happening, send Erik the browser console output (F12).');
      }
    }

    /**
     * Log Time Modal (standalone art time logging)
     * @param {string} designId
     * @param {string} currentStatus - Current status text to preserve on PUT
     */
    async function showLogTimeModal(designId, currentStatus, onSuccess) {
        removeModals();

        var currentMins = 0;
        try {
            var resp = await fetch(API_BASE + '/api/artrequests?id_design=' + designId + '&limit=1');
            if (resp.ok) {
                var reqs = await resp.json();
                if (reqs && reqs.length > 0) currentMins = reqs[0].Art_Minutes || 0;
            }
        } catch (err) {
            console.warn('Could not fetch current art time:', err);
        }

        // Clean status string for PUT — if not provided, default to In Progress
        if (!currentStatus) currentStatus = 'In Progress';

        var prevHours = (Math.ceil(currentMins / 15) * 0.25).toFixed(2);
        var prevCost = (parseFloat(prevHours) * 75).toFixed(2);

        var overlay = createOverlay();
        var modal = document.createElement('div');
        modal.id = 'log-time-modal';
        modal.className = 'art-modal art-modal--sm';
        modal.dataset.currentMins = currentMins;
        modal.dataset.currentStatus = currentStatus;

        modal.innerHTML =
            '<div class="art-modal-header art-modal-header--teal">' +
                'Log Art Time — #' + designId +
            '</div>' +
            '<div class="art-modal-body">' +
                '<div class="art-prev-time">' + (currentMins > 0
                    ? 'Previously logged: ' + currentMins + ' min ($' + prevCost + ')'
                    : 'No art time logged yet') + '</div>' +
                '<div class="stepper-row">' +
                    '<button id="lt-minus" class="stepper-btn">-</button>' +
                    '<input id="lt-minutes" type="number" value="0" step="15" class="stepper-input" />' +
                    '<button id="lt-plus" class="stepper-btn">+</button>' +
                '</div>' +
                '<div id="lt-cost" class="art-cost-display">= $0.00</div>' +
                '<div id="lt-new-total" class="art-new-total"></div>' +
                '<label class="art-modal-label" style="margin-top:12px;">Note (optional)</label>' +
                '<input type="text" id="lt-note" class="art-modal-note-input" placeholder="What did you work on?" />' +
                '<div class="art-modal-actions">' +
                    '<button id="lt-cancel" class="art-modal-btn-cancel">Cancel</button>' +
                    '<button id="lt-submit" class="art-modal-btn-submit art-modal-btn-submit--teal">Log Time</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        var minutesInput = modal.querySelector('#lt-minutes');
        var costDiv = modal.querySelector('#lt-cost');
        var newTotalDiv = modal.querySelector('#lt-new-total');

        function updateLogTimeCost() {
            var mins = parseInt(minutesInput.value) || 0;
            var clampedMins = Math.max(mins, -currentMins);
            if (clampedMins !== mins) minutesInput.value = clampedMins;

            if (clampedMins < 0) {
                var removeMins = Math.abs(clampedMins);
                var removeQh = Math.ceil(removeMins / 15) * 0.25;
                costDiv.textContent = 'Removing $' + (removeQh * 75).toFixed(2);
                costDiv.style.color = '#dc3545';
            } else {
                var qh = Math.ceil(clampedMins / 15) * 0.25;
                costDiv.textContent = '= $' + (qh * 75).toFixed(2);
                costDiv.style.color = '';
            }
            var totalMins = currentMins + clampedMins;
            var totalQh = totalMins > 0 ? (Math.ceil(totalMins / 15) * 0.25) : 0;
            newTotalDiv.textContent = 'New total: ' + totalMins + ' min (' + totalQh.toFixed(2) + ' hrs, $' + (totalQh * 75).toFixed(2) + ')';
        }
        updateLogTimeCost();

        minutesInput.addEventListener('input', updateLogTimeCost);
        modal.querySelector('#lt-plus').addEventListener('click', function () {
            minutesInput.value = (parseInt(minutesInput.value) || 0) + 15;
            updateLogTimeCost();
        });
        modal.querySelector('#lt-minus').addEventListener('click', function () {
            var v = (parseInt(minutesInput.value) || 0) - 15;
            minutesInput.value = v < -currentMins ? -currentMins : v;
            updateLogTimeCost();
        });

        modal.querySelector('#lt-cancel').addEventListener('click', removeModals);
        overlay.addEventListener('click', removeModals);

        modal.querySelector('#lt-submit').addEventListener('click', async function () {
            var mins = Math.max(parseInt(minutesInput.value) || 0, -currentMins);
            if (mins === 0 && !confirm('Art time is 0 minutes. Continue anyway?')) return;
            if (mins < 0 && !confirm('Remove ' + Math.abs(mins) + ' minutes from this design?')) return;

            var noteText = modal.querySelector('#lt-note').value.trim();

            this.disabled = true;
            this.textContent = 'Saving...';

            try {
                var statusResp = await fetch(API_BASE + '/api/art-requests/' + designId + '/status', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: currentStatus, artMinutes: mins })
                });
                if (!statusResp.ok) throw new Error('Status ' + statusResp.status);

                if (mins !== 0) {
                    var absMins = Math.abs(mins);
                    var qh = Math.ceil(absMins / 15) * 0.25;
                    var cost = (qh * 75).toFixed(2);
                    var action = mins < 0 ? 'Removed' : 'Logged';
                    var noteBody = noteText
                        ? action + ' ' + absMins + ' minutes ($' + cost + ') — ' + noteText
                        : action + ' ' + absMins + ' minutes ($' + cost + ')';
                    await fetch(API_BASE + '/api/art-requests/' + designId + '/note', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            noteType: 'Art Time',
                            noteText: noteBody,
                            noteBy: getLoggedInUser().noteBy
                        })
                    }).catch(function (err) { console.warn('Art time note failed (non-blocking):', err); });
                    var currentMinsForCharge = parseInt(modal.dataset.currentMins) || 0;
                    logArtCharge(designId, mins, noteText || (mins < 0 ? 'Time removed' : 'Art time logged'), 'Log Time', currentMinsForCharge);
                }

                this.textContent = 'Saved!';
                this.style.background = '#0891b2';
                var currentMinsForCallback = parseInt(modal.dataset.currentMins) || 0;
                var totalMins = currentMinsForCallback + mins;
                setTimeout(function () {
                    removeModals();
                    if (typeof onSuccess === 'function') {
                        onSuccess({ status: currentStatus, artMinutes: totalMins, action: 'logTime' });
                    } else {
                        window.location.reload();
                    }
                }, 600);
            } catch (err) {
                this.textContent = 'Error — retry';
                this.style.background = '#dc3545';
                this.disabled = false;
                console.error('Log time failed:', err);
            }
        });
    }

    /**
     * Time Log History Modal (read-only)
     * @param {string} designId
     * @param {string} companyName
     */
    async function showTimeLogModal(designId, companyName) {
        removeModals();

        var overlay = createOverlay();
        var modal = document.createElement('div');
        modal.id = 'time-log-modal';
        modal.className = 'art-modal art-modal--timelog';

        modal.innerHTML =
            '<div class="art-modal-header art-modal-header--slate">' +
                'Time Log — #' + designId +
                (companyName ? '<div class="time-log-company">' + escapeHtml(companyName) + '</div>' : '') +
            '</div>' +
            '<div class="art-modal-body">' +
                '<div style="text-align:center;color:#9ca3af;padding:20px 0;">Loading...</div>' +
            '</div>';

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        overlay.addEventListener('click', removeModals);

        try {
            var resp = await fetch(API_BASE + '/api/art-charges?id_design=' + designId);
            if (!resp.ok) throw new Error('Status ' + resp.status);
            var charges = await resp.json();

            var body = modal.querySelector('.art-modal-body');

            if (!charges || charges.length === 0) {
                body.innerHTML = '<div class="time-log-empty">No time entries logged yet</div>' +
                    '<div class="art-modal-actions"><button class="art-modal-btn-cancel" id="tl-close">Close</button></div>';
                modal.querySelector('#tl-close').addEventListener('click', removeModals);
                return;
            }

            var latest = charges[0];
            var totalMins = latest.Running_Total_Minutes || 0;
            var totalHrs = totalMins > 0 ? (Math.ceil(totalMins / 15) * 0.25).toFixed(2) : '0.00';
            var totalCost = totalMins > 0 ? (parseFloat(totalHrs) * 75).toFixed(2) : '0.00';

            var html = '<div class="time-log-summary">Total: ' + totalMins + ' min &middot; ' + totalHrs + ' hrs &middot; $' + totalCost + '</div>';

            charges.forEach(function (charge) {
                var mins = charge.Minutes || 0;
                var cost = charge.Cost ? parseFloat(charge.Cost).toFixed(2) : '0.00';
                var isNeg = mins < 0;
                var prefix = isNeg ? '' : '+';
                var dateStr = formatNoteDate(charge.Charge_Date);
                var desc = charge.Description || '';
                var runMins = charge.Running_Total_Minutes || 0;
                var runCost = charge.Running_Total_Cost ? parseFloat(charge.Running_Total_Cost).toFixed(2) : '0.00';

                var type = (charge.Charge_Type || '').toLowerCase();
                var badgeClass = 'time-log-badge--default';
                if (type.indexOf('log') !== -1) badgeClass = 'time-log-badge--logtime';
                else if (type.indexOf('completion') !== -1) badgeClass = 'time-log-badge--completion';
                else if (type.indexOf('mockup') !== -1) badgeClass = 'time-log-badge--mockup';

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
            var errBody = modal.querySelector('.art-modal-body');
            errBody.innerHTML = '<div class="time-log-empty">Failed to load time log</div>' +
                '<div class="art-modal-actions"><button class="art-modal-btn-cancel" id="tl-close">Close</button></div>';
            modal.querySelector('#tl-close').addEventListener('click', removeModals);
        }
    }

    /**
     * Send Mockup Modal (uses pre-existing #approval-modal HTML)
     * @param {string} designId
     * @param {string} companyName
     */
    async function showSendForApprovalModal(designId, companyName, onSuccess) {
        _pendingApprovalOnSuccess = onSuccess || null;
        var overlay = document.getElementById('approval-overlay');
        var modal = document.getElementById('approval-modal');
        if (!overlay || !modal) return;

        // Reset modal state
        document.getElementById('approval-message').value = '';
        document.getElementById('approval-minutes').value = '0';
        document.getElementById('approval-cost').textContent = '= $0.00';
        document.getElementById('approval-files').innerHTML = '';
        var noFilesEl = document.getElementById('approval-no-files');
        if (noFilesEl) noFilesEl.style.display = 'none';
        document.getElementById('approval-recipient').textContent = '';
        document.getElementById('approval-cc-row').style.display = 'none';
        document.getElementById('approval-cc-toggle').checked = false;
        document.getElementById('approval-cc-options').innerHTML = '';
        document.getElementById('approval-prev-time').textContent = '';
        document.getElementById('approval-new-total').textContent = '';
        var submitBtn = document.getElementById('approval-submit');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Mockup';
        submitBtn.style.background = '';

        document.getElementById('approval-company').textContent = companyName || '';

        overlay.style.display = 'block';
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Fetch art request data
        var artReqData = null;
        try {
            var resp = await fetch(API_BASE + '/api/artrequests?id_design=' + designId + '&limit=1');
            if (resp.ok) {
                var reqs = await resp.json();
                if (reqs && reqs.length > 0) artReqData = reqs[0];
            }
        } catch (e) {
            console.warn('Could not fetch art request data:', e);
        }

        // Revision badge
        var revBadge = document.getElementById('approval-modal-rev');
        var revCount = artReqData ? (artReqData.Revision_Count || 0) : 0;
        if (revCount > 0) {
            revBadge.textContent = 'Rev #' + revCount;
            revBadge.style.display = 'inline-block';
        } else {
            revBadge.style.display = 'none';
        }

        // Recipient + CC
        var salesRep = artReqData ? (artReqData.Sales_Rep || artReqData.User_Email) : '';
        var rep = resolveRep(salesRep);
        document.getElementById('approval-recipient').textContent = 'Sending to: ' + rep.displayName + ' (' + rep.email + ')';

        var ccRow = document.getElementById('approval-cc-row');
        var ccOptions = document.getElementById('approval-cc-options');
        var ccToggle = document.getElementById('approval-cc-toggle');
        var otherReps = Object.keys(REP_EMAIL_MAP).filter(function (r) { return r !== rep.displayName; });
        if (otherReps.length > 0) {
            ccRow.style.display = 'flex';
            ccOptions.innerHTML = otherReps.map(function (r) {
                return '<label class="approval-cc-rep-label">' +
                    '<input type="checkbox" class="approval-cc-rep" value="' + escapeHtml(r) + '" disabled> ' + escapeHtml(r) +
                '</label>';
            }).join('');
            ccToggle.onchange = function () {
                ccOptions.querySelectorAll('.approval-cc-rep').forEach(function (cb) {
                    cb.disabled = !ccToggle.checked;
                    if (!ccToggle.checked) cb.checked = false;
                });
            };
        }

        // Art time
        var currentArtMins = artReqData ? (artReqData.Art_Minutes || 0) : 0;
        modal.dataset.currentArtMins = currentArtMins;
        var prevTimeEl = document.getElementById('approval-prev-time');
        if (currentArtMins > 0) {
            var prevQh = Math.ceil(currentArtMins / 15) * 0.25;
            prevTimeEl.textContent = 'Previously logged: ' + currentArtMins + ' min ($' + (prevQh * 75).toFixed(2) + ')';
        } else {
            prevTimeEl.textContent = 'No art time logged yet';
        }
        updateApprovalTotal();

        // Box File Picker
        var boxLoading = document.getElementById('box-picker-loading');
        var boxFolderLabel = document.getElementById('box-picker-folder');
        var boxGrid = document.getElementById('box-picker-grid');
        var boxEmpty = document.getElementById('box-picker-empty');
        var boxError = document.getElementById('box-picker-error');
        var boxPasteFallback = document.getElementById('box-paste-fallback');
        var boxPasteInput = document.getElementById('box-paste-url');

        boxLoading.style.display = 'flex';
        boxFolderLabel.style.display = 'none';
        boxGrid.style.display = 'none';
        boxGrid.innerHTML = '';
        boxEmpty.style.display = 'none';
        boxError.style.display = 'none';
        boxPasteFallback.style.display = 'none';
        if (boxPasteInput) boxPasteInput.value = '';
        modal.dataset.selectedBoxFileId = '';
        modal.dataset.selectedBoxFileUrl = '';
        modal.dataset.existingMockupUrl = '';

        (async function loadBoxFiles() {
            try {
                var boxResp = await fetch(API_BASE + '/api/box/folder-files?designNumber=' + designId);
                boxLoading.style.display = 'none';
                if (!boxResp.ok) throw new Error('Box API ' + boxResp.status);
                var boxData = await boxResp.json();

                if (!boxData.found || boxData.files.length === 0) {
                    boxEmpty.style.display = 'block';
                    boxPasteFallback.style.display = 'block';
                    return;
                }

                boxFolderLabel.textContent = '\uD83D\uDCC1 ' + boxData.folderName + ' (' + boxData.files.length + ' files)';
                boxFolderLabel.style.display = 'block';
                boxGrid.style.display = 'grid';

                boxData.files.forEach(function (file) {
                    var card = document.createElement('div');
                    card.className = 'box-file-card';
                    card.dataset.fileId = file.id;
                    card.dataset.fileName = file.name;

                    var ext = (file.extension || '').toLowerCase();
                    var sizeKB = file.size ? Math.round(file.size / 1024) : 0;
                    var sizeLabel = sizeKB > 1024 ? (sizeKB / 1024).toFixed(1) + ' MB' : sizeKB + ' KB';

                    var extBadge = ext ? '<div class="box-file-ext-badge">' + escapeHtml(ext.toUpperCase()) + '</div>' : '';
                    card.innerHTML =
                        (file.thumbnailUrl
                            ? '<img src="' + escapeHtml(file.thumbnailUrl) + '" alt="' + escapeHtml(file.name) + '" loading="lazy"'
                              + ' data-original-src="' + escapeHtml(file.thumbnailUrl) + '">'
                              + '<div class="box-file-placeholder" style="display:none;">' + escapeHtml(ext.toUpperCase() || 'FILE') + '</div>'
                            : '<div class="box-file-placeholder">' + escapeHtml(ext.toUpperCase() || 'FILE') + '</div>'
                        )
                        + extBadge
                        + '<div class="box-file-name">' + escapeHtml(file.name) + '</div>'
                        + '<div class="box-file-meta">' + escapeHtml(sizeLabel) + '</div>'
                        + '<div class="box-file-check">\u2713</div>';
                    var boxCardImg = card.querySelector('img');
                    if (boxCardImg) boxCardImg.addEventListener('error', function () { handleBoxImageError(boxCardImg); });

                    card.addEventListener('click', function () {
                        boxGrid.querySelectorAll('.box-file-card.selected').forEach(function (c) { c.classList.remove('selected'); });
                        card.classList.add('selected');
                        modal.dataset.selectedBoxFileId = file.id;
                        modal.dataset.selectedBoxFileName = file.name;
                        if (boxPasteInput) boxPasteInput.value = '';
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Send Mockup';
                    });

                    boxGrid.appendChild(card);
                });

                boxPasteFallback.style.display = 'block';

            } catch (err) {
                boxLoading.style.display = 'none';
                console.error('Box picker error:', err);
                boxError.textContent = 'Could not load Box files. Use paste URL instead.';
                boxError.style.display = 'block';
                boxPasteFallback.style.display = 'block';
            }
        })();

        // Previously Sent files
        var prevSection = document.getElementById('approval-prev-section');
        var filesGrid = document.getElementById('approval-files');
        filesGrid.innerHTML = '';
        var prevFileCount = 0;

        var prevFileFields = [
            { key: 'Box_File_Mockup', label: 'Mockup', noteKey: 'Mockup_1_Note' },
            { key: 'BoxFileLink', label: 'Mockup 2', noteKey: 'Mockup_2_Note' },
            { key: 'Company_Mockup', label: 'Mockup 3', noteKey: 'Mockup_3_Note' }
        ];

        if (artReqData) {
            prevFileFields.forEach(function (field) {
                var url = artReqData[field.key];
                if (!url || !url.trim()) return;
                if (/^https?:\/\/cdn\.caspio\.com\/[A-Z0-9]+\/?$/i.test(url.trim())) return;
                prevFileCount++;

                var fileCard = document.createElement('div');
                fileCard.className = 'approval-file-card approval-file-selectable';
                fileCard.dataset.mockupUrl = url.trim();
                fileCard.title = 'Click to select this mockup';
                var noteVal = field.noteKey ? (artReqData[field.noteKey] || '') : '';
                fileCard.innerHTML =
                    '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(field.label) + '" loading="lazy"'
                    + ' data-original-src="' + escapeHtml(url) + '">'
                    + '<div class="approval-file-placeholder" style="display:none;">File</div>'
                    + '<div class="approval-file-label">' + escapeHtml(field.label) + '</div>'
                    + (noteVal ? '<div class="approval-file-note">' + escapeHtml(noteVal) + '</div>' : '')
                    + '<div class="approval-file-check">\u2713</div>';
                var cardImg = fileCard.querySelector('img');
                if (cardImg) cardImg.addEventListener('error', function () { handleBoxImageError(cardImg); });

                fileCard.addEventListener('click', function () {
                    // Deselect any Box file card
                    boxGrid.querySelectorAll('.box-file-card.selected').forEach(function (c) { c.classList.remove('selected'); });
                    modal.dataset.selectedBoxFileId = '';
                    modal.dataset.selectedBoxFileName = '';
                    // Deselect other prev cards, select this one
                    filesGrid.querySelectorAll('.approval-file-card.selected').forEach(function (c) { c.classList.remove('selected'); });
                    fileCard.classList.add('selected');
                    // Fill paste URL with this mockup's URL
                    if (boxPasteInput) boxPasteInput.value = fileCard.dataset.mockupUrl;
                });

                filesGrid.appendChild(fileCard);
            });
        }

        prevSection.style.display = prevFileCount > 0 ? 'block' : 'none';

        // Auto-select the first previously sent mockup so Send works immediately
        if (prevFileCount > 0) {
            var firstCard = filesGrid.querySelector('.approval-file-card');
            if (firstCard) {
                firstCard.classList.add('selected');
                if (boxPasteInput) boxPasteInput.value = firstCard.dataset.mockupUrl;
                // Also store on modal for direct access
                modal.dataset.existingMockupUrl = firstCard.dataset.mockupUrl;
            }
        }

        // Store data on modal for submit handler
        modal.dataset.designId = designId;
        modal.dataset.artReqJson = JSON.stringify({
            Sales_Rep: salesRep || '',
            CompanyName: artReqData ? artReqData.CompanyName : (companyName || ''),
            Revision_Count: artReqData ? (artReqData.Revision_Count || 0) : 0,
            PK_ID: artReqData ? artReqData.PK_ID : null,
            currentMins: artReqData ? (artReqData.Art_Minutes || 0) : 0
        });
    }

    function closeApprovalModal() {
        var overlay = document.getElementById('approval-overlay');
        var modal = document.getElementById('approval-modal');
        if (overlay) overlay.style.display = 'none';
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    async function submitSendForApproval() {
        var modal = document.getElementById('approval-modal');
        var designId = modal.dataset.designId;
        var submitBtn = document.getElementById('approval-submit');
        var mins = parseInt(document.getElementById('approval-minutes').value) || 0;
        var message = document.getElementById('approval-message').value.trim();

        var artReqMeta = {};
        try { artReqMeta = JSON.parse(modal.dataset.artReqJson || '{}'); } catch (e) { /* ignore */ }
        var revCount = artReqMeta.Revision_Count || 0;

        var selectedBoxFileId = modal.dataset.selectedBoxFileId;
        var pasteUrl = (document.getElementById('box-paste-url') || {}).value || '';
        var existingMockupUrl = modal.dataset.existingMockupUrl || '';
        var mockupUrls = [];

        // Validation: require at least one mockup file
        if (!selectedBoxFileId && !pasteUrl.trim() && !existingMockupUrl.trim()) {
            alert('Please select or upload at least one mockup before sending for approval.');
            return;
        }

        if (selectedBoxFileId) {
            submitBtn.textContent = 'Creating link...';
            try {
                var linkResp = await fetch(API_BASE + '/api/box/shared-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileId: selectedBoxFileId })
                });
                if (!linkResp.ok) throw new Error('Shared link ' + linkResp.status);
                var linkData = await linkResp.json();
                mockupUrls = [linkData.downloadUrl || linkData.sharedLink];

                var artReqPkId = artReqMeta.PK_ID;
                if (artReqPkId && mockupUrls[0]) {
                    fetch(API_BASE + '/api/art-requests/' + designId + '/upload-mockup-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ pkId: artReqPkId, url: mockupUrls[0] })
                    }).catch(function () { /* fire-and-forget */ });
                }
            } catch (linkErr) {
                console.error('Failed to create Box shared link:', linkErr);
                alert('Could not create shared link for the selected file. Please try paste URL instead.');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Mockup';
                return;
            }
        } else if (pasteUrl.trim()) {
            mockupUrls = [pasteUrl.trim()];
        } else if (existingMockupUrl.trim()) {
            mockupUrls = [existingMockupUrl.trim()];
        } else {
            alert('Please select a mockup file from Box or paste a URL.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Mockup';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        try {
            var statusBody = { status: 'Awaiting Approval' };
            if (mins > 0) statusBody.artMinutes = mins;

            var statusResp = await fetch(API_BASE + '/api/art-requests/' + designId + '/status', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(statusBody)
            });
            if (!statusResp.ok) throw new Error('Status update ' + statusResp.status);

            var revLabel = revCount > 0 ? ' (Rev #' + revCount + ')' : '';
            var noteText = message
                ? 'Mockup sent for approval' + revLabel + ': ' + message
                : 'Mockup sent for approval' + revLabel;

            var noteResp = await fetch(API_BASE + '/api/art-requests/' + designId + '/note', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    noteType: 'Mockup Sent',
                    noteText: noteText,
                    noteBy: getLoggedInUser().noteBy
                })
            });
            if (!noteResp.ok) throw new Error('Note creation ' + noteResp.status);

            if (mins > 0) {
                var qh = Math.ceil(mins / 15) * 0.25;
                var cost = (qh * 75).toFixed(2);
                await fetch(API_BASE + '/api/art-requests/' + designId + '/note', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        noteType: 'Art Time',
                        noteText: 'Logged ' + mins + ' minutes ($' + cost + ')' + revLabel,
                        noteBy: getLoggedInUser().noteBy
                    })
                }).catch(function (err) { console.warn('Art time note failed (non-blocking):', err); });
                var currentArtMinsForCharge = parseInt(modal.dataset.currentArtMins) || 0;
                logArtCharge(designId, mins, message || 'Mockup sent for approval', 'Mockup Sent', currentArtMinsForCharge);
            }

            var ccEmails = [];
            var ccToggle = document.getElementById('approval-cc-toggle');
            if (ccToggle && ccToggle.checked) {
                document.querySelectorAll('.approval-cc-rep:checked').forEach(function (cb) {
                    var repName = cb.value;
                    var repAddr = REP_EMAIL_MAP[repName];
                    if (repAddr) ccEmails.push({ name: repName, email: repAddr });
                });
            }

            // Build mockup notes for email
            var mockupNoteFields = [
                { label: 'Mockup 1', key: 'Mockup_1_Note' },
                { label: 'Mockup 2', key: 'Mockup_2_Note' },
                { label: 'Mockup 3', key: 'Mockup_3_Note' }
            ];
            var noteLines = mockupNoteFields
                .filter(function (f) { return artReqMeta[f.key] && artReqMeta[f.key].trim(); })
                .map(function (f) { return '<strong>' + f.label + ':</strong> ' + escapeHtml(artReqMeta[f.key].trim()); });

            sendNotificationEmail(designId, 'approval', {
                message: message,
                revisionCount: revCount,
                artMinutes: mins,
                salesRep: artReqMeta.Sales_Rep,
                companyName: artReqMeta.CompanyName,
                mockupUrls: mockupUrls,
                ccEmails: ccEmails,
                mockupNotes: noteLines
            });

            var repResolved = resolveRep(artReqMeta.Sales_Rep);
            fetch(API_BASE + '/api/art-notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'mockup_sent',
                    designId: designId,
                    companyName: artReqMeta.CompanyName || '',
                    actorName: 'Steve',
                    targetRep: repResolved.email
                })
            }).catch(function () { /* fire-and-forget */ });

            submitBtn.textContent = 'Sent!';
            submitBtn.style.background = '#28a745';
            var cbk = _pendingApprovalOnSuccess;
            _pendingApprovalOnSuccess = null;
            setTimeout(function () {
                closeApprovalModal();
                if (typeof cbk === 'function') {
                    cbk({ status: 'Awaiting Approval', artMinutes: artReqMeta.currentMins + mins, action: 'sendMockup' });
                } else {
                    window.location.reload();
                }
            }, 600);
        } catch (err) {
            submitBtn.textContent = 'Error — retry';
            submitBtn.style.background = '#dc3545';
            submitBtn.disabled = false;
            console.error('Send for approval failed:', err);
        }
    }

    /**
     * Wire up approval modal event listeners.
     * Call this on DOMContentLoaded from any page that has the approval modal HTML.
     */
    var _approvalListenersWired = false;
    function initApprovalModalListeners() {
        // H10 — Idempotence. This function is called from 4 pages' DOMContentLoaded
        // handlers AND from SPA-ish re-renders. Without this guard, each call stacks
        // new listeners on the same elements → Escape closes the modal N times,
        // Submit fires N times, Cost updates fire N times.
        if (_approvalListenersWired) return;

        var overlay = document.getElementById('approval-overlay');
        var closeBtn = document.getElementById('approval-modal-close');
        var cancelBtn = document.getElementById('approval-cancel');
        var submitBtn = document.getElementById('approval-submit');
        var minsInput = document.getElementById('approval-minutes');
        var plusBtn = document.getElementById('approval-plus');
        var minusBtn = document.getElementById('approval-minus');
        var costEl = document.getElementById('approval-cost');

        if (!overlay || !submitBtn || !minsInput) return; // Modal HTML not present on this page
        _approvalListenersWired = true;

        overlay.addEventListener('click', closeApprovalModal);
        if (closeBtn) closeBtn.addEventListener('click', closeApprovalModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeApprovalModal);
        submitBtn.addEventListener('click', submitSendForApproval);

        function updateApprovalCost() {
            var mins = parseInt(minsInput.value) || 0;
            var qh = Math.ceil(mins / 15) * 0.25;
            if (costEl) costEl.textContent = '= $' + (qh * 75).toFixed(2);
            updateApprovalTotal();
        }
        minsInput.addEventListener('input', updateApprovalCost);
        if (plusBtn) plusBtn.addEventListener('click', function () {
            minsInput.value = (parseInt(minsInput.value) || 0) + 15;
            updateApprovalCost();
        });
        if (minusBtn) minusBtn.addEventListener('click', function () {
            var v = (parseInt(minsInput.value) || 0) - 15;
            minsInput.value = v < 0 ? 0 : v;
            updateApprovalCost();
        });

        // Escape key
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                var modal = document.getElementById('approval-modal');
                if (modal && modal.style.display !== 'none') closeApprovalModal();
            }
        });
    }

    // ── Expose public API ─────────────────────────────────────────────

    // ── Send Mockup Reminder (shared by gallery cards + detail page) ──

    function sendMockupReminder(designId, mockupUrl, repEmail, company, buttonEl) {
        if (!mockupUrl) {
            alert('No mockup has been uploaded yet. Please upload a mockup first.');
            return;
        }

        var rep = resolveRep(repEmail);
        var displayTo = rep.displayName || rep.email || 'sales rep';

        if (!confirm('Send a mockup reminder to ' + displayTo + '?')) return;

        var originalLabel = buttonEl.textContent;
        buttonEl.disabled = true;
        buttonEl.textContent = 'Sending...';

        // 1. Log a "Reminder" note
        fetch(API_BASE + '/api/art-requests/' + designId + '/note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                noteType: 'Reminder',
                noteText: 'Mockup reminder sent to ' + displayTo,
                noteBy: getLoggedInUser().noteBy
            })
        }).then(function (resp) {
            if (!resp.ok) throw new Error('Note failed ' + resp.status);

            // 2. Send EmailJS approval reminder
            if (typeof emailjs !== 'undefined' && rep.email) {
                emailjs.send(EMAILJS_SERVICE_ID, 'art_approval_request', {
                    to_email: rep.email,
                    to_name: rep.displayName || 'Sales Team',
                    design_id: designId,
                    company_name: company,
                    detail_link: SITE_ORIGIN + '/art-request/' + designId + '?view=ae',
                    mockup_url: mockupUrl,
                    subject_prefix: 'REMINDER: ',
                    message: 'Reminder: A mockup is awaiting your review.',
                    from_name: 'Steve — Art Department',
                    revision_count: 0,
                    mockup_images_html: '<div style="display:inline-block;margin:8px;"><img src="' + escapeHtml(mockupUrl) + '" alt="Mockup" style="max-width:260px;border-radius:8px;border:1px solid #e5e7eb;"></div>',
                    mockup_count: 1,
                    art_time_display: ''
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
                    targetRep: rep.email
                })
            }).catch(function () { /* fire-and-forget */ });

            buttonEl.textContent = 'Reminder Sent!';
            buttonEl.style.background = '#28a745';
            var newCount = (parseInt(buttonEl.getAttribute('data-reminder-count') || '0') + 1);
            buttonEl.setAttribute('data-reminder-count', newCount);
            setTimeout(function () {
                buttonEl.textContent = 'Send Reminder (' + newCount + ' sent)';
                buttonEl.style.background = '';
                buttonEl.disabled = false;
            }, 3000);

        }).catch(function (err) {
            console.error('Reminder failed:', err);
            buttonEl.textContent = 'Error';
            buttonEl.style.background = '#dc3545';
            setTimeout(function () {
                buttonEl.textContent = originalLabel;
                buttonEl.style.background = '';
                buttonEl.disabled = false;
            }, 2000);
        });
    }

    window.ArtActions = {
        // Modal functions
        showArtTimeModal: showArtTimeModal,
        showLogTimeModal: showLogTimeModal,
        showTimeLogModal: showTimeLogModal,
        showSendForApprovalModal: showSendForApprovalModal,
        submitSendForApproval: submitSendForApproval,
        closeApprovalModal: closeApprovalModal,
        initApprovalModalListeners: initApprovalModalListeners,
        // Notifications
        notifyReopen: notifyReopen,
        sendMockupReminder: sendMockupReminder,
        // Helpers
        logArtCharge: logArtCharge,
        sendNotificationEmail: sendNotificationEmail,
        sendRushConfirmation: sendRushConfirmation,
        isRush: isRush,
        resolveRep: resolveRep,
        escapeHtml: escapeHtml,
        formatNoteDate: formatNoteDate,
        createOverlay: createOverlay,
        removeModals: removeModals,
        updateApprovalTotal: updateApprovalTotal,
        handleBoxImageError: handleBoxImageError,
        REP_EMAIL_MAP: REP_EMAIL_MAP,
        API_BASE: API_BASE
    };

})();
