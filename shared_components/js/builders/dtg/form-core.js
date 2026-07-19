/**
 * DTG inline form — form-core module (Batch 5, 2026-07-09). Moved VERBATIM from the
 * dtg-inline-form.js IIFE; lexical references became the imports below.
 */
/* global Node, QuoteOrderSummary, alert, clearQuickQuoteParams, getQuickQuotePrefill,
   history, markAsUnsaved, setupBeforeUnloadGuard, showToast, takeMethodSwitchPrefill,
   */
import { attachNewArtworkUpload } from './artwork.js';
import { attachColorCombobox, attachCompanyCombobox, attachDesignCombobox, attachStyleCombobox, closeDesignLightbox, fuzzyMatchColor, kickInventoryFetch, openDesignLightbox, refreshDesignComboboxForNewCustomer } from './catalog-search.js';
import { applyContact, populateContactPicker, wireHistoryPillHandlers } from './crm.js';
import { dtgEmailQuote, dtgPrintQuote, submitToShopWorks } from './output.js';
import { fillFromQuote, getQuoteID, getState, loadSavedDtgQuoteForEdit, resetForm, restoreStateFromSession, scheduleStateSave, showResumeBanner } from './persistence.js';
import { combinedQty, computePriceQuoteFromState, fetchBundle, findNextTier, renderSummary, schedulePriceUpdate } from './pricing.js';
import { BACK_LOCATIONS, FRONT_LOCATIONS, LOCATION_LABELS, SALES_REPS, SHIP_METHODS, STANDARD_SIZES, _designsCacheByCustomer, dtgIF, state } from './state.js';
import { effectiveShipFee, recomputeTaxRate, syncPickupToggleFromShipMethod, syncShipFeeFromDom } from './tax-shipping.js';
import { clearDirty, computeAutoDueDate, dueDateAutoLabel, escapeHtml, isComboSupported, isPickupMethod, markDirty, parseBulkSizes, sanitizeLocationState, showToastSafe } from './utils.js';

export function newBlankRow() {
    return {
        id: 'r-' + Math.random().toString(36).slice(2, 10),
        style: '',
        styleUpper: '',
        desc: '',
        color: '',         // COLOR_NAME
        catalogColor: '',  // CATALOG_COLOR (for ShopWorks)
        colorSwatch: '',   // small swatch image url
        colorsAvailable: [],
        sizes: {},         // { S: 4, M: 8, ... }
        availableSizes: [],
        // Inventory state populated by kickInventoryFetch() after a style+
        // color pick. Mirrors the order form's row.inventory shape so the
        // sz-inv-badge classes (good/low/over/oos/unknown) work the same.
        inventory: { bySize: {}, status: 'unknown', grandTotal: 0 },
    };
}

export function effectiveLocationCode() {
    if (!state.front) return '';
    if (state.back) return `${state.front}_${state.back}`;
    return state.front;
}

export function effectiveLocationLabel() {
    const code = effectiveLocationCode();
    if (!code) return '—';
    if (code.includes('_')) {
        const parts = code.split('_').map((c) => LOCATION_LABELS[c] || c);
        return parts.join(' + ');
    }
    return LOCATION_LABELS[code] || code;
}

/**
 * Is this row's color valid?
 *
 * A row is INVALID when the rep typed a color the catalog doesn't have:
 *   row.color === "Pink" + row.catalogColor === ""  → invalid
 * vs VALID when the rep picked from the dropdown (which sets both):
 *   row.color === "Jet Black" + row.catalogColor === "Jet Black"
 * OR when the row is partially filled (no style/color yet, mid-typing):
 *   row.color === ""  → not invalid (just incomplete)
 *
 * Used by:
 *   - updateLivePrices() to skip invalid rows in the dollar total
 *   - updateSubmitEnabled() to disable Submit when any row is invalid
 *   - renderTable() to render a red ⚠ warning next to the bad cell
 */
export function isRowColorInvalid(row) {
    if (!row) return false;
    // Empty color is not invalid — just incomplete
    if (!row.color || String(row.color).trim().length === 0) return false;
    // Style not yet picked — color hasn't had a chance to validate
    if (!row.style) return false;
    // colorsAvailable not hydrated yet (still fetching) — defer judgment
    if (!Array.isArray(row.colorsAvailable) || row.colorsAvailable.length === 0) return false;
    // Color is set but no catalogColor → no dropdown match → invalid
    return !row.catalogColor || String(row.catalogColor).trim().length === 0;
}

