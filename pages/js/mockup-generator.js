(function() {
    'use strict';

    const API_BASE = 'https://inksoft-transform-8a3dc4e38097.herokuapp.com';

    // File state
    const files = { dst: null, emb: null, pdf: null };
    let lastMockupData = null;
    let lastComparisonHasMismatches = false;

    // Interactive color swap state
    let currentThreads = [];
    let originalThreads = [];
    let hasUnsavedChanges = false;
    let rerenderTimer = null;

    // DOM elements
    const dstZone = document.getElementById('dstZone');
    const embZone = document.getElementById('embZone');
    const pdfZone = document.getElementById('pdfZone');
    const dstInput = document.getElementById('dstInput');
    const embInput = document.getElementById('embInput');
    const pdfInput = document.getElementById('pdfInput');
    const generateBtn = document.getElementById('generateBtn');
    const compareBtn = document.getElementById('compareBtn');
    const fixEmbBtn = document.getElementById('fixEmbBtn');
    const resetBtn = document.getElementById('resetBtn');
    const sourceToggle = document.getElementById('sourceToggle');
    const colorSource = document.getElementById('colorSource');
    const resultsSection = document.getElementById('resultsSection');
    const comparisonPanel = document.getElementById('comparisonPanel');
    const errorBanner = document.getElementById('errorBanner');
    const spinner = document.getElementById('spinner');
    const spinnerText = document.getElementById('spinnerText');
    const downloadEmbBtn = document.getElementById('downloadEmbBtn');
    const resetColorsBtn = document.getElementById('resetColorsBtn');

    // Init color picker
    if (typeof ThreadColorPicker !== 'undefined') {
        ThreadColorPicker.init();
    }

    // Upload zone setup
    function setupUploadZone(zone, input, type, extensions) {
        zone.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => {
            if (e.target.files.length) {
                setFile(type, e.target.files[0], zone, extensions);
            }
        });
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                setFile(type, e.dataTransfer.files[0], zone, extensions);
            }
        });
    }

    function setFile(type, file, zone, extensions) {
        const ext = file.name.toLowerCase().split('.').pop();
        if (!extensions.includes(ext)) {
            showError('Invalid file type. Expected: ' + extensions.join(', '));
            return;
        }
        files[type] = file;
        zone.classList.add('has-file');
        const nameEl = document.getElementById(type + 'FileName');
        if (nameEl) {
            nameEl.textContent = file.name;
        }
        updateButtons();
        hideError();
    }

    function updateButtons() {
        const hasDst = !!files.dst;
        const hasEmb = !!files.emb;
        const hasPdf = !!files.pdf;

        generateBtn.disabled = !hasDst || (!hasEmb && !hasPdf);
        compareBtn.disabled = !hasEmb || !hasPdf;

        // Show color source toggle when both EMB and PDF are loaded
        sourceToggle.style.display = (hasEmb && hasPdf) ? 'flex' : 'none';

        // Show Fix EMB button when both EMB + PDF loaded AND mismatches exist
        if (hasEmb && hasPdf && lastComparisonHasMismatches) {
            fixEmbBtn.style.display = '';
            fixEmbBtn.disabled = false;
        } else {
            fixEmbBtn.style.display = 'none';
            fixEmbBtn.disabled = true;
        }

        // Download EMB button — enabled when EMB loaded and threads modified
        if (downloadEmbBtn) {
            downloadEmbBtn.disabled = !hasEmb || !hasUnsavedChanges;
            downloadEmbBtn.style.display = (hasEmb && currentThreads.length) ? '' : 'none';
        }

        // Reset colors button
        if (resetColorsBtn) {
            resetColorsBtn.style.display = hasUnsavedChanges ? '' : 'none';
        }
    }

    // Generate Mockup
    async function generateMockup() {
        if (!files.dst || (!files.emb && !files.pdf)) return;

        showSpinner('Generating colored mockup...');
        hideError();

        const formData = new FormData();
        formData.append('dstFile', files.dst);
        if (files.emb) formData.append('embFile', files.emb);
        if (files.pdf) formData.append('pdfFile', files.pdf);
        formData.append('source', colorSource.value);
        formData.append('format', 'png');

        try {
            const response = await fetch(API_BASE + '/api/embroidery/generate-mockup', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Server error');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Unknown error');
            }

            lastMockupData = data;
            displayMockup(data);
            displayThreads(data.thread_sequence);
            displayDesignInfo(data);

            // Store threads for interactive editing
            originalThreads = JSON.parse(JSON.stringify(data.thread_sequence));
            currentThreads = JSON.parse(JSON.stringify(data.thread_sequence));
            hasUnsavedChanges = false;

            if (data.comparison) {
                lastComparisonHasMismatches = !data.comparison.match;
                displayComparison(data.comparison, data.thread_sequence,
                    data.comparison.emb_threads || data.thread_sequence);
            }
            updateButtons();

            // Fire-and-forget element identification (non-blocking)
            if (data.image_base64 && data.thread_sequence) {
                identifyElements(data.image_base64, data.thread_sequence);
            }

        } catch (err) {
            showError('Failed to generate mockup: ' + err.message);
            console.error('Mockup generation error:', err);
        } finally {
            hideSpinner();
        }
    }

    // Compare threads only
    async function compareThreads() {
        if (!files.emb || !files.pdf) return;

        showSpinner('Comparing thread sequences...');
        hideError();

        const formData = new FormData();
        formData.append('embFile', files.emb);
        formData.append('pdfFile', files.pdf);

        try {
            const response = await fetch(API_BASE + '/api/embroidery/compare', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Server error');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Unknown error');
            }

            lastComparisonHasMismatches = !data.match;
            displayComparison(data, data.pdf_threads, data.emb_threads);
            updateButtons();

        } catch (err) {
            showError('Failed to compare threads: ' + err.message);
            console.error('Compare error:', err);
        } finally {
            hideSpinner();
        }
    }

    // Fix EMB Colors — recolor EMB to match PDF
    async function fixEmbColors() {
        if (!files.emb || !files.pdf) return;

        showSpinner('Recoloring EMB to match PDF...');
        hideError();

        const formData = new FormData();
        formData.append('embFile', files.emb);
        formData.append('pdfFile', files.pdf);

        try {
            const response = await fetch(API_BASE + '/api/embroidery/recolor-emb', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Server error');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Unknown error');
            }

            downloadBinaryBase64(data.filename || 'recolored.emb', data.emb_base64);

            var msg = 'EMB recolored: ' + data.modified + ' thread(s) updated, ' + data.unchanged + ' unchanged.';
            if (data.changes && data.changes.length) {
                msg += ' Changes: ' + data.changes.map(function(c) {
                    return 'Run ' + c.run + ': ' + c.from + ' \u2192 ' + c.to;
                }).join(', ');
            }
            showSuccess(msg);

        } catch (err) {
            showError('Failed to fix EMB colors: ' + err.message);
            console.error('Fix EMB error:', err);
        } finally {
            hideSpinner();
        }
    }

    // Interactive color change callback
    function onColorSelected(runIndex, newColor) {
        if (runIndex < 0 || runIndex >= currentThreads.length) return;

        currentThreads[runIndex].hex = newColor.hex;
        currentThreads[runIndex].name = newColor.name;
        currentThreads[runIndex].catalog = newColor.catalog;
        hasUnsavedChanges = true;

        // Update DOM immediately
        var list = document.getElementById('threadList');
        var rows = list.querySelectorAll('.thread-row');
        if (rows[runIndex]) {
            var swatch = rows[runIndex].querySelector('.thread-swatch');
            var nameEl = rows[runIndex].querySelector('.thread-name');
            var catEl = rows[runIndex].querySelector('.thread-catalog');
            if (swatch) swatch.style.background = newColor.hex;
            if (nameEl) nameEl.textContent = newColor.name;
            if (catEl) catEl.textContent = newColor.catalog;

            // Mark as modified
            var orig = originalThreads[runIndex];
            if (orig && orig.catalog !== newColor.catalog) {
                rows[runIndex].classList.add('modified');
            } else {
                rows[runIndex].classList.remove('modified');
            }
        }

        updateButtons();

        // Debounced re-render
        if (files.dst) {
            clearTimeout(rerenderTimer);
            document.getElementById('mockupContainer').classList.add('pending');
            rerenderTimer = setTimeout(rerenderMockup, 600);
        }
    }

    // Re-render mockup with current thread colors
    async function rerenderMockup() {
        if (!files.dst || !currentThreads.length) return;

        var mockupContainer = document.getElementById('mockupContainer');

        try {
            var formData = new FormData();
            formData.append('dstFile', files.dst);
            formData.append('threads', JSON.stringify(currentThreads));
            formData.append('format', 'png');

            var response = await fetch(API_BASE + '/api/embroidery/rerender-mockup', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                var err = await response.json();
                throw new Error(err.error || 'Server error');
            }

            var data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Unknown error');
            }

            document.getElementById('mockupImage').src = 'data:image/png;base64,' + data.image_base64;
            lastMockupData = data;

        } catch (err) {
            showError('Re-render failed: ' + err.message);
            console.error('Re-render error:', err);
        } finally {
            mockupContainer.classList.remove('pending');
        }
    }

    // Download modified EMB with current thread selections
    async function downloadModifiedEmb() {
        if (!files.emb || !currentThreads.length) return;

        showSpinner('Building modified EMB...');
        hideError();

        try {
            var formData = new FormData();
            formData.append('embFile', files.emb);
            formData.append('threads', JSON.stringify(currentThreads));

            var response = await fetch(API_BASE + '/api/embroidery/recolor-emb', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                var err = await response.json();
                throw new Error(err.error || 'Server error');
            }

            var data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Unknown error');
            }

            downloadBinaryBase64(data.filename || 'modified.emb', data.emb_base64);
            showSuccess('Modified EMB downloaded with ' + data.modified + ' color change(s).');

        } catch (err) {
            showError('EMB download failed: ' + err.message);
            console.error('Download EMB error:', err);
        } finally {
            hideSpinner();
        }
    }

    // Reset colors to original
    function resetColors() {
        if (!originalThreads.length) return;
        currentThreads = JSON.parse(JSON.stringify(originalThreads));
        hasUnsavedChanges = false;
        displayThreads(currentThreads);
        updateButtons();

        if (files.dst) {
            document.getElementById('mockupContainer').classList.add('pending');
            rerenderMockup();
        }
    }

    // Display functions
    function displayMockup(data) {
        const img = document.getElementById('mockupImage');
        img.src = 'data:image/png;base64,' + data.image_base64;

        document.getElementById('statStitches').textContent = (data.stitch_count || 0).toLocaleString();
        document.getElementById('statColors').textContent = (data.color_changes || 0) + 1;
        document.getElementById('statSize').textContent =
            (data.width_mm || 0) + 'mm x ' + (data.height_mm || 0) + 'mm';
        var sourceLabel = (data.color_source || 'emb').toUpperCase() + ' file';
        if (data.pdf_confidence === 'vision') {
            sourceLabel += ' (AI-extracted)';
        }
        document.getElementById('statSource').textContent = sourceLabel;

        document.getElementById('downloadPngBtn').disabled = false;
        document.getElementById('downloadSvgBtn').disabled = false;

        resultsSection.classList.add('visible');
    }

    function displayThreads(threads) {
        const list = document.getElementById('threadList');
        list.innerHTML = '';
        var hasPicker = (typeof ThreadColorPicker !== 'undefined');

        threads.forEach(function(t, idx) {
            var row = document.createElement('div');
            row.className = 'thread-row' + (hasPicker ? ' clickable' : '');

            // Check if modified from original
            if (originalThreads[idx] && originalThreads[idx].catalog !== t.catalog) {
                row.classList.add('modified');
            }

            var runSpan = document.createElement('span');
            runSpan.className = 'thread-run';
            runSpan.textContent = t.run || (idx + 1);

            var swatch = document.createElement('div');
            swatch.className = 'thread-swatch';
            swatch.style.background = t.hex || '#888';

            var nameCell = document.createElement('div');
            nameCell.className = 'thread-name';
            nameCell.textContent = t.name || '';

            var elemSpan = document.createElement('span');
            elemSpan.className = 'thread-element';
            elemSpan.textContent = t.element || '';

            var catSpan = document.createElement('span');
            catSpan.className = 'thread-catalog';
            catSpan.textContent = t.catalog || '';

            row.appendChild(runSpan);
            row.appendChild(swatch);
            row.appendChild(nameCell);
            row.appendChild(elemSpan);
            row.appendChild(catSpan);

            if (hasPicker) {
                var editIcon = document.createElement('span');
                editIcon.className = 'thread-edit';
                editIcon.innerHTML = '<i class="fas fa-pen"></i>';
                row.appendChild(editIcon);

                row.addEventListener('click', function() {
                    ThreadColorPicker.open(idx, currentThreads[idx] || t, onColorSelected);
                });
            }

            list.appendChild(row);
        });

        document.getElementById('threadCount').textContent = threads.length + ' runs';
    }

    // Element identification via vision (non-blocking)
    async function identifyElements(mockupBase64, threads) {
        if (!files.dst) return;
        try {
            var formData = new FormData();
            formData.append('dstFile', files.dst);
            formData.append('mockup_base64', mockupBase64);
            formData.append('threads', JSON.stringify(threads));

            var response = await fetch(API_BASE + '/api/embroidery/identify-elements', {
                method: 'POST',
                body: formData
            });
            var data = await response.json();
            if (data.success && data.elements) {
                applyElementLabels(data.elements);
            }
        } catch (err) {
            console.warn('Element identification failed:', err);
        }
    }

    function applyElementLabels(elements) {
        var rows = document.querySelectorAll('#threadList .thread-row');
        elements.forEach(function(label, idx) {
            if (!label || !rows[idx]) return;

            // Store in currentThreads for persistence across re-renders
            if (currentThreads[idx]) {
                currentThreads[idx].element = label;
            }
            if (originalThreads[idx]) {
                originalThreads[idx].element = label;
            }

            // Update the element column
            var elemSpan = rows[idx].querySelector('.thread-element');
            if (elemSpan) {
                elemSpan.textContent = label;
            }
        });
    }

    function displayDesignInfo(data) {
        const info = document.getElementById('designInfo');
        const num = data.design_number || '';
        const name = data.design_name || '';
        const cust = data.customer || '';

        if (num || name || cust) {
            document.getElementById('infoDesignNum').textContent = num;
            document.getElementById('infoDesignName').textContent = name;
            document.getElementById('infoCustomer').textContent = cust;
            info.style.display = 'flex';
        }
    }

    function displayComparison(comparison, pdfThreads, embThreads) {
        const panel = comparisonPanel;
        const body = document.getElementById('comparisonBody');
        const badge = document.getElementById('matchBadge');

        body.innerHTML = '';

        const total = comparison.total_runs || 0;
        const matched = comparison.matched_runs || 0;
        const isMatch = comparison.match;

        badge.className = 'match-badge ' + (isMatch ? 'match' : 'mismatch');
        var badgeText = matched + '/' + total + ' matched' + (isMatch ? '' : ' \u2014 mismatches found');
        if (comparison.pdf_confidence === 'vision') {
            badgeText += ' (AI-extracted)';
        }
        badge.textContent = badgeText;

        const mismatchRuns = {};
        (comparison.mismatches || []).forEach(function(m) {
            mismatchRuns[m.run] = m;
        });

        const maxRuns = Math.max(
            embThreads ? embThreads.length : 0,
            pdfThreads ? pdfThreads.length : 0
        );

        for (var i = 0; i < maxRuns; i++) {
            var emb = embThreads && embThreads[i] ? embThreads[i] : null;
            var pdf = pdfThreads && pdfThreads[i] ? pdfThreads[i] : null;
            var run = i + 1;
            var isMismatch = !!mismatchRuns[run];

            var tr = document.createElement('tr');
            if (isMismatch) tr.className = 'mismatch-row';

            var embSwatch = emb ? '<div class="thread-swatch" style="background:' + escapeAttr(emb.hex) + ';display:inline-block;vertical-align:middle;width:14px;height:14px;margin-right:6px"></div>' : '';
            var pdfSwatch = pdf ? '<div class="thread-swatch" style="background:' + escapeAttr(pdf.hex) + ';display:inline-block;vertical-align:middle;width:14px;height:14px;margin-right:6px"></div>' : '';

            tr.innerHTML =
                '<td>' + run + '</td>' +
                '<td>' + embSwatch + escapeHtml(emb ? emb.name : '-') + '</td>' +
                '<td style="font-family:monospace;color:var(--text-dim)">' + escapeHtml(emb ? emb.catalog : '-') + '</td>' +
                '<td>' + pdfSwatch + escapeHtml(pdf ? pdf.name : '-') + '</td>' +
                '<td style="font-family:monospace;color:var(--text-dim)">' + escapeHtml(pdf ? pdf.catalog : '-') + '</td>' +
                '<td><span class="match-icon ' + (isMismatch ? 'no' : 'yes') + '">' +
                    '<i class="fas fa-' + (isMismatch ? 'times-circle' : 'check-circle') + '"></i>' +
                '</span></td>';

            body.appendChild(tr);
        }

        panel.classList.add('visible');
    }

    // Download handlers
    function downloadPng() {
        if (!lastMockupData || !lastMockupData.image_base64) return;
        downloadBase64('mockup.png', lastMockupData.image_base64, 'image/png');
    }

    async function downloadSvg() {
        if (!files.dst) return;

        showSpinner('Generating SVG...');
        var formData = new FormData();
        formData.append('dstFile', files.dst);
        if (currentThreads.length) {
            formData.append('threads', JSON.stringify(currentThreads));
            formData.append('format', 'svg');
            try {
                var response = await fetch(API_BASE + '/api/embroidery/rerender-mockup', {
                    method: 'POST',
                    body: formData
                });
                var data = await response.json();
                if (data.success) {
                    downloadBase64('mockup.svg', data.image_base64, 'image/svg+xml');
                }
            } catch (err) {
                showError('SVG download failed: ' + err.message);
            } finally {
                hideSpinner();
            }
        } else {
            if (files.emb) formData.append('embFile', files.emb);
            if (files.pdf) formData.append('pdfFile', files.pdf);
            formData.append('source', colorSource.value);
            formData.append('format', 'svg');
            try {
                var response2 = await fetch(API_BASE + '/api/embroidery/generate-mockup', {
                    method: 'POST',
                    body: formData
                });
                var data2 = await response2.json();
                if (data2.success) {
                    downloadBase64('mockup.svg', data2.image_base64, 'image/svg+xml');
                }
            } catch (err2) {
                showError('SVG download failed: ' + err2.message);
            } finally {
                hideSpinner();
            }
        }
    }

    function downloadBase64(filename, base64Data, mimeType) {
        var link = document.createElement('a');
        link.href = 'data:' + mimeType + ';base64,' + base64Data;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function downloadBinaryBase64(filename, base64Data) {
        var bytes = atob(base64Data);
        var arr = new Uint8Array(bytes.length);
        for (var i = 0; i < bytes.length; i++) {
            arr[i] = bytes.charCodeAt(i);
        }
        var blob = new Blob([arr], { type: 'application/octet-stream' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    // Reset
    function resetAll() {
        files.dst = null;
        files.emb = null;
        files.pdf = null;
        lastMockupData = null;
        lastComparisonHasMismatches = false;
        currentThreads = [];
        originalThreads = [];
        hasUnsavedChanges = false;

        [dstZone, embZone, pdfZone].forEach(function(z) { z.classList.remove('has-file'); });
        ['dstFileName', 'embFileName', 'pdfFileName'].forEach(function(id) {
            document.getElementById(id).textContent = '';
        });
        [dstInput, embInput, pdfInput].forEach(function(input) { input.value = ''; });

        resultsSection.classList.remove('visible');
        comparisonPanel.classList.remove('visible');
        document.getElementById('designInfo').style.display = 'none';
        document.getElementById('downloadPngBtn').disabled = true;
        document.getElementById('downloadSvgBtn').disabled = true;

        hideError();
        updateButtons();
    }

    // Utilities
    function showError(msg) {
        errorBanner.textContent = msg;
        errorBanner.className = 'error-banner visible';
    }

    function showSuccess(msg) {
        errorBanner.textContent = msg;
        errorBanner.className = 'error-banner visible success';
    }

    function hideError() {
        errorBanner.className = 'error-banner';
    }

    function showSpinner(text) {
        spinnerText.textContent = text || 'Processing...';
        spinner.classList.add('visible');
    }

    function hideSpinner() {
        spinner.classList.remove('visible');
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
        if (!str) return '';
        return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Event listeners
    setupUploadZone(dstZone, dstInput, 'dst', ['dst']);
    setupUploadZone(embZone, embInput, 'emb', ['emb']);
    setupUploadZone(pdfZone, pdfInput, 'pdf', ['pdf']);

    generateBtn.addEventListener('click', generateMockup);
    compareBtn.addEventListener('click', compareThreads);
    fixEmbBtn.addEventListener('click', fixEmbColors);
    resetBtn.addEventListener('click', resetAll);
    document.getElementById('downloadPngBtn').addEventListener('click', downloadPng);
    document.getElementById('downloadSvgBtn').addEventListener('click', downloadSvg);
    if (downloadEmbBtn) downloadEmbBtn.addEventListener('click', downloadModifiedEmb);
    if (resetColorsBtn) resetColorsBtn.addEventListener('click', resetColors);

})();
