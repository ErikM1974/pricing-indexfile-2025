/**
 * DTG inline form — output module (Batch 5, 2026-07-09). Moved VERBATIM from the
 * dtg-inline-form.js IIFE; lexical references became the imports below.
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions).
/* global alert,
   emailQuote, markAsSaved, EmbroideryInvoiceGenerator */
import { effectiveLocationCode, effectiveLocationLabel, isRowColorInvalid, updateSubmitEnabled } from './form-core.js';
import { clearSessionState, getQuoteID } from './persistence.js';
import { computePriceQuoteFromState } from './pricing.js';
import { API_BASE, LOCATION_LABELS, SUBMIT_URL, state } from './state.js';
import { effectiveShipFee } from './tax-shipping.js';
import { escapeHtml, fmtMoney, isPickupMethod, isoDate, repByCode, shipLabel, showToastSafe } from './utils.js';

// ----- Submit ------------------------------------------------------------
// Walk every row's sizes against its row.inventory and collect any
// size+qty combos that exceed available stock. Returns [] when stock
// is OK or unknown (no false alarms). Matches the order form's
// submit-time stock check pattern.
export function collectStockIssues() {
    const issues = [];
    for (const row of state.rows) {
        if (!row.style || !row.color) continue;
        const inv = row.inventory || { bySize: {}, status: 'unknown' };
        if (inv.status !== 'ok') continue; // no data → don't false-alarm
        for (const [size, qtyRaw] of Object.entries(row.sizes || {})) {
            const qty = Number(qtyRaw) || 0;
            if (qty <= 0) continue;
            const available = Number(inv.bySize[size]);
            if (!Number.isFinite(available)) continue; // missing data for this size
            if (qty > available) {
                issues.push({
                    style: row.style,
                    color: row.color,
                    size,
                    qty,
                    available,
                });
            }
        }
    }
    return issues;
}

// Generic confirm-modal helper used by both A3 (design # soft warning)
// and C9 (chat-form overwrite warning). Promise resolves true on proceed,
// false on cancel/Esc/backdrop-click. Buttons take string labels;
// proceedClass controls the proceed-button color (default amber/warn).
export function genericConfirm({ icon, title, body, cancelLabel, proceedLabel, proceedClass }) {
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.className = 'dtg-stock-confirm-backdrop';
        backdrop.setAttribute('role', 'dialog');
        backdrop.setAttribute('aria-modal', 'true');
        // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
        backdrop.innerHTML = `
            <div class="dtg-stock-confirm-modal" role="document">
                <div class="dscm-head">
                    <span class="dscm-head-icon" aria-hidden="true">${escapeHtml(icon || '⚠')}</span>
                    <h3 class="dscm-title">${escapeHtml(title)}</h3>
                </div>
                <p class="dscm-body">${body /* trusted — caller controls */}</p>
                <div class="dscm-actions">
                    <button type="button" class="dscm-btn dscm-btn-cancel" data-action="cancel">${escapeHtml(cancelLabel || 'Cancel')}</button>
                    <button type="button" class="dscm-btn ${proceedClass || 'dscm-btn-proceed'}" data-action="confirm">${escapeHtml(proceedLabel || 'Proceed')}</button>
                </div>
            </div>
        `;
        function cleanup(result) {
            document.removeEventListener('keydown', onKey);
            backdrop.remove();
            resolve(result);
        }
        function onKey(e) { if (e.key === 'Escape') cleanup(false); }
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) cleanup(false); });
        backdrop.querySelector('[data-action="cancel"]').addEventListener('click', () => cleanup(false));
        backdrop.querySelector('[data-action="confirm"]').addEventListener('click', () => cleanup(true));
        document.addEventListener('keydown', onKey);
        document.body.appendChild(backdrop);
        backdrop.querySelector('[data-action="cancel"]').focus();
    });
}

