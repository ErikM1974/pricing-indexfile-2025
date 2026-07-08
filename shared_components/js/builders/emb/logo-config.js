/**
 * EMB logo-config module — roadmap 0.4 extraction #9 (2026-07-07).
 *
 * The logo configuration UI: stitch estimators + tier dropdowns (garment,
 * full-back, cap), logo card toggles, global Additional-Logo state sync
 * (_syncALArrays — additionalLogos/capAdditionalLogos derive from globalAL),
 * cap embellishment types (flat/3D-puff/patch), notes badge.
 *
 * Moved verbatim from embroidery-quote-builder.js (~380-line contiguous
 * cluster incl. STITCH_DENSITY). Externals are ONLY the shared state vars
 * (config-level writable globals); siblings real-import the helpers.
 */
// @ts-nocheck — MOVED legacy DOM code: pre-existing checkJs frictions; typing
// lands with this cluster's render/state split (see emb-decomposition-plan.md).
/* global showToast, Event */
import { recalculatePricing } from './pricing-sync.js';
import { embState } from './state.js';

// Sync module-level AL arrays from globalAL state
// Called whenever globalAL changes so all existing references (save, invoice, etc.) get correct data
export function _syncALArrays() {
    embState.additionalLogos = embState.globalAL.garment.enabled ? [{
        id: 'global-al-garment',
        position: 'AL',
        stitchCount: embState.globalAL.garment.stitchCount,
        needsDigitizing: embState.globalAL.garment.needsDigitizing,
        isPrimary: false
    }] : [];
    embState.capAdditionalLogos = embState.globalAL.cap.enabled ? [{
        id: 'global-al-cap',
        position: 'AL-Cap',
        stitchCount: embState.globalAL.cap.stitchCount,
        needsDigitizing: embState.globalAL.cap.needsDigitizing,
        isPrimary: false
    }] : [];
}

