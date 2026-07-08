/**
 * SCP print-config module — SCP decomposition S1a (2026-07-08).
 * Print locations + ink colors + dark-garment/safety-stripes config
 * (updatePrintConfig) and the dark-garment nudge banner. Moved verbatim
 * from screenprint-quote-builder.js.
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions; typing lands with the render/state split).
/* global markScreenPrintDirty, recalculateAllPrices, getServicePrice */
import { scpState, SCREEN_FEE, SCP_DARK_COLOR_WORDS } from './state.js';

// Update print configuration from UI selections
export function updatePrintConfig() {
    // Get location selections
    const frontRadio = document.querySelector('input[name="front-location"]:checked');
    const backRadio = document.querySelector('input[name="back-location"]:checked');
    const frontColorsRadio = document.querySelector('input[name="front-colors"]:checked');
    const backColorsRadio = document.querySelector('input[name="back-colors"]:checked');

    scpState.printConfig.frontLocation = frontRadio ? frontRadio.value : 'LC';
    scpState.printConfig.backLocation = backRadio ? backRadio.value : '';
    scpState.printConfig.frontColors = frontColorsRadio ? parseInt(frontColorsRadio.value) : 1;
    scpState.printConfig.backColors = backColorsRadio ? parseInt(backColorsRadio.value) : 1;
    scpState.printConfig.isDarkGarment = document.getElementById('dark-garment-toggle').checked;
    scpState.printConfig.isSafetyStripes = document.getElementById('safety-stripes-toggle').checked;

    // Sleeves — each checked sleeve is its OWN additional print location at its own ink-color count
    const leftSleeveOn = document.getElementById('left-sleeve-toggle')?.checked;
    const rightSleeveOn = document.getElementById('right-sleeve-toggle')?.checked;
    const leftSleeveColorsRadio = document.querySelector('input[name="left-sleeve-colors"]:checked');
    const rightSleeveColorsRadio = document.querySelector('input[name="right-sleeve-colors"]:checked');
    scpState.printConfig.leftSleeveColors = leftSleeveOn ? (leftSleeveColorsRadio ? parseInt(leftSleeveColorsRadio.value) : 1) : 0;
    scpState.printConfig.rightSleeveColors = rightSleeveOn ? (rightSleeveColorsRadio ? parseInt(rightSleeveColorsRadio.value) : 1) : 0;
    // engine-canonical list: one entry per checked sleeve (left, right). Pricing is order-independent.
    scpState.printConfig.sleeveColorsList = [];
    if (scpState.printConfig.leftSleeveColors > 0) scpState.printConfig.sleeveColorsList.push(scpState.printConfig.leftSleeveColors);
    if (scpState.printConfig.rightSleeveColors > 0) scpState.printConfig.sleeveColorsList.push(scpState.printConfig.rightSleeveColors);

    // Show/hide back colors section
    const backColorsSection = document.getElementById('back-colors-section');
    const backIcon = document.getElementById('back-icon');
    if (scpState.printConfig.backLocation) {
        backColorsSection.style.display = 'block';
        backIcon.className = 'fas fa-check-circle';
        backIcon.style.color = '#28a745';
    } else {
        backColorsSection.style.display = 'none';
        backIcon.className = 'fas fa-plus-circle';
        backIcon.style.color = '#888';
    }

    // Show/hide each sleeve's ink-color section; tint the sleeve card icon when any sleeve is on
    const leftSleeveSection = document.getElementById('left-sleeve-colors-section');
    const rightSleeveSection = document.getElementById('right-sleeve-colors-section');
    if (leftSleeveSection) leftSleeveSection.style.display = leftSleeveOn ? 'block' : 'none';
    if (rightSleeveSection) rightSleeveSection.style.display = rightSleeveOn ? 'block' : 'none';
    const sleeveIcon = document.getElementById('sleeve-icon');
    if (sleeveIcon) {
        const anySleeve = scpState.printConfig.sleeveColorsList.length > 0;
        sleeveIcon.className = anySleeve ? 'fas fa-check-circle' : 'fas fa-plus-circle';
        sleeveIcon.style.color = anySleeve ? '#28a745' : '#888';
    }

    // Calculate screens — front + back + EACH sleeve's colors; dark garments add +1 white-underbase
    // screen PER printed location (front, back, and each sleeve). Mirrors engine quote-cart-engine.js.
    let frontScreens = scpState.printConfig.frontColors;
    let backScreens = scpState.printConfig.backLocation ? scpState.printConfig.backColors : 0;
    let leftSleeveScreens = scpState.printConfig.leftSleeveColors > 0 ? scpState.printConfig.leftSleeveColors : 0;
    let rightSleeveScreens = scpState.printConfig.rightSleeveColors > 0 ? scpState.printConfig.rightSleeveColors : 0;

    // Add underbase for dark garments — one extra screen per printed location (incl. each sleeve)
    if (scpState.printConfig.isDarkGarment) {
        frontScreens += 1;
        if (scpState.printConfig.backLocation) {
            backScreens += 1;
        }
        if (scpState.printConfig.leftSleeveColors > 0) leftSleeveScreens += 1;
        if (scpState.printConfig.rightSleeveColors > 0) rightSleeveScreens += 1;
    }

    scpState.printConfig.totalScreens = frontScreens + backScreens + leftSleeveScreens + rightSleeveScreens;
    // Per-screen setup fee from Caspio Service_Codes 'SPSU' (fallback SCREEN_FEE). (Pricing=API)
    // Use the SAME perScreen value in the breakdown strings so a Caspio SPSU change can't make
    // the displayed "× $X" math disagree with the charged total. (2026-06-20 audit SCP-4)
    const perScreen = (typeof getServicePrice === 'function' ? getServicePrice('SPSU', SCREEN_FEE) : SCREEN_FEE);
    scpState.printConfig.setupFee = scpState.printConfig.totalScreens * perScreen;
    const _ps = perScreen.toFixed(2);

    // Update front setup display
    const frontSetupEl = document.getElementById('front-setup-display');
    if (scpState.printConfig.isDarkGarment) {
        frontSetupEl.textContent = `${scpState.printConfig.frontColors} + 1 underbase = ${frontScreens} screens × $${_ps} = $${(frontScreens * perScreen).toFixed(2)}`;
    } else {
        frontSetupEl.textContent = `${frontScreens} screen${frontScreens > 1 ? 's' : ''} × $${_ps} = $${(frontScreens * perScreen).toFixed(2)}`;
    }

    // Update back setup display (if visible)
    if (scpState.printConfig.backLocation) {
        const backSetupEl = document.getElementById('back-setup-display');
        if (scpState.printConfig.isDarkGarment) {
            backSetupEl.textContent = `${scpState.printConfig.backColors} + 1 underbase = ${backScreens} screens × $${_ps} = $${(backScreens * perScreen).toFixed(2)}`;
        } else {
            backSetupEl.textContent = `${backScreens} screen${backScreens > 1 ? 's' : ''} × $${_ps} = $${(backScreens * perScreen).toFixed(2)}`;
        }
    }

    // Update sleeve setup displays (if a sleeve is on)
    if (scpState.printConfig.leftSleeveColors > 0) {
        const lsEl = document.getElementById('left-sleeve-setup-display');
        if (lsEl) lsEl.textContent = scpState.printConfig.isDarkGarment
            ? `${scpState.printConfig.leftSleeveColors} + 1 underbase = ${leftSleeveScreens} screens × $${_ps} = $${(leftSleeveScreens * perScreen).toFixed(2)}`
            : `${leftSleeveScreens} screen${leftSleeveScreens > 1 ? 's' : ''} × $${_ps} = $${(leftSleeveScreens * perScreen).toFixed(2)}`;
    }
    if (scpState.printConfig.rightSleeveColors > 0) {
        const rsEl = document.getElementById('right-sleeve-setup-display');
        if (rsEl) rsEl.textContent = scpState.printConfig.isDarkGarment
            ? `${scpState.printConfig.rightSleeveColors} + 1 underbase = ${rightSleeveScreens} screens × $${_ps} = $${(rightSleeveScreens * perScreen).toFixed(2)}`
            : `${rightSleeveScreens} screen${rightSleeveScreens > 1 ? 's' : ''} × $${_ps} = $${(rightSleeveScreens * perScreen).toFixed(2)}`;
    }

    // Update total setup fee display
    document.getElementById('total-screens-display').textContent = `${scpState.printConfig.totalScreens} screen${scpState.printConfig.totalScreens > 1 ? 's' : ''} total`;
    document.getElementById('setup-fee-display').textContent = `$${scpState.printConfig.setupFee.toFixed(2)}`;

    // Show/hide dark garment note
    const darkNote = document.getElementById('dark-garment-note');
    if (scpState.printConfig.isDarkGarment) {
        darkNote.style.display = 'block';
    } else {
        darkNote.style.display = 'none';
    }

    // Recalculate all product prices with new configuration
    recalculateAllPrices();
}

