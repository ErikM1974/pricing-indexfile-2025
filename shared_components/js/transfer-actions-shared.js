/* Transfer Actions Shared — Box file picker + Send to Supacolor modal
 *
 * Single source of truth for the "Send to Supacolor" flow.
 * Callers: pages/mockup-detail.html, pages/art-request-detail.html, dashboards/art-hub-steve.html.
 *
 * Exports: window.TransferActions
 *   - openSendModal(opts) — opens Box file picker modal. See opts shape below.
 *   - getTransferForMockup(mockupId) — fetch existing transfer(s) for a mockup (status badge helper)
 *   - getTransferById(idTransfer) — fetch single transfer by ID_Transfer
 *
 * Steve's workflow (per "one source of truth" rule):
 *   1. Modal lazy-fetches files from his existing Box folder via /api/box/folder-files?designNumber=X
 *   2. Steve checks up to 3 files
 *   3. On submit: /api/box/shared-link for each → /api/transfer-orders with resulting URLs
 *   4. No file copies, no /supacolor subfolder, no upload.
 *
 * Styling: depends on /shared_components/css/transfer-actions.css (callers must load it).
 *
 * Dependencies:
 *   - Expects ArtActions (from art-actions-shared.js) to be present for resolveRep/EmailJS
 *     but does NOT require it (EmailJS is deferred to Phase 2b via sendTransferNotification).
 */

