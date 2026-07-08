/**
 * Screen print quote builder — ESM entry point (roadmap 0.4, SCP decomposition).
 *
 * Strangler seam for screenprint-quote-builder.js (was 5,406 lines): clusters
 * move verbatim into modules here and are re-exported onto window so the
 * remaining monolith code, HTML onclick handlers, and shared classic scripts
 * keep working unchanged. This file is the ONE sanctioned window re-export
 * surface (eslint no-restricted-syntax allows window.* only here).
 *
 * Load order: this bundle's script tag sits at body-end AFTER the monolith,
 * but classic scripts execute at parse time — strictly before DOMContentLoaded
 * — so every bridge below exists before the monolith's init listener or any
 * user interaction can call it.
 *
 * S1a (2026-07-08): print-config, persistence, product-rows.
 * S1b (2026-07-08): pricing-sync (recalculatePricing = live export let,
 * reprice-pill wrapped), quote-lifecycle, save-output, push.
 * S2 (2026-07-08): state.js (scpState + constants; window-backed
 * childRowMap/hasChanges) + ScpAdapter carrying the page init verbatim +
 * QuoteBuilderBase boot. The monolith is a tombstone; this bundle IS the
 * SCP builder.
 */

import { QuoteBuilderBase } from '../shared/quote-builder-base.js';
import { ScpAdapter } from './adapter.js';
import { scpState, quoteState } from './state.js';
import { updatePrintConfig, updateDarkGarmentNudge } from './print-config.js';
import {
    recalculatePricing,
    recalculateAllPrices,
    collectProductsFromTable,
    updateTaxCalculation,
    toggleWholesale,
} from './pricing-sync.js';
import {
    updateAdditionalCharges,
    updateDiscountType,
    getScpExtraFees,
    updateFeeTableRows,
    applyRushPercent,
} from './quote-lifecycle.js';
import { printQuote, saveAndGetLink, spcEmailQuote, copyToClipboard } from './save-output.js';
import {
    showScpPushButton,
    updateScpPushButtonState,
    scpPushToShopWorks,
    confirmScpPush,
    closeScpPushPreview,
    openScpPushPreview,
    renderScpPushPreview,
} from './push.js';
import {
    initScreenPrintPersistence,
    restoreScreenPrintDraft,
    markScreenPrintDirty,
    addProductFromQuote,
    applyMethodSwitchPrefillScp,
    applyQuickQuotePrefillScp,
    loadQuoteForEditing,
    duplicateQuote,
    resetQuote,
} from './persistence.js';
import {
    setupSearchAutocomplete,
    selectProduct,
    addNewRow,
    onStyleChange,
    duplicateRowNewColor,
    toggleColorPicker,
    selectColor,
    handleColorPickerKeydown,
    selectChildColor,
    onSizeChange,
    createChildRow,
    onChildSizeChange,
    clearExtendedSize,
    deleteRow,
    handleCellKeydown,
} from './product-rows.js';

// ---- print-config ----
window.updatePrintConfig = updatePrintConfig;
window.updateDarkGarmentNudge = updateDarkGarmentNudge;

// ---- persistence / lifecycle ----
window.initScreenPrintPersistence = initScreenPrintPersistence;
window.restoreScreenPrintDraft = restoreScreenPrintDraft;
window.markScreenPrintDirty = markScreenPrintDirty;
window.addProductFromQuote = addProductFromQuote;
window.applyMethodSwitchPrefillScp = applyMethodSwitchPrefillScp;
window.applyQuickQuotePrefillScp = applyQuickQuotePrefillScp;
window.loadQuoteForEditing = loadQuoteForEditing;
window.duplicateQuote = duplicateQuote;
window.resetQuote = resetQuote;

// ---- product rows / search / sizes / colors ----
window.setupSearchAutocomplete = setupSearchAutocomplete;
window.selectProduct = selectProduct;
window.addNewRow = addNewRow;
window.onStyleChange = onStyleChange;
window.duplicateRowNewColor = duplicateRowNewColor;
window.toggleColorPicker = toggleColorPicker;
window.selectColor = selectColor;
window.handleColorPickerKeydown = handleColorPickerKeydown;
window.selectChildColor = selectChildColor;
window.onSizeChange = onSizeChange;
window.createChildRow = createChildRow;
window.onChildSizeChange = onChildSizeChange;
window.clearExtendedSize = clearExtendedSize;
window.deleteRow = deleteRow;
window.handleCellKeydown = handleCellKeydown;

// ---- pricing sync (S1b) ----
// recalculatePricing is pricing-sync's live `export let` — its module tail
// applies the reprice-pill wrap BEFORE this import evaluates, so the bridge
// (and every bare-global caller) gets the wrapped version.
window.recalculatePricing = recalculatePricing;
window.recalculateAllPrices = recalculateAllPrices;
window.collectProductsFromTable = collectProductsFromTable;
window.updateTaxCalculation = updateTaxCalculation;
window.toggleWholesale = toggleWholesale;

// ---- quote lifecycle (S1b; applyRushPercent joined in S2) ----
window.updateAdditionalCharges = updateAdditionalCharges;
window.updateDiscountType = updateDiscountType;
window.getScpExtraFees = getScpExtraFees;
window.updateFeeTableRows = updateFeeTableRows;
window.applyRushPercent = applyRushPercent;

// ---- save / print / email output (S1b) ----
window.printQuote = printQuote;
window.saveAndGetLink = saveAndGetLink;
window.spcEmailQuote = spcEmailQuote;
window.copyToClipboard = copyToClipboard;

// ---- push to ShopWorks (S1b) ----
window.showScpPushButton = showScpPushButton;
window.updateScpPushButtonState = updateScpPushButtonState;
window.scpPushToShopWorks = scpPushToShopWorks;
window.confirmScpPush = confirmScpPush;
window.closeScpPushPreview = closeScpPushPreview;
window.openScpPushPreview = openScpPushPreview;
window.renderScpPushPreview = renderScpPushPreview;

// ---- state handles (debug + test hooks; NOT an API for page code) ----
window.__scpState = scpState;
window.__scpQuoteState = quoteState;

// ---- boot: the ONE base drives the page lifecycle (roadmap 0.4) ----
new QuoteBuilderBase(new ScpAdapter()).init();

window.__QB_BUILD = window.__QB_BUILD || {};
window.__QB_BUILD.scp = { entry: 'builders/scp/index.js', stage: 'S2-complete' };
