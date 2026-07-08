/**
 * EMB save + ShopWorks-push module — roadmap 0.4 extraction #6 (2026-07-07).
 *
 * The money endgame: saveAndGetLink → _saveAndGetLinkInner (the 450-line
 * save orchestrator: collect state, quote-sequence id, two-table Caspio
 * save, share link) and the push pipeline (readiness checklist, preview,
 * confirm, verify). Push gating rules live here — the one-click flow gates
 * on THIS call's fresh save id, never a stale module-level id (LESSONS
 * 2026-07-04b).
 *
 * Moved verbatim from embroidery-quote-builder.js (~915-line cluster).
 * The three push-state vars (_pushQuoteId/_pushAlreadyDone/_pushInFlight)
 * were HOISTED BACK into the monolith — persistence.js and output.js read
 * them through the global scope chain (config-level writable globals).
 */
// @ts-nocheck — MOVED legacy DOM code: pre-existing checkJs frictions; typing
// lands with this cluster's render/state split (see emb-decomposition-plan.md).
/* global buildLogoConfiguration,
   collectProductsFromTable, dateFromInputValue,
   getCapEmbellishmentType, getOrderPieceCounts, recalculatePricing,
   syncALRows, syncDECGRows, escapeHtml, showToast, showLoading,
   getLtmControlState, parseRatePercent, markAsSaved, updateEditModeUI,
   QuoteShareModal, renderPushChecklist, getPushBlockers, hasUnsavedChanges */
import { getServicePrice } from './pricing.js';
import { getAdditionalCharges, collectDECGItems } from './quote-lifecycle.js';

/**
 * Save quote and get shareable link
 * Uses EmbroideryQuoteService and QuoteShareModal
 */
export async function saveAndGetLink(opts = {}) {
    // Re-entrancy guard: the save button was only disabled deep into the flow
    // (after three awaits), so a double-click started two concurrent saves —
    // duplicate quote sessions on a new quote, racing delete/insert in edit mode.
    if (window._embSaveInFlight) {
        showToast('Save already in progress…', 'info');
        return;
    }
    // eslint-disable-next-line no-restricted-syntax -- cross-file re-entrancy flag (documented seam)
    window._embSaveInFlight = true;
    try {
        return await _saveAndGetLinkInner(opts);
    } finally {
        // eslint-disable-next-line no-restricted-syntax -- cross-file re-entrancy flag (documented seam)
        window._embSaveInFlight = false;
    }
}