// ----- Render ------------------------------------------------------------
export function render() {
    const host = document.getElementById('dtgInlineFormMount');
    if (!host) {
        console.warn('[dtg-inline-form] mount point #dtgInlineFormMount not found');
        return;
    }
    // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
    host.innerHTML = `
        <!-- Design thumbnail lightbox (2026-05-20). Click any design thumbnail
             in the form → opens full-size image here. Backdrop / Escape / X
             button close it. Mounted at the top so z-index stacks cleanly. -->
        <div class="dtg-thumb-lightbox" id="dtgThumbLightbox" hidden role="dialog" aria-modal="true" aria-labelledby="dtgThumbLightboxTitle">
            <div class="dtg-thumb-lightbox-backdrop" data-action="close"></div>
            <div class="dtg-thumb-lightbox-panel">
                <button type="button" class="dtg-thumb-lightbox-close" data-action="close" aria-label="Close design preview">
                    <i class="fas fa-times"></i>
                </button>
                <div class="dtg-thumb-lightbox-title" id="dtgThumbLightboxTitle"></div>
                <img id="dtgThumbLightboxImg" alt="" loading="lazy">
            </div>
        </div>
        <div class="dtg-form-wrap">
            <header class="dtg-form-header">
                <div class="dfh-title"><i class="fas fa-clipboard-list"></i> DTG order form</div>
                <div class="dfh-sub">
                    <strong>Every field is editable.</strong> After the AI fills it, you can swap colors, change sizes, add or remove rows, switch print location, or edit the customer/design # — then click Submit. Same canonical pricing as <a href="/pricing/dtg" class="dff-pricing-link">/pricing/dtg</a> and the order form.
                </div>
            </header>
            <!-- Inline resume banner — only shown when restoreStateFromSession()
                 restored a saved state. Empty placeholder otherwise. -->
            <div id="dtgResumeBannerMount"></div>

            <section class="dtg-form-section">
                <div class="dfs-label"><i class="fas fa-print"></i> Print location (shared across all rows)</div>
                <div class="dtg-location-row">
                    <div class="dlr-group">
                        <div class="dlr-group-label">FRONT (pick one)</div>
                        <div class="dlr-options" id="dtgFrontOptions"></div>
                    </div>
                    <div class="dlr-group">
                        <div class="dlr-group-label">BACK (optional)</div>
                        <div class="dlr-options" id="dtgBackOptions"></div>
                    </div>
                    <div class="dtg-location-summary" id="dtgLocationSummary"></div>
                </div>
            </section>

            <div class="dtg-form-body">
                <div class="dtg-rows-pane">
                    <div class="dfs-label" style="margin-bottom:8px;"><i class="fas fa-list"></i> Line items</div>
                    <!-- 2026-05-19: switched from <table> to card-per-line-item
                         so the form fits cleanly in the new sticky right column
                         of the two-column layout. Each card is self-contained:
                         style + color row at top, size grid wrapping below,
                         totals at the bottom. -->
                    <div class="dtg-rows-cards" id="dtgRowsCards"></div>
                    <button type="button" class="dtg-add-row-btn" id="dtgAddRowBtn"><i class="fas fa-plus"></i> Add row</button>

                    <div id="dtgPriceSummary" class="dtg-price-summary"></div>
                    <!-- [2026-06-08] Order-at-a-glance band (Phase 0) — both :empty-hidden until populated by quote-order-summary.js -->
                    <div class="order-recap" id="order-recap"></div>
                    <div class="ship-to-card" id="ship-to-card"></div>
                </div>

                <aside class="dtg-customer-pane dcp-horizontal">
                    <div class="dcp-label"><i class="fas fa-building"></i> Customer + push</div>
                    <div class="dcp-search-label">Search customer</div>
                    <div class="dtg-combobox" id="dtgCompanyCombo">
                        <input type="text" id="dtgCompanyInput" autocomplete="off" placeholder="Company name or contact…">
                    </div>

                    <!-- Curated CRM context banners (Erik 2026-05-23).
                         Populated by renderCustomerContextBadges() after a
                         customer is picked. Hidden when the customer has no
                         warning / no tax exempt / no account tier. -->
                    <div id="dtgCustomerWarning" class="dtg-customer-warning" hidden
                         style="display:flex;align-items:flex-start;gap:10px;background:#fef3c7;border:1px solid #fde68a;border-left:4px solid #d97706;border-radius:4px;padding:10px 14px;margin:8px 0;color:#78350f;font-size:13px;line-height:1.45;"></div>
                    <div class="dcp-chip-row" style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;">
                        <span id="dtgTaxExemptChip" hidden
                              style="display:inline-flex;align-items:center;gap:6px;background:#dcfce7;border:1px solid #bbf7d0;color:#166534;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;"></span>
                        <span id="dtgAccountTierBadge" hidden
                              style="display:inline-flex;align-items:center;gap:6px;background:#e0e7ff;border:1px solid #c7d2fe;color:#3730a3;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;"></span>
                    </div>

                    <!-- Customer history pill (2026-05-20 — Phase 1: info-only).
                         Appears after a customer is picked. Shows aggregated 90-day
                         order patterns from ManageOrders: order count, last order
                         date, usual ship method + terms, last design used, and any
                         backfill suggestions for missing contact data. Does NOT
                         auto-fill any field values — rep clicks "Use this" buttons
                         to apply suggestions explicitly. -->
                    <div class="dcp-history-pill" id="dtgHistoryPill" hidden>
                        <div class="dhp-head" id="dtgHistoryPillHead">
                            <i class="fas fa-clipboard-list"></i>
                            <span class="dhp-summary" id="dtgHistoryPillSummary">Loading customer history…</span>
                            <button type="button" class="dhp-toggle" id="dtgHistoryPillToggle" aria-label="Expand history" aria-expanded="false">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                        </div>
                        <div class="dhp-body" id="dtgHistoryPillBody" hidden></div>
                    </div>

                    <!-- Contact picker — appears after a customer is picked, showing
                         every contact on file at that company so the rep can switch
                         between them (e.g. Aaberg's has Craig Edward, Accounting,
                         and Alexx Bacon). Hidden when no contacts exist. -->
                    <div class="dcp-contact-row" id="dtgContactRow" hidden>
                        <div class="dcp-field-label">
                            <i class="fas fa-user"></i>
                            Contact at this company
                            <span class="dcp-contact-count" id="dtgContactCount"></span>
                        </div>
                        <select id="dtgContactPicker" class="dcp-contact-select">
                            <option value="">— pick a contact —</option>
                        </select>
                    </div>

                    <div class="dcp-divider">Or fill manually</div>

                    <div class="dcp-manual">
                        <div class="dcp-row">
                            <div>
                                <div class="dcp-field-label">First name</div>
                                <input type="text" id="dtgFirstName" aria-label="First name" autocomplete="off">
                            </div>
                            <div>
                                <div class="dcp-field-label">Last name</div>
                                <input type="text" id="dtgLastName" aria-label="Last name" autocomplete="off">
                            </div>
                        </div>
                        <div class="dcp-field-wrap dcp-field-email">
                            <div class="dcp-field-label">Email</div>
                            <input type="email" id="dtgEmail" aria-label="Customer email" autocomplete="off">
                        </div>
                        <div class="dcp-row">
                            <div>
                                <div class="dcp-field-label">Phone</div>
                                <input type="tel" id="dtgPhone" aria-label="Customer phone" autocomplete="off">
                            </div>
                            <div>
                                <div class="dcp-field-label">Company ID (optional)</div>
                                <input type="text" id="dtgCompanyId" autocomplete="off" placeholder="ShopWorks ID">
                            </div>
                        </div>
                        <div class="dcp-field-wrap">
                            <div class="dcp-field-label">Customer PO # <span class="dcp-optional">(optional)</span></div>
                            <input type="text" id="dtgPoNumber" autocomplete="off" placeholder="Customer's purchase order #">
                        </div>
                        <div class="dcp-row">
                            <div>
                                <div class="dcp-field-label">Design # <span class="dcp-optional">(optional)</span></div>
                                <div class="dtg-design-row">
                                    <div class="dtg-combobox" id="dtgDesignCombo" data-combo-kind="design">
                                        <input type="text" id="dtgDesignNumber" autocomplete="off" placeholder="Pick a customer first to see their DTG designs">
                                        <i class="fas fa-caret-down dtg-combobox-chevron" aria-hidden="true"></i>
                                    </div>
                                    <a id="dtgDesignThumbAnchor" class="dtg-design-thumb-anchor" href="#" aria-label="Open design preview" hidden>
                                        <img id="dtgDesignThumbImg" alt="" loading="lazy">
                                        <span class="dtg-design-thumb-zoom" aria-hidden="true">
                                            <i class="fas fa-search-plus"></i>
                                        </span>
                                    </a>
                                </div>
                            </div>
                            <div>
                                <div class="dcp-field-label">
                                    Payment terms
                                    <span id="dtgTermsMapNote" hidden
                                          style="font-size:11px;color:#92400e;font-weight:600;margin-left:6px;"
                                          title="Customer's CRM term mapped to a term NWCA currently offers"></span>
                                </div>
                                <select id="dtgTerms" aria-label="Payment terms">
                                    <option value="Prepaid">Prepaid</option>
                                    <option value="Net 10">Net 10</option>
                                    <option value="Pay On Pickup">Pay On Pickup</option>
                                </select>
                            </div>
                        </div>

                        <!-- ============================================================
                             New-artwork upload block (Erik 2026-05-20).
                             Visible whenever no existing Design # is picked. Rep uploads
                             artwork → file is hosted in Caspio's artwork folder → URL flows
                             to ManageOrders Designs[0].Locations[0].ImageURL → ShopWorks
                             creates a new design record on import. Multiple files allowed
                             (one per print placement).
                             ============================================================ -->
                        <div class="dcp-newart" id="dtgNewArtworkBlock">
                            <div class="dcp-section-head">
                                <i class="fas fa-paint-brush"></i> Or upload new artwork
                                <span class="dcp-newart-sub">No design # yet? Upload the file here.</span>
                            </div>
                            <div class="dcp-field-wrap">
                                <div class="dcp-field-label">
                                    Design name
                                    <span class="dcp-required">required</span>
                                </div>
                                <input type="text" id="dtgNewArtworkName"
                                    autocomplete="off"
                                    placeholder="e.g. Star Sportswear front logo 2026"
                                    value="${escapeHtml(state.newArtwork.designName || '')}">
                                <div class="dcp-field-hint">Used to find this design later in ShopWorks's art library.</div>
                            </div>
                            <div class="dcp-newart-dropzone" id="dtgNewArtworkDropzone" tabindex="0" role="button" aria-label="Upload artwork file">
                                <i class="fas fa-cloud-upload-alt"></i>
                                <div class="dcp-newart-dropzone-msg">
                                    <strong>Drop file here</strong> or <span class="dcp-newart-browse">click to browse</span>
                                </div>
                                <div class="dcp-newart-dropzone-sub">AI / EPS / PSD / PDF / PNG / JPG / TIFF · 20 MB max</div>
                            </div>
                            <input type="file" id="dtgNewArtworkInput" class="dcp-newart-input"
                                accept=".ai,.eps,.pdf,.png,.jpg,.jpeg,.tiff,.tif,.psd,.svg,.webp"
                                multiple
                                hidden>
                            <div class="dcp-newart-list" id="dtgNewArtworkList"></div>
                            <div class="dcp-newart-status" id="dtgNewArtworkStatus"></div>
                        </div>

                        <div class="dcp-row">
                            <div>
                                <div class="dcp-field-label">Sales rep</div>
                                <select id="dtgSalesRep" aria-label="Sales rep">
                                    ${SALES_REPS.map(r => `<option value="${escapeHtml(r.code)}"${state.customer.salesRepCode === r.code ? ' selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <div class="dcp-field-label">Ship method</div>
                                <select id="dtgShipMethod" aria-label="Shipping method">
                                    ${SHIP_METHODS.map(m => `<option value="${escapeHtml(m.code)}"${state.shipping.method === m.code ? ' selected' : ''}>${escapeHtml(m.label)}</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <!-- Schedule section (2026-05-20).
                             Due date auto-calculates from combined qty:
                               ≤24 pcs → 5 business days
                               >24 pcs → 10 business days
                             Rep can override either date. Drop dead optional. -->
                        <div class="dcp-dates">
                            <div class="dcp-section-head">
                                <i class="fas fa-calendar-alt"></i> Schedule
                            </div>
                            <div class="dcp-row">
                                <div>
                                    <div class="dcp-field-label">
                                        Due date <span class="dcp-field-sub">production ready</span>
                                    </div>
                                    <input type="date" id="dtgDueDate" aria-label="Due date" value="${escapeHtml(state.scheduling.dueDate || '')}">
                                    <div class="dcp-date-hint" id="dtgDueDateHint">${escapeHtml(state.scheduling.autoDueDate ? dueDateAutoLabel(combinedQty()) : 'Manual override')}</div>
                                </div>
                                <div>
                                    <div class="dcp-field-label">
                                        Drop dead <span class="dcp-optional">(optional — customer event)</span>
                                    </div>
                                    <input type="date" id="dtgDropDeadDate" aria-label="Drop dead date" value="${escapeHtml(state.scheduling.dropDeadDate || '')}">
                                    <div class="dcp-date-hint">Customer's hard deadline</div>
                                </div>
                            </div>
                        </div>

                        <!-- Customer Pickup toggle (2026-05-20).
                             ON  → hides ship-to fields, sets ShipMethod = Customer Pickup,
                                   tax = 10.2% (Milton, WA flat).
                             OFF → shows ship-to fields, tax = destination lookup if WA
                                   or 0% if out-of-state.
                             Default: ON (matches state.shipping.method = 'Customer Pickup'). -->
                        <div class="dcp-pickup-toggle">
                            <label class="dcp-toggle-label">
                                <input type="checkbox" id="dtgPickupToggle"${isPickupMethod(state.shipping.method) ? ' checked' : ''}>
                                <span class="dcp-toggle-track"><span class="dcp-toggle-thumb"></span></span>
                                <span class="dcp-toggle-text">
                                    <strong>Customer Pickup</strong>
                                    <span class="dcp-toggle-sub">Pickup at NWCA Milton — no shipping address, tax 10.2% flat</span>
                                </span>
                            </label>
                        </div>

                        <!-- Ship-to address block (hidden when pickup is ON).
                             Pre-fills from contact's company address. Override
                             allowed for drop-ships. -->
                        <div class="dcp-shipto" id="dtgShipToBlock"${isPickupMethod(state.shipping.method) ? ' hidden' : ''}>
                            <div class="dcp-shipto-head">
                                <i class="fas fa-truck"></i> Ship to
                                <span class="dcp-shipto-sub">Destination drives the tax rate</span>
                            </div>
                            <div class="dcp-field-wrap">
                                <div class="dcp-field-label">Address line 1</div>
                                <input type="text" id="dtgShipAddress1" autocomplete="off" value="${escapeHtml(state.shipping.address1 || '')}">
                            </div>
                            <div class="dcp-field-wrap">
                                <div class="dcp-field-label">Address line 2 <span class="dcp-optional">(optional)</span></div>
                                <input type="text" id="dtgShipAddress2" autocomplete="off" value="${escapeHtml(state.shipping.address2 || '')}">
                            </div>
                            <div class="dcp-row dcp-row-3">
                                <div>
                                    <div class="dcp-field-label">City</div>
                                    <input type="text" id="dtgShipCity" autocomplete="off" value="${escapeHtml(state.shipping.city || '')}">
                                </div>
                                <div>
                                    <div class="dcp-field-label">State</div>
                                    <input type="text" id="dtgShipState" autocomplete="off" maxlength="2" placeholder="WA" value="${escapeHtml(state.shipping.state || '')}">
                                </div>
                                <div>
                                    <div class="dcp-field-label">ZIP</div>
                                    <input type="text" id="dtgShipZip" autocomplete="off" maxlength="10" value="${escapeHtml(state.shipping.zip || '')}">
                                </div>
                            </div>
                            <div class="dcp-tax-status" id="dtgTaxStatus"></div>
                            <!-- [2026-06-09] Phase 2 — billed shipping charge + UPS-Ground estimator.
                                 Lives INSIDE #dtgShipToBlock (hidden under Customer Pickup) — pickup
                                 orders never bill shipping, so the field is correctly out of reach there
                                 and effectiveShipFee() zeroes any stale value. Shipping is TAXABLE in WA
                                 (WAC 458-20-110) → the fee enters the tax base. The Estimate button calls
                                 the shared global estimateShipping() (quote-order-summary.js). -->
                            <div class="dcp-field-wrap dcp-shipfee-wrap">
                                <div class="dcp-field-label">Shipping charge <span class="dcp-optional">billed to customer · taxable in WA</span></div>
                                <div class="dcp-shipfee-row">
                                    <span class="dcp-shipfee-prefix">$</span>
                                    <input type="number" id="dtgShipFee" step="0.01" min="0" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${Number(state.shipping.fee) > 0 ? Number(state.shipping.fee).toFixed(2) : ''}">
                                    <button type="button" id="dtgEstimateShipBtn" class="dcp-estimate-btn" onclick="estimateShipping()"><i class="fas fa-truck-fast"></i> Estimate UPS Ground</button>
                                </div>
                                <div class="dcp-estimate-result" id="dtgEstimateShipResult"></div>
                            </div>
                        </div>
                        <!-- [2026-06-08] Phase 1 tax controls — include-tax / manual rate / wholesale.
                             MOVED OUT of #dtgShipToBlock (which is hidden when Customer Pickup is ON)
                             so they're reachable for pickup orders too — ~95% of DTG volume, and
                             wholesale/reseller customers are largely the local-pickup crowd.
                             recomputeTaxRate() is the single authority for all three. -->
                        <div class="dtg-tax-controls" id="dtgTaxControls">
                            <label class="dtg-tax-ctl"><input type="checkbox" id="include-tax" ${state.shipping.includeTax !== false ? 'checked' : ''}> Include sales tax</label>
                            <label class="dtg-tax-ctl">Rate <input type="number" id="tax-rate-input" step="0.1" min="0" max="20" placeholder="auto" value="${state.shipping.taxRateOverride != null ? state.shipping.taxRateOverride : ''}"> %</label>
                            <label class="dtg-tax-ctl"><input type="checkbox" id="wholesale-checkbox" ${state.customer.isWholesale ? 'checked' : ''}> Wholesale / reseller — no tax (GL 2203)</label>
                        </div>
                    </div>

                    <!-- Pre-flight readiness panel (2026-05-19). Replaces
                         the old single-line validation banner with a richer
                         checklist showing every item's state (✓ ready,
                         ⚠ warning, ✗ blocker) plus tier-break optimization
                         hints. Click any ⚠ or ✗ item to scroll to / focus
                         the field that needs attention. -->
                    <div id="dtgPreflightPanel" class="dtg-preflight-panel"></div>

                    <button type="button" class="dtg-submit-btn" id="dtgSubmitBtn">
                        <i class="fas fa-upload"></i> Push to ShopWorks
                    </button>
                    <div id="dtgSubmitStatus" class="dtg-submit-status" hidden></div>

                    <!-- Phase 11.4/11.5 (2026-05-24): Print + Email parity with EMB/DTF/SCP.
                         Print works from current state at any time. Email requires a
                         saved quote ID (sets after "Save & share link" in chat panel). -->
                    <div class="dtg-secondary-actions">
                        <!-- [2026-06-08] Phase 1 Chunk C — Save button on the FORM (manual-first
                             parity with EMB/DTF/SCP). Saves the manual quote (with tax/wholesale)
                             to quote_sessions via dtg-quote-page's handleSaveQuote; first click
                             saves, second copies the share link. Manual quotes were previously
                             unsaveable (the chat-panel Save button is hidden without an AI quote). -->
                        <button type="button" class="dtg-secondary-btn" id="dtgSaveBtn" title="Save this quote &amp; get a shareable link">
                            <i class="fas fa-floppy-disk"></i> Save &amp; Get Link
                        </button>
                        <button type="button" class="dtg-secondary-btn" id="dtgPrintBtn" title="Open printable PDF-quality invoice of this quote">
                            <i class="fas fa-print"></i> Print Quote
                        </button>
                        <button type="button" class="dtg-secondary-btn" id="dtgEmailBtn" title="Email this quote link to the customer (save quote first)">
                            <i class="fas fa-envelope"></i> Email Quote
                        </button>
                    </div>
                </aside>
            </div>

            <footer class="dtg-form-foot">
                <span>Canonical pricing — round to $0.50 ceiling. Same numbers as <a href="/pricing/dtg" class="dff-pricing-link">/pricing/dtg</a> + order form.</span>
                <button type="button" class="dff-reset-btn" id="dtgResetBtn">Reset form</button>
            </footer>
        </div>
    `;

    renderLocationPills();
    renderTable();
    renderSummary();
    wireGlobalHandlers();
}

export function renderLocationPills() {
    const frontEl = document.getElementById('dtgFrontOptions');
    const backEl = document.getElementById('dtgBackOptions');
    if (!frontEl || !backEl) return;
    // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
    frontEl.innerHTML = FRONT_LOCATIONS.map((loc) => `
        <button type="button" class="dtg-location-pill${state.front === loc.code ? ' selected' : ''}" data-loc-code="${loc.code}" data-loc-group="front">
            ${escapeHtml(loc.label)}<span class="dim">${escapeHtml(loc.dim)}</span>
        </button>
    `).join('');
    // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
    backEl.innerHTML = `
        <button type="button" class="dtg-location-pill${state.back === '' ? ' selected' : ''}" data-loc-code="" data-loc-group="back">
            None
        </button>
    ` + BACK_LOCATIONS.map((loc) => {
        // Unpriceable combos (FF_JB / JF_FB — see SUPPORTED_COMBOS) render
        // disabled so the rep can't select a price the data can't back.
        const supported = isComboSupported(state.front, loc.code);
        const disabledAttrs = supported ? '' :
            ` disabled title="Not available with ${escapeHtml(LOCATION_LABELS[state.front] || state.front)} — no pricing data for ${escapeHtml(state.front)}_${escapeHtml(loc.code)}"`;
        return `
        <button type="button" class="dtg-location-pill${state.back === loc.code ? ' selected' : ''}" data-loc-code="${loc.code}" data-loc-group="back"${disabledAttrs}>
            ${escapeHtml(loc.label)}<span class="dim">${escapeHtml(loc.dim)}</span>
        </button>
    `;
    }).join('');

    const sum = document.getElementById('dtgLocationSummary');
    if (sum) {
        const code = effectiveLocationCode();
        sum.innerHTML = `
            <div>${escapeHtml(effectiveLocationLabel())}</div>
            <span class="dls-code">Code: ${escapeHtml(code || '—')}</span>
        `;
    }

    frontEl.querySelectorAll('.dtg-location-pill').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.front = btn.getAttribute('data-loc-code') || 'LC';
            const clearedBack = sanitizeLocationState();
            if (clearedBack) {
                showToastSafe(`${LOCATION_LABELS[clearedBack] || clearedBack} isn't available with ${LOCATION_LABELS[state.front] || state.front} — back print cleared.`);
            }
            markDirty();
            scheduleStateSave();
            renderLocationPills();
            schedulePriceUpdate();
        });
    });
    backEl.querySelectorAll('.dtg-location-pill').forEach((btn) => {
        btn.addEventListener('click', () => {
            const code = btn.getAttribute('data-loc-code') || '';
            // Belt-and-braces: disabled pills don't fire clicks, but never
            // let an unpriceable combo into state regardless.
            if (code && !isComboSupported(state.front, code)) return;
            state.back = code;
            markDirty();
            scheduleStateSave();
            renderLocationPills();
            schedulePriceUpdate();
        });
    });
}

