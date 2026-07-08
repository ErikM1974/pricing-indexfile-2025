// ============================================================
// SCREEN PRINT QUOTE BUILDER - Excel-Style Quote Builder
// ============================================================

// Use centralized config (fallback to hardcoded URL for backwards compatibility)
const API_BASE = window.APP_CONFIG.API.BASE_URL;

// NOTE: SIZE_MODIFIERS was removed - use SIZE_TO_SUFFIX (line ~1520) instead
// SIZE_TO_SUFFIX contains ALL size suffixes including tall, youth, toddler, etc.

// STANDARD_SIZES — now provided by extended-sizes-config.js

// Extended sizes that get their own line items
// Note: 2XL goes to Size05 (dedicated), all others go to Size06 (Other)
const EXTENDED_SIZES = ['XS', '2XL', '3XL', '4XL', '5XL', '6XL'];

// ShopWorks size slot mapping
// Size01-04: Standard sizes (S, M, L, XL) - combined into one line item
// Size05: 2XL only - separate line item
// Size06: ALL others (XS, 3XL, 4XL, 5XL, Youth, Tall, OSFA) - each gets separate line item
const SIZE_TO_SLOT = {
    'S': 'Size01', 'M': 'Size02', 'L': 'Size03', 'XL': 'Size04',
    '2XL': 'Size05',  // 2XL has dedicated slot
    'XS': 'Size06', '3XL': 'Size06', '4XL': 'Size06',
    '5XL': 'Size06', '6XL': 'Size06', 'OSFA': 'Size06'
};

// Display labels matching ShopWorks column headers
// Note: Internally we use L/2XL/3XL, but display as LG/XXL/XXXL
const SIZE_DISPLAY_LABELS = {
    'S': 'S', 'M': 'M', 'L': 'LG', 'XL': 'XL',
    '2XL': 'XXL', '3XL': 'XXXL',
    'XS': 'XXXL', '4XL': 'XXXL', '5XL': 'XXXL', '6XL': 'XXXL'
};

// State
let screenPrintPricingService = null;
let quoteService = null;

// Auto-save & Draft Recovery (2026 consolidation)
let spPersistence = null;
let spSession = null;

let products = [];
let rowCounter = 0;
let productCache = {}; // Cache product data for quick lookup
let childRowMap = {}; // Track child rows: { parentRowId: { '2XL': childRowId, '3XL': childRowId } }

// Edit mode state
let editingQuoteId = null;
let editingRevision = null;

// Unsaved changes tracking
let hasChanges = false;

// Screen Print Location Configuration
// Screen Print Configuration State
let printConfig = {
    frontLocation: 'LC',      // LC, FF, JF
    frontColors: 1,           // 1-6
    backLocation: '',         // '', FB, JB
    backColors: 1,            // 1-6
    leftSleeveColors: 0,      // 0 = off, else 1-6 — each sleeve is its OWN additional print location
    rightSleeveColors: 0,     // 0 = off, else 1-6 (may differ from the left)
    sleeveColorsList: [],     // engine-canonical [left?, right?] derived in updatePrintConfig
    isDarkGarment: false,     // Adds white underbase (+1 screen per location, INCLUDING each sleeve)
    isSafetyStripes: false,   // Adds $2/piece/location (front/back only — sleeves get no hi-vis stripe)
    totalScreens: 1,          // Calculated
    setupFee: 30.00           // Calculated: screens × $30
};

const SCREEN_FEE = 30.00; // $30 per screen

// Print location display names
const LOCATION_NAMES = {
    'LC': 'Left Chest',
    'FF': 'Full Front',
    'JF': 'Jumbo Front',
    'FB': 'Full Back',
    'JB': 'Jumbo Back'
};

// updatePrintConfig — MOVED to builders/scp/print-config.js (S1a, 2026-07-08).

// ── Dark-garment underbase nudge (expert audit 2026-07-07) ──────────────────
// The builder defaults isDarkGarment OFF while the standalone calculator defaults
// it ON (screenprint-pricing-v2.js:81), so forgetting the toggle on a black-hoodie
// job silently under-quotes setup by one $30 underbase screen per print location —
// per-piece price is unaffected in the house model, so nothing else looks wrong.
// Non-blocking by design: no-white-ink designs on darks are legitimate, the rep
// stays in charge. Color words mirror the calculator's darkColors list.
const SCP_DARK_COLOR_WORDS = ['black', 'navy', 'charcoal', 'forest', 'maroon', 'purple', 'brown', 'dark'];
let _darkNudgeDismissed = false;

