/* Transfer Detail Page Controller
 *
 * URL: /pages/transfer-detail.html?id=ST-YYMMDD-####
 *
 * Fetches a single Transfer_Orders record + notes. Renders the full detail view.
 * Status-driven action buttons let Bradley/Michaela progress the transfer through:
 *   Requested → Ordered → PO_Created → Shipped → Received
 * Side paths: Rush toggle, Cancel, On Hold.
 *
 * User identity: captured via a one-time modal, stored in localStorage as
 * transfer_user_email / transfer_user_name. Sent as `author`/`authorName` on all writes.
 *
 * Dependencies: bradley-transfers.css (theme + badges + modal + toast), transfer-detail.css
 * API: caspio-pricing-proxy /api/transfer-orders/:id (+ /status, /rush, etc.)
 */

(function () {
    'use strict';

    // ── Config ───────────────────────────────────────────────────────
    var API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // ── State ────────────────────────────────────────────────────────
    var state = {
        transferId: null,
        record: null,
        notes: [],
        user: null // { email, name }
    };

    // ── Helpers ──────────────────────────────────────────────────────
    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function qs(name) {
        var params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    function isRush(rec) {
        if (!rec) return false;
        return rec.Is_Rush === true || rec.Is_Rush === 'true' || rec.Is_Rush === 'Yes' || rec.Is_Rush === 1;
    }

    function normalizeDate(dateStr) {
        if (!dateStr) return null;
        // Caspio strips Z suffix — append if missing
        return dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(normalizeDate(dateStr));
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit'
        });
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(normalizeDate(dateStr));
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatAge(dateStr) {
        if (!dateStr) return '';
        var d = new Date(normalizeDate(dateStr));
        var hours = (Date.now() - d.getTime()) / (1000 * 60 * 60);
        if (hours < 1) return 'just now';
        if (hours < 24) return Math.floor(hours) + 'h ago';
        var days = Math.floor(hours / 24);
        return days === 1 ? '1 day ago' : days + ' days ago';
    }

    function statusBadgeClass(status) {
        var map = {
            'Requested': 'bt-badge--requested',
            'Ordered': 'bt-badge--ordered',
            'PO_Created': 'bt-badge--po',
            'Shipped': 'bt-badge--shipped',
            'Received': 'bt-badge--received',
            'Cancelled': 'bt-badge--cancelled',
            'On_Hold': 'bt-badge--hold'
        };
        return map[status] || 'bt-badge--cancelled';
    }

    function statusLabel(status) {
        if (status === 'PO_Created') return 'PO Created';
        if (status === 'On_Hold') return 'On Hold';
        return status || 'Unknown';
    }

    function showToast(msg, type) {
        var container = $('bt-toast-container');
        var toast = document.createElement('div');
        toast.className = 'bt-toast bt-toast--' + (type || 'info');
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(function () {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity .3s';
            setTimeout(function () { toast.remove(); }, 300);
        }, 4000);
    }

    // ── API ──────────────────────────────────────────────────────────
    async function apiGet(path) {
        var resp = await fetch(API_BASE + path);
        if (!resp.ok) {
            if (resp.status === 404) throw new Error('NOT_FOUND');
            throw new Error('HTTP ' + resp.status);
        }
        var data = await resp.json();
        if (!data.success) throw new Error(data.error || 'API returned success=false');
        return data;
    }

    async function apiPut(path, body) {
        var resp = await fetch(API_BASE + path, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        var data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.error || 'HTTP ' + resp.status);
        return data;
    }

    async function apiPost(path, body) {
        var resp = await fetch(API_BASE + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        var data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.error || 'HTTP ' + resp.status);
        return data;
    }

    async function apiDelete(path, body) {
        var resp = await fetch(API_BASE + path, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        var data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.error || 'HTTP ' + resp.status);
        return data;
    }

    // ── User Identity ────────────────────────────────────────────────
    function loadUser() {
        var email = localStorage.getItem('transfer_user_email');
        var name = localStorage.getItem('transfer_user_name');
        if (email && name) {
            state.user = { email: email, name: name };
            $('td-user-display').textContent = name;
        }
        return state.user;
    }

    function saveUser(name, email) {
        localStorage.setItem('transfer_user_email', email);
        localStorage.setItem('transfer_user_name', name);
        state.user = { email: email, name: name };
        $('td-user-display').textContent = name;
    }

    function ensureUserIdentified() {
        if (state.user) return Promise.resolve(state.user);
        return new Promise(function (resolve) {
            var modal = $('td-user-modal');
            var form = $('td-user-form');
            modal.style.display = 'flex';
            function onSubmit(e) {
                e.preventDefault();
                var formData = new FormData(form);
                var name = formData.get('userName').trim();
                var email = formData.get('userEmail').trim();
                if (!name || !email) return;
                saveUser(name, email);
                modal.style.display = 'none';
                form.removeEventListener('submit', onSubmit);
                resolve(state.user);
            }
            form.addEventListener('submit', onSubmit);
        });
    }

    function promptChangeUser() {
        var modal = $('td-user-modal');
        var form = $('td-user-form');
        form.reset();
        if (state.user) {
            form.querySelector('[name="userName"]').value = state.user.name;
            form.querySelector('[name="userEmail"]').value = state.user.email;
        }
        modal.style.display = 'flex';
        var onSubmit = function (e) {
            e.preventDefault();
            var fd = new FormData(form);
            saveUser(fd.get('userName').trim(), fd.get('userEmail').trim());
            modal.style.display = 'none';
            form.removeEventListener('submit', onSubmit);
            showToast('Identity updated.', 'success');
        };
        form.addEventListener('submit', onSubmit);
    }

    // ── Rendering ────────────────────────────────────────────────────
    function renderAll() {
        var r = state.record;

        // Header card
        var headerCard = document.querySelector('.td-header-card');
        headerCard.classList.toggle('td-rush', isRush(r));
        $('td-id').textContent = r.ID_Transfer || '';
        $('td-company').textContent = r.Company_Name || 'No company';
        var subtitleParts = [];
        if (r.Design_Number) subtitleParts.push('Design #' + r.Design_Number);
        if (r.Customer_Name) subtitleParts.push(r.Customer_Name);
        $('td-subtitle').textContent = subtitleParts.join(' · ');

        // Header badges
        var badgesHtml = '<span class="bt-badge ' + statusBadgeClass(r.Status) + '" style="font-size:13px; padding:5px 14px;">' +
                         escapeHtml(statusLabel(r.Status)) + '</span>';
        if (isRush(r)) {
            badgesHtml += '<span class="bt-badge bt-badge--rush" style="font-size:12px;"><i class="fas fa-bolt"></i> RUSH</span>';
        }
        $('td-header-badges').innerHTML = badgesHtml;

        // Header meta
        $('td-header-meta').innerHTML =
            '<div class="td-meta-item"><span class="td-meta-label">Requested By</span><span class="td-meta-value">' + escapeHtml(r.Requested_By || '—') + '</span></div>' +
            '<div class="td-meta-item"><span class="td-meta-label">Requested</span><span class="td-meta-value" title="' + escapeHtml(formatDateTime(r.Requested_At)) + '">' + escapeHtml(formatAge(r.Requested_At)) + '</span></div>' +
            '<div class="td-meta-item"><span class="td-meta-label">Sales Rep</span><span class="td-meta-value">' + escapeHtml(r.Sales_Rep_Name || r.Sales_Rep_Email || '—') + '</span></div>' +
            (r.Needed_By_Date ? '<div class="td-meta-item"><span class="td-meta-label">Needed By</span><span class="td-meta-value">' + escapeHtml(formatDate(r.Needed_By_Date)) + '</span></div>' : '') +
            (r.Rush_Reason ? '<div class="td-meta-item"><span class="td-meta-label">Rush Reason</span><span class="td-meta-value">' + escapeHtml(r.Rush_Reason) + '</span></div>' : '');

        renderArtworkPanel();
        renderSpecsPanel();
        renderTrackingPanel();
        renderActionsPanel();
        renderTimeline();
    }

    function renderArtworkPanel() {
        var r = state.record;
        var panel = $('td-artwork-panel');

        // Collect up to 3 files (primary + 2 additional)
        var files = [];
        if (r.Working_File_URL) {
            files.push({
                url: r.Working_File_URL,
                name: r.Working_File_Name || 'Primary file',
                type: r.Working_File_Type || '',
                label: 'Primary'
            });
        }
        if (r.Additional_File_1_URL) {
            files.push({
                url: r.Additional_File_1_URL,
                name: r.Additional_File_1_Name || 'Additional file 1',
                type: '',
                label: 'Additional 1'
            });
        }
        if (r.Additional_File_2_URL) {
            files.push({
                url: r.Additional_File_2_URL,
                name: r.Additional_File_2_Name || 'Additional file 2',
                type: '',
                label: 'Additional 2'
            });
        }

        if (files.length === 0) {
            panel.innerHTML = '<div class="td-empty-panel">No working files attached. Only Steve can attach files via the "Send to Supacolor" button on the mockup or his dashboard.</div>';
            return;
        }

        var html = '';
        files.forEach(function (f, idx) {
            var isImage = /\.(jpe?g|png|gif|webp)$/i.test(f.name);
            html += '<div class="td-artwork-file-group" style="margin-bottom:' + (idx < files.length - 1 ? '12px' : '0') + ';">';
            if (isImage) {
                html += '<img src="' + escapeHtml(f.url) + '" alt="' + escapeHtml(f.name) + '" class="td-artwork-preview" onerror="this.style.display=\'none\';">';
            }
            html += '<div class="td-artwork-file">' +
                        '<div style="flex:1; min-width:0;">' +
                            '<div class="td-artwork-filename">' +
                                '<span class="td-artwork-badge">' + escapeHtml(f.label) + '</span> ' +
                                escapeHtml(f.name) +
                            '</div>' +
                            (f.type ? '<div class="td-artwork-meta">' + escapeHtml(f.type) + '</div>' : '') +
                        '</div>' +
                        '<div class="td-artwork-actions">' +
                            '<a href="' + escapeHtml(f.url) + '" target="_blank" rel="noopener" class="bt-btn bt-btn--secondary bt-btn--small">' +
                                '<i class="fas fa-external-link-alt"></i> Open' +
                            '</a>' +
                        '</div>' +
                    '</div>' +
                    '</div>';
        });
        panel.innerHTML = html;
    }

    function renderSpecsPanel() {
        var r = state.record;
        var parts = [];
        parts.push('<dl class="td-specs-grid">');
        parts.push('<dt>Quantity</dt><dd>' + escapeHtml(r.Quantity || '—') + '</dd>');
        parts.push('<dt>Transfer Size</dt><dd>' + escapeHtml(r.Transfer_Size || '—') +
            (r.Transfer_Width_In || r.Transfer_Height_In ?
                ' <span style="color:#6b7280; font-size:12px;">(' +
                (r.Transfer_Width_In || '?') + '&quot; × ' + (r.Transfer_Height_In || '?') + '&quot;)</span>'
                : '') + '</dd>');
        parts.push('<dt>Press Count</dt><dd>' + escapeHtml(r.Press_Count || '—') + '</dd>');
        if (r.Needed_By_Date) parts.push('<dt>Needed By</dt><dd>' + escapeHtml(formatDate(r.Needed_By_Date)) + '</dd>');
        parts.push('</dl>');

        if (r.File_Notes) {
            parts.push('<div class="td-specs-notes"><strong>File Notes</strong>' + escapeHtml(r.File_Notes) + '</div>');
        }
        if (r.Special_Instructions) {
            parts.push('<div class="td-specs-notes" style="background:#eff6ff; border-left-color:#3b82f6;"><strong style="color:#1e40af;">Special Instructions</strong>' + escapeHtml(r.Special_Instructions) + '</div>');
        }
        $('td-specs-panel').innerHTML = parts.join('');
    }

    function renderTrackingPanel() {
        var r = state.record;
        function row(label, value, url) {
            var displayVal;
            if (value) {
                displayVal = url
                    ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" class="td-tracking-value">' + escapeHtml(value) + ' <i class="fas fa-external-link-alt" style="font-size:10px;"></i></a>'
                    : '<span class="td-tracking-value">' + escapeHtml(value) + '</span>';
            } else {
                displayVal = '<span class="td-tracking-value td-tracking-value--empty">not set</span>';
            }
            return '<div class="td-tracking-row">' +
                '<span class="td-tracking-label">' + escapeHtml(label) + '</span>' +
                displayVal +
            '</div>';
        }
        var html = row('Supacolor Order #', r.Supacolor_Order_Number, r.Supacolor_Order_URL) +
                   row('ShopWorks PO #', r.ShopWorks_PO_Number) +
                   row('Est. Ship Date', r.Estimated_Ship_Date ? formatDate(r.Estimated_Ship_Date) : null) +
                   row('Tracking #', r.Tracking_Number);

        // Add timeline of who did what
        if (r.Sent_To_Supacolor_By) {
            html += '<div class="td-tracking-row"><span class="td-tracking-label">Ordered By</span><span class="td-tracking-value" style="font-family:inherit;">' +
                escapeHtml(r.Sent_To_Supacolor_By) + ' · ' + escapeHtml(formatDateTime(r.Sent_To_Supacolor_At)) + '</span></div>';
        }
        if (r.PO_Created_By) {
            html += '<div class="td-tracking-row"><span class="td-tracking-label">PO Created By</span><span class="td-tracking-value" style="font-family:inherit;">' +
                escapeHtml(r.PO_Created_By) + ' · ' + escapeHtml(formatDateTime(r.PO_Created_At)) + '</span></div>';
        }
        if (r.Received_By) {
            html += '<div class="td-tracking-row"><span class="td-tracking-label">Received By</span><span class="td-tracking-value" style="font-family:inherit;">' +
                escapeHtml(r.Received_By) + ' · ' + escapeHtml(formatDateTime(r.Received_At)) + '</span></div>';
        }
        if (r.Cancelled_By) {
            html += '<div class="td-tracking-row"><span class="td-tracking-label">Cancelled By</span><span class="td-tracking-value" style="font-family:inherit;">' +
                escapeHtml(r.Cancelled_By) + ' · ' + escapeHtml(formatDateTime(r.Cancelled_At)) + '</span></div>';
            if (r.Cancel_Reason) {
                html += '<div class="td-tracking-row"><span class="td-tracking-label">Reason</span><span class="td-tracking-value" style="font-family:inherit; white-space:pre-wrap;">' +
                    escapeHtml(r.Cancel_Reason) + '</span></div>';
            }
        }
        $('td-tracking-panel').innerHTML = html;
    }

    function renderActionsPanel() {
        var r = state.record;
        var status = r.Status || 'Requested';
        var panel = $('td-actions-panel');

        if (status === 'Received' || status === 'Cancelled') {
            panel.innerHTML = '<div class="td-terminal-notice">' +
                '<i class="fas fa-' + (status === 'Received' ? 'check-circle' : 'ban') + '"></i>' +
                'This transfer is <strong>' + statusLabel(status) + '</strong> and closed for further action.' +
                '</div>';
            return;
        }

        var actions = [];

        // Next-step button (context-sensitive, primary style)
        if (status === 'Requested') {
            actions.push({ id: 'td-act-ordered', icon: 'paper-plane', label: 'Mark as Ordered', variant: 'primary', modal: 'td-ordered-modal' });
        } else if (status === 'Ordered') {
            actions.push({ id: 'td-act-po', icon: 'file-invoice-dollar', label: 'Add ShopWorks PO #', variant: 'primary', modal: 'td-po-modal' });
        } else if (status === 'PO_Created') {
            actions.push({ id: 'td-act-shipped', icon: 'truck', label: 'Mark as Shipped', variant: 'primary', modal: 'td-shipped-modal' });
        } else if (status === 'Shipped') {
            actions.push({ id: 'td-act-received', icon: 'check-circle', label: 'Mark as Received', variant: 'primary', action: 'received' });
        } else if (status === 'On_Hold') {
            actions.push({ id: 'td-act-resume', icon: 'play', label: 'Resume (→ Requested)', variant: 'primary', action: 'resume' });
        }

        // Always-available side actions
        if (status !== 'On_Hold') {
            actions.push({ id: 'td-act-hold', icon: 'pause', label: 'Put On Hold', variant: 'default', action: 'hold' });
        }
        actions.push({
            id: 'td-act-rush',
            icon: 'bolt',
            label: isRush(r) ? 'Clear Rush Flag' : 'Mark as Rush',
            variant: 'rush',
            action: 'rush'
        });
        actions.push({ id: 'td-act-cancel', icon: 'times-circle', label: 'Cancel Transfer', variant: 'danger', modal: 'td-cancel-modal' });

        panel.innerHTML = '<div class="td-actions-grid">' +
            actions.map(function (a) {
                return '<button class="td-action-btn td-action-btn--' + a.variant + '" data-id="' + a.id + '"' +
                    (a.modal ? ' data-modal="' + a.modal + '"' : '') +
                    (a.action ? ' data-action="' + a.action + '"' : '') + '>' +
                    '<i class="fas fa-' + a.icon + '"></i> ' + escapeHtml(a.label) +
                '</button>';
            }).join('') +
        '</div>';

        // Wire up each button
        panel.querySelectorAll('.td-action-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var modalId = btn.getAttribute('data-modal');
                var action = btn.getAttribute('data-action');
                if (modalId) {
                    openModal(modalId);
                } else if (action === 'received') {
                    handleSimpleStatus('Received', 'Marked as Received.');
                } else if (action === 'hold') {
                    handleSimpleStatus('On_Hold', 'Put on hold.');
                } else if (action === 'resume') {
                    handleSimpleStatus('Requested', 'Resumed.');
                } else if (action === 'rush') {
                    openRushModal(!isRush(state.record));
                }
            });
        });
    }

    function renderTimeline() {
        var list = state.notes.slice().sort(function (a, b) {
            return new Date(normalizeDate(a.Created_At)) - new Date(normalizeDate(b.Created_At));
        });
        if (list.length === 0) {
            $('td-timeline').innerHTML = '<div class="td-empty-panel" style="padding:12px 0;">No activity yet.</div>';
            return;
        }

        var iconMap = {
            'status_change': 'arrow-right',
            'rush_flag': 'bolt',
            'cancellation': 'ban',
            'comment': 'comment'
        };
        var iconClassMap = {
            'status_change': 'td-timeline-icon--status',
            'rush_flag': 'td-timeline-icon--rush',
            'cancellation': 'td-timeline-icon--cancel',
            'comment': 'td-timeline-icon--comment'
        };

        $('td-timeline').innerHTML = list.map(function (n) {
            var icon = iconMap[n.Note_Type] || 'circle';
            var iconClass = iconClassMap[n.Note_Type] || '';
            return '<div class="td-timeline-item">' +
                '<div class="td-timeline-icon ' + iconClass + '"><i class="fas fa-' + icon + '"></i></div>' +
                '<div class="td-timeline-body">' +
                    '<div class="td-timeline-text">' + escapeHtml(n.Note_Text || '') + '</div>' +
                    '<div class="td-timeline-meta">' + escapeHtml(n.Author_Name || n.Author_Email || 'System') + ' · ' + escapeHtml(formatDateTime(n.Created_At)) + '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    // ── Modal helpers ────────────────────────────────────────────────
    function openModal(id) {
        $(id).style.display = 'flex';
        // Focus the paste zone if this modal has one — enables Ctrl+V immediately
        var pasteZone = document.querySelector('#' + id + ' .td-paste-zone');
        if (pasteZone) setTimeout(function () { pasteZone.focus(); }, 50);
    }

    function closeModal(id) {
        $(id).style.display = 'none';
        var form = document.querySelector('#' + id + ' form');
        if (form) form.reset();
        // Clear any lingering paste status message
        var status = document.querySelector('#' + id + ' .td-paste-status');
        if (status) { status.style.display = 'none'; status.innerHTML = ''; }
        var zone = document.querySelector('#' + id + ' .td-paste-zone');
        if (zone) zone.classList.remove('td-paste-zone--active');
    }

    // ── Supacolor Screenshot Auto-Fill ──────────────────────────────
    /**
     * POST the pasted image to /api/vision/extract-supacolor and return the
     * extracted fields. Any error rejects so callers can show a status message.
     */
    async function extractSupacolor(dataUri) {
        var resp = await fetch(API_BASE + '/api/vision/extract-supacolor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: dataUri })
        });
        var json = await resp.json();
        if (!resp.ok || !json.success) {
            throw new Error(json.error || ('HTTP ' + resp.status));
        }
        return json.data;
    }

    /**
     * Render a status banner inside the target modal.
     * state: 'loading' | 'success' | 'error'. iconHtml is optional FA classes.
     */
    function renderPasteStatus(target, state, message, thumbUri) {
        var el = $('td-' + target + '-paste-status');
        if (!el) return;
        var icon = state === 'loading'
            ? '<i class="fas fa-spinner fa-spin td-paste-status-icon"></i>'
            : state === 'success'
                ? '<i class="fas fa-check-circle td-paste-status-icon"></i>'
                : '<i class="fas fa-exclamation-triangle td-paste-status-icon"></i>';
        var thumb = thumbUri ? '<img src="' + thumbUri + '" class="td-paste-thumb" alt="">' : '';
        el.className = 'td-paste-status td-paste-status--' + state;
        el.innerHTML = icon + '<span>' + message + '</span>' + thumb;
        el.style.display = '';
    }

    /**
     * Attach paste handler to a modal's paste zone. `target` is 'ordered' or 'shipped'.
     * Applies extracted fields to the correct form.
     */
    function setupPasteZone(target) {
        var zone = $('td-' + target + '-paste-zone');
        if (!zone) return;

        // One handler on the MODAL catches both clicks inside the zone AND paste events
        var modal = $('td-' + target + '-modal');
        if (!modal || modal.__pasteWired) return;
        modal.__pasteWired = true;

        modal.addEventListener('paste', async function (e) {
            // Only when modal is visible
            if (modal.style.display === 'none') return;
            var items = (e.clipboardData || window.clipboardData || {}).items;
            if (!items) return;
            var imageItem = null;
            for (var i = 0; i < items.length; i++) {
                if (items[i].type && items[i].type.indexOf('image') === 0) {
                    imageItem = items[i];
                    break;
                }
            }
            if (!imageItem) return; // let the default paste happen (e.g. text into an input)
            e.preventDefault();

            var file = imageItem.getAsFile();
            if (!file) return;

            // Read as base64 data URI
            var reader = new FileReader();
            reader.onload = async function () {
                var dataUri = reader.result;
                zone.classList.add('td-paste-zone--active');
                renderPasteStatus(target, 'loading', 'Extracting with Claude…', dataUri);

                try {
                    var data = await extractSupacolor(dataUri);
                    applyExtraction(target, data, dataUri);
                } catch (err) {
                    console.error('Supacolor extraction failed:', err);
                    renderPasteStatus(target, 'error',
                        'Could not read screenshot: ' + (err.message || 'unknown error') +
                        '. You can still fill the fields manually below.',
                        dataUri);
                }
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * Apply extracted data to the named form (ordered or shipped).
     * Only fills empty inputs — never overwrites Bradley's manual edits.
     */
    function applyExtraction(target, data, thumbUri) {
        var form = $('td-' + target + '-form');
        if (!form) return;

        var filled = [];
        function setIfEmpty(fieldName, value) {
            if (!value) return;
            var el = form.querySelector('[name="' + fieldName + '"]');
            if (!el) return;
            if (el.value && el.value.trim()) return; // don't overwrite user input
            el.value = value;
            filled.push(fieldName);
        }

        if (target === 'ordered') {
            setIfEmpty('supacolorOrderNumber', data.supacolorJobNumber);
            setIfEmpty('estimatedShipDate', data.estimatedShipDate);
            // URL to the Supacolor job page (best guess from job #)
            if (data.supacolorJobNumber) {
                setIfEmpty('supacolorOrderUrl', 'https://integrate.supacolor.com/dashboard/jobs/' + data.supacolorJobNumber);
            }
        } else if (target === 'shipped') {
            setIfEmpty('trackingNumber', data.trackingNumber);
            setIfEmpty('estimatedShipDate', data.actualShipDate || data.estimatedShipDate);
        }

        if (filled.length === 0) {
            renderPasteStatus(target, 'error',
                'Screenshot read, but no matching fields found. Fill manually below.',
                thumbUri);
            return;
        }

        var msg = 'Auto-filled ' + filled.length + ' field' + (filled.length === 1 ? '' : 's') +
                  ' from Supacolor: ' + filled.join(', ') + '. Review, then submit.';
        renderPasteStatus(target, 'success', msg, thumbUri);
    }

    function openRushModal(markingRush) {
        var modal = $('td-rush-modal');
        $('td-rush-modal-title').innerHTML = markingRush
            ? '<i class="fas fa-bolt"></i> Mark as Rush'
            : '<i class="fas fa-bolt"></i> Clear Rush Flag';
        $('td-rush-submit-btn').textContent = markingRush ? 'Mark Rush' : 'Clear Rush';
        $('td-rush-reason-row').style.display = markingRush ? '' : 'none';
        modal.setAttribute('data-marking-rush', markingRush ? '1' : '0');
        modal.style.display = 'flex';
    }

    // ── Status Transition Actions ────────────────────────────────────
    async function handleSimpleStatus(newStatus, successMsg) {
        await ensureUserIdentified();
        try {
            await apiPut('/api/transfer-orders/' + encodeURIComponent(state.transferId) + '/status', {
                status: newStatus,
                author: state.user.email,
                authorName: state.user.name
            });
            showToast(successMsg, 'success');
            await load();

            // Fire EmailJS notification on Received transition (non-blocking)
            if (newStatus === 'Received' && window.TransferActions && window.TransferActions.sendTransferReceivedEmail) {
                window.TransferActions.sendTransferReceivedEmail(state.record, state.user);
            }
        } catch (err) {
            console.error(err);
            showToast('Failed: ' + err.message, 'error');
        }
    }

    async function handleOrderedSubmit(e) {
        e.preventDefault();
        await ensureUserIdentified();
        var fd = new FormData(e.target);
        try {
            await apiPut('/api/transfer-orders/' + encodeURIComponent(state.transferId) + '/status', {
                status: 'Ordered',
                author: state.user.email,
                authorName: state.user.name,
                supacolorOrderNumber: fd.get('supacolorOrderNumber'),
                supacolorOrderUrl: fd.get('supacolorOrderUrl') || undefined,
                estimatedShipDate: fd.get('estimatedShipDate') || undefined,
                notes: fd.get('notes') || undefined
            });
            closeModal('td-ordered-modal');
            showToast('Marked as Ordered.', 'success');
            await load();

            // Fire EmailJS notification — sales rep + Steve (non-blocking)
            if (window.TransferActions && window.TransferActions.sendTransferOrderedEmail) {
                window.TransferActions.sendTransferOrderedEmail(state.record, state.user);
            }
        } catch (err) {
            console.error(err);
            showToast('Failed: ' + err.message, 'error');
        }
    }

    async function handlePoSubmit(e) {
        e.preventDefault();
        await ensureUserIdentified();
        var fd = new FormData(e.target);
        try {
            await apiPut('/api/transfer-orders/' + encodeURIComponent(state.transferId) + '/status', {
                status: 'PO_Created',
                author: state.user.email,
                authorName: state.user.name,
                shopworksPO: fd.get('shopworksPO'),
                notes: fd.get('notes') || undefined
            });
            closeModal('td-po-modal');
            showToast('PO number saved.', 'success');
            await load();
        } catch (err) {
            console.error(err);
            showToast('Failed: ' + err.message, 'error');
        }
    }

    async function handleShippedSubmit(e) {
        e.preventDefault();
        await ensureUserIdentified();
        var fd = new FormData(e.target);
        try {
            await apiPut('/api/transfer-orders/' + encodeURIComponent(state.transferId) + '/status', {
                status: 'Shipped',
                author: state.user.email,
                authorName: state.user.name,
                trackingNumber: fd.get('trackingNumber') || undefined,
                estimatedShipDate: fd.get('estimatedShipDate') || undefined,
                notes: fd.get('notes') || undefined
            });
            closeModal('td-shipped-modal');
            showToast('Marked as Shipped.', 'success');
            await load();
        } catch (err) {
            console.error(err);
            showToast('Failed: ' + err.message, 'error');
        }
    }

    async function handleCancelSubmit(e) {
        e.preventDefault();
        await ensureUserIdentified();
        var fd = new FormData(e.target);
        try {
            await apiDelete('/api/transfer-orders/' + encodeURIComponent(state.transferId), {
                author: state.user.email,
                authorName: state.user.name,
                reason: fd.get('reason')
            });
            closeModal('td-cancel-modal');
            showToast('Transfer cancelled.', 'success');
            await load();
        } catch (err) {
            console.error(err);
            showToast('Failed: ' + err.message, 'error');
        }
    }

    async function handleRushSubmit(e) {
        e.preventDefault();
        await ensureUserIdentified();
        var markingRush = $('td-rush-modal').getAttribute('data-marking-rush') === '1';
        var fd = new FormData(e.target);
        try {
            await apiPut('/api/transfer-orders/' + encodeURIComponent(state.transferId) + '/rush', {
                isRush: markingRush,
                reason: markingRush ? fd.get('reason') : undefined,
                author: state.user.email,
                authorName: state.user.name
            });
            closeModal('td-rush-modal');
            showToast(markingRush ? 'Marked as RUSH.' : 'Rush cleared.', 'success');
            await load();

            // Fire EmailJS rush alert only when flipping ON (not when clearing)
            if (markingRush && window.TransferActions && window.TransferActions.sendTransferRushEmail) {
                window.TransferActions.sendTransferRushEmail(state.record, state.user);
            }
        } catch (err) {
            console.error(err);
            showToast('Failed: ' + err.message, 'error');
        }
    }

    function openSpecsModal() {
        var r = state.record;
        var form = $('td-specs-form');
        form.reset();
        ['Quantity','Transfer_Size','Press_Count','Transfer_Width_In','Transfer_Height_In','Needed_By_Date','File_Notes','Special_Instructions']
            .forEach(function (key) {
                var el = form.querySelector('[name="' + key + '"]');
                if (el && r[key] !== undefined && r[key] !== null) {
                    if (el.type === 'date' && r[key]) {
                        // Trim time component for date inputs
                        el.value = String(r[key]).split('T')[0].split(' ')[0];
                    } else {
                        el.value = r[key];
                    }
                }
            });
        openModal('td-specs-modal');
    }

    async function handleSpecsSubmit(e) {
        e.preventDefault();
        await ensureUserIdentified();
        var fd = new FormData(e.target);
        var payload = {};
        fd.forEach(function (value, key) {
            if (value === '' || value === null) return;
            if (key === 'Quantity' || key === 'Press_Count') {
                payload[key] = parseInt(value, 10);
            } else if (key === 'Transfer_Width_In' || key === 'Transfer_Height_In') {
                payload[key] = parseFloat(value);
            } else {
                payload[key] = value;
            }
        });
        try {
            await apiPut('/api/transfer-orders/' + encodeURIComponent(state.transferId), payload);
            // Add a note so the edit is visible in the timeline
            await apiPost('/api/transfer-order-notes', {
                Transfer_ID: state.transferId,
                Note_Type: 'comment',
                Note_Text: 'Updated specs: ' + Object.keys(payload).join(', '),
                Author_Email: state.user.email,
                Author_Name: state.user.name
            });
            closeModal('td-specs-modal');
            showToast('Specs updated.', 'success');
            await load();
        } catch (err) {
            console.error(err);
            showToast('Failed: ' + err.message, 'error');
        }
    }

    async function handleCommentSubmit() {
        var text = $('td-comment-input').value.trim();
        if (!text) return;
        await ensureUserIdentified();
        try {
            await apiPost('/api/transfer-order-notes', {
                Transfer_ID: state.transferId,
                Note_Type: 'comment',
                Note_Text: text,
                Author_Email: state.user.email,
                Author_Name: state.user.name
            });
            $('td-comment-input').value = '';
            showToast('Comment posted.', 'success');
            await load();
        } catch (err) {
            console.error(err);
            showToast('Failed: ' + err.message, 'error');
        }
    }

    // ── Load ─────────────────────────────────────────────────────────
    async function load() {
        try {
            var data = await apiGet('/api/transfer-orders/' + encodeURIComponent(state.transferId));
            state.record = data.record;
            state.notes = data.notes || [];
            $('td-loading').style.display = 'none';
            $('td-error').style.display = 'none';
            $('td-main').style.display = '';
            renderAll();
        } catch (err) {
            console.error('Load failed:', err);
            $('td-loading').style.display = 'none';
            $('td-main').style.display = 'none';
            $('td-error').style.display = '';
            $('td-error-message').textContent = err.message === 'NOT_FOUND'
                ? 'Transfer ID "' + state.transferId + '" does not exist.'
                : ('Error: ' + err.message);
        }
    }

    // ── Init ─────────────────────────────────────────────────────────
    function init() {
        state.transferId = qs('id');
        if (!state.transferId) {
            $('td-loading').style.display = 'none';
            $('td-error').style.display = '';
            $('td-error-message').textContent = 'No transfer ID in the URL. Expected ?id=ST-YYMMDD-####';
            return;
        }

        loadUser();

        // Wire up close buttons on all modals
        document.querySelectorAll('[data-close]').forEach(function (btn) {
            btn.addEventListener('click', function () { closeModal(btn.getAttribute('data-close')); });
        });

        // Click outside modal to close
        document.querySelectorAll('.bt-modal').forEach(function (modal) {
            modal.addEventListener('click', function (e) {
                // Don't close the user modal by background click (must complete it)
                if (modal.id === 'td-user-modal' && !state.user) return;
                if (e.target === modal) modal.style.display = 'none';
            });
        });

        // Wire up all the form submits
        $('td-ordered-form').addEventListener('submit', handleOrderedSubmit);
        $('td-po-form').addEventListener('submit', handlePoSubmit);
        $('td-shipped-form').addEventListener('submit', handleShippedSubmit);
        $('td-cancel-form').addEventListener('submit', handleCancelSubmit);
        $('td-rush-form').addEventListener('submit', handleRushSubmit);
        $('td-specs-form').addEventListener('submit', handleSpecsSubmit);

        // Wire Supacolor screenshot paste handlers on the Ordered + Shipped modals
        setupPasteZone('ordered');
        setupPasteZone('shipped');

        $('td-edit-specs-btn').addEventListener('click', openSpecsModal);
        $('td-add-comment-btn').addEventListener('click', handleCommentSubmit);
        $('td-comment-input').addEventListener('keydown', function (e) {
            // Cmd/Ctrl+Enter to submit
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleCommentSubmit();
        });
        $('td-change-user-btn').addEventListener('click', promptChangeUser);

        load();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
