// Order submission stage. Behavior covered by order-form-submit-contract.test.js.
async function completeSubmission(
    {
        response,
        result,
        draftPkId,
        extOrderId,
        breakdown,
        rows,
        decoConfig,
        info,
        addOns,
        idemId,
        skippedLines,
    },
    res,
    { makeApiRequest, fetch, CASPIO_PROXY_BASE, withProxySecret, cacheSubmitResponse }
) {
    const ok = response.ok && result.success !== false;
    const shopWorksId = result.orderNumber || result.shopWorksId || null;

    // Update Caspio quote_sessions status (audit trail — both share-link AND staff-direct flows).
    // MUST use PK_ID path — ?filter=QuoteID='…' is accepted with 200 but silently no-ops (proxy quirk).
    // NOTE: the public GET via filter is also cached ~5min, so a reload right after submit may still
    // show "Draft" briefly. The submit response itself is authoritative for the UI.
    if (draftPkId) {
        // Use makeApiRequest (known-good Caspio PUT pattern, same as /api/quote_sessions/:id route uses).
        // Only PUT Status — Caspio's Notes column has a ~500-char limit; the form state from the Draft
        // INSERT stays intact. shopWorksId is visible in server logs + ShopWorks UI.
        const newStatus = ok ? 'Processed' : 'Processed - ShopWorks Failed';
        try {
            // Single retry with 1.5s delay for transient post-INSERT write races.
            let success = false;
            try {
                await makeApiRequest(`/quote_sessions/${draftPkId}`, 'PUT', { Status: newStatus });
                success = true;
            } catch (firstErr) {
                await new Promise((r) => setTimeout(r, 1500));
                await makeApiRequest(`/quote_sessions/${draftPkId}`, 'PUT', { Status: newStatus });
                success = true;
            }
            if (success)
                console.log(
                    '[Order Form Submit] ✓',
                    extOrderId,
                    'marked',
                    newStatus,
                    shopWorksId ? '→ SW#' + shopWorksId : ''
                );
        } catch (e) {
            console.warn('[Order Form Submit] Status PUT failed after retry:', e.message);
        }
    } else {
        console.warn(
            '[Order Form Submit] No PK_ID for',
            extOrderId,
            '— status not updated in Caspio'
        );
    }

    if (ok) {
        console.log('[Order Form Submit] ✓ Pushed', extOrderId, '→', shopWorksId);

        // Best-effort: save one quote_items row per (row, size) for line-level
        // audit history + analytics. Same schema as DTG/Embroidery/SP/DTF quote
        // builders. Failure here doesn't fail the order — push already succeeded.
        try {
            if (breakdown?.supported && breakdown.byRow) {
                const QUOTE_ITEMS_URL = `${CASPIO_PROXY_BASE}/api/quote_items`;
                const decoMethod = decoConfig?.method || rows.find((r) => r?.deco)?.deco || '';
                const cfg = decoConfig || {};
                const primaryLocation = cfg.primaryLocation || cfg.locationCombo || cfg.size || '';
                let lineNumber = 1;
                for (const r of rows) {
                    if (!r) continue;
                    const rb = breakdown.byRow[r.id];
                    if (!rb || rb.error) continue;
                    const sizes = r.sizes || {};
                    for (const sz of Object.keys(sizes)) {
                        const qty = parseInt(sizes[sz] || 0, 10);
                        if (!qty) continue;
                        const finalUnit = Number(rb.unitPriceBySize?.[sz] ?? 0);
                        const baseUnit = Math.max(
                            0,
                            finalUnit - Number(rb.extras?.ltmPerPiece || 0)
                        );
                        const item = {
                            QuoteID: extOrderId,
                            LineNumber: lineNumber++,
                            StyleNumber: r.style || '',
                            ProductName: r.desc || r.style || '',
                            Color: r.colorName || r.color || '',
                            ColorCode: r.catalogColor || '',
                            EmbellishmentType: decoMethod,
                            PrintLocation: primaryLocation,
                            PrintLocationName: primaryLocation,
                            Quantity: qty,
                            HasLTM: rb.tier === '1-7' || rb.tier === '1-23' || rb.tier === '10-23',
                            BaseUnitPrice: Number(baseUnit.toFixed(4)),
                            LTMPerUnit: Number((rb.extras?.ltmPerPiece || 0).toFixed(4)),
                            FinalUnitPrice: Number(finalUnit.toFixed(2)),
                            LineTotal: Number((finalUnit * qty).toFixed(2)),
                            SizeBreakdown: JSON.stringify({ [sz]: qty }),
                            PricingTier: rb.tier || '',
                            ImageURL: r.imageUrl || '',
                        };
                        try {
                            await fetch(QUOTE_ITEMS_URL, {
                                method: 'POST',
                                headers: withProxySecret({ 'Content-Type': 'application/json' }),
                                body: JSON.stringify(item),
                            });
                        } catch (_) {
                            /* per-line failure is non-fatal */
                        }
                    }
                }
                console.log(
                    '[Order Form Submit] quote_items saved for',
                    extOrderId,
                    '(',
                    lineNumber - 1,
                    'lines )'
                );
            }
        } catch (e) {
            console.warn('[Order Form Submit] quote_items save failed (non-fatal):', e.message);
        }

        // Phase 6c (2026-05-03) — track customer service history. After every
        // successful ShopWorks push, upsert one row in Customer_Service_History
        // per addOn so the next time this customer's name shows up on an order,
        // their most-used services float to the top of the rail. Best-effort —
        // wrapped in try/catch so a tracking failure NEVER blocks submission.
        try {
            const company = (info?.company || '').trim();
            const uniqueCodes = Array.isArray(addOns)
                ? Array.from(new Set(addOns.filter((a) => a?.code).map((a) => String(a.code))))
                : [];
            if (company && uniqueCodes.length > 0) {
                const HIST_URL = `${CASPIO_PROXY_BASE}/api/order-form/customer-suggestions/history`;
                // Fire all upserts in parallel — Caspio handles concurrent writes
                // fine since the table's composite unique index serializes the
                // (Customer_Company, Service_Code) pair.
                await Promise.allSettled(
                    uniqueCodes.map((code) =>
                        fetch(HIST_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                company,
                                serviceCode: code,
                                orderId: extOrderId,
                            }),
                        }).catch(() => null)
                    )
                );
                console.log(
                    '[Order Form Submit] Customer_Service_History tracked',
                    uniqueCodes.length,
                    'codes for',
                    company
                );
            }
        } catch (e) {
            console.warn(
                '[Order Form Submit] Customer_Service_History upsert failed (non-fatal):',
                e.message
            );
        }

        const successBody = { success: true, extOrderId, shopWorksId, mode: 'live', skippedLines };
        cacheSubmitResponse(idemId, { statusCode: 200, body: successBody });
        return res.json(successBody);
    } else {
        console.error('[Order Form Submit] Push failed:', result);
        const failBody = {
            success: false,
            extOrderId,
            error: result.error || 'ShopWorks submission failed',
            detail: result,
        };
        // Cache failures too — a client retry after a 502 should get the same
        // result back instead of starting a fresh push (idempotent error path).
        cacheSubmitResponse(idemId, { statusCode: 502, body: failBody });
        return res.status(502).json(failBody);
    }
}
module.exports = { completeSubmission };