// updateDarkGarmentNudge — MOVED to builders/scp/print-config.js (S1a, 2026-07-08).

// Extended sizes available for Size06 (Other) column
// Note: Actual available sizes are fetched dynamically per product via API
// Includes OSFA for beanies, bags, and other one-size-fits-all items
// All sizes that go in Size06 column (the "Other/Catch-All" column)
// Based on Python Inksoft/Inksoft_Size_Translation_Import.csv
// NOTE: 2XL and XXL are NOT here - they go in Size05 (XXL column)
const SIZE06_EXTENDED_SIZES = [
    // Extended large (3XL and up only - 2XL/XXL go in Size05)
    'XS', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL',
    // One-size
    'OSFA', 'OSFM',
    // Combos (for fitted caps)
    'S/M', 'M/L', 'L/XL', 'XS/S', 'X/2X', 'S/XL',
    // Tall
    'LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT', 'ST', 'MT', 'XST',
    // Youth
    'YXS', 'YS', 'YM', 'YL', 'YXL',
    // Toddler
    '2T', '3T', '4T', '5T', '5/6T', '6T',
    // Big
    'LB', 'XLB', '2XLB',
    // Extra small
    'XXS', '2XS'
];

// EXTENDED_SIZE_ORDER — now provided by extended-sizes-config.js

// SIZE_TO_SUFFIX — now provided by extended-sizes-config.js

// ============================================================
// EXTENDED SIZE PICKER POPUP (for Size06/XXXL column)
// ============================================================

// getAvailableExtendedSizes() — now provided by extended-sizes-config.js (with caching)

// [Extended size functions removed — now in quote-extended-sizes.js]
// openExtendedSizePopup, closeExtendedSizePopup, toggleWaistGroup,
// getExtendedSizeQty, applyExtendedSizes, createOrUpdateExtendedChildRow,
// updateXXXLCellDisplay, updateChildRowPrice

// ============================================================
// AUTO-SAVE & DRAFT RECOVERY (2026 consolidation)
// ============================================================

