/**
 * leads-common.js — shared core for the Leads CRM pages
 * (dashboards/leads.html board+drawer · dashboards/lead.html workspace).
 *
 * Everything here was extracted verbatim from dashboards/js/leads.js when the
 * workspace page landed (CRM v2 P2) — one source of truth for the pipeline
 * vocabulary, formatting, payload/attachment parsing, and the same-origin
 * crm-proxy fetch helpers. Exposed as window.LeadsCommon.
 *
 * Data-path rules (unchanged): lead rows + writes go through the SAME-ORIGIN
 * session-gated /api/crm-proxy/* forwarders; browser-safe proxy reads
 * (company-contacts, customer-history, quote_sessions) go direct via
 * DashPage.fetchJson. NO POLLING anywhere (Caspio quota).
 */
(function (global) {
    'use strict';

    var LEAD_FORM_IDS = ['jotform-lead', 'quote-request', 'webstore-request', 'team-roster', 'manual-lead'];

    var SOURCE_META = {
        'jotform-lead': { label: 'Website', icon: 'fa-globe' },
        'quote-request': { label: 'Quote Request', icon: 'fa-bullhorn' },
        'webstore-request': { label: 'Webstore', icon: 'fa-store' },
        'team-roster': { label: 'Roster', icon: 'fa-people-group' },
        'manual-lead': { label: 'Phone/Walk-in', icon: 'fa-phone' },
    };

    // Per-form pipelines — mirrors dashboards/js/form-submissions.js STATUS_CHOICES.
    var STATUS_CHOICES = {
        'jotform-lead': ['New', 'Contacted', 'Quoted', 'Won', 'Lost', 'Archived'],
        'quote-request': ['New', 'Contacted', 'Quoted', 'Won', 'Lost', 'Archived'],
        'webstore-request': ['New', 'In Progress', 'Store Built', 'Launched', 'Archived'],
        'team-roster': ['New', 'In Progress', 'Entered in ShopWorks', 'Completed', 'Archived'],
        'manual-lead': ['New', 'Contacted', 'Quoted', 'Won', 'Lost', 'Archived'],
    };
    var WON_STATUSES = ['Won', 'Launched', 'Completed', 'Entered in ShopWorks'];
    var PIPELINE_STATUSES = ['Contacted', 'Quoted', 'In Progress', 'Store Built'];
    // Mirrored by the proxy digest (src/utils/lead-followup-digest.js) — keep in sync.
    var TERMINAL_STATUSES = ['Won', 'Lost', 'Archived', 'Launched', 'Completed', 'Entered in ShopWorks'];

    // Kanban stage per form status (P3). Badges always show the true status.
    var STAGE_OF = {
        'New': 'new',
        'Contacted': 'contacted', 'In Progress': 'contacted',
        'Quoted': 'quoted', 'Store Built': 'quoted',
        'Won': 'won', 'Launched': 'won', 'Completed': 'won', 'Entered in ShopWorks': 'won',
        'Lost': 'lost',
    };
    // What a drop into a column SETS per formId (null = blocked drop).
    var DRAG_STATUS = {
        'jotform-lead': { new: 'New', contacted: 'Contacted', quoted: 'Quoted', won: 'Won', lost: 'Lost' },
        'quote-request': { new: 'New', contacted: 'Contacted', quoted: 'Quoted', won: 'Won', lost: 'Lost' },
        'webstore-request': { new: 'New', contacted: 'In Progress', quoted: 'Store Built', won: 'Launched', lost: null },
        'team-roster': { new: 'New', contacted: 'In Progress', quoted: null, won: 'Entered in ShopWorks', lost: null },
        'manual-lead': { new: 'New', contacted: 'Contacted', quoted: 'Quoted', won: 'Won', lost: 'Lost' },
    };

    // Display names match Sales_Reps_2026.CustomerServiceRep / the quote-builder
    // dropdowns. Taneisha first — default owner of unmatched leads.
    var REPS = ['Taneisha Clark', 'Nika Lao', 'Erik Mickelson', 'Jim Mickelson',
        'Bradley Wright', 'Steve Deland', 'Ruth Nhong', 'General Sales'];

    // Session email → display name (the "Mine" chip). Source of truth for
    // routing lives in the proxy's src/utils/rep-email-map.js — keep in sync.
    var EMAIL_TO_REP = {
        'taneisha@nwcustomapparel.com': 'Taneisha Clark',
        'nika@nwcustomapparel.com': 'Nika Lao',
        'erik@nwcustomapparel.com': 'Erik Mickelson',
        'jim@nwcustomapparel.com': 'Jim Mickelson',
        'bradley@nwcustomapparel.com': 'Bradley Wright',
        'art@nwcustomapparel.com': 'Steve Deland',
        'ruth@nwcustomapparel.com': 'Ruth Nhong',
        'sales@nwcustomapparel.com': 'General Sales',
    };

    // ---------- formatting / safety ----------

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function fmtWhen(iso) {
        var s = String(iso == null ? '' : iso);
        // Date-only strings parse as UTC midnight and display a day early in
        // Pacific — pin to local noon.
        var d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T12:00:00' : s);
        if (isNaN(d.getTime())) return esc(s);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function fmtWhenTime(iso) {
        var d = new Date(String(iso || ''));
        if (isNaN(d.getTime())) return fmtWhen(iso);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
            d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    function fmtMoney(v) {
        var n = Number(v);
        if (!isFinite(n)) return '';
        return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function todayIso() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function isOverdue(dueDate) {
        return /^\d{4}-\d{2}-\d{2}$/.test(String(dueDate || '')) && dueDate < todayIso();
    }

    function safeHttpUrl(u) {
        return typeof u === 'string' && /^https:\/\//i.test(u) ? u : '';
    }

    // Lead fields (incl. payload.artworkUrls and _source.url) come from the PUBLIC
    // POST /api/form-submissions — an attacker can inject any https:// URL. A
    // scheme check (safeHttpUrl) is NOT enough: an arbitrary host renders as a
    // tracking-beacon <img> or a phishing link inside staff dashboards. Attachments
    // are restricted to OUR proxy files + JotForm uploads; the "View in JotForm"
    // source link is restricted to jotform.com. Both parse the URL (not a prefix
    // match) so `https://evil.com/api/files/` and `https://evil.com/jotform.com`
    // can't sneak through.
    function isAllowedAttachmentUrl(u) {
        return typeof u === 'string' && (isJfUpload(u) || u.indexOf(filesBase()) === 0);
    }

    function safeSourceUrl(u) {
        if (typeof u !== 'string' || !/^https:\/\//i.test(u)) return '';
        try {
            var h = new URL(u).hostname.toLowerCase();
            return (h === 'jotform.com' || h.endsWith('.jotform.com')) ? u : '';
        } catch (e) { return ''; }
    }

    // One RFC-4180 CSV cell, hardened against Excel formula injection. Lead values
    // are attacker-supplied (public POST), so a cell starting with = + - @ (or a
    // control char Excel treats as a formula lead-in) is prefixed with an apostrophe
    // so Excel shows it as text instead of executing it.
    function csvCell(v) {
        var s = String(v == null ? '' : v);
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
    }

    // ---------- payload / source ----------

    function payloadOf(lead) {
        if (!lead.__payload) {
            try { lead.__payload = JSON.parse(lead.Payload_JSON || '{}') || {}; }
            catch (e) { lead.__payload = {}; }
        }
        return lead.__payload;
    }

    function payloadEntries(payload) {
        if (Array.isArray(payload.fields)) {
            return payload.fields.filter(function (p) { return Array.isArray(p) && p.length >= 2; });
        }
        return Object.keys(payload)
            .filter(function (k) { return k.charAt(0) !== '_' && k !== 'artworkUrls'; })
            .map(function (k) {
                var v = payload[k];
                return [k, (v && typeof v === 'object') ? JSON.stringify(v) : String(v == null ? '' : v)];
            });
    }

    function sourceTitleOf(lead) {
        if (lead.Form_ID !== 'jotform-lead') return (SOURCE_META[lead.Form_ID] || {}).label || lead.Form_ID;
        var src = payloadOf(lead)._source || {};
        return src.formTitle ? 'Website — ' + src.formTitle : 'Website (JotForm)';
    }

    function statusCls(status) {
        if (status === 'New') return 'ld-status--new';
        if (WON_STATUSES.indexOf(status) !== -1) return 'ld-status--won';
        if (status === 'Lost' || status === 'Archived') return 'ld-status--lost';
        if (PIPELINE_STATUSES.indexOf(status) !== -1) return 'ld-status--active';
        return '';
    }

    // ---------- attachments ----------

    function filesBase() { return DashPage.apiUrl('/api/files/'); }

    function isJfUpload(u) {
        return /^https:\/\/((www\.)?jotform\.com\/uploads\/|files\.jotform\.com\/)/i.test(u);
    }

    // JotForm upload links need a JotForm login — route through the staff passthrough.
    function viewUrl(u) {
        return isJfUpload(u) ? DashPage.apiUrl('/api/jotform/file?u=' + encodeURIComponent(u)) : u;
    }

    function downloadUrl(u) {
        return isJfUpload(u)
            ? viewUrl(u) + '&download=1'
            : u + (u.indexOf('?') >= 0 ? '&' : '?') + 'download=1';
    }

    function isImageUrl(u) {
        return /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(u) || u.indexOf(filesBase()) === 0;
    }

    function fileBasename(u) {
        try { return decodeURIComponent(String(u).split('?')[0].split('/').pop() || ''); }
        catch (e) { return String(u).split('/').pop() || ''; }
    }

    // Known-safe attachment hosts only — never arbitrary customer-typed URLs.
    function extractFileUrls(text) {
        var s = String(text || '');
        var out = [];
        var re = /https:\/\/\S+/g;
        var m;
        while ((m = re.exec(s))) {
            var u = m[0].replace(/[),.;'"\]]+$/, '');
            if (!isAllowedAttachmentUrl(u)) continue;
            // QRQ format "NWE LOGO.webp — https://…" → keep the human filename
            var before = s.slice(0, m.index).replace(/[\s—–-]+$/, '');
            var nm = before.split(/[|;,\n]/).pop().trim();
            if (!/\.[a-z0-9]{2,5}$/i.test(nm)) nm = '';
            out.push({ url: u, name: nm });
        }
        return out;
    }

    // All of a lead's ORIGINAL attachments: payload.artworkUrls + file links
    // found inside submitted field values. Deduped; {url, name}.
    function collectAttachments(payload) {
        // artworkUrls is attacker-controlled (public POST) — allowlist the host,
        // don't just check the scheme (that let any https:// image/link through).
        var atts = (payload.artworkUrls || [])
            .filter(isAllowedAttachmentUrl)
            .map(function (u) { return { url: u, name: '' }; });
        payloadEntries(payload).forEach(function (p) { atts = atts.concat(extractFileUrls(p[1])); });
        var seen = {};
        return atts.filter(function (a) {
            if (!isAllowedAttachmentUrl(a.url) || seen[a.url]) return false; // defense-in-depth
            seen[a.url] = true;
            return true;
        });
    }

    // ---------- 🔥 hot-lead + first-response signals ----------

    var HOT_TEXT_RE = /\b(asap|rush|urgent|deadline|in[\s-]?hands?|need(s|ed)?\s+(it\s+|them\s+|these\s+)?(by|before)|needs?\s+\d)/i;
    var QTY_RE = /\b(\d{2,4})\s*(pcs|pieces|shirts|tees|t-shirts|caps|hats|hoodies|jackets|polos|uniforms|jerseys|units)\b/i;
    var DATE_VALUE_RE = /^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})$/;

    /** Customer-typed text ONLY: Summary + payload field VALUES + checks.
     *  Never the raw Payload_JSON — that includes field LABELS, and e.g. every
     *  Quote Request carries a "Need By" label, which would flag ALL of them. */
    function heatHaystack(lead) {
        var p = payloadOf(lead);
        var vals = (p.fields || []).map(function (pair) { return pair && pair[1] != null ? String(pair[1]) : ''; });
        return (lead.Summary || '') + ' ' + vals.join(' ') + ' ' + (p.checks || []).join(' ');
    }

    /** A payload value that IS a date in the next 60 days = an answered
     *  need-by field (past dates = backfill noise, excluded). */
    function futureNeedBy(lead) {
        var p = payloadOf(lead);
        var fields = p.fields || [];
        for (var i = 0; i < fields.length; i++) {
            var v = fields[i] && fields[i][1] != null ? String(fields[i][1]).trim() : '';
            if (!DATE_VALUE_RE.test(v)) continue;
            // pin ISO date-only to noon — bare YYYY-MM-DD parses UTC (day-shift trap)
            var t = Date.parse(v.indexOf('-') !== -1 ? v + 'T12:00:00' : v);
            if (isNaN(t)) continue;
            var days = Math.floor((t - Date.now()) / 86400000);
            if (days >= 0 && days <= 60) return v;
        }
        return null;
    }

    /** Reasons this lead is hot (empty array = not hot). Cached on the lead
     *  object (cleared by the pages after edits that can change heat). */
    function leadHeat(lead) {
        if (lead.__heat) return lead.__heat;
        var reasons = [];
        var hay = heatHaystack(lead);
        if (HOT_TEXT_RE.test(hay)) reasons.push('deadline mentioned');
        var needBy = futureNeedBy(lead);
        if (needBy && !reasons.length) reasons.push('needs by ' + needBy);
        var qm = QTY_RE.exec(hay);
        if (qm && parseInt(qm[1], 10) >= 48) reasons.push(qm[1] + ' pieces mentioned');
        if (lead.Matched_ID_Customer) reasons.push('existing customer');
        var v = Number(lead.Lead_Value);
        if (isFinite(v) && v >= 500) reasons.push('$' + Math.round(v).toLocaleString('en-US') + ' est. value');
        try {
            Object.defineProperty(lead, '__heat', { value: reasons, configurable: true, enumerable: false, writable: true });
        } catch (e) { /* frozen object — recompute next call */ }
        return reasons;
    }

    /** Call after any edit that can change heat (value, customer link, payload). */
    function clearHeat(lead) {
        try { delete lead.__heat; } catch (e) { /* non-configurable — harmless */ }
    }

    /** First-response countdown for untouched New leads (null when N/A). */
    function responseTimer(lead) {
        if (lead.Status !== 'New') return null;
        var t = Date.parse(lead.Submitted_At);
        if (isNaN(t)) return null;
        var mins = Math.floor((Date.now() - t) / 60000);
        if (mins < 60) return { cls: 'ok', label: 'respond: ' + (60 - mins) + 'm left' };
        if (mins < 1440) return { cls: 'warn', label: Math.floor(mins / 60) + 'h waiting' };
        return { cls: 'late', label: Math.floor(mins / 1440) + 'd untouched' };
    }

    // ---------- same-origin crm-proxy fetch helpers ----------

    function crmFetch(path, options) {
        return fetch('/api/crm-proxy/form-submissions' + path, options).then(function (resp) {
            return resp.json().catch(function () { return {}; }).then(function (body) {
                if (!resp.ok) throw new Error(body.error || ('HTTP ' + resp.status));
                return body;
            });
        });
    }

    function activityFetch(path, options) {
        return fetch('/api/crm-proxy/lead-activity' + (path || ''), options).then(function (resp) {
            return resp.json().catch(function () { return {}; }).then(function (body) {
                if (!resp.ok) throw new Error(body.error || ('HTTP ' + resp.status));
                return body;
            });
        });
    }

    /**
     * Fire-and-forget timeline append — a failed log must never block the
     * primary action (matches the proxy's fire-and-forget notifier contract).
     * Returns the promise so callers that DO care (the composer) can await it.
     */
    function logActivity(submissionId, type, text, attachmentUrl, createdBy) {
        return activityFetch('', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                submissionId: submissionId,
                activityType: type,
                activityText: text || '',
                attachmentUrl: attachmentUrl || '',
                createdBy: createdBy || 'leads-page',
            }),
        }).catch(function (err) {
            console.warn('[leads-common] activity log failed (action already saved):', err.message);
            return null;
        });
    }

    // ---------- shared Edit Lead modal (board drawer + workspace) ----------

    // Editable identity fields (Payload_JSON stays immutable — it's the customer's
    // original submission). Prefills use element.value assignment ONLY — lead
    // values are attacker-controlled (public POST), never innerHTML-interpolated.
    var EDIT_FIELDS = [
        { key: 'Contact_Name', label: 'Contact name', type: 'text' },
        { key: 'Company', label: 'Company *', type: 'text' },
        { key: 'Email', label: 'Email', type: 'email' },
        { key: 'Phone', label: 'Phone', type: 'tel', max: 60 },
        { key: 'Customer_Number', label: 'ShopWorks customer #', type: 'text', max: 40 },
        { key: 'Summary', label: 'What they want', type: 'textarea', max: 250 },
    ];

    function openEditLeadModal(lead, opts) {
        opts = opts || {};
        var old = document.getElementById('edit-lead-overlay');
        if (old && old.parentNode) old.parentNode.removeChild(old);

        var overlay = document.createElement('div');
        overlay.className = 'ld-overlay';
        overlay.id = 'edit-lead-overlay';
        var modal = document.createElement('div');
        modal.className = 'ld-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Edit lead');

        var head = document.createElement('div');
        head.className = 'ld-modal-head';
        var title = document.createElement('h2');
        title.className = 'ld-modal-title';
        title.innerHTML = '<i class="fas fa-pen"></i> Edit lead';
        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'ld-drawer-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        head.appendChild(title);
        head.appendChild(closeBtn);

        var bodyEl = document.createElement('div');
        bodyEl.className = 'ld-modal-body';
        var inputs = {};
        EDIT_FIELDS.forEach(function (f) {
            var ctrl = document.createElement('div');
            ctrl.className = 'ld-control';
            var lab = document.createElement('label');
            lab.className = 'ld-control-label';
            lab.textContent = f.label;
            var input = f.type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
            if (f.type !== 'textarea') input.type = f.type;
            else input.rows = 3;
            input.className = 'ld-select';
            if (f.max) input.maxLength = f.max;
            input.value = lead[f.key] == null ? '' : String(lead[f.key]); // attacker-safe: value, not innerHTML
            inputs[f.key] = input;
            ctrl.appendChild(lab);
            ctrl.appendChild(input);
            bodyEl.appendChild(ctrl);
        });
        var hint = document.createElement('div');
        hint.className = 'ld-muted';
        hint.style.fontSize = '0.78rem';
        hint.textContent = 'The “Submitted Details” panel keeps showing the customer’s original submission.';
        bodyEl.appendChild(hint);

        var actions = document.createElement('div');
        actions.className = 'ld-modal-actions';
        var saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'ld-btn ld-btn--primary';
        saveBtn.innerHTML = '<i class="fas fa-check"></i> Save changes';
        var statusEl = document.createElement('span');
        statusEl.className = 'ld-muted';
        actions.appendChild(saveBtn);
        actions.appendChild(statusEl);
        bodyEl.appendChild(actions);

        modal.appendChild(head);
        modal.appendChild(bodyEl);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        var prevFocus = document.activeElement;
        function close() {
            document.removeEventListener('keydown', onKey);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (prevFocus && document.body.contains(prevFocus)) { try { prevFocus.focus(); } catch (e) { /* gone */ } }
        }
        function onKey(e) {
            if (e.key === 'Escape') { close(); return; }
            if (e.key === 'Tab') { // trap Tab inside the modal
                var f = modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])');
                if (!f.length) return;
                var first = f[0], last = f[f.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        }
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        document.addEventListener('keydown', onKey);
        inputs.Contact_Name.focus();

        saveBtn.addEventListener('click', function () {
            var company = inputs.Company.value.trim();
            if (!company) { statusEl.textContent = 'Company is required.'; inputs.Company.focus(); return; }
            var email = inputs.Email.value.trim();
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { statusEl.textContent = 'That email doesn’t look valid.'; inputs.Email.focus(); return; }

            var updates = {};
            var changed = [];
            EDIT_FIELDS.forEach(function (f) {
                var val = inputs[f.key].value.trim();
                var cur = lead[f.key] == null ? '' : String(lead[f.key]).trim();
                if (val !== cur) { updates[f.key] = val; changed.push(f.label.replace(' *', '')); }
            });
            if (!changed.length) { close(); return; }

            saveBtn.disabled = true;
            statusEl.textContent = 'Saving…';
            crmFetch('/' + encodeURIComponent(lead.Submission_ID), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            }).then(function () {
                Object.keys(updates).forEach(function (k) { lead[k] = updates[k]; });
                clearHeat(lead);
                logActivity(lead.Submission_ID, 'system', 'Edited lead info (' + changed.join(', ') + ')', '', opts.staffEmail || '');
                if (typeof opts.onSaved === 'function') opts.onSaved(updates);
                close();
            }).catch(function (err) {
                saveBtn.disabled = false;
                statusEl.textContent = 'Could not save: ' + err.message;
            });
        });
    }

    // Admin-only hard delete (server-enforced). Confirms first; Archive is the
    // reversible any-staff alternative. onDeleted() runs after a 200.
    function deleteLead(lead, opts) {
        opts = opts || {};
        var name = lead.Company || lead.Contact_Name || lead.Submission_ID;
        if (!window.confirm('Permanently delete “' + name + '” and its entire timeline?\n\nThis cannot be undone. To just hide it instead, set the status to Archived.')) return;
        fetch('/api/crm-proxy/form-submissions/' + encodeURIComponent(lead.Submission_ID), { method: 'DELETE' })
            .then(function (resp) {
                return resp.json().catch(function () { return {}; }).then(function (body) {
                    if (!resp.ok) throw new Error(body.error || ('HTTP ' + resp.status));
                    return body;
                });
            })
            .then(function () { if (typeof opts.onDeleted === 'function') opts.onDeleted(); })
            .catch(function (err) {
                if (typeof DashPage !== 'undefined') DashPage.showError('Could not delete this lead (' + err.message + ').');
                else window.alert('Could not delete this lead: ' + err.message);
            });
    }

    global.LeadsCommon = {
        LEAD_FORM_IDS: LEAD_FORM_IDS,
        SOURCE_META: SOURCE_META,
        STATUS_CHOICES: STATUS_CHOICES,
        WON_STATUSES: WON_STATUSES,
        PIPELINE_STATUSES: PIPELINE_STATUSES,
        TERMINAL_STATUSES: TERMINAL_STATUSES,
        STAGE_OF: STAGE_OF,
        DRAG_STATUS: DRAG_STATUS,
        REPS: REPS,
        EMAIL_TO_REP: EMAIL_TO_REP,
        esc: esc,
        fmtWhen: fmtWhen,
        fmtWhenTime: fmtWhenTime,
        fmtMoney: fmtMoney,
        todayIso: todayIso,
        isOverdue: isOverdue,
        safeHttpUrl: safeHttpUrl,
        safeSourceUrl: safeSourceUrl,
        isAllowedAttachmentUrl: isAllowedAttachmentUrl,
        csvCell: csvCell,
        openEditLeadModal: openEditLeadModal,
        deleteLead: deleteLead,
        payloadOf: payloadOf,
        payloadEntries: payloadEntries,
        sourceTitleOf: sourceTitleOf,
        statusCls: statusCls,
        leadHeat: leadHeat,
        clearHeat: clearHeat,
        responseTimer: responseTimer,
        filesBase: filesBase,
        isJfUpload: isJfUpload,
        viewUrl: viewUrl,
        downloadUrl: downloadUrl,
        isImageUrl: isImageUrl,
        fileBasename: fileBasename,
        extractFileUrls: extractFileUrls,
        collectAttachments: collectAttachments,
        crmFetch: crmFetch,
        activityFetch: activityFetch,
        logActivity: logActivity,
    };
})(window);
