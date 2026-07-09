/**
 * EMB service-pricing-review modal — roadmap 0.4 extraction #2 (2026-07-07).
 *
 * The review step shown during ShopWorks import for AL/DECG/DECC/Monogram/FB
 * service items: per-item pricing source (builtin vs custom), product source
 * pickers, EMB config (position/stitch tier/cap embellishment), LTM default,
 * and the apply/cancel promise plumbing the import flow awaits
 * (window.showServicePricingReview(...) resolves with services/products/embConfig).
 *
 * Moved verbatim from embroidery-quote-builder.js (942-line contiguous
 * cluster). One adaptation: the import cluster's read of _sprEmbConfigOptions
 * goes through the exported getSprEmbConfigOptions() accessor (the state is
 * module-private now); it becomes a real import when cluster #10 extracts.
 */
// @ts-nocheck — MOVED legacy DOM code: pre-existing checkJs frictions; typing
// lands with this cluster's render/state split (see emb-decomposition-plan.md).
/* global escapeHtml, DesignThumbnailService */
import { mapStitchCountToTierValue } from './logo-config.js';
import { embState } from './state.js';

// ============================================================
// SERVICE PRICING REVIEW MODAL
// Shows during ShopWorks import for AL/DECG/DECC/Monogram/FB
// ============================================================

// Promise resolve/reject for the review modal
let _sprResolve = null;
// eslint-disable-next-line no-unused-vars -- written on close for symmetry; reject path never wired (pre-existing)
let _sprReject = null;
let _sprItems = [];
let _sprProductItems = [];
let _sprEmbConfigOptions = null;

/**
 * Show the pricing review modal and return a Promise
 * Supports both product items (SanMar products) and service items (AL/DECG/DECC/Monogram)
 * @param {Array} serviceItems - Array of { type, quantity, stitchCount, isCap, shopWorksPrice, apiPrice, label }
 * @param {Array} productItems - Array of { partNumber, color, sizes, unitPrice, isCap, sizePrices, totalQty, description }
 * @returns {Promise<Object>} Resolves to { services: [...], products: [...] } or null if cancelled
 */
/** Review modal — products section: per-product 4-column size table
 * (Sizes | ShopWorks | API | Custom) with price-source radios. */
function renderSprProductsSection(productItems) {
    // === PRODUCTS SECTION ===
    const productsSection = document.getElementById('spr-products-section');
    const productsContainer = document.getElementById('spr-products-container');

    if (productItems.length > 0) {
        productsSection.style.display = '';
        let pHtml = '';

        productItems.forEach((prod, pIdx) => {
            const swPrice = prod.unitPrice || 0;
            const swAvail = swPrice > 0;
            const apiAvail = prod.sizePrices != null;
            const defaultSel = swAvail ? 'sw' : (apiAvail ? 'api' : 'custom');

            pHtml += `<div class="spr-product-card" data-spr-pidx="${pIdx}">`;
            pHtml += `<div class="spr-product-header">`;
            pHtml += `<span class="spr-product-title">${escapeHtml(prod.partNumber)} ${escapeHtml(prod.color || '')}</span>`;
            pHtml += `</div>`;

            // Size breakdown as table with 4 columns: Sizes | ShopWorks | API | Custom
            pHtml += `<div class="spr-product-sizes">`;
            pHtml += `<table class="spr-table spr-product-table"><thead><tr>`;
            pHtml += `<th>Sizes</th><th>ShopWorks</th><th>API</th><th>Custom</th>`;
            pHtml += `</tr></thead><tbody>`;

            const sizeGroups = _groupSizesForReview(prod.sizes, prod.sizePrices, swPrice);
            sizeGroups.forEach((group, gIdx) => {
                pHtml += `<tr>`;
                // Size label column
                pHtml += `<td class="spr-size-label-cell">${escapeHtml(group.label)}</td>`;

                if (gIdx === 0) {
                    // First row: radio buttons + prices
                    // ShopWorks column
                    pHtml += `<td class="spr-radio-cell">`;
                    if (swAvail) {
                        pHtml += `<label><input type="radio" name="spr-psource-${pIdx}" value="sw" ${defaultSel === 'sw' ? 'checked' : ''} onchange="onSprProductSourceChange(${pIdx})"><span class="spr-price-label">$${swPrice.toFixed(2)}</span></label>`;
                    } else {
                        pHtml += `<span class="spr-price-label disabled">$0.00</span>`;
                    }
                    pHtml += `</td>`;

                    // API column
                    pHtml += `<td class="spr-radio-cell">`;
                    if (apiAvail) {
                        pHtml += `<label><input type="radio" name="spr-psource-${pIdx}" value="api" ${defaultSel === 'api' ? 'checked' : ''} onchange="onSprProductSourceChange(${pIdx})"><span class="spr-price-label">${group.apiPrice != null ? '$' + group.apiPrice.toFixed(2) : '—'}</span></label>`;
                    } else {
                        pHtml += `<span class="spr-unavailable">(unavailable)</span>`;
                    }
                    pHtml += `</td>`;

                    // Custom column
                    pHtml += `<td class="spr-radio-cell">`;
                    pHtml += `<label><input type="radio" name="spr-psource-${pIdx}" value="custom" ${defaultSel === 'custom' ? 'checked' : ''} onchange="onSprProductSourceChange(${pIdx})">`;
                    pHtml += `<input type="number" class="spr-custom-input${defaultSel !== 'custom' ? ' spr-muted' : ''}" id="spr-pcustom-${pIdx}" step="0.01" min="0" placeholder="0.00" onfocus="onSprCustomProductFocus(${pIdx})" oninput="onSprCustomProductFocus(${pIdx})"></label>`;
                    pHtml += `</td>`;
                } else {
                    // Subsequent rows: just prices (no radios), aligned under radio+price above
                    pHtml += `<td class="spr-radio-cell"><span class="spr-price-label qb-pl18">$${swPrice.toFixed(2)}</span></td>`;
                    pHtml += `<td class="spr-radio-cell"><span class="spr-price-label qb-pl18">${group.apiPrice != null ? '$' + group.apiPrice.toFixed(2) : '—'}</span></td>`;
                    pHtml += `<td>&nbsp;</td>`;
                }
                pHtml += `</tr>`;
            });

            pHtml += `</tbody></table></div></div>`;
        });

        // eslint-disable-next-line no-unsanitized/property -- audited (1.4): numeric prices/indices + internal enums; typeUpper escapeHtml-wrapped
        productsContainer.innerHTML = pHtml;
    } else {
        productsSection.style.display = 'none';
        productsContainer.innerHTML = '';
    }
}

