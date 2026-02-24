/**
 * Design Gallery — Standalone search & browse for 39K+ digitized designs
 * Uses /api/digitized-designs/search-all and /by-customer endpoints
 */
(function () {
    'use strict';

    // --- Config ---
    const API_BASE = (window.APP_CONFIG && APP_CONFIG.API && APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    const SEARCH_DELAY = 350; // debounce ms
    const MAX_RESULTS = 50;

    // --- State ---
    let currentResults = [];   // Full result set from last search
    let filteredResults = [];  // After tier filter
    let activeTier = 'all';
    let searchTimer = null;
    let isCustomerMode = false;

    // --- Init ---
    document.addEventListener('DOMContentLoaded', function () {
        const input = document.getElementById('search-input');
        if (input) {
            input.addEventListener('input', onSearchInput);
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    clearTimeout(searchTimer);
                    doSearch(input.value.trim());
                }
            });
        }
        const custInput = document.getElementById('customer-id-input');
        if (custInput) {
            custInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    loadCustomerGallery();
                }
            });
        }
    });

    // --- Search ---
    function onSearchInput() {
        const input = document.getElementById('search-input');
        const val = input.value.trim();
        const clearBtn = document.getElementById('search-clear');
        clearBtn.style.display = val.length > 0 ? 'flex' : 'none';

        clearTimeout(searchTimer);
        if (val.length < 2) {
            if (val.length === 0) showEmpty();
            return;
        }
        searchTimer = setTimeout(function () { doSearch(val); }, SEARCH_DELAY);
    }

    async function doSearch(query) {
        if (!query || query.length < 2) return;
        isCustomerMode = false;
        showLoading();

        try {
            const custId = document.getElementById('customer-id-input').value.trim();
            let url = API_BASE + '/api/digitized-designs/search-all?q=' + encodeURIComponent(query)
                + '&limit=' + MAX_RESULTS;
            if (custId) url += '&customerId=' + encodeURIComponent(custId);

            const resp = await fetch(url);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();

            if (!data.success || !data.results || data.results.length === 0) {
                currentResults = [];
                showNoResults();
                return;
            }

            currentResults = data.results;
            activeTier = 'all';
            resetTierChips();
            applyFilter();
            showResultsHeader(data.count, data.totalMatches, query);
        } catch (err) {
            showToast('Search failed: ' + err.message, 'error');
            showNoResults();
        }
    }

    // --- Customer Gallery ---
    window.loadCustomerGallery = async function () {
        const custId = document.getElementById('customer-id-input').value.trim();
        if (!custId) {
            showToast('Enter a Customer # first', 'warning');
            return;
        }
        isCustomerMode = true;
        showLoading();

        try {
            const url = API_BASE + '/api/digitized-designs/by-customer?customerId=' + encodeURIComponent(custId);
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();

            if (!data.success || !data.results || data.results.length === 0) {
                currentResults = [];
                showNoResults();
                return;
            }

            currentResults = data.results;
            activeTier = 'all';
            resetTierChips();
            applyFilter();
            showResultsHeader(data.count, data.count, 'Customer #' + custId);
        } catch (err) {
            showToast('Customer lookup failed: ' + err.message, 'error');
            showNoResults();
        }
    };

    // --- Tier Filter ---
    window.filterByTier = function (tier) {
        activeTier = tier;
        document.querySelectorAll('.filter-chips .chip').forEach(function (c) {
            c.classList.toggle('active', c.dataset.tier === tier);
        });
        applyFilter();
    };

    function resetTierChips() {
        document.querySelectorAll('.filter-chips .chip').forEach(function (c) {
            c.classList.toggle('active', c.dataset.tier === 'all');
        });
    }

    function applyFilter() {
        if (activeTier === 'all') {
            filteredResults = currentResults;
        } else {
            filteredResults = currentResults.filter(function (d) {
                return (d.maxStitchTier || 'Standard') === activeTier;
            });
        }
        renderGrid(filteredResults);
    }

    // --- Render ---
    function renderGrid(designs) {
        const grid = document.getElementById('design-grid');
        hideAll();
        grid.style.display = 'grid';
        document.getElementById('results-header').style.display = 'flex';

        if (designs.length === 0) {
            grid.innerHTML = '<div class="no-filter-results">No designs match this tier filter.</div>';
            return;
        }

        grid.innerHTML = designs.map(function (d) {
            const dn = escapeHtml(String(d.designNumber));
            const name = d.designName ? (d.designName.length > 28 ? d.designName.substring(0, 26) + '...' : d.designName) : '';
            const company = d.company || '';
            const companyDisplay = company.length > 25 ? company.substring(0, 23) + '...' : company;

            // Tier badge
            const tierClass = (d.maxStitchTier || 'Standard').toLowerCase().replace(/\s+/g, '-');
            const tierBadge = d.maxStitchCount > 0
                ? '<span class="tier-badge tier-' + escapeHtml(tierClass) + '">' + escapeHtml(d.maxStitchTier || 'Standard') + '</span>'
                : '';
            const stitchText = d.maxStitchCount > 0 ? d.maxStitchCount.toLocaleString() + ' st' : '';

            // Thumbnail
            const thumbUrl = d.thumbnailUrl || d.artworkUrl || '';
            const thumbHtml = thumbUrl
                ? '<img src="' + escapeHtml(thumbUrl) + '" alt="Design #' + dn + '" loading="lazy" onerror="this.parentElement.innerHTML=\'<i class=\\\'fas fa-pencil-ruler thumb-placeholder\\\'></i>\'">'
                : '<i class="fas fa-pencil-ruler thumb-placeholder"></i>';

            // Placement
            const placementBadge = d.placement ? '<span class="placement-tag">' + escapeHtml(d.placement) + '</span>' : '';

            // Thread colors
            const threadText = d.threadColors ? (d.threadColors.length > 30 ? d.threadColors.substring(0, 28) + '...' : d.threadColors) : '';

            // DST filenames
            const dstArr = d.dstFilenames || [];
            const dstText = dstArr.join(', ');
            const dstDisplay = dstText.length > 45
                ? dstArr.slice(0, 2).join(', ') + ' +' + (dstArr.length - 2) + ' more'
                : dstText;

            return '<div class="design-card" onclick="copyDesignNumber(\'' + dn + '\')" title="Click to copy design #' + dn + '">'
                + '<div class="card-thumb">' + thumbHtml + '</div>'
                + '<div class="card-info">'
                    + '<div class="card-number">#' + dn + '</div>'
                    + (company ? '<div class="card-company" title="' + escapeHtml(company) + '">' + escapeHtml(companyDisplay) + '</div>' : '')
                    + (name ? '<div class="card-name" title="' + escapeHtml(d.designName || '') + '">' + escapeHtml(name) + '</div>' : '')
                    + '<div class="card-meta">' + tierBadge + (stitchText ? ' <span class="card-stitch">' + stitchText + '</span>' : '') + '</div>'
                    + ((placementBadge || threadText) ? '<div class="card-detail">' + placementBadge + (threadText ? '<span class="card-threads" title="' + escapeHtml(d.threadColors || '') + '">' + escapeHtml(threadText) + '</span>' : '') + '</div>' : '')
                    + (dstDisplay ? '<div class="card-dst" title="' + escapeHtml(dstText) + '"><i class="fas fa-file-code"></i> ' + escapeHtml(dstDisplay) + '</div>' : '')
                + '</div>'
                + '<button class="card-expand" onclick="event.stopPropagation(); openDetail(\'' + dn + '\')" title="View details">'
                    + '<i class="fas fa-expand-alt"></i>'
                + '</button>'
            + '</div>';
        }).join('');

        // Lazy-load thumbnails for designs without images via DesignThumbnailService
        if (typeof DesignThumbnailService !== 'undefined') {
            var noImageDesigns = designs.filter(function (d) { return !d.thumbnailUrl && !d.artworkUrl; })
                .map(function (d) { return String(d.designNumber); }).slice(0, 20);
            if (noImageDesigns.length > 0) {
                DesignThumbnailService.fetchThumbnailsBatch(noImageDesigns).then(function (thumbMap) {
                    for (var dn in thumbMap) {
                        if (thumbMap[dn]) {
                            var cards = grid.querySelectorAll('.design-card');
                            cards.forEach(function (card) {
                                var numEl = card.querySelector('.card-number');
                                if (numEl && numEl.textContent === '#' + dn) {
                                    var thumbDiv = card.querySelector('.card-thumb');
                                    if (thumbDiv && thumbDiv.querySelector('.thumb-placeholder')) {
                                        thumbDiv.innerHTML = '<img src="' + escapeHtml(thumbMap[dn]) + '" alt="Design" loading="lazy">';
                                    }
                                }
                            });
                        }
                    }
                });
            }
        }
    }

    // --- Detail Panel ---
    window.openDetail = function (designNumber) {
        var design = currentResults.find(function (d) { return String(d.designNumber) === designNumber; });
        if (!design) return;

        var panel = document.getElementById('detail-panel');
        var overlay = document.getElementById('detail-overlay');
        var title = document.getElementById('detail-title');
        var body = document.getElementById('detail-body');

        title.textContent = 'Design #' + designNumber;

        var thumbUrl = design.thumbnailUrl || design.artworkUrl || '';
        var dstArr = design.dstFilenames || [];
        var tierClass = (design.maxStitchTier || 'Standard').toLowerCase().replace(/\s+/g, '-');

        body.innerHTML = ''
            + (thumbUrl ? '<div class="detail-image"><img src="' + escapeHtml(thumbUrl) + '" alt="Design #' + escapeHtml(designNumber) + '" onerror="this.parentElement.style.display=\'none\'"></div>' : '')
            + '<button class="btn-copy-detail" onclick="copyDesignNumber(\'' + escapeHtml(designNumber) + '\')"><i class="fas fa-copy"></i> Copy Design #' + escapeHtml(designNumber) + '</button>'
            + '<div class="detail-section">'
                + '<div class="detail-row"><span class="detail-label">Company</span><span class="detail-value">' + escapeHtml(design.company || 'Unknown') + '</span></div>'
                + (design.designName ? '<div class="detail-row"><span class="detail-label">Design Name</span><span class="detail-value">' + escapeHtml(design.designName) + '</span></div>' : '')
                + (design.customerId ? '<div class="detail-row"><span class="detail-label">Customer #</span><span class="detail-value">' + escapeHtml(design.customerId) + '</span></div>' : '')
            + '</div>'
            + '<div class="detail-section">'
                + '<div class="detail-row"><span class="detail-label">Stitch Tier</span><span class="detail-value"><span class="tier-badge tier-' + escapeHtml(tierClass) + '">' + escapeHtml(design.maxStitchTier || 'Standard') + '</span></span></div>'
                + (design.maxStitchCount ? '<div class="detail-row"><span class="detail-label">Max Stitch Count</span><span class="detail-value">' + design.maxStitchCount.toLocaleString() + '</span></div>' : '')
                + (design.placement ? '<div class="detail-row"><span class="detail-label">Placement</span><span class="detail-value">' + escapeHtml(design.placement) + '</span></div>' : '')
                + (design.threadColors ? '<div class="detail-row"><span class="detail-label">Thread Colors</span><span class="detail-value detail-threads">' + escapeHtml(design.threadColors) + '</span></div>' : '')
            + '</div>'
            + (dstArr.length > 0 ? '<div class="detail-section"><div class="detail-section-title"><i class="fas fa-file-code"></i> DST Files (' + dstArr.length + ')</div>'
                + dstArr.map(function (f) { return '<div class="dst-file-row"><i class="fas fa-file"></i> ' + escapeHtml(f) + '</div>'; }).join('')
            + '</div>' : '')
            + ((design.orderCount > 0 || design.lastOrderDate) ? '<div class="detail-section">'
                + (design.orderCount > 0 ? '<div class="detail-row"><span class="detail-label">Order Count</span><span class="detail-value">' + design.orderCount + ' orders</span></div>' : '')
                + (design.lastOrderDate ? '<div class="detail-row"><span class="detail-label">Last Order</span><span class="detail-value">' + new Date(design.lastOrderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + '</span></div>' : '')
            + '</div>' : '')
            + (design.artNotes ? '<div class="detail-section"><div class="detail-section-title"><i class="fas fa-sticky-note"></i> Art Notes</div><p class="detail-notes">' + escapeHtml(design.artNotes) + '</p></div>' : '');

        overlay.classList.add('active');
        panel.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    window.closeDetail = function () {
        document.getElementById('detail-panel').classList.remove('active');
        document.getElementById('detail-overlay').classList.remove('active');
        document.body.style.overflow = '';
    };

    // --- Copy Design # ---
    window.copyDesignNumber = function (designNumber) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(designNumber).then(function () {
                showToast('Design #' + designNumber + ' copied!', 'success');
            });
        } else {
            // Fallback
            var ta = document.createElement('textarea');
            ta.value = designNumber;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('Design #' + designNumber + ' copied!', 'success');
        }
    };

    // --- Clear ---
    window.clearSearch = function () {
        var input = document.getElementById('search-input');
        input.value = '';
        document.getElementById('search-clear').style.display = 'none';
        currentResults = [];
        filteredResults = [];
        showEmpty();
        input.focus();
    };

    // --- UI State Helpers ---
    function hideAll() {
        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('no-results').style.display = 'none';
        document.getElementById('results-header').style.display = 'none';
        document.getElementById('design-grid').style.display = 'none';
    }

    function showEmpty() {
        hideAll();
        document.getElementById('empty-state').style.display = 'flex';
    }

    function showLoading() {
        hideAll();
        document.getElementById('loading-state').style.display = 'block';
    }

    function showNoResults() {
        hideAll();
        document.getElementById('no-results').style.display = 'flex';
    }

    function showResultsHeader(shown, total, query) {
        var header = document.getElementById('results-header');
        header.style.display = 'flex';
        document.getElementById('results-count').textContent = shown + (total > shown ? ' of ' + total : '') + ' designs';
        document.getElementById('results-query').textContent = query ? 'for "' + query + '"' : '';
    }

    // --- Toast ---
    function showToast(message, type) {
        var container = document.getElementById('toast-container');
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + (type || 'info');
        var icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
        toast.innerHTML = '<i class="fas ' + icon + '"></i> ' + escapeHtml(message);
        container.appendChild(toast);
        setTimeout(function () { toast.classList.add('show'); }, 10);
        setTimeout(function () {
            toast.classList.remove('show');
            setTimeout(function () { toast.remove(); }, 300);
        }, 2500);
    }
    window.showToast = showToast;

    // --- Escape HTML ---
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

})();