// Show the stock-confirm modal. Returns a Promise that resolves to true
// (proceed) or false (cancel). Backdrop click / Escape / Cancel = false.
export function confirmStockOverflow(issues) {
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.className = 'dtg-stock-confirm-backdrop';
        backdrop.setAttribute('role', 'dialog');
        backdrop.setAttribute('aria-modal', 'true');

        const itemsHtml = issues.map((it) => `
            <li class="dscm-item">
                <span class="dscm-style">${escapeHtml(it.style)}</span>
                <span class="dscm-color">${escapeHtml(it.color || '(no color)')}</span>
                <span class="dscm-size">${escapeHtml(it.size)} × ${it.qty}</span>
                <span class="dscm-stock">${it.available.toLocaleString()} in stock</span>
            </li>
        `).join('');

        // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
        backdrop.innerHTML = `
            <div class="dtg-stock-confirm-modal" role="document">
                <div class="dscm-head">
                    <span class="dscm-head-icon" aria-hidden="true">⚠</span>
                    <h3 class="dscm-title">Stock check</h3>
                </div>
                <p class="dscm-body">
                    ${issues.length === 1 ? '1 size exceeds' : `${issues.length} sizes exceed`}
                    SanMar's current stock. May need backorder, drop-ship, or
                    extended lead time. Push to ShopWorks anyway?
                </p>
                <ul class="dscm-list">${itemsHtml}</ul>
                <div class="dscm-actions">
                    <button type="button" class="dscm-btn dscm-btn-cancel" data-action="cancel">Cancel</button>
                    <button type="button" class="dscm-btn dscm-btn-proceed" data-action="confirm">Proceed anyway</button>
                </div>
            </div>
        `;

        function cleanup(result) {
            document.removeEventListener('keydown', onKey);
            backdrop.remove();
            resolve(result);
        }
        function onKey(e) { if (e.key === 'Escape') cleanup(false); }

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) cleanup(false);
        });
        backdrop.querySelector('[data-action="cancel"]').addEventListener('click', () => cleanup(false));
        backdrop.querySelector('[data-action="confirm"]').addEventListener('click', () => cleanup(true));
        document.addEventListener('keydown', onKey);

        document.body.appendChild(backdrop);
        // Focus the "Cancel" button by default — safer than auto-confirming.
        backdrop.querySelector('[data-action="cancel"]').focus();
    });
}

