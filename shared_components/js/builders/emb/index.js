/**
 * Embroidery quote builder — ESM entry point (Phase 0 strangler shell).
 *
 * Task 0.4 extracts embroidery-quote-builder.js (13,712 lines) into modules
 * here: state.js, pricing.js, render.js, persistence.js, events.js. Each
 * extracted function is re-exported onto window from this entry until every
 * caller is migrated, then the window copy is dropped.
 *
 * Built by scripts/build.js into an IIFE bundle (dist/); the page loads the
 * hashed bundle via the asset manifest. Keep this file import-free until the
 * first real module lands, so the raw path also works without a build.
 */
(function () {
    'use strict';
    window.__QB_BUILD = window.__QB_BUILD || {};
    window.__QB_BUILD.emb = { entry: 'builders/emb/index.js' };
})();
