// ============================================================
// EMBROIDERY POWER QUOTE - Excel-Style Quote Builder
// ============================================================

// Use centralized config (fallback to hardcoded URL for backwards compatibility)
const API_BASE = window.APP_CONFIG.API.BASE_URL;

// loadServiceCodePrices() + getServicePrice() MOVED to
// builders/emb/pricing.js (roadmap 0.4 extraction #0, 2026-07-07).
// The builders/emb bundle re-exports both onto window before
// DOMContentLoaded, so every call site below keeps working unchanged.

// API response caches (prevent 429 rate limit errors)
const sizeDetectionCache = new Map();   // key: "style-color" → size detection result
const productColorsCache = new Map();   // key: "style" → colors array

// Embroidery defaults — synced with API values at runtime
const EMB_DEFAULTS = {
    GARMENT_STITCH_COUNT: 8000,
    CAP_STITCH_COUNT: 5000,
    AL_GARMENT_STITCH_COUNT: 8000,
    STITCH_STEP: 1000,
    MAX_STITCH_COUNT: 50000,
    PATCH_SETUP_FEE: 50
};

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

// (removed dead SIZE_DISPLAY_LABELS — unused, and it had an incorrect 'XS'→'XXXL' mapping; review C28 2026-06-05)

// State
let pricingCalculator = null;
let quoteService = null;

// Edit mode state (for revising existing quotes)
let editingQuoteId = null;
let editingRevision = null;

// Unsaved changes tracking (UX improvement)
let hasChanges = false;

// Auto-save & Draft Recovery (2026 consolidation)
let embPersistence = null;
let embSession = null;

// Primary logo configuration
let primaryLogo = {
    position: 'Left Chest',
    stitchCount: EMB_DEFAULTS.GARMENT_STITCH_COUNT,
    needsDigitizing: false,
    isPrimary: true
};

// Additional logos array (for garments)
let additionalLogos = [];
// Example entry: { id: 'global-al-garment', position: 'AL', stitchCount: 8000, needsDigitizing: false, isPrimary: false }

// Cap Logo Configuration (separate from garment logos)
// Supports multiple embellishment types: 'embroidery', '3d-puff', 'patch'
let capPrimaryLogo = {
    position: 'CF',  // Cap Front (always)
    stitchCount: EMB_DEFAULTS.GARMENT_STITCH_COUNT,
    needsDigitizing: false,
    isPrimary: true,
    embellishmentType: 'embroidery',  // Default: flat embroidery
    needsSetup: true  // For patches: setup fee (GRT-50)
};
let capAdditionalLogos = [];
// Example entry: { id: 'global-al-cap', position: 'AL-Cap', stitchCount: 5000, needsDigitizing: false, isPrimary: false }

let products = [];
let rowCounter = 0;
let productCache = {}; // Cache product data for quick lookup
let childRowMap = {}; // Track child rows: { parentRowId: { '2XL': childRowId, '3XL': childRowId } }
// Global AL config (applies to all products of type when enabled)
let globalAL = {
    garment: { enabled: false, position: 'AL', stitchCount: EMB_DEFAULTS.AL_GARMENT_STITCH_COUNT, needsDigitizing: false },
    cap: { enabled: false, position: 'AL-Cap', stitchCount: EMB_DEFAULTS.CAP_STITCH_COUNT, needsDigitizing: false }
};

// Sync module-level AL arrays from globalAL state
// Called whenever globalAL changes so all existing references (save, invoice, etc.) get correct data
function _syncALArrays() {
    additionalLogos = globalAL.garment.enabled ? [{
        id: 'global-al-garment',
        position: 'AL',
        stitchCount: globalAL.garment.stitchCount,
        needsDigitizing: globalAL.garment.needsDigitizing,
        isPrimary: false
    }] : [];
    capAdditionalLogos = globalAL.cap.enabled ? [{
        id: 'global-al-cap',
        position: 'AL-Cap',
        stitchCount: globalAL.cap.stitchCount,
        needsDigitizing: globalAL.cap.needsDigitizing,
        isPrimary: false
    }] : [];
}

// Handle primary logo position change (for Full Back 25K minimum)
// Map arbitrary stitch count to nearest tier dropdown value
function mapStitchCountToTierValue(stitchCount, position) {
    // Cap positions max at '18000' ("Large 15K-25K") — #cap-primary-stitches has NO
    // 25000 option, and assigning one left the select at '' which the change handler
    // parseInt-fell to 8000: a silent $10/cap downgrade on edit-reload. Design
    // lookups return the MAX stitch count across DST variants, so a jacket-back
    // file on a cap design triggers this routinely. (expert audit 2026-07-07)
    const isCapPosition = position === 'CF' || position === 'CB' || position === 'CS';
    if (isCapPosition) {
        if (stitchCount > 15000) return '18000';
        if (stitchCount > 10000) return '12000';
        return '8000';
    }
    if (position === 'Full Back' || stitchCount >= 25000) return '25000';
    if (stitchCount > 15000) return '18000';
    if (stitchCount > 10000) return '12000';
    return '8000';
}

// ============================================================
// STITCH-COUNT ESTIMATOR (2026-06-10)
// Kills the #1 quoting guess: rep enters the logo's W×H in inches +
// coverage, gets an industry-rule estimate (stitches ≈ in² × density),
// and one click sets the matching tier dropdown. Estimates only —
// the digitized file is always authoritative.
// ============================================================

const STITCH_DENSITY = { light: 1000, medium: 1500, full: 2000 };

function initStitchEstimators() {
    [
        { selId: 'primary-stitches', kind: 'garment' },
        { selId: 'cap-primary-stitches', kind: 'cap' }
    ].forEach(({ selId, kind }) => {
        const sel = document.getElementById(selId);
        if (!sel || sel.parentElement.querySelector('.stitch-estimate-btn')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'stitch-estimate-btn';
        btn.innerHTML = '<i class="fas fa-ruler-combined"></i>';
        btn.title = 'Estimate stitch count from logo size';
        btn.setAttribute('aria-label', 'Estimate stitch count from logo size');
        btn.addEventListener('click', (e) => { e.preventDefault(); openStitchEstimator(selId, kind, btn); });
        sel.insertAdjacentElement('afterend', btn);
    });
}

function openStitchEstimator(selId, kind, anchorBtn) {
    // One popover at a time
    document.getElementById('stitch-estimator-pop')?.remove();
    const pop = document.createElement('div');
    pop.id = 'stitch-estimator-pop';
    pop.className = 'stitch-estimator-pop';
    pop.innerHTML = `
        <div class="se-title"><i class="fas fa-ruler-combined"></i> Stitch estimate</div>
        <div class="se-row">
            <label>W <input type="number" id="se-width" min="0.5" max="16" step="0.25" value="3.5"> in</label>
            <label>H <input type="number" id="se-height" min="0.5" max="16" step="0.25" value="2"> in</label>
        </div>
        <div class="se-row">
            <label>Coverage
                <select id="se-coverage">
                    <option value="light">Light (text / outline)</option>
                    <option value="medium" selected>Medium (mixed)</option>
                    <option value="full">Full fill</option>
                </select>
            </label>
        </div>
        <div class="se-result" id="se-result"></div>
        <div class="se-actions">
            <button type="button" class="se-apply" id="se-apply">Apply to tier</button>
            <button type="button" class="se-close" id="se-close">Close</button>
        </div>
        <div class="se-note">Rule-of-thumb only — the digitized file decides the real count.</div>`;
    document.body.appendChild(pop);

    // Position under the anchor button
    const r = anchorBtn.getBoundingClientRect();
    pop.style.top = `${window.scrollY + r.bottom + 6}px`;
    pop.style.left = `${Math.max(8, window.scrollX + r.left - 120)}px`;

    const compute = () => {
        const w = parseFloat(document.getElementById('se-width')?.value) || 0;
        const h = parseFloat(document.getElementById('se-height')?.value) || 0;
        const density = STITCH_DENSITY[document.getElementById('se-coverage')?.value] || STITCH_DENSITY.medium;
        const raw = w * h * density;
        const est = Math.max(1000, Math.ceil(raw / 500) * 500);
        const tierVal = mapStitchCountToTierValue(est, '');
        const tierName = { '8000': 'Standard (≤10K)', '12000': 'Mid (10–15K)', '18000': 'Large (15–25K)', '25000': 'Full Back (25K+)' }[tierVal] || tierVal;
        const resEl = document.getElementById('se-result');
        if (resEl) resEl.innerHTML = (w > 0 && h > 0)
            ? `≈ <strong>${est.toLocaleString()}</strong> stitches → <strong>${tierName}</strong>`
            : 'Enter the logo dimensions';
        return { est, tierVal };
    };
    ['se-width', 'se-height', 'se-coverage'].forEach(id => document.getElementById(id)?.addEventListener('input', compute));
    compute();

    document.getElementById('se-apply')?.addEventListener('click', () => {
        const { est, tierVal } = compute();
        const sel = document.getElementById(selId);
        if (sel) {
            sel.value = tierVal;
            sel.dispatchEvent(new Event('change'));   // run the existing tier handlers
            showToast(`Stitch tier set from estimate (≈${est.toLocaleString()} stitches)`, 'success');
        }
        pop.remove();
    });
    document.getElementById('se-close')?.addEventListener('click', () => pop.remove());
    // Click-away dismiss
    setTimeout(() => {
        const away = (e) => {
            if (!pop.contains(e.target) && e.target !== anchorBtn) { pop.remove(); document.removeEventListener('mousedown', away); }
        };
        document.addEventListener('mousedown', away);
    }, 0);
}

function onPrimaryPositionChange() {
    const posSelect = document.getElementById('primary-position');
    const tierSelect = document.getElementById('primary-stitches');
    const fbField = document.getElementById('fb-stitch-count-field');
    primaryLogo.position = posSelect.value;

    if (posSelect.value === 'Full Back') {
        tierSelect.value = '25000';
        fbField.style.display = '';
        const fbInput = document.getElementById('fb-stitch-count');
        primaryLogo.stitchCount = parseInt(fbInput.value) || 25000;
        showToast('Full Back requires minimum 25,000 stitches', 'info');
    } else {
        fbField.style.display = 'none';
        if (parseInt(tierSelect.value) >= 25000) {
            // Switching away from Full Back — reset tier
            tierSelect.value = '8000';
            primaryLogo.stitchCount = 8000;
        }
    }
    recalculatePricing();
}

// Handle garment stitch tier dropdown change
function onPrimaryStitchTierChange() {
    const select = document.getElementById('primary-stitches');
    const posSelect = document.getElementById('primary-position');
    const fbField = document.getElementById('fb-stitch-count-field');
    const sc = parseInt(select.value) || 8000;

    if (sc >= 25000) {
        // Full Back tier selected — sync position, show stitch input
        posSelect.value = 'Full Back';
        primaryLogo.position = 'Full Back';
        posSelect.disabled = true;
        fbField.style.display = '';
        const fbInput = document.getElementById('fb-stitch-count');
        primaryLogo.stitchCount = parseInt(fbInput.value) || 25000;
    } else {
        // Standard/Mid/Large — hide FB stitch input
        fbField.style.display = 'none';
        primaryLogo.stitchCount = sc;
        if (posSelect.disabled) {
            posSelect.disabled = false;
            posSelect.value = 'Left Chest';
            primaryLogo.position = 'Left Chest';
        }
    }
    recalculatePricing();
}

// Handle Full Back stitch count input change
function onFullBackStitchCountChange() {
    const fbInput = document.getElementById('fb-stitch-count');
    const val = parseInt(fbInput.value) || 25000;
    primaryLogo.stitchCount = Math.max(val, 25000);
    recalculatePricing();
}

// Handle cap stitch tier dropdown change
function onCapStitchTierChange() {
    const select = document.getElementById('cap-primary-stitches');
    capPrimaryLogo.stitchCount = parseInt(select.value) || 8000;
    recalculatePricing();
}

// Update dropdown labels from API-driven surcharge data
function updateStitchTierDropdownLabels() {
    const data = pricingCalculator && pricingCalculator.stitchSurchargeData;
    if (!data) return; // API didn't load, keep hardcoded labels

    const selects = [
        document.getElementById('primary-stitches'),
        document.getElementById('cap-primary-stitches')
    ];
    for (const select of selects) {
        if (!select) continue;
        for (const opt of select.options) {
            const val = parseInt(opt.value);
            if (val === 12000) {
                opt.text = `Mid +$${data.midFee}/pc (10-15K)`;
            } else if (val === 18000) {
                opt.text = `Large +$${data.largeFee}/pc (15-25K)`;
            }
        }
    }
}

// Update global AL config (stitch count or digitizing change)
// Position is fixed: 'AL' for garments, 'AL-Cap' for caps
function updateGlobalAL(type) {
    // Stitch count is always base (no input field — simplified)
    const digitizingCheckbox = document.getElementById(`${type}-al-digitizing-checkbox`);
    if (digitizingCheckbox) globalAL[type].needsDigitizing = digitizingCheckbox.checked;

    _syncALArrays();
    recalculatePricing();
}

// NEW: Toggle function for modernized toggle switch UI
function toggleGlobalALNew(type) {
    const switchEl = document.getElementById(`${type}-al-switch`);
    const labelEl = document.getElementById(`${type}-al-label`);
    const configEl = document.getElementById(`${type}-al-config-new`);
    const hiddenCheckbox = document.getElementById(`${type}-al-toggle`);

    // Toggle the state
    const isActive = switchEl.classList.toggle('active');
    labelEl.classList.toggle('active', isActive);
    configEl.classList.toggle('visible', isActive);

    // Update hidden checkbox for backwards compatibility
    hiddenCheckbox.checked = isActive;

    // Update global state
    globalAL[type].enabled = isActive;

    // Sync module-level arrays and recalculate
    _syncALArrays();
    recalculatePricing();
}

// Toggle logo card collapse/expand
function toggleLogoCard(cardId) {
    const card = document.getElementById(cardId);
    if (card) card.classList.toggle('collapsed');
}

// Toggle notes section collapse/expand
function toggleNotesSection() {
    const section = document.getElementById('notes-section');
    if (!section) return;
    const isCollapsed = section.classList.toggle('collapsed');
    const body = section.querySelector('.notes-body');
    const icon = section.querySelector('.notes-toggle-icon');
    if (body) body.style.display = isCollapsed ? 'none' : 'block';
    if (icon) icon.style.transform = isCollapsed ? '' : 'rotate(180deg)';
}

// Update notes badge count
function updateNotesBadge() {
    const notesEl = document.getElementById('notes');
    const badge = document.getElementById('notes-badge');
    if (!notesEl || !badge) return;
    const lines = notesEl.value.trim().split('\n').filter(l => l.trim()).length;
    if (lines > 0) {
        badge.textContent = lines;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// NEW: Toggle function for modernized digitizing checkbox
function toggleDigitizingCheckbox(element, checkboxId) {
    const checkbox = document.getElementById(checkboxId);
    checkbox.checked = !checkbox.checked;
    element.classList.toggle('checked', checkbox.checked);

    // Update the corresponding logo object based on checkbox ID
    if (checkboxId === 'primary-digitizing') {
        primaryLogo.needsDigitizing = checkbox.checked;
    } else if (checkboxId === 'cap-primary-digitizing') {
        capPrimaryLogo.needsDigitizing = checkbox.checked;
    } else if (checkboxId === 'cap-patch-setup') {
        capPrimaryLogo.needsSetup = checkbox.checked;
    }

    // Trigger pricing recalculation
    recalculatePricing();
}

// toggleArtCharge(), toggleArtworkServices(), updateArtworkCharges()
// moved to quote-builder-utils.js

// Handle cap embellishment type change (Flat Embroidery, 3D Puff, or Patch)
function handleCapEmbellishmentChange() {
    const embellishmentType = document.getElementById('cap-embellishment-type').value;
    const embroideryOptions = document.getElementById('cap-embroidery-options');
    const patchOptions = document.getElementById('cap-patch-options');

    // Update the capPrimaryLogo object with new embellishment type
    capPrimaryLogo.embellishmentType = embellishmentType;

    if (embellishmentType === 'laser-patch') {
        // Show patch options, hide embroidery options (AL toggle is inside embroidery options)
        embroideryOptions.style.display = 'none';
        patchOptions.style.display = 'block';
        // Disable AL if it was enabled (toggle is hidden with embroidery options)
        if (globalAL.cap.enabled) {
            toggleGlobalALNew('cap'); // Turn it off
        }
        // For patches: no stitches needed, use setup fee instead of digitizing
        capPrimaryLogo.stitchCount = 0;
        capPrimaryLogo.needsDigitizing = false;
        capPrimaryLogo.needsSetup = document.getElementById('cap-patch-setup')?.checked ?? true;
    } else {
        // Show embroidery options (for both flat and 3D puff) — AL toggle is inline
        embroideryOptions.style.display = 'block';
        patchOptions.style.display = 'none';
        // Restore stitch count from input
        capPrimaryLogo.stitchCount = parseInt(document.getElementById('cap-primary-stitches')?.value) || 8000;
        capPrimaryLogo.needsDigitizing = document.getElementById('cap-primary-digitizing')?.checked ?? false;
        capPrimaryLogo.needsSetup = false; // Not applicable for embroidery
    }


    // Recalculate pricing with new embellishment type
    recalculatePricing();
}

// Get current cap embellishment type
function getCapEmbellishmentType() {
    const dropdown = document.getElementById('cap-embellishment-type');
    return dropdown ? dropdown.value : 'embroidery';
}

// Update embellishment dropdown labels with prices from API
// Rule: ALWAYS pull pricing from Caspio API - never hardcode
function updateEmbellishmentDropdownLabels() {
    if (!pricingCalculator || !pricingCalculator.capInitialized) return;

    const dropdown = document.getElementById('cap-embellishment-type');
    if (!dropdown) return;

    const upcharges = pricingCalculator.getEmbellishmentUpcharges();

    // Update 3D Puff option
    const puffOption = dropdown.querySelector('option[value="3d-puff"]');
    if (puffOption) {
        puffOption.textContent = `3D Puff Embroidery (+$${upcharges.puff}/cap)`;
    }

    // Update Patch option
    const patchOption = dropdown.querySelector('option[value="laser-patch"]');
    if (patchOption) {
        patchOption.textContent = `Laser Leatherette Patch (+$${upcharges.patch}/cap)`;
    }

}

// Extended sizes available for Size06 (Other) column
// Note: Actual available sizes are fetched dynamically per product via API
// Includes OSFA for beanies, bags, and other one-size-fits-all items
// All sizes that go in Size06 column (the "Other/Catch-All" column)
// Based on Python Inksoft/Inksoft_Size_Translation_Import.csv
const SIZE06_EXTENDED_SIZES = [
    // Extended large
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
    'XXS', '2XS', 'XXL'
];

// EXTENDED_SIZE_ORDER — now provided by extended-sizes-config.js

// SIZE_TO_SUFFIX — now provided by extended-sizes-config.js

// ============================================================
// EXTENDED SIZE PICKER POPUP (for Size06/XXXL column)
// ============================================================

// getAvailableExtendedSizes() — now provided by extended-sizes-config.js (with caching)

// ============================================================
// EXTENDED SIZE FUNCTIONS — moved to /shared_components/js/quote-extended-sizes.js
// Functions: openExtendedSizePopup, closeExtendedSizePopup, toggleWaistGroup,
//   getExtendedSizeQty, applyExtendedSizes, createOrUpdateExtendedChildRow,
//   updateXXXLCellDisplay, updateChildRowPrice
// Dependencies that remain here: childRowMap, createChildRow, removeChildRow,
//   recalculatePricing, getAvailableExtendedSizes
// ============================================================

// REMOVED: openExtendedSizePopup — now in quote-extended-sizes.js
// REMOVED: closeExtendedSizePopup — now in quote-extended-sizes.js
// REMOVED: toggleWaistGroup — now in quote-extended-sizes.js
// REMOVED: getExtendedSizeQty — now in quote-extended-sizes.js
// REMOVED: applyExtendedSizes — now in quote-extended-sizes.js
// REMOVED: createOrUpdateExtendedChildRow — now in quote-extended-sizes.js
// REMOVED: updateXXXLCellDisplay — now in quote-extended-sizes.js
// REMOVED: updateChildRowPrice — now in quote-extended-sizes.js

/* PLACEHOLDER — this block replaces ~400 lines of inline functions
   that were byte-for-byte identical across embroidery, DTG, and screenprint.
   The functions are now loaded from quote-extended-sizes.js via <script> tag.
*/

// [functions removed — now in quote-extended-sizes.js]
// openExtendedSizePopup, closeExtendedSizePopup, toggleWaistGroup,
// getExtendedSizeQty, applyExtendedSizes, createOrUpdateExtendedChildRow,
// updateXXXLCellDisplay, updateChildRowPrice
// ~390 lines moved to shared module — see quote-extended-sizes.js

// ============================================================
// AUTO-SAVE & DRAFT RECOVERY (2026 consolidation)
// ============================================================

// ============================================================
// DRAFT PERSISTENCE + EDIT-LOAD (autosave wiring, draft restore,
// loadQuoteForEditing, duplicateQuote, populate*) — MOVED to
// builders/emb/persistence.js (roadmap 0.4 extraction #4, 2026-07-07).
// Bridged via the builders/emb bundle before DOMContentLoaded.
// ============================================================

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async function() {

    // Phase 9 (2026-05-23) → Phase 11.3 (2026-05-24) — rich-mode artwork upload.
    // Adds design name input + per-file placement dropdown so the push payload
    // can carry Designs[{name, Locations[{Location, ImageURL}]}] for new-design
    // pushes. Mirrors DTF/SCP wiring (commit 8056aeaa, 20c96945).
    //
    // Phase 9.1 RESOLVED (2026-05-24, Phase 11.3d): EMB persistence chose
    // option (c) — repurpose ImportNotes from array → object so referenceArtwork
    // and newDesignName ride alongside the existing import-notes array. Proxy's
    // embroidery-push-transformer.js handles both shapes (legacy array kept
    // working). Quote-service writes the object form in customerData.
    if (typeof ArtworkUpload !== 'undefined') {
        try {
            window._embArtwork = ArtworkUpload.attach({
                mountSelector: '#emb-artwork-mount',
                designName: {
                    enabled: true,
                    label: 'Design name (required when uploading new artwork)',
                    placeholder: 'e.g. Acme Corp Logo',
                },
                placements: [
                    { code: 'Left Chest',   label: 'Left Chest' },
                    { code: 'Right Chest',  label: 'Right Chest' },
                    { code: 'Full Back',    label: 'Full Back' },
                    { code: 'Left Sleeve',  label: 'Left Sleeve' },
                    { code: 'Right Sleeve', label: 'Right Sleeve' },
                    { code: 'Cap Front',    label: 'Cap Front' },
                    { code: 'Cap Side',     label: 'Cap Side' },
                    { code: 'Cap Back',     label: 'Cap Back' },
                    { code: 'Beanie Front', label: 'Beanie Front' },
                ],
                defaultPlacement: 'Left Chest',
            });
        } catch (e) {
            console.error('[EMB] Artwork widget mount failed:', e);
        }
    }

    showLoading(true);

    // ALWAYS set up search first - independent of pricing calculator
    // This ensures search works even if pricing API fails
    setupSearchAutocomplete();
    setupKeyboardShortcuts();
    setupPrimaryLogoHandlers();
    setupCapPrimaryLogoHandlers();  // Cap logo handlers

    // Services bar (2026-06-03): a persistent, catalog-driven "Add to order" strip.
    // Click a chip → addManualServiceRow(code) inserts an editable LINE ITEM. Same
    // shared bar (quote-services-bar.js) will drive SCP/DTG/DTF with their own catalogs.
    if (window.QuoteServicesBar) {
        // Part numbers + descriptions match the real ShopWorks line items (Erik's
        // test order 142021). Codes are registered in the proxy KNOWN_FEE_PNS so
        // they push as LinesOE line items. Not here (auto from the top config): AL,
        // AL-CAP, DECG-FB (Full Back), 3D-EMB, Laser Patch, LTM, DD (Digitizing).
        // Prices pulled from Caspio Service_Codes via /api/service-codes (single source
        // of truth). Non-blocking: render once prices load (or fall back to defaults +
        // a visible warning if the API is unreachable). Change a price in Caspio → the
        // bar reflects it on next load, no deploy needed.
        loadServiceCodePrices().finally(() => {
            // Digitizing labels + new-logo nudge react to live Service_Codes and to
            // design-number typing (recalc doesn't fire on keystrokes). (2026-07-07)
            try {
                syncDigitizingPriceLabels();
                updateDigitizingNudges();
                ['garment-design-number', 'cap-design-number'].forEach(id => {
                    document.getElementById(id)?.addEventListener('input', updateDigitizingNudges);
                });
            } catch (_) {}
            const sp = (code, fb) => getServicePrice(code, fb);
            const EMB_SERVICE_CATALOG = [
                { group: 'Artwork', icon: 'fa-palette', items: [
                    { code: 'GRT-50', label: 'Logo Mockup & Review', price: sp('GRT-50', 50),  unit: 'flat', icon: 'fa-palette' },
                    { code: 'GRT-75', label: 'Graphic Design',       price: sp('GRT-75', 75),  unit: 'hr',   icon: 'fa-pencil-ruler' },
                    { code: 'DD',     label: 'Digitizing',           price: sp('DD', 100),     unit: 'flat', icon: 'fa-cog' },
                    // Additional Logo — live-priced per-piece from the API (calculateALPrice,
                    // tier-aware + per-1K stitch upcharge). Pick Garment/Cap + size, then enter qty.
                    { code: 'AL', label: 'Additional Logo', icon: 'fa-clone', addLabel: 'Add Logo', fields: [
                        // Placement drives BOTH where it prints AND the pricing path
                        // (Full Back → full-back rate, Cap* → cap rate, else garment rate).
                        { name: 'placement', label: 'Where', options: [
                            { group: 'Garment', options: [
                                { value: 'Left Chest',   label: 'Left Chest' },
                                { value: 'Right Chest',  label: 'Right Chest' },
                                { value: 'Left Sleeve',  label: 'Left Sleeve' },
                                { value: 'Right Sleeve', label: 'Right Sleeve' },
                                { value: 'Back/Nape',    label: 'Back / Nape' },
                                { value: 'Full Back',    label: 'Full Back' }
                            ]},
                            { group: 'Cap', options: [
                                { value: 'Cap Front', label: 'Cap Front' },
                                { value: 'Cap Back',  label: 'Cap Back' },
                                { value: 'Cap Side',  label: 'Cap Side' }
                            ]}
                        ]},
                        // Simple by default (Std/Mid/Large chips) — exact when it matters (type the count).
                        { name: 'stitches', label: 'Stitches', type: 'stitches', default: 8000, min: 1000, step: 1000, presets: [
                            { label: 'Std',   value: 8000 },
                            { label: 'Mid',   value: 13000 },
                            { label: 'Large', value: 20000 }
                        ]}
                    ]}
                ]},
                { group: 'Add-Ons', icon: 'fa-stamp', items: [
                    { code: 'Monogram', label: 'Monogram', price: sp('Monogram', 12.50), unit: 'ea', icon: 'fa-font' },
                    { code: 'RUSH',     label: 'Rush Fee', priceLabel: '25% of subtotal', icon: 'fa-bolt' }
                ]},
                // Customer-Supplied: the customer brings their OWN blanks (corporate Costco jackets,
                // etc.) — we charge embroidery ONLY, no garment, at higher DECG tiers (no garment
                // margin). Live-priced per-piece from /api/decg-pricing (Embroidery_Costs DECG-Garmt /
                // DECG-Cap), garment vs cap by chip. Pick stitches, then set the qty on the line.
                { group: 'Customer-Supplied', icon: 'fa-box-open', items: [
                    { code: 'DECG', label: 'Customer Garment', icon: 'fa-tshirt', addLabel: 'Add', priceLabel: 'embroidery only', fields: [
                        { name: 'stitches', label: 'Stitches', type: 'stitches', default: 8000, min: 1000, step: 1000, presets: [
                            { label: 'Std', value: 8000 }, { label: 'Mid', value: 13000 }, { label: 'Large', value: 20000 }
                        ]},
                        { name: 'heavyweight', label: 'Heavyweight +$10', type: 'checkbox' }
                    ]},
                    { code: 'DECC', label: 'Customer Cap', icon: 'fa-hat-cowboy', addLabel: 'Add', priceLabel: 'embroidery only', fields: [
                        { name: 'stitches', label: 'Stitches', type: 'stitches', default: 8000, min: 1000, step: 1000, presets: [
                            { label: 'Std', value: 8000 }, { label: 'Mid', value: 13000 }, { label: 'Large', value: 20000 }
                        ]},
                        { name: 'heavyweight', label: 'Heavyweight +$10', type: 'checkbox' }
                    ]}
                ]}
            ];
            window.QuoteServicesBar.render('emb-services-bar', EMB_SERVICE_CATALOG,
                (code, opts) => {
                    if (code === 'AL' && opts && opts.fields) {
                        addALLineItem(opts.fields.placement, opts.fields.stitches);
                    } else if ((code === 'DECG' || code === 'DECC') && opts && opts.fields) {
                        addDECGLineItem(code === 'DECC' ? 'cap' : 'garment', opts.fields.stitches, opts.fields.heavyweight);
                    } else {
                        addManualServiceRow(code, opts && opts.price);
                    }
                });
        });
    }

    // Gated "Push to ShopWorks" button: re-evaluate when the Customer # changes,
    // and set its initial (disabled) state for a fresh quote.
    const _custNumEl = document.getElementById('customer-number');
    if (_custNumEl) _custNumEl.addEventListener('input', updatePushButtonState);
    // [A5] (audit 2026-06-06): on change, verify the typed Customer # against CRM and show the resolved
    // company (or warn) — catches a transposed-but-valid # before it silently pushes to a wrong account.
    if (_custNumEl) _custNumEl.addEventListener('change', async () => {
        if (window._restoringQuote) return;
        const id = (_custNumEl.value || '').trim();
        const noteEl = document.getElementById('customer-number-resolved');
        if (!noteEl) return;
        if (!id) { noteEl.textContent = ''; noteEl.hidden = true; return; }
        if (!window.customerLookupInstance) return;
        const contact = await window.customerLookupInstance.getByCustomerId(id);
        if ((_custNumEl.value || '').trim() !== id) return;   // value changed mid-await — ignore stale result
        if (contact && contact.CustomerCompanyName) {
            noteEl.textContent = '✓ ' + contact.CustomerCompanyName;
            noteEl.style.cssText = 'font-size:11px;color:#166534;font-weight:600;display:block;margin-top:2px;';
            noteEl.hidden = false;
        } else {
            noteEl.textContent = '⚠ No CRM customer for #' + id + ' — verify before pushing.';
            noteEl.style.cssText = 'font-size:11px;color:#92400e;font-weight:600;display:block;margin-top:2px;';
            noteEl.hidden = false;
        }
    });
    const _custNameEl = document.getElementById('customer-name');   // keep the push-readiness "Customer name" check live (audit #8)
    if (_custNameEl) _custNameEl.addEventListener('input', updatePushButtonState);
    const _custEmailEl = document.getElementById('customer-email');  // P2-15 (audit 2026-06-06): re-enable Push when Email is the last field typed
    if (_custEmailEl) _custEmailEl.addEventListener('input', updatePushButtonState);
    updatePushButtonState();

    // Auto-select sales rep based on logged-in staff (2026 consolidation)
    if (typeof StaffAuthHelper !== 'undefined') {
        StaffAuthHelper.autoSelectSalesRep('sales-rep');
    }

    // Initialize customer lookup autocomplete
    if (typeof CustomerLookupService !== 'undefined') {
        const customerLookup = new CustomerLookupService();
        window.customerLookupInstance = customerLookup;  // Store for ShopWorks import

        const applyContact = (contact) => {
            document.getElementById('customer-name').value = contact.ct_NameFull || '';
            document.getElementById('customer-email').value = contact.ContactNumbersEmail || '';
            document.getElementById('company-name').value = contact.CustomerCompanyName || '';
            // Fill customer number (ShopWorks ID)
            document.getElementById('customer-number').value = contact.id_Customer || '';
            // Phone — API may not return phone, clear if empty
            const phoneInput = document.getElementById('customer-phone');
            if (phoneInput) phoneInput.value = contact.Phone || '';
            // Auto-fill Ship To from contact address. STASH it always so that if
            // the rep later flips Pickup → Ship it, setShipMode() restores it.
            // When Pickup is active (the default), do NOT overwrite the Milton shop
            // address / tax — a pickup order is taxed locally. (2026-06-02)
            window._lastCustomerShipTo = {
                address: contact.Address || '',
                city: contact.City || '',
                state: contact.State || '',
                zip: contact.Zip || ''
            };
            const _isPickup = (document.getElementById('ship-method')?.value === 'Customer Pickup');
            // P1-2 (audit 2026-06-06): a tax-exempt customer must NOT be charged WA sales tax — the CRM
            // chip is cosmetic. Clear the tax here (uncheck include-tax + zero the rate) and DO NOT run the
            // DOR lookup (its async result would overwrite the 0 — same race as the P0 pickup bug). #1 rule.
            const _taxExempt = (contact.Is_Tax_Exempt === true || contact.Is_Tax_Exempt === 1 || contact.Is_Tax_Exempt === '1');
            // [B8 + B8-R1] (audit 2026-06-06): persist exemption BEFORE the ship-field block below runs
            // lookupTaxRate — otherwise a NEW non-exempt customer selected right after an exempt one would see
            // the prior customer's stale window._taxExempt=true and get forced to 0% (under-charge). Also stops
            // a later Pickup→Ship toggle re-applying WA tax to an exempt customer. #1 rule.
            window._taxExempt = _taxExempt;
            if (!_isPickup) {
                if (contact.State) { const el = document.getElementById('ship-state'); if (el) el.value = contact.State; }
                if (contact.City) { const el = document.getElementById('ship-city'); if (el) el.value = contact.City; }
                if (contact.Address) { const el = document.getElementById('ship-address'); if (el) el.value = contact.Address; }
                if (contact.Zip) {
                    const zipInput = document.getElementById('ship-zip');
                    if (zipInput) { zipInput.value = contact.Zip; if (!_taxExempt) lookupTaxRate(); }
                }
            }
            if (_taxExempt) {
                const incTax = document.getElementById('include-tax');
                if (incTax) incTax.checked = false;
                const rateInput = document.getElementById('tax-rate-input');
                if (rateInput) rateInput.value = '0';
                if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
            }
            invalidateDesignGalleryCache(); // Invalidate gallery cache on customer change

            // Surface CRM context (Erik 2026-05-23) — Customer Warning banner +
            // Tax Exempt chip + Account Tier badge + payment terms auto-fill
            // with legacy-CRM mapping. Defensive — only fires if the shared
            // helper loaded (script tag may not be present on older builds).
            if (typeof window.surfaceCustomerContext === 'function') {
                window.surfaceCustomerContext(contact, {
                    warningContainerId: 'customer-warning-banner',
                    taxChipContainerId: 'customer-tax-chip',
                    tierBadgeContainerId: 'customer-tier-badge',
                    phoneInputId: 'customer-phone',
                    termsSelectId: 'payment-terms',
                    termsNoteId: 'customer-terms-note',
                    offeredTerms: ['Prepaid', 'Net 10', 'Pay On Pickup'],
                });
            }

            renderOrderRecap();  // customer set → refresh the bottom Order Recap
            updatePushButtonState();  // customer # set programmatically (no 'input' event) → re-enable Push + refresh checklist (review C9 2026-06-05)
            showToast('Customer info loaded', 'success');

            // Recent ShopWorks orders panel (advisory re-order aid; silent-skip on failure) —
            // shared showRecentCustomerOrders() in quote-builder-utils.js. (item #13, 2026-07-05)
            if (typeof showRecentCustomerOrders === 'function' && contact.id_Customer) {
                showRecentCustomerOrders(contact.id_Customer, {
                    notesId: 'notes', projectId: 'project-name', poId: 'po-number'
                });
            }
        };

        customerLookup.bindToInput('customer-lookup', {
            onSelect: applyContact,
            onClear: () => {
                document.getElementById('customer-name').value = '';
                document.getElementById('customer-email').value = '';
                document.getElementById('company-name').value = '';
                document.getElementById('customer-number').value = '';
                const phoneInput = document.getElementById('customer-phone');
                if (phoneInput) phoneInput.value = '';
                invalidateDesignGalleryCache(); // Invalidate gallery cache on customer clear
                clearCustomerContextBanners();  // P2-8: don't bleed the prior customer's CRM banners
                if (typeof removeRecentOrdersPanel === 'function') removeRecentOrdersPanel();  // item #13: no stale orders for the next customer
            }
        });

        // Erik 2026-05-26: COMPANY field also triggers autocomplete (DTG parity).
        customerLookup.bindToInput('company-name', {
            onSelect: (contact) => {
                const lookupInput = document.getElementById('customer-lookup');
                if (lookupInput) lookupInput.value = contact.CustomerCompanyName || '';
                applyContact(contact);
            }
        });
    }

    // Notes textarea badge update on input
    const notesTextarea = document.getElementById('notes');
    if (notesTextarea) {
        notesTextarea.addEventListener('input', updateNotesBadge);
    }

    // Setup unsaved changes tracking for form fields (UX improvement)
    setupUnsavedChangesTracking();
    // Native leave-page warning while changes are unsaved (audit 2026-06-10)
    if (typeof setupBeforeUnloadGuard === 'function') setupBeforeUnloadGuard();

    try {
        // Initialize pricing calculator
        pricingCalculator = new EmbroideryPricingCalculator();
        await pricingCalculator.initializeConfig();
        updateStitchTierDropdownLabels();
        initStitchEstimators();   // 📐 estimate-from-logo-size buttons (2026-06-10)

        // Initialize quote service
        quoteService = new EmbroideryQuoteService();

        // Check for edit mode (loading existing quote for revision)
        // Logo status chips — On file / New / TBD (Erik 2026-07-07). "New" auto-adds
        // the new-logo setup (the most-forgotten $100); "TBD" writes the pricing
        // assumption into #notes so it saves/prints/emails with the quote.
        if (typeof initLogoStatusChips === 'function') {
            initLogoStatusChips({
                mountSel: '.logo-config-container',
                artworkMountSel: '#emb-artwork-mount',
                designFocusId: 'garment-design-number',
                notesSel: '#notes',
                assumption: () => {
                    const tierSel = document.getElementById('primary-stitches');
                    const tierText = tierSel ? (tierSel.options[tierSel.selectedIndex]?.text || 'Standard (≤10K)') : 'Standard (≤10K)';
                    const pos = document.getElementById('primary-position')?.value || 'Left Chest';
                    return `Pricing assumes a ${tierText} embroidered logo at ${pos}. Final pricing is confirmed after artwork review; a new logo adds a one-time new-logo setup fee.`;
                },
                onNew: () => {
                    const cb = document.getElementById('primary-digitizing');
                    if (cb && !cb.checked) {
                        cb.checked = true;
                        cb.closest('.digitizing-checkbox')?.classList.add('checked');
                        if (typeof primaryLogo !== 'undefined' && primaryLogo) primaryLogo.needsDigitizing = true;
                        showToast('New logo — added the one-time new-logo setup. Uncheck it if we\'ve stitched this logo before.', 'info', 6000);
                        recalculatePricing();
                    }
                }
            });
        }

        // Mid-call method-switch menu (expert audit 2026-07-07) — serializes IDENTITY
        // only (customer + style/color/sizes); the target builder reprices natively.
        if (typeof initMethodSwitchMenu === 'function') {
            initMethodSwitchMenu({
                current: 'emb',
                collect: () => (typeof collectProductsFromTable === 'function' ? collectProductsFromTable() : [])
                    .filter(p => !p.isService)
                    .map(p => ({
                        style: p.style, color: p.catalogColor || '', colorName: p.color || '',
                        sizeBreakdown: Object.fromEntries(Object.entries(p.sizeBreakdown || {}).filter(([, q]) => (parseInt(q, 10) || 0) > 0))
                    }))
                    .filter(i => i.style && Object.keys(i.sizeBreakdown).length)
            });
        }

        const editQuoteId = checkForEditMode();
        // Duplicate mode (?duplicate=EMB-2026-123): load a copy as a NEW quote (2026-06-10)
        const duplicateQuoteId = new URLSearchParams(window.location.search).get('duplicate');
        // Quick Quote handoff (?from=quickquote — param schema + parser in
        // quote-builder-utils.js getQuickQuotePrefill()). Prefill flows through the
        // SAME addProductFromQuote() path edit-load uses, so pricing/color/size
        // handling is identical to a hand-added row. (item #6, 2026-07-05)
        const qqPrefill = (typeof getQuickQuotePrefill === 'function') ? getQuickQuotePrefill() : null;
        if (duplicateQuoteId) {
            await duplicateQuote(duplicateQuoteId);
        } else if (editQuoteId) {
            // Skip draft recovery and load the existing quote instead
            await loadQuoteForEditing(editQuoteId);
        } else if (qqPrefill) {
            // Prefill wins over draft recovery for this visit (like ?edit=/?duplicate=).
            initEmbroideryPersistence();
            if (typeof setQuoteDateDefaults === 'function') setQuoteDateDefaults();
            try {
                await addProductFromQuote({
                    styleNumber: qqPrefill.style,
                    color: qqPrefill.color || qqPrefill.colorName,
                    sizeBreakdown: qqPrefill.sizeBreakdown
                });
                showToast('Loaded ' + qqPrefill.style + ' from Quick Quote — verify color, quantities & pricing', 'info', 6000);
            } catch (e) {
                console.error('[QuickQuote prefill] failed:', e);
                showToast('Could not prefill ' + qqPrefill.style + ' from Quick Quote — add it manually', 'warning', 6000);
            }
            if (typeof clearQuickQuoteParams === 'function') clearQuickQuoteParams();
        } else if (typeof takeMethodSwitchPrefill === 'function' && (window._msPrefillEmb = takeMethodSwitchPrefill())) {
            // Mid-call method switch (?from=methodswitch — expert audit 2026-07-07):
            // customer + product rows carried over from another builder; each row
            // replays through the SAME addProductFromQuote() path as Quick Quote.
            const ms = window._msPrefillEmb;
            initEmbroideryPersistence();
            if (typeof setQuoteDateDefaults === 'function') setQuoteDateDefaults();
            if (typeof applyMethodSwitchCustomer === 'function') applyMethodSwitchCustomer(ms.customer);
            let msAdded = 0;
            for (const p of (ms.products || [])) {
                try {
                    await addProductFromQuote({
                        styleNumber: p.style,
                        color: p.color || p.colorName,
                        sizeBreakdown: p.sizeBreakdown || {}
                    });
                    msAdded++;
                } catch (e) {
                    console.error('[MethodSwitch] product prefill failed:', p.style, e);
                    showToast('Could not carry ' + p.style + ' over — add it manually', 'warning', 6000);
                }
            }
            showToast(`Switched from ${ms.fromLabel || 'another builder'} — customer + ${msAdded} product${msAdded === 1 ? '' : 's'} carried over. Configure the logos.`, 'success', 7000);
            try { history.replaceState(null, '', window.location.pathname); } catch (_) { }
        } else {
            // Initialize auto-save & draft recovery (2026 consolidation)
            initEmbroideryPersistence();

            // New-quote date defaults (2026-06-02): Date Placed = today,
            // Req Ship Date = today + 2 weeks. Fills blanks only, so a draft
            // restored from the recovery dialog still overrides these.
            if (typeof setQuoteDateDefaults === 'function') setQuoteDateDefaults();

            // Check for draft recovery
            if (embSession && embSession.shouldShowRecovery()) {
                embSession.showRecoveryDialog(
                    (draft) => restoreEmbroideryDraft(draft),
                    () => {
                        if (embPersistence) embPersistence.clearDraft();
                        // No auto-row - user starts with empty state
                    }
                );
            }
            // No auto-row - empty state message guides user to search
        }

        showToast('Ready to build quotes!', 'success');

        // Initialize additional charges display (for default $50 art charge)
        updateAdditionalCharges();

        // Paint the Shipping step's Pickup/Ship toggle + pickup-vs-address UI to
        // match the current ship method (Pickup by default on a new quote; the
        // loaded value when editing). Idempotent. (2026-06-02 order-flow redesign)
        onShipMethodChange();

    } catch (error) {
        console.error('Failed to initialize pricing:', error);
        showToast('Pricing unavailable. Search still works.', 'warning');
    }

    // Auto-focus search bar for immediate typing (UX improvement)
    const searchInput = document.getElementById('product-search');
    if (searchInput) {
        searchInput.focus();
    }

    showLoading(false);
});

// ============================================================
// LOGO PRESETS
// ============================================================

// ============================================================
// STITCH TIER BADGE
// ============================================================

// ============================================================
// PRIMARY LOGO HANDLERS
// ============================================================

function updateLogoCardHeader(type, designNumber) {
    const cardId = type === 'garment' ? 'garment-logo-card' : 'cap-logo-card';
    const baseTitle = type === 'garment' ? 'Primary Logo' : 'Cap Front Logo';
    const card = document.getElementById(cardId);
    if (!card) return;
    const titleEl = card.querySelector('.logo-card-title');
    if (titleEl) {
        titleEl.textContent = designNumber
            ? `${baseTitle} — Design #${designNumber}`
            : baseTitle;
    }
    // Auto-collapse once a design # is set so the card stops crowding the line items below;
    // expand again if it's cleared so the rep can re-enter. The chevron (toggleLogoCard) still
    // lets them re-open it to tweak position / size / stitches. (Erik 2026-06-05)
    if (designNumber) card.classList.add('collapsed');
    else card.classList.remove('collapsed');
    renderOrderRecap();  // logo changed → refresh the bottom Order Recap
}

/**
 * Order Recap — read-only "order at a glance" (Customer / Ship-To / Logos) shown in the empty space
 * LEFT of the invoice totals, so the who/what/where isn't buried in the right rail. It only MIRRORS
 * the real fields (edits still happen there). Re-rendered from recalculatePricing + the customer/logo
 * handlers. Hidden (CSS .order-recap:empty) until there's something to show. (Erik 2026-06-05)
 */
// [2026-06-07] Native <input type="date"> uses YYYY-MM-DD; the rest of the app + the ShopWorks push use
// MM/DD/YYYY. Convert ONLY at the input boundary so nothing downstream (save, PDF, push) changes. Pure
// string ops — NO new Date() — so there is no UTC/timezone day-shift.
function dateToInputValue(v) {            // any (ISO / YYYY-MM-DD / MM/DD/YYYY) → YYYY-MM-DD for the date input
    if (!v) return '';
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    return '';
}
function dateFromInputValue(v) {          // YYYY-MM-DD (or MM/DD/YYYY) → MM/DD/YYYY for storage / push / PDF
    if (!v) return '';
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[2]}/${m[3]}/${m[1]}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
    return '';
}

// [2026-06-08] Order-summary band (Order Recap + Ship-To card) EXTRACTED to the shared, selector-agnostic
// module shared_components/js/quote-order-summary.js (Phase 0 of the DTF/SCP parity). EMB configures it here;
// the module renders #order-recap + #ship-to-card byte-identically and aliases window.renderOrderRecap /
// renderShipToCard / reestimateShipFromCard, so every existing call site keeps working unchanged.
if (typeof QuoteOrderSummary !== 'undefined') {
    QuoteOrderSummary.configure({
        orderRecap: '#order-recap',
        shipToCard: '#ship-to-card',
        ship: { address: '#ship-address', city: '#ship-city', state: '#ship-state', zip: '#ship-zip', method: '#ship-method', fee: '#shipping-fee', residential: '#ship-residential' },
        recap: {
            company: '#company-name', name: '#customer-name', custNum: '#customer-number', shippingDisplay: '#it-shipping-amt',
            // EMB-only: primaryLogo / capPrimaryLogo are module-scoped here, so the logos callback lives in EMB.
            logos: function () {
                var out = [];
                try {
                    if (typeof primaryLogo !== 'undefined' && primaryLogo && primaryLogo.designNumber) {
                        var pos = document.getElementById('primary-position')?.value || '';
                        out.push({ text: '#' + primaryLogo.designNumber + (pos ? ' · ' + pos : ''), thumbUrl: primaryLogo.thumbnailUrl || '', label: '#' + primaryLogo.designNumber });
                    }
                    if (typeof capPrimaryLogo !== 'undefined' && capPrimaryLogo && capPrimaryLogo.designNumber) {
                        out.push({ text: 'Cap #' + capPrimaryLogo.designNumber, thumbUrl: capPrimaryLogo.thumbnailUrl || '', label: 'Cap #' + capPrimaryLogo.designNumber });
                    }
                } catch (_) {}
                return out;
            }
        },
        estimate: function () { return QuoteOrderSummary.estimateShipping(); },
        reestimateOnclick: 'reestimateShipFromCard()',
        editOnclick: 'openShippingModal()',
        apiBase: API_BASE,
        // [2026-06-08] EMB DRY-rewire: EMB now uses the SHARED estimator (byte-identical copy in quote-order-summary.js);
        // estimateShipping() below is a thin delegate, perBoxForCategory removed. These hooks give the shared estimator
        // EMB's product source + post-apply recalc. (EMB keeps its own openShippingModal/closeShippingModal.)
        estimateHooks: {
            collectProducts: function () { return collectProductsFromTable(); },
            onApplied: function () { updateAdditionalCharges(); updateTaxCalculation(); },
            btn: '#estimate-ship-btn',
            result: '#estimate-ship-result',
        },
    });
}

// ============================================================
// DESIGN NUMBER LOOKUP / SEARCH — MOVED to builders/emb/design-search.js
// (roadmap 0.4 extraction #1, 2026-07-07). The builders/emb bundle
// re-exports the entry points onto window before DOMContentLoaded, so
// every call site below and every inline handler keeps working.
// ============================================================
function setupPrimaryLogoHandlers() {
    // Position and tier dropdown handled by inline onchange handlers
    // (onPrimaryPositionChange, onPrimaryStitchTierChange)

    // Digitizing checkbox
    const digitizingCheckbox = document.getElementById('primary-digitizing');
    if (digitizingCheckbox) {
        digitizingCheckbox.addEventListener('change', function() {
            primaryLogo.needsDigitizing = this.checked;
            recalculatePricing();
        });
    }
}

// (Per-logo card functions removed — AL is now managed via global toggle only)

// Update cap logo section visibility based on caps in quote
function updateCapLogoSectionVisibility() {
    const hasCaps = document.querySelectorAll('tr[data-is-cap="true"]').length > 0;
    // Use new card element (2026 modernized UI)
    const capCard = document.getElementById('cap-logo-card');
    if (capCard) {
        capCard.style.display = hasCaps ? 'block' : 'none';
        // Update dropdown labels with API prices when showing cap section
        if (hasCaps) {
            updateEmbellishmentDropdownLabels();
        }
    }
    // Also update artwork services visibility
    updateArtworkServicesVisibility();
}

// Update garment logo section visibility based on garments in quote
function updateGarmentLogoSectionVisibility() {
    const hasGarments = document.querySelectorAll('tr[data-is-cap="false"]').length > 0;
    const garmentCard = document.getElementById('garment-logo-card');
    if (garmentCard) {
        garmentCard.style.display = hasGarments ? 'block' : 'none';
    }
    // Also update artwork services visibility
    updateArtworkServicesVisibility();
}

// Update empty state row visibility based on products
function updateArtworkServicesVisibility() {
    // Check for rows with data-is-cap attribute (indicates a valid product was added)
    const hasGarments = document.querySelectorAll('tr[data-is-cap="false"]').length > 0;
    const hasCaps = document.querySelectorAll('tr[data-is-cap="true"]').length > 0;
    const hasAnyProducts = hasGarments || hasCaps;
    // Artwork Services panel is now in sidebar (always visible)
    // Just update empty state row visibility
    const emptyStateRow = document.getElementById('empty-state-row');
    if (emptyStateRow) {
        emptyStateRow.style.display = hasAnyProducts ? 'none' : '';
    }
}

// Setup cap primary logo event handlers
function setupCapPrimaryLogoHandlers() {
    // Tier dropdown handled by inline onchange handler (onCapStitchTierChange)
    const digitizingCheckbox = document.getElementById('cap-primary-digitizing');

    if (digitizingCheckbox) {
        digitizingCheckbox.addEventListener('change', function() {
            capPrimaryLogo.needsDigitizing = this.checked;
            recalculatePricing();
        });
    }
}

// ============================================================
// PRODUCT SEARCH & AUTOCOMPLETE (Using ExactMatchSearch module)
// ============================================================

// Module instance - initialized in setupSearchAutocomplete
let exactMatchSearcher = null;

function setupSearchAutocomplete() {
    const searchInput = document.getElementById('product-search');
    const suggestions = document.getElementById('search-suggestions');

    if (!searchInput || !window.ExactMatchSearch) {
        console.error('[Embroidery] Search input or ExactMatchSearch module not found');
        return;
    }

    // Initialize ExactMatchSearch with full keyboard navigation
    exactMatchSearcher = new window.ExactMatchSearch({
        apiBase: API_BASE,
        debounceMs: 300,  // Standardized debounce

        // Auto-load exact matches immediately
        onExactMatch: (product) => {
            // Exact match found
            searchInput.value = '';
            selectProduct(product.value);
        },

        // Show suggestions dropdown
        onSuggestions: (products) => {
            showSearchSuggestions(products);
        },

        // Keyboard navigation: update visual highlight
        onNavigate: (selectedIndex, products) => {
            updateSearchSelectionHighlight(selectedIndex);
        },

        // Keyboard navigation: select item via Enter
        onSelect: (product) => {
            // Keyboard selected product
            searchInput.value = '';
            selectProduct(product.value);
        },

        // Keyboard navigation: close dropdown via Escape
        onClose: () => {
            suggestions.classList.remove('show');
        }
    });

    // Wire up search input
    searchInput.addEventListener('input', function() {
        const query = this.value.trim();

        if (query.length < 2) {
            suggestions.classList.remove('show');
            return;
        }

        exactMatchSearcher.search(query);
    });

    // Handle keyboard navigation
    searchInput.addEventListener('keydown', function(e) {
        // Let ExactMatchSearch handle navigation keys
        if (exactMatchSearcher && exactMatchSearcher.handleKeyDown(e)) {
            return; // Event was handled
        }

        // Handle Enter for immediate search when nothing is selected
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                exactMatchSearcher.searchImmediate(query);
            }
        }
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-input-wrapper')) {
            suggestions.classList.remove('show');
            if (exactMatchSearcher) exactMatchSearcher.resetNavigation();
        }
    });

    // Search autocomplete initialized
}

/**
 * Show search suggestions dropdown
 */
function showSearchSuggestions(products) {
    const suggestions = document.getElementById('search-suggestions');

    if (!products || products.length === 0) {
        // Not a dead-end: offer the non-SanMar add path right here. The row-level
        // style input already had this; the TOP search just said "No products
        // found" and stranded the rep. (audit ux-flow 2026-06-10)
        const q = (document.getElementById('product-search')?.value || '').trim();
        const safeQ = escapeHtml(q);
        suggestions.innerHTML = `
            <div class="suggestion-item"><span>No SanMar products found${q ? ` for "${safeQ}"` : ''}</span></div>
            ${q ? `<div class="suggestion-item suggestion-add-nonsanmar" onclick="addNonSanmarFromSearch()" style="cursor:pointer; color:#16a34a; font-weight:600;"><span><i class="fas fa-plus-circle"></i> Add "${safeQ}" as a non-SanMar product…</span></div>` : ''}`;
        suggestions.classList.add('show');
        return;
    }

    suggestions.innerHTML = products.map(product => {
        // Extract product name (remove style prefix from label)
        const productName = (product.label || '').split(' - ').slice(1).join(' - ') || '';
        return `
            <div class="suggestion-item" onclick="selectProduct('${escapeHtml(product.value)}')">
                <span class="style">${escapeHtml(product.value)}</span>
                <span class="name">${escapeHtml(productName)}</span>
            </div>
        `;
    }).join('');
    suggestions.classList.add('show');

    // Cache product data (convert to expected format)
    products.forEach(p => {
        productCache[p.value] = {
            STYLE: p.value,
            PRODUCT_TITLE: p.label
        };
    });
}

/**
 * Update visual highlight on selected suggestion item
 */
function updateSearchSelectionHighlight(selectedIndex) {
    const suggestions = document.getElementById('search-suggestions');
    if (!suggestions) return;

    suggestions.querySelectorAll('.suggestion-item').forEach((item, index) => {
        if (index === selectedIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('selected');
        }
    });
}

async function selectProduct(styleNumber) {
    const searchInput = document.getElementById('product-search');
    const suggestions = document.getElementById('search-suggestions');

    searchInput.value = '';
    suggestions.classList.remove('show');

    // Add product to table
    await addProductRow(styleNumber);

    // Mark as having unsaved changes
    markAsUnsaved();
}

// ============================================================
// PRODUCT TABLE MANAGEMENT
// ============================================================

function addNewRow() {
    const tbody = document.getElementById('product-tbody');
    const rowId = ++rowCounter;

    // Hide empty state message when adding first row
    const emptyStateRow = document.getElementById('empty-state-row');
    if (emptyStateRow) emptyStateRow.style.display = 'none';

    const row = document.createElement('tr');
    row.id = `row-${rowId}`;
    row.className = 'new-row';
    row.dataset.rowId = rowId;

    row.innerHTML = `
        <td>
            <input type="text" class="cell-input style-input"
                   placeholder="Style #"
                   data-field="style"
                   onchange="onStyleChange(this, ${rowId})"
                   onkeydown="handleCellKeydown(event, this)">
        </td>
        <td class="thumbnail-col">
            <div class="product-thumbnail no-image" id="thumb-${rowId}"
                 title="Select a color to see product image"
                 style="width: 50px; height: 50px; display: flex; align-items: center; justify-content: center;"></div>
        </td>
        <td class="desc-cell">
            <div class="desc-row">
                <input type="text" class="cell-input desc-input"
                       placeholder="(auto)"
                       data-field="description"
                       readonly>
                <span class="cap-badge" id="cap-badge-${rowId}" style="display: none;">
                    <i class="fas fa-hat-cowboy"></i> Cap
                </span>
            </div>
            <div class="pricing-breakdown" id="breakdown-${rowId}"></div>
        </td>
        <td>
            <div class="color-picker-wrapper" data-row-id="${rowId}">
                <div class="color-picker-selected disabled" onclick="toggleColorPicker(${rowId})" tabindex="0" onkeydown="handleColorPickerKeydown(event, ${rowId})">
                    <span class="color-swatch empty"></span>
                    <span class="color-name placeholder">Select color...</span>
                    <i class="fas fa-chevron-down picker-arrow"></i>
                </div>
                <div class="color-picker-dropdown hidden" id="color-dropdown-${rowId}"></div>
            </div>
        </td>
        <td><input type="number" class="cell-input size-input" data-size="S" min="0" max="9999" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="number" class="cell-input size-input" data-size="M" min="0" max="9999" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="number" class="cell-input size-input" data-size="L" min="0" max="9999" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="number" class="cell-input size-input" data-size="XL" min="0" max="9999" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="number" class="cell-input size-input" data-size="2XL" min="0" max="9999" value="" placeholder="0" onchange="onSizeChange(${rowId})" onkeydown="handleCellKeydown(event, this)" disabled></td>
        <td><input type="text" class="cell-input size-input xxxl-picker-btn" data-size="3XL" value="" placeholder="+" readonly onclick="openExtendedSizePopup(${rowId})" onkeydown="if(event.key==='Enter'){openExtendedSizePopup(${rowId})}" disabled title="Click to add extended sizes (3XL, 4XL, 5XL, XS, etc.)"></td>
        <td class="cell-qty" id="row-qty-${rowId}">0</td>
        <td class="cell-price" id="row-price-${rowId}"
            ondblclick="enablePriceOverride(${rowId})"
            title="Double-click to override price">-</td>
        <td class="cell-total" id="row-total-${rowId}">-</td>
        <td class="cell-actions">
            <button class="btn-duplicate-row" onclick="duplicateRowNewColor(${rowId})" title="Add another color of this style" disabled>
                <i class="fas fa-copy"></i>
            </button>
            <button class="btn-delete-row" onclick="deleteRow(${rowId})" title="Delete row">
                <i class="fas fa-times"></i>
            </button>
        </td>
    `;

    tbody.appendChild(row);

    // Focus on the style input
    setTimeout(() => {
        row.querySelector('.style-input').focus();
    }, 50);

    // Remove the "new-row" highlight after a moment
    setTimeout(() => {
        row.classList.remove('new-row');
    }, 1000);

    return rowId;
}

async function addProductRow(styleNumber) {
    // Find or create empty row
    let targetRow = document.querySelector('tr.new-row');
    if (!targetRow) {
        addNewRow();
        targetRow = document.querySelector('tr.new-row');
    }

    const rowId = targetRow.dataset.rowId;
    const styleInput = targetRow.querySelector('.style-input');
    styleInput.value = styleNumber;

    await onStyleChange(styleInput, parseInt(rowId));
}

/**
 * Top-search "no results" → route the typed style into a table row, which runs
 * the existing non-SanMar lookup (and its "Add to Non-SanMar database" button
 * when the style is brand-new). (audit ux-flow 2026-06-10)
 */
async function addNonSanmarFromSearch() {
    const searchEl = document.getElementById('product-search');
    const q = (searchEl?.value || '').trim();
    if (!q) return;
    document.getElementById('search-suggestions')?.classList.remove('show');
    if (searchEl) searchEl.value = '';
    await addProductRow(q);
}
window.addNonSanmarFromSearch = addNonSanmarFromSearch;

/**
 * Create a service product row (DECG, DECC, AL, FB, CB, MONOGRAM, etc.)
 * These appear as line items in the product table, not as fee rows
 * @param {string} serviceType - Service code: DECG, DECC, AL, FB, CB, CS, MONOGRAM, AS-GARM, AS-CAP
 * @param {Object} data - Service data: { quantity, stitchCount, position, unitPrice, total, isCap }
 * @returns {HTMLElement} The created row element
 */
function createServiceProductRow(serviceType, data) {
    const tbody = document.getElementById('product-tbody');
    const rowId = ++rowCounter;

    // Hide empty state message
    const emptyStateRow = document.getElementById('empty-state-row');
    if (emptyStateRow) emptyStateRow.style.display = 'none';

    // Service type metadata
    const SERVICE_META = {
        'DECG': { description: 'Customer-Supplied Garments', icon: 'fa-tshirt', isCap: false },
        'DECC': { description: 'Customer-Supplied Caps', icon: 'fa-hard-hat', isCap: true },
        'AL': { description: 'Additional Logo', icon: 'fa-plus-circle', isCap: false },
        'AL-CAP': { description: 'Additional Logo Cap', icon: 'fa-plus-circle', isCap: true },
        'FB': { description: 'Full Back Embroidery', icon: 'fa-expand', isCap: false },
        'DECG-FB': { description: 'Full Back Embroidery', icon: 'fa-expand', isCap: false },
        'CB': { description: 'Cap Back Embroidery', icon: 'fa-hat-cowboy', isCap: true },
        'CS': { description: 'Cap Side Embroidery', icon: 'fa-hat-cowboy', isCap: true },
        'Monogram': { description: 'Dir. Embroider Names on Garments', icon: 'fa-font', isCap: false },
        'MONOGRAM': { description: 'Names/Monograms', icon: 'fa-font', isCap: false },
        'Name/Number': { description: 'Name & Number', icon: 'fa-id-badge', isCap: false },
        'NAME': { description: 'Name & Number', icon: 'fa-id-badge', isCap: false }, // Legacy
        'WEIGHT': { description: 'Weight', icon: 'fa-weight-hanging', isCap: false },
        'SEG': { description: 'Sewing (Garment)', icon: 'fa-scissors', isCap: false },
        'SECC': { description: 'Sewing (Cap)', icon: 'fa-scissors', isCap: true },
        'DT': { description: 'Design Transfer', icon: 'fa-exchange-alt', isCap: false },
        'CTR-GARMT': { description: 'Contract (Garment)', icon: 'fa-file-contract', isCap: false },
        'CTR-CAP': { description: 'Contract (Cap)', icon: 'fa-file-contract', isCap: true },
        'AS-Garm': { description: 'Additional Stitches (Garment)', icon: 'fa-layer-group', isCap: false },
        'AS-GARM': { description: 'Additional Stitches (Garment)', icon: 'fa-layer-group', isCap: false },
        'AS-CAP': { description: 'Additional Stitches (Cap)', icon: 'fa-layer-group', isCap: true },
        '3D-EMB': { description: '3D Puff Embroidery', icon: 'fa-cube', isCap: true },
        'Laser Patch': { description: 'Laser Leatherette Patch', icon: 'fa-certificate', isCap: true },
        'GRT-50': { description: 'Logo Mockup & Print Review', icon: 'fa-palette', isCap: false },
        'GRT-75': { description: 'Graphic Design Services', icon: 'fa-pencil-ruler', isCap: false },
        'DD': { description: 'Digitizing Setup', icon: 'fa-cog', isCap: false },
        'RUSH': { description: 'Rush Charge', icon: 'fa-bolt', isCap: false },
        // Synthesized by _syncDecgLtmRow() when customer-supplied qty is under the
        // small-batch threshold; PN 'LTM' is proxy-registered (KNOWN_FEE_PNS) so it
        // pushes as a real ShopWorks line item. (expert audit 2026-07-07)
        'LTM': { description: 'Customer-Supplied Small-Batch Fee', icon: 'fa-exclamation-circle', isCap: false },
        // Extra thread colors from the design badge (addExtraColorSurchargeRow);
        // ShopWorks part 'Color Chg' verbatim (proxy KNOWN_FEE_PNS). (2026-07-07)
        'Color Chg': { description: 'Extra Thread Colors', icon: 'fa-palette', isCap: false }
    };

    const meta = SERVICE_META[serviceType] || { description: serviceType, icon: 'fa-cog', isCap: false };
    const isCap = data.isCap !== undefined ? data.isCap : meta.isCap;
    const quantity = data.quantity || 0;
    const unitPrice = data.unitPrice || 0;
    const total = data.total || (quantity * unitPrice);
    const stitchCount = data.stitchCount || 8000;
    const position = data.position || '';

    // Description with position info
    let displayDescription = meta.description;
    if (position) {
        displayDescription += `: ${position}`;
    }
    if (stitchCount && serviceType !== 'MONOGRAM' && serviceType !== 'Monogram' && serviceType !== 'Laser Patch' && serviceType !== '3D-EMB' && serviceType !== 'GRT-50' && serviceType !== 'GRT-75' && serviceType !== 'DD' && serviceType !== 'RUSH' && serviceType !== 'LTM' && serviceType !== 'Color Chg') {
        displayDescription += ` (${(stitchCount / 1000).toFixed(0)}K stitches)`;
    }

    const row = document.createElement('tr');
    row.id = `row-${rowId}`;
    row.className = 'service-product-row';
    row.dataset.rowId = rowId;
    row.dataset.productType = 'service';
    row.dataset.serviceType = serviceType.toLowerCase();
    row.dataset.style = serviceType;
    row.dataset.isCap = isCap.toString();
    row.dataset.stitchCount = stitchCount.toString();
    row.dataset.position = position;
    row.dataset.unitPrice = unitPrice.toString();

    row.innerHTML = `
        <td>
            <span class="service-style-badge" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: ${isCap ? '#dbeafe' : '#fef3c7'}; color: ${isCap ? '#1e40af' : '#92400e'}; border-radius: 4px; font-weight: 600; font-size: 12px;">
                <i class="fas ${meta.icon}"></i>
                ${serviceType}
            </span>
        </td>
        <td class="thumbnail-col">
            <div class="service-icon" style="width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; background: ${isCap ? '#eff6ff' : '#fffbeb'}; border-radius: 6px;">
                <i class="fas ${meta.icon}" style="font-size: 20px; color: ${isCap ? '#3b82f6' : '#f59e0b'};"></i>
            </div>
        </td>
        <td class="desc-cell">
            <div class="desc-row">
                <span class="service-description" style="font-size: 13px; color: #334155;">${escapeHtml(displayDescription)}</span>
                ${isCap ? '<span class="cap-badge" style="display: inline-flex;"><i class="fas fa-hat-cowboy"></i> Cap</span>' : ''}
            </div>
        </td>
        <td>
            <span style="color: #64748b; font-size: 12px;">N/A</span>
        </td>
        <td colspan="6" style="text-align: center; color: #94a3b8; font-size: 11px; font-style: italic;">
            Service item - no size breakdown
        </td>
        <td class="cell-qty">
            <input type="number" class="cell-input service-qty" min="0" max="9999" value="${quantity}"
                   onchange="onServiceQtyChange(${rowId})" onkeydown="handleCellKeydown(event, this)"
                   style="width: 60px; text-align: center;">
        </td>
        <td class="cell-price" id="row-price-${rowId}"
            ${['DECG', 'DECC'].includes(serviceType) ? `ondblclick="enablePriceOverride(${rowId})" title="Double-click to override price"` : ''}>$${unitPrice.toFixed(2)}</td>
        <td class="cell-total" id="row-total-${rowId}">$${total.toFixed(2)}</td>
        <td class="cell-actions">
            <button class="btn-delete-row" onclick="deleteServiceRow(${rowId})" title="Delete service">
                <i class="fas fa-times"></i>
            </button>
        </td>
    `;

    // Insert service rows after all regular product rows but before fee rows
    // Find the fees-tbody or append to product-tbody
    const feesTbody = document.getElementById('fees-tbody');
    if (feesTbody && feesTbody.previousElementSibling) {
        // Insert at end of product-tbody, just before fees-tbody
        tbody.appendChild(row);
    } else {
        tbody.appendChild(row);
    }

    return row;
}

// toggleServiceDropdown removed 2026-06-10 — zero callers; its #service-dropdown-menu
// target no longer exists (replaced by the Services bar).

/**
 * Add a manual service row (Monogram, Name/Number, WEIGHT)
 * Called from the Services bar
 */
function addManualServiceRow(serviceType, priceOverride) {
    // Rush is a single, computed 25%-of-subtotal fee — never add a duplicate
    if (serviceType === 'RUSH' && document.querySelector('#product-tbody tr.service-product-row[data-service-type="rush"]')) {
        showToast('Rush Fee is already on the order', 'info');
        return;
    }

    // Default prices per service type
    const SERVICE_DEFAULTS = {
        'Monogram': { unitPrice: getServicePrice('Monogram', 12.50), quantity: 1 },
        'Name/Number': { unitPrice: getServicePrice('Name/Number', 15.00), quantity: 1 },
        'WEIGHT': { unitPrice: getServicePrice('WEIGHT', 6.25), quantity: 1 },
        'SEG': { unitPrice: getServicePrice('SEG', 10.00), quantity: 1 },
        'DT': { unitPrice: getServicePrice('DT', 50.00), quantity: 1 },
        'CTR-GARMT': { unitPrice: 0, quantity: 1 },
        'CTR-CAP': { unitPrice: 0, quantity: 1 },
        'GRT-50': { unitPrice: getServicePrice('GRT-50', 50), quantity: 1 },
        'GRT-75': { unitPrice: getServicePrice('GRT-75', 75), quantity: 1 },
        'DD': { unitPrice: getServicePrice('DD', 100), quantity: 1 },
        'RUSH': { unitPrice: 0, quantity: 1 }
    };

    const defaults = SERVICE_DEFAULTS[serviceType] || { unitPrice: 0, quantity: 1 };
    // Amount entered in the Services bar for variable-price items (Logo Mockup, Rush)
    const unitPrice = (priceOverride != null && !isNaN(priceOverride)) ? Number(priceOverride) : defaults.unitPrice;

    const row = createServiceProductRow(serviceType, {
        quantity: defaults.quantity,
        unitPrice: unitPrice,
        total: defaults.quantity * unitPrice,
        isCap: false
    });

    if (row) {
        if (serviceType === 'RUSH') {
            // Rush qty is fixed at 1; its price = 25% of subtotal (set live in syncRushRow)
            const q = row.querySelector('.service-qty');
            if (q) { q.value = '1'; q.readOnly = true; }
            markAsUnsaved();
            recalculatePricing();
            showToast('Rush Fee added — 25% of subtotal', 'success');
        } else if (serviceType === 'Monogram' || serviceType === 'Name/Number') {
            // Names capture (expert audit 2026-07-07 F6): "12 monograms" with no
            // names/sizes pairing is an unrunnable production order — the manual
            // path had no prompt, so quotes regularly went out without them.
            markAsUnsaved();
            recalculatePricing();
            openMonogramNamesDialog(row, serviceType);
        } else {
            // Focus the quantity input so user can immediately set count
            const qtyInput = row.querySelector('.service-qty');
            if (qtyInput) {
                setTimeout(() => {
                    qtyInput.focus();
                    qtyInput.select();
                }, 50);
            }
            markAsUnsaved();
            recalculatePricing();
            showToast(`${serviceType} service row added`, 'success');
        }
    }
}

/**
 * Add an Additional Logo line item from the Services bar.
 *   placement : 'Left Chest' | 'Right Sleeve' | 'Full Back' | 'Cap Front' | … (drives pricing path + prints on the line)
 *   stitches  : exact stitch count, e.g. 8000 / 11000 / 55000 (typed or from a Std/Mid/Large chip)
 * The per-piece price is LIVE from the API (EmbroideryPricingService.calculateALPrice —
 * tier-aware + per-1K stitch upcharge). syncALRows() computes/refreshes it on every
 * recalc, so the price tracks the quantity the rep types into the line. Multiples are
 * independent (each row carries its own stitch count + placement/pricing path).
 */
async function addALLineItem(placement, stitches) {
    // Placement drives the pricing path: Full Back → flat per-1K full-back rate; any Cap
    // placement → cap AL rate; everything else → garment AL rate. The EXACT stitch count
    // (typed or preset chip) feeds calculateALPrice, so any value (11K, 55K, …) prices
    // correctly from the API — no coarse buckets.
    const CAP_PLACEMENTS = ['Cap Front', 'Cap Back', 'Cap Side'];
    let serviceType, priceItemType, isCap;
    if (placement === 'Full Back') {
        serviceType = 'DECG-FB'; priceItemType = 'fullback'; isCap = false;
    } else if (CAP_PLACEMENTS.includes(placement)) {
        serviceType = 'AL-CAP'; priceItemType = 'cap'; isCap = true;
    } else {
        serviceType = 'AL'; priceItemType = 'garment'; isCap = false;
    }
    let stitchCount = parseInt(stitches, 10);
    if (!stitchCount || stitchCount < 1) {
        stitchCount = priceItemType === 'cap' ? 5000 : (priceItemType === 'fullback' ? 25000 : 8000);
    }

    // Auto-tally: a 2nd logo goes on EVERY piece, so default the qty to the order's current
    // garment (or cap) count instead of 1 — reps no longer hand-count. Stays auto-synced to the
    // order total until the rep types a different qty. (Erik 2026-06-05)
    const counts = getOrderPieceCounts();
    const autoQty = (priceItemType === 'cap') ? counts.cap : counts.garment;

    const row = createServiceProductRow(serviceType, {
        quantity: autoQty > 0 ? autoQty : 1,
        unitPrice: 0,      // placeholder — set live by syncALRows()
        total: 0,
        isCap: isCap,
        stitchCount: stitchCount,
        position: placement   // prints on the line + carries to ShopWorks
    });
    if (!row) return;

    // Mark the row for live AL pricing; carry the pricing item type (garment/cap/fullback)
    row.dataset.alPriced = 'true';
    row.dataset.alItemType = priceItemType;
    row.dataset.alQtyAuto = 'true';   // qty tracks the order's piece count until the rep edits it

    // Focus the qty input so the rep can set the count immediately
    const qtyInput = row.querySelector('.service-qty');
    if (qtyInput) setTimeout(() => { qtyInput.focus(); qtyInput.select(); }, 50);

    markAsUnsaved();
    await syncALRows();     // pull the live per-piece price from the API (cached) for this row
    recalculatePricing();   // sum it into the totals
    showToast(autoQty > 0
        ? `Additional Logo (${placement}) — qty auto-set to ${autoQty} (all pieces). Adjust if needed.`
        : `Additional Logo (${placement}) added — set the quantity`, 'success');
}

/**
 * Add a Customer-Supplied (DECG / DECC) line item from the Services bar.
 *   itemType : 'garment' (part # DECG) | 'cap' (part # DECC)
 *   stitches : exact stitch count (typed or from a Std/Mid/Large chip)
 * The customer brings their OWN blanks (e.g. corporate buys jackets at Costco), so we charge
 * embroidery ONLY — no garment — at a MUCH higher per-piece rate because there is no garment
 * margin to absorb it. Price is LIVE from the API: EmbroideryPricingService.calculateDECGPrice
 * pulls the qty-tier base + per-1K stitch upcharge from /api/decg-pricing (Caspio Embroidery_Costs
 * DECG-Garmt / DECG-Cap tiers — garment vs cap chosen by itemType). syncDECGRows() refreshes the
 * price whenever the rep changes the quantity. NEVER guesses: API down → visible toast + $0
 * (Erik's #1 rule). The price cell stays double-click-overridable. (2026-06-04)
 */
async function addDECGLineItem(itemType, stitches, heavyweight) {
    const serviceType = itemType === 'cap' ? 'DECC' : 'DECG';
    let stitchCount = parseInt(stitches, 10);
    if (!stitchCount || stitchCount < 1) stitchCount = 8000;

    const row = createServiceProductRow(serviceType, {
        quantity: 1,
        unitPrice: 0,      // placeholder — set live by syncDECGRows()
        total: 0,
        isCap: itemType === 'cap',
        stitchCount: stitchCount
    });
    if (!row) return;

    // Mark the row for live DECG pricing; carry the item type (garment/cap → tier table).
    row.dataset.decgPriced = 'true';
    row.dataset.decgItemType = itemType === 'cap' ? 'cap' : 'garment';
    row.dataset.decgHeavyweight = heavyweight ? 'true' : 'false';   // +$10/pc Carhartt/canvas/leather

    const qtyInput = row.querySelector('.service-qty');
    if (qtyInput) setTimeout(() => { qtyInput.focus(); qtyInput.select(); }, 50);

    markAsUnsaved();
    await syncDECGRows();    // pull the live per-piece price from the API (cached) for this row
    recalculatePricing();    // sum it into the totals
    showToast(`Customer-Supplied ${itemType === 'cap' ? 'Cap (DECC)' : 'Garment (DECG)'} added — set the quantity`, 'success');
}
window.addDECGLineItem = addDECGLineItem;

/**
 * Extra-thread-color surcharge row (expert audit 2026-07-07 F2). The design badge
 * has always WARNED "+N extra colors (+$X/pc)" and then billed nothing — the
 * system announced money it didn't collect. One click adds it as a service row
 * (pushes as ShopWorks part 'Color Chg'); the $/pc comes from the design record
 * (API-sourced), qty auto-tallies to the category piece count and stays editable.
 */
function addExtraColorSurchargeRow(type, extraColors, perPiece) {
    perPiece = parseFloat(perPiece);
    if (!(perPiece > 0)) return;
    const existing = document.querySelector(`#product-tbody tr.service-product-row[data-extra-colors="${type}"]`);
    if (existing) {
        existing.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('Extra-color surcharge is already on the quote — adjust its quantity there.', 'info');
        return;
    }
    const items = (typeof collectProductsFromTable === 'function') ? collectProductsFromTable() : [];
    const isCapType = type === 'cap';
    const autoQty = items.filter(p => !p.isService && (!!p.isCap === isCapType))
        .reduce((s, p) => s + (p.totalQuantity || 0), 0);
    const row = createServiceProductRow('Color Chg', {
        quantity: autoQty || 1,
        unitPrice: perPiece,
        total: (autoQty || 1) * perPiece,
        isCap: isCapType,
        position: `${extraColors} extra color${extraColors === 1 ? '' : 's'}`
    });
    if (!row) return;
    row.dataset.extraColors = type;
    markAsUnsaved();
    recalculatePricing();
    showToast(autoQty > 0
        ? `Extra-color surcharge added — qty auto-set to ${autoQty} (all ${type} pieces). Adjust if needed.`
        : 'Extra-color surcharge added — set the quantity', 'success');
}
window.addExtraColorSurchargeRow = addExtraColorSurchargeRow;

/**
 * Lightweight names dialog for Monogram / Name-Number rows (expert audit
 * 2026-07-07 F6). One name per line → the count auto-fills the row qty and the
 * list lands in Special Notes under the SAME '--- Names/Monograms ---' header the
 * ShopWorks-import path writes, so print/push/notes downstream already handle it.
 * Skippable — the rep can always type qty by hand like before.
 */
function openMonogramNamesDialog(row, serviceType) {
    document.getElementById('monogram-names-dialog')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'monogram-names-dialog';
    wrap.className = 'monogram-names-dialog';
    wrap.innerHTML =
        '<div class="mnd-card" role="dialog" aria-modal="true" aria-labelledby="mnd-title">' +
        '  <div id="mnd-title" class="mnd-title"><i class="fas fa-font"></i> ' + escapeHtml(serviceType) + ' — who gets one?</div>' +
        '  <div class="mnd-hint">One name per line (add size/placement after a comma if needed, e.g. "Sarah M, L"). The line count becomes the quantity.</div>' +
        '  <textarea class="mnd-names" rows="6" placeholder="Sarah M&#10;John D, XL&#10;Riley P"></textarea>' +
        '  <div class="mnd-actions">' +
        '    <button type="button" class="mnd-skip">Skip — set qty by hand</button>' +
        '    <button type="button" class="mnd-apply">Add names</button>' +
        '  </div>' +
        '</div>';
    document.body.appendChild(wrap);
    const ta = wrap.querySelector('.mnd-names');
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') { close(); focusQty(); } };
    const focusQty = () => {
        const q = row.querySelector('.service-qty');
        if (q) { q.focus(); q.select(); }
    };
    wrap.querySelector('.mnd-skip').addEventListener('click', () => { close(); focusQty(); });
    wrap.addEventListener('click', (e) => { if (e.target === wrap) { close(); focusQty(); } });
    document.addEventListener('keydown', onKey);
    wrap.querySelector('.mnd-apply').addEventListener('click', () => {
        const names = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
        close();
        if (!names.length) { focusQty(); return; }
        const q = row.querySelector('.service-qty');
        if (q) {
            q.value = String(names.length);
            q.dispatchEvent(new Event('change', { bubbles: true }));   // reprices via onServiceQtyChange
        }
        const notesEl = document.getElementById('notes');
        if (notesEl) {
            notesEl.value = (notesEl.value ? notesEl.value + '\n' : '') +
                '--- Names/Monograms ---\n' + names.join('\n');
            if (typeof updateNotesBadge === 'function') updateNotesBadge();
        }
        const desc = row.querySelector('.service-description');
        if (desc) desc.textContent = desc.textContent.replace(/: \d+ names$/, '') + `: ${names.length} names`;
        markAsUnsaved();
        recalculatePricing();
        showToast(`${names.length} name${names.length === 1 ? '' : 's'} captured — qty set to ${names.length}; list saved to Special Notes.`, 'success');
    });
    setTimeout(() => ta.focus(), 50);
}
window.openMonogramNamesDialog = openMonogramNamesDialog;

/**
 * Handle quantity change for service product rows
 */
function onServiceQtyChange(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row || row.dataset.productType !== 'service') return;

    // Additional Logo: per-piece price is tier-based (changes with this row's quantity),
    // so re-price from the API first, then recalc. syncALRows updates this row's cells.
    if (row.dataset.alPriced === 'true') {
        row.dataset.alQtyAuto = 'false';   // rep set the qty by hand — stop auto-tallying to the order total
        syncALRows().then(() => recalculatePricing());
        markAsUnsaved();
        return;
    }

    // Customer-Supplied (DECG/DECC): per-piece price is tier-based (changes with this row's
    // quantity), so re-price from the API first, then recalc. syncDECGRows updates the cells.
    if (row.dataset.decgPriced === 'true') {
        syncDECGRows().then(() => recalculatePricing());
        markAsUnsaved();
        return;
    }

    const qtyInput = row.querySelector('.service-qty');
    const quantity = parseFloat(qtyInput?.value) || 0;  // parseFloat → Graphic Design hours can be fractional (e.g. 0.75)
    // Use sell price override if set, otherwise use original unit price
    const overridePrice = parseFloat(row.dataset.sellPrice) || 0;
    const unitPrice = overridePrice > 0 ? overridePrice : (parseFloat(row.dataset.unitPrice) || 0);
    const total = quantity * unitPrice;

    // Update price cell with override indicator if applicable
    const priceCell = document.getElementById(`row-price-${rowId}`);
    if (priceCell) {
        if (overridePrice > 0) {
            priceCell.classList.add('price-overridden');
            priceCell.innerHTML = `<span class="price-override-wrapper">$${unitPrice.toFixed(2)}<button class="btn-clear-override" onclick="event.stopPropagation(); clearPriceOverride(${rowId})" title="Clear override">&times;</button></span>`;
        } else {
            priceCell.classList.remove('price-overridden');
            priceCell.textContent = `$${unitPrice.toFixed(2)}`;
        }
    }

    // Update total display
    const totalCell = document.getElementById(`row-total-${rowId}`);
    if (totalCell) totalCell.textContent = `$${total.toFixed(2)}`;

    // Trigger recalculation
    recalculatePricing();
    markAsUnsaved();
}

/**
 * Delete a service product row
 */
function deleteServiceRow(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (row) {
        row.remove();
        recalculatePricing();
        markAsUnsaved();
    }
}

async function onStyleChange(input, rowId) {
    let styleNumber = input.value.trim().toUpperCase();
    if (!styleNumber) return;

    const row = document.getElementById(`row-${rowId}`);
    const descInput = row.querySelector('[data-field="description"]');
    const pickerWrapper = row.querySelector('.color-picker-wrapper');
    const pickerSelected = row.querySelector('.color-picker-selected');
    const pickerDropdown = row.querySelector('.color-picker-dropdown');

    try {
        // Fetch product data using stylesearch API
        let product = productCache[styleNumber];
        if (!product) {
            const response = await fetch(`${API_BASE}/api/stylesearch?term=${styleNumber}`);
            if (!response.ok) throw new Error(`Style search API returned ${response.status}`);
            const data = await response.json();
            if (data && data.length > 0) {
                // Find exact match or use first result
                const exactMatch = data.find(p => p.value.toUpperCase() === styleNumber);
                const result = exactMatch || data[0];
                product = {
                    STYLE: result.value,
                    PRODUCT_TITLE: result.label
                };
                productCache[styleNumber] = product;
            }
        }

        // Generic fallback: if SanMar lookup failed and style has underscore,
        // strip the suffix and retry (handles pants sizes, fit variants, etc.)
        if (!product && styleNumber.includes('_')) {
            const baseStyle = styleNumber.substring(0, styleNumber.lastIndexOf('_'));
            if (baseStyle) {
                const retryResponse = await fetch(`${API_BASE}/api/stylesearch?term=${baseStyle}`);
                const retryData = await retryResponse.json();
                if (retryData && retryData.length > 0) {
                    const exactMatch = retryData.find(p => p.value.toUpperCase() === baseStyle);
                    const result = exactMatch || retryData[0];
                    product = {
                        STYLE: result.value,
                        PRODUCT_TITLE: result.label
                    };
                    productCache[baseStyle] = product;
                    const strippedSuffix = styleNumber.substring(styleNumber.lastIndexOf('_'));
                    row.dataset.originalPartNumber = styleNumber;
                    input.value = baseStyle;
                    styleNumber = baseStyle;
                    showToast(`${row.dataset.originalPartNumber} → imported as ${baseStyle} (suffix ${strippedSuffix} stripped)`, 'info', 5000);
                }
            }
        }

        if (product) {
            // Pants products (PT20, etc.) are now supported via size picker popup
            // Size category detection will handle waist/inseam sizing

            // Clean product title (remove duplicate style numbers from API response)
            const cleanTitle = cleanProductTitle(product.PRODUCT_TITLE, styleNumber);

            // Update description with clean title
            descInput.value = cleanTitle || styleNumber;

            // Fetch colors using product-colors API (also returns CATEGORY_NAME) — cached per style
            let colorsData;
            if (productColorsCache.has(styleNumber)) {
                colorsData = productColorsCache.get(styleNumber);
            } else {
                const colorsResponse = await fetch(`${API_BASE}/api/product-colors?styleNumber=${styleNumber}`);
                if (!colorsResponse.ok) throw new Error(`Colors API returned ${colorsResponse.status}`);
                colorsData = await colorsResponse.json();
                productColorsCache.set(styleNumber, colorsData);
            }
            const colors = colorsData.colors || [];

            // Store product category from API
            const categoryName = colorsData.CATEGORY_NAME || '';
            row.dataset.category = categoryName;

            // Check for cap products using CATEGORY_NAME (definitive) or pattern matching (fallback)
            const isCap = isCapProduct(styleNumber, product.PRODUCT_TITLE, categoryName);
            const capBadge = document.getElementById(`cap-badge-${rowId}`);
            if (isCap) {
                row.dataset.isCap = 'true';
                if (capBadge) capBadge.style.display = 'inline-flex';
                showToast('Cap detected - using cap embroidery pricing', 'info', 3000);
            } else {
                row.dataset.isCap = 'false';
                if (capBadge) capBadge.style.display = 'none';
                // Warn about mixed orders when adding garments to laser-patch quote
                if (getCapEmbellishmentType() === 'laser-patch') {
                    showToast('Warning: Laser patch embellishment is for caps only. Garments will use standard embroidery pricing.', 'warning', 5000);
                }
            }

            // Reorder row: caps go below garments
            reorderRowByProductType(row);

            // Update logo section visibility based on product types
            updateCapLogoSectionVisibility();
            updateGarmentLogoSectionVisibility();

            if (colors && colors.length > 0) {
                // Populate custom color picker dropdown with swatches
                pickerDropdown.innerHTML = colors.map(c => `
                    <div class="color-picker-option"
                         data-color-name="${escapeHtml(c.COLOR_NAME)}"
                         data-catalog-color="${escapeHtml(c.CATALOG_COLOR || c.COLOR_NAME)}"
                         data-swatch-url="${escapeHtml(c.COLOR_SQUARE_IMAGE || '')}"
                         data-hex="${escapeHtml(c.HEX_CODE || '#ccc')}"
                         data-image-url="${escapeHtml(c.MAIN_IMAGE_URL || c.FRONT_MODEL || c.FRONT_FLAT || '')}"
                         onclick="selectColor(${rowId}, this)">
                        <span class="color-swatch" style="${getSwatchStyle(c)}"></span>
                        <span class="color-name">${escapeHtml(c.COLOR_NAME)}</span>
                    </div>
                `).join('');

                // Enable the picker
                pickerSelected.classList.remove('disabled');

                // Store colors for later (child rows, etc.)
                row.dataset.colors = JSON.stringify(colors);
            }

            // Store product info
            row.dataset.style = styleNumber;
            row.dataset.productName = cleanTitle || styleNumber;

            // Enable "duplicate row" button now that style is loaded
            // (visual states live in quote-builder-common.css .btn-duplicate-row)
            const dupBtn = row.querySelector('.btn-duplicate-row');
            if (dupBtn) dupBtn.disabled = false;

        } else {
            // SanMar product not found — check Non-SanMar Products database
            try {
                const nsResponse = await fetch(`${API_BASE}/api/non-sanmar-products/style/${encodeURIComponent(styleNumber)}`);
                if (nsResponse.ok) {
                    const nsData = await nsResponse.json();
                    if (nsData.success && nsData.data) {
                        populateNonSanmarRow(row, rowId, nsData.data);
                        return;
                    }
                }
            } catch (nsErr) {
                console.warn('[onStyleChange] Non-SanMar lookup failed:', nsErr.message);
            }

            // Not in SanMar or Non-SanMar database — show "Not found" with Add button
            descInput.value = 'Not found';
            showToast(`Style ${styleNumber} not found — click "Add" to register it`, 'warning');

            // Store import data on the row for the Add modal
            row.dataset.style = styleNumber;
            row.dataset.notFound = 'true';

            // Add "Add Product" button below the description
            const descCell = descInput.closest('td') || descInput.parentElement;
            if (descCell && !descCell.querySelector('.btn-add-nonsanmar')) {
                const btnWrap = document.createElement('div');
                btnWrap.className = 'btn-add-nonsanmar-block';
                const addBtn = document.createElement('button');
                addBtn.className = 'btn-add-nonsanmar pulse';
                addBtn.title = 'Add to Non-SanMar database';
                addBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Add Product';
                addBtn.onclick = () => showAddNonSanmarModal(rowId);
                btnWrap.appendChild(addBtn);
                descCell.appendChild(btnWrap);
                // Stop pulse animation after 5s
                setTimeout(() => addBtn.classList.remove('pulse'), 5000);
            }
        }
    } catch (error) {
        console.error('Error loading product:', error);
        showToast('Error loading product', 'error');
    }
}

// escapeHtml() is now provided by quote-builder-utils.js

/**
 * Populate a product row from Non_SanMar_Products data
 */
function populateNonSanmarRow(row, rowId, product) {
    const descInput = row.querySelector('[data-field="description"]');
    const pickerSelected = row.querySelector('.color-picker-selected');
    const pickerDropdown = row.querySelector('.color-picker-dropdown');

    // Set description and mark as non-SanMar
    descInput.value = product.ProductName || product.StyleNumber;
    row.dataset.nonSanmar = 'true';
    row.dataset.sellPrice = product.DefaultSellPrice || 0;
    row.dataset.style = product.StyleNumber;
    row.dataset.productName = product.ProductName || product.StyleNumber;

    // Remove any "Add" button if it existed
    const addBtn = row.querySelector('.btn-add-nonsanmar');
    if (addBtn) addBtn.remove();
    delete row.dataset.notFound;

    // Enable "duplicate row" button for non-SanMar products too
    // (visual states live in quote-builder-common.css .btn-duplicate-row)
    const dupBtn = row.querySelector('.btn-duplicate-row');
    if (dupBtn) dupBtn.disabled = false;

    // Detect cap vs garment
    const isCap = isCapProduct(product.StyleNumber, product.ProductName, product.Category || '');
    const capBadge = document.getElementById(`cap-badge-${rowId}`);
    if (isCap) {
        row.dataset.isCap = 'true';
        if (capBadge) capBadge.style.display = 'inline-flex';
        showToast('Non-SanMar cap detected — using sell price override', 'info', 3000);
    } else {
        row.dataset.isCap = 'false';
        if (capBadge) capBadge.style.display = 'none';
    }

    // Reorder and update section visibility
    reorderRowByProductType(row);
    updateCapLogoSectionVisibility();
    updateGarmentLogoSectionVisibility();

    // Populate color dropdown from DefaultColors (comma-separated text)
    const defaultColors = (product.DefaultColors || '').split(',').map(c => c.trim()).filter(Boolean);
    if (defaultColors.length > 0 && pickerDropdown) {
        pickerDropdown.innerHTML = defaultColors.map(color => `
            <div class="color-picker-option"
                 data-color-name="${escapeHtml(color)}"
                 data-catalog-color="${escapeHtml(color)}"
                 data-swatch-url=""
                 data-hex="#ccc"
                 data-image-url=""
                 onclick="selectNonSanmarColor(${rowId}, this)">
                <span class="color-swatch" style="background-color: #ccc;"></span>
                <span class="color-name">${escapeHtml(color)}</span>
            </div>
        `).join('');

        pickerSelected.classList.remove('disabled');
        row.dataset.colors = JSON.stringify(defaultColors.map(c => ({ COLOR_NAME: c, CATALOG_COLOR: c })));
    }

    // Enable size inputs based on product type
    if (isCap) {
        setNonSanmarCapSizes(row, rowId, product.AvailableSizes);
    } else {
        setNonSanmarGarmentSizes(row, rowId, product.AvailableSizes);
    }

    // Add non-SanMar badge to style cell
    const styleCell = row.querySelector('.style-input')?.closest('td');
    if (styleCell && !styleCell.querySelector('.non-sanmar-badge')) {
        const badge = document.createElement('span');
        badge.className = 'non-sanmar-badge';
        badge.textContent = 'Custom';
        badge.title = 'Non-SanMar product — sell price override';
        styleCell.appendChild(badge);
    }

    // Remove any btn-add-nonsanmar-block wrapper too
    const addBtnBlock = row.querySelector('.btn-add-nonsanmar-block');
    if (addBtnBlock) addBtnBlock.remove();

    // Add pencil icon to price cell for inline editing
    updateNonSanmarPriceCell(row, rowId);
}

/**
 * Update the price cell display for non-SanMar rows with pencil edit affordance.
 * Shows pencil icon for priced items, warning icon for $0 items.
 */
function updateNonSanmarPriceCell(row, rowId) {
    const priceCell = document.getElementById(`row-price-${rowId}`);
    if (!priceCell) return;

    const sellPrice = parseFloat(row.dataset.sellPrice) || 0;
    if (sellPrice > 0) {
        priceCell.innerHTML = `<span class="ns-price-display" onclick="enablePriceOverride(${rowId})" title="Click to edit price">$${sellPrice.toFixed(2)} <i class="fas fa-pencil-alt"></i></span>`;
        priceCell.classList.remove('ns-price-zero');
    } else {
        priceCell.innerHTML = `<span class="ns-price-display" onclick="enablePriceOverride(${rowId})" title="Click to set price">$0.00 &#9888; <i class="fas fa-pencil-alt"></i></span>`;
        priceCell.classList.add('ns-price-zero');
        row.classList.add('price-warning');
    }
}

/**
 * Select color for non-SanMar product (simpler than SanMar — no swatch images)
 */
function selectNonSanmarColor(rowId, optionEl) {
    const row = document.getElementById(`row-${rowId}`);
    const colorName = optionEl.dataset.colorName;

    // Update selected display
    const pickerSelected = row.querySelector('.color-picker-selected');
    const swatch = pickerSelected.querySelector('.color-swatch');
    const nameSpan = pickerSelected.querySelector('.color-name');
    swatch.style.backgroundImage = '';
    swatch.style.backgroundColor = '#ccc';
    swatch.classList.remove('empty');
    nameSpan.textContent = colorName;
    nameSpan.classList.remove('placeholder');

    // Mark selected
    row.querySelectorAll('.color-picker-option').forEach(opt => opt.classList.remove('selected'));
    optionEl.classList.add('selected');

    // Store on row
    row.dataset.color = colorName;
    row.dataset.catalogColor = colorName;

    // Close dropdown
    row.querySelector('.color-picker-dropdown').classList.add('hidden');

    // Enable size inputs (non-SanMar skips detectAndAdjustSizeUI API call)
    row.querySelectorAll('.size-input').forEach(input => input.disabled = false);

    // For caps, keep only OSFA enabled
    if (row.dataset.isCap === 'true') {
        setNonSanmarCapSizes(row, rowId, row.dataset.availableSizes || 'OSFA');
    }

    // Focus first size input
    const firstSize = row.querySelector('.size-input:not([disabled])');
    if (firstSize) firstSize.focus();

    // Cascade to child rows
    cascadeColorToChildRows(rowId, colorName, colorName, '', '#ccc');
    recalculatePricing();
}

/**
 * Set cap sizes for non-SanMar products (default: OSFA only)
 */
function setNonSanmarCapSizes(row, rowId, availableSizes) {
    const sizes = (availableSizes || 'OSFA').split(',').map(s => s.trim().toUpperCase());
    row.dataset.availableSizes = sizes.join(',');

    // Disable all size inputs first
    row.querySelectorAll('.size-input').forEach(input => input.disabled = true);

    // Enable only the available sizes
    sizes.forEach(size => {
        const input = row.querySelector(`[data-size="${size}"]`);
        if (input) input.disabled = false;
    });
}

/**
 * Set garment sizes for non-SanMar products (default: S-3XL)
 */
function setNonSanmarGarmentSizes(row, rowId, availableSizes) {
    const defaultSizes = 'S,M,L,XL,2XL,3XL';
    const sizes = (availableSizes || defaultSizes).split(',').map(s => s.trim().toUpperCase());
    row.dataset.availableSizes = sizes.join(',');

    // Enable standard sizes
    row.querySelectorAll('.size-input').forEach(input => {
        const size = input.dataset.size;
        input.disabled = !sizes.includes(size);
    });
}

/**
 * Parse ShopWorks description to extract brand, product name, color, and category
 * Patterns:
 *   "Kitchen Skull Cap: Edwards, Black" → Brand: Edwards, Name: Kitchen Skull Cap, Color: Black
 *   "Port Authority Soft Brushed Canvas Cap" → Brand: Port Authority, Name: rest
 */
function parseShopWorksDescription(description, partNumber) {
    const result = { brand: '', name: '', color: '', category: '' };
    if (!description) return result;

    const desc = description.trim();

    // Pattern 1: "ProductName: Brand, Color" (colon format)
    const colonMatch = desc.match(/^(.+?):\s*(.+?)(?:,\s*(.+))?$/);
    if (colonMatch) {
        result.name = colonMatch[1].trim();
        result.brand = colonMatch[2].trim();
        result.color = (colonMatch[3] || '').trim();
    } else {
        // Pattern 2: Known brand prefix
        const knownBrands = ['Port Authority', 'Port & Company', 'Sport-Tek', 'CornerStone',
            'The North Face', 'Nike', 'Carhartt', 'Brooks Brothers', 'TravisMathew',
            'Under Armour', 'New Era', 'OGIO', 'Red House', 'Mercer+Mettle',
            'Edwards', 'Richardson', 'Outdoor Cap', 'Pacific Headwear'];

        let matched = false;
        for (const brand of knownBrands) {
            if (desc.toLowerCase().startsWith(brand.toLowerCase())) {
                result.brand = brand;
                const rest = desc.substring(brand.length).replace(/^\s+/, '');
                // Check for trailing color after comma
                const commaIdx = rest.lastIndexOf(',');
                if (commaIdx > 0) {
                    result.name = rest.substring(0, commaIdx).trim();
                    result.color = rest.substring(commaIdx + 1).trim();
                } else {
                    result.name = rest;
                }
                matched = true;
                break;
            }
        }

        if (!matched) {
            // Fallback: check for trailing color after last comma
            const commaIdx = desc.lastIndexOf(',');
            if (commaIdx > 0) {
                result.name = desc.substring(0, commaIdx).trim();
                const possibleColor = desc.substring(commaIdx + 1).trim();
                if (isCommonColor(possibleColor)) {
                    result.color = possibleColor;
                } else {
                    result.name = desc; // Not a color, keep full desc
                }
            } else {
                result.name = desc;
            }
        }
    }

    // Category detection from keywords
    const combined = `${result.name} ${desc}`.toLowerCase();
    if (/\b(cap|hat|beanie|visor|snapback|trucker|headwear|skull cap)\b/.test(combined)) {
        result.category = 'Caps';
    } else if (/\b(tee|t-shirt|tshirt)\b/.test(combined)) {
        result.category = 'T-Shirts';
    } else if (/\b(polo|pique)\b/.test(combined)) {
        result.category = 'Polos/Knits';
    } else if (/\b(jacket|coat|parka|outerwear)\b/.test(combined)) {
        result.category = 'Outerwear';
    } else if (/\b(fleece|hoodie|hooded|sweatshirt|pullover)\b/.test(combined)) {
        result.category = 'Fleece';
    } else if (/\b(button|dress shirt|oxford|woven)\b/.test(combined)) {
        result.category = 'Woven Shirts';
    }

    return result;
}

/**
 * Check if a string is a common garment color name
 */
function isCommonColor(str) {
    const colors = ['black', 'white', 'navy', 'royal', 'red', 'grey', 'gray', 'charcoal',
        'khaki', 'tan', 'brown', 'green', 'olive', 'blue', 'pink', 'purple', 'orange',
        'yellow', 'teal', 'burgundy', 'maroon', 'cream', 'ivory', 'silver', 'gold',
        'heather', 'camo', 'natural', 'stone', 'steel', 'slate', 'smoke', 'iron'];
    return colors.some(c => str.toLowerCase().includes(c));
}

/**
 * Update product thumbnail when color is selected
 */
function updateProductThumbnail(rowId, imageUrl, productName, styleNumber, colorName) {
    const thumbContainer = document.getElementById(`thumb-${rowId}`);
    if (!thumbContainer) return;

    if (imageUrl) {
        // Replace placeholder with actual thumbnail
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = productName || styleNumber;
        img.className = 'product-thumbnail';
        img.onclick = () => {
            if (window.productThumbnailModal) {
                productThumbnailModal.open(imageUrl, productName, styleNumber, colorName);
            }
        };
        img.onerror = () => {
            img.classList.add('no-image');
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        };

        thumbContainer.replaceWith(img);
        img.id = `thumb-${rowId}`;
    }
}

/**
 * cleanProductTitle() — now provided by quote-builder-utils.js
 */

// Position abbreviation mapping for compact breakdown display
const POSITION_ABBREV = {
    'Left Chest': 'LC', 'Right Chest': 'RC', 'Center Chest': 'CC',
    'Full Front': 'FF', 'Full Back': 'FB', 'Upper Back': 'UB',
    'Left Sleeve': 'LS', 'Right Sleeve': 'RS',
    'CF': 'CF', 'CB': 'CB', 'CL': 'CL', 'CR': 'CR',
    'Cap Front': 'CF', 'Cap Back': 'CB'
};

// Full names for tooltip display
const POSITION_FULL_NAMES = {
    'LC': 'Left Chest', 'RC': 'Right Chest', 'CC': 'Center Chest',
    'FF': 'Full Front', 'FB': 'Full Back', 'UB': 'Upper Back',
    'LS': 'Left Sleeve', 'RS': 'Right Sleeve',
    'CF': 'Cap Front', 'CB': 'Cap Back', 'CL': 'Cap Left Side', 'CR': 'Cap Right Side'
};

// formatPrice() is now provided by quote-builder-utils.js

/**
 * Build pricing breakdown HTML for a product row
 * Shows compact format: └─ LC 10K | Base $23 + Extra $2.50 = $25.50/ea
 * Includes hover tooltip with full calculation details
 *
 * @param {Object} product - Product data with isCap flag
 * @param {Object} lineItem - Line item from pricing calculator
 * @param {Object} logoConfig - Logo configuration (position, stitchCount)
 * @returns {string} HTML string for breakdown
 */
function buildPricingBreakdown(product, lineItem, logoConfig) {
    if (!lineItem) return '';

    const isCap = product?.isCap || false;
    const logoPos = logoConfig?.position || (isCap ? 'CF' : 'Left Chest');
    const stitchCount = logoConfig?.stitchCount || 8000;
    const stitchK = Math.round(stitchCount / 1000);

    // Check if this is a cap with laser-patch embellishment
    const capEmbellishment = isCap ? getCapEmbellishmentType() : null;
    const isLaserPatch = isCap && capEmbellishment === 'laser-patch';

    // Get abbreviated position name
    const posAbbrev = POSITION_ABBREV[logoPos] || logoPos.substring(0, 2).toUpperCase();
    const posFullName = POSITION_FULL_NAMES[posAbbrev] || logoPos;

    const basePrice = lineItem.basePrice || 0;
    const extraStitchCost = lineItem.extraStitchCost || 0;
    const alCost = lineItem.alCost || 0;
    const unitPrice = lineItem.unitPrice || 0;

    // Calculate extra stitches for tooltip
    const baseStitches = isCap ? 8000 : 8000;
    const extraK = stitchCount > baseStitches ? Math.round((stitchCount - baseStitches) / 1000) : 0;
    const rate = isCap ? 1.00 : 1.25;

    // Build tooltip text with full formula (&#10; = newline in title attribute)
    let tooltipParts = [];
    if (isLaserPatch) {
        // Laser patch tooltip - no stitches
        tooltipParts = [`Type: Laser Leatherette Patch`, `Position: Cap Front`];
    } else {
        tooltipParts = [`Position: ${posFullName}`, `Stitches: ${stitchCount.toLocaleString()}`];
    }
    tooltipParts.push(`Base: $${basePrice.toFixed(2)}`);
    if (extraStitchCost > 0 && !isLaserPatch) {
        tooltipParts.push(`Extra: ${extraK}K × $${rate.toFixed(2)} = $${extraStitchCost.toFixed(2)}`);
    }
    if (alCost > 0) {
        tooltipParts.push(`AL: $${alCost.toFixed(2)}`);
    }
    tooltipParts.push(`Unit: $${unitPrice.toFixed(2)}`);
    const tooltipText = tooltipParts.join('&#10;');

    // Build visible breakdown with compact format
    let html = `<span class="breakdown-wrapper" title="${tooltipText}">`;
    html += `<span class="breakdown-icon">└─</span>`;
    // For laser patches, show "Laser Patch" instead of stitch count
    if (isLaserPatch) {
        html += `<span class="breakdown-pos">Laser Patch</span>`;
    } else {
        html += `<span class="breakdown-pos">${posAbbrev} ${stitchK}K</span>`;
    }

    // CHANGED 2026-01-14: Show BASE price only (extra stitches and AL are separate sidebar line items)
    // Show base price with optional upcharge note
    if (lineItem.hasUpcharge && lineItem.upcharge > 0) {
        // Extended size with upcharge - show breakdown
        html += ` <span class="breakdown-sep">|</span> `;
        html += `<span class="breakdown-base">Base $${formatPrice(basePrice - lineItem.upcharge)} + Upcharge $${formatPrice(lineItem.upcharge)}</span>`;
        html += ` <span class="breakdown-eq">=</span> `;
        html += `<span class="breakdown-total">$${formatPrice(basePrice)}/ea</span>`;
    } else {
        // Standard size - just show base price
        html += ` <span class="breakdown-sep">|</span> <span class="breakdown-total">$${formatPrice(basePrice)}/ea</span>`;
    }

    html += `</span>`;
    return html;
}

/**
 * Update the pricing breakdown display for a product row
 * @param {number} rowId - Row ID
 * @param {Object} product - Product data
 * @param {Object} lineItem - Line item from pricing calculator
 * @param {Object} logoConfig - Logo configuration
 */
function updateRowBreakdown(rowId, product, lineItem, logoConfig) {
    const breakdownEl = document.getElementById(`breakdown-${rowId}`);
    if (!breakdownEl) return;

    const breakdownHtml = buildPricingBreakdown(product, lineItem, logoConfig);
    if (breakdownHtml) {
        breakdownEl.innerHTML = breakdownHtml;
        breakdownEl.classList.add('visible');
    } else {
        breakdownEl.innerHTML = '';
        breakdownEl.classList.remove('visible');
    }
}

/**
 * Check if a style number is a cap/hat product
 * @param {string} style - Style number
 * @param {string} productTitle - Product title/description
 * @param {string} categoryName - CATEGORY_NAME from SanMar API (most reliable)
 * @returns {boolean} True if cap/hat
 */
function isCapProduct(style, productTitle = '', categoryName = '') {
    // PRIORITY: Flat headwear (beanies, knit caps) use garment pricing, NOT cap pricing
    // Matches ProductCategoryFilter used by calculator pages
    if (typeof ProductCategoryFilter !== 'undefined' && productTitle) {
        if (ProductCategoryFilter.isFlatHeadwear({ PRODUCT_TITLE: productTitle })) {
            return false;
        }
    }

    // BEST METHOD: Check CATEGORY_NAME from SanMar API
    // SanMar categorizes all caps/hats under "Caps" category
    if (categoryName && categoryName.toLowerCase() === 'caps') {
        return true;
    }

    // FALLBACK: Pattern matching for cases where category isn't available
    if (!style) return false;
    const styleUpper = style.toUpperCase();
    const titleUpper = (productTitle || '').toUpperCase();

    // Check style patterns:
    // CP* caps (CP80, CP90, etc)
    // NE* caps (NE1000, NE400)
    // C+digit (C112, C118)
    // Richardson styles (112, 110, 115, etc) - numeric only
    if (/^C[P0-9]/.test(styleUpper) || styleUpper.startsWith('NE')) {
        return true;
    }

    // Richardson caps - 2-3 digit numeric styles (100-999)
    if (/^\d{2,3}$/.test(styleUpper)) {
        return true;
    }

    // Check title keywords — but first strip DECG/service prefixes so
    // "Di. Embroider Cap - T-shirt" doesn't match on "Cap" in the prefix
    const strippedTitle = titleUpper.replace(/^DI\.\s*EMBROIDER\s+(CAP|GARMENT)\s*-\s*/i, '');
    if (strippedTitle.includes('CAP') || strippedTitle.includes('HAT') ||
        strippedTitle.includes('BEANIE') || strippedTitle.includes('SNAPBACK') ||
        strippedTitle.includes('TRUCKER') || strippedTitle.includes('RICHARDSON')) {
        return true;
    }

    return false;
}

/**
 * Check if product is pants (waist/inseam sizing not supported)
 * @param {string} style - Style number
 * @param {string} productTitle - Product title/description
 * @returns {boolean} True if pants
 */
function isPantsProduct(style, productTitle = '') {
    if (!style) return false;
    const styleUpper = style.toUpperCase();
    const titleUpper = (productTitle || '').toUpperCase();

    // Red Kap work pants (PT prefix)
    if (styleUpper.startsWith('PT') && /^PT\d/.test(styleUpper)) return true;

    // Title keywords for pants
    if (titleUpper.includes('PANT') || titleUpper.includes('WORK PANT') ||
        titleUpper.includes('CARGO') || titleUpper.includes('TROUSER') ||
        titleUpper.includes('INDUSTRIAL PANT')) {
        return true;
    }

    return false;
}

/**
 * Analyze available sizes and determine the product's size category
 * Handles OSFA, combo sizes, youth, toddler, tall, and standard products
 * @param {string[]} availableSizes - Array of available sizes from API
 * @returns {Object} Category info with display configuration
 */
function analyzeSizeCategory(availableSizes) {
    if (!availableSizes || availableSizes.length === 0) {
        return { category: 'unknown', columns: [], useQtyOnly: false };
    }

    const sizes = availableSizes.map(s => s.toUpperCase());
    const STANDARD = ['S', 'M', 'L', 'XL'];
    const COMBO = ['S/M', 'M/L', 'L/XL', 'XS/S', 'X/2X'];
    const YOUTH = ['YXS', 'YS', 'YM', 'YL', 'YXL'];
    const TODDLER = ['2T', '3T', '4T', '5T', '5/6T', '6T'];
    const TALL = ['LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT', 'ST', 'MT'];
    const ONE_SIZE = ['OSFA', 'OSFM'];
    const PANTS_PATTERN = /^\d{4}$/;  // 4-digit waist/inseam codes like 2737, 2830
    const WAIST_ONLY_PATTERN = /^W\d{2}$/;  // Waist-only codes like W30, W32 (PT66 shorts)

    // Count sizes in each category for dominant detection
    const youthCount = sizes.filter(s => YOUTH.includes(s)).length;
    const toddlerCount = sizes.filter(s => TODDLER.includes(s)).length;
    const tallCount = sizes.filter(s => TALL.includes(s)).length;
    const comboCount = sizes.filter(s => COMBO.includes(s)).length;
    const osfaCount = sizes.filter(s => ONE_SIZE.includes(s)).length;
    const standardCount = sizes.filter(s => STANDARD.includes(s)).length;
    const pantsCount = sizes.filter(s => PANTS_PATTERN.test(s)).length;
    const waistOnlyCount = sizes.filter(s => WAIST_ONLY_PATTERN.test(s)).length;

    // Priority 1a: Waist-only shorts (W30, W32, etc. - PT66, CT103542)
    if (waistOnlyCount > 0 && waistOnlyCount >= sizes.length / 2) {
        // Extract all valid waist-only sizes
        const waistSizes = sizes.filter(s => WAIST_ONLY_PATTERN.test(s));
        return {
            category: 'shorts',
            columns: [],
            useQtyOnly: false,
            shortsSizes: waistSizes,
            baseSize: waistSizes[0],
            message: 'Select waist sizes'
        };
    }

    // Priority 1b: Pants (waist/inseam sizes like 3032 for 30x32)
    if (pantsCount > 0 && pantsCount >= sizes.length / 2) {
        // Extract all valid pants sizes (4-digit codes)
        const pantsSizes = sizes.filter(s => PANTS_PATTERN.test(s));
        return {
            category: 'pants',
            columns: [],
            useQtyOnly: false,
            pantsSizes: pantsSizes,
            baseSize: pantsSizes[0],
            message: 'Select waist/inseam sizes'
        };
    }

    // Priority 2: OSFA-only (caps, bags, beanies)
    if (osfaCount > 0 && osfaCount === sizes.length) {
        return {
            category: 'osfa-only',
            columns: [],
            useQtyOnly: true,
            baseSize: sizes[0],
            message: 'One Size Fits All'
        };
    }

    // Priority 3: Combo-only (fitted caps like NE1000)
    if (comboCount > 0 && comboCount === sizes.length) {
        return {
            category: 'combo-only',
            columns: sizes,
            useQtyOnly: false,
            baseSize: sizes[0]
        };
    }

    // Priority 4: Youth-dominant (has youth sizes AND more youth than standard)
    // PC61Y returns both S,M,L,XL AND YS,YM,YL,YXL - youth should win
    if (youthCount > 0 && youthCount >= standardCount) {
        return {
            category: 'youth-only',
            columns: YOUTH.filter(y => sizes.includes(y)),
            useQtyOnly: false,
            baseSize: sizes.find(s => YOUTH.includes(s)) || sizes[0]
        };
    }

    // Priority 5: Toddler-dominant
    if (toddlerCount > 0 && toddlerCount >= standardCount) {
        return {
            category: 'toddler-only',
            columns: TODDLER.filter(t => sizes.includes(t)),
            useQtyOnly: false,
            baseSize: sizes.find(s => TODDLER.includes(s)) || sizes[0]
        };
    }

    // Priority 6: Tall-dominant (LT, XLT without S, M, L, XL)
    if (tallCount > 0 && standardCount === 0) {
        return {
            category: 'tall-only',
            columns: sizes.filter(s => TALL.includes(s) || s === '2XL'),
            useQtyOnly: false,
            baseSize: sizes.find(s => TALL.includes(s)) || sizes[0]
        };
    }

    // Priority 7: Standard (has S, M, L, XL as dominant)
    if (standardCount > 0) {
        return {
            category: 'standard',
            columns: ['S', 'M', 'L', 'XL', '2XL'],
            useQtyOnly: false,
            baseSize: 'S',
            extendedSizes: sizes.filter(s => !STANDARD.includes(s) && s !== '2XL')
        };
    }

    // Fallback for unknown patterns
    return {
        category: 'other',
        columns: sizes.slice(0, 5),
        useQtyOnly: false,
        baseSize: sizes[0]
    };
}

/**
 * Update row UI based on size category
 * Handles OSFA (single qty input), combo sizes, and other non-standard layouts
 * @param {HTMLElement} row - The product row element
 * @param {Object} sizeInfo - Result from analyzeSizeCategory()
 */
function updateRowForSizeCategory(row, sizeInfo) {
    const rowId = row.dataset.rowId;
    const sizeInputs = row.querySelectorAll('.size-input:not(.xxxl-picker-btn)');
    const xxxlCell = row.querySelector('.xxxl-picker-btn');

    // Store category info for later use
    row.dataset.sizeCategory = sizeInfo.category;
    row.dataset.baseSize = sizeInfo.baseSize || '';

    // Handle PANTS (waist/inseam sizes) - use size picker popup
    if (sizeInfo.category === 'pants') {
        // Disable all size columns (parent row doesn't take quantities)
        sizeInputs.forEach(input => {
            input.disabled = true;
            input.value = '';
            input.placeholder = '-';
            input.closest('td').classList.add('size-disabled');
        });

        // Enable XXXL cell as "Select Sizes" picker button
        if (xxxlCell && sizeInfo.pantsSizes && sizeInfo.pantsSizes.length > 0) {
            row.dataset.pantsSizes = JSON.stringify(sizeInfo.pantsSizes);
            row.dataset.extendedSizes = JSON.stringify(sizeInfo.pantsSizes); // For compatibility
            xxxlCell.classList.add('pants-picker-btn');
            xxxlCell.disabled = false;
            xxxlCell.placeholder = '+';
            xxxlCell.closest('td').classList.remove('size-disabled');
        } else if (xxxlCell) {
            xxxlCell.disabled = true;
            xxxlCell.placeholder = '-';
            xxxlCell.closest('td').classList.add('size-disabled');
        }

        row.classList.add('pants-row');
        row.classList.add('non-standard-sizes');
        showToast('Pants product - click + to select waist/inseam sizes', 'info', 4000);
        return;
    }

    // Handle SHORTS (waist-only sizes like W30, W32) - use size picker popup
    if (sizeInfo.category === 'shorts') {
        // Disable all size columns (parent row doesn't take quantities)
        sizeInputs.forEach(input => {
            input.disabled = true;
            input.value = '';
            input.placeholder = '-';
            input.closest('td').classList.add('size-disabled');
        });

        // Enable XXXL cell as "Select Sizes" picker button
        if (xxxlCell && sizeInfo.shortsSizes && sizeInfo.shortsSizes.length > 0) {
            row.dataset.shortsSizes = JSON.stringify(sizeInfo.shortsSizes);
            row.dataset.extendedSizes = JSON.stringify(sizeInfo.shortsSizes); // For compatibility
            row.dataset.sizeCategory = 'shorts'; // Ensure category is set
            xxxlCell.classList.add('shorts-picker-btn');
            xxxlCell.disabled = false;
            xxxlCell.placeholder = '+';
            xxxlCell.closest('td').classList.remove('size-disabled');
        } else if (xxxlCell) {
            xxxlCell.disabled = true;
            xxxlCell.placeholder = '-';
            xxxlCell.closest('td').classList.add('size-disabled');
        }

        row.classList.add('shorts-row');
        row.classList.add('non-standard-sizes');
        showToast('Shorts product - click + to select waist sizes', 'info', 4000);
        return;
    }

    if (sizeInfo.useQtyOnly) {
        // OSFA-only: Hide all size columns, convert to single qty input
        sizeInputs.forEach(input => {
            input.disabled = true;
            input.value = '';
            input.placeholder = '-';
            input.closest('td').classList.add('size-disabled');
        });

        // Convert XXXL cell to qty input for OSFA
        if (xxxlCell) {
            xxxlCell.classList.remove('xxxl-picker-btn');
            xxxlCell.classList.add('osfa-qty-input');
            xxxlCell.removeAttribute('readonly');
            xxxlCell.type = 'number';
            xxxlCell.min = '0';
            xxxlCell.placeholder = 'Qty';
            xxxlCell.value = '';
            xxxlCell.disabled = false;
            xxxlCell.onclick = null;
            xxxlCell.onkeydown = null;
            xxxlCell.onchange = () => onOSFAQtyChange(rowId);
            xxxlCell.closest('td').classList.remove('size-disabled');
        }

        // Update header for this row (visual indicator)
        row.classList.add('osfa-only-row');

    } else if (sizeInfo.category === 'tall-only') {
        // TALL products: All sizes via extended size popup (like OSFA but with size picker)
        // Parent row has disabled columns; child rows handle each tall size
        const ALL_TALL = ['LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT'];
        const availableTallSizes = ALL_TALL.filter(s => sizeInfo.columns.includes(s));

        // Disable ALL size columns (parent row doesn't take quantities)
        sizeInputs.forEach((input, index) => {
            input.disabled = true;
            input.value = '';
            input.placeholder = '-';
            input.closest('td').classList.add('size-disabled');
        });

        // Enable XXXL picker for ALL tall sizes
        if (availableTallSizes.length > 0 && xxxlCell) {
            row.dataset.extendedSizes = JSON.stringify(availableTallSizes);
            xxxlCell.disabled = false;
            xxxlCell.placeholder = '+';
            xxxlCell.closest('td').classList.remove('size-disabled');
        } else if (xxxlCell) {
            xxxlCell.disabled = true;
            xxxlCell.placeholder = '-';
            xxxlCell.closest('td').classList.add('size-disabled');
        }

        row.classList.add('non-standard-sizes');
        row.classList.add('tall-only-row');

    } else if (sizeInfo.category !== 'standard' && sizeInfo.category !== 'unknown') {
        // Non-standard columns (combo, youth, toddler)
        const columns = sizeInfo.columns;

        sizeInputs.forEach((input, index) => {
            if (index < columns.length) {
                // Remap this column to new size
                const newSize = columns[index];
                input.dataset.size = newSize;
                input.disabled = false;
                input.placeholder = '0';
                input.closest('td').classList.remove('size-disabled');

                // Update column header visually
                updateColumnLabel(row, index, newSize);
            } else {
                // Hide extra columns
                input.disabled = true;
                input.value = '';
                input.placeholder = '-';
                input.closest('td').classList.add('size-disabled');
            }
        });

        // Handle XXXL picker based on extended sizes
        if (!sizeInfo.extendedSizes || sizeInfo.extendedSizes.length === 0) {
            if (xxxlCell) {
                xxxlCell.disabled = true;
                xxxlCell.placeholder = '-';
                xxxlCell.closest('td').classList.add('size-disabled');
            }
        }

        // Add visual indicator class
        row.classList.add('non-standard-sizes');
    }
    // Standard category keeps default UI
}

/**
 * Update column label for a specific row's size input
 * Creates inline label overlay showing the actual size name
 */
function updateColumnLabel(row, colIndex, newLabel) {
    const sizeInputs = row.querySelectorAll('.size-input:not(.xxxl-picker-btn)');
    const input = sizeInputs[colIndex];
    if (!input) return;

    const td = input.closest('td');

    // Add a label overlay showing the size
    let label = td.querySelector('.size-label-override');
    if (!label) {
        label = document.createElement('span');
        label.className = 'size-label-override';
        td.insertBefore(label, input);
    }
    label.textContent = newLabel;
}

/**
 * Handle quantity change for OSFA-only products
 * Updates dataset, qty display, and triggers pricing recalculation
 */
function onOSFAQtyChange(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    const osfaInput = row.querySelector('.osfa-qty-input');
    const qty = parseInt(osfaInput?.value) || 0;

    // Store OSFA qty in dataset
    row.dataset.osfaQty = qty;
    row.dataset.isOsfaOnly = 'true';

    // Update qty display
    const qtyDisplay = document.getElementById(`row-qty-${rowId}`);
    if (qtyDisplay) qtyDisplay.textContent = qty;

    // Trigger pricing recalculation
    recalculatePricing();
}

/**
 * Fetch available sizes and adjust UI based on product type
 * Called after color selection to determine proper size columns
 */
async function detectAndAdjustSizeUI(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    const styleNumber = row.dataset.style;
    const catalogColor = row.dataset.catalogColor;

    if (!styleNumber || !catalogColor) return;

    // Stale guard: if the rep changes style/color while a lookup is in flight, the
    // older response must NOT overwrite the newer row state. Checked after each await.
    const isStale = () => row.dataset.style !== styleNumber || row.dataset.catalogColor !== catalogColor;

    // =========================================
    // CAP SPECIAL HANDLING
    // Caps use /api/sizes-by-style-color endpoint
    // =========================================
    if (row.dataset.isCap === 'true') {
        try {
            const capCacheKey = `cap-${styleNumber}-${catalogColor}`;
            if (sizeDetectionCache.has(capCacheKey)) {
                const cached = sizeDetectionCache.get(capCacheKey);
                const sizeInfo = analyzeSizeCategory(cached);
                updateRowForSizeCategory(row, sizeInfo);
                row.dataset.availableSizes = JSON.stringify(cached);
                row.dataset.capSizes = JSON.stringify(cached);
                return;
            }

            const capUrl = `${API_BASE}/api/sizes-by-style-color?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(catalogColor)}`;
            const capResponse = await fetch(capUrl);
            if (isStale()) return;

            let capSizes = ['OSFA']; // Default fallback
            if (capResponse.ok) {
                const capData = await capResponse.json();
                const sizes = capData.data || capData.sizes || capData;
                if (Array.isArray(sizes) && sizes.length > 0) {
                    capSizes = sizes;
                }
            } else {
                console.warn(`[Cap Sizes] API failed for ${styleNumber}, using OSFA fallback`);
                showToast(`Cap sizes unavailable for ${styleNumber}, defaulting to OSFA`, 'warning');
            }


            // Cache and update UI
            sizeDetectionCache.set(capCacheKey, capSizes);
            const sizeInfo = analyzeSizeCategory(capSizes);

            updateRowForSizeCategory(row, sizeInfo);
            row.dataset.availableSizes = JSON.stringify(capSizes);
            row.dataset.capSizes = JSON.stringify(capSizes);
            return; // Exit - cap handling complete
        } catch (capError) {
            console.error('[Cap Sizes] Error fetching cap sizes:', capError);
            // Fall through to use OSFA
            const osfaInfo = { category: 'osfa-only', columns: [], useQtyOnly: true, baseSize: 'OSFA', message: 'One Size Fits All' };
            updateRowForSizeCategory(row, osfaInfo);
            row.dataset.availableSizes = JSON.stringify(['OSFA']);
            row.dataset.capSizes = JSON.stringify(['OSFA']);
            return;
        }
    }

    // =========================================
    // STANDARD GARMENT HANDLING
    // =========================================
    const garmentCacheKey = `garment-${styleNumber}-${catalogColor}`;
    if (sizeDetectionCache.has(garmentCacheKey)) {
        const cached = sizeDetectionCache.get(garmentCacheKey);
        const sizeInfo = analyzeSizeCategory(cached);
        updateRowForSizeCategory(row, sizeInfo);
        row.dataset.availableSizes = JSON.stringify(cached);
        validateSizeAvailability(row, cached);
        return;
    }

    try {
        // Fetch all available sizes for this style+color
        const url = `${API_BASE}/api/sanmar-shopworks/import-format?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(catalogColor)}`;
        const response = await fetch(url);
        if (isStale()) return;

        if (!response.ok) {
            console.error(`[Size Detection] API failed for ${styleNumber}:`);
            console.error(`  Status: ${response.status} ${response.statusText}`);
            console.error(`  URL: ${url}`);
            console.error(`  CatalogColor: ${catalogColor}`);

            // Try fallback: fetch without color filter to at least get size info
            try {
                const altUrl = `${API_BASE}/api/sanmar-shopworks/import-format?styleNumber=${encodeURIComponent(styleNumber)}`;
                const altResponse = await fetch(altUrl);
                if (isStale()) return;

                if (altResponse.ok) {
                    const skus = await altResponse.json();
                    if (skus && skus.length > 0) {
                        const allSizes = extractAllSizes(skus);
                        const sizeInfo = analyzeSizeCategory(allSizes);
                        updateRowForSizeCategory(row, sizeInfo);
                        row.dataset.availableSizes = JSON.stringify(allSizes);
                        showToast(`Size check for ${styleNumber} used style-level data (color lookup failed) — some sizes may not exist in ${row.dataset.color || 'this color'}.`, 'warning', 6000);
                        return;
                    }
                }
            } catch (fallbackError) {
                console.error('[Size Detection] Fallback also failed:', fallbackError);
            }
            // Both lookups failed — the row keeps the default S–XL+extended grid, which may
            // not map to real SKUs for this product. Say so (Erik's #1 rule: never silent).
            showToast(`Couldn't verify available sizes for ${styleNumber} — using the standard size grid. Double-check sizes before saving.`, 'warning', 7000);
            return;
        }

        const skus = await response.json();

        // Extract ALL available sizes (not just Size06)
        const allSizes = extractAllSizes(skus);

        // Cache for future use (same style+color won't re-fetch)
        sizeDetectionCache.set(garmentCacheKey, allSizes);

        // Analyze and update UI
        const sizeInfo = analyzeSizeCategory(allSizes);

        updateRowForSizeCategory(row, sizeInfo);

        // Store for pricing calculations
        row.dataset.availableSizes = JSON.stringify(allSizes);

        // Validate size availability using SKU service
        validateSizeAvailability(row, allSizes);

    } catch (error) {
        console.error('Error detecting size category:', error);
    }
}

/**
 * Validate size availability and update UI indicators
 * Uses SKUValidationService to check which sizes exist in ShopWorks
 *
 * @param {HTMLElement} row - Product row element
 * @param {string[]} availableSizes - Sizes available for this product/color
 */
function validateSizeAvailability(row, availableSizes) {
    if (!row || !availableSizes) return;

    const styleNumber = row.dataset.style;
    const catalogColor = row.dataset.catalogColor;
    const skuService = window.skuValidationService || new SKUValidationService();
    window.skuValidationService = skuService; // Cache for reuse

    // Get all size inputs in this row
    const sizeInputs = row.querySelectorAll('.size-input:not(.xxxl-picker-btn)');
    const xxxlCell = row.querySelector('.xxxl-picker-btn');

    // Standard size columns (S, M, L, XL, XXL)
    const columnSizes = ['S', 'M', 'L', 'XL', '2XL'];

    sizeInputs.forEach((input, index) => {
        const size = columnSizes[index];
        if (!size) return;

        const isAvailable = availableSizes.includes(size);
        const sku = skuService.sanmarToShopWorksSKU(styleNumber, size);

        // Update input state based on availability
        if (isAvailable) {
            input.classList.add('size-available');
            input.classList.remove('size-unavailable');
            input.disabled = false;
            input.placeholder = '0';
            input.title = `${size} (SKU: ${sku})`;
        } else {
            input.classList.add('size-unavailable');
            input.classList.remove('size-available');
            input.disabled = true;
            input.value = '';
            input.placeholder = 'N/A';
            input.title = `${size} not available for this style/color`;
            input.closest('td')?.classList.add('size-disabled');
        }

        // Store SKU on input for reference
        input.dataset.sku = sku;
    });

    // Update extended size picker (XXXL column) if present
    if (xxxlCell && !xxxlCell.classList.contains('osfa-qty-input')) {
        const extendedSizes = availableSizes.filter(s =>
            !columnSizes.includes(s) && s !== 'OSFA'
        );
        const hasExtended = extendedSizes.length > 0;

        if (hasExtended) {
            xxxlCell.classList.remove('size-unavailable');
            xxxlCell.disabled = false;
            xxxlCell.title = `Extended sizes: ${extendedSizes.join(', ')}`;
            row.dataset.extendedSizes = JSON.stringify(extendedSizes);
        } else {
            xxxlCell.classList.add('size-unavailable');
            xxxlCell.disabled = true;
            xxxlCell.placeholder = '-';
            xxxlCell.title = 'No extended sizes available';
        }
    }

}

/**
 * Extract ALL sizes from SKU data (Size01-06 fields)
 * Returns sizes in logical display order
 */
function extractAllSizes(skus) {
    const sizes = new Set();

    skus.forEach(sku => {
        ['Size01', 'Size02', 'Size03', 'Size04', 'Size05', 'Size06'].forEach(field => {
            if (sku[field] && typeof sku[field] === 'string' && sku[field].trim()) {
                sizes.add(sku[field].trim());
            }
        });
    });

    // Return in logical order
    const ORDER = ['S', 'M', 'L', 'XL', '2XL', 'XS', 'S/M', 'M/L', 'L/XL',
                   'YXS', 'YS', 'YM', 'YL', 'YXL', '2T', '3T', '4T', '5T', '6T',
                   'LT', 'XLT', '2XLT', '3XLT', 'OSFA', 'OSFM'];
    return [...sizes].sort((a, b) => {
        const ai = ORDER.indexOf(a);
        const bi = ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
}

// getSwatchStyle() — now provided by quote-builder-utils.js

// ============================================================
// COLOR PICKER FUNCTIONS
// ============================================================

/**
 * Toggle color picker dropdown open/closed
 */
function toggleColorPicker(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    const pickerSelected = row.querySelector('.color-picker-selected');
    const dropdown = row.querySelector('.color-picker-dropdown');

    // Don't open if disabled
    if (pickerSelected.classList.contains('disabled')) return;

    // Close all other open dropdowns first
    document.querySelectorAll('.color-picker-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.add('hidden');
    });

    // Toggle this dropdown
    dropdown.classList.toggle('hidden');

    // Scroll selected option into view if open
    if (!dropdown.classList.contains('hidden')) {
        const selectedOption = dropdown.querySelector('.color-picker-option.selected');
        if (selectedOption) {
            selectedOption.scrollIntoView({ block: 'nearest' });
        }
    }
}

/**
 * Select a color from the dropdown
 */
function selectColor(rowId, optionEl, skipDuplicateCheck) {
    const row = document.getElementById(`row-${rowId}`);
    const colorName = optionEl.dataset.colorName;
    const catalogColor = optionEl.dataset.catalogColor;
    const swatchUrl = optionEl.dataset.swatchUrl;
    const hex = optionEl.dataset.hex;
    const imageUrl = optionEl.dataset.imageUrl;
    const style = row.dataset.style;

    // Check for duplicate row (same style + color) — skip during import where same style+color at different prices is legitimate
    if (!skipDuplicateCheck) {
        const existingRow = findExistingRow(style, catalogColor, rowId);
        if (existingRow) {
            showToast(`${style} in ${colorName} already exists. Adding to existing row.`, 'info');
            row.querySelector('.color-picker-dropdown').classList.add('hidden');
            const existingFirstSize = existingRow.querySelector('.size-input:not([disabled])');
            if (existingFirstSize) existingFirstSize.focus();
            return;
        }
    }

    // Update selected display with swatch and full color name
    const pickerSelected = row.querySelector('.color-picker-selected');
    const swatch = pickerSelected.querySelector('.color-swatch');
    const nameSpan = pickerSelected.querySelector('.color-name');

    // Set swatch style (image or hex fallback)
    if (swatchUrl) {
        swatch.style.backgroundImage = `url('${swatchUrl}')`;
        swatch.style.backgroundColor = '';
        swatch.style.backgroundSize = 'cover';
        swatch.style.backgroundPosition = 'center';
    } else {
        swatch.style.backgroundImage = '';
        swatch.style.backgroundColor = hex || '#ccc';
    }
    swatch.classList.remove('empty');

    // Set full color name
    nameSpan.textContent = colorName;
    nameSpan.classList.remove('placeholder');

    // Mark selected option in dropdown
    row.querySelectorAll('.color-picker-option').forEach(opt => opt.classList.remove('selected'));
    optionEl.classList.add('selected');

    // Clear manual price override when color changes (new color = different product cost)
    if (row.dataset.nonSanmar !== 'true' && row.dataset.sellPrice) {
        delete row.dataset.sellPrice;
    }

    // Store data on row
    row.dataset.color = colorName;
    row.dataset.catalogColor = catalogColor;
    row.dataset.swatchUrl = swatchUrl || '';
    row.dataset.hex = hex || '';
    row.dataset.imageUrl = imageUrl || '';

    // Update product thumbnail
    updateProductThumbnail(rowId, imageUrl, row.dataset.productName, style, colorName);

    // Close dropdown
    row.querySelector('.color-picker-dropdown').classList.add('hidden');

    // Enable size inputs initially (may be disabled by detectAndAdjustSizeUI for special products)
    row.querySelectorAll('.size-input').forEach(input => input.disabled = false);

    // Detect size category and adjust UI (OSFA, combo, youth, toddler, tall, standard)
    // This runs async but doesn't block - will update UI when API returns
    detectAndAdjustSizeUI(rowId);

    // Phase 10.1 (2026-05-23) — fire SanMar inventory check + render badges
    // next to each size input. Uses shared InventoryBadges wrapper.
    // Graceful: silently no-ops if scripts missing or non-SanMar product.
    if (window.InventoryBadges && typeof window.InventoryBadges.attach === 'function'
        && catalogColor && row.dataset.nonSanmar !== 'true') {
        window.InventoryBadges.attach(row, {
            style: style,
            catalogColor: catalogColor,
            sizeCellSelector: 'input.size-input',
        });
    }

    // Focus first size input (may be overridden by detectAndAdjustSizeUI for special products)
    const firstSize = row.querySelector('.size-input');
    if (firstSize) firstSize.focus();

    // Cascade to child rows if any
    cascadeColorToChildRows(rowId, colorName, catalogColor, swatchUrl, hex);

    recalculatePricing();
}

/**
 * Cascade color selection to child rows (for extended sizes)
 */
function cascadeColorToChildRows(parentRowId, colorName, catalogColor, swatchUrl, hex) {
    if (!childRowMap[parentRowId]) return;

    Object.values(childRowMap[parentRowId]).forEach(childRowId => {
        const childRow = document.getElementById(`row-${childRowId}`);
        if (childRow && childRow.dataset.colorManuallySet !== 'true') {
            childRow.dataset.color = colorName;
            childRow.dataset.catalogColor = catalogColor;

            // Update child row's color picker display if it has one
            const childPicker = childRow.querySelector('.color-picker-selected');
            if (childPicker) {
                const childSwatch = childPicker.querySelector('.color-swatch');
                const childName = childPicker.querySelector('.color-name');
                if (childSwatch && childName) {
                    if (swatchUrl) {
                        childSwatch.style.backgroundImage = `url('${swatchUrl}')`;
                        childSwatch.style.backgroundColor = '';
                    } else {
                        childSwatch.style.backgroundImage = '';
                        childSwatch.style.backgroundColor = hex || '#ccc';
                    }
                    childSwatch.classList.remove('empty');
                    childName.textContent = colorName;
                    childName.classList.remove('placeholder');
                }
            }
        }
    });
    updateChildRowColorIndicators(parentRowId);
}

/**
 * Handle keyboard navigation in color picker
 */
function handleColorPickerKeydown(event, rowId) {
    const row = document.getElementById(`row-${rowId}`);
    const dropdown = row.querySelector('.color-picker-dropdown');
    const isOpen = !dropdown.classList.contains('hidden');

    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleColorPicker(rowId);
    } else if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        dropdown.classList.add('hidden');
    } else if (event.key === 'ArrowDown' && isOpen) {
        event.preventDefault();
        navigateOptions(dropdown, 1);
    } else if (event.key === 'ArrowUp' && isOpen) {
        event.preventDefault();
        navigateOptions(dropdown, -1);
    } else if (event.key === 'Tab') {
        // Close dropdown on tab
        dropdown.classList.add('hidden');
    }
}

/**
 * Navigate through dropdown options with arrow keys
 */
function navigateOptions(dropdown, direction) {
    const options = dropdown.querySelectorAll('.color-picker-option');
    if (options.length === 0) return;

    let currentIndex = -1;
    options.forEach((opt, i) => {
        if (opt.classList.contains('focused')) currentIndex = i;
    });

    // Remove current focus
    options.forEach(opt => opt.classList.remove('focused'));

    // Calculate new index
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = options.length - 1;
    if (newIndex >= options.length) newIndex = 0;

    // Add focus to new option
    options[newIndex].classList.add('focused');
    options[newIndex].scrollIntoView({ block: 'nearest' });
}

// Click outside handler to close all dropdowns
document.addEventListener('click', function(e) {
    if (!e.target.closest('.color-picker-wrapper')) {
        document.querySelectorAll('.color-picker-dropdown').forEach(d => d.classList.add('hidden'));
    }
});

/**
 * Select a color for a child row (extended size)
 * Similar to selectColor but marks color as manually set
 */
function selectChildColor(childRowId, parentRowId, optionEl) {
    const childRow = document.getElementById(`row-${childRowId}`);
    const colorName = optionEl.dataset.colorName;
    const catalogColor = optionEl.dataset.catalogColor;
    const swatchUrl = optionEl.dataset.swatchUrl;
    const hex = optionEl.dataset.hex;

    // Update selected display with swatch and full color name
    const pickerSelected = childRow.querySelector('.color-picker-selected');
    const swatch = pickerSelected.querySelector('.color-swatch');
    const nameSpan = pickerSelected.querySelector('.color-name');

    // Set swatch style (image or hex fallback)
    if (swatchUrl) {
        swatch.style.backgroundImage = `url('${swatchUrl}')`;
        swatch.style.backgroundColor = '';
        swatch.style.backgroundSize = 'cover';
        swatch.style.backgroundPosition = 'center';
    } else {
        swatch.style.backgroundImage = '';
        swatch.style.backgroundColor = hex || '#ccc';
    }
    swatch.classList.remove('empty');

    // Set full color name
    nameSpan.textContent = colorName;
    nameSpan.classList.remove('placeholder');

    // Mark selected option in dropdown
    childRow.querySelectorAll('.color-picker-option').forEach(opt => opt.classList.remove('selected'));
    optionEl.classList.add('selected');

    // Store data on row
    childRow.dataset.color = colorName;
    childRow.dataset.catalogColor = catalogColor;
    childRow.dataset.swatchUrl = swatchUrl || '';
    childRow.dataset.hex = hex || '';
    childRow.dataset.colorManuallySet = 'true';  // Mark as manually changed

    // Clear per-size price override on color change (new color = new product cost)
    delete childRow.dataset.sellPrice;

    // Close dropdown
    childRow.querySelector('.color-picker-dropdown').classList.add('hidden');

    // Update visual indicator for different color
    updateChildRowColorIndicators(parentRowId);

    recalculatePricing();
}

/**
 * Update visual styling for child rows based on color match with parent
 */
function updateChildRowColorIndicators(parentRowId) {
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!parentRow) return;

    const parentCatalogColor = parentRow.dataset.catalogColor;

    if (childRowMap[parentRowId]) {
        Object.values(childRowMap[parentRowId]).forEach(childRowId => {
            const childRow = document.getElementById(`row-${childRowId}`);
            if (childRow) {
                if (childRow.dataset.catalogColor !== parentCatalogColor) {
                    childRow.classList.add('different-color');
                } else {
                    childRow.classList.remove('different-color');
                }
            }
        });
    }
}

/**
 * Find an existing row with the same style and catalogColor (excluding current row)
 */
function findExistingRow(style, catalogColor, excludeRowId) {
    const rows = document.querySelectorAll('#product-tbody tr:not(.child-row)');
    for (const row of rows) {
        const rowNumericId = parseInt(row.id.replace('row-', ''));
        if (rowNumericId === excludeRowId) continue;
        if (row.dataset.style === style && row.dataset.catalogColor === catalogColor) {
            return row;
        }
    }
    return null;
}

function onSizeChange(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    // Mark as having unsaved changes
    markAsUnsaved();

    // Skip if this is a child row (child rows don't trigger size changes)
    if (row.classList.contains('child-row')) {
        recalculatePricing();
        return;
    }

    const sizeCategory = row.dataset.sizeCategory;

    // OSFA-only products are handled separately by onOSFAQtyChange()
    if (sizeCategory === 'osfa-only') {
        recalculatePricing();
        return;
    }

    // IMPORTANT: Handle 2XL/XXL child row FIRST (before quantity calculation)
    // This ensures the 2XL input is disabled before we sum enabled inputs,
    // preventing the 2XL value from being counted twice (in parent AND child)
    // Bug fix: 2026-01-14 - Parent row showed 16 instead of 14 for S/M/L/XL
    const xxlInput = row.querySelector('[data-size="2XL"]');
    if (xxlInput) {
        const qty = parseInt(xxlInput.value) || 0;
        // Check for both 2XL and XXL child rows (XXL is distinct for Ladies/Womens products)
        const existingChildId = childRowMap[rowId]?.['2XL'] || childRowMap[rowId]?.['XXL'];
        const existingChildSize = childRowMap[rowId]?.['2XL'] ? '2XL' : (childRowMap[rowId]?.['XXL'] ? 'XXL' : '2XL');

        if (qty > 0) {
            // Need a child row for 2XL (or XXL if that's what exists)
            if (existingChildId) {
                updateChildRow(existingChildId, qty);
            } else {
                createChildRow(rowId, '2XL', qty);
            }
            // Disable the 2XL input in parent BEFORE quantity calculation
            xxlInput.disabled = true;
            xxlInput.value = '';  // Clear to prevent visual confusion
            xxlInput.style.background = '#f5f5f5';
            xxlInput.style.color = '#999';
        } else {
            // Remove child row if it exists (could be 2XL or XXL)
            if (existingChildId) {
                removeChildRow(rowId, existingChildSize);
            }
            // Re-enable 2XL input in parent
            xxlInput.disabled = false;
            xxlInput.style.background = '';
            xxlInput.style.color = '';
        }
    }

    // Update parent row quantity display
    // Shows standard sizes total when > 0, or child row total for variant-only products
    // Bug fix 2026-01-14: Standard total excludes disabled 2XL (counted in child row)
    // Enhancement 2026-02-06: Variant-only products show child total instead of "0"
    updateParentQtyDisplay(rowId);

    // Recalculate pricing
    recalculatePricing();
}

/**
 * Update parent row Qty display.
 * Shows standard size total when > 0, otherwise shows sum of child row quantities.
 * DISPLAY-ONLY: collectProductsFromTable(), pricing engine, save/load, and
 * ShopWorks Entry Guide all read size inputs and child .qty-display directly,
 * never this cell. Safe to update without affecting data.
 */
function updateParentQtyDisplay(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;
    if (row.classList.contains('child-row')) return;
    if (row.dataset.isOsfaOnly === 'true') return; // OSFA-only already handled directly

    let standardTotal = 0;
    row.querySelectorAll('.size-input:not(.xxxl-picker-btn):not(.osfa-qty-input):not(:disabled)').forEach(input => {
        standardTotal += parseInt(input.value) || 0;
    });

    if (standardTotal > 0) {
        // Normal case: parent has standard sizes, show their total
        document.getElementById(`row-qty-${rowId}`).textContent = standardTotal;
    } else {
        // Variant-only: show child row total so parent doesn't display "0"
        let childTotal = 0;
        if (childRowMap[rowId]) {
            Object.values(childRowMap[rowId]).forEach(childRowId => {
                const childRow = document.getElementById(`row-${childRowId}`);
                if (childRow) {
                    const qtyDisplay = childRow.querySelector('.qty-display');
                    childTotal += parseInt(qtyDisplay?.textContent) || 0;
                }
            });
        }
        document.getElementById(`row-qty-${rowId}`).textContent = childTotal;
    }
}

/**
 * Post-import: Hide parent rows that have zero standard sizes (variant-only).
 * Promotes child rows to look like normal product rows (standalone-child class).
 * Called once after all products are imported in confirmShopWorksImport().
 */
function hideVariantOnlyParents() {
    const tbody = document.getElementById('product-tbody');
    if (!tbody) return;

    const parentRows = tbody.querySelectorAll('tr:not(.child-row):not(.service-product-row)');
    parentRows.forEach(parentRow => {
        const rowId = parseInt(parentRow.dataset.rowId);
        if (!rowId || !childRowMap[rowId]) return;
        if (parentRow.dataset.isOsfaOnly === 'true') return;

        // Check if ALL standard size inputs are empty/zero
        let standardTotal = 0;
        parentRow.querySelectorAll('.size-input:not(.xxxl-picker-btn):not(.osfa-qty-input):not(:disabled)').forEach(input => {
            standardTotal += parseInt(input.value) || 0;
        });

        if (standardTotal > 0) return; // Has standard sizes — keep parent visible

        // This is a variant-only parent — hide it and promote children
        parentRow.classList.add('variant-only-parent');
        parentRow.dataset.variantOnlyHidden = 'true';

        // Promote each child row to standalone
        const childRows = document.querySelectorAll(`tr[data-parent-row-id="${rowId}"]`);
        childRows.forEach(childRow => {
            childRow.classList.add('standalone-child');

            // Copy thumbnail from parent to child
            const parentThumbCell = parentRow.querySelector('.thumbnail-col');
            const childThumbCell = childRow.querySelector('.thumbnail-col');
            if (parentThumbCell && childThumbCell && parentThumbCell.innerHTML.trim()) {
                childThumbCell.innerHTML = parentThumbCell.innerHTML;
            }
        });

    });
}

/**
 * Unhide a variant-only parent row (called when its last child is deleted).
 */
function unhideVariantOnlyParent(parentRowId) {
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!parentRow || parentRow.dataset.variantOnlyHidden !== 'true') return;

    parentRow.classList.remove('variant-only-parent');
    parentRow.dataset.variantOnlyHidden = 'false';
}

/**
 * Generate ShopWorks-compatible part number
 * Uses SIZE_TO_SUFFIX which contains ALL size suffixes (tall, youth, toddler, etc.)
 */
function getPartNumber(baseStyle, size) {
    // For pants sizes (4-digit codes like 3032), append directly with underscore
    if (/^\d{4}$/.test(size)) {
        return `${baseStyle}_${size}`;
    }
    return baseStyle + (SIZE_TO_SUFFIX[size] || '');
}

/**
 * Create a child row for an extended size
 */
function createChildRow(parentRowId, size, qty) {
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!parentRow) return;

    const childRowId = ++rowCounter;
    const baseStyle = parentRow.dataset.style;
    const partNumber = getPartNumber(baseStyle, size);

    // Get parent's available colors for the dropdown
    const parentColors = parentRow.dataset.colors ? JSON.parse(parentRow.dataset.colors) : [];
    const parentColor = parentRow.dataset.color || '';
    const parentCatalogColor = parentRow.dataset.catalogColor || '';
    const parentSwatchUrl = parentRow.dataset.swatchUrl || '';
    const parentHex = parentRow.dataset.hex || '#ccc';

    // Build color picker options HTML with swatches
    const colorOptionsHtml = parentColors.map(c =>
        `<div class="color-picker-option ${c.COLOR_NAME === parentColor ? 'selected' : ''}"
             data-color-name="${escapeHtml(c.COLOR_NAME)}"
             data-catalog-color="${escapeHtml(c.CATALOG_COLOR || c.COLOR_NAME)}"
             data-swatch-url="${escapeHtml(c.COLOR_SQUARE_IMAGE || '')}"
             data-hex="${escapeHtml(c.HEX_CODE || '#ccc')}"
             onclick="selectChildColor(${childRowId}, ${parentRowId}, this)">
            <span class="color-swatch" style="${getSwatchStyle(c)}"></span>
            <span class="color-name">${escapeHtml(c.COLOR_NAME)}</span>
        </div>`
    ).join('');

    // Build current color display — sanitize before interpolating into style="" (CSS/attribute
    // breakout); mirrors the hardened getSwatchStyle(). (review C32)
    const _swUrl = String(parentSwatchUrl || '').replace(/["'()\\\s]/g, '');
    const _swHex = (parentHex && /^#[0-9a-fA-F]{3,8}$/.test(parentHex)) ? parentHex : '#ccc';
    const currentSwatchStyle = /^https?:\/\//i.test(_swUrl)
        ? `background-image: url('${_swUrl}'); background-size: cover; background-position: center;`
        : `background-color: ${_swHex};`;

    const childRow = document.createElement('tr');
    childRow.id = `row-${childRowId}`;
    childRow.className = 'child-row';
    childRow.dataset.rowId = childRowId;
    childRow.dataset.parentRowId = parentRowId;
    childRow.dataset.extendedSize = size;
    childRow.dataset.style = partNumber;
    childRow.dataset.baseStyle = baseStyle;
    childRow.dataset.color = parentRow.dataset.color;
    childRow.dataset.catalogColor = parentRow.dataset.catalogColor;
    childRow.dataset.swatchUrl = parentSwatchUrl;
    childRow.dataset.hex = parentHex;
    childRow.dataset.productName = parentRow.dataset.productName;
    childRow.dataset.colorManuallySet = 'false';  // Track if user manually changed color

    // Determine which column this size goes to:
    // - Size05 (XXL column): 2XL and XXL (both map to Size05 in ShopWorks)
    // - Size06 (XXXL column): XS, 3XL, 4XL, 5XL, 6XL, pants sizes, shorts sizes
    const isSize05 = size === '2XL' || size === 'XXL';
    const isPantsSize = /^\d{4}$/.test(size);  // 4-digit pants sizes like 3032
    const isShortsSize = /^W\d{2}$/.test(size);  // Waist-only shorts sizes like W30
    const isSize06 = SIZE06_EXTENDED_SIZES.includes(size) || isPantsSize || isShortsSize;

    // Format display size (pants: "3032" -> "30x32", shorts: "W30" -> "Waist 30", others: keep as-is)
    let displaySize = size;
    if (isPantsSize) {
        const waist = size.substring(0, 2);
        const inseam = size.substring(2, 4);
        displaySize = `${waist}x${inseam}`;
    } else if (isShortsSize) {
        const waist = size.replace('W', '');
        displaySize = `Waist ${waist}`;
    }

    // Create cell content - only the specific size column is editable
    childRow.innerHTML = `
        <td>
            <span class="child-indicator">└</span>
            <span class="style-display">${partNumber}</span>
        </td>
        <td class="thumbnail-col"></td>
        <td>
            <span class="desc-display" style="color: #666; font-size: 12px;">${escapeHtml(parentRow.dataset.productName)} - <strong>${displaySize}</strong></span>
        </td>
        <td>
            <div class="color-picker-wrapper child-color-picker" data-row-id="${childRowId}">
                <div class="color-picker-selected" onclick="toggleColorPicker(${childRowId})" tabindex="0" onkeydown="handleColorPickerKeydown(event, ${childRowId})">
                    <span class="color-swatch" style="${currentSwatchStyle}"></span>
                    <span class="color-name">${escapeHtml(parentColor)}</span>
                    <i class="fas fa-chevron-down picker-arrow"></i>
                </div>
                <div class="color-picker-dropdown hidden" id="color-dropdown-${childRowId}">
                    ${colorOptionsHtml}
                </div>
            </div>
        </td>
        <td><input type="number" class="cell-input size-input" data-size="S" disabled value="" style="background: #f5f5f5;"></td>
        <td><input type="number" class="cell-input size-input" data-size="M" disabled value="" style="background: #f5f5f5;"></td>
        <td><input type="number" class="cell-input size-input" data-size="L" disabled value="" style="background: #f5f5f5;"></td>
        <td><input type="number" class="cell-input size-input" data-size="XL" disabled value="" style="background: #f5f5f5;"></td>
        <td><input type="number" class="cell-input size-input" data-size="2XL" ${isSize05 ? '' : 'disabled'} value="${isSize05 ? qty : ''}" placeholder="${isSize05 ? qty : ''}" style="${isSize05 ? '' : 'background: #f5f5f5;'}" onchange="onChildSizeChange(${childRowId}, ${parentRowId}, '${size}')" onkeydown="handleCellKeydown(event, this)"></td>
        <td><input type="number" class="cell-input size-input" data-size="${size}" ${isSize06 ? '' : 'disabled'} value="${isSize06 ? qty : ''}" placeholder="${isSize06 ? qty : ''}" style="${isSize06 ? '' : 'background: #f5f5f5;'}" onchange="onChildSizeChange(${childRowId}, ${parentRowId}, '${size}')" onkeydown="handleCellKeydown(event, this)"></td>
        <td class="cell-qty qty-display" id="row-qty-${childRowId}">${qty}</td>
        <td class="cell-price unit-price-display" id="row-price-${childRowId}"
            ondblclick="enablePriceOverride(${childRowId})"
            title="Double-click to override price">-</td>
        <td class="cell-total" id="row-total-${childRowId}">-</td>
        <td class="cell-actions">
            <button class="btn-delete-row" onclick="clearExtendedSize(${parentRowId}, '${size}')" title="Remove ${displaySize}">
                <i class="fas fa-times"></i>
            </button>
        </td>
    `;

    // Insert in correct size order: XS, 2XL, 3XL, 4XL, 5XL, 6XL
    const existingChildren = Array.from(document.querySelectorAll(`tr[data-parent-row-id="${parentRowId}"]`));

    if (existingChildren.length === 0) {
        // No children yet, insert after parent
        parentRow.after(childRow);
    } else {
        // Find correct position based on size order (XS first, then 2XL, 3XL, etc.)
        const newSizeIndex = EXTENDED_SIZE_ORDER.indexOf(size);
        let insertAfter = parentRow;  // Default: after parent (for XS or first size)

        for (const existingChild of existingChildren) {
            const existingSize = existingChild.dataset.extendedSize;
            const existingSizeIndex = EXTENDED_SIZE_ORDER.indexOf(existingSize);

            // If existing size comes before new size in order, insert after this child
            if (existingSizeIndex < newSizeIndex) {
                insertAfter = existingChild;
            } else {
                // Found a size that should come after us, stop here
                break;
            }
        }

        insertAfter.after(childRow);
    }

    // Track child row
    if (!childRowMap[parentRowId]) {
        childRowMap[parentRowId] = {};
    }
    childRowMap[parentRowId][size] = childRowId;

}

/**
 * Update an existing child row quantity
 */
function updateChildRow(childRowId, qty) {
    const childRow = document.getElementById(`row-${childRowId}`);
    if (!childRow) return;

    const size = childRow.dataset.extendedSize;
    const sizeInput = childRow.querySelector(`[data-size="${size}"]`);
    if (sizeInput) {
        sizeInput.value = qty;
    }
    document.getElementById(`row-qty-${childRowId}`).textContent = qty;
}

/**
 * Remove a child row
 */
function removeChildRow(parentRowId, size) {
    const childRowId = childRowMap[parentRowId]?.[size];
    if (childRowId) {
        const childRow = document.getElementById(`row-${childRowId}`);
        if (childRow) {
            childRow.remove();
        }
        delete childRowMap[parentRowId][size];
    }
}

/**
 * Handle size change in child row - sync back to parent
 */
function onChildSizeChange(childRowId, parentRowId, size) {
    const childRow = document.getElementById(`row-${childRowId}`);
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!childRow || !parentRow) return;

    const sizeInput = childRow.querySelector(`[data-size="${size}"]`);
    const qty = parseInt(sizeInput?.value) || 0;

    // Update child row quantity display
    document.getElementById(`row-qty-${childRowId}`).textContent = qty;

    // Update parent Qty display (reflects child changes for variant-only rows)
    updateParentQtyDisplay(parseInt(parentRowId));

    // Sync back to parent row's hidden input
    const parentInput = parentRow.querySelector(`[data-size="${size}"]`);
    if (parentInput) {
        parentInput.value = qty;
    }

    // If qty is 0, remove the child row
    if (qty === 0) {
        clearExtendedSize(parentRowId, size);
    }

    recalculatePricing();
}

/**
 * Clear an extended size (remove child row, enable parent input)
 */
function clearExtendedSize(parentRowId, size) {
    const parentRow = document.getElementById(`row-${parentRowId}`);
    if (!parentRow) return;

    // Clear parent input
    const parentInput = parentRow.querySelector(`[data-size="${size}"]`);
    if (parentInput) {
        parentInput.value = '';
        parentInput.disabled = false;
        parentInput.style.background = '';
        parentInput.style.color = '';
    }

    // Remove child row
    removeChildRow(parentRowId, size);

    // If parent was hidden (variant-only) and has no more children, unhide it
    if (parentRow.dataset.variantOnlyHidden === 'true') {
        const remainingChildren = document.querySelectorAll(`tr[data-parent-row-id="${parentRowId}"]`);
        if (remainingChildren.length === 0) {
            unhideVariantOnlyParent(parentRowId);
        }
    }

    // Update parent Qty display (may revert to 0 if no children remain)
    updateParentQtyDisplay(parentRowId);

    recalculatePricing();
}

/**
 * Reorder a product row based on type: garments first, caps below
 * Called after cap detection to maintain visual organization
 */
function reorderRowByProductType(row) {
    if (!row) return;

    const tbody = document.getElementById('product-tbody');
    if (!tbody) return;

    const isCap = row.dataset.isCap === 'true';

    if (isCap) {
        // Cap rows go at the end (after all other rows)
        tbody.appendChild(row);
    } else {
        // Garment rows go before any cap rows
        const firstCapRow = tbody.querySelector('tr[data-is-cap="true"]:not(.child-row)');
        if (firstCapRow) {
            tbody.insertBefore(row, firstCapRow);
        }
        // If no cap rows yet, row stays where it is (already at end)
    }
}

function deleteRow(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    // If this is a parent row, also remove all child rows
    if (!row.classList.contains('child-row') && childRowMap[rowId]) {
        Object.keys(childRowMap[rowId]).forEach(size => {
            const childRowId = childRowMap[rowId][size];
            const childRow = document.getElementById(`row-${childRowId}`);
            if (childRow) {
                childRow.remove();
            }
        });
        delete childRowMap[rowId];
    }


    row.remove();
    recalculatePricing();

    // Update logo section visibility (hide if no products of that type remain)
    updateCapLogoSectionVisibility();
    updateGarmentLogoSectionVisibility();
}

/**
 * Duplicate a product row for a different color of the same style.
 * Pre-populates the style number and triggers onStyleChange() so
 * the color picker loads — user just picks the new color.
 */
async function duplicateRowNewColor(sourceRowId) {
    const sourceRow = document.getElementById(`row-${sourceRowId}`);
    if (!sourceRow) return;

    const style = sourceRow.dataset.style;
    if (!style) {
        showToast('No style loaded on this row', 'error');
        return;
    }

    // Create a new row. Find it via lastElementChild, NOT 'tr.new-row' — the
    // .new-row highlight class lives on ANY row created in the last 1s, so a
    // quick second duplicate used to grab the wrong (earlier) row and leave
    // the new one empty. addNewRow() appends synchronously; last row wins.
    addNewRow();
    const newRow = document.getElementById('product-tbody').lastElementChild;
    if (!newRow || !newRow.dataset.rowId) return;

    const newRowId = parseInt(newRow.dataset.rowId);
    const styleInput = newRow.querySelector('.style-input');
    if (styleInput) {
        styleInput.value = style;
        await onStyleChange(styleInput, newRowId);
        showToast(`Select a new color for ${style}`, 'info', 3000);
    }
}

// ============================================================
// PRICE OVERRIDE (double-click to edit)
// ============================================================

/**
 * Enable price override on a product row via double-click.
 * Replaces price cell content with an editable input.
 * Enter/blur commits the override; Escape cancels.
 */
function enablePriceOverride(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    // Only allow override on product rows and DECG/DECC service rows
    if (row.dataset.productType === 'service') {
        const sType = (row.dataset.serviceType || '').toUpperCase();
        if (sType !== 'DECG' && sType !== 'DECC') return;
    }

    // Don't allow override on empty product rows (no style or no quantities yet)
    // Child rows inherit style/color from parent, so allow them through
    // Non-SanMar rows may not have color set yet, but should still allow price edit
    const isChildRow = row.classList.contains('child-row');
    const isNonSanmar = row.dataset.nonSanmar === 'true';
    if (row.dataset.productType !== 'service' && !isChildRow && !isNonSanmar && (!row.dataset.style || !row.dataset.color)) return;

    const priceCell = document.getElementById(`row-price-${rowId}`);
    if (!priceCell) return;

    // Already editing — don't re-enter
    if (priceCell.querySelector('.price-override-input')) return;

    // Read current displayed price (strip $ and any reset button text)
    const currentText = priceCell.textContent.replace(/[^0-9.]/g, '');
    const currentPrice = parseFloat(currentText) || 0;

    // Replace cell content with input
    priceCell.innerHTML = `<input type="number" class="price-override-input"
        step="0.01" min="0" value="${currentPrice.toFixed(2)}">`;

    const input = priceCell.querySelector('.price-override-input');
    input.focus();
    input.select();

    // Commit on Enter or blur
    function commitOverride() {
        const newPrice = parseFloat(input.value);
        if (isNaN(newPrice) || newPrice <= 0) {
            cancelOverride();
            return;
        }

        // Set the sell price override on the row
        row.dataset.sellPrice = newPrice.toString();
        markAsUnsaved();
        recalculatePricing();
    }

    // Cancel on Escape — restore original display
    function cancelOverride() {
        // Remove input, let recalculatePricing restore the cell
        // If there was an existing override, keep it; otherwise clear
        recalculatePricing();
    }

    let committed = false;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            committed = true;
            commitOverride();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            committed = true;
            cancelOverride();
        }
    });

    input.addEventListener('blur', () => {
        if (!committed) {
            commitOverride();
        }
    });
}

/**
 * Clear price override on a product row — revert to formula-calculated price.
 */
function clearPriceOverride(rowId) {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;

    // Remove override
    delete row.dataset.sellPrice;

    markAsUnsaved();
    recalculatePricing();
}

// ============================================================
// KEYBOARD NAVIGATION (Excel-style)
// ============================================================

// setupKeyboardShortcuts() → moved to quote-builder-utils.js (now includes Ctrl+P for print)

function handleCellKeydown(event, input) {
    const row = input.closest('tr');
    const cells = Array.from(row.querySelectorAll('input:not([readonly]), select:not(:disabled)'));
    const currentIndex = cells.indexOf(input);

    if (event.key === 'Tab' && !event.shiftKey) {
        // Tab to next cell
        if (currentIndex === cells.length - 1) {
            // Last cell in row - add new row
            event.preventDefault();
            addNewRow();
        }
    } else if (event.key === 'Enter') {
        // Enter = next row
        event.preventDefault();

        const tbody = document.getElementById('product-tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const currentRowIndex = rows.indexOf(row);

        if (currentRowIndex === rows.length - 1) {
            // Last row - add new
            addNewRow();
        } else {
            // Focus same column in next row
            const nextRow = rows[currentRowIndex + 1];
            const nextCells = Array.from(nextRow.querySelectorAll('input:not([readonly]), select:not(:disabled)'));
            if (nextCells[currentIndex]) {
                nextCells[currentIndex].focus();
            } else if (nextCells[0]) {
                nextCells[0].focus();
            }
        }
    } else if (event.key === 'ArrowDown') {
        // Arrow down
        event.preventDefault();
        const tbody = document.getElementById('product-tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const currentRowIndex = rows.indexOf(row);

        if (currentRowIndex < rows.length - 1) {
            const nextRow = rows[currentRowIndex + 1];
            const field = input.dataset.field || input.dataset.size;
            const nextInput = nextRow.querySelector(`[data-field="${field}"], [data-size="${field}"]`);
            if (nextInput && !nextInput.disabled) {
                nextInput.focus();
            }
        }
    } else if (event.key === 'ArrowUp') {
        // Arrow up
        event.preventDefault();
        const tbody = document.getElementById('product-tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const currentRowIndex = rows.indexOf(row);

        if (currentRowIndex > 0) {
            const prevRow = rows[currentRowIndex - 1];
            const field = input.dataset.field || input.dataset.size;
            const prevInput = prevRow.querySelector(`[data-field="${field}"], [data-size="${field}"]`);
            if (prevInput && !prevInput.disabled) {
                prevInput.focus();
            }
        }
    }
}

// ============================================================
// PRICING CALCULATIONS
// ============================================================

// Debounce utility for input handlers that fire on every keystroke
function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Build logo configuration from current global state.
 * Shared between recalculatePricing() and saveAndGetLink() to avoid duplication.
 */
function buildLogoConfiguration() {
    const garmentAL = globalAL.garment.enabled ? [{
        id: 'global-al-garment',
        position: 'AL',
        stitchCount: globalAL.garment.stitchCount,
        needsDigitizing: globalAL.garment.needsDigitizing
    }] : [];
    const capAL = globalAL.cap.enabled ? [{
        id: 'global-al-cap',
        position: 'AL-Cap',
        stitchCount: globalAL.cap.stitchCount,
        needsDigitizing: globalAL.cap.needsDigitizing
    }] : [];

    const logoConfigs = {
        garment: {
            primary: { ...primaryLogo, id: 'primary' },
            additional: garmentAL
        },
        cap: {
            primary: { ...capPrimaryLogo, id: 'cap-primary' },
            additional: capAL
        }
    };

    const allLogos = [
        { ...primaryLogo, id: 'primary' },
        ...garmentAL,
        { ...capPrimaryLogo, id: 'cap-primary' },
        ...capAL
    ];

    return { logoConfigs, allLogos };
}

const debouncedRecalculatePricing = debounce(() => recalculatePricing(), 250);

/**
 * Rush Fee = 25% of the merchandise subtotal, as a live LINE ITEM (part RUSH /
 * "Rush Charge"), mirroring ShopWorks. Added from the Services bar (Charges ▸ Rush
 * Fee). Recomputed at the END of every recalculatePricing pass: base = #grand-total
 * minus this row's OWN current value (so it never counts itself), rush = 25% × base.
 * Saves + pushes as a normal RUSH service line item (qty 1 → Size01 on import).
 * (2026-06-03)
 */
/**
 * Additional Logo (AL) live pricing — bar-driven line items.
 * Each AL row (data-al-priced) carries a stitch count + item type (garment/cap/fullback).
 * Price is pulled LIVE from the API via EmbroideryPricingService.calculateALPrice (tier-aware
 * + per-1K stitch upcharge), cached once per session. syncALRows() recomputes every AL row at
 * the END of each recalc pass — BEFORE syncRushRow() so the rush base includes the AL totals —
 * adjusting #grand-total the same self-referential way syncRushRow does. NEVER falls back to a
 * guessed price: if the API is unreachable, it shows a visible error and leaves the row at $0
 * (Erik's #1 rule — wrong pricing is worse than an error). (2026-06-03)
 */
/**
 * "Retry pricing" on failed AL/DECG rows (old-audit P2 #9, shipped 2026-07-07):
 * an API blip flagged rows with data-price-error and the only recovery was a FULL
 * PAGE REFRESH — losing unsaved work mid-call. The button clears the pricing
 * caches and re-runs the same live syncs; the save gate stays closed until a
 * retry actually succeeds.
 */
function renderPriceErrorRetries() {
    document.querySelectorAll('#product-tbody tr.service-product-row[data-price-error="true"]').forEach(row => {
        const rid = row.dataset.rowId;
        const cell = document.getElementById(`row-price-${rid}`);
        if (!cell || cell.querySelector('.btn-retry-pricing')) return;
        cell.innerHTML = '<button type="button" class="btn-retry-pricing" onclick="retryRowPricing()" title="Pricing failed to load — retry without refreshing the page"><i class="fas fa-rotate-right"></i> Retry</button>';
    });
}

async function retryRowPricing() {
    showToast('Retrying pricing…', 'info', 2000);
    window._alPricingCache = null;     // force fresh fetches — a stale snapshot is
    window._decgPricingCache = null;   // exactly what a failed row must not reuse
    try {
        await syncALRows();
        await syncDECGRows();
        await recalculatePricing();
    } catch (e) {
        console.error('[RetryPricing] resync failed', e);
    }
    const still = document.querySelectorAll('#product-tbody tr[data-price-error="true"]').length;
    showToast(
        still ? 'Pricing is still unavailable — check the connection and retry.' : 'Pricing recovered — rows repriced.',
        still ? 'error' : 'success'
    );
}
window.retryRowPricing = retryRowPricing;

async function loadALPricing() {
    if (window._alPricingCache) return window._alPricingCache;
    if (!window.EmbroideryPricingService) { console.error('[AL] EmbroideryPricingService unavailable'); return null; }
    try {
        window._alPricingSvc = window._alPricingSvc || new window.EmbroideryPricingService();
        window._alPricingCache = await window._alPricingSvc.fetchALPricing();
        return window._alPricingCache;
    } catch (e) {
        console.error('[AL] fetchALPricing failed', e);
        showToast("Couldn't load Additional Logo pricing from the server — click Retry on the affected row (no refresh needed).", 'error');
        return null;
    }
}

/**
 * Current piece counts on the order, garment vs cap, summed from the product rows. An
 * Additional Logo is a 2nd decoration that goes on EVERY piece, so its qty should track the
 * order total (not sit at 1) — used to auto-default + auto-sync AL rows. (Erik 2026-06-05)
 */
function getOrderPieceCounts() {
    const products = collectProductsFromTable().filter(p => !p.isService);
    return {
        garment: products.filter(p => !p.isCap).reduce((s, p) => s + (p.totalQuantity || 0), 0),
        cap: products.filter(p => p.isCap).reduce((s, p) => s + (p.totalQuantity || 0), 0),
    };
}

async function syncALRows() {
    const alRows = document.querySelectorAll('#product-tbody tr.service-product-row[data-al-priced="true"]');
    if (!alRows.length) return;
    const cache = await loadALPricing();
    // [A3] (audit 2026-06-06): API down → do NOT leave a stale/$0 AL price the save gate would accept. Flag
    // every AL row so saveAndGetLink's priceError gate blocks it (Erik's #1 rule). Toast already surfaced.
    if (!cache) { alRows.forEach(r => { r.dataset.priceError = 'true'; }); return; }
    const svc = window._alPricingSvc;
    const counts = getOrderPieceCounts();
    for (const row of alRows) {
        const rid = row.dataset.rowId;
        const itemType = row.dataset.alItemType || 'garment';
        // Auto-tally: a 2nd logo goes on every piece — keep the qty synced to the order's
        // garment/cap count UNLESS the rep overrode it (al-qty-auto === "false"). (Erik 2026-06-05)
        if (row.dataset.alQtyAuto !== 'false') {
            const want = (itemType === 'cap') ? counts.cap : counts.garment;
            const qInput = row.querySelector('.service-qty');
            // Set the qty to the order count even when it's 0 (rep removed all garments) — otherwise a
            // stale auto-tallied AL keeps its old qty and bills against zero pieces. Manual rows
            // (alQtyAuto === 'false') are excluded by the guard above, so a hand-set qty is never zeroed. (audit fix 2026-06-05)
            if (qInput && String(want) !== qInput.value) qInput.value = String(want);
        }
        const qty = parseFloat(row.querySelector('.service-qty')?.value) || 0;
        const stitch = parseInt(row.dataset.stitchCount, 10) || 8000;
        let unit = 0;
        try {
            const res = await svc.calculateALPrice(qty || 1, stitch, itemType, cache);
            unit = res.unitPrice || 0;
            delete row.dataset.priceError;
        } catch (e) {
            // P1-4 (audit 2026-06-06): a pricing throw must NOT silently bill $0 (Erik's #1 rule). Flag the
            // row so the save/push gate blocks it, and tell the rep.
            console.error('[AL] calculateALPrice failed', e);
            row.dataset.priceError = 'true';
            showToast('Could not price the Additional Logo row — refresh; it will not be saved at $0.', 'error');
        }
        if (!(unit > 0)) row.dataset.priceError = 'true';   // an AL is never legitimately $0
        // Store the live price on the row; the next recalc sums it like any service row.
        row.dataset.unitPrice = String(unit);
        const priceCell = document.getElementById(`row-price-${rid}`);
        const totalCell = document.getElementById(`row-total-${rid}`);
        if (priceCell) priceCell.textContent = '$' + unit.toFixed(2);
        if (totalCell) totalCell.textContent = '$' + (unit * qty).toFixed(2);
    }
}
window.syncALRows = syncALRows;

/**
 * Customer-Supplied (DECG/DECC) live pricing — bar-driven line items, a mirror of the AL path.
 * Each DECG/DECC row (data-decg-priced) carries a stitch count + item type (garment/cap). The
 * per-piece price is LIVE from the API (EmbroideryPricingService.calculateDECGPrice — qty-tier
 * base + per-1K stitch upcharge from the Embroidery_Costs DECG tiers, garment vs cap by itemType),
 * cached once per session. syncDECGRows() recomputes every DECG row whenever the quantity changes.
 * NEVER falls back to a guessed price: if the API is unreachable it shows a visible error and
 * leaves the row at $0 (Erik's #1 rule). Manually-overridden rows are left untouched. (2026-06-04)
 */
async function loadDECGPricing() {
    if (window._decgPricingCache) return window._decgPricingCache;
    if (!window.EmbroideryPricingService) { console.error('[DECG] EmbroideryPricingService unavailable'); return null; }
    try {
        window._alPricingSvc = window._alPricingSvc || new window.EmbroideryPricingService();
        window._decgPricingCache = await window._alPricingSvc.fetchDECGPricing();
        return window._decgPricingCache;
    } catch (e) {
        console.error('[DECG] fetchDECGPricing failed', e);
        showToast("Couldn't load Customer-Supplied (DECG) pricing from the server — click Retry on the affected row (no refresh needed).", 'error');
        return null;
    }
}

async function syncDECGRows() {
    const rows = document.querySelectorAll('#product-tbody tr.service-product-row[data-decg-priced="true"]');
    if (!rows.length) {
        // Last DECG row deleted → the synthesized small-batch fee goes with it.
        _syncDecgLtmRow({ garment: 0, cap: 0 }, { garment: 0, cap: 0 });
        return;
    }
    const cache = await loadDECGPricing();
    // [A3 + A3-DECG fix] (audit 2026-06-06): API down → flag rows so saveAndGetLink's priceError gate blocks
    // (Erik's #1 rule). But a MANUALLY-overridden DECG row (sellPrice>0) is independent of the API → don't
    // over-block it (fail-closed otherwise). Toast already surfaced.
    if (!cache) { rows.forEach(r => { if (!(parseFloat(r.dataset.sellPrice) > 0)) r.dataset.priceError = 'true'; }); return; }
    const svc = window._alPricingSvc;

    // [expert audit 2026-07-07 F10] Tier at the POOLED same-category quantity: 15
    // supplied jackets + 15 supplied hoodies run as ONE 30-pc job (tier 24-47), not
    // two tier-8-23 rows — per-row tiering over-charged vs how the shop runs and vs
    // purchased-garment pooling. Overridden rows still occupy the machine run, so
    // their qty counts toward the tier/fee even though their price isn't touched.
    const pooledQty = { garment: 0, cap: 0 };
    rows.forEach(r => {
        const t = r.dataset.decgItemType === 'cap' ? 'cap' : 'garment';
        pooledQty[t] += parseFloat(r.querySelector('.service-qty')?.value) || 0;
    });
    const decgLtm = { garment: 0, cap: 0 };

    for (const row of rows) {
        const rid = row.dataset.rowId;
        const qty = parseFloat(row.querySelector('.service-qty')?.value) || 0;
        const stitch = parseInt(row.dataset.stitchCount, 10) || 8000;
        const itemType = row.dataset.decgItemType === 'cap' ? 'cap' : 'garment';
        const heavyweight = row.dataset.decgHeavyweight === 'true';
        const tierQty = Math.max(pooledQty[itemType], qty || 1, 1);
        if (parseFloat(row.dataset.sellPrice) > 0) {
            // manual override — recalc handles the display; still capture the
            // category's small-batch fee so the fee row stays correct.
            try {
                const probe = await svc.calculateDECGPrice(tierQty, stitch, itemType, cache, heavyweight);
                if (probe && probe.ltmFee > 0) decgLtm[itemType] = probe.ltmFee;
            } catch (_) { /* an override row never blocks */ }
            continue;
        }
        let unit = 0;
        try {
            const res = await svc.calculateDECGPrice(tierQty, stitch, itemType, cache, heavyweight);
            unit = res.unitPrice || 0;
            // [expert audit 2026-07-07 F1] the service has ALWAYS returned the ≤7-pc
            // small-batch fee here — the old code read only unitPrice, so every
            // bring-your-own order under the threshold left $50 on the table (the
            // public DECG calculator and the ShopWorks import path both charge it).
            if (res.ltmFee > 0) decgLtm[itemType] = res.ltmFee;
            delete row.dataset.priceError;
        } catch (e) {
            // P1-4 (audit 2026-06-06): never silently bill a customer-supplied row at $0 (Erik's #1 rule).
            console.error('[DECG] calculateDECGPrice failed', e);
            row.dataset.priceError = 'true';
            showToast('Could not price the Customer-Supplied row — refresh; it will not be saved at $0.', 'error');
        }
        if (!(unit > 0)) row.dataset.priceError = 'true';   // a customer-supplied row is never $0
        // Store the live price on the row; the next recalc sums it like any service row.
        row.dataset.unitPrice = String(unit);
        const priceCell = document.getElementById(`row-price-${rid}`);
        const totalCell = document.getElementById(`row-total-${rid}`);
        if (priceCell) priceCell.textContent = '$' + unit.toFixed(2);
        if (totalCell) totalCell.textContent = '$' + (unit * qty).toFixed(2);
    }

    _syncDecgLtmRow(decgLtm, pooledQty);
}
window.syncDECGRows = syncDECGRows;

/**
 * Synthesized "Customer-Supplied Small-Batch Fee" service row (expert audit
 * 2026-07-07 F1). A real ROW — not sidebar math — so it rides every money path
 * for free: recalc totals, saved quote_items, the printed PDF, and the ShopWorks
 * push (PN 'LTM' is proxy-registered in KNOWN_FEE_PNS). Amount comes from the
 * DECG API response (ltmFee at the pooled category qty), never hardcoded.
 * Deleting the row = waiving the fee — it won't re-add until the pooled DECG
 * quantities change the fee (a fresh decision point). Reloaded saved quotes are
 * re-adopted via data-service-type="ltm" so edits keep the amount live.
 */
function _syncDecgLtmRow(decgLtm, pooledQty) {
    const total = (decgLtm.garment || 0) + (decgLtm.cap || 0);
    const sig = `${decgLtm.garment || 0}|${decgLtm.cap || 0}`;
    const st = (window._decgLtmState = window._decgLtmState || { rowId: null, sig: null, waivedSig: null });

    let row = st.rowId ? document.getElementById(`row-${st.rowId}`) : null;
    if (!row) row = document.querySelector('#product-tbody tr.service-product-row[data-service-type="ltm"]');

    if (!(total > 0)) {
        if (row) row.remove();
        st.rowId = null; st.sig = null; st.waivedSig = null;
        return;
    }

    if (!row) {
        if (st.sig !== null) {
            // We rendered a fee this session and the row is gone → the rep deleted
            // it (waive). Honor it until the fee itself changes.
            st.waivedSig = st.sig;
            st.rowId = null; st.sig = null;
        }
        if (st.waivedSig === sig) return;
        row = createServiceProductRow('LTM', { quantity: 1, unitPrice: total, total: total, isCap: false });
        if (!row) return;
        row.dataset.decgLtm = 'true';
        const qtyIn = row.querySelector('.service-qty');
        if (qtyIn) { qtyIn.value = 1; qtyIn.readOnly = true; qtyIn.title = 'Small-batch fee — one per order (delete the row to waive)'; }
        st.rowId = row.dataset.rowId; st.sig = sig; st.waivedSig = null;
        const parts = [];
        if (decgLtm.garment > 0) parts.push(`${pooledQty.garment} supplied garment pc`);
        if (decgLtm.cap > 0) parts.push(`${pooledQty.cap} supplied cap pc`);
        if (typeof showToast === 'function') {
            showToast(`Customer-supplied small-batch fee added: $${total.toFixed(2)} (${parts.join(' + ')} under the 8-pc minimum). Delete the row to waive it.`, 'info', 8000);
        }
        return;
    }

    // Row exists → adopt + keep the amount live (unless the rep price-overrode it)
    st.rowId = row.dataset.rowId; st.sig = sig;
    row.dataset.decgLtm = 'true';
    if (!(parseFloat(row.dataset.sellPrice) > 0)) {
        row.dataset.unitPrice = String(total);
        const pc = document.getElementById(`row-price-${row.dataset.rowId}`);
        const tc = document.getElementById(`row-total-${row.dataset.rowId}`);
        if (pc) pc.textContent = '$' + total.toFixed(2);
        if (tc) tc.textContent = '$' + total.toFixed(2);
    }
}

// Rush surcharge rate — sourced from the Service_Codes API (RUSH.UnitCost = 25 → 25%), NOT hardcoded,
// so Erik can change it in Caspio with no deploy (CLAUDE.md "Pricing = API" rule). getServicePrice()
// can't be reused here: it reads SellPrice, which is 0 for RUSH (PricingMethod=CALCULATED) — the rate
// lives in UnitCost. Falls back to 0.25 with a ONE-TIME visible warning if the API didn't load. (audit #13a 2026-06-05)
let _rushRateWarned = false;
function getRushRate() {
    const sc = window._serviceCodes && window._serviceCodes['RUSH'];
    const pct = sc ? parseFloat(sc.UnitCost) : NaN;
    if (!isNaN(pct) && pct > 0) return pct / 100;
    if (!_rushRateWarned) {
        _rushRateWarned = true;
        if (typeof showToast === 'function') showToast('Using default 25% rush — rush rate not loaded from the pricing service', 'warning', 5000);
        console.warn('[Rush] RUSH service-code UnitCost unavailable; falling back to 25%');
    }
    return 0.25;
}
window.getRushRate = getRushRate;
function syncRushRow() {
    const rushRows = document.querySelectorAll('#product-tbody tr.service-product-row[data-service-type="rush"]');
    if (!rushRows.length) return;
    const grandEl = document.getElementById('grand-total');
    let grand = parseFloat((grandEl?.textContent || '$0').replace(/[$,]/g, '')) || 0;
    rushRows.forEach((row) => {
        const rid = row.dataset.rowId;
        const totalCell = document.getElementById(`row-total-${rid}`);
        const priceCell = document.getElementById(`row-price-${rid}`);
        const oldTotal = parseFloat((totalCell?.textContent || '$0').replace(/[$,]/g, '')) || 0;
        const base = grand - oldTotal;                 // everything except this rush row
        const rush = +(base * getRushRate()).toFixed(2);
        row.dataset.unitPrice = String(rush);
        if (priceCell) priceCell.textContent = '$' + rush.toFixed(2);
        if (totalCell) totalCell.textContent = '$' + rush.toFixed(2);
        grand = base + rush;                           // adjust running grand total
    });
    if (grandEl) grandEl.textContent = '$' + grand.toFixed(2);
}
window.syncRushRow = syncRushRow;

// [2026-06-08] EMB DRY-rewire: perBoxForCategory (box-density math) removed — it now lives ONLY in the shared
// estimator (quote-order-summary.js), which EMB's estimateShipping delegate calls. Tune box density via Caspio
// Box_Density_Reference (window._boxDensity) as before — no code change needed.

// [2026-06-08] EMB DRY-rewire: thin delegate to the SHARED estimator (quote-order-summary.js). The full UPS-Ground
// weight/box-math (validated vs real ShopWorks/UPS invoices) now lives ONCE in the module; EMB's estimateHooks (in
// configure above) feed it EMB's product source (collectProductsFromTable) + #shipping-fee + #ship-residential + the
// post-apply recalc. Byte-identical to the old inline copy — regression-gated against a fixed order before shipping.
async function estimateShipping() { return QuoteOrderSummary.estimateShipping(); }
window.estimateShipping = estimateShipping;

/**
 * Which category (garment/cap) is nearer its next EMB tier break — they tier
 * SEPARATELY, so the nudge must target one category, never the combined total.
 * label is set only for mixed orders (where ambiguity exists). (2026-06-10)
 */
function computeEmbNudgeTarget(garmentQty, capQty) {
    const breaks = [8, 24, 48, 72];
    const nextBreak = q => breaks.find(b => q < b) || null;
    const mixed = garmentQty > 0 && capQty > 0;
    const mk = (q, category) => {
        const nb = nextBreak(q);
        return nb ? { qty: q, needed: nb - q, nextBreak: nb, category, label: mixed ? category : '' } : null;
    };
    const g = garmentQty > 0 ? mk(garmentQty, 'garment') : null;
    const c = capQty > 0 ? mk(capQty, 'cap') : null;
    if (g && c) return g.needed <= c.needed ? g : c;
    return g || c || { qty: 0, needed: 0, nextBreak: null, category: '', label: '' };
}

/**
 * Price-break ladder (2026-06-10): simulate the order at the next tier with the
 * REAL engine (clone + pad the target category) and show the actual $/pc savings
 * in the nudge — "Add 3 more garment pieces … save ~$1.62/piece". Fire-and-forget
 * after each recalc; the seq guard discards stale results.
 */
async function computeNudgeSavingsAsync(productList, allLogos, logoConfigs, ltmEnabled, pricing, mySeq) {
    try {
        const t = computeEmbNudgeTarget(pricing.garmentQuantity || 0, pricing.capQuantity || 0);
        if (!t.qty || !t.needed || !t.nextBreak) return;
        if (t.needed > Math.ceil(t.nextBreak * 0.30)) return;   // nudge not visible — skip the sim
        const isCapTarget = t.category === 'cap';
        const idx = productList.findIndex(p => !!p.isCap === isCapTarget);
        if (idx === -1) return;
        let clone;
        try { clone = structuredClone(productList); } catch (_) { clone = JSON.parse(JSON.stringify(productList)); }
        const target = clone[idx];
        target.totalQuantity = (target.totalQuantity || 0) + t.needed;
        const sb = target.sizeBreakdown || target.sizes;
        if (sb && typeof sb === 'object') {
            const k = Object.keys(sb).find(key => sb[key] > 0) || 'L';
            sb[k] = (Number(sb[k]) || 0) + t.needed;
        }
        const sim = await pricingCalculator.calculateQuote(clone, allLogos, logoConfigs, { ltmEnabled });
        if (mySeq !== window._embRecalcSeq) return;   // a newer recalc superseded this sim
        if (!sim || sim.success === false) return;
        const unitOf = (res) => {
            const pp = (res.products || []).find(p => !!(p.product && p.product.isCap) === isCapTarget);
            const li = pp && (pp.lineItems || [])[0];
            const v = li && Number(li.unitPriceWithLTM ?? li.unitPrice);
            return Number.isFinite(v) && v > 0 ? v : null;
        };
        const cur = unitOf(pricing);
        const next = unitOf(sim);
        if (cur == null || next == null) return;
        const savings = cur - next;
        if (savings > 0.01) {
            updateQuantityNudge(t.qty, 'emb', savings, 'quantity-nudge', t.label);
        }
    } catch (e) {
        console.warn('[Nudge] savings simulation skipped:', e);
    }
}

/**
 * Digitizing fee has TWO Caspio homes (expert audit 2026-07-07): the logo-card
 * checkboxes bill the pricing-bundle's Embroidery_Costs.DigitizingFee
 * (embroidery-quote-pricing.js loadPricingData → engine :1811/:1823) while the
 * services-bar DD chip bills Service_Codes['DD']. Keep the static "$100" card
 * labels synced to the value the checkbox actually bills, and WARN once if the
 * two Caspio sources diverge — a silent mismatch is how the same quote grows
 * two different digitizing prices.
 */
function syncDigitizingPriceLabels() {
    const bundleFee = (typeof pricingCalculator !== 'undefined' && pricingCalculator && Number(pricingCalculator.digitizingFee) > 0)
        ? Number(pricingCalculator.digitizingFee) : null;
    const ddFee = (typeof getServicePrice === 'function') ? getServicePrice('DD', bundleFee ?? 100) : (bundleFee ?? 100);
    const billed = bundleFee ?? ddFee;
    document.querySelectorAll('[data-dd-price]').forEach(el => {
        el.textContent = `$${Number(billed).toFixed(0)}`;
    });
    if (bundleFee != null && Math.abs(ddFee - bundleFee) > 0.005 && !window._ddFeeMismatchWarned) {
        window._ddFeeMismatchWarned = true;
        if (typeof showToast === 'function') {
            showToast(`Digitizing fee mismatch in Caspio: Embroidery_Costs says $${bundleFee} (logo-card checkbox) but Service_Codes DD says $${ddFee} (services bar). Align them so both paths bill the same.`, 'warning', 10000);
        }
    }
}

/**
 * No-design-number nudge (expert audit 2026-07-07): a logo with no Design #
 * linked is usually a NEW logo, and forgetting the $100 new-logo setup is the
 * classic new-CSR under-quote. Soft hint only — repeat logos legitimately skip it.
 */
function updateDigitizingNudges() {
    [
        { designId: 'garment-design-number', checkboxId: 'primary-digitizing', nudgeId: 'garment-digitizing-nudge' },
        { designId: 'cap-design-number', checkboxId: 'cap-primary-digitizing', nudgeId: 'cap-digitizing-nudge' }
    ].forEach(({ designId, checkboxId, nudgeId }) => {
        const designEl = document.getElementById(designId);
        const cb = document.getElementById(checkboxId);
        const host = cb ? cb.closest('.digitizing-checkbox') : null;
        if (!designEl || !cb || !host) return;
        let nudge = document.getElementById(nudgeId);
        const cardVisible = host.offsetParent !== null;   // hidden card (e.g. no caps in quote) → no nudge
        const show = cardVisible && !designEl.value.trim() && !cb.checked;
        if (!show) { if (nudge) nudge.remove(); return; }
        if (nudge) return;   // already showing
        nudge = document.createElement('span');
        nudge.id = nudgeId;
        nudge.className = 'digitizing-nudge';
        nudge.textContent = 'No design # — new logo? Add new-logo setup';
        host.insertAdjacentElement('afterend', nudge);
    });
}

async function recalculatePricing() {
    // Keep the digitizing card labels honest + surface the new-logo nudge on every
    // reprice (both are cheap, idempotent DOM updates). (expert audit 2026-07-07)
    try { syncDigitizingPriceLabels(); updateDigitizingNudges(); } catch (_) {}
    // Stale-response guard: rapid edits fire overlapping recalcs, and an OLDER
    // calculateQuote resolving after a newer one overwrote fresher totals on
    // screen (the save path then snapshotted them). Only the latest call may
    // apply results. (audit 2026-06-10)
    const mySeq = (window._embRecalcSeq = (window._embRecalcSeq || 0) + 1);
    // Keep Additional-Logo rows tallied to the order's piece count + re-priced for the current
    // tier BEFORE we read the table — so a garment add/remove/qty change flows into the AL line.
    // (syncALRows early-returns if there are no AL rows; sets the qty programmatically so it
    //  doesn't re-fire onServiceQtyChange → no loop.) (Erik 2026-06-05)
    try { await syncALRows(); } catch (_) {}
    renderOrderRecap();  // keep the bottom Order Recap (customer / ship / logos) current on any recalc
    renderPushReadiness();  // keep the "At least one product" push-readiness check current (audit #8)
    // Collect products from table (parent rows only)
    const allItems = collectProductsFromTable();
    const productList = allItems.filter(p => !p.isService);
    const serviceItems = allItems.filter(p => p.isService);

    if (productList.length === 0) {
        // Sum ALL service items (DECG, DECC, Monogram, AL, etc.)
        let serviceOnlyTotal = 0;
        let totalQty = 0;
        let hasGarments = false;
        let hasCaps = false;

        serviceItems.forEach(si => {
            serviceOnlyTotal += si.unitPrice * si.totalQuantity;
            totalQty += si.totalQuantity;
            if (si.serviceType === 'decg' || !si.isCap) hasGarments = true;
            if (si.serviceType === 'decc' || si.isCap) hasCaps = true;

            // Update service row price/total cells (reflects overrides)
            const siRow = document.getElementById(`row-${si.rowId}`);
            const siPriceCell = document.getElementById(`row-price-${si.rowId}`);
            const siTotalCell = document.getElementById(`row-total-${si.rowId}`);
            const siHasOverride = siRow && parseFloat(siRow.dataset.sellPrice) > 0;
            if (siPriceCell) {
                if (siHasOverride) {
                    siPriceCell.classList.add('price-overridden');
                    siPriceCell.innerHTML = `<span class="price-override-wrapper">$${si.unitPrice.toFixed(2)}<button class="btn-clear-override" onclick="event.stopPropagation(); clearPriceOverride(${si.rowId})" title="Clear override">&times;</button></span>`;
                } else {
                    siPriceCell.classList.remove('price-overridden');
                    siPriceCell.textContent = `$${si.unitPrice.toFixed(2)}`;
                }
            }
            if (siTotalCell) {
                siTotalCell.textContent = `$${(si.unitPrice * si.totalQuantity).toFixed(2)}`;
            }
        });

        // Check for laser-patch cap setup fee
        const capEmbType = getCapEmbellishmentType();
        const capHasStyle = document.querySelector('tr[data-style]:not(.child-row) .cap-badge') !== null || hasCaps;
        const showPatchSetup = capEmbType === 'laser-patch' && capHasStyle && capPrimaryLogo.needsSetup;
        // Engine's patchSetupFee is the live Service_Codes GRT-50 value; EMB_DEFAULTS is fallback-only.
        const patchSetupFee = showPatchSetup
            ? (Number.isFinite(pricingCalculator?.patchSetupFee) ? pricingCalculator.patchSetupFee : EMB_DEFAULTS.PATCH_SETUP_FEE)
            : 0;

        // Determine tier based on total quantity
        const tier = totalQty <= 7 ? '1-7' : totalQty <= 23 ? '8-23' : totalQty <= 47 ? '24-47' : totalQty <= 71 ? '48-71' : '72+';

        updatePricingDisplay({
            totalQuantity: totalQty,
            tier: tier,
            subtotal: serviceOnlyTotal,
            ltmFee: 0,
            setupFees: patchSetupFee,
            capSetupFees: patchSetupFee,
            garmentSetupFees: 0,
            hasCaps: hasCaps || capHasStyle,
            hasGarments: hasGarments || serviceOnlyTotal > 0,
            grandTotal: serviceOnlyTotal + patchSetupFee
        });

        // Clear product price cells (not service rows)
        document.querySelectorAll('tr[data-style]:not(.service-product-row) .cell-price').forEach(cell => {
            cell.textContent = '-';
            cell.classList.remove('price-overridden');
        });
        return;
    }

    // Build logo configuration from global state (shared helper)
    const { logoConfigs, allLogos } = buildLogoConfiguration();

    // Show/hide LTM control panel based on quantities
    const garmentQtyForLtm = productList.filter(p => !p.isCap).reduce((s, p) => s + p.totalQuantity, 0);
    const capQtyForLtm = productList.filter(p => p.isCap).reduce((s, p) => s + p.totalQuantity, 0);
    const garmentHasLTM = garmentQtyForLtm > 0 && garmentQtyForLtm <= 7;
    const capHasLTM = capQtyForLtm > 0 && capQtyForLtm <= 7;
    const wouldHaveLTM = garmentHasLTM || capHasLTM;
    const ltmWrapper = document.getElementById('emb-ltm-wrapper');
    if (ltmWrapper) {
        if (wouldHaveLTM) {
            ltmWrapper.style.display = '';
            // Engine's ltmFee is the API-loaded LTM (Service_Codes); 50 is fallback-only.
            const apiLtmFee = Number.isFinite(parseFloat(pricingCalculator?.ltmFee)) ? parseFloat(pricingCalculator.ltmFee) : 50;
            const garmentLtmFee = garmentHasLTM ? apiLtmFee : 0;
            const capLtmFee = capHasLTM ? apiLtmFee : 0;
            const totalLtmFee = garmentLtmFee + capLtmFee;
            // Build label showing which types have LTM
            let feeLabel = 'Small Order Fee';
            if (garmentHasLTM && capHasLTM) {
                feeLabel = `Small Order Fee — Garments ($${apiLtmFee}) + Caps ($${apiLtmFee})`;
            } else if (garmentHasLTM) {
                feeLabel = 'Small Order Fee — Garments';
            } else if (capHasLTM) {
                feeLabel = 'Small Order Fee — Caps';
            }
            // Render panel if not yet rendered, or update fee amount
            if (!document.querySelector('#emb-ltm-panel .ltm-control-panel')) {
                renderLtmControlPanel('emb-ltm-panel', { feeAmount: totalLtmFee, feeLabel: feeLabel });
                initLtmControlListeners('emb-ltm-panel', () => {
                    recalculatePricing();
                    markAsUnsaved();
                });
            } else {
                setLtmControlState('emb-ltm-panel', { feeAmount: totalLtmFee });
                // Update header label for garment/cap changes
                const headerSpan = document.querySelector('#emb-ltm-panel .ltm-control-header span');
                if (headerSpan) headerSpan.textContent = feeLabel;
            }
        } else {
            ltmWrapper.style.display = 'none';
            setLtmControlState('emb-ltm-panel', { enabled: true, displayMode: 'builtin' });
        }
    }

    // Read LTM control state
    const ltmState = getLtmControlState('emb-ltm-panel');
    const ltmEnabled = wouldHaveLTM ? ltmState.enabled : true;
    const ltmDisplayMode = ltmState.displayMode || 'builtin';

    try {
        const pricing = await pricingCalculator.calculateQuote(productList, allLogos, logoConfigs, { ltmEnabled });

        // A newer recalc started while we were awaiting — discard this stale result.
        if (mySeq !== window._embRecalcSeq) return;

        // Never render $0.00 on a hard API/config failure — calculateQuote returns {success:false} in that
        // case; surface it instead of silently showing a wrong (zero) price. (review C4 — Erik's #1 rule)
        if (!pricing || pricing.success === false) {
            showToast((pricing && pricing.message) || 'Pricing unavailable — cannot price this quote. Refresh and try again.', 'error', 6000);
            return;
        }

        if (pricing) {
            // Update row prices - match line items to rows by style AND color
            // With different colors per extended size, we now get separate products for each color
            pricing.products.forEach((pp) => {
                const style = pp.product.style;
                const productCatalogColor = pp.product.catalogColor;
                // Match by BOTH style AND catalogColor to handle duplicate styles with different colors
                const parentRow = document.querySelector(`tr[data-style="${style}"][data-catalog-color="${productCatalogColor}"]:not(.child-row)`);

                if (!parentRow) return;

                const rowId = parentRow.dataset.rowId;
                const isParentColor = productCatalogColor === parentRow.dataset.catalogColor;

                if (pp.lineItems.length > 0) {
                    // For products matching the parent's color, update parent row price
                    if (isParentColor) {
                        // Find standard sizes line item (no upcharge)
                        const standardLineItem = pp.lineItems.find(li => !li.hasUpcharge);
                        if (standardLineItem) {
                            const priceCell = document.getElementById(`row-price-${rowId}`);
                            const totalCell = document.getElementById(`row-total-${rowId}`);
                            if (priceCell) {
                                // Display unit price — builtin mode shows LTM in price, separate mode shows base price
                                const displayPrice = (ltmDisplayMode === 'builtin')
                                    ? (standardLineItem.unitPriceWithLTM || standardLineItem.unitPrice || 0)
                                    : (standardLineItem.unitPrice || 0);
                                const hasOverride = parseFloat(parentRow.dataset.sellPrice) > 0;
                                const isNsRow = parentRow.dataset.nonSanmar === 'true';

                                if (isNsRow) {
                                    // Non-SanMar: pencil icon, no clear button (price override IS the price)
                                    priceCell.classList.remove('price-overridden');
                                    priceCell.classList.remove('ns-price-zero');
                                    priceCell.innerHTML = `<span class="ns-price-display" onclick="enablePriceOverride(${rowId})" title="Click to edit price">$${displayPrice.toFixed(2)} <i class="fas fa-pencil-alt"></i></span>`;
                                } else if (hasOverride) {
                                    priceCell.classList.add('price-overridden');
                                    priceCell.innerHTML = `<span class="price-override-wrapper">$${displayPrice.toFixed(2)}<button class="btn-clear-override" onclick="event.stopPropagation(); clearPriceOverride(${rowId})" title="Clear override">&times;</button></span>`;
                                } else {
                                    priceCell.classList.remove('price-overridden');
                                    priceCell.textContent = `$${displayPrice.toFixed(2)}`;
                                }

                                // Calculate and display line total
                                if (totalCell) {
                                    // Use parent row's displayed qty (excludes child rows)
                                    // standardLineItem.quantity includes child sizes, which is wrong for parent display
                                    const parentQtyCell = document.getElementById(`row-qty-${rowId}`);
                                    const qty = parseInt(parentQtyCell?.textContent) || 0;
                                    const lineTotal = displayPrice * qty;
                                    totalCell.textContent = qty > 0 ? `$${lineTotal.toFixed(2)}` : '-';
                                }
                            }

                            // Update pricing breakdown in description cell
                            const logoConfig = pp.isCap ? logoConfigs.cap.primary : logoConfigs.garment.primary;

                            // Find AL cost for this row from additionalServices
                            const rowAL = pricing.additionalServices?.find(al => al.rowId == rowId);
                            const lineItemWithAL = {
                                ...standardLineItem,
                                alCost: rowAL ? rowAL.unitPrice : 0
                            };
                            updateRowBreakdown(rowId, pp.product, lineItemWithAL, logoConfig);
                        }
                    }

                    // Update child row prices - match by BOTH size AND color
                    // A child row price only updates if its color matches this product's color
                    pp.lineItems.forEach(li => {
                        // First, try to get size from lineItem.size property (garments have this)
                        // If not available, fall back to parsing description (caps use "3XL(2)" format)
                        let sizesToCheck = [];
                        if (li.size) {
                            sizesToCheck = [li.size];
                        } else {
                            // Match ALL extended sizes in description (handles caps with "3XL(2)" format)
                            const description = li.description || '';
                            const extendedSizeRegex = new RegExp(
                                '(' + SIZE06_EXTENDED_SIZES.map(s => s.replace(/\//g, '\\/')).concat(['2XL', '\\d{4}']).join('|') + ')(?=\\(|\\s|$)',
                                'g'
                            );
                            sizesToCheck = description.match(extendedSizeRegex) || [];
                        }

                        sizesToCheck.forEach(size => {
                            const childRowId = childRowMap[rowId]?.[size];
                            if (childRowId) {
                                const childRow = document.getElementById(`row-${childRowId}`);
                                // Only update price if child row's color matches this product's color
                                if (childRow && childRow.dataset.catalogColor === productCatalogColor) {
                                    const childPriceCell = document.getElementById(`row-price-${childRowId}`);
                                    const childTotalCell = document.getElementById(`row-total-${childRowId}`);
                                    if (childPriceCell) {
                                        // Display unit price — builtin mode shows LTM in price, separate mode shows base price
                                        const displayPrice = (ltmDisplayMode === 'builtin')
                                            ? (li.unitPriceWithLTM || li.unitPrice || 0)
                                            : (li.unitPrice || 0);
                                        // Check parent override (child-specific overrides handled in post-processing)
                                        const childHasOwnOverride = parseFloat(childRow.dataset.sellPrice) > 0;
                                        const hasParentOverride = parseFloat(parentRow.dataset.sellPrice) > 0;
                                        if (hasParentOverride && !childHasOwnOverride) {
                                            childPriceCell.classList.add('price-overridden');
                                        } else if (!childHasOwnOverride) {
                                            childPriceCell.classList.remove('price-overridden');
                                        }
                                        childPriceCell.textContent = `$${displayPrice.toFixed(2)}`;

                                        // Calculate and display line total for child row
                                        if (childTotalCell) {
                                            // Extract quantity for THIS size from description
                                            // Format: "M(3) L(2) XL(1) XS(1)" - parse qty in parentheses after size
                                            const sizeQtyMatch = (li.description || '').match(new RegExp(size + '\\((\\d+)\\)'));
                                            const qty = sizeQtyMatch ? parseInt(sizeQtyMatch[1]) : (li.quantity || 0);
                                            const lineTotal = displayPrice * qty;
                                            childTotalCell.textContent = qty > 0 ? `$${lineTotal.toFixed(2)}` : '-';
                                        }
                                    }
                                }
                            }
                        });
                    });
                }
            });

            // Add service item totals (DECG/DECC) to pricing for mixed orders
            if (serviceItems.length > 0) {
                let serviceTotal = 0;
                serviceItems.forEach(si => {
                    serviceTotal += si.unitPrice * si.totalQuantity;

                    // Update service row price/total cells (reflects overrides)
                    const siRow = document.getElementById(`row-${si.rowId}`);
                    const siPriceCell = document.getElementById(`row-price-${si.rowId}`);
                    const siTotalCell = document.getElementById(`row-total-${si.rowId}`);
                    const siHasOverride = siRow && parseFloat(siRow.dataset.sellPrice) > 0;
                    if (siPriceCell) {
                        if (siHasOverride) {
                            siPriceCell.classList.add('price-overridden');
                            siPriceCell.innerHTML = `<span class="price-override-wrapper">$${si.unitPrice.toFixed(2)}<button class="btn-clear-override" onclick="event.stopPropagation(); clearPriceOverride(${si.rowId})" title="Clear override">&times;</button></span>`;
                        } else {
                            siPriceCell.classList.remove('price-overridden');
                            siPriceCell.textContent = `$${si.unitPrice.toFixed(2)}`;
                        }
                    }
                    if (siTotalCell) {
                        siTotalCell.textContent = `$${(si.unitPrice * si.totalQuantity).toFixed(2)}`;
                    }
                });
                pricing.subtotal += serviceTotal;
                pricing.grandTotal += serviceTotal;
            }

            // Post-process: per-size price overrides on child rows
            let childOverrideDelta = 0;
            document.querySelectorAll('#product-tbody tr.child-row').forEach(childRow => {
                const childOverride = parseFloat(childRow.dataset.sellPrice) || 0;
                if (childOverride <= 0) return;

                const childRowId = childRow.dataset.rowId;
                const childPriceCell = document.getElementById(`row-price-${childRowId}`);
                const childTotalCell = document.getElementById(`row-total-${childRowId}`);
                const childQtyCell = document.getElementById(`row-qty-${childRowId}`);
                if (!childPriceCell) return;

                // Get the calculated price currently in the cell
                const currentText = childPriceCell.textContent.replace(/[^0-9.]/g, '');
                const calculatedPrice = parseFloat(currentText) || 0;
                const qty = parseInt(childQtyCell?.textContent) || 0;

                // Override display
                childPriceCell.classList.add('price-overridden');
                childPriceCell.innerHTML = `<span class="price-override-wrapper">$${childOverride.toFixed(2)}<button class="btn-clear-override" onclick="event.stopPropagation(); clearPriceOverride(${childRowId})" title="Clear override">&times;</button></span>`;

                if (childTotalCell && qty > 0) {
                    childTotalCell.textContent = `$${(childOverride * qty).toFixed(2)}`;
                }

                // Track delta for total adjustment
                childOverrideDelta += (childOverride - calculatedPrice) * qty;
            });

            // Adjust totals if child overrides changed prices
            if (childOverrideDelta !== 0) {
                pricing.subtotal += childOverrideDelta;
                pricing.grandTotal += childOverrideDelta;
            }

            updatePricingDisplay(pricing);

            // Price-break ladder: fire-and-forget engine sim → fills in the real
            // $/pc savings on the nudge when it lands (seq-guarded). (2026-06-10)
            computeNudgeSavingsAsync(productList, allLogos, logoConfigs, ltmEnabled, pricing, mySeq);
        }
    } catch (error) {
        console.error('Pricing calculation error:', error);
        showToast('Pricing calculation error. Please try again.', 'error');
    }

    // Mark as dirty for auto-save (2026 consolidation)
    markEmbroideryDirty();
}

function collectProductsFromTable() {
    const products = [];
    // Only collect from parent rows (not child rows or AL config rows)
    const rows = document.querySelectorAll('#product-tbody tr:not(.child-row):not(.al-config-row):not(.fee-row):not(#empty-state-row)');

    rows.forEach(row => {
        const rowId = parseInt(row.id.replace('row-', ''));
        const style = row.dataset.style;

        // Handle SERVICE product rows (DECG, DECC, AL, MONOGRAM, etc.)
        if (row.dataset.productType === 'service') {
            const qtyInput = row.querySelector('.service-qty');
            const quantity = parseFloat(qtyInput?.value) || 0;  // parseFloat → fractional service qty (GRT-75 hours)

            if (quantity > 0) {
                const serviceType = row.dataset.serviceType;
                const isCap = row.dataset.isCap === 'true';
                const stitchCount = parseInt(row.dataset.stitchCount) || 8000;
                const position = row.dataset.position || '';
                // Use sell price override if set (DECG/DECC), otherwise original unit price
                const overridePrice = parseFloat(row.dataset.sellPrice) || 0;
                const unitPrice = overridePrice > 0 ? overridePrice : (parseFloat(row.dataset.unitPrice) || 0);

                products.push({
                    style: style,
                    isService: true,
                    serviceType: serviceType,
                    position: position,
                    stitchCount: stitchCount,
                    totalQuantity: quantity,
                    sizeBreakdown: { 'SVC': quantity }, // Use SVC as pseudo-size for services
                    isCap: isCap,
                    rowId: rowId,
                    unitPrice: unitPrice,
                    color: '',
                    catalogColor: '',
                    productName: row.querySelector('.service-description')?.textContent || style,
                    title: row.querySelector('.service-description')?.textContent || style
                });
            }
            return; // Skip normal product processing for service rows
        }

        const parentColor = row.dataset.color;
        const parentCatalogColor = row.dataset.catalogColor || '';

        if (!style || !parentColor) {
            console.warn(`[collectProducts] Skipping row ${rowId}: style="${style || ''}", color="${parentColor || ''}"`, row.dataset.importData || '');
            return;
        }

        // Group sizes by color - different colors become separate products
        const colorGroups = {};

        // Initialize parent color group
        colorGroups[parentCatalogColor] = {
            color: parentColor,
            catalogColor: parentCatalogColor,
            sizeBreakdown: {},
            totalQty: 0
        };

        // Collect size inputs from parent row (standard or remapped sizes)
        // IMPORTANT: Exclude .xxxl-picker-btn (shows TOTAL) and .osfa-qty-input (handled separately)
        // Note: For non-standard products (combo, youth, toddler, tall), data-size is remapped
        const sizeCategory = row.dataset.sizeCategory;
        row.querySelectorAll('.size-input:not(.xxxl-picker-btn):not(.osfa-qty-input):not(:disabled)').forEach(input => {
            const size = input.dataset.size;
            const qty = parseInt(input.value) || 0;
            if (qty > 0 && size) {
                colorGroups[parentCatalogColor].sizeBreakdown[size] = qty;
                colorGroups[parentCatalogColor].totalQty += qty;
            }
        });

        // Handle OSFA-only products (beanies, caps, bags)
        // OSFA qty is stored in parent row, not child rows
        if (row.dataset.isOsfaOnly === 'true') {
            const osfaQty = parseInt(row.dataset.osfaQty) || 0;
            if (osfaQty > 0) {
                colorGroups[parentCatalogColor].sizeBreakdown['OSFA'] = osfaQty;
                colorGroups[parentCatalogColor].totalQty += osfaQty;
            }
        }

        // Collect extended sizes from CHILD ROWS - GROUP BY COLOR
        // Child rows may have different colors than parent
        // Also collect per-size price overrides from child rows
        const sizeOverrides = {};
        const childRows = document.querySelectorAll(`tr[data-parent-row-id="${rowId}"]`);
        childRows.forEach(childRow => {
            const size = childRow.dataset.extendedSize;
            const childColor = childRow.dataset.color;
            const childCatalogColor = childRow.dataset.catalogColor || '';
            const qtyDisplay = childRow.querySelector('.qty-display');
            const qty = parseInt(qtyDisplay?.textContent) || 0;

            if (qty > 0 && size) {
                // Initialize color group if different from parent
                if (!colorGroups[childCatalogColor]) {
                    colorGroups[childCatalogColor] = {
                        color: childColor,
                        catalogColor: childCatalogColor,
                        sizeBreakdown: {},
                        totalQty: 0
                    };
                }

                colorGroups[childCatalogColor].sizeBreakdown[size] = qty;
                colorGroups[childCatalogColor].totalQty += qty;

                // Collect per-size price override if set
                const childOverride = parseFloat(childRow.dataset.sellPrice) || 0;
                if (childOverride > 0) {
                    sizeOverrides[size] = childOverride;
                }
            }
        });

        // Create product entry for each color group with quantities
        Object.entries(colorGroups).forEach(([catalogColor, group]) => {
            if (group.totalQty > 0) {
                const isCap = row.dataset.isCap === 'true';

                // Get global AL config for this product type
                const alConfig = isCap ? globalAL.cap : globalAL.garment;
                const additionalLogos = alConfig.enabled ? [{
                    id: `global-al-${isCap ? 'cap' : 'garment'}`,
                    position: alConfig.position,
                    stitchCount: alConfig.stitchCount,
                    quantity: group.totalQty
                }] : [];

                products.push({
                    style: style,
                    color: group.color,
                    catalogColor: group.catalogColor,
                    productName: row.dataset.productName || style,
                    title: row.dataset.productName || style,  // For invoice PDF description column
                    sizeBreakdown: group.sizeBreakdown,
                    totalQuantity: group.totalQty,
                    isCap: isCap,  // Cap detection for pricing routing
                    rowId: rowId,  // Track row for AL price updates
                    imageUrl: row.dataset.imageUrl || '',  // Image URL for quote view display
                    sellPriceOverride: parseFloat(row.dataset.sellPrice) || 0,  // Non-SanMar fixed sell price
                    sizeOverrides: sizeOverrides,  // Per-size price overrides from child rows (e.g., { '2XL': 27, '3XL': 29 })
                    _swUnitPrice: parseFloat(row.dataset.swUnitPrice) || 0,  // ShopWorks charged price for audit
                    logoAssignments: {
                        primary: { logoId: 'primary', quantity: group.totalQty },
                        additional: additionalLogos
                    }
                });
            }
        });
    });

    // Sort products: garments first, caps last (for consistent pricing display)
    products.sort((a, b) => {
        if (a.isCap === b.isCap) return 0;
        return a.isCap ? 1 : -1; // Garments first, caps last
    });

    return products;
}

function updatePricingDisplay(pricing) {
    // Failed AL/DECG rows get their Retry button here — this runs AFTER the recalc
    // body has repainted service-row cells, so the button isn't overwritten. (2026-07-07)
    try { renderPriceErrorRetries(); } catch (_) { }
    const totalQty = pricing.totalQuantity || 0;
    document.getElementById('total-qty').textContent = totalQty;
    document.getElementById('subtotal').textContent = `$${((pricing.subtotal || 0) + (pricing.ltmFee || 0)).toFixed(2)}`;
    updatePerUnitPrice((pricing.subtotal || 0) + (pricing.ltmFee || 0), pricing.totalQuantity || 0);
    // Category-aware nudge: EMB caps + garments tier SEPARATELY, so the combined
    // total promised tier breaks that adding the other category could never hit.
    // Savings $/pc arrives async from a real engine simulation (recalculatePricing).
    const nudgeTarget = computeEmbNudgeTarget(pricing.garmentQuantity || 0, pricing.capQuantity || 0);
    updateQuantityNudge(nudgeTarget.qty, 'emb', null, 'quantity-nudge', nudgeTarget.label);
    document.getElementById('grand-total').textContent = `$${(pricing.grandTotal || 0).toFixed(2)}`;

    // Minimum order warning banner — LTM is assessed PER CATEGORY (garments ≤7 and
    // caps ≤7 independently). Keying off combined qty hid the banner on a 5+5 mixed
    // order that carries TWO $50 fees, and understated when both applied.
    const minWarning = document.getElementById('min-order-warning');
    if (minWarning) {
        const gQ = pricing.garmentQuantity || 0;
        const cQ = pricing.capQuantity || 0;
        const gLtm = gQ > 0 && gQ <= 7;
        const cLtm = cQ > 0 && cQ <= 7;
        minWarning.style.display = (gLtm || cLtm) ? 'flex' : 'none';
        const msgEl = minWarning.querySelector('.min-order-warning-text') || minWarning.querySelector('span') || minWarning;
        const fee = Number.isFinite(parseFloat(pricingCalculator?.ltmFee)) ? parseFloat(pricingCalculator.ltmFee) : 50;
        if (gLtm && cLtm) {
            msgEl.textContent = `Garments (${gQ} pcs) and caps (${cQ} pcs) are each under the 8-piece minimum — two $${fee} small-order fees apply.`;
        } else if (gLtm) {
            msgEl.textContent = `Garments (${gQ} pcs) are under the 8-piece minimum — a $${fee} small-order fee applies.`;
        } else if (cLtm) {
            msgEl.textContent = `Caps (${cQ} pcs) are under the 8-piece minimum — a $${fee} small-order fee applies.`;
        }
    }

    // Update products label based on embellishment type
    const productsLabel = document.getElementById('products-label');
    if (productsLabel) {
        const capEmbType = getCapEmbellishmentType();
        if (capEmbType === 'laser-patch' && pricing.hasCaps && !pricing.hasGarments) {
            // Caps-only laser patch order - show "Products (Laser Patch):"
            productsLabel.textContent = 'Products (Laser Patch):';
        } else {
            // Default - embroidery with stitch count
            productsLabel.textContent = 'Products (Base 8K):';
        }
    }
    // Update the pre-tax subtotal (same as grand-total before tax)
    document.getElementById('pre-tax-subtotal').textContent = `$${(pricing.grandTotal || 0).toFixed(2)}`;

    // Quantity breakdown for mixed quotes
    const garmentQtyRow = document.getElementById('garment-qty-row');
    const capQtyRow = document.getElementById('cap-qty-row');
    const isMixedQuote = pricing.hasCaps && pricing.hasGarments;

    if (isMixedQuote) {
        garmentQtyRow.style.display = 'flex';
        capQtyRow.style.display = 'flex';
        document.getElementById('garment-qty').textContent = pricing.garmentQuantity || 0;
        document.getElementById('cap-qty').textContent = pricing.capQuantity || 0;
    } else {
        garmentQtyRow.style.display = 'none';
        capQtyRow.style.display = 'none';
    }

    // Tier display - show separate tiers for mixed quotes
    const pricingTierEl = document.getElementById('pricing-tier');
    const garmentTierRow = document.getElementById('garment-tier-row');
    const capTierRow = document.getElementById('cap-tier-row');

    if (isMixedQuote) {
        // Mixed quote - show "Mixed" and separate tier breakdown
        pricingTierEl.textContent = 'Mixed';
        garmentTierRow.style.display = 'flex';
        capTierRow.style.display = 'flex';
        document.getElementById('garment-tier').textContent = pricing.garmentTier || '1-7';
        document.getElementById('cap-tier').textContent = pricing.capTier || '1-7';
    } else if (pricing.hasCaps) {
        // Caps only
        pricingTierEl.textContent = pricing.capTier || '1-7';
        garmentTierRow.style.display = 'none';
        capTierRow.style.display = 'none';
    } else {
        // Garments only or no products
        pricingTierEl.textContent = pricing.garmentTier || pricing.tier || '1-7';
        garmentTierRow.style.display = 'none';
        capTierRow.style.display = 'none';
    }

    // Mixed quote subtotal breakdown (caps + garments)
    const garmentSubtotalRow = document.getElementById('garment-subtotal-row');
    const capSubtotalRow = document.getElementById('cap-subtotal-row');

    if (isMixedQuote) {
        // Show breakdown rows (LTM baked into subtotals)
        garmentSubtotalRow.style.display = 'flex';
        capSubtotalRow.style.display = 'flex';
        document.getElementById('garment-subtotal').textContent = `$${((pricing.garmentSubtotal || 0) + (pricing.garmentLtmFee || 0)).toFixed(2)}`;
        document.getElementById('cap-subtotal').textContent = `$${((pricing.capSubtotal || 0) + (pricing.capLtmFee || 0)).toFixed(2)}`;
    } else if (pricing.hasCaps && !pricing.hasGarments) {
        // Caps only - show just cap breakdown (LTM baked in)
        garmentSubtotalRow.style.display = 'none';
        capSubtotalRow.style.display = 'flex';
        document.getElementById('cap-subtotal').textContent = `$${((pricing.capSubtotal || 0) + (pricing.capLtmFee || 0)).toFixed(2)}`;
    } else if (pricing.hasGarments && !pricing.hasCaps) {
        // Garments only - hide breakdown rows (default view)
        garmentSubtotalRow.style.display = 'none';
        capSubtotalRow.style.display = 'none';
    } else {
        // No products
        garmentSubtotalRow.style.display = 'none';
        capSubtotalRow.style.display = 'none';
    }

    // LTM fee rows: show only in "separate" display mode
    const ltmState = getLtmControlState('emb-ltm-panel');
    const ltmDisplayMode = ltmState.displayMode || 'builtin';
    const ltmEnabled = ltmState.enabled;
    const garmentLtmTableRow = document.getElementById('garment-ltm-table-row');
    const capLtmTableRow = document.getElementById('cap-ltm-table-row');
    if (ltmDisplayMode === 'separate' && ltmEnabled) {
        if (garmentLtmTableRow) {
            const showGarment = (pricing.garmentLtmFee || 0) > 0;
            garmentLtmTableRow.style.display = showGarment ? 'table-row' : 'none';
            if (showGarment) {
                document.getElementById('garment-ltm-unit').textContent = `$${pricing.garmentLtmFee.toFixed(2)}`;
                document.getElementById('garment-ltm-table-total').textContent = `$${pricing.garmentLtmFee.toFixed(2)}`;
            }
        }
        if (capLtmTableRow) {
            const showCap = (pricing.capLtmFee || 0) > 0;
            capLtmTableRow.style.display = showCap ? 'table-row' : 'none';
            if (showCap) {
                document.getElementById('cap-ltm-unit').textContent = `$${pricing.capLtmFee.toFixed(2)}`;
                document.getElementById('cap-ltm-table-total').textContent = `$${pricing.capLtmFee.toFixed(2)}`;
            }
        }
    } else {
        // builtin mode or LTM waived: hide fee rows
        if (garmentLtmTableRow) garmentLtmTableRow.style.display = 'none';
        if (capLtmTableRow) capLtmTableRow.style.display = 'none';
    }

    // Setup (Digitizing) row - table row only (sidebar removed in 2026 refactor)
    const setupFeeTableRow = document.getElementById('setup-fee-table-row');
    const setupFeeUnit = document.getElementById('setup-fee-unit');
    const setupFeeTotal = document.getElementById('setup-fee-total');

    // Check cap embellishment type for label
    const capEmbType = getCapEmbellishmentType();
    const isCapLaserPatch = capEmbType === 'laser-patch';

    if (pricing.setupFees > 0) {
        if (setupFeeTableRow) {
            setupFeeTableRow.style.display = 'table-row';
            // Update label based on what's in quote
            const hasCapSetup = (pricing.capSetupFees || 0) > 0;
            const hasGarmentSetup = (pricing.garmentSetupFees || 0) > 0;
            const setupLabel = setupFeeTableRow.querySelector('.fee-label');
            if (setupLabel) {
                if (hasCapSetup && !hasGarmentSetup && isCapLaserPatch) {
                    setupLabel.innerHTML = '<i class="fas fa-cog"></i> GRT-50 : Laser Patch Setup';
                } else {
                    setupLabel.innerHTML = '<i class="fas fa-cog"></i> Digitizing/Setup Fee';
                }
            }
            if (setupFeeUnit) setupFeeUnit.textContent = `$${pricing.setupFees.toFixed(2)}`;
            if (setupFeeTotal) setupFeeTotal.textContent = `$${pricing.setupFees.toFixed(2)}`;
        }
    } else {
        if (setupFeeTableRow) setupFeeTableRow.style.display = 'none';
    }

    // Additional Stitches fee rows (AS-GARM / AS-CAP)
    // Stitch fees are calculated by the pricing engine and included in grandTotal
    // These rows provide visible feedback to the user
    const garmentStitchFeeRow = document.getElementById('garment-stitch-fee-row');
    const capStitchFeeRow = document.getElementById('cap-stitch-fee-row');

    if (pricing.garmentStitchTotal > 0) {
        if (garmentStitchFeeRow) {
            garmentStitchFeeRow.style.display = 'table-row';
            const garmentQty = pricing.garmentQuantity || 0;
            const unitPrice = garmentQty > 0 ? pricing.garmentStitchTotal / garmentQty : 0;
            document.getElementById('garment-stitch-fee-qty').textContent = garmentQty;
            document.getElementById('garment-stitch-fee-unit').textContent = `$${unitPrice.toFixed(2)}`;
            document.getElementById('garment-stitch-fee-total').textContent = `$${pricing.garmentStitchTotal.toFixed(2)}`;
        }
    } else {
        if (garmentStitchFeeRow) garmentStitchFeeRow.style.display = 'none';
    }

    if (pricing.capStitchTotal > 0) {
        if (capStitchFeeRow) {
            capStitchFeeRow.style.display = 'table-row';
            const capQty = pricing.capQuantity || 0;
            const unitPrice = capQty > 0 ? pricing.capStitchTotal / capQty : 0;
            document.getElementById('cap-stitch-fee-qty').textContent = capQty;
            document.getElementById('cap-stitch-fee-unit').textContent = `$${unitPrice.toFixed(2)}`;
            document.getElementById('cap-stitch-fee-total').textContent = `$${pricing.capStitchTotal.toFixed(2)}`;
        }
    } else {
        if (capStitchFeeRow) capStitchFeeRow.style.display = 'none';
    }

    // ============================================
    // Additional Logo (AL) fee rows + sidebar display
    // Uses pricing engine's additionalServices — no duplicate calculation
    // ============================================
    const garmentAlFeeRow = document.getElementById('garment-al-fee-row');
    const capAlFeeRow = document.getElementById('cap-al-fee-row');

    // Find garment AL and cap AL from pricing engine results
    const garmentALServices = (pricing.additionalServices || []).filter(s => s.type === 'additional_logo' && !s.isCap);
    const capALServices = (pricing.additionalServices || []).filter(s => s.type === 'additional_logo' && s.isCap);

    // Garment AL fee row
    const garmentALTotal = garmentALServices.reduce((sum, s) => sum + s.total, 0);
    if (garmentALTotal > 0 && garmentALServices.length > 0) {
        if (garmentAlFeeRow) {
            garmentAlFeeRow.style.display = 'table-row';
            const garmentALQty = garmentALServices.reduce((sum, s) => sum + s.quantity, 0);
            const garmentALUnitPrice = garmentALQty > 0 ? garmentALTotal / garmentALQty : 0;
            document.getElementById('garment-al-fee-qty').textContent = garmentALQty;
            document.getElementById('garment-al-fee-unit').textContent = `$${garmentALUnitPrice.toFixed(2)}`;
            document.getElementById('garment-al-fee-total').textContent = `$${garmentALTotal.toFixed(2)}`;
        }
    } else {
        if (garmentAlFeeRow) garmentAlFeeRow.style.display = 'none';
    }

    // Cap AL fee row
    const capALTotal = capALServices.reduce((sum, s) => sum + s.total, 0);
    if (capALTotal > 0 && capALServices.length > 0) {
        if (capAlFeeRow) {
            capAlFeeRow.style.display = 'table-row';
            const capALQty = capALServices.reduce((sum, s) => sum + s.quantity, 0);
            const capALUnitPrice = capALQty > 0 ? capALTotal / capALQty : 0;
            document.getElementById('cap-al-fee-qty').textContent = capALQty;
            document.getElementById('cap-al-fee-unit').textContent = `$${capALUnitPrice.toFixed(2)}`;
            document.getElementById('cap-al-fee-total').textContent = `$${capALTotal.toFixed(2)}`;
        }
    } else {
        if (capAlFeeRow) capAlFeeRow.style.display = 'none';
    }

    // Sidebar summary display
    const alContainer = document.getElementById('additional-logos-pricing');
    if (garmentALTotal > 0) {
        const garmentALSideQty = garmentALServices.reduce((sum, s) => sum + s.quantity, 0);
        const garmentALSideUnit = garmentALSideQty > 0 ? garmentALTotal / garmentALSideQty : 0;
        alContainer.innerHTML = `
            <div class="pricing-row al-pricing-row">
                <span class="label"><i class="fas fa-tshirt" style="font-size: 10px; margin-right: 3px;"></i> AL:</span>
                <span class="value">$${garmentALTotal.toFixed(2)}</span>
            </div>
            <div class="pricing-row sub-breakdown">
                <span class="label">$${garmentALSideUnit.toFixed(2)} × ${garmentALSideQty}</span>
                <span class="value sub-value"></span>
            </div>
        `;
    } else {
        alContainer.innerHTML = '';
    }

    const capAlContainer = document.getElementById('cap-additional-logos-pricing');
    if (capALTotal > 0) {
        const capALSideQty = capALServices.reduce((sum, s) => sum + s.quantity, 0);
        const capALSideUnit = capALSideQty > 0 ? capALTotal / capALSideQty : 0;
        capAlContainer.innerHTML = `
            <div class="pricing-row al-pricing-row cap-al">
                <span class="label"><i class="fas fa-hat-cowboy" style="font-size: 10px; margin-right: 3px;"></i> AL-Cap:</span>
                <span class="value">$${capALTotal.toFixed(2)}</span>
            </div>
            <div class="pricing-row sub-breakdown">
                <span class="label">$${capALSideUnit.toFixed(2)} × ${capALSideQty}</span>
                <span class="value sub-value"></span>
            </div>
        `;
    } else {
        capAlContainer.innerHTML = '';
    }

    // ============================================
    // Cap Embellishment Upcharge Fee Row (3D-EMB / Laser Patch)
    // Extracted from per-piece price as separate fee item for ShopWorks
    // ============================================
    const capEmbFeeRow = document.getElementById('cap-embellishment-fee-row');
    const capEmbFeeLabel = document.getElementById('cap-embellishment-fee-label');
    const puffTotal = pricing.puffUpchargePerCap > 0 ? pricing.puffUpchargePerCap * (pricing.capQuantity || 0) : 0;
    const patchTotal = pricing.patchUpchargePerCap > 0 ? pricing.patchUpchargePerCap * (pricing.capQuantity || 0) : 0;
    const capEmbTotal = puffTotal + patchTotal;

    if (capEmbTotal > 0 && capEmbFeeRow) {
        capEmbFeeRow.style.display = 'table-row';
        const capQty = pricing.capQuantity || 0;
        const unitPrice = pricing.puffUpchargePerCap || pricing.patchUpchargePerCap || 0;
        if (capEmbFeeLabel) {
            if (puffTotal > 0) {
                capEmbFeeLabel.textContent = '3D-EMB : 3D Puff Upcharge';
            } else {
                capEmbFeeLabel.textContent = 'Laser Patch : Patch Upcharge';
            }
        }
        document.getElementById('cap-embellishment-fee-qty').textContent = capQty;
        document.getElementById('cap-embellishment-fee-unit').textContent = `$${unitPrice.toFixed(2)}`;
        document.getElementById('cap-embellishment-fee-total').textContent = `$${capEmbTotal.toFixed(2)}`;
    } else {
        if (capEmbFeeRow) capEmbFeeRow.style.display = 'none';
    }

    // ============================================
    // Additional Logo Digitizing Fee Rows
    // Digitizing fees are now counted in pricing engine via logoConfigs.additional
    // These display rows show/hide based on globalAL state
    // ============================================
    const garmentAlDigitizingRow = document.getElementById('garment-al-digitizing-row');
    const garmentAlDigitizingPosition = document.getElementById('garment-al-digitizing-position');

    if (globalAL.garment.enabled && globalAL.garment.needsDigitizing && pricing.garmentQuantity > 0) {
        if (garmentAlDigitizingRow) garmentAlDigitizingRow.style.display = 'table-row';
        if (garmentAlDigitizingPosition) garmentAlDigitizingPosition.textContent = 'AL';
    } else {
        if (garmentAlDigitizingRow) garmentAlDigitizingRow.style.display = 'none';
    }

    const capAlDigitizingRow = document.getElementById('cap-al-digitizing-row');
    const capAlDigitizingPosition = document.getElementById('cap-al-digitizing-position');

    if (globalAL.cap.enabled && globalAL.cap.needsDigitizing && pricing.capQuantity > 0) {
        if (capAlDigitizingRow) capAlDigitizingRow.style.display = 'table-row';
        if (capAlDigitizingPosition) capAlDigitizingPosition.textContent = 'AL-Cap';
    } else {
        if (capAlDigitizingRow) capAlDigitizingRow.style.display = 'none';
    }

    // (Additional Logo rows are re-priced from the API on add / qty-change — their
    // dataset.unitPrice is already current here, so they sum in like any service row.)
    // Rush Fee = 25% of the merchandise subtotal — recompute its line item before tax
    syncRushRow();
    // Update tax calculation at the end of pricing display
    updateTaxCalculation();
}

/**
 * Calculate the discountable subtotal consistently across all functions.
 * Includes: products grandTotal + art charge + graphic design + rush fee + sample fees
 * LTM is already baked into grandTotal so no separate LTM addition needed.
 * @returns {{ baseSubtotal: number, additionalCharges: number, discountableSubtotal: number, discount: number, adjustedSubtotal: number }}
 */
function calculateDiscountableSubtotal() {
    const baseSubtotalText = document.getElementById('grand-total')?.textContent || '$0.00';
    const baseSubtotal = parseFloat(baseSubtotalText.replace(/[$,]/g, '')) || 0;

    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artCharge = artChargeToggle?.checked
        ? (parseFloat(document.getElementById('art-charge')?.value) || 0) : 0;
    const designFee = (parseFloat(document.getElementById('graphic-design-hours')?.value) || 0) * getServicePrice('GRT-75', 75);  // GRT-75 rate from Service_Codes API, not hardcoded (review C8)
    const rushFee = parseFloat(document.getElementById('rush-fee')?.value) || 0;
    const sampleFee = parseFloat(document.getElementById('sample-fee')?.value) || 0;
    const sampleQty = parseInt(document.getElementById('sample-qty')?.value) || 1;
    const shippingFee = parseFloat(document.getElementById('shipping-fee')?.value) || 0;

    const additionalCharges = artCharge + designFee + rushFee + (sampleFee * sampleQty) + shippingFee;
    const discountableSubtotal = baseSubtotal + additionalCharges;

    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value) || 0;
    const discountType = document.getElementById('discount-type')?.value || 'fixed';

    let discount = 0;
    if (discountType === 'percent') {
        discount = discountableSubtotal * (discountAmount / 100);
    } else {
        discount = discountAmount;
    }

    // Cap discount at subtotal to prevent negative totals
    if (discount > discountableSubtotal && discountableSubtotal > 0) {
        discount = discountableSubtotal;
        showToast('Discount capped at subtotal amount', 'warning');
    }

    return {
        baseSubtotal,
        additionalCharges,
        discountableSubtotal,
        discount,
        adjustedSubtotal: discountableSubtotal - discount
    };
}

// ============================================================
// TAX RATE LOOKUP (WA DOR API)
// ============================================================

/**
 * Show status message in the tax lookup status area
 * @param {string} message - Status text
 * @param {string} type - 'success'|'warning'|'error'|'loading'|'info'
 */
function showTaxStatus(message, type) {
    const el = document.getElementById('tax-lookup-status');
    if (!el) return;

    const colors = {
        success: '#16a34a',
        warning: '#d97706',
        error: '#dc2626',
        loading: '#6366f1',
        info: '#0284c7'
    };

    const icons = {
        success: '<i class="fas fa-check-circle"></i> ',
        warning: '<i class="fas fa-exclamation-triangle"></i> ',
        error: '<i class="fas fa-times-circle"></i> ',
        loading: '<i class="fas fa-spinner fa-spin"></i> ',
        info: '<i class="fas fa-info-circle"></i> '
    };

    el.style.color = colors[type] || '#64748b';
    el.innerHTML = (icons[type] || '') + message;
}

// [2026-06-07] Wholesale / reseller toggle (per-order checkbox by the sales tax). ON → zero the tax, uncheck
// include-tax, and flag the order so the ShopWorks push routes it to the Wholesale Sales account (2203). OFF →
// re-enable tax + re-look-up the destination rate. The flag is the ONLY trigger for wholesale — never inferred
// from a $0 rate (a failed lookup must not silently become wholesale → no tax). Erik's #1 rule.
function toggleWholesale() {
    const cb = document.getElementById('wholesale-checkbox');
    window._isWholesale = !!(cb && cb.checked);
    const incTax = document.getElementById('include-tax');
    const rateInput = document.getElementById('tax-rate-input');
    if (window._isWholesale) {
        if (incTax) incTax.checked = false;
        if (rateInput) rateInput.value = '0';
        if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
        if (typeof showTaxStatus === 'function') showTaxStatus('Wholesale / reseller — no tax', 'info');
    } else {
        if (incTax) incTax.checked = true;
        if (typeof updateTaxCalculation === 'function') updateTaxCalculation();
        if (typeof lookupTaxRate === 'function') lookupTaxRate(); // re-fetch the real rate for the ship address
    }
}

/**
 * Look up WA tax rate via DOR API
 * Called on ZIP blur, state change, and manual button click
 */
async function lookupTaxRate() {
    // P0 (audit 2026-06-06, Erik's #1 rule): during an edit-reload the saved tax rate is restored
    // synchronously, but a pickup quote's onShipMethodChange fires this async lookup, which resolves
    // LATER and would silently overwrite the frozen rate with today's live Milton DOR rate. No-op while
    // restoring — the saved rate stands; the load's finally re-enables live lookups for the rep.
    if (window._restoringQuote) return false;
    // [B8] (audit 2026-06-06): a tax-exempt customer — OR a wholesale/reseller order ([2026-06-07]) — must
    // stay 0% even after a Pickup→Ship toggle re-runs this lookup, else WA tax is silently re-applied. #1 rule.
    if (window._taxExempt || window._isWholesale) {
        const rateInput = document.getElementById('tax-rate-input');
        if (rateInput) rateInput.value = '0';
        const incTax = document.getElementById('include-tax');
        if (incTax) incTax.checked = false;
        updateTaxCalculation();
        showTaxStatus(window._isWholesale ? 'Wholesale / reseller — no tax' : 'Tax Exempt customer — no tax', 'info');
        return false;
    }
    const state = document.getElementById('ship-state').value;
    const zip = document.getElementById('ship-zip').value.trim();
    const city = document.getElementById('ship-city').value.trim();
    const address = document.getElementById('ship-address').value.trim();

    // Non-WA state → 0% tax
    if (state !== 'WA') {
        document.getElementById('tax-rate-input').value = '0';
        updateTaxCalculation();
        showTaxStatus('Out of State — No Tax', 'info');
        return true;
    }

    // Need at least a ZIP code
    if (!zip || zip.length < 5) {
        showTaxStatus('Enter ZIP code to look up rate', 'info');
        return false;
    }

    try {
        showTaxStatus('Looking up tax rate...', 'loading');
        const resp = await fetch(`${API_BASE}/api/tax-rates/lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, city, state, zip })
        });
        if (!resp.ok) {
            throw new Error(`API returned ${resp.status}`);
        }
        const data = await resp.json();

        if (!data.success) {
            showTaxStatus(data.error || 'Lookup failed', 'error');
            return false;
        }

        document.getElementById('tax-rate-input').value = data.taxRate;
        updateTaxCalculation();

        if (data.outOfState) {
            showTaxStatus('Out of State — No Tax', 'info');
        } else if (data.fallback) {
            showTaxStatus(`Default rate ${data.taxRate}% (DOR unavailable)`, 'warning');
        } else {
            const locationLabel = city || data.locationCode || 'WA';
            showTaxStatus(`${locationLabel} — ${data.taxRate}% (Account ${data.account})`, 'success');
        }
        return true;
    } catch (err) {
        console.error('[Tax Lookup] Error:', err);
        showTaxStatus('Lookup failed — using current rate', 'error');
        return false;
    }
}

/**
 * Handle state dropdown change
 * If non-WA, set tax to 0%. If WA with ZIP, trigger lookup.
 */
function onShipStateChange() {
    const state = document.getElementById('ship-state').value;
    if (state !== 'WA') {
        document.getElementById('tax-rate-input').value = '0';
        updateTaxCalculation();
        showTaxStatus('Out of State — No Tax', 'info');
    } else {
        const zip = document.getElementById('ship-zip').value.trim();
        if (zip && zip.length >= 5) {
            lookupTaxRate();
        } else {
            // Reset to WA default
            document.getElementById('tax-rate-input').value = '10.2';
            updateTaxCalculation();
            showTaxStatus('', 'info');
        }
    }
}

/**
 * Handle ZIP code blur — trigger lookup if WA + valid ZIP
 */
function onShipZipBlur() {
    const state = document.getElementById('ship-state').value;
    const zip = document.getElementById('ship-zip').value.trim();
    if (state === 'WA' && zip.length >= 5) {
        lookupTaxRate();
    }
}

/**
 * Handle ship method dropdown change.
 * When "Customer Pickup" selected, hide address fields and auto-set Milton, WA for tax.
 * When "Other" selected, show custom text input.
 */
function onShipMethodChange() {
    const method = document.getElementById('ship-method').value;
    const isPickup = method === 'Customer Pickup';
    const carrierWrap = document.getElementById('ship-carrier-wrap');
    const pickupNotice = document.getElementById('pickup-notice');
    const otherInput = document.getElementById('ship-method-other');
    const pickupBtn = document.getElementById('ship-mode-pickup');
    const shipBtn = document.getElementById('ship-mode-ship');

    // Keep the Pickup / Ship-it segmented toggle in sync with the method value
    // (so a programmatic change — load, import, draft restore — repaints it too).
    if (pickupBtn) pickupBtn.classList.toggle('active', isPickup);
    if (shipBtn) shipBtn.classList.toggle('active', !isPickup);
    if (carrierWrap) carrierWrap.style.display = isPickup ? 'none' : '';

    if (isPickup) {
        if (pickupNotice) pickupNotice.style.display = 'block';
        if (otherInput) otherInput.style.display = 'none';
        // Auto-set Milton, WA 98354 + clear estimated freight — but NOT during an edit-reload.
        // P2-7 (audit 2026-06-06): a saved Pickup quote may hold a real ship-to (e.g. an imported OOS
        // address) that restoreEmbOrderShipping just restored; clobbering it to Milton here would wipe it
        // and a Save Revision would persist Milton. Skip the clobber + freight-clear while restoring.
        if (!window._restoringQuote) {
            document.getElementById('ship-address').value = '';
            document.getElementById('ship-city').value = 'Milton';
            document.getElementById('ship-state').value = 'WA';
            document.getElementById('ship-zip').value = '98354';
            // P1-1 (audit 2026-06-06): clear any previously-estimated freight when switching back to Pickup —
            // otherwise phantom freight is billed + taxed + saved as a SHIP line + pushed to cur_Shipping.
            const _pickupShipFee = document.getElementById('shipping-fee');
            if (_pickupShipFee && parseFloat(_pickupShipFee.value) > 0) {
                _pickupShipFee.value = '0';
                if (typeof updateAdditionalCharges === 'function') updateAdditionalCharges();
            }
        }
        lookupTaxRate();
    } else {
        if (pickupNotice) pickupNotice.style.display = 'none';
        // Show/hide the "Other" free-text method input
        if (otherInput) {
            otherInput.style.display = (method === 'Other') ? 'block' : 'none';
        }
    }
    updateShippingSummary();
    renderShipToCard();  // [2026-06-07] refresh the ship-to card on mode/method change
}

/**
 * Pickup / Ship-it segmented toggle (2026-06-02 order-flow redesign).
 * Sets the underlying #ship-method value, then lets onShipMethodChange()
 * render the conditional UI. Switching to Ship restores the last looked-up
 * customer ship-to (stashed in applyContact) so the rep doesn't retype it.
 */
function setShipMode(mode) {
    const select = document.getElementById('ship-method');
    if (!select) return;
    if (mode === 'pickup') {
        select.value = 'Customer Pickup';
    } else {
        // Leaving pickup → default to UPS Ground (most common carrier)
        const wasPickup = select.value === 'Customer Pickup';
        if (wasPickup) select.value = 'UPS Ground';
        // [2026-06-07] Clear the Milton pickup defaults (onShipMethodChange stamps city=Milton/state=WA/zip=98354
        // for the pickup tax) so they don't masquerade as the ship-to DESTINATION — bug: Pickup→Ship left "Milton"
        // in the city. The rep types the real address, or it's restored from the last customer just below. Guard
        // on _restoringQuote so an edit-reload of a real saved ship-to isn't wiped.
        if (wasPickup && !window._restoringQuote) {
            ['ship-address', 'ship-city', 'ship-state', 'ship-zip'].forEach((id) => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
        }
        // Pre-fill the address from the last selected customer, if we have it
        const stash = window._lastCustomerShipTo;
        const zipEl = document.getElementById('ship-zip');
        if (stash && zipEl && !zipEl.value.trim()) {
            const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
            set('ship-address', stash.address);
            set('ship-city', stash.city);
            if (stash.state) { const st = document.getElementById('ship-state'); if (st) st.value = stash.state; }
            set('ship-zip', stash.zip);
        }
    }
    onShipMethodChange();
    // In ship mode, refresh the tax rate for the shown address (if any)
    if (mode === 'ship') {
        const zip = document.getElementById('ship-zip')?.value?.trim();
        if (zip && zip.length >= 5) lookupTaxRate();
    }
}
window.setShipMode = setShipMode;

/**
 * Update the Step-3 shipping summary line from the current shipping state.
 * (2026-06-02 — the shipping editor moved into #shipping-modal; Step 3 and the
 * invoice "Shipping" totals line both open it and show this summary.)
 */
function updateShippingSummary() {
    const el = document.getElementById('shipping-summary');
    if (!el) return;
    const method = document.getElementById('ship-method')?.value || '';
    const isPickup = method === 'Customer Pickup';
    const rate = (document.getElementById('tax-rate-input')?.value || '').trim();
    const ratePart = rate ? ` · ${rate}% tax` : '';
    if (isPickup) {
        el.textContent = `Customer Pickup — Milton, WA${ratePart}`;
    } else {
        const city = (document.getElementById('ship-city')?.value || '').trim();
        const state = document.getElementById('ship-state')?.value || '';
        const zip = (document.getElementById('ship-zip')?.value || '').trim();
        const loc = [[city, state].filter(Boolean).join(', '), zip].filter(Boolean).join(' ');
        const m = (method === 'Other')
            ? ((document.getElementById('ship-method-other')?.value || '').trim() || 'Other')
            : method;
        el.textContent = `${m}${loc ? ' — ' + loc : ' — (enter address)'}${ratePart}`;
    }
}
window.updateShippingSummary = updateShippingSummary;

/** Open the shipping editor modal (from the totals line or Step 3). (2026-06-02) */
function openShippingModal() {
    const m = document.getElementById('shipping-modal');
    if (m) m.classList.add('open');
}
/** Close the shipping modal and refresh the summary + totals. */
function closeShippingModal() {
    const m = document.getElementById('shipping-modal');
    if (m) m.classList.remove('open');
    updateShippingSummary();
    updateTaxCalculation();
    renderShipToCard();  // [2026-06-07] show the entered ship-to address in the glance band
}
window.openShippingModal = openShippingModal;
window.closeShippingModal = closeShippingModal;

/**
 * Update tax calculation based on toggle state
 * Uses shared calculateDiscountableSubtotal() for consistent discount math
 * Called after pricing updates and when any charge input changes
 */
function updateTaxCalculation() {
    const includeTax = document.getElementById('include-tax')?.checked ?? true;
    const { adjustedSubtotal } = calculateDiscountableSubtotal();

    const rateInput = document.getElementById('tax-rate-input');
    // parseRatePercent: an empty/cleared input rendered "$NaN" and saved a
    // "Sales Tax (NaN%)" item; 0 stays a valid rate. Same fallback as the save path.
    const taxRate = parseRatePercent(rateInput?.value, 10.2) / 100;

    const taxRow = document.getElementById('tax-row');
    const taxAmountEl = document.getElementById('tax-amount');
    const grandTotalWithTax = document.getElementById('grand-total-with-tax');
    const preTaxSubtotal = document.getElementById('pre-tax-subtotal');

    if (!taxRow || !taxAmountEl || !grandTotalWithTax) return;

    // #pre-tax-subtotal is the CANONICAL full pre-tax amount (products + services
    // + shipping − discount). The save path reads it, so keep it accurate. It is
    // a hidden carrier now; the visible "Subtotal" line below excludes shipping.
    if (preTaxSubtotal) {
        preTaxSubtotal.textContent = '$' + adjustedSubtotal.toFixed(2);
    }

    // Shipping line under the invoice: "Customer Pickup" when picking up,
    // otherwise the shipping charge. (2026-06-02 — totals moved under line items)
    const shippingFee = parseFloat(document.getElementById('shipping-fee')?.value) || 0;
    const isPickup = (document.getElementById('ship-method')?.value === 'Customer Pickup');
    const shipAmtEl = document.getElementById('it-shipping-amt');
    if (shipAmtEl) {
        if (isPickup) {
            shipAmtEl.textContent = 'Customer Pickup';
            shipAmtEl.classList.add('is-pickup');
        } else {
            shipAmtEl.classList.remove('is-pickup');
            if (shippingFee > 0) {
                shipAmtEl.textContent = '$' + shippingFee.toFixed(2);
            } else {
                // No charge entered yet — show the carrier so it doesn't read as "$0.00"
                const m = document.getElementById('ship-method')?.value || '';
                shipAmtEl.textContent = (m === 'Other')
                    ? ((document.getElementById('ship-method-other')?.value || '').trim() || 'Other')
                    : (m || 'Ship');
            }
        }
    }

    // Visible "Subtotal" line = everything pre-tax EXCEPT shipping (shipping is
    // its own line). Subtotal + Shipping = the taxable base (adjustedSubtotal).
    const subtotalDisplay = document.getElementById('invoice-subtotal-display');
    if (subtotalDisplay) subtotalDisplay.textContent = '$' + (adjustedSubtotal - shippingFee).toFixed(2);

    // Sales Tax label shows the effective rate when charged; "(exempt)"/"(not charged)" when $0,
    // and the row stays visible for invoice transparency (best-of-both level-up 2026-06-14).
    const taxLabel = document.getElementById('tax-label');
    const _embRateRaw = (document.getElementById('tax-rate-input')?.value || '').trim();
    if (taxLabel) taxLabel.textContent = (includeTax && parseFloat(_embRateRaw) > 0)
        ? `Sales Tax (${_embRateRaw}%)`
        : ((window._isWholesale || window._taxExempt) ? 'Sales Tax (exempt)' : 'Sales Tax (not charged)');

    if (includeTax) {
        // Round tax BEFORE summing (gotcha rule) — the save path does, so an
        // unrounded sum here could show a grand total 1¢ off the saved one.
        const tax = Math.round(adjustedSubtotal * taxRate * 100) / 100;
        taxAmountEl.textContent = '$' + tax.toFixed(2);
        grandTotalWithTax.textContent = '$' + (adjustedSubtotal + tax).toFixed(2);
    } else {
        // Keep the tax row visible (it holds the re-enable checkbox); zero the amount.
        taxAmountEl.textContent = '$0.00';
        grandTotalWithTax.textContent = '$' + adjustedSubtotal.toFixed(2);
    }

    // Always-visible sidebar TOTAL bar (ux-flow 2026-06-10) — mirrors the invoice
    // grand total so the running price never scrolls out of view while building.
    const sidebarBar = document.getElementById('sidebar-total-bar');
    const sidebarTotal = document.getElementById('sidebar-grand-total');
    if (sidebarBar && sidebarTotal) {
        sidebarTotal.textContent = grandTotalWithTax.textContent;
        sidebarBar.hidden = false;
    }

    // Keep the Step-3 shipping summary's tax-rate in sync after a rate lookup.
    if (typeof updateShippingSummary === 'function') updateShippingSummary();
}

// ============================================================
// ACTIONS (Save, Print, Email, Copy)
// ============================================================

/**
 * Save quote and get shareable link
 * Uses EmbroideryQuoteService and QuoteShareModal
 */
async function saveAndGetLink(opts = {}) {
    // Re-entrancy guard: the save button was only disabled deep into the flow
    // (after three awaits), so a double-click started two concurrent saves —
    // duplicate quote sessions on a new quote, racing delete/insert in edit mode.
    if (window._embSaveInFlight) {
        showToast('Save already in progress…', 'info');
        return;
    }
    window._embSaveInFlight = true;
    try {
        return await _saveAndGetLinkInner(opts);
    } finally {
        window._embSaveInFlight = false;
    }
}

async function _saveAndGetLinkInner(opts = {}) {
    const skipShareModal = !!(opts && opts.skipShareModal);   // true from pushToShopWorks: auto-save → push, no share modal
    // Settle on-screen prices before snapshotting them — AL rows + Rush are display-driven,
    // so a stale value here would be persisted to the quote. (2026-06-04 audit hardening)
    try { await syncALRows(); await syncDECGRows(); await recalculatePricing(); } catch (e) { console.warn('[Save] pre-save recalc skipped', e); }

    const allItems = collectProductsFromTable();
    const products = allItems.filter(p => !p.isService);
    // DECG/DECC (customer-supplied garment/cap) rows are persisted by the decgItems loop below
    // as EmbellishmentType 'customer-supplied'. They MUST be excluded here, else the
    // manualServiceItems save loop ALSO writes them as a 'fee' item → the DB gets TWO DECG
    // rows ($480 for a $240 order) and /invoice + ShopWorks push over-charge 2x, while the
    // on-screen total (which reads the table once) still shows the correct amount so the rep
    // never notices. (cert audit 2026-06-04)
    const manualServiceItems = allItems.filter(p => p.isService && !['decg', 'decc'].includes((p.serviceType || '').toLowerCase()));
    const decgItems = collectDECGItems();
    if (products.length === 0 && decgItems.length === 0 && manualServiceItems.length === 0) {
        showToast('Add products before saving', 'error');
        return;
    }
    // Guard: logos/services with NO garment or cap to go on (e.g. an AL-CAP row but the cap
    // product never got added — the EMB-273 incident). Almost always a mistake. (2026-06-04 audit)
    if (products.length === 0 && decgItems.length === 0 && manualServiceItems.length > 0) {
        showToast('This order has only logos/services — add the garment or cap they go on first.', 'error', 6000);
        return;
    }

    // Validate required fields
    const customerName = document.getElementById('customer-name')?.value?.trim();
    const customerEmail = document.getElementById('customer-email')?.value?.trim();

    if (!customerName || !customerEmail) {
        showToast('Please enter customer name and email', 'error');
        if (!customerName) document.getElementById('customer-name')?.focus();
        else if (!customerEmail) document.getElementById('customer-email')?.focus();
        return;
    }
    // [B11] (P3-15, audit 2026-06-06): email was presence-checked but never format-validated → a typo'd
    // address saved + emailed silently. Reject an obviously-malformed address.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
        showToast('Enter a valid email address (name@company.com).', 'error');
        document.getElementById('customer-email')?.focus();
        return;
    }

    // Artwork uploaded but the design left UNNAMED → the ShopWorks push silently DROPS the art
    // (the transformer gates Designs[] on a non-empty design name) and production gets "NO DESIGN
    // LINKED" for a job that has a logo. isValidForPush() is false only in exactly that case
    // (files present + name blank). Require the name so the uploaded logo reaches the floor.
    // (2026-06-04 audit B6)
    if (window._embArtwork && typeof window._embArtwork.isValidForPush === 'function' && !window._embArtwork.isValidForPush()) {
        showToast('You uploaded artwork — give the design a name so it isn’t dropped from the ShopWorks order.', 'error', 6000);
        const dn = document.querySelector('#emb-artwork-mount .artwork-upload-designname-input');  // widget's real input class (audit fix 2026-06-05)
        if (dn && typeof dn.focus === 'function') dn.focus();
        return;
    }

    // Artwork still uploading → getFiles() below would snapshot referenceArtwork WITHOUT the in-flight
    // file (the widget pushes to state.files only AFTER the upload resolves), so the EMB transformer would
    // omit its Location and production silently loses the art. Block save until uploads finish. (review C11)
    if (window._embArtwork && typeof window._embArtwork.isUploading === 'function' && window._embArtwork.isUploading()) {
        showToast('Artwork is still uploading — wait for it to finish before saving.', 'warning', 5000);
        return;
    }

    // Validate non-SanMar products have pricing set
    const zeroPriceRows = products.filter(p => {
        const row = document.getElementById(`row-${p.rowId}`);
        return row && row.dataset.nonSanmar === 'true' && p.sellPriceOverride <= 0;
    });
    if (zeroPriceRows.length > 0) {
        const styleList = zeroPriceRows.map(p => p.style).join(', ');
        showToast(`Non-SanMar product(s) have $0 pricing: ${styleList}. Double-click the price cell to set a price.`, 'error', 6000);
        return;
    }

    // P1-4 (audit 2026-06-06): block save when any Additional-Logo / Customer-Supplied row failed to price
    // (its pricing API threw or returned $0). Never save a silent $0 line (Erik's #1 rule).
    const priceErrRows = Array.from(document.querySelectorAll('#product-tbody tr.service-product-row'))
        .filter(r => r.dataset.priceError === 'true');
    if (priceErrRows.length > 0) {
        showToast('Some Additional-Logo / Customer-Supplied rows could not be priced — refresh and re-check before saving (they will not be saved at $0).', 'error', 7000);
        return;
    }

    // Get save button for loading state
    const saveBtn = document.querySelector('.btn-save-quote, [onclick*="saveAndGetLink"]');
    const originalText = saveBtn?.innerHTML;
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveBtn.disabled = true;
    }

    showLoading(true);

    try {
        // Build logo configuration from global state (shared helper)
        const { logoConfigs, allLogos } = buildLogoConfiguration();

        // Read LTM control state
        const ltmState = getLtmControlState('emb-ltm-panel');
        const ltmEnabled = ltmState.enabled;
        const ltmDisplayMode = ltmState.displayMode || 'builtin';

        let pricing;
        if (products.length === 0) {
            // DECG-only: build minimal pricing (no pricing engine needed)
            const decgTotal = decgItems.reduce((sum, d) => sum + d.total, 0);
            const decgQty = decgItems.reduce((sum, d) => sum + d.quantity, 0);
            pricing = {
                products: [],
                totalQuantity: decgQty,
                subtotal: decgTotal,
                grandTotal: decgTotal,
                tier: decgQty <= 7 ? '1-7' : decgQty <= 23 ? '8-23' : decgQty <= 47 ? '24-47' : decgQty <= 71 ? '48-71' : '72+',
                ltmFee: 0,
                additionalServices: [],
                additionalStitchTotal: 0,
                garmentStitchTotal: 0,
                capStitchTotal: 0,
                garmentSetupFees: 0,
                capSetupFees: 0,
                garmentQuantity: 0,
                capQuantity: 0
            };
        } else {
            pricing = await pricingCalculator.calculateQuote(products, allLogos, logoConfigs, { ltmEnabled });
        }

        // Don't SAVE a quote at a silently-wrong (zero) price on a hard pricing failure. `=== false`
        // (not falsy) so the DECG-only branch above — which builds a pricing object with no `success`
        // field — is NOT blocked. (review C4 — Erik's #1 rule)
        if (pricing && pricing.success === false) {
            if (saveBtn) { saveBtn.innerHTML = originalText; saveBtn.disabled = false; }
            try { showLoading(false); } catch (_) {}
            showToast(pricing.message || 'Pricing unavailable — cannot save this quote. Refresh and try again.', 'error', 6000);
            return;
        }

        // Don't save an UNDER-total either — if any product's pricing failed it was left out of the
        // subtotal (review C5). Block the save so a wrong (low) price never reaches Caspio/ShopWorks.
        if (pricing && Array.isArray(pricing.failedProducts) && pricing.failedProducts.length > 0) {
            if (saveBtn) { saveBtn.innerHTML = originalText; saveBtn.disabled = false; }
            try { showLoading(false); } catch (_) {}
            showToast(`Can't save — pricing failed for ${pricing.failedProducts.length} item(s) (${pricing.failedProducts.map(f => f.style).join(', ')}). Refresh until all prices load.`, 'error', 7000);
            return;
        }

        // Include DECG/DECC service totals in grandTotal (same as recalculatePricing)
        // Only for mixed orders (products + DECG). DECG-only path above already initialized correctly.
        if (decgItems.length > 0 && products.length > 0) {
            const decgServiceTotal = decgItems.reduce((sum, d) => sum + d.total, 0);
            pricing.subtotal += decgServiceTotal;
            pricing.grandTotal += decgServiceTotal;
        }

        // Include manual service items (Monogram/Name-Number/WEIGHT) in grandTotal
        if (manualServiceItems.length > 0) {
            const manualServiceTotal = manualServiceItems.reduce((sum, si) => sum + (si.unitPrice * si.totalQuantity), 0);
            pricing.subtotal += manualServiceTotal;
            pricing.grandTotal += manualServiceTotal;
        }

        // Get sales rep NAME from dropdown selected option text
        const salesRepSelect = document.getElementById('sales-rep');
        const salesRepEmail = salesRepSelect?.value || 'sales@nwcustomapparel.com';
        const salesRepName = salesRepSelect?.options[salesRepSelect.selectedIndex]?.text || '';

        // Get additional charges (artwork, rush, sample, discount)
        const additionalCharges = getAdditionalCharges();

        // Build customer data with additional charges
        const customerData = {
            email: customerEmail,
            name: customerName,
            company: document.getElementById('company-name')?.value?.trim() || '',
            project: document.getElementById('project-name')?.value?.trim() || '',  // P2-5 (audit 2026-06-06): was captured nowhere
            isWholesale: document.getElementById('wholesale-checkbox')?.checked || false,  // [2026-06-07] → IsWholesale; push routes to acct 2203
            salesRepEmail: salesRepEmail,
            salesRepName: salesRepName,
            notes: document.getElementById('notes')?.value?.trim() || '',
            // Additional charges (2026-01-14)
            artCharge: additionalCharges.artCharge,
            graphicDesignHours: additionalCharges.graphicDesignHours,
            graphicDesignCharge: additionalCharges.graphicDesignCharge,
            rushFee: additionalCharges.rushFee,
            sampleFee: additionalCharges.sampleFee,
            sampleQty: additionalCharges.sampleQty,
            discount: additionalCharges.discount,
            discountPercent: additionalCharges.discountPercent,
            discountReason: additionalCharges.discountReason,
            // Order details (2026-02-11)
            phone: document.getElementById('customer-phone')?.value?.trim() || '',
            orderNumber: document.getElementById('order-number')?.value?.trim() || '',
            customerNumber: document.getElementById('customer-number')?.value?.trim() || '',
            purchaseOrderNumber: document.getElementById('po-number')?.value?.trim() || '',
            shipToAddress: document.getElementById('ship-address')?.value?.trim() || '',
            shipToCity: document.getElementById('ship-city')?.value?.trim() || '',
            shipToState: document.getElementById('ship-state')?.value || '',
            shipToZip: document.getElementById('ship-zip')?.value?.trim() || '',
            shipMethod: (() => {
                const sel = document.getElementById('ship-method')?.value || '';
                if (sel === 'Other') return document.getElementById('ship-method-other')?.value?.trim() || 'Other';
                return sel;
            })(),
            dateOrderPlaced: dateFromInputValue(document.getElementById('date-order-placed')?.value),
            reqShipDate: dateFromInputValue(document.getElementById('req-ship-date')?.value),
            dropDeadDate: dateFromInputValue(document.getElementById('drop-dead-date')?.value),
            paymentTerms: document.getElementById('payment-terms')?.value?.trim() || '',
            // Frozen tax & design data for Caspio (2026-02-12)
            designNumbers: lastImportMetadata?.designNumbers || [],
            digitizingCodes: lastImportMetadata?.digitizingCodes || [],
            digitizingFees: lastImportMetadata?.parsedServices?.digitizingFees || [],
            taxRate: (() => {
                const includeTax = document.getElementById('include-tax')?.checked;
                if (!includeTax) return 0;
                // parseRatePercent: 0 is a VALID rate (out-of-state) — `|| 10.1` was
                // silently saving WA tax on quotes the screen showed at $0 tax.
                const rateVal = parseRatePercent(document.getElementById('tax-rate-input')?.value, 10.2);
                return rateVal / 100;
            })(),
            taxAmount: (() => {
                const includeTax = document.getElementById('include-tax')?.checked;
                if (!includeTax) return 0;
                const rateVal = parseRatePercent(document.getElementById('tax-rate-input')?.value, 10.2);
                const preTaxText = document.getElementById('pre-tax-subtotal')?.textContent || '$0.00';
                const preTaxSubtotal = parseFloat(preTaxText.replace(/[$,]/g, '')) || 0;
                // #pre-tax-subtotal is ALREADY the full pre-tax base incl. shipping (= the on-screen
                // adjustedSubtotal that updateTaxCalculation taxes once at L7259). Do NOT add shipping
                // again — that double-counted shipping in the saved/pushed TaxAmount. (round-2 N1/N6 — pre-existing bug)
                return Math.round(preTaxSubtotal * (rateVal / 100) * 100) / 100;
            })(),
            importNotes: lastImportMetadata
                ? [...(lastImportMetadata.warnings || []), ...(lastImportMetadata.unmatchedLines || []), ...(lastImportMetadata.reviewItems || [])]
                : [],
            // Phase 11.3 (2026-05-24) — rich-mode artwork data.
            // Persisted by quote-service.js into the ImportNotes JSON column
            // (extended from flat-array to object shape so this data rides
            // along without a Caspio schema change). Proxy's EMB transformer
            // reads them to emit Designs[{name, Locations[]}] on push.
            referenceArtwork: (window._embArtwork && typeof window._embArtwork.getFiles === 'function')
                ? window._embArtwork.getFiles()
                : [],
            newDesignName: (window._embArtwork && typeof window._embArtwork.getDesignName === 'function')
                ? (window._embArtwork.getDesignName() || '').trim()
                : '',
            paidToDate: lastImportMetadata?.paidToDate ?? 0,
            balanceAmount: lastImportMetadata?.balanceAmount ?? 0,
            orderNotes: lastImportMetadata?.orderNotes ?? '',
            // Package tracking (2026-02-14)
            carrier: lastImportMetadata?.carrier || '',
            trackingNumber: lastImportMetadata?.trackingNumber || '',
            // Design assignments (2026-02-19)
            garmentDesignNumber: primaryLogo.designNumber || '',
            capDesignNumber: (typeof capPrimaryLogo !== 'undefined' ? capPrimaryLogo.designNumber : '') || '',
            // ShopWorks pricing audit (2026-02-13)
            swTotal: lastImportMetadata?.swTotal ?? 0,
            swSubtotal: lastImportMetadata?.swSubtotal ?? 0,
            priceAuditJSON: (() => {
                if (!lastImportMetadata || !lastImportMetadata.swSubtotal) return '';
                // Reloaded quotes have no per-row _swUnitPrice (it only exists right after a
                // paste-import), so recomputing here would write false MISMATCH flags. Keep
                // the audit captured at import time verbatim. (audit 2026-06-10)
                if (lastImportMetadata.restoredFromSession) return lastImportMetadata.priceAuditJSONSnapshot || '';
                const swSub = lastImportMetadata.swSubtotal;
                const ourSub = pricing.grandTotal || 0;
                const delta = ourSub - swSub;
                const pct = swSub > 0 ? Math.abs(delta / swSub) * 100 : 0;
                const flag = pct <= 5 ? 'OK' : pct <= 15 ? 'REVIEW' : 'MISMATCH';
                const prods = (pricing.products || []).map(pp => {
                    const li = (pp.lineItems || [pp])[0];
                    const ourUnit = li?.unitPriceWithLTM || li?.unitPrice || 0;
                    const swUnit = pp.product?._swUnitPrice || 0;
                    const pDelta = ourUnit - swUnit;
                    const pPct = swUnit > 0 ? Math.abs(pDelta / swUnit) * 100 : 0;
                    return {
                        style: pp.product?.style || '?',
                        color: pp.product?.color || '?',
                        qty: pp.product?.totalQuantity || 0,
                        swUnit: parseFloat(swUnit.toFixed(2)),
                        ourUnit: parseFloat(ourUnit.toFixed(2)),
                        delta: parseFloat(pDelta.toFixed(2)),
                        flag: pPct <= 5 ? 'OK' : pPct <= 15 ? 'REVIEW' : 'MISMATCH'
                    };
                });
                // Append service items (AL, Monogram, Weight, Digitizing) to audit
                const svc = lastImportMetadata.parsedServices || {};
                const alFeePerUnit = pricing.additionalServices?.length > 0
                    ? (pricing.additionalServices[0]?.unitPrice || 6.50)
                    : 6.50;
                (svc.additionalLogos || []).forEach(al => {
                    const swU = parseFloat(al.unitPrice || al.price || 0);
                    const ourU = parseFloat(alFeePerUnit.toFixed(2));
                    const d = ourU - swU;
                    const p = swU > 0 ? Math.abs(d / swU) * 100 : 0;
                    prods.push({ style: 'AL', color: 'Service', qty: parseInt(al.quantity || al.qty || 0),
                        swUnit: parseFloat(swU.toFixed(2)), ourUnit: ourU,
                        delta: parseFloat(d.toFixed(2)), flag: p <= 5 ? 'OK' : p <= 15 ? 'REVIEW' : 'MISMATCH', isService: true });
                });
                (svc.monograms || []).forEach(m => {
                    const swU = parseFloat(m.unitPrice || m.price || 0);
                    const ourU = getServicePrice('Monogram', 12.50);  // audit flags must track Caspio, not 2026-02 literals
                    const d = ourU - swU;
                    const p = swU > 0 ? Math.abs(d / swU) * 100 : 0;
                    prods.push({ style: 'Monogram', color: 'Service', qty: parseInt(m.quantity || m.qty || 0),
                        swUnit: parseFloat(swU.toFixed(2)), ourUnit: ourU,
                        delta: parseFloat(d.toFixed(2)), flag: p <= 5 ? 'OK' : p <= 15 ? 'REVIEW' : 'MISMATCH', isService: true });
                });
                (svc.weights || []).forEach(w => {
                    const swU = parseFloat(w.unitPrice || w.price || 0);
                    const ourU = getServicePrice('WEIGHT', 6.25);  // audit flags must track Caspio, not 2026-02 literals
                    const d = ourU - swU;
                    const p = swU > 0 ? Math.abs(d / swU) * 100 : 0;
                    prods.push({ style: 'Weight', color: 'Service', qty: parseInt(w.quantity || w.qty || 0),
                        swUnit: parseFloat(swU.toFixed(2)), ourUnit: ourU,
                        delta: parseFloat(d.toFixed(2)), flag: p <= 5 ? 'OK' : p <= 15 ? 'REVIEW' : 'MISMATCH', isService: true });
                });
                (svc.digitizingFees || []).forEach(df => {
                    const swU = parseFloat(df.amount || df.unitPrice || 0);
                    const ourU = swU; // Digitizing is pass-through, same price expected
                    prods.push({ style: df.code || 'DD', color: 'Service', qty: 1,
                        swUnit: parseFloat(swU.toFixed(2)), ourUnit: parseFloat(ourU.toFixed(2)),
                        delta: 0, flag: 'OK', isService: true });
                });
                // DECG/DECC items
                const parsedDecg = svc.decgItems || [];
                parsedDecg.forEach(pd => {
                    const swU = parseFloat(pd.unitPrice || 0);
                    const ourU = parseFloat(pd.calculatedUnitPrice || 0);
                    const qty = parseInt(pd.quantity || 0);
                    const d = ourU - swU;
                    const p = swU > 0 ? Math.abs(d / swU) * 100 : 0;
                    const label = pd.serviceType === 'decc' ? 'DECC' : 'DECG';
                    prods.push({ style: label, color: 'Service', qty: qty,
                        swUnit: parseFloat(swU.toFixed(2)), ourUnit: parseFloat(ourU.toFixed(2)),
                        delta: parseFloat(d.toFixed(2)), flag: p <= 5 ? 'OK' : p <= 15 ? 'REVIEW' : 'MISMATCH', isService: true });
                });
                return JSON.stringify({ swTotal: lastImportMetadata.swTotal, swSubtotal: swSub,
                    ourSubtotal: parseFloat(ourSub.toFixed(2)), deltaSubtotal: parseFloat(delta.toFixed(2)),
                    deltaPct: parseFloat(pct.toFixed(1)), flag, products: prods });
            })()
        };

        // DECG/DECC items already collected at function start

        // Build quote data
        const quoteData = {
            products: products,
            logos: allLogos,
            // Cap embellishment type for laser-patch orders
            capEmbellishmentType: getCapEmbellishmentType(),
            // DECG/DECC items for shareable URLs
            decgItems: decgItems
        };

        // Override ltmDistributed based on display mode selection
        pricing.ltmDistributed = (ltmDisplayMode === 'builtin');

        // Add LTM state to customerData for Caspio persistence
        customerData.ltmDisplayMode = ltmDisplayMode;
        customerData.ltmWaived = !ltmEnabled;

        // Attach logos and embellishment type to pricing for service to access
        pricing.logos = allLogos;
        pricing.capEmbellishmentType = getCapEmbellishmentType();
        // Attach DECG items to pricing for service to access
        pricing.decgItems = decgItems;
        // Attach manual service items (Monogram/Name-Number/WEIGHT) for saving
        pricing.manualServiceItems = manualServiceItems;

        let result;
        if (editingQuoteId) {
            // Edit mode: Update existing quote (save revision)
            result = await quoteService.updateQuote(editingQuoteId, quoteData, customerData, pricing);
        } else {
            // New quote mode: Create new quote
            result = await quoteService.saveQuote(quoteData, customerData, pricing);
        }

        if (result && result.quoteID) {
            // Partial save = NOT a success: items are missing from the DB, so the
            // share link, /quote page, and a ShopWorks push would all under-bill.
            // Keep the local draft (rep's data is the only complete copy), skip the
            // share modal, and leave Push disabled. (audit 2026-06-10)
            if (result.partialSave) {
                showToast((result.warning || 'Some line items failed to save.') +
                    ' The quote is incomplete — do NOT share or push it. Check your connection and save again.', 'error', 12000);
                return;
            }

            const isUpdate = !!editingQuoteId;
            // Clear auto-save draft on successful save (2026 consolidation)
            if (embPersistence) {
                embPersistence.clearDraft();
            }

            // Mark as saved (no unsaved changes)
            markAsSaved();

            if (isUpdate) {
                // Update mode: Show revision success message
                const newRevision = result.revision || (editingRevision + 1);
                editingRevision = newRevision;
                updateEditModeUI(result.quoteID, newRevision);
                showToast(`Revision ${newRevision} saved successfully!`, 'success');

                // Show modal with link (don't pass message as baseUrl!) — skipped when auto-saving
                // to push, where the push preview opens instead.
                if (!skipShareModal) {
                    if (typeof QuoteShareModal !== 'undefined' && QuoteShareModal.show) {
                        QuoteShareModal.show(result.quoteID);
                    } else {
                        const url = `${window.location.origin}/quote/${result.quoteID}`;
                        navigator.clipboard.writeText(url).catch(() => {});
                        showToast(`Quote ${result.quoteID} updated (Rev ${newRevision}). Link copied!`, 'success');
                    }
                }
            } else {
                // New quote: success modal with shareable link — skipped when auto-saving to push.
                if (!skipShareModal) {
                    if (typeof QuoteShareModal !== 'undefined' && QuoteShareModal.show) {
                        QuoteShareModal.show(result.quoteID);
                    } else {
                        const url = `${window.location.origin}/quote/${result.quoteID}`;
                        navigator.clipboard.writeText(url).catch(() => {});
                        showToast(`Quote ${result.quoteID} saved. Link copied!`, 'success');
                    }
                }
            }

            // Show Push to ShopWorks button after successful save. [B5]: only a NEW quote clears the
            // already-pushed lock; an update preserves it so a re-save can't re-enable a duplicate push.
            showPushButton(result.quoteID, { resetPushed: !isUpdate });
        } else {
            throw new Error(result?.error || 'Failed to save quote');
        }
    } catch (error) {
        console.error('[Embroidery] Save error:', error);
        showToast('Error saving quote: ' + error.message, 'error');
    } finally {
        showLoading(false);
        // Restore button state
        if (saveBtn) {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }
}

// Legacy function - redirects to saveAndGetLink
async function saveQuote() {
    return saveAndGetLink();
}

// =====================================================
// Push to ShopWorks
// =====================================================

// _pushQuoteId: set once the quote is saved (or when editing a saved quote).
// _pushAlreadyDone: true when this quote has already been pushed to ShopWorks.
let _pushQuoteId = null;
let _pushAlreadyDone = false;

// Single source of truth for the action-bar "Push to ShopWorks" button state.
// Gated: enabled only when the quote is saved AND a ShopWorks Customer # is set
// (a blank Customer # would silently route the order to the catch-all customer).
function updatePushButtonState() {
    const btn = document.getElementById('emb-push-shopworks-btn');
    const label = document.getElementById('emb-push-shopworks-label');
    if (!btn) return;  // [2026-06-07] do NOT bail when the label is transiently missing → still enable/disable the button
    renderPushReadiness();

    if (_pushAlreadyDone) {
        // "Sent" — not "Pushed/Imported". The order reached ManageOrders; OnSite
        // import is confirmed separately (Verify in ShopWorks in the push modal).
        if (label) label.textContent = 'Sent to ShopWorks ✓';
        btn.disabled = true;
        btn.style.opacity = '1';
        btn.style.cursor = 'default';
        btn.style.background = '#28a745';
        btn.title = 'This quote was sent to ManageOrders. Use “Verify in ShopWorks” to confirm OnSite imported it.';
        return;
    }

    // Push auto-saves first, and the save REQUIRES customer #, >=1 product, name AND email — so enable
    // the button only when all four are met. This keeps it consistent with the readiness checklist
    // (no more "enabled with zero products") and never invites a click that dies in the save step.
    // (review C22/C35 2026-06-05)
    const r = getPushReadiness();
    const enabled = r.hasCustomer && r.hasProducts && r.hasName && r.hasEmail;

    if (label) label.textContent = 'Push to ShopWorks';
    // Theme comes from the #emb-push-shopworks-btn CSS class (PNW green) + its
    // :disabled rule — clearing any inline background left by the "Sent ✓" state.
    btn.style.background = '';
    btn.disabled = !enabled;
    btn.style.opacity = '';
    btn.style.cursor = '';
    btn.title = enabled
        ? 'Save + create this quote as an order in ShopWorks OnSite (saves automatically)'
        : 'Complete the “Before you push” checklist (Customer #, a product, name + email) to enable push';
}

/**
 * Single source of truth for "is this quote ready to push to ShopWorks?" — used by BOTH the Push button
 * gate (updatePushButtonState) and the readiness checklist (renderPushReadiness) so they can never
 * contradict. Mirrors the saveAndGetLink() validation (name + email required). (review C22/C35 2026-06-05)
 */
function getPushReadiness() {
    let hasProducts = false;
    try {
        const c = getOrderPieceCounts();
        let pieces = c.garment + c.cap;
        // Customer-supplied (DECG/DECC) rows ARE the order's items but collect with isService:true, so
        // getOrderPieceCounts() filters them out. Count them too — else a valid DECG/DECC-only quote
        // (saveAndGetLink permits products===0 && decg>0) can't reach the Push button. (round-2 regression fix)
        if (typeof collectDECGItems === 'function') pieces += collectDECGItems().length;
        hasProducts = pieces > 0;
    } catch (_) {}
    return {
        hasCustomer: !!(document.getElementById('customer-number')?.value?.trim()),
        hasProducts: hasProducts,
        hasName: !!(document.getElementById('customer-name')?.value?.trim()),
        hasEmail: !!(document.getElementById('customer-email')?.value?.trim()),
    };
}

/**
 * Push-readiness checklist (audit #8 2026-06-05) — shows the gates a successful ShopWorks push needs
 * (Customer #, ≥1 product, customer name) so the rep isn't guessing why the Push button is disabled.
 * Live-rendered from updatePushButtonState() + recalculatePricing().
 */
function renderPushReadiness() {
    const el = document.getElementById('push-readiness');
    if (!el) return;
    if (_pushAlreadyDone) { el.innerHTML = ''; return; }   // already sent — nothing to check
    const r = getPushReadiness();
    // Shared clickable checklist (quote-builder-utils.js) — unmet items focus their field
    // (item #8, 2026-07-05). Fallback keeps the old plain markup if utils didn't load.
    if (typeof renderPushChecklist === 'function' && typeof getPushBlockers === 'function') {
        renderPushChecklist(el, getPushBlockers(r));
    } else {
        const item = (ok, label) =>
            `<div class="pr-item ${ok ? 'pr-ok' : 'pr-no'}"><i class="fas fa-${ok ? 'check-circle' : 'circle'}"></i>${label}</div>`;
        el.innerHTML = '<div class="pr-title">Before you push</div>' +
            item(r.hasCustomer, 'ShopWorks Customer #') +
            item(r.hasProducts, 'At least one item') +
            item(r.hasName, 'Customer name') +
            item(r.hasEmail, 'Customer email');
    }
    // [2026-06-07] Keep the Push button in LOCK-STEP with this checklist so they can NEVER desync. Direct
    // renderPushReadiness() callers (e.g. a product change at ~line 6341) updated the checklist green but
    // never re-gated the button → it stayed stale-disabled even with all checks green (the bug Erik hit).
    const _pbtn = document.getElementById('emb-push-shopworks-btn');
    if (_pbtn && !_pushAlreadyDone) {
        const enabled = r.hasCustomer && r.hasProducts && r.hasName && r.hasEmail;
        _pbtn.disabled = !enabled;
        _pbtn.style.opacity = enabled ? '1' : '0.5';
        _pbtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }
}
window.renderPushReadiness = renderPushReadiness;

// Called after a successful save and when loading a saved quote for editing.
function showPushButton(quoteId, opts = {}) {
    _pushQuoteId = quoteId;
    // [B5] (audit 2026-06-06): only CLEAR the "already pushed" lock for a genuinely NEW quote. A re-save of
    // an already-pushed quote must NOT wipe it (else the rep can push again → a duplicate ShopWorks order).
    if (opts.resetPushed === true) _pushAlreadyDone = false;
    updatePushButtonState();
}

// One-click "Push to ShopWorks": auto-SAVE first (so the rep never has to hunt for a separate
// "Save & Share" step), then open the review-and-confirm preview. saveAndGetLink() validates +
// sets _pushQuoteId on success; on failure it already surfaced the error and we bail. (Erik 2026-06-05)
let _pushInFlight = false;  // re-entrancy guard — a rapid double-click must not create 2 sessions / 2 SW orders (round-2 fix)
async function pushToShopWorks() {
    const hasCustomer = !!(document.getElementById('customer-number')?.value?.trim());
    if (!hasCustomer) {
        showToast('Enter the ShopWorks Customer # (top of the form) before pushing.', 'warning');
        document.getElementById('customer-number')?.focus();
        return;
    }
    if (_pushInFlight) return;             // already saving/pushing — ignore the double-click
    _pushInFlight = true;
    const pushBtn = document.getElementById('emb-push-shopworks-btn');
    if (pushBtn) {
        pushBtn.disabled = true;  // disable synchronously, BEFORE the first await
        // [2026-06-07] The silent save before the preview modal takes ~2-3s — show a spinner so the rep knows
        // it's working. Update the LABEL's content, NOT the button's innerHTML — replacing the button HTML
        // destroys #emb-push-shopworks-label, which updatePushButtonState needs, and would strand the button
        // disabled (the greyed-Push regression). updatePushButtonState() in the finally resets the label text.
        const lbl = document.getElementById('emb-push-shopworks-label');
        if (lbl) lbl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing preview…';
    }
    try {
        const dirty = (typeof hasUnsavedChanges === 'function') ? hasUnsavedChanges() : true;
        if (!_pushQuoteId || dirty) {
            await saveAndGetLink({ skipShareModal: true });   // silent save → showPushButton sets _pushQuoteId
        }
        if (!_pushQuoteId) return;            // save failed / validation blocked it — error already shown
        await openPushPreview();
    } finally {
        _pushInFlight = false;
        updatePushButtonState();          // resets the label text + re-enables via the gate (respects blank-cust# / "Sent ✓")
    }
}
window.pushToShopWorks = pushToShopWorks;

// Open the preview-and-confirm modal. Fetches the exact ExternalOrderJson the
// backend would send (read-only /preview endpoint) so the rep reviews line
// items, designs and notes before the order is created.
async function openPushPreview() {
    const btn = document.getElementById('emb-push-shopworks-btn');
    if (!btn || btn.disabled || !_pushQuoteId) return;

    const modal = document.getElementById('emb-sw-push-modal');
    const statusEl = document.getElementById('emb-sw-push-status');
    const previewEl = document.getElementById('emb-sw-push-preview');
    const confirmBtn = document.getElementById('emb-sw-push-confirm');
    if (!modal || !previewEl || !confirmBtn) return;

    if (statusEl) statusEl.innerHTML = '';
    previewEl.innerHTML = '<div style="padding:24px; text-align:center; color:#64748b;">' +
        '<i class="fas fa-spinner fa-spin"></i> Loading preview…</div>';
    confirmBtn.disabled = true;
    confirmBtn.style.display = '';
    confirmBtn.dataset.force = 'false';
    confirmBtn.innerHTML = '<i class="fas fa-upload"></i> Push to ShopWorks';
    modal.classList.add('active');

    // P2-16 (audit 2026-06-06): focus management for the load-bearing push-confirm modal — remember the
    // opener, move focus into the modal, trap Tab inside it, and close on Escape (a11y; stops focus leaking
    // to the page behind the modal).
    window._pushModalOpener = document.activeElement;
    setTimeout(() => { try { const f = modal.querySelector('button:not([disabled])'); if (f) f.focus(); } catch (_) {} }, 0);
    if (!modal._embKeyBound) {
        modal._embKeyBound = true;
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); closePushPreview(); return; }
            if (e.key !== 'Tab') return;
            const f = Array.from(modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null);
            if (!f.length) return;
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        });
    }

    try {
        const apiBase = window.APP_CONFIG.API.BASE_URL;
        const resp = await fetch(`${apiBase}/api/embroidery-push/preview/${encodeURIComponent(_pushQuoteId)}`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || data.details || `HTTP ${resp.status}`);
        renderPushPreview(data);
        if (data.alreadyPushed) {
            confirmBtn.dataset.force = 'true';
            confirmBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Push Again (creates duplicate)';
        }
        confirmBtn.disabled = false;
    } catch (err) {
        console.error('[Embroidery] Preview error:', err);
        previewEl.innerHTML = '<div class="preview-warnings"><h5><i class="fas fa-exclamation-triangle"></i> ' +
            'Could not load preview</h5><ul><li>' + escapeHtml(err.message) + '</li></ul></div>';
    }
}

// Render the preview modal body from the /preview response.
function renderPushPreview(data) {
    const previewEl = document.getElementById('emb-sw-push-preview');
    const statusEl = document.getElementById('emb-sw-push-status');
    if (!previewEl) return;
    const o = data.orderJson || {};
    const lines = Array.isArray(o.LinesOE) ? o.LinesOE : [];

    if (data.alreadyPushed && statusEl) {
        statusEl.innerHTML = '<div class="preview-warnings"><h5><i class="fas fa-exclamation-triangle"></i> ' +
            'Already pushed to ShopWorks</h5><ul><li>This quote was pushed' +
            (data.pushedAt ? ' on ' + escapeHtml(String(data.pushedAt)) : '') +
            '. Pushing again will create a DUPLICATE order.</li></ul></div>';
    }

    let html = '<div class="preview-grid">';
    html += '<div class="preview-item"><div class="preview-item-label">ShopWorks ExtOrderID</div>' +
        '<div class="preview-item-value">' + escapeHtml(data.extOrderId || '') + '</div></div>';
    html += '<div class="preview-item"><div class="preview-item-label">Customer #</div>' +
        '<div class="preview-item-value">' + escapeHtml(String(o.id_Customer || '')) +
        (o.ExtCustomerID ? ' <span style="color:#94a3b8;">(ext ' + escapeHtml(String(o.ExtCustomerID)) + ')</span>' : '') +
        '</div></div>';
    html += '<div class="preview-item"><div class="preview-item-label">Contact</div>' +
        '<div class="preview-item-value">' +
        (escapeHtml(((o.ContactNameFirst || '') + ' ' + (o.ContactNameLast || '')).trim()) || '—') + '</div></div>';
    html += '<div class="preview-item"><div class="preview-item-label">Line items / Designs</div>' +
        '<div class="preview-item-value">' + lines.length + ' lines · ' + (data.designCount || 0) + ' design(s)</div></div>';
    html += '</div>';

    html += '<div class="preview-products"><h5>Line items (' + lines.length + ')</h5>';
    html += '<div class="preview-products-list">';
    if (lines.length === 0) {
        html += '<div class="preview-product-item"><span class="preview-product-desc">No line items</span></div>';
    } else {
        for (const ln of lines) {
            const meta = [escapeHtml(ln.Color || ''), escapeHtml(ln.Size || '')].filter(Boolean).join(' · ');
            html += '<div class="preview-product-item">' +
                '<span class="preview-product-style">' + escapeHtml(ln.PartNumber || '') + '</span>' +
                '<span class="preview-product-desc">' + escapeHtml(ln.Description || '') + (meta ? ' — ' + meta : '') + '</span>' +
                '<span class="preview-product-qty">×' + escapeHtml(String(ln.Qty || '')) + ' @ $' + escapeHtml(String(ln.Price || '')) + '</span>' +
                '</div>';
        }
    }
    html += '</div></div>';

    // [B3] (P2-11, audit 2026-06-06): render the Designs so the rep SEES the artwork/logo before pushing
    // (catches a wrong/missing/duplicate design). Handles Branch-1 {id_Design} (existing, linked in SW) and
    // Branch-2 {DesignName, Locations[].ImageURL} (new artwork upload).
    const designs = Array.isArray(o.Designs) ? o.Designs : [];
    if (designs.length) {
        html += '<div class="preview-products"><h5>Designs (' + designs.length + ')</h5><div class="preview-products-list">';
        for (const d of designs) {
            if (d.id_Design && !d.DesignName) {
                html += '<div class="preview-product-item"><span class="preview-product-desc">Existing design #' + escapeHtml(String(d.id_Design)) + ' (linked in ShopWorks)</span></div>';
                continue;
            }
            const locs = Array.isArray(d.Locations) ? d.Locations : [];
            const thumb = (locs.find(l => l && l.ImageURL) || {}).ImageURL;
            html += '<div class="preview-product-item">' +
                (thumb ? '<img src="' + escapeHtml(thumb) + '" alt="" style="width:40px;height:40px;object-fit:contain;border:1px solid #e2e8f0;border-radius:4px;margin-right:8px;">' : '') +
                '<span class="preview-product-desc">' + escapeHtml(d.DesignName || '(unnamed)') + ' · ' + escapeHtml(String(locs.length)) + ' location(s)</span>' +
                '</div>';
        }
        html += '</div></div>';
    }

    const warnings = [];
    if ((data.designCount || 0) === 0) {
        warnings.push('No design linked — a sales rep must assign the design manually in ShopWorks.');
    }
    // [B4] (P2-4, audit 2026-06-06): surface any fee the transformer demoted to an order Note instead of a
    // billable line, so the rep catches an under-bill before push. Transformer (audit 2026-06-10) emits one
    // "UNBILLED FEE — add manually: …" / "UNBILLED ITEM [type] — add manually: …" note per skipped fee;
    // the legacy comma-joined "Order notes: <fees>" blob is still matched for old pushes.
    for (const n of (Array.isArray(o.Notes) ? o.Notes : [])) {
        const t = String(n.Note || '');
        if (/^UNBILLED (FEE|ITEM)/i.test(t)) warnings.push(t);
        else if (/^Order notes:/i.test(t)) warnings.push('Fee sent as a note (not a billable line): ' + t.replace(/^Order notes:\s*/i, ''));
    }
    if (warnings.length > 0) {
        html += '<div class="preview-warnings"><h5><i class="fas fa-exclamation-triangle"></i> Heads up</h5><ul>';
        for (const w of warnings) html += '<li>' + escapeHtml(w) + '</li>';
        html += '</ul></div>';
    }

    // Surface the manual tax step (the push intentionally sends TaxTotal:0; the rate + account live in the
    // Notes On Order) so the rep knows to set tax in ShopWorks after import. (audit #11 2026-06-05)
    const oNotes = Array.isArray(o.Notes) ? o.Notes : [];
    // Pull the tax lines the transformer wrote (buildSalesTaxNote): "Tax Rate: X%", "Tax Account: C — D",
    // "Tax: DO NOT APPLY (out of state)", "Apply Tax: Manually in ShopWorks". Covers in-state, out-of-state,
    // and needs-review cases.
    const taxLines = oNotes.map(n => String(n.Note || '')).filter(t => /^(Tax Rate:|Tax Account:|Tax Amount:|Tax: |Apply Tax:|Rep:|State:)/i.test(t));  // +Rep:/State:/Tax Amount: so needs-review + out-of-state instructions surface (review C36)
    if (taxLines.length) {
        html += '<div class="preview-warnings preview-manual-tax"><h5><i class="fas fa-info-circle"></i> After import — set tax in ShopWorks</h5><ul>' +
            taxLines.map(t => '<li>' + escapeHtml(t.trim()) + '</li>').join('') +
            '</ul></div>';
    }

    previewEl.innerHTML = html;
}

// Perform the actual push (POST /push-quote). force=true re-pushes an
// already-pushed quote (creates a duplicate) — only set after the rep confirms.
async function confirmPushToShopWorks() {
    const confirmBtn = document.getElementById('emb-sw-push-confirm');
    const statusEl = document.getElementById('emb-sw-push-status');
    if (!_pushQuoteId || !confirmBtn) return;
    const force = confirmBtn.dataset.force === 'true';

    // [B5] (audit 2026-06-06): defense-in-depth — never silently re-push an already-pushed quote unless the
    // rep explicitly armed the duplicate button (force). Belt-and-suspenders behind the showPushButton lock.
    if (_pushAlreadyDone && !force) {
        showToast('Already sent to ShopWorks this session — use the "Push Again (creates duplicate)" button if you really mean to.', 'warning');
        return;
    }

    const origHtml = confirmBtn.innerHTML;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pushing…';

    try {
        const apiBase = window.APP_CONFIG.API.BASE_URL;
        const response = await fetch(`${apiBase}/api/embroidery-push/push-quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quoteId: _pushQuoteId, isTest: false, force }),
        });
        const data = await response.json();

        if (!response.ok) {
            if (response.status === 409) {
                // Caspio says already pushed — offer a guarded force re-push.
                if (statusEl) {
                    statusEl.innerHTML = '<div class="preview-warnings"><h5><i class="fas fa-exclamation-triangle"></i> ' +
                        'Already pushed</h5><ul><li>This quote was already pushed' +
                        (data.pushedAt ? ' on ' + escapeHtml(String(data.pushedAt)) : '') +
                        '. Click again to push a DUPLICATE.</li></ul></div>';
                }
                confirmBtn.dataset.force = 'true';
                confirmBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Push Again (creates duplicate)';
                confirmBtn.disabled = false;
                return;
            }
            throw new Error(data.error || data.details || `HTTP ${response.status}`);
        }

        // The push endpoint only confirms the order reached ManageOrders STAGING
        // (MO returns "...has been uploaded"). ShopWorks OnSite imports asynchronously
        // on its own download cycle, and that conversion can fail SILENTLY — an unmapped
        // size, an invalid customer/design #, etc. — leaving an order MO accepted but
        // OnSite never created. So we no longer claim "Pushed to ShopWorks" off the ack;
        // we report "Sent to ManageOrders" and verify the REAL OnSite import via
        // getorderno. (EMB-2026-269 false-success — MO said uploaded, OnSite never
        // imported it — 2026-06-02.)
        _pushAlreadyDone = true;
        updatePushButtonState();
        const extId = data.extOrderId || _pushQuoteId;
        if (statusEl) {
            statusEl.innerHTML = '<div class="shopworks-import-preview active" style="background:#eff6ff; border-color:#bfdbfe;">' +
                '<h4><i class="fas fa-paper-plane"></i> Sent to ManageOrders</h4>' +
                '<div class="preview-item-value">Uploaded as <strong>' + escapeHtml(extId) + '</strong> · ' +
                escapeHtml(String(data.lineItemCount || 0)) + ' line items · ' +
                escapeHtml(String(data.designCount || 0)) + ' design(s).</div>' +
                '<div style="margin-top:10px; color:#475569;">ShopWorks imports new orders on its own download cycle — ' +
                'confirm it actually landed in OnSite:</div>' +
                '<div id="emb-sw-import-result" style="margin-top:8px; font-size:0.92em;"></div>' +
                '<button type="button" id="emb-sw-verify-btn" style="margin-top:8px; padding:6px 12px; background:#1a5276; ' +
                'color:#fff; border:none; border-radius:6px; cursor:pointer;">' +
                '<i class="fas fa-magnifying-glass"></i> Verify in ShopWorks</button></div>';
            const vbtn = document.getElementById('emb-sw-verify-btn');
            if (vbtn) vbtn.addEventListener('click', () => verifyShopWorksImport(extId));
            // Initial check — usually still "pending" right after a push, which is the
            // honest state to show instead of a premature green check.
            verifyShopWorksImport(extId);
        }
        confirmBtn.style.display = 'none';
        showToast(`Sent to ManageOrders as ${extId} — verify ShopWorks import`, 'success');

    } catch (error) {
        console.error('[Embroidery] Push error:', error);
        if (statusEl) {
            statusEl.innerHTML = '<div class="preview-warnings"><h5><i class="fas fa-exclamation-triangle"></i> ' +
                'Push failed</h5><ul><li>' + escapeHtml(error.message) + '</li></ul></div>';
        }
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = origHtml;
        showToast(`Push failed: ${error.message}`, 'error');
    }
}

// Verify an order ACTUALLY imported into ShopWorks OnSite — not just that
// ManageOrders accepted the upload. getorderno queries OnSite's real orders by
// ExtOrderID: a non-empty result means OnSite created the order. Empty means
// it's either still pending OnSite's import cycle OR the MO→OnSite conversion
// failed (unmapped size, invalid customer/design #). This is the check that was
// missing when EMB-2026-269 reported success but never reached ShopWorks
// (2026-06-02). Uses APP_CONFIG.API.BASE_URL per the no-hardcoded-URL rule.
async function verifyShopWorksImport(extOrderId) {
    const out = document.getElementById('emb-sw-import-result');
    if (!extOrderId || !out) return;
    out.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking ShopWorks…';
    try {
        const apiBase = window.APP_CONFIG.API.BASE_URL;
        const resp = await fetch(`${apiBase}/api/manageorders/getorderno/${encodeURIComponent(extOrderId)}`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || data.details || `HTTP ${resp.status}`);
        const row = Array.isArray(data.result) && data.result.length ? data.result[0] : null;
        const orderNo = row ? (row.id_Order || row.ID_Order || row) : null;
        if (orderNo) {
            out.innerHTML = '<span style="color:#15803d; font-weight:600;"><i class="fas fa-check-circle"></i> ' +
                'Confirmed in ShopWorks — order #' + escapeHtml(String(orderNo)) + '</span>';
        } else {
            out.innerHTML = '<span style="color:#b45309;"><i class="fas fa-exclamation-triangle"></i> ' +
                '<strong>Not in ShopWorks yet.</strong> ManageOrders accepted the upload, but OnSite has not ' +
                'imported it. OnSite pulls new orders periodically — wait a few minutes and click ' +
                '“Verify in ShopWorks” again. If it never appears, the MO→OnSite conversion failed ' +
                '(commonly an unmapped size or an invalid customer/design #) — check the ManageOrders ' +
                'conversion log for this order.</span>';
        }
    } catch (err) {
        out.innerHTML = '<span style="color:#b45309;"><i class="fas fa-exclamation-triangle"></i> ' +
            'Could not verify ShopWorks import: ' + escapeHtml(err.message) + '. Try again shortly.</span>';
    }
}

function closePushPreview() {
    const modal = document.getElementById('emb-sw-push-modal');
    if (modal) modal.classList.remove('active');
    // P2-16: restore focus to whatever opened the modal (a11y — focus must not vanish to <body>).
    try { if (window._pushModalOpener && window._pushModalOpener.focus) window._pushModalOpener.focus(); } catch (_) {}
}

// NOTE: pushToShopWorks() (defined above) now AUTO-SAVES then opens the push preview. The old
// back-compat alias that just called openPushPreview() was removed so the auto-save wrapper wins
// (a later same-name function declaration would otherwise override it). (Erik 2026-06-05)

// embEmailQuote() — single definition lives later in this file (the earlier
// byte-identical duplicate was removed 2026-06-07; the later one wins via hoisting).

// ============================================
// Additional Charges Section Functions
// ============================================

/**
 * Toggle Additional Charges panel visibility
 * Panel is COLLAPSED by default to reduce visual clutter
 */
function toggleAdditionalCharges() {
    const content = document.getElementById('charges-content');
    const chevron = document.getElementById('charges-chevron');
    if (content.style.display === 'none') {
        // Expanding - show content, chevron points UP
        content.style.display = 'block';
        chevron.style.transform = 'rotate(0deg)';
    } else {
        // Collapsing - hide content, chevron points DOWN
        content.style.display = 'none';
        chevron.style.transform = 'rotate(180deg)';
    }
}

// toggleSaveShare() — EMB-local copy removed 2026-06-07 (dead: the EMB UI has no
// #save-share-content panel). The live copy is the shared one in quote-builder-utils.js,
// which DTF/SCP/legacy-DTG still use.

function toggleOrderDetails() {
    const content = document.getElementById('order-details-content');
    const chevron = document.getElementById('order-details-chevron');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        chevron.style.transform = 'rotate(180deg)';
    } else {
        content.style.display = 'none';
        chevron.style.transform = '';
    }
}

// ============================================
// Unsaved Changes Tracking (UX Improvement)
// ============================================

/**
 * Mark quote as having unsaved changes
 * Shows pulsing "Unsaved" badge in header
 */
// markAsUnsaved(), markAsSaved(), hasUnsavedChanges() → moved to quote-builder-utils.js

/**
 * Setup event listeners for tracking unsaved changes
 * Adds listeners to customer fields and additional charges
 */
function setupUnsavedChangesTracking() {
    // Customer fields
    const customerFields = [
        'customer-name', 'customer-email', 'company-name', 'customer-lookup', 'sales-rep'
    ];
    customerFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', markAsUnsaved);
            el.addEventListener('change', markAsUnsaved);
        }
    });

    // Additional charges fields
    const chargeFields = [
        'rush-fee', 'discount-amount', 'discount-reason', 'art-charge', 'graphic-design-hours'
    ];
    chargeFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', markAsUnsaved);
            el.addEventListener('change', markAsUnsaved);
        }
    });

    // Logo configuration fields
    const logoFields = [
        'primary-position', 'primary-stitches', 'primary-digitizing',
        'fb-stitch-count',
        'garment-al-digitizing-checkbox',
        'cap-primary-stitches', 'cap-al-digitizing-checkbox',
        'cap-embellishment-type'
    ];
    logoFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', markAsUnsaved);
            el.addEventListener('change', markAsUnsaved);
        }
    });
}

// ============================================
// New Quote Functionality (UX Improvement)
// ============================================

/**
 * Confirm and start a new quote
 * Prompts user if there are unsaved changes
 */
// confirmNewQuote() → moved to quote-builder-utils.js

/**
 * Reset all quote data and start fresh
 */
// P2-8 (audit 2026-06-06): the CRM context banners (warning / tax-exempt chip / tier badge / terms note)
// are painted by surfaceCustomerContext on customer select but were never cleared — so they bled onto the
// next/blank customer after Start-New or a manual re-entry. Clear them on reset + lookup-clear.
function clearCustomerContextBanners() {
    ['customer-warning-banner', 'customer-tax-chip', 'customer-tier-badge', 'customer-terms-note'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.innerHTML = ''; el.style.display = 'none'; }
    });
    // [B8] (audit 2026-06-06): clear the persisted tax-exemption so it can't leak into the next quote and
    // suppress a legitimate tax lookup.
    window._taxExempt = false;
}

function resetQuote() {
    clearCustomerContextBanners();  // P2-8: don't bleed the prior customer's CRM banners into a new quote
    // Hide + zero the sidebar TOTAL bar (re-shown on first recalc)
    const _stb = document.getElementById('sidebar-total-bar');
    if (_stb) _stb.hidden = true;
    const _stg = document.getElementById('sidebar-grand-total');
    if (_stg) _stg.textContent = '$0.00';
    // Clear all product rows and re-add empty state
    const tbody = document.getElementById('product-tbody');
    tbody.innerHTML = `
        <tr id="empty-state-row">
            <td colspan="14" style="text-align: center; padding: 40px 20px; color: #64748b; background: #f8fafc;">
                <div style="font-size: 32px; margin-bottom: 12px;">&#128085;</div>
                <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Enter a style number to get started</div>
                <div style="font-size: 13px; color: #94a3b8;">Type a style # in the search bar above (e.g., PC54, G500, C112)</div>
            </td>
        </tr>
    `;

    // Reset row counter + the child-row map (module-level) — else a previous quote's 2XL/3XL child-row
    // references leak into the next quote and can mis-map size overrides on save. (audit #13c 2026-06-05)
    rowCounter = 0;
    childRowMap = {};
    // [2026-06-07] Clear the wholesale flag + checkbox so it doesn't leak into the next quote.
    window._isWholesale = false;
    const _wholesaleReset = document.getElementById('wholesale-checkbox');
    if (_wholesaleReset) _wholesaleReset.checked = false;

    // Reset logo cards visibility
    const garmentCard = document.getElementById('garment-logo-card');
    const capCard = document.getElementById('cap-logo-card');
    if (garmentCard) garmentCard.style.display = 'none';
    if (capCard) capCard.style.display = 'none';
    // Clear the artwork UPLOAD widget (files + design name). Without this, a logo uploaded on
    // the previous quote BLEEDS into the next quote and gets saved + pushed to ShopWorks — the
    // wrong logo embroidered on a real order. (The old comment here confused the removed charge
    // panel with this widget.) DTF does the same via _dtfArtwork.clear(). (2026-06-04 audit B1)
    try { window._embArtwork?.clear?.(); } catch (_) {}

    // Reset logo configurations to defaults
    primaryLogo.position = 'Left Chest';
    primaryLogo.stitchCount = EMB_DEFAULTS.GARMENT_STITCH_COUNT;
    primaryLogo.needsDigitizing = false;
    primaryLogo.designNumber = null;
    primaryLogo.designName = null;
    primaryLogo.thumbnailUrl = null;
    updateLogoCardHeader('garment', null);
    // Clear design number inputs
    const gDesignInput = document.getElementById('garment-design-number');
    if (gDesignInput) gDesignInput.value = '';
    const gDesignInfo = document.getElementById('garment-design-info');
    if (gDesignInfo) { gDesignInfo.style.display = 'none'; gDesignInfo.innerHTML = ''; }
    const gDesignClear = document.getElementById('garment-design-clear');
    if (gDesignClear) gDesignClear.style.display = 'none';
    showDesignThumbnail('garment', null);
    if (typeof capPrimaryLogo !== 'undefined') {
        capPrimaryLogo.designNumber = null;
        capPrimaryLogo.designName = null;
        capPrimaryLogo.thumbnailUrl = null;
        capPrimaryLogo.embellishmentType = 'embroidery';  // else a prior quote's 3D-puff / laser-patch bleeds into the next (audit #13c 2026-06-05)
        const cEmbSel = document.getElementById('cap-embellishment-type');
        if (cEmbSel) { cEmbSel.value = 'embroidery'; if (typeof handleCapEmbellishmentChange === 'function') handleCapEmbellishmentChange(); }
        updateLogoCardHeader('cap', null);
        const cDesignInput = document.getElementById('cap-design-number');
        if (cDesignInput) cDesignInput.value = '';
        const cDesignInfo = document.getElementById('cap-design-info');
        if (cDesignInfo) { cDesignInfo.style.display = 'none'; cDesignInfo.innerHTML = ''; }
        const cDesignClear = document.getElementById('cap-design-clear');
        if (cDesignClear) cDesignClear.style.display = 'none';
        showDesignThumbnail('cap', null);
    }
    // Clear thumbnail and gallery caches
    if (typeof DesignThumbnailService !== 'undefined') DesignThumbnailService.clearCache();
    resetDesignSearchState(); // gallery cache + search state live in builders/emb/design-search.js
    // Clear cached design data from logo objects
    primaryLogo._designData = null;
    if (typeof capPrimaryLogo !== 'undefined') capPrimaryLogo._designData = null;
    document.getElementById('primary-position').value = 'Left Chest';
    document.getElementById('primary-stitches').value = EMB_DEFAULTS.GARMENT_STITCH_COUNT;
    document.getElementById('primary-digitizing').checked = false;
    // Reset patch setup checkbox
    const patchSetupCheckbox = document.getElementById('cap-patch-setup');
    if (patchSetupCheckbox) {
        patchSetupCheckbox.checked = false;
        const wrapper = patchSetupCheckbox.closest('.digitizing-checkbox');
        if (wrapper) wrapper.classList.remove('checked');
    }
    // Re-enable position dropdown in case it was disabled by Full Back
    document.getElementById('primary-position').disabled = false;
    // Hide and reset Full Back stitch count input
    const fbField = document.getElementById('fb-stitch-count-field');
    if (fbField) fbField.style.display = 'none';
    const fbInput = document.getElementById('fb-stitch-count');
    if (fbInput) fbInput.value = 25000;
    // Reset cap tier dropdown
    const capTierEl = document.getElementById('cap-primary-stitches');
    if (capTierEl) capTierEl.value = '8000';

    // Reset additional logo toggles and globalAL state
    globalAL.garment = { enabled: false, position: 'AL', stitchCount: EMB_DEFAULTS.AL_GARMENT_STITCH_COUNT, needsDigitizing: false };
    globalAL.cap = { enabled: false, position: 'AL-Cap', stitchCount: EMB_DEFAULTS.CAP_STITCH_COUNT, needsDigitizing: false };
    _syncALArrays();

    const garmentALSwitch = document.getElementById('garment-al-switch');
    const garmentALLabel = document.getElementById('garment-al-label');
    const garmentALConfig = document.getElementById('garment-al-config-new');
    const capALSwitch = document.getElementById('cap-al-switch');
    const capALLabel = document.getElementById('cap-al-label');
    const capALConfig = document.getElementById('cap-al-config-new');
    if (garmentALSwitch) garmentALSwitch.classList.remove('active');
    if (garmentALLabel) garmentALLabel.classList.remove('active');
    if (garmentALConfig) garmentALConfig.classList.remove('visible');
    if (capALSwitch) capALSwitch.classList.remove('active');
    if (capALLabel) capALLabel.classList.remove('active');
    if (capALConfig) capALConfig.classList.remove('visible');
    document.getElementById('garment-al-toggle').checked = false;
    document.getElementById('cap-al-toggle').checked = false;

    // Reset customer form fields
    document.getElementById('customer-name').value = '';
    document.getElementById('customer-email').value = '';
    document.getElementById('company-name').value = '';
    document.getElementById('customer-phone').value = '';
    document.getElementById('customer-lookup').value = '';
    { const pn = document.getElementById('project-name'); if (pn) pn.value = ''; }  // P2-5 (audit 2026-06-06)

    // Reset notes
    const notesEl = document.getElementById('notes');
    if (notesEl) notesEl.value = '';
    const notesSection = document.getElementById('notes-section');
    if (notesSection) {
        notesSection.classList.add('collapsed');
        const notesBody = notesSection.querySelector('.notes-body');
        const notesIcon = notesSection.querySelector('.notes-toggle-icon');
        if (notesBody) notesBody.style.display = 'none';
        if (notesIcon) notesIcon.style.transform = '';
    }
    updateNotesBadge();

    // Reset LTM control panel
    setLtmControlState('emb-ltm-panel', { enabled: true, displayMode: 'builtin' });
    document.getElementById('emb-ltm-wrapper').style.display = 'none';

    // Reset additional charges
    document.getElementById('shipping-fee').value = '0';
    const taxRateInput = document.getElementById('tax-rate-input');
    if (taxRateInput) taxRateInput.value = '10.2';
    document.getElementById('include-tax').checked = true;
    document.getElementById('rush-fee').value = '';

    // Reset Ship To fields
    document.getElementById('ship-address').value = '';
    document.getElementById('ship-city').value = '';
    document.getElementById('ship-state').value = 'WA';
    document.getElementById('ship-zip').value = '';
    const taxStatus = document.getElementById('tax-lookup-status');
    if (taxStatus) taxStatus.innerHTML = '';

    // Reset Order Details fields
    document.getElementById('po-number').value = '';
    document.getElementById('order-number').value = '';
    document.getElementById('customer-number').value = '';
    document.getElementById('ship-method').value = 'Customer Pickup';
    document.getElementById('ship-method-other').value = '';
    window._lastCustomerShipTo = null;
    onShipMethodChange();
    document.getElementById('date-order-placed').value = '';
    document.getElementById('req-ship-date').value = '';
    document.getElementById('drop-dead-date').value = '';
    document.getElementById('payment-terms').value = '';
    // New-quote date defaults (today / +2 weeks) — refills the just-cleared blanks
    if (typeof setQuoteDateDefaults === 'function') setQuoteDateDefaults();
    const odContent = document.getElementById('order-details-content');
    const odChevron = document.getElementById('order-details-chevron');
    const odBadge = document.getElementById('order-details-badge');
    if (odContent) odContent.style.display = '';   // always-visible flow-step body now
    if (odChevron) odChevron.style.transform = '';
    if (odBadge) odBadge.style.display = 'none';
    // NOTE: discount-amount / discount-reason / art-charge were removed when the
    // discount + artwork-services panels were replaced. Bare getElementById().value
    // here threw and ABORTED resetQuote → the builder stayed in edit mode and the next
    // save silently overwrote the previous quote. Guard every access. (2026-06-04)
    const discAmt = document.getElementById('discount-amount'); if (discAmt) discAmt.value = '';
    const reasonPreset = document.getElementById('discount-reason-preset');
    if (reasonPreset) reasonPreset.value = '';
    const reasonInput = document.getElementById('discount-reason');
    if (reasonInput) { reasonInput.value = ''; reasonInput.style.display = 'none'; }
    const artCharge = document.getElementById('art-charge'); if (artCharge) { artCharge.value = 0; artCharge.disabled = true; }
    const artToggle = document.getElementById('art-charge-toggle'); if (artToggle) artToggle.checked = false;
    const artChargeWrapper = document.getElementById('art-charge-wrapper');
    if (artChargeWrapper) artChargeWrapper.style.opacity = '0.4';
    const gdh = document.getElementById('graphic-design-hours'); if (gdh) gdh.value = '';
    // Reset artwork badge
    const artworkBadge = document.getElementById('artwork-badge');
    if (artworkBadge) {
        artworkBadge.classList.add('hidden');
        artworkBadge.style.display = 'none';
    }

    // Clear edit mode and import metadata
    editingQuoteId = null;
    editingRevision = null;
    lastImportMetadata = null;

    // Clear ShopWorks push state — else a brand-new quote inherits the PREVIOUS quote's _pushQuoteId
    // (could preview/push the OLD order from a blank form — wrong order to production) and its
    // _pushAlreadyDone "Sent ✓" state (stuck disabled button + blank readiness checklist). showPushButton
    // only resets these on save, which New-Quote-without-save never reaches. (review C3/C7 2026-06-05)
    _pushAlreadyDone = false;
    _pushQuoteId = null;
    if (typeof updatePushButtonState === 'function') { try { updatePushButtonState(); } catch (_) {} }

    // Clear draft storage
    if (embPersistence) {
        embPersistence.clearDraft();
    }

    // Recalculate pricing (will show zeros)
    recalculatePricing();
    updateAdditionalCharges();

    // Mark as saved (no unsaved changes)
    markAsSaved();

    // Focus search bar for immediate typing
    const searchInput = document.getElementById('product-search');
    if (searchInput) {
        searchInput.focus();
    }

    showToast('Ready for new quote', 'success');
}

/**
 * Update discount symbol when type changes ($ vs %)
 */
function updateDiscountType() {
    const discountType = document.getElementById('discount-type')?.value;
    const symbol = document.getElementById('discount-symbol');
    const inputWrapper = document.getElementById('discount-input-wrapper');
    const presetDropdown = document.getElementById('discount-preset');
    const amountInput = document.getElementById('discount-amount');

    if (discountType === 'percent') {
        // Show preset dropdown, hide number input
        if (inputWrapper) inputWrapper.style.display = 'none';
        if (presetDropdown) presetDropdown.style.display = 'block';
        // Set amount from preset (unless custom is selected)
        if (presetDropdown && presetDropdown.value !== 'custom') {
            if (amountInput) amountInput.value = presetDropdown.value;
        }
    } else {
        // Show number input, hide preset dropdown
        if (inputWrapper) inputWrapper.style.display = 'block';
        if (presetDropdown) presetDropdown.style.display = 'none';
        if (symbol) symbol.textContent = '$';
    }

    updateAdditionalCharges();
}

function handleDiscountPresetChange() {
    const preset = document.getElementById('discount-preset')?.value;
    const inputWrapper = document.getElementById('discount-input-wrapper');
    const amountInput = document.getElementById('discount-amount');
    const symbol = document.getElementById('discount-symbol');

    if (preset === 'custom') {
        // Show number input for custom entry
        if (inputWrapper) inputWrapper.style.display = 'block';
        if (symbol) symbol.textContent = '%';
        if (amountInput) amountInput.focus();
    } else {
        // Use preset value
        if (inputWrapper) inputWrapper.style.display = 'none';
        if (amountInput) amountInput.value = preset;
    }
    updateFeeTableRows();
}

function handleDiscountReasonPresetChange() {
    const preset = document.getElementById('discount-reason-preset')?.value;
    const customInput = document.getElementById('discount-reason');

    if (preset === 'custom') {
        // Show custom input and focus it
        if (customInput) {
            customInput.style.display = 'block';
            customInput.value = '';
            customInput.focus();
        }
    } else {
        // Hide custom input and use preset value
        if (customInput) {
            customInput.style.display = 'none';
            customInput.value = preset;
        }
    }
    updateFeeTableRows();
}

/**
 * Calculate and update additional charges display badge
 */
function onLtmOverrideChange() {
    // Now handled by initLtmControlListeners callback — kept for backward compat
    recalculatePricing();
    markAsUnsaved();
}

function updateAdditionalCharges() {
    const artCharge = parseFloat(document.getElementById('art-charge')?.value) || 0;
    const graphicDesignHours = parseFloat(document.getElementById('graphic-design-hours')?.value) || 0;
    const grtRate = getServicePrice('GRT-75', 75); // GRT-75 rate from Service_Codes API (review C8)
    // Missing-service-code visible warning — shared helper (quote-builder-utils.js),
    // synced with DTF/SCP (2026-07-04, Erik's #1 rule). Covers the silent case where
    // codes loaded but GRT-75 is absent, so a rep never bills the $75 fallback unwarned.
    if (graphicDesignHours > 0 && typeof window.warnIfServiceCodeMissing === 'function') {
        window.warnIfServiceCodeMissing('GRT-75', grtRate, 'Graphic-design');
    }
    const graphicDesignCharge = graphicDesignHours * grtRate;
    const rushFee = parseFloat(document.getElementById('rush-fee')?.value) || 0;
    const sampleFee = parseFloat(document.getElementById('sample-fee')?.value) || 0;
    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value) || 0;
    const discountType = document.getElementById('discount-type')?.value || 'fixed';

    // Update graphic design total display
    const graphicDesignTotalEl = document.getElementById('graphic-design-total');
    if (graphicDesignTotalEl) {
        graphicDesignTotalEl.textContent = graphicDesignCharge.toFixed(2);
    }

    const shippingFeeVal = parseFloat(document.getElementById('shipping-fee')?.value) || 0;

    // Calculate total additional charges (before discount)
    const totalCharges = artCharge + graphicDesignCharge + rushFee + sampleFee + shippingFeeVal;

    // Calculate discount value
    let discountValue = 0;
    if (discountType === 'percent') {
        // Get current subtotal from pricing summary for percentage calculation
        const subtotalText = document.getElementById('subtotal')?.textContent || '$0.00';
        const subtotal = parseFloat(subtotalText.replace(/[$,]/g, '')) || 0;
        discountValue = subtotal * (discountAmount / 100);
    } else {
        discountValue = discountAmount;
    }

    // Net additional = charges - discount
    const netAdditional = totalCharges - discountValue;

    // Update badge
    const badge = document.getElementById('charges-badge');
    if (netAdditional !== 0) {
        badge.style.display = 'inline';
        badge.textContent = netAdditional >= 0
            ? `+$${netAdditional.toFixed(2)}`
            : `-$${Math.abs(netAdditional).toFixed(2)}`;
        badge.style.background = netAdditional >= 0 ? '#22c55e' : '#dc2626';
    } else {
        badge.style.display = 'none';
    }

    // Update fee table rows (2026 refactor)
    updateFeeTableRows();
}

/**
 * Update fee table rows based on current input values
 * Shows/hides rows in the products table based on fee values
 */
function updateFeeTableRows() {
    // Art charge row
    const artChargeRow = document.getElementById('art-charge-row');
    const artChargeToggle = document.getElementById('art-charge-toggle');
    const artCharge = parseFloat(document.getElementById('art-charge')?.value || 0);
    if (artChargeRow) {
        if (artChargeToggle?.checked && artCharge > 0) {
            artChargeRow.style.display = 'table-row';
            document.getElementById('art-charge-unit').textContent = '$' + artCharge.toFixed(2);
            document.getElementById('art-charge-total').textContent = '$' + artCharge.toFixed(2);
        } else {
            artChargeRow.style.display = 'none';
        }
    }

    // Graphic design row
    const graphicDesignRow = document.getElementById('graphic-design-row');
    const designHours = parseFloat(document.getElementById('graphic-design-hours')?.value || 0);
    const designTotal = designHours * getServicePrice('GRT-75', 75);  // GRT-75 rate from Service_Codes API (review C8)
    if (graphicDesignRow) {
        if (designHours > 0) {
            graphicDesignRow.style.display = 'table-row';
            document.getElementById('design-hours-label').textContent = designHours;
            document.getElementById('graphic-design-unit').textContent = '$' + designTotal.toFixed(2);
            document.getElementById('graphic-design-total-row').textContent = '$' + designTotal.toFixed(2);
        } else {
            graphicDesignRow.style.display = 'none';
        }
    }

    // Rush fee row
    const rushFeeRow = document.getElementById('rush-fee-row');
    const rushFee = parseFloat(document.getElementById('rush-fee')?.value || 0);
    if (rushFeeRow) {
        if (rushFee > 0) {
            rushFeeRow.style.display = 'table-row';
            document.getElementById('rush-fee-unit').textContent = '$' + rushFee.toFixed(2);
            document.getElementById('rush-fee-total').textContent = '$' + rushFee.toFixed(2);
        } else {
            rushFeeRow.style.display = 'none';
        }
    }

    // Discount row
    const discountRow = document.getElementById('discount-row');
    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value || 0);
    const discountType = document.getElementById('discount-type')?.value || 'fixed';
    const discountReason = document.getElementById('discount-reason')?.value || '';
    if (discountRow) {
        if (discountAmount > 0) {
            discountRow.style.display = 'table-row';
            let actualDiscount = discountAmount;
            if (discountType === 'percent') {
                const { discount } = calculateDiscountableSubtotal();
                actualDiscount = discount;
            }
            const reasonLabel = document.getElementById('discount-reason-label');
            if (reasonLabel) {
                let labelParts = [];
                if (discountType === 'percent') {
                    labelParts.push(`${discountAmount}%`);
                }
                if (discountReason) {
                    labelParts.push(discountReason);
                }
                reasonLabel.textContent = labelParts.length > 0 ? `(${labelParts.join(' - ')})` : '';
            }
            document.getElementById('discount-unit').textContent = '-$' + actualDiscount.toFixed(2);
            document.getElementById('discount-total').textContent = '-$' + actualDiscount.toFixed(2);
        } else {
            discountRow.style.display = 'none';
        }
    }
}

/**
 * Get additional charges data for saving to database
 * @returns {Object} Additional charges object
 */
function getAdditionalCharges() {
    const discountAmount = parseFloat(document.getElementById('discount-amount')?.value) || 0;
    const discountType = document.getElementById('discount-type')?.value || 'fixed';

    // Use shared helper for consistent discount calculation
    const { discount: discountValue } = calculateDiscountableSubtotal();
    const discountPercent = discountType === 'percent' ? discountAmount : 0;

    // Graphic Design Services (GRT-75) @ $75/hr
    const graphicDesignHours = parseFloat(document.getElementById('graphic-design-hours')?.value) || 0;
    const graphicDesignCharge = graphicDesignHours * getServicePrice('GRT-75', 75);  // GRT-75 rate from Service_Codes API (review C8)

    // DECG/DECC data now collected from service product rows (not fee rows)
    // Use collectDECGItems() which reads from product table
    const decgItems = collectDECGItems();
    const decgItem = decgItems.find(i => i.type === 'DECG');
    const deccItem = decgItems.find(i => i.type === 'DECC');

    return {
        artCharge: parseFloat(document.getElementById('art-charge')?.value) || 0,
        graphicDesignHours: graphicDesignHours,
        graphicDesignCharge: graphicDesignCharge,
        rushFee: parseFloat(document.getElementById('rush-fee')?.value) || 0,
        sampleFee: parseFloat(document.getElementById('sample-fee')?.value) || 0,
        sampleQty: parseInt(document.getElementById('sample-qty')?.value) || 1,
        discount: discountValue,
        discountPercent: discountPercent,
        discountReason: document.getElementById('discount-reason')?.value?.trim() || '',
        // DECG/DECC (Customer-Supplied items) for PDF and shareable URLs - from service product rows
        decgQty: decgItem?.quantity || 0,
        decgUnit: decgItem?.unitPrice || 0,
        decgTotal: decgItem?.total || 0,
        deccQty: deccItem?.quantity || 0,
        deccUnit: deccItem?.unitPrice || 0,
        deccTotal: deccItem?.total || 0
    };
}

/**
 * Collect DECG (Customer-Supplied Garments) and DECC (Customer-Supplied Caps) data
 * Now reads from service product rows in the product table
 * Used for shareable URLs and PDF generation
 * @returns {Array} Array of DECG/DECC items with type, quantity, unitPrice, total, stitchCount
 */
function collectDECGItems() {
    const items = [];

    // Find service product rows for DECG and DECC
    const serviceRows = document.querySelectorAll('#product-tbody tr.service-product-row');
    serviceRows.forEach(row => {
        const serviceType = row.dataset.serviceType?.toUpperCase();
        if (serviceType === 'DECG' || serviceType === 'DECC') {
            const qtyInput = row.querySelector('.service-qty');
            const qty = parseInt(qtyInput?.value) || 0;
            // Use sell price override if set, otherwise original unit price
            const overridePrice = parseFloat(row.dataset.sellPrice) || 0;
            const unitPrice = overridePrice > 0 ? overridePrice : (parseFloat(row.dataset.unitPrice) || 0);
            const stitchCount = parseInt(row.dataset.stitchCount) || 8000;
            const heavyweight = row.dataset.decgHeavyweight === 'true';

            if (qty > 0) {
                items.push({
                    type: serviceType,
                    quantity: qty,
                    unitPrice: unitPrice,
                    total: qty * unitPrice,
                    stitchCount: stitchCount,
                    heavyweight: heavyweight,
                    rowId: row.dataset.rowId,
                    hasPriceOverride: overridePrice > 0
                });
            }
        }
    });

    return items;
}

// ============================================================
// UTILITIES
// ============================================================

// showLoading(), showToast() → provided by quote-builder-utils.js

// ============================================================
// SHOPWORKS IMPORT FUNCTIONS
// ============================================================

// Store parsed data for confirmation
let pendingShopWorksImport = null;

// Store import metadata for Caspio save (designNumbers, warnings, unmatchedLines)
let lastImportMetadata = null;
// ============================================================
// SHOPWORKS IMPORT (modal, parse/preview/confirm, non-SanMar modal,
// import banner) — MOVED to builders/emb/shopworks-import.js
// (roadmap 0.4 extraction #3, 2026-07-07). Bridged via the builders/emb
// bundle. pendingShopWorksImport + lastImportMetadata stay declared above
// (26 outside readers of lastImportMetadata — they migrate with clusters
// 6/11); the module reaches them through the global scope chain.
// ============================================================

// ============================================================
// OUTPUT & DIAGNOSTICS (diagnoseQuote, buildEmbroideryPricingData,
// copy/print/email quote) — MOVED to builders/emb/output.js
// (roadmap 0.4 extraction #5, 2026-07-07). Bridged via the builders/emb
// bundle before DOMContentLoaded.
// ============================================================

// In-flight reprice pill (old-audit price-display #5, 2026-07-07): wrap the
// recalc entry point so slow /api/pricing-bundle refreshes show "Updating
// prices…" instead of silently displaying the previous numbers.
if (typeof wrapWithRepricingIndicator === 'function') {
    recalculatePricing = wrapWithRepricingIndicator(recalculatePricing);
}