// ========================================================================
// Phase 11.4 (2026-05-24) — DTG Print Quote
// Opens a PDF-quality invoice from the current form state in a new
// window for the rep to print/save. Mirrors EMB/DTF/SCP printQuote()
// pattern using the shared EmbroideryInvoiceGenerator class.
// No saved quote required — works from current in-memory state.
// ========================================================================
export async function dtgPrintQuote() {
    try {
        if (typeof EmbroideryInvoiceGenerator === 'undefined') {
            alert('Print is unavailable — invoice generator not loaded. Please refresh and try again.');
            return;
        }

        // Collect line items from current state
        const cleanLines = state.rows.filter(r => r.style && r.color && Object.keys(r.sizes || {}).length > 0);
        if (cleanLines.length === 0) {
            alert('Add at least one product with a size before printing.');
            return;
        }

        // Trigger a fresh price calculation so the invoice reads current numbers
        const priceQuote = computePriceQuoteFromState();
        if (!priceQuote || !Array.isArray(priceQuote.lineItems) || priceQuote.lineItems.length === 0) {
            alert('Could not compute pricing. Make sure all rows have a style + color + at least one filled size.');
            return;
        }

        // Build invoice data structure (matches what EmbroideryInvoiceGenerator expects).
        // DTG doesn't use per-logo locations; the print location is shared across rows.
        // Build products in the CANONICAL shape the shared generator's size
        // matrix requires: { product:{style,title,color}, lineItems:[{description,
        // quantity, unitPrice, total}] }. The old flat shape (no lineItems[]) threw
        // a TypeError at generateSizeMatrixTable (pp.lineItems.length) so Print
        // produced no PDF at all. Group each row's sizes by unit price so base
        // sizes share a line and upcharged extended sizes (2XL+) get their own. (2026-06-01)
        const invoiceProducts = priceQuote.lineItems.map(li => {
            const sizes = li.sizes || {};
            const pbs = li.priceBySize || {};
            const groups = {};
            for (const [szRaw, qRaw] of Object.entries(sizes)) {
                const q = Number(qRaw) || 0; if (q <= 0) continue;
                const sz = String(szRaw).toUpperCase();
                const up = Number(pbs[sz]);
                // A size with no per-size price (absent from _priceBySize) was EXCLUDED
                // from the on-screen total (updateLivePrices skips it). Skip it here too
                // so the printed PDF total matches the screen — don't price an
                // unavailable size at the weighted-average fallback. (2026-06-01)
                if (isNaN(up)) continue;
                const price = up;
                const key = price.toFixed(2);
                (groups[key] = groups[key] || { price, parts: [], qty: 0 });
                groups[key].parts.push(`${sz}(${q})`);
                groups[key].qty += q;
            }
            let lineItems = Object.keys(groups)
                .sort((a, b) => parseFloat(a) - parseFloat(b))
                .map(k => {
                    const g = groups[k];
                    return { description: g.parts.join(' '), quantity: g.qty, unitPrice: g.price, total: Math.round(g.price * g.qty * 100) / 100 };
                });
            if (lineItems.length === 0) {
                const totalQty = Object.values(sizes).reduce((s, q) => s + (Number(q) || 0), 0);
                lineItems = [{ description: Object.entries(sizes).map(([s, q]) => `${s}(${q})`).join(' '), quantity: totalQty, unitPrice: Number(li.finalUnitPrice) || 0, total: Number(li.lineTotal) || 0 }];
            }
            return {
                product: { style: li.style || '', title: li.description || `${li.style} ${li.color}`.trim(), color: li.color || '' },
                lineItems,
            };
        });
        // Recompute the subtotal from the rendered line items so the printed
        // lines reconcile exactly to the printed total.
        const invoiceSubtotal = Math.round(invoiceProducts.reduce((s, p) =>
            s + p.lineItems.reduce((ss, li) => ss + (Number(li.total) || 0), 0), 0) * 100) / 100;

        // [2026-06-09] Phase 2 — billed shipping. The shared generator taxes preTaxSubtotal
        // and renders the Shipping row + closing Subtotal as the breakdown of it; the FIRST
        // "Subtotal:" row uses grandTotal (products only). So: grandTotal = products,
        // preTaxSubtotal = products + fee (the TAXED base → shipping is taxed in WA),
        // shippingFee = fee (the display row). Pickup → effectiveShipFee() = 0 (no change).
        const shipFee = effectiveShipFee();
        const preTaxWithShip = Math.round((invoiceSubtotal + shipFee) * 100) / 100;
        // Contract derives isDTG from method, normalizes tax, and zero-fills
        // any fee fields not set here (artCharge, rushFee, discount, etc.).
        const pricingData = window.QuotePricingData.buildPricingData({
            method: 'DTG',
            quoteId: getQuoteID() || `DTG-PREVIEW-${Date.now()}`,
            // printLocation feeds generateDTGSpecs.
            printLocation: { front: effectiveLocationCode() },
            tier: priceQuote.tier || 'Standard',
            totalQuantity: priceQuote.combinedQuantity || 0,
            products: invoiceProducts,
            subtotal: invoiceSubtotal,
            // DTG amortizes LTM INTO the per-piece price (_priceBySize), so it is
            // already in every line total — don't add a separate LTM line/double-count.
            ltmFee: 0,
            ltmDistributed: true,
            grandTotal: invoiceSubtotal,
            preTaxSubtotal: preTaxWithShip,
            taxRate: Number(state.shipping?.taxRate) || 0,
            shippingFee: shipFee
        });

        const customerData = {
            name: [state.customer?.firstName, state.customer?.lastName].filter(Boolean).join(' ') || 'Customer',
            company: state.customer?.company || '',
            email: state.customer?.email || '',
            phone: state.customer?.phone || '',
            salesRepEmail: state.customer?.salesRepEmail || 'sales@nwcustomapparel.com',
        };

        const generator = new EmbroideryInvoiceGenerator();
        const invoiceHTML = generator.generateInvoiceHTML(pricingData, customerData);
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Pop-up blocker stopped the print window. Allow pop-ups for this page and try again.');
            return;
        }
        // eslint-disable-next-line no-unsanitized/method -- audited (Batch 5 move): invoice HTML from the shared EmbroideryInvoiceGenerator (trusted, same pattern as the other 3 builders)
        printWindow.document.write(invoiceHTML);
        printWindow.document.close();

        // Wait for fonts/images to settle before triggering the print dialog.
        setTimeout(() => {
            try { printWindow.print(); } catch (_) { /* user can press Ctrl+P manually */ }
        }, 400);
    } catch (e) {
        console.error('[DTG Print] Error:', e);
        alert('Print failed: ' + (e.message || 'unknown error'));
    }
}

