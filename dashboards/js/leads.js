/**
 * leads.js — controller for dashboards/leads.html (Leads CRM board)
 *
 * One board for every lead source: the 6 JotForm website forms (ingested by
 * the proxy as Form_ID='jotform-lead') + the in-app Quote Request / Webstore
 * Inquiry / Team Roster forms — all rows in Caspio Form_Submissions.
 *
 * Shared vocabulary/helpers live in dashboards/js/leads-common.js
 * (window.LeadsCommon) — also used by the lead workspace (lead.html).
 *
 * Data paths: rows + status/rep/date/value writes → SAME-ORIGIN session-gated
 * /api/crm-proxy/form-submissions*; ShopWorks match → public proxy
 * /api/company-contacts/*; order history → /api/crm-proxy/order-odbc*;
 * timeline appends → /api/crm-proxy/lead-activity*.
 * NO POLLING — loads on open + the Refresh button (Caspio quota rule).
 * Every rendered value passes esc() — lead fields are attacker-controlled.
 */
(function () {
    'use strict';

    var L = window.LeadsCommon;
    var esc = L.esc, fmtWhen = L.fmtWhen, fmtMoney = L.fmtMoney;

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
        loadSeq: 0,             // in-flight guard: only the newest loadLeads wins
        drawerReturnFocus: null,// element to restore focus to when the drawer closes
        perms: [],              // staff permissions (from /api/crm-session/me) — gates Delete
        view: (function () {    // board default on desktop, list on narrow; persisted
            try { var v = localStorage.getItem('nwca-leads-view'); if (v) return v; } catch (e) { /* private mode */ }
            return window.innerWidth < 768 ? 'list' : 'board';
        })(),
    };

    // ---------- boot ----------

    document.addEventListener('DOMContentLoaded', function () {
        wireChrome();
        fetch('/api/crm-session/me')
            .then(function (r) { return r.json(); })
            .then(function (me) { state.staffEmail = me.email || ''; state.perms = me.permissions || []; updateMineChip(); })
            .catch(function () { /* Updated_By falls back to 'leads-page' */ });
        loadLeads();
    });

    function isAdmin() { return state.perms.indexOf('admin') !== -1; }

    function updateMineChip() {
        var chip = document.getElementById('filter-mine');
        var mine = L.EMAIL_TO_REP[state.staffEmail];
        chip.hidden = !mine;
        chip.setAttribute('aria-pressed', mine && state.rep === mine ? 'true' : 'false');
    }

    function syncViewToggle() {
        document.getElementById('view-board').setAttribute('aria-pressed', state.view === 'board' ? 'true' : 'false');
        document.getElementById('view-list').setAttribute('aria-pressed', state.view === 'list' ? 'true' : 'false');
    }

    function setView(v) {
        state.view = v;
        try { localStorage.setItem('nwca-leads-view', v); } catch (e) { /* private mode */ }
        renderView();
    }

    function renderView() {
        syncViewToggle();
        var board = document.getElementById('leads-board');
        var listWrap = document.getElementById('leads-list-wrap');
        if (state.view === 'board') { board.hidden = false; listWrap.hidden = true; renderBoard(); }
        else { board.hidden = true; listWrap.hidden = false; renderTable(); }
    }

    // ---------- focus management (a11y) ----------

    function getFocusable(container) {
        return Array.prototype.slice.call(container.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter(function (el) { return el.offsetParent !== null; });
    }

    // Keep Tab inside an open overlay (drawer / modal) — without this, Tab walks
    // out into the dimmed background page (which is not inert), letting a keyboard
    // user operate hidden controls (e.g. Refresh) mid-task.
    function bindFocusTrap(container, isOpen) {
        container.addEventListener('keydown', function (e) {
            if (e.key !== 'Tab' || !isOpen()) return;
            var f = getFocusable(container);
            if (!f.length) return;
            var first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        });
    }

    // Open a lead from a keyboard-activated card/row (Enter or Space).
    function activateOnKey(handler) {
        return function (e) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); handler(); }
        };
    }

    function wireChrome() {
        var drawer = document.getElementById('lead-drawer');
        drawer.setAttribute('inert', '');           // closed drawer must not be tabbable (it's only off-screen via transform)
        bindFocusTrap(drawer, function () { return drawer.classList.contains('open'); });
        bindFocusTrap(document.getElementById('newlead-modal'), function () { return !document.getElementById('newlead-modal').hidden; });
        document.getElementById('btn-refresh').addEventListener('click', loadLeads);
        document.getElementById('btn-export').addEventListener('click', exportCurrentView);
        document.getElementById('filter-archived').addEventListener('change', function () {
            state.includeArchived = this.checked;
            loadLeads();
        });
        [['filter-source', 'source'], ['filter-status', 'status'], ['filter-rep', 'rep']].forEach(function (pair) {
            document.getElementById(pair[0]).addEventListener('change', function () {
                state[pair[1]] = this.value;
                updateMineChip();
                renderView();
            });
        });
        document.getElementById('filter-search').addEventListener('input', function () {
            state.search = this.value.trim().toLowerCase();
            renderView();
        });
        document.getElementById('view-board').addEventListener('click', function () { setView('board'); });
        document.getElementById('view-list').addEventListener('click', function () { setView('list'); });
        document.getElementById('filter-mine').addEventListener('click', function () {
            var mine = L.EMAIL_TO_REP[state.staffEmail];
            if (!mine) return;
            state.rep = (state.rep === mine) ? '' : mine;
            document.getElementById('filter-rep').value = state.rep;
            updateMineChip();
            renderView();
        });
        document.getElementById('drawer-close').addEventListener('click', closeDrawer);
        document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);
        document.getElementById('btn-new-lead').addEventListener('click', openNewLead);
        document.getElementById('newlead-close').addEventListener('click', closeNewLead);
        document.getElementById('newlead-overlay').addEventListener('click', closeNewLead);
        document.getElementById('newlead-save').addEventListener('click', saveNewLead);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { closeDrawer(); closeNewLead(); }
        });
    }

    // ---------- new-lead modal (manual phone / walk-in capture) ----------

    function openNewLead() {
        var repSel = document.getElementById('nl-rep');
        repSel.innerHTML = L.REPS.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('');
        repSel.value = L.EMAIL_TO_REP[state.staffEmail] || 'Taneisha Clark';
        if (!repSel.value) repSel.value = L.REPS[0];
        document.getElementById('newlead-status').textContent = '';
        document.getElementById('newlead-overlay').hidden = false;
        document.getElementById('newlead-modal').hidden = false;
        document.getElementById('nl-name').focus();
    }

    function closeNewLead() {
        var wasOpen = !document.getElementById('newlead-modal').hidden;
        document.getElementById('newlead-overlay').hidden = true;
        document.getElementById('newlead-modal').hidden = true;
        if (wasOpen) document.getElementById('btn-new-lead').focus(); // a11y: return focus
    }

    function saveNewLead() {
        var name = document.getElementById('nl-name').value.trim();
        var summary = document.getElementById('nl-summary').value.trim();
        var statusEl = document.getElementById('newlead-status');
        if (!name || !summary) {
            statusEl.textContent = 'Contact name and “what they want” are required.';
            return;
        }
        var company = document.getElementById('nl-company').value.trim();
        var source = document.getElementById('nl-source').value;
        var rep = document.getElementById('nl-rep').value;
        var value = document.getElementById('nl-value').value.trim();
        var due = document.getElementById('nl-due').value;
        var btn = document.getElementById('newlead-save');
        btn.disabled = true;
        statusEl.textContent = 'Saving…';

        var body = {
            formId: 'manual-lead',
            contactName: name,
            company: company || ('Individual — ' + name),
            email: document.getElementById('nl-email').value.trim(),
            phone: document.getElementById('nl-phone').value.trim(),
            summary: summary.slice(0, 250),
            salesRep: rep,
            payload: {
                fields: [
                    ['How they reached us', source],
                    ['What they want', summary],
                    ['Logged by', state.staffEmail || 'staff'],
                ],
            },
        };
        if (due) body.dueDateIso = due;

        fetch(DashPage.apiUrl('/api/form-submissions'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).then(function (resp) {
            return resp.json().catch(function () { return {}; }).then(function (b) {
                if (!resp.ok) throw new Error((b && b.error) || ('HTTP ' + resp.status));
                return b;
            });
        }).then(function (created) {
            var id = created.submissionId;
            L.logActivity(id, 'system', 'Logged manually (' + source + ') by ' + (state.staffEmail || 'staff'), '', state.staffEmail);
            var finish = function () {
                closeNewLead();
                ['nl-name', 'nl-company', 'nl-email', 'nl-phone', 'nl-summary', 'nl-value', 'nl-due'].forEach(function (fid) {
                    document.getElementById(fid).value = '';
                });
                // Reuse the deep-link path so the fresh lead opens in the drawer.
                state.hashOpened = false;
                location.hash = encodeURIComponent(id);
                loadLeads();
            };
            var v = Number(value);
            if (value && isFinite(v) && v > 0) {
                L.crmFetch('/' + encodeURIComponent(id), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ Lead_Value: String(v), Updated_By: state.staffEmail || 'leads-page' }),
                }).then(finish, function (err) {
                    // The lead itself was created; only the value write failed.
                    // Don't swallow it (the modal would close as if all saved).
                    console.error('[leads] new-lead value save failed:', err);
                    finish();
                    DashPage.showError('Lead created, but its estimated value ($' + v + ') did not save (' + err.message + '). Open the lead to add it.');
                });
            } else finish();
        }).catch(function (err) {
            console.error('[leads] manual lead save failed:', err);
            statusEl.textContent = 'Could not save: ' + err.message;
        }).finally(function () { btn.disabled = false; });
    }

    // ---------- data ----------

    function loadLeads() {
        DashPage.hideError();
        // Reloading replaces every lead object, so a drawer left open would hold a
        // stale, orphaned row (saves would render pre-edit values). Close it first.
        closeDrawer();
        var tbody = document.getElementById('leads-tbody');
        tbody.innerHTML = '<tr><td colspan="7" class="ld-empty dash-loading">Loading leads…</td></tr>';

        // Fetch the full set (proxy hard-caps at 2000). ~1,066 non-archived +
        // ~700 archived both fit, so the board shows every lead and the count
        // tiles + column totals are accurate. Loads once on open/refresh — no
        // polling (Caspio quota). If leads ever exceed 2000, the cap-warning
        // below fires honestly and we trim old terminal leads server-side.
        var limit = 2000;
        var params = new URLSearchParams();
        params.set('formIds', L.LEAD_FORM_IDS.join(','));
        params.set('limit', String(limit));
        if (!state.includeArchived) params.set('statusNot', 'Archived');

        // In-flight guard: toggling Show-archived / hammering Refresh fires
        // overlapping GETs of different sizes; only the newest may win.
        var seq = ++state.loadSeq;
        L.crmFetch('?' + params.toString()).then(function (body) {
            if (seq !== state.loadSeq) return; // superseded by a newer load
            state.leads = body.submissions || [];
            renderFilters();
            renderStats();
            renderView();
            // The server hard-caps the result set; at the cap, older leads are
            // silently omitted — say so rather than pretend this is everything.
            if (state.leads.length >= limit) {
                DashPage.showError('Showing the ' + state.leads.length + ' most recent leads — older ones are not loaded. Narrow with filters/search, or export for the full set.');
            }
            // Deep link (e.g. from the AE emails): /dashboards/leads.html#JFL0718-1234
            var wantId = '';
            try { wantId = decodeURIComponent((location.hash || '').slice(1)); }
            catch (_) { wantId = (location.hash || '').slice(1); } // malformed % — use raw
            if (wantId && !state.hashOpened) {
                var hit = state.leads.find(function (l) { return l.Submission_ID === wantId; });
                if (hit) { state.hashOpened = true; openDrawer(hit); }       // latch only once opened
                else if (!state.includeArchived) {
                    DashPage.showError('Lead ' + wantId + ' isn\'t in the active list — turn on "Show archived" to look for it.');
                } else {
                    state.hashOpened = true; // archived included and still missing — don't nag every reload
                    DashPage.showError('Lead ' + wantId + ' was not found (it may have been deleted).');
                }
            }
        }).catch(function (err) {
            if (seq !== state.loadSeq) return;
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
            else if (L.PIPELINE_STATUSES.indexOf(l.Status) !== -1) pipeline += 1;
            if (L.WON_STATUSES.indexOf(l.Status) !== -1) won += 1;
        });
        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-new').textContent = fresh;
        document.getElementById('stat-pipeline').textContent = pipeline;
        document.getElementById('stat-won').textContent = won;
    }

    // Rebuilds a filter <select> and returns the value it actually holds after —
    // '' when the prior selection no longer exists in the new option set. The
    // caller MUST write that back to state (else the view keeps filtering by a
    // value the dropdown no longer shows → phantom "0 leads" the user can't clear).
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
        return sel.value;
    }

    function renderFilters() {
        var sources = [];
        ['quote-request', 'webstore-request', 'team-roster', 'manual-lead'].forEach(function (f) {
            sources.push({ value: f, label: L.SOURCE_META[f].label });
        });
        var seenJf = {};
        state.leads.forEach(function (l) {
            if (l.Form_ID !== 'jotform-lead') return;
            var key = l.External_Source || 'jotform';
            if (!seenJf[key]) {
                seenJf[key] = true;
                sources.push({ value: 'jf:' + key, label: L.sourceTitleOf(l) });
            }
        });
        state.source = setOptions('filter-source', state.source, sources);

        var statuses = {};
        state.leads.forEach(function (l) { if (l.Status) statuses[l.Status] = true; });
        state.status = setOptions('filter-status', state.status, Object.keys(statuses).sort().map(function (s) {
            return { value: s, label: s };
        }));

        var reps = {};
        L.REPS.forEach(function (r) { reps[r] = true; });
        state.leads.forEach(function (l) { if (l.Sales_Rep) reps[l.Sales_Rep] = true; });
        var repOptions = Object.keys(reps).map(function (r) { return { value: r, label: r }; });
        repOptions.push({ value: '(unassigned)', label: '(unassigned)' });
        state.rep = setOptions('filter-rep', state.rep, repOptions);
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

    // ---------- CSV export (current view) ----------

    function exportCurrentView() {
        var rows = state.leads.filter(matchesFilters);
        if (!rows.length) { DashPage.showError('Nothing to export — no leads match the current filters.'); return; }
        var cols = [
            ['Lead ID', function (l) { return l.Submission_ID; }],
            ['Received', function (l) { return l.Submitted_At; }],      // raw naive-Pacific string — never append Z
            ['Contact', function (l) { return l.Contact_Name; }],
            ['Company', function (l) { return l.Company; }],
            ['Email', function (l) { return l.Email; }],
            ['Phone', function (l) { return l.Phone; }],
            ['Source', function (l) { return L.sourceTitleOf(l); }],
            ['Rep', function (l) { return l.Sales_Rep; }],
            ['Status', function (l) { return l.Status; }],
            ['Est. Value', function (l) { return l.Lead_Value; }],      // raw number so Excel can sum it
            ['Follow-up', function (l) { return l.Due_Date; }],
            ['Last Updated', function (l) { return l.Updated_At; }],    // proxy for last activity (avoids N+1 Caspio reads)
            ['Hot', function (l) { return L.leadHeat(l).join('; '); }],
            ['ShopWorks #', function (l) { return l.Matched_ID_Customer; }],
            ['Linked Quote', function (l) { return l.Linked_Quote_ID; }],
            ['Summary', function (l) { return l.Summary; }],
        ];
        var lines = [cols.map(function (c) { return L.csvCell(c[0]); }).join(',')];
        rows.forEach(function (l) {
            lines.push(cols.map(function (c) { return L.csvCell(c[1](l)); }).join(','));
        });
        // UTF-8 BOM so Excel decodes accented company/contact names correctly.
        var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'leads-' + (state.includeArchived ? 'all' : 'active') + '-' + L.todayIso() + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
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
            var meta = L.SOURCE_META[l.Form_ID] || { label: l.Form_ID, icon: 'fa-file' };
            var heat = L.leadHeat(l);
            var timer = L.responseTimer(l);
            return '<tr data-id="' + esc(l.Submission_ID) + '" tabindex="0" role="button" aria-label="Open lead ' + esc(l.Contact_Name || l.Company || l.Submission_ID) + '">' +
                '<td class="ld-when">' + fmtWhen(l.Submitted_At) + '</td>' +
                '<td class="ld-id">' + esc(l.Submission_ID) + '</td>' +
                '<td><div class="ld-contact-name">' + esc(l.Contact_Name || '—') + '</div>' +
                    '<div class="ld-contact-email">' + esc(l.Email || '') + '</div></td>' +
                '<td>' + (heat.length ? '<span class="ld-fire" title="Hot lead: ' + esc(heat.join(' · ')) + '">🔥</span> ' : '') +
                    esc(l.Company || '—') + '</td>' +
                '<td><span class="ld-badge ld-badge--' + esc(l.Form_ID) + '" title="' + esc(L.sourceTitleOf(l)) + '">' +
                    '<i class="fas ' + esc(meta.icon) + '"></i> ' + esc(meta.label) + '</span></td>' +
                '<td>' + esc(l.Sales_Rep || '—') + '</td>' +
                '<td><span class="ld-status ' + L.statusCls(l.Status) + '">' + esc(l.Status || '—') + '</span>' +
                    (timer ? ' <span class="ld-timer ld-timer--' + timer.cls + '">' + esc(timer.label) + '</span>' : '') + '</td>' +
                '</tr>';
        }).join('');

        Array.prototype.forEach.call(tbody.querySelectorAll('tr[data-id]'), function (tr) {
            var open = function () {
                var lead = state.leads.find(function (l) { return l.Submission_ID === tr.getAttribute('data-id'); });
                if (lead) openDrawer(lead);
            };
            tr.addEventListener('click', open);
            tr.addEventListener('keydown', activateOnKey(open));
        });
    }

    // ---------- kanban board (P3) ----------

    var COLUMNS = [
        { key: 'new', label: 'New' },
        { key: 'contacted', label: 'Contacted' },
        { key: 'quoted', label: 'Quoted' },
        { key: 'won', label: 'Won' },
        { key: 'lost', label: 'Lost' },
    ];
    var TERMINAL_BOARD_DAYS = 45; // Won/Lost columns show recent only; older stay in the list
    var COL_CAP = 20;             // cards shown per column before the "Show N more" toggle
    var expandedCols = {};        // column key → showing all (else capped at COL_CAP)

    function repInitials(name) {
        return String(name || '').split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
    }

    function ageDays(iso) {
        var t = Date.parse(iso);
        if (isNaN(t)) return '';
        var d = Math.floor((Date.now() - t) / 86400000);
        return d <= 0 ? 'today' : d + 'd';
    }

    function cardHtml(l) {
        var meta = L.SOURCE_META[l.Form_ID] || { icon: 'fa-file', label: l.Form_ID };
        var overdue = L.isOverdue(l.Due_Date);
        var val = Number(l.Lead_Value);
        var heat = L.leadHeat(l);
        var timer = L.responseTimer(l);
        return '<div class="ld-card" draggable="true" data-id="' + esc(l.Submission_ID) + '" tabindex="0" role="button" aria-label="Open lead ' + esc(l.Company || l.Contact_Name || l.Submission_ID) + '" title="' + esc(l.Status || '') + '">' +
            '<div class="ld-card-top"><span class="ld-card-company">' + esc(l.Company || '(no company)') + '</span>' +
            (heat.length ? '<span class="ld-fire" title="Hot lead: ' + esc(heat.join(' · ')) + '">🔥</span>' : '') +
            (overdue ? '<span class="ld-dot" title="Follow-up overdue (' + esc(l.Due_Date) + ')"></span>' : '') + '</div>' +
            '<div class="ld-card-contact">' + esc(l.Contact_Name || '') + '</div>' +
            '<div class="ld-card-meta">' +
            '<span class="ld-card-src" title="' + esc(L.sourceTitleOf(l)) + '"><i class="fas ' + esc(meta.icon) + '"></i></span>' +
            (isFinite(val) && val > 0 ? '<span class="ld-card-val">$' + Math.round(val).toLocaleString('en-US') + '</span>' : '') +
            (timer ? '<span class="ld-timer ld-timer--' + timer.cls + '">' + esc(timer.label) + '</span>' : '') +
            '<span class="ld-card-age">' + esc(ageDays(l.Submitted_At)) + '</span>' +
            (l.Sales_Rep ? '<span class="ld-rep-chip" title="' + esc(l.Sales_Rep) + '">' + esc(repInitials(l.Sales_Rep)) + '</span>' : '') +
            '</div></div>';
    }

    function renderBoard() {
        var rows = state.leads.filter(matchesFilters).filter(function (l) { return l.Status !== 'Archived'; });
        document.getElementById('leads-count').textContent = rows.length + ' of ' + state.leads.length;

        var cutoff = Date.now() - TERMINAL_BOARD_DAYS * 86400000;
        var byCol = { new: [], contacted: [], quoted: [], won: [], lost: [] };
        var olderCount = { won: 0, lost: 0 };
        rows.forEach(function (l) {
            var col = L.STAGE_OF[l.Status];
            if (!col || !byCol[col]) return;
            if (col === 'won' || col === 'lost') {
                var ts = Date.parse(l.Updated_At || l.Submitted_At);
                if (!isNaN(ts) && ts < cutoff) { olderCount[col] += 1; return; }
            }
            byCol[col].push(l);
        });

        // 🔥 leads float to the top of New (stable order within each group).
        var hotNew = [], coldNew = [];
        byCol.new.forEach(function (l) { (L.leadHeat(l).length ? hotNew : coldNew).push(l); });
        byCol.new = hotNew.concat(coldNew);

        var board = document.getElementById('leads-board');
        board.innerHTML = COLUMNS.map(function (c) {
            var items = byCol[c.key];
            var sum = items.reduce(function (acc, l) {
                var n = Number(l.Lead_Value);
                return acc + (isFinite(n) && n > 0 ? n : 0);
            }, 0);
            // Cap each column so tall columns (Won/Lost) don't force endless
            // scrolling — show the first COL_CAP, reveal the rest on demand.
            var expanded = !!expandedCols[c.key];
            var shown = expanded ? items : items.slice(0, COL_CAP);
            var hiddenN = items.length - shown.length;
            var moreBtn = '';
            if (items.length > COL_CAP) {
                moreBtn = '<button type="button" class="ld-col-more" data-col="' + esc(c.key) + '">' +
                    (expanded ? '<i class="fas fa-chevron-up"></i> Show fewer'
                              : '<i class="fas fa-chevron-down"></i> Show ' + hiddenN + ' more') + '</button>';
            }
            return '<div class="ld-col ld-col--' + c.key + '" data-col="' + c.key + '">' +
                '<div class="ld-col-head"><span class="ld-col-title">' + c.label + '</span>' +
                '<span class="ld-col-meta">' + items.length + (sum > 0 ? ' · $' + Math.round(sum).toLocaleString('en-US') : '') + '</span></div>' +
                '<div class="ld-col-body">' +
                shown.map(cardHtml).join('') +
                moreBtn +
                (olderCount[c.key] ? '<div class="ld-col-older">+' + olderCount[c.key] + ' older — see List</div>' : '') +
                (!items.length && !olderCount[c.key] ? '<div class="ld-col-empty">—</div>' : '') +
                '</div></div>';
        }).join('');
        wireBoard();
    }

    var dragId = null;
    function wireBoard() {
        var board = document.getElementById('leads-board');
        Array.prototype.forEach.call(board.querySelectorAll('.ld-card'), function (card) {
            card.addEventListener('dragstart', function (e) {
                dragId = card.getAttribute('data-id');
                card.classList.add('is-dragging');
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    try { e.dataTransfer.setData('text/plain', dragId); } catch (err) { /* IE-ism */ }
                }
            });
            card.addEventListener('dragend', function () { card.classList.remove('is-dragging'); dragId = null; });
            var open = function () {
                var lead = state.leads.find(function (l) { return l.Submission_ID === card.getAttribute('data-id'); });
                if (lead) openDrawer(lead);
            };
            card.addEventListener('click', open);
            card.addEventListener('keydown', activateOnKey(open));
        });
        Array.prototype.forEach.call(board.querySelectorAll('.ld-col-more'), function (b) {
            b.addEventListener('click', function (e) {
                e.stopPropagation();
                var k = b.getAttribute('data-col');
                expandedCols[k] = !expandedCols[k];
                renderBoard();
            });
        });
        Array.prototype.forEach.call(board.querySelectorAll('.ld-col'), function (col) {
            col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('is-drop-over'); });
            col.addEventListener('dragleave', function () { col.classList.remove('is-drop-over'); });
            col.addEventListener('drop', function (e) {
                e.preventDefault();
                col.classList.remove('is-drop-over');
                var id = dragId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
                if (id) moveCard(id, col.getAttribute('data-col'));
            });
        });
    }

    /**
     * Move a lead to a board column — the drop handler AND the harness both
     * come through here. Maps the column to the form's own status via
     * DRAG_STATUS; blocked combos (e.g. Roster → Quoted) explain themselves.
     */
    function moveCard(submissionId, column) {
        var lead = state.leads.find(function (l) { return l.Submission_ID === submissionId; });
        if (!lead) return;
        var mapped = (L.DRAG_STATUS[lead.Form_ID] || {})[column];
        if (!mapped) {
            var label = (L.SOURCE_META[lead.Form_ID] || {}).label || lead.Form_ID;
            DashPage.showError(label + ' leads don\'t have a stage for that column — use the Status menu in the drawer instead.');
            return;
        }
        if (mapped === lead.Status) return;
        saveField(lead, 'Status', mapped, null);
    }
    window.moveCard = moveCard;

    // ---------- drawer ----------

    function closeDrawer() {
        var drawer = document.getElementById('lead-drawer');
        var wasOpen = drawer.classList.contains('open');
        state.current = null;
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
        drawer.setAttribute('inert', '');           // remove off-screen content from the tab order
        document.getElementById('drawer-overlay').hidden = true;
        // Return focus to whatever opened the drawer (a11y: focus must never vanish).
        if (wasOpen && state.drawerReturnFocus && document.body.contains(state.drawerReturnFocus)) {
            try { state.drawerReturnFocus.focus(); } catch (_) { /* element gone */ }
        }
        state.drawerReturnFocus = null;
    }

    function openDrawer(lead) {
        state.drawerReturnFocus = document.activeElement; // restore on close
        state.current = lead;
        var payload = L.payloadOf(lead);
        var choices = L.STATUS_CHOICES[lead.Form_ID] || L.STATUS_CHOICES['jotform-lead'];
        if (lead.Status && choices.indexOf(lead.Status) === -1) choices = choices.concat([lead.Status]);
        var reps = L.REPS.slice();
        if (lead.Sales_Rep && reps.indexOf(lead.Sales_Rep) === -1) reps.push(lead.Sales_Rep);

        document.getElementById('drawer-title').textContent = lead.Contact_Name || lead.Company || lead.Submission_ID;
        document.getElementById('drawer-sub').textContent =
            (lead.Company || '') + ' · ' + L.sourceTitleOf(lead) + ' · ' + fmtWhen(lead.Submitted_At);
        var fullLink = document.getElementById('drawer-open-full');
        if (fullLink) fullLink.href = '/dashboards/lead.html#' + encodeURIComponent(lead.Submission_ID);

        var contactRows = [
            ['Email', lead.Email ? '<a href="mailto:' + esc(lead.Email) + '">' + esc(lead.Email) + '</a>' : '—'],
            ['Phone', lead.Phone ? '<a href="tel:' + esc(lead.Phone) + '">' + esc(lead.Phone) + '</a>' : '—'],
            ['Lead ID', '<span class="ld-id">' + esc(lead.Submission_ID) + '</span>'],
        ];

        var atts = L.collectAttachments(payload);
        var jfUrl = L.safeSourceUrl((payload._source || {}).url || '');
        var artworkHtml = '';
        if (atts.length || jfUrl) {
            var thumbs = atts.map(function (a) { return a.url; }).filter(L.isImageUrl);
            artworkHtml = '<div class="ld-section"><div class="ld-section-title">Artwork & Source</div>' +
                (thumbs.length ? '<div class="ld-thumbs">' + thumbs.map(function (u) {
                    return '<a href="' + esc(L.viewUrl(u)) + '" target="_blank" rel="noopener">' +
                        '<img class="ld-thumb" loading="lazy" alt="Artwork attachment" src="' + esc(L.viewUrl(u)) + '"></a>';
                }).join('') + '</div>' : '') +
                '<div class="ld-links">' +
                atts.map(function (a, i) {
                    var label = a.name || (L.isJfUpload(a.url) ? L.fileBasename(a.url) : '') || ('Attachment ' + (i + 1));
                    return '<span class="ld-att">' +
                        '<a href="' + esc(L.viewUrl(a.url)) + '" target="_blank" rel="noopener">' +
                        '<i class="fas fa-paperclip"></i> ' + esc(label) + '</a>' +
                        '<a class="ld-dl" href="' + esc(L.downloadUrl(a.url)) + '" title="Download ' + esc(label) + '" aria-label="Download ' + esc(label) + '">' +
                        '<i class="fas fa-download"></i></a></span>';
                }).join('') +
                (jfUrl ? '<a href="' + esc(jfUrl) + '" target="_blank" rel="noopener">' +
                    '<i class="fas fa-arrow-up-right-from-square"></i> View in JotForm</a>' : '') +
                '</div></div>';
        }

        var entries = L.payloadEntries(payload);
        var detailsHtml = entries.length
            ? '<div class="ld-section"><div class="ld-section-title">Submitted Details</div><dl class="ld-kv">' +
                entries.map(function (p) {
                    return '<dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd>';
                }).join('') + '</dl></div>'
            : '';

        document.getElementById('drawer-body').innerHTML =
            '<div class="ld-section ld-drawer-actions">' +
                '<button type="button" id="drawer-edit" class="ld-btn"><i class="fas fa-pen"></i> Edit info</button>' +
                (isAdmin() ? '<button type="button" id="drawer-delete" class="ld-btn ld-btn--danger"><i class="fas fa-trash"></i> Delete</button>' : '') +
            '</div>' +
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
                '<div class="ld-control"><label class="ld-control-label" for="drawer-due">Follow-up date</label>' +
                '<input type="date" id="drawer-due" class="ld-select" value="' + esc(lead.Due_Date || '') + '"></div>' +
                '<div class="ld-control"><label class="ld-control-label" for="drawer-value">Est. value $</label>' +
                '<input type="number" id="drawer-value" class="ld-select" min="0" step="50" placeholder="0" value="' + esc(lead.Lead_Value || '') + '"></div>' +
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

        document.getElementById('drawer-edit').addEventListener('click', function () {
            L.openEditLeadModal(lead, { staffEmail: state.staffEmail, onSaved: function () {
                renderStats(); renderFilters(); renderView();
                if (state.current === lead) openDrawer(lead); // repaint the drawer with the new values
            } });
        });
        var delBtn = document.getElementById('drawer-delete');
        if (delBtn) delBtn.addEventListener('click', function () {
            L.deleteLead(lead, { onDeleted: function () {
                state.leads = state.leads.filter(function (l) { return l.Submission_ID !== lead.Submission_ID; });
                closeDrawer();
                renderStats(); renderFilters(); renderView();
            } });
        });
        document.getElementById('drawer-status').addEventListener('change', function () {
            saveField(lead, 'Status', this.value, this);
        });
        document.getElementById('drawer-rep').addEventListener('change', function () {
            saveField(lead, 'Sales_Rep', this.value, this);
        });
        document.getElementById('drawer-due').addEventListener('change', function () {
            saveField(lead, 'Due_Date', this.value, this);
        });
        document.getElementById('drawer-value').addEventListener('change', function () {
            saveField(lead, 'Lead_Value', this.value, this);
        });

        renderMatchSection(lead);
        renderOrdersSection(lead);

        var drawer = document.getElementById('lead-drawer');
        drawer.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
        drawer.removeAttribute('inert');
        document.getElementById('drawer-overlay').hidden = false;
        var closeBtn = document.getElementById('drawer-close');   // move focus into the drawer
        if (closeBtn) closeBtn.focus();
    }

    // Returns a promise resolving true on a confirmed save, false on failure —
    // callers that log activity / flip UI must gate on that (never announce a
    // save before the PUT lands). `selectEl`, when passed, is disabled during the
    // request and reverted to `prev` on failure.
    function saveField(lead, field, value, selectEl) {
        var prev = lead[field];
        var body = { Updated_By: state.staffEmail || 'leads-page' };
        body[field] = value;
        if (selectEl) selectEl.disabled = true;
        return L.crmFetch('/' + encodeURIComponent(lead.Submission_ID), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).then(function () {
            lead[field] = value;
            L.clearHeat(lead); // value / customer-link edits can change the 🔥 badge
            // Timeline breadcrumbs (fire-and-forget) — status + ownership only.
            if (field === 'Status' && value !== prev) {
                L.logActivity(lead.Submission_ID, 'status', 'Status: ' + (prev || '—') + ' → ' + value, '', state.staffEmail);
            } else if (field === 'Sales_Rep' && value !== prev) {
                L.logActivity(lead.Submission_ID, 'system', value ? 'Assigned to ' + value : 'Unassigned', '', state.staffEmail);
            }
            renderStats();
            renderFilters();
            renderView();
            return true;
        }).catch(function (err) {
            console.error('[leads] save failed:', err);
            DashPage.showError('Could not save ' + field.replace(/_/g, ' ') + ' (' + err.message + '). Nothing was changed.');
            if (selectEl) selectEl.value = prev || '';
            return false;
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
                    var custId = btn.getAttribute('data-link-customer');
                    var restore = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Linking…';
                    // Only log the link + flip the button + autoload orders AFTER the
                    // save is confirmed — otherwise a failed PUT leaves a false
                    // "Linked" timeline row and a green checkmark on an unlinked lead,
                    // and the autoload runs before lead.Matched_ID_Customer is set.
                    saveField(lead, 'Matched_ID_Customer', custId, null).then(function (ok) {
                        if (!ok) { btn.disabled = false; btn.innerHTML = restore; return; }
                        L.logActivity(lead.Submission_ID, 'system', 'Linked ShopWorks customer #' + custId, '', state.staffEmail);
                        btn.innerHTML = '<i class="fas fa-check"></i> Linked';
                        renderOrdersSection(lead, true); // lead.Matched_ID_Customer now set → autoload fires
                    });
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
                root.innerHTML = '<span class="ld-muted">Order history unavailable (' + esc(err.message) + '). </span>' +
                    '<button type="button" id="btn-orders-retry" class="ld-btn">Retry</button>';
                var retry = document.getElementById('btn-orders-retry');
                if (retry) retry.addEventListener('click', function () { renderOrdersSection(lead, true); });
            });
        };
        btn.addEventListener('click', load);
        if (autoload) load();
    }
})();