(function () {
    'use strict';

    // ── Config ───────────────────────────────────────────────────────
    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    var MAX_FILES = 3;

    // ── State ────────────────────────────────────────────────────────
    var modalState = {
        injected: false,
        opts: null,
        files: [],
        selectedFileIds: []
    };

    // ── DOM helpers ──────────────────────────────────────────────────
    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function formatBytes(bytes) {
        if (!bytes) return '';
        var units = ['B','KB','MB','GB'];
        var i = 0;
        while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
        return bytes.toFixed(bytes < 10 ? 1 : 0) + ' ' + units[i];
    }

    function fileTypeFromName(name) {
        if (!name) return '';
        var ext = (name.split('.').pop() || '').toUpperCase();
        var map = { JPG: 'JPEG', JPEG: 'JPEG', PNG: 'PNG', AI: 'AI', CDR: 'CDR', PDF: 'PDF', PSD: 'PSD', EPS: 'EPS' };
        return map[ext] || ext;
    }

    // ── User identity ────────────────────────────────────────────────
    function getCurrentUser(opts) {
        // Priority: explicit opts.requestedBy > localStorage > null
        if (opts && opts.requestedBy && opts.requestedBy.email) {
            return opts.requestedBy;
        }
        var email = localStorage.getItem('transfer_user_email');
        var name = localStorage.getItem('transfer_user_name');
        if (email && name) return { email: email, name: name };
        return null;
    }

    // ── Toast (shared styling with bradley-transfers / transfer-detail) ─
    function showToast(msg, type) {
        var container = $('#bt-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'bt-toast-container';
            container.className = 'bt-toast-container';
            document.body.appendChild(container);
        }
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

    // ── Modal HTML ───────────────────────────────────────────────────
    function injectModal() {
        if (modalState.injected) return;
        var html =
            '<div id="tas-modal" class="tas-modal" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="tas-modal-title">' +
                '<div class="tas-modal-backdrop"></div>' +
                '<div class="tas-modal-content">' +
                    '<div class="tas-modal-header">' +
                        '<h3 id="tas-modal-title"><i class="fas fa-paper-plane"></i> Send to Supacolor</h3>' +
                        '<button type="button" class="tas-modal-close" aria-label="Close">&times;</button>' +
                    '</div>' +
                    '<div class="tas-modal-body">' +
                        '<div class="tas-modal-intro">' +
                            'Pick up to <strong>3 working files</strong> from your Box folder for Bradley to send to Supacolor. ' +
                            'Your files stay where they are &mdash; we just link to them.' +
                        '</div>' +
                        '<form id="tas-send-form" class="tas-form">' +
                            '<div class="tas-context" id="tas-context"></div>' +

                            // ── FILE PICKER SECTION ──
                            '<fieldset class="tas-fieldset">' +
                                '<legend>Files <span class="tas-muted" id="tas-file-counter">(0 / 3 selected)</span></legend>' +
                                '<div class="tas-folder-banner" id="tas-folder-banner">' +
                                    '<i class="fas fa-folder-open"></i> <span id="tas-folder-name">Loading your Box folder...</span>' +
                                '</div>' +
                                '<div id="tas-files-list" class="tas-files-list">' +
                                    '<div class="tas-loading"><i class="fas fa-spinner fa-spin"></i> Loading files...</div>' +
                                '</div>' +
                                '<div class="tas-hint">Tip: Steve normally picks the layered AI + a flattened print-ready file.</div>' +
                            '</fieldset>' +

                            // ── SPECS SECTION ──
                            '<fieldset class="tas-fieldset">' +
                                '<legend>Order Specs</legend>' +
                                '<div class="tas-form-row tas-form-row--3col">' +
                                    '<div class="tas-form-field">' +
                                        '<label for="tas-quantity">Quantity *</label>' +
                                        '<input type="number" id="tas-quantity" name="Quantity" required min="1">' +
                                    '</div>' +
                                    '<div class="tas-form-field">' +
                                        '<label for="tas-size">Transfer Size</label>' +
                                        '<input type="text" id="tas-size" name="Transfer_Size" placeholder="e.g. 11x14" list="tas-size-options">' +
                                        '<datalist id="tas-size-options">' +
                                            '<option value="8x10">' +
                                            '<option value="11x14">' +
                                            '<option value="12x12">' +
                                            '<option value="Adult Full Front">' +
                                            '<option value="Left Chest">' +
                                            '<option value="Sleeve">' +
                                        '</datalist>' +
                                    '</div>' +
                                    '<div class="tas-form-field">' +
                                        '<label for="tas-press-count">Press Count</label>' +
                                        '<input type="number" id="tas-press-count" name="Press_Count" min="1" value="1">' +
                                    '</div>' +
                                '</div>' +
                                '<div class="tas-form-row">' +
                                    '<div class="tas-form-field">' +
                                        '<label for="tas-width">Width (in)</label>' +
                                        '<input type="number" id="tas-width" name="Transfer_Width_In" step="0.25">' +
                                    '</div>' +
                                    '<div class="tas-form-field">' +
                                        '<label for="tas-height">Height (in)</label>' +
                                        '<input type="number" id="tas-height" name="Transfer_Height_In" step="0.25">' +
                                    '</div>' +
                                '</div>' +
                                '<div class="tas-form-row">' +
                                    '<div class="tas-form-field tas-form-field--full">' +
                                        '<label for="tas-notes">File Notes (Pantone, print direction, etc.)</label>' +
                                        '<textarea id="tas-notes" name="File_Notes" rows="2"></textarea>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="tas-form-row">' +
                                    '<div class="tas-form-field tas-form-field--full">' +
                                        '<label for="tas-special">Special Instructions (gang runs, matching samples, etc.)</label>' +
                                        '<textarea id="tas-special" name="Special_Instructions" rows="2"></textarea>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="tas-form-row tas-form-row--rush">' +
                                    '<div class="tas-form-field tas-form-field--inline">' +
                                        '<label><input type="checkbox" id="tas-rush" name="Is_Rush"> <strong>This is a RUSH order</strong></label>' +
                                    '</div>' +
                                    '<div class="tas-form-field" id="tas-rush-details" style="display:none;">' +
                                        '<label for="tas-needed-by">Needed by</label>' +
                                        '<input type="date" id="tas-needed-by" name="Needed_By_Date">' +
                                    '</div>' +
                                '</div>' +
                                '<div class="tas-form-row" id="tas-rush-reason-row" style="display:none;">' +
                                    '<div class="tas-form-field tas-form-field--full">' +
                                        '<label for="tas-rush-reason">Rush reason</label>' +
                                        '<input type="text" id="tas-rush-reason" name="Rush_Reason" placeholder="Customer event date, deadline...">' +
                                    '</div>' +
                                '</div>' +
                            '</fieldset>' +

                            '<div class="tas-form-actions">' +
                                '<button type="button" class="tas-btn tas-btn--secondary tas-modal-cancel">Cancel</button>' +
                                '<button type="submit" class="tas-btn tas-btn--primary" id="tas-submit-btn" disabled>' +
                                    '<i class="fas fa-paper-plane"></i> Send to Supacolor' +
                                '</button>' +
                            '</div>' +
                        '</form>' +
                    '</div>' +
                '</div>' +
            '</div>';

        var wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper.firstElementChild);

        wireModalEvents();
        modalState.injected = true;
    }

    function wireModalEvents() {
        $('#tas-modal .tas-modal-close').addEventListener('click', closeModal);
        $$('.tas-modal-cancel', $('#tas-modal')).forEach(function (btn) {
            btn.addEventListener('click', closeModal);
        });
        $('#tas-modal .tas-modal-backdrop').addEventListener('click', closeModal);

        // Rush toggle reveals needed-by + reason fields
        $('#tas-rush').addEventListener('change', function (e) {
            var show = e.target.checked;
            $('#tas-rush-details').style.display = show ? '' : 'none';
            $('#tas-rush-reason-row').style.display = show ? '' : 'none';
        });

        $('#tas-send-form').addEventListener('submit', handleSubmit);

        // Escape key closes
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && $('#tas-modal').style.display !== 'none') {
                closeModal();
            }
        });
    }

    // ── File Picker ──────────────────────────────────────────────────
    function renderContext(opts) {
        var prefill = opts.prefill || {};
        var parts = [];
        parts.push('<div><span class="tas-context-label">Design #</span><strong>' + escapeHtml(opts.designNumber) + '</strong></div>');
        if (prefill.Company_Name) {
            parts.push('<div><span class="tas-context-label">Company</span>' + escapeHtml(prefill.Company_Name) + '</div>');
        }
        if (prefill.Customer_Name) {
            parts.push('<div><span class="tas-context-label">Customer</span>' + escapeHtml(prefill.Customer_Name) + '</div>');
        }
        if (prefill.Sales_Rep_Name || prefill.Sales_Rep_Email) {
            parts.push('<div><span class="tas-context-label">Rep</span>' + escapeHtml(prefill.Sales_Rep_Name || prefill.Sales_Rep_Email) + '</div>');
        }
        $('#tas-context').innerHTML = parts.join('');
    }

    async function loadBoxFiles(designNumber) {
        var list = $('#tas-files-list');
        var banner = $('#tas-folder-name');
        list.innerHTML = '<div class="tas-loading"><i class="fas fa-spinner fa-spin"></i> Loading files from Box...</div>';
        banner.textContent = 'Looking up folder for design #' + designNumber + '...';

        try {
            var resp = await fetch(API_BASE + '/api/box/folder-files?designNumber=' + encodeURIComponent(designNumber));
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();
            if (!data.success) throw new Error(data.error || 'Box lookup failed');

            if (!data.found || data.files.length === 0) {
                banner.innerHTML = '<i class="fas fa-exclamation-triangle"></i> No Box folder found for design #' + escapeHtml(designNumber);
                list.innerHTML = '<div class="tas-empty">' +
                    '<i class="fas fa-folder-minus"></i>' +
                    '<div>No files found.</div>' +
                    '<div class="tas-hint">Expected folder name starting with "' + escapeHtml(designNumber) + '" under Steve\'s art folder.</div>' +
                    '</div>';
                modalState.files = [];
                return;
            }

            banner.innerHTML = '<i class="fas fa-folder-open"></i> ' + escapeHtml(data.folderName) +
                ' &middot; <span class="tas-muted">' + data.files.length + ' file' + (data.files.length === 1 ? '' : 's') + '</span>';
            modalState.files = data.files;
            renderFilesList(data.files);

        } catch (err) {
            console.error('Box folder fetch failed:', err);
            banner.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Could not load Box folder';
            list.innerHTML = '<div class="tas-error">' +
                '<i class="fas fa-times-circle"></i> ' + escapeHtml(err.message || 'Unknown error') +
                '</div>';
            modalState.files = [];
        }
    }

    function renderFilesList(files) {
        var html = files.map(function (f) {
            var thumbUrl = f.thumbnailUrl ? (API_BASE + f.thumbnailUrl) : null;
            var thumbHtml = thumbUrl
                ? '<img src="' + escapeHtml(thumbUrl) + '" alt="" class="tas-file-thumb" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';">' +
                  '<div class="tas-file-icon" style="display:none;"><i class="fas fa-file"></i></div>'
                : '<div class="tas-file-icon"><i class="fas fa-file"></i></div>';
            var modifiedAt = f.modified_at ? new Date(f.modified_at).toLocaleDateString() : '';
            return '<label class="tas-file-row" data-file-id="' + escapeHtml(f.id) + '">' +
                '<input type="checkbox" class="tas-file-check" data-file-id="' + escapeHtml(f.id) + '" data-file-name="' + escapeHtml(f.name) + '">' +
                thumbHtml +
                '<div class="tas-file-meta">' +
                    '<div class="tas-file-name">' + escapeHtml(f.name) + '</div>' +
                    '<div class="tas-file-sub">' +
                        escapeHtml((f.extension || '').toUpperCase()) +
                        (f.size ? ' &middot; ' + formatBytes(f.size) : '') +
                        (modifiedAt ? ' &middot; modified ' + escapeHtml(modifiedAt) : '') +
                    '</div>' +
                '</div>' +
            '</label>';
        }).join('');

        $('#tas-files-list').innerHTML = html;

        // Wire checkbox change events for max-3 enforcement
        $$('#tas-files-list .tas-file-check').forEach(function (cb) {
            cb.addEventListener('change', onFileCheckChange);
        });
    }

    function onFileCheckChange() {
        var checked = $$('#tas-files-list .tas-file-check:checked');
        if (checked.length > MAX_FILES) {
            // Undo this check
            this.checked = false;
            showToast('Maximum ' + MAX_FILES + ' files. Uncheck one first.', 'error');
            return;
        }
        modalState.selectedFileIds = checked.map(function (cb) {
            return { id: cb.getAttribute('data-file-id'), name: cb.getAttribute('data-file-name') };
        });
        updateFileCounter();
        updateSubmitButton();

        // Visual selected state
        $$('#tas-files-list .tas-file-row').forEach(function (row) {
            var rowCheck = $('.tas-file-check', row);
            row.classList.toggle('tas-file-row--selected', rowCheck.checked);
        });
    }

    function updateFileCounter() {
        var count = modalState.selectedFileIds.length;
        $('#tas-file-counter').textContent = '(' + count + ' / ' + MAX_FILES + ' selected)';
    }

    function updateSubmitButton() {
        var qty = parseInt($('#tas-quantity').value, 10);
        var hasFiles = modalState.selectedFileIds.length > 0;
        var valid = hasFiles && qty > 0;
        $('#tas-submit-btn').disabled = !valid;
    }

    // ── Open / Close ─────────────────────────────────────────────────
    function openSendModal(opts) {
        if (!opts || !opts.designNumber) {
            console.error('TransferActions.openSendModal: missing designNumber');
            return;
        }
        injectModal();
        modalState.opts = opts;
        modalState.selectedFileIds = [];

        // Reset form
        var form = $('#tas-send-form');
        form.reset();
        $('#tas-rush-details').style.display = 'none';
        $('#tas-rush-reason-row').style.display = 'none';
        updateFileCounter();
        updateSubmitButton();

        // Fill in context + prefill known specs
        renderContext(opts);
        if (opts.prefill) {
            if (opts.prefill.Quantity) $('#tas-quantity').value = opts.prefill.Quantity;
            if (opts.prefill.Transfer_Size) $('#tas-size').value = opts.prefill.Transfer_Size;
            if (opts.prefill.Press_Count) $('#tas-press-count').value = opts.prefill.Press_Count;
            if (opts.prefill.File_Notes) $('#tas-notes').value = opts.prefill.File_Notes;
        }

        // Wire live validation
        $('#tas-quantity').addEventListener('input', updateSubmitButton);

        // Show modal
        $('#tas-modal').style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Fetch Box files
        loadBoxFiles(opts.designNumber);
    }

    function closeModal() {
        var modal = $('#tas-modal');
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    // ── Submit ───────────────────────────────────────────────────────
    async function handleSubmit(e) {
        e.preventDefault();
        var opts = modalState.opts;
        var user = getCurrentUser(opts);

        if (!user) {
            // Prompt for identity — simple inline fallback. mockup-detail and
            // Steve's dashboard will typically pass requestedBy explicitly, so
            // this is the edge case.
            var name = prompt('Your full name (for the audit trail):');
            if (!name) return;
            var email = prompt('Your email address:');
            if (!email) return;
            localStorage.setItem('transfer_user_name', name);
            localStorage.setItem('transfer_user_email', email);
            user = { name: name, email: email };
        }

        var submitBtn = $('#tas-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating shared links...';

        try {
            // 1. Create shared link for each selected file
            var linkPromises = modalState.selectedFileIds.map(function (f) {
                return fetch(API_BASE + '/api/box/shared-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileId: f.id })
                }).then(function (r) { return r.json(); })
                  .then(function (data) {
                      if (!data.success) throw new Error(data.error || 'Shared link failed');
                      return { id: f.id, name: f.name, url: data.sharedLink };
                  });
            });
            var linked = await Promise.all(linkPromises);

            // 2. Build transfer payload
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating transfer...';
            var form = $('#tas-send-form');
            var fd = new FormData(form);

            var payload = {
                Design_Number: opts.designNumber,
                Requested_By: user.email,
                Requested_By_Name: user.name,
                Status: 'Requested'
            };
            if (opts.designId) payload.Design_ID = opts.designId;
            if (opts.mockupId) payload.Mockup_ID = opts.mockupId;

            // Prefill pass-through (denormalized columns)
            if (opts.prefill) {
                ['Company_Name','Customer_Name','Sales_Rep_Email','Sales_Rep_Name']
                    .forEach(function (k) { if (opts.prefill[k]) payload[k] = opts.prefill[k]; });
            }

            // Form fields (typed conversion)
            fd.forEach(function (v, k) {
                if (v === '' || v === null) return;
                if (k === 'Is_Rush') {
                    payload.Is_Rush = true;
                } else if (k === 'Quantity' || k === 'Press_Count') {
                    payload[k] = parseInt(v, 10);
                } else if (k === 'Transfer_Width_In' || k === 'Transfer_Height_In') {
                    payload[k] = parseFloat(v);
                } else {
                    payload[k] = v;
                }
            });
            if (!('Is_Rush' in payload)) payload.Is_Rush = false;

            // File URLs (up to 3)
            if (linked[0]) {
                payload.Working_File_URL = linked[0].url;
                payload.Working_File_Name = linked[0].name;
                payload.Working_File_Type = fileTypeFromName(linked[0].name);
                payload.Box_File_ID = linked[0].id;
            }
            if (linked[1]) {
                payload.Additional_File_1_URL = linked[1].url;
                payload.Additional_File_1_Name = linked[1].name;
            }
            if (linked[2]) {
                payload.Additional_File_2_URL = linked[2].url;
                payload.Additional_File_2_Name = linked[2].name;
            }

            // 3. POST to transfer-orders
            var createResp = await fetch(API_BASE + '/api/transfer-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            var createData = await createResp.json();
            if (!createResp.ok || !createData.success) {
                throw new Error(createData.error || ('HTTP ' + createResp.status));
            }

            closeModal();
            showToast('Transfer ' + (createData.record.ID_Transfer || '') + ' sent to Bradley.', 'success');

            if (typeof opts.onSuccess === 'function') {
                opts.onSuccess(createData.record);
            }

        } catch (err) {
            console.error('Send to Supacolor failed:', err);
            showToast('Failed: ' + err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send to Supacolor';
        }
    }

    // ── Read helpers (for status badge on mockup-detail etc.) ────────
    async function getTransferForMockup(mockupId) {
        try {
            var resp = await fetch(API_BASE + '/api/transfer-orders?mockupId=' + encodeURIComponent(mockupId) + '&pageSize=10');
            if (!resp.ok) return null;
            var data = await resp.json();
            if (!data.success) return null;
            var records = data.records || [];
            // Return most-recent non-cancelled first, fallback to most recent
            var active = records.filter(function (r) { return r.Status !== 'Cancelled'; });
            return active[0] || records[0] || null;
        } catch (err) {
            console.error('getTransferForMockup failed:', err);
            return null;
        }
    }

    async function getTransferById(idTransfer) {
        try {
            var resp = await fetch(API_BASE + '/api/transfer-orders/' + encodeURIComponent(idTransfer));
            if (!resp.ok) return null;
            var data = await resp.json();
            return data.success ? data.record : null;
        } catch (err) {
            return null;
        }
    }

    // ── Export ───────────────────────────────────────────────────────
    window.TransferActions = {
        openSendModal: openSendModal,
        getTransferForMockup: getTransferForMockup,
        getTransferById: getTransferById,
        showToast: showToast
    };
})();