async function _saveAndGetLinkInner(opts = {}) {
    const skipShareModal = !!(opts && opts.skipShareModal);   // true from pushToShopWorks: auto-save → push, no share modal
    // Settle on-screen prices before snapshotting them — AL rows + Rush are display-driven,
    // so a stale value here would be persisted to the quote. (2026-06-04 audit hardening)
    try { await syncALRows(); await syncDECGRows(); await recalculatePricing(); } catch (e) { console.warn('[Save] pre-save recalc skipped', e); }

    const allItems = collectProductsFromTable();
    const products = allItems.filter(p => !p.isService);
    // DECG/DECC (customer-supplied garment/cap) rows are persisted by the decgItems loop below
    // as EmbellishmentType 'customer-supplied'. They MUST be excluded here, else the
    // manualServiceItems save loop ALSO writes them as a 'fee' item → the DB gets TWO DECG
    // rows ($480 for a $240 order) and /invoice + ShopWorks push over-charge 2x, while the
    // on-screen total (which reads the table once) still shows the correct amount so the rep
    // never notices. (cert audit 2026-06-04)
    const manualServiceItems = allItems.filter(p => p.isService && !['decg', 'decc'].includes((p.serviceType || '').toLowerCase()));
    const decgItems = collectDECGItems();
    if (products.length === 0 && decgItems.length === 0 && manualServiceItems.length === 0) {
        showToast('Add products before saving', 'error');
        return;
    }
    // Guard: logos/services with NO garment or cap to go on (e.g. an AL-CAP row but the cap
    // product never got added — the EMB-273 incident). Almost always a mistake. (2026-06-04 audit)
    if (products.length === 0 && decgItems.length === 0 && manualServiceItems.length > 0) {
        showToast('This order has only logos/services — add the garment or cap they go on first.', 'error', 6000);
        return;
    }

    // Validate required fields
    const customerName = document.getElementById('customer-name')?.value?.trim();
    const customerEmail = document.getElementById('customer-email')?.value?.trim();

    if (!customerName || !customerEmail) {
        showToast('Please enter customer name and email', 'error');
        if (!customerName) document.getElementById('customer-name')?.focus();
        else if (!customerEmail) document.getElementById('customer-email')?.focus();
        return;
    }
    // [B11] (P3-15, audit 2026-06-06): email was presence-checked but never format-validated → a typo'd
    // address saved + emailed silently. Reject an obviously-malformed address.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
        showToast('Enter a valid email address (name@company.com).', 'error');
        document.getElementById('customer-email')?.focus();
        return;
    }

    // Artwork uploaded but the design left UNNAMED → the ShopWorks push silently DROPS the art
    // (the transformer gates Designs[] on a non-empty design name) and production gets "NO DESIGN
    // LINKED" for a job that has a logo. isValidForPush() is false only in exactly that case
    // (files present + name blank). Require the name so the uploaded logo reaches the floor.
    // (2026-06-04 audit B6)
    if (window._embArtwork && typeof window._embArtwork.isValidForPush === 'function' && !window._embArtwork.isValidForPush()) {
        showToast('You uploaded artwork — give the design a name so it isn’t dropped from the ShopWorks order.', 'error', 6000);
        const dn = document.querySelector('#emb-artwork-mount .artwork-upload-designname-input');  // widget's real input class (audit fix 2026-06-05)
        if (dn && typeof dn.focus === 'function') dn.focus();
        return;
    }

    // Artwork still uploading → getFiles() below would snapshot referenceArtwork WITHOUT the in-flight
    // file (the widget pushes to state.files only AFTER the upload resolves), so the EMB transformer would
    // omit its Location and production silently loses the art. Block save until uploads finish. (review C11)
    if (window._embArtwork && typeof window._embArtwork.isUploading === 'function' && window._embArtwork.isUploading()) {
        showToast('Artwork is still uploading — wait for it to finish before saving.', 'warning', 5000);
        return;
    }

    // Validate non-SanMar products have pricing set
    const zeroPriceRows = products.filter(p => {
        const row = document.getElementById(`row-${p.rowId}`);
        return row && row.dataset.nonSanmar === 'true' && p.sellPriceOverride <= 0;
    });
    if (zeroPriceRows.length > 0) {
        const styleList = zeroPriceRows.map(p => p.style).join(', ');
        showToast(`Non-SanMar product(s) have $0 pricing: ${styleList}. Double-click the price cell to set a price.`, 'error', 6000);
        return;
    }

    // P1-4 (audit 2026-06-06): block save when any Additional-Logo / Customer-Supplied row failed to price
    // (its pricing API threw or returned $0). Never save a silent $0 line (Erik's #1 rule).
    const priceErrRows = Array.from(document.querySelectorAll('#product-tbody tr.service-product-row'))
        .filter(r => r.dataset.priceError === 'true');
    if (priceErrRows.length > 0) {
        showToast('Some Additional-Logo / Customer-Supplied rows could not be priced — refresh and re-check before saving (they will not be saved at $0).', 'error', 7000);
        return;
    }

    // Get save button for loading state
    const saveBtn = document.querySelector('.btn-save-quote, [onclick*="saveAndGetLink"]');
    const originalText = saveBtn?.innerHTML;
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveBtn.disabled = true;
    }

    showLoading(true);

    try {
        // Build logo configuration from global state (shared helper)
        const { logoConfigs, allLogos } = buildLogoConfiguration();

        // Read LTM control state
        const ltmState = getLtmControlState('emb-ltm-panel');
        const ltmEnabled = ltmState.enabled;
        const ltmDisplayMode = ltmState.displayMode || 'builtin';

        let pricing;
        if (products.length === 0) {
            // DECG-only: build minimal pricing (no pricing engine needed)
            const decgTotal = decgItems.reduce((sum, d) => sum + d.total, 0);
            const decgQty = decgItems.reduce((sum, d) => sum + d.quantity, 0);
            pricing = {
                products: [],
                totalQuantity: decgQty,
                subtotal: decgTotal,
                grandTotal: decgTotal,
                tier: decgQty <= 7 ? '1-7' : decgQty <= 23 ? '8-23' : decgQty <= 47 ? '24-47' : decgQty <= 71 ? '48-71' : '72+',
                ltmFee: 0,
                additionalServices: [],
                additionalStitchTotal: 0,
                garmentStitchTotal: 0,
                capStitchTotal: 0,
                garmentSetupFees: 0,
                capSetupFees: 0,
                garmentQuantity: 0,
                capQuantity: 0
            };
        } else {
            pricing = await pricingCalculator.calculateQuote(products, allLogos, logoConfigs, { ltmEnabled });
        }

        // Don't SAVE a quote at a silently-wrong (zero) price on a hard pricing failure. `=== false`
        // (not falsy) so the DECG-only branch above — which builds a pricing object with no `success`
        // field — is NOT blocked. (review C4 — Erik's #1 rule)
        if (pricing && pricing.success === false) {
            if (saveBtn) { saveBtn.innerHTML = originalText; saveBtn.disabled = false; }
            try { showLoading(false); } catch (_) {}
            showToast(pricing.message || 'Pricing unavailable — cannot save this quote. Refresh and try again.', 'error', 6000);
            return;
        }

        // Don't save an UNDER-total either — if any product's pricing failed it was left out of the
        // subtotal (review C5). Block the save so a wrong (low) price never reaches Caspio/ShopWorks.
        if (pricing && Array.isArray(pricing.failedProducts) && pricing.failedProducts.length > 0) {
            if (saveBtn) { saveBtn.innerHTML = originalText; saveBtn.disabled = false; }
            try { showLoading(false); } catch (_) {}
            showToast(`Can't save — pricing failed for ${pricing.failedProducts.length} item(s) (${pricing.failedProducts.map(f => f.style).join(', ')}). Refresh until all prices load.`, 'error', 7000);
            return;
        }

        // Include DECG/DECC service totals in grandTotal (same as recalculatePricing)
        // Only for mixed orders (products + DECG). DECG-only path above already initialized correctly.
        if (decgItems.length > 0 && products.length > 0) {
            const decgServiceTotal = decgItems.reduce((sum, d) => sum + d.total, 0);
            pricing.subtotal += decgServiceTotal;
            pricing.grandTotal += decgServiceTotal;
        }

        // Include manual service items (Monogram/Name-Number/WEIGHT) in grandTotal
        if (manualServiceItems.length > 0) {
            const manualServiceTotal = manualServiceItems.reduce((sum, si) => sum + (si.unitPrice * si.totalQuantity), 0);
            pricing.subtotal += manualServiceTotal;
            pricing.grandTotal += manualServiceTotal;
        }

        // Get sales rep NAME from dropdown selected option text
        const salesRepSelect = document.getElementById('sales-rep');
        const salesRepEmail = salesRepSelect?.value || 'sales@nwcustomapparel.com';
        const salesRepName = salesRepSelect?.options[salesRepSelect.selectedIndex]?.text || '';

        // Get additional charges (artwork, rush, sample, discount)
        const additionalCharges = getAdditionalCharges();

        // Build customer data with additional charges
        const customerData = {
            email: customerEmail,
            name: customerName,
            company: document.getElementById('company-name')?.value?.trim() || '',
            project: document.getElementById('project-name')?.value?.trim() || '',  // P2-5 (audit 2026-06-06): was captured nowhere
            isWholesale: document.getElementById('wholesale-checkbox')?.checked || false,  // [2026-06-07] → IsWholesale; push routes to acct 2203
            salesRepEmail: salesRepEmail,
            salesRepName: salesRepName,
            notes: document.getElementById('notes')?.value?.trim() || '',
            // Additional charges (2026-01-14)
            artCharge: additionalCharges.artCharge,
            graphicDesignHours: additionalCharges.graphicDesignHours,
            graphicDesignCharge: additionalCharges.graphicDesignCharge,
            rushFee: additionalCharges.rushFee,
            sampleFee: additionalCharges.sampleFee,
            sampleQty: additionalCharges.sampleQty,
            discount: additionalCharges.discount,
            discountPercent: additionalCharges.discountPercent,
            discountReason: additionalCharges.discountReason,
            // Order details (2026-02-11)
            phone: document.getElementById('customer-phone')?.value?.trim() || '',
            orderNumber: document.getElementById('order-number')?.value?.trim() || '',
            customerNumber: document.getElementById('customer-number')?.value?.trim() || '',
            purchaseOrderNumber: document.getElementById('po-number')?.value?.trim() || '',
            shipToAddress: document.getElementById('ship-address')?.value?.trim() || '',
            shipToCity: document.getElementById('ship-city')?.value?.trim() || '',
            shipToState: document.getElementById('ship-state')?.value || '',
            shipToZip: document.getElementById('ship-zip')?.value?.trim() || '',
            shipMethod: (() => {
                const sel = document.getElementById('ship-method')?.value || '';
                if (sel === 'Other') return document.getElementById('ship-method-other')?.value?.trim() || 'Other';
                return sel;
            })(),
            dateOrderPlaced: dateFromInputValue(document.getElementById('date-order-placed')?.value),
            reqShipDate: dateFromInputValue(document.getElementById('req-ship-date')?.value),
            dropDeadDate: dateFromInputValue(document.getElementById('drop-dead-date')?.value),
            paymentTerms: document.getElementById('payment-terms')?.value?.trim() || '',
            // Frozen tax & design data for Caspio (2026-02-12)
            designNumbers: lastImportMetadata?.designNumbers || [],
            digitizingCodes: lastImportMetadata?.digitizingCodes || [],
            digitizingFees: lastImportMetadata?.parsedServices?.digitizingFees || [],
            taxRate: (() => {
                const includeTax = document.getElementById('include-tax')?.checked;
                if (!includeTax) return 0;
                // parseRatePercent: 0 is a VALID rate (out-of-state) — `|| 10.1` was
                // silently saving WA tax on quotes the screen showed at $0 tax.
                const rateVal = parseRatePercent(document.getElementById('tax-rate-input')?.value, 10.2);
                return rateVal / 100;
            })(),
            taxAmount: (() => {
                const includeTax = document.getElementById('include-tax')?.checked;
                if (!includeTax) return 0;
                const rateVal = parseRatePercent(document.getElementById('tax-rate-input')?.value, 10.2);
                const preTaxText = document.getElementById('pre-tax-subtotal')?.textContent || '$0.00';
                const preTaxSubtotal = parseFloat(preTaxText.replace(/[$,]/g, '')) || 0;
                // #pre-tax-subtotal is ALREADY the full pre-tax base incl. shipping (= the on-screen
                // adjustedSubtotal that updateTaxCalculation taxes once at L7259). Do NOT add shipping
                // again — that double-counted shipping in the saved/pushed TaxAmount. (round-2 N1/N6 — pre-existing bug)
                return Math.round(preTaxSubtotal * (rateVal / 100) * 100) / 100;
            })(),
            importNotes: lastImportMetadata
                ? [...(lastImportMetadata.warnings || []), ...(lastImportMetadata.unmatchedLines || []), ...(lastImportMetadata.reviewItems || [])]
                : [],
            // Phase 11.3 (2026-05-24) — rich-mode artwork data.
            // Persisted by quote-service.js into the ImportNotes JSON column
            // (extended from flat-array to object shape so this data rides
            // along without a Caspio schema change). Proxy's EMB transformer
            // reads them to emit Designs[{name, Locations[]}] on push.
            referenceArtwork: (window._embArtwork && typeof window._embArtwork.getFiles === 'function')
                ? window._embArtwork.getFiles()
                : [],
            newDesignName: (window._embArtwork && typeof window._embArtwork.getDesignName === 'function')
                ? (window._embArtwork.getDesignName() || '').trim()
                : '',
            paidToDate: lastImportMetadata?.paidToDate ?? 0,
            balanceAmount: lastImportMetadata?.balanceAmount ?? 0,
            orderNotes: lastImportMetadata?.orderNotes ?? '',
            // Package tracking (2026-02-14)
            carrier: lastImportMetadata?.carrier || '',
            trackingNumber: lastImportMetadata?.trackingNumber || '',
            // Design assignments (2026-02-19)
            garmentDesignNumber: primaryLogo.designNumber || '',
            capDesignNumber: (typeof capPrimaryLogo !== 'undefined' ? capPrimaryLogo.designNumber : '') || '',
            // ShopWorks pricing audit (2026-02-13)
            swTotal: lastImportMetadata?.swTotal ?? 0,
            swSubtotal: lastImportMetadata?.swSubtotal ?? 0,
            priceAuditJSON: (() => {
                if (!lastImportMetadata || !lastImportMetadata.swSubtotal) return '';
                // Reloaded quotes have no per-row _swUnitPrice (it only exists right after a
                // paste-import), so recomputing here would write false MISMATCH flags. Keep
                // the audit captured at import time verbatim. (audit 2026-06-10)
                if (lastImportMetadata.restoredFromSession) return lastImportMetadata.priceAuditJSONSnapshot || '';
                const swSub = lastImportMetadata.swSubtotal;
                const ourSub = pricing.grandTotal || 0;
                const delta = ourSub - swSub;
                const pct = swSub > 0 ? Math.abs(delta / swSub) * 100 : 0;
                const flag = pct <= 5 ? 'OK' : pct <= 15 ? 'REVIEW' : 'MISMATCH';
                const prods = (pricing.products || []).map(pp => {
                    const li = (pp.lineItems || [pp])[0];
                    const ourUnit = li?.unitPriceWithLTM || li?.unitPrice || 0;
                    const swUnit = pp.product?._swUnitPrice || 0;
                    const pDelta = ourUnit - swUnit;
                    const pPct = swUnit > 0 ? Math.abs(pDelta / swUnit) * 100 : 0;
                    return {
                        style: pp.product?.style || '?',
                        color: pp.product?.color || '?',
                        qty: pp.product?.totalQuantity || 0,
                        swUnit: parseFloat(swUnit.toFixed(2)),
                        ourUnit: parseFloat(ourUnit.toFixed(2)),
                        delta: parseFloat(pDelta.toFixed(2)),
                        flag: pPct <= 5 ? 'OK' : pPct <= 15 ? 'REVIEW' : 'MISMATCH'
                    };
                });
                // Append service items (AL, Monogram, Weight, Digitizing) to audit
                const svc = lastImportMetadata.parsedServices || {};
                const alFeePerUnit = pricing.additionalServices?.length > 0
                    ? (pricing.additionalServices[0]?.unitPrice || 6.50)
                    : 6.50;
                (svc.additionalLogos || []).forEach(al => {
                    const swU = parseFloat(al.unitPrice || al.price || 0);
                    const ourU = parseFloat(alFeePerUnit.toFixed(2));
                    const d = ourU - swU;
                    const p = swU > 0 ? Math.abs(d / swU) * 100 : 0;
                    prods.push({ style: 'AL', color: 'Service', qty: parseInt(al.quantity || al.qty || 0),
                        swUnit: parseFloat(swU.toFixed(2)), ourUnit: ourU,
                        delta: parseFloat(d.toFixed(2)), flag: p <= 5 ? 'OK' : p <= 15 ? 'REVIEW' : 'MISMATCH', isService: true });
                });
                (svc.monograms || []).forEach(m => {
                    const swU = parseFloat(m.unitPrice || m.price || 0);
                    const ourU = getServicePrice('Monogram', 12.50);  // audit flags must track Caspio, not 2026-02 literals
                    const d = ourU - swU;
                    const p = swU > 0 ? Math.abs(d / swU) * 100 : 0;
                    prods.push({ style: 'Monogram', color: 'Service', qty: parseInt(m.quantity || m.qty || 0),
                        swUnit: parseFloat(swU.toFixed(2)), ourUnit: ourU,
                        delta: parseFloat(d.toFixed(2)), flag: p <= 5 ? 'OK' : p <= 15 ? 'REVIEW' : 'MISMATCH', isService: true });
                });
                (svc.weights || []).forEach(w => {
                    const swU = parseFloat(w.unitPrice || w.price || 0);
                    const ourU = getServicePrice('WEIGHT', 6.25);  // audit flags must track Caspio, not 2026-02 literals
                    const d = ourU - swU;
                    const p = swU > 0 ? Math.abs(d / swU) * 100 : 0;
                    prods.push({ style: 'Weight', color: 'Service', qty: parseInt(w.quantity || w.qty || 0),
                        swUnit: parseFloat(swU.toFixed(2)), ourUnit: ourU,
                        delta: parseFloat(d.toFixed(2)), flag: p <= 5 ? 'OK' : p <= 15 ? 'REVIEW' : 'MISMATCH', isService: true });
                });
                (svc.digitizingFees || []).forEach(df => {
                    const swU = parseFloat(df.amount || df.unitPrice || 0);
                    const ourU = swU; // Digitizing is pass-through, same price expected
                    prods.push({ style: df.code || 'DD', color: 'Service', qty: 1,
                        swUnit: parseFloat(swU.toFixed(2)), ourUnit: parseFloat(ourU.toFixed(2)),
                        delta: 0, flag: 'OK', isService: true });
                });
                // DECG/DECC items
                const parsedDecg = svc.decgItems || [];
                parsedDecg.forEach(pd => {
                    const swU = parseFloat(pd.unitPrice || 0);
                    const ourU = parseFloat(pd.calculatedUnitPrice || 0);
                    const qty = parseInt(pd.quantity || 0);
                    const d = ourU - swU;
                    const p = swU > 0 ? Math.abs(d / swU) * 100 : 0;
                    const label = pd.serviceType === 'decc' ? 'DECC' : 'DECG';
                    prods.push({ style: label, color: 'Service', qty: qty,
                        swUnit: parseFloat(swU.toFixed(2)), ourUnit: parseFloat(ourU.toFixed(2)),
                        delta: parseFloat(d.toFixed(2)), flag: p <= 5 ? 'OK' : p <= 15 ? 'REVIEW' : 'MISMATCH', isService: true });
                });
                return JSON.stringify({ swTotal: lastImportMetadata.swTotal, swSubtotal: swSub,
                    ourSubtotal: parseFloat(ourSub.toFixed(2)), deltaSubtotal: parseFloat(delta.toFixed(2)),
                    deltaPct: parseFloat(pct.toFixed(1)), flag, products: prods });
            })()
        };

        // DECG/DECC items already collected at function start

        // Build quote data
        const quoteData = {
            products: products,
            logos: allLogos,
            // Cap embellishment type for laser-patch orders
            capEmbellishmentType: getCapEmbellishmentType(),
            // DECG/DECC items for shareable URLs
            decgItems: decgItems
        };

        // Override ltmDistributed based on display mode selection
        pricing.ltmDistributed = (ltmDisplayMode === 'builtin');

        // Add LTM state to customerData for Caspio persistence
        customerData.ltmDisplayMode = ltmDisplayMode;
        customerData.ltmWaived = !ltmEnabled;

        // Attach logos and embellishment type to pricing for service to access
        pricing.logos = allLogos;
        pricing.capEmbellishmentType = getCapEmbellishmentType();
        // Attach DECG items to pricing for service to access
        pricing.decgItems = decgItems;
        // Attach manual service items (Monogram/Name-Number/WEIGHT) for saving
        pricing.manualServiceItems = manualServiceItems;

        let result;
        if (editingQuoteId) {
            // Edit mode: Update existing quote (save revision)
            result = await quoteService.updateQuote(editingQuoteId, quoteData, customerData, pricing);
        } else {
            // New quote mode: Create new quote
            result = await quoteService.saveQuote(quoteData, customerData, pricing);
        }

        if (result && result.quoteID) {
            // Partial save = NOT a success: items are missing from the DB, so the
            // share link, /quote page, and a ShopWorks push would all under-bill.
            // Keep the local draft (rep's data is the only complete copy), skip the
            // share modal, and leave Push disabled. (audit 2026-06-10)
            if (result.partialSave) {
                showToast((result.warning || 'Some line items failed to save.') +
                    ' The quote is incomplete — do NOT share or push it. Check your connection and save again.', 'error', 12000);
                return;
            }

            const isUpdate = !!editingQuoteId;
            // Clear auto-save draft on successful save (2026 consolidation)
            if (embPersistence) {
                embPersistence.clearDraft();
            }

            // Mark as saved (no unsaved changes)
            markAsSaved();

            if (isUpdate) {
                // Update mode: Show revision success message
                const newRevision = result.revision || (editingRevision + 1);
                editingRevision = newRevision;
                updateEditModeUI(result.quoteID, newRevision);
                showToast(`Revision ${newRevision} saved successfully!`, 'success');

                // Show modal with link (don't pass message as baseUrl!) — skipped when auto-saving
                // to push, where the push preview opens instead.
                if (!skipShareModal) {
                    if (typeof QuoteShareModal !== 'undefined' && QuoteShareModal.show) {
                        QuoteShareModal.show(result.quoteID);
                    } else {
                        const url = `${window.location.origin}/quote/${result.quoteID}`;
                        navigator.clipboard.writeText(url).catch(() => {});
                        showToast(`Quote ${result.quoteID} updated (Rev ${newRevision}). Link copied!`, 'success');
                    }
                }
            } else {
                // New quote: success modal with shareable link — skipped when auto-saving to push.
                if (!skipShareModal) {
                    if (typeof QuoteShareModal !== 'undefined' && QuoteShareModal.show) {
                        QuoteShareModal.show(result.quoteID);
                    } else {
                        const url = `${window.location.origin}/quote/${result.quoteID}`;
                        navigator.clipboard.writeText(url).catch(() => {});
                        showToast(`Quote ${result.quoteID} saved. Link copied!`, 'success');
                    }
                }
            }

            // Show Push to ShopWorks button after successful save. [B5]: only a NEW quote clears the
            // already-pushed lock; an update preserves it so a re-save can't re-enable a duplicate push.
            showPushButton(result.quoteID, { resetPushed: !isUpdate });
        } else {
            throw new Error(result?.error || 'Failed to save quote');
        }
    } catch (error) {
        console.error('[Embroidery] Save error:', error);
        showToast('Error saving quote: ' + error.message, 'error');
    } finally {
        showLoading(false);
        // Restore button state
        if (saveBtn) {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }
}

