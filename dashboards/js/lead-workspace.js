/**
 * lead-workspace.js — controller for dashboards/lead.html (Leads CRM v2 P2).
 *
 * The full-width "work a lead" record: activity timeline + note composer +
 * file attach (drop / paste / click via ArtworkUpload.uploadOne) in the
 * center; contact / follow-up / value / ShopWorks(+customer intelligence) /
 * quote / orders / submitted-details / artwork panels in the rail.
 *
 * Boot id comes from location.hash FIRST (#JFL0718-1234 — emailed links must
 * never carry '=' because quoted-printable mangles it), ?id= as fallback.
 *
 * Data paths (no polling — everything loads once per open):
 *   lead row + writes  → same-origin /api/crm-proxy/form-submissions*
 *   timeline           → same-origin /api/crm-proxy/lead-activity*
 *   customer match     → public proxy /api/company-contacts/*
 *   customer intel     → public proxy /api/customer-history/:id (6h server cache)
 *   linked quote       → public proxy /api/quote_sessions?quoteID=
 *   order history      → same-origin /api/crm-proxy/order-odbc*
 * Every rendered value passes esc() — lead/note content is untrusted.
 */
(function () {
    'use strict';

    var L = window.LeadsCommon;
    var esc = L.esc, fmtWhen = L.fmtWhen, fmtWhenTime = L.fmtWhenTime, fmtMoney = L.fmtMoney;

    var state = {
        lead: null,
        activities: [],
        staffEmail: '',
        matchCache: {},
        uploading: 0,
    };

    var ICONS = { note: 'fa-comment', status: 'fa-arrow-right-arrow-left', attachment: 'fa-paperclip', quote: 'fa-file-invoice-dollar', system: 'fa-gear', email: 'fa-envelope' };

    // ---------- boot ----------

    document.addEventListener('DOMContentLoaded', function () {
        fetch('/api/crm-session/me')
            .then(function (r) { return r.json(); })
            .then(function (me) { state.staffEmail = me.email || ''; })
            .catch(function () { /* Created_By falls back to 'leads-page' */ });

        var id = decodeURIComponent((location.hash || '').slice(1)) ||
            new URLSearchParams(location.search).get('id') || '';
        if (!id) {
            renderFatal('No lead id — open a lead from the <a href="/dashboards/leads.html">Leads board</a>.');
            return;
        }
        loadLead(id);
        wireComposer();
    });

    function renderFatal(html) {
        document.getElementById('lw-title').innerHTML = 'Lead not found';
        document.getElementById('lw-sub').innerHTML = html;
        document.getElementById('lw-timeline').classList.remove('dash-loading');
        document.getElementById('lw-timeline').innerHTML = '<span class="ld-muted">—</span>';
    }

    function loadLead(id) {
        DashPage.hideError();
        L.crmFetch('/' + encodeURIComponent(id)).then(function (body) {
            state.lead = body.submission;
            if (!state.lead) throw new Error('empty response');
            renderHeader();
            renderRail();
            loadActivities();
        }).catch(function (err) {
            console.error('[lead-ws] load failed:', err);
            DashPage.showError('Unable to load lead ' + id + ' (' + err.message + ').');
            renderFatal('Could not load <span class="ld-id">' + esc(id) + '</span> — it may be mistyped or archived. ' +
                '<a href="/dashboards/leads.html">Back to the Leads board</a>.');
        });
    }

    // ---------- header ----------

    function renderHeader() {
        var lead = state.lead;
        document.title = (lead.Company || lead.Contact_Name || lead.Submission_ID) + ' - Lead - NWCA';
        document.getElementById('lw-title').textContent = lead.Contact_Name || lead.Company || lead.Submission_ID;
        document.getElementById('lw-sub').textContent =
            (lead.Company || '') + ' · ' + L.sourceTitleOf(lead) + ' · received ' + fmtWhen(lead.Submitted_At) +
            ' · ' + lead.Submission_ID;

        var choices = L.STATUS_CHOICES[lead.Form_ID] || L.STATUS_CHOICES['jotform-lead'];
        if (lead.Status && choices.indexOf(lead.Status) === -1) choices = choices.concat([lead.Status]);
        var statusSel = document.getElementById('lw-status');
        statusSel.innerHTML = choices.map(function (s) {
            return '<option value="' + esc(s) + '"' + (s === lead.Status ? ' selected' : '') + '>' + esc(s) + '</option>';
        }).join('');

        var reps = L.REPS.slice();
        if (lead.Sales_Rep && reps.indexOf(lead.Sales_Rep) === -1) reps.push(lead.Sales_Rep);
        var repSel = document.getElementById('lw-rep');
        repSel.innerHTML = '<option value="">(unassigned)</option>' + reps.map(function (r) {
            return '<option value="' + esc(r) + '"' + (r === lead.Sales_Rep ? ' selected' : '') + '>' + esc(r) + '</option>';
        }).join('');

        document.getElementById('lw-head-controls').hidden = false;
        statusSel.onchange = function () { saveLeadField('Status', this.value, this); };
        repSel.onchange = function () { saveLeadField('Sales_Rep', this.value, this); };
        renderHeadChips(lead);
    }

    // 🔥 + first-response chips under the title (leads-common heuristics).
    function renderHeadChips(lead) {
        var el = document.getElementById('lw-head-chips');
        if (!el) return;
        var heat = L.leadHeat(lead);
        var timer = L.responseTimer(lead);
        el.innerHTML =
            (heat.length ? '<span class="lw-fire-chip" title="Why this lead is hot">🔥 ' + esc(heat.join(' · ')) + '</span>' : '') +
            (timer ? '<span class="ld-timer ld-timer--' + timer.cls + '">' + esc(timer.label) + '</span>' : '');
        el.hidden = !el.innerHTML;
    }

    function saveLeadField(field, value, el) {
        var lead = state.lead;
        var prev = lead[field];
        var body = { Updated_By: state.staffEmail || 'leads-page' };
        body[field] = value;
        if (el) el.disabled = true;
        return L.crmFetch('/' + encodeURIComponent(lead.Submission_ID), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).then(function () {
            lead[field] = value;
            if (field === 'Status' && value !== prev) {
                renderHeadChips(lead); // leaving "New" clears the response timer
                L.logActivity(lead.Submission_ID, 'status', 'Status: ' + (prev || '—') + ' → ' + value, '', state.staffEmail)
                    .then(function (r) { if (r && r.activity) prependActivity(r.activity); });
            } else if (field === 'Sales_Rep' && value !== prev) {
                L.logActivity(lead.Submission_ID, 'system', value ? 'Assigned to ' + value : 'Unassigned', '', state.staffEmail)
                    .then(function (r) { if (r && r.activity) prependActivity(r.activity); });
            }
            return true;
        }).catch(function (err) {
            console.error('[lead-ws] save failed:', err);
            DashPage.showError('Could not save ' + field.replace(/_/g, ' ') + ' (' + err.message + '). Nothing was changed.');
            if (el && el.tagName === 'SELECT') el.value = prev || '';
            return false;
        }).finally(function () {
            if (el) el.disabled = false;
        });
    }

    // ---------- timeline ----------

    function loadActivities() {
        L.activityFetch('?submissionId=' + encodeURIComponent(state.lead.Submission_ID)).then(function (body) {
            state.activities = body.activities || [];
            renderTimeline();
        }).catch(function (err) {
            console.error('[lead-ws] activity load failed:', err);
            var root = document.getElementById('lw-timeline');
            root.classList.remove('dash-loading');
            root.innerHTML = '<span class="ld-muted">Activity unavailable (' + esc(err.message) + ').</span>';
        });
    }

    function activityItemHtml(a) {
        var type = a.Activity_Type || 'note';
        var icon = ICONS[type] || 'fa-circle-info';
        var who = a.Created_By === 'jotform-webhook' ? 'System' : (a.Created_By || 'Staff');
        var attach = '';
        if (a.Attachment_URL && L.safeHttpUrl(a.Attachment_URL)) {
            var u = a.Attachment_URL;
            var label = a.Activity_Text || L.fileBasename(u) || 'Attachment';
            attach = '<div class="ld-links" style="margin-top:6px">' +
                (L.isImageUrl(u)
                    ? '<div class="ld-thumbs"><a href="' + esc(L.viewUrl(u)) + '" target="_blank" rel="noopener">' +
                      '<img class="ld-thumb" loading="lazy" alt="Attachment" src="' + esc(L.viewUrl(u)) + '"></a></div>'
                    : '') +
                '<span class="ld-att"><a href="' + esc(L.viewUrl(u)) + '" target="_blank" rel="noopener">' +
                '<i class="fas fa-paperclip"></i> ' + esc(label) + '</a>' +
                '<a class="ld-dl" href="' + esc(L.downloadUrl(u)) + '" title="Download" aria-label="Download attachment">' +
                '<i class="fas fa-download"></i></a></span></div>';
        }
        var text = (type === 'attachment' && attach) ? '' : '<div class="lw-item-text">' + esc(a.Activity_Text || '') + '</div>';
        return '<li class="lw-item lw-item--' + esc(type) + '">' +
            '<span class="lw-item-icon"><i class="fas ' + icon + '"></i></span>' +
            '<div class="lw-item-body">' +
            '<div class="lw-item-meta">' + esc(who) + ' · ' + fmtWhenTime(a.Created_At) + '</div>' +
            text + attach +
            '</div></li>';
    }

    function renderTimeline() {
        var root = document.getElementById('lw-timeline');
        root.classList.remove('dash-loading');
        var lead = state.lead;
        var originItem = '<li class="lw-item lw-item-origin">' +
            '<span class="lw-item-icon"><i class="fas fa-inbox"></i></span>' +
            '<div class="lw-item-body">' +
            '<div class="lw-item-meta">' + fmtWhenTime(lead.Submitted_At) + '</div>' +
            '<div class="lw-item-text">Lead received via ' + esc(L.sourceTitleOf(lead)) +
            (lead.Summary ? ' — “' + esc(lead.Summary) + '”' : '') + '</div>' +
            '</div></li>';
        root.innerHTML = '<ul class="lw-timeline-list">' +
            state.activities.map(activityItemHtml).join('') +
            originItem +
            '</ul>';
        // hide broken thumbnails (extensionless /api/files/ keys can be PDFs)
        Array.prototype.forEach.call(root.querySelectorAll('img.ld-thumb'), function (img) {
            img.addEventListener('error', function () {
                if (img.parentNode) img.parentNode.style.display = 'none';
            });
        });
    }

    function prependActivity(activity) {
        state.activities.unshift(activity);
        renderTimeline();
    }

    // ---------- composer (note + attach) ----------

    function wireComposer() {
        var input = document.getElementById('lw-note-input');
        var saveBtn = document.getElementById('lw-note-save');
        var dropzone = document.getElementById('lw-dropzone');
        var fileInput = document.getElementById('lw-file-input');

        function saveNote() {
            var text = input.value.trim();
            if (!text || !state.lead) return;
            saveBtn.disabled = true;
            L.logActivity(state.lead.Submission_ID, 'note', text, '', state.staffEmail).then(function (r) {
                if (r && r.activity) {
                    input.value = '';
                    prependActivity(r.activity);
                } else {
                    DashPage.showError('Note NOT saved — try again.');
                }
            }).finally(function () { saveBtn.disabled = false; });
        }
        saveBtn.addEventListener('click', saveNote);
        input.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveNote();
        });

        function uploadFiles(fileList) {
            if (!state.lead) return;
            Array.prototype.forEach.call(fileList, function (file) {
                var invalid = window.ArtworkUpload && ArtworkUpload.validateFile(file);
                if (invalid) { DashPage.showError(file.name + ': ' + invalid); return; }
                var statusEl = document.getElementById('lw-upload-status');
                state.uploading += 1;
                statusEl.hidden = false;
                statusEl.textContent = 'Uploading ' + file.name + '… 0%';
                ArtworkUpload.uploadOne(file, function (pct) {
                    statusEl.textContent = 'Uploading ' + file.name + '… ' + pct + '%';
                }).then(function (up) {
                    return L.logActivity(state.lead.Submission_ID, 'attachment', up.originalName || up.fileName, up.hostedUrl, state.staffEmail)
                        .then(function (r) {
                            if (r && r.activity) prependActivity(r.activity);
                            else DashPage.showError('File uploaded but the timeline entry failed — refresh to check.');
                        });
                }).catch(function (err) {
                    DashPage.showError('Upload failed: ' + err.message);
                }).finally(function () {
                    state.uploading -= 1;
                    if (state.uploading <= 0) { statusEl.hidden = true; statusEl.textContent = ''; }
                });
            });
        }

        dropzone.addEventListener('click', function () { fileInput.click(); });
        dropzone.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
        });
        fileInput.addEventListener('change', function () {
            uploadFiles(this.files);
            this.value = '';
        });
        ['dragover', 'dragenter'].forEach(function (ev) {
            dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add('is-over'); });
        });
        ['dragleave', 'drop'].forEach(function (ev) {
            dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove('is-over'); });
        });
        dropzone.addEventListener('drop', function (e) {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
        });
        // Paste-to-attach: screenshots / copied images anywhere on the page.
        document.addEventListener('paste', function (e) {
            var items = (e.clipboardData && e.clipboardData.files) || [];
            if (items.length) uploadFiles(items);
        });
    }

    // ---------- rail panels ----------

    function renderRail() {
        var lead = state.lead;
        renderContactPanel(lead);
        renderOutreachPanel(lead);
        renderFollowupPanel(lead);
        renderValuePanel(lead);
        renderMatchPanel(lead);
        renderQuotePanel(lead);
        renderOrdersPanel(lead);
        renderDetailsPanel(lead);
        renderArtworkPanel(lead);
    }

    function renderContactPanel(lead) {
        document.getElementById('lw-panel-contact').innerHTML = '<dl class="ld-kv">' +
            '<dt>Name</dt><dd>' + esc(lead.Contact_Name || '—') + '</dd>' +
            '<dt>Company</dt><dd>' + esc(lead.Company || '—') + '</dd>' +
            '<dt>Email</dt><dd>' + (lead.Email ? '<a href="mailto:' + esc(lead.Email) + '">' + esc(lead.Email) + '</a>' : '—') + '</dd>' +
            '<dt>Phone</dt><dd>' + (lead.Phone ? '<a href="tel:' + esc(lead.Phone) + '">' + esc(lead.Phone) + '</a>' : '—') + '</dd>' +
            '</dl>';
    }

    // ---------- one-click outreach (4 server-built templates) ----------
    // Keys mirror proxy src/utils/lead-outreach-templates.js TEMPLATE_KEYS.

    var OUTREACH_TEMPLATES = [
        { key: 'intro', label: 'Introduction', icon: 'fa-handshake' },
        { key: 'quote-followup', label: 'Quote follow-up', icon: 'fa-file-invoice-dollar' },
        { key: 'checking-in', label: 'Checking in', icon: 'fa-comment-dots' },
        { key: 'won-thanks', label: 'Thanks — welcome aboard', icon: 'fa-circle-check' },
    ];

    function outreachFetch(payload) {
        return fetch('/api/crm-proxy/lead-outreach', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).then(function (resp) {
            return resp.json().catch(function () { return {}; }).then(function (b) {
                if (!resp.ok) throw new Error((b && b.error) || ('HTTP ' + resp.status));
                return b;
            });
        });
    }

    function outreachBody(lead, tpl, preview) {
        return {
            submissionId: lead.Submission_ID,
            template: tpl.key,
            preview: !!preview,
            lead: { contactName: lead.Contact_Name || '', email: lead.Email || '', company: lead.Company || '' },
            aeName: L.EMAIL_TO_REP[state.staffEmail] || lead.Sales_Rep || 'Northwest Custom Apparel',
            aeEmail: state.staffEmail,
        };
    }

    function renderOutreachPanel(lead) {
        var root = document.getElementById('lw-panel-outreach');
        if (!root) return;
        if (!lead.Email) {
            root.innerHTML = '<span class="ld-muted">No email on this lead — nothing to send to.</span>';
            return;
        }
        root.classList.remove('ld-muted');
        root.innerHTML =
            '<div class="lw-outreach-btns">' + OUTREACH_TEMPLATES.map(function (t, i) {
                return '<button type="button" class="ld-btn lw-outreach-btn" data-tpl="' + i + '">' +
                    '<i class="fas ' + t.icon + '"></i> ' + t.label + '</button>';
            }).join('') + '</div>' +
            '<div id="lw-outreach-preview"></div>';
        Array.prototype.forEach.call(root.querySelectorAll('[data-tpl]'), function (b) {
            b.addEventListener('click', function () {
                previewOutreach(lead, OUTREACH_TEMPLATES[parseInt(b.getAttribute('data-tpl'), 10)]);
            });
        });
    }

    function previewOutreach(lead, tpl) {
        var box = document.getElementById('lw-outreach-preview');
        box.innerHTML = '<span class="ld-muted">Building preview…</span>';
        outreachFetch(outreachBody(lead, tpl, true)).then(function (p) {
            box.innerHTML =
                '<div class="lw-outreach-card">' +
                '<div class="lw-outreach-subject">' + esc(p.subject || '') + '</div>' +
                // bodyHtml is OUR server-side template output — every lead-supplied
                // value is HTML-escaped in lead-outreach-templates.js (jest-locked).
                '<div class="lw-outreach-body">' + (p.bodyHtml || '') + '</div>' +
                '<div class="lw-outreach-actions">' +
                '<button type="button" id="lw-outreach-send" class="ld-btn ld-btn--primary">' +
                '<i class="fas fa-paper-plane"></i> Send to ' + esc(lead.Email) + '</button>' +
                '<button type="button" id="lw-outreach-cancel" class="lw-chip">Cancel</button>' +
                '<span id="lw-outreach-note" class="ld-muted"></span>' +
                '</div></div>';
            document.getElementById('lw-outreach-cancel').addEventListener('click', function () { box.innerHTML = ''; });
            document.getElementById('lw-outreach-send').addEventListener('click', function () {
                var btn = this;
                btn.disabled = true;
                document.getElementById('lw-outreach-note').textContent = 'Sending…';
                outreachFetch(outreachBody(lead, tpl, false)).then(function (r) {
                    box.innerHTML = '<div class="lw-outreach-sent"><i class="fas fa-circle-check"></i> Sent “' +
                        esc(r.label || tpl.label) + '” to ' + esc(r.to || lead.Email) + '</div>';
                    // The proxy logged the 'email' activity server-side; mirror it
                    // locally so the timeline updates without a refetch.
                    prependActivity({
                        Activity_Type: 'email',
                        Activity_Text: 'Emailed “' + (r.label || tpl.label) + '” → ' + (r.to || lead.Email),
                        Created_By: state.staffEmail || 'leads-page',
                        Created_At: new Date().toISOString(),
                    });
                }).catch(function (err) {
                    btn.disabled = false;
                    var note = document.getElementById('lw-outreach-note');
                    if (note) note.textContent = '';
                    DashPage.showError('Email NOT sent: ' + err.message);
                });
            });
        }).catch(function (err) {
            box.innerHTML = '<span class="ld-muted">Preview failed (' + esc(err.message) + ').</span>';
        });
    }

    function renderFollowupPanel(lead) {
        var root = document.getElementById('lw-panel-followup');
        var overdue = L.isOverdue(lead.Due_Date);
        root.innerHTML =
            '<input type="date" id="lw-due" class="lw-value-input" value="' + esc(lead.Due_Date || '') + '">' +
            (overdue ? '<div class="lw-due-overdue"><i class="fas fa-clock"></i> Overdue — was due ' + fmtWhen(lead.Due_Date) + '</div>' : '') +
            '<div class="lw-chips">' +
            [['+1d', 1], ['+3d', 3], ['+1w', 7], ['+2w', 14]].map(function (c) {
                return '<button type="button" class="lw-chip" data-days="' + c[1] + '">' + c[0] + '</button>';
            }).join('') +
            '</div>';
        document.getElementById('lw-due').addEventListener('change', function () {
            var el = this;
            saveLeadField('Due_Date', el.value, el).then(function (ok) { if (ok) renderFollowupPanel(lead); });
        });
        Array.prototype.forEach.call(root.querySelectorAll('.lw-chip'), function (chip) {
            chip.addEventListener('click', function () {
                var d = new Date();
                d.setDate(d.getDate() + parseInt(chip.getAttribute('data-days'), 10));
                var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                saveLeadField('Due_Date', iso, chip).then(function (ok) { if (ok) renderFollowupPanel(lead); });
            });
        });
    }

    function renderValuePanel(lead) {
        var root = document.getElementById('lw-panel-value');
        root.innerHTML =
            (lead.Lead_Value ? '<div class="lw-value-big">' + (fmtMoney(lead.Lead_Value) || esc(lead.Lead_Value)) + '</div>' : '') +
            '<input type="number" id="lw-value" class="lw-value-input" min="0" step="50" placeholder="Estimated $"' +
            ' value="' + esc(lead.Lead_Value || '') + '">';
        document.getElementById('lw-value').addEventListener('change', function () {
            var el = this;
            saveLeadField('Lead_Value', el.value, el).then(function (ok) { if (ok) renderValuePanel(lead); });
        });
    }

    // ShopWorks match — same flow as the drawer (leads.js) + customer intel.
    function renderMatchPanel(lead) {
        var root = document.getElementById('match-root');

        function showProspect(note) {
            root.innerHTML = '<div class="ld-match">' +
                '<div class="ld-match-head"><span class="ld-pill ld-pill--prospect"><i class="fas fa-user-plus"></i> New prospect</span></div>' +
                '<div class="ld-muted">' + esc(note) + '</div>' +
                '<div class="ld-match-search">' +
                '<input type="search" id="lw-match-input" class="ld-search" placeholder="Search ShopWorks…">' +
                '<button type="button" id="lw-match-btn" class="ld-btn"><i class="fas fa-magnifying-glass"></i></button>' +
                '</div><div class="ld-match-results" id="lw-match-results"></div></div>';
            wireMatchSearch(lead);
            document.getElementById('lw-panel-intel').innerHTML = '';
        }

        function linkCustomer(custId) {
            saveLeadField('Matched_ID_Customer', String(custId), null).then(function (ok) {
                if (!ok) return;
                L.logActivity(lead.Submission_ID, 'system', 'Linked ShopWorks customer #' + custId, '', state.staffEmail)
                    .then(function (r) { if (r && r.activity) prependActivity(r.activity); });
                renderMatchPanel(lead);
                renderOrdersPanel(lead, true);
            });
        }

        function wireMatchSearch(l) {
            var btn = document.getElementById('lw-match-btn');
            var input = document.getElementById('lw-match-input');
            if (!btn || !input) return;
            var run = function () {
                var q = input.value.trim();
                if (q.length < 2) return;
                var resultsEl = document.getElementById('lw-match-results');
                resultsEl.innerHTML = '<span class="ld-muted">Searching…</span>';
                DashPage.fetchJson('/api/company-contacts/search?q=' + encodeURIComponent(q) + '&limit=8')
                    .then(function (body) {
                        var contacts = body.contacts || [];
                        if (!contacts.length) { resultsEl.innerHTML = '<span class="ld-muted">No matches.</span>'; return; }
                        resultsEl.innerHTML = contacts.map(function (c) {
                            return '<div class="ld-match-result"><span><strong>' + esc(c.CustomerCompanyName || c.Company_Name || '—') + '</strong> ' +
                                '<span class="ld-muted">#' + esc(c.id_Customer) + '</span></span>' +
                                '<button type="button" class="ld-btn" data-link="' + esc(c.id_Customer) + '">Link</button></div>';
                        }).join('');
                        Array.prototype.forEach.call(resultsEl.querySelectorAll('[data-link]'), function (b) {
                            b.addEventListener('click', function () { linkCustomer(b.getAttribute('data-link')); });
                        });
                    })
                    .catch(function (err) { resultsEl.innerHTML = '<span class="ld-muted">Search failed (' + esc(err.message) + ').</span>'; });
            };
            btn.addEventListener('click', run);
            input.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
        }

        if (lead.Matched_ID_Customer) {
            root.innerHTML = '<div class="ld-match ld-match--found">' +
                '<div class="ld-match-head"><span class="ld-pill ld-pill--customer"><i class="fas fa-circle-check"></i> Existing customer</span>' +
                '<span class="ld-muted">#' + esc(lead.Matched_ID_Customer) + '</span></div>' +
                '<div id="lw-match-detail" class="ld-muted">Loading…</div></div>';
            DashPage.fetchJson('/api/company-contacts/by-customer/' + encodeURIComponent(lead.Matched_ID_Customer))
                .then(function (body) {
                    var c = (body.contacts || [])[0];
                    var el = document.getElementById('lw-match-detail');
                    if (!el) return;
                    if (!c) { el.textContent = 'No active contact rows.'; return; }
                    el.outerHTML = '<dl class="ld-kv">' + [
                        ['Company', c.CustomerCompanyName || c.Company_Name],
                        ['AE', c.CustomerCustomerServiceRep || c.Sales_Rep],
                        ['Tier', c.Account_Tier],
                        ['Last ordered', c.Customerdate_LastOrdered ? fmtWhen(c.Customerdate_LastOrdered) : ''],
                    ].filter(function (p) { return p[1]; })
                        .map(function (p) { return '<dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd>'; }).join('') + '</dl>';
                })
                .catch(function () {
                    var el = document.getElementById('lw-match-detail');
                    if (el) el.textContent = 'Customer detail unavailable.';
                });
            renderIntelPanel(lead.Matched_ID_Customer);
            return;
        }

        if (!lead.Email) { showProspect('No email on this lead — search manually.'); return; }

        DashPage.fetchJson('/api/company-contacts/by-email/' + encodeURIComponent(lead.Email))
            .then(function (body) {
                var c = body.contact;
                if (!c) { showProspect('No ShopWorks contact with ' + lead.Email + '.'); return; }
                root.innerHTML = '<div class="ld-match ld-match--found">' +
                    '<div class="ld-match-head"><span class="ld-pill ld-pill--customer"><i class="fas fa-circle-check"></i> Existing customer</span>' +
                    '<button type="button" class="ld-btn" id="lw-link-btn"><i class="fas fa-link"></i> Link #' + esc(c.id_Customer) + '</button></div>' +
                    '<dl class="ld-kv">' + [
                        ['Company', c.CustomerCompanyName || c.Company_Name],
                        ['AE', c.CustomerCustomerServiceRep || c.Sales_Rep],
                        ['Tier', c.Account_Tier],
                    ].filter(function (p) { return p[1]; })
                        .map(function (p) { return '<dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd>'; }).join('') + '</dl></div>';
                document.getElementById('lw-link-btn').addEventListener('click', function () { linkCustomer(c.id_Customer); });
            })
            .catch(function (err) {
                if (/\b404\b/.test(err.message)) showProspect('No ShopWorks contact with ' + lead.Email + '.');
                else root.innerHTML = '<span class="ld-muted">Customer lookup unavailable (' + esc(err.message) + ').</span>';
            });
    }

    // Customer intelligence — /api/customer-history (fails soft).
    function renderIntelPanel(custId) {
        var root = document.getElementById('lw-panel-intel');
        root.innerHTML = '<div class="lw-intel"><span class="ld-muted">Loading history…</span></div>';
        DashPage.fetchJson('/api/customer-history/' + encodeURIComponent(custId))
            .then(function (h) {
                if (!h || h.hasHistory === false) { root.innerHTML = ''; return; }
                var items = (h.topItems || []).slice(0, 3).map(function (i) { return i.name || i.item || i; });
                root.innerHTML = '<div class="lw-intel"><div class="lw-intel-title">Customer intelligence</div><dl class="ld-kv">' +
                    [
                        ['Orders', h.orderCount],
                        ['Last order', h.lastOrderDaysAgo != null ? h.lastOrderDaysAgo + ' days ago' : (h.lastOrderDate ? fmtWhen(h.lastOrderDate) : '')],
                        ['Revenue', h.totalRevenue != null ? fmtMoney(h.totalRevenue) : ''],
                        ['Avg order', h.avgOrderSize != null ? fmtMoney(h.avgOrderSize) : ''],
                        ['Buys', items.length ? items.join(', ') : ''],
                    ].filter(function (p) { return p[1] !== '' && p[1] != null; })
                        .map(function (p) { return '<dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd>'; }).join('') +
                    '</dl></div>';
            })
            .catch(function () { root.innerHTML = ''; });
    }

    // "Start a quote" targets — mirrors dashboards/js/quote-management.js
    // DUPLICATE_BUILDERS routing (EMB*/SP* variants collapse to one builder).
    var QUOTE_BUILDERS = [
        { label: 'Embroidery', icon: 'fa-shirt', url: '/quote-builders/embroidery-quote-builder.html' },
        { label: 'Screen Print', icon: 'fa-print', url: '/quote-builders/screenprint-quote-builder.html' },
        { label: 'DTG', icon: 'fa-spray-can', url: '/quote-builders/dtg-quote-builder.html' },
        { label: 'DTF', icon: 'fa-fire', url: '/quote-builders/dtf-quote-builder.html' },
    ];

    // Hand the lead's identity to a builder via the EXISTING method-switch
    // prefill (quote-builder-utils.js takeMethodSwitchPrefill — zero builder
    // edits): sessionStorage + ?from=methodswitch.
    function startQuote(builderUrl) {
        var lead = state.lead;
        try {
            sessionStorage.setItem('nwca-method-switch', JSON.stringify({
                customer: {
                    name: lead.Contact_Name || '',
                    email: lead.Email || '',
                    company: lead.Company || '',
                    phone: lead.Phone || '',
                    customerNumber: lead.Matched_ID_Customer || lead.Customer_Number || '',
                },
                products: [],
            }));
        } catch (e) { /* storage blocked — builder opens unprefilled */ }
        window.open(builderUrl + '?from=methodswitch', '_blank', 'noopener');
        L.logActivity(lead.Submission_ID, 'system', 'Started a quote (' + builderUrl.split('/').pop().replace('-quote-builder.html', '') + ')', '', state.staffEmail)
            .then(function (r) { if (r && r.activity) prependActivity(r.activity); });
    }

    function linkQuote(lead, q) {
        saveLeadField('Linked_Quote_ID', q.QuoteID, null).then(function (ok) {
            if (!ok) return;
            var total = q.TotalAmount != null && q.TotalAmount !== '' ? String(q.TotalAmount) : '';
            if (total && String(lead.Lead_Value || '') !== total) {
                saveLeadField('Lead_Value', total, null).then(function (ok2) { if (ok2) renderValuePanel(lead); });
            }
            L.logActivity(lead.Submission_ID, 'quote',
                'Linked quote ' + q.QuoteID + (total ? ' (' + fmtMoney(total) + ')' : ''), '', state.staffEmail)
                .then(function (r) { if (r && r.activity) prependActivity(r.activity); });
            renderQuotePanel(lead);
        });
    }

    function loadQuoteSuggestions(lead) {
        var box = document.getElementById('lw-quote-suggest');
        if (!box) return;
        if (!lead.Email) { box.innerHTML = '<span class="ld-muted">No email on this lead — link by Quote ID below.</span>'; return; }
        box.innerHTML = '<span class="ld-muted">Checking recent quotes…</span>';
        DashPage.fetchJson('/api/quote_sessions?customerEmail=' + encodeURIComponent(lead.Email))
            .then(function (body) {
                var rows = Array.isArray(body) ? body : (body.sessions || body.result || []);
                var seen = {};
                var quotes = rows.filter(function (q) {
                    if (!q || !q.QuoteID || seen[q.QuoteID]) return false;
                    seen[q.QuoteID] = true;
                    return true;
                }).slice(0, 5);
                if (!quotes.length) {
                    box.innerHTML = '<span class="ld-muted">No quotes for ' + esc(lead.Email) + ' yet. ' +
                        'After saving one in the builder, </span><button type="button" id="lw-suggest-refresh" class="lw-chip">check again</button>';
                    var r1 = document.getElementById('lw-suggest-refresh');
                    if (r1) r1.addEventListener('click', function () { loadQuoteSuggestions(lead); });
                    return;
                }
                box.innerHTML = quotes.map(function (q, i) {
                    return '<div class="ld-match-result"><span>' +
                        '<strong class="ld-id">' + esc(q.QuoteID) + '</strong> ' +
                        '<span class="ld-muted">' + (fmtMoney(q.TotalAmount) || '') +
                        (q.CreatedAt ? ' · ' + fmtWhen(q.CreatedAt) : '') + '</span></span>' +
                        '<button type="button" class="ld-btn" data-quote="' + i + '">Link</button></div>';
                }).join('') +
                '<button type="button" id="lw-suggest-refresh" class="lw-chip">refresh</button>';
                Array.prototype.forEach.call(box.querySelectorAll('[data-quote]'), function (b) {
                    b.addEventListener('click', function () { linkQuote(lead, quotes[parseInt(b.getAttribute('data-quote'), 10)]); });
                });
                var r2 = document.getElementById('lw-suggest-refresh');
                if (r2) r2.addEventListener('click', function () { loadQuoteSuggestions(lead); });
            })
            .catch(function (err) {
                box.innerHTML = '<span class="ld-muted">Quote lookup unavailable (' + esc(err.message) + ').</span>';
            });
    }

    // Linked quote panel — live status/$ + start-a-quote handoff + suggestions.
    function renderQuotePanel(lead) {
        var root = document.getElementById('lw-panel-quote');

        function manualLinkHtml() {
            return '<div class="lw-quote-row">' +
                '<input type="text" id="lw-quote-id" class="lw-quote-input" placeholder="Quote ID (e.g. EMB0718-1)">' +
                '<button type="button" id="lw-quote-link" class="ld-btn" aria-label="Link quote"><i class="fas fa-link"></i></button>' +
                '</div>';
        }

        if (lead.Linked_Quote_ID) {
            root.innerHTML = '<div class="lw-quote-linked">' +
                '<div class="ld-match-head"><span class="ld-id">' + esc(lead.Linked_Quote_ID) + '</span>' +
                '<a class="ld-btn" href="/quote/' + encodeURIComponent(lead.Linked_Quote_ID) + '" target="_blank" rel="noopener">Open</a></div>' +
                '<div id="lw-quote-live" class="ld-muted">Loading quote…</div></div>';
            DashPage.fetchJson('/api/quote_sessions?quoteID=' + encodeURIComponent(lead.Linked_Quote_ID))
                .then(function (body) {
                    var rows = Array.isArray(body) ? body : (body.sessions || body.result || []);
                    var q = rows[0];
                    var el = document.getElementById('lw-quote-live');
                    if (!el) return;
                    if (!q) { el.textContent = 'Quote not found.'; return; }
                    el.outerHTML = '<div class="lw-quote-amount">' + (fmtMoney(q.TotalAmount) || '—') + '</div>' +
                        '<div class="ld-muted">' + esc(q.Status || '') + (q.CustomerName ? ' · ' + esc(q.CustomerName) : '') + '</div>';
                    // Snapshot re-sync: the quote's real total drives pipeline $.
                    var total = q.TotalAmount != null ? String(q.TotalAmount) : '';
                    if (total && String(lead.Lead_Value || '') !== total) {
                        saveLeadField('Lead_Value', total, null).then(function (ok) { if (ok) renderValuePanel(lead); });
                    }
                })
                .catch(function () {
                    var el = document.getElementById('lw-quote-live');
                    if (el) el.textContent = 'Quote lookup unavailable.';
                });
            return;
        }

        root.innerHTML =
            '<div class="lw-intel-title">Start a quote — prefilled with this lead</div>' +
            '<div class="lw-method-grid">' + QUOTE_BUILDERS.map(function (b, i) {
                return '<button type="button" class="ld-btn lw-method-btn" data-builder="' + i + '">' +
                    '<i class="fas ' + b.icon + '"></i> ' + b.label + '</button>';
            }).join('') + '</div>' +
            '<div class="lw-intel-title">Recent quotes for this email</div>' +
            '<div id="lw-quote-suggest"></div>' +
            manualLinkHtml();

        Array.prototype.forEach.call(root.querySelectorAll('[data-builder]'), function (b) {
            b.addEventListener('click', function () { startQuote(QUOTE_BUILDERS[parseInt(b.getAttribute('data-builder'), 10)].url); });
        });
        loadQuoteSuggestions(lead);
        document.getElementById('lw-quote-link').addEventListener('click', function () {
            var id = document.getElementById('lw-quote-id').value.trim();
            if (!/^[A-Za-z0-9-]{3,40}$/.test(id)) { DashPage.showError('That does not look like a Quote ID.'); return; }
            linkQuote(lead, { QuoteID: id, TotalAmount: null }); // linked view re-syncs $ from the live quote
        });
    }

    // Order history — same click-gated forwarder read as the drawer.
    function renderOrdersPanel(lead, autoload) {
        var root = document.getElementById('orders-root');
        var custId = parseInt(lead.Matched_ID_Customer, 10);
        if (!isFinite(custId) || custId <= 0) {
            root.innerHTML = '<span class="ld-muted">Link a ShopWorks customer to see orders.</span>';
            return;
        }
        root.innerHTML = '<button type="button" id="lw-load-orders" class="ld-btn">' +
            '<i class="fas fa-clock-rotate-left"></i> Load recent orders</button>';
        var btn = document.getElementById('lw-load-orders');
        var load = function () {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading…';
            var params = new URLSearchParams();
            params.set('q.where', 'id_Customer=' + custId);
            params.set('q.orderBy', 'date_OrderPlaced DESC');
            params.set('q.limit', '25');
            fetch('/api/crm-proxy/order-odbc?' + params.toString()).then(function (resp) {
                return resp.json().catch(function () { return []; }).then(function (body) {
                    if (!resp.ok) throw new Error((body && body.error) || ('HTTP ' + resp.status));
                    return body;
                });
            }).then(function (orders) {
                if (!Array.isArray(orders) || !orders.length) {
                    root.innerHTML = '<span class="ld-muted">No orders on file.</span>';
                    return;
                }
                root.innerHTML = '<div class="ld-table-scroll"><table class="ld-orders-table"><thead><tr>' +
                    '<th>Placed</th><th>Order #</th><th>Total</th><th>Status</th></tr></thead><tbody>' +
                    orders.map(function (o) {
                        var st = String(o.sts_Invoiced) === '1' ? 'Invoiced'
                            : String(o.sts_Shipped) === '1' ? 'Shipped' : 'Open';
                        return '<tr><td>' + fmtWhen(o.date_OrderPlaced) + '</td>' +
                            '<td class="ld-id">' + esc(o.ID_Order) + '</td>' +
                            '<td>' + (fmtMoney(o.cnCur_TotalInvoice) || '—') + '</td>' +
                            '<td>' + esc(st) + '</td></tr>';
                    }).join('') + '</tbody></table></div>';
            }).catch(function (err) {
                root.innerHTML = '<span class="ld-muted">Order history unavailable (' + esc(err.message) + ').</span>';
            });
        };
        btn.addEventListener('click', load);
        if (autoload) load();
    }

    function renderDetailsPanel(lead) {
        var entries = L.payloadEntries(L.payloadOf(lead));
        document.getElementById('lw-panel-details').innerHTML = entries.length
            ? '<dl class="ld-kv">' + entries.map(function (p) {
                return '<dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd>';
            }).join('') + '</dl>'
            : '<span class="ld-muted">—</span>';
    }

    function renderArtworkPanel(lead) {
        var payload = L.payloadOf(lead);
        var atts = L.collectAttachments(payload);
        var jfUrl = L.safeHttpUrl((payload._source || {}).url || '');
        var root = document.getElementById('lw-panel-artwork');
        if (!atts.length && !jfUrl) { root.innerHTML = '<span class="ld-muted">None attached.</span>'; return; }
        var thumbs = atts.map(function (a) { return a.url; }).filter(L.isImageUrl);
        root.innerHTML =
            (thumbs.length ? '<div class="ld-thumbs">' + thumbs.map(function (u) {
                return '<a href="' + esc(L.viewUrl(u)) + '" target="_blank" rel="noopener">' +
                    '<img class="ld-thumb" loading="lazy" alt="Artwork" src="' + esc(L.viewUrl(u)) + '"></a>';
            }).join('') + '</div>' : '') +
            '<div class="ld-links">' +
            atts.map(function (a, i) {
                var label = a.name || (L.isJfUpload(a.url) ? L.fileBasename(a.url) : '') || ('Attachment ' + (i + 1));
                return '<span class="ld-att"><a href="' + esc(L.viewUrl(a.url)) + '" target="_blank" rel="noopener">' +
                    '<i class="fas fa-paperclip"></i> ' + esc(label) + '</a>' +
                    '<a class="ld-dl" href="' + esc(L.downloadUrl(a.url)) + '" title="Download ' + esc(label) + '">' +
                    '<i class="fas fa-download"></i></a></span>';
            }).join('') +
            (jfUrl ? '<a href="' + esc(jfUrl) + '" target="_blank" rel="noopener">' +
                '<i class="fas fa-arrow-up-right-from-square"></i> View in JotForm</a>' : '') +
            '</div>';
        Array.prototype.forEach.call(root.querySelectorAll('img.ld-thumb'), function (img) {
            img.addEventListener('error', function () {
                if (img.parentNode) img.parentNode.style.display = 'none';
            });
        });
    }
})();