// ============================================================
// DRAFT PERSISTENCE + EDIT-LOAD + resetQuote — MOVED to
// builders/scp/persistence.js (S1a, 2026-07-08). Bridged via the
// builders/scp bundle before DOMContentLoaded.
// ============================================================

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async function() {

    // Logo status chips — On file / New / TBD (Erik 2026-07-07). SCP's TBD
    // assumption is the COLOR COUNT: the one thing the art changes about price.
    if (typeof initLogoStatusChips === 'function') {
        initLogoStatusChips({
            mountSel: '.logo-section.reference-artwork-section',
            artworkMountSel: '#scp-artwork-mount',
            designFocusId: 'design-number',
            notesSel: '#spc-order-fields .os-notes',
            assumption: () => {
                const front = document.querySelector('input[name="front-colors"]:checked')?.value || '1';
                const backOn = !!(typeof printConfig !== 'undefined' && printConfig && printConfig.backLocation);
                const back = backOn ? (document.querySelector('input[name="back-colors"]:checked')?.value || '1') : null;
                const dark = document.getElementById('dark-garment-toggle')?.checked;
                return `Pricing assumes a ${front}-color front print${back ? ` + ${back}-color back` : ''}${dark ? ' with white underbase' : ''}. Color count is confirmed after artwork review — each added color adds a screen and changes the per-piece price.`;
            }
        });
    }

    // Mid-call method-switch menu (expert audit 2026-07-07) — serializes IDENTITY
    // only (customer + style/color/sizes); the target builder reprices natively.
    if (typeof initMethodSwitchMenu === 'function') {
        initMethodSwitchMenu({
            current: 'scp',
            collect: () => (typeof collectProductsFromTable === 'function' ? collectProductsFromTable() : [])
                .filter(p => !p.isService)
                .map(p => ({
                    style: p.style, color: p.catalogColor || '', colorName: p.color || '',
                    sizeBreakdown: Object.fromEntries(Object.entries(p.sizeBreakdown || {}).filter(([, q]) => (parseInt(q, 10) || 0) > 0))
                }))
                .filter(i => i.style && Object.keys(i.sizeBreakdown).length)
        });
    }

    // Load Caspio Service_Codes (SPSU screen-setup, GRT-75 design) so fees come
    // from the API, not hardcoded literals (Erik's Pricing=API rule). Fire-and-
    // forget — getServicePrice() returns the documented fallback until it resolves,
    // and recalculatePricing() re-reads live values on the next interaction. (2026-06-09)
    if (typeof loadServiceCodePrices === 'function') { loadServiceCodePrices().then(() => {
        // updatePrintConfig() re-derives printConfig.setupFee from the now-live SPSU rate
        // and ends in recalculateAllPrices(); the old bare recalculatePricing() left the
        // stale fallback $30/screen CHARGED while the fee-row label showed the live rate
        // until the rep happened to click a print-config control. (expert audit 2026-07-07)
        try { if (typeof updatePrintConfig === 'function') { updatePrintConfig(); } else { recalculatePricing(); } } catch (_) {}
        // Sync the static "$75/hr", "$10 ea", "$15 ea" labels with the live Service_Codes
        // rates (mirror DTF's #design-rate-label pattern). The math was already API-driven,
        // but a Caspio price change left the on-screen labels contradicting the charged
        // totals. Format money labels to 2 decimals; the /hr rate matches DTF (integer). (2026-07-04)
        try {
            const _designRateEl = document.getElementById('scp-design-rate-label');
            if (_designRateEl) _designRateEl.textContent = String(getServicePrice('GRT-75', 75));
            const _fmt = (v) => Number.isInteger(v) ? String(v) : v.toFixed(2);
            const _vellumRateEl = document.getElementById('scp-vellum-rate-label');
            if (_vellumRateEl) _vellumRateEl.textContent = _fmt(getServicePrice('Vellum', 10));
            const _colorChangeRateEl = document.getElementById('scp-color-change-rate-label');
            if (_colorChangeRateEl) _colorChangeRateEl.textContent = _fmt(getServicePrice('Color Chg', 15));
        } catch (_) {}
    }); }

    // Recommended safety apparel — curated hi-vis top sellers that pair with safety
    // stripes (2026-06-28). Always shown in the SCP view; emphasized when the rep
    // turns safety stripes on. One-click Add drops the style+safety color into the
    // table via the same path as quote-load (rep then enters quantities).
    if (window.SafetyStripeRecs) {
        SafetyStripeRecs.render('scp-safety-recs', {
            variant: 'builder',
            audience: 'staff',
            collapsible: true,
            title: 'Recommended safety apparel',
            subtitle: 'Top hi-vis sellers that pair with safety stripes — click Add, then enter quantities',
            onAdd: function (style, color) {
                try {
                    addProductFromQuote({ styleNumber: style, color: (color && (color.color_name || color.catalog_color)) || '', sizeBreakdown: {} });
                    showToast('Added ' + style + (color && color.color_name ? ' · ' + color.color_name : '') + ' — enter quantities', 'success');
                } catch (e) { console.error('[SCP] safety-rec add failed:', e); }
            }
        });
        // Auto-expand the (collapsed-by-default) recs when the rep turns safety stripes on.
        var _spStripeToggle = document.getElementById('safety-stripes-toggle');
        if (_spStripeToggle) {
            _spStripeToggle.addEventListener('change', function () {
                if (_spStripeToggle.checked) {
                    SafetyStripeRecs.expand('scp-safety-recs');
                    var el = document.getElementById('scp-safety-recs');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        }
    }

    // Native leave-page warning while changes are unsaved (EMB-parity 2026-06-10)
    if (typeof setupBeforeUnloadGuard === 'function') setupBeforeUnloadGuard();

    // Phase 9 (2026-05-23) → Phase 11.3 (2026-05-24) — rich-mode artwork upload.
    // Adds design name input + per-file placement dropdown so the push payload
    // can carry Designs[{name, Locations[{Location, ImageURL}]}] when the rep
    // is creating a brand-new design (no existing #).
    if (typeof ArtworkUpload !== 'undefined') {
        try {
            window._scpArtwork = ArtworkUpload.attach({
                mountSelector: '#scp-artwork-mount',
                designName: {
                    enabled: true,
                    label: 'Design name (required when uploading new artwork)',
                    placeholder: 'e.g. Acme Corp Logo',
                },
                placements: [
                    { code: 'Front',        label: 'Front' },
                    { code: 'Back',         label: 'Back' },
                    { code: 'Left Chest',   label: 'Left Chest' },
                    { code: 'Right Chest',  label: 'Right Chest' },
                    { code: 'Left Sleeve',  label: 'Left Sleeve' },
                    { code: 'Right Sleeve', label: 'Right Sleeve' },
                    { code: 'Back of Neck', label: 'Back of Neck' },
                ],
                defaultPlacement: 'Front',
            });
            console.log('[SCP] Artwork upload widget mounted (rich mode)');
        } catch (e) {
            console.error('[SCP] Artwork widget mount failed:', e);
        }
    }

    // Phase 11.1 (2026-05-24) — customer-aware design lookup.
    // Wraps #design-number input with autocomplete fetching from
    // proxy /api/designs/by-customer?method=scp (DesignType=1).
    if (typeof CustomerDesignCombobox !== 'undefined') {
        try {
            const designInput = document.getElementById('design-number');
            if (designInput) {
                window._scpDesignCombobox = CustomerDesignCombobox.attach(designInput, {
                    method: 'scp',
                    getCustomerId: () => {
                        const v = document.getElementById('customer-number')?.value?.trim();
                        const n = parseInt(v, 10);
                        return Number.isFinite(n) && n > 0 ? n : null;
                    },
                    onPick: (design) => {
                        console.log('[SCP] Design picked:', design.idDesign, design.designName);
                    },
                });
                const custInput = document.getElementById('customer-number');
                if (custInput) {
                    custInput.addEventListener('change', () => {
                        if (window._scpDesignCombobox) window._scpDesignCombobox.refresh();
                    });
                }
                console.log('[SCP] Design combobox mounted');
            }
        } catch (e) {
            console.error('[SCP] Design combobox mount failed:', e);
        }
    }

    showLoading(true);

    try {
        // Initialize Screen Print pricing service
        screenPrintPricingService = new ScreenPrintPricingService();

        // Initialize quote service for save/load
        quoteService = new ScreenPrintQuoteService();

        // Check for edit mode (loading existing quote for revision)
        const editQuoteId = checkForEditMode();
        // Duplicate mode (?duplicate=SPC-...): load a copy as a NEW quote (EMB/DTF parity 2026-07-05)
        const duplicateQuoteId = new URLSearchParams(window.location.search).get('duplicate');
        // Quick Quote handoff (?from=quickquote) — prefill wins over draft recovery
        // for this visit, same as ?edit=/?duplicate=. (item #6, 2026-07-05)
        const qqPrefill = (typeof getQuickQuotePrefill === 'function') ? getQuickQuotePrefill() : null;
        if (duplicateQuoteId) {
            await duplicateQuote(duplicateQuoteId);
        } else if (editQuoteId) {
            // Skip draft recovery and load the existing quote instead
            await loadQuoteForEditing(editQuoteId);
        } else if (qqPrefill) {
            initScreenPrintPersistence();
            await applyQuickQuotePrefillScp(qqPrefill);
        } else if (typeof takeMethodSwitchPrefill === 'function' && (window._msPrefillScp = takeMethodSwitchPrefill())) {
            // Mid-call method switch (expert audit 2026-07-07): customer + rows from another builder
            initScreenPrintPersistence();
            await applyMethodSwitchPrefillScp(window._msPrefillScp);
        } else {
            // Initialize auto-save & draft recovery (2026 consolidation)
            initScreenPrintPersistence();

            // Check for draft recovery
            if (spSession && spSession.shouldShowRecovery()) {
                spSession.showRecoveryDialog(
                    (draft) => restoreScreenPrintDraft(draft),
                    () => {
                        if (spPersistence) spPersistence.clearDraft();
                        // No auto-row - user starts with empty state
                    }
                );
            }
            // No auto-row - empty state message guides user to search
        }

        // Setup event listeners (needed for both modes)
        setupSearchAutocomplete();
        setupKeyboardShortcuts();

        // Initialize print configuration
        updatePrintConfig();

        // Auto-select sales rep based on logged-in staff (2026 consolidation)
        if (typeof StaffAuthHelper !== 'undefined') {
            StaffAuthHelper.autoSelectSalesRep('sales-rep');
        }

        // Initialize customer lookup autocomplete
        if (typeof CustomerLookupService !== 'undefined') {
            const customerLookup = new CustomerLookupService();

            // Shared handler — both FIND CUSTOMER box and COMPANY field fill the
            // same downstream fields + surface the same CRM context.
            const applyContact = (contact) => {
                document.getElementById('customer-name').value = contact.ct_NameFull || '';
                document.getElementById('customer-email').value = contact.ContactNumbersEmail || '';
                document.getElementById('company-name').value = contact.CustomerCompanyName || '';
                // ShopWorks customer # — so the pushed order attaches to the real
                // customer instead of the no-customer fallback (2026-06-01).
                const _custNumEl = document.getElementById('customer-number');
                if (_custNumEl && contact.id_Customer != null) _custNumEl.value = String(contact.id_Customer);

                // [2026-06-08] P0 (Erik's #1 rule): honor tax-exempt customers — the CRM "TAX EXEMPT" chip was
                // cosmetic; the quote/PDF/push still billed WA tax. Mirror EMB. Also restore tax for a taxable
                // customer selected right after an exempt one (else the prior 0% bleeds → under-charge).
                var _wasExempt = !!window._taxExempt;
                window._taxExempt = (contact.Is_Tax_Exempt === true || contact.Is_Tax_Exempt === 1 || contact.Is_Tax_Exempt === '1');
                var _incTax = document.getElementById('include-tax');
                var _rateEl = document.getElementById('tax-rate-input');
                if (window._taxExempt) {
                    if (_incTax) _incTax.checked = false;
                    if (_rateEl) _rateEl.value = '0';
                    if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
                } else if (_wasExempt) {
                    if (_incTax) _incTax.checked = true;
                    if (_rateEl && _rateEl.value === '0') _rateEl.value = '10.2';
                    if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
                }

                if (typeof window.surfaceCustomerContext === 'function') {
                    window.surfaceCustomerContext(contact, {
                        warningContainerId: 'customer-warning-banner',
                        taxChipContainerId: 'customer-tax-chip',
                        tierBadgeContainerId: 'customer-tier-badge',
                        phoneInputId: 'customer-phone',
                    });
                }

                showToast('Customer info loaded', 'success');
                if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();  // [2026-06-08] refresh recap on customer pick

                // Recent ShopWorks orders panel (advisory re-order aid; silent-skip on failure) —
                // shared showRecentCustomerOrders() in quote-builder-utils.js. SCP has no notes
                // textarea, so [Reference] targets the project-name field. (item #13, 2026-07-05)
                if (typeof showRecentCustomerOrders === 'function' && contact.id_Customer) {
                    showRecentCustomerOrders(contact.id_Customer, {
                        projectId: 'project-name', designId: 'design-number'
                    });
                }
            };

            customerLookup.bindToInput('customer-lookup', {
                onSelect: applyContact,
                onClear: () => {
                    document.getElementById('customer-name').value = '';
                    document.getElementById('customer-email').value = '';
                    document.getElementById('company-name').value = '';
                    window._taxExempt = false;  // [2026-06-08] P0: customer cleared → no longer exempt
                    if (typeof window.renderOrderRecap === 'function') window.renderOrderRecap();  // [2026-06-08] empty the recap on lookup clear
                    if (typeof removeRecentOrdersPanel === 'function') removeRecentOrdersPanel();  // item #13: no stale orders for the next customer
                }
            });

            // Erik 2026-05-26: COMPANY field also acts as a search — reps
            // intuitively type the company name there (DTG works that way).
            // Selecting a result keeps the FIND CUSTOMER box in sync.
            customerLookup.bindToInput('company-name', {
                onSelect: (contact) => {
                    const lookupInput = document.getElementById('customer-lookup');
                    if (lookupInput) lookupInput.value = contact.CustomerCompanyName || '';
                    applyContact(contact);
                }
            });
        }

        // Initialize order & shipping fields (shared component)
        renderOrderShippingFields('spc-order-fields');
        initOrderShippingListeners('spc-order-fields', {
            onShippingFeeChange: () => { updateTaxCalculation(); if (window.renderOrderRecap) window.renderOrderRecap(); },  // [2026-06-08] refresh ship-to card on fee change
            onTaxRateChange: (rate) => {
                // [2026-06-08] P0 (#1 rule): exempt/wholesale orders stay 0% — don't let a ZIP DOR lookup re-apply WA tax.
                if (window._taxExempt || window._isWholesale) { const ri = document.getElementById('tax-rate-input'); if (ri) ri.value = '0'; updateTaxCalculation(); return; }
                const rateInput = document.getElementById('tax-rate-input');
                if (rateInput) rateInput.value = rate;
                updateTaxCalculation();
            }
        });
        // [2026-06-08] SCP-local listeners on the shared .os-ship-* panel fields → refresh the order-summary band.
        // The .os-* panel + its tax listeners are SHARED (quote-builder-utils.js) and must NOT be edited; these
        // listeners are attached HERE (SCP-only) after the panel renders. The fee is covered by onShippingFeeChange
        // above. (DTF/SCP parity Phase 3)
        ['.os-ship-address', '.os-ship-city', '.os-ship-state', '.os-ship-zip', '.os-ship-method'].forEach(function (sel) {
            var el = document.querySelector('#spc-order-fields ' + sel);
            if (el) {
                el.addEventListener('input', function () { if (window.renderOrderRecap) window.renderOrderRecap(); });
                el.addEventListener('change', function () { if (window.renderOrderRecap) window.renderOrderRecap(); });
            }
        });

        // Auto-focus search bar for immediate typing (UX improvement)
        const searchInput = document.getElementById('product-search');
        if (searchInput) {
            searchInput.focus();
        }

        showToast('Ready to build Screen Print quotes!', 'success');

    } catch (error) {
        console.error('Failed to initialize:', error);
        showToast('Failed to initialize. Please refresh.', 'error');
    }

    showLoading(false);
});

// ============================================================
// PRODUCT SEARCH & AUTOCOMPLETE (Using ExactMatchSearch module)
// ============================================================

// Module instance - initialized in setupSearchAutocomplete
let exactMatchSearcher = null;

// ============================================================
// PRODUCT ROWS + SEARCH + SIZES + COLORS — MOVED to
// builders/scp/product-rows.js (S1a, 2026-07-08).
// ============================================================

// ============================================================
// PRICING CALCULATIONS (Screen Print)
// ============================================================

// ============================================================
// PRICING SYNC (tiers, recalculatePricing, display, tax, wholesale) — MOVED to
// builders/scp/pricing-sync.js (S1b, 2026-07-08). recalculatePricing is that
// module's live `export let` (reprice-pill wrap applied at its tail).
// ============================================================

// ============================================================
// ADDITIONAL CHARGES / DISCOUNT / FEE TABLE — MOVED to
// builders/scp/quote-lifecycle.js (S1b, 2026-07-08).
// ============================================================

// toggleSaveShare() → moved to quote-builder-utils.js

// ============================================================
// ACTIONS (Save, Print, Email, Copy)
// ============================================================

// ============================================================
// SAVE / PRINT / EMAIL / QUOTE-TEXT OUTPUT — MOVED to
// builders/scp/save-output.js (S1b, 2026-07-08).
// ============================================================

// ============================================================
// UTILITIES
// ============================================================

// showLoading(), showToast() → provided by quote-builder-utils.js


// =====================================================
// Push to ShopWorks (Phase 8 — 2026-05-23; gate lifted same day)
// =====================================================
// Mirrors the EMB/DTF pushToShopWorks() pattern: save the quote, then POST the
// quoteId to /api/scp-push/push-quote (the proxy reads it back, transforms it,
// and pushes to ShopWorks OnSite). The button is revealed after a successful save.
//
// NOTE: until Erik creates a dedicated SCP OnSite integration, pushed orders land
// under the EMB integration customer (id=3739) / order type 21 — see
// caspio-pricing-proxy/config/manageorders-scp-config.js. ExtSource 'NWCA-SCP'
// already tags them as screen print.

let _scpPushQuoteId = null;

// showScpPushButton/updateScpPushButtonState — MOVED to builders/scp/push.js (S1b, 2026-07-08).

// One-click Push: auto-SAVE first (silent — no share modal), then open the review/confirm preview.
// The button is gated by the checklist, so we only reach here when ready. The proxy's PushedToShopWorks
// 409 guard prevents a duplicate order if it is somehow clicked twice. (EMB-parity pushToShopWorks)
let _scpPushInFlight = false;
// ============================================================
// PUSH TO SHOPWORKS (one-click save+push, preview/confirm) — MOVED to
// builders/scp/push.js (S1b, 2026-07-08). _scpPushQuoteId/_scpPushInFlight
// state stays HERE (cross-module lexical globals) until S2 state.js.
// ============================================================

// [2026-06-08] Shared order-summary band (Order Recap + Ship-To card) — DTF/SCP parity Phase 3.
// SCP ship fields are CLASS-based (.os-*) inside the single #spc-order-fields panel rendered by the shared
// renderOrderShippingFields(); selectors are scoped to that container so getShipFields()'s querySelector resolves
// uniquely. Fee class is .os-shipping-fee. No #it-shipping-amt (recap drops the Shipping row), no logo model.
// Estimator IS wired (estimateHooks below → Re-estimate shows); no modal → editOnclick omitted → no Edit. The .os-* panel + its tax
// listeners are SHARED (quote-builder-utils.js) and were NOT touched — the ship-field render hooks are SCP-local
// listeners attached in init (the .os-ship-* forEach). quote-order-summary.js loads before this file.
if (typeof QuoteOrderSummary !== 'undefined') {
    QuoteOrderSummary.configure({
        orderRecap: '#order-recap',
        shipToCard: '#ship-to-card',
        ship: {
            address: '#spc-order-fields .os-ship-address',
            city:    '#spc-order-fields .os-ship-city',
            state:   '#spc-order-fields .os-ship-state',
            zip:     '#spc-order-fields .os-ship-zip',
            method:  '#spc-order-fields .os-ship-method',
            fee:     '#spc-order-fields .os-shipping-fee',
            residential: '#ship-residential',
        },
        recap: {
            company: '#company-name',
            name:    '#customer-name',
            custNum: '#customer-number',
        },
        // [2026-06-08] Commit 6: SCP adopts the shared UPS-Ground estimator. configure() auto-points _cfg.estimate
        // at the module estimator (Re-estimate auto-lights). collectProductsFromTable returns {style, sizeBreakdown};
        // the module filters p.style && !isService (SCP rows have no isService flag → p.style is the real guard).
        estimateHooks: {
            collectProducts: function () { return (typeof collectProductsFromTable === 'function') ? collectProductsFromTable() : []; },
            onApplied: function () { if (typeof recalculatePricing === 'function') recalculatePricing(); },
            btn: '#estimate-ship-btn',
            result: '#estimate-ship-result',
        },
    });
}

// In-flight reprice pill (old-audit price-display #5, 2026-07-07): wrap the
// recalc entry point so slow /api/pricing-bundle refreshes show "Updating
// prices…" instead of silently displaying the previous numbers.
// recalculatePricing reprice-pill wrap — MOVED into builders/scp/pricing-sync.js tail (S1b, 2026-07-08).

/**
 * "auto %" rush chip (old-audit P2, 2026-07-07): the rush box was CSR mental
 * math on a moving subtotal — inconsistent rep-to-rep and stale after quote
 * changes. Fills the input from the live Caspio RUSH rate × everything-except-
 * rush (same base the % discount uses); the value stays a plain editable
 * dollar amount, so re-click after the quote changes.
 */
function applyRushPercent() {
    const rate = (typeof getSharedRushRate === 'function') ? getSharedRushRate() : 0.25;
    const productsSubtotal = parseFloat(document.getElementById('subtotal')?.textContent?.replace(/[$,]/g, '')) || 0;
    if (!(productsSubtotal > 0)) { showToast('Add products first — rush is a % of the quote.', 'info'); return; }
    const artCharge = document.getElementById('art-charge-toggle')?.checked
        ? (parseFloat(document.getElementById('art-charge')?.value) || 0) : 0;
    const designFee = (parseFloat(document.getElementById('graphic-design-hours')?.value) || 0) * getServicePrice('GRT-75', 75);
    const setupFee = parseFloat(document.getElementById('setup-fee-total')?.textContent?.replace(/[$,]/g, '')) || 0;
    const xf = (typeof getScpExtraFees === 'function') ? getScpExtraFees() : { vellumFee: 0, colorChangeFee: 0 };
    const base = productsSubtotal + artCharge + designFee + setupFee + xf.vellumFee + xf.colorChangeFee;
    const el = document.getElementById('rush-fee');
    if (!el) return;
    el.value = (base * rate).toFixed(2);
    el.dispatchEvent(new Event('change', { bubbles: true }));   // runs updateAdditionalCharges()
    showToast(`Rush set to ${(rate * 100).toFixed(0)}% of $${base.toFixed(2)} — adjust if needed; re-click if the quote changes.`, 'success');
}
window.applyRushPercent = applyRushPercent;