// Renders state.rows as a stack of self-contained line-item cards.
// Replaced the old <table> on 2026-05-19 so the form fits cleanly in the
// narrow (~520px) sticky right column of the two-column layout. Each
// card has: style+color row at top, size grid (XS-6XL in 2 rows of 5)
// in the middle, and totals at the bottom. Per-row size availability
// (N/A vs editable) replaces the old table-wide column-show logic.
export function renderTable() {
    const container = document.getElementById('dtgRowsCards');
    if (!container) return;

    if (state.rows.length === 0) {
        container.innerHTML = `<div class="dtg-rows-empty">No line items yet — pick a style from the catalog or click <strong>Add row</strong> to start.</div>`;
        return;
    }

    // Fixed size template — always render all 10 size slots per card.
    // Per-row availability hides individual cells as N/A. The card layout
    // doesn't need the table-wide collectSizesShown() compression anymore.
    const SIZE_GRID = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];

    const classify = (window.OrderFormInventory && window.OrderFormInventory.classifyInventory)
        || ((q, a) => Number.isFinite(Number(a)) ? (Number(a) === 0 ? 'oos' : (q > a ? 'over' : (q > a * 0.8 ? 'low' : 'good'))) : 'unknown');

    // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
    container.innerHTML = state.rows.map((row) => {
        const total = Object.values(row.sizes || {}).reduce((s, v) => s + (Number(v) || 0), 0);
        const perPiece = row._perPiece;
        const lineTotal = (perPiece != null && total > 0) ? (perPiece * total) : null;
        const inv = row.inventory || { bySize: {}, status: 'unknown' };
        const invKnown = inv.status === 'ok';

        const sizeCells = SIZE_GRID.map((sz) => {
            const qty = Number((row.sizes || {})[sz]) || 0;
            const avail = row.availableSizes && row.availableSizes.length > 0
                ? row.availableSizes.includes(sz)
                : true;
            if (!avail && row.style) {
                // Style doesn't carry this size — render a dimmed N/A cell.
                return `<div class="dtg-size-cell dtg-size-cell--na" title="${escapeHtml(row.style)} doesn't come in ${escapeHtml(sz)}">
                    <div class="dtg-size-label">${escapeHtml(sz)}</div>
                    <div class="dtg-size-na">N/A</div>
                </div>`;
            }
            // Per-size price (tier-adjusted with LTM amortized in). Replaces
            // the raw inventory count Erik removed in v11 — reps see the
            // upcharge for extended sizes at a glance, no mental math.
            const priceForSize = row._priceBySize ? row._priceBySize[sz] : null;
            const priceLabel = (typeof priceForSize === 'number')
                ? `$${priceForSize.toFixed(2)}`
                : '';

            // OOS warning — red dot + red border. Does NOT block typing
            // (rep may know stock is incoming); the warning is loud
            // enough to make them verify before promising.
            const invAvailable = inv.bySize ? inv.bySize[sz] : null;
            const stockKnown = invKnown && Number.isFinite(Number(invAvailable));
            const isOOS = stockKnown && Number(invAvailable) === 0;
            const oosDot = isOOS
                ? `<span class="dtg-size-oos-dot" title="Out of stock at SanMar (${escapeHtml(sz)}) — verify before promising"></span>`
                : '';

            // Inline warning when a rep types qty into an OOS cell.
            const typedOOS = isOOS && qty > 0;
            const oosWarn = typedOOS
                ? `<div class="dtg-size-warn" title="Out of stock at SanMar — verify before promising">⚠ OOS</div>`
                : '';

            // Keep the "over inventory" classification for the typed-too-much
            // case (rep typed 50 but only 12 in stock).
            const klass = stockKnown ? classify(qty, Number(invAvailable)) : 'unknown';
            const overflow = klass === 'over' && !isOOS;

            return `<div class="dtg-size-cell${overflow ? ' dtg-size-cell--overflow' : ''}${isOOS ? ' dtg-size-cell--oos' : ''}">
                <div class="dtg-size-label">${escapeHtml(sz)}</div>
                <input type="number" min="0" step="1" value="${qty || ''}" data-row-id="${row.id}" data-size="${escapeHtml(sz)}" aria-label="Quantity ${escapeHtml(sz)}" title="Tip: paste S:2 M:4 L:6 here to fill all sizes at once">
                <div class="dtg-size-price${isOOS ? ' dtg-size-price--oos' : ''}">${oosDot}${priceLabel}</div>
                ${oosWarn}
            </div>`;
        }).join('');

        const aiTouchedAgeMs = row._aiTouched ? Date.now() - row._aiTouched : 999999;
        const aiTouchClass = aiTouchedAgeMs < 2000 ? ' dtg-line-card--ai-touched' : '';
        const colorInvalid = isRowColorInvalid(row);

        return `
            <div class="dtg-line-card${aiTouchClass}" data-row-id="${escapeHtml(row.id)}">
                <div class="dtg-line-head">
                    <div class="dtg-line-style dtg-row-style">
                        <div class="dtg-combobox" data-row-id="${escapeHtml(row.id)}" data-combo-kind="style">
                            <input type="text" value="${escapeHtml(row.style)}" placeholder="Style (e.g. PC54)" autocomplete="off">
                        </div>
                    </div>
                    <div class="dtg-line-color dtg-row-color${colorInvalid ? ' dtg-row-color-invalid' : ''}">
                        <div class="dtg-combobox" data-row-id="${escapeHtml(row.id)}" data-combo-kind="color">
                            ${row.colorSwatch
                                ? `<span class="dtg-row-color-swatch" style="background-image:url('${escapeHtml(row.colorSwatch)}');" aria-hidden="true"></span>`
                                : (row.color ? `<span class="dtg-row-color-swatch dtg-row-color-swatch--blank" aria-hidden="true"></span>` : '')}
                            <input type="text" value="${escapeHtml(row.color)}" placeholder="${row.style ? 'Pick color' : 'Pick style first'}" autocomplete="off" ${row.style ? '' : 'disabled'} ${row.colorSwatch || row.color ? 'data-has-swatch="true"' : ''}>
                            <i class="fas fa-caret-down dtg-combobox-chevron" aria-hidden="true"></i>
                        </div>
                    </div>
                    <div class="dtg-line-actions">
                        <button type="button" class="dtg-line-clone" data-clone-row="${escapeHtml(row.id)}" title="Clone this line (same style + sizes, change color)">
                            <i class="fas fa-clone" aria-hidden="true"></i>
                        </button>
                        <button type="button" class="dtg-line-remove dtg-row-remove" data-remove-row="${escapeHtml(row.id)}" title="Remove line">×</button>
                    </div>
                </div>
                ${row.desc ? `<div class="dtg-line-desc" title="${escapeHtml(row.desc)}">${escapeHtml(row.desc)}</div>` : ''}
                ${colorInvalid ? `<div class="dtg-row-color-warn" title="Pick a valid color from the dropdown">⚠ "${escapeHtml(row.color)}" not in ${escapeHtml(row.style)} catalog — pick from the dropdown above</div>` : ''}
                <div class="dtg-line-sizes">
                    ${sizeCells}
                </div>
                <div class="dtg-line-foot">
                    <span class="dtg-line-qty"><strong>${total}</strong> pc${total === 1 ? '' : 's'}</span>
                    <span class="dtg-line-perpiece">${perPiece != null ? '$' + perPiece.toFixed(2) + '/pc' : '— /pc'}</span>
                    <span class="dtg-line-total">${lineTotal != null ? '$' + lineTotal.toFixed(2) : '$0.00'}</span>
                </div>
            </div>
        `;
    }).join('');

    wireRowHandlers();
}

