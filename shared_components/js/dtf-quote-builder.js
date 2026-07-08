// ============================================================
// DTF QUOTE BUILDER — decomposed (roadmap 0.4, 2026-07-08)
// ============================================================
//
// This monolith (4,082 lines at its peak) is GONE. Everything lives in
// ES modules under shared_components/js/builders/dtf/:
//
//   state.js               — dtfState (push flags; window-backed hasChanges
//                            for the shared classics) + sizeDetectionCache
//   adapter.js             — DtfAdapter: the page init (verbatim) in the
//                            QuoteBuilderBase lifecycle hooks
//   quote-builder-class.js — the WHOLE DTFQuoteBuilder class (childRows Map =
//                            single money source) + reprice-pill wrap   (D1)
//   output.js              — copy/print wrappers + auto-%% rush chip    (D1)
//   push.js                — one-click push to ShopWorks + preview      (D1)
//   index.js               — THE window re-export surface + base boot
//
// dtf-quote-page.js (rows/sizes/colors machinery) is a separate classic
// script and reaches the builder ONLY via window.dtfQuoteBuilder.
//
// The page loads ONLY the builders/dtf bundle (esbuild → dist hashed).
// This file is kept as a tombstone so stale references 404 loudly in code
// review instead of resolving to a zombie copy. Do not add code here.
