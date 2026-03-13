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

    var EMAILJS_SERVICE_ID = 'service_1c4k67j';
    var EMAILJS_PUBLIC_KEY = '4qSbDO-SQs19TbP80';

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

    function logArtCharge(designId, mins, description, chargeType, currentTotalMins) {
        if (mins <= 0) return;

        var newTotalMins = currentTotalMins + mins;
        var cost = parseFloat((Math.ceil(mins / 15) * 0.25 * 75).toFixed(2));
        var totalCost = parseFloat((Math.ceil(newTotalMins / 15) * 0.25 * 75).toFixed(2));

        fetch(API_BASE + '/api/art-charges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ID_Design: parseInt(designId),
                Minutes: mins,
                Cost: cost,
                Description: (description || '').substring(0, 255),
                Charge_Type: chargeType,
                Logged_By: 'art@nwcustomapparel.com',
                Running_Total_Minutes: newTotalMins,
                Running_Total_Cost: totalCost
            })
        }).catch(function (err) { console.warn('Art charge log failed (non-blocking):', err); });
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
                        salesRep = reqs[0].User_Email || reqs[0].Sales_Rep;
                        companyName = reqs[0].CompanyName;
                    }
                }
            }

            var rep = resolveRep(salesRep);
            var repEmail = rep.email;
            var detailLink = window.location.origin + '/art-request/' + designId;

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
                var imagesHtml = urls.map(function (url, i) {
                    return '<div style="display:inline-block;margin:8px;"><img src="' + url + '" alt="Mockup ' + (i + 1) + '" style="max-width:260px;border-radius:8px;border:1px solid #e5e7eb;"></div>';
                }).join('');
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
                    mockup_count: urls.length
                };
            }

            if (templateId) {
                await emailjs.send(EMAILJS_SERVICE_ID, templateId, templateParams, EMAILJS_PUBLIC_KEY);
                console.log('Notification email sent (' + type + ') for design ' + designId);

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
    async function showArtTimeModal(designId, repEmail, companyName) {
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

        function updateCost() {
            var mins = parseInt(minutesInput.value) || 0;
            var qh = Math.ceil(mins / 15) * 0.25;
            costDiv.textContent = '= $' + (qh * 75).toFixed(2);
            var totalMins = currentMins + mins;
            var totalQh = Math.ceil(totalMins / 15) * 0.25;
            newTotalDiv.textContent = 'Final total: ' + totalMins + ' min (' + totalQh.toFixed(2) + ' hrs, $' + (totalQh * 75).toFixed(2) + ')';
        }
        updateCost();

        minutesInput.addEventListener('input', updateCost);
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
            this.disabled = true;
            this.textContent = 'Saving...';

            try {
                var statusResp = await fetch(API_BASE + '/api/art-requests/' + designId + '/status', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'Completed', artMinutes: mins })
                });
                if (!statusResp.ok) throw new Error('Status ' + statusResp.status);

                if (mins > 0) {
                    var qh = Math.ceil(mins / 15) * 0.25;
                    var cost = (qh * 75).toFixed(2);
                    await fetch(API_BASE + '/api/art-requests/' + designId + '/note', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            noteType: 'Art Time',
                            noteText: 'Completed: ' + mins + ' additional minutes ($' + cost + ')',
                            noteBy: 'art@nwcustomapparel.com'
                        })
                    }).catch(function (err) { console.warn('Art time note failed (non-blocking):', err); });
                    logArtCharge(designId, mins, 'Completed', 'Completion', currentMins);
                }

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
                setTimeout(function () { removeModals(); window.location.reload(); }, 600);
            } catch (err) {
                this.textContent = 'Error — retry';
                this.style.background = '#dc3545';
                this.disabled = false;
                console.error('Complete action failed:', err);
            }
        });
    }

    /**
     * Log Time Modal (standalone art time logging)
     * @param {string} designId
     * @param {string} currentStatus - Current status text to preserve on PUT
     */
    async function showLogTimeModal(designId, currentStatus) {
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
                            noteBy: 'art@nwcustomapparel.com'
                        })
                    }).catch(function (err) { console.warn('Art time note failed (non-blocking):', err); });
                    var currentMinsForCharge = parseInt(modal.dataset.currentMins) || 0;
                    logArtCharge(designId, mins, noteText || (mins < 0 ? 'Time removed' : 'Art time logged'), 'Log Time', currentMinsForCharge);
                }

                this.textContent = 'Saved!';
                this.style.background = '#0891b2';
                setTimeout(function () { removeModals(); window.location.reload(); }, 600);
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
    async function showSendForApprovalModal(designId, companyName) {
        var overlay = document.getElementById('approval-overlay');
        var modal = document.getElementById('approval-modal');
        if (!overlay || !modal) return;

        // Reset modal state
        document.getElementById('approval-message').value = '';
        document.getElementById('approval-minutes').value = '0';
        document.getElementById('approval-cost').textContent = '= $0.00';
        document.getElementById('approval-files').innerHTML = '';
        document.getElementById('approval-no-files').style.display = 'none';
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
        var salesRep = artReqData ? (artReqData.User_Email || artReqData.Sales_Rep) : '';
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
            ccToggle.addEventListener('change', function () {
                ccOptions.querySelectorAll('.approval-cc-rep').forEach(function (cb) {
                    cb.disabled = !ccToggle.checked;
                    if (!ccToggle.checked) cb.checked = false;
                });
            });
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

                    card.innerHTML =
                        (file.thumbnailUrl
                            ? '<img src="' + escapeHtml(file.thumbnailUrl) + '" alt="' + escapeHtml(file.name) + '" loading="lazy" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">'
                              + '<div class="box-file-placeholder" style="display:none;">' + escapeHtml(ext.toUpperCase() || 'FILE') + '</div>'
                            : '<div class="box-file-placeholder">' + escapeHtml(ext.toUpperCase() || 'FILE') + '</div>'
                        )
                        + '<div class="box-file-name">' + escapeHtml(file.name) + '</div>'
                        + '<div class="box-file-meta">' + escapeHtml(sizeLabel) + '</div>'
                        + '<div class="box-file-check">\u2713</div>';

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
            { key: 'Box_File_Mockup', label: 'Mockup' },
            { key: 'BoxFileLink', label: 'Mockup 2' },
            { key: 'Company_Mockup', label: 'Mockup 3' }
        ];

        if (artReqData) {
            prevFileFields.forEach(function (field) {
                var url = artReqData[field.key];
                if (!url || !url.trim()) return;
                if (/^https?:\/\/cdn\.caspio\.com\/[A-Z0-9]+\/?$/i.test(url.trim())) return;
                prevFileCount++;

                var fileCard = document.createElement('div');
                fileCard.className = 'approval-file-card';
                fileCard.innerHTML =
                    '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(field.label) + '" loading="lazy"'
                    + ' onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">'
                    + '<div class="approval-file-placeholder" style="display:none;">File</div>'
                    + '<div class="approval-file-label">' + escapeHtml(field.label) + '</div>';
                filesGrid.appendChild(fileCard);
            });
        }

        prevSection.style.display = prevFileCount > 0 ? 'block' : 'none';

        // Store data on modal for submit handler
        modal.dataset.designId = designId;
        modal.dataset.artReqJson = JSON.stringify({
            Sales_Rep: salesRep || '',
            CompanyName: artReqData ? artReqData.CompanyName : (companyName || ''),
            Revision_Count: artReqData ? (artReqData.Revision_Count || 0) : 0,
            PK_ID: artReqData ? artReqData.PK_ID : null
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
        var mockupUrls = [];

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
                    noteBy: 'art@nwcustomapparel.com'
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
                        noteBy: 'art@nwcustomapparel.com'
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

            sendNotificationEmail(designId, 'approval', {
                message: message,
                revisionCount: revCount,
                artMinutes: mins,
                salesRep: artReqMeta.Sales_Rep,
                companyName: artReqMeta.CompanyName,
                mockupUrls: mockupUrls,
                ccEmails: ccEmails
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
            setTimeout(function () { closeApprovalModal(); window.location.reload(); }, 600);
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
    function initApprovalModalListeners() {
        var overlay = document.getElementById('approval-overlay');
        var closeBtn = document.getElementById('approval-modal-close');
        var cancelBtn = document.getElementById('approval-cancel');
        var submitBtn = document.getElementById('approval-submit');
        var minsInput = document.getElementById('approval-minutes');

        if (!overlay || !submitBtn) return; // Modal HTML not present on this page

        overlay.addEventListener('click', closeApprovalModal);
        if (closeBtn) closeBtn.addEventListener('click', closeApprovalModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeApprovalModal);
        submitBtn.addEventListener('click', submitSendForApproval);

        function updateApprovalCost() {
            var mins = parseInt(minsInput.value) || 0;
            var qh = Math.ceil(mins / 15) * 0.25;
            document.getElementById('approval-cost').textContent = '= $' + (qh * 75).toFixed(2);
            updateApprovalTotal();
        }
        minsInput.addEventListener('input', updateApprovalCost);
        document.getElementById('approval-plus').addEventListener('click', function () {
            minsInput.value = (parseInt(minsInput.value) || 0) + 15;
            updateApprovalCost();
        });
        document.getElementById('approval-minus').addEventListener('click', function () {
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

    window.ArtActions = {
        // Modal functions
        showArtTimeModal: showArtTimeModal,
        showLogTimeModal: showLogTimeModal,
        showTimeLogModal: showTimeLogModal,
        showSendForApprovalModal: showSendForApprovalModal,
        submitSendForApproval: submitSendForApproval,
        closeApprovalModal: closeApprovalModal,
        initApprovalModalListeners: initApprovalModalListeners,
        // Helpers
        logArtCharge: logArtCharge,
        sendNotificationEmail: sendNotificationEmail,
        resolveRep: resolveRep,
        escapeHtml: escapeHtml,
        formatNoteDate: formatNoteDate,
        createOverlay: createOverlay,
        removeModals: removeModals,
        updateApprovalTotal: updateApprovalTotal,
        REP_EMAIL_MAP: REP_EMAIL_MAP,
        API_BASE: API_BASE
    };

})();
