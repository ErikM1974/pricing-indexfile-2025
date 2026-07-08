// embroidery-quote-builder.js — DECOMPOSED (roadmap 0.4 + 0.5, completed 2026-07-08).
//
// The 13,703-line monolith that lived here is gone:
//   - Behavior  → shared_components/js/builders/emb/*.js (11 ES modules),
//                 bundled + window-bridged by builders/emb/index.js.
//   - Page boot → builders/shared/quote-builder-base.js (QuoteBuilderBase)
//                 driving builders/emb/adapter.js (EmbAdapter).
//   - State     → builders/emb/state.js (embState + constants + the
//                 canonical quoteState store from builders/shared/quote-model.js).
//
// The EMB page no longer loads this file. Kept as a tombstone pointer for
// old links/docs; delete once nothing references the path.
// Map + history: memory/emb-decomposition-plan.md