/** Review modal — services section (AL / DECG / DECC / Monogram rows with
 * SW-vs-API price choice + custom input). */
function renderSprServicesSection(serviceItems) {
    // === SERVICES SECTION ===
    const servicesSection = document.getElementById('spr-services-section');
    const tbody = document.getElementById('spr-table-body');

    if (serviceItems.length > 0) {
        servicesSection.style.display = '';
        let html = '';
        let issueCount = 0;

        serviceItems.forEach((item, idx) => {
            const typeUpper = (item.type || '').toUpperCase();
            const badgeClass = 'spr-type-' + (item.type || '').toLowerCase().replace(/[^a-z]/g, '');
            const hasStitches = !['monogram'].includes((item.type || '').toLowerCase());
            const swPrice = item.shopWorksPrice;
            const apiPrice = item.apiPrice;
            const swAvail = swPrice != null && swPrice > 0;
            const apiAvail = apiPrice != null;

            // Delta calculation
            let deltaBadgeHtml = '';
            if (swAvail && apiAvail && apiPrice > 0) {
                const deltaPct = ((swPrice - apiPrice) / apiPrice) * 100;
                const absPct = Math.abs(deltaPct);
                const deltaAmt = Math.abs(swPrice - apiPrice);
                let cls, label;
                if (absPct <= 5) { cls = 'ok'; label = 'OK'; }
                else if (absPct <= 15) { cls = 'review'; label = (deltaPct >= 0 ? '+' : '') + deltaPct.toFixed(0) + '%'; issueCount++; }
                else { cls = 'mismatch'; label = (deltaPct >= 0 ? '+' : '') + deltaPct.toFixed(0) + '%'; issueCount++; }
                const tooltip = cls !== 'ok' ? ` title="$${deltaAmt.toFixed(2)} difference"` : '';
                deltaBadgeHtml = `<span class="spr-delta-badge ${cls}"${tooltip}>${label}</span>`;
            }

            let defaultSel = apiAvail ? 'api' : (swAvail ? 'sw' : 'custom');

            html += `<tr data-spr-idx="${idx}">`;
            html += `<td><span class="spr-type-badge ${badgeClass}">${escapeHtml(typeUpper)}</span></td>`;
            html += `<td>${item.quantity}</td>`;

            if (hasStitches) {
                html += `<td><input type="number" class="spr-stitch-input" id="spr-stitch-${idx}" value="${item.stitchCount || 8000}" min="1000" max="200000" step="1000" onchange="onSprStitchChange(${idx})"></td>`;
            } else {
                html += `<td style="text-align:center; color:#94a3b8;">&mdash;</td>`;
            }

            html += `<td class="spr-radio-cell">`;
            if (swAvail) {
                html += `<label><input type="radio" name="spr-source-${idx}" value="sw" ${defaultSel === 'sw' ? 'checked' : ''} onchange="onSprSourceChange(${idx})"><span class="spr-price-label">$${swPrice.toFixed(2)}</span></label>`;
            } else {
                html += `<span class="spr-price-label disabled">$0.00</span>`;
            }
            html += `</td>`;

            html += `<td class="spr-radio-cell">`;
            if (apiAvail) {
                html += `<label><input type="radio" name="spr-source-${idx}" value="api" ${defaultSel === 'api' ? 'checked' : ''} onchange="onSprSourceChange(${idx})"><span class="spr-price-label" id="spr-api-price-${idx}">$${apiPrice.toFixed(2)}</span></label>`;
            } else {
                html += `<span class="spr-unavailable">(unavailable)</span>`;
            }
            html += `</td>`;

            html += `<td class="spr-radio-cell">`;
            html += `<label><input type="radio" name="spr-source-${idx}" value="custom" ${defaultSel === 'custom' ? 'checked' : ''} onchange="onSprSourceChange(${idx})">`;
            html += `<input type="number" class="spr-custom-input${defaultSel !== 'custom' ? ' spr-muted' : ''}" id="spr-custom-${idx}" step="0.01" min="0" placeholder="0.00" onfocus="onSprCustomServiceFocus(${idx})" oninput="onSprCustomServiceFocus(${idx})"></label>`;
            html += `</td>`;

            html += `<td style="text-align:center;">${deltaBadgeHtml}</td>`;
            html += `</tr>`;

            // DECG/DECC per-item detail row (expandable if aggregated)
            if ((typeUpper === 'DECG' || typeUpper === 'DECC') && item._sourceItems && item._sourceItems.length > 1) {
                html += `<tr class="spr-decg-detail"><td colspan="7">`;
                html += `<details><summary style="cursor:pointer; font-size:11px; color:#64748b;">${item._sourceItems.length} individual items</summary>`;
                html += `<table style="width:100%; margin-top:4px;">`;
                for (const si of item._sourceItems) {
                    const siSw = si.unitPrice || 0;
                    const siApi = item.apiPrice || 0;
                    const siDelta = siApi > 0 ? ((siSw - siApi) / siApi * 100) : 0;
                    const siCls = Math.abs(siDelta) <= 5 ? 'ok' : Math.abs(siDelta) <= 15 ? 'review' : 'mismatch';
                    html += `<tr>`;
                    html += `<td class="detail-label">Qty ${si.quantity || 1}</td>`;
                    html += `<td>SW: $${siSw.toFixed(2)}</td>`;
                    html += `<td>API: $${siApi.toFixed(2)}</td>`;
                    html += `<td><span class="spr-delta-badge ${siCls}">${siDelta >= 0 ? '+' : ''}${siDelta.toFixed(0)}%</span></td>`;
                    html += `</tr>`;
                }
                html += `</table></details></td></tr>`;
            }
        });

        // Insert warning banner if there are pricing issues
        const warningEl = document.getElementById('spr-delta-warning');
        if (warningEl) warningEl.remove();
        if (issueCount > 0) {
            const warningDiv = document.createElement('div');
            warningDiv.id = 'spr-delta-warning';
            warningDiv.className = 'spr-delta-warning';
            // eslint-disable-next-line no-unsanitized/property -- audited (1.4): numeric prices/indices + internal enums; typeUpper escapeHtml-wrapped
            warningDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <span>${escapeHtml(String(issueCount))} service item${issueCount > 1 ? 's have' : ' has'} significant price differences from 2026 pricing</span>`;
            const tableWrapper = servicesSection.querySelector('.spr-table-wrapper');
            servicesSection.insertBefore(warningDiv, tableWrapper);
        }

        // eslint-disable-next-line no-unsanitized/property -- audited (1.4): numeric prices/indices + internal enums; typeUpper escapeHtml-wrapped
        tbody.innerHTML = html;
    } else {
        servicesSection.style.display = 'none';
        tbody.innerHTML = '';
    }
}

/** Review modal — embroidery config section: design-lookup banner (entries,
 * thumbnails, per-design assignment + the DEFERRED auto-tier recalc closure),
 * garment/cap config, LTM smart default.
 * NOTE >150-line ALLOWLIST (emb-function-length.test.js): one cohesive closure
 * machine — the deferred _recalcDesignAssignments closure reads/writes the
 * tier state across its whole span; splitting it needs jsdom coverage first. */
function renderSprEmbConfigSection(embConfigOptions) {
    // === EMBROIDERY CONFIG SECTION ===
    const embConfigSection = document.getElementById('spr-embconfig-section');
    if (embConfigOptions) {
        embConfigSection.style.display = '';

        // Design info banner — enhanced with stitch count lookup + per-design assignment
        const designBanner = document.getElementById('spr-design-info-banner');
        const lookup = embConfigOptions.designLookup;
        let autoGarmentTier = '8000';
        let autoGarmentPosition = 'Left Chest';
        let autoGarmentStitchCount = 8000;
        let autoCapTier = '8000';
        let hasFullBack = false;

        // Build unified design list from parser + DB lookup + fallback
        const rawDesignNums = embConfigOptions.designNumbersRaw || [];
        const rawDesignLabels = embConfigOptions.designNumbers || [];
        const fallbackDesigns = lookup?.fallbackDesigns || {};
        const designEntries = []; // { num, label, dbInfo (or null), inDb, fallbackInfo (or null) }

        for (let di = 0; di < rawDesignNums.length; di++) {
            const num = rawDesignNums[di];
            const label = rawDesignLabels[di] || `Design #${num}`;
            const dbInfo = lookup?.designs?.[num] || null;
            const fallbackInfo = !dbInfo ? (fallbackDesigns[num] || null) : null;
            designEntries.push({ num, label, dbInfo, inDb: !!dbInfo, fallbackInfo });
        }
        // Also include DB-found designs not in parser list (rare edge case)
        if (lookup?.designs) {
            for (const [num, info] of Object.entries(lookup.designs)) {
                if (!designEntries.find(d => d.num === num)) {
                    designEntries.push({ num, label: `Design #${num}`, dbInfo: info, inDb: true, fallbackInfo: null });
                }
            }
        }

        // Extract FB price tiers from first Full Back design found
        let fbPriceTiersFromLookup = null;

        if (designEntries.length > 0) {
            let bannerHtml = '';
            const showAssignment = designEntries.length >= 2 && (embConfigOptions.hasGarments || embConfigOptions.hasCaps);

            if (showAssignment) {
                bannerHtml += `<div style="font-size:11px;font-weight:600;color:#1e40af;margin-bottom:6px;"><i class="fas fa-object-group qb-mr4"></i>Design Logo Assignment</div>`;
            }

            // Smart auto-assign defaults
            // Sort by stitch count descending for DB-found designs
            const sortedEntries = [...designEntries];
            if (sortedEntries.every(e => e.inDb)) {
                sortedEntries.sort((a, b) => (b.dbInfo?.maxStitchCount || 0) - (a.dbInfo?.maxStitchCount || 0));
            }
            const defaultAssignments = {};
            if (showAssignment) {
                if (embConfigOptions.hasGarments && embConfigOptions.hasCaps) {
                    // First/highest → garment, second/lowest → cap
                    defaultAssignments[sortedEntries[0].num] = 'garment';
                    if (sortedEntries.length >= 2) defaultAssignments[sortedEntries[1].num] = 'cap';
                    for (let i = 2; i < sortedEntries.length; i++) defaultAssignments[sortedEntries[i].num] = 'none';
                } else if (embConfigOptions.hasGarments) {
                    sortedEntries.forEach(e => { defaultAssignments[e.num] = 'garment'; });
                } else {
                    sortedEntries.forEach(e => { defaultAssignments[e.num] = 'cap'; });
                }
            }

            // Track max stitch for garment auto-tier and FB detection
            let maxStitchCount = 0;
            let maxStitchTier = 'Standard';
            let maxAsSurcharge = 0;

            for (const entry of designEntries) {
                const { num, label, dbInfo, inDb, fallbackInfo } = entry;

                // Design entry row with optional thumbnail
                const thumbUrl = inDb ? (dbInfo.mockupUrl || dbInfo.dstPreviewUrl || dbInfo.thumbnailUrl || dbInfo.artworkUrl || '') : '';
                const designNameText = inDb ? (dbInfo.designName || '') : (fallbackInfo?.designName || '');

                bannerHtml += `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;flex-wrap:wrap;">`;
                if (thumbUrl) {
                    bannerHtml += `<img src="${escapeHtml(thumbUrl)}" alt="Design #${escapeHtml(num)}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;border:1px solid #ddd;flex-shrink:0;" onerror="this.style.display='none'">`;
                }
                bannerHtml += `<span id="spr-thumb-${escapeHtml(num)}" style="display:none;"></span>`;
                bannerHtml += `<strong>#${escapeHtml(num)}</strong>`;
                if (designNameText) {
                    bannerHtml += `<span style="color:#64748b;font-size:11px;font-style:italic;">${escapeHtml(designNameText.length > 30 ? designNameText.substring(0, 28) + '...' : designNameText)}</span>`;
                }

                if (inDb) {
                    const sc = dbInfo.maxStitchCount;
                    const tier = dbInfo.maxStitchTier || 'Standard';
                    const surcharge = dbInfo.maxAsSurcharge || 0;
                    const scFormatted = sc.toLocaleString();

                    bannerHtml += `<span class="qb-ink">${escapeHtml(dbInfo.company || '')}</span>`;
                    bannerHtml += `<span class="qb-blue-bold">${scFormatted} stitches</span>`;

                    let tierBadge = '';
                    if (tier === 'Full Back') {
                        tierBadge = '<span class="qb-pill-red">Full Back</span>';
                        if (!fbPriceTiersFromLookup && dbInfo.hasFBPricing) {
                            const fbVariant = dbInfo.variants.find(v => v.fbPrice1_7 > 0);
                            if (fbVariant) {
                                fbPriceTiersFromLookup = {
                                    fbPrice1_7: fbVariant.fbPrice1_7,
                                    fbPrice8_23: fbVariant.fbPrice8_23,
                                    fbPrice24_47: fbVariant.fbPrice24_47,
                                    fbPrice48_71: fbVariant.fbPrice48_71,
                                    fbPrice72plus: fbVariant.fbPrice72plus
                                };
                            }
                        }
                    } else if (surcharge > 0) {
                        tierBadge = `<span class="qb-pill-amber">${escapeHtml(tier)} +$${surcharge}/pc</span>`;
                    } else {
                        tierBadge = '<span class="qb-pill-green">Standard</span>';
                    }
                    bannerHtml += tierBadge;

                    if (dbInfo.variants && dbInfo.variants.length > 1) {
                        bannerHtml += `<span class="qb-note-11">(${dbInfo.variants.length} variants)</span>`;
                    }
                } else if (fallbackInfo && fallbackInfo.hasStitchData) {
                    // Fallback WITH stitch data — treat like master hit
                    const sc = fallbackInfo.stitchCount;
                    const tier = fallbackInfo.stitchTier || 'Standard';
                    const surcharge = fallbackInfo.asSurcharge || 0;
                    const scFormatted = sc.toLocaleString();

                    bannerHtml += `<span class="qb-ink">${escapeHtml(fallbackInfo.companyName || '')}</span>`;
                    bannerHtml += `<span class="qb-blue-bold">${scFormatted} stitches</span>`;

                    let tierBadge = '';
                    if (tier === 'Full Back') {
                        tierBadge = '<span class="qb-pill-red">Full Back</span>';
                    } else if (surcharge > 0) {
                        tierBadge = `<span class="qb-pill-amber">${escapeHtml(tier)} +$${surcharge}/pc</span>`;
                    } else {
                        tierBadge = '<span class="qb-pill-green">Standard</span>';
                    }
                    bannerHtml += tierBadge;
                    if (fallbackInfo.threadColors) {
                        bannerHtml += `<span class="qb-note-11" title="${escapeHtml(fallbackInfo.threadColors)}">${fallbackInfo.colorCount} colors</span>`;
                    }

                    // Promote fallback to dbInfo-like shape for auto-tier logic
                    entry.inDb = true;
                    entry.dbInfo = {
                        maxStitchCount: sc,
                        maxStitchTier: tier,
                        maxAsSurcharge: surcharge,
                        company: fallbackInfo.companyName,
                        hasFBPricing: false,
                        variants: [{ stitchCount: sc, stitchTier: tier, asSurcharge: surcharge }]
                    };
                } else if (fallbackInfo) {
                    // Fallback WITHOUT stitch data — name/company/colors only
                    if (fallbackInfo.companyName) {
                        bannerHtml += `<span class="qb-ink">${escapeHtml(fallbackInfo.companyName)}</span>`;
                    }
                    if (fallbackInfo.designName) {
                        bannerHtml += `<span style="color:#64748b;font-size:11px;">${escapeHtml(fallbackInfo.designName)}</span>`;
                    }
                    bannerHtml += '<span style="background:#d97706;color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;margin-left:4px;">No stitch data</span>';
                    if (fallbackInfo.threadColors) {
                        bannerHtml += `<span class="qb-note-11" title="${escapeHtml(fallbackInfo.threadColors)}">${fallbackInfo.colorCount} colors</span>`;
                    }
                } else {
                    // Not found in either table
                    const nameMatch = label.match(/—\s*(.+)/);
                    if (nameMatch) {
                        bannerHtml += `<span class="qb-ink">${escapeHtml(nameMatch[1].trim())}</span>`;
                    }
                    bannerHtml += '<span style="background:#94a3b8;color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;margin-left:4px;">Not in database</span>';
                }

                // Assignment dropdown (only for 2+ designs)
                if (showAssignment) {
                    const defaultVal = defaultAssignments[num] || 'garment';
                    bannerHtml += `<select id="spr-design-assign-${escapeHtml(num)}" data-design-num="${escapeHtml(num)}" class="spr-design-assign" style="margin-left:auto;padding:2px 6px;font-size:11px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;">`;
                    if (embConfigOptions.hasGarments) bannerHtml += `<option value="garment"${defaultVal === 'garment' ? ' selected' : ''}>Garment Logo</option>`;
                    if (embConfigOptions.hasCaps) bannerHtml += `<option value="cap"${defaultVal === 'cap' ? ' selected' : ''}>Cap Logo</option>`;
                    bannerHtml += `<option value="both"${defaultVal === 'both' ? ' selected' : ''}>Both</option>`;
                    bannerHtml += `<option value="none"${defaultVal === 'none' ? ' selected' : ''}>None (skip)</option>`;
                    bannerHtml += `</select>`;
                }

                bannerHtml += `</div>`;
            }

            designBanner.style.display = '';
            designBanner.style.background = '#eff6ff';
            const headerText = showAssignment ? '' : '<div style="font-size:11px;font-weight:600;color:#1e40af;margin-bottom:4px;"><i class="fas fa-search qb-mr4"></i>Design Stitch Lookup</div>';
            // eslint-disable-next-line no-unsanitized/property -- audited (1.4): numeric prices/indices + internal enums; typeUpper escapeHtml-wrapped
            designBanner.innerHTML = headerText + bannerHtml;

            // Fetch design thumbnails for the banner (non-blocking)
            if (typeof DesignThumbnailService !== 'undefined' && designEntries.length > 0) {
                const sprDesignNums = designEntries.map(e => e.num);
                DesignThumbnailService.fetchThumbnailsBatch(sprDesignNums).then(thumbMap => {
                    for (const [dn, url] of Object.entries(thumbMap)) {
                        if (url) {
                            const slot = document.getElementById('spr-thumb-' + dn);
                            if (slot) {
                                slot.innerHTML = '<img src="' + escapeHtml(url) + '" class="spr-design-thumb" alt="Design #' + escapeHtml(dn) + '" onerror="this.parentElement.style.display=\'none\'">';
                                slot.style.display = 'inline-block';
                            }
                        }
                    }
                });
            }

            // Function to recalculate auto-tiers from assignment dropdowns
            function _recalcDesignAssignments() {
                let garmentDesignNum = null;
                let capDesignNum = null;

                if (showAssignment) {
                    const selects = designBanner.querySelectorAll('.spr-design-assign');
                    selects.forEach(sel => {
                        const dNum = sel.dataset.designNum;
                        const val = sel.value;
                        if (val === 'garment' || val === 'both') {
                            if (!garmentDesignNum) garmentDesignNum = dNum;
                        }
                        if (val === 'cap' || val === 'both') {
                            if (!capDesignNum) capDesignNum = dNum;
                        }
                    });
                } else if (designEntries.length === 1) {
                    // Single design — assign to whatever types exist
                    garmentDesignNum = designEntries[0].num;
                    capDesignNum = designEntries[0].num;
                }

                // Store assignment on embConfigOptions for later retrieval
                embConfigOptions._garmentDesignNum = garmentDesignNum;
                embConfigOptions._capDesignNum = capDesignNum;

                // Auto-set garment tier from assigned design
                autoGarmentTier = '8000';
                autoGarmentPosition = 'Left Chest';
                autoGarmentStitchCount = 8000;
                hasFullBack = false;
                embConfigOptions.fbPriceTiers = null;

                if (garmentDesignNum) {
                    const gInfo = lookup?.designs?.[garmentDesignNum] || designEntries.find(e => e.num === garmentDesignNum)?.dbInfo;
                    if (gInfo) {
                        const sc = gInfo.maxStitchCount;
                        const tier = gInfo.maxStitchTier || 'Standard';
                        autoGarmentStitchCount = sc;
                        if (tier === 'Full Back' || sc >= 25000) {
                            autoGarmentTier = '25000';
                            autoGarmentPosition = 'Full Back';
                            hasFullBack = true;
                            // Set FB price tiers from this specific design
                            if (gInfo.hasFBPricing) {
                                const fbVariant = gInfo.variants.find(v => v.fbPrice1_7 > 0);
                                if (fbVariant) {
                                    embConfigOptions.fbPriceTiers = {
                                        fbPrice1_7: fbVariant.fbPrice1_7,
                                        fbPrice8_23: fbVariant.fbPrice8_23,
                                        fbPrice24_47: fbVariant.fbPrice24_47,
                                        fbPrice48_71: fbVariant.fbPrice48_71,
                                        fbPrice72plus: fbVariant.fbPrice72plus
                                    };
                                }
                            }
                        } else {
                            autoGarmentTier = mapStitchCountToTierValue(sc, '');
                        }
                    }
                }

                // Auto-set cap tier from assigned design
                autoCapTier = '8000';
                if (capDesignNum) {
                    const cInfo = lookup?.designs?.[capDesignNum] || designEntries.find(e => e.num === capDesignNum)?.dbInfo;
                    if (cInfo) {
                        // For caps, use smallest variant stitch count
                        let minCapStitch = Infinity;
                        for (const v of cInfo.variants) {
                            if (v.stitchCount < minCapStitch) minCapStitch = v.stitchCount;
                        }
                        if (minCapStitch < Infinity) {
                            autoCapTier = mapStitchCountToTierValue(minCapStitch, '');
                        }
                    }
                }

                // Update the garment/cap tier dropdowns in the modal
                const gTierEl = document.getElementById('spr-garment-stitch-tier');
                const gPosEl = document.getElementById('spr-garment-position');
                const cTierEl = document.getElementById('spr-cap-stitch-tier');
                if (gTierEl) gTierEl.value = autoGarmentTier;
                if (gPosEl) gPosEl.value = autoGarmentPosition;
                if (cTierEl) cTierEl.value = autoCapTier;
            }

            // Wire up onchange for assignment dropdowns
            if (showAssignment) {
                setTimeout(() => {
                    const selects = designBanner.querySelectorAll('.spr-design-assign');
                    selects.forEach(sel => {
                        sel.addEventListener('change', _recalcDesignAssignments);
                    });
                }, 0);
            }

            // Run initial assignment calculation
            // (for single-design or initial defaults — sets autoGarmentTier/autoCapTier)
            // Defer to after DOM update if using assignment dropdowns
            if (!showAssignment) {
                // Legacy single-design or no-assignment path
                for (const entry of designEntries) {
                    if (entry.inDb) {
                        const sc = entry.dbInfo.maxStitchCount;
                        const tier = entry.dbInfo.maxStitchTier || 'Standard';
                        if (sc > maxStitchCount) {
                            maxStitchCount = sc;
                            maxStitchTier = tier;
                            // eslint-disable-next-line no-unused-vars -- pre-existing write-only local (verbatim move)
                            maxAsSurcharge = entry.dbInfo.maxAsSurcharge || 0;
                        }
                    }
                }
                // eslint-disable-next-line no-unused-vars -- pre-existing write-only local (verbatim move)
                autoGarmentStitchCount = maxStitchCount || 8000;
                if (maxStitchTier === 'Full Back' || maxStitchCount >= 25000) {
                    autoGarmentTier = '25000';
                    autoGarmentPosition = 'Full Back';
                    // eslint-disable-next-line no-unused-vars -- pre-existing write-only local (verbatim move)
                    hasFullBack = true;
                    embConfigOptions.fbPriceTiers = fbPriceTiersFromLookup;
                } else if (maxStitchCount > 0) {
                    autoGarmentTier = mapStitchCountToTierValue(maxStitchCount, '');
                }
                // Cap tier: use smallest variant
                let minCapStitch = Infinity;
                for (const entry of designEntries) {
                    if (entry.inDb) {
                        for (const v of entry.dbInfo.variants) {
                            if (v.stitchCount < minCapStitch) minCapStitch = v.stitchCount;
                        }
                    }
                }
                if (minCapStitch < Infinity && minCapStitch !== maxStitchCount) {
                    autoCapTier = mapStitchCountToTierValue(minCapStitch, '');
                }
                // Store single design assignment
                embConfigOptions._garmentDesignNum = designEntries[0]?.num || null;
                embConfigOptions._capDesignNum = designEntries[0]?.num || null;
            } else {
                // Use default assignments to set initial tiers
                setTimeout(_recalcDesignAssignments, 0);
            }

        } else if (embConfigOptions.designInfo) {
            // Fallback: show simple design text if lookup had no results and no raw design numbers
            designBanner.style.display = '';
            designBanner.innerHTML = `<i class="fas fa-palette" style="margin-right:6px;"></i><span>${escapeHtml(embConfigOptions.designInfo)}</span>`;
        } else {
            designBanner.style.display = 'none';
        }

        // Garment config — auto-set from design lookup
        const garmentConfig = document.getElementById('spr-garment-config');
        garmentConfig.style.display = embConfigOptions.hasGarments ? '' : 'none';
        if (embConfigOptions.hasGarments) {
            document.getElementById('spr-garment-position').value = autoGarmentPosition;
            document.getElementById('spr-garment-stitch-tier').value = autoGarmentTier;
            document.getElementById('spr-garment-digitizing').checked = embConfigOptions.digitizing || false;
            // Sync Full Back UI if auto-detected
            if (autoGarmentPosition === 'Full Back') {
                onSprGarmentPositionChange();
            }
        }

        // Cap config — auto-set from design lookup
        const capConfig = document.getElementById('spr-cap-config');
        capConfig.style.display = embConfigOptions.hasCaps ? '' : 'none';
        if (embConfigOptions.hasCaps) {
            document.getElementById('spr-cap-embellishment').value = 'embroidery';
            document.getElementById('spr-cap-stitch-tier').value = autoCapTier;
            document.getElementById('spr-cap-stitch-tier-wrapper').style.display = '';
            document.getElementById('spr-cap-digitizing').checked = embConfigOptions.digitizing || false;
        }

        // LTM row (only if qty <= 7)
        const ltmRow = document.getElementById('spr-ltm-row');
        if (embConfigOptions.totalQty > 0 && embConfigOptions.totalQty <= 7) {
            ltmRow.style.display = '';
            // Smart default: uncheck if all products have ShopWorks pricing
            const ltmCheckbox = document.getElementById('spr-ltm-enabled');
            const ltmHint = document.getElementById('spr-ltm-hint');
            if (embConfigOptions.allProductsHaveSwPrice) {
                ltmCheckbox.checked = false;
                ltmHint.textContent = 'ShopWorks prices may include LTM';
            } else {
                ltmCheckbox.checked = true;
                ltmHint.textContent = '';
            }
        } else {
            ltmRow.style.display = 'none';
        }
    } else {
        embConfigSection.style.display = 'none';
    }
}

