/**
 * EMB design-search module — roadmap 0.4 extraction #1 (2026-07-07).
 *
 * The design-number lookup / customer design gallery modal: open/close,
 * debounced search against /api/digitized-designs, tier + company filters,
 * batched grid render with lazy thumbnails, and applying a picked design to
 * a logo card (design number, stitch tier, thumbnail, customer autofill).
 *
 * Moved verbatim from embroidery-quote-builder.js (986-line contiguous
 * cluster). Two mechanical adaptations, no behavior change:
 *   - window._designSearchCache → module-private `designSearchCache` (every
 *     reader lived in this cluster; one window global removed).
 *   - The monolith's three outside touch points (customer-change/clear
 *     invalidation + resetQuote) now call the exported accessors
 *     invalidateDesignGalleryCache() / resetDesignSearchState().
 *
 * Cross-module seams (monolith globals this module reads/writes at runtime —
 * lexical globals resolve through the global scope chain from module code;
 * function declarations are window props): see the global comment below.
 * These migrate into builders/emb modules with their own clusters.
 */
// @ts-nocheck — MOVED legacy DOM code (0.4 extraction #1): ~45 pre-existing
// checkJs frictions (.value/.dataset/expandos on HTMLElement). Typing lands
// when this cluster's render/state split happens (see emb-decomposition-plan.md
// follow-ups); new builders/** modules stay strictly checked.
/* global onPrimaryPositionChange, onPrimaryStitchTierChange,
   onCapStitchTierChange, updateLogoCardHeader, lookupTaxRate,
   updatePushButtonState, escapeHtml, showToast, DesignThumbnailService, renderOrderRecap */
// (addExtraColorSurchargeRow is also a seam, but only inside generated onclick markup —
//  it resolves via window at click time; the monolith still owns it.)

// ============================================================
// DESIGN NUMBER LOOKUP / SEARCH
// ============================================================

let _designSearchTarget = 'garment'; // Which logo card the search modal targets
let _customerDesignGallery = null;   // Cached gallery data: { customerId, results[] }
let _galleryFilterTimeout = null;    // Debounce timer for gallery filter input
let _designSearchDebounce = null;
const DESIGN_SEARCH_INITIAL_RENDER = 50; // Batch rendering threshold
let designSearchCache = {}; // designNumber → design row (was window._designSearchCache)
let _designSearchState = {
    allResults: [],
    filteredResults: [],
    activeTier: 'all',
    activeCompany: 'all',
    displayedCount: 0
};

/**
 * Apply a design to a logo card from cached data (NO API call)
 * @param {string} type - 'garment' or 'cap'
 * @param {Object} designData - Full design data object from cache
 */
export async function applyDesignFromCache(type, designData) {
    if (!designData || !designData.designNumber) return;
    const designNum = String(designData.designNumber);
    const inputId = type === 'garment' ? 'garment-design-number' : 'cap-design-number';
    const clearId = type === 'garment' ? 'garment-design-clear' : 'cap-design-clear';
    const input = document.getElementById(inputId);
    const clearBtn = document.getElementById(clearId);
    if (input) input.value = designNum;
    if (clearBtn) clearBtn.style.display = 'inline-flex';

    // Build a design object compatible with applyDesignToCard
    const design = {
        company: designData.company || '',
        designName: designData.designName || '',
        maxStitchCount: designData.maxStitchCount || 0,
        maxStitchTier: designData.maxStitchTier || 'Standard',
        placement: designData.placement || '',
        thumbnailUrl: designData.thumbnailUrl || '',
        dstPreviewUrl: designData.dstPreviewUrl || '',
        artworkUrl: designData.artworkUrl || '',
        customerId: designData.customerId || '',
        threadColors: designData.threadColors || '',
        dstFilenames: designData.dstFilenames || [],
        colorChanges: designData.colorChanges || 0,
        extraColors: designData.extraColors || 0,
        extraColorSurcharge: designData.extraColorSurcharge || 0,
        orderCount: designData.orderCount || 0,
        lastOrderDate: designData.lastOrderDate || '',
        artNotes: designData.artNotes || '',
        variants: designData.variants || []
    };

    // Store on logo object for draft persistence
    if (type === 'garment') {
        primaryLogo._designData = design;
        // [expert audit 2026-07-07 F5] Negotiated Full-Back design-tier pricing was
        // applied ONLY by the ShopWorks-import flow; a hand-built quote of the SAME
        // design fell back to the $1.25/1K formula — two prices depending on how the
        // quote was born. The lookup payload already carries the variants, so mirror
        // the import's extraction. The engine only consumes fbPriceTiers when the
        // primary position is Full Back, so setting it here is inert otherwise.
        const _fbVariant = (design.variants || []).find(v => parseFloat(v.fbPrice1_7) > 0);
        primaryLogo.fbPriceTiers = _fbVariant ? {
            fbPrice1_7: _fbVariant.fbPrice1_7,
            fbPrice8_23: _fbVariant.fbPrice8_23,
            fbPrice24_47: _fbVariant.fbPrice24_47,
            fbPrice48_71: _fbVariant.fbPrice48_71,
            fbPrice72plus: _fbVariant.fbPrice72plus
        } : null;
    } else if (typeof capPrimaryLogo !== 'undefined') {
        capPrimaryLogo._designData = design;
    }

    await applyDesignToCard(type, designNum, design);
}

/**
 * Filter design search results by stitch tier (chip click handler)
 */
export function filterDesignSearchByTier(tier) {
    _designSearchState.activeTier = tier;
    document.querySelectorAll('#design-search-filters .design-search-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.tier === tier);
    });
    applyDesignSearchFilters();
}

