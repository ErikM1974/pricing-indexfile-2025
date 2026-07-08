/**
 * DTF quote builder — ESM entry point (Phase 0 strangler shell).
 *
 * Task 0.4 (after the EMB pilot) extracts dtf-quote-builder.js (4,086 lines)
 * into modules here, mirroring builders/emb/. Functions are re-exported onto
 * window until every caller migrates.
 *
 * Built by scripts/build.js into an IIFE bundle (dist/); keep import-free
 * until the first real module lands, so the raw path works without a build.
 */
(function () {
    'use strict';
    window.__QB_BUILD = window.__QB_BUILD || {};
    window.__QB_BUILD.dtf = { entry: 'builders/dtf/index.js' };
})();
