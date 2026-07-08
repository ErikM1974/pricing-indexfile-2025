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
 * D2: DtfAdapter + QuoteBuilderBase boot + state (shell → tombstone).
 */

import { DTFQuoteBuilder } from './quote-builder-class.js';
import { copyToClipboard, copyQuoteToClipboard, printQuote, applyRushPercent } from './output.js';
import {
    showDtfPushButton,
    updateDtfPushButtonState,
    dtfPushToShopWorks,
    confirmDtfPush,
    closeDtfPushPreview,
    openDtfPushPreview,
    renderDtfPushPreview,
} from './push.js';

// ---- the builder class (the shell's init listener instantiates it) ----
window.DTFQuoteBuilder = DTFQuoteBuilder;

// ---- output / HTML-onclick wrappers ----
window.copyToClipboard = copyToClipboard;
window.copyQuoteToClipboard = copyQuoteToClipboard;
window.printQuote = printQuote;
window.applyRushPercent = applyRushPercent;

// ---- push to ShopWorks ----
window.showDtfPushButton = showDtfPushButton;
window.updateDtfPushButtonState = updateDtfPushButtonState;
window.dtfPushToShopWorks = dtfPushToShopWorks;
window.confirmDtfPush = confirmDtfPush;
window.closeDtfPushPreview = closeDtfPushPreview;
window.openDtfPushPreview = openDtfPushPreview;
window.renderDtfPushPreview = renderDtfPushPreview;

window.__QB_BUILD = window.__QB_BUILD || {};
window.__QB_BUILD.dtf = { entry: 'builders/dtf/index.js', stage: 'D1' };