export function updateDarkGarmentNudge(productList) {
    const toggle = document.getElementById('dark-garment-toggle');
    if (!toggle) return;
    const host = toggle.closest('label');
    if (!host || !host.parentElement) return;
    let chip = document.getElementById('dark-garment-nudge');

    const hasDarkRows = (productList || []).some(p => {
        const c = String(p.color || p.catalogColor || '').toLowerCase();
        return SCP_DARK_COLOR_WORDS.some(w => c.includes(w));
    });

    if (toggle.checked || scpState._darkNudgeDismissed || !hasDarkRows) {
        if (chip) chip.remove();
        return;
    }
    if (chip) return; // already showing

    chip = document.createElement('span');
    chip.id = 'dark-garment-nudge';
    chip.className = 'dark-garment-nudge';
    chip.innerHTML = '<i class="fas fa-exclamation-triangle"></i>' +
        ' Dark garments in this quote — add white underbase screens?' +
        ' <button type="button" class="dark-garment-nudge-apply">Enable</button>' +
        ' <button type="button" class="dark-garment-nudge-dismiss" aria-label="Dismiss underbase reminder" title="Dismiss">&times;</button>';
    chip.querySelector('.dark-garment-nudge-apply').addEventListener('click', () => {
        toggle.checked = true;
        chip.remove();
        updatePrintConfig();   // re-derives screens + setup fee, ends in recalculateAllPrices()
        if (typeof markScreenPrintDirty === 'function') markScreenPrintDirty();
    });
    chip.querySelector('.dark-garment-nudge-dismiss').addEventListener('click', () => {
        scpState._darkNudgeDismissed = true;   // per-quote: resetQuote() re-arms it
        chip.remove();
    });
    host.insertAdjacentElement('afterend', chip);
}
