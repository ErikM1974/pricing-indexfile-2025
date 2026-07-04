/**
 * garment-submit-form.js — AE Garment Art Request Submit Form (custom, API-driven)
 *
 * Replaces the legacy Caspio DataPage (a0e150009f0e9f9d4ff3457dae47) that used
 * to render the Garment workflow in #submit-tab. Posts directly to
 * /api/artrequests with Item_Type='Garment' and a fully STRUCTURED field set so
 * Steve no longer has to interpret free-text NOTES. Mirrors the architecture of
 * sticker-banner-submit-form.js / jds-submit-form.js (same pickers, same file
 * upload flow, same EmailJS notify, same success UI).
 *
 * Key design (2026-06-17, Erik): the old "New Artwork / Mockup" toggle is gone —
 * replaced by a single required "Artwork Status" dropdown. Per-location artwork
 * placement/size is stored as a JSON array in the Artwork_Locations column.
 *
 * Usage: GarmentSubmitForm.init('garment-form-container')
 *
 * Depends on: app-config.js, customer-lookup-service.js (CompanyContactPicker),
 *             design-name-picker.js, work-order-picker.js, nwca-date-utils.js,
 *             staff-auth-helper.js, (optional) emailjs SDK.
 * New Caspio columns required on ArtRequests: Artwork_Status, Approval_Status,
 *   Color_Mode, PMS_Colors, Thread_Colors, Underbase_Required, Exact_Text,
 *   Prev_Order_Num, Prev_Design_Num, Repeat_Keep_Same, Repeat_Change,
 *   Uploaded_File_Type, AE_Checklist_Confirmed, AE_Checklist_Confirmed_By,
 *   Artwork_Locations.
 */