/**
 * Filter design search results by company name (chip click handler)
 */
export function filterDesignSearchByCompany(company) {
    _designSearchState.activeCompany = company;
    document.querySelectorAll('#design-search-company-chips .design-search-company-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.company === company);
    });
    applyDesignSearchFilters();
}

/**
 * Apply combined tier + company filters and re-render grid
 */
function applyDesignSearchFilters() {
    let results = _designSearchState.allResults;

    // Apply tier filter
    if (_designSearchState.activeTier !== 'all') {
        results = results.filter(d => (d.maxStitchTier || 'Standard') === _designSearchState.activeTier);
    }

    // Apply company filter
    if (_designSearchState.activeCompany !== 'all') {
        results = results.filter(d => (d.company || 'Unknown') === _designSearchState.activeCompany);
    }

    // Apply text filter if in gallery mode with active text input
    const searchInput = document.getElementById('design-search-input');
    if (searchInput && searchInput._galleryMode) {
        const q = searchInput.value.trim().toLowerCase();
        if (q) {
            results = results.filter(d =>
                (d.designNumber && String(d.designNumber).toLowerCase().includes(q)) ||
                (d.designName && d.designName.toLowerCase().includes(q)) ||
                (d.company && d.company.toLowerCase().includes(q))
            );
        }
    }

    _designSearchState.filteredResults = results;
    renderDesignSearchGrid(results);
    updateDesignSearchResultsHeader();
}

/**
 * Build company filter chips from search/gallery results
 */
function buildDesignSearchCompanyChips(designs) {
    const container = document.getElementById('design-search-company-chips');
    if (!container) return;

    const companyCounts = {};
    designs.forEach(d => {
        const name = d.company || 'Unknown';
        companyCounts[name] = (companyCounts[name] || 0) + 1;
    });

    const companies = Object.keys(companyCounts).sort();
    if (companies.length < 2) {
        container.style.display = 'none';
        return;
    }

    let html = '<button class="design-search-company-chip active" data-company="all" onclick="filterDesignSearchByCompany(\'all\')">All <span class="chip-count">(' + designs.length + ')</span></button>';
    companies.forEach(name => {
        const escapedName = name.replace(/'/g, "\\'");
        html += '<button class="design-search-company-chip" data-company="' + escapeHtml(name) + '" '
            + 'onclick="filterDesignSearchByCompany(\'' + escapedName + '\')" title="' + escapeHtml(name) + '">'
            + escapeHtml(name.length > 28 ? name.substring(0, 26) + '...' : name)
            + ' <span class="chip-count">(' + companyCounts[name] + ')</span></button>';
    });

    container.innerHTML = html;
    container.style.display = 'flex';
}

/**
 * Update the results count header in the search modal
 */
function updateDesignSearchResultsHeader() {
    const header = document.getElementById('design-search-results-header');
    if (!header) return;

    const filtered = _designSearchState.filteredResults.length;
    const total = _designSearchState.allResults.length;

    if (total === 0) {
        header.style.display = 'none';
        return;
    }

    const countText = filtered === total
        ? '<span class="results-count">' + total + ' designs</span>'
        : '<span class="results-count">' + filtered + ' of ' + total + ' designs</span>';

    header.innerHTML = countText;
    header.style.display = 'flex';
}

/**
 * Reset design search modal filter state
 */
function resetDesignSearchFilters() {
    _designSearchState.activeTier = 'all';
    _designSearchState.activeCompany = 'all';
    _designSearchState.displayedCount = 0;
    document.querySelectorAll('#design-search-filters .design-search-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.tier === 'all');
    });
    const companyChips = document.getElementById('design-search-company-chips');
    if (companyChips) { companyChips.style.display = 'none'; companyChips.innerHTML = ''; }
    const header = document.getElementById('design-search-results-header');
    if (header) header.style.display = 'none';
    const filters = document.getElementById('design-search-filters');
    if (filters) filters.style.display = 'none';
}

/**
 * Look up a design number from the input field
 * @param {string} type - 'garment' or 'cap'
 */
