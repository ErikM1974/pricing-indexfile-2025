/**
 * DTF quote builder — ESM entry point (roadmap 0.4, DTF decomposition).
 *
 * Strangler seam for dtf-quote-builder.js (was 4,082 lines): the builder is
 * ONE class (DTFQuoteBuilder — state already `this.`-scoped) plus a small
 * tail, so the decomposition is class module + output + push. This file is
 * the ONE sanctioned window re-export surface (eslint-enforced); it executes
 * at bundle parse time — strictly before DOMContentLoaded — so the shell's
 * init listener and HTML onclick handlers always find the bridges.
 *
 * D1 (2026-07-08): quote-builder-class (incl. the reprice-pill prototype
 * wrap at its tail), output (+ applyRushPercent), push.
 * D2 (2026-07-08): state.js (dtfState + window-backed hasChanges) +
 * DtfAdapter (the init listener verbatim) + QuoteBuilderBase boot. The
 * monolith is a tombstone; this bundle IS the DTF builder.
 */

import { QuoteBuilderBase } from '../shared/quote-builder-base.js';
import { DtfAdapter } from './adapter.js';
import { dtfState, quoteState } from './state.js';
import { DTFQuoteBuilder } from './quote-builder-class.js';
import { copyToClipboard, printQuote, applyRushPercent } from './output.js';
import {
    showDtfPushButton,
    updateDtfPushButtonState,
    dtfPushToShopWorks,
    confirmDtfPush,
    closeDtfPushPreview,
} from './push.js';
import { showErrorBanner, hideErrorBanner, showFallbackPricingWarning } from '../shared/errors.js';
import { loadServiceCodePrices, getServicePrice } from '../shared/service-codes.js';
import { openExtendedSizePopup, closeExtendedSizePopup, applyExtendedSizes, focusProductSearch, updateTaxCalculation, updateAdditionalCharges, lookupTaxRate, onShipStateChange, toggleWholesale, onShipZipBlur, dtfEmailQuote, toggleOrderDetails, updateFeeTableRows, confirmNewQuote, showSaveModal, closeSaveModal, copyShareableUrl } from './page-ui.js';
import { addNewRow, onStyleChange, duplicateRowNewColor, handleCellKeydown, onSizeChange, selectColor, toggleColorPicker, handleColorPickerKeydown, deleteRow, createChildRow, removeChildRow, onChildSizeChange, updateExtendedSizeDisplay, getExtendedSizeQty, selectChildColor } from './product-rows.js';

// ---- the builder class (the shell's init listener instantiates it) ----
window.DTFQuoteBuilder = DTFQuoteBuilder;

// ---- output / HTML-onclick wrappers ----
window.copyToClipboard = copyToClipboard;
window.printQuote = printQuote;
window.applyRushPercent = applyRushPercent;

// ---- push to ShopWorks ----
window.showDtfPushButton = showDtfPushButton;
window.updateDtfPushButtonState = updateDtfPushButtonState;
window.dtfPushToShopWorks = dtfPushToShopWorks;
window.confirmDtfPush = confirmDtfPush;
window.closeDtfPushPreview = closeDtfPushPreview;

// ---- state handles (debug + test hooks; NOT an API for page code) ----
window.__dtfState = dtfState;
window.__dtfQuoteState = quoteState;

// ---- boot: the ONE base drives the page lifecycle (roadmap 0.4) ----
new QuoteBuilderBase(new DtfAdapter()).init();

// ---- shared error surfaces (roadmap 1.15) — classic scripts (quote-builder-
// utils.js) reach these behind typeof guards; pages without a bundle keep toasts ----
window.showErrorBanner = showErrorBanner;
window.hideErrorBanner = hideErrorBanner;
window.showFallbackPricingWarning = showFallbackPricingWarning;
// Service_Codes (ONE shared impl — Batch 3.5); classic callers: dtf-quote-page GRT-75
window.loadServiceCodePrices = loadServiceCodePrices;
window.getServicePrice = getServicePrice;
// Migrated dtf-quote-page.js surface (Batch 4.3): HTML onclick + generated-markup
// + class bare-global consumers — verified set (same classifier as the 3.3 diet).
window.openExtendedSizePopup = openExtendedSizePopup;
window.closeExtendedSizePopup = closeExtendedSizePopup;
window.applyExtendedSizes = applyExtendedSizes;
window.focusProductSearch = focusProductSearch;
window.updateTaxCalculation = updateTaxCalculation;
window.updateAdditionalCharges = updateAdditionalCharges;
window.lookupTaxRate = lookupTaxRate;
window.onShipStateChange = onShipStateChange;
window.toggleWholesale = toggleWholesale;
window.onShipZipBlur = onShipZipBlur;
window.dtfEmailQuote = dtfEmailQuote;
window.toggleOrderDetails = toggleOrderDetails;
window.updateFeeTableRows = updateFeeTableRows;
window.confirmNewQuote = confirmNewQuote;
window.showSaveModal = showSaveModal;
window.closeSaveModal = closeSaveModal;
window.copyShareableUrl = copyShareableUrl;
window.addNewRow = addNewRow;
window.onStyleChange = onStyleChange;
window.duplicateRowNewColor = duplicateRowNewColor;
window.handleCellKeydown = handleCellKeydown;
window.onSizeChange = onSizeChange;
window.selectColor = selectColor;
window.toggleColorPicker = toggleColorPicker;
window.handleColorPickerKeydown = handleColorPickerKeydown;
window.deleteRow = deleteRow;
window.createChildRow = createChildRow;
window.removeChildRow = removeChildRow;
window.onChildSizeChange = onChildSizeChange;
window.updateExtendedSizeDisplay = updateExtendedSizeDisplay;
window.getExtendedSizeQty = getExtendedSizeQty;
window.selectChildColor = selectChildColor;


window.__QB_BUILD = window.__QB_BUILD || {};
window.__QB_BUILD.dtf = { entry: 'builders/dtf/index.js', stage: 'D2-complete' };
