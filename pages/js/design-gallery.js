/**
 * Design Gallery v2 — Standalone search & browse for 39K+ digitized designs
 * Features: batch rendering, centered modal, company chips, "show all" pagination
 * Uses /api/digitized-designs/search-all and /by-customer endpoints
 */
(function () {
    'use strict';

    // --- Config ---
    var API_BASE = (window.APP_CONFIG && APP_CONFIG.API && APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    var SEARCH_DELAY = 350;
    var MAX_RESULTS = 200;
    var INITIAL_RENDER_COUNT = 50;

    // --- State ---
    var currentResults = [];
    var filteredResults = [];
    var activeTier = 'all';
    var activeCompany = 'all';
    var searchTimer = null;
    var isCustomerMode = false;
    var displayedCount = 0;

    // --- Init ---
    document.addEventListener('DOMContentLoaded', function () {
        var input = document.getElementById('search-input');
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
        var custInput = document.getElementById('customer-id-input');
        if (custInput) {
            custInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    loadCustomerGallery();
                }
            });
        }

        // Escape key closes modal/panel
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                closeDesignModal();
                closeDetail();
            }
        });
    });

    // --- Search ---
    function onSearchInput() {
        var input = document.getElementById('search-input');
        var val = input.value.trim();
        var clearBtn = document.getElementById('search-clear');
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
            var custId = document.getElementById('customer-id-input').value.trim();
            var url = API_BASE + '/api/digitized-designs/search-all?q=' + encodeURIComponent(query)
                + '&limit=' + MAX_RESULTS;
            if (custId) url += '&customerId=' + encodeURIComponent(custId);

            var resp = await fetch(url);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();

            if (!data.success || !data.results || data.results.length === 0) {
                currentResults = [];
                showNoResults();
                hideCompanyChips();
                return;
            }

            currentResults = data.results;
            activeTier = 'all';
            activeCompany = 'all';
            resetTierChips();
            applyFilter();
            showResultsHeader(filteredResults.length, data.totalMatches, query);
            buildCompanyChips(currentResults);

            // Update header subtitle with dynamic count
            var subtitleEl = document.getElementById('record-count');
            if (subtitleEl && data.totalMatches) {
                subtitleEl.textContent = data.totalMatches.toLocaleString() + '+ digitized designs';
            }
        } catch (err) {
            showToast('Search failed: ' + err.message, 'error');
            showNoResults();
        }
    }

    // --- Customer Gallery ---
    window.loadCustomerGallery = async function () {
        var custId = document.getElementById('customer-id-input').value.trim();
        if (!custId) {
            showToast('Enter a Customer # first', 'warning');
            return;
        }
        isCustomerMode = true;
        showLoading();

        try {
            var url = API_BASE + '/api/digitized-designs/by-customer?customerId=' + encodeURIComponent(custId);
            var resp = await fetch(url);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();

            if (!data.success || !data.results || data.results.length === 0) {
                currentResults = [];
                showNoResults();
                hideCompanyChips();
                return;
            }

            currentResults = data.results;
            activeTier = 'all';
            activeCompany = 'all';
            resetTierChips();
            applyFilter();
            showResultsHeader(filteredResults.length, data.count, 'Customer #' + custId);
            buildCompanyChips(currentResults);
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
        // Update results header
        var queryEl = document.getElementById('results-query');
        showResultsHeader(filteredResults.length, currentResults.length, queryEl ? queryEl.dataset.query || '' : '');
    };

    function resetTierChips() {
        document.querySelectorAll('.filter-chips .chip').forEach(function (c) {
            c.classList.toggle('active', c.dataset.tier === 'all');
        });
    }

    // --- Company Filter ---
    window.filterByCompany = function (company) {
        activeCompany = company;
        document.querySelectorAll('.company-chips .company-chip').forEach(function (c) {
            c.classList.toggle('active', c.dataset.company === company);
        });
        applyFilter();
        var queryEl = document.getElementById('results-query');
        showResultsHeader(filteredResults.length, currentResults.length, queryEl ? queryEl.dataset.query || '' : '');
    };

    function buildCompanyChips(designs) {
        var container = document.getElementById('company-chips');
        if (!container) return;

        // Count designs per company
        var companyCounts = {};
        designs.forEach(function (d) {
            var name = d.company || 'Unknown';
            companyCounts[name] = (companyCounts[name] || 0) + 1;
        });

        var companies = Object.keys(companyCounts).sort();

        // Only show chips if there are 2+ companies
        if (companies.length < 2) {
            container.style.display = 'none';
            return;
        }

        var html = '<button class="company-chip active" data-company="all" onclick="filterByCompany(\'all\')">'
            + 'All <span class="chip-count">(' + designs.length + ')</span></button>';

        companies.forEach(function (name) {
            var escapedName = name.replace(/'/g, "\\'");
            html += '<button class="company-chip" data-company="' + escapeHtml(name) + '" '
                + 'onclick="filterByCompany(\'' + escapedName + '\')" title="' + escapeHtml(name) + '">'
                + escapeHtml(name.length > 30 ? name.substring(0, 28) + '...' : name)
                + ' <span class="chip-count">(' + companyCounts[name] + ')</span></button>';
        });

        container.innerHTML = html;
        container.style.display = 'flex';
    }

    function hideCompanyChips() {
        var container = document.getElementById('company-chips');
        if (container) {
            container.style.display = 'none';
            container.innerHTML = '';
        }
        activeCompany = 'all';
    }

    // --- Combined Filter ---
    function applyFilter() {
        // Remove old show-all bar if present
        var old = document.getElementById('show-all-bar');
        if (old) old.remove();

        var results = currentResults;

        // Apply tier filter
        if (activeTier !== 'all') {
            results = results.filter(function (d) {
                return (d.maxStitchTier || 'Standard') === activeTier;
            });
        }

        // Apply company filter
        if (activeCompany !== 'all') {
            results = results.filter(function (d) {
                return (d.company || 'Unknown') === activeCompany;
            });
        }

        filteredResults = results;
        renderGrid(filteredResults);
    }

    // --- Render Grid (batch rendering) ---
    function renderGrid(designs) {
        var grid = document.getElementById('design-grid');
        hideAll();
        grid.style.display = 'grid';
        document.getElementById('results-header').style.display = 'flex';

        if (designs.length === 0) {
            grid.innerHTML = '<div class="no-filter-results">No designs match this filter.</div>';
            return;
        }

        // Render first batch
        var initialBatch = designs.slice(0, INITIAL_RENDER_COUNT);
        grid.innerHTML = initialBatch.map(buildCardHtml).join('');
        displayedCount = initialBatch.length;

        // If more exist, append "Show all" button
        if (designs.length > INITIAL_RENDER_COUNT) {
            var showAllBar = document.createElement('div');
            showAllBar.className = 'show-all-bar';
            showAllBar.id = 'show-all-bar';
            showAllBar.innerHTML = '<button class="btn-show-all" onclick="showAllResults()">'
                + '<i class="fas fa-chevron-down"></i> Show all ' + designs.length + ' designs'
                + '</button>';
            grid.parentNode.insertBefore(showAllBar, grid.nextSibling);
        }

        // Lazy-load thumbnails
        lazyLoadThumbnails(initialBatch, grid);
    }

    // --- Build Card HTML (extracted helper) ---
    function buildCardHtml(d) {
        var dn = escapeHtml(String(d.designNumber));
        var name = d.designName || '';
        var company = d.company || '';
        var tierValue = d.maxStitchTier || 'Standard';

        // Tier badge
        var tierClass = tierValue.toLowerCase().replace(/\s+/g, '-');
        var tierBadge = d.maxStitchCount > 0
            ? '<span class="tier-badge tier-' + escapeHtml(tierClass) + '">' + escapeHtml(tierValue) + '</span>'
            : '';
        var stitchText = d.maxStitchCount > 0 ? d.maxStitchCount.toLocaleString() + ' st' : '';

        // Thumbnail — prefer mockup over DST preview
        var thumbUrl = d.mockupUrl || d.thumbnailUrl || d.artworkUrl || '';
        var thumbHtml = thumbUrl
            ? '<img src="' + escapeHtml(thumbUrl) + '" alt="Design #' + dn + '" loading="lazy" onerror="this.parentElement.innerHTML=\'<i class=\\\'fas fa-pencil-ruler thumb-placeholder\\\'></i>\'">'
            : '<i class="fas fa-pencil-ruler thumb-placeholder"></i>';

        // Placement
        var placementBadge = d.placement ? '<span class="placement-tag">' + escapeHtml(d.placement) + '</span>' : '';

        // Thread colors
        var threadText = d.threadColors ? (d.threadColors.length > 30 ? d.threadColors.substring(0, 28) + '...' : d.threadColors) : '';

        // DST filenames
        var dstArr = d.dstFilenames || [];
        var dstText = dstArr.join(', ');
        var dstDisplay = dstText.length > 45
            ? dstArr.slice(0, 2).join(', ') + ' +' + (dstArr.length - 2) + ' more'
            : dstText;

        return '<div class="design-card" data-tier="' + escapeHtml(tierValue) + '" onclick="openDesignModal(\'' + dn + '\')" title="Click to view design #' + dn + '">'
            + '<div class="card-thumb">' + thumbHtml + '</div>'
            + '<div class="card-info">'
                + '<div class="card-number">#' + dn + '</div>'
                + (company ? '<div class="card-company" title="' + escapeHtml(company) + '">' + escapeHtml(company) + '</div>' : '')
                + (name ? '<div class="card-name" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</div>' : '')
                + '<div class="card-meta">' + tierBadge + (stitchText ? ' <span class="card-stitch">' + stitchText + '</span>' : '') + '</div>'
                + ((placementBadge || threadText) ? '<div class="card-detail">' + placementBadge + (threadText ? '<span class="card-threads" title="' + escapeHtml(d.threadColors || '') + '">' + escapeHtml(threadText) + '</span>' : '') + '</div>' : '')
                + (dstDisplay ? '<div class="card-dst" title="' + escapeHtml(dstText) + '"><i class="fas fa-file-code"></i> ' + escapeHtml(dstDisplay) + '</div>' : '')
            + '</div>'
            + '<button class="card-copy-btn" onclick="event.stopPropagation(); copyDesignNumber(\'' + dn + '\')" title="Copy design #' + dn + '">'
                + '<i class="fas fa-copy"></i>'
            + '</button>'
        + '</div>';
    }

    // --- Show All Results ---
    window.showAllResults = function () {
        var grid = document.getElementById('design-grid');
        var showAllBar = document.getElementById('show-all-bar');

        // Render remaining cards
        var remaining = filteredResults.slice(INITIAL_RENDER_COUNT);
        var temp = document.createElement('div');
        temp.innerHTML = remaining.map(buildCardHtml).join('');
        while (temp.firstChild) {
            grid.appendChild(temp.firstChild);
        }
        displayedCount = filteredResults.length;

        // Remove the show-all bar
        if (showAllBar) showAllBar.remove();

        // Update results header
        var countEl = document.getElementById('results-count');
        if (countEl) countEl.textContent = filteredResults.length + ' designs';

        // Lazy-load thumbnails for remaining
        lazyLoadThumbnails(remaining, grid);
    };

    // --- Lazy Load Thumbnails (extracted helper) ---
    function lazyLoadThumbnails(designs, grid) {
        if (typeof DesignThumbnailService === 'undefined') return;

        var noImageDesigns = designs.filter(function (d) { return !d.mockupUrl && !d.thumbnailUrl && !d.artworkUrl; })
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

    // --- Design Modal (centered) ---
    window.openDesignModal = function (designNumber) {
        var design = currentResults.find(function (d) { return String(d.designNumber) === designNumber; });
        if (!design) return;

        var modal = document.getElementById('design-modal');
        var overlay = document.getElementById('design-modal-overlay');
        var body = document.getElementById('design-modal-body');

        var displayUrl = design.mockupUrl || design.thumbnailUrl || design.artworkUrl || '';
        var dstArr = design.dstFilenames || [];
        var tierValue = design.maxStitchTier || 'Standard';
        var tierClass = tierValue.toLowerCase().replace(/\s+/g, '-');

        body.innerHTML = ''
            + '<div class="modal-design-header">'
                + '<h2 class="modal-design-number">Design #' + escapeHtml(designNumber) + '</h2>'
                + (design.company ? '<div class="modal-design-company">' + escapeHtml(design.company) + '</div>' : '')
                + (design.designName ? '<div class="modal-design-name">' + escapeHtml(design.designName) + '</div>' : '')
            + '</div>'
            + (displayUrl
                ? '<div class="modal-design-image"><img src="' + escapeHtml(displayUrl) + '" alt="Design #' + escapeHtml(designNumber) + '" onerror="this.parentElement.innerHTML=\'<i class=\\\'fas fa-pencil-ruler modal-no-image\\\' style=\\\'font-size:64px;color:#d1d5db\\\'></i>\'"></div>'
                : '<div class="modal-design-image"><i class="fas fa-pencil-ruler" style="font-size:64px;color:#d1d5db"></i></div>')
            + '<button class="btn-copy-modal" onclick="copyDesignNumber(\'' + escapeHtml(designNumber) + '\')">'
                + '<i class="fas fa-copy"></i> Copy Design #' + escapeHtml(designNumber)
            + '</button>'
            + buildDetailSections(design, tierClass, dstArr);

        overlay.classList.add('active');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    window.closeDesignModal = function () {
        var modal = document.getElementById('design-modal');
        var overlay = document.getElementById('design-modal-overlay');
        if (modal) modal.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    };

    // --- Build Detail Sections (shared by modal and side panel) ---
    function buildDetailSections(design, tierClass, dstArr) {
        var tierValue = design.maxStitchTier || 'Standard';
        var html = '';

        // Basic info
        html += '<div class="modal-section">';
        if (design.customerId) {
            html += '<div class="modal-row"><span class="modal-label">Customer #</span><span class="modal-value">' + escapeHtml(design.customerId) + '</span></div>';
        }
        html += '<div class="modal-row"><span class="modal-label">Stitch Tier</span><span class="modal-value"><span class="tier-badge tier-' + escapeHtml(tierClass) + '">' + escapeHtml(tierValue) + '</span></span></div>';
        if (design.maxStitchCount) {
            html += '<div class="modal-row"><span class="modal-label">Max Stitch Count</span><span class="modal-value">' + design.maxStitchCount.toLocaleString() + '</span></div>';
        }
        if (design.placement) {
            html += '<div class="modal-row"><span class="modal-label">Placement</span><span class="modal-value">' + escapeHtml(design.placement) + '</span></div>';
        }
        if (design.threadColors) {
            html += '<div class="modal-row"><span class="modal-label">Thread Colors</span><span class="modal-value modal-threads">' + escapeHtml(design.threadColors) + '</span></div>';
        }
        html += '</div>';

        // DST files (full list, not truncated — key for Ruthie)
        if (dstArr.length > 0) {
            html += '<div class="modal-section">'
                + '<div class="modal-section-title"><i class="fas fa-file-code"></i> DST Files (' + dstArr.length + ')</div>';
            dstArr.forEach(function (f) {
                html += '<div class="modal-dst-file"><i class="fas fa-file"></i> ' + escapeHtml(f) + '</div>';
            });
            html += '</div>';
        }

        // Order history
        if (design.orderCount > 0 || design.lastOrderDate) {
            html += '<div class="modal-section">';
            if (design.orderCount > 0) {
                html += '<div class="modal-row"><span class="modal-label">Order Count</span><span class="modal-value">' + design.orderCount + ' orders</span></div>';
            }
            if (design.lastOrderDate) {
                html += '<div class="modal-row"><span class="modal-label">Last Order</span><span class="modal-value">'
                    + new Date(design.lastOrderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    + '</span></div>';
            }
            html += '</div>';
        }

        // Art notes
        if (design.artNotes) {
            html += '<div class="modal-section">'
                + '<div class="modal-section-title"><i class="fas fa-sticky-note"></i> Art Notes</div>'
                + '<p class="modal-notes">' + escapeHtml(design.artNotes) + '</p>'
                + '</div>';
        }

        // DST Preview — show small stitch preview when mockup is the main image
        if (design.mockupUrl && design.thumbnailUrl && design.thumbnailUrl !== design.mockupUrl) {
            html += '<div class="modal-section">'
                + '<div class="modal-section-title"><i class="fas fa-microchip"></i> DST Stitch Preview</div>'
                + '<div class="modal-dst-preview"><img src="' + escapeHtml(design.thumbnailUrl) + '" alt="DST stitch preview" onerror="this.parentElement.parentElement.style.display=\'none\'"></div>'
                + '</div>';
        }

        return html;
    }

    // --- Side Panel (kept for backward compatibility) ---
    window.openDetail = function (designNumber) {
        var design = currentResults.find(function (d) { return String(d.designNumber) === designNumber; });
        if (!design) return;

        var panel = document.getElementById('detail-panel');
        var overlay = document.getElementById('detail-overlay');
        var title = document.getElementById('detail-title');
        var body = document.getElementById('detail-body');

        title.textContent = 'Design #' + designNumber;

        var displayUrl = design.mockupUrl || design.thumbnailUrl || design.artworkUrl || '';
        var dstArr = design.dstFilenames || [];
        var tierClass = (design.maxStitchTier || 'Standard').toLowerCase().replace(/\s+/g, '-');

        body.innerHTML = ''
            + (displayUrl ? '<div class="detail-image"><img src="' + escapeHtml(displayUrl) + '" alt="Design #' + escapeHtml(designNumber) + '" onerror="this.parentElement.style.display=\'none\'"></div>' : '')
            + '<button class="btn-copy-detail" onclick="copyDesignNumber(\'' + escapeHtml(designNumber) + '\')"><i class="fas fa-copy"></i> Copy Design #' + escapeHtml(designNumber) + '</button>'
            + buildDetailSections(design, tierClass, dstArr);

        overlay.classList.add('active');
        panel.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    window.closeDetail = function () {
        var panel = document.getElementById('detail-panel');
        var overlay = document.getElementById('detail-overlay');
        if (panel) panel.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    };

    // --- Copy Design # ---
    window.copyDesignNumber = function (designNumber) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(designNumber).then(function () {
                showToast('Design #' + designNumber + ' copied!', 'success');
            });
        } else {
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
        activeTier = 'all';
        activeCompany = 'all';
        resetTierChips();
        hideCompanyChips();
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
        var old = document.getElementById('show-all-bar');
        if (old) old.remove();
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

        var countText = shown + (total > shown ? ' of ' + total : '') + ' designs';

        // Add "Show all" link if there are hidden results already loaded client-side
        if (filteredResults.length > INITIAL_RENDER_COUNT && displayedCount < filteredResults.length) {
            countText += ' <a href="#" class="show-all-link" onclick="event.preventDefault(); showAllResults();">Show all</a>';
        }

        document.getElementById('results-count').innerHTML = countText;
        var queryEl = document.getElementById('results-query');
        queryEl.textContent = query ? 'for \u201c' + query + '\u201d' : '';
        queryEl.dataset.query = query || '';
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
        }, type === 'success' ? 3000 : 2500);
    }
    window.showToast = showToast;

    // --- Escape HTML ---
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

})();
