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
 * S1b next: pricing-sync, quote-lifecycle, save-output, push.
 * S2: ScpAdapter + QuoteBuilderBase boot + state module (shell → tombstone).
 */

import { updatePrintConfig, updateDarkGarmentNudge } from './print-config.js';
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

window.__QB_BUILD = window.__QB_BUILD || {};
window.__QB_BUILD.scp = { entry: 'builders/scp/index.js', stage: 'S1a' };
