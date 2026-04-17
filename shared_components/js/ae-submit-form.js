/**
 * ae-submit-form.js -- Enhancement layer for AE Submit Art Caspio DataPage
 *
 * Extracted from Caspio DataPage PageFooter (Rule #3 compliance).
 * Handles: swatch management, model image management, row numbering,
 * MutationObservers for cascading field changes, form submission notification.
 *
 * Runs inside ae-dashboard.html host page (#submit-tab).
 * Caspio handles: cascading lookups, file uploads, auth, form submission.
 *
 * Depends on: ae-submit-form.css (form styles), art-hub.css (shared styles)
 */
(function () {
    'use strict';

    // ── Config ─────────────────────────────────────────────────────
    const FIELD_PAIRS = [
        ['CompanyName', 'Shopwork_customer_number'],
        ['First_name', 'Last_name'],
        ['Design_Num_SW', 'Order_Num_SW'],
        ['Prelim_Charges', 'Additional_Services']
    ];

    // Order Type + Due Date need label-text lookup since Caspio name varies
    const LABEL_FIELD_PAIRS = [
        ['Order Type', 'Due Date']
    ];

    const SWATCH_CONFIGS = [
        { swatchField: 'InsertRecordSwatch_1', imageField: 'InsertRecordMAIN_IMAGE_URL_1', number: 1 },
        { swatchField: 'InsertRecordSwatch_2', imageField: 'InsertRecordMAIN_IMAGE_URL_2', number: 2 },
        { swatchField: 'InsertRecordSwatch_3', imageField: 'InsertRecordMAIN_IMAGE_URL_3', number: 3 },
        { swatchField: 'InsertRecordSwatch_4', imageField: 'InsertRecordMAIN_IMAGE_URL_4', number: 4 }
    ];

    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // ── Swatch Management ──────────────────────────────────────────

    function updateColorSwatch(swatchFieldName, swatchNumber) {
        var swatchInput = document.querySelector('input[name="' + swatchFieldName + '"]');
        if (!swatchInput) return;

        var existingImg = swatchInput.parentNode.querySelector('.micro-swatch');

        if (existingImg) {
            if (swatchInput.value && swatchInput.value.trim() !== '') {
                existingImg.src = swatchInput.value;
                existingImg.style.display = 'inline-block';
            } else {
                existingImg.style.display = 'none';
            }
        } else {
            var img = document.createElement('img');
            img.className = 'micro-swatch';
            img.alt = 'Swatch ' + swatchNumber;
            img.title = 'Click to view larger';

            if (swatchInput.value && swatchInput.value.trim() !== '') {
                img.src = swatchInput.value;
                img.style.display = 'inline-block';
            } else {
                img.style.display = 'none';
            }

            img.onerror = function () { this.style.display = 'none'; };
            img.addEventListener('click', function () { showLightbox(this.src); });
            swatchInput.parentNode.appendChild(img);
        }
    }

    // ── Model Image Management ─────────────────────────────────────

    function updateModelImage(imageFieldName, imageNumber) {
        var imageInput = document.querySelector('input[name="' + imageFieldName + '"]');
        if (!imageInput) return;

        var existingImg = imageInput.parentNode.querySelector('.model-thumbnail');

        if (existingImg) {
            if (imageInput.value && imageInput.value.trim() !== '') {
                existingImg.src = imageInput.value;
                existingImg.style.display = 'inline-block';
            } else {
                existingImg.style.display = 'none';
            }
        } else {
            var img = document.createElement('img');
            img.className = 'model-thumbnail';
            img.alt = 'Model ' + imageNumber;
            img.title = 'Click to view larger';

            if (imageInput.value && imageInput.value.trim() !== '') {
                img.src = imageInput.value;
                img.style.display = 'inline-block';
            } else {
                img.style.display = 'none';
            }

            img.onerror = function () { this.style.display = 'none'; };
            img.addEventListener('click', function () { showLightbox(this.src); });
            imageInput.parentNode.appendChild(img);
        }
    }

    // ── Lightbox ───────────────────────────────────────────────────

    function showLightbox(src) {
        var overlay = document.createElement('div');
        overlay.className = 'ae-submit-lightbox';
        overlay.innerHTML = '<img src="' + src + '" alt="Enlarged view">';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function () {
            document.body.removeChild(overlay);
        });
    }

    // ── Row Numbering ──────────────────────────────────────────────

    function addRowNumbers() {
        for (var i = 1; i <= 4; i++) {
            var styleInput = document.querySelector('input[placeholder="Style ' + i + '"]');
            if (!styleInput || styleInput.parentNode.querySelector('.row-number-badge')) continue;

            var badge = document.createElement('span');
            badge.className = 'row-number-badge';
            badge.textContent = i;
            styleInput.parentNode.insertBefore(badge, styleInput);
        }
    }

    // ── Monitor All Swatches & Images ──────────────────────────────

    function monitorAllSwatchesAndImages() {
        SWATCH_CONFIGS.forEach(function (config) {
            updateColorSwatch(config.swatchField, config.number);
            updateModelImage(config.imageField, config.number);

            // Observe swatch input value changes (Caspio cascading)
            observeInputValue(config.swatchField, function () {
                updateColorSwatch(config.swatchField, config.number);
            });

            // Observe model image input value changes
            observeInputValue(config.imageField, function () {
                updateModelImage(config.imageField, config.number);
            });
        });
    }

    function observeInputValue(fieldName, callback) {
        var input = document.querySelector('input[name="' + fieldName + '"]');
        if (!input || input._aeObserved) return;
        input._aeObserved = true;

        var observer = new MutationObserver(function () { callback(); });
        observer.observe(input, { attributes: true, attributeFilter: ['value'] });
        input.addEventListener('change', callback);
    }

    // ── Color Dropdown Change Handlers ─────────────────────────────

    function attachColorDropdownListeners() {
        var colorDropdowns = document.querySelectorAll('select[name*="Color"]');
        colorDropdowns.forEach(function (dropdown) {
            if (dropdown._aeListened) return;
            dropdown._aeListened = true;
            dropdown.addEventListener('change', function () {
                setTimeout(monitorAllSwatchesAndImages, 500);
            });
        });

        var styleFields = document.querySelectorAll('input[name*="Style"]');
        styleFields.forEach(function (field) {
            if (field._aeListened) return;
            field._aeListened = true;
            field.addEventListener('change', function () {
                setTimeout(monitorAllSwatchesAndImages, 700);
            });
            field.addEventListener('blur', function () {
                setTimeout(monitorAllSwatchesAndImages, 700);
            });
        });
    }

    // ── Form Submission Detection & Notification ────────────────────

    function watchForFormSubmission() {
        var submitTab = document.getElementById('submit-tab');
        if (!submitTab) return;

        var submitObserver = new MutationObserver(function (mutations) {
            for (var m = 0; m < mutations.length; m++) {
                var addedNodes = mutations[m].addedNodes;
                for (var n = 0; n < addedNodes.length; n++) {
                    var node = addedNodes[n];
                    if (node.nodeType !== 1) continue;
                    // Caspio replaces the form with confirmation HTML on success
                    // Look for the confirmation container with the ID_Design
                    var idElement = node.querySelector && node.querySelector('.id-number');
                    if (idElement) {
                        var designId = idElement.textContent.trim();
                        var companyEl = node.querySelector('.detail-value');
                        var companyName = companyEl ? companyEl.textContent.trim() : 'Unknown';
                        submitObserver.disconnect(); // Stop observing immediately to prevent duplicate fires
                        notifyNewSubmission(designId, companyName);
                        return; // Exit — only one notification per submission
                    }
                }
            }
        });

        submitObserver.observe(submitTab, { childList: true, subtree: true });
    }

    var EMAILJS_SERVICE_ID = 'service_jgrave3';
    var EMAILJS_PUBLIC_KEY = '4qSbDO-SQs19TbP80';
    var SITE_ORIGIN = 'https://www.teamnwca.com';

    // Window-level guard survives IIFE re-initialization (prevents duplicate emails
    // when Caspio reloads the script or cached + fresh versions both run)
    if (!window.__artSubmitNotified) window.__artSubmitNotified = {};

    function notifyNewSubmission(designId, companyName) {
        if (!designId) return;
        if (window.__artSubmitNotified[designId]) return; // prevent duplicate sends
        window.__artSubmitNotified[designId] = true;

        // Rush state captured on submit click (see styleRushCheckbox)
        var wasRush = !!window.__rushStateOnSubmit;
        window.__rushStateOnSubmit = false; // reset for next submission

        // Toast notification (existing)
        fetch(API_BASE + '/api/art-notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'new_submission',
                designId: designId,
                companyName: companyName,
                actorName: 'Sales Rep'
            })
        }).catch(function () { /* fire-and-forget */ });

        // Email notification to Steve
        if (typeof emailjs !== 'undefined') {
            emailjs.init(EMAILJS_PUBLIC_KEY);
            emailjs.send(EMAILJS_SERVICE_ID, 'template_art_note_added', {
                to_email: 'art@nwcustomapparel.com',
                to_name: 'Steve',
                design_id: designId,
                company_name: companyName || 'Unknown',
                note_text: 'New art request submitted for ' + (companyName || 'Unknown') + ' (Design #' + designId + ')',
                note_type: 'New Submission',
                detail_link: SITE_ORIGIN + '/art-request/' + designId,
                from_name: 'AE Dashboard'
            }).catch(function () { /* fire-and-forget */ });

            // Confirmation email to submitting sales rep
            var submitterEmail = '';
            var submitterName = 'Sales Rep';
            if (typeof StaffAuthHelper !== 'undefined') {
                submitterEmail = StaffAuthHelper.getLoggedInStaffEmail() || '';
                submitterName = StaffAuthHelper.getLoggedInStaffName() || 'Sales Rep';
            }
            if (submitterEmail && submitterEmail !== 'art@nwcustomapparel.com') {
                emailjs.send(EMAILJS_SERVICE_ID, 'template_art_note_added', {
                    to_email: submitterEmail,
                    to_name: submitterName,
                    design_id: designId,
                    company_name: companyName || 'Unknown',
                    note_text: 'Your art request for ' + (companyName || 'Unknown') + ' (Design #' + designId + ') has been submitted to Steve.',
                    note_type: 'Submission Confirmation',
                    detail_link: SITE_ORIGIN + '/art-request/' + designId + '?view=ae',
                    from_name: 'NWCA Art Department'
                }).catch(function () { /* fire-and-forget */ });
            }

            // Rush confirmation (extra email when rush was flagged on submit)
            if (wasRush && window.ArtActions && typeof window.ArtActions.sendRushConfirmation === 'function') {
                window.ArtActions.sendRushConfirmation({
                    designId: designId,
                    designName: 'Design #' + designId,
                    company: companyName || 'Unknown',
                    recipient: 'Steve',
                    aeName: submitterName,
                    aeEmail: submitterEmail,
                    salesRepEmail: submitterEmail, // Steve flow: sales rep = submitter
                    detailPath: '/art-request/' + designId + '?view=ae'
                });
            }
        }
    }

    // ── Periodic Image Checks ──────────────────────────────────────

    function startImagePolling() {
        var checkInterval = setInterval(monitorAllSwatchesAndImages, 1000);
        // Stop polling after 30 seconds (Caspio has finished loading by then)
        setTimeout(function () { clearInterval(checkInterval); }, 30000);
    }

    // ── DOM Restructuring ────────────────────────────────────────────

    /**
     * Find the label cell (cbFormLabelCell) for a given input name.
     * Returns the label div element or null.
     */
    function findLabelCellForInput(inputName) {
        var input = document.querySelector('[name="InsertRecord' + inputName + '"]');
        if (!input) return null;
        var fieldCell = input.closest('.cbFormFieldCell');
        if (!fieldCell) return null;
        // Label cell is the previous sibling div with cbFormLabelCell class
        var prev = fieldCell.previousElementSibling;
        while (prev) {
            if (prev.classList && prev.classList.contains('cbFormLabelCell')) return prev;
            prev = prev.previousElementSibling;
        }
        return null;
    }

    /**
     * Find the label cell by label text content.
     */
    function findLabelCellByText(labelText) {
        var labels = document.querySelectorAll('#submit-tab .cbFormLabelCell label');
        for (var i = 0; i < labels.length; i++) {
            if (labels[i].textContent.trim().replace(/\*/g, '').trim() === labelText) {
                return labels[i].closest('.cbFormLabelCell');
            }
        }
        return null;
    }

    /**
     * Wrap two label+field pairs into a .field-pair grid container.
     * Each pair becomes a .field-group (label stacked above input) in a 2-column grid.
     */
    function wrapFieldPair(labelA, labelB) {
        if (!labelA || !labelB) return;
        var fieldA = labelA.nextElementSibling;
        var fieldB = labelB.nextElementSibling;
        if (!fieldA || !fieldB) return;

        // Ensure the field cells are actually field cells
        if (!fieldA.classList.contains('cbFormFieldCell') && !fieldA.classList.contains('cbFormDataCell')) return;
        if (!fieldB.classList.contains('cbFormFieldCell') && !fieldB.classList.contains('cbFormDataCell')) return;

        var wrapper = document.createElement('div');
        wrapper.className = 'field-pair';

        var groupA = document.createElement('div');
        groupA.className = 'field-group';
        var groupB = document.createElement('div');
        groupB.className = 'field-group';

        // Insert wrapper before the first label
        labelA.parentNode.insertBefore(wrapper, labelA);

        // Move label+field into groups
        groupA.appendChild(labelA);
        groupA.appendChild(fieldA);
        groupB.appendChild(labelB);
        groupB.appendChild(fieldB);

        wrapper.appendChild(groupA);
        wrapper.appendChild(groupB);
    }

    /**
     * Add spacing classes to section headers for visual grouping.
     * Instead of wrapping in cards (which causes nesting issues with Caspio DOM),
     * we add margin/padding via CSS classes directly.
     */
    function styleSectionGroups() {
        var form = document.querySelector('#submit-tab #caspioform');
        if (!form) return;
        var section = form.querySelector('section[class*="cbFormSection"]');
        if (!section) return;

        // Add a class to the section so CSS can style it
        section.classList.add('ae-form-section');
    }

    /**
     * Style file upload inputs with upload zone wrappers.
     */
    function styleFileUploads() {
        var fileInputs = document.querySelectorAll('#submit-tab input[type="file"]');
        fileInputs.forEach(function (input) {
            if (input.closest('.file-upload-zone')) return; // already styled

            var fieldCell = input.closest('.cbFormFieldCell');
            if (!fieldCell) return;

            // Find associated label
            var labelCell = fieldCell.previousElementSibling;
            var labelText = '';
            if (labelCell && labelCell.classList.contains('cbFormLabelCell')) {
                var label = labelCell.querySelector('label');
                labelText = label ? label.textContent.trim() : '';
            }

            var zone = document.createElement('div');
            zone.className = 'file-upload-zone';

            // Upload icon
            var icon = document.createElement('span');
            icon.className = 'upload-icon';
            icon.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
            zone.appendChild(icon);

            // Label
            if (labelText) {
                var lbl = document.createElement('span');
                lbl.className = 'upload-label';
                lbl.textContent = labelText;
                zone.appendChild(lbl);
            }

            // Wrap the file input
            input.parentNode.insertBefore(zone, input);
            zone.appendChild(input);

            // Hide the original Caspio label cell
            if (labelCell && labelCell.classList.contains('cbFormLabelCell')) {
                labelCell.style.display = 'none';
            }

            // Click zone to trigger file input
            zone.addEventListener('click', function (e) {
                if (e.target !== input) input.click();
            });
        });
    }

    /**
     * Group garment fields into card rows.
     * Each row: Style input + Color select + (hidden swatch/image fields with thumbnails)
     */
    function wrapGarmentRows() {
        for (var i = 1; i <= 4; i++) {
            var styleName = i === 1 ? 'GarmentStyle' : 'Garm_Style_' + i;
            var colorName = i === 1 ? 'GarmentColor' : 'Garm_Color_' + i;
            var swatchName = 'Swatch_' + i;
            var imageName = 'MAIN_IMAGE_URL_' + i;

            var styleInput = document.querySelector('[name="InsertRecord' + styleName + '"]');
            var colorSelect = document.querySelector('[name="InsertRecord' + colorName + '"]');
            if (!styleInput || !colorSelect) continue;

            var styleCell = styleInput.closest('.cbFormFieldCell');
            var colorCell = colorSelect.closest('.cbFormFieldCell');
            if (!styleCell || !colorCell) continue;

            // Already wrapped?
            if (styleInput.closest('.garment-row-card')) continue;

            var card = document.createElement('div');
            card.className = 'garment-row-card';

            // Insert card before the style cell
            styleCell.parentNode.insertBefore(card, styleCell);

            // Add row badge
            var badge = document.createElement('span');
            badge.className = 'row-number-badge';
            badge.textContent = i;
            card.appendChild(badge);

            // Move style input directly (not the cell wrapper)
            card.appendChild(styleInput);

            // Move color select directly
            card.appendChild(colorSelect);

            // Move swatch field cell (hidden input + thumbnail will be appended later)
            var swatchInput = document.querySelector('[name="InsertRecord' + swatchName + '"]');
            if (swatchInput) {
                var swatchCell = swatchInput.closest('.cbFormFieldCell');
                if (swatchCell) card.appendChild(swatchCell);
            }

            // Move image field cell
            var imageInput = document.querySelector('[name="InsertRecord' + imageName + '"]');
            if (imageInput) {
                var imageCell = imageInput.closest('.cbFormFieldCell');
                if (imageCell) card.appendChild(imageCell);
            }

            // Hide the now-empty original cells and their label cells
            if (styleCell.childNodes.length === 0) styleCell.style.display = 'none';
            if (colorCell.childNodes.length === 0) colorCell.style.display = 'none';

            // Hide orphaned label cells for style, color, swatch, image fields
            [styleName, colorName, swatchName, imageName].forEach(function (name) {
                var labelCell = findLabelCellForInput(name);
                if (labelCell) labelCell.style.display = 'none';
            });

            // Hide ALL orphaned label/field cells between garment cards
            var sib = card.nextElementSibling;
            while (sib && !sib.classList.contains('garment-row-card') &&
                   !sib.classList.contains('cbHTMLBlockContainer') &&
                   !sib.classList.contains('cbFormNestedTableContainer') &&
                   !sib.classList.contains('file-upload-zone')) {
                if (sib.classList.contains('cbFormLabelCell') || sib.classList.contains('cbFormFieldCell')) {
                    sib.style.display = 'none';
                }
                sib = sib.nextElementSibling;
            }
        }
    }

    /**
     * Replace <input type="submit"> with a <button> so we can add an SVG icon.
     * <input> is a void element and cannot render child nodes.
     */
    function enhanceSubmitButton() {
        var input = document.querySelector('#submit-tab .cbSubmitButton');
        if (!input || input._aeEnhanced) return;
        input._aeEnhanced = true;

        // Only replace if it's an <input> (void element)
        if (input.tagName !== 'INPUT') return;

        var button = document.createElement('button');
        button.type = 'submit';
        button.className = input.className;
        button.name = input.name;

        // Paper-plane SVG icon
        button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> SUBMIT';

        input.parentNode.replaceChild(button, input);
    }

    // ── Custom Product Detection (Non-SanMar) ─────────────────────

    // Store original <select> elements so we can restore them
    var _originalColorSelects = {};

    /**
     * Check if a color <select> has real options (beyond empty placeholder).
     */
    function hasColorOptions(selectEl) {
        if (!selectEl || selectEl.tagName !== 'SELECT') return false;
        var opts = selectEl.options;
        for (var j = 0; j < opts.length; j++) {
            if (opts[j].value && opts[j].value.trim() !== '') return true;
        }
        return false;
    }

    /**
     * Enter custom product mode for a garment row.
     * Shows amber "Custom" badge and replaces empty <select> with text <input>.
     */
    function triggerCustomMode(card, rowNum) {
        if (card.classList.contains('custom-product')) return; // already in custom mode
        card.classList.add('custom-product');

        // Insert amber badge after the row-number-badge
        var rowBadge = card.querySelector('.row-number-badge');
        var customBadge = document.createElement('span');
        customBadge.className = 'custom-badge';
        customBadge.textContent = 'Custom';
        if (rowBadge && rowBadge.nextSibling) {
            card.insertBefore(customBadge, rowBadge.nextSibling);
        } else {
            card.appendChild(customBadge);
        }

        // Find the color <select> inside the card
        var colorName = rowNum === 1 ? 'GarmentColor' : 'Garm_Color_' + rowNum;
        var colorSelect = card.querySelector('select[name="InsertRecord' + colorName + '"]');
        if (colorSelect) {
            // Save reference to original select
            _originalColorSelects[rowNum] = colorSelect;

            // Create replacement text input with same name
            var textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.name = colorSelect.name;
            textInput.className = 'cbFormTextField';
            textInput.placeholder = 'Type color...';
            card.replaceChild(textInput, colorSelect);
        }

        // Hide swatch/image cells (won't have data for custom products)
        var fieldCells = card.querySelectorAll('.cbFormFieldCell');
        fieldCells.forEach(function (cell) { cell.style.display = 'none'; });
    }

    /**
     * Exit custom product mode — restore original <select> and remove badge.
     */
    function exitCustomMode(card, rowNum) {
        if (!card.classList.contains('custom-product')) return;
        card.classList.remove('custom-product');

        // Remove custom badge
        var badge = card.querySelector('.custom-badge');
        if (badge) badge.remove();

        // Restore original <select> if we have it
        var originalSelect = _originalColorSelects[rowNum];
        if (originalSelect) {
            var colorName = rowNum === 1 ? 'GarmentColor' : 'Garm_Color_' + rowNum;
            var textInput = card.querySelector('input[name="InsertRecord' + colorName + '"]');
            if (textInput) {
                card.replaceChild(originalSelect, textInput);
            }
            delete _originalColorSelects[rowNum];
        }

        // Show swatch/image cells again
        var fieldCells = card.querySelectorAll('.cbFormFieldCell');
        fieldCells.forEach(function (cell) { cell.style.display = ''; });
    }

    /**
     * Monitor garment style fields for cascade results.
     * After AE blurs a style input, wait for Caspio cascade, then check color options.
     */
    function monitorGarmentCascade() {
        for (var i = 1; i <= 4; i++) {
            (function (rowNum) {
                var styleName = rowNum === 1 ? 'GarmentStyle' : 'Garm_Style_' + rowNum;
                var colorName = rowNum === 1 ? 'GarmentColor' : 'Garm_Color_' + rowNum;

                var styleInput = document.querySelector('[name="InsertRecord' + styleName + '"]');
                if (!styleInput || styleInput._aeCascadeMonitored) return;
                styleInput._aeCascadeMonitored = true;

                styleInput.addEventListener('blur', function () {
                    var styleValue = styleInput.value.trim();
                    var card = styleInput.closest('.garment-row-card');
                    if (!card) return;

                    if (!styleValue) {
                        // Style cleared — exit custom mode if active
                        exitCustomMode(card, rowNum);
                        return;
                    }

                    // Wait for Caspio cascade to fire and populate color dropdown
                    setTimeout(function () {
                        var colorSelect = card.querySelector('select[name="InsertRecord' + colorName + '"]');

                        if (colorSelect && hasColorOptions(colorSelect)) {
                            // SanMar product found — normal mode
                            exitCustomMode(card, rowNum);
                        } else if (!colorSelect && card.classList.contains('custom-product')) {
                            // Already in custom mode (text input replaced select), stay there
                        } else {
                            // No options — enter custom mode
                            triggerCustomMode(card, rowNum);
                        }
                    }, 1500);
                });
            })(i);
        }
    }

    /**
     * Main restructuring entry point — called on DataPageReady.
     * Guard prevents double-execution (Caspio fires DataPageReady per DataPage).
     */
    function restructureFormLayout() {
        var form = document.querySelector('#submit-tab #caspioform');
        if (!form || form._aeRestructured) return;
        form._aeRestructured = true;

        // 1. Pair fields in 2-column grids
        FIELD_PAIRS.forEach(function (pair) {
            var labelA = findLabelCellForInput(pair[0]);
            var labelB = findLabelCellForInput(pair[1]);
            wrapFieldPair(labelA, labelB);
        });

        LABEL_FIELD_PAIRS.forEach(function (pair) {
            var labelA = findLabelCellByText(pair[0]);
            var labelB = findLabelCellByText(pair[1]);
            wrapFieldPair(labelA, labelB);
        });

        // 2. Wrap garment fields into card rows
        wrapGarmentRows();

        // 3. Style section groups
        styleSectionGroups();

        // 4. Style file uploads
        styleFileUploads();

        // 5. Enhance submit button
        enhanceSubmitButton();
    }

    // ── Request Type Toggle (New Artwork / Mockup) ─────────────────

    /**
     * Elements to hide/show when toggling between New Artwork and Mockup modes.
     * Collected once after DOM restructuring, cached for fast toggling.
     */
    var _mockupToggleTargets = null;
    var _designLabelOriginalText = '';

    /**
     * Collect the DOM elements that need to be hidden in mockup mode.
     * Must be called AFTER restructureFormLayout() so .field-pair wrappers exist.
     */
    function collectMockupTargets() {
        var targets = [];

        // 1. Contact Details section header (find by 📇 emoji in Caspio HTML blocks)
        var htmlBlocks = document.querySelectorAll('#submit-tab .cbHTMLBlockContainer, #submit-tab .section-header');
        htmlBlocks.forEach(function (block) {
            if (block.textContent.indexOf('📇') !== -1 || block.textContent.toLowerCase().indexOf('contact') !== -1) {
                targets.push(block);
            }
        });

        // 2. First_name + Last_name entire .field-pair
        var firstNameInput = document.querySelector('[name="InsertRecordFirst_name"]');
        if (firstNameInput) {
            var pair = firstNameInput.closest('.field-pair');
            if (pair) targets.push(pair);
        }

        // 3. Order_Num_SW .field-group (within Design # / Order # pair)
        var orderNumInput = document.querySelector('[name="InsertRecordOrder_Num_SW"]');
        if (orderNumInput) {
            var group = orderNumInput.closest('.field-group');
            if (group) targets.push(group);
        }

        // 4. Order Type .field-group (within Order Type / Due Date pair)
        //    This was paired by label text, so find via label content
        var allFieldGroups = document.querySelectorAll('#submit-tab .field-group');
        allFieldGroups.forEach(function (fg) {
            var label = fg.querySelector('.cbFormLabelCell label');
            if (label && label.textContent.trim().replace(/\*/g, '').trim() === 'Order Type') {
                targets.push(fg);
            }
        });

        // 5. Prelim_Charges + Additional_Services entire .field-pair
        var prelimInput = document.querySelector('[name="InsertRecordPrelim_Charges"]');
        if (prelimInput) {
            var pair2 = prelimInput.closest('.field-pair');
            if (pair2) targets.push(pair2);
        }

        return targets;
    }

    /**
     * Initialize the request type toggle (New Artwork / Mockup).
     * Attaches click listeners to toggle buttons, manages show/hide + relabeling.
     */
    function initRequestTypeToggle() {
        var toggleContainer = document.getElementById('request-type-toggle');
        if (!toggleContainer) return;

        var buttons = toggleContainer.querySelectorAll('.toggle-btn');
        if (buttons.length === 0) return;

        // Wrap buttons in .toggle-row if not already wrapped (Caspio HTML Block is flat)
        if (!toggleContainer.querySelector('.toggle-row')) {
            var row = document.createElement('div');
            row.className = 'toggle-row';
            buttons.forEach(function (btn) { row.appendChild(btn); });
            var helper = toggleContainer.querySelector('.toggle-helper');
            toggleContainer.insertBefore(row, helper || null);
        }

        // Collect targets (must be done after restructuring)
        _mockupToggleTargets = collectMockupTargets();

        // Cache original Design # label text
        var designLabel = findLabelForInput('Design_Num_SW');
        if (designLabel) {
            _designLabelOriginalText = designLabel.textContent.trim();
        }

        // Attach listeners
        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var requestType = btn.getAttribute('data-type');

                // Update active state
                buttons.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');

                // Set hidden field value + track mode for validation
                _currentRequestType = requestType === 'mockup' ? 'Mockup' : 'New Artwork';
                var hiddenField = document.querySelector('[name="InsertRecordRequest_Type"]');
                if (hiddenField) {
                    hiddenField.value = _currentRequestType;
                }

                // Toggle required asterisk visibility
                var asterisk = document.querySelector('.ae-required-asterisk');
                if (asterisk) asterisk.style.display = requestType === 'mockup' ? 'none' : '';

                // Clear any validation state on Order # when switching modes
                var orderInput = document.querySelector('[name="InsertRecordOrder_Num_SW"]');
                if (orderInput) {
                    orderInput.classList.remove('ae-field-error', 'ae-field-warning');
                    var fb = orderInput.parentNode.querySelector('.ae-order-feedback');
                    if (fb) fb.style.display = 'none';
                }

                // Update helper text
                var helper = document.getElementById('toggle-helper');
                if (helper) {
                    helper.textContent = requestType === 'mockup'
                        ? 'Place an existing design on a garment'
                        : 'Create new artwork from scratch';
                }

                // Toggle visibility
                applyMockupMode(requestType === 'mockup');
            });
        });
    }

    /**
     * Find the <label> element for a given input field name.
     */
    function findLabelForInput(inputName) {
        var input = document.querySelector('[name="InsertRecord' + inputName + '"]');
        if (!input) return null;
        var fieldGroup = input.closest('.field-group');
        if (fieldGroup) {
            var labelCell = fieldGroup.querySelector('.cbFormLabelCell label');
            if (labelCell) return labelCell;
        }
        var labelCell2 = findLabelCellForInput(inputName);
        if (labelCell2) {
            return labelCell2.querySelector('label');
        }
        return null;
    }

    /**
     * Show or hide sections based on mockup mode.
     */
    function applyMockupMode(isMockup) {
        if (!_mockupToggleTargets) return;

        _mockupToggleTargets.forEach(function (el) {
            if (isMockup) {
                el.classList.add('mockup-hidden');
            } else {
                el.classList.remove('mockup-hidden');
            }
        });

        // Relabel Design # field
        var designLabel = findLabelForInput('Design_Num_SW');
        if (designLabel) {
            if (isMockup) {
                designLabel.textContent = 'Existing Design #';
            } else {
                designLabel.textContent = _designLabelOriginalText || 'Design #';
            }
        }
    }

    // ── Order # Validation & ShopWorks Verification ────────────────

    /**
     * Track current request type mode for validation.
     * Updated by initRequestTypeToggle() click handler.
     */
    var _currentRequestType = 'New Artwork'; // default

    /**
     * Add required asterisk to Order # label and attach validation.
     * - On blur: verify order exists in ShopWorks via ManageOrders API
     * - On submit: block if empty in New Artwork mode
     */
    function initOrderValidation() {
        var orderInput = document.querySelector('[name="InsertRecordOrder_Num_SW"]');
        if (!orderInput || orderInput._aeOrderValidation) return;
        orderInput._aeOrderValidation = true;

        // Add required asterisk to label
        var label = findLabelForInput('Order_Num_SW');
        if (label && label.textContent.indexOf('*') === -1) {
            var asterisk = document.createElement('span');
            asterisk.className = 'ae-required-asterisk';
            asterisk.textContent = ' *';
            label.appendChild(asterisk);
        }

        // Create feedback container next to input
        var feedback = document.createElement('div');
        feedback.className = 'ae-order-feedback';
        feedback.style.display = 'none';
        orderInput.parentNode.insertBefore(feedback, orderInput.nextSibling);

        // On blur — verify order in ShopWorks
        orderInput.addEventListener('blur', function () {
            var orderNum = orderInput.value.trim();
            orderInput.classList.remove('ae-field-error', 'ae-field-verified', 'ae-field-warning');
            feedback.style.display = 'none';

            if (!orderNum) return;

            feedback.className = 'ae-order-feedback ae-order-feedback--loading';
            feedback.textContent = 'Checking ShopWorks...';
            feedback.style.display = 'block';

            fetch(API_BASE + '/api/manageorders/orders/' + encodeURIComponent(orderNum))
                .then(function (resp) { return resp.ok ? resp.json() : { result: [] }; })
                .then(function (data) {
                    var orders = data.result || data || [];
                    if (orders.length > 0) {
                        var order = orders[0];
                        var customerName = order.CustomerName || '';
                        orderInput.classList.add('ae-field-verified');
                        feedback.className = 'ae-order-feedback ae-order-feedback--success';
                        feedback.innerHTML = '&#x2714; Order ' + escapeHtml(orderNum) + (customerName ? ' &mdash; ' + escapeHtml(customerName) : '');

                        // Auto-fill empty fields from ManageOrders data
                        autoFillFromOrder(order);

                        // Also fetch line items for garment styles + colors
                        fetchAndFillLineItems(orderNum);
                    } else {
                        orderInput.classList.add('ae-field-warning');
                        feedback.className = 'ae-order-feedback ae-order-feedback--warning';
                        feedback.textContent = '\u2139 Order not verified yet \u2014 it may still be syncing from ShopWorks';
                    }
                    feedback.style.display = 'block';
                })
                .catch(function () {
                    feedback.style.display = 'none';
                });
        });

        // On submit — block if empty in New Artwork mode
        var form = orderInput.closest('form');
        if (form) {
            form.addEventListener('submit', function (e) {
                if (_currentRequestType === 'Mockup') return; // skip in mockup mode

                if (!orderInput.value.trim()) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    orderInput.classList.add('ae-field-error');
                    feedback.className = 'ae-order-feedback ae-order-feedback--error';
                    feedback.textContent = 'ShopWorks Order # is required for New Artwork requests';
                    feedback.style.display = 'block';
                    orderInput.focus();
                    orderInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return false;
                }
            }, true); // capture phase to fire before Caspio
        }
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── ShopWorks Order Type ID → Caspio checkbox values ──
    var ORDER_TYPE_ID_MAP = {
        1:   ['Embroidery'],              // CAP Order
        2:   ['Embroidery'],              // College Embroidery
        3:   ['Other'],                   // Importing
        4:   ['Other'],                   // Blank Goods
        11:  ['Screen Print'],            // Custom Screen Print
        12:  ['Screen Print'],            // Contract Screen Print
        13:  ['Screen Print'],            // Screen Print Subcontract
        14:  ['Screen Print'],            // Sample Screen Print
        21:  ['Embroidery'],              // Custom Embroidery
        22:  ['Embroidery'],              // Contract Embroidery
        23:  ['Embroidery'],              // Subcontract Embroidery
        24:  ['Other'],                   // Sample-Return to Vendor
        31:  ['DTG'],                     // Inksoft
        32:  ['Screen Print'],            // Preprint Customized, Screen
        33:  ['Embroidery'],              // Preprint Customized, Embroidery
        41:  ['Laser Engraving', 'ASI'],  // Laser/Ad Specialties
        51:  ['Screen Print'],            // Screen Print Preprint Production
        52:  ['Embroidery'],              // Embroidery Preprint Production
        61:  ['Other'],                   // Inventory
        91:  ['Embroidery'],              // Contract Receiving
        95:  ['Other'],                   // Digitizing
        999: ['Other']                    // External
    };

    /**
     * Auto-fill empty form fields from ManageOrders order data.
     * Only fills fields that are currently empty (won't overwrite screenshot/text paste data).
     */
    function autoFillFromOrder(order) {
        if (!order || !window.ScreenshotFill) return;

        var ssf = window.ScreenshotFill;
        var filledCount = 0;

        // Helper: set field only if empty
        function setIfEmpty(fieldName, value) {
            if (!value) return false;
            var input = document.querySelector('[name="' + fieldName + '"]');
            if (input && !input.value.trim()) {
                input.value = String(value).trim();
                input.dispatchEvent(new Event('change', { bubbles: true }));
                ssf.highlightField(input);
                filledCount++;
                return true;
            }
            return false;
        }

        // Company name
        setIfEmpty('InsertRecordCompanyName', order.CustomerName);

        // Customer number
        setIfEmpty('InsertRecordShopwork_customer_number', order.id_Customer);

        // Design number
        setIfEmpty('InsertRecordDesign_Num_SW', order.id_Design);

        // Contact — try cascade dropdown first
        if (order.ContactFirstName || order.ContactLastName) {
            var fullName = ((order.ContactFirstName || '') + ' ' + (order.ContactLastName || '')).replace(/\s+/g, ' ').trim();
            var contactSelect = document.querySelector('select[name="InsertRecordFull_Name_Contact"]');
            // Only attempt if contact dropdown hasn't been selected yet
            if (contactSelect && (!contactSelect.value || contactSelect.selectedIndex <= 0)) {
                ssf.scheduleContactSelect(fullName, {
                    contactFirstName: (order.ContactFirstName || '').trim(),
                    contactLastName: (order.ContactLastName || '').trim(),
                    contactEmail: order.ContactEmail || ''
                });
            }
        }

        // Order Type — map numeric ID to checkbox values
        if (order.id_OrderType && ORDER_TYPE_ID_MAP[order.id_OrderType]) {
            // Only fill if no order type checkboxes are already checked
            var otLabel = null;
            var allLabels = document.querySelectorAll('#submit-tab label');
            for (var i = 0; i < allLabels.length; i++) {
                if (allLabels[i].textContent.trim().replace(/\s*\*$/, '') === 'Order Type') {
                    otLabel = allLabels[i]; break;
                }
            }
            if (otLabel) {
                var otCell = otLabel.closest('.cbFormLabelCell');
                var otField = otCell ? otCell.nextElementSibling : null;
                if (otField && !otField.querySelector('input[type="checkbox"]:checked')) {
                    ssf.fillOrderTypeByValues(ORDER_TYPE_ID_MAP[order.id_OrderType]);
                    filledCount++;
                }
            }
        }

        // Due Date — order date + 3 business days (only if empty)
        if (order.date_Ordered) {
            var dueDateInput = document.querySelector('[name="InsertRecordDue_Date"]');
            if (dueDateInput && !dueDateInput.value.trim()) {
                var orderDate = new Date(order.date_Ordered);
                if (!isNaN(orderDate.getTime())) {
                    var artDue = ssf.addBusinessDays(orderDate, 3);
                    var mm = String(artDue.getMonth() + 1);
                    var dd = String(artDue.getDate());
                    var yyyy = artDue.getFullYear();
                    dueDateInput.value = mm + '/' + dd + '/' + yyyy;
                    dueDateInput.dispatchEvent(new Event('change', { bubbles: true }));
                    ssf.highlightField(dueDateInput);
                    filledCount++;
                }
            }
        }

        if (filledCount > 0) {
            ssf.showToast('Auto-filled ' + filledCount + ' fields from order data');
        }

        // Check for missing fields after cascades settle
        setTimeout(function () { ssf.checkMissingFields(); }, 3000);
    }

    // ── Garment style fields (rows 1-4) ──
    var GARMENT_STYLE_FIELDS = [
        'InsertRecordGarmentStyle',
        'InsertRecordGarm_Style_2',
        'InsertRecordGarm_Style_3',
        'InsertRecordGarm_Style_4'
    ];

    // Non-garment part number prefixes to skip
    var NON_GARMENT_PREFIXES = ['GRT-', 'STK-', 'LTM', 'Art', 'SHIP', 'TAX', 'DISC'];

    // Art Estimate mapping from GRT part numbers
    var ART_ESTIMATE_MAP = {
        'GRT-25': '25',
        'GRT-50': '50',
        'GRT-75': '75',
        'GRT-100': '100',
        'GRT-150': '150'
    };

    /**
     * Fetch line items for an order and fill garment style/color rows.
     */
    function fetchAndFillLineItems(orderNum) {
        fetch(API_BASE + '/api/manageorders/lineitems/' + encodeURIComponent(orderNum))
            .then(function (resp) { return resp.ok ? resp.json() : { result: [] }; })
            .then(function (data) {
                var lineItems = data.result || [];
                if (lineItems.length > 0) {
                    fillGarmentsFromLineItems(lineItems);
                }
            })
            .catch(function (err) {
                console.warn('[AE] Line items fetch failed:', err.message);
            });
    }

    /**
     * Fill garment style/color rows from ManageOrders line items.
     * Filters out non-garment items, deduplicates by base part number.
     */
    function fillGarmentsFromLineItems(lineItems) {
        var ssf = window.ScreenshotFill;
        if (!ssf) return;

        var garments = [];
        var artCharge = null;
        var seenParts = {};

        lineItems.forEach(function (item) {
            if (!item.PartNumber) return;
            var pn = item.PartNumber;

            // Check for GRT art charge
            if (pn.indexOf('GRT-') === 0) {
                var base = pn.replace(/_\w+$/, '');
                if (!artCharge && ART_ESTIMATE_MAP[base]) {
                    artCharge = base;
                }
                return;
            }

            // Skip non-garment items
            var skip = NON_GARMENT_PREFIXES.some(function (prefix) {
                return pn.indexOf(prefix) === 0;
            });
            if (skip) return;

            // Strip size suffix: C110_OSFA → C110, PC850H_2X → PC850H
            var basePn = pn.replace(/_\w+$/, '');

            // Deduplicate by base part number
            if (seenParts[basePn]) return;
            seenParts[basePn] = true;

            garments.push({
                partNumber: basePn,
                color: item.PartColor || ''
            });
        });

        // Fill garment rows (only if empty)
        garments.slice(0, 4).forEach(function (g, i) {
            var styleInput = document.querySelector('[name="' + GARMENT_STYLE_FIELDS[i] + '"]');
            if (styleInput && !styleInput.value.trim()) {
                styleInput.value = g.partNumber;
                styleInput.dispatchEvent(new Event('change', { bubbles: true }));
                styleInput.dispatchEvent(new Event('blur', { bubbles: true }));
                ssf.highlightField(styleInput);

                // Schedule color fill after Caspio cascade populates the dropdown
                if (g.color && ssf.scheduleColorFill) {
                    var colorFields = [
                        'InsertRecordGarmentColor',
                        'InsertRecordGarm_Color_2',
                        'InsertRecordGarm_Color_3',
                        'InsertRecordGarm_Color_4'
                    ];
                    ssf.scheduleColorFill(colorFields[i], g.color);
                }
            }
        });

        // Fill Art Estimate if GRT line item found
        if (artCharge && ART_ESTIMATE_MAP[artCharge]) {
            var artSelect = document.querySelector('[name="InsertRecordPrelim_Charges"]');
            if (artSelect && (!artSelect.value || artSelect.selectedIndex <= 0)) {
                artSelect.value = ART_ESTIMATE_MAP[artCharge];
                artSelect.dispatchEvent(new Event('change', { bubbles: true }));
                ssf.highlightField(artSelect);
            }
        }
    }

    // ── Init ───────────────────────────────────────────────────────

    /**
     * Add "Paste Order Text" backup button below the request type toggle.
     */
    function addScreenshotFillButton() {
        // Remove any existing screenshot buttons (from Caspio HTML Block or prev DataPageReady calls)
        document.querySelectorAll('.ae-screenshot-btn').forEach(function (el) { el.remove(); });
        document.querySelectorAll('.ae-tools-strip').forEach(function (el) { el.remove(); });

        var toggleContainer = document.getElementById('request-type-toggle');
        if (!toggleContainer) return;

        var strip = document.createElement('div');
        strip.className = 'ae-tools-strip';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ae-screenshot-btn';
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Paste Order Text';
        btn.title = 'Paste ShopWorks text export as backup when order # is not available';
        btn.addEventListener('click', function () {
            if (window.ScreenshotFill) {
                window.ScreenshotFill.open();
            }
        });

        strip.appendChild(btn);
        toggleContainer.parentElement.insertBefore(strip, toggleContainer.nextSibling);
    }

    // ── Rush Checkbox Styling + State Capture ──────────────────────
    // The Caspio DataPage renders an Is_Rush Yes/No checkbox as
    // [name="InsertRecordIs_Rush"]. We visually promote it to a big red
    // toggle and stash its state on submit so notifyNewSubmission() knows
    // whether to fire the rush confirmation email.
    function styleRushCheckbox() {
        var input = document.querySelector('input[name="InsertRecordIs_Rush"]');
        if (!input || input.dataset.rushStyled === '1') return;
        input.dataset.rushStyled = '1';

        var fieldCell = input.closest('.cbFormFieldCell') || input.parentElement;
        if (!fieldCell) return;

        // Hide Caspio's default label cell (the "Is Rush:" text)
        var labelCell = findLabelCellForInput('Is_Rush');
        if (labelCell) labelCell.style.display = 'none';

        // Wrap the checkbox in a custom-styled label
        var wrap = document.createElement('label');
        wrap.className = 'ae-rush-toggle';
        wrap.innerHTML = '<span class="ae-rush-icon">&#128293;</span>'
            + '<span class="ae-rush-label">Rush Order</span>'
            + '<span class="ae-rush-hint">Tick if Steve needs this ASAP</span>';
        // Move the actual checkbox into the wrapper (kept but visually hidden)
        input.classList.add('ae-rush-checkbox');
        wrap.insertBefore(input, wrap.firstChild);
        fieldCell.innerHTML = '';
        fieldCell.appendChild(wrap);

        // Reflect active state on the wrapper
        var syncState = function () {
            wrap.classList.toggle('ae-rush-toggle--active', input.checked);
        };
        input.addEventListener('change', syncState);
        syncState();
    }

    function captureRushOnSubmit() {
        var submitBtn = document.querySelector('input[id*="Submit"], input[type="submit"], button[type="submit"]');
        if (!submitBtn || submitBtn.dataset.rushHooked === '1') return;
        submitBtn.dataset.rushHooked = '1';

        submitBtn.addEventListener('click', function () {
            var input = document.querySelector('input[name="InsertRecordIs_Rush"]');
            window.__rushStateOnSubmit = !!(input && input.checked);
        }, true); // capture phase so we stash before Caspio submits
    }

    document.addEventListener('DataPageReady', function () {
        setTimeout(function () {
            restructureFormLayout();
            initRequestTypeToggle();
            addScreenshotFillButton();
            initOrderValidation();
            monitorGarmentCascade();
            monitorAllSwatchesAndImages();
            addRowNumbers();
            attachColorDropdownListeners();
            startImagePolling();
            watchForFormSubmission();
            styleRushCheckbox();
            captureRushOnSubmit();
        }, 500);
    });

})();