export function showServicePricingReview(serviceItems, productItems, embConfigOptions) {
    serviceItems = serviceItems || [];
    productItems = productItems || [];
    embConfigOptions = embConfigOptions || null;

    if (serviceItems.length === 0 && productItems.length === 0 && !embConfigOptions) {
        return Promise.resolve({ services: [], products: [], embConfig: null });
    }

    _sprItems = serviceItems;
    _sprProductItems = productItems;
    _sprEmbConfigOptions = embConfigOptions;

    return new Promise((resolve, reject) => {
        _sprResolve = resolve;
        _sprReject = reject;


        renderSprProductsSection(productItems);
        renderSprServicesSection(serviceItems);
        renderSprEmbConfigSection(embConfigOptions);

        // Show the modal
        const modal = document.getElementById('service-pricing-review-modal');
        modal.classList.add('active');
    });
}

/**
 * Group product sizes for the review modal display
 * Standard sizes (same API price) grouped together, upcharge sizes shown separately
 */
function _groupSizesForReview(sizes, sizePrices, _swPrice) {
    if (!sizes || Object.keys(sizes).length === 0) return [];

    // Build entries: { size, qty, apiPrice }
    const entries = [];
    for (const [size, qty] of Object.entries(sizes)) {
        if (qty > 0) {
            entries.push({
                size,
                qty,
                apiPrice: sizePrices ? (sizePrices[size] || null) : null
            });
        }
    }

    if (entries.length === 0) return [];

    // Group by API price (sizes with same price grouped together)
    const priceGroups = {};
    entries.forEach(e => {
        const key = e.apiPrice != null ? e.apiPrice.toFixed(2) : 'null';
        if (!priceGroups[key]) priceGroups[key] = [];
        priceGroups[key].push(e);
    });

    const groups = [];
    for (const [priceKey, items] of Object.entries(priceGroups)) {
        const label = items.map(i => `${i.size}(${i.qty})`).join(' ');
        groups.push({
            label,
            apiPrice: priceKey !== 'null' ? parseFloat(priceKey) : null
        });
    }

    // Sort: standard (lower) prices first
    groups.sort((a, b) => (a.apiPrice || 0) - (b.apiPrice || 0));
    return groups;
}

