/**
 * Screenshot Fill — Paste ShopWorks screenshots OR text exports to auto-fill art request form
 * Supports Customer tab, Design tab, and Line Items tab screenshots (additive)
 * Also supports ShopWorks text export (instant, no API call)
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
        contactEmail: 'InsertRecordEmail_Contact',
        designNumber: 'InsertRecordDesign_Num_SW'
    };

    // ── Order Type mapping: ShopWorks name → Caspio multi-select checkbox values ──
    var ORDER_TYPE_MAP = {
        'Digital Printing':                ['DTG'],
        'DTG':                             ['DTG'],
        'Custom Screen Print':             ['Screen Print'],
        'Contract Screen Print':           ['Screen Print'],
        'Screen Print Subcontract':        ['Screen Print'],
        'Sample Screen Print':             ['Screen Print'],
        'Preprint Customized, Screen':     ['Screen Print'],
        'Screen Print Preprint Production': ['Screen Print'],
        'Transfers':                       ['Transfer'],
        'Transfer':                        ['Transfer'],
        'Custom Embroidery':               ['Embroidery'],
        'Contract Embroidery':             ['Embroidery'],
        'College Embroidery':              ['Embroidery'],
        'Subcontract Embroidery':          ['Embroidery'],
        'Preprint Customized, Embroidery': ['Embroidery'],
        'Embroidery Preprint Production':  ['Embroidery'],
        'EMB':                             ['Embroidery'],
        'Laser/Ad Specialties':            ['Laser Engraving', 'ASI', 'Roland Stickers'],
        'Laser/Ad Specialities':           ['Laser Engraving', 'ASI', 'Roland Stickers']
    };

    // ── Art Estimate mapping: GRT part number → dropdown value ──
    var ART_ESTIMATE_MAP = {
        'GRT-25': '25',
        'GRT-50': '50',
        'GRT-75': '75',
        'GRT-100': '100',
        'GRT-150': '150'
    };

    // ── Garment Placement mapping: ShopWorks location code → Caspio dropdown value ──
    var PLACEMENT_MAP = {
        'LC': 'Left Chest',
        'FB': 'Full Back',
        'FF': 'Full Front',
        'CC': 'Full Front',
        'LS': 'Left Sleeve',
        'CB': 'Cap Back',
        'CFC': 'Cap Front Panel',
        'CLP': 'Cap Left Side Panel',
        'CLS': 'Cap Left Side Panel',
        'CRP': 'Cap Right Side Panel',
        'CRS': 'Cap Right Side Panel',
        'BON': 'Other (Specify)',
        'ALC': 'Other (Specify)',
        'ALP': 'Other (Specify)',
        'ARC': 'Other (Specify)',
        'ARP': 'Other (Specify)'
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
    var activeTab = 'screenshot'; // 'screenshot' or 'text'

    // ── Escape HTML for XSS protection ──
    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Business days calculation ──
    function addBusinessDays(date, days) {
        var result = new Date(date);
        var added = 0;
        while (added < days) {
            result.setDate(result.getDate() + 1);
            var dow = result.getDay();
            if (dow !== 0 && dow !== 6) added++;
        }
        return result;
    }

    // ── Create Modal ──
    function createModal() {
        if (modal) return modal;

        var overlay = document.createElement('div');
        overlay.id = 'screenshot-fill-overlay';
        overlay.innerHTML = [
            '<div class="ssf-modal">',
            '  <div class="ssf-header">',
            '    <h3>',
            '      <svg class="ssf-header-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
            '      Paste Order Text',
            '    </h3>',
            '    <button class="ssf-close" title="Close">&times;</button>',
            '  </div>',
            '  <div class="ssf-body">',
            '    <p class="ssf-hint">Paste the ShopWorks order text export below. All customer, order, and garment fields will be extracted instantly.</p>',
            '    <div class="ssf-text-area">',
            '      <textarea id="ssf-text-input" class="ssf-textarea" rows="10" placeholder="Paste ShopWorks order text here...\n\nShopWorks → Print tab → copy the text output"></textarea>',
            '      <button type="button" class="ssf-btn ssf-btn-parse" id="ssf-parse-btn">',
            '        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
            '        Parse & Fill Form',
            '      </button>',
            '    </div>',
            '    <div class="ssf-status" id="ssf-status" style="display:none;"></div>',
            '    <div class="ssf-fields" id="ssf-fields" style="display:none;"></div>',
            '  </div>',
            '</div>'
        ].join('\n');

        // Close button
        overlay.querySelector('.ssf-close').addEventListener('click', closeModal);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeModal();
        });

        // Parse & Fill button — parse text, fill form, close modal
        overlay.querySelector('#ssf-parse-btn').addEventListener('click', function () {
            var textInput = document.getElementById('ssf-text-input');
            if (textInput && textInput.value.trim()) {
                var data = parseShopWorksText(textInput.value);
                // Show brief status, fill form, close
                var count = Object.keys(data).filter(function (k) { return k !== 'tab' && k !== 'garments' && data[k]; }).length;
                if (data.garments) count += data.garments.length;
                showStatus('Extracted ' + count + ' fields', 'success');
                accumulatedData = data;
                setTimeout(function () {
                    applyToForm(data);
                    closeModal();
                }, 400);
            }
        });

        document.body.appendChild(overlay);
        modal = overlay;
        return overlay;
    }

    function switchMode(mode) {
        activeTab = mode;
        if (!modal) return;
        modal.querySelectorAll('.ssf-mode-tab').forEach(function (t) {
            t.classList.toggle('ssf-mode-tab-active', t.getAttribute('data-mode') === mode);
        });
        var screenshotArea = modal.querySelector('.ssf-screenshot-area');
        var textArea = modal.querySelector('.ssf-text-area');
        if (mode === 'screenshot') {
            screenshotArea.style.display = '';
            textArea.style.display = 'none';
        } else {
            screenshotArea.style.display = 'none';
            textArea.style.display = '';
        }
    }

    function handlePaste(e) {
        if (!modal || modal.style.display === 'none') return;

        var items = e.clipboardData && e.clipboardData.items;
        if (!items) return;

        // Check for image first (screenshot mode)
        for (var i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                // Auto-switch to screenshot mode if pasting an image
                if (activeTab !== 'screenshot') switchMode('screenshot');
                var blob = items[i].getAsFile();
                processImageFile(blob);
                return;
            }
        }

        // If in text mode and pasting text, let it go to textarea naturally
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

        // Hide drop zone, show skeleton
        document.getElementById('ssf-drop-zone').style.display = 'none';
    }

    function showSkeleton() {
        document.getElementById('ssf-skeleton').style.display = 'block';
    }

    function hideSkeleton() {
        document.getElementById('ssf-skeleton').style.display = 'none';
    }

    function showStatus(message, type) {
        var statusEl = document.getElementById('ssf-status');
        statusEl.className = 'ssf-status ssf-status-' + (type || 'info');
        statusEl.textContent = message;
        statusEl.style.display = 'block';
    }

    // ── API Call ──
    function extractFromImage(dataUri) {
        showSkeleton();
        document.getElementById('ssf-status').style.display = 'none';

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
                hideSkeleton();
                if (!result.success || !result.data) {
                    throw new Error(result.error || 'No data returned');
                }
                handleExtractionResult(result.data);
            })
            .catch(function (err) {
                hideSkeleton();
                showStatus(err.message, 'error');
                console.error('[ScreenshotFill] Extraction failed:', err);
            });
    }

    // ── ShopWorks Text Export Parser (instant, no API) ──
    function parseShopWorksText(text) {
        var data = { tab: 'text' };
        var lines = text.split('\n');
        var section = '';

        lines.forEach(function (line) {
            // Track sections by *** delimiters
            if (line.indexOf('***') !== -1) {
                section = '';
                return;
            }
            // Section headers (lines without colons that follow ***)
            var trimmed = line.trim();
            if (!trimmed) return;

            if (trimmed === 'Your Company Information') { section = 'customer'; return; }
            if (trimmed === 'Order Information') { section = 'order'; return; }
            if (trimmed === 'Design Information') { section = 'design'; return; }
            if (trimmed === 'Items Purchased') { section = 'items'; return; }
            if (trimmed === 'Order Summary') { section = 'summary'; return; }
            if (trimmed.indexOf('Item ') === 0 && trimmed.indexOf(' of ') !== -1) return; // "Item 1 of 3"

            var match = trimmed.match(/^([^:]+):(.*)$/);
            if (!match) return;
            var key = match[1].trim();
            var val = match[2].trim();
            if (!val) return;

            // Map by key + section context
            if (key === 'Company' && section === 'customer') {
                data.companyName = val;
            } else if (key === 'Customer #') {
                data.customerNumber = val;
            } else if (key === 'Order #') {
                data.orderNumber = val;
            } else if (key === 'Ordered by') {
                var parts = val.trim().split(/\s+/);
                data.contactFirstName = parts[0] || '';
                data.contactLastName = parts.slice(1).join(' ') || '';
            } else if (key === 'Email' && section === 'order') {
                data.contactEmail = val;
            } else if (key === 'Phone' && section === 'order' && val) {
                data.contactPhone = val;
            } else if (key === 'Salesperson') {
                data.salesPerson = val;
            } else if (key === 'Date Order Placed') {
                data.dateOrderPlaced = val;
            } else if (key === 'Req. Ship Date') {
                data.reqShipDate = val;
            } else if (key === 'Design #') {
                var dParts = val.split(' - ');
                data.designNumber = dParts[0].trim();
                if (dParts[1]) data.designName = dParts[1].trim();
            } else if (key === 'Part Number' && section === 'items') {
                if (!data.garments) data.garments = [];
                // Strip size suffix: C110_OSFA → C110, PC54_2X → PC54
                var base = val.replace(/_\w+$/, '');
                // Check for GRT art charges
                if (base.indexOf('GRT-') === 0) {
                    data.artCharge = base;
                } else {
                    data.garments.push({ partNumber: base, color: '', description: '' });
                }
            } else if (key === 'Description' && section === 'items') {
                if (data.garments && data.garments.length > 0) {
                    var last = data.garments[data.garments.length - 1];
                    last.description = val;
                    // Extract color: "Size OSFA - Port Authority Flexfit 110 Mesh Cap, HtGrph/Blk"
                    var commaIdx = val.lastIndexOf(',');
                    if (commaIdx > -1) {
                        last.color = val.substring(commaIdx + 1).trim();
                    }
                }
            }
        });

        return data;
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

        // Update tab pill
        var tabName = data.tab || 'unknown';
        var pill = modal.querySelector('.ssf-pill[data-tab="' + tabName + '"]');
        if (pill && !pill.classList.contains('ssf-pill-done')) {
            pill.classList.add('ssf-pill-done');
        }
        // For text mode, mark all pills as done since text contains everything
        if (tabName === 'text') {
            modal.querySelectorAll('.ssf-pill').forEach(function (p) {
                p.classList.add('ssf-pill-done');
            });
        }

        var source = tabName === 'text' ? 'text export' : tabName + ' tab';
        showStatus('Found ' + newFieldCount + ' fields from ' + source, 'success');
        renderFieldPreview();

        // Show action buttons
        document.getElementById('ssf-actions').style.display = 'flex';
    }

    function renderFieldPreview() {
        var fieldsEl = document.getElementById('ssf-fields');
        var html = '<div class="ssf-field-list">';

        var labels = {
            companyName: 'Company',
            customerNumber: 'Customer #',
            orderNumber: 'Order #',
            contactFirstName: 'First Name',
            contactLastName: 'Last Name',
            contactEmail: 'Email',
            contactPhone: 'Phone',
            designNumber: 'Design #',
            designName: 'Design Name',
            orderType: 'Order Type',
            locationCode: 'Placement',
            artCharge: 'Art Estimate',
            locations: 'Locations',
            dateOrderPlaced: 'Order Date',
            reqShipDate: 'Ship Date'
        };

        // Calculate and show due date preview
        var dueDatePreview = '';
        if (accumulatedData.dateOrderPlaced) {
            var orderDate = new Date(accumulatedData.dateOrderPlaced);
            if (!isNaN(orderDate.getTime())) {
                var artDue = addBusinessDays(orderDate, 3);
                dueDatePreview = (artDue.getMonth() + 1) + '/' + artDue.getDate() + '/' + artDue.getFullYear();
            }
        }

        var idx = 0;
        Object.keys(labels).forEach(function (key) {
            if (accumulatedData[key] != null && accumulatedData[key] !== '') {
                var displayVal = escapeHtml(String(accumulatedData[key]));
                // Show mapped values for special fields
                if (key === 'orderType' && ORDER_TYPE_MAP[accumulatedData[key]]) {
                    displayVal += ' <span class="ssf-field-mapped">&rarr; ' + ORDER_TYPE_MAP[accumulatedData[key]].join(', ') + '</span>';
                }
                if (key === 'locationCode' && PLACEMENT_MAP[accumulatedData[key]]) {
                    displayVal += ' <span class="ssf-field-mapped">&rarr; ' + escapeHtml(PLACEMENT_MAP[accumulatedData[key]]) + '</span>';
                }
                if (key === 'artCharge' && ART_ESTIMATE_MAP[accumulatedData[key]]) {
                    displayVal += ' <span class="ssf-field-mapped">&rarr; $' + ART_ESTIMATE_MAP[accumulatedData[key]] + '</span>';
                }
                html += '<div class="ssf-field-row" style="animation-delay:' + (idx * 80) + 'ms">'
                    + '<span class="ssf-field-label">' + labels[key] + '</span>'
                    + '<span class="ssf-field-value">' + displayVal + '</span>'
                    + '</div>';
                idx++;
            }
        });

        // Show calculated due date
        if (dueDatePreview) {
            html += '<div class="ssf-field-row ssf-field-row-calc" style="animation-delay:' + (idx * 80) + 'ms">'
                + '<span class="ssf-field-label">Art Due Date</span>'
                + '<span class="ssf-field-value">' + escapeHtml(dueDatePreview)
                + ' <span class="ssf-field-mapped">(3 biz days after order placed)</span></span>'
                + '</div>';
            idx++;
        }

        // Garments
        if (accumulatedData.garments && accumulatedData.garments.length > 0) {
            html += '<div class="ssf-field-section">Garments</div>';
            accumulatedData.garments.forEach(function (g, i) {
                html += '<div class="ssf-field-row" style="animation-delay:' + ((idx + i) * 80) + 'ms">'
                    + '<span class="ssf-field-label">Row ' + (i + 1) + '</span>'
                    + '<span class="ssf-field-value">' + escapeHtml(g.partNumber) + (g.color ? ' — ' + escapeHtml(g.color) : '') + '</span>'
                    + '</div>';
            });
        }

        html += '</div>';
        fieldsEl.innerHTML = html;
        fieldsEl.style.display = 'block';
    }

    function resetForNextPaste() {
        document.getElementById('ssf-drop-zone').style.display = '';
        document.getElementById('ssf-preview-img').style.display = 'none';
        document.getElementById('ssf-preview-img').innerHTML = '';
        document.getElementById('ssf-skeleton').style.display = 'none';
        document.getElementById('ssf-status').style.display = 'none';
        document.getElementById('ssf-actions').style.display = 'none';
        var textInput = document.getElementById('ssf-text-input');
        if (textInput) textInput.value = '';
    }

    // ── Apply to Caspio Form ──
    function applyToForm(data) {
        var filledCount = 0;

        // Step 1: Set CompanyName FIRST (triggers Contact cascade)
        if (data.companyName) {
            var companyInput = document.querySelector('[name="InsertRecordCompanyName"]');
            if (companyInput) {
                companyInput.value = data.companyName;
                companyInput.dispatchEvent(new Event('change', { bubbles: true }));
                highlightField(companyInput);
                filledCount++;
            }
        }

        // Step 2: Set other simple text fields (skip companyName, contactFirstName, contactLastName, contactEmail — those cascade from Contact)
        Object.keys(FIELD_MAP).forEach(function (key) {
            if (key === 'companyName' || key === 'contactFirstName' || key === 'contactLastName' || key === 'contactEmail') return;
            if (data[key] != null && data[key] !== '') {
                var input = document.querySelector('[name="' + FIELD_MAP[key] + '"]');
                if (input) {
                    input.value = data[key];
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    highlightField(input);
                    filledCount++;
                }
            }
        });

        // Step 3: Wait for Contact cascade, then auto-select contact by name
        if (data.contactFirstName || data.contactLastName) {
            var fullName = ((data.contactFirstName || '') + ' ' + (data.contactLastName || '')).replace(/\s+/g, ' ').trim();
            if (fullName) {
                scheduleContactSelect(fullName, data);
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

        // Order Type multi-select checkboxes
        if (data.orderType) {
            fillOrderType(data.orderType);
            filledCount++;
        }

        // Due Date (order placed + 3 business days)
        if (data.dateOrderPlaced) {
            var orderDate = new Date(data.dateOrderPlaced);
            if (!isNaN(orderDate.getTime())) {
                var artDue = addBusinessDays(orderDate, 3);
                var dueDateInput = document.querySelector('[name="InsertRecordDue_Date"]');
                if (dueDateInput) {
                    var mm = String(artDue.getMonth() + 1);
                    var dd = String(artDue.getDate());
                    var yyyy = artDue.getFullYear();
                    dueDateInput.value = mm + '/' + dd + '/' + yyyy;
                    dueDateInput.dispatchEvent(new Event('change', { bubbles: true }));
                    highlightField(dueDateInput);
                    filledCount++;
                }
            }
        }

        // Art Estimate dropdown
        if (data.artCharge && ART_ESTIMATE_MAP[data.artCharge]) {
            var artSelect = document.querySelector('[name="InsertRecordPrelim_Charges"]');
            if (artSelect) {
                artSelect.value = ART_ESTIMATE_MAP[data.artCharge];
                artSelect.dispatchEvent(new Event('change', { bubbles: true }));
                highlightField(artSelect);
                filledCount++;
            }
        }

        // Garment Placement dropdown
        if (data.locationCode && PLACEMENT_MAP[data.locationCode]) {
            var placementSelect = document.querySelector('[name="InsertRecordGarment_Placement"]');
            if (placementSelect) {
                var targetText = PLACEMENT_MAP[data.locationCode];
                for (var p = 0; p < placementSelect.options.length; p++) {
                    if (placementSelect.options[p].text.trim() === targetText) {
                        placementSelect.value = placementSelect.options[p].value;
                        placementSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        highlightField(placementSelect);
                        filledCount++;
                        break;
                    }
                }
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
                    highlightField(styleInput);
                    filledCount++;

                    if (g.color) {
                        scheduleColorFill(GARMENT_COLOR_FIELDS[i], g.color);
                    }
                }
            });
        }

        showToast('Filled ' + filledCount + ' fields from ShopWorks');

        // After cascades settle, check for missing required fields
        setTimeout(function () { checkMissingFields(); }, 3000);
    }

    /**
     * Auto-select contact from cascade dropdown after Company fills.
     * Polls until dropdown populates, then matches by name.
     * If contact found, Caspio cascades First/Last/Email automatically.
     * If not found after timeout, falls back to setting fields directly.
     */
    function scheduleContactSelect(contactName, data) {
        var attempts = 0;
        var maxAttempts = 10; // 5 seconds

        var interval = setInterval(function () {
            attempts++;
            var select = document.querySelector('select[name="InsertRecordFull_Name_Contact"]');

            if (select && select.options.length > 1) {
                // Try exact match first
                var matched = false;
                for (var i = 0; i < select.options.length; i++) {
                    var optText = select.options[i].text.trim();
                    if (optText.toLowerCase() === contactName.toLowerCase()) {
                        select.value = select.options[i].value;
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                        highlightField(select);
                        matched = true;
                        clearInterval(interval);
                        return;
                    }
                }
                // Partial match — all name parts present
                if (!matched) {
                    var parts = contactName.split(' ').filter(function (p) { return p.length > 0; });
                    for (var j = 0; j < select.options.length; j++) {
                        var text = select.options[j].text.toLowerCase();
                        var allMatch = parts.every(function (p) { return text.indexOf(p.toLowerCase()) !== -1; });
                        if (allMatch) {
                            select.value = select.options[j].value;
                            select.dispatchEvent(new Event('change', { bubbles: true }));
                            highlightField(select);
                            clearInterval(interval);
                            return;
                        }
                    }
                }
            }

            // Timeout — fall back to setting First/Last/Email directly
            if (attempts >= maxAttempts) {
                clearInterval(interval);
                fallbackSetContactFields(data);
            }
        }, 500);
    }

    /**
     * Fallback: set contact fields directly if cascade didn't populate or match.
     */
    function fallbackSetContactFields(data) {
        var fields = {
            contactFirstName: 'InsertRecordFirst_name',
            contactLastName: 'InsertRecordLast_name',
            contactEmail: 'InsertRecordEmail_Contact'
        };
        Object.keys(fields).forEach(function (key) {
            if (data[key]) {
                var input = document.querySelector('[name="' + fields[key] + '"]');
                if (input && !input.value) {
                    input.value = data[key];
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    highlightField(input);
                }
            }
        });
    }

    /**
     * Check for missing required fields and show notice.
     */
    function checkMissingFields() {
        var missing = [];
        var checks = [
            { name: 'InsertRecordCompanyName', label: 'Company' },
            { name: 'InsertRecordOrder_Type', label: 'Order Type', isMultiSelect: true },
            { name: 'InsertRecordDue_Date', label: 'Due Date' },
            { name: 'InsertRecordDesign_Num_SW', label: 'Design #' },
            { name: 'InsertRecordGarment_Placement', label: 'Garment Placement', isSelect: true },
            { name: 'InsertRecordOrder_Num_SW', label: 'Order #' }
        ];

        checks.forEach(function (f) {
            var el = document.querySelector('[name="' + f.name + '"]');
            if (!el) return;
            // Skip hidden fields (e.g. Order # in Mockup mode)
            if (el.closest && el.closest('.mockup-hidden')) return;

            if (f.isMultiSelect) {
                // Check if any checkbox is checked in the Order Type container
                var lbl = findLabelFor('Order Type');
                if (lbl) {
                    var cell = lbl.closest('.cbFormLabelCell');
                    var fieldCell = cell ? cell.nextElementSibling : null;
                    if (fieldCell) {
                        var anyChecked = fieldCell.querySelector('input[type="checkbox"]:checked');
                        if (!anyChecked) missing.push(f.label);
                    }
                }
            } else if (f.isSelect) {
                if (!el.value || el.value === '' || el.selectedIndex <= 0) missing.push(f.label);
            } else {
                if (!el.value || el.value.trim() === '') missing.push(f.label);
            }
        });

        if (missing.length > 0) {
            showMissingFieldsNotice(missing);
        }
    }

    function findLabelFor(labelText) {
        var labels = document.querySelectorAll('#submit-tab label');
        for (var i = 0; i < labels.length; i++) {
            if (labels[i].textContent.trim().replace(/\s*\*$/, '') === labelText) {
                return labels[i];
            }
        }
        return null;
    }

    function showMissingFieldsNotice(fields) {
        // Remove existing notice
        var existing = document.querySelector('.ssf-missing-notice');
        if (existing) existing.remove();

        var notice = document.createElement('div');
        notice.className = 'ssf-missing-notice';
        notice.innerHTML = '<span class="ssf-missing-icon">'
            + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
            + '</span>'
            + '<span><strong>Still needed:</strong> ' + fields.map(function (f) { return escapeHtml(f); }).join(', ') + '</span>'
            + '<button type="button" class="ssf-missing-dismiss" title="Dismiss">&times;</button>';

        notice.querySelector('.ssf-missing-dismiss').addEventListener('click', function () {
            notice.remove();
        });

        // Insert below the tools strip
        var strip = document.querySelector('.ae-tools-strip');
        if (strip) {
            strip.parentElement.insertBefore(notice, strip.nextSibling);
        }
    }

    // ── Order Type: check checkboxes in Caspio MSDropdown ──
    function fillOrderType(orderTypeText) {
        var values = ORDER_TYPE_MAP[orderTypeText] || ['Other'];
        fillOrderTypeByValues(values);
    }

    function fillOrderTypeByValues(values) {
        if (!values || !values.length) return;

        // Caspio MSDropdown renders as a container with checkbox inputs + labels
        // Find the Order_Type container
        var container = null;
        var allLabels = document.querySelectorAll('#submit-tab label');
        for (var i = 0; i < allLabels.length; i++) {
            if (allLabels[i].textContent.trim().replace(/\s*\*$/, '') === 'Order Type') {
                var cell = allLabels[i].closest('.cbFormLabelCell');
                if (cell) {
                    container = cell.nextElementSibling;
                }
                break;
            }
        }

        if (!container) return;

        // Find all checkbox inputs and their associated labels in the MSDropdown
        var checkboxes = container.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(function (cb) {
            var label = cb.parentElement ? cb.parentElement.textContent.trim() : '';
            if (!label && cb.nextElementSibling) label = cb.nextElementSibling.textContent.trim();
            if (!label && cb.nextSibling) label = (cb.nextSibling.textContent || '').trim();

            if (values.indexOf(label) !== -1) {
                cb.checked = true;
                cb.dispatchEvent(new Event('change', { bubbles: true }));
                cb.dispatchEvent(new Event('click', { bubbles: true }));
            }
        });

        // Also try the select element approach (in case Caspio renders differently)
        var selectEl = container.querySelector('select[name="InsertRecordOrder_Type"]');
        if (selectEl && selectEl.multiple) {
            for (var j = 0; j < selectEl.options.length; j++) {
                if (values.indexOf(selectEl.options[j].text.trim()) !== -1) {
                    selectEl.options[j].selected = true;
                }
            }
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    // ── Highlight filled field with blue glow ──
    function highlightField(input) {
        if (!input) return;
        input.classList.add('ssf-field-glow');
        setTimeout(function () {
            input.classList.remove('ssf-field-glow');
        }, 1800);
    }

    /**
     * Wait for Caspio cascade to populate the color dropdown, then set the value.
     */
    function scheduleColorFill(colorFieldName, colorValue) {
        var attempts = 0;
        var maxAttempts = 10;

        var interval = setInterval(function () {
            attempts++;
            var colorEl = document.querySelector('[name="' + colorFieldName + '"]');

            if (colorEl && colorEl.tagName === 'SELECT' && colorEl.options.length > 1) {
                var matched = false;
                for (var j = 0; j < colorEl.options.length; j++) {
                    var optText = colorEl.options[j].text.toLowerCase();
                    var target = colorValue.toLowerCase();
                    if (optText === target || optText.indexOf(target) !== -1 || target.indexOf(optText) !== -1) {
                        colorEl.value = colorEl.options[j].value;
                        colorEl.dispatchEvent(new Event('change', { bubbles: true }));
                        highlightField(colorEl);
                        matched = true;
                        break;
                    }
                }
                if (matched) clearInterval(interval);
            }

            if (attempts >= maxAttempts) {
                clearInterval(interval);
                if (colorEl && colorEl.tagName === 'INPUT') {
                    colorEl.value = colorValue;
                    colorEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }, 500);
    }

    function showToast(message) {
        var toast = document.createElement('div');
        toast.className = 'ssf-toast';
        toast.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ' + escapeHtml(message);
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
        accumulatedData = {};
        pasteCount = 0;

        // Reset textarea and status
        var textInput = document.getElementById('ssf-text-input');
        if (textInput) textInput.value = '';
        var statusEl = document.getElementById('ssf-status');
        if (statusEl) statusEl.style.display = 'none';
        var fieldsEl = document.getElementById('ssf-fields');
        if (fieldsEl) { fieldsEl.style.display = 'none'; fieldsEl.innerHTML = ''; }

        m.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Focus textarea
        setTimeout(function () {
            if (textInput) textInput.focus();
        }, 100);
    }

    function closeModal() {
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    window.ScreenshotFill = {
        open: openModal,
        close: closeModal,
        // Exposed for reuse by ae-submit-form.js (order validation auto-fill)
        scheduleContactSelect: scheduleContactSelect,
        fillOrderTypeByValues: fillOrderTypeByValues,
        highlightField: highlightField,
        checkMissingFields: checkMissingFields,
        addBusinessDays: addBusinessDays,
        showToast: showToast,
        scheduleColorFill: scheduleColorFill
    };

})();
