/**
 * DTF builder state — DTF decomposition D2 (2026-07-08), mirroring
 * builders/{emb,scp}/state.js (roadmap 0.5).
 *
 * DTF's real state lives on the DTFQuoteBuilder INSTANCE (`this.*` — products,
 * childRows Map, pricing data, edit mode), so this module is small: the few
 * cross-module/lexical globals the monolith shell carried, plus the shared
 * canonical line-item store.
 *
 * The instance itself is window.dtfQuoteBuilder (set by DtfAdapter exactly
 * like the old DOMContentLoaded listener did) — dtf-quote-page.js (classic,
 * 27 bare references) and HTML onclick reach it through the global object.
 */
import { QuoteState } from '../shared/quote-model.js';

// Style+color → extended-sizes cache shared by the class's size-detection
// paths (verbatim from the shell; module-scoped now — no outside readers).
export const sizeDetectionCache = new Map(); // key: "style-color" → extended sizes array

export const dtfState = {
    childRowMap: {},   // { parentRowId: { '2XL': childRowId, ... } } — class + rows module share it (Batch 4.3)
    // push
    _dtfPushQuoteId: null,
    _dtfPushInFlight: false,
};

// ── Window-backed contract field ────────────────────────────────────────────
// quote-builder-utils.js (shared classic) reads/writes `hasChanges` BARE in
// markAsUnsaved/markAsSaved/hasUnsavedChanges — with the shell's lexical
// declaration gone, the ONE shared slot lives on window (same mechanism as
// builders/emb/state.js and builders/scp/state.js).
/* eslint-disable no-restricted-syntax -- window-backed contract field: the
   shared classic consumers (see block comment above) share ONE slot with modules */
if (typeof window.hasChanges === 'undefined') window.hasChanges = false;

Object.defineProperties(dtfState, {
    hasChanges: {
        get() { return window.hasChanges; },
        set(v) { window.hasChanges = v; },
    },
});

// ── Canonical line-item store (roadmap 0.5) ─────────────────────────────────
export const quoteState = new QuoteState();

// API base for the migrated page modules (matches emb/scp state.js).
export const API_BASE = window.APP_CONFIG?.API?.BASE_URL || (console.error('[DTF] APP_CONFIG missing — API calls will fail'), '');

// window-backed contract: the class reads/reset-assigns window.childRowMap
// (quote-builder-class.js) — route both through dtfState (Batch 4.3).
Object.defineProperty(window, 'childRowMap', {
    get() { return dtfState.childRowMap; },
    set(v) { dtfState.childRowMap = v; },
    configurable: true,
});