export async function lookupDesignNumber(type) {
    const inputId = type === 'garment' ? 'garment-design-number' : 'cap-design-number';
    const infoId = type === 'garment' ? 'garment-design-info' : 'cap-design-info';
    const clearId = type === 'garment' ? 'garment-design-clear' : 'cap-design-clear';
    const input = document.getElementById(inputId);
    const infoBadge = document.getElementById(infoId);
    const clearBtn = document.getElementById(clearId);
    if (!input) return;

    const designNum = input.value.trim().replace(/[^\d]/g, '');
    if (!designNum || designNum.length < 1) {
        showToast('Enter a design number to look up', 'warning');
        input.focus();
        return;
    }

    // Show loading state
    infoBadge.style.display = 'block';
    infoBadge.className = 'design-info-badge design-info-loading';
    infoBadge.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Looking up design #' + escapeHtml(designNum) + '...';

    try {
        const apiBase = window.APP_CONFIG.API.BASE_URL;
        const resp = await fetch(`${apiBase}/api/digitized-designs/lookup?designs=${designNum}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();

        if (data.success && data.designs && data.designs[designNum]) {
            const design = data.designs[designNum];
            await applyDesignToCard(type, designNum, design);
        } else {
            // Not found in master — try fallback
            const fbResp = await fetch(`${apiBase}/api/digitized-designs/fallback?designs=${designNum}`);
            if (fbResp.ok) {
                const fbData = await fbResp.json();
                if (fbData.success && fbData.designs && fbData.designs[designNum]) {
                    const fbDesign = fbData.designs[designNum];
                    await applyDesignToCard(type, designNum, {
                        company: fbDesign.companyName || '',
                        maxStitchCount: fbDesign.stitchCount || 0,
                        maxStitchTier: fbDesign.stitchTier || 'Standard',
                        variants: [{ designDescription: fbDesign.designName || '' }]
                    });
                    return;
                }
            }
            // Truly not found
            infoBadge.className = 'design-info-badge design-info-warning';
            // P2-9 (audit 2026-06-06): setDesignNumberOnLogo below makes the push treat this typed # as an
            // EXISTING ShopWorks design (id_Design), NOT a new one — so the old "a new design will be created"
            // copy was misleading and gave false comfort about a wrong/typo'd number. Tell the rep exactly
            // what will happen so they verify the # or clear it and upload artwork for a genuinely new design.
            infoBadge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Design #' + escapeHtml(designNum) +
                ' not found in our database. It will be pushed as an EXISTING ShopWorks design # — verify it is correct, or clear it and upload artwork to create a NEW design.';
            // Still set the number — the rep may know it exists in ShopWorks (the warning above makes the
            // "existing id_Design" behavior explicit).
            setDesignNumberOnLogo(type, designNum);
            clearBtn.style.display = 'inline-flex';
        }
    } catch (err) {
        console.error('Design lookup failed:', err);
        infoBadge.className = 'design-info-badge design-info-error';
        infoBadge.innerHTML = '<i class="fas fa-times-circle"></i> Lookup failed: ' + escapeHtml(err.message);
    }
}

/**
 * Apply a found design to the logo card
 */
async function applyDesignToCard(type, designNum, design) {
    const infoId = type === 'garment' ? 'garment-design-info' : 'cap-design-info';
    const clearId = type === 'garment' ? 'garment-design-clear' : 'cap-design-clear';
    const infoBadge = document.getElementById(infoId);
    const clearBtn = document.getElementById(clearId);

    const stitchStr = design.maxStitchCount ? design.maxStitchCount.toLocaleString() + ' stitches' : '';
    const tierBadge = design.maxStitchTier || 'Standard';
    const company = design.company || '';
    const designName = design.designName || '';
    const placement = design.placement || '';
    const parts = [company, designName, stitchStr, tierBadge, placement].filter(Boolean);

    // Build enhanced info badge with DST, order history, extra color warning
    let badgeHtml = '<i class="fas fa-check-circle"></i> ' + escapeHtml(parts.join(' · '));

    // DST filenames (show first 2)
    const dstArr = design.dstFilenames || [];
    if (dstArr.length > 0) {
        const dstDisplay = dstArr.length <= 2 ? dstArr.join(', ') : dstArr.slice(0, 2).join(', ') + ' +' + (dstArr.length - 2) + ' more';
        badgeHtml += '<br><span style="font-size:11px;color:#6366f1;"><i class="fas fa-file-code" style="margin-right:2px;"></i>DST: ' + escapeHtml(dstDisplay) + '</span>';
    }

    // Order history
    if (design.orderCount > 0) {
        let orderText = design.orderCount + ' orders';
        if (design.lastOrderDate) {
            orderText += ' (last: ' + new Date(design.lastOrderDate).toLocaleDateString('en-US', {month:'short', year:'numeric'}) + ')';
        }
        badgeHtml += '<br><span style="font-size:11px;color:#6366f1;">📦 ' + escapeHtml(orderText) + '</span>';
    }

    // Extra color surcharge — warn AND collect (expert audit 2026-07-07 F2: this
    // badge announced the per-piece surcharge and then billed nothing, a permanent
    // margin leak on every multi-color design).
    if (design.extraColors > 0 && design.extraColorSurcharge > 0) {
        badgeHtml += '<br><span style="font-size:11px;color:#d97706;font-weight:600;">⚠ +' + design.extraColors + ' extra colors (+$' + design.extraColorSurcharge.toFixed(2) + '/pc surcharge)</span>'
            + ' <button type="button" class="btn-add-extra-colors" onclick="addExtraColorSurchargeRow(\'' + type + '\', ' + Number(design.extraColors) + ', ' + Number(design.extraColorSurcharge) + ')">Add to quote</button>';
    }

    infoBadge.className = 'design-info-badge design-info-found';
    infoBadge.innerHTML = badgeHtml;
    infoBadge.style.display = 'block';
    clearBtn.style.display = 'inline-flex';

    // Set design number on the logo object
    setDesignNumberOnLogo(type, designNum);
    updateLogoCardHeader(type, designNum);

    // Auto-set stitch tier dropdown if we have stitch info
    if (design.maxStitchCount && design.maxStitchCount > 0) {
        autoSetStitchTier(type, design.maxStitchCount, design.maxStitchTier);
    }

    // Auto-fill Customer # from design database or company contacts lookup
    const customerInput = document.getElementById('customer-number');
    if (customerInput && !customerInput.value.trim()) {
        if (design.customerId) {
            // Direct customer ID from design master table
            customerInput.value = design.customerId;
            // Also fill company name if empty
            const companyInput = document.getElementById('company-name');
            if (companyInput && !companyInput.value.trim() && company) {
                companyInput.value = company;
            }
            showToast('Customer # ' + design.customerId + ' auto-set from design database', 'info');
        } else if (company) {
            // Fallback: search company contacts by company name (AWAITED to prevent race condition)
            await autoFillCustomerFromCompany(company);
        }
    }

    // Design lookup just auto-filled the Customer # (programmatically — no 'input' event fires) → re-enable
    // the Push button + refresh the readiness checklist and the Order Recap. (review C2 2026-06-05)
    updatePushButtonState();
    renderOrderRecap();

    showToast('Design #' + designNum + ' linked — ' + (company || 'design found'), 'success');

    // Use thumbnail from enriched /lookup response (faster, no extra API call)
    const thumbUrl = design.mockupUrl || design.dstPreviewUrl || design.thumbnailUrl || design.artworkUrl || '';
    if (thumbUrl) {
        showDesignThumbnail(type, thumbUrl);
        if (type === 'garment') {
            primaryLogo.thumbnailUrl = thumbUrl;
        } else if (typeof capPrimaryLogo !== 'undefined') {
            capPrimaryLogo.thumbnailUrl = thumbUrl;
        }
    } else if (typeof DesignThumbnailService !== 'undefined') {
        // Fallback: legacy thumbnail service if unified table has no image
        DesignThumbnailService.fetchThumbnail(designNum).then(imageUrl => {
            showDesignThumbnail(type, imageUrl);
            if (type === 'garment') {
                primaryLogo.thumbnailUrl = imageUrl || null;
            } else if (typeof capPrimaryLogo !== 'undefined') {
                capPrimaryLogo.thumbnailUrl = imageUrl || null;
            }
        });
    }
}

/**
 * Show or hide a design thumbnail in the logo card area
 * @param {string} type - 'garment' or 'cap'
 * @param {string|null} imageUrl - URL to the thumbnail image, or null
 */
export function showDesignThumbnail(type, imageUrl) {
    const thumbDiv = document.getElementById(type === 'garment' ? 'garment-design-thumbnail' : 'cap-design-thumbnail');
    if (!thumbDiv) return;
    if (imageUrl) {
        const img = thumbDiv.querySelector('.design-thumb-img');
        img.src = imageUrl;
        thumbDiv.style.display = 'block';
    } else {
        thumbDiv.style.display = 'none';
    }
    // [2026-06-07] mirror the design preview into the glance panel for a visual confirm
    if (typeof renderOrderRecap === 'function') renderOrderRecap();
}

/**
 * Open full-size thumbnail in a modal overlay
 * @param {HTMLElement} thumbnailDiv - The .design-thumbnail-preview div that was clicked
 */
export function openThumbnailFullSize(thumbnailDiv) {
    const img = thumbnailDiv.querySelector('img');
    if (!img || !img.src) return;
    const overlay = document.createElement('div');
    overlay.className = 'thumb-modal-overlay';
    overlay.innerHTML = '<img src="' + escapeHtml(img.src) + '" alt="Design full size">';
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
}

/**
 * Auto-fill Customer # by searching company contacts API.
 * Called when design lookup returns a company name but no Customer_ID.
 * Searches Company_Contacts_Merge_ODBC for matching company → fills id_Customer.
 */
async function autoFillCustomerFromCompany(companyName) {
    const customerInput = document.getElementById('customer-number');
    if (!customerInput || customerInput.value.trim()) return; // Already has value

    try {
        const apiBase = window.APP_CONFIG.API.BASE_URL;

        // The contacts search API strips apostrophes from the query,
        // so "Aaberg's Rentals" → "Aabergs Rentals" which won't match.
        // Use the first word as search term for reliable matching.
        const firstWord = companyName.trim().split(/[\s']/)[0];
        const searchTerm = firstWord.length >= 2 ? firstWord : companyName.replace(/'/g, '');
        if (searchTerm.length < 2) return;

        const resp = await fetch(`${apiBase}/api/company-contacts/search?q=${encodeURIComponent(searchTerm)}&limit=5`);
        if (!resp.ok) return; // Silent fail — user can fill manually

        const data = await resp.json();
        const contacts = data.contacts || [];
        if (contacts.length === 0) return;

        // Find best match — exact company name match (case-insensitive)
        const fullNameLower = companyName.toLowerCase().trim();
        const exactMatch = contacts.find(c =>
            (c.CustomerCompanyName || '').toLowerCase().trim() === fullNameLower
        );
        // P1-3 (audit 2026-06-06): ONLY auto-attach on an EXACT company-name match. The old `contacts[0]`
        // fallback + substring `isCloseMatch` could silently attach the order to the WRONG ShopWorks
        // customer (a real but different account). No exact match → leave the customer # blank for the rep.
        const bestMatch = exactMatch;

        if (bestMatch && bestMatch.id_Customer) {
            if (!customerInput.value.trim()) {
                customerInput.value = bestMatch.id_Customer;
                // Also fill other customer fields if empty
                const companyInput = document.getElementById('company-name');
                if (companyInput && !companyInput.value.trim() && bestMatch.CustomerCompanyName) {
                    companyInput.value = bestMatch.CustomerCompanyName;
                }
                const nameInput = document.getElementById('customer-name');
                if (nameInput && !nameInput.value.trim() && bestMatch.ct_NameFull) {
                    nameInput.value = bestMatch.ct_NameFull;
                }
                const emailInput = document.getElementById('customer-email');
                if (emailInput && !emailInput.value.trim() && bestMatch.ContactNumbersEmail) {
                    emailInput.value = bestMatch.ContactNumbersEmail;
                }
                // Auto-fill Ship To address if available
                if (bestMatch.State) {
                    const stateInput = document.getElementById('ship-state');
                    if (stateInput && !stateInput.value) stateInput.value = bestMatch.State;
                }
                if (bestMatch.City) {
                    const cityInput = document.getElementById('ship-city');
                    if (cityInput && !cityInput.value.trim()) cityInput.value = bestMatch.City;
                }
                if (bestMatch.Zip) {
                    const zipInput = document.getElementById('ship-zip');
                    if (zipInput && !zipInput.value.trim()) {
                        zipInput.value = bestMatch.Zip;
                        lookupTaxRate(); // Auto-trigger tax lookup
                    }
                }
                if (bestMatch.Address) {
                    const addrInput = document.getElementById('ship-address');
                    if (addrInput && !addrInput.value.trim()) addrInput.value = bestMatch.Address;
                }
                showToast('Customer # ' + bestMatch.id_Customer + ' auto-set from ' +
                    escapeHtml(bestMatch.CustomerCompanyName || companyName), 'info');
            }
        }
    } catch (err) {
        // Silent fail — customer # can be filled manually
        console.warn('Auto-fill customer from company failed:', err.message);
    }
}

/**
 * Set design number on the appropriate logo object
 */
function setDesignNumberOnLogo(type, designNum) {
    if (type === 'garment') {
        primaryLogo.designNumber = designNum;
    } else if (type === 'cap') {
        if (typeof capPrimaryLogo !== 'undefined') {
            capPrimaryLogo.designNumber = designNum;
        }
    }
}

/**
 * Auto-set stitch tier dropdown from design data
 */
function autoSetStitchTier(type, stitchCount, _tierName) {
    const dropdownId = type === 'garment' ? 'primary-stitches' : 'cap-primary-stitches';
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    // Map stitch count to tier value (reuse existing logic)
    let tierValue;
    if (stitchCount >= 25000) {
        tierValue = '25000';
    } else if (stitchCount > 15000) {
        tierValue = '18000';
    } else if (stitchCount > 10000) {
        tierValue = '12000';
    } else {
        tierValue = '8000';
    }

    // Cap dropdown has no 25000 option — setting it left the select at '' and
    // onCapStitchTierChange's parseInt('') || 8000 silently booked Standard: the
    // $10/cap Large surcharge vanished ($480 on 48 caps). Clamp + tell the rep
    // to verify which DST variant actually runs on caps. (expert audit 2026-07-07)
    if (type !== 'garment' && tierValue === '25000') {
        tierValue = '18000';
        if (typeof showToast === 'function') {
            showToast(`This design's largest file is ${Number(stitchCount).toLocaleString()} stitches — cap front maxes at Large (15K–25K). Verify which DST variant runs on caps.`, 'warning', 9000);
        }
    }

    dropdown.value = tierValue;
    // Trigger change events
    if (type === 'garment') {
        if (typeof onPrimaryStitchTierChange === 'function') onPrimaryStitchTierChange();
        // Handle Full Back position auto-select
        if (stitchCount >= 25000) {
            const posDropdown = document.getElementById('primary-position');
            if (posDropdown && posDropdown.value !== 'Full Back') {
                posDropdown.value = 'Full Back';
                if (typeof onPrimaryPositionChange === 'function') onPrimaryPositionChange();
            }
        }
    } else {
        if (typeof onCapStitchTierChange === 'function') onCapStitchTierChange();
    }
}

