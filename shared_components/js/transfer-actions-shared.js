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

    // EmailJS (shared with art-actions-shared.js)
    var EMAILJS_SERVICE_ID = 'service_jgrave3';
    var EMAILJS_PUBLIC_KEY = '4qSbDO-SQs19TbP80';

    // Fixed recipient routing
    var BRADLEY_EMAIL = 'bradley@nwcustomapparel.com';
    // Steve uses the shared art dept alias — no individual steve@ address exists.
    var STEVE_EMAIL = 'art@nwcustomapparel.com';

    // SITE_ORIGIN: non-Heroku domain for email links (per MEMORY.md gotcha —
    // use customer-facing origin, never the herokuapp.com slug)
    var SITE_ORIGIN = (function () {
        var o = (typeof window !== 'undefined' && window.location && window.location.origin) || '';
        if (/herokuapp\.com/i.test(o)) return 'https://teamnwca.com';
        return o || 'https://teamnwca.com';
    })();

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

    // ── EmailJS notifications ────────────────────────────────────────
    /**
     * Build the shared EmailJS parameter payload for a transfer record.
     * All 4 transfer_* templates use this base set, plus template-specific overrides.
     */
    function buildEmailParams(record, overrides) {
        var params = {
            id_transfer: record.ID_Transfer || '',
            design_number: record.Design_Number || '',
            company_name: record.Company_Name || '',
            customer_name: record.Customer_Name || '',
            rep_name: record.Sales_Rep_Name || record.Sales_Rep_Email || '',
            rep_email: record.Sales_Rep_Email || '',
            quantity: record.Quantity || '—',
            transfer_size: record.Transfer_Size || '—',
            press_count: record.Press_Count || '—',
            needed_by_date: record.Needed_By_Date
                ? new Date(String(record.Needed_By_Date).split('T')[0] + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—',
            detail_link: SITE_ORIGIN + '/pages/transfer-detail.html?id=' + encodeURIComponent(record.ID_Transfer || ''),
            supacolor_num: record.Supacolor_Order_Number || '—',
            shopworks_po: record.ShopWorks_PO_Number || '—',
            estimated_ship_date: record.Estimated_Ship_Date
                ? new Date(String(record.Estimated_Ship_Date).split('T')[0] + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—',
            rush_reason: record.Rush_Reason || '',
            current_status: record.Status || '—',
            // Defaults for conditional blocks — overrides can replace
            rush_subject_suffix: '',
            rush_banner_html: '',
            notes_block_html: '',
            special_block_html: '',
            files_html: buildFilesHtml(record),
            print_specs_html: buildPrintSpecsHtml(record),
            cc_email: ''
        };
        if (overrides) {
            Object.keys(overrides).forEach(function (k) { params[k] = overrides[k]; });
        }
        return params;
    }

    /**
     * Pre-render the files list as HTML for inclusion in emails.
     * Supports primary + up to 2 additional files.
     */
    function buildFilesHtml(record) {
        var files = [];
        if (record.Working_File_URL) {
            files.push({
                label: 'Primary' + (record.Working_File_Type ? ' (' + record.Working_File_Type + ')' : ''),
                name: record.Working_File_Name || 'primary file',
                url: record.Working_File_URL
            });
        }
        if (record.Additional_File_1_URL) {
            files.push({
                label: 'Additional 1',
                name: record.Additional_File_1_Name || 'file 2',
                url: record.Additional_File_1_URL
            });
        }
        if (record.Additional_File_2_URL) {
            files.push({
                label: 'Additional 2',
                name: record.Additional_File_2_Name || 'file 3',
                url: record.Additional_File_2_URL
            });
        }
        if (files.length === 0) {
            return '<div style="padding:10px 12px;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;font-size:13px;color:#92400e;">No working files attached.</div>';
        }
        return files.map(function (f) {
            return '<div style="padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:6px;font-size:13px;">' +
                   '<strong>' + escapeHtml(f.label) + ':</strong> ' + escapeHtml(f.name) +
                   ' · <a href="' + escapeHtml(f.url) + '" style="color:#4a6fa5;">Open in Box →</a></div>';
        }).join('');
    }

    /**
     * Pre-render the Print Specs block for inclusion in the transfer_requested email.
     * Returns '' when none of the 5 Print Specs fields are set (legacy transfers
     * stay clean — no empty block in the email). Mirrors the style of the existing
     * File Notes / Special Instructions blocks.
     */
    function buildPrintSpecsHtml(record) {
        if (!record) return '';
        var has = record.Transfer_Type || record.Fabric_Target || record.Primary_Color ||
                  record.Additional_Colors || (record.Color_Count && record.Color_Count > 0);
        if (!has) return '';

        var rows = [];
        if (record.Transfer_Type) {
            rows.push('<tr><td style="padding:4px 0;color:#6b7280;width:140px;font-size:13px;">Transfer Type</td>' +
                      '<td style="padding:4px 0;font-size:13px;"><strong>' + escapeHtml(record.Transfer_Type) + '</strong></td></tr>');
        }
        if (record.Fabric_Target) {
            rows.push('<tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Fabric</td>' +
                      '<td style="padding:4px 0;font-size:13px;">' + escapeHtml(record.Fabric_Target) + '</td></tr>');
        }
        if (record.Color_Count && record.Color_Count > 0) {
            rows.push('<tr><td style="padding:4px 0;color:#6b7280;font-size:13px;"># of Colors</td>' +
                      '<td style="padding:4px 0;font-size:13px;">' + escapeHtml(String(record.Color_Count)) + '</td></tr>');
        }
        if (record.Primary_Color) {
            rows.push('<tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Primary Color</td>' +
                      '<td style="padding:4px 0;font-size:13px;"><strong>' + escapeHtml(record.Primary_Color) + '</strong></td></tr>');
        }
        if (record.Additional_Colors) {
            // white-space:pre-wrap so one-per-line PMS entries keep their line breaks
            rows.push('<tr><td style="padding:4px 0;color:#6b7280;font-size:13px;vertical-align:top;">Additional Colors</td>' +
                      '<td style="padding:4px 0;font-size:13px;white-space:pre-wrap;">' + escapeHtml(record.Additional_Colors) + '</td></tr>');
        }

        return '<h3 style="color:#4a6fa5;font-size:15px;margin:18px 0 8px;">Print Specs</h3>' +
               '<div style="background:#f0fdf4;padding:10px 14px;border-left:3px solid #22c55e;border-radius:4px;">' +
               '<table style="width:100%;border-collapse:collapse;">' + rows.join('') + '</table>' +
               '</div>';
    }

    /**
     * Build the rush banner HTML block (or empty string).
     */
    function buildRushBanner(record) {
        if (!record.Is_Rush) return '';
        var reason = record.Rush_Reason ? '<br/>' + escapeHtml(record.Rush_Reason) : '';
        return '<div style="background:#fee2e2;border-left:4px solid #dc2626;padding:10px 14px;margin:12px 0;border-radius:4px;"><strong style="color:#991b1b;">⚡ RUSH ORDER</strong>' + reason + '</div>';
    }

    /**
     * Fire an EmailJS send, non-blocking. Always resolves (never throws)
     * so a notification failure doesn't break the main user flow.
     */
    function sendEmail(templateId, params) {
        if (typeof window === 'undefined' || !window.emailjs) {
            console.warn('EmailJS not loaded — skipping ' + templateId);
            return Promise.resolve({ skipped: true });
        }
        return window.emailjs.send(EMAILJS_SERVICE_ID, templateId, params, EMAILJS_PUBLIC_KEY)
            .then(function (resp) {
                console.log('EmailJS ' + templateId + ' sent:', resp && resp.status);
                return resp;
            })
            .catch(function (err) {
                console.warn('EmailJS ' + templateId + ' failed (non-blocking):', err);
                return { error: err };
            });
    }

    /**
     * Send the transfer_requested notification (Steve → Bradley).
     * CC the requester so they have a paper trail.
     */
    function sendTransferRequestedEmail(record, requestedBy) {
        var overrides = {
            to_email: BRADLEY_EMAIL,
            to_name: 'Bradley',
            cc_email: requestedBy && requestedBy.email ? requestedBy.email : '',
            requested_by_name: requestedBy && requestedBy.name ? requestedBy.name : 'Art Department'
        };
        if (record.Is_Rush) {
            overrides.rush_subject_suffix = ' 🚨 RUSH';
            overrides.rush_banner_html = buildRushBanner(record);
        }
        if (record.File_Notes) {
            overrides.notes_block_html = '<h3 style="color:#4a6fa5;font-size:15px;margin:18px 0 8px;">File Notes</h3>' +
                '<div style="white-space:pre-wrap;background:#fffbeb;padding:10px 14px;border-left:3px solid #f59e0b;border-radius:4px;font-size:13px;">' +
                escapeHtml(record.File_Notes) + '</div>';
        }
        if (record.Special_Instructions) {
            overrides.special_block_html = '<h3 style="color:#4a6fa5;font-size:15px;margin:18px 0 8px;">Special Instructions</h3>' +
                '<div style="white-space:pre-wrap;background:#eff6ff;padding:10px 14px;border-left:3px solid #3b82f6;border-radius:4px;font-size:13px;">' +
                escapeHtml(record.Special_Instructions) + '</div>';
        }
        return sendEmail('transfer_requested', buildEmailParams(record, overrides));
    }

    /**
     * Send the transfer_ordered notification (Bradley → Sales Rep, CC Steve).
     */
    function sendTransferOrderedEmail(record, actor) {
        if (!record.Sales_Rep_Email) {
            console.warn('No Sales_Rep_Email — skipping transfer_ordered');
            return Promise.resolve();
        }
        var overrides = {
            to_email: record.Sales_Rep_Email,
            to_name: record.Sales_Rep_Name || record.Sales_Rep_Email,
            cc_email: STEVE_EMAIL,
            actor_name: actor && actor.name ? actor.name : 'Bradley',
            actor_email: actor && actor.email ? actor.email : BRADLEY_EMAIL
        };
        return sendEmail('transfer_ordered', buildEmailParams(record, overrides));
    }

    /**
     * Send the transfer_received notification (Bradley/Michaela → Sales Rep, CC Steve).
     */
    function sendTransferReceivedEmail(record, actor) {
        if (!record.Sales_Rep_Email) {
            console.warn('No Sales_Rep_Email — skipping transfer_received');
            return Promise.resolve();
        }
        var overrides = {
            to_email: record.Sales_Rep_Email,
            to_name: record.Sales_Rep_Name || record.Sales_Rep_Email,
            cc_email: STEVE_EMAIL,
            actor_name: actor && actor.name ? actor.name : 'Warehouse',
            actor_email: actor && actor.email ? actor.email : '',
            received_date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };
        return sendEmail('transfer_received', buildEmailParams(record, overrides));
    }

    /**
     * Send the transfer_rush notification (→ Bradley, CC Sales Rep).
     */
    function sendTransferRushEmail(record, actor) {
        var overrides = {
            to_email: BRADLEY_EMAIL,
            to_name: 'Bradley',
            cc_email: record.Sales_Rep_Email || '',
            actor_name: actor && actor.name ? actor.name : 'Art Department',
            actor_email: actor && actor.email ? actor.email : ''
        };
        return sendEmail('transfer_rush', buildEmailParams(record, overrides));
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

                            // ── PRINT SPECS SECTION (Supacolor-aligned) ──
                            // Structured versions of what used to live in File_Notes free-text.
                            // Bradley can read these straight off the detail page and type
                            // them into supacolor.com without translation.
                            '<fieldset class="tas-fieldset">' +
                                '<legend>Print Specs <span class="tas-muted">(what Supacolor needs)</span></legend>' +
                                '<div class="tas-form-row tas-form-row--3col">' +
                                    '<div class="tas-form-field">' +
                                        '<label for="tas-transfer-type">Transfer Type *</label>' +
                                        '<select id="tas-transfer-type" name="Transfer_Type" required>' +
                                            '<option value="">— pick one —</option>' +
                                            '<option value="Supa-Classic">Supa-Classic</option>' +
                                            '<option value="Full Color Gang Sheet">Full Color Gang Sheet</option>' +
                                            '<option value="DTF">DTF (Direct to Film)</option>' +
                                            '<option value="One Color">One Color</option>' +
                                            '<option value="Supa-Soft">Supa-Soft</option>' +
                                            '<option value="Reflective">Reflective</option>' +
                                            '<option value="Glow in Dark">Glow in Dark</option>' +
                                            '<option value="Other">Other</option>' +
                                        '</select>' +
                                    '</div>' +
                                    '<div class="tas-form-field">' +
                                        '<label>Fabric Target</label>' +
                                        '<div class="tas-radio-group">' +
                                            '<label class="tas-radio"><input type="radio" name="Fabric_Target" value="Dark" checked> Dark</label>' +
                                            '<label class="tas-radio"><input type="radio" name="Fabric_Target" value="Light"> Light</label>' +
                                            '<label class="tas-radio"><input type="radio" name="Fabric_Target" value="Either"> Either</label>' +
                                        '</div>' +
                                    '</div>' +
                                    '<div class="tas-form-field">' +
                                        '<label for="tas-color-count"># of Colors</label>' +
                                        '<input type="number" id="tas-color-count" name="Color_Count" min="1" max="8" value="1">' +
                                    '</div>' +
                                '</div>' +
                                '<div class="tas-form-row">' +
                                    '<div class="tas-form-field tas-form-field--full">' +
                                        '<label for="tas-primary-color">Primary Color / PMS</label>' +
                                        '<input type="text" id="tas-primary-color" name="Primary_Color" placeholder="e.g. PMS 186C, Rich Black, Safety Yellow...">' +
                                    '</div>' +
                                '</div>' +
                                '<div class="tas-form-row">' +
                                    '<div class="tas-form-field tas-form-field--full">' +
                                        '<label for="tas-additional-colors">Additional Colors (one per line)</label>' +
                                        '<textarea id="tas-additional-colors" name="Additional_Colors" rows="2" placeholder="PMS 2945C\nPMS 1235C"></textarea>' +
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
        // H9 — Guard each $() lookup. Previously any missing element would throw
        // on .addEventListener and abort modal wiring (cancel / close / submit
        // all dead, no way for user to escape the modal).
        var tasModal = $('#tas-modal');
        if (!tasModal) {
            console.warn('[transfer-actions] #tas-modal not injected, skipping wireModalEvents');
            return;
        }

        var closeBtn = $('#tas-modal .tas-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        $$('.tas-modal-cancel', tasModal).forEach(function (btn) {
            btn.addEventListener('click', closeModal);
        });

        var backdrop = $('#tas-modal .tas-modal-backdrop');
        if (backdrop) backdrop.addEventListener('click', closeModal);

        // Rush toggle reveals needed-by + reason fields
        var rushToggle = $('#tas-rush');
        var rushDetails = $('#tas-rush-details');
        var rushReasonRow = $('#tas-rush-reason-row');
        if (rushToggle && rushDetails && rushReasonRow) {
            rushToggle.addEventListener('change', function (e) {
                var show = e.target.checked;
                rushDetails.style.display = show ? '' : 'none';
                rushReasonRow.style.display = show ? '' : 'none';
            });
        }

        var sendForm = $('#tas-send-form');
        if (sendForm) sendForm.addEventListener('submit', handleSubmit);

        // Escape key closes
        document.addEventListener('keydown', function (e) {
            var m = $('#tas-modal');
            if (e.key === 'Escape' && m && m.style.display !== 'none') {
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
                } else if (k === 'Quantity' || k === 'Press_Count' || k === 'Color_Count') {
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

            // Fire EmailJS notification (non-blocking) — Bradley + CC requester
            sendTransferRequestedEmail(createData.record, user);

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

    // ── D.5 — Inline transfer status badge ────────────────────────────
    // Renders a small pill showing the transfer's current status + a click-through
    // to transfer-detail. If linked to a Supacolor job, also shows tracking #.
    //
    // Usage from mockup-detail / art-request-detail:
    //   TransferActions.renderTransferStatusBadge({ targetEl: '#pmd-header', mockupId: ..., designNumber: ... });
    //
    // Takes the first non-cancelled transfer matched by mockupId OR designNumber.
    // Returns a Promise<boolean> — true if a badge was rendered, false if no transfer exists.

    function statusBadgeMeta(status) {
        // Map Transfer_Orders.Status → { label, color, icon }
        var map = {
            'Requested':  { label: 'Submitted to Bradley',        color: '#f59e0b', bg: '#fef3c7', icon: 'paper-plane' },
            'Ordered':    { label: 'Ordered from Supacolor',      color: '#3b82f6', bg: '#dbeafe', icon: 'shopping-cart' },
            'PO_Created': { label: 'PO Created',                  color: '#8b5cf6', bg: '#ede9fe', icon: 'file-invoice-dollar' },
            'Shipped':    { label: 'Shipped',                     color: '#22c55e', bg: '#dcfce7', icon: 'truck' },
            'Received':   { label: 'Received at NWCA',            color: '#16a34a', bg: '#d1fae5', icon: 'check-circle' },
            'On_Hold':    { label: 'On Hold',                     color: '#94a3b8', bg: '#f1f5f9', icon: 'pause' },
            'Cancelled':  { label: 'Cancelled',                   color: '#94a3b8', bg: '#f1f5f9', icon: 'times-circle' }
        };
        return map[status] || { label: status || 'Unknown', color: '#64748b', bg: '#f1f5f9', icon: 'circle' };
    }

    function trackingUrlFromCarrier(carrier, tracking) {
        if (!tracking) return '';
        var c = String(carrier || '').toLowerCase();
        var t = encodeURIComponent(tracking);
        if (c.indexOf('fedex') >= 0) return 'https://www.fedex.com/fedextrack/?tracknumbers=' + t;
        if (c.indexOf('ups') >= 0) return 'https://www.ups.com/track?tracknum=' + t;
        if (c.indexOf('usps') >= 0) return 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' + t;
        if (c.indexOf('dhl') >= 0) return 'https://www.dhl.com/en/express/tracking.html?AWB=' + t;
        return '';
    }

    async function findTransferForBadge(opts) {
        // Prefer the (more specific) mockupId match; fall back to designNumber.
        if (opts.mockupId) {
            var byMockup = await getTransferForMockup(opts.mockupId);
            if (byMockup) return byMockup;
        }
        if (opts.designNumber) {
            try {
                var resp = await fetch(API_BASE + '/api/transfer-orders?designNumber=' + encodeURIComponent(opts.designNumber) + '&pageSize=5&orderBy=Requested_At%20DESC');
                if (!resp.ok) return null;
                var data = await resp.json();
                if (!data.success) return null;
                var records = data.records || [];
                var active = records.filter(function (r) { return r.Status !== 'Cancelled'; });
                return active[0] || records[0] || null;
            } catch (err) {
                return null;
            }
        }
        return null;
    }

    function badgeHtml(transfer) {
        var meta = statusBadgeMeta(transfer.Status);
        var trackUrl = trackingUrlFromCarrier(transfer.Carrier, transfer.Tracking_Number);
        var trackingBlock = '';
        if (transfer.Tracking_Number) {
            var carrierLabel = transfer.Carrier ? escapeHtml(transfer.Carrier) + ' ' : '';
            var trackTxt = carrierLabel + escapeHtml(transfer.Tracking_Number);
            trackingBlock = trackUrl
                ? '<a class="tas-transfer-badge-track" href="' + escapeHtml(trackUrl) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i class="fas fa-truck"></i> ' + trackTxt + '</a>'
                : '<span class="tas-transfer-badge-track"><i class="fas fa-truck"></i> ' + trackTxt + '</span>';
        }
        var detailLink = SITE_ORIGIN + '/pages/transfer-detail.html?id=' + encodeURIComponent(transfer.ID_Transfer || '');
        return '<a href="' + escapeHtml(detailLink) + '" class="tas-transfer-badge" style="--badge-color:' + meta.color + ';--badge-bg:' + meta.bg + ';" title="View transfer detail">' +
            '<i class="fas fa-' + meta.icon + '"></i>' +
            '<span class="tas-transfer-badge-id">' + escapeHtml(transfer.ID_Transfer || '') + '</span>' +
            '<span class="tas-transfer-badge-status">' + escapeHtml(meta.label) + '</span>' +
            trackingBlock +
            '</a>';
    }

    async function renderTransferStatusBadge(opts) {
        if (!opts || !opts.targetEl) return false;
        var container = typeof opts.targetEl === 'string' ? document.querySelector(opts.targetEl) : opts.targetEl;
        if (!container) return false;

        var transfer = await findTransferForBadge(opts);
        if (!transfer || !transfer.ID_Transfer) {
            container.innerHTML = '';
            return false;
        }

        container.innerHTML = badgeHtml(transfer);
        return true;
    }

    // ── Export ───────────────────────────────────────────────────────
    window.TransferActions = {
        openSendModal: openSendModal,
        getTransferForMockup: getTransferForMockup,
        getTransferById: getTransferById,
        renderTransferStatusBadge: renderTransferStatusBadge,
        showToast: showToast,
        // Notification helpers (called from transfer-detail.js on status changes)
        sendTransferRequestedEmail: sendTransferRequestedEmail,
        sendTransferOrderedEmail: sendTransferOrderedEmail,
        sendTransferReceivedEmail: sendTransferReceivedEmail,
        sendTransferRushEmail: sendTransferRushEmail
    };
})();
