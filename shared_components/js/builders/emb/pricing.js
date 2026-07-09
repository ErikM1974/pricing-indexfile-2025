/**
 * EMB pricing module — Service_Codes fees.
 *
 * Batch 3.5 (2026-07-09): the implementation moved to
 * builders/shared/service-codes.js (it was duplicated here + as typeof-guarded
 * copies in quote-builder-utils.js for the other builders — now ONE copy for
 * all four). This file stays as the EMB-facing re-export because every EMB
 * sibling module imports from ./pricing.js; /api/pricing-bundle wrappers still
 * land here as the decomposition proceeds.
 */

export { loadServiceCodePrices, getServicePrice } from '../shared/service-codes.js';