export function collectSizesShown() {
    // Default standard sizes that always render. Augment with any size the
    // bundle reported as available on any row.
    const setSizes = new Set(['S', 'M', 'L', 'XL', '2XL', '3XL']);
    for (const row of state.rows) {
        for (const sz of (row.availableSizes || [])) {
            setSizes.add(String(sz).toUpperCase());
        }
        for (const sz of Object.keys(row.sizes || {})) {
            setSizes.add(String(sz).toUpperCase());
        }
    }
    return STANDARD_SIZES.filter((s) => setSizes.has(s));
}

// Recompute the due date based on current combined qty. Only fires when
// the rep hasn't manually overridden the date. Updates both state AND
// the visible input + hint. Called from renderSummary() so any qty
// change (add row, edit cell, etc.) triggers it.
export function syncDueDateFromQty() {
    if (!state.scheduling.autoDueDate) return;
    const cq = combinedQty();
    const newDate = computeAutoDueDate(cq);
    if (newDate !== state.scheduling.dueDate) {
        state.scheduling.dueDate = newDate;
        const f = /** @type {HTMLInputElement|null} */ (document.getElementById('dtgDueDate'));
        if (f) f.value = newDate;
        scheduleStateSave();
    }
    const hint = document.getElementById('dtgDueDateHint');
    if (hint) hint.textContent = dueDateAutoLabel(cq);
}

// B6 — Inline validation banner. Lists the SPECIFIC currently-missing
// required fields above the Submit button, updating live as the rep
// fills things in. Design # is intentionally NOT a hard requirement —
// A3 handles it as a soft warning at click time.
// Compute the pre-flight readiness state for the current form. Returns an
// array of items + the overall ready flag. Each item describes ONE piece
// of the order with a state ('ok' / 'warn' / 'block' / 'tip'), a label,
// a value (or remediation message), and optionally a `jumpId` — the DOM
// id of the field the rep should click to fix the issue.
// F3 split (2026-07-09): readiness checks 7-9 moved VERBATIM out of
// computeReadiness (they share no locals beyond items/cq).
function pushDesignReadiness(items) {
    // 7. Design — either existing Design # OR new artwork upload (mutually
    // exclusive). Erik 2026-05-20:
    //   (a) No design # AND no files → BLOCK (rep must pick one path)
    //   (b) Files uploaded but no design name → BLOCK
    //   (c) Both design # AND files → BLOCK (conflict — pick one)
    //   (d) Otherwise: ok / warn states like before
    const hasExistingDesign = !!(state.customer.designNumber && String(state.customer.designNumber).trim());
    const newArtworkFiles = state.newArtwork?.files || [];
    const newArtworkName = (state.newArtwork?.designName || '').trim();
    const hasUploadedArtwork = newArtworkFiles.length > 0;

    if (hasExistingDesign && hasUploadedArtwork) {
        // Conflict: rep has both — block until they pick one
        items.push({
            state: 'block',
            label: 'Design',
            value: `Conflict — existing design #${state.customer.designNumber} picked AND ${newArtworkFiles.length} file(s) uploaded. Pick one or the other.`,
            jumpId: 'dtgDesignNumber',
        });
    } else if (!hasExistingDesign && !hasUploadedArtwork) {
        // Neither — block
        items.push({
            state: 'block',
            label: 'Design',
            value: 'Pick an existing design # OR upload new artwork',
            jumpId: 'dtgDesignNumber',
        });
    } else if (hasUploadedArtwork && !newArtworkName) {
        // Files uploaded but no name — block
        items.push({
            state: 'block',
            label: 'Design',
            value: `${newArtworkFiles.length} file(s) uploaded — type a Design name to continue`,
            jumpId: 'dtgNewArtworkName',
        });
    } else if (hasUploadedArtwork) {
        // New artwork ready
        items.push({
            state: 'ok',
            label: 'Design',
            value: `New: "${newArtworkName}" — ${newArtworkFiles.length} file(s) will create a new ShopWorks design`,
        });
    } else {
        // Existing design # — show the matched design's name when available
        const cachedDesigns = dtgIF._designComboboxCustomerId
            ? (_designsCacheByCustomer.get(String(dtgIF._designComboboxCustomerId)) || [])
            : [];
        const matched = cachedDesigns.find((d) => d.idDesign === String(state.customer.designNumber).trim());
        if (matched) {
            items.push({ state: 'ok', label: 'Design #', value: `${matched.idDesign} — ${matched.designName || '(no name)'}` });
        } else if (dtgIF._designComboboxCustomerId && cachedDesigns.length > 0) {
            items.push({ state: 'warn', label: 'Design #', value: `${state.customer.designNumber} — not on file for this customer (manual entry ok)`, jumpId: 'dtgDesignNumber' });
        } else {
            items.push({ state: 'ok', label: 'Design #', value: state.customer.designNumber });
        }
    }
}

function pushStockAndTierHints(items, cq) {
    // 8. OOS-with-qty warnings (any size typed where SanMar shows 0 stock)
    let oosTypedCount = 0;
    for (const row of state.rows) {
        const inv = row.inventory;
        if (!inv || inv.status !== 'ok') continue;
        for (const [sz, qty] of Object.entries(row.sizes || {})) {
            if (Number(qty) > 0 && inv.bySize && Number(inv.bySize[sz]) === 0) oosTypedCount++;
        }
    }
    if (oosTypedCount > 0) {
        items.push({
            state: 'warn',
            label: 'Stock',
            value: `${oosTypedCount} size${oosTypedCount === 1 ? '' : 's'} typed at qty > 0 are showing OOS at SanMar — verify before promising`,
        });
    }

    // 9. Tier-break optimization (free money)
    if (dtgIF._lastTier && dtgIF._allTiers && cq > 0) {
        const nextTier = findNextTier(dtgIF._allTiers, dtgIF._lastTier, cq);
        if (nextTier) {
            const piecesNeeded = nextTier.MinQty - cq;
            if (piecesNeeded > 0 && piecesNeeded <= 5) {
                const currentLtmFee = Number(dtgIF._lastTier.LTM_Fee) || 0;
                const hint = currentLtmFee > 0
                    ? `Add ${piecesNeeded} more piece${piecesNeeded === 1 ? '' : 's'} to reach tier ${nextTier.TierLabel} and skip the $${currentLtmFee} LTM fee`
                    : `Add ${piecesNeeded} more piece${piecesNeeded === 1 ? '' : 's'} to reach tier ${nextTier.TierLabel} — cheaper per-piece pricing`;
                items.push({ state: 'tip', label: 'Tier tip', value: hint });
            }
        }
    }
}

export function computeReadiness() {
    const items = [];
    const cq = combinedQty();

    // 1. Print location — has a sensible default (LC), so always ok
    const locCode = effectiveLocationCode();
    const locLabel = effectiveLocationLabel() || locCode;
    if (locCode) {
        items.push({ state: 'ok', label: 'Print location', value: locLabel + (state.back ? ` (${locCode})` : '') });
    } else {
        items.push({ state: 'block', label: 'Print location', value: 'Pick a front location', jumpId: 'dtgFrontOptions' });
    }

    // 2. Line items
    const validLines = state.rows.filter((r) =>
        r.style && r.color && !isRowColorInvalid(r) &&
        Object.values(r.sizes || {}).some((v) => Number(v) > 0)
    );
    const invalidColorRows = state.rows.map((r, i) => ({ r, i })).filter(({ r }) => isRowColorInvalid(r));

    if (state.rows.length === 0) {
        items.push({ state: 'block', label: 'Line items', value: 'No lines yet — pick a style from the catalog or click Add row', jumpId: 'dtgAddRowBtn' });
    } else if (validLines.length === 0) {
        items.push({ state: 'block', label: 'Line items', value: `${state.rows.length} row${state.rows.length === 1 ? '' : 's'} pending — finish style + color + sizes`, jumpId: 'dtgRowsCards' });
    } else {
        const tierLabel = dtgIF._lastTier ? dtgIF._lastTier.TierLabel : '?';
        const ltmFee = dtgIF._lastTier ? Number(dtgIF._lastTier.LTM_Fee) || 0 : 0;
        const tierNote = ltmFee > 0 ? ` (LTM +$${window.DTGCanonicalPricing.ltmPerUnit({ LTM_Fee: ltmFee }, cq).toFixed(2)}/pc)` : '';  // canonical (Batch 6)
        items.push({
            state: 'ok',
            label: 'Line items',
            value: `${validLines.length} line${validLines.length === 1 ? '' : 's'} · ${cq} combined pcs · tier ${tierLabel}${tierNote}`,
        });
    }

    // 3. Invalid colors — separate items per row so it's clear which fix
    for (const { r, i } of invalidColorRows) {
        items.push({ state: 'block', label: `Row ${i + 1} color`, value: `"${r.color}" not in ${r.style || 'catalog'} — pick from the dropdown`, jumpId: 'dtgRowsCards' });
    }

    // 4. Customer (company or name + email)
    const hasCustomerEmail = !!(state.customer.email && state.customer.email.includes('@'));
    const hasCompanyOrName = !!(state.customer.company || (state.customer.firstName && state.customer.lastName) || state.customer.companyId);
    const custDisplay = state.customer.company
        || `${state.customer.firstName || ''} ${state.customer.lastName || ''}`.trim()
        || state.customer.companyId;
    if (!hasCompanyOrName) {
        items.push({ state: 'block', label: 'Customer', value: 'Search for a company or fill name manually', jumpId: 'dtgCompanyInput' });
    } else if (!hasCustomerEmail) {
        items.push({ state: 'block', label: 'Customer', value: `${custDisplay} — missing email`, jumpId: 'dtgEmail' });
    } else {
        items.push({ state: 'ok', label: 'Customer', value: `${custDisplay} · ${state.customer.email}` });
    }

    // 5. Sales rep
    const repCode = state.customer.salesRepCode;
    if (!repCode) {
        items.push({ state: 'block', label: 'Sales rep', value: 'Pick a sales rep', jumpId: 'dtgSalesRep' });
    } else {
        const repName = (SALES_REPS.find((r) => r.code === repCode) || {}).name || repCode;
        items.push({ state: 'ok', label: 'Sales rep', value: repName });
    }

    // 6. Ship method + ship-to address
    const isPickupReady = isPickupMethod(state.shipping.method);
    if (!state.shipping.method) {
        items.push({ state: 'block', label: 'Ship method', value: 'Pick a ship method or toggle Customer Pickup', jumpId: 'dtgPickupToggle' });
    } else if (isPickupReady) {
        items.push({ state: 'ok', label: 'Ship method', value: 'Customer Pickup — Milton, WA (tax 10.2%)' });
    } else {
        const shipLabel = (SHIP_METHODS.find((m) => m.code === state.shipping.method) || {}).label || state.shipping.method;
        // For non-pickup, check the ship-to address completeness
        const haveCity = !!state.shipping.city;
        const haveStateField = !!state.shipping.state;
        const haveZip = (state.shipping.zip || '').length >= 5;
        if (!haveCity || !haveStateField || !haveZip) {
            items.push({
                state: 'warn',
                label: 'Ship to',
                value: `${shipLabel} — fill city + state + ZIP for accurate tax`,
                jumpId: 'dtgShipCity',
            });
        } else {
            const taxPct = ((Number(state.shipping.taxRate) || 0) * 100).toFixed(2);
            const taxBit = (state.shipping.state || '').toUpperCase() === 'WA'
                ? ` · ${taxPct}% tax`
                : ' · 0% tax (out of state)';
            items.push({
                state: 'ok',
                label: 'Ship to',
                value: `${state.shipping.city}, ${state.shipping.state} ${state.shipping.zip}${taxBit}`,
            });
        }
    }

    pushDesignReadiness(items);

    pushStockAndTierHints(items, cq);

    // Overall readiness — any blocker means submit is gated
    const blockers = items.filter((i) => i.state === 'block').length;
    const warnings = items.filter((i) => i.state === 'warn').length;
    const ready = blockers === 0;
    return { items, blockers, warnings, ready };
}

