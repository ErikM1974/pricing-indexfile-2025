/**
 * Professional Invoice Generation — shared by ALL FOUR quote builders.
 * Despite the historical name, EMB + SCP + DTF + DTG all print/save through this
 * one class (Rule 8: invoice/PDF/totals/tax = ONE shared engine) — treat every
 * change here as a 4-builder change and re-test each builder's print path.
 * Rate LABELS are derived from the CHARGED totals wherever possible (so the
 * printed arithmetic always foots); when derivation is impossible the label
 * falls back to Service_Codes via window.getServicePrice (bridged by the
 * builder bundles) and only then to a literal — with a console warning
 * (Erik's pricing=API rule; audit Batch 7, 2026-07-09).
 */

class EmbroideryInvoiceGenerator {
    constructor() {
        this.taxRate = 0.102; // Milton WA 10.2% (2026-07-06) — fallback only; builders pass the live rate
        
        this.salesRepMap = {
            'taneisha@nwcustomapparel.com': 'Taneisha Clark',
            'adriyella@nwcustomapparel.com': 'Adriyella',
            'nika@nwcustomapparel.com': 'Nika Lao',
            'jim@nwcustomapparel.com': 'Jim Mickelson',
            'erik@nwcustomapparel.com': 'Erik Mickelson',
            'ruth@nwcustomapparel.com': 'Ruth Nhong'
        };
    }

    /**
     * Digitizing rate LABEL when it can't be derived from the charged totals:
     * Service_Codes 'DD' via the builder bundles' window.getServicePrice bridge,
     * then the $100 literal — with a warning, never silently (pricing=API rule).
     */
    fallbackDigitizingRate() {
        if (typeof window !== 'undefined' && typeof window.getServicePrice === 'function') {
            return window.getServicePrice('DD', 100);
        }
        console.warn('[invoice] Service_Codes unavailable — using fallback $100 digitizing label');
        return 100;
    }