/**
 * Handle product source radio change — enable/disable custom input
 */
export function onSprProductSourceChange(pIdx) {
    const radios = document.querySelectorAll(`input[name="spr-psource-${pIdx}"]`);
    const customInput = document.getElementById(`spr-pcustom-${pIdx}`);
    let selectedValue = '';
    radios.forEach(r => { if (r.checked) selectedValue = r.value; });
    if (selectedValue === 'custom') {
        customInput.classList.remove('spr-muted');
        customInput.focus();
    } else {
        customInput.classList.add('spr-muted');
        customInput.value = '';
    }
    // Reactively update LTM default when pricing source changes
    _updateSprLtmDefault();
}

export function onSprCustomProductFocus(pIdx) {
    const customRadio = document.querySelector(`input[name="spr-psource-${pIdx}"][value="custom"]`);
    if (customRadio && !customRadio.checked) {
        customRadio.checked = true;
        onSprProductSourceChange(pIdx);
    }
}

/**
 * Handle radio source change — enable/disable custom input
 */
export function onSprSourceChange(idx) {
    const radios = document.querySelectorAll(`input[name="spr-source-${idx}"]`);
    const customInput = document.getElementById(`spr-custom-${idx}`);
    let selectedValue = '';
    radios.forEach(r => { if (r.checked) selectedValue = r.value; });
    if (selectedValue === 'custom') {
        customInput.classList.remove('spr-muted');
        customInput.focus();
    } else {
        customInput.classList.add('spr-muted');
        customInput.value = '';
    }
}