/**
 * Clear design number from a logo card
 * @param {string} type - 'garment' or 'cap'
 */
export function clearDesignNumber(type) {
    const inputId = type === 'garment' ? 'garment-design-number' : 'cap-design-number';
    const infoId = type === 'garment' ? 'garment-design-info' : 'cap-design-info';
    const clearId = type === 'garment' ? 'garment-design-clear' : 'cap-design-clear';

    const input = document.getElementById(inputId);
    const infoBadge = document.getElementById(infoId);
    const clearBtn = document.getElementById(clearId);

    if (input) input.value = '';
    if (infoBadge) { infoBadge.style.display = 'none'; infoBadge.innerHTML = ''; }
    if (clearBtn) clearBtn.style.display = 'none';

    // Clear the design number on the logo object
    setDesignNumberOnLogo(type, null);
    updateLogoCardHeader(type, null);

    // Hide design thumbnail and clear cached URL
    showDesignThumbnail(type, null);
    if (type === 'garment') {
        primaryLogo.thumbnailUrl = null;
        primaryLogo.fbPriceTiers = null;   // unlinked design takes its negotiated FB tiers with it (2026-07-07)
    } else if (typeof capPrimaryLogo !== 'undefined') {
        capPrimaryLogo.thumbnailUrl = null;
    }

    showToast('Design unlinked', 'info');
}

