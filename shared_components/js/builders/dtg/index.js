/**
 * DTG quote builder — ESM entry point (bridge shell, 2026-07-08).
 *
 * DTG keeps its deliberate inline-form/catalog architecture
 * (dtg-inline-form.js + dtg-catalog.js — NOT decomposed yet); this bundle
 * exists so DTG gets the SHARED error surfaces the other three builders
 * carry (roadmap 1.15): the persistent pricing-failure banner and the
 * "estimated pricing in use" fallback badge. quote-builder-utils.js calls
 * these behind typeof guards — with this bundle loaded they light up on
 * DTG too. (DTG's own row-level price-error banner in dtg-inline-form.js
 * predates this and stays — it is already persistent + role=alert.)
 *
 * If/when DTG decomposes (the proven EMB/SCP/DTF playbook, queued as the
 * "rainy-week" item), this file becomes its real composition root.
 */

import { showErrorBanner, hideErrorBanner, showFallbackPricingWarning } from '../shared/errors.js';

window.showErrorBanner = showErrorBanner;
window.hideErrorBanner = hideErrorBanner;
window.showFallbackPricingWarning = showFallbackPricingWarning;

window.__QB_BUILD = window.__QB_BUILD || {};
window.__QB_BUILD.dtg = { entry: 'builders/dtg/index.js', stage: 'bridge-shell' };
