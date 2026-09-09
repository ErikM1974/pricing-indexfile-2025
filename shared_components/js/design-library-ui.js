/* Shared presentation adapter for the two Caspio design libraries.
 * It leaves provider field names, values, submit handlers and data intact.
 */
(function () {
    'use strict';
    var container = document.querySelector('[data-design-library] .caspio-container');
    if (!container) return;
    function decorate() {
        if (document.body.dataset.designLibrary === 'reference') container.querySelectorAll('header').forEach(function (header) { header.hidden = true; });
        container.querySelectorAll('.cbFormLabelCell').forEach(function (label) {
            if (label.closest('.form-field-group')) return;
            var field = label.nextElementSibling;
            if (!field || !field.classList.contains('cbFormFieldCell')) return;
            var group = document.createElement('div'); group.className = 'form-field-group';
            label.before(group); group.append(label, field);
        });
        container.querySelectorAll('.cbSearchSpa, section[class*="cbFormSection"], .cbFormTable').forEach(function (section) { section.classList.add('design-search-fields'); });
        container.querySelectorAll('.cbColumnarReport, [id^="GridCtnr_"] section').forEach(function (section) { section.classList.add('design-result-grid'); });
        container.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="checkbox"]), select, textarea').forEach(function (field) { field.classList.add('field-input'); });
        container.querySelectorAll('input[type="submit"], .cbSearchButton').forEach(function (button) { button.classList.add('btn', 'btn-primary'); });
        container.querySelectorAll('.restructured dl.cbResultSetPanelDataContainer').forEach(function (source) { source.hidden = true; });
    }
    var pending;
    new MutationObserver(function () { clearTimeout(pending); pending = setTimeout(decorate, 30); }).observe(container, { childList: true, subtree: true });
    decorate();
}());