// Handle primary logo position change (for Full Back 25K minimum)
// Map arbitrary stitch count to nearest tier dropdown value
export function mapStitchCountToTierValue(stitchCount, position) {
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

export function initStitchEstimators() {
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

export function openStitchEstimator(selId, kind, anchorBtn) {
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

export function onPrimaryPositionChange() {
    const posSelect = document.getElementById('primary-position');
    const tierSelect = document.getElementById('primary-stitches');
    const fbField = document.getElementById('fb-stitch-count-field');
    embState.primaryLogo.position = posSelect.value;

    if (posSelect.value === 'Full Back') {
        tierSelect.value = '25000';
        fbField.style.display = '';
        const fbInput = document.getElementById('fb-stitch-count');
        embState.primaryLogo.stitchCount = parseInt(fbInput.value) || 25000;
        showToast('Full Back requires minimum 25,000 stitches', 'info');
    } else {
        fbField.style.display = 'none';
        if (parseInt(tierSelect.value) >= 25000) {
            // Switching away from Full Back — reset tier
            tierSelect.value = '8000';
            embState.primaryLogo.stitchCount = 8000;
        }
    }
    recalculatePricing();
}

// Handle garment stitch tier dropdown change
export function onPrimaryStitchTierChange() {
    const select = document.getElementById('primary-stitches');
    const posSelect = document.getElementById('primary-position');
    const fbField = document.getElementById('fb-stitch-count-field');
    const sc = parseInt(select.value) || 8000;

    if (sc >= 25000) {
        // Full Back tier selected — sync position, show stitch input
        posSelect.value = 'Full Back';
        embState.primaryLogo.position = 'Full Back';
        posSelect.disabled = true;
        fbField.style.display = '';
        const fbInput = document.getElementById('fb-stitch-count');
        embState.primaryLogo.stitchCount = parseInt(fbInput.value) || 25000;
    } else {
        // Standard/Mid/Large — hide FB stitch input
        fbField.style.display = 'none';
        embState.primaryLogo.stitchCount = sc;
        if (posSelect.disabled) {
            posSelect.disabled = false;
            posSelect.value = 'Left Chest';
            embState.primaryLogo.position = 'Left Chest';
        }
    }
    recalculatePricing();
}

// Handle Full Back stitch count input change
export function onFullBackStitchCountChange() {
    const fbInput = document.getElementById('fb-stitch-count');
    const val = parseInt(fbInput.value) || 25000;
    embState.primaryLogo.stitchCount = Math.max(val, 25000);
    recalculatePricing();
}

// Handle cap stitch tier dropdown change
export function onCapStitchTierChange() {
    const select = document.getElementById('cap-primary-stitches');
    embState.capPrimaryLogo.stitchCount = parseInt(select.value) || 8000;
    recalculatePricing();
}

// Update dropdown labels from API-driven surcharge data
export function updateStitchTierDropdownLabels() {
    const data = embState.pricingCalculator && embState.pricingCalculator.stitchSurchargeData;
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
export function updateGlobalAL(type) {
    // Stitch count is always base (no input field — simplified)
    const digitizingCheckbox = document.getElementById(`${type}-al-digitizing-checkbox`);
    if (digitizingCheckbox) embState.globalAL[type].needsDigitizing = digitizingCheckbox.checked;

    _syncALArrays();
    recalculatePricing();
}

// NEW: Toggle function for modernized toggle switch UI
export function toggleGlobalALNew(type) {
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
    embState.globalAL[type].enabled = isActive;

    // Sync module-level arrays and recalculate
    _syncALArrays();
    recalculatePricing();
}

// Toggle logo card collapse/expand
export function toggleLogoCard(cardId) {
    const card = document.getElementById(cardId);
    if (card) card.classList.toggle('collapsed');
}

// Toggle notes section collapse/expand
export function toggleNotesSection() {
    const section = document.getElementById('notes-section');
    if (!section) return;
    const isCollapsed = section.classList.toggle('collapsed');
    const body = section.querySelector('.notes-body');
    const icon = section.querySelector('.notes-toggle-icon');
    if (body) body.style.display = isCollapsed ? 'none' : 'block';
    if (icon) icon.style.transform = isCollapsed ? '' : 'rotate(180deg)';
}

// Update notes badge count
export function updateNotesBadge() {
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
export function toggleDigitizingCheckbox(element, checkboxId) {
    const checkbox = document.getElementById(checkboxId);
    checkbox.checked = !checkbox.checked;
    element.classList.toggle('checked', checkbox.checked);

    // Update the corresponding logo object based on checkbox ID
    if (checkboxId === 'primary-digitizing') {
        embState.primaryLogo.needsDigitizing = checkbox.checked;
    } else if (checkboxId === 'cap-primary-digitizing') {
        embState.capPrimaryLogo.needsDigitizing = checkbox.checked;
    } else if (checkboxId === 'cap-patch-setup') {
        embState.capPrimaryLogo.needsSetup = checkbox.checked;
    }

    // Trigger pricing recalculation
    recalculatePricing();
}

// toggleArtCharge(), toggleArtworkServices(), updateArtworkCharges()
// moved to quote-builder-utils.js

// Handle cap embellishment type change (Flat Embroidery, 3D Puff, or Patch)
export function handleCapEmbellishmentChange() {
    const embellishmentType = document.getElementById('cap-embellishment-type').value;
    const embroideryOptions = document.getElementById('cap-embroidery-options');
    const patchOptions = document.getElementById('cap-patch-options');

    // Update the capPrimaryLogo object with new embellishment type
    embState.capPrimaryLogo.embellishmentType = embellishmentType;

    if (embellishmentType === 'laser-patch') {
        // Show patch options, hide embroidery options (AL toggle is inside embroidery options)
        embroideryOptions.style.display = 'none';
        patchOptions.style.display = 'block';
        // Disable AL if it was enabled (toggle is hidden with embroidery options)
        if (embState.globalAL.cap.enabled) {
            toggleGlobalALNew('cap'); // Turn it off
        }
        // For patches: no stitches needed, use setup fee instead of digitizing
        embState.capPrimaryLogo.stitchCount = 0;
        embState.capPrimaryLogo.needsDigitizing = false;
        embState.capPrimaryLogo.needsSetup = document.getElementById('cap-patch-setup')?.checked ?? true;
    } else {
        // Show embroidery options (for both flat and 3D puff) — AL toggle is inline
        embroideryOptions.style.display = 'block';
        patchOptions.style.display = 'none';
        // Restore stitch count from input
        embState.capPrimaryLogo.stitchCount = parseInt(document.getElementById('cap-primary-stitches')?.value) || 8000;
        embState.capPrimaryLogo.needsDigitizing = document.getElementById('cap-primary-digitizing')?.checked ?? false;
        embState.capPrimaryLogo.needsSetup = false; // Not applicable for embroidery
    }


    // Recalculate pricing with new embellishment type
    recalculatePricing();
}

// Get current cap embellishment type
export function getCapEmbellishmentType() {
    const dropdown = document.getElementById('cap-embellishment-type');
    return dropdown ? dropdown.value : 'embroidery';
}

// Update embellishment dropdown labels with prices from API
// Rule: ALWAYS pull pricing from Caspio API - never hardcode
export function updateEmbellishmentDropdownLabels() {
    if (!embState.pricingCalculator || !embState.pricingCalculator.capInitialized) return;

    const dropdown = document.getElementById('cap-embellishment-type');
    if (!dropdown) return;

    const upcharges = embState.pricingCalculator.getEmbellishmentUpcharges();

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
