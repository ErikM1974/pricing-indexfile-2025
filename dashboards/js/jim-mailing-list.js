/**
 * jim-mailing-list.js — controller for dashboards/jim-mailing-list.html
 *
 * The owner's ("Jim's") manual prospect / mailing list. Add / edit / delete
 * companies. Same-origin calls to the SAML-session forwarder
 * /api/crm-proxy/jim-mailing-list* (adds the CRM secret + stamps identity before
 * the proxy's secret-only Prospect_Mailing_List route).
 *
 * Built for an 83-year-old, non-technical user: one form (reused for add AND
 * edit), plain confirmations, big targets. Errors always shown via
 * DashPage.showError — never a silently empty or wrong list.
 *
 * List UX: the whole list loads once, then filters (segment chips), sort, and
 * search run client-side. Rendering is capped (RENDER_STEP) with a "Show more"
 * button so 3,000+ rows don't build 3,000 DOM cards at once.
 */
(function () {
    'use strict';

    var API = '/api/crm-proxy/jim-mailing-list';
    var RENDER_STEP = 100;

    var state = {
        entries: [],       // rows from the API
        search: '',
        category: '',      // '' = all segments, else an exact Category value
        sort: 'company',   // company | city | last | recent
        renderLimit: RENDER_STEP,
        editingId: null,   // PK_ID being edited, or null when adding
        aiImage: null,     // downscaled screenshot data URI staged for extraction
    };

    // form field id → Caspio column (Contact_Name is composed from First/Last on save)
    var FIELD_MAP = {
        'jml-company': 'Company',
        'jml-first': 'First_Name',
        'jml-last': 'Last_Name',
        'jml-address': 'Address',
        'jml-city': 'City',
        'jml-state': 'State',
        'jml-zip': 'Zip',
        'jml-phone': 'Phone',
        'jml-email': 'Email',
        'jml-website': 'Website',
        'jml-source': 'Source',
        'jml-category': 'Category',
        'jml-notes': 'Notes',
    };

    function el(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function displayName(r) {
        return ((r.First_Name || '') + ' ' + (r.Last_Name || '')).trim() || (r.Contact_Name || '');
    }

    document.addEventListener('DOMContentLoaded', function () {
        el('jml-form').addEventListener('submit', onSubmit);
        el('jml-cancel').addEventListener('click', cancelEdit);
        el('jml-search').addEventListener('input', function () {
            state.search = el('jml-search').value.trim().toLowerCase();
            state.renderLimit = RENDER_STEP;
            render();
        });
        el('jml-sort').addEventListener('change', function () {
            state.sort = el('jml-sort').value;
            state.renderLimit = RENDER_STEP;
            render();
        });
        el('jml-chips').addEventListener('click', onChipClick);
        // Delegated — the list is rebuilt on every render(), so listen on the container.
        el('jml-list').addEventListener('click', onListClick);
        el('jml-list').addEventListener('change', onListChange);
        el('jml-export').addEventListener('click', exportMailchimp);
        el('jml-labels').addEventListener('click', printLabels);
        wireAi();
        load();
    });

    var STATUSES = ['Not contacted', 'Mailed', 'Responded', 'Customer', 'Do not mail'];

    // First/Last, deriving from the combined Contact_Name when the split is empty
    // (imported rows). Used by the card, the CSV export, and the Mailchimp sync.
    function splitName(r) {
        var first = (r.First_Name || '').trim(), last = (r.Last_Name || '').trim();
        if (!first && !last && r.Contact_Name) {
            var nm = r.Contact_Name.replace(/\s*\(.*\)\s*$/, '').trim();
            var parts = nm.split(/\s+/);
            first = parts.shift() || '';
            last = parts.join(' ');
        }
        return { first: first, last: last };
    }
    function fmtDate(s) {
        if (!s) return '';
        // Parse a plain YYYY-MM-DD as a LOCAL date (new Date('2026-07-22') is UTC
        // midnight → shows the day before in Pacific). Full datetimes pass through.
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
        var d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
        return isNaN(d.getTime()) ? String(s).slice(0, 10) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    function todayLocal() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    // ── outreach status (per-card dropdown → PUT) ─────────────────────────
    function onListChange(e) {
        var sel = e.target.closest('select.jml-status');
        if (!sel) return;
        var id = sel.getAttribute('data-statusfor');
        var row = state.entries.filter(function (r) { return String(r.PK_ID) === String(id); })[0];
        if (!row) return;
        var val = sel.value;
        var body = { Status: val === 'Not contacted' ? '' : val };
        if (val === 'Mailed' && !row.Last_Mailed_At) body.Last_Mailed_At = todayLocal();
        sel.disabled = true;
        jsonFetch(API + '/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            .then(function () {
                row.Status = body.Status;
                if (body.Last_Mailed_At) row.Last_Mailed_At = body.Last_Mailed_At;
                sel.disabled = false;
                showOk('Marked ' + row.Company + ': ' + val + '.');
                render();
            })
            .catch(function (err) {
                sel.disabled = false;
                sel.value = row.Status || 'Not contacted';
                DashPage.showError('Could not update status: ' + err.message);
            });
    }

    // ── CSV export (Mailchimp-mapped, current filtered view) ──────────────
    function csvCell(v) { v = String(v == null ? '' : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    function downloadBlob(blob, name) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
    function exportMailchimp() {
        var rows = filtered();
        if (!rows.length) { DashPage.showError('Nothing to export in this view — clear your search or filter first.'); return; }
        var headers = ['Email Address', 'First Name', 'Last Name', 'Company', 'Address', 'City', 'State', 'Zip', 'Phone', 'Tags'];
        var lines = [headers.join(',')];
        rows.forEach(function (r) {
            var nm = splitName(r);
            lines.push([r.Email, nm.first, nm.last, r.Company, r.Address, r.City, r.State, r.Zip, r.Phone, r.Category].map(csvCell).join(','));
        });
        var tag = state.category ? state.category.replace(/[^a-z0-9]+/gi, '-').toLowerCase() : 'all';
        // BOM so Excel/Mailchimp read UTF-8 correctly.
        downloadBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }), 'jim-list-' + tag + '.csv');
        showOk('Downloaded ' + rows.length + ' companies as a Mailchimp CSV.');
    }

    // ── printable mailing labels (Avery 5160, current filtered view) ──────
    function printLabels() {
        var rows = filtered().filter(function (r) { return r.Address || r.City; });
        if (!rows.length) { DashPage.showError('No mailing addresses to print in this view.'); return; }
        var cells = rows.map(function (r) {
            var nm = splitName(r), who = (nm.first + ' ' + nm.last).trim();
            var cityz = [[r.City, r.State].filter(Boolean).join(', '), r.Zip].filter(Boolean).join(' ');
            var l = [who, r.Company, r.Address, cityz].filter(Boolean).map(esc);
            return '<div class="lbl">' + l.join('<br>') + '</div>';
        }).join('');
        var html = '<!doctype html><html><head><meta charset="utf-8"><title>Mailing labels</title><style>' +
            '@page{size:letter;margin:0.5in 0.1875in;}body{margin:0;font-family:Arial,Helvetica,sans-serif;}' +
            '.sheet{display:grid;grid-template-columns:repeat(3,2.625in);grid-auto-rows:1in;column-gap:0.125in;}' +
            '.lbl{padding:0.12in 0.2in;font-size:11pt;line-height:1.25;overflow:hidden;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;}' +
            '@media screen{.lbl{outline:1px dashed #ccc;}}</style></head><body>' +
            '<div class="sheet">' + cells + '</div>' +
            '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print();},250);};</scr' + 'ipt></body></html>';
        var w = window.open('', '_blank');
        if (!w) { DashPage.showError('Please allow pop-ups so the labels can open in a new tab to print.'); return; }
        w.document.write(html); w.document.close();
        showOk('Opened ' + rows.length + ' labels in a new tab to print.');
    }

    // ── AI capture (paste text / screenshot → Claude fills the form) ───────
    function wireAi() {
        el('jml-ai-go').addEventListener('click', runAiExtract);
        el('jml-ai-file').addEventListener('change', function () {
            var f = el('jml-ai-file').files && el('jml-ai-file').files[0];
            if (f) stageImage(f);
        });
        el('jml-ai-thumb-clear').addEventListener('click', clearAiImage);
        document.querySelector('.jml-ai-card').addEventListener('paste', function (e) {
            var items = (e.clipboardData && e.clipboardData.items) || [];
            for (var i = 0; i < items.length; i++) {
                if (items[i].type && items[i].type.indexOf('image') === 0) {
                    var blob = items[i].getAsFile();
                    if (blob) { e.preventDefault(); stageImage(blob); return; }
                }
            }
        });
    }

    // Downscale to keep the upload small (fewer tokens, lower cost, under limits),
    // flattening onto white so JPEG doesn't blacken transparent PNG regions.
    function fileToDownscaledDataUrl(file, maxDim, quality) {
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
                URL.revokeObjectURL(url);
                var w = img.naturalWidth || 1, h = img.naturalHeight || 1;
                var scale = Math.min(1, maxDim / Math.max(w, h));
                var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
                var canvas = document.createElement('canvas');
                canvas.width = cw; canvas.height = ch;
                var ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch);
                ctx.drawImage(img, 0, 0, cw, ch);
                try { resolve(canvas.toDataURL('image/jpeg', quality)); }
                catch (err) { reject(err); }
            };
            img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
            img.src = url;
        });
    }

    function stageImage(file) {
        setAiStatus('Getting the screenshot ready…', false);
        fileToDownscaledDataUrl(file, 1400, 0.85)
            .then(function (dataUrl) {
                state.aiImage = dataUrl;
                el('jml-ai-thumb').src = dataUrl;
                el('jml-ai-thumb-wrap').hidden = false;
                setAiStatus('Screenshot ready. Press the button below to read it.', false);
            })
            .catch(function (err) {
                clearAiImage();
                DashPage.showError('That screenshot could not be read: ' + err.message);
            });
    }

    function clearAiImage() {
        state.aiImage = null;
        el('jml-ai-file').value = '';
        el('jml-ai-thumb').removeAttribute('src');
        el('jml-ai-thumb-wrap').hidden = true;
    }

    function setAiStatus(msg, isWarn) {
        var s = el('jml-ai-status');
        if (!msg) { s.hidden = true; s.textContent = ''; return; }
        s.textContent = msg;
        s.classList.toggle('is-warn', !!isWarn);
        s.hidden = false;
    }

    function runAiExtract() {
        DashPage.hideError();
        var text = el('jml-ai-text').value.trim();
        if (!text && !state.aiImage) { setAiStatus('Paste some text or a screenshot first.', true); return; }

        var btn = el('jml-ai-go');
        btn.disabled = true;
        setAiStatus('Reading… this takes a few seconds.', false);

        jsonFetch(API + '/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text || undefined, image: state.aiImage || undefined }),
        }).then(function (data) {
            btn.disabled = false;
            var f = data.fields || {};
            if (!f.company && !f.phone && !f.email && !f.address) {
                setAiStatus('Claude did not find a company in that — you can type it in below instead.', true);
                return;
            }
            fillFormFromAi(f);
            el('jml-ai-text').value = '';
            clearAiImage();
            setAiStatus('✓ Filled in below — please check it, fix anything, then press Save.', false);
            var card = document.querySelector('.jml-form-card');
            window.scrollTo({ top: (card.getBoundingClientRect().top + window.pageYOffset) - 20, behavior: 'smooth' });
        }).catch(function (err) {
            btn.disabled = false;
            setAiStatus('', false);
            DashPage.showError('Could not read that: ' + err.message + ' — please try again.');
        });
    }

    function fillFormFromAi(f) {
        resetForm();
        el('jml-company').value = f.company || '';
        el('jml-first').value = f.first_name || '';
        el('jml-last').value = f.last_name || '';
        el('jml-address').value = f.address || '';
        el('jml-city').value = f.city || '';
        el('jml-state').value = f.state || '';
        el('jml-zip').value = f.zip || '';
        el('jml-phone').value = f.phone || '';
        el('jml-email').value = f.email || '';
        el('jml-website').value = f.website || '';
        el('jml-source').value = 'Found online';
        el('jml-category').value = f.category || '';
        el('jml-notes').value = f.notes || '';
    }

    // ── data ──────────────────────────────────────────────────────────────
    function jsonFetch(url, options) {
        var opts = options || {};
        opts.credentials = 'same-origin';
        return fetch(url, opts).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
                if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
                return j;
            });
        });
    }

    function load() {
        DashPage.hideError();
        el('jml-list').innerHTML = '<div class="jml-loading">Loading your list…</div>';
        jsonFetch(API)
            .then(function (data) {
                state.entries = (data.entries || []).slice();
                render();
            })
            .catch(function (err) {
                el('jml-list').innerHTML = '<div class="jml-empty">Your list could not load.</div>';
                DashPage.showError('Could not load the mailing list: ' + err.message + ' — press Refresh or try again.');
            });
    }

    // ── add / edit ────────────────────────────────────────────────────────
    function onSubmit(e) {
        e.preventDefault();
        DashPage.hideError();

        var body = {};
        Object.keys(FIELD_MAP).forEach(function (fid) { body[FIELD_MAP[fid]] = el(fid).value.trim(); });
        // Keep the legacy combined Contact_Name in sync when a name is present.
        var full = ((body.First_Name || '') + ' ' + (body.Last_Name || '')).trim();
        if (full) body.Contact_Name = full;

        if (!body.Company) {
            DashPage.showError('Please type a company name before saving.');
            el('jml-company').focus();
            return;
        }

        var editing = state.editingId != null;
        var save = el('jml-save');
        save.disabled = true;

        var req = editing
            ? jsonFetch(API + '/' + encodeURIComponent(state.editingId), {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            })
            : jsonFetch(API, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });

        req.then(function () {
            var name = body.Company;
            resetForm();
            showOk((editing ? 'Saved your changes to ' : 'Added ') + name + '.');
            load();
        }).catch(function (err) {
            save.disabled = false;
            DashPage.showError('Could not save: ' + err.message + ' — nothing was changed, please try again.');
        });
    }

    function startEdit(id) {
        var row = state.entries.filter(function (r) { return String(r.PK_ID) === String(id); })[0];
        if (!row) return;
        state.editingId = row.PK_ID;
        Object.keys(FIELD_MAP).forEach(function (fid) { el(fid).value = row[FIELD_MAP[fid]] || ''; });
        // If this row predates the name split, seed First/Last from the combined name.
        if (!row.First_Name && !row.Last_Name && row.Contact_Name) {
            var nm = row.Contact_Name.replace(/\s*\(.*\)\s*$/, '').trim();
            var parts = nm.split(/\s+/);
            el('jml-first').value = parts.shift() || '';
            el('jml-last').value = parts.join(' ');
        }

        el('jml-form-title').innerHTML = '<i class="fas fa-pen" aria-hidden="true"></i> Editing ' + esc(row.Company);
        el('jml-save-text').textContent = 'Save changes';
        el('jml-cancel').hidden = false;
        document.querySelector('.jml-form-card').classList.add('is-editing');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        el('jml-company').focus();
    }

    function cancelEdit() { resetForm(); }

    function resetForm() {
        state.editingId = null;
        el('jml-form').reset();
        el('jml-form-title').innerHTML = '<i class="fas fa-plus-circle" aria-hidden="true"></i> Add a company';
        el('jml-save-text').textContent = 'Save company';
        el('jml-save').disabled = false;
        el('jml-cancel').hidden = true;
        document.querySelector('.jml-form-card').classList.remove('is-editing');
    }

    // ── delete ────────────────────────────────────────────────────────────
    function remove(id) {
        var row = state.entries.filter(function (r) { return String(r.PK_ID) === String(id); })[0];
        if (!row) return;
        if (!window.confirm('Remove ' + row.Company + ' from your list?\n\nThis cannot be undone.')) return;
        DashPage.hideError();
        jsonFetch(API + '/' + encodeURIComponent(id), { method: 'DELETE' })
            .then(function () {
                if (state.editingId != null && String(state.editingId) === String(id)) resetForm();
                showOk('Removed ' + row.Company + '.');
                load();
            })
            .catch(function (err) {
                DashPage.showError('Could not remove ' + row.Company + ': ' + err.message + ' — it is still on your list.');
            });
    }

    function onListClick(e) {
        var btn = e.target.closest('[data-act]');
        if (!btn) return;
        var act = btn.getAttribute('data-act');
        if (act === 'more') { state.renderLimit += RENDER_STEP; render(); return; }
        if (act === 'showall') {
            state.category = ''; state.search = ''; el('jml-search').value = '';
            state.renderLimit = RENDER_STEP; render(); return;
        }
        var id = btn.getAttribute('data-id');
        if (act === 'edit') startEdit(id);
        else if (act === 'delete') remove(id);
    }

    function onChipClick(e) {
        var chip = e.target.closest('[data-cat]');
        if (!chip) return;
        state.category = chip.getAttribute('data-cat') || '';
        state.renderLimit = RENDER_STEP;
        render();
    }

    // ── filtering + sorting ────────────────────────────────────────────────
    function matchesSearch(row) {
        if (!state.search) return true;
        var hay = [row.Company, row.First_Name, row.Last_Name, row.Contact_Name, row.Address, row.City,
            row.State, row.Zip, row.Phone, row.Email, row.Website, row.Source, row.Category, row.Notes]
            .join(' ').toLowerCase();
        return hay.indexOf(state.search) !== -1;
    }
    function matchesCategory(row) {
        return !state.category || (row.Category || '') === state.category;
    }
    function sortRows(rows) {
        var s = state.sort;
        return rows.sort(function (a, b) {
            if (s === 'city') return String(a.City || '').localeCompare(String(b.City || '')) || String(a.Company || '').localeCompare(String(b.Company || ''));
            if (s === 'last') return String(a.Last_Name || 'zzz').localeCompare(String(b.Last_Name || 'zzz')) || String(a.Company || '').localeCompare(String(b.Company || ''));
            if (s === 'recent') return String(b.Created_At || '').localeCompare(String(a.Created_At || '')) || (Number(b.PK_ID) - Number(a.PK_ID));
            return String(a.Company || '').localeCompare(String(b.Company || '')); // company A–Z
        });
    }
    function filtered() {
        return sortRows(state.entries.filter(function (r) { return matchesSearch(r) && matchesCategory(r); }));
    }

    // ── render ────────────────────────────────────────────────────────────
    function render() {
        var total = state.entries.length;
        var rows = filtered();
        var filtering = state.search || state.category;

        el('jml-count').textContent = !total ? ''
            : (filtering ? '(showing ' + rows.length + ' of ' + total + ')'
                : '(' + total + ' ' + (total === 1 ? 'company' : 'companies') + ')');

        renderChips();

        if (!total) {
            el('jml-list').innerHTML = '<div class="jml-empty"><i class="fas fa-inbox" aria-hidden="true"></i>' +
                'Your list is empty. Add your first company using the form above.</div>';
            return;
        }
        if (!rows.length) {
            el('jml-list').innerHTML = '<div class="jml-empty">No companies match your search or filter. ' +
                '<button type="button" class="jml-linkbtn" data-act="showall">Show all</button></div>';
            return;
        }

        var shown = rows.slice(0, state.renderLimit);
        var html = shown.map(entryHtml).join('');
        if (rows.length > state.renderLimit) {
            html += '<button type="button" class="jml-showmore" data-act="more">' +
                'Show more (' + (rows.length - state.renderLimit) + ' more)</button>';
        }
        el('jml-list').innerHTML = html;
    }

    // Segment (Category) filter chips, most common first, each with a count.
    function renderChips() {
        var counts = {};
        state.entries.forEach(function (r) {
            var c = (r.Category || '').trim();
            if (c) counts[c] = (counts[c] || 0) + 1;
        });
        var cats = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });
        var chips = [{ cat: '', label: 'All', n: state.entries.length }];
        cats.forEach(function (c) { chips.push({ cat: c, label: c, n: counts[c] }); });

        el('jml-chips').innerHTML = chips.map(function (c) {
            var active = (state.category || '') === c.cat;
            return '<button type="button" class="jml-chip' + (active ? ' is-active' : '') + '" data-cat="' + esc(c.cat) + '">' +
                esc(c.label) + '<span class="jml-chip-n">' + c.n + '</span></button>';
        }).join('');
    }

    function entryHtml(r) {
        var lines = [];
        var nm = displayName(r);
        if (nm) lines.push(line('fa-user', esc(nm)));

        var cityLine = [r.City && r.State ? r.City + ', ' + r.State : (r.City || r.State || ''), r.Zip].filter(Boolean).join(' ');
        if (r.Address) lines.push(line('fa-location-dot', esc(r.Address)));
        if (cityLine) lines.push(line(r.Address ? '' : 'fa-location-dot', esc(cityLine)));

        if (r.Phone) lines.push(line('fa-phone', '<a href="tel:' + esc(r.Phone.replace(/[^0-9+]/g, '')) + '">' + esc(r.Phone) + '</a>'));
        if (r.Email) lines.push(line('fa-envelope', '<a href="mailto:' + esc(r.Email) + '">' + esc(r.Email) + '</a>'));
        if (r.Website) lines.push(line('fa-globe', '<a href="' + esc(webHref(r.Website)) + '" target="_blank" rel="noopener noreferrer">' + esc(webLabel(r.Website)) + '</a>'));

        var extra = '';
        if (r.Category) extra += '<span class="jml-entry-cat"><i class="fas fa-tag" aria-hidden="true"></i> ' + esc(r.Category) + '</span>';
        if (r.Notes) extra += '<div class="jml-entry-notes">' + esc(r.Notes) + '</div>';
        if (r.Source) extra += '<span class="jml-entry-source"><i class="fas fa-book-open" aria-hidden="true"></i> Found in: ' + esc(r.Source) + '</span>';

        var cur = r.Status || 'Not contacted';
        var statusSel = '<select class="jml-status" data-statusfor="' + esc(r.PK_ID) + '" aria-label="Outreach status for ' + esc(r.Company) + '">' +
            STATUSES.map(function (s) { return '<option' + (s === cur ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>';
        var mailed = r.Last_Mailed_At ? '<span class="jml-lastmailed">Last contacted ' + esc(fmtDate(r.Last_Mailed_At)) + '</span>' : '';
        var footer = '<div class="jml-entry-status"><span class="jml-status-label">Status:</span> ' + statusSel + mailed + '</div>';

        return '<div class="jml-entry' + (cur !== 'Not contacted' ? ' is-' + cur.toLowerCase().replace(/[^a-z]/g, '') : '') + '">' +
            '<div class="jml-entry-main">' +
                '<h3 class="jml-entry-name">' + esc(r.Company) + '</h3>' +
                lines.join('') + extra + footer +
            '</div>' +
            '<div class="jml-entry-actions">' +
                '<button type="button" class="jml-mini-btn jml-edit" data-act="edit" data-id="' + esc(r.PK_ID) + '">' +
                    '<i class="fas fa-pen" aria-hidden="true"></i> Edit</button>' +
                '<button type="button" class="jml-mini-btn jml-delete" data-act="delete" data-id="' + esc(r.PK_ID) + '">' +
                    '<i class="fas fa-trash" aria-hidden="true"></i> Delete</button>' +
            '</div>' +
        '</div>';
    }

    function line(icon, html) {
        return '<div class="jml-entry-line">' + (icon ? '<i class="fas ' + icon + '" aria-hidden="true"></i>' : '<i></i>') + html + '</div>';
    }
    // Website may arrive as "www.foo.com" (no scheme) — add https:// for the link,
    // and show a clean label without the scheme / trailing slash.
    function webHref(u) { var s = String(u == null ? '' : u).trim(); if (!s) return ''; return /^https?:\/\//i.test(s) ? s : 'https://' + s; }
    function webLabel(u) { return String(u == null ? '' : u).trim().replace(/^https?:\/\//i, '').replace(/\/+$/, ''); }

    // ── success confirmation (auto-hides) ─────────────────────────────────
    var okTimer = null;
    function showOk(msg) {
        el('jml-ok-text').textContent = msg;
        el('jml-ok').hidden = false;
        if (okTimer) clearTimeout(okTimer);
        okTimer = setTimeout(function () { el('jml-ok').hidden = true; }, 4000);
    }
})();
