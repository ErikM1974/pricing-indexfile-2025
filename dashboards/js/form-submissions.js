/**
 * form-submissions.js — controller for dashboards/form-submissions.html ("Forms Inbox")
 *
 * Staff view of saved fillable-form submissions (Caspio Form_Submissions +
 * Sample_Checkout_Items via the proxy). Reads/updates go through the SAME-ORIGIN
 * session-gated forwarder /api/crm-proxy/form-submissions* (NOT APP_CONFIG —
 * the raw proxy endpoints are secret-only because submissions hold customer PII).
 *
 * Views: All Submissions (filterable table + detail modal with status moves and
 * "Create Art Request" for artwork rows) · Samples Tracker (item-level open
 * checkouts, overdue first, one-click Mark Returned / Charged with rollup).
 *
 * Errors always surface via DashPage.showError — never silent (CLAUDE.md #4).
 */
(function () {
    'use strict';

    var FORM_META = {
        'garment-drop-off': { label: 'Drop-Off', icon: 'fa-box-open', cls: 'badge--drp' },
        'artwork-request': { label: 'Artwork', icon: 'fa-palette', cls: 'badge--art' },
        'name-personalization': { label: 'Name List', icon: 'fa-signature', cls: 'badge--nam' },
        'sample-checkout': { label: 'Samples', icon: 'fa-shirt', cls: 'badge--smp' },
        'ae-order-intake': { label: 'Order Intake', icon: 'fa-cart-flatbed', cls: 'badge--aeo' },
        'final-qc-checklist': { label: 'Final QC', icon: 'fa-clipboard-check', cls: 'badge--qcc' },
        'spoilage-report': { label: 'Spoilage', icon: 'fa-triangle-exclamation', cls: 'badge--spl' },
        'maintenance-log': { label: 'Maintenance', icon: 'fa-screwdriver-wrench', cls: 'badge--mnt' },
        'customer-onboarding': { label: 'New Account', icon: 'fa-user-plus', cls: 'badge--onb' },
        'team-roster': { label: 'Roster', icon: 'fa-people-group', cls: 'badge--rst' },
        'webstore-request': { label: 'Webstore', icon: 'fa-store', cls: 'badge--wsr' },
        'credit-application': { label: 'Credit App', icon: 'fa-file-signature', cls: 'badge--crd' },
        'tax-exempt-cert': { label: 'Tax Cert', icon: 'fa-receipt', cls: 'badge--tax' },
        'pto-request': { label: 'PTO', icon: 'fa-umbrella-beach', cls: 'badge--pto' },
        'injury-report': { label: 'Incident', icon: 'fa-kit-medical', cls: 'badge--inj' },
        'credit-card-auth': { label: 'Card Auth', icon: 'fa-credit-card', cls: 'badge--cca' },
        'quote-request': { label: 'Quote Lead', icon: 'fa-bullhorn', cls: 'badge--qrq' },
    };

    var STATUS_CLS = {
        'New': 'status--new',
        'In Progress': 'status--progress',
        'Sent to Art': 'status--art',
        'Completed': 'status--done',
        'Checked Out': 'status--out',
        'Partially Returned': 'status--partial',
        'Returned': 'status--done',
        'Charged': 'status--overdue',
        'Archived': 'status--muted',
        'Logged': 'status--muted',
        'Follow-Up Required': 'status--partial',
        'Under Review': 'status--progress',
        'Replacement Ordered': 'status--progress',
        'Released': 'status--done',
        'On Hold': 'status--overdue',
        'Rework': 'status--partial',
        'Resolved': 'status--done',
        'Entered in ShopWorks': 'status--done',
        'Account Created': 'status--done',
        'Store Built': 'status--progress',
        'Launched': 'status--done',
        'Approved': 'status--done',
        'Denied': 'status--overdue',
        'Pending': 'status--partial',
        'Verified': 'status--done',
        'Expired': 'status--overdue',
        'Open': 'status--new',
        'L&I Filed': 'status--art',
        'Closed': 'status--done',
        'Card on File': 'status--done',
        'Contacted': 'status--progress',
        'Quoted': 'status--art',
        'Won': 'status--done',
        'Lost': 'status--muted',
    };

    var STATUS_CHOICES = {
        'garment-drop-off': ['New', 'In Progress', 'Completed', 'Archived'],
        'artwork-request': ['New', 'Sent to Art', 'In Progress', 'Completed', 'Archived'],
        'name-personalization': ['New', 'In Progress', 'Completed', 'Archived'],
        'sample-checkout': ['Checked Out', 'Partially Returned', 'Returned', 'Charged', 'Archived'],
        'ae-order-intake': ['New', 'In Progress', 'Entered in ShopWorks', 'Completed', 'Archived'],
        'final-qc-checklist': ['New', 'Released', 'On Hold', 'Rework', 'Resolved', 'Archived'],
        'spoilage-report': ['New', 'Under Review', 'Replacement Ordered', 'Resolved', 'Archived'],
        'maintenance-log': ['Logged', 'Follow-Up Required', 'Resolved', 'Archived'],
        'customer-onboarding': ['New', 'In Progress', 'Account Created', 'Archived'],
        'team-roster': ['New', 'In Progress', 'Entered in ShopWorks', 'Completed', 'Archived'],
        'webstore-request': ['New', 'In Progress', 'Store Built', 'Launched', 'Archived'],
        'credit-application': ['Under Review', 'Approved', 'Denied', 'Archived'],
        'tax-exempt-cert': ['New', 'Verified', 'Expired', 'Archived'],
        'pto-request': ['Pending', 'Approved', 'Denied', 'Archived'],
        'injury-report': ['Open', 'Under Review', 'L&I Filed', 'Closed', 'Archived'],
        'credit-card-auth': ['New', 'Card on File', 'Expired', 'Archived'],
        'quote-request': ['New', 'Contacted', 'Quoted', 'Won', 'Lost', 'Archived'],
    };

    var state = {
        submissions: [],
        openItems: [],
        formFilter: '',
        statusFilter: '',
        search: '',
        staffEmail: '',
        detail: null, // { submission, items }
    };

    document.addEventListener('DOMContentLoaded', function () {
        wireChrome();
        fetch('/api/crm-session/me')
            .then(function (r) { return r.json(); })
            .then(function (me) { state.staffEmail = me.email || ''; })
            .catch(function () { /* stamping falls back to blank */ });
        loadAll();
    });

    // ---------- data ----------

    function inboxFetch(path, options) {
        return fetch('/api/crm-proxy/form-submissions' + path, options).then(function (resp) {
            return resp.json().catch(function () { return {}; }).then(function (body) {
                if (!resp.ok) throw new Error(body.error || ('HTTP ' + resp.status));
                return body;
            });
        });
    }

    // jotform-lead rows live on the Leads board (dashboards/leads.html) — keep
    // the ~1,800 imported website leads out of the ops Inbox.
    function withoutJotformLeads(submissions) {
        return (submissions || []).filter(function (s) { return s.Form_ID !== 'jotform-lead'; });
    }

    function loadAll() {
        Promise.all([
            inboxFetch(''),
            inboxFetch('/items/open'),
        ]).then(function (results) {
            state.submissions = withoutJotformLeads(results[0].submissions);
            state.openItems = results[1].items || [];
            renderStats();
            renderSubmissions();
            renderSamples();
        }).catch(function (err) {
            console.error('[forms-inbox] load failed:', err);
            DashPage.showError('Unable to load submissions (' + err.message + '). Refresh to retry.');
            var root = document.getElementById('submissionsRoot');
            root.classList.remove('dash-loading');
            root.innerHTML = '<div class="inbox-empty"><i class="fas fa-triangle-exclamation"></i> Submissions unavailable.</div>';
            var sroot = document.getElementById('samplesRoot');
            sroot.classList.remove('dash-loading');
            sroot.innerHTML = '<div class="inbox-empty"><i class="fas fa-triangle-exclamation"></i> Samples unavailable.</div>';
        });
    }

    // ---------- chrome ----------

    function wireChrome() {
        document.querySelectorAll('.inbox-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                document.querySelectorAll('.inbox-tab').forEach(function (t) { t.classList.remove('is-active'); });
                tab.classList.add('is-active');
                var view = tab.dataset.view;
                document.getElementById('viewSubmissions').hidden = view !== 'submissions';
                document.getElementById('viewSamples').hidden = view !== 'samples';
            });
        });

        document.querySelectorAll('#formChips .inbox-chip').forEach(function (chip) {
            chip.addEventListener('click', function () {
                document.querySelectorAll('#formChips .inbox-chip').forEach(function (c) { c.classList.remove('is-active'); });
                chip.classList.add('is-active');
                state.formFilter = chip.dataset.form;
                renderSubmissions();
            });
        });

        document.getElementById('statusFilter').addEventListener('change', function (e) {
            state.statusFilter = e.target.value;
            renderSubmissions();
        });

        var searchTimer = null;
        document.getElementById('searchBox').addEventListener('input', function (e) {
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                state.search = e.target.value.trim().toLowerCase();
                renderSubmissions();
            }, 200);
        });

        document.getElementById('closeDetailBtn').addEventListener('click', closeDetail);
        document.getElementById('detailOverlay').addEventListener('click', function (e) {
            if (e.target === e.currentTarget) closeDetail();
        });
        document.getElementById('printDetailBtn').addEventListener('click', function () { window.print(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeDetail();
        });
    }

    // ---------- dates ----------

    function localDay(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
        return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
    }

    function today0() {
        var d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function daysBetween(a, b) { return Math.round((b - a) / 86400000); }

    function fmtDay(iso) {
        var d = localDay(iso);
        return d ? (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear() : '';
    }

    function fmtStamp(iso) {
        var d = new Date(iso);
        return isNaN(d) ? '' : (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
            ((d.getHours() % 12) || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + (d.getHours() < 12 ? 'a' : 'p');
    }

    // ---------- stats ----------

    function isOverdueSub(sub) {
        if (sub.Form_ID !== 'sample-checkout') return false;
        if (['Returned', 'Charged', 'Archived'].indexOf(sub.Status) !== -1) return false;
        var due = localDay(sub.Due_Date);
        return !!(due && due < today0());
    }

    function renderStats() {
        var weekAgo = Date.now() - 7 * 86400000;
        var newCount = state.submissions.filter(function (s) {
            return s.Status === 'New' && new Date(s.Submitted_At).getTime() >= weekAgo;
        }).length;

        var overdue = state.submissions.filter(isOverdueSub).length;

        var soonCutoff = new Date(today0().getTime() + 7 * 86400000);
        var dueSoon = state.submissions.filter(function (s) {
            if (['Completed', 'Returned', 'Charged', 'Archived'].indexOf(s.Status) !== -1) return false;
            var due = localDay(s.Due_Date);
            return !!(due && due >= today0() && due <= soonCutoff);
        }).length;

        document.getElementById('statNew').textContent = String(newCount);
        document.getElementById('statOut').textContent = String(state.openItems.length);
        document.getElementById('statOverdue').textContent = String(overdue);
        document.getElementById('statDueSoon').textContent = String(dueSoon);
        document.querySelector('.inbox-stat--overdue').classList.toggle('is-hot', overdue > 0);
    }

    // ---------- submissions table ----------

    function visibleSubmissions() {
        return state.submissions.filter(function (s) {
            if (state.formFilter && s.Form_ID !== state.formFilter) return false;
            if (state.statusFilter && s.Status !== state.statusFilter) return false;
            if (state.search) {
                var hay = (s.Company + ' ' + s.Contact_Name + ' ' + s.Submission_ID + ' ' + s.Summary).toLowerCase();
                if (hay.indexOf(state.search) === -1) return false;
            }
            return true;
        });
    }

    function renderSubmissions() {
        var root = document.getElementById('submissionsRoot');
        root.classList.remove('dash-loading');
        var subs = visibleSubmissions();

        if (!subs.length) {
            root.innerHTML = '<div class="inbox-empty">No submissions match. Saved forms land here the moment someone hits “Save to NWCA”.</div>';
            return;
        }

        var rows = subs.map(function (s) {
            var meta = FORM_META[s.Form_ID] || { label: s.Form_ID, icon: 'fa-file', cls: '' };
            var overdue = isOverdueSub(s);
            return '<tr data-id="' + esc(s.Submission_ID) + '" class="' + (overdue ? 'row--overdue' : '') + '">' +
                '<td class="col-date">' + esc(fmtStamp(s.Submitted_At)) + '</td>' +
                '<td><span class="inbox-badge ' + meta.cls + '"><i class="fas ' + meta.icon + '"></i> ' + esc(meta.label) + '</span></td>' +
                '<td class="col-company"><strong>' + esc(s.Company) + '</strong>' +
                    (s.Contact_Name ? '<span class="inbox-muted">' + esc(s.Contact_Name) + '</span>' : '') + '</td>' +
                '<td class="col-summary">' + esc(s.Summary) + '</td>' +
                '<td class="col-due">' + (s.Due_Date ? esc(fmtDay(s.Due_Date)) : '—') +
                    (overdue ? ' <span class="inbox-late">OVERDUE</span>' : '') + '</td>' +
                '<td><span class="inbox-status ' + (STATUS_CLS[s.Status] || '') + '">' + esc(s.Status) + '</span></td>' +
                '<td class="col-view no-print"><button type="button" class="dash-btn dash-btn--sm" data-view-id="' + esc(s.Submission_ID) + '">View</button></td>' +
            '</tr>';
        }).join('');

        root.innerHTML =
            '<div class="inbox-tablewrap"><table class="inbox-table">' +
            '<thead><tr><th>Saved</th><th>Form</th><th>Company</th><th>Summary</th><th>Due</th><th>Status</th><th class="no-print"></th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table></div>';

        root.querySelectorAll('[data-view-id]').forEach(function (btn) {
            btn.addEventListener('click', function () { openDetail(btn.dataset.viewId); });
        });
    }

    // ---------- detail modal ----------

    function openDetail(submissionId) {
        var body = document.getElementById('detailBody');
        body.innerHTML = '<div class="dash-loading">Loading…</div>';
        document.getElementById('detailOverlay').hidden = false;
        document.body.classList.add('inbox-modal-open');

        inboxFetch('/' + encodeURIComponent(submissionId))
            .then(function (data) {
                state.detail = data;
                renderDetail(data.submission, data.items || []);
            })
            .catch(function (err) {
                body.innerHTML = '<div class="inbox-empty"><i class="fas fa-triangle-exclamation"></i> ' + esc(err.message) + '</div>';
            });
    }

    function closeDetail() {
        document.getElementById('detailOverlay').hidden = true;
        document.body.classList.remove('inbox-modal-open');
        state.detail = null;
    }

    function renderDetail(sub, items) {
        var meta = FORM_META[sub.Form_ID] || { label: sub.Form_ID, icon: 'fa-file', cls: '' };
        document.getElementById('detailTitle').innerHTML =
            '<span class="inbox-badge ' + meta.cls + '"><i class="fas ' + meta.icon + '"></i> ' + esc(meta.label) + '</span> ' +
            '<button type="button" class="copy-id" title="Copy id" data-copy="' + esc(sub.Submission_ID) + '">' + esc(sub.Submission_ID) + ' <i class="far fa-copy"></i></button>' +
            ' <span class="inbox-muted">saved ' + esc(fmtStamp(sub.Submitted_At)) + '</span>';
        var copyBtn = document.querySelector('#detailTitle .copy-id');
        copyBtn.addEventListener('click', function () {
            navigator.clipboard.writeText(copyBtn.dataset.copy).then(function () {
                copyBtn.querySelector('i').className = 'fas fa-check';
                setTimeout(function () { copyBtn.querySelector('i').className = 'far fa-copy'; }, 1200);
            }).catch(function () { /* clipboard blocked — no-op */ });
        });

        var payload = {};
        try { payload = JSON.parse(sub.Payload_JSON || '{}'); } catch (e) { /* renders empty */ }

        var html = '';

        // status row + actions
        var choices = STATUS_CHOICES[sub.Form_ID] || ['New', 'Completed'];
        html += '<div class="detail-actionbar no-print">' +
            '<label>Status <select id="detailStatus">' + choices.map(function (c) {
                return '<option' + (c === sub.Status ? ' selected' : '') + '>' + esc(c) + '</option>';
            }).join('') + '</select></label>' +
            '<button type="button" class="dash-btn dash-btn--primary" id="saveStatusBtn"><i class="fas fa-check"></i> Save Status</button>';
        if (sub.Form_ID === 'artwork-request') {
            html += sub.Art_Request_ID
                ? '<span class="inbox-status status--art"><i class="fas fa-palette"></i> Art Request #' + esc(sub.Art_Request_ID) + '</span>'
                : '<button type="button" class="dash-btn" id="artPushBtn"><i class="fas fa-palette"></i> Create Art Request</button>';
        }
        if (sub.Form_ID === 'ae-order-intake') {
            html += sub.Pushed_To_ShopWorks === 'Yes'
                ? '<span class="inbox-status status--done"><i class="fas fa-industry"></i> ShopWorks: ' + esc(sub.ShopWorks_Order_ID || 'pushed') + '</span>'
                : '<button type="button" class="dash-btn" id="swPushBtn"><i class="fas fa-industry"></i> Push to ShopWorks…</button>';
        }
        html += '<span class="inbox-muted" id="detailActionMsg"></span></div>';

        // header fields
        if (payload.fields && payload.fields.length) {
            html += '<div class="detail-fields">' + payload.fields.map(function (pair) {
                if (!pair[1]) return '';
                return '<div class="detail-field"><span>' + esc(pair[0]) + '</span><strong>' + esc(pair[1]) + '</strong></div>';
            }).join('') + '</div>';
        }

        // checks
        if (payload.checks && payload.checks.length) {
            html += '<div class="detail-checks">' + payload.checks.map(function (c) {
                return '<span class="inbox-badge badge--check"><i class="fas fa-check"></i> ' + esc(c) + '</span>';
            }).join('') + '</div>';
        }

        // tables
        (payload.tables || []).forEach(function (t) {
            if (!t.rows || !t.rows.length) return;
            html += '<h3 class="detail-subhead">' + esc(t.title || 'Details') + '</h3>' +
                '<div class="inbox-tablewrap"><table class="inbox-table inbox-table--payload"><thead><tr>' +
                (t.columns || []).map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') +
                '</tr></thead><tbody>' +
                t.rows.map(function (r) {
                    return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
                }).join('') + '</tbody></table></div>';
        });

        // sample items with check-in buttons
        if (sub.Form_ID === 'sample-checkout' && items.length) {
            html += '<h3 class="detail-subhead">Sample Items</h3><div class="inbox-tablewrap"><table class="inbox-table"><thead><tr>' +
                '<th>#</th><th>Brand</th><th>Style</th><th>Description</th><th>Color</th><th>Size</th><th>Qty</th><th>Charge (75%)</th><th>Status</th><th>Returned</th><th class="no-print"></th>' +
                '</tr></thead><tbody>' +
                items.map(function (it) {
                    return '<tr><td>' + esc(it.Line_Number) + '</td><td>' + esc(it.Brand) + '</td><td>' + esc(it.Style) + '</td>' +
                        '<td>' + esc(it.Description) + '</td><td>' + esc(it.Color) + '</td><td>' + esc(it.Size) + '</td><td>' + esc(it.Qty) + '</td>' +
                        '<td>' + esc(it.Charge_Value) + '</td>' +
                        '<td><span class="inbox-status ' + (it.Item_Status === 'Out' ? 'status--out' : (it.Item_Status === 'Charged' ? 'status--overdue' : 'status--done')) + '">' + esc(it.Item_Status) + '</span></td>' +
                        '<td>' + esc(it.Date_Returned ? fmtDay(it.Date_Returned) + (it.Condition ? ' · ' + it.Condition : '') : '') + '</td>' +
                        '<td class="no-print">' + (it.Item_Status === 'Out'
                            ? '<button type="button" class="dash-btn dash-btn--sm" data-return-pk="' + esc(String(it.PK_ID)) + '">Mark Returned</button> ' +
                              '<button type="button" class="dash-btn dash-btn--sm dash-btn--danger" data-charge-pk="' + esc(String(it.PK_ID)) + '">Charged</button>'
                            : '') + '</td></tr>';
                }).join('') + '</tbody></table></div>';
        }

        // notes
        (payload.notes || []).forEach(function (pair) {
            if (!pair[1]) return;
            html += '<h3 class="detail-subhead">' + esc(pair[0]) + '</h3><p class="detail-note">' + esc(pair[1]) + '</p>';
        });

        var body = document.getElementById('detailBody');
        body.innerHTML = html;

        document.getElementById('saveStatusBtn').addEventListener('click', function () {
            updateSubmission(sub.Submission_ID, { Status: document.getElementById('detailStatus').value });
        });
        var artBtn = document.getElementById('artPushBtn');
        if (artBtn) artBtn.addEventListener('click', function () { pushToArtHub(sub, payload, artBtn); });
        var swBtn = document.getElementById('swPushBtn');
        if (swBtn) swBtn.addEventListener('click', function () { showShopWorksPreview(sub, payload); });
        body.querySelectorAll('[data-return-pk]').forEach(function (btn) {
            btn.addEventListener('click', function () { checkInItem(btn.dataset.returnPk, 'Returned'); });
        });
        body.querySelectorAll('[data-charge-pk]').forEach(function (btn) {
            btn.addEventListener('click', function () { checkInItem(btn.dataset.chargePk, 'Charged'); });
        });
    }

    function detailMsg(text, isError) {
        var el = document.getElementById('detailActionMsg');
        if (el) { el.textContent = text; el.classList.toggle('inbox-late', !!isError); }
    }

    function updateSubmission(submissionId, fields) {
        fields.Updated_By = state.staffEmail;
        detailMsg('Saving…');
        inboxFetch('/' + encodeURIComponent(submissionId), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields),
        }).then(function () {
            detailMsg('Saved.');
            return refreshKeepingDetail(submissionId);
        }).catch(function (err) {
            console.error('[forms-inbox] update failed:', err);
            detailMsg('NOT saved: ' + err.message, true);
        });
    }

    function checkInItem(pkId, newStatus) {
        var condition = window.prompt(
            newStatus === 'Returned' ? 'Condition / notes for this item:' : 'Why is this item being charged?',
            newStatus === 'Returned' ? 'Good' : 'Not returned by grace deadline'
        );
        if (condition === null) return;
        detailMsg('Updating item…');
        inboxFetch('/items/' + encodeURIComponent(pkId), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Item_Status: newStatus,
                Date_Returned: newStatus === 'Returned' ? new Date().toISOString().slice(0, 10) : '',
                Condition: condition,
                Checked_In_By: state.staffEmail,
            }),
        }).then(function (resp) {
            detailMsg('Item updated — checkout is now “' + resp.parentStatus + '”.');
            return refreshKeepingDetail(resp.submissionId);
        }).catch(function (err) {
            console.error('[forms-inbox] item update failed:', err);
            detailMsg('Item NOT updated: ' + err.message, true);
        });
    }

    function refreshKeepingDetail(submissionId) {
        return Promise.all([inboxFetch(''), inboxFetch('/items/open')]).then(function (results) {
            state.submissions = withoutJotformLeads(results[0].submissions);
            state.openItems = results[1].items || [];
            renderStats();
            renderSubmissions();
            renderSamples();
            if (!document.getElementById('detailOverlay').hidden && submissionId) {
                return inboxFetch('/' + encodeURIComponent(submissionId)).then(function (data) {
                    state.detail = data;
                    renderDetail(data.submission, data.items || []);
                });
            }
        });
    }

    // ---------- art hub push ----------

    function pushToArtHub(sub, payload, btn) {
        if (!window.confirm('Create an Art Hub request from ' + sub.Submission_ID + ' for ' + sub.Company + '?')) return;
        btn.disabled = true;
        detailMsg('Creating art request…');

        var get = function (label) {
            var hit = (payload.fields || []).filter(function (p) { return p[0] === label; })[0];
            return hit ? hit[1] : '';
        };
        var noteLines = [
            'FROM FORMS INBOX — ' + sub.Submission_ID,
            'Project: ' + (get('Project Name / Event') || '(not given)'),
            'Item / Garment: ' + get('Item or Garment Type'),
            'Quantity: ' + get('Quantity'),
            'Location: ' + get('Decoration Location'),
            'Art size: ' + get('Size of Artwork'),
            'Audience / use: ' + get('Intended Audience / Use'),
            'Exact text: ' + get('Exact Text to Include'),
            'Colors: ' + get('Preferred Colors'),
            'Fonts: ' + get('Font / Style Preferences'),
            'Graphics: ' + get('Graphic Elements to Include'),
            'Avoid: ' + get('Must Avoid'),
            'Budget: $' + (get('Art Budget $') || '?'),
            'Types: ' + ((payload.checks || []).join(', ') || '(none marked)'),
        ];
        (payload.notes || []).forEach(function (pair) {
            if (pair[1] && pair[0] !== 'Printed Name' && pair[0] !== 'Signature Date' && pair[0] !== 'NWCA Received By') {
                noteLines.push(pair[0] + ': ' + pair[1]);
            }
        });

        var nameParts = String(sub.Contact_Name || '').split(/\s+/);
        var record = {
            CompanyName: sub.Company,
            Status: 'Submitted',
            Design_Name: get('Project Name / Event') || ('Art Request ' + sub.Submission_ID),
            First_name: nameParts[0] || '',
            Last_name: nameParts.slice(1).join(' '),
            Email_Contact: sub.Email || '',
            Sales_Rep: sub.Sales_Rep || '',
            User_Email: state.staffEmail,
            Mockup: 'Yes',
            NOTES: noteLines.filter(function (l) { return !/: ?$/.test(l); }).join('\n'),
        };
        if (sub.Due_Date) record.Due_Date = sub.Due_Date;

        fetch(DashPage.apiUrl('/api/artrequests'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record),
        }).then(function (resp) {
            return resp.json().catch(function () { return {}; }).then(function (body) {
                if (!resp.ok) throw new Error(body.error || body.message || ('HTTP ' + resp.status));
                return body;
            });
        }).then(function (body) {
            var artId = String(body.PK_ID || body.ID_Design || (body.artRequest && body.artRequest.PK_ID) || 'created');
            return inboxFetch('/' + encodeURIComponent(sub.Submission_ID), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Status: 'Sent to Art', Art_Request_ID: artId, Updated_By: state.staffEmail }),
            }).then(function () {
                detailMsg('Art request created — it\'s in the Art Hub queues (no email sent).');
                return refreshKeepingDetail(sub.Submission_ID);
            });
        }).catch(function (err) {
            console.error('[forms-inbox] art push failed:', err);
            btn.disabled = false;
            detailMsg('Art request NOT created: ' + err.message, true);
        });
    }

    // ---------- shopworks push (AE Order Intake) ----------

    // Mirrors the server transformer's verification rule so the preview shows
    // EXACTLY what will and won't push. The server re-validates — this is UX.
    function classifyOrderRows(payload) {
        var verified = [];
        var skipped = [];

        if (Array.isArray(payload.lines) && payload.lines.length) {
            // v2 machine block (dynamic sizes + upcharges)
            payload.lines.forEach(function (line, idx) {
                var sizes = (line.sizes || []).filter(function (s) { return parseInt(s.qty, 10) > 0; });
                var qty = sizes.reduce(function (a, s) { return a + parseInt(s.qty, 10); }, 0);
                var price = parseFloat(String(line.basePrice || '').replace(/[$,\s]/g, ''));
                var reasons = [];
                if (!String(line.style || '').trim()) reasons.push('no style');
                if (!String(line.catalogColor || '').trim()) reasons.push('color not SanMar-verified');
                if (!sizes.length) reasons.push('no sizes');
                if (isNaN(price)) reasons.push('no base price');
                (reasons.length ? skipped : verified).push({
                    n: idx + 1, style: line.style || '?', color: line.colorName || '', catalogColor: line.catalogColor || '',
                    qty: qty || line.qty || '?', price: line.basePrice || '?', reasons: reasons,
                });
            });
            return { verified: verified, skipped: skipped };
        }

        // legacy v1 table rows (fixed S–3XL columns)
        var table = (payload.tables || []).filter(function (t) { return t.title === 'Order Lines'; })[0] || { rows: [] };
        (table.rows || []).forEach(function (row, idx) {
            var style = String(row[0] || '').trim();
            var catalogColor = String(row[2] || '').trim();
            var sizes = row.slice(4, 10).map(function (v) { return parseInt(v, 10) || 0; });
            var sizedQty = sizes.reduce(function (a, b) { return a + b; }, 0);
            var price = parseFloat(String(row[12] || '').replace(/[$,\s]/g, ''));
            var reasons = [];
            if (!style) reasons.push('no style');
            if (!catalogColor) reasons.push('color not SanMar-verified');
            if (sizedQty <= 0) reasons.push('no S–3XL sizes');
            if (isNaN(price)) reasons.push('no unit price');
            (reasons.length ? skipped : verified).push({
                n: idx + 1, style: style || '?', color: String(row[1] || ''), catalogColor: catalogColor,
                qty: sizedQty || row[11] || '?', price: row[12] || '?', reasons: reasons,
            });
        });
        return { verified: verified, skipped: skipped };
    }

    function showShopWorksPreview(sub, payload) {
        var body = document.getElementById('detailBody');
        var existing = document.getElementById('swPreview');
        if (existing) existing.remove();

        var c = classifyOrderRows(payload);
        var html = '<div class="detail-actionbar sw-preview" id="swPreview"><div style="width:100%">' +
            '<strong><i class="fas fa-industry"></i> Push preview — creates a REAL ShopWorks order</strong><br>' +
            'Customer: <strong>' + esc(sub.Company) + '</strong>' +
            (sub.Customer_Number ? ' (#' + esc(sub.Customer_Number) + ')' : ' — <span class="inbox-late">no customer #: lands on the catch-all, re-assign in SW</span>') +
            '<br>';

        if (c.verified.length) {
            html += '<span class="inbox-status status--done">' + c.verified.length + ' row' + (c.verified.length === 1 ? '' : 's') + ' push as line items</span> ' +
                c.verified.map(function (r) { return esc(r.style + ' ' + r.catalogColor + ' ×' + r.qty + ' @$' + r.price); }).join(' · ') + '<br>';
        }
        if (c.skipped.length) {
            html += '<span class="inbox-status status--overdue">' + c.skipped.length + ' row' + (c.skipped.length === 1 ? '' : 's') + ' ride in order NOTES only</span> ' +
                c.skipped.map(function (r) { return esc('row ' + r.n + ' (' + r.reasons.join(', ') + ')'); }).join(' · ') + '<br>';
        }
        html += '<span class="inbox-muted">Tax is NOT pushed (apply the SW tax dropdown). Money summary, decoration and fulfillment ride in Notes On Order. No design is linked.</span><br>';

        if (c.verified.length) {
            html += '<button type="button" class="dash-btn dash-btn--primary" id="swConfirmBtn"><i class="fas fa-check"></i> Confirm push</button> ';
        } else {
            html += '<span class="inbox-late">Nothing pushable — every row is unverified. Fix rows or enter by hand.</span> ';
        }
        html += '<button type="button" class="dash-btn" id="swCancelBtn">Cancel</button></div></div>';

        body.insertAdjacentHTML('afterbegin', html);
        document.getElementById('swCancelBtn').addEventListener('click', function () {
            document.getElementById('swPreview').remove();
        });
        var confirmBtn = document.getElementById('swConfirmBtn');
        if (confirmBtn) confirmBtn.addEventListener('click', function () {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pushing…';
            inboxFetch('/' + encodeURIComponent(sub.Submission_ID) + '/push-to-shopworks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staffEmail: state.staffEmail }),
            }).then(function (resp) {
                detailMsg('Pushed to ShopWorks as ' + resp.extOrderId + ' (' + resp.lineCount + ' line items). Import shows in MO within ~15–30 min.');
                return refreshKeepingDetail(sub.Submission_ID);
            }).catch(function (err) {
                console.error('[forms-inbox] SW push failed:', err);
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fas fa-check"></i> Confirm push';
                detailMsg('ShopWorks push FAILED: ' + err.message, true);
            });
        });
    }

    // ---------- samples tracker ----------

    function renderSamples() {
        var root = document.getElementById('samplesRoot');
        root.classList.remove('dash-loading');

        if (!state.openItems.length) {
            root.innerHTML = '<div class="inbox-empty"><i class="fas fa-circle-check"></i> Nothing is checked out — all samples are home.</div>';
            return;
        }

        var subsById = {};
        state.submissions.forEach(function (s) { subsById[s.Submission_ID] = s; });

        var groups = {};
        state.openItems.forEach(function (it) {
            (groups[it.Submission_ID] = groups[it.Submission_ID] || []).push(it);
        });

        var groupList = Object.keys(groups).map(function (id) {
            var sub = subsById[id];
            var due = sub ? localDay(sub.Due_Date) : null;
            return {
                id: id,
                sub: sub,
                items: groups[id],
                due: due,
                overdue: !!(due && due < today0()),
                daysOut: due ? daysBetween(due, today0()) : null, // positive = days PAST due
            };
        }).sort(function (a, b) {
            if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
            if (a.due && b.due) return a.due - b.due;
            return a.due ? -1 : 1;
        });

        root.innerHTML = groupList.map(function (g) {
            var sub = g.sub;
            var head =
                '<div class="sample-group-head' + (g.overdue ? ' is-overdue' : '') + '">' +
                    '<div><strong>' + esc(sub ? sub.Company : g.id) + '</strong>' +
                    (sub && sub.Contact_Name ? ' <span class="inbox-muted">' + esc(sub.Contact_Name) + (sub.Phone ? ' · ' + esc(sub.Phone) : '') + '</span>' : '') +
                    ' <span class="inbox-muted">' + esc(g.id) + '</span></div>' +
                    '<div>' +
                    (g.due ? '<span class="inbox-badge">Due ' + esc(fmtDay(sub.Due_Date)) + '</span> ' : '') +
                    (g.overdue ? '<span class="inbox-late">' + g.daysOut + ' day' + (g.daysOut === 1 ? '' : 's') + ' OVERDUE</span>' :
                        (g.due ? '<span class="inbox-badge badge--ok">' + (-g.daysOut) + ' days left</span>' : '')) +
                    ' <button type="button" class="dash-btn dash-btn--sm" data-view-id="' + esc(g.id) + '">Open</button></div>' +
                '</div>';

            var rows = g.items.map(function (it) {
                return '<tr><td>' + esc(it.Brand) + '</td><td>' + esc(it.Style) + '</td><td>' + esc(it.Description) + '</td>' +
                    '<td>' + esc(it.Color) + '</td><td>' + esc(it.Size) + '</td><td>' + esc(it.Qty) + '</td><td>$' + esc(it.Charge_Value || '?') + '</td>' +
                    '<td class="no-print"><button type="button" class="dash-btn dash-btn--sm" data-return-pk="' + esc(String(it.PK_ID)) + '">Mark Returned</button> ' +
                    '<button type="button" class="dash-btn dash-btn--sm dash-btn--danger" data-charge-pk="' + esc(String(it.PK_ID)) + '">Charged</button></td></tr>';
            }).join('');

            return '<div class="sample-group">' + head +
                '<div class="inbox-tablewrap"><table class="inbox-table"><thead><tr>' +
                '<th>Brand</th><th>Style</th><th>Description</th><th>Color</th><th>Size</th><th>Qty</th><th>Charge if kept</th><th class="no-print"></th>' +
                '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
        }).join('');

        root.querySelectorAll('[data-view-id]').forEach(function (btn) {
            btn.addEventListener('click', function () { openDetail(btn.dataset.viewId); });
        });
        root.querySelectorAll('[data-return-pk]').forEach(function (btn) {
            btn.addEventListener('click', function () { checkInItem(btn.dataset.returnPk, 'Returned'); });
        });
        root.querySelectorAll('[data-charge-pk]').forEach(function (btn) {
            btn.addEventListener('click', function () { checkInItem(btn.dataset.chargePk, 'Charged'); });
        });
    }

    // ---------- util ----------

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
})();