// Legacy function - redirects to saveAndGetLink
export async function saveQuote() {
    return saveAndGetLink();
}

// =====================================================
// Push to ShopWorks
// =====================================================


// Single source of truth for the action-bar "Push to ShopWorks" button state.
// Gated: enabled only when the quote is saved AND a ShopWorks Customer # is set
// (a blank Customer # would silently route the order to the catch-all customer).
export function updatePushButtonState() {
    const btn = document.getElementById('emb-push-shopworks-btn');
    const label = document.getElementById('emb-push-shopworks-label');
    if (!btn) return;  // [2026-06-07] do NOT bail when the label is transiently missing → still enable/disable the button
    renderPushReadiness();

    if (_pushAlreadyDone) {
        // "Sent" — not "Pushed/Imported". The order reached ManageOrders; OnSite
        // import is confirmed separately (Verify in ShopWorks in the push modal).
        if (label) label.textContent = 'Sent to ShopWorks ✓';
        btn.disabled = true;
        btn.style.opacity = '1';
        btn.style.cursor = 'default';
        btn.style.background = '#28a745';
        btn.title = 'This quote was sent to ManageOrders. Use “Verify in ShopWorks” to confirm OnSite imported it.';
        return;
    }

    // Push auto-saves first, and the save REQUIRES customer #, >=1 product, name AND email — so enable
    // the button only when all four are met. This keeps it consistent with the readiness checklist
    // (no more "enabled with zero products") and never invites a click that dies in the save step.
    // (review C22/C35 2026-06-05)
    const r = getPushReadiness();
    const enabled = r.hasCustomer && r.hasProducts && r.hasName && r.hasEmail;

    if (label) label.textContent = 'Push to ShopWorks';
    // Theme comes from the #emb-push-shopworks-btn CSS class (PNW green) + its
    // :disabled rule — clearing any inline background left by the "Sent ✓" state.
    btn.style.background = '';
    btn.disabled = !enabled;
    btn.style.opacity = '';
    btn.style.cursor = '';
    btn.title = enabled
        ? 'Save + create this quote as an order in ShopWorks OnSite (saves automatically)'
        : 'Complete the “Before you push” checklist (Customer #, a product, name + email) to enable push';
}

