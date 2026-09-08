// Order submission stage. Behavior covered by order-form-submit-contract.test.js.
async function appendServiceLines({ addOns, breakdown, lineItems }, { fetch, CASPIO_PROXY_BASE }) {
    // --- Add-on fees (Phase 2a 2026-05-03) ---
    // Server-side companion to window.OrderFormServiceCodes (frontend client).
    // Resolves SellPrice from the in-memory Service_Codes cache and appends
    // a LinesOE entry per add-on. Phase 2a supports FIXED + FLAT only;
    // TIERED / CALCULATED / PASSTHROUGH / HOURLY methods are skipped with a
    // console warn so the rep sees them missing on the next submit (UI in
    // Phase 2b adds proper handling). Service codes that aren't in the
    // KNOWN_FEE_PNS proxy whitelist may still flow but ShopWorks may reject
    // them — server-side validation against KNOWN_FEE_PNS lives at the
    // proxy layer (caspio-pricing-proxy v608+).
    if (Array.isArray(addOns) && addOns.length > 0) {
        const serviceCodesUrl = `${CASPIO_PROXY_BASE}/api/service-codes`;
        let serviceCodes = [];
        try {
            const r = await fetch(serviceCodesUrl);
            if (r.ok) {
                const j = await r.json();
                serviceCodes = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
            }
        } catch (err) {
            console.error('[Order Form Submit] Service_Codes fetch failed:', err.message);
        }
        const findCode = (code) => serviceCodes.find((s) => s.ServiceCode === code) || null;
        const orderSubtotal = Number(breakdown?.subtotal) || 0;

        for (const a of addOns) {
            if (!a || !a.code) continue;
            const sc = findCode(a.code);
            if (!sc) {
                console.warn(
                    '[Order Form Submit] Skipping add-on — code not in Service_Codes:',
                    a.code
                );
                continue;
            }
            const method = String(sc.PricingMethod || '').toUpperCase();
            const baseSell = Number(sc.SellPrice) || 0;
            const qty = Number(a.qty) || 0;
            if (qty <= 0) continue;

            let unitPrice = null;
            switch (method) {
                case 'FIXED':
                case 'FLAT':
                    unitPrice = baseSell;
                    break;
                case 'CALCULATED':
                    // RUSH = subtotal × percent (default 25). Sent as a single
                    // line with qty=1 and price=full surcharge amount.
                    if (a.code === 'RUSH' && orderSubtotal > 0) {
                        const pct = Number(a?.params?.percent ?? 25) / 100;
                        unitPrice = orderSubtotal * pct;
                    }
                    break;
                case 'PASSTHROUGH': {
                    // Freight / Pallet / Discount / CDP — rep enters the dollar amount.
                    const passAmount = Number(a?.params?.amount);
                    if (Number.isFinite(passAmount)) unitPrice = passAmount;
                    break;
                }
                case 'HOURLY': {
                    // Art — rate × hours. SellPrice is the hourly rate.
                    const hrs = Number(a?.params?.hours);
                    if (Number.isFinite(hrs) && hrs > 0) unitPrice = baseSell * hrs;
                    break;
                }
                case 'TIERED': {
                    // Phase 2c will resolve via /api/al-pricing or stitch surcharge
                    // bundles. Until then, allow the rep to override via params.unitPrice
                    // (escape hatch) so this isn't a hard blocker.
                    const overrideUnit = Number(a?.params?.unitPrice);
                    if (Number.isFinite(overrideUnit) && overrideUnit > 0) unitPrice = overrideUnit;
                    else
                        console.warn(
                            '[Order Form Submit] Skipping TIERED add-on — Phase 2c will wire price lookup:',
                            a.code
                        );
                    break;
                }
                default:
                    console.warn(
                        '[Order Form Submit] Unknown PricingMethod for',
                        a.code,
                        '→',
                        method
                    );
            }

            if (unitPrice == null) continue; // unresolved — skip rather than push $0

            // Phase 7 — for additional-logo codes (AL, AL-CAP, DECG-FB, CTR-*),
            // build a DisplayAsDescription that includes the position + stitches.
            // Production sees "AL · Right Sleeve · 5,000 stitches" inline on the
            // work order's LinesOE row, so they know exactly where each logo goes
            // without cross-referencing the design's Locations[] array.
            const positionCodes = new Set(['AL', 'AL-CAP', 'DECG-FB', 'CTR-Garmt', 'CTR-Cap']);
            let displayDescription = '';
            if (positionCodes.has(a.code)) {
                const pos = a?.params?.position || (a.code === 'DECG-FB' ? 'Full Back' : '');
                const stitches = Number(a?.params?.stitchCount) || 0;
                const parts = [
                    pos,
                    stitches > 0 ? `${stitches.toLocaleString()} stitches` : '',
                ].filter(Boolean);
                displayDescription = parts.join(' · ');
            }

            lineItems.push({
                partNumber: a.code,
                description: sc.DisplayName || a.code,
                displayDescription, // empty string for non-position codes (proxy passes through verbatim)
                color: '', // services don't carry color
                catalogColor: '',
                size: '', // services don't carry size
                quantity: qty,
                price: Number(unitPrice.toFixed(4)),
            });
        }
    }
}
module.exports = { appendServiceLines };