export function onSprCustomServiceFocus(idx) {
    const customRadio = document.querySelector(`input[name="spr-source-${idx}"][value="custom"]`);
    if (customRadio && !customRadio.checked) {
        customRadio.checked = true;
        onSprSourceChange(idx);
    }
}

// === SPR Embroidery Config Handlers ===

export function onSprGarmentPositionChange() {
    const pos = document.getElementById('spr-garment-position').value;
    const tierEl = document.getElementById('spr-garment-stitch-tier');
    if (pos === 'Full Back') {
        tierEl.value = '25000';
    } else if (tierEl.value === '25000') {
        tierEl.value = '8000';
    }
}

export function onSprGarmentStitchTierChange() {
    const tier = document.getElementById('spr-garment-stitch-tier').value;
    const posEl = document.getElementById('spr-garment-position');
    if (tier === '25000') {
        posEl.value = 'Full Back';
    } else if (posEl.value === 'Full Back') {
        posEl.value = 'Left Chest';
    }
}

export function onSprCapEmbellishmentChange() {
    const type = document.getElementById('spr-cap-embellishment').value;
    const stitchWrapper = document.getElementById('spr-cap-stitch-tier-wrapper');
    stitchWrapper.style.display = (type === 'laser-patch') ? 'none' : '';
}