// Render the pre-flight panel and gate the Submit button accordingly.
// Called whenever state changes (sizes, customer fields, location, etc).
// Replaced the old single-line validation banner on 2026-05-19 with this
// richer always-visible checklist.
export function updateSubmitEnabled() {
    const btn = /** @type {HTMLInputElement|null} */ (document.getElementById('dtgSubmitBtn'));
    const panel = document.getElementById('dtgPreflightPanel');
    if (!btn) return;

    const { items, blockers, warnings, ready } = computeReadiness();
    btn.disabled = state.submitting || !ready;

    // [2026-06-08] Phase 1 Chunk C — enable Save once any row is fully priced
    // (looser than Submit, which also needs email/design). Lets a rep save a
    // draft quote + share link before the full push-readiness gate passes.
    const saveBtn = /** @type {HTMLInputElement|null} */ (document.getElementById('dtgSaveBtn'));
    if (saveBtn) {
        const anyPriced = state.rows.some(r =>
            r.style && r.color && Object.keys(r.sizes || {}).length > 0 && Number(r._lineTotal) > 0);
        saveBtn.disabled = !anyPriced;
    }

    if (panel) {
        const quoteID = getQuoteID();
        const qidLabel = quoteID ? `<span class="dpp-qid">${escapeHtml(quoteID)}</span>` : '';
        const headerClass = ready ? 'dpp-header dpp-header--ready' : 'dpp-header dpp-header--blocked';
        const headerIcon = ready ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-exclamation-triangle"></i>';
        const headerText = ready
            ? (warnings > 0
                ? `Ready to push — ${warnings} thing${warnings === 1 ? '' : 's'} worth a glance`
                : 'Ready to push to ShopWorks')
            : `${blockers} thing${blockers === 1 ? '' : 's'} need${blockers === 1 ? 's' : ''} attention before push`;

        const itemHtml = items.map((it) => {
            const iconClass = it.state === 'ok'   ? 'fa-check-circle dpp-i--ok'
                            : it.state === 'warn' ? 'fa-exclamation-triangle dpp-i--warn'
                            : it.state === 'block'? 'fa-circle-xmark dpp-i--block'
                            : 'fa-lightbulb dpp-i--tip';
            const cursor = it.jumpId ? 'dpp-item--clickable' : '';
            const jumpAttr = it.jumpId ? `data-jump-id="${escapeHtml(it.jumpId)}"` : '';
            return `
                <div class="dpp-item ${cursor}" ${jumpAttr}>
                    <i class="fas ${iconClass}" aria-hidden="true"></i>
                    <span class="dpp-label">${escapeHtml(it.label)}:</span>
                    <span class="dpp-value">${escapeHtml(it.value)}</span>
                </div>
            `;
        }).join('');

        // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
        panel.innerHTML = `
            <div class="${headerClass}">
                ${headerIcon}
                <span class="dpp-header-text">${escapeHtml(headerText)}</span>
                ${qidLabel}
            </div>
            <div class="dpp-items">${itemHtml}</div>
        `;
        panel.hidden = false;

        // Wire jump-to-field clicks (delegated would be cleaner, but the
        // panel re-renders on every state change, so per-render attach is fine)
        panel.querySelectorAll('.dpp-item--clickable').forEach((el) => {
            el.addEventListener('click', () => {
                const id = el.getAttribute('data-jump-id');
                const target = document.getElementById(id);
                if (!target) return;
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Focus the underlying input/select if reachable
                if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
                    setTimeout(() => target.focus(), 300);
                } else {
                    // For container ids, find first input inside
                    const firstInput = /** @type {HTMLElement|null} */ (target.querySelector('input, select, textarea, button'));
                    if (firstInput) setTimeout(() => firstInput.focus(), 300);
                }
            });
        });
    }

    btn.title = ready
        ? (state.customer.designNumber ? 'Push this quote to ShopWorks' : 'Push to ShopWorks — design # is optional, can be added in ShopWorks after')
        : '';
}

// ----- Row + combobox handlers ------------------------------------------
export function wireRowHandlers() {
    // 2026-05-19 — container switched from <table id="dtgRowsTable"> to
    // <div id="dtgRowsCards"> for the new card-per-line-item layout.
    // Same data attributes inside, so all the per-input wiring works
    // unchanged — only the container query changed.
    const table = document.getElementById('dtgRowsCards');
    if (!table) return;

    // Size qty inputs
    table.querySelectorAll('input[type="number"][data-row-id][data-size]').forEach((input) => {
        input.addEventListener('input', () => {
            const rid = input.getAttribute('data-row-id');
            const sz = input.getAttribute('data-size');
            const row = state.rows.find((r) => r.id === rid);
            if (!row) return;
            const q = Math.max(0, parseInt(/** @type {HTMLInputElement} */ (input).value || '0', 10) || 0);
            if (!row.sizes) row.sizes = {};
            if (q > 0) row.sizes[sz] = q;
            else delete row.sizes[sz];
            markDirty();
            scheduleStateSave();
            // 2026-05-19 — update the card's qty footer IMMEDIATELY (no
            // debounce, no DOM destruction) so the rep sees the new total
            // the same frame they type. Per-piece price + line total
            // settle ~200ms later via schedulePriceUpdate's re-render.
            const card = input.closest('.dtg-line-card');
            const qtyEl = card?.querySelector('.dtg-line-qty strong');
            if (qtyEl) {
                const total = Object.values(row.sizes || {}).reduce((s, v) => s + (Number(v) || 0), 0);
                qtyEl.textContent = String(total);
                const labelEl = qtyEl.nextSibling;
                if (labelEl && labelEl.nodeType === Node.TEXT_NODE) {
                    labelEl.textContent = total === 1 ? ' pc' : ' pcs';
                }
            }
            schedulePriceUpdate();
        });
        // C8 — bulk size paste. Accept formats like:
        //   "S:2 M:4 L:6 2XL:1"   "S/4, M/6, L/6"   "S-2 M-4 L-6"
        // Distribute parsed values across this row's size cells.
        input.addEventListener('paste', (e) => {
            const text = (/** @type {ClipboardEvent} */ (e).clipboardData || window.clipboardData)?.getData('text');
            if (!text) return; // fall through to default paste
            const parsed = parseBulkSizes(text);
            const sizesParsed = Object.keys(parsed);
            if (sizesParsed.length < 2) return; // single value → keep default behavior
            e.preventDefault();
            const rid = input.getAttribute('data-row-id');
            const row = state.rows.find((r) => r.id === rid);
            if (!row) return;
            let totalAdded = 0;
            for (const [sz, qty] of Object.entries(parsed)) {
                if (!row.sizes) row.sizes = {};
                if (qty > 0) row.sizes[sz] = qty;
                else delete row.sizes[sz];
                totalAdded += qty;
            }
            markDirty();
            scheduleStateSave();
            renderTable();
            schedulePriceUpdate();
            showToastSafe(`Distributed ${totalAdded} pieces across ${sizesParsed.length} sizes`);
        });
    });

    // Clone row — duplicate the line (style + color + sizes + availableSizes)
    // into a new row right below it. The common workflow: customer wants
    // the same garment in 2+ colors with the same size mix. Faster than
    // re-adding via catalog + re-typing sizes.
    table.querySelectorAll('[data-clone-row]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const rid = btn.getAttribute('data-clone-row');
            const idx = state.rows.findIndex((r) => r.id === rid);
            if (idx < 0) return;
            const src = state.rows[idx];
            const clone = newBlankRow();
            clone.style = src.style;
            clone.styleUpper = src.styleUpper;
            clone.desc = src.desc;
            clone.color = src.color;
            clone.catalogColor = src.catalogColor;
            clone.colorSwatch = src.colorSwatch;
            clone.colorsAvailable = src.colorsAvailable;
            clone.availableSizes = Array.isArray(src.availableSizes) ? [...src.availableSizes] : [];
            clone.sizes = Object.assign({}, src.sizes || {});
            clone._aiTouched = Date.now(); // pulse animation on the new card
            state.rows.splice(idx + 1, 0, clone); // insert right below source
            markDirty();
            scheduleStateSave();
            renderTable();
            schedulePriceUpdate();
            // Kick an inventory fetch if catalogColor is set — same as a
            // fresh row from the catalog would get.
            if (clone.catalogColor) kickInventoryFetch(clone);
            showToastSafe(`Cloned ${src.style || 'line'} — change the color to differentiate`);
        });
    });

    // Remove row
    table.querySelectorAll('[data-remove-row]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const rid = btn.getAttribute('data-remove-row');
            state.rows = state.rows.filter((r) => r.id !== rid);
            markDirty();
            scheduleStateSave();
            renderTable();
            schedulePriceUpdate();
        });
    });

    // Style combobox (per row)
    table.querySelectorAll('.dtg-combobox[data-combo-kind="style"]').forEach((wrap) => {
        const rid = wrap.getAttribute('data-row-id');
        const input = wrap.querySelector('input');
        attachStyleCombobox(wrap, input, rid);
    });
    // Color combobox (per row)
    table.querySelectorAll('.dtg-combobox[data-combo-kind="color"]').forEach((wrap) => {
        const rid = wrap.getAttribute('data-row-id');
        const input = wrap.querySelector('input');
        attachColorCombobox(wrap, input, rid);
    });
}

// ----- Customer combobox + manual fields --------------------------------
function wireActionButtons() {
    // Add row
    const addBtn = document.getElementById('dtgAddRowBtn');
    if (addBtn) addBtn.addEventListener('click', () => {
        state.rows.push(newBlankRow());
        markDirty();
        scheduleStateSave();
        renderTable();
    });

    // Reset
    const reset = document.getElementById('dtgResetBtn');
    if (reset) reset.addEventListener('click', () => resetForm());

    // Submit
    const submit = document.getElementById('dtgSubmitBtn');
    if (submit) submit.addEventListener('click', () => submitToShopWorks());

    // [2026-06-08] Phase 1 Chunk C: Save & Get Link — saves the MANUAL quote
    // (with tax/wholesale) to quote_sessions. Delegates to dtg-quote-page's
    // handleSaveQuote (exposed as window.dtgSaveQuote), which now reads this
    // form's quote via getSaveQuote() instead of the AI chat's stale quote.
    // Gated on a fully-priced row so an empty form can't save a blank quote.
    const saveBtn = document.getElementById('dtgSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => {
        if (typeof window.dtgSaveQuote === 'function') {
            window.dtgSaveQuote();
        } else {
            alert('Save is unavailable — please refresh and try again.');
        }
    });

    // Phase 11.4 (2026-05-24): Print Quote — opens a PDF-quality invoice
    // in a new window for the rep to print/save. Works from current form
    // state, no saved quote required.
    const printBtn = document.getElementById('dtgPrintBtn');
    if (printBtn) printBtn.addEventListener('click', () => dtgPrintQuote());

    // Phase 11.5 (2026-05-24): Email Quote — sends the customer a link to
    // the saved quote via EmailJS. Requires the quote to have been saved
    // first (sets aiState.savedQuoteID from the chat panel's "Save & share
    // link" button).
    const emailBtn = document.getElementById('dtgEmailBtn');
    if (emailBtn) emailBtn.addEventListener('click', () => dtgEmailQuote());
}