    /**
     * Escape user/external-controlled text before interpolating into invoice HTML. The generated markup is
     * written to a print window via document.write, so an unescaped customer name/note/address = stored XSS.
     * This generator backs ALL four builders (EMB/DTG/DTF/SCP), so the fix protects every printed quote.
     * Self-contained (no load-order dependency on quote-builder-utils). (audit P0-1 2026-06-06)
     */
    esc(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Get quote type info for dynamic title and filename
     * Detects quote type from pricingData flags
     */
    getQuoteTypeInfo(pricingData) {
        if (pricingData.isDTG) {
            return { title: 'DTG QUOTE', prefix: 'DTG Quote' };
        } else if (pricingData.isScreenprint) {
            return { title: 'SCREEN PRINT QUOTE', prefix: 'Screen Print Quote' };
        } else if (pricingData.isDTF) {
            return { title: 'DTF QUOTE', prefix: 'DTF Quote' };
        } else {
            return { title: 'EMBROIDERY QUOTE', prefix: 'Embroidery Quote' };
        }
    }

    /**
     * Generate complete invoice HTML
     */
    generateInvoiceHTML(pricingData, customerData) {
        const today = new Date();
        const expiryDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        // Get sales rep name
        const salesRepName = this.salesRepMap[customerData.salesRepEmail] || 'Sales Team';
        
        // Calculate tax. Use the quote's ACTUAL rate when provided (accepts a
        // decimal 0.101 or a percent 10.1) instead of a hardcoded 10.1% — out-of-
        // state / non-standard-rate customers were over-taxed on the printed PDF
        // vs the on-screen total. Falls back to this.taxRate if not passed. (2026-06-01)
        let taxRate = this.taxRate;
        const rawRate = pricingData.taxRate;
        if (rawRate != null && rawRate !== '' && !isNaN(parseFloat(rawRate))) {
            const n = parseFloat(rawRate);
            taxRate = n > 1 ? n / 100 : n;
        }
        const includeTax = pricingData.includeTax !== false;
        // Tax base = the ADJUSTED pre-tax subtotal (products + art/graphic-design/
        // rush/sample/shipping − discount), which is what the rep sees on screen.
        // The builders pass it as preTaxSubtotal. Historically the generator taxed
        // the bare grandTotal (products+setup+LTM only) and rendered the fee/discount
        // rows as DISPLAY-ONLY, so the printed GRAND TOTAL silently ignored every
        // fee and discount (and DTF fed a tax-INCLUSIVE total → double-tax). Fall
        // back to grandTotal when preTaxSubtotal isn't supplied. (2026-06-01)
        const rawPre = pricingData.preTaxSubtotal;
        const hasPre = rawPre != null && rawPre !== '' && !isNaN(parseFloat(rawPre));
        const baseForTax = hasPre ? parseFloat(rawPre) : (Number(pricingData.grandTotal) || 0);
        // [2026-06-11] round tax to cents BEFORE summing (house tax rule) — the
        // unrounded sum could disagree with the screen's rounded tax by a cent
        const taxAmount = includeTax ? Math.round(baseForTax * taxRate * 100) / 100 : 0;
        const totalWithTax = Math.round((baseForTax + taxAmount) * 100) / 100;
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <!-- Relative assets inherit the quote builder origin in the print window. -->
                <title>${this.getQuoteTypeInfo(pricingData).prefix} ${pricingData.quoteId || ''}</title>
                <link rel="stylesheet" data-invoice-styles href="/shared_components/css/tokens.css?v=2026.09.12.2">
                <link rel="stylesheet" data-invoice-styles href="/shared_components/css/components.css?v=2026.09.12.2">
                <link rel="stylesheet" data-invoice-styles href="/shared_components/css/quote-invoice.css?v=2026.09.12.2">
                <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&display=swap">
            </head>
            <body data-ui="unified" data-quote-invoice>
                <div class="invoice-container">
                    ${this.generateHeader(pricingData, today, expiryDate, customerData)}
                    ${this.generateCustomerSection(customerData, salesRepName)}
                    ${this.generateEmbroiderySpecs(pricingData)}
                    ${this.generateProductsTable(pricingData)}
                    ${this.generateTotalsSection(pricingData, taxAmount, totalWithTax, taxRate, baseForTax)}
                    ${this.generateFooter(customerData)}
                </div>
            </body>
            </html>
        `;
    }
    
    /** Wait for actual print assets; document.write can report complete before its links load. */
    async printWhenReady(printWindow) {
        const failure = () => new Error('Quote formatting could not load. Please try printing again.');
        if (!printWindow || printWindow.closed) throw new Error('The quote window was closed or blocked.');
        const doc = printWindow.document;
        const stylesheets = [...doc.querySelectorAll('[data-invoice-styles]')];
        if (stylesheets.length !== 3) throw failure();
        const cleanup = [];
        let timeout;
        const loaded = (node, required) => new Promise((resolve, reject) => {
            const done = () => resolve();
            const failed = () => required ? reject(failure()) : resolve();
            node.addEventListener('load', done, { once: true });
            node.addEventListener('error', failed, { once: true });
            cleanup.push(() => { node.removeEventListener('load', done); node.removeEventListener('error', failed); });
        });
        try {
            await Promise.race([
                (async () => {
                    await Promise.all([
                        ...stylesheets.filter(link => !link.sheet).map(link => loaded(link, true)),
                        ...[...doc.images].filter(img => !img.complete).map(img => loaded(img, false))
                    ]);
                    if (doc.fonts) await doc.fonts.ready;
                })(),
                new Promise((resolve, reject) => { timeout = setTimeout(() => reject(failure()), 20000); })
            ]);
            if (printWindow.closed) throw new Error('The quote window was closed.');
            printWindow.print();
        } finally {
            clearTimeout(timeout);
            cleanup.forEach(remove => remove());
        }
    }

    /**
     * Generate invoice header
     */
    generateHeader(pricingData, today, expiryDate, customerData = {}) {
        const quoteTypeInfo = this.getQuoteTypeInfo(pricingData);
        const quoteId = pricingData.quoteId;
        const fmtD = (s) => { if (!s) return ''; const d = new Date(String(s).length <= 10 ? s + 'T00:00:00' : s); return isNaN(d) ? s : d.toLocaleDateString(); };
        // Tenant branding (roadmap 0.3) — every builder page loads
        // /config/app.config.js first, so COMPANY delegates to window.TENANT.
        const co = window.APP_CONFIG.COMPANY;
        const addr = co.ADDRESS;

        return `
            <div class="invoice-header">
                <div class="company-info">
                    ${co.LOGO_URL ? `<img src="${co.LOGO_URL}?ver=1"
                         alt="${this.esc(co.NAME)}" class="company-logo">` : `<div class="company-logo company-logo--text">${this.esc(co.NAME)}</div>`}
                    <div class="company-details">
                        ${this.esc(addr.STREET)}<br>
                        ${this.esc(addr.CITY)}, ${this.esc(addr.STATE)} ${this.esc(addr.ZIP)}<br>
                        Phone: ${this.esc(co.PHONE_DISPLAY)}<br>
                        ${this.esc(co.WEBSITE)}
                    </div>
                </div>
                <div class="quote-info">
                    <div class="quote-title">${quoteTypeInfo.title}</div>
                    <div class="quote-details">
                        <strong>Quote #:</strong> ${quoteId || 'DRAFT'}<br>
                        ${customerData.poNumber ? `<strong>PO #:</strong> ${this.esc(customerData.poNumber)}<br>` : ''}
                        ${customerData.project ? `<strong>Project:</strong> ${this.esc(customerData.project)}<br>` : ''}
                        <strong>Date:</strong> ${today.toLocaleDateString()}<br>
                        ${customerData.reqShipDate ? `<strong>Requested Ship:</strong> ${fmtD(customerData.reqShipDate)}<br>` : ''}
                        <strong>Valid Until:</strong> ${expiryDate.toLocaleDateString()}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Generate customer section
     */
    generateCustomerSection(customerData, salesRepName) {
        // Billing address lines (2026-06-02 — Erik: invoice needs the billing address).
        const billLines = this.addressLines(customerData.billing);
        // Optional SHIP TO block — shown only when the order ships (not pickup).
        const ship = customerData.shipping || null;
        const shipLines = ship ? this.addressLines(ship) : '';
        const showShip = !!shipLines;
        return `
            <div class="customer-section">
                <div class="customer-info">
                    <div class="section-title">BILL TO:</div>
                    <div class="info-line"><strong>${this.esc(customerData.name) || 'Customer'}</strong></div>
                    ${customerData.company ? `<div class="info-line">${this.esc(customerData.company)}</div>` : ''}
                    ${billLines}
                    ${customerData.email ? `<div class="info-line">${this.esc(customerData.email)}</div>` : ''}
                    ${customerData.phone ? `<div class="info-line">${this.esc(customerData.phone)}</div>` : ''}
                </div>
                ${showShip ? `
                <div class="customer-info">
                    <div class="section-title">SHIP TO:</div>
                    <div class="info-line"><strong>${this.esc(customerData.name) || ''}</strong></div>
                    ${customerData.company ? `<div class="info-line">${this.esc(customerData.company)}</div>` : ''}
                    ${shipLines}
                </div>` : ''}
                <div class="sales-rep-info">
                    <div class="section-title">SALES REPRESENTATIVE:</div>
                    <div class="info-line"><strong>${this.esc(salesRepName)}</strong></div>
                    <div class="info-line">${this.esc(customerData.salesRepEmail)}</div>
                    <div class="info-line">(253) 922-5793</div>
                </div>
            </div>
        `;
    }

    /**
     * Render street + city/state/zip address lines from an address object.
     * Returns '' when no address is present (so the block degrades cleanly).
     */
    addressLines(a) {
        if (!a) return '';
        const street = (a.address || a.street || '').trim();
        const city = (a.city || '').trim();
        const state = (a.state || '').trim();
        const zip = (a.zip || '').trim();
        const cityStateZip = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        let out = '';
        if (street) out += `<div class="info-line">${this.esc(street)}</div>`;
        if (cityStateZip) out += `<div class="info-line">${this.esc(cityStateZip)}</div>`;
        return out;
    }
    
    /**
     * Generate service specifications section based on quote type
     * Dispatches to the appropriate method based on isDTG, isScreenprint, isDTF flags
     */
    generateEmbroiderySpecs(pricingData) {
        // Dispatch based on quote type
        if (pricingData.isDTG) {
            return this.generateDTGSpecs(pricingData);
        } else if (pricingData.isScreenprint) {
            return this.generateScreenprintSpecs(pricingData);
        } else if (pricingData.isDTF) {
            return this.generateDTFSpecs(pricingData);
        }

        // Default: Embroidery specs
        return this.generateEmbroideryLogoSpecs(pricingData);
    }

    /**
     * Generate DTG print location specifications
     */
    generateDTGSpecs(pricingData) {
        const printLocation = pricingData.printLocation;
        if (!printLocation) return '';

        // DTG location display names
        const LOCATION_NAMES = {
            'LC': 'Left Chest',
            'FF': 'Full Front',
            'JF': 'Jumbo Front',
            'FB': 'Full Back',
            'JB': 'Jumbo Back',
            'LC_FB': 'Left Chest + Full Back',
            'LC_JB': 'Left Chest + Jumbo Back',
            'FF_FB': 'Full Front + Full Back',
            'FF_JB': 'Full Front + Jumbo Back',
            'JF_FB': 'Jumbo Front + Full Back',
            'JF_JB': 'Jumbo Front + Jumbo Back'
        };

        let specsHTML = `
            <div class="method-specs" data-invoice-style="method-dtg">
                <div data-invoice-style="title-dtg">
                    <i class="fas fa-tshirt" aria-hidden="true" data-invoice-style="icon"></i>DTG PRINT LOCATIONS:
                </div>
        `;

        // Show front location
        if (printLocation.front) {
            const frontName = LOCATION_NAMES[printLocation.front] || printLocation.front;
            specsHTML += `
                <div data-invoice-style="detail">
                    <strong>Front:</strong> ${this.esc(frontName)}
                </div>
            `;
        }

        // Show back location if present
        if (printLocation.back) {
            const backName = LOCATION_NAMES[printLocation.back] || printLocation.back;
            specsHTML += `
                <div data-invoice-style="detail">
                    <strong>Back:</strong> ${this.esc(backName)}
                </div>
            `;
        }

        specsHTML += `</div>`;
        return specsHTML;
    }

    /**
     * Generate Screen Print configuration specifications
     */
    generateScreenprintSpecs(pricingData) {
        const printConfig = pricingData.printConfig;
        if (!printConfig) return '';

        let specsHTML = `
            <div class="method-specs" data-invoice-style="method-screenprint">
                <div data-invoice-style="title-screenprint">
                    <i class="fas fa-palette" aria-hidden="true" data-invoice-style="icon"></i>SCREEN PRINT CONFIGURATION:
                </div>
        `;

        // Front location with colors
        if (printConfig.front) {
            specsHTML += `
                <div data-invoice-style="detail">
                    <strong>Front:</strong> ${this.esc(printConfig.front)}
                </div>
            `;
        }

        // Back location with colors (if present)
        if (printConfig.back) {
            specsHTML += `
                <div data-invoice-style="detail">
                    <strong>Back:</strong> ${this.esc(printConfig.back)}
                </div>
            `;
        }

        // Sleeve locations with colors (if present — screen print only; other methods pass nothing)
        if (printConfig.sleeves) {
            specsHTML += `
                <div data-invoice-style="detail">
                    <strong>Sleeves:</strong> ${this.esc(printConfig.sleeves)}
                </div>
            `;
        }

        // Dark garment indicator
        if (printConfig.isDarkGarment) {
            specsHTML += `
                <div data-invoice-style="detail">
                    <strong>Dark Garment:</strong> Yes <span data-invoice-style="muted">(+white underbase)</span>
                </div>
            `;
        }

        // Safety stripes indicator
        if (printConfig.hasSafetyStripes) {
            specsHTML += `
                <div data-invoice-style="detail">
                    <strong>Safety Stripes:</strong> Yes <span data-invoice-style="muted">(+$2/piece/location)</span>
                </div>
            `;
        }

        // Screen count and setup fee
        if (printConfig.totalScreens && pricingData.setupFees > 0) {
            specsHTML += `
                <div data-invoice-style="setup-detail">
                    <strong>Setup:</strong> ${printConfig.totalScreens} screen${printConfig.totalScreens > 1 ? 's' : ''} × $${(pricingData.setupFees / printConfig.totalScreens).toFixed(2).replace(/\.00$/, '')} = $${pricingData.setupFees.toFixed(2)}
                </div>
            `;
        }

        specsHTML += `</div>`;
        return specsHTML;
    }

    /**
     * Generate DTF transfer location specifications
     */
    generateDTFSpecs(pricingData) {
        const selectedLocations = pricingData.selectedLocations;
        if (!selectedLocations || selectedLocations.length === 0) return '';

        // DTF location configuration
        const locationConfig = {
            'left-chest': { label: 'Left Chest', size: 'Small' },
            'right-chest': { label: 'Right Chest', size: 'Small' },
            'left-sleeve': { label: 'Left Sleeve', size: 'Small' },
            'right-sleeve': { label: 'Right Sleeve', size: 'Small' },
            'back-of-neck': { label: 'Back of Neck', size: 'Small' },
            'center-front': { label: 'Center Front', size: 'Medium' },
            'center-back': { label: 'Center Back', size: 'Medium' },
            'full-front': { label: 'Full Front', size: 'Large' },
            'full-back': { label: 'Full Back', size: 'Large' }
        };

        let specsHTML = `
            <div class="method-specs" data-invoice-style="method-dtf">
                <div data-invoice-style="title-dtf">
                    <i class="fas fa-layer-group" aria-hidden="true" data-invoice-style="icon"></i>DTF TRANSFER LOCATIONS:
                </div>
        `;

        // List each selected location
        selectedLocations.forEach(loc => {
            const config = locationConfig[loc] || { label: loc, size: '' };
            specsHTML += `
                <div data-invoice-style="detail">
                    • ${this.esc(config.label)} <span data-invoice-style="muted">(${config.size})</span>
                </div>
            `;
        });

        specsHTML += `</div>`;
        return specsHTML;
    }

    /**
     * Generate embroidery logo specifications (original embroidery specs)
     * Supports separate garment and cap logo configurations
     */
    generateEmbroideryLogoSpecs(pricingData) {
        // Check if we have the new logoConfigs structure
        const hasLogoConfigs = pricingData.logoConfigs &&
            (pricingData.garmentLogos?.length > 0 || pricingData.capLogos?.length > 0);

        // If no logoConfigs and no legacy logos, return empty
        if (!hasLogoConfigs && (!pricingData.logos || pricingData.logos.length === 0)) {
            return '';
        }

        let specsHTML = `
            <div class="method-specs" data-invoice-style="method-embroidery">
        `;

        // ---- Additional Logo (AL) per-piece prices actually charged -------------
        // The builder prices ALs LIVE from /api/al-pricing (syncALRows) and passes
        // them as service line items inside pricingData.products (styles AL / AL-CAP /
        // DECG-FB, with the real per-piece unitPrice). Collect those so the printed
        // spec line shows the price that was actually charged — the generator never
        // fetches APIs; it prints what the builder passed. (audit 2026-06-10)
        const alServiceItems = (pricingData.products || [])
            .filter(p => p && (p.isService || (p.product && p.product.isService)))
            .filter(p => ['AL', 'AL-CAP', 'DECG-FB'].includes(p.product && p.product.style))
            .map(p => ({
                isCap: !!(p.product && p.product.isCap),
                position: String((p.product && p.product.position) || '').trim().toLowerCase(),
                unitPrice: Number(p.lineItems && p.lineItems[0] && p.lineItems[0].unitPrice) || 0
            }))
            .filter(s => s.unitPrice > 0);

        // FALLBACK ONLY — frozen 2026-02 garment AL tier table. Used solely when no
        // actually-charged price reached pricingData (logo.unitPrice or a matching AL
        // service line item). It can drift from Caspio Embroidery_Costs and applies
        // GARMENT rates to cap ALs, so it must never override a real charged price.
        const tier = pricingData.tier || '1-7';
        let alBaseRate = 13.50; // 2026-02 base rate (fallback only — see above)
        if (tier.includes('72')) alBaseRate = 8.50;
        else if (tier.includes('48')) alBaseRate = 9.50;
        else if (tier.includes('24')) alBaseRate = 11.50;
        else if (tier === '8-23') alBaseRate = 13.50;

        // Per-logo digitizing rate, derived from the SAME numbers that feed the
        // computed total — never a hardcoded "$100" (a Caspio DigitizingFee change
        // would otherwise print arithmetic that doesn't foot). setupFees may include
        // the cap patch setup fee, which is labeled separately below, so back it out
        // before dividing. (audit 2026-06-10)
        const digitizingLogoCount = pricingData.setupFeesCount ||
            (pricingData.logos ? pricingData.logos.filter(l => l.needsDigitizing).length : 0);
        const digitizingSubtotal = Math.max(0, (pricingData.setupFees || 0) - (pricingData.capPatchSetupFee || 0));
        const digitizingRate = (digitizingLogoCount > 0 && digitizingSubtotal > 0)
            ? digitizingSubtotal / digitizingLogoCount
            : 0;

        const logoListOpts = { alServiceItems, digitizingRate };

        // Handle new separate logo configs
        if (hasLogoConfigs) {
            // GARMENT EMBROIDERY SECTION
            if (pricingData.garmentLogos && pricingData.garmentLogos.length > 0 && pricingData.hasGarments) {
                specsHTML += `<div data-invoice-style="title-embroidery">GARMENT EMBROIDERY:</div>`;
                specsHTML += this.generateLogoListHTML(pricingData.garmentLogos, alBaseRate, 'garment', logoListOpts);
            }

            // CAP EMBELLISHMENT SECTION
            if (pricingData.capLogos && pricingData.capLogos.length > 0 && pricingData.hasCaps) {
                // Determine embellishment type label
                const capEmbType = pricingData.capEmbellishmentType || 'embroidery';
                const capEmbLabel = {
                    'embroidery': 'CAP EMBROIDERY:',
                    '3d-puff': 'CAP 3D PUFF EMBROIDERY:',
                    'laser-patch': 'CAP LASER LEATHERETTE PATCH:'
                }[capEmbType] || 'CAP EMBELLISHMENT:';

                specsHTML += `<div data-invoice-style="title-cap" data-invoice-separated="${pricingData.hasGarments}">${capEmbLabel}</div>`;

                if (capEmbType === 'laser-patch') {
                    // Patch-specific display (no stitch count)
                    specsHTML += `
                        <div data-invoice-style="cap-detail">
                            <strong>Position:</strong> Cap Front | <strong>Type:</strong> Laser Leatherette Patch
                        </div>
                    `;
                    // Show patch setup fee if applicable
                    if (pricingData.capPatchSetupFee > 0) {
                        specsHTML += `
                            <div data-invoice-style="cap-note">
                                Design Setup Fee: $${pricingData.capPatchSetupFee.toFixed(2)}
                            </div>
                        `;
                    }
                } else {
                    // Embroidery display (flat or 3D puff)
                    specsHTML += this.generateLogoListHTML(pricingData.capLogos, alBaseRate, 'cap', logoListOpts);
                    // Show 3D puff upcharge if applicable
                    if (capEmbType === '3d-puff' && pricingData.puffUpchargePerCap > 0) {
                        specsHTML += `
                            <div data-invoice-style="cap-price">
                                3D Puff Upcharge: +$${pricingData.puffUpchargePerCap.toFixed(2)} per cap
                            </div>
                        `;
                    }
                }
            }
        } else {
            // Legacy: All logos are garment logos
            specsHTML += `<div data-invoice-style="title-embroidery">EMBROIDERY PACKAGE FOR THIS ORDER:</div>`;
            specsHTML += this.generateLogoListHTML(pricingData.logos, alBaseRate, 'garment', logoListOpts);
        }

        // Add setup fees if present. The per-logo rate is DERIVED from the charged
        // total (never a "$100" literal) so the printed arithmetic always foots.
        if (pricingData.setupFees > 0) {
            if (digitizingLogoCount > 0) {
                const rateLabel = digitizingRate > 0 ? digitizingRate.toFixed(2).replace(/\.00$/, '') : String(this.fallbackDigitizingRate());
                specsHTML += `
                    <div data-invoice-style="note">
                        <strong>Setup Fees:</strong> ${digitizingLogoCount} logo${digitizingLogoCount > 1 ? 's' : ''} × $${rateLabel} digitizing = $${pricingData.setupFees.toFixed(2)}
                    </div>
                `;
            }
        }

        // Add LTM notice if applicable (only when NOT distributed into unit prices)
        if (pricingData.ltmFee > 0 && !pricingData.ltmDistributed) {
            const ltmPerPiece = (pricingData.ltmFee / pricingData.totalQuantity).toFixed(2);
            specsHTML += `
                <div data-invoice-style="warning">
                    ⚠ Small Batch Fee: +$${ltmPerPiece} per piece (orders under 8)
                </div>
            `;
        }

        specsHTML += `</div>`;

        return specsHTML;
    }

    /**
     * Generate HTML for a list of logos (used by generateEmbroiderySpecs).
     * opts.alServiceItems = AL prices ACTUALLY charged (from the builder's priced
     * line items); opts.digitizingRate = per-logo digitizing derived from the
     * charged setup total. The hardcoded alBaseRate table + "$100" literals are
     * fallback-only — they can drift from Caspio. (audit 2026-06-10)
     */
    generateLogoListHTML(logos, alBaseRate, type = 'garment', opts = {}) {
        if (!logos || logos.length === 0) return '';

        const alServiceItems = Array.isArray(opts.alServiceItems) ? opts.alServiceItems : [];
        const digitizingLabel = (opts.digitizingRate > 0)
            ? `$${opts.digitizingRate.toFixed(2).replace(/\.00$/, '')}`
            : `$${this.fallbackDigitizingRate()}`;

        let html = '';

        // Cap position display names
        const capPositionNames = {
            'CF': 'Cap Front',
            'CB': 'Cap Back',
            'CL': 'Left Side',
            'CR': 'Right Side'
        };

        // Find primary logo
        const primaryLogo = logos.find(l => l.isPrimary !== false) || logos[0];
        if (primaryLogo) {
            let position = primaryLogo.position || (type === 'cap' ? 'Cap Front' : 'Left Chest');
            // Convert cap position codes to readable names
            if (type === 'cap' && capPositionNames[position]) {
                position = capPositionNames[position];
            }
            const stitchCount = primaryLogo.stitchCount || 8000;
            const extraStitches = stitchCount - 8000;

            // Primary logo (base 8K included)
            html += `
                <div data-invoice-style="detail">
                    ✓ <strong>${this.esc(position)}</strong> (${stitchCount.toLocaleString()} stitches)${primaryLogo.designNumber ? ` &middot; Design #${this.esc(primaryLogo.designNumber)}` : ''} -
                    <span data-invoice-style="included">BASE (8K INCLUDED)</span>
                </div>
            `;

            // Additional stitches NOTE (primary > 8K). The dollar charge is its own line item in
            // the products table (AS-Garm/AS-CAP, a flat tier). Do NOT print a per-piece $ here:
            // the old figure was a hardcoded extraK × $1.25 (e.g. "+$5.00") — WRONG (the real
            // charge is the flat $4/$10 tier) and it double-showed the charge. Note the overage
            // for context; the table line carries the dollars. (2026-06-04 audit B2)
            if (extraStitches > 0 && type === 'garment') {
                const extraK = extraStitches / 1000;
                html += `
                    <div data-invoice-style="logo-detail">
                        + <strong>Additional Stitches</strong> (+${extraK}K over base) -
                        <span data-invoice-style="charge">charged in the line items below</span>
                    </div>
                `;
            }

            // Primary digitizing if needed
            if (primaryLogo.needsDigitizing) {
                html += `
                    <div data-invoice-style="logo-note">
                        + Digitizing: ${digitizingLabel}
                    </div>
                `;
            }
        }

        // Add additional logos with clear pricing and digitizing info
        const additionalLogos = logos.filter(l => l.isPrimary === false);
        if (additionalLogos.length > 0) {
            additionalLogos.forEach((logo) => {
                let position = logo.position || 'Additional Logo';
                // Convert cap position codes to readable names
                if (type === 'cap' && capPositionNames[position]) {
                    position = capPositionNames[position];
                }
                const stitchCount = logo.stitchCount || (type === 'cap' ? 5000 : 8000);
                const extraStitches = Math.max(0, stitchCount - 8000);
                const extraK = extraStitches / 1000;
                const needsDigitizing = logo.needsDigitizing || false;

                // AL per-piece price ACTUALLY charged: the logo's own priced value,
                // else the matching AL service line item the builder passed, else
                // (fallback only) the frozen 2026-02 garment table + $1.25/1K.
                let alUnitPrice = Number(logo.unitPrice);
                if (!Number.isFinite(alUnitPrice) || alUnitPrice <= 0) {
                    const wantCap = (type === 'cap');
                    const posLc = String(logo.position || '').trim().toLowerCase();
                    const match = alServiceItems.find(s => s.isCap === wantCap && s.position && s.position === posLc)
                        || alServiceItems.find(s => s.isCap === wantCap);
                    alUnitPrice = match ? match.unitPrice : (alBaseRate + extraK * 1.25);
                }

                const stitchNote = extraStitches > 0 ? ` (+${extraK}K stitches)` : '';
                const digitizingText = needsDigitizing ? ` [+${digitizingLabel} Digitizing]` : '';

                html += `
                    <div data-invoice-style="detail">
                        ✓ <strong>${this.esc(position)}</strong> (${stitchCount.toLocaleString()} stitches)${stitchNote}${logo.designNumber ? ` &middot; Design #${this.esc(logo.designNumber)}` : ''} -
                        <span data-invoice-style="charge">+$${alUnitPrice.toFixed(2)} per piece</span>
                        <span data-invoice-style="rate-note">${digitizingText}</span>
                    </div>
                `;
            });
        }

        return html;
    }
    
    /**
     * Generate products table using size matrix layout
     * Shows products in a grid with individual columns for each size
     */
    generateProductsTable(pricingData) {
        // Use the new size matrix table format
        return this.generateSizeMatrixTable(pricingData);
    }

    /**
     * Parse size display from item description
     */
    parseSizeDisplay(item) {
        // The description field already contains the properly formatted size breakdown
        // like "S(1) M(2) L(2) XL(1)" or "2XL(3)"
        if (item.description && item.description.includes('(')) {
            return item.description;
        }

        // Fallback if no size information in description
        return item.quantity.toString();
    }

    /**
     * Generate products table for per-size line items (ShopWorks format)
     * Each line item represents one size for one product/color
     *
     * @param {Object} pricingData - Pricing data with perSizeLineItems array
     * @returns {string} HTML table
     */
    generatePerSizeProductsTable(pricingData) {
        if (!pricingData.perSizeLineItems || pricingData.perSizeLineItems.length === 0) {
            return this.generateProductsTable(pricingData);
        }

        const lineItems = pricingData.perSizeLineItems;
        const totalPieces = lineItems.reduce((sum, item) => sum + item.quantity, 0);

        let tableHTML = `
            <div data-invoice-style="product-section">
                <div data-invoice-style="product-heading">
                    👕 Products (${totalPieces} pieces total)
                </div>
                <div class="invoice-table-scroll" role="region" aria-label="Quote line items — scroll to view all sizes and prices" tabindex="0"><table class="products-table">
                    <caption class="sr-only">Quoted products with sizes, unit prices, and line totals</caption>
                    <thead>
                        <tr>
                            <th scope="col" data-invoice-style="part-column">Part #</th>
                            <th scope="col" data-invoice-style="description-column">Description</th>
                            <th scope="col" data-invoice-style="color-column">Color</th>
                            <th scope="col" data-invoice-style="size-column">Size</th>
                            <th scope="col" data-invoice-style="qty-column">Qty</th>
                            <th scope="col" data-invoice-style="unit-column">Unit</th>
                            <th scope="col" data-invoice-style="total-column">Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Group line items by product (partNumber + color)
        const productGroups = this.groupLineItemsByProduct(lineItems);

        for (const [groupKey, items] of Object.entries(productGroups)) {
            // Sort items by size order
            const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL',
                              'LT', 'XLT', '2XLT', '3XLT', 'OSFA', 'S/M', 'M/L', 'L/XL'];
            items.sort((a, b) => {
                const aIdx = sizeOrder.indexOf(a.size) !== -1 ? sizeOrder.indexOf(a.size) : 99;
                const bIdx = sizeOrder.indexOf(b.size) !== -1 ? sizeOrder.indexOf(b.size) : 99;
                return aIdx - bIdx;
            });

            items.forEach((item, index) => {
                const isFirstRow = index === 0;
                const isChildRow = !isFirstRow;
                const rowClass = isChildRow ? 'child-size-row' : 'parent-size-row';

                tableHTML += `
                    <tr class="${rowClass}">
                        <td>${this.esc(item.partNumber)}${item.hasUpcharge ? '' : ''}</td>
                        <td>${isFirstRow ? this.esc(item.description) : ''}</td>
                        <td>${isFirstRow ? this.esc(item.displayColor) : ''}</td>
                        <td data-invoice-style="center">
                            ${item.size}
                            ${item.hasUpcharge ? '<span data-invoice-style="upcharge"> +$' + item.upchargeAmount.toFixed(0) + '</span>' : ''}
                        </td>
                        <td data-invoice-style="center">${item.quantity}</td>
                        <td data-invoice-style="right">$${item.unitPrice.toFixed(2)}</td>
                        <td data-invoice-style="right">$${item.total.toFixed(2)}</td>
                    </tr>
                `;
            });

            // Add subtotal row for this product group
            const groupTotal = items.reduce((sum, item) => sum + item.total, 0);
            const groupQty = items.reduce((sum, item) => sum + item.quantity, 0);
            tableHTML += `
                <tr class="product-group-subtotal" data-invoice-style="group-subtotal">
                    <td colspan="4" data-invoice-style="subtotal-label">
                        ${this.esc(items[0].partNumber)} ${this.esc(items[0].displayColor)} Subtotal:
                    </td>
                    <td data-invoice-style="center">${groupQty}</td>
                    <td></td>
                    <td data-invoice-style="right">$${groupTotal.toFixed(2)}</td>
                </tr>
            `;
        }

        tableHTML += `
                    </tbody>
                </table></div>
            </div>
        `;

        return tableHTML;
    }

    /**
     * Group line items by product (partNumber + catalogColor)
     *
     * @param {Array} lineItems - Array of line items
     * @returns {Object} Grouped line items
     */
    groupLineItemsByProduct(lineItems) {
        const groups = {};

        lineItems.forEach(item => {
            const key = `${item.partNumber}:${item.color}`;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
        });

        return groups;
    }

    /**
     * Parse size breakdown from description string
     * Converts "S(1) M(2) L(3) XL(1)" into {S: 1, M: 2, L: 3, XL: 1}
     * @param {string} description - Description with size(qty) format
     * @returns {Object} Size to quantity mapping
     */
    parseSizeBreakdown(description) {
        const sizes = {};
        if (!description) return sizes;

        const regex = /(\w+)\((\d+)\)/g;
        let match;
        while ((match = regex.exec(description)) !== null) {
            sizes[match[1]] = parseInt(match[2]);
        }
        return sizes;
    }

    /**
     * Aggregate sizes from all line items for a product
     * Combines base sizes (S, M, L, XL) with extended sizes (2XL, 3XL)
     * @param {Array} lineItems - Array of line items for a product
     * @returns {Object} { sizes: {S: 1, M: 2, ...}, pricing: {S: 20.50, 2XL: 22.50, ...}, totalQty, totalAmount }
     */
    aggregateSizesForProduct(lineItems) {
        const sizes = {};
        const pricing = {};
        let totalQty = 0;
        let totalAmount = 0;

        lineItems.forEach(item => {
            const parsed = this.parseSizeBreakdown(item.description);
            Object.entries(parsed).forEach(([size, qty]) => {
                sizes[size] = (sizes[size] || 0) + qty;
                pricing[size] = item.unitPrice; // Track price per size
                totalQty += qty;
            });
            totalAmount += item.total;
        });

        return { sizes, pricing, totalQty, totalAmount };
    }

    /**
     * Determine which size columns to show based on all products
     * Only shows columns that have quantities
     * @param {Array} allProducts - Array of product pricing data
     * @returns {Array} Ordered array of size column names to display
     */
    determineSizeColumns(allProducts) {
        const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', 'LT', 'XLT', '2XLT', '3XLT', 'OSFA'];
        const usedSizes = new Set();

        allProducts.forEach(pp => {
            pp.lineItems.forEach(item => {
                const parsed = this.parseSizeBreakdown(item.description);
                Object.keys(parsed).forEach(size => usedSizes.add(size));
            });
        });

        // Return only used sizes in standard order
        return SIZE_ORDER.filter(size => usedSizes.has(size));
    }

    /**
     * Build price legend showing different unit prices for sizes
     * @param {Object} pricing - Size to price mapping
     * @returns {string} HTML for price legend
     */
    buildPriceLegend(pricing) {
        const prices = Object.entries(pricing);
        if (prices.length === 0) return '';

        // Group sizes by price
        const priceGroups = {};
        prices.forEach(([size, price]) => {
            const priceKey = price.toFixed(2);
            if (!priceGroups[priceKey]) {
                priceGroups[priceKey] = [];
            }
            priceGroups[priceKey].push(size);
        });

        // If all same price, no legend needed
        if (Object.keys(priceGroups).length <= 1) return '';

        // Sort by price ascending
        const sortedPrices = Object.keys(priceGroups).sort((a, b) => parseFloat(a) - parseFloat(b));
        const basePrice = parseFloat(sortedPrices[0]);

        const legendParts = sortedPrices.map(priceKey => {
            const sizes = priceGroups[priceKey];
            const price = parseFloat(priceKey);
            const upcharge = price - basePrice;

            if (upcharge === 0) {
                return `<strong>${sizes.join('-')}</strong>: $${priceKey}`;
            } else {
                return `<strong>${sizes.join(', ')}</strong>: $${priceKey} (+$${upcharge.toFixed(0)})`;
            }
        });

        return `<div class="price-legend">Unit Pricing: ${legendParts.join(' | ')}</div>`;
    }

    /**
     * Generate size matrix table HTML matching on-screen quote builder format
     * Columns: Style | Description | Color | S | M | LG | XL | XXL | XXXL(Other) | Qty | Unit $
     * Each row shows its own values (no rowspan)
     * Extended sizes show qty in XXXL(Other) column
     * @param {Object} pricingData - Full pricing data object
     * @returns {string} HTML table
     */
    generateSizeMatrixTable(pricingData) {
        if (!pricingData.products || pricingData.products.length === 0) {
            // Check for DECG/DECC customer-supplied items before showing "No products"
            if ((pricingData.decgQty > 0) || (pricingData.deccQty > 0)) {
                return this.generateCustomerSuppliedTable(pricingData);
            }
            return '<div data-invoice-style="italic">No products added</div>';
        }

        // Fixed size columns matching quote builder (standardized labels)
        const sizeColumns = ['S', 'M', 'L', 'XL', '2XL', '3XL+'];
        // Extended sizes that go into 3XL+ (Other) column
        // Must include ALL non-standard sizes: tall, youth, toddler, big, combos, one-size
        const extendedSizes = [
            // Extended large
            'XS', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL', 'XXXL',
            // Tall sizes (CRITICAL for tall-only products like TLCS410)
            'LT', 'XLT', '2XLT', '3XLT', '4XLT', '5XLT', '6XLT', 'ST', 'MT', 'XST',
            // One-size
            'OSFA', 'OSFM',
            // Combos (for fitted caps)
            'S/M', 'M/L', 'L/XL', 'XS/S', 'X/2X', 'S/XL',
            // Youth
            'YXS', 'YS', 'YM', 'YL', 'YXL',
            // Toddler
            '2T', '3T', '4T', '5T', '5/6T', '6T',
            // Big
            'LB', 'XLB', '2XLB',
            // Extra small
            'XXS', '2XS', 'XXL'
        ];

        // Track totals
        let grandTotalQty = 0;
        let grandTotalAmount = 0;

        // Build header
        let tableHTML = `
            <div data-invoice-style="product-section">
                <div data-invoice-style="product-heading">
                    Products
                </div>
                <div class="invoice-table-scroll" role="region" aria-label="Quote line items — scroll to view all sizes and prices" tabindex="0"><table class="size-matrix">
                    <thead>
                        <tr>
                            <th scope="col" class="part-col" data-invoice-style="style-column">Style</th>
                            <th scope="col" class="desc-col" data-invoice-style="description-column">Description</th>
                            <th scope="col" class="color-col" data-invoice-style="matrix-description">Color</th>
                            <th scope="col" class="size-col" data-invoice-style="matrix-size">S</th>
                            <th scope="col" class="size-col" data-invoice-style="matrix-size">M</th>
                            <th scope="col" class="size-col" data-invoice-style="matrix-size">L</th>
                            <th scope="col" class="size-col" data-invoice-style="matrix-size">XL</th>
                            <th scope="col" class="size-col" data-invoice-style="matrix-size">2XL</th>
                            <th scope="col" class="size-col" data-invoice-style="matrix-extended">3XL+<br><span data-invoice-style="other-label">(Other)</span></th>
                            <th scope="col" data-invoice-style="matrix-qty">Qty</th>
                            <th scope="col" data-invoice-style="matrix-unit">Unit $</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Build rows - ONE ROW PER LINE ITEM (includes service products)
        pricingData.products.forEach(pp => {
            // Handle SERVICE PRODUCTS (DECG, DECC, AL, MONOGRAM, etc.) - 2026-02 refactor
            if (pp.product?.isService || pp.isService) {
                const serviceType = pp.product?.style || pp.style || 'SERVICE';
                const description = pp.product?.title || pp.title || serviceType;
                const position = pp.product?.position || pp.position || '';
                const isCap = pp.product?.isCap || pp.isCap || false;
                const quantity = pp.product?.totalQuantity || pp.totalQuantity || 0;
                const unitPrice = pp.lineItems?.[0]?.unitPrice || pp.unitPrice || 0;
                const total = pp.lineItems?.[0]?.total || (quantity * unitPrice) || 0;

                grandTotalQty += quantity;
                grandTotalAmount += total;

                // Service row - spans size columns with description
                tableHTML += `
                    <tr class="product-row service-row" data-invoice-style="supplied-row" data-invoice-kind="${isCap ? 'cap' : 'garment'}">
                        <td class="part-cell" data-invoice-style="supplied-label" data-invoice-kind="${isCap ? 'cap' : 'garment'}">${this.esc(serviceType)}</td>
                        <td class="desc-cell" colspan="2">${this.esc(description)}${position && !String(description).includes(position) ? ' - ' + this.esc(position) : ''}</td>
                        <td colspan="6" data-invoice-style="empty-sizes">
                            Service item
                        </td>
                        <td class="qty-cell" data-invoice-style="center">${quantity}</td>
                        <td class="unit-cell" data-invoice-style="right">$${unitPrice.toFixed(2)}</td>
                    </tr>
                `;
                return; // Skip regular product processing
            }

            const numLineItems = pp.lineItems.length;
            const hasExtendedSizes = numLineItems > 1;

            pp.lineItems.forEach((item, index) => {
                const isFirstRow = index === 0;
                // Parse size from description (e.g., "2XLT(2)" → {2XLT: 2})
                const sizes = this.parseSizeBreakdown(item.description);

                grandTotalQty += item.quantity;
                grandTotalAmount += item.total;

                // Determine style/description for this row
                let rowStyle = pp.product.style || '';
                let rowDescription = pp.product.title || '';
                let rowColor = pp.product.color || '';

                // Name the vendor on the printed quote when the blank isn't from SanMar,
                // so the customer (and whoever raises the PO) can see where it comes from.
                // No-op for SanMar products; escaped downstream with the rest of the cell.
                const vendorFn = (typeof window !== 'undefined' && window.vendorLabel);
                const rowVendor = vendorFn ? vendorFn(pp.product.vendorCode) : '';
                if (rowVendor) rowDescription = `${rowDescription} (${rowVendor})`;

                // For extended size rows, modify the style and description
                if (!isFirstRow) {
                    // Extended size row - find which size this is
                    const extSize = Object.keys(sizes)[0]; // e.g., "2XL", "3XL", "2XLT"
                    if (extSize) {
                        // Update style to include suffix (e.g., PC61_2X)
                        rowStyle = this.getExtendedSizeStyle(rowStyle, extSize);
                        // Update description to include size
                        rowDescription = `${rowDescription} - ${extSize}`;
                    }
                }

                // Build size cells - base sizes in their columns, extended in XXXL(Other)
                let sizeCells = '';

                // Check if this line item has extended sizes
                const hasExtInThisRow = Object.keys(sizes).some(s => extendedSizes.includes(s));

                if (isFirstRow && hasExtendedSizes) {
                    // Base row with extended sizes below - show checkmark in 3XL+
                    sizeColumns.forEach(col => {
                        if (col === '3XL+') {
                            sizeCells += `<td class="size-cell" data-invoice-style="accent-strong">✓</td>`;
                        } else {
                            // Map legacy formats: LG -> L, XXL -> 2XL
                            let qty = sizes[col];
                            if (!qty && col === 'L') qty = sizes['LG'];
                            if (!qty && col === '2XL') qty = sizes['XXL'];
                            sizeCells += `<td class="size-cell">${qty ? qty : ''}</td>`;
                        }
                    });
                } else if (hasExtInThisRow) {
                    // Extended size row - show qty in 3XL+ (Other) column
                    const extQty = item.quantity;
                    sizeColumns.forEach(col => {
                        if (col === '3XL+') {
                            sizeCells += `<td class="size-cell">${extQty}</td>`;
                        } else {
                            sizeCells += `<td class="size-cell"></td>`;
                        }
                    });
                } else {
                    // Regular row - show sizes in their columns
                    sizeColumns.forEach(col => {
                        // Map legacy formats: LG -> L, XXL -> 2XL
                        let qty = sizes[col];
                        if (!qty && col === 'L') qty = sizes['LG'];
                        if (!qty && col === '2XL') qty = sizes['XXL'];
                        sizeCells += `<td class="size-cell">${qty ? qty : ''}</td>`;
                    });
                }

                tableHTML += `
                    <tr class="product-row${!isFirstRow ? ' extended-size-row' : ''}">
                        <td class="part-cell">${this.esc(rowStyle)}</td>
                        <td class="desc-cell">${this.esc(rowDescription)}</td>
                        <td class="color-cell">${this.esc(rowColor)}</td>
                        ${sizeCells}
                        <td class="qty-cell" data-invoice-style="center">${item.quantity}</td>
                        <td class="unit-cell" data-invoice-style="right">$${item.unitPrice.toFixed(2)}</td>
                    </tr>
                `;
            });
        });

        // Build totals row
        tableHTML += `
                <tr class="totals-row">
                    <td colspan="3" data-invoice-style="total-label"><strong>TOTAL:</strong></td>
                    <td colspan="6"></td>
                    <td class="qty-cell" data-invoice-style="center"><strong>${grandTotalQty}</strong></td>
                    <td class="unit-cell" data-invoice-style="right"><strong>$${grandTotalAmount.toFixed(2)}</strong></td>
                </tr>
                    </tbody>
                </table></div>
            </div>
        `;

        return tableHTML;
    }

    /**
     * Generate table for DECG/DECC customer-supplied items (no SanMar products)
     * Used when a quote has only customer-supplied garments/caps
     */
    generateCustomerSuppliedTable(pricingData) {
        let grandTotalQty = 0;
        let grandTotalAmount = 0;

        let tableHTML = `
            <div data-invoice-style="product-section">
                <div data-invoice-style="product-heading">
                    Products
                </div>
                <div class="invoice-table-scroll" role="region" aria-label="Quote line items — scroll to view all sizes and prices" tabindex="0"><table class="size-matrix">
                    <thead>
                        <tr>
                            <th scope="col" class="part-col" data-invoice-style="color-column">Part #</th>
                            <th scope="col" data-invoice-style="wide-description">Description</th>
                            <th scope="col" data-invoice-style="service-qty">Qty</th>
                            <th scope="col" data-invoice-style="service-total">Unit Price</th>
                            <th scope="col" data-invoice-style="service-total">Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // DECG row
        if (pricingData.decgQty > 0) {
            grandTotalQty += pricingData.decgQty;
            grandTotalAmount += pricingData.decgTotal;
            tableHTML += `
                <tr class="product-row">
                    <td class="part-cell" data-invoice-style="semibold">DECG</td>
                    <td>Customer-Supplied Garments — Embroidery</td>
                    <td data-invoice-style="center">${pricingData.decgQty}</td>
                    <td data-invoice-style="right">$${pricingData.decgUnit.toFixed(2)}</td>
                    <td data-invoice-style="right">$${pricingData.decgTotal.toFixed(2)}</td>
                </tr>
            `;
        }

        // DECC row
        if (pricingData.deccQty > 0) {
            grandTotalQty += pricingData.deccQty;
            grandTotalAmount += pricingData.deccTotal;
            tableHTML += `
                <tr class="product-row">
                    <td class="part-cell" data-invoice-style="semibold">DECC</td>
                    <td>Customer-Supplied Caps — Embroidery</td>
                    <td data-invoice-style="center">${pricingData.deccQty}</td>
                    <td data-invoice-style="right">$${pricingData.deccUnit.toFixed(2)}</td>
                    <td data-invoice-style="right">$${pricingData.deccTotal.toFixed(2)}</td>
                </tr>
            `;
        }

        // Totals row
        tableHTML += `
                <tr class="totals-row">
                    <td colspan="2" data-invoice-style="total-label"><strong>TOTAL:</strong></td>
                    <td data-invoice-style="center"><strong>${grandTotalQty}</strong></td>
                    <td></td>
                    <td data-invoice-style="right"><strong>$${grandTotalAmount.toFixed(2)}</strong></td>
                </tr>
                    </tbody>
                </table></div>
            </div>
        `;

        return tableHTML;
    }

    /**
     * Convert base style to extended size style
     * e.g., "PC61" + "2XL" -> "PC61_2X"
     */
    getExtendedSizeStyle(baseStyle, size) {
        if (!baseStyle || !size) return baseStyle;

        // Map size names to style suffixes
        const suffixMap = {
            '2XL': '_2X',
            'XXL': '_XXL',
            '3XL': '_3XL',
            'XXXL': '_XXXL',
            '4XL': '_4XL',
            '5XL': '_5XL',
            '6XL': '_6XL',
            'XS': '_XS'
        };

        const suffix = suffixMap[size] || '';
        return suffix ? `${baseStyle}${suffix}` : baseStyle;
    }

    /**
     * Generate totals section
     */
    generateTotalsSection(pricingData, taxAmount, totalWithTax, taxRate, baseForTax) {
        const taxPct = +(((taxRate != null ? taxRate : this.taxRate) * 100).toFixed(2));
        // The closing "Subtotal" (after the itemized fee/discount rows) must equal
        // the tax base so the rows reconcile to GRAND TOTAL. Falls back to grandTotal.
        const adjustedSubtotal = (baseForTax != null && !isNaN(baseForTax)) ? baseForTax : pricingData.grandTotal;
        return `
            <div class="totals-section">
                <div class="total-row subtotal-row">
                    <span>Subtotal:</span>
                    <span>$${(pricingData.grandTotal - (pricingData.setupFees || 0)).toFixed(2)}</span>
                </div>
                ${pricingData.additionalServicesTotal > 0 ? `
                <div class="total-row">
                    <span>Additional Services:</span>
                    <span>$${pricingData.additionalServicesTotal.toFixed(2)}</span>
                </div>` : ''}
                ${pricingData.setupFees > 0 ? `
                <div class="total-row">
                    <span>Setup Fees:</span>
                    <span>$${pricingData.setupFees.toFixed(2)}</span>
                </div>` : ''}
                ${(pricingData.ltmFee || 0) > 0 && !pricingData.ltmDistributed ? `
                <div class="total-row">
                    <span>Less Than Minimum Fee:</span>
                    <span>$${pricingData.ltmFee.toFixed(2)}</span>
                </div>` : ''}
                ${pricingData.safetyStripesTotal > 0 ? `
                <div class="total-row">
                    <span>Safety Stripes Surcharge:</span>
                    <span>$${pricingData.safetyStripesTotal.toFixed(2)}</span>
                </div>` : ''}
                ${(pricingData.artCharge || 0) > 0 ? `
                <div class="total-row">
                    <span>Logo Mockup & Review:</span>
                    <span>$${pricingData.artCharge.toFixed(2)}</span>
                </div>` : ''}
                ${(pricingData.graphicDesignFee || pricingData.graphicDesignCharge || 0) > 0 ? `
                <div class="total-row">
                    <span>Graphic Design (${pricingData.graphicDesignHours || 0} hrs${(pricingData.graphicDesignHours || 0) > 0 ? ` × $${((pricingData.graphicDesignFee || pricingData.graphicDesignCharge || 0) / pricingData.graphicDesignHours).toFixed(2)}/hr` : ''}):</span>
                    <span>$${(pricingData.graphicDesignFee || pricingData.graphicDesignCharge).toFixed(2)}</span>
                </div>` : ''}
                ${(pricingData.rushFee || 0) > 0 ? `
                <div class="total-row">
                    <span>Rush Fee:</span>
                    <span>$${pricingData.rushFee.toFixed(2)}</span>
                </div>` : ''}
                ${(pricingData.vellumFee || 0) > 0 ? `
                <div class="total-row">
                    <span>Vellum Print${(pricingData.vellumQty || 0) > 0 ? ` (${pricingData.vellumQty} × $${(pricingData.vellumFee / pricingData.vellumQty).toFixed(2)})` : ''}:</span>
                    <span>$${pricingData.vellumFee.toFixed(2)}</span>
                </div>` : ''}
                ${(pricingData.colorChangeFee || 0) > 0 ? `
                <div class="total-row">
                    <span>Color Change${(pricingData.colorChangeQty || 0) > 0 ? ` (${pricingData.colorChangeQty} × $${(pricingData.colorChangeFee / pricingData.colorChangeQty).toFixed(2)})` : ''}:</span>
                    <span>$${pricingData.colorChangeFee.toFixed(2)}</span>
                </div>` : ''}
                ${(pricingData.shippingFee || 0) > 0 ? `
                <div class="total-row">
                    <span>Shipping:</span>
                    <span>$${pricingData.shippingFee.toFixed(2)}</span>
                </div>` : ''}
                ${(pricingData.discount || 0) > 0 ? `
                <div class="total-row discount-row">
                    <span>Discount${pricingData.discountReason ? ` (${this.esc(pricingData.discountReason)})` : ''}:</span>
                    <span>-$${pricingData.discount.toFixed(2)}</span>
                </div>` : ''}
                ${(pricingData.additionalServicesTotal > 0 || pricingData.setupFees > 0 || ((pricingData.ltmFee || 0) > 0 && !pricingData.ltmDistributed) || pricingData.safetyStripesTotal > 0 || (pricingData.artCharge || 0) > 0 || (pricingData.graphicDesignFee || pricingData.graphicDesignCharge || 0) > 0 || (pricingData.rushFee || 0) > 0 || (pricingData.vellumFee || 0) > 0 || (pricingData.colorChangeFee || 0) > 0 || (pricingData.shippingFee || 0) > 0 || (pricingData.discount || 0) > 0) ? `
                <div class="total-row subtotal-row">
                    <span>Subtotal:</span>
                    <span>$${adjustedSubtotal.toFixed(2)}</span>
                </div>` : ''}
                ${taxAmount > 0 ? `<div class="total-row tax-row">
                    <span>Sales Tax (${taxPct}%):</span>
                    <span>$${taxAmount.toFixed(2)}</span>
                </div>` : ''}
                <div class="total-row grand-total">
                    <span>GRAND TOTAL:</span>
                    <span>$${totalWithTax.toFixed(2)}</span>
                </div>
            </div>
        `;
    }
    
    /**
     * Generate footer
     */
    generateFooter(customerData) {
        return `
            <div class="invoice-footer">
                <div class="footer-section">
                    <div class="footer-title">PAYMENT TERMS:</div>
                    <div class="footer-text">50% deposit required to begin production. Balance due at pickup.</div>
                </div>
                <div class="footer-section">
                    <div class="footer-title">QUOTE VALIDITY:</div>
                    <div class="footer-text">This quote is valid for 30 days from the date of issue. Prices subject to change after expiration.</div>
                </div>
                ${customerData.notes ? `
                <div class="footer-section">
                    <div class="footer-title">SPECIAL NOTES:</div>
                    <div class="footer-text">${this.esc(customerData.notes)}</div>
                </div>` : ''}
                <div class="tagline">Family Owned & Operated Since 1977</div>
            </div>
        `;
    }
}

// Make available globally
window.EmbroideryInvoiceGenerator = EmbroideryInvoiceGenerator;