// ========================================================================
// Phase 11.5 (2026-05-24) — DTG Email Quote
// Sends customer a link to the saved quote via the shared emailQuote()
// helper (EmailJS service/template come from TENANT config). Requires a
// saved quote (aiState.savedQuoteID populated by chat panel's "Save &
// share link" button). Surfaces a clear "save first" message if not.
// ========================================================================
export async function dtgEmailQuote() {
    const savedId = (window.aiState && window.aiState.savedQuoteID) || null;
    if (!savedId) {
        alert(
            'Save the quote first before emailing.\n\n' +
            'Open the chat panel (✨ Ask button) and click "Save & share link" — that gives the quote an ID. ' +
            'Then come back here and click Email Quote.'
        );
        return;
    }

    const customerEmail = (state.customer?.email || '').trim();
    if (!customerEmail) {
        alert('Customer email is required. Fill in the email field in the customer panel and try again.');
        return;
    }

    if (typeof emailQuote !== 'function') {
        alert('Email helper not loaded. Please refresh and try again.');
        return;
    }

    const customerName =
        [state.customer?.firstName, state.customer?.lastName].filter(Boolean).join(' ').trim() ||
        state.customer?.company ||
        'Customer';

    await emailQuote({
        quoteId: savedId,
        customerEmail,
        customerName,
        salesRepEmail: state.customer?.salesRepEmail || 'sales@nwcustomapparel.com',
    });
}

// D1 split (2026-07-09): the payload assembly moved VERBATIM out of
// submitToShopWorks into the three helpers below (explicit params; the
// orchestrator keeps preflight + the authoritative-pricing fetch).
function buildSubmitRows(items, code, pricing) {
    // 2) Build the order-form-shaped payload

    const rows = items.map((it, i) => ({
        id: `dtg-row-${i + 1}`,
        style: it.styleNumber || it.style || '',
        desc: it.description || `${it.styleNumber || ''} ${it.color || ''}`.trim(),
        color: it.color || '',
        colorName: it.color || '',
        catalogColor: (state.rows.find((r) => r.style === it.styleNumber && r.color === it.color)?.catalogColor) || '',
        imageUrl: '',
        sizes: it.sizes || {},
        deco: 'dtg',
        rowDecoConfig: { method: 'dtg', locationCode: it.locationCode || code },
        price: Number(it.finalUnitPrice) || 0,
        priceOverride: false,
        manualMode: false,
        manualCost: '',
    }));

    const byRow = {};
    items.forEach((it, i) => {
        byRow[`dtg-row-${i + 1}`] = {
            unitPriceBySize: (it.lineSizes || []).reduce((m, s) => { m[s.size] = s.finalUnit; return m; }, {}),
            rowSubtotal: Number(it.lineTotal) || 0,
            tier: it.tier || pricing.tier,
        };
    });
    return { rows, byRow };
}