/**
 * Open the design search modal
 * @param {string} type - 'garment' or 'cap'
 */
export function openDesignSearchModal(type) {
    _designSearchTarget = type;
    const modal = document.getElementById('design-search-modal');
    const searchInput = document.getElementById('design-search-input');
    const results = document.getElementById('design-search-results');
    const empty = document.getElementById('design-search-empty');
    const loading = document.getElementById('design-search-loading');
    const galleryHeader = document.getElementById('design-gallery-header');
    const searchHint = document.getElementById('design-search-hint');
    const searchBtn = document.getElementById('design-search-go');

    if (results) results.innerHTML = '';
    if (empty) empty.style.display = 'none';
    if (loading) loading.style.display = 'none';
    if (searchInput) searchInput.value = '';

    // Check if a customer is selected → gallery mode
    const customerId = document.getElementById('customer-number')?.value?.trim();
    const customerName = document.getElementById('customer-name')?.value?.trim()
        || document.getElementById('company-name')?.value?.trim() || '';

    if (customerId) {
        // Gallery mode: auto-load customer designs
        modal.classList.add('gallery-mode');
        if (galleryHeader) {
            galleryHeader.style.display = '';
            const nameEl = galleryHeader.querySelector('.gallery-customer-name');
            if (nameEl) nameEl.textContent = customerName || ('Customer #' + customerId);
            const countEl = galleryHeader.querySelector('.gallery-design-count');
            if (countEl) countEl.textContent = '';
        }
        if (searchHint) searchHint.style.display = 'none';
        if (searchBtn) searchBtn.style.display = 'none';
        if (searchInput) {
            searchInput.placeholder = 'Filter designs...';
            searchInput._galleryMode = true;
        }
        // Show modal then load gallery
        if (modal) { modal.classList.add('active'); modal.style.display = 'flex'; }
        setTimeout(() => { if (searchInput) searchInput.focus(); }, 100);
        loadCustomerDesignGallery(customerId);
    } else {
        // Search mode: original behavior
        modal.classList.remove('gallery-mode');
        if (galleryHeader) galleryHeader.style.display = 'none';
        if (searchHint) searchHint.style.display = '';
        if (searchBtn) searchBtn.style.display = '';
        if (searchInput) {
            searchInput.placeholder = 'Search by company name or design number...';
            searchInput._galleryMode = false;
        }
        if (modal) { modal.classList.add('active'); modal.style.display = 'flex'; }
        setTimeout(() => { if (searchInput) searchInput.focus(); }, 100);
    }
}

