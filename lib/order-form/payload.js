// Order submission stage. Behavior covered by order-form-submit-contract.test.js.
// Sales-rep slug → full name. Clients of /api/submit-order-form (today the
// DTG builder; originally the retired Order Form) send a lowercase login
// slug ("taneisha") as the value because that's the legacy convention. ShopWorks's CustomerServiceRep field displays
// whatever string we send verbatim, so without translation the rep shows
// up as "taneisha" instead of "Taneisha Clark". Mapping is kept here
// (server-side) instead of changing the dropdown value because saved
// drafts in the Caspio quote_sessions table already use slugs — flipping
// the dropdown values would orphan those drafts.
//
// Note: 'ruth' slug → 'Ruthie Nhoung' to match ShopWorks's Employee record
// (ID 24). The form's dropdown LABEL also says "Ruthie Nhoung" but the
// internal slug stays 'ruth' for back-compat with saved drafts.
const SALES_REP_FULL_NAMES = {
    nika: 'Nika Lao',
    taneisha: 'Taneisha Clark',
    erik: 'Erik Mickelson',
    ruth: 'Ruthie Nhoung',
    jim: 'Jim Mickelson',
};

// Sales-rep slug → ShopWorks Employee ID for id_EmpCreatedBy on the
// order. Per Erik's screenshot of ShopWorks Employees (2026-05-02):
//   Jim Mickelson      = 1
//   Erik Mickelson     = 2
//   Ruthie Nhoung      = 24
//   Nika Lao           = 169
//   Taneisha Clark     = 281
// Unknown rep falls back to 2 (Erik) so orders never land on Employee 0.
const SALES_REP_EMP_IDS = {
    jim: 1,
    erik: 2,
    ruth: 24,
    nika: 169,
    taneisha: 281,
};
const toISODate = (d) => {
    if (!d) return '';
    const s = String(d).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); // already YYYY-MM-DD
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // MM/DD/YYYY → YYYY-MM-DD
    if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    return s; // unknown shape — pass through (better than swallowing)
};
// (Erik's screenshots, 2026-05-02). The earlier CSV had every ID wrong
// except none — all six methods were sending to the wrong production
// queue. Caught after OF-0027 sent id_OrderType=5 and ShopWorks
// displayed "Digital Printing" instead of the expected "Embroidery".
//
//   21 = Custom Embroidery       (account 4050 Custom Embroidered Sales)
//   13 = Screen Print Subcontract (account 4200 Subcontract Screenprinted Sales)
//   5  = Digital Printing         (account 4001 Digital Printing Sales)
//   18 = Transfers                (account 4005 Transfer Sales)
//   41 = Laser/Ad Specialties     (account 4400 Ad Specialty Sales)
//   7  = Emblem                   (account 4002 Emblem Sales)
//   6  = Online Store fallback    (account 4003) — only used when no method selected
//
// Per Erik (2026-05-02): order types CANNOT be mixed in ShopWorks, so
// an order has exactly one decoration method. We use methodsUsed[0]
// and let the form's UI guard against multi-method submissions.
const ORDER_TYPE_ID = { embroidery: 21, screenprint: 13, dtg: 5, dtf: 18, sticker: 41, emblem: 7 };
const ORDER_TYPE_DEFAULT = 6; // Online Store — fallback when no method picked
function buildManageOrdersPayload(
    {
        info,
        extOrderId,
        methodNotesBlock,
        rows,
        lineItems,
        designs,
        attachments,
        ship,
        notesBlocks,
        methodsUsed,
    },
    { NWCA_LOCATIONS }
) {
    // Build the order Description field — populates ShopWorks's
    // Order Information > Description (visible in order list views).
    // Format: "EMBROIDERY · Left Chest · 8,000 stitches" — gives ShopWorks
    // staff a method-at-a-glance summary without opening the order.
    const orderDescription =
        String(methodNotesBlock || '')
            .split('\n')[0] // first line of method block
            .trim() ||
        (rows && rows.length ? `Order — ${rows.length} line${rows.length === 1 ? '' : 's'}` : '');

    // --- Canonical camelCase payload — same shape proxy's manageorders-push-client expects ---
    const manageOrdersPayload = {
        orderNumber: extOrderId,
        customerPurchaseOrder: info.po || extOrderId,
        // Order-level Description — ShopWorks shows this in the order header.
        description: orderDescription,
        customer: {
            company: info.company || '',
            // CRM Customer ID — proxy can use this as ExtCustomerID for repeat-
            // customer matching in ShopWorks (Forma Construction always lands
            // on the same customer record across multiple orders).
            companyId: info.companyId || '',
            firstName: info.buyerFirst || '',
            lastName: info.buyerLast || '',
            email: info.email || '',
            phone: info.phone || '',
        },
        lineItems,
        designs,
        attachments,
        // Shipping block. Two cases (Erik 2026-05-20, refined later same day):
        //
        // (1) Customer Pickup: send the block with NWCA Milton as the address,
        //     ShipAddress01 = "Customer Pickup" as a marker. Earlier we tried
        //     omitting the block entirely for pickup orders, but that left
        //     ShopWorks's order header with no Ship Method — production +
        //     AR reports lost track of these orders. The "Customer Pickup"
        //     marker in ShipAddress01 makes it unambiguous to anyone reading
        //     the order that this isn't a real ship-to. The city/state/zip
        //     are NWCA's actual location so the order has a valid address
        //     for filtering/reporting.
        //
        // (2) Shipping (UPS Ground / Priority Mail / Other): send the real
        //     ship-to address the rep typed in the ship-to block.
        shipping:
            ship.method === 'pickup' ||
            ship.method === 'willcall' ||
            ship.method === 'Customer Pickup'
                ? {
                      // Customer Pickup — ships to NWCA Milton location.
                      // Uses NWCA_LOCATIONS.milton so the address lives in one place.
                      // ShipAddress01 is overridden to "Customer Pickup" as a visible
                      // marker on ShopWorks / packing slips.
                      company: NWCA_LOCATIONS.milton.company,
                      firstName: '',
                      lastName: '',
                      address1: 'Customer Pickup',
                      address2: '',
                      city: NWCA_LOCATIONS.milton.city,
                      state: NWCA_LOCATIONS.milton.state,
                      zip: NWCA_LOCATIONS.milton.zip,
                      country: NWCA_LOCATIONS.milton.country,
                      method: 'Customer Pickup',
                  }
                : {
                      company: info.company || '',
                      firstName: info.buyerFirst || '',
                      lastName: info.buyerLast || '',
                      // NWCA shipping convention (from the OF ship-to block):
                      //   line 1 = recipient name ("Wendy Mickelson")
                      //   line 2 = street address ("14805 75th Street Ct East")
                      // Bug history: address2 was previously hard-coded to '' so the
                      // actual street never reached ShopWorks (WO 141899 landed with
                      // only the recipient name in ShipAddress01). Erik 2026-05-21.
                      address1: ship.address || info.address || '',
                      address2: ship.address2 || info.address2 || '',
                      city: ship.city || info.city || '',
                      state: ship.state || info.state || '',
                      zip: ship.zip || info.zip || '',
                      country: 'USA',
                      // ShipMethod: frontend now sends ShopWorks-canonical names directly
                      // ('UPS Ground' / 'Priority Mail'). Translate legacy codes for
                      // backward-compat; pass through anything else verbatim.
                      method:
                          ship.method === 'ups'
                              ? 'UPS Ground'
                              : ship.method === 'other'
                                ? 'Other'
                                : ship.method || 'UPS Ground',
                  },
        billing: {
            company: info.company || '',
            address1: info.address || '',
            address2: '',
            city: info.city || '',
            state: info.state || '',
            zip: info.zip || '',
            country: 'USA',
        },
        notes: notesBlocks,
        // Rush flag (Erik 2026-05-23): was hardcoded false. info.isRush comes
        // from the explicit RUSH checkbox in the order form (audit fix L4
        // 2026-05-21). Used by SW to prioritize in the production queue.
        rushOrder: !!info.isRush,
        // Tax: ALWAYS send 0. (2026-05-20 — see memory/wa-sales-tax-rules.md)
        //
        // Background: the ShopWorks ManageOrders integration is configured with
        // hardcoded Tax Line Item = "Tax_10.1" and Tax Account = "2200.101".
        // Those defaults stamp ALL orders pulled by the integration regardless
        // of payload — there's no per-order override. Sending TaxTotal: $X
        // would auto-create a tax line with the right dollar amount but the
        // WRONG label and GL account for non-Milton destinations (e.g. a Seattle
        // 10.35% order would show as "City of Milton Sales Tax 10.1%" in
        // ShopWorks's books).
        //
        // Erik's chosen workflow: send TaxTotal: 0, no auto-tax-line gets
        // created, Erik manually applies the correct tax line in ShopWorks
        // using the structured Notes On Order block (see buildOrderNote above)
        // which carries the Caspio account number + rate + dollar amount the
        // rep saw at quote time. The customer-facing quote (in the form preview)
        // still shows the correct tax — only the ShopWorks push omits it.
        taxTotal: 0,
        // [2026-06-09] DTG Phase 2 — billed shipping. ship.fee carries the rep's charge
        // (0 for pickup — the frontend's effectiveShipFee() zeroes it). Was hardcoded 0
        // back when the DTG form never billed shipping (UPS cost treated as COGS). The
        // customer-facing tax/total still live in the quote-view + Notes On Order block;
        // OnSite sums line items + cur_Shipping for the order, tax applied manually.
        cur_Shipping: Number(ship?.fee) || 0,
        totals: {
            subtotal: 0,
            rushFee: 0,
            salesTax: 0,
            shipping: Number(ship?.fee) || 0,
            grandTotal: 0,
        },
        payments: [],
        // Source/sales-rep fields — the proxy maps CustomerServiceRep → ShopWorks CSR.
        // SALES_REP_FULL_NAMES translates the form's dropdown slug
        // ("taneisha") to the canonical full name ("Taneisha Clark") that
        // ShopWorks displays. Falls back to whatever's in info.salesRep so
        // unknown values pass through (better than swallowing them).
        extSource: 'NWCA-OrderForm',
        salesRep: SALES_REP_FULL_NAMES[info.salesRep] || info.salesRep || '',
        // Payment terms — one of: "Prepaid" (default) | "Pay On Pickup"
        terms: info.terms || 'Prepaid',
        // Proxy expects camelCase names matching manageorders-push-client: orderDate, requestedShipDate, dropDeadDate
        // Dates (2026-05-20 — Erik split dueDate from dropDeadDate).
        //   orderDate          = today (rep can override via info.dateIn)
        //   requestedShipDate  = production due date — auto-calc from qty in
        //                         frontend (≤24 pcs → 5 BDs, >24 → 10 BDs) OR
        //                         rep-overridden value. Maps to ShopWorks's
        //                         "Req. Ship Date" field.
        //   dropDeadDate       = customer's hard deadline (event/photoshoot).
        //                         Optional — empty when customer has no event.
        //                         Maps to ShopWorks's "Drop Dead Date" field.
        //   Previously both fields shared info.dateDue, which incorrectly
        //   shoved "today" into ShopWorks's Drop Dead column on every order.
        orderDate: toISODate(info.dateIn) || new Date().toISOString().slice(0, 10),
        requestedShipDate:
            toISODate(info.dateDue || info.dateIn) || new Date().toISOString().slice(0, 10),
        dropDeadDate: toISODate(info.dropDeadDate),
        // Customer routing — when the rep picked a known company from
        // autocomplete, info.companyId carries the real ShopWorks id_Customer
        // (e.g. 1276 for Aaberg's Rentals). Falls back to 2791 (catch-all
        // "Online Order Form Customer") for brand-new typed names.
        idCustomer: Number(info.companyId) || 2791,
        // Employee Created By — maps the picked Sales Rep to their ShopWorks
        // Employee ID so the order header says "created by Taneisha" not
        // "created by Erik". Fallback 2 (Erik) for unknown reps.
        idEmpCreatedBy: SALES_REP_EMP_IDS[info.salesRep] || 2,
        // OrderType per the order's decoration method. Per Erik (2026-05-02)
        // ShopWorks doesn't allow mixed order types, so an order has one
        // method. We take methodsUsed[0]; if the form UI ever lets a
        // multi-method order through, the first method wins (better than
        // misrouting everything to a generic default).
        idOrderType: ORDER_TYPE_ID[methodsUsed[0]] || ORDER_TYPE_DEFAULT,
        // APISource MUST equal the single consolidated "Manage Orders" ShopWorks
        // integration's filter value ("ManageOrders") — that integration imports ONLY
        // orders whose APISource matches it exactly; a blank value is silently skipped.
        // Uniform with the quote-builder / 3-Day-Tees / Inksoft pushes (all "ManageOrders"
        // as of 2026-06-04). The proxy's transformOrder also forces this value, so this
        // is belt-and-suspenders. (Erik 2026-06-04: "ManageOrders" on everything we push.)
        apiSource: 'ManageOrders',
    };
    return manageOrdersPayload;
}
module.exports = { buildManageOrdersPayload };