function wireCustomerPickers() {
    // Customer combobox
    const wrap = document.getElementById('dtgCompanyCombo');
    const input = document.getElementById('dtgCompanyInput');
    if (wrap && input) attachCompanyCombobox(wrap, input);

    // Customer history pill — expand/collapse + "Use this" button handlers.
    // Pill is populated asynchronously after customer is picked (see pick()).
    wireHistoryPillHandlers();

    // New-artwork upload zone (Erik 2026-05-20) — drag-drop + click-to-browse
    // for uploading customer artwork that doesn't have an existing
    // ShopWorks design # yet.
    attachNewArtworkUpload();

    // Contact picker — switches between this company's contacts.
    // When the rep selects a different contact, re-apply that contact's
    // first/last/email/phone to the form. State.customer.contacts must
    // already be populated by attachCompanyCombobox.pick() or previewCustomer().
    const contactPicker = /** @type {HTMLInputElement|null} */ (document.getElementById('dtgContactPicker'));
    if (contactPicker) contactPicker.addEventListener('change', () => {
        const id = contactPicker.value;
        if (!id) return;
        const ct = (state.customer.contacts || []).find((c) =>
            String(c.ID_Contact || '') === id);
        if (ct) {
            applyContact(ct);
            markDirty();
            scheduleStateSave();
        }
    });

    // Design # combobox (DTG designs for the current customer)
    const designWrap = document.getElementById('dtgDesignCombo');
    const designInput = document.getElementById('dtgDesignNumber');
    if (designWrap && designInput) {
        attachDesignCombobox(designWrap, designInput);
        // On initial mount, if a customer is already loaded (e.g. session
        // restored from a previous quote), kick off the design fetch.
        refreshDesignComboboxForNewCustomer();
    }
}

function wireScheduleAndLightbox() {
    // --- Schedule section: due date + drop dead date (Erik 2026-05-20) ---
    // Initialize due date on mount if it's still blank (qty=0 case picks
    // the 5-BD branch — when first row's qty pushes past 24, recompute
    // fires via syncDueDateFromQty()).
    if (!state.scheduling.dueDate && state.scheduling.autoDueDate) {
        state.scheduling.dueDate = computeAutoDueDate(combinedQty());
        const f = /** @type {HTMLInputElement|null} */ (document.getElementById('dtgDueDate'));
        if (f) f.value = state.scheduling.dueDate;
    }
    const dueDateEl = /** @type {HTMLInputElement|null} */ (document.getElementById('dtgDueDate'));
    if (dueDateEl) {
        dueDateEl.addEventListener('input', () => {
            state.scheduling.dueDate = dueDateEl.value;
            state.scheduling.autoDueDate = false; // rep took control
            const hint = document.getElementById('dtgDueDateHint');
            if (hint) hint.textContent = 'Manual override';
            markDirty();
            scheduleStateSave();
        });
    }
    const dropDeadEl = /** @type {HTMLInputElement|null} */ (document.getElementById('dtgDropDeadDate'));
    if (dropDeadEl) {
        dropDeadEl.addEventListener('input', () => {
            state.scheduling.dropDeadDate = dropDeadEl.value;
            markDirty();
            scheduleStateSave();
        });
    }

    // Design thumbnail click → open lightbox (Erik 2026-05-20).
    // Intercepts the anchor's default href navigation; shows the image
    // full-size in a modal so the rep can verify the artwork before submit.
    const thumbAnchor = document.getElementById('dtgDesignThumbAnchor');
    if (thumbAnchor) {
        thumbAnchor.addEventListener('click', (e) => {
            e.preventDefault();
            const img = /** @type {HTMLImageElement|null} */ (document.getElementById('dtgDesignThumbImg'));
            if (!img || !img.src) return;
            openDesignLightbox(img.src, img.alt || '');
        });
    }

    // Lightbox close handlers — backdrop click, X button, Escape key
    const lightbox = document.getElementById('dtgThumbLightbox');
    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            if (/** @type {HTMLElement} */ (e.target).dataset?.action === 'close') closeDesignLightbox();
        });
    }
    // Escape key — global listener (rebound on each render is harmless,
    // browsers dedupe identical listeners)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const lb = document.getElementById('dtgThumbLightbox');
            if (lb && !lb.hidden) closeDesignLightbox();
        }
    });
}

function wireCustomerFields() {
    // Manual customer fields
    bindInputToState('dtgFirstName', 'firstName');
    bindInputToState('dtgLastName', 'lastName');
    bindInputToState('dtgEmail', 'email');
    bindInputToState('dtgPhone', 'phone');
    bindInputToState('dtgPoNumber', 'po');
    // When the rep types a Company ID manually (rather than picking from
    // the search combobox), also refresh the design picker against that ID.
    bindInputToState('dtgCompanyId', 'companyId');
    const cidInput = document.getElementById('dtgCompanyId');
    if (cidInput) {
        let cidTimer = null;
        cidInput.addEventListener('input', () => {
            clearTimeout(cidTimer);
            cidTimer = setTimeout(() => refreshDesignComboboxForNewCustomer(), 300);
        });
    }
    // dtgDesignNumber is bound to state separately so the combobox's own
    // input handler doesn't conflict. Skip bindInputToState here.
    const termsSel = /** @type {HTMLInputElement|null} */ (document.getElementById('dtgTerms'));
    if (termsSel) termsSel.addEventListener('change', () => {
        state.customer.terms = termsSel.value;
        markDirty();
        scheduleStateSave();
        updateSubmitEnabled();
    });
    // A1 sales rep — remember last pick in localStorage so the next quote
    // starts on the same rep.
    const repSel = /** @type {HTMLInputElement|null} */ (document.getElementById('dtgSalesRep'));
    if (repSel) repSel.addEventListener('change', () => {
        state.customer.salesRepCode = repSel.value;
        try { localStorage.setItem('dtg.lastSalesRep', repSel.value); } catch {}
        markDirty();
        scheduleStateSave();
        updateSubmitEnabled();
    });
}

function wireShippingHandlers() {
    // A2 shipping method
    const shipSel = /** @type {HTMLInputElement|null} */ (document.getElementById('dtgShipMethod'));
    if (shipSel) shipSel.addEventListener('change', () => {
        state.shipping.method = shipSel.value;
        // Keep the pickup toggle in sync with the dropdown (a rep picking
        // "Customer Pickup" from the legacy dropdown should also flip the
        // toggle so the ship-to block hides + tax recomputes).
        syncPickupToggleFromShipMethod();
        recomputeTaxRate();
        markDirty();
        scheduleStateSave();
        updateSubmitEnabled();
        renderSummary();
    });

    // Customer Pickup toggle (2026-05-20). When ON we override ship.method
    // to 'pickup' (canonical, accepted by the OF push endpoint at server.js
    // line ~1838 + ~2627) and hide the ship-to block. When OFF we restore
    // the previous non-pickup method (default 'ups') and show the block.
    const pickupTgl = /** @type {HTMLInputElement|null} */ (document.getElementById('dtgPickupToggle'));
    if (pickupTgl) pickupTgl.addEventListener('change', () => {
        if (pickupTgl.checked) {
            // Remember the prior non-pickup method so toggling OFF can restore it.
            if (!isPickupMethod(state.shipping.method)) {
                state.shipping._prePickupMethod = state.shipping.method;
            }
            state.shipping.method = 'Customer Pickup';
        } else {
            state.shipping.method = state.shipping._prePickupMethod || 'UPS Ground';
            delete state.shipping._prePickupMethod;
        }
        // Sync the dropdown + show/hide ship-to block.
        const sel = /** @type {HTMLInputElement|null} */ (document.getElementById('dtgShipMethod'));
        if (sel) sel.value = state.shipping.method;
        const block = document.getElementById('dtgShipToBlock');
        if (block) block.hidden = isPickupMethod(state.shipping.method);
        recomputeTaxRate();
        markDirty();
        scheduleStateSave();
        updateSubmitEnabled();
        renderSummary();
    });

    // Ship-to address fields. Each bound to state.shipping with a debounced
    // tax-rate lookup so the rep sees "Seattle — 10.25%" appear as soon as
    // they finish typing city + state + ZIP.
    const SHIP_FIELDS = [
        ['dtgShipAddress1', 'address1'],
        ['dtgShipAddress2', 'address2'],
        ['dtgShipCity',     'city'],
        ['dtgShipState',    'state'],
        ['dtgShipZip',      'zip'],
    ];
    let taxLookupTimer = null;
    SHIP_FIELDS.forEach(([elId, key]) => {
        const el = /** @type {HTMLInputElement|null} */ (document.getElementById(elId));
        if (!el) return;
        el.addEventListener('input', () => {
            state.shipping[key] = el.value.trim();
            if (key === 'state') {
                // Normalize to uppercase 2-letter code on the fly.
                state.shipping.state = state.shipping.state.toUpperCase().slice(0, 2);
                el.value = state.shipping.state;
            }
            markDirty();
            scheduleStateSave();
            // Debounced tax lookup — fires 600ms after the rep stops
            // typing. Only when city + state + ZIP are all present.
            clearTimeout(taxLookupTimer);
            taxLookupTimer = setTimeout(recomputeTaxRate, 600);
        });
    });
}

function wireTaxControls() {
    // [2026-06-08] Phase 1 tax-control handlers. All route through recomputeTaxRate() (the SINGLE tax authority)
    // so the on-screen total, the PDF, the saved record, and the ShopWorks push never desync.
    const incTaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('include-tax'));
    if (incTaxEl) incTaxEl.addEventListener('change', () => {
        state.shipping.includeTax = incTaxEl.checked;
        markDirty(); scheduleStateSave(); recomputeTaxRate();
    });
    const rateEl = /** @type {HTMLInputElement|null} */ (document.getElementById('tax-rate-input'));
    if (rateEl) rateEl.addEventListener('input', () => {
        const v = rateEl.value.trim();
        state.shipping.taxRateOverride = (v === '' ? null : Number(v));
        markDirty(); scheduleStateSave(); recomputeTaxRate();
    });
    const wholeEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wholesale-checkbox'));
    if (wholeEl) wholeEl.addEventListener('change', () => {
        state.customer.isWholesale = wholeEl.checked;
        // UI parity with the trio: wholesale ON → uncheck include-tax; OFF → re-check it. recomputeTaxRate
        // re-derives the rate (wholesale branch zeros it; exempt/out-of-state still win when applicable).
        const it = /** @type {HTMLInputElement|null} */ (document.getElementById('include-tax'));
        state.shipping.includeTax = !wholeEl.checked;
        if (it) it.checked = !wholeEl.checked;
        markDirty(); scheduleStateSave(); recomputeTaxRate();
    });
    // [2026-06-09] Phase 2 — manual shipping-charge edits. The fee is in the tax base
    // (taxable in WA), so re-render the summary (which recomputes tax on subtotal+fee).
    // NOT recomputeTaxRate() — the fee doesn't change the RATE, and calling it would
    // re-hit the DOR lookup on every keystroke. renderSummary() → renderBand() also
    // refreshes the ship-to card's "· $X" line.
    const shipFeeEl = document.getElementById('dtgShipFee');
    if (shipFeeEl) shipFeeEl.addEventListener('input', () => {
        syncShipFeeFromDom();
        markDirty(); scheduleStateSave();
        renderSummary();
    });
}