function _updateSprLtmDefault() {
    if (!_sprEmbConfigOptions || _sprEmbConfigOptions.totalQty > 7) return;
    const ltmCheckbox = document.getElementById('spr-ltm-enabled');
    const ltmHint = document.getElementById('spr-ltm-hint');
    if (!ltmCheckbox) return;

    // Check if ALL products currently have ShopWorks pricing selected
    let allSw = true;
    _sprProductItems.forEach((prod, pIdx) => {
        const radios = document.querySelectorAll(`input[name="spr-psource-${pIdx}"]`);
        let selected = 'api';
        radios.forEach(r => { if (r.checked) selected = r.value; });
        if (selected !== 'sw') allSw = false;
    });

    if (allSw && _sprProductItems.length > 0) {
        ltmCheckbox.checked = false;
        ltmHint.textContent = 'ShopWorks prices may include LTM';
    } else {
        ltmCheckbox.checked = true;
        ltmHint.textContent = '';
    }
}

/**
 * Handle stitch count change — recalculate API price live
 */
export function onSprStitchChange(idx) {
    const item = _sprItems[idx];
    if (!item) return;

    const input = document.getElementById(`spr-stitch-${idx}`);
    const newStitch = parseInt(input.value) || 8000;
    item.stitchCount = newStitch;

    // Recalculate API price
    const apiPriceEl = document.getElementById(`spr-api-price-${idx}`);
    if (apiPriceEl && embState.pricingCalculator) {
        const newApiPrice = embState.pricingCalculator.getServiceUnitPrice(
            item.type.toLowerCase(), newStitch, item.quantity, item.isCap
        );
        if (newApiPrice != null) {
            item.apiPrice = newApiPrice;
            apiPriceEl.textContent = `$${newApiPrice.toFixed(2)}`;
        } else {
            item.apiPrice = null;
            apiPriceEl.textContent = '(unavailable)';
            apiPriceEl.className = 'spr-unavailable';
        }
    }
}

