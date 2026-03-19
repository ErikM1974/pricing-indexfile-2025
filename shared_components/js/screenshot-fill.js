/**
 * Screenshot Fill — Paste ShopWorks screenshots to auto-fill art request form
 * Supports Customer tab, Design tab, and Line Items tab screenshots (additive)
 *
 * Usage: window.ScreenshotFill.open() — opens the paste modal
 * Depends on: APP_CONFIG.API.BASE_URL (or fallback)
 */
(function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // ── Field mapping: extracted key → Caspio InsertRecord field name ──
    var FIELD_MAP = {
        companyName: 'InsertRecordCompanyName',
        customerNumber: 'InsertRecordShopwork_customer_number',
        orderNumber: 'InsertRecordOrder_Num_SW',
        contactFirstName: 'InsertRecordFirst_name',
        contactLastName: 'InsertRecordLast_name',
        salesPerson: 'InsertRecordSales_Rep',
        designNumber: 'InsertRecordDesign_Num_SW'
    };

    // Garment row field names (rows 1-4)
    var GARMENT_STYLE_FIELDS = [
        'InsertRecordGarmentStyle',
        'InsertRecordGarm_Style_2',
        'InsertRecordGarm_Style_3',
        'InsertRecordGarm_Style_4'
    ];

    var GARMENT_COLOR_FIELDS = [
        'InsertRecordGarmentColor',
        'InsertRecordGarm_Color_2',
        'InsertRecordGarm_Color_3',
        'InsertRecordGarm_Color_4'
    ];

    // Track accumulated data across multiple pastes
    var accumulatedData = {};
    var modal = null;
    var pasteCount = 0;

    // ── Escape HTML for XSS protection ──
    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Create Modal ──
    function createModal() {
        if (modal) return modal;

        var overlay = document.createElement('div');
        overlay.id = 'screenshot-fill-overlay';
        overlay.innerHTML = [
            '<div class="ssf-modal">',
            '  <div class="ssf-header">',
            '    <h3>📷 Fill from ShopWorks Screenshot</h3>',
            '    <button class="ssf-close" title="Close">&times;</button>',
            '  </div>',
            '  <div class="ssf-body">',
            '    <div class="ssf-tabs-hint">',
            '      Paste screenshots from any ShopWorks tab — each one adds more fields:',
            '      <div class="ssf-tab-pills">',
            '        <span class="ssf-pill" data-tab="customer">👤 Customer</span>',
            '        <span class="ssf-pill" data-tab="design">🎨 Design</span>',
            '        <span class="ssf-pill" data-tab="lineitems">📦 Line Items</span>',
            '      </div>',
            '    </div>',
            '    <div class="ssf-drop-zone" id="ssf-drop-zone">',
            '      <div class="ssf-drop-icon">📋</div>',
            '      <div class="ssf-drop-text">Paste screenshot here<br><small>Ctrl+V or drag & drop</small></div>',
            '    </div>',
            '    <div class="ssf-preview-img" id="ssf-preview-img" style="display:none;"></div>',
            '    <div class="ssf-status" id="ssf-status" style="display:none;"></div>',
            '    <div class="ssf-fields" id="ssf-fields" style="display:none;"></div>',
            '    <div class="ssf-actions" id="ssf-actions" style="display:none;">',
            '      <button class="ssf-btn ssf-btn-fill" id="ssf-fill-btn">✅ Fill Form</button>',
            '      <button class="ssf-btn ssf-btn-another" id="ssf-another-btn">📋 Paste Another Tab</button>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n');

        // Close button
        overlay.querySelector('.ssf-close').addEventListener('click', closeModal);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeModal();
        });

        // Fill button
        overlay.querySelector('#ssf-fill-btn').addEventListener('click', function () {
            applyToForm(accumulatedData);
            closeModal();
        });

        // Paste Another button
        overlay.querySelector('#ssf-another-btn').addEventListener('click', resetForNextPaste);

        // Drop zone events
        var dropZone = overlay.querySelector('#ssf-drop-zone');
        dropZone.addEventListener('dragover', function (e) {
            e.preventDefault();
            dropZone.classList.add('ssf-dragover');
        });
        dropZone.addEventListener('dragleave', function () {
            dropZone.classList.remove('ssf-dragover');
        });
        dropZone.addEventListener('drop', function (e) {
            e.preventDefault();
            dropZone.classList.remove('ssf-dragover');
            var files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                processImageFile(files[0]);
            }
        });

        // Global paste handler (only when modal is open)
        document.addEventListener('paste', handlePaste);

        document.body.appendChild(overlay);
        modal = overlay;
        return overlay;
    }

    function handlePaste(e) {
        if (!modal || modal.style.display === 'none') return;

        var items = e.clipboardData && e.clipboardData.items;
        if (!items) return;

        for (var i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                var blob = items[i].getAsFile();
                processImageFile(blob);
                return;
            }
        }
    }

    function processImageFile(file) {
        var reader = new FileReader();
        reader.onload = function (e) {
            var dataUri = e.target.result;
            showImagePreview(dataUri);
            extractFromImage(dataUri);
        };
        reader.readAsDataURL(file);
    }

    function showImagePreview(dataUri) {
        var previewEl = document.getElementById('ssf-preview-img');
        previewEl.innerHTML = '<img src="' + dataUri + '" alt="Screenshot preview">';
        previewEl.style.display = 'block';

        // Hide drop zone
        document.getElementById('ssf-drop-zone').style.display = 'none';
    }

    function showStatus(message, type) {
        var statusEl = document.getElementById('ssf-status');
        statusEl.className = 'ssf-status ssf-status-' + (type || 'info');
        statusEl.textContent = message;
        statusEl.style.display = 'block';
    }

    // ── API Call ──
    function extractFromImage(dataUri) {
        showStatus('Analyzing screenshot...', 'loading');

        fetch(API_BASE + '/api/vision/extract-shopworks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: dataUri })
        })
            .then(function (resp) {
                if (!resp.ok) throw new Error('API returned ' + resp.status);
                return resp.json();
            })
            .then(function (result) {
                if (!result.success || !result.data) {
                    throw new Error(result.error || 'No data returned');
                }
                handleExtractionResult(result.data);
            })
            .catch(function (err) {
                showStatus('❌ ' + err.message, 'error');
                console.error('[ScreenshotFill] Extraction failed:', err);
            });
    }

    function handleExtractionResult(data) {
        // Merge new data into accumulated (additive — only overwrite non-null)
        var newFieldCount = 0;

        Object.keys(data).forEach(function (key) {
            if (key === 'tab' || key === 'garments') return;
            if (data[key] != null && data[key] !== '') {
                accumulatedData[key] = data[key];
                newFieldCount++;
            }
        });

        // Merge garments additively
        if (data.garments && data.garments.length > 0) {
            if (!accumulatedData.garments) accumulatedData.garments = [];
            // Add new garments that aren't already in the list (by part number)
            data.garments.forEach(function (g) {
                var exists = accumulatedData.garments.some(function (existing) {
                    return existing.partNumber === g.partNumber && existing.color === g.color;
                });
                if (!exists) {
                    accumulatedData.garments.push(g);
                    newFieldCount++;
                }
            });
        }

        pasteCount++;

        // Update tab pill to show checkmark
        var tabName = data.tab || 'unknown';
        var pill = modal.querySelector('.ssf-pill[data-tab="' + tabName + '"]');
        if (pill && !pill.classList.contains('ssf-pill-done')) {
            pill.classList.add('ssf-pill-done');
            pill.textContent = '✅ ' + pill.textContent.replace(/^[^\s]+\s/, '');
        }

        showStatus('Found ' + newFieldCount + ' fields from ' + tabName + ' tab', 'success');
        renderFieldPreview();

        // Show action buttons
        document.getElementById('ssf-actions').style.display = 'flex';
    }

    function renderFieldPreview() {
        var fieldsEl = document.getElementById('ssf-fields');
        var html = '<div class="ssf-field-list">';

        // Simple fields
        var labels = {
            companyName: 'Company',
            customerNumber: 'Customer #',
            orderNumber: 'Order #',
            contactFirstName: 'First Name',
            contactLastName: 'Last Name',
            contactEmail: 'Email',
            contactPhone: 'Phone',
            salesPerson: 'Sales Rep',
            designNumber: 'Design #',
            designName: 'Design Name',
            orderType: 'Order Type',
            locations: 'Locations',
            dateOrderPlaced: 'Order Date',
            reqShipDate: 'Ship Date'
        };

        Object.keys(labels).forEach(function (key) {
            if (accumulatedData[key] != null && accumulatedData[key] !== '') {
                html += '<div class="ssf-field-row">'
                    + '<span class="ssf-field-label">' + labels[key] + ':</span>'
                    + '<span class="ssf-field-value">' + escapeHtml(String(accumulatedData[key])) + '</span>'
                    + '</div>';
            }
        });

        // Garments
        if (accumulatedData.garments && accumulatedData.garments.length > 0) {
            html += '<div class="ssf-field-section">Garments</div>';
            accumulatedData.garments.forEach(function (g, i) {
                html += '<div class="ssf-field-row">'
                    + '<span class="ssf-field-label">Row ' + (i + 1) + ':</span>'
                    + '<span class="ssf-field-value">' + escapeHtml(g.partNumber) + ' — ' + escapeHtml(g.color) + '</span>'
                    + '</div>';
            });
        }

        html += '</div>';
        fieldsEl.innerHTML = html;
        fieldsEl.style.display = 'block';
    }

    function resetForNextPaste() {
        // Keep accumulated data, reset UI for next paste
        document.getElementById('ssf-drop-zone').style.display = '';
        document.getElementById('ssf-preview-img').style.display = 'none';
        document.getElementById('ssf-preview-img').innerHTML = '';
        document.getElementById('ssf-status').style.display = 'none';
        document.getElementById('ssf-actions').style.display = 'none';
        // Keep field preview visible so user sees accumulated fields
    }

    // ── Apply to Caspio Form ──
    function applyToForm(data) {
        var filledCount = 0;

        // Simple text fields
        Object.keys(FIELD_MAP).forEach(function (key) {
            if (data[key] != null && data[key] !== '') {
                var input = document.querySelector('[name="' + FIELD_MAP[key] + '"]');
                if (input) {
                    input.value = data[key];
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    filledCount++;
                }
            }
        });

        // Contact email (find by label since Caspio field name may vary)
        if (data.contactEmail) {
            var emailInput = findInputByLabel("Contact's Email") || findInputByLabel("Contact Email");
            if (emailInput) {
                emailInput.value = data.contactEmail;
                emailInput.dispatchEvent(new Event('change', { bubbles: true }));
                filledCount++;
            }
        }

        // Trigger Order # blur validation
        if (data.orderNumber) {
            var orderInput = document.querySelector('[name="InsertRecordOrder_Num_SW"]');
            if (orderInput) {
                setTimeout(function () {
                    orderInput.dispatchEvent(new Event('blur', { bubbles: true }));
                }, 300);
            }
        }

        // Garment rows (up to 4)
        if (data.garments && data.garments.length > 0) {
            data.garments.slice(0, 4).forEach(function (g, i) {
                var styleInput = document.querySelector('[name="' + GARMENT_STYLE_FIELDS[i] + '"]');
                if (styleInput) {
                    styleInput.value = g.partNumber;
                    styleInput.dispatchEvent(new Event('change', { bubbles: true }));
                    styleInput.dispatchEvent(new Event('blur', { bubbles: true }));
                    filledCount++;

                    // Wait for Caspio cascade to populate color dropdown, then set color
                    if (g.color) {
                        scheduleColorFill(GARMENT_COLOR_FIELDS[i], g.color);
                    }
                }
            });
        }

        // Show toast
        showToast('Filled ' + filledCount + ' fields from screenshot');
    }

    /**
     * Wait for Caspio cascade to populate the color dropdown, then set the value.
     * Retries every 500ms for up to 5 seconds.
     */
    function scheduleColorFill(colorFieldName, colorValue) {
        var attempts = 0;
        var maxAttempts = 10;

        var interval = setInterval(function () {
            attempts++;
            var colorEl = document.querySelector('[name="' + colorFieldName + '"]');

            if (colorEl && colorEl.tagName === 'SELECT' && colorEl.options.length > 1) {
                // Try exact match first, then partial match
                var matched = false;
                for (var j = 0; j < colorEl.options.length; j++) {
                    var optText = colorEl.options[j].text.toLowerCase();
                    var target = colorValue.toLowerCase();
                    if (optText === target || optText.indexOf(target) !== -1 || target.indexOf(optText) !== -1) {
                        colorEl.value = colorEl.options[j].value;
                        colorEl.dispatchEvent(new Event('change', { bubbles: true }));
                        matched = true;
                        break;
                    }
                }
                if (matched) clearInterval(interval);
            }

            if (attempts >= maxAttempts) {
                clearInterval(interval);
                // If select never populated, try setting as text (custom product mode)
                if (colorEl && colorEl.tagName === 'INPUT') {
                    colorEl.value = colorValue;
                    colorEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }, 500);
    }

    /**
     * Find an input by its label text (for fields where Caspio name is unpredictable)
     */
    function findInputByLabel(labelText) {
        var labels = document.querySelectorAll('#submit-tab label');
        for (var i = 0; i < labels.length; i++) {
            if (labels[i].textContent.trim().replace(/\s*\*$/, '') === labelText) {
                var cell = labels[i].closest('.cbFormLabelCell');
                if (cell) {
                    var fieldCell = cell.nextElementSibling;
                    if (fieldCell) {
                        return fieldCell.querySelector('input, select, textarea');
                    }
                }
            }
        }
        return null;
    }

    function showToast(message) {
        var toast = document.createElement('div');
        toast.className = 'ssf-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function () { toast.classList.add('ssf-toast-show'); }, 10);
        setTimeout(function () {
            toast.classList.remove('ssf-toast-show');
            setTimeout(function () { toast.remove(); }, 300);
        }, 3000);
    }

    // ── Public API ──
    function openModal() {
        var m = createModal();
        // Reset state
        accumulatedData = {};
        pasteCount = 0;
        resetForNextPaste();
        // Reset tab pills
        m.querySelectorAll('.ssf-pill').forEach(function (pill) {
            pill.classList.remove('ssf-pill-done');
        });
        var pills = m.querySelectorAll('.ssf-pill');
        if (pills[0]) pills[0].textContent = '👤 Customer';
        if (pills[1]) pills[1].textContent = '🎨 Design';
        if (pills[2]) pills[2].textContent = '📦 Line Items';
        document.getElementById('ssf-fields').style.display = 'none';
        document.getElementById('ssf-fields').innerHTML = '';

        m.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    window.ScreenshotFill = {
        open: openModal,
        close: closeModal
    };

})();