export function wireGlobalHandlers() {
    // F3 split (2026-07-09): the wiring blocks moved VERBATIM into the section
    // functions above - call order unchanged.
    wireActionButtons();
    wireCustomerPickers();
    wireScheduleAndLightbox();
    wireCustomerFields();
    wireShippingHandlers();
    wireTaxControls();
}

export function bindInputToState(elId, stateKey) {
    const el = /** @type {HTMLInputElement|null} */ (document.getElementById(elId));
    if (!el) return;
    el.addEventListener('input', () => {
        state.customer[stateKey] = el.value.trim();
        markDirty();
        scheduleStateSave();
        updateSubmitEnabled();
    });
}

// ----- Init --------------------------------------------------------------
// [2026-06-08] Phase 0: refresh the shared order-summary band (recap + ship-to card). Guarded — a no-op if the
// module didn't load. Called at the end of renderSummary() so it tracks every priced state change (customer pick,
// ship-field edits, pickup toggle, recompute, edit-reload all funnel through renderSummary).
export function renderBand() {
    if (typeof QuoteOrderSummary === 'undefined') return;
    try { QuoteOrderSummary.renderOrderRecap(); } catch (_) {}
    try { QuoteOrderSummary.renderShipToCard(); } catch (_) {}
}

export function init() {
    // [2026-06-10] Shared leave-guard (quote-builder-utils.js) — warn before
    // navigating away with unsaved changes, same as EMB/SCP/DTF. Installed
    // FIRST because the ?edit= branch below early-returns. Safe this early:
    // dtgState.hasChanges starts false and only user mutations (markDirty) set it.
    if (typeof setupBeforeUnloadGuard === 'function') setupBeforeUnloadGuard();
    // [2026-06-08] Phase 0: wire the shared order-summary band to DTG's own #dtgShip*/#dtgCompany* fields
    // (the module is selector-agnostic). No estimate/editOnclick yet → the module hides those buttons.
    if (typeof QuoteOrderSummary !== 'undefined') {
        QuoteOrderSummary.configure({
            orderRecap: '#order-recap',
            shipToCard: '#ship-to-card',
            // [2026-06-09] Phase 2 — ship.fee wires the shared estimator's fee write +
            // the ship-to card's "· $X" line to #dtgShipFee.
            ship: { address: '#dtgShipAddress1', city: '#dtgShipCity', state: '#dtgShipState', zip: '#dtgShipZip', method: '#dtgShipMethod', fee: '#dtgShipFee' },
            recap: { company: '#dtgCompanyInput', custNum: '#dtgCompanyId' },
            logos: function () { return []; },
            // [2026-06-09] Phase 2 — UPS-Ground estimator. collectProducts mirrors the
            // PRICED rows (same isRowColorInvalid filter combinedQty uses) so the weight
            // estimate matches what's billed. onApplied syncs the DOM fee → state then
            // re-renders the summary (fee is in the tax base); no recomputeTaxRate here —
            // the fee doesn't change the RATE, and skipping it avoids a redundant DOR hit.
            estimateHooks: {
                collectProducts: function () {
                    return state.rows
                        .filter(function (r) { return r.style && !isRowColorInvalid(r); })
                        .map(function (r) { return { style: r.style, color: r.color, catalogColor: r.catalogColor, sizeBreakdown: r.sizes }; });
                },
                onApplied: function () { syncShipFeeFromDom(); renderSummary(); },
                btn: '#dtgEstimateShipBtn',
                result: '#dtgEstimateShipResult',
            },
        });
    }
    // Duplicate mode (?duplicate=DTG0311-1): load a COPY of the source quote
    // as a brand-NEW quote (EMB/DTF parity 2026-07-05). Read-only on the
    // source — locked/pushed quotes are fine to duplicate (the classic
    // reorder case). Rows reprice from the live API via schedulePriceUpdate()
    // — the saved prices are never trusted. Wins over ?edit= and the
    // session-restore flow, same param priority as DTF/EMB.
    const dupParam = (new URLSearchParams(window.location.search)).get('duplicate');
    if (dupParam && /^DTG/i.test(dupParam)) {
        if (state.rows.length === 0) state.rows.push(newBlankRow());
        render();
        // Kick load in background; render shows immediately, fills in async.
        loadSavedDtgQuoteForEdit(dupParam, { forDuplicate: true }).catch(err => {
            console.error('[DTG Duplicate] Load failed:', err);
        });
        return;
    }

    // Phase 11.6 (Erik 2026-05-24): edit-reopen for pre-push revisions.
    // If URL has ?edit=DTG-NNN, fetch the saved quote, populate the form,
    // and enable revision-on-save. Mirrors EMB/DTF/SCP loadQuoteForEditing.
    // Takes priority over the session-restore flow: if rep arrived via
    // an explicit edit URL, that wins over auto-restore.
    const editParam = (new URLSearchParams(window.location.search)).get('edit');
    // DTG QuoteIDs are date-packed with NO hyphen after the prefix
    // (e.g. DTG0311-1), so the old /^DTG-/ guard NEVER matched a real quote
    // and edit-load silently never fired. Match the prefix only. (2026-06-01)
    if (editParam && /^DTG/i.test(editParam)) {
        if (state.rows.length === 0) state.rows.push(newBlankRow());
        render();
        // Kick load in background; render shows immediately, fills in async.
        loadSavedDtgQuoteForEdit(editParam).catch(err => {
            console.error('[DTG Edit] Load failed:', err);
        });
        return;
    }

    // Quick Quote handoff (?from=quickquote — param schema + parser:
    // getQuickQuotePrefill() in quote-builder-utils.js). Prefills through
    // fillFromQuote(), the SAME chat→form setter the AI quote fill uses (row
    // hydrate, color fuzzy-match, inventory kick) — so pricing still comes from
    // DTGPricingService, never from the URL. Wins over session-restore for this
    // visit, same as ?edit=. (item #6, 2026-07-05)
    const qqPrefill = (typeof getQuickQuotePrefill === 'function') ? getQuickQuotePrefill() : null;
    if (qqPrefill && qqPrefill.style) {
        if (state.rows.length === 0) state.rows.push(newBlankRow());
        render();
        // locationCode was engine-whitelisted by Quick Quote (dtgCode());
        // fillFromQuote's sanitizeLocationState() re-guards anyway.
        fillFromQuote({
            locationCode: qqPrefill.location || 'LC',
            lineItems: [{
                styleNumber: qqPrefill.style,
                // COLOR_NAME preferred — fillFromQuote fuzzy-matches display names
                // and promotes the canonical name + CATALOG_COLOR itself.
                color: qqPrefill.colorName || qqPrefill.color,
                sizes: qqPrefill.sizeBreakdown || {}
            }]
        }, null);
        if (typeof showToast === 'function') showToast('Loaded ' + qqPrefill.style + ' from Quick Quote — verify details', 'info', 6000);
        if (typeof clearQuickQuoteParams === 'function') clearQuickQuoteParams();
        return;
    }

    // Method-switch / Leads handoff (?from=methodswitch): carry the CUSTOMER
    // identity only (the trio applies it via applyMethodSwitchCustomer; DTG's
    // form is its own architecture so we map the shared payload onto the DTG
    // customer fields through fillFromQuote — the same setter the AI/Quick-Quote
    // paths use, so no pricing is carried). Lead fields are attacker-controlled;
    // fillFromQuote sets input .value only (never innerHTML). Wins over
    // session-restore for this visit, same priority as ?edit=/?from=quickquote.
    const msPrefill = (typeof takeMethodSwitchPrefill === 'function') ? takeMethodSwitchPrefill() : null;
    if (msPrefill && msPrefill.customer && (msPrefill.customer.name || msPrefill.customer.company || msPrefill.customer.email)) {
        const c = msPrefill.customer;
        if (state.rows.length === 0) state.rows.push(newBlankRow());
        render();
        fillFromQuote(null, {
            name: c.name || '',
            company: c.company || '',
            customer_number: c.customerNumber || '',
            email: c.email || '',
            phone: c.phone || '',
        });
        if (typeof showToast === 'function') {
            showToast('Customer carried over from ' + (msPrefill.fromLabel || 'the lead') + ' — add products to price', 'info', 6000);
        }
        if (typeof markAsUnsaved === 'function') markAsUnsaved();
        // Strip the param so a refresh doesn't re-run the (now-drained) handoff.
        try { history.replaceState(null, '', window.location.pathname); } catch (_) { /* ignore */ }
        return;
    }

    // B4 — try to restore from sessionStorage first. If we restored, show
    // a small banner offering to start fresh.
    const restored = restoreStateFromSession();
    if (state.rows.length === 0) state.rows.push(newBlankRow());
    render();
    if (restored) {
        showResumeBanner();
        // A restored draft is unsaved work that dies with the tab — arm the
        // leave-guard so closing without saving warns. (Edit-reopen is the
        // opposite: content came FROM Caspio, so that path stays clean.)
        if (typeof markAsUnsaved === 'function') markAsUnsaved();
        // Hydrate the restored rows' inventory + bundle data in the
        // background so the size cells + badges fill in.
        for (const row of state.rows) {
            if (row.style && row.color) {
                kickInventoryFetch(row);
            }
            if (row.style) {
                // refresh available sizes from bundle (cached if hot)
                fetchBundle(row.style).then(b => {
                    if (b && Array.isArray(b.sizes)) {
                        row.availableSizes = b.sizes.filter(s => Number(s.price) > 0).map(s => String(s.size).toUpperCase());
                        renderTable();
                        schedulePriceUpdate();
                    }
                }).catch(() => {});
            }
        }
    }
}

// Find the row to preview into. Returns the first empty row (no style),
// or null if every row already has a style (rep is mid-edit; don't
// clobber). Used by previewStyle.
export function findPreviewableRow() {
    return state.rows.find((r) => !r.style) || null;
}

export function previewStyle({ style, desc, color, colorsAvailable, availableSizes }) {
    if (!style) return;
    // Resolve a target row in this order:
    //   1. The first row with no style yet (catalog open, empty form)
    //   2. Otherwise, append a brand-new row (rep already has lines and
    //      is adding a second style/color from the catalog).
    //
    // Until 2026-05-19 this returned silently when every row already had
    // a style, which made the "Add Pink" CTA on a second catalog card
    // appear to do nothing — exactly the bug Erik reported. Mirrors the
    // same pattern previewLineItems() already uses.
    let row = findPreviewableRow();
    if (!row) {
        row = newBlankRow();
        state.rows.push(row);
    }
    row.style = String(style).toUpperCase();
    row.styleUpper = row.style;
    if (desc) row.desc = desc;
    if (Array.isArray(colorsAvailable)) row.colorsAvailable = colorsAvailable;
    if (Array.isArray(availableSizes)) row.availableSizes = availableSizes;

    // If the chat detected a color (from rep's message OR existing rows),
    // push it through fuzzyMatchColor to resolve canonical + catalogColor
    // + swatch image. Saves a 2nd round-trip via quote_dtg_pricing for
    // the color cell to fill.
    if (color && !row.color) {
        const matched = fuzzyMatchColor(row.colorsAvailable || [], color);
        if (matched) {
            row.color = matched.COLOR_NAME || matched.colorName || matched.name || color;
            row.catalogColor = matched.CATALOG_COLOR || matched.catalogColor || '';
            row.colorSwatch = matched.COLOR_SQUARE_IMAGE || matched.swatchImageUrl || '';
            if (row.catalogColor) kickInventoryFetch(row);
        } else {
            // No match in the catalog — store the rep's text and let the
            // hydrate path (in fillFromQuote) try again with a longer list.
            row.color = String(color);
        }
    }

    row._aiTouched = Date.now(); // for the visual indicator
    // Re-render WITHOUT marking dirty / saving to sessionStorage —
    // this is a transient preview, not a rep edit.
    renderTable();

    // If the caller didn't pass availableSizes (catalog path), hydrate
    // them from the pricing bundle in the background so PC61's 4XL/5XL/6XL
    // columns actually appear instead of being silently truncated to 3XL.
    // The style-combobox path already does this — this matches it.
    if (!Array.isArray(availableSizes) || !availableSizes.length) {
        fetchBundle(row.style).then((bundle) => {
            if (!bundle || !Array.isArray(bundle.sizes)) return;
            const sizes = bundle.sizes
                .filter((s) => Number(s.price) > 0)
                .map((s) => String(s.size).toUpperCase());
            if (sizes.length) {
                row.availableSizes = sizes;
                renderTable();
            }
        }).catch((err) => {
            console.warn('[dtg-inline-form] previewStyle: bundle hydration failed', err);
        });
    }
}

