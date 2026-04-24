/* Supacolor Orders Dashboard — local mirror of Supacolor's job list
 *
 * Polls /api/supacolor-jobs every 60s. Filters client-side.
 * Click row → /pages/supacolor-job-detail.html?id=<ID_Job>.
 * Backfill: paste jobs-list screenshot → OCR → bulk-upsert.
 *
 * Depends on: bradley-transfers.css, supacolor-orders.css, art-hub.css
 * API: /api/supacolor-jobs, /api/supacolor-jobs/stats, /api/supacolor-jobs/bulk-upsert,
 *      /api/vision/extract-supacolor-jobs-list
 */

(function () {
    'use strict';

    var API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    var POLL_INTERVAL_MS = 60 * 1000;
    var PAGE_SIZE = 25;

    var state = {
        allJobs: [],
        filteredJobs: [],
        stats: {},
        filters: { status: '', search: '', view: 'active' }, // view: active|closed|cancelled|all
        currentPage: 1,
        pollTimer: null,
        pendingBackfill: null,  // extracted jobs awaiting import confirmation (list-view path)
        pendingSingleJob: null  // { stub, detail } — when paste was a single-job detail screenshot
    };

    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function formatDate(iso) {
        if (!iso) return '';
        // Caspio strips Z — append for correct UTC parse
        var s = iso.length === 19 ? iso + 'Z' : iso;
        var d = new Date(s);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // Carrier → tracking-URL mapping. Duplicated (intentionally) from
    // shared_components/js/transfer-actions-shared.js where the same function
    // is scoped inside an IIFE and not exported. Keeping a local copy avoids
    // dragging in the whole transfer module for 10 lines of logic.
    function trackingUrlFromCarrier(carrier, tracking) {
        if (!tracking) return '';
        var c = String(carrier || '').toLowerCase();
        var t = encodeURIComponent(tracking);
        if (c.indexOf('fedex') >= 0) return 'https://www.fedex.com/fedextrack/?tracknumbers=' + t;
        if (c.indexOf('ups') >= 0) return 'https://www.ups.com/track?tracknum=' + t;
        if (c.indexOf('usps') >= 0) return 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' + t;
        if (c.indexOf('dhl') >= 0) return 'https://www.dhl.com/en/express/tracking.html?AWB=' + t;
        return ''; // unknown carrier → no clickable link (text still shown)
    }

    // Build the Shipped cell content — date on top, tracking pill below.
    // Tracking pill is a <span> (not nested <a>) with a delegated click handler
    // in renderTable() to open the carrier page without triggering row navigation.
    function shippedCellHtml(j) {
        var dateHtml = '<div class="sc-ship-date">' + escapeHtml(formatDate(j.Date_Shipped)) + '</div>';
        if (!j.Tracking_Number) return dateHtml;

        var carrierLabel = j.Carrier ? escapeHtml(j.Carrier) : 'Tracking';
        var trackingUrl = trackingUrlFromCarrier(j.Carrier, j.Tracking_Number);
        var pillClass = 'sc-track-pill' + (trackingUrl ? ' sc-track-pill--link' : '');
        var pillAttrs = trackingUrl
            ? ' data-track-url="' + escapeHtml(trackingUrl) + '" title="Open in ' + carrierLabel + ' tracking"'
            : '';
        return dateHtml +
            '<span class="' + pillClass + '"' + pillAttrs + '>' +
                '<i class="fas fa-truck"></i> ' +
                escapeHtml(carrierLabel) + ' ' +
                escapeHtml(j.Tracking_Number) +
            '</span>';
    }

    // ── API ────────────────────────────────────────────────────────────
    async function fetchJobs() {
        try {
            var resp = await fetch(API_BASE + '/api/supacolor-jobs?pageSize=500&orderBy=' +
                encodeURIComponent('Date_Shipped DESC'));
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();
            if (!data.success) throw new Error(data.error || 'API returned success=false');
            state.allJobs = data.records || [];
            return state.allJobs;
        } catch (err) {
            console.error('Failed to fetch Supacolor jobs:', err);
            showToast('Unable to load jobs. Please refresh.', 'error');
            throw err;
        }
    }

    async function fetchStats() {
        try {
            var resp = await fetch(API_BASE + '/api/supacolor-jobs/stats');
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();
            if (!data.success) return;
            state.stats = data.stats || {};
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    }

    async function extractJobsList(base64Image) {
        var resp = await fetch(API_BASE + '/api/vision/extract-supacolor-jobs-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Image })
        });
        var data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'HTTP ' + resp.status);
        return data;
    }

    async function bulkUpsertJobs(jobs) {
        var resp = await fetch(API_BASE + '/api/supacolor-jobs/bulk-upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobs: jobs })
        });
        var data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'HTTP ' + resp.status);
        return data;
    }

    // Single-job detail extraction + save — mirrors the flow in supacolor-job-detail.js
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

    // ── Filtering ──────────────────────────────────────────────────────
    function applyFilters() {
        var f = state.filters;
        var search = f.search.toLowerCase().trim();

        state.filteredJobs = state.allJobs.filter(function (j) {
            // View filter (driven by the clickable stat cards):
            //   active    = anything that isn't Closed/Cancelled (Open, Ganged, etc.)
            //   closed    = Closed only (Cancelled has its own bucket now)
            //   cancelled = Cancelled only
            //   all       = no view filter
            if (f.view === 'active'    && (j.Status === 'Closed' || j.Status === 'Cancelled')) return false;
            if (f.view === 'closed'    && j.Status !== 'Closed') return false;
            if (f.view === 'cancelled' && j.Status !== 'Cancelled') return false;

            // Explicit status filter overrides view
            if (f.status && j.Status !== f.status) return false;

            if (search) {
                var hay = [j.Supacolor_Job_Number, j.PO_Number, j.Description]
                    .filter(Boolean).join(' ').toLowerCase();
                if (hay.indexOf(search) === -1) return false;
            }
            return true;
        });

        state.currentPage = 1;
        render();
    }

    // ── Render ─────────────────────────────────────────────────────────
    function render() {
        renderStats();
        renderTable();
    }

    function renderStats() {
        // Backend now returns stats.Active (covers Open + Ganged + others);
        // fall back to stats.Open for a clean cut-over if proxy is older.
        var active = state.stats.Active != null ? state.stats.Active : (state.stats.Open || 0);
        $('sc-stat-open').textContent       = active;
        $('sc-stat-closed').textContent     = state.stats.Closed || 0;
        $('sc-stat-cancelled').textContent  = state.stats.Cancelled || 0;
        var total = active + (state.stats.Closed || 0) + (state.stats.Cancelled || 0);
        $('sc-stat-total').textContent = total;
    }

    function renderTable() {
        var wrap = $('sc-table-wrap');
        var jobs = state.filteredJobs;
        var totalCount = jobs.length;

        if (totalCount === 0) {
            wrap.innerHTML = '<div class="bt-empty"><i class="fas fa-inbox"></i><p>No jobs match your filters.</p></div>';
            $('sc-result-count').textContent = '0 jobs';
            $('sc-pagination').style.display = 'none';
            return;
        }

        // Pagination
        var totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
        if (state.currentPage > totalPages) state.currentPage = totalPages;
        var start = (state.currentPage - 1) * PAGE_SIZE;
        var pageJobs = jobs.slice(start, start + PAGE_SIZE);

        var rows = pageJobs.map(function (j) {
            // Closed → green, Cancelled → red, everything else (Open, Ganged,
            // In Production, etc.) → blue "active" styling
            var statusClass = j.Status === 'Closed' ? 'closed'
                            : j.Status === 'Cancelled' ? 'cancelled'
                            : 'open';
            var detailUrl = '/pages/supacolor-job-detail.html?id=' + encodeURIComponent(j.ID_Job);

            return '<a href="' + detailUrl + '" class="sc-row">' +
                '<div class="sc-cell sc-cell--job">#' + escapeHtml(j.Supacolor_Job_Number || '—') + '</div>' +
                '<div class="sc-cell sc-cell--po">' + escapeHtml(j.PO_Number || '') + '</div>' +
                '<div class="sc-cell sc-cell--desc">' + escapeHtml(j.Description || '') + '</div>' +
                '<div class="sc-cell sc-cell--status">' +
                    '<span class="sc-status-badge sc-status-badge--' + statusClass + '">' +
                        escapeHtml(j.Status || '') +
                    '</span>' +
                '</div>' +
                '<div class="sc-cell sc-cell--shipped">' + shippedCellHtml(j) + '</div>' +
                '<div class="sc-cell sc-cell--chevron"><i class="fas fa-chevron-right"></i></div>' +
            '</a>';
        }).join('');

        wrap.innerHTML =
            '<div class="sc-table">' +
                '<div class="sc-row sc-row--header">' +
                    '<div class="sc-cell sc-cell--job">Job #</div>' +
                    '<div class="sc-cell sc-cell--po">PO</div>' +
                    '<div class="sc-cell sc-cell--desc">Description</div>' +
                    '<div class="sc-cell sc-cell--status">Status</div>' +
                    '<div class="sc-cell sc-cell--shipped">Shipped</div>' +
                    '<div class="sc-cell sc-cell--chevron"></div>' +
                '</div>' +
                rows +
            '</div>';

        // Delegated click handler for tracking pills — open carrier page in a new
        // tab and stop the click from bubbling to the row's <a href="...detail">.
        wrap.querySelectorAll('.sc-track-pill--link').forEach(function (pill) {
            pill.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var url = this.getAttribute('data-track-url');
                if (url) window.open(url, '_blank', 'noopener');
            });
        });

        // Result count + pagination
        var showStart = start + 1;
        var showEnd = Math.min(start + PAGE_SIZE, totalCount);
        $('sc-result-count').textContent = showStart + '–' + showEnd + ' of ' + totalCount + ' jobs';

        if (totalPages > 1) {
            $('sc-pagination').style.display = '';
            $('sc-page-info').textContent = 'Page ' + state.currentPage + ' of ' + totalPages;
            $('sc-page-prev').disabled = state.currentPage <= 1;
            $('sc-page-next').disabled = state.currentPage >= totalPages;
        } else {
            $('sc-pagination').style.display = 'none';
        }
    }

    // ── Backfill modal ─────────────────────────────────────────────────
    function openBackfillModal() {
        $('sc-backfill-modal').style.display = 'flex';
        resetBackfillModal();
        // Focus the paste zone so Ctrl+V works immediately
        setTimeout(function () { $('sc-paste-zone').focus(); }, 50);
    }

    function closeBackfillModal() {
        $('sc-backfill-modal').style.display = 'none';
        state.pendingBackfill = null;
        state.pendingSingleJob = null;
    }

    function resetBackfillModal() {
        $('sc-paste-empty').style.display = '';
        $('sc-paste-preview').style.display = 'none';
        $('sc-paste-preview').src = '';
        $('sc-extract-status').style.display = 'none';
        $('sc-extract-status').innerHTML = '';
        $('sc-extract-results').style.display = 'none';
        $('sc-extract-results').innerHTML = '';
        $('sc-backfill-import').disabled = true;
        state.pendingBackfill = null;
        state.pendingSingleJob = null;
    }

    function showExtractStatus(html, kind) {
        var el = $('sc-extract-status');
        el.style.display = '';
        el.className = 'sc-extract-status sc-extract-status--' + (kind || 'info');
        el.innerHTML = html;
    }

    async function handlePastedImage(file) {
        if (!file || !file.type || file.type.indexOf('image/') !== 0) {
            showExtractStatus('Pasted item is not an image. Try again with a screenshot.', 'error');
            return;
        }

        // Read file as data URI
        var dataUri = await new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        // Show preview
        $('sc-paste-empty').style.display = 'none';
        $('sc-paste-preview').src = dataUri;
        $('sc-paste-preview').style.display = '';
        $('sc-backfill-import').disabled = true;

        // Run BOTH extractors in parallel — same image. If the user pasted a
        // single-job detail screenshot, the detail extractor returns full data
        // (joblines, history, shipping, etc). If they pasted a multi-row list,
        // the detail extractor returns error/empty and we fall through to the
        // existing list-backfill flow.
        showExtractStatus('<i class="fas fa-spinner fa-spin"></i> Reading screenshot with Claude Vision…', 'info');
        try {
            var both = await Promise.all([
                extractJobsList(dataUri),
                extractJobDetail(dataUri).catch(function () { return null; })
            ]);
            var listResult = both[0];
            var detailResult = both[1];

            var jobs = (listResult.data && listResult.data.jobs) || [];
            var detail = (detailResult && detailResult.data) || null;
            var isSingle = jobs.length === 1 && detail && detail.supacolorJobNumber;

            if (jobs.length === 0 && !isSingle) {
                showExtractStatus('No job rows detected in this screenshot. Make sure you pasted the Supacolor jobs list or a single job detail page.', 'error');
                return;
            }

            if (isSingle) {
                // Single-job rich path
                state.pendingBackfill = null;
                state.pendingSingleJob = { stub: jobs[0], detail: detail };

                var jlCount = (detail.joblines || []).length;
                var histCount = (detail.history || []).length;
                var fieldCount = 0;
                ['poNumber','description','status','location','createdByName','dateEntered',
                 'requestedShipDate','dateShipped','subtotal','total','paymentStatus',
                 'paymentMethod','carrier','shippingMethod','trackingNumber','shipToName',
                 'shipToAddress','shipToContact','shipToPhone','shipToEmail'].forEach(function (k) {
                    if (detail[k] != null && detail[k] !== '') fieldCount++;
                });

                showExtractStatus(
                    '<i class="fas fa-check-circle"></i> Single job detected: <strong>#' +
                    escapeHtml(detail.supacolorJobNumber) + '</strong> — ' +
                    fieldCount + ' fields, ' + jlCount + ' joblines, ' + histCount + ' history events. ' +
                    'Review below and click Import.',
                    'success'
                );

                $('sc-extract-results').style.display = '';
                $('sc-extract-results').innerHTML =
                    '<div class="sc-preview-table">' +
                        '<div class="sc-preview-row sc-preview-row--header">' +
                            '<div>Job #</div><div>PO</div><div>Description</div><div>Status</div><div>Shipped</div>' +
                        '</div>' +
                        '<div class="sc-preview-row">' +
                            '<div>#' + escapeHtml(detail.supacolorJobNumber) + '</div>' +
                            '<div>' + escapeHtml(detail.poNumber || '') + '</div>' +
                            '<div>' + escapeHtml(detail.description || '') + '</div>' +
                            '<div>' + escapeHtml(detail.status || '') + '</div>' +
                            '<div>' + escapeHtml(formatDate(detail.dateShipped)) + '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div style="margin-top:12px;font-size:13px;color:#475569;">' +
                        '<strong>Will also import:</strong> ' +
                        jlCount + ' joblines, ' + histCount + ' history events, plus shipping/payment details.' +
                    '</div>';

                $('sc-backfill-import').disabled = false;
                return;
            }

            // Multi-job list path — existing behavior
            var mapped = jobs.map(function (j) {
                var row = {
                    Supacolor_Job_Number: j.supacolorJobNumber || j.jobNumber,
                    PO_Number: j.poNumber || null,
                    Description: j.description || null,
                    Status: j.status || null,
                    Backfill_Source: 'screenshot'
                };
                if (j.dateShipped) row.Date_Shipped = j.dateShipped;
                return row;
            }).filter(function (r) { return r.Supacolor_Job_Number; });

            state.pendingBackfill = mapped;
            state.pendingSingleJob = null;

            showExtractStatus(
                '<i class="fas fa-check-circle"></i> Extracted <strong>' + mapped.length +
                '</strong> job rows in ' + (listResult.duration || 0) + 'ms. Review below and click Import.',
                'success'
            );

            $('sc-extract-results').style.display = '';
            $('sc-extract-results').innerHTML =
                '<div class="sc-preview-table">' +
                    '<div class="sc-preview-row sc-preview-row--header">' +
                        '<div>Job #</div><div>PO</div><div>Description</div><div>Status</div><div>Shipped</div>' +
                    '</div>' +
                    mapped.map(function (r) {
                        return '<div class="sc-preview-row">' +
                            '<div>#' + escapeHtml(r.Supacolor_Job_Number) + '</div>' +
                            '<div>' + escapeHtml(r.PO_Number || '') + '</div>' +
                            '<div>' + escapeHtml(r.Description || '') + '</div>' +
                            '<div>' + escapeHtml(r.Status || '') + '</div>' +
                            '<div>' + escapeHtml(formatDate(r.Date_Shipped)) + '</div>' +
                        '</div>';
                    }).join('') +
                '</div>';

            $('sc-backfill-import').disabled = false;

        } catch (err) {
            console.error('Extraction failed:', err);
            showExtractStatus(
                '<i class="fas fa-exclamation-triangle"></i> ' + escapeHtml(err.message || 'Extraction failed'),
                'error'
            );
        }
    }

    async function importPendingBackfill() {
        var hasSingle = !!state.pendingSingleJob;
        var hasList = state.pendingBackfill && state.pendingBackfill.length > 0;
        if (!hasSingle && !hasList) return;

        var btn = $('sc-backfill-import');
        btn.disabled = true;
        var origHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importing…';

        try {
            if (hasSingle) {
                // Single-job rich import — same sequence as supacolor-job-detail.js applyPendingExtraction
                var d = state.pendingSingleJob.detail;
                var jobPayload = {
                    Supacolor_Job_Number: d.supacolorJobNumber,
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
                Object.keys(jobPayload).forEach(function (k) {
                    if (jobPayload[k] === undefined) delete jobPayload[k];
                });

                var upsertResult = await upsertJob(jobPayload, false);
                var idJob = upsertResult && upsertResult.job && upsertResult.job.ID_Job;

                var joblinesWritten = 0;
                if (idJob && d.joblines && d.joblines.length) {
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
                    var jlResult = await replaceJoblines(idJob, lines);
                    joblinesWritten = (jlResult && jlResult.inserted) || lines.length;
                }

                var historyWritten = 0;
                if (idJob && d.history && d.history.length) {
                    var events = d.history.map(function (h) {
                        return {
                            Event_Type: h.eventType || 'Event',
                            Event_Detail: h.eventDetail || null,
                            Event_At: h.eventAt || null
                        };
                    });
                    var hResult = await replaceHistory(idJob, events);
                    historyWritten = (hResult && hResult.inserted) || events.length;
                }

                showToast(
                    'Imported #' + d.supacolorJobNumber + ' — ' +
                    joblinesWritten + ' joblines, ' + historyWritten + ' history events',
                    'success'
                );
            } else {
                // Multi-job list path — existing behavior
                var result = await bulkUpsertJobs(state.pendingBackfill);
                var s = result.summary || {};
                var msg = (s.inserted || 0) + ' new, ' + (s.patched || 0) + ' updated, ' + (s.noop || 0) + ' unchanged';
                if (s.errored) msg += ', ' + s.errored + ' failed';
                showToast('Import complete: ' + msg, s.errored ? 'error' : 'success');
            }

            closeBackfillModal();
            // Refresh the dashboard
            await Promise.all([fetchJobs(), fetchStats()]);
            applyFilters();
        } catch (err) {
            console.error('Import failed:', err);
            showToast('Import failed: ' + (err.message || 'unknown error'), 'error');
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }

    // ── Toast ──────────────────────────────────────────────────────────
    function showToast(message, kind) {
        var c = $('sc-toast-container');
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

    // ── Init ───────────────────────────────────────────────────────────
    async function init() {
        // Filter wiring
        $('sc-filter-status').addEventListener('change', function (e) {
            state.filters.status = e.target.value;
            applyFilters();
        });
        $('sc-filter-search').addEventListener('input', debounce(function (e) {
            state.filters.search = e.target.value;
            applyFilters();
        }, 200));
        $('sc-filter-clear').addEventListener('click', function () {
            state.filters.status = '';
            state.filters.search = '';
            $('sc-filter-status').value = '';
            $('sc-filter-search').value = '';
            applyFilters();
        });

        // Clickable stat cards = view filter
        var statsRow = $('sc-stats-row');
        function selectViewChip(view) {
            state.filters.view = view;
            statsRow.querySelectorAll('.bt-stat-chip--clickable').forEach(function (c) {
                c.classList.toggle('selected', c.dataset.view === view);
            });
            applyFilters();
        }
        statsRow.addEventListener('click', function (e) {
            var chip = e.target.closest('.bt-stat-chip--clickable');
            if (!chip || !chip.dataset.view) return;
            selectViewChip(chip.dataset.view);
        });
        statsRow.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var chip = e.target.closest('.bt-stat-chip--clickable');
            if (!chip || !chip.dataset.view) return;
            e.preventDefault();
            selectViewChip(chip.dataset.view);
        });

        // Refresh
        $('sc-refresh-btn').addEventListener('click', async function () {
            $('sc-refresh-btn').disabled = true;
            try {
                await Promise.all([fetchJobs(), fetchStats()]);
                applyFilters();
                showToast('Refreshed', 'success');
            } finally {
                $('sc-refresh-btn').disabled = false;
            }
        });

        // Pagination
        $('sc-page-prev').addEventListener('click', function () {
            if (state.currentPage > 1) { state.currentPage--; render(); }
        });
        $('sc-page-next').addEventListener('click', function () {
            state.currentPage++; render();
        });

        // Backfill modal
        $('sc-backfill-btn').addEventListener('click', openBackfillModal);
        $('sc-backfill-modal-close').addEventListener('click', closeBackfillModal);
        $('sc-backfill-cancel').addEventListener('click', closeBackfillModal);
        $('sc-backfill-import').addEventListener('click', importPendingBackfill);

        // Click backdrop to close
        $('sc-backfill-modal').addEventListener('click', function (e) {
            if (e.target === $('sc-backfill-modal')) closeBackfillModal();
        });

        // Paste zone — Ctrl+V handler. Listener on document (not the zone)
        // so it fires regardless of where focus is when Ctrl+V hits — avoids
        // the setTimeout-focus race where the first Ctrl+V lands on the
        // trigger button (outside the modal) and silently no-ops.
        var pasteZone = $('sc-paste-zone');
        var backfillModal = $('sc-backfill-modal');
        document.addEventListener('paste', function (e) {
            if (backfillModal.style.display === 'none') return;
            var items = (e.clipboardData || window.clipboardData || {}).items;
            if (!items) return;
            for (var i = 0; i < items.length; i++) {
                if (items[i].type && items[i].type.indexOf('image/') === 0) {
                    e.preventDefault();
                    handlePastedImage(items[i].getAsFile());
                    return;
                }
            }
            // No image in clipboard — let default paste happen
        });

        // Drag & drop
        pasteZone.addEventListener('dragover', function (e) {
            e.preventDefault();
            pasteZone.classList.add('sc-paste-zone--dragover');
        });
        pasteZone.addEventListener('dragleave', function () {
            pasteZone.classList.remove('sc-paste-zone--dragover');
        });
        pasteZone.addEventListener('drop', function (e) {
            e.preventDefault();
            pasteZone.classList.remove('sc-paste-zone--dragover');
            var f = e.dataTransfer.files[0];
            if (f) handlePastedImage(f);
        });

        // Click-to-upload fallback
        pasteZone.addEventListener('click', function (e) {
            if (e.target.id === 'sc-paste-empty' || e.target.closest('#sc-paste-empty')) {
                $('sc-paste-file').click();
            }
        });
        $('sc-paste-file').addEventListener('change', function (e) {
            if (e.target.files[0]) handlePastedImage(e.target.files[0]);
        });

        // Initial load
        try {
            await Promise.all([fetchJobs(), fetchStats()]);
            applyFilters();
        } catch (err) {
            $('sc-table-wrap').innerHTML = '<div class="bt-empty bt-empty--error">' +
                '<i class="fas fa-exclamation-triangle"></i><p>Failed to load. ' +
                escapeHtml(err.message || '') + '</p></div>';
        }

        // Poll every 60s
        state.pollTimer = setInterval(async function () {
            try {
                await Promise.all([fetchJobs(), fetchStats()]);
                applyFilters();
            } catch (e) { /* swallow — already toasted */ }
        }, POLL_INTERVAL_MS);
    }

    function debounce(fn, ms) {
        var t;
        return function () {
            var ctx = this, args = arguments;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(ctx, args); }, ms);
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
