// Order submission stage. Behavior covered by order-form-submit-contract.test.js.
function buildGarmentLines({ rows, breakdown, decoConfig, printLocations }) {
    // --- Build lineItems (one row × qty-bearing size = one line item) ---
    // Iterate every size key on the row (standard XS-4XL plus any non-standard
    // entries: OSFA, YS-YXL, LT-4XLT, 5XL-7XL). We send the BASE part number
    // + plain size string; ShopWorks's Size Translation Table on ingest both
    // (a) maps the size to the correct Size01-06 column AND (b) appends the
    // configured per-size modifier (`_XS`, `_2X`, `_3XL`, …) to the PN.
    // Pre-suffixing here would double-stamp it (PC61Y_XS_XS).
    const lineItems = [];
    const skippedLines = []; // sizes with qty>0 the engine couldn't price — returned to caller
    // B1 ($0 line guard, Erik 2026-05-22): manual-mode rows with rep-typed
    // $0 used to push through to MO at price=0, landing in ShopWorks as a
    // $0 line + $0 subtotal (e.g. WO 141918 / OF-0050). Block at submit
    // time instead. Fee/service add-ons are built in a separate loop below
    // and can legitimately be $0 (e.g. included service) — those are
    // unaffected.
    const zeroPriceLines = [];
    rows.forEach((r) => {
        if (!r || (!r.style && !r.desc && !r.sizes)) return;
        const partBase = (r.style || 'MISC').trim();
        const desc = r.desc || r.style || 'Custom Apparel';
        const color = r.colorName || r.color || ''; // display name — proxy stores as PartColor
        const catalogColor = r.catalogColor || r.color || ''; // CATALOG_COLOR for inventory mapping
        const fallbackPrice = Number(r.price || 0) || 0;
        // Per-row pricing breakdown carries auto-computed unit prices per size.
        // When the rep clicked the price cell to override (priceOverride=true),
        // we honor the manually-typed `r.price` instead. Otherwise prefer the
        // computed unit price for this specific size.
        const rowBreakdown = breakdown?.byRow?.[r.id];
        const isAutoPriced =
            !r.priceOverride && rowBreakdown && !rowBreakdown.error && breakdown?.supported;
        const sizes = r.sizes || {};
        Object.keys(sizes).forEach((sz) => {
            const qty = parseInt(sizes[sz] || 0, 10);
            if (!qty) return;
            let price = fallbackPrice;
            let priceFromBreakdown = false;
            if (isAutoPriced) {
                const computedUnit = rowBreakdown?.unitPriceBySize?.[sz];
                if (Number.isFinite(Number(computedUnit)) && Number(computedUnit) > 0) {
                    price = Number(computedUnit);
                    priceFromBreakdown = true;
                }
            }
            // Skip auto-priced lines where the engine has no price for this size
            // (e.g. rep typed XS=2 for PC61, which doesn't carry XS). This stops
            // ShopWorks getting a $0 ghost line. The form's grayed cell + tooltip
            // already warned the rep; the rep can force the line by clicking the
            // price cell to switch to manual override. Manual-price rows pass
            // through at whatever the rep typed (even $0).
            if (isAutoPriced && !priceFromBreakdown) {
                skippedLines.push({
                    style: partBase,
                    color: color,
                    size: sz,
                    quantity: qty,
                    reason: 'No price available for this size in the pricing engine',
                });
                console.warn(
                    '[Order Form Submit] Skipping unpriced line:',
                    partBase,
                    sz,
                    'qty=' + qty
                );
                return;
            }
            // B1: hard-block garment lines that ended up at $0 after price
            // resolution (manual override with empty/0 price, or unsupported
            // pricing method with no fallback). Pushing $0 produces invisible
            // garbage in ShopWorks — rep should fix the row, not paper over it.
            if (!(price > 0)) {
                zeroPriceLines.push({
                    style: partBase,
                    color: color,
                    size: sz,
                    quantity: qty,
                });
                return;
            }
            // Send the BASE part number + plain size. ShopWorks's Size Translation
            // Table appends the per-size modifier (`_XS`, `_2X`, `_3XL`, etc.) on
            // ingest. Pre-suffixing here would double-stamp it (PC61Y_XS_XS).
            // The frontend breakdown row + inventory wrapper still use
            // orderFormSizeSuffix() — display + SanMar inventory needs the
            // suffixed PN. Only this MO push uses the base PN.
            lineItems.push({
                partNumber: partBase,
                description: desc,
                color: color,
                catalogColor: catalogColor,
                size: sz,
                quantity: qty,
                price: price,
                // WorkOrderNotes = print location(s) for this line (Erik 2026-05-20).
                // Surfaces in ShopWorks's line-level work-order printout so the
                // production-floor operator sees the print location next to the
                // garment SKU/size/qty without flipping to Notes To Production.
                // Frontend sends printLocations as the human-readable label
                // ("Left Chest", "Full Back", "Left Chest + Full Back"). Empty
                // string when not set — proxy strips empty workOrderNotes so no
                // blank field lands in ShopWorks.
                workOrderNotes: printLocations || '',
                // Internal — used below to link this line to the matching design's
                // ExtDesignID after the designs[] array is built. Removed before
                // the payload is sent to the proxy.
                _method: r.deco || decoConfig?.method || '',
            });
        });
    });
    return { lineItems, skippedLines, zeroPriceLines };
}
module.exports = { buildGarmentLines };
