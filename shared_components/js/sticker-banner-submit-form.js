/**
 * sticker-banner-submit-form.js — AE Sticker / Banner Art Request Submit Form
 *
 * Custom JS form (no Caspio DataPage) for AEs to send sticker or banner
 * art requests to Steve. Posts directly to /api/artrequests with
 * Item_Type='Sticker'|'Banner' and Item_Specs_Notes as a structured
 * plain-text block. Garment workflow is unchanged — that still uses the
 * Caspio DataPage embed in #submit-tab.
 *
 * Rendered into the container shown when the AE picks the Sticker or
 * Banner pill at the top of the Submit Artwork tab. Pill state is managed
 * by ae-dashboard.html inline script.
 *
 * Usage: StickerBannerSubmitForm.init('container-id')
 *        StickerBannerSubmitForm.setItemType('Sticker' | 'Banner')
 *
 * Depends on: app-config.js, customer-lookup-service.js, staff-auth-helper.js
 *             (optional) emailjs SDK for Steve notification
 */
var StickerBannerSubmitForm = (function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    var SITE_ORIGIN = 'https://www.teamnwca.com';

    // Steve = art@nwcustomapparel.com per MEMORY.md ("Steve has no individual
    // steve@ address"). New-submission notifications + AE confirmation routed
    // the same way the Ruth flow handles it in mockup-submit-form.js.
    var STEVE_EMAIL = 'art@nwcustomapparel.com';

    // ── State ──────────────────────────────────────────────────────────────
    var containerId = null;
    var currentItemType = 'Sticker'; // 'Sticker' | 'Banner'
    var referenceFiles = [];          // Array of File objects (max 4)
    var customerLookup = null;
    var selectedContact = null;
    var selectedDesign = null;
    var isRush = false;

    // ── Init ───────────────────────────────────────────────────────────────
    function init(containerIdParam) {
        containerId = containerIdParam;
        renderForm();
    }

    function setItemType(type) {
        if (type !== 'Sticker' && type !== 'Banner') return;
        if (currentItemType === type) return;
        currentItemType = type;
        renderForm();
    }

    function renderForm() {
        var container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = buildFormHtml();
        wireEvents();
        initCompanyAutocomplete();
        initDesignNameAutocomplete();
        initWorkOrderAutocomplete();
        initDueDateDefault();
        initSalesRep();
        // Suggest sensible defaults for Application/Use based on item type
        if (currentItemType === 'Sticker') {
            var appSel = document.getElementById('sbf-sticker-application');
            if (appSel && !appSel.value) appSel.value = 'Outdoor';
        }
    }

    // ── Build Form HTML ────────────────────────────────────────────────────
    function buildFormHtml() {
        var isSticker = currentItemType === 'Sticker';
        var typeLabel = isSticker ? 'Sticker' : 'Banner';
        var emoji = isSticker ? '\u{1F3F7}️' : '\u{1F38C}';

        return '<div class="sbf-container">'
            // Header banner
            + '<div class="sbf-banner sbf-banner--' + (isSticker ? 'sticker' : 'banner') + '">'
            + '  <div class="sbf-banner-emoji">' + emoji + '</div>'
            + '  <div class="sbf-banner-text">'
            + '    <h3>' + typeLabel + ' Art Request to Steve</h3>'
            + '    <p>' + (isSticker
                ? 'New sticker design or applying an existing logo to a sticker. Steve will create the mockup and send it for approval.'
                : 'New banner design or applying an existing logo to a banner. Steve will create the mockup and send it for approval.')
            + '    </p>'
            + '  </div>'
            + '</div>'

            + '<div class="sbf-form-card">'
            + '  <div class="sbf-form-header">' + typeLabel + ' Request Details</div>'
            + '  <div class="sbf-form-body" id="sbf-form-body">'

            // Company + Sales Rep
            + '    <div class="sbf-row">'
            + '      <div class="sbf-field">'
            + '        <label class="sbf-field-label">Company Name <span class="sbf-required">*</span></label>'
            + '        <div class="sbf-autocomplete-wrap">'
            + '          <input type="text" class="sbf-input" id="sbf-company" placeholder="Type company name to search..." autocomplete="off">'
            + '        </div>'
            + '        <span class="sbf-error-msg" id="sbf-company-error">Company name is required</span>'
            + '      </div>'
            + '      <div class="sbf-field">'
            + '        <label class="sbf-field-label">Sales Rep</label>'
            + '        <input type="text" class="sbf-input" id="sbf-sales-rep" placeholder="Auto-filled from login">'
            + '      </div>'
            + '    </div>'
            + '    <input type="hidden" id="sbf-customer-id">'

            // Contact name + email
            + '    <div class="sbf-row">'
            + '      <div class="sbf-field">'
            + '        <label class="sbf-field-label">Contact Name</label>'
            + '        <input type="text" class="sbf-input" id="sbf-contact-name" placeholder="First Last">'
            + '      </div>'
            + '      <div class="sbf-field">'
            + '        <label class="sbf-field-label">Contact Email</label>'
            + '        <input type="email" class="sbf-input" id="sbf-contact-email" placeholder="customer@email.com">'
            + '      </div>'
            + '    </div>'

            // Design name + Due date
            + '    <div class="sbf-row">'
            + '      <div class="sbf-field">'
            + '        <label class="sbf-field-label">Design Name <span class="sbf-required">*</span></label>'
            + '        <input type="text" class="sbf-input" id="sbf-design-name" placeholder="e.g. Lincoln Lynx Logo Sticker">'
            + '        <span class="sbf-error-msg" id="sbf-design-name-error">Design name is required</span>'
            + '      </div>'
            + '      <div class="sbf-field">'
            + '        <label class="sbf-field-label">Due Date</label>'
            + '        <input type="date" class="sbf-input" id="sbf-due-date">'
            + '      </div>'
            + '    </div>'

            + (isSticker ? buildStickerSpecsHtml() : buildBannerSpecsHtml())

            // Quantity + Work Order
            + '    <div class="sbf-row">'
            + '      <div class="sbf-field">'
            + '        <label class="sbf-field-label">Estimated Quantity</label>'
            + '        <input type="number" class="sbf-input" id="sbf-quantity" placeholder="e.g. 250" min="1" step="1">'
            + '      </div>'
            + '      <div class="sbf-field">'
            + '        <label class="sbf-field-label">Work Order # (optional)</label>'
            + '        <input type="text" class="sbf-input" id="sbf-work-order" placeholder="ShopWorks order #">'
            + '      </div>'
            + '    </div>'

            // Instructions
            + '    <div class="sbf-field">'
            + '      <label class="sbf-field-label">Additional Instructions for Steve</label>'
            + '      <textarea class="sbf-textarea" id="sbf-instructions" placeholder="Anything else Steve should know..."></textarea>'
            + '    </div>'

            // Print specs tip
            + '    <div class="sbf-tip">'
            + '      <span class="sbf-tip-icon">\u{1F4A1}</span>'
            + '      Print files should be CMYK, 300 DPI, with 1/8" bleed on all sides. '
            + '      For files larger than 20MB, upload to Box and paste the link in instructions.'
            + '    </div>'

            // File upload
            + '    <div class="sbf-field">'
            + '      <label class="sbf-field-label">Reference Files (logo, sketches, photos)</label>'
            + '      <div class="sbf-file-drop" id="sbf-file-drop">'
            + '        <div class="sbf-file-drop-icon">\u{1F4CE}</div>'
            + '        <div>Click to upload or drag &amp; drop</div>'
            + '        <div class="sbf-file-drop-hint">.AI, .EPS, .PDF, .PNG, .JPG, .SVG &mdash; max 4 files, 20MB each</div>'
            + '      </div>'
            + '      <input type="file" id="sbf-file-input" style="display:none;" accept="image/*,.pdf,.eps,.ai,.svg" multiple>'
            + '      <div id="sbf-file-preview-area"></div>'
            + '    </div>'

            // Rush toggle + Submit
            + '    <div class="sbf-rush-row">'
            + '      <button type="button" class="sbf-rush-toggle" id="sbf-rush-toggle" aria-pressed="false">'
            + '        <span class="sbf-rush-icon">\u{1F525}</span>'
            + '        <span class="sbf-rush-label">Rush Order</span>'
            + '        <span class="sbf-rush-hint">Tick if Steve needs this ASAP</span>'
            + '      </button>'
            + '    </div>'
            + '    <div class="sbf-submit-row">'
            + '      <button type="button" class="sbf-submit-btn" id="sbf-submit-btn">Submit ' + typeLabel + ' Request</button>'
            + '      <span class="sbf-submit-status" id="sbf-submit-status"></span>'
            + '    </div>'

            + '  </div>'
            + '</div>'
            + '</div>';
    }

    function buildStickerSpecsHtml() {
        return ''
            // Size + custom dimensions
            + '<div class="sbf-section-header">Sticker Specs</div>'
            + '<div class="sbf-row">'
            + '  <div class="sbf-field">'
            + '    <label class="sbf-field-label">Size <span class="sbf-required">*</span></label>'
            + '    <select class="sbf-select" id="sbf-sticker-size">'
            + '      <option value="">Select size...</option>'
            + '      <option value="2x2">2" × 2"</option>'
            + '      <option value="3x3">3" × 3"</option>'
            + '      <option value="4x4">4" × 4"</option>'
            + '      <option value="5x5">5" × 5"</option>'
            + '      <option value="custom">Custom dimensions</option>'
            + '    </select>'
            + '    <span class="sbf-error-msg" id="sbf-sticker-size-error">Size is required</span>'
            + '  </div>'
            + '  <div class="sbf-field" id="sbf-sticker-custom-row" style="display:none;">'
            + '    <label class="sbf-field-label">Custom Dimensions (W × H, inches)</label>'
            + '    <div class="sbf-dim-row">'
            + '      <input type="number" class="sbf-input sbf-dim-input" id="sbf-sticker-custom-w" placeholder="W" min="0.1" step="0.1">'
            + '      <span class="sbf-dim-x">×</span>'
            + '      <input type="number" class="sbf-input sbf-dim-input" id="sbf-sticker-custom-h" placeholder="H" min="0.1" step="0.1">'
            + '    </div>'
            + '  </div>'
            + '</div>'

            // Material + Shape
            + '<div class="sbf-row">'
            + '  <div class="sbf-field">'
            + '    <label class="sbf-field-label">Material</label>'
            + '    <select class="sbf-select" id="sbf-sticker-material">'
            + '      <option value="">Select material...</option>'
            + '      <option value="Vinyl - Matte">Vinyl &mdash; Matte</option>'
            + '      <option value="Vinyl - Gloss">Vinyl &mdash; Gloss</option>'
            + '      <option value="Holographic">Holographic</option>'
            + '      <option value="Clear Vinyl">Clear Vinyl</option>'
            + '      <option value="Paper">Paper</option>'
            + '    </select>'
            + '  </div>'
            + '  <div class="sbf-field">'
            + '    <label class="sbf-field-label">Shape</label>'
            + '    <select class="sbf-select" id="sbf-sticker-shape">'
            + '      <option value="">Select shape...</option>'
            + '      <option value="Square">Square</option>'
            + '      <option value="Circle">Circle</option>'
            + '      <option value="Rounded Square">Rounded Square</option>'
            + '      <option value="Custom">Custom (describe in instructions)</option>'
            + '    </select>'
            + '  </div>'
            + '</div>'

            // Cut Type + Application
            + '<div class="sbf-row">'
            + '  <div class="sbf-field">'
            + '    <label class="sbf-field-label">Cut Type</label>'
            + '    <select class="sbf-select" id="sbf-sticker-cut">'
            + '      <option value="">Select cut...</option>'
            + '      <option value="Kiss-cut">Kiss-cut</option>'
            + '      <option value="Die-cut">Die-cut</option>'
            + '      <option value="Sheet">Sheet</option>'
            + '    </select>'
            + '  </div>'
            + '  <div class="sbf-field">'
            + '    <label class="sbf-field-label">Application</label>'
            + '    <select class="sbf-select" id="sbf-sticker-application">'
            + '      <option value="">Select application...</option>'
            + '      <option value="Indoor">Indoor</option>'
            + '      <option value="Outdoor">Outdoor</option>'
            + '      <option value="Both">Both</option>'
            + '    </select>'
            + '  </div>'
            + '</div>'

            // Background
            + '<div class="sbf-field" style="max-width:340px;">'
            + '  <label class="sbf-field-label">Background</label>'
            + '  <div class="sbf-radio-row">'
            + '    <label class="sbf-radio"><input type="radio" name="sbf-sticker-bg" value="White" checked> White</label>'
            + '    <label class="sbf-radio"><input type="radio" name="sbf-sticker-bg" value="Transparent"> Transparent</label>'
            + '  </div>'
            + '</div>';
    }

    function buildBannerSpecsHtml() {
        return ''
            // Section header
            + '<div class="sbf-section-header">Banner Specs</div>'
            // Width + Height
            + '<div class="sbf-row">'
            + '  <div class="sbf-field">'
            + '    <label class="sbf-field-label">Width (inches) <span class="sbf-required">*</span></label>'
            + '    <input type="number" class="sbf-input" id="sbf-banner-width" placeholder="e.g. 24" min="1" step="0.5">'
            + '    <span class="sbf-error-msg" id="sbf-banner-width-error">Width is required</span>'
            + '    <span class="sbf-field-hint">12 in = 1 ft</span>'
            + '  </div>'
            + '  <div class="sbf-field">'
            + '    <label class="sbf-field-label">Height (inches) <span class="sbf-required">*</span></label>'
            + '    <input type="number" class="sbf-input" id="sbf-banner-height" placeholder="e.g. 72" min="1" step="0.5">'
            + '    <span class="sbf-error-msg" id="sbf-banner-height-error">Height is required</span>'
            + '  </div>'
            + '</div>'

            // Material + Sides
            + '<div class="sbf-row">'
            + '  <div class="sbf-field">'
            + '    <label class="sbf-field-label">Material <span class="sbf-required">*</span></label>'
            + '    <select class="sbf-select" id="sbf-banner-material">'
            + '      <option value="">Select material...</option>'
            + '      <option value="13oz Vinyl">13oz Vinyl (standard outdoor)</option>'
            + '      <option value="18oz Blockout">18oz Blockout (double-sided heavy)</option>'
            + '      <option value="Mesh Vinyl">Mesh Vinyl (wind-permeable)</option>'
            + '      <option value="Fabric">Fabric (indoor / trade show)</option>'
            + '    </select>'
            + '    <span class="sbf-error-msg" id="sbf-banner-material-error">Material is required</span>'
            + '  </div>'
            + '  <div class="sbf-field">'
            + '    <label class="sbf-field-label">Sides</label>'
            + '    <select class="sbf-select" id="sbf-banner-sides">'
            + '      <option value="Single-sided">Single-sided</option>'
            + '      <option value="Double-sided">Double-sided</option>'
            + '    </select>'
            + '  </div>'
            + '</div>'

            // Hemming + Grommets
            + '<div class="sbf-row">'
            + '  <div class="sbf-field">'
            + '    <label class="sbf-field-label">Hemming</label>'
            + '    <select class="sbf-select" id="sbf-banner-hemming">'
            + '      <option value="Yes">Yes &mdash; reinforced hems</option>'
            + '      <option value="No">No</option>'
            + '    </select>'
            + '  </div>'
            + '  <div class="sbf-field">'
            + '    <label class="sbf-field-label">Grommets</label>'
            + '    <select class="sbf-select" id="sbf-banner-grommets">'
            + '      <option value="Corners only">Corners only</option>'
            + '      <option value="Every 2 ft">Every 2 ft</option>'
            + '      <option value="None">None</option>'
            + '    </select>'
            + '  </div>'
            + '</div>'

            // Pole pockets + Use
            + '<div class="sbf-row">'
            + '  <div class="sbf-field">'
            + '    <label class="sbf-field-label">Pole Pockets</label>'
            + '    <select class="sbf-select" id="sbf-banner-poles">'
            + '      <option value="None">None</option>'
            + '      <option value="Top">Top</option>'
            + '      <option value="Bottom">Bottom</option>'
            + '      <option value="Both">Both (top &amp; bottom)</option>'
            + '    </select>'
            + '  </div>'
            + '  <div class="sbf-field">'
            + '    <label class="sbf-field-label">Indoor / Outdoor</label>'
            + '    <select class="sbf-select" id="sbf-banner-use">'
            + '      <option value="Outdoor">Outdoor</option>'
            + '      <option value="Indoor">Indoor</option>'
            + '      <option value="Both">Both</option>'
            + '    </select>'
            + '  </div>'
            + '</div>'

            // Background color
            + '<div class="sbf-field" style="max-width:340px;">'
            + '  <label class="sbf-field-label">Background Color</label>'
            + '  <input type="text" class="sbf-input" id="sbf-banner-bg" placeholder="e.g. White, Black, Maroon, #981e32">'
            + '</div>';
    }

    // ── Wire Events ────────────────────────────────────────────────────────
    function wireEvents() {
        // Sticker custom-size reveal
        var sizeSel = document.getElementById('sbf-sticker-size');
        if (sizeSel) {
            sizeSel.addEventListener('change', function () {
                var customRow = document.getElementById('sbf-sticker-custom-row');
                if (customRow) customRow.style.display = sizeSel.value === 'custom' ? '' : 'none';
            });
        }

        // File upload
        var fileDrop = document.getElementById('sbf-file-drop');
        var fileInput = document.getElementById('sbf-file-input');
        if (fileDrop && fileInput) {
            fileDrop.addEventListener('click', function () { fileInput.click(); });
            fileInput.addEventListener('change', function () {
                if (fileInput.files.length > 0) addReferenceFiles(fileInput.files);
            });
            fileDrop.addEventListener('dragover', function (e) {
                e.preventDefault();
                fileDrop.classList.add('sbf-file-drop--active');
            });
            fileDrop.addEventListener('dragleave', function () {
                fileDrop.classList.remove('sbf-file-drop--active');
            });
            fileDrop.addEventListener('drop', function (e) {
                e.preventDefault();
                fileDrop.classList.remove('sbf-file-drop--active');
                if (e.dataTransfer.files.length > 0) addReferenceFiles(e.dataTransfer.files);
            });
        }

        // Rush
        var rushBtn = document.getElementById('sbf-rush-toggle');
        if (rushBtn) {
            rushBtn.addEventListener('click', function () {
                isRush = !isRush;
                rushBtn.classList.toggle('sbf-rush-toggle--active', isRush);
                rushBtn.setAttribute('aria-pressed', isRush ? 'true' : 'false');
            });
        }

        // Submit
        var submitBtn = document.getElementById('sbf-submit-btn');
        if (submitBtn) submitBtn.addEventListener('click', handleSubmit);
    }

    // ── Company + Contact picker (hybrid grouped pattern) ──────────────────
    // Replaces the wall-of-duplicates CustomerLookupService.bindToInput with
    // CompanyContactPicker — single search box, grouped Companies + Contacts
    // sections, click-through to Stage 2 contact list per company. The picker
    // writes Company + Contact + Email + customerId directly; we just wire
    // callbacks for form-specific side-effects (clearing the error state,
    // caching the selected contact for the submit handler).
    function initCompanyAutocomplete() {
        if (typeof CompanyContactPicker === 'undefined') {
            console.warn('[StickerBannerSubmitForm] CompanyContactPicker not loaded — falling back to plain inputs.');
            return;
        }
        customerLookup = new CompanyContactPicker();
        customerLookup.bindPair({
            companyInputId: 'sbf-company',
            contactInputId: 'sbf-contact-name',
            emailInputId: 'sbf-contact-email',
            customerIdHiddenId: 'sbf-customer-id',
            onSelect: function (selection) {
                selectedContact = selection.contact || null;
                document.getElementById('sbf-company').classList.remove('sbf-error');
                var errEl = document.getElementById('sbf-company-error');
                if (errEl) errEl.style.display = 'none';
            },
            onClear: function () {
                selectedContact = null;
            }
        });
    }

    // ── Design Name autocomplete (customer-scoped, newest first) ────────────
    function initDesignNameAutocomplete() {
        if (typeof DesignNamePicker === 'undefined') return;
        DesignNamePicker.bind({
            inputId: 'sbf-design-name',
            getCustomerId: function () {
                return parseInt(document.getElementById('sbf-customer-id').value, 10) || 0;
            },
            onSelect: function (design) {
                selectedDesign = design;
                document.getElementById('sbf-design-name').classList.remove('sbf-error');
                var errEl = document.getElementById('sbf-design-name-error');
                if (errEl) errEl.style.display = 'none';
            },
            onClear: function () { selectedDesign = null; }
        });
        // Free-typing should clear any stale picked design.
        var input = document.getElementById('sbf-design-name');
        if (input) {
            input.addEventListener('input', function () {
                if (selectedDesign && input.value.trim() !== (selectedDesign.designName || '').trim()) {
                    selectedDesign = null;
                }
            });
        }
    }

    // ── Default Due Date to today + 2 business days ─────────────────────────
    function initDueDateDefault() {
        if (typeof window.NWCA_DateUtils === 'undefined') return;
        var dueDate = document.getElementById('sbf-due-date');
        if (dueDate && !dueDate.value) {
            dueDate.value = window.NWCA_DateUtils.addBusinessDays(2);
        }
    }

    // ── Work Order # autocomplete (browse-on-focus, MO-backed) ──────────────
    // Picks from this customer's recent ShopWorks orders. Smart-fills the
    // Design Name from the picked order's DesignName, but ONLY if it's
    // still empty — preserves the AE's typed input.
    function initWorkOrderAutocomplete() {
        if (typeof WorkOrderPicker === 'undefined') return;
        WorkOrderPicker.bind({
            inputId: 'sbf-work-order',
            getCustomerId: function () {
                return parseInt(document.getElementById('sbf-customer-id').value, 10) || 0;
            },
            onSelect: function (order) {
                var nameEl = document.getElementById('sbf-design-name');
                if (nameEl && !nameEl.value.trim() && order.DesignName) {
                    nameEl.value = order.DesignName;
                    if (order.id_Design) {
                        selectedDesign = {
                            designNumber: order.id_Design,
                            designName: order.DesignName,
                            company: order.CustomerName,
                            customerId: order.id_Customer
                        };
                    }
                    nameEl.classList.remove('sbf-error');
                    var errEl = document.getElementById('sbf-design-name-error');
                    if (errEl) errEl.style.display = 'none';
                }
            }
        });
    }

    // ── Sales Rep Auto-fill ─────────────────────────────────────────────────
    function initSalesRep() {
        var repInput = document.getElementById('sbf-sales-rep');
        if (!repInput) return;
        if (typeof StaffAuthHelper !== 'undefined' && StaffAuthHelper.isLoggedIn()) {
            var name = StaffAuthHelper.getLoggedInStaffName();
            if (name) {
                repInput.value = name;
                repInput.readOnly = true;
                return;
            }
        }
        repInput.readOnly = false;
        repInput.placeholder = 'Enter your name';
    }

    // ── File handling ───────────────────────────────────────────────────────
    function addReferenceFiles(fileList) {
        var allowed = 4 - referenceFiles.length;
        for (var i = 0; i < fileList.length && i < allowed; i++) {
            var f = fileList[i];
            if (f.size > 20 * 1024 * 1024) {
                showToast('"' + f.name + '" is over 20MB and was skipped.', 'error');
                continue;
            }
            referenceFiles.push(f);
        }
        renderFilePreviews();
    }

    function renderFilePreviews() {
        var area = document.getElementById('sbf-file-preview-area');
        if (!area) return;
        if (referenceFiles.length === 0) { area.innerHTML = ''; return; }
        var html = '<div class="sbf-file-list">';
        referenceFiles.forEach(function (f, idx) {
            html += '<div class="sbf-file-item">'
                + '<span class="sbf-file-name">' + escapeHtml(f.name) + '</span>'
                + '<span class="sbf-file-size">' + formatFileSize(f.size) + '</span>'
                + '<button type="button" class="sbf-file-remove" data-idx="' + idx + '" title="Remove">×</button>'
                + '</div>';
        });
        html += '</div>';
        area.innerHTML = html;
        area.querySelectorAll('.sbf-file-remove').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var i = parseInt(btn.getAttribute('data-idx'));
                referenceFiles.splice(i, 1);
                renderFilePreviews();
            });
        });
    }

    // ── Validation ──────────────────────────────────────────────────────────
    function validate() {
        var valid = true;
        var company = document.getElementById('sbf-company').value.trim();
        if (!company) {
            document.getElementById('sbf-company').classList.add('sbf-error');
            document.getElementById('sbf-company-error').style.display = 'block';
            valid = false;
        } else {
            document.getElementById('sbf-company').classList.remove('sbf-error');
            document.getElementById('sbf-company-error').style.display = 'none';
        }

        var designName = document.getElementById('sbf-design-name').value.trim();
        if (!designName) {
            document.getElementById('sbf-design-name').classList.add('sbf-error');
            document.getElementById('sbf-design-name-error').style.display = 'block';
            valid = false;
        } else {
            document.getElementById('sbf-design-name').classList.remove('sbf-error');
            document.getElementById('sbf-design-name-error').style.display = 'none';
        }

        if (currentItemType === 'Sticker') {
            var size = document.getElementById('sbf-sticker-size').value;
            if (!size) {
                document.getElementById('sbf-sticker-size').classList.add('sbf-error');
                document.getElementById('sbf-sticker-size-error').style.display = 'block';
                valid = false;
            } else {
                document.getElementById('sbf-sticker-size').classList.remove('sbf-error');
                document.getElementById('sbf-sticker-size-error').style.display = 'none';
            }
        } else {
            var w = document.getElementById('sbf-banner-width').value;
            var h = document.getElementById('sbf-banner-height').value;
            var mat = document.getElementById('sbf-banner-material').value;
            if (!w) {
                document.getElementById('sbf-banner-width').classList.add('sbf-error');
                document.getElementById('sbf-banner-width-error').style.display = 'block';
                valid = false;
            } else {
                document.getElementById('sbf-banner-width').classList.remove('sbf-error');
                document.getElementById('sbf-banner-width-error').style.display = 'none';
            }
            if (!h) {
                document.getElementById('sbf-banner-height').classList.add('sbf-error');
                document.getElementById('sbf-banner-height-error').style.display = 'block';
                valid = false;
            } else {
                document.getElementById('sbf-banner-height').classList.remove('sbf-error');
                document.getElementById('sbf-banner-height-error').style.display = 'none';
            }
            if (!mat) {
                document.getElementById('sbf-banner-material').classList.add('sbf-error');
                document.getElementById('sbf-banner-material-error').style.display = 'block';
                valid = false;
            } else {
                document.getElementById('sbf-banner-material').classList.remove('sbf-error');
                document.getElementById('sbf-banner-material-error').style.display = 'none';
            }
        }

        return valid;
    }

    // ── Build Item_Specs_Notes block ────────────────────────────────────────
    function buildItemSpecsNotes() {
        var lines = [];
        if (currentItemType === 'Sticker') {
            lines.push('STICKER REQUEST');
            var size = document.getElementById('sbf-sticker-size').value;
            if (size === 'custom') {
                var w = document.getElementById('sbf-sticker-custom-w').value.trim();
                var h = document.getElementById('sbf-sticker-custom-h').value.trim();
                if (w && h) {
                    lines.push('Size: ' + w + '" × ' + h + '" (custom)');
                } else if (w) {
                    lines.push('Size: ' + w + '" wide (custom)');
                } else if (h) {
                    lines.push('Size: ' + h + '" tall (custom)');
                } else {
                    lines.push('Size: Custom');
                }
            } else if (size) {
                var dim = size.replace('x', '" × ') + '"';
                lines.push('Size: ' + dim);
            }
            pushIfPresent(lines, 'Material', document.getElementById('sbf-sticker-material').value);
            pushIfPresent(lines, 'Shape', document.getElementById('sbf-sticker-shape').value);
            pushIfPresent(lines, 'Cut Type', document.getElementById('sbf-sticker-cut').value);
            pushIfPresent(lines, 'Application', document.getElementById('sbf-sticker-application').value);
            var bg = document.querySelector('input[name="sbf-sticker-bg"]:checked');
            if (bg) lines.push('Background: ' + bg.value);
        } else {
            lines.push('BANNER REQUEST');
            var bw = document.getElementById('sbf-banner-width').value.trim();
            var bh = document.getElementById('sbf-banner-height').value.trim();
            if (bw && bh) lines.push('Dimensions: ' + bw + '" × ' + bh + '" (' + (parseFloat(bw)/12).toFixed(2) + " ft × " + (parseFloat(bh)/12).toFixed(2) + ' ft)');
            pushIfPresent(lines, 'Material', document.getElementById('sbf-banner-material').value);
            pushIfPresent(lines, 'Sides', document.getElementById('sbf-banner-sides').value);
            pushIfPresent(lines, 'Hemming', document.getElementById('sbf-banner-hemming').value);
            pushIfPresent(lines, 'Grommets', document.getElementById('sbf-banner-grommets').value);
            pushIfPresent(lines, 'Pole Pockets', document.getElementById('sbf-banner-poles').value);
            pushIfPresent(lines, 'Indoor/Outdoor', document.getElementById('sbf-banner-use').value);
            pushIfPresent(lines, 'Background Color', document.getElementById('sbf-banner-bg').value.trim());
        }
        var qty = document.getElementById('sbf-quantity').value.trim();
        if (qty) lines.push('Estimated Quantity: ' + qty);
        return lines.join('\n');
    }

    function pushIfPresent(lines, label, value) {
        if (value && value.trim()) lines.push(label + ': ' + value.trim());
    }

    // ── Submit ─────────────────────────────────────────────────────────────
    function handleSubmit() {
        if (!validate()) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        var btn = document.getElementById('sbf-submit-btn');
        var statusEl = document.getElementById('sbf-submit-status');
        btn.disabled = true;
        statusEl.textContent = 'Uploading files...';

        var companyName = document.getElementById('sbf-company').value.trim();
        var designName = document.getElementById('sbf-design-name').value.trim();
        var dueDate = document.getElementById('sbf-due-date').value || null;
        var contactName = document.getElementById('sbf-contact-name').value.trim();
        var contactEmail = document.getElementById('sbf-contact-email').value.trim();
        var instructions = document.getElementById('sbf-instructions').value.trim();
        var workOrder = document.getElementById('sbf-work-order').value.trim();
        var customerId = parseInt(document.getElementById('sbf-customer-id').value) || 0;
        var aeName = getSubmitterName();
        var aeEmail = getSubmitterEmail();
        var salesRep = document.getElementById('sbf-sales-rep').value.trim() || aeName;

        var firstName = '';
        var lastName = '';
        if (contactName) {
            var parts = contactName.split(/\s+/);
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ');
        }

        // Step 1: Upload files (each returns an externalKey + fileName).
        // Caspio Files API stores files in the "Artwork" folder; ArtRequests
        // File_Upload_* fields take a relative path "/Artwork/{fileName}".
        uploadFilesSequentially()
            .then(function (upload) {
                // Abort the submission if ANY attached file failed to upload.
                // Creating the art request anyway would silently strand the
                // AE's artwork (Steve sees a request with empty file slots
                // and no idea something was attempted). Better to fail fast
                // and let the AE retry — typed input is preserved because we
                // don't re-render the form view. Mirrors JDS Phase 1.
                if (upload.failedFiles && upload.failedFiles.length > 0) {
                    var msg = upload.failedFiles.length === 1
                        ? 'Could not upload "' + upload.failedFiles[0] + '" — please retry'
                        : 'Could not upload ' + upload.failedFiles.length + ' files (' + upload.failedFiles.join(', ') + ') — please retry';
                    var err = new Error(msg);
                    err.code = 'UPLOAD_FAILED';
                    throw err;
                }
                var uploaded = upload.results;

                statusEl.textContent = 'Creating request...';

                // Design name has no dedicated column on ArtRequests — fold it
                // into Item_Specs_Notes so Steve sees it. Posting Design_Name
                // returns 404 FieldNotFound from Caspio.
                var specsNotes = buildItemSpecsNotes();
                if (designName) {
                    specsNotes = 'Design Name: ' + designName + '\n\n' + specsNotes;
                }

                // Order_Type maps to Caspio's Order_Type multi-select dropdown.
                // 'Roland Stickers' already exists in the dropdown (use as-is).
                // 'Banner' is gated on Erik adding it as an option in Caspio
                // admin — until then Caspio will store the value but won't
                // display it in the Datasheet. Submission still succeeds.
                var orderTypeForItem = (currentItemType === 'Sticker')
                    ? 'Roland Stickers'
                    : 'Banner';

                var payload = {
                    CompanyName: companyName,
                    Status: 'Submitted',
                    Item_Type: currentItemType,
                    Order_Type: orderTypeForItem,
                    Item_Specs_Notes: specsNotes,
                    NOTES: instructions || '',
                    Due_Date: dueDate,
                    First_name: firstName,
                    Last_name: lastName,
                    Email_Contact: contactEmail,
                    Sales_Rep: salesRep,
                    User_Email: aeEmail,
                    Mockup: 'Yes',
                    Is_Rush: !!isRush,
                    Revision_Count: 0
                };

                if (customerId > 0) {
                    payload.id_Customer = customerId;
                    // CompanyContactsMerge2026.id_Customer comes from the
                    // ManageOrders/ShopWorks sync, so the same value goes to
                    // Shopwork_customer_number — that's what the dashboard's
                    // ShopWorks References card reads for Customer #.
                    // Mirrors the JDS form (jds-submit-form.js v2026.05.08.3).
                    payload.Shopwork_customer_number = String(customerId);
                }
                if (workOrder) payload.Order_Num_SW = workOrder;

                // If the AE picked an existing design from the autocomplete
                // (and the input still matches that design name), carry the
                // ShopWorks design number through to the new ArtRequest.
                if (selectedDesign && selectedDesign.designNumber
                    && designName === (selectedDesign.designName || '').trim()) {
                    payload.Design_Num_SW = String(selectedDesign.designNumber);
                }

                // Attach uploaded file paths to File_Upload_One..Four. Caspio formula
                // fields (CDN_Link, CDN_Link_Two, ...) auto-derive from these paths.
                var slots = ['File_Upload_One', 'File_Upload_Two', 'File_Upload_Three', 'File_Upload_Four'];
                uploaded.forEach(function (u, i) {
                    if (i < slots.length && u && u.fileName) {
                        payload[slots[i]] = '/Artwork/' + u.fileName;
                    }
                });

                return fetch(API_BASE + '/api/artrequests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            })
            .then(function (resp) {
                if (!resp.ok) throw new Error('Failed to create art request (' + resp.status + ')');
                return resp.json();
            })
            .then(function (result) {
                // Backend returns the post-create record at result.record
                // (canonical, since v2026.05.08.5). Fall back to the legacy
                // result.request.Result[0] shape just in case the form is
                // running against an older proxy version.
                var record = (result && result.record)
                    || (result && result.request && result.request.Result && result.request.Result[0])
                    || null;
                var designId = record && (record.ID_Design || record.PK_ID);

                statusEl.textContent = 'Notifying Steve...';
                sendNotificationEmails(designId, companyName, designName, aeName, aeEmail);
                showSuccess(designId, companyName);
            })
            .catch(function (err) {
                console.error('[StickerBannerSubmitForm] Submit error:', err);
                btn.disabled = false;
                statusEl.textContent = '';
                // Upload failures already have a complete user-facing message
                // ("Could not upload …"). Don't double-up with a "Submission
                // failed:" prefix that misleads the AE into thinking the art
                // request was created when it wasn't.
                var toastMsg = (err && err.code === 'UPLOAD_FAILED')
                    ? err.message
                    : 'Submission failed: ' + err.message;
                showToast(toastMsg, 'error');
            });
    }

    /**
     * Upload reference files one-by-one to /api/files/upload. Resolves to
     * { results, failedFiles } where failedFiles is the list of File.name
     * values that didn't make it. The caller (handleSubmit) aborts the whole
     * submission if anything failed — we'd rather have the AE retry than
     * create an art request with missing artwork (which is what was
     * happening before this guard: silent upload failures, "Submitted!"
     * toast, Steve sees a request with no files). Mirrors the JDS Phase 1
     * fix shipped in v2026.05.08.2.
     */
    function uploadFilesSequentially() {
        if (referenceFiles.length === 0) {
            return Promise.resolve({ results: [], failedFiles: [] });
        }

        var results = [];
        var failedFiles = [];
        var statusEl = document.getElementById('sbf-submit-status');

        function uploadNext(idx) {
            if (idx >= referenceFiles.length) {
                return Promise.resolve({ results: results, failedFiles: failedFiles });
            }
            var f = referenceFiles[idx];
            if (statusEl) statusEl.textContent = 'Uploading file ' + (idx + 1) + ' of ' + referenceFiles.length + '...';

            var fd = new FormData();
            fd.append('file', f);

            return fetch(API_BASE + '/api/files/upload', { method: 'POST', body: fd })
                .then(function (r) {
                    if (!r.ok) {
                        return r.text().then(function (body) {
                            console.warn('Upload failed for ' + f.name + ':', r.status, body);
                            results.push(null);
                            failedFiles.push(f.name);
                        });
                    }
                    return r.json().then(function (data) {
                        if (data && data.success) {
                            results.push({ fileName: data.fileName, externalKey: data.externalKey });
                        } else {
                            // 200 OK but server reported a logical failure
                            // (e.g. { success: false, error: '...' }).
                            console.warn('Upload reported failure for ' + f.name + ':', data && data.error);
                            results.push(null);
                            failedFiles.push(f.name);
                        }
                    });
                })
                .catch(function (err) {
                    console.warn('Upload error for ' + f.name + ':', err);
                    results.push(null);
                    failedFiles.push(f.name);
                })
                .then(function () { return uploadNext(idx + 1); });
        }

        return uploadNext(0);
    }

    function sendNotificationEmails(designId, companyName, designName, aeName, aeEmail) {
        if (typeof emailjs === 'undefined') return;
        try {
            emailjs.init('4qSbDO-SQs19TbP80');
            var detailLink = SITE_ORIGIN + '/mockup/' + (designId || '');
            var subjectFragment = currentItemType + ' Art Request';
            // Notify Steve
            emailjs.send('service_jgrave3', 'template_art_note_added', {
                to_email: STEVE_EMAIL,
                to_name: 'Steve',
                design_id: designId || 'NEW',
                company_name: companyName,
                note_text: 'New ' + subjectFragment + ' from ' + aeName + ' for ' + companyName + ' — "' + designName + '"',
                note_type: 'New ' + currentItemType + ' Submission',
                detail_link: detailLink,
                from_name: aeName
            }).catch(function () {});

            // Confirmation to AE
            if (aeEmail && aeEmail !== STEVE_EMAIL) {
                emailjs.send('service_jgrave3', 'template_art_note_added', {
                    to_email: aeEmail,
                    to_name: aeName,
                    design_id: designId || 'NEW',
                    company_name: companyName,
                    note_text: 'Your ' + subjectFragment + ' for ' + companyName + ' (\"' + designName + '\") was submitted to Steve.',
                    note_type: 'Submission Confirmation',
                    detail_link: detailLink + '?view=ae',
                    from_name: 'NWCA Art Department'
                }).catch(function () {});
            }
        } catch (e) {
            console.warn('[StickerBannerSubmitForm] EmailJS failed:', e);
        }
    }

    // ── Success State ──────────────────────────────────────────────────────
    function showSuccess(designId, companyName) {
        var body = document.getElementById('sbf-form-body');
        var typeLabel = currentItemType;
        body.innerHTML = '<div class="sbf-success">'
            + '<div class="sbf-success-icon">✅</div>'
            + '<h3>' + typeLabel + ' Request Submitted!' + (designId ? ' <span class="sbf-success-id">Design #' + escapeHtml(String(designId)) + '</span>' : '') + '</h3>'
            + '<p>Your ' + typeLabel.toLowerCase() + ' art request for <strong>' + escapeHtml(companyName) + '</strong> '
            + 'has been sent to Steve. He will create the mockup and notify you when it\'s ready.</p>'
            + (designId ? '<a href="/art-request/' + designId + '?view=ae" class="sbf-success-link">View Request →</a>' : '')
            + '<button type="button" class="sbf-success-another" id="sbf-another-btn">Submit Another</button>'
            + '</div>';

        var anotherBtn = document.getElementById('sbf-another-btn');
        if (anotherBtn) anotherBtn.addEventListener('click', resetForm);
    }

    function resetForm() {
        referenceFiles = [];
        selectedContact = null;
        isRush = false;
        renderForm();
    }

    // ── Helpers ─────────────────────────────────────────────────────────────
    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function getSubmitterEmail() {
        if (typeof StaffAuthHelper !== 'undefined') {
            var email = StaffAuthHelper.getLoggedInStaffEmail();
            if (email) return email;
        }
        if (window.APP_CONFIG && window.APP_CONFIG.USER && window.APP_CONFIG.USER.email) {
            return window.APP_CONFIG.USER.email;
        }
        return localStorage.getItem('userEmail') || 'ae@nwcustomapparel.com';
    }

    function getSubmitterName() {
        if (typeof StaffAuthHelper !== 'undefined') {
            var name = StaffAuthHelper.getLoggedInStaffName();
            if (name) return name;
        }
        if (window.APP_CONFIG && window.APP_CONFIG.USER && window.APP_CONFIG.USER.name) {
            return window.APP_CONFIG.USER.name;
        }
        var email = getSubmitterEmail();
        var atIdx = email.indexOf('@');
        var local = atIdx > 0 ? email.substring(0, atIdx) : email;
        return local.charAt(0).toUpperCase() + local.slice(1);
    }

    function showToast(message, type) {
        type = type || 'info';
        document.querySelectorAll('.sbf-toast').forEach(function (t) { t.remove(); });
        var toast = document.createElement('div');
        toast.className = 'sbf-toast sbf-toast--' + type;
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(function () { toast.classList.add('show'); });
        setTimeout(function () {
            toast.classList.remove('show');
            setTimeout(function () { toast.remove(); }, 300);
        }, 3000);
    }

    return {
        init: init,
        setItemType: setItemType,
        getItemType: function () { return currentItemType; }
    };

})();
