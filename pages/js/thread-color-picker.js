/**
 * Thread Color Picker — modal component for selecting Robison-Anton thread colors.
 * Used by the Embroidery Mockup Generator for interactive color swapping.
 */
var ThreadColorPicker = (function() {
    'use strict';

    var API_BASE = 'https://inksoft-transform-8a3dc4e38097.herokuapp.com';
    var palette = null;
    var modal = null;
    var onSelectCallback = null;
    var currentRunIndex = -1;
    var activeFamily = 'All';
    var searchQuery = '';

    // DOM refs (created once)
    var overlay, container, searchInput, familyBar, grid, currentLabel;

    function init() {
        if (modal) return Promise.resolve();
        // L2 — 10-second timeout so a dead API doesn't hang the modal forever.
        // Previously if Heroku was down, fetch would hang indefinitely.
        var timeoutId;
        var timeoutPromise = new Promise(function (_, reject) {
            timeoutId = setTimeout(function () {
                reject(new Error('Thread palette API timed out (10s)'));
            }, 10000);
        });
        var fetchPromise = fetch(API_BASE + '/api/embroidery/palette')
            .then(function(r) {
                if (!r.ok) throw new Error('Thread palette API returned HTTP ' + r.status);
                return r.json();
            })
            .then(function(data) {
                if (!data.success) throw new Error(data.error || 'Failed to load palette');
                palette = data;
                _buildModal();
            });
        return Promise.race([fetchPromise, timeoutPromise])
            .finally(function () { clearTimeout(timeoutId); });
    }

    function open(runIndex, currentColor, onSelect) {
        if (!modal) return;
        currentRunIndex = runIndex;
        onSelectCallback = onSelect;
        activeFamily = 'All';
        searchQuery = '';
        searchInput.value = '';

        // Update current color label
        currentLabel.innerHTML = '';
        var sw = document.createElement('span');
        sw.className = 'tcp-current-swatch';
        sw.style.background = currentColor.hex || '#888';
        currentLabel.appendChild(sw);
        var txt = document.createElement('span');
        txt.textContent = (currentColor.name || '?') + ' #' + (currentColor.catalog || '');
        currentLabel.appendChild(txt);

        // Reset family tabs
        var tabs = familyBar.querySelectorAll('.tcp-tab');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.toggle('active', tabs[i].dataset.family === 'All');
        }

        _renderGrid();
        overlay.classList.add('visible');
    }

    function close() {
        if (overlay) overlay.classList.remove('visible');
        onSelectCallback = null;
    }

    function _buildModal() {
        overlay = document.createElement('div');
        overlay.className = 'tcp-overlay';
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) close();
        });

        container = document.createElement('div');
        container.className = 'tcp-modal';

        // Header
        var header = document.createElement('div');
        header.className = 'tcp-header';
        var title = document.createElement('h3');
        title.textContent = 'Choose Thread Color';
        var closeBtn = document.createElement('button');
        closeBtn.className = 'tcp-close';
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.addEventListener('click', close);
        header.appendChild(title);
        header.appendChild(closeBtn);

        // Current color
        var currentRow = document.createElement('div');
        currentRow.className = 'tcp-current';
        var curLbl = document.createElement('span');
        curLbl.className = 'tcp-current-label';
        curLbl.textContent = 'Current: ';
        currentLabel = document.createElement('span');
        currentLabel.className = 'tcp-current-value';
        currentRow.appendChild(curLbl);
        currentRow.appendChild(currentLabel);

        // Search
        searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'tcp-search';
        searchInput.placeholder = 'Search by name or catalog #...';
        var debounceTimer = null;
        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function() {
                searchQuery = searchInput.value.trim().toLowerCase();
                _renderGrid();
            }, 150);
        });

        // Family tabs
        familyBar = document.createElement('div');
        familyBar.className = 'tcp-family-bar';
        var allFamilies = ['All'].concat(palette.families || []);
        allFamilies.forEach(function(fam) {
            var tab = document.createElement('button');
            tab.className = 'tcp-tab' + (fam === 'All' ? ' active' : '');
            tab.textContent = fam;
            tab.dataset.family = fam;
            tab.addEventListener('click', function() {
                activeFamily = fam;
                var tabs = familyBar.querySelectorAll('.tcp-tab');
                for (var i = 0; i < tabs.length; i++) {
                    tabs[i].classList.toggle('active', tabs[i].dataset.family === fam);
                }
                _renderGrid();
            });
            familyBar.appendChild(tab);
        });

        // Color grid
        grid = document.createElement('div');
        grid.className = 'tcp-grid';

        container.appendChild(header);
        container.appendChild(currentRow);
        container.appendChild(searchInput);
        container.appendChild(familyBar);
        container.appendChild(grid);
        overlay.appendChild(container);
        document.body.appendChild(overlay);
        modal = overlay;
    }

    function _renderGrid() {
        grid.innerHTML = '';
        // L1 — Re-check palette.colors at use time. The initial guard above is fine
        // but if palette is mutated to null/empty by another code path between the
        // check and filter, we'd throw. Cheap defense.
        if (!palette || !Array.isArray(palette.colors) || palette.colors.length === 0) return;

        var filtered = palette.colors.filter(function(c) {
            if (activeFamily !== 'All' && c.family !== activeFamily) return false;
            if (searchQuery) {
                var q = searchQuery;
                return (c.name.toLowerCase().indexOf(q) !== -1) ||
                       (c.catalog.indexOf(q) !== -1);
            }
            return true;
        });

        var frag = document.createDocumentFragment();
        filtered.forEach(function(color) {
            var cell = document.createElement('div');
            cell.className = 'tcp-cell';
            cell.addEventListener('click', function() {
                if (onSelectCallback) {
                    onSelectCallback(currentRunIndex, {
                        hex: color.hex,
                        name: color.name,
                        catalog: color.catalog
                    });
                }
                close();
            });

            var swatch = document.createElement('span');
            swatch.className = 'tcp-swatch';
            swatch.style.background = color.hex;

            var info = document.createElement('span');
            info.className = 'tcp-info';
            var nameSpan = document.createElement('span');
            nameSpan.className = 'tcp-name';
            nameSpan.textContent = color.name;
            var catSpan = document.createElement('span');
            catSpan.className = 'tcp-catalog';
            catSpan.textContent = '#' + color.catalog;
            info.appendChild(nameSpan);
            info.appendChild(catSpan);

            cell.appendChild(swatch);
            cell.appendChild(info);
            frag.appendChild(cell);
        });

        grid.appendChild(frag);
    }

    return {
        init: init,
        open: open,
        close: close
    };
})();
