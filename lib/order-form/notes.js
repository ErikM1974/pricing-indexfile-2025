// Order submission stage. Behavior covered by order-form-submit-contract.test.js.
module.exports = function createOrderNotes({ fetch, SYNC_PROXY_BASE }) {
    // Cache sales-tax accounts to avoid hitting the proxy on every submit.
    // The frontend's /api/tax-rates/lookup
    // returns this same data + the rate at once, but if it ever fails to populate
    // ship.taxAccount, this server-side fallback prevents the order from landing
    // in ShopWorks's generic "2200" parent account (which AR doesn't reconcile).
    //
    // TTL: 1 hour. The Caspio table changes ~never (WA DOR adjusts rates quarterly).
    // ============================================================================
    let _taxAccountsCache = null;
    let _taxAccountsCacheAt = 0;
    let _taxAccountsInFlight = null;
    const TAX_ACCOUNTS_TTL_MS = 60 * 60 * 1000;

    async function ensureTaxAccountsCache() {
        const fresh = _taxAccountsCache && Date.now() - _taxAccountsCacheAt < TAX_ACCOUNTS_TTL_MS;
        if (fresh) return _taxAccountsCache;
        if (_taxAccountsInFlight) return _taxAccountsInFlight;
        _taxAccountsInFlight = (async () => {
            try {
                const r = await fetch(`${SYNC_PROXY_BASE}/api/tax-rates`);
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const json = await r.json();
                const data = Array.isArray(json?.data) ? json.data : [];
                _taxAccountsCache = data.filter(
                    (a) => a.Active === 'Yes' && Number.isFinite(Number(a.Tax_Rate))
                );
                _taxAccountsCacheAt = Date.now();
                console.log(
                    `[tax-accounts] cache refreshed: ${_taxAccountsCache.length} active accounts`
                );
                return _taxAccountsCache;
            } catch (e) {
                console.warn(
                    '[tax-accounts] cache refresh failed (will serve stale or empty):',
                    e.message
                );
                return _taxAccountsCache || [];
            } finally {
                _taxAccountsInFlight = null;
            }
        })();
        return _taxAccountsInFlight;
    }

    /**
     * Look up the rate-specific GL account from the cached sales_tax_accounts_2026
     * table. Matches `Tax_Rate` (decimal, e.g. 0.102 = 10.2%) with 0.0001 tolerance
     * to absorb float-rounding. Returns null when no match within ±0.5%.
     */
    function findTaxAccountByRate(rateDecimal) {
        if (!Number.isFinite(rateDecimal) || rateDecimal <= 0) return null;
        const accounts = _taxAccountsCache || [];
        if (accounts.length === 0) return null;
        const exact = accounts.find((a) => Math.abs(Number(a.Tax_Rate) - rateDecimal) < 0.0001);
        if (exact) {
            return { account: String(exact.Account_Number), accountName: exact.Account_Name };
        }
        // No exact match — find closest within 0.5% tolerance (handles DOR rates
        // that aren't on the standard 0.1% grid, e.g. 10.05%).
        let closest = null;
        for (const a of accounts) {
            const diff = Math.abs(Number(a.Tax_Rate) - rateDecimal);
            if (diff < 0.005 && (!closest || diff < closest.diff)) {
                closest = { a, diff };
            }
        }
        if (closest) {
            console.warn(
                `[tax-accounts] no exact match for rate=${rateDecimal} — closest ${closest.a.Tax_Rate} (acct ${closest.a.Account_Number})`
            );
            return {
                account: String(closest.a.Account_Number),
                accountName: closest.a.Account_Name,
            };
        }
        return null;
    }

    // Notes On Order is the SINGLE most-glanced field in ShopWorks for the rep
    // reviewing an order. Per Erik (2026-05-20): strip everything that's already
    // in a structured ShopWorks field — Order ID is the External ID field,
    // timestamp is Date Order Placed, company is the Customer header — and keep
    // ONLY the tax-application instructions, which Erik applies manually after
    // each order arrives (because the integration's hardcoded Tax_10.1 default (⚠️ Erik: bump ShopWorks integration to Tax_10.2/2200.102)
    // would mis-label non-Milton-pickup orders).
    //
    // 4 possible blocks:
    //   1. Pickup (always Milton, 10.2%)            -> APPLY: 2200.102
    //   2. In-WA shipping (DOR destination lookup)  → APPLY: matched Caspio account
    //   3. Out-of-state shipping                    → DO NOT APPLY
    //   4. No tax info available (defensive)        → FLAG: needs rep review
    function buildOrderNote({ info, breakdown, ship, extOrderId, printLocations }) {
        // M1 reverted 2026-05-22: Notes On Order is the primary tab CSR/AR/Production
        // all scan. Keep operational + financial in one place, one fact per line.
        // Tax block lives here (was briefly on Notes To Accounting under M1).
        const lines = [];

        // 0. Customer Warning (Erik 2026-05-23): if the customer record in
        // CompanyContactsMerge2026 has a Customer_Warning flag (e.g. "DO NOT
        // EXTEND CREDIT", "REQUIRES PREPAY"), surface it as the FIRST line so
        // AR sees it before doing anything else. The client passes it through
        // info.customerWarning (originally via the Order Form company picker).
        const cw = String(info?.customerWarning || '').trim();
        if (cw) {
            lines.push(`CUSTOMER WARNING: ${cw}`);
        }

        // 1. Print Locations — Erik's #1 thing he scans for in ShopWorks (2026-05-20).
        const locsClean = String(printLocations || '').trim();
        if (locsClean) {
            lines.push(`Print Locations: ${locsClean}`);
        }

        // 2. Tax block — subtotal / shipping / rate / amount / total / account, one per line.
        const subtotal = Number(breakdown?.subtotal) || 0;
        // [2026-06-09] DTG Phase 2 — billed shipping is TAXABLE in WA (WAC 458-20-110), so the
        // taxable base is (subtotal + shipping) and the total includes it even when tax doesn't
        // apply (wholesale/exempt/out-of-state). Defaults to 0 → unchanged for the React Order
        // Form (which doesn't send breakdown.shipping). breakdown.taxEstimate is ALREADY computed
        // on (subtotal+shipping) by the DTG frontend, so we only add the Shipping line + base/total.
        const shipping = Number(breakdown?.shipping) || 0;
        const taxAmount = Number(breakdown?.taxEstimate) || 0;
        const taxRate = Number(ship?.taxRate) || 0;
        const taxableBase = subtotal + shipping;
        const total = taxableBase + taxAmount;

        const isPickup =
            ship &&
            (ship.method === 'Customer Pickup' ||
                ship.method === 'pickup' ||
                ship.method === 'willcall');
        const shState = String(ship?.state || info?.state || '').toUpperCase();
        const isOutOfState = !isPickup && shState && shState !== 'WA';

        // Wholesale / reseller (WA reseller permit on file) → no tax, GL 2203. HIGHEST
        // priority — matches recomputeTaxRate's ordering (wholesale wins over exempt /
        // out-of-state / pickup), so a wholesale customer with an out-of-state ship-to
        // still books to 2203, not 2202. (2026-06-08 Phase 1 Chunk D — DTG/EMB/SCP/DTF)
        if (info?.isWholesale) {
            lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
            if (shipping > 0) lines.push(`Shipping: $${shipping.toFixed(2)}`);
            lines.push(`Tax: DO NOT APPLY (wholesale / reseller)`);
            lines.push(`Tax Account: 2203 — Wholesale Sales (WA reseller permit)`);
            lines.push(
                `Reason: Customer marked Wholesale / reseller — sale for resale, no retail tax`
            );
            lines.push(`Total: $${taxableBase.toFixed(2)} (no tax)`);
            return lines;
        }

        // Tax-exempt customer (cert on file) → short-circuit
        if (info?.isTaxExempt) {
            const cert = info.taxExemptNumber || '(no cert # on file)';
            lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
            if (shipping > 0) lines.push(`Shipping: $${shipping.toFixed(2)}`);
            lines.push(`Tax: EXEMPT — DO NOT APPLY`);
            lines.push(`Cert #: ${cert}`);
            lines.push(`Tax Account: 2204 — Tax Exempt`);
            lines.push(`Reason: Customer marked Tax Exempt in CompanyContactsMerge2026`);
            lines.push(`Total: $${taxableBase.toFixed(2)} (no tax)`);
            return lines;
        }

        // Out-of-state shipping → no tax (WAC 458-20-193)
        if (isOutOfState) {
            lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
            if (shipping > 0) lines.push(`Shipping: $${shipping.toFixed(2)}`);
            lines.push(`Tax: DO NOT APPLY (out of state)`);
            lines.push(`State: ${shState}`);
            lines.push(`Tax Account: 2202 — Out of State Sales`);
            lines.push(`Reason: WAC 458-20-193 (no nexus on out-of-state delivery)`);
            lines.push(`Total: $${taxableBase.toFixed(2)} (no tax)`);
            return lines;
        }

        // Pickup or in-WA shipping → apply tax. Resolve the rate-specific GL account.
        // Source priority:
        //   1. ship.taxAccount — frontend's /api/tax-rates/lookup result (authoritative)
        //   2. findTaxAccountByRate(taxRate) — server-side lookup from cached
        //      sales_tax_accounts_2026 table (fallback if frontend dropped it)
        //   3. Hardcoded '2200.102' for pickup (Milton, 10.2% as of 2026-07)
        // We DON'T fall through to generic '2200' parent — that would land orders in
        // an unreconciled GL account and confuse AR.
        let taxAccount = ship?.taxAccount;
        let taxAccountName = ship?.taxAccountName;
        if (!taxAccount && taxRate > 0) {
            const lookup = findTaxAccountByRate(taxRate);
            if (lookup) {
                taxAccount = lookup.account;
                taxAccountName = lookup.accountName;
            }
        }
        if (!taxAccount && isPickup) {
            taxAccount = '2200.102'; // Milton pickup — rose to 10.2% (DOR 2026-07-06)
            taxAccountName = '10.20%';
        }

        const ratePct = taxRate > 0 ? (taxRate * 100).toFixed(2) : null;

        if (ratePct && taxAccount) {
            const locationLabel = isPickup
                ? 'Milton pickup — flat'
                : `${ship?.city || 'WA destination'} — DOR lookup`;
            lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
            if (shipping > 0) {
                lines.push(`Shipping (taxable): $${shipping.toFixed(2)}`);
                lines.push(
                    `Taxable Base: $${taxableBase.toFixed(2)} (subtotal + shipping — WAC 458-20-110)`
                );
            }
            lines.push(`Tax Rate: ${ratePct}% (${locationLabel})`);
            lines.push(`Tax Amount: $${taxAmount.toFixed(2)}`);
            lines.push(`Total with Tax: $${total.toFixed(2)}`);
            lines.push(`Tax Account: ${taxAccount} — ${taxAccountName || ratePct + '%'}`);
            lines.push(`Apply Tax: Manually in ShopWorks`);
        } else {
            // No rate / no account resolved — flag for rep review.
            lines.push(`Subtotal: $${subtotal.toFixed(2)}`);
            if (shipping > 0) lines.push(`Shipping (taxable): $${shipping.toFixed(2)}`);
            lines.push(`Tax: NEEDS REVIEW`);
            lines.push(`Rep: Confirm destination + apply correct WA rate before invoicing`);
        }

        // 3. Live Quote URL (Erik 2026-05-23) — gives the SW operator a one-click
        // jump back to the customer-facing quote-view (which has the live SW state
        // overlay, the original submission audit panel, all the design info). Saves
        // them looking up the OF# in our system every time they need full context.
        if (extOrderId) {
            lines.push(`Live Quote: https://teamnwca.com/quote/${extOrderId}`);
        }

        // Each line becomes one row in ShopWorks's Notes On Order tab.
        return lines;
    }

    // (buildAccountingNote removed 2026-05-22 — M1 reverted. Tax block now
    // lives inline in buildOrderNote above, where CSR/AR/Production all look.)

    // Returns ARRAY of strings; each becomes its own row in ShopWorks's Notes To
    // Production tab (Erik 2026-05-20).
    function buildProductionNote({ rows, methodNotesBlock }) {
        const lines = [];
        const block = String(methodNotesBlock || '').trim();
        if (block) {
            // The method block is itself a "·"-separated metadata string like
            //   "DTG · Left Chest + Full Back · Tier 1-23 (LTM) · 1 line · 17 combined pieces · Ship: Customer Pickup"
            // Split on " · " so production sees each fact as its own note row.
            for (const piece of block
                .split(' · ')
                .map((s) => s.trim())
                .filter(Boolean)) {
                lines.push(piece);
            }
        }
        // Garment breakdown: one row per (style, color) listing all sizes
        (rows || []).forEach((r) => {
            if (!r || !r.style) return;
            const sizes = r.sizes || {};
            const pairs = Object.keys(sizes)
                .filter((k) => Number(sizes[k]) > 0)
                .map((k) => `${k}×${Number(sizes[k])}`);
            if (pairs.length === 0) return;
            const totalQty = pairs.reduce((s, p) => s + Number(p.split('×')[1] || 0), 0);
            const colorPart = r.colorName ? ` ${r.colorName}` : '';
            lines.push(`${r.style}${colorPart}: ${pairs.join(', ')} (${totalQty} pcs)`);
        });
        return lines;
    }

    // NOTE: buildShippingNote() was removed (2026-05-01). All shipping data is
    // already populated in MO's structured fields:
    //   - ShippingAddresses[]: ShipAddress01/02, ShipCity, ShipState, ShipZip,
    //     ShipCompany, ShipMethod, ShipCountry
    //   - Order-level: date_OrderRequestedToShip, date_OrderDropDead
    // Duplicating in a note created exactly the redundancy Erik flagged.

    // Notes To Purchasing — line-by-line list for the sourcing team to pull
    // from SanMar. One line per (style, color, size) at the qty the rep
    // priced. Prices are intentionally OMITTED here (Erik 2026-05-20) — the
    // weighted-average per-row price shown vs. the authoritative per-size
    // price in LinesOE confused purchasing. The LinesOE block carries the
    // true per-size prices; this note is for what to BUY, not what to charge.
    // Returns ARRAY of strings; each becomes its own row in ShopWorks's Notes To
    // Purchasing tab. ONE row per (style, color, size) so sourcing can scan/check
    // off each line as they pull from SanMar (Erik 2026-05-20).
    function buildPurchasingNote({ rows }) {
        const lines = [];
        (rows || []).forEach((r) => {
            if (!r || !r.style) return;
            const sizes = r.sizes || {};
            Object.keys(sizes).forEach((sz) => {
                const q = Number(sizes[sz]) || 0;
                if (!q) return;
                const colorPart = r.colorName ? ` - ${r.colorName}` : '';
                lines.push(`${r.style}${colorPart} - ${sz} × ${q}`);
            });
        });
        return lines;
    }

    function buildArtNote({ info, files }) {
        const parts = [];
        if (info.artNotes) parts.push(info.artNotes);
        if (Array.isArray(files) && files.length) {
            parts.push(
                files
                    .map((f) => {
                        const placements = (f.placements || []).join(', ');
                        const designNo = f.designNo ? ` (#${f.designNo})` : '';
                        const colors = f.colors ? ` — Colors: ${f.colors}` : '';
                        return `${f.name || 'file'}${designNo}: ${placements}${colors}`;
                    })
                    .join('\n')
            );
        }
        return parts.join('\n\n');
    }

    return async function buildNotes({
        info,
        breakdown,
        ship,
        extOrderId,
        printLocations,
        rows,
        methodNotesBlock,
        files,
    }) {
        // --- Notes (4-way split, all targeting separate ShopWorks tabs) ---
        // Each block lands on a different ShopWorks screen for a different role.
        // Verified against the live order #141671 notes UI (Erik's screenshots).
        //
        //   Notes On Order        → CSR/AR header: order audit, CRM Customer ID, tax account
        //   Notes To Production   → production team: stitch/location + garment breakdown
        //   Notes To Purchasing   → sourcing team: line-by-line PN + color + size + price
        //   Notes To Art          → art team (only when rep added art notes or files)
        //
        // ShopWorks's API only accepts these 9 note types: Notes On Order,
        // Notes To Art, Notes To Purchasing, Notes To Subcontract, Notes To
        // Production, Notes To Receiving, Notes To Shipping, Notes To Accounting,
        // Notes On Customer (new customers only). "Notes On Packing List" is NOT
        // a valid type — packing-slip output is a ShopWorks template concern,
        // not a note type. Pushing it caused the proxy's note validator to
        // reject the entire array.
        //
        // NOT sent (intentional — already in MO structured fields):
        //   - Shipping (ShippingAddresses[], date_OrderRequestedToShip, date_OrderDropDead)
        //   - Contact info (Contact*, CustomerPurchaseOrder, CustomerServiceRep)
        // Notes builders now return ARRAYS of strings — push each as a separate
        // notesBlocks entry so ShopWorks displays them as distinct rows in the
        // corresponding Notes tab. Erik (2026-05-20): "the notes need to come in
        // as separate line items in the notes section". One note row per fact
        // beats one row crammed with multi-line text.
        const notesBlocks = [];
        const pushArray = (type, arr) => {
            for (const note of Array.isArray(arr) ? arr : [arr]) {
                if (note && String(note).trim()) {
                    notesBlocks.push({ type, note: String(note).trim() });
                }
            }
        };

        // Pre-warm the sales_tax_accounts_2026 cache so buildOrderNote can do
        // server-side rate→account resolution if the frontend dropped ship.taxAccount.
        // Fire-and-forget — note builder handles cache-miss gracefully (falls back
        // to hardcodes for pickup/OOS, NEEDS REVIEW otherwise).
        await ensureTaxAccountsCache().catch(() => {});

        // Server-side authoritative resolution: if frontend didn't capture the
        // GL account (DOR API hiccup, frontend bug), look it up from Caspio by
        // rate so we never push generic '2200' parent account by mistake.
        if (!ship.taxAccount && Number(ship.taxRate) > 0) {
            const lookup = findTaxAccountByRate(Number(ship.taxRate));
            if (lookup) {
                ship.taxAccount = lookup.account;
                ship.taxAccountName = lookup.accountName;
                console.log(
                    `[submit] tax account auto-resolved by rate ${ship.taxRate} → ${ship.taxAccount}`
                );
            }
        }

        // Notes On Order — primary tab CSR/AR/Production all read. Includes
        // print locations + full tax block (subtotal/rate/amount/total/account/apply).
        // M1 (2026-05-21) briefly split tax into Notes To Accounting; reverted
        // 2026-05-22 because most users scan Notes On Order first.
        pushArray(
            'Notes On Order',
            buildOrderNote({ info, breakdown, ship, extOrderId, printLocations })
        );
        pushArray('Notes To Production', buildProductionNote({ rows, methodNotesBlock }));
        pushArray('Notes To Purchasing', buildPurchasingNote({ rows }));

        if (info.artNotes || (Array.isArray(files) && files.length)) {
            // Art note remains a single multi-line entry for now (file links + colors
            // belong together for the art team's review). Refactor to array if Erik
            // asks later.
            const artNote = buildArtNote({ info, files });
            if (artNote) notesBlocks.push({ type: 'Notes To Art', note: artNote });
        }
        return notesBlocks;
    };
};