var GarmentSubmitForm = (function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    var SITE_ORIGIN = 'https://www.teamnwca.com';
    var STEVE_EMAIL = 'art@nwcustomapparel.com';
    var MAX_FILES = 4;
    var MAX_GARMENTS = 4;
    var MAX_LOCATIONS = 4;

    // ── Option lists ───────────────────────────────────────────────────────
    var ARTWORK_STATUSES = [
        'New artwork from scratch',
        'Mockup only',
        'Revision to existing proof',
        'Repeat from previous order',
        'Final approved / production ready'
    ];
    var APPROVAL_STATUSES = [
        'Not approved — Steve to create proof',
        'Customer reviewing proof',
        'Customer approved — ready for production',
        'Internal revision only',
        'Post-approval change order'
    ];
    var DECORATION_METHODS = [
        'Screen Print', 'DTG', 'Embroidery', 'Transfer',
        'Sticker', 'Banner', 'JDS Product', 'Laser Leatherette Patch', 'Not sure — Steve to advise'
    ];
    // ── Laser leatherette patch (laser-engraved patch applied to caps) ──────
    // When the AE picks this decoration method, a conditional "Patch Specs"
    // panel appears so Steve gets the patch-only details the print/embroidery
    // fields don't cover. Ships with NO new Caspio columns: the specs ride
    // inside the existing Artwork_Locations JSON (each patch placement carries
    // a `patch` object) + a readable block prepended to NOTES. Erik 2026-06-18.
    var PATCH_METHOD = 'Laser Leatherette Patch';
    var PATCH_MATERIAL_OTHER = 'Other — specify exact stock';
    // Surface color / laser-reveal color. Edit this list as stock changes —
    // it is the only place the color options are defined.
    var PATCH_MATERIALS = [
        'Black / Silver engrave',
        'Black / Gold engrave',
        'Black / White engrave',
        'Black / Red engrave',
        'Gray / Black engrave',
        'Light Gray / Black engrave',
        'White / Black engrave',
        'Brown / Black engrave',
        'Rawhide (Light Brown) / Black engrave',
        'Dark Brown / Black engrave',
        'Tan / Black engrave',
        'Navy / White engrave',
        PATCH_MATERIAL_OTHER
    ];
    var PATCH_SHAPES = [
        'Rectangle', 'Rounded Rectangle', 'Square', 'Circle', 'Oval',
        'Shield / Crest', 'Custom die-cut (describe in notes)'
    ];
    var PATCH_EDGES = [
        'Clean laser-cut edge', 'Stitched (merrowed) border', 'Steve to advise'
    ];
    var PATCH_ATTACHMENTS = [
        'Heat press (adhesive backing)', 'Sewn / stitched',
        'Heat press + tack stitch', 'Steve to advise'
    ];
    var COLOR_MODES = [
        'Use exact PMS colors',
        'Use closest match',
        'Match previous order',
        'Black only',
        'White only',
        'Full color',
        "AE/customer doesn't know — Steve to recommend"
    ];
    var FILE_TYPES = [
        'Customer vector file (AI, EPS, PDF, SVG)',
        'Customer raster file (PNG / JPG)',
        'Customer screenshot only',
        'Logo from a previous order',
        'No usable artwork provided — Steve must recreate'
    ];
    var PLACEMENTS = [
        'Left Chest', 'Right Chest', 'Full Front', 'Full Back',
        'Left Sleeve', 'Right Sleeve', 'Cap Front', 'Cap Back',
        'Cap Side (Left)', 'Cap Side (Right)', 'Pocket', 'Yoke / Upper Back',
        'Nape of Neck', 'Pant Leg', 'Tote / Bag', 'Other (describe in notes)'
    ];
    // The AE final checklist. Each item is { key, label }. The "approved" item
    // is only enforced when Approval Status = customer-approved.
    var CHECKLIST_ITEMS = [
        { key: 'info', label: 'Customer and order information are correct' },
        { key: 'status', label: 'Artwork status is selected' },
        { key: 'approval', label: 'Approval status is accurate' },
        { key: 'decoration', label: 'Decoration method is selected' },
        { key: 'garment', label: 'Garment style and color are entered' },
        { key: 'placement', label: 'Artwork placement is entered' },
        { key: 'size', label: 'Art size is entered in inches' },
        { key: 'colors', label: 'Ink / PMS / thread / color direction is entered' },
        { key: 'spelling', label: 'Exact wording has been checked for spelling' },
        { key: 'prev', label: 'Previous order / design number is included (if a repeat or revision)' },
        { key: 'files', label: 'Customer files are uploaded (if available)' },
        { key: 'proof', label: 'If marked approved, the customer has reviewed the final proof' },
        { key: 'understands', label: 'Customer understands changes after approval may delay the order or add charges' }
    ];

    var APPROVED_VALUE = 'Customer approved — ready for production';

    // ── State ──────────────────────────────────────────────────────────────
    var containerId = null;
    var referenceFiles = [];          // File[] the user picked/dropped (counts toward max 4)
    // Artwork carried over from a quote ("Send to Steve"): already uploaded to
    // the Caspio Artwork folder server-side via /api/files/import-from-url, so we
    // hold only { fileName, displayName } — no File bytes. Counts toward max 4.
    var prefilledUploads = [];
    var customerLookup = null;
    var selectedContact = null;
    var selectedDesign = null;
    var isRush = false;
    // Garment rows: { style, colorName, catalogColor, swatch, image, colors:[], custom:bool }
    var garmentRows = [];
    // Artwork locations: { placement, width, height, notes }
    var artworkLocations = [];
    // Optional callback fired with the new designId after a successful submit
    // (used by the Shirt Designer's "Send to Steve" → then "Send to Customer").
    var onSubmittedCb = null;

    // ── Init ───────────────────────────────────────────────────────────────
    // init(containerId) — original signature, unchanged behavior.
    // init(containerId, { prefill, onSubmitted }) — opens the form pre-filled
    //   (e.g. from the Shirt Designer) and calls onSubmitted(designId, company)
    //   after a successful create. prefill fields are all optional:
    //   { company, contactName, contactEmail, decoration, colorMode, threadColors,
    //     exactText, notes, artworkStatus, approvalStatus, fileType, garmentStyle, garmentColor,
    //     salesRep, orderNum, designNum, custNum, customerId, dueDate,
    //     artworkUrls:[{url, fileName, displayName}],  // server-imported reference files
    //     locations:[{placement,width}], files:[File] }.
    function init(containerIdParam, opts) {
        opts = opts || {};
        containerId = containerIdParam;
        onSubmittedCb = (typeof opts.onSubmitted === 'function') ? opts.onSubmitted : null;
        referenceFiles = [];                       // always start with no files
        prefilledUploads = [];                     // and no carried-over art
        var pf = opts.prefill || null;
        garmentRows = [newGarmentRow()];
        artworkLocations = [newLocation()];
        if (pf && pf.garmentStyle) garmentRows[0].style = pf.garmentStyle;
        if (pf && pf.garmentColor) garmentRows[0].colorName = pf.garmentColor;
        if (pf && Array.isArray(pf.locations) && pf.locations.length) {
            artworkLocations = pf.locations.map(function (l) {
                return { placement: l.placement || '', width: (l.width != null && l.width !== '') ? String(l.width) : '', height: '', notes: '' };
            });
        }
        renderForm();
        if (pf) applyPrefill(pf);
    }

    // Seed DOM-level fields after the form is rendered (selects, checkboxes,
    // the attached mockup file). Garment rows + locations are seeded in init
    // before renderForm so they render directly.
    function applyPrefill(pf) {
        function set(id, val) { var el = document.getElementById(id); if (el && val != null && val !== '') el.value = val; }
        set('gsf-company', pf.company);
        set('gsf-contact-name', pf.contactName);
        set('gsf-contact-email', pf.contactEmail);
        set('gsf-artwork-status', pf.artworkStatus);
        set('gsf-approval-status', pf.approvalStatus);
        set('gsf-color-mode', pf.colorMode);
        set('gsf-thread', pf.threadColors);
        set('gsf-exact-text', pf.exactText);
        set('gsf-notes', pf.notes);
        set('gsf-file-type', pf.fileType);
        // Order/identity fields carried over from a ShopWorks-synced quote.
        set('gsf-sales-rep', pf.salesRep);
        set('gsf-order-num', pf.orderNum);
        set('gsf-design-num', pf.designNum);
        set('gsf-cust-num', pf.custNum);
        set('gsf-due-date', pf.dueDate);
        // Hidden id_Customer — normally set by CompanyContactPicker.onSelect, but
        // a quote handoff fills the company as plain text so set it explicitly.
        var cidEl = document.getElementById('gsf-customer-id');
        if (cidEl && pf.customerId != null && pf.customerId !== '') cidEl.value = pf.customerId;
        if (pf.decoration) {
            document.querySelectorAll('.gsf-decoration').forEach(function (cb) {
                if (cb.value === pf.decoration) cb.checked = true;
            });
        }
        if (Array.isArray(pf.files) && pf.files.length) addReferenceFiles(pf.files);
        // Carry the customer's artwork + approved mockups over as real reference
        // files (server-side import — no manual download/re-upload).
        if (Array.isArray(pf.artworkUrls) && pf.artworkUrls.length) importArtworkUrls(pf.artworkUrls);
        // Re-run the adaptive sections in case a seeded status/approval changed them.
        try { applyArtworkStatusAdaptive(); applyApprovalAdaptive(); applyPatchVisibility(); } catch (e) { /* non-fatal */ }
    }

    function newGarmentRow() {
        return { style: '', colorName: '', catalogColor: '', swatch: '', image: '', colors: [], custom: false };
    }
    function newLocation() {
        return { placement: '', width: '', height: '', notes: '' };
    }

    function renderForm() {
        var container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = buildFormHtml();
        wireEvents();
        initCompanyAutocomplete();
        initDesignNameAutocomplete();
        initWorkOrderAutocomplete();
        initDesignNumLookup();
        initDueDateDefault();
        initSalesRep();
        renderGarmentRows();
        renderLocations();
        applyArtworkStatusAdaptive();
        applyApprovalAdaptive();
        applyPatchVisibility();
        applyPatchMaterialOther();
    }

    // ── Build Form HTML ────────────────────────────────────────────────────
    function buildFormHtml() {
        return '<div class="gsf-container">'
            + '<div class="gsf-banner">'
            + '  <div class="gsf-banner-emoji">\u{1F455}</div>'
            + '  <div class="gsf-banner-text">'
            + '    <h3>Garment Art Request to Steve</h3>'
            + '    <p>Give Steve everything he needs to start without guessing — fill in each section, then run the final checklist before you submit.</p>'
            + '  </div>'
            + '</div>'
            + '<div class="gsf-form-card">'
            + '  <div class="gsf-form-body" id="gsf-form-body">'
            + buildCustomerSection()
            + buildStatusSection()
            + buildDecorationSection()
            + buildPatchSection()
            + buildGarmentSection()
            + buildLocationsSection()
            + buildColorsSection()
            + buildTextSection()
            + buildPrevOrderSection()
            + buildFilesSection()
            + buildNotesSection()
            + buildChecklistSection()
            + buildSubmitSection()
            + '  </div>'
            + '</div>'
            + '</div>';
    }

    function sectionHeader(num, title, hint) {
        return '<div class="gsf-section">'
            + '<div class="gsf-section-head"><span class="gsf-section-num">' + num + '</span>'
            + '<span class="gsf-section-title">' + title + '</span></div>'
            + (hint ? '<div class="gsf-section-hint">' + hint + '</div>' : '');
    }

    function optionList(values, placeholder) {
        var html = '<option value="">' + (placeholder || '- select -') + '</option>';
        values.forEach(function (v) {
            html += '<option value="' + escapeAttr(v) + '">' + escapeHtml(v) + '</option>';
        });
        return html;
    }

    function buildCustomerSection() {
        return sectionHeader('1', 'Customer &amp; Order', 'Who and which job this art is for.')
            + '<div class="gsf-row">'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Company <span class="gsf-req">*</span></label>'
            + '    <input type="text" class="gsf-input" id="gsf-company" placeholder="Type company name to search..." autocomplete="off">'
            + '    <span class="gsf-err" id="gsf-company-error">Company is required</span>'
            + '  </div>'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">SW Cust#</label>'
            + '    <input type="text" class="gsf-input" id="gsf-cust-num" placeholder="Auto-fills from company" readonly>'
            + '  </div>'
            + '</div>'
            + '<input type="hidden" id="gsf-customer-id">'
            + '<div class="gsf-row">'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Contact Name <span class="gsf-req">*</span></label>'
            + '    <input type="text" class="gsf-input" id="gsf-contact-name" placeholder="First Last">'
            + '    <span class="gsf-err" id="gsf-contact-name-error">Contact name is required</span>'
            + '  </div>'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Contact Email</label>'
            + '    <input type="email" class="gsf-input" id="gsf-contact-email" placeholder="customer@email.com">'
            + '  </div>'
            + '</div>'
            + '<div class="gsf-row">'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Sales Rep</label>'
            + '    <input type="text" class="gsf-input" id="gsf-sales-rep" placeholder="Auto-filled from login">'
            + '  </div>'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Due Date <span class="gsf-req">*</span></label>'
            + '    <input type="date" class="gsf-input" id="gsf-due-date">'
            + '    <span class="gsf-err" id="gsf-due-date-error">Due date is required</span>'
            + '  </div>'
            + '</div>'
            + '<div class="gsf-row">'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Design # <span class="gsf-req">*</span></label>'
            + '    <input type="text" class="gsf-input" id="gsf-design-num" placeholder="SW Design # — required for all artwork" autocomplete="off">'
            + '    <span class="gsf-hint">Type the number and tab out — looks it up in ShopWorks. New design? Type a new number.</span>'
            + '    <span class="gsf-err" id="gsf-design-num-error">Design # is required</span>'
            + '    <span class="gsf-err gsf-warn" id="gsf-design-num-warning"></span>'
            + '  </div>'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Order # <span class="gsf-req">*</span></label>'
            + '    <input type="text" class="gsf-input" id="gsf-order-num" placeholder="ShopWorks order #">'
            + '    <span class="gsf-hint">Click to browse this customer\'s recent orders.</span>'
            + '    <span class="gsf-err" id="gsf-order-num-error">Order # is required</span>'
            + '  </div>'
            + '</div>'
            + '<div class="gsf-row">'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Art Estimate from AE</label>'
            + '    <select class="gsf-select" id="gsf-prelim">'
            + '      <option value="">- select -</option>'
            + '      <option value="25">GRT-25 Quick Review</option>'
            + '      <option value="50">GRT-50 Logo Mockup</option>'
            + '      <option value="75">GRT-75 Custom Design</option>'
            + '      <option value="100">GRT-100 Extended Design</option>'
            + '      <option value="150">GRT-150 Complex Project</option>'
            + '    </select>'
            + '  </div>'
            + '  <div class="gsf-field gsf-rush-field">'
            + '    <label class="gsf-label">Priority</label>'
            + '    <button type="button" class="gsf-rush-toggle" id="gsf-rush-toggle" aria-pressed="false">'
            + '      <span class="gsf-rush-icon">\u{1F525}</span>'
            + '      <span class="gsf-rush-label">Rush Order</span>'
            + '      <span class="gsf-rush-hint">Tick if Steve needs this ASAP</span>'
            + '    </button>'
            + '  </div>'
            + '</div>'
            + '</div>'; // close section
    }

    function buildStatusSection() {
        return sectionHeader('2', 'Artwork &amp; Approval Status', 'Tells Steve what kind of work this is and whether it is cleared for production.')
            + '<div class="gsf-row">'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Artwork Status <span class="gsf-req">*</span></label>'
            + '    <select class="gsf-select" id="gsf-artwork-status">' + optionList(ARTWORK_STATUSES) + '</select>'
            + '    <span class="gsf-err" id="gsf-artwork-status-error">Artwork status is required</span>'
            + '  </div>'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Approval Status <span class="gsf-req">*</span></label>'
            + '    <select class="gsf-select" id="gsf-approval-status">' + optionList(APPROVAL_STATUSES) + '</select>'
            + '    <span class="gsf-err" id="gsf-approval-status-error">Approval status is required</span>'
            + '  </div>'
            + '</div>'
            + '<div class="gsf-approval-warn" id="gsf-approval-warn" style="display:none;">'
            + '  <strong>Approved = final &amp; production-ready.</strong> Once approved, Steve may prepare screens / production files. '
            + 'Complete the final checklist below, and make sure the customer reviewed the final proof for spelling, layout, color, size, and placement. '
            + 'Changes after approval may delay the order and add charges.'
            + '</div>'
            + '</div>';
    }

    function buildDecorationSection() {
        var boxes = DECORATION_METHODS.map(function (m, i) {
            return '<label class="gsf-check"><input type="checkbox" class="gsf-decoration" value="' + escapeAttr(m) + '"> ' + escapeHtml(m) + '</label>';
        }).join('');
        return sectionHeader('3', 'Decoration Method', 'How this art will be produced — pick all that apply.')
            + '<div class="gsf-check-grid">' + boxes + '</div>'
            + '<span class="gsf-err" id="gsf-decoration-error">Select at least one decoration method</span>'
            + '</div>';
    }

    // Conditional panel — only revealed when "Laser Leatherette Patch" is a
    // chosen decoration method. Not numbered (uses a leather badge) so it does
    // not disturb the 1–11 section numbering the checklist + prev-order logic
    // depend on.
    function buildPatchSection() {
        return '<div class="gsf-section gsf-patch-section" id="gsf-patch-section" style="display:none;">'
            + '<div class="gsf-section-head">'
            + '  <span class="gsf-patch-badge">\u{1FAA1}</span>'
            + '  <span class="gsf-section-title">Laser Leatherette Patch Specs</span>'
            + '</div>'
            + '<div class="gsf-section-hint gsf-patch-hint">Shown because you picked <strong>Laser Leatherette Patch</strong>. Tell Steve exactly what to laser-cut and engrave, and how it attaches to the cap. The cap itself goes in the Garment section below; placement (e.g. Cap Front) goes in Artwork Placement.</div>'
            + '<div class="gsf-row">'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Leatherette Color <span class="gsf-req">*</span></label>'
            + '    <select class="gsf-select" id="gsf-patch-material">' + optionList(PATCH_MATERIALS, '- select color -') + '</select>'
            + '    <span class="gsf-hint">Surface color / laser-reveal color.</span>'
            + '    <span class="gsf-err" id="gsf-patch-material-error">Pick the leatherette color</span>'
            + '  </div>'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Patch Shape <span class="gsf-req">*</span></label>'
            + '    <select class="gsf-select" id="gsf-patch-shape">' + optionList(PATCH_SHAPES, '- select shape -') + '</select>'
            + '    <span class="gsf-err" id="gsf-patch-shape-error">Pick the patch shape</span>'
            + '  </div>'
            + '</div>'
            + '<div class="gsf-field" id="gsf-patch-material-other-field" style="display:none;">'
            + '  <label class="gsf-label">Exact material / stock name <span class="gsf-req">*</span></label>'
            + '  <input type="text" class="gsf-input" id="gsf-patch-material-other" placeholder="e.g. JDS Rawhide laserable leatherette">'
            + '  <span class="gsf-err" id="gsf-patch-material-other-error">Type the exact material</span>'
            + '</div>'
            + '<div class="gsf-row">'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Patch Width&quot; <span class="gsf-req">*</span></label>'
            + '    <input type="number" class="gsf-input" id="gsf-patch-width" placeholder="W" min="0.1" step="0.1">'
            + '    <span class="gsf-hint">Finished patch size (also fills the Cap placement size).</span>'
            + '    <span class="gsf-err" id="gsf-patch-width-error">Enter the patch width</span>'
            + '  </div>'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Patch Height&quot;</label>'
            + '    <input type="number" class="gsf-input" id="gsf-patch-height" placeholder="H" min="0.1" step="0.1">'
            + '  </div>'
            + '</div>'
            + '<div class="gsf-row">'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Edge / Border Finish</label>'
            + '    <select class="gsf-select" id="gsf-patch-edge">' + optionList(PATCH_EDGES, '- select finish -') + '</select>'
            + '  </div>'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Attachment to Cap <span class="gsf-req">*</span></label>'
            + '    <select class="gsf-select" id="gsf-patch-attach">' + optionList(PATCH_ATTACHMENTS, '- select attachment -') + '</select>'
            + '    <span class="gsf-err" id="gsf-patch-attach-error">Pick how the patch attaches</span>'
            + '  </div>'
            + '</div>'
            + '</div>';
    }

    function buildGarmentSection() {
        return sectionHeader('4', 'Garment / Product', 'Style number and color for each garment. Type a style and tab out to load its colors.')
            + '<div id="gsf-garment-rows"></div>'
            + '<button type="button" class="gsf-add-btn" id="gsf-add-garment">+ Add another garment</button>'
            + '</div>';
    }

    function buildLocationsSection() {
        return sectionHeader('5', 'Artwork Placement &amp; Size', 'One block per print location. Give the placement and the final print size in inches.')
            + '<div id="gsf-locations"></div>'
            + '<button type="button" class="gsf-add-btn" id="gsf-add-location">+ Add another location</button>'
            + '<span class="gsf-err" id="gsf-location-error">Add at least one location with a placement and width</span>'
            + '</div>';
    }

    function buildColorsSection() {
        return sectionHeader('6', 'Artwork Colors', 'How colors should be handled. PMS and thread are optional but help Steve match exactly.')
            + '<div class="gsf-row">'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Color Direction <span class="gsf-req">*</span></label>'
            + '    <select class="gsf-select" id="gsf-color-mode">' + optionList(COLOR_MODES) + '</select>'
            + '    <span class="gsf-err" id="gsf-color-mode-error">Color direction is required</span>'
            + '  </div>'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Underbase on dark garments</label>'
            + '    <select class="gsf-select" id="gsf-underbase">'
            + '      <option value="">- select -</option>'
            + '      <option value="Yes">Yes</option>'
            + '      <option value="No">No</option>'
            + '      <option value="Steve">Steve to decide</option>'
            + '    </select>'
            + '  </div>'
            + '</div>'
            + '<div class="gsf-row">'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">PMS Colors (if known)</label>'
            + '    <input type="text" class="gsf-input" id="gsf-pms" placeholder="e.g. PMS 282 Navy, PMS 355 Green (coated)">'
            + '  </div>'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Thread Colors (embroidery)</label>'
            + '    <input type="text" class="gsf-input" id="gsf-thread" placeholder="e.g. Madeira 1843 White, 1640 Red">'
            + '  </div>'
            + '</div>'
            + '</div>';
    }

    function buildTextSection() {
        return sectionHeader('7', 'Exact Text in Artwork', 'Type the exact wording, spelling, dates, names, and phone numbers that should appear.')
            + '<div class="gsf-field">'
            + '  <textarea class="gsf-textarea" id="gsf-exact-text" placeholder="Enter the exact wording. Check spelling, capitalization, dates, and phone numbers."></textarea>'
            + '  <label class="gsf-check gsf-notext"><input type="checkbox" id="gsf-no-text"> This design has no text (graphic / logo only)</label>'
            + '  <span class="gsf-err" id="gsf-exact-text-error">Enter the exact text, or tick "no text"</span>'
            + '</div>'
            + '</div>';
    }

    function buildPrevOrderSection() {
        return sectionHeader('8', 'Previous Order / Design Reference', 'Required for a repeat or a revision — what to copy and what to change.')
            + '<div class="gsf-row">'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Previous Order #</label>'
            + '    <input type="text" class="gsf-input" id="gsf-prev-order" placeholder="ShopWorks order #">'
            + '    <span class="gsf-err" id="gsf-prev-order-error">Previous order # is required for a repeat / revision</span>'
            + '  </div>'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">Previous Design #</label>'
            + '    <input type="text" class="gsf-input" id="gsf-prev-design" placeholder="Previous design #">'
            + '    <span class="gsf-err" id="gsf-prev-design-error">Previous design # is required for a repeat / revision</span>'
            + '  </div>'
            + '</div>'
            + '<div class="gsf-row">'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">What should stay the same</label>'
            + '    <input type="text" class="gsf-input" id="gsf-keep-same" placeholder="e.g. keep colors, layout, stitch count">'
            + '  </div>'
            + '  <div class="gsf-field">'
            + '    <label class="gsf-label">What should change</label>'
            + '    <input type="text" class="gsf-input" id="gsf-change" placeholder="e.g. swap name to \'Smith\', new tagline">'
            + '    <span class="gsf-err" id="gsf-change-error">Describe what changes for a revision</span>'
            + '  </div>'
            + '</div>'
            + '</div>';
    }

    function buildFilesSection() {
        return sectionHeader('9', 'Files &amp; File Type', 'Attach the customer artwork and tell Steve what kind of file it is.')
            + '<div class="gsf-field">'
            + '  <label class="gsf-label">What was provided? <span class="gsf-req">*</span></label>'
            + '  <select class="gsf-select" id="gsf-file-type">' + optionList(FILE_TYPES) + '</select>'
            + '  <span class="gsf-err" id="gsf-file-type-error">Pick the file type, or upload a file / give a previous design #</span>'
            + '</div>'
            + '<div class="gsf-field">'
            + '  <label class="gsf-label">Upload Files</label>'
            + '  <div class="gsf-file-drop" id="gsf-file-drop">'
            + '    <svg class="gsf-file-drop-icon" viewBox="0 0 36 32" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">'
            + '      <rect x="2" y="6" width="20" height="24" rx="2" fill="#e5e7eb"></rect>'
            + '      <rect x="8" y="4" width="20" height="24" rx="2" fill="#f3f4f6"></rect>'
            + '      <rect x="14" y="2" width="20" height="24" rx="2" fill="#ffffff"></rect>'
            + '    </svg>'
            + '    <div class="gsf-file-drop-cta" id="gsf-file-drop-cta">Drop files here</div>'
            + '    <div class="gsf-file-drop-sub" id="gsf-file-drop-sub">or click to browse — up to ' + MAX_FILES + ' files</div>'
            + '    <div class="gsf-file-drop-dots" id="gsf-file-drop-dots">'
            + '      <span class="gsf-file-drop-dot"></span><span class="gsf-file-drop-dot"></span>'
            + '      <span class="gsf-file-drop-dot"></span><span class="gsf-file-drop-dot"></span>'
            + '    </div>'
            + '  </div>'
            + '  <div class="gsf-file-drop-types">.AI, .EPS, .PDF, .PNG, .JPG, .SVG · 20MB each. Larger? Upload to Box and paste the link in notes.</div>'
            + '  <input type="file" id="gsf-file-input" style="display:none;" accept="image/*,.pdf,.eps,.ai,.svg" multiple>'
            + '  <div id="gsf-carried-art-status" class="gsf-carried-status" style="display:none;"></div>'
            + '  <div id="gsf-file-preview-area"></div>'
            + '</div>'
            + '</div>';
    }

    function buildNotesSection() {
        return sectionHeader('10', 'Additional Art Notes', 'Short bullet points only. Do NOT use this for size, placement, color, wording, or approval — those have their own fields above.')
            + '<div class="gsf-field">'
            + '  <textarea class="gsf-textarea" id="gsf-notes" placeholder="• Anything else Steve should know\n• Keep it short — bullets only"></textarea>'
            + '</div>'
            + '</div>';
    }

    function buildChecklistSection() {
        var items = CHECKLIST_ITEMS.map(function (it) {
            return '<label class="gsf-check"><input type="checkbox" class="gsf-checklist" data-key="' + it.key + '"> ' + escapeHtml(it.label) + '</label>';
        }).join('');
        return sectionHeader('11', 'AE Final Checklist', 'Confirm before sending to Steve. A request is not ready until these are true.')
            + '<div class="gsf-checklist-grid">' + items + '</div>'
            + '<div class="gsf-checklist-actions"><button type="button" class="gsf-checkall" id="gsf-check-all">Check all</button></div>'
            + '<span class="gsf-err" id="gsf-checklist-error">Complete the final checklist before submitting</span>'
            + '</div>';
    }

    function buildSubmitSection() {
        return '<div class="gsf-submit-row">'
            + '  <button type="button" class="gsf-submit-btn" id="gsf-submit-btn">Submit Art Request</button>'
            + '  <span class="gsf-submit-status" id="gsf-submit-status"></span>'
            + '</div>';
    }

    // ── Garment rows (Style → Color cascade) ───────────────────────────────
    function renderGarmentRows() {
        var host = document.getElementById('gsf-garment-rows');
        if (!host) return;
        host.innerHTML = '';
        garmentRows.forEach(function (row, idx) {
            var el = document.createElement('div');
            el.className = 'gsf-garment-row';
            el.innerHTML = buildGarmentRowHtml(row, idx);
            host.appendChild(el);
            wireGarmentRow(idx);
        });
        var addBtn = document.getElementById('gsf-add-garment');
        if (addBtn) addBtn.style.display = garmentRows.length >= MAX_GARMENTS ? 'none' : '';
    }

    function buildGarmentRowHtml(row, idx) {
        var num = idx + 1;
        var colorControl;
        if (row.colorsError) {
            // Transient color-load failure — offer a retry instead of silently going custom
            // (which would drop the inventory-critical CATALOG_COLOR).
            colorControl = '<div class="gsf-color-error" id="gsf-color-err-' + idx + '">'
                + '<span class="gsf-color-error-msg">⚠ Couldn’t load colors.</span>'
                + ' <button type="button" class="gsf-color-retry" data-idx="' + idx + '">Retry</button>'
                + '</div>';
        } else if (row.custom) {
            colorControl = '<input type="text" class="gsf-input gsf-garment-color-text" id="gsf-color-' + idx + '" placeholder="Type color..." value="' + escapeAttr(row.colorName) + '">';
        } else if (row.colors && row.colors.length) {
            var opts = '<option value="">- color -</option>';
            row.colors.forEach(function (c) {
                opts += '<option value="' + escapeAttr(c.name) + '"' + (c.name === row.colorName ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>';
            });
            colorControl = '<select class="gsf-select gsf-garment-color" id="gsf-color-' + idx + '">' + opts + '</select>';
        } else {
            colorControl = '<select class="gsf-select gsf-garment-color" id="gsf-color-' + idx + '" disabled><option value="">- enter style first -</option></select>';
        }
        var swatch = row.swatch
            ? '<img class="gsf-swatch" src="' + escapeAttr(row.swatch) + '" alt="swatch" onerror="this.style.display=\'none\'">'
            : '<span class="gsf-swatch gsf-swatch--empty"></span>';
        var removeBtn = garmentRows.length > 1
            ? '<button type="button" class="gsf-row-remove" data-idx="' + idx + '" title="Remove garment">×</button>'
            : '';
        return '<span class="gsf-row-badge">' + num + '</span>'
            + '<div class="gsf-field gsf-garment-style-field">'
            + '  <input type="text" class="gsf-input gsf-garment-style" id="gsf-style-' + idx + '" placeholder="Style # (e.g. PC54)" value="' + escapeAttr(row.style) + '" autocomplete="off">'
            + '  <div class="gsf-style-suggest" id="gsf-style-suggest-' + idx + '"></div>'
            + '</div>'
            + '<div class="gsf-field gsf-garment-color-field">' + colorControl + '</div>'
            + swatch
            + removeBtn;
    }

    function wireGarmentRow(idx) {
        var styleInput = document.getElementById('gsf-style-' + idx);
        if (styleInput) {
            var timer = null;
            styleInput.addEventListener('input', function () {
                garmentRows[idx].style = styleInput.value.trim();
                if (timer) clearTimeout(timer);
                var q = styleInput.value.trim();
                if (q.length < 2) { hideStyleSuggest(idx); return; }
                timer = setTimeout(function () { fetchStyleSuggest(idx, q); }, 250);
            });
            styleInput.addEventListener('blur', function () {
                // Let a suggestion click register before hiding + loading colors.
                setTimeout(function () {
                    hideStyleSuggest(idx);
                    var v = styleInput.value.trim();
                    if (v) loadColorsForRow(idx, v);
                }, 200);
            });
        }
        var colorEl = document.getElementById('gsf-color-' + idx);
        if (colorEl) {
            colorEl.addEventListener('change', function () { onColorChosen(idx, colorEl.value); });
            colorEl.addEventListener('input', function () { if (garmentRows[idx].custom) onColorChosen(idx, colorEl.value); });
        }
        var retryBtn = document.querySelector('#gsf-color-err-' + idx + ' .gsf-color-retry');
        if (retryBtn) {
            retryBtn.addEventListener('click', function () {
                var v = (garmentRows[idx] && garmentRows[idx].style) || '';
                if (v) loadColorsForRow(idx, v);
            });
        }
        var removeBtn = document.querySelector('.gsf-row-remove[data-idx="' + idx + '"]');
        if (removeBtn) {
            removeBtn.addEventListener('click', function () {
                garmentRows.splice(idx, 1);
                renderGarmentRows();
            });
        }
    }

    function fetchStyleSuggest(idx, q) {
        fetch(API_BASE + '/api/stylesearch?term=' + encodeURIComponent(q))
            .then(function (r) { return r.ok ? r.json() : []; })
            .then(function (data) {
                var list = Array.isArray(data) ? data : (data && data.results) || [];
                var box = document.getElementById('gsf-style-suggest-' + idx);
                if (!box) return;
                if (!list.length) { box.style.display = 'none'; return; }
                var html = '';
                list.slice(0, 8).forEach(function (item) {
                    var style = item.value || item.styleNumber || item.STYLE || item.style || '';
                    var label = item.label || (style + (item.PRODUCT_TITLE || item.productName ? ' — ' + (item.PRODUCT_TITLE || item.productName) : ''));
                    if (!style) return;
                    html += '<div class="gsf-style-opt" data-style="' + escapeAttr(style) + '">' + escapeHtml(label) + '</div>';
                });
                box.innerHTML = html;
                box.style.display = html ? 'block' : 'none';
                box.querySelectorAll('.gsf-style-opt').forEach(function (opt) {
                    opt.addEventListener('mousedown', function (e) {
                        e.preventDefault();
                        var style = opt.getAttribute('data-style');
                        var styleInput = document.getElementById('gsf-style-' + idx);
                        if (styleInput) styleInput.value = style;
                        garmentRows[idx].style = style;
                        hideStyleSuggest(idx);
                        loadColorsForRow(idx, style);
                    });
                });
            })
            .catch(function () {});
    }

    function hideStyleSuggest(idx) {
        var box = document.getElementById('gsf-style-suggest-' + idx);
        if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    }

    function loadColorsForRow(idx, style) {
        if (!style) return;
        if (garmentRows[idx]) garmentRows[idx].colorsError = false;
        fetch(API_BASE + '/api/product-colors?styleNumber=' + encodeURIComponent(style))
            .then(function (r) {
                // A non-ok response is a TRANSIENT error, NOT "this style has no colors".
                // Throw so it lands in .catch and shows a retry state — never silently
                // switch a real style to custom (that would drop CATALOG_COLOR, which is
                // inventory-critical for the ShopWorks PO).
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var raw = (data && (data.colors || data.data || data.Result)) || (Array.isArray(data) ? data : []);
                var colors = (raw || []).map(function (c) {
                    return {
                        name: c.COLOR_NAME || c.colorName || c.color || '',
                        catalog: c.CATALOG_COLOR || c.catalogColor || c.CATALOG_COLOR_NAME || '',
                        swatch: c.COLOR_SQUARE_IMAGE || c.COLOR_SWATCH_IMAGE_URL || c.swatchUrl || c.COLOR_SQUARE_IMAGE_URL || '',
                        image: c.MAIN_IMAGE_URL || c.FRONT_MODEL_IMAGE_URL || c.mainImageUrl || ''
                    };
                }).filter(function (c) { return c.name; });
                garmentRows[idx].colors = colors;
                garmentRows[idx].colorsError = false;
                // A genuinely empty list (successful fetch, no colors) legitimately means
                // "type a custom color". A fetch error does NOT reach this branch.
                garmentRows[idx].custom = colors.length === 0;
                if (colors.length === 0) {
                    garmentRows[idx].catalogColor = '';
                    garmentRows[idx].swatch = '';
                    garmentRows[idx].image = '';
                }
                renderGarmentRows();
            })
            .catch(function (err) {
                // Transient failure: surface a visible retry state on the row and do NOT
                // set custom=true, so a temporary API blip isn't baked into the request as
                // a missing CATALOG_COLOR.
                console.error('[GarmentSubmitForm] Failed to load colors for style "' + style + '":', err);
                garmentRows[idx].colors = [];
                garmentRows[idx].colorsError = true;
                renderGarmentRows();
            });
    }

    function onColorChosen(idx, value) {
        var row = garmentRows[idx];
        row.colorName = value;
        if (row.custom) {
            row.catalogColor = '';
            row.swatch = '';
            row.image = '';
            return;
        }
        var match = (row.colors || []).filter(function (c) { return c.name === value; })[0];
        if (match) {
            row.catalogColor = match.catalog || '';
            row.swatch = match.swatch || '';
            row.image = match.image || '';
        } else {
            row.catalogColor = '';
            row.swatch = '';
            row.image = '';
        }
        renderGarmentRows();
    }

    // ── Artwork locations ──────────────────────────────────────────────────
    function renderLocations() {
        var host = document.getElementById('gsf-locations');
        if (!host) return;
        host.innerHTML = '';
        artworkLocations.forEach(function (loc, idx) {
            var el = document.createElement('div');
            el.className = 'gsf-location-row';
            el.innerHTML = buildLocationHtml(loc, idx);
            host.appendChild(el);
            wireLocation(idx);
        });
        var addBtn = document.getElementById('gsf-add-location');
        if (addBtn) addBtn.style.display = artworkLocations.length >= MAX_LOCATIONS ? 'none' : '';
    }

    function buildLocationHtml(loc, idx) {
        var num = idx + 1;
        var placeOpts = '<option value="">- placement -</option>';
        PLACEMENTS.forEach(function (p) {
            placeOpts += '<option value="' + escapeAttr(p) + '"' + (p === loc.placement ? ' selected' : '') + '>' + escapeHtml(p) + '</option>';
        });
        var removeBtn = artworkLocations.length > 1
            ? '<button type="button" class="gsf-row-remove" data-locidx="' + idx + '" title="Remove location">×</button>'
            : '';
        return '<span class="gsf-row-badge">' + num + '</span>'
            + '<div class="gsf-loc-grid">'
            + '  <div class="gsf-field gsf-loc-place">'
            + '    <label class="gsf-mini-label">Placement <span class="gsf-req">*</span></label>'
            + '    <select class="gsf-select gsf-loc-placement" id="gsf-loc-place-' + idx + '">' + placeOpts + '</select>'
            + '  </div>'
            + '  <div class="gsf-field gsf-loc-dim">'
            + '    <label class="gsf-mini-label">Width" <span class="gsf-req">*</span></label>'
            + '    <input type="number" class="gsf-input gsf-loc-width" id="gsf-loc-w-' + idx + '" placeholder="W" min="0.1" step="0.1" value="' + escapeAttr(loc.width) + '">'
            + '  </div>'
            + '  <div class="gsf-field gsf-loc-dim">'
            + '    <label class="gsf-mini-label">Height"</label>'
            + '    <input type="number" class="gsf-input gsf-loc-height" id="gsf-loc-h-' + idx + '" placeholder="H" min="0.1" step="0.1" value="' + escapeAttr(loc.height) + '">'
            + '  </div>'
            + '  <div class="gsf-field gsf-loc-notes">'
            + '    <label class="gsf-mini-label">Placement instructions</label>'
            + '    <input type="text" class="gsf-input gsf-loc-note" id="gsf-loc-n-' + idx + '" placeholder="e.g. centered, 2.5&quot; down from collar" value="' + escapeAttr(loc.notes) + '">'
            + '  </div>'
            + '</div>'
            + removeBtn;
    }

    function wireLocation(idx) {
        var place = document.getElementById('gsf-loc-place-' + idx);
        var w = document.getElementById('gsf-loc-w-' + idx);
        var h = document.getElementById('gsf-loc-h-' + idx);
        var n = document.getElementById('gsf-loc-n-' + idx);
        if (place) place.addEventListener('change', function () { artworkLocations[idx].placement = place.value; });
        if (w) w.addEventListener('input', function () { artworkLocations[idx].width = w.value.trim(); });
        if (h) h.addEventListener('input', function () { artworkLocations[idx].height = h.value.trim(); });
        if (n) n.addEventListener('input', function () { artworkLocations[idx].notes = n.value.trim(); });
        var removeBtn = document.querySelector('.gsf-row-remove[data-locidx="' + idx + '"]');
        if (removeBtn) {
            removeBtn.addEventListener('click', function () {
                artworkLocations.splice(idx, 1);
                renderLocations();
            });
        }
    }

    // ── Wire top-level events ──────────────────────────────────────────────
    function wireEvents() {
        var addGarment = document.getElementById('gsf-add-garment');
        if (addGarment) addGarment.addEventListener('click', function () {
            if (garmentRows.length < MAX_GARMENTS) { garmentRows.push(newGarmentRow()); renderGarmentRows(); }
        });
        var addLoc = document.getElementById('gsf-add-location');
        if (addLoc) addLoc.addEventListener('click', function () {
            if (artworkLocations.length < MAX_LOCATIONS) { artworkLocations.push(newLocation()); renderLocations(); }
        });

        // Reveal the patch-specs panel when "Laser Leatherette Patch" is ticked.
        document.querySelectorAll('.gsf-decoration').forEach(function (cb) {
            cb.addEventListener('change', applyPatchVisibility);
        });
        var patchMat = document.getElementById('gsf-patch-material');
        if (patchMat) patchMat.addEventListener('change', applyPatchMaterialOther);

        var artStatus = document.getElementById('gsf-artwork-status');
        if (artStatus) artStatus.addEventListener('change', applyArtworkStatusAdaptive);
        var approval = document.getElementById('gsf-approval-status');
        if (approval) approval.addEventListener('change', applyApprovalAdaptive);

        var noText = document.getElementById('gsf-no-text');
        if (noText) noText.addEventListener('change', function () {
            var ta = document.getElementById('gsf-exact-text');
            if (ta) { ta.disabled = noText.checked; if (noText.checked) ta.value = ''; }
        });

        var checkAll = document.getElementById('gsf-check-all');
        if (checkAll) checkAll.addEventListener('click', function () {
            document.querySelectorAll('.gsf-checklist').forEach(function (cb) { cb.checked = true; });
        });

        // File upload
        var fileDrop = document.getElementById('gsf-file-drop');
        var fileInput = document.getElementById('gsf-file-input');
        if (fileDrop && fileInput) {
            fileDrop.addEventListener('click', function () { fileInput.click(); });
            fileInput.addEventListener('change', function () {
                if (fileInput.files.length > 0) addReferenceFiles(fileInput.files);
            });
            fileDrop.addEventListener('dragover', function (e) { e.preventDefault(); fileDrop.classList.add('gsf-file-drop--active'); });
            fileDrop.addEventListener('dragleave', function () { fileDrop.classList.remove('gsf-file-drop--active'); });
            fileDrop.addEventListener('drop', function (e) {
                e.preventDefault();
                fileDrop.classList.remove('gsf-file-drop--active');
                if (e.dataTransfer.files.length > 0) addReferenceFiles(e.dataTransfer.files);
            });
        }

        var rushBtn = document.getElementById('gsf-rush-toggle');
        if (rushBtn) rushBtn.addEventListener('click', function () {
            isRush = !isRush;
            rushBtn.classList.toggle('gsf-rush-toggle--active', isRush);
            rushBtn.setAttribute('aria-pressed', isRush ? 'true' : 'false');
        });

        var submitBtn = document.getElementById('gsf-submit-btn');
        if (submitBtn) submitBtn.addEventListener('click', handleSubmit);
    }

    // ── Adaptive behavior by Artwork / Approval status ─────────────────────
    function currentArtworkStatus() {
        var el = document.getElementById('gsf-artwork-status');
        return el ? el.value : '';
    }
    function isRepeatOrRevision() {
        var s = currentArtworkStatus();
        return s === 'Repeat from previous order' || s === 'Revision to existing proof';
    }
    function applyArtworkStatusAdaptive() {
        var prevSection = findSectionByNum('8');
        if (prevSection) prevSection.classList.toggle('gsf-section--required', isRepeatOrRevision());
    }
    function applyApprovalAdaptive() {
        var el = document.getElementById('gsf-approval-status');
        var warn = document.getElementById('gsf-approval-warn');
        if (warn) warn.style.display = (el && el.value === APPROVED_VALUE) ? 'block' : 'none';
    }
    function findSectionByNum(num) {
        var nums = document.querySelectorAll('.gsf-section-num');
        for (var i = 0; i < nums.length; i++) {
            if (nums[i].textContent === num) return nums[i].closest('.gsf-section');
        }
        return null;
    }

    // ── Laser leatherette patch helpers ────────────────────────────────────
    function isPatchSelected() {
        var sel = false;
        document.querySelectorAll('.gsf-decoration:checked').forEach(function (cb) {
            if (cb.value === PATCH_METHOD) sel = true;
        });
        return sel;
    }
    function applyPatchVisibility() {
        var sec = document.getElementById('gsf-patch-section');
        if (sec) sec.style.display = isPatchSelected() ? '' : 'none';
    }
    function applyPatchMaterialOther() {
        var sel = document.getElementById('gsf-patch-material');
        var field = document.getElementById('gsf-patch-material-other-field');
        if (field) field.style.display = (sel && sel.value === PATCH_MATERIAL_OTHER) ? '' : 'none';
    }
    // The patch attributes as a single object, ready to ride inside the
    // Artwork_Locations JSON. Empty keys are dropped so the detail renderer
    // only shows fields the AE actually filled.
    function buildPatchSpec() {
        var material = getVal('gsf-patch-material');
        if (material === PATCH_MATERIAL_OTHER) material = getVal('gsf-patch-material-other') || 'Other (see notes)';
        var spec = {
            material: material,
            shape: getVal('gsf-patch-shape'),
            width: getVal('gsf-patch-width'),
            height: getVal('gsf-patch-height'),
            edge: getVal('gsf-patch-edge'),
            attach: getVal('gsf-patch-attach')
        };
        Object.keys(spec).forEach(function (k) { if (!spec[k]) delete spec[k]; });
        return spec;
    }
    function patchNotesBlock(spec) {
        var lines = ['LASER LEATHERETTE PATCH'];
        if (spec.material) lines.push('• Material: ' + spec.material);
        if (spec.shape) lines.push('• Shape: ' + spec.shape);
        var size = '';
        if (spec.width && spec.height) size = spec.width + '" × ' + spec.height + '"';
        else if (spec.width) size = spec.width + '" wide';
        if (size) lines.push('• Size: ' + size);
        if (spec.edge) lines.push('• Edge: ' + spec.edge);
        if (spec.attach) lines.push('• Attachment: ' + spec.attach);
        return lines.join('\n');
    }

    // ── Pickers ────────────────────────────────────────────────────────────
    function initCompanyAutocomplete() {
        if (typeof CompanyContactPicker === 'undefined') {
            console.warn('[GarmentSubmitForm] CompanyContactPicker not loaded — plain inputs.');
            return;
        }
        customerLookup = new CompanyContactPicker();
        customerLookup.bindPair({
            companyInputId: 'gsf-company',
            contactInputId: 'gsf-contact-name',
            emailInputId: 'gsf-contact-email',
            customerIdHiddenId: 'gsf-customer-id',
            onSelect: function (selection) {
                selectedContact = selection.contact || null;
                clearError('gsf-company');
                // Mirror id_Customer into the visible SW Cust# box.
                var custNum = document.getElementById('gsf-cust-num');
                if (custNum && selection.customerId) custNum.value = String(selection.customerId);
            },
            onClear: function () { selectedContact = null; }
        });
    }

    function initDesignNameAutocomplete() {
        // Garment form has no Design Name field, but the Design # reverse
        // lookup still uses DesignNamePicker.lookupByNumber (below).
    }

    function initWorkOrderAutocomplete() {
        if (typeof WorkOrderPicker === 'undefined') return;
        WorkOrderPicker.bind({
            inputId: 'gsf-order-num',
            getCustomerId: function () {
                return parseInt(document.getElementById('gsf-customer-id').value, 10) || 0;
            },
            onSelect: function (order) {
                var numEl = document.getElementById('gsf-design-num');
                if (numEl && !numEl.value.trim() && order.id_Design) {
                    numEl.value = String(order.id_Design);
                    clearError('gsf-design-num');
                }
            }
        });
    }

    function initDesignNumLookup() {
        if (typeof DesignNamePicker === 'undefined') return;
        var numEl = document.getElementById('gsf-design-num');
        var warnEl = document.getElementById('gsf-design-num-warning');
        if (!numEl) return;
        function clearWarn() { if (warnEl) { warnEl.style.display = 'none'; warnEl.textContent = ''; } }
        numEl.addEventListener('blur', function () {
            var num = (numEl.value || '').trim();
            if (!num) { clearWarn(); return; }
            DesignNamePicker.lookupByNumber(num).then(function (design) {
                if (!design) { clearWarn(); return; }
                var pickedCustomer = parseInt(document.getElementById('gsf-customer-id').value, 10) || 0;
                var designCustomer = parseInt(design.customerId, 10) || 0;
                if (pickedCustomer && designCustomer && pickedCustomer !== designCustomer) {
                    if (warnEl) {
                        warnEl.textContent = 'Design #' + num + ' belongs to ' + (design.company || 'a different customer')
                            + ' — not the customer you picked. Double-check before submitting.';
                        warnEl.style.display = 'block';
                    }
                } else { clearWarn(); }
            }).catch(function () {});
        });
        numEl.addEventListener('input', function () { clearWarn(); if (numEl.value.trim()) clearError('gsf-design-num'); });
    }

    function initDueDateDefault() {
        if (typeof window.NWCA_DateUtils === 'undefined') return;
        var dueDate = document.getElementById('gsf-due-date');
        if (dueDate && !dueDate.value) dueDate.value = window.NWCA_DateUtils.addBusinessDays(3);
    }

    function initSalesRep() {
        var repInput = document.getElementById('gsf-sales-rep');
        if (!repInput) return;
        if (typeof StaffAuthHelper !== 'undefined' && StaffAuthHelper.isLoggedIn()) {
            var name = StaffAuthHelper.getLoggedInStaffName();
            if (name) { repInput.value = name; repInput.readOnly = true; return; }
        }
        repInput.readOnly = false;
        repInput.placeholder = 'Enter your name';
    }

    // ── Files ──────────────────────────────────────────────────────────────
    function addReferenceFiles(fileList) {
        var allowed = MAX_FILES - referenceFiles.length - prefilledUploads.length;
        for (var i = 0; i < fileList.length && i < allowed; i++) {
            var f = fileList[i];
            if (f.size > 20 * 1024 * 1024) { showToast('"' + f.name + '" is over 20MB and was skipped.', 'error'); continue; }
            referenceFiles.push(f);
        }
        renderFilePreviews();
        updateFileDropState();
        // Picking a file is the natural moment to suggest a file type.
        var ft = document.getElementById('gsf-file-type');
        if (ft && !ft.value && referenceFiles.length) {
            var name = referenceFiles[0].name.toLowerCase();
            if (/\.(ai|eps|pdf|svg)$/.test(name)) ft.value = FILE_TYPES[0];
            else if (/\.(png|jpg|jpeg)$/.test(name)) ft.value = FILE_TYPES[1];
            if (ft.value) clearError('gsf-file-type');
        }
    }

    function updateFileDropState() {
        var dropEl = document.getElementById('gsf-file-drop');
        var ctaEl = document.getElementById('gsf-file-drop-cta');
        var subEl = document.getElementById('gsf-file-drop-sub');
        var dotsEl = document.getElementById('gsf-file-drop-dots');
        if (!dropEl || !ctaEl || !subEl || !dotsEl) return;
        var n = referenceFiles.length + prefilledUploads.length;
        var remaining = MAX_FILES - n;
        if (n === 0) {
            ctaEl.textContent = 'Drop files here';
            subEl.textContent = 'or click to browse — up to ' + MAX_FILES + ' files';
        } else if (n < MAX_FILES) {
            ctaEl.textContent = 'Add another file';
            subEl.textContent = remaining + ' more can be added';
        } else {
            ctaEl.textContent = 'All ' + MAX_FILES + ' slots filled';
            subEl.textContent = 'Remove a file to add another';
        }
        var dots = dotsEl.querySelectorAll('.gsf-file-drop-dot');
        for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('gsf-file-drop-dot--filled', i < n);
        dropEl.classList.toggle('gsf-file-drop--full', n >= MAX_FILES);
    }

    function renderFilePreviews() {
        var area = document.getElementById('gsf-file-preview-area');
        if (!area) return;
        if (referenceFiles.length === 0 && prefilledUploads.length === 0) { area.innerHTML = ''; return; }
        var html = '<div class="gsf-file-list">';
        // Carried-over files first (already in the Artwork folder), tagged so the
        // user can see they came from the quote and can remove them if needed.
        prefilledUploads.forEach(function (u, idx) {
            html += '<div class="gsf-file-item">'
                + '<span class="gsf-file-name">' + escapeHtml(u.displayName || u.fileName) + '</span>'
                + '<span class="gsf-file-badge">from quote</span>'
                + '<button type="button" class="gsf-file-remove" data-kind="pre" data-idx="' + idx + '" title="Remove">×</button>'
                + '</div>';
        });
        referenceFiles.forEach(function (f, idx) {
            html += '<div class="gsf-file-item">'
                + '<span class="gsf-file-name">' + escapeHtml(f.name) + '</span>'
                + '<span class="gsf-file-size">' + formatFileSize(f.size) + '</span>'
                + '<button type="button" class="gsf-file-remove" data-kind="ref" data-idx="' + idx + '" title="Remove">×</button>'
                + '</div>';
        });
        html += '</div>';
        area.innerHTML = html;
        area.querySelectorAll('.gsf-file-remove').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idx = parseInt(btn.getAttribute('data-idx'), 10);
                if (btn.getAttribute('data-kind') === 'pre') prefilledUploads.splice(idx, 1);
                else referenceFiles.splice(idx, 1);
                renderFilePreviews();
                updateFileDropState();
            });
        });
    }

    // Status line for the "carried over from the quote" flow. kind: '' | 'ok' | 'error'.
    function renderCarriedStatus(message, kind) {
        var el = document.getElementById('gsf-carried-art-status');
        if (!el) return;
        if (!message) { el.style.display = 'none'; el.textContent = ''; return; }
        el.style.display = 'block';
        el.className = 'gsf-carried-status'
            + (kind === 'error' ? ' gsf-carried-status--error' : (kind === 'ok' ? ' gsf-carried-status--ok' : ''));
        el.textContent = message;
    }

    // Import the customer's artwork + approved mockups (by URL) into the Caspio
    // Artwork folder server-side, then show them as carried-over reference files.
    // No browser CORS, no manual download/re-upload. Visible status on success
    // AND failure — never silently drop a file (Erik's #1 rule).
    function importArtworkUrls(list) {
        var items = (list || []).filter(function (x) { return x && x.url; });
        if (!items.length) return;
        var truncated = 0;
        if (items.length > MAX_FILES) { truncated = items.length - MAX_FILES; items = items.slice(0, MAX_FILES); }
        var failed = [];
        renderCarriedStatus('Carrying over ' + items.length + ' file(s) from the quote…');
        function next(i) {
            if (i >= items.length) {
                renderFilePreviews();
                updateFileDropState();
                var okCount = prefilledUploads.length;
                if (failed.length) {
                    var msg = '⚠ ' + failed.length + ' file(s) could not be carried over — upload them manually: ' + failed.join(', ');
                    renderCarriedStatus(msg, 'error');
                    showToast(msg, 'error');
                } else {
                    var done = '✓ ' + okCount + ' file(s) carried over from the quote'
                        + (truncated ? (' (' + truncated + ' more not attached — only 4 fit)') : '') + '.';
                    renderCarriedStatus(done, 'ok');
                }
                return;
            }
            var it = items[i];
            var label = it.displayName || it.fileName || it.url;
            return fetch(API_BASE + '/api/files/import-from-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: it.url, fileName: it.fileName || it.displayName || '' })
            })
                .then(function (r) {
                    if (!r.ok) return r.text().then(function (b) { throw new Error('HTTP ' + r.status + (b ? (' ' + b) : '')); });
                    return r.json();
                })
                .then(function (data) {
                    if (data && data.success && data.fileName) {
                        prefilledUploads.push({ fileName: data.fileName, displayName: label });
                        renderFilePreviews();
                        updateFileDropState();
                    } else {
                        failed.push(label);
                    }
                })
                .catch(function (err) {
                    console.warn('[GarmentSubmitForm] artwork import failed for', it.url, err);
                    failed.push(label);
                })
                .then(function () { return next(i + 1); });
        }
        next(0);
    }

    // ── Validation ─────────────────────────────────────────────────────────
    function setError(id, on) {
        var input = document.getElementById(id);
        var err = document.getElementById(id + '-error');
        if (input) input.classList.toggle('gsf-error', !!on);
        if (err) err.style.display = on ? 'block' : 'none';
    }
    function clearError(id) { setError(id, false); }

    function validate() {
        var valid = true;
        function req(id, cond) {
            var ok = cond;
            setError(id, !ok);
            if (!ok) valid = false;
            return ok;
        }

        req('gsf-company', !!getVal('gsf-company'));
        req('gsf-contact-name', !!getVal('gsf-contact-name'));
        req('gsf-due-date', !!getVal('gsf-due-date'));
        req('gsf-design-num', !!getVal('gsf-design-num'));
        req('gsf-order-num', !!getVal('gsf-order-num'));
        req('gsf-artwork-status', !!getVal('gsf-artwork-status'));
        req('gsf-approval-status', !!getVal('gsf-approval-status'));
        req('gsf-color-mode', !!getVal('gsf-color-mode'));

        // Decoration: at least one checkbox
        var decoChecked = document.querySelectorAll('.gsf-decoration:checked').length > 0;
        showInlineError('gsf-decoration-error', !decoChecked);
        if (!decoChecked) valid = false;

        // Laser leatherette patch: require the patch-only specs when chosen.
        if (isPatchSelected()) {
            req('gsf-patch-material', !!getVal('gsf-patch-material'));
            if (getVal('gsf-patch-material') === PATCH_MATERIAL_OTHER) {
                req('gsf-patch-material-other', !!getVal('gsf-patch-material-other'));
            } else {
                clearError('gsf-patch-material-other');
            }
            req('gsf-patch-shape', !!getVal('gsf-patch-shape'));
            req('gsf-patch-width', !!getVal('gsf-patch-width'));
            req('gsf-patch-attach', !!getVal('gsf-patch-attach'));
        } else {
            clearError('gsf-patch-material'); clearError('gsf-patch-material-other');
            clearError('gsf-patch-shape'); clearError('gsf-patch-width'); clearError('gsf-patch-attach');
        }

        // At least one location with placement + width
        syncLocationsFromDom();
        var hasLoc = artworkLocations.some(function (l) { return l.placement && l.width; });
        showInlineError('gsf-location-error', !hasLoc);
        if (!hasLoc) valid = false;

        // Exact text required unless "no text"
        var noText = document.getElementById('gsf-no-text');
        var hasText = !!getVal('gsf-exact-text') || (noText && noText.checked);
        setError('gsf-exact-text', !hasText);
        if (!hasText) valid = false;

        // Artwork source: a file OR a previous design # OR file type "must recreate"
        var fileType = getVal('gsf-file-type');
        var hasSource = referenceFiles.length > 0 || prefilledUploads.length > 0 || !!getVal('gsf-prev-design') || (fileType === FILE_TYPES[4]) || (fileType === FILE_TYPES[3]);
        setError('gsf-file-type', !(fileType && hasSource) && !hasSource);
        if (!hasSource) { setError('gsf-file-type', true); valid = false; }
        else if (!fileType) { setError('gsf-file-type', true); valid = false; }

        // Repeat / revision require previous references
        if (isRepeatOrRevision()) {
            req('gsf-prev-order', !!getVal('gsf-prev-order'));
            req('gsf-prev-design', !!getVal('gsf-prev-design'));
            if (currentArtworkStatus() === 'Revision to existing proof') {
                req('gsf-change', !!getVal('gsf-change'));
            }
        } else {
            clearError('gsf-prev-order'); clearError('gsf-prev-design'); clearError('gsf-change');
        }

        // AE final checklist — all boxes
        var total = document.querySelectorAll('.gsf-checklist').length;
        var checked = document.querySelectorAll('.gsf-checklist:checked').length;
        var checklistOk = total > 0 && checked === total;
        showInlineError('gsf-checklist-error', !checklistOk);
        if (!checklistOk) valid = false;

        return valid;
    }

    function showInlineError(errId, on) {
        var err = document.getElementById(errId);
        if (err) err.style.display = on ? 'block' : 'none';
    }

    function getVal(id) {
        var el = document.getElementById(id);
        return el ? (el.value || '').trim() : '';
    }

    function syncLocationsFromDom() {
        artworkLocations.forEach(function (loc, idx) {
            var place = document.getElementById('gsf-loc-place-' + idx);
            var w = document.getElementById('gsf-loc-w-' + idx);
            var h = document.getElementById('gsf-loc-h-' + idx);
            var n = document.getElementById('gsf-loc-n-' + idx);
            if (place) loc.placement = place.value;
            if (w) loc.width = w.value.trim();
            if (h) loc.height = h.value.trim();
            if (n) loc.notes = n.value.trim();
        });
    }

    function syncGarmentColorsFromDom() {
        garmentRows.forEach(function (row, idx) {
            var colorEl = document.getElementById('gsf-color-' + idx);
            var styleEl = document.getElementById('gsf-style-' + idx);
            if (styleEl) row.style = styleEl.value.trim();
            if (colorEl) row.colorName = colorEl.value;
        });
    }

    // ── Submit ─────────────────────────────────────────────────────────────
    function handleSubmit() {
        if (!validate()) {
            showToast('Please complete all required fields and the final checklist', 'error');
            var firstErr = document.querySelector('.gsf-error, .gsf-err[style*="block"]');
            if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        var btn = document.getElementById('gsf-submit-btn');
        var statusEl = document.getElementById('gsf-submit-status');
        btn.disabled = true;
        statusEl.textContent = 'Uploading files...';

        syncLocationsFromDom();
        syncGarmentColorsFromDom();

        var companyName = getVal('gsf-company');
        var aeName = getSubmitterName();
        var aeEmail = getSubmitterEmail();
        var salesRep = getVal('gsf-sales-rep') || aeName;
        var salesRepEmail = '';
        if (typeof StaffAuthHelper !== 'undefined' && StaffAuthHelper.STAFF_EMAIL_MAP) {
            salesRepEmail = StaffAuthHelper.STAFF_EMAIL_MAP[salesRep] || '';
        }

        uploadFilesSequentially()
            .then(function (upload) {
                if (upload.failedFiles && upload.failedFiles.length > 0) {
                    var msg = upload.failedFiles.length === 1
                        ? 'Could not upload "' + upload.failedFiles[0] + '" — please retry'
                        : 'Could not upload ' + upload.failedFiles.length + ' files (' + upload.failedFiles.join(', ') + ') — please retry';
                    var err = new Error(msg);
                    err.code = 'UPLOAD_FAILED';
                    throw err;
                }
                statusEl.textContent = 'Creating request...';
                var payload = buildPayload(companyName, aeName, aeEmail, salesRep, upload.results);
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
                var record = (result && result.record)
                    || (result && result.request && result.request.Result && result.request.Result[0])
                    || null;
                var designId = record && (record.ID_Design || record.PK_ID);
                statusEl.textContent = 'Notifying Steve...';
                sendNotificationEmails(designId, companyName, aeName, aeEmail, salesRep, salesRepEmail);
                showSuccess(designId, companyName);
                if (onSubmittedCb) { try { onSubmittedCb(designId, companyName); } catch (e) { /* non-fatal */ } }
            })
            .catch(function (err) {
                console.error('[GarmentSubmitForm] Submit error:', err);
                btn.disabled = false;
                statusEl.textContent = '';
                var toastMsg = (err && err.code === 'UPLOAD_FAILED') ? err.message : 'Submission failed: ' + err.message;
                showToast(toastMsg, 'error');
            });
    }

    function buildPayload(companyName, aeName, aeEmail, salesRep, uploaded) {
        var contactName = getVal('gsf-contact-name');
        var firstName = '', lastName = '';
        if (contactName) {
            var parts = contactName.split(/\s+/);
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ');
        }
        var customerId = parseInt(getVal('gsf-customer-id'), 10) || 0;
        var artworkStatus = getVal('gsf-artwork-status');

        // Decoration methods → Order_Type_Source (Order_Type is REST-unwriteable).
        var decos = [];
        document.querySelectorAll('.gsf-decoration:checked').forEach(function (cb) { decos.push(cb.value); });

        // Exact text — explicit marker when the design has no text.
        var noText = document.getElementById('gsf-no-text');
        var exactText = (noText && noText.checked) ? '— No text in this design —' : getVal('gsf-exact-text');

        // Laser leatherette patch — specs ride INSIDE the existing columns (no
        // new Caspio fields): each kept placement carries a `patch` object in
        // the Artwork_Locations JSON, the patch size back-fills the placement
        // size, and a readable block is prepended to NOTES for surfaces that
        // don't parse the JSON (galleries, emails).
        var isPatch = decos.indexOf(PATCH_METHOD) !== -1;
        var patchSpec = isPatch ? buildPatchSpec() : null;
        var keptLocs = artworkLocations.filter(function (l) { return l.placement || l.width; });
        var locsOut = keptLocs.map(function (l) {
            var o = { placement: l.placement, width: l.width, height: l.height, notes: l.notes };
            if (isPatch && patchSpec) {
                if (!o.width && patchSpec.width) o.width = patchSpec.width;
                if (!o.height && patchSpec.height) o.height = patchSpec.height;
                o.patch = patchSpec;
            }
            return o;
        });
        // Patch picked but no placement entered → keep the specs from being lost.
        if (isPatch && patchSpec && locsOut.length === 0) {
            locsOut.push({ placement: 'Cap Front', width: patchSpec.width || '', height: patchSpec.height || '', notes: '', patch: patchSpec });
        }

        var notesOut = getVal('gsf-notes');
        if (isPatch && patchSpec) {
            var block = patchNotesBlock(patchSpec);
            notesOut = notesOut ? block + '\n\n' + notesOut : block;
        }

        var payload = {
            CompanyName: companyName,
            Status: 'Submitted',
            Item_Type: 'Garment',
            Mockup: 'Yes',
            // Back-compat with code that still reads Request_Type.
            Request_Type: artworkStatus === 'Mockup only' ? 'Mockup' : 'New Artwork',
            Order_Type_Source: decos.join(', '),
            Due_Date: getVal('gsf-due-date') || null,
            First_name: firstName,
            Last_name: lastName,
            Full_Name_Contact: contactName,
            Email_Contact: getVal('gsf-contact-email'),
            Sales_Rep: salesRep,
            User_Email: aeEmail,
            Is_Rush: !!isRush,
            Revision_Count: 0,
            NOTES: notesOut,

            // New structured fields
            Artwork_Status: artworkStatus,
            Approval_Status: getVal('gsf-approval-status'),
            Color_Mode: getVal('gsf-color-mode'),
            PMS_Colors: getVal('gsf-pms'),
            Thread_Colors: getVal('gsf-thread'),
            Underbase_Required: getVal('gsf-underbase'),
            Exact_Text: exactText,
            Prev_Order_Num: getVal('gsf-prev-order'),
            Prev_Design_Num: getVal('gsf-prev-design'),
            Repeat_Keep_Same: getVal('gsf-keep-same'),
            Repeat_Change: getVal('gsf-change'),
            Uploaded_File_Type: getVal('gsf-file-type'),
            AE_Checklist_Confirmed: true,
            AE_Checklist_Confirmed_By: aeName,
            Artwork_Locations: JSON.stringify(locsOut)
        };

        // Primary placement → existing single Garment_Placement (back-compat
        // with dashboards/detail that still read it).
        var firstLoc = artworkLocations.filter(function (l) { return l.placement; })[0];
        if (firstLoc) payload.Garment_Placement = firstLoc.placement;

        if (customerId > 0) {
            payload.id_Customer = customerId;
            payload.Shopwork_customer_number = String(customerId);
        }
        var designNum = getVal('gsf-design-num');
        if (designNum) payload.Design_Num_SW = designNum;
        var orderNum = getVal('gsf-order-num');
        if (orderNum) payload.Order_Num_SW = orderNum;

        var prelim = getVal('gsf-prelim');
        if (prelim) payload.Prelim_Charges = prelim;

        // Garment rows → GarmentStyle/GarmentColor + Garm_Style_2..4 etc.
        var styleSlots = ['GarmentStyle', 'Garm_Style_2', 'Garm_Style_3', 'Garm_Style_4'];
        var colorSlots = ['GarmentColor', 'Garm_Color_2', 'Garm_Color_3', 'Garm_Color_4'];
        var swatchSlots = ['Swatch_1', 'Swatch_2', 'Swatch_3', 'Swatch_4'];
        var imageSlots = ['MAIN_IMAGE_URL_1', 'MAIN_IMAGE_URL_2', 'MAIN_IMAGE_URL_3', 'MAIN_IMAGE_URL_4'];
        garmentRows.forEach(function (row, i) {
            if (i >= styleSlots.length || !row.style) return;
            payload[styleSlots[i]] = row.style;
            if (row.colorName) payload[colorSlots[i]] = row.colorName;
            if (row.swatch) payload[swatchSlots[i]] = row.swatch;
            if (row.image) payload[imageSlots[i]] = row.image;
        });

        // File paths → File_Upload_One..Four. Carried-over art (already in the
        // Artwork folder via import-from-url) fills slots first, then newly
        // uploaded files. If the combined set exceeds the 4 slots, warn — never
        // silently drop (Erik's #1 rule).
        var slots = ['File_Upload_One', 'File_Upload_Two', 'File_Upload_Three', 'File_Upload_Four'];
        var allFiles = prefilledUploads
            .map(function (u) { return { fileName: u.fileName }; })
            .concat((uploaded || []).filter(Boolean));
        allFiles.forEach(function (u, i) {
            if (i < slots.length && u && u.fileName) payload[slots[i]] = '/Artwork/' + u.fileName;
        });
        if (allFiles.length > slots.length && typeof showToast === 'function') {
            showToast('Only the first 4 files were attached to the request (' + allFiles.length + ' provided).', 'error');
        }

        return payload;
    }

    function uploadFilesSequentially() {
        if (referenceFiles.length === 0) return Promise.resolve({ results: [], failedFiles: [] });
        var results = [];
        var failedFiles = [];
        var statusEl = document.getElementById('gsf-submit-status');
        function uploadNext(idx) {
            if (idx >= referenceFiles.length) return Promise.resolve({ results: results, failedFiles: failedFiles });
            var f = referenceFiles[idx];
            if (statusEl) statusEl.textContent = 'Uploading file ' + (idx + 1) + ' of ' + referenceFiles.length + '...';
            var fd = new FormData();
            fd.append('file', f);
            return fetch(API_BASE + '/api/files/upload', { method: 'POST', body: fd })
                .then(function (r) {
                    if (!r.ok) {
                        return r.text().then(function (body) {
                            console.warn('Upload failed for ' + f.name + ':', r.status, body);
                            results.push(null); failedFiles.push(f.name);
                        });
                    }
                    return r.json().then(function (data) {
                        if (data && data.success) results.push({ fileName: data.fileName, externalKey: data.externalKey });
                        else { console.warn('Upload reported failure for ' + f.name + ':', data && data.error); results.push(null); failedFiles.push(f.name); }
                    });
                })
                .catch(function (err) { console.warn('Upload error for ' + f.name + ':', err); results.push(null); failedFiles.push(f.name); })
                .then(function () { return uploadNext(idx + 1); });
        }
        return uploadNext(0);
    }

    function notifySteveFailed() {
        // The request WAS created — only the email to Steve didn't go through. Tell the
        // rep so they can ping Steve directly instead of assuming he was notified.
        showToast('Request created, but the email to Steve failed — please ping him directly.', 'error');
    }

    function sendNotificationEmails(designId, companyName, aeName, aeEmail, salesRepName, salesRepEmail) {
        if (typeof emailjs === 'undefined') {
            console.error('[GarmentSubmitForm] emailjs is undefined — Steve was NOT notified for design', designId);
            notifySteveFailed();
            return;
        }
        try {
            emailjs.init('4qSbDO-SQs19TbP80');
            var detailLink = SITE_ORIGIN + '/art-request/' + (designId || '');
            emailjs.send('service_jgrave3', 'template_art_note_added', {
                to_email: STEVE_EMAIL,
                to_name: 'Steve',
                design_id: designId || 'NEW',
                company_name: companyName,
                note_text: 'New garment art request from ' + aeName + ' for ' + companyName,
                note_type: 'New Garment Submission',
                header_emoji: '\u{1F455}',
                header_title: 'New Garment Art Request',
                detail_link: detailLink,
                from_name: aeName
            }).catch(function (err) {
                console.error('[GarmentSubmitForm] EmailJS send to Steve failed for design', designId, err);
                notifySteveFailed();
            });

            if (aeEmail && aeEmail !== STEVE_EMAIL) {
                emailjs.send('service_jgrave3', 'template_art_note_added', {
                    to_email: aeEmail,
                    to_name: aeName,
                    design_id: designId || 'NEW',
                    company_name: companyName,
                    note_text: 'Your garment art request for ' + companyName + ' was submitted to Steve.',
                    note_type: 'Submission Confirmation',
                    header_emoji: '✅',
                    header_title: 'Request Submitted',
                    detail_link: detailLink + '?view=ae',
                    from_name: 'NWCA Art Department'
                }).catch(function () {});
            }

            if (salesRepEmail && salesRepEmail !== STEVE_EMAIL && salesRepEmail !== aeEmail) {
                emailjs.send('service_jgrave3', 'template_art_note_added', {
                    to_email: salesRepEmail,
                    to_name: salesRepName || 'Sales Rep',
                    design_id: designId || 'NEW',
                    company_name: companyName,
                    note_text: 'A garment art request for ' + companyName + ' was submitted to Steve on your behalf by ' + aeName + '.',
                    note_type: 'Submission FYI (Sales Rep)',
                    header_emoji: '\u{1F4E8}',
                    header_title: 'Art Request — FYI',
                    detail_link: detailLink + '?view=ae',
                    from_name: 'NWCA Art Department'
                }).catch(function () {});
            }
        } catch (e) {
            console.error('[GarmentSubmitForm] EmailJS setup failed — Steve was NOT notified for design', designId, e);
            notifySteveFailed();
        }
    }

    // ── Success ────────────────────────────────────────────────────────────
    function showSuccess(designId, companyName) {
        var body = document.getElementById('gsf-form-body');
        body.innerHTML = '<div class="gsf-success">'
            + '<div class="gsf-success-icon">✅</div>'
            + '<h3>Art Request Submitted!' + (designId ? ' <span class="gsf-success-id">Design #' + escapeHtml(String(designId)) + '</span>' : '') + '</h3>'
            + '<p>Your garment art request for <strong>' + escapeHtml(companyName) + '</strong> has been sent to Steve with all the details. He will create the mockup and notify you when it\'s ready.</p>'
            + (designId ? '<a href="/art-request/' + designId + '?view=ae" class="gsf-success-link">View Request →</a>' : '')
            + '<button type="button" class="gsf-success-another" id="gsf-another-btn">Submit Another</button>'
            + '</div>';
        var anotherBtn = document.getElementById('gsf-another-btn');
        if (anotherBtn) anotherBtn.addEventListener('click', resetForm);
    }

    function resetForm() {
        referenceFiles = [];
        prefilledUploads = [];
        selectedContact = null;
        selectedDesign = null;
        isRush = false;
        garmentRows = [newGarmentRow()];
        artworkLocations = [newLocation()];
        renderForm();
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        var div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }
    function escapeAttr(str) {
        return escapeHtml(str).replace(/"/g, '&quot;');
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
        if (window.APP_CONFIG && window.APP_CONFIG.USER && window.APP_CONFIG.USER.email) return window.APP_CONFIG.USER.email;
        return localStorage.getItem('userEmail') || 'ae@nwcustomapparel.com';
    }
    function getSubmitterName() {
        if (typeof StaffAuthHelper !== 'undefined') {
            var name = StaffAuthHelper.getLoggedInStaffName();
            if (name) return name;
        }
        if (window.APP_CONFIG && window.APP_CONFIG.USER && window.APP_CONFIG.USER.name) return window.APP_CONFIG.USER.name;
        var email = getSubmitterEmail();
        var atIdx = email.indexOf('@');
        var local = atIdx > 0 ? email.substring(0, atIdx) : email;
        return local.charAt(0).toUpperCase() + local.slice(1);
    }
    function showToast(message, type) {
        type = type || 'info';
        document.querySelectorAll('.gsf-toast').forEach(function (t) { t.remove(); });
        var toast = document.createElement('div');
        toast.className = 'gsf-toast gsf-toast--' + type;
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(function () { toast.classList.add('show'); });
        setTimeout(function () { toast.classList.remove('show'); setTimeout(function () { toast.remove(); }, 300); }, 3500);
    }

    return {
        init: init,
        // Exposed for unit testing of the payload contract.
        _buildPayloadForTest: function (deps) {
            garmentRows = deps.garmentRows || garmentRows;
            artworkLocations = deps.artworkLocations || artworkLocations;
            isRush = !!deps.isRush;
            return buildPayload(deps.companyName, deps.aeName, deps.aeEmail, deps.salesRep, deps.uploaded || []);
        }
    };

})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GarmentSubmitForm;
}
