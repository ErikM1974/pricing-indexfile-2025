/**
 * mockup-submit-form.js — AE Digitizing/Mockup Submit Form
 *
 * Renders a custom form for AEs to request digitizing/mockups from Ruth.
 * Replaces both the Caspio DataPage and JotForm with a single JS-driven form.
 * Includes company autocomplete (CustomerLookupService), thread color picker,
 * location dropdown, file upload, and sales rep auto-fill (StaffAuthHelper).
 *
 * Usage: MockupSubmitForm.init('container-id')
 *
 * Depends on: mockup-submit-form.css, app-config.js,
 *             customer-lookup-service.js, staff-auth-helper.js
 */
var MockupSubmitForm = (function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
    var SITE_ORIGIN = 'https://www.teamnwca.com';

    // ── State ──────────────────────────────────────────────────────────────
    var containerId = null;
    var selectedThreadColors = [];
    var referenceFiles = [];  // Array of File objects (max 4)
    var allThreadColors = [];
    var threadColorsLoaded = false;
    var allLocations = [];
    var currentRequestType = 'New Digitizing'; // or 'Mockup Request'
    var customerLookup = null;
    var selectedContact = null;
    var isRush = false;

    // Garment style/color state — up to 4 rows
    var garmentRows = [{ style: '', color: '', colors: [], swatch: '' }];
    var styleSearchTimers = {};

    // ── Init ───────────────────────────────────────────────────────────────
    function init(containerIdParam) {
        containerId = containerIdParam;
        var container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = buildFormHtml();
        wireEvents();
        initToggle();
        initCompanyAutocomplete();
        initSalesRep();
        loadLocations();
        loadThreadColors();
        renderGarmentRows();
    }

    // ── Build Form HTML ────────────────────────────────────────────────────
    function buildFormHtml() {
        return '<div class="msf-container">'
            // Ruth banner
            + '<div class="msf-ruth-banner">'
            + '  <div class="msf-ruth-photo">'
            + '    <img src="https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9094678" alt="Ruth Nhong">'
            + '    <h4>Ruth Nhong</h4>'
            + '    <p>Digitizing Specialist</p>'
            + '  </div>'
            + '  <div class="msf-ruth-info">'
            + '    <h3>Request Digitizing / Mockup from Ruth</h3>'
            + '    <p>Complete this form for embroidery orders to ensure the correct digitized design is prepared. '
            + 'Ruth will create or verify the mockup and notify you when it\'s ready for review.</p>'
            + '    <div class="msf-mandatory-bar">Required for every embroidery order &mdash; new and repeat</div>'
            + '  </div>'
            + '</div>'
            // Form card
            + '<div class="msf-form-card">'
            + '  <div class="msf-form-header">New Digitizing / Mockup Request</div>'
            + '  <div class="msf-form-body" id="msf-form-body">'

            // Request Type Toggle
            + '    <div class="msf-toggle-section">'
            + '      <div class="msf-toggle-row" id="msf-toggle-row">'
            + '        <button type="button" class="msf-toggle-btn active" data-type="new">New Digitizing</button>'
            + '        <button type="button" class="msf-toggle-btn" data-type="mockup">Mockup Request</button>'
            + '      </div>'
            + '      <div class="msf-toggle-helper" id="msf-toggle-helper">New design that needs to be digitized from scratch</div>'
            + '    </div>'

            // Company Name (autocomplete) + Sales Rep (auto-filled)
            + '    <div class="msf-row">'
            + '      <div class="msf-field">'
            + '        <label class="msf-field-label">Company Name <span class="msf-required">*</span></label>'
            + '        <div class="msf-autocomplete-wrap">'
            + '          <input type="text" class="msf-input" id="msf-company" placeholder="Type company name to search..." autocomplete="off">'
            + '        </div>'
            + '        <span class="msf-error-msg" id="msf-company-error">Company name is required</span>'
            + '        <span class="msf-warning-msg" id="msf-customer-id-warning" style="display:none;color:#b45309;font-size:0.82rem;margin-top:4px;">'
            + '          <i class="fas fa-exclamation-triangle"></i> No customer ID found &mdash; portal link won\'t work for this company</span>'
            + '      </div>'
            + '      <div class="msf-field">'
            + '        <label class="msf-field-label">Sales Rep</label>'
            + '        <input type="text" class="msf-input" id="msf-sales-rep" placeholder="Auto-filled from login">'
            + '      </div>'
            + '    </div>'
            + '    <input type="hidden" id="msf-customer-id">'

            // Design Number + Design Name (both editable)
            + '    <div class="msf-row">'
            + '      <div class="msf-field">'
            + '        <label class="msf-field-label">Design Number <span class="msf-required msf-design-required" id="msf-design-asterisk">*</span></label>'
            + '        <input type="text" class="msf-input" id="msf-design-number" placeholder="Enter design number" autocomplete="off">'
            + '        <span class="msf-error-msg" id="msf-design-error">Design number is required</span>'
            + '      </div>'
            + '      <div class="msf-field">'
            + '        <label class="msf-field-label">Design Name</label>'
            + '        <input type="text" class="msf-input" id="msf-design-name" placeholder="Enter design name">'
            + '      </div>'
            + '    </div>'

            // Mockup Type (multi-select checkboxes) + Placement
            + '    <div class="msf-row">'
            + '      <div class="msf-field">'
            + '        <label class="msf-field-label">Application Type <span class="msf-required">*</span></label>'
            + '        <div class="msf-checkbox-group" id="msf-mockup-type-group">'
            + '          <label class="msf-checkbox-label"><input type="checkbox" class="msf-mockup-type-cb" value="Cap"> Cap</label>'
            + '          <label class="msf-checkbox-label"><input type="checkbox" class="msf-mockup-type-cb" value="Jacket"> Jacket</label>'
            + '          <label class="msf-checkbox-label"><input type="checkbox" class="msf-mockup-type-cb" value="Shirt"> Shirt</label>'
            + '          <label class="msf-checkbox-label"><input type="checkbox" class="msf-mockup-type-cb" value="Polo"> Polo</label>'
            + '          <label class="msf-checkbox-label"><input type="checkbox" class="msf-mockup-type-cb" value="Beanie"> Beanie</label>'
            + '          <label class="msf-checkbox-label"><input type="checkbox" class="msf-mockup-type-cb" value="Other"> Other</label>'
            + '        </div>'
            + '        <span class="msf-error-msg" id="msf-type-error">Select at least one application type</span>'
            + '      </div>'
            + '      <div class="msf-field">'
            + '        <label class="msf-field-label">Placement <span class="msf-required">*</span></label>'
            + '        <select class="msf-select" id="msf-placement">'
            + '          <option value="">Loading locations...</option>'
            + '        </select>'
            + '        <span class="msf-error-msg" id="msf-placement-error">Placement is required</span>'
            + '      </div>'
            + '    </div>'

            // Garment Style/Color Rows (up to 4)
            + '    <div class="msf-field">'
            + '      <label class="msf-field-label">Garment Styles &amp; Colors</label>'
            + '      <div id="msf-garment-rows"></div>'
            + '      <button type="button" class="msf-add-garment-btn" id="msf-add-garment-btn">+ Add Another Garment</button>'
            + '      <span class="msf-field-hint">Type a style number (e.g. PC54) to search SanMar products, then pick a color</span>'
            + '    </div>'

            // Fabric Type (kept separate)
            + '    <div class="msf-field" style="max-width:300px;">'
            + '      <label class="msf-field-label">Fabric/Garment Type</label>'
            + '      <select class="msf-select" id="msf-fabric-type">'
            + '        <option value="">Select type...</option>'
            + '        <option value="Twill">Twill</option>'
            + '        <option value="Pique">Pique</option>'
            + '        <option value="Fleece">Fleece</option>'
            + '        <option value="Knit">Knit</option>'
            + '        <option value="Nylon">Nylon</option>'
            + '        <option value="Cotton">Cotton</option>'
            + '        <option value="Polyester">Polyester</option>'
            + '        <option value="Other">Other</option>'
            + '      </select>'
            + '    </div>'

            // Width x Height
            + '    <div class="msf-row">'
            + '      <div class="msf-field">'
            + '        <label class="msf-field-label">Width (inches)</label>'
            + '        <input type="text" class="msf-input" id="msf-width" placeholder="e.g., 3.5">'
            + '      </div>'
            + '      <div class="msf-field">'
            + '        <label class="msf-field-label">Height (inches)</label>'
            + '        <input type="text" class="msf-input" id="msf-height" placeholder="e.g., 2.0">'
            + '      </div>'
            + '    </div>'

            // Thread Colors
            + '    <div class="msf-field">'
            + '      <label class="msf-field-label">Thread Colors</label>'
            + '      <div class="msf-thread-chips" id="msf-thread-chips"></div>'
            + '      <div class="msf-thread-picker">'
            + '        <input type="text" class="msf-input" id="msf-thread-search" placeholder="Search thread colors..." autocomplete="off">'
            + '        <div class="msf-thread-dropdown" id="msf-thread-dropdown"></div>'
            + '      </div>'
            + '      <span class="msf-field-hint">Type to search from Robison Anton thread colors</span>'
            + '    </div>'

            // Due Date + Work Order
            + '    <div class="msf-row">'
            + '      <div class="msf-field">'
            + '        <label class="msf-field-label">Due Date</label>'
            + '        <input type="date" class="msf-input" id="msf-due-date">'
            + '      </div>'
            + '      <div class="msf-field">'
            + '        <label class="msf-field-label">Work Order #</label>'
            + '        <input type="text" class="msf-input" id="msf-work-order" placeholder="ShopWorks order #">'
            + '      </div>'
            + '    </div>'

            // Instructions
            + '    <div class="msf-field">'
            + '      <label class="msf-field-label">Additional Instructions</label>'
            + '      <textarea class="msf-textarea" id="msf-instructions" placeholder="Special instructions for Ruth..."></textarea>'
            + '    </div>'

            // File Upload (multi-file)
            + '    <div class="msf-field">'
            + '      <label class="msf-field-label">Reference Files</label>'
            + '      <div class="msf-file-drop" id="msf-file-drop">'
            + '        <div class="msf-file-drop-icon">&#128206;</div>'
            + '        <div>Click to upload or drag &amp; drop</div>'
            + '        <div style="font-size:12px;color:#aaa;margin-top:4px;">.DST, .EMB, .AI, .EPS, .PDF, images — max 4 files, 20MB each</div>'
            + '      </div>'
            + '      <input type="file" id="msf-file-input" style="display:none;" accept="image/*,.pdf,.dst,.emb,.eps,.ai,.svg" multiple>'
            + '      <div id="msf-file-preview-area"></div>'
            + '    </div>'

            // Rush toggle + Submit
            + '    <div class="msf-rush-row">'
            + '      <button type="button" class="msf-rush-toggle" id="msf-rush-toggle" aria-pressed="false">'
            + '        <span class="msf-rush-icon">&#128293;</span>'
            + '        <span class="msf-rush-label">Rush Order</span>'
            + '        <span class="msf-rush-hint">Click if Ruth needs this ASAP</span>'
            + '      </button>'
            + '    </div>'
            + '    <div class="msf-submit-row">'
            + '      <button type="button" class="msf-submit-btn" id="msf-submit-btn">Submit Request</button>'
            + '      <span class="msf-submit-status" id="msf-submit-status"></span>'
            + '    </div>'

            + '  </div>'
            + '</div>'
            + '</div>';
    }

    // ── Request Type Toggle ─────────────────────────────────────────────────
    function initToggle() {
        var buttons = document.querySelectorAll('.msf-toggle-btn');
        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var type = btn.getAttribute('data-type');

                // Update active state
                buttons.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');

                // Set mode
                currentRequestType = type === 'mockup' ? 'Mockup Request' : 'New Digitizing';

                // Update helper text
                var helper = document.getElementById('msf-toggle-helper');
                if (helper) {
                    helper.textContent = type === 'mockup'
                        ? 'Place an existing design on a new garment for approval'
                        : 'New design that needs to be digitized from scratch';
                }

                // Toggle design number required asterisk
                var asterisk = document.getElementById('msf-design-asterisk');
                if (asterisk) {
                    // In New Digitizing mode, design number is optional
                    asterisk.style.display = type === 'mockup' ? '' : 'none';
                }

                // Clear validation errors on design number when switching
                var designInput = document.getElementById('msf-design-number');
                if (designInput) {
                    designInput.classList.remove('msf-error');
                    document.getElementById('msf-design-error').style.display = 'none';
                }
            });
        });

        // Set initial state — New Digitizing is default, design number optional
        var asterisk = document.getElementById('msf-design-asterisk');
        if (asterisk) asterisk.style.display = 'none';
    }

    // ── Company Autocomplete ────────────────────────────────────────────────
    function initCompanyAutocomplete() {
        if (typeof CustomerLookupService === 'undefined') {
            return;
        }

        customerLookup = new CustomerLookupService({ maxResults: 10 });
        customerLookup.bindToInput('msf-company', {
            onSelect: function (contact) {
                selectedContact = contact;
                document.getElementById('msf-customer-id').value = contact.id_Customer || '';

                // Clear error state
                document.getElementById('msf-company').classList.remove('msf-error');
                document.getElementById('msf-company-error').style.display = 'none';

                // Show warning if no customer ID
                var warn = document.getElementById('msf-customer-id-warning');
                if (warn) warn.style.display = (contact.id_Customer && contact.id_Customer > 0) ? 'none' : 'block';
            },
            onClear: function () {
                selectedContact = null;
                document.getElementById('msf-customer-id').value = '';
                var warn = document.getElementById('msf-customer-id-warning');
                if (warn) warn.style.display = 'none';
            }
        });
    }

    // ── Sales Rep Auto-fill ─────────────────────────────────────────────────
    function initSalesRep() {
        var repInput = document.getElementById('msf-sales-rep');
        if (!repInput) return;

        if (typeof StaffAuthHelper !== 'undefined' && StaffAuthHelper.isLoggedIn()) {
            var staffName = StaffAuthHelper.getLoggedInStaffName();
            if (staffName) {
                repInput.value = staffName;
                repInput.readOnly = true;
                return;
            }
        }

        // Fallback: editable field
        repInput.readOnly = false;
        repInput.placeholder = 'Enter your name';
    }

    // ── Garment Style/Color Rows ──────────────────────────────────────────
    function renderGarmentRows() {
        var container = document.getElementById('msf-garment-rows');
        if (!container) return;
        container.innerHTML = '';

        garmentRows.forEach(function (row, idx) {
            var rowEl = document.createElement('div');
            rowEl.className = 'msf-garment-row';
            rowEl.setAttribute('data-idx', idx);

            var styleWrap = document.createElement('div');
            styleWrap.className = 'msf-garment-style-wrap';

            var styleInput = document.createElement('input');
            styleInput.type = 'text';
            styleInput.className = 'msf-input msf-garment-style';
            styleInput.placeholder = 'Style # (e.g. PC54)';
            styleInput.value = row.style;
            styleInput.setAttribute('data-idx', idx);
            styleInput.autocomplete = 'off';

            var styleDropdown = document.createElement('div');
            styleDropdown.className = 'msf-garment-style-dropdown';
            styleDropdown.id = 'msf-style-dd-' + idx;

            styleWrap.appendChild(styleInput);
            styleWrap.appendChild(styleDropdown);

            var colorSelect = document.createElement('select');
            colorSelect.className = 'msf-select msf-garment-color';
            colorSelect.setAttribute('data-idx', idx);
            colorSelect.innerHTML = '<option value="">Select color...</option>';
            if (row.colors && row.colors.length > 0) {
                row.colors.forEach(function (c) {
                    var opt = document.createElement('option');
                    opt.value = c.COLOR_NAME;
                    opt.textContent = c.COLOR_NAME;
                    if (c.COLOR_NAME === row.color) opt.selected = true;
                    colorSelect.appendChild(opt);
                });
            }

            var swatchEl = document.createElement('div');
            swatchEl.className = 'msf-garment-swatch';
            swatchEl.id = 'msf-swatch-' + idx;
            if (row.swatch) {
                swatchEl.innerHTML = '<img src="' + escapeHtml(row.swatch) + '" alt="swatch">';
            }

            var removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'msf-garment-remove';
            removeBtn.innerHTML = '&times;';
            removeBtn.title = 'Remove garment';
            removeBtn.setAttribute('data-idx', idx);
            if (garmentRows.length <= 1) removeBtn.style.visibility = 'hidden';

            rowEl.appendChild(styleWrap);
            rowEl.appendChild(colorSelect);
            rowEl.appendChild(swatchEl);
            rowEl.appendChild(removeBtn);
            container.appendChild(rowEl);

            // Wire style autocomplete
            styleInput.addEventListener('input', function () {
                var i = parseInt(this.getAttribute('data-idx'));
                garmentRows[i].style = this.value;
                garmentRows[i].color = '';
                garmentRows[i].colors = [];
                garmentRows[i].swatch = '';
                searchStyles(i, this.value.trim());
            });

            // Wire color change
            colorSelect.addEventListener('change', function () {
                var i = parseInt(this.getAttribute('data-idx'));
                var selectedColor = this.value;
                garmentRows[i].color = selectedColor;
                // Find swatch
                var colorObj = garmentRows[i].colors.find(function (c) { return c.COLOR_NAME === selectedColor; });
                var swatchDiv = document.getElementById('msf-swatch-' + i);
                if (colorObj && colorObj.COLOR_SQUARE_IMAGE) {
                    garmentRows[i].swatch = colorObj.COLOR_SQUARE_IMAGE;
                    swatchDiv.innerHTML = '<img src="' + escapeHtml(colorObj.COLOR_SQUARE_IMAGE) + '" alt="swatch">';
                } else {
                    garmentRows[i].swatch = '';
                    swatchDiv.innerHTML = '';
                }
            });

            // Wire remove
            removeBtn.addEventListener('click', function () {
                var i = parseInt(this.getAttribute('data-idx'));
                garmentRows.splice(i, 1);
                renderGarmentRows();
                updateAddBtnVisibility();
            });
        });

        updateAddBtnVisibility();
    }

    function updateAddBtnVisibility() {
        var addBtn = document.getElementById('msf-add-garment-btn');
        if (addBtn) addBtn.style.display = garmentRows.length >= 4 ? 'none' : '';
    }

    function searchStyles(idx, term) {
        var dd = document.getElementById('msf-style-dd-' + idx);
        if (!dd) return;

        if (term.length < 2) {
            dd.style.display = 'none';
            return;
        }

        // Debounce
        if (styleSearchTimers[idx]) clearTimeout(styleSearchTimers[idx]);
        styleSearchTimers[idx] = setTimeout(function () {
            dd.style.display = 'block';
            dd.innerHTML = '<div class="msf-style-loading">Searching...</div>';

            fetch(API_BASE + '/api/stylesearch?term=' + encodeURIComponent(term))
                .then(function (resp) {
                    if (!resp.ok) throw new Error('Style search failed');
                    return resp.json();
                })
                .then(function (results) {
                    dd.innerHTML = '';
                    if (!results || results.length === 0) {
                        dd.innerHTML = '<div class="msf-style-loading">No matches</div>';
                        return;
                    }
                    results.slice(0, 15).forEach(function (item) {
                        var opt = document.createElement('div');
                        opt.className = 'msf-style-option';
                        opt.textContent = item.label || item.value;
                        opt.addEventListener('click', function () {
                            selectStyle(idx, item.value, item.label);
                            dd.style.display = 'none';
                        });
                        dd.appendChild(opt);
                    });
                })
                .catch(function () {
                    dd.innerHTML = '<div class="msf-style-loading">Search failed</div>';
                });
        }, 300);
    }

    function selectStyle(idx, styleNumber, label) {
        garmentRows[idx].style = styleNumber;
        garmentRows[idx].color = '';
        garmentRows[idx].colors = [];
        garmentRows[idx].swatch = '';

        // Update input
        var inputs = document.querySelectorAll('.msf-garment-style');
        if (inputs[idx]) inputs[idx].value = styleNumber;

        // Load colors for this style
        var colorSelect = document.querySelectorAll('.msf-garment-color')[idx];
        if (colorSelect) colorSelect.innerHTML = '<option value="">Loading colors...</option>';

        fetch(API_BASE + '/api/product-colors?styleNumber=' + encodeURIComponent(styleNumber))
            .then(function (resp) {
                if (!resp.ok) throw new Error('Color fetch failed');
                return resp.json();
            })
            .then(function (data) {
                var colors = data.colors || [];
                garmentRows[idx].colors = colors;
                if (colorSelect) {
                    colorSelect.innerHTML = '<option value="">Select color (' + colors.length + ' available)...</option>';
                    colors.forEach(function (c) {
                        var opt = document.createElement('option');
                        opt.value = c.COLOR_NAME;
                        opt.textContent = c.COLOR_NAME;
                        colorSelect.appendChild(opt);
                    });
                }
            })
            .catch(function () {
                if (colorSelect) colorSelect.innerHTML = '<option value="">Failed to load colors</option>';
            });
    }

    function initGarmentAddBtn() {
        var addBtn = document.getElementById('msf-add-garment-btn');
        if (!addBtn) return;
        addBtn.addEventListener('click', function () {
            if (garmentRows.length >= 4) return;
            garmentRows.push({ style: '', color: '', colors: [], swatch: '' });
            renderGarmentRows();
        });
    }

    // ── Wire Events ────────────────────────────────────────────────────────
    function wireEvents() {
        // Close dropdowns on outside click
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.msf-thread-picker')) hideThreadDropdown();
            // Close style dropdowns
            if (!e.target.closest('.msf-garment-style-wrap')) {
                document.querySelectorAll('.msf-garment-style-dropdown').forEach(function (dd) { dd.style.display = 'none'; });
            }
        });

        // Garment add button
        initGarmentAddBtn();

        // Thread color search
        var threadInput = document.getElementById('msf-thread-search');
        threadInput.addEventListener('input', function () {
            filterThreadColors(threadInput.value.trim());
        });
        threadInput.addEventListener('focus', function () {
            filterThreadColors(threadInput.value.trim());
        });

        // File upload
        var fileDrop = document.getElementById('msf-file-drop');
        var fileInput = document.getElementById('msf-file-input');

        fileDrop.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
            if (fileInput.files.length > 0) {
                addReferenceFiles(fileInput.files);
            }
        });

        fileDrop.addEventListener('dragover', function (e) {
            e.preventDefault();
            fileDrop.style.borderColor = '#6B46C1';
            fileDrop.style.background = '#f8f5ff';
        });
        fileDrop.addEventListener('dragleave', function () {
            fileDrop.style.borderColor = '#d1d5db';
            fileDrop.style.background = '';
        });
        fileDrop.addEventListener('drop', function (e) {
            e.preventDefault();
            fileDrop.style.borderColor = '#d1d5db';
            fileDrop.style.background = '';
            if (e.dataTransfer.files.length > 0) {
                addReferenceFiles(e.dataTransfer.files);
            }
        });

        // Rush toggle
        var rushBtn = document.getElementById('msf-rush-toggle');
        if (rushBtn) {
            rushBtn.addEventListener('click', function () {
                isRush = !isRush;
                rushBtn.classList.toggle('msf-rush-toggle--active', isRush);
                rushBtn.setAttribute('aria-pressed', isRush ? 'true' : 'false');
            });
        }

        // Submit
        document.getElementById('msf-submit-btn').addEventListener('click', handleSubmit);
    }

    // ── Load Locations ─────────────────────────────────────────────────────
    function loadLocations() {
        fetch(API_BASE + '/api/locations?type=EMB,CAP')
            .then(function (r) { return r.ok ? r.json() : []; })
            .then(function (data) {
                allLocations = Array.isArray(data) ? data : (data.locations || []);
                var select = document.getElementById('msf-placement');
                select.innerHTML = '<option value="">Select placement...</option>';
                allLocations.forEach(function (loc) {
                    var opt = document.createElement('option');
                    opt.value = loc.location_name;
                    opt.textContent = loc.location_name + ' (' + loc.location_code + ')';
                    select.appendChild(opt);
                });
            })
            .catch(function () {
                var select = document.getElementById('msf-placement');
                select.innerHTML = '<option value="">Select placement...</option>'
                    + '<option value="Left Chest">Left Chest (LC)</option>'
                    + '<option value="Full Back">Full Back (FB)</option>'
                    + '<option value="Right Chest">Right Chest (RC)</option>'
                    + '<option value="Center Chest">Center Chest (CC)</option>'
                    + '<option value="Cap Front">Cap Front (CF)</option>'
                    + '<option value="Cap Back">Cap Back (CB)</option>'
                    + '<option value="Left Side">Left Side (CL)</option>'
                    + '<option value="Right Side">Right Side (CR)</option>'
                    + '<option value="Monogram">Monogram</option>'
                    + '<option value="Left Panel">Left Panel (LP)</option>'
                    + '<option value="Left Sleeve">Left Sleeve (LS)</option>'
                    + '<option value="Right Sleeve">Right Sleeve (RS)</option>'
                    + '<option value="Back of Neck">Back of Neck (BN)</option>'
                    + '<option value="Other (see Notes)">Other (see Notes)</option>';
            });
    }

    // ── Load Thread Colors ─────────────────────────────────────────────────
    function loadThreadColors() {
        fetch(API_BASE + '/api/thread-colors?instock=true')
            .then(function (r) { return r.ok ? r.json() : { colors: [] }; })
            .then(function (data) {
                allThreadColors = data.colors || [];
                threadColorsLoaded = true;
                // Update hint with actual count
                var hint = document.querySelector('.msf-field-hint');
                if (hint && allThreadColors.length > 0) {
                    hint.textContent = 'Type to search from ' + allThreadColors.length + ' Robison Anton thread colors';
                }
            })
            .catch(function () {
                allThreadColors = [];
                threadColorsLoaded = true;
            });
    }

    function filterThreadColors(query) {
        var dropdown = document.getElementById('msf-thread-dropdown');
        dropdown.style.display = 'block';

        // Show loading state if colors haven't loaded yet
        if (!threadColorsLoaded) {
            dropdown.innerHTML = '<div style="padding:12px;color:#888;text-align:center;font-size:13px;">Loading thread colors...</div>';
            return;
        }

        dropdown.innerHTML = '';

        var filtered = allThreadColors;
        if (query) {
            var q = query.toLowerCase();
            filtered = allThreadColors.filter(function (c) {
                return (c.Thread_Color || '').toLowerCase().indexOf(q) !== -1
                    || String(c.Thread_Number || '').indexOf(q) !== -1;
            });
        }

        filtered.slice(0, 30).forEach(function (color) {
            var isSelected = selectedThreadColors.some(function (s) { return s.Thread_Number === color.Thread_Number; });
            var item = document.createElement('div');
            item.className = 'msf-thread-option' + (isSelected ? ' selected' : '');
            item.innerHTML = '<span>' + escapeHtml(color.Thread_Color) + '</span>'
                + '<span class="msf-thread-number">#' + (color.Thread_Number || '') + '</span>';

            item.addEventListener('click', function () {
                if (isSelected) {
                    selectedThreadColors = selectedThreadColors.filter(function (s) { return s.Thread_Number !== color.Thread_Number; });
                } else {
                    selectedThreadColors.push(color);
                }
                renderThreadChips();
                filterThreadColors(document.getElementById('msf-thread-search').value.trim());
            });
            dropdown.appendChild(item);
        });

        if (filtered.length === 0) {
            dropdown.innerHTML = '<div style="padding:12px;color:#999;text-align:center;font-size:13px;">No matching colors</div>';
        }
    }

    function renderThreadChips() {
        var container = document.getElementById('msf-thread-chips');
        container.innerHTML = '';
        selectedThreadColors.forEach(function (color) {
            var chip = document.createElement('span');
            chip.className = 'msf-thread-chip';
            chip.innerHTML = escapeHtml(color.Thread_Color)
                + ' <span class="msf-thread-chip-remove" data-thread="' + color.Thread_Number + '">&times;</span>';
            container.appendChild(chip);
        });

        container.querySelectorAll('.msf-thread-chip-remove').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var num = parseInt(btn.dataset.thread);
                selectedThreadColors = selectedThreadColors.filter(function (s) { return s.Thread_Number !== num; });
                renderThreadChips();
            });
        });
    }

    function hideThreadDropdown() {
        document.getElementById('msf-thread-dropdown').style.display = 'none';
    }

    // ── File Upload (Multi-File) ────────────────────────────────────────
    var MAX_FILES = 4;
    var FILE_SLOTS = ['Box_Reference_File', 'Box_Mockup_1', 'Box_Mockup_2', 'Box_Mockup_3'];

    function addReferenceFiles(fileList) {
        for (var i = 0; i < fileList.length; i++) {
            if (referenceFiles.length >= MAX_FILES) {
                showToast('Maximum ' + MAX_FILES + ' files allowed', 'error');
                break;
            }
            var file = fileList[i];
            if (file.size > 20 * 1024 * 1024) {
                showToast(escapeHtml(file.name) + ' is too large (max 20MB)', 'error');
                continue;
            }
            var isDuplicate = referenceFiles.some(function (f) { return f.name === file.name; });
            if (isDuplicate) {
                showToast(escapeHtml(file.name) + ' already added', 'error');
                continue;
            }
            referenceFiles.push(file);
        }
        renderFileList();
        // Reset file input so same file can be re-selected
        document.getElementById('msf-file-input').value = '';
    }

    function removeFile(index) {
        referenceFiles.splice(index, 1);
        renderFileList();
    }

    function renderFileList() {
        var previewArea = document.getElementById('msf-file-preview-area');
        if (referenceFiles.length === 0) {
            previewArea.innerHTML = '';
            return;
        }
        var html = '';
        for (var i = 0; i < referenceFiles.length; i++) {
            var f = referenceFiles[i];
            html += '<div class="msf-file-preview">'
                + '<span class="msf-file-preview-name">'
                + '<strong>' + FILE_SLOTS[i].replace('Box_', '').replace('_', ' ') + ':</strong> '
                + escapeHtml(f.name) + ' (' + formatFileSize(f.size) + ')'
                + '</span>'
                + '<span class="msf-file-remove" data-file-index="' + i + '">&times;</span>'
                + '</div>';
        }
        if (referenceFiles.length < MAX_FILES) {
            html += '<div style="font-size:12px;color:#888;margin-top:4px;">'
                + (MAX_FILES - referenceFiles.length) + ' more file' + (MAX_FILES - referenceFiles.length > 1 ? 's' : '') + ' can be added'
                + '</div>';
        }
        previewArea.innerHTML = html;

        // Wire up remove buttons
        previewArea.querySelectorAll('.msf-file-remove').forEach(function (btn) {
            btn.addEventListener('click', function () {
                removeFile(parseInt(btn.dataset.fileIndex));
            });
        });
    }

    // ── Validation ─────────────────────────────────────────────────────────
    function validate() {
        var valid = true;

        // Company Name — always required
        var companyName = document.getElementById('msf-company').value.trim();
        if (!companyName) {
            document.getElementById('msf-company').classList.add('msf-error');
            document.getElementById('msf-company-error').style.display = '';
            valid = false;
        } else {
            document.getElementById('msf-company').classList.remove('msf-error');
            document.getElementById('msf-company-error').style.display = 'none';
        }

        // Design Number — required only in Mockup Request mode
        var designNum = document.getElementById('msf-design-number').value.trim();
        if (currentRequestType === 'Mockup Request' && !designNum) {
            document.getElementById('msf-design-number').classList.add('msf-error');
            document.getElementById('msf-design-error').style.display = '';
            valid = false;
        } else {
            document.getElementById('msf-design-number').classList.remove('msf-error');
            document.getElementById('msf-design-error').style.display = 'none';
        }

        // Application Type — at least one checkbox required
        var checkedTypes = document.querySelectorAll('.msf-mockup-type-cb:checked');
        var typeGroup = document.getElementById('msf-mockup-type-group');
        if (checkedTypes.length === 0) {
            if (typeGroup) typeGroup.classList.add('msf-error');
            document.getElementById('msf-type-error').style.display = '';
            valid = false;
        } else {
            if (typeGroup) typeGroup.classList.remove('msf-error');
            document.getElementById('msf-type-error').style.display = 'none';
        }

        // Placement — always required
        var placement = document.getElementById('msf-placement').value;
        if (!placement) {
            document.getElementById('msf-placement').classList.add('msf-error');
            document.getElementById('msf-placement-error').style.display = '';
            valid = false;
        } else {
            document.getElementById('msf-placement').classList.remove('msf-error');
            document.getElementById('msf-placement-error').style.display = 'none';
        }

        return valid;
    }

    // ── Build AE Notes ─────────────────────────────────────────────────────
    function buildAeNotes() {
        var parts = [];

        // Thread colors
        if (selectedThreadColors.length > 0) {
            parts.push('Thread Colors:');
            selectedThreadColors.forEach(function (c, i) {
                parts.push((i + 1) + '. ' + c.Thread_Color + ' (#' + c.Thread_Number + ')');
            });
            parts.push('');
        }

        // Instructions
        var instructions = document.getElementById('msf-instructions').value.trim();
        if (instructions) {
            parts.push('Additional Instructions:');
            parts.push(instructions);
        }

        return parts.join('\n');
    }

    // ── Build Garment Info (backward-compat summary string) ───────────────
    function buildGarmentInfo() {
        var parts = [];
        garmentRows.forEach(function (row, idx) {
            if (row.style || row.color) {
                var desc = (row.style || '?') + ' / ' + (row.color || '?');
                parts.push('Style ' + (idx + 1) + ': ' + desc);
            }
        });
        var fabric = document.getElementById('msf-fabric-type').value;
        if (fabric) parts.push('Fabric: ' + fabric);
        return parts.join('; ');
    }

    // ── Build Size Specs ───────────────────────────────────────────────────
    function buildSizeSpecs() {
        var w = document.getElementById('msf-width').value.trim();
        var h = document.getElementById('msf-height').value.trim();
        if (w && h) return w + '" x ' + h + '"';
        if (w) return w + '" wide';
        if (h) return h + '" tall';
        return '';
    }

    // ── Build Box Folder Name ──────────────────────────────────────────────
    function buildBoxFolderName(designNumber, companyName) {
        if (designNumber) {
            return designNumber + ' ' + companyName;
        }
        return 'NEW ' + companyName;
    }

    // ── Submit ─────────────────────────────────────────────────────────────
    function handleSubmit() {
        if (!validate()) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        var btn = document.getElementById('msf-submit-btn');
        var statusEl = document.getElementById('msf-submit-status');
        btn.disabled = true;
        statusEl.textContent = 'Submitting...';

        var designNumber = document.getElementById('msf-design-number').value.trim();
        var companyName = document.getElementById('msf-company').value.trim();
        var folderName = buildBoxFolderName(designNumber, companyName);

        // Step 1: Create Box folder
        statusEl.textContent = 'Creating folder...';

        createBoxFolder(folderName)
            .then(function (folderId) {
                // Step 2: Create mockup record
                statusEl.textContent = 'Creating record...';

                var mockupData = {
                    Design_Number: designNumber,
                    Design_Name: document.getElementById('msf-design-name').value.trim(),
                    Company_Name: companyName,
                    Id_Customer: parseInt(document.getElementById('msf-customer-id').value) || 0,
                    Mockup_Type: Array.from(document.querySelectorAll('.msf-mockup-type-cb:checked')).map(function(cb) { return cb.value; }).join(', '),
                    Print_Location: document.getElementById('msf-placement').value,
                    Garment_Info: buildGarmentInfo(),
                    Garment_Style_1: garmentRows[0] ? garmentRows[0].style : '',
                    Garment_Color_1: garmentRows[0] ? garmentRows[0].color : '',
                    Garment_Style_2: garmentRows[1] ? garmentRows[1].style : '',
                    Garment_Color_2: garmentRows[1] ? garmentRows[1].color : '',
                    Garment_Style_3: garmentRows[2] ? garmentRows[2].style : '',
                    Garment_Color_3: garmentRows[2] ? garmentRows[2].color : '',
                    Garment_Style_4: garmentRows[3] ? garmentRows[3].style : '',
                    Garment_Color_4: garmentRows[3] ? garmentRows[3].color : '',
                    // Save dimensions to Logo_Width / Logo_Height (same fields Ruth edits
                    // inline on the detail page). Keeps Size_Specs populated too for
                    // back-compat with any legacy reports that read it.
                    Logo_Width: (document.getElementById('msf-width').value || '').trim(),
                    Logo_Height: (document.getElementById('msf-height').value || '').trim(),
                    Size_Specs: buildSizeSpecs(),
                    Due_Date: document.getElementById('msf-due-date').value || null,
                    Work_Order_Number: document.getElementById('msf-work-order').value.trim(),
                    AE_Notes: buildAeNotes(),
                    Submitted_By: getSubmitterEmail(),
                    Sales_Rep: document.getElementById('msf-sales-rep').value.trim(),
                    Request_Type: currentRequestType,
                    Box_Folder_ID: folderId || '',
                    Is_Rush: !!isRush,
                    Rush_Requested_At: isRush ? new Date().toISOString() : null
                };

                return fetch(API_BASE + '/api/mockups', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mockupData)
                });
            })
            .then(function (resp) {
                if (!resp.ok) throw new Error('Failed to create mockup record');
                return resp.json();
            })
            .then(function (result) {
                var newId = result.record && result.record.ID;

                // Step 3: Upload reference files (if any)
                if (referenceFiles.length > 0 && newId) {
                    statusEl.textContent = 'Uploading files...';
                    return uploadReferenceFiles(newId, folderName, designNumber).then(function () { return newId; });
                }
                return newId;
            })
            .then(function (newId) {
                // Step 4: Add AE instruction note
                var aeNotes = buildAeNotes();
                if (aeNotes && newId) {
                    fetch(API_BASE + '/api/mockup-notes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            Mockup_ID: parseInt(newId),
                            Author: getSubmitterEmail(),
                            Author_Name: getSubmitterName(),
                            Note_Text: aeNotes,
                            Note_Type: 'ae_instruction'
                        })
                    }).catch(function () {});
                }

                // Step 5: Notify Ruth via EmailJS
                if (typeof emailjs !== 'undefined') {
                    try {
                        emailjs.init('4qSbDO-SQs19TbP80');
                        emailjs.send('service_jgrave3', 'template_art_note_added', {
                            to_email: 'ruth@nwcustomapparel.com',
                            to_name: 'Ruth',
                            design_id: designNumber || 'NEW',
                            company_name: companyName,
                            note_text: 'New ' + currentRequestType + ' submitted for ' + companyName,
                            note_type: 'New Submission',
                            detail_link: SITE_ORIGIN + '/mockup/' + (newId || ''),
                            from_name: getSubmitterName()
                        }).catch(function () {});

                        // Confirmation email to submitting sales rep
                        var submitterEmail = getSubmitterEmail();
                        var submitterName = getSubmitterName();
                        if (submitterEmail && submitterEmail !== 'ruth@nwcustomapparel.com') {
                            emailjs.send('service_jgrave3', 'template_art_note_added', {
                                to_email: submitterEmail,
                                to_name: submitterName,
                                design_id: designNumber || 'NEW',
                                company_name: companyName,
                                note_text: 'Your ' + currentRequestType + ' request for ' + companyName + ' has been submitted to Ruth.',
                                note_type: 'Submission Confirmation',
                                detail_link: SITE_ORIGIN + '/mockup/' + (newId || '') + '?view=ae',
                                from_name: 'NWCA Art Department'
                            }).catch(function () {});
                        }
                    } catch (e) { /* silent */ }
                }

                // Step 5b: Rush confirmation email (if rush)
                if (isRush && window.ArtActions && typeof window.ArtActions.sendRushConfirmation === 'function') {
                    var aeEmail = getSubmitterEmail();
                    var salesRepVal = document.getElementById('msf-sales-rep').value.trim();
                    var salesRepEmail = '';
                    if (window.ArtActions.resolveRep && salesRepVal) {
                        var resolved = window.ArtActions.resolveRep(salesRepVal);
                        salesRepEmail = resolved && resolved.email ? resolved.email : '';
                    }
                    window.ArtActions.sendRushConfirmation({
                        designId: newId,
                        designName: document.getElementById('msf-design-name').value.trim() || designNumber || 'NEW',
                        company: companyName,
                        recipient: 'Ruth',
                        aeName: getSubmitterName(),
                        aeEmail: aeEmail,
                        salesRepEmail: salesRepEmail,
                        detailPath: '/mockup/' + (newId || '') + '?view=ae'
                    });
                }

                // Step 6: Show success
                showSuccess(newId);
            })
            .catch(function (err) {
                console.error('Submit error:', err);
                showToast('Submission failed: ' + err.message, 'error');
                btn.disabled = false;
                statusEl.textContent = '';
            });
    }

    function createBoxFolder(folderName) {
        return fetch(API_BASE + '/api/box/create-mockup-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyName: folderName })
        })
        .then(function (resp) {
            if (!resp.ok) return null;
            return resp.json();
        })
        .then(function (data) {
            return data && data.folderId ? data.folderId : null;
        })
        .catch(function () { return null; });
    }

    function uploadReferenceFiles(mockupId, folderName, designNumber) {
        var uploads = [];
        var failedFiles = [];

        for (var i = 0; i < referenceFiles.length; i++) {
            uploads.push({ file: referenceFiles[i], slot: FILE_SLOTS[i], index: i });
        }

        // Upload sequentially to avoid overwhelming the server
        function uploadNext(idx) {
            if (idx >= uploads.length) {
                if (failedFiles.length > 0) {
                    showToast(failedFiles.length + ' file(s) failed to upload', 'error');
                }
                return Promise.resolve();
            }

            var u = uploads[idx];
            var statusEl = document.getElementById('msf-submit-status');
            if (statusEl) {
                statusEl.textContent = 'Uploading file ' + (idx + 1) + ' of ' + uploads.length + '...';
            }

            var formData = new FormData();
            formData.append('file', u.file);
            formData.append('slot', u.slot);
            formData.append('companyName', folderName);
            if (designNumber) {
                formData.append('designNumber', designNumber);
            }

            return fetch(API_BASE + '/api/mockups/' + mockupId + '/upload-file', {
                method: 'POST',
                body: formData
            }).then(function (resp) {
                if (!resp.ok) {
                    return resp.text().then(function (body) {
                        console.error('File upload failed:', u.file.name, resp.status, body);
                        failedFiles.push(u.file.name);
                    });
                }
            }).catch(function (err) {
                console.error('File upload error:', u.file.name, err);
                failedFiles.push(u.file.name);
            }).then(function () {
                return uploadNext(idx + 1);
            });
        }

        return uploadNext(0);
    }

    // ── Success State ──────────────────────────────────────────────────────
    function showSuccess(mockupId) {
        var body = document.getElementById('msf-form-body');
        body.innerHTML = '<div class="msf-success">'
            + '<div class="msf-success-icon">&#9989;</div>'
            + '<h3>Request Submitted Successfully!</h3>'
            + '<p>Your digitizing/mockup request has been sent to Ruth. '
            + 'She will be notified and begin working on it.</p>'
            + (mockupId ? '<a href="/mockup/' + mockupId + '?view=ae" class="msf-success-link">View Mockup Details &rarr;</a>' : '')
            + '<button type="button" class="msf-success-another" id="msf-another-btn">Submit Another</button>'
            + '</div>';

        document.getElementById('msf-another-btn').addEventListener('click', function () {
            resetForm();
        });
    }

    // ── Reset Form ─────────────────────────────────────────────────────────
    function resetForm() {
        selectedThreadColors = [];
        referenceFiles = [];
        selectedContact = null;
        currentRequestType = 'New Digitizing';
        garmentRows = [{ style: '', color: '', colors: [], swatch: '' }];

        var container = document.getElementById(containerId);
        container.innerHTML = buildFormHtml();
        wireEvents();
        initToggle();
        initCompanyAutocomplete();
        initSalesRep();
        loadLocations();
        renderGarmentRows();
        // Thread colors already cached in allThreadColors
    }

    // ── Helpers ─────────────────────────────────────────────────────────────
    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function getSubmitterEmail() {
        if (typeof StaffAuthHelper !== 'undefined') {
            var email = StaffAuthHelper.getLoggedInStaffEmail();
            if (email) return email;
        }
        if (window.APP_CONFIG && window.APP_CONFIG.USER && window.APP_CONFIG.USER.email) {
            return window.APP_CONFIG.USER.email;
        }
        return localStorage.getItem('userEmail') || 'ae@nwcustomapparel.com';
    }

    function getSubmitterName() {
        if (typeof StaffAuthHelper !== 'undefined') {
            var name = StaffAuthHelper.getLoggedInStaffName();
            if (name) return name;
        }
        if (window.APP_CONFIG && window.APP_CONFIG.USER && window.APP_CONFIG.USER.name) {
            return window.APP_CONFIG.USER.name;
        }
        var email = getSubmitterEmail();
        var atIdx = email.indexOf('@');
        var name = atIdx > 0 ? email.substring(0, atIdx) : email;
        return name.charAt(0).toUpperCase() + name.slice(1);
    }

    function showToast(message, type) {
        type = type || 'info';
        document.querySelectorAll('.msf-toast').forEach(function (t) { t.remove(); });

        var toast = document.createElement('div');
        toast.className = 'msf-toast msf-toast--' + type;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(function () { toast.classList.add('show'); });
        setTimeout(function () {
            toast.classList.remove('show');
            setTimeout(function () { toast.remove(); }, 300);
        }, 3000);
    }

    // ── Public API ──────────────────────────────────────────────────────────
    return { init: init };

})();
