// Order submission stage. Behavior covered by order-form-submit-contract.test.js.
module.exports = function createOrderDrafts({
    fetch,
    CASPIO_PROXY_BASE,
    withProxySecret,
    makeApiRequest,
}) {
    // Generate Order Form order ID — OF-NNNN (globally sequential, zero-padded to 4 digits).
    // Reuses the proxy's race-safe counter endpoint that Embroidery uses (same as EMB-2026-N).
    // Response shape: { prefix: "OF", year: 2026, sequence: 42 } → we return "OF-0042".
    // Falls back to OF-<timestamp> if the counter endpoint is unreachable so a push never 500s.
    // NOTE: The endpoint is year-scoped (resets Jan 1). At year-rollover the sequence restarts
    // at 1 — if OF-0001 from the prior year is still in quote_sessions, the idempotency check
    // on Status=Processed will catch any accidental re-use. Revisit this if we actually hit it.
    async function generateOrderFormDraftId() {
        try {
            const r = await fetch(`${CASPIO_PROXY_BASE}/api/quote-sequence/OF`, {
                headers: withProxySecret(),
            });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const j = await r.json();
            const n = Number(j && j.sequence);
            if (!Number.isFinite(n) || n <= 0)
                throw new Error('Bad sequence response: ' + JSON.stringify(j));
            return `OF-${String(n).padStart(4, '0')}`;
        } catch (err) {
            console.warn(
                '[Order Form] quote-sequence endpoint failed, falling back to timestamp:',
                err.message
            );
            return `OF-${Date.now()}`;
        }
    }
    return async function prepareDraft({
        draftId,
        isDryRun,
        info,
        breakdown,
        rows,
        ship,
        orderNotes,
        files,
        decoConfig,
    }) {
        // Every Order Form submission (staff-direct OR customer-via-share-link) uses the same
        // globally-sequential OF-NNNN format. For shared-link submits we reuse the draft's existing ID;
        // for direct submits we allocate a fresh one now (skipped in dry-run so sequence numbers aren't burned).
        let extOrderId = draftId || (isDryRun ? 'OF-DRYRUN' : null);
        let draftPkId = null;

        if (draftId) {
            // Share-link path: look up PK_ID + idempotency check on Draft→Processed.
            // Must use PK_ID path for PUT later (Caspio ?filter= PUT silently no-ops).
            try {
                const safeId = String(draftId).replace(/[^A-Z0-9-]/gi, '');
                const existing = await makeApiRequest(`/quote_sessions?filter=QuoteID='${safeId}'`);
                if (Array.isArray(existing) && existing[0]) {
                    draftPkId = existing[0].PK_ID || null;
                    if (existing[0].Status === 'Processed') {
                        return {
                            alreadyProcessed: {
                                success: true,
                                mode: 'already-processed',
                                extOrderId,
                                message: 'Already pushed',
                            },
                        };
                    }
                }
            } catch (e) {
                console.warn('[Order Form Submit] Idempotency check skipped:', e.message);
            }
        } else if (!isDryRun) {
            // Direct-staff path: allocate a fresh OF-NNNN and create a Draft quote_sessions row upfront
            // (Status flips to Processed after the push result is known, in the PK_ID PUT block below).
            // Skipped in dry-run so we don't burn sequence numbers or pollute quote_sessions during debugging.
            extOrderId = await generateOrderFormDraftId();
            try {
                const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                const formattedExpiresAt = expiresAtDate.toISOString().replace(/\.\d{3}Z$/, '');
                const sessionData = {
                    QuoteID: extOrderId,
                    SessionID: `orderform_${Date.now()}`,
                    Status: 'Draft', // flipped to Processed in the Status PUT block after the push result is known
                    CustomerName: [info.buyerFirst, info.buyerLast].filter(Boolean).join(' '),
                    CompanyName: info.company || '',
                    CustomerEmail: info.email || '',
                    Phone: info.phone || '',
                    // Pull dollar fields from breakdown (computed by frontend pricing modules).
                    // NOTE: breakdown.grandTotal is pre-tax ONLY for the React Order Form
                    // (pricing/shared.js sets grandTotal = subtotal). The DTG flagship sends a
                    // tax+shipping-INCLUSIVE grandTotal here (dtg-inline-form submitToShopWorks),
                    // so this OF-NNNN audit row's TotalAmount is NOT a reliable pre-tax figure for
                    // DTG — the canonical customer record is the separate DTG-NNN quote_sessions row
                    // (dtg-quote-page.js, TotalAmount pre-tax + a SHIP item + a real TaxAmount). This
                    // OF row writes no TaxAmount, so /invoice's grand = TotalAmount + 0 still displays
                    // the right (tax-incl) number. Tax is left to OnSite (manual-apply pattern).
                    TotalQuantity: Number(breakdown?.totalQty) || 0,
                    SubtotalAmount: Number(breakdown?.subtotal) || 0,
                    // [2026-06-09] Caspio Quote_Sessions.LTMFeeTotal is INTEGER — a fractional value (DTG's
                    // amortized LTM, e.g. 49.92) 400s this OF-NNNN tracking-session create (caught + logged,
                    // so the SW push still succeeds, but the tracking row was silently dropped on DTG LTM
                    // pushes). Round to the whole-dollar nominal fee — informational column, matches the
                    // dtg-quote-page.js save fix. (No-op when ltmTotal is already integer, e.g. React OF.)
                    LTMFeeTotal: Math.round(Number(breakdown?.ltmTotal) || 0),
                    TotalAmount: Number(breakdown?.grandTotal || breakdown?.subtotal) || 0,
                    ExpiresAt: formattedExpiresAt,
                    Notes: JSON.stringify({
                        info,
                        rows,
                        ship,
                        orderNotes,
                        files,
                        decoConfig,
                        staffFilled: [],
                        submitFlow: 'staff-direct',
                    }),
                };
                const createResp = await fetch(`${CASPIO_PROXY_BASE}/api/quote_sessions`, {
                    method: 'POST',
                    headers: withProxySecret({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify(sessionData),
                });
                if (createResp.ok) {
                    // NOTE: proxy's POST response has a bogus `PK_ID: "records"` (literal string from Location
                    // header tail — it's the collection endpoint URL). Always query back to get the real PK.
                    // Small delay helps Caspio be ready for the filter query on the just-inserted row.
                    await new Promise((r) => setTimeout(r, 500));
                    try {
                        const existing = await makeApiRequest(
                            `/quote_sessions?filter=QuoteID='${extOrderId}'`
                        );
                        if (
                            Array.isArray(existing) &&
                            existing[0] &&
                            typeof existing[0].PK_ID === 'number'
                        ) {
                            draftPkId = existing[0].PK_ID;
                        }
                    } catch (_) {
                        /* non-fatal */
                    }
                } else {
                    console.warn(
                        '[Order Form Submit] Could not pre-save direct submit record:',
                        createResp.status
                    );
                }
            } catch (e) {
                console.warn(
                    '[Order Form Submit] Direct-submit pre-save failed (non-fatal):',
                    e.message
                );
            }
        }
        return { extOrderId, draftPkId };
    };
};
