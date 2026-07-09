/**
 * DTG quote builder — ESM entry point (decomposition COMPLETE 2026-07-09,
 * Batch 5; base boot F1 follow-up same day).
 *
 * Boots `QuoteBuilderBase(new DtgAdapter()).init()` like the trio — the
 * form-core init (render/wire + ?edit/?duplicate routing) rides the adapter,
 * so DTG shares the base lifecycle and its loud-pricing-failure banner.
 * form-core's module-level `window.DTGInlineForm` surface (14 methods,
 * consumed by dtg-catalog.js + dtg-quote-page.js) still lands at parse time.
 *
 * Also bridges the SHARED error surfaces (roadmap 1.15): the persistent
 * pricing-failure banner and the "estimated pricing in use" fallback badge —
 * quote-builder-utils.js calls these behind typeof guards. (DTG's own
 * row-level price-error banner in pricing.js predates this and stays — it is
 * already persistent + role=alert.)
 */

import { QuoteBuilderBase } from '../shared/quote-builder-base.js';
import { DtgAdapter } from './adapter.js';
import { showErrorBanner, hideErrorBanner, showFallbackPricingWarning } from '../shared/errors.js';

window.showErrorBanner = showErrorBanner;
window.hideErrorBanner = hideErrorBanner;
window.showFallbackPricingWarning = showFallbackPricingWarning;

new QuoteBuilderBase(new DtgAdapter()).init();

window.__QB_BUILD = window.__QB_BUILD || {};
window.__QB_BUILD.dtg = { entry: 'builders/dtg/index.js', stage: 'base-boot' };