/**
 * Single source of truth for "is this quote ready to push to ShopWorks?" — used by BOTH the Push button
 * gate (updatePushButtonState) and the readiness checklist (renderPushReadiness) so they can never
 * contradict. Mirrors the saveAndGetLink() validation (name + email required). (review C22/C35 2026-06-05)
 */
export function getPushReadiness() {
    let hasProducts = false;
    try {
        const c = getOrderPieceCounts();
        let pieces = c.garment + c.cap;
        // Customer-supplied (DECG/DECC) rows ARE the order's items but collect with isService:true, so
        // getOrderPieceCounts() filters them out. Count them too — else a valid DECG/DECC-only quote
        // (saveAndGetLink permits products===0 && decg>0) can't reach the Push button. (round-2 regression fix)
        if (typeof collectDECGItems === 'function') pieces += collectDECGItems().length;
        hasProducts = pieces > 0;
    } catch (_) {}
    return {
        hasCustomer: !!(document.getElementById('customer-number')?.value?.trim()),
        hasProducts: hasProducts,
        hasName: !!(document.getElementById('customer-name')?.value?.trim()),
        hasEmail: !!(document.getElementById('customer-email')?.value?.trim()),
    };
}

/**
 * Push-readiness checklist (audit #8 2026-06-05) — shows the gates a successful ShopWorks push needs
 * (Customer #, ≥1 product, customer name) so the rep isn't guessing why the Push button is disabled.
 * Live-rendered from updatePushButtonState() + recalculatePricing().
 */
