// Paid storefront submission stage; contracts cover Stripe gates and the resulting order.
function buildStorefrontNotes(
    orderSettings,
    pushCfg,
    { hasFrontPrint, hasBackPrint, frontLocationName, backLocationName, frontCode, stampedBack }
) {
    const pushC = pushCfg.push;
    // Human-readable placement spec for the press operator (mirrors the
    // designer's inch-based, top-center-anchored placement contract).
    function placementLine(label, p) {
        if (!p) return null;
        const horiz = !p.xIn
            ? 'centered'
            : p.xIn > 0
              ? `${Math.abs(p.xIn).toFixed(2)}in right of center`
              : `${Math.abs(p.xIn).toFixed(2)}in left of center`;
        const dims = p.hIn ? `${p.wIn}w x ${p.hIn}h in` : `${p.wIn}in wide`;
        const dpi = p.effectiveDpi
            ? `, ${p.effectiveDpi} DPI${p.lowDpiAck ? ' (CUSTOMER ACCEPTED LOW-RES)' : ''}`
            : '';
        const proof =
            p.previewable === false ? ' — FILE NOT PREVIEWABLE, MATCH PLACEMENT + SEND PROOF' : '';
        const warns =
            Array.isArray(p.warnings) && p.warnings.length
                ? ` WARNINGS: ${p.warnings.join(', ')}.`
                : '';
        return `${label}: art ${dims}, ${horiz}, ${Number(p.yIn).toFixed(2)}in below print-area top${dpi}. Print from ${p.fileName || 'uploaded file'}.${proof}${warns}`;
    }
    const placement = orderSettings?.placement || {};
    const placementLines = [
        hasFrontPrint
            ? placementLine(
                  `FRONT - ${frontLocationName}${frontCode === 'JF' ? ' (JUMBO 16×20)' : ''}`,
                  placement.front
              )
            : null,
        hasBackPrint
            ? placementLine(
                  `BACK - ${backLocationName}${stampedBack === 'JB' ? ' (JUMBO 16×20)' : ''}`,
                  placement.back
              )
            : null,
    ].filter(Boolean);
    const placementBlock = placementLines.length
        ? `\nPRINT PLACEMENT (customer's designer preview, top-center anchor — ADVISORY: place at the STANDARD print location for the garment; use the spec below only when it clearly deviates on purpose):\n${placementLines.join('\n')}\n`
        : '';
    const artReviewBanner = orderSettings?.needsArtReview
        ? `\n*** ART NEEDS HUMAN PROOF BEFORE PRINTING — see placement spec; ${pushC.artReviewClock(!!orderSettings?.rush)} starts at proof approval ***\n`
        : '';
    // Legal record on the production order: the customer attested artwork
    // rights at checkout (storefront orders only). (2026-06-10)
    const rightsLine =
        orderSettings?.rightsAck && orderSettings.rightsAck.checked
            ? `\nCUSTOMER ATTESTED ARTWORK RIGHTS at checkout${orderSettings.rightsAck.ts ? ` (${orderSettings.rightsAck.ts})` : ''}.\n`
            : '';
    // Stock gate fail-open marker (2026-06-10): the checkout-time inventory
    // check couldn't run (feed error/timeout), so garments were NOT verified.
    // Only channels with a stock gate (registry stockBanner) emit this.
    const stockLine =
        pushC.stockBanner && orderSettings?.stockChecked === false
            ? '\n*** STOCK NOT VERIFIED AT CHECKOUT (inventory feed was down) — confirm garment availability before production ***\n'
            : '';
    const shipPromiseLine = orderSettings?.shipPromise?.label
        ? `\nPROMISED SHIP DATE: ${orderSettings.shipPromise.label} (stamped at checkout)\n`
        : '';
    return { placementBlock, artReviewBanner, rightsLine, stockLine, shipPromiseLine };
}
module.exports = { buildStorefrontNotes };
