/**
 * leads.js — controller for dashboards/leads.html (Leads CRM)
 *
 * One board for every lead source: the 6 JotForm website forms (ingested by
 * the proxy as Form_ID='jotform-lead') + the in-app Quote Request / Webstore
 * Inquiry / Team Roster forms — all rows in Caspio Form_Submissions.
 *
 * Data paths:
 *   · lead rows + status/rep/link writes → SAME-ORIGIN session-gated forwarder
 *     /api/crm-proxy/form-submissions* (raw proxy endpoints are secret-only —
 *     lead rows hold customer PII)
 *   · ShopWorks customer match → DashPage.fetchJson → public proxy
 *     /api/company-contacts/* (quote-builder precedent)
 *   · order history → SAME-ORIGIN /api/crm-proxy/order-odbc* (secret-gated
 *     upstream since v2026.07.18)
 *
 * NO POLLING — Caspio quota rule. Data loads on open + the Refresh button.
 * Every rendered value passes esc() — lead fields are attacker-controlled.
 */
(function () {
    'use strict';

    var LEAD_FORM_IDS = ['jotform-lead', 'quote-request', 'webstore-request', 'team-roster'];

    var SOURCE_META = {
        'jotform-lead': { label: 'Website', icon: 'fa-globe' },
        'quote-request': { label: 'Quote Request', icon: 'fa-bullhorn' },
        'webstore-request': { label: 'Webstore', icon: 'fa-store' },
        'team-roster': { label: 'Roster', icon: 'fa-people-group' },
    };

    // Per-form pipelines — mirrors dashboards/js/form-submissions.js STATUS_CHOICES.
    var STATUS_CHOICES = {
        'jotform-lead': ['New', 'Contacted', 'Quoted', 'Won', 'Lost', 'Archived'],
        'quote-request': ['New', 'Contacted', 'Quoted', 'Won', 'Lost', 'Archived'],
        'webstore-request': ['New', 'In Progress', 'Store Built', 'Launched', 'Archived'],
        'team-roster': ['New', 'In Progress', 'Entered in ShopWorks', 'Completed', 'Archived'],
    };
    var WON_STATUSES = ['Won', 'Launched', 'Completed', 'Entered in ShopWorks'];
    var PIPELINE_STATUSES = ['Contacted', 'Quoted', 'In Progress', 'Store Built'];

    // Display names match Sales_Reps_2026.CustomerServiceRep / the quote-builder
    // dropdowns. Taneisha first — she is the default owner of unmatched leads.
    var REPS = ['Taneisha Clark', 'Nika Lao', 'Erik Mickelson', 'Jim Mickelson',
        'Bradley Wright', 'Steve Deland', 'Ruth Nhong', 'General Sales'];

    var state = {
        leads: [],
        includeArchived: false,
        source: '',
        status: '',
        rep: '',
        search: '',
        staffEmail: '',
        current: null,          // lead open in the drawer
        matchCache: {},         // email → contact | null (per page-load)
        hashOpened: false,      // #Submission_ID deep link handled once per load
    };

    // ---------- tiny utils ----------

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function fmtWhen(iso) {
        var s = String(iso == null ? '' : iso);
        // Date-only strings (e.g. contacts' Last_Order_Date '2026-06-30') parse as
        // UTC midnight and would display a day early in Pacific — pin to local noon.
        var d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T12:00:00' : s);
        if (isNaN(d.getTime())) return esc(s);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function fmtMoney(v) {
        var n = Number(v);
        if (!isFinite(n)) return '';
        return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function safeHttpUrl(u) {
        return typeof u === 'string' && /^https:\/\//i.test(u) ? u : '';
    }

    function payloadOf(lead) {
        if (!lead.__payload) {
            try { lead.__payload = JSON.parse(lead.Payload_JSON || '{}') || {}; }
            catch (e) { lead.__payload = {}; }
        }
        return lead.__payload;
    }

    function sourceTitleOf(lead) {
        if (lead.Form_ID !== 'jotform-lead') return (SOURCE_META[lead.Form_ID] || {}).label || lead.Form_ID;
        var src = payloadOf(lead)._source || {};
        return src.formTitle ? 'Website — ' + src.formTitle : 'Website (JotForm)';
    }

    // Same-origin session-gated forwarder (mirrors the Forms Inbox pattern).
    function crmFetch(path, options) {
        return fetch('/api/crm-proxy/form-submissions' + path, options).then(function (resp) {
            return resp.json().catch(function () { return {}; }).then(function (body) {
                if (!resp.ok) throw new Error(body.error || ('HTTP ' + resp.status));
                return body;
            });
        });
    }

    function statusCls(status) {
        if (status === 'New') return 'ld-status--new';
        if (WON_STATUSES.indexOf(status) !== -1) return 'ld-status--won';
        if (status === 'Lost' || status === 'Archived') return 'ld-status--lost';
        if (PIPELINE_STATUSES.indexOf(status) !== -1) return 'ld-status--active';
        return '';
    }

    // ---------- boot ----------

    document.addEventListener('DOMContentLoaded', function () {
        wireChrome();
        fetch('/api/crm-session/me')
            .then(function (r) { return r.json(); })
            .then(function (me) { state.staffEmail = me.email || ''; })
            .catch(function () { /* Updated_By falls back to 'leads-page' */ });
        loadLeads();
    });

    function wireChrome() {
        document.getElementById('btn-refresh').addEventListener('click', loadLeads);
        document.getElementById('filter-archived').addEventListener('change', function () {
            state.includeArchived = this.checked;
            loadLeads();
        });
        [['filter-source', 'source'], ['filter-status', 'status'], ['filter-rep', 'rep']].forEach(function (pair) {
            document.getElementById(pair[0]).addEventListener('change', function () {
                state[pair[1]] = this.value;
                renderTable();
            });
        });
        document.getElementById('filter-search').addEventListener('input', function () {
            state.search = this.value.trim().toLowerCase();
            renderTable();
        });
        document.getElementById('drawer-close').addEventListener('click', closeDrawer);
        document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
    }

    // ---------- data ----------

    function loadLeads() {
        DashPage.hideError();
        var tbody = document.getElementById('leads-tbody');
        tbody.innerHTML = '<tr><td colspan="7" class="ld-empty dash-loading">Loading leads…</td></tr>';

        var params = new URLSearchParams();
        params.set('formIds', LEAD_FORM_IDS.join(','));
        params.set('limit', state.includeArchived ? '2000' : '600');
        if (!state.includeArchived) params.set('statusNot', 'Archived');

        crmFetch('?' + params.toString()).then(function (body) {
            state.leads = body.submissions || [];
            renderFilters();
            renderStats();
            renderTable();
            // Deep link from the AE notification email: /dashboards/leads.html#JFL0718-1234
            // (a #hash, not ?lead= — '=' gets mangled by quoted-printable in emails).
            var wantId = decodeURIComponent((location.hash || '').slice(1));
            if (wantId && !state.hashOpened) {
                state.hashOpened = true;
                var hit = state.leads.find(function (l) { return l.Submission_ID === wantId; });
                if (hit) openDrawer(hit);
                else DashPage.showError('Lead ' + wantId + ' is not in the current view — it may be Archived (turn on "Show archived").');
            }
        }).catch(function (err) {
            console.error('[leads] load failed:', err);
            DashPage.showError('Unable to load leads (' + err.message + '). Refresh to retry.');
            tbody.innerHTML = '<tr><td colspan="7" class="ld-empty"><i class="fas fa-triangle-exclamation"></i> Leads unavailable.</td></tr>';
        });
    }

    // ---------- rendering ----------

    function renderStats() {
        var total = state.leads.length;
        var fresh = 0, pipeline = 0, won = 0;
        state.leads.forEach(function (l) {
            if (l.Status === 'New') fresh += 1;
            else if (PIPELINE_STATUSES.indexOf(l.Status) !== -1) pipeline += 1;
            if (WON_STATUSES.indexOf(l.Status) !== -1) won += 1;
        });
        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-new').textContent = fresh;
        document.getElementById('stat-pipeline').textContent = pipeline;
        document.getElementById('stat-won').textContent = won;
    }

    function setOptions(selectId, current, options) {
        var sel = document.getElementById(selectId);
        var first = sel.options[0];
        sel.innerHTML = '';
        sel.appendChild(first);
        options.forEach(function (o) {
            var opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.label;
            sel.appendChild(opt);
        });
        sel.value = current;
        if (sel.value !== current) { sel.value = ''; }
    }

    function renderFilters() {
        // Source: the 3 in-app forms + one entry per JotForm form seen in the data.
        var sources = [];
        ['quote-request', 'webstore-request', 'team-roster'].forEach(function (f) {
            sources.push({ value: f, label: SOURCE_META[f].label });
        });
        var seenJf = {};
        state.leads.forEach(function (l) {
            if (l.Form_ID !== 'jotform-lead') return;
            var key = l.External_Source || 'jotform';
            if (!seenJf[key]) {
                seenJf[key] = true;
                sources.push({ value: 'jf:' + key, label: sourceTitleOf(l) });
            }
        });
        setOptions('filter-source', state.source, sources);

        var statuses = {};
        state.leads.forEach(function (l) { if (l.Status) statuses[l.Status] = true; });
        setOptions('filter-status', state.status, Object.keys(statuses).sort().map(function (s) {
            return { value: s, label: s };
        }));

        var reps = {};
        REPS.forEach(function (r) { reps[r] = true; });
        state.leads.forEach(function (l) { if (l.Sales_Rep) reps[l.Sales_Rep] = true; });
        var repOptions = Object.keys(reps).map(function (r) { return { value: r, label: r }; });
        repOptions.push({ value: '(unassigned)', label: '(unassigned)' });
        setOptions('filter-rep', state.rep, repOptions);
    }

    function matchesFilters(l) {
        if (state.source) {
            if (state.source.indexOf('jf:') === 0) {
                if (l.Form_ID !== 'jotform-lead' || ('jf:' + (l.External_Source || 'jotform')) !== state.source) return false;
            } else if (l.Form_ID !== state.source) return false;
        }
        if (state.status && l.Status !== state.status) return false;
        if (state.rep === '(unassigned)') { if (l.Sales_Rep) return false; }
        else if (state.rep && l.Sales_Rep !== state.rep) return false;
        if (state.search) {
            var hay = [l.Company, l.Contact_Name, l.Email, l.Phone, l.Summary, l.Submission_ID]
                .join(' ').toLowerCase();
            if (hay.indexOf(state.search) === -1) return false;
        }
        return true;
    }

    function renderTable() {
        var rows = state.leads.filter(matchesFilters);
        document.getElementById('leads-count').textContent =
            rows.length + ' of ' + state.leads.length + (state.includeArchived ? ' (incl. archived)' : '');

        var tbody = document.getElementById('leads-tbody');
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="ld-empty">No leads match the current filters.</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(function (l) {
            var meta = SOURCE_META[l.Form_ID] || { label: l.Form_ID, icon: 'fa-file' };
            return '<tr data-id="' + esc(l.Submission_ID) + '">' +
                '<td class="ld-when">' + fmtWhen(l.Submitted_At) + '</td>' +
                '<td class="ld-id">' + esc(l.Submission_ID) + '</td>' +
                '<td><div class="ld-contact-name">' + esc(l.Contact_Name || '—') + '</div>' +
                    '<div class="ld-contact-email">' + esc(l.Email || '') + '</div></td>' +
                '<td>' + esc(l.Company || '—') + '</td>' +
                '<td><span class="ld-badge ld-badge--' + esc(l.Form_ID) + '" title="' + esc(sourceTitleOf(l)) + '">' +
                    '<i class="fas ' + esc(meta.icon) + '"></i> ' + esc(meta.label) + '</span></td>' +
                '<td>' + esc(l.Sales_Rep || '—') + '</td>' +
                '<td><span class="ld-status ' + statusCls(l.Status) + '">' + esc(l.Status || '—') + '</span></td>' +
                '</tr>';
        }).join('');

        Array.prototype.forEach.call(tbody.querySelectorAll('tr[data-id]'), function (tr) {
            tr.addEventListener('click', function () {
                var lead = state.leads.find(function (l) { return l.Submission_ID === tr.getAttribute('data-id'); });
                if (lead) openDrawer(lead);
            });
        });
    }

    // ---------- drawer ----------

    function closeDrawer() {
        state.current = null;
        document.getElementById('lead-drawer').classList.remove('open');
        document.getElementById('lead-drawer').setAttribute('aria-hidden', 'true');
        document.getElementById('drawer-overlay').hidden = true;
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

    // Known-safe attachment hosts: our proxy's Caspio-file server (QRQ logo
    // uploads live there as "Name.ext — https://…/api/files/<key>" text) and
    // JotForm uploads. ONLY these are surfaced as attachments — never arbitrary
    // customer-typed URLs (lead data is untrusted).
    function extractFileUrls(text) {
        var filesBase = DashPage.apiUrl('/api/files/');
        var s = String(text || '');
        var out = [];
        var re = /https:\/\/\S+/g;
        var m;
        while ((m = re.exec(s))) {
            var u = m[0].replace(/[),.;'"\]]+$/, '');
            var allowed = /^https:\/\/((www\.)?jotform\.com\/uploads\/|files\.jotform\.com\/)/i.test(u) || u.indexOf(filesBase) === 0;
            if (!allowed) continue;
            // QRQ format "NWE LOGO.webp — https://…" → keep the human filename
            var before = s.slice(0, m.index).replace(/[\s—–-]+$/, '');
            var nm = before.split(/[|;,\n]/).pop().trim();
            if (!/\.[a-z0-9]{2,5}$/i.test(nm)) nm = '';
            out.push({ url: u, name: nm });
        }
        return out;
    }

    function fileBasename(u) {
        try { return decodeURIComponent(String(u).split('?')[0].split('/').pop() || ''); }
        catch (e) { return String(u).split('/').pop() || ''; }
    }

    function openDrawer(lead) {
        state.current = lead;
        var payload = payloadOf(lead);
        var choices = STATUS_CHOICES[lead.Form_ID] || STATUS_CHOICES['jotform-lead'];
        if (lead.Status && choices.indexOf(lead.Status) === -1) choices = choices.concat([lead.Status]);
        var reps = REPS.slice();
        if (lead.Sales_Rep && reps.indexOf(lead.Sales_Rep) === -1) reps.push(lead.Sales_Rep);

        document.getElementById('drawer-title').textContent = lead.Contact_Name || lead.Company || lead.Submission_ID;
        document.getElementById('drawer-sub').textContent =
            (lead.Company || '') + ' · ' + sourceTitleOf(lead) + ' · ' + fmtWhen(lead.Submitted_At);

        var contactRows = [
            ['Email', lead.Email ? '<a href="mailto:' + esc(lead.Email) + '">' + esc(lead.Email) + '</a>' : '—'],
            ['Phone', lead.Phone ? '<a href="tel:' + esc(lead.Phone) + '">' + esc(lead.Phone) + '</a>' : '—'],
            ['Lead ID', '<span class="ld-id">' + esc(lead.Submission_ID) + '</span>'],
        ];

        var entries = payloadEntries(payload);

        var artworkHtml = '';
        var atts = (payload.artworkUrls || []).map(function (u) { return { url: u, name: '' }; });
        entries.forEach(function (p) { atts = atts.concat(extractFileUrls(p[1])); });
        var seenUrls = {};
        atts = atts.filter(function (a) {
            a.url = safeHttpUrl(a.url);
            if (!a.url || seenUrls[a.url]) return false;
            seenUrls[a.url] = true;
            return true;
        });
        var urls = atts.map(function (a) { return a.url; });
        var jfUrl = safeHttpUrl((payload._source || {}).url || '');
        if (urls.length || jfUrl) {
            // JotForm upload links need a JotForm login — route them through the
            // staff passthrough so attachments open (and preview) in-app.
            var isJfUpload = function (u) { return /^https:\/\/((www\.)?jotform\.com\/uploads\/|files\.jotform\.com\/)/i.test(u); };
            var viewUrl = function (u) { return isJfUpload(u) ? DashPage.apiUrl('/api/jotform/file?u=' + encodeURIComponent(u)) : u; };
            // /api/files/<key> URLs are extensionless — try them as thumbnails
            // too; non-images get hidden by the onerror wiring after render.
            var filesBase = DashPage.apiUrl('/api/files/');
            var isImage = function (u) { return /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(u) || u.indexOf(filesBase) === 0; };
            var thumbs = urls.filter(isImage);
            artworkHtml = '<div class="ld-section"><div class="ld-section-title">Artwork & Source</div>' +
                (thumbs.length ? '<div class="ld-thumbs">' + thumbs.map(function (u) {
                    return '<a href="' + esc(viewUrl(u)) + '" target="_blank" rel="noopener noreferrer">' +
                        '<img class="ld-thumb" loading="lazy" alt="Artwork attachment" src="' + esc(viewUrl(u)) + '"></a>';
                }).join('') + '</div>' : '') +
                '<div class="ld-links">' +
                atts.map(function (a, i) {
                    var label = a.name || (isJfUpload(a.url) ? fileBasename(a.url) : '') || ('Attachment ' + (i + 1));
                    var dl = isJfUpload(a.url)
                        ? viewUrl(a.url) + '&download=1'
                        : a.url + (a.url.indexOf('?') >= 0 ? '&' : '?') + 'download=1';
                    return '<span class="ld-att">' +
                        '<a href="' + esc(viewUrl(a.url)) + '" target="_blank" rel="noopener noreferrer">' +
                        '<i class="fas fa-paperclip"></i> ' + esc(label) + '</a>' +
                        '<a class="ld-dl" href="' + esc(dl) + '" title="Download ' + esc(label) + '" aria-label="Download ' + esc(label) + '">' +
                        '<i class="fas fa-download"></i></a></span>';
                }).join('') +
                (jfUrl ? '<a href="' + esc(jfUrl) + '" target="_blank" rel="noopener noreferrer">' +
                    '<i class="fas fa-arrow-up-right-from-square"></i> View in JotForm</a>' : '') +
                '</div></div>';
        }

        var detailsHtml = entries.length
            ? '<div class="ld-section"><div class="ld-section-title">Submitted Details</div><dl class="ld-kv">' +
                entries.map(function (p) {
                    return '<dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd>';
                }).join('') + '</dl></div>'
            : '';

        document.getElementById('drawer-body').innerHTML =
            '<div class="ld-section"><div class="ld-controls">' +
                '<div class="ld-control"><label class="ld-control-label" for="drawer-status">Status</label>' +
                '<select id="drawer-status" class="ld-select">' +
                    choices.map(function (s) {
                        return '<option value="' + esc(s) + '"' + (s === lead.Status ? ' selected' : '') + '>' + esc(s) + '</option>';
                    }).join('') + '</select></div>' +
                '<div class="ld-control"><label class="ld-control-label" for="drawer-rep">Assigned rep</label>' +
                '<select id="drawer-rep" class="ld-select">' +
                    '<option value="">(unassigned)</option>' +
                    reps.map(function (r) {
                        return '<option value="' + esc(r) + '"' + (r === lead.Sales_Rep ? ' selected' : '') + '>' + esc(r) + '</option>';
                    }).join('') + '</select></div>' +
            '</div></div>' +
            (lead.Summary ? '<div class="ld-section"><div class="ld-section-title">Project</div>' +
                '<div class="ld-summary">' + esc(lead.Summary) + '</div></div>' : '') +
            '<div class="ld-section"><div class="ld-section-title">Contact</div><dl class="ld-kv">' +
                contactRows.map(function (p) { return '<dt>' + esc(p[0]) + '</dt><dd>' + p[1] + '</dd>'; }).join('') +
            '</dl></div>' +
            '<div class="ld-section"><div class="ld-section-title">ShopWorks Customer</div><div id="match-root" class="ld-muted">Checking…</div></div>' +
            '<div class="ld-section"><div class="ld-section-title">Order History</div><div id="orders-root" class="ld-muted"></div></div>' +
            detailsHtml +
            artworkHtml;

        // Hide thumbnail slots that turn out not to be images (extensionless
        // /api/files/ keys can be PDFs) — no inline handlers, wired post-render.
        Array.prototype.forEach.call(document.querySelectorAll('#drawer-body img.ld-thumb'), function (img) {
            img.addEventListener('error', function () {
                if (img.parentNode) img.parentNode.style.display = 'none';
            });
        });

        document.getElementById('drawer-status').addEventListener('change', function () {
            saveField(lead, 'Status', this.value, this);
        });
        document.getElementById('drawer-rep').addEventListener('change', function () {
            saveField(lead, 'Sales_Rep', this.value, this);
        });

        renderMatchSection(lead);
        renderOrdersSection(lead);

        document.getElementById('lead-drawer').classList.add('open');
        document.getElementById('lead-drawer').setAttribute('aria-hidden', 'false');
        document.getElementById('drawer-overlay').hidden = false;
    }

    function saveField(lead, field, value, selectEl) {
        var prev = lead[field];
        var body = { Updated_By: state.staffEmail || 'leads-page' };
        body[field] = value;
        if (selectEl) selectEl.disabled = true;
        crmFetch('/' + encodeURIComponent(lead.Submission_ID), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).then(function () {
            lead[field] = value;
            renderStats();
            renderFilters();
            renderTable();
        }).catch(function (err) {
            console.error('[leads] save failed:', err);
            DashPage.showError('Could not save ' + field.replace('_', ' ') + ' (' + err.message + '). Nothing was changed.');
            if (selectEl) selectEl.value = prev || '';
        }).finally(function () {
            if (selectEl) selectEl.disabled = false;
        });
    }

    // ---------- ShopWorks match ----------

    function contactCardHtml(contact, lead) {
        var rows = [
            ['Company', contact.CustomerCompanyName || contact.Company_Name],
            ['Customer #', contact.id_Customer],
            ['AE', contact.CustomerCustomerServiceRep || contact.Sales_Rep],
            ['Tier', contact.Account_Tier],
            ['YTD sales', contact.YTD_Sales != null && contact.YTD_Sales !== '' ? fmtMoney(contact.YTD_Sales) : ''],
            ['Last ordered', contact.Customerdate_LastOrdered ? fmtWhen(contact.Customerdate_LastOrdered) : ''],
        ].filter(function (p) { return p[1] != null && p[1] !== ''; });
        var alreadyLinked = String(lead.Matched_ID_Customer || '') === String(contact.id_Customer || '');
        return '<div class="ld-match ld-match--found">' +
            '<div class="ld-match-head"><span class="ld-pill ld-pill--customer"><i class="fas fa-circle-check"></i> Existing customer</span>' +
            (alreadyLinked
                ? '<span class="ld-muted">Linked</span>'
                : '<button type="button" class="ld-btn" data-link-customer="' + esc(contact.id_Customer) + '">' +
                    '<i class="fas fa-link"></i> Link customer</button>') +
            '</div><dl class="ld-kv">' +
            rows.map(function (p) { return '<dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd>'; }).join('') +
            '</dl></div>';
    }

    function wireLinkButtons(lead) {
        Array.prototype.forEach.call(
            document.querySelectorAll('#match-root [data-link-customer]'),
            function (btn) {
                btn.addEventListener('click', function () {
                    saveField(lead, 'Matched_ID_Customer', btn.getAttribute('data-link-customer'), null);
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-check"></i> Linked';
                    renderOrdersSection(lead, true);
                });
            }
        );
    }

    function searchBlockHtml(placeholder) {
        return '<div class="ld-match-search">' +
            '<input type="search" id="match-search-input" class="ld-search" placeholder="' + esc(placeholder) + '">' +
            '<button type="button" id="match-search-btn" class="ld-btn"><i class="fas fa-magnifying-glass"></i> Search</button>' +
            '</div><div class="ld-match-results" id="match-search-results"></div>';
    }

    function wireSearch(lead) {
        var btn = document.getElementById('match-search-btn');
        var input = document.getElementById('match-search-input');
        if (!btn || !input) return;
        var run = function () {
            var q = input.value.trim();
            if (q.length < 2) return;
            var resultsEl = document.getElementById('match-search-results');
            resultsEl.innerHTML = '<span class="ld-muted">Searching…</span>';
            DashPage.fetchJson('/api/company-contacts/search?q=' + encodeURIComponent(q) + '&limit=8')
                .then(function (body) {
                    var contacts = body.contacts || [];
                    if (!contacts.length) {
                        resultsEl.innerHTML = '<span class="ld-muted">No ShopWorks matches for "' + esc(q) + '".</span>';
                        return;
                    }
                    resultsEl.innerHTML = contacts.map(function (c) {
                        return '<div class="ld-match-result"><span>' +
                            '<strong>' + esc(c.CustomerCompanyName || c.Company_Name || '—') + '</strong> ' +
                            '<span class="ld-muted">#' + esc(c.id_Customer) +
                            (c.CustomerCustomerServiceRep ? ' · ' + esc(c.CustomerCustomerServiceRep) : '') + '</span></span>' +
                            '<button type="button" class="ld-btn" data-link-customer="' + esc(c.id_Customer) + '">Link</button></div>';
                    }).join('');
                    wireLinkButtons(lead);
                })
                .catch(function (err) {
                    resultsEl.innerHTML = '<span class="ld-muted">Search failed (' + esc(err.message) + ').</span>';
                });
        };
        btn.addEventListener('click', run);
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
    }

    function renderMatchSection(lead) {
        var root = document.getElementById('match-root');

        function showProspect(note) {
            root.innerHTML = '<div class="ld-match">' +
                '<div class="ld-match-head"><span class="ld-pill ld-pill--prospect"><i class="fas fa-user-plus"></i> New prospect</span></div>' +
                '<div class="ld-muted">' + esc(note) + '</div>' +
                searchBlockHtml('Search ShopWorks by company or name…') +
                '</div>';
            wireSearch(lead);
        }

        if (lead.Matched_ID_Customer) {
            // Already linked (auto-matched at ingest or by staff) — show the linked customer.
            root.innerHTML = '<div class="ld-match ld-match--found">' +
                '<div class="ld-match-head"><span class="ld-pill ld-pill--customer"><i class="fas fa-circle-check"></i> Existing customer</span>' +
                '<span class="ld-muted">Customer #' + esc(lead.Matched_ID_Customer) + '</span></div>' +
                '<div id="match-linked-detail" class="ld-muted">Loading customer…</div></div>';
            DashPage.fetchJson('/api/company-contacts/by-customer/' + encodeURIComponent(lead.Matched_ID_Customer))
                .then(function (body) {
                    var c = (body.contacts || [])[0];
                    var el = document.getElementById('match-linked-detail');
                    if (!el) return;
                    if (!c) { el.textContent = 'No active contact rows for this customer.'; return; }
                    el.outerHTML = '<dl class="ld-kv">' + [
                        ['Company', c.CustomerCompanyName || c.Company_Name],
                        ['AE', c.CustomerCustomerServiceRep || c.Sales_Rep],
                        ['Tier', c.Account_Tier],
                        ['Last ordered', c.Customerdate_LastOrdered ? fmtWhen(c.Customerdate_LastOrdered) : ''],
                    ].filter(function (p) { return p[1]; })
                        .map(function (p) { return '<dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd>'; }).join('') + '</dl>';
                })
                .catch(function () {
                    var el = document.getElementById('match-linked-detail');
                    if (el) el.textContent = 'Customer detail unavailable right now.';
                });
            return;
        }

        if (!lead.Email) {
            showProspect('No email on this lead — search ShopWorks manually.');
            return;
        }

        var cached = state.matchCache[lead.Email];
        if (cached !== undefined) {
            if (cached) { root.innerHTML = contactCardHtml(cached, lead); wireLinkButtons(lead); }
            else showProspect('No ShopWorks contact with ' + lead.Email + '.');
            return;
        }

        DashPage.fetchJson('/api/company-contacts/by-email/' + encodeURIComponent(lead.Email))
            .then(function (body) {
                state.matchCache[lead.Email] = body.contact || null;
                if (state.current === lead) renderMatchSection(lead);
            })
            .catch(function (err) {
                if (/\b404\b/.test(err.message)) {
                    state.matchCache[lead.Email] = null;
                    if (state.current === lead) renderMatchSection(lead);
                } else {
                    root.innerHTML = '<span class="ld-muted">Customer lookup unavailable (' + esc(err.message) + ').</span>';
                }
            });
    }

    // ---------- order history ----------

    function renderOrdersSection(lead, autoload) {
        var root = document.getElementById('orders-root');
        if (!root) return;
        var custId = parseInt(lead.Matched_ID_Customer, 10);
        if (!isFinite(custId) || custId <= 0) {
            root.innerHTML = '<span class="ld-muted">Link a ShopWorks customer to see their orders.</span>';
            return;
        }
        root.innerHTML = '<button type="button" id="btn-load-orders" class="ld-btn">' +
            '<i class="fas fa-clock-rotate-left"></i> Load recent orders</button>';
        var btn = document.getElementById('btn-load-orders');
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
                    root.innerHTML = '<span class="ld-muted">No orders on file for customer #' + esc(custId) + '.</span>';
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
                console.error('[leads] order history failed:', err);
                root.innerHTML = '<span class="ld-muted">Order history unavailable (' + esc(err.message) + ').</span>';
            });
        };
        btn.addEventListener('click', load);
        if (autoload) load();
    }
})();
