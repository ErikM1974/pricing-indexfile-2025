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
        // `_lines` is an in-memory pass-through from handleSubmit() so the email
        // renders the actual just-submitted lines (GET /:id round-trip avoided).
        // Falls back to record.lines (from backend GET) or synthesizes from legacy top-level cols.
        var lines = (overrides && overrides._lines) || record._lines || record.lines || null;
        if (!lines || (Array.isArray(lines) && lines.length === 0)) {
            if (record.Quantity || record.Transfer_Size) {
                lines = [{
                    Quantity: record.Quantity,
                    Transfer_Size: record.Transfer_Size,
                    Press_Count: record.Press_Count,
                    Transfer_Width_In: record.Transfer_Width_In,
                    Transfer_Height_In: record.Transfer_Height_In,
                    File_Notes: record.File_Notes
                }];
            } else {
                lines = [];
            }
        }

        var isReorder = !!record.Is_Reorder;
        var totalQty = lines.reduce(function (sum, l) {
            var q = parseInt(l.Quantity, 10);
            return sum + (Number.isNaN(q) ? 0 : q);
        }, 0);

        // Summary fields — single-line legacy template variables fall back to line 1 or totals.
        var firstLine = lines[0] || {};

        var params = {
            id_transfer: record.ID_Transfer || '',
            design_number: record.Design_Number || '',
            company_name: record.Company_Name || '',
            customer_name: record.Customer_Name || '',
            rep_name: record.Sales_Rep_Name || record.Sales_Rep_Email || '',
            rep_email: record.Sales_Rep_Email || '',
            // Legacy single-line compat: quantity = total across lines, transfer_size = line 1 size.
            quantity: totalQty > 0 ? totalQty : (record.Quantity || '—'),
            transfer_size: firstLine.Transfer_Size || record.Transfer_Size || '—',
            press_count: firstLine.Press_Count || record.Press_Count || '—',
            line_count: lines.length || 1,
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
            rs_sfx: '', // Short alias (EmailJS subject field has ~60-char template limit)
            rush_banner_html: '',
            notes_block_html: '',
            special_block_html: '',
            files_html: buildFilesHtml(record),
            lines_html: buildLinesHtml(lines, isReorder),
            reorder_subject_suffix: isReorder && record.Supacolor_Order_Number
                ? ' — REORDER #' + record.Supacolor_Order_Number
                : '',
            ro_sfx: isReorder && record.Supacolor_Order_Number
                ? ' — REORDER #' + record.Supacolor_Order_Number
                : '', // Short alias for EmailJS subject field
            reorder_banner_html: isReorder ? buildReorderBanner(record) : '',
            // Legacy param — emit empty so mid-rollout EmailJS template doesn't error.
            print_specs_html: record.Primary_Color ? buildPrintSpecsHtml(record) : '',
            cc_email: ''
        };
        if (overrides) {
            Object.keys(overrides).forEach(function (k) {
                if (k.charAt(0) === '_') return; // Strip internal-use overrides (_lines, _dryRun)
                params[k] = overrides[k];
            });
        }
        return params;
    }

    /**
     * Render the transfer lines as an HTML table for the email body.
     */
    function buildLinesHtml(lines, isReorder) {
        if (!Array.isArray(lines) || lines.length === 0) {
            return '<div style="padding:10px 12px;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;font-size:13px;color:#92400e;">No transfer lines.</div>';
        }
        var rows = lines.map(function (l, i) {
            var dim = (l.Transfer_Width_In || l.Transfer_Height_In)
                ? escapeHtml((l.Transfer_Width_In || '?') + ' × ' + (l.Transfer_Height_In || '?') + ' in')
                : '—';
            var notes = l.File_Notes
                ? '<div style="color:#6b7280;font-size:12px;margin-top:3px;white-space:pre-wrap;">' + escapeHtml(l.File_Notes) + '</div>'
                : '';
            return '<tr>' +
                '<td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#6b7280;width:50px;">#' + (i + 1) + '</td>' +
                '<td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:700;">' + escapeHtml(l.Quantity || '?') + '</td>' +
                '<td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">' + escapeHtml(l.Transfer_Size || '—') + '</td>' +
                '<td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">' + dim + '</td>' +
                '<td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">' + escapeHtml(l.Press_Count || '1') + notes + '</td>' +
            '</tr>';
        }).join('');
        return '<h3 style="color:#4a6fa5;font-size:15px;margin:18px 0 8px;">' +
                (isReorder ? 'Reorder ' : '') + 'Transfer Lines (' + lines.length + ')</h3>' +
            '<table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;font-size:13px;">' +
                '<thead><tr style="background:#f9fafb;">' +
                    '<th style="padding:8px 10px;text-align:left;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Line</th>' +
                    '<th style="padding:8px 10px;text-align:left;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>' +
                    '<th style="padding:8px 10px;text-align:left;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Size</th>' +
                    '<th style="padding:8px 10px;text-align:left;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">W × H</th>' +
                    '<th style="padding:8px 10px;text-align:left;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Press / Notes</th>' +
                '</tr></thead>' +
                '<tbody>' + rows + '</tbody>' +
            '</table>';
    }

    /**
     * Reorder banner — shown above the files/lines block to signal Bradley
     * can skip artwork lookup and just pull the existing Supacolor job.
     */
    function buildReorderBanner(record) {
        var num = record.Supacolor_Order_Number ? escapeHtml(record.Supacolor_Order_Number) : '(not provided)';
        return '<div style="background:#dcfce7;border-left:4px solid #16a34a;padding:12px 16px;margin:12px 0;border-radius:4px;">' +
                '<strong style="color:#166534;font-size:15px;">🔁 REORDER — Supacolor #' + num + '</strong>' +
                '<div style="color:#166534;font-size:13px;margin-top:4px;">Artwork is already on file at Supacolor. No new files needed — pull the existing job and re-order.</div>' +
            '</div>';
    }

    /**
     * Pre-render the files list as HTML for inclusion in emails.
     * Supports primary + up to 2 additional files.
     */
    function buildFilesHtml(record) {
        // Reorders intentionally carry no files — the reorder_banner_html explains why.
        // Return empty string so the EmailJS template's {{{files_html}}} collapses cleanly.
        if (record && record.Is_Reorder) return '';

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

        // Heading is bundled here so the template only needs {{{files_html}}} —
        // when there are no files (reorder OR edge case) the whole section vanishes.
        var heading = '<h3 style="color:#4a6fa5;font-size:15px;margin:18px 0 8px;">Working Files</h3>';

        if (files.length === 0) {
            return heading +
                '<div style="padding:10px 12px;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;font-size:13px;color:#92400e;">No working files attached.</div>';
        }
        return heading + files.map(function (f) {
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
            overrides.rs_sfx = ' 🚨 RUSH'; // Short alias for EmailJS subject
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
                        '<form id="tas-send-form" class="tas-form">' +

                            // ── MODE TOGGLE ──
                            '<div class="tas-mode-toggle" role="tablist">' +
                                '<label class="tas-mode-option tas-mode-option--new tas-mode-option--active" data-mode="new">' +
                                    '<input type="radio" name="Mode" value="new" checked>' +
                                    '<i class="fas fa-file-upload"></i> New Design' +
                                '</label>' +
                                '<label class="tas-mode-option tas-mode-option--reorder" data-mode="reorder">' +
                                    '<input type="radio" name="Mode" value="reorder">' +
                                    '<i class="fas fa-redo"></i> Reorder' +
                                '</label>' +
                            '</div>' +
                            '<div class="tas-mode-hint" id="tas-mode-hint">' +
                                'New artwork — pick files from Box, add one or more transfer lines.' +
                            '</div>' +

                            '<div class="tas-context" id="tas-context"></div>' +

                            // ── REORDER: Supacolor Order Number (visible only in Reorder mode) ──
                            '<div class="tas-form-row" id="tas-supacolor-number-row">' +
                                '<div class="tas-form-field tas-form-field--full">' +
                                    '<label for="tas-supacolor-number">Supacolor Order # *</label>' +
                                    '<input type="text" id="tas-supacolor-number" name="Supacolor_Order_Number" placeholder="e.g. 640003">' +
                                    '<div class="tas-hint">Bradley will look up the existing artwork in Supacolor with this number.</div>' +
                                '</div>' +
                            '</div>' +

                            // ── FILE PICKER (hidden in Reorder mode) ──
                            '<fieldset class="tas-fieldset" id="tas-files-fieldset">' +
                                '<legend>Files <span class="tas-muted" id="tas-file-counter">(0 / 3 selected)</span></legend>' +
                                '<div class="tas-folder-banner" id="tas-folder-banner">' +
                                    '<i class="fas fa-folder-open"></i> <span id="tas-folder-name">Loading your Box folder...</span>' +
                                '</div>' +
                                '<div id="tas-files-list" class="tas-files-list">' +
                                    '<div class="tas-loading"><i class="fas fa-spinner fa-spin"></i> Loading files...</div>' +
                                '</div>' +
                                '<div class="tas-hint">Tip: Steve normally picks the layered AI + a flattened print-ready file. Pick up to <strong>3</strong>.</div>' +
                            '</fieldset>' +

                            // ── TRANSFER LINES (repeater) ──
                            '<fieldset class="tas-fieldset">' +
                                '<legend>Transfer Lines <span class="tas-muted" id="tas-line-counter">(1 line)</span></legend>' +
                                '<div id="tas-lines" class="tas-lines"></div>' +
                                '<button type="button" class="tas-add-line-btn" id="tas-add-line-btn">' +
                                    '<i class="fas fa-plus"></i> Add another transfer line' +
                                '</button>' +
                                '<datalist id="tas-size-options">' +
                                    '<option value="8x10">' +
                                    '<option value="11x14">' +
                                    '<option value="12x12">' +
                                    '<option value="Adult Full Front">' +
                                    '<option value="Left Chest">' +
                                    '<option value="Sleeve">' +
                                '</datalist>' +
                            '</fieldset>' +

                            // ── JOB-LEVEL FIELDS (Primary Color, Special Instructions, Rush) ──
                            '<fieldset class="tas-fieldset">' +
                                '<legend>Job Info</legend>' +
                                '<div class="tas-form-row" id="tas-primary-color-row">' +
                                    '<div class="tas-form-field tas-form-field--full">' +
                                        '<label for="tas-primary-color">Primary Color / PMS <span class="tas-muted">(optional)</span></label>' +
                                        '<input type="text" id="tas-primary-color" name="Primary_Color" placeholder="e.g. PMS 186C — only if customer has strict brand colors">' +
                                    '</div>' +
                                '</div>' +
                                '<div class="tas-form-row">' +
                                    '<div class="tas-form-field tas-form-field--full">' +
                                        '<label for="tas-special">Special Instructions <span class="tas-muted">(gang runs, matching samples, etc.)</span></label>' +
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

    // ── Transfer line repeater ────────────────────────────────────────
    // Single source of truth for rendering individual transfer lines.
    // Each row: Qty (required), Transfer Size, Press Count, W, H, File Notes.
    // First row is non-removable; subsequent rows get a [x] button.
    function buildLineRowHtml(index, values) {
        var v = values || {};
        var firstClass = index === 0 ? ' tas-line-row--first' : '';
        return '<div class="tas-line-row' + firstClass + '" data-line-index="' + index + '">' +
                '<div class="tas-line-row__header">' +
                    '<span>Line ' + (index + 1) + '</span>' +
                    '<button type="button" class="tas-line-row__remove" aria-label="Remove line">' +
                        '<i class="fas fa-times"></i> Remove' +
                    '</button>' +
                '</div>' +
                '<div class="tas-form-row tas-form-row--3col">' +
                    '<div class="tas-form-field">' +
                        '<label>Quantity *</label>' +
                        '<input type="number" class="tas-line-qty" data-field="Quantity" min="1" required value="' + escapeHtml(v.Quantity || '') + '">' +
                    '</div>' +
                    '<div class="tas-form-field">' +
                        '<label>Transfer Size</label>' +
                        '<input type="text" class="tas-line-size" data-field="Transfer_Size" placeholder="e.g. 11x14" list="tas-size-options" value="' + escapeHtml(v.Transfer_Size || '') + '">' +
                    '</div>' +
                    '<div class="tas-form-field">' +
                        '<label>Press Count</label>' +
                        '<input type="number" class="tas-line-press" data-field="Press_Count" min="1" value="' + escapeHtml(v.Press_Count || '1') + '">' +
                    '</div>' +
                '</div>' +
                '<div class="tas-form-row">' +
                    '<div class="tas-form-field">' +
                        '<label>Width (in)</label>' +
                        '<input type="number" class="tas-line-width" data-field="Transfer_Width_In" step="0.25" value="' + escapeHtml(v.Transfer_Width_In || '') + '">' +
                    '</div>' +
                    '<div class="tas-form-field">' +
                        '<label>Height (in)</label>' +
                        '<input type="number" class="tas-line-height" data-field="Transfer_Height_In" step="0.25" value="' + escapeHtml(v.Transfer_Height_In || '') + '">' +
                    '</div>' +
                '</div>' +
                '<div class="tas-form-row">' +
                    '<div class="tas-form-field tas-form-field--full">' +
                        '<label>File Notes <span class="tas-muted">(Pantone, print direction, line-specific notes)</span></label>' +
                        '<textarea class="tas-line-notes" data-field="File_Notes" rows="2">' + escapeHtml(v.File_Notes || '') + '</textarea>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    function renderLines(lines) {
        var container = $('#tas-lines');
        if (!container) return;
        var arr = (Array.isArray(lines) && lines.length > 0) ? lines : [{}];
        container.innerHTML = arr.map(function (l, i) { return buildLineRowHtml(i, l); }).join('');
        updateLineCounter();
        wireLineRowEvents();
    }

    function addLineRow() {
        var container = $('#tas-lines');
        if (!container) return;
        var index = container.querySelectorAll('.tas-line-row').length;
        container.insertAdjacentHTML('beforeend', buildLineRowHtml(index, {}));
        updateLineCounter();
        wireLineRowEvents();
        updateSubmitButton();
    }

    function removeLineRow(index) {
        var container = $('#tas-lines');
        if (!container) return;
        var rows = container.querySelectorAll('.tas-line-row');
        if (rows.length <= 1) return; // Never remove the last line
        if (rows[index]) rows[index].remove();
        // Renumber remaining rows
        container.querySelectorAll('.tas-line-row').forEach(function (row, i) {
            row.setAttribute('data-line-index', i);
            var label = row.querySelector('.tas-line-row__header span');
            if (label) label.textContent = 'Line ' + (i + 1);
            row.classList.toggle('tas-line-row--first', i === 0);
        });
        updateLineCounter();
        updateSubmitButton();
    }

    function wireLineRowEvents() {
        $$('#tas-lines .tas-line-row__remove').forEach(function (btn) {
            // Replace to avoid double-wiring after re-render
            btn.onclick = function () {
                var row = btn.closest('.tas-line-row');
                if (!row) return;
                var idx = parseInt(row.getAttribute('data-line-index'), 10);
                removeLineRow(idx);
            };
        });
        $$('#tas-lines .tas-line-qty').forEach(function (input) {
            input.oninput = updateSubmitButton;
        });
    }

    function updateLineCounter() {
        var count = document.querySelectorAll('#tas-lines .tas-line-row').length;
        var el = $('#tas-line-counter');
        if (el) el.textContent = '(' + count + ' line' + (count === 1 ? '' : 's') + ')';
    }

    function collectLines() {
        var rows = $$('#tas-lines .tas-line-row');
        var out = [];
        rows.forEach(function (row) {
            var line = {};
            row.querySelectorAll('[data-field]').forEach(function (input) {
                var v = input.value;
                if (v === '' || v === null || v === undefined) return;
                var field = input.getAttribute('data-field');
                if (field === 'Quantity' || field === 'Press_Count') {
                    var n = parseInt(v, 10);
                    if (!Number.isNaN(n)) line[field] = n;
                } else if (field === 'Transfer_Width_In' || field === 'Transfer_Height_In') {
                    var f = parseFloat(v);
                    if (!Number.isNaN(f)) line[field] = f;
                } else {
                    line[field] = v;
                }
            });
            // Skip empty rows (no qty)
            if (line.Quantity && line.Quantity > 0) out.push(line);
        });
        return out;
    }

    // ── Mode toggle (New Design vs Reorder) ───────────────────────────
    function setMode(mode) {
        var modal = $('#tas-modal');
        if (!modal) return;
        modalState.mode = (mode === 'reorder') ? 'reorder' : 'new';
        modal.classList.toggle('tas-mode-reorder', modalState.mode === 'reorder');

        // Visual toggle of option chips
        $$('.tas-mode-option', modal).forEach(function (opt) {
            var isActive = opt.getAttribute('data-mode') === modalState.mode;
            opt.classList.toggle('tas-mode-option--active', isActive);
            var input = opt.querySelector('input[type="radio"]');
            if (input) input.checked = isActive;
        });

        // Hint text
        var hint = $('#tas-mode-hint');
        if (hint) {
            hint.textContent = modalState.mode === 'reorder'
                ? 'Reorder — enter the existing Supacolor order # below. No new artwork needed; Bradley has it on file.'
                : 'New artwork — pick files from Box, add one or more transfer lines.';
        }

        updateSubmitButton();
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

        // Mode toggle (New Design / Reorder)
        $$('.tas-mode-option', tasModal).forEach(function (opt) {
            opt.addEventListener('click', function () {
                var mode = opt.getAttribute('data-mode');
                setMode(mode);
            });
        });

        // Add-another-line button
        var addLineBtn = $('#tas-add-line-btn');
        if (addLineBtn) addLineBtn.addEventListener('click', addLineRow);

        // Supacolor_Order_Number live-validate for reorder mode
        var supacolorInput = $('#tas-supacolor-number');
        if (supacolorInput) supacolorInput.addEventListener('input', updateSubmitButton);

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
            if (!data.success) {
                // M7 — Log the full response body so debugging isn't discarded
                console.error('[transfer-actions] Box API returned success=false:', data);
                throw new Error(data.error || 'Box lookup failed');
            }

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
        // M6 — Drop inline `onerror=` attribute. If the DOM mutated mid-load, the inline
        // handler could read a now-null `nextElementSibling` and throw. Bind the fallback
        // programmatically after the row is constructed.
        var html = files.map(function (f) {
            var thumbUrl = f.thumbnailUrl ? (API_BASE + f.thumbnailUrl) : null;
            var thumbHtml = thumbUrl
                ? '<img src="' + escapeHtml(thumbUrl) + '" alt="" class="tas-file-thumb" data-has-fallback="1">' +
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

        var listEl = $('#tas-files-list');
        if (!listEl) return;
        listEl.innerHTML = html;

        // Bind onerror fallback for each thumbnail (M6)
        listEl.querySelectorAll('img.tas-file-thumb[data-has-fallback]').forEach(function (img) {
            img.addEventListener('error', function () {
                img.style.display = 'none';
                var sibling = img.nextElementSibling;
                if (sibling) sibling.style.display = 'flex';
            });
        });

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
        // Validation depends on mode. Submit enabled when:
        //   - At least one line has a valid Quantity (>0)
        //   - New Design mode: at least 1 Box file selected
        //   - Reorder mode: Supacolor_Order_Number filled
        var lines = collectLines();
        var hasValidLine = lines.length > 0;
        var btn = $('#tas-submit-btn');
        if (!btn) return;

        var valid = hasValidLine;
        if (modalState.mode === 'reorder') {
            var sNum = $('#tas-supacolor-number');
            valid = valid && sNum && sNum.value.trim().length > 0;
        } else {
            valid = valid && modalState.selectedFileIds.length > 0;
        }
        btn.disabled = !valid;
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
        // enableLines controls whether the user can add multiple transfer lines.
        // Default: true (Steve's dashboard). Legacy callers (mockup-detail,
        // art-request-detail) can pass { enableLines: false } to stay single-line.
        modalState.enableLines = (opts.enableLines !== false);

        // Reset form
        var form = $('#tas-send-form');
        form.reset();
        $('#tas-rush-details').style.display = 'none';
        $('#tas-rush-reason-row').style.display = 'none';
        updateFileCounter();

        // Set initial mode (New Design unless caller asked for reorder)
        setMode(opts.mode === 'reorder' ? 'reorder' : 'new');

        // Render lines (prefill from opts.prefillLines, or single row from opts.prefill for legacy callers)
        var initialLines;
        if (Array.isArray(opts.prefillLines) && opts.prefillLines.length > 0) {
            initialLines = opts.prefillLines;
        } else if (opts.prefill && (opts.prefill.Quantity || opts.prefill.Transfer_Size)) {
            initialLines = [{
                Quantity: opts.prefill.Quantity,
                Transfer_Size: opts.prefill.Transfer_Size,
                Press_Count: opts.prefill.Press_Count,
                File_Notes: opts.prefill.File_Notes
            }];
        } else {
            initialLines = [{}];
        }
        renderLines(initialLines);

        // Toggle single-line layout for legacy callers
        var linesContainer = $('#tas-lines');
        if (linesContainer) {
            linesContainer.parentElement.classList.toggle('tas-lines--single', !modalState.enableLines);
        }
        var addBtn = $('#tas-add-line-btn');
        if (addBtn) addBtn.style.display = modalState.enableLines ? '' : 'none';

        // Prefill Supacolor # (reorder direct-launch)
        if (opts.prefillSupacolorNumber) {
            var sNum = $('#tas-supacolor-number');
            if (sNum) sNum.value = opts.prefillSupacolorNumber;
        }

        // Fill in context (Design #, Company, Customer, Rep)
        renderContext(opts);

        updateSubmitButton();

        // Show modal
        $('#tas-modal').style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Fetch Box files (only useful in New Design mode, but always load
        // so toggling to New Design after reorder doesn't show a stale state)
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

        var isReorder = (modalState.mode === 'reorder');
        var lines = collectLines();
        if (lines.length === 0) {
            showToast('Add at least one transfer line with a quantity.', 'error');
            submitBtn.disabled = false;
            return;
        }

        try {
            var linked = [];

            // 1. Create shared links for Box files — only in New Design mode.
            //    Reorders don't need new artwork (Supacolor has it on file).
            if (!isReorder) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating shared links...';
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
                linked = await Promise.all(linkPromises);
            }

            // 2. Build transfer payload
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating transfer...';

            var payload = {
                Design_Number: opts.designNumber,
                Requested_By: user.email,
                Requested_By_Name: user.name,
                Status: 'Requested',
                Is_Reorder: isReorder,
                lines: lines
            };
            if (opts.designId) payload.Design_ID = opts.designId;
            if (opts.mockupId) payload.Mockup_ID = opts.mockupId;

            // Prefill pass-through (denormalized columns)
            if (opts.prefill) {
                ['Company_Name','Customer_Name','Sales_Rep_Email','Sales_Rep_Name']
                    .forEach(function (k) { if (opts.prefill[k]) payload[k] = opts.prefill[k]; });
            }

            // Job-level fields from the form
            var rushEl = $('#tas-rush');
            payload.Is_Rush = !!(rushEl && rushEl.checked);
            var neededBy = $('#tas-needed-by');
            if (neededBy && neededBy.value) payload.Needed_By_Date = neededBy.value;
            var rushReason = $('#tas-rush-reason');
            if (rushReason && rushReason.value) payload.Rush_Reason = rushReason.value;
            var specialEl = $('#tas-special');
            if (specialEl && specialEl.value) payload.Special_Instructions = specialEl.value;
            var primaryColorEl = $('#tas-primary-color');
            if (!isReorder && primaryColorEl && primaryColorEl.value) {
                payload.Primary_Color = primaryColorEl.value;
            }
            var supacolorEl = $('#tas-supacolor-number');
            if (isReorder && supacolorEl && supacolorEl.value) {
                payload.Supacolor_Order_Number = supacolorEl.value.trim();
            }

            // Denormalized working-file columns (kept for backward compat with
            // Bradley's queue / detail page legacy-view code paths). Only applies
            // to New Design mode — reorders carry no files.
            if (!isReorder) {
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
            }

            // Dry-run path (append ?dryRun=1 to URL for local verification without hitting API).
            // Logs the full payload and would-be email params, shows a toast, skips network.
            if (/[?&]dryRun=1\b/.test(window.location.search)) {
                console.log('[DRYRUN] POST /api/transfer-orders', payload);
                var fakeRecord = Object.assign({ ID_Transfer: 'ST-DRYRUN-0000' }, payload);
                delete fakeRecord.lines;
                // Simulate rush overrides that sendTransferRequestedEmail() would add —
                // otherwise dry-run shows empty rush_* params even when rush is checked.
                var dryRunOverrides = { to_email: BRADLEY_EMAIL, cc_email: user.email, _dryRun: true, _lines: lines };
                if (fakeRecord.Is_Rush) {
                    dryRunOverrides.rush_subject_suffix = ' 🚨 RUSH';
                    dryRunOverrides.rs_sfx = ' 🚨 RUSH';
                    dryRunOverrides.rush_banner_html = buildRushBanner(fakeRecord);
                }
                console.log('[DRYRUN] transfer_requested email params:',
                    buildEmailParams(fakeRecord, dryRunOverrides));
                closeModal();
                showToast('DRY RUN — payload logged to console. No network call.', 'info');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send to Supacolor';
                return;
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
            var msg = 'Transfer ' + (createData.record.ID_Transfer || '') + ' sent to Bradley';
            if (isReorder) msg += ' (Reorder #' + payload.Supacolor_Order_Number + ')';
            if (lines.length > 1) msg += ' · ' + lines.length + ' lines';
            showToast(msg + '.', 'success');

            // Attach returned lines to the record so the email builder can render them.
            var recordForEmail = Object.assign({}, createData.record, { _lines: createData.lines || lines });

            // Fire EmailJS notification (non-blocking) — Bradley + CC requester
            sendTransferRequestedEmail(recordForEmail, user);

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