export function renderPushReadiness() {
    const el = document.getElementById('push-readiness');
    if (!el) return;
    if (_pushAlreadyDone) { el.innerHTML = ''; return; }   // already sent — nothing to check
    const r = getPushReadiness();
    // Shared clickable checklist (quote-builder-utils.js) — unmet items focus their field
    // (item #8, 2026-07-05). Fallback keeps the old plain markup if utils didn't load.
    if (typeof renderPushChecklist === 'function' && typeof getPushBlockers === 'function') {
        renderPushChecklist(el, getPushBlockers(r));
    } else {
        const item = (ok, label) =>
            `<div class="pr-item ${ok ? 'pr-ok' : 'pr-no'}"><i class="fas fa-${ok ? 'check-circle' : 'circle'}"></i>${label}</div>`;
        el.innerHTML = '<div class="pr-title">Before you push</div>' +
            item(r.hasCustomer, 'ShopWorks Customer #') +
            item(r.hasProducts, 'At least one item') +
            item(r.hasName, 'Customer name') +
            item(r.hasEmail, 'Customer email');
    }
    // [2026-06-07] Keep the Push button in LOCK-STEP with this checklist so they can NEVER desync. Direct
    // renderPushReadiness() callers (e.g. a product change at ~line 6341) updated the checklist green but
    // never re-gated the button → it stayed stale-disabled even with all checks green (the bug Erik hit).
    const _pbtn = document.getElementById('emb-push-shopworks-btn');
    if (_pbtn && !_pushAlreadyDone) {
        const enabled = r.hasCustomer && r.hasProducts && r.hasName && r.hasEmail;
        _pbtn.disabled = !enabled;
        _pbtn.style.opacity = enabled ? '1' : '0.5';
        _pbtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }
}
// (window bridge moved to builders/emb/index.js)