function computeSubmitMoney(items, pricing) {
    const subtotal = Number(pricing.subtotal) || items.reduce((s, it) => s + (Number(it.lineTotal) || 0), 0);
    const ltmTotal = items.reduce((s, it) => s + (Number(it.ltmPerUnit) || 0) * (Number(it.totalQuantity) || 0), 0);
    // Tax — derive ONLY from state.shipping.taxRate (recomputeTaxRate is the single
    // authority: it already zeroes the rate for out-of-state / exempt / wholesale /
    // opt-out, sets the manual rate, and uses the DOR rate in-WA / 0.102 pickup).
    // [2026-06-08] Phase 1 Chunk D fix — REMOVED the redundant out-of-state guard that
    // re-zeroed tax here: it desynced the push from screen/saved/PDF when a rep set a
    // MANUAL rate on an out-of-state ship-to (manual outranks out-of-state in the authority,
    // so screen/saved showed the manual rate but the push booked $0). Push now == screen.
    const taxRate = Number(state.shipping.taxRate);
    // [2026-06-09] Phase 2 — billed shipping (taxable in WA) enters the push tax base too,
    // so the ShopWorks order + Notes On Order foot to the same total the rep saw on screen.
    // effectiveShipFee() is 0 for pickup. server.js maps ship.fee → cur_Shipping and
    // breakdown.shipping → the Notes "Shipping (taxable)" line + taxable base.
    const shipFee = effectiveShipFee();
    const taxBase = Math.round((subtotal + shipFee) * 100) / 100;
    const taxEstimate = Math.round(taxBase * (Number.isFinite(taxRate) ? taxRate : 0) * 100) / 100;
    const grandTotal = Math.round((taxBase + taxEstimate) * 100) / 100;
    return { subtotal, ltmTotal, taxRate, shipFee, taxEstimate, grandTotal };
}

