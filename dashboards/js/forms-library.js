/**
 * forms-library.js — controller for dashboards/forms-library.html
 *
 * Renders the Caspio Forms_Library registry (via proxy GET /api/forms-library)
 * grouped by Category. Every form gets a "Download / Print PDF" action; forms
 * with a Fill_Online_URL also get "Fill Out Online". Erik adds rows in Caspio →
 * they appear here with no deploy.
 *
 * APIs called via DashPage.fetchJson(path) — automatically uses
 * APP_CONFIG.API.BASE_URL. Errors surface to .dash-error-banner via
 * DashPage.showError() — never silently fall back to cached data.
 */
(function () {
    'use strict';

    var CATEGORY_ICONS = {
        'Customer Intake': 'fa-clipboard-user',
        'Payments': 'fa-credit-card',
        'Employee / HR': 'fa-id-badge',
        'Supplies & Production': 'fa-boxes-stacked'
    };
    var DEFAULT_ICON = 'fa-file-lines';

    document.addEventListener('DOMContentLoaded', boot);

    function boot() {
        var root = document.getElementById('formsRoot');
        if (root) { root.classList.add('dash-loading'); root.textContent = 'Loading forms…'; }
        loadForms().then(function () { DashPage.hideError(); }).catch(function (err) {
            console.error('[forms-library] load failed:', err);
            DashPage.showError('Unable to load the forms list (' + (err.message || 'request failed') + ').');
            if (root) {
                root.classList.remove('dash-loading');
                root.innerHTML = '<div class="forms-load-failed" role="alert"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> Forms list unavailable (' + escapeHtml(err.message || 'request failed') + '). ' +
                    '<button type="button" class="dash-btn dash-btn--sm" id="forms-retry">Retry</button></div>';
                var rb = document.getElementById('forms-retry'); if (rb) rb.addEventListener('click', boot);
            }
        });
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // URLs come from the Erik-controlled Caspio table, but still refuse anything
    // that isn't a site-relative path or http(s) URL (e.g. javascript:).
    function safeUrl(value) {
        var url = String(value == null ? '' : value).trim();
        if (!url) return '';
        if (url.startsWith('/') || /^https?:\/\//i.test(url)) return url;
        return '';
    }

    async function loadForms() {
        var data = await DashPage.fetchJson('/api/forms-library');
        var forms = (data && data.forms) || [];
        render(forms);
    }

    function render(forms) {
        var root = document.getElementById('formsRoot');
        if (!root) return;
        root.classList.remove('dash-loading');

        if (!forms.length) {
            root.innerHTML = '<div class="forms-load-failed">No active forms in the Forms_Library table yet.</div>';
            return;
        }

        // API returns rows already sorted Category → Sort_Order; group in order.
        var groups = [];
        var byCategory = {};
        forms.forEach(function (form) {
            var cat = form.Category || 'General';
            if (!byCategory[cat]) {
                byCategory[cat] = [];
                groups.push(cat);
            }
            byCategory[cat].push(form);
        });

        var html = groups.map(function (cat) {
            var icon = CATEGORY_ICONS[cat] || DEFAULT_ICON;
            var rows = byCategory[cat].map(renderForm).join('');
            return (
                '<section class="dash-card forms-category">' +
                    '<div class="dash-card-header">' +
                        '<h2 class="dash-card-title"><i aria-hidden="true" class="fas ' + icon + '"></i> ' + escapeHtml(cat) + '</h2>' +
                    '</div>' +
                    '<div class="forms-rows">' + rows + '</div>' +
                '</section>'
            );
        }).join('');

        root.innerHTML = html;
    }

    function renderForm(form) {
        var pdfUrl = safeUrl(form.PDF_URL);
        var fillUrl = safeUrl(form.Fill_Online_URL);

        var actions = '';
        if (fillUrl) {
            actions +=
                '<a class="dash-btn dash-btn--primary" href="' + escapeHtml(fillUrl) + '" aria-label="Fill out ' + escapeHtml(form.Form_Name) + ' online">' +
                    '<i class="fas fa-pen-to-square" aria-hidden="true"></i> Fill Out Online' +
                '</a>';
        }
        if (pdfUrl) {
            actions +=
                '<a class="dash-btn" href="' + escapeHtml(pdfUrl) + '" target="_blank" rel="noopener" aria-label="Download or print ' + escapeHtml(form.Form_Name) + ' (PDF, opens in a new tab)">' +
                    '<i class="fas fa-file-pdf" aria-hidden="true"></i> Download / Print PDF' +
                '</a>';
        }

        return (
            '<div class="forms-row">' +
                '<div class="forms-row-text">' +
                    '<div class="forms-row-name">' + escapeHtml(form.Form_Name) + '</div>' +
                    (form.Description ? '<div class="forms-row-desc">' + escapeHtml(form.Description) + '</div>' : '') +
                '</div>' +
                '<div class="forms-row-actions">' + (actions || '<span class="forms-row-desc">No file linked</span>') + '</div>' +
            '</div>'
        );
    }
})();