// Called after a successful save and when loading a saved quote for editing.
export function showPushButton(quoteId, opts = {}) {
    _pushQuoteId = quoteId;
    // [B5] (audit 2026-06-06): only CLEAR the "already pushed" lock for a genuinely NEW quote. A re-save of
    // an already-pushed quote must NOT wipe it (else the rep can push again → a duplicate ShopWorks order).
    if (opts.resetPushed === true) _pushAlreadyDone = false;
    updatePushButtonState();
}

export async function pushToShopWorks() {
    const hasCustomer = !!(document.getElementById('customer-number')?.value?.trim());
    if (!hasCustomer) {
        showToast('Enter the ShopWorks Customer # (top of the form) before pushing.', 'warning');
        document.getElementById('customer-number')?.focus();
        return;
    }
    if (_pushInFlight) return;             // already saving/pushing — ignore the double-click
    _pushInFlight = true;
    const pushBtn = document.getElementById('emb-push-shopworks-btn');
    if (pushBtn) {
        pushBtn.disabled = true;  // disable synchronously, BEFORE the first await
        // [2026-06-07] The silent save before the preview modal takes ~2-3s — show a spinner so the rep knows
        // it's working. Update the LABEL's content, NOT the button's innerHTML — replacing the button HTML
        // destroys #emb-push-shopworks-label, which updatePushButtonState needs, and would strand the button
        // disabled (the greyed-Push regression). updatePushButtonState() in the finally resets the label text.
        const lbl = document.getElementById('emb-push-shopworks-label');
        if (lbl) lbl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing preview…';
    }
    try {
        const dirty = (typeof hasUnsavedChanges === 'function') ? hasUnsavedChanges() : true;
        if (!_pushQuoteId || dirty) {
            await saveAndGetLink({ skipShareModal: true });   // silent save → showPushButton sets _pushQuoteId
        }
        if (!_pushQuoteId) return;            // save failed / validation blocked it — error already shown
        await openPushPreview();
    } finally {
        _pushInFlight = false;
        updatePushButtonState();          // resets the label text + re-enables via the gate (respects blank-cust# / "Sent ✓")
    }
}
// (window bridge moved to builders/emb/index.js)

// Open the preview-and-confirm modal. Fetches the exact ExternalOrderJson the
// backend would send (read-only /preview endpoint) so the rep reviews line
// items, designs and notes before the order is created.
export async function openPushPreview() {
    const btn = document.getElementById('emb-push-shopworks-btn');
    if (!btn || btn.disabled || !_pushQuoteId) return;

    const modal = document.getElementById('emb-sw-push-modal');
    const statusEl = document.getElementById('emb-sw-push-status');
    const previewEl = document.getElementById('emb-sw-push-preview');
    const confirmBtn = document.getElementById('emb-sw-push-confirm');
    if (!modal || !previewEl || !confirmBtn) return;

    if (statusEl) statusEl.innerHTML = '';
    previewEl.innerHTML = '<div style="padding:24px; text-align:center; color:#64748b;">' +
        '<i class="fas fa-spinner fa-spin"></i> Loading preview…</div>';
    confirmBtn.disabled = true;
    confirmBtn.style.display = '';
    confirmBtn.dataset.force = 'false';
    confirmBtn.innerHTML = '<i class="fas fa-upload"></i> Push to ShopWorks';
    modal.classList.add('active');

    // P2-16 (audit 2026-06-06): focus management for the load-bearing push-confirm modal — remember the
    // opener, move focus into the modal, trap Tab inside it, and close on Escape (a11y; stops focus leaking
    // to the page behind the modal).
    // eslint-disable-next-line no-restricted-syntax -- focus-return handle for the push modal (documented seam)
    window._pushModalOpener = document.activeElement;
    setTimeout(() => { try { const f = modal.querySelector('button:not([disabled])'); if (f) f.focus(); } catch (_) {} }, 0);
    if (!modal._embKeyBound) {
        modal._embKeyBound = true;
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); closePushPreview(); return; }
            if (e.key !== 'Tab') return;
            const f = Array.from(modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null);
            if (!f.length) return;
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        });
    }

    try {
        const apiBase = window.APP_CONFIG.API.BASE_URL;
        const resp = await fetch(`${apiBase}/api/embroidery-push/preview/${encodeURIComponent(_pushQuoteId)}`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || data.details || `HTTP ${resp.status}`);
        renderPushPreview(data);
        if (data.alreadyPushed) {
            confirmBtn.dataset.force = 'true';
            confirmBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Push Again (creates duplicate)';
        }
        confirmBtn.disabled = false;
    } catch (err) {
        console.error('[Embroidery] Preview error:', err);
        previewEl.innerHTML = '<div class="preview-warnings"><h5><i class="fas fa-exclamation-triangle"></i> ' +
            'Could not load preview</h5><ul><li>' + escapeHtml(err.message) + '</li></ul></div>';
    }
}

