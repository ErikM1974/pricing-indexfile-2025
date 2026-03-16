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

    // ── State ──────────────────────────────────────────────────────────────
    var containerId = null;
    var selectedThreadColors = [];
    var referenceFile = null;
    var allThreadColors = [];
    var allLocations = [];
    var currentRequestType = 'New Digitizing'; // or 'Mockup Request'
    var customerLookup = null;
    var selectedContact = null;

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

            // Mockup Type + Placement
            + '    <div class="msf-row">'
            + '      <div class="msf-field">'
            + '        <label class="msf-field-label">Mockup Type <span class="msf-required">*</span></label>'
            + '        <select class="msf-select" id="msf-mockup-type">'
            + '          <option value="">Select type...</option>'
            + '          <option value="Embroidery">Embroidery</option>'
            + '          <option value="Cap">Cap</option>'
            + '          <option value="Jacket">Jacket</option>'
            + '          <option value="Shirt">Shirt</option>'
            + '          <option value="Polo">Polo</option>'
            + '          <option value="Other">Other</option>'
            + '        </select>'
            + '        <span class="msf-error-msg" id="msf-type-error">Mockup type is required</span>'
            + '      </div>'
            + '      <div class="msf-field">'
            + '        <label class="msf-field-label">Placement <span class="msf-required">*</span></label>'
            + '        <select class="msf-select" id="msf-placement">'
            + '          <option value="">Loading locations...</option>'
            + '        </select>'
            + '        <span class="msf-error-msg" id="msf-placement-error">Placement is required</span>'
            + '      </div>'
            + '    </div>'

            // Garment Info + Fabric Type
            + '    <div class="msf-row">'
            + '      <div class="msf-field">'
            + '        <label class="msf-field-label">Garment/Cap Colors</label>'
            + '        <input type="text" class="msf-input" id="msf-garment-colors" placeholder="e.g., Navy Blue, Black">'
            + '      </div>'
            + '      <div class="msf-field">'
            + '        <label class="msf-field-label">Fabric/Garment Type</label>'
            + '        <select class="msf-select" id="msf-fabric-type">'
            + '          <option value="">Select type...</option>'
            + '          <option value="Twill">Twill</option>'
            + '          <option value="Pique">Pique</option>'
            + '          <option value="Fleece">Fleece</option>'
            + '          <option value="Knit">Knit</option>'
            + '          <option value="Nylon">Nylon</option>'
            + '          <option value="Cotton">Cotton</option>'
            + '          <option value="Polyester">Polyester</option>'
            + '          <option value="Other">Other</option>'
            + '        </select>'
            + '      </div>'
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

            // File Upload
            + '    <div class="msf-field">'
            + '      <label class="msf-field-label">Reference File</label>'
            + '      <div class="msf-file-drop" id="msf-file-drop">'
            + '        <div class="msf-file-drop-icon">&#128206;</div>'
            + '        <div>Click to upload or drag &amp; drop</div>'
            + '        <div style="font-size:12px;color:#aaa;margin-top:4px;">.DST, .EMB, .AI, .EPS, .PDF, images (max 20MB)</div>'
            + '      </div>'
            + '      <input type="file" id="msf-file-input" style="display:none;" accept="image/*,.pdf,.dst,.emb,.eps,.ai,.svg">'
            + '      <div id="msf-file-preview-area"></div>'
            + '    </div>'

            // Submit
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
                document.getElementById('msf-customer-id').value = contact.ID_Contact || '';

                // Clear error state
                document.getElementById('msf-company').classList.remove('msf-error');
                document.getElementById('msf-company-error').style.display = 'none';
            },
            onClear: function () {
                selectedContact = null;
                document.getElementById('msf-customer-id').value = '';
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

    // ── Wire Events ────────────────────────────────────────────────────────
    function wireEvents() {
        // Close dropdowns on outside click
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.msf-thread-picker')) hideThreadDropdown();
        });

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
                setReferenceFile(fileInput.files[0]);
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
                setReferenceFile(e.dataTransfer.files[0]);
            }
        });

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
                    + '<option value="Left Chest">Left Chest</option>'
                    + '<option value="Full Back">Full Back</option>'
                    + '<option value="Right Chest">Right Chest</option>'
                    + '<option value="Cap Front">Cap Front</option>'
                    + '<option value="Cap Back">Cap Back</option>'
                    + '<option value="Left Side">Left Side</option>'
                    + '<option value="Right Side">Right Side</option>'
                    + '<option value="Monogram">Monogram</option>';
            });
    }

    // ── Load Thread Colors ─────────────────────────────────────────────────
    function loadThreadColors() {
        fetch(API_BASE + '/api/thread-colors?instock=true')
            .then(function (r) { return r.ok ? r.json() : { colors: [] }; })
            .then(function (data) {
                allThreadColors = data.colors || [];
                // Update hint with actual count
                var hint = document.querySelector('.msf-field-hint');
                if (hint && allThreadColors.length > 0) {
                    hint.textContent = 'Type to search from ' + allThreadColors.length + ' Robison Anton thread colors';
                }
            })
            .catch(function () {
                allThreadColors = [];
            });
    }

    function filterThreadColors(query) {
        var dropdown = document.getElementById('msf-thread-dropdown');
        dropdown.style.display = 'block';
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

    // ── File Upload ────────────────────────────────────────────────────────
    function setReferenceFile(file) {
        if (file.size > 20 * 1024 * 1024) {
            showToast('File too large (max 20MB)', 'error');
            return;
        }
        referenceFile = file;

        var previewArea = document.getElementById('msf-file-preview-area');
        previewArea.innerHTML = '<div class="msf-file-preview">'
            + '<span class="msf-file-preview-name">' + escapeHtml(file.name) + ' (' + formatFileSize(file.size) + ')</span>'
            + '<span class="msf-file-remove" id="msf-file-remove">&times;</span>'
            + '</div>';

        document.getElementById('msf-file-remove').addEventListener('click', function () {
            referenceFile = null;
            previewArea.innerHTML = '';
            document.getElementById('msf-file-input').value = '';
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

        // Mockup Type — always required
        var mockupType = document.getElementById('msf-mockup-type').value;
        if (!mockupType) {
            document.getElementById('msf-mockup-type').classList.add('msf-error');
            document.getElementById('msf-type-error').style.display = '';
            valid = false;
        } else {
            document.getElementById('msf-mockup-type').classList.remove('msf-error');
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

    // ── Build Garment Info ─────────────────────────────────────────────────
    function buildGarmentInfo() {
        var colors = document.getElementById('msf-garment-colors').value.trim();
        var fabric = document.getElementById('msf-fabric-type').value;
        var parts = [];
        if (colors) parts.push(colors);
        if (fabric) parts.push(fabric);
        return parts.join(' — ');
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
                    Mockup_Type: document.getElementById('msf-mockup-type').value,
                    Print_Location: document.getElementById('msf-placement').value,
                    Garment_Info: buildGarmentInfo(),
                    Size_Specs: buildSizeSpecs(),
                    Due_Date: document.getElementById('msf-due-date').value || null,
                    Work_Order_Number: document.getElementById('msf-work-order').value.trim(),
                    AE_Notes: buildAeNotes(),
                    Submitted_By: getSubmitterEmail(),
                    Sales_Rep: document.getElementById('msf-sales-rep').value.trim(),
                    Request_Type: currentRequestType,
                    Box_Folder_ID: folderId || ''
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

                // Step 3: Upload reference file (if any)
                if (referenceFile && newId) {
                    statusEl.textContent = 'Uploading file...';
                    return uploadReferenceFile(newId, folderName, designNumber).then(function () { return newId; });
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

                // Step 5: Show success
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

    function uploadReferenceFile(mockupId, folderName, designNumber) {
        var formData = new FormData();
        formData.append('file', referenceFile);
        formData.append('slot', 'Box_Reference_File');
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
                    console.error('File upload failed:', resp.status, body);
                    showToast('File upload failed — record was created but file was not attached', 'error');
                });
            }
        });
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
        referenceFile = null;
        selectedContact = null;
        currentRequestType = 'New Digitizing';

        var container = document.getElementById(containerId);
        container.innerHTML = buildFormHtml();
        wireEvents();
        initToggle();
        initCompanyAutocomplete();
        initSalesRep();
        loadLocations();
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
