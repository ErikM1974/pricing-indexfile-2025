// ============================================================
// SCREEN PRINT QUOTE BUILDER — decomposed (roadmap 0.4, 2026-07-08)
// ============================================================
//
// This monolith (5,406 lines at its peak) is GONE. Everything lives in
// ES modules under shared_components/js/builders/scp/:
//
//   state.js          — constants + scpState (all mutable state; window-backed
//                       childRowMap/hasChanges for the shared classic scripts)
//   adapter.js        — ScpAdapter: the page init (verbatim) in the
//                       QuoteBuilderBase lifecycle hooks + method contract
//   print-config.js   — updatePrintConfig + dark-garment nudge        (S1a)
//   persistence.js    — drafts, edit/duplicate load, prefills, reset  (S1a)
//   product-rows.js   — search, rows, sizes, colors, keyboard nav     (S1a)
//   pricing-sync.js   — tiers, recalculatePricing (live export let),
//                       display/tax/wholesale                          (S1b)
//   quote-lifecycle.js— charges, discounts, fee table, rush chip      (S1b)
//   save-output.js    — save/print/email/quote-text                   (S1b)
//   push.js           — one-click push to ShopWorks + preview         (S1b)
//   index.js          — THE window re-export surface + base boot
//
// The page loads ONLY the builders/scp bundle (esbuild → dist hashed).
// This file is kept as a tombstone so stale references 404 loudly in code
// review instead of resolving to a zombie copy. Do not add code here.
