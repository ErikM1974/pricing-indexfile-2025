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
    // v3 paste-links modal (2026-04-24): Steve pastes 1..N Box URLs and the
    // backend's /api/transfer-orders/analyze-link cracks each one into
    // {filename parse, image metadata, mockup vision, sales rep resolve}.
    // We just hold the per-row analysis state here.
    var modalState = {
        injected: false,
        opts: null,
        linkRows: [] // [{ id, url, status: 'idle'|'analyzing'|'ok'|'err', analysis, error }]
    };
    var _rowIdCounter = 0;

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
            // v3 additions (2026-04-24): pulled from mockup vision extraction.
            // transfer_type is persisted on Transfer_Orders; garment_info is
            // transient — only populated via overrides at submit time because
            // we don't store Garment_Color_Style to Caspio.
            transfer_type: record.Transfer_Type || '',
            garment_info: '',
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
     *
     * @param {object} record - Transfer_Orders row (as created)
     * @param {object} requestedBy - { email, name } of submitter
     * @param {object} [visionExtras] - v3 mockup vision data (optional). When
     *   provided, enriches the email with garment + transfer type (fields we
     *   don't persist to Caspio — see buildEmailParams header comment).
     *   Shape: { garmentColorStyle: string, transferType: string }
     */
    function sendTransferRequestedEmail(record, requestedBy, visionExtras) {
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
        // v3 overrides: only populated when the caller has the mockup vision
        // extraction in hand (i.e. the initial submit from handleSubmit — the
        // only path that currently provides visionExtras).
        if (visionExtras) {
            if (visionExtras.garmentColorStyle) {
                overrides.garment_info = visionExtras.garmentColorStyle;
            }
            // transferType is already baked into record.Transfer_Type via the
            // submit payload, so buildEmailParams reads it from the record.
            // Allow an override here too in case a caller wants to force it.
            if (visionExtras.transferType) {
                overrides.transfer_type = visionExtras.transferType;
            }
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

    // ── Modal HTML (v3 paste-links) ──────────────────────────────────
    // Steve pastes 1..N Box URLs. Each URL is analyzed automatically via
    // /api/transfer-orders/analyze-link → filename parse + image metadata
    // + (for mockups) Claude vision extraction + sales rep resolve.
    // Steve types nothing else beyond the optional Rush checkbox.

    function injectModal() {
        if (modalState.injected) return;
        var html =
            '<div id="tas-modal" class="tas-modal" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="tas-modal-title">' +
                '<div class="tas-modal-backdrop"></div>' +
                '<div class="tas-modal-content tas-modal-content--paste">' +
                    '<div class="tas-modal-header">' +
                        '<h3 id="tas-modal-title"><i class="fas fa-paper-plane"></i> Send to Supacolor</h3>' +
                        '<button type="button" class="tas-modal-close" aria-label="Close">&times;</button>' +
                    '</div>' +
                    '<div class="tas-modal-body">' +
                        '<div class="tas-modal-intro">' +
                            'Search your Box art folder by design # or company name. Click a folder to pick the transfer + mockup files.' +
                        '</div>' +
                        '<form id="tas-send-form" class="tas-form">' +
                            // ── Picker: search box + folder/file results ──
                            '<div class="tas-picker">' +
                                '<div class="tas-picker-search">' +
                                    '<i class="fas fa-search tas-picker-search-icon"></i>' +
                                    '<input type="text" id="tas-picker-search-input" class="tas-picker-search-input" placeholder="Search design # or company (e.g. 39721 or Asphalt Patch)" autocomplete="off">' +
                                    '<button type="button" id="tas-picker-clear" class="tas-picker-clear" style="display:none;" aria-label="Clear">&times;</button>' +
                                '</div>' +
                                '<div id="tas-picker-results" class="tas-picker-results"></div>' +
                                '<div id="tas-picker-recent" class="tas-picker-recent"></div>' +
                            '</div>' +
                            // ── Fallback: paste URL directly ──
                            '<details id="tas-paste-details" class="tas-paste-details">' +
                                '<summary>Or paste a Box link manually</summary>' +
                                '<div id="tas-link-rows" class="tas-link-rows"></div>' +
                                '<button type="button" id="tas-add-row" class="tas-add-row-btn">' +
                                    '<i class="fas fa-plus"></i> Paste another link' +
                                '</button>' +
                            '</details>' +
                            '<div id="tas-mockup-summary" class="tas-mockup-summary" style="display:none;"></div>' +
                            '<div class="tas-form-row tas-form-row--rush">' +
                                '<label class="tas-checkbox-label">' +
                                    '<input type="checkbox" id="tas-rush" name="Is_Rush"> ' +
                                    '<strong>\ud83d\udea8 RUSH order</strong>' +
                                    '<span class="tas-muted"> \u2014 Bradley sees a red flag on his queue</span>' +
                                '</label>' +
                            '</div>' +
                            '<div class="tas-form-actions">' +
                                '<button type="button" class="tas-btn tas-btn--secondary tas-modal-cancel">Cancel</button>' +
                                '<button type="submit" class="tas-btn tas-btn--primary" id="tas-submit-btn" disabled>' +
                                    '<i class="fas fa-paper-plane"></i> Send to Bradley' +
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
        var modal = $('#tas-modal');
        if (!modal) return;
        var closeBtn = $('#tas-modal .tas-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        $$('.tas-modal-cancel', modal).forEach(function (b) { b.addEventListener('click', closeModal); });
        var backdrop = $('#tas-modal .tas-modal-backdrop');
        if (backdrop) backdrop.addEventListener('click', closeModal);
        var addBtn = $('#tas-add-row');
        if (addBtn) addBtn.addEventListener('click', function () { addLinkRow(true); });
        var form = $('#tas-send-form');
        if (form) form.addEventListener('submit', handleSubmit);

        // Picker: debounced search on keyup
        var searchInput = $('#tas-picker-search-input');
        var clearBtn = $('#tas-picker-clear');
        if (searchInput) {
            var searchDebounce;
            searchInput.addEventListener('input', function () {
                var q = searchInput.value.trim();
                clearBtn.style.display = q ? '' : 'none';
                clearTimeout(searchDebounce);
                if (q.length < 2) {
                    renderRecentFolders();
                    $('#tas-picker-results').innerHTML = '';
                    return;
                }
                searchDebounce = setTimeout(function () { pickerSearch(q); }, 300);
            });
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                searchInput.value = '';
                clearBtn.style.display = 'none';
                $('#tas-picker-results').innerHTML = '';
                renderRecentFolders();
                searchInput.focus();
            });
        }

        // When Steve opens the "Or paste a Box link manually" fallback,
        // make sure there's at least one empty paste row to type into.
        var pasteDetails = $('#tas-paste-details');
        if (pasteDetails) {
            pasteDetails.addEventListener('toggle', function () {
                if (pasteDetails.open && modalState.linkRows.length === 0) {
                    addLinkRow(true);
                }
            });
        }

        document.addEventListener('keydown', function (e) {
            var m = $('#tas-modal');
            if (e.key === 'Escape' && m && m.style.display !== 'none') closeModal();
        });
    }

    // ── Picker: search + folder/file browse ──────────────────────────

    var RECENT_FOLDERS_KEY = 'tas-recent-folders';
    var RECENT_FOLDERS_MAX = 5;

    function getRecentFolders() {
        try {
            var raw = localStorage.getItem(RECENT_FOLDERS_KEY);
            if (!raw) return [];
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
    }

    function recordRecentFolder(folder) {
        if (!folder || !folder.id || !folder.name) return;
        var list = getRecentFolders().filter(function (f) { return f.id !== folder.id; });
        list.unshift({ id: folder.id, name: folder.name, at: Date.now() });
        list = list.slice(0, RECENT_FOLDERS_MAX);
        try { localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(list)); } catch (e) {}
    }

    function renderRecentFolders() {
        var container = $('#tas-picker-recent');
        if (!container) return;
        var list = getRecentFolders();
        if (!list.length) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = '<div class="tas-picker-recent-label">Recent folders</div>' +
            '<div class="tas-picker-recent-pills">' +
            list.map(function (f) {
                return '<button type="button" class="tas-picker-pill" data-folder-id="' + escapeHtml(f.id) + '" data-folder-name="' + escapeHtml(f.name) + '">' +
                    '<i class="fas fa-folder"></i> ' + escapeHtml(f.name) +
                    '</button>';
            }).join('') +
            '</div>';
        $$('#tas-picker-recent .tas-picker-pill').forEach(function (btn) {
            btn.addEventListener('click', function () {
                loadFolderFiles(this.getAttribute('data-folder-id'), this.getAttribute('data-folder-name'));
            });
        });
    }

    async function pickerSearch(query) {
        var results = $('#tas-picker-results');
        var recent = $('#tas-picker-recent');
        if (recent) recent.innerHTML = '';
        results.innerHTML = '<div class="tas-picker-busy"><i class="fas fa-spinner fa-spin"></i> Searching Box...</div>';
        try {
            var resp = await fetch(API_BASE + '/api/box/search?query=' + encodeURIComponent(query) + '&type=folder&limit=20');
            var data = await resp.json();
            if (!resp.ok || !data.success) throw new Error(data.error || 'search failed');
            renderSearchResults(data.entries || []);
        } catch (err) {
            console.warn('[tas picker] search failed:', err);
            results.innerHTML = '<div class="tas-picker-err"><i class="fas fa-exclamation-triangle"></i> ' + escapeHtml(err.message || 'Search failed') + '</div>';
        }
    }

    function renderSearchResults(entries) {
        var results = $('#tas-picker-results');
        if (!entries.length) {
            results.innerHTML = '<div class="tas-picker-empty">No folders match. Try a different design # or company name.</div>';
            return;
        }
        results.innerHTML = '<div class="tas-picker-results-label">' + entries.length + ' folder' + (entries.length === 1 ? '' : 's') + ' found</div>' +
            '<div class="tas-picker-folder-list">' +
            entries.map(function (e) {
                return '<button type="button" class="tas-picker-folder" data-folder-id="' + escapeHtml(e.id) + '" data-folder-name="' + escapeHtml(e.name) + '">' +
                    '<i class="fas fa-folder"></i>' +
                    '<span>' + escapeHtml(e.name) + '</span>' +
                    '<i class="fas fa-chevron-right tas-picker-folder-arrow"></i>' +
                    '</button>';
            }).join('') +
            '</div>';
        $$('#tas-picker-results .tas-picker-folder').forEach(function (btn) {
            btn.addEventListener('click', function () {
                loadFolderFiles(this.getAttribute('data-folder-id'), this.getAttribute('data-folder-name'));
            });
        });
    }

    async function loadFolderFiles(folderId, folderName) {
        var results = $('#tas-picker-results');
        var recent = $('#tas-picker-recent');
        if (recent) recent.innerHTML = '';
        results.innerHTML = '<div class="tas-picker-busy"><i class="fas fa-spinner fa-spin"></i> Loading files...</div>';
        recordRecentFolder({ id: folderId, name: folderName });
        try {
            var resp = await fetch(API_BASE + '/api/box/folder-files?folderId=' + encodeURIComponent(folderId));
            var data = await resp.json();
            if (!resp.ok || !data.success) throw new Error(data.error || 'folder-files failed');
            renderFileGrid(folderId, folderName, data.files || []);
        } catch (err) {
            console.warn('[tas picker] folder load failed:', err);
            results.innerHTML = '<div class="tas-picker-err"><i class="fas fa-exclamation-triangle"></i> ' + escapeHtml(err.message || 'Load failed') + '</div>';
        }
    }

    function renderFileGrid(folderId, folderName, files) {
        var results = $('#tas-picker-results');
        // Filter out obviously irrelevant files — .psd sources are too big to send,
        // Steve usually sends .png transfers + .jpg mockups. Keep them in the list
        // but sort so PNG/JPG float to the top.
        var sorted = files.slice().sort(function (a, b) {
            var aExt = String(a.extension || '').toLowerCase();
            var bExt = String(b.extension || '').toLowerCase();
            var order = { png: 1, jpg: 2, jpeg: 2, pdf: 3, gif: 4, webp: 5, psd: 10, ai: 10 };
            var aRank = order[aExt] || 20;
            var bRank = order[bExt] || 20;
            if (aRank !== bRank) return aRank - bRank;
            // Within a rank, newer first
            return (b.modified_at || '').localeCompare(a.modified_at || '');
        });

        results.innerHTML =
            '<div class="tas-picker-folder-header">' +
                '<button type="button" class="tas-picker-back" id="tas-picker-back-btn"><i class="fas fa-arrow-left"></i> Back</button>' +
                '<span class="tas-picker-folder-title"><i class="fas fa-folder-open"></i> ' + escapeHtml(folderName) + '</span>' +
            '</div>' +
            (sorted.length === 0
                ? '<div class="tas-picker-empty">No files in this folder.</div>'
                : '<div class="tas-picker-file-grid">' +
                    sorted.map(function (f) {
                        var thumb = f.thumbnailUrl
                            ? '<img src="' + escapeHtml(API_BASE + f.thumbnailUrl) + '" alt="" class="tas-picker-file-thumb" onerror="this.style.display=\'none\'">'
                            : '<div class="tas-picker-file-thumb tas-picker-file-thumb--placeholder"><i class="fas fa-file"></i></div>';
                        var ext = String(f.extension || '').toUpperCase();
                        var size = f.size ? formatBytes(f.size) : '';
                        var modified = f.modified_at ? new Date(f.modified_at).toLocaleDateString() : '';
                        return '<button type="button" class="tas-picker-file" data-file-id="' + escapeHtml(f.id) + '" data-file-name="' + escapeHtml(f.name) + '">' +
                            thumb +
                            '<div class="tas-picker-file-meta">' +
                                '<div class="tas-picker-file-name">' + escapeHtml(f.name) + '</div>' +
                                '<div class="tas-picker-file-sub">' + escapeHtml(ext) + (size ? ' \u00b7 ' + size : '') + (modified ? ' \u00b7 ' + escapeHtml(modified) : '') + '</div>' +
                            '</div>' +
                            '<i class="fas fa-plus-circle tas-picker-file-add"></i>' +
                        '</button>';
                    }).join('') +
                '</div>'
            );

        var backBtn = $('#tas-picker-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', function () {
                $('#tas-picker-results').innerHTML = '';
                renderRecentFolders();
                var searchInput = $('#tas-picker-search-input');
                if (searchInput && searchInput.value.trim().length >= 2) {
                    pickerSearch(searchInput.value.trim());
                }
            });
        }
        $$('#tas-picker-results .tas-picker-file').forEach(function (btn) {
            btn.addEventListener('click', function () {
                selectFileFromPicker(this.getAttribute('data-file-id'), this.getAttribute('data-file-name'), this);
            });
        });
    }

    /**
     * When Steve picks a file from the folder view:
     *  1. Mark the button as "added" (so he sees it worked + doesn't double-click)
     *  2. Generate a Box shared link via /api/box/shared-link
     *  3. Create a new link row with that URL
     *  4. Trigger analyze on that row (filename parse + metadata + vision)
     *  5. Open the <details> fallback so the user can see the analyzed card
     */
    async function selectFileFromPicker(fileId, fileName, btnEl) {
        if (btnEl && btnEl.classList.contains('tas-picker-file--added')) return; // double-click guard
        if (btnEl) {
            btnEl.classList.add('tas-picker-file--added');
            var addIcon = btnEl.querySelector('.tas-picker-file-add');
            if (addIcon) addIcon.className = 'fas fa-check-circle tas-picker-file-add tas-picker-file-add--done';
        }

        try {
            var resp = await fetch(API_BASE + '/api/box/shared-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId: fileId })
            });
            var data = await resp.json();
            if (!resp.ok || !data.success || !data.sharedLink) {
                throw new Error(data.error || 'shared-link generation failed');
            }
            // Open the paste-details panel so the analyzed result is visible
            var details = $('#tas-paste-details');
            if (details) details.open = true;
            // Add the URL to a new row and trigger analyze
            var row = newLinkRow();
            row.url = data.sharedLink;
            modalState.linkRows.push(row);
            renderLinkRows();
            // Kick analyze (sets status='analyzing', renders, then writes result)
            analyzeRow(row.id);
        } catch (err) {
            console.warn('[tas picker] shared-link failed:', err);
            showToast('Failed to generate Box shared link: ' + err.message, 'error');
            if (btnEl) btnEl.classList.remove('tas-picker-file--added');
        }
    }

    // ── Link-row repeater ─────────────────────────────────────────────

    function newLinkRow() {
        _rowIdCounter++;
        return { id: 'tas-link-' + _rowIdCounter, url: '', status: 'idle', analysis: null, error: null };
    }

    function addLinkRow(focusAfter) {
        modalState.linkRows.push(newLinkRow());
        renderLinkRows();
        if (focusAfter) {
            var last = modalState.linkRows[modalState.linkRows.length - 1];
            var input = document.querySelector('input[data-row-id="' + last.id + '"]');
            if (input) input.focus();
        }
    }

    function removeLinkRow(rowId) {
        modalState.linkRows = modalState.linkRows.filter(function (r) { return r.id !== rowId; });
        if (modalState.linkRows.length === 0) addLinkRow();
        renderLinkRows();
        updateSubmitButton();
        renderMockupSummary();
    }

    function renderLinkRows() {
        var container = $('#tas-link-rows');
        if (!container) return;
        container.innerHTML = modalState.linkRows.map(renderLinkRowHtml).join('');
        wireLinkRowEvents();
    }

    function renderLinkRowHtml(row) {
        var canRemove = modalState.linkRows.length > 1;
        var removeBtn = canRemove
            ? '<button type="button" class="tas-row-remove" data-action="remove-row" data-row-id="' + escapeHtml(row.id) + '" aria-label="Remove">&times;</button>'
            : '<span class="tas-row-remove-placeholder"></span>';

        var statusBlock = '';
        if (row.status === 'analyzing') {
            statusBlock = '<div class="tas-row-status tas-row-status--busy"><i class="fas fa-spinner fa-spin"></i> Analyzing\u2026</div>';
        } else if (row.status === 'err') {
            statusBlock = '<div class="tas-row-status tas-row-status--err"><i class="fas fa-exclamation-triangle"></i> ' + escapeHtml(row.error || 'Analysis failed') + '</div>';
        } else if (row.status === 'ok' && row.analysis) {
            statusBlock = renderAnalysisCard(row.analysis);
        }

        return '<div class="tas-link-row" data-row-id="' + escapeHtml(row.id) + '">' +
            '<div class="tas-link-row-input-line">' +
                '<input type="url" class="tas-link-input" placeholder="https://\u2026box.com/s/\u2026 or /file/\u2026" value="' + escapeHtml(row.url) + '" data-row-id="' + escapeHtml(row.id) + '">' +
                removeBtn +
            '</div>' +
            statusBlock +
        '</div>';
    }

    function renderAnalysisCard(a) {
        var parsed = a.filenameParsed || {};
        var type = parsed.type || 'file';
        var badgeIcon = type === 'mockup' ? 'image' : 'file-image';
        var badgeLabel = type === 'mockup' ? 'Mockup' : 'Transfer';

        var sizeStr = a.sizeBytes ? formatBytes(a.sizeBytes) : '';
        var pxStr = (a.pixelWidth && a.pixelHeight) ? (a.pixelWidth + '\u00d7' + a.pixelHeight + 'px') : '';
        var dpiStr = a.dpiX ? (a.dpiX + 'dpi') : '';
        var physStr = (a.physicalWidthIn && a.physicalHeightIn)
            ? (a.physicalWidthIn + '" \u00d7 ' + a.physicalHeightIn + '"')
            : '';
        var metaLine = [a.mimeType || 'file', sizeStr, pxStr, dpiStr, physStr].filter(Boolean).join(' \u00b7 ');

        var placementLine = '';
        if (type === 'transfer' && parsed.placementLabel) {
            placementLine = '<div class="tas-row-place"><i class="fas fa-map-marker-alt"></i> ' + escapeHtml(parsed.placementLabel) + '</div>';
        }

        var mismatchWarning = '';
        if (a.dimensionMismatch) {
            mismatchWarning = '<div class="tas-row-warn"><i class="fas fa-exclamation-triangle"></i> ' +
                'Filename says ' + escapeHtml(a.dimensionMismatch.claimed) + ' but file is actually ' + escapeHtml(a.dimensionMismatch.actual) + '. Fix the filename or re-export before sending.' +
                '</div>';
        }

        return '<div class="tas-row-card tas-row-card--' + escapeHtml(type) + '">' +
            '<div class="tas-row-head">' +
                '<span class="tas-row-badge"><i class="fas fa-' + escapeHtml(badgeIcon) + '"></i> ' + escapeHtml(badgeLabel) + '</span>' +
                '<span class="tas-row-filename">' + escapeHtml(a.fileName || '') + '</span>' +
            '</div>' +
            '<div class="tas-row-meta">' + escapeHtml(metaLine) + '</div>' +
            placementLine +
            mismatchWarning +
        '</div>';
    }

    function renderMockupSummary() {
        var container = $('#tas-mockup-summary');
        if (!container) return;

        var mockupAnalysis = modalState.linkRows
            .map(function (r) { return r.analysis; })
            .find(function (a) { return a && a.filenameParsed && a.filenameParsed.type === 'mockup'; });

        if (!mockupAnalysis) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        if (mockupAnalysis.mockupVisionError) {
            container.style.display = '';
            container.innerHTML = '<div class="tas-mockup-summary-head"><i class="fas fa-robot"></i> Mockup scan</div>' +
                '<div class="tas-row-warn">Couldn\'t auto-read this mockup. Bradley will still get the Box link but no pre-filled sales rep / garment info.</div>';
            return;
        }

        if (!mockupAnalysis.mockupVision) {
            container.style.display = 'none';
            return;
        }

        var v = mockupAnalysis.mockupVision;
        var rep = mockupAnalysis.salesRepMatch;
        var repLine = v.salesRep
            ? (rep
                ? escapeHtml(v.salesRep) + ' <span class="tas-crm-check"><i class="fas fa-check-circle"></i> ' + escapeHtml(rep.email) + '</span>'
                : escapeHtml(v.salesRep) + ' <span class="tas-crm-miss"><i class="fas fa-question-circle"></i> not in CRM</span>')
            : '<span class="tas-muted">(not detected)</span>';

        var rows = [
            { label: 'Design', value: escapeHtml(v.designNumber || '\u2014') },
            { label: 'Customer', value: escapeHtml(v.customerName || '\u2014') },
            { label: 'Sales Rep', value: repLine },
            { label: 'Garment', value: escapeHtml(v.garmentColorStyle || '\u2014') },
            { label: 'Transfer', value: escapeHtml(v.transferType || '\u2014') }
        ];
        container.style.display = '';
        container.innerHTML = '<div class="tas-mockup-summary-head"><i class="fas fa-robot"></i> Extracted from mockup</div>' +
            '<table class="tas-mockup-summary-table">' +
            rows.map(function (r) { return '<tr><td class="tas-label">' + r.label + '</td><td>' + r.value + '</td></tr>'; }).join('') +
            '</table>';
    }

    function wireLinkRowEvents() {
        $$('.tas-row-remove[data-action="remove-row"]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                removeLinkRow(this.getAttribute('data-row-id'));
            });
        });
        $$('.tas-link-input').forEach(function (input) {
            input.addEventListener('paste', function (e) {
                var rowId = this.getAttribute('data-row-id');
                // Let the paste land, then analyze on next tick
                setTimeout(function () { onLinkChange(rowId); }, 20);
            });
            input.addEventListener('blur', function () {
                onLinkChange(this.getAttribute('data-row-id'));
            });
            input.addEventListener('input', function () {
                var rowId = this.getAttribute('data-row-id');
                var row = modalState.linkRows.find(function (r) { return r.id === rowId; });
                if (row) row.url = this.value;
            });
        });
    }

    function onLinkChange(rowId) {
        var row = modalState.linkRows.find(function (r) { return r.id === rowId; });
        if (!row) return;
        var input = document.querySelector('input[data-row-id="' + rowId + '"]');
        if (input) row.url = (input.value || '').trim();
        if (!row.url) {
            row.status = 'idle'; row.analysis = null; row.error = null;
            renderLinkRows(); updateSubmitButton(); renderMockupSummary();
            return;
        }
        if (row.status === 'analyzing') return;
        // Skip re-analyze if URL hasn't changed and previous analysis succeeded
        if (row.status === 'ok' && row.analysis && row.analysis.sharedLink === row.url) return;
        analyzeRow(row.id);
    }

    async function analyzeRow(rowId) {
        var row = modalState.linkRows.find(function (r) { return r.id === rowId; });
        if (!row || !row.url) return;
        row.status = 'analyzing';
        row.error = null;
        renderLinkRows();

        try {
            var resp = await fetch(API_BASE + '/api/transfer-orders/analyze-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: row.url })
            });
            var data = await resp.json();
            if (!resp.ok || !data.success) throw new Error(data.error || ('HTTP ' + resp.status));
            row.status = 'ok';
            row.analysis = data;
        } catch (err) {
            console.warn('[transfer-actions] analyze-link failed:', err);
            row.status = 'err';
            row.error = err.message || 'Analysis failed';
        }
        renderLinkRows();
        updateSubmitButton();
        renderMockupSummary();
    }

    function updateSubmitButton() {
        var btn = $('#tas-submit-btn');
        if (!btn) return;
        var hasTransfer = modalState.linkRows.some(function (r) {
            return r.status === 'ok' && r.analysis && r.analysis.filenameParsed && r.analysis.filenameParsed.type === 'transfer';
        });
        btn.disabled = !hasTransfer;
    }

    // ── Open / Close ─────────────────────────────────────────────────

    function openSendModal(opts) {
        opts = opts || {};
        injectModal();
        modalState.opts = opts;
        modalState.linkRows = [];
        // Don't pre-populate a blank URL row — the picker is primary now.
        // If Steve opens the <details> "paste manually" fallback, it'll show
        // a fresh row at that point. Old renders get cleared here.
        renderLinkRows();
        var rushEl = $('#tas-rush');
        if (rushEl) rushEl.checked = false;
        var summary = $('#tas-mockup-summary');
        if (summary) { summary.style.display = 'none'; summary.innerHTML = ''; }
        var pasteDetails = $('#tas-paste-details');
        if (pasteDetails) pasteDetails.open = false;
        var searchInput = $('#tas-picker-search-input');
        if (searchInput) {
            searchInput.value = '';
            var clearBtn = $('#tas-picker-clear');
            if (clearBtn) clearBtn.style.display = 'none';
        }
        var results = $('#tas-picker-results');
        if (results) results.innerHTML = '';
        // Show recent folders (if any) as pills below the search box
        renderRecentFolders();
        updateSubmitButton();
        $('#tas-modal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        // Focus the search input for instant typing
        setTimeout(function () {
            var si = $('#tas-picker-search-input');
            if (si) si.focus();
        }, 80);
    }

    function closeModal() {
        var modal = $('#tas-modal');
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    // ── Submit ───────────────────────────────────────────────────────

    async function handleSubmit(e) {
        e.preventDefault();
        var opts = modalState.opts || {};
        var user = getCurrentUser(opts);

        if (!user) {
            var name = prompt('Your full name (for the audit trail):');
            if (!name) return;
            var email = prompt('Your email address:');
            if (!email) return;
            localStorage.setItem('transfer_user_name', name);
            localStorage.setItem('transfer_user_email', email);
            user = { name: name, email: email };
        }

        var good = modalState.linkRows.filter(function (r) { return r.status === 'ok' && r.analysis; });
        var transfers = good
            .filter(function (r) { return r.analysis.filenameParsed && r.analysis.filenameParsed.type === 'transfer'; })
            .map(function (r) { return r.analysis; });
        var mockups = good
            .filter(function (r) { return r.analysis.filenameParsed && r.analysis.filenameParsed.type === 'mockup'; })
            .map(function (r) { return r.analysis; });

        if (transfers.length === 0) {
            showToast('Need at least one transfer file before sending.', 'error');
            return;
        }

        var submitBtn = $('#tas-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending\u2026';

        try {
            var primary = transfers[0];
            var parsed = primary.filenameParsed;
            var mockup = mockups[0];
            var vision = mockup && mockup.mockupVision ? mockup.mockupVision : null;
            var repMatch = mockup && mockup.salesRepMatch ? mockup.salesRepMatch : null;

            var isRush = !!($('#tas-rush') && $('#tas-rush').checked);

            // Build one line per transfer file — dimensions come from actual
            // image metadata (source of truth) with a filename fallback.
            var lines = transfers.map(function (t) {
                var p = t.filenameParsed || {};
                var w = t.physicalWidthIn || p.filenameWidth || null;
                var h = t.physicalHeightIn || p.filenameHeight || null;
                var notesParts = [p.placementLabel];
                if (t.pixelWidth && t.pixelHeight) {
                    notesParts.push(t.pixelWidth + '\u00d7' + t.pixelHeight + 'px');
                }
                if (t.dpiX) notesParts.push(t.dpiX + 'dpi');
                return {
                    Quantity: null,             // Bradley fills from sales rep order
                    Transfer_Size: (w && h) ? (w + 'x' + h) : null,
                    Press_Count: null,
                    Transfer_Width_In: w,
                    Transfer_Height_In: h,
                    File_Notes: notesParts.filter(Boolean).join(' \u00b7 ')
                };
            });

            var payload = {
                Design_Number: parsed.designNumber,
                Company_Name: parsed.customer,
                Customer_Name: (vision && vision.customerName) || parsed.customer,
                Sales_Rep_Name: repMatch ? repMatch.name : (vision ? vision.salesRep : ''),
                Sales_Rep_Email: repMatch ? repMatch.email : '',
                Transfer_Type: vision ? vision.transferType : null,
                Status: 'Requested',
                Is_Rush: isRush,
                Is_Reorder: false,
                Requested_By: user.email,
                Requested_By_Name: user.name,
                lines: lines,
                Working_File_URL: primary.sharedLink,
                Working_File_Name: primary.fileName,
                Working_File_Type: primary.mimeType,
                Box_File_ID: primary.fileId
            };
            if (mockup) {
                payload.Additional_File_1_URL = mockup.sharedLink;
                payload.Additional_File_1_Name = mockup.fileName;
            }
            if (transfers[1]) {
                payload.Additional_File_2_URL = transfers[1].sharedLink;
                payload.Additional_File_2_Name = transfers[1].fileName;
            }

            // Dry-run short-circuit for local verification
            if (/[?&]dryRun=1\b/.test(window.location.search)) {
                console.log('[DRYRUN] POST /api/transfer-orders', payload);
                var fakeRecord = Object.assign({ ID_Transfer: 'ST-DRYRUN-0000' }, payload);
                delete fakeRecord.lines;
                fakeRecord._lines = lines;
                var overrides = { to_email: BRADLEY_EMAIL, cc_email: user.email };
                if (isRush) {
                    overrides.rush_subject_suffix = ' \ud83d\udea8 RUSH';
                    overrides.rs_sfx = ' \ud83d\udea8 RUSH';
                    overrides.rush_banner_html = buildRushBanner(fakeRecord);
                }
                // v3: mirror the mockup-vision enrichment that the real path
                // does via sendTransferRequestedEmail's visionExtras arg.
                if (vision) {
                    if (vision.garmentColorStyle) overrides.garment_info = vision.garmentColorStyle;
                    if (vision.transferType) overrides.transfer_type = vision.transferType;
                }
                console.log('[DRYRUN] transfer_requested params:', buildEmailParams(fakeRecord, overrides));
                closeModal();
                showToast('DRY RUN \u2014 payload logged to console.', 'info');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send to Bradley';
                return;
            }

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
            var linesStr = lines.length > 1 ? (' (' + lines.length + ' transfers)') : '';
            showToast('Transfer ' + (createData.record.ID_Transfer || '') + ' sent to Bradley' + linesStr + '.', 'success');

            var recordForEmail = Object.assign({}, createData.record, { _lines: createData.lines || lines });
            // v3: pass mockup vision extras so the submit email includes
            // garment + transfer type (fields we don't persist to Caspio).
            var visionExtras = vision ? {
                garmentColorStyle: vision.garmentColorStyle,
                transferType: vision.transferType
            } : null;
            sendTransferRequestedEmail(recordForEmail, user, visionExtras);

            if (typeof opts.onSuccess === 'function') opts.onSuccess(createData.record);

        } catch (err) {
            console.error('[transfer-actions] send failed:', err);
            showToast('Failed: ' + err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send to Bradley';
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