function buildSubmitBody(ctx) {
    const { pricing, items, rows, byRow, rep, shipMethodLabel, isPickup,
        subtotal, ltmTotal, taxRate, shipFee, taxEstimate, grandTotal } = ctx;
    const body = {
        info: {
            company: state.customer.company || '',
            buyer: `${state.customer.firstName} ${state.customer.lastName}`.trim(),
            buyerFirst: state.customer.firstName || '',
            buyerLast: state.customer.lastName || '',
            buyerEmail: state.customer.email || '',
            email: state.customer.email || '',
            companyName: state.customer.company || '',
            companyId: state.customer.companyId || '',
            phone: state.customer.phone || '',
            // Customer's purchase order # — passes through as the order's
            // CustomerPurchaseOrder field in ShopWorks. Falls back to the
            // OF-NNNN extOrderId on the backend when not provided.
            po: state.customer.po || '',
            // Order schedule. dateIn = today (order placed). dateDue =
            // production-ready date (auto from qty unless rep overrode).
            // dropDeadDate = customer's hard event deadline (optional).
            // Backend maps dateDue → requestedShipDate, dropDeadDate →
            // dropDeadDate. ISO strings YYYY-MM-DD; proxy reformats to
            // MM/DD/YYYY for OnSite.
            dateIn: isoDate(new Date()),
            dateDue: state.scheduling.dueDate || '',
            dropDeadDate: state.scheduling.dropDeadDate || '',
            // Billing state — flows from the picked contact's
            // company_contacts_2026.State so the OF push endpoint can
            // branch tax logic on it (out-of-state customers get 0 tax
            // even if a ship-to wasn't filled in).
            state: state.customer.state || '',
            city: state.customer.city || '',
            designNumber: state.customer.designNumber || null, // A3 — nullable
            // New-artwork design name (Erik 2026-05-20). Required when
            // files are uploaded; server.js uses it to set Designs[0].name
            // (which becomes ShopWorks's DesignName for the new design).
            // Empty/undefined when rep picked an existing Design # instead.
            newDesignName: (state.newArtwork.designName || '').trim(),
            salesRep: rep.name,
            salesRepEmail: rep.email,
            terms: state.customer.terms || 'Prepaid',
            paymentTerms: state.customer.terms || 'Prepaid',
            taxable: true,
            // [2026-06-08] Phase 1 Chunk D — flow the tax-status flags so server.js
            // buildOrderNote renders the right Notes On Order block. Wholesale →
            // GL 2203 (no tax); exempt → DO NOT APPLY. ship.taxAccount already carries
            // 2203/2204/2202, but buildOrderNote branches on these info.* flags.
            isWholesale: !!(state.customer && state.customer.isWholesale),
            isTaxExempt: !!(state.customer && state.customer.isTaxExempt),
            taxExemptNumber: (state.customer && state.customer.taxExemptNumber) || '',
            quoteId: getQuoteID() || '',
        },
        rows,
        ship: {
            method: state.shipping.method, // canonical: ups / pickup / willcall / other
            methodLabel: shipMethodLabel,
            sameAsBilling: !!isPickup, // pickup uses billing as the "ship-to"
            isPickup,
            // Ship-to address (only populated when method !== 'pickup').
            address: isPickup ? '' : (state.shipping.address1 || ''),
            address2: isPickup ? '' : (state.shipping.address2 || ''),
            city: isPickup ? '' : (state.shipping.city || ''),
            state: isPickup ? '' : (state.shipping.state || ''),
            zip: isPickup ? '' : (state.shipping.zip || ''),
            // Tax rate the rep saw at submit time (for audit trail in
            // notes — the actual TaxTotal is sent as 0; Erik applies the
            // tax line manually in ShopWorks per the Notes On Order
            // block).
            taxRate: Number.isFinite(taxRate) ? taxRate : 0,
            taxRateSource: state.shipping.taxRateSource || '',
            taxAccount: state.shipping.taxAccount || '',
            taxAccountName: state.shipping.taxAccountName || '',
            // [2026-06-09] Phase 2 — billed shipping charge → server.js cur_Shipping
            // (was hardcoded 0). 0 for pickup (effectiveShipFee zeroes it).
            fee: shipFee,
        },
        orderNotes: `DTG quote — ${items.length} line${items.length === 1 ? '' : 's'} · ${pricing.combinedQuantity} combined pcs · tier ${pricing.tier}${isPickup ? ' · CUSTOMER PICKUP' : ''}`,
        // New-artwork files (Erik 2026-05-20). When rep uploaded artwork
        // for a brand-new design, each file becomes one entry here. The
        // server.js Designs[] builder reads files[].hostedUrl + .placements
        // and emits a Designs[] entry without id_Design → ShopWorks
        // creates a new design from the metadata. Empty array when rep
        // picked an existing Design # instead.
        files: (state.newArtwork.files || []).map(f => ({
            hostedUrl: f.hostedUrl,
            placements: [f.placement || (LOCATION_LABELS[state.front] || 'Left Chest')],
            colors: '',                // DTG = full-color CMYK, no ink-color tracking
            designNo: '',              // not a real design # — this IS the new design
            name: f.fileName,
        })),
        decoConfig: { method: 'dtg' },
        breakdown: {
            supported: true,
            byRow,
            totalQty: Number(pricing.combinedQuantity) || 0,
            tier: pricing.tier,
            subtotal: Math.round(subtotal * 100) / 100,
            // [2026-06-09] Phase 2 — billed shipping. server.js buildOrderNote reads this
            // for the "Shipping (taxable)" Notes line + the taxable base = subtotal+shipping.
            shipping: shipFee,
            ltmTotal: Math.round(ltmTotal * 100) / 100,
            taxEstimate,
            depositDue: 0,
            grandTotal,
            fees: [],
            errors: [],
        },
        methodNotesBlock: `DTG · ${effectiveLocationLabel()} · Tier ${pricing.tier} · ${items.length} line${items.length === 1 ? '' : 's'} · ${pricing.combinedQuantity} combined pieces · Ship: ${shipMethodLabel}`,
        // Surface the print location(s) as a dedicated field so the
        // server's buildOrderNote() can include a "Print Locations:" line
        // at the top of Notes On Order — Erik scans this in ShopWorks
        // before opening the order details.
        printLocations: effectiveLocationLabel(),
        designNumbers: state.customer.designNumber ? [state.customer.designNumber] : [],
        addOns: [],
    };
    return body;
}