/**
 * Cancel the service pricing review — resolve with null
 */
export function cancelServicePricingReview() {
    const modal = document.getElementById('service-pricing-review-modal');
    modal.classList.remove('active');
    _sprEmbConfigOptions = null;
    if (_sprResolve) {
        _sprResolve(null); // null = user cancelled
        _sprResolve = null;
        _sprReject = null;
    }
}

/**
 * Apply the user's chosen pricing and resolve the Promise
 * Returns { services: [...], products: [...] }
 */
export function applyServicePricingReview() {
    // Collect service results
    const serviceResults = [];
    _sprItems.forEach((item, idx) => {
        const radios = document.querySelectorAll(`input[name="spr-source-${idx}"]`);
        let selectedSource = 'api';
        radios.forEach(r => { if (r.checked) selectedSource = r.value; });

        let unitPrice = 0;
        if (selectedSource === 'sw') {
            unitPrice = item.shopWorksPrice || 0;
        } else if (selectedSource === 'api') {
            unitPrice = item.apiPrice || 0;
        } else if (selectedSource === 'custom') {
            const customInput = document.getElementById(`spr-custom-${idx}`);
            unitPrice = parseFloat(customInput.value) || 0;
        }

        const stitchInput = document.getElementById(`spr-stitch-${idx}`);
        const stitchCount = stitchInput ? (parseInt(stitchInput.value) || 8000) : (item.stitchCount || 8000);

        serviceResults.push({
            type: item.type,
            quantity: item.quantity,
            unitPrice: unitPrice,
            stitchCount: stitchCount,
            isCap: item.isCap || false,
            originalData: item.originalData || null
        });
    });

    // Collect product results
    const productResults = [];
    _sprProductItems.forEach((prod, pIdx) => {
        const radios = document.querySelectorAll(`input[name="spr-psource-${pIdx}"]`);
        let selectedSource = 'api';
        radios.forEach(r => { if (r.checked) selectedSource = r.value; });

        let overridePrice = 0; // 0 = use API (no override)
        if (selectedSource === 'sw') {
            overridePrice = prod.unitPrice || 0;
        } else if (selectedSource === 'custom') {
            const customInput = document.getElementById(`spr-pcustom-${pIdx}`);
            overridePrice = parseFloat(customInput.value) || 0;
        }
        // 'api' → overridePrice stays 0 → no sellPriceOverride set

        productResults.push({
            ...prod,
            selectedSource: selectedSource,
            overridePrice: overridePrice
        });
    });

    // Collect embroidery config if section was shown
    let embConfig = null;
    if (_sprEmbConfigOptions) {
        // Resolve design assignments from dropdowns
        let garmentDesignNumber = null;
        let garmentDesignName = null;
        let capDesignNumber = null;
        let capDesignName = null;

        if (_sprEmbConfigOptions._garmentDesignNum || _sprEmbConfigOptions._capDesignNum) {
            // Read from assignment state (set by _recalcDesignAssignments or single-design path)
            const assignSelects = document.querySelectorAll('.spr-design-assign');
            if (assignSelects.length > 0) {
                // Multi-design: read from dropdowns
                assignSelects.forEach(sel => {
                    const dNum = sel.dataset.designNum;
                    const val = sel.value;
                    const entry = (_sprEmbConfigOptions.designNumbers || []).find(l => l.includes('#' + dNum));
                    const nameMatch = entry ? entry.match(/—\s*(.+)/) : null;
                    const dName = nameMatch ? nameMatch[1].trim() : '';
                    if (val === 'garment' || val === 'both') {
                        if (!garmentDesignNumber) { garmentDesignNumber = dNum; garmentDesignName = dName; }
                    }
                    if (val === 'cap' || val === 'both') {
                        if (!capDesignNumber) { capDesignNumber = dNum; capDesignName = dName; }
                    }
                });
            } else {
                // Single design: assign to whatever types exist
                const singleNum = _sprEmbConfigOptions._garmentDesignNum;
                const singleEntry = (_sprEmbConfigOptions.designNumbers || []).find(l => l.includes('#' + singleNum));
                const singleNameMatch = singleEntry ? singleEntry.match(/—\s*(.+)/) : null;
                const singleName = singleNameMatch ? singleNameMatch[1].trim() : '';
                if (_sprEmbConfigOptions.hasGarments) { garmentDesignNumber = singleNum; garmentDesignName = singleName; }
                if (_sprEmbConfigOptions.hasCaps) { capDesignNumber = singleNum; capDesignName = singleName; }
            }
        }

        embConfig = {
            garmentPosition: document.getElementById('spr-garment-position')?.value || 'Left Chest',
            garmentStitchTier: parseInt(document.getElementById('spr-garment-stitch-tier')?.value) || 8000,
            garmentDigitizing: document.getElementById('spr-garment-digitizing')?.checked || false,
            capEmbellishment: document.getElementById('spr-cap-embellishment')?.value || 'embroidery',
            capStitchTier: parseInt(document.getElementById('spr-cap-stitch-tier')?.value) || 8000,
            capDigitizing: document.getElementById('spr-cap-digitizing')?.checked || false,
            ltmEnabled: document.getElementById('spr-ltm-enabled')?.checked ?? true,
            fbPriceTiers: _sprEmbConfigOptions?.fbPriceTiers || null,
            garmentDesignNumber: garmentDesignNumber,
            garmentDesignName: garmentDesignName,
            capDesignNumber: capDesignNumber,
            capDesignName: capDesignName
        };
    }

    // Close modal
    const modal = document.getElementById('service-pricing-review-modal');
    modal.classList.remove('active');

    if (_sprResolve) {
        _sprResolve({ services: serviceResults, products: productResults, embConfig: embConfig });
        _sprResolve = null;
        _sprReject = null;
    }
}

// ── Accessor for the import cluster's read (becomes a real import when
//    cluster #10 extracts). ─────────────────────────────────────────────
export function getSprEmbConfigOptions() {
    return _sprEmbConfigOptions;
}