/**
 * Close the design search modal
 */
export function closeDesignSearchModal() {
    const modal = document.getElementById('design-search-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.remove('gallery-mode');
        modal.style.display = 'none';
    }
    // Reset filter state so reopening starts fresh
    resetDesignSearchFilters();
}

/**
 * Load all designs for a customer into the gallery
 * Uses unified state + card grid renderer with tier/company chips
 * @param {string} customerId
 */
async function loadCustomerDesignGallery(customerId) {
    const results = document.getElementById('design-search-results');
    const empty = document.getElementById('design-search-empty');
    const loading = document.getElementById('design-search-loading');
    const countEl = document.querySelector('#design-gallery-header .gallery-design-count');

    // Use cached data if same customer
    if (_customerDesignGallery && _customerDesignGallery.customerId === customerId) {
        _designSearchState.allResults = _customerDesignGallery.results;
        _designSearchState.filteredResults = _customerDesignGallery.results;
        renderDesignSearchGrid(_customerDesignGallery.results);
        if (countEl) countEl.textContent = _customerDesignGallery.results.length + ' designs';
        const filters = document.getElementById('design-search-filters');
        if (filters) filters.style.display = 'flex';
        buildDesignSearchCompanyChips(_customerDesignGallery.results);
        updateDesignSearchResultsHeader();
        return;
    }

    if (loading) loading.style.display = 'flex';
    if (results) results.innerHTML = '';
    if (empty) empty.style.display = 'none';
    resetDesignSearchFilters();

    try {
        const apiBase = window.APP_CONFIG.API.BASE_URL;
        const resp = await fetch(`${apiBase}/api/digitized-designs/by-customer?customerId=${encodeURIComponent(customerId)}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();

        if (loading) loading.style.display = 'none';

        if (!data.success || !data.results || data.results.length === 0) {
            // No designs: show message and fall back to search mode
            if (countEl) countEl.textContent = '0 designs';
            const searchInput = document.getElementById('design-search-input');
            const searchHint = document.getElementById('design-search-hint');
            const searchBtn = document.getElementById('design-search-go');
            if (results) results.innerHTML = '<div class="design-search-empty" style="display:flex;"><i class="fas fa-folder-open"></i><p>No designs found for this customer. Use the search bar to find designs by name or number.</p></div>';
            if (searchInput) {
                searchInput.placeholder = 'Search by company name or design number...';
                searchInput._galleryMode = false;
            }
            if (searchHint) searchHint.style.display = '';
            if (searchBtn) searchBtn.style.display = '';
            return;
        }

        // Cache gallery data
        _customerDesignGallery = { customerId, results: data.results };
        if (countEl) countEl.textContent = data.results.length + ' designs';

        // Cache FULL design objects for zero-API-call selection
        designSearchCache = {};
        data.results.forEach(d => {
            designSearchCache[String(d.designNumber)] = d;
        });

        // Store in unified state + render with chips
        _designSearchState.allResults = data.results;
        _designSearchState.filteredResults = data.results;
        const filters = document.getElementById('design-search-filters');
        if (filters) filters.style.display = 'flex';
        buildDesignSearchCompanyChips(data.results);
        renderDesignSearchGrid(data.results);
        updateDesignSearchResultsHeader();

    } catch (err) {
        if (loading) loading.style.display = 'none';
        if (results) results.innerHTML = '<div class="design-search-error"><i class="fas fa-times-circle"></i> Failed to load designs: ' + escapeHtml(err.message) + '</div>';
    }
}

/**
 * Render design search/gallery cards in a CSS grid (unified renderer)
 * Supports batch rendering: shows first 50 cards + "Show more" button
 * @param {Array} designs
 */
function renderDesignSearchGrid(designs) {
    const results = document.getElementById('design-search-results');
    if (!results) return;

    // Remove any old show-more element
    const oldMore = results.querySelector('.design-search-show-more');
    if (oldMore) oldMore.remove();

    if (!designs || designs.length === 0) {
        results.innerHTML = '<div class="design-gallery-no-match"><i class="fas fa-filter"></i> No designs match this filter</div>';
        _designSearchState.displayedCount = 0;
        return;
    }

    // Batch render first N cards
    const initialBatch = designs.slice(0, DESIGN_SEARCH_INITIAL_RENDER);
    results.innerHTML = initialBatch.map(buildDesignSearchCardHtml).join('');
    _designSearchState.displayedCount = initialBatch.length;

    // Add "Show more" button if there are more results
    if (designs.length > DESIGN_SEARCH_INITIAL_RENDER) {
        const remaining = designs.length - DESIGN_SEARCH_INITIAL_RENDER;
        results.innerHTML += '<div class="design-search-show-more"><button onclick="showMoreDesignSearchResults()"><i class="fas fa-chevron-down"></i> Show all ' + designs.length + ' designs (' + remaining + ' more)</button></div>';
    }

    // Lazy-load thumbnails for designs without images
    lazyLoadDesignSearchThumbnails(initialBatch, results);
}

/**
 * Build a single design card HTML (matches standalone gallery layout)
 */
function buildDesignSearchCardHtml(d) {
    const dn = escapeHtml(String(d.designNumber));
    const previewUrl = d.mockupUrl || d.artworkUrl || d.thumbnailUrl || null;
    const thumbHtml = previewUrl
        ? '<img src="' + escapeHtml(previewUrl) + '" alt="Design #' + dn + '" onerror="this.parentElement.innerHTML=\'<i class=\\\'fas fa-image\\\'></i>\'">'
        : '<i class="fas fa-image"></i>';

    let tierBadge = '';
    if (d.maxStitchCount > 0) {
        const tierClass = (d.maxStitchTier || 'Standard').toLowerCase().replace(/\s+/g, '-');
        tierBadge = '<span class="design-tier-badge tier-' + escapeHtml(tierClass) + '">' + escapeHtml(d.maxStitchTier || 'Standard') + '</span>';
    }

    const name = d.designName ? (d.designName.length > 30 ? d.designName.substring(0, 28) + '...' : d.designName) : '';
    const stitchText = d.maxStitchCount > 0 ? d.maxStitchCount.toLocaleString() + ' st' : '';
    const placementBadge = d.placement ? '<span class="design-placement-tag">' + escapeHtml(d.placement) + '</span>' : '';
    const threadText = d.threadColors ? (d.threadColors.length > 35 ? d.threadColors.substring(0, 33) + '...' : d.threadColors) : '';
    const dstArr = d.dstFilenames || [];
    const dstText = dstArr.join(', ');
    const dstDisplay = dstText.length > 50 ? dstArr.slice(0, 2).join(', ') + ' +' + (dstArr.length - 2) + ' more' : dstText;
    const company = d.company || '';

    // [C11] (audit 2026-06-06): pass the value via the data attribute instead of interpolating dn into a JS
    // string in the inline onclick (dn's HTML-attr escaping decodes before JS parses → a quoted design # could
    // break out). Alphanumeric today, but injection-safe now.
    return '<div class="design-gallery-card" onclick="selectDesignFromSearch(this.dataset.designNumber)"'
        + ' data-design-number="' + escapeHtml(dn) + '" data-company="' + escapeHtml(company) + '">'
        + '<div class="design-gallery-thumb" id="gallery-thumb-' + dn + '">' + thumbHtml + '</div>'
        + '<div class="design-gallery-info">'
            + '<div class="design-gallery-number">#' + dn + '</div>'
            + (company ? '<div class="design-gallery-name" title="' + escapeHtml(company) + '" style="font-style:normal;color:#374151;font-weight:500;">' + escapeHtml(company.length > 28 ? company.substring(0, 26) + '...' : company) + '</div>' : '')
            + (name ? '<div class="design-gallery-name" title="' + escapeHtml(d.designName || '') + '">' + escapeHtml(name) + '</div>' : '')
            + '<div class="design-gallery-meta">' + tierBadge + (stitchText ? ' <span class="design-result-stitch">' + stitchText + '</span>' : '') + '</div>'
            + ((placementBadge || threadText) ? '<div class="design-gallery-detail">' + placementBadge + (threadText ? '<span class="design-thread-info" title="' + escapeHtml(d.threadColors || '') + '">' + escapeHtml(threadText) + '</span>' : '') + '</div>' : '')
            + (dstDisplay ? '<div class="design-dst-files" title="' + escapeHtml(dstText) + '"><i class="fas fa-file-code"></i> ' + escapeHtml(dstDisplay) + '</div>' : '')
        + '</div>'
    + '</div>';
}

/**
 * Show remaining design search results (batch rendering)
 */
export function showMoreDesignSearchResults() {
    const results = document.getElementById('design-search-results');
    if (!results) return;

    // Remove the show-more button
    const showMore = results.querySelector('.design-search-show-more');
    if (showMore) showMore.remove();

    // Append remaining cards
    const remaining = _designSearchState.filteredResults.slice(DESIGN_SEARCH_INITIAL_RENDER);
    const temp = document.createElement('div');
    temp.innerHTML = remaining.map(buildDesignSearchCardHtml).join('');
    while (temp.firstChild) {
        results.appendChild(temp.firstChild);
    }
    _designSearchState.displayedCount = _designSearchState.filteredResults.length;

    // Lazy-load thumbnails for remaining
    lazyLoadDesignSearchThumbnails(remaining, results);
}

/**
 * Lazy-load thumbnails for designs missing images in the search modal
 */
function lazyLoadDesignSearchThumbnails(designs, container) {
    if (typeof DesignThumbnailService === 'undefined') return;
    const noImage = designs.filter(d => !d.mockupUrl && !d.artworkUrl && !d.thumbnailUrl).map(d => String(d.designNumber)).slice(0, 20);
    if (noImage.length === 0) return;

    DesignThumbnailService.fetchThumbnailsBatch(noImage).then(thumbMap => {
        for (const [dn, url] of Object.entries(thumbMap)) {
            if (url) {
                // Update cache
                if (designSearchCache && designSearchCache[dn]) {
                    designSearchCache[dn].thumbnailUrl = url;
                }
                // Update DOM
                const slot = container.querySelector('#gallery-thumb-' + dn);
                if (slot && !slot.querySelector('img')) {
                    slot.innerHTML = '<img src="' + escapeHtml(url) + '" alt="Design #' + escapeHtml(dn) + '" onerror="this.parentElement.innerHTML=\'<i class=\\\'fas fa-image\\\'></i>\'">';
                }
            }
        }
    });
}

// Keep old name as alias for backward compat (used by gallery filter)
// renderDesignGallery alias deleted in the move — zero callers repo-wide (incl. generated markup).

/**
 * Debounced search input handler
 */
export function onDesignSearchInput() {
    const input = /** @type {any} */ (document.getElementById('design-search-input')); // expando _galleryMode + .value
    if (!input) return;

    // Gallery mode: client-side filter on cached results (uses unified filter pipeline)
    if (input._galleryMode && _customerDesignGallery) {
        clearTimeout(_galleryFilterTimeout);
        _galleryFilterTimeout = setTimeout(() => {
            applyDesignSearchFilters();
        }, 200);
        return;
    }

    // Search mode: debounced API search
    clearTimeout(_designSearchDebounce);
    _designSearchDebounce = setTimeout(() => {
        if (input && input.value.trim().length >= 2) {
            runDesignSearch();
        }
    }, 400);
}

/**
 * Execute design search — uses gallery card grid layout with tier + company chips
 */
export async function runDesignSearch() {
    const input = /** @type {HTMLInputElement} */ (document.getElementById('design-search-input'));
    const results = document.getElementById('design-search-results');
    const empty = document.getElementById('design-search-empty');
    const loading = document.getElementById('design-search-loading');
    if (!input) return;

    const q = input.value.trim();
    if (q.length < 2) return;

    results.innerHTML = '';
    empty.style.display = 'none';
    loading.style.display = 'flex';
    resetDesignSearchFilters();

    try {
        const apiBase = window.APP_CONFIG.API.BASE_URL;
        const searchCustomerId = /** @type {HTMLInputElement} */ (document.getElementById('customer-number'))?.value?.trim() || '';
        const customerParam = searchCustomerId ? `&customerId=${encodeURIComponent(searchCustomerId)}` : '';
        const resp = await fetch(`${apiBase}/api/digitized-designs/search-all?q=${encodeURIComponent(q)}${customerParam}&limit=100`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();

        loading.style.display = 'none';

        if (!data.success || !data.results || data.results.length === 0) {
            empty.style.display = 'flex';
            return;
        }

        // Cache FULL design objects for zero-API-call selection
        designSearchCache = {};
        data.results.forEach(d => {
            designSearchCache[String(d.designNumber)] = d;
        });

        // Store in unified state
        _designSearchState.allResults = data.results;
        _designSearchState.filteredResults = data.results;

        // Show tier filter chips
        const filters = document.getElementById('design-search-filters');
        if (filters) filters.style.display = 'flex';

        // Build company filter chips
        buildDesignSearchCompanyChips(data.results);

        // Render card grid
        renderDesignSearchGrid(data.results);
        updateDesignSearchResultsHeader();

    } catch (err) {
        loading.style.display = 'none';
        console.error('Design search failed:', err);
        results.innerHTML = '<div class="design-search-error"><i class="fas fa-times-circle"></i> Search failed: ' + escapeHtml(err.message) + '</div>';
    }
}

/**
 * Select a design from the search modal results
 * Uses cached data to avoid redundant API call
 * @param {string} designNum
 */
export async function selectDesignFromSearch(designNum) {
    closeDesignSearchModal();

    // Try to use cached full design data (no API call needed)
    const cached = designSearchCache?.[String(designNum)];
    if (cached && cached.designNumber) {
        // Full design object cached — apply directly
        await applyDesignFromCache(_designSearchTarget, cached);
    } else {
        // Fallback: old behavior (API call) for designs without full cache
        const inputId = _designSearchTarget === 'garment' ? 'garment-design-number' : 'cap-design-number';
        const input = /** @type {HTMLInputElement} */ (document.getElementById(inputId));
        if (input) input.value = designNum;

        // Show thumbnail instantly from partial cache
        const previewUrl = cached?.mockupUrl || cached?.artworkUrl || cached?.thumbnailUrl || null;
        if (previewUrl) {
            showDesignThumbnail(_designSearchTarget, previewUrl);
            if (_designSearchTarget === 'garment') primaryLogo.thumbnailUrl = previewUrl;
            else if (typeof capPrimaryLogo !== 'undefined') capPrimaryLogo.thumbnailUrl = previewUrl;
        }

        await lookupDesignNumber(_designSearchTarget);
    }
}

// ── Accessors for the monolith's outside touch points (customer change/clear
//    invalidation + resetQuote) — the state lives module-private now. ──────
export function invalidateDesignGalleryCache() {
    _customerDesignGallery = null;
}

export function resetDesignSearchState() {
    _customerDesignGallery = null;
    designSearchCache = {};
    _designSearchState.allResults = [];
    _designSearchState.filteredResults = [];
    _designSearchState.activeTier = 'all';
    _designSearchState.activeCompany = 'all';
    _designSearchState.displayedCount = 0;
}