export async function submitToShopWorks() {
    const statusEl = document.getElementById('dtgSubmitStatus');
    const setStatus = (cls, msg) => {
        if (!statusEl) return;
        statusEl.className = `dtg-submit-status ${cls}`;
        // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
        statusEl.innerHTML = msg;
        statusEl.hidden = false;
    };

    // Build lines array
    const code = effectiveLocationCode();
    const cleanLines = state.rows
        // Exclude invalid-color rows so the push matches the on-screen total /
        // PDF / saved record (the four other consumers all skip these). Without
        // it, a row with an unmatched catalog color could reach the server
        // re-price + land in ShopWorks with a blank color. (2026-06-09)
        .filter((r) => r.style && r.color && !isRowColorInvalid(r) && Object.keys(r.sizes || {}).length > 0)
        .map((r) => ({ styleNumber: r.style, color: r.color, sizes: { ...r.sizes } }));
    if (!code || cleanLines.length === 0) {
        setStatus('error', 'Need a location + at least one filled row.');
        return;
    }
    if (!state.customer.email) {
        setStatus('error', 'Need customer email before pushing.');
        return;
    }

    // A3 — Design # soft warning. Submit is no longer hard-blocked when the
    // design # is empty. Instead we confirm with the rep, then push with
    // designNumber: null. Rep adds the design # directly in ShopWorks
    // after the art team assigns one.
    //
    // SKIP the warning when rep has uploaded new artwork (Erik 2026-05-20)
    // — that path INTENTIONALLY pushes without an existing design # because
    // ShopWorks will create the new design from the upload metadata.
    const hasUploadedArt = (state.newArtwork?.files || []).length > 0;
    if (!state.customer.designNumber && !hasUploadedArt) {
        const proceedNoDesign = await genericConfirm({
            icon: '🎨',
            title: 'No design # entered',
            body: 'The art team can assign one in ShopWorks after you push. The order will be created with no Design ID and the rep can add it manually. Push anyway?',
            cancelLabel: 'Cancel',
            proceedLabel: 'Push without design #',
            proceedClass: 'dscm-btn-proceed',
        });
        if (!proceedNoDesign) {
            setStatus('error', 'Push cancelled — add a design # and try again, or push without one when ready.');
            return;
        }
    }

    // Stock check — if any cell exceeds SanMar inventory, ask the rep
    // to confirm before pushing.
    const stockIssues = collectStockIssues();
    if (stockIssues.length > 0) {
        const proceed = await confirmStockOverflow(stockIssues);
        if (!proceed) {
            setStatus('error', 'Push cancelled — adjust quantities and try again.');
            return;
        }
    }

    // Resolve sales rep from the state.customer.salesRepCode
    const rep = repByCode(state.customer.salesRepCode);
    const shipMethodLabel = shipLabel(state.shipping.method);
    const isPickup = isPickupMethod(state.shipping.method);

    state.submitting = true;
    updateSubmitEnabled();
    setStatus('busy', '<i class="fas fa-circle-notch fa-spin"></i> Pricing + pushing…');

    // 1) Authoritative price via canonical endpoint
    let pricing;
    try {
        const r = await fetch(`${API_BASE}/api/dtg/quote-pricing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locationCode: code, lines: cleanLines }),
        });
        pricing = await r.json();
        if (!r.ok || pricing.error) {
            setStatus('error', `Pricing failed: ${escapeHtml(pricing && pricing.message ? pricing.message : 'HTTP ' + r.status)}`);
            state.submitting = false; updateSubmitEnabled();
            return;
        }
    } catch (err) {
        setStatus('error', `Pricing failed: ${escapeHtml(err.message)}`);
        state.submitting = false; updateSubmitEnabled();
        return;
    }

    // 2) Payload assembly (D1 helpers above — verbatim moves).
    const items = Array.isArray(pricing.lineItems) ? pricing.lineItems : [];
    const { rows, byRow } = buildSubmitRows(items, code, pricing);
    const money = computeSubmitMoney(items, pricing);
    const body = buildSubmitBody({ pricing, items, rows, byRow, rep, shipMethodLabel, isPickup, ...money });
    const { subtotal } = money;

    // B5 — cache for retry. If the push fails, the retry button reuses
    // this exact body so we don't double-fetch pricing.
    state.lastSubmit = { body, pricing, subtotal };

    await postPayloadToShopWorks(body, { subtotal, items });
    state.submitting = false;
    updateSubmitEnabled();
}

// B5 — extracted POST handler so the Retry button can re-call without
// recomputing the payload. Shows a structured error card with
// [Retry] [Copy payload] on failure.
export async function postPayloadToShopWorks(body, ctx) {
    const statusEl = document.getElementById('dtgSubmitStatus');
    const setStatus = (cls, msg) => {
        if (!statusEl) return;
        statusEl.className = `dtg-submit-status ${cls}`;
        // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
        statusEl.innerHTML = msg;
        statusEl.hidden = false;
    };
    setStatus('busy', '<i class="fas fa-circle-notch fa-spin"></i> Pushing to ShopWorks…');
    try {
        const r = await fetch(SUBMIT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.success) {
            const id = data.shopWorksId || data.extOrderId;
            setStatus('success',
                `<strong>Pushed to ShopWorks.</strong> Order: <code>${escapeHtml(id || 'submitted')}</code> · ${ctx.items.length} line${ctx.items.length === 1 ? '' : 's'} · $${fmtMoney(ctx.subtotal)}`
            );
            // Clear sessionStorage on success — the rep is done with
            // this quote, next page load starts fresh. Pushed = persisted
            // in ShopWorks, so release the leave-guard too.
            clearSessionState();
            if (typeof markAsSaved === 'function') markAsSaved();
        } else {
            renderRetryCard(setStatus, `HTTP ${r.status}: ${data.error || 'unknown error'}${data.detail ? ' — ' + data.detail : ''}`);
        }
    } catch (err) {
        renderRetryCard(setStatus, `Network error: ${err.message}`);
    }
}

export function renderRetryCard(setStatus, errorMsg) {
    setStatus('error', `
        <div class="dts-error-head"><strong>Push failed.</strong> ${escapeHtml(errorMsg)}</div>
        <div class="dts-error-actions">
            <button type="button" class="dts-retry-btn" data-action="retry"><i class="fas fa-rotate-right"></i> Retry</button>
            <button type="button" class="dts-copy-btn" data-action="copy-payload"><i class="fas fa-copy"></i> Copy payload</button>
        </div>
    `);
    const statusEl = document.getElementById('dtgSubmitStatus');
    if (!statusEl) return;
    statusEl.querySelector('[data-action="retry"]')?.addEventListener('click', async () => {
        if (!state.lastSubmit) {
            setStatus('error', 'No cached payload to retry — please re-click Submit.');
            return;
        }
        state.submitting = true;
        updateSubmitEnabled();
        await postPayloadToShopWorks(state.lastSubmit.body, {
            subtotal: state.lastSubmit.subtotal,
            items: state.lastSubmit.pricing.lineItems || [],
        });
        state.submitting = false;
        updateSubmitEnabled();
    });
    statusEl.querySelector('[data-action="copy-payload"]')?.addEventListener('click', () => {
        if (!state.lastSubmit) return;
        try {
            navigator.clipboard.writeText(JSON.stringify(state.lastSubmit.body, null, 2));
            showToastSafe('Payload copied — paste to support or stash for retry');
        } catch (e) {
            showToastSafe('Clipboard failed — payload in console');
            console.log('[dtg-inline-form] retry payload:', state.lastSubmit.body);
        }
    });
}