/**
 * Fill the form's rows from a `quote_dtg_pricing` tool result. Each lineItem
 * has the shape returned by `caspio-pricing-proxy/lib/dtg-canonical-pricing.js`:
 *   { styleNumber, color, sizes: {S: 2, ...}, totalQuantity, ... }
 *
 * Strategy per line:
 *   1. Find a row matching (style, color) case-insensitive.
 *   2. Else use the first empty row (no style).
 *   3. Else append a new row at the end.
 *
 * For each filled row:
 *   - row.style + row.color (via fuzzyMatchColor when colorsAvailable is hydrated)
 *   - row.sizes merged into existing — only fill cells the rep hasn't typed
 *   - row.catalogColor + row.colorSwatch (when colorsAvailable hits)
 *   - row._aiTouched timestamp for the pulse indicator
 *   - kickInventoryFetch() once catalogColor is resolved
 */
export function previewLineItems(lineItems) {
    if (!Array.isArray(lineItems) || !lineItems.length) return;
    let mutated = false;
    for (const item of lineItems) {
        const style = String(item.styleNumber || item.style || '').toUpperCase();
        const color = String(item.color || '').trim();
        if (!style) continue;

        // Find an existing row by (style, color) — case-insensitive.
        let row = state.rows.find((r) =>
            String(r.style || '').toUpperCase() === style &&
            String(r.color || '').toLowerCase() === color.toLowerCase()
        );
        // Fall back to first empty-style row.
        if (!row) row = state.rows.find((r) => !r.style) || null;
        // Fall back to creating a new row.
        if (!row) {
            row = newBlankRow();
            state.rows.push(row);
        }

        row.style = style;
        row.styleUpper = style;

        // Color resolution: use fuzzyMatchColor when we have hydrated
        // colorsAvailable (set by previewStyle or fillFromQuote earlier).
        // Otherwise store the raw color text and let the next hydrate
        // pass resolve it.
        if (color && !row.color) {
            const matched = fuzzyMatchColor(row.colorsAvailable || [], color);
            if (matched) {
                row.color = matched.COLOR_NAME || matched.colorName || matched.name || color;
                row.catalogColor = matched.CATALOG_COLOR || matched.catalogColor || '';
                row.colorSwatch = matched.COLOR_SQUARE_IMAGE || matched.swatchImageUrl || '';
                if (row.catalogColor) kickInventoryFetch(row);
            } else {
                row.color = color;
            }
        }

        // Size merge — per-cell, only fill cells the rep hasn't typed.
        // row.sizes[size] === undefined → fill. === 0 → fill (rep didn't
        // type 0 explicitly; that's the "empty" state). > 0 → keep rep's
        // value (they typed it, we don't clobber).
        const sizes = (item.sizes && typeof item.sizes === 'object') ? item.sizes : {};
        for (const [size, qty] of Object.entries(sizes)) {
            const n = Number(qty);
            if (!Number.isFinite(n) || n < 0) continue;
            const existing = Number(row.sizes[size]) || 0;
            if (existing === 0) row.sizes[size] = n;
        }

        row._aiTouched = Date.now();
        mutated = true;
    }
    if (mutated) {
        renderTable();
        schedulePriceUpdate();
    }
}

export function previewCustomer(match) {
    if (!match) return;
    // Only fill if the rep hasn't already typed customer info.
    if (state.customer.email || state.customer.company || state.customer.companyId) return;
    const nameParts = String(match.contact_name || '').split(/\s+/);
    state.customer.company = match.company || state.customer.company;
    state.customer.companyId = match.customer_number || state.customer.companyId;
    state.customer.firstName = match.contact_first || nameParts[0] || state.customer.firstName;
    state.customer.lastName  = match.contact_last  || nameParts.slice(1).join(' ') || state.customer.lastName;
    state.customer.email = match.email || state.customer.email;
    state.customer.phone = match.phone || state.customer.phone;
    // Reflect into DOM
    const set = (id, val) => { const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id)); if (el && val && !el.value) el.value = val; };
    set('dtgCompanyInput', state.customer.company);
    set('dtgCompanyId', state.customer.companyId);
    set('dtgFirstName', state.customer.firstName);
    set('dtgLastName', state.customer.lastName);
    set('dtgEmail', state.customer.email);
    set('dtgPhone', state.customer.phone);
    // Surface the customer's contacts in the picker dropdown.
    if (Array.isArray(state.customer.contacts) && state.customer.contacts.length) {
        populateContactPicker(state.customer.contacts);
    }
    // New customer ID → refresh the Design # picker so its dropdown
    // shows THIS customer's DTG designs.
    refreshDesignComboboxForNewCustomer();
    updateSubmitEnabled();
}

// Boot moved to the shared base (F1): builders/dtg/index.js runs
// `QuoteBuilderBase(new DtgAdapter()).init()`, whose DOMContentLoaded start
// calls init() via the adapter — same timing (the bundle is a sync classic
// script, so readyState is always 'loading' at parse).

// The public cross-file API (dtg-catalog.js + dtg-quote-page.js consume this
// 13-method surface) — byte-stable through the decomposition (Batch 5).
 
 
// Expose API
// eslint-disable-next-line no-restricted-syntax -- pre-existing window contract (verbatim IIFE move, Batch 5)
window.DTGInlineForm = {
    fillFromQuote,
    getState,
    resetForm,
    submitToShopWorks,
    // [2026-06-08] Phase 1 Chunk C — the SAVE path (dtg-quote-page handleSaveQuote) reads
    // this so the saved quote_session reflects the MANUAL form (the on-screen total), not
    // the AI chat's stale currentPriceQuote. Returns the tax-bearing, item-complete quote
    // plus the customer + shipping/tax blocks the save + edit-reload (Chunk E) need.
    // null when the form has no priced rows (handleSaveQuote then falls back to the AI quote).
    getSaveQuote: () => {
        const pq = computePriceQuoteFromState();
        if (!pq || !pq.lineItems || !pq.lineItems.length) return null;
        pq.customer = {
            name: [state.customer.firstName, state.customer.lastName].filter(Boolean).join(' '),
            firstName: state.customer.firstName || '',
            lastName: state.customer.lastName || '',
            company: state.customer.company || '',
            companyId: state.customer.companyId || '',
            email: state.customer.email || '',
            phone: state.customer.phone || '',
            designNumber: state.customer.designNumber || '',
        };
        pq.shipping = {
            method: state.shipping.method,
            address1: state.shipping.address1 || '',
            address2: state.shipping.address2 || '',
            city: state.shipping.city || '',
            state: state.shipping.state || '',
            zip: state.shipping.zip || '',
            taxRate: state.shipping.taxRate,
            taxRateSource: state.shipping.taxRateSource || '',
            taxAccount: state.shipping.taxAccount || '',
            taxAccountName: state.shipping.taxAccountName || '',
            taxRateOverride: state.shipping.taxRateOverride,
            includeTax: state.shipping.includeTax !== false,
            // [2026-06-09] Phase 2 — persist the billed shipping charge so edit-reload
            // (Chunk E) restores it from Notes.shipping.fee. effectiveShipFee() → 0 for pickup.
            fee: effectiveShipFee(),
        };
        return pq;
    },
    // True when at least one row is fully priced — gates the form's Save button.
    hasCompleteRows: () => state.rows.some(r =>
        r.style && r.color && Object.keys(r.sizes || {}).length > 0 && Number(r._lineTotal) > 0),
    // C9 — chat controller calls this before fillFromQuote() to decide
    // whether to warn about overwriting user edits.
    isDirty: () => state.dirtyAfterChatFill,
    clearDirty,
    // Real-time chat-driven preview hooks (silent, no dirty marking).
    previewStyle,
    previewCustomer,
    previewLineItems,
    // Read-only row inspector — used by the chat's product-details card
    // to detect a preselected color so it can collapse the swatch grid.
    getRows: () => state.rows.map((r) => ({
        style: r.style, color: r.color, catalogColor: r.catalogColor,
    })),
    /**
     * Write the print location to the form from the chat side.
     * Used when the rep types an explicit location code in chat
     * ("pc61 jet black FF s:2 m:13" → setLocation('FF', '')) so
     * the form pill switches automatically without making the rep
     * click. Returns the new effective location code (e.g. "LC_FB").
     *
     * front: one of 'LC', 'FF', 'JF' (front-only options)
     * back:  one of '', 'FB', 'JB' (optional back)
     */
    setLocation: (front, back) => {
        const VALID_FRONT = ['LC', 'FF', 'JF'];
        const VALID_BACK = ['', 'FB', 'JB'];
        const f = String(front || '').toUpperCase();
        const b = String(back || '').toUpperCase();
        if (!VALID_FRONT.includes(f)) return null;
        if (!VALID_BACK.includes(b)) return null;
        // FF_JB / JF_FB have no pricing data (see SUPPORTED_COMBOS) —
        // reject so the chat reports failure instead of silently
        // setting a combo that prices to $0.
        if (b && !isComboSupported(f, b)) return null;
        const changed = (state.front !== f) || (state.back !== b);
        if (!changed) return effectiveLocationCode();
        state.front = f;
        state.back = b;
        // Real (non-preview) mutation — arm the leave-guard. Skips
        // markDirty on purpose (chat-driven, C9 guard shouldn't fire).
        if (typeof markAsUnsaved === 'function') markAsUnsaved();
        scheduleStateSave();
        renderLocationPills();
        schedulePriceUpdate();
        return effectiveLocationCode();
    },
    /**
     * Snapshot of form state for the chat backend. Sent on every chat
     * request as `calcContext.formState` so the bot knows what's
     * already on the form and doesn't re-ask. The bot uses this
     * to skip questions for fields the rep has already filled.
     */
    getFormSnapshot: () => ({
        locationCode: effectiveLocationCode() || 'LC',
        locationLabel: effectiveLocationLabel(),
        front: state.front || 'LC',
        back: state.back || '',
        rows: state.rows
            .filter((r) => r.style || Object.values(r.sizes || {}).some((q) => Number(q) > 0))
            .map((r) => ({
                style: r.style || '',
                color: r.color || '',
                sizes: r.sizes || {},
                totalQty: Object.values(r.sizes || {}).reduce((s, q) => s + (Number(q) || 0), 0),
            })),
        customer: {
            company: state.customer.company || '',
            companyId: state.customer.companyId || '',
            firstName: state.customer.firstName || '',
            lastName: state.customer.lastName || '',
            email: state.customer.email || '',
            phone: state.customer.phone || '',
            designNumber: state.customer.designNumber || '',
        },
        shipping: { method: state.shipping.method || 'ups' },
    }),
};