// Render the preview modal body from the /preview response.
function renderPushPreview(data) {
    const previewEl = document.getElementById('emb-sw-push-preview');
    const statusEl = document.getElementById('emb-sw-push-status');
    if (!previewEl) return;
    const o = data.orderJson || {};
    const lines = Array.isArray(o.LinesOE) ? o.LinesOE : [];

    if (data.alreadyPushed && statusEl) {
        statusEl.innerHTML = '<div class="preview-warnings"><h5><i class="fas fa-exclamation-triangle"></i> ' +
            'Already pushed to ShopWorks</h5><ul><li>This quote was pushed' +
            (data.pushedAt ? ' on ' + escapeHtml(String(data.pushedAt)) : '') +
            '. Pushing again will create a DUPLICATE order.</li></ul></div>';
    }

    let html = '<div class="preview-grid">';
    html += '<div class="preview-item"><div class="preview-item-label">ShopWorks ExtOrderID</div>' +
        '<div class="preview-item-value">' + escapeHtml(data.extOrderId || '') + '</div></div>';
    html += '<div class="preview-item"><div class="preview-item-label">Customer #</div>' +
        '<div class="preview-item-value">' + escapeHtml(String(o.id_Customer || '')) +
        (o.ExtCustomerID ? ' <span style="color:#94a3b8;">(ext ' + escapeHtml(String(o.ExtCustomerID)) + ')</span>' : '') +
        '</div></div>';
    html += '<div class="preview-item"><div class="preview-item-label">Contact</div>' +
        '<div class="preview-item-value">' +
        (escapeHtml(((o.ContactNameFirst || '') + ' ' + (o.ContactNameLast || '')).trim()) || '—') + '</div></div>';
    html += '<div class="preview-item"><div class="preview-item-label">Line items / Designs</div>' +
        '<div class="preview-item-value">' + lines.length + ' lines · ' + (data.designCount || 0) + ' design(s)</div></div>';
    html += '</div>';

    html += '<div class="preview-products"><h5>Line items (' + lines.length + ')</h5>';
    html += '<div class="preview-products-list">';
    if (lines.length === 0) {
        html += '<div class="preview-product-item"><span class="preview-product-desc">No line items</span></div>';
    } else {
        for (const ln of lines) {
            const meta = [escapeHtml(ln.Color || ''), escapeHtml(ln.Size || '')].filter(Boolean).join(' · ');
            html += '<div class="preview-product-item">' +
                '<span class="preview-product-style">' + escapeHtml(ln.PartNumber || '') + '</span>' +
                '<span class="preview-product-desc">' + escapeHtml(ln.Description || '') + (meta ? ' — ' + meta : '') + '</span>' +
                '<span class="preview-product-qty">×' + escapeHtml(String(ln.Qty || '')) + ' @ $' + escapeHtml(String(ln.Price || '')) + '</span>' +
                '</div>';
        }
    }
    html += '</div></div>';

    // [B3] (P2-11, audit 2026-06-06): render the Designs so the rep SEES the artwork/logo before pushing
    // (catches a wrong/missing/duplicate design). Handles Branch-1 {id_Design} (existing, linked in SW) and
    // Branch-2 {DesignName, Locations[].ImageURL} (new artwork upload).
    const designs = Array.isArray(o.Designs) ? o.Designs : [];
    if (designs.length) {
        html += '<div class="preview-products"><h5>Designs (' + designs.length + ')</h5><div class="preview-products-list">';
        for (const d of designs) {
            if (d.id_Design && !d.DesignName) {
                html += '<div class="preview-product-item"><span class="preview-product-desc">Existing design #' + escapeHtml(String(d.id_Design)) + ' (linked in ShopWorks)</span></div>';
                continue;
            }
            const locs = Array.isArray(d.Locations) ? d.Locations : [];
            const thumb = (locs.find(l => l && l.ImageURL) || {}).ImageURL;
            html += '<div class="preview-product-item">' +
                (thumb ? '<img src="' + escapeHtml(thumb) + '" alt="" style="width:40px;height:40px;object-fit:contain;border:1px solid #e2e8f0;border-radius:4px;margin-right:8px;">' : '') +
                '<span class="preview-product-desc">' + escapeHtml(d.DesignName || '(unnamed)') + ' · ' + escapeHtml(String(locs.length)) + ' location(s)</span>' +
                '</div>';
        }
        html += '</div></div>';
    }

    const warnings = [];
    if ((data.designCount || 0) === 0) {
        warnings.push('No design linked — a sales rep must assign the design manually in ShopWorks.');
    }
    // [B4] (P2-4, audit 2026-06-06): surface any fee the transformer demoted to an order Note instead of a
    // billable line, so the rep catches an under-bill before push. Transformer (audit 2026-06-10) emits one
    // "UNBILLED FEE — add manually: …" / "UNBILLED ITEM [type] — add manually: …" note per skipped fee;
    // the legacy comma-joined "Order notes: <fees>" blob is still matched for old pushes.
    for (const n of (Array.isArray(o.Notes) ? o.Notes : [])) {
        const t = String(n.Note || '');
        if (/^UNBILLED (FEE|ITEM)/i.test(t)) warnings.push(t);
        else if (/^Order notes:/i.test(t)) warnings.push('Fee sent as a note (not a billable line): ' + t.replace(/^Order notes:\s*/i, ''));
    }
    if (warnings.length > 0) {
        html += '<div class="preview-warnings"><h5><i class="fas fa-exclamation-triangle"></i> Heads up</h5><ul>';
        for (const w of warnings) html += '<li>' + escapeHtml(w) + '</li>';
        html += '</ul></div>';
    }

    // Surface the manual tax step (the push intentionally sends TaxTotal:0; the rate + account live in the
    // Notes On Order) so the rep knows to set tax in ShopWorks after import. (audit #11 2026-06-05)
    const oNotes = Array.isArray(o.Notes) ? o.Notes : [];
    // Pull the tax lines the transformer wrote (buildSalesTaxNote): "Tax Rate: X%", "Tax Account: C — D",
    // "Tax: DO NOT APPLY (out of state)", "Apply Tax: Manually in ShopWorks". Covers in-state, out-of-state,
    // and needs-review cases.
    const taxLines = oNotes.map(n => String(n.Note || '')).filter(t => /^(Tax Rate:|Tax Account:|Tax Amount:|Tax: |Apply Tax:|Rep:|State:)/i.test(t));  // +Rep:/State:/Tax Amount: so needs-review + out-of-state instructions surface (review C36)
    if (taxLines.length) {
        html += '<div class="preview-warnings preview-manual-tax"><h5><i class="fas fa-info-circle"></i> After import — set tax in ShopWorks</h5><ul>' +
            taxLines.map(t => '<li>' + escapeHtml(t.trim()) + '</li>').join('') +
            '</ul></div>';
    }

    previewEl.innerHTML = html;
}

