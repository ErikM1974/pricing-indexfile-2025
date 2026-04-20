/* Supacolor Job Detail — local mirror of a single Supacolor job
 *
 * Loads /api/supacolor-jobs/:id (job + joblines + history).
 * Renders a layout that mirrors Supacolor's own job detail page.
 * "Paste Detail Screenshot" → OCR via /api/vision/extract-supacolor-job-detail
 *   → preview extracted fields → confirm → patch via upsert + replace joblines + replace history.
 *
 * URL: /pages/supacolor-job-detail.html?id=<ID_Job>
 */

(function () {
    'use strict';

    var API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    var state = {
        idJob: null,
        job: null,
        joblines: [],
        history: [],
        linkedTransfers: [],
        pendingExtraction: null
    };

    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function formatDate(iso, withTime) {
        if (!iso) return '';
        var s = (iso.length === 19) ? iso + 'Z' : iso;
        var d = new Date(s);
        if (isNaN(d.getTime())) return '';
        if (withTime) {
            return d.toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit'
            });
        }
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatMoney(n) {
        if (n === null || n === undefined || n === '') return '';
        var num = Number(n);
        if (isNaN(num)) return '';
        return '$' + num.toFixed(2);
    }

    function carrierTrackingUrl(carrier, tracking) {
        if (!tracking) return null;
        var c = (carrier || '').toLowerCase();
        if (c.indexOf('fedex') !== -1) return 'https://www.fedex.com/fedextrack/?trknbr=' + encodeURIComponent(tracking);
        if (c.indexOf('ups') !== -1)   return 'https://www.ups.com/track?tracknum=' + encodeURIComponent(tracking);
        if (c.indexOf('usps') !== -1)  return 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' + encodeURIComponent(tracking);
        if (c.indexOf('dhl') !== -1)   return 'https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=' + encodeURIComponent(tracking);
        return null;
    }

    // ── API ────────────────────────────────────────────────────────────
    async function fetchJob(idJob) {
        var resp = await fetch(API_BASE + '/api/supacolor-jobs/' + encodeURIComponent(idJob));
        if (!resp.ok) {
            if (resp.status === 404) throw new Error('Job not found');
            throw new Error('HTTP ' + resp.status);
        }
        var data = await resp.json();
        if (!data.success) throw new Error(data.error || 'Failed to load job');
        return data;
    }

    async function fetchLinkedTransfers(jobNumber) {
        if (!jobNumber) return [];
        try {
            var url = API_BASE + '/api/transfer-orders?pageSize=50&q.where=' +
                encodeURIComponent("Supacolor_Order_Number='" + jobNumber.replace(/'/g, "''") + "'");
            // The transfer-orders route uses companyName/etc as filter shortcuts, not q.where.
            // Instead we filter client-side by fetching all and matching — fast enough.
            var resp = await fetch(API_BASE + '/api/transfer-orders?pageSize=500');
            if (!resp.ok) return [];
            var data = await resp.json();
            if (!data.success) return [];
            return (data.records || []).filter(function (t) {
                return t.Supacolor_Order_Number && String(t.Supacolor_Order_Number) === String(jobNumber);
            });
        } catch (e) {
            console.warn('Linked-transfer lookup failed:', e);
            return [];
        }
    }

    async function extractJobDetail(base64Image) {
        var resp = await fetch(API_BASE + '/api/vision/extract-supacolor-job-detail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Image })
        });
        var data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'HTTP ' + resp.status);
        return data;
    }

    async function upsertJob(payload, force) {
        var url = API_BASE + '/api/supacolor-jobs/upsert' + (force ? '?force=true' : '');
        var resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        var data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'HTTP ' + resp.status);
        return data;
    }

    async function replaceJoblines(idJob, joblines) {
        var resp = await fetch(API_BASE + '/api/supacolor-jobs/' + idJob + '/joblines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ joblines: joblines })
        });
        var data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'HTTP ' + resp.status);
        return data;
    }

    async function replaceHistory(idJob, history) {
        var resp = await fetch(API_BASE + '/api/supacolor-jobs/' + idJob + '/history/replace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: history })
        });
        var data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'HTTP ' + resp.status);
        return data;
    }

    async function deleteJob(idJob) {
        var resp = await fetch(API_BASE + '/api/supacolor-jobs/' + encodeURIComponent(idJob), {
            method: 'DELETE'
        });
        var data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'HTTP ' + resp.status);
        return data;
    }

    // ── Render ─────────────────────────────────────────────────────────
    function render() {
        var j = state.job;
        if (!j) return;

        $('sjd-job-number').textContent = '#' + (j.Supacolor_Job_Number || '—');

        // Status badge
        var badge = $('sjd-status-badge');
        var status = j.Status || 'Unknown';
        // Closed → green, Cancelled → red, everything else (Open, Ganged, etc.) → blue "active"
        var statusClass = status === 'Closed' ? 'closed'
                        : status === 'Cancelled' ? 'cancelled'
                        : 'open';
        badge.className = 'sjd-status-badge sc-status-badge sc-status-badge--' + statusClass;
        badge.textContent = status;

        // Job Details card
        $('sjd-po').textContent = j.PO_Number || '—';
        $('sjd-description').textContent = j.Description || '—';
        $('sjd-location').textContent = j.Location || '—';
        $('sjd-created-by').textContent = j.Created_By_Name || '—';

        // Timeline
        renderTimelineStep('sjd-step-entered',   'sjd-date-entered',   j.Date_Entered);
        renderTimelineStep('sjd-step-requested', 'sjd-date-requested', j.Requested_Ship_Date);
        renderTimelineStep('sjd-step-shipped',   'sjd-date-shipped',   j.Date_Shipped);

        // Shipped sub-line: on-time / early / late vs Requested_Ship_Date
        var sub = $('sjd-shipped-sub');
        sub.textContent = '';
        if (j.Date_Shipped && j.Requested_Ship_Date) {
            var shipped = new Date((j.Date_Shipped.length === 19 ? j.Date_Shipped + 'Z' : j.Date_Shipped));
            var requested = new Date((j.Requested_Ship_Date.length === 19 ? j.Requested_Ship_Date + 'Z' : j.Requested_Ship_Date));
            if (!isNaN(shipped) && !isNaN(requested)) {
                var diffDays = Math.round((shipped - requested) / (1000 * 60 * 60 * 24));
                if (diffDays === 0) { sub.textContent = 'On time'; sub.className = 'sjd-timeline-sub sjd-timeline-sub--ontime'; }
                else if (diffDays < 0) { sub.textContent = Math.abs(diffDays) + 'd early'; sub.className = 'sjd-timeline-sub sjd-timeline-sub--early'; }
                else { sub.textContent = diffDays + 'd late'; sub.className = 'sjd-timeline-sub sjd-timeline-sub--late'; }
            }
        }

        // Joblines + totals
        renderJoblines();

        // Shipping
        renderShipping();

        // Linked transfer orders
        renderLinkedTransfers();

        // History
        renderHistory();

        // Footer meta
        var footer = [];
        if (j.Backfill_Source) footer.push('Source: ' + j.Backfill_Source);
        if (j.Last_Updated_At) footer.push('Last updated ' + formatDate(j.Last_Updated_At, true));
        $('sjd-backfill-source').textContent = footer.length ? footer.join(' · ') : '';
        $('sjd-last-updated').textContent = '';

        $('sjd-loading').style.display = 'none';
        $('sjd-content').style.display = '';
    }

    function renderTimelineStep(stepId, dateId, isoDate) {
        var step = $(stepId);
        var dateEl = $(dateId);
        if (isoDate) {
            dateEl.textContent = formatDate(isoDate);
            step.classList.add('sjd-timeline-step--filled');
        } else {
            dateEl.textContent = '—';
            step.classList.remove('sjd-timeline-step--filled');
        }
    }

    function renderJoblines() {
        var container = $('sjd-joblines');
        var lines = state.joblines || [];
        $('sjd-jobline-count').textContent = lines.length;

        if (lines.length === 0) {
            container.innerHTML = '<div class="sjd-empty-mini">No joblines captured yet. Paste a detail screenshot to fill them in.</div>';
            $('sjd-totals').style.display = 'none';
            return;
        }

        container.innerHTML = lines.map(function (line) {
            var thumb = line.Thumbnail_URL
                ? '<img class="sjd-line-thumb" src="' + escapeHtml(line.Thumbnail_URL) + '" alt="" onerror="this.style.display=\'none\'">'
                : '<div class="sjd-line-thumb sjd-line-thumb--placeholder">' +
                    '<i class="fas fa-' + (line.Line_Type === 'SHIPPING' ? 'truck' : line.Line_Type === 'FEE' ? 'tag' : 'image') + '"></i>' +
                  '</div>';

            var qtyPrice = (line.Quantity != null && line.Unit_Price != null)
                ? line.Quantity + ' × ' + formatMoney(line.Unit_Price)
                : '';

            var detailLine = line.Detail_Line || '';
            // For shipping rows, the detail line is often the tracking number — show it monospace
            var detailClass = (line.Line_Type === 'SHIPPING') ? 'sjd-line-detail sjd-line-detail--tracking' : 'sjd-line-detail';

            return '<div class="sjd-line">' +
                thumb +
                '<div class="sjd-line-body">' +
                    '<div class="sjd-line-code">' + escapeHtml(line.Item_Code || '') + '</div>' +
                    '<div class="sjd-line-name">' + escapeHtml(line.Description || '') + '</div>' +
                    (detailLine ? '<div class="' + detailClass + '">' + escapeHtml(detailLine) + '</div>' : '') +
                    (line.Color ? '<div class="sjd-line-color">' + escapeHtml(line.Color) + '</div>' : '') +
                '</div>' +
                '<div class="sjd-line-pricing">' +
                    '<div class="sjd-line-total">' + escapeHtml(formatMoney(line.Line_Total) || '') + '</div>' +
                    (qtyPrice ? '<div class="sjd-line-qtyprice">' + escapeHtml(qtyPrice) + '</div>' : '') +
                '</div>' +
            '</div>';
        }).join('');

        // Totals
        var j = state.job;
        if (j.Subtotal != null || j.Total != null) {
            $('sjd-totals').style.display = '';
            $('sjd-subtotal').textContent = formatMoney(j.Subtotal) || '—';
            $('sjd-total').textContent    = formatMoney(j.Total) || '—';
        } else {
            $('sjd-totals').style.display = 'none';
        }
    }

    function renderShipping() {
        var j = state.job;
        $('sjd-shipping-method').textContent = j.Shipping_Method || '';
        $('sjd-ship-name').textContent = j.Ship_To_Name || '—';

        // Address: preserve newlines
        var addrEl = $('sjd-ship-address');
        addrEl.innerHTML = '';
        if (j.Ship_To_Address) {
            var lines = String(j.Ship_To_Address).split(/\r?\n|, /);
            lines.forEach(function (line) {
                if (line.trim()) {
                    var div = document.createElement('div');
                    div.textContent = line.trim();
                    addrEl.appendChild(div);
                }
            });
        }

        $('sjd-ship-contact').textContent = j.Ship_To_Contact || '—';
        $('sjd-ship-phone').textContent = j.Ship_To_Phone || '—';
        $('sjd-ship-email').textContent = j.Ship_To_Email || '—';

        if (j.Tracking_Number) {
            $('sjd-tracking-section').style.display = '';
            $('sjd-tracking-number').textContent = j.Tracking_Number;
            var trackingUrl = carrierTrackingUrl(j.Carrier, j.Tracking_Number);
            $('sjd-tracking-link').href = trackingUrl || '#';
            if (!trackingUrl) {
                $('sjd-tracking-link').removeAttribute('target');
            }
            $('sjd-carrier-line').textContent = j.Carrier || '';
        } else {
            $('sjd-tracking-section').style.display = 'none';
        }
    }

    function renderLinkedTransfers() {
        var transfers = state.linkedTransfers || [];
        if (transfers.length === 0) {
            $('sjd-linked-card').style.display = 'none';
            return;
        }
        $('sjd-linked-card').style.display = '';
        $('sjd-linked-list').innerHTML = transfers.map(function (t) {
            return '<a href="/pages/transfer-detail.html?id=' + encodeURIComponent(t.ID_Transfer) + '" class="sjd-linked-item">' +
                '<div class="sjd-linked-id">' + escapeHtml(t.ID_Transfer) + '</div>' +
                '<div class="sjd-linked-info">' +
                    '<div class="sjd-linked-design">Design ' + escapeHtml(t.Design_Number || '—') + '</div>' +
                    '<div class="sjd-linked-company">' + escapeHtml(t.Company_Name || '') + '</div>' +
                '</div>' +
                '<div class="sjd-linked-status">' +
                    '<span class="sc-status-badge">' + escapeHtml(t.Status || '') + '</span>' +
                '</div>' +
                '<i class="fas fa-chevron-right" style="color:#adb5bd;"></i>' +
            '</a>';
        }).join('');
    }

    function renderHistory() {
        var container = $('sjd-history');
        var events = state.history || [];
        $('sjd-history-count').textContent = events.length;

        if (events.length === 0) {
            container.innerHTML = '<div class="sjd-empty-mini">No history events captured yet.</div>';
            return;
        }

        // Sort newest first
        var sorted = events.slice().sort(function (a, b) {
            var ta = a.Event_At ? new Date((a.Event_At.length === 19 ? a.Event_At + 'Z' : a.Event_At)).getTime() : 0;
            var tb = b.Event_At ? new Date((b.Event_At.length === 19 ? b.Event_At + 'Z' : b.Event_At)).getTime() : 0;
            return tb - ta;
        });

        container.innerHTML = sorted.map(function (ev) {
            var dt = ev.Event_At ? formatDate(ev.Event_At, true) : '—';
            var iconClass = 'fa-clock';
            var et = (ev.Event_Type || '').toLowerCase();
            if (et.indexOf('payment') !== -1) iconClass = 'fa-credit-card';
            else if (et.indexOf('dispatch') !== -1 || et.indexOf('shipped') !== -1) iconClass = 'fa-truck';
            else if (et.indexOf('created') !== -1) iconClass = 'fa-plus-circle';
            else if (et.indexOf('cancel') !== -1) iconClass = 'fa-times-circle';

            return '<div class="sjd-history-item">' +
                '<div class="sjd-history-icon"><i class="fas ' + iconClass + '"></i></div>' +
                '<div class="sjd-history-body">' +
                    '<div class="sjd-history-type">' + escapeHtml(ev.Event_Type || '') + '</div>' +
                    (ev.Event_Detail ? '<div class="sjd-history-detail">' + escapeHtml(ev.Event_Detail) + '</div>' : '') +
                '</div>' +
                '<div class="sjd-history-time">' + escapeHtml(dt) + '</div>' +
            '</div>';
        }).join('');
    }

    // ── Paste / OCR ────────────────────────────────────────────────────
    function openPasteModal() {
        $('sjd-paste-modal').style.display = 'flex';
        resetPasteModal();
        setTimeout(function () { $('sjd-paste-zone').focus(); }, 50);
    }
    function closePasteModal() {
        $('sjd-paste-modal').style.display = 'none';
        state.pendingExtraction = null;
    }
    function resetPasteModal() {
        $('sjd-paste-empty').style.display = '';
        $('sjd-paste-preview').style.display = 'none';
        $('sjd-paste-preview').src = '';
        $('sjd-extract-status').style.display = 'none';
        $('sjd-extract-status').innerHTML = '';
        $('sjd-extract-summary').style.display = 'none';
        $('sjd-extract-summary').innerHTML = '';
        $('sjd-paste-apply').disabled = true;
        $('sjd-overwrite').checked = false;
        state.pendingExtraction = null;
    }

    function showExtractStatus(html, kind) {
        var el = $('sjd-extract-status');
        el.style.display = '';
        el.className = 'sc-extract-status sc-extract-status--' + (kind || 'info');
        el.innerHTML = html;
    }

    async function handlePastedImage(file) {
        if (!file || !file.type || file.type.indexOf('image/') !== 0) {
            showExtractStatus('Pasted item is not an image.', 'error');
            return;
        }

        var dataUri = await new Promise(function (resolve, reject) {
            var r = new FileReader();
            r.onload = function () { resolve(r.result); };
            r.onerror = reject;
            r.readAsDataURL(file);
        });

        $('sjd-paste-empty').style.display = 'none';
        $('sjd-paste-preview').src = dataUri;
        $('sjd-paste-preview').style.display = '';
        $('sjd-paste-apply').disabled = true;

        showExtractStatus('<i class="fas fa-spinner fa-spin"></i> Reading screenshot with Claude Vision…', 'info');

        try {
            var result = await extractJobDetail(dataUri);
            var d = result.data || {};
            console.log('[SupacolorJobDetail] Vision raw response:', d);

            // Sanity: if extracted job number doesn't match this job, warn
            var current = state.job.Supacolor_Job_Number;
            if (d.supacolorJobNumber && current && String(d.supacolorJobNumber) !== String(current)) {
                showExtractStatus(
                    '<i class="fas fa-exclamation-triangle"></i> Extracted job number <strong>#' +
                    escapeHtml(d.supacolorJobNumber) + '</strong> does not match this job (#' + escapeHtml(current) + '). ' +
                    'Apply anyway only if you know what you\'re doing.',
                    'error'
                );
            } else {
                var jlCount = (d.joblines || []).length;
                var histCount = (d.history || []).length;
                var thinExtraction = (jlCount === 0 && histCount === 0);
                var summary = [];
                if (d.subtotal != null || d.total != null) summary.push('Total: ' + formatMoney(d.total != null ? d.total : d.subtotal));
                summary.push(jlCount + ' joblines');
                summary.push(histCount + ' history events');
                if (d.trackingNumber) summary.push('Tracking: ' + d.trackingNumber);

                if (thinExtraction) {
                    showExtractStatus(
                        '<i class="fas fa-exclamation-triangle"></i> Vision extracted ' + (result.duration || 0) + 'ms — ' +
                        '<strong>but found 0 joblines and 0 history events.</strong> ' +
                        'The screenshot may be too small or cropped. Try a fresh full-page screenshot of the entire job detail page.',
                        'error'
                    );
                } else {
                    showExtractStatus(
                        '<i class="fas fa-check-circle"></i> Extracted in ' + (result.duration || 0) + 'ms · ' +
                        summary.join(' · '),
                        'success'
                    );
                }
            }

            state.pendingExtraction = d;

            // Render summary preview
            var sumEl = $('sjd-extract-summary');
            sumEl.style.display = '';
            sumEl.innerHTML = renderExtractionSummary(d);

            $('sjd-paste-apply').disabled = false;

        } catch (err) {
            console.error('[SupacolorJobDetail] Extraction failed:', err);
            showExtractStatus(
                '<i class="fas fa-exclamation-triangle"></i> ' + escapeHtml(err.message || 'Extraction failed'),
                'error'
            );
        }
    }

    function renderExtractionSummary(d) {
        var parts = [];
        var jobFields = [];
        if (d.poNumber) jobFields.push('PO: <code>' + escapeHtml(d.poNumber) + '</code>');
        if (d.description) jobFields.push('Description: <strong>' + escapeHtml(d.description) + '</strong>');
        if (d.status) jobFields.push('Status: ' + escapeHtml(d.status));
        if (d.location) jobFields.push('Location: ' + escapeHtml(d.location));
        if (d.createdByName) jobFields.push('Created by: ' + escapeHtml(d.createdByName));
        if (d.dateEntered) jobFields.push('Entered: ' + escapeHtml(d.dateEntered));
        if (d.dateShipped) jobFields.push('Shipped: ' + escapeHtml(d.dateShipped));
        if (d.subtotal != null) jobFields.push('Subtotal: ' + formatMoney(d.subtotal));
        if (d.total != null)    jobFields.push('Total: ' + formatMoney(d.total));
        if (d.carrier) jobFields.push('Carrier: ' + escapeHtml(d.carrier));
        if (d.shippingMethod) jobFields.push('Method: ' + escapeHtml(d.shippingMethod));
        if (d.trackingNumber) jobFields.push('Tracking: <code>' + escapeHtml(d.trackingNumber) + '</code>');
        if (d.paymentStatus) jobFields.push('Payment: ' + escapeHtml(d.paymentStatus));

        if (jobFields.length) {
            parts.push('<div class="sjd-summary-section"><strong>Job fields (' + jobFields.length + '):</strong><ul><li>' + jobFields.join('</li><li>') + '</li></ul></div>');
        } else {
            parts.push('<div class="sjd-summary-section sjd-summary-empty"><strong>⚠ No job fields extracted.</strong></div>');
        }
        if (d.joblines && d.joblines.length) {
            parts.push('<div class="sjd-summary-section"><strong>' + d.joblines.length + ' joblines:</strong><ul>' +
                d.joblines.map(function (l) {
                    return '<li>' + escapeHtml(l.itemCode || '') + ' — ' + escapeHtml(l.description || '') +
                        (l.lineTotal != null ? ' (' + formatMoney(l.lineTotal) + ')' : '') + '</li>';
                }).join('') + '</ul></div>');
        } else {
            parts.push('<div class="sjd-summary-section sjd-summary-empty"><strong>⚠ 0 joblines extracted.</strong> Vision missed the line items — try re-pasting or zoom into the joblines section.</div>');
        }
        if (d.history && d.history.length) {
            parts.push('<div class="sjd-summary-section"><strong>' + d.history.length + ' history events:</strong><ul>' +
                d.history.map(function (h) {
                    return '<li>' + escapeHtml(h.eventType || '') + (h.eventAt ? ' — ' + escapeHtml(h.eventAt) : '') + '</li>';
                }).join('') + '</ul></div>');
        } else {
            parts.push('<div class="sjd-summary-section sjd-summary-empty"><strong>⚠ 0 history events extracted.</strong></div>');
        }
        return parts.join('');
    }

    async function applyPendingExtraction() {
        if (!state.pendingExtraction) return;
        var d = state.pendingExtraction;
        var force = $('sjd-overwrite').checked;
        var btn = $('sjd-paste-apply');
        var orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

        try {
            // 1. Upsert top-level job fields
            var jobPayload = {
                Supacolor_Job_Number: state.job.Supacolor_Job_Number,
                PO_Number: d.poNumber || undefined,
                Description: d.description || undefined,
                Status: d.status || undefined,
                Location: d.location || undefined,
                Created_By_Name: d.createdByName || undefined,
                Date_Entered: d.dateEntered || undefined,
                Requested_Ship_Date: d.requestedShipDate || undefined,
                Date_Shipped: d.dateShipped || undefined,
                Subtotal: (d.subtotal != null ? d.subtotal : undefined),
                Total: (d.total != null ? d.total : undefined),
                Payment_Status: d.paymentStatus || undefined,
                Payment_Method: d.paymentMethod || undefined,
                Carrier: d.carrier || undefined,
                Shipping_Method: d.shippingMethod || undefined,
                Tracking_Number: d.trackingNumber || undefined,
                Ship_To_Name: d.shipToName || undefined,
                Ship_To_Address: d.shipToAddress || undefined,
                Ship_To_Contact: d.shipToContact || undefined,
                Ship_To_Phone: d.shipToPhone || undefined,
                Ship_To_Email: d.shipToEmail || undefined,
                Backfill_Source: 'screenshot'
            };
            // Strip undefined so the upsert knows which fields we have
            Object.keys(jobPayload).forEach(function (k) {
                if (jobPayload[k] === undefined) delete jobPayload[k];
            });

            console.log('[SupacolorJobDetail] Extraction:', d);
            console.log('[SupacolorJobDetail] Job upsert payload:', jobPayload);

            var upsertResult = await upsertJob(jobPayload, force);
            console.log('[SupacolorJobDetail] Upsert result:', upsertResult);
            var jobAction = (upsertResult && upsertResult.action) || 'updated';
            var fieldsWritten = (upsertResult && upsertResult.updatedFields) ? upsertResult.updatedFields.length :
                                (jobAction === 'inserted' ? Object.keys(jobPayload).length : 0);

            // 2. Replace joblines (always replace — joblines are derived from screenshot, no manual edits)
            var joblinesWritten = 0;
            if (d.joblines && d.joblines.length) {
                var lines = d.joblines.map(function (l, i) {
                    return {
                        Line_Order: l.lineOrder || (i + 1),
                        Line_Type: l.lineType || 'TRANSFER',
                        Item_Code: l.itemCode || '',
                        Description: l.description || null,
                        Detail_Line: l.detailLine || null,
                        Color: l.color || null,
                        Quantity: l.quantity != null ? l.quantity : null,
                        Unit_Price: l.unitPrice != null ? l.unitPrice : null,
                        Line_Total: l.lineTotal != null ? l.lineTotal : null
                    };
                });
                console.log('[SupacolorJobDetail] Joblines payload:', lines);
                var jlResult = await replaceJoblines(state.idJob, lines);
                console.log('[SupacolorJobDetail] Joblines result:', jlResult);
                joblinesWritten = (jlResult && jlResult.inserted) || lines.length;
            }

            // 3. Replace history (same logic — full replace from screenshot)
            var historyWritten = 0;
            if (d.history && d.history.length) {
                var events = d.history.map(function (h) {
                    return {
                        Event_Type: h.eventType || 'Event',
                        Event_Detail: h.eventDetail || null,
                        Event_At: h.eventAt || null
                    };
                });
                console.log('[SupacolorJobDetail] History payload:', events);
                var hResult = await replaceHistory(state.idJob, events);
                console.log('[SupacolorJobDetail] History result:', hResult);
                historyWritten = (hResult && hResult.inserted) || events.length;
            }

            // Build a detailed success summary
            var summary = [];
            if (fieldsWritten > 0)    summary.push(fieldsWritten + ' field' + (fieldsWritten === 1 ? '' : 's'));
            if (joblinesWritten > 0)  summary.push(joblinesWritten + ' jobline' + (joblinesWritten === 1 ? '' : 's'));
            if (historyWritten > 0)   summary.push(historyWritten + ' history event' + (historyWritten === 1 ? '' : 's'));
            var totalWritten = fieldsWritten + joblinesWritten + historyWritten;
            var summaryMsg = totalWritten > 0
                ? 'Saved: ' + summary.join(', ')
                : 'Nothing was saved — all fields were already filled. Check "Overwrite" to force-update.';

            showToast(summaryMsg, totalWritten > 0 ? 'success' : 'error');
            closePasteModal();

            // Reload from server
            var data = await fetchJob(state.idJob);
            state.job = data.job;
            state.joblines = data.joblines || [];
            state.history = data.history || [];
            render();

        } catch (err) {
            console.error('[SupacolorJobDetail] Apply failed:', err);
            showToast('Apply failed: ' + (err.message || 'unknown error'), 'error');
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    }

    // ── Toast ──────────────────────────────────────────────────────────
    function showToast(message, kind) {
        var c = $('sjd-toast-container');
        if (!c) return;
        var t = document.createElement('div');
        t.className = 'bt-toast bt-toast--' + (kind || 'info');
        t.innerHTML = '<i class="fas fa-' + (kind === 'error' ? 'exclamation-triangle' :
                                              kind === 'success' ? 'check-circle' : 'info-circle') +
                      '"></i> ' + escapeHtml(message);
        c.appendChild(t);
        setTimeout(function () { t.classList.add('bt-toast--show'); }, 10);
        setTimeout(function () {
            t.classList.remove('bt-toast--show');
            setTimeout(function () { t.remove(); }, 300);
        }, 4500);
    }

    // ── Edit-fields placeholder (out of scope for v1 — paste flow handles updates) ─
    function openEditPlaceholder() {
        showToast('Edit fields directly via screenshot paste, or use Caspio admin for now.', 'info');
    }

    // ── Delete flow ────────────────────────────────────────────────────
    function openDeleteModal() {
        if (!state.job) return;
        var j = state.job;
        $('sjd-delete-job-label').textContent = '#' + (j.Supacolor_Job_Number || j.ID_Job) +
            (j.Description ? ' (' + j.Description + ')' : '');
        $('sjd-delete-jobline-count').textContent = (state.joblines || []).length;
        $('sjd-delete-history-count').textContent = (state.history || []).length;

        // Open status warning + extra confirmation checkbox
        var openWarning = $('sjd-delete-open-warning');
        var openConfirm = $('sjd-delete-open-confirm');
        var deleteBtn = $('sjd-delete-confirm');
        if (j.Status === 'Open') {
            openWarning.style.display = '';
            openConfirm.checked = false;
            deleteBtn.disabled = true;
            openConfirm.onchange = function () { deleteBtn.disabled = !openConfirm.checked; };
        } else {
            openWarning.style.display = 'none';
            deleteBtn.disabled = false;
        }

        $('sjd-delete-modal').style.display = 'flex';
    }
    function closeDeleteModal() {
        $('sjd-delete-modal').style.display = 'none';
    }

    async function confirmDelete() {
        var btn = $('sjd-delete-confirm');
        var orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting…';
        try {
            await deleteJob(state.idJob);
            showToast('Job deleted', 'success');
            // Brief delay so toast shows before navigating away
            setTimeout(function () {
                window.location.href = '/dashboards/supacolor-orders.html';
            }, 600);
        } catch (err) {
            console.error('Delete failed:', err);
            showToast('Delete failed: ' + (err.message || 'unknown error'), 'error');
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    }

    // ── Init ───────────────────────────────────────────────────────────
    async function init() {
        var params = new URLSearchParams(window.location.search);
        state.idJob = params.get('id');
        if (!state.idJob) {
            $('sjd-loading').innerHTML = '<i class="fas fa-exclamation-triangle"></i> Missing ?id=&lt;ID_Job&gt; in URL.';
            return;
        }

        // Wire UI
        $('sjd-paste-btn').addEventListener('click', openPasteModal);
        $('sjd-edit-btn').addEventListener('click', openEditPlaceholder);
        $('sjd-delete-btn').addEventListener('click', openDeleteModal);
        $('sjd-paste-modal-close').addEventListener('click', closePasteModal);
        $('sjd-paste-cancel').addEventListener('click', closePasteModal);
        $('sjd-paste-apply').addEventListener('click', applyPendingExtraction);
        $('sjd-paste-modal').addEventListener('click', function (e) {
            if (e.target === $('sjd-paste-modal')) closePasteModal();
        });
        $('sjd-delete-modal-close').addEventListener('click', closeDeleteModal);
        $('sjd-delete-cancel').addEventListener('click', closeDeleteModal);
        $('sjd-delete-confirm').addEventListener('click', confirmDelete);
        $('sjd-delete-modal').addEventListener('click', function (e) {
            if (e.target === $('sjd-delete-modal')) closeDeleteModal();
        });

        var pasteZone = $('sjd-paste-zone');
        // Paste listener on document (not the zone) so it fires regardless of
        // where focus is when Ctrl+V hits — avoids the setTimeout-focus race
        // where the first Ctrl+V lands on the trigger button (outside the
        // modal) and silently no-ops.
        var pasteModal = $('sjd-paste-modal');
        document.addEventListener('paste', function (e) {
            if (pasteModal.style.display === 'none') return;
            var items = (e.clipboardData || window.clipboardData || {}).items;
            if (!items) return;
            for (var i = 0; i < items.length; i++) {
                if (items[i].type && items[i].type.indexOf('image/') === 0) {
                    e.preventDefault();
                    handlePastedImage(items[i].getAsFile());
                    return;
                }
            }
            // No image in clipboard — let default paste happen (e.g. text into an input)
        });
        pasteZone.addEventListener('dragover', function (e) { e.preventDefault(); pasteZone.classList.add('sc-paste-zone--dragover'); });
        pasteZone.addEventListener('dragleave', function () { pasteZone.classList.remove('sc-paste-zone--dragover'); });
        pasteZone.addEventListener('drop', function (e) {
            e.preventDefault();
            pasteZone.classList.remove('sc-paste-zone--dragover');
            var f = e.dataTransfer.files[0];
            if (f) handlePastedImage(f);
        });
        pasteZone.addEventListener('click', function (e) {
            if (e.target.id === 'sjd-paste-empty' || e.target.closest('#sjd-paste-empty')) {
                $('sjd-paste-file').click();
            }
        });
        $('sjd-paste-file').addEventListener('change', function (e) {
            if (e.target.files[0]) handlePastedImage(e.target.files[0]);
        });

        // Load
        try {
            var data = await fetchJob(state.idJob);
            state.job = data.job;
            state.joblines = data.joblines || [];
            state.history = data.history || [];
            render();
            // Linked transfers in background
            fetchLinkedTransfers(state.job.Supacolor_Job_Number).then(function (linked) {
                state.linkedTransfers = linked;
                renderLinkedTransfers();
            });
        } catch (err) {
            console.error('Load failed:', err);
            $('sjd-loading').innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + escapeHtml(err.message || 'Failed to load job');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