// Perform the actual push (POST /push-quote). force=true re-pushes an
// already-pushed quote (creates a duplicate) — only set after the rep confirms.
export async function confirmPushToShopWorks() {
    const confirmBtn = document.getElementById('emb-sw-push-confirm');
    const statusEl = document.getElementById('emb-sw-push-status');
    if (!_pushQuoteId || !confirmBtn) return;
    const force = confirmBtn.dataset.force === 'true';

    // [B5] (audit 2026-06-06): defense-in-depth — never silently re-push an already-pushed quote unless the
    // rep explicitly armed the duplicate button (force). Belt-and-suspenders behind the showPushButton lock.
    if (_pushAlreadyDone && !force) {
        showToast('Already sent to ShopWorks this session — use the "Push Again (creates duplicate)" button if you really mean to.', 'warning');
        return;
    }

    const origHtml = confirmBtn.innerHTML;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pushing…';

    try {
        const apiBase = window.APP_CONFIG.API.BASE_URL;
        const response = await fetch(`${apiBase}/api/embroidery-push/push-quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quoteId: _pushQuoteId, isTest: false, force }),
        });
        const data = await response.json();

        if (!response.ok) {
            if (response.status === 409) {
                // Caspio says already pushed — offer a guarded force re-push.
                if (statusEl) {
                    statusEl.innerHTML = '<div class="preview-warnings"><h5><i class="fas fa-exclamation-triangle"></i> ' +
                        'Already pushed</h5><ul><li>This quote was already pushed' +
                        (data.pushedAt ? ' on ' + escapeHtml(String(data.pushedAt)) : '') +
                        '. Click again to push a DUPLICATE.</li></ul></div>';
                }
                confirmBtn.dataset.force = 'true';
                confirmBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Push Again (creates duplicate)';
                confirmBtn.disabled = false;
                return;
            }
            throw new Error(data.error || data.details || `HTTP ${response.status}`);
        }

        // The push endpoint only confirms the order reached ManageOrders STAGING
        // (MO returns "...has been uploaded"). ShopWorks OnSite imports asynchronously
        // on its own download cycle, and that conversion can fail SILENTLY — an unmapped
        // size, an invalid customer/design #, etc. — leaving an order MO accepted but
        // OnSite never created. So we no longer claim "Pushed to ShopWorks" off the ack;
        // we report "Sent to ManageOrders" and verify the REAL OnSite import via
        // getorderno. (EMB-2026-269 false-success — MO said uploaded, OnSite never
        // imported it — 2026-06-02.)
        _pushAlreadyDone = true;
        updatePushButtonState();
        const extId = data.extOrderId || _pushQuoteId;
        if (statusEl) {
            statusEl.innerHTML = '<div class="shopworks-import-preview active" style="background:#eff6ff; border-color:#bfdbfe;">' +
                '<h4><i class="fas fa-paper-plane"></i> Sent to ManageOrders</h4>' +
                '<div class="preview-item-value">Uploaded as <strong>' + escapeHtml(extId) + '</strong> · ' +
                escapeHtml(String(data.lineItemCount || 0)) + ' line items · ' +
                escapeHtml(String(data.designCount || 0)) + ' design(s).</div>' +
                '<div style="margin-top:10px; color:#475569;">ShopWorks imports new orders on its own download cycle — ' +
                'confirm it actually landed in OnSite:</div>' +
                '<div id="emb-sw-import-result" style="margin-top:8px; font-size:0.92em;"></div>' +
                '<button type="button" id="emb-sw-verify-btn" style="margin-top:8px; padding:6px 12px; background:#1a5276; ' +
                'color:#fff; border:none; border-radius:6px; cursor:pointer;">' +
                '<i class="fas fa-magnifying-glass"></i> Verify in ShopWorks</button></div>';
            const vbtn = document.getElementById('emb-sw-verify-btn');
            if (vbtn) vbtn.addEventListener('click', () => verifyShopWorksImport(extId));
            // Initial check — usually still "pending" right after a push, which is the
            // honest state to show instead of a premature green check.
            verifyShopWorksImport(extId);
        }
        confirmBtn.style.display = 'none';
        showToast(`Sent to ManageOrders as ${extId} — verify ShopWorks import`, 'success');

    } catch (error) {
        console.error('[Embroidery] Push error:', error);
        if (statusEl) {
            statusEl.innerHTML = '<div class="preview-warnings"><h5><i class="fas fa-exclamation-triangle"></i> ' +
                'Push failed</h5><ul><li>' + escapeHtml(error.message) + '</li></ul></div>';
        }
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = origHtml;
        showToast(`Push failed: ${error.message}`, 'error');
    }
}

// Verify an order ACTUALLY imported into ShopWorks OnSite — not just that
// ManageOrders accepted the upload. getorderno queries OnSite's real orders by
// ExtOrderID: a non-empty result means OnSite created the order. Empty means
// it's either still pending OnSite's import cycle OR the MO→OnSite conversion
// failed (unmapped size, invalid customer/design #). This is the check that was
// missing when EMB-2026-269 reported success but never reached ShopWorks
// (2026-06-02). Uses APP_CONFIG.API.BASE_URL per the no-hardcoded-URL rule.
export async function verifyShopWorksImport(extOrderId) {
    const out = document.getElementById('emb-sw-import-result');
    if (!extOrderId || !out) return;
    out.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking ShopWorks…';
    try {
        const apiBase = window.APP_CONFIG.API.BASE_URL;
        const resp = await fetch(`${apiBase}/api/manageorders/getorderno/${encodeURIComponent(extOrderId)}`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || data.details || `HTTP ${resp.status}`);
        const row = Array.isArray(data.result) && data.result.length ? data.result[0] : null;
        const orderNo = row ? (row.id_Order || row.ID_Order || row) : null;
        if (orderNo) {
            out.innerHTML = '<span style="color:#15803d; font-weight:600;"><i class="fas fa-check-circle"></i> ' +
                'Confirmed in ShopWorks — order #' + escapeHtml(String(orderNo)) + '</span>';
        } else {
            out.innerHTML = '<span style="color:#b45309;"><i class="fas fa-exclamation-triangle"></i> ' +
                '<strong>Not in ShopWorks yet.</strong> ManageOrders accepted the upload, but OnSite has not ' +
                'imported it. OnSite pulls new orders periodically — wait a few minutes and click ' +
                '“Verify in ShopWorks” again. If it never appears, the MO→OnSite conversion failed ' +
                '(commonly an unmapped size or an invalid customer/design #) — check the ManageOrders ' +
                'conversion log for this order.</span>';
        }
    } catch (err) {
        out.innerHTML = '<span style="color:#b45309;"><i class="fas fa-exclamation-triangle"></i> ' +
            'Could not verify ShopWorks import: ' + escapeHtml(err.message) + '. Try again shortly.</span>';
    }
}

export function closePushPreview() {
    const modal = document.getElementById('emb-sw-push-modal');
    if (modal) modal.classList.remove('active');
    // P2-16: restore focus to whatever opened the modal (a11y — focus must not vanish to <body>).
    try { if (window._pushModalOpener && window._pushModalOpener.focus) window._pushModalOpener.focus(); } catch (_) {}
}
